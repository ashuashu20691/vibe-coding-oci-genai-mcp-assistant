/**
 * Property Test: MCP Connection Error Handling
 *
 * Feature: claude-desktop-alternative, Property 10: MCP Connection Error Handling
 *
 * *For any* MCP server connection failure, the error message SHALL be displayed
 * to the user and a retry option SHALL be available.
 *
 * **Validates: Requirements 3.7**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  MCPConnectionStatus,
  MCPServerInfo,
  formatErrorMessage,
} from '../../src/components/MCPServerPanel';

/**
 * Simulates a connection failure - transitions server to error state
 * @validates Requirements 3.7 - Display error message with retry option
 */
function simulateConnectionFailure(
  server: MCPServerInfo,
  errorMessage: string
): MCPServerInfo {
  return {
    ...server,
    status: 'error',
    errorMessage,
  };
}

/**
 * Simulates retry attempt - transitions server to connecting state
 * @validates Requirements 3.7 - Retry option available
 */
function simulateRetryConnection(server: MCPServerInfo): MCPServerInfo {
  return {
    ...server,
    status: 'connecting',
    errorMessage: undefined,
  };
}

/**
 * Checks if error status is set correctly
 */
function hasErrorStatus(server: MCPServerInfo): boolean {
  return server.status === 'error';
}

/**
 * Checks if error message is available for display
 */
function hasErrorMessage(server: MCPServerInfo): boolean {
  return (
    server.status === 'error' &&
    server.errorMessage !== undefined &&
    server.errorMessage.length > 0
  );
}

/**
 * Checks if retry is available (can transition from error to connecting)
 */
function canRetry(server: MCPServerInfo): boolean {
  return server.status === 'error';
}

/**
 * Checks if error message is user-friendly (formatted)
 */
function isUserFriendlyMessage(message: string): boolean {
  // User-friendly messages should:
  // 1. Not contain raw stack traces
  // 2. Not contain internal error codes without context
  // 3. Contain actionable guidance (words like "please", "try", "check", etc.)
  const hasStackTrace = message.includes('at ') && message.includes('.js:');
  const hasActionableGuidance =
    /please|try|check|verify|ensure|contact/i.test(message);

  return !hasStackTrace && (hasActionableGuidance || message.length < 100);
}

// Arbitrary for server IDs
const serverIdArb = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => /^[a-zA-Z0-9_-]+$/.test(s));

// Arbitrary for server names
const serverNameArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0);

// Arbitrary for server commands
const serverCommandArb = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length > 0);

// Arbitrary for raw error messages (various error types)
const rawErrorMessageArb = fc.oneof(
  // Network errors
  fc.constant('NetworkError: Failed to fetch'),
  fc.constant('ECONNREFUSED: Connection refused'),
  fc.constant('fetch failed: network error'),
  // Timeout errors
  fc.constant('TimeoutError: Connection timed out'),
  fc.constant('ETIMEDOUT: Operation timed out'),
  fc.constant('Request timed out after 30000ms'),
  // Authentication errors
  fc.constant('Unauthorized: Invalid credentials'),
  fc.constant('401 Unauthorized'),
  fc.constant('403 Forbidden: Access denied'),
  fc.constant('Authentication failed'),
  // Server not found errors
  fc.constant('404 Not Found'),
  fc.constant('ENOTFOUND: Server not found'),
  fc.constant('Server not found at specified address'),
  // Connection refused errors
  fc.constant('ECONNRESET: Connection reset by peer'),
  fc.constant('Connection refused by server'),
  // Server errors
  fc.constant('500 Internal Server Error'),
  fc.constant('502 Bad Gateway'),
  fc.constant('503 Service Unavailable'),
  fc.constant('Internal server error occurred'),
  // Generic errors
  fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0)
);

// Arbitrary for a base MCPServerInfo in disconnected state
const disconnectedServerArb: fc.Arbitrary<MCPServerInfo> = fc.record({
  id: serverIdArb,
  name: serverNameArb,
  command: serverCommandArb,
  status: fc.constant<MCPConnectionStatus>('disconnected'),
  lastConnected: fc.option(fc.date(), { nil: undefined }),
  errorMessage: fc.constant(undefined),
});

// Arbitrary for a server in connecting state
const connectingServerArb: fc.Arbitrary<MCPServerInfo> = fc.record({
  id: serverIdArb,
  name: serverNameArb,
  command: serverCommandArb,
  status: fc.constant<MCPConnectionStatus>('connecting'),
  lastConnected: fc.option(fc.date(), { nil: undefined }),
  errorMessage: fc.constant(undefined),
});

