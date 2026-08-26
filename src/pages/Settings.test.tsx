import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../lib/googleDriveBackup', () => ({
  isGoogleDriveBackupConfigured: vi.fn(() => true),
  authenticateGoogleDrive: vi.fn(async () => 'token-123'),
  backupToGoogleDrive: vi.fn(async () => ({ success: true, fileId: 'file-1' })),
  restoreFromGoogleDrive: vi.fn(async () => ({ success: true })),
}));

import { Settings } from './Settings';
import { useSettingsStore } from '../stores/settingsStore';
import { useMedicationStore } from '../stores/medicationStore';
import { useWeightStore } from '../stores/weightStore';
import { useVialStore } from '../stores/vialStore';
import { useUIStore } from '../stores/uiStore';
import { useSymptomLogStore } from '../stores/symptomLogStore';
import * as gdrive from '../lib/googleDriveBackup';

function baseSettings(overrides: Record<string, unknown> = {}) {
  return { ...useSettingsStore.getState().settings, ...overrides };
}

describe('Settings — Google Drive backup section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(gdrive.isGoogleDriveBackupConfigured).mockReturnValue(true);
    vi.mocked(gdrive.authenticateGoogleDrive).mockResolvedValue('token-123');
    vi.mocked(gdrive.backupToGoogleDrive).mockResolvedValue({ success: true, fileId: 'file-1' });
    vi.mocked(gdrive.restoreFromGoogleDrive).mockResolvedValue({ success: true });

    useMedicationStore.setState({ medications: [], doses: [], loading: false, initialized: true });
    useWeightStore.setState({ entries: [], loading: false });
    useVialStore.setState({ vials: [], loading: false, initialized: true });
    useSymptomLogStore.setState({ logs: [], loading: false, initialized: true });
    useUIStore.setState({ isModalOpen: false, modalContent: null, toasts: [] });
    useSettingsStore.setState({
      settings: baseSettings({ googleDriveBackupEnabled: false, notificationsEnabled: false }),
      initialized: true,
    });
  });

  it('renders a Google Drive backup toggle', () => {
    render(<Settings />);
    expect(screen.getByRole('button', { name: /google drive backup/i })).toBeInTheDocument();
  });

  it('toggle reflects the disabled state via aria-pressed', () => {
    render(<Settings />);
    const toggle = screen.getByRole('button', { name: /google drive backup/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggle reflects the enabled state via aria-pressed', () => {
    useSettingsStore.setState({ settings: baseSettings({ googleDriveBackupEnabled: true }) });
    render(<Settings />);
    const toggle = screen.getByRole('button', { name: /google drive backup/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking the toggle persists googleDriveBackupEnabled = true', async () => {
    const updateSetting = vi.fn(async () => {});
    useSettingsStore.setState({ updateSetting } as never);

    render(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: /google drive backup/i }));

    await waitFor(() => {
      expect(updateSetting).toHaveBeenCalledWith('googleDriveBackupEnabled', true);
    });
  });

  it('clicking the toggle while enabled persists googleDriveBackupEnabled = false', async () => {
    const updateSetting = vi.fn(async () => {});
    useSettingsStore.setState({
      settings: baseSettings({ googleDriveBackupEnabled: true }),
      updateSetting,
    } as never);

    render(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: /google drive backup/i }));

    await waitFor(() => {
      expect(updateSetting).toHaveBeenCalledWith('googleDriveBackupEnabled', false);
    });
  });

  it('hides the Google Drive section when the build is not configured', () => {
    vi.mocked(gdrive.isGoogleDriveBackupConfigured).mockReturnValue(false);
    render(<Settings />);
    expect(screen.queryByRole('button', { name: /google drive backup/i })).not.toBeInTheDocument();
  });
});

