'use strict';
/* 1) Peso sugerido para hoy (ejercicios con peso):
 *    peso = 1RM estimado de referencia × %1RM(reps objetivo, RIR objetivo) de la tabla RTS, redondeado al incremento mínimo.
 *    - Referencia: las series ya hechas HOY (autorregulación: si hoy vas más fuerte o más cansado, la sugerencia se ajusta);
 *      si aún no hay, la última sesión de ese ejercicio; si no, el mejor de los últimos 120 días.
 *    - Objetivo: el de la tabla si la serie viene de una; si no, lo que hiciste en la serie equivalente de la última sesión.
 *    Solo se muestra en series sin peso escrito y sin marcar; no rellena nada salvo que se pulse «Rellenar».
 * 2) Calentamiento y discos: botón pequeño en la siguiente serie pendiente. Genera la rampa de calentamiento
 *    y los discos por lado para la barra configurada. */

const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
const ALL_PLATES = [25, 20, 15, 10, 5, 2.5, 2, 1.25, 1, 0.5, 0.25];
const plateStep = () => db.settings.plateStep || 2.5;
const barWeight = () => db.settings.bar ?? 20;
const platesAvail = () => db.settings.plates || DEFAULT_PLATES;
const roundStep = (w, step = plateStep()) => Math.round(w / step) * step;

// Mejor 1RM estimado de las series efectivas de una entrada (solo series hechas si onlyDone).
function entryE1(entry, onlyDone) {
  return maxOf(entry.sets.filter((x) => isWork(x) && (!onlyDone || x.done)).map(e1rm));
}
function suggestFor(s, i, j) {
  const ex = s.exercises[i], def = exById(ex.exerciseId), set = ex.sets[j];
  if (!def || def.mode !== 'wr' || !set || set.type === 'C' || set.done || set.w != null) return null;
  // Objetivo de reps y RIR
  let reps = null, rir = null, from = '';
  if (set.target) { reps = (parseRepsRange(set.target.reps) || [])[0] || null; rir = set.target.rir ?? null; from = 'tabla'; }
  const prev = historyBefore(ex.exerciseId, s).find((h) => h.entry.sets.some(isWork));
  if (reps == null && set.reps) { reps = set.reps; rir = rirOf(set); }
  if (reps == null && prev) {
    const k = ex.sets.slice(0, j).filter((x) => x.type !== 'C').length;
    const pw = prev.entry.sets.filter(isWork), ps = pw[k] || pw[pw.length - 1];
    if (ps?.reps) { reps = ps.reps; rir = rirOf(ps); from = 'anterior'; }
  }
  if (!reps || reps > 12) return null;
  const pct = pct1rm({ reps, rir: rir ?? 0 }); if (!pct) return null;
  // Referencia de fuerza
  let e1 = entryE1(ex, true), src = 'hoy';
  if (!e1 && prev) { e1 = entryE1(prev.entry); src = prev.sess.date; }
  if (!e1) { e1 = refE1RM(ex.exerciseId); src = 'histórico'; }
  if (!e1) return null;
  const w = roundStep(e1 * pct / 100);
  return w > 0 ? { w, reps, rir, e1, src, from } : null;
}
function suggestLineHTML(s, i) {
  const ex = s.exercises[i];
  const sug = ex.sets.map((_, j) => suggestFor(s, i, j));
  const k = sug.findIndex(Boolean); if (k < 0) return '';
  const g = sug[k];
  const srcTxt = g.src === 'hoy' ? 'tus series de hoy' : g.src === 'histórico' ? 'tu mejor marca reciente' : `tu sesión del ${shortDate(g.src)}`;
  return `<div class="suggest">${ic('target')} Sugerido: <b>${fmt(g.w)} kg</b> × ${g.reps}${g.rir != null ? ` @ RIR ${fmt(g.rir)}` : ''}
    <span class="muted">· según ${srcTxt}</span> ${info('suggest')}
    <button class="small-btn" data-action="fill-suggest" data-i="${i}">Rellenar</button></div>`;
}
// Placeholder del campo de peso: la sugerencia de esa serie.
const suggestPlaceholder = (s, i, j, f = 'w') => { const g = suggestFor(s, i, j); return !g ? '' : f === 'reps' ? (s.exercises[i].sets[j].reps == null ? String(g.reps) : '') : decIn(g.w); };
// Índice de la siguiente serie pendiente con peso (o sugerencia): ahí va el botón de calentamiento.
function nextPendingSet(s, i) {
  const ex = s.exercises[i], def = exById(ex.exerciseId);
  if (!def || def.mode !== 'wr') return -1;
  return ex.sets.findIndex((x, j) => !x.done && (x.w > 0 || suggestFor(s, i, j)));
}

