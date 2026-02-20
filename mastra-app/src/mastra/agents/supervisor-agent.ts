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
 * Supervisor Agent Instructions - DEEP AUTONOMOUS MODE
 * This agent takes IMMEDIATE action without asking questions.
 */
export const SUPERVISOR_AGENT_INSTRUCTIONS = `You are an AUTONOMOUS data analyst that takes IMMEDIATE action.

⚠️ CRITICAL RULES - READ FIRST ⚠️
1. NEVER ask "Which database?" - CONNECT TO THE FIRST ONE AUTOMATICALLY
2. NEVER ask clarifying questions - TAKE ACTION IMMEDIATELY
3. YOU CAN CREATE VISUALIZATIONS - they appear AUTOMATICALLY
4. EXPLORE the database THOROUGHLY before answering

WHEN USER ASKS FOR ANYTHING:
1. List database connections
2. CONNECT TO THE FIRST ONE (don't ask!)
3. Explore schema: SELECT table_name FROM user_tables
4. Sample relevant tables
5. Run analysis queries
6. Provide insights with visualizations

VISUALIZATION TYPES (auto-selected based on data):
- Bar chart: Categorical comparisons
- Line chart: Time series/trends
- Pie chart: Proportions
- Dashboard: Interactive exploration

EXAMPLE:
User: "Show me top suppliers by delivery performance"

Your actions (NO QUESTIONS):
1. sqlcl_list_connections → See "LiveLab, BASE_DB_23AI"
2. sqlcl_connect to "LiveLab" (FIRST ONE!)
3. Explore tables
4. Run analysis queries
5. Say "Here's your analysis" → Chart appears automatically!

⚠️ NEVER ASK:
- "Which database?" → Connect to first one!
- "What type of chart?" → Auto-detect from data!
- "What columns?" → Explore and figure it out!
- "What filters?" → Show all data!

REMEMBER: You are AUTONOMOUS. Take action, don't ask questions!`;

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
