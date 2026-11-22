const { chromium, devices } = require('playwright');
const out = process.argv[2];
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ ...devices['Pixel 7'] });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', (d) => d.accept());
  await p.goto('http://localhost:8123/');
  await p.evaluate(() => { db.settings.level = 'advanced'; save(true); rerender(); });
  await p.click('[data-action=new-session]');
  await p.fill('[data-s=title]', 'Fuerza');
  await p.click('[data-action=add-exercise]');
  await p.fill('#picker-q', 'press banca');
  await p.click('#picker-list [data-action=pick-exercise] >> nth=0');

  // Modo por defecto: RPE
  assert(await p.$('[data-set="0:0:rpe"]') && !(await p.$('[data-set="0:0:rir"]')), 'por defecto solo RPE');
  await p.click('[data-action=cycle-intensity]');
  assert(!(await p.$('[data-set="0:0:rpe"]')) && await p.$('[data-set="0:0:rir"]'), 'cambia a solo RIR');
  await p.click('[data-action=cycle-intensity]');
  assert(await p.$('[data-set="0:0:rpe"]') && await p.$('[data-set="0:0:rir"]'), 'cambia a RPE + RIR');

  // Sinergia: RPE 8 -> RIR 2 propuesto
  await p.fill('[data-set="0:0:w"]', '100');
  await p.fill('[data-set="0:0:reps"]', '5');
  await p.selectOption('[data-set="0:0:rpe"]', '8');
  assert(await p.$eval('[data-set="0:0:rir"]', (e) => e.value) === '2', 'RPE 8 propone RIR 2');
  // Serie 2: RIR 1 -> RPE 9
  await p.click('[data-action=add-set]');
  await p.selectOption('[data-set="0:1:rpe"]', '');
  await p.selectOption('[data-set="0:1:rir"]', '');
  await p.selectOption('[data-set="0:1:rir"]', '1');
  assert(await p.$eval('[data-set="0:1:rpe"]', (e) => e.value) === '9', 'RIR 1 propone RPE 9');
  // Discrepancia: RPE 9 con RIR 3
  await p.selectOption('[data-set="0:1:rir"]', '3');
  assert(await p.isVisible('.mismatch'), 'aviso de RPE y RIR que no cuadran');
  // e1RM usa RIR: 100x5 RIR2 -> 123,3
  const e1 = await p.$eval('.exstats > div', (e) => e.textContent);
  assert(e1.includes('127,2'), '1RM estimado con RIR prioritario: ' + e1.trim().slice(0, 20));

  // Persistencia del modo en el ejercicio
  const mode = await p.evaluate(() => db.exercises.find((e) => e.name === 'Press banca').intensity);
  assert(mode === 'both', 'modo guardado en el ejercicio');

  // Ventana de ayuda
  await p.click('th button.info[data-k=rir]');
  assert(await p.isVisible('#modal .gloss'), 'abre ventana de RIR');
  await p.screenshot({ path: out + '/4info.png' });
  await p.click('#modal button.block');
  assert(!(await p.isVisible('#modal')), 'cierra ventana');
  // Info dentro de <summary> no debe plegar el bloque
  const openBefore = await p.$eval('#pre', (d) => d.open);
  await p.click('label:has-text("Energía") button.info');
  await p.click('#modal button.block');
  assert(await p.$eval('#pre', (d) => d.open) === openBefore, 'el icono no pliega «Antes de empezar»');

  const card = await p.$('[data-ex="0"]');
  await card.screenshot({ path: out + '/4card.png' });
  // Todos los términos del glosario usados existen
  const keys = await p.evaluate(() => Object.keys(GLOSSARY));
  const used = await p.$$eval('button.info', (bs) => bs.map((x) => x.dataset.k));
  assert(used.every((k) => keys.includes(k)), 'todas las claves del glosario existen');
  // Ancho: sin scroll horizontal en modo RPE + RIR
  const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert(sw <= 0, 'sin scroll horizontal (' + sw + ')');
  await p.goto('http://localhost:8123/#/settings');
  await p.screenshot({ path: out + '/4settings.png' });
  console.log('errors', errs);
  await b.close();
})();
