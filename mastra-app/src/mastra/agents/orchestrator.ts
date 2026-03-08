// src/mastra/agents/orchestrator.ts
/**
 * Multi-Agent Orchestrator - Coordinates database, analysis, and visualization agents
 * to provide Claude-like intelligent data exploration and visualization.
 */

import { getMCPTools, getAgentState, updateAgentState } from './database-agent';
import { RetryOrchestrator, type RetryStrategy } from '../../services/retry-orchestrator';

export interface ToolExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  iterationCount?: number;
  attemptSummaries?: string[];
}

/**
 * DatabaseOrchestrator ensures proper connection management
 * and handles the workflow of database operations.
 */
export class DatabaseOrchestrator {
  private conversationId: string;
  private modelId: string;
  private retryOrchestrator: RetryOrchestrator;
  private onIterationUpdate?: (iteration: number, maxIterations: number) => void;
  private onNarrative?: (narrative: string) => void;

  constructor(conversationId: string, modelId: string) {
    this.conversationId = conversationId;
    this.modelId = modelId;
    this.retryOrchestrator = new RetryOrchestrator();
  }

  /**
   * Set callback for iteration updates during autonomous retry loops
   */
  setIterationUpdateCallback(callback: (iteration: number, maxIterations: number) => void): void {
    this.onIterationUpdate = callback;
  }

  /**
   * Set callback for narrative updates during retry operations
   */
  setNarrativeCallback(callback: (narrative: string) => void): void {
    this.onNarrative = callback;
  }

  /**
   * Get the current active connection for this conversation.
   */
  getActiveConnection(): string | null {
    const state = getAgentState(this.conversationId);
    return state.activeConnection;
  }

  /**
   * Execute a tool with automatic connection management, analysis, and visualization.
   * For SQL operations, ensures a connection exists first, then analyzes results
   * and generates appropriate visualizations.
   * 
   * Uses RetryOrchestrator for autonomous retry logic (max 5 attempts) with
   * intelligent error recovery strategies including schema refresh.
   * Validates: Requirements 1.5, 1.6, 11.1, 11.4
   */
  async executeTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<ToolExecutionResult> {
    const mcpTools = await getMCPTools();
    
    // Normalize tool name (handle both hyphen and underscore formats)
    const normalizedName = toolName.replace(/_/g, '-');
    
    // Check if this is a SQL operation that requires a connection
    const sqlOperations = ['run-sql', 'run-sqlcl', 'schema-information', 'run-sql-async'];
    const needsConnection = sqlOperations.includes(normalizedName);
    
    if (needsConnection) {
      const activeConnection = this.getActiveConnection();
      
      if (!activeConnection) {
        // Try to auto-connect if we have a default connection
        const connectResult = await this.autoConnect(mcpTools);
        if (!connectResult.success) {
          return {
            success: false,
            error: `No active database connection. Please connect first using: "connect to <connection_name>". ${connectResult.error || ''}`,
          };
        }
      }
    }

    // Create custom retry strategies for schema-related errors
    // Validates: Requirements 1.6, 11.1, 11.2
    const schemaRefreshStrategy: RetryStrategy = {
      name: 'schema_refresh',
      description: "That didn't work, let me check the schema first",
      shouldApply: (error: Error) => {
        const msg = error.message.toLowerCase();
        return msg.includes('table not found') || 
               msg.includes('table does not exist') ||
               msg.includes('column not found') ||
               msg.includes('column does not exist') ||
               msg.includes('invalid table') ||
               msg.includes('invalid column') ||
               msg.includes('no such table') ||
               msg.includes('no such column');
      },
      execute: async (operation, context) => {
        // Refresh schema cache by querying schema information
        // This helps when table/column names have changed or cache is stale
        try {
          console.log('[Orchestrator] Refreshing schema cache due to table/column not found error');
          await this.executeToolDirect('schema-information', {}, mcpTools);
        } catch (schemaError) {
          console.log('[Orchestrator] Schema refresh failed, continuing with retry:', schemaError);
        }
        // Retry the original operation with refreshed schema
        return operation();
      },
    };

    // Create strategy for re-describing specific tables when column errors occur
    const tableDescribeStrategy: RetryStrategy = {
      name: 'table_describe',
      description: "Let me re-check that table's structure",
      shouldApply: (error: Error) => {
        const msg = error.message.toLowerCase();
        // Only apply if we have a specific table name in the error
        return (msg.includes('column not found') || msg.includes('column does not exist')) &&
               (msg.includes('in table') || msg.includes('from'));
      },
      execute: async (operation, context) => {
        // Try to extract table name from error and describe it
        try {
          const errorMsg = context.previousError?.message || '';
          // Simple extraction - look for table name patterns
          const tableMatch = errorMsg.match(/table\s+(\w+)/i) || errorMsg.match(/from\s+(\w+)/i);
          if (tableMatch && tableMatch[1]) {
            const tableName = tableMatch[1];
            console.log(`[Orchestrator] Re-describing table ${tableName} due to column error`);
            await this.executeToolDirect('schema-information', { table: tableName }, mcpTools);
          }
        } catch (describeError) {
          console.log('[Orchestrator] Table describe failed, continuing with retry:', describeError);
        }
        return operation();
      },
    };

    // Execute with retry orchestrator
    const retryResult = await this.retryOrchestrator.executeWithRetry(
      () => this.executeToolDirect(normalizedName, args, mcpTools),
      {
        maxAttempts: 5,
        operationName: normalizedName,
        onNarrative: this.onNarrative,
        onRetry: (attemptNum, strategy) => {
          // Call iteration update callback for all attempts
          if (this.onIterationUpdate) {
            this.onIterationUpdate(attemptNum, 5);
          }
        },
        customStrategies: [schemaRefreshStrategy, tableDescribeStrategy],
      }
    );

    // Convert retry result to tool execution result
    if (!retryResult.success) {
      return {
        success: false,
        error: retryResult.error?.message || 'Tool execution failed after maximum retry attempts',
        iterationCount: retryResult.attemptCount,
        attemptSummaries: retryResult.narratives,
      };
    }

    const result: ToolExecutionResult = {
      success: true,
      result: retryResult.data,
      iterationCount: retryResult.attemptCount,
      attemptSummaries: retryResult.narratives,
    };

    // Analysis and visualization are handled by the route layer after tool results arrive.
    // The orchestrator no longer auto-triggers these to avoid chart spam during exploration.

    return result;
  }

