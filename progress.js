'use strict';
/* Panel de Progreso:
 * 1) Series efectivas por músculo en los últimos 7 días y su evolución semanal (12 semanas).
 *    Serie efectiva = serie de trabajo (no calentamiento) terminada cerca del fallo: RIR ≤ umbral (4 por defecto,
 *    configurable a 3). Recuento fraccionado: músculo principal 1, secundario 0,5 (Pelland et al., 2024).
 *    Referencia orientativa 10-20 series/semana (Schoenfeld et al., 2017; Baz-Valle et al., 2022).
 * 2) Constancia: mapa de días entrenados (26 semanas), media de sesiones por semana y racha.
 * 3) Peso corporal (de las sesiones o registrado aquí) y fuerza relativa (1RM est. ÷ peso corporal).
 * 4) Resumen de ejercicios: cambio en el periodo y minigráfica. */

const hardRir = () => db.settings.hardRir ?? 4;
// 'hard' | 'easy' | 'unknown' (sin RIR ni RPE registrado)
function effortClass(set) {
  const r = rirOf(set);
  return r == null ? 'unknown' : r <= hardRir() ? 'hard' : 'easy';
}
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + n); return isoOf(d); };

// Series por músculo (fraccionadas) entre dos fechas incluidas, separadas por esfuerzo.
function muscleSetsBetween(from, to) {
  const out = { hard: {}, unknown: {}, easy: {} };
  for (const s of db.sessions) {
    if (s.date < from || s.date > to) continue;
    for (const e of s.exercises) {
      const def = exById(e.exerciseId);
      for (const x of e.sets) {
        if (!isWork(x) || (!x.reps && !x.w && !x.time && !x.dist)) continue;
        addShares(out[effortClass(x)], def, 1);
      }
    }
  }
  return out;
}

// Franja de referencia por 7 días; con microciclos de otra duración se ajusta en proporción.
const band = () => [10, 20].map((v) => Math.round(v * cycleLen() / 7));
function muscleWeekHTML() {
  const BAND = band(), len = cycleLen();
  const to = todayISO(), from = addDays(to, -(len - 1));
  const v = muscleSetsBetween(from, to);
  const max = Math.max(BAND[1] * 1.25, ...MUSCLE_KEYS.map((m) => (v.hard[m] || 0) + (v.unknown[m] || 0)));
  const pc = (n) => `${(n / max) * 100}%`;
  const unknownTotal = Object.values(v.unknown).reduce((a, b) => a + b, 0);
  const easyTotal = Object.values(v.easy).reduce((a, b) => a + b, 0);
  const sel = ui.pmuscle;
  let html = `<div class="card">
    <div class="row"><h3 class="spacer">Series efectivas por músculo ${info('hard_sets')}</h3></div>
    <div class="muted small" style="margin:2px 0 10px">Últimos ${len} días (${shortDate(from)} – ${shortDate(to)}) · RIR ≤ ${hardRir()}<br>
      <span class="lg-dot lo"></span>menos de ${BAND[0]} <span class="lg-dot ok"></span>${BAND[0]}-${BAND[1]} (franja) <span class="lg-dot hi"></span>más de ${BAND[1]}</div>
    <div class="mbars" style="--b0:${pc(BAND[0])};--b1:${pc(BAND[1])}">`;
  for (const m of MUSCLE_KEYS) {
    const h = v.hard[m] || 0, u = v.unknown[m] || 0, tot = h + u;
    const st = h >= BAND[1] + 0.01 ? 'hi' : h >= BAND[0] ? 'ok' : 'lo';
    html += `<button class="mbar ${sel === m ? 'on' : ''}" data-action="pmuscle" data-m="${m}" aria-label="${MUSCLES[m]}: ${fmt(h, 1)} series efectivas">
      <span class="mb-l">${MUSCLES[m]}</span>
      <span class="mb-t"><span class="mb-band"></span><span class="mb-h ${st}" style="width:${pc(h)}"></span><span class="mb-u" style="left:${pc(h)};width:${pc(u)}"></span></span>
      <span class="mb-v">${tot ? fmt(h, 1) : '0'}${u ? `<small>+${fmt(u, 1)}</small>` : ''}</span></button>`;
  }
  html += `</div>`;
  if (unknownTotal || easyTotal) html += `<div class="muted small" style="margin-top:8px">
      ${unknownTotal ? `<span class="mb-key"></span> ${fmt(unknownTotal, 1)} series sin RIR registrado (se muestran aparte, no suman). ` : ''}
      ${easyTotal ? `${fmt(easyTotal, 1)} series con RIR > ${hardRir()} no cuentan como efectivas.` : ''}</div>`;
  if (sel) html += muscleTrendHTML(sel);
  else html += `<div class="muted small" style="margin-top:8px">Toca un músculo para ver sus últimas 12 ${cycleWord(true)}.</div>`;
  return html + '</div>';
}

