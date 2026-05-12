/**
 * Shared default values for the Gas Planner tabs.
 *
 * These are intentionally centralized so that all three tabs (Best Mix,
 * Gas Check, MOD Check) stay consistent and a single edit propagates
 * everywhere.
 *
 * Note: gas composition (O₂/He) and depth are *not* defaulted here —
 * those are dive-specific and must always be entered by the user.
 */

import type { DivingMode } from './calculations';

export const GAS_PLANNER_DEFAULTS = {
  /** Max ppO₂ for open-circuit diving (bar). */
  ocPpO2: 1.4,
  /** Default setpoint / diluent ppO₂ for CCR diving (bar). */
  ccrSetpoint: 1.1,
  /** Target Equivalent Narcotic Depth (m). */
  targetEND: 30,
  /** Max allowed gas density (g/L). */
  maxDensity: 5.2,
  /** Default water temperature (°C). */
  waterTemp: 20,
} as const;

/**
 * Mode-aware ppO₂ default.
 *
 * - OC: Max working ppO₂ at depth.
 * - CCR: Loop setpoint / diluent ppO₂.
 */
export function defaultPpO2(mode: DivingMode): number {
  return mode === 'OC' ? GAS_PLANNER_DEFAULTS.ocPpO2 : GAS_PLANNER_DEFAULTS.ccrSetpoint;
}
