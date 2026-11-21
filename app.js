'use strict';
/* Diario de entrenamiento — PWA sin dependencias. Datos en localStorage. */

const KEY = 'diario-entreno.v1';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const num = (v) => { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const fmt = (n, d = 1) => n == null ? '–' : (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('es-ES');
const fmtDate = (iso) => new Date(iso + 'T12:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtDur = (ms) => { const m = Math.round(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
const fmtSec = (s) => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/* Tipos de registro por ejercicio */
const MODES = {
  wr: { label: 'Peso × reps', fields: ['w', 'reps', 'rpe'] },
  bw: { label: 'Peso corporal (+lastre)', fields: ['w', 'reps', 'rpe'] },
  time: { label: 'Tiempo', fields: ['w', 'time', 'rpe'] },
  dist: { label: 'Distancia y tiempo', fields: ['dist', 'time', 'rpe'] },
};
const FIELD = {
  w: { h: 'kg', step: '0.5' }, reps: { h: 'Reps', step: '1' }, time: { h: 'Seg', step: '1' },
  dist: { h: 'Metros', step: '1' }, rpe: { h: 'RPE' },
};
const SET_TYPES = { E: 'Efectiva', C: 'Calentamiento', D: 'Drop set', F: 'Al fallo' };
const CATEGORIES = ['Pierna', 'Empuje', 'Tirón', 'Halterofilia', 'Core', 'Brazos', 'Cardio', 'Otros'];

const DEFAULT_EXERCISES = [
  ['Sentadilla trasera', 'Pierna'], ['Sentadilla frontal', 'Pierna'], ['Peso muerto', 'Pierna'], ['Peso muerto rumano', 'Pierna'],
  ['Prensa', 'Pierna'], ['Zancadas', 'Pierna'], ['Hip thrust', 'Pierna'], ['Curl femoral', 'Pierna'], ['Extensión de cuádriceps', 'Pierna'],
  ['Press banca', 'Empuje'], ['Press inclinado', 'Empuje'], ['Press militar', 'Empuje'], ['Fondos', 'Empuje', 'bw'], ['Aperturas', 'Empuje'],
  ['Dominadas', 'Tirón', 'bw'], ['Remo con barra', 'Tirón'], ['Remo con mancuerna', 'Tirón'], ['Jalón al pecho', 'Tirón'], ['Face pull', 'Tirón'],
  ['Arrancada', 'Halterofilia'], ['Dos tiempos', 'Halterofilia'], ['Cargada de potencia', 'Halterofilia'], ['Arrancada de potencia', 'Halterofilia'], ['Jerk', 'Halterofilia'], ['Tirón de arrancada', 'Halterofilia'],
  ['Plancha', 'Core', 'time'], ['Rueda abdominal', 'Core', 'bw'], ['Elevación de piernas', 'Core', 'bw'],
  ['Curl de bíceps', 'Brazos'], ['Extensión de tríceps', 'Brazos'],
  ['Carrera', 'Cardio', 'dist'], ['Remo ergómetro', 'Cardio', 'dist'], ['Bicicleta', 'Cardio', 'dist'], ['Comba', 'Cardio', 'time'],
];
const DEFAULT_EQUIPMENT = ['Straps', 'Zapatillas de halterofilia', 'Cinturón', 'Rodilleras', 'Muñequeras', 'Coderas', 'Magnesio', 'Calleras', 'Cinturón de lastre', 'Bandas elásticas'];

/* ---------- Persistencia ---------- */
function seed() {
  return {
    version: 1,
    exercises: DEFAULT_EXERCISES.map(([name, cat, mode]) => ({ id: uid(), name, cat, mode: mode || 'wr' })),
    equipment: DEFAULT_EQUIPMENT.map((name) => ({ id: uid(), name })),
    sessions: [],
    settings: { rest: 120 },
  };
}
function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.sessions) return d; } catch (e) { /* datos corruptos */ }
  return seed();
}
let db = load();
let saveTimer;
function save(now = false) {
  clearTimeout(saveTimer);
  const write = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { alert('No se pudo guardar: ' + e.message); } };
  if (now) write(); else saveTimer = setTimeout(write, 250);
}
window.addEventListener('pagehide', () => save(true));
document.addEventListener('visibilitychange', () => { if (document.hidden) save(true); });
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

const exById = (id) => db.exercises.find((e) => e.id === id);
const eqById = (id) => db.equipment.find((e) => e.id === id);
const sessionById = (id) => db.sessions.find((s) => s.id === id);
const sortedSessions = () => [...db.sessions].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));

