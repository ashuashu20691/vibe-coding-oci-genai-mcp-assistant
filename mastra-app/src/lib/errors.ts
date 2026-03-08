// src/lib/errors.ts
/**
 * Centralized error handling utilities for the application.
 * Provides user-friendly error messages and error classification.
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */

/**
 * Error codes for different error types.
 */
export enum ErrorCode {
  // Authentication errors (9.1)
  OCI_AUTH_ERROR = 'OCI_AUTH_ERROR',
  OCI_CONFIG_ERROR = 'OCI_CONFIG_ERROR',
  
  // Rate limiting errors
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  
  // MCP errors (9.2)
  MCP_CONNECTION_ERROR = 'MCP_CONNECTION_ERROR',
  MCP_TOOL_ERROR = 'MCP_TOOL_ERROR',
  
  // Tool execution errors (9.3)
  TOOL_EXECUTION_ERROR = 'TOOL_EXECUTION_ERROR',
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  
  // Streaming errors (9.4)
  STREAM_ERROR = 'STREAM_ERROR',
  STREAM_TIMEOUT = 'STREAM_TIMEOUT',
  
  // Database errors (9.5)
  DB_CONNECTION_ERROR = 'DB_CONNECTION_ERROR',
  DB_QUERY_ERROR = 'DB_QUERY_ERROR',
  
  // General errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Application error with user-friendly message and error code.
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly userMessage: string;
  public readonly isRetryable: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    userMessage: string,
    isRetryable: boolean = false,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.userMessage = userMessage;
    this.isRetryable = isRetryable;
    this.details = details;
  }
}

/**
 * User-friendly error messages for each error code.
 */
const ERROR_MESSAGES: Record<ErrorCode, { title: string; suggestion: string }> = {
  [ErrorCode.OCI_AUTH_ERROR]: {
    title: 'Authentication Failed',
    suggestion: 'Please check your OCI configuration file and credentials. Ensure the profile and compartment ID are correct.',
  },
  [ErrorCode.OCI_CONFIG_ERROR]: {
    title: 'Configuration Error',
    suggestion: 'Please verify your OCI configuration. Check that OCI_CONFIG_FILE, OCI_PROFILE, and OCI_COMPARTMENT_ID are set correctly.',
  },
  [ErrorCode.RATE_LIMIT_ERROR]: {
    title: 'Rate Limit Exceeded',
    suggestion: 'Too many requests. Please wait a few seconds before sending another message. The system will automatically retry.',
  },
  [ErrorCode.MCP_CONNECTION_ERROR]: {
    title: 'MCP Connection Failed',
    suggestion: 'Unable to connect to the MCP server. Please check that the MCP server is running and the configuration is correct.',
  },
  [ErrorCode.MCP_TOOL_ERROR]: {
    title: 'MCP Tool Error',
    suggestion: 'The MCP tool encountered an error. Please try again or check the tool configuration.',
  },
  [ErrorCode.TOOL_EXECUTION_ERROR]: {
    title: 'Tool Execution Failed',
    suggestion: 'The tool failed to execute. Please check the tool arguments and try again.',
  },
  [ErrorCode.TOOL_NOT_FOUND]: {
    title: 'Tool Not Found',
    suggestion: 'The requested tool is not available. Please check the MCP server configuration.',
  },
  [ErrorCode.STREAM_ERROR]: {
    title: 'Streaming Error',
    suggestion: 'An error occurred while streaming the response. Please try sending your message again.',
  },
  [ErrorCode.STREAM_TIMEOUT]: {
    title: 'Response Timeout',
    suggestion: 'The response took too long. Please try again with a shorter message or simpler request.',
  },
  [ErrorCode.DB_CONNECTION_ERROR]: {
    title: 'Database Connection Failed',
    suggestion: 'Unable to connect to the database. Conversations will be stored in session only. Check ORACLE_CONNECTION_NAME configuration.',
  },
  [ErrorCode.DB_QUERY_ERROR]: {
    title: 'Database Query Failed',
    suggestion: 'The database query failed. Please try again or contact support if the issue persists.',
  },
  [ErrorCode.VALIDATION_ERROR]: {
    title: 'Invalid Input',
    suggestion: 'Please check your input and try again.',
  },
  [ErrorCode.NETWORK_ERROR]: {
    title: 'Network Error',
    suggestion: 'A network error occurred. Please check your connection and try again.',
  },
  [ErrorCode.UNKNOWN_ERROR]: {
    title: 'Unexpected Error',
    suggestion: 'An unexpected error occurred. Please try again or contact support.',
  },
};

/**
 * Get user-friendly error information for an error code.
 */
export function getErrorInfo(code: ErrorCode): { title: string; suggestion: string } {
  return ERROR_MESSAGES[code] || ERROR_MESSAGES[ErrorCode.UNKNOWN_ERROR];
}

/**
 * Classify an error and return an AppError with appropriate code.
 */
