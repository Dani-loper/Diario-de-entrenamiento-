'use strict';
/* Versión instalada y aviso de versiones nuevas (app Android).
 * Un APK instalado a mano no se actualiza solo. GitHub Actions escribe version.json dentro del APK con su número;
 * la app consulta una vez al día la última publicación en GitHub Releases y, si hay una más nueva, lo avisa con un
 * enlace para descargarla. En la web no hace falta: siempre se carga la última versión. */
const RELEASES_API = 'https://api.github.com/repos/Dani-loper/Diario-de-entrenamiento-/releases/latest';
const UPD_KEY = 'diario-entreno.actualizacion';
const upd = (() => { try { return JSON.parse(localStorage.getItem(UPD_KEY)) || {}; } catch (e) { return {}; } })();
const updSave = () => { try { localStorage.setItem(UPD_KEY, JSON.stringify(upd)); } catch (e) { /* nada */ } };
let installed = null; // { version: '1.5', code: 5 } dentro del APK
const codeOf = (tag) => { const m = /(\d+)\.(\d+)$/.exec(tag || ''); return m ? +m[2] : null; };

async function readInstalled() {
  try { const r = await fetch('version.json', { cache: 'no-store' }); if (r.ok) installed = await r.json(); } catch (e) { /* web: no hay version.json */ }
}
async function checkUpdate(force = false) {
  if (!IS_NATIVE || !installed?.code) return;
  if (!force && upd.checkedAt && Date.now() - upd.checkedAt < 20 * 3600e3) return;
  try {
    const r = await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    Object.assign(upd, { checkedAt: Date.now(), latest: { tag: j.tag_name, code: codeOf(j.tag_name), url: j.html_url, name: j.name } }); updSave();
    if (force) toast(updateAvailable() ? `Hay una versión nueva: ${j.name}` : 'Tienes la última versión');
    rerender();
  } catch (e) { if (force) toast('No se pudo comprobar: ' + e.message); }
}
const updateAvailable = () => !!(IS_NATIVE && installed?.code && upd.latest?.code && upd.latest.code > installed.code && upd.dismissed !== upd.latest.code);
function updateBannerHTML() {
  if (!updateAvailable()) return '';
  return `<div class="card reminder">
    <div><b>${ic('download')} Hay una versión nueva de la app (${esc(upd.latest.name || upd.latest.tag)})</b></div>
    <div class="muted small" style="margin:4px 0 10px">Descarga el APK y ábrelo: se instala encima de la actual sin perder tus datos.</div>
    <div class="grid2"><a class="btn primary" href="${esc(upd.latest.url)}" target="_blank" rel="noopener">Descargar</a><button class="ghost" data-action="update-dismiss">Más tarde</button></div>
  </div>`;
}
function versionSettingsHTML() {
  const st = kv.stats();
  return `<h2>Versión y almacenamiento</h2><div class="card">
    <div class="row"><span class="spacer">${IS_NATIVE ? `App Android <b>${esc(installed?.version || '¿?')}</b>` : 'Versión web (se actualiza sola)'}</span>
      ${IS_NATIVE ? '<button class="small-btn" data-action="update-check">Buscar actualizaciones</button>' : ''}</div>
    ${IS_NATIVE && upd.checkedAt ? `<div class="muted small">Última comprobación: ${new Date(upd.checkedAt).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${upd.latest ? ` · última publicada: ${esc(upd.latest.name || upd.latest.tag)}` : ''}</div>` : ''}
    <div id="storage-info" class="muted small" style="margin-top:8px">Datos: ${fmt(st.chars / 1048576, 1)} MB en ${st.backend}.</div>
  </div>`;
}
// Espacio: aviso si el almacenamiento del navegador se acerca a su límite.
async function fillStorageInfo() {
  const el = $('#storage-info'); if (!el || !navigator.storage?.estimate) return;
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate(), st = kv.stats();
    const pct = quota ? usage / quota * 100 : 0;
    el.innerHTML = `Datos: ${fmt(st.chars / 1048576, 1)} MB en ${st.backend} · espacio usado por la app (con vídeos): ${fmt(usage / 1048576, 0)} MB de ${fmt(quota / 1048576, 0)} MB (${fmt(pct, 0)} %).`
      + (pct > 80 ? ' <span class="mismatch">Queda poco espacio: borra vídeos antiguos o guarda una copia y libera espacio.</span>' : '');
  } catch (e) { /* sin estimación */ }
}

Object.assign(actions, {
  'update-check': () => checkUpdate(true),
  'update-dismiss': () => { upd.dismissed = upd.latest?.code; updSave(); rerender(); },
});
Object.assign(window, { updateBannerHTML, versionSettingsHTML, fillStorageInfo });
readInstalled().then(() => checkUpdate()).then(() => rerender());
