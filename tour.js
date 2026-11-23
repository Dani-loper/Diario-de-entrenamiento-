'use strict';
/* Recorrido de primeros pasos: resalta un elemento de la pantalla con una explicación breve.
 * - «app»: la primera vez en el calendario (después de la ventana de bienvenida).
 * - «sesion»: la primera vez que se abre una sesión vacía (cómo añadir ejercicios).
 * - «series»: la primera vez que se ve una sesión con ejercicios (cómo registrar una serie y el RIR).
 * Cada uno se muestra una sola vez por dispositivo. Se puede saltar y repetir desde Ajustes › Acerca de.
 * Los pasos cuyo elemento no está en pantalla se omiten (p. ej. sin peso sugerido no se explica). */

const TOUR_KEY = 'diario-entreno.recorrido';
const tourSeen = () => { try { return JSON.parse(localStorage.getItem(TOUR_KEY)) || null; } catch (e) { return {}; } };
const tourMark = (id) => { try { localStorage.setItem(TOUR_KEY, JSON.stringify({ ...(tourSeen() || {}), [id]: 1 })); } catch (e) { /* nada */ } };

const TOURS = {
  app: [
    ['.cal', 'Calendario', 'Los días con punto tienen sesión. Toca un día para ver o registrar sus entrenamientos.'],
    ['[data-action=new-session]', 'Nueva sesión', 'Empieza el entrenamiento de hoy desde cero.'],
    ['[data-action=start-from]', 'Repetir o tabla', 'Copia una sesión anterior o usa una tabla con las series ya preparadas: el peso se calcula con tu 1RM estimado.'],
    ['.daily', 'Datos del día', 'Opcional: pasos, calorías y peso. Sirven para estimar tus calorías de mantenimiento y tu fuerza relativa.'],
    ['.tabbar a[data-tab=exercises]', 'Progreso', 'Series por músculo de la semana, evolución de cada ejercicio y constancia.'],
    ['.tabbar a[data-tab=records]', 'Récords', 'Tus mejores marcas, con sus vídeos.'],
    ['.tabbar a[data-tab=settings]', 'Ajustes', 'Modo sencillo o avanzado, descansos, discos y copias de seguridad. Tus datos se guardan solo en este móvil: guarda copias.'],
  ],
  sesion: [
    ['[data-action=add-exercise]', 'Añade un ejercicio', 'Búscalo en el catálogo o créalo con sus músculos. Si ya lo hiciste antes, se copian tus series de la última vez.'],
    ['input[data-s=title]', 'Nombre de la sesión', 'Ponle nombre (p. ej. «Pierna A»): así se compara con las sesiones anteriores del mismo tipo.'],
  ],
  series: [
    ['[data-ex="0"] .suggest', 'Peso sugerido', 'Calculado con tu 1RM estimado y el RIR que buscas. «Rellenar» lo escribe por ti.'],
    ['[data-ex="0"] tbody tr:first-child', 'Peso y repeticiones', 'Escribe los kg y las repeticiones que has hecho. Con coma o con punto, como prefieras.'],
    ['[data-set="0:0:rir"], [data-set="0:0:rpe"]', 'RIR: repeticiones en reserva', 'Cuántas repeticiones más podrías haber hecho con buena técnica: 0 = al fallo; 2 = te quedaban dos. Es la clave para que el 1RM, las series efectivas y las sugerencias salgan bien. Si dudas, la app te avisará cuando algo no cuadre.'],
    ['[data-action=toggle-done][data-i="0"][data-j="0"]', 'Marca la serie', 'Al terminar cada serie, márcala con ✓: arranca el cronómetro del descanso. Las series que vienen de una tabla solo cuentan cuando las marcas.'],
    ['[data-action=cycle-type][data-i="0"][data-j="0"]', 'Tipo de serie', 'Tócalo para cambiarlo: C = calentamiento (no cuenta en las estadísticas), D = drop set, F = al fallo.'],
    ['[data-action=set-menu][data-i="0"][data-j="0"]', 'Más opciones', 'Grabar un vídeo de la serie, compartirla o borrarla.'],
    ['[data-action=finish-session]', 'Finalizar', 'Cuando acabes, finaliza la sesión: se guarda la duración y ves el resumen completo con los músculos trabajados.'],
  ],
};

let tour = null; // { id, steps, k, el }
const visible = (el) => !!el && el.getClientRects().length > 0;

