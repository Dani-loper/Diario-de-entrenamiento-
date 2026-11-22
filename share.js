'use strict';
/* Intercambio entre entrenador y atleta por archivo (sin servidor).
 * - «Enviar datos» exporta un perfil (sus sesiones, catálogo, material, ajustes, mesociclos, datos diarios) y las tablas.
 * - «Importar datos de un atleta» lo combina con el perfil del mismo atleta en este dispositivo, o lo crea si no existe.
 *   Combinar = unir sin perder nada: se añaden las sesiones que no hay y las del archivo sustituyen a las que tienen el
 *   mismo identificador (son la versión más reciente de quien envía). Los ejercicios con el mismo nombre se unifican.
 *   Lo que se borra en un dispositivo NO se borra en el otro. Los ajustes de este dispositivo se conservan.
 * Flujo típico: el atleta envía su archivo → el entrenador lo importa (la 1.ª vez crea el perfil con el mismo
 * identificador) → el entrenador prepara tablas o un mesociclo en ese perfil y lo envía → el atleta lo importa. */

const FILE_TYPE = 'diario-entreno-atleta';
const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'atleta';

function exportAthlete(id) {
  save(true);
  const u = profiles.users.find((x) => x.id === id); if (!u) return;
  const data = id === profiles.active ? db : readUserData(id);
  const payload = { type: FILE_TYPE, version: 1, exportedAt: new Date().toISOString(), profile: { id: u.id, name: u.name, goal: u.goal || '', notes: u.notes || '' }, data, templates: window.tplList ? tplList() : [] };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  showShareResult(blob, `diario-${slug(u.name)}-${todayISO()}.json`, `Datos de ${esc(u.name)} listos`,
    `<div class="muted small">${data.sessions.length} sesiones${data.mesos?.length ? ` · ${data.mesos.length} mesociclo${data.mesos.length === 1 ? '' : 's'}` : ''}${payload.templates.length ? ` · ${payload.templates.length} tablas` : ''}. Los vídeos no se incluyen.</div>
     <div class="hint">Envíalo por WhatsApp, correo o AirDrop. En el otro móvil: Ajustes › Usuarios › <b>Importar datos de un atleta</b>.</div>`);
}

// Une dos listas por id; los del archivo sustituyen a los locales con el mismo id.
function mergeById(local = [], incoming = []) {
  const map = new Map(local.map((x) => [x.id, x]));
  let added = 0, updated = 0;
  for (const x of incoming) { if (map.has(x.id)) { if (JSON.stringify(map.get(x.id)) !== JSON.stringify(x)) updated++; } else added++; map.set(x.id, x); }
  return { list: [...map.values()], added, updated };
}
function mergeUserData(local, inc) {
  const out = JSON.parse(JSON.stringify(local));
  // Ejercicios: mismo id → el del archivo; mismo nombre con distinto id → se usa el local y se reasignan las sesiones.
  const remap = {};
  for (const e of inc.exercises || []) {
    if (out.exercises.some((x) => x.id === e.id)) { out.exercises = out.exercises.map((x) => (x.id === e.id ? { ...x, ...e } : x)); continue; }
    const same = out.exercises.find((x) => norm(x.name) === norm(e.name));
    if (same) remap[e.id] = same.id; else out.exercises.push(e);
  }
  const sessions = (inc.sessions || []).map((s) => ({ ...s, exercises: s.exercises.map((e) => (remap[e.exerciseId] ? { ...e, exerciseId: remap[e.exerciseId] } : e)) }));
  const ses = mergeById(out.sessions, sessions); out.sessions = ses.list;
  const eq = mergeById(out.equipment, (inc.equipment || []).filter((e) => !out.equipment.some((x) => x.id !== e.id && norm(x.name) === norm(e.name))));
  out.equipment = eq.list;
  const me = mergeById(out.mesos, inc.mesos); out.mesos = me.list;
  out.daily = { ...(out.daily || {}), ...(inc.daily || {}) };
  const bw = new Map((out.bodyweights || []).map((r) => [r.d, r])); for (const r of inc.bodyweights || []) bw.set(r.d, r);
  out.bodyweights = [...bw.values()].sort((a, b) => a.d.localeCompare(b.d));
  return { data: out, stats: { added: ses.added, updated: ses.updated, mesos: me.added + me.updated } };
}
function mergeTemplates(incoming = []) {
  if (!window.tplList) return 0;
  const map = new Map(tplList().map((t) => [t.id, t])); let n = 0;
  for (const t of incoming) { const cur = map.get(t.id); if (!cur || (t.updatedAt || 0) > (cur.updatedAt || 0)) { map.set(t.id, t); n++; } }
  tplSaveAll([...map.values()]);
  return n;
}
function importAthlete(payload) {
  if (payload?.type !== FILE_TYPE || !payload.profile?.id || !payload.data?.sessions) throw new Error('No es un archivo de datos de atleta de esta app.');
  const p = payload.profile, inc = normalize(JSON.parse(JSON.stringify(payload.data)));
  const existing = profiles.users.find((u) => u.id === p.id);
  if (window.takeSnapshot) takeSnapshot(`Antes de importar a ${p.name}`);
  save(true);
  const nt = mergeTemplates(payload.templates);
  if (!existing) {
    if (!confirm(`¿Crear el perfil «${p.name}» con ${inc.sessions.length} sesiones?`)) return;
    localStorage.setItem(dataKey(p.id), JSON.stringify(inc));
    profiles.users.push({ id: p.id, name: p.name, goal: p.goal, notes: p.notes, createdAt: Date.now() });
    saveProfiles(); rerender();
    toast(`Perfil «${p.name}» creado${nt ? ` · ${nt} tablas` : ''}`);
    return;
  }
  const local = existing.id === profiles.active ? db : readUserData(existing.id);
  const { data, stats } = mergeUserData(local, inc);
  if (!confirm(`Combinar con el perfil «${existing.name}» de este dispositivo:\n• ${stats.added} sesiones nuevas\n• ${stats.updated} sesiones actualizadas${stats.mesos ? `\n• ${stats.mesos} mesociclos` : ''}${nt ? `\n• ${nt} tablas` : ''}\nNo se borra nada. Se guarda antes una copia automática.`)) return;
  if (existing.id === profiles.active) { db = normalize(data); save(true); } else localStorage.setItem(dataKey(existing.id), JSON.stringify(data));
  rerender();
  toast(`«${existing.name}» actualizado: ${stats.added} nuevas, ${stats.updated} actualizadas`);
}

Object.assign(actions, {
  'athlete-export': (el) => exportAthlete(el.dataset.id || profiles.active),
  'athlete-import': () => $('#athlete-file').click(),
});
document.addEventListener('change', (e) => {
  const t = e.target; if (t.id !== 'athlete-file' || !t.files[0]) return;
  t.files[0].text().then((txt) => importAthlete(JSON.parse(txt))).catch((err) => alert('No se pudo importar: ' + err.message)).finally(() => { t.value = ''; });
});
Object.assign(window, { exportAthlete, importAthlete, mergeUserData });
