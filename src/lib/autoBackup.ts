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
