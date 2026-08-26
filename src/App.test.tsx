import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';

// jsdom does not implement matchMedia; themeUtils uses it on init.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

vi.mock('./lib/googleDriveBackup', () => ({
  isGoogleDriveBackupConfigured: vi.fn(() => true),
  authenticateGoogleDrive: vi.fn(async () => 'token-123'),
  backupToGoogleDrive: vi.fn(async () => ({ success: true, fileId: 'file-1' })),
  restoreFromGoogleDrive: vi.fn(async () => ({ success: true })),
}));

const exportedPayload = { version: 5, medications: [{ id: 'med-1' }] };
vi.mock('./lib/cloudSync', () => ({
  exportData: vi.fn(async () => exportedPayload),
  importData: vi.fn(async () => {}),
  clearAllData: vi.fn(async () => {}),
}));

vi.mock('./lib/notifications', () => ({
  checkAndFireReminders: vi.fn(async () => {}),
  rescheduleAllReminders: vi.fn(() => {}),
  requestNotificationPermission: vi.fn(async () => true),
}));

const { runAutoBackupMock } = vi.hoisted(() => ({
  runAutoBackupMock: vi.fn(),
}));
vi.mock('./lib/autoBackup', () => ({
  runAutoBackup: runAutoBackupMock,
  saveAutoBackup: vi.fn(),
  getAutoBackup: vi.fn(() => null),
  clearAutoBackup: vi.fn(),
}));

import App from './App';
import { useMedicationStore } from './stores/medicationStore';
import { useWeightStore } from './stores/weightStore';
import { useVialStore } from './stores/vialStore';
import { useSettingsStore } from './stores/settingsStore';
import { useSideEffectsStore } from './stores/sideEffectsStore';
import { useProtocolStore } from './stores/protocolStore';
import { useSymptomLogStore } from './stores/symptomLogStore';
import { useUIStore } from './stores/uiStore';

const MED = {
  id: 'med-1',
  templateId: 'lib-1',
  name: 'Semaglutide',
  brand: 'Ozempic',
  activeIngredient: 'Semaglutide',
  dosageOptions: [0.25],
  unit: 'mg' as const,
  frequency: 'weekly' as const,
  halfLifeHours: 168,
  color: '#10b981',
  reminderHoursBefore: 24,
  enabled: true,
  createdAt: Date.now(),
};

function primeInitializedStores(googleDriveBackupEnabled: boolean, meds = [MED]) {
  useMedicationStore.setState({
    medications: meds,
    doses: [],
    loading: false,
    initialized: true,
    loadData: vi.fn(async () => {}),
  } as never);
  useWeightStore.setState({ entries: [], loading: false, initialized: true, loadData: vi.fn(async () => {}) } as never);
  useVialStore.setState({ vials: [], loading: false, initialized: true, loadData: vi.fn(async () => {}) } as never);
  useSideEffectsStore.setState({ initialized: true, loadData: vi.fn(async () => {}) } as never);
  useProtocolStore.setState({ protocols: [], initialized: true, loadData: vi.fn(async () => {}) } as never);
  useSymptomLogStore.setState({ logs: [], initialized: true, loadData: vi.fn(async () => {}) } as never);
  useUIStore.setState({ activePage: 'dashboard', isModalOpen: false, modalContent: null, toasts: [] });
  useSettingsStore.setState({
    settings: {
      ...useSettingsStore.getState().settings,
      notificationsEnabled: false,
      googleDriveBackupEnabled,
    },
    initialized: true,
    loadSettings: vi.fn(async () => {}),
  } as never);
}

describe('App — auto-backup scheduling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    runAutoBackupMock.mockResolvedValue({
      localSaved: true,
      googleDrive: { status: 'success', fileId: 'file-1' },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs auto-backup with googleDriveEnabled=false when the setting is off', async () => {
    primeInitializedStores(false);
    render(<App />);

    await waitFor(() => {
      expect(runAutoBackupMock).toHaveBeenCalled();
    });
    const [, options] = runAutoBackupMock.mock.calls[0] as unknown as [string, { googleDriveEnabled: boolean }];
    expect(options.googleDriveEnabled).toBe(false);
  });

  it('runs auto-backup with googleDriveEnabled=true when the setting is on', async () => {
    primeInitializedStores(true);
    render(<App />);

    await waitFor(() => {
      expect(runAutoBackupMock).toHaveBeenCalled();
    });
    const [, options] = runAutoBackupMock.mock.calls[0] as unknown as [string, { googleDriveEnabled: boolean }];
    expect(options.googleDriveEnabled).toBe(true);
  });

  it('passes the serialized exportData payload as the first argument', async () => {
    primeInitializedStores(true);
    render(<App />);

    await waitFor(() => {
      expect(runAutoBackupMock).toHaveBeenCalled();
    });
    const [json] = runAutoBackupMock.mock.calls[0] as unknown as [string];
    expect(JSON.parse(json)).toEqual(exportedPayload);
  });

  it('does not run auto-backup when there is no data at all', async () => {
    primeInitializedStores(true, []);
    render(<App />);

    // Give effects a chance to flush.
    await act(async () => {
      await Promise.resolve();
    });

    expect(runAutoBackupMock).not.toHaveBeenCalled();
  });

  it('re-runs auto-backup when the medication count changes', async () => {
    primeInitializedStores(true);
    render(<App />);

    await waitFor(() => {
      expect(runAutoBackupMock).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      useMedicationStore.setState({ medications: [MED, { ...MED, id: 'med-2' }] } as never);
    });

    await waitFor(() => {
      expect(runAutoBackupMock).toHaveBeenCalledTimes(2);
    });
  });

  it('surfaces an error toast when the Google Drive part of the backup fails', async () => {
    runAutoBackupMock.mockResolvedValue({
      localSaved: true,
      googleDrive: { status: 'error', error: 'quota exceeded' } as never,
    });
    primeInitializedStores(true);
    render(<App />);

    await waitFor(() => {
      const toasts = useUIStore.getState().toasts;
      expect(toasts.some((t) => t.type === 'error' && /quota exceeded/i.test(t.message))).toBe(true);
    });
  });

  it('does not toast when Google Drive backup is skipped', async () => {
    runAutoBackupMock.mockResolvedValue({
      localSaved: true,
      googleDrive: { status: 'skipped', reason: 'disabled' } as never,
    });
    primeInitializedStores(false);
    render(<App />);

    await waitFor(() => {
      expect(runAutoBackupMock).toHaveBeenCalled();
    });
    expect(useUIStore.getState().toasts).toHaveLength(0);
  });

  it('never lets a rejected auto-backup crash the app', async () => {
    runAutoBackupMock.mockRejectedValue(new Error('boom'));
    primeInitializedStores(true);

    const { container } = render(<App />);

    await waitFor(() => {
      expect(runAutoBackupMock).toHaveBeenCalled();
    });
    expect(container.querySelector('main')).toBeTruthy();
  });
});
