const { chromium, devices } = require('playwright');
const fs = require('fs');
const out = process.argv[2];
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const c = await b.newContext({ ...devices['Pixel 7'] });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', (d) => d.accept());
  await p.goto('http://localhost:8123/');
  await p.evaluate(() => { db.settings.level = 'advanced'; save(true); rerender(); });

  // Vídeo de prueba (2 s, WebM) generado en el navegador
  const b64 = await p.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360;
    const ctx = cv.getContext('2d'); const st = cv.captureStream(30);
    const rec = new MediaRecorder(st, { mimeType: 'video/webm' }); const ch = [];
    rec.ondataavailable = (e) => ch.push(e.data);
    const done = new Promise((r) => { rec.onstop = r; });
    rec.start(100);
    const t0 = performance.now();
    await new Promise((res) => { const f = () => { const t = (performance.now() - t0) / 1000; ctx.fillStyle = `hsl(${t * 120} 60% 40%)`; ctx.fillRect(0, 0, 640, 360); ctx.fillStyle = '#fff'; ctx.font = '40px sans-serif'; ctx.fillText('Sentadilla ' + t.toFixed(1), 40, 180); if (t < 2) requestAnimationFrame(f); else res(); }; f(); });
    rec.stop(); await done;
    const blob = new Blob(ch, { type: 'video/webm' });
    const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (const x of buf) s += String.fromCharCode(x); return btoa(s);
  });
  const vpath = out + '/test-video.webm';
  fs.writeFileSync(vpath, Buffer.from(b64, 'base64'));

  // Sesión con una serie
  await p.click('[data-action=new-session]');
  await p.fill('[data-s=title]', 'Pierna');
  await p.click('[data-action=add-exercise]');
  await p.fill('#picker-q', 'sentadilla trasera');
  await p.click('#picker-list [data-action=pick-exercise] >> nth=0');
  await p.fill('[data-set="0:0:w"]', '120');
  await p.fill('[data-set="0:0:reps"]', '5');
  await p.selectOption('[data-set="0:0:rpe"]', '8');

  // Añadir vídeo desde el menú de la serie
  await p.click('[data-action=set-menu][data-i="0"][data-j="0"]');
  assert(await p.isVisible('[data-action=video-pick]'), 'menú de la serie con «Grabar o elegir vídeo»');
  await p.click('[data-action=video-pick]');
  await p.setInputFiles('#video-file', vpath);
  await p.waitForFunction(() => currentSession().exercises[0].sets[0].videoId);
  await p.waitForSelector('#vid-slot video');
  const vid = await p.evaluate(async () => { const id = currentSession().exercises[0].sets[0].videoId; const r = await videoGet(id); return { id, size: r?.size, user: r?.user === profiles.active }; });
  assert(vid.size > 1000 && vid.user, `vídeo guardado en IndexedDB (${vid.size} bytes) del usuario activo`);
  assert(await p.$('.settype.has-video'), 'indicador de vídeo en la serie');
  await p.screenshot({ path: out + '/8menu.png' });

  // Compartir: imagen
  await p.click('[data-action=share-set]');
  assert((await p.textContent('.share-preview')).includes('120 kg × 5'), 'vista previa del texto de la serie');
  await p.click('[data-action=share-image]');
  await p.waitForSelector('img.share-img');
  const img = await p.evaluate(() => ({ type: ui.shareFile.type, size: ui.shareFile.size, name: ui.shareFile.name }));
  assert(img.type === 'image/jpeg' && img.size > 20000, `imagen generada ${img.name} (${Math.round(img.size / 1024)} KB)`);
  const imgB64 = await p.evaluate(async () => { const buf = new Uint8Array(await ui.shareFile.arrayBuffer()); let s = ''; for (const x of buf) s += String.fromCharCode(x); return btoa(s); });
  fs.writeFileSync(out + '/8share.jpg', Buffer.from(imgB64, 'base64'));
  assert(await p.isVisible('a[download]'), 'botón de descarga');

  // Compartir: vídeo con datos superpuestos
  await p.click('[data-action=close-modal]');
  await p.click('[data-action=set-menu][data-i="0"][data-j="0"]');
  await p.click('[data-action=share-set]');
  await p.waitForFunction(() => ui.prefetched);
  await p.click('[data-action=share-video]');
  await p.waitForSelector('#gen-bar');
  await p.waitForSelector('video.share-img', { timeout: 20000 });
  const ov = await p.evaluate(() => ({ type: ui.shareFile.type, size: ui.shareFile.size, name: ui.shareFile.name }));
  assert(ov.size > 5000 && /video\//.test(ov.type), `vídeo con datos generado ${ov.name} (${ov.type}, ${Math.round(ov.size / 1024)} KB)`);
  // Fotograma del vídeo generado para revisar la superposición
  await p.evaluate(async () => { const v = document.querySelector('video.share-img'); v.muted = true; await new Promise((r) => { if (v.readyState >= 2) r(); else v.onloadeddata = r; }); });
  await (await p.$('video.share-img')).screenshot({ path: out + '/8overlay.png' });
  await p.click('[data-action=close-modal]');

  // Repetir la sesión: las series copiadas no arrastran el vídeo
  await p.goto('http://localhost:8123/#/');
  await p.click('[data-action=repeat-session]');
  await p.click('[data-action=repeat-from]');
  assert(await p.evaluate(() => currentSession().exercises[0].sets.every((x) => !x.videoId)), 'al repetir una sesión no se copia el vídeo');
  await p.click('[data-action=session-menu]');
  await p.click('[data-action=delete-session]');

  // YouTube
  await p.goto('http://localhost:8123/#/');
  await p.click('.list-item >> nth=0');
  await p.click('[data-action=yt] >> nth=0');
  const href = await p.getAttribute('a[href*="youtube.com/results"]', 'href');
  assert(href.includes('search_query=Sentadilla%20trasera%20t%C3%A9cnica%20tutorial'), 'búsqueda de YouTube con el nombre del ejercicio');
  await p.fill('#yt-url', 'javascript:alert(1)');
  await p.click('[data-action=yt-save]');
  assert(!(await p.evaluate(() => db.exercises.find((e) => e.name === 'Sentadilla trasera').refUrl)), 'rechaza enlaces que no son https');
  await p.fill('#yt-url', 'https://www.youtube.com/watch?v=abc123');
  await p.click('[data-action=yt-save]');
  assert(await p.isVisible('a.btn.primary:has-text("Ver vídeo de referencia")'), 'guarda el vídeo de referencia');
  await p.click('[data-action=close-modal]');
  assert((await p.textContent('[data-action=yt]')).includes('★'), 'la tarjeta marca que hay referencia');

  // Ajustes: estadísticas de vídeo
  await p.goto('http://localhost:8123/#/settings');
  await p.waitForFunction(() => !document.querySelector('#video-stats').textContent.includes('Calculando'));
  assert((await p.textContent('#video-stats')).includes('1 vídeo'), 'Ajustes muestra 1 vídeo');

  // Borrar la serie con vídeo elimina el archivo
  await p.goto('http://localhost:8123/#/');
  await p.click('.list-item >> nth=0');
  await p.click('[data-action=set-menu][data-i="0"][data-j="0"]');
  await p.click('[data-action=del-set]');
  await p.waitForTimeout(300);
  assert(await p.evaluate(async () => (await videoMeta()).length) === 0, 'borrar la serie borra su vídeo');

  // PDF con jsPDF (datos sintéticos de 4 meses)
  await p.evaluate(() => {
    const id = (n) => db.exercises.find((e) => e.name === n).id;
    for (let k = 0; k < 40; k++) {
      const d = new Date(); d.setDate(d.getDate() - (120 - k * 3));
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      db.sessions.push({ id: 'p' + k, createdAt: iso + 'T10:00', date: iso, startedAt: +d, endedAt: +d + 3600e3, title: 'Fuerza', bodyweight: 70 - k * 0.03, sleep: 7, readiness: 4, stress: 2, srpe: 7, factors: k % 5 ? [] : ['Estrés'],
        exercises: [['Sentadilla trasera', 100], ['Press banca', 70]].map(([n, w]) => ({ id: 'q' + k + n, exerciseId: id(n), notes: '', equipment: [], sets: [0, 1, 2].map(() => ({ type: 'E', w: Math.round(w * (1 + 0.003 * k) / 2.5) * 2.5, reps: 5, rir: 2, done: true })) })) });
    }
    profiles.users[0].goal = 'Fuerza máxima en sentadilla'; saveProfiles();
    db.reportNote = 'Progresión constante. Siguiente bloque: más volumen en press — revisar técnica «arco».';
    save(true);
  });
  await p.goto('http://localhost:8123/#/report');
  await p.click('[data-action=r-pdf]');
  await p.waitForSelector('a[download$=".pdf"]', { timeout: 20000 });
  const pdf = await p.evaluate(async () => { const buf = new Uint8Array(await ui.shareFile.arrayBuffer()); let s = ''; for (const x of buf) s += String.fromCharCode(x); return { b64: btoa(s), name: ui.shareFile.name, type: ui.shareFile.type }; });
  fs.writeFileSync(out + '/informe-jspdf.pdf', Buffer.from(pdf.b64, 'base64'));
  const head = Buffer.from(pdf.b64, 'base64').slice(0, 5).toString();
  assert(head === '%PDF-' && pdf.type === 'application/pdf', `PDF generado con jsPDF: ${pdf.name}`);
  const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert(sw <= 0, 'sin scroll horizontal');
  console.log('errors', errs);
  await b.close();
})();
