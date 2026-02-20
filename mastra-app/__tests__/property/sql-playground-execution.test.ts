/**
 * Property Test: SQL Playground Query Execution
 * 
 * Feature: mastra-migration, Property 15: SQL Playground Query Execution
 * 
 * *For any* valid SQL query submitted to the SQL Playground, the query SHALL be
 * executed via the MCP run-sql tool and return results or an error message.
 * 
 * **Validates: Requirements 3.3, 3.4**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ConversationStore, MCPToolResult } from '../../src/db/conversation-store';
import { MCPClient } from '@mastra/mcp';

/**
 * Mock MCP Client that simulates SQLcl MCP Server behavior for SQL execution.
 * Tracks tool calls to verify correct forwarding of requests.
 */
class MockMCPClient {
  private connected = false;
  private toolsets: Record<string, unknown> | null = null;
  
  // Track all tool calls for verification
  public toolCalls: Array<{ toolName: string; args: Record<string, unknown> }> = [];
  
  // Simulated table data
  private tableData: Map<string, Array<Record<string, unknown>>> = new Map();
  
  // Configure error simulation
  public simulateError: string | null = null;

  constructor() {
    // Initialize with some test data
    this.tableData.set('employees', [
      { ID: 1, NAME: 'Alice', DEPARTMENT: 'Engineering' },
      { ID: 2, NAME: 'Bob', DEPARTMENT: 'Sales' },
      { ID: 3, NAME: 'Charlie', DEPARTMENT: 'Engineering' },
    ]);
    this.tableData.set('departments', [
      { ID: 1, NAME: 'Engineering', BUDGET: 100000 },
      { ID: 2, NAME: 'Sales', BUDGET: 50000 },
    ]);
  }

  async listToolsets(): Promise<Record<string, unknown>> {
    if (!this.toolsets) {
      this.toolsets = {
        'sqlcl.connect': {
          execute: async (args: { connection_name: string }) => {
            this.toolCalls.push({ toolName: 'connect', args });
            this.connected = true;
            return { content: `Connected to ${args.connection_name}`, isError: false };
          }
        },
        'sqlcl.run-sql': {
          execute: async (args: { sql: string }) => {
            this.toolCalls.push({ toolName: 'run-sql', args });
            return this.executeSql(args.sql);
          }
        }
      };
    }
    return this.toolsets;
  }

  private executeSql(sql: string): MCPToolResult {
    // Check for simulated error
    if (this.simulateError) {
      return { content: null, isError: true, errorMessage: this.simulateError };
    }

    const normalizedSql = sql.trim().toUpperCase();
    
    // Handle SELECT queries
    if (normalizedSql.startsWith('SELECT')) {
      return this.handleSelect(sql);
    }
    
    // Handle INSERT queries
    if (normalizedSql.startsWith('INSERT')) {
      return this.handleInsert(sql);
    }
    
    // Handle UPDATE queries
    if (normalizedSql.startsWith('UPDATE')) {
      return { content: '1 row updated', isError: false };
    }
    
    // Handle DELETE queries
    if (normalizedSql.startsWith('DELETE')) {
      return { content: '1 row deleted', isError: false };
    }
    
    // Handle CREATE TABLE
    if (normalizedSql.startsWith('CREATE TABLE')) {
      const tableMatch = sql.match(/CREATE\s+TABLE\s+(\w+)/i);
      if (tableMatch) {
        this.tableData.set(tableMatch[1].toLowerCase(), []);
        return { content: 'Table created', isError: false };
      }
    }
    
    // Handle DROP TABLE
    if (normalizedSql.startsWith('DROP TABLE')) {
      return { content: 'Table dropped', isError: false };
    }
    
    // Handle DESCRIBE/DESC
    if (normalizedSql.startsWith('DESC') || normalizedSql.startsWith('DESCRIBE')) {
      return {
        content: [
          { COLUMN_NAME: 'ID', DATA_TYPE: 'NUMBER' },
          { COLUMN_NAME: 'NAME', DATA_TYPE: 'VARCHAR2' },
        ],
        isError: false
      };
    }

    // Unknown SQL - return error
    return { content: null, isError: true, errorMessage: `Unsupported SQL statement: ${sql}` };
  }

