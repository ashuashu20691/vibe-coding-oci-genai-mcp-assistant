// src/mastra/agents/data-analysis-agent.ts
/**
 * Data Analysis Agent - Analyzes query results and provides insights.
 */

export const DATA_ANALYSIS_AGENT_INSTRUCTIONS = `You are a data analyst. Given a dataset, produce a concise, accurate analysis.

<behavior>
Work directly with the data provided. Do not ask for more data or suggest running additional queries — analyze what you have.

Prioritize findings that are actionable or surprising. Skip obvious observations.
</behavior>

<output_structure>
Respond with:
1. A one-sentence summary of what the data shows
2. Two to four specific findings (numbers, percentages, named entities where relevant)
3. One or two recommendations based on the findings

Keep the total response under 150 words. Use plain language — no jargon, no filler phrases.
</output_structure>

<analysis_approach>
For numeric columns: identify the range, average, and any outliers worth noting.
For categorical columns: identify the dominant category and any notable minorities.
For time-based data: identify the trend direction and any inflection points.
For grouped data: identify the top and bottom performers and the gap between them.
</analysis_approach>`;

export interface AnalysisRequest {
  data: unknown[];
  query?: string;
  context?: string;
}

export interface AnalysisResult {
  summary: string;
  statistics: Record<string, unknown>;
  insights: string[];
  recommendations: string[];
  suggestedVisualizations: string[];
}

/**
 * Analyze data and generate insights.
 */
export function analyzeData(request: AnalysisRequest): AnalysisResult {
  const { data, query, context } = request;

  if (!Array.isArray(data) || data.length === 0) {
    return {
      summary: 'No data available for analysis',
      statistics: {},
      insights: [],
      recommendations: ['Run a query to retrieve data'],
      suggestedVisualizations: [],
    };
  }

  const statistics = calculateStatistics(data);
  const insights = generateInsights(data, statistics);
  const recommendations = generateRecommendations(data, statistics, query);
  const suggestedVisualizations = suggestVisualizations(data, statistics);

  const summary = generateSummary(data, statistics);

  return {
    summary,
    statistics,
    insights,
    recommendations,
    suggestedVisualizations,
  };
}

/**
 * Calculate basic statistics from data.
 */
function calculateStatistics(data: unknown[]): Record<string, unknown> {
  const stats: Record<string, unknown> = {
    rowCount: data.length,
  };

  if (data.length === 0) return stats;

  const firstRow = data[0];
  if (typeof firstRow !== 'object' || firstRow === null) return stats;

  const columns = Object.keys(firstRow);
  stats.columnCount = columns.length;
  stats.columns = columns;

  // Analyze each column
  const columnStats: Record<string, unknown> = {};
  
  columns.forEach(col => {
    const values = data.map(row => (row as Record<string, unknown>)[col]);
    const numericValues = values.filter(v => typeof v === 'number') as number[];
    
    if (numericValues.length > 0) {
      columnStats[col] = {
        type: 'numeric',
        count: numericValues.length,
        sum: numericValues.reduce((a, b) => a + b, 0),
        avg: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
        min: Math.min(...numericValues),
        max: Math.max(...numericValues),
      };
    } else {
      const uniqueValues = [...new Set(values)];
      columnStats[col] = {
        type: 'categorical',
        uniqueCount: uniqueValues.length,
        topValues: getTopValues(values, 5),
      };
    }
  });

  stats.columnStats = columnStats;
  return stats;
}

/**
 * Get top N most frequent values.
 */
