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

/* Referencias de volumen por músculo (series/semana), aproximadas a la tabla de Mike Israetel (Renaissance Periodization):
 * MV mantenimiento · MEV mínimo efectivo · MAV rango adaptativo (mín.-máx.) · MRV máximo recuperable.
 * Son orientativas (distintas ediciones publican cifras algo distintas) y se pueden editar por atleta en Ajustes › Avanzado.
 * «Hombros» usa las cifras de deltoides lateral/posterior: el anterior ya trabaja en los empujes. */
const LANDMARKS = {
  pectoral: [4, 6, 12, 20, 22], espalda: [6, 10, 14, 22, 25], hombros: [0, 8, 16, 22, 26], biceps: [4, 8, 14, 20, 26],
  triceps: [4, 6, 10, 14, 18], abdomen: [0, 0, 16, 20, 25], gluteos: [0, 0, 4, 12, 16], cuadriceps: [6, 8, 12, 18, 20],
  femoral: [3, 4, 10, 16, 20], gemelos: [6, 8, 12, 16, 20],
};
const LM_KEYS = ['MV', 'MEV', 'MAV mín.', 'MAV máx.', 'MRV'];
// Referencias del atleta, escaladas a la duración de su semana o microciclo.
function landmarksOf(m, scaled = true) {
  const v = db.settings.landmarks?.[m] || LANDMARKS[m], k = scaled ? cycleLen() / 7 : 1;
  const [mv, mev, lo, hi, mrv] = v.map((x) => Math.round(x * k * 10) / 10);
  return { mv, mev, lo, hi, mrv };
}
// Zona del volumen respecto a las referencias.
const ZONES_VOL = {
  under: ['Por debajo del mantenimiento', 'under'], maint: ['Mantenimiento (MV-MEV)', 'maint'], low: ['Crecimiento mínimo (MEV-MAV)', 'low'],
  opt: ['Rango adaptativo (MAV)', 'opt'], high: ['Alto (MAV-MRV)', 'high'], over: ['Por encima del MRV', 'over'],
};
function volZone(v, L) {
  if (v > L.mrv) return 'over';
  if (v > L.hi) return 'high';
  if (v >= L.lo) return 'opt';
  if (v >= L.mev && L.mev > 0) return 'low';
  if (v >= L.mv) return v === 0 && L.mev === 0 && L.lo > 0 ? 'maint' : L.mev > 0 ? 'maint' : 'low';
  return 'under';
}
function muscleWeekHTML() {
  const len = cycleLen();
  const to = todayISO(), from = addDays(to, -(len - 1));
  const v = muscleSetsBetween(from, to);
  const max = Math.max(...MUSCLE_KEYS.map((m) => landmarksOf(m).mrv * 1.1), ...MUSCLE_KEYS.map((m) => (v.hard[m] || 0) + (v.unknown[m] || 0)));
  const pc = (n) => `${(n / max) * 100}%`;
  const unknownTotal = Object.values(v.unknown).reduce((a, b) => a + b, 0);
  const easyTotal = Object.values(v.easy).reduce((a, b) => a + b, 0);
  const sel = ui.pmuscle;
  let html = `<div class="card">
    <div class="row"><h3 class="spacer">Series efectivas por músculo ${info('hard_sets')}</h3></div>
    <div class="muted small" style="margin:2px 0 6px">Últimos ${len} días (${shortDate(from)} – ${shortDate(to)}) · RIR ≤ ${hardRir()} · referencias de Israetel ${info('landmarks')}</div>
    <div class="vz-legend small">${Object.values(ZONES_VOL).filter(([, c]) => c !== 'under').map(([l, c]) => `<span><i class="vz ${c}"></i>${l}</span>`).join('')}</div>
    <div class="mbars">`;
  for (const m of MUSCLE_KEYS) {
    const h = v.hard[m] || 0, u = v.unknown[m] || 0, tot = h + u, L = landmarksOf(m), z = volZone(h, L);
    html += `<button class="mbar ${sel === m ? 'on' : ''}" data-action="pmuscle" data-m="${m}" aria-label="${MUSCLES[m]}: ${fmt(h, 1)} series efectivas, ${ZONES_VOL[z][0]}">
      <span class="mb-l">${MUSCLES[m]}</span>
      <span class="mb-t"><span class="mb-seg low" style="left:${pc(L.mev)};width:${pc(L.lo - L.mev)}"></span><span class="mb-seg opt" style="left:${pc(L.lo)};width:${pc(L.hi - L.lo)}"></span><span class="mb-seg high" style="left:${pc(L.hi)};width:${pc(L.mrv - L.hi)}"></span><span class="mb-mrv" style="left:${pc(L.mrv)}"></span>
        <span class="mb-h z-${z}" style="width:${pc(h)}"></span><span class="mb-u" style="left:${pc(h)};width:${pc(u)}"></span></span>
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
  const L = landmarksOf(m), weeks = lastWeeks(12);
  const vals = weeks.map((w) => { const r = muscleSetsBetween(w, weekEnd(w)); return { w, h: r.hard[m] || 0, u: r.unknown[m] || 0 }; });
  const W = 340, H = 150, X = 26, B = 20, T = 8, R = 4;
  const max = Math.max(L.mrv + 2, ...vals.map((x) => x.h + x.u));
  const ticks = niceTicks(0, max, 3), top = ticks[ticks.length - 1];
  const y = (v) => T + (1 - v / top) * (H - T - B), bw = (W - X - R) / vals.length;
  const done = vals.slice(0, -1).filter((x) => x.h + x.u > 0);
  const avg = done.length ? done.slice(-4).reduce((a, x) => a + x.h, 0) / Math.min(4, done.length) : 0;
  return `<div class="ptrend"><div class="row" style="margin-top:12px"><b class="spacer">${MUSCLES[m]} · por ${cycleWord()}</b>
      <button class="ghost small-btn" data-action="pmuscle" data-m="${m}" aria-label="Cerrar">✕</button></div>
    <svg class="chart wchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Series efectivas semanales de ${MUSCLES[m]}">
      <rect class="band" x="${X}" width="${W - X - R}" y="${y(L.hi)}" height="${y(L.lo) - y(L.hi)}"/>
      ${ticks.map((v) => `<line class="grid" x1="${X}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${X - 4}" y="${y(v) + 3}" text-anchor="end">${v}</text>`).join('')}
      ${L.mev ? `<line class="lm mev" x1="${X}" x2="${W - R}" y1="${y(L.mev)}" y2="${y(L.mev)}"/>` : ''}<line class="lm mrv" x1="${X}" x2="${W - R}" y1="${y(L.mrv)}" y2="${y(L.mrv)}"/>
      <text class="lmt" x="${W - R - 2}" y="${y(L.mrv) - 3}" text-anchor="end">MRV ${fmt(L.mrv)}</text>${L.mev ? `<text class="lmt" x="${W - R - 2}" y="${y(L.mev) - 3}" text-anchor="end">MEV ${fmt(L.mev)}</text>` : ''}
      ${vals.map((x, i) => {
        const cx = X + i * bw + bw * 0.15, wd = bw * 0.7, cur = i === vals.length - 1;
        return `<rect class="col ${cur ? 'cur' : ''}" x="${cx}" width="${wd}" y="${y(x.h)}" height="${y(0) - y(x.h)}" rx="2"/>
          ${x.u ? `<rect class="col-u" x="${cx}" width="${wd}" y="${y(x.h + x.u)}" height="${y(x.h) - y(x.h + x.u)}" rx="2"/>` : ''}`;
      }).join('')}
      <text x="${X}" y="${H - 4}">${wkLabel(vals[0].w)}</text><text x="${W - R}" y="${H - 4}" text-anchor="end">${isCustomCycle() ? 'ciclo actual' : 'esta semana'}</text>
    </svg>
    <div class="muted small">Referencias: MV ${fmt(L.mv)} · MEV ${fmt(L.mev)} · MAV ${fmt(L.lo)}-${fmt(L.hi)} · MRV ${fmt(L.mrv)} series/${cycleWord()}.<br>Media de ${isCustomCycle() ? 'los últimos 4 ciclos completos' : 'las últimas 4 semanas completas'}: <b>${fmt(avg, 1)}</b> series efectivas (${ZONES_VOL[volZone(avg, L)][0].toLowerCase()}). ${isCustomCycle() ? 'El ciclo en curso aparece más claro porque aún no ha terminado.' : 'La semana en curso aparece más clara porque aún no ha terminado.'}</div></div>`;
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
  return muscleWeekHTML() + consistencyHTML() + bodyweightHTML() + (window.activityHTML ? activityHTML() : '');
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

/* ---------- Editor de referencias (Ajustes › Avanzado) ---------- */
function landmarksSettingsHTML() {
  const custom = !!db.settings.landmarks && Object.keys(db.settings.landmarks).length;
  return `<details class="card lm-edit" ${ui.lmOpen ? 'open' : ''}><summary><b>Volumen por músculo (referencias de Israetel)</b> ${info('landmarks')}
      <div class="muted small">${custom ? 'Personalizadas para este atleta' : 'Valores aproximados por defecto'} · series efectivas por semana de 7 días</div></summary>
    <div class="gt-wrap"><table class="gt lm-table"><tr><th>Músculo</th>${LM_KEYS.map((k) => `<th>${k}</th>`).join('')}</tr>
    ${MUSCLE_KEYS.map((m) => { const v = db.settings.landmarks?.[m] || LANDMARKS[m]; return `<tr><td>${MUSCLES[m]}</td>${v.map((x, i) => `<td><input type="text" inputmode="numeric" data-lm="${m}:${i}" value="${x}" aria-label="${MUSCLES[m]} ${LM_KEYS[i]}"></td>`).join('')}</tr>`; }).join('')}
    </table></div>
    <div class="muted small" style="margin:6px 0 8px">Deben ir de menor a mayor (MV ≤ MEV ≤ MAV mín. ≤ MAV máx. ≤ MRV). Con microciclos de otra duración se escalan en proporción.</div>
    ${custom ? '<button class="block ghost" data-action="lm-reset">Restablecer valores por defecto</button>' : ''}
  </details>`;
}
document.addEventListener('change', (e) => {
  const t = e.target; if (!t.dataset?.lm) return;
  const [m, i] = t.dataset.lm.split(':'), v = num(t.value);
  const cur = [...(db.settings.landmarks?.[m] || LANDMARKS[m])];
  if (v == null || v < 0 || v > 60) { t.classList.add('bad'); toast('Escribe un número de series entre 0 y 60'); return; }
  cur[+i] = v;
  const ordered = cur.every((x, k) => !k || x >= cur[k - 1]);
  t.classList.toggle('bad', !ordered);
  if (!ordered) { toast('Las referencias deben ir de menor a mayor: MV ≤ MEV ≤ MAV ≤ MRV'); return; }
  db.settings.landmarks = { ...(db.settings.landmarks || {}), [m]: cur };
  if (cur.every((x, k) => x === LANDMARKS[m][k])) delete db.settings.landmarks[m];
  save();
});
document.addEventListener('toggle', (e) => { if (e.target.classList?.contains('lm-edit')) ui.lmOpen = e.target.open; }, true);

Object.assign(actions, {
  'lm-reset': () => { if (!confirm('¿Volver a las referencias por defecto para este atleta?')) return; delete db.settings.landmarks; save(); rerender(); },
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
Object.assign(window, { landmarksSettingsHTML, sameWeightHTML, progressTopHTML, exerciseRowExtra, exercisesHeaderHTML, bodyweightAt, bodyweightLog });
if (['exercises', 'exercise'].includes(route().name)) rerender();
