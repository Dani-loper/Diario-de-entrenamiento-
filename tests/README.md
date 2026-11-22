# Pruebas

Pruebas de extremo a extremo con [Playwright](https://playwright.dev): abren la app en un Chromium sin ventana,
la usan como un usuario (tocar, escribir, elegir) y comprueban el resultado.

```bash
npm install                          # instala Playwright (solo la primera vez)
npx playwright install chromium      # descarga el navegador (solo la primera vez)
npm test                             # todas
npm test -- 13 18                    # solo las que empiezan por 13 y 18
```

- `run.js` sirve la app en `http://localhost:8123`, ejecuta cada archivo de `e2e/` y resume el resultado.
  Una prueba falla si imprime `FAIL:`, si termina con error o si la página lanza un error de JavaScript.
- `support/fixed-clock.js` da por vista la ventana de bienvenida (salvo con `newContext({ welcome: true })`) y arranca el reloj del navegador el **domingo 22/11/2026 a las 10:00** (y luego avanza con normalidad),
  porque muchas comprobaciones usan fechas concretas. Se puede cambiar con `TEST_NOW=2027-01-15T10:00:00`.
- Las capturas que hacen las pruebas se guardan en `tests/out/` (no se suben al repositorio).
- GitHub las ejecuta en cada pull request (`.github/workflows/tests.yml`); si fallan, las capturas quedan como artefacto.

| Archivo | Qué comprueba |
|---|---|
| 01-sesion-y-graficas | Flujo básico: crear sesión, series, gráficas (prueba de humo) |
| 02-factores | Factores frente a rendimiento con datos sintéticos (humo) |
| 03-analisis | Pantallas de análisis (humo) |
| 04-rpe-rir | Intensidad por RPE, RIR o ambos y su sinergia |
| 05-rts-y-estres | Tabla RTS de %1RM y índice de estrés |
| 06-usuarios | Usuarios: migración, crear, cambiar, borrar |
| 07-informe | Informe de evolución y su PDF |
| 08-video-y-compartir | Vídeo por serie y compartir con datos superpuestos |
| 09-google-drive | Copia en Google Drive (simulada) |
| 10-copias | Copias de seguridad locales y avisos |
| 11-musculos | Músculos principal/secundarios, recuento fraccionado, figura |
| 12-modo-y-descansos | Modo sencillo/avanzado y registro de descansos |
| 13-tablas | Tablas de ejercicios (plantillas) |
| 14-coma-decimal | Coma decimal en los campos numéricos |
| 15-evolucion-y-records | Gráfica de evolución del 1RM y Salón de la fama |
| 16-series-por-musculo | Series efectivas, constancia, peso corporal, fuerza relativa |
| 17-favoritos-y-semana | Favoritos, «con el mismo peso», semana del atleta |
| 18-datos-del-dia | Pasos, calorías, mantenimiento estimado |
| 19-referencias-israetel | Zonas MV/MEV/MAV/MRV y editor |
| 20-deltoides | División de hombros en tres deltoides y su migración |
| 21-solapes | Ningún control visible se solapa, a 320/375/390/430 px |
| 22-aviso-ios | Aviso de instalar la app en iPhone |
| 23-peso-sugerido-y-calentamiento | Peso sugerido (y su ajuste con las series de hoy), calentamiento y discos |
| 24-superseries | Superseries: enlazar, descanso tras el último del grupo, tablas |
| 25-aviso-descarga | Aviso de descarga: sin aviso al progresar, aviso por caída de rendimiento y por muchas semanas sin descargar |
| 26-entrenador-atleta | Intercambio por archivo entre dos móviles: crear perfil enlazado, combinar sin perder datos, unificar ejercicios |
| 27-mesociclos | Mesociclos: progresión de RIR y series, descarga, plan por músculo, sesión que toca desde el calendario |
| 28-bienvenida | Ventana de bienvenida del primer arranque y datos del atleta en Usuarios |
| 29-sesiones-abiertas | Aviso de sesiones olvidadas, cierre con la hora de la última serie, cierre automático |
| 30-app-android | Dentro de la app Android (puente simulado): archivos por la hoja de compartir nativa, sin service worker |
| 31-catalogo-y-pesos | Catálogo de 143 ejercicios, pesos por músculo secundario, migración desde la versión anterior, editor de pesos, filtro por material |
