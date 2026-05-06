/**
 * Gas Planner Calculations
 *
 * Open-source technical diving calculations for trimix/nitrox blending,
 * gas density, equivalent narcotic depth (END), partial pressures, and MOD.
 *
 * References & inspirations:
 * - Subsurface dive log open-source formulas
 * - Anthony, R., & Mitchell, S. J. (2016) — recommended gas density limit (~5.2 g/L)
 * - Standard recreational/technical diving partial pressure formulas
 *
 * Conventions:
 *  - Depth in meters (msw)
 *  - Pressure in bar (1 bar at surface)
 *  - Temperature in Celsius (converted to Kelvin internally)
 *  - Gas fractions as decimals (0.21 = 21%)
 *  - Density in g/L
 */

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

/** Density of pure gases at standard temperature & pressure (0°C, 1 atm) in g/L. */
const GAS_DENSITY_STP = {
  O2: 1.4291,
  N2: 1.2506,
  He: 0.1786,
} as const;

/** Standard reference temperature in Kelvin (0°C). */
const STP_TEMP_K = 273.15;

/** Conversion: 1 bar increase per 10 meters of seawater. */
const METERS_PER_BAR = 10;

// ---------------------------------------------------------------------------
// PRIMITIVES
// ---------------------------------------------------------------------------

/** Convert depth (m) to absolute pressure (bar). Surface = 1 bar. */
function depthToAbsPressure(depthMeters: number): number {
  return depthMeters / METERS_PER_BAR + 1;
}

/** Convert absolute pressure (bar) back to depth (m). */
function absPressureToDepth(pressureBar: number): number {
  return (pressureBar - 1) * METERS_PER_BAR;
}

/** Convert Celsius to Kelvin. */
function celsiusToKelvin(c: number): number {
  return c + 273.15;
}

// ---------------------------------------------------------------------------
// PARTIAL PRESSURES
// ---------------------------------------------------------------------------

interface GasFractions {
  fO2: number;
  fHe: number;
  fN2: number;
}

interface PartialPressures {
  ppO2: number;
  ppHe: number;
  ppN2: number;
}

/**
 * Compute partial pressures of each gas component at a given depth.
 * pp_i = f_i * P_abs
 */
function calculatePartialPressures(
  fractions: GasFractions,
  depthMeters: number
): PartialPressures {
  const pAbs = depthToAbsPressure(depthMeters);
  return {
    ppO2: fractions.fO2 * pAbs,
    ppHe: fractions.fHe * pAbs,
    ppN2: fractions.fN2 * pAbs,
  };
}

// ---------------------------------------------------------------------------
// GAS DENSITY
// ---------------------------------------------------------------------------

/**
 * Gas density (g/L) at depth & water temperature, using ideal-gas scaling:
 *   ρ(T, P) = ρ_stp * P * (T_stp / T)
 * Mixture density is the mole-fraction weighted sum of component densities.
 */
function calculateGasDensity(
  fractions: GasFractions,
  depthMeters: number,
  waterTempCelsius: number
): number {
  const pAbs = depthToAbsPressure(depthMeters);
  const tempK = celsiusToKelvin(waterTempCelsius);
  const tempScale = STP_TEMP_K / tempK;

  const mixtureStpDensity =
    fractions.fO2 * GAS_DENSITY_STP.O2 +
    fractions.fHe * GAS_DENSITY_STP.He +
    fractions.fN2 * GAS_DENSITY_STP.N2;

  return mixtureStpDensity * pAbs * tempScale;
}

// ---------------------------------------------------------------------------
// END (Equivalent Narcotic Depth)
// ---------------------------------------------------------------------------

/**
 * Equivalent Narcotic Depth (m), treating O2 as equally narcotic to N2.
 *   END = (depth + 10) * (1 - fHe) - 10
 *
 * This is the standard technical-diving formulation also used by Subsurface,
 * MultiDeco, and most blending calculators.
 */
