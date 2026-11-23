const { chromium, devices } = require('playwright');
const out = process.argv[2] || 'shots';
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8123/');
  const ids = await p.evaluate(() => {
    const sq = db.exercises.find((e) => e.name === 'Sentadilla trasera').id, bp = db.exercises.find((e) => e.name === 'Press banca').id;
    const S = (id, date, ex) => db.sessions.push({ id, createdAt: date + 'T10', date, startedAt: 1, endedAt: 2, title: 'x', factors: [], exercises: ex });
    // 6 sesiones: sentadilla 100 kg (4 veces: 5@RIR1, 6@RIR1, 6@RIR2, 7@RIR2) y 110 kg (2 veces)
    const plan = [[100, 5, 1], [110, 3, 1], [100, 6, 1], [100, 6, 2], [110, 4, 1], [100, 7, 2]];
    plan.forEach(([w, r, rir], k) => S('s' + k, addDays(todayISO(), -(30 - k * 5)), [
      { id: 'a' + k, exerciseId: sq, equipment: [], notes: '', sets: [{ type: 'E', w, reps: r, rir, done: true }] },
      { id: 'b' + k, exerciseId: bp, equipment: [], notes: '', sets: [{ type: 'E', w: 70, reps: 8, rir: 2, done: true }] }]));
    save(true); return { sq, bp };
  });
  // ---- Mismo peso ----
  await p.goto(`http://localhost:8123/#/exercise/${ids.sq}`);
  await p.waitForSelector('[data-action=same-w]');
  const chips = await p.$$eval('[data-action=same-w]', (x) => x.map((e) => e.dataset.w));
  assert(chips.join() === '100,110', 'pesos usados en ≥ 2 sesiones: 100 y 110');
  assert(await p.$eval('[data-action=same-w].on', (e) => e.dataset.w) === '100', 'por defecto, el más frecuente: 100 kg');
  const txt = await p.textContent('h2:has-text("Con el mismo peso") + .card');
  assert(txt.includes('(+3 reps)'), 'con 100 kg: de 5@RIR1 (6) a 7@RIR2 (9) = +3 reps: ' + txt.replace(/\s+/g, ' ').slice(0, 160));
  await p.$eval('[data-action=same-w][data-w="110"]', (e) => e.scrollIntoView({ block: 'center' }));
  await p.click('[data-action=same-w][data-w="110"]', { force: true });
  assert((await p.textContent('h2:has-text("Con el mismo peso") + .card')).includes('(+1 reps)'), 'con 110 kg: +1');
  await (await p.$('h2:has-text("Con el mismo peso") + .card')).screenshot({ path: out + '/17same.png' });
  // ---- Favoritos ----
  await p.evaluate(() => scrollTo(0, 0));
  await p.click(`.fav[data-id="${ids.sq}"]`);
  assert(await p.evaluate((id) => exById(id).fav, ids.sq), 'marcar sentadilla como favorita desde su ficha');
  await p.click('.tabbar a[data-tab=records]');
  await p.waitForSelector('.hof');
  assert((await p.textContent('.hof')).includes('Sentadilla'), 'favoritos primero en Récords');
  await p.click('[data-action=hof-filter][data-v=fav]');
  assert(await p.$$eval('.hof', (x) => x.length) === 1, 'filtro favoritos: solo 1');
  await p.click('[data-action=hof-filter][data-v=video]');
  assert((await p.textContent('#app')).includes('Ningún'), 'favoritos + vídeo combinados: ninguno');
  await p.click('[data-action=hof-filter][data-v=all]');
  assert(await p.$$eval('.hof', (x) => x.length) === 2, 'Todos: 2');
  await p.$eval(`.hof .fav[data-id="${ids.bp}"]`, (e) => e.scrollIntoView({ block: 'center' }));
  await p.click(`.hof .fav[data-id="${ids.bp}"]`, { force: true });
  assert(await p.evaluate((id) => exById(id).fav, ids.bp), 'marcar favorito desde Récords');
  await p.screenshot({ path: out + '/17hof.png' });
  // ---- Lista de Progreso: solo usados ----
  await p.goto('http://localhost:8123/#/exercises');
  await p.waitForSelector('[data-action=show-all-ex]');
  const n1 = await p.$$eval('a.list-item[href^="#/exercise/"]', (x) => x.length);
  assert(n1 === 2, 'Progreso: solo los 2 ejercicios usados: ' + n1);
  await p.$eval('[data-action=show-all-ex]', (e) => e.scrollIntoView({ block: 'center' }));
  await p.click('[data-action=show-all-ex]', { force: true });
  assert(await p.$$eval('a.list-item[href^="#/exercise/"]', (x) => x.length) > 20, 'ver todos');
  await p.fill('[data-action-input=search]', 'curl');
  assert(await p.$$eval('a.list-item[href^="#/exercise/"]', (x) => x.length) >= 1, 'buscar muestra también los no usados');
  // ---- Semana del atleta ----
  const w0 = await p.evaluate(() => [weekStart('2026-11-22'), weekStart('2026-11-16')]);
  assert(w0.join() === '2026-11-16,2026-11-16', 'por defecto: lunes (domingo 22 → lunes 16)');
  await p.goto('http://localhost:8123/#/settings');
  assert(!(await p.$('[data-setting=weekDow]')), 'modo sencillo: la semana del atleta no aparece en Ajustes');
  await p.evaluate(() => { db.settings.level = 'advanced'; save(true); rerender(); });
  await p.selectOption('[data-setting=weekDow]', '6');
  const w1 = await p.evaluate(() => [weekStart('2026-11-22'), weekStart('2026-11-20'), weekEnd(weekStart('2026-11-22'))]);
  assert(w1.join() === '2026-11-21,2026-11-14,2026-11-27', 'semana de sábado a viernes: ' + w1.join());
  await p.goto('http://localhost:8123/#/');
  assert((await p.$$eval('.cal .dow', (x) => x.map((e) => e.textContent).join(''))) === 'SDLMXJV', 'el calendario empieza en sábado');
  await p.goto('http://localhost:8123/#/settings');
  await p.selectOption('[data-setting=weekLen]', '10');
  await p.waitForSelector('[data-setting-str=cycleAnchor]');
  await p.fill('[data-setting-str=cycleAnchor]', '2026-11-01'); await p.dispatchEvent('[data-setting-str=cycleAnchor]', 'input');
  const w2 = await p.evaluate(() => [weekStart('2026-11-22'), weekStart('2026-10-31'), weekEnd(weekStart('2026-11-22')), lastWeeks(3).join('|')]);
  assert(w2.join() === '2026-11-21,2026-10-22,2026-11-30,2026-11-01|2026-11-11|2026-11-21', 'microciclo de 10 días desde el 1/11: ' + w2.join());
  assert((await p.textContent('#app')).includes('Ciclo actual'), 'Ajustes muestra el ciclo actual');
  await (await p.$('.card:has([data-setting=weekLen])')).screenshot({ path: out + '/17week.png' });
  await p.goto('http://localhost:8123/#/exercises');
  await p.waitForSelector('.heat');
  assert(await p.$eval('.heat', (e) => e.viewBox.baseVal.height) === 10 * 13, 'constancia: 10 filas (días del ciclo)');
  const sub = await p.textContent('.card:has(.mbars) .muted');
  assert(sub.includes('Últimos 10 días') && await p.evaluate(() => landmarksOf('cuadriceps').mrv) === 28.6, 'series por músculo: 10 días y referencias escaladas (MRV cuádriceps 20 → 28,6): ' + sub.replace(/\s+/g, ' ').trim());
  // Volver al valor por defecto
  await p.goto('http://localhost:8123/#/settings');
  await p.selectOption('[data-setting=weekLen]', '7');
  await p.selectOption('[data-setting=weekDow]', '1');
  assert(await p.evaluate(() => weekStart('2026-11-22')) === '2026-11-16', 'volver a lunes-domingo');
  console.log('errors', errs); await b.close();
})();
