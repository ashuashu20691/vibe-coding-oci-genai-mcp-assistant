// src/mastra/agents/orchestrator.ts
/**
 * Multi-Agent Orchestrator - Coordinates database, analysis, and visualization agents
 * to provide Claude-like intelligent data exploration and visualization.
 */

import { getMCPTools, getAgentState, updateAgentState } from './database-agent';
import { analyzeData, type AnalysisResult } from './data-analysis-agent';
import { generateVisualization, type VisualizationResult } from './visualization-agent';
import { AnalysisAgent, AnalysisRequest, AnalysisResponse } from './analysis-agent';

export interface ToolExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  analysis?: AnalysisResult;
  visualization?: VisualizationResult;
}

/**
 * DatabaseOrchestrator ensures proper connection management
 * and handles the workflow of database operations.
 */
export class DatabaseOrchestrator {
  private conversationId: string;
  private modelId: string;

  constructor(conversationId: string, modelId: string) {
    this.conversationId = conversationId;
    this.modelId = modelId;
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
   */
  async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    options?: {
      autoAnalyze?: boolean;
      autoVisualize?: boolean;
      visualizationType?: string;
    }
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

    // Execute the tool
    const result = await this.executeToolDirect(normalizedName, args, mcpTools);

    // If this was a successful SQL query, analyze and visualize the results
    if (result.success && normalizedName === 'run-sql') {
      const data = this.extractDataFromResult(result.result);
      
      if (data && Array.isArray(data) && data.length > 0) {
        // Auto-analyze if enabled (default: true)
        if (options?.autoAnalyze !== false) {
          try {
            const analysis = analyzeData({
              data,
              query: args.sql as string,
            });
            result.analysis = analysis;
          } catch (error) {
            console.error('[Orchestrator] Analysis failed:', error);
          }
        }

        // Auto-visualize if enabled (default: true)
        if (options?.autoVisualize !== false) {
          try {
            const visualization = await generateVisualization({
              data,
              type: (options?.visualizationType as 'auto' | 'bar' | 'line' | 'pie' | 'scatter' | 'table' | 'html') || 'auto',
            });
            result.visualization = visualization;
          } catch (error) {
            console.error('[Orchestrator] Visualization failed:', error);
          }
        }
      }
    }

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
      return {
        success: false,
        error: `Tool '${toolName}' not found. Available: ${Object.keys(mcpTools).join(', ')}`,
      };
    }

    try {
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
        return { success: false, error: errorText };
      }

      return { success: true, result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
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

  /**
   * Generate interactive HTML dashboard from query results.
   * This provides Claude-like interactive data exploration.
   */
  async generateInteractiveDashboard(
    sql: string,
    title?: string
  ): Promise<ToolExecutionResult> {
    // Execute the query
    const queryResult = await this.executeTool('run-sql', { sql_query: sql }, {
      autoAnalyze: true,
      autoVisualize: false, // We'll create custom HTML
    });

    if (!queryResult.success) {
      return queryResult;
    }

    // Extract data
    const data = this.extractDataFromResult(queryResult.result);
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      return {
        success: false,
        error: 'No data returned from query',
      };
    }

    // Generate interactive HTML
    const visualization = await generateVisualization({
      data,
      type: 'html',
      title: title || 'Interactive Data Dashboard',
    });

    return {
      success: true,
      result: queryResult.result,
      analysis: queryResult.analysis,
      visualization,
    };
  }

  /**
   * Smart query execution with automatic insights and visualizations.
   * This mimics Claude's behavior of automatically providing charts and analysis.
   */
  async smartQuery(
    sql: string,
    userIntent?: string
  ): Promise<{
    success: boolean;
    data?: unknown[];
    analysis?: AnalysisResult;
    visualizations?: VisualizationResult[];
    error?: string;
  }> {
    // Execute query with analysis
    const result = await this.executeTool('run-sql', { sql_query: sql }, {
      autoAnalyze: true,
      autoVisualize: true,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    const data = this.extractDataFromResult(result.result);
    
    if (!data || !Array.isArray(data)) {
      return {
        success: false,
        error: 'Failed to extract data from query result',
      };
    }

    // Generate multiple visualization options
    const visualizations: VisualizationResult[] = [];

    // Always include table view
    const tableViz = await generateVisualization({
      data,
      type: 'table',
    });
    visualizations.push(tableViz);

    // Add chart if appropriate
    if (result.visualization) {
      visualizations.push(result.visualization);
    }

    // Add interactive HTML for complex data
    if (data.length > 5) {
      const htmlViz = await generateVisualization({
        data,
        type: 'html',
        title: 'Interactive Data Explorer',
      });
      visualizations.push(htmlViz);
    }

    return {
      success: true,
      data,
      analysis: result.analysis,
      visualizations,
    };
  }

  /**
   * Detects if a user message is an analysis request.
   * Looks for keywords indicating data analysis needs.
   * Implements Requirements 10.2, 10.3.
   */
  isAnalysisRequest(message: string): boolean {
    const analysisKeywords = [
      'analyze', 'analysis', 'fraud', 'detect', 'pattern',
      'geographic', 'location', 'map', 'similar', 'similarity',
      'trend', 'time series', 'compare', 'distribution',
      'anomaly', 'outlier', 'dashboard', 'visualize',
      'generate data', 'synthetic data', 'demo data',
    ];
    const messageLower = message.toLowerCase();
    return analysisKeywords.some(keyword => messageLower.includes(keyword));
  }

  /**
   * Executes the intelligent data analysis workflow.
   * Implements Requirements 10.2, 10.3, 10.4, 10.5.
   */
  async executeAnalysis(request: AnalysisRequest): Promise<AnalysisResponse> {
    const analysisAgent = new AnalysisAgent();
    return analysisAgent.analyze(request);
  }

  /**
   * Handles an analysis request and routes results to appropriate visualization.
   * Implements Requirement 10.2-10.5 for conversational analysis flow.
   */
  async handleAnalysisRequest(
    userMessage: string,
    options?: {
      recordCount?: number;
      useExistingData?: boolean;
    }
  ): Promise<{
    success: boolean;
    response: AnalysisResponse;
    visualizationHtml?: string;
  }> {
    const analysisAgent = new AnalysisAgent();
    
    const response = await analysisAgent.analyze({
      naturalLanguageQuery: userMessage,
      recordCount: options?.recordCount,
      useExistingData: options?.useExistingData,
    });

    if (!response.success) {
      return { success: false, response };
    }

    // Generate HTML visualization from dashboard
    let visualizationHtml: string | undefined;
    if (response.dashboard.sections.length > 0) {
      const mainResult = response.queryResults.find(r => r.success && r.data.length > 0);
      if (mainResult) {
        const htmlViz = await generateVisualization({
          data: mainResult.data,
          type: 'html',
          title: response.dashboard.title,
        });
        visualizationHtml = typeof htmlViz.content === 'string' ? htmlViz.content : undefined;
      }
    }

    return {
      success: true,
      response,
      visualizationHtml,
    };
  }
}
