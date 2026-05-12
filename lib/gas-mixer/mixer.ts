/**
 * Gas Mixer — partial-pressure blending with real-gas corrections.
 *
 * Two operations:
 *  - Fill-up: from a starting (possibly empty) tank, compute the amounts of
 *    pure O₂, pure He, and a top-up gas (e.g. air or EAN32) needed to reach
 *    a target pressure with a target mix at a given ambient temperature.
 *    When the existing tank contents make the target unreachable by addition
 *    alone, a *bleed* step is prepended to drain the tank to a feasible
 *    starting pressure.
 *  - Top-up: from a known starting mix & pressure, adding a known top-up gas
 *    up to a target pressure, compute the resulting mix.
 *
 * Real-gas treatment (Fill-up):
 *  - Uses the Van der Waals equation of state with one-fluid mixing rules:
 *      a_mix = ΣᵢΣⱼ xᵢxⱼ √(aᵢaⱼ)
 *      b_mix = Σᵢ  xᵢ bᵢ
 *  - Calculations are performed in molar density (mol/L) so that temperature
 *    and compressibility correctly influence every step. Each fill increment
 *    converts the new molar state back into a gauge pressure via VdW,
 *    so changes in ambient temperature shift the intermediate stop pressures.
 *
 * Conventions:
 *  - Pressures in bar.
 *  - Gas fractions as decimals (0.21 = 21%).
 *  - Temperature in degrees Celsius (converted internally to Kelvin).
 */

export type FillFirstGas = 'O2' | 'He';

interface MixerGasFractions {
  fO2: number;
  fHe: number;
  fN2: number;
}

// ---------------------------------------------------------------------------
// VAN DER WAALS REAL-GAS HELPERS
// ---------------------------------------------------------------------------

/** Van der Waals attraction parameter `a` (bar·L²·mol⁻²) per gas. */
const VDW_A = { O2: 1.382, He: 0.0346, N2: 1.37 } as const;
/** Van der Waals excluded-volume parameter `b` (L·mol⁻¹) per gas. */
const VDW_B = { O2: 0.03186, He: 0.0238, N2: 0.0387 } as const;
/** Gas constant in L·bar·mol⁻¹·K⁻¹. */
const R_GAS = 0.0831446;

function mixA(fO2: number, fHe: number, fN2: number): number {
  const aOO = VDW_A.O2;
  const aHH = VDW_A.He;
  const aNN = VDW_A.N2;
  const aOH = Math.sqrt(aOO * aHH);
  const aON = Math.sqrt(aOO * aNN);
  const aHN = Math.sqrt(aHH * aNN);
  return (
    fO2 * fO2 * aOO +
    fHe * fHe * aHH +
    fN2 * fN2 * aNN +
    2 * fO2 * fHe * aOH +
    2 * fO2 * fN2 * aON +
    2 * fHe * fN2 * aHN
  );
}

function mixB(fO2: number, fHe: number, fN2: number): number {
  return fO2 * VDW_B.O2 + fHe * VDW_B.He + fN2 * VDW_B.N2;
}

/** Pressure (bar) from molar density (mol/L), temperature (K), and mix. */
function pressureFromDensity(
  rho: number,
  T: number,
  fO2: number,
  fHe: number,
  fN2: number
): number {
  if (rho <= 0) return 0;
  const a = mixA(fO2, fHe, fN2);
  const b = mixB(fO2, fHe, fN2);
  const denom = 1 - rho * b;
  if (denom <= 1e-9) return Number.POSITIVE_INFINITY;
  return (rho * R_GAS * T) / denom - a * rho * rho;
}

/**
 * Molar density (mol/L) from pressure (bar), temperature (K), and mix.
 * Solves the VdW equation by Newton iteration, seeded with the ideal-gas value.
 */
