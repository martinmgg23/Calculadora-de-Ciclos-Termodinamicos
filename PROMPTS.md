# Bitácora de Prompts

Este documento registra la secuencia de prompts utilizados durante el desarrollo asistido por **Claude (Anthropic)** del módulo de cálculo de ciclos termodinámicos. Se incluyen los prompts originales (en español), la intención de cada uno, y un resumen de los entregables obtenidos en cada etapa.

El propósito de mantener esta bitácora es:
1. **Trazabilidad** — documentar las decisiones de diseño y validación.
2. **Reproducibilidad** — permitir reconstruir el proyecto desde cero.
3. **Aprendizaje** — mostrar el estilo de prompting que funcionó para una herramienta de ingeniería técnica.

---

## Modelo utilizado

- **Modelo**: Claude (Sonnet / Opus, según disponibilidad).
- **Modalidad**: Chat con herramientas (Code Execution + File Creation habilitados).
- **Idioma**: Español (Argentina).

---

## Estructura del desarrollo

El proyecto se construyó en **cinco etapas iterativas**, cada una con un prompt acotado y un entregable verificable:

1. **Especificación del módulo de cálculo**
2. **Validación numérica contra caso de referencia**
3. **Construcción de la interfaz HTML**
4. **Documentación del repositorio**
5. **Endurecimiento del manejo de entradas degeneradas**

---

## Prompt 1 — Especificación funcional y módulo de cálculo

### Prompt original

> Necesito implementar en HTML puro un módulo que calcule los estados de un ciclo Otto, Diesel o Sabathé ideal de aire estándar frío.
>
> **Título**: Cálculo de Ciclos Termodinámicos.
>
> **Subtítulo**: Esta página permite el cálculo de ciclos teóricos termodinámicos Otto, Diesel y Sabathé, para automatizar el cálculo de performance y dimensionamiento de motores, según su misión previamente definida. Utilizar con mesura a pesar de las alertas predefinidas del sistema.
>
> **Entradas**:
> - Ciclo: Desplegable, como opciones, Otto, Diesel o Sabathé
> - Altitud: se ingresa de forma numérica, y la unidad de medida se podrá seleccionar en un cuadro desplegable con opciones en m o ft. Con esto se calcularán las condiciones de atmósfera estándar
> - Constante k: se definirá con un slider entre 1,3 y 1,4
> - Tipo de combustible: de una lista desplegable se ofrecerán las opciones más comunes de combustibles, y una opción para ingresar manualmente configuración del hidrocarburo, donde aparecerán dos nuevas opciones para ingresar cantidad de C e H
> - Relación de mezcla: de formato numérico, se ingresará la relación de mezcla relativa λ
> - Parámetros del motor: de forma numérica; Relación de compresión, cantidad de cilindros, Potencia requerida (con opción desplegable de HP o cv) y las rpm a la que es deseada. En caso de ciclo Sabathé se incluirá una opción de cantidad de calor aportado a volumen constante
>
> **Salidas**:
> En distintas pestañas se obtendrán los resultados, Gráficos Pv y Ts, y las ecuaciones utilizadas.
> - **Resultados**: Se indican los 4/5 estados termodinámicos, presión, temperatura y volumen específico. Calor ingresado, rechazado y trabajo neto, Temperaturas y presiones máximas, presión media efectiva.
> - **Dimensionamiento del motor**: cilindrada total, unitaria y la carrera y diámetro del pistón que serán calculadas ante la modificación de un slider que indique la relación entre ellos (entre 0.5 y 1.5)
> - **Gráficos Pv y Ts**: Comparación de los gráficos de Pv y Ts de los tres ciclos: Otto, Diesel y Sabathé. El ciclo seleccionado es de trazo grueso y los otros dos de líneas punteadas, debe indicar los 4/5 estados termodinámicos.
> - **Ecuaciones Utilizadas**: Se mostrarán las ecuaciones utilizadas para el cálculo de los parámetros termodinámicos, las condiciones de atmósfera estándar, constantes utilizadas y las unidades de medida con las que se trabajó.
>
> **Avisos de Alerta**: En caso de que los valores de presión y temperatura máximos superen los 100 bar o 4800K, aparecerá un aviso indicándolo y sugiriendo controlar los valores de las entradas.
>
> **Implementa el módulo de cálculo termodinámico (sin interfaz).**

