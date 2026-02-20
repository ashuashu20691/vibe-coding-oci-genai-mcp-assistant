/**
 * Property Test: Conversation Creation via MCP
 * 
 * Feature: mastra-migration, Property 10: Conversation Creation via MCP
 * 
 * *For any* new conversation created via the ConversationStore, executing a
 * SELECT query via MCP for that conversation ID SHALL return the conversation
 * with matching title and timestamps.
 * 
 * **Validates: Requirements 7.1**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ConversationStore, MCPToolResult } from '../../src/db/conversation-store';
import { MCPClient } from '@mastra/mcp';

/**
 * Mock MCP Client that simulates SQLcl MCP Server behavior.
 * Stores data in memory and responds to SQL queries.
 */
class MockMCPClient {
  private conversations: Map<string, {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
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
    
    // Handle INSERT
    if (normalizedSql.startsWith('INSERT INTO CONVERSATIONS')) {
      const idMatch = sql.match(/VALUES\s*\(\s*'([^']+)'/i);
      // Match title that may contain escaped single quotes ('')
      // The title is between the first comma and the next comma before TO_TIMESTAMP
      const titleStartIdx = sql.indexOf("VALUES");
      if (titleStartIdx === -1) {
        return { content: null, isError: true, errorMessage: 'Invalid INSERT syntax' };
      }
      
      // Extract the VALUES portion
      const valuesPart = sql.substring(titleStartIdx);
      // Find the title between first and second single-quote-delimited values
      // Pattern: VALUES ('id', 'title', TO_TIMESTAMP...)
      const parts = valuesPart.match(/VALUES\s*\(\s*'([^']+)'\s*,\s*'((?:[^']|'')*?)'\s*,/i);
      const timestampMatch = sql.match(/TO_TIMESTAMP\('([^']+)'/i);
      
      if (idMatch && parts && timestampMatch) {
        const id = parts[1];
        // Unescape SQL single quotes ('' -> ')
        const title = parts[2].replace(/''/g, "'");
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
    
    // Handle SELECT
    if (normalizedSql.startsWith('SELECT') && normalizedSql.includes('FROM CONVERSATIONS')) {
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
    
    return { content: null, isError: true, errorMessage: `Unsupported SQL: ${sql}` };
  }

  // Reset state between tests
  reset(): void {
    this.conversations.clear();
    this.connected = false;
  }
}

// Arbitrary for simple alphanumeric titles (safe for SQL)
const simpleTitleArb = fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,49}$/)
  .filter(s => s.trim().length > 0);

// Arbitrary for titles with single quotes that need SQL escaping
const titleWithQuotesArb = fc.stringMatching(/^[A-Za-z][A-Za-z0-9' ]{0,49}$/)
  .filter(s => s.trim().length > 0);

describe('Property 10: Conversation Creation via MCP', () => {
  let mockClient: MockMCPClient;
  let store: ConversationStore;

  beforeEach(() => {
    mockClient = new MockMCPClient();
    store = new ConversationStore(mockClient as unknown as MCPClient, 'test-connection');
  });

  it('should create conversation and retrieve it with matching data (Req 7.1)', async () => {
    await fc.assert(
      fc.asyncProperty(simpleTitleArb, async (title) => {
        mockClient.reset();
        store.resetConnection();

        // Create conversation
        const created = await store.createConversation(title);

        // Verify created conversation has expected properties
        expect(created.id).toBeDefined();
        expect(created.id.length).toBe(36); // UUID format
        expect(created.title).toBe(title);
        expect(created.createdAt).toBeInstanceOf(Date);
        expect(created.updatedAt).toBeInstanceOf(Date);

        // Retrieve conversation via MCP SELECT
        const retrieved = await store.getConversation(created.id);

        // Property: Retrieved conversation matches created conversation
        expect(retrieved).not.toBeNull();
        expect(retrieved!.id).toBe(created.id);
        expect(retrieved!.title).toBe(created.title);
        
        // Timestamps should be equivalent (within reasonable precision)
        expect(retrieved!.createdAt.toISOString().slice(0, 19))
          .toBe(created.createdAt.toISOString().slice(0, 19));
        expect(retrieved!.updatedAt.toISOString().slice(0, 19))
          .toBe(created.updatedAt.toISOString().slice(0, 19));
      }),
      { numRuns: 100 }
    );
  });

  it('should handle titles with single quotes via SQL escaping (Req 7.1)', async () => {
    await fc.assert(
      fc.asyncProperty(titleWithQuotesArb, async (title) => {
        mockClient.reset();
        store.resetConnection();

        // Create conversation with potentially problematic title
        const created = await store.createConversation(title);

        // Retrieve and verify
        const retrieved = await store.getConversation(created.id);

        // Property: Title is preserved exactly, including quotes
        expect(retrieved).not.toBeNull();
        expect(retrieved!.title).toBe(title);
      }),
      { numRuns: 100 }
    );
  });

  it('should generate unique IDs for each conversation (Req 7.1)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(simpleTitleArb, { minLength: 2, maxLength: 10 }),
        async (titles) => {
          mockClient.reset();
          store.resetConnection();

          const createdIds: string[] = [];

          for (const title of titles) {
            const created = await store.createConversation(title);
            createdIds.push(created.id);
          }

          // Property: All IDs are unique
          const uniqueIds = new Set(createdIds);
          expect(uniqueIds.size).toBe(createdIds.length);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should use default title when none provided (Req 7.1)', async () => {
    mockClient.reset();
    store.resetConnection();

    // Create conversation without title
    const created = await store.createConversation();

    // Property: Default title is used
    expect(created.title).toBe('New Conversation');

    // Retrieve and verify
    const retrieved = await store.getConversation(created.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.title).toBe('New Conversation');
  });

  it('should set createdAt and updatedAt to same value on creation (Req 7.1)', async () => {
    await fc.assert(
      fc.asyncProperty(simpleTitleArb, async (title) => {
        mockClient.reset();
        store.resetConnection();

        const created = await store.createConversation(title);

        // Property: createdAt equals updatedAt on new conversation
        expect(created.createdAt.toISOString())
          .toBe(created.updatedAt.toISOString());

        // Verify via retrieval
        const retrieved = await store.getConversation(created.id);
        expect(retrieved!.createdAt.toISOString())
          .toBe(retrieved!.updatedAt.toISOString());
      }),
      { numRuns: 100 }
    );
  });

  it('should return null for non-existent conversation ID (Req 7.1)', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (randomId) => {
        mockClient.reset();
        store.resetConnection();

        // Query for non-existent ID
        const retrieved = await store.getConversation(randomId);

        // Property: Non-existent conversation returns null
        expect(retrieved).toBeNull();
      }),
      { numRuns: 50 }
    );
  });

  it('should list created conversations (Req 7.1)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(simpleTitleArb, { minLength: 1, maxLength: 5 }),
        async (titles) => {
          mockClient.reset();
          store.resetConnection();

          const createdConversations = [];
          for (const title of titles) {
            const created = await store.createConversation(title);
            createdConversations.push(created);
          }

          // List all conversations
          const listed = await store.listConversations();

          // Property: All created conversations appear in list
          expect(listed.length).toBe(createdConversations.length);

          for (const created of createdConversations) {
            const found = listed.find(c => c.id === created.id);
            expect(found).toBeDefined();
            expect(found!.title).toBe(created.title);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
