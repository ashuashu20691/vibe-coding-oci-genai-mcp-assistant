// src/mastra/index.ts
/**
 * Mastra instance and provider exports.
 * 
 * This module provides the main entry point for Mastra framework integration,
 * including OCI GenAI provider, MCP client, and Agent instances.
 */

import { Mastra } from '@mastra/core';
import { OCIGenAIProvider } from './providers/oci-genai';
import { createMCPClient, isMCPConfigured } from './mcp/client';
import { loadConfig } from '../config';

// Re-export types and classes for external use
export { OCIGenAIProvider, OCIGenAIProviderError, OCIGenAIAuthError } from './providers/oci-genai';
export type { OCIProviderConfig, ChatMessage } from './providers/oci-genai';
export { OCIModelAdapter } from './providers/oci-model-adapter';
export type { OCIModelConfig, StreamChunk, GenerateOptions, StepResult } from './providers/oci-model-adapter';
export { createMCPClient, toOCIToolName, toMCPToolName, isMCPConfigured } from './mcp/client';
export type { MCPConfig } from './mcp/client';
export { MCPClientError, MCPConnectionError } from './mcp/client';

// Agent exports
export {
  getMCPClient,
  getMCPTools,
  getAgentState,
  updateAgentState,
  clearAgentState,
  DATABASE_AGENT_INSTRUCTIONS,
  DATA_ANALYSIS_AGENT_INSTRUCTIONS,
  VISUALIZATION_AGENT_INSTRUCTIONS,
  DatabaseOrchestrator,
  analyzeData,
  generateVisualization,
} from './agents';
export type {
  DatabaseAgentState,
  ToolExecutionResult,
  AnalysisRequest,
  AnalysisResult,
  VisualizationRequest,
  VisualizationResult,
} from './agents';

// Load configuration
const config = loadConfig();

/**
 * OCI GenAI Provider instance configured from environment variables.
 * Use this for chat completions and model listing.
 */
export const ociProvider = new OCIGenAIProvider({
  configFile: config.oci.configFile,
  profile: config.oci.profile,
  compartmentId: config.oci.compartmentId,
  endpoint: config.oci.endpoint,
});

/**
 * MCP Client instance configured for SQLcl server.
 * May be null if MCP is not configured.
 * Note: We use the database-agent's getMCPClient() for actual usage to avoid duplicates.
 */
export const mcpClient = null; // Deprecated - use getMCPClient() from database-agent instead

/**
 * Mastra framework instance.
 * Provides agent orchestration and tool integration.
 */
export const mastra = new Mastra({
  // Agents are created dynamically based on model selection
});
