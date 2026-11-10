import type { Vial } from '../types';

/** Mass units expressed in micrograms. Units not listed here (e.g. "units") cannot be converted. */
const MCG_PER_UNIT: Record<string, number> = {
  mg: 1000,
  mcg: 1,
  'µg': 1,
  ug: 1,
};

function normalizeUnit(unit: string | undefined | null): string {
  return (unit ?? '').trim().toLowerCase();
}

/** True when an amount in `from` can be expressed in `to`. */
export function areUnitsCompatible(from: string | undefined | null, to: string | undefined | null): boolean {
  return convertAmount(1, from, to) !== null;
}

/**
 * Convert an amount between medication units.
 * Identical units always convert (including "units" → "units").
 * mg ↔ mcg convert by a factor of 1000. Anything else returns null.
 */
export function convertAmount(
  value: number,
  from: string | undefined | null,
  to: string | undefined | null
): number | null {
  const f = normalizeUnit(from);
  const t = normalizeUnit(to);
  if (f === t) return value;
  const fFactor = MCG_PER_UNIT[f];
  const tFactor = MCG_PER_UNIT[t];
  if (fFactor === undefined || tFactor === undefined) return null;
  return (value * fFactor) / tFactor;
}

export interface InjectionCalculation {
  /** Dose expressed in the vial's peptide unit. */
  doseInVialUnit: number;
  /** Concentration of the reconstituted vial, in vial units per ml. */
  concentrationPerMl: number;
  /** Volume to draw, in ml. */
  volumeMl: number;
  /** Volume to draw on a U-100 insulin syringe (100 units = 1 ml). */
  insulinUnits: number;
}

/**
 * Work out how much to draw from a reconstituted vial for a dose.
 * Returns null when the vial has no diluent volume, the dose is not positive,
 * or the dose unit cannot be converted to the vial's unit.
 */
export function calculateInjection(
  doseAmount: number,
  doseUnit: string,
  vial: Pick<Vial, 'peptideAmount' | 'peptideUnit' | 'bacWaterAmount'>
): InjectionCalculation | null {
  if (!Number.isFinite(doseAmount) || doseAmount <= 0) return null;
  if (!(vial.bacWaterAmount > 0) || !(vial.peptideAmount > 0)) return null;
  const doseInVialUnit = convertAmount(doseAmount, doseUnit, vial.peptideUnit);
  if (doseInVialUnit === null) return null;
  const concentrationPerMl = vial.peptideAmount / vial.bacWaterAmount;
  const volumeMl = doseInVialUnit / concentrationPerMl;
  return {
    doseInVialUnit,
    concentrationPerMl,
    volumeMl,
    insulinUnits: Math.round(volumeMl * 100),
  };
}
