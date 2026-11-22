const { chromium, devices } = require('playwright');
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['Pixel 7'] });
  // Simula el puente de Capacitor: plugins Filesystem y Share que registran lo que reciben.
  await ctx.addInitScript(() => {
    window.__calls = [];
    window.Capacitor = { isNativePlatform: () => true, Plugins: {
      Filesystem: { writeFile: async (o) => { window.__calls.push(['write', o.path, o.directory, o.data.length]); return { uri: 'file:///cache/' + o.path }; } },
      Share: { share: async (o) => { window.__calls.push(['share', o.files ? o.files[0] : o.text]); return {}; } } } };
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8123/');
  assert(await p.evaluate(() => IS_NATIVE && document.documentElement.classList.contains('native')), 'detecta que está dentro de la app');
  assert(await p.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length === 0), 'en la app no registra el service worker');
  // Copia de seguridad: sin enlace «Descargar», con la hoja de compartir nativa
  await p.goto('http://localhost:8123/#/settings');
  await p.click('[data-action=export-all]');
  await p.waitForSelector('#modal[open] [data-action=share-file]');
  assert(!(await p.$('#modal a[download]')), 'sin enlace de descarga (no funciona en el visor de la app)');
  await p.click('#modal [data-action=share-file]');
  await p.waitForFunction(() => window.__calls.some((c) => c[0] === 'share'));
  const calls = await p.evaluate(() => window.__calls);
  assert(calls[0][0] === 'write' && /^diario-entreno-copia-.*\.json$/.test(calls[0][1]) && calls[0][2] === 'CACHE' && calls[0][3] > 100, 'escribe la copia en la caché de la app: ' + calls[0].slice(0, 3).join(' '));
  assert(calls[1][0] === 'share' && calls[1][1].startsWith('file:///cache/diario-entreno-copia-'), 'y la abre con la hoja de compartir de Android');
  assert(await p.evaluate(() => !!JSON.parse(localStorage.getItem('diario-entreno.copias')).lastExport), 'cuenta como copia guardada fuera de la app');
  // En la app no aparece el aviso de instalar en iPhone
  const ios = await b.newContext({ ...devices['iPhone 13'] });
  await ios.addInitScript(() => { window.Capacitor = { isNativePlatform: () => true, Plugins: {} }; });
  const q = await ios.newPage(); await q.goto('http://localhost:8123/'); await q.waitForSelector('.cal');
  assert(!(await q.isVisible('text=Instala la app para no perder tus datos')), 'dentro de la app no avisa de instalarla');
  // Barras del sistema (Android a pantalla completa): Capacitor da sus medidas en --safe-area-inset-*
  await p.goto('http://localhost:8123/');
  await p.evaluate(() => { document.documentElement.style.setProperty('--safe-area-inset-top', '40px'); document.documentElement.style.setProperty('--safe-area-inset-bottom', '48px'); });
  const pad = await p.evaluate(() => [getComputedStyle(document.querySelector('main')).paddingTop, getComputedStyle(document.querySelector('.tabbar')).paddingBottom, getComputedStyle(document.body, '::before').height]);
  assert(pad.join() === '52px,48px,40px', 'hueco para la barra de estado (12 + 40 px), franja opaca fija de 40 px detrás de ella y 48 px para la barra de navegación: ' + pad.join());
  console.log('errors', errs); await b.close();
})();
