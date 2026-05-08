import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db, getSettings, setSetting, seedDatabaseIfEmpty, _resetSeedPromiseForTests } from './database';
import { MEDICATION_LIBRARY } from './seed';
import type { Medication, Dose, WeightEntry } from '../types';

const TEST_MED: Medication = {
  id: 'test-1',
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
  createdAt: Date.now(),
};

const TEST_DOSE: Dose = {
  id: 'dose-1',
  medicationId: 'test-1',
  dosage: 1,
  unit: 'mg',
  injectionSite: 'abdomen-upper-left',
  dateTime: Date.now(),
  notes: 'First dose',
  createdAt: Date.now(),
};

const TEST_WEIGHT: WeightEntry = {
  id: 'weight-1',
  weight: 85,
  unit: 'kg',
  dateTime: Date.now(),
  notes: '',
  createdAt: Date.now(),
};

describe('Database CRUD', () => {
  beforeEach(async () => {
    await db.medications.clear();
    await db.doses.clear();
    await db.weightEntries.clear();
    await db.vials.clear();
    await db.settings.clear();
    await db.customSideEffects.clear();
  });

  describe('medications', () => {
    it('can add and retrieve a medication', async () => {
      await db.medications.add(TEST_MED);
      const result = await db.medications.get('test-1');
      expect(result).toBeDefined();
      expect(result!.name).toBe('Semaglutide');
    });

    it('can update a medication', async () => {
      await db.medications.add(TEST_MED);
      await db.medications.update('test-1', { reminderHoursBefore: 48 });
      const result = await db.medications.get('test-1');
      expect(result!.reminderHoursBefore).toBe(48);
    });

    it('can delete a medication', async () => {
      await db.medications.add(TEST_MED);
      await db.medications.delete('test-1');
      const result = await db.medications.get('test-1');
      expect(result).toBeUndefined();
    });
  });

  describe('doses', () => {
    it('can add and retrieve a dose', async () => {
      await db.doses.add(TEST_DOSE);
      const result = await db.doses.get('dose-1');
      expect(result).toBeDefined();
      expect(result!.dosage).toBe(1);
    });

    it('can query doses by medication', async () => {
      await db.doses.add(TEST_DOSE);
      const results = await db.doses.where('medicationId').equals('test-1').toArray();
      expect(results).toHaveLength(1);
      expect(results[0].dosage).toBe(1);
    });
  });

  describe('weight entries', () => {
    it('can add and retrieve a weight entry', async () => {
      await db.weightEntries.add(TEST_WEIGHT);
      const result = await db.weightEntries.get('weight-1');
      expect(result).toBeDefined();
      expect(result!.weight).toBe(85);
    });

    it('can sort by date', async () => {
      await db.weightEntries.bulkAdd([
        TEST_WEIGHT,
        { ...TEST_WEIGHT, id: 'weight-2', weight: 84, dateTime: Date.now() + 1000 },
      ]);
      const results = await db.weightEntries.orderBy('dateTime').toArray();
      expect(results[0].weight).toBe(85);
      expect(results[1].weight).toBe(84);
    });
  });

  describe('settings', () => {
    it('can save and retrieve settings', async () => {
      await setSetting('notificationsEnabled', true);
      await setSetting('weightUnit', 'kg');
      const settings = await getSettings();
      expect(settings.notificationsEnabled).toBe(true);
      expect(settings.weightUnit).toBe('kg');
    });

    it('returns empty object when no settings', async () => {
      const settings = await getSettings();
      expect(settings).toEqual({});
    });
  });

  describe('vials', () => {
    it('can add and retrieve a vial', async () => {
      const vial = {
        id: 'vial-1',
        medicationId: 'test-1',
        name: 'Vial #1',
        peptideAmount: 10,
        peptideUnit: 'mg',
        bacWaterAmount: 2,
        reconstitutedAt: Date.now(),
        remainingOverride: null,
        notes: '',
        createdAt: Date.now(),
      };
      await db.vials.add(vial);
      const result = await db.vials.get('vial-1');
      expect(result).toBeDefined();
      expect(result!.peptideAmount).toBe(10);
    });

    it('can query vials by medication', async () => {
      const vial = {
        id: 'vial-1',
        medicationId: 'test-1',
        name: 'Vial #1',
        peptideAmount: 10,
        peptideUnit: 'mg',
        bacWaterAmount: 2,
        reconstitutedAt: Date.now(),
        remainingOverride: null,
        notes: '',
        createdAt: Date.now(),
      };
      await db.vials.add(vial);
      const results = await db.vials.where('medicationId').equals('test-1').toArray();
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Vial #1');
    });
  });

  describe('customSideEffects', () => {
    it('can add and retrieve custom side effects', async () => {
      await db.customSideEffects.put({ medicationId: 'med1', labels: ['Itchy palms'] });
      const result = await db.customSideEffects.get('med1');
      expect(result).toBeDefined();
      expect(result!.labels).toEqual(['Itchy palms']);
    });

    it('can update custom side effects', async () => {
      await db.customSideEffects.put({ medicationId: 'med1', labels: ['Itchy palms'] });
      await db.customSideEffects.put({ medicationId: 'med1', labels: ['Itchy palms', 'Dry mouth'] });
      const result = await db.customSideEffects.get('med1');
      expect(result!.labels).toEqual(['Itchy palms', 'Dry mouth']);
    });

    it('can query custom side effects by medicationId', async () => {
      await db.customSideEffects.bulkAdd([
        { medicationId: 'med1', labels: ['A'] },
        { medicationId: 'med2', labels: ['B'] },
      ]);
      const results = await db.customSideEffects.where('medicationId').equals('med1').toArray();
      expect(results).toHaveLength(1);
      expect(results[0].labels).toEqual(['A']);
    });
  });

  describe('customSideEffects', () => {
    it('can add and retrieve custom side effects', async () => {
      await db.customSideEffects.put({ medicationId: 'med1', labels: ['Itchy palms'] });
      const result = await db.customSideEffects.get('med1');
      expect(result).toBeDefined();
      expect(result!.labels).toEqual(['Itchy palms']);
    });

    it('can update custom side effects', async () => {
      await db.customSideEffects.put({ medicationId: 'med1', labels: ['Itchy palms'] });
      await db.customSideEffects.put({ medicationId: 'med1', labels: ['Itchy palms', 'Dry mouth'] });
      const result = await db.customSideEffects.get('med1');
      expect(result!.labels).toEqual(['Itchy palms', 'Dry mouth']);
    });

    it('can query custom side effects by medicationId', async () => {
      await db.customSideEffects.bulkAdd([
        { medicationId: 'med1', labels: ['A'] },
        { medicationId: 'med2', labels: ['B'] },
      ]);
      const results = await db.customSideEffects.where('medicationId').equals('med1').toArray();
      expect(results).toHaveLength(1);
      expect(results[0].labels).toEqual(['A']);
    });
  });

  describe('seedDatabaseIfEmpty', () => {
    beforeEach(() => {
      _resetSeedPromiseForTests();
    });

    it('seeds library medications when DB is empty', async () => {
      await seedDatabaseIfEmpty();
      const meds = await db.medications.toArray();
      expect(meds.length).toBe(MEDICATION_LIBRARY.length);
    });

    it('does not create duplicates on repeated calls', async () => {
      await seedDatabaseIfEmpty();
      await seedDatabaseIfEmpty();
      await seedDatabaseIfEmpty();
      const meds = await db.medications.toArray();
      expect(meds.length).toBe(MEDICATION_LIBRARY.length);
    });

    it('does not create duplicates on concurrent calls', async () => {
      await Promise.all([
        seedDatabaseIfEmpty(),
        seedDatabaseIfEmpty(),
        seedDatabaseIfEmpty(),
      ]);
      const meds = await db.medications.toArray();
      expect(meds.length).toBe(MEDICATION_LIBRARY.length);
    });

    it('deduplicates existing library medications', async () => {
      const libraryTemplate = MEDICATION_LIBRARY[0];
      await db.medications.bulkAdd([
        { ...TEST_MED, id: 'dup-1', templateId: libraryTemplate.id, createdAt: 1000 },
        { ...TEST_MED, id: 'dup-2', templateId: libraryTemplate.id, createdAt: 2000 },
      ]);
      await seedDatabaseIfEmpty();
      const meds = await db.medications.toArray();
      const semaMeds = meds.filter((m) => m.templateId === libraryTemplate.id);
      expect(semaMeds.length).toBe(1);
      expect(semaMeds[0].id).toBe('dup-1'); // oldest kept
    });

    it('preserves custom medications during deduplication', async () => {
      const customMed: Medication = {
        ...TEST_MED,
        id: 'custom-1',
        templateId: 'custom-abc',
        name: 'Custom Peptide',
      };
      await db.medications.add(customMed);
      await seedDatabaseIfEmpty();
      const meds = await db.medications.toArray();
      const custom = meds.find((m) => m.id === 'custom-1');
      expect(custom).toBeDefined();
      expect(custom!.name).toBe('Custom Peptide');
    });
  });
});
