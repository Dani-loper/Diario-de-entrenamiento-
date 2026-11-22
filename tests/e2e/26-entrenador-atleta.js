const { chromium, devices } = require('playwright');
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const device = async () => { const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage(); p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept()); await p.goto('http://localhost:8123/'); return p; };
  const exported = async (p, sel) => { await p.click(sel); await p.waitForSelector('#modal[open]'); const txt = await p.evaluate(() => ui.shareFile.text()); await p.click('#modal [data-action=close-modal]').catch(() => p.evaluate(() => closeModal())); return txt; };
  const importFile = async (p, txt) => { await p.goto('http://localhost:8123/#/users'); await p.setInputFiles('#athlete-file', { name: 'a.json', mimeType: 'application/json', buffer: Buffer.from(txt) }); await p.waitForTimeout(300); };
  const session = (id, date, exId, w) => ({ id, createdAt: date + 'T10', date, startedAt: 1, endedAt: 2, title: id, factors: [], exercises: [{ id: id + 'e', exerciseId: exId, equipment: [], notes: '', sets: [{ type: 'E', w, reps: 5, rir: 2, done: true }] }] });
  // ---- Móvil de la atleta ----
  const A = await device();
  await A.evaluate((S) => {
    profiles.users[0].name = 'Laura'; saveProfiles();
    const sq = db.exercises.find((e) => e.name === 'Sentadilla trasera').id;
    db.exercises.push({ id: 'arnoldA', name: 'Press Arnold', mode: 'wr', primary: 'delt_ant', secondary: [] });
    db.sessions.push(eval(S)('s1', addDays(todayISO(), -6), sq, 100), eval(S)('s2', addDays(todayISO(), -3), 'arnoldA', 20));
    db.daily = { [todayISO()]: { steps: 9000 } }; save(true);
  }, session.toString());
  await A.goto('http://localhost:8123/#/settings');
  const fileA = await exported(A, '[data-action=athlete-export]');
  const payload = JSON.parse(fileA);
  assert(payload.type === 'diario-entreno-atleta' && payload.profile.name === 'Laura' && payload.data.sessions.length === 2, 'la atleta exporta su perfil (2 sesiones)');
  // ---- Móvil del entrenador: importar crea el perfil enlazado ----
  const C = await device();
  await importFile(C, fileA);
  const c1 = await C.evaluate((id) => { const u = profiles.users.find((x) => x.id === id); return u && readUserData(id).sessions.length; }, payload.profile.id);
  assert(c1 === 2, 'el entrenador importa: se crea «Laura» con el mismo identificador y 2 sesiones');
  // El entrenador entra en Laura, crea su propio «Press Arnold» (otro id) y le prepara una sesión y una tabla
  await C.evaluate((id) => switchUser(id), payload.profile.id);
  await C.evaluate((S) => {
    db.exercises.push({ id: 'arnoldC', name: 'press arnold', mode: 'wr', primary: 'delt_ant', secondary: [] });
    db.sessions.push(eval(S)('c1', addDays(todayISO(), -1), 'arnoldC', 22));
    db.sessions.find((s) => s.id === 's1').notes = 'Revisado: buena profundidad'; save(true);
    tplSaveAll([...tplList(), { id: 'tp1', name: 'Bloque fuerza', updatedAt: Date.now(), exercises: [] }]);
  }, session.toString());
  await C.goto('http://localhost:8123/#/users');
  const fileC = await exported(C, `[data-action=athlete-export][data-id="${payload.profile.id}"]`);
  // ---- Mientras, la atleta registra otra sesión ----
  await A.evaluate((S) => { db.sessions.push(eval(S)('s3', todayISO(), db.exercises.find((e) => e.name === 'Sentadilla trasera').id, 102.5)); save(true); }, session.toString());
  // ---- La atleta importa lo del entrenador ----
  await importFile(A, fileC);
  const r = await A.evaluate(() => ({ ids: db.sessions.map((s) => s.id).sort().join(), note: db.sessions.find((s) => s.id === 's1').notes, arnold: db.exercises.filter((e) => norm(e.name) === 'press arnold').length,
    c1ex: db.sessions.find((s) => s.id === 'c1')?.exercises[0].exerciseId, tpl: tplList().some((t) => t.name === 'Bloque fuerza'), users: profiles.users.length, steps: db.daily[todayISO()]?.steps }));
  assert(r.ids === 'c1,s1,s2,s3', 'combinar no pierde nada: sus sesiones (s1-s3) + la del entrenador (c1): ' + r.ids);
  assert(r.note === 'Revisado: buena profundidad', 'la sesión revisada por el entrenador se actualiza');
  assert(r.arnold === 1 && r.c1ex === 'arnoldA', '«press arnold» del entrenador se unifica con su «Press Arnold» (mismo nombre)');
  assert(r.tpl, 'recibe la tabla del entrenador');
  assert(r.users === 1, 'no se crea un perfil duplicado: se combina con el suyo');
  assert(r.steps === 9000, 'conserva sus datos diarios');
  assert(await A.evaluate(async () => (await snapList()).some((x) => x.reason.startsWith('Antes de importar'))), 'antes de combinar se guarda una copia automática');
  // Archivo que no es de atleta
  let alerted = '';
  A.removeAllListeners('dialog'); A.on('dialog', (d) => { alerted = d.message(); d.accept(); });
  await importFile(A, JSON.stringify({ type: 'otra-cosa' }));
  assert(alerted.includes('No es un archivo de datos de atleta'), 'un archivo que no es de atleta se rechaza con un mensaje claro');
  console.log('errors', errs); await b.close();
})();
