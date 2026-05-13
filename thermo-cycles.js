/**
 * ============================================================================
 *  MÓDULO DE CÁLCULO DE CICLOS TERMODINÁMICOS
 *  Ciclos ideales de aire estándar frío: Otto, Diesel y Sabathé
 * ============================================================================
 *
 *  Hipótesis del aire estándar frío:
 *    - El fluido de trabajo es aire que se comporta como gas ideal.
 *    - Los calores específicos (cp, cv) son constantes (k = cp/cv = cte).
 *    - Los procesos de combustión se modelan como aporte de calor a V=cte
 *      y/o P=cte. El escape se modela como rechazo de calor a V=cte.
 *    - Compresión y expansión son isoentrópicas (adiabáticas reversibles).
 *
 *  Estados:
 *    Otto:    1 -> 2 (compresión isoentrópica)
 *             2 -> 3 (aporte de calor a V=cte)
 *             3 -> 4 (expansión isoentrópica)
 *             4 -> 1 (rechazo de calor a V=cte)
 *
 *    Diesel:  1 -> 2 (compresión isoentrópica)
 *             2 -> 3 (aporte de calor a P=cte)
 *             3 -> 4 (expansión isoentrópica)
 *             4 -> 1 (rechazo de calor a V=cte)
 *
 *    Sabathé: 1 -> 2 (compresión isoentrópica)
 *             2 -> 3 (aporte de calor a V=cte)  ← Qv definido por el usuario
 *             3 -> 4 (aporte de calor a P=cte)
 *             4 -> 5 (expansión isoentrópica)
 *             5 -> 1 (rechazo de calor a V=cte)
 * ============================================================================
 */

'use strict';

/* ============================================================================
 *  CONSTANTES FÍSICAS
 * ============================================================================
 */
const CONST = Object.freeze({
    R_UNIVERSAL: 8.31446,        // J/(mol·K)
    R_AIR:       287.058,        // J/(kg·K) - constante específica del aire
    M_AIR:       28.9647e-3,     // kg/mol - masa molar del aire
    G0:          9.80665,        // m/s²
    T0_ISA:      288.15,         // K - temperatura al nivel del mar
    P0_ISA:      101325,         // Pa - presión al nivel del mar
    LAPSE_RATE:  0.0065,         // K/m - gradiente térmico troposférico
    H_TROPO:     11000,          // m - altura de la tropopausa
    T_TROPO:     216.65,         // K - temperatura en la tropopausa
    P_TROPO:     22632.06,       // Pa - presión en la tropopausa
    H_STRATO2:   20000,          // m - límite superior modelado
    M_TO_FT:     3.28084,
    FT_TO_M:     0.3048,
    HP_TO_W:     745.6998715823,
    CV_TO_W:     735.49875,
    BAR_TO_PA:   1e5,
    PA_TO_BAR:   1e-5,
    // Umbrales de alerta
    PMAX_ALERT_BAR: 100,
    TMAX_ALERT_K:   4800
});

/* ============================================================================
 *  BIBLIOTECA DE COMBUSTIBLES
 *  Cada combustible se caracteriza por:
 *    - nC, nH: átomos de carbono e hidrógeno en la fórmula CnHm
 *    - PCI:    poder calorífico inferior [J/kg]
 *    - rho:    densidad [kg/m³] (referencia)
 *  La relación estequiométrica aire/combustible se calcula a partir de
 *  la fórmula molecular asumiendo combustión completa.
 * ============================================================================
 */
