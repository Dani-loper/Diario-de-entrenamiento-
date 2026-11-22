const { chromium, devices } = require('playwright');
const out = process.argv[2] || 'shots';
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8123/');
  // ---- Entrada en el calendario ----
  await p.click('.daily summary');
  await p.fill('[data-daily$=":steps"]', '8.500'); await p.press('[data-daily$=":steps"]', 'Tab');
  await p.fill('[data-daily$=":kcal"]', '2400'); await p.press('[data-daily$=":kcal"]', 'Tab');
  await p.fill('[data-daily$=":bw"]', '78,5'); await p.press('[data-daily$=":bw"]', 'Tab');
  const d = await p.evaluate(() => ({ x: db.daily[todayISO()], bw: db.bodyweights.find((r) => r.d === todayISO())?.v }));
  assert(d.x.steps === 8500 && d.x.kcal === 2400 && d.bw === 78.5, 'pasos «8.500» = 8500, 2400 kcal, peso 78,5: ' + JSON.stringify(d));
  assert((await p.textContent('.daily summary')).includes('8500 pasos · 2400 kcal · 78,5 kg'), 'resumen en la cabecera de la tarjeta');
  await p.fill('[data-daily$=":kcal"]', '50'); await p.press('[data-daily$=":kcal"]', 'Tab');
  assert(await p.$eval('[data-daily$=":kcal"]', (e) => e.classList.contains('bad')) && await p.evaluate(() => db.daily[todayISO()].kcal) === 2400, 'valor fuera de rango: se marca y no se guarda');
  await p.fill('[data-daily$=":kcal"]', ''); await p.press('[data-daily$=":kcal"]', 'Tab');
  assert(await p.evaluate(() => db.daily[todayISO()].kcal) === undefined, 'vaciar el campo borra el dato');
  await p.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
  await (await p.$('.daily')).screenshot({ path: out + '/18cal.png' });
  // ---- Datos de 28 días: 2400 kcal y peso bajando 0,25 kg/semana → mantenimiento ≈ 2675 ----
  await p.evaluate(() => {
    for (let i = 0; i < 28; i++) { const iso = addDays(todayISO(), -i); db.daily[iso] = { steps: 6000 + (i % 7) * 1000, kcal: 2400 }; }
    db.bodyweights = [0, 7, 14, 21, 27].map((i) => ({ d: addDays(todayISO(), -i), v: 80 - (27 - i) * 0.25 / 7 }));
    save(true);
  });
  const t = await p.evaluate(() => tdeeEstimate());
  assert(t.ok && Math.abs(t.tdee - 2675) < 5, 'mantenimiento: 2400 + 0,25 kg/sem × 7700/7 ≈ 2675: ' + Math.round(t.tdee));
  await p.goto('http://localhost:8123/#/exercises');
  await p.waitForSelector('.tdee');
  assert((await p.textContent('.tdee')).match(/≈ 2.?6[78]0 kcal\/día/), 'Progreso muestra el mantenimiento redondeado: ' + (await p.textContent('.tdee-v')));
  assert(await p.$$eval('.card:has(.tdee) .wchart', (x) => x.length) === 2, 'dos gráficas semanales (pasos y calorías)');
  await (await p.$('.card:has(.tdee)')).screenshot({ path: out + '/18act.png' });
  // ---- Factores: pasos del día anterior ----
  await p.evaluate(() => {
    db.settings.level = 'advanced';
    const sq = db.exercises.find((e) => e.name === 'Sentadilla trasera').id;
    for (let k = 0; k < 10; k++) { const iso = addDays(todayISO(), -2 - k * 2);
      db.sessions.push({ id: 'f' + k, createdAt: iso + 'T10', date: iso, startedAt: 1, endedAt: 2, title: 'x', factors: [], exercises: [{ id: 'e' + k, exerciseId: sq, equipment: [], notes: '', sets: [{ type: 'E', w: 100 + (k % 3) * 2.5, reps: 5, rir: 2, done: true }] }] }); }
    save(true);
  });
  await p.goto('http://localhost:8123/#/analysis');
  await p.waitForSelector('h2');
  assert((await p.textContent('#app')).includes('Pasos del día anterior'), 'análisis de factores incluye los pasos del día anterior');
  // ---- Informe ----
  await p.goto('http://localhost:8123/#/report');
  await p.waitForTimeout(400);
  const rep = await p.textContent('#app');
  assert(rep.includes('Pasos al día') && rep.includes('Calorías al día'), 'el informe incluye pasos y calorías medios');
  assert(await p.evaluate(() => reportDataFor(1).wb.some(([l]) => l === 'Pasos al día')), 'el PDF recibe pasos y calorías');
  console.log('errors', errs); await b.close();
})();
