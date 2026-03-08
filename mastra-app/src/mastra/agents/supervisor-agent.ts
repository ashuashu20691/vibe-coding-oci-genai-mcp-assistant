// src/mastra/agents/supervisor-agent.ts
/**
 * Supervisor Agent - Understands user requirements and delegates to specialized agents.
 * Acts as the main entry point for all user requests.
 * NOW OPERATES IN AUTONOMOUS MODE - takes action instead of asking questions.
 */

export type AgentType = 'database' | 'visualization' | 'analysis' | 'general';

export interface TaskClassification {
  primaryAgent: AgentType;
  secondaryAgents: AgentType[];
  requiresData: boolean;
  visualizationType?: 'bar' | 'line' | 'pie' | 'table' | 'dashboard' | 'map' | 'timeline' | 'photo_gallery' | 'custom';
  clarificationNeeded: boolean;
  clarificationQuestions?: string[];
  extractedRequirements: {
    dataSource?: string;
    columns?: string[];
    filters?: string[];
    aggregations?: string[];
    chartTitle?: string;
    customizations?: string[];
  };
}

/**
 * Supervisor Agent Instructions
 * Role: intent classification only — no tool calls, no autonomous action.
 * The database agent handles all execution.
 */
export const SUPERVISOR_AGENT_INSTRUCTIONS = `You are a routing layer that classifies user intent and extracts structured requirements from natural language. You do not execute queries or call tools — you produce a classification that other agents act on.

<classification_rules>
Determine what the user wants based on their message:
- If they mention a database, connection, table, or want data → primaryAgent: "database"
- If they want a chart, graph, dashboard, or visual → add "visualization" to secondaryAgents
- If they want analysis, insights, trends, or statistics → add "analysis" to secondaryAgents
- Default to "database" when intent is unclear but data-related

Extract visualization type from explicit keywords:
- "bar", "column", "histogram" → bar
- "line", "trend", "over time" → line
- "pie", "donut", "breakdown" → pie
- "map", "geographic", "location" → map
- "dashboard", "report", "interactive" → dashboard
- "timeline", "history", "chronology" → timeline
- "gallery", "photo", "image" → photo_gallery

Only set clarificationNeeded=true when the message is completely empty or a generic greeting with no data intent.
</classification_rules>`;

/**
 * Classify user intent and determine which agent(s) should handle the request.
 * Now returns clarificationNeeded=false in most cases to enable autonomous operation.
 */
export function classifyUserIntent(message: string): TaskClassification {
  const lowerMessage = message.toLowerCase();

  // Check for visualization keywords
  const vizKeywords = ['chart', 'graph', 'plot', 'visual', 'dashboard', 'diagram', 'map', 'timeline', 'gallery', 'report', 'show', 'display', 'create', 'generate'];
  const wantsVisualization = vizKeywords.some(k => lowerMessage.includes(k));

  // Check for specific chart types
  const barKeywords = ['bar', 'column', 'histogram', 'comparison', 'compare'];
  const lineKeywords = ['line', 'trend', 'time series', 'over time', 'growth', 'performance'];
  const pieKeywords = ['pie', 'donut', 'proportion', 'percentage', 'distribution', 'breakdown'];
  const mapKeywords = ['map', 'location', 'geographic', 'geo', 'where', 'place'];
  const timelineKeywords = ['timeline', 'chronology', 'history', 'sequence', 'events'];
  const galleryKeywords = ['gallery', 'photo', 'image', 'picture', 'grid'];
  const dashboardKeywords = ['dashboard', 'interactive', 'filter', 'explore', 'report'];

  let visualizationType: TaskClassification['visualizationType'];
  if (barKeywords.some(k => lowerMessage.includes(k))) {
    visualizationType = 'bar';
  } else if (lineKeywords.some(k => lowerMessage.includes(k))) {
    visualizationType = 'line';
  } else if (pieKeywords.some(k => lowerMessage.includes(k))) {
    visualizationType = 'pie';
  } else if (mapKeywords.some(k => lowerMessage.includes(k))) {
    visualizationType = 'map';
  } else if (timelineKeywords.some(k => lowerMessage.includes(k))) {
    visualizationType = 'timeline';
  } else if (galleryKeywords.some(k => lowerMessage.includes(k))) {
    visualizationType = 'photo_gallery';
  } else if (dashboardKeywords.some(k => lowerMessage.includes(k))) {
    visualizationType = 'dashboard';
  } else if (wantsVisualization) {
    visualizationType = 'custom'; // Will auto-detect from data
  }

  // Check for data/database keywords
  const dataKeywords = ['show', 'get', 'fetch', 'query', 'select', 'data', 'table', 'orders', 'customers', 'sales', 'suppliers', 'products', 'delivery', 'performance', 'top', 'best', 'worst'];
  const wantsData = dataKeywords.some(k => lowerMessage.includes(k));

  // Check for analysis keywords
  const analysisKeywords = ['analyze', 'analysis', 'insight', 'summary', 'statistics', 'average', 'total', 'count', 'highlight', 'trend'];
  const wantsAnalysis = analysisKeywords.some(k => lowerMessage.includes(k));

  // AUTONOMOUS MODE: Never ask for clarification unless message is completely empty/ambiguous
  const isCompletelyAmbiguous = lowerMessage.trim().length < 3 || ['hi', 'hello', 'help', 'hey'].includes(lowerMessage.trim());
  const clarificationNeeded = isCompletelyAmbiguous;

  // Determine primary agent
  let primaryAgent: AgentType = 'database'; // Default to database for autonomous operation
  const secondaryAgents: AgentType[] = [];

  if (wantsVisualization || wantsData || wantsAnalysis) {
    primaryAgent = 'database'; // Always start with database to get data
    if (wantsVisualization) secondaryAgents.push('visualization');
    if (wantsAnalysis) secondaryAgents.push('analysis');
  }

  // Extract requirements from message
  const extractedRequirements: TaskClassification['extractedRequirements'] = {};

  // Try to extract column names (words after "by", "of", "for")
  const byMatch = lowerMessage.match(/by\s+(\w+)/);
  const ofMatch = lowerMessage.match(/of\s+(\w+)/);
  if (byMatch) extractedRequirements.columns = [byMatch[1]];
  if (ofMatch) extractedRequirements.dataSource = ofMatch[1];

  return {
    primaryAgent,
    secondaryAgents,
    requiresData: true, // Always assume we need data in autonomous mode
    visualizationType,
    clarificationNeeded,
    clarificationQuestions: undefined, // No questions in autonomous mode
    extractedRequirements,
  };
}

/**
 * Generate clarification prompt - only for completely ambiguous requests.
 */
export function generateClarificationPrompt(classification: TaskClassification): string | null {
  // In autonomous mode, we almost never ask for clarification
  if (!classification.clarificationNeeded) {
    return null;
  }

  // Only for completely ambiguous requests
  return "Hi! I'm ready to help you explore your data. What would you like to see? For example:\n\n" +
    "• \"Show me top suppliers by delivery performance\"\n" +
    "• \"Create a sales dashboard\"\n" +
    "• \"Display orders trend over time\"\n" +
    "• \"List all tables in the database\"";
}
