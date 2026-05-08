import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SideEffectChips } from './SideEffectChips';

describe('SideEffectChips', () => {
  const sideEffects = ['Nausea', 'Headache', 'Fatigue'];

  it('renders all side effect chips', () => {
    render(
      <SideEffectChips
        sideEffects={sideEffects}
        selected={[]}
        onToggle={() => {}}
        onAddCustom={() => {}}
      />
    );
    expect(screen.getByText('Nausea')).toBeInTheDocument();
    expect(screen.getByText('Headache')).toBeInTheDocument();
    expect(screen.getByText('Fatigue')).toBeInTheDocument();
    expect(screen.getByText('Add Custom')).toBeInTheDocument();
  });

  it('highlights selected chips', () => {
    render(
      <SideEffectChips
        sideEffects={sideEffects}
        selected={['Headache']}
        onToggle={() => {}}
        onAddCustom={() => {}}
      />
    );
    const headacheBtn = screen.getByText('Headache').closest('button');
    expect(headacheBtn).toHaveClass('bg-primary-600/15');
  });

  it('calls onToggle when a chip is clicked', () => {
    const onToggle = vi.fn();
    render(
      <SideEffectChips
        sideEffects={sideEffects}
        selected={[]}
        onToggle={onToggle}
        onAddCustom={() => {}}
      />
    );
    fireEvent.click(screen.getByText('Nausea'));
    expect(onToggle).toHaveBeenCalledWith('Nausea');
  });

  it('reveals an input when Add Custom is clicked', () => {
    render(
      <SideEffectChips
        sideEffects={sideEffects}
        selected={[]}
        onToggle={() => {}}
        onAddCustom={() => {}}
      />
    );
    fireEvent.click(screen.getByText('Add Custom'));
    expect(screen.getByPlaceholderText('New side effect...')).toBeInTheDocument();
  });

  it('calls onAddCustom when custom input is submitted', () => {
    const onAddCustom = vi.fn();
    render(
      <SideEffectChips
        sideEffects={sideEffects}
        selected={[]}
        onToggle={() => {}}
        onAddCustom={onAddCustom}
      />
    );
    fireEvent.click(screen.getByText('Add Custom'));
    const input = screen.getByPlaceholderText('New side effect...');
    fireEvent.change(input, { target: { value: 'Itchy palms' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAddCustom).toHaveBeenCalledWith('Itchy palms');
  });

  it('does not call onAddCustom for empty input', () => {
    const onAddCustom = vi.fn();
    render(
      <SideEffectChips
        sideEffects={sideEffects}
        selected={[]}
        onToggle={() => {}}
        onAddCustom={onAddCustom}
      />
    );
    fireEvent.click(screen.getByText('Add Custom'));
    const input = screen.getByPlaceholderText('New side effect...');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAddCustom).not.toHaveBeenCalled();
  });

  it('shows expand button when there are more than 6 side effects', () => {
    const manyEffects = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    render(
      <SideEffectChips
        sideEffects={manyEffects}
        selected={[]}
        onToggle={() => {}}
        onAddCustom={() => {}}
      />
    );
    expect(screen.getByText('Show 2 more')).toBeInTheDocument();
  });

  it('expands to show all side effects when expand button is clicked', () => {
    const manyEffects = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    render(
      <SideEffectChips
        sideEffects={manyEffects}
        selected={[]}
        onToggle={() => {}}
        onAddCustom={() => {}}
      />
    );
    fireEvent.click(screen.getByText('Show 2 more'));
    expect(screen.getByText('G')).toBeInTheDocument();
    expect(screen.getByText('H')).toBeInTheDocument();
    expect(screen.getByText('Show less')).toBeInTheDocument();
  });
});
