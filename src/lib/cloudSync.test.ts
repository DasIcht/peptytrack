import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/database';
import { exportData, importData } from './cloudSync';

describe('cloudSync', () => {
  beforeEach(async () => {
    await db.medications.clear();
    await db.doses.clear();
    await db.weightEntries.clear();
    await db.vials.clear();
    await db.settings.clear();
    await db.customSideEffects.clear();
    await db.protocols.clear();
    await db.symptomLogs.clear();
  });

  it('v1 backup round-trips via migrations', async () => {
    const v1Data = {
      version: 1,
      exportedAt: 1000,
      medications: [{ 
        id: 'm1', 
        name: 'Med 1', 
        templateId: 't1', 
        brand: 'B1', 
        activeIngredient: 'A1', 
        dosageOptions: [1], 
        unit: 'mg', 
        frequency: 'daily', 
        halfLifeHours: 24, 
        color: 'red', 
        reminderHoursBefore: 1, 
        enabled: true, 
        createdAt: 1000 
      }],
      doses: [{ 
        id: 'd1', 
        medicationId: 'm1', 
        dosage: 1, 
        unit: 'mg', 
        injectionSite: 'thigh-left', 
        dateTime: 1000, 
        notes: '', 
        createdAt: 1000 
      }],
      weightEntries: [],
      settings: { theme: 'dark' }
    };

    await importData(v1Data);

    const meds = await db.medications.toArray();
    expect(meds).toHaveLength(1);
    expect(meds[0].name).toBe('Med 1');

    const exported = await exportData();
    expect(exported.version).toBe(7);
    expect(exported.vials).toEqual([]);
    expect(exported.protocols).toEqual([]);
    expect(exported.appVersion).toBeDefined();
  });

  it('v4 sideEffect migration works', async () => {
    const v4Data = {
      version: 4,
      exportedAt: 1000,
      medications: [],
      doses: [
        { 
          id: 'd1', 
          medicationId: 'm1', 
          dosage: 1, 
          unit: 'mg', 
          injectionSite: 'thigh-left', 
          dateTime: 1000, 
          sideEffects: ['Nausea', 'Headache'],
          notes: '',
          createdAt: 1000 
        }
      ],
      weightEntries: [],
      vials: [],
      settings: {},
      customSideEffects: [],
      protocols: [],
      symptomLogs: []
    };

    await importData(v4Data);

    const doses = await db.doses.toArray();
    expect(doses[0].sideEffects).toEqual([
      { label: 'Nausea', severity: 'mild' },
      { label: 'Headache', severity: 'mild' }
    ]);
  });

  it('v6 to v7 migration backfills symptomLog notes', async () => {
    const v6Data = {
      version: 6,
      exportedAt: 1000,
      medications: [],
      doses: [],
      weightEntries: [],
      vials: [],
      settings: {},
      customSideEffects: [],
      protocols: [],
      symptomLogs: [
        {
          id: 'sl1',
          medicationId: 'm1',
          dateTime: 1000,
          symptoms: [{ label: 'Nausea', severity: 'mild' }],
          createdAt: 1000
        }
      ]
    };

    await importData(v6Data);

    const logs = await db.symptomLogs.toArray();
    expect(logs).toHaveLength(1);
    expect(logs[0].notes).toBe('');
  });

  it('full round-trip preserves all data', async () => {
    // Setup some data
    const med = { 
      id: 'm1', 
      name: 'Med 1', 
      templateId: 't1', 
      brand: 'B1', 
      activeIngredient: 'A1', 
      dosageOptions: [1], 
      unit: 'mg', 
      frequency: 'daily', 
      halfLifeHours: 24, 
      color: 'red', 
      reminderHoursBefore: 1, 
      enabled: true, 
      createdAt: 1000 
    };
    await db.medications.add(med as any);
    await db.settings.put({ id: 'unit', value: 'kg' });
    
    const firstExport = await exportData();
    expect(firstExport.version).toBe(7);
    expect(firstExport.medications).toHaveLength(1);

    // Clear and import
    await db.medications.clear();
    await db.settings.clear();
    await importData(firstExport);

    const secondExport = await exportData();
    
    // Ignore exportedAt for comparison
    const expected = { ...firstExport, exportedAt: 0 };
    const actual = { ...secondExport, exportedAt: 0 };
    
    expect(actual).toEqual(expected);
  });

  it('rejects future versions', async () => {
    const futureData = { version: 99 };
    await expect(importData(futureData)).rejects.toThrow('Unsupported backup version');
  });
});
