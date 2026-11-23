const { chromium, devices } = require('playwright');
const out = process.argv[2];
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ ...devices['Pixel 7'] });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', (d) => d.accept());
  await p.goto('http://localhost:8123/');
  await p.evaluate(() => { db.settings.level = 'advanced'; save(true); rerender(); });

  // Celdas RTS contrastadas con fuentes
  const cells = await p.evaluate(() => [
    pct1rm({ reps: 1, rir: 0 }), pct1rm({ reps: 1, rpe: 9.5 }), pct1rm({ reps: 1, rpe: 9 }), pct1rm({ reps: 2, rir: 0 }),
    pct1rm({ reps: 3, rir: 0 }), pct1rm({ reps: 5, rir: 0 }), pct1rm({ reps: 5, rpe: 8 }), pct1rm({ reps: 12, rir: 0 }), pct1rm({ reps: 12, rpe: 6.5 }),
  ]);
  assert(JSON.stringify(cells) === JSON.stringify([100, 97.8, 95.5, 95.5, 92.2, 86.3, 81.1, 68, 58.6]), 'celdas RTS: ' + cells.join(', '));
  const limits = await p.evaluate(() => [pct1rm({ reps: 13, rir: 0 }), pct1rm({ reps: 5, rir: 4 }), pct1rm({ reps: 5, rpe: 6 }), pct1rm({ reps: 0 })]);
  assert(limits.every((x) => x === null), 'fuera de rango (13 reps, RIR 4, RPE 6, 0 reps) no se calcula');
  const e1 = await p.evaluate(() => e1rm({ w: 100, reps: 5, rir: 2 }));
  assert(Math.abs(e1 - 123.3) < 0.1, '1RM est. 100×5 RIR2 = ' + e1.toFixed(1));

  // Índice de estrés
  const si = await p.evaluate(() => {
    const sq = db.exercises.find((e) => e.name === 'Sentadilla trasera'), curl = db.exercises.find((e) => e.name === 'Curl femoral');
    return [stressIndex({ type: 'E', rir: 0 }, sq), stressIndex({ type: 'E', rir: 2 }, sq), stressIndex({ type: 'E', rir: 5 }, sq), stressIndex({ type: 'E', rir: 6 }, sq),
      stressIndex({ type: 'E', rir: 0 }, curl), stressIndex({ type: 'E', rpe: 9 }, curl), stressIndex({ type: 'C', rir: 0 }, sq), stressIndex({ type: 'E' }, sq)].map((x) => x == null ? null : Math.round(x * 10) / 10);
  });
  assert(JSON.stringify(si) === JSON.stringify([1.4, 1, 0.4, 0, 1.3, 1.1, null, null]), 'IE: multi 1,4/1,0/0,4/0 · mono 1,3/1,1 · calentamiento y sin RIR no cuentan: ' + si.join(', '));

  // Sesión en modo índice de estrés
  await p.click('[data-action=new-session]');
  await p.click('[data-action=cycle-system]');
  assert((await p.textContent('[data-action=cycle-system]')).includes('Índice de estrés'), 'sesión cambia a índice de estrés');
  await p.click('[data-action=add-exercise]');
  await p.fill('#picker-q', 'sentadilla trasera');
  await p.click('#picker-list [data-action=pick-exercise] >> nth=0');
  await p.fill('[data-set="0:0:w"]', '100');
  await p.fill('[data-set="0:0:reps"]', '5');
  assert((await p.textContent('#cap-0-0')) === '86%', 'subtítulo %1RM en vivo sin RPE (asume fallo): ' + await p.textContent('#cap-0-0'));
  assert((await p.textContent('#si-0-0')) === 'sin RIR', 'IE avisa sin RIR');
  await p.selectOption('[data-set="0:0:rpe"]', '8');
  assert((await p.textContent('#cap-0-0')) === '81%', '%1RM con RPE 8 = 81%');
  assert((await p.textContent('#si-0-0')) === 'IE 1', 'IE con RPE 8 = 1');
  await p.click('[data-action=add-set]');
  await p.click('[data-action=add-set]');
  await p.fill('[data-set="0:2:reps"]', '14');
  assert((await p.textContent('#cap-0-2')) === '>12 rep', 'más de 12 reps: sin %1RM');
  await p.click('[data-action=toggle-done][data-j="0"]');
  await p.click('[data-action=timer-stop]');
  await (await p.$('[data-ex="0"]')).screenshot({ path: out + '/5card.png' });
  assert(await p.isVisible('.sum-mini') && !(await p.$('.sum-mini h3')), 'sesión abierta: resumen plegado (3 cifras)');
  await p.click('[data-action=sum-open]');
  const sum = await p.$('h3:has-text("Índice de estrés")');
  assert(!!sum, 'resumen muestra índice de estrés');
  await sum.scrollIntoViewIfNeeded();
  await p.screenshot({ path: out + '/5summary.png' });

  // Glosario: tabla RTS
  await p.click('[data-action=info][data-k=stress_index] >> nth=0');
  assert(await p.isVisible('#modal .gloss table'), 'glosario del IE con tabla');
  await p.click('#modal button.block');

  // Datos sintéticos para análisis semanal
  await p.evaluate(() => {
    const sq = db.exercises.find((e) => e.name === 'Sentadilla trasera').id, curl = db.exercises.find((e) => e.name === 'Curl de bíceps').id;
    for (let k = 0; k < 16; k++) {
      const d = new Date(); d.setDate(d.getDate() - k * 4 - 1);
      const iso = d.toISOString().slice(0, 10);
      db.sessions.push({ id: 'w' + k, createdAt: iso + 'T10:00', date: iso, startedAt: +d, endedAt: +d + 3600e3, title: 'Fuerza', system: 'si', factors: [], exercises: [
        { id: 'a' + k, exerciseId: sq, equipment: [], notes: '', sets: [0, 1, 2, 3].map(() => ({ type: 'E', w: 100, reps: 5, rir: k % 3, done: true })) },
        { id: 'b' + k, exerciseId: curl, equipment: [], notes: '', sets: [0, 1, 2].map(() => ({ type: 'E', w: 15, reps: 12, rir: 1, done: true })) },
      ] });
    }
    save(true);
  });
  await p.goto('http://localhost:8123/#/analysis');
  await p.click('[data-action=atab][data-t=load]');
  assert(await p.isVisible('svg.chart'), 'gráfica de IE semanal');
  await p.screenshot({ path: out + '/5load.png', fullPage: true });
  await p.click('[data-action=atab][data-t=intensity]');
  assert(await p.isVisible('.bar'), 'distribución por zonas');
  await p.screenshot({ path: out + '/5int.png', fullPage: true });
  await p.click('[data-action=atab][data-t=factors]');
  const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert(sw <= 0, 'sin scroll horizontal');
  console.log('errors', errs);
  await b.close();
})();
