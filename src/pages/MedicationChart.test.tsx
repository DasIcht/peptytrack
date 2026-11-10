import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MedicationChart } from './MedicationChart';
import { useMedicationStore } from '../stores/medicationStore';
import { useWeightStore } from '../stores/weightStore';
import { useSymptomLogStore } from '../stores/symptomLogStore';
import { useProtocolStore } from '../stores/protocolStore';
import type { Medication, Dose } from '../types';

// Capture the data handed to the chart instead of rendering SVG in jsdom.
const chartData = vi.hoisted(() => ({ current: [] as { date: number }[] }));

vi.mock('recharts', () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Empty = () => null;
  return {
    ResponsiveContainer: Passthrough,
    AreaChart: ({ data, children }: { data: { date: number }[]; children?: ReactNode }) => {
      chartData.current = data;
      return <div data-testid="area-chart">{children}</div>;
    },
    Area: Empty,
    XAxis: Empty,
    YAxis: Empty,
    CartesianGrid: Empty,
    Tooltip: Empty,
    ReferenceDot: Empty,
    Line: Empty,
    Legend: Empty,
  };
});

vi.mock('../components/TitrationDecisionChart', () => ({ TitrationDecisionChart: () => null }));
vi.mock('../components/HelpBox', () => ({
  HelpBox: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));

const DAY = 24 * 60 * 60 * 1000;

const MED: Medication = {
  id: 'med-1',
  templateId: 'semaglutide',
  name: 'Semaglutide',
  brand: 'Ozempic',
  activeIngredient: 'Semaglutide',
  dosageOptions: [0.25, 0.5, 1],
  unit: 'mg',
  frequency: 'weekly',
  halfLifeHours: 168,
  color: '#14b8a6',
  reminderHoursBefore: 24,
  enabled: true,
  createdAt: 0,
};

function dose(id: string, dateTime: number): Dose {
  return {
    id,
    medicationId: MED.id,
    dosage: 0.5,
    unit: 'mg',
    injectionSite: 'abdomen-upper-left',
    dateTime,
    notes: '',
    createdAt: dateTime,
  };
}

describe('MedicationChart — time range', () => {
  const firstDoseAt = Date.now() - 400 * DAY;

  beforeEach(() => {
    chartData.current = [];
    useMedicationStore.setState({
      medications: [MED],
      doses: [dose('d1', firstDoseAt), dose('d2', Date.now() - 10 * DAY)],
    });
    useWeightStore.setState({ entries: [] });
    useSymptomLogStore.setState({ logs: [] });
    useProtocolStore.setState({ protocols: [] });
  });

  it('shows an All option next to the day ranges', () => {
    render(<MedicationChart />);
    for (const label of ['7 Days', '30 Days', '90 Days', 'All']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: '30 Days' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('extends the chart back to the first logged dose when All is selected', () => {
    render(<MedicationChart />);
    const thirtyDayStart = chartData.current[0].date;
    expect(Date.now() - thirtyDayStart).toBeLessThan(31 * DAY);

    fireEvent.click(screen.getByRole('button', { name: 'All' }));

    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(chartData.current[0].date).toBe(firstDoseAt);
    expect(chartData.current.length).toBeLessThanOrEqual(700);
  });
});
