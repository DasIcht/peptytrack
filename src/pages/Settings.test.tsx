import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Settings } from './Settings';
import { useMedicationStore } from '../stores/medicationStore';
import { useWeightStore } from '../stores/weightStore';
import { useVialStore } from '../stores/vialStore';
import { useUIStore } from '../stores/uiStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSymptomLogStore } from '../stores/symptomLogStore';
import { useProtocolStore } from '../stores/protocolStore';
import * as cloudSync from '../lib/cloudSync';

vi.mock('../lib/cloudSync', () => ({
  exportData: vi.fn(),
  downloadBackupJSON: vi.fn(),
  importData: vi.fn(),
}));

vi.mock('../lib/pdfExport', () => ({
  generatePDF: vi.fn(() => ({})),
  downloadPDF: vi.fn(),
}));

vi.mock('../lib/notifications', () => ({
  requestNotificationPermission: vi.fn(async () => false),
}));

vi.mock('../components/ThemeSection', () => ({
  ThemeSection: () => null,
}));

vi.mock('../components/FeedbackModal', () => ({
  FeedbackModal: () => null,
}));

vi.mock('../components/HelpBox', () => ({
  HelpBox: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('../components/ConfirmDialog', () => ({
  ConfirmDialog: () => null,
}));

function baseSettings(overrides: Record<string, unknown> = {}) {
  return { ...useSettingsStore.getState().settings, ...overrides };
}

describe('Settings — share backup to Google Drive', () => {
  const originalShare = navigator.share;
  const originalCanShare = navigator.canShare;
  const originalDownload = cloudSync.downloadBackupJSON;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    delete (window as any).showSaveFilePicker;
    vi.mocked(cloudSync.exportData).mockResolvedValue({
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
    } as any);
    vi.mocked(cloudSync.downloadBackupJSON).mockImplementation(originalDownload);

    useMedicationStore.setState({ medications: [], doses: [], loading: false, initialized: true });
    useWeightStore.setState({ entries: [], loading: false });
    useVialStore.setState({ vials: [], loading: false });
    useSymptomLogStore.setState({ logs: [], loading: false, initialized: true });
    useProtocolStore.setState({ protocols: [], loading: false, initialized: true });
    useUIStore.setState({ isModalOpen: false, modalContent: null, toasts: [] });
    useSettingsStore.setState({
      settings: baseSettings({ notificationsEnabled: false }),
      initialized: true,
    });
  });

  afterEach(() => {
    (navigator as any).share = originalShare;
    (navigator as any).canShare = originalCanShare;
    vi.restoreAllMocks();
  });

  it('renders an Export Backup button in the Data section', () => {
    render(<Settings />);
    expect(
      screen.getByRole('button', { name: /export backup/i })
    ).toBeInTheDocument();
  });

  it('shares the cached auto-backup synchronously when available (no IndexedDB await before share)', async () => {
    localStorage.setItem('peptytrack-autobackup', '{"cached":true}');
    const shareMock = vi.fn(async (_payload: ShareData) => undefined);
    (navigator as any).share = shareMock;
    (navigator as any).canShare = vi.fn(() => true);

    render(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: /export backup/i }));

    await waitFor(() => expect(shareMock).toHaveBeenCalledTimes(1));
    // The share payload must come from the cached backup, NOT from exportData()
    const sharePayload = shareMock.mock.calls[0][0];
    expect(sharePayload.files![0].name).toMatch(/^peptytrack-backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.txt$/);
    await sharePayload.files![0].text().then((text: string) => {
      expect(text).toBe('{"cached":true}');
    });
    // The share payload came from the sync cache, so no IndexedDB read
    // happened during the tap (exportData was not called at all).
    expect(cloudSync.exportData).not.toHaveBeenCalled();
  });

  it('shares synchronously using the JSON pre-computed on Settings mount when no cached auto-backup exists', async () => {
    // No localStorage cache: the page itself pre-computes the export JSON
    // on mount, so the tap handler never awaits before navigator.share().
    const shareMock = vi.fn(async (_payload: ShareData) => undefined);
    (navigator as any).share = shareMock;
    (navigator as any).canShare = vi.fn(() => true);

    render(<Settings />);
    await waitFor(() => expect(cloudSync.exportData).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /export backup/i }));
    await waitFor(() => expect(shareMock).toHaveBeenCalledTimes(1));

    // The tap itself must not trigger another IndexedDB read — the share
    // payload comes from the pre-computed JSON (fully synchronous path).
    expect(cloudSync.exportData).toHaveBeenCalledTimes(1);
    const sharePayload = shareMock.mock.calls[0][0];
    const text = await sharePayload.files![0].text();
    expect(JSON.parse(text).version).toBe(8);
  });

  it('opens a native Save As dialog (showSaveFilePicker) when share is unavailable', async () => {
    (navigator as any).share = undefined;
    (navigator as any).canShare = undefined;
    const writeMock = vi.fn(async () => undefined);
    const closeMock = vi.fn(async () => undefined);
    const savePickerMock = vi.fn(async (_opts: any) => ({
      createWritable: vi.fn(async () => ({ write: writeMock, close: closeMock })),
    }));
    (window as any).showSaveFilePicker = savePickerMock;

    render(<Settings />);
    await waitFor(() => expect(cloudSync.exportData).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /export backup/i }));

    await waitFor(() => expect(savePickerMock).toHaveBeenCalledTimes(1));
    expect(savePickerMock.mock.calls[0][0].suggestedName).toMatch(
      /^peptytrack-backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/
    );
    expect(writeMock).toHaveBeenCalledTimes(1);
    expect(closeMock).toHaveBeenCalledTimes(1);
    expect(cloudSync.downloadBackupJSON).not.toHaveBeenCalled();
  });

  it('uses the native share sheet with a backup JSON file when navigator.share is available', async () => {
    const shareMock = vi.fn(async (_payload: ShareData) => undefined);
    (navigator as any).share = shareMock;
    (navigator as any).canShare = vi.fn(() => true);

    render(<Settings />);
    // Let the mount-time pre-warm finish so the tap path has sync JSON
    await waitFor(() => expect(cloudSync.exportData).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /export backup/i }));

    await waitFor(() => expect(shareMock).toHaveBeenCalledTimes(1));
    const sharePayload = shareMock.mock.calls[0][0];
    expect(sharePayload.title).toBe('PeptyTrack Backup');
    expect(sharePayload.files).toHaveLength(1);
    expect(sharePayload.files![0].name).toMatch(/^peptytrack-backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.txt$/);
    expect(sharePayload.files![0].type).toBe('text/plain');
    // Should NOT fall back to a download when the share sheet was used
    expect(cloudSync.downloadBackupJSON).not.toHaveBeenCalled();
  });

  it('falls back to downloading the JSON when the native share sheet is unavailable', async () => {
    (navigator as any).share = undefined;
    (navigator as any).canShare = undefined;
    const downloadSpy = vi.spyOn(cloudSync, 'downloadBackupJSON').mockImplementation(() => {});

    render(<Settings />);
    await waitFor(() => expect(cloudSync.exportData).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /export backup/i }));

    await waitFor(() => expect(downloadSpy).toHaveBeenCalledTimes(1));
    const [data] = downloadSpy.mock.calls[0];
    expect((data as any).version).toBe(8);
  });

  it('silently ignores user cancellation of the share sheet (AbortError)', async () => {
    const shareMock = vi.fn(async () => {
      const err = new Error('Share cancelled');
      err.name = 'AbortError';
      throw err;
    });
    (navigator as any).share = shareMock;
    (navigator as any).canShare = vi.fn(() => true);

    render(<Settings />);
    await waitFor(() => expect(cloudSync.exportData).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /export backup/i }));

    await waitFor(() => expect(shareMock).toHaveBeenCalledTimes(1));
    expect(useUIStore.getState().toasts).toEqual([]);
    expect(cloudSync.downloadBackupJSON).not.toHaveBeenCalled();
  });

  it('shows an error toast when sharing fails for a real reason', async () => {
    const shareMock = vi.fn(async () => {
      throw new Error('NotAllowedError: permission denied');
    });
    (navigator as any).share = shareMock;
    (navigator as any).canShare = vi.fn(() => true);
    const downloadSpy = vi.spyOn(cloudSync, 'downloadBackupJSON').mockImplementation(() => {});

    render(<Settings />);
    await waitFor(() => expect(cloudSync.exportData).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /export backup/i }));

    await waitFor(() => expect(shareMock).toHaveBeenCalledTimes(1));
    // The backup must never be lost: fall back to a download
    expect(downloadSpy).toHaveBeenCalledTimes(1);
    expect(useUIStore.getState().toasts.some((t) => t.message.includes('Export failed'))).toBe(true);
  });

  it('falls back to Save As picker when share throws NotAllowedError', async () => {
    const shareMock = vi.fn(async () => {
      const err = new Error('NotAllowedError: permission denied');
      err.name = 'NotAllowedError';
      throw err;
    });
    (navigator as any).share = shareMock;
    (navigator as any).canShare = vi.fn(() => true);

    const writeMock = vi.fn(async () => undefined);
    const closeMock = vi.fn(async () => undefined);
    const savePickerMock = vi.fn(async (_opts: any) => ({
      createWritable: vi.fn(async () => ({ write: writeMock, close: closeMock })),
    }));
    (window as any).showSaveFilePicker = savePickerMock;

    const downloadSpy = vi.spyOn(cloudSync, 'downloadBackupJSON').mockImplementation(() => {});

    render(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: /export backup/i }));

    await waitFor(() => expect(savePickerMock).toHaveBeenCalledTimes(1));
    expect(downloadSpy).not.toHaveBeenCalled();
    expect(writeMock).toHaveBeenCalledTimes(1);
    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});