function calculateEND(fHe: number, depthMeters: number): number {
  const end = (depthMeters + METERS_PER_BAR) * (1 - fHe) - METERS_PER_BAR;
  return Math.max(0, end);
}

// ---------------------------------------------------------------------------
// MOD CALCULATIONS
// ---------------------------------------------------------------------------

/**
 * Maximum Operating Depth from a ppO2 limit.
 *   MOD = (ppO2_limit / fO2 - 1) * 10
 */
function calculateMODByPpO2(fO2: number, ppO2Limit: number): number {
  if (fO2 <= 0) return Infinity;
  return absPressureToDepth(ppO2Limit / fO2);
}

/**
 * Maximum Operating Depth from a target END (with the given fHe).
 *   MOD = (target_end + 10) / (1 - fHe) - 10
 */
function calculateMODByEND(fHe: number, targetENDMeters: number): number {
  if (fHe >= 1) return Infinity;
  return (targetENDMeters + METERS_PER_BAR) / (1 - fHe) - METERS_PER_BAR;
}

/**
 * Maximum Operating Depth from a gas-density limit (g/L) at given temperature.
 * Solves ρ_max for depth:
 *   P_abs_max = ρ_max / (ρ_mix_stp * (T_stp / T))
 *   MOD      = (P_abs_max - 1) * 10
 */
function calculateMODByDensity(
  fractions: GasFractions,
  densityLimitGramsPerLiter: number,
  waterTempCelsius: number
): number {
  const tempK = celsiusToKelvin(waterTempCelsius);
  const tempScale = STP_TEMP_K / tempK;

  const mixtureStpDensity =
    fractions.fO2 * GAS_DENSITY_STP.O2 +
    fractions.fHe * GAS_DENSITY_STP.He +
    fractions.fN2 * GAS_DENSITY_STP.N2;

  if (mixtureStpDensity <= 0) return Infinity;

  const pAbsMax = densityLimitGramsPerLiter / (mixtureStpDensity * tempScale);
  return absPressureToDepth(pAbsMax);
}

// ---------------------------------------------------------------------------
// BEST MIX
// ---------------------------------------------------------------------------

export type DivingMode = 'OC' | 'CCR';

interface BestMixInput {
  mode: DivingMode;
  /** Target depth in meters */
  depth: number;
  /**
   * For OC: maximum acceptable ppO2 (typically 1.4 working / 1.6 deco)
   * For CCR: diluent ppO2 (typically 1.0 - 1.3)
   */
  ppO2: number;
  /** Target Equivalent Narcotic Depth in meters (typically 30m) */
  targetEND: number;
  /** Water temperature in Celsius */
  waterTemp: number;
  /** Density limit in g/L. Required for CCR; defaults to 5.2 g/L for OC. */
  maxDensity?: number;
}

export interface BestMixResult {
  fractions: GasFractions;
  /** Best O2 percentage (0-100) */
  bestO2Percent: number;
  /** Best He percentage (0-100) */
  bestHePercent: number;
  /** Resulting N2 percentage (0-100) */
  n2Percent: number;
  /** Density of the resulting mix at target depth (g/L) */
  densityAtDepth: number;
  /** Partial pressures of the resulting mix at target depth */
  partialPressures: PartialPressures;
  /** END of the resulting mix at target depth (m) */
  endAtDepth: number;
  /** MOD by ppO2 limit (m) */
  modByPpO2: number;
  /** MOD by density limit (m) */
  modByDensity: number;
  /** MOD by target END (m) */
  modByEND: number;
}

const DEFAULT_DENSITY_LIMIT = 5.2;

// ---------------------------------------------------------------------------
// GAS CHECK
// ---------------------------------------------------------------------------

interface GasCheckInput {
  mode: DivingMode;
  /** Target depth in meters */
  depth: number;
  /** Water temperature in Celsius */
  waterTemp: number;
  /** Oxygen fraction (0-1) */
  fO2: number;
  /** Helium fraction (0-1). Defaults to 0 (nitrox / air). */
  fHe?: number;
}

