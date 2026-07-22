import { db } from '../db/database';
import { uuid } from './uuid';
import { useMedicationStore } from '../stores/medicationStore';
import { useWeightStore } from '../stores/weightStore';
import { useVialStore } from '../stores/vialStore';
import { useSymptomLogStore } from '../stores/symptomLogStore';
import { useProtocolStore } from '../stores/protocolStore';
import { useSettingsStore } from '../stores/settingsStore';

export const loadDemoData = async () => {
  // Safety check: Only proceed if database is completely empty
  const medCount = await db.medications.count();
  if (medCount > 0) return;

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const WEEK = 7 * DAY;
  
  // 1. Set Demo Mode flag
  await useSettingsStore.getState().updateSetting('isDemoMode', true);
  await useSettingsStore.getState().updateSetting('titrationWizardEnabled', true);
  await useSettingsStore.getState().updateSetting('weightUnit', 'lb');

  // 2. Add Medication (Tirzepatide)
  const medId = uuid();
  await db.medications.add({
    id: medId,
    templateId: 'tirzepatide',
    name: 'Tirzepatide',
    brand: 'Mounjaro / Zepbound',
    activeIngredient: 'Tirzepatide',
    dosageOptions: [2.5, 5, 7.5, 10, 12.5, 15],
    unit: 'mg',
    frequency: 'weekly',
    halfLifeHours: 120,
    color: '#0ea5e9',
    reminderHoursBefore: 24,
    enabled: true,
    createdAt: now - 8 * WEEK,
  });

  // 3. Add Doses (8 weeks history: 4 weeks 2.5mg, 4 weeks 5.0mg)
  const doses = [];
  for (let i = 0; i < 8; i++) {
    const dosage = i < 4 ? 2.5 : 5.0;
    const doseTime = now - (7 - i) * WEEK;
    doses.push({
      id: uuid(),
      medicationId: medId,
      dosage,
      unit: 'mg',
      injectionSite: 'abdomen-lower-right' as const,
      dateTime: doseTime,
      notes: i === 0 ? 'First dose! Feeling a bit nervous but excited.' : (i === 4 ? 'Stepping up to 5mg today.' : ''),
      createdAt: doseTime,
      sideEffects: i === 4 ? [{ label: 'Nausea', severity: 'mild' as const }] : [],
    });
  }
  await db.doses.bulkAdd(doses);

  // 4. Add Weight Entries (220 lbs down to ~205 lbs)
  const weights = [];
  let currentWeight = 220;
  for (let i = 0; i <= 8; i++) {
    const weightTime = now - (8 - i) * WEEK;
    weights.push({
      id: uuid(),
      weight: currentWeight,
      unit: 'lb' as const,
      dateTime: weightTime,
      notes: '',
      createdAt: weightTime,
    });
    // lose 1-2.5 lbs per week
    currentWeight -= (Math.random() * 1.5 + 1.0);
    currentWeight = Math.round(currentWeight * 10) / 10;
  }
  await db.weightEntries.bulkAdd(weights);

  // 5. Add Symptom Logs
  await db.symptomLogs.add({
    id: uuid(),
    medicationId: medId,
    dateTime: now - 3 * WEEK,
    symptoms: [{ label: 'Fatigue', severity: 'mild' }],
    notes: 'Feeling a bit tired today',
    createdAt: now - 3 * WEEK,
  });

  // 6. Add Titration Protocol
  await db.protocols.add({
    id: uuid(),
    medicationId: medId,
    name: 'Standard Step-Up',
    targetType: 'weekly-equivalent',
    steps: [
      { id: uuid(), dosage: 2.5, durationWeeks: 4 },
      { id: uuid(), dosage: 5.0, durationWeeks: 4 },
      { id: uuid(), dosage: 7.5, durationWeeks: 4 },
      { id: uuid(), dosage: 10.0, durationWeeks: 4 },
    ],
    currentStepIndex: 1, // we are on 5.0mg step
    startDate: now - 8 * WEEK,
    currentStepStartDate: now - 4 * WEEK,
    autoAdvance: false,
    chartStyle: 'timeline',
    createdAt: now - 8 * WEEK,
  });

  // 7. Add a Vial
  await db.vials.add({
    id: uuid(),
    medicationId: medId,
    name: 'Tirzepatide 15mg Vial',
    peptideAmount: 15,
    peptideUnit: 'mg',
    bacWaterAmount: 1.5,
    reconstitutedAt: now - 2 * WEEK,
    remainingOverride: null,
    notes: 'Demo vial',
    createdAt: now - 2 * WEEK,
  });

  // Reload all stores to reflect changes
  await useSettingsStore.getState().loadSettings();
  await useMedicationStore.getState().loadData();
  await useWeightStore.getState().loadData();
  await useVialStore.getState().loadData();
  await useSymptomLogStore.getState().loadData();
  await useProtocolStore.getState().loadData();
};
