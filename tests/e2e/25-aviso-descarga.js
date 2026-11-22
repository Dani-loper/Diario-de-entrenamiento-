const { chromium, devices } = require('playwright');
const out = process.argv[2] || 'shots';
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const errs = [];
  // gen(semanas, fn(k) → peso): una sesión cada 2 días de sentadilla, 4 series de 5 @ RIR 2
  const scenario = async (weeksBack, wFn, extra) => {
    const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://localhost:8123/');
    await p.evaluate(({ weeksBack, wSrc, extra }) => {
      const wFn = eval(wSrc), sq = db.exercises.find((e) => e.name === 'Sentadilla trasera').id;
      for (let d = weeksBack * 7; d >= 1; d -= 2) {
        const date = addDays(todayISO(), -Math.round(d)), k = Math.round(d);
        const sets = [1, 2, 3, 4].map((n) => wFn(k, n)).filter(Boolean).map((x) => typeof x === 'number' ? { type: 'E', w: x, reps: 5, rir: 2, done: true } : { type: 'E', reps: 5, done: true, ...x });
        db.sessions.push({ id: 's' + k, createdAt: date + 'T10', date, startedAt: 1, endedAt: 2, title: 'x', factors: [], exercises: [{ id: 'e' + k, exerciseId: sq, equipment: [], notes: '', sets }] });
      }
      if (extra) eval(extra);
      save(true);
    }, { weeksBack, wSrc: wFn.toString(), extra });
    await p.goto('http://localhost:8123/#/exercises'); await p.waitForSelector('.mbars');
    return p;
  };
  // A) Progresa y cada 5 semanas hace una semana suave → sin aviso
  // Semana suave cada 5 semanas (días 28-34 y 63-69 atrás): 2 series a RIR 5 con menos peso.
  let p = await scenario(10, (k, n) => (k % 35 >= 28 ? (n <= 2 ? { w: 90, rir: 5 } : null) : 120 - k * 0.3));
  let g = await p.evaluate(() => deloadSignal());
  assert(!g.level && !(await p.isVisible('.deload')), 'progresando y con semanas suaves: sin aviso (' + JSON.stringify({ perf: g.perfMean && +g.perfMean.toFixed(1), racha: g.streak }) + ')');
  // B) Rendimiento cae: 6 semanas a 100-110 kg y los últimos 14 días a 95
  p = await scenario(7, (k) => (k <= 13 ? 95 : 110 - k * 0.2));
  g = await p.evaluate(() => deloadSignal());
  assert(g.level === 'strong' && g.perfMean <= -3, 'rendimiento −' + Math.abs(g.perfMean).toFixed(1) + ' % frente a la mejor marca del mes anterior → aviso fuerte');
  assert((await p.textContent('.deload')).includes('valora una semana de descarga'), 'tarjeta en Progreso');
  await (await p.$('.deload')).screenshot({ path: out + '/25deload.png' });
  await p.goto('http://localhost:8123/#/'); await p.waitForSelector('.cal');
  assert(await p.isVisible('.deload-mini'), 'aviso compacto en el calendario, que lleva a Progreso');
  await p.goto('http://localhost:8123/#/exercises'); await p.waitForSelector('.deload');
  await p.click('[data-action=deload-snooze]');
  assert(!(await p.isVisible('.deload')), '«Ocultar durante 7 días»');
  // C) 9 semanas seguidas de carga normal, rendimiento estable → aviso suave
  p = await scenario(9, () => 100);
  g = await p.evaluate(() => deloadSignal());
  assert(g.level === 'soft' && g.streak >= 8, 'muchas semanas sin descarga (' + g.streak + ') → aviso suave');
  assert((await p.textContent('.deload')).includes('Llevas muchas semanas sin descargar'), 'texto del aviso suave');
  console.log('errors', errs); await b.close();
})();
