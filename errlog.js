'use strict';
/* Registro de errores e informe para enviar (Ajustes › Acerca de › Informe de error).
 * Se carga el primero para capturar también los errores del arranque. Guarda los últimos 30 errores en este dispositivo
 * (localStorage): mensaje, archivo y línea, pantalla y hora. No sale de aquí salvo que el usuario copie o comparta el
 * informe, que no incluye nombres ni datos de entrenamiento: solo versión, dispositivo, recuentos y los errores. */

const ERR_KEY = 'diario-entreno.errores', ERR_KEEP = 30;
const SCREEN_ID = /\/(?=[a-z]*\d)[a-z0-9]{8,}$/i; // identificador de sesión o ejercicio en la ruta (no se envía)
const errList = () => { try { return JSON.parse(localStorage.getItem(ERR_KEY)) || []; } catch (e) { return []; } };
function errLog(msg, extra = {}) {
  try {
    const list = errList();
    const rec = { t: Date.now(), msg: String(msg).slice(0, 300), where: extra.where || '', stack: String(extra.stack || '').split('\n').slice(0, 4).join(' | ').slice(0, 400), screen: (location.hash || '#/').replace(SCREEN_ID, '/…') };
    // El mismo error repetido seguido no llena el registro: se cuenta.
    const last = list[list.length - 1];
    if (last && last.msg === rec.msg && last.where === rec.where) { last.n = (last.n || 1) + 1; last.t = rec.t; } else list.push(rec);
    localStorage.setItem(ERR_KEY, JSON.stringify(list.slice(-ERR_KEEP)));
  } catch (e) { /* sin almacenamiento: no se registra */ }
}
const srcOf = (f, l) => (f ? `${String(f).split('/').pop()}:${l || '?'}` : '');
addEventListener('error', (e) => { if (e.message) errLog(e.message, { where: srcOf(e.filename, e.lineno), stack: e.error?.stack }); });
addEventListener('unhandledrejection', (e) => errLog('Promesa sin capturar: ' + (e.reason?.message || e.reason), { stack: e.reason?.stack }));

// Texto del informe. Sin nombres ni datos de entrenamiento.
async function errReport() {
  let web = '';
  try { web = (await caches.keys()).find((k) => k.startsWith('diario-v')) || ''; } catch (e) { /* sin caché */ }
  const st = typeof kv !== 'undefined' ? kv.stats() : null;
  let users = '?', sessions = '?';
  try { users = profiles.users.length; sessions = db.sessions.length; } catch (e) { /* la app no llegó a cargar */ }
  const list = errList();
  const when = (t) => new Date(t).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return [
    'INFORME DE ERROR · Diario de entrenamiento',
    `Fecha: ${when(Date.now())}`,
    `Versión: ${IS_NATIVE ? `app Android ${typeof installed !== 'undefined' && installed?.version ? installed.version : '¿?'}` : 'web'}${web ? ` (${web})` : ''}`,
    `Dispositivo: ${navigator.userAgent}`,
    `Pantalla: ${innerWidth}×${innerHeight} · ${devicePixelRatio}x · idioma ${navigator.language}`,
    `Almacenamiento: ${st ? `${st.backend}, ${(st.chars / 1048576).toFixed(2)} MB, pendientes ${st.pending}${st.lastError ? `, último fallo: ${st.lastError.message || st.lastError}` : ''}` : '¿?'}`,
    `Usuarios en el dispositivo: ${users} · sesiones del activo: ${sessions}`,
    `Modo: ${(() => { try { return `${db.settings.level || '?'}, cronómetro ${db.settings.timerMode || 'auto'}, microciclo ${db.settings.weekLen || 7} días`; } catch (e) { return '?'; } })()}`,
    `Pantalla actual: ${(location.hash || '#/').replace(SCREEN_ID, '/…')}`,
    '',
    list.length ? `Errores registrados (${list.length}, del más reciente al más antiguo):` : 'No hay errores registrados.',
    ...list.slice().reverse().map((e) => `· ${when(e.t)}${e.n > 1 ? ` (×${e.n})` : ''} [${e.screen}] ${e.msg}${e.where ? ` @ ${e.where}` : ''}${e.stack ? `\n    ${e.stack}` : ''}`),
  ].join('\n');
}

function errSettingsHTML() {
  const list = errList(), last = list[list.length - 1];
  return `<h2>Informe de error</h2>
    <div class="card">
      <div class="muted small" style="margin-bottom:8px">Si algo falla, envía este informe a quien te pasó la app y explica qué estabas haciendo. Incluye la versión, el móvil y los errores registrados; <b>no incluye nombres ni datos de tus entrenamientos</b>.</div>
      <div class="small" style="margin-bottom:8px">${list.length ? `Errores registrados: <b>${list.length}</b> · el último, ${new Date(last.t).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'No hay errores registrados.'}</div>
      <div class="grid2"><button data-action="err-copy">Copiar informe</button><button data-action="err-share">${ic('share')} Enviar…</button></div>
      ${list.length ? '<button class="ghost block small-btn" style="margin-top:6px" data-action="err-clear">Borrar el registro</button>' : ''}
    </div>`;
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* sin permiso: método antiguo */ }
  const ta = Object.assign(document.createElement('textarea'), { value: text }); ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* nada */ }
  ta.remove(); return ok;
}
// Las acciones se registran cuando la app ha cargado (este archivo va antes que app.js).
document.addEventListener('app-ready', () => {
  Object.assign(actions, {
    'err-copy': async () => { const ok = await copyText(await errReport()); toast(ok ? '✓ Informe copiado: pégalo en WhatsApp o en un correo' : 'No se pudo copiar: usa «Enviar…»'); },
    'err-share': async () => {
      const text = await errReport();
      try {
        if (IS_NATIVE) await nativeShareText(text);
        else if (navigator.share) await navigator.share({ title: 'Informe de error', text });
        else { await copyText(text); toast('Copiado: pégalo en un correo o mensaje'); }
      } catch (e) { if (!/cancel|abort/i.test(e?.message || e?.name || '')) toast('No se pudo enviar: ' + (e?.message || e)); }
    },
    'err-clear': () => { try { localStorage.removeItem(ERR_KEY); } catch (e) { /* nada */ } rerender(); toast('Registro de errores borrado'); },
  });
});
Object.assign(window, { errLog, errReport, errSettingsHTML });
