const { chromium } = require('playwright');
// Detecta controles visibles que se solapan en todas las pantallas, en modo sencillo, a 4 anchos de móvil.
const out = process.argv[2] || 'shots';
(async () => {
  const b = await chromium.launch();
  for (const W of [320, 375, 390, 430]) {
  const c = await b.newContext({ viewport: { width: +W, height: 2400 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const p = await c.newPage();
  await p.goto('http://localhost:8123/');
  await p.evaluate(() => {
    db.settings.level = 'simple';
    const sq = db.exercises.find((e) => e.name === 'Sentadilla trasera').id;
    const pu = db.exercises.find((e) => e.mode === 'bw') || db.exercises[0];
    const iso = todayISO();
    db.sessions.push({ id: 's1', createdAt: iso + 'T10', date: iso, startedAt: Date.now() - 3e6, title: 'Pierna', factors: [], bodyweight: 80.5, exercises: [
      { id: 'x1', exerciseId: sq, equipment: [], notes: '', sets: [{ type: 'C', w: 60, reps: 10, done: true, rest: 90 }, { type: 'E', w: 102.5, reps: 5, rir: 2, done: true }, { type: 'E', w: 102.5, reps: 5, rir: 1, done: false }] },
      { id: 'x2', exerciseId: pu.id, equipment: [], notes: '', sets: [{ type: 'E', w: 10, reps: 8, rir: 2, done: true }] }] });
    save(true);
  });
  for (const h of ['#/', '#/session/s1', '#/exercises', '#/settings', '#/templates', '#/users']) {
    await p.goto('http://localhost:8123/' + h); await p.waitForTimeout(250);
    // detectar solapes entre controles hermanos
    const ov = await p.evaluate(() => {
      const els = [...document.querySelectorAll('main input, main select, main button, main .chip, main .stat, main a.btn')].filter((e) => e.offsetParent && e.checkVisibility());
      const r = els.map((e) => [e, e.getBoundingClientRect()]); const res = [];
      for (let a = 0; a < r.length; a++) for (let z = a + 1; z < r.length; z++) {
        const [e1, A] = r[a], [e2, B] = r[z];
        if (e1.contains(e2) || e2.contains(e1)) continue;
        const ox = Math.min(A.right, B.right) - Math.max(A.left, B.left), oy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
        if (ox > 2 && oy > 2) res.push(`${e1.tagName}.${e1.className}[${e1.dataset.action || e1.dataset.set || ''}] × ${e2.tagName}.${e2.className}[${e2.dataset.action || e2.dataset.set || ''}] ${Math.round(ox)}x${Math.round(oy)}`);
      }
      const wide = document.documentElement.scrollWidth > innerWidth;
      return { res: res.slice(0, 8), wide };
    });
    if (ov.res.length || ov.wide) { process.exitCode = 1; console.log('FAIL:', W, h, JSON.stringify(ov)); } else console.log('ok:', W, h, 'sin solapes');
    await p.screenshot({ path: `${out}/simple-${W}-${h.replace(/\W/g, '') || 'cal'}.png`, fullPage: true });
  }
  await c.close();
  }
  await b.close();
})();
