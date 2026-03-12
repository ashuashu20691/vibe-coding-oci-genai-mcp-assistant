// src/mastra/agents/data-analysis-agent.ts
/**
 * Data Analysis Agent - Analyzes query results and provides insights.
 */

export const DATA_ANALYSIS_AGENT_INSTRUCTIONS = `You are a data analyst. Given a dataset, produce a concise, accurate analysis.

<behavior>
Work directly with the data provided. Do not ask for more data or suggest running additional queries — analyze what you have.

Prioritize findings that are actionable or surprising. Skip obvious observations.

If the initial data is shallow (e.g., all values identical, no meaningful variance), you may use DDL to build analytical layers:
- CREATE VIEW to aggregate or join tables for a richer perspective
- CREATE TABLE AS SELECT to materialize a derived dataset for deeper analysis
Always clean up temporary objects (DROP TABLE/VIEW) after use.
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
Flag anomalies explicitly — e.g., "EMEA shows 0% on-time delivery — this is a crisis."
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
 * Produces structured stats for the InlineAnalysisCard UI component.
 * The LLM agent's text response handles narrative analysis — this handles computed metrics.
 */
export function analyzeData(request: AnalysisRequest): AnalysisResult {
  const { data, query } = request;

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

  return { summary, statistics, insights, recommendations, suggestedVisualizations };
}

/**
 * Calculate basic statistics from data.
 */
function calculateStatistics(data: unknown[]): Record<string, unknown> {
  const stats: Record<string, unknown> = { rowCount: data.length };
  if (data.length === 0) return stats;

  const firstRow = data[0];
  if (typeof firstRow !== 'object' || firstRow === null) return stats;

  const columns = Object.keys(firstRow);
  stats.columnCount = columns.length;
  stats.columns = columns;

  const columnStats: Record<string, unknown> = {};
  columns.forEach(col => {
    const values = data.map(row => (row as Record<string, unknown>)[col]);
    const numericValues = values.filter(v => typeof v === 'number') as number[];

    if (numericValues.length > 0) {
      const sum = numericValues.reduce((a, b) => a + b, 0);
      columnStats[col] = {
        type: 'numeric',
        count: numericValues.length,
        sum,
        avg: sum / numericValues.length,
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
  values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

/**
 * Generate insights — spots anomalies, outliers, top/bottom performers.
 */
function generateInsights(data: unknown[], statistics: Record<string, unknown>): string[] {
  const insights: string[] = [];
  const columnStats = statistics.columnStats as Record<string, unknown> | undefined;
  if (!columnStats) return insights;

  const rows = data as Record<string, unknown>[];
  const columns = Object.keys(columnStats);
  const numericCols = columns.filter(c => (columnStats[c] as { type: string }).type === 'numeric');
  const catCols = columns.filter(c => (columnStats[c] as { type: string }).type === 'categorical');

  if (numericCols.length > 0 && catCols.length > 0) {
    const metricCol = numericCols[0];
    const labelCol = catCols[0];
    const stats = columnStats[metricCol] as { avg: number; min: number; max: number; sum: number };

    // Top and bottom performers
    const sorted = [...rows].sort((a, b) => (Number(b[metricCol]) || 0) - (Number(a[metricCol]) || 0));
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];

    if (top && bottom) {
      const topVal = Number(top[metricCol]);
      const bottomVal = Number(bottom[metricCol]);
      insights.push(`Top performer: ${top[labelCol]} (${topVal.toLocaleString()})`);
      if (bottomVal === 0) {
        insights.push(`⚠️ ${bottom[labelCol]} has zero ${metricCol} — possible data issue or complete underperformance`);
      } else {
        insights.push(`Bottom performer: ${bottom[labelCol]} (${bottomVal.toLocaleString()})`);
      }
    }

    // Zero-value anomalies
    const zeroRows = rows.filter(r => Number(r[metricCol]) === 0);
    if (zeroRows.length > 0 && zeroRows.length < rows.length) {
      const zeroLabels = zeroRows.map(r => r[labelCol]).join(', ');
      insights.push(`🚨 ${zeroRows.length} group(s) with zero ${metricCol}: ${zeroLabels}`);
    }

    // Outliers: > 2 standard deviations from mean
    if (stats.avg > 0) {
      const values = rows.map(r => Number(r[metricCol]) || 0);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);
      const outliers = rows.filter(r => Math.abs((Number(r[metricCol]) || 0) - mean) > 2 * stdDev);
      if (outliers.length > 0 && outliers.length <= 3) {
        outliers.forEach(r => {
          const val = Number(r[metricCol]);
          const direction = val > mean ? 'above' : 'below';
          insights.push(`Outlier: ${r[labelCol]} is significantly ${direction} average (${val.toLocaleString()} vs avg ${mean.toFixed(0)})`);
        });
      }
    }
  }

  // Single numeric column — report spread
  if (numericCols.length > 0 && catCols.length === 0) {
    const col = numericCols[0];
    const stats = columnStats[col] as { avg: number; min: number; max: number };
    const range = stats.max - stats.min;
    if (range > stats.avg * 3) {
      insights.push(`High spread in ${col}: min ${stats.min.toLocaleString()}, max ${stats.max.toLocaleString()}, avg ${stats.avg.toFixed(0)}`);
    }
  }

  return insights;
}

/**
 * Generate recommendations based on actual data patterns.
 */
function generateRecommendations(
  data: unknown[],
  statistics: Record<string, unknown>,
  query?: string
): string[] {
  const recommendations: string[] = [];
  const columnStats = statistics.columnStats as Record<string, unknown> | undefined;
  if (!columnStats) return recommendations;

  const rows = data as Record<string, unknown>[];
  const columns = Object.keys(columnStats);
  const numericCols = columns.filter(c => (columnStats[c] as { type: string }).type === 'numeric');
  const catCols = columns.filter(c => (columnStats[c] as { type: string }).type === 'categorical');
  const dateCols = columns.filter(c => c.toLowerCase().includes('date') || c.toLowerCase().includes('time'));

  if (numericCols.length > 0 && catCols.length > 0) {
    const metricCol = numericCols[0];
    const labelCol = catCols[0];

    // Recommend investigating zero-value groups
    const zeroRows = rows.filter(r => Number(r[metricCol]) === 0);
    if (zeroRows.length > 0) {
      recommendations.push(`Investigate ${zeroRows.length} group(s) with zero ${metricCol} — may indicate missing data or a systemic issue`);
    }

    // Recommend comparing top vs bottom if large gap
    const sorted = [...rows].sort((a, b) => (Number(b[metricCol]) || 0) - (Number(a[metricCol]) || 0));
    if (sorted.length >= 2) {
      const topVal = Number(sorted[0][metricCol]);
      const bottomVal = Number(sorted[sorted.length - 1][metricCol]);
      if (topVal > 0 && bottomVal >= 0 && topVal / Math.max(bottomVal, 1) > 3) {
        recommendations.push(`Large gap between top and bottom ${labelCol} — consider targeted intervention for underperformers`);
      }
    }
  }

  if (dateCols.length > 0 && numericCols.length > 0) {
    recommendations.push(`Trend analysis available — filter by ${dateCols[0]} to see performance over time`);
  }

  if (recommendations.length === 0 && numericCols.length > 0) {
    recommendations.push(`Compare ${numericCols[0]} across different segments for deeper insight`);
  }

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
  const numericColumns = columns.filter(col => (columnStats[col] as { type: string }).type === 'numeric');
  const categoricalColumns = columns.filter(col => (columnStats[col] as { type: string }).type === 'categorical');
  const dateColumns = columns.filter(col => col.toLowerCase().includes('date') || col.toLowerCase().includes('time'));

  suggestions.push('Table view for detailed data exploration');

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
 * Generate a meaningful summary sentence.
 */
function generateSummary(data: unknown[], statistics: Record<string, unknown>): string {
  const rowCount = statistics.rowCount as number;
  const columnStats = statistics.columnStats as Record<string, unknown> | undefined;
  if (!columnStats) return `${rowCount} rows returned`;

  const columns = Object.keys(columnStats);
  const numericCols = columns.filter(c => (columnStats[c] as { type: string }).type === 'numeric');
  const catCols = columns.filter(c => (columnStats[c] as { type: string }).type === 'categorical');

  if (numericCols.length > 0 && catCols.length > 0) {
    const metricCol = numericCols[0];
    const stats = columnStats[metricCol] as { sum?: number };
    const total = stats.sum ? stats.sum.toLocaleString(undefined, { maximumFractionDigits: 0 }) : null;
    return total
      ? `${rowCount} ${catCols[0]} groups — total ${metricCol}: ${total}`
      : `${rowCount} ${catCols[0]} groups analyzed`;
  }

  return `${rowCount} rows, ${columns.length} columns`;
}
