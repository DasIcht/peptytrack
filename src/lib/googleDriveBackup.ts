import { exportData, uploadToGoogleDrive, listBackupsOnGoogleDrive, downloadFromGoogleDrive } from './cloudSync';

const BACKUP_FILENAME = 'peptytrack-backup.json';

export interface GoogleDriveBackupResult {
  success: boolean;
  fileId?: string;
  error?: string;
}

/**
 * Return the Google Drive API key configured at build time.
 */
export function getGoogleDriveApiKey(): string | undefined {
  return import.meta.env.VITE_GOOGLE_DRIVE_API_KEY;
}

/**
 * Return the Google Drive OAuth client ID configured at build time.
 */
export function getGoogleDriveClientId(): string | undefined {
  return import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID;
}

/**
 * Whether Google Drive backup is configured in the build.
 */
export function isGoogleDriveBackupConfigured(): boolean {
  return Boolean(getGoogleDriveApiKey() && getGoogleDriveClientId());
}

/**
 * Authenticate with Google Drive and return an access token.
 * Stub: to be implemented.
 */
export async function authenticateGoogleDrive(): Promise<string | null> {
  // TODO: implement
  return null;
}

/**
 * Upload the current IndexedDB data to Google Drive.
 * If a previous backup file exists, update it in place.
 * Stub: to be implemented.
 */
export async function backupToGoogleDrive(accessToken: string): Promise<GoogleDriveBackupResult> {
  // TODO: implement
  return { success: false, error: 'not implemented' };
}

/**
 * Restore the most recent Google Drive backup.
 * Stub: to be implemented.
 */
export async function restoreFromGoogleDrive(accessToken: string): Promise<GoogleDriveBackupResult> {
  // TODO: implement
  return { success: false, error: 'not implemented' };
}
