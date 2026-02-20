/**
 * Unit tests for ToolErrorDisplay component
 * 
 * Task 13.5: Implement non-blocking tool error handling
 * Validates: Requirement 10.3 - Non-blocking tool error handling
 * - Display tool errors inline without blocking the UI
 * - Allow conversation to continue after tool error
 * - Provide visual distinction for error messages
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ToolErrorDisplay, formatToolErrorMessage, InlineToolError } from '@/components/ToolErrorDisplay';
import { ToolError } from '@/types';

describe('Task 13.5: Non-blocking Tool Error Handling', () => {
  beforeEach(() => {
    // Mock CSS variables
    document.documentElement.style.setProperty('--text-primary', '#000');
    document.documentElement.style.setProperty('--text-secondary', '#666');
    document.documentElement.style.setProperty('--text-muted', '#999');
    document.documentElement.style.setProperty('--bg-tertiary', '#f5f5f5');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const createToolError = (overrides: Partial<ToolError> = {}): ToolError => ({
    toolName: 'sqlcl_execute_query',
    errorMessage: 'Connection timeout while executing query',
    timestamp: new Date(),
    isRetryable: true,
    ...overrides,
  });

  describe('ToolErrorDisplay Component', () => {
    describe('Basic Rendering', () => {
      it('should render tool error with tool name', () => {
        const error = createToolError();
        render(<ToolErrorDisplay error={error} />);
        
        expect(screen.getByTestId('tool-error-display')).toBeDefined();
        expect(screen.getByTestId('tool-error-tool-name').textContent).toContain('Execute Query');
      });

      it('should render error message', () => {
        const error = createToolError({ errorMessage: 'Database connection failed' });
        render(<ToolErrorDisplay error={error} />);
        
        expect(screen.getByTestId('tool-error-message').textContent).toContain('Database connection failed');
      });

      it('should display "continue conversation" hint - validates non-blocking behavior', () => {
        const error = createToolError();
        render(<ToolErrorDisplay error={error} />);
        
        expect(screen.getByTestId('tool-error-continue-hint').textContent).toContain('You can continue the conversation');
      });

      it('should have role="alert" for accessibility', () => {
        const error = createToolError();
        render(<ToolErrorDisplay error={error} />);
        
        expect(screen.getByRole('alert')).toBeDefined();
      });

      it('should have visual distinction with error styling', () => {
        const error = createToolError();
        render(<ToolErrorDisplay error={error} />);
        
        const display = screen.getByTestId('tool-error-display');
        // Check that it has error-related styling (red background)
        expect(display.style.background).toContain('rgba(239, 68, 68');
      });
    });

    describe('Retry Functionality', () => {
      it('should show retry button when error is retryable and onRetry is provided', () => {
        const error = createToolError({ isRetryable: true });
        const onRetry = vi.fn();
        render(<ToolErrorDisplay error={error} onRetry={onRetry} />);
        
        expect(screen.getByTestId('tool-error-retry')).toBeDefined();
      });

      it('should not show retry button when error is not retryable', () => {
        const error = createToolError({ isRetryable: false });
        const onRetry = vi.fn();
        render(<ToolErrorDisplay error={error} onRetry={onRetry} />);
        
        expect(screen.queryByTestId('tool-error-retry')).toBeNull();
      });

      it('should call onRetry when retry button is clicked', () => {
        const error = createToolError({ isRetryable: true });
        const onRetry = vi.fn();
        render(<ToolErrorDisplay error={error} onRetry={onRetry} />);
        
        fireEvent.click(screen.getByTestId('tool-error-retry'));
        expect(onRetry).toHaveBeenCalledTimes(1);
      });
    });

    describe('Dismiss Functionality', () => {
      it('should show dismiss button when onDismiss is provided', () => {
        const error = createToolError();
        const onDismiss = vi.fn();
        render(<ToolErrorDisplay error={error} onDismiss={onDismiss} />);
        
        expect(screen.getByTestId('tool-error-dismiss')).toBeDefined();
      });

      it('should call onDismiss when dismiss button is clicked', () => {
        const error = createToolError();
        const onDismiss = vi.fn();
        render(<ToolErrorDisplay error={error} onDismiss={onDismiss} />);
        
        fireEvent.click(screen.getByTestId('tool-error-dismiss'));
        expect(onDismiss).toHaveBeenCalledTimes(1);
      });
    });

    describe('Details Expansion', () => {
      it('should show toggle details button when details are provided', () => {
        const error = createToolError({ details: { query: 'SELECT * FROM users' } });
        render(<ToolErrorDisplay error={error} />);
        
        expect(screen.getByTestId('tool-error-toggle-details')).toBeDefined();
      });

      it('should not show toggle details button when no details', () => {
        const error = createToolError({ details: undefined });
        render(<ToolErrorDisplay error={error} />);
        
        expect(screen.queryByTestId('tool-error-toggle-details')).toBeNull();
      });

      it('should expand details when toggle is clicked', () => {
        const error = createToolError({ details: { query: 'SELECT * FROM users' } });
        render(<ToolErrorDisplay error={error} />);
        
        // Initially collapsed
        expect(screen.queryByTestId('tool-error-details')).toBeNull();
        
        // Click to expand
        fireEvent.click(screen.getByTestId('tool-error-toggle-details'));
        
        // Now visible
        expect(screen.getByTestId('tool-error-details')).toBeDefined();
      });

      it('should collapse details when toggle is clicked again', () => {
        const error = createToolError({ details: { query: 'SELECT * FROM users' } });
        render(<ToolErrorDisplay error={error} />);
        
        // Expand
        fireEvent.click(screen.getByTestId('tool-error-toggle-details'));
        expect(screen.getByTestId('tool-error-details')).toBeDefined();
        
        // Collapse
        fireEvent.click(screen.getByTestId('tool-error-toggle-details'));
        expect(screen.queryByTestId('tool-error-details')).toBeNull();
      });
    });
  });

  describe('formatToolErrorMessage', () => {
    it('should remove stack traces from error messages', () => {
      const message = 'Error occurred\n    at Function.execute (/path/to/file.js:10:5)\n    at processTicksAndRejections';
      const formatted = formatToolErrorMessage(message);
      
      expect(formatted).not.toContain('at Function.execute');
      expect(formatted).not.toContain('processTicksAndRejections');
    });

    it('should remove internal error codes like ORA-12345', () => {
      const message = 'ORA-12345: Connection timeout occurred';
      const formatted = formatToolErrorMessage(message);
      
      expect(formatted).not.toContain('ORA-12345:');
      expect(formatted).toContain('Connection timeout occurred');
    });

    it('should remove file paths from error messages', () => {
      const message = 'Error in /Users/dev/project/src/file.ts:42:10';
      const formatted = formatToolErrorMessage(message);
      
      expect(formatted).not.toContain('/Users/dev/project');
      expect(formatted).not.toContain('.ts:42:10');
    });

    it('should remove "Error:" prefix', () => {
      const message = 'Error: Something went wrong';
      const formatted = formatToolErrorMessage(message);
      
      expect(formatted).not.toMatch(/^Error:/i);
      expect(formatted).toBe('Something went wrong');
    });

    it('should truncate very long messages', () => {
      const longMessage = 'A'.repeat(400);
      const formatted = formatToolErrorMessage(longMessage);
      
      expect(formatted.length).toBeLessThanOrEqual(300);
      expect(formatted).toContain('...');
    });

    it('should capitalize first letter', () => {
      const message = 'connection failed';
      const formatted = formatToolErrorMessage(message);
      
      expect(formatted).toBe('Connection failed');
    });

    it('should return default message for empty input', () => {
      const formatted = formatToolErrorMessage('');
      
      expect(formatted).toBe('An unexpected error occurred while executing the tool.');
    });

    it('should handle whitespace-only input', () => {
      const formatted = formatToolErrorMessage('   ');
      
      expect(formatted).toBe('An unexpected error occurred while executing the tool.');
    });
  });

  describe('InlineToolError Component', () => {
    it('should render inline error with tool name', () => {
      render(<InlineToolError toolName="sqlcl_query" errorMessage="Query failed" />);
      
      expect(screen.getByTestId('inline-tool-error')).toBeDefined();
      expect(screen.getByText('Query')).toBeDefined();
    });

    it('should render error message', () => {
      render(<InlineToolError toolName="test_tool" errorMessage="Something went wrong" />);
      
      expect(screen.getByText(/failed: Something went wrong/)).toBeDefined();
    });

    it('should format tool name correctly', () => {
      render(<InlineToolError toolName="sqlcl_execute_complex_query" errorMessage="Error" />);
      
      expect(screen.getByText('Execute Complex Query')).toBeDefined();
    });
  });
});