function densityFromPressure(P: number, T: number, fO2: number, fHe: number, fN2: number): number {
  if (P <= 0) return 0;
  const a = mixA(fO2, fHe, fN2);
  const b = mixB(fO2, fHe, fN2);
  let rho = P / (R_GAS * T); // ideal-gas seed
  for (let i = 0; i < 100; i++) {
    const oneMinusBR = 1 - rho * b;
    if (oneMinusBR <= 1e-9) {
      rho *= 0.5;
      continue;
    }
    const f = (rho * R_GAS * T) / oneMinusBR - a * rho * rho - P;
    const fprime = (R_GAS * T) / (oneMinusBR * oneMinusBR) - 2 * a * rho;
    if (Math.abs(fprime) < 1e-12) break;
    const delta = f / fprime;
    rho -= delta;
    if (Math.abs(delta) < 1e-12) break;
  }
  return Math.max(0, rho);
}

// ---------------------------------------------------------------------------
// FILL-UP
// ---------------------------------------------------------------------------

interface FillUpInput {
  /** Tank pressure before filling (bar). Can be 0 for an empty tank. */
  startPressure: number;
  /** Tank pressure after filling (bar). */
  endPressure: number;
  /** Starting mix in the tank (0-1 fractions). For an empty tank, ignored. */
  startO2: number;
  startHe: number;
  /** Target final mix (0-1 fractions). */
  finalO2: number;
  finalHe: number;
  /** Top-up gas composition (0-1 fractions). Air = {O2: 0.21, He: 0}. */
  topUpO2: number;
  topUpHe: number;
  /** Which pure gas to add first. */
  firstGas: FillFirstGas;
  /** Ambient temperature in °C (defaults to 20°C). */
  temperatureC?: number;
}

export interface FillUpStep {
  /** Identifier for the step. */
  gas: 'O2' | 'He' | 'TopUp' | 'Bleed';
  /** Human label for display. */
  label: string;
  /** Gauge reading before this step begins (bar). */
  fromPressure: number;
  /** Gauge reading after this step ends (bar). */
  toPressure: number;
  /** Magnitude of the pressure change for this step (bar, always ≥ 0). */
  addedBar: number;
}

type FillUpFeasibility = { ok: true } | { ok: false; reason: string };

export interface FillUpResult {
  /** Ordered steps to follow (may begin with a Bleed step). */
  steps: FillUpStep[];
  /** Pure O₂ pressure increment in the fill plan (bar). */
  addO2Bar: number;
  /** Pure He pressure increment in the fill plan (bar). */
  addHeBar: number;
  /** Top-up pressure increment in the fill plan (bar). */
  addTopUpBar: number;
  /** Amount of gas to bleed before the fill (bar). 0 when no bleed is needed. */
  bleedBar: number;
  /** Whether the requested target is physically achievable. */
  feasibility: FillUpFeasibility;
}

/**
 * Compute the fill plan to go from the starting state to the target mix &
 * pressure using pure O₂, pure He, and a top-up gas — with a Van der Waals
 * real-gas correction applied at the user's ambient temperature.
 *
 * Conservation, per unit volume, of the moles of each species:
 *   ρ_b·s_O2 + n_O2 + n_T·tO2 = ρ_f·f_O2
 *   ρ_b·s_He + n_He + n_T·tHe = ρ_f·f_He
 *   ρ_b·s_N2          + n_T·tN2 = ρ_f·f_N2
 *
 * ρ_b is the molar density just before refilling — equal to ρ₀ when no bleed
 * is needed, otherwise reduced so that all three additions stay non-negative.
 * From the N₂ row (when tN2 > 0):
 *   n_T = (ρ_f·f_N2 − ρ_b·s_N2) / tN2,
 * then n_O2 and n_He follow directly. We pick the largest feasible ρ_b ≤ ρ₀
 * and emit a Bleed step when ρ_b < ρ₀.
 */
