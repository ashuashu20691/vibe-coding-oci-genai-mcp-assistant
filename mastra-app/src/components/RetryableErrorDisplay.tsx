'use client';

import { useState, useCallback } from 'react';
import { ErrorCode, getErrorInfo, AppError } from '@/lib/errors';

/**
 * Recoverable error types that should show retry buttons.
 * Based on the error classification system in src/lib/errors.ts
 * 
 * Validates: Requirement 10.5
 * - IF an error is recoverable, THEN THE Claude_Desktop_UI SHALL provide a retry button
 */
export const RECOVERABLE_ERROR_CODES: ErrorCode[] = [
  ErrorCode.RATE_LIMIT_ERROR,      // Rate limits - retry after cooldown
  ErrorCode.NETWORK_ERROR,         // Network issues - retry may succeed
  ErrorCode.STREAM_ERROR,          // Streaming errors - retry the request
  ErrorCode.STREAM_TIMEOUT,        // Timeouts - retry may succeed
  ErrorCode.MCP_CONNECTION_ERROR,  // MCP connection - retry connection
  ErrorCode.MCP_TOOL_ERROR,        // MCP tool errors - retry execution
  ErrorCode.TOOL_EXECUTION_ERROR,  // Tool execution - retry the tool
  ErrorCode.DB_CONNECTION_ERROR,   // Database connection - retry connection
  ErrorCode.DB_QUERY_ERROR,        // Database query - retry query
  ErrorCode.OCI_AUTH_ERROR,        // Auth errors - retry after config fix
  ErrorCode.UNKNOWN_ERROR,         // Unknown errors - allow retry attempt
];

/**
 * Check if an error code represents a recoverable error.
 */
export function isRecoverableError(code: ErrorCode | string | undefined): boolean {
  if (!code) return false;
  return RECOVERABLE_ERROR_CODES.includes(code as ErrorCode);
}

/**
 * Get the appropriate icon for an error type.
 */
function getErrorIcon(code?: ErrorCode | string): string {
  switch (code) {
    case ErrorCode.RATE_LIMIT_ERROR:
      return '⏳';
    case ErrorCode.NETWORK_ERROR:
      return '🌐';
    case ErrorCode.STREAM_ERROR:
    case ErrorCode.STREAM_TIMEOUT:
      return '⏱️';
    case ErrorCode.MCP_CONNECTION_ERROR:
    case ErrorCode.DB_CONNECTION_ERROR:
      return '🔌';
    case ErrorCode.MCP_TOOL_ERROR:
    case ErrorCode.TOOL_EXECUTION_ERROR:
    case ErrorCode.TOOL_NOT_FOUND:
      return '🔧';
    case ErrorCode.OCI_AUTH_ERROR:
    case ErrorCode.OCI_CONFIG_ERROR:
      return '🔐';
    case ErrorCode.DB_QUERY_ERROR:
      return '💾';
    case ErrorCode.VALIDATION_ERROR:
      return '⚠️';
    default:
      return '❌';
  }
}

/**
 * Get color scheme based on error severity.
 */
function getErrorColors(code?: ErrorCode | string): {
  bg: string;
  border: string;
  text: string;
  buttonBg: string;
  buttonText: string;
} {
  // Rate limit errors use amber/warning colors
  if (code === ErrorCode.RATE_LIMIT_ERROR) {
    return {
      bg: 'rgba(245, 158, 11, 0.05)',
      border: 'rgba(245, 158, 11, 0.2)',
      text: '#B45309',
      buttonBg: '#F59E0B',
      buttonText: 'white',
    };
  }
  
  // Connection errors use blue/info colors
  if (code === ErrorCode.MCP_CONNECTION_ERROR || 
      code === ErrorCode.DB_CONNECTION_ERROR ||
      code === ErrorCode.NETWORK_ERROR) {
    return {
      bg: 'rgba(59, 130, 246, 0.05)',
      border: 'rgba(59, 130, 246, 0.2)',
      text: '#1D4ED8',
      buttonBg: '#3B82F6',
      buttonText: 'white',
    };
  }
  
  // Default to red/error colors
  return {
    bg: 'rgba(239, 68, 68, 0.05)',
    border: 'rgba(239, 68, 68, 0.2)',
    text: '#DC2626',
    buttonBg: '#EF4444',
    buttonText: 'white',
  };
}

export interface RetryableError {
  code?: ErrorCode | string;
  message: string;
  userMessage?: string;
  isRetryable?: boolean;
  details?: Record<string, unknown>;
  retryAfterMs?: number;
}