// Columnas semanales (lunes a domingo) de un músculo, 12 semanas.
function muscleTrendHTML(m) {
  const BAND = band(), weeks = lastWeeks(12);
  const vals = weeks.map((w) => { const r = muscleSetsBetween(w, weekEnd(w)); return { w, h: r.hard[m] || 0, u: r.unknown[m] || 0 }; });
  const W = 340, H = 150, L = 26, B = 20, T = 8, R = 4;
  const max = Math.max(BAND[1] + 4, ...vals.map((x) => x.h + x.u));
  const ticks = niceTicks(0, max, 3), top = ticks[ticks.length - 1];
  const y = (v) => T + (1 - v / top) * (H - T - B), bw = (W - L - R) / vals.length;
  const done = vals.slice(0, -1).filter((x) => x.h + x.u > 0);
  const avg = done.length ? done.slice(-4).reduce((a, x) => a + x.h, 0) / Math.min(4, done.length) : 0;
  return `<div class="ptrend"><div class="row" style="margin-top:12px"><b class="spacer">${MUSCLES[m]} · por ${cycleWord()}</b>
      <button class="ghost small-btn" data-action="pmuscle" data-m="${m}" aria-label="Cerrar">✕</button></div>
    <svg class="chart wchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Series efectivas semanales de ${MUSCLES[m]}">
      <rect class="band" x="${L}" width="${W - L - R}" y="${y(BAND[1])}" height="${y(BAND[0]) - y(BAND[1])}"/>
      ${ticks.map((v) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 4}" y="${y(v) + 3}" text-anchor="end">${v}</text>`).join('')}
      ${vals.map((x, i) => {
        const cx = L + i * bw + bw * 0.15, wd = bw * 0.7, cur = i === vals.length - 1;
        return `<rect class="col ${cur ? 'cur' : ''}" x="${cx}" width="${wd}" y="${y(x.h)}" height="${y(0) - y(x.h)}" rx="2"/>
          ${x.u ? `<rect class="col-u" x="${cx}" width="${wd}" y="${y(x.h + x.u)}" height="${y(x.h) - y(x.h + x.u)}" rx="2"/>` : ''}`;
      }).join('')}
      <text x="${L}" y="${H - 4}">${wkLabel(vals[0].w)}</text><text x="${W - R}" y="${H - 4}" text-anchor="end">${isCustomCycle() ? 'ciclo actual' : 'esta semana'}</text>
    </svg>
    <div class="muted small">Media de ${isCustomCycle() ? 'los últimos 4 ciclos completos' : 'las últimas 4 semanas completas'}: <b>${fmt(avg, 1)}</b> series efectivas. ${isCustomCycle() ? 'El ciclo en curso aparece más claro porque aún no ha terminado.' : 'La semana en curso aparece más clara porque aún no ha terminado.'}</div></div>`;
}

/* ---------- Constancia ---------- */
function consistencyHTML() {
  if (!db.sessions.length) return '';
  const days = new Set(db.sessions.map((s) => s.date));
  const len = cycleLen(), NW = Math.ceil(182 / len), start = isoFromNum(dayNum(weekStart(todayISO())) - len * (NW - 1)), today = todayISO();
  const C = 11, G = 2, L = 14;
  let cells = '';
  for (let w = 0; w < NW; w++) for (let d = 0; d < len; d++) {
    const iso = addDays(start, w * len + d); if (iso > today) continue;
    cells += `<rect x="${L + w * (C + G)}" y="${d * (C + G)}" width="${C}" height="${C}" rx="2" class="${days.has(iso) ? 'on' : ''}"><title>${iso}</title></rect>`;
  }
  const weeks = lastWeeks(NW).map((w) => db.sessions.filter((s) => weekStart(s.date) === w).length);
  const closed = weeks.slice(0, -1), last4 = closed.slice(-4), last12 = closed.slice(-12);
  let streak = 0; for (let i = weeks.length - 1; i >= 0; i--) { if (weeks[i]) streak++; else if (i === weeks.length - 1) continue; else break; }
  const W = L + NW * (C + G), H = len * (C + G);
  const rowLab = isCustomCycle() ? [[0, 'D1']] : [0, 2, 4].map((i) => [i, DOW1[(cycleDow() + i) % 7]]);
  return `<div class="card"><h3>Constancia ${info('consistency')}</h3>
    <div class="stats stats3" style="margin:8px 0">
      <div class="stat"><b>${fmt(last4.reduce((a, b) => a + b, 0) / Math.max(1, last4.length), 1)}</b><span>sesiones/${cycleWord()}<br>últimos 4</span></div>
      <div class="stat"><b>${fmt(last12.reduce((a, b) => a + b, 0) / Math.max(1, last12.length), 1)}</b><span>sesiones/${cycleWord()}<br>últimos 12</span></div>
      <div class="stat"><b>${streak}</b><span>${streak === 1 ? cycleWord() : cycleWord(true)} seguid${isCustomCycle() ? 'o' : 'a'}${streak === 1 ? '' : 's'}<br>entrenando</span></div>
    </div>
    <svg class="heat" viewBox="0 0 ${W} ${H}" role="img" aria-label="Días entrenados en los últimos 6 meses">
      ${rowLab.map(([i, t]) => `<text x="0" y="${i * (C + G) + 9}">${t}</text>`).join('')}${cells}</svg>
    <div class="muted small" style="margin-top:4px">Últimos 6 meses · cada columna es ${isCustomCycle() ? `un ciclo de ${len} días` : 'una semana'} y cada cuadro un día; en color, los días con sesión.</div></div>`;
}

/* ---------- Peso corporal y fuerza relativa ---------- */
// Registros de peso corporal: los de las sesiones y los anotados en Progreso (db.bodyweights).
function bodyweightLog() {
  const map = {};
  for (const s of db.sessions) if (s.bodyweight) map[s.date] = s.bodyweight;
  for (const r of db.bodyweights || []) map[r.d] = r.v;
  return Object.entries(map).map(([d, v]) => ({ d, v })).sort((a, b) => a.d.localeCompare(b.d));
}
// Peso corporal más cercano a una fecha (±30 días); null si no hay.
function bodyweightAt(iso, log = bodyweightLog()) {
  let best = null, bd = Infinity;
  for (const r of log) { const dd = Math.abs(isoMs(r.d) - isoMs(iso)) / dayMs; if (dd < bd) { bd = dd; best = r; } }
  return best && bd <= 30 ? best.v : null;
}
function lineChartHTML(pts, { label, dec = 1, unit = '' }) {
  const W = 340, H = 150, L = 34, R = 10, T = 10, B = 22;
  const t0 = isoMs(pts[0].d), t1 = isoMs(pts[pts.length - 1].d), tspan = t1 - t0 || 1;
  const vs = pts.map((p) => p.v), ticks = niceTicks(Math.min(...vs), Math.max(...vs), 3, dec === 0 ? 1 : 0);
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const x = (p) => L + ((isoMs(p.d) - t0) / tspan) * (W - L - R), y = (v) => T + (1 - (v - y0) / (y1 - y0 || 1)) * (H - T - B);
  const yr = tspan > 300 * dayMs;
  return `<svg class="chart pchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
    ${ticks.map((v) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 4}" y="${y(v) + 3}" text-anchor="end">${fmt(v, dec)}</text>`).join('')}
    <text x="${L}" y="${H - 4}">${shortDate(pts[0].d, yr)}</text><text x="${W - R}" y="${H - 4}" text-anchor="end">${shortDate(pts[pts.length - 1].d, yr)}</text>
    <path class="ln" d="${pts.map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)},${y(p.v).toFixed(1)}`).join('')}"/>
    ${pts.length <= 30 ? pts.map((p) => `<circle class="pt" cx="${x(p).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3"><title>${p.d}: ${fmt(p.v, dec)}${unit}</title></circle>`).join('') : ''}
  </svg>`;
}
function bodyweightHTML() {
  const log = bodyweightLog();
  const last = log[log.length - 1];
  let html = `<div class="card"><div class="row"><h3 class="spacer">Peso corporal ${info('relative')}</h3>
      <button class="small-btn" data-action="bw-add">＋ Anotar</button></div>`;
  if (!log.length) return html + `<div class="muted small" style="margin-top:6px">Anota tu peso de vez en cuando para ver su evolución y tu fuerza relativa (1RM ÷ peso corporal) en cada ejercicio.</div></div>`;
  const first = log.find((r) => isoMs(r.d) >= isoMs(last.d) - 91 * dayMs) || log[0];
  html += `<div class="muted small" style="margin:4px 0 6px">Último: <b>${fmt(last.v)} kg</b> (${shortDate(last.d)})${first !== last ? ` · ${last.v - first.v >= 0 ? '+' : ''}${fmt(last.v - first.v)} kg desde el ${shortDate(first.d)}` : ''}</div>`;
  if (log.length >= 2) html += lineChartHTML(log, { label: 'Evolución del peso corporal', unit: ' kg' });
  return html + '</div>';
}

/* ---------- Resumen de ejercicios ---------- */
// Cambio en el periodo: media de las 3 primeras sesiones frente a la media de las 3 últimas (con menos de 6, primera frente a última).
function exerciseTrend(def, range = ui.erange || '1y') {
  const pts = bestSetsByDate(def, historyFor(def.id)); if (pts.length < 2) return null;
  const days = RANGES[range][1], last = isoMs(pts[pts.length - 1].d);
  const sel = days ? pts.filter((p) => isoMs(p.d) >= Date.now() - days * dayMs) : pts;
  if (sel.length < 2) return null;
  const k = sel.length >= 6 ? 3 : 1, avg = (a) => a.reduce((s, p) => s + p.v, 0) / a.length;
  const a = avg(sel.slice(0, k)), b = avg(sel.slice(-k));
  return { pts: sel, change: (b / a - 1) * 100, last };
}
function sparkHTML(pts) {
  const W = 72, H = 24, vs = pts.map((p) => p.v), mn = Math.min(...vs), mx = Math.max(...vs), sp = mx - mn || 1;
  const t0 = isoMs(pts[0].d), ts = isoMs(pts[pts.length - 1].d) - t0 || 1;
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${(((isoMs(p.d) - t0) / ts) * (W - 4) + 2).toFixed(1)},${(H - 3 - ((p.v - mn) / sp) * (H - 6)).toFixed(1)}`).join('');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${d}"/></svg>`;
}
function exerciseRowExtra(e) {
  const t = exerciseTrend(e); if (!t) return '';
  const c = t.change, cls = c > 0.5 ? 'up' : c < -0.5 ? 'down' : '';
  return `${sparkHTML(t.pts)}<b class="chg ${cls}">${c > 0 ? '+' : ''}${fmt(c, 1)}%</b>`;
}
function progressTopHTML() {
  return muscleWeekHTML() + consistencyHTML() + bodyweightHTML();
}
function exercisesHeaderHTML() {
  const r = ui.erange || '1y';
  return `<div class="row wrap" style="margin:18px 0 8px;gap:8px"><h2 class="spacer" style="margin:0">Ejercicios ${info('ex_change')}</h2>
    <div class="seg small-seg">${Object.entries(RANGES).map(([k, [l]]) => `<button class="${k === r ? 'on' : ''}" data-action="erange" data-r="${k}">${l}</button>`).join('')}</div></div>`;
}