export function calculateFillUp(input: FillUpInput): FillUpResult {
  const sO2 = clamp01(input.startO2);
  const sHe = clamp01(input.startHe);
  const sN2 = Math.max(0, 1 - sO2 - sHe);

  const fO2 = clamp01(input.finalO2);
  const fHe = clamp01(input.finalHe);
  const fN2 = Math.max(0, 1 - fO2 - fHe);

  const tO2 = clamp01(input.topUpO2);
  const tHe = clamp01(input.topUpHe);
  const tN2 = Math.max(0, 1 - tO2 - tHe);

  const P0 = Math.max(0, input.startPressure);
  const Pf = Math.max(0, input.endPressure);
  const T = (input.temperatureC ?? 20) + 273.15;

  if (input.startO2 + input.startHe > 1 + 1e-9) {
    return failedResult('Starting O₂ + He cannot exceed 100%.');
  }
  if (input.finalO2 + input.finalHe > 1 + 1e-9) {
    return failedResult('Final O₂ + He cannot exceed 100%.');
  }
  if (input.topUpO2 + input.topUpHe > 1 + 1e-9) {
    return failedResult('Top-up O₂ + He cannot exceed 100%.');
  }
  if (Pf <= 0) {
    return failedResult('Final pressure must be greater than 0.');
  }
  if (Pf <= P0) {
    return failedResult('Final pressure must be greater than starting pressure.');
  }

  // Molar densities (mol/L) at start and target.
  const rho0 = densityFromPressure(P0, T, sO2, sHe, sN2);
  const rhof = densityFromPressure(Pf, T, fO2, fHe, fN2);

  // Determine the maximum feasible ρ_b ≤ ρ₀.
  // Each addition n_X is linear in ρ_b → upper-bound constraints when the
  // coefficient on ρ_b is positive, lower-bound constraints otherwise.
  const upperBounds: number[] = [];
  let hardInfeasible: string | null = null;

  if (tN2 > 1e-9) {
    // n_T ≥ 0
    if (sN2 > 1e-9) upperBounds.push((rhof * fN2) / sN2);

    // n_O2 ≥ 0  →  A_O2 − B_O2·ρ_b ≥ 0
    const aO2 = rhof * fO2 - (rhof * fN2 * tO2) / tN2;
    const bO2Coef = sO2 - (sN2 * tO2) / tN2;
    if (Math.abs(bO2Coef) < 1e-12) {
      if (aO2 < -1e-9) {
        hardInfeasible = 'Top-up gas is too rich in O₂ for the desired mix.';
      }
    } else if (bO2Coef > 0) {
      upperBounds.push(aO2 / bO2Coef);
    } else if (aO2 / bO2Coef > rho0 + 1e-9) {
      hardInfeasible = 'Not enough gas in the tank to reach this mix with the chosen top-up.';
    }

    // n_He ≥ 0  →  A_He − B_He·ρ_b ≥ 0
    const aHe = rhof * fHe - (rhof * fN2 * tHe) / tN2;
    const bHeCoef = sHe - (sN2 * tHe) / tN2;
    if (Math.abs(bHeCoef) < 1e-12) {
      if (aHe < -1e-9) {
        hardInfeasible = hardInfeasible ?? 'Top-up gas is too rich in He for the desired mix.';
      }
    } else if (bHeCoef > 0) {
      upperBounds.push(aHe / bHeCoef);
    } else if (aHe / bHeCoef > rho0 + 1e-9) {
      hardInfeasible =
        hardInfeasible ?? 'Not enough He in the tank to reach this mix with the chosen top-up.';
    }
  } else {
    // Top-up has no N₂ — the existing N₂ in the tank must exactly match the target.
    if (fN2 > 1e-9) {
      if (sN2 < 1e-9) {
        hardInfeasible = 'Top-up gas has no N₂ but the target mix needs N₂.';
      } else {
        const requiredRhoB = (rhof * fN2) / sN2;
        if (requiredRhoB > rho0 + 1e-9) {
          hardInfeasible = 'Not enough N₂ in the tank to reach this target with this top-up.';
        } else {
          upperBounds.push(requiredRhoB);
        }
      }
    }
  }

  if (hardInfeasible) {
    return failedResult(hardInfeasible);
  }

  const rhoMaxRaw = upperBounds.length > 0 ? Math.min(rho0, ...upperBounds) : rho0;
  const rhoB = Math.max(0, rhoMaxRaw);

  // Required additions in mol/L at the chosen ρ_b.
  const nT_raw = tN2 > 1e-9 ? (rhof * fN2 - rhoB * sN2) / tN2 : 0;
  const nO2_raw = rhof * fO2 - rhoB * sO2 - nT_raw * tO2;
  const nHe_raw = rhof * fHe - rhoB * sHe - nT_raw * tHe;

  if (nT_raw < -1e-6 || nO2_raw < -1e-6 || nHe_raw < -1e-6) {
    return failedResult('Target unreachable with these inputs.');
  }

  const nT = Math.max(0, nT_raw);
  const nO2 = Math.max(0, nO2_raw);
  const nHe = Math.max(0, nHe_raw);

  // Bleed-down pressure (the gauge reading the diver should hit before refilling).
  const Pbleed = rhoB < rho0 - 1e-9 ? pressureFromDensity(rhoB, T, sO2, sHe, sN2) : P0;
  const bleedBar = Math.max(0, P0 - Pbleed);

  // Walk the fill sequentially. After each addition we recompute the gauge
  // pressure from the new molar state using Van der Waals.
  let cO2 = rhoB * sO2;
  let cHe = rhoB * sHe;
  let cN2 = rhoB * sN2;
  let curP = Pbleed;

  const computeP = (no2: number, nhe: number, nn2: number): number => {
    const total = no2 + nhe + nn2;
    if (total <= 0) return 0;
    return pressureFromDensity(total, T, no2 / total, nhe / total, nn2 / total);
  };

  const steps: FillUpStep[] = [];

  if (bleedBar > 0.05) {
    steps.push({
      gas: 'Bleed',
      label: 'Bleed Tank',
      fromPressure: P0,
      toPressure: Pbleed,
      addedBar: bleedBar,
    });
  }

  const topUpLabel = topUpGasLabel(tO2, tHe);

  const addO2Step = (): number => {
    const before = curP;
    if (nO2 > 0) {
      cO2 += nO2;
      curP = computeP(cO2, cHe, cN2);
    }
    const delta = curP - before;
    steps.push({
      gas: 'O2',
      label: 'Pure O₂',
      fromPressure: before,
      toPressure: curP,
      addedBar: delta,
    });
    return delta;
  };

  const addHeStep = (): number => {
    const before = curP;
    if (nHe > 0) {
      cHe += nHe;
      curP = computeP(cO2, cHe, cN2);
    }
    const delta = curP - before;
    steps.push({
      gas: 'He',
      label: 'Pure He',
      fromPressure: before,
      toPressure: curP,
      addedBar: delta,
    });
    return delta;
  };

  const addTopUpStep = (): number => {
    const before = curP;
    if (nT > 0) {
      cO2 += nT * tO2;
      cHe += nT * tHe;
      cN2 += nT * tN2;
      curP = computeP(cO2, cHe, cN2);
    }
    const delta = curP - before;
    steps.push({
      gas: 'TopUp',
      label: topUpLabel,
      fromPressure: before,
      toPressure: curP,
      addedBar: delta,
    });
    return delta;
  };

  let addO2Bar: number;
  let addHeBar: number;
  let addTopUpBar: number;

  if (input.firstGas === 'He') {
    addHeBar = addHeStep();
    addO2Bar = addO2Step();
    addTopUpBar = addTopUpStep();
  } else {
    addO2Bar = addO2Step();
    addHeBar = addHeStep();
    addTopUpBar = addTopUpStep();
  }

  return {
    steps,
    addO2Bar,
    addHeBar,
    addTopUpBar,
    bleedBar,
    feasibility: { ok: true },
  };
}

