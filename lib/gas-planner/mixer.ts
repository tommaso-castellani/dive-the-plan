/**
 * Gas Mixer — partial-pressure blending calculations.
 *
 * Two operations:
 *  - Fill-up: from a starting (possibly empty) tank with a known gas, compute
 *    the amounts of pure O₂, pure He, and a top-up gas (e.g. air or EAN32)
 *    needed to reach a target pressure with a target mix.
 *  - Top-up: from a known starting mix & pressure, adding a known top-up gas
 *    up to a target pressure, compute the resulting mix.
 *
 * Both use Dalton's law of partial pressures at constant temperature & volume:
 *   For each component i:  n_i ∝ f_i · P
 *
 * Conventions:
 *  - Pressures in bar (gauge/absolute treated consistently — math is identical
 *    because we only deal with differences and ratios)
 *  - Gas fractions as decimals (0.21 = 21%)
 *  - Ambient temperature is captured for reference (e.g. cold-tank target);
 *    partial-pressure blending is treated as isothermal — temperature does
 *    not enter the proportion math.
 */

export type FillFirstGas = 'O2' | 'He';

export interface MixerGasFractions {
  fO2: number;
  fHe: number;
  fN2: number;
}

// ---------------------------------------------------------------------------
// FILL-UP
// ---------------------------------------------------------------------------

export interface FillUpInput {
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
}

export interface FillUpStep {
  /** Identifier for the gas being added in this step. */
  gas: 'O2' | 'He' | 'TopUp';
  /** Human label for display. */
  label: string;
  /** Gauge reading before this step begins (bar). */
  fromPressure: number;
  /** Gauge reading after this step ends (bar). */
  toPressure: number;
  /** Amount of this gas added (bar). Always ≥ 0 when feasible. */
  addedBar: number;
}

export type FillUpFeasibility =
  | { ok: true }
  | { ok: false; reason: string };

export interface FillUpResult {
  /** Three ordered fill steps. */
  steps: FillUpStep[];
  /** Pure O₂ to add (bar). */
  addO2Bar: number;
  /** Pure He to add (bar). */
  addHeBar: number;
  /** Top-up gas to add (bar). */
  addTopUpBar: number;
  /** Whether the requested target is physically achievable from the start. */
  feasibility: FillUpFeasibility;
}

/**
 * Compute the fill plan to go from the starting state to the target mix &
 * pressure using pure O₂, pure He, and a top-up gas.
 *
 * The system is fully determined by conservation of each component:
 *   O₂:  P₀·sO₂ + ΔO₂        + ΔT·tO₂ = Pf·fO₂
 *   He:  P₀·sHe        + ΔHe + ΔT·tHe = Pf·fHe
 *   N₂:  P₀·sN₂              + ΔT·tN₂ = Pf·fN₂
 *
 * From the N₂ equation (the top-up is the only N₂ source we add):
 *   ΔT = (Pf·fN₂ − P₀·sN₂) / tN₂
 * Then ΔO₂ and ΔHe follow directly.
 */
