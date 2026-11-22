'use strict';
/* Evolución del 1RM por ejercicio y Salón de la fama.
 * - Gráfica de evolución: eje X proporcional a la fecha (no a la sesión), periodo seleccionable,
 *   línea de récord (máximo acumulado), récords marcados y detalle al tocar un punto.
 * - Salón de la fama: por ejercicio, el récord de su métrica (1RM est., reps, tiempo o distancia) y los
 *   máximos por repeticiones (RM reales), con acceso al vídeo de la serie cuando lo tiene. */

// Fuerza relativa: 1RM estimado ÷ peso corporal.
const REL_METRIC = { label: '1RM est. ÷ peso corporal', unit: '× PC', fmt: (v) => `${fmt(v, 2)} × PC` };
const fmtV = (v, m) => m.fmt ? m.fmt(v) : fmtM(v, m);
const RANGES = { '3m': ['3 M', 91], '6m': ['6 M', 182], '1y': ['1 año', 365], all: ['Todo', null] };
const dayMs = 864e5;
const isoMs = (iso) => new Date(iso + 'T12:00').getTime();
const shortDate = (iso, year = false) => new Date(iso + 'T12:00').toLocaleDateString('es-ES', year ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' });

// Mejor serie (según la métrica del ejercicio) de cada sesión, en orden cronológico.
function bestSetsByDate(def, hist) {
  const m = METRIC[def.mode] || METRIC.wr;
  const val = (s) => m.best([s]);
  const out = [];
  for (const h of [...hist].reverse()) {
    let best = null;
    h.entry.sets.forEach((s, j) => {
      if (!isWork(s)) return;
      const v = val(s); if (!v) return;
      if (!best || v > best.v) best = { v, j, set: s };
    });
    if (best) out.push({ d: h.sess.date, sid: h.sess.id, ei: h.sess.exercises.indexOf(h.entry), entry: h.entry, ...best });
  }
  return out;
}
function markRecords(pts) {
  let run = 0;
  for (const p of pts) { p.pr = p.v > run + 1e-9; run = Math.max(run, p.v); p.run = run; }
  return pts;
}
// Valores «redondos» para las líneas guía del eje Y.
function niceTicks(min, max, n = 4) {
  const span = max - min || Math.abs(max) || 1, raw = span / n, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw);
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, out = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(+v.toFixed(6));
  return out;
}

