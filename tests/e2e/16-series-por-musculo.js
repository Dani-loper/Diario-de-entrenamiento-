const { chromium, devices } = require('playwright');
const out = process.argv[2] || 'shots';
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8123/');
  const ids = await p.evaluate(() => {
    db.settings.level = 'simple';
    const sq = db.exercises.find((e) => e.name === 'Sentadilla trasera').id;   // cuád 1, glúteo .5, espalda .5
    const bp = db.exercises.find((e) => e.name === 'Press banca').id;          // pecho 1, tríceps .5, hombro .5
    const today = todayISO(), d = (n) => addDays(today, -n);
    const S = (id, date, sets, bw) => db.sessions.push({ id, createdAt: date + 'T10', date, startedAt: 1, endedAt: 2, title: 'x', factors: [], bodyweight: bw, exercises: sets });
    // Últimos 7 días: sentadilla 4 series RIR2 + 1 RIR6 (no efectiva) + calentamiento; press banca 3 series sin RIR + 2 RIR 1
    S('a', d(1), [{ id: 'e1', exerciseId: sq, equipment: [], notes: '', sets: [{ type: 'C', w: 60, reps: 8, done: true }, ...[1, 2, 3, 4].map(() => ({ type: 'E', w: 100, reps: 5, rir: 2, done: true })), { type: 'E', w: 60, reps: 5, rir: 6, done: true }] }], 80);
    S('b', d(3), [{ id: 'e2', exerciseId: bp, equipment: [], notes: '', sets: [...[1, 2, 3].map(() => ({ type: 'E', w: 70, reps: 8, done: true })), ...[1, 2].map(() => ({ type: 'E', w: 75, reps: 6, rir: 1, done: true }))] }]);
    // Hace 8 días (fuera de la ventana)
    S('c', d(8), [{ id: 'e3', exerciseId: sq, equipment: [], notes: '', sets: [{ type: 'E', w: 95, reps: 5, rir: 2, done: true }] }], 82);
    // Historial para tendencia y fuerza relativa: 8 sesiones en 10 semanas
    for (let k = 0; k < 8; k++) S('h' + k, d(70 - k * 8), [{ id: 'x' + k, exerciseId: sq, equipment: [], notes: '', sets: [{ type: 'E', w: 85 + k * 2.5, reps: 5, rir: 2, done: true }] }], 84 - k * 0.4);
    save(true); return { sq, bp };
  });
  await p.goto('http://localhost:8123/#/exercises');
  await p.waitForSelector('.mbars');
  const bars = await p.$$eval('.mbar', (x) => Object.fromEntries(x.map((e) => [e.dataset.m, e.querySelector('.mb-v').textContent.trim()])));
  assert(bars.cuadriceps === '4', 'cuádriceps: 4 efectivas (sin calentamiento, sin la de RIR 6, sin la de hace 8 días): ' + bars.cuadriceps);
  assert(bars.gluteos === '3', 'glúteos: 4 series de sentadilla × ¾ = 3');
  assert(bars.pectoral === '2+3', 'pectoral: 2 efectivas + 3 sin RIR aparte: ' + bars.pectoral);
  assert(bars.triceps === '1+1,5', 'tríceps: 2 × 0,5 + 3 × 0,5 sin RIR: ' + bars.triceps);
  assert(bars.femoral === '0', 'femoral: 0');
  // umbral RIR ≤ 3: RIR 2 sigue contando
  await p.evaluate(() => { db.settings.hardRir = 3; db.sessions.find((s) => s.id === 'a').exercises[0].sets[1].rir = 4; save(); rerender(); });
  assert((await p.textContent('.mbar[data-m=cuadriceps] .mb-v')).trim() === '3', 'con RIR ≤ 3, la serie a RIR 4 deja de contar');
  await p.evaluate(() => { db.settings.hardRir = 4; save(); rerender(); });
  // Tendencia del músculo
  await p.click('.mbar[data-m=cuadriceps]');
  await p.waitForSelector('.wchart');
  assert(await p.$$eval('.wchart .col', (x) => x.length) === 12, 'evolución semanal: 12 columnas');
  // Constancia
  assert(await p.$$eval('.heat rect.on', (x) => x.length) === 11, 'mapa de constancia: 11 días con sesión');
  // Peso corporal
  assert((await p.textContent('.card:has(h3:has-text("Peso corporal"))')).includes('80 kg'), 'peso corporal: último 80 kg');
  // Resumen de ejercicios
  const row = await p.textContent(`a[href="#/exercise/${ids.sq}"]`);
  assert(/\+\d/.test(row) && await p.isVisible(`a[href="#/exercise/${ids.sq}"] .spark`), 'sentadilla: minigráfica y cambio positivo: ' + row.replace(/\s+/g, ' ').trim());
  for (const [k, sel] of [['a', '.card:has(.mbars)'], ['b', '.card:has(.heat)'], ['c', '.card:has(h3:has-text("Peso corporal"))']]) await (await p.$(sel)).screenshot({ path: out + '/16' + k + '.png' });
  // Anotar peso
  p.once('dialog', (d) => d.accept('79,6'));
  await p.click('[data-action=bw-add]');
  assert(await p.evaluate(() => db.bodyweights.at(-1).v) === 79.6, 'anotar peso con coma: 79,6');
  // Fuerza relativa en el ejercicio
  await p.goto(`http://localhost:8123/#/exercise/${ids.sq}`);
  await p.waitForSelector('.pchart');
  await p.click('[data-action=chart-rel]');
  const det = await p.textContent('#chart-detail');
  assert(det.includes('× PC') && det.includes('÷'), 'fuerza relativa: ' + det.replace(/\s+/g, ' ').trim());
  await (await p.$('.card:has(.pchart)')).screenshot({ path: out + '/16rel.png' });
  console.log('errors', errs); await b.close();
})();
