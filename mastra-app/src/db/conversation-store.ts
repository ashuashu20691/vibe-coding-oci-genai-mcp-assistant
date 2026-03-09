// src/db/conversation-store.ts
/**
 * Conversation Store using direct Oracle Database connection.
 * Provides persistence for conversations and messages.
 */

import { v4 as uuidv4 } from 'uuid';
import { Conversation, Message, MessageRole } from '../types';
import {
  executeQuery,
  executeStatement,
  isConnected,
  initializePool,
  OracleConfig,
} from './oracle-client';

/**
 * Error thrown when database operations fail.
 */
export class ConversationStoreError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ConversationStoreError';
  }
}

/**
 * Error thrown when database connection fails.
 */
export class DBConnectionError extends ConversationStoreError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'DBConnectionError';
  }
}

/**
 * Error thrown when SQL execution fails.
 */
export class SQLExecutionError extends ConversationStoreError {
  constructor(message: string, public readonly sql?: string, cause?: unknown) {
    super(message, cause);
    this.name = 'SQLExecutionError';
  }
}

// Re-export OracleConfig for convenience
export type { OracleConfig };

/**
 * Row type for conversation query results.
 */
interface ConversationRow {
  ID: string;
  TITLE: string;
  CREATED_AT: Date;
  UPDATED_AT: Date;
  MODEL_ID: string | null;
  ACTIVE_ARTIFACT: string | null;
}

/**
 * Row type for message query results.
 */
interface MessageRow {
  ID: string;
  ROLE: string;
  CONTENT: string;
  TOOL_CALLS: string | null;
  TOOL_CALL_ID: string | null;
  TOOL_NARRATIVES: string | null;
  ADAPTATION_NARRATIVES: string | null;
  VISUALIZATION: string | null;
  CREATED_AT: Date;
}

/**
 * Helper to safely convert Oracle date to JavaScript Date.
 */
function toDate(value: unknown): Date {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value);
  }
  // Handle Oracle date objects that might have toISOString or similar
  if (value && typeof value === 'object') {
    const obj = value as { toISOString?: () => string; getTime?: () => number };
    if (typeof obj.getTime === 'function') {
      return new Date(obj.getTime());
    }
    if (typeof obj.toISOString === 'function') {
      return new Date(obj.toISOString());
    }
  }
  return new Date();
}

/**
 * Helper to safely convert value to string, handling LOB objects.
 */
function toString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  // Handle Oracle LOB objects
  if (value && typeof value === 'object') {
    const obj = value as { getData?: () => Promise<string>; toString?: () => string };
    if (typeof obj.toString === 'function' && obj.toString !== Object.prototype.toString) {
      return obj.toString();
    }
  }
  // Last resort - try JSON stringify for debugging
  try {
    return JSON.stringify(value);
  } catch {
    return '[Unable to convert to string]';
  }
}

/**
 * ConversationStore provides persistence for conversations and messages
 * using direct Oracle Database connection with wallet authentication.
 */
export class ConversationStore {
  private config: OracleConfig;
  private initialized: boolean = false;

  constructor(config: OracleConfig) {
    this.config = config;
  }

