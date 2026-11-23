// Repaso del modo sencillo: avisos tras la campana, calendario plegable, resumen plegado en la sesión abierta,
// historial corto en la ficha, tarjetas vacías ocultas en Progreso y Ajustes agrupados.
const { chromium, devices } = require('playwright');
const out = process.argv[2] || 'shots';
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8123/');
  const sq = await p.evaluate(() => {
    const sq = db.exercises.find((e) => e.name === 'Sentadilla trasera').id;
    // 8 sesiones «Pierna» terminadas (una por semana) y una abierta hoy con 1 serie
    for (let k = 8; k >= 1; k--) {
      const date = addDays(todayISO(), -7 * k);
      db.sessions.push({ id: 'p' + k, createdAt: date + 'T10', date, startedAt: 1, endedAt: 2, title: 'Pierna', factors: [], exercises: [
        { id: 'e' + k, exerciseId: sq, equipment: [], notes: '', sets: [1, 2, 3].map(() => ({ type: 'E', w: 100 + (8 - k) * 2.5, reps: 5, rir: 2, done: true })) }] });
    }
    db.sessions.push({ id: 'hoy', createdAt: todayISO() + 'T10', date: todayISO(), startedAt: Date.now() - 600e3, title: 'Pierna', factors: [], exercises: [
      { id: 'eh', exerciseId: sq, equipment: [], notes: '', sets: [{ type: 'E', w: 120, reps: 5, rir: 2, done: true }, { type: 'E', w: null, reps: null, rir: null, done: false }] }] });
    save(true); return sq;
  });

  // ---- Calendario ----
  await p.reload(); await p.waitForSelector('.cal');
  assert(await p.isVisible('[data-action=notices]') && !(await p.isVisible('.reminder')), 'avisos recogidos tras la campana');
  assert((await p.$$('.cal .day')).length >= 28, 'calendario del mes completo por defecto');
  await p.click('[data-action=cal-fold]');
  assert((await p.$$('.cal .day')).length === 7 && await p.isVisible('.cal .day.sel'), 'plegado: solo la semana del día elegido');
  const sel0 = await p.evaluate(() => ui.day);
  await p.click('[data-action=week][data-d="-1"]');
  assert(await p.evaluate((d) => ui.day === addDays(d, -7), sel0), '‹ en plegado retrocede una semana');
  await p.click('[data-action=go-today]');
  await p.reload(); await p.waitForSelector('.cal');
  assert((await p.$$('.cal .day')).length === 7, 'el plegado se recuerda al volver a abrir');
  await p.screenshot({ path: out + '/33cal.png' });
  await p.click('[data-action=cal-fold]');
  assert((await p.$$('.cal .day')).length >= 28, 'se despliega de nuevo');
  // Un único botón para tabla o sesión anterior
  assert(!(await p.$('[data-action=repeat-session]')) && !(await p.$('#app [data-action=tpl-choose]')), 'calendario: sin los botones antiguos');
  await p.click('[data-action=start-from]');
  const modal = await p.textContent('#modal');
  assert(modal.includes('Una tabla') && modal.includes('Repetir una sesión'), 'el botón ofrece tabla o repetir');
  await p.click('#modal [data-action=close-modal]');

  // ---- Sesión abierta ----
  await p.goto('http://localhost:8123/#/session/hoy'); await p.waitForSelector('#vol');
  const mini = await p.textContent('.sum-mini');
  assert(!/[▲▼]/.test(mini) && !(await p.$('.sum-mini svg.chart')), 'abierta: resumen plegado sin comparar con sesiones terminadas');
  await p.click('[data-action=sum-open]');
  const full = await p.textContent('#app');
  assert(full.includes('al finalizarla') && full.includes('últimas 8 terminadas'), 'desplegado: aviso y gráfica solo con sesiones terminadas');
  assert(!(await p.$('.daily')), 'la sesión no repite «Datos del día»');
  // Al terminar, comparación completa
  await p.evaluate(() => { currentSession().endedAt = Date.now(); save(true); rerender(); });
  assert(await p.$('[data-action=sum-open]') === null && (await p.textContent('#app')).includes('Variación de volumen frente'), 'terminada: resumen completo con comparación');

  // ---- Ficha del ejercicio ----
  await p.goto(`http://localhost:8123/#/exercise/${sq}`); await p.waitForSelector('h1');
  const hist = () => p.$$eval('a.list-item[href^="#/session/"]', (x) => x.length);
  assert(await hist() === 5, 'historial: las últimas 5');
  await p.click('[data-action=hist-all]');
  assert(await hist() === 9, 'Ver todas: 9');
  assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'la cabecera no se sale de la pantalla');

  // ---- Progreso ----
  await p.goto('http://localhost:8123/#/exercises'); await p.waitForSelector('.mbars');
  const prog = await p.textContent('#app');
  assert(!prog.includes('Pasos y calorías') && !prog.includes('Peso corporal'), 'sin datos no aparecen las tarjetas de pasos ni de peso');

  // ---- Ajustes ----
  await p.goto('http://localhost:8123/#/settings'); await p.waitForSelector('.sgroup');
  const groups = await p.$$eval('.sgroup', (x) => x.map((e) => e.textContent));
  assert(groups.join() === 'Entreno,Tus datos,Acerca de', 'Ajustes en tres grupos: ' + groups.join());
  const hs = await p.$$eval('h2', (x) => x.map((e) => e.textContent.trim()));
  assert(!hs.some((h) => /^(Material|Microciclo|Volumen por músculo|Series efectivas)/.test(h)), 'modo sencillo: sin material ni ajustes avanzados');
  assert(hs.indexOf('Privacidad') > hs.indexOf('Copia de seguridad'), 'versión y privacidad al final');
  await p.evaluate(() => { db.settings.level = 'advanced'; save(true); rerender(); });
  const hs2 = await p.$$eval('h2', (x) => x.map((e) => e.textContent.trim()));
  assert(hs2.includes('Material') && hs2.some((h) => h.startsWith('Microciclo')) && hs2.includes('Volumen por músculo') && hs2.some((h) => h.startsWith('Series efectivas')), 'modo avanzado: vuelven a aparecer (Microciclo, Volumen por músculo…)');

  assert(!errs.length, 'sin errores: ' + errs.join(' | '));
  await b.close();
})();
