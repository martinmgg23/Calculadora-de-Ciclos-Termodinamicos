/**
 * ============================================================================
 *  TEST DE VALIDACIÓN — Caso de referencia
 * ============================================================================
 *  Entradas:
 *    Ciclo:                 Otto
 *    Altitud:               8000 ft  (≡ 2438.4 m)
 *    Combustible:           Heptano (C7H16, PCI ≈ 44.5 MJ/kg)
 *    Relación compresión:   r = 6.3
 *    Relación mezcla:       λ = 1.1  (mezcla pobre)
 *    Régimen:               2900 rpm
 *    Cilindros:             9
 *    k:                     1.4
 *
 *  Valores esperados según la referencia provista:
 *    Estado 1: p =   75.2621 kPa,  T =  272.30 K,  v = 1.03855 m³/kg
 *    Estado 2: p =  990.041  kPa,  T =  568.571 K, v = 0.16485 m³/kg
 *    Estado 3: p = 7487.57   kPa,  T = 4300.04 K,  v = 0.16485 m³/kg
 *    Estado 4: p =  569.199  kPa,  T = 2059.38 K,  v = 1.03855 m³/kg
 *    Fs estequiométrico  = 0.0660442 kg fuel / kg aire
 *    F real              = 0.0600402 kg fuel / kg aire
 *    Q_in   = 2677.79 kJ/kg aire
 *    Tmax   = 4300.04 K
 *    Pmax   =   74.8757 bar
 *    Q_out  = 1282.45 kJ/kg
 *    W_net  = 1395.34 kJ/kg
 *    η      = 0.521079
 *    PME    =   15.9704 bar
 *
 *  Tolerancia: 0.5 %
 * ============================================================================
 */

const TC = require('./thermo-cycles.js');

const TOL = 0.005;   // 0.5 %

// -------- Caso a evaluar ---------------------------------------------------
const input = {
    cycle:        'otto',
    altitude:     8000,
    altitudeUnit: 'ft',
    k:            1.4,
    fuel:         { nC: 7, nH: 16, PCI: 44.5e6 },  // heptano
    lambda:       1.1,
    r:            6.3,
    nCyl:         9,
    power:        100,                              // dato libre (no afecta a η, p, T, v)
    powerUnit:    'HP',
    rpm:          2900,
    strokes:      4,
    S_over_D:     1.0
};

const result = TC.computeCycle(input);
const cyc    = result.active;
const comb   = result.combustion;

// -------- Valores esperados ------------------------------------------------
const expected = {
    states: [
        { id: 1, p_kPa:   75.2621, T_K:  272.30, v: 1.03855 },
        { id: 2, p_kPa:  990.041,  T_K:  568.571, v: 0.16485 },
        { id: 3, p_kPa: 7487.57,   T_K: 4300.04, v: 0.16485 },
        { id: 4, p_kPa:  569.199,  T_K: 2059.38, v: 1.03855 }
    ],
    Fs_real:   0.0600402,
    Fs_st:     0.0660442,
    qIn_kJ:    2677.79,
    Tmax_K:    4300.04,
    pmax_bar:    74.8757,
    qOut_kJ:   1282.45,
    wNet_kJ:   1395.34,
    eta:          0.521079,
    pme_bar:     15.9704
};

// -------- Utilidades de comparación ----------------------------------------
function compare(label, computed, ref, unit = '') {
    const absErr = Math.abs(computed - ref);
    const relErr = ref !== 0 ? absErr / Math.abs(ref) : absErr;
    const ok     = relErr <= TOL;
    const status = ok ? '✓' : '✗';
    const compStr = computed.toFixed(Math.abs(computed) < 10 ? 6 : 4);
    const refStr  = ref.toFixed(Math.abs(ref) < 10 ? 6 : 4);
    console.log(
        `  ${status}  ${label.padEnd(28)}` +
        `  calc = ${compStr.padStart(12)} ${unit.padEnd(8)}` +
        `  ref = ${refStr.padStart(12)} ${unit.padEnd(8)}` +
        `  err = ${(relErr * 100).toFixed(4)} %`
    );
    return ok;
}

// -------- Encabezado -------------------------------------------------------
console.log('═══════════════════════════════════════════════════════════════════════════════');
console.log(' VALIDACIÓN — Ciclo Otto, heptano, 8000 ft, r=6.3, λ=1.1, k=1.4');
console.log('═══════════════════════════════════════════════════════════════════════════════');
console.log(` Atmósfera ISA a ${result.input.altitude_m.toFixed(1)} m:`);
console.log(`   T1 = ${result.atmosphere.T.toFixed(3)} K       p1 = ${(result.atmosphere.p/1000).toFixed(4)} kPa`);
console.log();

let allOk = true;

