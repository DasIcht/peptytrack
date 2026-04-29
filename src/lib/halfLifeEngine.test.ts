import { describe, it, expect } from 'vitest';
import {
  concentrationAtTime,
  medicationLevelAtTime,
  generateLevelSeries,
  getNextDoseTime,
  getTimeUntilNextDose,
} from './halfLifeEngine';
import type { Medication, Dose } from '../types';

const TEST_MED: Medication = {
  id: 'test-med',
  templateId: 'semaglutide',
  name: 'Semaglutide',
  brand: 'Ozempic',
  activeIngredient: 'Semaglutide',
  dosageOptions: [0.25, 0.5, 1],
  unit: 'mg',
  frequency: 'weekly',
  halfLifeHours: 168,
  color: '#14b8a6',
  reminderHoursBefore: 24,
  enabled: true,
  createdAt: 0,
};

const TEST_MED_SHORT: Medication = {
  ...TEST_MED,
  id: 'test-med-short',
  halfLifeHours: 12,
  frequency: 'daily',
};

describe('concentrationAtTime', () => {
  it('returns full concentration at t=0', () => {
    expect(concentrationAtTime(1, 168, 0)).toBe(1);
  });

  it('returns half concentration after one half-life', () => {
    expect(concentrationAtTime(1, 168, 168)).toBeCloseTo(0.5, 5);
  });

  it('returns quarter concentration after two half-lives', () => {
    expect(concentrationAtTime(1, 168, 336)).toBeCloseTo(0.25, 5);
  });

  it('returns 0 for negative time', () => {
    expect(concentrationAtTime(1, 168, -1)).toBe(0);
  });

  it('approaches 0 after many half-lives', () => {
    expect(concentrationAtTime(1, 168, 168 * 10)).toBeCloseTo(0.001, 3);
  });
});

describe('medicationLevelAtTime', () => {
  it('sums multiple overlapping doses correctly', () => {
    const now = Date.now();
    const doses: Dose[] = [
      {
        id: 'd1',
        medicationId: 'test-med',
        dosage: 1,
        unit: 'mg',
        injectionSite: 'abdomen-upper-left',
        dateTime: now - 7 * 24 * 60 * 60 * 1000, // 7 days ago
        notes: '',
        createdAt: 0,
      },
      {
        id: 'd2',
        medicationId: 'test-med',
        dosage: 1,
        unit: 'mg',
        injectionSite: 'abdomen-upper-right',
        dateTime: now,
        notes: '',
        createdAt: 0,
      },
    ];

    const level = medicationLevelAtTime(TEST_MED, doses, now);
    // At time=now, d2 contributes 1.0 (just taken), d1 contributes 0.5 (one half-life ago)
    expect(level).toBeCloseTo(1.5, 5);
  });

  it('ignores doses from other medications', () => {
    const now = Date.now();
    const doses: Dose[] = [
      {
        id: 'd1',
        medicationId: 'other-med',
        dosage: 10,
        unit: 'mg',
        injectionSite: 'abdomen-upper-left',
        dateTime: now,
        notes: '',
        createdAt: 0,
      },
    ];

    expect(medicationLevelAtTime(TEST_MED, doses, now)).toBe(0);
  });
});

describe('generateLevelSeries', () => {
  it('generates a series with decreasing levels between doses', () => {
    const now = Date.now();
    const doses: Dose[] = [
      {
        id: 'd1',
        medicationId: 'test-med-short',
        dosage: 1,
        unit: 'mg',
        injectionSite: 'abdomen-upper-left',
        dateTime: now - 24 * 60 * 60 * 1000,
        notes: '',
        createdAt: 0,
      },
    ];

    const series = generateLevelSeries(TEST_MED_SHORT, doses, {
      startTime: now - 24 * 60 * 60 * 1000,
      endTime: now,
      resolutionMinutes: 360,
    });

    expect(series.length).toBeGreaterThan(0);
    expect(series[0].level).toBeGreaterThan(series[series.length - 1].level);
  });

  it('marks dose events correctly', () => {
    const now = Date.now();
    const doses: Dose[] = [
      {
        id: 'd1',
        medicationId: 'test-med',
        dosage: 1,
        unit: 'mg',
        injectionSite: 'abdomen-upper-left',
        dateTime: now,
        notes: '',
        createdAt: 0,
      },
    ];

    const series = generateLevelSeries(TEST_MED, doses, {
      startTime: now,
      endTime: now + 60 * 60 * 1000,
      resolutionMinutes: 60,
    });

    const dosePoint = series.find((p) => p.doseEvents && p.doseEvents.length > 0);
    expect(dosePoint).toBeDefined();
    expect(dosePoint!.doseEvents![0].dosage).toBe(1);
  });
});

describe('getNextDoseTime', () => {
  it('returns null when no doses exist', () => {
    expect(getNextDoseTime(TEST_MED, [])).toBeNull();
  });

  it('returns correct next dose for weekly medication', () => {
    const now = Date.now();
    const doses: Dose[] = [
      {
        id: 'd1',
        medicationId: 'test-med',
        dosage: 1,
        unit: 'mg',
        injectionSite: 'abdomen-upper-left',
        dateTime: now,
        notes: '',
        createdAt: 0,
      },
    ];

    const next = getNextDoseTime(TEST_MED, doses);
    expect(next).not.toBeNull();
    expect(next!.getTime()).toBe(now + 7 * 24 * 60 * 60 * 1000);
  });

  it('returns correct next dose for daily medication', () => {
    const now = Date.now();
    const doses: Dose[] = [
      {
        id: 'd1',
        medicationId: 'test-med-short',
        dosage: 1,
        unit: 'mg',
        injectionSite: 'abdomen-upper-left',
        dateTime: now,
        notes: '',
        createdAt: 0,
      },
    ];

    const next = getNextDoseTime(TEST_MED_SHORT, doses);
    expect(next).not.toBeNull();
    expect(next!.getTime()).toBe(now + 24 * 60 * 60 * 1000);
  });
});

describe('getTimeUntilNextDose', () => {
  it('returns "Not started" when no doses', () => {
    expect(getTimeUntilNextDose(TEST_MED, [])).toBe('Not started');
  });

  it('returns "Overdue" when past due', () => {
    const now = Date.now();
    const doses: Dose[] = [
      {
        id: 'd1',
        medicationId: 'test-med-short',
        dosage: 1,
        unit: 'mg',
        injectionSite: 'abdomen-upper-left',
        dateTime: now - 25 * 60 * 60 * 1000, // 25h ago (daily med)
        notes: '',
        createdAt: 0,
      },
    ];

    expect(getTimeUntilNextDose(TEST_MED_SHORT, doses)).toBe('Overdue');
  });

  it('returns days and hours for future dose', () => {
    const now = Date.now();
    const doses: Dose[] = [
      {
        id: 'd1',
        medicationId: 'test-med',
        dosage: 1,
        unit: 'mg',
        injectionSite: 'abdomen-upper-left',
        dateTime: now,
        notes: '',
        createdAt: 0,
      },
    ];

    const result = getTimeUntilNextDose(TEST_MED, doses);
    expect(result).toMatch(/\d+d/);
  });
});
