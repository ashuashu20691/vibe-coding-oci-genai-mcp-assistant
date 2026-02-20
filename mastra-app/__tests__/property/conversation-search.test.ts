/**
 * Property Test: Conversation Search via MCP Accuracy
 * 
 * Feature: mastra-migration, Property 14: Conversation Search via MCP Accuracy
 * 
 * *For any* search query executed via the ConversationStore, the returned
 * conversations SHALL only include those where the query matches either the
 * conversation title or the content of at least one message in that conversation.
 * 
 * **Validates: Requirements 7.6**
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
    
    // Handle SELECT DISTINCT (search query)
    if (normalizedSql.startsWith('SELECT DISTINCT')) {
      return this.handleSearchQuery(sql);
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

  private handleSearchQuery(sql: string): MCPToolResult {
    // Extract the search pattern from LIKE clauses
    // Pattern: WHERE LOWER(c.title) LIKE '%query%' OR LOWER(m.content) LIKE '%query%'
    const likeMatch = sql.match(/LIKE\s+'%([^%]*)%'/i);
    
    if (!likeMatch) {
      return { content: [], isError: false };
    }
    
    // Unescape SQL single quotes
    const searchQuery = likeMatch[1].replace(/''/g, "'").toLowerCase();
    
    // Find conversations matching by title or message content
    const matchingConvIds = new Set<string>();
    
    // Check title matches
    for (const [id, conv] of this.conversations.entries()) {
      if (conv.title.toLowerCase().includes(searchQuery)) {
        matchingConvIds.add(id);
      }
    }
    
    // Check message content matches
    for (const msg of this.messages.values()) {
      if (msg.content.toLowerCase().includes(searchQuery)) {
        matchingConvIds.add(msg.conversation_id);
      }
    }
    
    // Return matching conversations
    const results = Array.from(matchingConvIds)
      .map(id => this.conversations.get(id))
      .filter((conv): conv is NonNullable<typeof conv> => conv !== undefined)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map(conv => ({
        ID: conv.id,
        TITLE: conv.title,
        CREATED_AT: conv.created_at,
        UPDATED_AT: conv.updated_at,
      }));
    
    return { content: results, isError: false };
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

// Arbitrary for simple alphanumeric strings (safe for SQL)
const simpleStringArb = fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,29}$/)
  .filter(s => s.trim().length > 0);

// Arbitrary for search queries (shorter strings for matching)
const searchQueryArb = fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{0,9}$/)
  .filter(s => s.trim().length > 0);

// Arbitrary for message content
const contentArb = fc.stringMatching(/^[A-Za-z0-9 .,!?]{1,100}$/)
  .filter(s => s.trim().length > 0);

describe('Property 14: Conversation Search via MCP Accuracy', () => {
  let mockClient: MockMCPClient;
  let store: ConversationStore;

  beforeEach(() => {
    mockClient = new MockMCPClient();
    store = new ConversationStore(mockClient as unknown as MCPClient, 'test-connection');
  });

  it('should find conversations by title match (Req 7.6)', async () => {
    await fc.assert(
      fc.asyncProperty(
        searchQueryArb,
        simpleStringArb,
        async (searchTerm, otherTitle) => {
          // Ensure otherTitle doesn't contain searchTerm
          fc.pre(!otherTitle.toLowerCase().includes(searchTerm.toLowerCase()));
          
          mockClient.reset();
          store.resetConnection();

          // Create conversation with title containing search term
          const matchingTitle = `Test ${searchTerm} conversation`;
          const matchingConv = await store.createConversation(matchingTitle);
          
          // Create conversation without search term
          const nonMatchingConv = await store.createConversation(otherTitle);

          // Search for the term
          const results = await store.searchConversations(searchTerm);

          // Property: Only matching conversation is returned
          expect(results.length).toBe(1);
          expect(results[0].id).toBe(matchingConv.id);
          expect(results[0].title).toBe(matchingTitle);
          
          // Property: Non-matching conversation is not returned
          const nonMatchingFound = results.find(c => c.id === nonMatchingConv.id);
          expect(nonMatchingFound).toBeUndefined();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should find conversations by message content match (Req 7.6)', async () => {
    await fc.assert(
      fc.asyncProperty(
        searchQueryArb,
        simpleStringArb,
        simpleStringArb,
        contentArb,
        async (searchTerm, title1, title2, nonMatchingContent) => {
          // Ensure titles don't contain search term
          fc.pre(!title1.toLowerCase().includes(searchTerm.toLowerCase()));
          fc.pre(!title2.toLowerCase().includes(searchTerm.toLowerCase()));
          // Ensure non-matching content doesn't contain search term
          fc.pre(!nonMatchingContent.toLowerCase().includes(searchTerm.toLowerCase()));
          
          mockClient.reset();
          store.resetConnection();

          // Create conversation with message containing search term
          const conv1 = await store.createConversation(title1);
          await store.addMessage(conv1.id, {
            role: 'user',
            content: `XYZQ ${searchTerm} XYZQ`,
            timestamp: new Date(),
          });
          
          // Create conversation without search term in messages
          const conv2 = await store.createConversation(title2);
          await store.addMessage(conv2.id, {
            role: 'user',
            content: nonMatchingContent,
            timestamp: new Date(),
          });

          // Search for the term
          const results = await store.searchConversations(searchTerm);

          // Property: Only conversation with matching message is returned
          expect(results.length).toBe(1);
          expect(results[0].id).toBe(conv1.id);
          
          // Property: Conversation without matching message is not returned
          const nonMatchingFound = results.find(c => c.id === conv2.id);
          expect(nonMatchingFound).toBeUndefined();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should find conversations matching either title or content (Req 7.6)', async () => {
    await fc.assert(
      fc.asyncProperty(
        searchQueryArb,
        simpleStringArb,
        async (searchTerm, otherTitle) => {
          // Ensure otherTitle doesn't contain search term
          fc.pre(!otherTitle.toLowerCase().includes(searchTerm.toLowerCase()));
          
          mockClient.reset();
          store.resetConnection();

          // Create conversation with matching title
          const titleMatchConv = await store.createConversation(`Title ${searchTerm}`);
          
          // Create conversation with matching message content
          const contentMatchConv = await store.createConversation(otherTitle);
          await store.addMessage(contentMatchConv.id, {
            role: 'user',
            content: `Content ${searchTerm} here`,
            timestamp: new Date(),
          });

          // Search for the term
          const results = await store.searchConversations(searchTerm);

          // Property: Both conversations are returned
          expect(results.length).toBe(2);
          
          const titleMatchFound = results.find(c => c.id === titleMatchConv.id);
          const contentMatchFound = results.find(c => c.id === contentMatchConv.id);
          
          expect(titleMatchFound).toBeDefined();
          expect(contentMatchFound).toBeDefined();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should return empty array when no matches found (Req 7.6)', async () => {
    await fc.assert(
      fc.asyncProperty(
        searchQueryArb,
        simpleStringArb,
        contentArb,
        async (searchTerm, title, content) => {
          // Ensure neither title nor content contains search term
          fc.pre(!title.toLowerCase().includes(searchTerm.toLowerCase()));
          fc.pre(!content.toLowerCase().includes(searchTerm.toLowerCase()));
          
          mockClient.reset();
          store.resetConnection();

          // Create conversation without search term
          const conv = await store.createConversation(title);
          await store.addMessage(conv.id, {
            role: 'user',
            content,
            timestamp: new Date(),
          });

          // Search for the term
          const results = await store.searchConversations(searchTerm);

          // Property: No results returned
          expect(results).toEqual([]);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should be case-insensitive in search (Req 7.6)', async () => {
    await fc.assert(
      fc.asyncProperty(
        searchQueryArb,
        async (searchTerm) => {
          mockClient.reset();
          store.resetConnection();

          // Create conversation with uppercase title
          const upperTitle = `TITLE ${searchTerm.toUpperCase()} HERE`;
          const conv = await store.createConversation(upperTitle);

          // Search with lowercase
          const results = await store.searchConversations(searchTerm.toLowerCase());

          // Property: Case-insensitive match works
          expect(results.length).toBe(1);
          expect(results[0].id).toBe(conv.id);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should not return duplicate conversations when matching both title and content (Req 7.6)', async () => {
    await fc.assert(
      fc.asyncProperty(
        searchQueryArb,
        async (searchTerm) => {
          mockClient.reset();
          store.resetConnection();

          // Create conversation with search term in both title and message
          const title = `Title ${searchTerm}`;
          const conv = await store.createConversation(title);
          await store.addMessage(conv.id, {
            role: 'user',
            content: `Message ${searchTerm}`,
            timestamp: new Date(),
          });

          // Search for the term
          const results = await store.searchConversations(searchTerm);

          // Property: Only one result (no duplicates)
          expect(results.length).toBe(1);
          expect(results[0].id).toBe(conv.id);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should match any message in conversation, not just first (Req 7.6)', async () => {
    await fc.assert(
      fc.asyncProperty(
        searchQueryArb,
        fc.array(contentArb, { minLength: 2, maxLength: 5 }),
        async (searchTerm, otherContents) => {
          // Ensure other contents don't contain search term
          fc.pre(otherContents.every(c => !c.toLowerCase().includes(searchTerm.toLowerCase())));
          
          mockClient.reset();
          store.resetConnection();

          // Create conversation with multiple messages
          const conv = await store.createConversation('Test conversation');
          
          // Add messages without search term
          for (const content of otherContents) {
            await store.addMessage(conv.id, {
              role: 'user',
              content,
              timestamp: new Date(),
            });
          }
          
          // Add message with search term at the end
          await store.addMessage(conv.id, {
            role: 'assistant',
            content: `Response with ${searchTerm}`,
            timestamp: new Date(),
          });

          // Search for the term
          const results = await store.searchConversations(searchTerm);

          // Property: Conversation is found via later message
          expect(results.length).toBe(1);
          expect(results[0].id).toBe(conv.id);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should return all matching conversations (Req 7.6)', async () => {
    await fc.assert(
      fc.asyncProperty(
        searchQueryArb,
        fc.integer({ min: 2, max: 5 }),
        async (searchTerm, count) => {
          mockClient.reset();
          store.resetConnection();

          // Create multiple conversations with matching titles
          const createdConvs = [];
          for (let i = 0; i < count; i++) {
            const conv = await store.createConversation(`Conv ${i} ${searchTerm}`);
            createdConvs.push(conv);
          }

          // Search for the term
          const results = await store.searchConversations(searchTerm);

          // Property: All matching conversations are returned
          expect(results.length).toBe(count);
          
          for (const created of createdConvs) {
            const found = results.find(c => c.id === created.id);
            expect(found).toBeDefined();
          }
        }
      ),
      { numRuns: 30 }
    );
  });
});
