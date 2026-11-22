'use strict';
/* Tablas de ejercicios (plantillas de sesión), compartidas por todos los usuarios del dispositivo.
 * - Cada ejercicio se guarda por nombre (con modo y músculos): si el usuario no lo tiene en su catálogo, se crea al cargar.
 * - Prescripción por serie: tipo (efectiva o calentamiento), repeticiones (número o rango «8-12»; segundos o metros en
 *   ejercicios de tiempo o distancia), RIR objetivo y %1RM. Sin %, el peso se deduce de reps + RIR con la tabla RTS.
 * - El peso se calcula con el 1RM estimado de cada atleta (últimos 120 días; si no, histórico), redondeado a 2,5 kg.
 * - Al cargar, los campos se rellenan con lo prescrito y cada serie guarda su objetivo («target»): no cuenta en
 *   estadísticas hasta marcar ✓. El descanso de la tabla es el objetivo del cronómetro, no rellena el campo. */

const TPL_KEY = 'diario-entreno.tablas';
function tplList() { try { const v = JSON.parse(localStorage.getItem(TPL_KEY)); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
function tplSaveAll(list) { try { localStorage.setItem(TPL_KEY, JSON.stringify(list)); } catch (e) { alert('No se pudo guardar la tabla: ' + e.message); } }
const tplGet = (id) => tplList().find((t) => t.id === id);
function tplUpdate(id, fn) { const list = tplList(); const t = list.find((x) => x.id === id); if (!t) return null; fn(t); t.updatedAt = Date.now(); tplSaveAll(list); return t; }

// «8-12» -> [8, 12]; «5» -> [5, 5]
function parseRepsRange(v) {
  const m = /^\s*(\d{1,4})\s*(?:-\s*(\d{1,4}))?\s*$/.exec(String(v ?? ''));
  if (!m) return null;
  const lo = +m[1], hi = m[2] ? +m[2] : lo;
  return lo > 0 && hi >= lo ? [lo, hi] : null;
}
// 1RM estimado de referencia del atleta activo: mejor de los últimos 120 días; si no hay, el mejor histórico.
function refE1RM(exerciseId) {
  const h = historyFor(exerciseId);
  const cut = isoOf(new Date(Date.now() - 120 * 864e5));
  return maxOf(h.filter((x) => x.sess.date >= cut).map((x) => entryStats(x.entry).best)) || maxOf(h.map((x) => entryStats(x.entry).best));
}
const tplSetPct = (ts) => ts.pct != null ? ts.pct : (ts.type !== 'C' && ts.rir != null ? pct1rm({ reps: (parseRepsRange(ts.reps) || [])[0], rir: ts.rir }) : null);

function exerciseFromTemplate(te) {
  let def = db.exercises.find((e) => norm(e.name) === norm(te.name));
  if (!def) {
    // Tablas guardadas antes de dividir «Hombros» en tres deltoides.
    const fix = (m) => m === 'hombros' ? (DEFAULT_MUSCLES[te.name] ? [DEFAULT_MUSCLES[te.name][0], ...DEFAULT_MUSCLES[te.name][1]].find((x) => String(x).startsWith('delt_')) : null) || deltFor(te.name) : m;
    def = { id: uid(), name: te.name, mode: te.mode || 'wr', primary: fix(te.primary ?? null), secondary: [...new Set((te.secondary || []).map(fix))] };
    db.exercises.push(def);
  }
  return def;
}
// Añade los ejercicios de la tabla a la sesión, con los campos rellenos y el objetivo de cada serie.
function loadTemplateInto(sess, tpl) {
  const missing = [];
  for (const te of tpl.exercises) {
    const def = exerciseFromTemplate(te);
    const e1 = def.mode === 'wr' ? refE1RM(def.id) : null;
    const sets = te.sets.map((ts) => {
      const [lo] = parseRepsRange(ts.reps) || [null];
      const pct = def.mode === 'wr' ? tplSetPct(ts) : null;
      const w = pct && e1 ? Math.round((e1 * pct) / 100 / 2.5) * 2.5 : null;
      if (def.mode === 'wr' && pct && !e1 && !missing.includes(def.name)) missing.push(def.name);
      const set = { type: ts.type === 'C' ? 'C' : 'E', w, reps: null, rpe: null, rir: ts.rir ?? null, done: false,
        target: { reps: ts.reps || '', rir: ts.rir ?? null, pct: pct ? Math.round(pct * 10) / 10 : null, auto: ts.pct == null && !!pct } };
      if (def.mode === 'time') set.time = lo; else if (def.mode === 'dist') set.dist = lo; else set.reps = lo;
      if (ts.rir != null && ts.rir <= 4 && !isSimple() && intensityOf(def) !== 'rir') set.rpe = 10 - ts.rir;
      return set;
    });
    sess.exercises.push({ id: uid(), exerciseId: def.id, notes: '', equipment: [], restTarget: te.rest ?? null, tplNote: te.note || '', tplName: tpl.name, sets });
  }
  return missing;
}

/* ---------- Elegir una tabla (calendario o sesión) ---------- */
function tplChooserHTML(mode) {
  const list = tplList().sort((a, b) => a.name.localeCompare(b.name));
  return `<div class="row"><h3 class="spacer">${mode === 'new' ? 'Nueva sesión desde una tabla' : 'Añadir desde una tabla'}</h3><button class="ghost" data-action="close-modal" aria-label="Cerrar">✕</button></div>
    ${list.length ? `<div class="picker-list">${list.map((t) => `<button data-action="tpl-use" data-id="${t.id}" data-mode="${mode}">
        <span class="spacer" style="text-align:left"><b>${esc(t.name)}</b><br><small class="muted">${tplSummary(t)}</small></span></button>`).join('')}</div>`
      : '<p class="muted">Todavía no hay tablas. Crea una o guarda una sesión como tabla desde su menú ⋯.</p>'}
    <a class="btn block" href="#/templates">${ic('list')} Gestionar tablas</a>`;
}
const tplSummary = (t) => `${t.exercises.length} ejercicio${t.exercises.length === 1 ? '' : 's'} · ${t.exercises.reduce((a, e) => a + e.sets.filter((x) => x.type !== 'C').length, 0)} series efectivas`;

/* ---------- Biblioteca ---------- */
function viewTemplates() {
  const list = tplList().sort((a, b) => a.name.localeCompare(b.name));
  return `<div class="row"><a class="btn ghost" href="#/">‹ Calendario</a></div>
    <div class="row"><h1 class="spacer">Tablas ${info('templates')}</h1><button class="primary" data-action="tpl-new">＋ Nueva</button></div>
    <div class="card muted small">Plantillas de sesión compartidas por todos los usuarios de este dispositivo. Al cargarlas, el peso se calcula con el 1RM estimado de cada atleta.</div>
    ${list.length ? list.map((t) => `<a class="card list-item" href="#/template/${t.id}">
      <div class="row"><b class="spacer">${esc(t.name)}</b><span class="muted small">${tplSummary(t)}</span></div>
      <div class="muted small">${esc(t.exercises.map((e) => e.name).join(' · ') || 'Sin ejercicios')}</div></a>`).join('')
      : '<div class="empty">Aún no hay tablas.<br>Crea una nueva o, desde una sesión, usa ⋯ → «Guardar como tabla».</div>'}`;
}

/* ---------- Editor ---------- */
function viewTemplate(id) {
  const t = tplGet(id);
  if (!t) return `<div class="empty">Tabla no encontrada. <a href="#/templates">Volver</a></div>`;
  const rirOpts = (v) => `<option value="">–</option>` + [0, 1, 2, 3, 4, 5].map((r) => `<option value="${r}" ${v === r ? 'selected' : ''}>${r}</option>`).join('');
  let html = `<div class="row"><a class="btn ghost" href="#/templates">‹ Tablas</a><span class="spacer"></span>
      <button class="ghost" data-action="tpl-menu" data-id="${t.id}" aria-label="Más opciones">⋯</button></div>
    <input data-tpl-name="${t.id}" value="${esc(t.name)}" placeholder="Nombre de la tabla (p. ej. Pierna A)" style="font-size:1.2rem;font-weight:700;margin:6px 0 10px">`;
  t.exercises.forEach((te, ei) => {
    const unit = te.mode === 'time' ? 'Seg' : te.mode === 'dist' ? 'Metros' : 'Reps';
    html += `<div class="card">
      <div class="ex-head"><h3>${esc(te.name)}</h3>
        <button class="icon ghost" data-action="tpl-move" data-id="${t.id}" data-ei="${ei}" data-d="-1" aria-label="Subir" ${ei === 0 ? 'disabled' : ''}>${ic('up')}</button>
        <button class="icon ghost" data-action="tpl-move" data-id="${t.id}" data-ei="${ei}" data-d="1" aria-label="Bajar" ${ei === t.exercises.length - 1 ? 'disabled' : ''}>${ic('down')}</button>
        <button class="icon ghost danger" data-action="tpl-del-ex" data-id="${t.id}" data-ei="${ei}" aria-label="Quitar ejercicio">${ic('trash')}</button></div>
      <div class="muted small">${esc(muscleDesc(te))}</div>
      <table class="sets tpl-sets"><thead><tr><th>Tipo</th><th>${unit}</th>${te.mode === 'wr' || te.mode === 'bw' ? `<th>RIR ${info('rir')}</th>` : ''}${te.mode === 'wr' ? `<th>%1RM ${info('tpl_pct')}</th>` : ''}<th></th></tr></thead><tbody>
      ${te.sets.map((ts, si) => `<tr>
        <td><button class="settype ${ts.type === 'C' ? 'C' : 'E'}" data-action="tpl-type" data-id="${t.id}" data-ei="${ei}" data-si="${si}" title="${ts.type === 'C' ? 'Calentamiento' : 'Efectiva'}">${ts.type === 'C' ? 'C' : si + 1}</button></td>
        <td><input data-tpl="${t.id}:${ei}:${si}:reps" value="${esc(ts.reps ?? '')}" placeholder="${te.mode === 'wr' || te.mode === 'bw' ? '8-12' : ''}" inputmode="numeric" aria-label="${unit}"></td>
        ${te.mode === 'wr' || te.mode === 'bw' ? `<td><select data-tpl="${t.id}:${ei}:${si}:rir" aria-label="RIR">${rirOpts(ts.rir ?? null)}</select></td>` : ''}
        ${te.mode === 'wr' ? `<td><input data-tpl="${t.id}:${ei}:${si}:pct" value="${ts.pct ?? ''}" placeholder="${(() => { const p = tplSetPct({ ...ts, pct: null }); return p ? 'auto ' + Math.round(p) : 'auto'; })()}" inputmode="decimal" aria-label="% del 1RM"></td>` : ''}
        <td><button class="icon ghost" data-action="tpl-del-set" data-id="${t.id}" data-ei="${ei}" data-si="${si}" aria-label="Quitar serie">✕</button></td></tr>`).join('')}
      </tbody></table>
      <button class="block" style="margin-top:8px" data-action="tpl-add-set" data-id="${t.id}" data-ei="${ei}">＋ Serie</button>
      <div class="grid2" style="margin-top:8px">
        <div><label>Descanso objetivo</label><input data-tpl="${t.id}:${ei}:-:rest" value="${te.rest != null ? fmtSec(te.rest) : ''}" placeholder="m:ss" inputmode="numeric"></div>
        <div><label>Indicaciones</label><input data-tpl="${t.id}:${ei}:-:note" value="${esc(te.note || '')}" placeholder="Tempo, técnica…"></div>
      </div>
    </div>`;
  });
  html += `<button class="block" data-action="tpl-add-ex" data-id="${t.id}">＋ Añadir ejercicio</button>
    <div class="muted small" style="margin:8px 0">Repeticiones: número (5) o rango (8-12). %1RM vacío = automático a partir de reps + RIR (tabla RTS). Sin RIR ni %, el peso queda vacío.</div>
    <button class="primary block" data-action="tpl-start" data-id="${t.id}" ${t.exercises.length ? '' : 'disabled'}>${ic('play')} Empezar una sesión con esta tabla</button>`;
  return html;
}

/* ---------- Guardar una sesión como tabla ---------- */
function templateFromSession(s, name) {
  return {
    id: uid(), name, createdAt: Date.now(), updatedAt: Date.now(),
    exercises: s.exercises.map((e) => {
      const def = exById(e.exerciseId) || { name: '?', mode: 'wr' };
      return {
        name: def.name, mode: def.mode || 'wr', primary: def.primary ?? null, secondary: [...(def.secondary || [])],
        rest: e.restTarget ?? def.rest ?? null, note: e.tplNote || '',
        sets: e.sets.map((x) => ({
          type: x.type === 'C' ? 'C' : 'E',
          reps: x.target?.reps || String((def.mode === 'time' ? x.time : def.mode === 'dist' ? x.dist : x.reps) ?? ''),
          rir: x.target?.rir ?? x.rir ?? (x.rpe ? Math.max(0, Math.round(10 - x.rpe)) : null),
          pct: x.target && !x.target.auto ? x.target.pct : null,
        })),
      };
    }),
  };
}

Object.assign(actions, {
  'tpl-choose': (el) => openModal(tplChooserHTML(el.dataset.mode)),
  'tpl-use': (el) => {
    const t = tplGet(el.dataset.id); if (!t) return;
    closeModal();
    if (el.dataset.mode === 'new') {
      newSession(null, ui.day || todayISO());
      const s = currentSession(); s.title = t.name;
      const miss = loadTemplateInto(s, t);
      save(true); rerender(); if (miss.length) setTimeout(() => toast(`Sin 1RM estimado en: ${miss.join(', ')}. Escribe el peso.`), 300);
    } else {
      const s = currentSession(); if (!s) return;
      const miss = loadTemplateInto(s, t);
      save(true); rerender(); if (miss.length) setTimeout(() => toast(`Sin 1RM estimado en: ${miss.join(', ')}. Escribe el peso.`), 300);
    }
  },
  'tpl-start': (el) => { location.hash = '#/'; setTimeout(() => actions['tpl-use']({ dataset: { id: el.dataset.id, mode: 'new' } }), 0); },
  'tpl-new': () => {
    const t = { id: uid(), name: 'Nueva tabla', createdAt: Date.now(), updatedAt: Date.now(), exercises: [] };
    tplSaveAll([...tplList(), t]); location.hash = `#/template/${t.id}`;
  },
  'tpl-from-session': () => {
    const s = currentSession(); if (!s) return;
    if (!s.exercises.length) return alert('La sesión no tiene ejercicios.');
    const name = prompt('Nombre de la tabla:', s.title || 'Mi tabla');
    if (!name || !name.trim()) return;
    const t = templateFromSession(s, name.trim());
    tplSaveAll([...tplList(), t]); closeModal(); location.hash = `#/template/${t.id}`;
    setTimeout(() => toast('Tabla creada: revisa repeticiones, RIR y %1RM'), 200);
  },
  'tpl-menu': (el) => openModal(`<div class="row"><h3 class="spacer">Tabla</h3><button class="ghost" data-action="close-modal">✕</button></div>
      <div style="display:grid;gap:8px;margin-top:10px">
        <button data-action="tpl-dup" data-id="${el.dataset.id}">Duplicar tabla</button>
        <button class="danger" data-action="tpl-del" data-id="${el.dataset.id}">Borrar tabla</button>
      </div><div class="muted small" style="margin-top:8px">Borrar la tabla no afecta a las sesiones que ya la usaron.</div>`),
  'tpl-dup': (el) => {
    const t = tplGet(el.dataset.id); if (!t) return;
    const c = { ...JSON.parse(JSON.stringify(t)), id: uid(), name: t.name + ' (copia)', createdAt: Date.now(), updatedAt: Date.now() };
    tplSaveAll([...tplList(), c]); closeModal(); location.hash = `#/template/${c.id}`;
  },
  'tpl-del': (el) => {
    const t = tplGet(el.dataset.id); if (!t || !confirm(`¿Borrar la tabla «${t.name}»?`)) return;
    tplSaveAll(tplList().filter((x) => x.id !== t.id)); closeModal(); location.hash = '#/templates';
  },
  'tpl-add-ex': (el) => { ui.pickerTarget = { tpl: el.dataset.id }; openPicker(); },
  'tpl-move': (el) => { tplUpdate(el.dataset.id, (t) => { const i = +el.dataset.ei, j = i + +el.dataset.d; if (j >= 0 && j < t.exercises.length) [t.exercises[i], t.exercises[j]] = [t.exercises[j], t.exercises[i]]; }); rerender(); },
  'tpl-del-ex': (el) => { if (!confirm('¿Quitar este ejercicio de la tabla?')) return; tplUpdate(el.dataset.id, (t) => t.exercises.splice(+el.dataset.ei, 1)); rerender(); },
  'tpl-add-set': (el) => { tplUpdate(el.dataset.id, (t) => { const ss = t.exercises[+el.dataset.ei].sets; const last = ss[ss.length - 1]; ss.push(last ? { ...last, type: 'E' } : { type: 'E', reps: '8-12', rir: 2, pct: null }); }); rerender(); },
  'tpl-del-set': (el) => { tplUpdate(el.dataset.id, (t) => t.exercises[+el.dataset.ei].sets.splice(+el.dataset.si, 1)); rerender(); },
  'tpl-type': (el) => { tplUpdate(el.dataset.id, (t) => { const ts = t.exercises[+el.dataset.ei].sets[+el.dataset.si]; ts.type = ts.type === 'C' ? 'E' : 'C'; }); rerender(); },
});

// Selector de ejercicios en modo «añadir a la tabla»
const _pickExercise = actions['pick-exercise'];
actions['pick-exercise'] = (el) => {
  const tgt = ui.pickerTarget;
  if (!tgt) return _pickExercise(el);
  ui.pickerTarget = null; closeModal();
  const def = exById(el.dataset.id); if (!def) return;
  tplUpdate(tgt.tpl, (t) => t.exercises.push({ name: def.name, mode: def.mode || 'wr', primary: def.primary ?? null, secondary: [...(def.secondary || [])],
    rest: def.rest ?? null, note: '', sets: def.mode === 'wr' || def.mode === 'bw' ? [1, 2, 3].map(() => ({ type: 'E', reps: '8-12', rir: 2, pct: null })) : [{ type: 'E', reps: '', rir: null, pct: null }] }));
  rerender();
};
modal.addEventListener('close', () => { ui.pickerTarget = null; });

// Edición en línea del editor (se valida al salir del campo)
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.tplName) { const v = t.value.trim() || 'Tabla sin nombre'; tplUpdate(t.dataset.tplName, (x) => { x.name = v; }); return; }
  if (!t.dataset.tpl) return;
  const [id, ei, si, f] = t.dataset.tpl.split(':');
  const v = t.value.trim();
  let bad = false;
  tplUpdate(id, (tpl) => {
    const te = tpl.exercises[+ei];
    if (f === 'rest') { if (!v) delete te.rest; else { const s = parseRest(v); if (s == null) bad = true; else { te.rest = s; t.value = fmtSec(s); } } return; }
    if (f === 'note') { te.note = v; return; }
    const ts = te.sets[+si];
    if (f === 'reps') { if (v && !parseRepsRange(v)) bad = true; else ts.reps = v.replace(/\s+/g, ''); }
    if (f === 'rir') ts.rir = v === '' ? null : +v;
    if (f === 'pct') { if (!v) ts.pct = null; else { const n = num(v); if (n == null || n < 20 || n > 110) bad = true; else ts.pct = n; } }
  });
  t.classList.toggle('bad', bad);
  if (bad) toast(f === 'reps' ? 'Repeticiones: un número (5) o un rango (8-12)' : f === 'pct' ? '%1RM entre 20 y 110' : 'Descanso: 2:30 o 150');
  else if (f === 'rir' || f === 'reps') {
    // Actualiza solo la sugerencia de % (redibujar destruiría el campo al que pasa el usuario).
    const ts = tplGet(id)?.exercises[+ei]?.sets[+si];
    const pin = document.querySelector(`[data-tpl="${id}:${ei}:${si}:pct"]`);
    if (ts && pin) { const p = tplSetPct({ ...ts, pct: null }); pin.placeholder = p ? 'auto ' + Math.round(p) : 'auto'; }
  }
});

// Las vistas pudieron dibujarse antes de cargar este archivo.
if (['templates', 'template', 'session', 'sessions'].includes(route().name)) rerender();
