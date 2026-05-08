import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LogDose } from './LogDose';
import { useMedicationStore } from '../stores/medicationStore';
import { useVialStore } from '../stores/vialStore';
import { useUIStore } from '../stores/uiStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSideEffectsStore } from '../stores/sideEffectsStore';
import type { InjectionSite } from '../types';

const mockMedication = {
  id: 'med-1',
  templateId: 'lib-1',
  name: 'Semaglutide',
  brand: 'Ozempic',
  activeIngredient: 'Semaglutide',
  dosageOptions: [0.25, 0.5, 1.0],
  unit: 'mg',
  frequency: 'weekly' as const,
  halfLifeHours: 168,
  color: '#14b8a6',
  reminderHoursBefore: 24,
  enabled: true,
  createdAt: Date.now(),
};

const mockVial = {
  id: 'vial-1',
  medicationId: 'med-1',
  name: 'Vial #1',
  peptideAmount: 5,
  peptideUnit: 'mg',
  bacWaterAmount: 1,
  reconstitutedAt: Date.now(),
  remainingOverride: null,
  notes: '',
  createdAt: Date.now(),
};

const defaultSettings = {
  weightUnit: 'kg' as const,
  medicationUnit: 'mg' as const,
  notificationsEnabled: false,
  injectionRotationStrategy: 'sequential' as const,
  injectionRotationSites: [
    'abdomen-upper-left', 'abdomen-upper-right',
    'abdomen-lower-left', 'abdomen-lower-right',
    'thigh-left', 'thigh-right',
    'arm-left', 'arm-right',
  ] as InjectionSite[],
};

