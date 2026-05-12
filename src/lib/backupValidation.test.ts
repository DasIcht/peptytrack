import { describe, it, expect } from 'vitest';
import { validateBackup } from './backupValidation';

describe('validateBackup', () => {
  const validBackup = {
    version: 6,
    exportedAt: Date.now(),
    medications: [],
    doses: [],
    weightEntries: [],
    vials: [],
    settings: {},
    customSideEffects: [],
    protocols: [],
    symptomLogs: [],
  };

  it('accepts a valid backup structure', () => {
    expect(() => validateBackup(validBackup)).not.toThrow();
  });

  it('throws on non-object input', () => {
    expect(() => validateBackup(null)).toThrow('Backup data must be an object');
    expect(() => validateBackup('string')).toThrow('Backup data must be an object');
  });

  it('throws on missing version', () => {
    const invalid = { ...validBackup };
    delete (invalid as any).version;
    expect(() => validateBackup(invalid)).toThrow('Missing or invalid "version" field');
  });

  it('throws on missing required arrays', () => {
    const invalid = { ...validBackup };
    delete (invalid as any).medications;
    expect(() => validateBackup(invalid)).toThrow('Missing or invalid "medications" array');
  });

  it('throws on missing settings object', () => {
    const invalid = { ...validBackup };
    delete (invalid as any).settings;
    expect(() => validateBackup(invalid)).toThrow('Missing or invalid "settings" object');
  });

  it('validates medication items if present', () => {
    const invalid = {
      ...validBackup,
      medications: [{ id: '1' }] // missing name
    };
    expect(() => validateBackup(invalid)).toThrow('Invalid medication data: missing id or name');
  });

  it('validates dose items if present', () => {
    const invalid = {
      ...validBackup,
      doses: [{ id: '1', medicationId: 'm1' }] // missing dateTime
    };
    expect(() => validateBackup(invalid)).toThrow('Invalid dose data: missing id, medicationId, or dateTime');
  });
});