describe('Settings — Backup Now button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(gdrive.isGoogleDriveBackupConfigured).mockReturnValue(true);
    vi.mocked(gdrive.authenticateGoogleDrive).mockResolvedValue('token-123');
    vi.mocked(gdrive.backupToGoogleDrive).mockResolvedValue({ success: true, fileId: 'file-1' });
    vi.mocked(gdrive.restoreFromGoogleDrive).mockResolvedValue({ success: true });

    useMedicationStore.setState({ medications: [], doses: [], loading: false, initialized: true });
    useWeightStore.setState({ entries: [], loading: false });
    useVialStore.setState({ vials: [], loading: false, initialized: true });
    useSymptomLogStore.setState({ logs: [], loading: false, initialized: true });
    useUIStore.setState({ isModalOpen: false, modalContent: null, toasts: [] });
    useSettingsStore.setState({
      settings: baseSettings({ googleDriveBackupEnabled: true, notificationsEnabled: false }),
      initialized: true,
    });
  });

  it('renders a Backup Now button when Google Drive backup is enabled', () => {
    render(<Settings />);
    expect(screen.getByRole('button', { name: /backup now/i })).toBeInTheDocument();
  });

  it('is not rendered while Google Drive backup is disabled', () => {
    useSettingsStore.setState({ settings: baseSettings({ googleDriveBackupEnabled: false }) });
    render(<Settings />);
    expect(screen.queryByRole('button', { name: /backup now/i })).not.toBeInTheDocument();
  });

  it('authenticates then uploads when clicked', async () => {
    render(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: /backup now/i }));

    await waitFor(() => {
      expect(gdrive.authenticateGoogleDrive).toHaveBeenCalledTimes(1);
      expect(gdrive.backupToGoogleDrive).toHaveBeenCalledWith('token-123');
    });
  });

  it('persists the returned fileId to settings', async () => {
    const updateSetting = vi.fn(async () => {});
    useSettingsStore.setState({ updateSetting } as never);

    render(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: /backup now/i }));

    await waitFor(() => {
      expect(updateSetting).toHaveBeenCalledWith('googleDriveBackupFileId', 'file-1');
    });
  });

  it('shows a success toast on a successful backup', async () => {
    render(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: /backup now/i }));

    await waitFor(() => {
      const toasts = useUIStore.getState().toasts;
      expect(toasts.some((t) => t.type === 'success' && /backed up/i.test(t.message))).toBe(true);
    });
  });

  it('shows an error toast when the upload fails', async () => {
    vi.mocked(gdrive.backupToGoogleDrive).mockResolvedValue({ success: false, error: 'quota exceeded' });

    render(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: /backup now/i }));

    await waitFor(() => {
      const toasts = useUIStore.getState().toasts;
      expect(toasts.some((t) => t.type === 'error' && /quota exceeded/i.test(t.message))).toBe(true);
    });
  });

  it('shows an error toast when authentication returns no token', async () => {
    vi.mocked(gdrive.authenticateGoogleDrive).mockResolvedValue(null);

    render(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: /backup now/i }));

    await waitFor(() => {
      const toasts = useUIStore.getState().toasts;
      expect(toasts.some((t) => t.type === 'error')).toBe(true);
    });
    expect(gdrive.backupToGoogleDrive).not.toHaveBeenCalled();
  });
});

describe('Settings — Restore from Google Drive button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(gdrive.isGoogleDriveBackupConfigured).mockReturnValue(true);
    vi.mocked(gdrive.authenticateGoogleDrive).mockResolvedValue('token-123');
    vi.mocked(gdrive.backupToGoogleDrive).mockResolvedValue({ success: true, fileId: 'file-1' });
    vi.mocked(gdrive.restoreFromGoogleDrive).mockResolvedValue({ success: true });

    useMedicationStore.setState({ medications: [], doses: [], loading: false, initialized: true });
    useWeightStore.setState({ entries: [], loading: false });
    useVialStore.setState({ vials: [], loading: false, initialized: true });
    useSymptomLogStore.setState({ logs: [], loading: false, initialized: true });
    useUIStore.setState({ isModalOpen: false, modalContent: null, toasts: [] });
    useSettingsStore.setState({
      settings: baseSettings({ googleDriveBackupEnabled: true, notificationsEnabled: false }),
      initialized: true,
    });
  });

  it('renders a Restore from Google Drive button', () => {
    render(<Settings />);
    expect(screen.getByRole('button', { name: /restore from google drive/i })).toBeInTheDocument();
  });

  it('opens a confirmation dialog rather than restoring immediately', () => {
    render(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: /restore from google drive/i }));

    expect(useUIStore.getState().isModalOpen).toBe(true);
    expect(gdrive.restoreFromGoogleDrive).not.toHaveBeenCalled();
  });

  it('restores after the confirmation dialog is confirmed', async () => {
    render(
      <>
        <Settings />
        <ModalHost />
      </>
    );
    fireEvent.click(screen.getByRole('button', { name: /restore from google drive/i }));

    const confirm = await screen.findByRole('button', { name: /overwrite local data/i });
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(gdrive.authenticateGoogleDrive).toHaveBeenCalled();
      expect(gdrive.restoreFromGoogleDrive).toHaveBeenCalledWith('token-123');
    });
  });

  it('shows an error toast when the restore fails', async () => {
    vi.mocked(gdrive.restoreFromGoogleDrive).mockResolvedValue({ success: false, error: 'no backup found' });

    render(
      <>
        <Settings />
        <ModalHost />
      </>
    );
    fireEvent.click(screen.getByRole('button', { name: /restore from google drive/i }));
    fireEvent.click(await screen.findByRole('button', { name: /overwrite local data/i }));

    await waitFor(() => {
      const toasts = useUIStore.getState().toasts;
      expect(toasts.some((t) => t.type === 'error' && /no backup found/i.test(t.message))).toBe(true);
    });
  });

  it('reloads stores and toasts success after a successful restore', async () => {
    const loadData = vi.fn(async () => {});
    useMedicationStore.setState({ loadData } as never);

    render(
      <>
        <Settings />
        <ModalHost />
      </>
    );
    fireEvent.click(screen.getByRole('button', { name: /restore from google drive/i }));
    fireEvent.click(await screen.findByRole('button', { name: /overwrite local data/i }));

    await waitFor(() => {
      expect(loadData).toHaveBeenCalled();
      const toasts = useUIStore.getState().toasts;
      expect(toasts.some((t) => t.type === 'success' && /restored/i.test(t.message))).toBe(true);
    });
  });
});

/** Minimal host that renders whatever uiStore.openModal put in place. */
function ModalHost() {
  const modalContent = useUIStore((s) => s.modalContent);
  const isModalOpen = useUIStore((s) => s.isModalOpen);
  return isModalOpen ? <div data-testid="modal-host">{modalContent}</div> : null;
}
