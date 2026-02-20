// src/mastra/agents/index.ts
/**
 * Multi-Agent System exports.
 * 
 * Provides a Claude-like intelligent data exploration experience with:
 * - Database Agent: SQL queries and database connections
 * - Data Analysis Agent: Insights and statistics from query results
 * - Visualization Agent: Charts, tables, and interactive HTML dashboards
 * - Orchestrator: Coordinates all agents for seamless workflows
 */

// Database Agent
export {
  getMCPClient,
  getMCPTools,
  getAgentState,
  updateAgentState,
  clearAgentState,
  DATABASE_AGENT_INSTRUCTIONS,
} from './database-agent';
export type { DatabaseAgentState } from './database-agent';

// Data Analysis Agent
export {
  DATA_ANALYSIS_AGENT_INSTRUCTIONS,
  analyzeData,
} from './data-analysis-agent';
export type { AnalysisRequest, AnalysisResult } from './data-analysis-agent';

// Visualization Agent
export {
  VISUALIZATION_AGENT_INSTRUCTIONS,
  generateVisualization,
} from './visualization-agent';
export type {
  VisualizationRequest,
  VisualizationResult,
} from './visualization-agent';

// Multi-Agent Orchestrator
export { DatabaseOrchestrator } from './orchestrator';
export type { ToolExecutionResult } from './orchestrator';
