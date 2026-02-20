/**
 * Property Test: Message Persistence via MCP Round-Trip
 * 
 * Feature: mastra-migration, Property 11: Message Persistence via MCP Round-Trip
 * 
 * *For any* message added to a conversation via the ConversationStore, executing a
 * SELECT query via MCP for that conversation's messages SHALL include the added
 * message with identical content, role, and timestamp.
 * 
 * **Validates: Requirements 7.2**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ConversationStore, MCPToolResult } from '../../src/db/conversation-store';
import { MCPClient } from '@mastra/mcp';
import { MessageRole, ToolCall } from '../../src/types';

/**
 * Mock MCP Client that simulates SQLcl MCP Server behavior.
 * Stores conversations and messages in memory and responds to SQL queries.
 */
class MockMCPClient {
  private conversations: Map<string, {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
  }> = new Map();
  
  private messages: Map<string, {
    id: string;
    conversation_id: string;
    role: string;
    content: string;
    tool_calls: string | null;
    tool_call_id: string | null;
    created_at: string;
  }> = new Map();
  
  private connected = false;
  private toolsets: Record<string, unknown> | null = null;

  async listToolsets(): Promise<Record<string, unknown>> {
    if (!this.toolsets) {
      this.toolsets = {
        'sqlcl.connect': {
          execute: async (args: { connection_name: string }) => {
            this.connected = true;
            return { content: `Connected to ${args.connection_name}`, isError: false };
          }
        },
        'sqlcl.run-sql': {
          execute: async (args: { sql: string }) => {
            return this.executeSql(args.sql);
          }
        }
      };
    }
    return this.toolsets;
  }

  private executeSql(sql: string): MCPToolResult {
    const normalizedSql = sql.trim().toUpperCase();
    
    // Handle INSERT INTO conversations
    if (normalizedSql.startsWith('INSERT INTO CONVERSATIONS')) {
      return this.handleConversationInsert(sql);
    }
    
    // Handle INSERT INTO messages
    if (normalizedSql.startsWith('INSERT INTO MESSAGES')) {
      return this.handleMessageInsert(sql);
    }
    
    // Handle UPDATE conversations
    if (normalizedSql.startsWith('UPDATE CONVERSATIONS')) {
      return this.handleConversationUpdate(sql);
    }
    
    // Handle SELECT from messages
    if (normalizedSql.startsWith('SELECT') && normalizedSql.includes('FROM MESSAGES')) {
      return this.handleMessageSelect(sql);
    }
    
    // Handle SELECT from conversations
    if (normalizedSql.startsWith('SELECT') && normalizedSql.includes('FROM CONVERSATIONS')) {
      return this.handleConversationSelect(sql);
    }
    
    return { content: null, isError: true, errorMessage: `Unsupported SQL: ${sql}` };
  }

  private handleConversationInsert(sql: string): MCPToolResult {
    // Extract VALUES portion
    const valuesPart = sql.match(/VALUES\s*\(\s*'([^']+)'\s*,\s*'((?:[^']|'')*?)'\s*,/i);
    const timestampMatch = sql.match(/TO_TIMESTAMP\('([^']+)'/i);
    
    if (valuesPart && timestampMatch) {
      const id = valuesPart[1];
      const title = valuesPart[2].replace(/''/g, "'");
      const timestamp = timestampMatch[1];
      
      this.conversations.set(id, {
        id,
        title,
        created_at: timestamp,
        updated_at: timestamp,
      });
      
      return { content: '1 row inserted', isError: false };
    }
    return { content: null, isError: true, errorMessage: 'Invalid INSERT syntax' };
  }

  private handleMessageInsert(sql: string): MCPToolResult {
    // Parse message INSERT
    // VALUES ('id', 'conv_id', 'role', 'content', 'tool_calls' or NULL, 'tool_call_id' or NULL, TO_TIMESTAMP...)
    const valuesMatch = sql.match(/VALUES\s*\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'((?:[^']|'')*?)'\s*,\s*(NULL|'(?:[^']|'')*?')\s*,\s*(NULL|'(?:[^']|'')*?')\s*,\s*TO_TIMESTAMP\('([^']+)'/i);
    
    if (valuesMatch) {
      const id = valuesMatch[1];
      const conversationId = valuesMatch[2];
      const role = valuesMatch[3];
      const content = valuesMatch[4].replace(/''/g, "'");
      const toolCallsRaw = valuesMatch[5];
      const toolCallIdRaw = valuesMatch[6];
      const timestamp = valuesMatch[7];
      
      const toolCalls = toolCallsRaw === 'NULL' ? null : toolCallsRaw.slice(1, -1).replace(/''/g, "'");
      const toolCallId = toolCallIdRaw === 'NULL' ? null : toolCallIdRaw.slice(1, -1).replace(/''/g, "'");
      
      this.messages.set(id, {
        id,
        conversation_id: conversationId,
        role,
        content,
        tool_calls: toolCalls,
        tool_call_id: toolCallId,
        created_at: timestamp,
      });
      
      return { content: '1 row inserted', isError: false };
    }
    return { content: null, isError: true, errorMessage: 'Invalid message INSERT syntax' };
  }

  private handleConversationUpdate(sql: string): MCPToolResult {
    const whereMatch = sql.match(/WHERE\s+id\s*=\s*'([^']+)'/i);
    const timestampMatch = sql.match(/updated_at\s*=\s*TO_TIMESTAMP\('([^']+)'/i);
    
    if (whereMatch && timestampMatch) {
      const id = whereMatch[1];
      const timestamp = timestampMatch[1];
      const conv = this.conversations.get(id);
      
      if (conv) {
        conv.updated_at = timestamp;
        return { content: '1 row updated', isError: false };
      }
    }
    return { content: '0 rows updated', isError: false };
  }

