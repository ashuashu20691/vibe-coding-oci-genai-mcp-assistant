'use client';

/**
 * WorkingBadge Component
 * 
 * Displays a subtle badge during autonomous iteration loops showing:
 * - Current iteration count / max iterations (e.g., "3/5")
 * - Current strategy description (e.g., "Step 3/5: Retrying with SDO_GEOM...")
 * 
 * Updates in real-time from iteration_update events.
 * 
 * Requirements: 16.2
 */

interface WorkingBadgeProps {
  currentIteration: number;
  maxIterations: number;
  strategy?: string;
}

export function WorkingBadge({ currentIteration, maxIterations, strategy }: WorkingBadgeProps) {
  return (
    <div
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
        animation: 'fadeIn 0.3s ease-in',
      }}
      data-testid="working-badge"
    >
      {/* Pulsating indicator */}
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: 'var(--accent)',
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        }}
      />
      
      {/* Iteration count */}
      <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
        Working... {currentIteration}/{maxIterations}
      </span>
      
      {/* Strategy description if provided */}
      {strategy && (
        <span style={{ color: 'var(--text-muted)' }}>
          {strategy}
        </span>
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
        @keyframes fadeOut {
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