function failedResult(reason: string): FillUpResult {
  return {
    steps: [],
    addO2Bar: 0,
    addHeBar: 0,
    addTopUpBar: 0,
    bleedBar: 0,
    feasibility: { ok: false, reason },
  };
}

/** Display label for the top-up gas based on its O₂/He composition. */
function topUpGasLabel(tO2: number, tHe: number): string {
  const o2Pct = Math.round(tO2 * 100);
  const hePct = Math.round(tHe * 100);
  if (hePct === 0 && Math.abs(tO2 - 0.21) < 0.005) return 'Air (21%)';
  if (hePct === 0) return `EAN${o2Pct}`;
  return `Trimix ${o2Pct}/${hePct}`;
}

// ---------------------------------------------------------------------------
// TOP-UP
// ---------------------------------------------------------------------------

interface TopUpInput {
  /** Pressure already in the tank (bar). */
  startPressure: number;
  /** Mix already in the tank (0-1 fractions). */
  startO2: number;
  startHe: number;
  /** Target pressure after topping up (bar). */
  endPressure: number;
  /** Top-up gas composition (0-1 fractions). */
  topUpO2: number;
  topUpHe: number;
}

export interface TopUpResult {
  /** Resulting fractions in the tank after the top-up. */
  finalFractions: MixerGasFractions;
  /** Final O₂ percentage (0-100). */
  finalO2Percent: number;
  /** Final He percentage (0-100). */
  finalHePercent: number;
  /** Final N₂ percentage (0-100). */
  finalN2Percent: number;
  /** Amount of top-up gas added (bar). */
  addedBar: number;
  /** Whether the operation is physically valid. */
  feasibility: FillUpFeasibility;
}

