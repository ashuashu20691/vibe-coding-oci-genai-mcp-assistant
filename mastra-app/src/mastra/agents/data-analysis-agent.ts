// src/mastra/agents/data-analysis-agent.ts
/**
 * Data Analysis Agent - Analyzes query results and provides insights.
 */

export const DATA_ANALYSIS_AGENT_INSTRUCTIONS = `You are a data analyst focused on actionable insights and critical issue detection.

<behavior>
Work directly with the data provided. Do not ask for more data or suggest running additional queries — analyze what you have.

Prioritize findings that are actionable, critical, or surprising. Flag critical issues prominently with 🔴, warnings with 🟡, and positive findings with 🟢.

Use specific numbers, percentages, and comparisons to benchmarks. Avoid vague statements like "some items" — say "5 items (23%)".

If the initial data is shallow (e.g., all values identical, no meaningful variance), you may use DDL to build analytical layers:
- CREATE VIEW to aggregate or join tables for a richer perspective
- CREATE TABLE AS SELECT to materialize a derived dataset for deeper analysis
Always clean up temporary objects (DROP TABLE/VIEW) after use.
</behavior>

<output_structure>
Respond with:
1. A one-sentence summary with key metrics
2. Three to five specific findings with severity indicators (🔴 critical, 🟡 warning, 🟢 positive)
3. Two to three actionable recommendations with:
   - Specific steps to take
   - Expected outcomes
   - Target metrics or timelines

Keep the total response under 200 words. Use plain language with specific numbers.
</output_structure>

<analysis_approach>
For numeric columns: identify the range, average, outliers, and compare to benchmarks.
For categorical columns: identify the dominant category, critical minorities, and performance gaps.
For time-based data: identify the trend direction, inflection points, and seasonal patterns.
For grouped data: identify top/bottom performers, the gap between them, and items below average.

CRITICAL ISSUE DETECTION:
- Flag status columns with "delayed", "critical", "fail", "error" as 🔴 CRITICAL
- Flag zero values in key metrics as 🔴 CRITICAL (possible data issue)
- Flag large performance gaps (>50%) as 🟡 WARNING
- Flag items below reorder point as 🔴 CRITICAL
- Flag outliers (>2 std dev) with severity based on direction

ACTIONABLE RECOMMENDATIONS:
- Include specific steps (1, 2, 3)
- Include expected outcomes ("Reduce critical items by 50%")
- Include target metrics ("Bring to average of X")
- Include timelines ("within 24 hours", "within 48 hours")
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
 * Uses 🔴 for critical issues, 🟡 for warnings, 🟢 for positive findings.
 */
function generateInsights(data: unknown[], statistics: Record<string, unknown>): string[] {
  const insights: string[] = [];
  const columnStats = statistics.columnStats as Record<string, unknown> | undefined;
  if (!columnStats) return insights;

  const rows = data as Record<string, unknown>[];
  const columns = Object.keys(columnStats);
  const numericCols = columns.filter(c => (columnStats[c] as { type: string }).type === 'numeric');
  const catCols = columns.filter(c => (columnStats[c] as { type: string }).type === 'categorical');

  // Check for status/condition columns to detect critical issues
  const statusCol = columns.find(c => 
    ['status', 'state', 'condition', 'priority', 'severity'].some(k => c.toLowerCase().includes(k))
  );

  if (statusCol) {
    const criticalStatuses = rows.filter(r => {
      const val = String(r[statusCol]).toLowerCase();
      return val.includes('delayed') || val.includes('critical') || val.includes('fail') || val.includes('error');
    });
    
    if (criticalStatuses.length > 0) {
      const percentage = ((criticalStatuses.length / rows.length) * 100).toFixed(1);
      insights.push(`🔴 CRITICAL: ${criticalStatuses.length} items (${percentage}%) have critical ${statusCol} - immediate action required`);
    }

    const warningStatuses = rows.filter(r => {
      const val = String(r[statusCol]).toLowerCase();
      return val.includes('warning') || val.includes('pending') || val.includes('transit');
    });
    
    if (warningStatuses.length > 0) {
      const percentage = ((warningStatuses.length / rows.length) * 100).toFixed(1);
      insights.push(`🟡 WARNING: ${warningStatuses.length} items (${percentage}%) require attention`);
    }

    const successStatuses = rows.filter(r => {
      const val = String(r[statusCol]).toLowerCase();
      return val.includes('success') || val.includes('delivered') || val.includes('complete') || val.includes('active');
    });
    
    if (successStatuses.length > 0) {
      const percentage = ((successStatuses.length / rows.length) * 100).toFixed(1);
      insights.push(`🟢 ${successStatuses.length} items (${percentage}%) operating normally`);
    }
  }

  if (numericCols.length > 0 && catCols.length > 0) {
    const metricCol = numericCols[0];
    const labelCol = catCols[0];
    const stats = columnStats[metricCol] as { avg: number; min: number; max: number; sum: number };

    // Top and bottom performers with percentage comparison
    const sorted = [...rows].sort((a, b) => (Number(b[metricCol]) || 0) - (Number(a[metricCol]) || 0));
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];

    if (top && bottom) {
      const topVal = Number(top[metricCol]);
      const bottomVal = Number(bottom[metricCol]);
      const avgVal = stats.avg;
      
      // Top performer with comparison to average
      const topVsAvg = avgVal > 0 ? (((topVal - avgVal) / avgVal) * 100).toFixed(1) : '0';
      insights.push(`🟢 Top performer: ${top[labelCol]} (${topVal.toLocaleString()}) - ${topVsAvg}% above average`);
      
      if (bottomVal === 0) {
        insights.push(`🔴 CRITICAL: ${bottom[labelCol]} has zero ${metricCol} — complete failure or missing data`);
      } else {
        const bottomVsAvg = avgVal > 0 ? (((avgVal - bottomVal) / avgVal) * 100).toFixed(1) : '0';
        insights.push(`🔴 Bottom performer: ${bottom[labelCol]} (${bottomVal.toLocaleString()}) - ${bottomVsAvg}% below average`);
      }
    }

    // Zero-value anomalies with severity
    const zeroRows = rows.filter(r => Number(r[metricCol]) === 0);
    if (zeroRows.length > 0 && zeroRows.length < rows.length) {
      const zeroLabels = zeroRows.slice(0, 5).map(r => r[labelCol]).join(', ');
      const moreText = zeroRows.length > 5 ? ` and ${zeroRows.length - 5} more` : '';
      const percentage = ((zeroRows.length / rows.length) * 100).toFixed(1);
      insights.push(`🔴 CRITICAL: ${zeroRows.length} groups (${percentage}%) with zero ${metricCol}: ${zeroLabels}${moreText}`);
    }

    // Outliers with specific values and benchmarks
    if (stats.avg > 0) {
      const values = rows.map(r => Number(r[metricCol]) || 0);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);
      const outliers = rows.filter(r => Math.abs((Number(r[metricCol]) || 0) - mean) > 2 * stdDev);
      
      if (outliers.length > 0 && outliers.length <= 3) {
        outliers.forEach(r => {
          const val = Number(r[metricCol]);
          const deviation = ((Math.abs(val - mean) / mean) * 100).toFixed(0);
          const direction = val > mean ? 'above' : 'below';
          const emoji = val > mean ? '🟢' : '🔴';
          insights.push(`${emoji} Outlier: ${r[labelCol]} is ${deviation}% ${direction} average (${val.toLocaleString()} vs ${mean.toFixed(0)})`);
        });
      }
    }

    // Performance gap analysis
    if (sorted.length >= 2) {
      const topVal = Number(sorted[0][metricCol]);
      const bottomVal = Number(sorted[sorted.length - 1][metricCol]);
      if (topVal > 0 && bottomVal >= 0) {
        const gap = topVal - bottomVal;
        const gapPercentage = ((gap / topVal) * 100).toFixed(1);
        if (Number(gapPercentage) > 50) {
          insights.push(`🟡 Large performance gap: ${gapPercentage}% difference between top and bottom ${labelCol}`);
        }
      }
    }
  }

  // Single numeric column — report spread with severity
  if (numericCols.length > 0 && catCols.length === 0) {
    const col = numericCols[0];
    const stats = columnStats[col] as { avg: number; min: number; max: number };
    const range = stats.max - stats.min;
    const rangePercentage = stats.avg > 0 ? ((range / stats.avg) * 100).toFixed(0) : '0';
    
    if (range > stats.avg * 3) {
      insights.push(`🟡 High variability in ${col}: ${rangePercentage}% range (min: ${stats.min.toLocaleString()}, max: ${stats.max.toLocaleString()}, avg: ${stats.avg.toFixed(0)})`);
    }
  }

  return insights;
}

/**
 * Generate actionable recommendations with specific steps and expected outcomes.
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

  // Check for critical status issues
  const statusCol = columns.find(c => 
    ['status', 'state', 'condition', 'priority', 'severity'].some(k => c.toLowerCase().includes(k))
  );

  if (statusCol) {
    const criticalRows = rows.filter(r => {
      const val = String(r[statusCol]).toLowerCase();
      return val.includes('delayed') || val.includes('critical') || val.includes('fail') || val.includes('error');
    });

    if (criticalRows.length > 0) {
      const labelCol = catCols[0];
      if (labelCol) {
        const affectedGroups = [...new Set(criticalRows.map(r => String(r[labelCol])))];
        recommendations.push(
          `🔴 IMMEDIATE ACTION: Investigate ${affectedGroups.length} affected ${labelCol}(s) with critical ${statusCol}. ` +
          `Expected outcome: Reduce critical items by 50% within 24 hours. ` +
          `Steps: 1) Contact ${affectedGroups.slice(0, 3).join(', ')} 2) Identify root cause 3) Implement fix`
        );
      } else {
        recommendations.push(
          `🔴 IMMEDIATE ACTION: Address ${criticalRows.length} critical ${statusCol} items. ` +
          `Expected outcome: Resolve all critical issues within 48 hours`
        );
      }
    }
  }

  if (numericCols.length > 0 && catCols.length > 0) {
    const metricCol = numericCols[0];
    const labelCol = catCols[0];

    // Recommend investigating zero-value groups with specific actions
    const zeroRows = rows.filter(r => Number(r[metricCol]) === 0);
    if (zeroRows.length > 0) {
      const zeroLabels = zeroRows.slice(0, 3).map(r => String(r[labelCol])).join(', ');
      const moreText = zeroRows.length > 3 ? ` and ${zeroRows.length - 3} more` : '';
      recommendations.push(
        `🔴 DATA QUALITY: Investigate ${zeroRows.length} ${labelCol}(s) with zero ${metricCol} (${zeroLabels}${moreText}). ` +
        `Expected outcome: Identify if this is missing data or actual zero values. ` +
        `Steps: 1) Verify data source 2) Check for data pipeline issues 3) Update or backfill if needed`
      );
    }

    // Recommend comparing top vs bottom with specific targets
    const sorted = [...rows].sort((a, b) => (Number(b[metricCol]) || 0) - (Number(a[metricCol]) || 0));
    if (sorted.length >= 2) {
      const topVal = Number(sorted[0][metricCol]);
      const bottomVal = Number(sorted[sorted.length - 1][metricCol]);
      const avgVal = (columnStats[metricCol] as { avg: number }).avg;
      
      if (topVal > 0 && bottomVal >= 0 && topVal / Math.max(bottomVal, 1) > 3) {
        const bottomLabel = sorted[sorted.length - 1][labelCol];
        const targetImprovement = ((avgVal - bottomVal) / bottomVal * 100).toFixed(0);
        recommendations.push(
          `🟡 PERFORMANCE GAP: Large disparity between top and bottom ${labelCol}. ` +
          `Target: Improve ${bottomLabel} by ${targetImprovement}% to reach average performance. ` +
          `Steps: 1) Analyze top performer practices 2) Identify bottlenecks in underperformers 3) Implement best practices`
        );
      }
    }

    // Benchmark recommendations
    const stats = columnStats[metricCol] as { avg: number; max: number };
    const belowAverage = rows.filter(r => Number(r[metricCol]) < stats.avg);
    if (belowAverage.length > rows.length / 2) {
      const percentage = ((belowAverage.length / rows.length) * 100).toFixed(0);
      recommendations.push(
        `🟡 BENCHMARK: ${percentage}% of ${labelCol}s are below average ${metricCol}. ` +
        `Target: Bring bottom 50% up to average (${stats.avg.toFixed(0)}). ` +
        `Expected impact: ${((stats.avg * belowAverage.length) - belowAverage.reduce((sum, r) => sum + Number(r[metricCol]), 0)).toFixed(0)} total ${metricCol} increase`
      );
    }
  }

  if (dateCols.length > 0 && numericCols.length > 0) {
    const dateCol = dateCols[0];
    const metricCol = numericCols[0];
    recommendations.push(
      `📊 TREND ANALYSIS: Filter by ${dateCol} to identify performance trends over time. ` +
      `Expected outcome: Identify seasonal patterns or declining trends requiring intervention`
    );
  }

  // Check for inventory-specific recommendations
  const qtyCol = columns.find(c => c.toLowerCase().includes('qty') || c.toLowerCase().includes('quantity') || c.toLowerCase().includes('stock'));
  const reorderCol = columns.find(c => c.toLowerCase().includes('reorder'));
  
  if (qtyCol && reorderCol) {
    const lowStock = rows.filter(r => Number(r[qtyCol]) <= Number(r[reorderCol]));
    if (lowStock.length > 0) {
      const labelCol = catCols[0];
      const affectedItems = lowStock.slice(0, 3).map(r => String(r[labelCol])).join(', ');
      const moreText = lowStock.length > 3 ? ` and ${lowStock.length - 3} more` : '';
      recommendations.push(
        `🔴 INVENTORY: ${lowStock.length} items at or below reorder point (${affectedItems}${moreText}). ` +
        `IMMEDIATE ACTION: Place reorder within 24 hours to prevent stockouts. ` +
        `Expected outcome: Restore inventory to safe levels within lead time`
      );
    }
  }

  if (recommendations.length === 0 && numericCols.length > 0) {
    const metricCol = numericCols[0];
    const stats = columnStats[metricCol] as { avg: number };
    recommendations.push(
      `📊 DEEP DIVE: Compare ${metricCol} across different segments to identify optimization opportunities. ` +
      `Target: Identify segments performing below ${stats.avg.toFixed(0)} average and develop improvement plans`
    );
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
