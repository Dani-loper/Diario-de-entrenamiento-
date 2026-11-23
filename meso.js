'use strict';
/* Mesociclos: una secuencia de días (cada día es una tabla) que se repite N semanas con progresión, más una descarga.
 * - Semana k (0…N−1) de acumulación: RIR objetivo de rirStart a rirEnd en línea recta (redondeado a entero) y,
 *   según la opción, una serie más por ejercicio cada semana o cada dos (copia de la última serie efectiva).
 * - Semana de descarga (k = N): la mitad de series efectivas, RIR 4 y el 90 % del %1RM de la primera semana.
 * - El peso de cada serie lo calcula la tabla con el 1RM estimado del atleta (o el % explícito si la tabla lo trae).
 * - La semana va por la «semana del atleta» (Ajustes › Microciclo). Las sesiones quedan enlazadas (sess.meso) para
 *   saber qué día toca. Los mesociclos son de cada atleta; las tablas, comunes. */

const mesoList = () => (db.mesos = db.mesos || []);
const mesoGet = (id) => mesoList().find((m) => m.id === id);
const SETS_MODES = { none: 'Mismas series todas las semanas', step2: '+1 serie por ejercicio cada 2 semanas', step1: '+1 serie por ejercicio cada semana' };
const totalWeeks = (m) => m.weeks + (m.deload ? 1 : 0);
// Semana del mesociclo para una fecha: −1 antes de empezar, ≥ totalWeeks si ya terminó.
function mesoWeekOf(m, iso = todayISO()) { return Math.floor((dayNum(iso) - dayNum(m.start)) / cycleLen()); }
const isDeloadWeek = (m, k) => m.deload && k === m.weeks;
function weekRir(m, k) {
  if (isDeloadWeek(m, k)) return 4;
  const r = m.weeks > 1 ? m.rirStart - (m.rirStart - m.rirEnd) * k / (m.weeks - 1) : m.rirStart;
  // RIR entero: estimarlo tiene ~1 repetición de error (Halperin et al., 2022); medio punto sería falsa precisión.
  return Math.round(r);
}
const extraSets = (m, k) => (isDeloadWeek(m, k) ? 0 : m.setsMode === 'step1' ? k : m.setsMode === 'step2' ? Math.floor(k / 2) : 0);
const weekLabel = (m, k) => (isDeloadWeek(m, k) ? 'Descarga' : `Semana ${k + 1}`);

// Tabla transformada para la semana k (no se guarda: se usa para cargar la sesión y para la vista previa).
function mesoTemplate(m, k, d) {
  const tpl = typeof tplGet === 'function' ? tplGet(m.days[d]) : null; if (!tpl) return null;
  const t = JSON.parse(JSON.stringify(tpl));
  const rir = weekRir(m, k), deload = isDeloadWeek(m, k);
  t.name = `${m.name} · ${weekLabel(m, k)} · ${tpl.name}`;
  for (const te of t.exercises) {
    const work = te.sets.filter((x) => x.type !== 'C');
    if (!work.length) continue;
    if (deload) {
      // % de la primera semana (con el RIR inicial) × 0,9; la mitad de series.
      for (const x of work) { const base = x.pct ?? (x.rir != null ? tplSetPct({ ...x, rir: m.rirStart }) : null); x.pct = base ? Math.round(base * 0.9 * 10) / 10 : null; x.rir = 4; }
      const keep = Math.ceil(work.length / 2);
      let seen = 0; te.sets = te.sets.filter((x) => x.type === 'C' || ++seen <= keep);
    } else {
      for (const x of work) if (x.rir != null || x.pct == null) x.rir = rir;
      const last = work[work.length - 1];
      for (let n = 0; n < extraSets(m, k); n++) te.sets.push({ ...last });
    }
  }
  return t;
}
// Qué toca: semana actual y primer día de esa semana sin sesión enlazada.
function mesoNext(m, iso = todayISO()) {
  const k = mesoWeekOf(m, iso);
  if (k < 0 || k >= totalWeeks(m)) return { k, d: -1, done: [] };
  const done = db.sessions.filter((s) => s.meso?.id === m.id && s.meso.week === k).map((s) => s.meso.day);
  const d = m.days.findIndex((_, i) => !done.includes(i));
  return { k, d, done };
}
const activeMeso = (iso = todayISO()) => mesoList().find((m) => { const k = mesoWeekOf(m, iso); return k >= 0 && k < totalWeeks(m); });

// Series efectivas planificadas por músculo para la semana k (recuento fraccionado, como en Progreso).
function mesoVolume(m, k) {
  const acc = {};
  m.days.forEach((_, d) => {
    const t = mesoTemplate(m, k, d); if (!t) return;
    for (const te of t.exercises) {
      const def = db.exercises.find((e) => norm(e.name) === norm(te.name)) || te;
      addShares(acc, def, te.sets.filter((x) => x.type !== 'C').length);
    }
  });
  return acc;
}

