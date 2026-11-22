const { chromium, devices } = require('playwright');
const out = process.argv[2];
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ ...devices['Pixel 7'] });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', (d) => d.accept());

  // Datos antiguos (categorías) -> migración
  await p.goto('http://localhost:8123/');
  await p.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('diario-entreno.v1', JSON.stringify({ version: 1, settings: {}, equipment: [], sessions: [],
      exercises: [{ id: 'pb', name: 'Press banca', cat: 'Empuje', mode: 'wr' }, { id: 'sb', name: 'Sentadilla Zercher', cat: 'Pierna', mode: 'wr' }, { id: 'cr', name: 'Carrera', cat: 'Cardio', mode: 'dist' }] }));
  });
  await p.reload();
  const mig = await p.evaluate(() => db.exercises.map((e) => [e.name, e.primary, (e.secondary || []).join('+'), !!e.reviewMuscles, 'cat' in e]));
  assert(JSON.stringify(mig.slice(0, 6)) === JSON.stringify([['Press banca', 'pectoral', 'triceps+delt_ant', false, false], ['Sentadilla Zercher', 'cuadriceps', '', true, false], ['Carrera', null, '', false, false], ['Elevación de gemelos', 'gemelos', '', false, false], ['Elevaciones laterales', 'delt_lat', '', false, false], ['Pájaros', 'delt_post', 'trapecio', false, false]]),
    'migración: los por defecto reciben sus músculos; los propios, principal según la categoría antigua y marcados para revisar');
  await p.goto('http://localhost:8123/#/exercises');
  assert(await p.isVisible('[data-action=review-muscles]'), 'aviso para revisar ejercicios propios');
  await p.click('[data-action=review-muscles]');
  assert((await p.inputValue('#ef-name')) === 'Sentadilla Zercher', 'abre el ejercicio a revisar');
  await p.selectOption('#ef-cat', 'cuadriceps');
  assert(await p.isHidden('#ef-sec [data-m=cuadriceps]'), 'el principal no aparece entre los secundarios');
  await p.click('#ef-sec [data-m=gluteos]'); await p.click('#ef-sec [data-m=femoral]');
  await p.selectOption('#ef-cat', 'gluteos');
  assert(await p.isHidden('#ef-sec [data-m=gluteos]'), 'al cambiar el principal se oculta de los secundarios');
  await p.click('[data-action=save-exercise]');
  const sb = await p.evaluate(() => { const e = db.exercises.find((x) => x.name === 'Sentadilla Zercher'); return [e.primary, e.secondary.join('+'), !!e.reviewMuscles]; });
  assert(JSON.stringify(sb) === JSON.stringify(['gluteos', 'femoral', false]), 'guarda principal y varios secundarios (sin duplicar el principal): ' + sb);
  await p.goto('http://localhost:8123/#/exercises');
  assert(!(await p.isVisible('[data-action=review-muscles]')), 'tras revisar, desaparece el aviso');

  // Catálogo nuevo (usuario nuevo)
  await p.evaluate(() => { localStorage.clear(); });
  await p.reload();
  await p.evaluate(() => { db.settings.level = 'advanced'; save(true); rerender(); });
  const seedOk = await p.evaluate(() => db.exercises.every((e) => 'primary' in e && Array.isArray(e.secondary) && (e.primary === null || MUSCLES[e.primary])) && db.exercises.filter((e) => e.primary === null).length === 9 && db.exercises.some((e) => e.primary === 'gemelos'));
  assert(seedOk, 'catálogo por defecto: todos con músculos válidos; 9 sin músculo (cardio y burpees)');

  // Sesión: 4 series de press banca y 3 de curl femoral
  await p.goto('http://localhost:8123/#/');
  await p.click('[data-action=new-session]');
  for (const [name, n] of [['press banca', 4], ['curl femoral', 3]]) {
    await p.click('[data-action=add-exercise]');
    await p.fill('#picker-q', name);
    await p.click('#picker-list [data-action=pick-exercise] >> nth=0');
    const i = (await p.$$('[data-ex]')).length - 1;
    await p.fill(`[data-set="${i}:0:w"]`, '40'); await p.fill(`[data-set="${i}:0:reps"]`, '10');
    for (let k = 1; k < n; k++) await p.click(`[data-action=add-set][data-i="${i}"]`);
  }
  const acc = await p.evaluate(() => sessionMuscles(currentSession()));
  assert(JSON.stringify(acc) === JSON.stringify({ pectoral: 4, triceps: 2, delt_ant: 2, femoral: 3, gemelos: 0.75 }), 'volumen fraccionado: ' + JSON.stringify(acc));
  const lv = await p.evaluate(() => Object.fromEntries(['pectoral', 'triceps', 'femoral', 'gemelos', 'biceps'].map((m) => [m, document.querySelector(`.mz[data-m=${m}]`).className.baseVal.match(/m(\d)/)[1]])));
  assert(JSON.stringify(lv) === JSON.stringify({ pectoral: '3', triceps: '2', femoral: '2', gemelos: '1', biceps: '0' }), 'niveles de color: ' + JSON.stringify(lv));
  const tip = await p.textContent('.mz[data-m=pectoral] title');
  assert(tip === 'Pectoral: 4', 'cada zona tiene su valor accesible');
  const block = await p.$('h3:has-text("Músculos trabajados")');
  await block.scrollIntoViewIfNeeded();
  const box = await p.evaluate(() => { const h = [...document.querySelectorAll('h3')].find((x) => x.textContent.includes('Músculos trabajados')); const r = h.getBoundingClientRect(); return { y: r.top + scrollY }; });
  await p.screenshot({ path: out + '/11session.png', clip: { x: 0, y: box.y - 10, width: 412, height: 560 }, fullPage: true });
  // Selector agrupado por músculo
  await p.click('[data-action=add-exercise]');
  const groups = await p.$$eval('.picker-cat', (x) => x.map((e) => e.textContent));
  assert(groups[0] === 'Pectoral' && groups.at(-1) === 'Sin músculo (cardio y otros)' && groups.length === 16, 'selector agrupado por músculo: ' + groups.join(', '));
  await p.click('#modal [data-action=close-modal]');
  // Modo índice de estrés: reparto del IE
  await p.click('[data-action=cycle-system]');
  await p.evaluate(() => { for (const e of currentSession().exercises) for (const x of e.sets) x.rir = 2; save(true); rerender(); });
  const si = await p.evaluate(() => sessionMuscles(currentSession()));
  assert(Math.abs(si.pectoral - 4) < 1e-9 && Math.abs(si.triceps - 2) < 1e-9 && Math.abs(si.femoral - 3 * 0.9) < 1e-9, 'en modo IE reparte el índice de estrés: ' + JSON.stringify(si));
  // Búsqueda por músculo
  await p.click('[data-action=finish-session]');
  await p.goto('http://localhost:8123/#/');
  await p.fill('[data-action-input=csearch]', 'triceps');
  assert(await p.isVisible('.list-item'), 'el buscador encuentra sesiones por músculo');
  // Carga semanal: figura de la última semana completa
  await p.evaluate(() => {
    const id = (n) => db.exercises.find((e) => e.name === n).id;
    const d = new Date(); d.setDate(d.getDate() - 7);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    db.sessions.push({ id: 'w1', createdAt: iso + 'T10', date: iso, startedAt: 1, endedAt: 2, title: 'X', factors: [], exercises: [
      ['Sentadilla trasera', 12], ['Press banca', 10], ['Dominadas', 16], ['Hip thrust', 6], ['Curl de bíceps', 4], ['Plancha', 3]].map(([n, k], j) => ({ id: 'e' + j, exerciseId: id(n), equipment: [], notes: '', sets: Array.from({ length: k }, () => ({ type: 'E', w: 50, reps: 8, time: 30, rir: 2 })) })) });
    save(true);
  });
  await p.goto('http://localhost:8123/#/analysis');
  await p.click('[data-action=atab][data-t=load]');
  assert(await p.isVisible('.body-map'), 'Análisis → Carga: figura de la última semana completa');
  const fig = await p.$('h2:has-text("Músculos ·") + .card');
  await fig.screenshot({ path: out + '/11week.png' });
  await p.emulateMedia({ colorScheme: 'dark' });
  await fig.screenshot({ path: out + '/11week-dark.png' });
  console.log('errors', errs);
  await b.close();
})();
