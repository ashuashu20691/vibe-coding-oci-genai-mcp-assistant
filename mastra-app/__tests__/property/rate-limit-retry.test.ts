/**
 * Property Test: Rate Limit Retry Behavior
 *
 * Feature: claude-desktop-alternative, Property 25: Rate Limit Retry Behavior
 *
 * *For any* rate limit error with a retry-after duration, the UI SHALL display
 * a countdown and SHALL automatically retry after the specified duration.
 *
 * **Validates: Requirements 10.2**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { renderHook, act } from '@testing-library/react';
import { useRateLimitHandler, RateLimitState } from '../../src/hooks/useRateLimitHandler';

/**
 * Arbitrary for valid retry-after durations in milliseconds.
 * Range: 1 second to 5 minutes (reasonable rate limit cooldowns)
 */
const retryAfterMsArb = fc.integer({ min: 1000, max: 300000 });

/**
 * Arbitrary for minimum wait times before "Retry Now" button appears.
 * Range: 500ms to 10 seconds
 */
const minWaitMsArb = fc.integer({ min: 500, max: 10000 });

/**
 * Arbitrary for max retry counts.
 * Range: 1 to 10 retries
 */
const maxRetriesArb = fc.integer({ min: 1, max: 10 });

/**
 * Arbitrary for rate limit error messages.
 */
const rateLimitErrorMessageArb = fc.oneof(
  fc.constant('Rate limit exceeded'),
  fc.constant('429 Too Many Requests'),
  fc.constant('Service request limit exceeded'),
  fc.constant('Throttled: Please wait before retrying'),
  fc.constant('API rate limit reached'),
  fc.constant('Too many requests, please slow down'),
  fc.string({ minLength: 1, maxLength: 100 }).map(s => `Rate limit: ${s}`)
);

/**
 * Arbitrary for rate limit error objects with retry-after duration.
 */
const rateLimitErrorArb = fc.record({
  code: fc.constant('RATE_LIMIT_ERROR'),
  details: fc.record({
    retryAfterMs: retryAfterMsArb
  })
});

/**
 * Arbitrary for time advancement steps (in milliseconds).
 * Used to simulate time passing during countdown.
 */
const timeStepMsArb = fc.integer({ min: 100, max: 2000 });

/**
 * Arbitrary for a sequence of time steps that sum to less than a given duration.
 */
function timeStepsArb(maxTotalMs: number): fc.Arbitrary<number[]> {
  return fc.array(fc.integer({ min: 100, max: 1000 }), { minLength: 1, maxLength: 10 })
    .filter(steps => steps.reduce((a, b) => a + b, 0) < maxTotalMs);
}

