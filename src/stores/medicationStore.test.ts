import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { useMedicationStore } from './medicationStore';
import { db } from '../db/database';
import type { Medication } from '../types';

const TEST_MED: Omit<Medication, 'id' | 'createdAt'> = {
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
};

describe('MedicationStore enable/disable', () => {
  beforeEach(async () => {
    await db.medications.clear();
    await db.doses.clear();
    useMedicationStore.setState({ medications: [], doses: [], initialized: false });
  });

  it('enabledMedications only returns meds with enabled=true', async () => {
    const store = useMedicationStore.getState();
    await store.addMedication({ ...TEST_MED, enabled: true, name: 'Enabled Med' });
    await store.addMedication({ ...TEST_MED, enabled: false, name: 'Disabled Med' });

    const state = useMedicationStore.getState();
    const enabled = state.medications.filter((m) => m.enabled);
    expect(state.medications.length).toBe(2);
    expect(enabled.length).toBe(1);
    expect(enabled[0].name).toBe('Enabled Med');
  });

  it('enableMedication toggles visibility on dashboard', async () => {
    const store = useMedicationStore.getState();
    await store.addMedication({ ...TEST_MED, enabled: false, name: 'Toggle Me' });

    let state = useMedicationStore.getState();
    const medId = state.medications[0].id;
    let enabled = state.medications.filter((m) => m.enabled);
    expect(enabled.length).toBe(0);

    await store.enableMedication(medId, true);
    state = useMedicationStore.getState();
    enabled = state.medications.filter((m) => m.enabled);
    expect(enabled.length).toBe(1);
    expect(enabled[0].name).toBe('Toggle Me');

    await store.enableMedication(medId, false);
    state = useMedicationStore.getState();
    enabled = state.medications.filter((m) => m.enabled);
    expect(enabled.length).toBe(0);
  });

  it('persisted enabled state survives reload', async () => {
    const store = useMedicationStore.getState();
    await store.addMedication({ ...TEST_MED, enabled: true });
    const medId = useMedicationStore.getState().medications[0].id;
    await store.enableMedication(medId, false);

    // Simulate reload by clearing store and re-loading from DB
    useMedicationStore.setState({ medications: [], doses: [], initialized: false });
    await useMedicationStore.getState().loadData();

    const state = useMedicationStore.getState();
    expect(state.medications[0].enabled).toBe(false);
    const enabled = state.medications.filter((m) => m.enabled);
    expect(enabled.length).toBe(0);
  });

  it('can add custom medication not in library', async () => {
    const store = useMedicationStore.getState();
    await store.addMedication({
      templateId: 'custom-xyz',
      name: 'Retatrutide',
      brand: 'Custom',
      activeIngredient: 'Retatrutide',
      dosageOptions: [2, 4, 8],
      unit: 'mg',
      frequency: 'weekly',
      halfLifeHours: 144,
      color: '#ef4444',
      reminderHoursBefore: 24,
      enabled: true,
    });

    const state = useMedicationStore.getState();
    expect(state.medications.length).toBe(1);
    expect(state.medications[0].name).toBe('Retatrutide');
    expect(state.medications[0].templateId).toBe('custom-xyz');
  });

  it('can update an existing dose', async () => {
    const store = useMedicationStore.getState();
    await store.addMedication(TEST_MED);
    const medId = useMedicationStore.getState().medications[0].id;
    await store.logDose({
      medicationId: medId,
      dosage: 1,
      unit: 'mg',
      injectionSite: 'abdomen-upper-left',
      dateTime: Date.now(),
      notes: 'Original',
    });
    const doseId = useMedicationStore.getState().doses[0].id;
    await store.updateDose(doseId, { dosage: 2.5, notes: 'Updated' });

    const dose = useMedicationStore.getState().doses[0];
    expect(dose.dosage).toBe(2.5);
    expect(dose.notes).toBe('Updated');
  });
});
