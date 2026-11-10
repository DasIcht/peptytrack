import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Dashboard } from './Dashboard';
import { useMedicationStore } from '../stores/medicationStore';
import { useVialStore } from '../stores/vialStore';
import { useWeightStore } from '../stores/weightStore';
import { useUIStore } from '../stores/uiStore';

const DAY = 86400000;

describe('Dashboard quick stats', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    useMedicationStore.setState({
      medications: [{
        id: 'med-1', templateId: 'lib-1', name: 'Semaglutide', brand: 'Ozempic',
        activeIngredient: 'Semaglutide', dosageOptions: [0.25, 0.5, 1], unit: 'mg',
        frequency: 'weekly', halfLifeHours: 168, color: '#10b981',
        reminderHoursBefore: 24, enabled: true, createdAt: Date.now(),
      }],
      doses: [],
      loading: false,
      initialized: true,
      // Keep the page from reloading from IndexedDB during the test
      loadData: async () => {},
    });
    useVialStore.setState({ vials: [], loading: false, initialized: true });
    useWeightStore.setState({
      entries: [
        // newest first, as the store keeps them
        { id: 'w2', weight: 87.5, unit: 'kg', dateTime: Date.now(), notes: '', createdAt: Date.now() },
        { id: 'w1', weight: 90, unit: 'kg', dateTime: Date.now() - 14 * DAY, notes: '', createdAt: Date.now() - 14 * DAY },
      ],
      loadData: async () => {},
    });
    useUIStore.setState({ activePage: 'dashboard', toasts: [] });
  });

  it('uses short labels that fit four tiles across a phone screen', () => {
    render(<Dashboard />);
    const stats = screen.getByTestId('quick-stats');
    for (const label of ['Meds', 'Vials', 'Trend', 'Latest']) {
      expect(within(stats).getByText(label)).toBeInTheDocument();
    }
  });

  it('shows the weight unit on its own line for both weight tiles, like "Latest"', () => {
    render(<Dashboard />);
    const stats = screen.getByTestId('quick-stats');
    // Values never carry the unit inline (that is what made the trend tile wrap)
    expect(within(stats).getByText('2.5')).toBeInTheDocument();
    expect(within(stats).getByText('87.5')).toBeInTheDocument();
    expect(within(stats).getAllByText('kg')).toHaveLength(2);
    expect(within(stats).getByText('2.5').className).toContain('whitespace-nowrap');
  });
});
