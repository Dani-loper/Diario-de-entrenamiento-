'use strict';
/* Copia automática en el móvil (solo en la app Android).
 * Guarda una copia completa (todos los usuarios y tablas, como «Guardar copia en el móvil») en la carpeta pública
 * Documentos/DiarioEntreno, un archivo por día: diario-entreno-auto-AAAA-MM-DD.json. Se conservan los últimos 10 días.
 * - Sobrevive si se desinstala la app o se borran sus datos; NO si se pierde el móvil: por eso conviene sincronizar
 *   esa carpeta con Drive o pasarla al ordenador de vez en cuando.
 * - Cuándo: al abrir la app, al finalizar una sesión y al pasar la app a segundo plano, solo si los datos han cambiado
 *   desde la última copia (y como mucho una vez cada 5 minutos).
 * - Para restaurar: Ajustes › Importar JSON y elegir el archivo en Documentos/DiarioEntreno.
 * - Android 10 o anterior pide permiso de almacenamiento la primera vez; Android 11+ no lo necesita para los archivos
 *   que crea la propia app. */

const AUTO_DIR = 'DiarioEntreno', AUTO_PREFIX = 'diario-entreno-auto-', AUTO_KEEP = 10, AUTO_MIN_GAP = 5 * 60e3;
const autoAvailable = () => !!nativePlugin('Filesystem');
const autoEnabled = () => autoAvailable() && !localBk.autoOff;
// Huella del contenido (sin la fecha de exportación) para no repetir copias iguales.
function contentHash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h); }
let autoRunning = false;

async function autoBackup({ force = false } = {}) {
  const Fs = nativePlugin('Filesystem');
  if (!Fs || autoRunning || (!force && !autoEnabled())) return null;
  if (!force && localBk.autoLast && Date.now() - localBk.autoLast < AUTO_MIN_GAP) return null;
  const d = backupData();
  if (!countSessions(d)) return null;
  const hash = contentHash(JSON.stringify({ ...d, exportedAt: null }));
  if (!force && hash === localBk.autoHash) return null;
  autoRunning = true;
  try {
    // Android 10 o anterior: permiso de almacenamiento (en Android 11+ devuelve «granted» sin preguntar).
    // Se pregunta una sola vez por iniciativa de la app; después, solo al pulsar «Guardar una copia ahora».
    const perm = await Fs.checkPermissions();
    if (perm.publicStorage !== 'granted') {
      const ask = force || !localBk.autoPermAsked;
      localBk.autoPermAsked = true; localBkSave();
      if (!ask || (await Fs.requestPermissions()).publicStorage !== 'granted') throw new Error('Android no ha dado permiso para guardar en Documentos. Pulsa «Guardar una copia ahora» y acéptalo.');
    }
    const text = JSON.stringify(d), base = `${AUTO_DIR}/${AUTO_PREFIX}${todayISO()}`;
    let name = `${base}.json`;
    try { await Fs.writeFile({ path: name, data: text, directory: 'DOCUMENTS', encoding: 'utf8', recursive: true }); } catch (e) {
      // Un archivo de hoy creado por una instalación anterior de la app no se puede sobrescribir: se usa otro nombre.
      name = `${base}-${new Date().toTimeString().slice(0, 5).replace(':', '')}.json`;
      await Fs.writeFile({ path: name, data: text, directory: 'DOCUMENTS', encoding: 'utf8', recursive: true });
    }
    await autoPrune(Fs);
    Object.assign(localBk, { autoLast: Date.now(), autoHash: hash, autoFile: name.slice(AUTO_DIR.length + 1), autoErr: null });
    localBkSave();
    return name;
  } catch (e) {
    localBk.autoErr = e?.message || String(e); localBkSave();
    return null;
  } finally { autoRunning = false; }
}
// Deja los archivos automáticos de los últimos AUTO_KEEP días (el nombre empieza por la fecha, así que se ordenan solos).
async function autoPrune(Fs) {
  try {
    const { files } = await Fs.readdir({ path: AUTO_DIR, directory: 'DOCUMENTS' });
    const names = files.map((f) => (typeof f === 'string' ? f : f.name)).filter((n) => n.startsWith(AUTO_PREFIX)).sort();
    const days = [...new Set(names.map((n) => n.slice(AUTO_PREFIX.length, AUTO_PREFIX.length + 10)))];
    const keep = new Set(days.slice(-AUTO_KEEP));
    for (const n of names) if (!keep.has(n.slice(AUTO_PREFIX.length, AUTO_PREFIX.length + 10))) await Fs.deleteFile({ path: `${AUTO_DIR}/${n}`, directory: 'DOCUMENTS' }).catch(() => {});
  } catch (e) { /* listar puede fallar en algunos móviles: no impide la copia */ }
}

// Ajustes › Copia de seguridad (solo en la app Android).
function autoBackupSettingsHTML() {
  if (!autoAvailable()) return '';
  const on = autoEnabled(), d = agoDays(localBk.autoLast);
  const when = localBk.autoLast ? (d === 0 ? `hoy a las ${new Date(localBk.autoLast).toTimeString().slice(0, 5)}` : d === 1 ? 'ayer' : `hace ${d} días`) : 'todavía ninguna';
  return `<div class="auto-bk">
      <label class="row" style="gap:8px;color:var(--text)"><input type="checkbox" id="auto-bk-chk" ${on ? 'checked' : ''} style="width:auto;min-height:0"> <b>Copia automática en el móvil</b></label>
      <div class="muted small">Cada día que cambian tus datos se guarda una copia en <b>Documentos/${AUTO_DIR}</b> (últimos ${AUTO_KEEP} días). Sigue ahí aunque desinstales la app; si pierdes el móvil, no: sincroniza esa carpeta con Drive o pásala al ordenador de vez en cuando.</div>
      ${on ? `<div class="small" style="margin-top:4px">Última: <b>${when}</b>${localBk.autoFile && localBk.autoLast ? ` · ${esc(localBk.autoFile)}` : ''}</div>` : ''}
      ${on && localBk.autoErr ? `<div class="mismatch" style="margin-top:4px">No se pudo guardar: ${esc(localBk.autoErr)}</div>` : ''}
      ${on ? '<button class="block small-btn" style="margin-top:6px" data-action="auto-now">Guardar una copia ahora</button>' : ''}
    </div>`;
}

Object.assign(actions, {
  'auto-now': async () => {
    const n = await autoBackup({ force: true });
    rerender(); toast(n ? `✓ Copia guardada en Documentos/${AUTO_DIR}` : 'No se pudo guardar la copia');
  },
});
document.addEventListener('change', (e) => {
  if (e.target.id !== 'auto-bk-chk') return;
  localBk.autoOff = !e.target.checked; localBkSave();
  if (e.target.checked) autoBackup({ force: true }).then(() => rerender()); else rerender();
});
// Al finalizar una sesión.
const finishSession = actions['finish-session'];
if (finishSession) actions['finish-session'] = (...a) => { const r = finishSession(...a); setTimeout(() => autoBackup(), 800); return r; };
// Al pasar a segundo plano (cerrar la app o cambiar a otra).
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') autoBackup(); });
// Al abrir, sin retrasar el arranque.
if (autoAvailable()) setTimeout(() => autoBackup(), 4000);

Object.assign(window, { autoBackup, autoBackupSettingsHTML, contentHash });
