/**
 * Property Test: Error Message User-Friendliness
 *
 * Feature: claude-desktop-alternative, Property 24: Error Message User-Friendliness
 *
 * *For any* OCI GenAI error, the displayed error message SHALL NOT contain raw stack traces
 * or internal error codes, and SHALL contain actionable guidance.
 *
 * **Validates: Requirements 10.1**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  classifyError,
  formatErrorResponse,
  AppError,
  ErrorCode,
  getErrorInfo,
} from '../../src/lib/errors';

/**
 * Checks if a message contains raw stack traces.
 * Stack traces typically contain patterns like:
 * - "at functionName (file.js:line:column)"
 * - "at Object.<anonymous>"
 * - "at Module._compile"
 */
function containsStackTrace(message: string): boolean {
  // Common stack trace patterns
  const stackTracePatterns = [
    /at\s+[\w.<>]+\s+\([^)]+:\d+:\d+\)/,  // at functionName (file.js:42:15)
    /at\s+[\w.<>]+\s+\([^)]+\.(?:js|ts|tsx|jsx):\d+\)/,  // at func (file.js:42)
    /at\s+Object\.<anonymous>/,  // at Object.<anonymous>
    /at\s+Module\._compile/,  // at Module._compile
    /at\s+processTicksAndRejections/,  // at processTicksAndRejections
    /at\s+async\s+[\w.]+/,  // at async functionName
    /^\s+at\s+/m,  // Lines starting with "at " (common in stack traces)
    /Error:\s+.*\n\s+at\s+/,  // Error: message\n    at ...
  ];

  return stackTracePatterns.some((pattern) => pattern.test(message));
}

/**
 * Checks if a message contains internal error codes that are not user-friendly.
 * Internal codes are typically:
 * - Raw HTTP status codes without context (e.g., just "500")
 * - Internal system codes (e.g., "ECONNREFUSED", "ETIMEDOUT")
 * - OCI-specific internal codes without explanation
 */
function containsRawInternalCode(message: string): boolean {
  // Check for raw internal codes without context
  const rawCodePatterns = [
    /^[A-Z]{2,}_[A-Z_]+$/,  // Pure internal codes like "ECONNREFUSED"
    /^\d{3}$/,  // Just HTTP status codes like "500"
    /^ORA-\d+$/,  // Raw Oracle error codes
    /^OCI-\d+$/,  // Raw OCI error codes
  ];

  // The message itself shouldn't be just an internal code
  const trimmedMessage = message.trim();
  return rawCodePatterns.some((pattern) => pattern.test(trimmedMessage));
}

/**
 * Checks if a message contains actionable guidance.
 * Actionable guidance includes words/phrases that help users understand what to do.
 */
function containsActionableGuidance(message: string): boolean {
  const actionablePatterns = [
    /please/i,
    /try/i,
    /check/i,
    /verify/i,
    /ensure/i,
    /contact/i,
    /wait/i,
    /retry/i,
    /configure/i,
    /set/i,
    /update/i,
    /correct/i,
    /valid/i,
    /again/i,
    /support/i,
    /help/i,
  ];

  return actionablePatterns.some((pattern) => pattern.test(message));
}

/**
 * Validates that an error message is user-friendly according to Property 24.
 */
function isUserFriendlyErrorMessage(message: string): {
  isValid: boolean;
  hasStackTrace: boolean;
  hasRawInternalCode: boolean;
  hasActionableGuidance: boolean;
} {
  const hasStackTrace = containsStackTrace(message);
  const hasRawInternalCode = containsRawInternalCode(message);
  const hasActionableGuidance = containsActionableGuidance(message);

  return {
    isValid: !hasStackTrace && !hasRawInternalCode && hasActionableGuidance,
    hasStackTrace,
    hasRawInternalCode,
    hasActionableGuidance,
  };
}

