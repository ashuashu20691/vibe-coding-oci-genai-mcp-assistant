// __tests__/unit/orchestrator-iteration-integration.test.ts
/**
 * Integration tests for DatabaseOrchestrator with IterationStateMachine
 * Validates: Requirements 14.1, 14.2, 14.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseOrchestrator } from '../../src/mastra/agents/orchestrator';

// Mock the MCP tools
vi.mock('../../src/mastra/agents/database-agent', () => ({
  getMCPTools: vi.fn(),
  getAgentState: vi.fn(),
  updateAgentState: vi.fn(),
}));

// Import mocked functions after mock setup
import { getMCPTools, getAgentState, updateAgentState } from '../../src/mastra/agents/database-agent';

describe('DatabaseOrchestrator with IterationStateMachine', () => {
  let orchestrator: DatabaseOrchestrator;
  const mockExecute = vi.fn();

  beforeEach(() => {
    orchestrator = new DatabaseOrchestrator('test-conversation', 'test-model');
    vi.clearAllMocks();
    
    vi.mocked(getAgentState).mockReturnValue({ 
      activeConnection: 'test-connection', 
      conversationId: 'test' 
    });
  });

  describe('executeWithRetry integration', () => {
    it('should succeed on first attempt when tool returns valid data', async () => {
      const mockResult = {
        content: [{ text: 'id,name\n1,Alice\n2,Bob' }],
        isError: false,
      };

      mockExecute.mockResolvedValue(mockResult);
      vi.mocked(getMCPTools).mockResolvedValue({
        'run-sql': { execute: mockExecute },
      });

      const result = await orchestrator.executeTool('run-sql', { sql: 'SELECT * FROM users' });

      expect(result.success).toBe(true);
      expect(result.iterationCount).toBe(1);
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('should retry up to 5 times on failure', async () => {
      mockExecute
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockRejectedValueOnce(new Error('Connection timeout'));

      vi.mocked(getMCPTools).mockResolvedValue({
        'run-sql': { execute: mockExecute },
      });

      const result = await orchestrator.executeTool('run-sql', { sql: 'SELECT * FROM users' });

      expect(result.success).toBe(false);
      expect(result.iterationCount).toBe(5);
      expect(result.error).toBeDefined();
      expect(mockExecute).toHaveBeenCalledTimes(5);
    });

    it('should succeed on retry after initial failure', async () => {
      const mockResult = {
        content: [{ text: 'id,name\n1,Alice' }],
        isError: false,
      };

      mockExecute
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce(mockResult);

      vi.mocked(getMCPTools).mockResolvedValue({
        'run-sql': { execute: mockExecute },
      });

      const result = await orchestrator.executeTool('run-sql', { sql: 'SELECT * FROM users' });

      expect(result.success).toBe(true);
      expect(result.iterationCount).toBe(3);
      expect(mockExecute).toHaveBeenCalledTimes(3);
    });

    it('should emit iteration updates during retry loop', async () => {
      const iterationUpdates: Array<{ iteration: number; max: number }> = [];
      
      orchestrator.setIterationUpdateCallback((iteration, max) => {
        iterationUpdates.push({ iteration, max });
      });

      mockExecute
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValueOnce({ content: [{ text: 'success' }], isError: false });

      vi.mocked(getMCPTools).mockResolvedValue({
        'run-sql': { execute: mockExecute },
      });

      await orchestrator.executeTool('run-sql', { sql: 'SELECT 1' });

      expect(iterationUpdates).toEqual([
        { iteration: 1, max: 5 },
        { iteration: 2, max: 5 },
        { iteration: 3, max: 5 },
      ]);
    });

    it('should include attempt summaries in result', async () => {
      mockExecute
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce({ content: [{ text: 'data' }], isError: false });

      vi.mocked(getMCPTools).mockResolvedValue({
        'run-sql': { execute: mockExecute },
      });

      const result = await orchestrator.executeTool('run-sql', { sql: 'SELECT 1' });

      expect(result.success).toBe(true);
      expect(result.attemptSummaries).toBeDefined();
      expect(result.attemptSummaries?.length).toBeGreaterThan(0);
      expect(result.attemptSummaries?.[0]).toContain('Attempt 1');
    });

    it('should not retry authentication errors', async () => {
      mockExecute.mockRejectedValue(new Error('authentication failed'));

      vi.mocked(getMCPTools).mockResolvedValue({
        'run-sql': { execute: mockExecute },
      });

      const result = await orchestrator.executeTool('run-sql', { sql: 'SELECT 1' });

      expect(result.success).toBe(false);
      expect(mockExecute).toHaveBeenCalledTimes(1); // Should not retry
    });

    it('should handle connection errors with reconnection strategy', async () => {
      const mockConnectResult = { content: [{ text: 'Connected' }], isError: false };
      const mockQueryResult = { content: [{ text: 'id,name\n1,Alice' }], isError: false };

      let callCount = 0;
      mockExecute.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('not connected'));
        }
        return Promise.resolve(mockQueryResult);
      });

      vi.mocked(getMCPTools).mockResolvedValue({
        'run-sql': { execute: mockExecute },
        'connect': { execute: vi.fn().mockResolvedValue(mockConnectResult) },
        'list-connections': { 
          execute: vi.fn().mockResolvedValue({ 
            content: [{ text: 'test-connection' }], 
            isError: false 
          }) 
        },
      });

      const result = await orchestrator.executeTool('run-sql', { sql: 'SELECT * FROM users' });

      expect(result.success).toBe(true);
      expect(result.iterationCount).toBeGreaterThan(1);
    });
  });

  describe('iteration state tracking', () => {
    it('should track iteration count across multiple tool executions', async () => {
      const mockResult = { content: [{ text: 'data' }], isError: false };
      mockExecute.mockResolvedValue(mockResult);

      vi.mocked(getMCPTools).mockResolvedValue({
        'run-sql': { execute: mockExecute },
      });

      const result1 = await orchestrator.executeTool('run-sql', { sql: 'SELECT 1' });
      const result2 = await orchestrator.executeTool('run-sql', { sql: 'SELECT 2' });

      expect(result1.iterationCount).toBe(1);
      expect(result2.iterationCount).toBe(1);
    });
  });
});
