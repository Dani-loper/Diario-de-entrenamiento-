'use strict';
/* Copia de seguridad en Google Drive.
 * - Permiso «drive.file» (no sensible): la app solo ve los archivos que ella misma crea, no el resto del Drive.
 * - La copia es un único JSON con todos los usuarios, en la carpeta visible «Diario de entrenamiento».
 *   Drive conserva versiones anteriores del archivo.
 * - Google Identity Services (modelo de token) da accesos de corta duración (~1 h) y sin renovación
 *   automática: renovarlo puede abrir una ventana de Google, que el navegador solo permite tras un toque.
 *   Por eso la copia automática se hace al «Finalizar sesión» (un toque) y, mientras el acceso siga vigente,
 *   también tras los cambios.
 * - No es sincronización en tiempo real: si otro dispositivo subió una copia más reciente, no se sobrescribe
 *   sin preguntar. Los vídeos no se suben. */

const CLOUD_KEY = 'diario-entreno.nube';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_FOLDER = 'Diario de entrenamiento';
const DRIVE_FILE = 'diario-entreno-copia.json';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

const cloud = (() => {
  let st = {};
  try { st = JSON.parse(localStorage.getItem(CLOUD_KEY)) || {}; } catch (e) { /* estado vacío */ }
  return { st, token: null, tokenExp: 0, busy: false, timer: null, dirty: false, msg: '' };
})();
const cloudSave = () => { try { localStorage.setItem(CLOUD_KEY, JSON.stringify(cloud.st)); } catch (e) { /* nada */ } };
const cloudClientId = () => (cloud.st.clientId || window.DIARIO_CONFIG?.googleClientId || '').trim();
const tokenValid = () => cloud.token && Date.now() < cloud.tokenExp - 60e3;

/* ---------- Autorización (Google Identity Services) ---------- */
let gisPromise = null;
function loadGIS() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { gisPromise = null; reject(new Error('No se pudo cargar el inicio de sesión de Google (¿sin conexión?)')); };
      document.head.appendChild(s);
    });
  }
  return gisPromise;
}
// Debe llamarse dentro de un toque del usuario: puede abrir una ventana de Google.
function requestToken(interactive) {
  return new Promise((resolve, reject) => {
    const cid = cloudClientId();
    if (!cid) return reject(new Error('Falta configurar el ID de cliente de Google.'));
    if (!window.google?.accounts?.oauth2) return reject(new Error('El inicio de sesión de Google aún no ha cargado. Vuelve a intentarlo.'));
    const client = google.accounts.oauth2.initTokenClient({
      client_id: cid,
      scope: DRIVE_SCOPE,
      hint: cloud.st.email || undefined,
      callback: (r) => {
        if (r.error) return reject(new Error(r.error_description || r.error));
        cloud.token = r.access_token;
        cloud.tokenExp = Date.now() + (+r.expires_in || 3600) * 1000;
        resolve(r.access_token);
      },
      error_callback: (e) => reject(new Error(e?.type === 'popup_closed' ? 'Se cerró la ventana de Google.' : e?.type === 'popup_failed_to_open' ? 'El navegador bloqueó la ventana de Google.' : (e?.message || 'Error de autorización'))),
    });
    client.requestAccessToken({ prompt: interactive ? (cloud.st.email ? '' : 'consent') : '' });
  });
}