  /**
   * Initialize the database connection pool.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await initializePool(this.config);
      this.initialized = true;
      
      // Create tables if they don't exist
      await this.createTablesIfNeeded();
      
      // Try to add visualization column if it doesn't exist
      try {
        await executeStatement(
          `ALTER TABLE messages ADD (visualization CLOB)`
        );
        console.log('[ConversationStore] Added visualization column to messages table');
      } catch (e) {
        // Column already exists or table doesn't exist — both are fine
        const errMsg = e instanceof Error ? e.message : String(e);
        if (errMsg.includes('ORA-01430') || errMsg.includes('already exists')) {
          console.log('[ConversationStore] Visualization column already exists');
        } else if (errMsg.includes('ORA-00942') || errMsg.includes('table or view does not exist')) {
          console.log('[ConversationStore] Messages table does not exist yet - will be created later');
        } else {
          console.warn('[ConversationStore] Failed to add visualization column:', errMsg);
        }
      }
    } catch (error) {
      throw new DBConnectionError(
        `Failed to initialize Oracle connection: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }
  
  /**
   * Create tables if they don't exist
   */
  private async createTablesIfNeeded(): Promise<void> {
    try {
      // Create conversations table
      await executeStatement(`
        CREATE TABLE conversations (
          id VARCHAR2(36) PRIMARY KEY,
          title VARCHAR2(500) NOT NULL,
          model_id VARCHAR2(200),
          active_artifact CLOB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('[ConversationStore] Created conversations table');
    } catch (e: any) {
      if (e.message?.includes('ORA-00955') || e.message?.includes('name is already used')) {
        console.log('[ConversationStore] Conversations table already exists');
      } else {
        console.warn('[ConversationStore] Could not create conversations table:', e.message);
      }
    }
    
    try {
      // Create messages table with all columns
      await executeStatement(`
        CREATE TABLE messages (
          id VARCHAR2(36) PRIMARY KEY,
          conversation_id VARCHAR2(36) NOT NULL,
          role VARCHAR2(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
          content CLOB,
          tool_calls CLOB,
          tool_call_id VARCHAR2(100),
          tool_narratives CLOB,
          adaptation_narratives CLOB,
          visualization CLOB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_conversation 
            FOREIGN KEY (conversation_id) 
            REFERENCES conversations(id) 
            ON DELETE CASCADE
        )
      `);
      console.log('[ConversationStore] Created messages table');
    } catch (e: any) {
      if (e.message?.includes('ORA-00955') || e.message?.includes('name is already used')) {
        console.log('[ConversationStore] Messages table already exists');
      } else {
        console.warn('[ConversationStore] Could not create messages table:', e.message);
      }
    }
    
    try {
      await executeStatement(`CREATE INDEX idx_messages_conversation ON messages(conversation_id)`);
      console.log('[ConversationStore] Created idx_messages_conversation');
    } catch (e: any) {
      if (e.message?.includes('ORA-00955') || e.message?.includes('name is already used')) {
        // Index already exists
      }
    }
    
    try {
      await executeStatement(`CREATE INDEX idx_conversations_updated ON conversations(updated_at DESC)`);
      console.log('[ConversationStore] Created idx_conversations_updated');
    } catch (e: any) {
      if (e.message?.includes('ORA-00955') || e.message?.includes('name is already used')) {
        // Index already exists
      }
    }
  }

  /**
   * Ensure the store is initialized before operations.
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Check if connected to the database.
   */
  async checkConnection(): Promise<boolean> {
    try {
      await this.ensureInitialized();
      return await isConnected();
    } catch {
      return false;
    }
  }

  /**
   * Create a new conversation.
   */
  async createConversation(title?: string, modelId?: string): Promise<Conversation> {
    await this.ensureInitialized();
    
    const id = uuidv4();
    const convTitle = title || 'New Conversation';

    try {
      // Try with model_id first, fall back to without if column doesn't exist
      try {
        await executeStatement(
          `INSERT INTO conversations (id, title, model_id, created_at, updated_at)
           VALUES (:id, :title, :modelId, SYSTIMESTAMP, SYSTIMESTAMP)`,
          { id, title: convTitle, modelId: modelId || null }
        );
      } catch (error) {
        // If model_id column doesn't exist, insert without it
        if (error instanceof Error && error.message.includes('ORA-00904')) {
          await executeStatement(
            `INSERT INTO conversations (id, title, created_at, updated_at)
             VALUES (:id, :title, SYSTIMESTAMP, SYSTIMESTAMP)`,
            { id, title: convTitle }
          );
        } else {
          throw error;
        }
      }

      return {
        id,
        title: convTitle,
        modelId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      throw new SQLExecutionError(
        `Failed to create conversation: ${error instanceof Error ? error.message : String(error)}`,
        'INSERT INTO conversations',
        error
      );
    }
  }

  /**
   * List conversations ordered by most recent.
   */
  async listConversations(limit = 50): Promise<Conversation[]> {
    await this.ensureInitialized();

    try {
      // Try with model_id first, fall back to without if column doesn't exist
      let rows: ConversationRow[];
      try {
        rows = await executeQuery<ConversationRow>(
          `SELECT id, title, model_id, created_at, updated_at
           FROM conversations
           ORDER BY updated_at DESC
           FETCH FIRST :limit ROWS ONLY`,
          { limit }
        );
      } catch (error) {
        // If model_id column doesn't exist, query without it
        if (error instanceof Error && error.message.includes('ORA-00904')) {
          rows = await executeQuery<ConversationRow>(
            `SELECT id, title, created_at, updated_at
             FROM conversations
             ORDER BY updated_at DESC
             FETCH FIRST :limit ROWS ONLY`,
            { limit }
          );
        } else {
          throw error;
        }
      }

      return rows.map(row => ({
        id: String(row.ID),
        title: String(row.TITLE),
        modelId: row.MODEL_ID ? String(row.MODEL_ID) : undefined,
        createdAt: toDate(row.CREATED_AT),
        updatedAt: toDate(row.UPDATED_AT),
      }));
    } catch (error) {
      throw new SQLExecutionError(
        `Failed to list conversations: ${error instanceof Error ? error.message : String(error)}`,
        'SELECT FROM conversations',
        error
      );
    }
  }

  /**
   * Get a conversation by ID.
   */
  async getConversation(id: string): Promise<Conversation | null> {
    await this.ensureInitialized();

    try {
      // Try with model_id and active_artifact first, fall back to without if columns don't exist
      let rows: ConversationRow[];
      try {
        rows = await executeQuery<ConversationRow>(
          `SELECT id, title, model_id, active_artifact, created_at, updated_at
           FROM conversations
           WHERE id = :id`,
          { id }
        );
      } catch (error) {
        // If columns don't exist, query without them
        if (error instanceof Error && error.message.includes('ORA-00904')) {
          rows = await executeQuery<ConversationRow>(
            `SELECT id, title, created_at, updated_at
             FROM conversations
             WHERE id = :id`,
            { id }
          );
        } else {
          throw error;
        }
      }

      if (rows.length === 0) return null;

      const row = rows[0];
      
      // Parse active artifact if present
      let activeArtifact = undefined;
      const artifactStr = row.ACTIVE_ARTIFACT ? toString(row.ACTIVE_ARTIFACT) : null;
      if (artifactStr) {
        try {
          const parsed = JSON.parse(artifactStr);
          // Deserialize dates
          activeArtifact = {
            ...parsed,
            createdAt: new Date(parsed.createdAt),
            updatedAt: new Date(parsed.updatedAt),
          };
        } catch (error) {
          console.warn('Failed to parse active artifact:', error);
        }
      }
      
      return {
        id: String(row.ID),
        title: String(row.TITLE),
        modelId: row.MODEL_ID ? String(row.MODEL_ID) : undefined,
        activeArtifact,
        createdAt: toDate(row.CREATED_AT),
        updatedAt: toDate(row.UPDATED_AT),
      };
    } catch (error) {
      throw new SQLExecutionError(
        `Failed to get conversation: ${error instanceof Error ? error.message : String(error)}`,
        'SELECT FROM conversations WHERE id',
        error
      );
    }
  }

  /**
   * Update a conversation's title.
   */
  async updateConversationTitle(id: string, title: string): Promise<void> {
    await this.ensureInitialized();

    try {
      await executeStatement(
        `UPDATE conversations
         SET title = :title, updated_at = SYSTIMESTAMP
         WHERE id = :id`,
        { id, title }
      );
    } catch (error) {
      throw new SQLExecutionError(
        `Failed to update conversation: ${error instanceof Error ? error.message : String(error)}`,
        'UPDATE conversations',
        error
      );
    }
  }

  /**
   * Update a conversation's model ID.
   */
  async updateConversationModelId(id: string, modelId: string): Promise<void> {
    await this.ensureInitialized();

    try {
      // Try to update model_id, silently fail if column doesn't exist
      try {
        await executeStatement(
          `UPDATE conversations
           SET model_id = :modelId, updated_at = SYSTIMESTAMP
           WHERE id = :id`,
          { id, modelId }
        );
      } catch (error) {
        // If model_id column doesn't exist, just update the timestamp
        if (error instanceof Error && error.message.includes('ORA-00904')) {
          await executeStatement(
            `UPDATE conversations
             SET updated_at = SYSTIMESTAMP
             WHERE id = :id`,
            { id }
          );
        } else {
          throw error;
        }
      }
    } catch (error) {
      throw new SQLExecutionError(
        `Failed to update conversation model: ${error instanceof Error ? error.message : String(error)}`,
        'UPDATE conversations SET model_id',
        error
      );
    }
  }

  /**
   * Update a conversation's active artifact.
   * Validates: Requirement 15.6 - Artifact persistence across turns
   */
  async updateConversationArtifact(id: string, artifactJson: string | null): Promise<void> {
    await this.ensureInitialized();

    try {
      // Try to update active_artifact, silently handle if column doesn't exist
      try {
        await executeStatement(
          `UPDATE conversations
           SET active_artifact = :artifactJson, updated_at = SYSTIMESTAMP
           WHERE id = :id`,
          { id, artifactJson }
        );
      } catch (error) {
        // If active_artifact column doesn't exist, just update the timestamp
        if (error instanceof Error && error.message.includes('ORA-00904')) {
          console.warn('active_artifact column does not exist in conversations table');
          await executeStatement(
            `UPDATE conversations
             SET updated_at = SYSTIMESTAMP
             WHERE id = :id`,
            { id }
          );
        } else {
          throw error;
        }
      }
    } catch (error) {
      throw new SQLExecutionError(
        `Failed to update conversation artifact: ${error instanceof Error ? error.message : String(error)}`,
        'UPDATE conversations SET active_artifact',
        error
      );
    }
  }

  /**
   * Delete a conversation and all its messages.
   */
  async deleteConversation(id: string): Promise<void> {
    await this.ensureInitialized();

    try {
      // Delete messages first (foreign key constraint)
      await executeStatement(
        `DELETE FROM messages WHERE conversation_id = :id`,
        { id }
      );
      // Delete conversation
      await executeStatement(
        `DELETE FROM conversations WHERE id = :id`,
        { id }
      );
    } catch (error) {
      throw new SQLExecutionError(
        `Failed to delete conversation: ${error instanceof Error ? error.message : String(error)}`,
        'DELETE FROM conversations',
        error
      );
    }
  }

  /**
   * Search conversations by title or message content.
   */
  async searchConversations(query: string): Promise<Conversation[]> {
    await this.ensureInitialized();

    try {
      const searchPattern = `%${query.toLowerCase()}%`;
      // Try with model_id first, fall back to without if column doesn't exist
      let rows: ConversationRow[];
      try {
        rows = await executeQuery<ConversationRow>(
          `SELECT DISTINCT c.id, c.title, c.model_id, c.created_at, c.updated_at
           FROM conversations c
           LEFT JOIN messages m ON c.id = m.conversation_id
           WHERE LOWER(c.title) LIKE :pattern 
              OR LOWER(m.content) LIKE :pattern
           ORDER BY c.updated_at DESC
           FETCH FIRST 50 ROWS ONLY`,
          { pattern: searchPattern }
        );
      } catch (error) {
        // If model_id column doesn't exist, query without it
        if (error instanceof Error && error.message.includes('ORA-00904')) {
          rows = await executeQuery<ConversationRow>(
            `SELECT DISTINCT c.id, c.title, c.created_at, c.updated_at
             FROM conversations c
             LEFT JOIN messages m ON c.id = m.conversation_id
             WHERE LOWER(c.title) LIKE :pattern 
                OR LOWER(m.content) LIKE :pattern
             ORDER BY c.updated_at DESC
             FETCH FIRST 50 ROWS ONLY`,
            { pattern: searchPattern }
          );
        } else {
          throw error;
        }
      }

      return rows.map(row => ({
        id: String(row.ID),
        title: String(row.TITLE),
        modelId: row.MODEL_ID ? String(row.MODEL_ID) : undefined,
        createdAt: toDate(row.CREATED_AT),
        updatedAt: toDate(row.UPDATED_AT),
      }));
    } catch (error) {
      throw new SQLExecutionError(
        `Failed to search conversations: ${error instanceof Error ? error.message : String(error)}`,
        'SELECT FROM conversations (search)',
        error
      );
    }
  }

  /**
   * Add a message to a conversation.
   */
  async addMessage(conversationId: string, message: Omit<Message, 'id'>): Promise<Message> {
    await this.ensureInitialized();

    const id = uuidv4();
    const toolCallsJson = message.toolCalls ? JSON.stringify(message.toolCalls) : null;
    const toolNarrativesJson = message.toolNarratives ? JSON.stringify(message.toolNarratives) : null;
    const adaptationNarrativesJson = message.adaptationNarratives ? JSON.stringify(message.adaptationNarratives) : null;
    const visualizationJson = message.visualization ? JSON.stringify(message.visualization) : null;
    
    console.log(`[addMessage] Saving message ${id} with visualization:`, visualizationJson ? visualizationJson.substring(0, 200) + '...' : 'NULL');

    try {
      // Try with all columns first (including visualization)
      try {
        await executeStatement(
          `INSERT INTO messages (id, conversation_id, role, content, tool_calls, tool_call_id, tool_narratives, adaptation_narratives, visualization, created_at)
           VALUES (:id, :conversationId, :role, :content, :toolCalls, :toolCallId, :toolNarratives, :adaptationNarratives, :visualization, SYSTIMESTAMP)`,
          {
            id,
            conversationId,
            role: message.role,
            content: message.content || '',
            toolCalls: toolCallsJson,
            toolCallId: message.toolCallId || null,
            toolNarratives: toolNarrativesJson,
            adaptationNarratives: adaptationNarrativesJson,
            visualization: visualizationJson,
          }
        );
        console.log(`[addMessage] Successfully inserted message ${id} with all columns including visualization`);
      } catch (error) {
        // Fallback: try without visualization column
        if (error instanceof Error && error.message.includes('ORA-00904')) {
          console.warn(`[addMessage] Visualization column doesn't exist, trying without it`);
          try {
            await executeStatement(
              `INSERT INTO messages (id, conversation_id, role, content, tool_calls, tool_call_id, tool_narratives, adaptation_narratives, created_at)
               VALUES (:id, :conversationId, :role, :content, :toolCalls, :toolCallId, :toolNarratives, :adaptationNarratives, SYSTIMESTAMP)`,
              {
                id,
                conversationId,
                role: message.role,
                content: message.content || '',
                toolCalls: toolCallsJson,
                toolCallId: message.toolCallId || null,
                toolNarratives: toolNarrativesJson,
                adaptationNarratives: adaptationNarrativesJson,
              }
            );
          } catch (error2) {
            // Final fallback: insert without optional columns
            if (error2 instanceof Error && error2.message.includes('ORA-00904')) {
              await executeStatement(
                `INSERT INTO messages (id, conversation_id, role, content, tool_calls, tool_call_id, created_at)
                 VALUES (:id, :conversationId, :role, :content, :toolCalls, :toolCallId, SYSTIMESTAMP)`,
                {
                  id,
                  conversationId,
                  role: message.role,
                  content: message.content || '',
                  toolCalls: toolCallsJson,
                  toolCallId: message.toolCallId || null,
                }
              );
            } else {
              throw error2;
            }
          }
        } else {
          throw error;
        }
      }

      // Update conversation timestamp
      await executeStatement(
        `UPDATE conversations SET updated_at = SYSTIMESTAMP WHERE id = :id`,
        { id: conversationId }
      );

      return {
        id,
        role: message.role,
        content: message.content,
        timestamp: new Date(),
        toolCalls: message.toolCalls,
        toolCallId: message.toolCallId,
        toolNarratives: message.toolNarratives,
        adaptationNarratives: message.adaptationNarratives,
        visualization: message.visualization,
      };
    } catch (error) {
      throw new SQLExecutionError(
        `Failed to add message: ${error instanceof Error ? error.message : String(error)}`,
        'INSERT INTO messages',
        error
      );
    }
  }

