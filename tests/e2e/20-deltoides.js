const { chromium, devices } = require('playwright');
const out = process.argv[2] || 'shots';
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  // Datos guardados con la versión anterior (grupo «hombros»)
  await p.goto('http://localhost:8123/');
  await p.evaluate(() => {
    const id = profiles.active, d = JSON.parse(JSON.stringify(db));
    delete d.musclesV;
    d.exercises = d.exercises.filter((e) => !['Elevaciones laterales', 'Pájaros'].includes(e.name));
    const set = (n, pr, sec) => { const e = d.exercises.find((x) => x.name === n); e.primary = pr; e.secondary = sec; };
    set('Press militar', 'hombros', ['triceps']); set('Press banca', 'pectoral', ['triceps', 'hombros']); set('Face pull', 'hombros', ['espalda']); set('Remo con barra', 'espalda', ['biceps', 'hombros']);
    d.exercises.push({ id: 'x1', name: 'Elevación lateral en polea', mode: 'wr', primary: 'hombros', secondary: [] });
    d.exercises.push({ id: 'x2', name: 'Press Arnold', mode: 'wr', primary: 'hombros', secondary: ['triceps'] });
    d.exercises.push({ id: 'x3', name: 'Vuelos invertidos', mode: 'wr', primary: 'hombros', secondary: [] });
    d.settings.landmarks = { hombros: [0, 6, 14, 20, 24] };
    const iso = todayISO();
    d.sessions.push({ id: 's1', createdAt: iso + 'T10', date: iso, startedAt: 1, title: 'x', factors: [], exercises: [
      { id: 'a', exerciseId: d.exercises.find((x) => x.name === 'Press militar').id, equipment: [], notes: '', sets: [1, 2, 3, 4].map(() => ({ type: 'E', w: 50, reps: 8, rir: 2, done: true })) },
      { id: 'b', exerciseId: 'x1', equipment: [], notes: '', sets: [1, 2, 3, 4, 5, 6].map(() => ({ type: 'E', w: 10, reps: 12, rir: 1, done: true })) }] });
    localStorage.setItem(`diario-entreno.u.${id}`, JSON.stringify(d)); db = JSON.parse(JSON.stringify(d));
    localStorage.setItem('diario-entreno.tablas', JSON.stringify([{ id: 't1', name: 'Hombro', exercises: [{ name: 'Press tras nuca', mode: 'wr', primary: 'hombros', secondary: ['triceps'], sets: [{ type: 'E', reps: '8', rir: 2 }] }] }]));
  });
  await p.reload();
  const m = await p.evaluate(() => Object.fromEntries(['Press militar', 'Press banca', 'Face pull', 'Remo con barra', 'Elevación lateral en polea', 'Press Arnold', 'Vuelos invertidos'].map((n) => { const e = db.exercises.find((x) => x.name === n); return [n, [e.primary, e.secondary.join('+'), !!e.reviewMuscles]]; })));
  assert(m['Press militar'].join() === 'delt_ant,triceps,false', 'Press militar → deltoides anterior: ' + m['Press militar']);
  assert(m['Press banca'][1] === 'triceps+delt_ant', 'Press banca: secundario deltoides anterior');
  assert(m['Face pull'][0] === 'delt_post' && m['Remo con barra'][1] === 'biceps+delt_post', 'Face pull y remo → deltoides posterior');
  assert(m['Elevación lateral en polea'].join() === 'delt_lat,,true', 'propio «Elevación lateral…» → lateral, marcado para revisar');
  assert(m['Press Arnold'][0] === 'delt_ant' && m['Vuelos invertidos'][0] === 'delt_post', 'propios por nombre: Arnold → anterior, vuelos invertidos → posterior');
  assert(await p.evaluate(() => ['Elevaciones laterales', 'Pájaros'].every((n) => db.exercises.some((e) => e.name === n)) && db.musclesV === 4), 'se añaden «Elevaciones laterales» y «Pájaros» (y se migra hasta la v4)');
  assert(JSON.stringify(await p.evaluate(() => db.settings.landmarks)) === '{"delt_lat":[0,6,14,20,24]}', 'referencias personalizadas de hombros → deltoides lateral');
  await p.reload();
  assert(await p.evaluate(() => db.exercises.filter((e) => e.name === 'Pájaros').length) === 1, 'la migración no se repite al recargar');
  // Volumen: press militar 4 → anterior 4, lateral 2; elevación lateral 6 → lateral 6
  await p.goto('http://localhost:8123/#/exercises'); await p.waitForSelector('.mbars');
  const v = await p.$$eval('.mbar', (x) => Object.fromEntries(x.map((e) => [e.dataset.m, e.querySelector('.mb-v').textContent.trim()])));
  assert(v.delt_ant === '4' && v.delt_lat === '6' && v.delt_post === '0' && !('hombros' in v), 'barras: anterior 4 · lateral 6 (se respetan los secundarios que tenía el press militar) · posterior 0: ' + JSON.stringify([v.delt_ant, v.delt_lat, v.delt_post]));
  assert((await p.textContent('#app')).includes('Revisa los músculos'), 'aviso para revisar los ejercicios propios');
  // Figura del cuerpo en la sesión
  await p.goto('http://localhost:8123/#/session/s1'); await p.waitForSelector('#vol');
  if (await p.$('[data-action=sum-open][aria-expanded=false]')) await p.click('[data-action=sum-open]'); await p.waitForSelector('.body-fig');
  const fig = await p.$$eval('.body-fig', (f) => f.map((x) => [...new Set([...x.querySelectorAll('.mz')].map((g) => g.dataset.m))].filter((k) => k.startsWith('delt')).join('+')));
  assert(fig[0] === 'delt_lat+delt_ant' && fig[1] === 'delt_lat+delt_post', 'figura: frontal anterior + lateral; posterior posterior + lateral: ' + fig.join(' | '));
  await (await p.$('.body-map')).screenshot({ path: out + '/20body.png' });
  // Tabla antigua con «hombros»: el ejercicio nuevo se crea con un deltoides
  await p.evaluate(() => { const s = currentSession(); loadTemplateInto(s, tplList()[0]); save(true); });
  assert(await p.evaluate(() => db.exercises.find((e) => e.name === 'Press tras nuca')?.primary) === 'delt_ant', 'tabla antigua: «Press tras nuca» se crea con deltoides anterior');
  // Usuario nuevo: catálogo ya dividido
  assert(await p.evaluate(() => { const d = seed(); return d.musclesV === 4 && !d.exercises.some((e) => e.primary === 'hombros' || e.secondary.includes('hombros')); }), 'usuario nuevo: sin «hombros»');
  console.log('errors', errs); await b.close();
})();
