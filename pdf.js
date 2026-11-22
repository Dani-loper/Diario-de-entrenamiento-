'use strict';
/* Informe de evolución en PDF con jsPDF (funciona en iPhone, donde window.print falla en apps instaladas).
 * jsPDF (MIT) está en vendor/ y se carga solo al generar el primer PDF. Las gráficas se dibujan con
 * primitivas vectoriales de jsPDF a partir de los mismos datos que la vista HTML del informe. */

let jspdfPromise = null;
function loadJsPDF() {
  if (window.jspdf) return Promise.resolve(window.jspdf);
  if (!jspdfPromise) {
    jspdfPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'vendor/jspdf.umd.min.js';
      s.onload = () => (window.jspdf ? resolve(window.jspdf) : reject(new Error('jsPDF no disponible')));
      s.onerror = () => { jspdfPromise = null; reject(new Error('No se pudo cargar jsPDF')); };
      document.head.appendChild(s);
    });
  }
  return jspdfPromise;
}

function reportDataFor(months) {
  const { start, end, prevStart, prevEnd } = periodRange(months);
  const avail = reportExercises(start, end);
  const sel = ui.rSel && ui.rSelPeriod === months ? ui.rSel : new Set(avail.slice(0, 6).map((x) => x.id));
  const cur = periodStats(start, end), prev = periodStats(prevStart, prevEnd);
  const weeks = Math.max(1, (Date.parse(end) - Date.parse(start)) / (7 * 864e5));
  const evo = avail.filter((x) => sel.has(x.id)).map((x) => exerciseEvolution(x.id, start, end));
  const wks = completeWeeks(start, end);
  const wData = Object.fromEntries(wks.map((w) => [w, { vol: 0, si: 0 }]));
  for (const s of cur.sessions) { const w = wData[weekStart(s.date)]; if (w) { w.vol += sessionVolume(s); w.si += sessionSI(s).total; } }
  return {
    months, start, end, prevStart, prevEnd, cur, prev, weeks, evo, wks,
    volPts: wks.map((w) => ({ d: w, v: Math.round(wData[w].vol) })),
    siPts: wks.map((w) => ({ d: w, v: Math.round(wData[w].si * 10) / 10 })),
    catItems: muscleItems(cur.setsCat),
    muscleWeekly: Object.fromEntries(Object.entries(cur.setsCat).map(([m, v]) => [m, v / weeks])),
    zoneItems: cur.pcts.length ? ZONES.map(([label, t]) => ({ label, v: cur.pcts.filter(t).length })) : [],
    wb: wellbeingKpis(cur),
    topF: Object.entries(cur.factors).sort((x, y) => y[1] - x[1]).slice(0, 5),
  };
}

