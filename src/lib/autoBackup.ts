import {
  isGoogleDriveBackupConfigured,
  authenticateGoogleDrive,
  backupToGoogleDrive,
} from './googleDriveBackup';

const AUTO_BACKUP_KEY = 'peptytrack-autobackup';

export function saveAutoBackup(json: string): void {
  try {
    localStorage.setItem(AUTO_BACKUP_KEY, json);
  } catch {
    // storage full — ignore
  }
}

export function getAutoBackup(): string | null {
  try {
    return localStorage.getItem(AUTO_BACKUP_KEY);
  } catch {
    return null;
  }
}

export function clearAutoBackup(): void {
  try {
    localStorage.removeItem(AUTO_BACKUP_KEY);
  } catch {
    // ignore
  }
}

export interface AutoBackupOptions {
  /** Whether the user has enabled Google Drive auto-backup in Settings. */
  googleDriveEnabled?: boolean;
}

export type GoogleDriveAutoBackupOutcome =
  | { status: 'skipped'; reason: 'disabled' | 'not-configured' }
  | { status: 'success'; fileId?: string }
  | { status: 'error'; error: string };

export interface AutoBackupResult {
  localSaved: boolean;
  googleDrive: GoogleDriveAutoBackupOutcome;
}

/**
 * Coordinate the local (localStorage) auto-backup with the optional
 * Google Drive backup. The local backup always runs; Google Drive only runs
 * when the user has enabled it and the build is configured for it.
 */
export async function runAutoBackup(
  json: string,
  options: AutoBackupOptions = {}
): Promise<AutoBackupResult> {
  saveAutoBackup(json);
  const localSaved = getAutoBackup() === json;

  if (!options.googleDriveEnabled) {
    return { localSaved, googleDrive: { status: 'skipped', reason: 'disabled' } };
  }

  if (!isGoogleDriveBackupConfigured()) {
    return { localSaved, googleDrive: { status: 'skipped', reason: 'not-configured' } };
  }

  try {
    const token = await authenticateGoogleDrive();
    if (!token) {
      return {
        localSaved,
        googleDrive: { status: 'error', error: 'Google Drive authentication failed' },
      };
    }
    const result = await backupToGoogleDrive(token);
    if (!result.success) {
      return {
        localSaved,
        googleDrive: { status: 'error', error: result.error || 'Google Drive backup failed' },
      };
    }
    return { localSaved, googleDrive: { status: 'success', fileId: result.fileId } };
  } catch (err) {
    return {
      localSaved,
      googleDrive: {
        status: 'error',
        error: err instanceof Error ? err.message : 'Google Drive backup failed',
      },
    };
  }
}
