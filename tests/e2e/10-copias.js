const { chromium, devices } = require('playwright');
const out = process.argv[2];
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ ...devices['Pixel 7'], acceptDownloads: true });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  let promptAnswer = ''; p.on('dialog', (d) => d.type() === 'prompt' ? d.accept(promptAnswer) : d.accept());
  const snaps = () => p.evaluate(() => snapList());
  await p.goto('http://localhost:8123/');
  await p.waitForTimeout(300);
  assert(!(await p.$('[data-action=notices]')), 'sin sesiones no hay aviso de copia (ni campana)');
  assert((await snaps()).length === 0, 'sin sesiones no se crea copia diaria');
  // 3 sesiones
  await p.evaluate(() => { for (let k = 0; k < 3; k++) db.sessions.push({ id: 's' + k, createdAt: '2026-11-1' + k + 'T10:00', date: '2026-11-1' + k, startedAt: 1, endedAt: 2, title: 'S' + k, factors: [], exercises: [] }); save(true); });
  await p.reload(); await p.waitForTimeout(400);
  assert((await p.textContent('[data-action=notices] .badge')) === '1' && !(await p.isVisible('.reminder')), 'con sesiones y sin copia: campana con 1 aviso, recogido');
  await p.click('[data-action=notices]');
  assert(await p.isVisible('.reminder'), 'al tocar la campana se ve el aviso de copia');
  let list = await snaps();
  assert(list.length === 1 && list[0].reason === 'Diaria' && list[0].sessions === 3, 'copia automática diaria al abrir la app');
  await p.reload(); await p.waitForTimeout(400);
  assert((await snaps()).length === 1, 'no repite la diaria el mismo día');
  await p.click('[data-action=notices]');
  await (await p.$('.reminder')).screenshot({ path: out + '/10reminder.png' });
  // «Más tarde» oculta el aviso 3 días
  await p.click('[data-action=snooze-backup]');
  assert(!(await p.isVisible('.reminder')), '«Más tarde» oculta el aviso');
  await p.evaluate(() => { localBk.snoozeUntil = 0; localBkSave(); rerender(); });
  await p.click('[data-action=notices]');
  // Guardar copia en el móvil
  await p.click('.reminder [data-action=export-all]');
  assert((await p.textContent('#modal')).includes('Guardar en Archivos'), 'instrucciones para guardar en Archivos / Descargas');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#modal a[download]')]);
  const path = out + '/copia.json'; await dl.saveAs(path);
  const j = JSON.parse(require('fs').readFileSync(path, 'utf8'));
  assert(j.type === 'diario-entreno-todos' && Object.values(j.data)[0].sessions.length === 3, 'el archivo descargado es una copia completa');
  await p.click('#modal [data-action=close-modal]');
  assert(!(await p.isVisible('.reminder')), 'tras descargar, el aviso desaparece');
  // Ajustes
  await p.goto('http://localhost:8123/#/settings');
  await p.waitForSelector('#snap-list .snap');
  assert((await p.textContent('.card:has(> [data-action=export-all])')).includes('hoy'), 'Ajustes: última copia fuera de la app «hoy»');
  assert(!(await p.isVisible('#cloud-card')), 'la sección de Google Drive no aparece sin ID configurado');
  // Borrar usuario -> copia previa -> restaurar
  await p.goto('http://localhost:8123/#/users');
  await p.click('[data-action=user-form]:not([data-id])');
  await p.fill('#uf-name', 'Marta'); await p.click('[data-action=user-save]');
  await p.goto('http://localhost:8123/#/users');
  promptAnswer = 'Yo';
  await p.click('[data-action=user-delete][aria-label="Borrar Yo"]');
  await p.waitForTimeout(300);
  assert(await p.evaluate(() => profiles.users.map((u) => u.name).join()) === 'Marta', 'usuario «Yo» borrado');
  list = await snaps();
  assert(list[0].reason === 'Antes de borrar a Yo' && list[0].sessions === 3, 'copia automática antes de borrar el usuario');
  await p.goto('http://localhost:8123/#/settings');
  await p.waitForSelector('#snap-list .snap');
  await p.screenshot({ path: out + '/10settings.png', fullPage: true });
  await p.click('#snap-list [data-action=snap-restore] >> nth=0');
  await p.waitForFunction(() => profiles.users.some((u) => u.name === 'Yo'));
  assert(await p.evaluate(() => profiles.users.map((u) => u.name).sort().join()) === 'Marta,Yo', 'restaurar la copia recupera al usuario borrado');
  list = await snaps();
  assert(list[0].reason === 'Antes de restaurar', 'restaurar también guarda antes una copia (se puede deshacer)');
  // Máximo 14
  for (let k = 0; k < 16; k++) await p.evaluate(() => takeSnapshot('Manual'));
  assert((await snaps()).length === 14, 'se conservan solo las últimas 14');
  // CSV también ofrece compartir/descargar
  await p.goto('http://localhost:8123/#/settings');
  await p.click('[data-action=export-csv]');
  assert(await p.isVisible('#modal a[download$=".csv"]'), 'exportar CSV ofrece descargar/compartir');
  console.log('errors', errs);
  await b.close();
})();
