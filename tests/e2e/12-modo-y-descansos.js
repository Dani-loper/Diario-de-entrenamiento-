const { chromium, devices } = require('playwright');
const out = process.argv[2];
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ ...devices['Pixel 7'] });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  let promptAnswer = ''; p.on('dialog', (d) => d.type() === 'prompt' ? d.accept(promptAnswer) : d.accept());
  await p.goto('http://localhost:8123/');
  assert(await p.evaluate(() => db.settings.level) === 'simple', 'usuario nuevo: modo sencillo');
  assert(await p.evaluate(() => normalize({ exercises: [], equipment: [], sessions: [{ id: 'x', exercises: [] }], settings: {} }).settings.level) === 'advanced', 'usuario existente con sesiones: avanzado');
  // Migración de descansos de la versión anterior
  const mig = await p.evaluate(() => normalize({ exercises: [], equipment: [], settings: {}, sessions: [{ id: 'm', exercises: [{ exerciseId: 'x', sets: [{}, { restSec: 95, restSrc: 'timer' }, { restSec: 150, restSrc: 'auto' }, { restSec: 120, restSrc: 'manual' }] }] }] }).sessions[0].exercises[0].sets.map((x) => [x.rest ?? null, 'restSec' in x]));
  assert(JSON.stringify(mig) === JSON.stringify([[95, false], [null, false], [120, false], [null, false]]), 'migración: el descanso pasa a la serie anterior; los aproximados se descartan: ' + JSON.stringify(mig));

  // ---- Modo sencillo ----
  await p.click('[data-action=new-session]');
  assert(!(await p.isVisible('#pre')) && !(await p.isVisible('[data-action=cycle-system]')), 'sencillo: sin «antes de empezar» ni cuantificación');
  await p.click('[data-action=add-exercise]');
  await p.fill('#picker-q', 'sentadilla trasera');
  await p.click('#picker-list [data-action=pick-exercise] >> nth=0');
  const heads = await p.$$eval('.sets th', (x) => x.map((h) => h.textContent.trim().split(' ')[0]));
  assert(JSON.stringify(heads.slice(0, 4)) === JSON.stringify(['#', 'kg', 'Reps', 'RIR']), 'sencillo: columnas serie, kg, reps, RIR');
  assert(!(await p.$('.exstats')) && !(await p.$('[data-action=open-eq]')) && !(await p.$('[data-action=cycle-intensity]')) && !(await p.$('.cap')), 'sencillo: sin estadísticas, material, intensidad ni %1RM');
  await p.fill('[data-set="0:0:w"]', '100'); await p.fill('[data-set="0:0:reps"]', '5');
  await p.selectOption('[data-set="0:0:rir"]', '2');
  await p.click('[data-action=add-set]'); await p.click('[data-action=add-set]');
  assert((await p.$$('[data-rest]')).length === 2, 'campo de descanso entre series (no tras la última si está vacía)');

  // ---- Cronómetro: ✓ lo arranca; «⏹ Parar» rellena el campo de esa serie ----
  await p.click('[data-action=toggle-done][data-j="0"]');
  assert(await p.isVisible('#timer [data-action=timer-save-rest]'), 'al marcar ✓ arranca el cronómetro con «⏹ Parar»');
  await p.waitForFunction(() => /\d:\d\d…/.test(document.querySelector('#rest-live')?.textContent || ''));
  assert(true, 'el campo muestra el tiempo en marcha');
  await p.evaluate(() => { ui.rest.start -= 95000; });
  await p.click('[data-action=timer-save-rest]');
  assert(await p.evaluate(() => currentSession().exercises[0].sets[0].rest) === 95, '«⏹ Parar» guarda 95 s en la serie 1');
  assert(await p.inputValue('[data-rest="0:0"]') === '1:35', 'el campo se rellena: 1:35');
  // Modificable después
  await p.fill('[data-rest="0:0"]', '2:00'); await p.press('[data-rest="0:0"]', 'Tab');
  assert(await p.evaluate(() => currentSession().exercises[0].sets[0].rest) === 120, 'se puede modificar: 2:00 = 120 s');
  await p.fill('[data-rest="0:0"]', 'abc'); await p.press('[data-rest="0:0"]', 'Tab');
  assert(await p.evaluate(() => currentSession().exercises[0].sets[0].rest) === 120 && await p.$eval('[data-rest="0:0"]', (e) => e.classList.contains('bad')), 'formato no válido: se marca y no se guarda');
  await p.fill('[data-rest="0:0"]', '90'); await p.press('[data-rest="0:0"]', 'Tab');
  assert(await p.evaluate(() => currentSession().exercises[0].sets[0].rest) === 90 && await p.inputValue('[data-rest="0:0"]') === '1:30', 'en segundos: 90 → 1:30');
  // Sin parar el cronómetro: marcar la siguiente serie NO rellena nada
  await p.click('[data-action=toggle-done][data-j="1"]');
  await p.evaluate(() => { ui.rest.start -= 60000; });
  await p.click('[data-action=toggle-done][data-j="2"]');
  assert(await p.evaluate(() => currentSession().exercises[0].sets[1].rest == null), 'si no se para, no se rellena (el tiempo incluiría la serie)');
  // ✕ descarta
  await p.click('[data-action=timer-stop]');
  assert(await p.evaluate(() => currentSession().exercises[0].sets[2].rest == null) && !(await p.isVisible('#timer')), '✕ descarta sin rellenar');
  // Escribir mientras corre: para el cronómetro y respeta lo escrito
  await p.click('[data-action=toggle-done][data-j="1"]'); await p.click('[data-action=toggle-done][data-j="1"]');
  await p.fill('[data-rest="0:1"]', '3:00'); await p.press('[data-rest="0:1"]', 'Tab');
  assert(await p.evaluate(() => currentSession().exercises[0].sets[1].rest === 180 && !ui.rest), 'escribir a mano mientras corre: para el cronómetro y guarda lo escrito');
  // Borrar el campo
  await p.fill('[data-rest="0:1"]', ''); await p.press('[data-rest="0:1"]', 'Tab');
  assert(await p.evaluate(() => currentSession().exercises[0].sets[1].rest == null), 'vaciar el campo quita el descanso');
  await p.fill('[data-rest="0:1"]', '2:15'); await p.press('[data-rest="0:1"]', 'Tab');
  // Última serie: campo visible mientras corre y con valor
  await p.click('[data-action=toggle-done][data-j="2"]'); await p.click('[data-action=toggle-done][data-j="2"]');
  assert(await p.isVisible('[data-rest="0:2"]'), 'última serie: el campo aparece mientras corre el cronómetro');
  await p.evaluate(() => { ui.rest.start -= 45000; });
  await p.click('[data-action=timer-save-rest]');
  assert(await p.evaluate(() => currentSession().exercises[0].sets[2].rest) === 45, 'última serie: «⏹ Parar» también guarda (45 s)');
  // Sin objetivo (0): el cronómetro sigue funcionando
  await p.evaluate(() => { db.settings.rest = 0; save(true); });
  await p.click('[data-action=toggle-done][data-j="0"]'); await p.click('[data-action=toggle-done][data-j="0"]');
  assert(await p.isVisible('#timer') && await p.evaluate(() => timer.end === null), 'con descanso objetivo 0, el cronómetro cuenta hacia arriba');
  await p.click('[data-action=timer-stop]');
  await p.evaluate(() => { db.settings.rest = 120; save(true); });
  // No hay cálculos automáticos
  assert(await p.evaluate(() => currentSession().exercises[0].sets.every((x) => !('restSec' in x) && !('restSrc' in x))), 'la app no calcula descansos por su cuenta');
  // Resumen
  assert(await p.isVisible('.stat:has-text("descanso medio")'), 'resumen con descanso medio');
  await (await p.$('[data-ex="0"]')).screenshot({ path: out + '/13simple.png' });
  // Repetir sesión no copia descansos
  await p.click('[data-action=finish-session]');
  await p.goto('http://localhost:8123/#/');
  await p.click('[data-action=repeat-session]'); await p.click('[data-action=repeat-from]');
  assert(await p.evaluate(() => currentSession().exercises[0].sets.every((x) => x.rest == null && !x.doneAt)), 'repetir sesión no copia descansos ni horas');
  await p.click('[data-action=session-menu]'); await p.click('[data-action=delete-session]');

  // ---- Avanzado ----
  await p.goto('http://localhost:8123/#/settings');
  await p.click('[data-action=set-level][data-l=advanced]');
  await p.goto('http://localhost:8123/#/');
  await p.click('.list-item >> nth=0');
  await p.waitForSelector('[data-ex="0"]');
  assert(await p.isVisible('.exstats') && await p.isVisible('[data-action=rest-target]'), 'avanzado: estadísticas y descanso objetivo');
  assert(await p.$eval('[data-set="0:0:rir"]', (e) => e.value) === '2' && await p.inputValue('[data-rest="0:0"]') === '1:30', 'avanzado: no se pierde RIR ni descansos');
  promptAnswer = '3:00';
  await p.click('[data-action=rest-target]');
  if (await p.evaluate(() => currentSession().exercises[0].sets[0].done)) await p.click('[data-action=toggle-done][data-j="0"]');
  await p.click('[data-action=toggle-done][data-j="0"]');
  const left = await p.evaluate(() => (timer.end - Date.now()) / 1000);
  assert(left > 170 && left <= 180, `el cronómetro usa el descanso objetivo del ejercicio (${Math.round(left)} s)`);
  await p.click('[data-action=timer-stop]');
  await (await p.$('[data-ex="0"]')).screenshot({ path: out + '/13advanced.png' });
  const csv = await p.evaluate(() => toCSV().split('\n'));
  assert(csv[0].includes('descanso_despues_s') && csv.some((l) => l.includes(';90;') || l.includes(';90\r')), 'CSV con el descanso de cada serie');
  console.log('errors', errs);
  await b.close();
})();
