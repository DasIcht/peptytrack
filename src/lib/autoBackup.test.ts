import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  saveScheduledSnapshot,
  listScheduledSnapshots,
  isScheduledBackupDue,
} from './autoBackup';

const SCHEDULED_BACKUPS_KEY = 'peptytrack-scheduled-backups';

describe('autoBackup — scheduled local snapshots', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saves a snapshot and lists it back', () => {
    const saved = saveScheduledSnapshot('{"a":1}', 1000);

    expect(saved).toBe(true);
    const snapshots = listScheduledSnapshots();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toEqual({ timestamp: 1000, json: '{"a":1}' });
  });

  it('keeps only the newest 8 snapshots', () => {
    for (let i = 1; i <= 10; i++) {
      saveScheduledSnapshot(`{"n":${i}}`, i * 1000);
    }

    const snapshots = listScheduledSnapshots();
    expect(snapshots).toHaveLength(8);
    expect(snapshots[0].timestamp).toBe(3000); // oldest kept = 3rd
    expect(snapshots[snapshots.length - 1].timestamp).toBe(10000); // newest
  });

  it('is due when there are no snapshots yet', () => {
    expect(isScheduledBackupDue(7, Date.now())).toBe(true);
  });

  it('is not due when the latest snapshot is recent', () => {
    saveScheduledSnapshot('{}', 1_000_000);
    // 1 day later, daily interval
    expect(isScheduledBackupDue(1, 1_000_000 + 24 * 60 * 60 * 1000 - 1)).toBe(false);
  });

  it('is due when the latest snapshot is older than the interval', () => {
    saveScheduledSnapshot('{}', 1_000_000);
    // 8 days later, weekly interval
    expect(isScheduledBackupDue(7, 1_000_000 + 8 * 24 * 60 * 60 * 1000)).toBe(true);
  });

  it('is never due for an invalid interval', () => {
    expect(isScheduledBackupDue(0, Date.now())).toBe(false);
    expect(isScheduledBackupDue(-1, Date.now())).toBe(false);
  });

  it('recovers from corrupted snapshot storage', () => {
    localStorage.setItem(SCHEDULED_BACKUPS_KEY, 'not-json{{{');
    expect(listScheduledSnapshots()).toEqual([]);
    expect(isScheduledBackupDue(7, Date.now())).toBe(true);
  });
});