function getTopValues(values: unknown[], n: number): Array<{ value: unknown; count: number }> {
  const counts = new Map<unknown, number>();
  
  values.forEach(v => {
    counts.set(v, (counts.get(v) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

/**
 * Generate insights from data and statistics.
 */
function generateInsights(data: unknown[], statistics: Record<string, unknown>): string[] {
  const insights: string[] = [];
  const columnStats = statistics.columnStats as Record<string, unknown> | undefined;

  if (!columnStats) return insights;

  // Analyze numeric columns
  Object.entries(columnStats).forEach(([col, stats]) => {
    const colStats = stats as { type: string; avg?: number; min?: number; max?: number };
    
    if (colStats.type === 'numeric' && colStats.avg !== undefined) {
      const range = (colStats.max || 0) - (colStats.min || 0);
      const avgValue = colStats.avg;
      
      if (range > avgValue * 2) {
        insights.push(`${col} shows high variability (range: ${colStats.min} to ${colStats.max})`);
      }
    }
  });

  // Check for potential grouping columns
  Object.entries(columnStats).forEach(([col, stats]) => {
    const colStats = stats as { type: string; uniqueCount?: number };
    const rowCount = statistics.rowCount as number;
    
    if (colStats.type === 'categorical' && colStats.uniqueCount) {
      if (colStats.uniqueCount < rowCount * 0.5) {
        insights.push(`${col} could be used for grouping (${colStats.uniqueCount} unique values)`);
      }
    }
  });

  return insights;
}

/**
 * Generate recommendations based on analysis.
 */
function generateRecommendations(
  data: unknown[],
  statistics: Record<string, unknown>,
  query?: string
): string[] {
  const recommendations: string[] = [];
  const columnStats = statistics.columnStats as Record<string, unknown> | undefined;

  if (!columnStats) return recommendations;

  // Recommend aggregations for numeric columns
  const numericColumns = Object.entries(columnStats)
    .filter(([_, stats]) => (stats as { type: string }).type === 'numeric')
    .map(([col]) => col);

  if (numericColumns.length > 0) {
    recommendations.push(`Consider aggregating ${numericColumns.join(', ')} by categories`);
  }

  // Recommend time-based analysis if date columns exist
  const dateColumns = Object.keys(columnStats).filter(col =>
    col.toLowerCase().includes('date') || col.toLowerCase().includes('time')
  );

  if (dateColumns.length > 0) {
    recommendations.push(`Analyze trends over time using ${dateColumns.join(', ')}`);
  }

  // Recommend filtering if many unique values
  Object.entries(columnStats).forEach(([col, stats]) => {
    const colStats = stats as { type: string; uniqueCount?: number };
    
    if (colStats.type === 'categorical' && colStats.uniqueCount && colStats.uniqueCount > 10) {
      recommendations.push(`Consider filtering ${col} to focus on specific values`);
    }
  });

  return recommendations;
}

/**
 * Suggest appropriate visualizations.
 */
function suggestVisualizations(data: unknown[], statistics: Record<string, unknown>): string[] {
  const suggestions: string[] = [];
  const columnStats = statistics.columnStats as Record<string, unknown> | undefined;

  if (!columnStats) return suggestions;

  const columns = Object.keys(columnStats);
  const numericColumns = columns.filter(col => 
    (columnStats[col] as { type: string }).type === 'numeric'
  );
  const categoricalColumns = columns.filter(col =>
    (columnStats[col] as { type: string }).type === 'categorical'
  );
  const dateColumns = columns.filter(col =>
    col.toLowerCase().includes('date') || col.toLowerCase().includes('time')
  );

  // Always suggest table view
  suggestions.push('Table view for detailed data exploration');

  // Suggest charts based on data structure
  if (categoricalColumns.length > 0 && numericColumns.length > 0) {
    suggestions.push(`Bar chart: ${numericColumns[0]} by ${categoricalColumns[0]}`);
    
    if (categoricalColumns.length === 1) {
      suggestions.push(`Pie chart: Distribution of ${numericColumns[0]} by ${categoricalColumns[0]}`);
    }
  }

  if (dateColumns.length > 0 && numericColumns.length > 0) {
    suggestions.push(`Line chart: ${numericColumns[0]} trend over ${dateColumns[0]}`);
  }

  if (numericColumns.length >= 2) {
    suggestions.push(`Scatter plot: ${numericColumns[0]} vs ${numericColumns[1]}`);
  }

  return suggestions;
}

/**
 * Generate summary text.
 */
function generateSummary(data: unknown[], statistics: Record<string, unknown>): string {
  const rowCount = statistics.rowCount as number;
  const columnCount = statistics.columnCount as number;
  
  return `Dataset contains ${rowCount} rows and ${columnCount} columns`;
}
