'use strict';
/* Diario de entrenamiento — PWA sin dependencias. Datos en IndexedDB a través de kv (storage.js). */

const KEY = 'diario-entreno.v1';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const num = (v) => { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const fmt = (n, d = 1) => n == null ? '–' : (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('es-ES');
const fmtDate = (iso) => new Date(iso + 'T12:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
/* Iconos de línea propios (24×24, trazo de 2 px, color del texto). Sustituyen a los emojis de la interfaz,
   que se ven distintos en cada sistema. */
const ICONS = {
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-7"/>',
  settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  list: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 2.5h6v3H9zM9 11h6M9 15h4"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M10 2.5h4"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  note: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5M8.5 13h7M8.5 17h5"/>',
  pin: '<path d="M12 16v6M8 3h8l-1 6 3 4H6l3-4z"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  video: '<rect x="2.5" y="6" width="13" height="12" rx="2"/><path d="m15.5 10.5 6-3.5v10l-6-3.5"/>',
  share: '<path d="M12 15V3M7 8l5-5 5 5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.5-4.5"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
  upload: '<path d="M12 15V3M7 8l5-5 5 5M4 20h16"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.5-4.5L3 9M3 4v5h5M4 13a8 8 0 0 0 14.5 4.5L21 15M21 20v-5h-5"/>',
  printer: '<path d="M6 9V3h12v6M6 18H3.5v-8h17v8H18"/><path d="M6 14h12v7H6z"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-10 9"/>',
  pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  file: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5"/>',
  alert: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.5v.01"/>',
  save: '<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V3z"/><path d="M8 3v5h7V3M8 21v-6h8v6"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  plate: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  hourglass: '<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>',
};
const ic = (name, cls = '') => `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
// Valor de un campo numérico editable con coma decimal (102,5). Son campos de texto con teclado decimal:
// los type="number" muestran el punto según el idioma del navegador y en algunos iPhone descartan «102,5».
const decIn = (v) => v == null ? '' : String(v).replace('.', ',');
const fmtDur = (ms) => { const m = Math.round(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
const fmtSec = (s) => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/* Tipos de registro por ejercicio */
const MODES = {
  wr: { label: 'Peso × reps', fields: ['w', 'reps'] },
  bw: { label: 'Peso corporal (+lastre)', fields: ['w', 'reps'] },
  time: { label: 'Tiempo', fields: ['w', 'time'] },
  dist: { label: 'Distancia y tiempo', fields: ['dist', 'time'] },
};
const FIELD = {
  w: { h: 'kg', step: '0.5' }, reps: { h: 'Reps', step: '1' }, time: { h: 'Seg', step: '1' },
  dist: { h: 'Metros', step: '1' }, rpe: { h: 'RPE' }, rir: { h: 'RIR' },
};
const SET_TYPES = { E: 'Efectiva', C: 'Calentamiento', D: 'Drop set', F: 'Al fallo' };
const DEFAULT_EXERCISES = CATALOG.map((c) => [c.name, c.mode]); // catalog.js
const DEFAULT_EQUIPMENT = ['Straps', 'Zapatillas de halterofilia', 'Cinturón', 'Rodilleras', 'Muñequeras', 'Coderas', 'Magnesio', 'Calleras', 'Cinturón de lastre', 'Bandas elásticas'];

/* ---------- Músculos ----------
 * Cada ejercicio tiene un músculo principal (o ninguno, p. ej. cardio) y 0 o más secundarios.
 * Volumen por músculo con conteo fraccionado: cada serie efectiva cuenta 1 para el principal y una fracción para
 * cada secundario: 0,5 por defecto (Pelland et al., 2024) o 0,25 / 0,75 según el ejercicio (def.sw).
 * Criterios y fuentes: catalog.js y docs/volumen-por-musculo.md. */
const MUSCLES = {
  pectoral: 'Pectoral', espalda: 'Espalda', trapecio: 'Trapecio', delt_ant: 'Deltoides anterior', delt_lat: 'Deltoides lateral', delt_post: 'Deltoides posterior',
  biceps: 'Bíceps', triceps: 'Tríceps', antebrazo: 'Antebrazo',
  abdomen: 'Abdomen', gluteos: 'Glúteos', aductores: 'Aductores', cuadriceps: 'Cuádriceps', femoral: 'Femoral', gemelos: 'Gemelos',
};
const MUSCLE_KEYS = Object.keys(MUSCLES);
const SECONDARY_WEIGHT = 0.5;
const muscleLabel = (def) => def?.primary ? MUSCLES[def.primary] : 'Sin músculo';
const secWeight = (def, m) => def?.sw?.[m] ?? SECONDARY_WEIGHT;
const fracTxt = (w) => ({ 0.25: '¼', 0.5: '½', 0.75: '¾', 1: '1' }[w] || fmt(w, 2));
const muscleDesc = (def) => def?.primary
  ? `${MUSCLES[def.primary]}${def.secondary?.length ? ` · sec.: ${def.secondary.map((m) => `${MUSCLES[m]} ${fracTxt(secWeight(def, m))}`).join(', ')}` : ''}`
  : 'Sin músculo asignado';
// [[músculo, peso], …]: principal 1; cada secundario, su peso (0,5 si no tiene).
const muscleShares = (def) => def?.primary ? [[def.primary, 1], ...(def.secondary || []).filter((m) => m !== def.primary).map((m) => [m, secWeight(def, m)])] : [];
function addShares(acc, def, v) { if (v) for (const [m, w] of muscleShares(def)) acc[m] = (acc[m] || 0) + v * w; }
// Series efectivas (fraccionadas) o índice de estrés por músculo en una sesión.
function sessionMuscles(s, mode = systemOf(s)) {
  const acc = {};
  for (const e of s.exercises) {
    const def = exById(e.exerciseId);
    for (const x of e.sets.filter(isWork)) {
      if (!x.reps && !x.w && !x.time && !x.dist) continue;
      addShares(acc, def, mode === 'si' ? stressIndex(x, def) || 0 : 1);
    }
  }
  return acc;
}
const muscleItems = (acc) => MUSCLE_KEYS.filter((m) => acc[m]).map((m) => ({ label: MUSCLES[m], v: Math.round(acc[m] * 10) / 10 })).sort((a, b) => b.v - a.v);

// Ejercicios por defecto: nombre → [principal, secundarios] (pesos en DEFAULT_SW). Ver catalog.js.
const DEFAULT_MUSCLES = Object.fromEntries(CATALOG.map((c) => [c.name, [c.primary, Object.keys(c.sw)]]));
const DEFAULT_SW = Object.fromEntries(CATALOG.map((c) => [c.name, { ...c.sw }]));
const CATALOG_BY_NAME = Object.fromEntries(CATALOG.map((c) => [c.name.toLowerCase(), c]));
const defFromCatalog = (c) => ({ id: uid(), name: c.name, mode: c.mode, primary: c.primary, secondary: Object.keys(c.sw), sw: { ...c.sw }, kit: c.kit, joint: c.joint });
// Migración desde las categorías antiguas (Pierna, Empuje…). Los ejercicios propios quedan marcados para revisar.
const OLD_CAT_MUSCLE = { 'Pierna': 'cuadriceps', 'Empuje': 'pectoral', 'Tirón': 'espalda', 'Brazos': 'biceps', 'Core': 'abdomen', 'Halterofilia': 'cuadriceps' };
function migrateMuscles(d) {
  let migrated = false;
  for (const e of d.exercises || []) {
    if ('primary' in e) continue;
    migrated = true;
    const def = DEFAULT_MUSCLES[e.name];
    if (def) { e.primary = def[0]; e.secondary = [...def[1]]; e.sw = { ...DEFAULT_SW[e.name] }; }
    else { e.primary = OLD_CAT_MUSCLE[e.cat] || null; e.secondary = []; e.reviewMuscles = true; }
    delete e.cat;
  }
  // Catálogos anteriores no tenían ningún ejercicio de gemelos.
  // (Se ejecuta durante la carga: no usar funciones definidas más abajo, como norm().)
  if (migrated && !d.exercises.some((e) => e.name.trim().toLowerCase() === 'elevación de gemelos')) {
    d.exercises.push({ id: uid(), name: 'Elevación de gemelos', mode: 'wr', primary: 'gemelos', secondary: [] });
  }
  return migrateDelts(d);
}
/* El antiguo grupo «hombros» se divide en deltoides anterior, lateral y posterior.
 * Ejercicios por defecto: el deltoides que les corresponde. Propios: se deduce por el nombre y se marcan para revisar. */
const deltFor = (name) => /lateral/i.test(name) ? 'delt_lat'
  : /face ?pull|p[aá]jaro|posterior|vuelo|remo|reverse|invertid|facepull/i.test(name) ? 'delt_post' : 'delt_ant';
function migrateDelts(d) {
  if (d.musclesV >= 2) return migrateCatalog(d);
  const swap = (m, e) => {
    if (m !== 'hombros') return m;
    const def = DEFAULT_MUSCLES[e.name];
    return def ? [def[0], ...def[1]].find((x) => String(x).startsWith('delt_')) || deltFor(e.name) : deltFor(e.name);
  };
  for (const e of d.exercises || []) {
    if (e.primary !== 'hombros' && !(e.secondary || []).includes('hombros')) continue;
    if (!DEFAULT_MUSCLES[e.name]) e.reviewMuscles = true;
    e.primary = swap(e.primary, e);
    e.secondary = [...new Set((e.secondary || []).map((m) => swap(m, e)))].filter((m) => m !== e.primary);
  }
  for (const n of ['Elevaciones laterales', 'Pájaros']) {
    if (!(d.exercises || []).some((e) => e.name.trim().toLowerCase() === n.toLowerCase())) d.exercises.push(defFromCatalog(CATALOG_BY_NAME[n.toLowerCase()]));
  }
  if (d.settings?.landmarks?.hombros) { d.settings.landmarks.delt_lat = d.settings.landmarks.hombros; delete d.settings.landmarks.hombros; }
  d.musclesV = 2;
  return migrateCatalog(d);
}
/* Catálogo ampliado y pesos por secundario (v3). Los ejercicios base que el usuario no había cambiado reciben los
 * músculos y pesos nuevos; los que cambió conservan sus músculos (sus secundarios siguen contando 0,5). Se añaden
 * los ejercicios del catálogo que falten y a todos los del catálogo se les pone material y tipo si no lo tenían. */
function migrateCatalog(d) {
  if (d.musclesV >= 3) return d;
  const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
  const have = new Set((d.exercises || []).map((e) => e.name.trim().toLowerCase()));
  for (const e of d.exercises || []) {
    const c = CATALOG_BY_NAME[e.name.trim().toLowerCase()]; if (!c) continue;
    const old = LEGACY_MUSCLES_V2[c.name];
    if (old && (e.primary ?? null) === old[0] && same(e.secondary || [], old[1]) && !e.sw) {
      e.primary = c.primary; e.secondary = Object.keys(c.sw); e.sw = { ...c.sw };
    }
    if (!e.kit) e.kit = c.kit;
    if (!e.joint) e.joint = c.joint;
  }
  for (const c of CATALOG) if (!have.has(c.name.toLowerCase())) d.exercises.push(defFromCatalog(c));
  d.musclesV = 3;
  return d;
}

/* ---------- Figura del cuerpo (croquis frontal y posterior) ----------
 * Cada zona se colorea según el volumen del músculo. Las formas del lado izquierdo se dibujan una vez
 * y se reflejan para el lado derecho. */
const BODY_BASE = [ // silueta neutra (no son grupos musculares)
  '<ellipse cx="100" cy="28" rx="15" ry="19"/>', '<path d="M92 44h16v14H92z"/>',
  '<path d="M68 64Q100 54 132 64L138 104Q133 150 129 182H71Q67 150 62 104Z"/>', // tronco
  '<path d="M71 178H129L133 200Q100 210 67 200Z"/>', // cadera
];
const LIMB_BASE = [ // lado izquierdo; se refleja
  '<path d="M48 80Q58 74 68 82L66 134H50Z"/>', // brazo
  '<path d="M50 132H66L60 192H46Z"/>', '<ellipse cx="52" cy="202" rx="7" ry="9"/>', // antebrazo y mano
  '<path d="M70 192H99L97 276H76Z"/>', '<path d="M76 276H96L93 352H80Z"/>', '<ellipse cx="86" cy="360" rx="10" ry="6"/>', // muslo, pierna, pie
];
const FRONT = { // [músculo, forma del lado izquierdo, ¿reflejar?]
  shapes: [
    ['trapecio', '<path d="M92 50L78 64L92 61Z"/>', true],
    ['delt_lat', '<ellipse cx="53" cy="80" rx="6" ry="10"/>', true],
    ['delt_ant', '<ellipse cx="65" cy="79" rx="8" ry="10"/>', true],
    ['pectoral', '<path d="M99 70L76 72Q67 84 71 100Q85 108 99 103Z"/>', true],
    ['biceps', '<ellipse cx="57" cy="108" rx="7.5" ry="18"/>', true],
    ['abdomen', '<path d="M86 108H114L116 168Q100 180 84 168Z"/>', false],
    ['abdomen', '<path d="M73 108H83L82 164L75 158Q72 130 73 108Z"/>', true],
    ['antebrazo', '<path d="M51 138H65L60 186H48Z"/>', true],
    ['cuadriceps', '<path d="M74 198Q71 236 77 268Q87 276 96 268Q99 232 97 200Z"/>', true],
    ['aductores', '<path d="M90 201H98L97 244Q92 236 90 216Z"/>', true],
  ],
};
const BACK = {
  shapes: [
    ['trapecio', '<path d="M100 50L82 66L100 112L118 66Z"/>', false],
    ['espalda', '<path d="M75 82Q67 112 80 150L98 140V108L84 80Z"/>', true], // dorsal
    ['espalda', '<path d="M93 114H107V170H93Z"/>', false], // lumbares
    ['delt_lat', '<ellipse cx="53" cy="80" rx="6" ry="10"/>', true],
    ['delt_post', '<ellipse cx="65" cy="79" rx="8" ry="10"/>', true],
    ['triceps', '<ellipse cx="57" cy="108" rx="7.5" ry="18"/>', true],
    ['antebrazo', '<path d="M51 138H65L60 186H48Z"/>', true],
    ['gluteos', '<ellipse cx="86" cy="196" rx="15" ry="14"/>', true],
    ['femoral', '<path d="M75 214Q72 244 78 268Q87 274 95 268Q98 242 97 216Z"/>', true],
    ['gemelos', '<ellipse cx="86" cy="302" rx="8.5" ry="21"/>', true],
  ],
};
const MIRROR = 'transform="translate(200 0) scale(-1 1)"';
function bodyLevel(v, steps) { if (!v) return 0; let l = 1; for (const t of steps) if (v >= t) l++; return Math.min(5, l); }
function bodyFigure(view, vals, steps, title) {
  const base = [...BODY_BASE, ...LIMB_BASE, ...LIMB_BASE.map((s) => s.replace(/^<(\w+)/, `<$1 ${MIRROR}`))].join('');
  const shape = ([m, s, mirror]) => {
    const lvl = bodyLevel(vals[m] || 0, steps);
    const tip = `<title>${MUSCLES[m]}: ${fmt(vals[m] || 0, 1)}</title>`;
    const g = (extra) => `<g class="mz m${lvl}" data-m="${m}" ${extra}>${tip}${s}</g>`;
    return g('') + (mirror ? g(MIRROR) : '');
  };
  return `<figure class="body-fig"><svg viewBox="0 0 200 372" role="img" aria-label="${esc(title)}">
    <g class="body-base">${base}</g>${view.shapes.map(shape).join('')}</svg><figcaption>${title}</figcaption></figure>`;
}
// steps: umbrales a partir de los cuales sube el nivel de color (5 niveles).
function bodyMapHTML(vals, { steps = [2, 4, 6, 8], unit = 'series' } = {}) {
  const legend = [`<${steps[0]}`, ...steps.slice(0, -1).map((t, i) => `${t}–${steps[i + 1]}`), `${steps[steps.length - 1]}+`];
  return `<div class="body-map">${bodyFigure(FRONT, vals, steps, 'Frontal')}${bodyFigure(BACK, vals, steps, 'Posterior')}</div>
    <div class="body-legend"><span><i class="m0"></i>0</span>${legend.map((l, k) => `<span><i class="m${k + 1}"></i>${l}</span>`).join('')}<span class="muted">${unit}</span></div>`;
}

/* ---------- Persistencia ---------- */
function seed() {
  return {
    version: 1, musclesV: 3,
    exercises: CATALOG.map(defFromCatalog),
    equipment: DEFAULT_EQUIPMENT.map((name) => ({ id: uid(), name })),
    sessions: [],
    settings: { rest: 120, dropWarn: 10, intensity: 'rpe', system: 'sets', level: 'simple' },
  };
}
/* ---------- Usuarios (perfiles locales) ----------
 * Cada usuario tiene sus propios datos (sesiones, catálogo, material, ajustes) en su clave de kv (IndexedDB).
 * El índice de perfiles guarda la lista y el usuario activo. Al primer arranque se migran los datos antiguos.
 */
const PKEY = 'diario-entreno.perfiles';
const dataKey = (id) => `diario-entreno.u.${id}`;
function loadProfiles() {
  try { const p = JSON.parse(kv.get(PKEY)); if (p && p.users && p.users.length) return p; } catch (e) { /* índice corrupto */ }
  const id = uid();
  const p = { active: id, users: [{ id, name: 'Yo', goal: '', notes: '', createdAt: Date.now() }] };
  try {
    const legacy = kv.get(KEY); // datos de versiones sin usuarios
    if (legacy) kv.set(dataKey(id), legacy);
    kv.set(PKEY, JSON.stringify(p));
  } catch (e) { /* almacenamiento no disponible */ }
  return p;
}
let profiles = loadProfiles();
const saveProfiles = () => kv.set(PKEY, JSON.stringify(profiles));
const activeUser = () => profiles.users.find((u) => u.id === profiles.active) || profiles.users[0];
function readUserData(id) {
  try { const d = JSON.parse(kv.get(dataKey(id))); if (d && d.sessions) return d; } catch (e) { /* datos corruptos */ }
  return null;
}
const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
function userColor(id) {
  let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 45%)`;
}
const avatar = (u, size = 36) => `<span class="avatar" style="background:${userColor(u.id)};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.4)}px">${esc(initials(u.name))}</span>`;

function normalize(d) {
  d.settings = { rest: 120, dropWarn: 10, intensity: 'rpe', system: 'sets', ...d.settings };
  // Descansos de la versión anterior (restSec = antes de la serie) -> rest = después de la serie anterior.
  // Los aproximados (restSrc 'auto') los calculaba la app, no el usuario: se descartan.
  for (const s of d.sessions || []) for (const e of s.exercises || []) e.sets.forEach((x, j) => {
    if (x.restSec != null && x.restSrc !== 'auto' && j > 0 && e.sets[j - 1].rest == null) e.sets[j - 1].rest = x.restSec;
    delete x.restSec; delete x.restSrc;
  });
  // Datos anteriores al modo de atleta: quien ya registraba sesiones sigue en avanzado.
  if (!d.settings.level) d.settings.level = d.sessions?.length ? 'advanced' : 'simple';
  return migrateMuscles(d);
}
const load = () => normalize(readUserData(profiles.active) || seed());
let db = load();
let saveTimer;
function save(now = false) {
  clearTimeout(saveTimer);
  const id = profiles.active, data = db; // fija el destino: un cambio de usuario no puede desviar la escritura
  const write = () => kv.set(dataKey(id), JSON.stringify(data));
  if (now) write(); else saveTimer = setTimeout(write, 250);
}
function switchUser(id) {
  if (!profiles.users.some((u) => u.id === id)) return;
  save(true);
  profiles.active = id; saveProfiles();
  db = load();
  stopTimer();
  Object.assign(ui, { openEquip: new Set(), openChart: new Set(), preOpen: {}, filterEq: 'all', search: '', csearch: '', day: todayISO(), month: todayISO().slice(0, 7) });
  if (location.hash === '#/') render(); else location.hash = '#/';
}
window.addEventListener('pagehide', () => save(true));
document.addEventListener('visibilitychange', () => { if (document.hidden) save(true); });
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

const exById = (id) => db.exercises.find((e) => e.id === id);
const eqById = (id) => db.equipment.find((e) => e.id === id);
const sessionById = (id) => db.sessions.find((s) => s.id === id);
const sortedSessions = () => [...db.sessions].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));

/* ---------- Cálculos ---------- */
// 1RM estimado (Epley), corrigiendo por repeticiones en reserva si hay RPE.
// 1RM estimado = peso / %1RM de la tabla RTS (reps 1-12, RIR 0-3,5). Fuera de rango no se calcula.
function e1rm(set) {
  if (!set.w || !set.reps) return null;
  const p = pct1rm(set);
  return p ? set.w / (p / 100) : null;
}
// Serie efectiva: no es calentamiento y, si viene de una tabla (tiene objetivo), ya está confirmada con ✓.
const isWork = (s) => s.type !== 'C' && !(s.target && !s.done);
function sessionVolume(sess) {
  let v = 0;
  for (const ex of sess.exercises) for (const s of ex.sets) if (isWork(s) && s.w && s.reps) v += s.w * s.reps;
  return v;
}
function setsText(ex, sets) {
  const mode = exById(ex.exerciseId)?.mode || 'wr';
  return sets.filter((s) => s.w != null || s.reps != null || s.time != null || s.dist != null).map((s) => {
    let t;
    if (mode === 'dist') t = `${fmt(s.dist, 0)} m` + (s.time ? ` en ${fmtSec(s.time)}` : '');
    else if (mode === 'time') t = (s.w ? `${fmt(s.w)} kg · ` : '') + `${fmtSec(s.time || 0)}`;
    else t = (mode === 'bw' ? (s.w ? `+${fmt(s.w)}` : 'PC') : fmt(s.w)) + `×${s.reps ?? '–'}`;
    if (s.rpe) t += ` @${fmt(s.rpe)}`;
    if (s.rir != null) t += ` RIR${s.rir >= 6 ? '6+' : fmt(s.rir)}`;
    if (s.type === 'C') t = `(${t})`;
    if (s.type === 'D') t += ' D';
    return t;
  }).join(', ');
}
// Ejercicio anterior (misma exerciseId) en una sesión anterior a la dada.
function previousEntry(exerciseId, sess) {
  for (const s of sortedSessions()) {
    if (s.id === sess.id) continue;
    if ((s.date + s.createdAt) > (sess.date + sess.createdAt)) continue;
    const e = s.exercises.find((x) => x.exerciseId === exerciseId);
    if (e && e.sets.length) return { sess: s, entry: e };
  }
  return null;
}
function historyFor(exerciseId) {
  const out = [];
  for (const s of sortedSessions()) for (const e of s.exercises) if (e.exerciseId === exerciseId) out.push({ sess: s, entry: e });
  return out;
}
/* ---------- Router ---------- */
const ui = { openEquip: new Set(), openChart: new Set(), preOpen: {}, filterEq: 'all', search: '', csearch: '', day: todayISO(), month: todayISO().slice(0, 7) };
function route() {
  const h = location.hash.replace(/^#\/?/, '').split('/');
  return { name: h[0] || 'sessions', id: h[1] };
}
function render() {
  const r = route();
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('active',
    a.dataset.tab === (['session', 'templates', 'template', 'meso'].includes(r.name) ? 'sessions' : r.name === 'users' ? 'settings' : ['exercise', 'analysis', 'report'].includes(r.name) ? 'exercises' : r.name)));
  const app = $('#app');
  const view = { sessions: viewCalendar, session: viewSession, exercises: viewExercises, exercise: viewExercise, analysis: viewAnalysis, settings: viewSettings, users: viewUsers, report: viewReport, records: () => (window.viewRecords ? viewRecords() : ''), meso: (id) => (window.viewMeso ? viewMeso(id) : ''), templates: () => (window.viewTemplates ? viewTemplates() : ''), template: (id) => (window.viewTemplate ? viewTemplate(id) : '') }[r.name] || viewCalendar;
  const u = activeUser();
  const bar = r.name === 'users' || r.name === 'report' ? '' : `<div class="userbar"><button class="userchip" data-action="go-users" aria-label="Usuario activo: ${esc(u.name)}. Cambiar de usuario">${avatar(u, 26)}<span>${esc(u.name)}</span><span class="muted">▾</span></button></div>`;
  app.innerHTML = bar + view(r.id);
  if (r.name === 'settings' && window.fillVideoStats) fillVideoStats();
  if (r.name === 'settings' && window.fillSnapList) fillSnapList();
  if (r.name === 'settings' && window.fillStorageInfo) fillStorageInfo();
}
function rerender() { const y = scrollY; render(); scrollTo(0, y); }
// Al cambiar de pantalla (también con «atrás») se cierra cualquier ventana abierta.
window.addEventListener('hashchange', () => { if (modal.open) modal.close(); render(); scrollTo(0, 0); });

/* ---------- Vistas ---------- */
/* ---------- Métricas por tipo de ejercicio ---------- */
const maxOf = (arr) => { const v = arr.filter((x) => x != null && x > 0); return v.length ? Math.max(...v) : null; };
const METRIC = {
  wr: { label: '1RM est.', unit: 'kg', best: (sets) => maxOf(sets.map(e1rm)), vol: (s) => (s.w || 0) * (s.reps || 0), volUnit: 'kg' },
  bw: { label: 'Máx. reps', unit: 'reps', best: (sets) => maxOf(sets.map((s) => s.reps)), vol: (s) => s.reps || 0, volUnit: 'reps' },
  time: { label: 'Mejor tiempo', unit: 's', best: (sets) => maxOf(sets.map((s) => s.time)), vol: (s) => s.time || 0, volUnit: 's' },
  dist: { label: 'Mejor distancia', unit: 'm', best: (sets) => maxOf(sets.map((s) => s.dist)), vol: (s) => s.dist || 0, volUnit: 'm' },
};
function entryStats(entry) {
  const mode = exById(entry.exerciseId)?.mode || 'wr';
  const m = METRIC[mode] || METRIC.wr;
  const work = entry.sets.filter(isWork);
  return {
    mode, m, best: m.best(work), vol: work.reduce((a, s) => a + m.vol(s), 0), sets: work.length,
    topW: maxOf(work.map((s) => s.w)), reps: work.reduce((a, s) => a + (s.reps || 0), 0),
  };
}
const fmtM = (v, m, unit = m.unit) => v == null ? '–' : unit === 's' ? fmtSec(v) : `${fmt(v)} ${unit}`;
function delta(now, before) {
  if (!now || !before) return '';
  const p = (now / before - 1) * 100;
  if (Math.abs(p) < 0.5) return '<small class="delta">=</small>';
  return `<small class="delta ${p > 0 ? 'up' : 'down'}">${p > 0 ? '▲' : '▼'}${fmt(Math.abs(p), 0)}%</small>`;
}
/* ---------- Fatiga ----------
 * Caída de rendimiento entre series: e1RM (corregido por RIR/RPE) de la serie frente a la mejor serie
 * efectiva anterior del mismo ejercicio en la sesión. No necesita sensor; depende de un RIR/RPE honesto.
 */
