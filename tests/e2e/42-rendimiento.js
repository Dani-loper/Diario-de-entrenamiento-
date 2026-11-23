// Rendimiento con 3 años de datos (≈ 625 sesiones, 15 000 series): las pantallas se pintan rápido y las optimizaciones
// dan los mismos resultados que el cálculo directo. Los límites son holgados: detectan cálculos que crecen al cuadrado,
// no milisegundos (la medición real, con la CPU de un móvil medio, está en el informe del PR).
const { chromium, devices } = require('playwright');
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ ...devices['Pixel 7'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8123/');
  const n = await p.evaluate(() => {
    const names = ['Sentadilla trasera', 'Press banca', 'Peso muerto', 'Press militar', 'Remo con barra', 'Dominadas', 'Peso muerto rumano', 'Prensa', 'Curl con mancuernas', 'Elevaciones laterales', 'Hip thrust', 'Jalón al pecho'];
    const ids = names.map((x) => db.exercises.find((e) => e.name === x).id);
    let k = 0, seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const start = Date.parse('2023-11-27T12:00');
    for (let d = 0; d < 1092; d++) {
      const date = new Date(start + d * 864e5); if (![1, 2, 4, 5].includes(date.getDay())) continue;
      const iso = isoOf(date); k++;
      db.sessions.push({ id: 'p' + k, createdAt: iso + 'T18:00', date: iso, startedAt: 1, endedAt: 4200e3, title: 'S' + (k % 4), factors: [],
        exercises: [0, 1, 2, 3, 4, 5].map((i) => { const x = (k * 3 + i) % ids.length; return { id: 'e' + k + '_' + i, exerciseId: ids[x], equipment: [], notes: '',
          sets: [0, 1, 2, 3].map((j) => ({ type: j ? 'E' : 'C', w: Math.round((50 + x * 4 + d / 30 + (rnd() - 0.5) * 10) / 2.5) * 2.5, reps: j ? 6 + (j % 3) : 10, rir: j ? 1 + (j % 3) : null, done: true })) }; }) });
    }
    save(true); return db.sessions.length;
  });
  assert(n > 600, `${n} sesiones de prueba`);
  // Récords del informe: la pasada cronológica da lo mismo que comparar con todo el historial anterior
  const prs = await p.evaluate(() => {
    const slow = (a, b2) => { let c = 0; for (const s of db.sessions.filter((x) => inRange(x, a, b2))) for (const e of s.exercises) { const best = entryStats(e).best, prev = maxOf(historyBefore(e.exerciseId, s).map((h) => entryStats(h.entry).best)); if (best && prev && best > prev) c++; } return c; };
    return [[periodStats('2024-01-01', '2024-12-31').prs, slow('2024-01-01', '2024-12-31')], [periodStats('2026-08-01', '2026-11-22').prs, slow('2026-08-01', '2026-11-22')]];
  });
  assert(prs.every(([a, c]) => a === c && a > 0), 'récords del informe iguales al cálculo directo: ' + JSON.stringify(prs));
  // Historial memorizado durante el pintado = historial calculado al momento
  assert(await p.evaluate(() => { const id = db.exercises.find((e) => e.name === 'Press banca').id; const a = historyFor(id).map((h) => h.entry.id).join(); renderMemo = {}; const c = historyFor(id).map((h) => h.entry.id).join(); historyFor(id).reverse(); const d = historyFor(id).map((h) => h.entry.id).join(); renderMemo = null; return a === c && c === d; }), 'historial con memoria igual al directo (y a salvo de .reverse())');
  // Tiempos de pintado (sin ralentizar la CPU)
  const exId = await p.evaluate(() => db.exercises.find((e) => e.name === 'Sentadilla trasera').id);
  const times = {};
  for (const [name, hash, max] of [['calendario', '#/', 150], ['progreso', '#/exercises', 500], ['ficha', '#/exercise/' + exId, 200], ['récords', '#/records', 300], ['informe', '#/report', 800]]) {
    await p.goto('http://localhost:8123/' + hash); await p.waitForTimeout(100);
    times[name] = await p.evaluate(() => { const t = []; for (let i = 0; i < 3; i++) { const a = performance.now(); render(); t.push(performance.now() - a); } return Math.round(t.sort((x, y) => x - y)[1]); });
    assert(times[name] < max, `${name}: ${times[name]} ms (límite ${max})`);
  }
  assert(!errs.length, 'sin errores: ' + errs.join(' | '));
  await b.close();
})();