export function calculateFillUp(input: FillUpInput): FillUpResult {
  // Normalize / clamp fractions.
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

  // Basic feasibility: must be adding gas.
  if (Pf <= P0) {
    return failedResult(P0, 'End pressure must be greater than start pressure.');
  }

  // If start mix is invalid (sum > 1), bail.
  if (input.startO2 + input.startHe > 1 + 1e-9) {
    return failedResult(P0, 'Starting O₂ + He cannot exceed 100%.');
  }
  if (input.finalO2 + input.finalHe > 1 + 1e-9) {
    return failedResult(P0, 'Final O₂ + He cannot exceed 100%.');
  }
  if (input.topUpO2 + input.topUpHe > 1 + 1e-9) {
    return failedResult(P0, 'Top-up O₂ + He cannot exceed 100%.');
  }

  // Solve for ΔT from N₂ conservation.
  const targetN2Moles = Pf * fN2;
  const startN2Moles = P0 * sN2;
  const neededN2 = targetN2Moles - startN2Moles;

  let addTopUpBar: number;

  if (tN2 < 1e-9) {
    // Top-up gas has (effectively) no N₂. The N₂ already in the tank must
    // exactly match the target — otherwise no amount of top-up can correct it.
    if (Math.abs(neededN2) > 1e-6) {
      return failedResult(
        P0,
        'Top-up gas has no N₂, so the existing N₂ in the tank already fixes the final mix — pick a different top-up gas.'
      );
    }
    // With no N₂ in either side, the top-up amount is whatever balance is
    // left after pure O₂ + He additions. We'll solve via the pressure
    // equation instead. For simplicity we set addTopUpBar = 0 and let the
    // remaining pressure be filled by pure gases.
    addTopUpBar = 0;
  } else {
    addTopUpBar = neededN2 / tN2;
  }

  const addO2Bar = Pf * fO2 - P0 * sO2 - addTopUpBar * tO2;
  const addHeBar = Pf * fHe - P0 * sHe - addTopUpBar * tHe;

  // Pressure-balance sanity check (within floating tolerance).
  const totalAdded = addO2Bar + addHeBar + addTopUpBar;
  const expectedAdded = Pf - P0;
  if (Math.abs(totalAdded - expectedAdded) > 1e-3) {
    return failedResult(P0, 'Could not balance the fill — check your inputs.');
  }

  // Feasibility: each component must be non-negative.
  if (addO2Bar < -1e-6) {
    return failedResult(
      P0,
      'Cannot reach this mix — starting O₂ + top-up O₂ already exceed the target. Try a leaner top-up gas or drain the tank first.'
    );
  }
  if (addHeBar < -1e-6) {
    return failedResult(
      P0,
      'Cannot reach this mix — starting He already exceeds the target. Drain the tank first.'
    );
  }
  if (addTopUpBar < -1e-6) {
    return failedResult(
      P0,
      'Cannot reach this mix — the existing N₂ already exceeds the target. Drain the tank or pick a richer top-up gas.'
    );
  }

  // Round trivially negative values to 0 (floating-point noise).
  const dO2 = Math.max(0, addO2Bar);
  const dHe = Math.max(0, addHeBar);
  const dTop = Math.max(0, addTopUpBar);

  // Build the ordered fill steps.
  const topUpLabel = topUpGasLabel(tO2, tHe);
  const steps: FillUpStep[] = [];

  if (input.firstGas === 'O2') {
    const x = P0 + dO2;
    const y = x + dHe;
    steps.push({ gas: 'O2', label: 'Pure O₂', fromPressure: P0, toPressure: x, addedBar: dO2 });
    steps.push({ gas: 'He', label: 'Pure He', fromPressure: x, toPressure: y, addedBar: dHe });
    steps.push({ gas: 'TopUp', label: topUpLabel, fromPressure: y, toPressure: Pf, addedBar: dTop });
  } else {
    const x = P0 + dHe;
    const y = x + dO2;
    steps.push({ gas: 'He', label: 'Pure He', fromPressure: P0, toPressure: x, addedBar: dHe });
    steps.push({ gas: 'O2', label: 'Pure O₂', fromPressure: x, toPressure: y, addedBar: dO2 });
    steps.push({ gas: 'TopUp', label: topUpLabel, fromPressure: y, toPressure: Pf, addedBar: dTop });
  }

  return {
    steps,
    addO2Bar: dO2,
    addHeBar: dHe,
    addTopUpBar: dTop,
    feasibility: { ok: true },
  };
}

function failedResult(startPressure: number, reason: string): FillUpResult {
  return {
    steps: [],
    addO2Bar: 0,
    addHeBar: 0,
    addTopUpBar: 0,
    feasibility: { ok: false, reason },
  };
}

/** Display label for the top-up gas based on its O₂/He composition. */
function topUpGasLabel(tO2: number, tHe: number): string {
  const o2Pct = Math.round(tO2 * 100);
  const hePct = Math.round(tHe * 100);
  // Air ≈ 21% O₂, 0% He.
  if (hePct === 0 && Math.abs(tO2 - 0.21) < 0.005) return 'Air (21%)';
  if (hePct === 0) return `EAN${o2Pct}`;
  return `Trimix ${o2Pct}/${hePct}`;
}

// ---------------------------------------------------------------------------
// TOP-UP
// ---------------------------------------------------------------------------

export interface TopUpInput {
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
 * For each component:
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
