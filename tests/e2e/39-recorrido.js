// Recorrido de primeros pasos: calendario (tras la bienvenida), sesión vacía y primera serie; repetir desde Ajustes.
const { chromium, devices } = require('playwright');
const out = process.argv[2] || 'shots';
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const tip = (p) => p.evaluate(() => { const t = document.querySelector('#tour .tour-tip'); return t ? { n: t.querySelector('.tour-count').textContent, title: t.querySelector('b').textContent, text: t.querySelector('p').textContent } : null; });
  const seen = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('diario-entreno.recorrido') || 'null'));

  // ---- Primera vez: bienvenida y después el recorrido ----
  let p = await (await b.newContext({ ...devices['iPhone 13'], welcome: true, tour: true })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8123/');
  await p.waitForSelector('#modal[open] [data-action=welcome-skip]');
  await p.waitForTimeout(200);
  assert(!(await p.$('#tour')), 'con la bienvenida abierta no empieza el recorrido');
  await p.click('[data-action=welcome-skip]');
  await p.waitForSelector('#tour');
  let t = await tip(p);
  assert(t.n === '1 de 7' && t.title === 'Calendario', 'después de la bienvenida: recorrido del calendario, 7 pasos');
  const hole = await p.evaluate(() => { const h = document.querySelector('.tour-hole').getBoundingClientRect(), c = document.querySelector('.cal').getBoundingClientRect(); return Math.abs(h.top + 6 - c.top) < 2 && Math.abs(h.width - 12 - c.width) < 2; });
  assert(hole, 'el hueco resalta el calendario');
  await p.waitForTimeout(350); await p.screenshot({ path: out + '/39cal.png' });
  // El fondo no deja tocar la app mientras dura
  await p.mouse.click(30, 300);
  assert(await p.evaluate(() => location.hash) === '' && !!(await p.$('#tour')), 'tocar fuera de la explicación no hace nada');
  const titles = [t.title];
  for (let k = 1; k < 7; k++) { await p.click('[data-tour=next]'); titles.push((await tip(p)).title); }
  assert(titles.join() === 'Calendario,Nueva sesión,Repetir o tabla,Datos del día,Progreso,Récords,Ajustes', 'pasos: ' + titles.join(', '));
  await p.waitForTimeout(350); await p.screenshot({ path: out + '/39ajustes.png' });
  await p.click('[data-tour=prev]');
  assert((await tip(p)).title === 'Récords', '«‹» vuelve al paso anterior');
  await p.click('[data-tour=next]');
  assert(await p.textContent('[data-tour=next]') === 'Entendido' && !(await p.$('[data-tour=skip]')), 'último paso: «Entendido», sin «Saltar»');
  await p.click('[data-tour=next]');
  assert(!(await p.$('#tour')) && (await seen(p)).app === 1, 'al terminar se cierra y queda visto');
  await p.reload(); await p.waitForSelector('.cal'); await p.waitForTimeout(200);
  assert(!(await p.$('#tour')), 'no vuelve a salir al abrir otra vez');

  // ---- Primera sesión (vacía) ----
  await p.click('[data-action=new-session]');
  await p.waitForSelector('#tour');
  t = await tip(p);
  assert(t.n === '1 de 2' && t.title === 'Añade un ejercicio', 'sesión vacía: cómo añadir ejercicios (2 pasos)');
  await p.click('[data-tour=skip]');
  assert(!(await p.$('#tour')) && (await seen(p)).sesion === 1, '«Saltar» lo cierra y queda visto');
  // ---- Primer ejercicio: cómo registrar una serie ----
  await p.click('[data-action=add-exercise]');
  await p.fill('#picker-q', 'Press banca');
  await p.click('#picker-list [data-action=pick-exercise] >> nth=0');
  await p.waitForSelector('#tour');
  t = await tip(p);
  const n = +t.n.split(' de ')[1];
  assert(t.title === 'Peso y repeticiones' && n === 6, 'primer ejercicio: recorrido de la serie (6 pasos; sin peso sugerido, ese paso se omite): ' + t.n);
  await p.click('[data-tour=next]');
  t = await tip(p);
  assert(t.title.startsWith('RIR') && t.text.includes('0 = al fallo'), 'explica el RIR');
  await p.waitForTimeout(350); await p.screenshot({ path: out + '/39rir.png' });
  await p.keyboard.press('Escape');
  assert(!(await p.$('#tour')) && (await seen(p)).series === 1, 'Esc lo cierra y queda visto');

  // ---- Repetir desde Ajustes ----
  await p.goto('http://localhost:8123/#/settings');
  await p.click('[data-action=tour-again]');
  await p.waitForSelector('#tour');
  assert((await tip(p)).title === 'Calendario' && await p.evaluate(() => location.hash) === '#/', 'Ajustes › «Ver el recorrido otra vez» vuelve al calendario y lo muestra');
  // Cambiar de pantalla lo cierra sin darlo por visto
  await p.evaluate(() => { location.hash = '#/exercises'; });
  await p.waitForFunction(() => !document.querySelector('#tour'));
  assert(!(await seen(p)).app, 'al cambiar de pantalla se cierra sin darlo por visto');

  // ---- Instalación con uso (≥ 5 sesiones) al llegar esta versión: no sale solo ----
  const q = await (await b.newContext({ ...devices['iPhone 13'], tour: true })).newPage();
  await q.goto('http://localhost:8123/');
  await q.evaluate(() => { for (let k = 0; k < 5; k++) db.sessions.push({ id: 's' + k, createdAt: '2026-11-1' + k + 'T10', date: '2026-11-1' + k, startedAt: 1, endedAt: 2, title: 'x', factors: [], exercises: [] }); save(true); localStorage.removeItem('diario-entreno.recorrido'); });
  await q.evaluate(() => { document.getElementById('tour')?.remove(); });
  await q.reload(); await q.waitForSelector('.cal'); await q.waitForTimeout(300);
  assert(!(await q.$('#tour')) && (await seen(q)).app === 1, 'quien ya usa la app no lo ve solo (está en Ajustes)');
  assert(!errs.length, 'sin errores: ' + errs.join(' | '));
  await b.close();
})();
