// src/mastra/mcp/client.ts
/**
 * MCP Client configuration for SQLcl MCP Server integration.
 * Provides factory function and tool name conversion utilities.
 */

import { MCPClient } from '@mastra/mcp';

/**
 * Configuration for MCP client initialization.
 */
export interface MCPConfig {
  /** Command to execute the MCP server (e.g., 'npx', 'node') */
  command: string;
  /** Arguments to pass to the command */
  args?: string[];
  /** Environment variables for the MCP server process */
  env?: Record<string, string>;
}

/**
 * MCP client initialization error.
 */
export class MCPClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MCPClientError';
  }
}

/**
 * MCP connection error.
 */
export class MCPConnectionError extends MCPClientError {
  constructor(message: string) {
    super(message);
    this.name = 'MCPConnectionError';
  }
}

/**
 * Create an MCP client configured for SQLcl server.
 * 
 * @param config - MCP configuration with command, args, and env
 * @returns Configured MCPClient instance
 * @throws MCPClientError if configuration is invalid
 */
export function createMCPClient(config: MCPConfig): MCPClient {
  if (!config.command) {
    throw new MCPClientError('MCP command is required');
  }

  return new MCPClient({
    servers: {
      sqlcl: {
        command: config.command,
        args: config.args || [],
        env: config.env,
      },
    },
  });
}

/**
 * Convert MCP tool name to OCI GenAI compatible format.
 * OCI GenAI (Cohere) requires tool names to use underscores instead of hyphens.
 * 
 * @param mcpName - Tool name from MCP (may contain hyphens)
 * @returns Tool name with hyphens replaced by underscores
 * 
 * @example
 * toOCIToolName('run-sql') // returns 'run_sql'
 * toOCIToolName('connect') // returns 'connect'
 */
export function toOCIToolName(mcpName: string): string {
  return mcpName.replace(/-/g, '_');
}

/**
 * Convert OCI GenAI tool name back to MCP format.
 * Reverses the transformation done by toOCIToolName.
 * 
 * @param ociName - Tool name from OCI GenAI (uses underscores)
 * @returns Tool name with underscores replaced by hyphens
 * 
 * @example
 * toMCPToolName('run_sql') // returns 'run-sql'
 * toMCPToolName('connect') // returns 'connect'
 */
export function toMCPToolName(ociName: string): string {
  return ociName.replace(/_/g, '-');
}

/**
 * Check if MCP client is properly configured.
 * 
 * @param config - MCP configuration to validate
 * @returns true if configuration is valid
 */
export function isMCPConfigured(config: MCPConfig): boolean {
  return Boolean(config.command && config.command.trim().length > 0);
}
