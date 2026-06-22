import { describe, it, expect } from 'vitest';
import { calculateTitrationMetrics, evaluateTitration } from './titrationAnalytics';
import type { Protocol, Dose, Medication } from '../types';

// Reproduce the backup data scenario to validate the steady-state time-progress bug.
// The bug: calculateTitrationMetrics() uses the current step start date as the
// lower bound for counting days-at-target, ignoring that the concentration is a
// continuous function of *all* historical doses. If the user was already at/near
// target before the step began, the progress should reflect that.

// Medication from backup: Tirzepatide, halfLifeHours: 120, weekly frequency.
const tirzepatide: Medication = {
  id: '09e4d8b0-ad64-43c9-acd7-1807d6510841',
  templateId: 'tirzepatide',
  name: 'Tirzepatide',
  brand: 'Mounjaro / Zepbound',
  activeIngredient: 'Tirzepatide',
  dosageOptions: [2.5, 5, 7.5, 10, 12.5, 15],
  unit: 'mg',
  frequency: 'weekly',
  halfLifeHours: 120,
  color: '#f59e0b',
  reminderHoursBefore: 24,
  enabled: true,
  createdAt: 1777488804936
};

// Doses from backup (sorted chronologically by dateTime)
const backupDoses: Dose[] = [
  { id: 'ce1558d8-3ab2-4c55-9031-149570f48f06', medicationId: tirzepatide.id, dosage: 1.2, unit: 'mg', injectionSite: 'abdomen-upper-left', dateTime: 1774036680000, notes: '', createdAt: 1777489157440 },
  { id: '9084f4ce-e54f-4f9b-8d46-f3e07e5730a8', medicationId: tirzepatide.id, dosage: 1.4, unit: 'mg', injectionSite: 'abdomen-upper-left', dateTime: 1774641480000, notes: '', createdAt: 1777489136235 },
  { id: 'afadfa0c-cd52-48e9-aa22-f3af7f354e85', medicationId: tirzepatide.id, dosage: 1.6, unit: 'mg', injectionSite: 'abdomen-upper-right', dateTime: 1775242680000, notes: '', createdAt: 1777489110870 },
  { id: '30cdc37b-3274-42e0-bc11-e41c83dd2596', medicationId: tirzepatide.id, dosage: 1.8, unit: 'mg', injectionSite: 'abdomen-upper-right', dateTime: 1775847420000, notes: '', createdAt: 1777489085337 },
  { id: 'e4d0c08f-4034-4fa6-a9f3-5ffb5b258a17', medicationId: tirzepatide.id, dosage: 1.8, unit: 'mg', injectionSite: 'abdomen-upper-right', dateTime: 1776452160000, notes: '', createdAt: 1777489063064 },
  { id: '09bb5f88-571f-425a-a1b0-71b3102f1ae7', medicationId: tirzepatide.id, dosage: 2.5, unit: 'mg', injectionSite: 'abdomen-upper-left', dateTime: 1776884160000, notes: '', createdAt: 1777488994706 },
  { id: '68ee6b63-a6f6-46f0-9fb9-ce5d06d11366', medicationId: tirzepatide.id, dosage: 2.5, unit: 'mg', injectionSite: 'abdomen-upper-left', dateTime: 1777445760000, notes: '', createdAt: 1777489014469 },
  { id: '3d485264-1266-4be8-b759-5deb5b80d24b', medicationId: tirzepatide.id, dosage: 2.5, unit: 'mg', injectionSite: 'abdomen-upper-right', dateTime: 1778048100000, notes: '', createdAt: 1778053319356 },
  { id: '9f2287d4-aec7-4d5c-8382-241b682462d7', medicationId: tirzepatide.id, dosage: 2.5, unit: 'mg', injectionSite: 'abdomen-lower-left', dateTime: 1778612894532, notes: '', createdAt: 1778612894532 },
  { id: 'b24e4765-3e87-40e1-a06c-1e982ab9b884', medicationId: tirzepatide.id, dosage: 2.5, unit: 'mg', injectionSite: 'abdomen-lower-right', dateTime: 1779024420000, notes: '', createdAt: 1779024437457 },
  { id: 'bca289ff-e089-4197-ba6a-a2debfda4131', medicationId: tirzepatide.id, dosage: 2.5, unit: 'mg', injectionSite: 'abdomen-upper-left', dateTime: 1779481059142, notes: '', createdAt: 1779481059142 },
  { id: 'c0337474-0c79-47f8-b032-483323c1954f', medicationId: tirzepatide.id, dosage: 2.5, unit: 'mg', injectionSite: 'abdomen-upper-right', dateTime: 1779869640000, notes: '', createdAt: 1779870385539 },
  { id: 'f45728bc-0a7f-4802-ad27-03e4aa381a23', medicationId: tirzepatide.id, dosage: 2.6, unit: 'mg', injectionSite: 'abdomen-lower-left', dateTime: 1780257439947, notes: '', createdAt: 1780257439948 },
  { id: '73aa7b96-6e51-43cf-8e98-c99abb24b402', medicationId: tirzepatide.id, dosage: 2.28, unit: 'mg', injectionSite: 'abdomen-lower-right', dateTime: 1780605120000, notes: '', createdAt: 1780605266609 },
  { id: '74a0375d-3cea-401c-8e1c-b05d861161d7', medicationId: tirzepatide.id, dosage: 2.09, unit: 'mg', injectionSite: 'abdomen-upper-left', dateTime: 1780917360000, notes: '', createdAt: 1780918235639 },
  { id: '0f35a6a6-e5b3-4554-874c-8a692fb77a7c', medicationId: tirzepatide.id, dosage: 2.35, unit: 'mg', injectionSite: 'abdomen-upper-right', dateTime: 1781280240000, notes: '', createdAt: 1781281180705 },
  { id: '207330a2-1e63-41ac-a014-829e043a8d82', medicationId: tirzepatide.id, dosage: 2.5, unit: 'mg', injectionSite: 'abdomen-lower-left', dateTime: 1781592240000, notes: '', createdAt: 1781592469065 },
  { id: '8b5c2d5d-f6b1-4723-9b7c-0d6399237bb2', medicationId: tirzepatide.id, dosage: 2.5, unit: 'mg', injectionSite: 'abdomen-lower-right', dateTime: 1781986620000, notes: '', createdAt: 1781989370457 },
];