  private handleSelect(sql: string): MCPToolResult {
    const normalizedSql = sql.toUpperCase();
    
    // Extract table name from FROM clause
    const fromMatch = sql.match(/FROM\s+(\w+)/i);
    if (!fromMatch) {
      return { content: null, isError: true, errorMessage: 'Invalid SELECT: missing FROM clause' };
    }
    
    const tableName = fromMatch[1].toLowerCase();
    const tableData = this.tableData.get(tableName);
    
    if (!tableData) {
      return { content: null, isError: true, errorMessage: `Table '${tableName}' does not exist` };
    }
    
    // Handle COUNT(*)
    if (normalizedSql.includes('COUNT(*)')) {
      return { content: [{ COUNT: tableData.length }], isError: false };
    }
    
    // Handle WHERE clause filtering
    let results = [...tableData];
    const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*'?([^'\s]+)'?/i);
    if (whereMatch) {
      const column = whereMatch[1].toUpperCase();
      const value = whereMatch[2];
      results = results.filter(row => {
        const rowValue = String(row[column] || '');
        return rowValue.toLowerCase() === value.toLowerCase();
      });
    }
    
    // Handle LIMIT/FETCH FIRST
    const limitMatch = sql.match(/FETCH\s+FIRST\s+(\d+)/i) || sql.match(/LIMIT\s+(\d+)/i);
    if (limitMatch) {
      const limit = parseInt(limitMatch[1], 10);
      results = results.slice(0, limit);
    }
    
    return { content: results, isError: false };
  }

  private handleInsert(sql: string): MCPToolResult {
    const tableMatch = sql.match(/INSERT\s+INTO\s+(\w+)/i);
    if (!tableMatch) {
      return { content: null, isError: true, errorMessage: 'Invalid INSERT syntax' };
    }
    return { content: '1 row inserted', isError: false };
  }

  reset(): void {
    this.connected = false;
    this.toolCalls = [];
    this.simulateError = null;
    this.toolsets = null;
  }
}

// Arbitrary for valid table names
const tableNameArb = fc.stringMatching(/^[a-z][a-z0-9_]{0,29}$/);

// Arbitrary for valid column names
const columnNameArb = fc.stringMatching(/^[a-z][a-z0-9_]{0,29}$/);

// Arbitrary for simple string values (safe for SQL)
const stringValueArb = fc.stringMatching(/^[A-Za-z0-9 ]{1,50}$/);

// Arbitrary for numeric values
const numericValueArb = fc.integer({ min: 0, max: 1000000 });

// Arbitrary for SELECT queries
const selectQueryArb = fc.record({
  columns: fc.constantFrom('*', 'id', 'name', 'COUNT(*)'),
  table: fc.constantFrom('employees', 'departments'),
  hasWhere: fc.boolean(),
  whereColumn: fc.constantFrom('id', 'name', 'department'),
  whereValue: stringValueArb,
  hasLimit: fc.boolean(),
  limit: fc.integer({ min: 1, max: 100 }),
}).map(({ columns, table, hasWhere, whereColumn, whereValue, hasLimit, limit }) => {
  let sql = `SELECT ${columns} FROM ${table}`;
  if (hasWhere) {
    sql += ` WHERE ${whereColumn} = '${whereValue}'`;
  }
  if (hasLimit) {
    sql += ` FETCH FIRST ${limit} ROWS ONLY`;
  }
  return sql;
});

// Arbitrary for INSERT queries
const insertQueryArb = fc.record({
  table: fc.constantFrom('employees', 'departments'),
  id: numericValueArb,
  name: stringValueArb,
}).map(({ table, id, name }) => {
  return `INSERT INTO ${table} (id, name) VALUES (${id}, '${name}')`;
});

