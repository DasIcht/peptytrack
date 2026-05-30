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

// --- Google Drive OAuth ---

const GOOGLE_DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.file';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
    gapi?: {
      load: (api: string, callback: () => void) => void;
      client: {
        init: (config: { apiKey: string; discoveryDocs: string[] }) => Promise<void>;
        drive: {
          files: {
            create: (params: unknown) => Promise<{ result: { id: string } }>;
            list: (params: unknown) => Promise<{ result: { files: { id: string; name: string }[] } }>;
            get: (params: unknown) => Promise<{ body: string }>;
          };
        };
      };
    };
  }
}

export async function initGoogleDrive(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.gapi) {
      reject(new Error('Google API script not loaded'));
      return;
    }
    window.gapi.load('client', async () => {
      try {
        await window.gapi!.client.init({
          apiKey,
          discoveryDocs: [GOOGLE_DISCOVERY_DOC],
        });
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  });
}

export function authenticateGoogleDrive(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!window.google) {
      reject(new Error('Google Identity script not loaded'));
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_SCOPES,
      callback: (resp) => {
        if (resp.error) reject(new Error(resp.error));
        else if (resp.access_token) resolve(resp.access_token);
        else reject(new Error('No access token received'));
      },
    });
    client.requestAccessToken();
  });
}

export async function uploadToGoogleDrive(
  accessToken: string,
  filename: string,
  content: string
): Promise<string> {
  const metadata = {
    name: filename,
    mimeType: 'application/json',
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', new Blob([content], { type: 'application/json' }));

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    }
  );

  if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function listBackupsOnGoogleDrive(
  accessToken: string
): Promise<{ id: string; name: string }[]> {
  const res = await fetch(
    'https://www.googleapis.com/drive/v3/files?q=' +
      encodeURIComponent("name contains 'peptytrack-backup' and trashed=false") +
      '&fields=files(id,name,modifiedTime)',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`List failed: ${res.statusText}`);
  const data = (await res.json()) as { files: { id: string; name: string }[] };
  return data.files;
}

export async function downloadFromGoogleDrive(
  accessToken: string,
  fileId: string
): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Download failed: ${res.statusText}`);
  return res.text();
}

// --- Dropbox OAuth ---



export function authenticateDropbox(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const redirectUri = window.location.origin + window.location.pathname;
    const authUrl =
      'https://www.dropbox.com/oauth2/authorize' +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&response_type=token` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}`;

    const popup = window.open(authUrl, 'dropbox-auth', 'width=600,height=700');
    if (!popup) {
      reject(new Error('Popup blocked'));
      return;
    }

    const checkInterval = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(checkInterval);
          reject(new Error('Auth cancelled'));
          return;
        }
        const hash = popup.location.hash;
        if (hash && hash.includes('access_token')) {
          clearInterval(checkInterval);
          popup.close();
          const token = new URLSearchParams(hash.slice(1)).get('access_token');
          if (token) resolve(token);
          else reject(new Error('No token in redirect'));
        }
      } catch {
        // cross-origin, ignore
      }
    }, 500);
  });
}

export async function uploadToDropbox(
  accessToken: string,
  path: string,
  content: string
): Promise<void> {
  const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        path,
        mode: 'overwrite',
        autorename: true,
      }),
    },
    body: content,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
}

export async function listDropboxFiles(
  accessToken: string,
  path: string
): Promise<{ name: string; path_lower: string }[]> {
  const res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new Error(`List failed: ${res.statusText}`);
  const data = (await res.json()) as { entries: { name: string; path_lower: string }[] };
  return data.entries;
}

export async function downloadFromDropbox(
  accessToken: string,
  path: string
): Promise<string> {
  const res = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Dropbox-API-Arg': JSON.stringify({ path }),
    },
  });
  if (!res.ok) throw new Error(`Download failed: ${res.statusText}`);
  return res.text();
}
