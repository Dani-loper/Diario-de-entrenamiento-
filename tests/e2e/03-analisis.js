const { chromium, devices } = require('playwright');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ ...devices['Pixel 7'] });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', (d) => d.accept());
  await p.goto('http://localhost:8123/');
  await p.evaluate(() => { db.settings.level = 'advanced'; save(true); rerender(); });
  // Datos sintéticos: progresión lineal + ruido; "Dormí mal" = -6% de rendimiento; "Cafeína" sin efecto real.
  await p.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('diario-entreno.v1')) || null;
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const d = db || {};
    return d;
  });
  await p.reload();
  await p.evaluate(() => {
    const KEY = 'diario-entreno.v1';
    const db = JSON.parse(JSON.stringify((0, eval)('db')));
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const ex = (n) => db.exercises.find((e) => e.name === n).id;
    const lifts = [['Sentadilla trasera', 120], ['Peso muerto', 150], ['Press banca', 85]];
    for (let k = 0; k < 30; k++) {
      const date = new Date(2026, 7, 25 + k * 3); // desde finales de agosto, cada 3 días
      const iso = date.toISOString().slice(0, 10);
      const bad = rnd() < 0.3, caf = rnd() < 0.4;
      const sleep = bad ? 5 + rnd() : 7 + rnd() * 1.5;
      const factor = (1 + k * 0.004) * (bad ? 0.94 : 1) * (1 + (rnd() - 0.5) * 0.04);
      db.sessions.push({
        id: 'syn' + k, createdAt: iso + 'T10:00', date: iso, startedAt: date.getTime(), endedAt: date.getTime() + 3600e3,
        title: 'Fuerza', notes: '', bodyweight: 80 + rnd(), readiness: bad ? 2 : 4, sleep, stress: 1 + Math.floor(rnd() * 5), srpe: 7,
        factors: [...(bad ? ['Dormí mal'] : []), ...(caf ? ['Cafeína / pre-entreno'] : [])], preNotes: '', preObs: '',
        exercises: lifts.map(([n, base]) => ({
          id: 'e' + k + n, exerciseId: ex(n), notes: '', equipment: [], vbt: true,
          sets: [0, 1, 2].map((j) => ({ type: 'E', w: Math.round(base * factor / 2.5) * 2.5, reps: 5, rpe: 8, done: true, vBest: 0.6, vLast: 0.6 * (1 - (0.15 + j * 0.12)) })),
        })),
      });
    }
    window.__db = db;
  });
  await p.evaluate(() => { db = window.__db; save(true); });
  await p.goto('http://localhost:8123/#/analysis');
  await p.reload();
  await p.screenshot({ path: out + '/3analysis.png', fullPage: true });
  const keys = await p.evaluate(() => Object.keys(GLOSSARY)); const used = await p.$$eval('button.info', (bs) => bs.map((x) => x.dataset.k)); console.log('info icons', used.length, 'missing', used.filter((k) => !keys.includes(k)));
  console.log('errors', errs);
  await b.close();
})();
