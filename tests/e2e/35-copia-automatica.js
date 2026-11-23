// Copia automática en Documentos/DiarioEntreno (app Android, puente de Capacitor simulado con un sistema de archivos en memoria).
const { chromium, devices } = require('playwright');
const out = process.argv[2] || 'shots';
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['Pixel 7'] });
  await ctx.addInitScript(() => {
    // Archivos que «sobreviven» a recargar la página, como los de Documentos en el móvil.
    const load = () => JSON.parse(sessionStorage.getItem('fs') || '{}'), store = (f) => sessionStorage.setItem('fs', JSON.stringify(f));
    window.__perm = 'granted';
    window.Capacitor = { isNativePlatform: () => true, Plugins: {
      Filesystem: {
        checkPermissions: async () => ({ publicStorage: window.__perm }),
        requestPermissions: async () => ({ publicStorage: window.__perm }),
        writeFile: async (o) => {
          const f = load(), key = o.directory + '/' + o.path;
          if (f[key] && f[key].foreign) throw new Error('EACCES: archivo de otra instalación');
          f[key] = { data: o.data, enc: o.encoding }; store(f); return { uri: 'file:///' + key };
        },
        readdir: async (o) => { const pre = o.directory + '/' + o.path + '/'; return { files: Object.keys(load()).filter((k) => k.startsWith(pre)).map((k) => ({ name: k.slice(pre.length) })) }; },
        deleteFile: async (o) => { const f = load(); delete f[o.directory + '/' + o.path]; store(f); },
      },
      Share: { share: async () => ({}) } } };
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const files = () => p.evaluate(() => Object.keys(JSON.parse(sessionStorage.getItem('fs') || '{}')).sort());
  await p.goto('http://localhost:8123/');
  assert(await p.evaluate(() => autoBackup({ force: true })) === null && (await files()).length === 0, 'sin sesiones no guarda nada');
  await p.evaluate(() => {
    const sq = db.exercises.find((e) => e.name === 'Sentadilla trasera').id;
    for (let k = 0; k < 3; k++) db.sessions.push({ id: 's' + k, createdAt: '2026-11-1' + k + 'T10', date: '2026-11-1' + k, startedAt: 1, endedAt: 2, title: 'Pierna', factors: [], exercises: [{ id: 'e' + k, exerciseId: sq, equipment: [], notes: '', sets: [{ type: 'E', w: 100, reps: 5, rir: 2, done: true }] }] });
    save(true);
  });
  const n1 = await p.evaluate(() => autoBackup());
  let f = await files();
  assert(n1 === 'DiarioEntreno/diario-entreno-auto-2026-11-22.json' && f.join() === 'DOCUMENTS/DiarioEntreno/diario-entreno-auto-2026-11-22.json', 'escribe Documentos/DiarioEntreno/diario-entreno-auto-2026-11-22.json');
  const saved = await p.evaluate(() => JSON.parse(JSON.parse(sessionStorage.getItem('fs'))['DOCUMENTS/DiarioEntreno/diario-entreno-auto-2026-11-22.json'].data));
  assert(saved.type === 'diario-entreno-todos' && Object.values(saved.data)[0].sessions.length === 3, 'es una copia completa, importable con «Importar JSON»');
  // Sin cambios no repite; con cambios, sí (pasados 5 minutos)
  assert(await p.evaluate(() => { localBk.autoLast -= 6 * 60e3; return autoBackup(); }) === null, 'sin cambios no vuelve a escribir');
  assert(await p.evaluate(() => { localBk.autoLast = Date.now(); db.sessions[0].title = 'Pierna A'; save(true); return autoBackup(); }) === null, 'con cambios pero hace menos de 5 minutos: espera');
  assert(await p.evaluate(() => { localBk.autoLast -= 6 * 60e3; return autoBackup(); }) !== null, 'con cambios y pasados 5 minutos: sobrescribe la de hoy');
  // Se conservan los últimos 10 días
  await p.evaluate(() => { const fs = JSON.parse(sessionStorage.getItem('fs')); for (let d = 1; d <= 12; d++) fs[`DOCUMENTS/DiarioEntreno/diario-entreno-auto-2026-10-${String(d).padStart(2, '0')}.json`] = { data: '{}' }; fs['DOCUMENTS/DiarioEntreno/otra-cosa.json'] = { data: '{}' }; sessionStorage.setItem('fs', JSON.stringify(fs)); });
  await p.evaluate(() => autoBackup({ force: true }));
  f = await files();
  const autos = f.filter((x) => x.includes('/diario-entreno-auto-'));
  assert(autos.length === 10 && autos[0].endsWith('2026-10-04.json') && autos[9].endsWith('2026-11-22.json') && f.includes('DOCUMENTS/DiarioEntreno/otra-cosa.json'), 'deja los últimos 10 días y no toca otros archivos: ' + autos[0]);
  // Archivo de hoy creado por una instalación anterior: usa otro nombre
  await p.evaluate(() => { const fs = JSON.parse(sessionStorage.getItem('fs')); fs['DOCUMENTS/DiarioEntreno/diario-entreno-auto-2026-11-22.json'].foreign = true; sessionStorage.setItem('fs', JSON.stringify(fs)); });
  const n2 = await p.evaluate(() => autoBackup({ force: true }));
  assert(/diario-entreno-auto-2026-11-22-\d{4}\.json$/.test(n2), 'si no puede sobrescribir, guarda con la hora en el nombre: ' + n2);
  // Ajustes: estado, botón y cuenta como copia fuera de la app (sin aviso de copia en el calendario)
  await p.goto('http://localhost:8123/#/settings'); await p.waitForSelector('#auto-bk-chk');
  const txt = await p.textContent('.auto-bk');
  assert(await p.isChecked('#auto-bk-chk') && txt.includes('Documentos/DiarioEntreno') && txt.includes('Última: hoy'), 'Ajustes: activada por defecto, carpeta y última copia');
  assert((await p.textContent('.card:has(#auto-bk-chk)')).includes('Última copia guardada fuera de la app: hoy'), 'la copia automática cuenta como copia fuera de la app');
  await (await p.$('.card:has(#auto-bk-chk)')).screenshot({ path: out + '/35ajustes.png' });
  await p.goto('http://localhost:8123/'); await p.waitForSelector('.cal');
  assert(!(await p.$('[data-action=notices]')), 'sin aviso de «guarda una copia» en el calendario');
  // Desactivar
  await p.goto('http://localhost:8123/#/settings'); await p.waitForSelector('#auto-bk-chk');
  await p.click('#auto-bk-chk');
  assert(await p.evaluate(() => localBk.autoOff === true && autoEnabled() === false) && !(await p.isVisible('[data-action=auto-now]')), 'se puede desactivar');
  assert(await p.evaluate(() => { db.sessions[1].title = 'x'; save(true); localBk.autoLast -= 6 * 60e3; return autoBackup(); }) === null, 'desactivada no escribe');
  await p.click('#auto-bk-chk');
  // Al pasar a segundo plano
  await p.evaluate(() => { db.sessions[2].title = 'y'; save(true); localBk.autoLast -= 6 * 60e3; localBk.autoHash = null; });
  const before = await p.evaluate(() => localBk.autoLast);
  await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await p.waitForFunction((t) => localBk.autoLast > t, before);
  assert(true, 'al pasar la app a segundo plano guarda la copia');
  // Sin permiso (Android 10 o anterior y el usuario lo deniega): se avisa en Ajustes
  await p.evaluate(() => { window.__perm = 'denied'; });
  assert(await p.evaluate(() => autoBackup({ force: true })) === null, 'sin permiso no guarda');
  await p.evaluate(() => rerender()); await p.waitForSelector('.auto-bk');
  assert((await p.textContent('.auto-bk')).includes('No se pudo guardar'), 'y lo indica en Ajustes');
  // En el navegador no aparece
  const web = await (await b.newContext({ ...devices['Pixel 7'] })).newPage();
  await web.goto('http://localhost:8123/#/settings'); await web.waitForSelector('[data-action=export-all]');
  assert(!(await web.$('.auto-bk')) && await web.evaluate(() => autoBackup({ force: true })) === null, 'en el navegador no existe (solo en la app Android)');
  assert(!errs.length, 'sin errores: ' + errs.join(' | '));
  await b.close();
})();
