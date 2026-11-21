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
  wr: { label: 'Peso × reps', fields: ['w', 'reps'] },
  bw: { label: 'Peso corporal (+lastre)', fields: ['w', 'reps'] },
  time: { label: 'Tiempo', fields: ['w', 'time'] },
  dist: { label: 'Distancia y tiempo', fields: ['dist', 'time'] },
};
const FIELD = {
  w: { h: 'kg', step: '0.5' }, reps: { h: 'Reps', step: '1' }, time: { h: 'Seg', step: '1' },
  dist: { h: 'Metros', step: '1' }, rpe: { h: 'RPE' }, rir: { h: 'RIR' },
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
    settings: { rest: 120, dropWarn: 10, intensity: 'rpe' },
  };
}
function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.sessions) return d; } catch (e) { /* datos corruptos */ }
  return seed();
}
let db = load();
db.settings = { rest: 120, dropWarn: 10, intensity: 'rpe', ...db.settings };
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
  const rir = set.rir != null ? set.rir : set.rpe ? Math.max(0, 10 - set.rpe) : 0;
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
    if (s.rir != null) t += ` RIR${s.rir >= 6 ? '6+' : fmt(s.rir)}`;
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
    a.dataset.tab === (r.name === 'session' ? 'sessions' : ['exercise', 'analysis'].includes(r.name) ? 'exercises' : r.name)));
  const app = $('#app');
  const view = { sessions: viewCalendar, session: viewSession, exercises: viewExercises, exercise: viewExercise, analysis: viewAnalysis, settings: viewSettings }[r.name] || viewCalendar;
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
/* ---------- Fatiga ----------
 * Caída de rendimiento entre series: e1RM (corregido por RIR/RPE) de la serie frente a la mejor serie
 * efectiva anterior del mismo ejercicio en la sesión. No necesita sensor; depende de un RIR/RPE honesto.
 */
const INTENSITY = { rpe: 'RPE', rir: 'RIR', both: 'RPE + RIR' };
const intensityOf = (def) => def?.intensity || db.settings.intensity || 'rpe';
const intensityFields = (def) => ({ rpe: ['rpe'], rir: ['rir'], both: ['rpe', 'rir'] }[intensityOf(def)]);
// RPE y RIR no cuadran (escala RPE ≈ 10 − RIR). Solo en la zona donde la escala es fiable.
function rpeRirMismatch(set) {
  if (set.rpe == null || set.rir == null) return null;
  if (set.rpe < 7 && set.rir > 3) return null;
  const d = set.rpe - (10 - set.rir);
  return Math.abs(d) >= 1 ? d : null;
}
// Caída del e1RM de la serie j respecto a la mejor serie efectiva anterior del mismo ejercicio.
function setDrop(sets, j) {
  const cur = sets[j];
  if (!isWork(cur)) return null;
  const now = e1rm(cur);
  const prev = maxOf(sets.slice(0, j).filter(isWork).map(e1rm));
  if (!now || !prev) return null;
  return ((prev - now) / prev) * 100;
}
function sessionFatigue(s) {
  const drops = [];
  let nearFail = 0;
  for (const e of s.exercises) {
    e.sets.forEach((x, j) => {
      if (!isWork(x)) return;
      const d = setDrop(e.sets, j); if (d != null) drops.push(d);
      if (x.type === 'F' || x.rir === 0 || (x.rpe && x.rpe >= 9.5)) nearFail++;
    });
  }
  return { drops, nearFail, dropHigh: drops.filter((d) => d >= db.settings.dropWarn).length };
}

/* ---------- Análisis: factores frente a rendimiento ----------
 * Rendimiento relativo de una sesión = media, sobre sus ejercicios con 1RM estimado, de
 * (1RM est. del día / mediana del 1RM est. de ese ejercicio en ±6 semanas, sin contar ese día) − 1.
 * Comparar con la mediana de las semanas cercanas descuenta la tendencia de progreso a largo plazo.
 */
