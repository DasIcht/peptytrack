/**
 * Tests for the googleDriveBackup service layer.
 *
 * RED->GREEN TDD: these tests are written first. They mock:
 *   - window.gapi / window.google (Google Identity Services & GAPI client)
 *   - fetch (Google Drive REST endpoints)
 *   - import.meta.env (Vite build-time env vars)
 *
 * The low-level helpers in `./cloudSync` are MOCKED at the module boundary so the
 * service layer can be exercised without network or real OAuth popups.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ---- Mock cloudSync low-level functions ----
const mockAuthenticateGoogleDrive = vi.fn();
const mockUploadToGoogleDrive = vi.fn();
const mockListBackupsOnGoogleDrive = vi.fn();
const mockDownloadFromGoogleDrive = vi.fn();
const mockExportData = vi.fn();
const mockImportData = vi.fn();
const mockValidateBackup = vi.fn();

vi.mock('./cloudSync', () => ({
  authenticateGoogleDrive: (...args: any[]) => mockAuthenticateGoogleDrive(...args),
  uploadToGoogleDrive: (...args: any[]) => mockUploadToGoogleDrive(...args),
  listBackupsOnGoogleDrive: (...args: any[]) => mockListBackupsOnGoogleDrive(...args),
  downloadFromGoogleDrive: (...args: any[]) => mockDownloadFromGoogleDrive(...args),
  exportData: (...args: any[]) => mockExportData(...args),
  importData: (...args: any[]) => mockImportData(...args),
}));

vi.mock('./backupValidation', () => ({
  validateBackup: (...args: any[]) => mockValidateBackup(...args),
}));

import {
  getGoogleDriveClientId,
  isGoogleDriveBackupConfigured,
  authenticateGoogleDrive,
  backupToGoogleDrive,
  restoreFromGoogleDrive,
} from './googleDriveBackup';
import { db } from '../db/database';

// ---- Helpers ----

/** Construct a minimal BackupData-shaped object. */
function makeBackupData(overrides: Partial<any> = {}) {
  return {
    version: 8,
    appVersion: 'test',
    exportedAt: 1000,
    medications: [],
    doses: [],
    weightEntries: [],
    vials: [],
    settings: {},
    customSideEffects: [],
    protocols: [],
    symptomLogs: [],
    ...overrides,
  };
}

describe('googleDriveBackup — env helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('getGoogleDriveClientId', () => {
    it('returns the value of VITE_GOOGLE_DRIVE_CLIENT_ID when set', () => {
      vi.stubEnv('VITE_GOOGLE_DRIVE_CLIENT_ID', 'client-id-xyz');
      expect(getGoogleDriveClientId()).toBe('client-id-xyz');
    });

    it('returns undefined when VITE_GOOGLE_DRIVE_CLIENT_ID is unset', () => {
      vi.stubEnv('VITE_GOOGLE_DRIVE_CLIENT_ID', '');
      const value = getGoogleDriveClientId();
      expect(value === '' || value === undefined).toBe(true);
    });
  });

  describe('isGoogleDriveBackupConfigured', () => {
    it('returns true when the Client ID is configured', () => {
      vi.stubEnv('VITE_GOOGLE_DRIVE_CLIENT_ID', 'c');
      expect(isGoogleDriveBackupConfigured()).toBe(true);
    });

    it('returns false when the Client ID is missing', () => {
      vi.stubEnv('VITE_GOOGLE_DRIVE_CLIENT_ID', '');
      expect(isGoogleDriveBackupConfigured()).toBe(false);
    });
  });
});

describe('googleDriveBackup — authenticateGoogleDrive', () => {
  beforeEach(() => {
    mockAuthenticateGoogleDrive.mockReset();
  });

  it('returns null when not configured (no Client ID)', async () => {
    const result = await authenticateGoogleDrive();
    expect(result).toBeNull();
    expect(mockAuthenticateGoogleDrive).not.toHaveBeenCalled();
  });

  it('authenticates and returns an access token', async () => {
    mockAuthenticateGoogleDrive.mockResolvedValueOnce('tok-123');
    const token = await authenticateGoogleDrive('client-xyz');
    expect(token).toBe('tok-123');
    expect(mockAuthenticateGoogleDrive).toHaveBeenCalledWith('client-xyz');
  });

  it('propagates an error from authenticateGoogleDrive', async () => {
    mockAuthenticateGoogleDrive.mockRejectedValueOnce(new Error('user denied'));
    await expect(authenticateGoogleDrive('client-xyz')).rejects.toThrow('user denied');
  });
});

