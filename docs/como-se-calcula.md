# Cómo se calcula cada cifra

Para comprobar a mano las estadísticas de la app. Cada apartado da la regla y un ejemplo con números.

Todas las cifras del ejemplo están comprobadas por la prueba automática `tests/e2e/34-calculos-documentados.js`. Si un cálculo cambia, esa prueba falla y este documento se actualiza.

**Si una cifra no te cuadra**, anota:
- la pantalla;
- el ejercicio y la fecha;
- la cifra que muestra la app y la que esperabas.

Con eso se localiza el fallo en minutos.

---

## Ejemplo que se usa en todo el documento

Es domingo, 22 de noviembre. La semana va de lunes 16 a domingo 22 (por defecto).

| Fecha | Sesión | Series anotadas |
|---|---|---|
| lun 9 nov | Torso | Press banca 3 × 8 con 77,5 kg @ RIR 2 |
| lun 16 nov | Torso | Press banca: calentamiento 40 × 10, luego 80 × 8 @ RIR 2, 80 × 8 @ RIR 2, 80 × 7 @ RIR 1 |
| | | Remo con barra: 70 × 10 @ RIR 3 (3 series) y 70 × 10 @ RIR 5 (1 serie) |
| jue 19 nov | Pierna | Sentadilla trasera: 100 × 5 @ RIR 2 (3 series) y 100 × 5 sin RIR |

Peso corporal anotado el 16 nov: 80 kg.

---

## 1. Qué series cuentan

- **Serie de trabajo**: cualquier serie que no sea de calentamiento (tipo «C»). Si viene de una tabla, solo cuenta cuando la marcas con ✓.
- **Serie efectiva**: serie de trabajo con **RIR 4 o menos**. En Ajustes se puede cambiar a RIR 3 (modo avanzado).
- Si anotas **RPE** en vez de RIR, se usa RIR = 10 − RPE. Por ejemplo, RPE 8 equivale a RIR 2.
- Las series **sin RIR ni RPE** cuentan para el volumen en kg. En las series por músculo se muestran aparte (no se sabe si fueron efectivas).

En el ejemplo, el 40 × 10 de press banca es calentamiento y no cuenta para nada. La serie de remo a RIR 5 cuenta para los kg, pero no como serie efectiva.

## 2. 1RM estimado

Se usa la **tabla RTS** (Reactive Training Systems). Para cada combinación de repeticiones y RIR, da el porcentaje del 1RM que supone ese peso.

> **1RM estimado = peso ÷ % de la tabla**

- **80 × 8 @ RIR 2.** Equivale a 10 repeticiones posibles al fallo, que en la tabla es el **73,9 %**. 80 ÷ 0,739 = **108,3 kg**.
- **80 × 7 @ RIR 1.** Equivale a 8 al fallo, el 78,6 %. 80 ÷ 0,786 = **101,8 kg**.
- **El 1RM de la sesión** es el de su mejor serie: **108,3 kg**.

Límites:
- **Solo se estima con 1 a 12 repeticiones y RIR 0 a 3,5.** Con más repeticiones o lejos del fallo, la tabla no es fiable y no se calcula. Por ejemplo, 100 × 5 @ RIR 4 no da 1RM.
- **Sin RIR se supone que la serie fue al fallo.** 100 × 5 sin RIR da 100 ÷ 0,863 = 115,9 kg. Con RIR 2 daría 123,3 kg. Por tanto, **si no anotas el RIR, el 1RM sale más bajo de lo real**.

La tabla completa está en la app: toca la (i) junto a «1RM est.» y, dentro, la (i) de «tabla RTS».

## 3. Volumen (kg)

> **Volumen = suma de peso × repeticiones de las series de trabajo** (sin calentamientos)

- Press banca el 16 nov: 80 × 8 + 80 × 8 + 80 × 7 = **1840 kg**. El 40 × 10 no suma.
- Sesión del 16 nov: 1840 + remo 4 × (70 × 10) = **4640 kg**. La serie a RIR 5 sí suma, porque es de trabajo.

**Comparación con la sesión anterior del mismo nombre:**
- Se compara solo en los ejercicios que están en las dos sesiones.
- Mientras la sesión está **abierta no se compara**: una sesión a medias siempre parecería peor.

## 4. Récords

**Récord de 1RM estimado:** el 1RM de la sesión supera al de todas las sesiones anteriores de ese ejercicio. El 16 nov, 108,3 kg supera los 104,9 kg del 9 nov (77,5 ÷ 0,739), así que es récord (★).

**Salón de la fama (Récords):**
- Por cada número de repeticiones (1 a 12) se guarda el mayor peso movido.
- Solo aparecen los máximos reales: si con más repeticiones moviste el mismo peso o más, el de menos repeticiones no se muestra.

