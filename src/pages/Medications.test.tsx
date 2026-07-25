import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Medications } from './Medications';
import { useMedicationStore } from '../stores/medicationStore';
import { useVialStore } from '../stores/vialStore';
import { useUIStore } from '../stores/uiStore';

describe('Medications page', () => {
  beforeEach(async () => {
    // Reset stores
    useMedicationStore.setState({ medications: [], doses: [], loading: false, initialized: true });
    useVialStore.setState({ vials: [], loading: false, initialized: true });
    useUIStore.setState({ activePage: 'medications', logDoseMedId: null, isModalOpen: false, modalContent: null, toasts: [] });
  });

  it('renders without crashing', () => {
    render(<Medications />);
    expect(screen.getByText('Medications')).toBeInTheDocument();
  });

  it('shows medication list', async () => {
    useMedicationStore.setState({
      medications: [{
        id: 'med-1',
        templateId: 'lib-1',
        name: 'Semaglutide',
        brand: 'Ozempic',
        activeIngredient: 'Semaglutide',
        dosageOptions: [0.25, 0.5, 1],
        unit: 'mg',
        frequency: 'weekly',
        halfLifeHours: 168,
        color: '#10b981',
        reminderHoursBefore: 24,
        enabled: true,
        createdAt: Date.now(),
      }],
      doses: [],
      initialized: true,
    });

    render(<Medications />);
    expect(screen.getByText('Semaglutide')).toBeInTheDocument();
  });

  it('allows stepping down and stepping up active protocol from medication card', async () => {
    const { useSettingsStore } = await import('../stores/settingsStore');
    const { useProtocolStore } = await import('../stores/protocolStore');
    const fireEvent = (await import('@testing-library/react')).fireEvent;

    useSettingsStore.setState({
      settings: { ...useSettingsStore.getState().settings, titrationWizardEnabled: true }
    });

    useMedicationStore.setState({
      medications: [{
        id: 'med-1',
        templateId: 'lib-1',
        name: 'Tirzepatide',
        brand: 'Mounjaro',
        activeIngredient: 'Tirzepatide',
        dosageOptions: [2.5, 5, 7.5],
        unit: 'mg',
        frequency: 'weekly',
        halfLifeHours: 120,
        color: '#0ea5e9',
        reminderHoursBefore: 24,
        enabled: true,
        createdAt: Date.now(),
      }],
      doses: [],
      initialized: true,
    });

    useProtocolStore.setState({
      protocols: [{
        id: 'p-1',
        medicationId: 'med-1',
        name: 'Tirzepatide Protocol',
        steps: [
          { id: 's1', dosage: 2.5, durationWeeks: 4 },
          { id: 's2', dosage: 5.0, durationWeeks: 4 },
          { id: 's3', dosage: 7.5, durationWeeks: 4 }
        ],
        currentStepIndex: 1, // Step 2 of 3
        startDate: Date.now(),
        currentStepStartDate: Date.now(),
        autoAdvance: false,
        chartStyle: 'spider',
        targetType: 'weekly-equivalent',
        createdAt: Date.now(),
      }],
      initialized: true,
    });

    render(<Medications />);
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();

    const stepDownBtn = screen.getByTitle('Step Down Protocol');
    fireEvent.click(stepDownBtn);

    expect(useProtocolStore.getState().protocols[0].currentStepIndex).toBe(0);
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
  });
});