/* ---------- Calentamiento y discos ---------- */
function platesFor(total, bar = barWeight(), avail = platesAvail()) {
  let side = (total - bar) / 2; if (side < -1e-9) return null;
  const out = [];
  for (const p of [...avail].sort((a, b) => b - a)) while (side >= p - 1e-9) { out.push(p); side -= p; }
  return { plates: out, missing: side > 1e-6 ? side * 2 : 0 };
}
const platesTxt = (r) => !r ? '—' : r.plates.length ? r.plates.map((p) => fmt(p, 2)).join(' + ') : 'solo la barra';
// Rampa de calentamiento hacia el peso de trabajo. Con series largas (≥ 8 reps) basta con menos escalones.
function warmupRamp(work, reps, useBar) {
  const bar = useBar ? barWeight() : 0, step = plateStep();
  const scheme = reps >= 8 ? [[0.5, 5], [0.7, 3]] : [[0.4, 5], [0.6, 3], [0.75, 2], [0.85, 1]];
  const out = useBar && work > bar ? [{ w: bar, reps: 10, label: 'Barra' }] : [];
  for (const [p, r] of scheme) {
    const w = roundStep(work * p, step);
    if (w <= (out[out.length - 1]?.w ?? 0) || w >= work || (useBar && w < bar)) continue;
    out.push({ w, reps: r, label: `${Math.round(p * 100)} %` });
  }
  return out;
}
function warmupHTML(s, i, j) {
  const ex = s.exercises[i], def = exById(ex.exerciseId), set = ex.sets[j];
  const work = ui.wuWork ?? set.w ?? suggestFor(s, i, j)?.w ?? null;
  const reps = set.reps || suggestFor(s, i, j)?.reps || 5;
  const useBar = !def.noBar;
  const ramp = work ? warmupRamp(work, reps, useBar) : [];
  const row = (r, cls = '') => `<tr class="${cls}"><td>${r.label}</td><td><b>${fmt(r.w)} kg</b> × ${r.reps}</td>${useBar ? `<td>${platesTxt(platesFor(r.w))}${platesFor(r.w)?.missing ? ` <span class="mismatch">(faltan ${fmt(platesFor(r.w).missing, 2)} kg)</span>` : ''}</td>` : ''}</tr>`;
  return `<div class="row"><h3 class="spacer">Calentamiento y discos</h3><button class="ghost" data-action="close-modal" aria-label="Cerrar">✕</button></div>
    <div class="muted small" style="margin:2px 0 10px">${esc(def.name)} · serie ${j + 1}</div>
    <div class="grid2">
      <div><label>Peso de trabajo (kg)</label><input type="text" inputmode="decimal" id="wu-work" value="${work == null ? '' : decIn(work)}"></div>
      <div><label>Barra</label><select id="wu-bar"><option value="1" ${useBar ? 'selected' : ''}>Barra de ${fmt(barWeight())} kg</option><option value="0" ${useBar ? '' : 'selected'}>Sin barra (mancuernas, máquina)</option></select></div>
    </div>
    ${work ? `<table class="gt wu-table" style="margin-top:12px"><tr><th></th><th>Peso</th>${useBar ? '<th>Discos por lado</th>' : ''}</tr>
      ${ramp.map((r) => row(r)).join('')}${row({ label: 'Trabajo', w: work, reps }, 'wu-work')}</table>
      ${ramp.length ? `<button class="primary block" style="margin-top:12px" data-action="wu-add" data-i="${i}" data-j="${j}">Añadir ${ramp.length} serie${ramp.length === 1 ? '' : 's'} de calentamiento antes</button>` : '<div class="muted small" style="margin-top:8px">Con este peso no hace falta calentamiento con carga.</div>'}`
      : '<div class="muted small" style="margin-top:10px">Escribe el peso de trabajo para calcular el calentamiento.</div>'}
    <div class="muted small" style="margin-top:10px">Barra, discos disponibles e incremento mínimo se cambian en Ajustes › Pesos y discos. ${info('warmup')}</div>`;
}
function openWarmup(i, j) { const s = currentSession(); if (s) openModal(warmupHTML(s, i, j)); }