// Arbitrary for OCI GenAI error messages (various error types)
const ociGenAIErrorArb = fc.oneof(
  // Authentication errors
  fc.constant('Authentication failed: Invalid API key'),
  fc.constant('401 Unauthorized: The request has not been applied because it lacks valid authentication credentials'),
  fc.constant('Unauthorized access to OCI GenAI service'),
  fc.constant('Invalid credentials provided for OCI authentication'),
  // Rate limit errors
  fc.constant('429 Too Many Requests: Rate limit exceeded'),
  fc.constant('Service request limit exceeded. Please retry after some time.'),
  fc.constant('Throttled: Too many requests to OCI GenAI'),
  fc.constant('Rate limit exceeded for model endpoint'),
  // Configuration errors
  fc.constant('OCI configuration error: Missing compartment ID'),
  fc.constant('Invalid OCI_CONFIG_FILE path'),
  fc.constant('OCI profile not found in configuration'),
  fc.constant('Compartment OCID is invalid or not accessible'),
  // Model errors
  fc.constant('Model not found: cohere.command-r-plus'),
  fc.constant('Model endpoint unavailable'),
  fc.constant('Invalid model ID specified'),
  fc.constant('Model quota exceeded'),
  // Network errors
  fc.constant('NetworkError: Failed to connect to OCI GenAI endpoint'),
  fc.constant('ECONNREFUSED: Connection refused to OCI service'),
  fc.constant('Connection timeout to OCI GenAI'),
  fc.constant('Network error: Unable to reach OCI endpoint'),
  // Streaming errors
  fc.constant('Stream error: Connection interrupted'),
  fc.constant('Streaming response failed'),
  fc.constant('Stream timeout: No response received'),
  // Service errors
  fc.constant('500 Internal Server Error from OCI GenAI'),
  fc.constant('503 Service Unavailable: OCI GenAI is temporarily unavailable'),
  fc.constant('OCI GenAI service error'),
  fc.constant('Internal error processing request'),
  // Generic errors
  fc.constant('Unknown error occurred'),
  fc.constant('Request failed'),
  fc.constant('Operation failed')
);

// Arbitrary for errors with stack traces (should be filtered out)
const errorWithStackTraceArb = fc.oneof(
  fc.constant(`Error: Connection failed
    at connect (/app/src/oci-genai.js:42:15)
    at async handleRequest (/app/src/api/chat.js:100:20)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`),
  fc.constant(`TypeError: Cannot read property 'generate' of undefined
    at Object.<anonymous> (/node_modules/oci-sdk/lib/genai.js:200:30)
    at Module._compile (node:internal/modules/cjs/loader:1256:14)`),
  fc.constant(`ReferenceError: model is not defined
    at eval (eval at <anonymous> (/app/src/chat.ts:50:10))
    at Object.generateText (/app/src/oci-genai.ts:150:25)`),
  fc.constant(`Error: OCI GenAI request failed
    at OCIProvider.chat (/app/src/mastra/providers/oci-genai.ts:300:11)
    at async ChatService.sendMessage (/app/src/services/chat.ts:45:20)`)
);

// Arbitrary for raw internal error codes (should not be the entire message)
const rawInternalCodeArb = fc.oneof(
  fc.constant('ECONNREFUSED'),
  fc.constant('ETIMEDOUT'),
  fc.constant('ENOTFOUND'),
  fc.constant('500'),
  fc.constant('401'),
  fc.constant('429'),
  fc.constant('ORA-12541'),
  fc.constant('OCI-1234')
);

// Arbitrary for all error codes
const errorCodeArb = fc.constantFrom(
  ErrorCode.OCI_AUTH_ERROR,
  ErrorCode.OCI_CONFIG_ERROR,
  ErrorCode.RATE_LIMIT_ERROR,
  ErrorCode.MCP_CONNECTION_ERROR,
  ErrorCode.MCP_TOOL_ERROR,
  ErrorCode.TOOL_EXECUTION_ERROR,
  ErrorCode.TOOL_NOT_FOUND,
  ErrorCode.STREAM_ERROR,
  ErrorCode.STREAM_TIMEOUT,
  ErrorCode.DB_CONNECTION_ERROR,
  ErrorCode.DB_QUERY_ERROR,
  ErrorCode.VALIDATION_ERROR,
  ErrorCode.NETWORK_ERROR,
  ErrorCode.UNKNOWN_ERROR
);

