import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Google Drive module — we must not touch the real implementation.
vi.mock('./googleDriveBackup', () => ({
  isGoogleDriveBackupConfigured: vi.fn(() => true),
  authenticateGoogleDrive: vi.fn(async () => 'token-123'),
  backupToGoogleDrive: vi.fn(async () => ({ success: true, fileId: 'file-1' })),
  restoreFromGoogleDrive: vi.fn(async () => ({ success: true })),
}));

import {
  runAutoBackup,
  getAutoBackup,
  clearAutoBackup,
} from './autoBackup';
import * as gdrive from './googleDriveBackup';

const JSON_PAYLOAD = JSON.stringify({ version: 5, medications: [] });

describe('runAutoBackup — local backup', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(gdrive.isGoogleDriveBackupConfigured).mockReturnValue(true);
    vi.mocked(gdrive.authenticateGoogleDrive).mockResolvedValue('token-123');
    vi.mocked(gdrive.backupToGoogleDrive).mockResolvedValue({ success: true, fileId: 'file-1' });
  });

  it('always writes the payload to localStorage', async () => {
    const result = await runAutoBackup(JSON_PAYLOAD);

    expect(result.localSaved).toBe(true);
    expect(getAutoBackup()).toBe(JSON_PAYLOAD);
  });

  it('skips Google Drive when the setting is disabled', async () => {
    const result = await runAutoBackup(JSON_PAYLOAD, { googleDriveEnabled: false });

    expect(result.googleDrive).toEqual({ status: 'skipped', reason: 'disabled' });
    expect(gdrive.authenticateGoogleDrive).not.toHaveBeenCalled();
    expect(gdrive.backupToGoogleDrive).not.toHaveBeenCalled();
  });

  it('defaults to skipping Google Drive when no options are given', async () => {
    const result = await runAutoBackup(JSON_PAYLOAD);

    expect(result.googleDrive.status).toBe('skipped');
    expect(gdrive.backupToGoogleDrive).not.toHaveBeenCalled();
  });

  it('clearAutoBackup removes the stored payload', async () => {
    await runAutoBackup(JSON_PAYLOAD);
    clearAutoBackup();
    expect(getAutoBackup()).toBeNull();
  });
});

describe('runAutoBackup — Google Drive backup', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(gdrive.isGoogleDriveBackupConfigured).mockReturnValue(true);
    vi.mocked(gdrive.authenticateGoogleDrive).mockResolvedValue('token-123');
    vi.mocked(gdrive.backupToGoogleDrive).mockResolvedValue({ success: true, fileId: 'file-1' });
  });

  it('authenticates and uploads when enabled and configured', async () => {
    const result = await runAutoBackup(JSON_PAYLOAD, { googleDriveEnabled: true });

    expect(gdrive.authenticateGoogleDrive).toHaveBeenCalledTimes(1);
    expect(gdrive.backupToGoogleDrive).toHaveBeenCalledWith('token-123');
    expect(result.googleDrive).toEqual({ status: 'success', fileId: 'file-1' });
  });

  it('still saves locally even when Google Drive upload fails', async () => {
    vi.mocked(gdrive.backupToGoogleDrive).mockResolvedValue({ success: false, error: 'quota exceeded' });

    const result = await runAutoBackup(JSON_PAYLOAD, { googleDriveEnabled: true });

    expect(result.localSaved).toBe(true);
    expect(getAutoBackup()).toBe(JSON_PAYLOAD);
    expect(result.googleDrive).toEqual({ status: 'error', error: 'quota exceeded' });
  });

  it('reports not-configured and never authenticates when the build lacks credentials', async () => {
    vi.mocked(gdrive.isGoogleDriveBackupConfigured).mockReturnValue(false);

    const result = await runAutoBackup(JSON_PAYLOAD, { googleDriveEnabled: true });

    expect(result.googleDrive).toEqual({ status: 'skipped', reason: 'not-configured' });
    expect(gdrive.authenticateGoogleDrive).not.toHaveBeenCalled();
  });

  it('reports an error when authentication returns no token', async () => {
    vi.mocked(gdrive.authenticateGoogleDrive).mockResolvedValue(null);

    const result = await runAutoBackup(JSON_PAYLOAD, { googleDriveEnabled: true });

    expect(result.googleDrive.status).toBe('error');
    expect(gdrive.backupToGoogleDrive).not.toHaveBeenCalled();
  });

  it('never rejects when the Google Drive module throws', async () => {
    vi.mocked(gdrive.authenticateGoogleDrive).mockRejectedValue(new Error('network down'));

    const result = await runAutoBackup(JSON_PAYLOAD, { googleDriveEnabled: true });

    expect(result.localSaved).toBe(true);
    expect(result.googleDrive).toEqual({ status: 'error', error: 'network down' });
  });
});
