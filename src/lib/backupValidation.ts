import type { BackupData } from '../types';

/**
 * Validates that the input data follows the expected BackupData structure.
 * Throws an error if validation fails.
 */
export function validateBackup(data: any): asserts data is BackupData {
  if (!data || typeof data !== 'object') {
    throw new Error('Backup data must be an object');
  }

  const requiredArrays = [
    'medications',
    'doses',
    'weightEntries',
    'vials',
    'customSideEffects',
    'protocols',
    'symptomLogs',
  ];

  if (typeof data.version !== 'number') {
    throw new Error('Missing or invalid "version" field');
  }

  if (typeof data.exportedAt !== 'number') {
    throw new Error('Missing or invalid "exportedAt" field');
  }

  for (const key of requiredArrays) {
    if (!Array.isArray(data[key])) {
      throw new Error(`Missing or invalid "${key}" array`);
    }
  }

  if (!data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) {
    throw new Error('Missing or invalid "settings" object');
  }

  // Basic item validation for medications and doses as they are critical
  if (data.medications.length > 0) {
    const first = data.medications[0];
    if (!first.id || !first.name) {
      throw new Error('Invalid medication data: missing id or name');
    }
  }

  if (data.doses.length > 0) {
    const first = data.doses[0];
    if (!first.id || !first.medicationId || typeof first.dateTime !== 'number') {
      throw new Error('Invalid dose data: missing id, medicationId, or dateTime');
    }
  }

  if (data.protocols && data.protocols.length > 0) {
    const first = data.protocols[0];
    if (!first.id || !first.medicationId || !first.targetType) {
      throw new Error('Invalid protocol data: missing id, medicationId, or targetType');
    }
  }
}
