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
import { conversationalNarrator } from '@/services/conversational-narrator';

const config = loadConfig();

// Create conversation store if Oracle is configured
let conversationStore: ConversationStore | null = null;
if (isOracleConfigured(config)) {
  conversationStore = new ConversationStore(config.oracle);
}

interface ChatRequestBody {
  messages: Message[];
  modelId: string;
  conversationId?: string;
}

/**
 * Extract data from SQL tool result (CSV format).
 */
function extractDataFromToolResult(result: unknown): Record<string, unknown>[] | null {
  if (!result || typeof result !== 'object') return null;
  const resultObj = result as { content?: Array<{ text?: string }> };
  if (!resultObj.content?.[0]?.text) return null;

  try {
    const text = resultObj.content[0].text;
    const lines = text.trim().split('\n');
    if (lines.length < 2) return null;

    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.replace(/"/g, '').trim());
      const row: Record<string, unknown> = {};
      headers.forEach((header, i) => {
        const value = values[i];
        const numValue = parseFloat(value);
        row[header] = isNaN(numValue) ? value : numValue;
      });
      return row;
    });
  } catch {
    return null;
  }
}

/**
 * Convert Message array to ChatMessage array for OCI provider.
 * Filters out messages with empty content to avoid API errors.
 * Adds instruction prefix to guide database interaction workflow.
 */
