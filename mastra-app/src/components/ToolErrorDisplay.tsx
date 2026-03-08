'use client';

import { useState } from 'react';
import { ErrorCode, getErrorInfo } from '@/lib/errors';
import { ToolError } from '@/types';

interface ToolErrorDisplayProps {
  error: ToolError;
  onRetry?: () => void;
  onDismiss?: () => void;
}

/**
 * ToolErrorDisplay - Displays tool execution errors inline in the conversation
 * 
 * Validates: Requirement 10.3
 * - Display tool errors inline without blocking the UI
 * - Allow conversation to continue after tool error
 * - Provide visual distinction for error messages
 */
export function ToolErrorDisplay({ error, onRetry, onDismiss }: ToolErrorDisplayProps) {
  const [expanded, setExpanded] = useState(false);
  
  // Get user-friendly error info if error code is available
  const errorInfo = error.errorCode ? getErrorInfo(error.errorCode as ErrorCode) : null;
  
  // Format the error message for display
  const displayMessage = formatToolErrorMessage(error.errorMessage);
  
  return (
    <div 
      className="my-3 rounded-xl overflow-hidden"
      style={{ 
        background: 'rgba(239, 68, 68, 0.05)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
      }}
      data-testid="tool-error-display"
      role="alert"
      aria-live="polite"
    >
      {/* Error Header */}
      <div 
        className="flex items-start gap-3 px-4 py-3"
        style={{ background: 'rgba(239, 68, 68, 0.08)' }}
      >
        {/* Error Icon */}
        <div 
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(239, 68, 68, 0.15)' }}
        >
          <svg 
            className="w-4 h-4" 
            style={{ color: '#EF4444' }}
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
            aria-hidden="true"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
            />
          </svg>
        </div>
        
        {/* Error Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span 
              className="text-sm font-semibold"
              style={{ color: '#DC2626' }}
              data-testid="tool-error-title"
            >
              {errorInfo?.title || 'Tool Execution Failed'}
            </span>
            <span 
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ 
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#DC2626',
              }}
              data-testid="tool-error-tool-name"
            >
              {formatToolName(error.toolName)}
            </span>
          </div>
          
          {/* Error Message */}
          <p 
            className="text-sm mt-1"
            style={{ color: 'var(--text-primary)' }}
            data-testid="tool-error-message"
          >
            {displayMessage}
          </p>
          
          {/* Suggestion if available */}
          {errorInfo?.suggestion && (
            <p 
              className="text-xs mt-2"
              style={{ color: 'var(--text-secondary)' }}
              data-testid="tool-error-suggestion"
            >
              {errorInfo.suggestion}
            </p>
          )}
        </div>
        
        {/* Dismiss Button */}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="flex-shrink-0 p-1 rounded hover:bg-red-100 transition-colors"
            aria-label="Dismiss error"
            data-testid="tool-error-dismiss"
          >
            <svg 
              className="w-4 h-4" 
              style={{ color: '#9CA3AF' }}
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      
      {/* Action Buttons */}
      <div 
        className="flex items-center gap-2 px-4 py-2"
        style={{ borderTop: '1px solid rgba(239, 68, 68, 0.1)' }}
      >
        {/* Retry Button */}
        {error.isRetryable && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors hover:opacity-90"
            style={{
              background: '#EF4444',
              color: 'white',
            }}
            data-testid="tool-error-retry"
          >
            <svg 
              className="w-3 h-3" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
              />
            </svg>
            Retry
          </button>
        )}
        
        {/* Show Details Toggle */}
        {error.details && Object.keys(error.details).length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md transition-colors"
            style={{ 
              color: 'var(--text-secondary)',
              background: 'transparent',
            }}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Hide' : 'Show'} error details`}
            data-testid="tool-error-toggle-details"
          >
            <svg 
              className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {expanded ? 'Hide details' : 'Show details'}
          </button>
        )}
        
        {/* Continue Hint */}
        <span 
          className="ml-auto text-xs"
          style={{ color: 'var(--text-muted)' }}
          data-testid="tool-error-continue-hint"
        >
          You can continue the conversation
        </span>
      </div>
      
      {/* Expandable Details */}
      {expanded && error.details && (
        <div 
          className="px-4 pb-3"
          style={{ borderTop: '1px solid rgba(239, 68, 68, 0.1)' }}
          data-testid="tool-error-details"
        >
          <pre 
            className="text-xs p-2 mt-2 rounded overflow-x-auto"
            style={{ 
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
            }}
          >
            {JSON.stringify(error.details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/**
 * Format tool name for display
 */
function formatToolName(name: string): string {
  return name
    .replace(/^sqlcl_/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Format tool error message for user-friendly display
 * Removes stack traces and internal error codes
 * 
 * Validates: Requirement 10.1 - User-friendly error messages
 */
export function formatToolErrorMessage(message: string): string {
  // Remove stack traces
  let formatted = message.replace(/\n\s+at\s+.+/g, '');
  
  // Remove internal error codes like "ORA-12345:"
  formatted = formatted.replace(/\b(ORA|ERR|INTERNAL)-\d+:\s*/gi, '');
  
  // Remove file paths
  formatted = formatted.replace(/\/[\w/.-]+\.(js|ts|tsx|jsx):\d+:\d+/g, '');
  
  // Remove "Error:" prefix if present
  formatted = formatted.replace(/^Error:\s*/i, '');
  
  // Truncate very long messages
  if (formatted.length > 300) {
    formatted = formatted.substring(0, 297) + '...';
  }
  
  // Ensure first letter is capitalized
  if (formatted.length > 0) {
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }
  
  return formatted.trim() || 'An unexpected error occurred while executing the tool.';
}

/**
 * Compact inline tool error for use within message content
 */
interface InlineToolErrorProps {
  toolName: string;
  errorMessage: string;
}

export function InlineToolError({ toolName, errorMessage }: InlineToolErrorProps) {
  return (
    <span 
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs"
      style={{ 
        background: 'rgba(239, 68, 68, 0.1)',
        color: '#DC2626',
      }}
      data-testid="inline-tool-error"
    >
      <svg 
        className="w-3 h-3 flex-shrink-0" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
        />
      </svg>
      <span className="font-medium">{formatToolName(toolName)}</span>
      <span>failed: {formatToolErrorMessage(errorMessage)}</span>
    </span>
  );
}