describe('Property 24: Error Message User-Friendliness', () => {
  describe('No Raw Stack Traces', () => {
    it('formatErrorResponse SHALL NOT include stack traces in userMessage (Req 10.1)', () => {
      fc.assert(
        fc.property(ociGenAIErrorArb, (rawError) => {
          const response = formatErrorResponse(new Error(rawError));

          // Property: userMessage should not contain stack traces
          const validation = isUserFriendlyErrorMessage(response.userMessage);
          expect(validation.hasStackTrace).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('classifyError SHALL filter out stack traces from user-facing messages (Req 10.1)', () => {
      fc.assert(
        fc.property(errorWithStackTraceArb, (errorWithStack) => {
          const appError = classifyError(new Error(errorWithStack));

          // Property: userMessage should not contain stack traces
          const validation = isUserFriendlyErrorMessage(appError.userMessage);
          expect(validation.hasStackTrace).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('AppError userMessage SHALL NOT expose stack trace details (Req 10.1)', () => {
      fc.assert(
        fc.property(
          errorCodeArb,
          errorWithStackTraceArb,
          (code, errorWithStack) => {
            // When creating an AppError, the userMessage should be clean
            const info = getErrorInfo(code);
            const appError = new AppError(
              code,
              errorWithStack, // Raw error with stack trace
              `${info.title}: ${info.suggestion}`, // User-friendly message
              true
            );

            // Property: userMessage is clean, even if internal message has stack trace
            const validation = isUserFriendlyErrorMessage(appError.userMessage);
            expect(validation.hasStackTrace).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('No Raw Internal Error Codes', () => {
    it('formatErrorResponse SHALL NOT return raw internal codes as userMessage (Req 10.1)', () => {
      fc.assert(
        fc.property(rawInternalCodeArb, (rawCode) => {
          const response = formatErrorResponse(new Error(rawCode));

          // Property: userMessage should not be just a raw internal code
          const validation = isUserFriendlyErrorMessage(response.userMessage);
          expect(validation.hasRawInternalCode).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('classifyError SHALL transform raw codes into user-friendly messages (Req 10.1)', () => {
      fc.assert(
        fc.property(rawInternalCodeArb, (rawCode) => {
          const appError = classifyError(new Error(rawCode));

          // Property: userMessage should not be just a raw internal code
          const validation = isUserFriendlyErrorMessage(appError.userMessage);
          expect(validation.hasRawInternalCode).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('all ErrorCode values SHALL have user-friendly messages (Req 10.1)', () => {
      fc.assert(
        fc.property(errorCodeArb, (code) => {
          const info = getErrorInfo(code);

          // Property: Error info should have meaningful title and suggestion
          expect(info.title.length).toBeGreaterThan(0);
          expect(info.suggestion.length).toBeGreaterThan(0);

          // Property: Combined message should be user-friendly
          const userMessage = `${info.title}: ${info.suggestion}`;
          const validation = isUserFriendlyErrorMessage(userMessage);
          expect(validation.hasRawInternalCode).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Actionable Guidance', () => {
    it('formatErrorResponse SHALL include actionable guidance in userMessage (Req 10.1)', () => {
      fc.assert(
        fc.property(ociGenAIErrorArb, (rawError) => {
          const response = formatErrorResponse(new Error(rawError));

          // Property: userMessage should contain actionable guidance
          const validation = isUserFriendlyErrorMessage(response.userMessage);
          expect(validation.hasActionableGuidance).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('classifyError SHALL produce messages with actionable guidance (Req 10.1)', () => {
      fc.assert(
        fc.property(ociGenAIErrorArb, (rawError) => {
          const appError = classifyError(new Error(rawError));

          // Property: userMessage should contain actionable guidance
          const validation = isUserFriendlyErrorMessage(appError.userMessage);
          expect(validation.hasActionableGuidance).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('all ErrorCode messages SHALL contain actionable guidance (Req 10.1)', () => {
      fc.assert(
        fc.property(errorCodeArb, (code) => {
          const info = getErrorInfo(code);
          const userMessage = `${info.title}: ${info.suggestion}`;

          // Property: All error messages should have actionable guidance
          const validation = isUserFriendlyErrorMessage(userMessage);
          expect(validation.hasActionableGuidance).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('rate limit errors SHALL include retry guidance (Req 10.1)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            '429 Too Many Requests',
            'Rate limit exceeded',
            'Throttled',
            'Service request limit exceeded'
          ),
          (rateLimitError) => {
            const appError = classifyError(new Error(rateLimitError));

            // Property: Rate limit errors should mention retry/wait
            expect(appError.userMessage.toLowerCase()).toMatch(/wait|retry|again/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('authentication errors SHALL include configuration guidance (Req 10.1)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'Authentication failed',
            '401 Unauthorized',
            'Invalid credentials'
          ),
          (authError) => {
            const appError = classifyError(new Error(authError));

            // Property: Auth errors should mention checking credentials/config
            expect(appError.userMessage.toLowerCase()).toMatch(/check|verify|config|credential/);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Complete User-Friendliness Validation', () => {
    it('formatErrorResponse SHALL produce fully user-friendly messages for any OCI error (Req 10.1)', () => {
      fc.assert(
        fc.property(ociGenAIErrorArb, (rawError) => {
          const response = formatErrorResponse(new Error(rawError));
          const validation = isUserFriendlyErrorMessage(response.userMessage);

          // Property: All three criteria must be met
          expect(validation.isValid).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('classifyError SHALL produce fully user-friendly AppError for any input (Req 10.1)', () => {
      fc.assert(
        fc.property(
          fc.oneof(ociGenAIErrorArb, errorWithStackTraceArb, rawInternalCodeArb),
          (anyError) => {
            const appError = classifyError(new Error(anyError));
            const validation = isUserFriendlyErrorMessage(appError.userMessage);

            // Property: All three criteria must be met
            expect(validation.isValid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('error response SHALL always have required fields (Req 10.1)', () => {
      fc.assert(
        fc.property(ociGenAIErrorArb, (rawError) => {
          const response = formatErrorResponse(new Error(rawError));

          // Property: Response has all required fields
          expect(response).toHaveProperty('error');
          expect(response).toHaveProperty('code');
          expect(response).toHaveProperty('userMessage');
          expect(response).toHaveProperty('isRetryable');

          // Property: Fields have valid values
          expect(typeof response.error).toBe('string');
          expect(typeof response.code).toBe('string');
          expect(typeof response.userMessage).toBe('string');
          expect(typeof response.isRetryable).toBe('boolean');
          expect(response.userMessage.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Error Classification Consistency', () => {
    it('same error type SHALL produce consistent user messages (Req 10.1)', () => {
      fc.assert(
        fc.property(errorCodeArb, (code) => {
          // Get error info twice
          const info1 = getErrorInfo(code);
          const info2 = getErrorInfo(code);

          // Property: Same code produces same info
          expect(info1.title).toBe(info2.title);
          expect(info1.suggestion).toBe(info2.suggestion);
        }),
        { numRuns: 100 }
      );
    });

    it('similar errors SHALL be classified to same error code (Req 10.1)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            ['429 Too Many Requests', '429'],
            ['Rate limit exceeded', 'rate limit'],
            ['Throttled', 'throttled'],
          ),
          (errorPair) => {
            const [error1, error2] = errorPair;
            const appError1 = classifyError(new Error(error1));
            const appError2 = classifyError(new Error(error2));

            // Property: Similar errors get same classification
            expect(appError1.code).toBe(appError2.code);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('empty error message SHALL still produce user-friendly response (Req 10.1)', () => {
      const response = formatErrorResponse(new Error(''));
      const validation = isUserFriendlyErrorMessage(response.userMessage);

      // Property: Even empty errors get user-friendly messages
      expect(validation.isValid).toBe(true);
      expect(response.userMessage.length).toBeGreaterThan(0);
    });

    it('null/undefined errors SHALL be handled gracefully (Req 10.1)', () => {
      // Test with various falsy values
      const nullResponse = formatErrorResponse(null);
      const undefinedResponse = formatErrorResponse(undefined);

      // Property: Falsy errors produce valid responses
      expect(nullResponse.userMessage.length).toBeGreaterThan(0);
      expect(undefinedResponse.userMessage.length).toBeGreaterThan(0);

      const nullValidation = isUserFriendlyErrorMessage(nullResponse.userMessage);
      const undefinedValidation = isUserFriendlyErrorMessage(undefinedResponse.userMessage);

      expect(nullValidation.isValid).toBe(true);
      expect(undefinedValidation.isValid).toBe(true);
    });

    it('very long error messages SHALL be handled without truncation issues (Req 10.1)', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 500, maxLength: 2000 }),
          (longError) => {
            const response = formatErrorResponse(new Error(longError));

            // Property: Long errors still produce valid responses
            expect(response.userMessage.length).toBeGreaterThan(0);
            expect(typeof response.code).toBe('string');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('special characters in errors SHALL not break formatting (Req 10.1)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'Error: <script>alert("xss")</script>',
            'Error: SELECT * FROM users; DROP TABLE users;--',
            'Error: ${process.env.SECRET}',
            'Error: \n\r\t special chars',
            'Error: unicode: 你好世界 🚀'
          ),
          (specialError) => {
            const response = formatErrorResponse(new Error(specialError));

            // Property: Special characters don't break the response
            expect(response.userMessage.length).toBeGreaterThan(0);
            expect(typeof response.code).toBe('string');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
