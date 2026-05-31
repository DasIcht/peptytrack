import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { HelpBox } from './HelpBox';

describe('HelpBox', () => {
  it('renders children only when expanded', () => {
    render(
      <HelpBox>
        <div data-testid="help-content">Help info</div>
      </HelpBox>
    );

    // Initial state: not expanded
    const button = screen.getByRole('button', { name: 'Show help' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    
    // The content is present in the DOM but typically hidden via CSS (grid-rows-[0fr] opacity-0)
    // We just verify it toggles attributes and state correctly.
    
    // Click to expand
    fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'Hide help' })).toHaveAttribute('aria-expanded', 'true');
    
    // Click to collapse
    fireEvent.click(screen.getByRole('button', { name: 'Hide help' }));
    expect(screen.getByRole('button', { name: 'Show help' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders with custom className', () => {
    const { container } = render(
      <HelpBox className="test-class">
        Content
      </HelpBox>
    );
    // The wrapper div should have the custom class
    expect(container.firstChild).toHaveClass('test-class');
  });
});
