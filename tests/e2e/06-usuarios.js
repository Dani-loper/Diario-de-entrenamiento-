const { chromium, devices } = require('playwright');
const fs = require('fs');
const out = process.argv[2];
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ ...devices['Pixel 7'], acceptDownloads: true });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  let promptAnswer = '';
  p.on('dialog', (d) => d.type() === 'prompt' ? d.accept(promptAnswer) : d.accept());

  // Datos de la versión anterior (sin usuarios)
  await p.goto('http://localhost:8123/');
  await p.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('diario-entreno.v1', JSON.stringify({ version: 1, exercises: [{ id: 'x1', name: 'Sentadilla trasera', cat: 'Pierna', mode: 'wr' }], equipment: [], settings: { rest: 90 },
      sessions: [{ id: 'old1', createdAt: '2026-11-01T10:00', date: '2026-11-01', startedAt: 1, endedAt: 2, title: 'Antigua', exercises: [] }] }));
  });
  await p.reload();
  const mig = await p.evaluate(() => ({ users: profiles.users.map((u) => u.name), n: db.sessions.length, title: db.sessions[0]?.title, rest: db.settings.rest }));
  assert(mig.users.join() === 'Yo' && mig.n === 1 && mig.title === 'Antigua' && mig.rest === 90, 'migra los datos antiguos al usuario «Yo»');
  assert(await p.isVisible('.userchip'), 'barra con el usuario activo');

  // Crear usuario copiando catálogo
  await p.click('.userchip');
  await p.click('[data-action=user-form]:not([data-id])');
  await p.fill('#uf-name', 'Laura García');
  await p.fill('#uf-goal', 'Competir en -63 kg');
  await p.click('[data-action=user-save]');
  let st = await p.evaluate(() => ({ active: activeUser().name, n: db.sessions.length, ex: db.exercises.map((e) => e.name).join(), hash: location.hash }));
  assert(st.active === 'Laura García' && st.n === 0 && st.ex === 'Sentadilla trasera,Elevación de gemelos,Elevaciones laterales,Pájaros', 'crea a Laura, la activa, sin sesiones y con el catálogo copiado: ' + st.ex);
  assert((await p.textContent('.userchip')).includes('Laura'), 'la barra muestra a Laura');

  // Sesión de Laura
  await p.click('[data-action=new-session]');
  await p.fill('[data-s=title]', 'Sesión de Laura');
  await p.goto('http://localhost:8123/#/users');
  await p.screenshot({ path: out + '/6users.png', fullPage: true });
  await p.click('[data-action=user-switch]');
  st = await p.evaluate(() => ({ active: activeUser().name, titles: db.sessions.map((s) => s.title).join() }));
  assert(st.active === 'Yo' && st.titles === 'Antigua', 'al volver a «Yo» solo están sus sesiones');
  await p.reload();
  assert(await p.evaluate(() => activeUser().name) === 'Yo', 'el usuario activo se conserva al recargar');
  await p.goto('http://localhost:8123/#/users');
  await p.click('[data-action=user-switch]');
  assert(await p.evaluate(() => db.sessions.map((s) => s.title).join()) === 'Sesión de Laura', 'Laura conserva su sesión');

  // Editar
  await p.goto('http://localhost:8123/#/users');
  await p.click('[data-action=user-form][data-id] >> nth=0');
  await p.fill('#uf-name', 'Laura G.');
  await p.click('[data-action=user-save]');
  assert(await p.evaluate(() => profiles.users.some((u) => u.name === 'Laura G.')), 'renombra al usuario');

  // Exportar todos
  await p.goto('http://localhost:8123/#/settings');
  await p.click('[data-action=export-all]');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#modal a[download]')]);
  const file = out + '/todos.json';
  await dl.saveAs(file);
  const dump = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert(dump.type === 'diario-entreno-todos' && dump.profiles.users.length === 2 && Object.values(dump.data).every(Boolean), 'copia de todos con 2 usuarios y sus datos');

  // Borrar: nombre incorrecto no borra; correcto sí
  await p.goto('http://localhost:8123/#/users');
  promptAnswer = 'otra persona';
  await p.click('[data-action=user-delete] >> nth=0');
  assert(await p.evaluate(() => profiles.users.length) === 2, 'con el nombre mal escrito no se borra');
  const target = await p.evaluate(() => profiles.users.find((u) => u.id !== profiles.active).name);
  promptAnswer = target;
  await p.click(`[data-action=user-delete][aria-label="Borrar ${target}"]`);
  assert(await p.evaluate(() => profiles.users.length) === 1, 'borra al usuario al escribir su nombre');
  assert(!(await p.$('[data-action=user-delete]')), 'no se puede borrar el último usuario');

  // Restaurar todos
  await p.goto('http://localhost:8123/#/settings');
  await p.setInputFiles('#import-file', file);
  await p.waitForFunction(() => profiles.users.length === 2);
  const rest = await p.evaluate(() => profiles.users.map((u) => u.name).sort().join());
  assert(rest === 'Laura G.,Yo', 'restaura los dos usuarios: ' + rest);
  const sessions = await p.evaluate(() => profiles.users.map((u) => (u.id === profiles.active ? db : readUserData(u.id)).sessions.length).join());
  assert(sessions.split(',').map(Number).sort().join() === '1,1', 'con sus sesiones');
  const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert(sw <= 0, 'sin scroll horizontal');
  await p.goto('http://localhost:8123/#/');
  await p.screenshot({ path: out + '/6cal.png' });
  console.log('errors', errs);
  await b.close();
})();
