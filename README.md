# Diario de entrenamiento

PWA (app web instalable) para registrar sesiones de musculación y fitness desde el móvil. Sin dependencias ni compilación; funciona sin conexión.

## Funciones
- **Modo de atleta** (Ajustes, por usuario): *Sencillo* (series, peso, repeticiones, RIR y descansos) o *Avanzado* (todo lo demás: RPE, material, sensaciones, índice de estrés, %1RM, fatiga, análisis). Cambiar de modo no borra nada.
- **Evolución por ejercicio**: gráfica de la mejor serie de cada sesión (1RM estimado, reps, tiempo o distancia) con eje de fechas real, periodo de 3 M, 6 M, 1 año o todo, línea de récord vigente, récords marcados y detalle al tocar un punto.
- **Series efectivas por músculo** (pantalla Progreso): series de trabajo con RIR ≤ 4 (configurable a ≤ 3) de los últimos 7 días, en recuento fraccionado (principal 1, secundario 0,5), sobre una franja orientativa de 10-20 series por semana; las series sin RIR se muestran aparte. Al tocar un músculo, su evolución en 12 semanas.
- **Constancia**: mapa de días entrenados (26 semanas), sesiones por semana y racha de semanas seguidas.
- **Peso corporal y fuerza relativa**: evolución del peso (de las sesiones o anotado en Progreso) y gráfica de cada ejercicio en kg o en × peso corporal.
- **Resumen de ejercicios**: minigráfica y cambio en el periodo (media de las 3 primeras sesiones frente a las 3 últimas) en la lista de Progreso.
- **Con el mismo peso**: en la ficha de cada ejercicio, repeticiones posibles (reps + RIR) con un peso concreto a lo largo del tiempo, para los pesos usados en al menos 2 sesiones.
- **Favoritos**: estrella ☆ en la ficha del ejercicio y en Récords; aparecen primero y se puede filtrar el Salón de la fama por favoritos y/o con vídeo. La lista de Progreso muestra solo los ejercicios usados (y favoritos), con opción de ver todos.
- **Semana del atleta** (Ajustes › Avanzado): día de inicio de la semana o microciclos de 5 a 14 días con fecha de inicio. Por defecto, lunes a domingo.
- **Salón de la fama** (pestaña Récords): récord de cada ejercicio y máximos reales por repeticiones (1-12 RM), con acceso directo al vídeo de la serie y filtro «con vídeo».
- **Tablas de ejercicios** (plantillas de sesión, comunes a todos los usuarios del dispositivo): ejercicios con series prescritas (tipo, repeticiones o rango, RIR, %1RM), descanso objetivo e indicaciones. Se cargan al crear una sesión o dentro de una sesión: los campos se rellenan y el peso se calcula con el 1RM estimado de cada atleta (sin %, a partir de reps + RIR con la tabla RTS). Las series cargadas no cuentan en estadísticas hasta marcarlas con ✓. También se puede guardar una sesión como tabla. Se incluyen en las copias de seguridad.
- **Descansos entre series**: campo «⏱ Descanso» editable bajo cada serie (m:ss o segundos). Al marcar ✓ arranca un cronómetro; «⏹ Parar» rellena el campo con el tiempo transcurrido y ✕ lo descarta. La app no calcula descansos por su cuenta. Descanso objetivo por ejercicio (avanzado), descanso medio en el resumen y en el CSV.
- **Usuarios** (perfiles locales, pensados para entrenadores): cada usuario tiene sus propias sesiones, catálogo, material y ajustes. La pantalla de usuarios permite crear, editar, cambiar y borrar (confirmando con el nombre), y el usuario activo está siempre visible arriba. Se puede exportar e importar la copia de todos los usuarios en un solo archivo. Los datos de versiones anteriores se migran al usuario «Yo».
- **Calendario** como pantalla de inicio: puntos en los días con sesión, crear sesión en el día seleccionado (hoy por defecto) y **buscador** (ejercicio, notas, material, sensaciones; sin importar tildes).
- **Antes de empezar** (opcional): peso corporal, sueño, energía, estrés, factores rápidos (dormí mal, estrés, molestias, cafeína…), sensaciones y observaciones.
- **Datos en el registro de series**: 1RM/volumen de hoy frente a la vez anterior, récord previo y gráfica desplegable (📈).
- **Resumen de sesión**: volumen, series, reps, RPE medio, récords, barras por ejercicio y grupo, y tendencia frente a sesiones con el mismo nombre.
- **Intensidad por ejercicio con RPE, RIR o ambos**: la app recuerda el modo de cada ejercicio. En modo combinado propone uno a partir del otro (RPE ≈ 10 − RIR) y avisa si no cuadran. El 1RM estimado usa el RIR con prioridad.
- **Intensidad relativa (%1RM)** por serie con la tabla RTS de Tuchscherer (repeticiones + RIR). Solo de 1 a 12 repeticiones y RIR 0–3,5; fuera de ese rango no se calcula. El 1RM estimado sale de la misma tabla.
- **Índice de estrés (Stress Index)** como sistema de cuantificación de cada sesión (o por defecto en Ajustes): multiarticular 1,4 − 0,2·RIR y monoarticular 1,3 − 0,2·RIR (RIR 0–5), con el índice por serie, ejercicio y grupo muscular.
- **Análisis** con pestañas: factores y rendimiento; carga semanal (índice de estrés por semana y por grupo); intensidad (zonas de %1RM y %1RM medio semanal).
- **Informe de evolución en PDF** (Progreso → Informe): periodo de 1, 3, 6 o 12 meses; resumen con comparación frente al periodo anterior; evolución por ejercicio (media de las 2 primeras frente a las 2 últimas sesiones, con gráfica); carga semanal (solo semanas completas); reparto por grupo y por zona de %1RM; volumen por músculo con la figura del cuerpo (media semanal del periodo); bienestar, peso corporal y comentarios del entrenador. El PDF se genera en el propio móvil con jsPDF (también en iPhone) y se comparte o descarga; queda además la opción de imprimir.
- **Vídeo por serie** (menú ⋯ de la serie): grabar o elegir un vídeo, que se guarda en el almacenamiento interno de la app (IndexedDB) y se puede reproducir, cambiar, borrar o «Guardar en el móvil». Los vídeos no entran en la copia de seguridad JSON; Ajustes muestra el espacio usado.
- **Compartir una serie**: vídeo con los datos superpuestos (re-codificado en el móvil; MP4 si el navegador lo permite), imagen 4:5 con los datos (con un fotograma del vídeo si lo hay) o texto. No incluye el nombre del atleta.
- **Técnica en YouTube**: búsqueda del ejercicio en YouTube y un vídeo de referencia guardado para cada ejercicio (solo enlaces https).
- **Copias de seguridad locales** (sin nube):
  - *Copias automáticas dentro de la app*: una al día y otra antes de restaurar, importar o borrar; se conservan las últimas 14 y se pueden restaurar o guardar. Sirven para deshacer errores, no protegen si se borran los datos del navegador o se pierde el móvil.
  - *Guardar copia en el móvil*: archivo con todos los usuarios mediante el menú de compartir (iPhone: «Guardar en Archivos») o descarga (Android: carpeta Descargas). Todas las exportaciones usan este mismo sistema.
  - *Aviso* en el calendario si hace más de 14 días que no se guarda una copia fuera de la app.
