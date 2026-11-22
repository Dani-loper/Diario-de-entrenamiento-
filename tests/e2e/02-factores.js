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
  async function session(day, w, rpe, factor) {
    await p.goto('http://localhost:8123/#/');
    await p.click(`[data-day="${day}"]`);
    await p.click('[data-action=new-session]');
    await p.fill('[data-s=title]', 'Pierna A');
    await p.fill('[data-s=bodyweight]', '80');
    if (factor) await p.click(`[data-action=toggle-factor][data-f="${factor}"]`);
    await p.fill('[data-s=preNotes]', 'Me noto fresco');
    for (const [name, base] of [['peso muerto', w], ['sentadilla trasera', w - 30]]) {
      await p.click('[data-action=add-exercise]');
      await p.fill('#picker-q', name);
      await p.click('#picker-list [data-action=pick-exercise] >> nth=0');
      const i = (await p.$$('[data-ex]')).length - 1;
      const rows = await p.$$eval(`[data-ex="${i}"] tbody tr`, (r) => r.length);
      if (rows === 1) {
        await p.fill(`[data-set="${i}:0:w"]`, String(base));
        await p.fill(`[data-set="${i}:0:reps"]`, '5');
        await p.click(`[data-action=add-set][data-i="${i}"]`);
        await p.click(`[data-action=add-set][data-i="${i}"]`);
      }
      await p.fill(`[data-set="${i}:2:w"]`, String(base + 5));
      await p.selectOption(`[data-set="${i}:2:rpe"]`, rpe);
      await p.click(`[data-action=toggle-done][data-i="${i}"][data-j="2"]`);
    }
    await p.click('[data-action=timer-stop]');
  }
  await session('2026-11-07', 100, '8');
  await session('2026-11-14', 105, '8.5', 'Dormí mal');
  await session('2026-11-21', 112.5, '9', 'Cafeína / pre-entreno');
  await p.click('[data-action=toggle-chart][data-i="0"]');
  await p.screenshot({ path: out + '/2session.png', fullPage: true });
  await p.goto('http://localhost:8123/#/');
  await p.screenshot({ path: out + '/2cal.png', fullPage: true });
  await p.fill('[data-action-input=csearch]', 'dormi mal');
  await p.screenshot({ path: out + '/2search.png' });
  await p.goto('http://localhost:8123/#/exercises');
  await p.click('[data-action=exercise-form]');
  await p.fill('#ef-name', 'Sentadilla búlgara');
  await p.click('[data-action=save-exercise]');
  console.log('hash', await p.evaluate(() => location.hash), 'errors', errs);
  await b.close();
})();
