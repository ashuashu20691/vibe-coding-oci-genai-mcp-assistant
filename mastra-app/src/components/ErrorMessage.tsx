'use client';

/**
 * Error Message Component
 * 
 * Displays user-friendly error messages for various error scenarios.
 * 
 * Validates: Requirements 11.2, 11.3, 11.5
 * - 11.2: User-friendly error messages for file upload failures
 * - 11.3: Connection error message for backend disconnection
 * - 11.5: Timeout message for tool execution timeouts
 */

import { AlertCircle, WifiOff, Clock, Upload, XCircle } from 'lucide-react';

export type ErrorType = 
  | 'file_upload'
  | 'connection'
  | 'timeout'
  | 'generic';

interface ErrorMessageProps {
  type: ErrorType;
  message?: string;
  details?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

const errorConfig = {
  file_upload: {
    icon: Upload,
    title: 'File Upload Failed',
    defaultMessage: 'Unable to upload file. Please check the file size and type.',
    color: 'text-red-500',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
  },
  connection: {
    icon: WifiOff,
    title: 'Connection Error',
    defaultMessage: 'Lost connection to the server. Please check your internet connection.',
    color: 'text-orange-500',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    borderColor: 'border-orange-200 dark:border-orange-800',
  },
  timeout: {
    icon: Clock,
    title: 'Request Timeout',
    defaultMessage: 'The operation took too long to complete. Please try again.',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
  },
  generic: {
    icon: AlertCircle,
    title: 'Error',
    defaultMessage: 'An unexpected error occurred. Please try again.',
    color: 'text-red-500',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
  },
};

export function ErrorMessage({
  type,
  message,
  details,
  onRetry,
  onDismiss,
}: ErrorMessageProps) {
  const config = errorConfig[type];
  const Icon = config.icon;
  const displayMessage = message || config.defaultMessage;

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border ${config.bgColor} ${config.borderColor}`}
      role="alert"
      aria-live="assertive"
    >
      <Icon className={`w-5 h-5 ${config.color} flex-shrink-0 mt-0.5`} aria-hidden="true" />
      
      <div className="flex-1 min-w-0">
        <h3 className={`font-semibold ${config.color} text-sm`}>
          {config.title}
        </h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
          {displayMessage}
        </p>
        {details && (
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 font-mono">
            {details}
          </p>
        )}
        
        {(onRetry || onDismiss) && (
          <div className="flex gap-2 mt-3">
            {onRetry && (
              <button
                onClick={onRetry}
                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                aria-label="Retry operation"
              >
                Try Again
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                aria-label="Dismiss error message"
              >
                Dismiss
              </button>
            )}
          </div>
        )}
      </div>
      
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0"
          aria-label="Close error message"
        >
          <XCircle className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

/**
 * Inline error message for smaller contexts
 */
export function InlineErrorMessage({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
      <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      <span>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="font-medium underline hover:no-underline"
          aria-label="Retry operation"
        >
          Retry
        </button>
      )}
    </div>
  );
}
