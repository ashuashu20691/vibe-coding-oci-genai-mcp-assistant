'use client';

/**
 * AI Elements ToolResult Component
 * 
 * Displays tool execution results in a clean, readable format.
 * Companion component to ToolInvocationAI for showing just the result.
 * 
 * Validates: Requirements 2.2, 2.5
 * - 2.2: Display tool results using AI Elements
 * - 2.5: Display error messages for failed tool executions
 */

import { formatToolResult } from '@/lib/ai-elements-adapters';

export interface ToolResultAIProps {
  /** Tool execution result */
  result?: unknown;
  /** Error message if execution failed */
  error?: string;
  /** Whether the result is an error */
  isError?: boolean;
}

/**
 * AI Elements ToolResult Component
 * 
 * Displays tool execution results or errors in a formatted way.
 */
export function ToolResultAI({ result, error, isError = false }: ToolResultAIProps) {
  const hasError = isError || !!error;

  if (!result && !error) {
    return null;
  }

  return (
    <div
      className="tool-result"
      data-testid="tool-result-ai"
      role={hasError ? 'alert' : 'region'}
      aria-label={hasError ? 'Tool execution error' : 'Tool execution result'}
    >
      {hasError ? (
        // Error display
        <div
          style={{
            padding: '12px',
            fontSize: '13px',
            color: 'var(--status-error)',
            background: 'var(--bg-error)',
            borderRadius: '8px',
            border: '1px solid var(--status-error)',
          }}
          data-testid="tool-error-display"
        >
          <div
            style={{
              fontWeight: 500,
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Tool Execution Failed
          </div>
          <div style={{ fontSize: '12px' }}>{error || 'Unknown error occurred'}</div>
        </div>
      ) : (
        // Success result display
        <div
          style={{
            padding: '12px',
            fontSize: '13px',
            color: 'var(--text-primary)',
            background: 'var(--bg-tertiary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
          }}
          data-testid="tool-result-display"
        >
          <div
            style={{
              fontWeight: 500,
              marginBottom: '6px',
              fontSize: '11px',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Result
          </div>
          <pre
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '12px',
              fontFamily: 'var(--font-mono, monospace)',
            }}
          >
            {formatToolResult(result)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default ToolResultAI;