const FUELS = Object.freeze({
    gasoline:   { name: 'Nafta (C8H18 - iso-octano)', nC: 8,  nH: 18, PCI: 44.0e6, rho: 745 },
    diesel:     { name: 'Gasoil (C12H23)',            nC: 12, nH: 23, PCI: 42.5e6, rho: 832 },
    methane:    { name: 'Metano / GNC (CH4)',         nC: 1,  nH: 4,  PCI: 50.0e6, rho: 0.717 },
    propane:    { name: 'Propano / GLP (C3H8)',       nC: 3,  nH: 8,  PCI: 46.4e6, rho: 1.882 },
    butane:     { name: 'Butano (C4H10)',             nC: 4,  nH: 10, PCI: 45.7e6, rho: 2.489 },
    ethanol:    { name: 'Etanol (C2H6O)',             nC: 2,  nH: 6,  nO: 1, PCI: 26.8e6, rho: 789 },
    kerosene:   { name: 'Kerosén / Jet-A1 (C12H26)',  nC: 12, nH: 26, PCI: 43.0e6, rho: 800 },
    hydrogen:   { name: 'Hidrógeno (H2)',             nC: 0,  nH: 2,  PCI: 120.0e6, rho: 0.0899 }
});

/* ============================================================================
 *  ATMÓSFERA ESTÁNDAR INTERNACIONAL (ISA)
 *  Modela troposfera (0–11 km) y baja estratosfera (11–20 km).
 *  Entrada: altitud en metros (convertir antes si viene en pies).
 *  Salida:  { T [K], p [Pa], rho [kg/m³], a [m/s] }
 * ============================================================================
 */
function isaAtmosphere(altitude_m) {
    if (!Number.isFinite(altitude_m)) {
        throw new Error('Altitud inválida');
    }
    if (altitude_m < -500 || altitude_m > CONST.H_STRATO2) {
        throw new RangeError(
            `Altitud fuera del rango modelado (-500 m a ${CONST.H_STRATO2} m)`
        );
    }

    let T, p;
    if (altitude_m <= CONST.H_TROPO) {
        // Troposfera: variación lineal de T
        T = CONST.T0_ISA - CONST.LAPSE_RATE * altitude_m;
        const exponent = CONST.G0 / (CONST.R_AIR * CONST.LAPSE_RATE);
        p = CONST.P0_ISA * Math.pow(T / CONST.T0_ISA, exponent);
    } else {
        // Estratosfera baja (11–20 km): T constante
        T = CONST.T_TROPO;
        const exponent = -CONST.G0 * (altitude_m - CONST.H_TROPO) /
                         (CONST.R_AIR * CONST.T_TROPO);
        p = CONST.P_TROPO * Math.exp(exponent);
    }
    const rho = p / (CONST.R_AIR * T);
    const a   = Math.sqrt(1.4 * CONST.R_AIR * T); // velocidad del sonido
    return { T, p, rho, a, altitude: altitude_m };
}

/* ============================================================================
 *  PROPIEDADES DEL AIRE A PARTIR DE k
 *  Para aire estándar frío con k constante, R = 287.058 J/(kg·K) fijo.
 *  cv = R/(k-1); cp = k·cv
 * ============================================================================
 */
function airProperties(k) {
    if (!Number.isFinite(k) || k <= 1) {
        throw new Error('k debe ser un número mayor que 1');
    }
    const cv = CONST.R_AIR / (k - 1);
    const cp = k * cv;
    return { R: CONST.R_AIR, k, cv, cp };
}

/* ============================================================================
 *  RELACIÓN AIRE/COMBUSTIBLE ESTEQUIOMÉTRICA
 *  Combustión: CnHmOp + (n + m/4 - p/2) O2 -> n CO2 + (m/2) H2O
 *  Aire: 1 mol O2 viene con 3.76 mol N2  (aproximación 21/79)
 *  AFR_estq = (moles_aire · M_aire) / (1 mol comb · M_comb)
 * ============================================================================
 */
function stoichiometricAFR(fuel) {
    const nC = fuel.nC || 0;
    const nH = fuel.nH || 0;
    const nO = fuel.nO || 0;

    // O2 requerido (mol por mol de combustible)
    const nO2 = nC + nH / 4 - nO / 2;
    if (nO2 <= 0) {
        throw new Error('Combustible no admite combustión con O2');
    }
    // Aire requerido: O2 + 3.76·N2
    const nAir = nO2 * (1 + 3.76);

    // Masas molares [kg/mol]
    const M_C = 12.011e-3, M_H = 1.008e-3, M_O = 15.999e-3;
    const M_fuel = nC * M_C + nH * M_H + nO * M_O;

    return (nAir * CONST.M_AIR) / M_fuel;
}

