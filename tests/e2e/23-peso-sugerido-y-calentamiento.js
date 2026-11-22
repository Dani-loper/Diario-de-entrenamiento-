const { chromium, devices } = require('playwright');
const out = process.argv[2] || 'shots';
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8123/');
  // Sesión anterior: sentadilla 100 × 5 @ RIR 2 (1RM est. 100 / 0,811 = 123,3) y 90 × 8 @ RIR 2
  await p.evaluate(() => {
    const sq = db.exercises.find((e) => e.name === 'Sentadilla trasera').id, d = addDays(todayISO(), -4);
    db.sessions.push({ id: 'old', createdAt: d + 'T10', date: d, startedAt: 1, endedAt: 2, title: 'x', factors: [], exercises: [{ id: 'a', exerciseId: sq, equipment: [], notes: '', sets: [{ type: 'E', w: 100, reps: 5, rir: 2, done: true }, { type: 'E', w: 90, reps: 8, rir: 2, done: true }] }] });
    const t = todayISO();
    db.sessions.push({ id: 'hoy', createdAt: t + 'T10', date: t, startedAt: Date.now(), title: 'Hoy', factors: [], exercises: [{ id: 'b', exerciseId: sq, equipment: [], notes: '', sets: [{ type: 'E', w: null, reps: null, rir: null, done: false }, { type: 'E', w: null, reps: null, rir: null, done: false }] }] });
    save(true);
  });
  await p.goto('http://localhost:8123/#/session/hoy'); await p.waitForSelector('.suggest');
  assert((await p.textContent('.suggest')).includes('100 kg × 5 @ RIR 2'), 'sugerido para la serie 1: 100 kg × 5 @ RIR 2 (como la última sesión): ' + (await p.textContent('.suggest')).replace(/\s+/g, ' ').trim());
  assert(await p.getAttribute('[data-set="0:0:w"]', 'placeholder') === '100' && await p.getAttribute('[data-set="0:1:w"]', 'placeholder') === '90', 'en gris en cada serie: 100 y 90 (8 @ RIR 2 = 73,9 % de 123,3 = 91,1 → 90)');
  assert(await p.getAttribute('[data-set="0:0:reps"]', 'placeholder') === '5' && await p.getAttribute('[data-set="0:1:reps"]', 'placeholder') === '8', 'repeticiones sugeridas en gris: 5 y 8');
  assert(await p.evaluate(() => currentSession().exercises[0].sets[0].w) === null, 'no se guarda nada solo por sugerir');
  assert(await p.isVisible('[data-action=warmup][data-j="0"]') && !(await p.isVisible('[data-action=warmup][data-j="1"]')), 'botón de calentamiento solo en la siguiente serie pendiente');
  // Autorregulación: hoy la primera serie sale 105 × 5 @ RIR 2 → la segunda se recalcula con el 1RM de hoy
  await p.fill('[data-set="0:0:w"]', '105'); await p.fill('[data-set="0:0:reps"]', '5');
  await p.selectOption('[data-set="0:0:rir"]', '2');
  await p.click('[data-action=toggle-done][data-i="0"][data-j="0"]');
  await p.click('[data-action=timer-stop]').catch(() => {});
  const ph = await p.getAttribute('[data-set="0:1:w"]', 'placeholder');
  assert(ph === '95', 'tras una serie más fuerte hoy (105 × 5), la siguiente sube a 95 (73,9 % de 129,5): ' + ph);
  assert((await p.textContent('.suggest')).includes('tus series de hoy'), 'indica que se basa en las series de hoy');
  assert(await p.isVisible('[data-action=warmup][data-j="1"]'), 'el botón de calentamiento pasa a la serie 2');
  await p.click('[data-action=fill-suggest]');
  const s2 = await p.evaluate(() => { const x = currentSession().exercises[0].sets[1]; return [x.w, x.reps, x.rir]; });
  assert(s2.join() === '95,8,2', '«Rellenar» escribe 95 × 8 @ RIR 2: ' + s2);
  assert(!(await p.isVisible('.suggest')), 'con todos los pesos escritos, la sugerencia desaparece');
  // Calentamiento para 95 × 8 (≥ 8 reps: barra, 50 %, 70 %)
  await p.click('[data-action=warmup][data-j="1"]');
  await p.waitForSelector('.wu-table');
  const rows = await p.$$eval('.wu-table tr', (r) => r.slice(1).map((x) => [...x.cells].map((c) => c.textContent.trim()).join(' | ')));
  assert(rows.join(' / ') === 'Barra | 20 kg × 10 | solo la barra / 50 % | 47,5 kg × 5 | 10 + 2,5 + 1,25 / 70 % | 67,5 kg × 3 | 20 + 2,5 + 1,25 / Trabajo | 95 kg × 8 | 25 + 10 + 2,5', 'rampa y discos: ' + rows.join(' / '));
  await (await p.$('#modal')).screenshot({ path: out + '/23warmup.png' });
  // Cambiar el peso de trabajo a 140 × 3 (rampa completa)
  await p.fill('#wu-work', '140'); await p.press('#wu-work', 'Tab');
  assert(await p.$$eval('.wu-table tr', (r) => r.length - 2) === 3, 'el peso de trabajo se puede cambiar en la ventana (series de 8: 3 escalones)');
  await p.click('[data-action=wu-add]');
  const sets = await p.evaluate(() => currentSession().exercises[0].sets.map((x) => `${x.type}${x.w}x${x.reps}`).join(' '));
  assert(sets === 'E105x5 C20x10 C70x5 C97.5x3 E95x8', 'se insertan antes de la serie como calentamiento: ' + sets);
  // Sin barra
  await p.evaluate(() => { const s = currentSession(); s.exercises[0].sets.splice(1, 3); save(true); rerender(); });
  await p.click('[data-action=warmup]');
  await p.selectOption('#wu-bar', '0');
  assert(!(await p.textContent('.wu-table')).includes('Discos') && await p.evaluate(() => db.exercises.find((e) => e.name === 'Sentadilla trasera').noBar) === true, 'sin barra: sin discos y se recuerda por ejercicio');
  await p.click('#modal [data-action=close-modal]');
  // Ajustes: barra de 15 y discos
  await p.goto('http://localhost:8123/#/settings');
  await p.selectOption('[data-setting=bar]', '15');
  await p.click('[data-action=toggle-plate][data-p="1.25"]');
  const pl = await p.evaluate(() => [barWeight(), platesAvail().join(','), JSON.stringify(platesFor(100))]);
  assert(pl[0] === 15 && !pl[1].includes('1.25') && pl[2] === '{"plates":[25,15,2.5],"missing":0}', 'barra de 15 y sin discos de 1,25: 100 kg = 25 + 15 + 2,5 por lado: ' + pl.join(' · '));
  assert(await p.evaluate(() => JSON.stringify(platesFor(101))) === '{"plates":[25,15,2.5],"missing":1}', 'si no cuadra, indica lo que falta (1 kg)');
  console.log('errors', errs); await b.close();
})();
