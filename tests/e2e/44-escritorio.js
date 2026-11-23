// Pantallas grandes (PC): menú lateral, dos columnas en Calendario, Progreso y ficha; móvil sin cambios; Intro avanza de casilla.
const { chromium, devices } = require('playwright');
const out = process.argv[2] || 'shots';
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8123/');
  const ex = await p.evaluate(() => {
    const sq = db.exercises.find((e) => e.name === 'Sentadilla trasera').id;
    for (let k = 1; k <= 6; k++) db.sessions.push({ id: 's' + k, createdAt: addDays(todayISO(), -k * 3) + 'T18', date: addDays(todayISO(), -k * 3), startedAt: 1, endedAt: 4e6, title: 'Pierna', factors: [], exercises: [{ id: 'e' + k, exerciseId: sq, equipment: [], notes: '', sets: [{ type: 'E', w: 100, reps: 5, rir: 2, done: true }, { type: 'E', w: null, reps: null, rir: null, done: false }] }] });
    save(true); return sq;
  });
  await p.reload(); await p.waitForSelector('.cal');
  const nav = await p.evaluate(() => { const r = document.querySelector('.tabbar').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), brand: getComputedStyle(document.querySelector('.side-brand')).display, pad: getComputedStyle(document.body).paddingLeft }; });
  assert(nav.w === 220 && nav.h === 900 && nav.brand === 'block' && nav.pad === '220px', 'menú lateral fijo de 220 px con el nombre de la app: ' + JSON.stringify(nav));
  const twoCols = (sel) => p.evaluate((s) => { const a = document.querySelector(s + ' .col-a').getBoundingClientRect(), c = document.querySelector(s + ' .col-b').getBoundingClientRect(); return c.left > a.right && Math.abs(a.top - c.top) < 40; }, sel);
  assert(await twoCols('.cal-cols'), 'calendario: dos columnas (calendario | día y últimas sesiones)');
  await p.screenshot({ path: out + '/44cal.png' });
  await p.goto('http://localhost:8123/#/exercises'); await p.waitForSelector('.mbars');
  assert(await twoCols('.prog-cols'), 'Progreso: dos columnas (resumen | ejercicios)');
  await p.goto('http://localhost:8123/#/exercise/' + ex); await p.waitForSelector('h1');
  assert(await twoCols('.exd-cols'), 'ficha del ejercicio: dos columnas (cifras y gráficas | historial)');
  await p.screenshot({ path: out + '/44ficha.png' });
  await p.goto('http://localhost:8123/#/session/s1'); await p.waitForSelector('[data-ex="0"]');
  assert(await p.evaluate(() => Math.round(document.getElementById('app').getBoundingClientRect().width)) <= 840, 'la sesión no se estira: 840 px como mucho');
  assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sin desplazamiento horizontal');
  // Intro pasa a la casilla siguiente: kg → reps → RIR → kg de la serie siguiente
  await p.focus('[data-set="0:1:w"]'); await p.keyboard.type('102,5'); await p.keyboard.press('Enter');
  assert(await p.evaluate(() => document.activeElement.dataset.set) === '0:1:reps', 'Intro en kg → repeticiones');
  await p.keyboard.type('5'); await p.keyboard.press('Enter');
  assert(await p.evaluate(() => document.activeElement.dataset.set) === '0:1:rir', 'Intro en repeticiones → RIR');
  assert(await p.evaluate(() => { const s = currentSession().exercises[0].sets[1]; return s.w === 102.5 && s.reps === 5; }), 'los valores se guardan al pasar de casilla');
  // Móvil: igual que antes
  const m = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  await m.goto('http://localhost:8123/'); await m.waitForSelector('.cal');
  const mob = await m.evaluate(() => ({ cols: getComputedStyle(document.querySelector('.cal-cols')).display, bar: Math.round(document.querySelector('.tabbar').getBoundingClientRect().width), brand: getComputedStyle(document.querySelector('.side-brand')).display }));
  assert(mob.cols === 'block' && mob.bar === 390 && mob.brand === 'none', 'móvil: una columna y barra inferior, sin cambios: ' + JSON.stringify(mob));
  assert(!errs.length, 'sin errores: ' + errs.join(' | '));
  await b.close();
})();
