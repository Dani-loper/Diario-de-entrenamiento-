// Lumbar separado de espalda (v4): migración de datos de la v3, barras sin referencia, figura del cuerpo y referencia propia.
const { chromium, devices } = require('playwright');
const out = process.argv[2] || 'shots';
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8123/');
  // Datos de la v3: catálogo como era, un peso muerto cambiado por el atleta y dos ejercicios propios
  await p.evaluate(() => {
    const d = JSON.parse(JSON.stringify(db));
    d.musclesV = 3;
    d.exercises = d.exercises.filter((e) => e.name !== 'Extensión lumbar en máquina');
    const set = (n, primary, sw) => { const e = d.exercises.find((x) => x.name === n); e.primary = primary; e.secondary = Object.keys(sw); e.sw = { ...sw }; return e; };
    for (const [n, [pr, sw]] of Object.entries(LEGACY_MUSCLES_V3)) set(n, pr, sw);
    set('Peso muerto', 'gluteos', { femoral: 0.75, espalda: 0.5 }); // cambiado por el atleta
    d.exercises.push({ id: 'own1', name: 'Pull-through en polea', primary: 'gluteos', secondary: ['espalda'], sw: { espalda: 0.25 }, mode: 'wr' });
    d.exercises.push({ id: 'own2', name: 'Remo Meadows', primary: 'espalda', secondary: ['biceps'], sw: { biceps: 0.5 }, mode: 'wr' });
    const sq = d.exercises.find((x) => x.name === 'Sentadilla trasera').id;
    d.sessions = [{ id: 's1', createdAt: todayISO() + 'T10', date: todayISO(), startedAt: 1, endedAt: 2, title: 'Pierna', factors: [], exercises: [{ id: 'e1', exerciseId: sq, equipment: [], notes: '', sets: [1, 2, 3, 4].map(() => ({ type: 'E', w: 100, reps: 5, rir: 2, done: true })) }] }];
    db = d; save(true); // al recargar se cargan y migran
  });
  await p.reload(); await p.waitForFunction(() => window.__appReady === true);
  const m = await p.evaluate(() => {
    const ex = (n) => db.exercises.find((e) => e.name === n);
    return { v: db.musclesV, sq: ex('Sentadilla trasera'), hip: ex('Hiperextensiones'), pm: ex('Peso muerto'), own1: ex('Pull-through en polea'), own2: ex('Remo Meadows'), ext: ex('Extensión lumbar en máquina'), pull: ex('Tirón de arrancada') };
  });
  assert(m.v === 4, 'datos actualizados a la v4');
  assert(m.sq.sw.lumbar === 0.25 && !m.sq.sw.espalda && !m.sq.reviewMuscles, 'sentadilla sin cambios del atleta: espalda ¼ pasa a lumbar ¼');
  assert(m.hip.primary === 'lumbar' && m.pull.primary === 'lumbar', 'hiperextensiones y tirones: lumbar como principal');
  assert(m.pm.sw.femoral === 0.75 && m.pm.sw.espalda === 0.5 && m.pm.reviewMuscles, 'peso muerto cambiado por el atleta: se respeta y se marca para revisar');
  assert(m.own1.reviewMuscles && !m.own2.reviewMuscles, 'propios: el de cadera con «espalda» se marca; el remo no');
  assert(m.ext && m.ext.primary === 'lumbar', 'se añade «Extensión lumbar en máquina» al catálogo');
  // Usuario nuevo: catálogo ya en la v4
  assert(await p.evaluate(() => { const s = seed(); return s.musclesV === 4 && !s.exercises.some((e) => ['Sentadilla trasera', 'Peso muerto', 'Buenos días'].includes(e.name) && e.secondary.includes('espalda')); }), 'usuario nuevo: catálogo v4');

  // Progreso: lumbar sin referencia, solo recuento
  await p.goto('http://localhost:8123/#/exercises'); await p.waitForSelector('.mbars');
  const bar = await p.evaluate(() => { const b = document.querySelector('.mbar[data-m=lumbar]'); return { v: b.querySelector('.mb-v').textContent.trim(), z: b.querySelector('.mb-h').className, seg: b.querySelectorAll('.mb-seg').length, label: b.getAttribute('aria-label') }; });
  assert(bar.v === '1' && bar.z.includes('z-none') && bar.seg === 0 && bar.label.endsWith('sin referencia'), 'barra de lumbar: 4 × ¼ = 1, gris y sin zonas: ' + JSON.stringify(bar));
  assert(await p.evaluate(() => document.querySelector('.mbar[data-m=espalda] .mb-v').textContent.trim()) === '0', 'espalda: 0 (la sentadilla ya no suma a espalda)');
  await p.click('.mbar[data-m=lumbar]');
  assert((await p.textContent('.ptrend')).includes('Sin referencia') && !(await p.$('.ptrend .band')), 'detalle de lumbar sin franja de referencia');
  await (await p.$('.card:has(.mbars)')).screenshot({ path: out + '/37lumbar.png' });
  // Figura del cuerpo: zona lumbar
  await p.goto('http://localhost:8123/#/session/s1'); await p.waitForSelector('.body-fig');
  assert(await p.evaluate(() => document.querySelector('.body-fig .mz[data-m=lumbar] title').textContent) === 'Lumbar: 1', 'figura posterior: zona lumbar con su valor');
  // Referencia propia en Ajustes (modo avanzado)
  await p.evaluate(() => { db.settings.level = 'advanced'; save(true); });
  await p.goto('http://localhost:8123/#/settings'); await p.click('.lm-edit summary');
  assert(await p.inputValue('[data-lm="lumbar:0"]') === '' && (await p.textContent('.lm-table')).includes('sin referencia'), 'editor: lumbar vacío, «sin referencia»');
  for (const [i, v] of [[0, '0'], [1, '2'], [2, '4'], [3, '8']]) { await p.fill(`[data-lm="lumbar:${i}"]`, v); await p.press(`[data-lm="lumbar:${i}"]`, 'Tab'); }
  assert(await p.evaluate(() => !db.settings.landmarks?.lumbar), 'con 4 de 5 cifras todavía no se guarda');
  await p.fill('[data-lm="lumbar:4"]', '12'); await p.press('[data-lm="lumbar:4"]', 'Tab');
  assert(JSON.stringify(await p.evaluate(() => db.settings.landmarks.lumbar)) === '[0,2,4,8,12]', 'con las cinco cifras se guarda la referencia propia');
  await p.goto('http://localhost:8123/#/exercises'); await p.waitForSelector('.mbars');
  assert(await p.$eval('.mbar[data-m=lumbar] .mb-h', (e) => e.classList.contains('z-maint')), 'con referencia propia (MEV 2), lumbar 1 → mantenimiento');
  assert(!errs.length, 'sin errores: ' + errs.join(' | '));
  await b.close();
})();