describe('Settings — scheduled local backup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    useMedicationStore.setState({ medications: [], doses: [], loading: false, initialized: true });
    useWeightStore.setState({ entries: [], loading: false });
    useVialStore.setState({ vials: [], loading: false });
    useSymptomLogStore.setState({ logs: [], loading: false, initialized: true });
    useProtocolStore.setState({ protocols: [], loading: false, initialized: true });
    useUIStore.setState({ isModalOpen: false, modalContent: null, toasts: [] });
    useSettingsStore.setState({
      settings: baseSettings({
        notificationsEnabled: false,
        scheduledBackupsEnabled: false,
        scheduledBackupsIntervalDays: 1,
      }),
      initialized: true,
    });
  });

  it('renders a Scheduled Local Backup toggle', () => {
    render(<Settings />);
    expect(
      screen.getByRole('button', { name: /scheduled local backup/i })
    ).toBeInTheDocument();
  });

  it('enables scheduled backups when toggled on', async () => {
    render(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: /scheduled local backup/i }));
    await waitFor(() =>
      expect(useSettingsStore.getState().settings.scheduledBackupsEnabled).toBe(true)
    );
  });

  it('offers Daily and Weekly interval choices and defaults to the stored value', () => {
    useSettingsStore.setState({
      settings: baseSettings({ scheduledBackupsEnabled: true, scheduledBackupsIntervalDays: 1 }),
    });
    render(<Settings />);
    expect(screen.getByRole('button', { name: /daily/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /weekly/i })).toBeInTheDocument();
  });

  it('switching to Weekly stores interval 7 days', async () => {
    useSettingsStore.setState({
      settings: baseSettings({ scheduledBackupsEnabled: true, scheduledBackupsIntervalDays: 1 }),
    });
    render(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: /weekly/i }));
    await waitFor(() =>
      expect(useSettingsStore.getState().settings.scheduledBackupsIntervalDays).toBe(7)
    );
  });

  it('lists existing scheduled snapshots with their dates', () => {
    localStorage.setItem(
      'peptytrack-scheduled-backups',
      JSON.stringify([
        { timestamp: Date.UTC(2026, 7, 26), json: '{"v":1}' },
        { timestamp: Date.UTC(2026, 7, 19), json: '{"v":2}' },
      ])
    );
    render(<Settings />);
    expect(screen.getByText(/aug 26, 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/aug 19, 2026/i)).toBeInTheDocument();
  });

  it('opens a restore confirmation when a snapshot is tapped', () => {
    localStorage.setItem(
      'peptytrack-scheduled-backups',
      JSON.stringify([{ timestamp: Date.UTC(2026, 7, 26), json: '{"v":1}' }])
    );
    const openModalSpy = vi.spyOn(useUIStore.getState(), 'openModal').mockImplementation(() => {});
    render(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: /restore/i }));
    expect(openModalSpy).toHaveBeenCalledTimes(1);
  });
});
