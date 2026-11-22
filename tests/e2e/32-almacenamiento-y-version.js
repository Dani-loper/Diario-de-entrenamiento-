const { chromium, devices } = require('playwright');
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const page = async (opts = {}, init) => { const c = await b.newContext({ ...devices['Pixel 7'], ...opts }); if (init) await c.addInitScript(init); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept()); return p; };
  // ---- Los datos viven en IndexedDB ----
  let p = await page();
  await p.goto('http://localhost:8123/');
  const s1 = await p.evaluate(async () => {
    save(true); // en una instalación nueva, los datos se guardan con el primer cambio
    const ls = Object.keys(localStorage).filter((k) => k.startsWith('diario-entreno.u.') || k === 'diario-entreno.perfiles');
    await new Promise((r) => setTimeout(r, 200));
    const inIdb = await new Promise((res) => { const r = indexedDB.open('diario-entreno-datos'); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').getAllKeys(); q.onsuccess = () => res(q.result); }; });
    return { ls, inIdb, backend: kv.stats().backend };
  });
  assert(s1.backend === 'IndexedDB' && !s1.ls.length && s1.inIdb.includes('diario-entreno.perfiles') && s1.inIdb.some((k) => k.startsWith('diario-entreno.u.')), 'perfiles y datos en IndexedDB, nada en localStorage');
  // ---- Migración desde localStorage (versiones anteriores) ----
  await p.evaluate(() => { const id = profiles.active, d = JSON.parse(kv.get(`diario-entreno.u.${id}`)); d.sessions.push({ id: 'vieja', createdAt: '2026-11-01T10', date: '2026-11-01', startedAt: 1, endedAt: 2, title: 'De la versión anterior', factors: [], exercises: [] }); localStorage.setItem(`diario-entreno.u.${id}`, JSON.stringify(d)); });
  await p.reload();
  const s2 = await p.evaluate(() => ({ has: db.sessions.some((s) => s.id === 'vieja'), ls: Object.keys(localStorage).filter((k) => k.startsWith('diario-entreno.u.')).length }));
  assert(s2.has && s2.ls === 0, 'datos de una versión anterior en localStorage: se pasan a IndexedDB y se quitan de localStorage');
  // ---- Diario de escrituras: cambio que no llegó a IndexedDB ----
  await p.evaluate(() => { save = () => {}; /* cierre de golpe: no hay guardado al salir */ const k = `diario-entreno.u.${profiles.active}`, d = JSON.parse(kv.get(k)); d.sessions.push({ id: 'pendiente', createdAt: '2026-11-02T10', date: '2026-11-02', startedAt: 1, endedAt: 2, title: 'Sin confirmar', factors: [], exercises: [] }); localStorage.setItem('kvj:' + k, JSON.stringify({ op: 'put', v: JSON.stringify(d) })); });
  await p.reload();
  const s3 = await p.evaluate(() => ({ has: db.sessions.some((s) => s.id === 'pendiente'), j: Object.keys(localStorage).filter((k) => k.startsWith('kvj:')).length }));
  assert(s3.has && s3.j === 0, 'un cambio pendiente (app cerrada de golpe) se recupera al abrir y el apunte se borra');
  // ---- Más allá del límite de localStorage (~5 MB) ----
  const big = await p.evaluate(async () => {
    const sq = db.exercises[0].id, note = 'x'.repeat(4000);
    for (let i = 0; i < 2000; i++) db.sessions.push({ id: 'g' + i, createdAt: '2025-01-01T10', date: '2025-01-01', startedAt: 1, endedAt: 2, title: 'Relleno', notes: note, factors: [], exercises: [{ id: 'e' + i, exerciseId: sq, equipment: [], notes: '', sets: [] }] });
    save(true); await new Promise((r) => setTimeout(r, 1500)); return Math.round(kv.stats().chars / 1048576);
  });
  await p.reload();
  assert(big >= 8 && await p.evaluate(() => db.sessions.length > 2000), `guarda ${big} MB (más que todo localStorage) y los recupera al abrir`);
  // ---- Sin IndexedDB: sigue funcionando con localStorage ----
  p = await page({}, () => { Object.defineProperty(window, 'indexedDB', { value: { open: () => { throw new Error('sin IndexedDB'); } } }); });
  await p.goto('http://localhost:8123/');
  await p.evaluate(() => { db.sessions.push({ id: 'ls', createdAt: '2026-11-03T10', date: '2026-11-03', startedAt: 1, endedAt: 2, title: 'x', factors: [], exercises: [] }); save(true); });
  await p.reload();
  assert(await p.evaluate(() => kv.stats().backend === 'localStorage' && db.sessions.some((s) => s.id === 'ls')), 'sin IndexedDB guarda y recupera en localStorage');
  // ---- Aviso de versión nueva (app Android simulada) ----
  const native = () => { window.Capacitor = { isNativePlatform: () => true, Plugins: {} }; };
  p = await page({}, native);
  await p.route('**/version.json', (r) => r.fulfill({ json: { version: '1.5', code: 5 } }));
  await p.route('https://api.github.com/**', (r) => r.fulfill({ json: { tag_name: 'android-v1.7', name: 'App Android 1.7', html_url: 'https://github.com/Dani-loper/Diario-de-entrenamiento-/releases/tag/android-v1.7' } }));
  await p.goto('http://localhost:8123/');
  await p.waitForSelector('text=Hay una versión nueva de la app (App Android 1.7)');
  assert(await p.getAttribute('a.btn.primary[href*="releases/tag/android-v1.7"]', 'href') !== null, 'app 1.5 y publicada la 1.7: aviso con enlace de descarga');
  await p.click('[data-action=update-dismiss]');
  assert(!(await p.isVisible('text=Hay una versión nueva')), '«Más tarde» oculta el aviso de esa versión');
  await p.goto('http://localhost:8123/#/settings');
  assert((await p.textContent('#app')).includes('App Android 1.5') && (await p.textContent('#app')).includes('última publicada: App Android 1.7'), 'Ajustes muestra la versión instalada y la última publicada');
  // Web: sin aviso ni consulta a GitHub
  let asked = false;
  p = await page();
  await p.route('https://api.github.com/**', (r) => { asked = true; r.abort(); });
  await p.goto('http://localhost:8123/#/settings'); await p.waitForTimeout(300);
  assert(!asked && (await p.textContent('#app')).includes('Versión web'), 'en la web no consulta GitHub (siempre carga la última)');
  console.log('errors', errs); await b.close();
})();
