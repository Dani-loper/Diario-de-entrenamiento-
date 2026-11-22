const { chromium, devices } = require('playwright');
const out = process.argv[2] || 'shots';
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', (d) => d.type() === 'prompt' ? d.accept('Brazos SS') : d.accept());
  await p.goto('http://localhost:8123/');
  await p.evaluate(() => {
    const ex = (n) => db.exercises.find((e) => e.name === n);
    ex('Curl de bíceps').rest = 60; ex('Extensión de tríceps').rest = 90;
    const t = todayISO(), set = () => ({ type: 'E', w: 20, reps: 10, rir: 2, done: false });
    db.sessions.push({ id: 'h', createdAt: t + 'T10', date: t, startedAt: Date.now(), title: 'Brazos', factors: [], exercises: [
      { id: 'a', exerciseId: ex('Curl de bíceps').id, equipment: [], notes: '', sets: [set(), set()] },
      { id: 'b', exerciseId: ex('Extensión de tríceps').id, equipment: [], notes: '', sets: [set(), set()] },
      { id: 'c', exerciseId: ex('Elevaciones laterales').id, equipment: [], notes: '', sets: [set()] }] });
    save(true);
  });
  await p.goto('http://localhost:8123/#/session/h'); await p.waitForSelector('[data-ex="2"]');
  assert(!(await p.isVisible('[data-action=warmup]')), 'sin botón de calentamiento en ejercicios de aislamiento (curl, tríceps, elevaciones)');
  assert(await p.$$eval('[data-action=ss-toggle]', (x) => x.length) === 2, 'enlace «Superserie con el siguiente» entre cada par de ejercicios (2)');
  await p.click('[data-action=ss-toggle][data-i="0"]');
  assert(await p.evaluate(() => currentSession().exercises[0].ss) === true, 'curl enlazado con tríceps');
  const tags = await p.$$eval('.ss-tag', (x) => x.map((e) => e.textContent.trim()));
  assert(tags.length === 2 && tags[0].startsWith('Superserie A · 1/2') && tags[1].startsWith('Superserie A · 2/2'), 'etiquetas Superserie A 1/2 y 2/2: ' + tags.join(' | '));
  // ✓ en el curl: sin cronómetro, aviso del siguiente
  await p.click('[data-action=toggle-done][data-i="0"][data-j="0"]');
  assert(!(await p.evaluate(() => document.body.classList.contains('timer-on'))), 'tras el curl (1.º del grupo) no arranca el descanso');
  // ✓ en tríceps: cronómetro con el descanso más largo del grupo (90 s)
  await p.click('[data-action=toggle-done][data-i="1"][data-j="0"]');
  const left = await p.evaluate(() => Math.round((timer.end - Date.now()) / 1000));
  assert(left > 85 && left <= 90, 'tras el último del grupo arranca el descanso más largo (90 s): ' + left);
  await p.click('[data-action=timer-stop]');
  await (await p.$('[data-ex="0"]')).screenshot({ path: out + '/24ss.png' });
  // Guardar como tabla conserva la superserie y cargarla la recupera
  await p.click('[data-action=session-menu]');
  await p.click('[data-action=tpl-from-session]');
  await p.waitForSelector('[data-action=tpl-ss]');
  assert(await p.evaluate(() => tplList().find((t) => t.name === 'Brazos SS').exercises.map((e) => !!e.ss).join()) === 'true,false,false', 'la tabla guarda la superserie');
  assert(await p.isVisible('.ss-link.on [data-action=tpl-ss][data-ei="0"]'), 'el editor de tablas la muestra y permite cambiarla');
  await p.click('[data-action=tpl-ss][data-ei="1"]');
  assert(await p.evaluate(() => tplList().find((t) => t.name === 'Brazos SS').exercises.map((e) => !!e.ss).join()) === 'true,true,false', 'en el editor: tríceps + elevaciones también enlazados (trío)');
  await p.click('[data-action=tpl-start]');
  await p.waitForSelector('.ss-tag');
  const tags2 = await p.$$eval('.ss-tag', (x) => x.map((e) => e.textContent.trim().slice(0, 17)));
  assert(tags2.join('|') === 'Superserie A · 1/|Superserie A · 2/|Superserie A · 3/', 'sesión desde la tabla: superserie de 3: ' + tags2.join('|'));
  // Separar
  await p.click('[data-action=ss-toggle][data-i="0"]');
  assert(await p.$$eval('.ss-tag', (x) => x.length) === 2, 'separar el primero deja una superserie de 2');
  console.log('errors', errs); await b.close();
})();
