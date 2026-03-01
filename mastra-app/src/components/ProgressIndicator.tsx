'use client';

/**
 * ProgressIndicator Component
 * 
 * Displays multi-step progress indicators as a subtle badge with:
 * - Current processing stage (e.g., "Investigating Schema...", "Calculating Distances...")
 * - Step count (e.g., "Step 2 of 4")
 * - Pulsating indicator during processing
 * - Completion indicator
 * - Smooth fade-out animation on completion
 * 
 * Styled as a subtle badge, not a prominent panel (Requirement 18.4)
 * 
 * Task 20.6: Implement multi-step progress indicators
 * Task 20.8: Implement progress indicator cleanup
 * Task 24.7: Enhance system progress indicator with descriptive labels and subtle badge styling
 * Validates: Requirements 16.4, 16.6, 18.4
 */

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepDescription: string;
  isCompleted?: boolean;
  isFadingOut?: boolean;
}

export function ProgressIndicator({
  currentStep,
  totalSteps,
  stepDescription,
  isCompleted = false,
  isFadingOut = false,
}: ProgressIndicatorProps) {
  // Don't show progress indicator for single-step operations
  if (totalSteps <= 1) {
    return null;
  }

  // Determine status for aria-label
  const ariaLabel = isCompleted
    ? `Completed all ${totalSteps} steps`
    : `Step ${currentStep} of ${totalSteps}: ${stepDescription}`;

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        borderRadius: '16px',
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-color)',
        fontSize: '13px',
        color: 'var(--text-secondary)',
        fontWeight: '500',
        marginBottom: '8px',
        animation: isFadingOut ? 'progressFadeOut 0.3s ease-out forwards' : 'fadeIn 0.3s ease-in',
      }}
      data-testid="progress-indicator"
    >
      {isCompleted ? (
        <>
          {/* Checkmark icon for completion */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            style={{ color: 'var(--success-color, #10b981)', flexShrink: 0 }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
            Completed
          </span>
        </>
      ) : (
        <>
          {/* Pulsating indicator during processing */}
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--accent)',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              flexShrink: 0,
            }}
          />
          
          {/* Step count */}
          <span style={{ color: 'var(--text-primary)', fontWeight: '600', whiteSpace: 'nowrap' }}>
            Step {currentStep}/{totalSteps}
          </span>
          
          {/* Descriptive label showing current processing stage */}
          {stepDescription && stepDescription.trim() && (
            <span style={{ color: 'var(--text-muted)' }}>
              {stepDescription}
            </span>
          )}
        </>
      )}
      
      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes progressFadeOut {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(-4px);
          }
        }
      `}</style>
    </div>
  );
}
