# Multi-Agent System Guide

## Overview

Your Mastra app now includes a sophisticated multi-agent system that provides Claude-like intelligent data exploration and visualization capabilities.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface (Chat)                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Multi-Agent Orchestrator                        │
│  • Coordinates all agents                                    │
│  • Manages workflow and data flow                            │
│  • Provides automatic analysis and visualization             │
└─┬───────────────────┬───────────────────┬───────────────────┘
  │                   │                   │
  ▼                   ▼                   ▼
┌─────────────┐ ┌──────────────┐ ┌────────────────────┐
│  Database   │ │   Analysis   │ │   Visualization    │
│   Agent     │ │    Agent     │ │      Agent         │
│             │ │              │ │                    │
│ • Connects  │ │ • Analyzes   │ │ • Generates charts │
│ • Queries   │ │ • Insights   │ │ • Creates tables   │
│ • Manages   │ │ • Statistics │ │ • Builds HTML      │
│   SQL       │ │ • Patterns   │ │   dashboards       │
└─────────────┘ └──────────────┘ └────────────────────┘
```

## Agents

### 1. Database Agent
**Purpose**: Handles all database operations

**Capabilities**:
- Connect to Oracle databases via SQLcl MCP
- Execute SQL queries
- Manage database connections
- Handle schema operations

**Tools**:
- `sqlcl_list_connections` - List available connections
- `sqlcl_connect` - Connect to a database
- `sqlcl_run_sql` - Execute SQL queries
- `sqlcl_run_sqlcl` - Execute SQLcl commands
- `sqlcl_schema_information` - Get schema info
- `sqlcl_disconnect` - Disconnect from database

### 2. Data Analysis Agent
**Purpose**: Analyzes query results and provides insights

**Capabilities**:
- Calculate statistics (count, sum, average, min, max)
- Identify patterns and trends
- Detect anomalies and outliers
- Generate actionable insights
- Suggest follow-up queries

**Output**:
```typescript
{
  summary: "Dataset contains 5 rows and 4 columns",
  statistics: {
    rowCount: 5,
    columnCount: 4,
    columnStats: { ... }
  },
  insights: [
    "TOTAL_AMOUNT shows high variability (range: 50.25 to 300.5)",
    "CUSTOMER_ID could be used for grouping (3 unique values)"
  ],
  recommendations: [
    "Consider aggregating TOTAL_AMOUNT by categories",
    "Analyze trends over time using ORDER_DATE"
  ],
  suggestedVisualizations: [
    "Bar chart: TOTAL_AMOUNT by CUSTOMER_ID",
    "Line chart: TOTAL_AMOUNT trend over ORDER_DATE"
  ]
}
```

### 3. Visualization Agent
**Purpose**: Creates charts, tables, and interactive dashboards

**Capabilities**:
- Auto-detect appropriate visualization types
- Generate bar, line, pie, and scatter charts
- Create formatted data tables
- Build interactive HTML dashboards with filtering

**Visualization Types**:
- **Bar Chart**: Categorical comparisons
- **Line Chart**: Trends over time
- **Pie Chart**: Proportions and percentages
- **Scatter Plot**: Correlations
- **Table**: Detailed data display
- **Interactive HTML**: Complex filtering and exploration

### 4. Multi-Agent Orchestrator
**Purpose**: Coordinates all agents for seamless workflows

**Key Features**:
- Automatic connection management
- Intelligent query execution
- Automatic data analysis
- Automatic visualization generation
- Multi-step workflow coordination

## Usage Examples

### Basic Query with Auto-Analysis

```typescript
import { DatabaseOrchestrator } from './mastra/agents';

const orchestrator = new DatabaseOrchestrator(conversationId, modelId);

// Execute query - automatically analyzes and visualizes results
const result = await orchestrator.executeTool('run-sql', {
  sql: 'SELECT customer_id, COUNT(*) as order_count FROM orders GROUP BY customer_id'
});

// Result includes:
// - result.success: boolean
// - result.result: raw query data
// - result.analysis: insights and statistics
// - result.visualization: auto-generated chart
```

### Smart Query (Full Intelligence)

```typescript
const result = await orchestrator.smartQuery(
  'SELECT * FROM orders WHERE order_date > SYSDATE - 30',
  'Show recent orders'
);

// Returns:
// - data: parsed data array
// - analysis: comprehensive insights
// - visualizations: [table, chart, interactive HTML]
```

### Interactive Dashboard Generation

```typescript
const dashboard = await orchestrator.generateInteractiveDashboard(
  'SELECT * FROM orders',
  'Orders Dashboard'
);

// Creates a beautiful, interactive HTML dashboard with:
// - Search across all columns
// - Filter dropdowns for each column
// - Sortable table
// - Statistics cards
// - Responsive design
```

### Manual Analysis and Visualization

```typescript
import { analyzeData, generateVisualization } from './mastra/agents';

// Analyze data
const analysis = analyzeData({
  data: queryResults,
  query: 'SELECT * FROM orders',
});

console.log(analysis.insights);
console.log(analysis.recommendations);

// Generate specific visualization
const chart = await generateVisualization({
  data: queryResults,
  type: 'bar',
  title: 'Orders by Customer',
});

