import type { Protocol, Dose, WeightEntry, SymptomLog, SideEffectLog, Medication } from '../types';
import { getSymptomRiskTier } from './sideEffects';
import { calculateRollingAverageConcentration } from './halfLifeEngine';
import { useMedicationStore } from '../stores/medicationStore';

export interface TitrationRecommendation {
  ready: boolean;
  recommendation: 'step-up' | 'hold' | 'none';
  reason: string;
  warningLevel?: 'none' | 'severe' | 'emergency';
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
    // Only count symptoms with severity 'moderate' or 'severe' (ignore mild)
    const nonMildSymptoms = symptoms.filter(s => {
      const severity = typeof s === 'string' ? 'mild' : s.severity;
      return severity === 'moderate' || severity === 'severe';
    });
    
    // Count each symptom label only once per entry
    const uniqueLabels = new Set(nonMildSymptoms.map(s => s.label));
    uniqueLabels.forEach(label => {
      symptomCounts[label] = (symptomCounts[label] || 0) + 1;
    });
  });

  return Object.entries(symptomCounts)
    .filter(([_, count]) => count >= threshold)
    .map(([label]) => label);
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
    isPersistent: false,
    persistentSymptoms: [],
    weightLossRateKgPerWeek: 0, 
    weightLossPercentPerWeek: 0,
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
      break;
    }
  }

  const startDate = doseLevelStartDate || protocol.currentStepStartDate || protocol.startDate;
  if (!startDate) return { 
    timeProgressPercent: 0, 
    symptomScore: 0, 
    isPersistent: false,
    persistentSymptoms: [],
    weightLossRateKgPerWeek: 0, 
    weightLossPercentPerWeek: 0,
    daysRemaining: 0,
    hasWeightData: false,
    hasSymptomData: false
  };

  const now = Date.now();
  let timeProgressPercent = 0;
  let daysRemaining = 0;

  if (protocol.targetType === 'steady-state-concentration') {
    let med: Medication | undefined;
    try {
      med = useMedicationStore.getState().medications.find(m => m.id === protocol.medicationId);
    } catch (e) {
      // safe fallback if store is not initialized in some test environments
    }
    
    if (med && currentStep.targetConcentration) {
      let daysAtTarget = 0;
      const daysSinceStart = Math.floor((now - startDate) / (24 * 60 * 60 * 1000));
      for (let i = 0; i <= daysSinceStart; i++) {
        const checkTime = startDate + i * 24 * 60 * 60 * 1000;
        const rollingAvg = calculateRollingAverageConcentration(med, doses, 7, checkTime);
        if (rollingAvg >= currentStep.targetConcentration * 0.95) {
          daysAtTarget++;
        }
      }
      const targetDays = currentStep.durationWeeks * 7;
      timeProgressPercent = Math.min((daysAtTarget / targetDays) * 100, 100);
      daysRemaining = Math.max(0, targetDays - daysAtTarget);
    }
  } else {
    const durationMs = currentStep.durationWeeks * 7 * 24 * 60 * 60 * 1000;
    const timeOnStepMs = now - startDate;
    timeProgressPercent = Math.min((timeOnStepMs / durationMs) * 100, 100);
    daysRemaining = Math.max(0, Math.ceil((durationMs - timeOnStepMs) / (1000 * 60 * 60 * 24)));
  }

  // Symptoms in last 14 days (weighted)
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;
  const recentDoses = doses.filter(d => d.medicationId === protocol.medicationId && d.dateTime >= fourteenDaysAgo);
  const recentSymptomLogs = symptomLogs.filter(l => l.medicationId === protocol.medicationId && l.dateTime >= fourteenDaysAgo);
  
  // TITRATION ADAPTATION WINDOW:
  // If they increased their dose within the last 7 days, filter out mild/moderate routine GI symptoms.
  const daysSinceDoseIncrease = startDate ? (now - startDate) / (24 * 60 * 60 * 1000) : 999;
  const isAdaptation = daysSinceDoseIncrease <= 7;
  
  const ROUTINE_GI_SYMPTOMS = new Set([
    'nausea', 'vomiting', 'diarrhea', 'constipation', 
    'abdominal pain', 'decreased appetite', 'indigestion', 'bloating'
  ]);

  const filterAdaptation = (symptoms: SideEffectLog[]) => {
    if (!isAdaptation) return symptoms;
    return symptoms.filter(se => {
      const isRoutineGI = ROUTINE_GI_SYMPTOMS.has(se.label.toLowerCase());
      const severity = typeof se === 'string' ? 'mild' : se.severity;
      // Filter out (ignore) mild/moderate routine GI adaptation symptoms
      if (isRoutineGI && (severity === 'mild' || severity === 'moderate')) {
        return false;
      }
      return true;
    });
  };

  const doseSideEffectScore = recentDoses.reduce((score, d) => {
    const filtered = filterAdaptation(d.sideEffects || []);
    return score + calculateWeightedSymptomScore(filtered, d.dateTime, now);
  }, 0);

  const symptomLogScore = recentSymptomLogs.reduce((score, l) => {
    const filtered = filterAdaptation(l.symptoms || []);
    return score + calculateWeightedSymptomScore(filtered, l.dateTime, now);
  }, 0);

  const symptomScore = doseSideEffectScore + symptomLogScore;

  // Persistence detection in last 7 days (selective: ignores mild symptoms)
  const persistentSymptoms = detectPersistentSymptoms(recentDoses, recentSymptomLogs, 7, 3, now);
  const isPersistent = persistentSymptoms.length > 0;

  // Weight trend over the last 4 weeks to determine relative rate
  let weightLossRateKgPerWeek = 0;
  let weightLossPercentPerWeek = 0;
  const fourWeeksAgo = now - 4 * 7 * 24 * 60 * 60 * 1000;
  const recentWeights = weights
    .filter(w => w.dateTime >= fourWeeksAgo)
    .sort((a, b) => a.dateTime - b.dateTime);

  if (recentWeights.length >= 2) {
    const firstWeight = recentWeights[0];
    const lastWeight = recentWeights[recentWeights.length - 1];
    const timeDiffMs = lastWeight.dateTime - firstWeight.dateTime;
    const weeksDiff = timeDiffMs / (7 * 24 * 60 * 60 * 1000);
    
    if (weeksDiff > 0.14) { 
      const firstKg = firstWeight.unit === 'lb' ? firstWeight.weight * 0.453592 : firstWeight.weight;
      const lastKg = lastWeight.unit === 'lb' ? lastWeight.weight * 0.453592 : lastWeight.weight;
      const weightLossKg = firstKg - lastKg;
      weightLossRateKgPerWeek = weightLossKg / weeksDiff;

      const latestKg = lastKg;
      if (latestKg > 0) {
        weightLossPercentPerWeek = (weightLossRateKgPerWeek / latestKg) * 100;
      }
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
    weightLossPercentPerWeek,
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
  severeThreshold: number = 5,
  now: number = Date.now()
): TitrationRecommendation {
  const currentStep = protocol.steps[protocol.currentStepIndex];
  if (!currentStep) return { ready: false, recommendation: 'none', reason: 'Invalid protocol step.' };

  // 1. EMERGENCY SAFETY PRIORITY: Check past 48 hours for critical red flags
  const fortyEightHoursAgo = now - 48 * 60 * 60 * 1000;
  const recentDoses48h = doses.filter(d => d.medicationId === protocol.medicationId && d.dateTime >= fortyEightHoursAgo);
  const recentLogs48h = symptomLogs.filter(l => l.medicationId === protocol.medicationId && l.dateTime >= fortyEightHoursAgo);
  
  let emergencyLabel = '';
  const checkEmergency = (symptoms: SideEffectLog[]) => {
    for (const se of symptoms) {
      const severity = typeof se === 'string' ? 'mild' : se.severity;
      if (getSymptomRiskTier(se.label, severity) === 'emergency') {
        emergencyLabel = se.label;
        return true;
      }
    }
    return false;
  };

  const hasEmergency = recentDoses48h.some(d => checkEmergency(d.sideEffects || [])) ||
                       recentLogs48h.some(l => checkEmergency(l.symptoms || []));

  if (hasEmergency) {
    return {
      ready: true,
      recommendation: 'hold',
      reason: `EMERGENCY ALERT: Life-threatening symptom detected (${emergencyLabel}). Please seek emergency medical services (911) immediately.`,
      warningLevel: 'emergency',
    };
  }

  // 2. URGENT SAFETY PRIORITY: Check past 7 days for serious organ-specific signs
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const recentDoses7d = doses.filter(d => d.medicationId === protocol.medicationId && d.dateTime >= sevenDaysAgo);
  const recentLogs7d = symptomLogs.filter(l => l.medicationId === protocol.medicationId && l.dateTime >= sevenDaysAgo);

  let urgentLabel = '';
  const checkUrgent = (symptoms: SideEffectLog[]) => {
    for (const se of symptoms) {
      const severity = typeof se === 'string' ? 'mild' : se.severity;
      if (getSymptomRiskTier(se.label, severity) === 'urgent') {
        urgentLabel = se.label;
        return true;
      }
    }
    return false;
  };

  const hasUrgent = recentDoses7d.some(d => checkUrgent(d.sideEffects || [])) ||
                    recentLogs7d.some(l => checkUrgent(l.symptoms || []));

  if (hasUrgent) {
    return {
      ready: true,
      recommendation: 'hold',
      reason: `URGENT WARNING: Serious symptom detected (${urgentLabel}) requiring clinical attention. Please consult your physician immediately.`,
      warningLevel: 'severe',
    };
  }

  const metrics = calculateTitrationMetrics(protocol, doses, symptomLogs, weights);

  // 3. GENERAL HIGH SIDE EFFECT BURDEN WARNING (Always check safety regardless of time progress)
  if (metrics.symptomScore >= severeThreshold) {
    return {
      ready: true,
      recommendation: 'hold',
      reason: 'WARNING: High side effect burden detected. Seek medical advice before continuing your medication.',
      warningLevel: 'severe',
    };
  }

  // 4. PERSISTENT SYMPTOMS (Tier 3 moderate/severe only)
  if (metrics.isPersistent) {
    return {
      ready: true,
      recommendation: 'hold',
      reason: `Persistent symptoms detected (${metrics.persistentSymptoms.join(', ')}). It is recommended to stay on your current dose until these resolve.`,
      warningLevel: 'none',
    };
  }

  // 5. MODERATE SIDE EFFECT BURDEN HOLD
  if (metrics.symptomScore > 3) {
    return {
      ready: true,
      recommendation: 'hold',
      reason: 'Frequent or severe side effects detected recently. It is recommended to stay on your current dose.',
      warningLevel: 'none',
    };
  }

  // 6. RAPID PERCENTAGE WEIGHT LOSS HOLD (>1.5% of body weight per week)
  if (metrics.weightLossPercentPerWeek > 1.5) {
    return {
      ready: true,
      recommendation: 'hold',
      reason: `Rapid weight loss detected (${metrics.weightLossPercentPerWeek.toFixed(1)}%/week). It is recommended to stay on your current dose for safety.`,
    };
  }

  // 7. TIME PROGRESS CHECK & FINAL STEP CHECK (Move here to let safety holds take priority)
  if (protocol.currentStepIndex >= protocol.steps.length - 1) {
    return { ready: false, recommendation: 'none', reason: 'You are on the final step of your protocol.' };
  }

  const startDate = protocol.currentStepStartDate || protocol.startDate;
  if (!startDate) return { ready: false, recommendation: 'none', reason: 'Protocol has not started.' };

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

// Add types in global scope for ts compatibility
import type { TitrationMetrics as ITitrationMetrics } from '../types';
declare global {
  interface TitrationMetrics extends ITitrationMetrics {}
}
