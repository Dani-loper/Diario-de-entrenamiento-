const { chromium, devices } = require('playwright');
const out = process.argv[2];
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ ...devices['Pixel 7'] });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', (d) => d.accept());
  await p.goto('http://localhost:8123/');
  await p.evaluate(() => { db.settings.level = 'advanced'; save(true); rerender(); });
  // Perfil de atleta con 7 meses de datos: progresión lineal conocida
  await p.evaluate(() => {
    profiles.users[0].name = 'Laura García'; profiles.users[0].goal = 'Competir en -63 kg'; saveProfiles();
    const id = (n) => db.exercises.find((e) => e.name === n).id;
    const lifts = [['Sentadilla trasera', 80, 0.004], ['Press banca', 50, 0.002], ['Peso muerto', 100, 0.003], ['Curl de bíceps', 12, 0.001]];
    let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 70; k++) {
      const d = new Date(); d.setDate(d.getDate() - (210 - k * 3));
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      db.sessions.push({
        id: 'r' + k, createdAt: iso + 'T10:00', date: iso, startedAt: +d, endedAt: +d + (55 + rnd() * 20) * 60000, title: 'Fuerza', system: 'si',
        bodyweight: Math.round((64 - k * 0.02 + rnd() * 0.4) * 10) / 10, sleep: 6 + rnd() * 2.5, readiness: 2 + Math.floor(rnd() * 4), stress: 1 + Math.floor(rnd() * 5), srpe: 6 + Math.floor(rnd() * 3),
        factors: rnd() < 0.2 ? ['Dormí mal'] : [], notes: '', preNotes: '', preObs: '',
        exercises: lifts.map(([n, base, g]) => ({ id: 'e' + k + n, exerciseId: id(n), notes: '', equipment: [],
          sets: [0, 1, 2].map(() => ({ type: 'E', w: Math.round(base * (1 + g * k) / 2.5) * 2.5, reps: 5, rir: 2, done: true })) })),
      });
    }
    save(true);
  });
  await p.goto('http://localhost:8123/#/report');
  assert(await p.isVisible('.report'), 'se muestra el informe');
  assert(await p.isVisible('.report .body-map'), 'el informe incluye la figura del cuerpo');
  const sq = await p.evaluate(() => { const { start, end } = periodRange(3); const st = periodStats(start, end); const w = Math.max(1, (Date.parse(end) - Date.parse(start)) / (7 * 864e5)); return [st.setsCat.cuadriceps / w, document.querySelector('.report .mz[data-m=cuadriceps] title').textContent]; });
  assert(sq[1] === `Cuádriceps: ${(Math.round(sq[0] * 10) / 10).toLocaleString('es-ES')}`, 'la figura muestra la media semanal por músculo: ' + sq[1]);
  const range = await p.evaluate(() => [1, 3, 6, 12].map((m) => periodRange(m)));
  assert(range.every((r) => r.start <= r.end && r.prevEnd < r.start && r.prevStart < r.prevEnd), 'rangos de periodo y periodo anterior coherentes');
  const chips = await p.$$eval('[data-action=r-ex].on', (x) => x.length);
  assert(chips === 4, 'preselecciona los ejercicios del periodo (4)');
  const rows = await p.$$eval('.rtable tr', (r) => r.slice(1).map((tr) => [...tr.children].map((td) => td.textContent.trim())));
  console.log('   ', rows.map((r) => r.join(' | ')).join('\n    '));
  assert(rows.length === 4 && rows.slice(0, 3).every((r) => r[3].startsWith('+')) && rows[3][3] === '0%', 'mejoran los 3 básicos; el curl (siempre 12,5 kg) da 0%');
  // Evolución esperada en sentadilla (3 meses): calcular a mano con las mismas reglas
  const check = await p.evaluate(() => {
    const { start, end } = periodRange(3);
    const e = exerciseEvolution(db.exercises.find((x) => x.name === 'Sentadilla trasera').id, start, end);
    const pts = e.pts.map((x) => x.v);
    const manual = ((pts.at(-1) + pts.at(-2)) / 2) / ((pts[0] + pts[1]) / 2) * 100 - 100;
    return { change: e.change, manual, n: pts.length };
  });
  assert(Math.abs(check.change - check.manual) < 1e-9 && check.n >= 25, `cambio de sentadilla = media 2 últimas / media 2 primeras (${check.change.toFixed(1)}%, ${check.n} sesiones)`);
  // Periodo anterior: con 3 meses hay datos previos -> flechas
  assert(await p.isVisible('.kpi .delta'), 'compara con el periodo anterior');
  // Quitar un ejercicio
  await p.click('[data-action=r-ex] >> text=Curl de bíceps');
  assert((await p.$$eval('.rtable tr', (r) => r.length)) === 4, 'al desmarcar un ejercicio desaparece del informe');
  // Comentarios y botón de PDF
  await p.fill('[data-report-note]', 'Buen bloque. Próximo objetivo: técnica en el press.');
  await p.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await p.click('[data-action=r-print]');
  await p.waitForFunction(() => window.__printed === 1);
  assert(await p.isVisible('.r-note'), 'los comentarios aparecen en el informe');
  assert(await p.evaluate(() => window.__printed) === 1, 'el botón abre la impresión');
  // Periodos
  for (const m of ['1', '6', '12']) {
    await p.click(`[data-action=r-period][data-m="${m}"]`);
    assert(await p.isVisible('.report'), `informe de ${m} mes(es)`);
  }
  await p.click('[data-action=r-period][data-m="3"]');
  await p.click('[data-action=r-ex] >> text=Curl de bíceps');
  const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert(sw <= 0, 'sin scroll horizontal en móvil');
  await p.screenshot({ path: out + '/7screen.png', fullPage: true });
  // PDF real con el motor de impresión (A4, estilos de impresión)
  await p.emulateMedia({ media: 'print', colorScheme: 'dark' });
  await p.pdf({ path: out + '/informe.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true });
  console.log('errors', errs);
  await b.close();
})();