  private handleMessageSelect(sql: string): MCPToolResult {
    const whereMatch = sql.match(/WHERE\s+conversation_id\s*=\s*'([^']+)'/i);
    
    if (whereMatch) {
      const conversationId = whereMatch[1];
      const results = Array.from(this.messages.values())
        .filter(m => m.conversation_id === conversationId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map(m => ({
          ID: m.id,
          ROLE: m.role,
          CONTENT: m.content,
          TOOL_CALLS: m.tool_calls,
          TOOL_CALL_ID: m.tool_call_id,
          CREATED_AT: m.created_at,
        }));
      
      return { content: results, isError: false };
    }
    
    return { content: [], isError: false };
  }

  private handleConversationSelect(sql: string): MCPToolResult {
    const whereMatch = sql.match(/WHERE\s+id\s*=\s*'([^']+)'/i);
    
    if (whereMatch) {
      const id = whereMatch[1];
      const conv = this.conversations.get(id);
      
      if (conv) {
        return {
          content: [{
            ID: conv.id,
            TITLE: conv.title,
            CREATED_AT: conv.created_at,
            UPDATED_AT: conv.updated_at,
          }],
          isError: false
        };
      }
      return { content: [], isError: false };
    }
    
    // SELECT all
    const results = Array.from(this.conversations.values()).map(conv => ({
      ID: conv.id,
      TITLE: conv.title,
      CREATED_AT: conv.created_at,
      UPDATED_AT: conv.updated_at,
    }));
    
    return { content: results, isError: false };
  }

  reset(): void {
    this.conversations.clear();
    this.messages.clear();
    this.connected = false;
  }
}

// Arbitrary for message roles
const roleArb = fc.constantFrom<MessageRole>('user', 'assistant', 'system', 'tool');

// Arbitrary for simple message content (safe for SQL)
const simpleContentArb = fc.stringMatching(/^[A-Za-z0-9 .,!?]{1,200}$/)
  .filter(s => s.trim().length > 0);

