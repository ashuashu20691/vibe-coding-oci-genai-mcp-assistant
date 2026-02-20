/**
 * useRetryHandler hook for managing retry state for recoverable errors.
 * 
 * Validates: Requirement 10.5
 * - IF an error is recoverable, THEN THE Claude_Desktop_UI SHALL provide a retry button
 * 
 * This hook provides:
 * - Retry state management
 * - Exponential backoff for automatic retries
 * - Maximum retry limit
 * - Retry callback execution
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { ErrorCode, AppError, classifyError } from '@/lib/errors';
import { RECOVERABLE_ERROR_CODES, isRecoverableError } from '@/components/RetryableErrorDisplay';

export interface RetryState {
  /** Whether an error is currently being displayed */
  hasError: boolean;
  /** The current error */
  error: AppError | null;
  /** Whether a retry is in progress */
  isRetrying: boolean;
  /** Number of retry attempts made */
  retryCount: number;
  /** Whether the maximum retry limit has been reached */
  maxRetriesReached: boolean;
  /** Whether the error is recoverable */
  isRecoverable: boolean;
}

export interface UseRetryHandlerOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay for exponential backoff in ms (default: 1000) */
  baseDelayMs?: number;
  /** Maximum delay for exponential backoff in ms (default: 30000) */
  maxDelayMs?: number;
  /** Callback when retry succeeds */
  onRetrySuccess?: () => void;
  /** Callback when max retries reached */
  onMaxRetriesReached?: (error: AppError) => void;
  /** Callback when error is cleared */
  onClear?: () => void;
}

export interface UseRetryHandlerReturn {
  /** Current retry state */
  state: RetryState;
  /** Handle an error - determines if it's recoverable and stores it */
  handleError: (error: unknown) => AppError;
  /** Execute retry with the provided callback */
  retry: (callback: () => void | Promise<void>) => Promise<boolean>;
  /** Clear the error state */
  clear: () => void;
  /** Check if an error is recoverable */
  isErrorRecoverable: (error: unknown) => boolean;
  /** Get the delay before next retry (for exponential backoff) */
  getNextRetryDelay: () => number;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 30000;

export function useRetryHandler(options: UseRetryHandlerOptions = {}): UseRetryHandlerReturn {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    maxDelayMs = DEFAULT_MAX_DELAY_MS,
    onRetrySuccess,
    onMaxRetriesReached,
    onClear,
  } = options;

  const [state, setState] = useState<RetryState>({
    hasError: false,
    error: null,
    isRetrying: false,
    retryCount: 0,
    maxRetriesReached: false,
    isRecoverable: false,
  });

  const retryCountRef = useRef(0);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Check if an error is recoverable
  const isErrorRecoverable = useCallback((error: unknown): boolean => {
    if (!error) return false;
    
    // If it's already an AppError, check its isRetryable property
    if (error instanceof AppError) {
      return error.isRetryable;
    }
    
    // Classify the error and check
    const appError = classifyError(error);
    return appError.isRetryable;
  }, []);

  // Calculate exponential backoff delay
  const getNextRetryDelay = useCallback((): number => {
    const delay = baseDelayMs * Math.pow(2, retryCountRef.current);
    return Math.min(delay, maxDelayMs);
  }, [baseDelayMs, maxDelayMs]);

  // Handle an error
  const handleError = useCallback((error: unknown): AppError => {
    const appError = error instanceof AppError ? error : classifyError(error);
    const recoverable = appError.isRetryable;
    
    if (isMountedRef.current) {
      setState(prev => ({
        ...prev,
        hasError: true,
        error: appError,
        isRecoverable: recoverable,
        maxRetriesReached: retryCountRef.current >= maxRetries,
      }));
    }
    
    return appError;
  }, [maxRetries]);

  // Execute retry
  const retry = useCallback(async (callback: () => void | Promise<void>): Promise<boolean> => {
    if (retryCountRef.current >= maxRetries) {
      if (state.error && onMaxRetriesReached) {
        onMaxRetriesReached(state.error);
      }
      return false;
    }

    if (isMountedRef.current) {
      setState(prev => ({ ...prev, isRetrying: true }));
    }

    retryCountRef.current += 1;

    try {
      await callback();
      
      // Success - clear the error state
      if (isMountedRef.current) {
        setState({
          hasError: false,
          error: null,
          isRetrying: false,
          retryCount: 0,
          maxRetriesReached: false,
          isRecoverable: false,
        });
        retryCountRef.current = 0;
      }
      
      onRetrySuccess?.();
      return true;
    } catch (error) {
      // Retry failed - update state
      const appError = error instanceof AppError ? error : classifyError(error);
      
      if (isMountedRef.current) {
        setState(prev => ({
          ...prev,
          hasError: true,
          error: appError,
          isRetrying: false,
          retryCount: retryCountRef.current,
          maxRetriesReached: retryCountRef.current >= maxRetries,
          isRecoverable: appError.isRetryable,
        }));
      }
      
      if (retryCountRef.current >= maxRetries && onMaxRetriesReached) {
        onMaxRetriesReached(appError);
      }
      
      return false;
    }
  }, [maxRetries, state.error, onRetrySuccess, onMaxRetriesReached]);

  // Clear error state
  const clear = useCallback(() => {
    retryCountRef.current = 0;
    
    if (isMountedRef.current) {
      setState({
        hasError: false,
        error: null,
        isRetrying: false,
        retryCount: 0,
        maxRetriesReached: false,
        isRecoverable: false,
      });
    }
    
    onClear?.();
  }, [onClear]);

  return {
    state,
    handleError,
    retry,
    clear,
    isErrorRecoverable,
    getNextRetryDelay,
  };
}

/**
 * Helper function to determine if an error should show a retry button.
 * This can be used outside of React components.
 */
export function shouldShowRetryButton(error: unknown): boolean {
  if (!error) return false;
  
  if (error instanceof AppError) {
    return error.isRetryable;
  }
  
  const appError = classifyError(error);
  return appError.isRetryable;
}

/**
 * Helper function to get retry button text based on error type.
 */
export function getRetryButtonText(error: unknown): string {
  if (!error) return 'Retry';
  
  const appError = error instanceof AppError ? error : classifyError(error);
  
  switch (appError.code) {
    case ErrorCode.RATE_LIMIT_ERROR:
      return 'Retry Now';
    case ErrorCode.NETWORK_ERROR:
      return 'Try Again';
    case ErrorCode.MCP_CONNECTION_ERROR:
    case ErrorCode.DB_CONNECTION_ERROR:
      return 'Reconnect';
    case ErrorCode.TOOL_EXECUTION_ERROR:
    case ErrorCode.MCP_TOOL_ERROR:
      return 'Retry Tool';
    default:
      return 'Retry';
  }
}