const median = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const sd = (a) => { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
const WINDOW_DAYS = 42;

function relativePerformance() {
  const byEx = {};
  for (const s of db.sessions) for (const e of s.exercises) {
    if ((exById(e.exerciseId)?.mode || 'wr') !== 'wr') continue;
    const best = entryStats(e).best;
    if (best) (byEx[e.exerciseId] = byEx[e.exerciseId] || []).push({ sid: s.id, t: Date.parse(s.date), best });
  }
  const acc = {};
  for (const items of Object.values(byEx)) for (const it of items) {
    const near = items.filter((o) => o.sid !== it.sid && Math.abs(o.t - it.t) <= WINDOW_DAYS * 864e5).map((o) => o.best);
    if (near.length < 2) continue;
    (acc[it.sid] = acc[it.sid] || []).push((it.best / median(near) - 1) * 100);
  }
  const out = {};
  for (const [sid, arr] of Object.entries(acc)) out[sid] = mean(arr);
  return out;
}
function compareGroups(a, b) {
  const ma = mean(a), mb = mean(b);
  if (ma == null || mb == null) return { diff: null, na: a.length, nb: b.length };
  const sa = sd(a), sb = sd(b);
  const se = sa != null && sb != null ? Math.sqrt(sa ** 2 / a.length + sb ** 2 / b.length) : null;
  const diff = ma - mb;
  let verdict;
  if (a.length < 3 || b.length < 3 || se == null) verdict = 'pocos';
  else if (Math.abs(diff) > 2 * se) verdict = diff < 0 ? 'peor' : 'mejor';
  else verdict = 'nada';
  return { diff, se, na: a.length, nb: b.length, verdict };
}
const VERDICT = {
  pocos: ['muted', 'Pocos datos'], nada: ['muted', 'Sin diferencia clara'],
  peor: ['down', 'Rindes peor'], mejor: ['up', 'Rindes mejor'],
};
function divBar(v, scale = 10) {
  if (v == null) return '<div class="dbar"></div>';
  const w = Math.min(50, (Math.abs(v) / scale) * 50);
  return `<div class="dbar"><i class="${v < 0 ? 'neg' : 'pos'}" style="width:${w}%;${v < 0 ? `right:50%` : `left:50%`}"></i></div>`;
}
const pct = (v) => v == null ? '–' : `${v > 0 ? '+' : ''}${fmt(v, 1)}%`;

function viewAnalysis() {
  const rel = relativePerformance();
  const sess = db.sessions.filter((s) => rel[s.id] != null);
  let html = `<div class="row"><a class="btn ghost" href="#/exercises">‹ Progreso</a></div>
    <h1>Factores y rendimiento ${info('rel_perf')}</h1>
    <div class="card muted small">
      <b>Cómo se calcula.</b> Para cada ejercicio con peso, el 1RM estimado del día se compara con la mediana ${info('median')} de ese ejercicio en las
      ${WINDOW_DAYS / 7} semanas de alrededor (sin contar ese día), y así se descuenta tu progresión. La sesión recibe la media de sus ejercicios.
      Un −3% quiere decir que ese día rendiste un 3% por debajo de lo normal para ti en esas fechas.<br><br>
      «Rindes peor/mejor» aparece solo si la diferencia supera 2 errores estándar (≈ IC 95%) y hay al menos 3 sesiones en cada grupo.
      Es <b>correlación, no causa</b>: «dormí mal» puede coincidir con días de más estrés, o lo marcas <i>porque</i> la sesión fue mal.
      Para que tenga valor, marca los factores <b>antes</b> de entrenar.
    </div>`;
  if (sess.length < 6) {
    return html + `<div class="empty">Hacen falta más datos: hay ${sess.length} sesiones analizables.<br>
      Una sesión es analizable cuando sus ejercicios con peso aparecen al menos 2 veces más en las ${WINDOW_DAYS / 7} semanas de alrededor.
      Apunta el RPE o el RIR en las series para que el 1RM estimado sea fiable.</div>`;
  }
  const all = sess.map((s) => rel[s.id]);
  html += `<div class="card"><div class="stats">
    <div class="stat"><b>${sess.length}</b><span>sesiones analizadas</span></div>
    <div class="stat"><b>±${fmt(sd(all), 1)}%</b><span>variación típica entre días ${info('se')}</span></div>
  </div></div>`;

  // Factores marcados
  const rows = FACTORS.map((f) => {
    const a = sess.filter((s) => (s.factors || []).includes(f)).map((s) => rel[s.id]);
    const b = sess.filter((s) => !(s.factors || []).includes(f)).map((s) => rel[s.id]);
    return { f, ...compareGroups(a, b) };
  }).filter((r) => r.na > 0).sort((x, y) => (x.diff ?? 0) - (y.diff ?? 0));
  html += `<h2>Factores marcados ${info('causation')}</h2><div class="card">`;
  html += rows.length ? rows.map((r) => {
    const [cls, txt] = VERDICT[r.verdict];
    return `<div class="arow"><div><b>${esc(r.f)}</b><div class="muted small">con: ${r.na} · sin: ${r.nb}</div></div>
      ${divBar(r.diff)}<div class="aval"><b>${pct(r.diff)}</b><small class="delta ${cls}">${txt}${r.se ? ` ±${fmt(2 * r.se, 1)}` : ''}</small></div></div>`;
  }).join('') : '<div class="muted">Aún no has marcado factores en sesiones analizables.</div>';
  html += `</div>`;

  // Escalas numéricas
  const scales = [
    ['Horas de sueño', 'sleep', [['< 6 h', (v) => v < 6], ['6 – 7,5 h', (v) => v >= 6 && v < 7.5], ['≥ 7,5 h', (v) => v >= 7.5]]],
    ['Energía al empezar', 'readiness', [['Baja (1-2)', (v) => v <= 2], ['Media (3)', (v) => v === 3], ['Alta (4-5)', (v) => v >= 4]]],
    ['Estrés', 'stress', [['Bajo (1-2)', (v) => v <= 2], ['Medio (3)', (v) => v === 3], ['Alto (4-5)', (v) => v >= 4]]],
  ];
  for (const [title, key, buckets] of scales) {
    const withVal = sess.filter((s) => s[key] != null);
    html += `<h2>${title}</h2><div class="card">`;
    if (withVal.length < 3) { html += `<div class="muted small">Registrado en ${withVal.length} sesiones analizables; hacen falta más.</div></div>`; continue; }
    for (const [label, test] of buckets) {
      const v = withVal.filter((s) => test(s[key])).map((s) => rel[s.id]);
      const m = mean(v), s2 = sd(v);
      html += `<div class="arow"><div><b>${label}</b><div class="muted small">n = ${v.length}</div></div>
        ${divBar(m)}<div class="aval"><b>${pct(m)}</b>${s2 != null && v.length >= 3 ? `<small class="muted">±${fmt(2 * s2 / Math.sqrt(v.length), 1)}</small>` : ''}</div></div>`;
    }
    html += `</div>`;
  }

  // Peso corporal frente a rendimiento (correlación de Pearson)
  const bw = sess.filter((s) => s.bodyweight);
  if (bw.length >= 6) {
    const xs = bw.map((s) => s.bodyweight), ys = bw.map((s) => rel[s.id]);
    const mx = mean(xs), my = mean(ys);
    const r = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / Math.sqrt(xs.reduce((a, x) => a + (x - mx) ** 2, 0) * ys.reduce((a, y) => a + (y - my) ** 2, 0) || 1);
    html += `<h2>Peso corporal ${info('corr')}</h2><div class="card"><b>r = ${fmt(r, 2)}</b> <span class="muted small">(n = ${bw.length}).
      ${Math.abs(r) < 0.3 ? 'Relación débil o nula.' : r > 0 ? 'Con más peso corporal tiendes a rendir más.' : 'Con más peso corporal tiendes a rendir menos.'}</span></div>`;
  }
  return html;
}

/* ---------- Glosario: iconos ⓘ junto a términos técnicos ---------- */
const GLOSSARY = {
  rpe: ['RPE · Esfuerzo percibido', `
    <p><b>RPE</b> (<i>Rating of Perceived Exertion</i>) puntúa de 1 a 10 lo dura que ha sido una serie. En fuerza se usa la versión basada en las repeticiones que te quedaban (Zourdos et al., 2016):</p>
    <table class="gt"><tr><th>RPE</th><th>Significado</th></tr>
      <tr><td>10</td><td>Máximo: no podías hacer ni una rep más ni subir peso</td></tr>
      <tr><td>9,5</td><td>No podías otra rep, pero quizá sí algo más de peso</td></tr>
      <tr><td>9</td><td>Te quedaba 1 rep</td></tr>
      <tr><td>8,5</td><td>Quizá 2, seguro 1</td></tr>
      <tr><td>8</td><td>Te quedaban 2 reps</td></tr>
      <tr><td>7</td><td>Te quedaban 3 reps</td></tr>
      <tr><td>≤ 6</td><td>4 o más; esfuerzo ligero o moderado</td></tr></table>
    <p>Además de la cercanía al fallo, recoge sensaciones globales: respiración, molestias, dificultad técnica. Por eso a veces no cuadra exactamente con el RIR.</p>`],
  rir: ['RIR · Repeticiones en reserva', `
    <p><b>RIR</b> (<i>Repetitions In Reserve</i>) es cuántas repeticiones más podrías haber hecho <b>con buena técnica</b>. RIR 0 = fallo; RIR 2 = te quedaban dos.</p>
    <p><b>Precisión:</b> se estima mejor cerca del fallo y en series de pocas repeticiones. Lejos del fallo (RIR 4 o más) o en series largas se suele <b>infraestimar</b>: crees que te quedan menos de las que en realidad te quedan. Mejora con la práctica; de vez en cuando, comprueba tu estimación llevando una serie segura al fallo.</p>`],
  intensity: ['RPE, RIR o ambos', `
    <p>Puedes medir la intensidad de cada ejercicio de tres formas; la app recuerda la elegida para ese ejercicio:</p>
    <ul><li><b>RPE</b>: esfuerzo percibido (1-10).</li><li><b>RIR</b>: repeticiones que te quedaban.</li>
    <li><b>RPE + RIR</b>: los dos. Si rellenas uno, la app propone el otro con la equivalencia <b>RPE ≈ 10 − RIR</b>.</li></ul>
    <p><b>¿Para qué los dos?</b> El RIR mide lo cerca que estás del fallo muscular; el RPE, el esfuerzo global. Si no cuadran (p. ej. RPE 9 con RIR 3), la discrepancia es un dato: puede indicar fatiga general (cardiovascular, sueño), molestias, técnica exigente o que estás estimando mal el RIR.</p>
    <p>Para el 1RM estimado tiene prioridad el <b>RIR</b>; si no hay, se usa 10 − RPE.</p>`],
  e1rm: ['1RM estimado', `
    <p>El <b>1RM</b> es el peso máximo que podrías levantar una vez. Aquí se <b>estima</b> sin probarlo, con la fórmula de Epley corregida por las repeticiones que te quedaban:</p>
    <p class="formula">1RM ≈ peso × (1 + (reps + RIR) / 30)</p>
    <p>Ejemplo: 100 kg × 5 con RIR 2 → 100 × (1 + 7/30) ≈ 123 kg.</p>
    <p><b>Limitaciones:</b> pierde precisión con muchas repeticiones (no se calcula si reps + RIR &gt; 15), depende de que el RIR/RPE sea honesto, y <b>no sirve para movimientos de halterofilia</b> (arrancada, dos tiempos), donde la técnica y la velocidad limitan más que la fuerza. Si no apuntas RPE ni RIR, se asume que llegaste al fallo.</p>`],
  pr: ['Récord estimado', `<p>La serie da un <b>1RM estimado superior</b> a cualquiera de sesiones anteriores de este ejercicio. No es un récord real de 1 repetición, sino una mejora de tu capacidad estimada.</p>`],
  volume: ['Volumen (tonelaje)', `
    <p>Suma de <b>peso × repeticiones</b> de las series efectivas (sin calentamiento). En ejercicios de peso corporal se cuentan repeticiones; en los de tiempo, segundos; en los de distancia, metros.</p>
    <p><b>Limitación:</b> no tiene en cuenta lo cerca del fallo que estuviste. Para hipertrofia, el número de <b>series efectivas</b> cercanas al fallo por grupo muscular suele ser mejor indicador que los kilos totales.</p>`],
  work_sets: ['Series efectivas', `<p>Todas las series salvo las de <b>calentamiento</b>. Son las que cuentan para volumen, récords y fatiga.</p>`],
  set_types: ['Tipos de serie', `
    <p>Toca el número de la serie para cambiar su tipo:</p>
    <ul><li><b>1, 2, 3…</b> Efectiva: serie de trabajo normal.</li>
    <li><b>C</b> Calentamiento: no cuenta para volumen, récords ni fatiga.</li>
    <li><b>D</b> Drop set: serie que sigue a otra sin descanso, bajando el peso.</li>
    <li><b>F</b> Al fallo: llevada hasta no poder completar otra repetición.</li></ul>`],
  drop: ['Caída de rendimiento', `
    <p>Compara el <b>1RM estimado de esta serie</b> con el de tu <b>mejor serie efectiva anterior</b> del mismo ejercicio en la sesión. Si cae más del umbral (por defecto 10%), es probable que la fatiga se esté acumulando.</p>
    <p>Ejemplo: serie 1 → 120 kg estimados; serie 3 → 105 kg estimados → caída del 12,5%.</p>
    <p><b>Fiabilidad:</b> depende totalmente de que apuntes RPE o RIR con honestidad. Mide la fatiga <i>entre</i> series, no dentro de la serie. Una caída puede ser buscada (series de volumen tras una pesada); el aviso es información, no una orden.</p>`],
  near_fail: ['Series al fallo o cerca', `<p>Series marcadas como <b>F</b>, con <b>RIR 0</b> o con <b>RPE ≥ 9,5</b>. Muchas en una misma sesión elevan la fatiga y el tiempo de recuperación, sin que eso suponga necesariamente más ganancias.</p>`],
  srpe: ['RPE de la sesión (sRPE)', `
    <p>Valoración del esfuerzo <b>global</b> de toda la sesión (1-10), idealmente unos 30 minutos después de terminar (método de Foster, 2001).</p>
    <p>Multiplicado por la duración da la <b>carga interna</b> en unidades arbitrarias (UA): 60 min × sRPE 7 = 420 UA. Sirve para comparar sesiones de tipos distintos y vigilar cambios bruscos de carga semana a semana.</p>`],
  load: ['Carga interna (UA)', `<p><b>sRPE × minutos</b> de sesión, en unidades arbitrarias (UA). Combina cuánto duró y lo dura que fue. Su valor absoluto importa poco: es útil para comparar entre sesiones y semanas tuyas.</p>`],
  readiness: ['Energía al empezar (readiness)', `<p>Cómo de preparado te sientes antes de entrenar, de 1 (muy bajo) a 5 (muy alto). Es subjetivo, pero en el análisis de factores se cruza con tu rendimiento real para ver si te sirve como predictor.</p>`],
  rel_perf: ['Rendimiento relativo', `
    <p>Para cada ejercicio con peso, compara el <b>1RM estimado del día</b> con la <b>mediana</b> de ese ejercicio en las 6 semanas de alrededor (sin contar ese día):</p>
    <p class="formula">rendimiento = 1RM est. del día / mediana de su entorno − 1</p>
    <p>Así se descuenta tu progresión a largo plazo: un −3% significa que ese día rendiste un 3% por debajo de lo normal para ti en esas fechas. La sesión recibe la media de sus ejercicios.</p>`],
  median: ['Mediana', `<p>El valor central de una lista ordenada. A diferencia de la media, apenas le afecta un día excepcionalmente bueno o malo, por eso se usa como referencia.</p>`],
  se: ['Error estándar e IC 95%', `
    <p>El <b>±</b> que acompaña a cada diferencia indica la incertidumbre: con pocas sesiones o mucha variación entre días, el número real podría estar bastante lejos del calculado.</p>
    <p>Se muestra <b>±2 errores estándar</b>, que equivale aproximadamente a un <b>intervalo de confianza del 95%</b>. «Rindes peor/mejor» solo aparece si la diferencia es mayor que ese margen y hay al menos 3 sesiones en cada grupo.</p>`],
  corr: ['Correlación (r)', `
    <p>El coeficiente <b>r de Pearson</b> va de −1 a 1: 1 = cuando una variable sube, la otra también, siempre; −1 = sube una y baja la otra; 0 = sin relación lineal.</p>
    <p>Orientativo: |r| &lt; 0,3 débil; 0,3-0,5 moderada; &gt; 0,5 fuerte. <b>Correlación no implica causa.</b></p>`],
  causation: ['Correlación no es causa', `<p>Que rindas peor los días que marcas «Dormí mal» no prueba que el sueño sea la causa: puede coincidir con estrés, peor alimentación… O puedes marcarlo <i>porque</i> la sesión fue mal. Para reducir este sesgo, <b>marca los factores antes de entrenar</b>.</p>`],
  load_table: ['Tabla de cargas', `<p>Peso aproximado que podrías mover para cada número de repeticiones <b>llevando la serie al fallo</b> (RPE 10 / RIR 0), calculado a partir de tu mejor 1RM estimado con la fórmula de Epley y redondeado a 2,5 kg. Para series a RIR 2, súmale 2 a las repeticiones.</p>`],
  pct1rm: ['% del 1RM', `<p>Porcentaje de tu 1RM estimado. Es habitual programar por porcentajes: ~80% suele permitir unas 6-8 repeticiones al fallo, aunque varía mucho entre personas y ejercicios.</p>`],
};
function info(k) {
  return `<button class="info" data-action="info" data-k="${k}" aria-label="Qué es: ${esc(GLOSSARY[k]?.[0] || k)}">i</button>`;
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
        <div><label>Energía (1 baja – 5 alta) ${info('readiness')}</label>${scaleSelect('readiness', s.readiness, 1, 5)}</div>
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
      <label>RPE de la sesión (esfuerzo global 1-10) ${info('srpe')}</label>${scaleSelect('srpe', s.srpe, 1, 10)}
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
  const rirs = all.map((x) => x.rir).filter((x) => x != null);
  const mins = Math.round(((s.endedAt || Date.now()) - s.startedAt) / 60000);
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
  // Compara solo los ejercicios presentes en ambas sesiones (evita falsas caídas con la sesión a medias).
  const common = prev ? s.exercises.map((e) => e.exerciseId).filter((id) => prev.exercises.some((e) => e.exerciseId === id)) : [];
  const volIn = (x, ids) => x.exercises.filter((e) => ids.includes(e.exerciseId)).reduce((a, e) => a + e.sets.filter(isWork).reduce((b, z) => b + (z.w || 0) * (z.reps || 0), 0), 0);
  const trend = same.slice(0, 10).reverse().map((x) => ({ d: x.date, v: sessionVolume(x) })).filter((p) => p.v);

  return `<h2>Resumen de la sesión</h2><div class="card">
    <div class="stats">
      <div class="stat"><b>${fmt(vol, 0)} kg ${prev ? delta(volIn(s, common), volIn(prev, common)) : ''}</b><span>volumen ${info('volume')}</span></div>
      <div class="stat"><b>${all.length}</b><span>series efectivas ${info('work_sets')}</span></div>
      <div class="stat"><b>${reps}</b><span>reps</span></div>
      ${rpes.length ? `<div class="stat"><b>${fmt(mean(rpes))}</b><span>RPE medio ${info('rpe')}</span></div>` : ''}
      ${rirs.length ? `<div class="stat"><b>${fmt(mean(rirs))}</b><span>RIR medio ${info('rir')}</span></div>` : ''}
      <div class="stat"><b>${records ? '★ ' + records : '0'}</b><span>récords ${info('pr')}</span></div>
      ${s.srpe && mins > 0 ? `<div class="stat"><b>${s.srpe * mins} UA</b><span>carga interna ${info('load')}</span></div>` : ''}
    </div>
    ${prev ? `<div class="muted small" style="margin-top:8px">Variación de volumen frente a «${esc(prev.title)}» del ${fmtDate(prev.date)}, solo en los ejercicios comunes.</div>` : s.title ? '' : '<div class="muted small" style="margin-top:8px">Pon nombre a la sesión para compararla con las anteriores del mismo tipo.</div>'}
    ${fatigueBlock(s)}
    ${volEx.length ? `<h3 class="sub">Volumen por ejercicio (kg)</h3>${bars(volEx, '')}` : ''}
    <h3 class="sub">Series efectivas por grupo</h3>${bars(Object.entries(catSets).filter(([, v]) => v).map(([label, v]) => ({ label, v })), '')}
    ${trend.length >= 2 ? `<h3 class="sub">Volumen en «${esc(s.title)}» (últimas ${trend.length})</h3>${chart(trend)}` : ''}
  </div>`;
}

function fatigueBlock(s) {
  const f = sessionFatigue(s);
  if (!f.drops.length && !f.nearFail) return '';
  const level = f.dropHigh >= 2 ? 'high' : f.dropHigh || f.nearFail >= 3 ? 'mid' : 'low';
  const msg = { high: 'Fatiga alta: valora cortar series o bajar carga en lo que queda.', mid: 'Fatiga moderada.', low: 'Fatiga controlada.' }[level];
  return `<h3 class="sub">Fatiga</h3>
    <div class="fat ${level}">${msg}</div>
    <div class="stats">
      <div class="stat"><b>${f.dropHigh}</b><span>series con caída ≥ ${db.settings.dropWarn}% ${info('drop')}</span></div>
      <div class="stat"><b>${f.nearFail}</b><span>al fallo, RIR 0 o RPE ≥ 9,5 ${info('near_fail')}</span></div>
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

function rirSelect(val, i, j) {
  let o = `<option value="">–</option>`;
  for (let r = 0; r <= 6; r++) o += `<option value="${r}" ${val === r ? 'selected' : ''}>${r === 6 ? '6+' : r}</option>`;
  return `<select data-set="${i}:${j}:rir" aria-label="RIR">${o}</select>`;
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
  const fields = [...mode.fields, ...intensityFields(def)];

  let rows = '';
  ex.sets.forEach((set, j) => {
    const est = isWork(set) ? m.best([set]) : null;
    const isPR = est && prevBest && est > prevBest;
    rows += `<tr class="${set.done ? 'done' : ''}">
      <td><button class="settype ${set.type}" data-action="cycle-type" data-i="${i}" data-j="${j}" title="${SET_TYPES[set.type]}">${set.type === 'E' ? j + 1 : set.type}</button></td>
      ${fields.map((f) => f === 'rpe' ? `<td>${rpeSelect(set.rpe, i, j)}</td>` : f === 'rir' ? `<td>${rirSelect(set.rir, i, j)}</td>`
        : `<td><input type="number" inputmode="decimal" step="${FIELD[f].step}" data-set="${i}:${j}:${f}" value="${set[f] ?? ''}" placeholder="${f === 'w' && def.mode === 'bw' ? '+0' : ''}"></td>`).join('')}
      <td><button class="check ${set.done ? 'on' : ''}" data-action="toggle-done" data-i="${i}" data-j="${j}" aria-label="Hecha">✓</button></td>
      <td><button class="icon ghost" data-action="del-set" data-i="${i}" data-j="${j}" aria-label="Borrar serie">✕</button></td>
    </tr>${isPR ? `<tr><td></td><td colspan="${fields.length + 1}" class="pr" style="text-align:left">★ Récord: ${fmtM(est, m)} (${m.label}) ${info('pr')}</td></tr>` : ''}`;
    const drop = setDrop(ex.sets, j);
    if (drop != null && drop >= db.settings.dropWarn) rows += `<tr><td></td><td colspan="${fields.length + 1}" class="fatigue">⚠ Rendimiento −${fmt(drop, 0)}% frente a tu mejor serie de hoy: posible fatiga acumulada ${info('drop')}</td></tr>`;
    const mis = rpeRirMismatch(set);
    if (mis != null) rows += `<tr><td></td><td colspan="${fields.length + 1}" class="mismatch">RPE ${fmt(set.rpe)} y RIR ${fmt(set.rir)} no cuadran (RPE ${fmt(set.rpe)} ≈ RIR ${fmt(10 - set.rpe)}): ${mis > 0 ? 'más esfuerzo global que cercanía al fallo' : 'más cerca del fallo de lo que sentiste'} ${info('intensity')}</td></tr>`;
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
      <div><b>${fmtM(st.best, m)}</b> ${delta(st.best, pst?.best)}<span>${m.label} hoy ${st.mode === 'wr' ? info('e1rm') : ''}</span></div>
      <div><b>${fmtM(st.vol, m, m.volUnit)}</b> ${delta(st.vol, pst?.vol)}<span>volumen hoy ${info('volume')}</span></div>
      <div><b>${fmtM(prevBest, m)}</b><span>récord previo</span></div>
    </div>
    ${prev ? `<div class="prev">Anterior (${fmtDate(prev.sess.date)}): ${esc(setsText(prev.entry, prev.entry.sets))}${prev.entry.equipment.length ? ' · ' + esc(prev.entry.equipment.map((x) => eqById(x)?.name).filter(Boolean).join(', ')) : ''}</div>
      ${prev.entry.notes ? `<div class="prev">📝 ${esc(prev.entry.notes)}</div>` : ''}` : '<div class="prev">Primera vez que registras este ejercicio.</div>'}
    ${chartOpen ? `<div class="insight">
      ${lastPts.length >= 2 ? `<div class="muted small">${m.label} por sesión (últimas ${lastPts.length})</div>${chart(lastPts)}` : '<div class="muted small">La gráfica aparece a partir de 2 sesiones con datos.</div>'}
      <div class="stats">
        <div class="stat"><b>${before.length + 1}</b><span>sesiones</span></div>
        <div class="stat"><b>${fmtM(maxOf([st.topW, ...before.map((h) => entryStats(h.entry).topW)]), m, 'kg')}</b><span>peso máx. histórico</span></div>
        ${st.mode === 'wr' && maxOf([st.best, prevBest]) ? `<div class="stat"><b>${fmt(Math.round(maxOf([st.best, prevBest]) * 0.8 / 2.5) * 2.5)} kg</b><span>80% del 1RM ${info('pct1rm')}</span></div>` : ''}
        <div class="stat"><b>${before.length ? fmtDate(before[0].sess.date).replace(/ \d{4}$/, '') : '–'}</b><span>última vez</span></div>
      </div>
    </div>` : ''}
    <div class="chips" style="margin-top:8px">
      ${(open ? db.equipment : eqSel).map((e) => `<button class="chip ${ex.equipment.includes(e.id) ? 'on' : ''}" data-action="toggle-eq" data-i="${i}" data-eq="${e.id}">${esc(e.name)}</button>`).join('')}
      <button class="chip" data-action="open-eq" data-i="${i}">${open ? 'Listo' : '＋ Material'}</button>
    </div>
    <div class="row" style="margin-top:8px"><button class="chip" data-action="cycle-intensity" data-i="${i}">Intensidad: <b>${INTENSITY[intensityOf(def)]}</b> ⇄</button>${info('intensity')}</div>
    <table class="sets">
      <thead><tr><th>Serie ${info('set_types')}</th>${fields.map((f) => `<th>${f === 'w' && def.mode === 'bw' ? 'Lastre' : FIELD[f].h}${f === 'rpe' || f === 'rir' ? ' ' + info(f) : ''}</th>`).join('')}<th>✓</th><th></th></tr></thead>
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
    <a class="card list-item" href="#/analysis" style="display:flex;align-items:center;gap:10px">
      <span style="font-size:1.4rem">🔬</span><span class="spacer"><b>Factores y rendimiento</b>
      <div class="muted small">Cómo influyen el sueño, el estrés, la energía y los factores que marcas</div></span><span>›</span></a>
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
      <div class="stat"><b>${best ? fmtM(best.v, m) : '–'}</b><span>mejor ${m.label} ${def.mode === 'wr' ? info('e1rm') : ''}</span></div>
      ${def.mode === 'wr' || def.mode === 'bw' ? `<div class="stat"><b>${topW ? fmt(topW.v) + ' kg' : '–'}</b><span>peso máximo</span></div>` : ''}
      <div class="stat"><b>${hist.length}</b><span>sesiones</span></div>
      <div class="stat"><b>${fmtM(totalVol, m, m.volUnit)}</b><span>volumen total ${info('volume')}</span></div>
    </div></div>`;

  const pts = hist.map((h) => ({ d: h.sess.date, v: entryStats(h.entry).best })).filter((p) => p.v).reverse();
  if (pts.length >= 2) html += `<h2>${m.label} por sesión</h2><div class="card">${chart(pts)}</div>`;

  if (best && def.mode === 'wr') {
    html += `<h2>Tabla de cargas (1RM est. ${fmt(best.v)} kg) ${info('load_table')}</h2><div class="card"><div class="stats">
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
    <h2>Intensidad y fatiga</h2>
    <div class="card">
      <label>Medir la intensidad por defecto con ${info('intensity')}</label>
      <select data-setting-str="intensity">${Object.entries(INTENSITY).map(([k, v]) => `<option value="${k}" ${db.settings.intensity === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <div class="muted small" style="margin:6px 0 10px">Se aplica a los ejercicios en los que no hayas elegido otra cosa. En cada ejercicio puedes cambiarlo con «Intensidad ⇄».</div>
      <label>Aviso de caída de rendimiento entre series (%) ${info('drop')}</label>
      <input type="number" inputmode="numeric" data-setting="dropWarn" value="${db.settings.dropWarn}">
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
  const rows = [['fecha', 'sesion', 'peso_corporal', 'energia', 'sueno', 'estres', 'factores', 'ejercicio', 'serie', 'tipo', 'kg', 'reps', 'rpe', 'rir', 'segundos', 'metros', 'hecha', 'e1rm', 'material', 'notas_ejercicio']];
  for (const s of sortedSessions().reverse()) for (const e of s.exercises) e.sets.forEach((x, j) => rows.push([
    s.date, s.title, s.bodyweight, s.readiness, s.sleep, s.stress, (s.factors || []).join(' | '), exById(e.exerciseId)?.name, j + 1, SET_TYPES[x.type], x.w, x.reps, x.rpe, x.rir, x.time, x.dist, x.done ? 'si' : 'no',
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
      sets: prev ? prev.entry.sets.map((x) => ({ ...x, done: false })) : [{ type: 'E', w: null, reps: null, rpe: null, rir: null, done: false }],
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
    ex.sets.push(last ? { ...last, done: false, type: last.type === 'C' ? 'E' : last.type } : { type: 'E', w: null, reps: null, rpe: null, rir: null, done: false });
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
  'cycle-intensity': (el) => {
    const def = exById(currentSession().exercises[+el.dataset.i].exerciseId);
    const order = Object.keys(INTENSITY);
    def.intensity = order[(order.indexOf(intensityOf(def)) + 1) % order.length];
    save(); rerender();
  },
  'info': (el) => {
    const [title, body] = GLOSSARY[el.dataset.k] || ['', ''];
    openModal(`<div class="row"><h3 class="spacer">${title}</h3><button class="ghost" data-action="close-modal" aria-label="Cerrar">✕</button></div>
      <div class="gloss">${body}</div>
      <button class="block" style="margin-top:12px" data-action="close-modal">Entendido</button>`);
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
  if (t.dataset.settingStr) { db.settings[t.dataset.settingStr] = t.value; save(); return; }
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
    const set = s.exercises[+i].sets[+j];
    set[f] = num(t.value);
    // Modo RPE + RIR: rellenar el otro valor si está vacío (RPE ≈ 10 − RIR).
    if (intensityOf(exById(s.exercises[+i].exerciseId)) === 'both') {
      if (f === 'rpe' && set.rpe != null && set.rir == null && Number.isInteger(10 - set.rpe) && set.rpe >= 6) set.rir = 10 - set.rpe;
      if (f === 'rir' && set.rir != null && set.rpe == null && set.rir <= 4) set.rpe = 10 - set.rir;
    }
    save();
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
