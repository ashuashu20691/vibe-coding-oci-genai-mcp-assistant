# Multi-Agent System Usage Example

## Quick Start

Here's how to use the multi-agent system in your chat application:

### 1. Basic Setup

```typescript
import { DatabaseOrchestrator } from '@/mastra/agents';

// In your chat route handler
export async function POST(req: Request) {
  const { message, conversationId, modelId } = await req.json();
  
  // Create orchestrator instance
  const orchestrator = new DatabaseOrchestrator(conversationId, modelId);
  
  // ... rest of your handler
}
```

### 2. Execute SQL with Auto-Analysis

```typescript
// User asks: "Show me all orders"

// The orchestrator automatically:
// 1. Connects to database (if needed)
// 2. Executes the query
// 3. Analyzes the results
// 4. Generates visualizations

const result = await orchestrator.executeTool('run-sql', {
  sql: 'SELECT * FROM orders'
});

if (result.success) {
  // result.result - Raw query data
  // result.analysis - Insights and statistics
  // result.visualization - Auto-generated chart
  
  console.log('Insights:', result.analysis?.insights);
  console.log('Recommendations:', result.analysis?.recommendations);
  console.log('Visualization type:', result.visualization?.type);
}
```

### 3. Smart Query (Recommended)

```typescript
// User asks: "Analyze sales by customer"

const result = await orchestrator.smartQuery(
  `SELECT customer_id, 
          COUNT(*) as order_count,
          SUM(total_amount) as total_revenue
   FROM orders 
   GROUP BY customer_id`,
  'Analyze sales by customer' // Optional context
);

if (result.success) {
  // result.data - Parsed data array
  // result.analysis - Comprehensive insights
  // result.visualizations - Multiple visualization options
  
  // Send to user
  return {
    data: result.data,
    insights: result.analysis?.insights,
    charts: result.visualizations
  };
}
```

### 4. Interactive Dashboard

```typescript
// User asks: "Create an interactive dashboard for orders"

const dashboard = await orchestrator.generateInteractiveDashboard(
  'SELECT * FROM orders',
  'Orders Dashboard'
);

if (dashboard.success && dashboard.visualization) {
  // Save HTML to file or send to client
  const html = dashboard.visualization.content;
  
  // Option 1: Save to public folder
  fs.writeFileSync('public/dashboard.html', html);
  
  // Option 2: Send as response
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
  
  // Option 3: Embed in chat (send HTML string to client)
  return { type: 'html', content: html };
}
```

### 5. Custom Visualization

```typescript
import { generateVisualization } from '@/mastra/agents';

// After getting query results
const data = [
  { customer_id: 101, order_count: 5, total: 500 },
  { customer_id: 102, order_count: 3, total: 300 },
];

// Generate specific chart type
const barChart = await generateVisualization({
  data,
  type: 'bar',
  title: 'Orders by Customer'
});

// Or let it auto-detect
const autoChart = await generateVisualization({
  data,
  type: 'auto'
});
```

### 6. Manual Analysis

```typescript
import { analyzeData } from '@/mastra/agents';

const analysis = analyzeData({
  data: queryResults,
  query: 'SELECT * FROM orders',
  context: 'User wants to find patterns'
});

console.log('Summary:', analysis.summary);
console.log('Statistics:', analysis.statistics);
console.log('Insights:', analysis.insights);
console.log('Recommendations:', analysis.recommendations);
console.log('Suggested visualizations:', analysis.suggestedVisualizations);
```

## Complete Chat Route Example

```typescript
// app/api/chat/route.ts
import { DatabaseOrchestrator } from '@/mastra/agents';
import { ociProvider } from '@/mastra';

export async function POST(req: Request) {
  try {
    const { message, conversationId, modelId } = await req.json();
    
    // Create orchestrator
    const orchestrator = new DatabaseOrchestrator(conversationId, modelId);
    
    // Check if message is a database query request
    const isDatabaseQuery = message.toLowerCase().includes('select') ||
                           message.toLowerCase().includes('show') ||
                           message.toLowerCase().includes('query');
    
    if (isDatabaseQuery) {
      // Use smart query for automatic analysis and visualization
      const result = await orchestrator.smartQuery(
        extractSQL(message), // Your SQL extraction logic
        message
      );
      
      if (result.success) {
        // Return rich response with data, analysis, and visualizations
        return Response.json({
          success: true,
          data: result.data,
          analysis: {
            summary: result.analysis?.summary,
            insights: result.analysis?.insights,
            recommendations: result.analysis?.recommendations,
          },
          visualizations: result.visualizations?.map(viz => ({
            type: viz.type,
            content: viz.content,
          })),
        });
      }
    }
    
    // For non-database queries, use regular chat
    const stream = await ociProvider.chatCompletion({
      messages: [{ role: 'user', content: message }],
      modelId,
      stream: true,
    });
    
    // Stream response
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream' },
    });
    
  } catch (error) {
    console.error('Chat error:', error);
    return Response.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

function extractSQL(message: string): string {
  // Your logic to extract SQL from natural language
  // Or use the LLM to generate SQL
  return message;
}
```

## Response Format

The multi-agent system returns rich responses:

```typescript
{
  success: true,
  data: [
    { customer_id: 101, order_count: 5, total_revenue: 500 },
    { customer_id: 102, order_count: 3, total_revenue: 300 }
  ],
  analysis: {
    summary: "Dataset contains 2 rows and 3 columns",
    statistics: {
      rowCount: 2,
      columnStats: { ... }
    },
    insights: [
      "Customer 101 has the highest order count (5 orders)",
      "Total revenue across all customers: $800"
    ],
    recommendations: [
      "Consider targeting Customer 102 for repeat business",
      "Analyze order frequency patterns"
    ],
    suggestedVisualizations: [
      "Bar chart: order_count by customer_id",
      "Pie chart: Revenue distribution"
    ]
  },
  visualizations: [
    {
      type: "table",
      content: "{ ... JSON table data ... }"
    },
    {
      type: "bar_chart",
      content: "{ ... JSON chart data ... }"
    },
    {
      type: "html",
      content: "<!DOCTYPE html>... interactive dashboard ..."
    }
  ]
}
```

## Client-Side Rendering

In your React component:

```typescript
'use client';

import { useState } from 'react';

export function ChatInterface() {
  const [response, setResponse] = useState(null);
  
  const handleQuery = async (message: string) => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message, conversationId, modelId }),
    });
    
    const data = await res.json();
    setResponse(data);
  };
  
  return (
    <div>
      {/* Show insights */}
      {response?.analysis?.insights?.map((insight, i) => (
        <div key={i} className="insight">{insight}</div>
      ))}
      
      {/* Show visualizations */}
      {response?.visualizations?.map((viz, i) => (
        <div key={i}>
          {viz.type === 'html' ? (
            <iframe srcDoc={viz.content} />
          ) : viz.type === 'bar_chart' ? (
            <BarChart data={JSON.parse(viz.content)} />
          ) : (
            <DataTable data={JSON.parse(viz.content)} />
          )}
        </div>
      ))}
    </div>
  );
}
```

## Tips

1. **Always use `smartQuery` for user requests** - It handles everything automatically
2. **Check `result.success`** before accessing data
3. **Use interactive dashboards for large datasets** (>10 rows)
4. **Provide context** to get better insights
5. **Cache visualizations** to avoid regenerating them

## Next Steps

- Integrate with your existing chat UI
- Add custom visualization types
- Enhance analysis with domain-specific logic
- Build multi-step workflows
- Add caching for performance

Happy coding! 🚀
