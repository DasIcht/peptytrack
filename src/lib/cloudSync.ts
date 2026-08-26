import { db, getSettings } from '../db/database';
import type { BackupData } from '../types';
import { validateBackup } from './backupValidation';

const BACKUP_VERSION = 8;

/**
 * Migration pipeline: Each function transforms data from version N to N+1.
 */
const migrations: Record<number, (data: any) => any> = {
  1: (data) => ({
    ...data,
    vials: data.vials || [],
    customSideEffects: data.customSideEffects || [],
    version: 2
  }),
  2: (data) => ({
    ...data,
    protocols: data.protocols || [],
    version: 3
  }),
  3: (data) => ({
    ...data,
    symptomLogs: data.symptomLogs || [],
    version: 4
  }),
  4: (data) => {
    // Convert old string sideEffects to object format if needed
    const doses = (data.doses || []).map((dose: any) => {
      if (dose.sideEffects && dose.sideEffects.length > 0 && typeof dose.sideEffects[0] === 'string') {
        return {
          ...dose,
          sideEffects: dose.sideEffects.map((label: string) => ({ label, severity: 'mild' }))
        };
      }
      return dose;
    });
    return { ...data, doses, version: 5 };
  },
  5: (data) => ({
    ...data,
    appVersion: data.appVersion || 'unknown',
    version: 6
  }),
  6: (data) => ({
    ...data,
    symptomLogs: (data.symptomLogs || []).map((log: any) => ({
      notes: '',
      ...log,
    })),
    version: 7
  }),
  7: (data) => ({
    ...data,
    protocols: (data.protocols || []).map((protocol: any) => ({
      targetType: 'weekly-equivalent',
      ...protocol,
    })),
    version: 8
  }),
};

/**
 * Export all data as a JSON blob for download or cloud upload.
 */
export async function exportData(): Promise<BackupData> {
  const medications = await db.medications.toArray();
  const doses = await db.doses.toArray();
  const weightEntries = await db.weightEntries.toArray();
  const vials = await db.vials.toArray();
  const settings = await getSettings();
  const customSideEffects = await db.customSideEffects.toArray();
  const protocols = await db.protocols.toArray();
  const symptomLogs = await db.symptomLogs.toArray();

  return {
    version: BACKUP_VERSION,
    appVersion: import.meta.env.VITE_APP_VERSION || 'unknown',
    exportedAt: Date.now(),
    medications,
    doses,
    weightEntries,
    vials,
    settings,
    customSideEffects,
    protocols,
    symptomLogs,
  };
}

export function downloadBackupJSON(data: BackupData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `peptytrack-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import data from JSON backup, applying migrations and replacing all current data.
 */
export async function importData(data: any): Promise<void> {
  let migratedData = { ...data };
  let version = migratedData.version || 1;

  if (version > BACKUP_VERSION) {
    throw new Error(`Unsupported backup version: ${version}. Please update the app.`);
  }

  // Run migrations sequentially
  while (version < BACKUP_VERSION) {
    const migration = migrations[version];
    if (!migration) {
      throw new Error(`Missing migration pathway from version ${version}`);
    }
    migratedData = migration(migratedData);
    version = migratedData.version;
  }

  // Final structural validation
  validateBackup(migratedData);

  await db.transaction('rw', [
    db.medications, 
    db.doses, 
    db.weightEntries, 
    db.vials, 
    db.settings, 
    db.customSideEffects, 
    db.protocols, 
    db.symptomLogs
  ], async () => {
    await db.medications.clear();
    await db.doses.clear();
    await db.weightEntries.clear();
    await db.vials.clear();
    await db.settings.clear();
    await db.customSideEffects.clear();
    await db.protocols.clear();
    await db.symptomLogs.clear();

    if (migratedData.medications.length) await db.medications.bulkAdd(migratedData.medications);
    if (migratedData.doses.length) await db.doses.bulkAdd(migratedData.doses);
    if (migratedData.weightEntries.length) await db.weightEntries.bulkAdd(migratedData.weightEntries);
    if (migratedData.vials?.length) await db.vials.bulkAdd(migratedData.vials);
    
    if (migratedData.settings && Object.keys(migratedData.settings).length > 0) {
      for (const [key, value] of Object.entries(migratedData.settings)) {
        await db.settings.put({ id: key, value });
      }
    }
    
    if (migratedData.customSideEffects?.length) {
      await db.customSideEffects.bulkAdd(migratedData.customSideEffects);
    }
    
    if (migratedData.protocols?.length) await db.protocols.bulkAdd(migratedData.protocols);
    if (migratedData.symptomLogs?.length) await db.symptomLogs.bulkAdd(migratedData.symptomLogs);
  });
}

/**
 * Completely wipe the database and reset all settings to defaults.
 */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [
    db.medications,
    db.doses,
    db.weightEntries,
    db.vials,
    db.settings,
    db.customSideEffects,
    db.protocols,
    db.symptomLogs
  ], async () => {
    await db.medications.clear();
    await db.doses.clear();
    await db.weightEntries.clear();
    await db.vials.clear();
    await db.settings.clear();
    await db.customSideEffects.clear();
    await db.protocols.clear();
    await db.symptomLogs.clear();
  });
}