describe('googleDriveBackup — backupToGoogleDrive', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await db.medications.clear();
    await db.doses.clear();
    await db.weightEntries.clear();
    await db.vials.clear();
    await db.settings.clear();
    await db.customSideEffects.clear();
    await db.protocols.clear();
    await db.symptomLogs.clear();
    mockValidateBackup.mockImplementation(() => undefined);
  });

  it('creates a new backup when no existing file is found', async () => {
    const exported = makeBackupData({ medications: [], doses: [] });
    mockExportData.mockResolvedValueOnce(exported);
    mockListBackupsOnGoogleDrive.mockResolvedValueOnce([]);
    mockUploadToGoogleDrive.mockResolvedValueOnce('file-new');

    const result = await backupToGoogleDrive('tok');

    expect(result.success).toBe(true);
    expect(result.fileId).toBe('file-new');
    expect(mockUploadToGoogleDrive).toHaveBeenCalledTimes(1);
    const [tokArg, filenameArg, contentArg] = mockUploadToGoogleDrive.mock.calls[0];
    expect(tokArg).toBe('tok');
    expect(filenameArg).toBe('peptytrack-backup.json');
    expect(JSON.parse(contentArg)).toEqual(exported);
  });

  it('updates the existing backup file in place (no duplicates)', async () => {
    const exported = makeBackupData();
    mockExportData.mockResolvedValueOnce(exported);
    mockListBackupsOnGoogleDrive.mockResolvedValueOnce([
      { id: 'existing-id', name: 'peptytrack-backup.json' },
    ]);
    // updateBackupFileOnGoogleDrive uses fetch directly — mock fetch
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const result = await backupToGoogleDrive('tok');

    expect(result.success).toBe(true);
    expect(result.fileId).toBe('existing-id');
    expect(mockUploadToGoogleDrive).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('existing-id');
    expect(init.method).toBe('PATCH');
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('stores the file id in settings after a successful backup', async () => {
    const exported = makeBackupData();
    mockExportData.mockResolvedValueOnce(exported);
    mockListBackupsOnGoogleDrive.mockResolvedValueOnce([]);
    mockUploadToGoogleDrive.mockResolvedValueOnce('file-abc');

    await backupToGoogleDrive('tok');

    const stored = await db.settings.get('googleDriveBackupFileId');
    expect(stored?.value).toBe('file-abc');
  });

  it('uses the existing fileId from settings when listings fail or are empty', async () => {
    const exported = makeBackupData();
    mockExportData.mockResolvedValueOnce(exported);
    mockListBackupsOnGoogleDrive.mockResolvedValueOnce([]);
    // pre-seed the file id in settings
    await db.settings.put({ id: 'googleDriveBackupFileId', value: 'preexisting-id' });
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const result = await backupToGoogleDrive('tok');

    expect(result.success).toBe(true);
    expect(result.fileId).toBe('preexisting-id');
    expect(mockUploadToGoogleDrive).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns an error result when exportData throws', async () => {
    mockExportData.mockRejectedValueOnce(new Error('db read failed'));

    const result = await backupToGoogleDrive('tok');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/db read failed/);
    expect(mockUploadToGoogleDrive).not.toHaveBeenCalled();
  });

  it('returns an error result when the upload fails', async () => {
    const exported = makeBackupData();
    mockExportData.mockResolvedValueOnce(exported);
    mockListBackupsOnGoogleDrive.mockResolvedValueOnce([]);
    mockUploadToGoogleDrive.mockRejectedValueOnce(new Error('network down'));

    const result = await backupToGoogleDrive('tok');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/network down/);
  });

  it('returns an error result when the update (PATCH) fails', async () => {
    const exported = makeBackupData();
    mockExportData.mockResolvedValueOnce(exported);
    mockListBackupsOnGoogleDrive.mockResolvedValueOnce([
      { id: 'old-id', name: 'peptytrack-backup.json' },
    ]);
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      statusText: 'Forbidden',
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await backupToGoogleDrive('tok');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Forbidden/);
  });

  it('falls back to a fresh upload when only a stale stored fileId is present', async () => {
    const exported = makeBackupData();
    mockExportData.mockResolvedValueOnce(exported);
    // Live list returns nothing; stored id has been deleted on Drive side.
    mockListBackupsOnGoogleDrive.mockResolvedValueOnce([]);
    await db.settings.put({ id: 'googleDriveBackupFileId', value: 'stale-id' });
    // PATCH attempt fails (e.g. 404)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: false, statusText: 'Not Found' })
    );
    mockUploadToGoogleDrive.mockResolvedValueOnce('fresh-id');

    const result = await backupToGoogleDrive('tok');

    expect(result.success).toBe(true);
    expect(result.fileId).toBe('fresh-id');
    expect(mockUploadToGoogleDrive).toHaveBeenCalledTimes(1);
  });
});

