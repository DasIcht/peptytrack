import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { useSymptomLogStore } from './symptomLogStore';
import { db } from '../db/database';

describe('symptomLogStore', () => {
  beforeEach(async () => {
    await db.symptomLogs.clear();
    useSymptomLogStore.setState({ logs: [], initialized: false });
  });

  it('initializes and loads data', async () => {
    const log = {
      id: 'l1',
      medicationId: 'm1',
      dateTime: Date.now(),
      symptoms: [{ label: 'Nausea', severity: 'moderate' as const }],
      notes: 'Initial note',
      createdAt: Date.now(),
    };
    await db.symptomLogs.add(log);

    const store = useSymptomLogStore.getState();
    await store.loadData();

    expect(useSymptomLogStore.getState().logs).toHaveLength(1);
    expect(useSymptomLogStore.getState().logs[0].id).toBe('l1');
    expect(useSymptomLogStore.getState().logs[0].notes).toBe('Initial note');
    expect(useSymptomLogStore.getState().initialized).toBe(true);
  });

  it('logs a symptom', async () => {
    const store = useSymptomLogStore.getState();
    await store.logSymptom({
      medicationId: 'm1',
      dateTime: Date.now(),
      symptoms: [{ label: 'Headache', severity: 'mild' as const }],
      notes: 'Headache note',
    });

    const logs = await db.symptomLogs.toArray();
    expect(logs).toHaveLength(1);
    expect(logs[0].symptoms[0].label).toBe('Headache');
    expect(logs[0].notes).toBe('Headache note');
    expect(useSymptomLogStore.getState().logs).toHaveLength(1);
  });

  it('updates a symptom log', async () => {
    const store = useSymptomLogStore.getState();
    const id = await store.logSymptom({
      medicationId: 'm1',
      dateTime: Date.now(),
      symptoms: [{ label: 'Fatigue', severity: 'mild' as const }],
      notes: '',
    });

    await store.updateLog(id, {
      symptoms: [{ label: 'Fatigue', severity: 'severe' as const }],
      notes: 'Updated fatigue note',
    });

    const log = await db.symptomLogs.get(id);
    expect(log?.symptoms[0].severity).toBe('severe');
    expect(log?.notes).toBe('Updated fatigue note');
    expect(useSymptomLogStore.getState().logs[0].symptoms[0].severity).toBe('severe');
    expect(useSymptomLogStore.getState().logs[0].notes).toBe('Updated fatigue note');
  });

  it('deletes a symptom log', async () => {
    const store = useSymptomLogStore.getState();
    const id = await store.logSymptom({
      medicationId: 'm1',
      dateTime: Date.now(),
      symptoms: [],
      notes: '',
    });

    await store.deleteLog(id);
    const logs = await db.symptomLogs.toArray();
    expect(logs).toHaveLength(0);
    expect(useSymptomLogStore.getState().logs).toHaveLength(0);
  });

  it('saves and retrieves notes field', async () => {
    const store = useSymptomLogStore.getState();
    const id = await store.logSymptom({
      medicationId: 'm1',
      dateTime: Date.now(),
      symptoms: [{ label: 'Nausea', severity: 'mild' as const }],
      notes: 'Feeling rough after lunch',
    });
    const log = await db.symptomLogs.get(id);
    expect(log?.notes).toBe('Feeling rough after lunch');
  });

  it('updates notes on an existing symptom log', async () => {
    const store = useSymptomLogStore.getState();
    const id = await store.logSymptom({
      medicationId: 'm1',
      dateTime: Date.now(),
      symptoms: [],
      notes: '',
    });
    await store.updateLog(id, { notes: 'Updated observation' });
    const log = await db.symptomLogs.get(id);
    expect(log?.notes).toBe('Updated observation');
    expect(useSymptomLogStore.getState().logs[0].notes).toBe('Updated observation');
  });
});