/* ---------- Cálculos ---------- */
// 1RM estimado (Epley), corrigiendo por repeticiones en reserva si hay RPE.
function e1rm(set) {
  if (!set.w || !set.reps) return null;
  const rir = set.rpe ? Math.max(0, 10 - set.rpe) : 0;
  const r = set.reps + rir;
  if (r > 15) return null; // poco fiable
  return r === 1 ? set.w : set.w * (1 + r / 30);
}
const isWork = (s) => s.type !== 'C';
function sessionVolume(sess) {
  let v = 0;
  for (const ex of sess.exercises) for (const s of ex.sets) if (isWork(s) && s.w && s.reps) v += s.w * s.reps;
  return v;
}
function setsText(ex, sets) {
  const mode = exById(ex.exerciseId)?.mode || 'wr';
  return sets.filter((s) => s.w != null || s.reps != null || s.time != null || s.dist != null).map((s) => {
    let t;
    if (mode === 'dist') t = `${fmt(s.dist, 0)} m` + (s.time ? ` en ${fmtSec(s.time)}` : '');
    else if (mode === 'time') t = (s.w ? `${fmt(s.w)} kg · ` : '') + `${fmtSec(s.time || 0)}`;
    else t = (mode === 'bw' ? (s.w ? `+${fmt(s.w)}` : 'PC') : fmt(s.w)) + `×${s.reps ?? '–'}`;
    if (s.rpe) t += ` @${fmt(s.rpe)}`;
    if (s.type === 'C') t = `(${t})`;
    if (s.type === 'D') t += ' D';
    return t;
  }).join(', ');
}
// Ejercicio anterior (misma exerciseId) en una sesión anterior a la dada.
function previousEntry(exerciseId, sess) {
  for (const s of sortedSessions()) {
    if (s.id === sess.id) continue;
    if ((s.date + s.createdAt) > (sess.date + sess.createdAt)) continue;
    const e = s.exercises.find((x) => x.exerciseId === exerciseId);
    if (e && e.sets.length) return { sess: s, entry: e };
  }
  return null;
}
function historyFor(exerciseId) {
  const out = [];
  for (const s of sortedSessions()) for (const e of s.exercises) if (e.exerciseId === exerciseId) out.push({ sess: s, entry: e });
  return out;
}
function bestOf(entry) {
  let best = null, maxW = null;
  for (const s of entry.sets) {
    if (!isWork(s)) continue;
    const v = e1rm(s); if (v && (!best || v > best)) best = v;
    if (s.w && (!maxW || s.w > maxW)) maxW = s.w;
  }
  return { e1rm: best, maxW };
}

/* ---------- Router ---------- */
const ui = { openEquip: new Set(), filterEq: 'all', search: '' };
function route() {
  const h = location.hash.replace(/^#\/?/, '').split('/');
  return { name: h[0] || 'sessions', id: h[1] };
}
function render() {
  const r = route();
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('active',
    a.dataset.tab === (r.name === 'session' ? 'sessions' : r.name === 'exercise' ? 'exercises' : r.name)));
  const app = $('#app');
  const view = { sessions: viewSessions, session: viewSession, exercises: viewExercises, exercise: viewExercise, settings: viewSettings }[r.name] || viewSessions;
  app.innerHTML = view(r.id);
}
function rerender() { const y = scrollY; render(); scrollTo(0, y); }
window.addEventListener('hashchange', () => { render(); scrollTo(0, 0); });

/* ---------- Vistas ---------- */
function viewSessions() {
  const list = sortedSessions();
  const last = list[0];
  let html = `<h1>Sesiones</h1>
    <div class="grid2">
      <button class="primary" data-action="new-session">＋ Nueva sesión</button>
      <button data-action="repeat-session" ${last ? '' : 'disabled'}>↻ Repetir…</button>
    </div><div style="height:12px"></div>`;
  if (!list.length) return html + `<div class="empty">Aún no hay sesiones.<br>Crea la primera y empieza a registrar.</div>`;
  for (const s of list) {
    const sets = s.exercises.reduce((n, e) => n + e.sets.filter(isWork).length, 0);
    const eqs = [...new Set(s.exercises.flatMap((e) => e.equipment))].map(eqById).filter(Boolean);
    html += `<a class="card list-item" href="#/session/${s.id}">
      <div class="row"><span class="title">${esc(s.title || 'Sesión')}</span><span class="spacer"></span>
        <span class="muted">${fmtDate(s.date)}</span></div>
      <div class="muted small">${esc(s.exercises.map((e) => exById(e.exerciseId)?.name).filter(Boolean).join(' · ') || 'Sin ejercicios')}</div>
      <div class="stats">
        <div class="stat"><b>${sets}</b><span>series</span></div>
        <div class="stat"><b>${fmt(sessionVolume(s) / 1000, 2)} t</b><span>volumen</span></div>
        ${s.endedAt ? `<div class="stat"><b>${fmtDur(s.endedAt - s.startedAt)}</b><span>duración</span></div>` : '<div class="stat"><b>⏳</b><span>en curso</span></div>'}
        ${s.srpe ? `<div class="stat"><b>${s.srpe}</b><span>RPE sesión</span></div>` : ''}
      </div>
      ${eqs.length ? `<div>${eqs.map((e) => `<span class="tag">${esc(e.name)}</span>`).join('')}</div>` : ''}
    </a>`;
  }
  return html;
}

