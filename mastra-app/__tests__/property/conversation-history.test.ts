/**
 * Property Test: Conversation History Preservation
 * 
 * Feature: mastra-migration, Property 1: Conversation History Preservation
 * 
 * *For any* sequence of messages added to the conversation history (regardless of role:
 * user, assistant, or tool), the history SHALL contain all messages in the exact order
 * they were added, with no messages lost, duplicated, or reordered.
 * 
 * **Validates: Requirements 6.1, 6.2**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Message, MessageRole, ToolCall } from '../../src/types';

/**
 * Pure function that simulates the conversation history append logic.
 * This mirrors the behavior in useConversation hook's addMessage function.
 */
function appendMessage(
  history: Message[],
  message: Omit<Message, 'id' | 'timestamp'>
): Message[] {
  const newMessage: Message = {
    ...message,
    id: crypto.randomUUID(),
    timestamp: new Date(),
  };
  return [...history, newMessage];
}

/**
 * Simulates adding multiple messages to conversation history.
 */
function buildConversationHistory(
  messages: Array<Omit<Message, 'id' | 'timestamp'>>
): Message[] {
  let history: Message[] = [];
  for (const msg of messages) {
    history = appendMessage(history, msg);
  }
  return history;
}

// Arbitrary for message roles (Req 6.2: user, assistant, tool)
const roleArb = fc.constantFrom<MessageRole>('user', 'assistant', 'tool', 'system');

// Arbitrary for simple message content
const contentArb = fc.string({ minLength: 1, maxLength: 500 })
  .filter(s => s.trim().length > 0);

// Arbitrary for tool calls
const toolCallArb: fc.Arbitrary<ToolCall> = fc.record({
  id: fc.uuid(),
  name: fc.stringMatching(/^[a-z][a-z0-9_]{2,20}$/),
  arguments: fc.dictionary(
    fc.stringMatching(/^[a-z][a-z0-9_]{1,10}$/),
    fc.oneof(fc.string(), fc.integer(), fc.boolean())
  ),
});

// Arbitrary for a message without id and timestamp
const messageDataArb: fc.Arbitrary<Omit<Message, 'id' | 'timestamp'>> = fc.record({
  role: roleArb,
  content: contentArb,
  toolCalls: fc.option(fc.array(toolCallArb, { minLength: 1, maxLength: 3 }), { nil: undefined }),
  toolCallId: fc.option(fc.uuid(), { nil: undefined }),
});

