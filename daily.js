'use strict';
/* Datos diarios opcionales: pasos, calorías consumidas y peso corporal, por día (no por sesión).
 * - Se anotan en el día del calendario (db.daily[fecha] = { steps, kcal }; el peso va a db.bodyweights).
 * - Progreso: medias por semana/ciclo y mantenimiento calórico estimado (balance energético con la tendencia del peso).
 * - Análisis de factores: pasos y calorías del día anterior frente al rendimiento.
 * - Informe: pasos y calorías medios del periodo. */

const dailyOf = (iso) => db.daily?.[iso] || null;
const DAILY = {
  steps: { label: 'Pasos', unit: 'pasos', min: 0, max: 100000, int: true, ph: 'p. ej. 8500' },
  kcal: { label: 'Calorías', unit: 'kcal', min: 300, max: 10000, int: true, ph: 'p. ej. 2400' },
  bw: { label: 'Peso (kg)', unit: 'kg', min: 25, max: 300, int: false, ph: 'p. ej. 78,5' },
};
const bwOn = (iso) => (db.bodyweights || []).find((r) => r.d === iso)?.v ?? db.sessions.find((s) => s.date === iso && s.bodyweight)?.bodyweight ?? null;
function dailyValue(iso, k) { return k === 'bw' ? bwOn(iso) : dailyOf(iso)?.[k] ?? null; }
function setDaily(iso, k, v) {
  if (k === 'bw') {
    db.bodyweights = (db.bodyweights || []).filter((r) => r.d !== iso);
    if (v != null) db.bodyweights.push({ d: iso, v });
    return;
  }
  db.daily = db.daily || {};
  const d = { ...(db.daily[iso] || {}) };
  if (v == null) delete d[k]; else d[k] = v;
  if (Object.keys(d).length) db.daily[iso] = d; else delete db.daily[iso];
}
// En pasos y calorías el punto es separador de miles («8.500» = 8500); en el peso, decimal.
const parseDaily = (raw, f) => num(f.int ? raw.replace(/\./g, '') : raw);
const fmtInt = (v) => v == null ? '–' : Math.round(v).toLocaleString('es-ES');

// Tarjeta del día en el calendario (plegable; se abre sola si el día ya tiene datos).
function dailyCardHTML(iso) {
  const vals = Object.fromEntries(Object.keys(DAILY).map((k) => [k, dailyValue(iso, k)]));
  const filled = Object.entries(vals).filter(([, v]) => v != null);
  const sum = filled.map(([k, v]) => k === 'bw' ? `${fmt(v)} kg` : `${fmtInt(v)} ${DAILY[k].unit}`).join(' · ');
  return `<details class="card daily" ${ui.dailyOpen ? 'open' : ''}>
    <summary><b>Datos del día</b> <span class="muted small">${sum || 'opcional: pasos, calorías, peso'}</span> ${info('daily')}</summary>
    <div class="grid3" style="margin-top:10px">
      ${Object.entries(DAILY).map(([k, f]) => `<div><label>${f.label}</label><input type="text" inputmode="${f.int ? 'numeric' : 'decimal'}" autocomplete="off"
        data-daily="${iso}:${k}" value="${vals[k] == null ? '' : f.int ? vals[k] : decIn(vals[k])}" placeholder="${f.ph}"></div>`).join('')}
    </div>
    <div class="muted small" style="margin-top:6px">Se usan en Progreso, en el análisis de factores y en el informe. Puedes rellenar solo lo que quieras.</div>
  </details>`;
}