function tourCheck() {
  if (tour || (typeof modal !== 'undefined' && modal.open)) return;
  try { if (!localStorage.getItem('diario-entreno.bienvenida')) return; } catch (e) { return; }
  let seen = tourSeen();
  // Primera vez con esta versión en una instalación con uso: no se muestra solo (está en Ajustes).
  if (seen === null) { seen = db.sessions.length >= 5 ? { app: 1, sesion: 1, series: 1 } : {}; try { localStorage.setItem(TOUR_KEY, JSON.stringify(seen)); } catch (e) { /* nada */ } }
  const r = route();
  if (r.name === 'sessions' && !seen.app && !ui.csearch) return tourStart('app');
  if (r.name === 'session') {
    const s = sessionById(r.id); if (!s) return;
    if (!s.exercises.length && !seen.sesion) return tourStart('sesion');
    if (s.exercises.length && s.exercises[0].sets.length && !seen.series) return tourStart('series');
  }
}
function tourStart(id) {
  const steps = TOURS[id].filter(([sel]) => visible(document.querySelector(sel)));
  if (!steps.length) return;
  tour = { id, steps, k: 0 };
  const el = document.createElement('div');
  el.id = 'tour'; el.className = 'tour';
  el.innerHTML = '<div class="tour-hole"></div><div class="tour-tip" role="dialog" aria-modal="true" aria-labelledby="tour-title"></div>';
  document.body.appendChild(el); tour.el = el;
  tourStep();
}
function tourStep() {
  const [sel, title, text] = tour.steps[tour.k], n = tour.steps.length, last = tour.k === n - 1;
  tour.el.querySelector('.tour-tip').innerHTML = `<div class="tour-count">${tour.k + 1} de ${n}</div>
    <b id="tour-title">${esc(title)}</b><p>${esc(text)}</p>
    <div class="row">${last ? '' : '<button class="ghost small-btn" data-tour="skip">Saltar</button>'}<span class="spacer"></span>
      ${tour.k ? '<button class="ghost small-btn" data-tour="prev" aria-label="Anterior">‹</button>' : ''}
      <button class="primary small-btn" data-tour="next">${last ? 'Entendido' : 'Siguiente'}</button></div>`;
  const t = document.querySelector(sel);
  if (t && !t.closest('.tabbar')) t.scrollIntoView({ block: 'center' });
  tourPlace();
  tour.el.querySelector('[data-tour=next]').focus({ preventScroll: true });
}
// Coloca el hueco sobre el elemento y la explicación debajo (o encima si no cabe). Se recalcula al desplazar o girar.
function tourPlace() {
  if (!tour) return;
  const t = document.querySelector(tour.steps[tour.k][0]), hole = tour.el.querySelector('.tour-hole'), tip = tour.el.querySelector('.tour-tip');
  const W = innerWidth, H = innerHeight, pad = 6;
  const r = t ? t.getBoundingClientRect() : { left: W / 2, top: H / 2, width: 0, height: 0, bottom: H / 2 };
  Object.assign(hole.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
  const tw = Math.min(340, W - 32), th = tip.offsetHeight;
  const below = r.bottom + pad + 12 + th <= H - 8, top = below ? r.bottom + pad + 12 : Math.max(8, r.top - pad - 12 - th);
  const left = Math.min(Math.max(16, r.left + r.width / 2 - tw / 2), W - 16 - tw);
  Object.assign(tip.style, { width: `${tw}px`, left: `${left}px`, top: `${top}px` });
}
function tourEnd(done = true) {
  if (!tour) return;
  if (done) tourMark(tour.id);
  tour.el.remove(); tour = null;
}
document.addEventListener('click', (e) => {
  if (!tour || !e.target.closest('#tour')) return;
  e.preventDefault(); e.stopPropagation();
  const b = e.target.closest('[data-tour]'); if (!b) return; // fuera de la explicación no hace nada
  const a = b.dataset.tour;
  if (a === 'skip') return tourEnd();
  if (a === 'prev') { tour.k = Math.max(0, tour.k - 1); return tourStep(); }
  if (tour.k === tour.steps.length - 1) return tourEnd();
  tour.k++; tourStep();
}, true);
document.addEventListener('keydown', (e) => { if (tour && e.key === 'Escape') tourEnd(); });
addEventListener('scroll', () => requestAnimationFrame(tourPlace), { passive: true });
addEventListener('resize', () => requestAnimationFrame(tourPlace));
// Al cambiar de pantalla, el recorrido en curso se cierra (sin darlo por visto) y se comprueba si toca otro.
addEventListener('hashchange', () => tourEnd(false));
modal.addEventListener('close', () => setTimeout(tourCheck, 60));

// Ajustes › Acerca de
function tourSettingsHTML() {
  return `<h2>Recorrido por la app</h2>
    <div class="card"><div class="muted small" style="margin-bottom:8px">Las explicaciones de la primera vez: calendario, cómo registrar una sesión y qué es el RIR.</div>
      <button class="block" data-action="tour-again">Ver el recorrido otra vez</button></div>`;
}
Object.assign(actions, {
  'tour-again': () => {
    try { localStorage.setItem(TOUR_KEY, '{}'); } catch (e) { /* nada */ }
    ui.csearch = '';
    if (location.hash === '#/' || location.hash === '') { rerender(); setTimeout(tourCheck, 60); } else location.hash = '#/';
  },
});
// Tras cada pintado: recoloca el recorrido en curso (el DOM se ha sustituido) o comprueba si toca empezar uno.
const tourRefresh = () => (tour ? tourPlace() : tourCheck());
Object.assign(window, { tourCheck, tourRefresh, tourStart, tourEnd, tourSettingsHTML });
setTimeout(tourCheck, 60);
