const { chromium, devices } = require('playwright');
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.goto('http://localhost:8123/');
  // ---- Coherencia del catálogo ----
  const c = await p.evaluate(() => {
    const names = CATALOG.map((x) => x.name.toLowerCase());
    const bad = CATALOG.filter((x) => (x.primary && !MUSCLES[x.primary]) || !KITS[x.kit] || !MODES[x.mode] || !['multi', 'mono'].includes(x.joint)
      || Object.entries(x.sw).some(([m, w]) => !MUSCLES[m] || m === x.primary || ![0.25, 0.5, 0.75].includes(w)));
    const perMuscle = Object.fromEntries(MUSCLE_KEYS.map((m) => [m, CATALOG.filter((x) => x.primary === m).length]));
    const perKit = Object.fromEntries(Object.keys(KITS).map((k) => [k, CATALOG.filter((x) => x.kit === k).length]));
    return { n: CATALOG.length, dup: names.length - new Set(names).size, bad: bad.map((x) => x.name), perMuscle, perKit, seeded: db.exercises.length, v: db.musclesV };
  });
  assert(c.n >= 120 && c.dup === 0 && !c.bad.length, `catálogo: ${c.n} ejercicios, sin duplicados ni datos inválidos ${c.bad.join(',')}`);
  assert(Object.values(c.perMuscle).every((n) => n >= 3), 'al menos 3 ejercicios con cada músculo como principal: ' + JSON.stringify(c.perMuscle));
  assert(c.perKit.corporal >= 15 && c.perKit.banda >= 8 && c.perKit.mancuernas >= 15 && c.perKit.kettlebell >= 3, 'cubre gimnasio doméstico (peso corporal, bandas, mancuernas, kettlebell): ' + JSON.stringify(c.perKit));
  assert(c.seeded === c.n && c.v === 3, 'un usuario nuevo recibe el catálogo completo (versión 3)');
  // ---- Migración desde la versión 2 ----
  await p.evaluate(() => {
    const id = profiles.active, ex = (n, pr, sec, extra = {}) => ({ id: 'x' + n.length + n[0], name: n, mode: 'wr', primary: pr, secondary: sec, ...extra });
    const d = { version: 1, musclesV: 2, settings: { level: 'advanced' }, equipment: [], sessions: [], exercises: [
      ex('Sentadilla trasera', 'cuadriceps', ['gluteos', 'espalda']),          // por defecto sin cambios → pesos nuevos
      ex('Press banca', 'pectoral', ['triceps']),                              // cambiado por el usuario → se respeta
      ex('Zancadas', 'cuadriceps', ['gluteos', 'femoral']),                     // por defecto → femoral fuera, glúteo ¾
      ex('Mi ejercicio', 'biceps', ['espalda'])] };                             // propio → intacto
    localStorage.setItem(`diario-entreno.u.${id}`, JSON.stringify(d)); db = JSON.parse(JSON.stringify(d));
  });
  await p.reload();
  const m = await p.evaluate(() => Object.fromEntries(['Sentadilla trasera', 'Press banca', 'Zancadas', 'Mi ejercicio'].map((n) => { const e = db.exercises.find((x) => x.name === n); return [n, [e.secondary.join('+'), JSON.stringify(e.sw || null), e.kit || '']]; })));
  assert(m['Sentadilla trasera'][0] === 'gluteos+espalda' && m['Sentadilla trasera'][1] === '{"gluteos":0.75,"espalda":0.25}' && m['Sentadilla trasera'][2] === 'barra', 'sentadilla por defecto: glúteo ¾, espalda ¼, material barra');
  assert(m['Press banca'][0] === 'triceps' && m['Press banca'][1] === 'null', 'press banca personalizado: se respetan sus músculos');
  assert(m['Zancadas'][0] === 'gluteos' && m['Zancadas'][1] === '{"gluteos":0.75}', 'zancadas: el femoral deja de contar (sin crecimiento medible), glúteo ¾');
  assert(m['Mi ejercicio'][0] === 'espalda' && m['Mi ejercicio'][1] === 'null', 'ejercicio propio intacto');
  assert(await p.evaluate(() => db.exercises.length === CATALOG.length + 1 && db.musclesV === 3), 'se añaden los ejercicios nuevos sin duplicar los que ya tenía');
  // ---- Volumen con pesos ----
  const acc = await p.evaluate(() => { const sq = db.exercises.find((e) => e.name === 'Sentadilla trasera'), pb = db.exercises.find((e) => e.name === 'Press inclinado');
    return sessionMuscles({ exercises: [{ exerciseId: sq.id, sets: [1, 2, 3, 4].map(() => ({ type: 'E', w: 100, reps: 5, rir: 2, done: true })) }, { exerciseId: pb.id, sets: [1, 2].map(() => ({ type: 'E', w: 60, reps: 8, rir: 2, done: true })) }] }, 'sets'); });
  assert(JSON.stringify(acc) === '{"cuadriceps":4,"gluteos":3,"espalda":1,"pectoral":2,"delt_ant":1.5,"triceps":1}', '4 sentadillas + 2 press inclinado: cuád. 4 · glúteo 3 · espalda 1 · pecho 2 · delt. ant. 1,5 · tríceps 1: ' + JSON.stringify(acc));
  // ---- Editar pesos en el formulario ----
  const sid = await p.evaluate(() => db.exercises.find((e) => e.name === 'Sentadilla trasera').id);
  await p.goto(`http://localhost:8123/#/exercise/${sid}`);
  assert((await p.textContent('#app')).includes('Cuádriceps · sec.: Glúteos ¾, Espalda ¼'), 'la ficha muestra cuánto cuenta cada músculo');
  await p.click('[data-action=exercise-form]');
  await p.click('#ef-sec [data-m=espalda]');      // ¼ → quitar
  await p.click('#ef-sec [data-m=femoral]');      // nada → ½
  await p.click('#ef-sec [data-m=femoral]');      // ½ → ¾
  await p.click('[data-action=save-exercise]');
  assert(await p.evaluate((id) => JSON.stringify([exById(id).secondary, exById(id).sw]), sid) === '[["gluteos","femoral"],{"gluteos":0.75,"femoral":0.75}]', 'el editor cambia los pesos (½ → ¾ → ¼ → quitar)');
  // ---- Filtro por material en el selector ----
  await p.evaluate(() => { db.sessions.push({ id: 'h', createdAt: todayISO() + 'T10', date: todayISO(), startedAt: Date.now(), title: 'x', factors: [], exercises: [] }); save(true); });
  await p.goto('http://localhost:8123/#/session/h');
  await p.click('[data-action=add-exercise]');
  await p.click('[data-action=pick-kit][data-k=banda]');
  const names = await p.$$eval('#picker-list [data-action=pick-exercise]', (x) => x.map((e) => e.textContent));
  assert(names.length >= 8 && names.every((n) => /banda/i.test(n) || /Abducción|Aperturas inversas|Flexiones/.test(n)), 'filtro «Bandas»: solo ejercicios con banda (' + names.length + ')');
  console.log('errors', errs); await b.close();
})();
