// Comprueba las cifras del ejemplo de docs/como-se-calcula.md: si un cálculo cambia, esta prueba falla
// y el documento hay que actualizarlo. Reloj fijo: domingo 22 nov 2026 (semana del lunes 16 al domingo 22).
const { chromium, devices } = require('playwright');
const out = process.argv[2] || 'shots';
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8123/');
  const r = await p.evaluate(() => {
    const ex = (n) => db.exercises.find((e) => e.name === n).id;
    const pb = ex('Press banca'), rm = ex('Remo con barra'), sq = ex('Sentadilla trasera');
    const S = (id, date, title, list) => db.sessions.push({ id, createdAt: date + 'T18', date, startedAt: 1, endedAt: 2, title, factors: [],
      exercises: list.map(([exerciseId, sets], i) => ({ id: id + i, exerciseId, equipment: [], notes: '', sets: sets.map(([w, reps, rir, type = 'E']) => ({ type, w, reps, rir, done: true })) })) });
    S('t9', '2026-11-09', 'Torso', [[pb, [[77.5, 8, 2], [77.5, 8, 2], [77.5, 8, 2]]]]);
    S('t16', '2026-11-16', 'Torso', [[pb, [[40, 10, null, 'C'], [80, 8, 2], [80, 8, 2], [80, 7, 1]]], [rm, [[70, 10, 3], [70, 10, 3], [70, 10, 3], [70, 10, 5]]]]);
    S('p19', '2026-11-19', 'Pierna', [[sq, [[100, 5, 2], [100, 5, 2], [100, 5, 2], [100, 5, null]]]]);
    db.bodyweights = [{ d: '2026-11-16', v: 80 }];
    save(true);
    const t16 = sessionById('t16'), e1 = (w, reps, rir) => e1rm({ w, reps, rir });
    const best = entryStats(t16.exercises[0]).best;
    const v = muscleSetsBetween('2026-11-16', '2026-11-22');
    const sum = (o) => Object.values(o).reduce((a, x) => a + x, 0);
    // Peso sugerido: sesión nueva de hoy con press banca y 3 series vacías
    const s = { id: 'nueva', date: '2026-11-22', createdAt: '2026-11-22T19', startedAt: 1, title: 'Torso', factors: [], exercises: [{ id: 'n0', exerciseId: pb, equipment: [], notes: '', sets: [0, 1, 2].map(() => ({ type: 'E', w: null, reps: null, rir: null, done: false })) }] };
    db.sessions.push(s);
    const sug = suggestFor(s, 0, 0);
    s.exercises[0].sets[0] = { type: 'E', w: 82.5, reps: 8, rir: 1, done: true };
    const sug2 = suggestFor(s, 0, 1);
    db.sessions = db.sessions.filter((x) => x.id !== 'nueva');
    return {
      e1_80x8r2: e1(80, 8, 2), pct_8r2: pct1rm({ reps: 8, rir: 2 }), e1_80x7r1: e1(80, 7, 1), e1_775: e1(77.5, 8, 2), best,
      noRir: e1(100, 5, null), rir4: e1(100, 5, 4),
      volPress: entryStats(t16.exercises[0]).vol, volSes: sessionVolume(t16),
      hard: v.hard, unknown: v.unknown, easy: sum(v.easy), zonePec: volZone(v.hard.pectoral, landmarksOf('pectoral')), zoneEsp: volZone(v.hard.espalda, landmarksOf('espalda')),
      table: [1, 5, 8].map((n) => Math.round(best * RTS[(n - 1) * 2] / 100 / 2.5) * 2.5),
      sug, sug2, warm: warmupRamp(80, 8, true).map((x) => `${x.w}x${x.reps}`).join(' '),
      warmHeavy: warmupRamp(140, 3, true).map((x) => `${x.w}x${x.reps}`).join(' '),
      trend: exerciseTrend(exById(pb), 'all').change, rel: best / bodyweightAt('2026-11-16'),
      si: [stressIndex({ type: 'E', w: 80, reps: 8, rir: 2 }, exById(pb)), stressIndex({ type: 'E', w: 20, reps: 12, rir: 1 }, exById(ex('Curl de bíceps')))],
    };
  });
  const near = (a, b, d = 0.05) => Math.abs(a - b) <= d;
  assert(r.pct_8r2 === 73.9 && near(r.e1_80x8r2, 108.25), '80 × 8 @ RIR 2: 73,9 % → 1RM est. 108,3 kg (' + r.e1_80x8r2 + ')');
  assert(near(r.e1_80x7r1, 101.78) && near(r.best, 108.25), '80 × 7 @ RIR 1: 101,8 kg; mejor de la sesión 108,3');
  assert(near(r.e1_775, 104.87), 'semana anterior 77,5 × 8 @ RIR 2: 104,9 kg → el 16 nov es récord');
  assert(near(r.noRir, 100 / 0.863) && r.rir4 === null, 'sin RIR se asume al fallo (100 × 5 → 115,9); con RIR 4 no se estima');
  assert(r.volPress === 1840 && r.volSes === 4640, 'volumen: press 1840 kg (sin calentamiento) · sesión 4640 kg');
  assert(r.hard.pectoral === 3 && r.hard.triceps === 1.5 && r.hard.delt_ant === 1.5, 'press banca 3 series: pectoral 3, tríceps 1,5, deltoides anterior 1,5');
  assert(r.hard.espalda === 3.75 && r.hard.biceps === 1.5 && r.hard.trapecio === 0.75, 'espalda 3 (remo) + 0,75 (sentadilla ¼ × 3) = 3,75; bíceps 1,5; trapecio 0,75');
  assert(r.hard.cuadriceps === 3 && r.hard.gluteos === 2.25 && r.unknown.cuadriceps === 1, 'sentadilla: cuádriceps 3 (+1 sin RIR aparte), glúteos 2,25');
  assert(r.easy === 2.25, 'la serie de remo a RIR 5 suma 2,25 «no efectivas» (1 + ½ + ½ + ¼)');
  assert(r.zonePec === 'under' && r.zoneEsp === 'under', 'pectoral 3 y espalda 3,75: por debajo del mantenimiento');
  assert(r.table.join() === '107.5,92.5,85', 'tabla de cargas: 1 rep 107,5 · 5 reps 92,5 · 8 reps 85');
  assert(r.sug && r.sug.w === 80 && r.sug.reps === 8 && r.sug.rir === 2, 'peso sugerido serie 1: 80 kg × 8 @ RIR 2 (de la sesión anterior)');
  assert(r.sug2 && r.sug2.w === 80 && near(r.sug2.e1, 82.5 / 0.762), 'tras 82,5 × 8 @ RIR 1 hoy (1RM 108,3): serie 2 → 80 kg');
  assert(r.warm === '20x10 40x5 55x3', 'calentamiento para 80 × 8: barra, 40 × 5, 55 × 3: ' + r.warm);
  assert(r.warmHeavy === '20x10 55x5 85x3 105x2 120x1', 'calentamiento para 140 × 3: ' + r.warmHeavy);
  assert(near(r.trend, 3.22, 0.01), 'cambio en el periodo: 104,9 → 108,3 = +3,2 %');
  assert(near(r.rel, 1.353, 0.001), 'fuerza relativa: 108,3 / 80 = 1,35');
  assert(near(r.si[0], 1.0) && near(r.si[1], 1.1), 'índice de estrés: multiarticular RIR 2 = 1,0 · monoarticular RIR 1 = 1,1');
  assert(!errs.length, 'sin errores: ' + errs.join(' | '));
  await b.close();
})();