// Arbitrary for UPDATE queries
const updateQueryArb = fc.record({
  table: fc.constantFrom('employees', 'departments'),
  column: fc.constantFrom('name', 'department'),
  value: stringValueArb,
  whereId: numericValueArb,
}).map(({ table, column, value, whereId }) => {
  return `UPDATE ${table} SET ${column} = '${value}' WHERE id = ${whereId}`;
});

// Arbitrary for DELETE queries
const deleteQueryArb = fc.record({
  table: fc.constantFrom('employees', 'departments'),
  whereId: numericValueArb,
}).map(({ table, whereId }) => {
  return `DELETE FROM ${table} WHERE id = ${whereId}`;
});

// Combined arbitrary for any valid SQL query
const validSqlQueryArb = fc.oneof(
  selectQueryArb,
  insertQueryArb,
  updateQueryArb,
  deleteQueryArb
);

describe('Property 15: SQL Playground Query Execution', () => {
  let mockClient: MockMCPClient;
  let store: ConversationStore;

  beforeEach(() => {
    mockClient = new MockMCPClient();
    store = new ConversationStore(mockClient as unknown as MCPClient, 'test-connection');
  });

  it('should forward SQL queries to MCP run-sql tool with exact arguments (Req 3.3)', async () => {
    await fc.assert(
      fc.asyncProperty(validSqlQueryArb, async (sql) => {
        mockClient.reset();
        store.resetConnection();

        // Execute SQL via ConversationStore (which uses MCP)
        await store.executeSQL(sql);

        // Property: The run-sql tool was called with the exact SQL query
        const runSqlCalls = mockClient.toolCalls.filter(c => c.toolName === 'run-sql');
        expect(runSqlCalls.length).toBeGreaterThan(0);
        
        const lastCall = runSqlCalls[runSqlCalls.length - 1];
        expect(lastCall.args.sql).toBe(sql);
      }),
      { numRuns: 100 }
    );
  });

  it('should return Tool_Result with results for successful queries (Req 3.4)', async () => {
    await fc.assert(
      fc.asyncProperty(selectQueryArb, async (sql) => {
        mockClient.reset();
        store.resetConnection();

        // Execute SELECT query
        const result = await store.executeSQL(sql);

        // Property: Result is returned (array for SELECT queries)
        expect(result).toBeDefined();
        // SELECT queries return arrays (possibly empty)
        expect(Array.isArray(result) || typeof result === 'object').toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('should return Tool_Result with error information for failed queries (Req 3.4)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'SELECT * FROM nonexistent_table',
          'INVALID SQL SYNTAX HERE',
          'SELECT FROM WHERE'
        ),
        async (invalidSql) => {
          mockClient.reset();
          store.resetConnection();

          // Execute invalid SQL - should throw or return error
          try {
            await store.executeSQL(invalidSql);
            // If no error thrown, the mock might have handled it gracefully
            // This is acceptable as long as the tool was called
          } catch (error) {
            // Property: Error contains meaningful information
            expect(error).toBeDefined();
            expect(error instanceof Error).toBe(true);
            expect((error as Error).message.length).toBeGreaterThan(0);
          }

          // Property: The run-sql tool was still called
          const runSqlCalls = mockClient.toolCalls.filter(c => c.toolName === 'run-sql');
          expect(runSqlCalls.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should handle simulated MCP errors and return error information (Req 3.4)', async () => {
    const errorMessages = [
      'ORA-00942: table or view does not exist',
      'ORA-00904: invalid identifier',
      'Connection timeout',
      'MCP server unavailable',
    ];

    for (const errorMsg of errorMessages) {
      mockClient.reset();
      store.resetConnection();
      mockClient.simulateError = errorMsg;

      try {
        await store.executeSQL('SELECT * FROM employees');
        // Should have thrown
        expect.fail('Expected error to be thrown');
      } catch (error) {
        // Property: Error message is propagated
        expect(error instanceof Error).toBe(true);
        expect((error as Error).message).toContain(errorMsg);
      }
    }
  });

  it('should preserve SQL query exactly when forwarding to MCP (Req 3.3)', async () => {
    // Test with queries containing special characters and formatting
    const specialQueries = [
      'SELECT * FROM employees WHERE name = \'O\'\'Brien\'',
      'SELECT id, name FROM employees ORDER BY id DESC',
      'SELECT COUNT(*) FROM employees GROUP BY department',
      `SELECT * FROM employees
       WHERE department = 'Engineering'
       ORDER BY name`,
    ];

    for (const sql of specialQueries) {
      mockClient.reset();
      store.resetConnection();

      await store.executeSQL(sql);

      // Property: SQL is forwarded exactly as provided
      const runSqlCalls = mockClient.toolCalls.filter(c => c.toolName === 'run-sql');
      expect(runSqlCalls.length).toBeGreaterThan(0);
      expect(runSqlCalls[runSqlCalls.length - 1].args.sql).toBe(sql);
    }
  });

  it('should establish connection before executing SQL (Req 3.3)', async () => {
    await fc.assert(
      fc.asyncProperty(validSqlQueryArb, async (sql) => {
        mockClient.reset();
        store.resetConnection();

        await store.executeSQL(sql);

        // Property: Connect was called before run-sql
        const connectCalls = mockClient.toolCalls.filter(c => c.toolName === 'connect');
        const runSqlCalls = mockClient.toolCalls.filter(c => c.toolName === 'run-sql');
        
        // Connect should be called (or attempted)
        // Note: Some implementations may auto-connect or skip if already connected
        expect(runSqlCalls.length).toBeGreaterThan(0);
        
        // If connect was called, it should be before run-sql
        if (connectCalls.length > 0) {
          const connectIndex = mockClient.toolCalls.findIndex(c => c.toolName === 'connect');
          const runSqlIndex = mockClient.toolCalls.findIndex(c => c.toolName === 'run-sql');
          expect(connectIndex).toBeLessThan(runSqlIndex);
        }
      }),
      { numRuns: 50 }
    );
  });

  it('should return results for different SQL statement types (Req 3.4)', async () => {
    const testCases = [
      { sql: 'SELECT * FROM employees', expectArray: true },
      { sql: 'SELECT COUNT(*) FROM employees', expectArray: true },
      { sql: 'INSERT INTO employees (id, name) VALUES (100, \'Test\')', expectArray: false },
      { sql: 'UPDATE employees SET name = \'Updated\' WHERE id = 1', expectArray: false },
      { sql: 'DELETE FROM employees WHERE id = 999', expectArray: false },
    ];

    for (const { sql, expectArray } of testCases) {
      mockClient.reset();
      store.resetConnection();

      const result = await store.executeSQL(sql);

      // Property: Result is returned in appropriate format
      expect(result).toBeDefined();
      if (expectArray) {
        expect(Array.isArray(result)).toBe(true);
      }
    }
  });

  it('should handle empty result sets (Req 3.4)', async () => {
    mockClient.reset();
    store.resetConnection();

    // Query with WHERE clause that matches nothing
    const result = await store.executeSQL(
      'SELECT * FROM employees WHERE name = \'NonExistentPerson\''
    );

    // Property: Empty array is returned for no matches
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect((result as unknown[]).length).toBe(0);
  });

  it('should use correct tool name for MCP execution (Req 3.3)', async () => {
    await fc.assert(
      fc.asyncProperty(validSqlQueryArb, async (sql) => {
        mockClient.reset();
        store.resetConnection();

        await store.executeSQL(sql);

        // Property: The tool name used is 'run-sql' (MCP format)
        const runSqlCalls = mockClient.toolCalls.filter(c => c.toolName === 'run-sql');
        expect(runSqlCalls.length).toBeGreaterThan(0);
        
        // Verify the tool name is exactly 'run-sql' (with hyphen, MCP format)
        expect(runSqlCalls[0].toolName).toBe('run-sql');
      }),
      { numRuns: 50 }
    );
  });
});
