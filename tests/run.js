'use strict';
/* Ejecuta las pruebas de extremo a extremo (tests/e2e/*.js) contra la app servida en local.
 *   npm test                 → todas
 *   npm test -- 13 18        → solo las que empiezan por 13 y 18
 * Cada prueba es un script de Playwright que imprime «ok: …» o «FAIL: …» y deja exitCode = 1 si algo falla.
 * Además, cualquier error de JavaScript de la página («errors [...]» no vacío) cuenta como fallo. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8123;
const OUT = path.join(__dirname, 'out');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };

function serve() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || file.includes(`${path.sep}tests${path.sep}`)) { res.writeHead(404); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  // Si ya hay un servidor en el puerto (p. ej. `python3 -m http.server 8123` mientras se desarrolla), se usa ese.
  return new Promise((resolve) => {
    server.once('error', (e) => { if (e.code !== 'EADDRINUSE') throw e; console.log(`(puerto ${PORT} ocupado: se usa el servidor que ya está en marcha)`); resolve(null); });
    server.listen(PORT, () => resolve(server));
  });
}

function runOne(file) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const child = spawn(process.execPath, ['--require', path.join(__dirname, 'support', 'fixed-clock.js'), file, OUT], { cwd: ROOT });
    let log = '';
    child.stdout.on('data', (d) => { log += d; });
    child.stderr.on('data', (d) => { log += d; });
    const timer = setTimeout(() => { log += '\nFAIL: tiempo agotado (5 min)'; child.kill('SIGKILL'); }, 5 * 60e3);
    child.on('close', (code) => {
      clearTimeout(timer);
      const pageErrors = [...log.matchAll(/^errors (\[.*?\])/gm)].filter((m) => m[1] !== '[]');
      const fails = (log.match(/^FAIL:.*$/gm) || []);
      const oks = (log.match(/^ok:/gm) || []).length;
      const passed = code === 0 && !fails.length && !pageErrors.length;
      resolve({ file: path.basename(file), passed, oks, fails, pageErrors, log, secs: ((Date.now() - t0) / 1000).toFixed(1) });
    });
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const filters = process.argv.slice(2);
  const files = fs.readdirSync(path.join(__dirname, 'e2e')).filter((f) => f.endsWith('.js'))
    .filter((f) => !filters.length || filters.some((x) => f.startsWith(x))).sort();
  const server = await serve();
  let failed = 0;
  for (const f of files) {
    const r = await runOne(path.join(__dirname, 'e2e', f));
    console.log(`${r.passed ? '✔' : '✘'} ${r.file}  (${r.oks} comprobaciones, ${r.secs} s)`);
    if (!r.passed) {
      failed++;
      for (const x of r.fails) console.log('    ' + x);
      for (const x of r.pageErrors) console.log('    error de la página: ' + x[1]);
      if (!r.fails.length && !r.pageErrors.length) console.log(r.log.split('\n').slice(-25).map((l) => '    ' + l).join('\n'));
    }
  }
  if (server) server.close();
  console.log(`\n${files.length - failed}/${files.length} pruebas superadas`);
  process.exit(failed ? 1 : 0);
})();