/* ---------- Análisis ---------- */
// Medias por semana/ciclo de los días con dato (no cuenta los días vacíos como 0).
function dailyWeekly(n = 12) {
  return lastWeeks(n).map((w) => {
    const out = { w, steps: [], kcal: [] };
    for (let i = 0; i < cycleLen(); i++) {
      const d = dailyOf(isoFromNum(dayNum(w) + i));
      if (d?.steps != null) out.steps.push(d.steps);
      if (d?.kcal != null) out.kcal.push(d.kcal);
    }
    return out;
  });
}
// Mantenimiento estimado: kcal medias + déficit/superávit deducido de la tendencia del peso (regresión lineal).
// 1 kg de cambio de peso ≈ 7700 kcal (aproximación clásica; en realidad varía según la composición del cambio).
function tdeeEstimate(days = 28) {
  const to = todayISO(), from = isoFromNum(dayNum(to) - days + 1);
  const kc = []; for (let i = 0; i < days; i++) { const v = dailyOf(isoFromNum(dayNum(from) + i))?.kcal; if (v != null) kc.push(v); }
  const bw = bodyweightLog().filter((r) => r.d >= from && r.d <= to);
  if (kc.length < 14 || bw.length < 3 || dayNum(bw[bw.length - 1].d) - dayNum(bw[0].d) < 14) return { ok: false, kc: kc.length, bw: bw.length };
  const xs = bw.map((r) => dayNum(r.d)), ys = bw.map((r) => r.v), mx = mean(xs), my = mean(ys);
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0); // kg/día
  const kcal = mean(kc), balance = slope * 7700;
  return { ok: true, kcal, balance, tdee: kcal - balance, perWeek: slope * 7, kc: kc.length, bw: bw.length, days };
}
function colsHTML(vals, { label, dec = 0 }) {
  const W = 340, H = 120, L = 34, B = 18, T = 8, R = 4;
  const vs = vals.map((x) => x.v ?? 0), max = Math.max(...vs, 1);
  const ticks = niceTicks(0, max, 3), top = ticks[ticks.length - 1];
  const y = (v) => T + (1 - v / top) * (H - T - B), bw = (W - L - R) / vals.length;
  const tl = (v) => v >= 1000 ? `${fmt(v / 1000, v % 1000 ? 1 : 0)}k` : fmt(v, dec);
  return `<svg class="chart wchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
    ${ticks.map((v) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 4}" y="${y(v) + 3}" text-anchor="end">${tl(v)}</text>`).join('')}
    ${vals.map((x, i) => x.v == null ? '' : `<rect class="col ${i === vals.length - 1 ? 'cur' : ''}" x="${L + i * bw + bw * 0.15}" width="${bw * 0.7}" y="${y(x.v)}" height="${y(0) - y(x.v)}" rx="2"><title>${x.w}: ${fmt(x.v, dec)} (${x.n} días)</title></rect>`).join('')}
    <text x="${L}" y="${H - 3}">${wkLabel(vals[0].w)}</text><text x="${W - R}" y="${H - 3}" text-anchor="end">${isCustomCycle() ? 'ciclo actual' : 'esta semana'}</text>
  </svg>`;
}
function activityHTML() {
  const any = Object.keys(db.daily || {}).length;
  if (!any) return ''; // sin datos no se muestra: se anotan en «Datos del día» del calendario
  const wk = dailyWeekly(12);
  const avg = (a) => a.length ? mean(a) : null;
  const last = wk[wk.length - 1], prev = wk[wk.length - 2];
  const stepsPts = wk.map((x) => ({ w: x.w, v: avg(x.steps), n: x.steps.length }));
  const kcalPts = wk.map((x) => ({ w: x.w, v: avg(x.kcal), n: x.kcal.length }));
  const t = tdeeEstimate();
  const cur = isCustomCycle() ? 'este ciclo' : 'esta semana', before = isCustomCycle() ? 'ciclo anterior' : 'semana anterior';
  let html = `<div class="card"><h3>Actividad y nutrición ${info('daily')}</h3>
    <div class="stats stats3" style="margin:8px 0">
      <div class="stat"><b>${fmtInt(avg(last.steps))}</b><span>pasos/día<br>${cur}</span></div>
      <div class="stat"><b>${fmtInt(avg(prev.steps))}</b><span>pasos/día<br>${before}</span></div>
      <div class="stat"><b>${fmtInt(avg(last.kcal))}</b><span>kcal/día<br>${cur}</span></div>
    </div>`;
  if (stepsPts.some((p) => p.v != null)) html += `<div class="muted small" style="margin-top:6px"><b>Pasos al día</b> (media de los días anotados)</div>${colsHTML(stepsPts, { label: 'Pasos medios por semana' })}`;
  if (kcalPts.some((p) => p.v != null)) html += `<div class="muted small" style="margin-top:6px"><b>Calorías al día</b> (media de los días anotados)</div>${colsHTML(kcalPts, { label: 'Calorías medias por semana' })}`;
  html += `<div class="tdee"><b>Mantenimiento estimado ${info('tdee')}</b><br>`;
  html += t.ok
    ? `<span class="tdee-v">≈ ${fmtInt(Math.round(t.tdee / 10) * 10)} kcal/día</span>
       <div class="muted small">Últimos ${t.days} días: comes ${fmtInt(t.kcal)} kcal/día de media y tu peso ${t.perWeek > 0.05 ? 'sube' : t.perWeek < -0.05 ? 'baja' : 'se mantiene'}
       (${t.perWeek >= 0 ? '+' : ''}${fmt(t.perWeek, 2)} kg/semana) → ${t.balance < 0 ? 'déficit' : 'superávit'} de unas ${fmtInt(Math.abs(t.balance))} kcal/día.</div>`
    : `<div class="muted small">Hace falta, en los últimos 28 días, anotar las calorías al menos 14 días (llevas ${t.kc}) y el peso al menos 3 veces repartidas en 2 semanas o más (llevas ${t.bw}).</div>`;
  return html + '</div></div>';
}

Object.assign(window, { dailyCardHTML, activityHTML, dailyOf, dailyValue });

// Entrada de datos: se guarda al escribir; al salir del campo se valida y se normaliza.
document.addEventListener('input', (e) => {
  const t = e.target; if (!t.dataset?.daily) return;
  const [iso, k] = t.dataset.daily.split(':'), f = DAILY[k], v = parseDaily(t.value, f);
  if (t.value.trim() === '') { setDaily(iso, k, null); save(); return; }
  if (v != null && v >= f.min && v <= f.max) { setDaily(iso, k, f.int ? Math.round(v) : v); save(); }
});
document.addEventListener('change', (e) => {
  const t = e.target; if (!t.dataset?.daily) return;
  const [iso, k] = t.dataset.daily.split(':'), f = DAILY[k], raw = t.value.trim(), v = parseDaily(raw, f);
  const bad = raw !== '' && (!(f.int ? /^[\d.]+$/ : /^\d*([.,]\d*)?$/).test(raw) || v == null || v < f.min || v > f.max);
  t.classList.toggle('bad', bad);
  if (bad) { toast(`${f.label}: entre ${fmtInt(f.min)} y ${fmtInt(f.max)}`); return; }
  if (raw !== '') t.value = f.int ? String(Math.round(v)) : decIn(v);
  const sum = t.closest('details')?.querySelector('summary .muted');
  if (sum) sum.textContent = Object.keys(DAILY).map((x) => [x, dailyValue(iso, x)]).filter(([, x]) => x != null)
    .map(([x, val]) => x === 'bw' ? `${fmt(val)} kg` : `${fmtInt(val)} ${DAILY[x].unit}`).join(' · ') || 'opcional: pasos, calorías, peso';
});
document.addEventListener('toggle', (e) => { if (e.target.classList?.contains('daily')) ui.dailyOpen = e.target.open; }, true);
if (['sessions', 'exercises'].includes(route().name)) rerender();
