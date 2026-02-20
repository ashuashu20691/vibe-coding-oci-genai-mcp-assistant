/**
 * Unit tests for Rate Limit Handling
 * Task 13.3: Implement rate limit handling
 * Validates: Requirements 10.2 - Display countdown timer and auto-retry option
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { RateLimitDisplay } from '@/components/RateLimitDisplay';
import { useRateLimitHandler, RateLimitState } from '@/hooks/useRateLimitHandler';

describe('Task 13.3: Rate Limit Handling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('useRateLimitHandler Hook', () => {
    describe('initial state', () => {
      it('should have correct initial state', () => {
        const { result } = renderHook(() => useRateLimitHandler());

        expect(result.current.state.isRateLimited).toBe(false);
        expect(result.current.state.remainingSeconds).toBe(0);
        expect(result.current.state.canRetryNow).toBe(false);
        expect(result.current.state.errorMessage).toBeNull();
        expect(result.current.state.retryCount).toBe(0);
      });
    });

    describe('handleRateLimitError', () => {
      it('should set isRateLimited to true when error is handled', () => {
        const { result } = renderHook(() => useRateLimitHandler());

        act(() => {
          result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
        });

        expect(result.current.state.isRateLimited).toBe(true);
      });

      it('should set error message when provided', () => {
        const { result } = renderHook(() => useRateLimitHandler());

        act(() => {
          result.current.handleRateLimitError(
            { code: 'RATE_LIMIT_ERROR' },
            'Custom error message'
          );
        });

        expect(result.current.state.errorMessage).toBe('Custom error message');
      });

      it('should use default error message when not provided', () => {
        const { result } = renderHook(() => useRateLimitHandler());

        act(() => {
          result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
        });

        expect(result.current.state.errorMessage).toBe('Rate limit exceeded. Please wait before retrying.');
      });

      it('should set remainingSeconds based on retryAfterMs', () => {
        const { result } = renderHook(() => useRateLimitHandler());

        act(() => {
          result.current.handleRateLimitError({
            code: 'RATE_LIMIT_ERROR',
            details: { retryAfterMs: 10000 }
          });
        });

        expect(result.current.state.remainingSeconds).toBe(10);
      });

      it('should use default cooldown when retryAfterMs not provided', () => {
        const { result } = renderHook(() => useRateLimitHandler({
          defaultCooldownMs: 5000
        }));

        act(() => {
          result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
        });

        expect(result.current.state.remainingSeconds).toBe(5);
      });

      it('should increment retryCount on each error', () => {
        const { result } = renderHook(() => useRateLimitHandler());

        act(() => {
          result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
        });
        expect(result.current.state.retryCount).toBe(1);

        act(() => {
          result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
        });
        expect(result.current.state.retryCount).toBe(2);
      });
    });

    describe('countdown timer', () => {
      it('should decrement remainingSeconds over time', () => {
        const { result } = renderHook(() => useRateLimitHandler({
          defaultCooldownMs: 5000
        }));

        act(() => {
          result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
        });

        expect(result.current.state.remainingSeconds).toBe(5);

        act(() => {
          vi.advanceTimersByTime(1000);
        });

        expect(result.current.state.remainingSeconds).toBe(4);

        act(() => {
          vi.advanceTimersByTime(2000);
        });

        expect(result.current.state.remainingSeconds).toBe(2);
      });

      it('should reach 0 after cooldown period', () => {
        const { result } = renderHook(() => useRateLimitHandler({
          defaultCooldownMs: 3000
        }));

        act(() => {
          result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
        });

        act(() => {
          vi.advanceTimersByTime(3500);
        });

        expect(result.current.state.remainingSeconds).toBe(0);
      });
    });

    describe('canRetryNow', () => {
      it('should be false initially', () => {
        const { result } = renderHook(() => useRateLimitHandler({
          minWaitMs: 2000
        }));

        act(() => {
          result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
        });

        expect(result.current.state.canRetryNow).toBe(false);
      });

      it('should become true after minWaitMs', () => {
        const { result } = renderHook(() => useRateLimitHandler({
          minWaitMs: 2000,
          defaultCooldownMs: 5000
        }));

        act(() => {
          result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
        });

        expect(result.current.state.canRetryNow).toBe(false);

        act(() => {
          vi.advanceTimersByTime(2100);
        });

        expect(result.current.state.canRetryNow).toBe(true);
      });
    });

    describe('auto-retry', () => {
      it('should call onAutoRetry after cooldown period', () => {
        const onAutoRetry = vi.fn();
        const { result } = renderHook(() => useRateLimitHandler({
          defaultCooldownMs: 3000,
          onAutoRetry
        }));

        act(() => {
          result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
        });

        expect(onAutoRetry).not.toHaveBeenCalled();

        act(() => {
          vi.advanceTimersByTime(3100);
        });

        expect(onAutoRetry).toHaveBeenCalledTimes(1);
      });

      it('should not auto-retry after maxRetries is reached', () => {
        const onAutoRetry = vi.fn();
        const { result } = renderHook(() => useRateLimitHandler({
          defaultCooldownMs: 1000,
          maxRetries: 3,
          onAutoRetry
        }));

        // First error - retryCount becomes 1, 1 < 3 = true, auto-retry scheduled
        act(() => {
          result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
        });
        act(() => {
          vi.advanceTimersByTime(1100);
        });
        expect(onAutoRetry).toHaveBeenCalledTimes(1);

        // Second error - retryCount becomes 2, 2 < 3 = true, auto-retry scheduled
        act(() => {
          result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
        });
        act(() => {
          vi.advanceTimersByTime(1100);
        });
        expect(onAutoRetry).toHaveBeenCalledTimes(2);

        // Third error - retryCount becomes 3, 3 < 3 = false, no auto-retry
        act(() => {
          result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
        });
        act(() => {
          vi.advanceTimersByTime(1100);
        });
        expect(onAutoRetry).toHaveBeenCalledTimes(2); // Still 2, no more auto-retries
      });
    });

    describe('retryNow', () => {
      it('should call onAutoRetry when canRetryNow is true', () => {
        const onAutoRetry = vi.fn();
        const { result } = renderHook(() => useRateLimitHandler({
          minWaitMs: 1000,
          defaultCooldownMs: 5000,
          onAutoRetry
        }));

        act(() => {
          result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
        });

        // Wait for minWaitMs
        act(() => {
          vi.advanceTimersByTime(1100);
        });

        expect(result.current.state.canRetryNow).toBe(true);

        act(() => {
          result.current.retryNow();
        });

        expect(onAutoRetry).toHaveBeenCalledTimes(1);
      });

      it('should not call onAutoRetry when canRetryNow is false', () => {
        const onAutoRetry = vi.fn();
        const { result } = renderHook(() => useRateLimitHandler({
          minWaitMs: 2000,
          onAutoRetry
        }));

        act(() => {
          result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
        });

        // Don't wait for minWaitMs
        act(() => {
          result.current.retryNow();
        });

        expect(onAutoRetry).not.toHaveBeenCalled();
      });
    });

    describe('clear', () => {
      it('should reset all state', () => {
        const { result } = renderHook(() => useRateLimitHandler());

        act(() => {
          result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
        });

        expect(result.current.state.isRateLimited).toBe(true);

        act(() => {
          result.current.clear();
        });

        expect(result.current.state.isRateLimited).toBe(false);
        expect(result.current.state.remainingSeconds).toBe(0);
        expect(result.current.state.canRetryNow).toBe(false);
        expect(result.current.state.errorMessage).toBeNull();
        expect(result.current.state.retryCount).toBe(0);
      });

      it('should call onClear callback', () => {
        const onClear = vi.fn();
        const { result } = renderHook(() => useRateLimitHandler({ onClear }));

        act(() => {
          result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
        });

        act(() => {
          result.current.clear();
        });

        expect(onClear).toHaveBeenCalledTimes(1);
      });

      it('should stop countdown timer', () => {
        const { result } = renderHook(() => useRateLimitHandler({
          defaultCooldownMs: 5000
        }));

        act(() => {
          result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
        });

        act(() => {
          result.current.clear();
        });

        // Advance time - should not affect state
        act(() => {
          vi.advanceTimersByTime(3000);
        });

        expect(result.current.state.remainingSeconds).toBe(0);
        expect(result.current.state.isRateLimited).toBe(false);
      });
    });

    describe('isRateLimitError', () => {
      it('should return true for RATE_LIMIT_ERROR code', () => {
        const { result } = renderHook(() => useRateLimitHandler());

        expect(result.current.isRateLimitError({ code: 'RATE_LIMIT_ERROR' })).toBe(true);
      });

      it('should return true for error message containing "rate limit"', () => {
        const { result } = renderHook(() => useRateLimitHandler());

        expect(result.current.isRateLimitError(new Error('Rate limit exceeded'))).toBe(true);
        expect(result.current.isRateLimitError(new Error('RATE LIMIT error'))).toBe(true);
      });

      it('should return true for error message containing "429"', () => {
        const { result } = renderHook(() => useRateLimitHandler());

        expect(result.current.isRateLimitError(new Error('Error 429: Too many requests'))).toBe(true);
      });

      it('should return true for error message containing "throttled"', () => {
        const { result } = renderHook(() => useRateLimitHandler());

        expect(result.current.isRateLimitError(new Error('Request throttled'))).toBe(true);
      });

      it('should return true for error message containing "too many requests"', () => {
        const { result } = renderHook(() => useRateLimitHandler());

        expect(result.current.isRateLimitError(new Error('Too many requests'))).toBe(true);
      });

      it('should return true for string error containing rate limit keywords', () => {
        const { result } = renderHook(() => useRateLimitHandler());

        expect(result.current.isRateLimitError('rate limit exceeded')).toBe(true);
        expect(result.current.isRateLimitError('service request limit reached')).toBe(true);
      });

      it('should return false for non-rate-limit errors', () => {
        const { result } = renderHook(() => useRateLimitHandler());

        expect(result.current.isRateLimitError(new Error('Network error'))).toBe(false);
        expect(result.current.isRateLimitError(new Error('Authentication failed'))).toBe(false);
        expect(result.current.isRateLimitError({ code: 'NETWORK_ERROR' })).toBe(false);
      });

      it('should return false for null/undefined', () => {
        const { result } = renderHook(() => useRateLimitHandler());

        expect(result.current.isRateLimitError(null)).toBe(false);
        expect(result.current.isRateLimitError(undefined)).toBe(false);
      });
    });
  });

  describe('RateLimitDisplay Component', () => {
    const defaultState: RateLimitState = {
      isRateLimited: true,
      remainingSeconds: 5,
      canRetryNow: false,
      errorMessage: 'Rate limit exceeded',
      retryCount: 1,
    };

    describe('rendering', () => {
      it('should not render when isRateLimited is false', () => {
        const state: RateLimitState = { ...defaultState, isRateLimited: false };
        const { container } = render(
          <RateLimitDisplay state={state} onRetryNow={() => {}} />
        );

        expect(container.firstChild).toBeNull();
      });

      it('should render when isRateLimited is true', () => {
        render(
          <RateLimitDisplay state={defaultState} onRetryNow={() => {}} />
        );

        expect(screen.getByRole('alert')).toBeTruthy();
      });

      it('should display "Rate Limit Exceeded" title', () => {
        render(
          <RateLimitDisplay state={defaultState} onRetryNow={() => {}} />
        );

        expect(screen.getByText('Rate Limit Exceeded')).toBeTruthy();
      });

      it('should display countdown timer', () => {
        render(
          <RateLimitDisplay state={defaultState} onRetryNow={() => {}} />
        );

        expect(screen.getByText(/Auto-retry in 5 seconds/)).toBeTruthy();
      });

      it('should display "Ready to retry" when countdown reaches 0', () => {
        const state: RateLimitState = { ...defaultState, remainingSeconds: 0 };
        render(
          <RateLimitDisplay state={state} onRetryNow={() => {}} />
        );

        expect(screen.getByText('Ready to retry')).toBeTruthy();
      });
    });

    describe('countdown display', () => {
      it('should show singular "second" for 1 second', () => {
        const state: RateLimitState = { ...defaultState, remainingSeconds: 1 };
        render(
          <RateLimitDisplay state={state} onRetryNow={() => {}} />
        );

        expect(screen.getByText(/Auto-retry in 1 second/)).toBeTruthy();
      });

      it('should show plural "seconds" for multiple seconds', () => {
        const state: RateLimitState = { ...defaultState, remainingSeconds: 3 };
        render(
          <RateLimitDisplay state={state} onRetryNow={() => {}} />
        );

        expect(screen.getByText(/Auto-retry in 3 seconds/)).toBeTruthy();
      });

      it('should format minutes correctly', () => {
        const state: RateLimitState = { ...defaultState, remainingSeconds: 90 };
        render(
          <RateLimitDisplay state={state} onRetryNow={() => {}} />
        );

        expect(screen.getByText(/Auto-retry in 1:30/)).toBeTruthy();
      });
    });

    describe('Retry Now button', () => {
      it('should not show Retry Now button when canRetryNow is false', () => {
        const state: RateLimitState = { ...defaultState, canRetryNow: false };
        render(
          <RateLimitDisplay state={state} onRetryNow={() => {}} />
        );

        expect(screen.queryByText('Retry Now')).toBeNull();
      });

      it('should show Retry Now button when canRetryNow is true', () => {
        const state: RateLimitState = { ...defaultState, canRetryNow: true };
        render(
          <RateLimitDisplay state={state} onRetryNow={() => {}} />
        );

        expect(screen.getByText('Retry Now')).toBeTruthy();
      });

      it('should call onRetryNow when Retry Now button is clicked', () => {
        const onRetryNow = vi.fn();
        const state: RateLimitState = { ...defaultState, canRetryNow: true };
        render(
          <RateLimitDisplay state={state} onRetryNow={onRetryNow} />
        );

        fireEvent.click(screen.getByText('Retry Now'));

        expect(onRetryNow).toHaveBeenCalledTimes(1);
      });
    });

    describe('dismiss button', () => {
      it('should not show dismiss button when onDismiss is not provided', () => {
        render(
          <RateLimitDisplay state={defaultState} onRetryNow={() => {}} />
        );

        expect(screen.queryByLabelText('Dismiss')).toBeNull();
      });

      it('should show dismiss button when onDismiss is provided', () => {
        render(
          <RateLimitDisplay 
            state={defaultState} 
            onRetryNow={() => {}} 
            onDismiss={() => {}}
          />
        );

        expect(screen.getByLabelText('Dismiss')).toBeTruthy();
      });

      it('should call onDismiss when dismiss button is clicked', () => {
        const onDismiss = vi.fn();
        render(
          <RateLimitDisplay 
            state={defaultState} 
            onRetryNow={() => {}} 
            onDismiss={onDismiss}
          />
        );

        fireEvent.click(screen.getByLabelText('Dismiss'));

        expect(onDismiss).toHaveBeenCalledTimes(1);
      });
    });

    describe('retry count display', () => {
      it('should not show retry count for first attempt', () => {
        const state: RateLimitState = { ...defaultState, retryCount: 1 };
        render(
          <RateLimitDisplay state={state} onRetryNow={() => {}} />
        );

        expect(screen.queryByText(/Retry attempt/)).toBeNull();
      });

      it('should show retry count for subsequent attempts', () => {
        const state: RateLimitState = { ...defaultState, retryCount: 2 };
        render(
          <RateLimitDisplay state={state} onRetryNow={() => {}} />
        );

        expect(screen.getByText('Retry attempt 2')).toBeTruthy();
      });
    });

    describe('variants', () => {
      it('should render inline variant by default', () => {
        const { container } = render(
          <RateLimitDisplay state={defaultState} onRetryNow={() => {}} />
        );

        expect(container.querySelector('.rounded-lg')).toBeTruthy();
        expect(container.querySelector('.fixed')).toBeNull();
      });

      it('should render toast variant when specified', () => {
        const { container } = render(
          <RateLimitDisplay 
            state={defaultState} 
            onRetryNow={() => {}} 
            variant="toast"
          />
        );

        expect(container.querySelector('.fixed')).toBeTruthy();
      });

      it('should render banner variant when specified', () => {
        const { container } = render(
          <RateLimitDisplay 
            state={defaultState} 
            onRetryNow={() => {}} 
            variant="banner"
          />
        );

        expect(container.querySelector('.w-full')).toBeTruthy();
        expect(container.querySelector('.border-b')).toBeTruthy();
      });
    });

    describe('accessibility', () => {
      it('should have role="alert"', () => {
        render(
          <RateLimitDisplay state={defaultState} onRetryNow={() => {}} />
        );

        expect(screen.getByRole('alert')).toBeTruthy();
      });

      it('should have aria-live="polite"', () => {
        render(
          <RateLimitDisplay state={defaultState} onRetryNow={() => {}} />
        );

        const alert = screen.getByRole('alert');
        expect(alert.getAttribute('aria-live')).toBe('polite');
      });
    });

    describe('countdown circle', () => {
      it('should display remaining seconds in circle', () => {
        const state: RateLimitState = { ...defaultState, remainingSeconds: 7 };
        render(
          <RateLimitDisplay state={state} onRetryNow={() => {}} />
        );

        // The countdown number should be visible
        expect(screen.getByText('7')).toBeTruthy();
      });
    });
  });
});
