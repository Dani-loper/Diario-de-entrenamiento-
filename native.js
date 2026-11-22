'use strict';
/* Puente con la app Android (Capacitor). En el navegador no hace nada.
 * Dentro de la app, el visor web no descarga archivos ni tiene navigator.share: los archivos (copias, PDF, vídeos,
 * datos para el entrenador) se escriben en la caché de la app y se abren con la hoja de compartir de Android,
 * desde donde se pueden guardar en Archivos o Drive o enviar por WhatsApp o correo. */
const IS_NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const nativePlugin = (name) => (IS_NATIVE && window.Capacitor.Plugins ? window.Capacitor.Plugins[name] : null);
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
async function nativeShareFile(file) {
  const Fs = nativePlugin('Filesystem'), Sh = nativePlugin('Share');
  if (!Fs || !Sh) throw new Error('Función no disponible en esta versión de la app.');
  const { uri } = await Fs.writeFile({ path: file.name, data: await blobToBase64(file), directory: 'CACHE' });
  await Sh.share({ title: file.name, files: [uri] });
}
async function nativeShareText(text) {
  const Sh = nativePlugin('Share'); if (!Sh) throw new Error('Función no disponible');
  await Sh.share({ text });
}
if (IS_NATIVE) document.documentElement.classList.add('native');