/* ---------- API de Drive ---------- */
async function drive(path, opts = {}, base = API) {
  const r = await fetch(base + path, { ...opts, headers: { Authorization: `Bearer ${cloud.token}`, ...(opts.headers || {}) } });
  if (r.status === 401) { cloud.token = null; throw Object.assign(new Error('El acceso a Google ha caducado.'), { auth: true }); }
  if (!r.ok) {
    let m = `${r.status}`;
    try { const j = await r.json(); m = j.error?.message || m; } catch (e) { /* sin cuerpo */ }
    throw new Error(`Google Drive: ${m}`);
  }
  return r;
}
const q = (s) => encodeURIComponent(s);
async function findOrCreateFolder() {
  if (cloud.st.folderId) {
    try { const r = await drive(`/files/${cloud.st.folderId}?fields=id,trashed`); const j = await r.json(); if (!j.trashed) return j.id; } catch (e) { if (e.auth) throw e; }
  }
  const r = await drive(`/files?spaces=drive&fields=files(id)&q=${q(`name='${DRIVE_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)}`);
  const found = (await r.json()).files?.[0];
  if (found) return (cloud.st.folderId = found.id);
  const c = await drive('/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: DRIVE_FOLDER, mimeType: 'application/vnd.google-apps.folder' }) });
  return (cloud.st.folderId = (await c.json()).id);
}
async function findBackupFile(folderId) {
  const r = await drive(`/files?spaces=drive&fields=files(id,modifiedTime,size)&q=${q(`name='${DRIVE_FILE}' and '${folderId}' in parents and trashed=false`)}`);
  return (await r.json()).files?.[0] || null;
}
async function fetchAccount() {
  try { const r = await drive('/about?fields=user(emailAddress,displayName)'); const j = await r.json(); cloud.st.email = j.user?.emailAddress || cloud.st.email; cloud.st.name = j.user?.displayName || cloud.st.name; } catch (e) { if (e.auth) throw e; }
}

function allData() {
  save(true);
  const data = {};
  for (const u of profiles.users) data[u.id] = u.id === profiles.active ? db : readUserData(u.id);
  return { type: 'diario-entreno-todos', version: 1, exportedAt: new Date().toISOString(), device: deviceId(), profiles, data, templates: window.tplList ? tplList() : [] };
}
function deviceId() {
  if (!cloud.st.device) { cloud.st.device = uid(); cloudSave(); }
  return cloud.st.device;
}

/* ---------- Copia y restauración ---------- */
// force: sobrescribir aunque la copia de Drive sea de otro dispositivo y más reciente.
async function cloudBackup({ force = false, quiet = false } = {}) {
  if (cloud.busy) return;
  cloud.busy = true; cloudStatus('Subiendo copia…');
  try {
    const folder = await findOrCreateFolder();
    const remote = await findBackupFile(folder);
    // Conflicto: la copia remota cambió desde nuestra última subida (otro dispositivo).
    if (remote && !force && cloud.st.remoteModified && remote.modifiedTime !== cloud.st.remoteModified) {
      cloud.st.conflict = remote.modifiedTime; cloudSave();
      throw Object.assign(new Error('La copia de Drive es de otro dispositivo y más reciente. No se ha sobrescrito.'), { conflict: true });
    }
    if (remote && !force && !cloud.st.remoteModified && !quiet) {
      if (!confirm(`Ya hay una copia en Drive (${new Date(remote.modifiedTime).toLocaleString('es-ES')}). ¿Sustituirla por los datos de este dispositivo?\n\nSi quieres recuperarla, cancela y usa «Restaurar desde Drive».`)) throw Object.assign(new Error('Cancelado'), { cancel: true });
    } else if (remote && !cloud.st.remoteModified && quiet) {
      cloud.st.conflict = remote.modifiedTime; cloudSave();
      throw Object.assign(new Error('Ya hay una copia en Drive de otro momento o dispositivo. Elige en Ajustes si restaurarla o sustituirla.'), { conflict: true });
    }
    const body = JSON.stringify(allData());
    let r;
    if (remote) {
      r = await drive(`/files/${remote.id}?uploadType=media&fields=id,modifiedTime`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body }, UPLOAD);
    } else {
      const boundary = 'diario' + uid();
      const meta = { name: DRIVE_FILE, parents: [folder], mimeType: 'application/json', description: 'Copia de seguridad de Diario de entrenamiento (todos los usuarios).' };
      const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
      r = await drive('/files?uploadType=multipart&fields=id,modifiedTime', { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body: multipart }, UPLOAD);
    }
    const j = await r.json();
    Object.assign(cloud.st, { fileId: j.id, remoteModified: j.modifiedTime, lastBackup: Date.now(), lastSize: body.length, conflict: null, error: null });
    cloud.dirty = false; cloudSave();
    cloudStatus('');
    if (!quiet) toast('✓ Copia guardada en Google Drive');
    else toast('Copia guardada en Drive');
    return true;
  } catch (e) {
    if (!e.cancel) { cloud.st.error = e.message; cloudSave(); }
    cloudStatus('');
    if (!quiet && !e.cancel) alert(e.message);
    if (quiet && !e.auth) toast(e.message);
    return false;
  } finally { cloud.busy = false; refreshCloudUI(); }
}
async function cloudRestore() {
  cloud.busy = true; cloudStatus('Descargando copia…');
  try {
    const folder = await findOrCreateFolder();
    const remote = await findBackupFile(folder);
    if (!remote) throw new Error('No hay ninguna copia en Drive todavía.');
    const r = await drive(`/files/${remote.id}?alt=media`);
    const d = await r.json();
    if (restoreAllData(d, `de Google Drive (${new Date(remote.modifiedTime).toLocaleString('es-ES')})`)) {
      Object.assign(cloud.st, { fileId: remote.id, remoteModified: remote.modifiedTime, conflict: null, error: null });
      cloud.dirty = false; cloudSave();
      toast('✓ Datos restaurados desde Drive');
    }
  } catch (e) { alert('No se pudo restaurar: ' + e.message); }
  finally { cloud.busy = false; cloudStatus(''); refreshCloudUI(); }
}

/* ---------- Copia automática ---------- */
// Tras cualquier cambio: si hay acceso vigente, sube en 2 minutos sin molestar.
function cloudMarkDirty() {
  if (!cloud.st.connected) return;
  cloud.dirty = true;
  clearTimeout(cloud.timer);
  if (cloud.st.auto !== false && tokenValid()) cloud.timer = setTimeout(() => { if (tokenValid() && cloud.dirty) cloudBackup({ quiet: true }); }, 120e3);
}
// Al finalizar una sesión (hay un toque del usuario): renueva el acceso si hace falta y sube.
async function cloudOnFinish() {
  if (!cloud.st.connected || cloud.st.auto === false || !cloudClientId()) return;
  clearTimeout(cloud.timer);
  try {
    if (!tokenValid()) { await loadGIS(); await requestToken(false); }
    await cloudBackup({ quiet: true });
  } catch (e) { cloud.st.error = 'Copia automática pendiente: ' + e.message; cloudSave(); toast('Copia en Drive pendiente: toca «Copiar ahora» en Ajustes'); refreshCloudUI(); }
}

/* ---------- Interfaz ---------- */
function toast(text) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = text; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 3500);
}
function cloudStatus(m) { cloud.msg = m; const el = $('#cloud-status'); if (el) el.textContent = m; }
function refreshCloudUI() { const el = $('#cloud-card'); if (el) el.outerHTML = cloudSettingsHTML(); }
const ago = (t) => { if (!t) return 'nunca'; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'hace un momento' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : new Date(t).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };

