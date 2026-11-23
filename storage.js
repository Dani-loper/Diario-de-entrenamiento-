'use strict';
/* Almacenamiento de los datos (perfiles, datos de cada usuario y tablas).
 * localStorage tiene ~5 MB por web, compartidos por todos los usuarios del dispositivo (un año de un atleta ocupa
 * ~0,6 MB). Por eso los datos viven en IndexedDB (cientos de MB). La app sigue leyendo de forma síncrona:
 * al arrancar se cargan todos en memoria (kv) y cada cambio se escribe en IndexedDB en segundo plano.
 * - Migración: cualquier clave de datos que esté en localStorage (versiones anteriores) se pasa a IndexedDB y se
 *   borra de localStorage. Las preferencias pequeñas (avisos, bienvenida…) siguen en localStorage.
 * - Si IndexedDB no está disponible (algunos modos privados), se usa localStorage como antes.
 * - Diario de escrituras: si la app se cierra justo después de un cambio, el navegador puede cancelar la escritura en
 *   IndexedDB. Por eso cada cambio se apunta antes en localStorage («kvj:clave») y el apunte se borra cuando
 *   IndexedDB confirma; al arrancar se aplican los apuntes pendientes. localStorage solo guarda lo pendiente.
 * - Este archivo carga después el resto de scripts, cuando los datos ya están en memoria. */

const KV_DB = 'diario-entreno-datos';
const JOURNAL = 'kvj:';
const isDataKey = (k) => k === 'diario-entreno.perfiles' || k === 'diario-entreno.tablas' || k === 'diario-entreno.v1' || k.startsWith('diario-entreno.u.');
const kv = (() => {
  const mem = new Map();
  let idb = null, pending = 0, lastError = null;
  const tx = (mode, fn) => new Promise((resolve, reject) => {
    const t = idb.transaction('kv', mode); const r = fn(t.objectStore('kv'));
    t.oncomplete = () => resolve(r && 'result' in r ? r.result : undefined);
    t.onerror = () => reject(t.error); t.onabort = () => reject(t.error);
  });
  const persist = (op, key, val) => {
    if (!idb) {
      try { if (op === 'put') localStorage.setItem(key, val); else localStorage.removeItem(key); }
      catch (e) { lastError = e; window.errLog?.('No se pudo guardar (localStorage): ' + e.message); alert('No se pudo guardar: ' + e.message); }
      return;
    }
    const entry = JSON.stringify({ op, v: op === 'put' ? val : null });
    let journaled = false;
    try { localStorage.setItem(JOURNAL + key, entry); journaled = true; } catch (e) { /* sin espacio: se confía en IndexedDB */ }
    pending++;
    tx('readwrite', (st) => (op === 'put' ? st.put(val, key) : st.delete(key)))
      .then(() => { if (journaled && localStorage.getItem(JOURNAL + key) === entry) localStorage.removeItem(JOURNAL + key); })
      .catch((e) => { lastError = e; window.errLog?.('No se pudo guardar (IndexedDB): ' + (e?.message || e)); alert('No se pudo guardar en el almacenamiento: ' + (e?.message || e)); })
      .finally(() => { pending--; });
  };
  async function open() {
    try {
      idb = await new Promise((resolve, reject) => {
        const r = indexedDB.open(KV_DB, 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
      });
      const keys = await tx('readonly', (st) => st.getAllKeys()), vals = await tx('readonly', (st) => st.getAll());
      keys.forEach((k, i) => mem.set(k, vals[i]));
      // Escrituras que no llegaron a confirmarse (la app se cerró justo después de un cambio).
      const journal = [];
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(JOURNAL)) journal.push(k); }
      for (const jk of journal) {
        const key = jk.slice(JOURNAL.length);
        try {
          const { op, v } = JSON.parse(localStorage.getItem(jk));
          if (op === 'put') { mem.set(key, v); await tx('readwrite', (st) => st.put(v, key)); } else { mem.delete(key); await tx('readwrite', (st) => st.delete(key)); }
        } catch (e) { /* apunte dañado: se ignora */ }
        localStorage.removeItem(jk);
      }
      // Migración desde localStorage (versiones anteriores o datos escritos por otra copia de la app).
      const moved = [];
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (isDataKey(k)) moved.push(k); }
      for (const k of moved) { const v = localStorage.getItem(k); mem.set(k, v); await tx('readwrite', (st) => st.put(v, k)); }
      for (const k of moved) localStorage.removeItem(k); // solo tras guardarlas en IndexedDB
      localStorage.removeItem('diario-entreno.nube'); // estado de la antigua copia en Google Drive (eliminada)
    } catch (e) {
      // Sin IndexedDB: se trabaja directamente con localStorage.
      idb = null; lastError = e;
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (isDataKey(k)) mem.set(k, localStorage.getItem(k)); }
    }
  }
  return {
    ready: open(),
    get: (k) => (mem.has(k) ? mem.get(k) : null),
    set: (k, v) => { mem.set(k, v); persist('put', k, v); },
    remove: (k) => { mem.delete(k); persist('del', k); },
    keys: () => [...mem.keys()],
    // Tamaño aproximado de los datos (caracteres de JSON) y backend en uso.
    stats: () => ({ backend: idb ? 'IndexedDB' : 'localStorage', chars: [...mem.values()].reduce((a, v) => a + (v ? v.length : 0), 0), pending, lastError }),
    // Borra todo (solo para pruebas y «borrar todos los datos»).
    async clearAll() { mem.clear(); try { localStorage.clear(); } catch (e) { /* nada */ } if (idb) await tx('readwrite', (st) => st.clear()); },
  };
})();

// Carga el resto de la app cuando los datos ya están en memoria (en orden, sin bloquear el primer pintado).
const APP_SCRIPTS = ['app.js', 'pdf.js', 'media.js', 'backup.js', 'autobackup.js', 'templates.js', 'records.js', 'progress.js',
  'daily.js', 'suggest.js', 'share.js', 'meso.js', 'profile.js', 'tour.js', 'autoclose.js', 'privacy.js', 'update.js'];
kv.ready.then(() => {
  APP_SCRIPTS.forEach((src, i) => {
    const s = document.createElement('script'); s.src = src; s.async = false;
    if (i === APP_SCRIPTS.length - 1) s.onload = () => { window.__appReady = true; document.dispatchEvent(new Event('app-ready')); };
    document.body.appendChild(s);
  });
});
