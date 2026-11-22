const { chromium, devices } = require('playwright');
const out = process.argv[2];
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
const CID = '1234-test.apps.googleusercontent.com';

// ---- Google Drive simulado (compartido por los dos «dispositivos») ----
const files = {}; let seq = 0; let clock = Date.parse('2026-11-21T10:00:00Z');
const tick = () => new Date((clock += 1000)).toISOString();
const log = [];
async function fakeGoogle(route) {
  const req = route.request(), url = new URL(req.url());
  if (url.hostname === 'accounts.google.com') {
    return route.fulfill({ contentType: 'text/javascript', body: `window.google = { accounts: { oauth2: {
      initTokenClient(cfg) { return { requestAccessToken(o) { window.__tokReq = (window.__tokReq || 0) + 1; window.__scope = cfg.scope; window.__prompt = o.prompt;
        setTimeout(() => cfg.callback({ access_token: 'tok' + window.__tokReq, expires_in: 3599 }), 5); } }; },
      revoke(t, cb) { window.__revoked = t; cb && cb(); } } } };` });
  }
  const auth = req.headers()['authorization'] || '';
  if (!auth.startsWith('Bearer tok')) return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":{"message":"unauthorized"}}' });
  const p = url.pathname, m = req.method();
  log.push(`${m} ${p}${url.search.includes('uploadType') ? '?' + url.searchParams.get('uploadType') : ''}`);
  const json = (o, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });
  if (p === '/drive/v3/about') return json({ user: { emailAddress: 'atleta@example.com', displayName: 'Atleta' } });
  if (p === '/drive/v3/files' && m === 'GET') {
    const qs = url.searchParams.get('q');
    const name = /name='([^']+)'/.exec(qs)[1], parent = /'([^']+)' in parents/.exec(qs)?.[1], folder = qs.includes('folder');
    return json({ files: Object.values(files).filter((f) => !f.trashed && f.name === name && (!parent || f.parents.includes(parent)) && (!folder || f.mimeType.includes('folder'))).map(({ id, modifiedTime, content }) => ({ id, modifiedTime, size: String(content?.length || 0) })) });
  }
  if (p === '/drive/v3/files' && m === 'POST') {
    const meta = JSON.parse(req.postData()); const id = 'f' + ++seq;
    files[id] = { id, ...meta, parents: meta.parents || [], modifiedTime: tick() };
    return json({ id });
  }
  let mm;
  if ((mm = /^\/drive\/v3\/files\/([^/]+)$/.exec(p)) && m === 'GET') {
    const f = files[mm[1]]; if (!f) return json({ error: { message: 'not found' } }, 404);
    if (url.searchParams.get('alt') === 'media') return route.fulfill({ contentType: 'application/json', body: f.content });
    return json({ id: f.id, trashed: !!f.trashed });
  }
  if (p === '/upload/drive/v3/files' && m === 'POST') {
    const body = req.postData(); const boundary = /boundary=(.+)$/.exec(req.headers()['content-type'])[1];
    const parts = body.split('--' + boundary).slice(1, -1).map((x) => x.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, ''));
    const meta = JSON.parse(parts[0]); const id = 'f' + ++seq;
    files[id] = { id, ...meta, content: parts[1], modifiedTime: tick() };
    return json({ id, modifiedTime: files[id].modifiedTime });
  }
  if ((mm = /^\/upload\/drive\/v3\/files\/([^/]+)$/.exec(p)) && m === 'PATCH') {
    const f = files[mm[1]]; f.content = req.postData(); f.modifiedTime = tick();
    return json({ id: f.id, modifiedTime: f.modifiedTime });
  }
  return json({ error: { message: 'no simulado: ' + m + ' ' + p } }, 400);
}
const backup = () => { const f = Object.values(files).find((x) => x.name === 'diario-entreno-copia.json'); return f && { ...f, data: JSON.parse(f.content) }; };
const sessionsIn = (b) => Object.values(b.data.data).reduce((a, d) => a + d.sessions.length, 0);

async function device(b, name) {
  const c = await b.newContext({ ...devices['Pixel 7'] });
  await c.route(/accounts\.google\.com|googleapis\.com/, fakeGoogle);
  const p = await c.newPage();
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  p.on('dialog', (d) => d.accept());
  await p.goto('http://localhost:8123/#/settings');
  return p;
}
async function newSession(p, title) {
  await p.goto('http://localhost:8123/#/');
  await p.click('[data-action=new-session]');
  await p.fill('[data-s=title]', title);
  await p.click('[data-action=add-exercise]');
  await p.fill('#picker-q', 'press banca');
  await p.click('#picker-list [data-action=pick-exercise] >> nth=0');
  await p.fill('[data-set="0:0:w"]', '80'); await p.fill('[data-set="0:0:reps"]', '5');
  await p.click('[data-action=finish-session]');
}

