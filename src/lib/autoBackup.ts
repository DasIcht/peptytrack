const AUTO_BACKUP_KEY = 'peptytrack-autobackup';
const SCHEDULED_BACKUPS_KEY = 'peptytrack-scheduled-backups';
const MAX_SCHEDULED_SNAPSHOTS = 8;

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

export interface ScheduledBackupSnapshot {
  timestamp: number;
  json: string;
}

/** Read the list of scheduled snapshots (newest last). Corrupted storage → []. */
export function listScheduledSnapshots(): ScheduledBackupSnapshot[] {
  try {
    const raw = localStorage.getItem(SCHEDULED_BACKUPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Append a scheduled snapshot. Keeps only the newest MAX_SCHEDULED_SNAPSHOTS.
 * If localStorage is full, drops the oldest snapshots until the write fits.
 * Returns true when the snapshot was persisted.
 */
export function saveScheduledSnapshot(json: string, now: number = Date.now()): boolean {
  const snapshots = listScheduledSnapshots();
  snapshots.push({ timestamp: now, json });

  while (snapshots.length > 0) {
    const trimmed = snapshots.slice(-MAX_SCHEDULED_SNAPSHOTS);
    try {
      localStorage.setItem(SCHEDULED_BACKUPS_KEY, JSON.stringify(trimmed));
      return true;
    } catch {
      // Quota exceeded — drop the oldest snapshot and retry.
      snapshots.shift();
      if (snapshots.length === 0) return false;
    }
  }
  return false;
}

/**
 * Whether a scheduled snapshot is due: no snapshot exists yet, or the newest
 * one is older than intervalDays. Invalid intervals are never due.
 */
export function isScheduledBackupDue(intervalDays: number, now: number = Date.now()): boolean {
  if (!Number.isFinite(intervalDays) || intervalDays <= 0) return false;
  const snapshots = listScheduledSnapshots();
  if (snapshots.length === 0) return true;
  const latest = snapshots[snapshots.length - 1].timestamp;
  return now - latest >= intervalDays * 24 * 60 * 60 * 1000;
}
