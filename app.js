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
/* ---------- Router ---------- */
const ui = { openEquip: new Set(), openChart: new Set(), preOpen: {}, filterEq: 'all', search: '', csearch: '', day: todayISO(), month: todayISO().slice(0, 7) };
function route() {
  const h = location.hash.replace(/^#\/?/, '').split('/');
  return { name: h[0] || 'sessions', id: h[1] };
}
function render() {
  const r = route();
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('active',
    a.dataset.tab === (r.name === 'session' ? 'sessions' : r.name === 'exercise' ? 'exercises' : r.name)));
  const app = $('#app');
  const view = { sessions: viewCalendar, session: viewSession, exercises: viewExercises, exercise: viewExercise, settings: viewSettings }[r.name] || viewCalendar;
  app.innerHTML = view(r.id);
}
function rerender() { const y = scrollY; render(); scrollTo(0, y); }
window.addEventListener('hashchange', () => { render(); scrollTo(0, 0); });

/* ---------- Vistas ---------- */
/* ---------- Métricas por tipo de ejercicio ---------- */
const maxOf = (arr) => { const v = arr.filter((x) => x != null && x > 0); return v.length ? Math.max(...v) : null; };
const METRIC = {
  wr: { label: '1RM est.', unit: 'kg', best: (sets) => maxOf(sets.map(e1rm)), vol: (s) => (s.w || 0) * (s.reps || 0), volUnit: 'kg' },
  bw: { label: 'Máx. reps', unit: 'reps', best: (sets) => maxOf(sets.map((s) => s.reps)), vol: (s) => s.reps || 0, volUnit: 'reps' },
  time: { label: 'Mejor tiempo', unit: 's', best: (sets) => maxOf(sets.map((s) => s.time)), vol: (s) => s.time || 0, volUnit: 's' },
  dist: { label: 'Mejor distancia', unit: 'm', best: (sets) => maxOf(sets.map((s) => s.dist)), vol: (s) => s.dist || 0, volUnit: 'm' },
};
function entryStats(entry) {
  const mode = exById(entry.exerciseId)?.mode || 'wr';
  const m = METRIC[mode] || METRIC.wr;
  const work = entry.sets.filter(isWork);
  return {
    mode, m, best: m.best(work), vol: work.reduce((a, s) => a + m.vol(s), 0), sets: work.length,
    topW: maxOf(work.map((s) => s.w)), reps: work.reduce((a, s) => a + (s.reps || 0), 0),
  };
}
const fmtM = (v, m, unit = m.unit) => v == null ? '–' : unit === 's' ? fmtSec(v) : `${fmt(v)} ${unit}`;
function delta(now, before) {
  if (!now || !before) return '';
  const p = (now / before - 1) * 100;
  if (Math.abs(p) < 0.5) return '<small class="delta">=</small>';
  return `<small class="delta ${p > 0 ? 'up' : 'down'}">${p > 0 ? '▲' : '▼'}${fmt(Math.abs(p), 0)}%</small>`;
}
const sortKey = (s) => s.date + s.createdAt;
const historyBefore = (exerciseId, s) => historyFor(exerciseId).filter((h) => h.sess.id !== s.id && sortKey(h.sess) < sortKey(s));
const norm = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function sessionText(s) {
  return norm([s.title, s.notes, s.preNotes, s.preObs, ...(s.factors || []),
    ...s.exercises.flatMap((e) => [exById(e.exerciseId)?.name, e.notes, ...e.equipment.map((q) => eqById(q)?.name)])].join(' '));
}
const FACTORS = ['Dormí mal', 'Estrés', 'Molestias / dolor', 'Agujetas', 'Sin comer', 'Cafeína / pre-entreno', 'Resfriado', 'Calor', 'Con prisa', 'Muy motivado'];

