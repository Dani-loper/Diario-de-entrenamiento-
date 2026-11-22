'use strict';
/* Copia los archivos de la app a www/, que es lo que Capacitor empaqueta en la app Android.
 * (La web publicada en GitHub Pages sigue sirviéndose tal cual desde la raíz del repositorio.) */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'www');
const FILES = ['index.html', 'styles.css', 'manifest.webmanifest', 'sw.js'];
const DIRS = ['icons', 'vendor'];
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(ROOT)) if (f.endsWith('.js') || FILES.includes(f)) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
for (const d of DIRS) fs.cpSync(path.join(ROOT, d), path.join(OUT, d), { recursive: true });
console.log('www/ lista:', fs.readdirSync(OUT).length, 'elementos');