function viewSession(id) {
  const s = sessionById(id);
  if (!s) return `<div class="empty">Sesión no encontrada. <a href="#/">Volver</a></div>`;
  const dur = (s.endedAt || Date.now()) - s.startedAt;
  let html = `<div class="row"><a class="btn ghost" href="#/">‹ Sesiones</a><span class="spacer"></span>
      <button class="ghost" data-action="session-menu" data-id="${s.id}">⋯</button></div>
    <input class="title-input" data-s="title" value="${esc(s.title)}" placeholder="Nombre de la sesión (p. ej. Pierna A)" style="font-size:1.2rem;font-weight:700;margin:6px 0 10px">
    <div class="card">
      <div class="grid2">
        <div><label>Fecha</label><input type="date" data-s="date" value="${esc(s.date)}"></div>
        <div><label>Peso corporal (kg)</label><input type="number" inputmode="decimal" step="0.1" data-s="bodyweight" value="${s.bodyweight ?? ''}"></div>
        <div><label>Energía / readiness (1-5)</label>${scaleSelect('readiness', s.readiness, 1, 5)}</div>
        <div><label>Horas de sueño</label><input type="number" inputmode="decimal" step="0.5" data-s="sleep" value="${s.sleep ?? ''}"></div>
      </div>
      <div class="muted small" style="margin-top:8px">${s.endedAt ? 'Duración' : 'En curso'}: ${fmtDur(dur)} · Volumen efectivo: <b id="vol">${fmt(sessionVolume(s), 0)} kg</b></div>
    </div>`;

  s.exercises.forEach((ex, i) => { html += exerciseCard(s, ex, i); });

  html += `<button class="block" data-action="add-exercise">＋ Añadir ejercicio</button>
    <div class="card" style="margin-top:12px">
      <label>Notas de la sesión</label>
      <textarea data-s="notes" placeholder="Sensaciones, molestias, contexto…">${esc(s.notes)}</textarea>
      <div style="height:8px"></div>
      <label>RPE de la sesión (esfuerzo global 1-10)</label>${scaleSelect('srpe', s.srpe, 1, 10)}
    </div>
    ${s.endedAt
      ? `<button class="block" data-action="reopen-session">Reabrir sesión (seguir cronometrando)</button>`
      : `<button class="primary block" data-action="finish-session">✓ Finalizar sesión</button>`}`;
  return html;
}
function scaleSelect(key, val, a, b) {
  let o = `<option value="">–</option>`;
  for (let i = a; i <= b; i++) o += `<option ${val == i ? 'selected' : ''}>${i}</option>`;
  return `<select data-s="${key}">${o}</select>`;
}
function rpeSelect(val, i, j) {
  let o = `<option value="">–</option>`;
  for (let r = 6; r <= 10; r += 0.5) o += `<option value="${r}" ${val == r ? 'selected' : ''}>${String(r).replace('.', ',')}</option>`;
  return `<select data-set="${i}:${j}:rpe" aria-label="RPE">${o}</select>`;
}

function exerciseCard(s, ex, i) {
  const def = exById(ex.exerciseId) || { name: '(ejercicio borrado)', mode: 'wr' };
  const mode = MODES[def.mode] || MODES.wr;
  const prev = previousEntry(ex.exerciseId, s);
  const hist = historyFor(ex.exerciseId).filter((h) => h.sess.id !== s.id && h.sess.date <= s.date);
  const prevBest = Math.max(0, ...hist.map((h) => bestOf(h.entry).e1rm || 0));
  const open = ui.openEquip.has(ex.id);

  let rows = '';
  ex.sets.forEach((set, j) => {
    const est = e1rm(set);
    const isPR = isWork(set) && est && prevBest && est > prevBest;
    rows += `<tr class="${set.done ? 'done' : ''}">
      <td><button class="settype ${set.type}" data-action="cycle-type" data-i="${i}" data-j="${j}" title="${SET_TYPES[set.type]}">${set.type === 'E' ? j + 1 : set.type}</button></td>
      ${mode.fields.map((f) => f === 'rpe' ? `<td>${rpeSelect(set.rpe, i, j)}</td>`
        : `<td><input type="number" inputmode="decimal" step="${FIELD[f].step}" data-set="${i}:${j}:${f}" value="${set[f] ?? ''}" placeholder="${f === 'w' && def.mode === 'bw' ? '+0' : ''}"></td>`).join('')}
      <td><button class="check ${set.done ? 'on' : ''}" data-action="toggle-done" data-i="${i}" data-j="${j}" aria-label="Hecha">✓</button></td>
      <td><button class="icon ghost" data-action="del-set" data-i="${i}" data-j="${j}" aria-label="Borrar serie">✕</button></td>
    </tr>${isPR ? `<tr><td></td><td colspan="${mode.fields.length}" class="pr" style="text-align:left">★ Récord estimado: ${fmt(est)} kg 1RM</td></tr>` : ''}`;
  });

  const eqSel = ex.equipment.map(eqById).filter(Boolean);
  return `<div class="card" data-ex="${i}">
    <div class="ex-head">
      <h3><a href="#/exercise/${ex.exerciseId}" style="color:inherit;text-decoration:none">${esc(def.name)}</a></h3>
      <button class="icon ghost" data-action="move-ex" data-i="${i}" data-d="-1" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>↑</button>
      <button class="icon ghost" data-action="move-ex" data-i="${i}" data-d="1" aria-label="Bajar" ${i === s.exercises.length - 1 ? 'disabled' : ''}>↓</button>
      <button class="icon ghost danger" data-action="del-ex" data-i="${i}" aria-label="Quitar ejercicio">🗑</button>
    </div>
    ${prev ? `<div class="prev">Anterior (${fmtDate(prev.sess.date)}): ${esc(setsText(prev.entry, prev.entry.sets))}${prev.entry.equipment.length ? ' · ' + esc(prev.entry.equipment.map((x) => eqById(x)?.name).filter(Boolean).join(', ')) : ''}</div>` : '<div class="prev">Primera vez que registras este ejercicio.</div>'}
    <div class="chips" style="margin-top:8px">
      ${(open ? db.equipment : eqSel).map((e) => `<button class="chip ${ex.equipment.includes(e.id) ? 'on' : ''}" data-action="toggle-eq" data-i="${i}" data-eq="${e.id}">${esc(e.name)}</button>`).join('')}
      <button class="chip" data-action="open-eq" data-i="${i}">${open ? 'Listo' : '＋ Material'}</button>
    </div>
    <table class="sets">
      <thead><tr><th>Serie</th>${mode.fields.map((f) => `<th>${f === 'w' && def.mode === 'bw' ? 'Lastre' : FIELD[f].h}</th>`).join('')}<th>✓</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="row" style="margin-top:8px">
      <button class="spacer" data-action="add-set" data-i="${i}">＋ Serie</button>
    </div>
    <div style="height:8px"></div>
    <textarea data-exnote="${i}" placeholder="Notas: técnica, tempo, molestias, agarre…" rows="2">${esc(ex.notes)}</textarea>
  </div>`;
}