describe('LogDose', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    useMedicationStore.setState({
      medications: [mockMedication],
      doses: [],
      loading: false,
      initialized: true,
    });
    useVialStore.setState({
      vials: [mockVial],
      loading: false,
      initialized: true,
    });
    useUIStore.setState({
      activePage: 'log',
      logDoseMedId: null,
      isModalOpen: false,
      modalContent: null,
      toasts: [],
    });
    useSettingsStore.setState({
      settings: defaultSettings,
      initialized: true,
    });
    useSideEffectsStore.setState({
      customEffects: {},
      initialized: true,
    });
  });

  describe('Mode Toggle', () => {
    it('renders Quick Log mode by default', () => {
      render(<LogDose />);
      expect(screen.getByText('Quick')).toBeInTheDocument();
      expect(screen.getByText('Full')).toBeInTheDocument();
    });

    it('defaults to Quick Log when no localStorage preference exists', () => {
      render(<LogDose />);
      const quickBtn = screen.getByText('Quick').closest('button');
      expect(quickBtn?.classList.contains('active')).toBe(true);
    });

    it('reads mode preference from localStorage', () => {
      localStorage.setItem('pepty-log-mode', 'full');
      render(<LogDose />);
      const fullBtn = screen.getByText('Full Log').closest('button');
      expect(fullBtn?.classList.contains('active')).toBe(true);
    });

    it('saves mode preference to localStorage when toggled', async () => {
      render(<LogDose />);
      const fullBtn = screen.getByText('Full').closest('button')!;
      fireEvent.click(fullBtn);
      // Mode switch has a 200ms animation delay before localStorage is updated
      await waitFor(() => {
        expect(localStorage.getItem('pepty-log-mode')).toBe('full');
      }, { timeout: 500 });
    });

    it('hides mode toggle when editing a dose', () => {
      useMedicationStore.setState({
        doses: [{
          id: 'dose-1',
          medicationId: 'med-1',
          vialId: 'vial-1',
          dosage: 0.5,
          unit: 'mg',
          injectionSite: 'abdomen-upper-left' as InjectionSite,
          dateTime: Date.now(),
          notes: '',
          sideEffects: [],
          createdAt: Date.now(),
        }],
      });
      // Switch to full mode so the Dose History (with edit button) is visible
      localStorage.setItem('pepty-log-mode', 'full');
      render(<LogDose />);
      // Edit the first dose
      const editBtn = screen.getByLabelText('Edit dose');
      fireEvent.click(editBtn);
      expect(screen.queryByText('Quick')).not.toBeInTheDocument();
    });
  });

  describe('Quick Log Mode', () => {
    it('shows medication, vial summary, dosage, and injection site', () => {
      render(<LogDose />);
      expect(screen.getByText('Medication')).toBeInTheDocument();
      expect(screen.getByText('Vial')).toBeInTheDocument();
      expect(screen.getByText(/Dosage/)).toBeInTheDocument();
      expect(screen.getByText('Injection Site')).toBeInTheDocument();
    });

    it('shows compact vial summary instead of circular progress', () => {
      // Add a dose so the vial is auto-selected
      useMedicationStore.setState({
        doses: [{
          id: 'dose-1',
          medicationId: 'med-1',
          vialId: 'vial-1',
          dosage: 0.5,
          unit: 'mg',
          injectionSite: 'abdomen-upper-left' as InjectionSite,
          dateTime: Date.now(),
          notes: '',
          sideEffects: [],
          createdAt: Date.now(),
        }],
      });
      render(<LogDose />);
      // Should show vial name in the compact summary (not just in dropdown)
      const summaries = screen.getAllByText('Vial #1');
      expect(summaries.length).toBeGreaterThanOrEqual(1);
    });

    it('hides date/time, notes, and side effects sections', () => {
      render(<LogDose />);
      expect(screen.queryByText('Date & Time')).not.toBeInTheDocument();
      expect(screen.queryByText('Notes')).not.toBeInTheDocument();
      expect(screen.queryByText(/Side Effects/)).not.toBeInTheDocument();
    });
  });

  describe('Full Log Mode', () => {
    it('shows all sections including date/time, notes, and side effects', () => {
      localStorage.setItem('pepty-log-mode', 'full');
      render(<LogDose />);
      expect(screen.getByText('Date & Time')).toBeInTheDocument();
      expect(screen.getByText('Notes')).toBeInTheDocument();
      expect(screen.getByText(/Side Effects/)).toBeInTheDocument();
    });

    it('shows full vial dashboard with circular progress', () => {
      localStorage.setItem('pepty-log-mode', 'full');
      // Add a dose so the vial is auto-selected
      useMedicationStore.setState({
        doses: [{
          id: 'dose-1',
          medicationId: 'med-1',
          vialId: 'vial-1',
          dosage: 0.5,
          unit: 'mg',
          injectionSite: 'abdomen-upper-left' as InjectionSite,
          dateTime: Date.now(),
          notes: '',
          sideEffects: [],
          createdAt: Date.now(),
        }],
      });
      render(<LogDose />);
      // Full log shows the vial dashboard section with the vial name (appears in summary + dashboard)
      expect(screen.getAllByText('Vial #1').length).toBeGreaterThanOrEqual(1);
      // The remaining amount is shown in the dashboard (appears in dropdown too, so check for multiple)
      const remainingTexts = screen.getAllByText(/mg remaining/);
      expect(remainingTexts.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Injection Site Zone Strip', () => {
    it('renders zone cards for active zones in full mode', () => {
      localStorage.setItem('pepty-log-mode', 'full');
      render(<LogDose />);
      expect(screen.getByText('Abdomen')).toBeInTheDocument();
      expect(screen.getByText('Thigh')).toBeInTheDocument();
      expect(screen.getByText('Upper Arm')).toBeInTheDocument();
    });

    it('expands zone when clicked to show site options', () => {
      localStorage.setItem('pepty-log-mode', 'full');
      render(<LogDose />);
      const abdomenZone = screen.getByText('Abdomen').closest('button')!;
      fireEvent.click(abdomenZone);
      expect(screen.getByText('Upper Left')).toBeInTheDocument();
      expect(screen.getByText('Upper Right')).toBeInTheDocument();
    });

    it('selects a site when clicked in expanded zone', () => {
      localStorage.setItem('pepty-log-mode', 'full');
      render(<LogDose />);
      const abdomenZone = screen.getByText('Abdomen').closest('button')!;
      fireEvent.click(abdomenZone);
      const upperLeft = screen.getByText('Upper Left').closest('button')!;
      fireEvent.click(upperLeft);
      // The selected site should be reflected in the summary
      expect(screen.getByText(/Abdomen · Upper Left/)).toBeInTheDocument();
    });

    it('shows only zones with active sites from settings', () => {
      useSettingsStore.setState({
        settings: {
          ...defaultSettings,
          injectionRotationSites: ['abdomen-upper-left', 'abdomen-upper-right'] as InjectionSite[],
        },
        initialized: true,
      });
      localStorage.setItem('pepty-log-mode', 'full');
      render(<LogDose />);
      expect(screen.getByText('Abdomen')).toBeInTheDocument();
      expect(screen.queryByText('Thigh')).not.toBeInTheDocument();
      expect(screen.queryByText('Upper Arm')).not.toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('submit button is disabled without dosage', () => {
      render(<LogDose />);
      const submitBtn = screen.getByText('Log Dose').closest('button')!;
      expect(submitBtn).toBeDisabled();
    });

    it('enables submit button when dosage is selected', () => {
      render(<LogDose />);
      const dosageBtn = screen.getByText('0.25').closest('button')!;
      fireEvent.click(dosageBtn);
      const submitBtn = screen.getByText('Log Dose').closest('button')!;
      expect(submitBtn).not.toBeDisabled();
    });

    it('shows dose exceeds warning when dosage > remaining', () => {
      useVialStore.setState({
        vials: [{
          ...mockVial,
          peptideAmount: 0.1,
        }],
      });
      // Add a dose so the vial is auto-selected
      useMedicationStore.setState({
        doses: [{
          id: 'dose-1',
          medicationId: 'med-1',
          vialId: 'vial-1',
          dosage: 0.05,
          unit: 'mg',
          injectionSite: 'abdomen-upper-left' as InjectionSite,
          dateTime: Date.now(),
          notes: '',
          sideEffects: [],
          createdAt: Date.now(),
        }],
      });
      render(<LogDose />);
      const dosageBtn = screen.getByText('0.25').closest('button')!;
      fireEvent.click(dosageBtn);
      expect(screen.getByText(/exceeds the remaining amount/)).toBeInTheDocument();
    });
  });
});
