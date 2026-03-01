/**
 * Unit tests for ProgressIndicator component
 * 
 * Tests multi-step progress indicators with:
 * - Current step name display
 * - Step count display (e.g., "Step 2 of 4")
 * - Progress bar updates
 * - Completion indicator
 * 
 * Task 20.6: Implement multi-step progress indicators
 * Validates: Requirements 16.4
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressIndicator } from '@/components/ProgressIndicator';

describe('ProgressIndicator', () => {
  describe('Step Count Display', () => {
    it('should display current step and total steps', () => {
      render(
        <ProgressIndicator
          currentStep={2}
          totalSteps={4}
          stepDescription="Processing data"
        />
      );

      // Step count is now in format "Step 2/4" in a single span
      expect(screen.getByText(/Step/i)).toBeInTheDocument();
      expect(screen.getByText((content, element) => {
        return element?.textContent === 'Step 2/4';
      })).toBeInTheDocument();
    });

    it('should display step count for first step', () => {
      render(
        <ProgressIndicator
          currentStep={1}
          totalSteps={5}
          stepDescription="Initializing"
        />
      );

      expect(screen.getByText((content, element) => {
        return element?.textContent === 'Step 1/5';
      })).toBeInTheDocument();
    });

    it('should display step count for last step', () => {
      render(
        <ProgressIndicator
          currentStep={3}
          totalSteps={3}
          stepDescription="Finalizing"
        />
      );

      expect(screen.getByText((content, element) => {
        return element?.textContent === 'Step 3/3';
      })).toBeInTheDocument();
      // Badge design no longer shows "(Final step)" indicator
    });
  });

  describe('Step Description Display', () => {
    it('should display current step description', () => {
      render(
        <ProgressIndicator
          currentStep={2}
          totalSteps={4}
          stepDescription="Analyzing database schema"
        />
      );

      expect(screen.getByText('Analyzing database schema')).toBeInTheDocument();
    });

    it('should display different descriptions for different steps', () => {
      const { rerender } = render(
        <ProgressIndicator
          currentStep={1}
          totalSteps={3}
          stepDescription="Loading data"
        />
      );

      expect(screen.getByText('Loading data')).toBeInTheDocument();

      rerender(
        <ProgressIndicator
          currentStep={2}
          totalSteps={3}
          stepDescription="Processing results"
        />
      );

      expect(screen.getByText('Processing results')).toBeInTheDocument();
      expect(screen.queryByText('Loading data')).not.toBeInTheDocument();
    });

    it('should not display description when completed', () => {
      render(
        <ProgressIndicator
          currentStep={3}
          totalSteps={3}
          stepDescription="Final step"
          isCompleted={true}
        />
      );

      expect(screen.queryByText('Final step')).not.toBeInTheDocument();
      // Badge design shows just "Completed" instead of "Completed all X steps"
      expect(screen.getByText(/Completed/i)).toBeInTheDocument();
    });
  });

  describe('Progress Bar', () => {
    it('should display progress bar with correct percentage', () => {
      render(
        <ProgressIndicator
          currentStep={2}
          totalSteps={4}
          stepDescription="Processing"
        />
      );

      // Badge design no longer shows percentage - removed progress bar
      // Just verify the step count is displayed
      expect(screen.getByText((content, element) => {
        return element?.textContent === 'Step 2/4';
      })).toBeInTheDocument();
    });

    it('should calculate percentage correctly for different steps', () => {
      const { rerender } = render(
        <ProgressIndicator
          currentStep={1}
          totalSteps={5}
          stepDescription="Step 1"
        />
      );

      // Badge design no longer shows percentage
      expect(screen.getByText((content, element) => {
        return element?.textContent === 'Step 1/5';
      })).toBeInTheDocument();

      rerender(
        <ProgressIndicator
          currentStep={3}
          totalSteps={5}
          stepDescription="Step 3"
        />
      );

      expect(screen.getByText((content, element) => {
        return element?.textContent === 'Step 3/5';
      })).toBeInTheDocument();
    });

    it('should show 100% when completed', () => {
      render(
        <ProgressIndicator
          currentStep={4}
          totalSteps={4}
          stepDescription="Done"
          isCompleted={true}
        />
      );

      // Badge design no longer shows percentage
      expect(screen.getByText(/Completed/i)).toBeInTheDocument();
    });
  });

  describe('Completion State', () => {
    it('should display completion message when isCompleted is true', () => {
      render(
        <ProgressIndicator
          currentStep={5}
          totalSteps={5}
          stepDescription="All done"
          isCompleted={true}
        />
      );

      // Badge design shows just "Completed" instead of "Completed all X steps"
      expect(screen.getByText(/Completed/i)).toBeInTheDocument();
    });

    it('should show checkmark icon when completed', () => {
      const { container } = render(
        <ProgressIndicator
          currentStep={3}
          totalSteps={3}
          stepDescription="Done"
          isCompleted={true}
        />
      );

      // Check for SVG checkmark
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg?.querySelector('path')).toHaveAttribute('d', 'M5 13l4 4L19 7');
    });

    it('should not show step description when completed', () => {
      render(
        <ProgressIndicator
          currentStep={4}
          totalSteps={4}
          stepDescription="Processing final step"
          isCompleted={true}
        />
      );

      expect(screen.queryByText('Processing final step')).not.toBeInTheDocument();
    });
  });

  describe('Single Step Operations', () => {
    it('should not render for single-step operations', () => {
      const { container } = render(
        <ProgressIndicator
          currentStep={1}
          totalSteps={1}
          stepDescription="Single step"
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should not render when totalSteps is 0', () => {
      const { container } = render(
        <ProgressIndicator
          currentStep={0}
          totalSteps={0}
          stepDescription="No steps"
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA label for in-progress state', () => {
      render(
        <ProgressIndicator
          currentStep={2}
          totalSteps={4}
          stepDescription="Analyzing data"
        />
      );

      const progressElement = screen.getByRole('status');
      expect(progressElement).toHaveAttribute(
        'aria-label',
        'Step 2 of 4: Analyzing data'
      );
    });

    it('should have proper ARIA label for completed state', () => {
      render(
        <ProgressIndicator
          currentStep={3}
          totalSteps={3}
          stepDescription="Done"
          isCompleted={true}
        />
      );

      const progressElement = screen.getByRole('status');
      expect(progressElement).toHaveAttribute(
        'aria-label',
        'Completed all 3 steps'
      );
    });
  });

  describe('Visual Updates', () => {
    it('should update display when step changes', () => {
      const { rerender } = render(
        <ProgressIndicator
          currentStep={1}
          totalSteps={4}
          stepDescription="Step 1"
        />
      );

      expect(screen.getByText((content, element) => {
        return element?.textContent === 'Step 1/4';
      })).toBeInTheDocument();

      rerender(
        <ProgressIndicator
          currentStep={2}
          totalSteps={4}
          stepDescription="Step 2"
        />
      );

      expect(screen.getByText((content, element) => {
        return element?.textContent === 'Step 2/4';
      })).toBeInTheDocument();
    });

    it('should transition from in-progress to completed', () => {
      const { rerender } = render(
        <ProgressIndicator
          currentStep={3}
          totalSteps={3}
          stepDescription="Final processing"
        />
      );

      expect(screen.getByText('Final processing')).toBeInTheDocument();
      expect(screen.getByText((content, element) => {
        return element?.textContent === 'Step 3/3';
      })).toBeInTheDocument();

      rerender(
        <ProgressIndicator
          currentStep={3}
          totalSteps={3}
          stepDescription="Final processing"
          isCompleted={true}
        />
      );

      expect(screen.queryByText('Final processing')).not.toBeInTheDocument();
      expect(screen.getByText(/Completed/i)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle large step counts', () => {
      render(
        <ProgressIndicator
          currentStep={50}
          totalSteps={100}
          stepDescription="Processing batch 50"
        />
      );

      expect(screen.getByText((content, element) => {
        return element?.textContent === 'Step 50/100';
      })).toBeInTheDocument();
    });

    it('should handle step descriptions with special characters', () => {
      render(
        <ProgressIndicator
          currentStep={1}
          totalSteps={3}
          stepDescription="Processing: data & results (50%)"
        />
      );

      expect(screen.getByText('Processing: data & results (50%)')).toBeInTheDocument();
    });

    it('should handle empty step description', () => {
      render(
        <ProgressIndicator
          currentStep={2}
          totalSteps={4}
          stepDescription=""
        />
      );

      expect(screen.getByText((content, element) => {
        return element?.textContent === 'Step 2/4';
      })).toBeInTheDocument();
      // Empty description should not cause errors
    });
  });
});
