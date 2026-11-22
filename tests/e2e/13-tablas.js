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
  // Atleta avanzado con historial: sentadilla 100×5 @ RIR 2 (1RM est. 123,3) hace 10 días; ejercicio propio «Sentadilla búlgara»
  await p.evaluate(() => {
    db.settings.level = 'advanced';
    const sq = db.exercises.find((e) => e.name === 'Sentadilla trasera').id;
    db.exercises.push({ id: 'bulg', name: 'Sentadilla búlgara', mode: 'wr', primary: 'cuadriceps', secondary: ['gluteos'] });
    const d = new Date(Date.now() - 10 * 864e5); const iso = isoOf(d);
    db.sessions.push({ id: 'h1', createdAt: iso + 'T10', date: iso, startedAt: 1, endedAt: 2, title: 'Pierna', factors: [], exercises: [
      { id: 'x1', exerciseId: sq, equipment: [], notes: '', sets: [{ type: 'E', w: 100, reps: 5, rir: 2, done: true }] }] });
    save(true); rerender();
  });
  const e1 = await p.evaluate(() => refE1RM(db.exercises.find((e) => e.name === 'Sentadilla trasera').id));
  assert(Math.abs(e1 - 123.3) < 0.1, '1RM estimado de referencia: ' + e1.toFixed(1));

  // ---- Crear una tabla ----
  await p.click('[data-action=tpl-choose][data-mode=new]');
  assert((await p.textContent('#modal')).includes('Todavía no hay tablas'), 'sin tablas: lo indica');
  await p.click('#modal a[href="#/templates"]');
  await p.click('[data-action=tpl-new]');
  await p.waitForSelector('[data-tpl-name]');
  await p.fill('[data-tpl-name]', 'Pierna A'); await p.press('[data-tpl-name]', 'Tab');
  await p.click('[data-action=tpl-add-ex]');
  await p.fill('#picker-q', 'sentadilla trasera');
  await p.click('#picker-list [data-action=pick-exercise] >> nth=0');
  await p.waitForSelector('[data-tpl$=":0:0:reps"]');
  const tid = await p.evaluate(() => tplList()[0].id);
  assert(await p.evaluate(() => tplList()[0].exercises[0].sets.length) === 3, 'al añadir un ejercicio: 3 series de 8-12 @ RIR 2 por defecto');
  // Serie 1: calentamiento 10 reps al 50 %
  await p.click('[data-action=tpl-type][data-si="0"]');
  await p.fill(`[data-tpl="${tid}:0:0:reps"]`, '10'); await p.press(`[data-tpl="${tid}:0:0:reps"]`, 'Tab');
  await p.selectOption(`[data-tpl="${tid}:0:0:rir"]`, '');
  await p.fill(`[data-tpl="${tid}:0:0:pct"]`, '50'); await p.press(`[data-tpl="${tid}:0:0:pct"]`, 'Tab');
  // Serie 2: 5 reps @ RIR 2, % automático
  await p.fill(`[data-tpl="${tid}:0:1:reps"]`, '5'); await p.press(`[data-tpl="${tid}:0:1:reps"]`, 'Tab');
  assert(await p.getAttribute(`[data-tpl="${tid}:0:1:pct"]`, 'placeholder') === 'auto 81', 'sugerencia de % automática: 5 reps @ RIR 2 → 81');
  // Validaciones
  await p.fill(`[data-tpl="${tid}:0:2:reps"]`, '8-'); await p.press(`[data-tpl="${tid}:0:2:reps"]`, 'Tab');
  assert(await p.$eval(`[data-tpl="${tid}:0:2:reps"]`, (e) => e.classList.contains('bad')), 'repeticiones no válidas se marcan');
  await p.fill(`[data-tpl="${tid}:0:2:reps"]`, '8 - 12'); await p.press(`[data-tpl="${tid}:0:2:reps"]`, 'Tab');
  assert(await p.evaluate(() => tplList()[0].exercises[0].sets[2].reps) === '8-12', 'rango normalizado: 8-12');
  await p.fill(`[data-tpl="${tid}:0:-:rest"]`, '3:00'); await p.press(`[data-tpl="${tid}:0:-:rest"]`, 'Tab');
  await p.fill(`[data-tpl="${tid}:0:-:note"]`, 'Bajar controlado'); await p.press(`[data-tpl="${tid}:0:-:note"]`, 'Tab');
  // Segundo ejercicio sin historial, al 70 %
  await p.click('[data-action=tpl-add-ex]');
  await p.fill('#picker-q', 'curl de biceps');
  await p.click('#picker-list [data-action=pick-exercise] >> nth=0');
  await p.waitForSelector(`[data-tpl="${tid}:1:0:pct"]`);
  await p.fill(`[data-tpl="${tid}:1:0:pct"]`, '70'); await p.press(`[data-tpl="${tid}:1:0:pct"]`, 'Tab');
  await p.screenshot({ path: out + '/14editor.png', fullPage: true });

  // ---- Empezar sesión con la tabla ----
  await p.click('[data-action=tpl-start]');
  await p.waitForSelector('[data-ex="1"]');
  const s = await p.evaluate(() => { const ss = currentSession(); return { title: ss.title, sets: ss.exercises[0].sets.map((x) => [x.type, x.w, x.reps, x.rir, x.done]), curl: ss.exercises[1].sets.map((x) => x.w), rt: ss.exercises[0].restTarget }; });
  assert(s.title === 'Pierna A', 'la sesión toma el nombre de la tabla');
  assert(JSON.stringify(s.sets) === JSON.stringify([['C', 62.5, 10, null, false], ['E', 100, 5, 2, false], ['E', 90, 8, 2, false]]),
    'pesos con el 1RM del atleta: 50 % → 62,5 · 5@RIR2 → 100 · 8@RIR2 (73,9 %) → 90 (reps = mínimo del rango): ' + JSON.stringify(s.sets));
  assert(s.curl.every((w) => w === null), 'sin historial: el peso queda vacío');
  assert(await p.isVisible('[data-ex="1"] .target .mismatch'), 'aviso: sin 1RM estimado, escribe el peso');
  const tl = await p.textContent('[data-ex="0"] .target');
  assert(tl.includes('1× Calent. 10 · 50%') && tl.includes('1× 5 @ RIR 2 · 81%*') && tl.includes('1× 8-12 @ RIR 2 · 74%*') && tl.includes('3:00') && tl.includes('Bajar controlado'), 'línea de objetivo: ' + tl.replace(/\s+/g, ' ').trim().slice(0, 160));
  // Planificado no cuenta hasta ✓
  assert(await p.evaluate(() => sessionVolume(currentSession())) === 0, 'series planificadas: no cuentan en el volumen');
  await p.click('[data-action=toggle-done][data-i="0"][data-j="1"]');
  assert(await p.evaluate(() => sessionVolume(currentSession())) === 500, 'al marcar ✓ cuenta: 100 × 5 = 500 kg');
  const left = await p.evaluate(() => (timer.end - Date.now()) / 1000);
  assert(left > 170 && left <= 180, `el cronómetro usa el descanso de la tabla (${Math.round(left)} s)`);
  await p.click('[data-action=timer-stop]');
  assert(await p.evaluate(() => currentSession().exercises[0].sets[1].rest == null), 'el descanso de la tabla no rellena el campo');
  assert((await p.textContent('[data-ex="0"] [data-action=rest-target]')).includes('3:00 (tabla)'), 'el botón ⏱ muestra el descanso de la tabla');
  assert((await p.textContent('#cap-0-0')) === '', 'el calentamiento no muestra %1RM de serie al fallo');
  await (await p.$('[data-ex="0"]')).screenshot({ path: out + '/14session.png' });

  // ---- Añadir desde tabla a una sesión existente ----
  await p.click('[data-action=tpl-choose][data-mode=add]');
  await p.click('#modal [data-action=tpl-use]');
  assert(await p.evaluate(() => currentSession().exercises.length) === 4, 'añadir desde tabla agrega sus ejercicios a la sesión');

  // ---- Guardar sesión como tabla ----
  await p.evaluate(() => { const ss = currentSession(); ss.exercises.splice(2); ss.exercises.push({ id: 'b1', exerciseId: 'bulg', equipment: [], notes: '', sets: [{ type: 'E', w: 30, reps: 10, rpe: 8, done: true }] }); save(true); rerender(); });
  promptAnswer = 'Pierna B';
  await p.click('[data-action=session-menu]');
  await p.click('[data-action=tpl-from-session]');
  await p.waitForSelector('[data-tpl-name]');
  const tb = await p.evaluate(() => tplList().find((t) => t.name === 'Pierna B'));
  assert(tb && tb.exercises.length === 3 && tb.exercises[0].sets[2].reps === '8-12' && tb.exercises[0].rest === 180 && tb.exercises[2].sets[0].reps === '10' && tb.exercises[2].sets[0].rir === 2,
    'guardar como tabla: conserva objetivos, descanso y convierte RPE 8 → RIR 2');

  // ---- Copias de seguridad ----
  assert(await p.evaluate(() => backupData().templates.length) === 2, 'la copia de seguridad incluye las tablas');

  // ---- Otro usuario: tablas compartidas; ejercicio inexistente se crea; sin historial no hay peso ----
  await p.goto('http://localhost:8123/#/users');
  await p.click('[data-action=user-form]:not([data-id])');
  await p.fill('#uf-name', 'Marta'); await p.uncheck('#uf-copy');
  await p.click('[data-action=user-save]');
  await p.goto('http://localhost:8123/#/');
  await p.click('[data-action=tpl-choose][data-mode=new]');
  const names = await p.$$eval('#modal [data-action=tpl-use] b', (x) => x.map((e) => e.textContent));
  assert(names.join() === 'Pierna A,Pierna B', 'las tablas son comunes a todos los usuarios');
  await p.click('#modal [data-action=tpl-use]:has-text("Pierna B")');
  await p.waitForSelector('[data-ex="2"]');
  const m = await p.evaluate(() => ({ created: db.exercises.some((e) => e.name === 'Sentadilla búlgara' && e.primary === 'cuadriceps'), ws: currentSession().exercises.flatMap((e) => e.sets.map((x) => x.w)) }));
  assert(m.created, 'el ejercicio que Marta no tenía se crea en su catálogo, con sus músculos');
  assert(m.ws.every((w) => w == null), 'Marta sin historial: pesos vacíos');
  // Modo sencillo: sin % en el objetivo
  assert(await p.evaluate(() => db.settings.level) === 'simple' && !(await p.textContent('[data-ex="0"] .target')).includes('%'), 'modo sencillo: el objetivo no muestra %');

  // ---- Restaurar una copia con tablas ----
  await p.evaluate(() => { const d = backupData(); d.templates = [{ id: 'r1', name: 'Restaurada', exercises: [] }]; restoreAllData(d, 'de prueba'); });
  assert(await p.evaluate(() => tplList().map((t) => t.name).join()) === 'Restaurada', 'restaurar una copia restaura sus tablas');
  console.log('errors', errs);
  await b.close();
})();
