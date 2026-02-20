// __tests__/unit/logger.test.ts
/**
 * Unit tests for the console error logging utility.
 * 
 * Requirements: 10.6
 */

import { describe, it, expect, beforeEach, afterEach, vi, SpyInstance } from 'vitest';
import { Logger, LogLevel, LogContext, logger } from '../../src/lib/logger';
import { AppError, ErrorCode, logError } from '../../src/lib/errors';

describe('Logger', () => {
  let consoleSpy: {
    debug: SpyInstance;
    info: SpyInstance;
    warn: SpyInstance;
    error: SpyInstance;
  };

  beforeEach(() => {
    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('log levels', () => {
    it('should log debug messages with console.debug', () => {
      const testLogger = new Logger();
      testLogger.debug('Debug message');

      expect(consoleSpy.debug).toHaveBeenCalled();
      const logOutput = consoleSpy.debug.mock.calls[0][0];
      expect(logOutput).toContain('[DEBUG]');
      expect(logOutput).toContain('Debug message');
    });

    it('should log info messages with console.info', () => {
      const testLogger = new Logger();
      testLogger.info('Info message');

      expect(consoleSpy.info).toHaveBeenCalled();
      const logOutput = consoleSpy.info.mock.calls[0][0];
      expect(logOutput).toContain('[INFO]');
      expect(logOutput).toContain('Info message');
    });

    it('should log warn messages with console.warn', () => {
      const testLogger = new Logger();
      testLogger.warn('Warning message');

      expect(consoleSpy.warn).toHaveBeenCalled();
      const logOutput = consoleSpy.warn.mock.calls[0][0];
      expect(logOutput).toContain('[WARN]');
      expect(logOutput).toContain('Warning message');
    });

    it('should log error messages with console.error', () => {
      const testLogger = new Logger();
      testLogger.error('Error message');

      expect(consoleSpy.error).toHaveBeenCalled();
      const logOutput = consoleSpy.error.mock.calls[0][0];
      expect(logOutput).toContain('[ERROR]');
      expect(logOutput).toContain('Error message');
    });
  });

  describe('timestamps', () => {
    it('should include ISO timestamp in log output', () => {
      const testLogger = new Logger();
      
      testLogger.info('Test message');

      const logOutput = consoleSpy.info.mock.calls[0][0];
      // Check that timestamp is present (starts with date portion)
      expect(logOutput).toMatch(/\[\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('context information', () => {
    it('should include component in log output', () => {
      const testLogger = new Logger();
      testLogger.info('Test message', { component: 'ChatPanel' });

      const logOutput = consoleSpy.info.mock.calls[0][0];
      expect(logOutput).toContain('[ChatPanel]');
    });

    it('should include action in log output', () => {
      const testLogger = new Logger();
      testLogger.info('Test message', { action: 'sendMessage' });

      const logOutput = consoleSpy.info.mock.calls[0][0];
      expect(logOutput).toContain('(sendMessage)');
    });

    it('should include full context object in log arguments', () => {
      const testLogger = new Logger();
      const context: LogContext = {
        component: 'MCPPanel',
        action: 'connect',
        conversationId: 'conv-123',
        metadata: { serverId: 'server-1' },
      };

      testLogger.info('Connecting to server', context);

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.any(String),
        '\nContext:',
        expect.objectContaining(context)
      );
    });
  });

  describe('error logging with stack traces', () => {
    it('should include error details for Error objects', () => {
      const testLogger = new Logger();
      const error = new Error('Something went wrong');

      testLogger.error('Operation failed', error);

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]'),
        '\nError Details:',
        expect.objectContaining({
          name: 'Error',
          message: 'Something went wrong',
        }),
        '\nStack Trace:',
        expect.stringContaining('Error: Something went wrong')
      );
    });

    it('should include AppError details with code and retryable flag', () => {
      const testLogger = new Logger();
      const appError = new AppError(
        ErrorCode.RATE_LIMIT_ERROR,
        'Rate limit exceeded',
        'Please wait before retrying',
        true,
        { retryAfterMs: 5000 }
      );

      testLogger.error('API call failed', appError);

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]'),
        '\nError Details:',
        expect.objectContaining({
          name: 'AppError',
          message: 'Rate limit exceeded',
          code: ErrorCode.RATE_LIMIT_ERROR,
          isRetryable: true,
          details: { retryAfterMs: 5000 },
        }),
        '\nStack Trace:',
        expect.any(String)
      );
    });

    it('should handle non-Error objects', () => {
      const testLogger = new Logger();

      testLogger.error('Unknown error', 'string error');

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]'),
        '\nError Details:',
        expect.objectContaining({
          name: 'UnknownError',
          message: 'string error',
        })
      );
    });

    it('should handle undefined error', () => {
      const testLogger = new Logger();

      testLogger.error('No error provided');

      // Should not include error details when no error is provided
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]')
      );
    });
  });

  describe('logClassifiedError', () => {
    it('should classify and log unknown errors', () => {
      const testLogger = new Logger();
      const error = new Error('Rate limit exceeded - throttled');

      const result = testLogger.logClassifiedError('API error', error);

      expect(result).toBeInstanceOf(AppError);
      expect(result.code).toBe(ErrorCode.RATE_LIMIT_ERROR);
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should pass through AppError without re-classification', () => {
      const testLogger = new Logger();
      const appError = new AppError(
        ErrorCode.MCP_CONNECTION_ERROR,
        'Connection failed',
        'Unable to connect',
        true
      );

      const result = testLogger.logClassifiedError('MCP error', appError);

      expect(result).toBe(appError);
      expect(result.code).toBe(ErrorCode.MCP_CONNECTION_ERROR);
    });
  });

  describe('contextual logger', () => {
    it('should create child logger with preset context', () => {
      const testLogger = new Logger();
      const chatLogger = testLogger.withContext({
        component: 'ChatPanel',
        conversationId: 'conv-456',
      });

      chatLogger.info('Message sent');

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[ChatPanel]'),
        '\nContext:',
        expect.objectContaining({
          component: 'ChatPanel',
          conversationId: 'conv-456',
        })
      );
    });

    it('should merge additional context with preset context', () => {
      const testLogger = new Logger();
      const chatLogger = testLogger.withContext({
        component: 'ChatPanel',
      });

      chatLogger.info('Tool executed', { action: 'executeTool' });

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[ChatPanel]'),
        '\nContext:',
        expect.objectContaining({
          component: 'ChatPanel',
          action: 'executeTool',
        })
      );
    });

    it('should support all log levels on contextual logger', () => {
      const testLogger = new Logger();
      const contextLogger = testLogger.withContext({ component: 'Test' });

      contextLogger.debug('Debug');
      contextLogger.info('Info');
      contextLogger.warn('Warn');
      contextLogger.error('Error');

      expect(consoleSpy.debug).toHaveBeenCalled();
      expect(consoleSpy.info).toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe('default context', () => {
    it('should include default context in all logs', () => {
      const testLogger = new Logger();
      testLogger.setDefaultContext({ userId: 'user-123' });

      testLogger.info('User action');

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.any(String),
        '\nContext:',
        expect.objectContaining({ userId: 'user-123' })
      );
    });

    it('should merge default context with provided context', () => {
      const testLogger = new Logger();
      testLogger.setDefaultContext({ userId: 'user-123' });

      testLogger.info('User action', { action: 'click' });

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.any(String),
        '\nContext:',
        expect.objectContaining({
          userId: 'user-123',
          action: 'click',
        })
      );
    });

    it('should clear default context', () => {
      const testLogger = new Logger();
      testLogger.setDefaultContext({ userId: 'user-123' });
      testLogger.clearDefaultContext();

      testLogger.info('Message without context');

      // Should only have the message, no context
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('Message without context')
      );
    });
  });

  describe('singleton logger instance', () => {
    it('should export a singleton logger instance', () => {
      expect(logger).toBeInstanceOf(Logger);
    });

    it('should work with the singleton instance', () => {
      logger.info('Singleton test');

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('Singleton test')
      );
    });
  });
});

