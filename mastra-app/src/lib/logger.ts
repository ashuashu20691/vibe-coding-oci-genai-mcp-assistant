// src/lib/logger.ts
/**
 * Console error logging utility for debugging.
 * Provides structured logging with context, timestamps, and stack traces.
 * 
 * Requirements: 10.6
 */

import { AppError, ErrorCode, classifyError } from './errors';

/**
 * Log levels for different severity of messages.
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * Context information for log entries.
 */
export interface LogContext {
  /** Component or module where the log originated */
  component?: string;
  /** Action being performed when the log was created */
  action?: string;
  /** User ID or session ID for tracking */
  userId?: string;
  /** Conversation ID for chat-related logs */
  conversationId?: string;
  /** Request ID for API-related logs */
  requestId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Structured log entry.
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    code?: ErrorCode;
    stack?: string;
    isRetryable?: boolean;
    details?: Record<string, unknown>;
  };
}

/**
 * Format a log entry for console output.
 */
function formatLogEntry(entry: LogEntry): string {
  const parts = [
    `[${entry.timestamp}]`,
    `[${entry.level}]`,
  ];

  if (entry.context?.component) {
    parts.push(`[${entry.context.component}]`);
  }

  if (entry.context?.action) {
    parts.push(`(${entry.context.action})`);
  }

  parts.push(entry.message);

  return parts.join(' ');
}

/**
 * Get the appropriate console method for a log level.
 */
function getConsoleMethod(level: LogLevel): (...args: unknown[]) => void {
  switch (level) {
    case LogLevel.DEBUG:
      return console.debug;
    case LogLevel.INFO:
      return console.info;
    case LogLevel.WARN:
      return console.warn;
    case LogLevel.ERROR:
      return console.error;
    default:
      return console.log;
  }
}

/**
 * Create a timestamp string in ISO format.
 */
function createTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Extract error details including stack trace.
 */
function extractErrorDetails(error: unknown): LogEntry['error'] {
  if (error instanceof AppError) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack,
      isRetryable: error.isRetryable,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: 'UnknownError',
    message: String(error),
  };
}

/**
 * Logger class for structured console logging.
 */
class Logger {
  private defaultContext: LogContext = {};

  /**
   * Set default context that will be included in all log entries.
   */
  setDefaultContext(context: LogContext): void {
    this.defaultContext = { ...this.defaultContext, ...context };
  }

  /**
   * Clear the default context.
   */
  clearDefaultContext(): void {
    this.defaultContext = {};
  }

  /**
   * Create a child logger with additional context.
   */
  withContext(context: LogContext): ContextualLogger {
    return new ContextualLogger(this, { ...this.defaultContext, ...context });
  }

  /**
   * Log a debug message.
   */
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log an info message.
   */
  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log a warning message.
   */
  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log an error with full details and stack trace.
   */
  error(message: string, error?: unknown, context?: LogContext): void {
    const entry: LogEntry = {
      timestamp: createTimestamp(),
      level: LogLevel.ERROR,
      message,
      context: { ...this.defaultContext, ...context },
    };

    if (error !== undefined) {
      entry.error = extractErrorDetails(error);
    }

    this.outputEntry(entry);
  }

  /**
   * Log an error and classify it using the error classification system.
   */
  logClassifiedError(
    message: string,
    error: unknown,
    context?: LogContext
  ): AppError {
    const appError = error instanceof AppError ? error : classifyError(error);
    
    this.error(message, appError, context);
    
    return appError;
  }

  /**
   * Internal log method.
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    const entry: LogEntry = {
      timestamp: createTimestamp(),
      level,
      message,
      context: { ...this.defaultContext, ...context },
    };

    this.outputEntry(entry);
  }

  /**
   * Output a log entry to the console.
   */
  private outputEntry(entry: LogEntry): void {
    const consoleMethod = getConsoleMethod(entry.level);
    const formattedMessage = formatLogEntry(entry);

    // Build the log arguments
    const logArgs: unknown[] = [formattedMessage];

    // Add context if present
    if (entry.context && Object.keys(entry.context).length > 0) {
      logArgs.push('\nContext:', entry.context);
    }

    // Add error details if present
    if (entry.error) {
      logArgs.push('\nError Details:', {
        name: entry.error.name,
        message: entry.error.message,
        code: entry.error.code,
        isRetryable: entry.error.isRetryable,
        details: entry.error.details,
      });

      // Add stack trace separately for better readability
      if (entry.error.stack) {
        logArgs.push('\nStack Trace:', entry.error.stack);
      }
    }

    consoleMethod(...logArgs);
  }
}

/**
 * Contextual logger that includes preset context in all log entries.
 */
class ContextualLogger {
  constructor(
    private parent: Logger,
    private context: LogContext
  ) {}

  debug(message: string, additionalContext?: LogContext): void {
    this.parent.debug(message, { ...this.context, ...additionalContext });
  }

  info(message: string, additionalContext?: LogContext): void {
    this.parent.info(message, { ...this.context, ...additionalContext });
  }

  warn(message: string, additionalContext?: LogContext): void {
    this.parent.warn(message, { ...this.context, ...additionalContext });
  }

  error(message: string, error?: unknown, additionalContext?: LogContext): void {
    this.parent.error(message, error, { ...this.context, ...additionalContext });
  }

  logClassifiedError(
    message: string,
    error: unknown,
    additionalContext?: LogContext
  ): AppError {
    return this.parent.logClassifiedError(message, error, {
      ...this.context,
      ...additionalContext,
    });
  }
}

// Export singleton instance
export const logger = new Logger();

// Export class for testing
export { Logger, ContextualLogger };
