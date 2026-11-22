'use strict';
/* Datos del atleta (en su perfil): fecha de nacimiento, sexo, altura y experiencia. El peso corporal va a su registro
 * de peso (db.bodyweights). Se piden en una ventana de bienvenida la primera vez que se abre la app y se pueden
 * cambiar en Usuarios › editar. Todo es opcional salvo el nombre. */

const WELCOME_KEY = 'diario-entreno.bienvenida';
const SEX = { '': '—', f: 'Mujer', m: 'Hombre' };
const EXPERIENCE = { '': '—', novato: 'Menos de 1 año', inter: 'De 1 a 3 años', avanz: 'Más de 3 años' };

function ageOf(birth, at = todayISO()) {
  if (!birth) return null;
  const [y, m, d] = birth.split('-').map(Number), [Y, M, D] = at.split('-').map(Number);
  return Y - y - (M < m || (M === m && D < d) ? 1 : 0);
}
const profileLine = (u) => [ageOf(u.birth) != null ? `${ageOf(u.birth)} años` : '', u.height ? `${fmt(u.height, 0)} cm` : '', u.experience ? EXPERIENCE[u.experience] + ' entrenando' : ''].filter(Boolean).join(' · ');

// Campos comunes a la bienvenida y al formulario de usuario.
function profileFieldsHTML(u = {}, { weight = false } = {}) {
  return `<div class="grid2">
      <div><label>Fecha de nacimiento</label><input type="date" id="pf-birth" value="${esc(u.birth || '')}" max="${todayISO()}"></div>
      <div><label>Sexo</label><select id="pf-sex">${Object.entries(SEX).map(([k, v]) => `<option value="${k}" ${(u.sex || '') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div><label>Altura (cm)</label><input type="text" inputmode="numeric" id="pf-height" value="${u.height ?? ''}" placeholder="p. ej. 172" autocomplete="off"></div>
      ${weight ? `<div><label>Peso (kg)</label><input type="text" inputmode="decimal" id="pf-weight" value="" placeholder="p. ej. 70,5" autocomplete="off"></div>` : ''}
      <div${weight ? ' style="grid-column:1/-1"' : ''}><label>Experiencia entrenando fuerza</label><select id="pf-exp">${Object.entries(EXPERIENCE).map(([k, v]) => `<option value="${k}" ${(u.experience || '') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    </div>`;
}
// Lee y valida los campos. Devuelve { fields, weight } o lanza un Error con un mensaje para el usuario.
function readProfileFields() {
  const birth = $('#pf-birth')?.value || '';
  const height = num($('#pf-height')?.value), weight = num($('#pf-weight')?.value);
  if (birth && (birth > todayISO() || ageOf(birth) > 110)) throw new Error('Revisa la fecha de nacimiento.');
  if ($('#pf-height')?.value.trim() && (height == null || height < 100 || height > 250)) throw new Error('La altura debe estar entre 100 y 250 cm.');
  if ($('#pf-weight')?.value.trim() && (weight == null || weight < 25 || weight > 300)) throw new Error('El peso debe estar entre 25 y 300 kg.');
  return { fields: { birth, sex: $('#pf-sex')?.value || '', height: height ?? null, experience: $('#pf-exp')?.value || '' }, weight };
}
const saveWeight = (w) => { if (w == null) return; db.bodyweights = (db.bodyweights || []).filter((r) => r.d !== todayISO()).concat({ d: todayISO(), v: w }); };

/* ---------- Bienvenida ---------- */
function welcomeHTML() {
  const u = activeUser();
  return `<div class="welcome">
    <h3>Bienvenido/a a tu diario de entrenamiento</h3>
    <div class="muted small" style="margin:4px 0 12px">Unos datos básicos para personalizar la app. Solo el nombre es obligatorio; lo demás puedes completarlo cuando quieras en <b>Usuarios</b>. Se guarda solo en este dispositivo.</div>
    <div style="display:grid;gap:10px">
      <div><label>Nombre</label><input id="uf-name" value="${u.name === 'Yo' ? '' : esc(u.name)}" placeholder="Tu nombre" autocomplete="off"></div>
      ${profileFieldsHTML(u, { weight: true })}
      <div><label>Objetivo (opcional)</label><input id="uf-goal" value="${esc(u.goal || '')}" placeholder="p. ej. ganar fuerza, hipertrofia, competir…"></div>
      <div><label>¿Qué quieres registrar? ${info('level')}</label>
        <select id="pf-level"><option value="simple" ${isSimple() ? 'selected' : ''}>Lo básico: series, peso, repeticiones y RIR</option><option value="advanced" ${isSimple() ? '' : 'selected'}>Todo: RPE, material, sensaciones, análisis…</option></select></div>
      <button class="primary" data-action="welcome-save">Empezar</button>
      <button class="ghost" data-action="welcome-skip">Ahora no</button>
    </div></div>`;
}
const welcomeDone = () => { try { localStorage.setItem(WELCOME_KEY, '1'); } catch (e) { /* nada */ } };
function maybeWelcome() {
  let seen = null; try { seen = localStorage.getItem(WELCOME_KEY); } catch (e) { return; }
  if (seen) return;
  // Instalaciones que ya tienen datos: no es la primera vez.
  if (profiles.users.length > 1 || db.sessions.length) { welcomeDone(); return; }
  openModal(welcomeHTML());
  setTimeout(() => $('#uf-name')?.focus(), 50);
}

Object.assign(actions, {
  'welcome-save': () => {
    const name = $('#uf-name').value.trim();
    if (!name) { $('#uf-name').classList.add('bad'); $('#uf-name').focus(); return toast('Escribe tu nombre'); }
    let r; try { r = readProfileFields(); } catch (e) { return toast(e.message); }
    Object.assign(activeUser(), { name, goal: $('#uf-goal').value.trim(), ...r.fields });
    saveProfiles();
    saveWeight(r.weight);
    db.settings.level = $('#pf-level').value; save(true);
    welcomeDone(); closeModal(); rerender();
    toast(`¡Hola, ${name}!`);
  },
  'welcome-skip': () => { welcomeDone(); closeModal(); },
});
Object.assign(window, { profileFieldsHTML, readProfileFields, saveWeight, profileLine, ageOf });
maybeWelcome();