/* ---------- Calendario (pantalla de inicio) ---------- */
function sessionCard(s) {
  const sets = s.exercises.reduce((n, e) => n + e.sets.filter(isWork).length, 0);
  const tags = [...(s.factors || []), ...new Set(s.exercises.flatMap((e) => e.equipment).map((q) => eqById(q)?.name).filter(Boolean))];
  return `<a class="card list-item" href="#/session/${s.id}">
    <div class="row"><span class="title">${esc(s.title || 'Sesión')}</span><span class="spacer"></span>
      <span class="muted small">${fmtDate(s.date)}</span></div>
    <div class="muted small">${esc(s.exercises.map((e) => exById(e.exerciseId)?.name).filter(Boolean).join(' · ') || 'Sin ejercicios')}</div>
    <div class="stats">
      <div class="stat"><b>${sets}</b><span>series</span></div>
      <div class="stat"><b>${fmt(sessionVolume(s) / 1000, 2)} t</b><span>volumen</span></div>
      ${s.endedAt ? `<div class="stat"><b>${fmtDur(s.endedAt - s.startedAt)}</b><span>duración</span></div>` : '<div class="stat"><b>⏳</b><span>en curso</span></div>'}
      ${s.srpe ? `<div class="stat"><b>${s.srpe}</b><span>RPE sesión</span></div>` : ''}
      ${s.bodyweight ? `<div class="stat"><b>${fmt(s.bodyweight)} kg</b><span>peso</span></div>` : ''}
    </div>
    ${tags.length ? `<div>${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
  </a>`;
}

function viewCalendar() {
  const today = todayISO();
  const sel = ui.day || today;
  const [y, m] = (ui.month || sel.slice(0, 7)).split('-').map(Number);
  const byDay = {};
  for (const s of db.sessions) (byDay[s.date] = byDay[s.date] || []).push(s);
  const first = new Date(y, m - 1, 1);
  const offset = (first.getDay() + 6) % 7; // semana empieza en lunes
  const nDays = new Date(y, m, 0).getDate();
  const pad = (n) => String(n).padStart(2, '0');
  let cells = '';
  for (let i = 0; i < offset; i++) cells += '<span></span>';
  let monthCount = 0;
  for (let d = 1; d <= nDays; d++) {
    const iso = `${y}-${pad(m)}-${pad(d)}`;
    const n = byDay[iso]?.length || 0;
    monthCount += n;
    cells += `<button class="day ${iso === sel ? 'sel' : ''} ${iso === today ? 'today' : ''}" data-action="pick-day" data-day="${iso}" aria-label="${iso}${n ? `, ${n} sesiones` : ''}">${d}${n ? '<i></i>' : ''}</button>`;
  }
  const monthName = first.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).replace(/^./, (c) => c.toUpperCase());
  const q = norm(ui.csearch).trim();

  let html = `<h1>Calendario</h1>
    <input type="search" data-action-input="csearch" placeholder="Buscar: ejercicio, nota, material, sensación…" value="${esc(ui.csearch)}">
    <div style="height:12px"></div>`;

  if (q) {
    const words = q.split(/\s+/);
    const res = sortedSessions().filter((s) => { const t = sessionText(s); return words.every((w) => t.includes(w)); });
    html += `<div class="muted small" style="margin-bottom:8px">${res.length} resultado${res.length === 1 ? '' : 's'}</div>`;
    html += res.map(sessionCard).join('') || '<div class="empty">Ninguna sesión coincide.</div>';
    return html;
  }

  html += `<div class="card">
      <div class="row">
        <button class="icon ghost" data-action="month" data-d="-1" aria-label="Mes anterior">‹</button>
        <div class="spacer" style="text-align:center"><b>${monthName}</b>
          <div class="muted small">${monthCount} sesion${monthCount === 1 ? '' : 'es'}</div></div>
        <button class="icon ghost" data-action="month" data-d="1" aria-label="Mes siguiente">›</button>
      </div>
      <div class="cal">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => `<span class="dow">${d}</span>`).join('')}${cells}</div>
      ${sel !== today || ui.month !== today.slice(0, 7) ? '<button class="block ghost" data-action="go-today" style="margin-top:4px">Ir a hoy</button>' : ''}
    </div>
    <h2>${sel === today ? 'Hoy · ' : ''}${fmtDate(sel)}</h2>
    <div class="grid2">
      <button class="primary" data-action="new-session">＋ Nueva sesión</button>
      <button data-action="repeat-session" ${db.sessions.length ? '' : 'disabled'}>↻ Repetir…</button>
    </div><div style="height:12px"></div>`;
  const daySessions = (byDay[sel] || []).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  html += daySessions.map(sessionCard).join('') || '<div class="muted" style="padding:8px 0 16px">Sin sesiones este día.</div>';
  const recent = sortedSessions().filter((s) => s.date !== sel).slice(0, 3);
  if (recent.length) html += `<h2>Últimas sesiones</h2>${recent.map(sessionCard).join('')}`;
  return html;
}

/* ---------- Sesión ---------- */
function viewSession(id) {
  const s = sessionById(id);
  if (!s) return `<div class="empty">Sesión no encontrada. <a href="#/">Volver</a></div>`;
  s.factors = s.factors || [];
  const dur = (s.endedAt || Date.now()) - s.startedAt;
  const preFilled = s.bodyweight != null || s.readiness || s.sleep != null || s.stress || s.factors.length || s.preNotes || s.preObs;
  const preOpen = ui.preOpen[s.id] ?? (!s.exercises.length || false);
  let html = `<div class="row"><a class="btn ghost" href="#/">‹ Calendario</a><span class="spacer"></span>
      <button class="ghost" data-action="session-menu" data-id="${s.id}">⋯</button></div>
    <input data-s="title" value="${esc(s.title)}" placeholder="Nombre de la sesión (p. ej. Pierna A)" style="font-size:1.2rem;font-weight:700;margin:6px 0 10px">
    <div class="grid2">
      <div><label>Fecha</label><input type="date" data-s="date" value="${esc(s.date)}"></div>
      <div><label>${s.endedAt ? 'Duración' : 'En curso'}</label><div class="pill">${fmtDur(dur)} · <b id="vol">${fmt(sessionVolume(s), 0)} kg</b></div></div>
    </div>
    <details class="card pre" id="pre" ${preOpen ? 'open' : ''} style="margin-top:12px">
      <summary><b>Antes de empezar</b> <span class="muted small">opcional${preFilled && !preOpen ? ' · ✓ registrado' : ''}</span></summary>
      <div class="grid2" style="margin-top:10px">
        <div><label>Peso corporal (kg)</label><input type="number" inputmode="decimal" step="0.1" data-s="bodyweight" value="${s.bodyweight ?? ''}"></div>
        <div><label>Horas de sueño</label><input type="number" inputmode="decimal" step="0.5" data-s="sleep" value="${s.sleep ?? ''}"></div>
        <div><label>Energía (1 baja – 5 alta)</label>${scaleSelect('readiness', s.readiness, 1, 5)}</div>
        <div><label>Estrés (1 bajo – 5 alto)</label>${scaleSelect('stress', s.stress, 1, 5)}</div>
      </div>
      <label style="margin-top:10px">Factores que pueden influir</label>
      <div class="chips">${FACTORS.map((f) => `<button class="chip ${s.factors.includes(f) ? 'on' : ''}" data-action="toggle-factor" data-f="${esc(f)}">${esc(f)}</button>`).join('')}</div>
      <div style="height:10px"></div>
      <label>Sensaciones al empezar</label>
      <textarea data-s="preNotes" placeholder="Cómo te notas: pesado, fresco, rodilla cargada…">${esc(s.preNotes)}</textarea>
      <div style="height:8px"></div>
      <label>Observaciones importantes</label>
      <textarea data-s="preObs" placeholder="Viaje, gimnasio distinto, competición cerca, medicación…">${esc(s.preObs)}</textarea>
    </details>`;

  s.exercises.forEach((ex, i) => { html += exerciseCard(s, ex, i); });

  html += `<button class="block" data-action="add-exercise">＋ Añadir ejercicio</button>
    ${s.exercises.length ? sessionSummary(s) : ''}
    <div class="card" style="margin-top:12px">
      <label>Notas finales de la sesión</label>
      <textarea data-s="notes" placeholder="Cómo fue, qué cambiar la próxima vez…">${esc(s.notes)}</textarea>
      <div style="height:8px"></div>
      <label>RPE de la sesión (esfuerzo global 1-10)</label>${scaleSelect('srpe', s.srpe, 1, 10)}
    </div>
    ${s.endedAt
      ? `<button class="block" data-action="reopen-session">Reabrir sesión (seguir cronometrando)</button>`
      : `<button class="primary block" data-action="finish-session">✓ Finalizar sesión</button>`}`;
  return html;
}

function sessionSummary(s) {
  const all = s.exercises.flatMap((e) => e.sets.filter(isWork));
  const reps = all.reduce((a, x) => a + (x.reps || 0), 0);
  const rpes = all.map((x) => x.rpe).filter(Boolean);
  let records = 0;
  const volEx = [], catSets = {};
  for (const e of s.exercises) {
    const st = entryStats(e);
    const prevBest = maxOf(historyBefore(e.exerciseId, s).map((h) => entryStats(h.entry).best));
    if (st.best && prevBest && st.best > prevBest) records++;
    const kg = e.sets.filter(isWork).reduce((a, x) => a + (x.w || 0) * (x.reps || 0), 0);
    if (kg) volEx.push({ label: exById(e.exerciseId)?.name || '?', v: kg });
    const cat = exById(e.exerciseId)?.cat || 'Otros';
    catSets[cat] = (catSets[cat] || 0) + st.sets;
  }
  // Comparación con sesiones anteriores del mismo nombre
  const same = s.title ? sortedSessions().filter((x) => norm(x.title) === norm(s.title) && sortKey(x) <= sortKey(s)) : [];
  const prev = same.find((x) => x.id !== s.id);
  const vol = sessionVolume(s);
  const trend = same.slice(0, 10).reverse().map((x) => ({ d: x.date, v: sessionVolume(x) })).filter((p) => p.v);

  return `<h2>Resumen de la sesión</h2><div class="card">
    <div class="stats">
      <div class="stat"><b>${fmt(vol, 0)} kg ${prev ? delta(vol, sessionVolume(prev)) : ''}</b><span>volumen</span></div>
      <div class="stat"><b>${all.length}</b><span>series efectivas</span></div>
      <div class="stat"><b>${reps}</b><span>reps</span></div>
      <div class="stat"><b>${rpes.length ? fmt(rpes.reduce((a, b) => a + b, 0) / rpes.length) : '–'}</b><span>RPE medio</span></div>
      <div class="stat"><b>${records ? '★ ' + records : '0'}</b><span>récords</span></div>
    </div>
    ${prev ? `<div class="muted small" style="margin-top:8px">Comparado con «${esc(prev.title)}» del ${fmtDate(prev.date)}.</div>` : s.title ? '' : '<div class="muted small" style="margin-top:8px">Pon nombre a la sesión para compararla con las anteriores del mismo tipo.</div>'}
    ${volEx.length ? `<h3 class="sub">Volumen por ejercicio (kg)</h3>${bars(volEx, '')}` : ''}
    <h3 class="sub">Series efectivas por grupo</h3>${bars(Object.entries(catSets).filter(([, v]) => v).map(([label, v]) => ({ label, v })), '')}
    ${trend.length >= 2 ? `<h3 class="sub">Volumen en «${esc(s.title)}» (últimas ${trend.length})</h3>${chart(trend)}` : ''}
  </div>`;
}

function bars(items, unit) {
  const max = Math.max(1, ...items.map((i) => i.v));
  return items.map((i) => `<div class="bar"><span>${esc(i.label)}</span><div><i style="width:${(i.v / max * 100).toFixed(1)}%"></i></div><b>${fmt(i.v, 0)}${unit}</b></div>`).join('');
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

/* ---------- Tarjeta de ejercicio (registro de series) ---------- */
function exerciseCard(s, ex, i) {
  const def = exById(ex.exerciseId) || { name: '(ejercicio borrado)', mode: 'wr' };
  const mode = MODES[def.mode] || MODES.wr;
  const before = historyBefore(ex.exerciseId, s);
  const prev = before.find((h) => h.entry.sets.length);
  const st = entryStats(ex);
  const m = st.m;
  const pst = prev ? entryStats(prev.entry) : null;
  const prevBest = maxOf(before.map((h) => entryStats(h.entry).best));
  const open = ui.openEquip.has(ex.id);
  const chartOpen = ui.openChart.has(ex.id);

  let rows = '';
  ex.sets.forEach((set, j) => {
    const est = isWork(set) ? m.best([set]) : null;
    const isPR = est && prevBest && est > prevBest;
    rows += `<tr class="${set.done ? 'done' : ''}">
      <td><button class="settype ${set.type}" data-action="cycle-type" data-i="${i}" data-j="${j}" title="${SET_TYPES[set.type]}">${set.type === 'E' ? j + 1 : set.type}</button></td>
      ${mode.fields.map((f) => f === 'rpe' ? `<td>${rpeSelect(set.rpe, i, j)}</td>`
        : `<td><input type="number" inputmode="decimal" step="${FIELD[f].step}" data-set="${i}:${j}:${f}" value="${set[f] ?? ''}" placeholder="${f === 'w' && def.mode === 'bw' ? '+0' : ''}"></td>`).join('')}
      <td><button class="check ${set.done ? 'on' : ''}" data-action="toggle-done" data-i="${i}" data-j="${j}" aria-label="Hecha">✓</button></td>
      <td><button class="icon ghost" data-action="del-set" data-i="${i}" data-j="${j}" aria-label="Borrar serie">✕</button></td>
    </tr>${isPR ? `<tr><td></td><td colspan="${mode.fields.length + 1}" class="pr" style="text-align:left">★ Récord: ${fmtM(est, m)} (${m.label})</td></tr>` : ''}`;
  });

  const pts = [...before].reverse().map((h) => ({ d: h.sess.date, v: entryStats(h.entry).best })).filter((p) => p.v);
  if (st.best) pts.push({ d: s.date, v: st.best });
  const lastPts = pts.slice(-10);

  const eqSel = ex.equipment.map(eqById).filter(Boolean);
  return `<div class="card" data-ex="${i}">
    <div class="ex-head">
      <h3><a href="#/exercise/${ex.exerciseId}" style="color:inherit;text-decoration:none">${esc(def.name)}</a></h3>
      <button class="icon ghost ${chartOpen ? 'active' : ''}" data-action="toggle-chart" data-i="${i}" aria-label="Gráfica y datos">📈</button>
      <button class="icon ghost" data-action="move-ex" data-i="${i}" data-d="-1" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>↑</button>
      <button class="icon ghost" data-action="move-ex" data-i="${i}" data-d="1" aria-label="Bajar" ${i === s.exercises.length - 1 ? 'disabled' : ''}>↓</button>
      <button class="icon ghost danger" data-action="del-ex" data-i="${i}" aria-label="Quitar ejercicio">🗑</button>
    </div>
    <div class="exstats">
      <div><b>${fmtM(st.best, m)}</b> ${delta(st.best, pst?.best)}<span>${m.label} hoy</span></div>
      <div><b>${fmtM(st.vol, m, m.volUnit)}</b> ${delta(st.vol, pst?.vol)}<span>volumen hoy</span></div>
      <div><b>${fmtM(prevBest, m)}</b><span>récord previo</span></div>
    </div>
    ${prev ? `<div class="prev">Anterior (${fmtDate(prev.sess.date)}): ${esc(setsText(prev.entry, prev.entry.sets))}${prev.entry.equipment.length ? ' · ' + esc(prev.entry.equipment.map((x) => eqById(x)?.name).filter(Boolean).join(', ')) : ''}</div>
      ${prev.entry.notes ? `<div class="prev">📝 ${esc(prev.entry.notes)}</div>` : ''}` : '<div class="prev">Primera vez que registras este ejercicio.</div>'}
    ${chartOpen ? `<div class="insight">
      ${lastPts.length >= 2 ? `<div class="muted small">${m.label} por sesión (últimas ${lastPts.length})</div>${chart(lastPts)}` : '<div class="muted small">La gráfica aparece a partir de 2 sesiones con datos.</div>'}
      <div class="stats">
        <div class="stat"><b>${before.length + 1}</b><span>sesiones</span></div>
        <div class="stat"><b>${fmtM(maxOf([st.topW, ...before.map((h) => entryStats(h.entry).topW)]), m, 'kg')}</b><span>peso máx. histórico</span></div>
        ${st.mode === 'wr' && maxOf([st.best, prevBest]) ? `<div class="stat"><b>${fmt(Math.round(maxOf([st.best, prevBest]) * 0.8 / 2.5) * 2.5)} kg</b><span>80% del 1RM</span></div>` : ''}
        <div class="stat"><b>${before.length ? fmtDate(before[0].sess.date).replace(/ \d{4}$/, '') : '–'}</b><span>última vez</span></div>
      </div>
    </div>` : ''}
    <div class="chips" style="margin-top:8px">
      ${(open ? db.equipment : eqSel).map((e) => `<button class="chip ${ex.equipment.includes(e.id) ? 'on' : ''}" data-action="toggle-eq" data-i="${i}" data-eq="${e.id}">${esc(e.name)}</button>`).join('')}
      <button class="chip" data-action="open-eq" data-i="${i}">${open ? 'Listo' : '＋ Material'}</button>
    </div>
    <table class="sets">
      <thead><tr><th>Serie</th>${mode.fields.map((f) => `<th>${f === 'w' && def.mode === 'bw' ? 'Lastre' : FIELD[f].h}</th>`).join('')}<th>✓</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <button class="block" style="margin-top:8px" data-action="add-set" data-i="${i}">＋ Serie</button>
    <div style="height:8px"></div>
    <textarea data-exnote="${i}" placeholder="Notas: técnica, tempo, molestias, agarre…" rows="2">${esc(ex.notes)}</textarea>
  </div>`;
}

/* ---------- Progreso ---------- */
function viewExercises() {
  const q = norm(ui.search);
  const counts = {};
  for (const s of db.sessions) for (const e of s.exercises) counts[e.exerciseId] = (counts[e.exerciseId] || 0) + 1;
  let html = `<div class="row"><h1 class="spacer">Progreso</h1><button data-action="exercise-form">＋ Nuevo ejercicio</button></div>
    <input type="search" data-action-input="search" placeholder="Buscar ejercicio…" value="${esc(ui.search)}">
    <div style="height:12px"></div>`;
  const items = db.exercises.filter((e) => norm(e.name).includes(q))
    .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || a.name.localeCompare(b.name));
  for (const e of items) {
    const m = METRIC[e.mode] || METRIC.wr;
    const best = maxOf(historyFor(e.id).map((x) => entryStats(x.entry).best));
    html += `<a class="card list-item" href="#/exercise/${e.id}" style="padding:12px 14px">
      <div class="row"><span class="title">${esc(e.name)}</span><span class="spacer"></span>
      <span class="muted small">${counts[e.id] ? `${counts[e.id]} ses.${best ? ` · ${m.label} ${fmtM(best, m)}` : ''}` : esc(e.cat)}</span></div></a>`;
  }
  return html;
}

function viewExercise(id) {
  const def = exById(id);
  if (!def) return `<div class="empty">Ejercicio no encontrado. <a href="#/exercises">Volver</a></div>`;
  const m = METRIC[def.mode] || METRIC.wr;
  const all = historyFor(id);
  const usedEq = [...new Set(all.flatMap((h) => h.entry.equipment))].map(eqById).filter(Boolean);
  const f = ui.filterEq;
  const hist = all.filter((h) => f === 'all' ? true : f === 'none' ? h.entry.equipment.length === 0 : h.entry.equipment.includes(f));

  let best = null, topW = null, totalVol = 0;
  for (const h of hist) {
    const st = entryStats(h.entry);
    if (st.best && (!best || st.best > best.v)) best = { v: st.best, d: h.sess.date };
    if (st.topW && (!topW || st.topW > topW.v)) topW = { v: st.topW, d: h.sess.date };
    totalVol += st.vol;
  }

  let html = `<div class="row"><a class="btn ghost" href="#/exercises">‹ Progreso</a><span class="spacer"></span>
      <button class="ghost" data-action="exercise-form" data-id="${def.id}">✎ Editar</button></div>
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
      <div class="stat"><b>${best ? fmtM(best.v, m) : '–'}</b><span>mejor ${m.label}</span></div>
      ${def.mode === 'wr' || def.mode === 'bw' ? `<div class="stat"><b>${topW ? fmt(topW.v) + ' kg' : '–'}</b><span>peso máximo</span></div>` : ''}
      <div class="stat"><b>${hist.length}</b><span>sesiones</span></div>
      <div class="stat"><b>${fmtM(totalVol, m, m.volUnit)}</b><span>volumen total</span></div>
    </div></div>`;

  const pts = hist.map((h) => ({ d: h.sess.date, v: entryStats(h.entry).best })).filter((p) => p.v).reverse();
  if (pts.length >= 2) html += `<h2>${m.label} por sesión</h2><div class="card">${chart(pts)}</div>`;

  if (best && def.mode === 'wr') {
    html += `<h2>Tabla de cargas (1RM est. ${fmt(best.v)} kg)</h2><div class="card"><div class="stats">
      ${[1, 2, 3, 5, 8, 10].map((r) => `<div class="stat"><b>${fmt(Math.round(best.v / (1 + (r === 1 ? 0 : r / 30)) / 2.5) * 2.5)} kg</b><span>${r} rep @10</span></div>`).join('')}
    </div></div>`;
  }

  html += `<h2>Historial</h2>`;
  if (!hist.length) html += `<div class="empty">Sin registros${f !== 'all' ? ' con este filtro' : ''}.</div>`;
  for (const h of hist) {
    const st = entryStats(h.entry);
    html += `<a class="card list-item" href="#/session/${h.sess.id}">
      <div class="row"><b>${fmtDate(h.sess.date)}</b><span class="spacer"></span>${st.best ? `<span class="muted small">${m.label} ${fmtM(st.best, m)}</span>` : ''}</div>
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
function newSession(fromId, date = ui.day || todayISO()) {
  const src = fromId && sessionById(fromId);
  const s = {
    id: uid(), createdAt: new Date().toISOString(), date, startedAt: Date.now(), endedAt: null,
    title: src ? src.title : '', notes: '', bodyweight: null, readiness: null, sleep: null, stress: null, srpe: null,
    factors: [], preNotes: '', preObs: '',
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
  const rows = [['fecha', 'sesion', 'peso_corporal', 'energia', 'sueno', 'estres', 'factores', 'ejercicio', 'serie', 'tipo', 'kg', 'reps', 'rpe', 'segundos', 'metros', 'hecha', 'e1rm', 'material', 'notas_ejercicio']];
  for (const s of sortedSessions().reverse()) for (const e of s.exercises) e.sets.forEach((x, j) => rows.push([
    s.date, s.title, s.bodyweight, s.readiness, s.sleep, s.stress, (s.factors || []).join(' | '), exById(e.exerciseId)?.name, j + 1, SET_TYPES[x.type], x.w, x.reps, x.rpe, x.time, x.dist, x.done ? 'si' : 'no',
    e1rm(x) ? fmt(e1rm(x)) : '', e.equipment.map((q) => eqById(q)?.name).join(' | '), j === 0 ? e.notes : '',
  ]));
  return rows.map((r) => r.map((c) => { const v = String(c ?? ''); return /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }).join(';')).join('\n');
}

const actions = {
  'new-session': () => newSession(),
  'repeat-session': () => {
    const list = sortedSessions().slice(0, 30);
    openModal(`<div class="row"><h3 class="spacer">Repetir una sesión</h3><button class="ghost" data-action="close-modal">✕</button></div>
      <p class="muted small">Se crea una sesión el ${fmtDate(ui.day || todayISO())} copiando ejercicios, material y cargas como punto de partida.</p>
      <div class="picker-list">${list.map((s) => `<button data-action="repeat-from" data-id="${s.id}"><b>${esc(s.title || 'Sesión')}</b>&nbsp;<span class="muted">${fmtDate(s.date)}</span></button>`).join('')}</div>`);
  },
  'repeat-from': (el) => { closeModal(); newSession(el.dataset.id); },
  'session-menu': () => openModal(`<div class="row"><h3 class="spacer">Sesión</h3><button class="ghost" data-action="close-modal">✕</button></div>
      <div style="display:grid;gap:8px;margin-top:10px">
        <button data-action="duplicate-session">Duplicar como nueva sesión de hoy</button>
        <button class="danger" data-action="delete-session">Borrar sesión</button>
      </div>`),
  'duplicate-session': () => { const s = currentSession(); closeModal(); newSession(s.id, todayISO()); },
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
  'pick-day': (el) => { ui.day = el.dataset.day; rerender(); },
  'month': (el) => {
    const [y, m] = ui.month.split('-').map(Number);
    const d = new Date(y, m - 1 + +el.dataset.d, 1);
    ui.month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; rerender();
  },
  'go-today': () => { ui.day = todayISO(); ui.month = ui.day.slice(0, 7); rerender(); },
  'toggle-factor': (el) => {
    const s = currentSession(); const f = el.dataset.f;
    s.factors = s.factors.includes(f) ? s.factors.filter((x) => x !== f) : [...s.factors, f];
    ui.preOpen[s.id] = true; save(); rerender();
  },
  'toggle-chart': (el) => {
    const id = currentSession().exercises[+el.dataset.i].id;
    ui.openChart.has(id) ? ui.openChart.delete(id) : ui.openChart.add(id); rerender();
  },
  'exercise-form': (el) => {
    const e = el.dataset.id ? exById(el.dataset.id) : null;
    const used = e && db.sessions.some((s) => s.exercises.some((x) => x.exerciseId === e.id));
    openModal(`<div class="row"><h3 class="spacer">${e ? 'Editar' : 'Nuevo'} ejercicio</h3><button class="ghost" data-action="close-modal">✕</button></div>
      <div style="display:grid;gap:10px;margin-top:10px">
        <div><label>Nombre</label><input id="ef-name" value="${esc(e?.name)}" placeholder="p. ej. Sentadilla búlgara"></div>
        <div><label>Grupo</label><select id="ef-cat">${CATEGORIES.map((c) => `<option ${e?.cat === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        <div><label>Cómo se registra</label><select id="ef-mode" ${used ? 'disabled' : ''}>${Object.entries(MODES).map(([k, m]) => `<option value="${k}" ${e?.mode === k ? 'selected' : ''}>${m.label}</option>`).join('')}</select>
          ${used ? '<div class="muted small">No se puede cambiar: ya tiene series registradas.</div>' : ''}</div>
        <button class="primary" data-action="save-exercise" data-id="${e?.id || ''}">Guardar</button>
      </div>`);
  },
  'save-exercise': (el) => {
    const name = $('#ef-name').value.trim(); if (!name) return alert('Pon un nombre.');
    const dup = db.exercises.find((x) => norm(x.name) === norm(name) && x.id !== el.dataset.id);
    if (dup) return alert('Ya existe un ejercicio con ese nombre.');
    let e = el.dataset.id && exById(el.dataset.id);
    if (!e) { e = { id: uid() }; db.exercises.push(e); }
    e.name = name; e.cat = $('#ef-cat').value; if (!$('#ef-mode').disabled) e.mode = $('#ef-mode').value;
    save(); closeModal(); location.hash = `#/exercise/${e.id}`; rerender();
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
      <button class="primary block" data-action="exercise-form">＋ Nuevo ejercicio</button>`);
  },
  'rename-exercise': (el) => actions['exercise-form'](el),
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
  if (t.dataset.actionInput) {
    const k = t.dataset.actionInput; ui[k] = t.value; const pos = t.selectionStart; render();
    const n = $(`[data-action-input="${k}"]`); n.focus(); n.setSelectionRange(pos, pos); return;
  }
  if (t.dataset.setting) { db.settings[t.dataset.setting] = num(t.value) ?? 0; save(); return; }
  const s = currentSession(); if (!s) return;
  if (t.dataset.s) {
    const k = t.dataset.s;
    s[k] = ['bodyweight', 'readiness', 'sleep', 'stress', 'srpe'].includes(k) ? num(t.value) : t.value;
    if (k === 'date' && t.value) { ui.day = t.value; ui.month = t.value.slice(0, 7); }
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

document.addEventListener('toggle', (e) => {
  if (e.target.id === 'pre') { const s = currentSession(); if (s) ui.preOpen[s.id] = e.target.open; }
}, true);

// Refresca la duración en curso cada minuto.
setInterval(() => {
  const s = currentSession();
  if (s && !s.endedAt && !document.activeElement?.matches('input,textarea,select') && !modal.open) rerender();
}, 60000);

if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

render();
