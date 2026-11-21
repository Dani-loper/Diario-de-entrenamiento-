# Diario de entrenamiento

PWA (app web instalable) para registrar sesiones de musculación y fitness desde el móvil. Sin dependencias ni compilación; funciona sin conexión.

## Funciones
- **Calendario** como pantalla de inicio: puntos en los días con sesión, crear sesión en el día seleccionado (hoy por defecto) y **buscador** (ejercicio, notas, material, sensaciones; sin importar tildes).
- **Antes de empezar** (opcional): peso corporal, sueño, energía, estrés, factores rápidos (dormí mal, estrés, molestias, cafeína…), sensaciones y observaciones.
- **Datos en el registro de series**: 1RM/volumen de hoy frente a la vez anterior, récord previo y gráfica desplegable (📈).
- **Resumen de sesión**: volumen, series, reps, RPE medio, récords, barras por ejercicio y grupo, y tendencia frente a sesiones con el mismo nombre.
- **Indicadores de fatiga**:
  - *Pérdida de velocidad intraserie (VL%)*, opcional (⚡ por ejercicio): velocidad media de la repetición más rápida y de la última, medida con encoder o app validada. Zonas configurables (por defecto <20% baja, 20–40% moderada, ≥40% excesiva).
  - *Caída de rendimiento entre series*: aviso si el 1RM estimado (corregido por RPE) cae ≥10% frente a la mejor serie del día.
  - Recuento de series al fallo o con RPE ≥ 9,5, y semáforo de fatiga en el resumen de la sesión.
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

## Base científica de los indicadores de fatiga
- Sánchez-Medina y González-Badillo (2011), *Med Sci Sports Exerc* 43(9): la pérdida de velocidad en la serie correlaciona con el lactato (r≈0,93–0,97) y el amonio. https://pubmed.ncbi.nlm.nih.gov/21311352/
- Pareja-Blanco et al. (2017): con VL20% se gana una fuerza similar a VL40% con un 40% menos de repeticiones; VL40% da más hipertrofia, pero pierde fibras IIX y salto.
- Rodríguez-Rosell et al. (2020), *JSCR* 34(9): VL% predice el % de repeticiones realizadas (R² 0,93–0,97), con diferencias entre press banca y sentadilla.
- García-Ramos et al. (2021): tomar como referencia la repetición más rápida y la velocidad media.
- Limitaciones: el RIR/RPE es impreciso lejos del fallo; la reproducibilidad de VL→% de reps en sentadilla libre es discutida; las apps de móvil para medir velocidad tienen una validez discutida (Martínez-Cava et al., 2020).