function progressChartHTML(def, hist) {
  const canRel = def.mode === 'wr' && window.bodyweightAt;
  let raw = bestSetsByDate(def, hist), rel = false;
  if (canRel && ui.chartRel) {
    const log = bodyweightLog();
    const relPts = raw.map((p) => { const bw = bodyweightAt(p.d, log); return bw ? { ...p, abs: p.v, bw, v: p.v / bw } : null; }).filter(Boolean);
    if (relPts.length >= 2) { raw = relPts; rel = true; }
  }
  const m = rel ? REL_METRIC : METRIC[def.mode] || METRIC.wr;
  const all = markRecords(raw);
  if (all.length < 2) return '';
  const r = ui.erange || '1y', days = RANGES[r][1];
  const last = isoMs(all[all.length - 1].d);
  let pts = days ? all.filter((p) => isoMs(p.d) >= last - days * dayMs) : all;
  if (pts.length < 2) pts = all.slice(-2);
  if (ui.chartDef !== def.id) ui.chartSel = null;
  ui.chartPts = pts; ui.chartDef = def.id; ui.chartM = m;

  const W = 340, H = 190, L = 34, R = 10, T = 10, B = 24;
  const t0 = isoMs(pts[0].d), t1 = isoMs(pts[pts.length - 1].d), tspan = t1 - t0 || 1;
  const vs = pts.flatMap((p) => [p.v, p.run]);
  const ticks = niceTicks(Math.min(...vs), Math.max(...vs));
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const x = (p) => L + ((isoMs(p.d) - t0) / tspan) * (W - L - R);
  const y = (v) => T + (1 - (v - y0) / (y1 - y0 || 1)) * (H - T - B);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  // Récord vigente: escalón (solo sube cuando hay un récord).
  const step = pts.map((p, i) => i ? `H${x(p).toFixed(1)}V${y(p.run).toFixed(1)}` : `M${x(p).toFixed(1)},${y(p.run).toFixed(1)}`).join('');
  const lab = (v) => rel ? fmt(v, 2) : def.mode === 'time' ? fmtSec(v) : fmt(v, v >= 100 ? 0 : 1);
  const mid = pts.length > 4 ? pts[Math.floor(pts.length / 2)] : null;
  const yr = tspan > 300 * dayMs, dense = pts.length > 30; // muchas sesiones: solo se dibujan los récords y el seleccionado

  const first = pts[0], lastP = pts[pts.length - 1], ch = lastP.v - first.v, chp = (lastP.v / first.v - 1) * 100;
  const sel = ui.chartSel != null && pts[ui.chartSel] ? ui.chartSel : pts.length - 1;
  return `<div class="row wrap" style="justify-content:space-between;gap:6px;margin-bottom:6px">
      <div class="seg small-seg">${Object.entries(RANGES).map(([k, [l]]) => `<button class="${k === r ? 'on' : ''}" data-action="erange" data-r="${k}">${l}</button>`).join('')}</div>
      ${canRel ? `<div class="seg small-seg"><button class="${ui.chartRel ? '' : 'on'}" data-action="${ui.chartRel ? 'chart-rel' : 'noop'}">kg</button><button class="${ui.chartRel ? 'on' : ''}" data-action="${ui.chartRel ? 'noop' : 'chart-rel'}">× peso corp.</button></div>` : ''}</div>
    ${canRel && ui.chartRel && !rel ? '<div class="mismatch small" style="margin-bottom:6px">Faltan registros de peso corporal cerca de estas sesiones (±30 días). Anótalo en Progreso o en «Antes de empezar».</div>' : ''}
    <div class="muted small">En el periodo: <b class="${ch > 0 ? 'up' : ch < 0 ? 'down' : ''}">${ch > 0 ? '+' : ''}${fmtV(ch, m)} (${chp > 0 ? '+' : ''}${fmt(chp, 1)}%)</b> · ${pts.length} sesiones · ${pts.filter((p) => p.pr).length} récords</div>
    <svg class="chart pchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución de ${esc(m.label)} de ${esc(def.name)}">
      ${ticks.map((v) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${L - 4}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end">${lab(v)}</text>`).join('')}
      <text x="${L}" y="${H - 6}">${shortDate(first.d, yr)}</text>
      ${mid ? `<text x="${x(mid).toFixed(1)}" y="${H - 6}" text-anchor="middle">${shortDate(mid.d, yr)}</text>` : ''}
      <text x="${W - R}" y="${H - 6}" text-anchor="end">${shortDate(lastP.d, yr)}</text>
      <path class="run" d="${step}"/>
      <path class="ln" d="${line}"/>
      ${pts.map((p, i) => `<circle class="${p.pr ? 'pt pr-pt' : 'pt'}${i === sel ? ' sel' : ''}${dense && !p.pr ? ' thin' : ''}" cx="${x(p).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${p.pr ? 4.5 : 3}"/>`).join('')}
      ${pts.map((p, i) => `<circle class="hit" data-action="chart-pt" data-k="${i}" cx="${x(p).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="13"/>`).join('')}
    </svg>
    <div class="chart-legend muted small"><span><i class="lg-ln"></i>mejor serie de la sesión</span><span><i class="lg-run"></i>récord vigente</span><span><i class="lg-pr"></i>récord nuevo</span></div>
    <div id="chart-detail">${chartDetailHTML(def, pts[sel], m)}</div>`;
}
function chartDetailHTML(def, p, m = METRIC[def.mode] || METRIC.wr) {
  if (!p) return '';
  return `<a class="chart-detail" href="#/session/${p.sid}">
    <b>${fmtDate(p.d)}</b>${p.pr ? ' <span class="pr">★ récord</span>' : ''}${p.set.videoId ? ` ${ic('video')}` : ''}<br>
    ${esc(m.label)}: <b>${fmtV(p.v, m)}</b>${p.bw ? ` (${fmt(p.abs)} kg ÷ ${fmt(p.bw)} kg)` : ''} · ${esc(setsText(p.entry, [p.set]))}<span class="spacer"></span> ›</a>`;
}

/* ---------- Salón de la fama ---------- */
// Máximos por repeticiones: el mayor peso movido con N repeticiones (1-12), y si tiene vídeo.
function repMaxes(hist) {
  const best = {};
  for (const h of hist) h.entry.sets.forEach((s, j) => {
    if (!isWork(s) || !s.w || !s.reps || s.reps > 12 || !Number.isInteger(s.reps)) return;
    const b = best[s.reps];
    if (!b || s.w > b.set.w || (s.w === b.set.w && !b.set.videoId && s.videoId)) best[s.reps] = { set: s, j, d: h.sess.date, sid: h.sess.id, ei: h.sess.exercises.indexOf(h.entry), entry: h.entry };
  });
  // Solo los «RM reales»: si con más repeticiones se movió el mismo peso o más, el de menos reps no es un máximo.
  const reps = Object.keys(best).map(Number).sort((a, b) => b - a);
  let top = 0; const out = [];
  for (const n of reps) { if (best[n].set.w > top) { out.push({ n, ...best[n] }); top = best[n].set.w; } }
  return out.reverse();
}
function hofEntries() {
  const out = [];
  for (const def of db.exercises) {
    const hist = historyFor(def.id); if (!hist.length) continue;
    const pts = bestSetsByDate(def, hist); if (!pts.length) continue;
    const rec = pts.reduce((a, p) => (p.v > a.v ? p : a));
    out.push({ def, rec, hist, sessions: hist.length, rms: def.mode === 'wr' ? repMaxes(hist) : [] });
  }
  return out.sort((a, b) => b.sessions - a.sessions || a.def.name.localeCompare(b.def.name));
}
const vidBtn = (p) => p.set.videoId
  ? `<button class="icon vid-btn" data-action="hof-video" data-sid="${p.sid}" data-ei="${p.ei}" data-j="${p.j}" aria-label="Ver vídeo">${ic('play')}</button>` : '';

function viewRecords() {
  const list = hofEntries();
  const onlyVid = ui.hofVideo;
  let html = `<h1>Salón de la fama</h1>`;
  if (!list.length) return html + '<div class="empty">Aún no hay récords. Registra series y aparecerán aquí tus mejores levantamientos.</div>';
  const withVid = list.filter((e) => e.rec.set.videoId || e.rms.some((r) => r.set.videoId)).length;
  html += `<div class="chips" style="margin-bottom:10px">
      <button class="chip ${onlyVid ? '' : 'on'}" data-action="hof-filter" data-v="0">Todos (${list.length})</button>
      <button class="chip ${onlyVid ? 'on' : ''}" data-action="hof-filter" data-v="1">${ic('video')} Con vídeo (${withVid})</button></div>`;
  const shown = onlyVid ? list.filter((e) => e.rec.set.videoId || e.rms.some((r) => r.set.videoId)) : list;
  if (!shown.length) html += '<div class="empty">Ningún récord tiene vídeo todavía. Desde el menú ⋯ de una serie puedes grabarlo o adjuntarlo.</div>';
  for (const e of shown) {
    const m = METRIC[e.def.mode] || METRIC.wr;
    html += `<div class="card hof">
      <div class="row"><a class="spacer title" href="#/exercise/${e.def.id}">${esc(e.def.name)}</a><span class="muted small">${e.sessions} ses.</span></div>
      <div class="row hof-main">
        <div class="spacer"><div class="hof-val">${fmtM(e.rec.v, m)}</div>
          <div class="muted small">${esc(m.label)} · ${esc(setsText(e.rec.entry, [e.rec.set]))} · <a href="#/session/${e.rec.sid}">${fmtDate(e.rec.d)}</a></div></div>
        ${vidBtn(e.rec)}
      </div>
      ${e.rms.length ? `<details class="hof-rms"><summary class="muted small">Máximos por repeticiones (${e.rms.length}) ${info('rm_real')}</summary>
        <table class="gt"><tr><th>Reps</th><th>Peso</th><th>Fecha</th><th></th></tr>
        ${e.rms.map((r) => `<tr><td>${r.n} RM</td><td><b>${fmt(r.set.w)} kg</b>${r.set.rir != null || r.set.rpe ? `<small class="muted"> ${r.set.rir != null ? 'RIR ' + fmt(r.set.rir) : '@' + fmt(r.set.rpe)}</small>` : ''}</td>
          <td><a href="#/session/${r.sid}">${shortDate(r.d)} ${r.d.slice(2, 4)}</a></td><td>${vidBtn(r)}</td></tr>`).join('')}
        </table></details>` : ''}
    </div>`;
  }
  html += `<div class="muted small">Récord de cada ejercicio según su métrica: 1RM estimado con la tabla RTS, máximo de repeticiones, tiempo o distancia. Los vídeos se ven solo en el dispositivo donde se grabaron.</div>`;
  return html;
}

async function playSetVideo(sid, ei, j) {
  const sess = sessionById(sid), ex = sess?.exercises[ei], set = ex?.sets[j];
  if (!set?.videoId) return;
  const def = exById(ex.exerciseId);
  openModal(`<div class="row"><h3 class="spacer">${esc(def?.name || '')}</h3><button class="ghost" data-action="close-modal" aria-label="Cerrar">✕</button></div>
    <div class="muted" style="margin:4px 0 10px">${esc(setsText(ex, [set]))} · ${fmtDate(sess.date)}</div>
    <div id="vid-slot" class="vid-slot"><div class="muted small">Cargando vídeo…</div></div>
    <a class="btn block" href="#/session/${sid}" style="margin-top:10px">Ir a la sesión</a>`);
  try {
    const rec = await videoGet(set.videoId);
    const slot = $('#vid-slot'); if (!slot) return;
    if (!rec) { slot.innerHTML = '<div class="mismatch">El vídeo no está en este dispositivo.</div>'; return; }
    const url = URL.createObjectURL(rec.blob); ui.modalUrls = [...(ui.modalUrls || []), url];
    slot.innerHTML = `<video src="${url}" controls playsinline autoplay muted preload="metadata"></video>`;
  } catch (err) { const slot = $('#vid-slot'); if (slot) slot.innerHTML = `<div class="mismatch">No se pudo leer el vídeo: ${esc(err.message)}</div>`; }
}

Object.assign(actions, {
  erange: (el) => { ui.erange = el.dataset.r; ui.chartSel = null; rerender(); },
  'chart-pt': (el) => {
    ui.chartSel = +el.dataset.k;
    const def = exById(ui.chartDef), p = ui.chartPts?.[ui.chartSel]; if (!def || !p) return;
    document.querySelectorAll('.pchart .pt').forEach((c, i) => c.classList.toggle('sel', i === ui.chartSel));
    $('#chart-detail').innerHTML = chartDetailHTML(def, p, ui.chartM);
  },
  noop: () => {},
  'hof-filter': (el) => { ui.hofVideo = el.dataset.v === '1'; rerender(); },
  'hof-video': (el) => playSetVideo(el.dataset.sid, +el.dataset.ei, +el.dataset.j),
});
window.viewRecords = viewRecords;
window.progressChartHTML = progressChartHTML;
if (['records', 'exercise'].includes(route().name)) rerender();
