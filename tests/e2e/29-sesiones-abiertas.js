const { chromium, devices } = require('playwright');
const out = process.argv[2] || 'shots';
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8123/');
  // «olvidada»: empezó hace 4 h, última serie hace 3 h · «reciente»: empezó hace 30 min
  const t = await p.evaluate(() => {
    const now = Date.now(), sq = db.exercises.find((e) => e.name === 'Sentadilla trasera').id, d = todayISO();
    const mk = (id, title, start, done) => ({ id, title, createdAt: d + 'T0' + id.length, date: d, startedAt: start, factors: [], exercises: [{ id: id + 'e', exerciseId: sq, equipment: [], notes: '', sets: [{ type: 'E', w: 100, reps: 5, rir: 2, done: true, doneAt: done }] }] });
    db.sessions.push(mk('olv', 'Pierna', now - 4 * 3600e3, now - 3 * 3600e3), mk('reciente', 'Torso', now - 30 * 60e3, now - 10 * 60e3));
    save(true); rerender(); return now;
  });
  await p.click('[data-action=notices]');
  await p.waitForSelector('.stale');
  const cards = await p.$$eval('.stale', (x) => x.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
  assert(cards.length === 1 && cards[0].includes('«Pierna» sigue abierta') && cards[0].includes('hace 3 h'), 'calendario: aviso solo de la sesión sin actividad desde hace 3 h: ' + cards[0]);
  await (await p.$('.stale')).screenshot({ path: out + '/29stale.png' });
  // También dentro de la sesión
  await p.goto('http://localhost:8123/#/session/olv'); await p.waitForSelector('.stale');
  assert(true, 'el aviso aparece también dentro de la sesión');
  await p.click('[data-action=stale-close]');
  const s = await p.evaluate(() => { const x = sessionById('olv'); return { end: x.endedAt, last: x.exercises[0].sets[0].doneAt, start: x.startedAt }; });
  assert(s.end === s.last + 120e3, 'se cierra con la hora de la última serie + 2 min (no ahora)');
  assert((await p.textContent('#app')).includes('Duración') && (await p.textContent('.pill')).includes('1 h 2 min'), 'duración real: 1 h 2 min (no 4 h): ' + (await p.textContent('.pill')));
  // «Sigo entrenando»: la reciente pasa a estar inactiva → se pospone
  await p.evaluate(() => { const x = sessionById('reciente'); x.startedAt -= 5 * 3600e3; x.exercises[0].sets[0].doneAt -= 5 * 3600e3; save(true); });
  await p.goto('http://localhost:8123/#/'); await p.waitForSelector('.stale');
  await p.click('[data-action=stale-keep]');
  assert(!(await p.isVisible('.stale')) && await p.evaluate(() => sessionById('reciente').endedAt == null), '«Sigo entrenando»: la sesión sigue abierta y el aviso se pospone');
  // Cierre automático
  await p.evaluate(() => { delete sessionById('reciente').keepOpenUntil; save(true); });
  await p.goto('http://localhost:8123/#/settings');
  await p.check('#autoclose-chk');
  const r = await p.evaluate(() => { const x = sessionById('reciente'); return [!!x.endedAt, x.autoClosed]; });
  assert(r[0] && r[1] === true, 'al activar «cerrarlas automáticamente» se cierra y queda marcada como cierre automático');
  await p.evaluate(() => { const now = Date.now(), d = todayISO(); db.sessions.push({ id: 'otra', title: 'Brazos', createdAt: d + 'T11', date: d, startedAt: now - 9 * 3600e3, factors: [], exercises: [] }); save(true); });
  await p.goto('http://localhost:8123/#/'); await p.reload(); await p.waitForSelector('.cal');
  assert(await p.evaluate(() => !!sessionById('otra').endedAt), 'con el cierre automático activado, al abrir la app se cierran las olvidadas');
  // «Nunca»
  await p.evaluate(() => { db.settings.autoClose = false; db.settings.closeAfterH = 0; const now = Date.now(); db.sessions.push({ id: 'n', title: 'x', createdAt: todayISO() + 'T12', date: todayISO(), startedAt: now - 9 * 3600e3, factors: [], exercises: [] }); save(true); rerender(); });
  assert(!(await p.isVisible('.stale')), '«Nunca»: sin aviso');
  console.log('errors', errs); await b.close();
})();