function cloudSettingsHTML() {
  const s = cloud.st, cid = cloudClientId();
  let body;
  if (!cid) {
    body = `<div class="muted small">Para activar la copia en Google Drive, quien publica la app debe crear un ID de cliente OAuth de Google (gratuito) y ponerlo en <code>config.js</code>. Los pasos están en el README. También puedes pegarlo aquí para probar en este dispositivo:</div>
      <input id="cloud-cid" placeholder="xxxxxxxx.apps.googleusercontent.com" style="margin-top:8px" autocomplete="off">
      <button class="block" style="margin-top:8px" data-action="cloud-cid">Guardar ID de cliente</button>`;
  } else if (!s.connected) {
    body = `<div class="muted small">Guarda automáticamente una copia de <b>todos los usuarios</b> en tu Google Drive, en la carpeta «${DRIVE_FOLDER}». La app solo puede ver los archivos que ella misma crea, no el resto de tu Drive. Los vídeos no se suben.</div>
      <button class="primary block" style="margin-top:10px" data-action="cloud-connect">Conectar con Google Drive</button>`;
  } else {
    const st = s.conflict ? `<div class="mismatch" style="margin:8px 0">${ic('alert')} La copia de Drive es de ${new Date(s.conflict).toLocaleString('es-ES')} y no coincide con la última que subió este dispositivo (¿otro móvil?). Elige: restaurarla aquí o sustituirla.</div>
        <div class="grid2"><button data-action="cloud-restore">${ic('download')} Restaurar la de Drive</button><button class="danger" data-action="cloud-force">${ic('upload')} Sustituir con esta</button></div>`
      : s.error ? `<div class="mismatch" style="margin:8px 0">${esc(s.error)}</div>` : '';
    body = `<div class="row"><span class="lead-ic">${ic('cloud')}</span><div class="spacer"><b>${esc(s.email || 'Cuenta de Google')}</b>
        <div class="muted small">Última copia: ${ago(s.lastBackup)}${s.lastSize ? ` · ${fmt(s.lastSize / 1024, 0)} KB` : ''}${tokenValid() ? ' · conectado' : ''}</div></div></div>
      ${st}
      <label class="row" style="color:var(--text);font-size:.9rem;gap:8px;margin:10px 0"><input type="checkbox" data-action="cloud-auto" ${s.auto !== false ? 'checked' : ''} style="width:auto;min-height:0">
        Copia automática al finalizar cada sesión y tras los cambios</label>
      ${s.conflict ? '' : `<div class="grid2">
        <button class="primary" data-action="cloud-backup" ${cloud.busy ? 'disabled' : ''}>${ic('upload')} Copiar ahora</button>
        <button data-action="cloud-restore" ${cloud.busy ? 'disabled' : ''}>${ic('download')} Restaurar desde Drive</button>
      </div>`}
      <button class="ghost block" style="margin-top:6px" data-action="cloud-disconnect">Desconectar</button>`;
  }
  return `<div class="card" id="cloud-card">${body}<div id="cloud-status" class="muted small" style="margin-top:6px">${esc(cloud.msg)}</div></div>`;
}