export interface RetryableErrorDisplayProps {
  /** The error to display */
  error: RetryableError | AppError | string;
  /** Callback when retry button is clicked */
  onRetry?: () => void | Promise<void>;
  /** Callback when dismiss button is clicked */
  onDismiss?: () => void;
  /** Display variant */
  variant?: 'inline' | 'toast' | 'banner' | 'compact';
  /** Additional CSS classes */
  className?: string;
  /** Show expanded details by default */
  defaultExpanded?: boolean;
  /** Custom retry button text */
  retryButtonText?: string;
  /** Whether retry is currently in progress */
  isRetrying?: boolean;
}

/**
 * RetryableErrorDisplay - Generic component for displaying recoverable errors with retry buttons.
 * 
 * Validates: Requirement 10.5
 * - IF an error is recoverable, THEN THE Claude_Desktop_UI SHALL provide a retry button
 * 
 * This component provides consistent retry button handling across all recoverable error types:
 * - Network errors
 * - Timeout errors
 * - Rate limit errors (use RateLimitDisplay for countdown functionality)
 * - MCP connection errors
 * - Tool execution errors
 * - Database connection errors
 */
export function RetryableErrorDisplay({
  error,
  onRetry,
  onDismiss,
  variant = 'inline',
  className = '',
  defaultExpanded = false,
  retryButtonText = 'Retry',
  isRetrying: externalIsRetrying,
}: RetryableErrorDisplayProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [internalIsRetrying, setInternalIsRetrying] = useState(false);
  
  const isRetrying = externalIsRetrying ?? internalIsRetrying;

  // Normalize error to RetryableError
  const normalizedError: RetryableError = typeof error === 'string'
    ? { message: error, isRetryable: true }
    : error instanceof AppError
    ? {
        code: error.code,
        message: error.message,
        userMessage: error.userMessage,
        isRetryable: error.isRetryable,
        details: error.details,
      }
    : error;

  // Determine if error is retryable
  const canRetry = normalizedError.isRetryable !== false && 
    (normalizedError.isRetryable === true || isRecoverableError(normalizedError.code as ErrorCode)) &&
    onRetry !== undefined;

  // Get error info from the error system
  const errorInfo = normalizedError.code 
    ? getErrorInfo(normalizedError.code as ErrorCode) 
    : null;

  const displayMessage = normalizedError.userMessage || normalizedError.message;
  const icon = getErrorIcon(normalizedError.code);
  const colors = getErrorColors(normalizedError.code);

  const handleRetry = useCallback(async () => {
    if (!onRetry || isRetrying) return;
    
    setInternalIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setInternalIsRetrying(false);
    }
  }, [onRetry, isRetrying]);

  // Compact variant - minimal inline display
  if (variant === 'compact') {
    return (
      <div 
        className={`flex items-center gap-2 px-3 py-2 rounded-lg ${className}`}
        style={{ 
          background: colors.bg,
          border: `1px solid ${colors.border}`,
        }}
        role="alert"
        aria-live="polite"
        data-testid="retryable-error-display"
      >
        <span className="text-sm flex-shrink-0">{icon}</span>
        <span 
          className="text-sm flex-1 truncate"
          style={{ color: colors.text }}
          data-testid="retryable-error-message"
        >
          {displayMessage}
        </span>
        {canRetry && (
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="flex-shrink-0 px-2 py-1 text-xs font-medium rounded transition-colors disabled:opacity-50"
            style={{ 
              background: colors.buttonBg,
              color: colors.buttonText,
            }}
            data-testid="retryable-error-retry-button"
          >
            {isRetrying ? 'Retrying...' : retryButtonText}
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 p-1 rounded hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Dismiss"
            data-testid="retryable-error-dismiss"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  // Inline variant - standard error display
  if (variant === 'inline') {
    return (
      <div 
        className={`rounded-xl overflow-hidden ${className}`}
        style={{ 
          background: colors.bg,
          border: `1px solid ${colors.border}`,
        }}
        role="alert"
        aria-live="polite"
        data-testid="retryable-error-display"
      >
        {/* Error Header */}
        <div 
          className="flex items-start gap-3 px-4 py-3"
          style={{ background: `${colors.bg.replace('0.05', '0.08')}` }}
        >
          {/* Error Icon */}
          <div 
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-lg"
            style={{ background: `${colors.border.replace('0.2', '0.15')}` }}
          >
            {icon}
          </div>
          
          {/* Error Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span 
                className="text-sm font-semibold"
                style={{ color: colors.text }}
                data-testid="retryable-error-title"
              >
                {errorInfo?.title || 'Error'}
              </span>
              {normalizedError.code && (
                <span 
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ 
                    background: `${colors.border.replace('0.2', '0.15')}`,
                    color: colors.text,
                  }}
                  data-testid="retryable-error-code"
                >
                  {normalizedError.code}
                </span>
              )}
            </div>
            
            {/* Error Message */}
            <p 
              className="text-sm mt-1"
              style={{ color: 'var(--text-primary)' }}
              data-testid="retryable-error-message"
            >
              {displayMessage}
            </p>
            
            {/* Suggestion if available */}
            {errorInfo?.suggestion && (
              <p 
                className="text-xs mt-2"
                style={{ color: 'var(--text-secondary)' }}
                data-testid="retryable-error-suggestion"
              >
                {errorInfo.suggestion}
              </p>
            )}
          </div>
          
          {/* Dismiss Button */}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="flex-shrink-0 p-1 rounded hover:opacity-70 transition-opacity"
              aria-label="Dismiss error"
              data-testid="retryable-error-dismiss"
            >
              <svg 
                className="w-4 h-4" 
                style={{ color: 'var(--text-muted)' }}
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
          style={{ borderTop: `1px solid ${colors.border.replace('0.2', '0.1')}` }}
        >
          {/* Retry Button */}
          {canRetry && (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors hover:opacity-90 disabled:opacity-50"
              style={{
                background: colors.buttonBg,
                color: colors.buttonText,
              }}
              data-testid="retryable-error-retry-button"
            >
              <svg 
                className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`}
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
              {isRetrying ? 'Retrying...' : retryButtonText}
            </button>
          )}
          
          {/* Show Details Toggle */}
          {normalizedError.details && Object.keys(normalizedError.details).length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md transition-colors"
              style={{ 
                color: 'var(--text-secondary)',
                background: 'transparent',
              }}
              data-testid="retryable-error-toggle-details"
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
          
          {/* Recoverable indicator */}
          {canRetry && (
            <span 
              className="ml-auto text-xs"
              style={{ color: 'var(--text-muted)' }}
              data-testid="retryable-error-recoverable-hint"
            >
              This error may be recoverable
            </span>
          )}
        </div>
        
        {/* Expandable Details */}
        {expanded && normalizedError.details && (
          <div 
            className="px-4 pb-3"
            style={{ borderTop: `1px solid ${colors.border.replace('0.2', '0.1')}` }}
            data-testid="retryable-error-details"
          >
            <pre 
              className="text-xs p-2 mt-2 rounded overflow-x-auto"
              style={{ 
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
              }}
            >
              {JSON.stringify(normalizedError.details, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  }

  // Toast variant - floating notification
  if (variant === 'toast') {
    return (
      <div 
        className={`fixed bottom-4 right-4 max-w-sm p-4 rounded-lg shadow-lg z-50 ${className}`}
        style={{ 
          background: colors.bg.replace('0.05', '1'),
          border: `1px solid ${colors.border}`,
        }}
        role="alert"
        aria-live="polite"
        data-testid="retryable-error-display"
      >
        <div className="flex items-start gap-3">
          <span className="text-xl flex-shrink-0">{icon}</span>
          <div className="flex-1">
            <p 
              className="text-sm font-medium"
              style={{ color: colors.text }}
              data-testid="retryable-error-title"
            >
              {errorInfo?.title || 'Error'}
            </p>
            <p 
              className="text-sm mt-1"
              style={{ color: 'var(--text-primary)' }}
              data-testid="retryable-error-message"
            >
              {displayMessage}
            </p>
            <div className="mt-3 flex gap-2">
              {canRetry && (
                <button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="px-3 py-1.5 text-xs font-medium rounded hover:opacity-90 transition-colors disabled:opacity-50"
                  style={{ 
                    background: colors.buttonBg,
                    color: colors.buttonText,
                  }}
                  data-testid="retryable-error-retry-button"
                >
                  {isRetrying ? 'Retrying...' : retryButtonText}
                </button>
              )}
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="px-3 py-1.5 text-xs hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--text-secondary)' }}
                  data-testid="retryable-error-dismiss"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Banner variant - full-width alert
  return (
    <div 
      className={`w-full p-3 ${className}`}
      style={{ 
        background: colors.bg,
        borderBottom: `1px solid ${colors.border}`,
      }}
      role="alert"
      aria-live="polite"
      data-testid="retryable-error-display"
    >
      <div className="max-w-4xl mx-auto flex items-center gap-4">
        <span className="text-lg flex-shrink-0">{icon}</span>
        <div className="flex-1 flex items-center gap-2">
          <p 
            className="text-sm"
            style={{ color: colors.text }}
          >
            <span className="font-medium" data-testid="retryable-error-title">
              {errorInfo?.title || 'Error'}:
            </span>
            {' '}
            <span data-testid="retryable-error-message">{displayMessage}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canRetry && (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="px-3 py-1.5 text-sm font-medium rounded-md hover:opacity-90 transition-colors disabled:opacity-50"
              style={{ 
                background: colors.buttonBg,
                color: colors.buttonText,
              }}
              data-testid="retryable-error-retry-button"
            >
              {isRetrying ? 'Retrying...' : retryButtonText}
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1.5 hover:opacity-70 transition-opacity"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Dismiss"
              data-testid="retryable-error-dismiss"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