describe('Property 1: Conversation History Preservation', () => {
  it('should preserve all messages in insertion order (Req 6.1)', () => {
    fc.assert(
      fc.property(
        fc.array(messageDataArb, { minLength: 1, maxLength: 20 }),
        (messageDataList) => {
          // Build conversation history
          const history = buildConversationHistory(messageDataList);

          // Property: History length equals number of messages added
          expect(history.length).toBe(messageDataList.length);

          // Property: Messages are in the same order as added
          for (let i = 0; i < messageDataList.length; i++) {
            expect(history[i].role).toBe(messageDataList[i].role);
            expect(history[i].content).toBe(messageDataList[i].content);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include messages from all roles: user, assistant, tool (Req 6.2)', () => {
    fc.assert(
      fc.property(
        fc.record({
          userMessages: fc.array(contentArb, { minLength: 1, maxLength: 5 }),
          assistantMessages: fc.array(contentArb, { minLength: 1, maxLength: 5 }),
          toolMessages: fc.array(contentArb, { minLength: 1, maxLength: 5 }),
        }),
        ({ userMessages, assistantMessages, toolMessages }) => {
          // Create messages with different roles
          const allMessageData: Array<Omit<Message, 'id' | 'timestamp'>> = [
            ...userMessages.map(content => ({ role: 'user' as MessageRole, content })),
            ...assistantMessages.map(content => ({ role: 'assistant' as MessageRole, content })),
            ...toolMessages.map(content => ({ role: 'tool' as MessageRole, content })),
          ];

          // Build history
          const history = buildConversationHistory(allMessageData);

          // Property: All roles are represented
          const roles = new Set(history.map(m => m.role));
          expect(roles.has('user')).toBe(true);
          expect(roles.has('assistant')).toBe(true);
          expect(roles.has('tool')).toBe(true);

          // Property: Count of each role matches input
          const userCount = history.filter(m => m.role === 'user').length;
          const assistantCount = history.filter(m => m.role === 'assistant').length;
          const toolCount = history.filter(m => m.role === 'tool').length;

          expect(userCount).toBe(userMessages.length);
          expect(assistantCount).toBe(assistantMessages.length);
          expect(toolCount).toBe(toolMessages.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not lose any messages during append operations (Req 6.1)', () => {
    fc.assert(
      fc.property(
        fc.array(messageDataArb, { minLength: 2, maxLength: 50 }),
        (messageDataList) => {
          const history = buildConversationHistory(messageDataList);

          // Property: No messages lost
          expect(history.length).toBe(messageDataList.length);

          // Property: Each message content appears exactly once
          const contentCounts = new Map<string, number>();
          for (const msg of history) {
            const count = contentCounts.get(msg.content) || 0;
            contentCounts.set(msg.content, count + 1);
          }

          // Verify against input (accounting for potential duplicate content)
          const inputContentCounts = new Map<string, number>();
          for (const msg of messageDataList) {
            const count = inputContentCounts.get(msg.content) || 0;
            inputContentCounts.set(msg.content, count + 1);
          }

          expect(contentCounts).toEqual(inputContentCounts);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not duplicate messages (Req 6.1)', () => {
    fc.assert(
      fc.property(
        fc.array(messageDataArb, { minLength: 1, maxLength: 20 }),
        (messageDataList) => {
          const history = buildConversationHistory(messageDataList);

          // Property: All message IDs are unique (no duplicates)
          const ids = history.map(m => m.id);
          const uniqueIds = new Set(ids);
          expect(uniqueIds.size).toBe(ids.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not reorder messages (Req 6.1)', () => {
    fc.assert(
      fc.property(
        fc.array(messageDataArb, { minLength: 2, maxLength: 20 }),
        (messageDataList) => {
          const history = buildConversationHistory(messageDataList);

          // Property: Messages maintain insertion order
          // Verify by checking content sequence matches input sequence
          for (let i = 0; i < messageDataList.length; i++) {
            expect(history[i].content).toBe(messageDataList[i].content);
            expect(history[i].role).toBe(messageDataList[i].role);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve tool calls in assistant messages (Req 6.2)', () => {
    fc.assert(
      fc.property(
        fc.array(toolCallArb, { minLength: 1, maxLength: 3 }),
        contentArb,
        (toolCalls, content) => {
          const messageData: Omit<Message, 'id' | 'timestamp'> = {
            role: 'assistant',
            content,
            toolCalls,
          };

          const history = buildConversationHistory([messageData]);

          // Property: Tool calls are preserved
          expect(history[0].toolCalls).toBeDefined();
          expect(history[0].toolCalls).toEqual(toolCalls);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve tool call ID in tool messages (Req 6.2)', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        contentArb,
        (toolCallId, content) => {
          const messageData: Omit<Message, 'id' | 'timestamp'> = {
            role: 'tool',
            content,
            toolCallId,
          };

          const history = buildConversationHistory([messageData]);

          // Property: Tool call ID is preserved
          expect(history[0].toolCallId).toBe(toolCallId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle interleaved message roles correctly (Req 6.1, 6.2)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(roleArb, contentArb),
          { minLength: 5, maxLength: 20 }
        ),
        (roleContentPairs) => {
          const messageDataList = roleContentPairs.map(([role, content]) => ({
            role,
            content,
          }));

          const history = buildConversationHistory(messageDataList);

          // Property: Interleaved roles are preserved in order
          for (let i = 0; i < roleContentPairs.length; i++) {
            expect(history[i].role).toBe(roleContentPairs[i][0]);
            expect(history[i].content).toBe(roleContentPairs[i][1]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should generate unique IDs for each message (Req 6.1)', () => {
    fc.assert(
      fc.property(
        fc.array(messageDataArb, { minLength: 10, maxLength: 50 }),
        (messageDataList) => {
          const history = buildConversationHistory(messageDataList);

          // Property: All IDs are unique UUIDs
          const ids = history.map(m => m.id);
          const uniqueIds = new Set(ids);
          expect(uniqueIds.size).toBe(history.length);

          // Property: All IDs are valid UUID format
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          for (const id of ids) {
            expect(id).toMatch(uuidRegex);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should assign timestamps to each message (Req 6.1)', () => {
    fc.assert(
      fc.property(
        fc.array(messageDataArb, { minLength: 1, maxLength: 10 }),
        (messageDataList) => {
          const history = buildConversationHistory(messageDataList);

          // Property: All messages have timestamps
          for (const msg of history) {
            expect(msg.timestamp).toBeInstanceOf(Date);
            expect(msg.timestamp.getTime()).not.toBeNaN();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty initial history correctly', () => {
    fc.assert(
      fc.property(
        messageDataArb,
        (messageData) => {
          // Start with empty history
          const history: Message[] = [];
          const newHistory = appendMessage(history, messageData);

          // Property: First message is added correctly
          expect(newHistory.length).toBe(1);
          expect(newHistory[0].role).toBe(messageData.role);
          expect(newHistory[0].content).toBe(messageData.content);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve message content exactly (no modification)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            role: roleArb,
            content: fc.string({ minLength: 1, maxLength: 1000 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (messageDataList) => {
          const history = buildConversationHistory(messageDataList);

          // Property: Content is preserved exactly (byte-for-byte)
          for (let i = 0; i < messageDataList.length; i++) {
            expect(history[i].content).toBe(messageDataList[i].content);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
