'use client';

/**
 * AI Elements ToolExecutionDisplay Component
 * 
 * Enhanced tool execution display with AI Elements patterns.
 * Combines tool invocation and result display with smooth animations.
 * 
 * Validates: Requirements 2.4, 2.6, 2.7
 * - 2.4: Display multiple tools in order they were invoked
 * - 2.6: Collapsed shows summary, expanded shows full details
 * - 2.7: Expanded shows full parameters and results
 */

import { useState, useEffect } from 'react';
import { ToolCall } from '@/types';
import {
  AIElementsToolStatus,
  formatToolName,
  formatToolArguments,
  formatToolResult,
  getToolStatusClass,
} from '@/lib/ai-elements-adapters';

export interface ToolExecutionDisplayAIProps {
  /** The tool call object */
  toolCall: ToolCall;
  /** Execution status */
  status?: AIElementsToolStatus;
  /** Tool execution result */
  result?: unknown;
  /** Error message if execution failed */
  error?: string;
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
 * Status indicator dot
 */
function StatusDot({ status }: { status: AIElementsToolStatus }) {
  return (
    <span
      className={`status-dot ${getToolStatusClass(status)}`}
      aria-label={`Status: ${status}`}
      style={{
        transition: 'background-color 0.3s ease, border-color 0.3s ease',
      }}
    />
  );
}

/**
 * AI Elements ToolExecutionDisplay Component
 * 
 * Enhanced version with smooth state transitions, execution time display,
 * and better animations.
 */
export function ToolExecutionDisplayAI({
  toolCall,
  status = 'completed',
  result,
  error,
  narrative,
}: ToolExecutionDisplayAIProps) {
  const [expanded, setExpanded] = useState(false);
  const [executionTime, setExecutionTime] = useState<number | undefined>(undefined);
  const [startTime] = useState<number>(Date.now());

  // Track execution time for executing tools
  useEffect(() => {
    if (status === 'completed' || status === 'failed') {
      const endTime = Date.now();
      setExecutionTime(endTime - startTime);
    }
  }, [status, startTime]);

  if (!toolCall) return null;

  const displayName = formatToolName(toolCall?.name);
  const isExecuting = status === 'executing' || status === 'pending';
  const hasError = status === 'failed' || !!error;
  const hasResult = status === 'completed' && result !== undefined;

  return (
    <div
      className={`tool-execution tool-${status}`}
      data-testid="tool-execution-display-ai"
      role="region"
      aria-label={`Tool execution: ${displayName}`}
      style={{
        transition: 'background-color 0.3s ease, border-color 0.3s ease, transform 0.2s ease',
      }}
    >
      {/* Tool header - always visible (collapsed state shows summary) */}
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
          transition: 'background-color 0.2s ease',
        }}
      >
        {/* Chevron icon with smooth rotation */}
        <span
          className="chevron"
          style={{
            display: 'inline-flex',
            transition: 'transform 0.3s ease',
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

        {/* Status indicator with smooth transition */}
        <span
          className="tool-status"
          style={{
            transition: 'opacity 0.2s ease',
          }}
        >
          {isExecuting ? <LoadingSpinner /> : <StatusDot status={status} />}
        </span>

        {/* Execution time display */}
        {executionTime !== undefined && !isExecuting && (
          <span
            className="tool-execution-time"
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginLeft: '4px',
              opacity: 1,
              transition: 'opacity 0.3s ease',
            }}
            data-testid="execution-time"
          >
            {executionTime}ms
          </span>
        )}
      </button>

      {/* Tool narrative - conversational context (collapsed state summary) */}
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

      {/* Expanded details with smooth transition */}
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

          {/* Tool parameters (full details in expanded state) */}
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

          {/* Tool result (full details in expanded state) */}
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
}

export default ToolExecutionDisplayAI;
