'use strict';
/* Vídeos de series (IndexedDB), compartir series con los datos superpuestos y tutoriales de YouTube.
 * Los vídeos se guardan en el almacenamiento interno de la app, no en la galería: una app web no puede
 * escribir en Fotos. «Guardar en el móvil» los exporta con el menú de compartir o una descarga. */

/* ---------- IndexedDB ---------- */
const VDB_NAME = 'diario-entreno-videos';
let vdbPromise = null;
function vdb() {
  if (!vdbPromise) {
    vdbPromise = new Promise((resolve, reject) => {
      const r = indexedDB.open(VDB_NAME, 1);
      r.onupgradeneeded = () => { const st = r.result.createObjectStore('videos', { keyPath: 'id' }); st.createIndex('user', 'user'); };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => { vdbPromise = null; reject(r.error); };
    });
  }
  return vdbPromise;
}
async function vtx(mode, fn) {
  const d = await vdb();
  return new Promise((resolve, reject) => {
    const tx = d.transaction('videos', mode);
    const res = fn(tx.objectStore('videos'));
    tx.oncomplete = () => resolve(res && 'result' in res ? res.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Operación cancelada'));
  });
}
const videoPut = (rec) => vtx('readwrite', (st) => st.put(rec));
const videoGet = (id) => vtx('readonly', (st) => st.get(id));
const videoDelete = (id) => id ? vtx('readwrite', (st) => st.delete(id)).catch(() => {}) : Promise.resolve();
const videoMeta = () => vtx('readonly', (st) => st.getAll()).then((all) => all.map(({ id, user, size }) => ({ id, user, size })));
async function videoDeleteByUser(user) {
  const all = await videoMeta().catch(() => []);
  await Promise.all(all.filter((v) => v.user === user).map((v) => videoDelete(v.id)));
}
const setsWithVideo = (sess) => sess.exercises.flatMap((e) => e.sets.filter((x) => x.videoId).map((x) => x.videoId));
const deleteVideos = (ids) => Promise.all(ids.map(videoDelete));
// Borra vídeos que ya no están referenciados por ninguna serie de ningún usuario.
async function videoGc() {
  const all = await videoMeta().catch(() => []);
  const refs = new Set();
  for (const u of profiles.users) {
    const d = u.id === profiles.active ? db : readUserData(u.id);
    if (d) for (const s of d.sessions) setsWithVideo(s).forEach((id) => refs.add(id));
  }
  await Promise.all(all.filter((v) => !refs.has(v.id)).map((v) => videoDelete(v.id)));
}

/* ---------- Datos de una serie para mostrar o compartir ---------- */
function setInfo(sess, i, j) {
  const ex = sess.exercises[i], set = ex.sets[j], def = exById(ex.exerciseId) || { name: 'Ejercicio', mode: 'wr' };
  let main;
  if (def.mode === 'dist') main = `${fmt(set.dist, 0)} m${set.time ? ` en ${fmtSec(set.time)}` : ''}`;
  else if (def.mode === 'time') main = `${set.w ? fmt(set.w) + ' kg · ' : ''}${fmtSec(set.time || 0)}`;
  else if (def.mode === 'bw') main = `${set.w ? '+' + fmt(set.w) + ' kg' : 'Peso corporal'} × ${set.reps ?? '–'}`;
  else main = `${fmt(set.w)} kg × ${set.reps ?? '–'}`;
  const effort = [set.rpe ? `RPE ${fmt(set.rpe)}` : '', set.rir != null ? `RIR ${set.rir >= 6 ? '6+' : fmt(set.rir)}` : ''].filter(Boolean).join(' · ');
  const p = def.mode === 'wr' ? pct1rm(set) : null, e1 = def.mode === 'wr' ? e1rm(set) : null;
  const calc = [p ? `≈${Math.round(p)}% 1RM` : '', e1 ? `1RM est. ${fmt(e1, 0)} kg` : ''].filter(Boolean).join(' · ');
  const label = set.type === 'E' ? `Serie ${j + 1}` : `Serie ${j + 1} · ${SET_TYPES[set.type]}`;
  return { def, set, title: def.name, main, effort, calc, label, date: fmtDate(sess.date) };
}
const setText = (inf) => [inf.title, inf.main, inf.effort, inf.calc, `${inf.label} · ${inf.date}`].filter(Boolean).join('\n');

/* ---------- Dibujo de la información sobre imagen o vídeo ---------- */
function drawOverlay(ctx, W, H, inf) {
  const s = Math.min(W, H) / 1080; // escala relativa a 1080 px
  const pad = 56 * s;
  const lines = [
    [inf.title, `700 ${56 * s}px system-ui, -apple-system, Roboto, sans-serif`, '#ffffff'],
    [inf.main, `800 ${96 * s}px system-ui, -apple-system, Roboto, sans-serif`, '#4fd1a5'],
    [inf.effort, `600 ${42 * s}px system-ui, -apple-system, Roboto, sans-serif`, '#ffffff'],
    [inf.calc, `500 ${36 * s}px system-ui, -apple-system, Roboto, sans-serif`, 'rgba(255,255,255,.85)'],
    [`${inf.label} · ${inf.date}`, `500 ${32 * s}px system-ui, -apple-system, Roboto, sans-serif`, 'rgba(255,255,255,.7)'],
  ].filter(([t]) => t);
  const lh = (f) => parseFloat(f.split(' ')[1]) * 1.25;
  const blockH = lines.reduce((a, [, f]) => a + lh(f), 0) + pad * 1.6;
  const g = ctx.createLinearGradient(0, H - blockH - 80 * s, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.35, 'rgba(0,0,0,.62)'); g.addColorStop(1, 'rgba(0,0,0,.85)');
  ctx.fillStyle = g; ctx.fillRect(0, H - blockH - 80 * s, W, blockH + 80 * s);
  let y = H - blockH + pad * 0.6;
  ctx.textBaseline = 'top';
  for (const [t, f, c] of lines) {
    ctx.font = f; ctx.fillStyle = c;
    let txt = t;
    while (ctx.measureText(txt).width > W - 2 * pad && txt.length > 4) txt = txt.slice(0, -2) + '…';
    ctx.fillText(txt, pad, y); y += lh(f);
  }
  ctx.font = `600 ${26 * s}px system-ui, -apple-system, Roboto, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.textAlign = 'right';
  ctx.fillText('Diario de entrenamiento', W - pad, pad * 0.6);
  ctx.textAlign = 'left';
}
const canvasBlob = (cv, type = 'image/png', q) => new Promise((res, rej) => cv.toBlob((b) => b ? res(b) : rej(new Error('No se pudo generar la imagen')), type, q));

async function videoFrame(blob, at = 0.35) {
  const url = URL.createObjectURL(blob);
  try {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('Vídeo no compatible')); });
    if (Number.isFinite(v.duration) && v.duration > 0) { v.currentTime = v.duration * at; await new Promise((res) => { v.onseeked = res; setTimeout(res, 1500); }); }
    return v; // el llamador dibuja el fotograma; la URL se libera abajo cuando ya no hace falta
  } finally { setTimeout(() => URL.revokeObjectURL(url), 5000); }
}

async function makeSetImage(inf, videoBlob) {
  const W = 1080, H = 1350;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#16302a'); bg.addColorStop(1, '#0d1116');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  if (videoBlob) {
    try {
      const v = await videoFrame(videoBlob);
      const r = Math.max(W / v.videoWidth, H / v.videoHeight);
      const w = v.videoWidth * r, h = v.videoHeight * r;
      ctx.drawImage(v, (W - w) / 2, (H - h) / 2, w, h);
    } catch (e) { /* sin fotograma: queda el fondo */ }
  }
  drawOverlay(ctx, W, H, inf);
  return canvasBlob(cv, 'image/jpeg', 0.9);
}

function pickRecorderMime() {
  if (!window.MediaRecorder) return null;
  return ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    .find((t) => MediaRecorder.isTypeSupported(t)) || null;
}
// Re-codifica el vídeo dibujando cada fotograma en un canvas con la información encima. Tarda lo que dura el clip.
async function makeOverlayVideo(videoBlob, inf, onProgress, cancel) {
  const mime = pickRecorderMime();
  if (!mime) throw new Error('Este navegador no puede grabar vídeo (MediaRecorder).');
  const url = URL.createObjectURL(videoBlob);
  const v = document.createElement('video');
  v.playsInline = true; v.preload = 'auto'; v.src = url;
  let ac = null;
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* sin audio */ }
  // Iniciar la reproducción aún dentro del toque del usuario (requisito de iOS para el audio).
  try { await v.play(); } catch (e) { v.muted = true; await v.play(); }
  v.pause();
  if (!v.videoWidth) await new Promise((res) => { v.onloadedmetadata = res; });
  v.currentTime = 0;
  const scale = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
  const W = Math.round(v.videoWidth * scale / 2) * 2, H = Math.round(v.videoHeight * scale / 2) * 2;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const stream = cv.captureStream(30);
  if (ac && !v.muted) {
    try {
      const src = ac.createMediaElementSource(v), dest = ac.createMediaStreamDestination();
      src.connect(dest); dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    } catch (e) { /* sin audio */ }
  }
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5e6 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise((res) => { rec.onstop = res; });
  let raf = 0;
  const draw = () => {
    ctx.drawImage(v, 0, 0, W, H); drawOverlay(ctx, W, H, inf);
    if (v.duration) onProgress(Math.min(1, v.currentTime / v.duration));
    if (cancel.cancelled) { v.pause(); if (rec.state !== 'inactive') rec.stop(); return; }
    if (!v.ended) raf = requestAnimationFrame(draw);
  };
  draw();
  rec.start(250);
  const ended = new Promise((res) => { v.onended = res; });
  await v.play();
  raf = requestAnimationFrame(draw);
  await Promise.race([ended, new Promise((res) => { const t = setInterval(() => { if (cancel.cancelled) { clearInterval(t); res(); } }, 200); })]);
  cancelAnimationFrame(raf); draw();
  if (rec.state !== 'inactive') rec.stop();
  await stopped;
  stream.getTracks().forEach((t) => t.stop());
  if (ac) ac.close().catch(() => {});
  URL.revokeObjectURL(url);
  if (cancel.cancelled) throw Object.assign(new Error('Cancelado'), { name: 'AbortError' });
  return new Blob(chunks, { type: mime.split(';')[0] });
}

/* ---------- Menú de la serie ---------- */
function setMenuHTML(sess, i, j) {
  const inf = setInfo(sess, i, j), set = inf.set;
  return `<div class="row"><h3 class="spacer">${esc(inf.label)} · ${esc(inf.title)}</h3><button class="ghost" data-action="close-modal" aria-label="Cerrar">✕</button></div>
    <div class="muted" style="margin:4px 0 10px">${esc([inf.main, inf.effort, inf.calc].filter(Boolean).join(' · '))}</div>
    ${set.videoId ? `<div id="vid-slot" class="vid-slot"><div class="muted small">Cargando vídeo…</div></div>` : ''}
    <div style="display:grid;gap:8px">
      ${set.videoId
        ? `<div class="grid2"><button data-action="video-pick" data-i="${i}" data-j="${j}">🔁 Cambiar vídeo</button><button data-action="video-save" data-i="${i}" data-j="${j}">💾 Guardar en el móvil</button></div>
           <button class="danger" data-action="video-del" data-i="${i}" data-j="${j}">🗑 Borrar vídeo</button>`
        : `<button data-action="video-pick" data-i="${i}" data-j="${j}">🎥 Grabar o elegir vídeo</button>`}
      ${j > 0 ? `<div class="rest-edit"><label>Descanso antes de esta serie ${info('rest')}</label>
        <div class="row"><input id="set-rest" inputmode="numeric" placeholder="m:ss" value="${set.restSec != null ? fmtSec(set.restSec) : ''}" style="flex:1">
        <button data-action="rest-save" data-i="${i}" data-j="${j}">Guardar</button>
        ${set.restSec != null ? `<button class="ghost" data-action="rest-clear" data-i="${i}" data-j="${j}" aria-label="Quitar descanso">✕</button>` : ''}</div>
        ${set.restSrc === 'auto' ? '<div class="muted small">Ahora es aproximado (incluye la ejecución). Corrígelo si lo sabes.</div>' : ''}</div>` : ''}
      <button class="primary" data-action="share-set" data-i="${i}" data-j="${j}">📤 Compartir serie</button>
      <button class="danger" data-action="del-set" data-i="${i}" data-j="${j}">Borrar serie</button>
    </div>
    <div class="muted small" style="margin-top:10px">Los vídeos se guardan dentro de la app en este dispositivo y no se incluyen en la copia de seguridad. Usa «Guardar en el móvil» para conservarlos en Fotos o Archivos.</div>`;
}
async function openSetMenu(i, j) {
  const sess = currentSession(); if (!sess) return;
  openModal(setMenuHTML(sess, i, j));
  const set = sess.exercises[i].sets[j];
  if (!set.videoId) return;
  try {
    const rec = await videoGet(set.videoId);
    const slot = $('#vid-slot'); if (!slot) return;
    if (!rec) { slot.innerHTML = '<div class="mismatch">El vídeo ya no está en este dispositivo (el navegador pudo borrarlo).</div>'; return; }
    const url = URL.createObjectURL(rec.blob); ui.modalUrls = [...(ui.modalUrls || []), url];
    slot.innerHTML = `<video src="${url}" controls playsinline preload="metadata"></video><div class="muted small">${fmt(rec.size / 1048576, 1)} MB</div>`;
  } catch (e) { const slot = $('#vid-slot'); if (slot) slot.innerHTML = `<div class="mismatch">No se pudo leer el vídeo: ${esc(e.message)}</div>`; }
}
modal.addEventListener('close', () => { (ui.modalUrls || []).forEach((u) => URL.revokeObjectURL(u)); ui.modalUrls = []; });

async function storeSetVideo(sessId, i, j, file) {
  const sess = sessionById(sessId); if (!sess) return;
  const set = sess.exercises[i]?.sets[j]; if (!set) return;
  if (!file.type.startsWith('video/')) return alert('El archivo no es un vídeo.');
  try {
    const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
    if (est && est.quota && file.size > est.quota - est.usage) return alert(`No hay espacio suficiente: el vídeo ocupa ${fmt(file.size / 1048576, 0)} MB y quedan ${fmt((est.quota - est.usage) / 1048576, 0)} MB.`);
  } catch (e) { /* sin estimación */ }
  if (file.size > 150 * 1048576 && !confirm(`El vídeo ocupa ${fmt(file.size / 1048576, 0)} MB. Los clips largos llenan rápido la memoria. ¿Guardarlo igualmente?`)) return;
  const id = uid();
  try {
    await videoPut({ id, user: profiles.active, blob: file, type: file.type, size: file.size, name: file.name, createdAt: Date.now() });
  } catch (e) { return alert('No se pudo guardar el vídeo: ' + e.message); }
  const old = set.videoId;
  set.videoId = id; save(true);
  if (old) videoDelete(old);
  rerender();
  if (currentSession()?.id === sessId) openSetMenu(i, j);
}

/* ---------- Tutoriales en YouTube ---------- */
const safeUrl = (u) => { try { const x = new URL(u); return x.protocol === 'https:' ? x.href : null; } catch (e) { return null; } };
function youtubeHTML(def) {
  const q = `${def.name} técnica tutorial`;
  const ref = def.refUrl && safeUrl(def.refUrl);
  return `<div class="row"><h3 class="spacer">Técnica · ${esc(def.name)}</h3><button class="ghost" data-action="close-modal" aria-label="Cerrar">✕</button></div>
    <div style="display:grid;gap:8px;margin-top:10px">
      ${ref ? `<a class="btn primary" href="${esc(ref)}" target="_blank" rel="noopener noreferrer">▶ Ver vídeo de referencia</a>` : ''}
      <a class="btn ${ref ? '' : 'primary'}" href="https://www.youtube.com/results?search_query=${encodeURIComponent(q)}" target="_blank" rel="noopener noreferrer">🔎 Buscar «${esc(q)}» en YouTube</a>
    </div>
    <h3 class="sub">Vídeo de referencia para este ejercicio</h3>
    <div class="muted small" style="margin-bottom:6px">Pega el enlace del tutorial que quieras usar siempre (de YouTube o de cualquier web https). La calidad de los tutoriales varía mucho: elige uno de confianza.</div>
    <input id="yt-url" type="url" inputmode="url" placeholder="https://www.youtube.com/watch?v=…" value="${esc(def.refUrl || '')}">
    <div class="grid2" style="margin-top:8px">
      <button data-action="yt-save" data-id="${def.id}">Guardar enlace</button>
      ${def.refUrl ? `<button class="danger" data-action="yt-clear" data-id="${def.id}">Quitar</button>` : ''}
    </div>`;
}

/* ---------- Espacio usado (Ajustes) ---------- */
async function fillVideoStats() {
  const el = $('#video-stats'); if (!el) return;
  try {
    const all = await videoMeta();
    const mine = all.filter((v) => v.user === profiles.active);
    const mb = (b) => fmt(b / 1048576, b > 1048576 * 10 ? 0 : 1);
    const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
    el.innerHTML = `<b>${mine.length}</b> vídeo${mine.length === 1 ? '' : 's'} de ${esc(activeUser().name)} · ${mb(mine.reduce((a, v) => a + v.size, 0))} MB
      ${all.length !== mine.length ? `<br>Todos los usuarios: ${all.length} vídeos · ${mb(all.reduce((a, v) => a + v.size, 0))} MB` : ''}
      ${est && est.quota ? `<br>Espacio de la app: ${mb(est.usage)} MB usados de ${mb(est.quota)} MB disponibles` : ''}`;
  } catch (e) { el.textContent = 'No se pudo leer el almacenamiento de vídeos.'; }
}