  /**
   * Extract data array from MCP tool result.
   */
  private extractDataFromResult(result: unknown): unknown[] | null {
    if (!result || typeof result !== 'object') return null;

    const resultObj = result as { content?: Array<{ text?: string }> };
    if (!resultObj.content?.[0]?.text) return null;

    try {
      // Try to parse as CSV
      const text = resultObj.content[0].text;
      const lines = text.trim().split('\n');
      
      if (lines.length < 2) return null;

      // Parse CSV header
      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
      
      // Parse CSV rows
      const data = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.replace(/"/g, '').trim());
        const row: Record<string, unknown> = {};
        
        headers.forEach((header, i) => {
          const value = values[i];
          // Try to parse as number
          const numValue = parseFloat(value);
          row[header] = isNaN(numValue) ? value : numValue;
        });
        
        return row;
      });

      return data;
    } catch (error) {
      console.error('[Orchestrator] Failed to extract data:', error);
      return null;
    }
  }

  /**
   * Try to auto-connect using list-connections to find available connections.
   */
  private async autoConnect(
    mcpTools: Record<string, unknown>
  ): Promise<ToolExecutionResult> {
    try {
      // First, list available connections
      const listResult = await this.executeToolDirect('list-connections', {}, mcpTools);
      
      if (!listResult.success) {
        return listResult;
      }

      // Parse the result to find connections
      const resultContent = listResult.result as { content?: Array<{ text?: string }> };
      if (resultContent?.content?.[0]?.text) {
        const text = resultContent.content[0].text;
        // Look for connection names in the result
        const lines = text.split('\n').filter((l: string) => l.trim());
        
        // Find the first valid connection name (skip headers)
        for (const line of lines) {
          const trimmed = line.trim();
          // Skip common header patterns
          if (trimmed.toLowerCase().includes('connection') && trimmed.toLowerCase().includes('name')) continue;
          if (trimmed.startsWith('-')) continue;
          if (trimmed.length === 0) continue;
          
          // This might be a connection name
          if (trimmed.length > 0 && !trimmed.includes(' ')) {
            console.log(`[Orchestrator] Auto-connecting to: ${trimmed}`);
            const connectResult = await this.executeToolDirect('connect', {
              connection_name: trimmed,
            }, mcpTools);
            
            if (connectResult.success) {
              updateAgentState(this.conversationId, { activeConnection: trimmed });
              return { success: true, result: `Auto-connected to ${trimmed}` };
            }
          }
        }
      }

      return {
        success: false,
        error: 'No connections available. Please configure database connections in SQLcl.',
      };
    } catch (error) {
      return {
        success: false,
        error: `Auto-connect failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Execute a tool directly without connection checks.
   * Returns the raw result for use with IterationStateMachine.
   */
  private async executeToolDirect(
    toolName: string,
    args: Record<string, unknown>,
    mcpTools: Record<string, unknown>
  ): Promise<ToolExecutionResult> {
    // Find the tool with various naming conventions
    const possibleNames = [
      toolName,
      toolName.replace(/-/g, '_'),
      toolName.replace(/_/g, '-'),
    ];

    let tool: { execute?: (args: unknown) => Promise<unknown> } | undefined;
    let foundName = '';

    for (const name of possibleNames) {
      const candidate = mcpTools[name] as { execute?: (args: unknown) => Promise<unknown> } | undefined;
      if (candidate?.execute) {
        tool = candidate;
        foundName = name;
        break;
      }
    }

    if (!tool?.execute) {
      throw new Error(`Tool '${toolName}' not found. Available: ${Object.keys(mcpTools).join(', ')}`);
    }

    // Map incorrect parameter names to correct ones
    const mappedArgs = this.mapToolParameters(foundName, args);
    
    // Add required MCP parameters
    const fullArgs = {
      mcp_client: 'oci-genai-chat',
      model: this.modelId,
      ...mappedArgs,
    };

    console.log(`[Orchestrator] Executing: ${foundName}`, fullArgs);
    const result = await tool.execute(fullArgs);
    console.log(`[Orchestrator] Result:`, JSON.stringify(result).slice(0, 500));

    // Track connection state
    if (foundName === 'connect' && mappedArgs.connection_name) {
      updateAgentState(this.conversationId, {
        activeConnection: mappedArgs.connection_name as string,
      });
    }
    if (foundName === 'disconnect') {
      updateAgentState(this.conversationId, { activeConnection: null });
    }

    // Check for errors in result
    const resultObj = result as { isError?: boolean; content?: Array<{ text?: string }> };
    if (resultObj?.isError) {
      const errorText = resultObj.content?.[0]?.text || 'Unknown error';
      throw new Error(errorText);
    }

    return { success: true, result };
  }

  /**
   * Map incorrect parameter names to correct ones for SQLcl MCP tools.
   * The MCP tools expect specific parameter names:
   * - run-sql: expects "sql" parameter
   * - run-sqlcl: expects "sqlcl" parameter  
   * - connect: expects "connection_name" parameter
   */
  private mapToolParameters(
    toolName: string,
    args: Record<string, unknown>
  ): Record<string, unknown> {
    const mapped = { ...args };
    const normalizedToolName = toolName.replace(/_/g, '-');
    
    // Remove any extra parameters that models sometimes add
    delete mapped.mcp_client;
    delete mapped.model;
    
    console.log(`[Orchestrator] Mapping params for tool: ${toolName} (normalized: ${normalizedToolName})`, args);
    
    // run-sql expects "sql" parameter
    if (normalizedToolName === 'run-sql') {
      // Map sql_query -> sql (model often uses sql_query but tool expects sql)
      if (mapped.sql_query && !mapped.sql) {
        console.log(`[Orchestrator] Mapping sql_query -> sql`);
        mapped.sql = mapped.sql_query;
        delete mapped.sql_query;
      }
      // Also handle "query" parameter
      if (mapped.query && !mapped.sql) {
        console.log(`[Orchestrator] Mapping query -> sql`);
        mapped.sql = mapped.query;
        delete mapped.query;
      }
    }
    
    // run-sqlcl expects "sqlcl" parameter
    if (normalizedToolName === 'run-sqlcl') {
      // Map sql -> sqlcl
      if (mapped.sql && !mapped.sqlcl) {
        console.log(`[Orchestrator] Mapping sql -> sqlcl`);
        mapped.sqlcl = mapped.sql;
        delete mapped.sql;
      }
      // Map command -> sqlcl
      if (mapped.command && !mapped.sqlcl) {
        console.log(`[Orchestrator] Mapping command -> sqlcl`);
        mapped.sqlcl = mapped.command;
        delete mapped.command;
      }
    }
    
    // connect expects "connection_name" parameter
    if (normalizedToolName === 'connect') {
      // Map name -> connection_name
      if (mapped.name && !mapped.connection_name) {
        console.log(`[Orchestrator] Mapping name -> connection_name`);
        mapped.connection_name = mapped.name;
        delete mapped.name;
      }
      // Map connection -> connection_name
      if (mapped.connection && !mapped.connection_name) {
        console.log(`[Orchestrator] Mapping connection -> connection_name`);
        mapped.connection_name = mapped.connection;
        delete mapped.connection;
      }
    }
    
    console.log(`[Orchestrator] Mapped params:`, mapped);
    return mapped;
  }

  /**
   * Execute a sequence of SQL statements (for multi-step operations).
   */
  async executeSequence(
    statements: Array<{ sql: string; description?: string }>
  ): Promise<Array<ToolExecutionResult & { description?: string }>> {
    const results: Array<ToolExecutionResult & { description?: string }> = [];

    for (const stmt of statements) {
      const result = await this.executeTool('run-sql', { sql_query: stmt.sql });
      results.push({ ...result, description: stmt.description });

      // Stop on first error
      if (!result.success) {
        break;
      }
    }

    return results;
  }
}