/* ============================================================================
 *  CALOR ESPECÍFICO APORTADO POR LA COMBUSTIÓN [J/kg de mezcla]
 *  Considera que 1 kg de aire admite (1/AFR_real) kg de combustible.
 *  AFR_real = AFR_estq · λ        (λ = lambda relativo)
 *  q_in = PCI / AFR_real          [J por kg de aire]
 *  λ > 1: mezcla pobre   λ < 1: mezcla rica   λ = 1: estequiométrica
 * ============================================================================
 */
function heatInputPerKgAir(fuel, lambda) {
    if (!Number.isFinite(lambda) || lambda <= 0) {
        throw new Error('Lambda (λ) debe ser positivo');
    }
    const AFR_st   = stoichiometricAFR(fuel);
    const AFR_real = AFR_st * lambda;
    const qIn      = fuel.PCI / AFR_real;
    return { qIn, AFR_st, AFR_real };
}

/* ============================================================================
 *  CICLO OTTO (aire estándar frío)
 *  Entradas:  state1 {T, p}, r (rel. de compresión), qIn [J/kg], air {k, cv, cp, R}
 *  Salidas:   estados 1..4 con T, p, v ; q_in, q_out, w_net ; η ; PME
 * ============================================================================
 */
function ottoCycle(state1, r, qIn, air) {
    if (!Number.isFinite(r) || r <= 1) throw new Error('Relación de compresión > 1');

    const { k, cv, R } = air;
    const T1 = state1.T, p1 = state1.p;
    const v1 = R * T1 / p1;

    // 1 -> 2: compresión isoentrópica
    const v2 = v1 / r;
    const T2 = T1 * Math.pow(r, k - 1);
    const p2 = p1 * Math.pow(r, k);

    // 2 -> 3: aporte de calor a V=cte
    const v3 = v2;
    const T3 = T2 + qIn / cv;
    const p3 = p2 * (T3 / T2);

    // 3 -> 4: expansión isoentrópica hasta v4 = v1
    const v4 = v1;
    const T4 = T3 * Math.pow(v3 / v4, k - 1);
    const p4 = p3 * Math.pow(v3 / v4, k);

    // Balances
    const qOut  = cv * (T4 - T1);             // calor rechazado [J/kg]
    const wNet  = qIn - qOut;                 // trabajo neto [J/kg]
    const eta   = 1 - 1 / Math.pow(r, k - 1); // rendimiento térmico ideal
    const pme   = wNet / (v1 - v2);           // presión media efectiva [Pa]

    return {
        cycle: 'Otto',
        states: [
            { id: 1, T: T1, p: p1, v: v1 },
            { id: 2, T: T2, p: p2, v: v2 },
            { id: 3, T: T3, p: p3, v: v3 },
            { id: 4, T: T4, p: p4, v: v4 }
        ],
        qIn, qOut, wNet, eta, pme,
        Tmax: T3, pmax: p3,
        params: { r, k }
    };
}

/* ============================================================================
 *  CICLO DIESEL (aire estándar frío)
 *  Aporte de calor a P=cte: T3 = T2 + qIn/cp ; rc = v3/v2 = T3/T2
 * ============================================================================
 */