// Las fuentes estándar de PDF solo cubren Latin-1/WinAnsi: se sustituyen los símbolos que no existen.
function pdfSafe(t) {
  return String(t ?? '')
    .replace(/[−–]/g, '-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/≈/g, '~')
    .replace(/▲/g, '+').replace(/▼/g, '-')
    .replace(/[^\u0009\u000A -ÿ€…—‘’“”•]/g, '').trim();
}

async function buildReportPDF(months) {
  const { jsPDF } = await loadJsPDF();
  const D = reportDataFor(months);
  const u = activeUser();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const PW = 210, PH = 297, M = 14, CW = PW - 2 * M;
  const C = { accent: [12, 138, 102], text: [17, 24, 32], muted: [90, 101, 117], line: [213, 219, 227], fill: [238, 241, 245], down: [197, 48, 48], white: [255, 255, 255] };
  let y = M;

  const font = (size, bold) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); };
  const txt = (s, x, yy, o = {}) => {
    font(o.size || 10, o.bold); doc.setTextColor(...(o.color || C.text));
    doc.text(pdfSafe(s), x, yy, { align: o.align || 'left', maxWidth: o.maxW });
  };
  const wrap = (s, w, size, bold) => { font(size, bold); return doc.splitTextToSize(pdfSafe(s), w); };
  const ensure = (h) => { if (y + h > PH - M - 8) { doc.addPage(); y = M; } };
  // «need» = alto del primer bloque, para que el título no quede solo al final de una página.
  const section = (title, need = 20) => { ensure(14 + need); y += 5; txt(title, M, y + 4, { size: 13, bold: true }); y += 9; };
  const card = (x, yy, w, h) => { doc.setDrawColor(...C.line); doc.setFillColor(...C.white); doc.setLineWidth(0.25); doc.roundedRect(x, yy, w, h, 2.5, 2.5, 'FD'); };
  const pctDelta = (a, b) => { if (!a || !b) return null; const p = (a / b - 1) * 100; return Math.abs(p) < 0.5 ? { s: '=', c: C.muted } : { s: `${p > 0 ? '+' : '-'}${fmt(Math.abs(p), 0)}%`, c: p > 0 ? C.accent : C.down }; };

  function chartPDF(x, yy, w, h, pts) {
    const padL = 10, padB = 5;
    const vs = pts.map((p) => p.v), min = Math.min(...vs), max = Math.max(...vs), span = max - min || 1;
    const X = (i) => x + padL + (i * (w - padL - 2)) / Math.max(1, pts.length - 1);
    const Y = (v) => yy + h - padB - ((v - min) / span) * (h - padB - 3);
    doc.setDrawColor(...C.line); doc.setLineWidth(0.2); doc.line(x + padL, yy + h - padB, x + w, yy + h - padB);
    txt(String(Math.round(max)), x, Y(max) + 1, { size: 6.5, color: C.muted });
    if (max !== min) txt(String(Math.round(min)), x, Y(min) + 1, { size: 6.5, color: C.muted });
    txt(pts[0].d.slice(5), x + padL, yy + h, { size: 6.5, color: C.muted });
    txt(pts[pts.length - 1].d.slice(5), x + w, yy + h, { size: 6.5, color: C.muted, align: 'right' });
    doc.setDrawColor(...C.accent); doc.setLineWidth(0.55);
    for (let i = 1; i < pts.length; i++) doc.line(X(i - 1), Y(pts[i - 1].v), X(i), Y(pts[i].v));
    if (pts.length <= 45) { doc.setFillColor(...C.accent); pts.forEach((p, i) => doc.circle(X(i), Y(p.v), 0.55, 'F')); }
  }
  function barsPDF(x, yy, w, items) {
    const max = Math.max(1, ...items.map((i) => i.v));
    items.forEach((it, k) => {
      const ry = yy + k * 6;
      txt(it.label, x, ry + 3.2, { size: 8 });
      doc.setFillColor(...C.fill); doc.roundedRect(x + w * 0.34, ry + 0.8, w * 0.5, 3, 1.5, 1.5, 'F');
      if (it.v) { doc.setFillColor(...C.accent); doc.roundedRect(x + w * 0.34, ry + 0.8, Math.max(3, w * 0.5 * it.v / max), 3, 1.5, 1.5, 'F'); }
      txt(fmt(it.v, it.v % 1 ? 1 : 0), x + w, ry + 3.2, { size: 8, bold: true, align: 'right' });
    });
    return items.length * 6;
  }
  function kpiGrid(items, cols = 5) {
    const gap = 3, bw = (CW - (cols - 1) * gap) / cols, bh = 17;
    for (let k = 0; k < items.length; k += cols) {
      ensure(bh + gap);
      items.slice(k, k + cols).forEach((it, c) => {
        const x = M + c * (bw + gap);
        card(x, y, bw, bh);
        txt(it.v, x + 3, y + 7, { size: 12, bold: true });
        if (it.d) { font(12, true); const vw = doc.getTextWidth(pdfSafe(it.v)); txt(it.d.s, x + 4 + vw, y + 7, { size: 7.5, bold: true, color: it.d.c }); }
        wrap(it.l, bw - 6, 7).slice(0, 2).forEach((line, li) => txt(line, x + 3, y + 11.5 + li * 3, { size: 7, color: C.muted }));
      });
      y += bh + gap;
    }
  }

  // Cabecera
  txt(`INFORME DE EVOLUCIÓN · ${PERIODS[months].toUpperCase()}`, M, y + 4, { size: 8.5, bold: true, color: C.accent });
  txt(u.name, M, y + 13, { size: 20, bold: true });
  y += 15;
  if (u.goal) { txt(`Objetivo: ${u.goal}`, M, y + 4, { size: 10, color: C.muted }); y += 6; }
  txt(`Del ${fmtLong(D.start)} al ${fmtLong(D.end)} · generado el ${fmtLong(todayISO())}`, M, y + 4, { size: 8.5, color: C.muted });
  y += 7;
  doc.setDrawColor(...C.accent); doc.setLineWidth(0.6); doc.line(M, y, PW - M, y);
  y += 2;

  const { cur, prev } = D;
  if (!cur.n) {
    y += 10; txt(`No hay sesiones registradas en este periodo.`, M, y, { size: 11, color: C.muted });
    return doc;
  }

  // Resumen
  section('Resumen del periodo');
  const avgDur = mean(cur.durations), avgSrpe = mean(cur.srpe);
  const bwF = cur.bw[0], bwL = cur.bw[cur.bw.length - 1];
  const kp = [
    { v: String(cur.n), l: 'sesiones', d: pctDelta(cur.n, prev.n) },
    { v: fmt(cur.n / D.weeks, 1), l: 'sesiones / semana' },
    { v: String(cur.sets), l: 'series efectivas', d: pctDelta(cur.sets, prev.sets) },
    { v: `${fmt(cur.volume / 1000, 1)} t`, l: 'volumen', d: pctDelta(cur.volume, prev.volume) },
    cur.si ? { v: fmt(cur.si, 0), l: 'índice de estrés', d: pctDelta(cur.si, prev.si) } : null,
    { v: String(cur.prs), l: 'récords estimados' },
    avgDur ? { v: `${Math.round(avgDur)} min`, l: 'duración media' } : null,
    avgSrpe ? { v: fmt(avgSrpe, 1), l: 'RPE medio de sesión' } : null,
    cur.pcts.length ? { v: `${fmt(mean(cur.pcts), 0)}%`, l: '%1RM medio' } : null,
    bwF && bwL && cur.bw.length >= 2 ? { v: `${fmt(bwL.v, 1)} kg`, l: `peso (${bwL.v - bwF.v >= 0 ? '+' : '-'}${fmt(Math.abs(bwL.v - bwF.v), 1)} kg)` } : null,
  ].filter(Boolean);
  kpiGrid(kp);
  if (prev.n) { txt(`Los porcentajes comparan con el periodo anterior de igual duración (${fmtLong(D.prevStart)} - ${fmtLong(D.prevEnd)}).`, M, y + 2, { size: 7.5, color: C.muted, maxW: CW }); y += 5; }

  // Evolución por ejercicio
  if (D.evo.length) {
    section('Evolución por ejercicio', 26);
    const cols = [['Ejercicio', M, 'left'], ['Inicio', M + CW * 0.56, 'right'], ['Final', M + CW * 0.70, 'right'], ['Cambio', M + CW * 0.82, 'right'], ['Mejor', M + CW * 0.94, 'right'], ['Ses.', M + CW, 'right']];
    ensure(10);
    cols.forEach(([h, x, a]) => txt(h, x, y + 4, { size: 8, bold: true, color: C.muted, align: a }));
    y += 6; doc.setDrawColor(...C.line); doc.setLineWidth(0.25); doc.line(M, y, M + CW, y);
    for (const e of D.evo) {
      ensure(7);
      const ch = e.change;
      const vals = [e.def.name, e.startV ? fmtM(e.startV, e.m) : '-', e.endV ? fmtM(e.endV, e.m) : '-', ch == null ? '-' : `${ch > 0 ? '+' : ch < 0 ? '-' : ''}${fmt(Math.abs(ch), 1)}%`, e.best ? fmtM(e.best, e.m) : '-', String(e.hist.length)];
      vals.forEach((v, k) => txt(v, cols[k][1], y + 4.6, { size: 9, bold: k === 0 || k === 3, align: cols[k][2], color: k === 3 && ch != null ? (ch > 0.5 ? C.accent : ch < -0.5 ? C.down : C.text) : C.text, maxW: k === 0 ? CW * 0.45 : undefined }));
      y += 6.5; doc.line(M, y, M + CW, y);
    }
    wrap('Inicio y final = media de las 2 primeras y de las 2 últimas sesiones del periodo (1RM estimado en ejercicios con peso), para que un día suelto bueno o malo no distorsione la evolución.', CW, 7.5)
      .forEach((l, k) => txt(l, M, y + 4 + k * 3.2, { size: 7.5, color: C.muted }));
    y += 9;
    const cw = (CW - 6) / 2, chh = 60;
    for (let k = 0; k < D.evo.length; k += 2) {
      ensure(chh + 4);
      D.evo.slice(k, k + 2).forEach((e, c) => {
        const x = M + c * (cw + 6);
        card(x, y, cw, chh);
        txt(wrap(e.def.name, cw - 26, 10, true)[0], x + 4, y + 7, { size: 10, bold: true });
        if (e.change != null) txt(`${e.change > 0 ? '+' : e.change < 0 ? '-' : ''}${fmt(Math.abs(e.change), 1)}%`, x + cw - 4, y + 7, { size: 9, bold: true, align: 'right', color: e.change > 0.5 ? C.accent : e.change < -0.5 ? C.down : C.muted });
        txt(`${e.m.label} por sesión`, x + 4, y + 11.5, { size: 7.5, color: C.muted });
        if (e.pts.length >= 2) chartPDF(x + 3, y + 14, cw - 7, 34, e.pts);
        else txt('Solo una sesión con datos.', x + 4, y + 30, { size: 8, color: C.muted });
        const mini = [e.topW ? `Peso máx. ${fmt(e.topW)} kg` : '', `Volumen ${fmtM(e.vol, e.m, e.m.volUnit)}`, e.pcts.length ? `%1RM medio ${fmt(mean(e.pcts), 0)}%` : ''].filter(Boolean).join('   ');
        txt(mini, x + 4, y + chh - 4, { size: 7.5, color: C.muted, maxW: cw - 8 });
      });
      y += chh + 4;
    }
  }

  // Carga semanal
  if (D.wks.length >= 2) {
    section('Carga semanal', 58);
    txt('Semanas completas (de lunes a domingo) dentro del periodo.', M, y + 1, { size: 7.5, color: C.muted });
    y += 3;
    const cw = (CW - 6) / 2, chh = 50;
    ensure(chh + 4);
    const charts = [['Volumen (kg) por semana', D.volPts], cur.si ? ['Índice de estrés por semana', D.siPts] : null].filter(Boolean);
    charts.forEach(([t, pts], c) => { const x = M + c * (cw + 6); card(x, y, cw, chh); txt(t, x + 4, y + 7, { size: 9.5, bold: true }); chartPDF(x + 3, y + 10, cw - 7, 36, pts); });
    y += chh + 4;
  }

  // Volumen por músculo: figura frontal y posterior (vectorial) con la media semanal del periodo
  if (Object.keys(D.muscleWeekly).length) {
    const steps = [5, 10, 15, 20], H = 88;
    section('Volumen por músculo', H);
    card(M, y, CW, H);
    const k = 0.2, fw = 200 * k; // cada figura: 40 x 74,4 mm
    bodyPDF(doc, M + 4, y + 5, k, FRONT, D.muscleWeekly, steps);
    bodyPDF(doc, M + 8 + fw, y + 5, k, BACK, D.muscleWeekly, steps);
    txt('Frontal', M + 4 + fw / 2, y + 83, { size: 7.5, color: C.muted, align: 'center' });
    txt('Posterior', M + 8 + fw * 1.5, y + 83, { size: 7.5, color: C.muted, align: 'center' });
    // Valores y leyenda a la derecha
    const lx = M + 16 + fw * 2, lw = M + CW - 4 - lx;
    txt('Series por semana (media del periodo)', lx, y + 9, { size: 9, bold: true });
    const items = MUSCLE_KEYS.map((m) => [m, D.muscleWeekly[m] || 0]).sort((a, b) => b[1] - a[1]);
    items.forEach(([m, v], i) => {
      const ry = y + 15 + i * 5.2;
      const [r, g, bl] = BODY_COLORS.levels[bodyLevel(v, steps)];
      doc.setFillColor(r, g, bl); doc.setDrawColor(...BODY_COLORS.line); doc.setLineWidth(0.2); doc.roundedRect(lx, ry - 2.8, 3.4, 3.4, 0.6, 0.6, 'FD');
      txt(MUSCLES[m], lx + 5.5, ry, { size: 8.5, color: v ? C.text : C.muted });
      txt(v ? fmt(v, 1) : '–', lx + lw, ry, { size: 8.5, bold: !!v, align: 'right', color: v ? C.text : C.muted });
    });
    const legend = ['0', `<${steps[0]}`, ...steps.slice(0, -1).map((t, i) => `${t}-${steps[i + 1]}`), `${steps[steps.length - 1]}+`];
    legend.forEach((l, i) => {
      const lxx = lx + (i % 3) * (lw / 3), lyy = y + 74 + Math.floor(i / 3) * 5;
      const [r, g, bl] = BODY_COLORS.levels[i];
      doc.setFillColor(r, g, bl); doc.setDrawColor(...BODY_COLORS.line); doc.roundedRect(lxx, lyy - 2.6, 3.2, 3.2, 0.6, 0.6, 'FD');
      txt(l, lxx + 4.6, lyy, { size: 7.5, color: C.muted });
    });
    y += H + 4;
  }

  // Reparto
  {
    const cw = (CW - 6) / 2;
    const h = 14 + Math.max(D.catItems.length, D.zoneItems.length) * 6;
    section('Reparto del entrenamiento', h + 4);
    ensure(h + 4);
    card(M, y, cw, h); txt('Series por músculo (principal 1, secundario 0,5)', M + 4, y + 7, { size: 9.5, bold: true }); barsPDF(M + 4, y + 10, cw - 8, D.catItems);
    if (D.zoneItems.length) { const x = M + cw + 6; card(x, y, cw, h); txt('Series por zona de %1RM', x + 4, y + 7, { size: 9.5, bold: true }); barsPDF(x + 4, y + 10, cw - 8, D.zoneItems); }
    y += h + 4;
  }

  // Bienestar
  if (D.wb.length || cur.bw.length >= 2 || D.topF.length) {
    section('Bienestar, actividad y composición', 24);
    if (D.wb.length) kpiGrid(D.wb.map(([l, v, un, dec]) => ({ v: fmt(mean(v), dec ?? 1) + un, l: `${l} (n=${v.length})` })), 3);
    if (D.topF.length) { txt(`Factores más marcados: ${D.topF.map(([f, n]) => `${f} (${n})`).join(', ')}`, M, y + 2, { size: 8, color: C.muted, maxW: CW }); y += 6; }
    if (cur.bw.length >= 2) { ensure(54); card(M, y, CW, 50); txt('Peso corporal (kg)', M + 4, y + 7, { size: 9.5, bold: true }); chartPDF(M + 3, y + 10, CW - 7, 36, cur.bw); y += 54; }
  }

  // Comentarios
  if (db.reportNote && db.reportNote.trim()) {
    section('Comentarios del entrenador', 12);
    for (const line of wrap(db.reportNote, CW, 10)) { ensure(5.5); txt(line, M, y + 4, { size: 10 }); y += 5; }
    y += 2;
  }

  // Nota metodológica
  const note = wrap('1RM estimado e intensidad relativa calculados con la tabla RTS a partir de repeticiones y RIR/RPE; son estimaciones que dependen de que el esfuerzo se registre con honestidad. Índice de estrés: multiarticular 1,4 - 0,2·RIR, monoarticular 1,3 - 0,2·RIR.', CW, 7.5);
  ensure(note.length * 3.3 + 6);
  y += 3; doc.setDrawColor(...C.line); doc.setLineWidth(0.25); doc.line(M, y, M + CW, y);
  note.forEach((l, k) => txt(l, M, y + 4 + k * 3.3, { size: 7.5, color: C.muted }));

  // Pie de página
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    txt(`${u.name} · Informe ${PERIODS[months]} · Diario de entrenamiento`, M, PH - 7, { size: 7.5, color: C.muted });
    txt(`Página ${i} de ${n}`, PW - M, PH - 7, { size: 7.5, color: C.muted, align: 'right' });
  }
  return doc;
}

