// Registro de errores e informe para enviar: captura, repeticiones, límite, sin datos personales, copiar y enviar.
const { chromium, devices } = require('playwright');
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['Pixel 7'], permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage();
  await p.goto('http://localhost:8123/');
  await p.evaluate(() => {
    activeUser().name = 'Laura Secreta'; saveProfiles();
    const sq = db.exercises.find((e) => e.name === 'Sentadilla trasera').id;
    db.sessions.push({ id: 'x1', createdAt: todayISO() + 'T10', date: todayISO(), startedAt: 1, endedAt: 2, title: 'Pierna confidencial', notes: 'Me duele la rodilla', factors: [], exercises: [{ id: 'e', exerciseId: sq, equipment: [], notes: '', sets: [{ type: 'E', w: 100, reps: 5, rir: 2, done: true }] }] });
    save(true);
  });
  // Errores: uno normal, uno repetido tres veces y una promesa sin capturar
  await p.evaluate(() => {
    const run = (code) => { const s = document.createElement('script'); s.textContent = code; document.body.appendChild(s); s.remove(); };
    run("throw new Error('Fallo de prueba')");
    for (let i = 0; i < 3; i++) run("throw new Error('Fallo repetido')");
    run("Promise.reject(new Error('Promesa rota'))");
  });
  await p.waitForTimeout(300);
  const list = await p.evaluate(() => JSON.parse(localStorage.getItem('diario-entreno.errores')));
  assert(list.length === 3 && list[0].msg.includes('Fallo de prueba') && list[1].n === 3 && list[2].msg.includes('Promesa rota'), 'registra errores y promesas sin capturar; los repetidos seguidos se cuentan (×3)');
  // Límite de 30
  await p.evaluate(() => { for (let i = 0; i < 40; i++) errLog('Error ' + i); });
  assert(await p.evaluate(() => JSON.parse(localStorage.getItem('diario-entreno.errores')).length) === 30, 'guarda como mucho los últimos 30');
  // Ajustes › Acerca de
  await p.goto('http://localhost:8123/#/settings'); await p.waitForSelector('[data-action=err-copy]');
  assert((await p.textContent('.card:has([data-action=err-copy])')).includes('Errores registrados: 30'), 'Ajustes muestra cuántos errores hay');
  await p.click('[data-action=err-copy]');
  await p.waitForTimeout(200);
  const txt = await p.evaluate(() => navigator.clipboard.readText());
  assert(txt.startsWith('INFORME DE ERROR') && txt.includes('Versión: web') && txt.includes('Error 39') && txt.includes('sesiones del activo: 1') && txt.includes('Almacenamiento: IndexedDB') && txt.includes('Pantalla actual: #/settings'), 'copia el informe: versión, almacenamiento, recuentos y errores');
  assert(!/Laura|Secreta|confidencial|rodilla|Sentadilla/.test(txt), 'el informe no incluye nombres ni datos de entrenamiento');
  // Borrar
  await p.click('[data-action=err-clear]');
  assert(await p.evaluate(() => localStorage.getItem('diario-entreno.errores')) === null && (await p.textContent('#app')).includes('No hay errores registrados'), '«Borrar el registro»');
  // App Android: «Enviar…» abre la hoja de compartir con el texto
  const n = await b.newContext({ ...devices['Pixel 7'] });
  await n.addInitScript(() => { window.__shared = null; window.Capacitor = { isNativePlatform: () => true, Plugins: { Share: { share: async (o) => { window.__shared = o.text; return {}; } }, Filesystem: {} } }; });
  const q = await n.newPage();
  await q.goto('http://localhost:8123/#/settings'); await q.waitForSelector('[data-action=err-share]');
  await q.click('[data-action=err-share]');
  await q.waitForFunction(() => window.__shared);
  assert(await q.evaluate(() => window.__shared.startsWith('INFORME DE ERROR') && window.__shared.includes('app Android')), 'app Android: «Enviar…» abre la hoja de compartir con el informe');
  // Un fallo al guardar queda registrado
  await q.evaluate(() => { window.alert = () => {}; IDBObjectStore.prototype.put = function () { throw new DOMException('Sin espacio', 'QuotaExceededError'); }; kv.set('diario-entreno.u.prueba', 'x'); });
  await q.waitForTimeout(300);
  assert(await q.evaluate(() => (JSON.parse(localStorage.getItem('diario-entreno.errores')) || []).some((e) => e.msg.startsWith('No se pudo guardar'))), 'los fallos al guardar quedan en el registro');
  await b.close();
})();
