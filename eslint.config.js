'use strict';
/* Revisión estática del código de la app.
 * Los archivos de la app son scripts clásicos que comparten el ámbito global (sin módulos): lo que declara uno
 * (const, let, function, class) lo usan los demás. Por eso:
 *  1) se reúnen las declaraciones de primer nivel de todos los archivos y se dan como globales al resto;
 *  2) si dos archivos declaran el mismo nombre, se falla (en el navegador, el segundo archivo no se cargaría entero:
 *     «Identifier 'x' has already been declared»). */
const fs = require('fs');
const path = require('path');
const espree = require('espree');
const globals = require('globals');

const APP_FILES = ['errlog.js', 'native.js', 'catalog.js', 'storage.js', 'app.js', 'pdf.js', 'media.js', 'backup.js', 'autobackup.js', 'templates.js',
  'records.js', 'progress.js', 'daily.js', 'suggest.js', 'share.js', 'meso.js', 'profile.js', 'tour.js', 'autoclose.js', 'privacy.js', 'update.js', 'sw.js'];
const PAGE_FILES = APP_FILES.filter((f) => f !== 'sw.js');

const declared = {}; // nombre → [archivos]
for (const f of PAGE_FILES) {
  const ast = espree.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'), { ecmaVersion: 'latest', sourceType: 'script' });
  for (const node of ast.body) {
    const names = node.type === 'VariableDeclaration' ? node.declarations.flatMap((d) => (d.id.type === 'Identifier' ? [d.id.name] : []))
      : (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') && node.id ? [node.id.name] : [];
    for (const n of names) (declared[n] = declared[n] || []).push(f);
  }
}
const dups = Object.entries(declared).filter(([, fs2]) => fs2.length > 1);
if (dups.length) {
  throw new Error('Nombres declarados en más de un archivo (el segundo no cargaría en el navegador):\n'
    + dups.map(([n, fs2]) => `  ${n}: ${fs2.join(', ')}`).join('\n'));
}
const shared = Object.fromEntries(Object.keys(declared).map((n) => [n, 'writable']));

module.exports = [
  { ignores: ['node_modules/**', 'www/**', 'android/**', 'vendor/**', 'tests/out/**'] },
  {
    files: PAGE_FILES,
    languageOptions: {
      ecmaVersion: 'latest', sourceType: 'script',
      globals: { ...globals.browser, ...shared, jspdf: 'readonly' },
    },
    rules: {
      'no-undef': 'error',
      'no-redeclare': ['error', { builtinGlobals: false }], // los repetidos entre archivos los detecta la comprobación de arriba
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-unreachable': 'error',
      'no-const-assign': 'error',
      'no-self-assign': 'error',
      'no-unused-vars': ['warn', { vars: 'local', args: 'none', caughtErrors: 'none' }],
    },
  },
  {
    files: ['sw.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'script', globals: { ...globals.serviceworker } },
  },
  {
    files: ['tests/**/*.js', 'scripts/**/*.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'commonjs', globals: { ...globals.node, ...globals.browser, ...shared } },
    rules: { 'no-undef': 'error' },
  },
];
