// Cronómetro «de una serie a la siguiente»: al marcar ✓ una serie, el tiempo desde la anterior se guarda como su descanso.
const { chromium, devices } = require('playwright');
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8123/');
  await p.evaluate(() => {
    const pb = db.exercises.find((e) => e.name === 'Press banca').id, rm = db.exercises.find((e) => e.name === 'Remo con barra').id;
    const sets = () => [1, 2, 3].map(() => ({ type: 'E', w: 80, reps: 8, rir: 2, done: false }));
    db.sessions.push({ id: 'b1', createdAt: todayISO() + 'T10', date: todayISO(), startedAt: Date.now() - 6e5, title: 'Torso', factors: [], exercises: [
      { id: 'a', exerciseId: pb, equipment: [], notes: '', sets: sets() }, { id: 'b', exerciseId: rm, equipment: [], notes: '', sets: sets() }] });
    save(true);
  });
  await p.goto('http://localhost:8123/#/settings');
  await p.selectOption('[data-setting-str=timerMode]', 'between');
  assert((await p.textContent('#app')).includes('Incluye lo que tardas en hacer la serie'), 'Ajustes: tercera opción, avisando de que incluye la ejecución');
  await p.goto('http://localhost:8123/#/session/b1'); await p.waitForSelector('[data-ex="0"]');
  const rest = (i, j) => p.evaluate(([a, c]) => currentSession().exercises[a].sets[c].rest ?? null, [i, j]);
  const near = (v, t) => v != null && Math.abs(v - t) <= 2;
  // Avanza el reloj del navegador (como si pasara ese tiempo entre dos series).
  const back = (i, j, sec) => p.clock.fastForward(sec * 1000);
  await p.click('[data-action=toggle-done][data-i="0"][data-j="0"]');
  assert(await p.evaluate(() => !document.getElementById('timer').classList.contains('hidden')), 'al marcar ✓ arranca el cronómetro (como en automático)');
  await back(0, 0, 150);
  await p.click('[data-action=toggle-done][data-i="0"][data-j="1"]');
  assert(near(await rest(0, 0), 150), 'al marcar la serie 2, la serie 1 guarda 2:30 de descanso');
  // Ya escrito a mano: no se toca
  await p.evaluate(() => { currentSession().exercises[0].sets[1].rest = 100; });
  await back(0, 1, 200);
  await p.click('[data-action=toggle-done][data-i="0"][data-j="2"]');
  assert(await rest(0, 1) === 100, 'un descanso ya escrito no se sobrescribe');
  // Cambio de ejercicio: el descanso del último del press se guarda al marcar el primero del remo
  await back(0, 2, 180);
  await p.click('[data-action=toggle-done][data-i="1"][data-j="0"]');
  assert(near(await rest(0, 2), 180), 'también entre ejercicios: la última de press guarda el tiempo hasta la primera de remo');
  // Pausa larga (> 20 min): no se guarda
  await back(1, 0, 25 * 60);
  await p.click('[data-action=toggle-done][data-i="1"][data-j="1"]');
  assert(await rest(1, 0) === null, 'más de 20 minutos (pausa u olvido): no se guarda');
  // Tras cerrar la app (se calcula con las horas de ✓)
  await back(1, 1, 120);
  await p.evaluate(() => save(true)); await p.reload(); await p.waitForSelector('[data-ex="1"]');
  await p.click('[data-action=toggle-done][data-i="1"][data-j="2"]');
  assert(near(await rest(1, 1), 120), 'funciona aunque la app se haya cerrado entre dos series');
  // Superserie: entre sus ejercicios no se guarda descanso
  await p.evaluate(() => { const s = currentSession(); s.exercises.forEach((e) => e.sets.forEach((x) => { x.done = false; delete x.doneAt; delete x.rest; })); s.exercises[0].ss = true; save(true); rerender(); });
  await p.click('[data-action=toggle-done][data-i="0"][data-j="0"]');
  await back(0, 0, 40);
  await p.click('[data-action=toggle-done][data-i="1"][data-j="0"]');
  assert(await rest(0, 0) === null, 'superserie: de press a remo no hay descanso que guardar');
  await back(1, 0, 90);
  await p.click('[data-action=toggle-done][data-i="0"][data-j="1"]');
  assert(near(await rest(1, 0), 90), 'tras el último del grupo sí: remo guarda el tiempo hasta la siguiente vuelta');
  // En automático (por defecto) no se rellena nada solo
  await p.evaluate(() => { db.settings.timerMode = 'auto'; const s = currentSession(); s.exercises[0].ss = false; s.exercises.forEach((e) => e.sets.forEach((x) => { x.done = false; delete x.doneAt; delete x.rest; })); save(true); rerender(); });
  await p.click('[data-action=toggle-done][data-i="0"][data-j="0"]'); await back(0, 0, 100);
  await p.click('[data-action=toggle-done][data-i="0"][data-j="1"]');
  assert(await rest(0, 0) === null, 'modo automático: no se guarda solo (hace falta «Parar»)');
  assert(!errs.length, 'sin errores: ' + errs.join(' | '));
  await b.close();
})();
