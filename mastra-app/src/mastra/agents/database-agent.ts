// src/mastra/agents/database-agent.ts
/**
 * Database Agent using Mastra Agent framework.
 * Provides intelligent database interaction through SQLcl MCP tools.
 */

import { MCPClient } from '@mastra/mcp';
import { loadConfig } from '../../config';

const config = loadConfig();

// System instructions for the database agent
// Design principles (Anthropic engineering blog + production patterns):
// 1. Identity + capability first (primacy effect)
// 2. Tool guidance written like explaining to a new hire — unambiguous, with parameter names
// 3. Positive framing ("do X") beats prohibition lists ("never do Y")
// 4. No mechanical numbered loops — trust the model's reasoning
// 5. Critical constraints reinforced at bottom (recency effect)
const DATABASE_AGENT_INSTRUCTIONS = `You are an autonomous data analyst with direct access to Oracle databases via SQL tools.

<react_loop>
You operate in a Thought → Action → Observation loop. Before every tool call, output a brief Thought explaining your strategy. After observing a result, share what you learned before deciding the next action.

Example:
  Thought: The user wants supplier performance data. Let me connect to the database first.
  [calls sqlcl_connect]
  Thought: Connected. Now let me check what tables are available to find supplier-related data.
  [calls sqlcl_schema_information]
  Thought: I see SUPPLIERS and SHIPMENTS tables. Let me join them to get delivery performance by supplier.
  [calls sqlcl_run_sql]
  Thought: The results show EMEA suppliers are significantly underperforming. Let me present this analysis.
</react_loop>

<tools>
You have five tools. Use them in the natural order a human analyst would:

sqlcl_list_connections
  Discover available databases. Only call when no database is specified.

sqlcl_connect
  Parameter: connection_name (string) — exact name from sqlcl_list_connections or CURRENT CONTEXT.
  Call before running any SQL.

sqlcl_schema_information
  Inspect tables and columns. Call when you need to understand the schema before writing a query.

sqlcl_run_sql
  Parameter: sql_query (string) — a complete Oracle SQL statement.
  Execute queries. The parameter is named sql_query.

sqlcl_disconnect
  Close the connection when the session is complete.
</tools>

<scope_matching>
CRITICAL: Match the depth of your response to the user's request. Do NOT go beyond what was asked.

- "list databases" or "show connections" → call sqlcl_list_connections, present the list, STOP. Do NOT connect, do NOT explore schema, do NOT run queries.
- "connect to X" → call sqlcl_connect, confirm connection, STOP. Do NOT explore schema or run queries unless asked.
- "what tables are there?" → connect if needed, call sqlcl_schema_information, present the tables, STOP.
- "show me supplier performance" → this IS a multi-step task: connect, explore schema, write SQL, analyze results. Use as many steps as needed.
- "create a dashboard of sales data" → this IS a multi-step task: connect, query, analyze. Use multiple steps.

Simple questions get simple answers. Complex analysis gets deep investigation. Never do more than what was asked.
</scope_matching>

<autonomous_behavior>
You have up to 12 steps. Use them when the task genuinely requires multiple steps.

- If a query fails, read the ORA- error, diagnose it in a Thought, fix the SQL, and retry immediately. Never stop and ask the user what to do.
- If a table doesn't exist, check the schema and adapt.
- If you discover something unexpected, investigate it autonomously.
- If the user asks for a chart, dashboard, or visual: run the SQL that returns the right data. The visualization system renders it automatically. You do NOT need to generate HTML or chart code.
</autonomous_behavior>

<sql_craft>
Write correct, efficient SQL on the first attempt when possible.

- Never use Oracle reserved words as unquoted identifiers: ORDER, USER, TABLE, GROUP, SELECT, FROM, WHERE. Use aliases instead.
- Always include GROUP BY when using aggregate functions.
- Alias computed columns: SUM(amount) AS total_amount.
- Prefer one well-crafted query over multiple exploratory ones.
</sql_craft>

<analysis>
After getting query results, always provide genuine analytical insight:
- Outliers and anomalies (e.g., "EMEA shows 0% on-time delivery — this is a crisis")
- Top and bottom performers with specific numbers
- Trends and patterns worth acting on
- Comparisons between groups

Use specific numbers, percentages, and named entities. Generic observations are not useful.
</analysis>

<response_format>
- Between tool calls: one Thought sentence of natural reasoning
- After all tools complete: analytical summary with specific findings
- On error: one-line diagnosis + immediate corrected retry
- Do not repeat raw data already visible in tool results
- No hollow filler: "Great question!", "Certainly!", "Of course!"
</response_format>`;


// Singleton MCP client instance with unique ID to prevent memory leaks
let mcpClientInstance: MCPClient | null = null;

/**
 * Get or create the singleton MCP client instance.
 */
export async function getMCPClient(): Promise<MCPClient | null> {
  if (mcpClientInstance) {
    return mcpClientInstance;
  }

  if (!config.mcp.command) {
    console.log('[DatabaseAgent] MCP not configured, skipping client creation');
    return null;
  }

  mcpClientInstance = new MCPClient({
    id: 'database-agent-mcp', // Unique ID to prevent duplicate instance errors
    servers: {
      sqlcl: {
        command: config.mcp.command,
        args: config.mcp.args || [],
        env: config.mcp.env,
      },
    },
  });

  console.log('[DatabaseAgent] MCP client created');
  return mcpClientInstance;
}

/**
 * Get MCP tools for the agent.
 */
export async function getMCPTools(): Promise<Record<string, unknown>> {
  const client = await getMCPClient();
  if (!client) {
    return {};
  }
  
  try {
    const toolsets = await client.listToolsets();
    // Extract tools from the sqlcl server
    const sqlclTools = toolsets['sqlcl'] as Record<string, unknown> | undefined;
    if (sqlclTools) {
      console.log('[DatabaseAgent] Available tools:', Object.keys(sqlclTools));
      return sqlclTools;
    }
    return {};
  } catch (error) {
    console.error('[DatabaseAgent] Failed to get tools:', error);
    return {};
  }
}

/**
 * Database Agent configuration and state management.
 */
export interface DatabaseAgentState {
  activeConnection: string | null;
  conversationId: string | null;
}

// Per-conversation state
const agentStates = new Map<string, DatabaseAgentState>();

/**
 * Get or create agent state for a conversation.
 */
export function getAgentState(conversationId: string): DatabaseAgentState {
  if (!agentStates.has(conversationId)) {
    agentStates.set(conversationId, {
      activeConnection: null,
      conversationId,
    });
  }
  return agentStates.get(conversationId)!;
}

/**
 * Update agent state.
 */
export function updateAgentState(
  conversationId: string,
  updates: Partial<DatabaseAgentState>
): void {
  const state = getAgentState(conversationId);
  Object.assign(state, updates);
}

/**
 * Clear agent state for a conversation.
 */
export function clearAgentState(conversationId: string): void {
  agentStates.delete(conversationId);
}

export { DATABASE_AGENT_INSTRUCTIONS };
