/**
 * Property Test: Conversation Deletion via MCP Completeness
 * 
 * Feature: mastra-migration, Property 13: Conversation Deletion via MCP Completeness
 * 
 * *For any* conversation that is deleted via the ConversationStore, subsequent
 * SELECT queries via MCP for that conversation or its messages SHALL return
 * empty results.
 * 
 * **Validates: Requirements 7.5**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ConversationStore, MCPToolResult } from '../../src/db/conversation-store';
import { MCPClient } from '@mastra/mcp';
import { MessageRole } from '../../src/types';

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
    
    // Handle DELETE FROM messages
    if (normalizedSql.startsWith('DELETE FROM MESSAGES')) {
      return this.handleMessageDelete(sql);
    }
    
    // Handle DELETE FROM conversations
    if (normalizedSql.startsWith('DELETE FROM CONVERSATIONS')) {
      return this.handleConversationDelete(sql);
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

  private handleMessageDelete(sql: string): MCPToolResult {
    const whereMatch = sql.match(/WHERE\s+conversation_id\s*=\s*'([^']+)'/i);
    
    if (whereMatch) {
      const conversationId = whereMatch[1];
      let deletedCount = 0;
      
      // Delete all messages for this conversation
      for (const [msgId, msg] of this.messages.entries()) {
        if (msg.conversation_id === conversationId) {
          this.messages.delete(msgId);
          deletedCount++;
        }
      }
      
      return { content: `${deletedCount} row(s) deleted`, isError: false };
    }
    return { content: '0 rows deleted', isError: false };
  }

  private handleConversationDelete(sql: string): MCPToolResult {
    const whereMatch = sql.match(/WHERE\s+id\s*=\s*'([^']+)'/i);
    
    if (whereMatch) {
      const id = whereMatch[1];
      const existed = this.conversations.has(id);
      this.conversations.delete(id);
      
      return { content: existed ? '1 row deleted' : '0 rows deleted', isError: false };
    }
    return { content: '0 rows deleted', isError: false };
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

// Arbitrary for simple alphanumeric titles (safe for SQL)
const simpleTitleArb = fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,49}$/)
  .filter(s => s.trim().length > 0);

// Arbitrary for message roles
const roleArb = fc.constantFrom<MessageRole>('user', 'assistant', 'system', 'tool');

// Arbitrary for simple message content (safe for SQL)
const simpleContentArb = fc.stringMatching(/^[A-Za-z0-9 .,!?]{1,200}$/)
  .filter(s => s.trim().length > 0);

describe('Property 13: Conversation Deletion via MCP Completeness', () => {
  let mockClient: MockMCPClient;
  let store: ConversationStore;

  beforeEach(() => {
    mockClient = new MockMCPClient();
    store = new ConversationStore(mockClient as unknown as MCPClient, 'test-connection');
  });

  it('should return null when querying deleted conversation (Req 7.5)', async () => {
    await fc.assert(
      fc.asyncProperty(simpleTitleArb, async (title) => {
        mockClient.reset();
        store.resetConnection();

        // Create conversation
        const created = await store.createConversation(title);
        
        // Verify it exists
        const beforeDelete = await store.getConversation(created.id);
        expect(beforeDelete).not.toBeNull();
        expect(beforeDelete!.id).toBe(created.id);

        // Delete conversation
        await store.deleteConversation(created.id);

        // Property: Deleted conversation returns null
        const afterDelete = await store.getConversation(created.id);
        expect(afterDelete).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('should return empty array when querying messages of deleted conversation (Req 7.5)', async () => {
    await fc.assert(
      fc.asyncProperty(
        simpleTitleArb,
        fc.array(
          fc.record({ role: roleArb, content: simpleContentArb }),
          { minLength: 1, maxLength: 5 }
        ),
        async (title, messageData) => {
          mockClient.reset();
          store.resetConnection();

          // Create conversation with messages
          const conversation = await store.createConversation(title);
          
          for (const data of messageData) {
            await store.addMessage(conversation.id, {
              role: data.role,
              content: data.content,
              timestamp: new Date(),
            });
          }

          // Verify messages exist
          const beforeDelete = await store.getMessages(conversation.id);
          expect(beforeDelete.length).toBe(messageData.length);

          // Delete conversation
          await store.deleteConversation(conversation.id);

          // Property: Messages of deleted conversation return empty array
          const afterDelete = await store.getMessages(conversation.id);
          expect(afterDelete).toEqual([]);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should not affect other conversations when deleting one (Req 7.5)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(simpleTitleArb, { minLength: 2, maxLength: 5 }),
        async (titles) => {
          mockClient.reset();
          store.resetConnection();

          // Create multiple conversations
          const conversations: Array<{ id: string; title: string; createdAt: Date; updatedAt: Date }> = [];
          for (const title of titles) {
            const conv = await store.createConversation(title);
            conversations.push(conv);
          }

          // Delete the first conversation
          const toDelete = conversations[0];
          await store.deleteConversation(toDelete.id);

          // Property: Deleted conversation is gone
          const deleted = await store.getConversation(toDelete.id);
          expect(deleted).toBeNull();

          // Property: Other conversations still exist
          for (let i = 1; i < conversations.length; i++) {
            const remaining = await store.getConversation(conversations[i].id);
            expect(remaining).not.toBeNull();
            expect(remaining!.id).toBe(conversations[i].id);
            expect(remaining!.title).toBe(conversations[i].title);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should not affect messages of other conversations when deleting one (Req 7.5)', async () => {
    await fc.assert(
      fc.asyncProperty(
        simpleTitleArb,
        simpleTitleArb,
        fc.array(simpleContentArb, { minLength: 1, maxLength: 3 }),
        fc.array(simpleContentArb, { minLength: 1, maxLength: 3 }),
        async (title1, title2, contents1, contents2) => {
          mockClient.reset();
          store.resetConnection();

          // Create two conversations with messages
          const conv1 = await store.createConversation(title1);
          const conv2 = await store.createConversation(title2);

          for (const content of contents1) {
            await store.addMessage(conv1.id, {
              role: 'user',
              content,
              timestamp: new Date(),
            });
          }

          for (const content of contents2) {
            await store.addMessage(conv2.id, {
              role: 'user',
              content,
              timestamp: new Date(),
            });
          }

          // Delete first conversation
          await store.deleteConversation(conv1.id);

          // Property: Messages of deleted conversation are gone
          const deletedMessages = await store.getMessages(conv1.id);
          expect(deletedMessages).toEqual([]);

          // Property: Messages of other conversation still exist
          const remainingMessages = await store.getMessages(conv2.id);
          expect(remainingMessages.length).toBe(contents2.length);
          
          for (let i = 0; i < contents2.length; i++) {
            expect(remainingMessages[i].content).toBe(contents2[i]);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should remove conversation from list after deletion (Req 7.5)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(simpleTitleArb, { minLength: 2, maxLength: 5 }),
        async (titles) => {
          mockClient.reset();
          store.resetConnection();

          // Create multiple conversations
          const conversations: Array<{ id: string; title: string; createdAt: Date; updatedAt: Date }> = [];
          for (const title of titles) {
            const conv = await store.createConversation(title);
            conversations.push(conv);
          }

          // Verify all exist in list
          const beforeDelete = await store.listConversations();
          expect(beforeDelete.length).toBe(conversations.length);

          // Delete one conversation
          const toDelete = conversations[0];
          await store.deleteConversation(toDelete.id);

          // Property: Deleted conversation not in list
          const afterDelete = await store.listConversations();
          expect(afterDelete.length).toBe(conversations.length - 1);
          
          const deletedInList = afterDelete.find(c => c.id === toDelete.id);
          expect(deletedInList).toBeUndefined();

          // Property: Other conversations still in list
          for (let i = 1; i < conversations.length; i++) {
            const found = afterDelete.find(c => c.id === conversations[i].id);
            expect(found).toBeDefined();
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle deleting conversation with no messages (Req 7.5)', async () => {
    await fc.assert(
      fc.asyncProperty(simpleTitleArb, async (title) => {
        mockClient.reset();
        store.resetConnection();

        // Create conversation without messages
        const conversation = await store.createConversation(title);

        // Delete conversation
        await store.deleteConversation(conversation.id);

        // Property: Conversation is deleted
        const afterDelete = await store.getConversation(conversation.id);
        expect(afterDelete).toBeNull();

        // Property: Messages query returns empty (was already empty)
        const messages = await store.getMessages(conversation.id);
        expect(messages).toEqual([]);
      }),
      { numRuns: 50 }
    );
  });

  it('should handle deleting non-existent conversation gracefully (Req 7.5)', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (randomId) => {
        mockClient.reset();
        store.resetConnection();

        // Attempt to delete non-existent conversation
        // Should not throw an error
        await expect(store.deleteConversation(randomId)).resolves.not.toThrow();

        // Property: Query for non-existent ID still returns null
        const result = await store.getConversation(randomId);
        expect(result).toBeNull();
      }),
      { numRuns: 50 }
    );
  });
});