function viewExercises() {
  const q = ui.search.toLowerCase();
  const counts = {};
  for (const s of db.sessions) for (const e of s.exercises) counts[e.exerciseId] = (counts[e.exerciseId] || 0) + 1;
  let html = `<h1>Progreso</h1><input type="search" data-action-input="search" placeholder="Buscar ejercicio…" value="${esc(ui.search)}">`;
  const items = db.exercises.filter((e) => e.name.toLowerCase().includes(q))
    .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || a.name.localeCompare(b.name));
  html += '<div style="height:12px"></div>';
  for (const e of items) {
    const h = historyFor(e.id);
    const best = Math.max(0, ...h.map((x) => bestOf(x.entry).e1rm || 0));
    html += `<a class="card list-item" href="#/exercise/${e.id}" style="padding:12px 14px">
      <div class="row"><span class="title">${esc(e.name)}</span><span class="spacer"></span>
      <span class="muted small">${counts[e.id] ? `${counts[e.id]} sesiones${best ? ` · 1RM est. ${fmt(best)} kg` : ''}` : esc(e.cat)}</span></div></a>`;
  }
  return html;
}

function viewExercise(id) {
  const def = exById(id);
  if (!def) return `<div class="empty">Ejercicio no encontrado. <a href="#/exercises">Volver</a></div>`;
  const all = historyFor(id);
  const usedEq = [...new Set(all.flatMap((h) => h.entry.equipment))].map(eqById).filter(Boolean);
  const f = ui.filterEq;
  const hist = all.filter((h) => f === 'all' ? true : f === 'none' ? h.entry.equipment.length === 0 : h.entry.equipment.includes(f));

  let bestE = null, bestW = null, totalVol = 0;
  for (const h of hist) {
    const b = bestOf(h.entry);
    if (b.e1rm && (!bestE || b.e1rm > bestE.v)) bestE = { v: b.e1rm, d: h.sess.date };
    if (b.maxW && (!bestW || b.maxW > bestW.v)) bestW = { v: b.maxW, d: h.sess.date };
    for (const s of h.entry.sets) if (isWork(s) && s.w && s.reps) totalVol += s.w * s.reps;
  }

  let html = `<div class="row"><a class="btn ghost" href="#/exercises">‹ Progreso</a></div>
    <h1>${esc(def.name)}</h1>
    <div class="muted small">${esc(def.cat)} · ${esc(MODES[def.mode]?.label)}</div>`;
  if (usedEq.length) {
    html += `<h2>Filtrar por material</h2><div class="chips">
      <button class="chip ${f === 'all' ? 'on' : ''}" data-action="filter-eq" data-eq="all">Todo</button>
      <button class="chip ${f === 'none' ? 'on' : ''}" data-action="filter-eq" data-eq="none">Sin material</button>
      ${usedEq.map((e) => `<button class="chip ${f === e.id ? 'on' : ''}" data-action="filter-eq" data-eq="${e.id}">Con ${esc(e.name)}</button>`).join('')}
    </div>`;
  }
  html += `<div class="card" style="margin-top:12px"><div class="stats">
      <div class="stat"><b>${bestE ? fmt(bestE.v) + ' kg' : '–'}</b><span>mejor 1RM estimado</span></div>
      <div class="stat"><b>${bestW ? fmt(bestW.v) + ' kg' : '–'}</b><span>peso máximo</span></div>
      <div class="stat"><b>${hist.length}</b><span>sesiones</span></div>
      <div class="stat"><b>${fmt(totalVol / 1000, 2)} t</b><span>volumen total</span></div>
    </div></div>`;

  const pts = hist.map((h) => ({ d: h.sess.date, v: bestOf(h.entry).e1rm })).filter((p) => p.v).reverse();
  if (pts.length >= 2) html += `<h2>1RM estimado por sesión</h2><div class="card">${chart(pts)}</div>`;

  if (bestE) {
    html += `<h2>Tabla de cargas (desde 1RM est. ${fmt(bestE.v)} kg)</h2><div class="card"><div class="stats">
      ${[1, 2, 3, 5, 8, 10].map((r) => `<div class="stat"><b>${fmt(Math.round(bestE.v / (1 + (r === 1 ? 0 : r / 30)) / 2.5) * 2.5)} kg</b><span>${r} rep @10</span></div>`).join('')}
    </div></div>`;
  }

  html += `<h2>Historial</h2>`;
  if (!hist.length) html += `<div class="empty">Sin registros${f !== 'all' ? ' con este filtro' : ''}.</div>`;
  for (const h of hist) {
    const b = bestOf(h.entry);
    html += `<a class="card list-item" href="#/session/${h.sess.id}">
      <div class="row"><b>${fmtDate(h.sess.date)}</b><span class="spacer"></span>${b.e1rm ? `<span class="muted small">1RM est. ${fmt(b.e1rm)}</span>` : ''}</div>
      <div>${esc(setsText(h.entry, h.entry.sets))}</div>
      ${h.entry.equipment.length ? `<div>${h.entry.equipment.map((x) => eqById(x)).filter(Boolean).map((e) => `<span class="tag">${esc(e.name)}</span>`).join('')}</div>` : ''}
      ${h.entry.notes ? `<div class="muted small" style="margin-top:4px">📝 ${esc(h.entry.notes)}</div>` : ''}
    </a>`;
  }
  return html;
}