/**
 * Given an initial mix at a given pressure, compute the resulting mix after
 * adding a known top-up gas up to a final pressure.
 *
 * For each component (Dalton's law, isothermal & isochoric):
 *   f_final_i = (P₀·s_i + ΔT·t_i) / Pf,   ΔT = Pf − P₀
 */
export function calculateTopUp(input: TopUpInput): TopUpResult {
  const sO2 = clamp01(input.startO2);
  const sHe = clamp01(input.startHe);
  const tO2 = clamp01(input.topUpO2);
  const tHe = clamp01(input.topUpHe);

  const P0 = Math.max(0, input.startPressure);
  const Pf = Math.max(0, input.endPressure);

  if (input.startO2 + input.startHe > 1 + 1e-9) {
    return emptyTopUpResult('Starting O₂ + He cannot exceed 100%.');
  }
  if (input.topUpO2 + input.topUpHe > 1 + 1e-9) {
    return emptyTopUpResult('Top-up O₂ + He cannot exceed 100%.');
  }
  if (Pf <= P0) {
    return emptyTopUpResult('Final pressure must be greater than the starting pressure.');
  }

  const added = Pf - P0;
  const fO2 = (P0 * sO2 + added * tO2) / Pf;
  const fHe = (P0 * sHe + added * tHe) / Pf;
  const fN2 = Math.max(0, 1 - fO2 - fHe);

  return {
    finalFractions: { fO2, fHe, fN2 },
    finalO2Percent: fO2 * 100,
    finalHePercent: fHe * 100,
    finalN2Percent: fN2 * 100,
    addedBar: added,
    feasibility: { ok: true },
  };
}

function emptyTopUpResult(reason: string): TopUpResult {
  return {
    finalFractions: { fO2: 0, fHe: 0, fN2: 0 },
    finalO2Percent: 0,
    finalHePercent: 0,
    finalN2Percent: 0,
    addedBar: 0,
    feasibility: { ok: false, reason },
  };
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}