### Intención

Separar **lógica** de **presentación**. Primero asegurar que las ecuaciones termodinámicas, conversiones de unidades, atmósfera ISA y combustión estequiométrica estén correctamente implementadas antes de invertir tiempo en HTML/CSS.

### Entregable

- `thermo-cycles.js` — Módulo standalone con:
  - Constantes físicas (R aire, g₀, T₀ ISA, etc.)
  - Biblioteca de 8 combustibles + custom
  - `isaAtmosphere(h)` — modelo troposfera + estratosfera baja (0–20 km)
  - `airProperties(k)` — cv, cp, R
  - `stoichiometricAFR(fuel)` — AFR a partir de CₙHₘOₚ
  - `ottoCycle`, `dieselCycle`, `sabatheCycle` — resolución de 4/5 estados
  - `engineSizing` — cilindrada, D, S
  - `buildPvTsCurves` — series de puntos para gráficos
  - `computeCycle(input)` — función maestra
  - `checkAlerts` — verificación de p_max > 100 bar y T_max > 4800 K
- Tests internos verificando valores de referencia (ISA, AFR de combustibles conocidos, η_Otto teórico).

### Decisiones de diseño tomadas

- **Unidades internas en SI** (Pa, K, m³/kg, J/kg). La conversión a unidades de display (bar, kJ/kg) se hace solo en la capa de presentación.
- **Convención de λ**: λ > 1 = mezcla pobre (`AFR_real = λ · AFR_st`).
- **Sabathé**: se solicita explícitamente Q a V=cte; si no se da, se reparte 50/50.
- **Aire estándar frío estricto**: k constante seleccionable por el usuario.

---

## Prompt 2 — Validación numérica

### Prompt original

> *(Adjunta imagen con tabla de valores de referencia)*
>
> Genera un test de validación con el siguiente caso de referencia:
> - Altitud 8000 ft
> - Ciclo Otto
> - Combustible heptano
> - Relación de compresión 6.3
> - Relación de mezcla 1.1
> - Régimen 2900 rpm
> - 9 cilindros
> - K = 1.4
>
> Como resultado debe dar los valores indicados en el siguiente recuadro. **Indicar si el cálculo coincide dentro del 0.5% de tolerancia.**

### Intención

Validar el módulo contra un caso conocido **antes** de construir la interfaz. Esto sirvió para:
1. Detectar inconsistencias en la convención de λ usada por la referencia (que resultó ser la misma del módulo).
2. Identificar fuentes de pequeñas discrepancias (PCI exacto del heptano, masas molares IUPAC vs aproximadas).
3. Generar un test de regresión reutilizable para futuras modificaciones.

### Entregable

- `test-validacion.js` — Script que ejecuta el caso, compara cada magnitud contra la referencia, calcula el error relativo y emite un veredicto.
- **Resultado**: ✓ Todos los parámetros dentro del 0.5%. El rendimiento η coincide al 6° decimal (0.521079) por ser función pura de r y k. Las diferencias restantes (~0.16 %) provienen del PCI del heptano (44.5 vs ~44.62 MJ/kg) y pesan atómicos IUPAC vs enteros.

### Observación importante

Al inspeccionar la imagen, se notó que la referencia reportaba **F = fuel/aire** (la inversa de AFR). El prompt fue claro respecto a "coincidir dentro del 0.5%", lo que permitió mantener la convención original del módulo (AFR) y solo convertir en el reporte del test (F = 1/AFR).

---

## Prompt 3 — Interfaz gráfica

### Prompt original

> **Genera la interfaz en HTML con la interface gráfica ApexChart o similar.**

### Intención

Prompt corto pero con dos restricciones claras:
1. **HTML puro** (sin frameworks, sin build step).
2. **ApexCharts** como librería de gráficos (o equivalente).

Toda la especificación funcional (entradas, pestañas, alertas, dimensionamiento, gráficos comparativos) ya estaba fijada por el Prompt 1.

### Entregable

