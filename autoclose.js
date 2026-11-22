'use strict';
/* Sesiones que se quedan abiertas: si pasan X horas sin actividad (última serie marcada o, si no hay, el inicio),
 * se avisa con una tarjeta (no bloquea) o, si así se configura, se cierran solas. La hora de fin es la de la última
 * actividad (+ 2 min), no la del momento en que se cierra: así la duración de la sesión es real. */

const closeAfterH = () => db.settings.closeAfterH ?? 2; // 0 = nunca
const GRACE_MS = 2 * 60e3;
function lastActivity(s) {
  const t = Math.max(s.startedAt || 0, ...s.exercises.flatMap((e) => e.sets.map((x) => x.doneAt || 0)));
  return t;
}
// Abiertas y sin actividad desde hace más del umbral. Se ignoran sesiones sin hora de inicio válida.
function staleSessions(now = Date.now()) {
  const h = closeAfterH(); if (!h) return [];
  return db.sessions.filter((s) => !s.endedAt && s.startedAt > 1e12 && now - lastActivity(s) > h * 3600e3 && !(s.keepOpenUntil > now));
}
function closeSession(s, auto = false) {
  s.endedAt = Math.max(s.startedAt, lastActivity(s) + GRACE_MS);
  if (auto) s.autoClosed = true;
  delete s.keepOpenUntil;
}
const clockTxt = (t) => new Date(t).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
const agoTxt = (ms) => { const m = Math.round(ms / 60000); return m < 60 ? `${m} min` : m < 48 * 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${Math.round(m / 1440)} días`; };

function autoCloseCheck() {
  if (!db.settings.autoClose) return 0;
  const list = staleSessions(); list.forEach((s) => closeSession(s, true));
  if (list.length) { save(true); toast(list.length === 1 ? `Sesión «${list[0].title || 'sin nombre'}» cerrada a las ${clockTxt(list[0].endedAt)} (sin actividad)` : `${list.length} sesiones sin actividad cerradas`); }
  return list.length;
}
function staleBannerHTML(onlyId) {
  if (db.settings.autoClose) return '';
  const now = Date.now();
  return staleSessions(now).filter((s) => !onlyId || s.id === onlyId).map((s) => {
    const last = lastActivity(s), end = Math.max(s.startedAt, last + GRACE_MS);
    return `<div class="card reminder stale">
      <div><b>${ic('hourglass')} «${esc(s.title || 'Sesión')}» sigue abierta</b> ${info('autoclose')}</div>
      <div class="muted small" style="margin:4px 0 10px">${fmtDate(s.date)} · última actividad hace ${agoTxt(now - last)} (${clockTxt(last)}).</div>
      <div class="grid2"><button class="primary" data-action="stale-close" data-id="${s.id}">Cerrar (fin ${clockTxt(end)})</button>
        <button class="ghost" data-action="stale-keep" data-id="${s.id}">Sigo entrenando</button></div>
    </div>`;
  }).join('');
}
function closeSettingsHTML() {
  return `<h2>Sesiones abiertas</h2><div class="card">
    <label>Avisar si una sesión sigue abierta sin actividad durante ${info('autoclose')}</label>
    <select data-setting="closeAfterH">${[[1, '1 hora'], [2, '2 horas'], [3, '3 horas'], [6, '6 horas'], [0, 'Nunca']].map(([v, l]) => `<option value="${v}" ${closeAfterH() === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <label class="row" style="margin-top:10px;color:var(--text);font-size:.9rem;gap:8px"><input type="checkbox" id="autoclose-chk" ${db.settings.autoClose ? 'checked' : ''} style="width:auto;min-height:0"> Cerrarlas automáticamente, sin preguntar</label>
    <div class="muted small" style="margin-top:6px">La hora de fin es la de la última serie marcada, para que la duración sea real. Una sesión cerrada se puede reabrir desde la propia sesión.</div>
  </div>`;
}

Object.assign(actions, {
  'stale-close': (el) => { const s = sessionById(el.dataset.id); if (!s) return; closeSession(s); save(true); if (currentSession()?.id === s.id) stopTimer(); rerender(); toast(`Sesión cerrada a las ${clockTxt(s.endedAt)}`); },
  'stale-keep': (el) => { const s = sessionById(el.dataset.id); if (!s) return; s.keepOpenUntil = Date.now() + closeAfterH() * 3600e3; save(); rerender(); },
});
document.addEventListener('change', (e) => { if (e.target.id === 'autoclose-chk') { db.settings.autoClose = e.target.checked; save(); if (autoCloseCheck()) rerender(); } });
// Al volver a la app (estaba en segundo plano) se revisa.
document.addEventListener('visibilitychange', () => { if (!document.hidden && (autoCloseCheck() || staleSessions().length)) rerender(); });
Object.assign(window, { staleBannerHTML, closeSettingsHTML, autoCloseCheck, staleSessions, lastActivity });
if (autoCloseCheck() || staleSessions().length) rerender();
