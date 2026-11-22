const { chromium, devices } = require('playwright');
const out = process.argv[2] || 'shots';
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const fresh = async () => { const p = await (await b.newContext({ ...devices['iPhone 13'], welcome: true })).newPage(); p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept()); await p.goto('http://localhost:8123/'); return p; };
  // ---- Primer arranque: rellenar ----
  let p = await fresh();
  await p.waitForSelector('#modal[open] .welcome');
  assert(true, 'primer arranque: aparece la ventana de bienvenida');
  await (await p.$('#modal')).screenshot({ path: out + '/28welcome.png' });
  await p.click('[data-action=welcome-save]');
  assert(await p.isVisible('#modal[open] .welcome') && await p.$eval('#uf-name', (e) => e.classList.contains('bad')), 'sin nombre no avanza y lo marca');
  await p.fill('#uf-name', 'Marta'); await p.fill('#pf-birth', '1994-05-10'); await p.selectOption('#pf-sex', 'f');
  await p.fill('#pf-height', '168'); await p.fill('#pf-weight', '62,5'); await p.selectOption('#pf-exp', 'inter');
  await p.fill('#uf-goal', 'Hipertrofia'); await p.selectOption('#pf-level', 'advanced');
  await p.fill('#pf-height', '400'); await p.click('[data-action=welcome-save]');
  assert(await p.isVisible('#modal[open] .welcome'), 'altura imposible (400 cm): no se guarda');
  await p.fill('#pf-height', '168'); await p.click('[data-action=welcome-save]');
  const st = await p.evaluate(() => ({ u: activeUser(), bw: db.bodyweights, lvl: db.settings.level, flag: localStorage.getItem('diario-entreno.bienvenida') }));
  assert(st.u.name === 'Marta' && st.u.birth === '1994-05-10' && st.u.sex === 'f' && st.u.height === 168 && st.u.experience === 'inter' && st.u.goal === 'Hipertrofia', 'perfil guardado: Marta, 10/05/1994, mujer, 168 cm, 1-3 años, hipertrofia');
  assert(st.bw.length === 1 && st.bw[0].v === 62.5 && st.lvl === 'advanced' && st.flag === '1', 'peso 62,5 al registro de peso, modo avanzado, bienvenida marcada');
  await p.reload(); await p.waitForSelector('.cal');
  assert(!(await p.isVisible('#modal[open]')), 'al volver a abrir ya no aparece');
  await p.goto('http://localhost:8123/#/users');
  assert((await p.textContent('.active-user')).includes('32 años · 168 cm · De 1 a 3 años entrenando'), 'Usuarios muestra edad, altura y experiencia');
  // Editar
  await p.click('.active-user [data-action=user-form]');
  assert(await p.inputValue('#pf-birth') === '1994-05-10' && await p.inputValue('#pf-height') === '168' && !(await p.$('#pf-weight')), 'editar: campos rellenos (sin peso: va en su registro)');
  await p.fill('#pf-height', '169'); await p.click('[data-action=user-save]');
  assert(await p.evaluate(() => activeUser().height) === 169, 'editar la altura');
  // Nuevo usuario con peso
  await p.click('[data-action=user-form]:not([data-id])');
  await p.fill('#uf-name', 'Pablo'); await p.fill('#pf-weight', '81'); await p.fill('#pf-birth', '2000-12-01');
  await p.click('[data-action=user-save]');
  assert(await p.evaluate(() => activeUser().name === 'Pablo' && ageOf(activeUser().birth) === 25 && db.bodyweights[0].v === 81), 'nuevo usuario desde Usuarios con fecha y peso (25 años, 81 kg)');
  // ---- Primer arranque: «Ahora no» ----
  p = await fresh(); await p.waitForSelector('#modal[open] .welcome');
  await p.click('[data-action=welcome-skip]');
  await p.reload(); await p.waitForSelector('.cal');
  assert(!(await p.isVisible('#modal[open]')) && await p.evaluate(() => activeUser().name) === 'Yo', '«Ahora no»: no vuelve a salir y el perfil queda como «Yo»');
  // ---- Instalación con datos (versión anterior): no aparece ----
  p = await fresh(); await p.waitForSelector('#modal[open] .welcome');
  await p.evaluate(() => { localStorage.removeItem('diario-entreno.bienvenida'); db.sessions.push({ id: 'x', createdAt: todayISO() + 'T10', date: todayISO(), startedAt: 1, title: 'x', factors: [], exercises: [] }); save(true); });
  await p.reload(); await p.waitForSelector('.cal');
  assert(!(await p.isVisible('#modal[open]')), 'si ya hay sesiones (actualización de la app), no se muestra');
  console.log('errors', errs); await b.close();
})();