function dieselCycle(state1, r, qIn, air) {
    if (!Number.isFinite(r) || r <= 1) throw new Error('Relación de compresión > 1');

    const { k, cv, cp, R } = air;
    const T1 = state1.T, p1 = state1.p;
    const v1 = R * T1 / p1;

    // 1 -> 2: compresión isoentrópica
    const v2 = v1 / r;
    const T2 = T1 * Math.pow(r, k - 1);
    const p2 = p1 * Math.pow(r, k);

    // 2 -> 3: aporte de calor a P=cte
    const p3 = p2;
    const T3 = T2 + qIn / cp;
    const rc = T3 / T2;          // relación de corte de admisión
    const v3 = v2 * rc;

    // 3 -> 4: expansión isoentrópica hasta v4 = v1
    const v4 = v1;
    const T4 = T3 * Math.pow(v3 / v4, k - 1);
    const p4 = p3 * Math.pow(v3 / v4, k);

    const qOut = cv * (T4 - T1);
    const wNet = qIn - qOut;
    const eta  = 1 - (1 / Math.pow(r, k - 1)) *
                     ((Math.pow(rc, k) - 1) / (k * (rc - 1)));
    const pme  = wNet / (v1 - v2);

    return {
        cycle: 'Diesel',
        states: [
            { id: 1, T: T1, p: p1, v: v1 },
            { id: 2, T: T2, p: p2, v: v2 },
            { id: 3, T: T3, p: p3, v: v3 },
            { id: 4, T: T4, p: p4, v: v4 }
        ],
        qIn, qOut, wNet, eta, pme,
        Tmax: T3, pmax: p3,
        params: { r, rc, k }
    };
}

/* ============================================================================
 *  CICLO SABATHÉ / DUAL (aire estándar frío)
 *  Aporte de calor dividido en dos etapas:
 *     - q_v = aporte a V=cte (definido por el usuario, J/kg de aire)
 *     - q_p = aporte a P=cte (resto: qIn - q_v)
 *  Estados:
 *     1 -> 2 (compresión isoentrópica)
 *     2 -> 3 (Q a V=cte)
 *     3 -> 4 (Q a P=cte)
 *     4 -> 5 (expansión isoentrópica)
 *     5 -> 1 (rechazo a V=cte)
 *  α = p3/p2 (relación de presiones a V=cte)
 *  rc = v4/v3 (relación de corte a P=cte)
 * ============================================================================
 */
function sabatheCycle(state1, r, qIn, qV, air) {
    if (!Number.isFinite(r) || r <= 1)  throw new Error('Relación de compresión > 1');
    if (!Number.isFinite(qV) || qV < 0) throw new Error('Q a V=cte debe ser ≥ 0');
    if (qV > qIn) {
        throw new Error('Q a V=cte no puede superar el calor total aportado');
    }

    const { k, cv, cp, R } = air;
    const qP = qIn - qV;
    const T1 = state1.T, p1 = state1.p;
    const v1 = R * T1 / p1;

    // 1 -> 2: compresión isoentrópica
    const v2 = v1 / r;
    const T2 = T1 * Math.pow(r, k - 1);
    const p2 = p1 * Math.pow(r, k);

    // 2 -> 3: aporte a V=cte
    const v3 = v2;
    const T3 = T2 + qV / cv;
    const p3 = p2 * (T3 / T2);
    const alpha = p3 / p2;

    // 3 -> 4: aporte a P=cte
    const p4 = p3;
    const T4 = T3 + qP / cp;
    const rc = T4 / T3;
    const v4 = v3 * rc;

    // 4 -> 5: expansión isoentrópica hasta v5 = v1
    const v5 = v1;
    const T5 = T4 * Math.pow(v4 / v5, k - 1);
    const p5 = p4 * Math.pow(v4 / v5, k);

    const qOut = cv * (T5 - T1);
    const wNet = qIn - qOut;
    const eta  = 1 - (1 / Math.pow(r, k - 1)) *
                     ((alpha * Math.pow(rc, k) - 1) /
                      (alpha - 1 + k * alpha * (rc - 1)));
    const pme  = wNet / (v1 - v2);

    return {
        cycle: 'Sabathé',
        states: [
            { id: 1, T: T1, p: p1, v: v1 },
            { id: 2, T: T2, p: p2, v: v2 },
            { id: 3, T: T3, p: p3, v: v3 },
            { id: 4, T: T4, p: p4, v: v4 },
            { id: 5, T: T5, p: p5, v: v5 }
        ],
        qIn, qOut, qV, qP, wNet, eta, pme,
        Tmax: T4, pmax: p3,        // T4 ≥ T3 ya que aporta calor a P=cte
        params: { r, alpha, rc, k }
    };
}

