/**
 * Unit tests for WorkingBadge component
 * 
 * Tests the working badge display during autonomous iteration loops.
 * Validates: Requirements 16.2
 */

import { render, screen } from '@testing-library/react';
import { WorkingBadge } from '@/components/WorkingBadge';

describe('WorkingBadge', () => {
  it('should display iteration count in format "N/M"', () => {
    render(<WorkingBadge currentIteration={3} maxIterations={5} />);
    
    expect(screen.getByText(/Working\.\.\. 3\/5/)).toBeInTheDocument();
  });

  it('should display strategy description when provided', () => {
    const strategy = 'Retrying with SDO_GEOM function';
    render(
      <WorkingBadge
        currentIteration={2}
        maxIterations={5}
        strategy={strategy}
      />
    );
    
    expect(screen.getByText(/Working\.\.\. 2\/5/)).toBeInTheDocument();
    expect(screen.getByText(strategy)).toBeInTheDocument();
  });

  it('should not display strategy when not provided', () => {
    const { container } = render(
      <WorkingBadge currentIteration={1} maxIterations={5} />
    );
    
    // Should only have the iteration count text
    const textElements = container.querySelectorAll('span');
    expect(textElements).toHaveLength(1);
    expect(textElements[0]).toHaveTextContent('Working... 1/5');
  });

  it('should display pulsating indicator', () => {
    const { container } = render(
      <WorkingBadge currentIteration={1} maxIterations={5} />
    );
    
    // Check for the pulsating dot element - just verify it exists
    const indicator = container.querySelector('div > div');
    expect(indicator).toBeInTheDocument();
  });

  it('should handle different iteration counts', () => {
    const { rerender } = render(
      <WorkingBadge currentIteration={1} maxIterations={5} />
    );
    expect(screen.getByText(/Working\.\.\. 1\/5/)).toBeInTheDocument();

    rerender(<WorkingBadge currentIteration={5} maxIterations={5} />);
    expect(screen.getByText(/Working\.\.\. 5\/5/)).toBeInTheDocument();
  });

  it('should handle different max iterations', () => {
    render(<WorkingBadge currentIteration={2} maxIterations={10} />);
    
    expect(screen.getByText(/Working\.\.\. 2\/10/)).toBeInTheDocument();
  });

  it('should update strategy description when changed', () => {
    const { rerender } = render(
      <WorkingBadge
        currentIteration={1}
        maxIterations={5}
        strategy="Checking schema"
      />
    );
    expect(screen.getByText('Checking schema')).toBeInTheDocument();

    rerender(
      <WorkingBadge
        currentIteration={2}
        maxIterations={5}
        strategy="Retrying with different approach"
      />
    );
    expect(screen.getByText('Retrying with different approach')).toBeInTheDocument();
    expect(screen.queryByText('Checking schema')).not.toBeInTheDocument();
  });
});