## 5. Series efectivas por músculo (Progreso)

Se cuentan las **series efectivas de los últimos 7 días**, de hoy hacia atrás. En el ejemplo, del 16 al 22 nov; el 9 nov queda fuera.

Cada serie suma **1 al músculo principal** y a cada secundario **su fracción** (¼, ½ o ¾ según el ejercicio). El porqué de cada fracción está en [volumen-por-musculo.md](volumen-por-musculo.md); se ve y se cambia en Editar ejercicio.

| Ejercicio | Fracciones | Series efectivas | Suma |
|---|---|---|---|
| Press banca | pectoral 1 · tríceps ½ · deltoides anterior ½ | 3 | pectoral 3 · tríceps 1,5 · deltoides ant. 1,5 |
| Remo con barra | espalda 1 · bíceps ½ · deltoides posterior ½ · trapecio ¼ | 3 (la de RIR 5 no) | espalda 3 · bíceps 1,5 · deltoides post. 1,5 · trapecio 0,75 |
| Sentadilla trasera | cuádriceps 1 · glúteos ¾ · aductores ¾ · espalda ¼ | 3 (+1 sin RIR) | cuádriceps 3 · glúteos 2,25 · aductores 2,25 · espalda 0,75 |

Resultado:
- **Espalda = 3 + 0,75 = 3,75.**
- La serie sin RIR de sentadilla aparece como «+1» junto a cuádriceps, sin sumar.
- La de remo a RIR 5 se indica debajo: «2,3 series con RIR > 4 no cuentan» (1 + ½ + ½ + ¼ = 2,25).

**Colores** (referencias de Israetel, editables en Ajustes › Volumen por músculo en modo avanzado):

| Modo avanzado | Modo sencillo | Regla |
|---|---|---|
| Por debajo del mantenimiento / mantenimiento | **Poco** (gris) | menos que el MEV |
| Crecimiento mínimo | **Poco** | entre MEV y MAV mínimo |
| Rango adaptativo | **Bien** (verde) | entre MAV mínimo y máximo |
| Alto / por encima del MRV | **Mucho** (naranja) | más que el MAV máximo |

Pectoral 3 está por debajo de su mantenimiento (4), así que sale en gris.

Con un microciclo de otra duración, las referencias se escalan en proporción. Por ejemplo, con 10 días se multiplican por 10/7.

**Al tocar un músculo** se ven sus 12 últimas semanas. La media es la de las **4 últimas semanas completas**; la semana en curso aparece más clara y no cuenta.

## 6. Cambio en el periodo (lista de ejercicios en Progreso)

Se usa la mejor serie (1RM estimado) de cada sesión dentro del periodo elegido (3 M, 6 M, 1 año, Todo):
- Con **6 sesiones o más**: media de las 3 últimas frente a media de las 3 primeras.
- Con menos: última frente a primera.

Ejemplo (2 sesiones): 104,9 → 108,3 = **+3,2 %**.

Promediar 3 evita que un día muy bueno o muy malo al principio o al final del periodo distorsione el cambio.

## 7. Tabla de cargas (ficha del ejercicio)

> **Peso para N repeticiones al fallo = mejor 1RM estimado × % de la tabla (RIR 0)**, redondeado a 2,5 kg

Con 108,3 kg:
- 1 repetición: 107,5 kg;
- 5 repeticiones: 108,3 × 0,863 = 93,4, que redondea a **92,5 kg**;
- 8 repeticiones: 108,3 × 0,786 = 85,1, que redondea a **85 kg**.

## 8. Con el mismo peso

> **Repeticiones posibles = repeticiones hechas + RIR**

Ejemplo: 80 × 8 @ RIR 2 = 10 repeticiones posibles con 80 kg.

- Se compara la primera y la última sesión con ese peso.
- Solo aparecen los pesos usados en 2 sesiones o más.
- La gráfica sale a partir de 3 sesiones.

## 9. Peso sugerido

Para cada serie aún vacía:

1. **Repeticiones y RIR objetivo**:
   - si la sesión viene de una tabla, los de la tabla;
   - si no, los de la misma serie en la sesión anterior.
2. **1RM de referencia**, por orden:
   - el mejor de las series ya hechas hoy;
   - si no hay, el de la sesión anterior;
   - si tampoco, el mejor de los últimos 120 días.
3. **Peso = 1RM × % de la tabla** para esas repeticiones y ese RIR, redondeado al incremento mínimo de Ajustes (2,5 kg por defecto).