/* ============================================================================
 *  DIMENSIONAMIENTO DEL MOTOR
 *  A partir de la PME, potencia requerida, rpm y nº de cilindros se obtiene
 *  la cilindrada. Luego, con la relación carrera/diámetro (S/D) se calculan
 *  S y D del pistón.
 *
 *  Cuatro tiempos: una explosión cada 2 vueltas  →  i = rpm / (2·60) explosiones/s
 *  Trabajo por ciclo y cilindro: W_ciclo = PME · V_unit
 *  Potencia total: P = PME · V_unit · n_cil · (rpm / (2·60))  [4T]
 *  ⇒ V_unit = P / (PME · n_cil · rpm / 120)
 * ============================================================================
 */
function engineSizing(pme_Pa, power_W, nCyl, rpm, strokesPerCycle, S_over_D) {
    if (!Number.isFinite(pme_Pa) || pme_Pa <= 0) throw new Error('PME inválida');
    if (!Number.isFinite(power_W) || power_W <= 0) throw new Error('Potencia inválida');
    if (!Number.isInteger(nCyl) || nCyl <= 0) throw new Error('Nº de cilindros inválido');
    if (!Number.isFinite(rpm) || rpm <= 0) throw new Error('rpm inválidas');
    if (strokesPerCycle !== 2 && strokesPerCycle !== 4) {
        throw new Error('strokesPerCycle debe ser 2 o 4');
    }
    if (!Number.isFinite(S_over_D) || S_over_D <= 0) {
        throw new Error('Relación S/D inválida');
    }

    // Explosiones por segundo por cilindro: rpm/60 (2T) o rpm/120 (4T)
    const cyclesPerSecond = rpm / (60 * (strokesPerCycle / 2));

    // Cilindrada total y unitaria [m³]
    const V_total = power_W / (pme_Pa * cyclesPerSecond);
    const V_unit  = V_total / nCyl;

    // V_unit = (π/4)·D²·S  con S = (S/D)·D  →  D = (4·V_unit / (π·(S/D)))^(1/3)
    const D = Math.cbrt(4 * V_unit / (Math.PI * S_over_D));
    const S = S_over_D * D;

    return {
        V_total_m3: V_total,
        V_unit_m3:  V_unit,
        V_total_cc: V_total * 1e6,
        V_unit_cc:  V_unit  * 1e6,
        D_m: D,
        S_m: S,
        D_mm: D * 1000,
        S_mm: S * 1000,
        S_over_D,
        cyclesPerSecond,
        strokesPerCycle
    };
}

/* ============================================================================
 *  CONVERSIONES DE UNIDADES
 * ============================================================================
 */
const Units = Object.freeze({
    altitudeToMeters(value, unit) {
        if (unit === 'm')  return value;
        if (unit === 'ft') return value * CONST.FT_TO_M;
        throw new Error(`Unidad de altitud desconocida: ${unit}`);
    },
    powerToWatts(value, unit) {
        if (unit === 'W')  return value;
        if (unit === 'kW') return value * 1000;
        if (unit === 'HP') return value * CONST.HP_TO_W;
        if (unit === 'cv') return value * CONST.CV_TO_W;
        throw new Error(`Unidad de potencia desconocida: ${unit}`);
    }
});

/* ============================================================================
 *  VERIFICACIÓN DE ALERTAS
 *
 *  Niveles:
 *    'error'   → entrada inválida que invalida todo el cálculo
 *                (p.ej. r ≤ 1 o q_in ≤ 0 → ciclo degenerado).
 *    'warning' → resultado físicamente plausible pero fuera de los
 *                rangos típicos de diseño (p_max > 100 bar o T_max > 4800 K).
 *
 *  Acepta opcionalmente el objeto de contexto { r, qIn } para chequeos
 *  previos al cálculo. Si no se pasa, sólo se verifican los umbrales de
 *  presión y temperatura sobre el resultado.
 * ============================================================================
 */
