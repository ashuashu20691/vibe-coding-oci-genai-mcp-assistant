// app/api/chat/route.ts
/**
 * Chat streaming API route using Mastra Agent framework.
 * Handles message streaming with Server-Sent Events,
 * executes tool calls via MCP, and saves messages to database.
 * Uses Supervisor Agent to understand requirements and delegate.
 */

import { NextRequest } from 'next/server';
import { ociProvider } from '@/mastra';
import { ConversationStore } from '@/db/conversation-store';
import { loadConfig, isOracleConfigured } from '@/config';
import { OCIModelAdapter } from '@/mastra/providers/oci-model-adapter';
import { getMCPTools, getAgentState, updateAgentState, DATABASE_AGENT_INSTRUCTIONS } from '@/mastra/agents/database-agent';
import { ChatMessage } from '@/mastra/providers/oci-genai';
import { Message, ToolCall } from '@/types';
import { classifyError, logError, formatErrorResponse } from '@/lib/errors';
import { analyzeData } from '@/mastra/agents/data-analysis-agent';
import { generateVisualization } from '@/mastra/agents/visualization-agent';
import { classifyUserIntent, generateClarificationPrompt, SUPERVISOR_AGENT_INSTRUCTIONS } from '@/mastra/agents/supervisor-agent';
import { createChatService, ENHANCED_SYSTEM_PROMPT } from '@/services/chat-service';
import { NarrativeStreamingService } from '@/services/narrative-streaming-service';
import { workflowOrchestrator, WorkflowStep, WorkflowContext, ProgressEvent } from '@/services/workflow-orchestrator';
import { schemaDiscoveryService } from '@/services/schema-discovery';
import { ResultPresenter, PresentationConfig } from '@/services/result-presenter';
import { automaticReportGenerator } from '@/services/automatic-report-generation';
import { ChatReportRenderer } from '@/services/automatic-report-generation/chat-report-renderer';
import { trimConversationHistory, getContextStats } from '@/utils/context-manager';

const config = loadConfig();

// Create conversation store if Oracle is configured
let conversationStore: ConversationStore | null = null;
if (isOracleConfigured(config)) {
  conversationStore = new ConversationStore(config.oracle);
}

// Per-conversation cache of last query data for visualization requests
const conversationDataCache = new Map<string, Record<string, unknown>[]>();

interface ChatRequestBody {
  messages: Message[];
  modelId: string;
  conversationId?: string;
  selectedDatabase?: string; // Selected database connection from UI
}

/**
 * Extract data from SQL tool result.
 * Handles multiple formats: JSON array, JSON with rows/data key, CSV text.
 */
