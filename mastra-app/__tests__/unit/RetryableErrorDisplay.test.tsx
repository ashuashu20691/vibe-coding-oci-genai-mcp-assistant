/**
 * Unit tests for RetryableErrorDisplay component.
 * 
 * Validates: Requirement 10.5
 * - IF an error is recoverable, THEN THE Claude_Desktop_UI SHALL provide a retry button
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { 
  RetryableErrorDisplay, 
  isRecoverableError, 
  RECOVERABLE_ERROR_CODES,
  RetryableError 
} from '@/components/RetryableErrorDisplay';
import { ErrorCode, AppError } from '@/lib/errors';

describe('RetryableErrorDisplay', () => {
  describe('Rendering', () => {
    it('should render error message', () => {
      const error: RetryableError = {
        message: 'Network connection failed',
        code: ErrorCode.NETWORK_ERROR,
        isRetryable: true,
      };
      
      render(<RetryableErrorDisplay error={error} />);
      
      expect(screen.getByTestId('retryable-error-message')).toBeDefined();
      expect(screen.getByText(/Network connection failed/)).toBeDefined();
    });

    it('should render error title from error info', () => {
      const error: RetryableError = {
        message: 'Connection failed',
        code: ErrorCode.NETWORK_ERROR,
        isRetryable: true,
      };
      
      render(<RetryableErrorDisplay error={error} />);
      
      expect(screen.getByTestId('retryable-error-title')).toBeDefined();
      expect(screen.getByText('Network Error')).toBeDefined();
    });

    it('should render error code badge', () => {
      const error: RetryableError = {
        message: 'Test error',
        code: ErrorCode.NETWORK_ERROR,
        isRetryable: true,
      };
      
      render(<RetryableErrorDisplay error={error} />);
      
      expect(screen.getByTestId('retryable-error-code')).toBeDefined();
      expect(screen.getByText('NETWORK_ERROR')).toBeDefined();
    });

    it('should render suggestion when available', () => {
      const error: RetryableError = {
        message: 'Test error',
        code: ErrorCode.NETWORK_ERROR,
        isRetryable: true,
      };
      
      render(<RetryableErrorDisplay error={error} />);
      
      expect(screen.getByTestId('retryable-error-suggestion')).toBeDefined();
    });

    it('should handle string error', () => {
      render(<RetryableErrorDisplay error="Simple error message" />);
      
      expect(screen.getByText('Simple error message')).toBeDefined();
    });

    it('should handle AppError instance', () => {
      const appError = new AppError(
        ErrorCode.NETWORK_ERROR,
        'Internal error',
        'User-friendly message',
        true
      );
      
      render(<RetryableErrorDisplay error={appError} />);
      
      expect(screen.getByText('User-friendly message')).toBeDefined();
    });
  });

  describe('Retry Button', () => {
    it('should show retry button when error is retryable and onRetry is provided', () => {
      const error: RetryableError = {
        message: 'Test error',
        code: ErrorCode.NETWORK_ERROR,
        isRetryable: true,
      };
      const onRetry = vi.fn();
      
      render(<RetryableErrorDisplay error={error} onRetry={onRetry} />);
      
      expect(screen.getByTestId('retryable-error-retry-button')).toBeDefined();
    });

    it('should not show retry button when error is not retryable', () => {
      const error: RetryableError = {
        message: 'Test error',
        code: ErrorCode.VALIDATION_ERROR,
        isRetryable: false,
      };
      const onRetry = vi.fn();
      
      render(<RetryableErrorDisplay error={error} onRetry={onRetry} />);
      
      expect(screen.queryByTestId('retryable-error-retry-button')).toBeNull();
    });

    it('should not show retry button when onRetry is not provided', () => {
      const error: RetryableError = {
        message: 'Test error',
        code: ErrorCode.NETWORK_ERROR,
        isRetryable: true,
      };
      
      render(<RetryableErrorDisplay error={error} />);
      
      expect(screen.queryByTestId('retryable-error-retry-button')).toBeNull();
    });

    it('should call onRetry when retry button is clicked', async () => {
      const error: RetryableError = {
        message: 'Test error',
        code: ErrorCode.NETWORK_ERROR,
        isRetryable: true,
      };
      const onRetry = vi.fn();
      
      render(<RetryableErrorDisplay error={error} onRetry={onRetry} />);
      
      fireEvent.click(screen.getByTestId('retryable-error-retry-button'));
      
      await waitFor(() => {
        expect(onRetry).toHaveBeenCalledTimes(1);
      });
    });

    it('should show "Retrying..." text while retry is in progress', async () => {
      const error: RetryableError = {
        message: 'Test error',
        code: ErrorCode.NETWORK_ERROR,
        isRetryable: true,
      };
      const onRetry = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      render(<RetryableErrorDisplay error={error} onRetry={onRetry} />);
      
      fireEvent.click(screen.getByTestId('retryable-error-retry-button'));
      
      expect(screen.getByText('Retrying...')).toBeDefined();
    });

    it('should use custom retry button text', () => {
      const error: RetryableError = {
        message: 'Test error',
        code: ErrorCode.NETWORK_ERROR,
        isRetryable: true,
      };
      const onRetry = vi.fn();
      
      render(
        <RetryableErrorDisplay 
          error={error} 
          onRetry={onRetry} 
          retryButtonText="Try Again" 
        />
      );
      
      expect(screen.getByText('Try Again')).toBeDefined();
    });

    it('should disable retry button when isRetrying is true', () => {
      const error: RetryableError = {
        message: 'Test error',
        code: ErrorCode.NETWORK_ERROR,
        isRetryable: true,
      };
      const onRetry = vi.fn();
      
      render(
        <RetryableErrorDisplay 
          error={error} 
          onRetry={onRetry} 
          isRetrying={true} 
        />
      );
      
      const button = screen.getByTestId('retryable-error-retry-button');
      expect(button.hasAttribute('disabled')).toBe(true);
    });
  });

  describe('Dismiss Button', () => {
    it('should show dismiss button when onDismiss is provided', () => {
      const error: RetryableError = {
        message: 'Test error',
        isRetryable: true,
      };
      const onDismiss = vi.fn();
      
      render(<RetryableErrorDisplay error={error} onDismiss={onDismiss} />);
      
      expect(screen.getByTestId('retryable-error-dismiss')).toBeDefined();
    });

    it('should call onDismiss when dismiss button is clicked', () => {
      const error: RetryableError = {
        message: 'Test error',
        isRetryable: true,
      };
      const onDismiss = vi.fn();
      
      render(<RetryableErrorDisplay error={error} onDismiss={onDismiss} />);
      
      fireEvent.click(screen.getByTestId('retryable-error-dismiss'));
      
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('Details Toggle', () => {
    it('should show details toggle when error has details', () => {
      const error: RetryableError = {
        message: 'Test error',
        isRetryable: true,
        details: { key: 'value' },
      };
      
      render(<RetryableErrorDisplay error={error} />);
      
      expect(screen.getByTestId('retryable-error-toggle-details')).toBeDefined();
    });

    it('should not show details toggle when error has no details', () => {
      const error: RetryableError = {
        message: 'Test error',
        isRetryable: true,
      };
      
      render(<RetryableErrorDisplay error={error} />);
      
      expect(screen.queryByTestId('retryable-error-toggle-details')).toBeNull();
    });

    it('should show details when toggle is clicked', () => {
      const error: RetryableError = {
        message: 'Test error',
        isRetryable: true,
        details: { key: 'value' },
      };
      
      render(<RetryableErrorDisplay error={error} />);
      
      fireEvent.click(screen.getByTestId('retryable-error-toggle-details'));
      
      expect(screen.getByTestId('retryable-error-details')).toBeDefined();
    });

    it('should show details by default when defaultExpanded is true', () => {
      const error: RetryableError = {
        message: 'Test error',
        isRetryable: true,
        details: { key: 'value' },
      };
      
      render(<RetryableErrorDisplay error={error} defaultExpanded={true} />);
      
      expect(screen.getByTestId('retryable-error-details')).toBeDefined();
    });
  });

  describe('Variants', () => {
    it('should render inline variant by default', () => {
      const error: RetryableError = {
        message: 'Test error',
        isRetryable: true,
      };
      
      render(<RetryableErrorDisplay error={error} />);
      
      const display = screen.getByTestId('retryable-error-display');
      expect(display.className).toContain('rounded-xl');
    });

    it('should render compact variant', () => {
      const error: RetryableError = {
        message: 'Test error',
        isRetryable: true,
      };
      const onRetry = vi.fn();
      
      render(<RetryableErrorDisplay error={error} variant="compact" onRetry={onRetry} />);
      
      const display = screen.getByTestId('retryable-error-display');
      expect(display.className).toContain('rounded-lg');
    });

    it('should render toast variant', () => {
      const error: RetryableError = {
        message: 'Test error',
        isRetryable: true,
      };
      
      render(<RetryableErrorDisplay error={error} variant="toast" />);
      
      const display = screen.getByTestId('retryable-error-display');
      expect(display.className).toContain('fixed');
    });

    it('should render banner variant', () => {
      const error: RetryableError = {
        message: 'Test error',
        isRetryable: true,
      };
      
      render(<RetryableErrorDisplay error={error} variant="banner" />);
      
      const display = screen.getByTestId('retryable-error-display');
      expect(display.className).toContain('w-full');
    });
  });

  describe('Accessibility', () => {
    it('should have role="alert"', () => {
      const error: RetryableError = {
        message: 'Test error',
        isRetryable: true,
      };
      
      render(<RetryableErrorDisplay error={error} />);
      
      const display = screen.getByTestId('retryable-error-display');
      expect(display.getAttribute('role')).toBe('alert');
    });

    it('should have aria-live="polite"', () => {
      const error: RetryableError = {
        message: 'Test error',
        isRetryable: true,
      };
      
      render(<RetryableErrorDisplay error={error} />);
      
      const display = screen.getByTestId('retryable-error-display');
      expect(display.getAttribute('aria-live')).toBe('polite');
    });

    it('should have aria-label on dismiss button', () => {
      const error: RetryableError = {
        message: 'Test error',
        isRetryable: true,
      };
      const onDismiss = vi.fn();
      
      render(<RetryableErrorDisplay error={error} onDismiss={onDismiss} />);
      
      const dismissButton = screen.getByTestId('retryable-error-dismiss');
      expect(dismissButton.getAttribute('aria-label')).toBeTruthy();
    });
  });
});

describe('isRecoverableError', () => {
  it('should return true for recoverable error codes', () => {
    expect(isRecoverableError(ErrorCode.NETWORK_ERROR)).toBe(true);
    expect(isRecoverableError(ErrorCode.RATE_LIMIT_ERROR)).toBe(true);
    expect(isRecoverableError(ErrorCode.STREAM_ERROR)).toBe(true);
    expect(isRecoverableError(ErrorCode.MCP_CONNECTION_ERROR)).toBe(true);
    expect(isRecoverableError(ErrorCode.TOOL_EXECUTION_ERROR)).toBe(true);
    expect(isRecoverableError(ErrorCode.DB_CONNECTION_ERROR)).toBe(true);
  });

  it('should return false for non-recoverable error codes', () => {
    expect(isRecoverableError(ErrorCode.VALIDATION_ERROR)).toBe(false);
    expect(isRecoverableError(ErrorCode.OCI_CONFIG_ERROR)).toBe(false);
    expect(isRecoverableError(ErrorCode.TOOL_NOT_FOUND)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isRecoverableError(undefined)).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isRecoverableError('')).toBe(false);
  });
});

describe('RECOVERABLE_ERROR_CODES', () => {
  it('should include network-related errors', () => {
    expect(RECOVERABLE_ERROR_CODES).toContain(ErrorCode.NETWORK_ERROR);
    expect(RECOVERABLE_ERROR_CODES).toContain(ErrorCode.STREAM_ERROR);
    expect(RECOVERABLE_ERROR_CODES).toContain(ErrorCode.STREAM_TIMEOUT);
  });

  it('should include rate limit errors', () => {
    expect(RECOVERABLE_ERROR_CODES).toContain(ErrorCode.RATE_LIMIT_ERROR);
  });

  it('should include connection errors', () => {
    expect(RECOVERABLE_ERROR_CODES).toContain(ErrorCode.MCP_CONNECTION_ERROR);
    expect(RECOVERABLE_ERROR_CODES).toContain(ErrorCode.DB_CONNECTION_ERROR);
  });

  it('should include tool execution errors', () => {
    expect(RECOVERABLE_ERROR_CODES).toContain(ErrorCode.TOOL_EXECUTION_ERROR);
    expect(RECOVERABLE_ERROR_CODES).toContain(ErrorCode.MCP_TOOL_ERROR);
  });

  it('should not include validation errors', () => {
    expect(RECOVERABLE_ERROR_CODES).not.toContain(ErrorCode.VALIDATION_ERROR);
  });

  it('should not include config errors', () => {
    expect(RECOVERABLE_ERROR_CODES).not.toContain(ErrorCode.OCI_CONFIG_ERROR);
  });
});
