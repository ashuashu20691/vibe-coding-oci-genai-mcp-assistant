/**
 * Unit tests for NarrativeStreamingService
 * Tests Requirements 13.1, 13.2, 13.3, 13.6
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NarrativeStreamingService, ConversationContext } from '../../src/services/narrative-streaming-service';

describe('NarrativeStreamingService', () => {
  let service: NarrativeStreamingService;
  let mockContext: ConversationContext;

  beforeEach(() => {
    service = new NarrativeStreamingService();
    mockContext = {
      previousMessages: [
        { role: 'user', content: 'Show me the tables' },
        { role: 'assistant', content: 'I found 3 tables' },
      ],
      currentGoal: 'Explore database schema',
      attemptHistory: [],
    };
  });

  describe('streamPreToolNarrative', () => {
    it('should generate narrative before tool execution', async () => {
      const toolName = 'list_tables';
      const toolArgs = {};
      
      const chunks: string[] = [];
      for await (const chunk of service.streamPreToolNarrative(toolName, toolArgs, mockContext)) {
        chunks.push(chunk);
      }
      
      const narrative = chunks.join('');
      
      // Should contain conversational opening
      expect(narrative.toLowerCase()).toMatch(/let me|i'll|i'm going to/);
      
      // Should end with ellipsis to indicate ongoing action
      expect(narrative).toContain('...');
    });

    it('should include tool action in natural language', async () => {
      const toolName = 'describe_table';
      const toolArgs = { table_name: 'users' };
      
      const chunks: string[] = [];
      for await (const chunk of service.streamPreToolNarrative(toolName, toolArgs, mockContext)) {
        chunks.push(chunk);
      }
      
      const narrative = chunks.join('');
      
      // Should mention the table name
      expect(narrative).toContain('users');
    });

    it('should handle tools with no arguments', async () => {
      const toolName = 'get_schema';
      const toolArgs = {};
      
      const chunks: string[] = [];
      for await (const chunk of service.streamPreToolNarrative(toolName, toolArgs, mockContext)) {
        chunks.push(chunk);
      }
      
      const narrative = chunks.join('');
      
      // Should still generate meaningful narrative
      expect(narrative.length).toBeGreaterThan(0);
      expect(narrative).toMatch(/let me|i'll|i'm going to/i);
    });

    it('should stream content character by character', async () => {
      const toolName = 'list_tables';
      const toolArgs = {};
      
      const chunks: string[] = [];
      for await (const chunk of service.streamPreToolNarrative(toolName, toolArgs, mockContext)) {
        chunks.push(chunk);
      }
      
      // Should have multiple chunks (streaming effect)
      expect(chunks.length).toBeGreaterThan(1);
    });
  });

  describe('streamPostToolNarrative', () => {
    it('should interpret successful results with data', async () => {
      const toolName = 'list_tables';
      const toolResult = ['users', 'orders', 'products'];
      
      const chunks: string[] = [];
      for await (const chunk of service.streamPostToolNarrative(toolName, toolResult, mockContext)) {
        chunks.push(chunk);
      }
      
      const narrative = chunks.join('');
      
      // Should mention the count
      expect(narrative).toContain('3');
      
      // Should be conversational
      expect(narrative.toLowerCase()).toMatch(/found|retrieved|discovered/);
    });

    it('should handle empty results', async () => {
      const toolName = 'search_records';
      const toolResult: unknown[] = [];
      
      const chunks: string[] = [];
      for await (const chunk of service.streamPostToolNarrative(toolName, toolResult, mockContext)) {
        chunks.push(chunk);
      }
      
      const narrative = chunks.join('');
      
      // Should indicate no results
      expect(narrative.toLowerCase()).toMatch(/didn't find|no results|returned no/);
      
      // Should suggest trying different approach
      expect(narrative.toLowerCase()).toMatch(/try|approach|different/);
    });

    it('should handle null results', async () => {
      const toolName = 'get_data';
      const toolResult = null;
      
      const chunks: string[] = [];
      for await (const chunk of service.streamPostToolNarrative(toolName, toolResult, mockContext)) {
        chunks.push(chunk);
      }
      
      const narrative = chunks.join('');
      
      // Should handle gracefully
      expect(narrative.length).toBeGreaterThan(0);
      expect(narrative.toLowerCase()).toMatch(/didn't find|no data/);
    });

    it('should handle object results', async () => {
      const toolName = 'get_config';
      const toolResult = { host: 'localhost', port: 5432, database: 'mydb' };
      
      const chunks: string[] = [];
      for await (const chunk of service.streamPostToolNarrative(toolName, toolResult, mockContext)) {
        chunks.push(chunk);
      }
      
      const narrative = chunks.join('');
      
      // Should mention fields
      expect(narrative).toMatch(/field|data|information/i);
    });

    it('should handle single item arrays', async () => {
      const toolName = 'search_users';
      const toolResult = [{ name: 'Alice', age: 30 }];
      
      const chunks: string[] = [];
      for await (const chunk of service.streamPostToolNarrative(toolName, toolResult, mockContext)) {
        chunks.push(chunk);
      }
      
      const narrative = chunks.join('');
      
      // Should use singular form
      expect(narrative).toMatch(/1 item|1 result/i);
    });
  });

  describe('streamErrorNarrative', () => {
    it('should explain connection errors', async () => {
      const error = new Error('Connection refused');
      const attemptCount = 1;
      const nextAction = 'retry with different host';
      
      const chunks: string[] = [];
      for await (const chunk of service.streamErrorNarrative(error, attemptCount, nextAction)) {
        chunks.push(chunk);
      }
      
      const narrative = chunks.join('');
      
      // Should explain the error
      expect(narrative.toLowerCase()).toMatch(/connection|connect/);
      
      // Should mention recovery plan
      expect(narrative.toLowerCase()).toMatch(/try|retry|approach/);
    });

    it('should explain timeout errors', async () => {
      const error = new Error('Operation timed out');
      const attemptCount = 2;
      const nextAction = 'use simpler query';
      
      const chunks: string[] = [];
      for await (const chunk of service.streamErrorNarrative(error, attemptCount, nextAction)) {
        chunks.push(chunk);
      }
      
      const narrative = chunks.join('');
      
      // Should mention timeout
      expect(narrative.toLowerCase()).toMatch(/took too long|timeout/);
    });

    it('should explain permission errors', async () => {
      const error = new Error('Permission denied');
      const attemptCount = 1;
      const nextAction = 'try different table';
      
      const chunks: string[] = [];
      for await (const chunk of service.streamErrorNarrative(error, attemptCount, nextAction)) {
        chunks.push(chunk);
      }
      
      const narrative = chunks.join('');
      
      // Should mention permission
      expect(narrative.toLowerCase()).toMatch(/permission|access/);
    });

    it('should explain syntax errors', async () => {
      const error = new Error('Invalid SQL syntax');
      const attemptCount = 1;
      const nextAction = 'reformulate query';
      
      const chunks: string[] = [];
      for await (const chunk of service.streamErrorNarrative(error, attemptCount, nextAction)) {
        chunks.push(chunk);
      }
      
      const narrative = chunks.join('');
      
      // Should mention query issue
      expect(narrative.toLowerCase()).toMatch(/query|syntax|issue/);
    });

    it('should request user guidance after max attempts', async () => {
      const error = new Error('Generic error');
      const attemptCount = 5;
      const nextAction = 'ask user';
      
      const chunks: string[] = [];
      for await (const chunk of service.streamErrorNarrative(error, attemptCount, nextAction)) {
        chunks.push(chunk);
      }
      
      const narrative = chunks.join('');
      
      // Should ask for help
      expect(narrative.toLowerCase()).toMatch(/help|understand|could you/);
    });

    it('should vary recovery phrases for different attempts', async () => {
      const error = new Error('Test error');
      
      const narratives: string[] = [];
      
      for (let attempt = 1; attempt <= 4; attempt++) {
        const chunks: string[] = [];
        for await (const chunk of service.streamErrorNarrative(error, attempt, 'retry')) {
          chunks.push(chunk);
        }
        narratives.push(chunks.join(''));
      }
      
      // Should have variation in recovery phrases
      const uniqueNarratives = new Set(narratives);
      expect(uniqueNarratives.size).toBeGreaterThan(1);
    });
  });

  describe('streamTransitionNarrative', () => {
    it('should create smooth transitions between steps', async () => {
      const fromStep = 'listing tables';
      const toStep = 'describe the users table';
      const reasoning = 'I found the users table';
      
      const chunks: string[] = [];
      for await (const chunk of service.streamTransitionNarrative(fromStep, toStep, reasoning)) {
        chunks.push(chunk);
      }
      
      const narrative = chunks.join('');
      
      // Should contain transition phrase
      expect(narrative.toLowerCase()).toMatch(/based on|now that|with this|given|using/);
      
      // Should mention the reasoning
      expect(narrative).toContain(reasoning);
      
      // Should mention next step
      expect(narrative).toContain(toStep);
    });

    it('should show logical flow', async () => {
      const fromStep = 'checking schema';
      const toStep = 'query the data';
      const reasoning = 'the table structure looks correct';
      
      const chunks: string[] = [];
      for await (const chunk of service.streamTransitionNarrative(fromStep, toStep, reasoning)) {
        chunks.push(chunk);
      }
      
      const narrative = chunks.join('');
      
      // Should connect the steps logically
      expect(narrative).toContain(reasoning);
      expect(narrative).toContain(toStep);
    });

    it('should stream content', async () => {
      const fromStep = 'step1';
      const toStep = 'step2';
      const reasoning = 'because of results';
      
      const chunks: string[] = [];
      for await (const chunk of service.streamTransitionNarrative(fromStep, toStep, reasoning)) {
        chunks.push(chunk);
      }
      
      // Should have multiple chunks
      expect(chunks.length).toBeGreaterThan(1);
    });
  });

  describe('conversational tone', () => {
    it('should use natural language throughout', async () => {
      const toolName = 'execute_query';
      const toolArgs = { query: 'SELECT * FROM users' };
      
      const chunks: string[] = [];
      for await (const chunk of service.streamPreToolNarrative(toolName, toolArgs, mockContext)) {
        chunks.push(chunk);
      }
      
      const narrative = chunks.join('');
      
      // Should avoid technical jargon
      expect(narrative.toLowerCase()).not.toContain('execute_query');
      
      // Should be conversational
      expect(narrative.toLowerCase()).toMatch(/let me|i'll|i'm/);
    });

    it('should maintain consistent tone across methods', async () => {
      const narratives: string[] = [];
      
      // Pre-tool narrative
      const preChunks: string[] = [];
      for await (const chunk of service.streamPreToolNarrative('list_tables', {}, mockContext)) {
        preChunks.push(chunk);
      }
      narratives.push(preChunks.join(''));
      
      // Post-tool narrative
      const postChunks: string[] = [];
      for await (const chunk of service.streamPostToolNarrative('list_tables', ['users'], mockContext)) {
        postChunks.push(chunk);
      }
      narratives.push(postChunks.join(''));
      
      // All should be conversational
      narratives.forEach(narrative => {
        expect(narrative.length).toBeGreaterThan(0);
        // Should use first person
        expect(narrative.toLowerCase()).toMatch(/i |i'm|i'll|let me/);
      });
    });
  });

  describe('context awareness', () => {
    it('should adapt narrative based on attempt history', async () => {
      const contextWithHistory: ConversationContext = {
        ...mockContext,
        attemptHistory: [
          {
            toolName: 'list_tables',
            args: {},
            result: [],
            success: false,
            timestamp: new Date(),
          },
        ],
      };
      
      const chunks: string[] = [];
      for await (const chunk of service.streamPostToolNarrative('list_tables', [], contextWithHistory)) {
        chunks.push(chunk);
      }
      
      const narrative = chunks.join('');
      
      // Should acknowledge this is a retry
      expect(narrative.toLowerCase()).toMatch(/either|also|still/);
    });
  });
});
