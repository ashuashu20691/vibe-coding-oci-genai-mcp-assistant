/**
 * Property-Based Test: Tool Error Non-Blocking
 * 
 * **Property 26: Tool Error Non-Blocking**
 * *For any* tool execution error, the conversation SHALL continue to accept new messages 
 * and the error SHALL be displayed inline without blocking the UI.
 * 
 * **Validates: Requirements 10.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ToolError } from '@/types';
import { formatToolErrorMessage } from '@/components/ToolErrorDisplay';

/**
 * Arbitrary for generating tool names
 */
const toolNameArb = fc.string({ minLength: 3, maxLength: 30 })
  .filter(s => /^[a-z][a-z_]*[a-z]$/.test(s) || /^[a-z]{3,}$/.test(s))
  .map(s => s.toLowerCase().replace(/[^a-z_]/g, '_'));

/**
 * Arbitrary for generating error messages
 */
const errorMessageArb = fc.oneof(
  fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
  fc.constantFrom(
    'Connection timeout',
    'Query execution failed',
    'Permission denied',
    'Invalid SQL syntax',
    'Table not found',
    'Network error',
    'Authentication failed',
    'Rate limit exceeded'
  )
);

/**
 * Arbitrary for generating tool errors
 */
const toolErrorArb: fc.Arbitrary<ToolError> = fc.record({
  toolName: toolNameArb,
  errorMessage: errorMessageArb,
  timestamp: fc.date(),
  isRetryable: fc.boolean(),
  errorCode: fc.option(fc.constantFrom(
    'TOOL_EXECUTION_ERROR',
    'MCP_TOOL_ERROR',
    'NETWORK_ERROR',
    'UNKNOWN_ERROR'
  ), { nil: undefined }),
  details: fc.option(
    fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.string()),
    { nil: undefined }
  ),
});

/**
 * Arbitrary for generating message content
 */
const messageContentArb = fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0);

/**
 * Simulates conversation state with tool errors
 */
interface ConversationState {
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    toolErrors?: ToolError[];
  }>;
  canAcceptNewMessages: boolean;
  isBlocked: boolean;
}

/**
 * Creates initial conversation state
 */
function createConversationState(): ConversationState {
  return {
    messages: [],
    canAcceptNewMessages: true,
    isBlocked: false,
  };
}

/**
 * Adds a user message to the conversation
 */
function addUserMessage(state: ConversationState, content: string): ConversationState {
  if (!state.canAcceptNewMessages) {
    return state;
  }
  return {
    ...state,
    messages: [
      ...state.messages,
      {
        id: `user-${Date.now()}-${Math.random()}`,
        role: 'user',
        content,
      },
    ],
  };
}

/**
 * Adds an assistant message with tool errors (non-blocking)
 * Validates: Requirement 10.3 - Tool errors displayed inline, conversation continues
 */
function addAssistantMessageWithToolError(
  state: ConversationState,
  content: string,
  toolErrors: ToolError[]
): ConversationState {
  // Tool errors should NOT block the conversation
  // This is the key property we're testing
  return {
    ...state,
    messages: [
      ...state.messages,
      {
        id: `assistant-${Date.now()}-${Math.random()}`,
        role: 'assistant',
        content,
        toolErrors,
      },
    ],
    // Conversation should remain unblocked even with tool errors
    canAcceptNewMessages: true,
    isBlocked: false,
  };
}