function chart(pts) {
  const W = 320, H = 150, P = 28;
  const vs = pts.map((p) => p.v), min = Math.min(...vs), max = Math.max(...vs), span = max - min || 1;
  const x = (i) => P + (i * (W - P - 8)) / (pts.length - 1);
  const y = (v) => H - P + 8 - ((v - min) / span) * (H - P - 8);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución del 1RM estimado">
    <line class="ax" x1="${P}" y1="${H - P + 8}" x2="${W}" y2="${H - P + 8}"/>
    <text x="2" y="${y(max) + 4}">${Math.round(max)}</text><text x="2" y="${y(min) + 4}">${Math.round(min)}</text>
    <text x="${P}" y="${H - 4}">${pts[0].d.slice(5)}</text><text x="${W - 34}" y="${H - 4}">${pts[pts.length - 1].d.slice(5)}</text>
    <path class="ln" d="${d}"/>${pts.map((p, i) => `<circle class="pt" cx="${x(i)}" cy="${y(p.v)}" r="3"/>`).join('')}
  </svg>`;
}

function viewSettings() {
  const used = new Set(db.sessions.flatMap((s) => s.exercises.flatMap((e) => e.equipment)));
  return `<h1>Ajustes</h1>
    <div class="card">
      <label>Descanso por defecto entre series (segundos)</label>
      <input type="number" inputmode="numeric" step="15" data-setting="rest" value="${db.settings.rest}">
      <div class="muted small" style="margin-top:6px">El temporizador arranca al marcar una serie como hecha. 0 = desactivado.</div>
    </div>
    <h2>Material</h2>
    <div class="card">
      <div class="chips">${db.equipment.map((e) => `<span class="chip">${esc(e.name)} <button class="ghost" style="min-height:0;padding:0 0 0 6px" data-action="del-equipment" data-id="${e.id}" aria-label="Borrar">✕</button></span>`).join('')}</div>
      <div class="row" style="margin-top:10px"><input id="new-eq" placeholder="Nuevo material (p. ej. Rodilleras 7mm)"><button data-action="add-equipment">Añadir</button></div>
      ${used.size ? '<div class="muted small" style="margin-top:6px">El material ya usado en sesiones no se puede borrar.</div>' : ''}
    </div>
    <h2>Ejercicios</h2>
    <div class="card"><button class="block" data-action="manage-exercises">Gestionar catálogo (${db.exercises.length})</button></div>
    <h2>Copia de seguridad</h2>
    <div class="card">
      <div class="muted small" style="margin-bottom:8px">Los datos viven solo en este dispositivo. Exporta con frecuencia: si borras los datos del navegador (o iOS los purga), se pierden.</div>
      <div class="grid2">
        <button data-action="export-json">⬇ Exportar JSON</button>
        <button data-action="import-json">⬆ Importar JSON</button>
        <button data-action="export-csv">⬇ Exportar CSV</button>
        <button class="danger" data-action="wipe">Borrar todo</button>
      </div>
      <input type="file" id="import-file" accept="application/json,.json" class="hidden">
    </div>
    <p class="muted small">${db.sessions.length} sesiones guardadas.</p>`;
}

/* ---------- Modal ---------- */
const modal = $('#modal');
function openModal(html) { $('#modal-body').innerHTML = html; if (!modal.open) modal.showModal(); }
function closeModal() { if (modal.open) modal.close(); }
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

function pickerHTML(q = '') {
  const ql = q.trim().toLowerCase();
  const items = db.exercises.filter((e) => e.name.toLowerCase().includes(ql));
  let list = '';
  for (const cat of CATEGORIES) {
    const its = items.filter((e) => e.cat === cat).sort((a, b) => a.name.localeCompare(b.name));
    if (!its.length) continue;
    list += `<div class="picker-cat">${cat}</div>` + its.map((e) => `<button data-action="pick-exercise" data-id="${e.id}">${esc(e.name)}</button>`).join('');
  }
  const exact = db.exercises.some((e) => e.name.toLowerCase() === ql);
  return `${list || '<div class="muted">Sin resultados.</div>'}
    ${ql && !exact ? `<div class="card" style="margin-top:10px"><b>Crear «${esc(q.trim())}»</b>
      <div class="grid2" style="margin-top:8px">
        <select id="new-ex-cat">${CATEGORIES.map((c) => `<option>${c}</option>`).join('')}</select>
        <select id="new-ex-mode">${Object.entries(MODES).map(([k, m]) => `<option value="${k}">${m.label}</option>`).join('')}</select>
      </div>
      <button class="primary block" style="margin-top:8px" data-action="create-exercise">Crear y añadir</button></div>` : ''}`;
}
function openPicker() {
  openModal(`<div class="row"><h3 class="spacer">Añadir ejercicio</h3><button class="ghost" data-action="close-modal">✕</button></div>
    <input type="search" id="picker-q" placeholder="Buscar o crear…" style="margin-top:10px" autocomplete="off">
    <div class="picker-list" id="picker-list">${pickerHTML()}</div>`);
  setTimeout(() => $('#picker-q')?.focus(), 50);
}

/* ---------- Temporizador de descanso ---------- */
let timer = { end: 0, int: null };
function startTimer(sec) {
  if (!sec) return;
  timer.end = Date.now() + sec * 1000;
  $('#timer').classList.remove('hidden', 'over');
  document.body.classList.add('timer-on');
  clearInterval(timer.int);
  timer.int = setInterval(tickTimer, 250);
  tickTimer();
}
function tickTimer() {
  const left = (timer.end - Date.now()) / 1000;
  const el = $('#timer');
  if (left <= 0 && !el.classList.contains('over')) {
    el.classList.add('over');
    navigator.vibrate?.([200, 100, 200]);
    beep();
  }
  $('#timer-label').textContent = left > 0 ? 'Descanso' : '¡A por la siguiente!';
  $('#timer-value').textContent = (left < 0 ? '+' : '') + fmtSec(Math.abs(left));
}
function stopTimer() { clearInterval(timer.int); $('#timer').classList.add('hidden'); document.body.classList.remove('timer-on'); }
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 880; g.gain.value = 0.15; o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.35);
  } catch (e) { /* sin audio */ }
}

/* ---------- Acciones ---------- */
function currentSession() { const r = route(); return r.name === 'session' ? sessionById(r.id) : null; }
function newSession(fromId) {
  const src = fromId && sessionById(fromId);
  const s = {
    id: uid(), createdAt: new Date().toISOString(), date: todayISO(), startedAt: Date.now(), endedAt: null,
    title: src ? src.title : '', notes: '', bodyweight: null, readiness: null, sleep: null, srpe: null,
    exercises: src ? src.exercises.map((e) => ({
      id: uid(), exerciseId: e.exerciseId, notes: '', equipment: [...e.equipment],
      // Copia la estructura y cargas de la sesión anterior como punto de partida, sin marcar como hechas.
      sets: e.sets.map((x) => ({ ...x, done: false })),
    })) : [],
  };
  db.sessions.push(s); save(true);
  location.hash = `#/session/${s.id}`;
}
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function toCSV() {
  const rows = [['fecha', 'sesion', 'ejercicio', 'serie', 'tipo', 'kg', 'reps', 'rpe', 'segundos', 'metros', 'hecha', 'e1rm', 'material', 'notas_ejercicio']];
  for (const s of sortedSessions().reverse()) for (const e of s.exercises) e.sets.forEach((x, j) => rows.push([
    s.date, s.title, exById(e.exerciseId)?.name, j + 1, SET_TYPES[x.type], x.w, x.reps, x.rpe, x.time, x.dist, x.done ? 'si' : 'no',
    e1rm(x) ? fmt(e1rm(x)) : '', e.equipment.map((q) => eqById(q)?.name).join(' | '), j === 0 ? e.notes : '',
  ]));
  return rows.map((r) => r.map((c) => { const v = String(c ?? ''); return /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }).join(';')).join('\n');
}