  /**
   * Get all messages for a conversation in chronological order.
   */
  async getMessages(conversationId: string): Promise<Message[]> {
    await this.ensureInitialized();

    try {
      console.log('[getMessages] Querying messages for conversation:', conversationId);
      // Try with all columns first (including visualization)
      let rows: MessageRow[];
      try {
        rows = await executeQuery<MessageRow>(
          `SELECT id, role, content, tool_calls, tool_call_id, tool_narratives, adaptation_narratives, visualization, created_at
           FROM messages
           WHERE conversation_id = :conversationId
           ORDER BY created_at ASC`,
          { conversationId }
        );
        console.log('[getMessages] Query with all columns succeeded, rows:', rows.length);
      } catch (error) {
        console.log('[getMessages] Query with all columns failed, trying without visualization:', error);
        try {
          rows = await executeQuery<MessageRow>(
            `SELECT id, role, content, tool_calls, tool_call_id, tool_narratives, adaptation_narratives, created_at
             FROM messages
             WHERE conversation_id = :conversationId
             ORDER BY created_at ASC`,
            { conversationId }
          );
          console.log('[getMessages] Query without visualization succeeded, rows:', rows.length);
        } catch (error2) {
          console.log('[getMessages] Query without narratives failed, trying minimal:', error2);
          // Fallback: query without optional columns if they don't exist
          rows = await executeQuery<MessageRow>(
            `SELECT id, role, content, tool_calls, tool_call_id, created_at
             FROM messages
             WHERE conversation_id = :conversationId
             ORDER BY created_at ASC`,
            { conversationId }
          );
          console.log('[getMessages] Minimal query succeeded, rows:', rows.length);
        }
      }

      return rows.map(row => {
        let toolCalls = undefined;
        const toolCallsStr = toString(row.TOOL_CALLS);
        if (toolCallsStr) {
          try {
            toolCalls = JSON.parse(toolCallsStr);
          } catch {
            // Invalid JSON, leave as undefined
          }
        }

        let toolNarratives = undefined;
        const toolNarrativesStr = toString(row.TOOL_NARRATIVES);
        if (toolNarrativesStr) {
          try {
            toolNarratives = JSON.parse(toolNarrativesStr);
          } catch {
            // Invalid JSON, leave as undefined
          }
        }

        let adaptationNarratives = undefined;
        const adaptationNarrativesStr = toString(row.ADAPTATION_NARRATIVES);
        if (adaptationNarrativesStr) {
          try {
            adaptationNarratives = JSON.parse(adaptationNarrativesStr);
          } catch {
            // Invalid JSON, leave as undefined
          }
        }

        let visualization = undefined;
        const visualizationStr = toString(row.VISUALIZATION);
        if (visualizationStr) {
          try {
            visualization = JSON.parse(visualizationStr);
            console.log(`[getMessages] Parsed visualization for message ${row.ID}:`, visualization);
          } catch {
            // Invalid JSON, leave as undefined
            console.log(`[getMessages] Failed to parse visualization for message ${row.ID}`);
          }
        }

        return {
          id: String(row.ID),
          role: String(row.ROLE) as MessageRole,
          content: toString(row.CONTENT),
          toolCalls,
          toolCallId: row.TOOL_CALL_ID ? String(row.TOOL_CALL_ID) : undefined,
          toolNarratives,
          adaptationNarratives,
          visualization,
          timestamp: toDate(row.CREATED_AT),
        };
      });
    } catch (error) {
      throw new SQLExecutionError(
        `Failed to get messages: ${error instanceof Error ? error.message : String(error)}`,
        'SELECT FROM messages',
        error
      );
    }
  }
}