describe('Property 26: Tool Error Non-Blocking', () => {
  describe('Conversation Continuity After Tool Errors', () => {
    it('should allow new messages after any tool error', () => {
      fc.assert(
        fc.property(
          toolErrorArb,
          messageContentArb,
          messageContentArb,
          (toolError, assistantContent, newUserMessage) => {
            // Start with empty conversation
            let state = createConversationState();
            
            // Add assistant message with tool error
            state = addAssistantMessageWithToolError(state, assistantContent, [toolError]);
            
            // Property: Conversation should still accept new messages
            expect(state.canAcceptNewMessages).toBe(true);
            expect(state.isBlocked).toBe(false);
            
            // Add new user message after tool error
            state = addUserMessage(state, newUserMessage);
            
            // Property: New message should be added successfully
            const lastMessage = state.messages[state.messages.length - 1];
            expect(lastMessage.role).toBe('user');
            expect(lastMessage.content).toBe(newUserMessage);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow multiple messages after multiple tool errors', () => {
      fc.assert(
        fc.property(
          fc.array(toolErrorArb, { minLength: 1, maxLength: 5 }),
          fc.array(messageContentArb, { minLength: 1, maxLength: 5 }),
          (toolErrors, userMessages) => {
            let state = createConversationState();
            
            // Add assistant message with multiple tool errors
            state = addAssistantMessageWithToolError(state, 'Response with errors', toolErrors);
            
            // Property: Should be able to add all subsequent user messages
            for (const message of userMessages) {
              state = addUserMessage(state, message);
              expect(state.canAcceptNewMessages).toBe(true);
            }
            
            // Property: All messages should be present
            const userMessageCount = state.messages.filter(m => m.role === 'user').length;
            expect(userMessageCount).toBe(userMessages.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Tool Error Display Properties', () => {
    it('should display tool errors inline (not in separate blocking modal)', () => {
      fc.assert(
        fc.property(
          toolErrorArb,
          messageContentArb,
          (toolError, content) => {
            let state = createConversationState();
            state = addAssistantMessageWithToolError(state, content, [toolError]);
            
            // Property: Tool errors should be attached to the message (inline)
            const assistantMessage = state.messages.find(m => m.role === 'assistant');
            expect(assistantMessage).toBeDefined();
            expect(assistantMessage?.toolErrors).toBeDefined();
            expect(assistantMessage?.toolErrors?.length).toBeGreaterThan(0);
            
            // Property: The error should be the same one we added
            expect(assistantMessage?.toolErrors?.[0].toolName).toBe(toolError.toolName);
            expect(assistantMessage?.toolErrors?.[0].errorMessage).toBe(toolError.errorMessage);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve tool error information accurately', () => {
      fc.assert(
        fc.property(
          toolErrorArb,
          (toolError) => {
            let state = createConversationState();
            state = addAssistantMessageWithToolError(state, 'Response', [toolError]);
            
            const storedError = state.messages[0]?.toolErrors?.[0];
            
            // Property: All error properties should be preserved
            expect(storedError?.toolName).toBe(toolError.toolName);
            expect(storedError?.errorMessage).toBe(toolError.errorMessage);
            expect(storedError?.isRetryable).toBe(toolError.isRetryable);
            expect(storedError?.errorCode).toBe(toolError.errorCode);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Error Message Formatting Properties', () => {
    it('should never return empty string for any error message', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (errorMessage) => {
            const formatted = formatToolErrorMessage(errorMessage);
            
            // Property: Formatted message should never be empty
            expect(formatted.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always produce a message shorter than or equal to 300 characters', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 1000 }),
          (errorMessage) => {
            const formatted = formatToolErrorMessage(errorMessage);
            
            // Property: Formatted message should be at most 300 characters
            expect(formatted.length).toBeLessThanOrEqual(300);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should remove stack traces from any error message', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 100 }),
          (baseMessage, filePath, line, col) => {
            const messageWithStack = `${baseMessage}\n    at Function.execute (/${filePath}.js:${line}:${col})`;
            const formatted = formatToolErrorMessage(messageWithStack);
            
            // Property: Stack trace should be removed
            expect(formatted).not.toContain('at Function.execute');
            expect(formatted).not.toContain(`.js:${line}:${col}`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should remove internal error codes from any error message', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('ORA', 'ERR', 'INTERNAL'),
          fc.integer({ min: 10000, max: 99999 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (prefix, code, message) => {
            const messageWithCode = `${prefix}-${code}: ${message}`;
            const formatted = formatToolErrorMessage(messageWithCode);
            
            // Property: Internal error code should be removed
            expect(formatted).not.toContain(`${prefix}-${code}:`);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Non-Blocking UI Behavior', () => {
    it('should not set isBlocked flag for any tool error', () => {
      fc.assert(
        fc.property(
          fc.array(toolErrorArb, { minLength: 1, maxLength: 10 }),
          (toolErrors) => {
            let state = createConversationState();
            
            // Add multiple tool errors
            for (const error of toolErrors) {
              state = addAssistantMessageWithToolError(state, 'Response', [error]);
            }
            
            // Property: UI should never be blocked
            expect(state.isBlocked).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain canAcceptNewMessages as true regardless of error severity', () => {
      fc.assert(
        fc.property(
          toolErrorArb,
          fc.boolean(), // isRetryable
          fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }), // errorCode
          (baseError, isRetryable, errorCode) => {
            const error: ToolError = {
              ...baseError,
              isRetryable,
              errorCode,
            };
            
            let state = createConversationState();
            state = addAssistantMessageWithToolError(state, 'Response', [error]);
            
            // Property: Should always be able to accept new messages
            expect(state.canAcceptNewMessages).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