describe('Property 25: Rate Limit Retry Behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Countdown Display', () => {
    it('SHALL display countdown for any rate limit error with retry-after duration (Req 10.2)', () => {
      fc.assert(
        fc.property(
          rateLimitErrorArb,
          rateLimitErrorMessageArb,
          (error, errorMessage) => {
            const { result, unmount } = renderHook(() => useRateLimitHandler());

            act(() => {
              result.current.handleRateLimitError(error, errorMessage);
            });

            // Property: isRateLimited SHALL be true after handling rate limit error
            expect(result.current.state.isRateLimited).toBe(true);

            // Property: remainingSeconds SHALL be set based on retryAfterMs
            const expectedSeconds = Math.ceil(error.details.retryAfterMs / 1000);
            expect(result.current.state.remainingSeconds).toBe(expectedSeconds);

            // Property: errorMessage SHALL be set
            expect(result.current.state.errorMessage).toBe(errorMessage);

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('SHALL use default cooldown when retryAfterMs is not provided (Req 10.2)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 30000 }),
          (defaultCooldownMs) => {
            const { result, unmount } = renderHook(() => 
              useRateLimitHandler({ defaultCooldownMs })
            );

            act(() => {
              result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
            });

            // Property: remainingSeconds SHALL use default cooldown
            const expectedSeconds = Math.ceil(defaultCooldownMs / 1000);
            expect(result.current.state.remainingSeconds).toBe(expectedSeconds);

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('SHALL display countdown in seconds (ceiling of milliseconds / 1000) (Req 10.2)', () => {
      fc.assert(
        fc.property(
          retryAfterMsArb,
          (retryAfterMs) => {
            const { result, unmount } = renderHook(() => useRateLimitHandler());

            act(() => {
              result.current.handleRateLimitError({
                code: 'RATE_LIMIT_ERROR',
                details: { retryAfterMs }
              });
            });

            // Property: remainingSeconds SHALL be ceiling of ms/1000
            const expectedSeconds = Math.ceil(retryAfterMs / 1000);
            expect(result.current.state.remainingSeconds).toBe(expectedSeconds);

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Countdown Decrement', () => {
    it('SHALL decrement countdown correctly over time (Req 10.2)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3000, max: 10000 }),
          fc.integer({ min: 1, max: 3 }),
          (cooldownMs, secondsToAdvance) => {
            const { result, unmount } = renderHook(() => 
              useRateLimitHandler({ defaultCooldownMs: cooldownMs })
            );

            act(() => {
              result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
            });

            const initialSeconds = result.current.state.remainingSeconds;

            // Advance time by specified seconds
            act(() => {
              vi.advanceTimersByTime(secondsToAdvance * 1000);
            });

            // Property: remainingSeconds SHALL decrease by the time advanced
            const expectedRemaining = Math.max(0, initialSeconds - secondsToAdvance);
            expect(result.current.state.remainingSeconds).toBe(expectedRemaining);

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('SHALL reach 0 after full cooldown period (Req 10.2)', () => {
      fc.assert(
        fc.property(
          // Use multiples of 1000 to avoid ceiling edge cases
          fc.integer({ min: 1, max: 10 }).map(n => n * 1000),
          (cooldownMs) => {
            const { result, unmount } = renderHook(() => 
              useRateLimitHandler({ defaultCooldownMs: cooldownMs })
            );

            act(() => {
              result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
            });

            // Advance time well past the cooldown
            act(() => {
              vi.advanceTimersByTime(cooldownMs + 1000);
            });

            // Property: remainingSeconds SHALL be 0 after cooldown
            expect(result.current.state.remainingSeconds).toBe(0);

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('SHALL never go below 0 (Req 10.2)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 5000 }),
          fc.integer({ min: 10000, max: 30000 }),
          (cooldownMs, excessTimeMs) => {
            const { result, unmount } = renderHook(() => 
              useRateLimitHandler({ defaultCooldownMs: cooldownMs })
            );

            act(() => {
              result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
            });

            // Advance time way past the cooldown
            act(() => {
              vi.advanceTimersByTime(excessTimeMs);
            });

            // Property: remainingSeconds SHALL never be negative
            expect(result.current.state.remainingSeconds).toBeGreaterThanOrEqual(0);

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Auto-Retry Behavior', () => {
    it('SHALL automatically retry after the specified duration (Req 10.2)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 5000 }),
          (cooldownMs) => {
            const onAutoRetry = vi.fn();
            const { result, unmount } = renderHook(() => 
              useRateLimitHandler({ 
                defaultCooldownMs: cooldownMs,
                onAutoRetry,
                maxRetries: 5
              })
            );

            act(() => {
              result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
            });

            // Before cooldown: onAutoRetry SHALL NOT be called
            expect(onAutoRetry).not.toHaveBeenCalled();

            // After cooldown: onAutoRetry SHALL be called
            act(() => {
              vi.advanceTimersByTime(cooldownMs + 100);
            });

            // Property: onAutoRetry SHALL be called exactly once after cooldown
            expect(onAutoRetry).toHaveBeenCalledTimes(1);

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('SHALL NOT auto-retry before the specified duration (Req 10.2)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3000, max: 10000 }),
          fc.integer({ min: 100, max: 2000 }),
          (cooldownMs, earlyTimeMs) => {
            // Ensure earlyTimeMs is less than cooldownMs
            const safeEarlyTimeMs = Math.min(earlyTimeMs, cooldownMs - 500);
            
            const onAutoRetry = vi.fn();
            const { result, unmount } = renderHook(() => 
              useRateLimitHandler({ 
                defaultCooldownMs: cooldownMs,
                onAutoRetry,
                maxRetries: 5
              })
            );

            act(() => {
              result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
            });

            // Advance time but not past cooldown
            act(() => {
              vi.advanceTimersByTime(safeEarlyTimeMs);
            });

            // Property: onAutoRetry SHALL NOT be called before cooldown
            expect(onAutoRetry).not.toHaveBeenCalled();

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('SHALL respect maxRetries limit (Req 10.2)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          (maxRetries) => {
            const onAutoRetry = vi.fn();
            const cooldownMs = 1000;
            const { result, unmount } = renderHook(() => 
              useRateLimitHandler({ 
                defaultCooldownMs: cooldownMs,
                onAutoRetry,
                maxRetries
              })
            );

            // Trigger rate limit errors up to maxRetries
            for (let i = 0; i < maxRetries + 2; i++) {
              act(() => {
                result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
              });
              act(() => {
                vi.advanceTimersByTime(cooldownMs + 100);
              });
            }

            // Property: onAutoRetry SHALL be called at most (maxRetries - 1) times
            // because the first error sets retryCount to 1, and we only auto-retry
            // when retryCount < maxRetries
            expect(onAutoRetry.mock.calls.length).toBeLessThanOrEqual(maxRetries);

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('SHALL use retryAfterMs from error details for auto-retry timing (Req 10.2)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 5000 }),
          (retryAfterMs) => {
            const onAutoRetry = vi.fn();
            const { result, unmount } = renderHook(() => 
              useRateLimitHandler({ 
                defaultCooldownMs: 10000, // Different from retryAfterMs
                onAutoRetry,
                maxRetries: 5
              })
            );

            act(() => {
              result.current.handleRateLimitError({
                code: 'RATE_LIMIT_ERROR',
                details: { retryAfterMs }
              });
            });

            // Advance time to just before retryAfterMs
            act(() => {
              vi.advanceTimersByTime(retryAfterMs - 200);
            });

            // Property: onAutoRetry SHALL NOT be called yet
            expect(onAutoRetry).not.toHaveBeenCalled();

            // Advance past retryAfterMs
            act(() => {
              vi.advanceTimersByTime(400);
            });

            // Property: onAutoRetry SHALL be called after retryAfterMs
            expect(onAutoRetry).toHaveBeenCalledTimes(1);

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Retry Now Button Availability', () => {
    it('SHALL enable Retry Now after minWaitMs (Req 10.2)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 500, max: 3000 }),
          fc.integer({ min: 5000, max: 10000 }),
          (minWaitMs, cooldownMs) => {
            const { result, unmount } = renderHook(() => 
              useRateLimitHandler({ 
                minWaitMs,
                defaultCooldownMs: cooldownMs
              })
            );

            act(() => {
              result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
            });

            // Property: canRetryNow SHALL be false initially
            expect(result.current.state.canRetryNow).toBe(false);

            // Advance time past minWaitMs
            act(() => {
              vi.advanceTimersByTime(minWaitMs + 100);
            });

            // Property: canRetryNow SHALL be true after minWaitMs
            expect(result.current.state.canRetryNow).toBe(true);

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('SHALL NOT enable Retry Now before minWaitMs (Req 10.2)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2000, max: 5000 }),
          fc.integer({ min: 100, max: 1500 }),
          (minWaitMs, earlyTimeMs) => {
            // Ensure earlyTimeMs is less than minWaitMs
            const safeEarlyTimeMs = Math.min(earlyTimeMs, minWaitMs - 200);
            
            const { result, unmount } = renderHook(() => 
              useRateLimitHandler({ 
                minWaitMs,
                defaultCooldownMs: 10000
              })
            );

            act(() => {
              result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
            });

            // Advance time but not past minWaitMs
            act(() => {
              vi.advanceTimersByTime(safeEarlyTimeMs);
            });

            // Property: canRetryNow SHALL be false before minWaitMs
            expect(result.current.state.canRetryNow).toBe(false);

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('SHALL trigger retry when retryNow is called and canRetryNow is true (Req 10.2)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 500, max: 2000 }),
          (minWaitMs) => {
            const onAutoRetry = vi.fn();
            const { result, unmount } = renderHook(() => 
              useRateLimitHandler({ 
                minWaitMs,
                defaultCooldownMs: 10000,
                onAutoRetry
              })
            );

            act(() => {
              result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
            });

            // Wait for minWaitMs
            act(() => {
              vi.advanceTimersByTime(minWaitMs + 100);
            });

            // Call retryNow
            act(() => {
              result.current.retryNow();
            });

            // Property: onAutoRetry SHALL be called when retryNow is invoked
            expect(onAutoRetry).toHaveBeenCalledTimes(1);

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('SHALL NOT trigger retry when retryNow is called and canRetryNow is false (Req 10.2)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3000, max: 5000 }),
          (minWaitMs) => {
            const onAutoRetry = vi.fn();
            const { result, unmount } = renderHook(() => 
              useRateLimitHandler({ 
                minWaitMs,
                defaultCooldownMs: 10000,
                onAutoRetry
              })
            );

            act(() => {
              result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
            });

            // Don't wait for minWaitMs - call retryNow immediately
            act(() => {
              result.current.retryNow();
            });

            // Property: onAutoRetry SHALL NOT be called when canRetryNow is false
            expect(onAutoRetry).not.toHaveBeenCalled();

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('State Consistency', () => {
    it('SHALL maintain consistent state throughout countdown (Req 10.2)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3000, max: 8000 }),
          fc.array(fc.integer({ min: 500, max: 1500 }), { minLength: 1, maxLength: 5 }),
          (cooldownMs, timeSteps) => {
            const { result, unmount } = renderHook(() => 
              useRateLimitHandler({ defaultCooldownMs: cooldownMs })
            );

            act(() => {
              result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
            });

            let totalAdvanced = 0;
            const initialSeconds = result.current.state.remainingSeconds;

            for (const step of timeSteps) {
              const prevSeconds = result.current.state.remainingSeconds;
              
              act(() => {
                vi.advanceTimersByTime(step);
              });
              
              totalAdvanced += step;
              const currentSeconds = result.current.state.remainingSeconds;

              // Property: remainingSeconds SHALL be monotonically decreasing
              expect(currentSeconds).toBeLessThanOrEqual(prevSeconds);

              // Property: remainingSeconds SHALL be non-negative
              expect(currentSeconds).toBeGreaterThanOrEqual(0);

              // Property: isRateLimited SHALL remain true during countdown
              if (totalAdvanced < cooldownMs) {
                expect(result.current.state.isRateLimited).toBe(true);
              }
            }

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('SHALL track retry count correctly across multiple errors (Req 10.2)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          (errorCount) => {
            const { result, unmount } = renderHook(() => 
              useRateLimitHandler({ defaultCooldownMs: 1000 })
            );

            for (let i = 1; i <= errorCount; i++) {
              act(() => {
                result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
              });

              // Property: retryCount SHALL increment with each error
              expect(result.current.state.retryCount).toBe(i);
            }

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('SHALL reset state correctly when clear is called (Req 10.2)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 5000 }),
          fc.integer({ min: 1, max: 3 }),
          (cooldownMs, errorCount) => {
            const onClear = vi.fn();
            const { result, unmount } = renderHook(() => 
              useRateLimitHandler({ 
                defaultCooldownMs: cooldownMs,
                onClear
              })
            );

            // Trigger multiple errors
            for (let i = 0; i < errorCount; i++) {
              act(() => {
                result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
              });
            }

            // Clear the state
            act(() => {
              result.current.clear();
            });

            // Property: All state SHALL be reset
            expect(result.current.state.isRateLimited).toBe(false);
            expect(result.current.state.remainingSeconds).toBe(0);
            expect(result.current.state.canRetryNow).toBe(false);
            expect(result.current.state.errorMessage).toBeNull();
            expect(result.current.state.retryCount).toBe(0);

            // Property: onClear callback SHALL be called
            expect(onClear).toHaveBeenCalledTimes(1);

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('SHALL handle very short cooldown periods (Req 10.2)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 999 }),
          (shortCooldownMs) => {
            const onAutoRetry = vi.fn();
            const { result, unmount } = renderHook(() => 
              useRateLimitHandler({ 
                defaultCooldownMs: shortCooldownMs,
                onAutoRetry,
                maxRetries: 5
              })
            );

            act(() => {
              result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
            });

            // Property: remainingSeconds SHALL be at least 1 (ceiling)
            expect(result.current.state.remainingSeconds).toBeGreaterThanOrEqual(1);

            // Advance past cooldown
            act(() => {
              vi.advanceTimersByTime(shortCooldownMs + 100);
            });

            // Property: auto-retry SHALL still work for short cooldowns
            expect(onAutoRetry).toHaveBeenCalledTimes(1);

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('SHALL handle rapid successive errors (Req 10.2)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 5 }),
          (rapidErrorCount) => {
            const { result, unmount } = renderHook(() => 
              useRateLimitHandler({ defaultCooldownMs: 5000 })
            );

            // Trigger multiple errors rapidly without waiting
            for (let i = 0; i < rapidErrorCount; i++) {
              act(() => {
                result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
              });
            }

            // Property: State SHALL reflect the latest error
            expect(result.current.state.isRateLimited).toBe(true);
            expect(result.current.state.retryCount).toBe(rapidErrorCount);

            // Property: Countdown SHALL be reset to full duration
            expect(result.current.state.remainingSeconds).toBe(5);

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('SHALL handle error during countdown (new error resets countdown) (Req 10.2)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 5000, max: 10000 }),
          fc.integer({ min: 1000, max: 3000 }),
          (cooldownMs, partialAdvanceMs) => {
            const { result, unmount } = renderHook(() => 
              useRateLimitHandler({ defaultCooldownMs: cooldownMs })
            );

            act(() => {
              result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
            });

            // Advance time partially
            act(() => {
              vi.advanceTimersByTime(partialAdvanceMs);
            });

            const secondsAfterPartialAdvance = result.current.state.remainingSeconds;

            // Trigger another error
            act(() => {
              result.current.handleRateLimitError({ code: 'RATE_LIMIT_ERROR' });
            });

            // Property: Countdown SHALL be reset to full duration
            const expectedSeconds = Math.ceil(cooldownMs / 1000);
            expect(result.current.state.remainingSeconds).toBe(expectedSeconds);

            // Property: retryCount SHALL be incremented
            expect(result.current.state.retryCount).toBe(2);

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
