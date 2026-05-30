import { describe, it, expect, beforeAll } from 'vitest';
import { evaluateTitration, calculateTitrationMetrics } from './titrationAnalytics';
import type { Protocol, Dose, WeightEntry, SymptomLog, Medication } from '../types';
import { useMedicationStore } from '../stores/medicationStore';

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
    targetType: 'weekly-equivalent',
    steps: [
      { id: 's1', dosage: 0.25, durationWeeks: 4 },
      { id: 's2', dosage: 0.5, durationWeeks: 4 }
    ]
  };

  const testMed: Medication = {
    id: 'm1',
    templateId: 'lib-semaglutide',
    name: 'Test Med',
    brand: 'Brand',
    activeIngredient: 'Semaglutide',
    dosageOptions: [0.25, 0.5, 1.0],
    unit: 'mg',
    frequency: 'weekly',
    halfLifeHours: 168, // 1 week
    color: '#ffffff',
    reminderHoursBefore: 24,
    enabled: true,
    createdAt: 0
  };

  beforeAll(() => {
    useMedicationStore.setState({ medications: [testMed] });
  });

  it('recommends none if not enough time has passed', () => {
    const protocol = { ...baseProtocol, currentStepStartDate: Date.now() - 14 * 24 * 60 * 60 * 1000 }; // 2 weeks ago
    const res = evaluateTitration(protocol, [], [], [], [testMed]);
    expect(res.ready).toBe(false);
    expect(res.recommendation).toBe('none');
    expect(res.reason).toContain('days left');
  });

  it('recommends hold if side effect score > 3', () => {
    // 2 moderate non-GI (2+2) = 4 points (using non-GI Fatigue and Dizziness to avoid adaptation window filtering)
    const doses: Dose[] = [
      { id: 'd1', medicationId: 'm1', dosage: 0.25, unit: 'mg', injectionSite: 'abdomen-upper-left', dateTime: Date.now() - 1.5 * 24 * 60 * 60 * 1000, notes: '', sideEffects: [{ label: 'Dizziness', severity: 'moderate' }], createdAt: 0 },
    ];
    const symptomLogs: SymptomLog[] = [
      { id: 'l1', medicationId: 'm1', dateTime: Date.now() - 5 * 24 * 60 * 60 * 1000, symptoms: [{ label: 'Fatigue', severity: 'moderate' }], notes: '', createdAt: 0 }
    ];
    const res = evaluateTitration(baseProtocol, doses, symptomLogs, [], [testMed]);
    expect(res.ready).toBe(true);
    expect(res.recommendation).toBe('hold');
    expect(res.reason).toContain('severe side effects detected');
  });

  it('recommends step-up if time has passed and no flags', () => {
    const res = evaluateTitration(baseProtocol, [], [], [], [testMed]);
    expect(res.ready).toBe(true);
    expect(res.recommendation).toBe('step-up');
    expect(res.reason).toContain('ready to advance');
  });

  it('recommends hold if rapid relative weight loss (>1.5% body weight/week)', () => {
    const weights: WeightEntry[] = [
      { id: 'w1', weight: 100, unit: 'kg', dateTime: Date.now() - 27 * 24 * 60 * 60 * 1000, notes: '', createdAt: 0 },
      { id: 'w2', weight: 90, unit: 'kg', dateTime: Date.now(), notes: '', createdAt: 0 }
    ]; // 10kg loss in ~3.85 weeks = ~2.59kg/week (2.87% body weight/week)
    const res = evaluateTitration(baseProtocol, [], [], weights, [testMed]);
    expect(res.ready).toBe(true);
    expect(res.recommendation).toBe('hold');
    expect(res.reason).toContain('Rapid weight loss');
  });

  it('includes weights from before the current step start for stability metric', () => {
    // Step started yesterday, but rapid weight loss occurred over the last 2 weeks
    const protocol = { ...baseProtocol, currentStepStartDate: Date.now() - 1 * 24 * 60 * 60 * 1000 }; 
    const weights: WeightEntry[] = [
      { id: 'w1', weight: 100, unit: 'kg', dateTime: Date.now() - 14 * 24 * 60 * 60 * 1000, notes: '', createdAt: 0 },
      { id: 'w2', weight: 95, unit: 'kg', dateTime: Date.now(), notes: '', createdAt: 0 }
    ]; // 5kg in 2 weeks = 2.5kg/week (2.63% body weight/week)
    const res = evaluateTitration(protocol, [], [], weights, [testMed]);
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
    
    const res = evaluateTitration(protocol, doses, [], [], [testMed]);
    // Should be not ready because only 1 week has passed on 0.5mg (needs 4 weeks)
    expect(res.ready).toBe(false);
    expect(res.reason).toContain('21 days left'); 
  });

  it('correctly identifies missing weight and symptom data', () => {
    const metrics = calculateTitrationMetrics(baseProtocol, [], [], [], [testMed]);
    expect(metrics.hasWeightData).toBe(false);
    expect(metrics.hasSymptomData).toBe(false);
    
    const weights: WeightEntry[] = [{ id: 'w1', weight: 100, unit: 'kg', dateTime: Date.now(), notes: '', createdAt: 0 }];
    const metrics2 = calculateTitrationMetrics(baseProtocol, [], [], weights, [testMed]);
    expect(metrics2.hasWeightData).toBe(false); 
    
    const doses: Dose[] = [{ id: 'd1', medicationId: 'm1', dosage: 0.25, unit: 'mg', injectionSite: 'arm-left', dateTime: Date.now(), notes: '', createdAt: 0 }];
    const metrics3 = calculateTitrationMetrics(baseProtocol, doses, [], [], [testMed]);
    expect(metrics3.hasSymptomData).toBe(true);
  });

  it('applies time-based decay to symptom scores', () => {
    const now = Date.now();
    const symptomLogs: SymptomLog[] = [
      // 10 days ago (Historical: 0.5 multiplier)
      { id: 'l1', medicationId: 'm1', dateTime: now - 10 * 24 * 60 * 60 * 1000, symptoms: [{ label: 'Dizziness', severity: 'severe' }], notes: '', createdAt: 0 },
      // 4 days ago (Recent: 0.75 multiplier)
      { id: 'l2', medicationId: 'm1', dateTime: now - 4 * 24 * 60 * 60 * 1000, symptoms: [{ label: 'Headache', severity: 'severe' }], notes: '', createdAt: 0 },
      // 1 day ago (Acute: 1.0 multiplier)
      { id: 'l3', medicationId: 'm1', dateTime: now - 1 * 24 * 60 * 60 * 1000, symptoms: [{ label: 'Fatigue', severity: 'moderate' }], notes: '', createdAt: 0 }
    ];
    // l1 (moderate side effect tier): 3 * 0.5 = 1.5
    // l2 (routine headache): 3 * 0.75 = 2.25
    // l3 (moderate fatigue): 2 * 1.0 = 2.0
    // Total: 1.5 + 2.25 + 2.0 = 5.75
    
    const metrics = calculateTitrationMetrics(baseProtocol, [], symptomLogs, [], [testMed]);
    expect(metrics.symptomScore).toBe(5.75);
  });

  it('triggers hold on persistent moderate/severe symptoms (3+ entries in 7 days)', () => {
    const now = Date.now();
    const symptomLogs: SymptomLog[] = [
      { id: 'l1', medicationId: 'm1', dateTime: now - 1 * 24 * 60 * 60 * 1000, symptoms: [{ label: 'Nausea', severity: 'moderate' }], notes: '', createdAt: 0 },
      { id: 'l2', medicationId: 'm1', dateTime: now - 3 * 24 * 60 * 60 * 1000, symptoms: [{ label: 'Nausea', severity: 'moderate' }], notes: '', createdAt: 0 },
      { id: 'l3', medicationId: 'm1', dateTime: now - 5 * 24 * 60 * 60 * 1000, symptoms: [{ label: 'Nausea', severity: 'moderate' }], notes: '', createdAt: 0 }
    ];
    
    // Set severeThreshold to 10 to avoid triggering the preemptive high side effect burden warning (which would happen at score >= 5)
    const res = evaluateTitration(baseProtocol, [], symptomLogs, [], [testMed], 10);
    expect(res.recommendation).toBe('hold');
    expect(res.reason).toContain('Persistent symptoms detected');
    expect(res.reason).toContain('Nausea');
  });

  describe('Medical Safety Standards Tiered Logic', () => {
    it('triggers emergency alert for anaphylaxis in the last 48 hours', () => {
      const now = Date.now();
      const symptomLogs: SymptomLog[] = [
        { id: 'l1', medicationId: 'm1', dateTime: now - 12 * 60 * 60 * 1000, symptoms: [{ label: 'Anaphylaxis', severity: 'mild' }], notes: '', createdAt: 0 }
      ];
      const res = evaluateTitration(baseProtocol, [], symptomLogs, [], [testMed], 5, now);
      expect(res.recommendation).toBe('hold');
      expect(res.warningLevel).toBe('emergency');
      expect(res.reason).toContain('EMERGENCY ALERT');
      expect(res.reason).toContain('Anaphylaxis');
    });

    it('triggers emergency alert for severe hypoglycemia in the last 48 hours', () => {
      const now = Date.now();
      const doses: Dose[] = [
        { id: 'd1', medicationId: 'm1', dosage: 0.25, unit: 'mg', injectionSite: 'abdomen-upper-left', dateTime: now - 24 * 60 * 60 * 1000, notes: '', sideEffects: [{ label: 'Hypoglycemia', severity: 'severe' }], createdAt: 0 }
      ];
      const res = evaluateTitration(baseProtocol, doses, [], [], [testMed], 5, now);
      expect(res.recommendation).toBe('hold');
      expect(res.warningLevel).toBe('emergency');
      expect(res.reason).toContain('EMERGENCY ALERT');
      expect(res.reason).toContain('Hypoglycemia');
    });

    it('triggers urgent/severe alert for kidney injury signs in the last 7 days', () => {
      const now = Date.now();
      const symptomLogs: SymptomLog[] = [
        { id: 'l1', medicationId: 'm1', dateTime: now - 4 * 24 * 60 * 60 * 1000, symptoms: [{ label: 'Kidney injury signs', severity: 'mild' }], notes: '', createdAt: 0 }
      ];
      const res = evaluateTitration(baseProtocol, [], symptomLogs, [], [testMed], 5, now);
      expect(res.recommendation).toBe('hold');
      expect(res.warningLevel).toBe('severe');
      expect(res.reason).toContain('URGENT WARNING');
      expect(res.reason).toContain('Kidney injury signs');
    });

    it('triggers urgent/severe alert for severe vomiting in the last 7 days', () => {
      const now = Date.now();
      const doses: Dose[] = [
        { id: 'd1', medicationId: 'm1', dosage: 0.25, unit: 'mg', injectionSite: 'abdomen-upper-left', dateTime: now - 3 * 24 * 60 * 60 * 1000, notes: '', sideEffects: [{ label: 'Vomiting', severity: 'severe' }], createdAt: 0 }
      ];
      const res = evaluateTitration(baseProtocol, doses, [], [], [testMed], 5, now);
      expect(res.recommendation).toBe('hold');
      expect(res.warningLevel).toBe('severe');
      expect(res.reason).toContain('URGENT WARNING');
      expect(res.reason).toContain('Vomiting');
    });

    it('tolerates routine GI symptoms during the 7-day adaptation window', () => {
      const now = Date.now();
      // Setup step that started just 2 days ago
      const protocol = { 
        ...baseProtocol, 
        currentStepStartDate: now - 2 * 24 * 60 * 60 * 1000, 
        startDate: now - 2 * 24 * 60 * 60 * 1000 
      };

      // Logging 2 moderate nausea and 1 moderate bloating events (normally would be high score > 3)
      const doses: Dose[] = [
        { id: 'd1', medicationId: 'm1', dosage: 0.25, unit: 'mg', injectionSite: 'abdomen-upper-left', dateTime: now - 1 * 24 * 60 * 60 * 1000, notes: '', sideEffects: [{ label: 'Nausea', severity: 'moderate' }, { label: 'Bloating', severity: 'moderate' }], createdAt: 0 }
      ];

      const metrics = calculateTitrationMetrics(protocol, doses, [], [], [testMed]);
      // Inside adaptation window, moderate routine GI side effects are ignored for the score
      expect(metrics.symptomScore).toBe(0);
    });

    it('does not tolerate mild symptoms if persistent hold is selectively moderate/severe', () => {
      const now = Date.now();
      // 3 mild nausea episodes in 7 days should NOT trigger a persistent hold under the new guidelines
      const symptomLogs: SymptomLog[] = [
        { id: 'l1', medicationId: 'm1', dateTime: now - 1 * 24 * 60 * 60 * 1000, symptoms: [{ label: 'Nausea', severity: 'mild' }], notes: '', createdAt: 0 },
        { id: 'l2', medicationId: 'm1', dateTime: now - 3 * 24 * 60 * 60 * 1000, symptoms: [{ label: 'Nausea', severity: 'mild' }], notes: '', createdAt: 0 },
        { id: 'l3', medicationId: 'm1', dateTime: now - 5 * 24 * 60 * 60 * 1000, symptoms: [{ label: 'Nausea', severity: 'mild' }], notes: '', createdAt: 0 }
      ];

      const metrics = calculateTitrationMetrics(baseProtocol, [], symptomLogs, [], [testMed]);
      expect(metrics.isPersistent).toBe(false);
    });

    it('tolerates weight loss of 1.2% but holds on rapid relative weight loss of 2.0%/week', () => {
      const now = Date.now();
      // 100 kg starting, 96.8 kg latest = 3.2 kg loss in 27 days (~3.85 weeks)
      // Rate: 3.2 / 3.85 = 0.83 kg/week. Percentage: 0.83% relative loss (safe, no hold)
      const weightsSafe: WeightEntry[] = [
        { id: 'w1', weight: 100, unit: 'kg', dateTime: now - 27 * 24 * 60 * 60 * 1000, notes: '', createdAt: 0 },
        { id: 'w2', weight: 96.8, unit: 'kg', dateTime: now, notes: '', createdAt: 0 }
      ];
      
      const metricsSafe = calculateTitrationMetrics(baseProtocol, [], [], weightsSafe, [testMed]);
      expect(metricsSafe.weightLossPercentPerWeek).toBeLessThan(1.5);
      
      // 100 kg starting, 92.5 kg latest = 7.5 kg loss in 27 days (~3.85 weeks)
      // Rate: 7.5 / 3.85 = 1.94 kg/week. Percentage: 2.1% relative loss (rapid, triggers hold)
      const weightsRapid: WeightEntry[] = [
        { id: 'w1', weight: 100, unit: 'kg', dateTime: now - 27 * 24 * 60 * 60 * 1000, notes: '', createdAt: 0 },
        { id: 'w2', weight: 92.5, unit: 'kg', dateTime: now, notes: '', createdAt: 0 }
      ];
      const metricsRapid = calculateTitrationMetrics(baseProtocol, [], [], weightsRapid, [testMed]);
      expect(metricsRapid.weightLossPercentPerWeek).toBeGreaterThan(1.5);
    });
  });

  describe('Steady-State Concentration Target Mode', () => {
    const pkProtocol: Protocol = {
      ...baseProtocol,
      targetType: 'steady-state-concentration',
      steps: [
        { id: 's1', dosage: 0.25, durationWeeks: 4, targetConcentration: 0.5 },
        { id: 's2', dosage: 0.5, durationWeeks: 4, targetConcentration: 1.0 },
        { id: 's3', dosage: 1.0, durationWeeks: 4, targetConcentration: 2.0 }
      ],
      currentStepIndex: 1, // On 0.5mg
      currentStepStartDate: Date.now() - 4 * 7 * 24 * 60 * 60 * 1000 // Started 4 weeks ago
    };

    it('calculates time progress based on days target concentration was met', () => {
      // If we don't have enough doses to reach 1.0, progress is 0%
      const dosesLow: Dose[] = [
        { id: 'd1', medicationId: 'm1', dosage: 0.25, unit: 'mg', injectionSite: 'arm-left', dateTime: Date.now() - 5 * 7 * 24 * 60 * 60 * 1000, notes: '', createdAt: 0 },
        { id: 'd2', medicationId: 'm1', dosage: 0.5, unit: 'mg', injectionSite: 'arm-left', dateTime: Date.now() - 4 * 7 * 24 * 60 * 60 * 1000, notes: '', createdAt: 0 }
      ];
      
      const metricsLow = calculateTitrationMetrics(pkProtocol, dosesLow, [], [], [testMed]);
      expect(metricsLow.timeProgressPercent).toBe(0); // Never reached 1.0

      const resLow = evaluateTitration(pkProtocol, dosesLow, [], [], [testMed]);
      expect(resLow.ready).toBe(false);
      expect(resLow.reason).toContain('28 days left'); 

      // If we have steady doses of 1.0mg for 4 weeks, levels reach ~1.0-1.4 mg
      const dosesHigh: Dose[] = [
        { id: 'd1', medicationId: 'm1', dosage: 1.0, unit: 'mg', injectionSite: 'arm-left', dateTime: Date.now() - 4 * 7 * 24 * 60 * 60 * 1000, notes: '', createdAt: 0 },
        { id: 'd2', medicationId: 'm1', dosage: 1.0, unit: 'mg', injectionSite: 'arm-left', dateTime: Date.now() - 3 * 7 * 24 * 60 * 60 * 1000, notes: '', createdAt: 0 },
        { id: 'd3', medicationId: 'm1', dosage: 1.0, unit: 'mg', injectionSite: 'arm-left', dateTime: Date.now() - 2 * 7 * 24 * 60 * 60 * 1000, notes: '', createdAt: 0 },
        { id: 'd4', medicationId: 'm1', dosage: 1.0, unit: 'mg', injectionSite: 'arm-left', dateTime: Date.now() - 1 * 7 * 24 * 60 * 60 * 1000, notes: '', createdAt: 0 },
      ];
      
      const metricsHigh = calculateTitrationMetrics(pkProtocol, dosesHigh, [], [], [testMed]);
      // Because doses are double, the level stays well above 1.0
      // The progress should be near 100% since it was above for most of the 4 weeks
      expect(metricsHigh.timeProgressPercent).toBeGreaterThan(50);
    });
  });
});