Ejemplo de sesión nueva el 22 nov:
- **Serie 1.** La serie 1 anterior fue 8 @ RIR 2 y el 1RM de esa sesión es 108,3. 108,3 × 0,739 = 80,0, así que sugiere **80 kg × 8 @ RIR 2**.
- **Serie 2,** después de hacer hoy 82,5 × 8 @ RIR 1. El 1RM de hoy es 82,5 ÷ 0,762 = 108,3. Para 8 @ RIR 2 vuelve a dar **80 kg**.
  - Si hoy hubieras ido más fuerte, la sugerencia subiría.
  - Es la forma de autorregular: el peso se ajusta a cómo estás ese día.

## 10. Calentamiento (botón del disco)

Rampa hacia el peso de trabajo, redondeada al incremento mínimo y con la barra (20 kg) primero:

| Peso de trabajo | Rampa |
|---|---|
| 8 repeticiones o más | barra × 10 · 50 % × 5 · 70 % × 3 |
| Menos de 8 | barra × 10 · 40 % × 5 · 60 % × 3 · 75 % × 2 · 85 % × 1 |

Ejemplos:
- Para 80 × 8: barra × 10, **40 × 5**, **55 × 3** (70 % de 80 = 56, redondea a 55).
- Para 140 × 3: barra × 10, 55 × 5, 85 × 3, 105 × 2, 120 × 1.

Se omite cualquier escalón que no sea más pesado que el anterior. Los discos por lado salen de los discos disponibles (Ajustes › Pesos y discos).

## 11. Constancia

- **Sesiones por semana (últimos 4 / últimos 12):** media de sesiones en las 4 o 12 últimas semanas completas. La semana en curso no cuenta.
- **Semanas seguidas entrenando:** semanas consecutivas con al menos una sesión, contando hacia atrás. La semana en curso solo suma si ya tiene sesión; si aún no la tiene, no rompe la racha.

## 12. Aviso de descarga (Progreso)

Se revisan tres señales:

1. **Rendimiento.** En las sesiones de los últimos 14 días, el 1RM de cada ejercicio se compara con tu mejor marca de los 28 días anteriores a esa sesión. Señal si la media baja un **3 % o más**, con al menos 3 sesiones.
2. **Fatiga dentro de la sesión.** Señal si en 2 sesiones o más de los últimos 14 días alguna serie rindió un 10 % menos que la mejor del día. El 10 % se cambia en Ajustes (modo avanzado).
3. **Semanas sin descargar.** Semanas seguidas con al menos el 70 % de las series de una semana normal. La «semana normal» es el percentil 75 de tus semanas con entrenamiento.

Avisos:
- **Fuerte** («posible fatiga acumulada»): si hay señal de rendimiento, o 5 semanas o más sin descargar junto con señal de fatiga.
- **Suave** («llevas muchas semanas sin descargar»): a partir de 8 semanas seguidas.
- «Ocultar durante 7 días» lo silencia.

## 13. Fuerza relativa (× peso corporal)

> **1RM estimado ÷ peso corporal** anotado más cercano a esa fecha (como máximo, a 30 días)

Ejemplo: 108,3 ÷ 80 = **1,35 veces tu peso**.

## 14. Calorías de mantenimiento (Progreso, si anotas calorías y peso)

Usa los últimos 28 días. Necesita calorías en 14 días o más y peso en 3 días o más, repartidos en al menos 14 días.

> **Mantenimiento = calorías medias − (tendencia del peso en kg/día × 7700)**

La tendencia es la recta que mejor se ajusta a tus pesos. 7700 kcal ≈ 1 kg es una aproximación clásica; en la realidad varía.

Ejemplo:
- Comes 2500 kcal de media.
- Tu peso baja 0,25 kg por semana, es decir, 0,0357 kg/día × 7700 = 275 kcal/día de déficit.
- Mantenimiento ≈ 2500 + 275 = **2775 kcal/día**.

## 15. Índice de estrés (solo modo avanzado)

Por serie efectiva:
- **Multiarticular:** 1,4 − 0,2 × RIR.
- **Monoarticular:** 1,3 − 0,2 × RIR.

Con RIR mayor que 5 suma 0. Sin RIR, la serie no se cuenta y se avisa.

Ejemplos:
- Press banca @ RIR 2: 1,4 − 0,4 = **1,0**.
- Curl de bíceps @ RIR 1: 1,3 − 0,2 = **1,1**.

## 16. Otras cifras de la sesión

- **RIR medio:** media del RIR de las series de trabajo que lo tienen.
- **Descanso medio:** media de los descansos anotados en las series de trabajo. La app no los inventa: solo cuenta los que escribes o los que rellena «Parar» en el cronómetro.
- **Duración:** desde que se crea la sesión hasta «Finalizar». Si se cierra sola por inactividad, hasta la hora de la última serie marcada.
