'use client';

/**
 * AI Elements ToolInvocation Component
 * 
 * Modern tool invocation display using AI Elements patterns.
 * Shows tool name, parameters, execution status, and results.
 * 
 * Validates: Requirements 2.1, 2.2, 2.3, 2.5, 9.1, 9.2, 10.2, 10.4
 * - 2.1: Display tool name and parameters using AI Elements
 * - 2.2: Display tool results using AI Elements
 * - 2.3: Show loading animation for executing tools
 * - 2.5: Display error messages for failed tool executions
 * - 9.1: Optimized rendering with React.memo
 * - 9.2: Memoized expensive computations
 * - 10.2: Appropriate ARIA labels for interactive elements
 * - 10.4: ARIA live regions for tool execution status changes
 */

import { useState, memo, useMemo, useEffect } from 'react';
import { ToolCall } from '@/types';
import {
  AIElementsToolStatus,
  formatToolName,
  formatToolArguments,
  formatToolResult,
  getToolStatusClass,
} from '@/lib/ai-elements-adapters';
import { useToolStatusAnnouncements } from '@/hooks/useAriaLive';

export interface ToolInvocationAIProps {
  /** The tool call object */
  toolCall: ToolCall;
  /** Execution status */
  status?: AIElementsToolStatus;
  /** Tool execution result */
  result?: unknown;
  /** Error message if execution failed */
  error?: string;
  /** Execution time in milliseconds */
  executionTime?: number;
  /** Tool narrative for conversational context */
  narrative?: string;
}

/**
 * Loading spinner animation for executing tools
 */
function LoadingSpinner() {
  return (
    <svg
      className="animate-spin"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: 'var(--accent)' }}
      aria-label="Loading"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

/**
 * Status indicator dot with icon for non-color accessibility
 * Validates: Requirement 10.8
 */