/* ---------- Ajustes ---------- */
function weightsSettingsHTML() {
  const av = platesAvail();
  return `<h2>Pesos y discos</h2><div class="card">
    <div class="grid2">
      <div><label>Barra (kg)</label><select data-setting="bar">${[20, 15, 10, 7, 0].map((v) => `<option value="${v}" ${barWeight() === v ? 'selected' : ''}>${v ? fmt(v) + ' kg' : 'Sin barra'}</option>`).join('')}</select></div>
      <div><label>Incremento mínimo</label><select data-setting="plateStep">${[0.5, 1, 1.25, 2, 2.5, 5].map((v) => `<option value="${v}" ${plateStep() === v ? 'selected' : ''}>${fmt(v, 2)} kg</option>`).join('')}</select></div>
    </div>
    <label style="margin-top:10px">Discos disponibles</label>
    <div class="chips">${ALL_PLATES.map((p) => `<button class="chip ${av.includes(p) ? 'on' : ''}" data-action="toggle-plate" data-p="${p}">${fmt(p, 2)}</button>`).join('')}</div>
    <div class="muted small" style="margin-top:6px">Se usan para redondear el peso sugerido y para calcular los discos del calentamiento.</div>
  </div>`;
}

Object.assign(actions, {
  'fill-suggest': (el) => {
    const s = currentSession(), i = +el.dataset.i, ex = s.exercises[i];
    const fills = ex.sets.map((_, j) => suggestFor(s, i, j));
    fills.forEach((g, j) => { if (g) { ex.sets[j].w = g.w; if (ex.sets[j].reps == null) ex.sets[j].reps = g.reps; if (ex.sets[j].rir == null && g.rir != null && !ex.sets[j].target) ex.sets[j].rir = g.rir; } });
    save(); rerender();
  },
  warmup: (el) => { ui.wuWork = null; ui.wuI = +el.dataset.i; ui.wuJ = +el.dataset.j; openWarmup(ui.wuI, ui.wuJ); },
  'wu-add': (el) => {
    const s = currentSession(), i = +el.dataset.i, j = +el.dataset.j, ex = s.exercises[i], def = exById(ex.exerciseId), set = ex.sets[j];
    const work = ui.wuWork ?? set.w ?? suggestFor(s, i, j)?.w;
    const ramp = warmupRamp(work, set.reps || suggestFor(s, i, j)?.reps || 5, !def.noBar);
    if (set.w == null && work) set.w = work; // el peso elegido aquí pasa a la serie de trabajo
    ex.sets.splice(j, 0, ...ramp.map((r) => ({ type: 'C', w: r.w, reps: r.reps, rpe: null, rir: null, done: false })));
    save(); closeModal(); rerender(); toast(`${ramp.length} series de calentamiento añadidas`);
  },
  'toggle-plate': (el) => {
    const p = +el.dataset.p, av = new Set(platesAvail());
    av.has(p) ? av.delete(p) : av.add(p);
    db.settings.plates = [...av].sort((a, b) => b - a); save(); rerender();
  },
});
// Cambios dentro de la ventana de calentamiento: se recalcula sin cerrar.
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'wu-work' || t.id === 'wu-bar') {
    const s = currentSession(); if (!s) return;
    const i = ui.wuI, j = ui.wuJ;
    if (t.id === 'wu-work') ui.wuWork = num(t.value);
    if (t.id === 'wu-bar') { const def = exById(s.exercises[i].exerciseId); if (t.value === '0') def.noBar = true; else delete def.noBar; save(); }
    $('#modal-body').innerHTML = warmupHTML(s, i, j);
  }
});
Object.assign(window, { suggestLineHTML, suggestPlaceholder, nextPendingSet, weightsSettingsHTML, suggestFor, platesFor, warmupRamp });
if (route().name === 'session') rerender();