- **Copia en Google Drive** (opcional; solo aparece si se configura un ID de cliente en `config.js`): copia de todos los usuarios en la carpeta «Diario de entrenamiento» del Drive del usuario, automática al finalizar cada sesión y tras los cambios mientras el acceso está vigente; restauración en otro dispositivo; detección de conflictos entre dispositivos. Permiso `drive.file`: la app solo ve sus propios archivos. Los vídeos no se suben.
- **Fatiga**: aviso de caída de rendimiento entre series (1RM estimado ≥10% por debajo de la mejor serie del día) y recuento de series al fallo, con RIR 0 o RPE ≥ 9,5.
- **Carga interna** de la sesión (sRPE × minutos, método de Foster).
- **Ayuda ⓘ** junto a los términos técnicos (RPE, RIR, 1RM estimado, volumen, carga interna, error estándar, correlación…), que abre una explicación.
- **Factores y rendimiento** (Progreso → 🔬): rendimiento relativo de cada sesión frente a la mediana de ±6 semanas de cada ejercicio, comparado por factor marcado, sueño, energía y estrés, con un criterio de ±2 errores estándar.
- **Ejercicios manuales**: crear/editar desde Progreso o Ajustes, además del catálogo por defecto.
- **Sesiones**: fecha, nombre, peso corporal, energía (1-5), horas de sueño, notas, RPE de sesión y duración automática.
- **Ejercicios** con catálogo editable. Cada ejercicio tiene un **músculo principal** (pectoral, espalda, hombros, bíceps, tríceps, abdomen, glúteos, cuádriceps, femoral, gemelos, o ninguno en cardio) y **varios secundarios opcionales**. Cuatro tipos de registro: peso×reps, peso corporal (+lastre), tiempo y distancia.
- **Figura del cuerpo** (frontal y posterior) coloreada según el volumen por músculo, en el resumen de cada sesión y en la carga semanal. Conteo fraccionado: cada serie cuenta 1 para el principal y 0,5 para cada secundario (Pelland et al., 2024); en sesiones con índice de estrés se reparte el IE con los mismos pesos.
- **Series**: kg, reps, RPE (6–10), tipo (efectiva, calentamiento, drop set, al fallo) y marca de hecha.
- **Material por ejercicio** (straps, zapatillas de halterofilia, cinturón, rodilleras…), editable en Ajustes.
- **Notas** por ejercicio y por sesión.
- Muestra lo que hiciste **la vez anterior** y rellena las cargas de partida.
- **Repetir/duplicar** una sesión anterior.
- **Temporizador de descanso** al marcar una serie (vibración + pitido).
- **Progreso**: 1RM estimado (Epley corregido por RPE), récords, volumen, gráfica, tabla de cargas e historial **filtrable por material** (p. ej. peso muerto con/sin straps).
- **Exportar/importar** JSON y exportar CSV (para Excel/Sheets).