function extractDataFromToolResult(result: unknown): Record<string, unknown>[] | null {
  if (!result || typeof result !== 'object') return null;
  
  // Unwrap nested { success: true, result: ... } wrapper from DatabaseOrchestrator
  const maybeWrapped = result as { success?: boolean; result?: unknown };
  if (maybeWrapped.success !== undefined && maybeWrapped.result !== undefined) {
    result = maybeWrapped.result;
  }
  
  const resultObj = result as { content?: Array<{ text?: string; type?: string }> };
  
  // Log the raw result structure for debugging
  console.log('[extractDataFromToolResult] Result type:', typeof result);
  console.log('[extractDataFromToolResult] Content length:', resultObj.content?.length);
  if (resultObj.content?.[0]) {
    const preview = JSON.stringify(resultObj.content[0]).slice(0, 500);
    console.log('[extractDataFromToolResult] Content[0] preview:', preview);
  }

  if (!resultObj.content?.[0]?.text) return null;

  try {
    const text = resultObj.content[0].text.trim();

    // Reject non-data tool results: connection confirmations, status messages, errors.
    // These are prose/markdown responses from sqlcl_connect, sqlcl_disconnect, etc.
    // We only want to extract data from sqlcl_run_sql results that contain actual rows.
    const isStatusMessage =
      text.startsWith('###') ||                          // ### DATABASE CONNECTION ESTABLISHED ###
      text.startsWith('**') ||                           // **bold** markdown status
      text.startsWith('Successfully connected') ||
      text.startsWith('Connected to') ||
      text.startsWith('Disconnected') ||
      text.startsWith('Error') ||
      text.startsWith('ORA-') ||
      text.startsWith('Connection') ||
      text.includes('Successfully connected') ||
      text.includes('CONNECTION ESTABLISHED') ||
      text.includes('connection established') ||
      // Short prose responses (< 5 lines) that aren't JSON or CSV
      (text.split('\n').filter(l => l.trim()).length <= 4 &&
        !text.startsWith('[') &&
        !text.startsWith('{') &&
        !text.includes(','));  // no commas = not CSV
    if (isStatusMessage) {
      console.log('[extractDataFromToolResult] Skipping status/connection message');
      return null;
    }
    
    // Try JSON parse first (SQLcl MCP often returns JSON)
    if (text.startsWith('[') || text.startsWith('{')) {
      try {
        const parsed = JSON.parse(text);
        
        // Direct array of objects
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
          console.log('[extractDataFromToolResult] Parsed JSON array, rows:', parsed.length);
          return parsed as Record<string, unknown>[];
        }
        
        // Object with rows/data/results/items key
        if (typeof parsed === 'object' && parsed !== null) {
          // SQLcl columnar: { columns: [...], rows: [[...], [...]] } — check FIRST
          // before the generic "rows" key check, since rows here is array-of-arrays not array-of-objects
          if (
            Array.isArray((parsed as Record<string, unknown>).columns) &&
            Array.isArray((parsed as Record<string, unknown>).rows)
          ) {
            const cols = (parsed as { columns: string[]; rows: unknown[][] }).columns;
            const rows = (parsed as { columns: string[]; rows: unknown[][] }).rows;
            // Only treat as columnar if rows are arrays (not objects)
            if (rows.length === 0 || Array.isArray(rows[0])) {
              console.log('[extractDataFromToolResult] Parsed SQLcl columnar format, rows:', rows.length);
              return rows.map(row => {
                const obj: Record<string, unknown> = {};
                cols.forEach((col, i) => {
                  const val = row[i];
                  obj[col] = typeof val === 'string' ? (isNaN(parseFloat(val)) || /^\d{4}-\d{2}/.test(val) ? val : parseFloat(val)) : val;
                });
                return obj;
              });
            }
          }

          const dataKey = ['rows', 'data', 'results', 'items', 'records'].find(k => Array.isArray((parsed as Record<string, unknown>)[k]));
          if (dataKey) {
            const rows = (parsed as Record<string, unknown[]>)[dataKey];
            console.log('[extractDataFromToolResult] Parsed JSON object.', dataKey, ', rows:', rows.length);
            return rows as Record<string, unknown>[];
          }
        }
      } catch {
        // Not valid JSON, fall through to CSV parsing
      }
    }

    // CSV parsing fallback
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return null;

    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const data = lines.slice(1).map(line => {
      // Handle quoted CSV values properly
      const values = line.match(/(".*?"|[^,]+)(?=,|$)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || line.split(',').map(v => v.replace(/"/g, '').trim());
      const row: Record<string, unknown> = {};
      headers.forEach((header, i) => {
        const value = values[i] ?? '';
        const numValue = parseFloat(value);
        // Keep as string if: not a number, or looks like a date (YYYY-MM-DD, DD/MM/YYYY, etc.)
        const isDateLike = /^\d{4}-\d{2}|\d{2}\/\d{2}\/\d{4}/.test(value);
        row[header] = (isNaN(numValue) || isDateLike) ? value : numValue;
      });
      return row;
    });
    
    console.log('[extractDataFromToolResult] Parsed CSV, rows:', data.length);
    return data;
  } catch (e) {
    console.error('[extractDataFromToolResult] Parse error:', e);
    return null;
  }
}

/**
 * Extract tabular data from a markdown table in text.
 * Handles | col1 | col2 | format.
 */
function extractDataFromMarkdownTable(text: string): Record<string, unknown>[] | null {
  try {
    const lines = text.split('\n').filter(l => l.trim().startsWith('|'));
    if (lines.length < 3) return null; // Need header + separator + at least 1 row
    
    // Parse header
    const headers = lines[0].split('|').map(h => h.trim()).filter(h => h.length > 0);
    if (headers.length === 0) return null;
    
    // Skip separator line (---|---|---)
    const dataLines = lines.slice(2);
    if (dataLines.length === 0) return null;
    
    const data = dataLines.map(line => {
      const values = line.split('|').map(v => v.trim()).filter((v, i) => i > 0 && i <= headers.length);
      const row: Record<string, unknown> = {};
      headers.forEach((header, i) => {
        const value = values[i] ?? '';
        const numValue = parseFloat(value.replace(/,/g, ''));
        row[header] = isNaN(numValue) ? value : numValue;
      });
      return row;
    }).filter(row => Object.values(row).some(v => v !== ''));
    
    return data.length > 0 ? data : null;
  } catch {
    return null;
  }
}

/**
 * Detect if query result contains multi-modal content (images, similarity scores, etc.)
 * Requirement 8.1, 8.2: Detect image columns and metrics
 */
function detectMultiModalContent(data: Record<string, unknown>[]): {
  hasImages: boolean;
  hasSimilarityScores: boolean;
  hasDistances: boolean;
  hasViewCounts: boolean;
  imageColumns: string[];
  similarityColumn?: string;
  distanceColumn?: string;
  viewCountColumn?: string;
} {
  if (!data || data.length === 0) {
    return {
      hasImages: false,
      hasSimilarityScores: false,
      hasDistances: false,
      hasViewCounts: false,
      imageColumns: [],
    };
  }

  const firstRow = data[0];
  const columns = Object.keys(firstRow);

  // Detect image columns (base64 data, URLs, or BLOB indicators)
  const imageColumns = columns.filter(col => {
    const value = firstRow[col];
    if (typeof value === 'string') {
      return (
        value.startsWith('data:image/') ||
        value.startsWith('http://') ||
        value.startsWith('https://') ||
        col.toLowerCase().includes('image') ||
        col.toLowerCase().includes('photo') ||
        col.toLowerCase().includes('picture')
      );
    }
    return false;
  });

  // Detect similarity score column
  const similarityColumn = columns.find(
    col =>
      col.toLowerCase().includes('similarity') ||
      col.toLowerCase().includes('distance') ||
      col.toLowerCase() === 'score'
  );

  // Detect distance column
  const distanceColumn = columns.find(
    col =>
      col.toLowerCase().includes('distance_') ||
      (col.toLowerCase().includes('distance') && !col.toLowerCase().includes('similarity'))
  );

  // Detect view count column
  const viewCountColumn = columns.find(
    col =>
      col.toLowerCase().includes('view') ||
      col.toLowerCase().includes('count') ||
      col.toLowerCase() === 'views'
  );

  return {
    hasImages: imageColumns.length > 0,
    hasSimilarityScores: !!similarityColumn,
    hasDistances: !!distanceColumn,
    hasViewCounts: !!viewCountColumn,
    imageColumns,
    similarityColumn,
    distanceColumn,
    viewCountColumn,
  };
}

/**
 * Convert Message array to ChatMessage array for OCI provider.
 * Filters out messages with empty content to avoid API errors.
 */
function toChatMessages(messages: Message[]): ChatMessage[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'system' || m.role === 'tool' || (m.role === 'assistant' && (m.content?.trim() || m.toolCalls?.length)))
    .map((m) => ({
      role: m.role,
      content: m.content || '',
      toolCalls: m.toolCalls,
      toolCallId: m.toolCallId,
    }));
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequestBody = await request.json();
    let { messages, modelId, conversationId, selectedDatabase } = body;

    console.log(`[chat/POST] Received request: ${messages?.length} messages, model: ${modelId}, conversationId: ${conversationId}, database: ${selectedDatabase || 'none'}`);

    // Validation
    if (!messages || !Array.isArray(messages)) {
      console.log('[chat/POST] Validation failed: messages array required');
      return new Response(
        JSON.stringify(formatErrorResponse(new Error('Messages array required'))),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!modelId) {
      console.log('[chat/POST] Validation failed: model ID required');
      return new Response(
        JSON.stringify(formatErrorResponse(new Error('Model ID required'))),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Trim conversation history to prevent context overflow
    const contextStats = getContextStats(messages, modelId);
    console.log(`[chat/POST] Context usage: ${contextStats.totalTokens}/${contextStats.maxTokens} tokens (${contextStats.usagePercent.toFixed(1)}%)`);
    
    if (contextStats.usagePercent > 80) {
      console.log(`[chat/POST] Context usage high, trimming conversation history...`);
      messages = trimConversationHistory(messages, modelId);
      const newStats = getContextStats(messages, modelId);
      console.log(`[chat/POST] After trimming: ${newStats.totalTokens}/${newStats.maxTokens} tokens (${newStats.usagePercent.toFixed(1)}%)`);
    }

    // Check for OCI provider initialization errors
    const initError = ociProvider.getInitError();
    if (initError) {
      console.log('[chat/POST] OCI provider init error:', initError.message);
      logError('chat/POST', initError, { modelId });
      return new Response(
        JSON.stringify(formatErrorResponse(initError)),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get MCP tools for the agent
    console.log('[chat/POST] Getting MCP tools...');
    const mcpTools = await getMCPTools();
    const hasTools = Object.keys(mcpTools).length > 0;
    console.log(`[chat/POST] MCP tools: ${Object.keys(mcpTools).length} tools available`);

    // Initialize workflow orchestrator with schema discovery service
    // Requirement 4.4, 5.5: Pass selected database to workflow context and update schema cache
    workflowOrchestrator.setSchemaDiscoveryService(schemaDiscoveryService);
    
    // If a database is selected, set it as the active connection
    if (selectedDatabase) {
      schemaDiscoveryService.setActiveConnection(selectedDatabase);
      console.log(`[chat/POST] Set active database connection: ${selectedDatabase}`);
    }

    // Create model adapter with agentic capabilities
    const modelAdapter = new OCIModelAdapter({
      provider: ociProvider,
      modelId,
      temperature: 0,
      maxTokens: 4000,
      conversationId: conversationId || 'default',
    });

    // Get agent state for connection tracking
    const agentState = conversationId ? getAgentState(conversationId) : null;

    // Check if user has already selected a database in this conversation
    const hasActiveConnection = agentState?.activeConnection != null;

    // Check if user message contains a database selection (e.g., "connect to LiveLab", "use LiveLab")
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content?.toLowerCase() || '';
    const lastUserMessageOriginal = messages.filter(m => m.role === 'user').pop()?.content || '';
    const isSelectingDatabase = lastUserMessage.includes('connect') ||
      lastUserMessage.includes('use ') ||
      lastUserMessage.includes('livelab') ||
      lastUserMessage.includes('claude_mcp') ||
      lastUserMessage.includes('base_db') ||
      messages.some(m => m.role === 'assistant' && m.content?.includes('Which database'));

    // Use Supervisor Agent to classify user intent
    const userIntent = classifyUserIntent(lastUserMessageOriginal);
    console.log('[chat/POST] User intent classification:', userIntent);

    // Check if this is a SUPPLIER ANALYSIS request - trigger dedicated workflow
    const supplierKeywords = ['supplier', 'delivery', 'on-time', 'performance', 'shipment'];
    // DISABLED: Dedicated supplier workflow has MCP initialization issues
    // Let the normal agent handle it conversationally instead
    const isSupplierAnalysis = false; // supplierKeywords.filter(k => lastUserMessage.includes(k)).length >= 2;

    // NOTE: Workflow Orchestrator Integration
    // The WorkflowOrchestrator service is available for complex multi-step workflows.
    // It provides:
    // - Autonomous multi-step execution with dependency resolution (Requirement 1.1, 1.2)
    // - Progress tracking and streaming (Requirement 1.3)
    // - Integration with retry orchestrator for error recovery (Requirement 1.3)
    // - Insight generation from completed workflows (Requirement 1.7)
    // - Database context management (Requirement 4.4, 5.5)
    //
    // To use it for complex queries:
    // 1. Detect complex workflow patterns (multi-step, multi-modal, etc.)
    // 2. Create WorkflowStep[] with dependencies
    // 3. Create context with selected database:
    //    const context: WorkflowContext = {
    //      database: selectedDatabase,
    //      conversationId,
    //      userId: 'user-id',
    //    };
    // 4. Call workflowOrchestrator.createExecutionPlan(steps, context)
    // 5. Execute with workflowOrchestrator.execute(plan, progressCallback)
    // 6. Stream progress events to client
    //
    // The workflow orchestrator automatically:
    // - Passes the selected database to all workflow steps
    // - Invalidates schema cache when database changes (Requirement 5.5)
    // - Maintains schema cache for the session duration
    //
    // Currently, the chat API uses ChatService for conversational tool execution,
    // which provides similar capabilities through the agent's autonomous operation.
    // The WorkflowOrchestrator can be integrated when explicit multi-step workflows
    // are needed (e.g., "first do X, then Y, then Z" type queries).

    // Check if this is an intelligent data analysis request
    const analysisKeywords = [
      'analyze', 'analysis', 'fraud', 'detect', 'pattern',
      'geographic', 'location', 'similar', 'similarity',
      'trend', 'time series', 'compare', 'distribution',
      'anomaly', 'outlier', 'generate data', 'synthetic data',
      'demo data', 'create data', 'sample data', 'test data',
      'crypto fraud', 'fraud detection', 'crypto transaction',
      'sales', 'sales data', 'revenue', 'orders', 'customers',
      'products', 'purchase', 'retail', 'ecommerce',
    ];
    const isAnalysisRequest = analysisKeywords.some(keyword => 
      lastUserMessage.includes(keyword.toLowerCase())
    );

    // Check if clarification is needed - in autonomous mode, almost never
    const clarificationPrompt = generateClarificationPrompt(userIntent);

    // Check if user is requesting a visualization (any viz type, including custom/dashboard)
    const isVisualizationRequest = !!(userIntent.visualizationType) ||
      lastUserMessage.match(/\b(visual|chart|graph|dashboard|plot|report|html)\b/) !== null;

    // Create streaming response
    const encoder = new TextEncoder();
    // AUTONOMOUS MODE: Don't stop after listing connections - let agent auto-connect
    const shouldStopAfterListConnections = false;
    let listedConnections = false;

    // If this is a supplier analysis request, run the dedicated workflow
    if (isSupplierAnalysis) {
      console.log('[chat/POST] Detected supplier analysis request - running dedicated workflow');
      
      // Extract database name from message if explicitly specified
      // Only match known database name patterns (alphanumeric with underscores, typically uppercase or CamelCase)
      let dbName: string | undefined;
      
      // Look for explicit database references like "use BASE_DB_23AI" or "connect to LiveLab"
      const explicitDbPatterns = [
        /(?:use|connect\s+to|using)\s+([A-Z][A-Za-z0-9_]+(?:_[A-Z0-9]+)*)\s*(?:db|database)?/i,
        /(?:db|database)\s*[=:]\s*([A-Za-z][A-Za-z0-9_-]+)/i,
        /\b(BASE_DB_\w+|LiveLab|CLAUDE_MCP|[A-Z][A-Z0-9_]+_DB)\b/i,
      ];
      
      for (const pattern of explicitDbPatterns) {
        const match = lastUserMessage.match(pattern);
        if (match) {
          dbName = match[1];
          console.log(`[chat/POST] Extracted database name: ${dbName}`);
          break;
        }
      }

      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Import and run supplier analysis
            const { runSupplierAnalysis } = await import('@/services/supplier-analysis');
            
            // Stream conversational progress messages
            const result = await runSupplierAnalysis(dbName, (step, detail) => {
              // Send progress as conversational content that appears in chat
              if (step === 'thinking') {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ thinking: detail })}\n\n`));
              } else if (step === 'success') {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: detail + '\n\n' })}\n\n`));
              } else if (step === 'info') {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: detail + '\n\n' })}\n\n`));
              } else {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ progress: detail })}\n\n`));
              }
            });

            // Generate summary content
            const summaryContent = `## 📊 Supplier Delivery Performance Analysis

### Key Metrics
- **Total Suppliers:** ${result.summary.totalSuppliers}
- **Total Deliveries:** ${result.summary.totalDeliveries}
- **Overall On-Time Rate:** ${result.summary.overallOnTimeRate.toFixed(1)}%

### 🏆 Top Performers
${result.topPerformers.map(p => `- **${p.supplierName}**: ${p.onTimeRate.toFixed(1)}% (Grade ${p.grade})`).join('\n')}

### ⚠️ Needs Improvement
${result.bottomPerformers.map(p => `- **${p.supplierName}**: ${p.onTimeRate.toFixed(1)}% (Grade ${p.grade})`).join('\n')}

### 💡 Key Insights
${result.insights.map(i => `- ${i}`).join('\n')}

### ✅ Recommendations
${result.recommendations.map(r => `- ${r}`).join('\n')}`;

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: summaryContent })}\n\n`));

            // Generate and send the HTML dashboard - inline since we already have the result
            const dashboardHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Supplier Performance Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #1e3a5f 0%, #0d1b2a 100%); min-height: 100vh; color: #fff; padding: 20px; }
    .dashboard { max-width: 1200px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { font-size: 1.8em; background: linear-gradient(135deg, #00d4ff 0%, #7c3aed 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .stat-card { background: rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; text-align: center; }
    .stat-value { font-size: 2em; font-weight: 700; color: #00d4ff; }
    .stat-label { color: #94a3b8; font-size: 0.85em; }
    .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; }
    .card { background: rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; }
    .card h2 { font-size: 1.1em; margin-bottom: 16px; }
    .performer-item { display: flex; justify-content: space-between; padding: 10px; margin-bottom: 6px; background: rgba(255,255,255,0.05); border-radius: 6px; }
    .grade { padding: 2px 10px; border-radius: 12px; font-size: 0.8em; font-weight: 600; }
    .grade-a { background: #10b981; } .grade-b { background: #3b82f6; } .grade-c { background: #f59e0b; color: #000; } .grade-d { background: #ef4444; }
    .chart-container { height: 250px; }
    .insight-item { padding: 10px; margin-bottom: 6px; background: rgba(255,255,255,0.05); border-radius: 6px; border-left: 3px solid #00d4ff; }
  </style>
</head>
<body>
  <div class="dashboard">
    <div class="header"><h1>📊 Supplier Delivery Performance</h1></div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-value">${result.summary.totalSuppliers}</div><div class="stat-label">Suppliers</div></div>
      <div class="stat-card"><div class="stat-value">${result.summary.totalDeliveries}</div><div class="stat-label">Deliveries</div></div>
      <div class="stat-card"><div class="stat-value">${result.summary.overallOnTimeRate.toFixed(1)}%</div><div class="stat-label">On-Time Rate</div></div>
      <div class="stat-card"><div class="stat-value">${result.summary.avgDeliveryDays.toFixed(1)}</div><div class="stat-label">Avg Days</div></div>
    </div>
    <div class="grid-2">
      <div class="card">
        <h2>🏆 Top Performers</h2>
        ${result.topPerformers.map(p => `<div class="performer-item"><span>${p.supplierName}</span><span class="grade grade-${p.grade.toLowerCase()}">${p.onTimeRate.toFixed(1)}%</span></div>`).join('')}
      </div>
      <div class="card">
        <h2>⚠️ Needs Improvement</h2>
        ${result.bottomPerformers.map(p => `<div class="performer-item"><span>${p.supplierName}</span><span class="grade grade-${p.grade.toLowerCase()}">${p.onTimeRate.toFixed(1)}%</span></div>`).join('')}
      </div>
    </div>
    <div class="card">
      <h2>🌍 Regional Performance</h2>
      <div class="chart-container"><canvas id="chart"></canvas></div>
    </div>
    <div class="card" style="margin-top: 16px;">
      <h2>💡 Insights & Recommendations</h2>
      ${result.insights.map(i => `<div class="insight-item">${i}</div>`).join('')}
      ${result.recommendations.map(r => `<div class="insight-item" style="border-left-color: #10b981;">${r}</div>`).join('')}
    </div>
  </div>
  <script>
    new Chart(document.getElementById('chart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(result.regionalBreakdown.map(r => r.region))},
        datasets: [{ label: 'On-Time %', data: ${JSON.stringify(result.regionalBreakdown.map(r => r.onTimeRate))}, backgroundColor: 'rgba(0, 212, 255, 0.8)', borderRadius: 6 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' } }, x: { grid: { display: false }, ticks: { color: '#94a3b8' } } } }
    });
  </script>
</body>
</html>`;

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              visualization: {
                type: 'custom_dashboard',
                html: dashboardHTML,
                title: 'Supplier Delivery Performance Dashboard',
              }
            })}\n\n`));

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          } catch (error) {
            console.error('[chat/POST] Supplier analysis error:', error);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              error: error instanceof Error ? error.message : 'Analysis failed',
              content: 'I encountered an error running the supplier analysis. Let me try a different approach...'
            })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          }
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
        },
      });
    }
    let lastQueryData: Record<string, unknown>[] | null = null; // Store last query data for visualization

    // AUTONOMOUS MODE: Always use database agent instructions for autonomous operation
    let systemInstructions = DATABASE_AGENT_INSTRUCTIONS;

    // Auto-detect database name from user message if not explicitly provided
    if (!selectedDatabase) {
      const dbPatterns = [
        /\b(BASE_DB_\w+)\b/i,
        /\b(LIVELAB\w*)\b/i,
        /\b(CLAUDE_MCP\w*)\b/i,
        /(?:connect\s+to|use|using)\s+([A-Za-z][A-Za-z0-9_]+)/i,
      ];
      for (const pattern of dbPatterns) {
        const match = lastUserMessageOriginal.match(pattern);
        if (match) {
          selectedDatabase = match[1];
          console.log(`[chat/POST] Auto-detected database from message: ${selectedDatabase}`);
          break;
        }
      }
    }
    
    // Inject active connection context if database is selected
    if (selectedDatabase) {
      // Update agent state to track the selected database
      if (conversationId) {
        updateAgentState(conversationId, { activeConnection: selectedDatabase });
      }
      
      systemInstructions += `\n\nCURRENT CONTEXT:\n- User has selected database: ${selectedDatabase}\n- Connect to this database using sqlcl_connect tool with connection_name="${selectedDatabase}"\n- After connecting, proceed with the user's query\n- Do NOT list connections or ask which database to use`;
    } else if (agentState?.activeConnection) {
      systemInstructions += `\n\nCURRENT CONTEXT:\n- Active database connection: ${agentState.activeConnection}\n- Connect to this database using sqlcl_connect tool with connection_name="${agentState.activeConnection}"\n- After connecting, proceed with the user's query\n- Do NOT list connections or ask which database to use`;
    }

    // Create narrative streaming service
    const narrativeService = new NarrativeStreamingService();

    // Create ChatService with narrative integration
    const chatService = createChatService(modelAdapter, narrativeService, {
      systemPrompt: systemInstructions,
      maxIterations: 12,
    });

    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = '';
        const allToolCalls: ToolCall[] = [];
        const allToolResults: Array<{ toolCallId: string; result: unknown }> = [];
        
        // Collect tool narratives for saving
        const toolNarratives: Array<{ toolCallId: string; toolName: string; phase: 'start' | 'result' | 'error'; narrative: string; timestamp: Date }> = [];
        
        // Progress tracking for multi-step operations
        let currentStepNumber = 0;
        let totalSteps = 0;
        let operationStarted = false;

        // Send initial ping to verify stream is working
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ ping: true })}\n\n`));
        console.log('[chat/POST] Sent initial ping');

        // Check if there's recent data in conversation that we can visualize
        // First check the per-conversation cache (populated when tool results come in)
        const cacheKey = conversationId || 'default';
        let existingData: Record<string, unknown>[] | null = conversationDataCache.get(cacheKey) || null;
        console.log(`[chat/POST] Cache lookup for key "${cacheKey}": ${existingData ? existingData.length + ' rows' : 'null'}`);
        
        // Also try to extract from tool results in message history
        if (!existingData) {
          for (const msg of [...messages].reverse()) {
            if (msg.role === 'tool' && msg.content) {
              const parsed = extractDataFromToolResult({ content: [{ text: msg.content }] });
              if (parsed && parsed.length > 0) {
                existingData = parsed;
                console.log(`[chat/POST] Extracted ${parsed.length} rows from message history`);
                break;
              }
            }
          }
        }
        
        // Last resort: extract from markdown table in previous assistant messages
        if (!existingData) {
          for (const msg of [...messages].reverse()) {
            if (msg.role === 'assistant' && msg.content) {
              const tableData = extractDataFromMarkdownTable(msg.content);
              if (tableData && tableData.length > 0) {
                existingData = tableData;
                console.log(`[chat/POST] Extracted ${tableData.length} rows from markdown table`);
                break;
              }
            }
          }
        }

        // If user wants visualization and we have existing data, generate it directly (bypass AI)
        if (isVisualizationRequest && existingData && existingData.length > 0) {
          let vizType: 'auto' | 'bar' | 'line' | 'pie' | 'html' = 'auto';
          let vizTitle = 'Data Visualization';

          switch (userIntent.visualizationType) {
            case 'bar': vizType = 'bar'; vizTitle = 'Bar Chart'; break;
            case 'line': vizType = 'line'; vizTitle = 'Line Chart'; break;
            case 'pie': vizType = 'pie'; vizTitle = 'Pie Chart'; break;
            case 'dashboard':
            case 'custom':
              vizType = 'html'; vizTitle = 'Interactive Dashboard'; break;
            default: vizType = 'auto'; vizTitle = 'Data Visualization'; break;
          }

          try {
            const viz = await generateVisualization({
              data: existingData,
              type: vizType,
              title: vizTitle,
            });

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: `Here's your ${vizTitle}:` })}\n\n`));
            
            const visualizationData: Record<string, unknown> = { type: viz.type, title: vizTitle };
            if (typeof viz.content === 'string') {
              visualizationData.html = viz.content;
            } else if (typeof viz.content === 'object' && viz.content !== null) {
              Object.assign(visualizationData, viz.content);
            }
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ visualization: visualizationData })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
            controller.close();
            return;
          } catch (vizError) {
            console.error('[chat/POST] Direct visualization error:', vizError);
            // Fall through to agent
          }
        }

        // If clarification is needed and this is a new visualization request, send clarification
        if (clarificationPrompt && !messages.some(m => m.role === 'assistant' && (m.content?.includes('What data') || m.content?.includes('What type')))) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: clarificationPrompt })}\n\n`));
          fullResponse = clarificationPrompt;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          controller.close();
          return;
        }

        // NOTE: Analysis requests now flow through the normal agent to ensure proper
        // database connection and step-by-step tool execution with thinking messages.
        // The agent will use MCP tools to connect, query, and analyze data.

        try {
          // Set system instructions based on user intent
          ociProvider.setSystemPreamble(systemInstructions);

          const chatMessages = toChatMessages(messages);

          // Configure stream options for tool execution
          const streamOptions = hasTools
            ? {
              toolsets: { sqlcl: mcpTools },
              maxSteps: 15, // Increased for deep autonomous analysis
              onStepFinish: (step: { text: string; toolCalls: ToolCall[]; toolResults: Array<{ toolCallId: string; result: unknown }>; finishReason: string }) => {
                console.log(`[chat] Step finished: ${step.toolCalls.length} tool calls, reason: ${step.finishReason}`);

                // Track connection state
                if (conversationId && agentState) {
                  for (const tc of step.toolCalls) {
                    if (tc.name.includes('connect') && tc.arguments?.connection_name) {
                      updateAgentState(conversationId, {
                        activeConnection: tc.arguments.connection_name as string,
                      });
                      console.log(`[chat] Connection tracked: ${tc.arguments.connection_name}`);
                    }
                    if (tc.name.includes('disconnect')) {
                      updateAgentState(conversationId, { activeConnection: null });
                      console.log(`[chat] Connection cleared`);
                    }
                  }
                }
              },
            }
            : {};

          console.log(`[chat/POST] Starting ChatService stream with ${chatMessages.length} messages, hasTools: ${hasTools}`);

          // Use ChatService for narrative-integrated streaming
          for await (const event of chatService.sendMessageWithNarrative(chatMessages, streamOptions)) {
            console.log(`[chat/POST] ChatService event type: ${event.type}`);
            
            switch (event.type) {
              case 'narrative':
                // Stream narrative chunks as content (appears before tool execution)
                // Validates: Requirements 13.1, 13.2, 13.6
                if (event.content) {
                  fullResponse += event.content;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ content: event.content })}\n\n`)
                  );
                  console.log(`[chat/POST] Streamed narrative: ${event.content.slice(0, 50)}...`);
                }
                break;

              case 'content':
                // Pass through assistant response content
                if (event.content) {
                  fullResponse += event.content;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ content: event.content })}\n\n`)
                  );
                  console.log(`[chat/POST] Streamed content: ${event.content.slice(0, 50)}...`);
                }
                break;

              case 'tool_call':
                // Tool call event with pre-tool narrative already streamed
                if (event.toolCall) {
                  // Initialize progress tracking on first tool call
                  if (!operationStarted) {
                    operationStarted = true;
                    totalSteps = 0;
                  }
                  
                  currentStepNumber++;
                  allToolCalls.push(event.toolCall);
                  
                  // Emit iteration_update for working badge
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        iteration_update: {
                          current: currentStepNumber,
                          max: 5,
                          strategy: `Processing step ${currentStepNumber}...`,
                        },
                      })}\n\n`
                    )
                  );
                  
                  // Store pre-tool narrative (already streamed by ChatService)
                  if (event.narrative) {
                    toolNarratives.push({
                      toolCallId: event.toolCall.id,
                      toolName: event.toolCall.name,
                      phase: 'start',
                      narrative: event.narrative,
                      timestamp: new Date(),
                    });
                  }
                  
                  // Emit tool call event for UI
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        toolCall: {
                          id: event.toolCall.id,
                          name: event.toolCall.name,
                          arguments: event.toolCall.arguments,
                        },
                      })}\n\n`
                    )
                  );
                  
                  console.log(`[chat/POST] Tool call: ${event.toolCall.name}`);
                }
                break;

              case 'tool_result':
                // Tool result event with post-tool narrative already streamed
                if (event.result) {
                  allToolResults.push({
                    toolCallId: event.result.toolCallId,
                    result: event.result.content
                  });
                  
                  // Find corresponding tool call
                  const toolCall = allToolCalls.find(
                    tc => tc.id === event.result.toolCallId
                  );
                  
                  // Store post-tool narrative (already streamed by ChatService)
                  if (toolCall && event.narrative) {
                    toolNarratives.push({
                      toolCallId: event.result.toolCallId,
                      toolName: toolCall.name,
                      phase: 'result',
                      narrative: event.narrative,
                      timestamp: new Date(),
                    });
                  }
                  
                  // Truncate large results for display
                  let resultJson = JSON.stringify(event.result.content, null, 2);
                  if (resultJson.length > 5000) {
                    resultJson = resultJson.slice(0, 5000) + '\n... (truncated)';
                  }

                  // Emit tool result event for UI
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        toolResult: {
                          toolCallId: event.result.toolCallId,
                          result: event.result.content,
                        },
                      })}\n\n`
                    )
                  );

                  // Cache SQL query data for on-demand visualization
                  // The agent autonomously decides when to visualize — we don't auto-generate charts
                  const isSqlQuery = toolCall?.name === 'sqlcl_run_sql';
                  const data = isSqlQuery ? extractDataFromToolResult(event.result.content) : null;
                  console.log(`[chat/POST] extractDataFromToolResult result: ${data ? data.length + ' rows, cols: ' + Object.keys(data[0] || {}).join(',') : 'null'} (tool: ${toolCall?.name})`);
                  if (data && data.length > 0) {
                    lastQueryData = data;
                    conversationDataCache.set(conversationId || 'default', data);
                    console.log(`[chat/POST] Cached ${data.length} rows for conversation ${conversationId || 'default'}`);

                    // Generate visualization only when the user explicitly requested one
                    // (dashboard, chart, graph, visual, etc.) — not on every SQL result
                    if (isVisualizationRequest) {
                      try {
                        const analysis = analyzeData({ data, query: 'SQL query' });
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ analysis })}\n\n`));

                        let vizType: 'auto' | 'bar' | 'line' | 'pie' | 'html' = 'auto';
                        let vizTitle = 'Query Results';
                        if (userIntent.visualizationType) {
                          switch (userIntent.visualizationType) {
                            case 'bar': vizType = 'bar'; vizTitle = 'Bar Chart'; break;
                            case 'line': vizType = 'line'; vizTitle = 'Line Chart'; break;
                            case 'pie': vizType = 'pie'; vizTitle = 'Pie Chart'; break;
                            case 'dashboard': vizType = 'html'; vizTitle = 'Dashboard'; break;
                          }
                        }
                        if (lastUserMessage.includes('dashboard')) {
                          vizType = 'html';
                          vizTitle = 'Data Dashboard';
                        }

                        const viz = await generateVisualization({ data, type: vizType, title: vizTitle });
                        console.log(`[chat/POST] Generated ${viz.type} visualization`);

                        const visualizationData: Record<string, unknown> = { type: viz.type, title: vizTitle };
                        if (typeof viz.content === 'string') {
                          visualizationData.html = viz.content;
                        } else if (typeof viz.content === 'object' && viz.content !== null) {
                          Object.assign(visualizationData, viz.content);
                        }
                        visualizationData.data = data;

                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ visualization: visualizationData })}\n\n`));
                      } catch (vizError) {
                        console.error('[chat/POST] Visualization error:', vizError);
                      }
                    }
                  }
                  
                  console.log(`[chat/POST] Tool result for: ${event.result.toolCallId}`);
                }
                break;

              case 'iteration_update':
                // Iteration update for autonomous retry loops
                // Emit for UI progress indicators
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      iteration_update: {
                        current: event.iteration,
                        max: event.maxIterations,
                        strategy: `Attempt ${event.iteration} of ${event.maxIterations}`,
                      },
                    })}\n\n`
                  )
                );
                console.log(`[chat/POST] Iteration update: ${event.iteration}/${event.maxIterations}`);
                break;

              case 'error':
                // Error event with error narrative already streamed
                if (event.error) {
                  // Find current tool call for narrative storage
                  const currentToolCall = allToolCalls[allToolCalls.length - 1];
                  if (currentToolCall && event.narrative) {
                    toolNarratives.push({
                      toolCallId: currentToolCall.id,
                      toolName: currentToolCall.name,
                      phase: 'error',
                      narrative: event.narrative,
                      timestamp: new Date(),
                    });
                  }
                  
                  // Emit error event for UI
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        error: event.error,
                        isRetryable: true,
                      })}\n\n`
                    )
                  );
                  
                  console.log(`[chat/POST] Error: ${event.error}`);
                }
                break;

              case 'done':
                // Completion event
                // If this was a multi-step operation, send completion summary
                if (currentStepNumber > 1) {
                  totalSteps = currentStepNumber;
                  
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ 
                        progress: `Completed ${totalSteps} steps.\n\n`,
                        step: { current: totalSteps, total: totalSteps }
                      })}\n\n`
                    )
                  );
                }
                
                // Post-processing: if AI refused to generate visualization but we have cached data, generate it now
                {
                  const refusalPhrases = ['cannot directly generate', 'cannot create visual', 'cannot generate html', 'i cannot create', 'unable to generate', 'not able to generate', 'cannot design'];
                  const aiRefused = refusalPhrases.some(p => fullResponse.toLowerCase().includes(p));
                  const cachedData = conversationDataCache.get(conversationId || 'default');
                  
                  if (aiRefused && cachedData && cachedData.length > 0 && isVisualizationRequest) {
                    console.log('[chat/POST] AI refused visualization but we have cached data - generating directly');
                    try {
                      const viz = await generateVisualization({ data: cachedData, type: 'auto', title: 'Data Visualization' });
                      const visualizationData: Record<string, unknown> = { type: viz.type, title: 'Data Visualization' };
                      if (typeof viz.content === 'string') {
                        visualizationData.html = viz.content;
                      } else if (typeof viz.content === 'object' && viz.content !== null) {
                        Object.assign(visualizationData, viz.content);
                      }
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ visualization: visualizationData })}\n\n`));
                      console.log('[chat/POST] Sent override visualization after AI refusal');
                    } catch (e) {
                      console.error('[chat/POST] Override visualization error:', e);
                    }
                  }
                }
                
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ finishReason: event.finishReason })}\n\n`
                  )
                );
                console.log(`[chat/POST] Stream finished: ${event.finishReason}`);
                break;
            }
          }

          // Save assistant message to database
          if (conversationId && fullResponse && conversationStore) {
            try {
              await conversationStore.addMessage(conversationId, {
                role: 'assistant',
                content: fullResponse,
                timestamp: new Date(),
                toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
                toolNarratives: toolNarratives.length > 0 ? toolNarratives : undefined,
              });
              console.log(`[chat] Saved assistant message to conversation ${conversationId} with ${toolNarratives.length} tool narratives`);
            } catch (e) {
              logError('chat/saveMessage', e, { conversationId });
            }
          }

          // Send done signal
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        } catch (error) {
          const appError = classifyError(error);
          logError('chat/stream', error, { modelId, conversationId });

          // Error narrative is already handled by ChatService
          // Just emit the error event for UI
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                error: appError.userMessage,
                code: appError.code,
                isRetryable: appError.isRetryable,
              })}\n\n`
            )
          );
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    logError('chat/POST', error);
    const errorResponse = formatErrorResponse(error);
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
