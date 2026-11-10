import { describe, it, expect } from 'vitest';
import { convertAmount, areUnitsCompatible, calculateInjection } from './units';

describe('convertAmount', () => {
  it('returns the same value for identical units', () => {
    expect(convertAmount(2.5, 'mg', 'mg')).toBe(2.5);
    expect(convertAmount(10, 'units', 'units')).toBe(10);
  });

  it('converts between mg and mcg', () => {
    expect(convertAmount(1, 'mg', 'mcg')).toBe(1000);
    expect(convertAmount(250, 'mcg', 'mg')).toBe(0.25);
  });

  it('is case and whitespace insensitive and accepts µg/ug', () => {
    expect(convertAmount(1, ' MG ', 'mcg')).toBe(1000);
    expect(convertAmount(500, 'µg', 'mg')).toBe(0.5);
    expect(convertAmount(500, 'ug', 'mg')).toBe(0.5);
  });

  it('returns null for units that cannot be converted', () => {
    expect(convertAmount(1, 'units', 'mg')).toBeNull();
    expect(convertAmount(1, 'mg', 'units')).toBeNull();
    expect(areUnitsCompatible('units', 'mcg')).toBe(false);
    expect(areUnitsCompatible('mg', 'mcg')).toBe(true);
  });
});

describe('calculateInjection', () => {
  const mgVial = { peptideAmount: 5, peptideUnit: 'mg', bacWaterAmount: 2 }; // 2.5 mg/ml

  it('calculates volume and U-100 units when units match', () => {
    const r = calculateInjection(0.5, 'mg', mgVial)!;
    expect(r.concentrationPerMl).toBe(2.5);
    expect(r.volumeMl).toBeCloseTo(0.2);
    expect(r.insulinUnits).toBe(20);
  });

  it('converts a mcg dose drawn from a mg vial', () => {
    // 500 mcg = 0.5 mg -> 0.2 ml -> 20 units (previously computed as 20,000 units)
    const r = calculateInjection(500, 'mcg', mgVial)!;
    expect(r.doseInVialUnit).toBeCloseTo(0.5);
    expect(r.volumeMl).toBeCloseTo(0.2);
    expect(r.insulinUnits).toBe(20);
  });

  it('converts a mg dose drawn from a mcg vial', () => {
    const mcgVial = { peptideAmount: 5000, peptideUnit: 'mcg', bacWaterAmount: 2 };
    const r = calculateInjection(0.5, 'mg', mcgVial)!;
    expect(r.doseInVialUnit).toBe(500);
    expect(r.insulinUnits).toBe(20);
  });

  it('returns null when units are incompatible', () => {
    expect(calculateInjection(10, 'units', mgVial)).toBeNull();
  });

  it('returns null for non-positive or invalid doses and empty vials', () => {
    expect(calculateInjection(0, 'mg', mgVial)).toBeNull();
    expect(calculateInjection(-1, 'mg', mgVial)).toBeNull();
    expect(calculateInjection(NaN, 'mg', mgVial)).toBeNull();
    expect(calculateInjection(1, 'mg', { ...mgVial, bacWaterAmount: 0 })).toBeNull();
    expect(calculateInjection(1, 'mg', { ...mgVial, peptideAmount: 0 })).toBeNull();
  });
});
