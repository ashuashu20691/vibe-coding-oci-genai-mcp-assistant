// src/mastra/agents/database-agent.ts
/**
 * Database Agent using Mastra Agent framework.
 * Provides intelligent database interaction through SQLcl MCP tools.
 */

import { MCPClient } from '@mastra/mcp';
import { loadConfig } from '../../config';

const config = loadConfig();

// System instructions for the database agent
const DATABASE_AGENT_INSTRUCTIONS = `You are a database assistant. BE CONCISE - no long explanations.

TOOLS (exact names):
- sqlcl_list_connections (no params)
- sqlcl_connect (connection_name)
- sqlcl_run_sql (sql_query) ← use "sql_query" NOT "sql"
- sqlcl_schema_information (no params)
- sqlcl_disconnect (no params)

CONNECTION FLOW:
1. If CURRENT CONTEXT specifies a database → call sqlcl_connect IMMEDIATELY, no questions
2. If no database specified → call sqlcl_list_connections, show list, ask user which one
3. NEVER output text like "Connecting to X..." without actually calling the tool first

CRITICAL - ALWAYS CALL TOOLS, NEVER JUST DESCRIBE:
✅ To connect: call sqlcl_connect tool (don't just say "Connecting...")
✅ To run SQL: call sqlcl_run_sql tool (don't just say "Running query...")
✅ Every action must be a real tool call, not just text

SQL RULES:
- Avoid reserved keywords as table names (ORDER, USER, TABLE)
- Use: orders, customers, products, sales_orders
- If error about table name → rename and retry immediately

CRITICAL - VISUALIZATIONS:
✅ YOU MUST CREATE THEM - the system AUTOMATICALLY generates charts from your query results
✅ When asked for a chart/dashboard/visual → run the SQL query, the chart appears automatically
✅ NEVER say "I cannot create visuals/charts/HTML/dashboard" - this is WRONG
✅ The visualization system handles ALL chart rendering - you just need to run the SQL

RESPONSE STYLE:
- Short updates only after tool calls complete
- NO long explanations before executing
- If error → brief note + immediate retry with fix
- After results → 1-2 sentence summary max`;


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