export interface GasCheckResult {
  fractions: GasFractions;
  /** O2 percentage (0-100) */
  o2Percent: number;
  /** He percentage (0-100) */
  hePercent: number;
  /** N2 percentage (0-100) */
  n2Percent: number;
  /** Partial pressures of the mix at depth */
  partialPressures: PartialPressures;
  /** Density of the mix at depth (g/L) */
  densityAtDepth: number;
  /** Equivalent Narcotic Depth at depth (m) */
  endAtDepth: number;
}

/**
 * Verify the operational metrics of a known gas at a target depth.
 * Returns ppO2 (or diluent ppO2 for CCR), ppN2, ppHe, gas density and END.
 */
export function calculateGasCheck(input: GasCheckInput): GasCheckResult {
  const { depth, waterTemp } = input;

  // Clamp & normalize the input fractions so that fO2 + fHe + fN2 == 1.
  const fO2 = Math.min(1, Math.max(0, input.fO2));
  const rawFHe = input.fHe ?? 0;
  const fHe = Math.min(1 - fO2, Math.max(0, rawFHe));
  const fN2 = Math.max(0, 1 - fO2 - fHe);

  const fractions: GasFractions = { fO2, fHe, fN2 };

  const partialPressures = calculatePartialPressures(fractions, depth);
  const densityAtDepth = calculateGasDensity(fractions, depth, waterTemp);
  const endAtDepth = calculateEND(fHe, depth);

  return {
    fractions,
    o2Percent: fO2 * 100,
    hePercent: fHe * 100,
    n2Percent: fN2 * 100,
    partialPressures,
    densityAtDepth,
    endAtDepth,
  };
}

/**
 * Compute the optimal mix for a target depth that:
 *   1. Hits the requested ppO2 (max for OC, diluent for CCR)
 *   2. Keeps END at or below the target
 *   3. Yields acceptable gas density at depth
 */
export function calculateBestMix(input: BestMixInput): BestMixResult {
  const { depth, ppO2, targetEND, waterTemp } = input;
  const densityLimit = input.maxDensity ?? DEFAULT_DENSITY_LIMIT;

  const pAbs = depthToAbsPressure(depth);

  // Best fO2 is bounded by the ppO2 limit at depth.
  // OC: this is the maximum ppO2 the diver will breathe.
  // CCR: this is the diluent ppO2 (the gas inside the loop pre-dilution)
  const rawFO2 = ppO2 / pAbs;
  // Clamp into a sensible range. We don't allow > 1.0 (pure O2) or < 0.
  const fO2 = Math.min(1, Math.max(0, rawFO2));

  // Best fHe to keep END <= target.
  // From: END = (depth + 10)*(1 - fHe) - 10
  // Solve for fHe when END == targetEND:
  //   fHe = (depth - targetEND) / (depth + 10)
  // Clamped: if target END >= depth, no helium needed.
  // Also ensure fO2 + fHe <= 1.
  let fHe = 0;
  if (depth > targetEND) {
    fHe = (depth - targetEND) / (depth + METERS_PER_BAR);
  }
  fHe = Math.max(0, Math.min(1 - fO2, fHe));

  const fN2 = Math.max(0, 1 - fO2 - fHe);

  const fractions: GasFractions = { fO2, fHe, fN2 };

  // Operational metrics for the resulting mix
  const partialPressures = calculatePartialPressures(fractions, depth);
  const densityAtDepth = calculateGasDensity(fractions, depth, waterTemp);
  const endAtDepth = calculateEND(fHe, depth);

  return {
    fractions,
    bestO2Percent: fO2 * 100,
    bestHePercent: fHe * 100,
    n2Percent: fN2 * 100,
    densityAtDepth,
    partialPressures,
    endAtDepth,
    modByPpO2: calculateMODByPpO2(fO2, ppO2),
    modByDensity: calculateMODByDensity(fractions, densityLimit, waterTemp),
    modByEND: calculateMODByEND(fHe, targetEND),
  };
}
