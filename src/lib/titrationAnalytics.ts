import type { Protocol, Dose, WeightEntry, SymptomLog, SideEffectLog } from '../types';

export interface TitrationRecommendation {
  ready: boolean;
  recommendation: 'step-up' | 'hold' | 'none';
  reason: string;
  warningLevel?: 'none' | 'severe';
}

export function calculateSideEffectScore(sideEffects: SideEffectLog[]): number {
  return sideEffects.reduce((score, se) => {
    const severity = typeof se === 'string' ? 'mild' : se.severity;
    switch (severity) {
      case 'severe': return score + 3;
      case 'moderate': return score + 2;
      case 'mild': return score + 1;
      default: return score;
    }
  }, 0);
}

export function calculateWeightedSymptomScore(sideEffects: SideEffectLog[], dateTime: number, now: number = Date.now()): number {
  const rawScore = calculateSideEffectScore(sideEffects);
  const daysAgo = (now - dateTime) / (24 * 60 * 60 * 1000);
  
  if (daysAgo <= 2) return rawScore; // Acute
  if (daysAgo <= 7) return rawScore * 0.75; // Recent
  if (daysAgo <= 14) return rawScore * 0.5; // Historical
  return 0;
}

export function detectPersistentSymptoms(
  recentDoses: Dose[],
  recentLogs: SymptomLog[],
  days: number = 7,
  threshold: number = 3,
  now: number = Date.now()
): string[] {
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const symptomCounts: Record<string, number> = {};
  
  const allEntries = [
    ...recentDoses.filter(d => d.dateTime >= cutoff).map(d => d.sideEffects || []),
    ...recentLogs.filter(l => l.dateTime >= cutoff).map(l => l.symptoms || [])
  ];

  allEntries.forEach(symptoms => {
    // Count each symptom label only once per entry
    const uniqueLabels = new Set(symptoms.map(s => s.label));
    uniqueLabels.forEach(label => {
      symptomCounts[label] = (symptomCounts[label] || 0) + 1;
    });
  });

  return Object.entries(symptomCounts)
    .filter(([_, count]) => count >= threshold)
    .map(([label]) => label);
}

export interface TitrationMetrics {
  timeProgressPercent: number;
  symptomScore: number;
  isPersistent: boolean;
  persistentSymptoms: string[];
  weightLossRateKgPerWeek: number;
  daysRemaining: number;
  hasWeightData: boolean;
  hasSymptomData: boolean;
}