// Or auto-detect best visualization
const autoViz = await generateVisualization({
  data: queryResults,
  type: 'auto', // Automatically chooses best type
});
```

## Claude-like Behavior

The system now behaves like Claude's database assistant:

### Example Interaction 1: Data Query

**User**: "Show me the orders table data"

**System**:
1. Database Agent connects and queries: `SELECT * FROM orders`
2. Analysis Agent analyzes the data
3. Visualization Agent creates table + chart
4. Response includes:
   - Raw data
   - Insights: "5 orders totaling $776.50, Customer 101 is top customer"
   - Bar chart of orders by customer
   - Interactive HTML dashboard

### Example Interaction 2: Visualization Request

**User**: "Can you show this as a chart with filters?"

**System**:
1. Database Agent retrieves the data
2. Visualization Agent creates interactive HTML
3. Response includes:
   - Beautiful dashboard with search
   - Filter dropdowns for each column
   - Sortable table
   - Statistics cards

### Example Interaction 3: Complex Analysis

**User**: "Analyze sales trends and show me insights"

**System**:
1. Database Agent queries sales data
2. Analysis Agent calculates:
   - Total sales, average, trends
   - Top products/customers
   - Growth rates
3. Visualization Agent creates:
   - Line chart for trends
   - Bar chart for comparisons
   - Interactive dashboard
4. Response includes comprehensive insights and recommendations

## Configuration

### Enable Multi-Agent Features

The multi-agent system is automatically enabled. To customize:

```typescript
// In your chat route or agent handler
const orchestrator = new DatabaseOrchestrator(conversationId, modelId);

// Execute with custom options
const result = await orchestrator.executeTool('run-sql', {
  sql: 'SELECT * FROM orders'
}, {
  autoAnalyze: true,      // Enable automatic analysis (default: true)
  autoVisualize: true,    // Enable automatic visualization (default: true)
  visualizationType: 'bar' // Force specific visualization type
});
```

### Agent Instructions

Each agent has specialized instructions that guide its behavior:

- `DATABASE_AGENT_INSTRUCTIONS` - Database operations and SQL
- `DATA_ANALYSIS_AGENT_INSTRUCTIONS` - Data analysis and insights
- `VISUALIZATION_AGENT_INSTRUCTIONS` - Chart and dashboard generation

These are automatically used by the orchestrator.

## Best Practices

### 1. Let the System Work Automatically

```typescript
// ✅ Good - Let orchestrator handle everything
const result = await orchestrator.smartQuery(sql);

// ❌ Avoid - Manual coordination is unnecessary
const queryResult = await executeTool('run-sql', { sql });
const analysis = analyzeData(extractData(queryResult));
const viz = await generateVisualization({ data: analysis });
```

### 2. Use Smart Query for User Requests

```typescript
// When user asks for data exploration
const result = await orchestrator.smartQuery(
  userQuery,
  userIntent // Optional context
);

// Returns everything: data, analysis, visualizations
```

### 3. Generate Interactive Dashboards for Complex Data

```typescript
// For datasets with many rows/columns
if (data.length > 10 || columns.length > 5) {
  const dashboard = await orchestrator.generateInteractiveDashboard(
    sql,
    'Data Explorer'
  );
  // Returns beautiful HTML with filters and sorting
}
```

### 4. Provide Context to Analysis

```typescript
const analysis = analyzeData({
  data: results,
  query: originalSQL,
  context: 'User wants to find top customers'
});
// Better insights with context
```

## Output Formats

### Analysis Output

```json
{
  "summary": "Dataset contains 5 rows and 4 columns",
  "statistics": {
    "rowCount": 5,
    "columnStats": {
      "TOTAL_AMOUNT": {
        "type": "numeric",
        "avg": 155.3,
        "min": 50.25,
        "max": 300.5
      }
    }
  },
  "insights": ["High variability in order amounts"],
  "recommendations": ["Segment customers by order value"],
  "suggestedVisualizations": ["Bar chart: Orders by customer"]
}
```

### Visualization Output

```json
{
  "type": "bar_chart",
  "content": "{\"type\":\"bar_chart\",\"title\":\"Orders by Customer\",\"data\":[...]}",
  "metadata": {
    "columns": ["customer_id", "order_count"],
    "rowCount": 3
  }
}
```

### Interactive HTML Dashboard

The system generates a complete HTML file with:
- Modern, responsive design
- Search functionality
- Column-specific filters
- Sortable table
- Statistics cards
- Beautiful gradient styling

## Integration with Chat UI

The chat UI automatically renders:
- Analysis insights as formatted text
- Charts as visual components
- Tables as formatted grids
- HTML dashboards as embedded iframes or downloadable files

## Troubleshooting

### Issue: No visualizations generated

**Solution**: Ensure `autoVisualize: true` in options:
```typescript
const result = await orchestrator.executeTool('run-sql', { sql }, {
  autoVisualize: true
});
```

### Issue: Analysis not showing

**Solution**: Check that query returns data:
```typescript
if (result.success && result.analysis) {
  console.log(result.analysis.insights);
}
```

### Issue: Interactive HTML not rendering

**Solution**: Save HTML to file or render in iframe:
```typescript
if (result.visualization?.type === 'html') {
  // Save to file
  fs.writeFileSync('dashboard.html', result.visualization.content);
  // Or render in iframe
  <iframe srcDoc={result.visualization.content} />
}
```

## Next Steps

1. **Test the System**: Try querying your database and see automatic analysis/visualization
2. **Customize Agents**: Modify agent instructions for your specific use case
3. **Add More Visualizations**: Extend the visualization agent with new chart types
4. **Enhance Analysis**: Add domain-specific insights to the analysis agent
5. **Build Workflows**: Create multi-step workflows using the orchestrator

## Summary

Your system now provides:
- ✅ Claude-like intelligent data exploration
- ✅ Automatic analysis and insights
- ✅ Automatic visualization generation
- ✅ Interactive HTML dashboards
- ✅ Multi-agent coordination
- ✅ Seamless user experience

The multi-agent system handles all the complexity automatically, letting you focus on building great user experiences!
