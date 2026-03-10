/**
 * Integration test for backend compatibility - MCP integration
 * 
 * Validates that the new AI Elements frontend correctly displays
 * MCP tool execution and database query results.
 * 
 * Task 13.3: Verify MCP integration compatibility
 * Validates: Requirement 7.7
 */

import { describe, it, expect } from 'vitest';
import {
  toAIElementsToolInvocation,
  formatToolName,
  formatToolArguments,
  formatToolResult,
  type AIElementsToolStatus,
} from '../../src/lib/ai-elements-adapters';
import type { ToolCall } from '../../src/types';

describe('Backend Compatibility - MCP Integration', () => {
  describe('MCP tool execution display', () => {
    it('should display sqlcl_connect tool execution', () => {
      const toolCall: ToolCall = {
        id: 'tool-connect-1',
        name: 'sqlcl_connect',
        arguments: {
          connection_name: 'LiveLab',
        },
      };

      const invocation = toAIElementsToolInvocation(
        toolCall,
        'executing'
      );

      expect(invocation).toEqual({
        toolCallId: 'tool-connect-1',
        toolName: 'sqlcl_connect',
        args: {
          connection_name: 'LiveLab',
        },
        state: 'call',
        result: undefined,
        error: undefined,
        executionTime: undefined,
      });

      // Verify formatted display name
      const displayName = formatToolName(toolCall.name);
      expect(displayName).toBe('Connect');
    });

    it('should display sqlcl_run_sql tool execution', () => {
      const toolCall: ToolCall = {
        id: 'tool-query-1',
        name: 'sqlcl_run_sql',
        arguments: {
          sql: 'SELECT id, name, email FROM users WHERE active = 1',
        },
      };

      const invocation = toAIElementsToolInvocation(
        toolCall,
        'executing'
      );

      expect(invocation.toolName).toBe('sqlcl_run_sql');
      expect(invocation.args.sql).toContain('SELECT');

      // Verify formatted display name
      const displayName = formatToolName(toolCall.name);
      expect(displayName).toBe('Run Sql');
    });

    it('should display sqlcl_list_tables tool execution', () => {
      const toolCall: ToolCall = {
        id: 'tool-list-1',
        name: 'sqlcl_list_tables',
        arguments: {},
      };

      const invocation = toAIElementsToolInvocation(
        toolCall,
        'completed',
        {
          tables: ['users', 'orders', 'products'],
        }
      );

      expect(invocation.state).toBe('result');
      expect(invocation.result).toEqual({
        tables: ['users', 'orders', 'products'],
      });

      const displayName = formatToolName(toolCall.name);
      expect(displayName).toBe('List Tables');
    });

    it('should display sqlcl_describe_table tool execution', () => {
      const toolCall: ToolCall = {
        id: 'tool-describe-1',
        name: 'sqlcl_describe_table',
        arguments: {
          table_name: 'users',
        },
      };

      const result = {
        columns: [
          { name: 'id', type: 'NUMBER', nullable: false },
          { name: 'name', type: 'VARCHAR2(100)', nullable: false },
          { name: 'email', type: 'VARCHAR2(255)', nullable: true },
        ],
      };

      const invocation = toAIElementsToolInvocation(
        toolCall,
        'completed',
        result
      );

      expect(invocation.state).toBe('result');
      expect(invocation.result).toEqual(result);

      const displayName = formatToolName(toolCall.name);
      expect(displayName).toBe('Describe Table');
    });

    it('should display MCP tool with custom prefix', () => {
      const toolCall: ToolCall = {
        id: 'tool-mcp-1',
        name: 'mcp_database_query',
        arguments: {
          query: 'SELECT * FROM sales',
        },
      };

      const invocation = toAIElementsToolInvocation(toolCall, 'executing');

      expect(invocation.toolName).toBe('mcp_database_query');

      const displayName = formatToolName(toolCall.name);
      expect(displayName).toBe('Database Query');
    });
  });

  describe('Tool execution states', () => {
    it('should display pending state', () => {
      const toolCall: ToolCall = {
        id: 'tool-1',
        name: 'sqlcl_connect',
        arguments: { connection_name: 'LiveLab' },
      };

      const invocation = toAIElementsToolInvocation(toolCall, 'pending');

      expect(invocation.state).toBe('partial-call');
    });

    it('should display executing state', () => {
      const toolCall: ToolCall = {
        id: 'tool-2',
        name: 'sqlcl_run_sql',
        arguments: { sql: 'SELECT 1' },
      };

      const invocation = toAIElementsToolInvocation(toolCall, 'executing');

      expect(invocation.state).toBe('call');
    });

    it('should display completed state with result', () => {
      const toolCall: ToolCall = {
        id: 'tool-3',
        name: 'sqlcl_run_sql',
        arguments: { sql: 'SELECT COUNT(*) as count FROM users' },
      };

      const result = {
        content: [
          {
            type: 'text',
            text: JSON.stringify([{ count: 150 }]),
          },
        ],
      };

      const invocation = toAIElementsToolInvocation(
        toolCall,
        'completed',
        result
      );

      expect(invocation.state).toBe('result');
      expect(invocation.result).toEqual(result);
    });

    it('should display failed state with error', () => {
      const toolCall: ToolCall = {
        id: 'tool-4',
        name: 'sqlcl_connect',
        arguments: { connection_name: 'InvalidDB' },
      };

      const error = 'ORA-12154: TNS:could not resolve the connect identifier';

      const invocation = toAIElementsToolInvocation(
        toolCall,
        'failed',
        undefined,
        error
      );

      expect(invocation.state).toBe('error');
      expect(invocation.error).toBe(error);
    });
  });

  describe('Database query results display', () => {
    it('should format simple query result', () => {
      const result = {
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              { id: 1, name: 'Alice', email: 'alice@example.com' },
              { id: 2, name: 'Bob', email: 'bob@example.com' },
            ]),
          },
        ],
      };

      const formatted = formatToolResult(result);

      expect(formatted).toContain('Alice');
      expect(formatted).toContain('Bob');
      expect(formatted).toContain('alice@example.com');
    });

    it('should format aggregate query result', () => {
      const result = {
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              { total_sales: 15000, avg_order: 150, order_count: 100 },
            ]),
          },
        ],
      };

      const formatted = formatToolResult(result);

      expect(formatted).toContain('15000');
      expect(formatted).toContain('150');
      expect(formatted).toContain('100');
    });

    it('should format empty result set', () => {
      const result = {
        content: [
          {
            type: 'text',
            text: JSON.stringify([]),
          },
        ],
      };

      const formatted = formatToolResult(result);

      // formatToolResult returns the full object as JSON string
      expect(formatted).toContain('[]');
    });

    it('should format error result', () => {
      const result = {
        content: [
          {
            type: 'text',
            text: 'ORA-00942: table or view does not exist',
          },
        ],
      };

      const formatted = formatToolResult(result);

      expect(formatted).toContain('ORA-00942');
      expect(formatted).toContain('table or view does not exist');
    });

    it('should format connection confirmation', () => {
      const result = {
        content: [
          {
            type: 'text',
            text: '### DATABASE CONNECTION ESTABLISHED ###\n\nSuccessfully connected to LiveLab',
          },
        ],
      };

      const formatted = formatToolResult(result);

      expect(formatted).toContain('DATABASE CONNECTION ESTABLISHED');
      expect(formatted).toContain('LiveLab');
    });

    it('should format large result set (truncated)', () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
      }));

      const result = {
        content: [
          {
            type: 'text',
            text: JSON.stringify(largeData),
          },
        ],
      };

      const formatted = formatToolResult(result);

      // Should be formatted as JSON string
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });
  });

  describe('Tool arguments formatting', () => {
    it('should format simple SQL query', () => {
      const args = {
        sql: 'SELECT * FROM users',
      };

      const formatted = formatToolArguments(args);

      expect(formatted).toContain('SELECT * FROM users');
      expect(formatted).toContain('sql');
    });

    it('should format complex query with parameters', () => {
      const args = {
        sql: 'SELECT * FROM orders WHERE user_id = :user_id AND status = :status',
        parameters: {
          user_id: 123,
          status: 'completed',
        },
      };

      const formatted = formatToolArguments(args);

      expect(formatted).toContain('user_id');
      expect(formatted).toContain('123');
      expect(formatted).toContain('status');
      expect(formatted).toContain('completed');
    });

    it('should format connection arguments', () => {
      const args = {
        connection_name: 'LiveLab',
        username: 'admin',
      };

      const formatted = formatToolArguments(args);

      expect(formatted).toContain('LiveLab');
      expect(formatted).toContain('admin');
    });

    it('should format empty arguments', () => {
      const args = {};

      const formatted = formatToolArguments(args);

      expect(formatted).toBe('{}');
    });
  });

  describe('Tool execution timing', () => {
    it('should track execution time for completed tools', () => {
      const toolCall: ToolCall = {
        id: 'tool-timing-1',
        name: 'sqlcl_run_sql',
        arguments: { sql: 'SELECT * FROM users' },
      };

      const executionTime = 1250; // 1.25 seconds

      const invocation = toAIElementsToolInvocation(
        toolCall,
        'completed',
        { rows: 100 },
        undefined,
        executionTime
      );

      expect(invocation.executionTime).toBe(1250);
    });

    it('should handle fast queries (< 100ms)', () => {
      const toolCall: ToolCall = {
        id: 'tool-timing-2',
        name: 'sqlcl_run_sql',
        arguments: { sql: 'SELECT 1 FROM DUAL' },
      };

      const executionTime = 45; // 45ms

      const invocation = toAIElementsToolInvocation(
        toolCall,
        'completed',
        { result: 1 },
        undefined,
        executionTime
      );

      expect(invocation.executionTime).toBe(45);
    });

    it('should handle slow queries (> 5s)', () => {
      const toolCall: ToolCall = {
        id: 'tool-timing-3',
        name: 'sqlcl_run_sql',
        arguments: { sql: 'SELECT * FROM large_table' },
      };

      const executionTime = 7500; // 7.5 seconds

      const invocation = toAIElementsToolInvocation(
        toolCall,
        'completed',
        { rows: 1000000 },
        undefined,
        executionTime
      );

      expect(invocation.executionTime).toBe(7500);
    });
  });

  describe('Multiple tool executions', () => {
    it('should handle sequence of MCP tool calls', () => {
      const toolCalls: ToolCall[] = [
        {
          id: 'tool-seq-1',
          name: 'sqlcl_connect',
          arguments: { connection_name: 'LiveLab' },
        },
        {
          id: 'tool-seq-2',
          name: 'sqlcl_list_tables',
          arguments: {},
        },
        {
          id: 'tool-seq-3',
          name: 'sqlcl_describe_table',
          arguments: { table_name: 'users' },
        },
        {
          id: 'tool-seq-4',
          name: 'sqlcl_run_sql',
          arguments: { sql: 'SELECT COUNT(*) FROM users' },
        },
      ];

      const invocations = toolCalls.map(tc =>
        toAIElementsToolInvocation(tc, 'completed', { success: true })
      );

      expect(invocations).toHaveLength(4);
      expect(invocations[0].toolName).toBe('sqlcl_connect');
      expect(invocations[1].toolName).toBe('sqlcl_list_tables');
      expect(invocations[2].toolName).toBe('sqlcl_describe_table');
      expect(invocations[3].toolName).toBe('sqlcl_run_sql');

      // All should be in completed state
      invocations.forEach(inv => {
        expect(inv.state).toBe('result');
      });
    });

    it('should handle parallel MCP tool calls', () => {
      const toolCalls: ToolCall[] = [
        {
          id: 'tool-par-1',
          name: 'sqlcl_run_sql',
          arguments: { sql: 'SELECT COUNT(*) FROM users' },
        },
        {
          id: 'tool-par-2',
          name: 'sqlcl_run_sql',
          arguments: { sql: 'SELECT COUNT(*) FROM orders' },
        },
        {
          id: 'tool-par-3',
          name: 'sqlcl_run_sql',
          arguments: { sql: 'SELECT COUNT(*) FROM products' },
        },
      ];

      const invocations = toolCalls.map(tc =>
        toAIElementsToolInvocation(tc, 'executing')
      );

      expect(invocations).toHaveLength(3);

      // All should be in executing state
      invocations.forEach(inv => {
        expect(inv.state).toBe('call');
      });
    });
  });

  describe('Error handling', () => {
    it('should display connection errors', () => {
      const toolCall: ToolCall = {
        id: 'tool-err-1',
        name: 'sqlcl_connect',
        arguments: { connection_name: 'InvalidDB' },
      };

      const error = 'Failed to connect: Invalid connection name';

      const invocation = toAIElementsToolInvocation(
        toolCall,
        'failed',
        undefined,
        error
      );

      expect(invocation.state).toBe('error');
      expect(invocation.error).toContain('Failed to connect');
    });

    it('should display SQL syntax errors', () => {
      const toolCall: ToolCall = {
        id: 'tool-err-2',
        name: 'sqlcl_run_sql',
        arguments: { sql: 'SELCT * FROM users' }, // typo
      };

      const error = 'ORA-00900: invalid SQL statement';

      const invocation = toAIElementsToolInvocation(
        toolCall,
        'failed',
        undefined,
        error
      );

      expect(invocation.state).toBe('error');
      expect(invocation.error).toContain('ORA-00900');
    });

    it('should display permission errors', () => {
      const toolCall: ToolCall = {
        id: 'tool-err-3',
        name: 'sqlcl_run_sql',
        arguments: { sql: 'DROP TABLE users' },
      };

      const error = 'ORA-01031: insufficient privileges';

      const invocation = toAIElementsToolInvocation(
        toolCall,
        'failed',
        undefined,
        error
      );

      expect(invocation.state).toBe('error');
      expect(invocation.error).toContain('insufficient privileges');
    });

    it('should display timeout errors', () => {
      const toolCall: ToolCall = {
        id: 'tool-err-4',
        name: 'sqlcl_run_sql',
        arguments: { sql: 'SELECT * FROM huge_table' },
      };

      const error = 'Query execution timeout after 30 seconds';

      const invocation = toAIElementsToolInvocation(
        toolCall,
        'failed',
        undefined,
        error
      );

      expect(invocation.state).toBe('error');
      expect(invocation.error).toContain('timeout');
    });
  });
});
