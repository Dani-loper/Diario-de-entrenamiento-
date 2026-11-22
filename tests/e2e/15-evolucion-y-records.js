const { chromium, devices } = require('playwright');
const out = process.argv[2] || 'shots';
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8123/');
  // 1 año de sentadilla: 2 sesiones/semana, progresión con ruido; un día con vídeo
  const sq = await p.evaluate(async () => {
    db.settings.level = 'advanced';
    const sq = db.exercises.find((e) => e.name === 'Sentadilla trasera').id;
    const fo = db.exercises.find((e) => e.name === 'Fondos').id;
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 100; k++) {
      const d = new Date(Date.now() - (360 - k * 3.6) * 864e5); const iso = isoOf(d);
      const w = Math.round((90 + k * 0.3 + (rnd() - 0.5) * 8) / 2.5) * 2.5;
      db.sessions.push({ id: 'h' + k, createdAt: iso + 'T10', date: iso, startedAt: 1, endedAt: 2, title: 'Pierna', factors: [], exercises: [
        { id: 'a' + k, exerciseId: sq, equipment: [], notes: '', sets: [{ type: 'C', w: 60, reps: 8, done: true }, { type: 'E', w, reps: 5, rir: 2, done: true }, { type: 'E', w: Math.round(w * 0.85 / 2.5) * 2.5, reps: 8, rir: 2, done: true }] },
        { id: 'b' + k, exerciseId: fo, equipment: [], notes: '', sets: [{ type: 'E', w: 0, reps: 8 + (k % 5), done: true }] }] });
    }
    // 1RM real: 120 kg × 1 en la última sesión con vídeo
    const last = db.sessions[db.sessions.length - 1];
    last.exercises[0].sets.push({ type: 'E', w: 160, reps: 1, rir: 0, done: true, videoId: 'vid1' });
    await videoPut({ id: 'vid1', user: profiles.active, blob: new Blob(['x'], { type: 'video/mp4' }), type: 'video/mp4', size: 1, name: 'a.mp4', createdAt: Date.now() });
    save(true); return sq;
  });
  await p.goto(`http://localhost:8123/#/exercise/${sq}`);
  await p.waitForSelector('.evo');
  assert(await p.isVisible('[data-action=erange][data-r="1y"].on'), 'periodo por defecto: 1 año');
  const n1 = await p.$$eval('.evo .pt', (x) => x.length);
  await p.click('[data-action=erange][data-r="3m"]');
  const n3 = await p.$$eval('.evo .pt', (x) => x.length);
  assert(n3 < n1 && n3 >= 20 && n3 <= 30, `3 meses muestra menos sesiones (${n3} de ${n1})`);
  // eje X proporcional al tiempo: puntos equiespaciados en días deben quedar ~equiespaciados
  const xs = await p.$$eval('.evo .pt', (c) => c.map((e) => +e.getAttribute('cx')));
  assert(xs[xs.length - 1] > xs[0], 'eje X ordenado por fecha');
  assert(await p.$$eval('.evo .pr-pt', (x) => x.length) >= 1, 'récords marcados');
  const det = await p.textContent('#chart-detail');
  assert(det.includes('★ récord') && det.includes('160'), 'detalle por defecto: última sesión (130×1, récord): ' + det.replace(/\s+/g, ' ').trim());
  await p.$eval('.evo', (e) => e.scrollIntoView({ block: 'center' }));
  await p.click('.evo .hit >> nth=0', { force: true });
  assert(!(await p.textContent('#chart-detail')).includes('160'), 'tocar un punto cambia el detalle');
  await p.click('[data-action=erange][data-r="1y"]');
  await (await p.$('h2:has-text("Evolución")')).scrollIntoViewIfNeeded();
  const card = await p.$('.card:has(.pchart)'); await card.screenshot({ path: out + '/15chart.png' });
  // Salón de la fama
  await p.click('.tabbar a[data-tab=records]');
  await p.waitForSelector('.hof');
  assert(await p.isVisible('.tabbar a[data-tab=records].active'), 'pestaña Récords activa');
  const first = await p.textContent('.hof:has-text("Sentadilla")');
  assert(first.includes('Sentadilla trasera') && first.includes('160×1'), 'récord de sentadilla: 160×1');
  assert(await p.isVisible('.hof .hof-main [data-action=hof-video]'), 'el récord tiene botón de vídeo');
  await p.click('.hof:has-text("Sentadilla") summary');
  const rms = await p.$$eval('.hof:has-text("Sentadilla") .hof-rms tr', (r) => r.slice(1).map((x) => x.cells[0].textContent));
  assert(rms[0] === '1 RM' && rms.includes('5 RM') && rms.includes('8 RM'), 'máximos por repeticiones: ' + rms.join(', '));
  assert((await p.textContent('.hof:has-text("Fondos")')).includes('reps'), 'ejercicio de peso corporal: récord en repeticiones');
  await p.screenshot({ path: out + '/15hof.png' });
  await p.click('[data-action=hof-filter][data-v=video]');
  assert(await p.$$eval('.hof', (x) => x.length) === 1, 'filtro «con vídeo»: solo sentadilla');
  await p.click('.hof-main [data-action=hof-video]');
  await p.waitForSelector('#modal video');
  assert(true, 'el vídeo se abre en una ventana');
  console.log('errors', errs); await b.close();
})();
