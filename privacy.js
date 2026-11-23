'use strict';
/* Privacidad: resumen en Ajustes y texto completo en una ventana. Debe coincidir con docs/privacidad.md. */
const PRIVACY_HTML = `
  <p><b>Tus datos se guardan solo en este dispositivo.</b> La app no tiene servidor, ni cuentas, ni publicidad, ni analítica, ni cookies de terceros. Nadie (tampoco quien hizo la app) puede ver lo que registras.</p>
  <p><b>Qué guarda:</b> los perfiles (nombre, fecha de nacimiento, sexo, altura, objetivo y notas), los entrenamientos (series, pesos, sensaciones, notas, descansos), los datos del día (pasos, calorías, peso) y los vídeos que añadas a las series. Algunos, como el peso o las molestias que anotes, pueden considerarse <b>datos de salud</b>.</p>
  <p><b>Cuándo salen del dispositivo:</b> solo cuando tú lo decides: al guardar o enviar una copia de seguridad, un informe PDF, una imagen o vídeo de una serie, o tus datos para el entrenador. Van a donde tú elijas (Archivos, Drive, WhatsApp, correo…), y desde ahí aplican las condiciones de ese servicio.</p>
  <p><b>Conexiones a Internet:</b> la app Android consulta una vez al día en GitHub si hay una versión nueva (GitHub ve la dirección IP, no tus datos). Al pulsar «Técnica» se abre YouTube. La versión web se descarga de GitHub Pages. Nada más.</p>
  <p><b>Borrar:</b> Ajustes › «Borrar sus datos» borra los del usuario activo; Usuarios › papelera borra un perfil y sus vídeos. Desinstalar la app (o borrar los datos del sitio en el navegador) lo borra todo, incluidas las copias automáticas internas: guarda antes una copia si la quieres conservar. En la app Android, la <b>copia automática en el móvil</b> se guarda en la carpeta Documentos/DiarioEntreno y <b>no</b> se borra al desinstalar: bórrala desde el gestor de archivos si no la quieres (o desactívala en Ajustes › Copia de seguridad).</p>
  <p><b>Registro de errores:</b> si la app falla, guarda en este dispositivo una descripción técnica del error (sin tus datos). Solo sale si tú copias o envías el informe desde Ajustes › Informe de error.</p>
  <p><b>Entrenadores:</b> si registras datos de tus atletas en tu dispositivo, eres responsable de ellos: pídeles permiso, y en el caso de menores, a sus padres o tutores.</p>`;
function privacySettingsHTML() {
  return `<h2>Privacidad</h2><div class="card">
    <div class="muted small">Tus datos se guardan <b>solo en este dispositivo</b>: sin servidor, sin cuentas, sin publicidad ni analítica. Solo salen cuando tú compartes algo.</div>
    <button class="block" style="margin-top:8px" data-action="privacy">Leer el texto completo</button>
  </div>`;
}
Object.assign(actions, {
  privacy: () => openModal(`<div class="row"><h3 class="spacer">Privacidad</h3><button class="ghost" data-action="close-modal" aria-label="Cerrar">✕</button></div><div class="gloss">${PRIVACY_HTML}</div>`),
});
Object.assign(window, { privacySettingsHTML });
