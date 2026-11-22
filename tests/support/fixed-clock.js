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
  browser.newContext = async (...a) => {
    const ctx = await newContext(...a);
    await ctx.clock.install({ time: new Date(FIXED) });
    await ctx.clock.resume();
    return ctx;
  };
  browser.newPage = async (...a) => (await browser.newContext(...a)).newPage();
  return browser;
};
