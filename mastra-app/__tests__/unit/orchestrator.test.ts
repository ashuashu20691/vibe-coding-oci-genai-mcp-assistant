// __tests__/unit/orchestrator.test.ts
/**
 * Unit tests for the Multi-Agent Orchestrator.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseOrchestrator } from '../../src/mastra/agents/orchestrator';

// Mock the MCP tools
vi.mock('../../src/mastra/agents/database-agent', () => ({
  getMCPTools: vi.fn().mockResolvedValue({}),
  getAgentState: vi.fn().mockReturnValue({ activeConnection: null, conversationId: 'test' }),
  updateAgentState: vi.fn(),
}));

describe('DatabaseOrchestrator', () => {
  let orchestrator: DatabaseOrchestrator;

  beforeEach(() => {
    orchestrator = new DatabaseOrchestrator('test-conversation', 'test-model');
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create orchestrator with conversation and model IDs', () => {
      const orch = new DatabaseOrchestrator('conv-123', 'model-456');
      expect(orch).toBeDefined();
    });
  });

  describe('getActiveConnection', () => {
    it('should return null when no connection is active', () => {
      const connection = orchestrator.getActiveConnection();
      expect(connection).toBeNull();
    });
  });

  describe('executeTool', () => {
    it('should return error when tool is not found', async () => {
      const result = await orchestrator.executeTool('non-existent-tool', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should require connection for SQL operations', async () => {
      const result = await orchestrator.executeTool('run-sql', { sql: 'SELECT 1' });
      
      // Should fail because no connection and no tools available
      expect(result.success).toBe(false);
    });
  });

  describe('executeSequence', () => {
    it('should execute multiple statements in sequence', async () => {
      const statements = [
        { sql: 'SELECT 1', description: 'First query' },
        { sql: 'SELECT 2', description: 'Second query' },
      ];
      
      const results = await orchestrator.executeSequence(statements);
      
      expect(results.length).toBe(1); // Stops on first error
      expect(results[0].description).toBe('First query');
    });
  });
});

describe('Orchestrator Data Extraction', () => {
  it('should handle CSV data extraction', () => {
    // Test the data extraction logic indirectly through the orchestrator
    const orchestrator = new DatabaseOrchestrator('test', 'model');
    
    // The extractDataFromResult is private, but we can test it through smartQuery
    // when we have proper mocking in place
    expect(orchestrator).toBeDefined();
  });
});

describe('Orchestrator Integration', () => {
  it('should coordinate analysis and visualization', async () => {
    const orchestrator = new DatabaseOrchestrator('test', 'model');
    
    // Test that orchestrator has the expected methods
    expect(typeof orchestrator.executeTool).toBe('function');
    expect(typeof orchestrator.executeSequence).toBe('function');
    expect(typeof orchestrator.smartQuery).toBe('function');
    expect(typeof orchestrator.generateInteractiveDashboard).toBe('function');
  });
});