function toChatMessages(messages: Message[]): ChatMessage[] {
  const filtered = messages
    .filter((m) => m.role === 'user' || m.role === 'system' || m.role === 'tool' || (m.role === 'assistant' && (m.content?.trim() || m.toolCalls?.length)));
  
  // Find the last user message and add instruction prefix
  const result: ChatMessage[] = [];
  let foundLastUser = false;
  
  // Process in reverse to find last user message
  for (let i = filtered.length - 1; i >= 0; i--) {
    const m = filtered[i];
    if (m.role === 'user' && !foundLastUser) {
      foundLastUser = true;
      // Add instruction prefix for database workflow
      const prefix = `[IMPORTANT DATABASE WORKFLOW:
1. FIRST: List available databases using sqlcl_list_connections
2. THEN: Show the list to the user and ask which database they want to use
3. ONLY connect when user specifies the database name
4. Do NOT automatically connect to any database without user confirmation

Exception: If the user explicitly mentions a database name in their query, you can connect directly to that database.]\n\n`;
      result.unshift({
        role: m.role,
        content: prefix + (m.content || ''),
        toolCalls: m.toolCalls,
        toolCallId: m.toolCallId,
      });
    } else {
      result.unshift({
        role: m.role,
        content: m.content || '',
        toolCalls: m.toolCalls,
        toolCallId: m.toolCallId,
      });
    }
  }
  
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequestBody = await request.json();
    const { messages, modelId, conversationId } = body;

    console.log(`[chat/POST] Received request: ${messages?.length} messages, model: ${modelId}, conversationId: ${conversationId}`);

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

    // Check if user is requesting a visualization
    const isVisualizationRequest = userIntent.visualizationType &&
      userIntent.visualizationType !== 'custom';

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
    const systemInstructions = DATABASE_AGENT_INSTRUCTIONS;

    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = '';
        const allToolCalls: ToolCall[] = [];
        const allToolResults: Array<{ toolCallId: string; result: unknown }> = [];
        let lastToolCall: ToolCall | null = null;
        let lastToolResult: unknown = null;
        
        // Collect tool narratives and adaptation narratives for saving
        const toolNarratives: Array<{ toolCallId: string; toolName: string; phase: 'start' | 'result' | 'error'; narrative: string; timestamp: Date }> = [];
        const adaptationNarratives: string[] = [];
        
        // Progress tracking for multi-step operations
        let currentStepNumber = 0;
        let totalSteps = 0;
        let operationStarted = false;

        // Send initial ping to verify stream is working
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ ping: true })}\n\n`));
        console.log('[chat/POST] Sent initial ping');

        // Check if there's recent data in conversation that we can visualize
        // Look for CSV-like data in previous assistant messages
        let existingData: Record<string, unknown>[] | null = null;
        for (const msg of messages) {
          if (msg.role === 'assistant' && msg.content) {
            // Look for CSV data patterns in the content
            const csvMatch = msg.content.match(/"[^"]+",.*\n(?:[^"]*,.*\n?)+/);
            if (csvMatch) {
              const data = extractDataFromToolResult({ content: [{ text: csvMatch[0] }] });
              if (data && data.length > 0) {
                existingData = data;
              }
            }
          }
        }

        // If user wants visualization and we have existing data, generate it directly
        if (isVisualizationRequest && existingData && userIntent.visualizationType) {
          let vizType: 'bar' | 'line' | 'pie' | 'html' = 'html';
          let vizTitle = 'Data Visualization';

          switch (userIntent.visualizationType) {
            case 'bar': vizType = 'bar'; vizTitle = 'Bar Chart'; break;
            case 'line': vizType = 'line'; vizTitle = 'Line Chart'; break;
            case 'pie': vizType = 'pie'; vizTitle = 'Pie Chart'; break;
            case 'dashboard': vizType = 'html'; vizTitle = 'Interactive Dashboard'; break;
          }

          try {
            const viz = await generateVisualization({
              data: existingData,
              type: vizType,
              title: vizTitle,
            });

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: `Here's your ${vizTitle}:` })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              visualization: {
                type: viz.type,
                html: viz.content,
                title: vizTitle,
              }
            })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
            controller.close();
            return;
          } catch (vizError) {
            console.error('[chat/POST] Direct visualization error:', vizError);
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

          // Use the model adapter with agentic streaming
          const streamOptions = hasTools
            ? {
              toolsets: { sqlcl: mcpTools },
              maxSteps: 15, // Increased for deep autonomous analysis (connect, explore, multiple queries, analyze)
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

          console.log(`[chat/POST] Starting stream with ${chatMessages.length} messages, hasTools: ${hasTools}`);

          for await (const chunk of modelAdapter.stream(chatMessages, streamOptions)) {
            console.log(`[chat/POST] Stream chunk type: ${chunk.type}, textDelta: ${chunk.textDelta?.slice(0, 50)}`);
            switch (chunk.type) {
              case 'text-delta':
                if (chunk.textDelta) {
                  fullResponse += chunk.textDelta;
                  const data = JSON.stringify({ content: chunk.textDelta });
                  console.log(`[chat/POST] Sending text chunk: ${data.slice(0, 100)}`);
                  controller.enqueue(
                    encoder.encode(`data: ${data}\n\n`)
                  );
                }
                break;

              case 'tool-call':
                if (chunk.toolCall) {
                  // Initialize progress tracking on first tool call
                  if (!operationStarted) {
                    operationStarted = true;
                    // Estimate total steps based on maxSteps (conservative estimate)
                    // We'll update this as we go
                    totalSteps = 0; // Will be determined dynamically
                  }
                  
                  // Increment step counter
                  currentStepNumber++;
                  
                  // Detect adaptation: if we have a previous tool result, this new tool is informed by it
                  if (lastToolCall && lastToolResult !== null) {
                    // Generate adaptation narrative explaining the connection
                    const adaptationNarrative = conversationalNarrator.narrateAdaptation({
                      previousAction: lastToolCall.name,
                      previousResult: lastToolResult,
                      nextAction: chunk.toolCall.name,
                      reason: 'follow', // Default reason - could be enhanced with more context
                    });
                    
                    // Collect adaptation narrative for saving
                    adaptationNarratives.push(adaptationNarrative);
                    
                    // Stream the adaptation narrative as conversational content
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ content: adaptationNarrative + '\n\n' })}\n\n`
                      )
                    );
                    
                    console.log(`[chat/POST] Generated adaptation narrative: ${lastToolCall.name} -> ${chunk.toolCall.name}`);
                  }
                  
                  allToolCalls.push(chunk.toolCall);
                  lastToolCall = chunk.toolCall;
                  
                  // Generate conversational explanation for tool execution start
                  const toolStartNarrative = conversationalNarrator.narrateToolStart(
                    chunk.toolCall.name,
                    chunk.toolCall.arguments || {}
                  );
                  
                  // Collect tool start narrative for saving
                  toolNarratives.push({
                    toolCallId: chunk.toolCall.id,
                    toolName: chunk.toolCall.name,
                    phase: 'start',
                    narrative: toolStartNarrative,
                    timestamp: new Date(),
                  });
                  
                  // Generate progress message if we're in a multi-step operation
                  // We consider it multi-step if we have more than one tool call
                  if (currentStepNumber > 1 || allToolCalls.length > 0) {
                    // Update total steps estimate (current + 1 for potential next step)
                    totalSteps = Math.max(totalSteps, currentStepNumber + 1);
                    
                    const progressMessage = conversationalNarrator.narrateProgress(
                      currentStepNumber,
                      totalSteps,
                      toolStartNarrative
                    );
                    
                    // Stream progress message
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ 
                          progress: progressMessage + '\n\n',
                          step: { current: currentStepNumber, total: totalSteps }
                        })}\n\n`
                      )
                    );
                  } else {
                    // For single-step operations, just stream the narrative
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ content: toolStartNarrative + '\n\n' })}\n\n`
                      )
                    );
                  }
                  
                  // Also send as thinking message for UI compatibility
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ thinking: toolStartNarrative })}\n\n`
                    )
                  );
                  
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        toolCall: {
                          id: chunk.toolCall.id,
                          name: chunk.toolCall.name,
                          arguments: chunk.toolCall.arguments,
                        },
                      })}\n\n`
                    )
                  );
                }
                break;

              case 'tool-result':
                if (chunk.toolResult) {
                  allToolResults.push(chunk.toolResult);
                  lastToolResult = chunk.toolResult.result;

                  // Get the corresponding tool call
                  const toolResultId = chunk.toolResult.toolCallId;
                  const correspondingToolCall = allToolCalls.find(
                    tc => tc.id === toolResultId
                  );
                  
                  // Generate conversational explanation for tool result
                  if (correspondingToolCall) {
                    const toolResultNarrative = conversationalNarrator.narrateToolResult(
                      correspondingToolCall.name,
                      chunk.toolResult.result
                    );
                    
                    // Collect tool result narrative for saving
                    toolNarratives.push({
                      toolCallId: chunk.toolResult.toolCallId,
                      toolName: correspondingToolCall.name,
                      phase: 'result',
                      narrative: toolResultNarrative,
                      timestamp: new Date(),
                    });
                    
                    // Stream the conversational explanation as content
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ content: toolResultNarrative + '\n\n' })}\n\n`
                      )
                    );
                    
                    // Also send as progress message for UI compatibility
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ progress: toolResultNarrative })}\n\n`
                      )
                    );
                  }

                  // Check if this is a list_connections result - if so, we need to stop and ask user
                  const currentToolCall = allToolCalls[allToolCalls.length - 1];
                  if (currentToolCall?.name?.includes('list') && currentToolCall?.name?.includes('connection')) {
                    listedConnections = true;
                    console.log('[chat/POST] Detected list_connections - will prompt user to select database');
                  }

                  // Truncate large results for display
                  let resultJson = JSON.stringify(chunk.toolResult.result, null, 2);
                  if (resultJson.length > 5000) {
                    resultJson = resultJson.slice(0, 5000) + '\n... (truncated)';
                  }

                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        toolResult: {
                          toolCallId: chunk.toolResult.toolCallId,
                          result: chunk.toolResult.result,
                        },
                      })}\n\n`
                    )
                  );

                  // AUTONOMOUS MODE: Don't stop after listing connections
                  // The agent will auto-connect to the first/only database
                  // Only inform user if multiple databases are available
                  if (listedConnections) {
                    const resultObj = chunk.toolResult.result as { content?: Array<{ text?: string }> };
                    const connectionText = resultObj?.content?.[0]?.text || '';
                    const connectionLines = connectionText.split('\n').filter((l: string) => l.trim());
                    
                    // If multiple connections, let agent decide or inform user
                    if (connectionLines.length > 2) {
                      console.log('[chat/POST] Multiple connections available, agent will choose');
                    }
                    // Don't force stop - let agent continue autonomously
                  }

                  // Auto-generate visualization for SQL results
                  const data = extractDataFromToolResult(chunk.toolResult.result);
                  if (data && data.length > 0) {
                    lastQueryData = data; // Store for potential visualization request
                    try {
                      // Generate analysis only - let user request specific visualization
                      const analysis = analyzeData({ data, query: 'SQL query' });
                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({ analysis })}\n\n`
                        )
                      );

                      // Only generate visualization if user explicitly requested it
                      // Check if user asked for visualization, chart, graph, dashboard, etc.
                      const isVisualizationRequested = userIntent.visualizationType || 
                        lastUserMessageOriginal.toLowerCase().match(/\b(visuali[sz]e|chart|graph|plot|dashboard|show.*visual|create.*visual)\b/);
                      
                      if (isVisualizationRequested) {
                        let vizType: 'auto' | 'bar' | 'line' | 'pie' | 'html' | 'map' | 'timeline' | 'photo_gallery' = 'auto';
                        let vizTitle = 'Data Visualization';

                        if (userIntent.visualizationType) {
                          switch (userIntent.visualizationType) {
                            case 'bar': vizType = 'bar'; vizTitle = 'Bar Chart'; break;
                            case 'line': vizType = 'line'; vizTitle = 'Line Chart'; break;
                            case 'pie': vizType = 'pie'; vizTitle = 'Pie Chart'; break;
                            case 'map': vizType = 'map'; vizTitle = 'Map'; break;
                            case 'timeline': vizType = 'timeline'; vizTitle = 'Timeline'; break;
                            case 'dashboard':
                            case 'table':
                              vizType = 'html';
                              vizTitle = 'Interactive Dashboard';
                              break;
                          }
                        }

                        // Extract title from user message if provided
                        const titleMatch = lastUserMessageOriginal.match(/(?:titled?|called?|named?)\s+["']?([^"']+)["']?/i);
                        if (titleMatch) {
                          vizTitle = titleMatch[1];
                        }

                        // Generate visualization
                        const viz = await generateVisualization({
                          data,
                          type: vizType,
                          title: vizTitle,
                        });
                        controller.enqueue(
                          encoder.encode(
                            `data: ${JSON.stringify({
                              visualization: {
                                type: viz.type,
                                html: viz.content,
                                title: vizTitle,
                              }
                            })}\n\n`
                          )
                        );
                        console.log(`[chat/POST] Generated ${viz.type} visualization as requested`);
                      } else {
                        console.log(`[chat/POST] Data retrieved but no visualization requested`);
                      }
                    } catch (vizError) {
                      console.error('[chat/POST] Analysis error:', vizError);
                    }
                  }
                }
                break;

              case 'finish':
                // If this was a multi-step operation, send completion summary
                if (currentStepNumber > 1) {
                  // Finalize total steps to actual count
                  totalSteps = currentStepNumber;
                  
                  const completionMessage = conversationalNarrator.narrateCompletion(
                    totalSteps,
                    `I've processed your request through ${totalSteps} steps.`
                  );
                  
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ 
                        progress: completionMessage + '\n\n',
                        step: { current: totalSteps, total: totalSteps }
                      })}\n\n`
                    )
                  );
                }
                
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ finishReason: chunk.finishReason })}\n\n`
                  )
                );
                break;

              case 'error':
                // Generate conversational error explanation
                const errorValue: unknown = chunk.error ?? 'Unknown error';
                const errorObj = errorValue instanceof Error 
                  ? errorValue 
                  : new Error(String(errorValue));
                const currentToolCall = allToolCalls[allToolCalls.length - 1];
                
                if (currentToolCall) {
                  const errorNarrative = conversationalNarrator.narrateToolError(
                    currentToolCall.name,
                    errorObj
                  );
                  
                  // Collect tool error narrative for saving
                  toolNarratives.push({
                    toolCallId: currentToolCall.id,
                    toolName: currentToolCall.name,
                    phase: 'error',
                    narrative: errorNarrative,
                    timestamp: new Date(),
                  });
                  
                  // Stream the conversational error explanation as content
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ content: errorNarrative + '\n\n' })}\n\n`
                    )
                  );
                }
                
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      error: chunk.error,
                      isRetryable: true,
                    })}\n\n`
                  )
                );
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
                adaptationNarratives: adaptationNarratives.length > 0 ? adaptationNarratives : undefined,
              });
              console.log(`[chat] Saved assistant message to conversation ${conversationId} with ${toolNarratives.length} tool narratives and ${adaptationNarratives.length} adaptation narratives`);
            } catch (e) {
              logError('chat/saveMessage', e, { conversationId });
            }
          }

          // Send done signal
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        } catch (error) {
          const appError = classifyError(error);
          logError('chat/stream', error, { modelId, conversationId });

          // Generate conversational error explanation
          const errorObj = error instanceof Error ? error : new Error(String(error));
          const currentToolCall = allToolCalls[allToolCalls.length - 1];
          
          if (currentToolCall) {
            const errorNarrative = conversationalNarrator.narrateToolError(
              currentToolCall.name,
              errorObj
            );
            
            // Stream the conversational error explanation as content
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ content: errorNarrative + '\n\n' })}\n\n`
              )
            );
          } else {
            // Generic error narrative when no tool call is involved
            const genericErrorNarrative = `I encountered an issue while processing your request. ${appError.isRetryable ? "Let me try a different approach." : "Please try again or rephrase your request."}`;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ content: genericErrorNarrative + '\n\n' })}\n\n`
              )
            );
          }

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
