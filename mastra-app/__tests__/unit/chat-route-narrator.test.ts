/**
 * Unit tests for ConversationalNarrator integration in chat API route
 * 
 * Tests verify that:
 * - Tool execution generates conversational explanations
 * - Tool results generate conversational explanations
 * - Errors generate conversational explanations
 * - All conversational content is streamed via SSE
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { conversationalNarrator } from '@/services/conversational-narrator';

describe('Chat Route - ConversationalNarrator Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Tool Execution Narratives', () => {
    it('should generate conversational explanation for tool start', () => {
      const toolName = 'sqlcl_run_sql';
      const args = { sql: 'SELECT * FROM users' };
      
      const narrative = conversationalNarrator.narrateToolStart(toolName, args);
      
      expect(narrative).toBeTruthy();
      expect(narrative.length).toBeGreaterThan(0);
      expect(narrative).toMatch(/\w+/); // Contains words
      expect(narrative.toLowerCase()).not.toContain('sqlcl'); // Technical name removed
    });

    it('should format tool names to natural language', () => {
      const toolName = 'run_sql_query';
      const args = {};
      
      const narrative = conversationalNarrator.narrateToolStart(toolName, args);
      
      expect(narrative).not.toContain('_'); // No underscores
      expect(narrative).not.toContain('run_sql_query'); // Original name not present
    });

    it('should include relevant arguments in explanation', () => {
      const toolName = 'connect_database';
      const args = { connection_name: 'LiveLab' };
      
      const narrative = conversationalNarrator.narrateToolStart(toolName, args);
      
      expect(narrative).toBeTruthy();
      expect(narrative.length).toBeGreaterThan(0);
    });

    it('should handle tools with no arguments', () => {
      const toolName = 'list_connections';
      const args = {};
      
      const narrative = conversationalNarrator.narrateToolStart(toolName, args);
      
      expect(narrative).toBeTruthy();
      expect(narrative.length).toBeGreaterThan(0);
    });
  });

  describe('Tool Result Narratives', () => {
    it('should generate conversational explanation for successful results', () => {
      const toolName = 'run_sql';
      const result = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];
      
      const narrative = conversationalNarrator.narrateToolResult(toolName, result);
      
      expect(narrative).toBeTruthy();
      expect(narrative).toContain('2'); // Mentions count
      expect(narrative.toLowerCase()).toMatch(/found|result/); // Describes finding
    });

    it('should handle empty results conversationally', () => {
      const toolName = 'run_sql';
      const result: unknown[] = [];
      
      const narrative = conversationalNarrator.narrateToolResult(toolName, result);
      
      expect(narrative).toBeTruthy();
      expect(narrative.toLowerCase()).toMatch(/no|empty|didn't find/);
    });

    it('should handle null results conversationally', () => {
      const toolName = 'run_sql';
      const result = null;
      
      const narrative = conversationalNarrator.narrateToolResult(toolName, result);
      
      expect(narrative).toBeTruthy();
      expect(narrative.toLowerCase()).toMatch(/no|didn't find/);
    });

    it('should describe structured data results', () => {
      const toolName = 'get_schema';
      const result = {
        tables: ['users', 'orders', 'products'],
        views: ['user_orders'],
      };
      
      const narrative = conversationalNarrator.narrateToolResult(toolName, result);
      
      expect(narrative).toBeTruthy();
      expect(narrative.toLowerCase()).toMatch(/field|data|retrieved/);
    });
  });

  describe('Error Narratives', () => {
    it('should generate user-friendly error explanation for connection errors', () => {
      const toolName = 'connect_database';
      const error = new Error('Connection refused');
      
      const narrative = conversationalNarrator.narrateToolError(toolName, error);
      
      expect(narrative).toBeTruthy();
      expect(narrative.toLowerCase()).toMatch(/connection|connect/);
      expect(narrative.toLowerCase()).toMatch(/try|approach/); // Suggests recovery
      expect(narrative).not.toContain('Connection refused'); // No technical jargon
    });

    it('should generate user-friendly error explanation for timeout errors', () => {
      const toolName = 'run_sql';
      const error = new Error('Query timed out after 30s');
      
      const narrative = conversationalNarrator.narrateToolError(toolName, error);
      
      expect(narrative).toBeTruthy();
      expect(narrative.toLowerCase()).toMatch(/timeout|took too long/);
      expect(narrative.toLowerCase()).toMatch(/try|simpler/); // Suggests alternative
    });

    it('should generate user-friendly error explanation for permission errors', () => {
      const toolName = 'run_sql';
      const error = new Error('Permission denied');
      
      const narrative = conversationalNarrator.narrateToolError(toolName, error);
      
      expect(narrative).toBeTruthy();
      expect(narrative.toLowerCase()).toMatch(/permission|access/);
      expect(narrative.toLowerCase()).toMatch(/check|settings/); // Suggests user action
    });

    it('should generate user-friendly error explanation for not found errors', () => {
      const toolName = 'get_table';
      const error = new Error('Table not found');
      
      const narrative = conversationalNarrator.narrateToolError(toolName, error);
      
      expect(narrative).toBeTruthy();
      expect(narrative.toLowerCase()).toMatch(/not found|couldn't find/);
      expect(narrative.toLowerCase()).toMatch(/try|elsewhere/); // Suggests alternative
    });

    it('should generate user-friendly error explanation for syntax errors', () => {
      const toolName = 'run_sql';
      const error = new Error('SQL syntax error near SELECT');
      
      const narrative = conversationalNarrator.narrateToolError(toolName, error);
      
      expect(narrative).toBeTruthy();
      expect(narrative.toLowerCase()).toMatch(/syntax|issue|query/);
      expect(narrative.toLowerCase()).toMatch(/reformulate|try again/); // Suggests fix
    });

    it('should handle generic errors with recovery suggestion', () => {
      const toolName = 'unknown_tool';
      const error = new Error('Unknown error occurred');
      
      const narrative = conversationalNarrator.narrateToolError(toolName, error);
      
      expect(narrative).toBeTruthy();
      expect(narrative.toLowerCase()).toMatch(/issue|error/);
      expect(narrative.toLowerCase()).toMatch(/try|approach/); // Suggests recovery
    });
  });

  describe('Narrative Consistency', () => {
    it('should maintain consistent narrative voice across tool types', () => {
      const tools = [
        'run_sql',
        'connect_database',
        'list_connections',
        'get_schema',
      ];
      
      const narratives = tools.map(tool => 
        conversationalNarrator.narrateToolStart(tool, {})
      );
      
      // All narratives should be conversational (contain common words)
      narratives.forEach(narrative => {
        expect(narrative).toBeTruthy();
        expect(narrative.length).toBeGreaterThan(0);
        expect(narrative).toMatch(/\w+/);
      });
    });

    it('should not expose technical tool names in narratives', () => {
      const technicalNames = [
        'sqlcl_run_sql',
        'mcp_connect',
        'db_query_exec',
      ];
      
      technicalNames.forEach(toolName => {
        const narrative = conversationalNarrator.narrateToolStart(toolName, {});
        
        // Should not contain underscores or technical prefixes
        expect(narrative).not.toContain('sqlcl');
        expect(narrative).not.toContain('mcp');
        expect(narrative).not.toContain('_');
      });
    });
  });

  describe('Streaming Integration', () => {
    it('should generate narratives that can be streamed token-by-token', () => {
      const toolName = 'run_sql';
      const args = { sql: 'SELECT * FROM users' };
      
      const narrative = conversationalNarrator.narrateToolStart(toolName, args);
      
      // Narrative should be a string that can be split into tokens
      expect(typeof narrative).toBe('string');
      expect(narrative.length).toBeGreaterThan(0);
      
      // Should be able to split into words/tokens
      const tokens = narrative.split(/\s+/);
      expect(tokens.length).toBeGreaterThan(0);
    });

    it('should generate narratives with proper formatting for SSE', () => {
      const toolName = 'run_sql';
      const result = [{ id: 1 }, { id: 2 }];
      
      const narrative = conversationalNarrator.narrateToolResult(toolName, result);
      
      // Should not contain characters that break SSE format
      expect(narrative).not.toContain('\n\n'); // Double newline breaks SSE
      expect(narrative).not.toMatch(/^data:/); // Should not have SSE prefix
    });
  });

  describe('Adaptation Narratives', () => {
    it('should generate connection narrative for tool chain refinement', () => {
      const context = {
        previousAction: 'list_connections',
        previousResult: ['LiveLab', 'BASE_DB'],
        nextAction: 'connect_database',
        reason: 'follow',
      };
      
      const narrative = conversationalNarrator.narrateAdaptation(context);
      
      expect(narrative).toBeTruthy();
      expect(narrative.length).toBeGreaterThan(0);
      expect(narrative.toLowerCase()).toMatch(/list|connect/);
    });

    it('should explain refinement when narrowing results', () => {
      const context = {
        previousAction: 'run_sql',
        previousResult: [{ id: 1 }, { id: 2 }, { id: 3 }],
        nextAction: 'run_sql',
        reason: 'refine',
      };
      
      const narrative = conversationalNarrator.narrateAdaptation(context);
      
      expect(narrative).toBeTruthy();
      expect(narrative.toLowerCase()).toMatch(/based|found|specific/);
    });

    it('should explain expansion when broadening search', () => {
      const context = {
        previousAction: 'run_sql',
        previousResult: [],
        nextAction: 'run_sql',
        reason: 'expand',
      };
      
      const narrative = conversationalNarrator.narrateAdaptation(context);
      
      expect(narrative).toBeTruthy();
      expect(narrative.toLowerCase()).toMatch(/limited|explore|more/);
    });

    it('should explain alternative approach when changing strategy', () => {
      const context = {
        previousAction: 'connect_database',
        previousResult: null,
        nextAction: 'list_connections',
        reason: 'alternative',
      };
      
      const narrative = conversationalNarrator.narrateAdaptation(context);
      
      expect(narrative).toBeTruthy();
      expect(narrative.toLowerCase()).toMatch(/didn't work|instead|different/);
    });

    it('should explain sequential steps in multi-step operations', () => {
      const context = {
        previousAction: 'list_connections',
        previousResult: ['LiveLab'],
        nextAction: 'connect_database',
        reason: 'follow',
      };
      
      const narrative = conversationalNarrator.narrateAdaptation(context);
      
      expect(narrative).toBeTruthy();
      expect(narrative.toLowerCase()).toMatch(/now|completed|continue/);
    });

    it('should format tool names naturally in adaptation narratives', () => {
      const context = {
        previousAction: 'sqlcl_list_connections',
        previousResult: ['db1'],
        nextAction: 'sqlcl_connect',
        reason: 'follow',
      };
      
      const narrative = conversationalNarrator.narrateAdaptation(context);
      
      expect(narrative).toBeTruthy();
      expect(narrative).not.toContain('sqlcl'); // Technical prefix removed
      expect(narrative).not.toContain('_'); // No underscores
    });

    it('should maintain conversational tone in adaptation narratives', () => {
      const contexts = [
        { previousAction: 'list', previousResult: [], nextAction: 'search', reason: 'alternative' },
        { previousAction: 'query', previousResult: [1, 2], nextAction: 'analyze', reason: 'follow' },
        { previousAction: 'connect', previousResult: null, nextAction: 'retry', reason: 'refine' },
      ];
      
      contexts.forEach(context => {
        const narrative = conversationalNarrator.narrateAdaptation(context);
        
        expect(narrative).toBeTruthy();
        expect(narrative.length).toBeGreaterThan(0);
        expect(narrative).toMatch(/\w+/); // Contains words
      });
    });
  });

  describe('Progress Tracking Narratives', () => {
    it('should generate progress message with step numbers', () => {
      const currentStep = 2;
      const totalSteps = 5;
      const stepDescription = 'Analyzing data';
      
      const narrative = conversationalNarrator.narrateProgress(currentStep, totalSteps, stepDescription);
      
      expect(narrative).toBeTruthy();
      expect(narrative).toContain('2');
      expect(narrative).toContain('5');
      expect(narrative).toContain('Analyzing data');
      expect(narrative.toLowerCase()).toMatch(/step/);
    });

    it('should format progress message conversationally', () => {
      const narrative = conversationalNarrator.narrateProgress(1, 3, 'Connecting to database');
      
      expect(narrative).toBeTruthy();
      expect(narrative).toMatch(/Step \d+ of \d+:/);
      expect(narrative).toContain('Connecting to database');
    });

    it('should handle first step correctly', () => {
      const narrative = conversationalNarrator.narrateProgress(1, 5, 'Starting analysis');
      
      expect(narrative).toBeTruthy();
      expect(narrative).toContain('1');
      expect(narrative).toContain('5');
      expect(narrative).toContain('Starting analysis');
    });

    it('should handle last step correctly', () => {
      const narrative = conversationalNarrator.narrateProgress(5, 5, 'Finalizing results');
      
      expect(narrative).toBeTruthy();
      expect(narrative).toContain('5');
      expect(narrative).toContain('Finalizing results');
    });

    it('should generate completion summary', () => {
      const totalSteps = 5;
      const summary = 'Retrieved and analyzed supplier data';
      
      const narrative = conversationalNarrator.narrateCompletion(totalSteps, summary);
      
      expect(narrative).toBeTruthy();
      expect(narrative).toContain('5');
      expect(narrative).toContain(summary);
      expect(narrative.toLowerCase()).toMatch(/completed|done|finished/);
    });

    it('should include checkmark in completion message', () => {
      const narrative = conversationalNarrator.narrateCompletion(3, 'All done');
      
      expect(narrative).toBeTruthy();
      expect(narrative).toMatch(/✓|completed/i);
    });

    it('should handle single-step completion', () => {
      const narrative = conversationalNarrator.narrateCompletion(1, 'Query executed');
      
      expect(narrative).toBeTruthy();
      expect(narrative).toContain('1');
      expect(narrative).toContain('Query executed');
    });

    it('should handle multi-step completion', () => {
      const narrative = conversationalNarrator.narrateCompletion(10, 'Complex analysis finished');
      
      expect(narrative).toBeTruthy();
      expect(narrative).toContain('10');
      expect(narrative).toContain('Complex analysis finished');
    });
  });
});
