const { chromium, devices } = require('playwright');
const out = process.argv[2] || 'shots';
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.goto('http://localhost:8123/');
  // Historial (1RM est. sentadilla 123,3; press banca 86,3) y dos tablas: Pierna (sentadilla 3×5) y Torso (banca 3×8, curl 2×12)
  await p.evaluate(() => {
    const ex = (n) => db.exercises.find((e) => e.name === n).id, d = addDays(todayISO(), -9);
    db.sessions.push({ id: 'h', createdAt: d + 'T10', date: d, startedAt: 1, endedAt: 2, title: 'x', factors: [], exercises: [
      { id: 'a', exerciseId: ex('Sentadilla trasera'), equipment: [], notes: '', sets: [{ type: 'E', w: 100, reps: 5, rir: 2, done: true }] },
      { id: 'b', exerciseId: ex('Press banca'), equipment: [], notes: '', sets: [{ type: 'E', w: 70, reps: 5, rir: 2, done: true }] }] });
    save(true);
    const S = (reps, n) => Array.from({ length: n }, () => ({ type: 'E', reps, rir: 2 }));
    tplSaveAll([{ id: 'tP', name: 'Pierna', updatedAt: 1, exercises: [{ name: 'Sentadilla trasera', mode: 'wr', primary: 'cuadriceps', secondary: ['gluteos', 'espalda'], sets: [{ type: 'C', reps: '5', pct: 50 }, ...S('5', 3)] }] },
      { id: 'tT', name: 'Torso', updatedAt: 1, exercises: [{ name: 'Press banca', mode: 'wr', primary: 'pectoral', secondary: ['triceps', 'delt_ant'], sets: S('8', 3) }, { name: 'Curl de bíceps', mode: 'wr', primary: 'biceps', secondary: [], sets: S('12', 2) }] }]);
  });
  // Crear el mesociclo
  await p.goto('http://localhost:8123/#/templates');
  await p.click('[data-action=meso-new]');
  await p.waitForSelector('#meso-add');
  await p.selectOption('#meso-add', 'tP'); await p.waitForSelector('[data-action=meso-day-del][data-d="0"]');
  await p.selectOption('#meso-add', 'tT'); await p.waitForSelector('[data-action=meso-day-del][data-d="1"]');
  await p.fill('[data-meso$=":name"]', 'Bloque hipertrofia'); await p.press('[data-meso$=":name"]', 'Tab');
  await p.selectOption('[data-meso$=":setsMode"]', 'step1');
  const m = await p.evaluate(() => db.mesos[0]);
  assert(m.name === 'Bloque hipertrofia' && m.days.join() === 'tP,tT' && m.weeks === 4 && m.deload && m.rirStart === 3 && m.rirEnd === 1 && m.start === '2026-11-16', 'mesociclo: 2 días, 4 semanas + descarga, RIR 3 → 1, empieza el lunes de esta semana');
  // Progresión: RIR por semana y series
  const plan = await p.evaluate(() => { const m = db.mesos[0]; return [0, 1, 2, 3, 4].map((k) => { const t = mesoTemplate(m, k, 0), e = t.exercises[0];
    return `${weekRir(m, k)}:${e.sets.filter((x) => x.type !== 'C').length}:${e.sets.filter((x) => x.type === 'C').length}:${e.sets.at(-1).rir}:${e.sets.at(-1).pct ?? ''}`; }).join(' '); });
  assert(plan === '3:3:1:3: 2.5:4:1:2.5: 1.5:5:1:1.5: 1:6:1:1: 4:2:1:4:70.7', 'semanas: RIR 3 · 2,5 · 1,5 · 1 con 3-6 series; descarga: 2 series, RIR 4, 90 % de 78,6 % (5 @ RIR 3) = 70,7 %: ' + plan);
  // Plan por músculo: pectoral 3 series (S1) → 6 (S4) → 2 (descarga); en Tríceps 0,5 por serie de banca
  const pec = await p.$$eval('.meso-plan tr', (r) => r.find((x) => x.cells[0].textContent === 'Pectoral') && [...r.find((x) => x.cells[0].textContent === 'Pectoral').cells].slice(1).map((c) => c.textContent).join(' '));
  assert(pec === '3 4 5 6 2', 'plan semana a semana del pectoral: 3 4 5 6 2: ' + pec);
  await (await p.$('.meso-plan')).screenshot({ path: out + '/27plan.png' });
  // Calendario: toca Día 1 de la semana 1
  await p.goto('http://localhost:8123/#/'); await p.waitForSelector('.meso-card');
  assert((await p.textContent('.meso-card')).includes('Semana 1 de 4') && (await p.textContent('.meso-card')).includes('Día 1 · Pierna'), 'calendario: Semana 1 de 4 · Entrenar Día 1 · Pierna');
  await p.click('.meso-card [data-action=meso-start]');
  await p.waitForSelector('[data-ex="0"]');
  const s1 = await p.evaluate(() => { const s = currentSession(); return { meso: s.meso, title: s.title, sets: s.exercises[0].sets.map((x) => `${x.type}${x.w}x${x.reps}@${x.rir}`).join(' ') }; });
  assert(s1.meso.week === 0 && s1.meso.day === 0 && s1.title.includes('Semana 1'), 'sesión enlazada al mesociclo (semana 1, día 1)');
  assert(s1.sets === 'C62.5x5@null E97.5x5@3 E97.5x5@3 E97.5x5@3', 'pesos de la semana 1: 5 @ RIR 3 = 78,6 % de 123,3 = 96,9 → 97,5: ' + s1.sets);
  // Siguiente: Día 2 · Torso
  await p.goto('http://localhost:8123/#/'); await p.waitForSelector('.meso-card');
  assert((await p.textContent('.meso-card')).includes('Día 2 · Torso') && (await p.textContent('.meso-card')).includes('1/2 días'), 'después: toca el Día 2 · Torso (1/2 días hechos)');
  // Semana 4 (simulando la fecha): RIR 1 y 6 series
  await p.evaluate(() => { db.mesos[0].start = addDays(weekStart(todayISO()), -21); save(true); rerender(); });
  assert((await p.textContent('.meso-card')).includes('Semana 4 de 4') && (await p.textContent('.meso-card')).includes('RIR 1'), 'tres semanas después: Semana 4, RIR 1');
  await p.click('.meso-card [data-action=meso-start]'); await p.waitForSelector('[data-ex="0"]');
  const s4 = await p.evaluate(() => currentSession().exercises[0].sets.filter((x) => x.type === 'E').map((x) => `${x.w}@${x.rir}`));
  assert(s4.length === 6 && s4[0] === '102.5@1', 'semana 4: 6 series de 5 @ RIR 1 → 83,7 % de 123,3 = 103,2 → 102,5 kg: ' + s4.join(' '));
  console.log('errors', errs); await b.close();
})();