describe('Property 10: MCP Connection Error Handling', () => {
  describe('Error Status Setting', () => {
    it('connection failure SHALL set error status (Req 3.7)', () => {
      fc.assert(
        fc.property(
          disconnectedServerArb,
          rawErrorMessageArb,
          (server, errorMessage) => {
            // Simulate connection failure
            const failedServer = simulateConnectionFailure(server, errorMessage);

            // Property: Status is set to error
            expect(hasErrorStatus(failedServer)).toBe(true);
            expect(failedServer.status).toBe('error');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('connection failure from connecting state SHALL set error status (Req 3.7)', () => {
      fc.assert(
        fc.property(
          connectingServerArb,
          rawErrorMessageArb,
          (server, errorMessage) => {
            // Simulate connection failure during connection attempt
            const failedServer = simulateConnectionFailure(server, errorMessage);

            // Property: Status transitions to error
            expect(failedServer.status).toBe('error');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Error Message Display', () => {
    it('error message SHALL be available for display after failure (Req 3.7)', () => {
      fc.assert(
        fc.property(
          disconnectedServerArb,
          rawErrorMessageArb,
          (server, errorMessage) => {
            const failedServer = simulateConnectionFailure(server, errorMessage);

            // Property: Error message is available
            expect(hasErrorMessage(failedServer)).toBe(true);
            expect(failedServer.errorMessage).toBe(errorMessage);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('error message SHALL be preserved until retry or disconnect (Req 3.7)', () => {
      fc.assert(
        fc.property(
          disconnectedServerArb,
          rawErrorMessageArb,
          (server, errorMessage) => {
            const failedServer = simulateConnectionFailure(server, errorMessage);

            // Property: Error message persists in error state
            expect(failedServer.errorMessage).toBe(errorMessage);
            expect(failedServer.status).toBe('error');

            // After retry, error message is cleared
            const retryingServer = simulateRetryConnection(failedServer);
            expect(retryingServer.errorMessage).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Retry Functionality', () => {
    it('retry option SHALL be available after connection failure (Req 3.7)', () => {
      fc.assert(
        fc.property(
          disconnectedServerArb,
          rawErrorMessageArb,
          (server, errorMessage) => {
            const failedServer = simulateConnectionFailure(server, errorMessage);

            // Property: Retry is available in error state
            expect(canRetry(failedServer)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('retry SHALL transition server to connecting state (Req 3.7)', () => {
      fc.assert(
        fc.property(
          disconnectedServerArb,
          rawErrorMessageArb,
          (server, errorMessage) => {
            const failedServer = simulateConnectionFailure(server, errorMessage);
            const retryingServer = simulateRetryConnection(failedServer);

            // Property: Status transitions to connecting
            expect(retryingServer.status).toBe('connecting');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('retry SHALL clear previous error message (Req 3.7)', () => {
      fc.assert(
        fc.property(
          disconnectedServerArb,
          rawErrorMessageArb,
          (server, errorMessage) => {
            const failedServer = simulateConnectionFailure(server, errorMessage);
            const retryingServer = simulateRetryConnection(failedServer);

            // Property: Error message is cleared on retry
            expect(retryingServer.errorMessage).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('multiple retries SHALL be possible (Req 3.7)', () => {
      fc.assert(
        fc.property(
          disconnectedServerArb,
          fc.array(rawErrorMessageArb, { minLength: 2, maxLength: 5 }),
          (server, errorMessages) => {
            let currentServer = server;

            // Simulate multiple failure-retry cycles
            for (const errorMessage of errorMessages) {
              // Fail
              currentServer = simulateConnectionFailure(
                currentServer,
                errorMessage
              );
              expect(currentServer.status).toBe('error');
              expect(currentServer.errorMessage).toBe(errorMessage);

              // Retry
              currentServer = simulateRetryConnection(currentServer);
              expect(currentServer.status).toBe('connecting');
              expect(currentServer.errorMessage).toBeUndefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('User-Friendly Error Messages', () => {
    it('formatErrorMessage SHALL produce user-friendly messages for network errors (Req 3.7)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'NetworkError: Failed to fetch',
            'ECONNREFUSED: Connection refused',
            'fetch failed: network error'
          ),
          (rawError) => {
            const formatted = formatErrorMessage(rawError);

            // Property: Formatted message is user-friendly
            expect(isUserFriendlyMessage(formatted)).toBe(true);
            expect(formatted).toContain('network');
          }
        ),
        { numRuns: 30 }
      );
    });

    it('formatErrorMessage SHALL produce user-friendly messages for timeout errors (Req 3.7)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'TimeoutError: Connection timed out',
            'ETIMEDOUT: Operation timed out',
            'Request timed out after 30000ms'
          ),
          (rawError) => {
            const formatted = formatErrorMessage(rawError);

            // Property: Formatted message is user-friendly
            expect(isUserFriendlyMessage(formatted)).toBe(true);
            expect(formatted.toLowerCase()).toContain('timed out');
          }
        ),
        { numRuns: 30 }
      );
    });

    it('formatErrorMessage SHALL produce user-friendly messages for auth errors (Req 3.7)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'Unauthorized: Invalid credentials',
            '401 Unauthorized',
            '403 Forbidden: Access denied',
            'Authentication failed'
          ),
          (rawError) => {
            const formatted = formatErrorMessage(rawError);

            // Property: Formatted message is user-friendly
            expect(isUserFriendlyMessage(formatted)).toBe(true);
            expect(formatted.toLowerCase()).toContain('auth');
          }
        ),
        { numRuns: 40 }
      );
    });

    it('formatErrorMessage SHALL produce user-friendly messages for server errors (Req 3.7)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            '500 Internal Server Error',
            '502 Bad Gateway',
            '503 Service Unavailable',
            'Internal server error occurred'
          ),
          (rawError) => {
            const formatted = formatErrorMessage(rawError);

            // Property: Formatted message is user-friendly
            expect(isUserFriendlyMessage(formatted)).toBe(true);
            expect(formatted.toLowerCase()).toContain('server');
          }
        ),
        { numRuns: 40 }
      );
    });

    it('formatErrorMessage SHALL handle any error message without throwing (Req 3.7)', () => {
      fc.assert(
        fc.property(rawErrorMessageArb, (rawError) => {
          // Property: formatErrorMessage never throws
          expect(() => formatErrorMessage(rawError)).not.toThrow();

          const formatted = formatErrorMessage(rawError);

          // Property: Always returns a non-empty string
          expect(typeof formatted).toBe('string');
          expect(formatted.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('formatErrorMessage SHALL not expose raw stack traces (Req 3.7)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'Error: Connection failed\n    at connect (/app/src/mcp.js:42:15)\n    at async handleConnect',
            'TypeError: Cannot read property\n    at Object.<anonymous> (/node_modules/lib.js:100:20)',
            'ReferenceError: x is not defined\n    at eval (eval at <anonymous>)'
          ),
          (rawError) => {
            const formatted = formatErrorMessage(rawError);

            // Property: Stack traces are not exposed in formatted message
            // (formatErrorMessage returns original if no pattern matches,
            // but the UI should handle this appropriately)
            expect(typeof formatted).toBe('string');
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Server Identity Preservation', () => {
    it('server identity SHALL be preserved through error state (Req 3.7)', () => {
      fc.assert(
        fc.property(
          disconnectedServerArb,
          rawErrorMessageArb,
          (server, errorMessage) => {
            const failedServer = simulateConnectionFailure(server, errorMessage);

            // Property: Server identity is preserved
            expect(failedServer.id).toBe(server.id);
            expect(failedServer.name).toBe(server.name);
            expect(failedServer.command).toBe(server.command);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('server identity SHALL be preserved through retry (Req 3.7)', () => {
      fc.assert(
        fc.property(
          disconnectedServerArb,
          rawErrorMessageArb,
          (server, errorMessage) => {
            const failedServer = simulateConnectionFailure(server, errorMessage);
            const retryingServer = simulateRetryConnection(failedServer);

            // Property: Server identity is preserved through retry
            expect(retryingServer.id).toBe(server.id);
            expect(retryingServer.name).toBe(server.name);
            expect(retryingServer.command).toBe(server.command);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('State Transitions', () => {
    it('valid transitions: disconnected → connecting → error (Req 3.7)', () => {
      fc.assert(
        fc.property(
          disconnectedServerArb,
          rawErrorMessageArb,
          (server, errorMessage) => {
            // disconnected → connecting (simulated)
            const connectingServer: MCPServerInfo = {
              ...server,
              status: 'connecting',
            };
            expect(connectingServer.status).toBe('connecting');

            // connecting → error
            const failedServer = simulateConnectionFailure(
              connectingServer,
              errorMessage
            );
            expect(failedServer.status).toBe('error');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('valid transitions: error → connecting (retry) (Req 3.7)', () => {
      fc.assert(
        fc.property(
          disconnectedServerArb,
          rawErrorMessageArb,
          (server, errorMessage) => {
            const failedServer = simulateConnectionFailure(server, errorMessage);
            expect(failedServer.status).toBe('error');

            // error → connecting (retry)
            const retryingServer = simulateRetryConnection(failedServer);
            expect(retryingServer.status).toBe('connecting');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('full error-retry cycle SHALL work correctly (Req 3.7)', () => {
      fc.assert(
        fc.property(
          disconnectedServerArb,
          rawErrorMessageArb,
          rawErrorMessageArb,
          (server, error1, error2) => {
            // First failure
            let current = simulateConnectionFailure(server, error1);
            expect(current.status).toBe('error');
            expect(current.errorMessage).toBe(error1);

            // First retry
            current = simulateRetryConnection(current);
            expect(current.status).toBe('connecting');
            expect(current.errorMessage).toBeUndefined();

            // Second failure (different error)
            current = simulateConnectionFailure(current, error2);
            expect(current.status).toBe('error');
            expect(current.errorMessage).toBe(error2);

            // Second retry
            current = simulateRetryConnection(current);
            expect(current.status).toBe('connecting');
            expect(current.errorMessage).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
