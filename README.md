# Diario de entrenamiento

PWA (app web instalable) para registrar sesiones de musculación y fitness desde el móvil. Sin dependencias ni compilación; funciona sin conexión.

## Funciones
- **Calendario** como pantalla de inicio: puntos en los días con sesión, crear sesión en el día seleccionado (hoy por defecto) y **buscador** (ejercicio, notas, material, sensaciones; sin importar tildes).
- **Antes de empezar** (opcional): peso corporal, sueño, energía, estrés, factores rápidos (dormí mal, estrés, molestias, cafeína…), sensaciones y observaciones.
- **Datos en el registro de series**: 1RM/volumen de hoy frente a la vez anterior, récord previo y gráfica desplegable (📈).
- **Resumen de sesión**: volumen, series, reps, RPE medio, récords, barras por ejercicio y grupo, y tendencia frente a sesiones con el mismo nombre.
- **Intensidad por ejercicio con RPE, RIR o ambos**: la app recuerda el modo de cada ejercicio. En modo combinado propone uno a partir del otro (RPE ≈ 10 − RIR) y avisa si no cuadran. El 1RM estimado usa el RIR con prioridad.
- **Fatiga**: aviso de caída de rendimiento entre series (1RM estimado ≥10% por debajo de la mejor serie del día) y recuento de series al fallo, con RIR 0 o RPE ≥ 9,5.
- **Carga interna** de la sesión (sRPE × minutos, método de Foster).
- **Ayuda ⓘ** junto a los términos técnicos (RPE, RIR, 1RM estimado, volumen, carga interna, error estándar, correlación…), que abre una explicación.
- **Factores y rendimiento** (Progreso → 🔬): rendimiento relativo de cada sesión frente a la mediana de ±6 semanas de cada ejercicio, comparado por factor marcado, sueño, energía y estrés, con un criterio de ±2 errores estándar.
- **Ejercicios manuales**: crear/editar desde Progreso o Ajustes, además del catálogo por defecto.
- **Sesiones**: fecha, nombre, peso corporal, energía (1-5), horas de sueño, notas, RPE de sesión y duración automática.
- **Ejercicios** con catálogo editable (pierna, empuje, tirón, halterofilia, core, cardio…) y cuatro tipos de registro: peso×reps, peso corporal (+lastre), tiempo y distancia.
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

Los datos se guardan solo en el navegador del dispositivo: **exporta copias de seguridad con regularidad**.

## Base científica
- Zourdos et al. (2016): escala RPE basada en repeticiones en reserva (RPE ≈ 10 − RIR).
- Precisión del RIR: mejor cerca del fallo y con pocas repeticiones; se suele infraestimar lejos del fallo (Helms, Zourdos y colaboradores).
- Foster et al. (2001): sRPE × duración como carga interna.
- Epley: 1RM ≈ peso × (1 + reps/30), con las repeticiones en reserva sumadas a las reps.
