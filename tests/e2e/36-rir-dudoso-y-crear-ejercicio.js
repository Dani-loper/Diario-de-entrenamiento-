// Aviso de RIR dudoso (una serie posterior rinde mucho más) y crear un ejercicio desde el buscador con la ficha completa.
const { chromium, devices } = require('playwright');
const out = process.argv[2] || 'shots';
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8123/');
  // ---- Lógica ----
  const r = await p.evaluate(() => {
    const S = (...a) => a.map(([w, reps, rir, type = 'E']) => ({ type, w, reps, rir, done: true }));
    return {
      big: rirCheck(S([80, 8, 2], [80, 10, 2]), 1),
      small: rirCheck(S([80, 8, 2], [80, 8, 3]), 1),
      first: rirCheck(S([80, 8, 2], [80, 10, 2]), 0),
      noRirBefore: rirCheck(S([80, 8, null], [80, 10, 2]), 1),
      noRirNow: rirCheck(S([80, 8, 2], [80, 10, null]), 1),
      warm: rirCheck(S([60, 8, 2, 'C'], [80, 8, 2]), 1),
      heavier: rirCheck(S([70, 10, 3], [95, 6, 1]), 1),
      worst: rirCheck(S([80, 8, 2], [80, 9, 2], [80, 11, 2]), 2),
    };
  });
  assert(r.big && Math.round(r.big.jump) === 9 && r.big.k === 0 && r.big.implied === 4, '80×8 @ RIR 2 y luego 80×10 @ RIR 2: +9 %, la primera encaja con RIR 4');
  assert(r.small === null, '+4,5 % (1 repetición): no avisa (error normal al estimar)');
  assert(r.first === null, 'la primera serie no se compara con nada');
  assert(r.noRirBefore === null && r.noRirNow === null, 'sin RIR anotado en alguna de las dos: no avisa');
  assert(r.warm === null, 'los calentamientos no cuentan');
  assert(r.heavier && r.heavier.implied > 3, 'con pesos distintos también: 70×10 @ 3 → 95×6 @ 1 (' + Math.round(r.heavier.jump) + ' %)');
  assert(r.worst && r.worst.k === 0, 'con varias series, señala la que más se aleja');
  // ---- En la sesión, modo sencillo ----
  await p.evaluate(() => {
    db.settings.level = 'simple';
    const pb = db.exercises.find((e) => e.name === 'Press banca').id;
    db.sessions.push({ id: 'r1', createdAt: todayISO() + 'T10', date: todayISO(), startedAt: Date.now() - 6e5, title: 'Torso', factors: [], exercises: [{ id: 'x0', exerciseId: pb, equipment: [], notes: '',
      sets: [{ type: 'E', w: 80, reps: 8, rir: 2, done: true }, { type: 'E', w: null, reps: null, rir: null, done: false }] }] });
    save(true);
  });
  await p.goto('http://localhost:8123/#/session/r1'); await p.waitForSelector('[data-set="0:1:w"]');
  await p.fill('[data-set="0:1:w"]', '80'); await p.fill('[data-set="0:1:reps"]', '10');
  assert(!(await p.$('.rir-check')), 'sin RIR todavía en la serie 2: no avisa');
  await p.selectOption('[data-set="0:1:rir"]', '2');
  await p.waitForSelector('.rir-check');
  const msg = await p.textContent('.rir-check');
  assert(msg.includes('9 % más que la serie 1') && msg.includes('RIR 4'), 'modo sencillo: aviso bajo la serie 2 con el RIR que encaja: ' + msg.trim());
  await (await p.$('[data-ex="0"]')).screenshot({ path: out + '/36rir.png' });
  await p.selectOption('[data-set="0:0:rir"]', '4');
  await p.waitForFunction(() => !document.querySelector('.rir-check'));
  assert(true, 'al corregir la serie 1 a RIR 4, el aviso desaparece');

  // ---- Crear ejercicio desde el buscador: ficha completa y se añade a la sesión ----
  await p.click('[data-action=add-exercise]');
  await p.fill('#picker-q', 'Press Larsen');
  await p.click('[data-action=exercise-form][data-then=add]');
  assert(await p.inputValue('#ef-name') === 'Press Larsen' && await p.isVisible('#ef-sec') && await p.isVisible('#ef-kit') && await p.isVisible('#ef-joint'), 'abre la ficha completa con el nombre escrito');
  await p.selectOption('#ef-cat', 'pectoral');
  await p.click('#ef-sec [data-m=triceps]'); // ½
  await p.selectOption('#ef-kit', 'barra');
  await p.click('[data-action=save-exercise]');
  const ex = await p.evaluate(() => { const e = db.exercises.find((x) => x.name === 'Press Larsen'); const s = currentSession(); return { e, last: s.exercises[s.exercises.length - 1].exerciseId, route: location.hash }; });
  assert(ex.e && ex.e.primary === 'pectoral' && ex.e.secondary.join() === 'triceps' && ex.e.sw.triceps === 0.5 && ex.e.kit === 'barra', 'se guarda con músculos, pesos y material');
  assert(ex.last === ex.e.id && ex.route === '#/session/r1' && !(await p.evaluate(() => modal.open)), 'y se añade a la sesión (sin salir de ella)');
  assert(!errs.length, 'sin errores: ' + errs.join(' | '));
  await b.close();
})();
