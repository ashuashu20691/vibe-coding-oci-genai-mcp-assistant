'use client';

import { useState } from 'react';

/**
 * Error codes matching the backend error codes.
 */
export type ErrorCode =
  | 'OCI_AUTH_ERROR'
  | 'OCI_CONFIG_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'MCP_CONNECTION_ERROR'
  | 'MCP_TOOL_ERROR'
  | 'TOOL_EXECUTION_ERROR'
  | 'TOOL_NOT_FOUND'
  | 'STREAM_ERROR'
  | 'STREAM_TIMEOUT'
  | 'DB_CONNECTION_ERROR'
  | 'DB_QUERY_ERROR'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export interface ErrorInfo {
  error: string;
  code?: ErrorCode;
  userMessage?: string;
  isRetryable?: boolean;
}

interface ErrorDisplayProps {
  error: ErrorInfo | string;
  onRetry?: () => void;
  onDismiss?: () => void;
  variant?: 'inline' | 'toast' | 'banner';
  className?: string;
}

/**
 * Get icon for error type.
 */
function getErrorIcon(code?: ErrorCode): string {
  switch (code) {
    case 'OCI_AUTH_ERROR':
    case 'OCI_CONFIG_ERROR':
      return '🔐';
    case 'RATE_LIMIT_ERROR':
      return '⏳';
    case 'MCP_CONNECTION_ERROR':
    case 'DB_CONNECTION_ERROR':
      return '🔌';
    case 'NETWORK_ERROR':
      return '🌐';
    case 'STREAM_ERROR':
    case 'STREAM_TIMEOUT':
      return '⏱️';
    case 'TOOL_EXECUTION_ERROR':
    case 'TOOL_NOT_FOUND':
    case 'MCP_TOOL_ERROR':
      return '🔧';
    case 'DB_QUERY_ERROR':
      return '💾';
    case 'VALIDATION_ERROR':
      return '⚠️';
    default:
      return '❌';
  }
}

/**
 * ErrorDisplay component for showing user-friendly error messages.
 * Supports retry functionality for recoverable errors.
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */
export function ErrorDisplay({
  error,
  onRetry,
  onDismiss,
  variant = 'inline',
  className = '',
}: ErrorDisplayProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  // Normalize error to ErrorInfo
  const errorInfo: ErrorInfo = typeof error === 'string' 
    ? { error, userMessage: error }
    : error;

  const displayMessage = errorInfo.userMessage || errorInfo.error;
  const icon = getErrorIcon(errorInfo.code);
  const canRetry = errorInfo.isRetryable && onRetry;

  const handleRetry = async () => {
    if (!onRetry) return;
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  // Inline variant - compact error display
  if (variant === 'inline') {
    return (
      <div className={`flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg ${className}`}>
        <span className="text-lg flex-shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-red-700 dark:text-red-300">{displayMessage}</p>
          {canRetry && (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="mt-2 text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 underline disabled:opacity-50"
            >
              {isRetrying ? 'Retrying...' : 'Try again'}
            </button>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-red-400 hover:text-red-600 dark:hover:text-red-200"
            aria-label="Dismiss"
          >
            ✕
          </button>
        )}
      </div>
    );
  }

  // Toast variant - floating notification
  if (variant === 'toast') {
    return (
      <div className={`fixed bottom-4 right-4 max-w-sm p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg shadow-lg z-50 ${className}`}>
        <div className="flex items-start gap-3">
          <span className="text-xl">{icon}</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              {displayMessage}
            </p>
            <div className="mt-2 flex gap-2">
              {canRetry && (
                <button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="text-xs px-2 py-1 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 rounded hover:bg-red-200 dark:hover:bg-red-700 disabled:opacity-50"
                >
                  {isRetrying ? 'Retrying...' : 'Retry'}
                </button>
              )}
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="text-xs px-2 py-1 text-red-600 dark:text-red-300 hover:text-red-800 dark:hover:text-red-100"
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
    <div className={`w-full p-4 bg-red-50 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800 ${className}`}>
      <div className="max-w-4xl mx-auto flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <p className="flex-1 text-sm text-red-700 dark:text-red-300">{displayMessage}</p>
        <div className="flex gap-2">
          {canRetry && (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="text-sm px-3 py-1 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 rounded hover:bg-red-200 dark:hover:bg-red-700 disabled:opacity-50"
            >
              {isRetrying ? 'Retrying...' : 'Retry'}
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-red-400 hover:text-red-600 dark:hover:text-red-200 p-1"
              aria-label="Dismiss"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Hook for managing error state with auto-dismiss.
 */
export function useErrorState(autoDismissMs?: number) {
  const [error, setError] = useState<ErrorInfo | null>(null);

  const showError = (err: ErrorInfo | string) => {
    const errorInfo: ErrorInfo = typeof err === 'string' 
      ? { error: err, userMessage: err }
      : err;
    setError(errorInfo);

    if (autoDismissMs && !errorInfo.isRetryable) {
      setTimeout(() => setError(null), autoDismissMs);
    }
  };

  const clearError = () => setError(null);

  return { error, showError, clearError };
}