// Arbitrary for content with single quotes that need SQL escaping
const contentWithQuotesArb = fc.stringMatching(/^[A-Za-z0-9' .,!?]{1,200}$/)
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

describe('Property 11: Message Persistence via MCP Round-Trip', () => {
  let mockClient: MockMCPClient;
  let store: ConversationStore;

  beforeEach(() => {
    mockClient = new MockMCPClient();
    store = new ConversationStore(mockClient as unknown as MCPClient, 'test-connection');
  });

  it('should persist and retrieve message with identical content and role (Req 7.2)', async () => {
    await fc.assert(
      fc.asyncProperty(roleArb, simpleContentArb, async (role, content) => {
        mockClient.reset();
        store.resetConnection();

        // Create a conversation first
        const conversation = await store.createConversation('Test Conversation');

        // Add message
        const addedMessage = await store.addMessage(conversation.id, {
          role,
          content,
          timestamp: new Date(),
        });

        // Verify added message has expected properties
        expect(addedMessage.id).toBeDefined();
        expect(addedMessage.id.length).toBe(36); // UUID format
        expect(addedMessage.role).toBe(role);
        expect(addedMessage.content).toBe(content);
        expect(addedMessage.timestamp).toBeInstanceOf(Date);

        // Retrieve messages via MCP SELECT
        const retrievedMessages = await store.getMessages(conversation.id);

        // Property: Retrieved messages include the added message with identical data
        expect(retrievedMessages.length).toBe(1);
        const retrieved = retrievedMessages[0];
        expect(retrieved.id).toBe(addedMessage.id);
        expect(retrieved.role).toBe(role);
        expect(retrieved.content).toBe(content);
        
        // Timestamps should be equivalent (within reasonable precision)
        expect(retrieved.timestamp.toISOString().slice(0, 19))
          .toBe(addedMessage.timestamp.toISOString().slice(0, 19));
      }),
      { numRuns: 100 }
    );
  });

  it('should handle content with single quotes via SQL escaping (Req 7.2)', async () => {
    await fc.assert(
      fc.asyncProperty(roleArb, contentWithQuotesArb, async (role, content) => {
        mockClient.reset();
        store.resetConnection();

        const conversation = await store.createConversation('Test Conversation');

        // Add message with potentially problematic content
        const addedMessage = await store.addMessage(conversation.id, {
          role,
          content,
          timestamp: new Date(),
        });

        // Retrieve and verify
        const retrievedMessages = await store.getMessages(conversation.id);

        // Property: Content is preserved exactly, including quotes
        expect(retrievedMessages.length).toBe(1);
        expect(retrievedMessages[0].content).toBe(content);
      }),
      { numRuns: 100 }
    );
  });

  it('should persist multiple messages in chronological order (Req 7.2)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({ role: roleArb, content: simpleContentArb }),
          { minLength: 2, maxLength: 10 }
        ),
        async (messageData) => {
          mockClient.reset();
          store.resetConnection();

          const conversation = await store.createConversation('Test Conversation');
          const addedMessages = [];

          // Add messages sequentially
          for (const data of messageData) {
            const msg = await store.addMessage(conversation.id, {
              role: data.role,
              content: data.content,
              timestamp: new Date(),
            });
            addedMessages.push(msg);
          }

          // Retrieve all messages
          const retrievedMessages = await store.getMessages(conversation.id);

          // Property: All messages are retrieved in order
          expect(retrievedMessages.length).toBe(addedMessages.length);

          for (let i = 0; i < addedMessages.length; i++) {
            expect(retrievedMessages[i].id).toBe(addedMessages[i].id);
            expect(retrievedMessages[i].role).toBe(addedMessages[i].role);
            expect(retrievedMessages[i].content).toBe(addedMessages[i].content);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should persist messages with tool calls (Req 7.2)', async () => {
    await fc.assert(
      fc.asyncProperty(
        simpleContentArb,
        fc.array(toolCallArb, { minLength: 1, maxLength: 3 }),
        async (content, toolCalls) => {
          mockClient.reset();
          store.resetConnection();

          const conversation = await store.createConversation('Test Conversation');

          // Add message with tool calls
          const addedMessage = await store.addMessage(conversation.id, {
            role: 'assistant',
            content,
            timestamp: new Date(),
            toolCalls,
          });

          // Retrieve and verify
          const retrievedMessages = await store.getMessages(conversation.id);

          // Property: Tool calls are preserved
          expect(retrievedMessages.length).toBe(1);
          expect(retrievedMessages[0].toolCalls).toBeDefined();
          expect(retrievedMessages[0].toolCalls).toEqual(toolCalls);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should persist messages with tool call ID (Req 7.2)', async () => {
    await fc.assert(
      fc.asyncProperty(simpleContentArb, fc.uuid(), async (content, toolCallId) => {
        mockClient.reset();
        store.resetConnection();

        const conversation = await store.createConversation('Test Conversation');

        // Add tool result message
        const addedMessage = await store.addMessage(conversation.id, {
          role: 'tool',
          content,
          timestamp: new Date(),
          toolCallId,
        });

        // Retrieve and verify
        const retrievedMessages = await store.getMessages(conversation.id);

        // Property: Tool call ID is preserved
        expect(retrievedMessages.length).toBe(1);
        expect(retrievedMessages[0].toolCallId).toBe(toolCallId);
      }),
      { numRuns: 50 }
    );
  });

  it('should update conversation timestamp when message is added (Req 7.2)', async () => {
    await fc.assert(
      fc.asyncProperty(roleArb, simpleContentArb, async (role, content) => {
        mockClient.reset();
        store.resetConnection();

        const conversation = await store.createConversation('Test Conversation');
        const originalUpdatedAt = conversation.updatedAt;

        // Small delay to ensure timestamp difference
        await new Promise(resolve => setTimeout(resolve, 10));

        // Add message
        await store.addMessage(conversation.id, {
          role,
          content,
          timestamp: new Date(),
        });

        // Retrieve conversation
        const updatedConversation = await store.getConversation(conversation.id);

        // Property: Conversation updatedAt is updated
        expect(updatedConversation).not.toBeNull();
        expect(updatedConversation!.updatedAt.getTime())
          .toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
      }),
      { numRuns: 50 }
    );
  });

  it('should generate unique IDs for each message (Req 7.2)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(simpleContentArb, { minLength: 2, maxLength: 10 }),
        async (contents) => {
          mockClient.reset();
          store.resetConnection();

          const conversation = await store.createConversation('Test Conversation');
          const messageIds: string[] = [];

          for (const content of contents) {
            const msg = await store.addMessage(conversation.id, {
              role: 'user',
              content,
              timestamp: new Date(),
            });
            messageIds.push(msg.id);
          }

          // Property: All message IDs are unique
          const uniqueIds = new Set(messageIds);
          expect(uniqueIds.size).toBe(messageIds.length);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should return empty array for conversation with no messages (Req 7.2)', async () => {
    mockClient.reset();
    store.resetConnection();

    const conversation = await store.createConversation('Empty Conversation');

    // Retrieve messages from empty conversation
    const messages = await store.getMessages(conversation.id);

    // Property: Empty conversation returns empty array
    expect(messages).toEqual([]);
  });
});