// Acciones (se registran en el mismo objeto que el resto de la app).
Object.assign(actions, {
  'cloud-cid': () => {
    const v = $('#cloud-cid').value.trim();
    if (!/^[\w-]+\.apps\.googleusercontent\.com$/.test(v)) return alert('El ID de cliente debe terminar en .apps.googleusercontent.com');
    cloud.st.clientId = v; cloudSave(); refreshCloudUI();
  },
  'cloud-connect': async () => {
    try {
      cloudStatus('Abriendo Google…');
      await loadGIS();
      await requestToken(true);
      await fetchAccount();
      cloud.st.connected = true; cloud.st.auto = cloud.st.auto !== false; cloudSave();
      refreshCloudUI();
      // ¿Ya hay copia en Drive? Ofrecer restaurar antes de sobrescribir.
      const remote = await findBackupFile(await findOrCreateFolder());
      cloudSave();
      if (remote) {
        if (confirm(`Ya hay una copia en tu Drive (${new Date(remote.modifiedTime).toLocaleString('es-ES')}).\n\nAceptar: restaurarla en este dispositivo (sustituye los datos de aquí).\nCancelar: mantener los datos de este dispositivo.`)) return cloudRestore();
        cloud.st.conflict = remote.modifiedTime; cloudSave(); refreshCloudUI();
      } else await cloudBackup({ quiet: true });
    } catch (e) { cloudStatus(''); alert('No se pudo conectar: ' + e.message); refreshCloudUI(); }
  },
  'cloud-backup': async () => {
    try { if (!tokenValid()) { await loadGIS(); await requestToken(true); } await cloudBackup(); }
    catch (e) { alert(e.message); refreshCloudUI(); }
  },
  'cloud-force': async () => {
    if (!confirm('Se sustituirá la copia de Drive por los datos de este dispositivo. Drive conserva versiones anteriores durante un tiempo. ¿Continuar?')) return;
    try { if (!tokenValid()) { await loadGIS(); await requestToken(true); } await cloudBackup({ force: true }); }
    catch (e) { alert(e.message); refreshCloudUI(); }
  },
  'cloud-restore': async () => {
    try { if (!tokenValid()) { await loadGIS(); await requestToken(true); } await cloudRestore(); }
    catch (e) { alert(e.message); refreshCloudUI(); }
  },
  'cloud-auto': (el) => {
    // El manejador global de clics cancela el cambio nativo de la casilla: el estado se invierte aquí y se redibuja.
    cloud.st.auto = cloud.st.auto === false; cloudSave(); refreshCloudUI();
  },
  'cloud-disconnect': () => {
    if (!confirm('¿Desconectar Google Drive? La copia que ya está en Drive no se borra.')) return;
    try { if (cloud.token && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(cloud.token, () => {}); } catch (e) { /* nada */ }
    cloud.token = null;
    const keep = { device: cloud.st.device, clientId: cloud.st.clientId };
    cloud.st = keep; cloudSave(); refreshCloudUI();
  },
});

// La pantalla de Ajustes pudo renderizarse antes de cargar este archivo.
if (route().name === 'settings') rerender();
// Precarga del inicio de sesión de Google: al «Finalizar sesión» no debe haber esperas de red antes de pedir acceso.
if (cloud.st.connected && cloudClientId()) loadGIS().catch(() => {});
