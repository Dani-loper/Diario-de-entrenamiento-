const { chromium, devices } = require('playwright');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ ...devices['Pixel 7'] });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', (d) => d.accept());
  await p.goto('http://localhost:8123/');
  await p.evaluate(() => { db.settings.level = 'advanced'; save(true); rerender(); });
  async function session(w1, w2, rpe) {
    await p.click('[data-action=new-session]');
    await p.fill('[data-s=title]', 'Pierna A');
    await p.click('[data-action=add-exercise]');
    await p.fill('#picker-q', 'peso muerto');
    await p.click('#picker-list [data-action=pick-exercise] >> nth=0');
    const rows = await p.$$eval('tbody tr', (r) => r.length);
    if (rows === 1) {
      await p.fill('[data-set="0:0:w"]', String(w1));
      await p.fill('[data-set="0:0:reps"]', '5');
      await p.click('[data-action=add-set]');
    }
    await p.fill('[data-set="0:1:w"]', String(w2));
    await p.selectOption('[data-set="0:1:rpe"]', rpe);
    await p.click('[data-action=open-eq]');
    const strapsOn = await p.$eval('[data-action=toggle-eq]:has-text("Straps")', (e) => e.classList.contains('on'));
    if (!strapsOn) await p.click('[data-action=toggle-eq]:has-text("Straps")');
    await p.click('[data-action=open-eq]');
    await p.click('[data-action=toggle-done][data-j="1"]');
    await p.fill('[data-exnote="0"]', 'Agarre mixto, bien');
  }
  await session(100, 110, '8');
  await p.click('[data-action=finish-session]');
  await p.goto('http://localhost:8123/#/');
  await p.reload();
  await session(0, 125, '9');
  await p.screenshot({ path: out + '/s.png', fullPage: true });
  await p.goto('http://localhost:8123/#/');
  await p.screenshot({ path: out + '/home.png' });
  await p.click('.tabbar a[data-tab=exercises]');
  await p.click('a[href^="#/exercise/"] >> nth=0');
  await p.click('text=Con Straps');
  await p.screenshot({ path: out + '/ex.png', fullPage: true });
  console.log('errors', errs, 'sessions', await p.evaluate(() => db.sessions.length));
  await b.close();
})();
