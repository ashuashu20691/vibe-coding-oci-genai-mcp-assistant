/**
 * useRateLimitHandler hook for managing rate limit errors with countdown and auto-retry.
 * 
 * Requirements: 10.2
 * - Display countdown timer on rate limit
 * - Implement auto-retry after cooldown
 * - Show "Retry Now" button after minimum wait time
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { ErrorCode } from '@/lib/errors';

export interface RateLimitState {
  /** Whether a rate limit is currently active */
  isRateLimited: boolean;
  /** Remaining seconds until auto-retry */
  remainingSeconds: number;
  /** Whether the minimum wait time has passed (can retry now) */
  canRetryNow: boolean;
  /** The original error message */
  errorMessage: string | null;
  /** Number of retry attempts made */
  retryCount: number;
}

export interface UseRateLimitHandlerOptions {
  /** Default cooldown duration in milliseconds (default: 5000ms) */
  defaultCooldownMs?: number;
  /** Minimum wait time before "Retry Now" button appears (default: 2000ms) */
  minWaitMs?: number;
  /** Maximum number of auto-retries (default: 3) */
  maxRetries?: number;
  /** Callback when auto-retry is triggered */
  onAutoRetry?: () => void | Promise<void>;
  /** Callback when rate limit is cleared */
  onClear?: () => void;
}

export interface UseRateLimitHandlerReturn {
  /** Current rate limit state */
  state: RateLimitState;
  /** Handle a rate limit error - starts countdown */
  handleRateLimitError: (error: { code?: ErrorCode | string; details?: { retryAfterMs?: number } }, errorMessage?: string) => void;
  /** Manually trigger retry (for "Retry Now" button) */
  retryNow: () => void;
  /** Clear the rate limit state */
  clear: () => void;
  /** Check if an error is a rate limit error */
  isRateLimitError: (error: unknown) => boolean;
}

const DEFAULT_COOLDOWN_MS = 5000;
const DEFAULT_MIN_WAIT_MS = 2000;
const DEFAULT_MAX_RETRIES = 3;

export function useRateLimitHandler(options: UseRateLimitHandlerOptions = {}): UseRateLimitHandlerReturn {
  const {
    defaultCooldownMs = DEFAULT_COOLDOWN_MS,
    minWaitMs = DEFAULT_MIN_WAIT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    onAutoRetry,
    onClear,
  } = options;

  const [state, setState] = useState<RateLimitState>({
    isRateLimited: false,
    remainingSeconds: 0,
    canRetryNow: false,
    errorMessage: null,
    retryCount: 0,
  });

  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const minWaitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const cooldownMsRef = useRef<number>(0);

  // Cleanup function
  const clearTimers = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (autoRetryTimeoutRef.current) {
      clearTimeout(autoRetryTimeoutRef.current);
      autoRetryTimeoutRef.current = null;
    }
    if (minWaitTimeoutRef.current) {
      clearTimeout(minWaitTimeoutRef.current);
      minWaitTimeoutRef.current = null;
    }
  }, []);

  // Clear rate limit state
  const clear = useCallback(() => {
    clearTimers();
    retryCountRef.current = 0;
    setState({
      isRateLimited: false,
      remainingSeconds: 0,
      canRetryNow: false,
      errorMessage: null,
      retryCount: 0,
    });
    onClear?.();
  }, [clearTimers, onClear]);

  // Execute retry
  const executeRetry = useCallback(async () => {
    clearTimers();
    
    if (onAutoRetry) {
      try {
        await onAutoRetry();
        // If retry succeeds, clear the state
        setState(prev => ({
          ...prev,
          isRateLimited: false,
          remainingSeconds: 0,
          canRetryNow: false,
          errorMessage: null,
        }));
      } catch {
        // If retry fails, the error handler will be called again
        // which will restart the countdown
      }
    }
  }, [clearTimers, onAutoRetry]);

  // Manual retry (for "Retry Now" button)
  const retryNow = useCallback(() => {
    if (state.canRetryNow) {
      executeRetry();
    }
  }, [state.canRetryNow, executeRetry]);

  // Track retry count in a ref for synchronous access
  const retryCountRef = useRef<number>(0);

  // Handle rate limit error
  const handleRateLimitError = useCallback((
    error: { code?: ErrorCode | string; details?: { retryAfterMs?: number } },
    errorMessage?: string
  ) => {
    // Clear any existing timers
    clearTimers();

    // Get cooldown duration from error details or use default
    const cooldownMs = error.details?.retryAfterMs || defaultCooldownMs;
    cooldownMsRef.current = cooldownMs;
    startTimeRef.current = Date.now();

    // Increment retry count
    retryCountRef.current += 1;
    const newRetryCount = retryCountRef.current;

    // Update state
    setState({
      isRateLimited: true,
      remainingSeconds: Math.ceil(cooldownMs / 1000),
      canRetryNow: false,
      errorMessage: errorMessage || 'Rate limit exceeded. Please wait before retrying.',
      retryCount: newRetryCount,
    });

    // Start countdown interval (updates every second)
    countdownIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, cooldownMsRef.current - elapsed);
      const remainingSeconds = Math.ceil(remaining / 1000);

      setState(prev => ({
        ...prev,
        remainingSeconds,
      }));

      if (remainingSeconds <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }
    }, 100); // Update frequently for smooth countdown

    // Set timeout for "Retry Now" button to appear
    minWaitTimeoutRef.current = setTimeout(() => {
      setState(prev => ({
        ...prev,
        canRetryNow: true,
      }));
    }, minWaitMs);

    // Set timeout for auto-retry (only if under max retries)
    if (newRetryCount < maxRetries) {
      autoRetryTimeoutRef.current = setTimeout(() => {
        executeRetry();
      }, cooldownMs);
    }
  }, [clearTimers, defaultCooldownMs, minWaitMs, maxRetries, executeRetry]);

  // Check if an error is a rate limit error
  const isRateLimitError = useCallback((error: unknown): boolean => {
    if (!error) return false;
    
    // Check for ErrorCode
    if (typeof error === 'object' && 'code' in error) {
      return (error as { code: string }).code === 'RATE_LIMIT_ERROR';
    }
    
    // Check error message
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('rate limit') ||
        message.includes('throttled') ||
        message.includes('429') ||
        message.includes('too many requests') ||
        message.includes('service request limit')
      );
    }
    
    // Check string error
    if (typeof error === 'string') {
      const message = error.toLowerCase();
      return (
        message.includes('rate limit') ||
        message.includes('throttled') ||
        message.includes('429') ||
        message.includes('too many requests') ||
        message.includes('service request limit')
      );
    }
    
    return false;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  return {
    state,
    handleRateLimitError,
    retryNow,
    clear,
    isRateLimitError,
  };
}
