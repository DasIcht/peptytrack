import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LogDose } from './LogDose';
import { useMedicationStore } from '../stores/medicationStore';
import { useVialStore } from '../stores/vialStore';
import { useUIStore } from '../stores/uiStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSideEffectsStore } from '../stores/sideEffectsStore';
import { useSymptomLogStore } from '../stores/symptomLogStore';
import { useProtocolStore } from '../stores/protocolStore';
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
  titrationWizardEnabled: false,
  severeSideEffectThreshold: 5,
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
    useSymptomLogStore.setState({
      logs: [],
      initialized: true,
    });
    useProtocolStore.setState({
      protocols: [],
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
          injectionRotationSites: ['abdomen-upper-left'],
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

  describe('Unified Activity Timeline', () => {
    beforeEach(() => {
      localStorage.setItem('pepty-log-mode', 'full');
    });

    it('renders both doses and symptom logs in the activity timeline', () => {
      useMedicationStore.setState({
        medications: [mockMedication],
        doses: [{
          id: 'dose-1',
          medicationId: 'med-1',
          dosage: 0.5,
          unit: 'mg',
          injectionSite: 'abdomen-upper-left',
          dateTime: Date.now() - 1000,
          notes: 'Dose note',
          createdAt: Date.now(),
        }],
      });
      useSymptomLogStore.setState({
        logs: [{
          id: 'sym-1',
          medicationId: 'med-1',
          dateTime: Date.now(),
          symptoms: [{ label: 'Nausea', severity: 'moderate' }],
          notes: 'Symptom note',
          createdAt: Date.now(),
        }],
      });

      render(<LogDose />);
      
      expect(screen.getByText('Semaglutide Activity')).toBeInTheDocument();
      expect(screen.getByText('0.5 mg')).toBeInTheDocument();
      expect(screen.getByText('Symptom Log')).toBeInTheDocument();
      expect(screen.getAllByText('Nausea').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/"Symptom note"/)).toBeInTheDocument();
    });

    it('enters symptom editing mode when edit is clicked on a symptom log', () => {
      useSymptomLogStore.setState({
        logs: [{
          id: 'sym-1',
          medicationId: 'med-1',
          dateTime: Date.now(),
          symptoms: [{ label: 'Nausea', severity: 'moderate' }],
          notes: 'Symptom note',
          createdAt: Date.now(),
        }],
      });

      render(<LogDose />);
      
      const editBtn = screen.getByLabelText('Edit symptom log');
      fireEvent.click(editBtn);

      // Header should change
      expect(screen.getByText('Editing Symptoms')).toBeInTheDocument();
      // Dose-specific sections should be hidden
      expect(screen.queryByText(/Dosage/)).not.toBeInTheDocument();
      expect(screen.queryByText('Injection Site')).not.toBeInTheDocument();
      // Notes should be populated
      const notesArea = screen.getByPlaceholderText(/Any side effects, observations.../) as HTMLTextAreaElement;
      expect(notesArea.value).toBe('Symptom note');
    });
  });

  describe('Medical Warnings', () => {
    it('displays a medical warning banner when severe symptoms are detected', () => {
      // Enable titration wizard
      useSettingsStore.setState({
        settings: { ...useSettingsStore.getState().settings, titrationWizardEnabled: true }
      });
      
      // Add a protocol
      useProtocolStore.setState({
        protocols: [{
          id: 'p-1',
          medicationId: 'med-1',
          name: 'Standard',
          steps: [{ id: 's1', dosage: 0.25, durationWeeks: 4 }],
          currentStepIndex: 0,
          startDate: Date.now() - 30 * 24 * 60 * 60 * 1000,
          currentStepStartDate: Date.now() - 30 * 24 * 60 * 60 * 1000,
          autoAdvance: false,
          createdAt: Date.now(),
          targetType: 'weekly-equivalent' as const
        }]
      });
      
      // Set severe symptoms (score > threshold 5)
      useSymptomLogStore.setState({
        logs: [
          {
            id: 'sym-severe',
            medicationId: 'med-1',
            dateTime: Date.now() - 1 * 24 * 60 * 60 * 1000,
            symptoms: [
              { label: 'Severe Nausea', severity: 'severe' },
              { label: 'Severe Fatigue', severity: 'severe' }
            ], // Score 6
            notes: '',
            createdAt: Date.now(),
          }
        ]
      });

      render(<LogDose />);
      
      expect(screen.getAllByText('Medical Warning').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/High side effect burden detected/)).toBeInTheDocument();
      expect(screen.getByText('Consult your healthcare provider immediately.')).toBeInTheDocument();
    });
  });

  describe('Titration Wizard & Protocol Step Displays', () => {
    beforeEach(() => {
      // Enable titration wizard
      useSettingsStore.setState({
        settings: { ...defaultSettings, titrationWizardEnabled: true }
      });
    });

    it('shows titration step indication when weekly protocol is active', () => {
      useProtocolStore.setState({
        protocols: [{
          id: 'p-1',
          medicationId: 'med-1',
          name: 'Weekly clinical prot',
          steps: [{ id: 's1', dosage: 0.25, durationWeeks: 4 }, { id: 's2', dosage: 0.5, durationWeeks: 4 }],
          currentStepIndex: 1,
          startDate: Date.now(),
          currentStepStartDate: Date.now(),
          autoAdvance: false,
          createdAt: Date.now(),
          targetType: 'weekly-equivalent'
        }],
        initialized: true
      });

      render(<LogDose />);

      expect(screen.getByLabelText('Titration Protocol Info')).toBeInTheDocument();
      expect(screen.getByText('Weekly clinical prot')).toBeInTheDocument();
      expect(screen.getByText('Step 2 of 2')).toBeInTheDocument();
      expect(screen.getByText(/0.5 mg Weekly Dose/)).toBeInTheDocument();
      expect(screen.getByText(/Recommended clinical dosage for Step 2 is 0.5 mg/)).toBeInTheDocument();
    });

    it('shows step indication and calculates top-up dose in PK mode', () => {
      useProtocolStore.setState({
        protocols: [{
          id: 'p-1',
          medicationId: 'med-1',
          name: 'PK steady state prot',
          steps: [{ id: 's1', dosage: 0.5, durationWeeks: 4, targetConcentration: 10.0 }],
          currentStepIndex: 0,
          startDate: Date.now(),
          currentStepStartDate: Date.now(),
          autoAdvance: false,
          createdAt: Date.now(),
          targetType: 'steady-state-concentration'
        }],
        initialized: true
      });

      render(<LogDose />);

      expect(screen.getByLabelText('Titration Protocol Info')).toBeInTheDocument();
      expect(screen.getByText('PK steady state prot')).toBeInTheDocument();
      expect(screen.getByText('Step 1 of 1')).toBeInTheDocument();
      expect(screen.getAllByText(/10\s*ng\/ml/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Calculated top-up dose to reach your/)).toBeInTheDocument();
    });

    it('shows timing warning when logging a dose 3 days early in clinical weekly mode', () => {
      useProtocolStore.setState({
        protocols: [{
          id: 'p-1',
          medicationId: 'med-1',
          name: 'Weekly clinical prot',
          steps: [{ id: 's1', dosage: 0.25, durationWeeks: 4 }],
          currentStepIndex: 0,
          startDate: Date.now() - 3 * 24 * 60 * 60 * 1000,
          currentStepStartDate: Date.now() - 3 * 24 * 60 * 60 * 1000,
          autoAdvance: false,
          createdAt: Date.now(),
          targetType: 'weekly-equivalent'
        }],
        initialized: true
      });

      useMedicationStore.setState({
        medications: [mockMedication],
        doses: [{
          id: 'prev-dose',
          medicationId: 'med-1',
          dosage: 0.25,
          unit: 'mg',
          injectionSite: 'abdomen-upper-left',
          dateTime: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days ago
          notes: '',
          createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
        }],
        initialized: true
      });

      render(<LogDose />);

      expect(screen.getByLabelText('Dose Timing Warning')).toBeInTheDocument();
      expect(screen.getByText('Overdose Risk Warning')).toBeInTheDocument();
      expect(screen.getByText(/Dosing now would be 4\.0 days early/)).toBeInTheDocument();
    });

    it('shows timing warning when logging a dose 3 days late in clinical weekly mode', () => {
      useProtocolStore.setState({
        protocols: [{
          id: 'p-1',
          medicationId: 'med-1',
          name: 'Weekly clinical prot',
          steps: [{ id: 's1', dosage: 0.25, durationWeeks: 4 }],
          currentStepIndex: 0,
          startDate: Date.now() - 10 * 24 * 60 * 60 * 1000,
          currentStepStartDate: Date.now() - 10 * 24 * 60 * 60 * 1000,
          autoAdvance: false,
          createdAt: Date.now(),
          targetType: 'weekly-equivalent'
        }],
        initialized: true
      });

      useMedicationStore.setState({
        medications: [mockMedication],
        doses: [{
          id: 'prev-dose',
          medicationId: 'med-1',
          dosage: 0.25,
          unit: 'mg',
          injectionSite: 'abdomen-upper-left',
          dateTime: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 days ago
          notes: '',
          createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
        }],
        initialized: true
      });

      render(<LogDose />);

      expect(screen.getByLabelText('Dose Timing Warning')).toBeInTheDocument();
      expect(screen.getByText('Schedule Deviation Info')).toBeInTheDocument();
      expect(screen.getByText(/Dosing now would be 3\.0 days late/)).toBeInTheDocument();
    });
  });
});
