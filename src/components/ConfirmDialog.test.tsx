import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from './ConfirmDialog';
import { useUIStore } from '../stores/uiStore';

describe('ConfirmDialog', () => {
  beforeEach(() => {
    useUIStore.setState({ isModalOpen: true, modalContent: null });
  });

  it('renders title and message', () => {
    render(
      <ConfirmDialog
        title="Delete Item?"
        message="This will be permanently removed."
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText('Delete Item?')).toBeInTheDocument();
    expect(screen.getByText('This will be permanently removed.')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        title="Delete?"
        message="Are you sure?"
        confirmLabel="Yes, Delete"
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByText('Yes, Delete'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        title="Delete?"
        message="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows danger styling when danger prop is true', () => {
    render(
      <ConfirmDialog
        title="Delete?"
        message="Dangerous action"
        danger
        onConfirm={vi.fn()}
      />
    );

    const confirmBtn = screen.getByText('Confirm');
    expect(confirmBtn.className).toContain('bg-red-600');
  });

  it('shows primary styling when danger prop is false', () => {
    render(
      <ConfirmDialog
        title="Confirm?"
        message="Safe action"
        onConfirm={vi.fn()}
      />
    );

    const confirmBtn = screen.getByText('Confirm');
    expect(confirmBtn.className).toContain('bg-primary-600');
  });

  it('closes modal on confirm', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        title="Test"
        message="Test message"
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByText('Confirm'));
    expect(useUIStore.getState().isModalOpen).toBe(false);
  });

  it('closes modal on cancel', () => {
    render(
      <ConfirmDialog
        title="Test"
        message="Test message"
        onConfirm={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(useUIStore.getState().isModalOpen).toBe(false);
  });
});