describe('googleDriveBackup — restoreFromGoogleDrive', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await db.medications.clear();
    await db.doses.clear();
    await db.weightEntries.clear();
    await db.vials.clear();
    await db.settings.clear();
    await db.customSideEffects.clear();
    await db.protocols.clear();
    await db.symptomLogs.clear();
    mockValidateBackup.mockImplementation(() => undefined);
  });

  it('restores the most recent backup and stores its fileId in settings', async () => {
    const backup = makeBackupData({ medications: [{ id: 'med-1' }] });
    mockListBackupsOnGoogleDrive.mockResolvedValueOnce([
      { id: 'b1', name: 'peptytrack-backup.json' },
      { id: 'b2', name: 'peptytrack-backup-old.json' },
    ]);
    mockDownloadFromGoogleDrive.mockResolvedValueOnce(JSON.stringify(backup));
    mockImportData.mockResolvedValueOnce(undefined);

    const result = await restoreFromGoogleDrive('tok');

    expect(result.success).toBe(true);
    expect(result.fileId).toBe('b1');
    expect(mockDownloadFromGoogleDrive).toHaveBeenCalledWith('tok', 'b1');
    expect(mockImportData).toHaveBeenCalledWith(backup);

    const stored = await db.settings.get('googleDriveBackupFileId');
    expect(stored?.value).toBe('b1');
  });

  it('restores using a stored fileId if no live backups found', async () => {
    const backup = makeBackupData();
    await db.settings.put({ id: 'googleDriveBackupFileId', value: 'cached-id' });
    mockListBackupsOnGoogleDrive.mockResolvedValueOnce([]);
    mockDownloadFromGoogleDrive.mockResolvedValueOnce(JSON.stringify(backup));
    mockImportData.mockResolvedValueOnce(undefined);

    const result = await restoreFromGoogleDrive('tok');

    expect(result.success).toBe(true);
    expect(result.fileId).toBe('cached-id');
    expect(mockDownloadFromGoogleDrive).toHaveBeenCalledWith('tok', 'cached-id');
  });

  it('returns an error if no backup exists anywhere', async () => {
    mockListBackupsOnGoogleDrive.mockResolvedValueOnce([]);

    const result = await restoreFromGoogleDrive('tok');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no backup/i);
    expect(mockDownloadFromGoogleDrive).not.toHaveBeenCalled();
    expect(mockImportData).not.toHaveBeenCalled();
  });

  it('validates the downloaded JSON with validateBackup', async () => {
    const backup = makeBackupData();
    mockListBackupsOnGoogleDrive.mockResolvedValueOnce([
      { id: 'f1', name: 'peptytrack-backup.json' },
    ]);
    mockDownloadFromGoogleDrive.mockResolvedValueOnce(JSON.stringify(backup));
    mockImportData.mockResolvedValueOnce(undefined);
    mockValidateBackup.mockImplementation(() => undefined);

    await restoreFromGoogleDrive('tok');

    expect(mockValidateBackup).toHaveBeenCalledWith(backup);
  });

  it('rejects downloaded payloads that fail validation', async () => {
    const invalid = { foo: 'bar' };
    mockListBackupsOnGoogleDrive.mockResolvedValueOnce([
      { id: 'f1', name: 'peptytrack-backup.json' },
    ]);
    mockDownloadFromGoogleDrive.mockResolvedValueOnce(JSON.stringify(invalid));
    mockValidateBackup.mockImplementationOnce(() => {
      throw new Error('invalid shape');
    });

    const result = await restoreFromGoogleDrive('tok');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid shape/);
    expect(mockImportData).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON gracefully', async () => {
    mockListBackupsOnGoogleDrive.mockResolvedValueOnce([
      { id: 'f1', name: 'peptytrack-backup.json' },
    ]);
    mockDownloadFromGoogleDrive.mockResolvedValueOnce('{not valid json');

    const result = await restoreFromGoogleDrive('tok');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/JSON|JSON.parse/i);
    expect(mockImportData).not.toHaveBeenCalled();
  });

  it('returns an error if listBackupsOnGoogleDrive fails', async () => {
    mockListBackupsOnGoogleDrive.mockRejectedValueOnce(new Error('401 unauthorized'));

    const result = await restoreFromGoogleDrive('tok');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/401 unauthorized/);
  });

  it('returns an error if download fails', async () => {
    mockListBackupsOnGoogleDrive.mockResolvedValueOnce([
      { id: 'f1', name: 'peptytrack-backup.json' },
    ]);
    mockDownloadFromGoogleDrive.mockRejectedValueOnce(new Error('network down'));

    const result = await restoreFromGoogleDrive('tok');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/network down/);
  });
});
