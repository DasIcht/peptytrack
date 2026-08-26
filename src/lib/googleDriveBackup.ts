import {
  exportData,
  importData,
  initGoogleDrive,
  authenticateGoogleDrive as lowLevelAuthenticateGoogleDrive,
  uploadToGoogleDrive,
  listBackupsOnGoogleDrive,
  downloadFromGoogleDrive,
} from './cloudSync';
import { validateBackup } from './backupValidation';
import { db } from '../db/database';

const BACKUP_FILENAME = 'peptytrack-backup.json';
const FILE_ID_SETTINGS_KEY = 'googleDriveBackupFileId';

export interface GoogleDriveBackupResult {
  success: boolean;
  fileId?: string;
  error?: string;
}

/**
 * Return the Google Drive API key configured at build time.
 * Returns undefined if the env var is missing or empty.
 */
export function getGoogleDriveApiKey(): string | undefined {
  const key = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY;
  return key ? key : undefined;
}

/**
 * Return the Google Drive OAuth client ID configured at build time.
 * Returns undefined if the env var is missing or empty.
 */
export function getGoogleDriveClientId(): string | undefined {
  const id = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID;
  return id ? id : undefined;
}

/**
 * Whether Google Drive backup is configured in the build.
 * Requires both an API key and a client ID at build time.
 */
export function isGoogleDriveBackupConfigured(): boolean {
  return Boolean(getGoogleDriveApiKey() && getGoogleDriveClientId());
}

/**
 * Authenticate with Google Drive and return an access token.
 *
 * Returns null when the build is missing required env vars (so callers can render
 * a helpful UI message). Otherwise initializes the GAPI client with the API key
 * and triggers an OAuth flow via Google Identity Services to get an access token.
 */
export async function authenticateGoogleDrive(
  apiKeyOverride?: string,
  clientIdOverride?: string
): Promise<string | null> {
  const apiKey = apiKeyOverride || getGoogleDriveApiKey();
  const clientId = clientIdOverride || getGoogleDriveClientId();

  if (!apiKey || !clientId) {
    return null;
  }

  await initGoogleDrive(apiKey);
  return lowLevelAuthenticateGoogleDrive(clientId);
}

/**
 * Read the previously-stored backup file id from settings (if any).
 */
async function readStoredFileId(): Promise<string | null> {
  const row = await db.settings.get(FILE_ID_SETTINGS_KEY);
  return (row?.value as string | undefined) ?? null;
}

/**
 * Persist the backup file id in settings so future runs can update in place.
 */
async function writeStoredFileId(fileId: string): Promise<void> {
  await db.settings.put({ id: FILE_ID_SETTINGS_KEY, value: fileId });
}

/**
 * Update the contents of an existing Google Drive file in place using multipart PATCH.
 * Returns an object indicating success and (on failure) the status text for diagnostics.
 */
async function patchDriveFile(
  accessToken: string,
  fileId: string,
  content: string
): Promise<{ ok: boolean; statusText?: string }> {
  const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
  const metadata = {
    name: BACKUP_FILENAME,
    mimeType: 'application/json',
  };

  const boundary = '-------peptytrack-boundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const multipartBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    content +
    closeDelim;

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });
  return { ok: res.ok, statusText: res.statusText };
}

/**
 * Upload the current IndexedDB data to Google Drive.
 *
 * Strategy:
 *  1. Look for an existing backup file by exact name on Drive.
 *  2. If a live match is found → update in place (no duplicate).
 *  3. Otherwise, if a stored file id exists in settings, PATCH it (in case the
 *     listing is stale or the user already has a file).
 *  4. If neither works, create a fresh file.
 *  5. Persist the resulting file id in settings.
 */
export async function backupToGoogleDrive(
  accessToken: string
): Promise<GoogleDriveBackupResult> {
  try {
    const data = await exportData();
    const json = JSON.stringify(data, null, 2);

    // Look for an existing file via the live list, then fall back to stored id.
    let liveList: { id: string; name: string }[] = [];
    try {
      liveList = await listBackupsOnGoogleDrive(accessToken);
    } catch {
      liveList = [];
    }

    const liveMatch = liveList.find((f) => f.name === BACKUP_FILENAME);
    const storedId = await readStoredFileId();

    // Source of truth for the chosen fileId: a live listing match beats a
    // stale stored id. We remember which one we picked so we can decide what to
    // do when the PATCH fails — if the live match failed, surface that error
    // rather than silently creating a duplicate. If the stored fallback fails,
    // it's likely been deleted on Drive's side, so retry by uploading fresh.
    const source: 'live' | 'stored' | 'none' = liveMatch
      ? 'live'
      : storedId
        ? 'stored'
        : 'none';

    if (source === 'live' && liveMatch) {
      const result = await patchDriveFile(accessToken, liveMatch.id, json);
      if (!result.ok) {
        return {
          success: false,
          error: `Update failed: ${result.statusText || 'PATCH rejected'}`,
        };
      }
      await writeStoredFileId(liveMatch.id);
      return { success: true, fileId: liveMatch.id };
    }

    if (source === 'stored' && storedId) {
      const result = await patchDriveFile(accessToken, storedId, json);
      if (result.ok) {
        await writeStoredFileId(storedId);
        return { success: true, fileId: storedId };
      }
      // Stored file is likely gone on Drive's side — fall through to a new upload.
    }

    // No live match and either no stored fileId or the stored one failed — upload fresh.
    const newId = await uploadToGoogleDrive(accessToken, BACKUP_FILENAME, json);
    await writeStoredFileId(newId);
    return { success: true, fileId: newId };
  } catch (err: any) {
    return { success: false, error: err?.message ?? String(err) };
  }
}

/**
 * Restore the most recent Google Drive backup.
 *
 * Strategy:
 *  1. List backups on Drive.
 *  2. If the live list is empty, fall back to the file id stored in settings.
 *  3. Download the JSON, parse, structurally validate, and import.
 */
export async function restoreFromGoogleDrive(
  accessToken: string
): Promise<GoogleDriveBackupResult> {
  try {
    let files: { id: string; name: string }[] = [];
    try {
      files = await listBackupsOnGoogleDrive(accessToken);
    } catch (err: any) {
      // Try the stored file id as a fallback before giving up.
      const fallbackId = await readStoredFileId();
      if (fallbackId) {
        files = [{ id: fallbackId, name: BACKUP_FILENAME }];
      } else {
        return { success: false, error: err?.message ?? String(err) };
      }
    }

    if (files.length === 0) {
      // Last resort — try the cached file id so the user can restore even if
      // listing failed silently.
      const fallbackId = await readStoredFileId();
      if (!fallbackId) {
        return { success: false, error: 'No backup found on Google Drive' };
      }
      files = [{ id: fallbackId, name: BACKUP_FILENAME }];
    }

    // Prefer the canonical filename; otherwise take the first file.
    const target =
      files.find((f) => f.name === BACKUP_FILENAME) ?? files[0];

    const raw = await downloadFromGoogleDrive(accessToken, target.id);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err: any) {
      return { success: false, error: `Invalid backup JSON: ${err?.message ?? err}` };
    }

    validateBackup(parsed);
    await importData(parsed);

    await writeStoredFileId(target.id);
    return { success: true, fileId: target.id };
  } catch (err: any) {
    return { success: false, error: err?.message ?? String(err) };
  }
}