/* ---------- Figura del cuerpo en PDF ----------
 * Reutiliza las formas SVG de la figura en pantalla (BODY_BASE, LIMB_BASE, FRONT, BACK) y las convierte a
 * primitivas vectoriales de jsPDF. Colores fijos del tema claro (el PDF siempre es claro). */
const BODY_COLORS = {
  levels: [[227, 231, 236], [198, 237, 221], [143, 220, 189], [69, 191, 143], [21, 147, 106], [11, 94, 68]],
  body: [244, 246, 248], line: [185, 193, 203],
};
// Trazado SVG (M L H V Q Z, absolutos y relativos h v l z) → operaciones de jsPDF.path con coordenadas transformadas.
function svgPathOps(d, tx) {
  const t = d.match(/[MLHVQZmlhvqz]|-?\d*\.?\d+/g) || [];
  const ops = []; let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0;
  const n = () => +t[i++];
  while (i < t.length) {
    if (/[A-Za-z]/.test(t[i])) cmd = t[i++];
    else if (!cmd || /[Zz]/.test(cmd)) break; // números sin comando: trazado mal formado
    switch (cmd) {
      case 'M': x = n(); y = n(); sx = x; sy = y; ops.push({ op: 'm', c: tx(x, y) }); cmd = 'L'; break;
      case 'L': x = n(); y = n(); ops.push({ op: 'l', c: tx(x, y) }); break;
      case 'l': x += n(); y += n(); ops.push({ op: 'l', c: tx(x, y) }); break;
      case 'H': x = n(); ops.push({ op: 'l', c: tx(x, y) }); break;
      case 'h': x += n(); ops.push({ op: 'l', c: tx(x, y) }); break;
      case 'V': y = n(); ops.push({ op: 'l', c: tx(x, y) }); break;
      case 'v': y += n(); ops.push({ op: 'l', c: tx(x, y) }); break;
      case 'Q': { // cuadrática → cúbica
        const qx = n(), qy = n(), ex = n(), ey = n();
        const c1 = tx(x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y)), c2 = tx(ex + (2 / 3) * (qx - ex), ey + (2 / 3) * (qy - ey));
        ops.push({ op: 'c', c: [...c1, ...c2, ...tx(ex, ey)] }); x = ex; y = ey; break;
      }
      case 'Z': case 'z': ops.push({ op: 'h', c: [] }); x = sx; y = sy; break;
      default: i++;
    }
  }
  return ops;
}
function drawSvgShape(doc, shape, ox, oy, k, mirror) {
  const X = (x) => ox + (mirror ? 200 - x : x) * k, Y = (y) => oy + y * k;
  const el = /<ellipse cx="([\d.]+)" cy="([\d.]+)" rx="([\d.]+)" ry="([\d.]+)"/.exec(shape);
  if (el) { doc.ellipse(X(+el[1]), Y(+el[2]), +el[3] * k, +el[4] * k, 'FD'); return; }
  const pa = /<path d="([^"]+)"/.exec(shape);
  if (pa) { doc.path(svgPathOps(pa[1], (x, y) => [X(x), Y(y)])); doc.fillStroke(); }
}
function bodyPDF(doc, ox, oy, k, view, vals, steps) {
  doc.setLineWidth(0.25);
  doc.setFillColor(...BODY_COLORS.body); doc.setDrawColor(...BODY_COLORS.line);
  for (const s of BODY_BASE) drawSvgShape(doc, s, ox, oy, k, false);
  for (const s of LIMB_BASE) { drawSvgShape(doc, s, ox, oy, k, false); drawSvgShape(doc, s, ox, oy, k, true); }
  for (const [m, s, mirror] of view.shapes) {
    doc.setFillColor(...BODY_COLORS.levels[bodyLevel(vals[m] || 0, steps)]); doc.setDrawColor(...BODY_COLORS.line);
    drawSvgShape(doc, s, ox, oy, k, false);
    if (mirror) drawSvgShape(doc, s, ox, oy, k, true);
  }
}