/* ---------- Con el mismo peso ---------- */
// Capacidad con un peso concreto en cada sesión: repeticiones + RIR (sin RIR, las repeticiones hechas).
function sameWeightData(def, hist) {
  const bySes = [];
  for (const h of [...hist].reverse()) {
    const m = {};
    for (const x of h.entry.sets) {
      if (!isWork(x) || !x.reps) continue;
      const w = def.mode === 'bw' ? x.w || 0 : x.w; if (w == null || (def.mode === 'wr' && !w)) continue;
      const r = rirOf(x), cap = x.reps + (r ?? 0);
      if (!m[w] || cap > m[w].v) m[w] = { d: h.sess.date, sid: h.sess.id, v: cap, reps: x.reps, rir: r };
    }
    bySes.push(m);
  }
  const count = {};
  for (const m of bySes) for (const w of Object.keys(m)) count[w] = (count[w] || 0) + 1;
  return { bySes, count };
}
function sameWeightHTML(def, hist) {
  if (!['wr', 'bw'].includes(def.mode)) return '';
  const { bySes, count } = sameWeightData(def, hist);
  const cands = Object.keys(count).filter((w) => count[w] >= 2).sort((a, b) => count[b] - count[a] || b - a).slice(0, 6);
  if (!cands.length) return '';
  ui.sameW = ui.sameW || {};
  let W = ui.sameW[def.id];
  if (!cands.includes(String(W))) W = cands[0];
  const pts = bySes.map((m) => m[W]).filter(Boolean);
  const wl = (w) => def.mode === 'bw' ? (+w ? `+${fmt(+w)} kg` : 'Sin lastre') : `${fmt(+w)} kg`;
  const first = pts[0], last = pts[pts.length - 1], dif = last.v - first.v;
  const capTxt = (p) => `${p.reps}${p.rir != null ? ` @RIR ${fmt(p.rir)}` : ''} → <b>${fmt(p.v)}</b>`;
  return `<h2>Con el mismo peso ${info('same_weight')}</h2><div class="card">
    <div class="chips" style="margin-bottom:6px">${[...cands].sort((a, b) => a - b).map((w) => `<button class="chip ${w === String(W) ? 'on' : ''}" data-action="same-w" data-id="${def.id}" data-w="${w}">${wl(w)} <small class="cnt">${count[w]}</small></button>`).join('')}</div>
    <div class="muted small">Repeticiones posibles con <b>${wl(W)}</b> (reps + RIR): ${shortDate(first.d)} ${capTxt(first)} · ${shortDate(last.d)} ${capTxt(last)}
      <b class="${dif > 0 ? 'up' : dif < 0 ? 'down' : ''}">(${dif > 0 ? '+' : ''}${fmt(dif)} reps)</b></div>
    ${lineChartHTML(pts, { label: `Repeticiones posibles con ${wl(W)}`, dec: 0, unit: ' reps' })}
    <div class="muted small">Se muestran los pesos que has usado en al menos 2 sesiones; el número pequeño indica en cuántas.</div></div>`;
}

Object.assign(actions, {
  pmuscle: (el) => { ui.pmuscle = ui.pmuscle === el.dataset.m ? null : el.dataset.m; rerender(); },
  'bw-add': () => {
    const last = bodyweightLog().pop();
    const v = num(prompt('Peso corporal de hoy (kg):', last ? decIn(last.v) : ''));
    if (v == null) return;
    if (v < 25 || v > 300) return alert('Revisa el valor: debe estar entre 25 y 300 kg.');
    db.bodyweights = (db.bodyweights || []).filter((r) => r.d !== todayISO()).concat({ d: todayISO(), v });
    save(); rerender(); toast(`Peso anotado: ${fmt(v)} kg`);
  },
  'same-w': (el) => { ui.sameW = ui.sameW || {}; ui.sameW[el.dataset.id] = el.dataset.w; rerender(); },
  'chart-rel': () => { ui.chartRel = !ui.chartRel; ui.chartSel = null; rerender(); },
});
Object.assign(window, { sameWeightHTML, progressTopHTML, exerciseRowExtra, exercisesHeaderHTML, bodyweightAt, bodyweightLog });
if (['exercises', 'exercise'].includes(route().name)) rerender();
