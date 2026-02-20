/**
 * Unit tests for conversation store with tool narratives and adaptation narratives
 * Validates: Requirements 12.1, 12.3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationStore } from '../../src/db/conversation-store';
import { Message, ToolNarrative } from '../../src/types';
import * as oracleClient from '../../src/db/oracle-client';

// Mock the oracle client
vi.mock('../../src/db/oracle-client', () => ({
  executeQuery: vi.fn(),
  executeStatement: vi.fn(),
  isConnected: vi.fn(),
  initializePool: vi.fn(),
}));

describe('ConversationStore - Tool Narratives and Adaptation Narratives', () => {
  let store: ConversationStore;
  const mockConfig = {
    user: 'test_user',
    password: 'test_password',
    connectString: 'test_connect_string',
    walletLocation: '/test/wallet',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    store = new ConversationStore(mockConfig);
    vi.mocked(oracleClient.initializePool).mockResolvedValue(undefined);
    vi.mocked(oracleClient.isConnected).mockResolvedValue(true);
  });

  describe('addMessage with tool narratives', () => {
    it('should save message with tool narratives', async () => {
      // Arrange
      const conversationId = 'test-conv-id';
      const toolNarratives: ToolNarrative[] = [
        {
          toolCallId: 'tool-1',
          toolName: 'run_sql',
          phase: 'start',
          narrative: "I'm querying the database...",
          timestamp: new Date(),
        },
        {
          toolCallId: 'tool-1',
          toolName: 'run_sql',
          phase: 'result',
          narrative: 'I found 5 results from querying the database.',
          timestamp: new Date(),
        },
      ];

      const message: Omit<Message, 'id'> = {
        role: 'assistant',
        content: 'Here are the results',
        timestamp: new Date(),
        toolNarratives,
      };

      vi.mocked(oracleClient.executeStatement).mockResolvedValue(undefined);

      // Act
      await store.addMessage(conversationId, message);

      // Assert
      expect(oracleClient.executeStatement).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO messages'),
        expect.objectContaining({
          conversationId,
          role: 'assistant',
          content: 'Here are the results',
          toolNarratives: JSON.stringify(toolNarratives),
        })
      );
    });

    it('should save message with adaptation narratives', async () => {
      // Arrange
      const conversationId = 'test-conv-id';
      const adaptationNarratives = [
        'Based on what I found from querying the database, I\'ll now analyze the data to get more specific information.',
        'Using the results from analyzing the data, I\'ll now generate a visualization.',
      ];

      const message: Omit<Message, 'id'> = {
        role: 'assistant',
        content: 'Analysis complete',
        timestamp: new Date(),
        adaptationNarratives,
      };

      vi.mocked(oracleClient.executeStatement).mockResolvedValue(undefined);

      // Act
      await store.addMessage(conversationId, message);

      // Assert
      expect(oracleClient.executeStatement).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO messages'),
        expect.objectContaining({
          conversationId,
          role: 'assistant',
          content: 'Analysis complete',
          adaptationNarratives: JSON.stringify(adaptationNarratives),
        })
      );
    });

    it('should save message with both tool narratives and adaptation narratives', async () => {
      // Arrange
      const conversationId = 'test-conv-id';
      const toolNarratives: ToolNarrative[] = [
        {
          toolCallId: 'tool-1',
          toolName: 'run_sql',
          phase: 'start',
          narrative: "I'm querying the database...",
          timestamp: new Date(),
        },
      ];
      const adaptationNarratives = [
        'Based on the query results, I\'ll now analyze the data.',
      ];

      const message: Omit<Message, 'id'> = {
        role: 'assistant',
        content: 'Complete',
        timestamp: new Date(),
        toolNarratives,
        adaptationNarratives,
      };

      vi.mocked(oracleClient.executeStatement).mockResolvedValue(undefined);

      // Act
      await store.addMessage(conversationId, message);

      // Assert
      expect(oracleClient.executeStatement).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO messages'),
        expect.objectContaining({
          conversationId,
          toolNarratives: JSON.stringify(toolNarratives),
          adaptationNarratives: JSON.stringify(adaptationNarratives),
        })
      );
    });

    it('should handle message without narratives', async () => {
      // Arrange
      const conversationId = 'test-conv-id';
      const message: Omit<Message, 'id'> = {
        role: 'user',
        content: 'Hello',
        timestamp: new Date(),
      };

      vi.mocked(oracleClient.executeStatement).mockResolvedValue(undefined);

      // Act
      await store.addMessage(conversationId, message);

      // Assert
      expect(oracleClient.executeStatement).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO messages'),
        expect.objectContaining({
          conversationId,
          role: 'user',
          content: 'Hello',
          toolNarratives: null,
          adaptationNarratives: null,
        })
      );
    });
  });

  describe('getMessages with tool narratives', () => {
    it('should retrieve messages with tool narratives', async () => {
      // Arrange
      const conversationId = 'test-conv-id';
      const toolNarratives: ToolNarrative[] = [
        {
          toolCallId: 'tool-1',
          toolName: 'run_sql',
          phase: 'start',
          narrative: "I'm querying the database...",
          timestamp: new Date('2024-01-01T10:00:00Z'),
        },
      ];

      const mockRows = [
        {
          ID: 'msg-1',
          ROLE: 'assistant',
          CONTENT: 'Here are the results',
          TOOL_CALLS: null,
          TOOL_CALL_ID: null,
          TOOL_NARRATIVES: JSON.stringify(toolNarratives),
          ADAPTATION_NARRATIVES: null,
          CREATED_AT: new Date('2024-01-01T10:00:00Z'),
        },
      ];

      vi.mocked(oracleClient.executeQuery).mockResolvedValue(mockRows);

      // Act
      const messages = await store.getMessages(conversationId);

      // Assert
      expect(messages).toHaveLength(1);
      expect(messages[0].toolNarratives).toBeDefined();
      expect(messages[0].toolNarratives).toHaveLength(1);
      expect(messages[0].toolNarratives![0].toolCallId).toBe('tool-1');
      expect(messages[0].toolNarratives![0].toolName).toBe('run_sql');
      expect(messages[0].toolNarratives![0].phase).toBe('start');
      expect(messages[0].toolNarratives![0].narrative).toBe("I'm querying the database...");
      // Note: timestamp will be a string after JSON round-trip
      expect(messages[0].toolNarratives![0].timestamp).toBe('2024-01-01T10:00:00.000Z');
    });

    it('should retrieve messages with adaptation narratives', async () => {
      // Arrange
      const conversationId = 'test-conv-id';
      const adaptationNarratives = [
        'Based on the query results, I\'ll now analyze the data.',
      ];

      const mockRows = [
        {
          ID: 'msg-1',
          ROLE: 'assistant',
          CONTENT: 'Analysis complete',
          TOOL_CALLS: null,
          TOOL_CALL_ID: null,
          TOOL_NARRATIVES: null,
          ADAPTATION_NARRATIVES: JSON.stringify(adaptationNarratives),
          CREATED_AT: new Date('2024-01-01T10:00:00Z'),
        },
      ];

      vi.mocked(oracleClient.executeQuery).mockResolvedValue(mockRows);

      // Act
      const messages = await store.getMessages(conversationId);

      // Assert
      expect(messages).toHaveLength(1);
      expect(messages[0].adaptationNarratives).toEqual(adaptationNarratives);
    });

    it('should handle messages without narratives', async () => {
      // Arrange
      const conversationId = 'test-conv-id';

      const mockRows = [
        {
          ID: 'msg-1',
          ROLE: 'user',
          CONTENT: 'Hello',
          TOOL_CALLS: null,
          TOOL_CALL_ID: null,
          TOOL_NARRATIVES: null,
          ADAPTATION_NARRATIVES: null,
          CREATED_AT: new Date('2024-01-01T10:00:00Z'),
        },
      ];

      vi.mocked(oracleClient.executeQuery).mockResolvedValue(mockRows);

      // Act
      const messages = await store.getMessages(conversationId);

      // Assert
      expect(messages).toHaveLength(1);
      expect(messages[0].toolNarratives).toBeUndefined();
      expect(messages[0].adaptationNarratives).toBeUndefined();
    });

    it('should handle invalid JSON in narratives gracefully', async () => {
      // Arrange
      const conversationId = 'test-conv-id';

      const mockRows = [
        {
          ID: 'msg-1',
          ROLE: 'assistant',
          CONTENT: 'Test',
          TOOL_CALLS: null,
          TOOL_CALL_ID: null,
          TOOL_NARRATIVES: 'invalid json',
          ADAPTATION_NARRATIVES: 'also invalid',
          CREATED_AT: new Date('2024-01-01T10:00:00Z'),
        },
      ];

      vi.mocked(oracleClient.executeQuery).mockResolvedValue(mockRows);

      // Act
      const messages = await store.getMessages(conversationId);

      // Assert
      expect(messages).toHaveLength(1);
      expect(messages[0].toolNarratives).toBeUndefined();
      expect(messages[0].adaptationNarratives).toBeUndefined();
    });
  });
});