- `index.html` — Aplicación completa autocontenida (~950 líneas):
  - **Layout**: grid de 2 columnas (panel de entrada 380px + área de resultados).
  - **Tipografía**: JetBrains Mono (valores numéricos) + Space Grotesk (UI).
  - **Estética**: panel de instrumentos oscuro, acentos en naranja (#ff7a00 para Otto / cilindro encendido), azul (#4d9bff para Diesel / compresión) y turquesa (#00d4aa para Sabathé / rechazo).
  - **Pestañas**: Resultados · Gráficos P-v/T-s · Ecuaciones.
  - **ApexCharts** con zoom XY, tooltip oscuro, ciclos no seleccionados en línea punteada, marcadores numerados sobre los estados del ciclo activo.
  - **KaTeX** para las ecuaciones (mejor renderizado que MathJax en mobile).
  - **Recálculo en vivo** ante cualquier cambio (no requiere botón).
  - **Visualización del pistón** que se mueve verticalmente según S/D.

### Decisiones de diseño tomadas

- **Sin frameworks** (React/Vue) para minimizar superficie y peso.
- **Lógica de cálculo embebida** en el HTML (no se carga `thermo-cycles.js` externo) para que `index.html` funcione desde `file://` sin servidor.
- **Recálculo automático** en lugar de "presionar Calcular" — más cercano a una herramienta de diseño interactiva.
- **Validación de regresión**: la lógica embebida se compara contra el módulo standalone para asegurar que ambas implementaciones produzcan idénticos resultados.

---

## Prompt 4 — Documentación

### Prompt original

> **Generar README.md, PROMPTS.md para un repositorio en GitHub.**

### Intención

Producir documentación profesional, lista para publicar:
- **README** orientado a usuarios y posibles colaboradores: qué hace, cómo se usa, cómo se valida, qué limitaciones tiene.
- **PROMPTS** orientado a trazabilidad académica y reproducibilidad: la secuencia exacta de instrucciones que llevó al estado actual del repositorio.

### Entregable

- `README.md` — Con badges, tabla de contenidos, sección de validación con los números exactos, fundamento teórico con ecuaciones, API del módulo, limitaciones y roadmap.
- `PROMPTS.md` — Este documento.

---

## Prompt 5 — Endurecimiento del manejo de entradas degeneradas

### Prompt original

> **Agregar alarmas para los casos en los que la relación de compresión es 1 y el calor ingresado sea 0.**

### Intención

Cubrir dos casos de uso problemáticos detectados durante el uso real de la herramienta:

1. **r = 1**: el usuario podría tipear este valor por curiosidad o error. Matemáticamente, $\eta_{Otto} = 1 - r^{-(k-1)} = 0$, todos los estados coinciden, w_neto = 0 y la PME = 0 → división por cero en el dimensionamiento del motor.

2. **q_in = 0**: ocurre si se ingresa PCI = 0 en un combustible custom, o si λ se hace muy grande. Sin aporte de calor el ciclo se degenera (T₃ = T₂) → w_neto = 0 → división por cero en el dimensionamiento.

Sin estas alertas, el sistema mostraba valores `NaN` / `Infinity` o gráficos vacíos sin explicación.

### Decisiones de diseño tomadas

- **Dos niveles de alerta** (`error` vs `warning`) en lugar de uno solo. Errores bloquean el cálculo y vacían los paneles; warnings dejan ver el resultado.
- **Pre-validación en `computeCycle`**: detectar `r ≤ 1` y `qIn ≤ 0` **antes** de invocar `ottoCycle`/`dieselCycle`/`sabatheCycle`, devolviendo un objeto con `degenerate: true`.
- **Generalización a r < 1**: la condición es `r ≤ 1` y no `r === 1` exacto, porque r < 1 es físicamente absurdo (expansión en lugar de compresión).
- **Mensajes pedagógicos**: cada alerta explica *por qué* el cálculo se aborta, en lugar de un mensaje genérico tipo "entrada inválida".
- **Distinción visual en UI**: errores en rojo intenso con icono ⛔, warnings en rojo apagado con icono ⚠.
- **Permitir tipear r < 2**: el atributo `min` del input se bajó de 2 a 0.5 para que el usuario pueda *escribir* el caso degenerado y ver la alerta, en lugar de que el navegador la rechace silenciosamente.

### Entregable

- `thermo-cycles.js`:
  - `checkAlerts(result, ctx)` ahora acepta contexto opcional `{ r, qIn }` y devuelve alertas con `level: 'error' | 'warning'` y `field` identificable.
  - `computeCycle` realiza pre-validación y retorna `{ degenerate: true, alerts: [...] }` sin invocar los cálculos de ciclo.
- `index.html`:
  - `compute()` replica la pre-validación.
  - `renderAlerts` distingue estilos error vs warning.
  - `renderEmpty()` limpia KPIs, tabla, dimensionamiento y gráficos cuando hay degeneración.
  - `run()` invoca `renderEmpty()` y retorna temprano si `R.degenerate`.
- `test-validacion.js`:
  - Nueva suite "VALIDACIÓN DE ALERTAS" con 4 casos: `r=1`, `r=0.5`, `PCI=0`, caso normal.
  - Veredicto final exige que pase el test de referencia **y** todos los casos de alerta.

### No-regresión

El caso de referencia (Otto, 8000 ft, heptano, r=6.3, λ=1.1) sigue dando η = 0.521079 con error 0.00%. Confirmado por ejecución del test final.

---



## Patrones de prompting que funcionaron

Algunas observaciones útiles para futuros desarrollos asistidos por IA:

### ✅ Prompts efectivos

- **Especificación en bloque + restricción de alcance**: el Prompt 1 listó todas las funcionalidades necesarias pero pidió implementar **solo la lógica**. Esto evitó código innecesario en la primera iteración y permitió validar antes de presentar.
- **Validación con datos exactos**: el Prompt 2 incluyó una tabla de referencia con todos los valores esperados. Esto convierte una pregunta abierta ("¿está bien?") en un test booleano ("¿está dentro del 0.5%?").
- **Prompts cortos cuando el contexto ya está fijado**: el Prompt 3 fue una línea ("genera la interfaz con ApexCharts") porque toda la especificación funcional ya estaba en el historial de la conversación.

### ⚠️ Cuidados

- **Convenciones de λ**: existen dos convenciones (riqueza vs riqueza inversa). El módulo asumió una, la referencia usaba otra notación (F = fuel/aire) pero la misma convención de fondo. Siempre conviene aclarar la convención de mezcla explícitamente.
- **PCI de combustibles**: no es una constante universal — varía 1-2% entre fuentes. Si se requiere coincidencia exacta con una referencia, hay que sincronizar este valor primero.
- **Aire estándar frío vs caliente**: el modelo es estrictamente con k constante. Para análisis de mayor precisión hay que migrar a k(T), lo que cambia la estructura del cálculo (los estados ya no salen de fórmulas cerradas).
- **Casos degenerados (Prompt 5)**: pedir alertas explícitas para casos físicamente nulos (r=1, q_in=0) resultó más útil que dejar que el cálculo arroje `NaN`. Conviene anticipar estas alarmas desde el diseño inicial.
- **Reproducibilidad de paths**: usar `require('/home/claude/...')` con rutas absolutas del entorno de desarrollo rompe en GitHub. Usar siempre rutas relativas (`./thermo-cycles.js`) para tests que se publican.

---

## Reproducibilidad

Para reconstruir el proyecto desde cero ante un modelo similar:

```
1. [Prompt 1 + adjunto opcional con especificación funcional]
   → thermo-cycles.js

2. [Prompt 2 + tabla de valores de referencia]
   → test-validacion.js  (debe pasar con tolerancia < 0.5%)

3. [Prompt 3]
   → index.html

4. [Prompt 4]
   → README.md + PROMPTS.md

5. [Prompt 5]
   → checkAlerts robustecido + casos degenerados cubiertos en el test
```

Cada paso es **idempotente** y **verificable**: si el test de validación falla, el problema está en `thermo-cycles.js` y no se debe avanzar a la interfaz. Tras el paso 5, el test verifica tanto el caso de referencia (±0.5 %) como las cuatro alertas críticas.

---

## Créditos

- **Modelo**: Claude (Anthropic).
- **Bibliotecas embebidas**: [ApexCharts](https://apexcharts.com/), [KaTeX](https://katex.org/), Google Fonts (JetBrains Mono, Space Grotesk).
- **Validación de referencia**: caso académico de ciclo Otto a 8000 ft con combustible heptano.

---

<p align="center">
<sub>Bitácora elaborada con fines de trazabilidad académica.<br>
Última actualización: mayo de 2026.</sub>
</p>
