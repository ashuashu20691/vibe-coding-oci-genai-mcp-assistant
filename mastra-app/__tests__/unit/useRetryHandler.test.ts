/**
 * Unit tests for useRetryHandler hook.
 * 
 * Validates: Requirement 10.5
 * - IF an error is recoverable, THEN THE Claude_Desktop_UI SHALL provide a retry button
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { 
  useRetryHandler, 
  shouldShowRetryButton, 
  getRetryButtonText 
} from '@/hooks/useRetryHandler';
import { ErrorCode, AppError } from '@/lib/errors';

describe('useRetryHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useRetryHandler());

      expect(result.current.state.hasError).toBe(false);
      expect(result.current.state.error).toBeNull();
      expect(result.current.state.isRetrying).toBe(false);
      expect(result.current.state.retryCount).toBe(0);
      expect(result.current.state.maxRetriesReached).toBe(false);
      expect(result.current.state.isRecoverable).toBe(false);
    });
  });

  describe('handleError', () => {
    it('should set error state when handling an error', () => {
      const { result } = renderHook(() => useRetryHandler());

      act(() => {
        result.current.handleError(new Error('Test error'));
      });

      expect(result.current.state.hasError).toBe(true);
      expect(result.current.state.error).not.toBeNull();
    });

    it('should classify error and determine recoverability', () => {
      const { result } = renderHook(() => useRetryHandler());

      act(() => {
        result.current.handleError(new Error('Network error'));
      });

      expect(result.current.state.isRecoverable).toBe(true);
    });

    it('should handle AppError instances', () => {
      const { result } = renderHook(() => useRetryHandler());
      const appError = new AppError(
        ErrorCode.NETWORK_ERROR,
        'Internal error',
        'User message',
        true
      );

      act(() => {
        result.current.handleError(appError);
      });

      expect(result.current.state.error?.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(result.current.state.isRecoverable).toBe(true);
    });

    it('should return the classified AppError', () => {
      const { result } = renderHook(() => useRetryHandler());

      let returnedError: AppError | undefined;
      act(() => {
        returnedError = result.current.handleError(new Error('Test error'));
      });

      expect(returnedError).toBeInstanceOf(AppError);
    });
  });

  describe('retry', () => {
    it('should execute retry callback', async () => {
      const { result } = renderHook(() => useRetryHandler());
      const callback = vi.fn();

      act(() => {
        result.current.handleError(new Error('Test error'));
      });

      await act(async () => {
        await result.current.retry(callback);
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should set isRetrying to true during retry', async () => {
      vi.useRealTimers(); // Use real timers for this test
      const { result } = renderHook(() => useRetryHandler());
      
      act(() => {
        result.current.handleError(new Error('Test error'));
      });

      // Create a promise that resolves after checking state
      let resolveCallback: () => void;
      const callbackPromise = new Promise<void>(resolve => {
        resolveCallback = resolve;
      });

      // Start retry without awaiting
      const retryPromise = result.current.retry(async () => {
        await callbackPromise;
      });

      // Give React time to update state
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Check isRetrying is true
      expect(result.current.state.isRetrying).toBe(true);

      // Complete the callback
      resolveCallback!();
      
      // Wait for retry to complete
      await retryPromise;
      
      vi.useFakeTimers(); // Restore fake timers
    });

    it('should clear error state on successful retry', async () => {
      const { result } = renderHook(() => useRetryHandler());
      const callback = vi.fn();

      act(() => {
        result.current.handleError(new Error('Test error'));
      });

      await act(async () => {
        await result.current.retry(callback);
      });

      expect(result.current.state.hasError).toBe(false);
      expect(result.current.state.error).toBeNull();
      expect(result.current.state.retryCount).toBe(0);
    });

    it('should increment retry count on failed retry', async () => {
      const { result } = renderHook(() => useRetryHandler());
      const callback = vi.fn(() => {
        throw new Error('Retry failed');
      });

      act(() => {
        result.current.handleError(new Error('Test error'));
      });

      await act(async () => {
        await result.current.retry(callback);
      });

      expect(result.current.state.retryCount).toBe(1);
    });

    it('should return true on successful retry', async () => {
      const { result } = renderHook(() => useRetryHandler());
      const callback = vi.fn();

      act(() => {
        result.current.handleError(new Error('Test error'));
      });

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.retry(callback);
      });

      expect(success).toBe(true);
    });

    it('should return false on failed retry', async () => {
      const { result } = renderHook(() => useRetryHandler());
      const callback = vi.fn(() => {
        throw new Error('Retry failed');
      });

      act(() => {
        result.current.handleError(new Error('Test error'));
      });

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.retry(callback);
      });

      expect(success).toBe(false);
    });

    it('should set maxRetriesReached when max retries exceeded', async () => {
      const { result } = renderHook(() => useRetryHandler({ maxRetries: 2 }));
      const callback = vi.fn(() => {
        throw new Error('Retry failed');
      });

      act(() => {
        result.current.handleError(new Error('Test error'));
      });

      // First retry
      await act(async () => {
        await result.current.retry(callback);
      });

      // Second retry
      await act(async () => {
        await result.current.retry(callback);
      });

      expect(result.current.state.maxRetriesReached).toBe(true);
    });

    it('should not execute callback when max retries reached', async () => {
      const { result } = renderHook(() => useRetryHandler({ maxRetries: 1 }));
      const callback = vi.fn(() => {
        throw new Error('Retry failed');
      });

      act(() => {
        result.current.handleError(new Error('Test error'));
      });

      // First retry (will fail)
      await act(async () => {
        await result.current.retry(callback);
      });

      // Second retry (should not execute)
      await act(async () => {
        await result.current.retry(callback);
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should call onRetrySuccess callback on successful retry', async () => {
      const onRetrySuccess = vi.fn();
      const { result } = renderHook(() => useRetryHandler({ onRetrySuccess }));
      const callback = vi.fn();

      act(() => {
        result.current.handleError(new Error('Test error'));
      });

      await act(async () => {
        await result.current.retry(callback);
      });

      expect(onRetrySuccess).toHaveBeenCalledTimes(1);
    });

    it('should call onMaxRetriesReached callback when max retries exceeded', async () => {
      const onMaxRetriesReached = vi.fn();
      const { result } = renderHook(() => useRetryHandler({ 
        maxRetries: 1, 
        onMaxRetriesReached 
      }));
      const callback = vi.fn(() => {
        throw new Error('Retry failed');
      });

      act(() => {
        result.current.handleError(new Error('Test error'));
      });

      await act(async () => {
        await result.current.retry(callback);
      });

      expect(onMaxRetriesReached).toHaveBeenCalledTimes(1);
    });
  });

  describe('clear', () => {
    it('should reset all state', () => {
      const { result } = renderHook(() => useRetryHandler());

      act(() => {
        result.current.handleError(new Error('Test error'));
      });

      act(() => {
        result.current.clear();
      });

      expect(result.current.state.hasError).toBe(false);
      expect(result.current.state.error).toBeNull();
      expect(result.current.state.isRetrying).toBe(false);
      expect(result.current.state.retryCount).toBe(0);
      expect(result.current.state.maxRetriesReached).toBe(false);
      expect(result.current.state.isRecoverable).toBe(false);
    });

    it('should call onClear callback', () => {
      const onClear = vi.fn();
      const { result } = renderHook(() => useRetryHandler({ onClear }));

      act(() => {
        result.current.handleError(new Error('Test error'));
      });

      act(() => {
        result.current.clear();
      });

      expect(onClear).toHaveBeenCalledTimes(1);
    });

    it('should reset retry count for subsequent retries', async () => {
      const { result } = renderHook(() => useRetryHandler({ maxRetries: 2 }));
      const failingCallback = vi.fn(() => {
        throw new Error('Retry failed');
      });
      const successCallback = vi.fn();

      act(() => {
        result.current.handleError(new Error('Test error'));
      });

      // First retry (fails)
      await act(async () => {
        await result.current.retry(failingCallback);
      });

      // Clear and start fresh
      act(() => {
        result.current.clear();
      });

      act(() => {
        result.current.handleError(new Error('New error'));
      });

      // Should be able to retry again
      await act(async () => {
        await result.current.retry(successCallback);
      });

      expect(successCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('isErrorRecoverable', () => {
    it('should return true for recoverable errors', () => {
      const { result } = renderHook(() => useRetryHandler());

      expect(result.current.isErrorRecoverable(new Error('Network error'))).toBe(true);
    });

    it('should return true for AppError with isRetryable=true', () => {
      const { result } = renderHook(() => useRetryHandler());
      const appError = new AppError(
        ErrorCode.NETWORK_ERROR,
        'Error',
        'User message',
        true
      );

      expect(result.current.isErrorRecoverable(appError)).toBe(true);
    });

    it('should return false for AppError with isRetryable=false', () => {
      const { result } = renderHook(() => useRetryHandler());
      const appError = new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Error',
        'User message',
        false
      );

      expect(result.current.isErrorRecoverable(appError)).toBe(false);
    });

    it('should return false for null/undefined', () => {
      const { result } = renderHook(() => useRetryHandler());

      expect(result.current.isErrorRecoverable(null)).toBe(false);
      expect(result.current.isErrorRecoverable(undefined)).toBe(false);
    });
  });

  describe('getNextRetryDelay', () => {
    it('should return base delay for first retry', () => {
      const { result } = renderHook(() => useRetryHandler({ baseDelayMs: 1000 }));

      expect(result.current.getNextRetryDelay()).toBe(1000);
    });

    it('should increase delay exponentially', async () => {
      const { result } = renderHook(() => useRetryHandler({ 
        baseDelayMs: 1000,
        maxDelayMs: 30000 
      }));
      const callback = vi.fn(() => {
        throw new Error('Retry failed');
      });

      act(() => {
        result.current.handleError(new Error('Test error'));
      });

      // After first retry
      await act(async () => {
        await result.current.retry(callback);
      });

      expect(result.current.getNextRetryDelay()).toBe(2000);

      // After second retry
      await act(async () => {
        await result.current.retry(callback);
      });

      expect(result.current.getNextRetryDelay()).toBe(4000);
    });

    it('should cap delay at maxDelayMs', async () => {
      const { result } = renderHook(() => useRetryHandler({ 
        baseDelayMs: 10000,
        maxDelayMs: 15000,
        maxRetries: 10
      }));
      const callback = vi.fn(() => {
        throw new Error('Retry failed');
      });

      act(() => {
        result.current.handleError(new Error('Test error'));
      });

      // After first retry
      await act(async () => {
        await result.current.retry(callback);
      });

      // Should be capped at maxDelayMs
      expect(result.current.getNextRetryDelay()).toBe(15000);
    });
  });
});

describe('shouldShowRetryButton', () => {
  it('should return true for recoverable errors', () => {
    const error = new Error('Network error');
    expect(shouldShowRetryButton(error)).toBe(true);
  });

  it('should return true for AppError with isRetryable=true', () => {
    const appError = new AppError(
      ErrorCode.NETWORK_ERROR,
      'Error',
      'User message',
      true
    );
    expect(shouldShowRetryButton(appError)).toBe(true);
  });

  it('should return false for AppError with isRetryable=false', () => {
    const appError = new AppError(
      ErrorCode.VALIDATION_ERROR,
      'Error',
      'User message',
      false
    );
    expect(shouldShowRetryButton(appError)).toBe(false);
  });

  it('should return false for null/undefined', () => {
    expect(shouldShowRetryButton(null)).toBe(false);
    expect(shouldShowRetryButton(undefined)).toBe(false);
  });
});

describe('getRetryButtonText', () => {
  it('should return "Retry Now" for rate limit errors', () => {
    const appError = new AppError(
      ErrorCode.RATE_LIMIT_ERROR,
      'Error',
      'User message',
      true
    );
    expect(getRetryButtonText(appError)).toBe('Retry Now');
  });

  it('should return "Try Again" for network errors', () => {
    const appError = new AppError(
      ErrorCode.NETWORK_ERROR,
      'Error',
      'User message',
      true
    );
    expect(getRetryButtonText(appError)).toBe('Try Again');
  });

  it('should return "Reconnect" for connection errors', () => {
    const mcpError = new AppError(
      ErrorCode.MCP_CONNECTION_ERROR,
      'Error',
      'User message',
      true
    );
    expect(getRetryButtonText(mcpError)).toBe('Reconnect');

    const dbError = new AppError(
      ErrorCode.DB_CONNECTION_ERROR,
      'Error',
      'User message',
      true
    );
    expect(getRetryButtonText(dbError)).toBe('Reconnect');
  });

  it('should return "Retry Tool" for tool execution errors', () => {
    const toolError = new AppError(
      ErrorCode.TOOL_EXECUTION_ERROR,
      'Error',
      'User message',
      true
    );
    expect(getRetryButtonText(toolError)).toBe('Retry Tool');

    const mcpToolError = new AppError(
      ErrorCode.MCP_TOOL_ERROR,
      'Error',
      'User message',
      true
    );
    expect(getRetryButtonText(mcpToolError)).toBe('Retry Tool');
  });

  it('should return "Retry" for other errors', () => {
    const unknownError = new AppError(
      ErrorCode.UNKNOWN_ERROR,
      'Error',
      'User message',
      true
    );
    expect(getRetryButtonText(unknownError)).toBe('Retry');
  });

  it('should return "Retry" for null/undefined', () => {
    expect(getRetryButtonText(null)).toBe('Retry');
    expect(getRetryButtonText(undefined)).toBe('Retry');
  });
});