/* ---------- Resultado para compartir o descargar (PDF, imagen o vídeo) ----------
 * iOS solo abre el menú de compartir justo después de un toque: por eso el archivo se genera primero
 * y se ofrece un botón «Compartir» que el usuario pulsa después. */
function showShareResult(blob, filename, title, preview = '') {
  const file = new File([blob], filename, { type: blob.type });
  const url = URL.createObjectURL(blob);
  ui.modalUrls = [...(ui.modalUrls || []), url];
  ui.shareFile = file;
  // En la app Android se comparte con la hoja nativa (no hay descargas en el visor web).
  const canShare = IS_NATIVE || !!(navigator.canShare && navigator.canShare({ files: [file] }));
  openModal(`<div class="row"><h3 class="spacer">${esc(title)}</h3><button class="ghost" data-action="close-modal" aria-label="Cerrar">✕</button></div>
    ${preview}
    <div class="muted small" style="margin:8px 0">${esc(filename)} · ${fmt(blob.size / 1048576, 1)} MB</div>
    <div style="display:grid;gap:8px">
      ${canShare ? `<button class="primary" data-action="share-file">${ic('share')} Compartir o guardar</button>` : ''}
      ${IS_NATIVE ? '<div class="muted small">En la hoja de compartir elige «Guardar en Archivos» o «Drive» para conservarlo, o envíalo por WhatsApp o correo.</div>'
        : `<a class="btn ${canShare ? '' : 'primary'}" href="${url}" download="${esc(filename)}">${ic('download')} Descargar</a>`}
    </div>`);
}
async function shareFile() {
  try {
    if (IS_NATIVE) await nativeShareFile(ui.shareFile); else await navigator.share({ files: [ui.shareFile], title: ui.shareFile.name });
    if (window.markExported) markExported();
  } catch (e) {
    if (e.name === 'AbortError' || /cancel/i.test(e.message || '')) return;
    alert('No se pudo compartir: ' + e.message + (IS_NATIVE ? '' : '\nUsa «Descargar».'));
  }
}
