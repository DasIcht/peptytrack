import Dexie, { type Table } from 'dexie';
import type { Medication, Dose, WeightEntry } from '../types';
import { MEDICATION_LIBRARY } from './seed';

class PeptyTrackDB extends Dexie {
  medications!: Table<Medication, string>;
  doses!: Table<Dose, string>;
  weightEntries!: Table<WeightEntry, string>;
  settings!: Table<{ id: string; value: unknown }, string>;

  constructor() {
    super('PeptyTrackDB');
    this.version(1).stores({
      medications: 'id, activeIngredient, createdAt',
      doses: 'id, medicationId, dateTime, createdAt',
      weightEntries: 'id, dateTime, createdAt',
      settings: 'id',
    });
  }
}

export const db = new PeptyTrackDB();

export async function getSettings(): Promise<Record<string, unknown>> {
  const all = await db.settings.toArray();
  return Object.fromEntries(all.map((s) => [s.id, s.value]));
}

export async function setSetting(id: string, value: unknown): Promise<void> {
  await db.settings.put({ id, value });
}

let seedPromise: Promise<void> | null = null;

/** Reset the seed guard. For tests only. */
export function _resetSeedPromiseForTests(): void {
  seedPromise = null;
}

export async function seedDatabaseIfEmpty(): Promise<void> {
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    const allMeds = await db.medications.toArray();
    const libraryIds = new Set(MEDICATION_LIBRARY.map((t) => t.id));

    // Deduplicate library medications (keep the oldest createdAt)
    const seenLibraryIds = new Map<string, string>(); // templateId -> id to keep
    const idsToDelete: string[] = [];

    for (const med of allMeds) {
      if (!libraryIds.has(med.templateId)) continue; // skip custom meds
      if (seenLibraryIds.has(med.templateId)) {
        idsToDelete.push(med.id);
      } else {
        seenLibraryIds.set(med.templateId, med.id);
      }
    }

    if (idsToDelete.length > 0) {
      await db.medications.bulkDelete(idsToDelete);
    }

    const existingTemplateIds = new Set(seenLibraryIds.keys());

    const toAdd = MEDICATION_LIBRARY
      .filter((t) => !existingTemplateIds.has(t.id))
      .map((t) => ({
        id: crypto.randomUUID(),
        templateId: t.id,
        name: t.name,
        brand: t.brand,
        activeIngredient: t.activeIngredient,
        dosageOptions: t.dosageOptions,
        unit: t.unit,
        frequency: t.frequency,
        halfLifeHours: t.halfLifeHours,
        color: t.color,
        reminderHoursBefore: t.frequency === 'daily' ? 1 : 24,
        enabled: true,
        createdAt: Date.now(),
      }));

    if (toAdd.length > 0) {
      await db.medications.bulkAdd(toAdd);
    }
  })();

  return seedPromise;
}
