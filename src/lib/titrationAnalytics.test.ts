import { describe, it, expect } from 'vitest';
import { evaluateTitration, calculateTitrationMetrics } from './titrationAnalytics';
import type { Protocol, Dose, WeightEntry, SymptomLog } from '../types';

describe('titrationAnalytics', () => {
  const baseProtocol: Protocol = {
    id: 'p1',
    medicationId: 'm1',
    name: 'Standard',
    currentStepIndex: 0,
    startDate: Date.now() - 5 * 7 * 24 * 60 * 60 * 1000, // Started 5 weeks ago
    currentStepStartDate: Date.now() - 5 * 7 * 24 * 60 * 60 * 1000,
    autoAdvance: false,
    createdAt: Date.now() - 5 * 7 * 24 * 60 * 60 * 1000,
    steps: [
      { id: 's1', dosage: 0.25, durationWeeks: 4 },
      { id: 's2', dosage: 0.5, durationWeeks: 4 }
    ]
  };

  it('recommends none if not enough time has passed', () => {
    const protocol = { ...baseProtocol, currentStepStartDate: Date.now() - 14 * 24 * 60 * 60 * 1000 }; // 2 weeks ago
    const res = evaluateTitration(protocol, [], [], []);
    expect(res.ready).toBe(false);
    expect(res.recommendation).toBe('none');
    expect(res.reason).toContain('days left');
  });

  it('recommends hold if side effect score > 3', () => {
    // 2 mild (1+1) + 1 moderate (2) = 4 points
    const doses: Dose[] = [
      { id: 'd1', medicationId: 'm1', dosage: 0.25, unit: 'mg', injectionSite: 'abdomen-upper-left', dateTime: Date.now() - 2 * 24 * 60 * 60 * 1000, notes: '', sideEffects: [{ label: 'Nausea', severity: 'mild' }, { label: 'Headache', severity: 'mild' }], createdAt: 0 },
    ];
    const symptomLogs: SymptomLog[] = [
      { id: 'l1', medicationId: 'm1', dateTime: Date.now() - 5 * 24 * 60 * 60 * 1000, symptoms: [{ label: 'Fatigue', severity: 'moderate' }], createdAt: 0 }
    ];
    const res = evaluateTitration(baseProtocol, doses, symptomLogs, []);
    expect(res.ready).toBe(true);
    expect(res.recommendation).toBe('hold');
    expect(res.reason).toContain('severe side effects detected');
  });

  it('recommends step-up if time has passed and no flags', () => {
    const res = evaluateTitration(baseProtocol, [], [], []);
    expect(res.ready).toBe(true);
    expect(res.recommendation).toBe('step-up');
    expect(res.reason).toContain('ready to advance');
  });

  it('recommends hold if rapid weight loss (>1kg/week)', () => {
    const weights: WeightEntry[] = [
      // Use 27 days instead of 28 to ensure it falls within the 4-week (28-day) filter window
      { id: 'w1', weight: 100, unit: 'kg', dateTime: Date.now() - 27 * 24 * 60 * 60 * 1000, notes: '', createdAt: 0 },
      { id: 'w2', weight: 95, unit: 'kg', dateTime: Date.now(), notes: '', createdAt: 0 }
    ]; // 5kg in ~3.85 weeks = ~1.3kg/week
    const res = evaluateTitration(baseProtocol, [], [], weights);
    expect(res.ready).toBe(true);
    expect(res.recommendation).toBe('hold');
    expect(res.reason).toContain('Rapid weight loss');
  });

  it('includes weights from before the current step start for stability metric', () => {
    // Step started yesterday, but rapid weight loss occurred over the last 2 weeks
    const protocol = { ...baseProtocol, currentStepStartDate: Date.now() - 1 * 24 * 60 * 60 * 1000 }; 
    const weights: WeightEntry[] = [
      { id: 'w1', weight: 100, unit: 'kg', dateTime: Date.now() - 14 * 24 * 60 * 60 * 1000, notes: '', createdAt: 0 },
      { id: 'w2', weight: 97, unit: 'kg', dateTime: Date.now(), notes: '', createdAt: 0 }
    ]; // 3kg in 2 weeks = 1.5kg/week
    const res = evaluateTitration(protocol, [], [], weights);
    expect(res.recommendation).toBe('hold');
    expect(res.reason).toContain('Rapid weight loss');
  });

  it('derives step start date from actual dose logs', () => {
    // Add a 3rd step so that Step 2 (Index 1) is not the final step
    const protocol: Protocol = { 
      ...baseProtocol, 
      steps: [...baseProtocol.steps, { id: 's3', dosage: 1.0, durationWeeks: 4 }],
      currentStepIndex: 1, // 0.5mg
      currentStepStartDate: Date.now() - 5 * 7 * 24 * 60 * 60 * 1000 // Protocol nominal start 5 weeks ago
    };
    
    const doses: Dose[] = [
      { id: 'd1', medicationId: 'm1', dosage: 0.25, unit: 'mg', injectionSite: 'arm-left', dateTime: Date.now() - 14 * 24 * 60 * 60 * 1000, notes: '', createdAt: 0 },
      { id: 'd2', medicationId: 'm1', dosage: 0.5, unit: 'mg', injectionSite: 'arm-left', dateTime: Date.now() - 7 * 24 * 60 * 60 * 1000, notes: '', createdAt: 0 }
    ];
    
    const res = evaluateTitration(protocol, doses, [], []);
    // Should be not ready because only 1 week has passed on 0.5mg (needs 4 weeks)
    // Nominal protocol said 5 weeks ago, but logs show 1 week ago. Logs win.
    expect(res.ready).toBe(false);
    expect(res.reason).toContain('21 days left'); 
  });

  it('correctly identifies missing weight and symptom data', () => {
    // No weights, no doses/symptom logs
    const metrics = calculateTitrationMetrics(baseProtocol, [], [], []);
    expect(metrics.hasWeightData).toBe(false);
    expect(metrics.hasSymptomData).toBe(false);
    
    // With one weight (not enough for rate)
    const weights: WeightEntry[] = [{ id: 'w1', weight: 100, unit: 'kg', dateTime: Date.now(), notes: '', createdAt: 0 }];
    const metrics2 = calculateTitrationMetrics(baseProtocol, [], [], weights);
    expect(metrics2.hasWeightData).toBe(false); // Still false because need 2 points
    
    // With one dose
    const doses: Dose[] = [{ id: 'd1', medicationId: 'm1', dosage: 0.25, unit: 'mg', injectionSite: 'arm-left', dateTime: Date.now(), notes: '', createdAt: 0 }];
    const metrics3 = calculateTitrationMetrics(baseProtocol, doses, [], []);
    expect(metrics3.hasSymptomData).toBe(true);
  });
});