describe('logError integration', () => {
  let consoleSpy: SpyInstance;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log errors with context using structured format', () => {
    const error = new Error('Test error');
    
    const result = logError('TestComponent', error, { extra: 'info' });

    expect(result).toBeInstanceOf(AppError);
    expect(consoleSpy).toHaveBeenCalled();
    
    // Check that the formatted message contains the component
    const formattedMessage = consoleSpy.mock.calls[0][0];
    expect(formattedMessage).toContain('[TestComponent]');
    expect(formattedMessage).toContain('[ERROR]');
    
    // Check that context includes component and metadata
    const contextArg = consoleSpy.mock.calls[0][2];
    expect(contextArg).toEqual(
      expect.objectContaining({
        component: 'TestComponent',
        metadata: { extra: 'info' },
      })
    );
  });

  it('should include timestamp in log output', () => {
    const error = new Error('Test error');
    
    logError('TestComponent', error);

    const formattedMessage = consoleSpy.mock.calls[0][0];
    // Check that timestamp is present (ISO format)
    expect(formattedMessage).toMatch(/\[\d{4}-\d{2}-\d{2}T/);
  });

  it('should include error details with code and retryable flag', () => {
    const error = new Error('Test error');
    
    logError('TestComponent', error);

    // Check error details argument
    const errorDetailsArg = consoleSpy.mock.calls[0][4];
    expect(errorDetailsArg).toEqual(
      expect.objectContaining({
        name: 'AppError',
        code: expect.any(String),
        isRetryable: expect.any(Boolean),
      })
    );
  });

  it('should include stack trace in log output', () => {
    const error = new Error('Test error');
    
    logError('TestComponent', error);

    // Check that stack trace is included
    const stackTraceArg = consoleSpy.mock.calls[0][6];
    expect(stackTraceArg).toBeDefined();
    expect(typeof stackTraceArg).toBe('string');
  });

  it('should return the classified AppError', () => {
    const error = new Error('Authentication failed - 401');
    
    const result = logError('AuthService', error);

    expect(result.code).toBe(ErrorCode.OCI_AUTH_ERROR);
    expect(result.isRetryable).toBe(true);
  });

  it('should pass through existing AppError', () => {
    const appError = new AppError(
      ErrorCode.TOOL_EXECUTION_ERROR,
      'Tool failed',
      'The tool encountered an error',
      true
    );
    
    const result = logError('ToolService', appError);

    expect(result).toBe(appError);
  });

  it('should handle errors without additional info', () => {
    const error = new Error('Simple error');
    
    logError('SimpleComponent', error);

    // Context should not have metadata when not provided
    const contextArg = consoleSpy.mock.calls[0][2];
    expect(contextArg).toEqual({
      component: 'SimpleComponent',
    });
  });
});
