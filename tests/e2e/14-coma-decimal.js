const { chromium, devices } = require('playwright');
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ ...devices['iPhone 13'], locale: 'en-US' })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8123/');
  await p.evaluate(() => { db.settings.level = 'simple'; const sq = db.exercises.find((e) => e.name === 'Sentadilla trasera').id; const iso = todayISO();
    db.sessions.push({ id: 's1', createdAt: iso + 'T10', date: iso, startedAt: Date.now(), title: 'P', factors: [], exercises: [{ id: 'x1', exerciseId: sq, equipment: [], notes: '', sets: [{ type: 'E', w: 102.5, reps: 5, rir: 2 }, { type: 'E', w: null, reps: null }] }] });
    save(true); location.hash = '#/session/s1'; });
  await p.waitForSelector('[data-set="0:0:w"]');
  assert(await p.inputValue('[data-set="0:0:w"]') === '102,5', 'peso guardado 102.5 se muestra 102,5 (navegador en inglés)');
  assert(await p.getAttribute('[data-set="0:0:w"]', 'inputmode') === 'decimal' && await p.getAttribute('[data-set="0:0:reps"]', 'inputmode') === 'numeric', 'teclado decimal en kg, numérico en reps');
  await p.fill('[data-set="0:1:w"]', '97,5'); await p.press('[data-set="0:1:w"]', 'Tab');
  assert(await p.evaluate(() => currentSession().exercises[0].sets[1].w) === 97.5, 'escribir 97,5 guarda 97.5');
  await p.fill('[data-set="0:1:w"]', '95.5'); await p.press('[data-set="0:1:w"]', 'Tab');
  assert(await p.evaluate(() => currentSession().exercises[0].sets[1].w) === 95.5 && await p.inputValue('[data-set="0:1:w"]') === '95,5', 'escribir 95.5 con punto: guarda 95.5 y se muestra 95,5');
  await p.fill('[data-set="0:1:reps"]', '8'); await p.press('[data-set="0:1:reps"]', 'Tab');
  assert(await p.evaluate(() => currentSession().exercises[0].sets[1].reps) === 8, 'reps 8');
  assert(await p.evaluate(() => sessionVolume(currentSession())) === 102.5 * 5 + 95.5 * 8, 'el volumen usa los valores con coma');
  await p.fill('[data-set="0:1:w"]', 'abc'); await p.press('[data-set="0:1:w"]', 'Tab');
  assert(await p.$eval('[data-set="0:1:w"]', (e) => e.classList.contains('bad')), 'texto no numérico se marca en rojo');
  await p.fill('[data-set="0:1:w"]', '100'); await p.press('[data-set="0:1:w"]', 'Tab');
  assert(!(await p.$eval('[data-set="0:1:w"]', (e) => e.classList.contains('bad'))), 'al corregirlo se quita la marca');
  // separación fecha / primera tarjeta
  const gap = await p.evaluate(() => document.querySelector('.ex-card, [data-ex="0"]').getBoundingClientRect().top - document.querySelector('[data-s="date"]').getBoundingClientRect().bottom);
  assert(gap >= 10, 'modo sencillo: la tarjeta no toca la fecha (separación ' + Math.round(gap) + ' px)');
  // modo avanzado: peso corporal con coma
  await p.evaluate(() => { db.settings.level = 'advanced'; ui.preOpen.s1 = true; rerender(); });
  await p.fill('[data-s="bodyweight"]', '80,4'); await p.press('[data-s="bodyweight"]', 'Tab');
  assert(await p.evaluate(() => currentSession().bodyweight) === 80.4, 'peso corporal 80,4');
  console.log('errors', errs); await b.close();
})();