(async () => {
  const b = await chromium.launch();
  // ---- Dispositivo A ----
  const A = await device(b, 'A');
  assert(!(await A.isVisible('#cloud-card')), 'sin ID de cliente configurado no aparece la sección de Drive');
  await A.evaluate((cid) => { window.DIARIO_CONFIG.googleClientId = cid; rerender(); }, CID);
  await A.click('[data-action=cloud-connect]');
  await A.waitForFunction(() => cloud.st.lastBackup);
  assert(await A.evaluate(() => window.__scope) === 'https://www.googleapis.com/auth/drive.file', 'pide solo el permiso drive.file');
  assert((await A.textContent('#cloud-card')).includes('atleta@example.com'), 'muestra la cuenta conectada');
  let bk = backup();
  assert(bk && bk.parents.length === 1 && files[bk.parents[0]].name === 'Diario de entrenamiento', 'crea la carpeta «Diario de entrenamiento» y la copia dentro');
  assert(bk.data.type === 'diario-entreno-todos' && sessionsIn(bk) === 0, 'la copia tiene el formato de «todos los usuarios»');
  await (await A.$('#cloud-card')).screenshot({ path: out + '/9settings.png' });

  // Copia automática al finalizar sesión
  await newSession(A, 'Torso A');
  await A.waitForFunction(() => JSON.parse(localStorage.getItem('diario-entreno.nube')).lastSize > 3000 || false, null, { timeout: 5000 }).catch(() => {});
  await A.waitForTimeout(400);
  bk = backup();
  assert(sessionsIn(bk) === 1 && log.some((l) => l.startsWith('PATCH')), 'al finalizar la sesión actualiza la copia (PATCH, sin duplicar archivo)');
  assert(Object.values(files).filter((f) => f.name === 'diario-entreno-copia.json').length === 1, 'un único archivo de copia');
  assert(await A.isVisible('.toast.show'), 'aviso «copia guardada»');

  // Acceso caducado: al finalizar se vuelve a pedir (dentro del toque) y sube
  const before = await A.evaluate(() => window.__tokReq);
  await A.evaluate(() => { cloud.tokenExp = 0; });
  await newSession(A, 'Pierna A');
  await A.waitForTimeout(500);
  assert(await A.evaluate(() => window.__tokReq) === before + 1 && sessionsIn(backup()) === 2, 'con el acceso caducado, «Finalizar» lo renueva y sube la copia');

  // Token rechazado por Google (401): no rompe la app y deja aviso
  await A.evaluate(() => { cloud.token = 'malo'; cloud.tokenExp = Date.now() + 3600e3; });
  await newSession(A, 'Pierna B');
  await A.waitForTimeout(500);
  assert(sessionsIn(backup()) === 2, 'con 401 no se sube nada…');
  assert(await A.evaluate(() => !!cloud.st.error && !cloud.token), '…y queda registrado el error para reintentar');
  await A.goto('http://localhost:8123/#/settings');
  await A.click('[data-action=cloud-backup]');
  await A.waitForTimeout(400);
  assert(sessionsIn(backup()) === 3, '«Copiar ahora» renueva el acceso y sube');

  // ---- Dispositivo B: restaura la copia ----
  const B = await device(b, 'B');
  await B.evaluate((cid) => { window.DIARIO_CONFIG.googleClientId = cid; rerender(); }, CID);
  await B.click('[data-action=cloud-connect]');
  await B.waitForFunction(() => db.sessions.length === 3, null, { timeout: 5000 });
  assert(await B.evaluate(() => db.sessions.map((s) => s.title).sort().join()) === 'Pierna A,Pierna B,Torso A', 'otro dispositivo restaura la copia al conectar');

  // B añade una sesión (su copia pasa a ser la más reciente)
  await newSession(B, 'Sesión en B');
  await B.waitForTimeout(500);
  assert(sessionsIn(backup()) === 4, 'B sube su copia');

  // A intenta subir: conflicto, no sobrescribe
  await newSession(A, 'Sesión en A');
  await A.waitForTimeout(500);
  assert(sessionsIn(backup()) === 4 && backup().data.device !== (await A.evaluate(() => cloud.st.device)), 'conflicto: A no sobrescribe la copia más reciente de B');
  await A.goto('http://localhost:8123/#/settings');
  assert(await A.isVisible('[data-action=cloud-force]'), 'A ofrece restaurar o sustituir');
  await (await A.$('#cloud-card')).screenshot({ path: out + '/9conflict.png' });
  await A.click('#cloud-card [data-action=cloud-restore]');
  await A.waitForFunction(() => db.sessions.some((s) => s.title === 'Sesión en B'), null, { timeout: 5000 });
  assert(await A.evaluate(() => db.sessions.some((s) => s.title === 'Sesión en B')), 'A restaura la copia de B (la sesión de A se pierde: era la elección)');

  // Caché: ninguna respuesta de Google queda guardada por el service worker
  await A.waitForTimeout(300);
  const cached = await A.evaluate(async () => { const out = []; for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(r.url); return out; });
  assert(!cached.some((u) => /google/.test(u)), `la caché solo contiene archivos de la app (${cached.length})`);

  // Desconectar
  await A.goto('http://localhost:8123/#/settings');
  await A.click('[data-action=cloud-disconnect]');
  assert(await A.evaluate(() => !cloud.st.connected && !!window.__revoked), 'desconectar revoca el acceso');
  assert(!!backup(), 'la copia en Drive se conserva');
  console.log('errors', A.errs, B.errs);
  await b.close();
})();
