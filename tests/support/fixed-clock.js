'use strict';
/* Se carga antes de cada prueba (node --require). Las pruebas usan fechas reales del calendario
 * (p. ej. «hoy» es domingo 22/11/2026), así que el reloj del navegador arranca en ese momento y avanza
 * con normalidad: los cronómetros y temporizadores siguen funcionando. */
const FIXED = process.env.TEST_NOW || '2026-11-22T10:00:00';
const pw = require('playwright');
const launch = pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch = async (...args) => {
  const browser = await launch(...args);
  const newContext = browser.newContext.bind(browser);
  // La ventana de bienvenida (primer arranque) se da por vista salvo en las pruebas que la piden: newContext({ welcome: true }).
  browser.newContext = async (opts = {}, ...rest) => {
    const { welcome, ...o } = opts || {};
    const ctx = await newContext(o, ...rest);
    if (!welcome) await ctx.addInitScript(() => { try { localStorage.setItem('diario-entreno.bienvenida', '1'); } catch (e) { /* nada */ } });
    await ctx.clock.install({ time: new Date(FIXED) });
    await ctx.clock.resume();
    // La app carga sus datos (IndexedDB) antes del resto de scripts: tras cada navegación se espera a que esté lista.
    const newPage = ctx.newPage.bind(ctx);
    ctx.newPage = async (...x) => {
      const p = await newPage(...x);
      for (const m of ['goto', 'reload']) {
        const orig = p[m].bind(p);
        p[m] = async (...y) => {
          const r = await orig(...y);
          await p.waitForFunction(() => window.__appReady === true || !document.querySelector('script[src="storage.js"]'), null, { timeout: 15000 }).catch(() => {});
          return r;
        };
      }
      return p;
    };
    return ctx;
  };
  browser.newPage = async (...a) => (await browser.newContext(...a)).newPage();
  return browser;
};
