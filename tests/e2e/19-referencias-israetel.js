const { chromium, devices } = require('playwright');
const out = process.argv[2] || 'shots';
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8123/');
  // Tarjeta del día: justo debajo de la fecha, antes de «Nueva sesión»
  const order = await p.evaluate(() => { const d = document.querySelector('.daily'), n = document.querySelector('[data-action=new-session]'); return !!d && !!(d.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING); });
  assert(order, 'calendario: «Datos del día» aparece antes de «Nueva sesión»');
  const ids = await p.evaluate(() => {
    db.settings.level = 'advanced'; // las cinco zonas de Israetel se ven en modo avanzado
    const ex = (n) => db.exercises.find((e) => e.name === n).id;
    const S = (id, date, list) => db.sessions.push({ id, createdAt: date + 'T10', date, startedAt: 1, title: 'x', factors: [], exercises: list.map(([n, k], i) => ({ id: id + i, exerciseId: ex(n), equipment: [], notes: '', sets: Array.from({ length: k }, () => ({ type: 'E', w: 50, reps: 10, rir: 2, done: true })) })) });
    // Últimos 7 días: pectoral 14 (opt 12-20) · bíceps 5 (maint 4-8) · cuádriceps 19 (alto 18-20) · tríceps 22 (por encima de MRV 18)
    S('a', addDays(todayISO(), -1), [['Press banca', 14], ['Curl de bíceps', 5], ['Extensión de cuádriceps', 19], ['Extensión de tríceps', 15]]);
    save(true); return { s: 'a' };
  });
  await p.goto('http://localhost:8123/#/exercises');
  await p.waitForSelector('.mbars');
  const z = await p.$$eval('.mbar', (x) => Object.fromEntries(x.map((e) => [e.dataset.m, [e.querySelector('.mb-v').textContent.trim(), e.querySelector('.mb-h').className.replace('mb-h ', '')]])));
  assert(z.pectoral[1] === 'z-opt', 'pectoral 14 (+ 0 de secundarios): en el MAV 12-20 → ' + z.pectoral);
  assert(z.biceps[1] === 'z-maint', 'bíceps 5: mantenimiento (MV 4 - MEV 8) → ' + z.biceps);
  assert(z.cuadriceps[1] === 'z-high', 'cuádriceps 19: entre MAV y MRV → ' + z.cuadriceps);
  assert(z.triceps[0] === '22' && z.triceps[1] === 'z-over', 'tríceps 15 + 7 de press banca = 22: por encima del MRV 18 → ' + z.triceps);
  assert(z.femoral[1] === 'z-under' || z.femoral[1] === 'z-maint', 'femoral 0 → ' + z.femoral);
  await (await p.$('.card:has(.mbars)')).screenshot({ path: out + '/19bars.png' });
  await p.click('.mbar[data-m=cuadriceps]');
  await p.waitForSelector('.wchart .lm.mrv', { state: 'attached' });
  assert((await p.textContent('.ptrend')).includes('MEV 8 · MAV 12-18 · MRV 20'), 'detalle con las referencias del músculo');
  await (await p.$('.ptrend')).screenshot({ path: out + '/19trend.png' });
  // Editor en Ajustes: personalizar bíceps MEV 8 → 4 y que bíceps 5 pase a crecimiento mínimo
  await p.goto('http://localhost:8123/#/settings');
  await p.click('.lm-edit summary');
  await p.fill('[data-lm="biceps:1"]', '4'); await p.press('[data-lm="biceps:1"]', 'Tab');
  assert(JSON.stringify(await p.evaluate(() => db.settings.landmarks.biceps)) === '[4,4,14,20,26]', 'bíceps personalizado: MEV 4');
  await p.fill('[data-lm="biceps:2"]', '30'); await p.press('[data-lm="biceps:2"]', 'Tab');
  assert(await p.$eval('[data-lm="biceps:2"]', (e) => e.classList.contains('bad')) && await p.evaluate(() => db.settings.landmarks.biceps[2]) === 14, 'orden incorrecto (MAV mín. > MAV máx.): se marca y no se guarda');
  await p.goto('http://localhost:8123/#/exercises'); await p.waitForSelector('.mbars');
  assert(await p.$eval('.mbar[data-m=biceps] .mb-h', (e) => e.classList.contains('z-low')), 'con MEV 4, bíceps 5 pasa a crecimiento mínimo');
  await p.goto('http://localhost:8123/#/settings');
  p.once('dialog', (d) => d.accept());
  await p.evaluate(() => { document.querySelector('.lm-edit').open = true; });
  await p.click('[data-action=lm-reset]');
  assert(await p.evaluate(() => db.settings.landmarks) === undefined, 'restablecer valores por defecto');
  // Modo sencillo: tres estados (poco, bien, mucho), sin siglas de Israetel
  await p.evaluate(() => { db.settings.level = 'simple'; save(true); });
  await p.goto('http://localhost:8123/#/exercises'); await p.waitForSelector('.mbars.simple');
  const leg = await p.textContent('.vz-legend');
  assert(leg.includes('Poco') && leg.includes('Bien') && leg.includes('Mucho') && !leg.includes('MEV'), 'sencillo: leyenda Poco · Bien · Mucho');
  assert(await p.getAttribute('.mbar[data-m=triceps]', 'aria-label').then((t) => t.endsWith('mucho')) && await p.getAttribute('.mbar[data-m=pectoral]', 'aria-label').then((t) => t.endsWith('bien')), 'sencillo: tríceps «mucho», pectoral «bien»');
  await p.click('.mbar[data-m=pectoral]');
  assert((await p.textContent('.ptrend')).includes('Lo recomendable: entre 12 y 20') && !(await p.$('.wchart .lm.mrv')), 'sencillo: detalle con el rango recomendado, sin MEV/MRV');
  await (await p.$('.card:has(.mbars)')).screenshot({ path: out + '/19simple.png' });
  // «Datos del día» solo en el calendario, no dentro de la sesión
  await p.goto('http://localhost:8123/#/session/a'); await p.waitForSelector('#vol');
  assert(!(await p.$('.daily')), 'la sesión ya no repite «Datos del día»');
  console.log('errors', errs); await b.close();
})();