const actions = {
  'new-session': () => newSession(),
  'repeat-session': () => {
    const list = sortedSessions().slice(0, 30);
    openModal(`<div class="row"><h3 class="spacer">Repetir una sesión</h3><button class="ghost" data-action="close-modal">✕</button></div>
      <p class="muted small">Se copian los ejercicios, el material y las cargas como punto de partida.</p>
      <div class="picker-list">${list.map((s) => `<button data-action="repeat-from" data-id="${s.id}"><b>${esc(s.title || 'Sesión')}</b>&nbsp;<span class="muted">${fmtDate(s.date)}</span></button>`).join('')}</div>`);
  },
  'repeat-from': (el) => { closeModal(); newSession(el.dataset.id); },
  'session-menu': () => openModal(`<div class="row"><h3 class="spacer">Sesión</h3><button class="ghost" data-action="close-modal">✕</button></div>
      <div style="display:grid;gap:8px;margin-top:10px">
        <button data-action="duplicate-session">Duplicar como nueva sesión de hoy</button>
        <button class="danger" data-action="delete-session">Borrar sesión</button>
      </div>`),
  'duplicate-session': () => { const s = currentSession(); closeModal(); newSession(s.id); },
  'delete-session': () => {
    const s = currentSession();
    if (!confirm('¿Borrar esta sesión? No se puede deshacer.')) return;
    db.sessions = db.sessions.filter((x) => x.id !== s.id); save(true); closeModal(); location.hash = '#/';
  },
  'finish-session': () => { const s = currentSession(); s.endedAt = Date.now(); save(true); stopTimer(); rerender(); },
  'reopen-session': () => { const s = currentSession(); s.endedAt = null; save(true); rerender(); },
  'add-exercise': () => openPicker(),
  'pick-exercise': (el) => {
    const s = currentSession(); closeModal();
    const prev = previousEntry(el.dataset.id, s);
    s.exercises.push({
      id: uid(), exerciseId: el.dataset.id, notes: '',
      equipment: prev ? [...prev.entry.equipment] : [],
      sets: prev ? prev.entry.sets.map((x) => ({ ...x, done: false })) : [{ type: 'E', w: null, reps: null, rpe: null, done: false }],
    });
    save(); rerender();
    setTimeout(() => document.querySelector(`[data-ex="${s.exercises.length - 1}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  },
  'create-exercise': () => {
    const name = $('#picker-q').value.trim(); if (!name) return;
    const e = { id: uid(), name, cat: $('#new-ex-cat').value, mode: $('#new-ex-mode').value };
    db.exercises.push(e);
    actions['pick-exercise']({ dataset: { id: e.id } });
  },
  'close-modal': () => closeModal(),
  'move-ex': (el) => {
    const s = currentSession(), i = +el.dataset.i, j = i + +el.dataset.d;
    if (j < 0 || j >= s.exercises.length) return;
    [s.exercises[i], s.exercises[j]] = [s.exercises[j], s.exercises[i]]; save(); rerender();
  },
  'del-ex': (el) => {
    const s = currentSession();
    if (!confirm('¿Quitar este ejercicio de la sesión?')) return;
    s.exercises.splice(+el.dataset.i, 1); save(); rerender();
  },
  'add-set': (el) => {
    const ex = currentSession().exercises[+el.dataset.i];
    const last = ex.sets[ex.sets.length - 1];
    ex.sets.push(last ? { ...last, done: false, type: last.type === 'C' ? 'E' : last.type } : { type: 'E', w: null, reps: null, rpe: null, done: false });
    save(); rerender();
  },
  'del-set': (el) => { currentSession().exercises[+el.dataset.i].sets.splice(+el.dataset.j, 1); save(); rerender(); },
  'cycle-type': (el) => {
    const set = currentSession().exercises[+el.dataset.i].sets[+el.dataset.j];
    const order = Object.keys(SET_TYPES); set.type = order[(order.indexOf(set.type) + 1) % order.length];
    save(); rerender();
  },
  'toggle-done': (el) => {
    const set = currentSession().exercises[+el.dataset.i].sets[+el.dataset.j];
    set.done = !set.done; save(); rerender();
    if (set.done) startTimer(+db.settings.rest || 0);
  },
  'open-eq': (el) => {
    const id = currentSession().exercises[+el.dataset.i].id;
    ui.openEquip.has(id) ? ui.openEquip.delete(id) : ui.openEquip.add(id); rerender();
  },
  'toggle-eq': (el) => {
    const ex = currentSession().exercises[+el.dataset.i], q = el.dataset.eq;
    ex.equipment = ex.equipment.includes(q) ? ex.equipment.filter((x) => x !== q) : [...ex.equipment, q];
    save(); rerender();
  },
  'filter-eq': (el) => { ui.filterEq = el.dataset.eq; rerender(); },
  'timer-add': (el) => { timer.end += +el.dataset.sec * 1000; $('#timer').classList.remove('over'); tickTimer(); },
  'timer-stop': () => stopTimer(),
  'add-equipment': () => {
    const v = $('#new-eq').value.trim(); if (!v) return;
    db.equipment.push({ id: uid(), name: v }); save(); rerender();
  },
  'del-equipment': (el) => {
    const used = db.sessions.some((s) => s.exercises.some((e) => e.equipment.includes(el.dataset.id)));
    if (used) return alert('Este material aparece en sesiones guardadas; no se puede borrar.');
    db.equipment = db.equipment.filter((e) => e.id !== el.dataset.id); save(); rerender();
  },
  'manage-exercises': () => {
    const used = new Set(db.sessions.flatMap((s) => s.exercises.map((e) => e.exerciseId)));
    openModal(`<div class="row"><h3 class="spacer">Catálogo de ejercicios</h3><button class="ghost" data-action="close-modal">✕</button></div>
      <div class="picker-list">${[...db.exercises].sort((a, b) => a.name.localeCompare(b.name)).map((e) => `
        <div class="row" style="margin-bottom:6px"><span class="spacer">${esc(e.name)} <span class="muted small">· ${esc(e.cat)}</span></span>
          <button class="icon ghost" data-action="rename-exercise" data-id="${e.id}" aria-label="Renombrar">✎</button>
          ${used.has(e.id) ? '' : `<button class="icon ghost danger" data-action="del-exercise" data-id="${e.id}" aria-label="Borrar">✕</button>`}
        </div>`).join('')}</div>
      <p class="muted small">Para crear uno nuevo, búscalo al añadir un ejercicio a una sesión.</p>`);
  },
  'rename-exercise': (el) => {
    const e = exById(el.dataset.id); const n = prompt('Nuevo nombre', e.name);
    if (n && n.trim()) { e.name = n.trim(); save(); actions['manage-exercises'](); }
  },
  'del-exercise': (el) => { db.exercises = db.exercises.filter((e) => e.id !== el.dataset.id); save(); actions['manage-exercises'](); },
  'export-json': () => download(`diario-entreno-${todayISO()}.json`, JSON.stringify(db, null, 2), 'application/json'),
  'export-csv': () => download(`diario-entreno-${todayISO()}.csv`, '﻿' + toCSV(), 'text/csv'),
  'import-json': () => $('#import-file').click(),
  'wipe': () => {
    if (!confirm('¿Borrar TODOS los datos? Exporta antes una copia.')) return;
    if (!confirm('Seguro. Esto no se puede deshacer.')) return;
    db = seed(); save(true); rerender();
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || !actions[el.dataset.action]) return;
  e.preventDefault();
  actions[el.dataset.action](el);
});

// Edición en línea: actualiza datos sin re-renderizar (no se pierde el foco al teclear).
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'picker-q') { $('#picker-list').innerHTML = pickerHTML(t.value); return; }
  if (t.dataset.actionInput === 'search') {
    ui.search = t.value; const pos = t.selectionStart; render();
    const n = $('input[type=search]'); n.focus(); n.setSelectionRange(pos, pos); return;
  }
  if (t.dataset.setting) { db.settings[t.dataset.setting] = num(t.value) ?? 0; save(); return; }
  const s = currentSession(); if (!s) return;
  if (t.dataset.s) {
    const k = t.dataset.s;
    s[k] = ['bodyweight', 'readiness', 'sleep', 'srpe'].includes(k) ? num(t.value) : t.value;
    save(); return;
  }
  if (t.dataset.exnote != null) { s.exercises[+t.dataset.exnote].notes = t.value; save(); return; }
  if (t.dataset.set) {
    const [i, j, f] = t.dataset.set.split(':');
    s.exercises[+i].sets[+j][f] = num(t.value); save();
  }
});
// Al cambiar cosas que afectan a cálculos visibles (récords, volumen), refresca al salir del campo.
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'import-file' && t.files[0]) {
    t.files[0].text().then((txt) => {
      const d = JSON.parse(txt);
      if (!d.sessions || !d.exercises || !d.equipment) throw new Error('Formato no reconocido');
      if (!confirm(`Importar ${d.sessions.length} sesiones? Reemplaza los datos actuales.`)) return;
      db = d; db.settings = db.settings || { rest: 120 }; save(true); rerender();
    }).catch((err) => alert('No se pudo importar: ' + err.message));
    return;
  }
  // No re-renderizar al salir de un campo numérico: destruiría el campo al que el usuario acaba de pasar.
  if (t.dataset.s === 'date' || (t.dataset.set && t.tagName === 'SELECT')) rerender();
  else if (t.dataset.set) { const s = currentSession(); const v = $('#vol'); if (s && v) v.textContent = `${fmt(sessionVolume(s), 0)} kg`; }
});

// Refresca la duración en curso cada minuto.
setInterval(() => {
  const s = currentSession();
  if (s && !s.endedAt && !document.activeElement?.matches('input,textarea,select') && !modal.open) rerender();
}, 60000);

if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

render();