function checkAlerts(result, ctx) {
    const alerts = [];
    ctx = ctx || {};

    // --- Validaciones de entrada (errores que degeneran el ciclo) ---
    if (Number.isFinite(ctx.r) && ctx.r <= 1) {
        alerts.push({
            level: 'error',
            field: 'r',
            message: `Relación de compresión r = ${ctx.r}. Con r ≤ 1 no hay ` +
                     `compresión y el ciclo se degenera (w_neto = 0, PME = 0). ` +
                     `Aumentar r por encima de 1 para obtener trabajo útil.`
        });
    }
    if (Number.isFinite(ctx.qIn) && ctx.qIn <= 0) {
        alerts.push({
            level: 'error',
            field: 'qIn',
            message: `Calor aportado q_in = ${ctx.qIn.toFixed(1)} J/kg. ` +
                     `Sin aporte de calor no hay combustión y el ciclo se ` +
                     `degenera (T₃ = T₂, w_neto = 0). Verificar combustible, ` +
                     `λ y PCI.`
        });
    }

    // Si la entrada ya es inválida no tiene sentido evaluar el resultado.
    if (alerts.some(a => a.level === 'error') || !result) return alerts;

    // --- Verificación de umbrales sobre el resultado ---
    const pmax_bar = result.pmax * CONST.PA_TO_BAR;
    if (pmax_bar > CONST.PMAX_ALERT_BAR) {
        alerts.push({
            level: 'warning',
            field: 'pmax',
            message: `Presión máxima ${pmax_bar.toFixed(1)} bar supera ` +
                     `los ${CONST.PMAX_ALERT_BAR} bar. Revisar entradas.`
        });
    }
    if (result.Tmax > CONST.TMAX_ALERT_K) {
        alerts.push({
            level: 'warning',
            field: 'Tmax',
            message: `Temperatura máxima ${result.Tmax.toFixed(0)} K supera ` +
                     `los ${CONST.TMAX_ALERT_K} K. Revisar entradas.`
        });
    }
    return alerts;
}

/* ============================================================================
 *  FUNCIÓN MAESTRA: computeCycle(input)
 *
 *  input = {
 *      cycle:        'otto' | 'diesel' | 'sabathe',
 *      altitude:     número,
 *      altitudeUnit: 'm' | 'ft',
 *      k:            1.3 … 1.4,
 *      fuel:         clave de FUELS  ó  { nC, nH, nO?, PCI } (custom),
 *      lambda:       relación de mezcla relativa (λ),
 *      r:            relación de compresión,
 *      nCyl:         nº de cilindros,
 *      power:        potencia requerida,
 *      powerUnit:    'HP' | 'cv' | 'kW' | 'W',
 *      rpm:          régimen,
 *      strokes:      2 | 4   (por defecto 4),
 *      S_over_D:     relación carrera/diámetro (slider 0.5–1.5),
 *      qV:           SOLO Sabathé - calor aportado a V=cte [J/kg de aire]
 *  }
 *
 *  Devuelve un objeto con: atmósfera, propiedades del aire, AFR, qIn,
 *  resultado del ciclo elegido, los otros dos ciclos (para gráficos
 *  comparativos), dimensionamiento y alertas.
 * ============================================================================
 */
