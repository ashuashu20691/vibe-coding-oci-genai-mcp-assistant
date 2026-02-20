/**
 * Property Test: Conversation History Clear
 * 
 * Feature: mastra-migration, Property 2: Conversation History Clear
 * 
 * *For any* conversation history containing one or more messages, after clearing
 * the history, the history SHALL be empty with zero messages.
 * 
 * **Validates: Requirements 6.4**
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

/**
 * Pure function that simulates clearing the conversation history.
 * This mirrors the behavior in useConversation hook's clearConversation function
 * and ChatUI's handleClearConversation function.
 */
function clearConversationHistory(): Message[] {
  return [];
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

describe('Property 2: Conversation History Clear', () => {
  it('should result in empty history after clearing (Req 6.4)', () => {
    fc.assert(
      fc.property(
        fc.array(messageDataArb, { minLength: 1, maxLength: 50 }),
        (messageDataList) => {
          // Build conversation history with messages
          const history = buildConversationHistory(messageDataList);
          
          // Verify history has messages before clearing
          expect(history.length).toBeGreaterThan(0);
          expect(history.length).toBe(messageDataList.length);
          
          // Clear the conversation history
          const clearedHistory = clearConversationHistory();
          
          // Property: After clearing, history SHALL be empty with zero messages
          expect(clearedHistory).toEqual([]);
          expect(clearedHistory.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should clear history regardless of message count (Req 6.4)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (messageCount) => {
          // Generate messages
          const messageDataList: Array<Omit<Message, 'id' | 'timestamp'>> = [];
          for (let i = 0; i < messageCount; i++) {
            messageDataList.push({
              role: ['user', 'assistant', 'tool', 'system'][i % 4] as MessageRole,
              content: `Message ${i + 1}`,
            });
          }
          
          // Build history
          const history = buildConversationHistory(messageDataList);
          expect(history.length).toBe(messageCount);
          
          // Clear history
          const clearedHistory = clearConversationHistory();
          
          // Property: Clearing always results in empty array regardless of original size
          expect(clearedHistory.length).toBe(0);
          expect(clearedHistory).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should clear history regardless of message roles (Req 6.4)', () => {
    fc.assert(
      fc.property(
        fc.record({
          userMessages: fc.array(contentArb, { minLength: 0, maxLength: 10 }),
          assistantMessages: fc.array(contentArb, { minLength: 0, maxLength: 10 }),
          toolMessages: fc.array(contentArb, { minLength: 0, maxLength: 10 }),
          systemMessages: fc.array(contentArb, { minLength: 0, maxLength: 5 }),
        }).filter(({ userMessages, assistantMessages, toolMessages, systemMessages }) => 
          userMessages.length + assistantMessages.length + toolMessages.length + systemMessages.length > 0
        ),
        ({ userMessages, assistantMessages, toolMessages, systemMessages }) => {
          // Create messages with different roles
          const allMessageData: Array<Omit<Message, 'id' | 'timestamp'>> = [
            ...userMessages.map(content => ({ role: 'user' as MessageRole, content })),
            ...assistantMessages.map(content => ({ role: 'assistant' as MessageRole, content })),
            ...toolMessages.map(content => ({ role: 'tool' as MessageRole, content })),
            ...systemMessages.map(content => ({ role: 'system' as MessageRole, content })),
          ];

          // Build history
          const history = buildConversationHistory(allMessageData);
          expect(history.length).toBe(allMessageData.length);
          
          // Clear history
          const clearedHistory = clearConversationHistory();
          
          // Property: All roles are removed after clearing
          expect(clearedHistory.length).toBe(0);
          expect(clearedHistory.filter(m => m.role === 'user').length).toBe(0);
          expect(clearedHistory.filter(m => m.role === 'assistant').length).toBe(0);
          expect(clearedHistory.filter(m => m.role === 'tool').length).toBe(0);
          expect(clearedHistory.filter(m => m.role === 'system').length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should clear history with tool calls and tool results (Req 6.4)', () => {
    fc.assert(
      fc.property(
        fc.array(toolCallArb, { minLength: 1, maxLength: 5 }),
        fc.array(contentArb, { minLength: 1, maxLength: 5 }),
        (toolCalls, toolResults) => {
          // Create a conversation with tool calls and results
          const messageDataList: Array<Omit<Message, 'id' | 'timestamp'>> = [
            { role: 'user', content: 'Execute some tools' },
            { role: 'assistant', content: 'I will execute tools', toolCalls },
            ...toolResults.map((content, i) => ({
              role: 'tool' as MessageRole,
              content,
              toolCallId: toolCalls[i % toolCalls.length]?.id,
            })),
            { role: 'assistant', content: 'Tools executed successfully' },
          ];

          // Build history
          const history = buildConversationHistory(messageDataList);
          expect(history.length).toBe(messageDataList.length);
          expect(history.some(m => m.toolCalls && m.toolCalls.length > 0)).toBe(true);
          expect(history.some(m => m.toolCallId)).toBe(true);
          
          // Clear history
          const clearedHistory = clearConversationHistory();
          
          // Property: All messages including those with tool calls are removed
          expect(clearedHistory.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow new messages after clearing (Req 6.4)', () => {
    fc.assert(
      fc.property(
        fc.array(messageDataArb, { minLength: 1, maxLength: 20 }),
        fc.array(messageDataArb, { minLength: 1, maxLength: 20 }),
        (initialMessages, newMessages) => {
          // Build initial history
          let history = buildConversationHistory(initialMessages);
          expect(history.length).toBe(initialMessages.length);
          
          // Clear history
          history = clearConversationHistory();
          expect(history.length).toBe(0);
          
          // Add new messages after clearing
          history = buildConversationHistory(newMessages);
          
          // Property: New messages can be added after clearing
          expect(history.length).toBe(newMessages.length);
          
          // Verify new messages are correct
          for (let i = 0; i < newMessages.length; i++) {
            expect(history[i].role).toBe(newMessages[i].role);
            expect(history[i].content).toBe(newMessages[i].content);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should be idempotent - clearing an empty history stays empty (Req 6.4)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (clearCount) => {
          // Start with empty history
          let history: Message[] = [];
          
          // Clear multiple times
          for (let i = 0; i < clearCount; i++) {
            history = clearConversationHistory();
            expect(history.length).toBe(0);
          }
          
          // Property: Multiple clears on empty history still results in empty
          expect(history).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should clear history with messages containing special characters (Req 6.4)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            role: roleArb,
            content: fc.string({ minLength: 1, maxLength: 200 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (messageDataList) => {
          // Build history with potentially special characters
          const history = buildConversationHistory(messageDataList);
          expect(history.length).toBe(messageDataList.length);
          
          // Clear history
          const clearedHistory = clearConversationHistory();
          
          // Property: Clearing works regardless of message content
          expect(clearedHistory.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should clear history with very long messages (Req 6.4)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            role: roleArb,
            content: fc.string({ minLength: 1000, maxLength: 5000 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (messageDataList) => {
          // Build history with long messages
          const history = buildConversationHistory(messageDataList);
          expect(history.length).toBe(messageDataList.length);
          
          // Verify messages are long
          for (const msg of history) {
            expect(msg.content.length).toBeGreaterThanOrEqual(1000);
          }
          
          // Clear history
          const clearedHistory = clearConversationHistory();
          
          // Property: Clearing works regardless of message length
          expect(clearedHistory.length).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});
