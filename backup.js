'use strict';
/* Copias de seguridad locales, sin nube.
 * 1) Copias automáticas dentro de la app (IndexedDB): una al día y antes de operaciones destructivas
 *    (restaurar, importar, borrar usuario o datos). Se guardan las últimas 14. Protegen frente a errores,
 *    no frente a perder el móvil o borrar los datos del navegador.
 * 2) «Guardar copia en el móvil»: archivo JSON con todos los usuarios que se guarda en Archivos (iPhone) o
 *    Descargas (Android) mediante el menú de compartir o una descarga. Sobrevive aunque se borre la app.
 * 3) Aviso en el calendario si hace más de 14 días que no se guarda una copia fuera de la app. */

const SNAP_DB = 'diario-entreno-copias';
const SNAP_KEEP = 14;
const LOCAL_KEY = 'diario-entreno.copias';
const REMIND_DAYS = 14;

const localBk = (() => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || {}; } catch (e) { return {}; } })();
const localBkSave = () => { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(localBk)); } catch (e) { /* nada */ } };

function backupData() {
  save(true);
  const data = {};
  for (const u of profiles.users) data[u.id] = u.id === profiles.active ? db : readUserData(u.id);
  return { type: 'diario-entreno-todos', version: 1, exportedAt: new Date().toISOString(), profiles, data, templates: window.tplList ? tplList() : [] };
}
const countSessions = (d) => Object.values(d.data).reduce((a, x) => a + (x?.sessions?.length || 0), 0);