## Uso
Sírvelo por HTTPS (p. ej. GitHub Pages: Settings → Pages → rama y carpeta raíz) y en el móvil usa «Añadir a pantalla de inicio».
En local: `python3 -m http.server` y abre http://localhost:8000.

Los datos se guardan solo en el navegador del dispositivo: **exporta copias de seguridad con regularidad** (Ajustes → Exportar todos los usuarios). No hay sincronización entre dispositivos: el usuario no puede apuntar desde su propio móvil.

## Base científica
- Zourdos et al. (2016): escala RPE basada en repeticiones en reserva (RPE ≈ 10 − RIR).
- Precisión del RIR: mejor cerca del fallo y con pocas repeticiones; se suele infraestimar lejos del fallo (Helms, Zourdos y colaboradores).
- Foster et al. (2001): sRPE × duración como carga interna.
- Tabla RTS (M. Tuchscherer, Reactive Training Systems): %1RM según reps + RIR. Celdas contrastadas: 1@10=100, 1@9,5=97,8, 1@9=95,5, 2@10=95,5, 3@10=92,2, 5@10=86,3, 5@8=81,1.
- Índice de estrés: concepto de M. Tuchscherer; valores difundidos por PowerExplosive y Vitónica. No está validado en literatura revisada por pares.

## Configurar la copia en Google Drive
La copia en Drive necesita un ID de cliente OAuth de Google (gratuito). No es secreto: identifica la app ante Google.

1. En [Google Cloud Console](https://console.cloud.google.com/) crea un proyecto.
2. **APIs y servicios → Biblioteca**: activa **Google Drive API**.
3. **Google Auth Platform / Pantalla de consentimiento**: tipo **Externo**; nombre de la app, correo de asistencia y, en *Acceso a datos*, el permiso `.../auth/drive.file` (no sensible).
4. **Clientes → Crear cliente → Aplicación web**. En *Orígenes de JavaScript autorizados* añade la URL donde está publicada la app (p. ej. `https://usuario.github.io`; sin ruta ni barra final) y `http://localhost:8000` si pruebas en local.
5. Copia el ID (`….apps.googleusercontent.com`) en `config.js` → `googleClientId`, y publica.

**Estado de publicación:** mientras la app esté en *Prueba*, solo pueden usarla los usuarios de prueba que añadas (máximo 100), Google les muestra un aviso y su autorización caduca a los 7 días. Para uso real, pásala a *En producción*; con solo `drive.file` (no sensible) no hace falta la verificación de permisos sensibles.

## Dependencias incluidas
- [jsPDF](https://github.com/parallax/jsPDF) 4.2.1 (MIT), en `vendor/`, cargado solo al generar un PDF. Licencia en `vendor/jspdf.LICENSE`.