// Protocol from backup (step 1 = 3.3mg, targetConcentration: 5.313403383066616, durationWeeks: 4)
const backupProtocol: Protocol = {
  id: 'a7e54d82-2e8c-4ab8-a8ba-83fafe3ae9c0',
  medicationId: tirzepatide.id,
  name: 'Tirzepatide Protocol',
  targetType: 'steady-state-concentration',
  steps: [
    { id: '42641907-44b3-4b04-a6ba-97aae12a504e', dosage: 2.5, durationWeeks: 4, targetConcentration: 4.025305593232285 },
    { id: '6493ea2a-134b-4f42-8bcf-2a04fc58b167', dosage: 3.3, durationWeeks: 4, targetConcentration: 5.313403383066616 },
    { id: 'ddb8367b-56c5-4d96-acc2-023d823eff94', dosage: 5, durationWeeks: 4, targetConcentration: 8.05061118646457 }
  ],
  currentStepIndex: 1,
  startDate: 1778610692604,
  currentStepStartDate: 1779870385579,
  autoAdvance: true,
  chartStyle: 'spider',
  createdAt: 1778610688032
};

describe('backup data steady-state bug reproduction', () => {
  it('should show high progress because concentration was already at target before step started', () => {
    const now = 1782138043828; // exportedAt from backup

    const metrics = calculateTitrationMetrics(backupProtocol, backupDoses, [], [], [tirzepatide], now);

    // The old buggy code would compute startDate = 1779870385579 (currentStepStartDate)
    // and only count days from there. Because the user had been on ~2.5mg for a long time
    // before that, the concentration was already at/near the 3.3mg target. The new code
    // should count days at target going back to the earliest dose, so progress should be
    // much higher than the ~0% the buggy code would produce.
    expect(metrics.timeProgressPercent).toBeGreaterThan(50);
  });

  it('evaluateTitration should be ready (or nearly ready) because concentration has been at target for weeks', () => {
    const now = 1782138043828;

    const res = evaluateTitration(backupProtocol, backupDoses, [], [], [tirzepatide], 5, now);

    // With the bug, the time progress would be ~0%, so evaluateTitration would say
    // "not ready" with many days left. After the fix, the concentration has been at
    // target for well over 4 weeks, so it should be ready to step up.
    expect(res.ready).toBe(true);
    expect(res.recommendation).toBe('step-up');
  });
});