function computeCycle(input) {
    // ---- 1) Validar y normalizar entradas ---------------------------------
    const cycleId = String(input.cycle || '').toLowerCase();
    if (!['otto', 'diesel', 'sabathe', 'sabathé'].includes(cycleId)) {
        throw new Error(`Ciclo desconocido: ${input.cycle}`);
    }

    const altitude_m = Units.altitudeToMeters(
        Number(input.altitude), input.altitudeUnit || 'm'
    );
    const atm  = isaAtmosphere(altitude_m);
    const air  = airProperties(Number(input.k));

    // Combustible: puede venir como clave o como objeto custom
    let fuel;
    if (typeof input.fuel === 'string') {
        fuel = FUELS[input.fuel];
        if (!fuel) throw new Error(`Combustible desconocido: ${input.fuel}`);
    } else if (input.fuel && typeof input.fuel === 'object') {
        const { nC, nH, nO = 0, PCI } = input.fuel;
        if (!Number.isFinite(nC) || !Number.isFinite(nH) || !Number.isFinite(PCI)) {
            throw new Error('Combustible custom debe incluir nC, nH y PCI');
        }
        fuel = { name: `Custom C${nC}H${nH}${nO ? 'O' + nO : ''}`,
                 nC, nH, nO, PCI };
    } else {
        throw new Error('Combustible no especificado');
    }

    const lambda = Number(input.lambda);
    const r      = Number(input.r);

    // ---- 2) Calor aportado por kg de aire ---------------------------------
    const { qIn, AFR_st, AFR_real } = heatInputPerKgAir(fuel, lambda);

    // ---- 2.5) Pre-validación: r ≤ 1 o q_in ≤ 0 degeneran el ciclo ---------
    const preAlerts = checkAlerts(null, { r, qIn });
    if (preAlerts.some(a => a.level === 'error')) {
        return {
            input: { ...input, altitude_m, fuelResolved: fuel },
            atmosphere: atm,
            airProperties: air,
            combustion: { AFR_st, AFR_real, qIn, lambda, fuel },
            cycles: null,
            active: null,
            sizing: null,
            alerts: preAlerts,
            degenerate: true
        };
    }

    // ---- 3) Estado inicial: condiciones atmosféricas ----------------------
    const state1 = { T: atm.T, p: atm.p };

    // ---- 4) Resolver los TRES ciclos (para gráficos comparativos) ---------
    const ottoRes   = ottoCycle(state1, r, qIn, air);
    const dieselRes = dieselCycle(state1, r, qIn, air);

    // Para Sabathé necesitamos qV: si no se da, repartir 50/50 por defecto.
    const qV = (input.qV !== undefined && input.qV !== null && input.qV !== '')
             ? Number(input.qV)
             : qIn * 0.5;
    const sabatheRes = sabatheCycle(state1, r, qIn, qV, air);

    // ---- 5) Seleccionar el ciclo activo -----------------------------------
    let active;
    if (cycleId === 'otto')   active = ottoRes;
    else if (cycleId === 'diesel') active = dieselRes;
    else                           active = sabatheRes;

    // ---- 6) Dimensionamiento del motor ------------------------------------
    const power_W = Units.powerToWatts(Number(input.power), input.powerUnit || 'HP');
    const sizing = engineSizing(
        active.pme,
        power_W,
        parseInt(input.nCyl, 10),
        Number(input.rpm),
        input.strokes || 4,
        Number(input.S_over_D)
    );

    // ---- 7) Alertas (umbrales sobre el resultado) -------------------------
    const alerts = checkAlerts(active, { r, qIn });

    return {
        input: { ...input, altitude_m, power_W, fuelResolved: fuel },
        atmosphere: atm,
        airProperties: air,
        combustion: { AFR_st, AFR_real, qIn, lambda, fuel },
        cycles: { otto: ottoRes, diesel: dieselRes, sabathe: sabatheRes },
        active,
        sizing,
        alerts
    };
}

/* ============================================================================
 *  PUNTOS PARA GRAFICAR (P-v y T-s)
 *  Para cada proceso (1→2, 2→3, …) se generan N puntos.
 *  - Isoentrópica:  p·v^k = cte ; T·v^(k-1) = cte  ⇒  Δs = 0
 *  - V = cte:       Δs = cv·ln(T2/T1)
 *  - P = cte:       Δs = cp·ln(T2/T1)
 *  La entropía es relativa al estado 1 (s1 = 0).
 * ============================================================================
 */
