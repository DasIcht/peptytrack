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
});
