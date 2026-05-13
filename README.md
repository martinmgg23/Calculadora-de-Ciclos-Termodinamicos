# Cálculo de Ciclos Termodinámicos

> Herramienta web para el análisis de ciclos teóricos **Otto**, **Diesel** y **Sabathé** bajo la hipótesis de aire estándar frío, con dimensionamiento de motores alternativos según la misión definida.

![Stack](https://img.shields.io/badge/stack-HTML5%20%C2%B7%20JS%20vanilla-blue)
![Charts](https://img.shields.io/badge/charts-ApexCharts-ff7a00)
![Math](https://img.shields.io/badge/equations-KaTeX-00d4aa)
![License](https://img.shields.io/badge/license-MIT-lightgrey)
![Status](https://img.shields.io/badge/status-validated%20%C2%B1%200.5%25-success)

---

## 📋 Tabla de contenidos

- [Descripción](#descripción)
- [Características](#características)
- [Demo / Uso](#demo--uso)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Fundamento teórico](#fundamento-teórico)
- [Validación](#validación)
- [API del módulo de cálculo](#api-del-módulo-de-cálculo)
- [Limitaciones](#limitaciones)
- [Roadmap](#roadmap)
- [Licencia](#licencia)

---

## Descripción

Esta página permite el cálculo de ciclos teóricos termodinámicos Otto, Diesel y Sabathé, para automatizar el cálculo de performance y dimensionamiento de motores, según su misión previamente definida. Está pensada como herramienta de diseño preliminar en cátedras de motores y máquinas térmicas.

> ⚠️ **Utilizar con mesura a pesar de las alertas predefinidas del sistema.** Los modelos asumen aire estándar frío (k constante, gas ideal, combustión idealizada como aporte de calor). Los resultados son válidos para análisis comparativos y dimensionamientos preliminares, no para diseño final.

## Características

### Entradas

| Parámetro | Tipo | Rango / Opciones |
|---|---|---|
| Ciclo | Desplegable | Otto · Diesel · Sabathé |
| Altitud | Numérico + unidad | -500 a 20 000 m (o ft) |
| Constante k | Slider | 1.30 – 1.40 |
| Combustible | Desplegable | 8 combustibles predefinidos + CₙHₘ manual |
| Relación de mezcla λ | Numérico | 0.4 – 3.0 |
| Relación de compresión r | Numérico | 2 – 30 |
| Cilindros | Numérico | 1 – 24 |
| Potencia | Numérico + unidad | HP · cv · kW |
| Régimen | Numérico | 500 – 20 000 rpm |
| Tiempos | Desplegable | 2T · 4T |
| Q a V=cte (Sabathé) | Numérico | kJ/kg de aire |
| Relación S/D | Slider | 0.5 – 1.5 |

### Salidas

Organizadas en tres pestañas:

1. **Resultados** — KPIs (η, PME, w_neto, q_in, q_out, T_max, P_max, AFR), tabla de los 4/5 estados termodinámicos (T, p, v), y dimensionamiento del motor (cilindrada total y unitaria, diámetro D y carrera S del pistón) con visualización gráfica del pistón en función de S/D.
2. **Gráficos P-v / T-s** — Diagramas comparativos de los tres ciclos sobre los mismos ejes. El ciclo seleccionado se dibuja en trazo grueso continuo con los estados numerados; los otros dos en línea punteada para referencia visual. Implementados con **ApexCharts** (zoom XY, tooltip oscuro).
3. **Ecuaciones** — Todas las fórmulas utilizadas renderizadas con **KaTeX**: atmósfera ISA, propiedades del aire, combustión, ciclos Otto/Diesel/Sabathé, trabajo, PME y dimensionamiento.

### Alertas

Aparece un aviso en rojo cuando:
- **P_max > 100 bar** — sugiere revisar entradas para evitar diseños inviables.
- **T_max > 4800 K** — supera los límites razonables del modelo de aire estándar.

### UX

- **Recálculo en vivo**: cualquier cambio en una entrada actualiza KPIs, tabla, gráficos y dimensionamiento sin necesidad de presionar un botón.
- **Sliders interactivos**: k y S/D recalculan mientras se arrastra.
- **Hint atmosférico**: bajo el campo de altitud se muestran T₁ y p₁ ISA en vivo.
- **Estética técnica**: panel de instrumentos oscuro con tipografía monoespaciada para los valores numéricos.

---

## Demo / Uso

### Online
Abrir [`index.html`](./index.html) en cualquier navegador moderno. Requiere conexión a internet la primera vez (cargas desde CDN: ApexCharts, KaTeX, Google Fonts).

### Local
```bash
git clone https://github.com/<usuario>/<repo>.git
cd <repo>
# Servir con cualquier servidor estático
python3 -m http.server 8000
# Luego abrir http://localhost:8000
```

O simplemente hacer doble clic sobre `index.html` (funciona desde `file://`).

### Caso de uso típico
1. Seleccionar **Otto** y altitud **0 m**.
2. Combustible **Nafta (C₈H₁₈)**, λ = 1.0, r = 10.
3. Motor: 4 cilindros, 100 HP a 5000 rpm.
4. Observar η ≈ 60%, PME ≈ 14 bar, cilindrada total ≈ 1.4 L.
5. Cambiar a **Diesel** con r = 18 y comparar gráficos P-v.

---

## Estructura del repositorio

```
.
├── index.html              # Aplicación completa (UI + lógica + estilos)
├── thermo-cycles.js        # Módulo de cálculo standalone (Node.js / browser)
├── test-validacion.js      # Test de validación contra caso de referencia
├── README.md
├── PROMPTS.md              # Bitácora de desarrollo asistido por IA
└── LICENSE
```

> Nota: `index.html` es **autocontenido** — incluye el módulo de cálculo embebido, los estilos y el wiring de eventos. Se distribuye también `thermo-cycles.js` como módulo reutilizable para integraciones (Node, bundlers o uso programático en el navegador).

---

## Fundamento teórico

### Hipótesis del aire estándar frío
- El fluido de trabajo es aire que se comporta como gas ideal: $pv = RT$ con $R = 287.058 \; \text{J/(kg·K)}$.
- Los calores específicos $c_p$, $c_v$ son **constantes**: $c_v = R/(k-1)$, $c_p = k \cdot c_v$.
- La combustión se modela como **aporte de calor** a volumen y/o presión constante.
- El escape se modela como rechazo de calor a volumen constante.
- Compresión y expansión son procesos **isoentrópicos** (adiabáticos reversibles).

### Atmósfera Estándar Internacional (ISA)

Se modelan troposfera (0–11 km) y baja estratosfera (11–20 km):

$$T(h) = T_0 - L \cdot h, \quad p(h) = p_0 \left( \frac{T(h)}{T_0} \right)^{g_0 / (RL)}$$

con $T_0 = 288.15$ K, $p_0 = 101325$ Pa, $L = 0.0065$ K/m, $g_0 = 9.80665$ m/s².

### Combustión

Para un hidrocarburo CₙHₘ:

$$\text{C}_n\text{H}_m + \left(n + \tfrac{m}{4}\right)\text{O}_2 \rightarrow n\,\text{CO}_2 + \tfrac{m}{2}\,\text{H}_2\text{O}$$

$$AFR_{est} = \frac{(n + m/4)(1+3{,}76)\;M_{aire}}{M_{comb}}, \quad q_{in} = \frac{PCI}{\lambda \cdot AFR_{est}}$$

Convención: λ es la **riqueza inversa** (λ > 1 = mezcla pobre, λ < 1 = mezcla rica).

### Rendimientos térmicos ideales

| Ciclo | Rendimiento |
|---|---|
| Otto | $\eta = 1 - r^{-(k-1)}$ |
| Diesel | $\eta = 1 - r^{-(k-1)} \cdot \dfrac{r_c^{\,k}-1}{k(r_c-1)}$ |
| Sabathé | $\eta = 1 - r^{-(k-1)} \cdot \dfrac{\alpha r_c^{\,k}-1}{(\alpha-1)+k\alpha(r_c-1)}$ |

donde $r_c = v_3/v_2$ (relación de corte) y $\alpha = p_3/p_2$ (relación de presiones a V=cte).

### Dimensionamiento

Para un motor de 4 tiempos:

$$V_{total} = \frac{P}{PME \cdot \dfrac{rpm}{120}}, \quad V_{unit} = \frac{V_{total}}{n_{cil}} = \frac{\pi}{4} D^2 S$$

Conocida la relación $S/D$, se despeja $D = \sqrt[3]{4 V_{unit} / (\pi \cdot S/D)}$ y $S = (S/D) \cdot D$.

---

## Validación

Se ejecutó un test de regresión contra un caso de referencia con resultados conocidos:

**Entradas**: Otto · 8000 ft · heptano (C₇H₁₆) · r=6.3 · λ=1.1 · k=1.4 · 2900 rpm · 9 cilindros.

| Magnitud | Calculado | Referencia | Error |
|---|---|---|---|
| **η** | 0.521079 | 0.521079 | **0.000 %** |
| Estado 1 (p / T / v) | 75.26 kPa / 272.30 K / 1.0386 | 75.26 / 272.30 / 1.0386 | < 0.003 % |
| Estado 2 (p / T / v) | 990.05 kPa / 568.57 K / 0.16485 | 990.04 / 568.57 / 0.16485 | < 0.002 % |
| Estado 3 (p / T / v) | 7475.7 kPa / 4293.2 K / 0.16485 | 7487.6 / 4300.0 / 0.16485 | ≤ 0.16 % |
| Estado 4 (p / T / v) | 568.29 kPa / 2056.1 K / 1.0386 | 569.20 / 2059.4 / 1.0386 | ≤ 0.16 % |
| Q_in | 2672.9 kJ/kg | 2677.8 kJ/kg | 0.18 % |
| W_net | 1392.8 kJ/kg | 1395.3 kJ/kg | 0.18 % |
| T_max | 4293.2 K | 4300.0 K | 0.16 % |
| P_max | 74.76 bar | 74.88 bar | 0.16 % |
| PME | 15.94 bar | 15.97 bar | 0.18 % |

✓ **Todos los parámetros dentro del 0.5% de tolerancia.** Reproducible mediante:

```bash
node test-validacion.js
```

---

## API del módulo de cálculo

`thermo-cycles.js` expone un módulo reutilizable. En navegador queda disponible como `window.ThermoCycles`; en Node se importa con `require`.

```javascript
const TC = require('./thermo-cycles.js');

const result = TC.computeCycle({
    cycle:        'otto',        // 'otto' | 'diesel' | 'sabathe'
    altitude:     8000,
    altitudeUnit: 'ft',          // 'm' | 'ft'
    k:            1.4,
    fuel:         'gasoline',    // clave de FUELS o { nC, nH, nO?, PCI }
    lambda:       1.0,
    r:            10,
    nCyl:         4,
    power:        100,
    powerUnit:    'HP',          // 'HP' | 'cv' | 'kW' | 'W'
    rpm:          5000,
    strokes:      4,             // 2 | 4
    S_over_D:     1.0,
    qV:           800e3          // solo Sabathé, J/kg de aire
});

console.log(result.active.eta);          // rendimiento del ciclo activo
console.log(result.active.states);       // [{id, T, p, v}, ...]
console.log(result.cycles.otto);         // los tres ciclos siempre calculados
console.log(result.sizing.D_mm);         // dimensionamiento del pistón
console.log(result.alerts);              // alertas si pmax o Tmax exceden umbrales
```

### Funciones de bajo nivel
- `isaAtmosphere(h_m)` — ISA hasta 20 km
- `airProperties(k)` — cv, cp, R
- `stoichiometricAFR(fuel)` — AFR estequiométrico
- `ottoCycle / dieselCycle / sabatheCycle` — resolución directa de un ciclo
- `engineSizing(...)` — dimensionamiento
- `buildPvTsCurves(...)` — series de puntos para gráficos P-v y T-s

---

## Limitaciones

- **Aire estándar frío**: la asunción de k constante introduce errores crecientes con la temperatura (en realidad k disminuye con T).
- **Combustión idealizada**: se modela como aporte de calor; no se consideran disociación, especies reales ni cinética química.
- **Sin pérdidas**: no se incluyen pérdidas mecánicas, de bombeo, calor por las paredes ni dinámica de gases. El rendimiento calculado es el **ideal teórico**, siempre superior al real.
- **PCI fijo por combustible**: no se ajusta por temperatura ni presencia de azufre/aromáticos.
- **Modelo ISA simplificado**: solo troposfera y baja estratosfera (válido hasta 20 km). No incluye estratopausa, mesosfera ni efectos no estándar (atmósfera caliente/fría, día tropical, etc.).

---

## Roadmap

- [ ] Exportar resultados a CSV / PDF
- [ ] Modo "aire estándar caliente" con k(T) variable
- [ ] Atmósferas no estándar (ICAO Hot Day, Cold Day, Tropical)
- [ ] Inclusión de pérdidas mecánicas (η_mec) y rendimiento volumétrico
- [ ] Comparación lado-a-lado de configuraciones
- [ ] Internacionalización (EN/PT)

---

## Licencia

Distribuido bajo licencia MIT. Ver [`LICENSE`](./LICENSE) para más información.

---

<p align="center">
<sub>Construido con HTML5, JavaScript vanilla, ApexCharts y KaTeX.<br>
Sin frameworks, sin dependencias pesadas, sin build step.</sub>
</p>
