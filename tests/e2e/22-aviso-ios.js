const { chromium, devices } = require('playwright');
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const open = async (dev, standalone) => {
    const c = await b.newContext({ ...devices[dev] });
    if (standalone) await c.addInitScript(() => Object.defineProperty(navigator, 'standalone', { get: () => true }));
    const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://localhost:8123/'); await p.waitForSelector('.cal');
    return p;
  };
  // Los avisos del calendario van tras el icono de la campana: se abre si está.
  const warn = async (p) => { if (await p.$('[data-action=notices][aria-expanded=false]')) await p.click('[data-action=notices]'); return p.isVisible('text=Instala la app para no perder tus datos'); };
  let p = await open('iPhone 13', false);
  assert(await warn(p), 'iPhone desde Safari (sin instalar): aviso visible');
  await p.click('[data-action=dismiss-install]');
  assert(!(await warn(p)), '«Ya la tengo instalada» lo oculta');
  await p.reload(); await p.waitForSelector('.cal');
  assert(!(await warn(p)), 'sigue oculto al recargar');
  p = await open('iPhone 13', true);
  assert(!(await warn(p)), 'iPhone con la app instalada: sin aviso');
  p = await open('Pixel 7', false);
  assert(!(await warn(p)), 'Android: sin aviso (no tiene esa limitación)');
  console.log('errors', errs); await b.close();
})();
