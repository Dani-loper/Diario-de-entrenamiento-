// Series por músculo: por defecto el microciclo en curso, con navegación a los anteriores, «Últimos N días» y la marca
// del microciclo anterior. Reloj fijo: domingo 22 nov 2026.
const { chromium, devices } = require('playwright');
const out = process.argv[2] || 'shots';
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8123/');
  await p.evaluate(() => {
    const pb = db.exercises.find((e) => e.name === 'Press banca').id;
    const S = (id, date, n) => db.sessions.push({ id, createdAt: date + 'T10', date, startedAt: 1, endedAt: 2, title: 'Torso', factors: [],
      exercises: [{ id: id + 'e', exerciseId: pb, equipment: [], notes: '', sets: Array.from({ length: n }, () => ({ type: 'E', w: 80, reps: 8, rir: 2, done: true })) }] });
    S('a', '2026-11-10', 3); // semana anterior (lun 9 – dom 15)
    S('b', '2026-11-16', 2); // semana en curso (lun 16 – dom 22)
    S('c', '2026-11-21', 1);
    save(true);
  });
  const card = async () => {
    await p.waitForSelector('.mbars');
    return p.evaluate(() => ({ label: document.querySelector('.mw-nav b').textContent, dates: document.querySelector('.mw-nav .muted').textContent, pec: document.querySelector('.mbar[data-m=pectoral] .mb-v').textContent.trim(),
      prev: !!document.querySelector('.mbar[data-m=pectoral] .mb-prev'), next: document.querySelector('[data-action=mw-nav][data-d="-1"]')?.disabled }));
  };
  await p.goto('http://localhost:8123/#/exercises');
  let c = await card();
  assert(c.label.startsWith('Semana en curso · día 7 de 7') && c.dates.includes('16 nov') && c.pec === '3', 'por defecto, la semana en curso (lun 16 – dom 22): pectoral 3 · ' + c.label);
  assert(c.prev && c.next === true, 'marca de la semana anterior en la barra; «›» desactivado (no hay semanas futuras)');
  await (await p.$('.card:has(.mbars)')).screenshot({ path: out + '/38curso.png' });
  await p.click('[data-action=mw-nav][data-d="1"]');
  c = await card();
  assert(c.label.startsWith('Semana anterior') && c.pec === '3' && !c.prev, 'semana anterior (9 – 15 nov): pectoral 3, sin marca');
  await p.click('[data-action=mw-nav][data-d="1"]');
  c = await card();
  assert(c.label.startsWith('Hace 2 semanas') && c.pec === '0', 'hace 2 semanas: 0');
  await p.click('[data-action=mw-mode][data-r="1"]');
  c = await card();
  assert(c.label.startsWith('Últimos 7 días') && c.pec === '3' && !(await p.$('[data-action=mw-nav]')), '«Últimos 7 días» (16 – 22 nov), sin flechas');
  await p.click('[data-action=mw-mode][data-r="0"]');
  c = await card();
  assert(c.label.startsWith('Semana en curso'), 'volver a «Por semana» lleva a la semana en curso');
  // Atleta cuya semana empieza el domingo: hoy es el día 1
  await p.evaluate(() => { db.settings.weekDow = 0; save(true); rerender(); });
  c = await card();
  assert(c.label.startsWith('Semana en curso · día 1 de 7') && c.pec === '0' && c.prev, 'semana de domingo a sábado: hoy es el día 1, pectoral 0 y marca con lo de la anterior (3)');
  await (await p.$('.card:has(.mbars)')).screenshot({ path: out + '/38dia1.png' });
  // Microciclo de 8 días que empezó el 18 nov
  await p.evaluate(() => { db.settings.weekLen = 8; db.settings.cycleAnchor = '2026-11-18'; save(true); rerender(); });
  c = await card();
  assert(c.label.startsWith('Microciclo en curso · día 5 de 8') && c.dates.includes('18 nov') && c.dates.includes('25 nov') && c.pec === '1', 'microciclo de 8 días (18 – 25 nov): día 5 de 8, pectoral 1 · ' + c.label);
  assert(!errs.length, 'sin errores: ' + errs.join(' | '));
  await b.close();
})();