// -------- Estados ----------------------------------------------------------
console.log(' Estados termodinámicos:');
console.log(' ─────────────────────────────────────────────────────────────────────────────');
for (let i = 0; i < 4; i++) {
    const s = cyc.states[i];
    const e = expected.states[i];
    console.log(` Estado ${s.id}:`);
    allOk &= compare(`  p`,  s.p / 1000, e.p_kPa, 'kPa');
    allOk &= compare(`  T`,  s.T,        e.T_K,   'K');
    allOk &= compare(`  v`,  s.v,        e.v,     'm³/kg');
}

// -------- Combustión -------------------------------------------------------
console.log('\n Combustión:');
console.log(' ─────────────────────────────────────────────────────────────────────────────');
const Fs_st_calc   = 1 / comb.AFR_st;
const Fs_real_calc = 1 / comb.AFR_real;
allOk &= compare('Fs estequiométrico (F)',  Fs_st_calc,    expected.Fs_st,   '[-]');
allOk &= compare('F real',                   Fs_real_calc,  expected.Fs_real, '[-]');
allOk &= compare('Q_in',                     cyc.qIn / 1000, expected.qIn_kJ, 'kJ/kg');

// -------- Resultados del ciclo ---------------------------------------------
console.log('\n Magnitudes del ciclo:');
console.log(' ─────────────────────────────────────────────────────────────────────────────');
allOk &= compare('Tmax',   cyc.Tmax,            expected.Tmax_K,    'K');
allOk &= compare('Pmax',   cyc.pmax / 1e5,      expected.pmax_bar,  'bar');
allOk &= compare('Q_out',  cyc.qOut / 1000,     expected.qOut_kJ,   'kJ/kg');
allOk &= compare('W_net',  cyc.wNet / 1000,     expected.wNet_kJ,   'kJ/kg');
allOk &= compare('η',      cyc.eta,             expected.eta,       '[-]');
allOk &= compare('PME',    cyc.pme / 1e5,       expected.pme_bar,   'bar');

// -------- Cálculo teórico de referencia ------------------------------------
console.log('\n Verificación cruzada (fórmula cerrada):');
console.log(' ─────────────────────────────────────────────────────────────────────────────');
const eta_teo = 1 - 1 / Math.pow(6.3, 0.4);
console.log(`   η_teórico = 1 - 1/r^(k-1) = ${eta_teo.toFixed(6)}`);
console.log(`   Diferencia con referencia: ${((eta_teo - expected.eta) / expected.eta * 100).toFixed(4)} %`);

// ============================================================================
//  SUITE DE ALERTAS — casos degenerados
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════════════════════════');
console.log(' VALIDACIÓN DE ALERTAS — casos degenerados');
console.log('═══════════════════════════════════════════════════════════════════════════════');

function expectAlert(label, runInput, expectedField) {
    const res = TC.computeCycle(runInput);
    const hasErr = res.alerts.some(a => a.level === 'error' && a.field === expectedField);
    const isDeg  = res.degenerate === true;
    const ok = hasErr && isDeg;
    console.log(`  ${ok ? '✓' : '✗'}  ${label.padEnd(45)}  degenerate=${isDeg}  alert(${expectedField})=${hasErr}`);
    return ok;
}

const baseInput = {
    cycle:'otto', altitude:0, altitudeUnit:'m', k:1.4,
    fuel:'gasoline', lambda:1.0, r:10, nCyl:4,
    power:100, powerUnit:'HP', rpm:5000, strokes:4, S_over_D:1.0
};

let alertsOk = true;
alertsOk &= expectAlert('r = 1 dispara alerta crítica',
    { ...baseInput, r: 1 }, 'r');
alertsOk &= expectAlert('r = 0.5 (absurdo) dispara alerta crítica',
    { ...baseInput, r: 0.5 }, 'r');
alertsOk &= expectAlert('PCI = 0 → q_in = 0 dispara alerta crítica',
    { ...baseInput, fuel: { nC: 8, nH: 18, PCI: 0 } }, 'qIn');

// Caso normal: no debe disparar errores (warnings sí están permitidos)
const normal = TC.computeCycle(baseInput);
const noErrors = !normal.alerts.some(a => a.level === 'error');
console.log(`  ${noErrors ? '✓' : '✗'}  ${'caso normal no dispara errores'.padEnd(45)}  errores=${!noErrors}`);
alertsOk &= noErrors;

// -------- Veredicto final --------------------------------------------------
const finalOk = allOk && alertsOk;
console.log('\n═══════════════════════════════════════════════════════════════════════════════');
console.log(finalOk
    ? ' ✓ VALIDACIÓN APROBADA — caso de referencia (±0.5 %) y alertas correctas.'
    : ' ✗ VALIDACIÓN RECHAZADA — fallaron tolerancia y/o alertas.'
);
console.log('═══════════════════════════════════════════════════════════════════════════════');
process.exit(finalOk ? 0 : 1);
