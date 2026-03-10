/**
 * Integration test for backend compatibility - Streaming chunk transformation
 * 
 * Validates that all streaming chunk types from the backend are correctly
 * mapped to AI Elements format and displayed in appropriate components.
 * 
 * Task 13.1: Verify streaming chunk transformation
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { describe, it, expect } from 'vitest';
import {
  transformStreamingChunk,
  type StreamingChunk,
  type AIElementsChunkUpdate,
} from '../../src/lib/ai-elements-adapters';

describe('Backend Compatibility - Streaming Chunk Transformation', () => {
  describe('Content chunks', () => {
    it('should transform content chunk to AI Elements format', () => {
      const chunk: StreamingChunk = {
        content: 'Hello, this is a response.',
      };

      const result = transformStreamingChunk(chunk);

      expect(result).toEqual({
        type: 'content',
        content: 'Hello, this is a response.',
      });
    });

    it('should handle empty content chunk', () => {
      const chunk: StreamingChunk = {
        content: '',
      };

      const result = transformStreamingChunk(chunk);

      // Empty content returns null (no meaningful update)
      expect(result).toBeNull();
    });
  });

  describe('Tool call chunks', () => {
    it('should transform toolCall chunk to AI Elements format', () => {
      const chunk: StreamingChunk = {
        toolCall: {
          id: 'tool-123',
          name: 'sqlcl_run_sql',
          arguments: {
            sql: 'SELECT * FROM users',
          },
        },
      };

      const result = transformStreamingChunk(chunk);

      expect(result).toEqual({
        type: 'tool',
        toolInvocation: {
          toolCallId: 'tool-123',
          toolName: 'sqlcl_run_sql',
          args: {
            sql: 'SELECT * FROM users',
          },
          state: 'call',
        },
      });
    });

    it('should handle tool call with complex arguments', () => {
      const chunk: StreamingChunk = {
        toolCall: {
          id: 'tool-456',
          name: 'mcp_database_query',
          arguments: {
            connection: 'LiveLab',
            query: 'SELECT id, name, email FROM users WHERE active = true',
            parameters: { limit: 100 },
          },
        },
      };

      const result = transformStreamingChunk(chunk);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('tool');
      expect(result?.toolInvocation?.toolName).toBe('mcp_database_query');
      expect(result?.toolInvocation?.args).toEqual({
        connection: 'LiveLab',
        query: 'SELECT id, name, email FROM users WHERE active = true',
        parameters: { limit: 100 },
      });
    });
  });

  describe('Tool narrative chunks', () => {
    it('should transform tool_narrative chunk to content', () => {
      const chunk: StreamingChunk = {
        tool_narrative: 'Let me query the database for you...',
      };

      const result = transformStreamingChunk(chunk);

      expect(result).toEqual({
        type: 'content',
        content: 'Let me query the database for you...',
      });
    });
  });

  describe('Adaptation chunks', () => {
    it('should transform adaptation chunk to content', () => {
      const chunk: StreamingChunk = {
        adaptation: 'I\'ll adjust my approach based on the results.',
      };

      const result = transformStreamingChunk(chunk);

      expect(result).toEqual({
        type: 'content',
        content: 'I\'ll adjust my approach based on the results.',
      });
    });
  });

  describe('Progress chunks', () => {
    it('should transform progress chunk to content', () => {
      const chunk: StreamingChunk = {
        progress: 'Processing step 2 of 5...',
      };

      const result = transformStreamingChunk(chunk);

      expect(result).toEqual({
        type: 'content',
        content: 'Processing step 2 of 5...',
      });
    });
  });

  describe('Thinking chunks', () => {
    it('should transform thinking chunk to content', () => {
      const chunk: StreamingChunk = {
        thinking: 'I need to analyze the schema first...',
      };

      const result = transformStreamingChunk(chunk);

      expect(result).toEqual({
        type: 'content',
        content: 'I need to analyze the schema first...',
      });
    });
  });

  describe('Visualization chunks', () => {
    it('should transform visualization chunk with HTML', () => {
      const chunk: StreamingChunk = {
        visualization: {
          type: 'bar',
          html: '<div>Chart HTML</div>',
          title: 'Sales Data',
        },
      };

      const result = transformStreamingChunk(chunk);

      expect(result).toEqual({
        type: 'visualization',
        visualization: {
          type: 'bar',
          html: '<div>Chart HTML</div>',
          title: 'Sales Data',
        },
      });
    });

    it('should transform visualization chunk with data', () => {
      const chunk: StreamingChunk = {
        visualization: {
          type: 'table',
          data: [
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' },
          ],
          title: 'User List',
        },
      };

      const result = transformStreamingChunk(chunk);

      expect(result).toEqual({
        type: 'visualization',
        visualization: {
          type: 'table',
          data: [
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' },
          ],
          title: 'User List',
        },
      });
    });

    it('should handle visualization routed to artifacts panel', () => {
      const chunk: StreamingChunk = {
        visualization: {
          type: 'custom_dashboard',
          html: '<div>Large dashboard HTML...</div>',
          title: 'Analytics Dashboard',
          routedToArtifacts: true,
        },
      };

      const result = transformStreamingChunk(chunk);

      expect(result?.type).toBe('visualization');
      expect(result?.visualization?.routedToArtifacts).toBe(true);
    });
  });

  describe('Analysis chunks', () => {
    it('should transform analysis chunk with summary', () => {
      const chunk: StreamingChunk = {
        analysis: {
          summary: 'The data shows a clear upward trend.',
          insights: [
            'Sales increased by 25% this quarter',
            'Top performing region is North America',
          ],
        },
      };

      const result = transformStreamingChunk(chunk);

      expect(result).toEqual({
        type: 'analysis',
        analysis: {
          summary: 'The data shows a clear upward trend.',
          insights: [
            'Sales increased by 25% this quarter',
            'Top performing region is North America',
          ],
        },
      });
    });

    it('should transform analysis chunk with statistics', () => {
      const chunk: StreamingChunk = {
        analysis: {
          summary: 'Statistical analysis complete',
          statistics: {
            mean: 42.5,
            median: 40,
            stdDev: 12.3,
          },
        },
      };

      const result = transformStreamingChunk(chunk);

      expect(result?.type).toBe('analysis');
      expect(result?.analysis?.statistics).toEqual({
        mean: 42.5,
        median: 40,
        stdDev: 12.3,
      });
    });
  });

  describe('Artifact update chunks', () => {
    it('should handle artifact_update chunk', () => {
      const chunk: StreamingChunk = {
        artifact_update: {
          id: 'artifact-1',
          version: 2,
          content: 'Updated content',
        },
      };

      // artifact_update chunks are not directly transformed to AI Elements format
      // They are handled separately in the artifacts panel
      const result = transformStreamingChunk(chunk);

      // Should return null as these are handled separately
      expect(result).toBeNull();
    });
  });

  describe('Iteration update chunks', () => {
    it('should handle iteration_update chunk', () => {
      const chunk: StreamingChunk = {
        iteration_update: {
          current: 2,
          max: 5,
          strategy: 'Retrying with adjusted parameters',
        },
      };

      // iteration_update chunks are not directly transformed to AI Elements format
      // They are handled separately for progress indicators
      const result = transformStreamingChunk(chunk);

      // Should return null as these are handled separately
      expect(result).toBeNull();
    });
  });

  describe('Error chunks', () => {
    it('should transform error chunk', () => {
      const chunk: StreamingChunk = {
        error: 'Connection to database failed',
      };

      const result = transformStreamingChunk(chunk);

      expect(result).toEqual({
        type: 'error',
        error: 'Connection to database failed',
      });
    });

    it('should handle detailed error messages', () => {
      const chunk: StreamingChunk = {
        error: 'ORA-12154: TNS:could not resolve the connect identifier specified',
      };

      const result = transformStreamingChunk(chunk);

      expect(result?.type).toBe('error');
      expect(result?.error).toContain('ORA-12154');
    });
  });

  describe('Multiple chunk types in sequence', () => {
    it('should correctly transform a sequence of different chunk types', () => {
      const chunks: StreamingChunk[] = [
        { thinking: 'Analyzing the request...' },
        { tool_narrative: 'Let me connect to the database.' },
        {
          toolCall: {
            id: 'tool-1',
            name: 'sqlcl_connect',
            arguments: { connection_name: 'LiveLab' },
          },
        },
        { progress: 'Connected successfully.' },
        {
          toolCall: {
            id: 'tool-2',
            name: 'sqlcl_run_sql',
            arguments: { sql: 'SELECT COUNT(*) FROM users' },
          },
        },
        {
          visualization: {
            type: 'table',
            data: [{ count: 150 }],
            title: 'User Count',
          },
        },
        { content: 'There are 150 users in the database.' },
      ];

      const results = chunks.map(transformStreamingChunk).filter(r => r !== null);

      expect(results).toHaveLength(7);
      expect(results[0]?.type).toBe('content'); // thinking
      expect(results[1]?.type).toBe('content'); // tool_narrative
      expect(results[2]?.type).toBe('tool'); // toolCall
      expect(results[3]?.type).toBe('content'); // progress
      expect(results[4]?.type).toBe('tool'); // toolCall
      expect(results[5]?.type).toBe('visualization'); // visualization
      expect(results[6]?.type).toBe('content'); // content
    });
  });

  describe('Edge cases', () => {
    it('should handle chunk with multiple fields (priority order)', () => {
      // If a chunk has multiple fields, content takes priority
      const chunk: StreamingChunk = {
        content: 'Main content',
        thinking: 'Some thinking',
      };

      const result = transformStreamingChunk(chunk);

      expect(result?.type).toBe('content');
      expect(result?.content).toBe('Main content');
    });

    it('should return null for empty chunk', () => {
      const chunk: StreamingChunk = {};

      const result = transformStreamingChunk(chunk);

      expect(result).toBeNull();
    });

    it('should handle chunk with null values', () => {
      const chunk: StreamingChunk = {
        content: undefined,
        toolCall: undefined,
        error: undefined,
      };

      const result = transformStreamingChunk(chunk);

      expect(result).toBeNull();
    });
  });
});
