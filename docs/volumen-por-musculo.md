# Cómo cuenta cada ejercicio para cada músculo

Criterios con los que la app reparte el volumen semanal (series efectivas) entre músculos, y la evidencia que los respalda.
El catálogo con los valores está en [`catalog.js`](../catalog.js) y se puede editar por ejercicio en la app (Editar ejercicio).

## 1. Método

Cada **serie efectiva** (RIR ≤ 4, sin calentamientos) cuenta:

| Papel del músculo | Cuenta | Cuándo |
|---|---|---|
| Principal | **1** | El músculo que el ejercicio pretende trabajar. |
| Secundario alto | **¾** | Hay estudios de crecimiento que muestran un aumento cercano al del ejercicio específico, o una biomecánica que lo carga casi en todo el recorrido. |
| Secundario medio | **½** | Valor por defecto. |
| Secundario bajo | **¼** | Participa claramente, pero con poco recorrido o carga (estabilizador o sinergista menor). |
| Sin contar | — | Los estudios de crecimiento no encuentran aumento medible. |

**Por qué ½ por defecto.** El metaanálisis de dosis-respuesta de [Pelland et al. (2024/2025, *Sports Medicine*)](https://www.researchgate.net/publication/384628335_The_Resistance_Training_Dose-Response_Meta-Regressions_Exploring_the_Effects_of_Weekly_Volume_and_Frequency_on_Muscle_Hypertrophy_and_Strength_Gain) comparó tres formas de contar las series indirectas: como 1 («total»), como 0,5 («fraccionada») y como 0 («directa»). La **fraccionada fue la que mejor predijo la hipertrofia**. Es un promedio sobre muchos estudios y ejercicios, así que **sirve como valor general, pero no dice que cada secundario valga exactamente 0,5**.

**Por qué ajustar por ejercicio.** Los estudios que miden el **crecimiento real** de cada músculo con resonancia o ecografía, y no solo la activación (EMG), muestran contribuciones muy distintas según el ejercicio. Por eso se usan ¼, ½ y ¾. Afinar más daría una precisión que los datos no tienen.

## 2. Evidencia por grupo

### Sentadilla, prensa y zancadas → glúteo alto (¾), femoral nada
- [Kubo et al. (2019)](https://link.springer.com/doi/10.1007/s00421-019-04181-y), sentadilla completa frente a media sentadilla, 10 semanas, medido con resonancia:
  - el glúteo mayor creció un 6,7 % (completa) frente a un 2,2 % (media);
  - los aductores, un 6,2 % frente a un 2,7 %;
  - el **femoral no creció en ningún grupo** (≈ 0,5 %);
  - el recto femoral tampoco creció.
- [Plotkin et al. (2023)](https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2023.1279170/full), hip thrust frente a sentadilla, 9 semanas, medido con resonancia:
  - **crecimiento del glúteo similar** con ambos ejercicios;
  - más cuádriceps y aductores con la sentadilla;
  - **femoral mínimo** en ambos.
- Un estudio de 12 semanas que comparó prensa con extensión de cuádriceps ([resumen en Biolayne](https://biolayne.com/reps/issue-51/leg-press-or-knee-extension-for-quad-growth/)):
  - la **prensa hizo crecer el glúteo un 15,4 %** y el aductor mayor;
  - con la extensión no crecieron;
  - el cuádriceps creció de forma comparable con ambos.

→ Sentadilla, prensa, zancadas y búlgaras: **glúteo ¾**. En la sentadilla trasera, el **femoral deja de contar**; antes contaba 0,5 en zancadas. En el hip thrust, el **femoral tampoco cuenta**.

### Peso muerto y bisagras → femoral y glúteo
- Un ensayo aleatorizado de 2025 comparó el peso muerto con piernas rígidas con el curl nórdico, midiendo con ecografía 3D. El peso muerto hizo crecer los isquiotibiales un ≈ 7 % y el nórdico un ≈ 11 %, con patrones distintos (semimembranoso frente a semitendinoso). Lo conozco solo por resúmenes: no he podido consultar el artículo original.
- Los ejercicios con la cadera flexionada favorecen a los isquiotibiales que también extienden la cadera ([estudio de 2024, curl nórdico frente a excéntrico en posición estirada](https://pubmed.ncbi.nlm.nih.gov/38857522/)). El curl sentado (isquiotibial estirado) creció más que el tumbado, un 14 % frente a un 9 % ([Maeo et al., 2021](https://pubmed.ncbi.nlm.nih.gov/33009197/)).

→ Peso muerto rumano y buenos días: **femoral principal, glúteo ¾**. Peso muerto convencional: **glúteo principal**, con femoral, espalda (erectores) y cuádriceps a ½. No hay estudios de crecimiento que separen mejor estos tres.

### Remo y jalón → bíceps ½ (¾ con agarre supino)
- [Mannarino et al. (2021)](https://paulogentil.com/pdf/Single-Joint%20Exercise%20Results%20in%20Higher%20Hypertrophy%20of%20Elbow%20Flexors%20Than%20Multijoint%20Exercise.pdf): el remo con mancuerna hizo crecer los flexores del codo un 5,2 %, frente a un 11,1 % con curl. Es decir, **≈ 0,47 del curl**.
- Gentil y colaboradores ([resumen en StrengthLog](https://www.strengthlog.com/are-rows-and-lat-pulldowns-enough-for-great-biceps-growth/)): en principiantes, el jalón hizo crecer el bíceps igual que el curl (6,1 % frente a 5,8 %), y añadir curl al jalón no aportó más. La muestra no tenía experiencia y el diseño tiene limitaciones conocidas.

→ Remos, jalón y dominadas pronas: **bíceps ½**. Dominadas supinas y jalón estrecho o supino: **bíceps ¾**. Deltoides posterior: **½ en remos** (más abducción horizontal) y **¼ en jalón y dominadas** ([EMG: el remo activa más el deltoides medio y posterior que el jalón](https://pubmed.ncbi.nlm.nih.gov/24947920/); orientativo, porque la EMG no mide crecimiento).

### Press → tríceps ½, deltoides anterior ½–¾
- En press de banca el pectoral crece antes y más que el tríceps, pero el tríceps también crece ([evolución temporal, 24 semanas](https://pubmed.ncbi.nlm.nih.gov/24265879/); [Brandão et al., 2020](https://pubmed.ncbi.nlm.nih.gov/32149887/)). La regla práctica de ½ del tríceps en el press es la más extendida ([Stronger by Science](https://www.strongerbyscience.com/volume/), [Henselmans](https://mennohenselmans.com/how-to-count-training-volume-design-training-split/)).
- El press inclinado carga más el deltoides anterior que el plano. Las aperturas lo cargan poco.

→ Press plano: **tríceps ½, deltoides anterior ½**. Inclinado: **deltoides anterior ¾**. Declinado: **¼**. Fondos: **tríceps ¾** (mucho recorrido de codo). Aperturas y contractor: **deltoides anterior ¼**.

### Hombro
- La EMG del deltoides lateral es mayor en elevaciones laterales que en el press militar ([revisión de EMG](https://pmc.ncbi.nlm.nih.gov/articles/PMC7706677)). No hay estudios de crecimiento que comparen press y elevaciones.

→ Press de hombros: **deltoides anterior principal, lateral ½, tríceps ½**. Deltoides anterior con **MEV 0** en las referencias, porque los empujes ya lo cubren.

### Abdomen y gemelos en los ejercicios básicos
- No se encontró ningún estudio que muestre **crecimiento** del abdomen con sentadillas o pesos muertos. Solo hay activación durante la serie ([estudio de deadlift y cinturón](https://pubmed.ncbi.nlm.nih.gov/27093137/)). El abdomen crece con ejercicios directos tipo crunch ([estudio con ecografía](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10824285/)).
- Tampoco hay datos de crecimiento del gemelo con sentadilla.

→ **No se cuentan** en los básicos, salvo un **¼** en la sentadilla frontal por la exigencia de mantener el tronco vertical. Es una estimación.

### Aductores, trapecio y antebrazo (músculos añadidos)
- **Aductores.** Con sentadilla completa crecieron casi como el glúteo (+6,2 % frente a +6,7 %, [Kubo 2019](https://link.springer.com/doi/10.1007/s00421-019-04181-y)). Crecieron más con sentadilla que con hip thrust ([Plotkin 2023](https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2023.1279170/full)), y el aductor mayor creció con prensa pero no con extensión de cuádriceps.
  → **¾** en sentadillas profundas (trasera, frontal, goblet) y en peso muerto sumo; **½** en prensa, hack, péndulo y zancadas; **¼** en peso muerto convencional y rumano (el aductor mayor también extiende la cadera). Ejercicios propios: aducción en máquina, polea o banda y plancha Copenhague.
- **Trapecio.** Antes estaba dentro de «Espalda». Ahora es principal en encogimientos y paseo del granjero, **½** en face pull, remo al mentón y tirones de halterofilia, y **¼** en remos, pájaros y pesos muertos (el trabajo isométrico del trapecio superior al sostener la barra). No hay estudios de crecimiento por ejercicio: es una estimación por biomecánica.
- **Antebrazo.** Principal en curl de muñeca, curl de muñeca inverso, curl inverso y colgarse de la barra; **½** en curl martillo (braquiorradial) y paseo del granjero; **¼** en pesos muertos y dominadas (agarre). También es una estimación.
- **Referencias de volumen:**
  - Trapecio: MV 0 · MEV 0 · MAV 12-20 · MRV 26, de la tabla de Israetel.
  - Antebrazo: MV 0 · MEV 2 · MAV 6-12 · MRV 20, **estimación**.
  - Aductores: MV 0 · MEV 0 · MAV 6-12 · MRV 18, **estimación**.

  Israetel no publica cifras propias para estos dos últimos o no se han podido verificar. Todas se pueden editar por atleta.

## 3. Cambios respecto a la versión anterior (todos los secundarios a ½)

| Ejercicio | Antes | Ahora |
|---|---|---|
| Sentadilla trasera | glúteo ½, espalda ½ | glúteo **¾**, espalda **¼** |
| Prensa | glúteo ½ | glúteo **¾** |
| Zancadas | glúteo ½, femoral ½ | glúteo **¾**, femoral **—** |
| Hip thrust | femoral ½ | femoral **—** |
| Peso muerto rumano | glúteo ½, espalda ½ | glúteo **¾**, espalda **¼** |
| Press inclinado | deltoides anterior ½ | deltoides anterior **¾** |
| Fondos | tríceps ½ | tríceps **¾** |
| Aperturas | deltoides anterior ½ | deltoides anterior **¼** |
| Curl femoral | gemelos ½ | gemelos **¼** |
| Dominadas | bíceps ½ | bíceps ½, deltoides posterior **¼** |
| Halterofilia | secundarios ½ | deltoides anterior y femoral **¼** |

Los ejercicios que habías personalizado conservan tus músculos. Los nuevos llegan con estos criterios.

## 4. Catálogo ampliado

154 ejercicios, cada uno con su **material** (barra, mancuernas, máquina, polea, peso corporal, kettlebell, bandas). Esto permite filtrar en el selector y montar entrenamientos de **gimnasio comercial** (máquinas guiadas, poleas, multipower, hack, péndulo, prensa, contractor…) o **doméstico** (peso corporal, mancuernas, kettlebell, bandas). Los 15 músculos tienen al menos 4 ejercicios como principal.

## 5. Limitaciones

- **Muestras pequeñas y casi siempre de principiantes.** En personas entrenadas, la contribución de los secundarios probablemente sea menor; el caso del bíceps en el jalón es el más dudoso.
- **La activación (EMG) no equivale a crecimiento.** Donde solo hay EMG, el valor es una estimación por biomecánica.
- **Quedan fuera** los erectores de la columna (siguen dentro de «Espalda») y los músculos profundos de la cadera.
- **Los valores son la mejor aproximación con los datos disponibles, no medidas exactas.** Cada entrenador puede ajustarlos por ejercicio.

## Referencias
- Pelland JC et al. (2024/2025). The Resistance Training Dose-Response: Meta-Regressions Exploring the Effects of Weekly Volume and Frequency on Muscle Hypertrophy and Strength Gain. *Sports Medicine*. [ResearchGate](https://www.researchgate.net/publication/384628335_The_Resistance_Training_Dose-Response_Meta-Regressions_Exploring_the_Effects_of_Weekly_Volume_and_Frequency_on_Muscle_Hypertrophy_and_Strength_Gain)
- Kubo K, Ikebukuro T, Yata H (2019). Effects of squat training with different depths on lower limb muscle volumes. *Eur J Appl Physiol*. [Springer](https://link.springer.com/doi/10.1007/s00421-019-04181-y)
- Plotkin DL et al. (2023). Hip thrust and back squat training elicit similar gluteus muscle hypertrophy and transfer similarly to the deadlift. *Front Physiol*. [Frontiers](https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2023.1279170/full)
- Mannarino P et al. (2021). Single-Joint Exercise Results in Higher Hypertrophy of Elbow Flexors Than Multijoint Exercise. *J Strength Cond Res*. [PDF](https://paulogentil.com/pdf/Single-Joint%20Exercise%20Results%20in%20Higher%20Hypertrophy%20of%20Elbow%20Flexors%20Than%20Multijoint%20Exercise.pdf)
- Gentil P et al. Estudios con jalón al pecho y curl de bíceps en principiantes (comparación directa y efecto de añadir curl al jalón). [Resumen en StrengthLog](https://www.strengthlog.com/are-rows-and-lat-pulldowns-enough-for-great-biceps-growth/)
- Maeo S et al. (2021). Greater Hamstrings Muscle Hypertrophy but Similar Damage Protection after Training at Long versus Short Muscle Lengths. *Med Sci Sports Exerc*. [PubMed](https://pubmed.ncbi.nlm.nih.gov/33009197/)
- Hamstrings Hypertrophy Is Specific to the Training Exercise: Nordic Hamstring versus Lengthened State Eccentric Training (2024). [PubMed](https://pubmed.ncbi.nlm.nih.gov/38857522/)
- Brandão L et al. (2020). Varying the Order of Combinations of Single- and Multi-Joint Exercises Differentially Affects Resistance Training Adaptations. *J Strength Cond Res*. [PubMed](https://pubmed.ncbi.nlm.nih.gov/32149887/)
- Time course for arm and chest muscle thickness changes following bench press training (24 semanas). [PubMed](https://pubmed.ncbi.nlm.nih.gov/24265879/)
- Activación del deltoides en ejercicios mono y multiarticulares. [PubMed](https://pubmed.ncbi.nlm.nih.gov/24947920/) · [PMC7706677](https://pmc.ncbi.nlm.nih.gov/articles/PMC7706677)
- Recuento de series indirectas en la práctica: [Stronger by Science](https://www.strongerbyscience.com/volume/), [Menno Henselmans](https://mennohenselmans.com/how-to-count-training-volume-design-training-split/).