export function classifyError(error: unknown): AppError {
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  // Rate limit errors (check first as they're common)
  if (
    lowerMessage.includes('throttled') ||
    lowerMessage.includes('rate limit') ||
    lowerMessage.includes('service request limit') ||
    lowerMessage.includes('429') ||
    lowerMessage.includes('too many requests')
  ) {
    const info = getErrorInfo(ErrorCode.RATE_LIMIT_ERROR);
    return new AppError(
      ErrorCode.RATE_LIMIT_ERROR,
      message,
      `${info.title}: ${info.suggestion}`,
      true, // Rate limit errors are retryable after waiting
      { retryAfterMs: 5000 }
    );
  }

  // OCI Authentication errors (9.1)
  if (
    lowerMessage.includes('authentication') ||
    lowerMessage.includes('401') ||
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('credentials')
  ) {
    const info = getErrorInfo(ErrorCode.OCI_AUTH_ERROR);
    return new AppError(
      ErrorCode.OCI_AUTH_ERROR,
      message,
      `${info.title}: ${info.suggestion}`,
      true
    );
  }

  // OCI Configuration errors
  if (
    lowerMessage.includes('config') ||
    lowerMessage.includes('compartment') ||
    lowerMessage.includes('oci_')
  ) {
    const info = getErrorInfo(ErrorCode.OCI_CONFIG_ERROR);
    return new AppError(
      ErrorCode.OCI_CONFIG_ERROR,
      message,
      `${info.title}: ${info.suggestion}`,
      false
    );
  }

  // MCP Connection errors (9.2)
  if (
    lowerMessage.includes('mcp') ||
    lowerMessage.includes('connection refused') ||
    lowerMessage.includes('econnrefused')
  ) {
    const info = getErrorInfo(ErrorCode.MCP_CONNECTION_ERROR);
    return new AppError(
      ErrorCode.MCP_CONNECTION_ERROR,
      message,
      `${info.title}: ${info.suggestion}`,
      true
    );
  }

  // Tool errors (9.3)
  if (lowerMessage.includes('tool') && lowerMessage.includes('not found')) {
    const info = getErrorInfo(ErrorCode.TOOL_NOT_FOUND);
    return new AppError(
      ErrorCode.TOOL_NOT_FOUND,
      message,
      `${info.title}: ${info.suggestion}`,
      false
    );
  }

  if (lowerMessage.includes('tool')) {
    const info = getErrorInfo(ErrorCode.TOOL_EXECUTION_ERROR);
    return new AppError(
      ErrorCode.TOOL_EXECUTION_ERROR,
      message,
      `${info.title}: ${info.suggestion}`,
      true
    );
  }

  // Streaming errors (9.4)
  if (lowerMessage.includes('stream') || lowerMessage.includes('timeout')) {
    const info = getErrorInfo(ErrorCode.STREAM_ERROR);
    return new AppError(
      ErrorCode.STREAM_ERROR,
      message,
      `${info.title}: ${info.suggestion}`,
      true
    );
  }

  // Database errors (9.5)
  if (
    lowerMessage.includes('database') ||
    lowerMessage.includes('sql') ||
    lowerMessage.includes('oracle') ||
    lowerMessage.includes('ora-')
  ) {
    const isConnection = lowerMessage.includes('connect');
    const code = isConnection ? ErrorCode.DB_CONNECTION_ERROR : ErrorCode.DB_QUERY_ERROR;
    const info = getErrorInfo(code);
    return new AppError(
      code,
      message,
      `${info.title}: ${info.suggestion}`,
      true
    );
  }

  // Network errors
  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('fetch') ||
    lowerMessage.includes('enotfound')
  ) {
    const info = getErrorInfo(ErrorCode.NETWORK_ERROR);
    return new AppError(
      ErrorCode.NETWORK_ERROR,
      message,
      `${info.title}: ${info.suggestion}`,
      true
    );
  }

  // Default to unknown error
  const info = getErrorInfo(ErrorCode.UNKNOWN_ERROR);
  return new AppError(
    ErrorCode.UNKNOWN_ERROR,
    message,
    `${info.title}: ${info.suggestion}`,
    true
  );
}

/**
 * Format error for API response.
 */
export function formatErrorResponse(error: unknown): {
  error: string;
  code: ErrorCode;
  userMessage: string;
  isRetryable: boolean;
} {
  const appError = error instanceof AppError ? error : classifyError(error);
  
  return {
    error: appError.message,
    code: appError.code,
    userMessage: appError.userMessage,
    isRetryable: appError.isRetryable,
  };
}

/**
 * Log error with context for debugging.
 * Logs full error details to console including context and stack traces.
 * 
 * Requirements: 10.6
 */
export function logError(
  context: string,
  error: unknown,
  additionalInfo?: Record<string, unknown>
): AppError {
  const appError = error instanceof AppError ? error : classifyError(error);
  const timestamp = new Date().toISOString();
  
  // Format the log message with timestamp and context
  const formattedMessage = `[${timestamp}] [ERROR] [${context}] ${appError.code}: ${appError.message}`;
  
  // Build context object
  const logContext = {
    component: context,
    ...(additionalInfo && { metadata: additionalInfo }),
  };
  
  // Build error details object
  const errorDetails = {
    name: appError.name,
    message: appError.message,
    code: appError.code,
    isRetryable: appError.isRetryable,
    details: appError.details,
  };
  
  // Log with full details and stack trace
  console.error(
    formattedMessage,
    '\nContext:',
    logContext,
    '\nError Details:',
    errorDetails,
    '\nStack Trace:',
    appError.stack
  );
  
  return appError;
}