export function calculateTitrationMetrics(
  protocol: Protocol,
  doses: Dose[],
  symptomLogs: SymptomLog[],
  weights: WeightEntry[]
): TitrationMetrics {
  const currentStep = protocol.steps[protocol.currentStepIndex];
  if (!currentStep) return { 
    timeProgressPercent: 0, 
    symptomScore: 0, 
    weightLossRateKgPerWeek: 0, 
    daysRemaining: 0,
    hasWeightData: false,
    hasSymptomData: false
  };

  // Find the actual date they started this dosage level from the logs
  const medicationDoses = doses
    .filter(d => d.medicationId === protocol.medicationId)
    .sort((a, b) => a.dateTime - b.dateTime);
  
  let doseLevelStartDate: number | null = null;
  // Look backwards from the most recent dose to find when they switched to the current dosage
  for (let i = medicationDoses.length - 1; i >= 0; i--) {
    if (medicationDoses[i].dosage === currentStep.dosage) {
      doseLevelStartDate = medicationDoses[i].dateTime;
    } else {
      // They were on a different dosage before this, so this is the start of the current level
      break;
    }
  }

  const startDate = doseLevelStartDate || protocol.currentStepStartDate || protocol.startDate;
  if (!startDate) return { 
    timeProgressPercent: 0, 
    symptomScore: 0, 
    weightLossRateKgPerWeek: 0, 
    daysRemaining: 0,
    hasWeightData: false,
    hasSymptomData: false
  };

  const durationMs = currentStep.durationWeeks * 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const timeOnStepMs = now - startDate;
  
  const timeProgressPercent = Math.min((timeOnStepMs / durationMs) * 100, 100);
  const daysRemaining = Math.max(0, Math.ceil((durationMs - timeOnStepMs) / (1000 * 60 * 60 * 24)));

  // Symptoms in last 14 days (weighted)
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;
  const recentDoses = doses.filter(d => d.medicationId === protocol.medicationId && d.dateTime >= fourteenDaysAgo);
  const recentSymptomLogs = symptomLogs.filter(l => l.medicationId === protocol.medicationId && l.dateTime >= fourteenDaysAgo);
  
  const doseSideEffectScore = recentDoses.reduce((score, d) => score + calculateWeightedSymptomScore(d.sideEffects || [], d.dateTime, now), 0);
  const symptomLogScore = recentSymptomLogs.reduce((score, l) => score + calculateWeightedSymptomScore(l.symptoms || [], l.dateTime, now), 0);
  const symptomScore = doseSideEffectScore + symptomLogScore;

  // Persistence detection in last 7 days
  const persistentSymptoms = detectPersistentSymptoms(recentDoses, recentSymptomLogs, 7, 3, now);
  const isPersistent = persistentSymptoms.length > 0;

  // Weight trend over the last 4 weeks to determine overall stability/safety
  let weightLossRateKgPerWeek = 0;
  const fourWeeksAgo = now - 4 * 7 * 24 * 60 * 60 * 1000;
  const recentWeights = weights
    .filter(w => w.dateTime >= fourWeeksAgo)
    .sort((a, b) => a.dateTime - b.dateTime);

  if (recentWeights.length >= 2) {
    const firstWeight = recentWeights[0];
    const lastWeight = recentWeights[recentWeights.length - 1];
    const timeDiffMs = lastWeight.dateTime - firstWeight.dateTime;
    const weeksDiff = timeDiffMs / (7 * 24 * 60 * 60 * 1000);
    
    // Require at least 24 hours of separation for a meaningful rate
    if (weeksDiff > 0.14) { 
      const firstKg = firstWeight.unit === 'lb' ? firstWeight.weight * 0.453592 : firstWeight.weight;
      const lastKg = lastWeight.unit === 'lb' ? lastWeight.weight * 0.453592 : lastWeight.weight;
      const weightLossKg = firstKg - lastKg;
      weightLossRateKgPerWeek = weightLossKg / weeksDiff;
    }
  }

  const hasWeightData = recentWeights.length >= 2;
  const hasSymptomData = recentDoses.length > 0 || recentSymptomLogs.length > 0;

  return { 
    timeProgressPercent, 
    symptomScore, 
    isPersistent,
    persistentSymptoms,
    weightLossRateKgPerWeek, 
    daysRemaining,
    hasWeightData,
    hasSymptomData
  };
}

export function evaluateTitration(
  protocol: Protocol,
  doses: Dose[],
  symptomLogs: SymptomLog[],
  weights: WeightEntry[],
  severeThreshold: number = 5
): TitrationRecommendation {
  const currentStep = protocol.steps[protocol.currentStepIndex];
  if (!currentStep) return { ready: false, recommendation: 'none', reason: 'Invalid protocol step.' };

  const metrics = calculateTitrationMetrics(protocol, doses, symptomLogs, weights);

  // SAFETY FIRST: Always check for severe symptoms regardless of protocol position
  if (metrics.symptomScore >= severeThreshold) {
    return {
      ready: true,
      recommendation: 'hold',
      reason: 'WARNING: High side effect burden detected. Seek medical advice before continuing your medication.',
      warningLevel: 'severe',
    };
  }

  if (protocol.currentStepIndex >= protocol.steps.length - 1) {
    return { ready: false, recommendation: 'none', reason: 'You are on the final step of your protocol.' };
  }

  const startDate = protocol.currentStepStartDate || protocol.startDate;
  if (!startDate) return { ready: false, recommendation: 'none', reason: 'Protocol has not started.' };

  if (metrics.isPersistent) {
    return {
      ready: true,
      recommendation: 'hold',
      reason: `Persistent symptoms detected (${metrics.persistentSymptoms.join(', ')}). It is recommended to stay on your current dose until these resolve.`,
      warningLevel: 'none',
    };
  }

  if (metrics.symptomScore > 3) {
    return {
      ready: true,
      recommendation: 'hold',
      reason: 'Frequent or severe side effects detected recently. It is recommended to stay on your current dose.',
      warningLevel: 'none',
    };
  }

  if (metrics.weightLossRateKgPerWeek > 1.0) {
    return {
      ready: true,
      recommendation: 'hold',
      reason: 'Rapid weight loss detected (>1kg/week). It is recommended to stay on your current dose for safety.',
    };
  }

  if (metrics.timeProgressPercent < 100) {
    return {
      ready: false,
      recommendation: 'none',
      reason: `You have ${metrics.daysRemaining} days left on your current dose.`,
    };
  }

  return {
    ready: true,
    recommendation: 'step-up',
    reason: `You have completed ${currentStep.durationWeeks} weeks. Based on your progress and tolerance, you are ready to advance to ${protocol.steps[protocol.currentStepIndex + 1].dosage}.`,
  };
}