const INTENSITY = { rpe: 'RPE', rir: 'RIR', both: 'RPE + RIR' };
const intensityOf = (def) => def?.intensity || db.settings.intensity || 'rpe';
const isSimple = () => db.settings.level === 'simple';
const LEVELS = { simple: 'Sencillo', advanced: 'Avanzado' };
// Modo sencillo: la intensidad se registra siempre con RIR.
const intensityFields = (def) => isSimple() ? ['rir'] : ({ rpe: ['rpe'], rir: ['rir'], both: ['rpe', 'rir'] }[intensityOf(def)]);
// RPE y RIR no cuadran (escala RPE ≈ 10 − RIR). Solo en la zona donde la escala es fiable.
function rpeRirMismatch(set) {
  if (set.rpe == null || set.rir == null) return null;
  if (set.rpe < 7 && set.rir > 3) return null;
  const d = set.rpe - (10 - set.rir);
  return Math.abs(d) >= 1 ? d : null;
}
// Caída del e1RM de la serie j respecto a la mejor serie efectiva anterior del mismo ejercicio.
/* Coherencia del RIR: si una serie posterior del mismo ejercicio rinde bastante más (1RM estimado ≥ 5 % mayor, unas
 * 2 repeticiones con cargas de 6-10) que una anterior, aunque llega con más fatiga, lo más probable es que en la anterior
 * quedaran más repeticiones de las anotadas. Solo compara series con RIR (o RPE) anotado y dentro de la tabla RTS. */
const RIR_JUMP = 5;
function rirCheck(sets, j) {
  const cur = sets[j];
  if (!isWork(cur) || rirOf(cur) == null) return null;
  const now = e1rm(cur); if (!now) return null;
  let worst = null;
  sets.slice(0, j).forEach((x, k) => {
    if (!isWork(x) || rirOf(x) == null) return;
    const e = e1rm(x); if (!e) return;
    const jump = (now / e - 1) * 100;
    if (jump >= RIR_JUMP && (!worst || jump > worst.jump)) worst = { k, jump, set: x };
  });
  if (!worst) return null;
  // RIR con el que la serie anterior daría el mismo 1RM que esta (el más cercano de la tabla).
  let implied = null, diff = Infinity;
  for (let r = 0; r <= 10; r++) {
    const p = RTS[(worst.set.reps + r - 1) * 2]; if (p == null) break;
    const d = Math.abs(worst.set.w / (p / 100) - now); if (d < diff) { diff = d; implied = r; }
  }
  return { ...worst, implied: implied != null && implied > rirOf(worst.set) ? implied : null };
}
function setDrop(sets, j) {
  const cur = sets[j];
  if (!isWork(cur)) return null;
  const now = e1rm(cur);
  const prev = maxOf(sets.slice(0, j).filter(isWork).map(e1rm));
  if (!now || !prev) return null;
  return ((prev - now) / prev) * 100;
}
function sessionFatigue(s) {
  const drops = [];
  let nearFail = 0;
  for (const e of s.exercises) {
    e.sets.forEach((x, j) => {
      if (!isWork(x)) return;
      const d = setDrop(e.sets, j); if (d != null) drops.push(d);
      if (x.type === 'F' || x.rir === 0 || (x.rpe && x.rpe >= 9.5)) nearFail++;
    });
  }
  return { drops, nearFail, dropHigh: drops.filter((d) => d >= db.settings.dropWarn).length };
}

/* ---------- Análisis: factores frente a rendimiento ----------
 * Rendimiento relativo de una sesión = media, sobre sus ejercicios con 1RM estimado, de
 * (1RM est. del día / mediana del 1RM est. de ese ejercicio en ±6 semanas, sin contar ese día) − 1.
 * Comparar con la mediana de las semanas cercanas descuenta la tendencia de progreso a largo plazo.
 */
const median = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const sd = (a) => { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
const WINDOW_DAYS = 42;

function relativePerformance() {
  const byEx = {};
  for (const s of db.sessions) for (const e of s.exercises) {
    if ((exById(e.exerciseId)?.mode || 'wr') !== 'wr') continue;
    const best = entryStats(e).best;
    if (best) (byEx[e.exerciseId] = byEx[e.exerciseId] || []).push({ sid: s.id, t: Date.parse(s.date), best });
  }
  const acc = {};
  for (const items of Object.values(byEx)) for (const it of items) {
    const near = items.filter((o) => o.sid !== it.sid && Math.abs(o.t - it.t) <= WINDOW_DAYS * 864e5).map((o) => o.best);
    if (near.length < 2) continue;
    (acc[it.sid] = acc[it.sid] || []).push((it.best / median(near) - 1) * 100);
  }
  const out = {};
  for (const [sid, arr] of Object.entries(acc)) out[sid] = mean(arr);
  return out;
}
function compareGroups(a, b) {
  const ma = mean(a), mb = mean(b);
  if (ma == null || mb == null) return { diff: null, na: a.length, nb: b.length };
  const sa = sd(a), sb = sd(b);
  const se = sa != null && sb != null ? Math.sqrt(sa ** 2 / a.length + sb ** 2 / b.length) : null;
  const diff = ma - mb;
  let verdict;
  if (a.length < 3 || b.length < 3 || se == null) verdict = 'pocos';
  else if (Math.abs(diff) > 2 * se) verdict = diff < 0 ? 'peor' : 'mejor';
  else verdict = 'nada';
  return { diff, se, na: a.length, nb: b.length, verdict };
}
const VERDICT = {
  pocos: ['muted', 'Pocos datos'], nada: ['muted', 'Sin diferencia clara'],
  peor: ['down', 'Rindes peor'], mejor: ['up', 'Rindes mejor'],
};
function divBar(v, scale = 10) {
  if (v == null) return '<div class="dbar"></div>';
  const w = Math.min(50, (Math.abs(v) / scale) * 50);
  return `<div class="dbar"><i class="${v < 0 ? 'neg' : 'pos'}" style="width:${w}%;${v < 0 ? `right:50%` : `left:50%`}"></i></div>`;
}
const pct = (v) => v == null ? '–' : `${v > 0 ? '+' : ''}${fmt(v, 1)}%`;

function viewFactors() {
  const rel = relativePerformance();
  const sess = db.sessions.filter((s) => rel[s.id] != null);
  let html = `<h2>Factores y rendimiento ${info('rel_perf')}</h2>
    <div class="card muted small">
      <b>Cómo se calcula.</b> Para cada ejercicio con peso, el 1RM estimado del día se compara con la mediana ${info('median')} de ese ejercicio en las
      ${WINDOW_DAYS / 7} semanas de alrededor (sin contar ese día), y así se descuenta tu progresión. La sesión recibe la media de sus ejercicios.
      Un −3% quiere decir que ese día rendiste un 3% por debajo de lo normal para ti en esas fechas.<br><br>
      «Rindes peor/mejor» aparece solo si la diferencia supera 2 errores estándar (≈ IC 95%) y hay al menos 3 sesiones en cada grupo.
      Es <b>correlación, no causa</b>: «dormí mal» puede coincidir con días de más estrés, o lo marcas <i>porque</i> la sesión fue mal.
      Para que tenga valor, marca los factores <b>antes</b> de entrenar.
    </div>`;
  if (sess.length < 6) {
    return html + `<div class="empty">Hacen falta más datos: hay ${sess.length} sesiones analizables.<br>
      Una sesión es analizable cuando sus ejercicios con peso aparecen al menos 2 veces más en las ${WINDOW_DAYS / 7} semanas de alrededor.
      Apunta el RPE o el RIR en las series para que el 1RM estimado sea fiable.</div>`;
  }
  const all = sess.map((s) => rel[s.id]);
  html += `<div class="card"><div class="stats">
    <div class="stat"><b>${sess.length}</b><span>sesiones analizadas</span></div>
    <div class="stat"><b>±${fmt(sd(all), 1)}%</b><span>variación típica entre días ${info('se')}</span></div>
  </div></div>`;

  // Factores marcados
  const rows = FACTORS.map((f) => {
    const a = sess.filter((s) => (s.factors || []).includes(f)).map((s) => rel[s.id]);
    const b = sess.filter((s) => !(s.factors || []).includes(f)).map((s) => rel[s.id]);
    return { f, ...compareGroups(a, b) };
  }).filter((r) => r.na > 0).sort((x, y) => (x.diff ?? 0) - (y.diff ?? 0));
  html += `<h2>Factores marcados ${info('causation')}</h2><div class="card">`;
  html += rows.length ? rows.map((r) => {
    const [cls, txt] = VERDICT[r.verdict];
    return `<div class="arow"><div><b>${esc(r.f)}</b><div class="muted small">con: ${r.na} · sin: ${r.nb}</div></div>
      ${divBar(r.diff)}<div class="aval"><b>${pct(r.diff)}</b><small class="delta ${cls}">${txt}${r.se ? ` ±${fmt(2 * r.se, 1)}` : ''}</small></div></div>`;
  }).join('') : '<div class="muted">Aún no has marcado factores en sesiones analizables.</div>';
  html += `</div>`;

  // Escalas numéricas
  // Datos diarios del día ANTERIOR a la sesión (los del mismo día incluyen la propia sesión o se anotan después).
  const prevDay = (s) => window.dailyOf ? dailyOf(isoFromNum(dayNum(s.date) - 1)) : null;
  const kcalAll = Object.values(db.daily || {}).map((d) => d.kcal).filter((v) => v != null), kcalMean = kcalAll.length ? mean(kcalAll) : null;
  const scales = [
    ['Horas de sueño', (s) => s.sleep, [['< 6 h', (v) => v < 6], ['6 – 7,5 h', (v) => v >= 6 && v < 7.5], ['≥ 7,5 h', (v) => v >= 7.5]]],
    ['Energía al empezar', (s) => s.readiness, [['Baja (1-2)', (v) => v <= 2], ['Media (3)', (v) => v === 3], ['Alta (4-5)', (v) => v >= 4]]],
    ['Estrés', (s) => s.stress, [['Bajo (1-2)', (v) => v <= 2], ['Medio (3)', (v) => v === 3], ['Alto (4-5)', (v) => v >= 4]]],
    ['Pasos del día anterior', (s) => prevDay(s)?.steps, [['< 5.000', (v) => v < 5000], ['5.000 – 10.000', (v) => v >= 5000 && v < 10000], ['≥ 10.000', (v) => v >= 10000]]],
    ['Calorías del día anterior (frente a tu media)', (s) => kcalMean && prevDay(s)?.kcal != null ? prevDay(s).kcal / kcalMean * 100 : null,
      [['Menos del 90 %', (v) => v < 90], ['90 – 110 %', (v) => v >= 90 && v <= 110], ['Más del 110 %', (v) => v > 110]]],
  ];
  for (const [title, get, buckets] of scales) {
    const withVal = sess.filter((s) => get(s) != null);
    if (!withVal.length && /día anterior/.test(title)) continue; // sin datos diarios: no se muestra
    html += `<h2>${title}</h2><div class="card">`;
    if (withVal.length < 3) { html += `<div class="muted small">Registrado en ${withVal.length} sesiones analizables; hacen falta más.</div></div>`; continue; }
    for (const [label, test] of buckets) {
      const v = withVal.filter((s) => test(get(s))).map((s) => rel[s.id]);
      const m = mean(v), s2 = sd(v);
      html += `<div class="arow"><div><b>${label}</b><div class="muted small">n = ${v.length}</div></div>
        ${divBar(m)}<div class="aval"><b>${pct(m)}</b>${s2 != null && v.length >= 3 ? `<small class="muted">±${fmt(2 * s2 / Math.sqrt(v.length), 1)}</small>` : ''}</div></div>`;
    }
    html += `</div>`;
  }

  // Peso corporal frente a rendimiento (correlación de Pearson)
  const bw = sess.filter((s) => s.bodyweight);
  if (bw.length >= 6) {
    const xs = bw.map((s) => s.bodyweight), ys = bw.map((s) => rel[s.id]);
    const mx = mean(xs), my = mean(ys);
    const r = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / Math.sqrt(xs.reduce((a, x) => a + (x - mx) ** 2, 0) * ys.reduce((a, y) => a + (y - my) ** 2, 0) || 1);
    html += `<h2>Peso corporal ${info('corr')}</h2><div class="card"><b>r = ${fmt(r, 2)}</b> <span class="muted small">(n = ${bw.length}).
      ${Math.abs(r) < 0.3 ? 'Relación débil o nula.' : r > 0 ? 'Con más peso corporal tiendes a rendir más.' : 'Con más peso corporal tiendes a rendir menos.'}</span></div>`;
  }
  return html;
}

/* ---------- Intensidad relativa (tabla RTS de Tuchscherer) ----------
 * %1RM según repeticiones (1-12) y RPE 10…6,5 (RIR 0…3,5). En la tabla RTS el % depende solo de
 * reps + RIR (bajar 1 punto de RPE equivale a 1 repetición más), así que se guarda como una serie:
 * índice = (reps + RIR − 1) × 2. Celdas contrastadas: 1@10=100, 1@9,5=97,8, 1@9=95,5, 2@10=95,5,
 * 3@10=92,2, 5@10=86,3, 5@8=81,1. Fuera de 1-12 reps o de RIR 0-3,5 no se calcula.
 */
const RTS = [100, 97.8, 95.5, 93.9, 92.2, 90.7, 89.2, 87.8, 86.3, 85.0, 83.7, 82.4, 81.1, 79.9, 78.6,
  77.4, 76.2, 75.1, 73.9, 72.3, 70.7, 69.4, 68.0, 66.7, 65.3, 64.0, 62.6, 61.3, 59.9, 58.6];
// Botón ⓘ usable dentro del propio glosario (no consulta GLOSSARY, que aún no existe al definirse).
const infoBtn = (k) => `<button class="info" data-action="info" data-k="${k}" aria-label="Más información">i</button>`;
const rirOf = (set) => set.rir != null ? set.rir : set.rpe ? Math.max(0, 10 - set.rpe) : null;
function pct1rm(set) {
  const reps = set.reps, rir = rirOf(set) ?? 0; // sin RPE/RIR se asume serie al fallo
  if (!reps || reps < 1 || reps > 12 || !Number.isInteger(reps) || rir > 3.5 || (rir * 2) % 1) return null;
  return RTS[(reps + rir - 1) * 2] ?? null;
}
function rtsTableHTML() {
  const rirs = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5];
  let h = '<div class="gt-wrap"><table class="gt rts"><tr><th>Reps</th>' + rirs.map((r) => `<th>RPE ${fmt(10 - r)}<br><small>RIR ${fmt(r)}</small></th>`).join('') + '</tr>';
  for (let n = 1; n <= 12; n++) h += `<tr><td>${n}</td>${rirs.map((r) => `<td>${fmt(RTS[(n + r - 1) * 2])}</td>`).join('')}</tr>`;
  return h + '</table></div>';
}

/* ---------- Índice de estrés (Stress Index) ----------
 * Valor por serie efectiva según RIR y tipo de ejercicio (concepto de M. Tuchscherer; tabla
 * difundida por PowerExplosive/Vitónica): multiarticular 1,4 − 0,2·RIR; monoarticular 1,3 − 0,2·RIR
 * (RIR 0-5). Decisiones de la app: RIR > 5 suma 0; sin RPE/RIR la serie no se cuenta (se avisa).
 */
const SYSTEMS = { sets: 'Series y volumen', si: 'Índice de estrés' };
const JOINT = { multi: 'Multiarticular', mono: 'Monoarticular' };
const MONO_DEFAULT = ['Curl femoral', 'Extensión de cuádriceps', 'Aperturas', 'Face pull', 'Curl de bíceps', 'Extensión de tríceps', 'Elevación de piernas', 'Elevaciones laterales', 'Pájaros', 'Elevación de gemelos'];
const jointOf = (def) => def?.joint || (['biceps', 'triceps'].includes(def?.primary) || MONO_DEFAULT.includes(def?.name) ? 'mono' : 'multi');
const systemOf = (s) => isSimple() ? 'sets' : (s.system || db.settings.system || 'sets');
function stressIndex(set, def) {
  if (!isWork(set) || !['wr', 'bw'].includes(def?.mode || 'wr')) return null;
  const r = rirOf(set);
  if (r == null) return null;
  if (r > 5) return 0;
  return Math.max(0, (jointOf(def) === 'mono' ? 1.3 : 1.4) - 0.2 * r);
}
function entrySI(entry) {
  const def = exById(entry.exerciseId);
  let si = 0, counted = 0, missing = 0;
  for (const s of entry.sets) {
    if (!isWork(s) || !['wr', 'bw'].includes(def?.mode || 'wr')) continue;
    if (!s.reps && !s.w) continue;
    const v = stressIndex(s, def);
    if (v == null) missing++; else { si += v; counted++; }
  }
  return { si, counted, missing };
}
function sessionSI(s) {
  let total = 0, missing = 0;
  for (const e of s.exercises) { const r = entrySI(e); total += r.si; missing += r.missing; }
  return { total, byCat: sessionMuscles(s, 'si'), missing }; // byCat: IE por músculo (principal 1, secundario 0,5)
}
const pctTxt = (set) => { const p = pct1rm(set); return p ? `${Math.round(p)}%` : set.reps > 12 ? '>12 rep' : (rirOf(set) ?? 0) > 3.5 ? 'RIR>3,5' : ''; };
const siTxt = (set, def) => { const v = stressIndex(set, def); return v == null ? (isWork(set) && (set.reps || set.w) ? 'sin RIR' : '') : `IE ${fmt(v, 1)}`; };

/* ---------- Análisis: carga semanal e intensidad ---------- */
/* Microciclo del atleta (Ajustes › Microciclo): día de inicio y duración. Por defecto, lunes a domingo (7 días).
 * Con una duración distinta de 7 es un microciclo: empieza en la fecha de referencia y se repite cada N días. */