function buildPvTsCurves(cycleResult, airOrSamples, samplesArg) {
    // Firma flexible:
    //   buildPvTsCurves(fullResult)                        ← result.active + result.airProperties
    //   buildPvTsCurves(fullResult, samples)
    //   buildPvTsCurves(cycleResult, airProperties)        ← objeto de un solo ciclo
    //   buildPvTsCurves(cycleResult, airProperties, samples)
    //   buildPvTsCurves(cycleResult, samples)              ← ciclo individual con k embebido en params
    let states, air, samples;
    if (cycleResult.active && cycleResult.airProperties) {
        states  = cycleResult.active.states;
        air     = cycleResult.airProperties;
        samples = (typeof airOrSamples === 'number') ? airOrSamples : 60;
    } else if (cycleResult.states && airOrSamples && typeof airOrSamples === 'object') {
        states  = cycleResult.states;
        air     = airOrSamples;
        samples = samplesArg || 60;
    } else if (cycleResult.states && cycleResult.params && Number.isFinite(cycleResult.params.k)) {
        // Reconstruir airProperties desde el ciclo (k está en params)
        states  = cycleResult.states;
        air     = airProperties(cycleResult.params.k);
        samples = (typeof airOrSamples === 'number') ? airOrSamples : 60;
    } else {
        throw new Error('buildPvTsCurves: argumentos inválidos. Pasar el resultado de computeCycle, o (ciclo, airProperties).');
    }
    const { k, cv, cp, R } = air;
    const n = states.length;
    const pv = [], ts = [];

    let s_prev = 0;
    // Estado 1 con s = 0
    pv.push({ v: states[0].v, p: states[0].p, label: 1 });
    ts.push({ s: 0,           T: states[0].T, label: 1 });

    for (let i = 0; i < n; i++) {
        const A = states[i];
        const B = states[(i + 1) % n];   // último cierra contra el primero
        const isVconst = Math.abs(A.v - B.v) / A.v < 1e-9;
        const isPconst = Math.abs(A.p - B.p) / A.p < 1e-9;
        const isIsoS   = !isVconst && !isPconst; // por defecto

        let s_end;
        if (isIsoS)        s_end = s_prev;
        else if (isVconst) s_end = s_prev + cv * Math.log(B.T / A.T);
        else /* P=cte */   s_end = s_prev + cp * Math.log(B.T / A.T);

        for (let j = 1; j <= samples; j++) {
            const t = j / samples;            // parámetro 0..1
            let v_t, p_t, T_t, s_t;
            if (isIsoS) {
                // Interpolar v linealmente; p y T salen de pv^k = cte y T = pv/R
                v_t = A.v + (B.v - A.v) * t;
                p_t = A.p * Math.pow(A.v / v_t, k);
                T_t = p_t * v_t / R;
                s_t = s_prev;                  // constante
            } else if (isVconst) {
                v_t = A.v;
                T_t = A.T + (B.T - A.T) * t;
                p_t = A.p * (T_t / A.T);
                s_t = s_prev + cv * Math.log(T_t / A.T);
            } else { // P=cte
                p_t = A.p;
                T_t = A.T + (B.T - A.T) * t;
                v_t = R * T_t / p_t;
                s_t = s_prev + cp * Math.log(T_t / A.T);
            }
            pv.push({ v: v_t, p: p_t });
            ts.push({ s: s_t, T: T_t });
        }
        s_prev = s_end;
        // Marca de estado al final del proceso (excepto el último, que cierra)
        if (i < n - 1) {
            pv[pv.length - 1].label = B.id;
            ts[ts.length - 1].label = B.id;
        }
    }
    return { pv, ts };
}

/* ============================================================================
 *  EXPORTS
 *  Soporta uso como módulo (CommonJS / ES) y como global del navegador.
 * ============================================================================
 */
const ThermoCycles = {
    CONST,
    FUELS,
    Units,
    isaAtmosphere,
    airProperties,
    stoichiometricAFR,
    heatInputPerKgAir,
    ottoCycle,
    dieselCycle,
    sabatheCycle,
    engineSizing,
    checkAlerts,
    computeCycle,
    buildPvTsCurves
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThermoCycles;
}
if (typeof window !== 'undefined') {
    window.ThermoCycles = ThermoCycles;
}
