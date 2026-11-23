// Cronómetro de descanso: automático al marcar ✓ (por defecto) o manual con el botón «Iniciar» de la serie.
const { chromium, devices } = require('playwright');
const out = process.argv[2] || 'shots';
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8123/');
  await p.evaluate(() => {
    const pb = db.exercises.find((e) => e.name === 'Press banca').id, rm = db.exercises.find((e) => e.name === 'Remo con barra').id;
    const sets = () => [{ type: 'C', w: 40, reps: 10, rir: null, done: false }, { type: 'E', w: 80, reps: 8, rir: 2, done: false }, { type: 'E', w: 80, reps: 8, rir: 2, done: false }];
    db.sessions.push({ id: 't1', createdAt: todayISO() + 'T10', date: todayISO(), startedAt: Date.now() - 6e5, title: 'Torso', factors: [], exercises: [
      { id: 'a', exerciseId: pb, equipment: [], notes: '', sets: sets() }, { id: 'b', exerciseId: rm, equipment: [], notes: '', sets: sets() }] });
    save(true);
  });
  const timerOn = () => p.evaluate(() => !document.getElementById('timer').classList.contains('hidden'));
  // ---- Automático (por defecto) ----
  await p.goto('http://localhost:8123/#/session/t1'); await p.waitForSelector('[data-ex="0"]');
  await p.click('[data-action=toggle-done][data-i="0"][data-j="1"]');
  assert(await timerOn() && await p.evaluate(() => ui.rest?.j === 1) && !(await p.$('.rest-go')), 'automático: al marcar ✓ arranca el cronómetro, sin botón «Iniciar»');
  await p.click('[data-action=timer-stop]');
  // ---- Manual ----
  await p.goto('http://localhost:8123/#/settings');
  await p.selectOption('[data-setting-str=timerMode]', 'manual');
  assert(await p.evaluate(() => db.settings.timerMode) === 'manual' && (await p.textContent('#app')).includes('aparece «Iniciar»'), 'Ajustes › Descansos: modo manual con su explicación');
  await p.goto('http://localhost:8123/#/session/t1'); await p.waitForSelector('[data-ex="0"]');
  await p.click('[data-action=toggle-done][data-i="0"][data-j="2"]');
  assert(!(await timerOn()) && !(await p.evaluate(() => ui.rest)), 'manual: marcar ✓ no arranca el cronómetro');
  assert(await p.isVisible('.rest-go[data-i="0"][data-j="2"]') && !(await p.$('.rest-go[data-i="0"][data-j="1"]')), 'botón «Iniciar» solo en la serie recién marcada (no en las anteriores)');
  await p.click('[data-action=toggle-done][data-i="0"][data-j="0"]');
  assert(!(await p.$('.rest-go[data-i="0"][data-j="0"]')), 'los calentamientos no tienen botón');
  await (await p.$('[data-ex="0"]')).screenshot({ path: out + '/40manual.png' });
  await p.click('.rest-go[data-i="0"][data-j="2"]');
  assert(await timerOn() && await p.evaluate(() => ui.rest?.i === 0 && ui.rest?.j === 2) && !(await p.$('.rest-go')), '«Iniciar» arranca el cronómetro de esa serie');
  await p.evaluate(() => { ui.rest.start -= 95e3; });
  await p.click('[data-action=timer-save-rest]');
  assert(await p.evaluate(() => currentSession().exercises[0].sets[2].rest) >= 95 && !(await p.$('.rest-go[data-i="0"][data-j="2"]')), '«Parar» guarda el descanso en la serie y el botón desaparece');
  // Superserie: sin botón en el primer ejercicio del grupo
  await p.click('[data-action=ss-toggle][data-i="0"]');
  await p.click('[data-action=toggle-done][data-i="0"][data-j="1"]'); await p.click('[data-action=toggle-done][data-i="0"][data-j="1"]');
  assert(!(await p.$('.rest-go[data-i="0"]')), 'superserie: no se descansa entre sus ejercicios (sin botón en el primero)');
  await p.click('[data-action=toggle-done][data-i="1"][data-j="1"]');
  assert(await p.isVisible('.rest-go[data-i="1"][data-j="1"]') && !(await timerOn()), 'en el último del grupo sí sale «Iniciar»');
  assert(!errs.length, 'sin errores: ' + errs.join(' | '));
  await b.close();
})();
