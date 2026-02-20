'use client';

/**
 * RateLimitDisplay component for showing rate limit countdown and retry options.
 * 
 * Requirements: 10.2
 * - Display countdown timer on rate limit
 * - Show auto-retry status
 * - Provide "Retry Now" button after minimum wait time
 */

import { RateLimitState } from '@/hooks/useRateLimitHandler';

export interface RateLimitDisplayProps {
  /** Rate limit state from useRateLimitHandler */
  state: RateLimitState;
  /** Callback for "Retry Now" button */
  onRetryNow: () => void;
  /** Callback to dismiss/clear the rate limit display */
  onDismiss?: () => void;
  /** Display variant */
  variant?: 'inline' | 'toast' | 'banner';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Format seconds into a human-readable countdown string.
 */
function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'Ready to retry';
  if (seconds === 1) return '1 second';
  if (seconds < 60) return `${seconds} seconds`;
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (remainingSeconds === 0) {
    return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  }
  
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Circular progress indicator for countdown.
 */
function CountdownCircle({ 
  remainingSeconds, 
  totalSeconds 
}: { 
  remainingSeconds: number; 
  totalSeconds: number;
}) {
  const progress = totalSeconds > 0 ? (remainingSeconds / totalSeconds) : 0;
  const circumference = 2 * Math.PI * 18; // radius = 18
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="relative w-12 h-12 flex-shrink-0">
      <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 40 40">
        {/* Background circle */}
        <circle
          cx="20"
          cy="20"
          r="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-amber-200 dark:text-amber-900"
        />
        {/* Progress circle */}
        <circle
          cx="20"
          cy="20"
          r="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="text-amber-500 dark:text-amber-400 transition-all duration-100"
        />
      </svg>
      {/* Countdown number */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
          {remainingSeconds}
        </span>
      </div>
    </div>
  );
}

export function RateLimitDisplay({
  state,
  onRetryNow,
  onDismiss,
  variant = 'inline',
  className = '',
}: RateLimitDisplayProps) {
  if (!state.isRateLimited) {
    return null;
  }

  const { remainingSeconds, canRetryNow, errorMessage, retryCount } = state;
  
  // Estimate total seconds for progress calculation (use 5 as default)
  const estimatedTotalSeconds = Math.max(remainingSeconds, 5);

  // Inline variant - compact display within chat
  if (variant === 'inline') {
    return (
      <div 
        className={`flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg ${className}`}
        role="alert"
        aria-live="polite"
      >
        <CountdownCircle 
          remainingSeconds={remainingSeconds} 
          totalSeconds={estimatedTotalSeconds} 
        />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">⏳</span>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Rate Limit Exceeded
            </p>
          </div>
          
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
            {remainingSeconds > 0 
              ? `Auto-retry in ${formatCountdown(remainingSeconds)}`
              : 'Ready to retry'
            }
          </p>
          
          {retryCount > 1 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Retry attempt {retryCount}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {canRetryNow && (
            <button
              onClick={onRetryNow}
              className="retry-btn px-3 py-1.5 text-sm font-medium bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-200 rounded-md hover:bg-amber-200 dark:hover:bg-amber-700 transition-colors"
            >
              Retry Now
            </button>
          )}
          
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="dismiss-btn p-1 text-amber-400 hover:text-amber-600 dark:hover:text-amber-200 transition-colors"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Toast variant - floating notification
  if (variant === 'toast') {
    return (
      <div 
        className={`fixed bottom-4 right-4 max-w-sm p-4 bg-amber-50 dark:bg-amber-900 border border-amber-200 dark:border-amber-700 rounded-lg shadow-lg z-50 ${className}`}
        role="alert"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <CountdownCircle 
            remainingSeconds={remainingSeconds} 
            totalSeconds={estimatedTotalSeconds} 
          />
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">⏳</span>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Rate Limit Exceeded
              </p>
            </div>
            
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              {remainingSeconds > 0 
                ? `Auto-retry in ${formatCountdown(remainingSeconds)}`
                : 'Ready to retry'
              }
            </p>
            
            <div className="mt-3 flex gap-2">
              {canRetryNow && (
                <button
                  onClick={onRetryNow}
                  className="retry-btn px-3 py-1.5 text-xs font-medium bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-200 rounded hover:bg-amber-200 dark:hover:bg-amber-700 transition-colors"
                >
                  Retry Now
                </button>
              )}
              
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="dismiss-btn px-3 py-1.5 text-xs text-amber-600 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-100 transition-colors"
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

  // Banner variant - full-width alert at top
  return (
    <div 
      className={`w-full p-3 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="max-w-4xl mx-auto flex items-center gap-4">
        <CountdownCircle 
          remainingSeconds={remainingSeconds} 
          totalSeconds={estimatedTotalSeconds} 
        />
        
        <div className="flex-1 flex items-center gap-2">
          <span className="text-lg">⏳</span>
          <p className="text-sm text-amber-700 dark:text-amber-300">
            <span className="font-medium">Rate limit exceeded.</span>
            {' '}
            {remainingSeconds > 0 
              ? `Auto-retry in ${formatCountdown(remainingSeconds)}`
              : 'Ready to retry'
            }
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {canRetryNow && (
            <button
              onClick={onRetryNow}
              className="retry-btn px-3 py-1.5 text-sm font-medium bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-200 rounded-md hover:bg-amber-200 dark:hover:bg-amber-700 transition-colors"
            >
              Retry Now
            </button>
          )}
          
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="dismiss-btn p-1.5 text-amber-400 hover:text-amber-600 dark:hover:text-amber-200 transition-colors"
              aria-label="Dismiss"
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
