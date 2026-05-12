/**
 * Gas Planner Calculations.
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

/** Reference nitrogen fraction in air, used for the N₂-only END convention. */
const AIR_N2_FRACTION = 0.79;

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
function calculatePartialPressures(fractions: GasFractions, depthMeters: number): PartialPressures {
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
 * Equivalent Narcotic Depth (m) — N₂-only convention.
 *
 * The depth at which air would produce the same ppN₂ as the breathing
 * gas at the current depth. Oxygen is NOT considered narcotic here.
 *
 *   ppN₂(depth)        = fN₂ * (depth/10 + 1)
 *   ppN₂_air(END)      = 0.79 * (END/10 + 1)
 *   solving for END:
 *   END = (depth + 10) * fN₂ / 0.79 - 10
 *
 * This is the Bühlmann / traditional convention. (Subsurface and a few
 * other tools default to the alternative "O₂-is-narcotic" formula.)
 */
function calculateEND(fN2: number, depthMeters: number): number {
  const end = ((depthMeters + METERS_PER_BAR) * fN2) / AIR_N2_FRACTION - METERS_PER_BAR;
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
 * Maximum Operating Depth from a target END (with the given fN₂).
 *
 * Inverse of the N₂-only END formula:
 *   END = (depth + 10) * fN₂ / 0.79 - 10
 *   =>  depth = (END + 10) * 0.79 / fN₂ - 10
 */
function calculateMODByEND(fN2: number, targetENDMeters: number): number {
  if (fN2 <= 0) return Infinity;
  return ((targetENDMeters + METERS_PER_BAR) * AIR_N2_FRACTION) / fN2 - METERS_PER_BAR;
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

// ---------------------------------------------------------------------------
// MOD CHECK
// ---------------------------------------------------------------------------

interface MODCheckInput {
  /** Oxygen fraction of the breathing gas (0-1) */
  fO2: number;
  /** Helium fraction of the breathing gas (0-1) */
  fHe: number;
  /** Maximum acceptable ppO2 (bar) */
  targetPpO2: number;
  /** Maximum acceptable Equivalent Narcotic Depth (m) */
  targetEND: number;
  /** Maximum acceptable gas density (g/L) */
  targetDensity: number;
  /** Water temperature in Celsius (used for density calc) */
  waterTemp: number;
}

export type MODLimiter = 'ppO2' | 'END' | 'density';

export interface MODCheckResult {
  /** Echoed gas fractions for convenience */
  fractions: GasFractions;
  /** MOD imposed by the ppO2 limit (m) */
  modByPpO2: number;
  /** MOD imposed by the END limit (m) */
  modByEND: number;
  /** MOD imposed by the gas-density limit (m) */
  modByDensity: number;
  /** Smallest of the three MODs — the actual operational limit (m) */
  limitingMOD: number;
  /** Which input limit is the binding constraint */
  limiter: MODLimiter;
}

/**
 * For a given breathing gas, compute the MOD imposed independently by
 * ppO2, END and gas-density limits. The smallest of the three is the
 * effective MOD; the corresponding constraint is the limiter.
 */
export function calculateMODCheck(input: MODCheckInput): MODCheckResult {
  const fO2 = Math.max(0, Math.min(1, input.fO2));
  const fHe = Math.max(0, Math.min(1 - fO2, input.fHe));
  const fN2 = Math.max(0, 1 - fO2 - fHe);
  const fractions: GasFractions = { fO2, fHe, fN2 };

  const modByPpO2 = Math.max(0, calculateMODByPpO2(fO2, input.targetPpO2));
  const modByEND = Math.max(0, calculateMODByEND(fN2, input.targetEND));
  const modByDensity = Math.max(
    0,
    calculateMODByDensity(fractions, input.targetDensity, input.waterTemp)
  );

  // Pick the lowest as the limiting depth.
  const candidates: { value: number; limiter: MODLimiter }[] = [
    { value: modByPpO2, limiter: 'ppO2' },
    { value: modByEND, limiter: 'END' },
    { value: modByDensity, limiter: 'density' },
  ];
  const limiting = candidates.reduce((acc, cur) => (cur.value < acc.value ? cur : acc));

  return {
    fractions,
    modByPpO2,
    modByEND,
    modByDensity,
    limitingMOD: limiting.value,
    limiter: limiting.limiter,
  };
}

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
  const endAtDepth = calculateEND(fN2, depth);

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

  // Best fHe to keep END <= target (N₂-only convention).
  // From: END = (depth + 10) * fN₂ / 0.79 - 10
  //   END <= targetEND  =>  fN₂ <= (targetEND + 10) * 0.79 / (depth + 10)
  //   fHe = 1 - fO2 - fN2
  // If the allowed fN₂ is already >= the current fN₂ (i.e. 1 - fO2),
  // no helium is needed.
  const maxFN2 = ((targetEND + METERS_PER_BAR) * AIR_N2_FRACTION) / (depth + METERS_PER_BAR);
  let fHe = Math.max(0, 1 - fO2 - maxFN2);
  fHe = Math.min(1 - fO2, fHe);

  const fN2 = Math.max(0, 1 - fO2 - fHe);

  const fractions: GasFractions = { fO2, fHe, fN2 };

  // Operational metrics for the resulting mix
  const partialPressures = calculatePartialPressures(fractions, depth);
  const densityAtDepth = calculateGasDensity(fractions, depth, waterTemp);
  const endAtDepth = calculateEND(fN2, depth);

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
    modByEND: calculateMODByEND(fN2, targetEND),
  };
}
