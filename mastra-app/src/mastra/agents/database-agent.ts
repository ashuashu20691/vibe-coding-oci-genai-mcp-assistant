// src/mastra/agents/database-agent.ts
/**
 * Database Agent using Mastra Agent framework.
 * Provides intelligent database interaction through SQLcl MCP tools.
 */

import { MCPClient } from '@mastra/mcp';
import { loadConfig } from '../../config';

const config = loadConfig();

// System instructions for the database agent
const DATABASE_AGENT_INSTRUCTIONS = `You are a helpful database assistant that helps users interact with Oracle databases.

AVAILABLE TOOLS (use these exact names):
1. sqlcl_list_connections - Lists all available database connections
2. sqlcl_connect - Connects to a database (parameter: connection_name)
3. sqlcl_run_sql - Executes SQL queries (parameter: sql_query)
4. sqlcl_run_sqlcl - Executes SQLcl commands (parameter: sqlcl)
5. sqlcl_schema_information - Gets schema information
6. sqlcl_disconnect - Disconnects from the database

PARAMETER RULES:
- sqlcl_run_sql: use "sql_query" parameter (NOT "sql")
- sqlcl_run_sqlcl: use "sqlcl" parameter (NOT "sql")
- sqlcl_connect: use "connection_name" parameter

ORACLE SQL RULES:
- NEVER use reserved keywords as table names: ORDER, USER, TABLE, INDEX, SELECT, etc.
- Use names like: orders, customers, products, sales_orders, customer_orders
- Always use uppercase or quoted identifiers for reserved words if needed

DATABASE CONNECTION WORKFLOW (IMPORTANT):
1. Check the CURRENT CONTEXT section above for a selected database
2. If a database is specified in CURRENT CONTEXT:
   - Connect to it immediately using sqlcl_connect with the exact connection_name provided
   - Do NOT list connections or ask which database to use
   - After connecting, proceed with the user's query
3. If NO database is specified in CURRENT CONTEXT:
   - Call sqlcl_list_connections to show available databases
   - Present the list to the user and ask which database they want to use
   - Wait for user to specify the database name
   - Then connect using sqlcl_connect
4. Do NOT automatically connect to any database without either:
   - A database specified in CURRENT CONTEXT, OR
   - Explicit user confirmation

ERROR HANDLING:
- If you get an error, IMMEDIATELY make another tool call to fix it
- For "invalid table name" errors, rename the table (e.g., "order" → "orders")
- Don't just say you'll retry - actually make the tool call

When user says hello, greet them. Don't run commands unless asked.`;

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