/* ---------- Vistas ---------- */
function mesoCardHTML(iso) {
  const m = activeMeso(iso); if (!m) return '';
  const { k, d, done } = mesoNext(m, iso);
  const tpl = d >= 0 ? tplGet(m.days[d]) : null;
  return `<div class="card meso-card">
    <div class="row"><b class="spacer">${ic('chart')} ${esc(m.name)}</b><a class="small" href="#/meso/${m.id}">Ver</a></div>
    <div class="muted small">${weekLabel(m, k)} de ${m.weeks}${m.deload && !isDeloadWeek(m, k) ? ' + descarga' : ''} · RIR ${fmt(weekRir(m, k))} · ${done.length}/${m.days.length} días hechos</div>
    ${tpl ? `<button class="primary block" style="margin-top:8px" data-action="meso-start" data-id="${m.id}" data-k="${k}" data-d="${d}">${ic('play')} Entrenar: Día ${d + 1} · ${esc(tpl.name)}</button>`
      : `<div class="muted small" style="margin-top:6px">${d < 0 && done.length ? `${weekLabel(m, k)} completada.` : 'Faltan tablas en este mesociclo.'} <a href="#/meso/${m.id}">Elegir un día</a></div>`}
  </div>`;
}
function zoneCell(v, m) {
  if (!v) return '<td class="muted">–</td>';
  const L = window.landmarksOf ? landmarksOf(m) : null, z = L ? volZone(v, L) : 'none'; // lumbar: sin referencia
  return `<td><span class="zc z-${z}">${fmt(v, 1)}</span></td>`;
}
function viewMeso(id) {
  const m = mesoGet(id);
  if (!m) return `<div class="empty">Mesociclo no encontrado. <a href="#/templates">Volver</a></div>`;
  const tpls = tplList().sort((a, b) => a.name.localeCompare(b.name));
  const W = totalWeeks(m), cur = mesoWeekOf(m);
  const vols = Array.from({ length: W }, (_, k) => mesoVolume(m, k));
  const muscles = MUSCLE_KEYS.filter((x) => vols.some((v) => v[x]));
  return `<div class="row"><a class="btn ghost" href="#/templates">‹ Tablas</a><span class="spacer"></span><button class="ghost danger" data-action="meso-del" data-id="${m.id}">${ic('trash')} Borrar</button></div>
    <input data-meso="${m.id}:name" value="${esc(m.name)}" style="font-size:1.2rem;font-weight:700;margin:6px 0 10px" aria-label="Nombre del mesociclo">
    <div class="card">
      <div class="grid2">
        <div><label>Empieza el</label><input type="date" data-meso="${m.id}:start" value="${esc(m.start)}"></div>
        <div><label>Semanas de carga</label><select data-meso="${m.id}:weeks">${[2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${m.weeks === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div><label>RIR al empezar</label><select data-meso="${m.id}:rirStart">${[...new Set([4, 3, 2, m.rirStart])].map((n) => `<option value="${n}" ${m.rirStart === n ? 'selected' : ''}>${fmt(n)}</option>`).join('')}</select></div>
        <div><label>RIR al terminar</label><select data-meso="${m.id}:rirEnd">${[...new Set([3, 2, 1, 0, m.rirEnd])].map((n) => `<option value="${n}" ${m.rirEnd === n ? 'selected' : ''}>${fmt(n)}</option>`).join('')}</select></div>
      </div>
      <label style="margin-top:10px">Series</label><select data-meso="${m.id}:setsMode">${Object.entries(SETS_MODES).map(([k, v]) => `<option value="${k}" ${m.setsMode === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <label class="row" style="margin-top:10px;color:var(--text);font-size:.9rem"><input type="checkbox" data-meso="${m.id}:deload" ${m.deload ? 'checked' : ''} style="width:auto;min-height:0"> Semana de descarga al final ${info('deload')}</label>
    </div>
    <h2>Días ${info('meso')}</h2>
    ${m.days.map((tid, d) => { const t = tplGet(tid); return `<div class="card row"><b>Día ${d + 1}</b><span class="spacer">${t ? esc(t.name) : '<span class="mismatch">Tabla borrada</span>'}</span>
      ${cur >= 0 && cur < W && t ? `<button class="small-btn" data-action="meso-start" data-id="${m.id}" data-k="${cur}" data-d="${d}">${ic('play')} Entrenar</button>` : ''}
      <button class="icon ghost danger" data-action="meso-day-del" data-id="${m.id}" data-d="${d}" aria-label="Quitar día">✕</button></div>`; }).join('')}
    ${tpls.length ? `<select id="meso-add" aria-label="Añadir día"><option value="">＋ Añadir un día (elige una tabla)…</option>${tpls.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select>`
      : '<div class="muted small">Primero crea alguna tabla: cada día del mesociclo es una tabla.</div>'}
    ${m.days.length ? `<h2>Plan semana a semana</h2>
    <div class="card gt-wrap"><table class="gt meso-plan"><tr><th></th>${Array.from({ length: W }, (_, k) => `<th class="${k === cur ? 'cur' : ''}">${isDeloadWeek(m, k) ? 'Desc.' : 'S' + (k + 1)}</th>`).join('')}</tr>
      <tr><td>RIR</td>${Array.from({ length: W }, (_, k) => `<td>${fmt(weekRir(m, k))}</td>`).join('')}</tr>
      <tr><td>Fechas</td>${Array.from({ length: W }, (_, k) => `<td class="small">${shortDate(isoFromNum(dayNum(m.start) + k * cycleLen()))}</td>`).join('')}</tr>
      ${muscles.map((x) => `<tr><td>${MUSCLES[x]}</td>${vols.map((v) => zoneCell(v[x], x)).join('')}</tr>`).join('')}
    </table>
    <div class="muted small" style="margin-top:6px">Series efectivas planificadas por músculo y semana (principal 1, secundario 0,5), coloreadas según tus referencias de volumen ${info('landmarks')}. La idea habitual: empezar cerca del MEV y acabar cerca del MRV, y después descargar.</div></div>` : ''}`;
}
function mesoListHTML() {
  const list = mesoList();
  return `<div class="row" style="margin-top:6px"><h2 class="spacer" style="margin:0">Mesociclos ${info('meso')}</h2><button class="small-btn" data-action="meso-new">＋ Nuevo</button></div>
    <div class="muted small" style="margin:4px 0 8px">De ${esc(activeUser().name)}. Un mesociclo repite tus tablas varias semanas con progresión de RIR y series, y termina en descarga.</div>
    ${list.map((m) => { const k = mesoWeekOf(m); const st = k < 0 ? `Empieza el ${shortDate(m.start)}` : k >= totalWeeks(m) ? 'Terminado' : `${weekLabel(m, k)} de ${m.weeks}`;
      return `<a class="card list-item" href="#/meso/${m.id}"><div class="row"><b class="spacer">${esc(m.name)}</b><span class="muted small">${st}</span></div>
        <div class="muted small">${m.days.length} día${m.days.length === 1 ? '' : 's'} · RIR ${fmt(m.rirStart)} → ${fmt(m.rirEnd)} · ${SETS_MODES[m.setsMode].toLowerCase()}</div></a>`; }).join('')}
    <h2 style="margin-top:18px">Tablas</h2>`;
}

Object.assign(actions, {
  'meso-new': () => {
    const m = { id: uid(), name: 'Mesociclo', start: weekStart(todayISO()), weeks: 4, deload: true, rirStart: 3, rirEnd: 1, setsMode: 'step2', days: [], createdAt: Date.now(), updatedAt: Date.now() };
    mesoList().push(m); save(); location.hash = `#/meso/${m.id}`;
  },
  'meso-del': (el) => { if (!confirm('¿Borrar este mesociclo? Las sesiones ya hechas se conservan.')) return; db.mesos = mesoList().filter((x) => x.id !== el.dataset.id); save(); location.hash = '#/templates'; },
  'meso-day-del': (el) => { const m = mesoGet(el.dataset.id); m.days.splice(+el.dataset.d, 1); m.updatedAt = Date.now(); save(); rerender(); },
  'meso-start': (el) => {
    const m = mesoGet(el.dataset.id), k = +el.dataset.k, d = +el.dataset.d, t = mesoTemplate(m, k, d); if (!t) return;
    const day = route().name === 'sessions' ? (ui.day || todayISO()) : todayISO();
    location.hash = '#/';
    setTimeout(() => {
      newSession(null, day);
      const s = currentSession(); s.title = t.name; s.meso = { id: m.id, week: k, day: d };
      const miss = loadTemplateInto(s, t);
      save(true); rerender(); if (miss.length) setTimeout(() => toast(`Sin 1RM estimado en: ${miss.join(', ')}. Escribe el peso.`), 300);
    }, 0);
  },
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'meso-add' && t.value) { const m = mesoGet(route().id); m.days.push(t.value); m.updatedAt = Date.now(); save(); rerender(); return; }
  if (!t.dataset?.meso) return;
  const [id, k] = t.dataset.meso.split(':'), m = mesoGet(id); if (!m) return;
  if (k === 'name') m.name = t.value.trim() || 'Mesociclo';
  else if (k === 'start') { if (!t.value) return; m.start = t.value; }
  else if (k === 'deload') m.deload = t.checked;
  else if (k === 'setsMode') m.setsMode = t.value;
  else m[k] = num(t.value);
  if (m.rirEnd > m.rirStart) m.rirEnd = m.rirStart;
  m.updatedAt = Date.now(); save();
  if (k !== 'name') rerender();
});
Object.assign(window, { viewMeso, mesoListHTML, mesoCardHTML, mesoTemplate, mesoVolume, mesoNext, activeMeso, weekRir });
if (route().name === 'meso' || route().name === 'templates' || route().name === 'sessions') rerender();