/* ---------- Copias automáticas (IndexedDB) ---------- */
let sdbPromise = null;
function sdb() {
  if (!sdbPromise) {
    sdbPromise = new Promise((resolve, reject) => {
      const r = indexedDB.open(SNAP_DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('snaps', { keyPath: 'id' });
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => { sdbPromise = null; reject(r.error); };
    });
  }
  return sdbPromise;
}
async function stx(mode, fn) {
  const d = await sdb();
  return new Promise((resolve, reject) => {
    const tx = d.transaction('snaps', mode);
    const res = fn(tx.objectStore('snaps'));
    tx.oncomplete = () => resolve(res && 'result' in res ? res.result : undefined);
    tx.onerror = () => reject(tx.error);
  });
}
// Lista sin el contenido (para mostrarla rápido).
const snapList = () => stx('readonly', (st) => st.getAll()).then((all) => all.map(({ data, ...meta }) => meta).sort((a, b) => b.createdAt - a.createdAt));
const snapGet = (id) => stx('readonly', (st) => st.get(id));

// Los datos se capturan de forma síncrona: llamada justo antes de una operación destructiva,
// la copia refleja el estado anterior aunque el guardado en IndexedDB termine después.
function takeSnapshot(reason) {
  const d = backupData();
  const rec = { id: uid(), createdAt: Date.now(), reason, users: d.profiles.users.map((u) => u.name), sessions: countSessions(d), data: JSON.stringify(d) };
  rec.size = rec.data.length;
  return stx('readwrite', (st) => st.put(rec))
    .then(() => snapList())
    .then((list) => Promise.all(list.slice(SNAP_KEEP).map((s) => stx('readwrite', (st) => st.delete(s.id)))))
    .catch((e) => console.warn('No se pudo guardar la copia automática', e));
}
async function dailySnapshot() {
  try {
    const list = await snapList();
    const any = profiles.users.some((u) => ((u.id === profiles.active ? db : readUserData(u.id))?.sessions.length || 0) > 0);
    if (any && (!list.length || Date.now() - list[0].createdAt > 20 * 3600e3)) await takeSnapshot('Diaria');
  } catch (e) { /* IndexedDB no disponible */ }
}

/* ---------- Copia en los archivos del móvil ---------- */
function markExported() {
  if (!ui.pendingExport) return;
  ui.pendingExport = false;
  localBk.lastExport = Date.now(); localBkSave();
  rerender(); // quita el aviso y actualiza «última copia» en la pantalla de fondo (la ventana sigue abierta)
}
// Descargar o compartir el archivo cuenta como copia guardada fuera de la app.
document.addEventListener('click', (e) => { if (e.target.closest('a[download]')) setTimeout(markExported, 0); });

function saveBackupFile(d = backupData(), label = '') {
  const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
  ui.pendingExport = true;
  showShareResult(blob, `diario-entreno-copia-${todayISO()}${label}.json`, 'Copia de seguridad lista',
    `<div class="muted small">${d.profiles.users.length} usuario${d.profiles.users.length === 1 ? '' : 's'} · ${countSessions(d)} sesiones. Los vídeos no se incluyen.</div>
     <div class="hint"><b>iPhone:</b> «Compartir o guardar» → <b>Guardar en Archivos</b> → «En mi iPhone».<br>
     <b>Android:</b> «Descargar» (queda en la carpeta <b>Descargas</b>).<br>
     De vez en cuando, pásala también a un ordenador o envíatela por correo: si pierdes el móvil, la copia se pierde con él.</div>`);
}

/* ---------- Interfaz ---------- */
const agoDays = (t) => t ? Math.floor((Date.now() - t) / 864e5) : null;
// Última copia fuera de la app: guardada a mano o automática en Documentos (app Android).
const lastOutside = () => Math.max(localBk.lastExport || 0, (typeof autoEnabled === 'function' && autoEnabled() && localBk.autoLast) || 0) || null;
function backupStatusHTML() {
  const d = agoDays(lastOutside());
  const txt = d == null ? 'nunca' : d === 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`;
  const warn = d == null || d > REMIND_DAYS;
  return `<div class="${warn ? 'mismatch' : 'muted small'}" style="margin-bottom:8px">Última copia guardada fuera de la app: <b>${txt}</b>.</div>`;
}
/* iPhone/iPad: Safari borra los datos de una web tras 7 días sin abrirla (ITP), salvo si está instalada en la
 * pantalla de inicio. Se avisa solo en iOS cuando la app no se ejecuta instalada. */
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isInstalled = () => IS_NATIVE || navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
function installReminderHTML() {
  if (!isIOS() || isInstalled() || localBk.installDismissed) return '';
  return `<div class="card reminder">
    <div><b>${ic('alert')} Instala la app para no perder tus datos</b></div>
    <div class="muted small" style="margin:4px 0 10px">En iPhone, si usas la app desde Safari sin instalarla, el sistema puede <b>borrar todo lo registrado</b> tras 7 días sin abrirla.
      Para evitarlo: botón <b>Compartir</b> → <b>Añadir a pantalla de inicio</b>, y ábrela desde ese icono. Guarda antes una copia de seguridad: los datos de Safari no pasan a la app instalada.</div>
    <div class="grid2"><button class="primary" data-action="export-all">Guardar copia</button><button class="ghost" data-action="dismiss-install">Ya la tengo instalada</button></div>
  </div>`;
}
function backupReminderHTML() {
  const total = profiles.users.reduce((a, u) => a + ((u.id === profiles.active ? db : readUserData(u.id))?.sessions.length || 0), 0);
  const d = agoDays(lastOutside());
  if (total < 3 || (d != null && d <= REMIND_DAYS)) return '';
  if (localBk.snoozeUntil && Date.now() < localBk.snoozeUntil) return '';
  return `<div class="card reminder">
    <div><b>${ic('save')} Guarda una copia de seguridad</b></div>
    <div class="muted small" style="margin:4px 0 10px">${d == null ? 'Aún no has guardado ninguna copia fuera de la app.' : `Tu última copia fuera de la app es de hace ${d} días.`}
      Si se borran los datos del navegador o pierdes el móvil, se pierde todo lo registrado.</div>
    <div class="grid2"><button class="primary" data-action="export-all">Guardar copia</button><button class="ghost" data-action="snooze-backup">Más tarde</button></div>
  </div>`;
}
async function fillSnapList() {
  const el = $('#snap-list'); if (!el) return;
  try {
    const list = await snapList();
    el.innerHTML = list.length ? list.map((s) => `<div class="snap">
        <div class="spacer"><b>${new Date(s.createdAt).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</b> <span class="tag">${esc(s.reason)}</span>
          <div class="muted small">${s.users.length} usuario${s.users.length === 1 ? '' : 's'} · ${s.sessions} sesiones · ${fmt(s.size / 1024, 0)} KB</div></div>
        <button class="icon ghost" data-action="snap-save" data-id="${s.id}" aria-label="Guardar esta copia en el móvil">${ic('save')}</button>
        <button class="small-btn" data-action="snap-restore" data-id="${s.id}">Restaurar</button>
      </div>`).join('') : '<div class="muted small">Todavía no hay copias automáticas. Se crea una al día en cuanto haya sesiones.</div>';
  } catch (e) { el.innerHTML = '<div class="muted small">Este navegador no permite copias automáticas (IndexedDB no disponible).</div>'; }
}

Object.assign(actions, {
  'export-all': () => saveBackupFile(),
  'dismiss-install': () => { localBk.installDismissed = true; localBkSave(); rerender(); },
  'snooze-backup': () => { localBk.snoozeUntil = Date.now() + 3 * 864e5; localBkSave(); rerender(); },
  'snap-now': async () => { await takeSnapshot('Manual'); fillSnapList(); toast('✓ Copia automática creada'); },
  'snap-restore': async (el) => {
    const s = await snapGet(el.dataset.id);
    if (!s) return alert('La copia ya no existe.');
    restoreAllData(JSON.parse(s.data), `automática del ${new Date(s.createdAt).toLocaleString('es-ES')}`);
  },
  'snap-save': async (el) => {
    const s = await snapGet(el.dataset.id);
    if (!s) return alert('La copia ya no existe.');
    saveBackupFile(JSON.parse(s.data), `-${new Date(s.createdAt).toISOString().slice(11, 16).replace(':', '')}`);
  },
});

dailySnapshot();
// El calendario o Ajustes pudieron dibujarse antes de cargar este archivo.
if (['sessions', 'settings'].includes(route().name)) rerender();