const DOW = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DOW1 = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const dayNum = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
const isoFromNum = (n) => new Date(n * 864e5).toISOString().slice(0, 10);
const cycleLen = () => db.settings.weekLen || 7;
const cycleDow = () => db.settings.weekDow ?? 1; // 0 = domingo … 6 = sábado
const isCustomCycle = () => cycleLen() !== 7;
const cycleWord = (pl) => isCustomCycle() ? (pl ? 'ciclos' : 'ciclo') : (pl ? 'semanas' : 'semana');
// 1/1/2024 fue lunes: con 7 días se ancla en el día de la semana elegido; si no, en la fecha de referencia.
function cycleAnchor() {
  if (!isCustomCycle()) return dayNum('2024-01-01') + ((cycleDow() - 1 + 7) % 7);
  return dayNum(db.settings.cycleAnchor || '2024-01-01');
}
function weekStart(iso) {
  const len = cycleLen(), a = cycleAnchor(), n = dayNum(iso);
  return isoFromNum(a + Math.floor((n - a) / len) * len);
}
const weekEnd = (w) => isoFromNum(dayNum(w) + cycleLen() - 1);
function lastWeeks(n) {
  const out = [], start = dayNum(weekStart(todayISO())), len = cycleLen();
  for (let i = n - 1; i >= 0; i--) out.push(isoFromNum(start - i * len));
  return out;
}
function weeklyData(n = 12) {
  const weeks = lastWeeks(n);
  const data = Object.fromEntries(weeks.map((w) => [w, { si: 0, sets: 0, byCat: {}, setsCat: {}, missing: 0, pcts: [], sessions: 0 }]));
  for (const s of db.sessions) {
    const w = data[weekStart(s.date)]; if (!w) continue;
    w.sessions++;
    const r = sessionSI(s);
    w.si += r.total; w.missing += r.missing;
    for (const [c, v] of Object.entries(r.byCat)) w.byCat[c] = (w.byCat[c] || 0) + v;
    for (const e of s.exercises) {
      const def = exById(e.exerciseId);
      for (const x of e.sets.filter(isWork)) {
        w.sets++; addShares(w.setsCat, def, 1);
        if ((def?.mode || 'wr') === 'wr') { const p = pct1rm(x); if (p) w.pcts.push(p); }
      }
    }
  }
  return { weeks, data };
}
const wkLabel = (w) => new Date(w + 'T12:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

function viewLoad() {
  const { weeks, data } = weeklyData(12);
  const cur = data[weeks[weeks.length - 1]], prev = data[weeks[weeks.length - 2]], prev2 = data[weeks[weeks.length - 3]];
  // La semana actual está incompleta: la variación se calcula entre las dos últimas semanas cerradas.
  let html = `<div class="card"><div class="stats">
      <div class="stat"><b>${fmt(cur.si, 1)}</b><span>IE esta semana (en curso) ${info('stress_index')}</span></div>
      <div class="stat"><b>${fmt(prev.si, 1)} ${delta(prev.si, prev2.si)}</b><span>IE semana pasada (vs. anterior)</span></div>
      <div class="stat"><b>${cur.sets}</b><span>series efectivas ${info('work_sets')}</span></div>
      <div class="stat"><b>${cur.sessions}</b><span>sesiones</span></div>
    </div>
    ${cur.missing ? `<div class="mismatch" style="margin-top:8px">${cur.missing} series de esta semana sin RPE ni RIR: no suman al índice de estrés.</div>` : ''}
    </div>`;
  const pts = weeks.map((w) => ({ d: w, v: data[w].si }));
  if (pts.filter((p) => p.v).length >= 2) html += `<h2>Índice de estrés semanal ${info('weekly_load')}</h2><div class="card">${chart(pts)}</div>`;
  else html += `<div class="empty">Registra RPE o RIR durante al menos 2 semanas para ver la evolución.</div>`;

  const last4 = weeks.slice(-4);
  const done = weeks[weeks.length - 2]; // última semana completa
  if (Object.keys(data[done].setsCat).length) {
    html += `<h2>Músculos · semana del ${wkLabel(done)} ${info('muscle_volume')}</h2><div class="card">
      ${bodyMapHTML(data[done].setsCat, { steps: [5, 10, 15, 20], unit: 'series / semana' })}
      <div class="muted small" style="margin-top:6px">Series efectivas de la última semana completa (principal 1, secundario 0,5).</div></div>`;
  }
  const cats = MUSCLE_KEYS.filter((c) => last4.some((w) => data[w].byCat[c] || data[w].setsCat[c]));
  if (cats.length) {
    html += `<h2>Por músculo (últimas 4 semanas)</h2><div class="card gt-wrap"><table class="gt wtable">
      <tr><th>Músculo</th>${last4.map((w) => `<th>${wkLabel(w)}</th>`).join('')}</tr>
      ${cats.map((c) => `<tr><td>${MUSCLES[c]}</td>${last4.map((w) => `<td><b>${data[w].byCat[c] ? fmt(data[w].byCat[c], 1) : '–'}</b><br><small class="muted">${fmt(data[w].setsCat[c] || 0, 1)} series</small></td>`).join('')}</tr>`).join('')}
    </table><div class="muted small" style="margin-top:6px">Arriba, índice de estrés; abajo, series efectivas. Principal 1, secundario 0,5.</div></div>`;
  }
  return html;
}

const ZONES = [['< 70%', (p) => p < 70], ['70-79%', (p) => p >= 70 && p < 80], ['80-89%', (p) => p >= 80 && p < 90], ['≥ 90%', (p) => p >= 90]];
function viewIntensity() {
  const { weeks, data } = weeklyData(12);
  const recent = weeks.slice(-4).flatMap((w) => data[w].pcts);
  let html = `<div class="card muted small">Intensidad relativa de cada serie efectiva con peso, según la tabla RTS ${info('rts')}: repeticiones de 1 a 12 con RIR de 0 a 3,5.
    Las series fuera de ese rango no tienen %1RM.</div>`;
  if (!recent.length) return html + '<div class="empty">Sin series con %1RM calculable en las últimas 4 semanas.</div>';
  html += `<div class="card"><div class="stats">
      <div class="stat"><b>${fmt(mean(recent), 1)}%</b><span>%1RM medio (4 sem.) ${info('pct1rm')}</span></div>
      <div class="stat"><b>${recent.length}</b><span>series con %1RM</span></div>
    </div></div>
    <h2>Distribución por zonas (4 semanas) ${info('zones')}</h2><div class="card">${bars(ZONES.map(([label, t]) => ({ label, v: recent.filter(t).length })), ' series')}</div>`;
  const pts = weeks.map((w) => ({ d: w, v: mean(data[w].pcts) })).filter((p) => p.v);
  if (pts.length >= 2) html += `<h2>%1RM medio por semana</h2><div class="card">${chart(pts)}</div>`;
  return html;
}

function viewAnalysis() {
  const tab = ui.atab || 'factors';
  const tabs = { factors: 'Factores', load: 'Carga (IE)', intensity: 'Intensidad' };
  const body = { factors: viewFactors, load: viewLoad, intensity: viewIntensity }[tab]();
  return `<div class="row"><a class="btn ghost" href="#/exercises">‹ Progreso</a></div>
    <h1>Análisis</h1>
    <div class="seg">${Object.entries(tabs).map(([k, v]) => `<button class="${k === tab ? 'on' : ''}" data-action="atab" data-t="${k}">${v}</button>`).join('')}</div>
    ${body}`;
}

/* ---------- Glosario: iconos ⓘ junto a términos técnicos ---------- */
const GLOSSARY = {
  rpe: ['RPE · Esfuerzo percibido', `
    <p><b>RPE</b> (<i>Rating of Perceived Exertion</i>) puntúa de 1 a 10 lo dura que ha sido una serie. En fuerza se usa la versión basada en las repeticiones que te quedaban (Zourdos et al., 2016):</p>
    <table class="gt"><tr><th>RPE</th><th>Significado</th></tr>
      <tr><td>10</td><td>Máximo: no podías hacer ni una rep más ni subir peso</td></tr>
      <tr><td>9,5</td><td>No podías otra rep, pero quizá sí algo más de peso</td></tr>
      <tr><td>9</td><td>Te quedaba 1 rep</td></tr>
      <tr><td>8,5</td><td>Quizá 2, seguro 1</td></tr>
      <tr><td>8</td><td>Te quedaban 2 reps</td></tr>
      <tr><td>7</td><td>Te quedaban 3 reps</td></tr>
      <tr><td>≤ 6</td><td>4 o más; esfuerzo ligero o moderado</td></tr></table>
    <p>Además de la cercanía al fallo, recoge sensaciones globales: respiración, molestias, dificultad técnica. Por eso a veces no cuadra exactamente con el RIR.</p>`],
  rir: ['RIR · Repeticiones en reserva', `
    <p><b>RIR</b> (<i>Repetitions In Reserve</i>) es cuántas repeticiones más podrías haber hecho <b>con buena técnica</b>. RIR 0 = fallo; RIR 2 = te quedaban dos.</p>
    <p><b>Precisión:</b> se estima mejor cerca del fallo y en series de pocas repeticiones. Lejos del fallo (RIR 4 o más) o en series largas se suele <b>infraestimar</b>: crees que te quedan menos de las que en realidad te quedan. Mejora con la práctica; de vez en cuando, comprueba tu estimación llevando una serie segura al fallo.</p>`],
  intensity: ['RPE, RIR o ambos', `
    <p>Puedes medir la intensidad de cada ejercicio de tres formas; la app recuerda la elegida para ese ejercicio:</p>
    <ul><li><b>RPE</b>: esfuerzo percibido (1-10).</li><li><b>RIR</b>: repeticiones que te quedaban.</li>
    <li><b>RPE + RIR</b>: los dos. Si rellenas uno, la app propone el otro con la equivalencia <b>RPE ≈ 10 − RIR</b>.</li></ul>
    <p><b>¿Para qué los dos?</b> El RIR mide lo cerca que estás del fallo muscular; el RPE, el esfuerzo global. Si no cuadran (p. ej. RPE 9 con RIR 3), la discrepancia es un dato: puede indicar fatiga general (cardiovascular, sueño), molestias, técnica exigente o que estás estimando mal el RIR.</p>
    <p>Para el 1RM estimado tiene prioridad el <b>RIR</b>; si no hay, se usa 10 − RPE.</p>`],
  e1rm: ['1RM estimado', `
    <p>El <b>1RM</b> es el peso máximo que podrías levantar una vez. Aquí se <b>estima</b> sin probarlo: se busca en la tabla RTS ${infoBtn('rts')} qué %1RM corresponde a tus repeticiones y RIR, y se divide el peso entre ese porcentaje.</p>
    <p class="formula">1RM ≈ peso / %1RM(reps, RIR)</p>
    <p>Ejemplo: 100 kg × 5 con RIR 2 → la tabla da 81,1% → 100 / 0,811 ≈ 123 kg.</p>
    <p><b>Solo se calcula entre 1 y 12 repeticiones y con RIR de 0 a 3,5</b> (RPE 6,5-10): fuera de ese rango la estimación deja de ser fiable. Si no apuntas RPE ni RIR, se asume que llegaste al fallo. <b>No sirve para movimientos de halterofilia</b>, donde la técnica y la velocidad limitan más que la fuerza.</p>`],
  pr: ['Récord estimado', `<p>La serie da un <b>1RM estimado superior</b> a cualquiera de sesiones anteriores de este ejercicio. No es un récord real de 1 repetición, sino una mejora de tu capacidad estimada.</p>`],
  volume: ['Volumen (tonelaje)', `
    <p>Suma de <b>peso × repeticiones</b> de las series efectivas (sin calentamiento). En ejercicios de peso corporal se cuentan repeticiones; en los de tiempo, segundos; en los de distancia, metros.</p>
    <p><b>Limitación:</b> no tiene en cuenta lo cerca del fallo que estuviste. Para hipertrofia, el número de <b>series efectivas</b> cercanas al fallo por grupo muscular suele ser mejor indicador que los kilos totales.</p>`],
  work_sets: ['Series efectivas', `<p>Todas las series salvo las de <b>calentamiento</b>. Son las que cuentan para volumen, récords y fatiga.</p>`],
  set_types: ['Tipos de serie', `
    <p>Toca el número de la serie para cambiar su tipo:</p>
    <ul><li><b>1, 2, 3…</b> Efectiva: serie de trabajo normal.</li>
    <li><b>C</b> Calentamiento: no cuenta para volumen, récords ni fatiga.</li>
    <li><b>D</b> Drop set: serie que sigue a otra sin descanso, bajando el peso.</li>
    <li><b>F</b> Al fallo: llevada hasta no poder completar otra repetición.</li></ul>`],
  rir_check: ['¿RIR bien anotado?', `
    <p>Con la fatiga, cada serie de un ejercicio suele rendir igual o algo menos que la anterior. Si una serie posterior rinde <b>bastante más</b> (su 1RM estimado es un 5 % mayor o más, unas 2 repeticiones), lo más probable es que en la serie anterior <b>te quedaran más repeticiones de las que anotaste</b>.</p>
    <p>Es normal: calcular el RIR se aprende. Los estudios (p. ej. Halperin et al., 2022) encuentran que se falla de media en algo más de 1 repetición, sobre todo lejos del fallo y con poca experiencia.</p>
    <p>Si lo ves claro, corrige el RIR de la serie anterior: afecta al 1RM estimado, a si cuenta como serie efectiva (RIR ≤ 4) y al peso sugerido. Otras causas posibles: la primera fue de aproximación (márcala como calentamiento), cambiaste de agarre, técnica o máquina, o descansaste mucho más.</p>`],
  drop: ['Caída de rendimiento', `
    <p>Compara el <b>1RM estimado de esta serie</b> con el de tu <b>mejor serie efectiva anterior</b> del mismo ejercicio en la sesión. Si cae más del umbral (por defecto 10%), es probable que la fatiga se esté acumulando.</p>
    <p>Ejemplo: serie 1 → 120 kg estimados; serie 3 → 105 kg estimados → caída del 12,5%.</p>
    <p><b>Fiabilidad:</b> depende totalmente de que apuntes RPE o RIR con honestidad. Mide la fatiga <i>entre</i> series, no dentro de la serie. Una caída puede ser buscada (series de volumen tras una pesada); el aviso es información, no una orden.</p>`],
  near_fail: ['Series al fallo o cerca', `<p>Series marcadas como <b>F</b>, con <b>RIR 0</b> o con <b>RPE ≥ 9,5</b>. Muchas en una misma sesión elevan la fatiga y el tiempo de recuperación, sin que eso suponga necesariamente más ganancias.</p>`],
  srpe: ['RPE de la sesión (sRPE)', `
    <p>Valoración del esfuerzo <b>global</b> de toda la sesión (1-10), idealmente unos 30 minutos después de terminar (método de Foster, 2001).</p>
    <p>Multiplicado por la duración da la <b>carga interna</b> en unidades arbitrarias (UA): 60 min × sRPE 7 = 420 UA. Sirve para comparar sesiones de tipos distintos y vigilar cambios bruscos de carga semana a semana.</p>`],
  load: ['Carga interna (UA)', `<p><b>sRPE × minutos</b> de sesión, en unidades arbitrarias (UA). Combina cuánto duró y lo dura que fue. Su valor absoluto importa poco: es útil para comparar entre sesiones y semanas tuyas.</p>`],
  readiness: ['Energía al empezar (readiness)', `<p>Cómo de preparado te sientes antes de entrenar, de 1 (muy bajo) a 5 (muy alto). Es subjetivo, pero en el análisis de factores se cruza con tu rendimiento real para ver si te sirve como predictor.</p>`],
  templates: ['Tablas de ejercicios', `
    <p>Plantillas de sesión: ejercicios con sus series y lo que hay que hacer en cada una (repeticiones o rango, RIR y %1RM), más un descanso objetivo e indicaciones.</p>
    <p>Al cargarlas en una sesión, <b>los campos se rellenan</b> con lo prescrito y el peso se calcula con el <b>1RM estimado del atleta</b> (redondeado a 2,5 kg). Cada ejercicio muestra su objetivo para comparar.</p>
    <p>Las series cargadas son <b>planificadas</b>: no cuentan en volumen, récords ni informes hasta que las marcas con ✓, para que lo planificado no se confunda con lo hecho. Corrige lo que cambie antes de marcarlas.</p>
    <p>El descanso de la tabla es el objetivo del cronómetro; el campo de descanso lo rellenas tú.</p>
    <p>Las tablas son <b>comunes a todos los usuarios</b> del dispositivo y entran en la copia de seguridad.</p>`],
  tpl_pct: ['%1RM en una tabla', `
    <p>Porcentaje del 1RM estimado del atleta con el que se calcula el peso. Usa el mejor 1RM estimado de los últimos 120 días (si no hay, el histórico).</p>
    <p>Si lo dejas vacío, se deduce de las <b>repeticiones mínimas + RIR</b> con la tabla RTS (p. ej. 8 reps @ RIR 2 ≈ 74%), y se marca con *.</p>
    <p>Sin historial del ejercicio no hay 1RM estimado: el peso queda vacío para que lo escribas.</p>`],
  e1rm_trend: ['Evolución del 1RM estimado', `
    <p>Cada punto es la <b>mejor serie de esa sesión</b> convertida a 1RM estimado con la tabla RTS (peso ÷ %1RM según reps y RIR). La línea discontinua es tu <b>récord vigente</b>; los puntos grandes, sesiones en las que lo batiste.</p>
    <p>Es una estimación: sube y baja de una sesión a otra por la fatiga, el sueño o un RIR mal calibrado. Fíjate en la <b>tendencia de varias semanas</b>, no en un punto suelto. Las series de 1 a 5 repeticiones estiman mejor el 1RM que las de 10 a 12.</p>
    <p>Sin RIR ni RPE se asume que la serie fue al fallo, lo que da una estimación conservadora.</p>`],
  rm_real: ['Máximos por repeticiones (RM)', `
    <p>El mayor peso que has movido con cada número de repeticiones: tu <b>3RM</b> es lo máximo que has levantado 3 veces.</p>
    <p>Solo se muestran los <b>máximos reales</b>: si has movido 100 kg × 5, un 100 kg × 3 no aparece como 3RM porque ya lo superaste con más repeticiones.</p>`],
  hard_sets: ['Series efectivas', `
    <p>Series de trabajo (no calentamientos) terminadas <b>cerca del fallo</b>: con <b>RIR ≤ 4</b> por defecto (puedes cambiarlo a ≤ 3 en Ajustes). Son las que más cuentan como estímulo para ganar músculo (<i>hard sets</i>).</p>
    <p>La hipertrofia aumenta cuanto más cerca del fallo se termina la serie (Robinson et al., 2024), aunque las diferencias entre RIR 0 y 3 son pequeñas (Refalo et al., 2023). Por encima de 4-5 RIR el estímulo cae claramente.</p>
    <p>Recuento <b>fraccionado</b>: cada serie cuenta 1 para el músculo principal y 0,5 para cada secundario (Pelland et al., 2024).</p>
    <p>Cada músculo se compara con sus <b>referencias de volumen</b> (aproximadas a la tabla de Mike Israetel): mantenimiento, mínimo efectivo, rango adaptativo y máximo recuperable. Toca ⓘ «Referencias de Israetel» para ver qué significa cada una.</p>
    <p>Las series <b>sin RIR</b> se muestran aparte (más claras) y no suman, porque no se sabe lo cerca del fallo que estuvieron.</p>`],
  consistency: ['Constancia', `
    <p>Cuántas sesiones haces a la semana y durante cuántas semanas seguidas. La racha cuenta semanas (de lunes a domingo) con al menos una sesión; la semana en curso no la rompe.</p>
    <p>Mantener la frecuencia durante meses influye más en el progreso que cualquier detalle de la programación.</p>`],
  relative: ['Fuerza relativa', `
    <p><b>1RM estimado ÷ peso corporal</b>. Si tu 1RM sube 5 kg pero tu peso corporal también, en relación con tu peso no has mejorado. Útil si buscas perder grasa manteniendo la fuerza o compites por categorías de peso.</p>
    <p>Para cada sesión se usa el peso corporal registrado más cercano (como mucho 30 días antes o después). Puedes anotarlo en Progreso o en «Antes de empezar» de cada sesión.</p>`],
  ex_change: ['Cambio en el periodo', `
    <p>Compara la media de tus <b>3 primeras sesiones</b> del periodo con la media de las <b>3 últimas</b> (con menos de 6 sesiones, la primera con la última). Usar medias evita que un día bueno o malo distorsione el resultado.</p>
    <p>La métrica es la de cada ejercicio: 1RM estimado, repeticiones, tiempo o distancia.</p>`],
  athlete_week: ['Microciclo', `
    <p>Periodo con el que se agrupan los datos semanales: series por músculo, constancia, análisis de carga, informes y calendario.</p>
    <p>Por defecto es la semana natural de <b>lunes a domingo</b>. Puedes cambiar el día en que empieza (p. ej. si tu semana de entrenamiento va de sábado a viernes).</p>
    <p>Si tu programación usa <b>microciclos</b> de otra duración (p. ej. 8 o 10 días), elige la duración y la fecha en que empieza uno de ellos: la app repetirá el ciclo cada N días hacia delante y hacia atrás. Las referencias de volumen por músculo están pensadas para 7 días; con otra duración se ajustan en proporción.</p>`],
  same_weight: ['Con el mismo peso', `
    <p>Cuántas repeticiones podías hacer con un peso concreto en cada sesión: <b>repeticiones + RIR</b> (lo que hiciste más lo que te quedaba). Si sube con el tiempo, eres más fuerte con ese peso.</p>
    <p>Es más intuitivo que el 1RM estimado y no depende de ninguna tabla: «con 100 kg en agosto podía 6, hoy puedo 8». Sin RIR se cuentan solo las repeticiones hechas.</p>`],
  daily: ['Datos del día', `
    <p>Datos opcionales de cada día, entrenes o no: <b>pasos</b>, <b>calorías consumidas</b> y <b>peso corporal</b>. Se anotan en el calendario, en la tarjeta «Datos del día».</p>
    <p>Se usan en Progreso (medias por semana y mantenimiento estimado), en el análisis de factores (pasos y calorías del <b>día anterior</b> frente a tu rendimiento) y en el informe.</p>
    <p>Las medias se calculan solo con los días anotados: un día sin dato no cuenta como 0. Las calorías anotadas suelen quedarse cortas frente a lo que se come de verdad; lo importante es anotarlas siempre igual.</p>`],
  tdee: ['Mantenimiento estimado', `
    <p>Calorías con las que tu peso se mantendría. Se calcula con un <b>balance energético</b>: calorías medias anotadas en los últimos 28 días, corregidas por la tendencia de tu peso en ese tiempo (≈ 7700 kcal por kg).</p>
    <p>Si comes 2400 kcal y pierdes 0,25 kg/semana (≈ 275 kcal/día de déficit), tu mantenimiento ronda las 2675 kcal.</p>
    <p>Es una estimación: el peso fluctúa por agua y glucógeno, y el error al anotar calorías se traslada al resultado (aunque si siempre anotas igual, la estimación sigue siendo útil para ajustar). Necesita al menos 14 días con calorías y 3 pesos repartidos en 2 semanas.</p>`],
  landmarks: ['Referencias de volumen (Israetel)', `
    <p>Series efectivas por músculo y semana según el modelo de <b>Mike Israetel</b> (Renaissance Periodization):</p>
    <p><b>MV</b> · volumen de mantenimiento: conserva el músculo, no lo hace crecer.<br>
    <b>MEV</b> · volumen mínimo efectivo: a partir de aquí hay crecimiento.<br>
    <b>MAV</b> · volumen adaptativo máximo: el rango donde se suele progresar mejor.<br>
    <b>MRV</b> · volumen máximo recuperable: por encima, la fatiga supera la recuperación y el rendimiento cae.</p>
    <p>Colores: gris por debajo del MEV, verde claro entre MEV y MAV, verde en el MAV, naranja entre MAV y MRV, rojo por encima del MRV.</p>
    <p>Los valores por defecto son <b>aproximados</b>: varían entre ediciones de sus guías y entre personas (más entrenadas, más volumen toleran). Lo habitual es empezar un mesociclo cerca del MEV e ir subiendo hacia el MRV. Puedes ajustarlos para cada atleta en Ajustes › Avanzado.</p>
    <p>Aquí las series secundarias cuentan 0,5. Israetel no cuenta así exactamente (por ejemplo, da MEV 0 a glúteos porque las sentadillas y el peso muerto ya los trabajan), así que en músculos que trabajan mucho como secundarios el valor puede salir algo alto frente a su tabla.</p>`],
  suggest: ['Peso sugerido', `
    <p>Peso propuesto para la serie a partir de tu <b>1RM estimado</b> y de las repeticiones y el RIR objetivo, con la tabla RTS: peso = 1RM × %1RM(reps, RIR), redondeado al incremento mínimo.</p>
    <p><b>1RM de referencia:</b> si ya has hecho series de ese ejercicio hoy, se usan esas (si hoy vas más fuerte o más cansado, la sugerencia se ajusta); si no, tu última sesión; si no, tu mejor marca de los últimos 120 días.</p>
    <p><b>Objetivo:</b> el de la tabla si la serie viene de una; si no, las repeticiones y el RIR de la serie equivalente de tu última sesión.</p>
    <p>Aparece como texto gris en el campo de peso y no se guarda hasta que lo escribas o pulses «Rellenar». Solo para ejercicios con peso, de 1 a 12 repeticiones.</p>`],
  warmup: ['Calentamiento y discos', `
    <p>El botón con un disco que aparece bajo el peso de la <b>siguiente serie pendiente</b> de los ejercicios multiarticulares abre una rampa de calentamiento hasta ese peso y los discos que hay que poner en cada lado.</p>
    <p>Rampa: barra × 10 y luego 40 % × 5, 60 % × 3, 75 % × 2 y 85 % × 1 del peso de trabajo. Si la serie es de 8 o más repeticiones, basta con 50 % × 5 y 70 % × 3. Se omiten los escalones que no aportan (por debajo de la barra o repetidos).</p>
    <p>«Añadir series de calentamiento» las inserta como series de calentamiento (no cuentan en volumen ni récords).</p>`],
  superset: ['Superserie', `
    <p>Dos o más ejercicios que se hacen <b>alternando</b>: una serie de cada uno, sin descanso entre ellos, y el descanso al terminar la vuelta.</p>
    <p>Al marcar ✓ una serie de un ejercicio que no es el último del grupo, no arranca el cronómetro: toca pasar al siguiente. Tras el último, arranca con el descanso más largo del grupo.</p>
    <p>Se crean con «Superserie con el siguiente», entre las tarjetas de dos ejercicios. Cada ejercicio se sigue contando por separado en volumen, récords y análisis.</p>`],
  deload: ['Descarga', `
    <p>Una <b>descarga</b> es una semana con menos carga para disipar la fatiga acumulada y volver a progresar. Lo habitual: misma frecuencia, la mitad de series y más lejos del fallo (RIR 4-5). Muchos entrenadores la programan cada 4-6 semanas (Bell et al., 2023, encuesta a entrenadores de fuerza) o al final de cada mesociclo.</p>
    <p>La app avisa cuando ve señales de fatiga (es una ayuda, no un diagnóstico):</p>
    <p>• <b>Rendimiento</b>: en las sesiones de los últimos 14 días, tu 1RM estimado está de media un 3 % o más por debajo de tu mejor marca del mes anterior (con al menos 3 sesiones).<br>
    • <b>Caídas entre series</b> mayores que tu umbral en 2 o más sesiones recientes.<br>
    • <b>Semanas seguidas sin una semana suave</b> (una semana suave tiene menos del 70 % de las series de una semana normal tuya).</p>
    <p>Avisa si cae el rendimiento, o si llevas 5 semanas o más sin descargar y además hay caídas entre series. A partir de 8 semanas sin descargar, el aviso es más suave. El rendimiento también baja por dormir poco, estrés o enfermedad: míralo junto a cómo te encuentras.</p>`],
  athlete_share: ['Entrenador y atleta', `
    <p>Sin servidor ni cuentas: los datos viajan en un <b>archivo</b> que se envía por WhatsApp, correo o AirDrop.</p>
    <p><b>1.</b> El atleta pulsa <b>«Enviar mis datos al entrenador»</b> (Ajustes › Copia de seguridad).<br>
    <b>2.</b> El entrenador lo abre en <b>Usuarios › Importar datos de un atleta</b>. La primera vez se crea el perfil del atleta (no lo crees a mano: así ambos quedan enlazados). Las siguientes veces se combina con él.<br>
    <b>3.</b> El entrenador puede preparar tablas o un mesociclo en ese perfil y pulsar <b>«Enviar datos»</b>; el atleta lo importa igual.</p>
    <p><b>Combinar</b> no borra nada: se añaden las sesiones nuevas y las del archivo sustituyen a las que tienen el mismo identificador. Lo que se borra en un móvil no se borra en el otro. Los ajustes de cada dispositivo se conservan. Antes de combinar se guarda una copia automática. Los vídeos no viajan.</p>`],
  meso: ['Mesociclo', `
    <p>Un bloque de varias semanas que repite tus <b>tablas</b> (cada día del mesociclo es una tabla) con progresión, y termina con una <b>descarga</b>.</p>
    <p><b>RIR:</b> baja en línea recta desde el RIR inicial hasta el final en números enteros (p. ej. 3 → 1 en 4 semanas: 3 · 2 · 2 · 1; estimar el RIR tiene alrededor de 1 repetición de error, así que los medios puntos no aportan). Como el peso se calcula con tu 1RM estimado y el RIR, al bajar el RIR sube el peso.</p>
    <p><b>Series:</b> opcionalmente, una serie más por ejercicio cada semana o cada dos, para ir del MEV hacia el MRV, como propone Israetel.</p>
    <p><b>Descarga:</b> la mitad de series, RIR 4 y el 90 % de la carga de la primera semana.</p>
    <p>Si una tabla trae un %1RM explícito, ese % se respeta y el RIR queda como guía. La tabla «Plan semana a semana» muestra cuántas series por músculo planificas cada semana, coloreadas con tus referencias de volumen. Las semanas siguen tu «semana del atleta» (Ajustes › Avanzado).</p>`],
  autoclose: ['Sesiones abiertas', `
    <p>Si olvidas pulsar «Finalizar sesión», la sesión sigue «en curso» y su duración no deja de crecer, lo que falsea tus estadísticas de duración.</p>
    <p>Cuando una sesión lleva el tiempo que elijas (2 horas por defecto) sin actividad (sin marcar ninguna serie), la app te pregunta si la cierras. Al cerrarla, la hora de fin es la de la <b>última serie marcada</b> (+2 min), no la del momento en que respondes. «Sigo entrenando» vuelve a preguntar pasado el mismo tiempo.</p>
    <p>En Ajustes › Sesiones abiertas puedes elegir que se cierren solas, sin preguntar. Siempre se pueden reabrir desde la sesión.</p>`],
  sec_weights: ['Cuánto cuenta cada músculo', `
    <p>Cada serie efectiva cuenta <b>1</b> para el músculo principal y una <b>fracción</b> para cada secundario:</p>
    <p><b>¾</b> contribución alta (p. ej. glúteo en sentadilla profunda, prensa o zancadas; bíceps en dominadas supinas; tríceps en fondos).<br>
    <b>½</b> contribución media: el valor general (bíceps en remos y jalones, tríceps y deltoides anterior en press de banca…).<br>
    <b>¼</b> contribución baja (deltoides anterior en aperturas, erectores en sentadilla, cuádriceps en push press…).<br>
    Sin marcar: sin crecimiento medible (p. ej. femoral en sentadilla y prensa, abdomen en los básicos).</p>
    <p>Base: el metaanálisis de Pelland et al. (2024) encontró que contar los secundarios como 0,5 predice mejor el crecimiento que contarlos como 0 o como 1. Los ajustes por ejercicio salen de estudios que midieron el crecimiento real de cada músculo (resonancia o ecografía): la sentadilla no hizo crecer el femoral (Kubo 2019; Plotkin 2023) pero sí el glúteo casi como el hip thrust (Plotkin 2023); la prensa hizo crecer el glúteo un 15 % (frente a un 7 % el cuádriceps); el remo hizo crecer el bíceps la mitad que el curl (Mannarino 2021); el jalón, en principiantes, parecido al curl (Gentil 2015). Donde no hay estudios de crecimiento, el valor es una estimación por biomecánica. Son aproximaciones: puedes cambiar cada ejercicio en Editar ejercicio.</p>`],
  level: ['Modo de atleta', `
    <p><b>Sencillo:</b> para registrar lo básico sin distracciones: ejercicios, series, peso, repeticiones, <b>RIR</b> y descansos. Mantiene el calendario, el progreso por ejercicio, el informe, los vídeos y las copias.</p>
    <p><b>Avanzado:</b> añade RPE (o RPE + RIR), material, «antes de empezar» (sueño, energía, estrés, factores), RPE de sesión y carga interna, %1RM e índice de estrés por serie, avisos de fatiga, descanso objetivo por ejercicio y el apartado de Análisis.</p>
    <p>Es un ajuste de cada usuario y <b>no borra datos</b>: al volver a avanzado reaparece todo lo registrado.</p>`],
  rest: ['Descanso entre series', `
    <p>Tiempo entre el final de una serie y el inicio de la siguiente. Se guarda en el campo <b>«Descanso»</b> que hay debajo de cada serie, en <b>m:ss</b> (2:30) o en segundos (150).</p>
    <ul><li><b>A mano:</b> escribe el valor en el campo.</li>
    <li><b>Con el cronómetro:</b> al marcar la serie como hecha (✓) arranca; pulsa <b>«Parar»</b> al empezar la siguiente y el campo se rellena con el tiempo transcurrido. <b>✕</b> lo descarta sin escribir nada.</li></ul>
    <p>En ambos casos puedes modificarlo cuando quieras. La app no calcula descansos por su cuenta.</p>
    <p>Orientativo: en fuerza con cargas altas suelen recomendarse 2-5 min; en hipertrofia, descansos de al menos 1,5-2 min tienden a dar mejores resultados que los muy cortos.</p>`],
  muscle_volume: ['Volumen por músculo', `
    <p>Cada ejercicio tiene un <b>músculo principal</b> y, opcionalmente, <b>secundarios</b>. Cada serie efectiva cuenta <b>1</b> para el principal y <b>0,5</b> para cada secundario (conteo fraccionado).</p>
    <p class="formula">4 series de press banca → pectoral 4 · tríceps 2 · deltoides anterior 2</p>
    <p>En el metaanálisis de Pelland et al. (2024), este conteo fue el que mejor predijo la hipertrofia, frente a contar solo el principal o contar los secundarios como series completas.</p>
    <p>En sesiones con índice de estrés, se reparte el IE de cada serie con los mismos pesos.</p>
    <p><b>No se usan kilos</b>: 200 kg en prensa y 20 kg en curl no son comparables entre músculos.</p>
    <p>La figura colorea cada músculo según ese volumen. La asignación de músculos es una simplificación: ajústala en cada ejercicio si tu técnica o variante cambia el reparto.</p>`],
  rel_perf: ['Rendimiento relativo', `
    <p>Para cada ejercicio con peso, compara el <b>1RM estimado del día</b> con la <b>mediana</b> de ese ejercicio en las 6 semanas de alrededor (sin contar ese día):</p>
    <p class="formula">rendimiento = 1RM est. del día / mediana de su entorno − 1</p>
    <p>Así se descuenta tu progresión a largo plazo: un −3% significa que ese día rendiste un 3% por debajo de lo normal para ti en esas fechas. La sesión recibe la media de sus ejercicios.</p>`],
  median: ['Mediana', `<p>El valor central de una lista ordenada. A diferencia de la media, apenas le afecta un día excepcionalmente bueno o malo, por eso se usa como referencia.</p>`],
  se: ['Error estándar e IC 95%', `
    <p>El <b>±</b> que acompaña a cada diferencia indica la incertidumbre: con pocas sesiones o mucha variación entre días, el número real podría estar bastante lejos del calculado.</p>
    <p>Se muestra <b>±2 errores estándar</b>, que equivale aproximadamente a un <b>intervalo de confianza del 95%</b>. «Rindes peor/mejor» solo aparece si la diferencia es mayor que ese margen y hay al menos 3 sesiones en cada grupo.</p>`],
  corr: ['Correlación (r)', `
    <p>El coeficiente <b>r de Pearson</b> va de −1 a 1: 1 = cuando una variable sube, la otra también, siempre; −1 = sube una y baja la otra; 0 = sin relación lineal.</p>
    <p>Orientativo: |r| &lt; 0,3 débil; 0,3-0,5 moderada; &gt; 0,5 fuerte. <b>Correlación no implica causa.</b></p>`],
  causation: ['Correlación no es causa', `<p>Que rindas peor los días que marcas «Dormí mal» no prueba que el sueño sea la causa: puede coincidir con estrés, peor alimentación… O puedes marcarlo <i>porque</i> la sesión fue mal. Para reducir este sesgo, <b>marca los factores antes de entrenar</b>.</p>`],
  load_table: ['Tabla de cargas', `<p>Peso aproximado que podrías mover para cada número de repeticiones <b>llevando la serie al fallo</b> (RPE 10 / RIR 0), calculado con tu mejor 1RM estimado y la tabla RTS, y redondeado a 2,5 kg. Para series a RIR 2, súmale 2 a las repeticiones.</p>`],
  pct1rm: ['Intensidad relativa (%1RM)', `
    <p>Porcentaje de tu 1RM que supone el peso de una serie, deducido de <b>repeticiones + RIR</b> con la tabla RTS. Ejemplos: 5 reps a RIR 0 ≈ 86%; 5 reps a RIR 2 ≈ 81%; 10 reps a RIR 0 ≈ 74%.</p>
    <p><b>Rango:</b> de 1 a 12 repeticiones y RIR de 0 a 3,5. Con más de 12 repeticiones o más de 3,5 RIR <b>no se calcula</b>.</p>
    <p><b>Limitación:</b> la tabla es una media. Las repeticiones que una persona hace a un mismo %1RM varían mucho según el ejercicio (en prensa o en máquinas salen más que en press banca), el entrenamiento y el tipo de fibra.</p>`],
  rts: ['Tabla RTS: repeticiones × RIR → %1RM', `
    <p>Tabla de Mike Tuchscherer (Reactive Training Systems), obtenida de powerlifters. En ella, bajar un punto de RPE equivale a hacer una repetición más, así que el % depende solo de <b>reps + RIR</b>.</p>
    ${rtsTableHTML()}
    <p class="muted small">Valores en % del 1RM. RPE ≈ 10 − RIR.</p>`],
  stress_index: ['Índice de estrés (Stress Index)', `
    <p>Forma de cuantificar el volumen que no cuenta todas las series igual: cada serie efectiva suma según lo <b>cerca del fallo</b> que terminó y el <b>tipo de ejercicio</b>. Concepto de Mike Tuchscherer; tabla difundida por PowerExplosive y Vitónica.</p>
    <table class="gt"><tr><th>RIR</th><th>Multiarticular</th><th>Monoarticular</th></tr>
      ${[0, 1, 2, 3, 4, 5].map((r) => `<tr><td>${r}</td><td>${fmt(1.4 - 0.2 * r, 1)}</td><td>${fmt(1.3 - 0.2 * r, 1)}</td></tr>`).join('')}</table>
    <p>Ejemplo: 3 series de sentadilla a RIR 2 (1,0 cada una) + 3 de curl femoral a RIR 1 (1,1) = 6,3.</p>
    <p><b>Decisiones de esta app:</b> con RIR mayor que 5 la serie suma 0; las medias (RIR 1,5) se interpolan; si no apuntas RPE ni RIR la serie <b>no cuenta</b> y se avisa. Si usas RPE, se convierte a RIR = 10 − RPE.</p>
    <p><b>Limitaciones:</b> no es un método validado en estudios revisados por pares, hay variantes con otros valores (alguna da 1,6 al fallo) y depende de que el RIR sea honesto. <b>Más índice no significa mejores resultados</b>: sirve para comparar tus semanas entre sí.</p>`],
  joint: ['Multiarticular / monoarticular', `<p><b>Multiarticular</b>: mueve varias articulaciones (sentadilla, peso muerto, press, remo, dominadas). <b>Monoarticular</b>: una sola (curl, extensión de cuádriceps, aperturas). En el índice de estrés las monoarticulares suman 0,1 menos por serie. Puedes cambiarlo al editar el ejercicio.</p>`],
  system: ['Cuantificar con series o con índice de estrés', `
    <p><b>Series y volumen</b>: cuenta las series efectivas y los kilos movidos (peso × reps).</p>
    <p><b>Índice de estrés</b> ${infoBtn('stress_index')}: cada serie pesa según su RIR y el tipo de ejercicio. Muestra el índice por serie, por ejercicio y por grupo muscular. Para usarlo, apunta RPE o RIR en todas las series efectivas.</p>
    <p>Cada sesión puede usar un sistema; el de por defecto se elige en Ajustes. Los cálculos de la pantalla de Análisis se hacen siempre con los dos.</p>`],
  weekly_load: ['Índice de estrés semanal', `<p>Suma del índice de estrés de todas las sesiones de cada semana (de lunes a domingo). Sirve para ver si tu carga sube, se mantiene o baja, y para detectar <b>saltos bruscos</b> de una semana a otra, que se asocian a más fatiga. No hay un valor «correcto» universal: compárate contigo.</p>`],
  zones: ['Zonas de intensidad', `<p>Reparto de tus series efectivas según su %1RM: por debajo del 70% (trabajo más metabólico, series largas), 70-79%, 80-89% (rango típico de fuerza) y 90% o más (cargas muy altas, pocas repeticiones). Son rangos orientativos.</p>`],
};
function info(k) {
  return `<button class="info" data-action="info" data-k="${k}" aria-label="Qué es: ${esc(GLOSSARY[k]?.[0] || k)}">i</button>`;
}

const sortKey = (s) => s.date + s.createdAt;
const historyBefore = (exerciseId, s) => historyFor(exerciseId).filter((h) => h.sess.id !== s.id && sortKey(h.sess) < sortKey(s));
const norm = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function sessionText(s) {
  return norm([s.title, s.notes, s.preNotes, s.preObs, ...(s.factors || []),
    ...s.exercises.flatMap((e) => { const d = exById(e.exerciseId); return [d?.name, d?.primary && MUSCLES[d.primary], ...(d?.secondary || []).map((m) => MUSCLES[m]), e.notes, ...e.equipment.map((q) => eqById(q)?.name)]; })].join(' '));
}
const FACTORS = ['Dormí mal', 'Estrés', 'Molestias / dolor', 'Agujetas', 'Sin comer', 'Cafeína / pre-entreno', 'Resfriado', 'Calor', 'Con prisa', 'Muy motivado'];

/* ---------- Calendario (pantalla de inicio) ---------- */
function sessionCard(s) {
  const sets = s.exercises.reduce((n, e) => n + e.sets.filter(isWork).length, 0);
  const tags = [...(s.factors || []), ...new Set(s.exercises.flatMap((e) => e.equipment).map((q) => eqById(q)?.name).filter(Boolean))];
  return `<a class="card list-item" href="#/session/${s.id}">
    <div class="row"><span class="title">${esc(s.title || 'Sesión')}</span><span class="spacer"></span>
      <span class="muted small">${fmtDate(s.date)}</span></div>
    <div class="muted small">${esc(s.exercises.map((e) => exById(e.exerciseId)?.name).filter(Boolean).join(' · ') || 'Sin ejercicios')}</div>
    <div class="stats">
      <div class="stat"><b>${sets}</b><span>series</span></div>
      <div class="stat"><b>${fmt(sessionVolume(s) / 1000, 2)} t</b><span>volumen</span></div>
      ${s.endedAt ? `<div class="stat"><b>${fmtDur(s.endedAt - s.startedAt)}</b><span>duración</span></div>` : `<div class="stat"><b>${ic('hourglass')}</b><span>en curso</span></div>`}
      ${s.srpe ? `<div class="stat"><b>${s.srpe}</b><span>RPE sesión</span></div>` : ''}
      ${s.bodyweight ? `<div class="stat"><b>${fmt(s.bodyweight)} kg</b><span>peso</span></div>` : ''}
    </div>
    ${tags.length ? `<div>${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
  </a>`;
}

// Calendario plegado (solo la semana del día elegido). Preferencia de este dispositivo.
const CAL_FOLD = 'diario-entreno.calPlegado';
const calFolded = () => { try { return localStorage.getItem(CAL_FOLD) === '1'; } catch (e) { return false; } };
// Avisos del calendario: se recogen tras un icono con contador para no tapar el calendario.
function noticesList() {
  return [window.updateBannerHTML && updateBannerHTML(), window.staleBannerHTML && staleBannerHTML(),
    window.installReminderHTML && installReminderHTML(), window.backupReminderHTML && backupReminderHTML()].filter(Boolean);
}
function viewCalendar() {
  const today = todayISO();
  const sel = ui.day || today;
  const [y, m] = (ui.month || sel.slice(0, 7)).split('-').map(Number);
  const byDay = {};
  for (const s of db.sessions) (byDay[s.date] = byDay[s.date] || []).push(s);
  const first = new Date(y, m - 1, 1);
  const cdow = isCustomCycle() ? 1 : cycleDow(); // el calendario sigue el día de inicio de la semana del atleta
  const offset = (first.getDay() - cdow + 7) % 7;
  const nDays = new Date(y, m, 0).getDate();
  const pad = (n) => String(n).padStart(2, '0');
  const folded = calFolded();
  const dayBtn = (iso, label) => {
    const n = byDay[iso]?.length || 0;
    return `<button class="day ${iso === sel ? 'sel' : ''} ${iso === today ? 'today' : ''}" data-action="pick-day" data-day="${iso}" aria-label="${iso}${n ? `, ${n} sesiones` : ''}">${label}${n ? '<i></i>' : ''}</button>`;
  };
  let cells = '', monthCount = 0, title;
  if (folded) {
    // Semana (de 7 días, empezando el día de inicio del atleta) que contiene el día elegido.
    const d0 = dayNum(sel) - ((new Date(sel + 'T12:00').getDay() - cdow + 7) % 7);
    for (let k = 0; k < 7; k++) { const iso = isoFromNum(d0 + k); monthCount += byDay[iso]?.length || 0; cells += dayBtn(iso, +iso.slice(8)); }
    const a = isoFromNum(d0), b = isoFromNum(d0 + 6);
    title = `${shortDay(a)} – ${shortDay(b)}`;
  } else {
    for (let i = 0; i < offset; i++) cells += '<span></span>';
    for (let d = 1; d <= nDays; d++) { const iso = `${y}-${pad(m)}-${pad(d)}`; monthCount += byDay[iso]?.length || 0; cells += dayBtn(iso, d); }
    title = first.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).replace(/^./, (c) => c.toUpperCase());
  }
  const q = norm(ui.csearch).trim();
  const notices = noticesList();
  if (!notices.length) ui.noticesOpen = false; // el próximo aviso vuelve a salir recogido

  let html = `<div class="row cal-head"><h1 class="spacer">Calendario</h1>
      ${notices.length ? `<button class="icon ghost bell ${ui.noticesOpen ? 'active' : ''}" data-action="notices" aria-expanded="${!!ui.noticesOpen}" aria-label="${notices.length} aviso${notices.length === 1 ? '' : 's'}">${ic('bell')}<span class="badge">${notices.length}</span></button>` : ''}</div>
    ${ui.noticesOpen ? `<div class="notices">${notices.join('')}</div>` : ''}
    <input type="search" data-action-input="csearch" placeholder="Buscar: ejercicio, nota, material, sensación…" value="${esc(ui.csearch)}">
    <div style="height:12px"></div>`;

  if (q) {
    const words = q.split(/\s+/);
    const res = sortedSessions().filter((s) => { const t = sessionText(s); return words.every((w) => t.includes(w)); });
    html += `<div class="muted small" style="margin-bottom:8px">${res.length} resultado${res.length === 1 ? '' : 's'}</div>`;
    html += res.map(sessionCard).join('') || '<div class="empty">Ninguna sesión coincide.</div>';
    return html;
  }

  const offToday = folded ? sel !== today : sel !== today || ui.month !== today.slice(0, 7);
  html += `<div class="card">
      <div class="row">
        <button class="icon ghost" data-action="${folded ? 'week' : 'month'}" data-d="-1" aria-label="${folded ? 'Semana' : 'Mes'} anterior">‹</button>
        <div class="spacer" style="text-align:center"><b>${title}</b>
          <div class="muted small">${monthCount} ${monthCount === 1 ? 'sesión' : 'sesiones'}</div></div>
        <button class="icon ghost" data-action="${folded ? 'week' : 'month'}" data-d="1" aria-label="${folded ? 'Semana' : 'Mes'} siguiente">›</button>
      </div>
      <div class="cal">${[0, 1, 2, 3, 4, 5, 6].map((i) => `<span class="dow">${DOW1[(cdow + i) % 7]}</span>`).join('')}${cells}</div>
      <div class="row cal-foot">
        ${offToday ? '<button class="ghost small-btn" data-action="go-today">Ir a hoy</button>' : ''}<span class="spacer"></span>
        <button class="ghost small-btn" data-action="cal-fold" aria-expanded="${!folded}">${folded ? 'Ver el mes ▾' : 'Ver solo la semana ▴'}</button>
      </div>
    </div>
    <h2>${sel === today ? 'Hoy · ' : ''}${fmtDate(sel)}</h2>
    ${window.dailyCardHTML ? dailyCardHTML(sel) : ''}
    ${window.mesoCardHTML ? mesoCardHTML(sel) : ''}
    <div class="grid2">
      <button class="primary" data-action="new-session">＋ Nueva sesión</button>
      <button data-action="start-from">${ic('list')} Repetir o tabla…</button>
    </div>
    <div style="height:12px"></div>`;
  const daySessions = (byDay[sel] || []).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  html += daySessions.map(sessionCard).join('') || '<div class="muted" style="padding:8px 0 16px">Sin sesiones este día.</div>';
  const recent = sortedSessions().filter((s) => s.date !== sel).slice(0, 3);
  if (recent.length) html += `<h2>Últimas sesiones</h2>${recent.map(sessionCard).join('')}`;
  return html;
}
const shortDay = (iso) => new Date(iso + 'T12:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

/* ---------- Sesión ---------- */
function viewSession(id) {
  const s = sessionById(id);
  if (!s) return `<div class="empty">Sesión no encontrada. <a href="#/">Volver</a></div>`;
  s.factors = s.factors || [];
  const dur = (s.endedAt || Date.now()) - s.startedAt;
  const preFilled = s.bodyweight != null || s.readiness || s.sleep != null || s.stress || s.factors.length || s.preNotes || s.preObs;
  const preOpen = ui.preOpen[s.id] ?? (!s.exercises.length || false);
  let html = `<div class="row"><a class="btn ghost" href="#/">‹ Calendario</a><span class="spacer"></span>
      <button class="ghost" data-action="session-menu" data-id="${s.id}">⋯</button></div>
    ${window.staleBannerHTML ? staleBannerHTML(s.id) : ''}
    <input data-s="title" value="${esc(s.title)}" placeholder="Nombre de la sesión (p. ej. Pierna A)" style="font-size:1.2rem;font-weight:700;margin:6px 0 10px">
    <div class="grid2" style="margin-bottom:12px">
      <div><label>Fecha</label><input type="date" data-s="date" value="${esc(s.date)}"></div>
      <div><label>${s.endedAt ? 'Duración' : 'En curso'}</label><div class="pill">${fmtDur(dur)} · <b id="vol">${fmt(sessionVolume(s), 0)} kg</b></div></div>
    </div>
    ${isSimple() ? '' : `<div class="row"><button class="chip" data-action="cycle-system">Cuantificación: <b>${SYSTEMS[systemOf(s)]}</b> ⇄</button>${info('system')}</div>`}
    ${isSimple() ? '' : `<details class="card pre" id="pre" ${preOpen ? 'open' : ''} style="margin-top:12px">
      <summary><b>Antes de empezar</b> <span class="muted small">opcional${preFilled && !preOpen ? ' · ✓ registrado' : ''}</span></summary>
      <div class="grid2" style="margin-top:10px">
        <div><label>Peso corporal (kg)</label><input type="text" inputmode="decimal" autocomplete="off" data-s="bodyweight" value="${decIn(s.bodyweight)}"></div>
        <div><label>Horas de sueño</label><input type="text" inputmode="decimal" autocomplete="off" data-s="sleep" value="${decIn(s.sleep)}"></div>
        <div><label>Energía (1 baja – 5 alta) ${info('readiness')}</label>${scaleSelect('readiness', s.readiness, 1, 5)}</div>
        <div><label>Estrés (1 bajo – 5 alto)</label>${scaleSelect('stress', s.stress, 1, 5)}</div>
      </div>
      <label style="margin-top:10px">Factores que pueden influir</label>
      <div class="chips">${FACTORS.map((f) => `<button class="chip ${s.factors.includes(f) ? 'on' : ''}" data-action="toggle-factor" data-f="${esc(f)}">${esc(f)}</button>`).join('')}</div>
      <div style="height:10px"></div>
      <label>Sensaciones al empezar</label>
      <textarea data-s="preNotes" placeholder="Cómo te notas: pesado, fresco, rodilla cargada…">${esc(s.preNotes)}</textarea>
      <div style="height:8px"></div>
      <label>Observaciones importantes</label>
      <textarea data-s="preObs" placeholder="Viaje, gimnasio distinto, competición cerca, medicación…">${esc(s.preObs)}</textarea>
    </details>`}`;

  s.exercises.forEach((ex, i) => {
    html += exerciseCard(s, ex, i);
    // Enlace con el siguiente ejercicio: superserie (se alternan sin descanso entre ellos).
    if (i < s.exercises.length - 1) html += `<div class="ss-link ${ex.ss ? 'on' : ''}"><button class="ss-btn" data-action="ss-toggle" data-i="${i}" aria-pressed="${!!ex.ss}">${ex.ss ? `${ic('link')} Superserie · separar` : `${ic('link')} Superserie con el siguiente`}</button></div>`;
  });

  html += `<div class="grid2"><button data-action="add-exercise">＋ Añadir ejercicio</button><button data-action="tpl-choose" data-mode="add">${ic('list')} Desde tabla</button></div>
    ${s.exercises.length ? sessionSummary(s) : ''}
    <div class="card" style="margin-top:12px">
      <label>Notas finales de la sesión</label>
      <textarea data-s="notes" placeholder="Cómo fue, qué cambiar la próxima vez…">${esc(s.notes)}</textarea>
      ${isSimple() ? '' : `<div style="height:8px"></div>
      <label>RPE de la sesión (esfuerzo global 1-10) ${info('srpe')}</label>${scaleSelect('srpe', s.srpe, 1, 10)}`}
    </div>
    ${s.endedAt
      ? `<button class="block" data-action="reopen-session">Reabrir sesión (seguir cronometrando)</button>`
      : `<button class="primary block" data-action="finish-session">✓ Finalizar sesión</button>`}`;
  return html;
}

function sessionSummary(s) {
  const all = s.exercises.flatMap((e) => e.sets.filter(isWork));
  const reps = all.reduce((a, x) => a + (x.reps || 0), 0);
  const rpes = all.map((x) => x.rpe).filter(Boolean);
  const rirs = all.map((x) => x.rir).filter((x) => x != null);
  const mins = Math.round(((s.endedAt || Date.now()) - s.startedAt) / 60000);
  let records = 0;
  const volEx = [];
  for (const e of s.exercises) {
    const st = entryStats(e);
    const prevBest = maxOf(historyBefore(e.exerciseId, s).map((h) => entryStats(h.entry).best));
    if (st.best && prevBest && st.best > prevBest) records++;
    const kg = e.sets.filter(isWork).reduce((a, x) => a + (x.w || 0) * (x.reps || 0), 0);
    if (kg) volEx.push({ label: exById(e.exerciseId)?.name || '?', v: kg });
  }
  // Comparación con sesiones anteriores del mismo nombre
  const same = s.title ? sortedSessions().filter((x) => norm(x.title) === norm(s.title) && sortKey(x) <= sortKey(s)) : [];
  const prev = same.find((x) => x.id !== s.id);
  const vol = sessionVolume(s);
  // Compara solo los ejercicios presentes en ambas sesiones (evita falsas caídas con la sesión a medias).
  const common = prev ? s.exercises.map((e) => e.exerciseId).filter((id) => prev.exercises.some((e) => e.exerciseId === id)) : [];
  const volIn = (x, ids) => x.exercises.filter((e) => ids.includes(e.exerciseId)).reduce((a, e) => a + e.sets.filter(isWork).reduce((b, z) => b + (z.w || 0) * (z.reps || 0), 0), 0);
  // Sesión abierta: no se compara con sesiones terminadas (una sesión a medias siempre parecería peor).
  const live = !s.endedAt;
  const trend = (live ? same.filter((x) => x.id !== s.id) : same).slice(0, 10).reverse().map((x) => ({ d: x.date, v: sessionVolume(x) })).filter((p) => p.v);
  const head = `<div class="stat"><b>${fmt(vol, 0)} kg ${prev && !live ? delta(volIn(s, common), volIn(prev, common)) : ''}</b><span>volumen ${info('volume')}</span></div>
      <div class="stat"><b>${all.length}</b><span>series efectivas ${info('work_sets')}</span></div>`;
  const recTxt = `<div class="stat"><b>${records ? '★ ' + records : '0'}</b><span>récords ${info('pr')}</span></div>`;
  // Mientras se entrena, el resumen va plegado: tres cifras y «Ver más».
  if (live && !ui.sumOpen?.[s.id]) {
    return `<h2>Resumen de la sesión</h2><div class="card sum-mini">
      <div class="stats">${head}${recTxt}</div>
      <button class="ghost block small-btn" data-action="sum-open" data-id="${s.id}" aria-expanded="false">Ver resumen completo ▾</button></div>`;
  }

  return `<h2>Resumen de la sesión</h2><div class="card">
    <div class="stats">
      ${head}
      <div class="stat"><b>${reps}</b><span>reps</span></div>
      ${rpes.length && !isSimple() ? `<div class="stat"><b>${fmt(mean(rpes))}</b><span>RPE medio ${info('rpe')}</span></div>` : ''}
      ${rirs.length ? `<div class="stat"><b>${fmt(mean(rirs))}</b><span>RIR medio ${info('rir')}</span></div>` : ''}
      ${recTxt}
      ${(() => { const r = restAvg(s.exercises.flatMap((e) => e.sets)); return r ? `<div class="stat"><b>${r.txt}</b><span>descanso medio ${info('rest')}</span></div>` : ''; })()}
      ${s.srpe && mins > 0 && !isSimple() ? `<div class="stat"><b>${s.srpe * mins} UA</b><span>carga interna ${info('load')}</span></div>` : ''}
    </div>
    ${live ? '<div class="muted small" style="margin-top:8px">Sesión en curso: la comparación con la anterior aparece al finalizarla.</div>' : prev ? `<div class="muted small" style="margin-top:8px">Variación de volumen frente a «${esc(prev.title)}» del ${fmtDate(prev.date)}, solo en los ejercicios comunes.</div>` : s.title ? '' : '<div class="muted small" style="margin-top:8px">Pon nombre a la sesión para compararla con las anteriores del mismo tipo.</div>'}
    ${isSimple() ? '' : fatigueBlock(s)}
    ${volEx.length ? `<h3 class="sub">Volumen por ejercicio (kg)</h3>${bars(volEx, '')}` : ''}
    ${systemOf(s) === 'si' ? siSummary(s) : ''}
    ${musclesBlock(s)}
    ${trend.length >= 2 ? `<h3 class="sub">Volumen en «${esc(s.title)}» (últimas ${trend.length}${live ? ' terminadas' : ''})</h3>${chart(trend)}` : ''}
    ${live ? `<button class="ghost block small-btn" data-action="sum-open" data-id="${s.id}" aria-expanded="true">Plegar el resumen ▴</button>` : ''}
  </div>`;
}

function siSummary(s) {
  const r = sessionSI(s);
  const pcts = s.exercises.filter((e) => (exById(e.exerciseId)?.mode || 'wr') === 'wr').flatMap((e) => e.sets.filter(isWork).map(pct1rm)).filter(Boolean);
  return `<h3 class="sub">Índice de estrés ${info('stress_index')}</h3>
    <div class="stats">
      <div class="stat"><b>${fmt(r.total, 1)}</b><span>IE de la sesión</span></div>
      ${pcts.length ? `<div class="stat"><b>${fmt(mean(pcts), 0)}%</b><span>%1RM medio ${info('pct1rm')}</span></div>` : ''}
    </div>
    ${r.missing ? `<div class="mismatch" style="margin:6px 0">${r.missing} series sin RPE ni RIR: no suman al índice.</div>` : ''}
`;
}
function musclesBlock(s) {
  const mode = systemOf(s), acc = sessionMuscles(s, mode);
  if (!Object.keys(acc).length) return '';
  return `<h3 class="sub">Músculos trabajados ${info('muscle_volume')}</h3>
    ${bodyMapHTML(acc, { unit: mode === 'si' ? 'índice de estrés' : 'series' })}
    ${bars(muscleItems(acc), '')}`;
}
function fatigueBlock(s) {
  const f = sessionFatigue(s);
  if (!f.drops.length && !f.nearFail) return '';
  const level = f.dropHigh >= 2 ? 'high' : f.dropHigh || f.nearFail >= 3 ? 'mid' : 'low';
  const msg = { high: 'Fatiga alta: valora cortar series o bajar carga en lo que queda.', mid: 'Fatiga moderada.', low: 'Fatiga controlada.' }[level];
  return `<h3 class="sub">Fatiga</h3>
    <div class="fat ${level}">${msg}</div>
    <div class="stats">
      <div class="stat"><b>${f.dropHigh}</b><span>series con caída ≥ ${db.settings.dropWarn}% ${info('drop')}</span></div>
      <div class="stat"><b>${f.nearFail}</b><span>al fallo, RIR 0 o RPE ≥ 9,5 ${info('near_fail')}</span></div>
    </div>`;
}
function bars(items, unit) {
  const max = Math.max(1, ...items.map((i) => i.v));
  return items.map((i) => `<div class="bar"><span>${esc(i.label)}</span><div><i style="width:${(i.v / max * 100).toFixed(1)}%"></i></div><b>${fmt(i.v, i.v % 1 ? 1 : 0)}${unit}</b></div>`).join('');
}

function scaleSelect(key, val, a, b) {
  let o = `<option value="">–</option>`;
  for (let i = a; i <= b; i++) o += `<option ${val == i ? 'selected' : ''}>${i}</option>`;
  return `<select data-s="${key}">${o}</select>`;
}
function rpeSelect(val, i, j) {
  let o = `<option value="">–</option>`;
  for (let r = 6; r <= 10; r += 0.5) o += `<option value="${r}" ${val == r ? 'selected' : ''}>${String(r).replace('.', ',')}</option>`;
  return `<select data-set="${i}:${j}:rpe" aria-label="RPE">${o}</select>`;
}

function rirSelect(val, i, j) {
  let o = `<option value="">–</option>`;
  for (let r = 0; r <= 6; r++) o += `<option value="${r}" ${val === r ? 'selected' : ''}>${r === 6 ? '6+' : r}</option>`;
  // El RIR se anota en enteros; un valor con medio punto (datos antiguos o deducido de un RPE) se muestra igualmente.
  if (val != null && val !== '' && !Number.isInteger(+val)) o += `<option value="${val}" selected>${String(val).replace('.', ',')}</option>`;
  return `<select data-set="${i}:${j}:rir" aria-label="RIR">${o}</select>`;
}

/* ---------- Tarjeta de ejercicio (registro de series) ---------- */
/* Superseries: ex.ss = enlazado con el siguiente. Un grupo es una cadena de ejercicios enlazados. */
function ssGroupOf(s, i) {
  let a = i; while (a > 0 && s.exercises[a - 1].ss) a--;
  let b = i; while (b < s.exercises.length - 1 && s.exercises[b].ss) b++;
  if (a === b) return null;
  let letter = 0; for (let k = 0; k < a; k++) if (s.exercises[k].ss && !(k > 0 && s.exercises[k - 1].ss)) letter++;
  return { a, b, pos: i - a + 1, size: b - a + 1, label: String.fromCharCode(65 + letter) };
}
function exerciseCard(s, ex, i) {
  const def = exById(ex.exerciseId) || { name: '(ejercicio borrado)', mode: 'wr' };
  const ssg = ssGroupOf(s, i);
  const mode = MODES[def.mode] || MODES.wr;
  const before = historyBefore(ex.exerciseId, s);
  const prev = before.find((h) => h.entry.sets.length);
  const st = entryStats(ex);
  const m = st.m;
  const pst = prev ? entryStats(prev.entry) : null;
  const prevBest = maxOf(before.map((h) => entryStats(h.entry).best));
  const open = ui.openEquip.has(ex.id);
  const chartOpen = ui.openChart.has(ex.id);
  // Nunca ocultar datos registrados: si hay series con RIR (o RPE) fuera del modo elegido, se muestran ambas columnas.
  let intF = intensityFields(def);
  if (!isSimple() && intF.length === 1) {
    const other = intF[0] === 'rpe' ? 'rir' : 'rpe';
    if (ex.sets.some((x) => x[other] != null && x[other] !== '')) intF = ['rpe', 'rir'];
  }
  const fields = [...mode.fields, ...intF];
  const siMode = systemOf(s) === 'si';
  const esi = entrySI(ex), pesi = prev ? entrySI(prev.entry) : null;

  const simple = isSimple();
  let rows = '';
  const wuJ = window.nextPendingSet ? nextPendingSet(s, i) : -1; // botón de calentamiento solo en la siguiente serie pendiente
  ex.sets.forEach((set, j) => {
    const est = isWork(set) ? m.best([set]) : null;
    const isPR = est && prevBest && est > prevBest;
    rows += `<tr class="${set.done ? 'done' : ''}">
      <td><button class="settype ${set.type}${set.videoId ? ' has-video' : ''}" data-action="cycle-type" data-i="${i}" data-j="${j}" title="${SET_TYPES[set.type]}">${set.type === 'E' ? j + 1 : set.type}</button></td>
      ${fields.map((f) => f === 'rpe' ? `<td>${rpeSelect(set.rpe, i, j)}</td>` : f === 'rir' ? `<td>${rirSelect(set.rir, i, j)}</td>`
        : `<td><input type="text" inputmode="${FIELD[f].step === '1' ? 'numeric' : 'decimal'}" autocomplete="off" enterkeyhint="next" data-set="${i}:${j}:${f}" value="${decIn(set[f])}" placeholder="${f === 'w' && def.mode === 'bw' ? '+0' : (f === 'w' || f === 'reps') && window.suggestPlaceholder ? suggestPlaceholder(s, i, j, f) : ''}">${f === 'w' && j === wuJ ? `<button class="mini-wu" data-action="warmup" data-i="${i}" data-j="${j}" aria-label="Calentamiento y discos">${ic('plate')}</button>` : ''}${simple ? '' : f === 'w' && def.mode === 'wr' ? `<small class="cap" id="cap-${i}-${j}">${set.type === 'C' ? '' : pctTxt(set)}</small>` : f === 'reps' && siMode ? `<small class="cap" id="si-${i}-${j}">${siTxt(set, def)}</small>` : ''}</td>`).join('')}
      <td><button class="check ${set.done ? 'on' : ''}" data-action="toggle-done" data-i="${i}" data-j="${j}" aria-label="Hecha">✓</button></td>
      <td><button class="icon ghost" data-action="set-menu" data-i="${i}" data-j="${j}" aria-label="Opciones de la serie ${j + 1}: vídeo, compartir, borrar">⋯</button></td>
    </tr>${isPR ? `<tr><td></td><td colspan="${fields.length + 1}" class="pr" style="text-align:left">★ Récord: ${fmtM(est, m)} (${m.label}) ${info('pr')}</td></tr>` : ''}`;
    const restRow = restRowHTML(ex, i, j, fields.length + 3); // serie + campos + ✓ + ⋯
    // ¿RIR bien anotado? También en modo sencillo: ayuda a aprender a calcularlo.
    const rc = rirCheck(ex.sets, j);
    if (rc) rows += `<tr><td></td><td colspan="${fields.length + 1}" class="mismatch rir-check">${ic('alert')} Rinde un ${fmt(rc.jump, 0)} % más que la serie ${rc.k + 1} (${fmt(rc.set.w)} × ${rc.set.reps} @ RIR ${fmt(rirOf(rc.set))}): ¿te quedaban más repeticiones en esa?${rc.implied != null ? ` Encaja mejor con <b>RIR ${rc.implied}</b>.` : ''} ${info('rir_check')}</td></tr>`;
    if (simple) { rows += restRow; return; }
    const drop = setDrop(ex.sets, j);
    if (drop != null && drop >= db.settings.dropWarn) rows += `<tr><td></td><td colspan="${fields.length + 1}" class="fatigue">${ic('alert')} Rendimiento −${fmt(drop, 0)}% frente a tu mejor serie de hoy: posible fatiga acumulada ${info('drop')}</td></tr>`;
    const mis = rpeRirMismatch(set);
    if (mis != null) rows += `<tr><td></td><td colspan="${fields.length + 1}" class="mismatch">RPE ${fmt(set.rpe)} y RIR ${fmt(set.rir)} no cuadran (RPE ${fmt(set.rpe)} ≈ RIR ${fmt(10 - set.rpe)}): ${mis > 0 ? 'más esfuerzo global que cercanía al fallo' : 'más cerca del fallo de lo que sentiste'} ${info('intensity')}</td></tr>`;
    rows += restRow; // el descanso va después de los avisos de la serie
  });

  const pts = [...before].reverse().map((h) => ({ d: h.sess.date, v: entryStats(h.entry).best })).filter((p) => p.v);
  if (st.best) pts.push({ d: s.date, v: st.best });
  const lastPts = pts.slice(-10);

  const eqSel = ex.equipment.map(eqById).filter(Boolean);
  return `<div class="card ${ssg ? 'ss-card' : ''}" data-ex="${i}">
    ${ssg ? `<div class="ss-tag">${ic('link')} Superserie ${ssg.label} · ${ssg.pos}/${ssg.size} ${info('superset')}</div>` : ''}
    <div class="ex-head">
      <h3><a href="#/exercise/${ex.exerciseId}" style="color:inherit;text-decoration:none">${esc(def.name)}</a></h3>
      ${simple ? '' : `<button class="icon ghost ${chartOpen ? 'active' : ''}" data-action="toggle-chart" data-i="${i}" aria-label="Gráfica y datos">${ic('chart')}</button>`}
      <button class="icon ghost" data-action="move-ex" data-i="${i}" data-d="-1" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>${ic('up')}</button>
      <button class="icon ghost" data-action="move-ex" data-i="${i}" data-d="1" aria-label="Bajar" ${i === s.exercises.length - 1 ? 'disabled' : ''}>${ic('down')}</button>
      <button class="icon ghost danger" data-action="del-ex" data-i="${i}" aria-label="Quitar ejercicio">${ic('trash')}</button>
    </div>
    ${simple ? '' : `<div class="exstats">
      <div><b>${fmtM(st.best, m)}</b> ${delta(st.best, pst?.best)}<span>${m.label} hoy ${st.mode === 'wr' ? info('e1rm') : ''}</span></div>
      ${siMode && ['wr', 'bw'].includes(def.mode) ? `<div><b>${fmt(esi.si, 1)}</b> ${delta(esi.si, pesi?.si)}<span>IE hoy ${info('stress_index')}</span></div>`
        : `<div><b>${fmtM(st.vol, m, m.volUnit)}</b> ${delta(st.vol, pst?.vol)}<span>volumen hoy ${info('volume')}</span></div>`}
      <div><b>${fmtM(prevBest, m)}</b><span>récord previo</span></div>
    </div>`}
    ${prev ? `<div class="prev">Anterior (${fmtDate(prev.sess.date)}): ${esc(setsText(prev.entry, prev.entry.sets))}${prev.entry.equipment.length ? ' · ' + esc(prev.entry.equipment.map((x) => eqById(x)?.name).filter(Boolean).join(', ')) : ''}</div>
      ${prev.entry.notes ? `<div class="prev">${ic('note')} ${esc(prev.entry.notes)}</div>` : ''}` : '<div class="prev">Primera vez que registras este ejercicio.</div>'}
    ${ex.tplName ? targetLineHTML(ex, def) : ''}
    ${chartOpen && !simple ? `<div class="insight">
      ${lastPts.length >= 2 ? `<div class="muted small">${m.label} por sesión (últimas ${lastPts.length})</div>${chart(lastPts)}` : '<div class="muted small">La gráfica aparece a partir de 2 sesiones con datos.</div>'}
      <div class="stats">
        <div class="stat"><b>${before.length + 1}</b><span>sesiones</span></div>
        <div class="stat"><b>${fmtM(maxOf([st.topW, ...before.map((h) => entryStats(h.entry).topW)]), m, 'kg')}</b><span>peso máx. histórico</span></div>
        ${st.mode === 'wr' && maxOf([st.best, prevBest]) ? `<div class="stat"><b>${fmt(Math.round(maxOf([st.best, prevBest]) * 0.8 / 2.5) * 2.5)} kg</b><span>80% del 1RM ${info('pct1rm')}</span></div>` : ''}
        <div class="stat"><b>${before.length ? fmtDate(before[0].sess.date).replace(/ \d{4}$/, '') : '–'}</b><span>última vez</span></div>
        ${restAvg(ex.sets) ? `<div class="stat"><b>${restAvg(ex.sets).txt}</b><span>descanso medio hoy</span></div>` : ''}
      </div>
    </div>` : ''}
    <div class="chips" style="margin-top:8px">
      ${simple ? '' : (open ? db.equipment : eqSel).map((e) => `<button class="chip ${ex.equipment.includes(e.id) ? 'on' : ''}" data-action="toggle-eq" data-i="${i}" data-eq="${e.id}">${esc(e.name)}</button>`).join('')}
      ${simple ? '' : `<button class="chip" data-action="open-eq" data-i="${i}">${open ? 'Listo' : '＋ Material'}</button>`}
      ${simple || open ? '' : `<button class="chip" data-action="rest-target" data-id="${def.id}" title="Descanso objetivo de este ejercicio">${ic('timer')} ${fmtSec(ex.restTarget ?? restTarget(def))}${ex.restTarget != null ? ' (tabla)' : def.rest != null ? '' : ' (general)'}</button>`}
      ${open ? '' : `<button class="chip" data-action="yt" data-id="${def.id}">${ic('play')} Técnica${def.refUrl ? ' ★' : ''}</button>`}
    </div>
    ${simple ? '' : `<div class="row" style="margin-top:8px"><button class="chip" data-action="cycle-intensity" data-i="${i}">Intensidad: <b>${INTENSITY[intensityOf(def)]}</b> ⇄</button>${info('intensity')}</div>`}
    ${window.suggestLineHTML ? suggestLineHTML(s, i) : ''}
    <table class="sets">
      <thead><tr><th title="Serie"># ${info('set_types')}</th>${fields.map((f) => `<th>${f === 'w' && def.mode === 'bw' ? 'Lastre' : FIELD[f].h}${f === 'rpe' || f === 'rir' ? ' ' + info(f) : ''}</th>`).join('')}<th>✓</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <button class="block" style="margin-top:8px" data-action="add-set" data-i="${i}">＋ Serie</button>
    <div style="height:8px"></div>
    <textarea data-exnote="${i}" placeholder="Notas: técnica, tempo, molestias, agarre…" rows="2">${esc(ex.notes)}</textarea>
  </div>`;
}

/* ---------- Progreso ---------- */
function viewExercises() {
  const q = norm(ui.search);
  const counts = {};
  for (const s of db.sessions) for (const e of s.exercises) counts[e.exerciseId] = (counts[e.exerciseId] || 0) + 1;
  let html = `<div class="row"><h1 class="spacer">Progreso</h1><button data-action="exercise-form">＋ Nuevo ejercicio</button></div>
    ${window.progressTopHTML ? progressTopHTML() : ''}
    ${isSimple() ? '' : `<a class="card list-item" href="#/analysis" style="display:flex;align-items:center;gap:10px">
      <span class="lead-ic">${ic('pulse')}</span><span class="spacer"><b>Análisis</b>
      <div class="muted small">Factores y rendimiento · índice de estrés semanal · intensidad relativa</div></span><span>›</span></a>`}
    <a class="card list-item" href="#/report" style="display:flex;align-items:center;gap:10px">
      <span class="lead-ic">${ic('file')}</span><span class="spacer"><b>Informe de evolución (PDF)</b>
      <div class="muted small">1, 3, 6 o 12 meses · evolución por ejercicio, carga, reparto y bienestar</div></span><span>›</span></a>
    ${db.exercises.some((x) => x.reviewMuscles) ? `<div class="card reminder"><b>${ic('alert')} Revisa los músculos de ${db.exercises.filter((x) => x.reviewMuscles).length} ejercicio(s) propio(s)</b>
      <div class="muted small" style="margin:4px 0 8px">Sus músculos se asignaron automáticamente (desde las categorías antiguas o al dividir «Hombros» en deltoides anterior, lateral y posterior).</div>
      <button class="primary block" data-action="review-muscles">Revisar</button></div>` : ''}
    ${window.exercisesHeaderHTML ? exercisesHeaderHTML() : ''}
    <input type="search" data-action-input="search" placeholder="Buscar ejercicio…" value="${esc(ui.search)}">
    <div style="height:12px"></div>`;
  // Favoritos primero; los ejercicios sin registros se ocultan salvo al buscar o al pedir «ver todos».
  const matching = db.exercises.filter((e) => norm(e.name).includes(q))
    .sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || (counts[b.id] || 0) - (counts[a.id] || 0) || a.name.localeCompare(b.name));
  const unused = matching.filter((e) => !counts[e.id] && !e.fav).length;
  const items = q || ui.showAllEx ? matching : matching.filter((e) => counts[e.id] || e.fav);
  if (!items.length) html += `<div class="empty">${q ? 'Ningún ejercicio coincide.' : 'Aún no has registrado ningún ejercicio.'}</div>`;
  for (const e of items) {
    const m = METRIC[e.mode] || METRIC.wr;
    const best = maxOf(historyFor(e.id).map((x) => entryStats(x.entry).best));
    html += `<a class="card list-item" href="#/exercise/${e.id}" style="padding:12px 14px">
      <div class="row"><span class="title spacer">${e.fav ? '<span class="fav-mark">★</span> ' : ''}${esc(e.name)}</span>
      ${counts[e.id] && window.exerciseRowExtra ? exerciseRowExtra(e) : ''}</div>
      <div class="muted small">${counts[e.id] ? `${counts[e.id]} ${counts[e.id] === 1 ? 'sesión' : 'sesiones'}${best ? ` · ${m.label} ${fmtM(best, m)}` : ''}` : esc(muscleLabel(e))}</div></a>`;
  }
  if (!q && unused) html += `<button class="block ghost" data-action="show-all-ex">${ui.showAllEx ? 'Ocultar los ejercicios sin registros' : `Ver también los ${unused} ejercicios sin registros`}</button>`;
  return html;
}

function viewExercise(id) {
  const def = exById(id);
  if (!def) return `<div class="empty">Ejercicio no encontrado. <a href="#/exercises">Volver</a></div>`;
  const m = METRIC[def.mode] || METRIC.wr;
  const all = historyFor(id);
  const usedEq = [...new Set(all.flatMap((h) => h.entry.equipment))].map(eqById).filter(Boolean);
  const f = ui.filterEq;
  const hist = all.filter((h) => f === 'all' ? true : f === 'none' ? h.entry.equipment.length === 0 : h.entry.equipment.includes(f));

  let best = null, topW = null, totalVol = 0;
  for (const h of hist) {
    const st = entryStats(h.entry);
    if (st.best && (!best || st.best > best.v)) best = { v: st.best, d: h.sess.date };
    if (st.topW && (!topW || st.topW > topW.v)) topW = { v: st.topW, d: h.sess.date };
    totalVol += st.vol;
  }

  let html = `<div class="row"><a class="btn ghost" href="#/exercises">‹ Progreso</a><span class="spacer"></span>
      <button class="ghost" data-action="yt" data-id="${def.id}">${ic('play')} Técnica</button>
      <button class="icon ghost" data-action="exercise-form" data-id="${def.id}" aria-label="Editar ejercicio" title="Editar">${ic('edit')}</button>${window.favBtn ? favBtn(def) : ''}</div>
    <h1>${esc(def.name)}</h1>
    <div class="muted small">${esc(muscleDesc(def))} · ${esc(MODES[def.mode]?.label)}</div>`;
  if (usedEq.length) {
    html += `<h2>Filtrar por material</h2><div class="chips">
      <button class="chip ${f === 'all' ? 'on' : ''}" data-action="filter-eq" data-eq="all">Todo</button>
      <button class="chip ${f === 'none' ? 'on' : ''}" data-action="filter-eq" data-eq="none">Sin material</button>
      ${usedEq.map((e) => `<button class="chip ${f === e.id ? 'on' : ''}" data-action="filter-eq" data-eq="${e.id}">Con ${esc(e.name)}</button>`).join('')}
    </div>`;
  }
  html += `<div class="card" style="margin-top:12px"><div class="stats">
      <div class="stat"><b>${best ? fmtM(best.v, m) : '–'}</b><span>mejor ${m.label} ${def.mode === 'wr' ? info('e1rm') : ''}</span></div>
      ${def.mode === 'wr' || def.mode === 'bw' ? `<div class="stat"><b>${topW ? fmt(topW.v) + ' kg' : '–'}</b><span>peso máximo</span></div>` : ''}
      <div class="stat"><b>${hist.length}</b><span>sesiones</span></div>
      <div class="stat"><b>${fmtM(totalVol, m, m.volUnit)}</b><span>volumen total ${info('volume')}</span></div>
    </div></div>`;

  const pts = hist.map((h) => ({ d: h.sess.date, v: entryStats(h.entry).best })).filter((p) => p.v).reverse();
  if (pts.length >= 2) html += `<h2>Evolución · ${m.label} ${def.mode === 'wr' ? info('e1rm_trend') : ''}</h2><div class="card">${window.progressChartHTML ? progressChartHTML(def, hist) : chart(pts)}</div>`;

  if (window.sameWeightHTML) html += sameWeightHTML(def, hist);
  if (best && def.mode === 'wr') {
    html += `<h2>Tabla de cargas (1RM est. ${fmt(best.v)} kg) ${info('load_table')}</h2><div class="card"><div class="stats">
      ${[1, 2, 3, 5, 8, 10, 12].map((r) => `<div class="stat"><b>${fmt(Math.round(best.v * RTS[(r - 1) * 2] / 100 / 2.5) * 2.5)} kg</b><span>${r} rep @10</span></div>`).join('')}
    </div></div>`;
  }

  html += `<h2>Historial</h2>`;
  if (!hist.length) html += `<div class="empty">Sin registros${f !== 'all' ? ' con este filtro' : ''}.</div>`;
  const HIST_N = 5, showAll = ui.histAll === id;
  for (const h of showAll ? hist : hist.slice(0, HIST_N)) {
    const st = entryStats(h.entry);
    html += `<a class="card list-item" href="#/session/${h.sess.id}">
      <div class="row"><b>${fmtDate(h.sess.date)}</b><span class="spacer"></span>${st.best ? `<span class="muted small">${m.label} ${fmtM(st.best, m)}</span>` : ''}</div>
      <div>${esc(setsText(h.entry, h.entry.sets))}</div>
      ${h.entry.equipment.length ? `<div>${h.entry.equipment.map((x) => eqById(x)).filter(Boolean).map((e) => `<span class="tag">${esc(e.name)}</span>`).join('')}</div>` : ''}
      ${h.entry.notes ? `<div class="muted small" style="margin-top:4px">${ic('note')} ${esc(h.entry.notes)}</div>` : ''}
    </a>`;
  }
  if (hist.length > HIST_N) html += `<button class="block ghost" data-action="hist-all" data-id="${id}">${showAll ? 'Ver solo las últimas 5' : `Ver todas (${hist.length})`}</button>`;
  return html;
}

function chart(pts, label = 'Evolución') {
  const W = 320, H = 150, P = 28;
  const vs = pts.map((p) => p.v), min = Math.min(...vs), max = Math.max(...vs), span = max - min || 1;
  const x = (i) => P + (i * (W - P - 8)) / (pts.length - 1);
  const y = (v) => H - P + 8 - ((v - min) / span) * (H - P - 8);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
    <line class="ax" x1="${P}" y1="${H - P + 8}" x2="${W}" y2="${H - P + 8}"/>
    <text x="2" y="${y(max) + 4}">${Math.round(max)}</text><text x="2" y="${y(min) + 4}">${Math.round(min)}</text>
    <text x="${P}" y="${H - 4}">${pts[0].d.slice(5)}</text><text x="${W - 34}" y="${H - 4}">${pts[pts.length - 1].d.slice(5)}</text>
    <path class="ln" d="${d}"/>${pts.map((p, i) => `<circle class="pt" cx="${x(i)}" cy="${y(p.v)}" r="3"/>`).join('')}
  </svg>`;
}

function viewSettings() {
  const used = new Set(db.sessions.flatMap((s) => s.exercises.flatMap((e) => e.equipment)));
  const simple = isSimple();
  // Tres grupos: entreno, tus datos y acerca de. En modo sencillo se ocultan los ajustes avanzados (no se borran).
  return `<h1>Ajustes</h1>
    <div class="sgroup">Entreno</div>
    <h2>Modo de atleta ${info('level')}</h2>
    <div class="card">
      <div class="seg" style="margin-bottom:8px">${Object.entries(LEVELS).map(([k, v]) => `<button class="${db.settings.level === k ? 'on' : ''}" data-action="set-level" data-l="${k}">${v}</button>`).join('')}</div>
      <div class="muted small">${isSimple()
        ? '<b>Sencillo:</b> series, peso, repeticiones, RIR y descansos. Oculta RPE, material, índice de estrés, %1RM, fatiga, «antes de empezar», y análisis y ajustes avanzados.'
        : '<b>Avanzado:</b> todo: RPE y RIR, material, sensaciones y factores, índice de estrés, %1RM, fatiga, análisis e informes completos.'}
        Se aplica a ${esc(activeUser().name)}; no se borra nada al cambiar de modo.</div>
    </div>
    <h2>Descansos</h2>
    <div class="card">
      <label>Descanso por defecto entre series (segundos)</label>
      <input type="number" inputmode="numeric" step="15" data-setting="rest" value="${db.settings.rest}">
      <div class="muted small" style="margin-top:6px">El temporizador arranca al marcar una serie como hecha (0 = sin temporizador). El descanso es un dato tuyo: escríbelo en el campo «Descanso» bajo cada serie, o pulsa <b>«Parar»</b> en el cronómetro y se rellenará con el tiempo transcurrido. Siempre puedes corregirlo. ${isSimple() ? '' : 'Cada ejercicio puede tener su propio descanso objetivo (botón del cronómetro en la tarjeta del ejercicio).'}</div>
    </div>
    ${window.closeSettingsHTML ? closeSettingsHTML() : ''}
    ${window.weightsSettingsHTML ? weightsSettingsHTML() : ''}
    <h2>Ejercicios</h2>
    <div class="card"><button class="block" data-action="manage-exercises">Gestionar catálogo (${db.exercises.length})</button></div>
    ${simple ? '' : `    <h2>Material</h2>
    <div class="card">
      <div class="chips">${db.equipment.map((e) => `<span class="chip">${esc(e.name)} <button class="ghost" style="min-height:0;padding:0 0 0 6px" data-action="del-equipment" data-id="${e.id}" aria-label="Borrar">✕</button></span>`).join('')}</div>
      <div class="row" style="margin-top:10px"><input id="new-eq" placeholder="Nuevo material (p. ej. Rodilleras 7mm)"><button data-action="add-equipment">Añadir</button></div>
      ${used.size ? '<div class="muted small" style="margin-top:6px">El material ya usado en sesiones no se puede borrar.</div>' : ''}
    </div>
    <h2>Microciclo ${info('athlete_week')}</h2>
    <div class="card">
      <div class="grid2">
        <div><label>Duración</label><select data-setting="weekLen">${[5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((n) => `<option value="${n}" ${cycleLen() === n ? 'selected' : ''}>${n} días${n === 7 ? ' (semana)' : ''}</option>`).join('')}</select></div>
        <div>${isCustomCycle()
          ? `<label>Un ciclo empieza el</label><input type="date" data-setting-str="cycleAnchor" value="${esc(weekStart(todayISO()))}">`
          : `<label>Empieza el</label><select data-setting="weekDow">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<option value="${d}" ${cycleDow() === d ? 'selected' : ''}>${DOW[d]}</option>`).join('')}</select>`}</div>
      </div>
      <div class="muted small" style="margin-top:6px">${isCustomCycle()
        ? `Ciclo actual: <b>${fmtDate(weekStart(todayISO()))}</b> – <b>${fmtDate(weekEnd(weekStart(todayISO())))}</b>.`
        : `Semana actual: <b>${fmtDate(weekStart(todayISO()))}</b> – <b>${fmtDate(weekEnd(weekStart(todayISO())))}</b>.`}
        Se usa en las series por músculo, la constancia, el análisis semanal y los informes${isCustomCycle() ? '' : ', y el calendario empieza ese día'}. Por defecto, de lunes a domingo.</div>
    </div>
`}
    ${simple || !window.landmarksSettingsHTML ? '' : `<h2>Volumen por músculo</h2>${landmarksSettingsHTML()}`}
    ${simple ? '' : `    <h2>Series efectivas</h2>
    <div class="card">
      <label>Cuenta como serie efectiva ${info('hard_sets')}</label>
      <select data-setting="hardRir">${[[4, 'RIR 4 o menos (recomendado)'], [3, 'RIR 3 o menos (más estricto)']].map(([v, l]) => `<option value="${v}" ${(db.settings.hardRir ?? 4) === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <div class="muted small" style="margin-top:6px">Se usa en Progreso para contar las series semanales por músculo.</div>
    </div>
`}
    ${isSimple() ? '' : `<h2>Intensidad y fatiga</h2>
    <div class="card">
      <label>Medir la intensidad por defecto con ${info('intensity')}</label>
      <select data-setting-str="intensity">${Object.entries(INTENSITY).map(([k, v]) => `<option value="${k}" ${db.settings.intensity === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <div class="muted small" style="margin:6px 0 10px">Se aplica a los ejercicios en los que no hayas elegido otra cosa. En cada ejercicio puedes cambiarlo con «Intensidad ⇄».</div>
      <label>Cuantificar las sesiones nuevas con ${info('system')}</label>
      <select data-setting-str="system">${Object.entries(SYSTEMS).map(([k, v]) => `<option value="${k}" ${db.settings.system === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <div style="height:10px"></div>
      <label>Aviso de caída de rendimiento entre series (%) ${info('drop')}</label>
      <input type="number" inputmode="numeric" data-setting="dropWarn" value="${db.settings.dropWarn}">
    </div>`}
    <div class="sgroup">Tus datos</div>
    <h2>Usuarios</h2>
    <a class="card list-item" href="#/users" style="display:flex;align-items:center;gap:10px">${avatar(activeUser(), 40)}
      <span class="spacer"><b>${esc(activeUser().name)}</b><div class="muted small">${profiles.users.length} usuario${profiles.users.length === 1 ? '' : 's'} en este dispositivo · crear o cambiar</div></span><span>›</span></a>
    <h2>Copia de seguridad</h2>
    <div class="card">
      <div class="muted small" style="margin-bottom:8px">Tus datos se guardan solo en este dispositivo. Guarda una copia en los archivos del móvil con frecuencia y, de vez en cuando, pásala a un ordenador: si se borran los datos del navegador o pierdes el móvil, se pierde todo.</div>
      ${window.backupStatusHTML ? backupStatusHTML() : ''}
      ${window.autoBackupSettingsHTML ? autoBackupSettingsHTML() : ''}
      <button class="primary block" data-action="export-all" style="margin-bottom:8px">${ic('save')} Guardar copia en el móvil (todos los usuarios)</button>
      <div class="muted small" style="margin-bottom:6px">Solo ${esc(activeUser().name)}:</div>
      <div class="grid2">
        <button data-action="export-json">${ic('download')} Exportar JSON</button>
        <button data-action="import-json">${ic('upload')} Importar JSON</button>
        <button data-action="export-csv">${ic('download')} Exportar CSV</button>
        <button class="danger" data-action="wipe">Borrar sus datos</button>
      </div>
      <div class="muted small" style="margin-top:6px">«Importar JSON» acepta una copia de un usuario (sustituye al activo) o una copia de todos (sustituye a todos).</div>
      <button class="block" style="margin-top:8px" data-action="athlete-export">${ic('share')} Enviar mis datos al entrenador ${info('athlete_share')}</button>
      <input type="file" id="import-file" accept="application/json,.json" class="hidden">
    </div>
    <h2>Copias automáticas</h2>
    <div class="card">
      <div class="muted small" style="margin-bottom:8px">La app guarda sola una copia al día y otra antes de restaurar, importar o borrar. Se conservan las últimas 14, <b>dentro de la app</b>: sirven para deshacer errores, no sustituyen a guardar la copia en el móvil.</div>
      <div id="snap-list" class="small">Cargando…</div>
      <button class="block" style="margin-top:8px" data-action="snap-now">Crear una copia ahora</button>
    </div>
    <h2>Vídeos</h2>
    <div class="card">
      <div id="video-stats" class="small">Calculando…</div>
      <div class="muted small" style="margin:8px 0">Los vídeos se guardan dentro de la app y <b>no</b> se incluyen en la copia de seguridad. Para conservarlos, ábrelos desde la serie (⋯) y usa «Guardar en el móvil».</div>
      <button class="danger block" data-action="delete-videos">Borrar todos los vídeos de ${esc(activeUser().name)}</button>
    </div>
    <p class="muted small">${esc(activeUser().name)}: ${db.sessions.length} ${db.sessions.length === 1 ? 'sesión guardada' : 'sesiones guardadas'}.</p>
    <div class="sgroup">Acerca de</div>
    ${window.versionSettingsHTML ? versionSettingsHTML() : ''}
    ${window.privacySettingsHTML ? privacySettingsHTML() : ''}`;
}

/* ---------- Informe de evolución (imprimible / PDF) ---------- */
const PERIODS = { 1: '1 mes', 3: '3 meses', 6: '6 meses', 12: '1 año' };
const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function periodRange(months) {
  const end = todayISO();
  const s = new Date(end + 'T12:00'); s.setMonth(s.getMonth() - months); s.setDate(s.getDate() + 1);
  const pe = new Date(s); pe.setDate(pe.getDate() - 1);
  const ps = new Date(s); ps.setMonth(ps.getMonth() - months);
  return { start: isoOf(s), end, prevStart: isoOf(ps), prevEnd: isoOf(pe) };
}
const inRange = (sess, a, b) => sess.date >= a && sess.date <= b;
const fmtLong = (iso) => new Date(iso + 'T12:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

// Indicadores de bienestar y actividad de un periodo: [etiqueta, valores, unidad, decimales].
const wellbeingKpis = (cur) => [['Sueño medio', cur.sleep, ' h'], ['Energía media (1-5)', cur.readiness, ''], ['Estrés medio (1-5)', cur.stress, ''],
  ['Pasos al día', cur.steps || [], '', 0], ['Calorías al día', cur.kcal || [], ' kcal', 0]].filter(([, v]) => v.length);
function periodStats(a, b) {
  const list = db.sessions.filter((s) => inRange(s, a, b)).sort((x, y) => sortKey(x).localeCompare(sortKey(y)));
  const out = { sessions: list, n: list.length, sets: 0, volume: 0, si: 0, durations: [], srpe: [], prs: 0, setsCat: {}, pcts: [], bw: [], sleep: [], readiness: [], stress: [], factors: {}, steps: [], kcal: [] };
  for (const [d, v] of Object.entries(db.daily || {})) if (d >= a && d <= b) { if (v.steps != null) out.steps.push(v.steps); if (v.kcal != null) out.kcal.push(v.kcal); }
  for (const s of list) {
    out.volume += sessionVolume(s);
    out.si += sessionSI(s).total;
    if (s.endedAt && s.startedAt && s.endedAt > s.startedAt) out.durations.push((s.endedAt - s.startedAt) / 60000);
    if (s.srpe) out.srpe.push(s.srpe);
    if (s.bodyweight && !window.bodyweightLog) out.bw.push({ d: s.date, v: s.bodyweight });
    for (const k of ['sleep', 'readiness', 'stress']) if (s[k] != null) out[k].push(s[k]);
    for (const f of s.factors || []) out.factors[f] = (out.factors[f] || 0) + 1;
    for (const e of s.exercises) {
      const def = exById(e.exerciseId);
      const work = e.sets.filter(isWork);
      out.sets += work.length;
      addShares(out.setsCat, def, work.length);
      if ((def?.mode || 'wr') === 'wr') for (const x of work) { const p = pct1rm(x); if (p) out.pcts.push(p); }
      const best = entryStats(e).best;
      const prevBest = maxOf(historyBefore(e.exerciseId, s).map((h) => entryStats(h.entry).best));
      if (best && prevBest && best > prevBest) out.prs++;
    }
  }
  if (window.bodyweightLog) out.bw = bodyweightLog().filter((r) => r.d >= a && r.d <= b); // sesiones + anotados en Progreso o en el día
  return out;
}

// Evolución de un ejercicio: media de las 2 primeras sesiones frente a la media de las 2 últimas.
function exerciseEvolution(exId, a, b) {
  const def = exById(exId);
  const m = METRIC[def?.mode] || METRIC.wr;
  const hist = historyFor(exId).filter((h) => inRange(h.sess, a, b)).reverse();
  const pts = hist.map((h) => ({ d: h.sess.date, v: entryStats(h.entry).best })).filter((p) => p.v);
  const k = Math.min(2, Math.floor(pts.length / 2));
  const startV = k ? mean(pts.slice(0, k).map((p) => p.v)) : null;
  const endV = k ? mean(pts.slice(-k).map((p) => p.v)) : null;
  const vol = hist.reduce((acc, h) => acc + entryStats(h.entry).vol, 0);
  const pcts = def?.mode === 'wr' ? hist.flatMap((h) => h.entry.sets.filter(isWork).map(pct1rm)).filter(Boolean) : [];
  const topW = maxOf(hist.map((h) => entryStats(h.entry).topW));
  const best = maxOf(pts.map((p) => p.v));
  return { def, m, hist, pts, startV, endV, change: startV && endV ? (endV / startV - 1) * 100 : null, vol, pcts, topW, best };
}

// Semanas completas (lunes-domingo) dentro de [start, end] y ya terminadas.
function completeWeeks(start, end) {
  const out = [];
  for (let w = weekStart(start); w <= end; ) {
    const last = weekEnd(w);
    if (w >= start && last <= end && last < todayISO()) out.push(w);
    w = isoFromNum(dayNum(w) + cycleLen());
  }
  return out;
}

function reportExercises(a, b) {
  const counts = {};
  for (const s of db.sessions) if (inRange(s, a, b)) for (const e of s.exercises) if (e.sets.some(isWork)) counts[e.exerciseId] = (counts[e.exerciseId] || 0) + 1;
  return Object.entries(counts).sort((x, y) => y[1] - x[1]).map(([id, n]) => ({ id, n, def: exById(id) })).filter((x) => x.def);
}

function viewReport() {
  const months = ui.rPeriod || 3;
  const { start, end, prevStart, prevEnd } = periodRange(months);
  const avail = reportExercises(start, end);
  if (!ui.rSel || ui.rSelPeriod !== months) { ui.rSel = new Set(avail.slice(0, 6).map((x) => x.id)); ui.rSelPeriod = months; }
  const u = activeUser();
  const cur = periodStats(start, end), prev = periodStats(prevStart, prevEnd);
  const weeks = Math.max(1, (Date.parse(end) - Date.parse(start)) / (7 * 864e5));

  // Controles (no se imprimen)
  let html = `<div class="no-print">
    <div class="row"><a class="btn ghost" href="#/exercises">‹ Progreso</a></div>
    <h1>Informe de evolución</h1>
    <label>Periodo</label>
    <div class="seg">${Object.entries(PERIODS).map(([k, v]) => `<button class="${+k === months ? 'on' : ''}" data-action="r-period" data-m="${k}">${v}</button>`).join('')}</div>
    <label>Ejercicios incluidos (${ui.rSel.size})</label>
    <div class="chips" style="margin-bottom:12px">${avail.length ? avail.map((x) => `<button class="chip ${ui.rSel.has(x.id) ? 'on' : ''}" data-action="r-ex" data-id="${x.id}">${esc(x.def.name)} <small>${x.n}</small></button>`).join('') : '<span class="muted small">No hay ejercicios registrados en este periodo.</span>'}</div>
    <label>Comentarios del entrenador (aparecen en el informe)</label>
    <textarea data-report-note placeholder="Valoración del periodo, objetivos para el siguiente bloque…">${esc(db.reportNote || '')}</textarea>
    <div class="grid2" style="margin:12px 0">
      <button class="primary" data-action="r-pdf" ${cur.n ? '' : 'disabled'}>${ic('file')} Generar PDF</button>
      <button data-action="r-print" ${cur.n ? '' : 'disabled'}>${ic('printer')} Imprimir</button>
    </div>
    <div class="muted small" style="margin-bottom:16px">«Generar PDF» crea el archivo en el propio móvil (también en iPhone) y te deja compartirlo o guardarlo. «Imprimir» usa el diálogo del sistema.</div>
  </div>`;

  if (!cur.n) return html + `<div class="empty">No hay sesiones entre el ${fmtLong(start)} y el ${fmtLong(end)}.</div>`;

  const avgDur = mean(cur.durations), avgSrpe = mean(cur.srpe);
  const bwFirst = cur.bw[0], bwLast = cur.bw[cur.bw.length - 1];
  html += `<article class="report">
    <header class="r-head">
      <div class="row">${avatar(u, 48)}<div class="spacer"><div class="r-kicker">Informe de evolución · ${PERIODS[months]}</div>
        <h1 style="margin:2px 0">${esc(u.name)}</h1>
        ${u.goal ? `<div class="muted">${ic('target')} ${esc(u.goal)}</div>` : ''}</div></div>
      <div class="muted small" style="margin-top:8px">Del ${fmtLong(start)} al ${fmtLong(end)} · generado el ${fmtLong(todayISO())}</div>
    </header>

    <section class="rsec"><h2>Resumen del periodo</h2>
      <div class="kpis">
        ${kpi(cur.n, 'sesiones', prev.n)}
        ${kpi(fmt(cur.n / weeks, 1), 'sesiones / semana')}
        ${kpi(cur.sets, 'series efectivas', prev.sets)}
        ${kpi(fmt(cur.volume / 1000, 1) + ' t', 'volumen', null, cur.volume, prev.volume)}
        ${cur.si ? kpi(fmt(cur.si, 0), 'índice de estrés', null, cur.si, prev.si) : ''}
        ${kpi(cur.prs, 'récords estimados')}
        ${avgDur ? kpi(Math.round(avgDur) + ' min', 'duración media') : ''}
        ${avgSrpe ? kpi(fmt(avgSrpe, 1), 'RPE medio de sesión') : ''}
        ${cur.pcts.length ? kpi(fmt(mean(cur.pcts), 0) + '%', '%1RM medio') : ''}
        ${bwFirst && bwLast && cur.bw.length >= 2 ? kpi(`${fmt(bwLast.v, 1)} kg`, `peso (${bwLast.v - bwFirst.v >= 0 ? '+' : ''}${fmt(bwLast.v - bwFirst.v, 1)} kg)`) : ''}
      </div>
      ${prev.n ? `<div class="muted small">Las flechas comparan con el periodo anterior de igual duración (${fmtLong(prevStart)} – ${fmtLong(prevEnd)}).</div>` : ''}
    </section>`;

  // Ejercicios
  const sel = avail.filter((x) => ui.rSel.has(x.id));
  if (sel.length) {
    const evo = sel.map((x) => exerciseEvolution(x.id, start, end));
    html += `<section class="rsec"><h2>Evolución por ejercicio</h2>
      <table class="gt rtable"><tr><th>Ejercicio</th><th>Inicio</th><th>Final</th><th>Cambio</th><th>Mejor</th><th>Ses.</th></tr>
      ${evo.map((e) => `<tr><td>${esc(e.def.name)}</td><td>${e.startV ? fmtM(e.startV, e.m) : '–'}</td><td>${e.endV ? fmtM(e.endV, e.m) : '–'}</td>
        <td class="${e.change > 0.5 ? 'up' : e.change < -0.5 ? 'down' : ''}"><b>${e.change == null ? '–' : `${e.change > 0 ? '+' : ''}${fmt(e.change, 1)}%`}</b></td>
        <td>${e.best ? fmtM(e.best, e.m) : '–'}</td><td>${e.hist.length}</td></tr>`).join('')}
      </table>
      <div class="muted small" style="margin-top:6px">Inicio y final = media de las 2 primeras y de las 2 últimas sesiones del periodo (1RM estimado en ejercicios con peso), para que un día suelto bueno o malo no distorsione la evolución. Con menos de 2 sesiones no se calcula.</div>
      <div class="r-grid">
      ${evo.map((e) => `<div class="rcard"><div class="row"><b class="spacer">${esc(e.def.name)}</b>
          ${e.change != null ? `<span class="delta ${e.change > 0.5 ? 'up' : e.change < -0.5 ? 'down' : ''}">${e.change > 0 ? '▲' : e.change < 0 ? '▼' : ''}${fmt(Math.abs(e.change), 1)}%</span>` : ''}</div>
        <div class="muted small">${e.m.label} por sesión</div>
        ${e.pts.length >= 2 ? chart(e.pts, `${e.m.label} de ${e.def.name}`) : '<div class="muted small" style="padding:20px 0">Solo una sesión con datos.</div>'}
        <div class="mini">${e.topW ? `<span>Peso máx. <b>${fmt(e.topW)} kg</b></span>` : ''}<span>Volumen <b>${fmtM(e.vol, e.m, e.m.volUnit)}</b></span>${e.pcts.length ? `<span>%1RM medio <b>${fmt(mean(e.pcts), 0)}%</b></span>` : ''}</div>
      </div>`).join('')}
      </div></section>`;
  }

  // Carga semanal
  // Solo semanas completas dentro del periodo: la primera (empezada a mitad) y la actual (en curso) distorsionarían la gráfica.
  const wks = completeWeeks(start, end);
  const wData = Object.fromEntries(wks.map((w) => [w, { vol: 0, si: 0, n: 0 }]));
  for (const s of cur.sessions) { const w = wData[weekStart(s.date)]; if (w) { w.vol += sessionVolume(s); w.si += sessionSI(s).total; w.n++; } }
  const volPts = wks.map((w) => ({ d: w, v: Math.round(wData[w].vol) }));
  const siPts = wks.map((w) => ({ d: w, v: Math.round(wData[w].si * 10) / 10 }));
  if (wks.length >= 2) {
    html += `<section class="rsec"><h2>Carga semanal</h2><div class="muted small">Semanas completas (de lunes a domingo) dentro del periodo.</div><div class="r-grid">
      <div class="rcard"><b>Volumen (kg) por semana</b>${chart(volPts, 'Volumen semanal')}</div>
      ${cur.si ? `<div class="rcard"><b>Índice de estrés por semana</b>${chart(siPts, 'Índice de estrés semanal')}</div>` : ''}
      </div></section>`;
  }

  // Reparto e intensidad
  const catItems = muscleItems(cur.setsCat);
  // Figura: media semanal por músculo, para que la escala signifique lo mismo en 1 mes que en 1 año.
  const muscleWeekly = Object.fromEntries(Object.entries(cur.setsCat).map(([m, v]) => [m, v / weeks]));
  if (Object.keys(muscleWeekly).length) {
    html += `<section class="rsec"><h2>Volumen por músculo ${info('muscle_volume')}</h2><div class="rcard">
      ${bodyMapHTML(muscleWeekly, { steps: [5, 10, 15, 20], unit: 'series / semana' })}
      <div class="muted small">Media semanal de series efectivas en el periodo (principal 1, secundario 0,5).</div></div></section>`;
  }
  html += `<section class="rsec"><h2>Reparto del entrenamiento</h2><div class="r-grid">
    <div class="rcard"><b>Series por músculo</b><div class="muted small">Principal 1 · secundario 0,5</div>${bars(catItems, '')}</div>
    ${cur.pcts.length ? `<div class="rcard"><b>Series por zona de intensidad (%1RM)</b>${bars(ZONES.map(([label, t]) => ({ label, v: cur.pcts.filter(t).length })), '')}</div>` : ''}
  </div></section>`;

  // Bienestar
  const wb = wellbeingKpis(cur);
  const topF = Object.entries(cur.factors).sort((x, y) => y[1] - x[1]).slice(0, 5);
  if (wb.length || cur.bw.length >= 2 || topF.length) {
    html += `<section class="rsec"><h2>Bienestar, actividad y composición</h2><div class="r-grid">
      ${wb.length || topF.length ? `<div class="rcard"><div class="kpis">${wb.map(([l, v, u2, dec]) => kpi(fmt(mean(v), dec ?? 1) + u2, `${l} (n=${v.length})`)).join('')}</div>
        ${topF.length ? `<div class="muted small" style="margin-top:6px">Factores más marcados: ${topF.map(([f, n]) => `${esc(f)} (${n})`).join(', ')}</div>` : ''}</div>` : ''}
      ${cur.bw.length >= 2 ? `<div class="rcard"><b>Peso corporal (kg)</b>${chart(cur.bw, 'Peso corporal')}</div>` : ''}
    </div></section>`;
  }

  if (db.reportNote && db.reportNote.trim()) html += `<section class="rsec"><h2>Comentarios del entrenador</h2><div class="rcard r-note">${esc(db.reportNote).replace(/\n/g, '<br>')}</div></section>`;

  html += `<footer class="r-foot muted small">1RM estimado e intensidad relativa calculados con la tabla RTS a partir de repeticiones y RIR/RPE; son estimaciones que dependen de que el esfuerzo se registre con honestidad.
    Índice de estrés: multiarticular 1,4 − 0,2·RIR, monoarticular 1,3 − 0,2·RIR. Generado con Diario de entrenamiento.</footer>
  </article>`;
  return html;
}
function kpi(value, label, prevN = null, curV = null, prevV = null) {
  const d = prevN != null ? delta(+value, prevN) : curV != null && prevV ? delta(curV, prevV) : '';
  return `<div class="kpi"><b>${value}</b> ${d}<span>${label}</span></div>`;
}

/* ---------- Usuarios ---------- */
function viewUsers() {
  const list = [...profiles.users].sort((a, b) => (b.id === profiles.active) - (a.id === profiles.active) || a.name.localeCompare(b.name));
  let html = `<div class="row"><h1 class="spacer">Usuarios</h1><button class="primary" data-action="user-form">＋ Nuevo</button></div>
    <div class="card muted small">Cada usuario tiene sus propias sesiones, ejercicios, material y ajustes. Los perfiles se guardan <b>solo en este dispositivo</b>:
      exporta la copia de todos con regularidad en Ajustes.</div>
    <button class="block" style="margin-bottom:12px" data-action="athlete-import">${ic('upload')} Importar datos de un atleta ${info('athlete_share')}</button>
    <input type="file" id="athlete-file" accept="application/json,.json" class="hidden">`;
  for (const u of list) {
    const d = u.id === profiles.active ? db : readUserData(u.id);
    const sess = d ? d.sessions : [];
    const last = sess.reduce((m, x) => x.date > m ? x.date : m, '');
    const active = u.id === profiles.active;
    html += `<div class="card ${active ? 'active-user' : ''}">
      <div class="row">${avatar(u, 44)}
        <div class="spacer"><b>${esc(u.name)}</b> ${active ? '<span class="tag on">Activo</span>' : ''}
          ${u.goal ? `<div class="muted small">${ic('target')} ${esc(u.goal)}</div>` : ''}
          ${window.profileLine && profileLine(u) ? `<div class="muted small">${esc(profileLine(u))}</div>` : ''}
          <div class="muted small">${sess.length} ${sess.length === 1 ? 'sesión' : 'sesiones'}${last ? ` · última: ${fmtDate(last)}` : ''}</div></div>
        <button class="icon ghost" data-action="user-form" data-id="${u.id}" aria-label="Editar ${esc(u.name)}">${ic('edit')}</button>
        ${profiles.users.length > 1 ? `<button class="icon ghost danger" data-action="user-delete" data-id="${u.id}" aria-label="Borrar ${esc(u.name)}">${ic('trash')}</button>` : ''}
      </div>
      ${u.notes ? `<div class="muted small" style="margin-top:6px">${ic('note')} ${esc(u.notes)}</div>` : ''}
      <div class="grid2" style="margin-top:10px">${active ? '<span></span>' : `<button data-action="user-switch" data-id="${u.id}">Cambiar a ${esc(u.name)}</button>`}
        <button data-action="athlete-export" data-id="${u.id}">${ic('share')} Enviar datos</button></div>
    </div>`;
  }
  return html;
}

/* ---------- Modal ---------- */
const modal = $('#modal');
// Aviso breve en la parte inferior (antes vivía en cloud.js).
function toast(text) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = text; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 3500);
}
function openModal(html) { $('#modal-body').innerHTML = html; if (!modal.open) modal.showModal(); }
function closeModal() { if (modal.open) modal.close(); }
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

function pickerHTML(q = '') {
  // Sin distinguir tildes ni mayúsculas («biceps» encuentra «Bíceps»).
  const ql = norm(q.trim());
  const kit = ui.pickKit || '';
  const items = db.exercises.filter((e) => norm(e.name).includes(ql) && (!kit || e.kit === kit));
  let list = `<div class="chips kit-chips">${[['', 'Todo'], ...Object.entries(KITS).filter(([k]) => db.exercises.some((e) => e.kit === k))].map(([k, v]) => `<button class="chip ${kit === k ? 'on' : ''}" data-action="pick-kit" data-k="${k}">${v}</button>`).join('')}</div>`;
  for (const key of [...MUSCLE_KEYS, null]) {
    const its = items.filter((e) => (e.primary || null) === key).sort((a, b) => a.name.localeCompare(b.name));
    if (!its.length) continue;
    list += `<div class="picker-cat">${key ? MUSCLES[key] : 'Sin músculo (cardio y otros)'}</div>` + its.map((e) => `<button data-action="pick-exercise" data-id="${e.id}">${esc(e.name)}</button>`).join('');
  }
  const exact = db.exercises.some((e) => norm(e.name) === ql);
  if (!items.length) list += '<div class="muted">Sin resultados.</div>';
  return `${list}
    ${ql && !exact ? `<button class="primary block" style="margin-top:10px" data-action="exercise-form" data-name="${esc(q.trim())}" data-then="add">＋ Crear «${esc(q.trim())}»…</button>
      <div class="muted small" style="margin-top:4px">Se abre la ficha completa (músculos, material, tipo) y después se añade.</div>` : ''}`;
}
function openPicker() {
  openModal(`<div class="row"><h3 class="spacer">Añadir ejercicio</h3><button class="ghost" data-action="close-modal">✕</button></div>
    <input type="search" id="picker-q" placeholder="Buscar o crear…" style="margin-top:10px" autocomplete="off">
    <div class="picker-list" id="picker-list">${pickerHTML()}</div>`);
  setTimeout(() => $('#picker-q')?.focus(), 50);
}

/* ---------- Temporizador de descanso ---------- */
let timer = { end: 0, int: null };
// Con objetivo (sec > 0): cuenta atrás y avisa. Sin objetivo: solo cuenta el tiempo transcurrido.
function startTimer(sec, stopwatch = false) {
  if (!sec && !stopwatch) return;
  timer.start = Date.now();
  timer.end = sec ? timer.start + sec * 1000 : null;
  $('#timer').classList.remove('hidden', 'over');
  document.body.classList.add('timer-on');
  clearInterval(timer.int);
  timer.int = setInterval(tickTimer, 250);
  tickTimer();
}
function tickTimer() {
  const live = $('#rest-live');
  if (live && ui.rest) live.textContent = fmtSec((Date.now() - ui.rest.start) / 1000) + '…';
  if (timer.end == null) { $('#timer-label').textContent = 'Descanso'; $('#timer-value').textContent = fmtSec((Date.now() - timer.start) / 1000); return; }
  const left = (timer.end - Date.now()) / 1000;
  const el = $('#timer');
  if (left <= 0 && !el.classList.contains('over')) {
    el.classList.add('over');
    navigator.vibrate?.([200, 100, 200]);
    beep();
  }
  $('#timer-label').textContent = left > 0 ? 'Descanso' : '¡A por la siguiente!';
  $('#timer-value').textContent = (left < 0 ? '+' : '') + fmtSec(Math.abs(left));
}
function stopTimer() { clearInterval(timer.int); $('#timer').classList.add('hidden'); document.body.classList.remove('timer-on'); }
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 880; g.gain.value = 0.15; o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.35);
  } catch (e) { /* sin audio */ }
}

/* ---------- Acciones ---------- */
function currentSession() { const r = route(); return r.name === 'session' ? sessionById(r.id) : null; }
function newSession(fromId, date = ui.day || todayISO()) {
  const src = fromId && sessionById(fromId);
  const s = {
    id: uid(), createdAt: new Date().toISOString(), date, startedAt: Date.now(), endedAt: null,
    title: src ? src.title : '', system: src ? src.system : db.settings.system, notes: '', bodyweight: null, readiness: null, sleep: null, stress: null, srpe: null,
    factors: [], preNotes: '', preObs: '',
    exercises: src ? src.exercises.map((e) => ({
      id: uid(), exerciseId: e.exerciseId, notes: '', equipment: [...e.equipment],
      // Copia la estructura y cargas de la sesión anterior como punto de partida, sin marcar como hechas.
      sets: e.sets.map((x) => ({ ...x, done: false, videoId: undefined, doneAt: undefined, rest: undefined })),
    })) : [],
  };
  db.sessions.push(s); save(true);
  location.hash = `#/session/${s.id}`;
}
// Restaura una copia con todos los usuarios (de un archivo o de una copia automática). Devuelve true si se restauró.
function restoreAllData(d, origin) {
  if (d?.type !== 'diario-entreno-todos' || !d.profiles?.users?.length || !d.data) throw new Error('Copia de usuarios incompleta o con otro formato');
  const names = d.profiles.users.map((u) => u.name).join(', ');
  const n = Object.values(d.data).reduce((a, x) => a + (x?.sessions?.length || 0), 0);
  if (!confirm(`Restaurar la copia ${origin}: ${d.profiles.users.length} usuarios (${names}), ${n} sesiones.\nReemplaza TODOS los usuarios y datos de este dispositivo.\n\n(Antes se guarda una copia automática del estado actual.)`)) return false;
  if (window.takeSnapshot) takeSnapshot('Antes de restaurar');
  clearTimeout(saveTimer);
  for (const u of profiles.users) kv.remove(dataKey(u.id));
  for (const u of d.profiles.users) if (d.data[u.id]) kv.set(dataKey(u.id), JSON.stringify(d.data[u.id]));
  profiles = { active: d.profiles.users.some((u) => u.id === d.profiles.active) ? d.profiles.active : d.profiles.users[0].id, users: d.profiles.users };
  if (Array.isArray(d.templates) && window.tplSaveAll) tplSaveAll(d.templates);
  saveProfiles(); db = load(); videoGc(); location.hash = '#/users'; rerender();
  return true;
}
function muscleOptions(sel) {
  return `<option value="" ${!sel ? 'selected' : ''}>— Ninguno (cardio u otros) —</option>` + MUSCLE_KEYS.map((m) => `<option value="${m}" ${sel === m ? 'selected' : ''}>${MUSCLES[m]}</option>`).join('');
}
/* ---------- Descansos ----------
 * set.rest = descanso DESPUÉS de esa serie, en segundos. Es un dato del usuario: lo escribe en el campo de
 * la serie o lo rellena el cronómetro (arranca al marcar ✓; «⏹ Parar» escribe el tiempo transcurrido).
 * Siempre se puede corregir después. */
const restTarget = (def) => def?.rest ?? (+db.settings.rest || 0);
function parseRest(v) {
  const t = String(v).trim().replace(',', '.');
  let m;
  if ((m = /^(\d{1,3}):([0-5]?\d)$/.exec(t))) return +m[1] * 60 + +m[2];
  if (/^\d{1,4}$/.test(t)) return +t;
  return null;
}
// Objetivo de la tabla: agrupa series consecutivas con el mismo objetivo («3× 8-12 @ RIR 2 · 75%»).
function targetLineHTML(ex, def) {
  const simple = isSimple(), unit = def.mode === 'time' ? ' s' : def.mode === 'dist' ? ' m' : '';
  const sig = (x) => x.target ? `${x.type === 'C' ? 'Calent. ' : ''}${x.target.reps || '–'}${unit}${x.target.rir != null ? ` @ RIR ${x.target.rir}` : ''}${x.target.pct && !simple ? ` · ${fmt(x.target.pct, 0)}%${x.target.auto ? '*' : ''}` : ''}` : null;
  const parts = []; let prev = null, n = 0;
  for (const x of ex.sets) { const s = sig(x); if (!s) continue; if (s === prev) n++; else { if (prev) parts.push(`${n}× ${prev}`); prev = s; n = 1; } }
  if (prev) parts.push(`${n}× ${prev}`);
  if (!parts.length) return '';
  const noE1 = def.mode === 'wr' && ex.sets.some((x) => x.target?.pct && x.w == null);
  const pending = ex.sets.filter((x) => x.target && !x.done).length;
  return `<div class="target">${ic('target')} <b>${esc(ex.tplName)}</b>: ${parts.map(esc).join(' · ')}${ex.restTarget != null ? ` · ${ic('timer')} ${fmtSec(ex.restTarget)}` : ''}
    ${ex.tplNote ? `<br>${ic('pin')} ${esc(ex.tplNote)}` : ''}
    ${noE1 ? '<br><span class="mismatch">Sin 1RM estimado de este ejercicio: escribe el peso.</span>' : ''}
    ${pending ? `<br><span class="muted">${pending} serie${pending === 1 ? '' : 's'} planificada${pending === 1 ? '' : 's'}: cuenta${pending === 1 ? '' : 'n'} al marcar ✓.</span>` : ''}
    ${ex.sets.some((x) => x.target?.auto) && !simple ? `<br><span class="muted">* % deducido de reps + RIR ${info('tpl_pct')}</span>` : ''}</div>`;
}
function restAvg(sets) {
  const r = sets.filter((x) => isWork(x) && x.rest != null);
  if (!r.length) return null;
  const avg = mean(r.map((x) => x.rest));
  return { sec: avg, txt: fmtSec(avg) };
}
// Fila del descanso bajo la serie j: campo editable; se muestra entre series, o tras la última si tiene valor o el cronómetro corre.
function restRowHTML(ex, i, j, colspan) {
  const set = ex.sets[j], last = j === ex.sets.length - 1;
  const running = ui.rest && ui.rest.sid === currentSession()?.id && ui.rest.i === i && ui.rest.j === j;
  if (last && set.rest == null && !running && !set.done && !set.videoId) return '';
  // Botón de vídeo a la derecha de la fila del descanso: graba directamente (o abre el vídeo si ya tiene).
  const vid = set.type === 'C' ? '' : `<button class="icon ghost vid-quick ${set.videoId ? 'on' : ''}" data-action="${set.videoId ? 'set-menu' : 'video-pick'}" data-src="cam" data-i="${i}" data-j="${j}"
      aria-label="${set.videoId ? `Ver el vídeo de la serie ${j + 1}` : `Grabar vídeo de la serie ${j + 1}`}">${ic('video')}</button>`;
  return `<tr class="rest-row"><td colspan="${colspan}"><div class="rest-line"><label class="rest-field">${ic('timer')} Descanso
      <input data-rest="${i}:${j}" inputmode="numeric" placeholder="m:ss" value="${set.rest != null ? fmtSec(set.rest) : ''}" aria-label="Descanso después de la serie ${j + 1} (m:ss)">
      ${running ? '<span class="rest-live" id="rest-live">en marcha…</span>' : ''}</label>${vid}</div></td></tr>`;
}
const fileSafe = (t) => norm(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'usuario';
// Exportar: ofrece «Compartir o guardar» (en iPhone, Guardar en Archivos) y «Descargar».
function download(name, text, type) {
  showShareResult(new Blob([text], { type }), name, 'Archivo listo',
    (IS_NATIVE ? '' : '<div class="hint"><b>iPhone:</b> «Compartir o guardar» → Guardar en Archivos. <b>Android:</b> «Descargar» (carpeta Descargas).</div>'));
}
function toCSV() {
  const rows = [['fecha', 'sesion', 'peso_corporal', 'energia', 'sueno', 'estres', 'factores', 'ejercicio', 'serie', 'tipo', 'kg', 'reps', 'rpe', 'rir', 'segundos', 'metros', 'hecha', 'descanso_despues_s', 'pct_1rm', 'e1rm', 'indice_estres', 'material', 'notas_ejercicio']];
  for (const s of sortedSessions().reverse()) for (const e of s.exercises) e.sets.forEach((x, j) => rows.push([
    s.date, s.title, s.bodyweight, s.readiness, s.sleep, s.stress, (s.factors || []).join(' | '), exById(e.exerciseId)?.name, j + 1, SET_TYPES[x.type], x.w, x.reps, x.rpe, x.rir, x.time, x.dist, x.done ? 'si' : 'no', x.rest ?? '',
    pct1rm(x) ? fmt(pct1rm(x)) : '', e1rm(x) ? fmt(e1rm(x)) : '', stressIndex(x, exById(e.exerciseId)) != null ? fmt(stressIndex(x, exById(e.exerciseId)), 1) : '', e.equipment.map((q) => eqById(q)?.name).join(' | '), j === 0 ? e.notes : '',
  ]));
  return rows.map((r) => r.map((c) => { const v = String(c ?? ''); return /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }).join(';')).join('\n');
}

const actions = {
  'new-session': () => newSession(),
  'repeat-from': (el) => { closeModal(); newSession(el.dataset.id); },
  'session-menu': () => openModal(`<div class="row"><h3 class="spacer">Sesión</h3><button class="ghost" data-action="close-modal">✕</button></div>
      <div style="display:grid;gap:8px;margin-top:10px">
        <button data-action="duplicate-session">Duplicar como nueva sesión de hoy</button>
        <button data-action="tpl-from-session">${ic('list')} Guardar como tabla</button>
        <button class="danger" data-action="delete-session">Borrar sesión</button>
      </div>`),
  'duplicate-session': () => { const s = currentSession(); closeModal(); newSession(s.id, todayISO()); },
  'delete-session': () => {
    const s = currentSession();
    const nv = setsWithVideo(s).length;
    if (!confirm(`¿Borrar esta sesión${nv ? ` y sus ${nv} vídeos` : ''}? No se puede deshacer.`)) return;
    deleteVideos(setsWithVideo(s));
    db.sessions = db.sessions.filter((x) => x.id !== s.id); save(true); closeModal(); location.hash = '#/';
  },
  'finish-session': () => { const s = currentSession(); s.endedAt = Date.now(); save(true); stopTimer(); rerender(); },
  'reopen-session': () => { const s = currentSession(); s.endedAt = null; save(true); rerender(); },
  'add-exercise': () => openPicker(),
  'pick-exercise': (el) => {
    const s = currentSession(); closeModal();
    const prev = previousEntry(el.dataset.id, s);
    s.exercises.push({
      id: uid(), exerciseId: el.dataset.id, notes: '',
      equipment: prev ? [...prev.entry.equipment] : [],
      sets: prev ? prev.entry.sets.map((x) => ({ ...x, done: false, videoId: undefined, doneAt: undefined, rest: undefined })) : [{ type: 'E', w: null, reps: null, rpe: null, rir: null, done: false }],
    });
    save(); rerender();
    setTimeout(() => document.querySelector(`[data-ex="${s.exercises.length - 1}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  },
  'close-modal': () => closeModal(),
  'move-ex': (el) => {
    const s = currentSession(), i = +el.dataset.i, j = i + +el.dataset.d;
    if (j < 0 || j >= s.exercises.length) return;
    [s.exercises[i], s.exercises[j]] = [s.exercises[j], s.exercises[i]]; save(); rerender();
  },
  'del-ex': (el) => {
    const s = currentSession();
    const ex = s.exercises[+el.dataset.i], vids = ex.sets.filter((x) => x.videoId).map((x) => x.videoId);
    if (!confirm(`¿Quitar este ejercicio de la sesión${vids.length ? ` (y sus ${vids.length} vídeos)` : ''}?`)) return;
    deleteVideos(vids);
    s.exercises.splice(+el.dataset.i, 1); save(); rerender();
  },
  'add-set': (el) => {
    const ex = currentSession().exercises[+el.dataset.i];
    const last = ex.sets[ex.sets.length - 1];
    ex.sets.push(last ? { ...last, done: false, videoId: undefined, doneAt: undefined, rest: undefined, type: last.type === 'C' ? 'E' : last.type } : { type: 'E', w: null, reps: null, rpe: null, rir: null, done: false });
    save(); rerender();
  },
  'del-set': (el) => {
    const sets = currentSession().exercises[+el.dataset.i].sets, set = sets[+el.dataset.j];
    if (set.videoId && !confirm('Esta serie tiene un vídeo. ¿Borrar la serie y su vídeo?')) return;
    videoDelete(set.videoId);
    sets.splice(+el.dataset.j, 1); save(); closeModal(); rerender();
  },
  'cycle-type': (el) => {
    const set = currentSession().exercises[+el.dataset.i].sets[+el.dataset.j];
    const order = Object.keys(SET_TYPES); set.type = order[(order.indexOf(set.type) + 1) % order.length];
    save(); rerender();
  },
  'toggle-done': (el) => {
    const s = currentSession(), i = +el.dataset.i, j = +el.dataset.j, ex = s.exercises[i], set = ex.sets[j];
    set.done = !set.done;
    if (set.done) {
      set.doneAt = Date.now();
      // El cronómetro mide el descanso de ESTA serie. Si corría el de otra, se descarta sin rellenar nada
      // (ese tiempo incluiría la ejecución de la serie).
      ui.rest = { sid: s.id, i, j, start: Date.now() };
    } else {
      delete set.doneAt;
      if (ui.rest && ui.rest.sid === s.id && ui.rest.i === i && ui.rest.j === j) { ui.rest = null; stopTimer(); }
    }
    save(); rerender();
    if (set.done) {
      // Superserie: entre ejercicios del grupo no hay descanso; el cronómetro arranca tras el último.
      const g = ssGroupOf(s, i);
      if (g && i < g.b) { toast(`Superserie: ahora ${exById(s.exercises[i + 1].exerciseId)?.name || 'el siguiente'}`); return; }
      const grp = g ? s.exercises.slice(g.a, g.b + 1) : [ex];
      startTimer(Math.max(...grp.map((e) => e.restTarget ?? restTarget(exById(e.exerciseId)))), true);
    }
  },
  // «⏹ Parar»: escribe el tiempo transcurrido en el campo de descanso de la serie (editable después).
  'timer-save-rest': () => {
    const r = ui.rest;
    stopTimer();
    ui.rest = null;
    if (!r) return;
    const s = sessionById(r.sid), set = s?.exercises[r.i]?.sets[r.j];
    if (!set) return;
    set.rest = Math.round((Date.now() - r.start) / 1000);
    save(true); if (currentSession()?.id === s.id) rerender();
    toast(`Descanso ${fmtSec(set.rest)} guardado · puedes cambiarlo en la serie`);
  },
  'set-level': (el) => {
    db.settings.level = el.dataset.l;
    // Quien venía de sencillo registraba con RIR: si la intensidad por defecto sigue en RPE, pasa a RIR.
    if (el.dataset.l === 'advanced' && db.settings.intensity === 'rpe' && db.sessions.some((s) => s.exercises.some((e) => e.sets.some((x) => x.rir != null && x.rpe == null)))) db.settings.intensity = 'rir';
    save(true); rerender();
  },
  'rest-target': (el) => {
    const def = exById(el.dataset.id);
    const v = prompt(`Descanso objetivo para «${def.name}» (m:ss o segundos). Vacío = usar el general (${fmtSec(+db.settings.rest || 0)}).`, def.rest != null ? fmtSec(def.rest) : '');
    if (v == null) return;
    if (!v.trim()) delete def.rest;
    else { const sec = parseRest(v); if (sec == null) return alert('Formato no válido. Ejemplos: 2:30 o 150.'); def.rest = sec; }
    save(true); rerender();
  },
  'open-eq': (el) => {
    const id = currentSession().exercises[+el.dataset.i].id;
    ui.openEquip.has(id) ? ui.openEquip.delete(id) : ui.openEquip.add(id); rerender();
  },
  'toggle-eq': (el) => {
    const ex = currentSession().exercises[+el.dataset.i], q = el.dataset.eq;
    ex.equipment = ex.equipment.includes(q) ? ex.equipment.filter((x) => x !== q) : [...ex.equipment, q];
    save(); rerender();
  },
  'pick-day': (el) => { ui.day = el.dataset.day; rerender(); },
  'month': (el) => {
    const [y, m] = ui.month.split('-').map(Number);
    const d = new Date(y, m - 1 + +el.dataset.d, 1);
    ui.month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; rerender();
  },
  'ss-toggle': (el) => { const s = currentSession(), ex = s.exercises[+el.dataset.i]; ex.ss = !ex.ss || undefined; if (!ex.ss) delete ex.ss; save(); rerender(); },
  'pick-kit': (el) => { ui.pickKit = el.dataset.k; $('#picker-list').innerHTML = pickerHTML($('#picker-q')?.value || ''); },
  'show-all-ex': () => { ui.showAllEx = !ui.showAllEx; rerender(); },
  'go-today': () => { ui.day = todayISO(); ui.month = ui.day.slice(0, 7); rerender(); },
  'week': (el) => { ui.day = isoFromNum(dayNum(ui.day || todayISO()) + 7 * +el.dataset.d); ui.month = ui.day.slice(0, 7); rerender(); },
  'cal-fold': () => {
    try { localStorage.setItem(CAL_FOLD, calFolded() ? '0' : '1'); } catch (e) { /* sin almacenamiento: no se recuerda */ }
    ui.month = (ui.day || todayISO()).slice(0, 7); rerender();
  },
  'hist-all': (el) => { ui.histAll = ui.histAll === el.dataset.id ? null : el.dataset.id; rerender(); },
  'sum-open': (el) => { ui.sumOpen = ui.sumOpen || {}; ui.sumOpen[el.dataset.id] = !ui.sumOpen[el.dataset.id]; rerender(); },
  'notices': () => { ui.noticesOpen = !ui.noticesOpen; rerender(); },
  // Empezar una sesión desde una tabla o repitiendo una anterior (un solo botón en el calendario).
  'start-from': () => {
    const tpls = window.tplList ? tplList().sort((a, b) => a.name.localeCompare(b.name)) : [];
    const list = sortedSessions().slice(0, 30);
    openModal(`<div class="row"><h3 class="spacer">Empezar desde…</h3><button class="ghost" data-action="close-modal" aria-label="Cerrar">✕</button></div>
      <h3 class="sub">Una tabla</h3>
      ${tpls.length ? `<div class="picker-list">${tpls.map((t) => `<button data-action="tpl-use" data-id="${t.id}" data-mode="new"><span class="spacer" style="text-align:left"><b>${esc(t.name)}</b><br><small class="muted">${tplSummary(t)}</small></span></button>`).join('')}</div>`
        : '<p class="muted small">Todavía no hay tablas. Guarda una sesión como tabla desde su menú ⋯ o créala en «Gestionar tablas».</p>'}
      <a class="btn block" href="#/templates">${ic('list')} Gestionar tablas</a>
      ${list.length ? `<h3 class="sub">Repetir una sesión</h3>
      <p class="muted small">Se crea una sesión el ${fmtDate(ui.day || todayISO())} copiando ejercicios, material y cargas como punto de partida.</p>
      <div class="picker-list">${list.map((s) => `<button data-action="repeat-from" data-id="${s.id}"><b>${esc(s.title || 'Sesión')}</b>&nbsp;<span class="muted">${fmtDate(s.date)}</span></button>`).join('')}</div>` : ''}`);
  },
  'toggle-factor': (el) => {
    const s = currentSession(); const f = el.dataset.f;
    s.factors = s.factors.includes(f) ? s.factors.filter((x) => x !== f) : [...s.factors, f];
    ui.preOpen[s.id] = true; save(); rerender();
  },
  'go-users': () => { location.hash = '#/users'; },
  'r-period': (el) => { ui.rPeriod = +el.dataset.m; rerender(); },
  'r-ex': (el) => { ui.rSel.has(el.dataset.id) ? ui.rSel.delete(el.dataset.id) : ui.rSel.add(el.dataset.id); rerender(); },
  'r-print': () => {
    save(true);
    rerender(); // incluye los comentarios recién escritos
    const prevTitle = document.title;
    // El título del documento es el nombre sugerido del PDF.
    document.title = `Informe ${activeUser().name} ${PERIODS[ui.rPeriod || 3]} ${todayISO()}`;
    const restore = () => { document.title = prevTitle; window.removeEventListener('afterprint', restore); };
    window.addEventListener('afterprint', restore);
    setTimeout(() => { window.print(); setTimeout(restore, 1000); }, 50);
  },
  'user-switch': (el) => switchUser(el.dataset.id),
  'user-form': (el) => {
    const u = el.dataset.id ? profiles.users.find((x) => x.id === el.dataset.id) : null;
    openModal(`<div class="row"><h3 class="spacer">${u ? 'Editar' : 'Nuevo'} usuario</h3><button class="ghost" data-action="close-modal" aria-label="Cerrar">✕</button></div>
      <div style="display:grid;gap:10px;margin-top:10px">
        <div><label>Nombre</label><input id="uf-name" value="${esc(u?.name)}" placeholder="p. ej. Laura G." autocomplete="off"></div>
        ${window.profileFieldsHTML ? profileFieldsHTML(u || {}, { weight: !u }) : ''}
        <div><label>Objetivo (opcional)</label><input id="uf-goal" value="${esc(u?.goal)}" placeholder="p. ej. Competir en -63 kg, hipertrofia, recuperar rodilla…"></div>
        <div><label>Notas (opcional)</label><textarea id="uf-notes" placeholder="Lesiones, disponibilidad, material del que dispone…">${esc(u?.notes)}</textarea></div>
        ${u ? '' : `<label class="row" style="color:var(--text);font-size:.9rem;gap:8px"><input type="checkbox" id="uf-copy" checked style="width:auto;min-height:0">
          Copiar catálogo de ejercicios, material y ajustes de ${esc(activeUser().name)}</label>`}
        <button class="primary" data-action="user-save" data-id="${u?.id || ''}">${u ? 'Guardar' : 'Crear y cambiar a este usuario'}</button>
      </div>`);
    setTimeout(() => $('#uf-name')?.focus(), 50);
  },
  'user-save': (el) => {
    const name = $('#uf-name').value.trim();
    if (!name) return alert('Pon un nombre.');
    if (profiles.users.some((x) => norm(x.name) === norm(name) && x.id !== el.dataset.id)) return alert('Ya hay un usuario con ese nombre.');
    let extra = { fields: {}, weight: null };
    if (window.readProfileFields) { try { extra = readProfileFields(); } catch (e) { return alert(e.message); } }
    const fields = { name, goal: $('#uf-goal').value.trim(), notes: $('#uf-notes').value.trim(), ...extra.fields };
    if (el.dataset.id) {
      Object.assign(profiles.users.find((x) => x.id === el.dataset.id), fields);
      saveProfiles(); closeModal(); rerender(); return;
    }
    const id = uid();
    const fresh = seed();
    if ($('#uf-copy')?.checked) {
      fresh.exercises = JSON.parse(JSON.stringify(db.exercises));
      fresh.equipment = JSON.parse(JSON.stringify(db.equipment));
      fresh.settings = { ...db.settings };
    }
    if (extra.weight != null) fresh.bodyweights = [{ d: todayISO(), v: extra.weight }];
    kv.set(dataKey(id), JSON.stringify(fresh));
    profiles.users.push({ id, ...fields, createdAt: Date.now() });
    saveProfiles(); closeModal(); switchUser(id);
  },
  'user-delete': (el) => {
    const u = profiles.users.find((x) => x.id === el.dataset.id);
    if (!u || profiles.users.length < 2) return;
    const n = (u.id === profiles.active ? db : readUserData(u.id))?.sessions.length || 0;
    const typed = prompt(`Se borrarán ${u.name} y sus ${n} sesiones de este dispositivo. No se puede deshacer.\n\nEscribe el nombre para confirmar:`);
    if (typed == null || norm(typed.trim()) !== norm(u.name)) { if (typed != null) alert('El nombre no coincide. No se ha borrado nada.'); return; }
    if (window.takeSnapshot) takeSnapshot(`Antes de borrar a ${u.name}`);
    const wasActive = u.id === profiles.active;
    if (wasActive) clearTimeout(saveTimer);
    profiles.users = profiles.users.filter((x) => x.id !== u.id);
    kv.remove(dataKey(u.id));
    videoDeleteByUser(u.id);
    if (wasActive) {
      profiles.active = profiles.users[0].id; saveProfiles();
      db = load(); stopTimer(); location.hash = '#/users'; rerender();
    } else { saveProfiles(); rerender(); }
  },
  'export-all': () => {
    save(true);
    const data = {};
    for (const u of profiles.users) data[u.id] = u.id === profiles.active ? db : readUserData(u.id);
    download(`diario-entreno-todos-${todayISO()}.json`, JSON.stringify({ type: 'diario-entreno-todos', version: 1, exportedAt: new Date().toISOString(), profiles, data }, null, 2), 'application/json');
  },
  'ef-sec': (el) => {
    const next = { 0: 0.5, 0.5: 0.75, 0.75: 0.25, 0.25: 0 }[+el.dataset.w || 0];
    el.dataset.w = next; el.classList.toggle('on', !!next); el.querySelector('.secw').textContent = next ? ' ' + fracTxt(next) : '';
  },
  'review-muscles': () => {
    const pending = db.exercises.filter((x) => x.reviewMuscles);
    if (pending.length) actions['exercise-form']({ dataset: { id: pending[0].id } });
  },
  'cycle-system': () => {
    const s = currentSession(); const order = Object.keys(SYSTEMS);
    s.system = order[(order.indexOf(systemOf(s)) + 1) % order.length]; save(); rerender();
  },
  'atab': (el) => { ui.atab = el.dataset.t; rerender(); },
  'cycle-intensity': (el) => {
    const def = exById(currentSession().exercises[+el.dataset.i].exerciseId);
    const order = Object.keys(INTENSITY);
    def.intensity = order[(order.indexOf(intensityOf(def)) + 1) % order.length];
    save(); rerender();
  },
  'info': (el) => {
    const [title, body] = GLOSSARY[el.dataset.k] || ['', ''];
    openModal(`<div class="row"><h3 class="spacer">${title}</h3><button class="ghost" data-action="close-modal" aria-label="Cerrar">✕</button></div>
      <div class="gloss">${body}</div>
      <button class="block" style="margin-top:12px" data-action="close-modal">Entendido</button>`);
  },
  'toggle-chart': (el) => {
    const id = currentSession().exercises[+el.dataset.i].id;
    ui.openChart.has(id) ? ui.openChart.delete(id) : ui.openChart.add(id); rerender();
  },
  'exercise-form': (el) => {
    const e = el.dataset.id ? exById(el.dataset.id) : null;
    const used = e && db.sessions.some((s) => s.exercises.some((x) => x.exerciseId === e.id));
    openModal(`<div class="row"><h3 class="spacer">${e ? 'Editar' : 'Nuevo'} ejercicio</h3><button class="ghost" data-action="close-modal">✕</button></div>
      <div style="display:grid;gap:10px;margin-top:10px">
        <div><label>Nombre</label><input id="ef-name" value="${esc(e?.name ?? el.dataset.name ?? '')}" placeholder="p. ej. Sentadilla búlgara"></div>
        <div><label>Músculo principal ${info('muscle_volume')}</label><select id="ef-cat" data-action-change="ef-primary">${muscleOptions(e?.primary ?? (e ? null : 'pectoral'))}</select></div>
        <div><label>Músculos secundarios y cuánto cuentan ${info('sec_weights')}</label>
          <div class="chips" id="ef-sec">${MUSCLE_KEYS.map((m) => { const w = e?.secondary?.includes(m) ? secWeight(e, m) : 0;
            return `<button class="chip ${w ? 'on' : ''} ${(e ? e.primary : 'pectoral') === m ? 'hidden' : ''}" data-action="ef-sec" data-m="${m}" data-w="${w}">${MUSCLES[m]}<b class="secw">${w ? ' ' + fracTxt(w) : ''}</b></button>`; }).join('')}</div>
          <div class="muted small" style="margin-top:4px">Toca para marcar y cambiar cuánto cuenta: ½ → ¾ → ¼ → quitar. Sin ninguno = sin secundarios.</div></div>
        <div><label>Material</label><select id="ef-kit"><option value="">—</option>${Object.entries(KITS).map(([k, v]) => `<option value="${k}" ${e?.kit === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div><label>Tipo ${info('joint')}</label><select id="ef-joint">${Object.entries(JOINT).map(([k, v]) => `<option value="${k}" ${jointOf(e || {}) === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div><label>Cómo se registra</label><select id="ef-mode" ${used ? 'disabled' : ''}>${Object.entries(MODES).map(([k, m]) => `<option value="${k}" ${e?.mode === k ? 'selected' : ''}>${m.label}</option>`).join('')}</select>
          ${used ? '<div class="muted small">No se puede cambiar: ya tiene series registradas.</div>' : ''}</div>
        <button class="primary" data-action="save-exercise" data-id="${e?.id || ''}" data-then="${el.dataset.then || ''}">${el.dataset.then === 'add' ? 'Guardar y añadir' : 'Guardar'}</button>
      </div>`);
  },
  'save-exercise': (el) => {
    const name = $('#ef-name').value.trim(); if (!name) return alert('Pon un nombre.');
    const dup = db.exercises.find((x) => norm(x.name) === norm(name) && x.id !== el.dataset.id);
    if (dup) return alert('Ya existe un ejercicio con ese nombre.');
    let e = el.dataset.id && exById(el.dataset.id);
    if (!e) { e = { id: uid() }; db.exercises.push(e); }
    e.name = name; e.primary = $('#ef-cat').value || null; const secs = [...document.querySelectorAll('#ef-sec .chip.on:not(.hidden)')]; e.secondary = secs.map((x) => x.dataset.m); e.sw = Object.fromEntries(secs.map((x) => [x.dataset.m, +x.dataset.w])); e.kit = $('#ef-kit').value || undefined; delete e.reviewMuscles; e.joint = $('#ef-joint').value; if (!$('#ef-mode').disabled) e.mode = $('#ef-mode').value;
    // Creado desde el buscador de «Añadir ejercicio»: se añade a la sesión (o a la tabla) en vez de abrir su ficha.
    if (el.dataset.then === 'add') { save(); actions['pick-exercise']({ dataset: { id: e.id } }); return; }
    save(); closeModal(); location.hash = `#/exercise/${e.id}`; rerender();
  },
  'filter-eq': (el) => { ui.filterEq = el.dataset.eq; rerender(); },
  'timer-add': (el) => { timer.end += +el.dataset.sec * 1000; $('#timer').classList.remove('over'); tickTimer(); },
  'timer-stop': () => { ui.rest = null; stopTimer(); rerender(); },
  'add-equipment': () => {
    const v = $('#new-eq').value.trim(); if (!v) return;
    db.equipment.push({ id: uid(), name: v }); save(); rerender();
  },
  'del-equipment': (el) => {
    const used = db.sessions.some((s) => s.exercises.some((e) => e.equipment.includes(el.dataset.id)));
    if (used) return alert('Este material aparece en sesiones guardadas; no se puede borrar.');
    db.equipment = db.equipment.filter((e) => e.id !== el.dataset.id); save(); rerender();
  },
  'manage-exercises': () => {
    const used = new Set(db.sessions.flatMap((s) => s.exercises.map((e) => e.exerciseId)));
    openModal(`<div class="row"><h3 class="spacer">Catálogo de ejercicios</h3><button class="ghost" data-action="close-modal">✕</button></div>
      <div class="picker-list">${[...db.exercises].sort((a, b) => a.name.localeCompare(b.name)).map((e) => `
        <div class="row" style="margin-bottom:6px"><span class="spacer">${esc(e.name)} <span class="muted small">· ${esc(muscleLabel(e))}${e.reviewMuscles ? ' ' + ic('alert') : ''}</span></span>
          <button class="icon ghost" data-action="rename-exercise" data-id="${e.id}" aria-label="Renombrar">${ic('edit')}</button>
          ${used.has(e.id) ? '' : `<button class="icon ghost danger" data-action="del-exercise" data-id="${e.id}" aria-label="Borrar">✕</button>`}
        </div>`).join('')}</div>
      <button class="primary block" data-action="exercise-form">＋ Nuevo ejercicio</button>`);
  },
  'rename-exercise': (el) => actions['exercise-form'](el),
  'del-exercise': (el) => { db.exercises = db.exercises.filter((e) => e.id !== el.dataset.id); save(); actions['manage-exercises'](); },
  'export-json': () => download(`diario-entreno-${fileSafe(activeUser().name)}-${todayISO()}.json`, JSON.stringify(db, null, 2), 'application/json'),
  'export-csv': () => download(`diario-entreno-${fileSafe(activeUser().name)}-${todayISO()}.csv`, '﻿' + toCSV(), 'text/csv'),
  'import-json': () => $('#import-file').click(),
  'wipe': () => {
    if (!confirm(`¿Borrar TODOS los datos de ${activeUser().name}? Exporta antes una copia.`)) return;
    if (!confirm('Seguro. Esto no se puede deshacer.')) return;
    if (window.takeSnapshot) takeSnapshot(`Antes de borrar datos de ${activeUser().name}`);
    db = seed(); save(true); videoDeleteByUser(profiles.active); rerender();
  },
  'delete-videos': async () => {
    if (!confirm(`¿Borrar todos los vídeos de ${activeUser().name} de este dispositivo? Las series se conservan.`)) return;
    await videoDeleteByUser(profiles.active);
    for (const s of db.sessions) for (const e of s.exercises) for (const x of e.sets) delete x.videoId;
    save(true); rerender();
  },
  // Vídeo de una serie
  'set-menu': (el) => openSetMenu(+el.dataset.i, +el.dataset.j),
  'video-pick': (el) => {
    ui.videoTarget = { sid: currentSession().id, i: +el.dataset.i, j: +el.dataset.j };
    // Grabar: input con «capture» (abre la cámara); galería: selector de archivos.
    const inp = $(el.dataset.src === 'cam' ? '#video-cam' : '#video-file'); inp.value = ''; inp.click();
  },
  'video-save': async (el) => {
    const set = currentSession().exercises[+el.dataset.i].sets[+el.dataset.j];
    const rec = await videoGet(set.videoId);
    if (!rec) return alert('El vídeo ya no está en este dispositivo.');
    const inf = setInfo(currentSession(), +el.dataset.i, +el.dataset.j);
    const ext = (rec.type.split('/')[1] || 'mp4').split(';')[0].replace('quicktime', 'mov');
    showShareResult(rec.blob, `${fileSafe(inf.title)}-${currentSession().date}-serie${+el.dataset.j + 1}.${ext}`, 'Guardar vídeo en el móvil',
      '<div class="muted small">En iPhone: «Compartir o guardar» → «Guardar vídeo» lo lleva a Fotos.</div>');
  },
  'video-del': (el) => {
    const set = currentSession().exercises[+el.dataset.i].sets[+el.dataset.j];
    if (!confirm('¿Borrar el vídeo de esta serie?')) return;
    videoDelete(set.videoId); delete set.videoId; save(true); rerender(); openSetMenu(+el.dataset.i, +el.dataset.j);
  },
  // Compartir una serie
  'share-set': (el) => {
    const i = +el.dataset.i, j = +el.dataset.j, sess = currentSession(), set = sess.exercises[i].sets[j];
    const canVideo = !!(set.videoId && pickRecorderMime() && HTMLCanvasElement.prototype.captureStream);
    // Precarga: al pulsar «Vídeo» la reproducción debe empezar sin esperas para que iOS permita el audio.
    ui.prefetched = null;
    if (set.videoId) videoGet(set.videoId).then((r) => { ui.prefetched = r; }).catch(() => {});
    openModal(`<div class="row"><h3 class="spacer">Compartir serie</h3><button class="ghost" data-action="close-modal" aria-label="Cerrar">✕</button></div>
      <pre class="share-preview">${esc(setText(setInfo(sess, i, j)))}</pre>
      <div style="display:grid;gap:8px">
        ${set.videoId ? `<button class="primary" data-action="share-video" data-i="${i}" data-j="${j}" ${canVideo ? '' : 'disabled'}>${ic('video')} Vídeo con los datos encima</button>
          ${canVideo ? '<div class="muted small">Se re-codifica en el móvil: tarda lo mismo que dura el vídeo.</div>' : '<div class="muted small">Este navegador no puede generar vídeo; usa la imagen.</div>'}` : ''}
        <button class="${set.videoId ? '' : 'primary'}" data-action="share-image" data-i="${i}" data-j="${j}">${ic('image')} Imagen con los datos${set.videoId ? ' (fotograma del vídeo)' : ''}</button>
        <button data-action="share-text" data-i="${i}" data-j="${j}">${ic('note')} Solo texto</button>
      </div>
      <div class="muted small" style="margin-top:10px">No se incluye el nombre del atleta. Si compartes vídeos de otra persona, hazlo con su permiso.</div>`);
  },
  'share-text': async (el) => {
    const t = setText(setInfo(currentSession(), +el.dataset.i, +el.dataset.j));
    if (IS_NATIVE) { try { await nativeShareText(t); return; } catch (e) { if (/cancel/i.test(e.message || '')) return; } }
    if (navigator.share) { try { await navigator.share({ text: t }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(t); alert('Texto copiado al portapapeles.'); } catch (e) { prompt('Copia el texto:', t); }
  },
  'share-image': async (el) => {
    const i = +el.dataset.i, j = +el.dataset.j, sess = currentSession(), set = sess.exercises[i].sets[j];
    const inf = setInfo(sess, i, j);
    openModal('<div class="gen"><div class="spinner"></div>Generando imagen…</div>');
    try {
      const rec = set.videoId ? await videoGet(set.videoId) : null;
      const blob = await makeSetImage(inf, rec?.blob);
      const url = URL.createObjectURL(blob); ui.modalUrls = [...(ui.modalUrls || []), url];
      showShareResult(blob, `${fileSafe(inf.title)}-${sess.date}-serie${j + 1}.jpg`, 'Imagen lista', `<img class="share-img" src="${url}" alt="Imagen de la serie">`);
    } catch (e) { closeModal(); alert('No se pudo generar la imagen: ' + e.message); }
  },
  'share-video': async (el) => {
    const i = +el.dataset.i, j = +el.dataset.j, sess = currentSession(), set = sess.exercises[i].sets[j];
    const inf = setInfo(sess, i, j);
    const cancel = { cancelled: false };
    ui.genCancel = cancel;
    try {
      const rec = ui.prefetched?.id === set.videoId ? ui.prefetched : await videoGet(set.videoId);
      if (!rec) throw new Error('El vídeo ya no está en este dispositivo.');
      openModal(`<div class="gen"><div>Generando vídeo con los datos…</div><div class="progress"><i id="gen-bar"></i></div><div id="gen-pct" class="muted small">0%</div>
        <button data-action="cancel-gen">Cancelar</button></div>`);
      const out = await makeOverlayVideo(rec.blob, inf, (f) => { const b = $('#gen-bar'), t = $('#gen-pct'); if (b) b.style.width = `${Math.round(f * 100)}%`; if (t) t.textContent = `${Math.round(f * 100)}%`; }, cancel);
      const ext = out.type.includes('mp4') ? 'mp4' : 'webm';
      const url = URL.createObjectURL(out); ui.modalUrls = [...(ui.modalUrls || []), url];
      showShareResult(out, `${fileSafe(inf.title)}-${sess.date}-serie${j + 1}.${ext}`, 'Vídeo listo',
        `<video class="share-img" src="${url}" controls playsinline></video>${ext === 'webm' ? '<div class="mismatch">Formato WebM: algunas apps (p. ej. WhatsApp) pueden no aceptarlo. Si falla, comparte la imagen.</div>' : ''}`);
    } catch (e) { if (e.name !== 'AbortError') { closeModal(); alert('No se pudo generar el vídeo: ' + e.message); } else closeModal(); }
  },
  'cancel-gen': () => { if (ui.genCancel) ui.genCancel.cancelled = true; },
  'share-file': () => shareFile(),
  // Tutoriales
  'yt': (el) => openModal(youtubeHTML(exById(el.dataset.id))),
  'yt-save': (el) => {
    const def = exById(el.dataset.id), v = $('#yt-url').value.trim();
    if (!v) return;
    const u = safeUrl(v);
    if (!u) return alert('El enlace debe empezar por https://');
    def.refUrl = u; save(true); rerender(); openModal(youtubeHTML(def));
  },
  'yt-clear': (el) => { const def = exById(el.dataset.id); delete def.refUrl; save(true); rerender(); openModal(youtubeHTML(def)); },
  // Informe en PDF con jsPDF
  'r-pdf': async () => {
    save(true);
    const months = ui.rPeriod || 3;
    openModal('<div class="gen"><div class="spinner"></div>Generando PDF…</div>');
    try {
      const doc = await buildReportPDF(months);
      const blob = doc.output('blob');
      showShareResult(blob, `Informe-${fileSafe(activeUser().name)}-${PERIODS[months].replace(' ', '')}-${todayISO()}.pdf`, 'Informe listo',
        '<div class="muted small">En iPhone: «Compartir o guardar» → «Guardar en Archivos», o envíalo directamente.</div>');
    } catch (e) { closeModal(); alert('No se pudo generar el PDF: ' + e.message); }
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || !actions[el.dataset.action]) return;
  e.preventDefault();
  actions[el.dataset.action](el);
});

// Edición en línea: actualiza datos sin re-renderizar (no se pierde el foco al teclear).
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'picker-q') { $('#picker-list').innerHTML = pickerHTML(t.value); return; }
  if (t.dataset.actionInput) {
    const k = t.dataset.actionInput; ui[k] = t.value; const pos = t.selectionStart; render();
    const n = $(`[data-action-input="${k}"]`); n.focus(); n.setSelectionRange(pos, pos); return;
  }
  if (t.dataset.actionChange === 'ef-primary') {
    document.querySelectorAll('#ef-sec .chip').forEach((c) => c.classList.toggle('hidden', c.dataset.m === t.value));
    return;
  }
  if (t.dataset.setting) { db.settings[t.dataset.setting] = num(t.value) ?? 0; save(); if (['weekLen', 'weekDow'].includes(t.dataset.setting)) rerender(); return; }
  if (t.dataset.settingStr) {
    if (t.dataset.settingStr === 'cycleAnchor' && !t.value) return;
    db.settings[t.dataset.settingStr] = t.value; save(); if (t.dataset.settingStr === 'cycleAnchor') rerender(); return;
  }
  if (t.dataset.reportNote != null) { db.reportNote = t.value; save(); return; }
  const s = currentSession(); if (!s) return;
  if (t.dataset.s) {
    const k = t.dataset.s;
    s[k] = ['bodyweight', 'readiness', 'sleep', 'stress', 'srpe'].includes(k) ? num(t.value) : t.value;
    if (k === 'date' && t.value) { ui.day = t.value; ui.month = t.value.slice(0, 7); }
    save(); return;
  }
  if (t.dataset.exnote != null) { s.exercises[+t.dataset.exnote].notes = t.value; save(); return; }
  if (t.dataset.set) {
    const [i, j, f] = t.dataset.set.split(':');
    const set = s.exercises[+i].sets[+j];
    set[f] = num(t.value);
    // Modo RPE + RIR: rellenar el otro valor si está vacío (RPE ≈ 10 − RIR).
    if (intensityOf(exById(s.exercises[+i].exerciseId)) === 'both') {
      if (f === 'rpe' && set.rpe != null && set.rir == null && Number.isInteger(10 - set.rpe) && set.rpe >= 6) set.rir = 10 - set.rpe;
      if (f === 'rir' && set.rir != null && set.rpe == null && set.rir <= 4) set.rpe = 10 - set.rir;
    }
    save();
    const cap = $(`#cap-${i}-${j}`); if (cap) cap.textContent = set.type === 'C' ? '' : pctTxt(set);
    const sic = $(`#si-${i}-${j}`); if (sic) sic.textContent = siTxt(set, exById(s.exercises[+i].exerciseId));
  }
});
// Al cambiar cosas que afectan a cálculos visibles (récords, volumen), refresca al salir del campo.
document.addEventListener('change', (e) => {
  const t = e.target;
  if ((t.id === 'video-file' || t.id === 'video-cam') && t.files[0] && ui.videoTarget) {
    const { sid, i, j } = ui.videoTarget; ui.videoTarget = null;
    storeSetVideo(sid, i, j, t.files[0]);
    return;
  }
  if (t.id === 'import-file' && t.files[0]) {
    t.files[0].text().then((txt) => {
      const d = JSON.parse(txt);
      if (d.type === 'diario-entreno-todos') { restoreAllData(d, 'del archivo'); return; }
      if (!d.sessions || !d.exercises || !d.equipment) throw new Error('Formato no reconocido');
      if (!confirm(`Importar ${d.sessions.length} sesiones en ${activeUser().name}? Reemplaza sus datos actuales.`)) return;
      if (window.takeSnapshot) takeSnapshot('Antes de importar');
      db = normalize(d); save(true); videoGc(); rerender();
    }).catch((err) => alert('No se pudo importar: ' + err.message));
    return;
  }
  // No re-renderizar al salir de un campo numérico: destruiría el campo al que el usuario acaba de pasar.
  if (t.dataset.rest) {
    const [i, j] = t.dataset.rest.split(':').map(Number);
    const s = currentSession(), set = s?.exercises[i]?.sets[j]; if (!set) return;
    const v = t.value.trim();
    if (!v) { delete set.rest; t.classList.remove('bad'); save(); return; }
    const sec = parseRest(v);
    if (sec == null) { t.classList.add('bad'); toast('Formato de descanso: 2:30 o 150 (segundos)'); return; }
    set.rest = sec; t.value = fmtSec(sec); t.classList.remove('bad'); save();
    if (ui.rest && ui.rest.sid === s.id && ui.rest.i === i && ui.rest.j === j) { ui.rest = null; stopTimer(); }
    return;
  }
  if ((t.dataset.set || ['bodyweight', 'sleep'].includes(t.dataset.s)) && t.tagName === 'INPUT') {
    const v = num(t.value), bad = t.value.trim() !== '' && !/^[+-]?\d*([.,]\d*)?$/.test(t.value.trim());
    t.classList.toggle('bad', bad);
    if (bad) toast('Escribe un número, p. ej. 102,5'); else t.value = decIn(v);
  }
  if (t.dataset.s === 'date' || (t.dataset.set && t.tagName === 'SELECT')) rerender();
  else if (t.dataset.set) { const s = currentSession(); const v = $('#vol'); if (s && v) v.textContent = `${fmt(sessionVolume(s), 0)} kg`; }
});

document.addEventListener('toggle', (e) => {
  if (e.target.id === 'pre') { const s = currentSession(); if (s) ui.preOpen[s.id] = e.target.open; }
}, true);

// Refresca la duración en curso cada minuto.
setInterval(() => {
  const s = currentSession();
  if (s && !s.endedAt && !document.activeElement?.matches('input,textarea,select') && !modal.open) rerender();
}, 60000);

// En la app Android los archivos ya van dentro de la app: no hace falta service worker.
if ('serviceWorker' in navigator && location.protocol !== 'file:' && !IS_NATIVE) navigator.serviceWorker.register('sw.js').catch(() => {});

render();