function StatusDot({ status }: { status: AIElementsToolStatus }) {
  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return '✓'; // Checkmark for success
      case 'failed':
        return '✕'; // X for error
      case 'executing':
      case 'pending':
        return '⟳'; // Spinner for loading
      default:
        return '●'; // Dot for unknown
    }
  };
  
  const getStatusLabel = () => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'executing':
        return 'Executing';
      case 'pending':
        return 'Pending';
      default:
        return 'Unknown';
    }
  };
  
  return (
    <span
      className={`status-dot ${getToolStatusClass(status)}`}
      aria-label={`Status: ${getStatusLabel()}`}
      title={getStatusLabel()}
      style={{
        transition: 'background-color 0.3s ease, border-color 0.3s ease',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      <span 
        style={{ 
          fontSize: '12px',
          fontWeight: 'bold',
          animation: status === 'executing' || status === 'pending' ? 'spin 1s linear infinite' : 'none',
        }}
        aria-hidden="true"
      >
        {getStatusIcon()}
      </span>
      <span className="status-label sr-only">{getStatusLabel()}</span>
    </span>
  );
}

/**
 * AI Elements ToolInvocation Component
 * 
 * Displays tool invocations with collapsible details, loading states,
 * and error handling. Optimized with React.memo.
 */
export const ToolInvocationAI = memo(function ToolInvocationAI({
  toolCall,
  status = 'completed',
  result,
  error,
  executionTime,
  narrative,
}: ToolInvocationAIProps) {
  const [expanded, setExpanded] = useState(false);
  
  // ARIA live announcements for tool status changes - Validates: Requirement 10.4
  const { announce: announceToolStatus } = useToolStatusAnnouncements();

  // Memoize expensive computations - Validates: Requirement 9.1, 9.2
  const displayName = useMemo(() => formatToolName(toolCall?.name), [toolCall?.name]);
  const isExecuting = useMemo(() => status === 'executing' || status === 'pending', [status]);
  const hasError = useMemo(() => status === 'failed' || !!error, [status, error]);
  const hasResult = useMemo(() => status === 'completed' && result !== undefined, [status, result]);
  
  // Announce tool status changes to screen readers - Validates: Requirement 10.4
  useEffect(() => {
    if (!toolCall) return;
    
    const toolName = formatToolName(toolCall.name);
    
    if (status === 'executing' || status === 'pending') {
      announceToolStatus(`Tool ${toolName} is executing`);
    } else if (status === 'completed') {
      announceToolStatus(`Tool ${toolName} completed successfully`);
    } else if (status === 'failed') {
      announceToolStatus(`Tool ${toolName} failed: ${error || 'Unknown error'}`);
    }
  }, [status, toolCall, error, announceToolStatus]);

  if (!toolCall) return null;

  return (
    <div
      className={`tool-execution tool-${status}`}
      data-testid="tool-invocation-ai"
      role="region"
      aria-label={`Tool invocation: ${displayName}`}
      style={{
        transition: 'background-color 0.3s ease, border-color 0.3s ease, transform 0.2s ease',
      }}
    >
      {/* Tool header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
        className="tool-header"
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} tool details for ${displayName}`}
        data-testid="tool-header-button"
        style={{
          transition: 'opacity 0.2s ease',
        }}
      >
        {/* Chevron icon */}
        <span
          className="chevron"
          style={{
            display: 'inline-flex',
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
          aria-hidden="true"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: 'var(--text-muted)' }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>

        {/* Tool name */}
        <span className="tool-name" data-testid="tool-name">
          {displayName}
        </span>

        {/* Status indicator */}
        <span className="tool-status">
          {isExecuting ? <LoadingSpinner /> : <StatusDot status={status} />}
        </span>

        {/* Execution time */}
        {executionTime !== undefined && (
          <span
            className="tool-execution-time"
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginLeft: '4px',
            }}
            data-testid="execution-time"
          >
            {executionTime}ms
          </span>
        )}
      </button>

      {/* Tool narrative - conversational context */}
      {narrative && !expanded && (
        <div
          className="tool-narrative"
          style={{
            marginTop: '4px',
            padding: '8px 12px',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            fontStyle: 'italic',
            borderLeft: '2px solid var(--border-color)',
            marginLeft: '20px',
            opacity: 1,
            transition: 'opacity 0.3s ease',
          }}
          data-testid="tool-narrative"
        >
          {narrative}
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div 
          className="tool-details" 
          data-testid="tool-details"
          style={{
            maxHeight: expanded ? '1000px' : '0',
            opacity: expanded ? 1 : 0,
            overflow: 'hidden',
            transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
          }}
        >
          {/* Tool name */}
          <div
            style={{
              marginBottom: '4px',
              color: 'var(--text-muted)',
              fontSize: '11px',
            }}
          >
            Tool:{' '}
            <span
              style={{ color: 'var(--text-secondary)', fontWeight: 500 }}
              data-testid="tool-name-detail"
            >
              {toolCall?.name || 'Unknown'}
            </span>
          </div>

          {/* Tool parameters */}
          {toolCall?.arguments && Object.keys(toolCall.arguments).length > 0 ? (
            <>
              <div
                style={{
                  marginBottom: '2px',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                }}
              >
                Parameters:
              </div>
              <pre
                style={{
                  margin: 0,
                  marginBottom: '8px',
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontSize: '12px',
                }}
                data-testid="tool-parameters"
              >
                {formatToolArguments(toolCall.arguments)}
              </pre>
            </>
          ) : (
            <div
              style={{
                color: 'var(--text-muted)',
                fontSize: '11px',
                fontStyle: 'italic',
                marginBottom: '8px',
              }}
            >
              No parameters
            </div>
          )}

          {/* Tool narrative in expanded view */}
          {narrative && (
            <>
              <div
                style={{
                  marginBottom: '2px',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                }}
              >
                Context:
              </div>
              <div
                style={{
                  marginBottom: '8px',
                  padding: '8px',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  fontStyle: 'italic',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '4px',
                }}
                data-testid="tool-narrative-expanded"
              >
                {narrative}
              </div>
            </>
          )}

          {/* Tool result */}
          {hasResult && (
            <>
              <div
                style={{
                  marginBottom: '2px',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                }}
              >
                Result:
              </div>
              <pre
                style={{
                  margin: 0,
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontSize: '12px',
                  background: 'var(--bg-tertiary)',
                  padding: '8px',
                  borderRadius: '4px',
                }}
                data-testid="tool-result"
              >
                {formatToolResult(result)}
              </pre>
            </>
          )}

          {/* Error message */}
          {hasError && error && (
            <>
              <div
                style={{
                  marginBottom: '2px',
                  color: 'var(--status-error)',
                  fontSize: '11px',
                  fontWeight: 500,
                }}
              >
                Error:
              </div>
              <div
                style={{
                  padding: '8px',
                  fontSize: '12px',
                  color: 'var(--status-error)',
                  background: 'var(--bg-error)',
                  borderRadius: '4px',
                  border: '1px solid var(--status-error)',
                }}
                data-testid="tool-error"
                role="alert"
              >
                {error}
              </div>
            </>
          )}

          {/* Execution time in expanded view */}
          {executionTime !== undefined && (
            <div
              style={{
                marginTop: '8px',
                fontSize: '11px',
                color: 'var(--text-muted)',
              }}
              data-testid="execution-time-detail"
            >
              Execution time: {executionTime}ms
            </div>
          )}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo - only re-render if relevant props changed
  return (
    prevProps.toolCall?.id === nextProps.toolCall?.id &&
    prevProps.status === nextProps.status &&
    prevProps.result === nextProps.result &&
    prevProps.error === nextProps.error &&
    prevProps.executionTime === nextProps.executionTime &&
    prevProps.narrative === nextProps.narrative
  );
});

export default ToolInvocationAI;
