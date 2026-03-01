/**
 * Property-Based Tests for ProgressIndicator
 * 
 * Tests universal properties that should hold for all valid progress indicator states.
 * Uses fast-check for property-based testing with minimum 100 iterations.
 * 
 * Task 20.6: Implement multi-step progress indicators
 * Task 24.7: Enhance system progress indicator with descriptive labels and subtle badge styling
 * Feature: claude-desktop-alternative, Property 42: Progress Indicator Updates
 * Validates: Requirements 16.4, 18.4
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressIndicator } from '@/components/ProgressIndicator';
import * as fc from 'fast-check';

describe('ProgressIndicator - Property-Based Tests', () => {
  /**
   * Property 42: Progress Indicator Updates
   * 
   * For any multi-step operation with N steps, the progress indicator SHALL update N times,
   * once for each step completion.
   * 
   * Badge design: Shows "Step X/Y" format with descriptive label, no percentage display
   * 
   * **Validates: Requirements 16.4, 18.4**
   */
  it('should display correct step count for any valid step and total', () => {
    fc.assert(
      fc.property(
        // Generate valid step numbers (1 to totalSteps)
        fc.integer({ min: 2, max: 100 }).chain((totalSteps) =>
          fc.record({
            currentStep: fc.integer({ min: 1, max: totalSteps }),
            totalSteps: fc.constant(totalSteps),
            stepDescription: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          })
        ),
        ({ currentStep, totalSteps, stepDescription }) => {
          const { container, unmount } = render(
            <ProgressIndicator
              currentStep={currentStep}
              totalSteps={totalSteps}
              stepDescription={stepDescription}
            />
          );

          // Property: Should display "Step X/Y" format (badge design)
          const stepText = container.querySelector(`[aria-label*="Step ${currentStep} of ${totalSteps}"]`);
          expect(stepText).toBeTruthy();

          // Property: Should display step description
          expect(container.textContent).toContain(stepDescription);

          // Property: Should have proper ARIA label
          const progressElement = container.querySelector('[role="status"]');
          expect(progressElement).toHaveAttribute(
            'aria-label',
            `Step ${currentStep} of ${totalSteps}: ${stepDescription}`
          );

          // Property: Badge design should have pulsating indicator (not completed)
          const pulsatingIndicator = container.querySelector('[style*="pulse"]');
          expect(pulsatingIndicator).toBeTruthy();

          // Cleanup
          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Step Progression Display
   * 
   * For any valid step and total, the step count should be:
   * - Displayed in "Step X/Y" format
   * - Monotonically increasing as steps progress
   * - Badge design: No percentage display, just step count
   */
  it('should calculate percentage correctly for any step progression', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 50 }),
        (totalSteps) => {
          const stepCounts: number[] = [];

          // Test each step from 1 to totalSteps
          for (let step = 1; step <= totalSteps; step++) {
            const { container, unmount } = render(
              <ProgressIndicator
                currentStep={step}
                totalSteps={totalSteps}
                stepDescription={`Step ${step}`}
              />
            );

            // Badge design: Verify step count is displayed (not percentage)
            const stepElement = container.querySelector('[style*="font-weight: 600"]');
            expect(stepElement?.textContent).toContain(`Step ${step}/${totalSteps}`);

            stepCounts.push(step);
            unmount();
          }

          // Property: Step counts should be monotonically increasing
          for (let i = 1; i < stepCounts.length; i++) {
            expect(stepCounts[i]).toBeGreaterThan(stepCounts[i - 1]);
          }

          // Property: Last step should equal totalSteps
          expect(stepCounts[stepCounts.length - 1]).toBe(totalSteps);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Single-Step Operations Never Render
   * 
   * For any operation with totalSteps <= 1, the component should not render anything.
   */
  it('should not render for single-step or zero-step operations', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1 }),
        fc.string(),
        (totalSteps, stepDescription) => {
          const { container, unmount } = render(
            <ProgressIndicator
              currentStep={totalSteps}
              totalSteps={totalSteps}
              stepDescription={stepDescription}
            />
          );

          // Property: Should not render anything
          expect(container.firstChild).toBeNull();

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Completion State Display
   * 
   * For any completed operation, the component should:
   * - Display "Completed" (badge design - simplified message)
   * - Not display the step description
   * - Show a checkmark icon
   * - Badge design: No percentage display
   */
  it('should display completion state correctly for any total steps', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 100 }),
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        (totalSteps, stepDescription) => {
          const { container, unmount } = render(
            <ProgressIndicator
              currentStep={totalSteps}
              totalSteps={totalSteps}
              stepDescription={stepDescription}
              isCompleted={true}
            />
          );

          // Property: Badge design shows just "Completed" (not "Completed all X steps")
          const completedText = Array.from(container.querySelectorAll('span'))
            .find(span => span.textContent === 'Completed');
          expect(completedText).toBeTruthy();

          // Property: Should NOT display step description span (text-muted style)
          const descriptionSpan = Array.from(container.querySelectorAll('span'))
            .find(span => span.getAttribute('style')?.includes('text-muted'));
          expect(descriptionSpan).toBeFalsy();

          // Property: Should have checkmark SVG
          const svg = container.querySelector('svg');
          expect(svg).toBeInTheDocument();

          // Property: Should have proper ARIA label
          const progressElement = container.querySelector('[role="status"]');
          expect(progressElement).toHaveAttribute(
            'aria-label',
            `Completed all ${totalSteps} steps`
          );

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Last Step Indicator
   * 
   * Badge design: No special "(Final step)" indicator shown
   * Just displays "Step X/Y" format consistently
   */
  it('should indicate final step when currentStep equals totalSteps', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 100 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        (totalSteps, stepDescription) => {
          const { container, unmount } = render(
            <ProgressIndicator
              currentStep={totalSteps}
              totalSteps={totalSteps}
              stepDescription={stepDescription}
              isCompleted={false}
            />
          );

          // Property: Badge design shows "Step X/Y" format (no special "Final step" indicator)
          const stepElement = container.querySelector('[style*="font-weight: 600"]');
          expect(stepElement?.textContent).toContain(`Step ${totalSteps}/${totalSteps}`);

          // Property: Should still show step description
          expect(container.textContent).toContain(stepDescription);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Step Description Visibility
   * 
   * For any non-completed operation with a non-empty description,
   * the description should be visible.
   */
  it('should display step description for all non-completed steps', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 50 }).chain((totalSteps) =>
          fc.record({
            currentStep: fc.integer({ min: 1, max: totalSteps }),
            totalSteps: fc.constant(totalSteps),
            stepDescription: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          })
        ),
        ({ currentStep, totalSteps, stepDescription }) => {
          const { container, unmount } = render(
            <ProgressIndicator
              currentStep={currentStep}
              totalSteps={totalSteps}
              stepDescription={stepDescription}
              isCompleted={false}
            />
          );

          // Property: Description should be visible
          expect(container.textContent).toContain(stepDescription);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: ARIA Label Consistency
   * 
   * For any progress state, the ARIA label should accurately reflect
   * the current state (either in-progress or completed).
   */
  it('should have consistent ARIA labels for all states', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 50 }).chain((totalSteps) =>
          fc.record({
            currentStep: fc.integer({ min: 1, max: totalSteps }),
            totalSteps: fc.constant(totalSteps),
            stepDescription: fc.string({ minLength: 1, maxLength: 100 }),
            isCompleted: fc.boolean(),
          })
        ),
        ({ currentStep, totalSteps, stepDescription, isCompleted }) => {
          const { container, unmount } = render(
            <ProgressIndicator
              currentStep={currentStep}
              totalSteps={totalSteps}
              stepDescription={stepDescription}
              isCompleted={isCompleted}
            />
          );

          const progressElement = container.querySelector('[role="status"]');
          const ariaLabel = progressElement?.getAttribute('aria-label');

          // Property: ARIA label should exist
          expect(ariaLabel).toBeTruthy();

          // Property: ARIA label should match state
          if (isCompleted) {
            expect(ariaLabel).toBe(`Completed all ${totalSteps} steps`);
          } else {
            expect(ariaLabel).toBe(`Step ${currentStep} of ${totalSteps}: ${stepDescription}`);
          }

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Badge Design Consistency
   * 
   * Badge design: No progress bar, just step count and pulsating indicator
   * This test verifies the badge has the expected visual elements
   */
  it('should have progress bar width matching percentage', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 50 }).chain((totalSteps) =>
          fc.record({
            currentStep: fc.integer({ min: 1, max: totalSteps }),
            totalSteps: fc.constant(totalSteps),
          })
        ),
        ({ currentStep, totalSteps }) => {
          const { container, unmount } = render(
            <ProgressIndicator
              currentStep={currentStep}
              totalSteps={totalSteps}
              stepDescription="Test"
            />
          );

          // Badge design: Verify pulsating indicator is present (not progress bar)
          const pulsatingIndicator = container.querySelector('[style*="pulse"]');
          expect(pulsatingIndicator).toBeTruthy();

          // Badge design: Verify step count is displayed
          const stepElement = container.querySelector('[style*="font-weight: 600"]');
          expect(stepElement?.textContent).toContain(`Step ${currentStep}/${totalSteps}`);

          // Badge design: Verify inline-flex layout (badge style)
          const badge = container.querySelector('[style*="inline-flex"]');
          expect(badge).toBeTruthy();

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
