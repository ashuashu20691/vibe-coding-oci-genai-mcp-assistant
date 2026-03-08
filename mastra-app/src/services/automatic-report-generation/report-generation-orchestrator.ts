/**
 * ReportGenerationOrchestrator
 * 
 * Coordinates the multi-step report generation pipeline by integrating
 * ResultPresenter, DashboardComposer, and ExportService to create
 * comprehensive visual reports from query results.
 * 
 * Requirements: 2.1, 3.1, 6.1
 */

import { ResultPresenter } from '../result-presenter';
import { DashboardComposer } from '../dashboard-composer';
import { ExportService } from '../export-service';
import type { QueryResult } from '../query-engine';
import type { 
  TriggerDecision, 
  ReportGenerationResult,
} from './types';
import type { WorkflowContext } from '../workflow-orchestrator';

/**
 * ReportGenerationOrchestrator coordinates the report generation pipeline.
 * 
 * This class integrates existing services to automatically generate visual
 * reports, dashboards, and galleries from database query results.
 * 
 * Requirements:
 * - 2.1: Visual report generation with charts and formatting
 * - 3.1: Dashboard creation with multiple visualizations
 * - 6.1: Workflow integration for automatic report generation
 */
export class ReportGenerationOrchestrator {
  /**
   * Creates a new ReportGenerationOrchestrator instance.
   * 
   * @param resultPresenter - Service for formatting query results with multi-modal content
   * @param dashboardComposer - Service for composing dashboard layouts
   * @param exportService - Service for exporting reports to various formats
   */
  constructor(
    private resultPresenter: ResultPresenter,
    private dashboardComposer: DashboardComposer,
    private exportService: typeof ExportService
  ) {}

  /**
   * Execute the report generation pipeline.
   * 
   * Orchestrates the complete report generation process based on the trigger
   * decision, routing to the appropriate generation method (simple, dashboard,
   * or gallery).
   * 
   * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
   * 
   * @param queryResult - Query result from database execution
   * @param triggerDecision - Decision about what type of report to generate
   * @param context - Workflow context for integration
   * @returns Promise resolving to report generation result
   */
  async generateReport(
    queryResult: QueryResult,
    triggerDecision: TriggerDecision,
    context: WorkflowContext
  ): Promise<ReportGenerationResult> {
    try {
      // Route to appropriate generation method based on suggested report type
      switch (triggerDecision.suggestedReportType) {
        case 'simple':
          return await this.generateSimpleReport(queryResult, context);
        
        case 'dashboard':
          return await this.generateDashboardReport(queryResult, context);
        
        case 'gallery':
          return await this.generateGalleryReport(queryResult, context);
        
        default:
          // Fallback to simple report for unknown types
          return await this.generateSimpleReport(queryResult, context);
      }
    } catch (error) {
      // Error handling: return failed result with error details
      return {
        success: false,
        reportHTML: '',
        exportOptions: {
          html: () => {},
          excel: undefined,
        },
        renderData: {
          type: 'inline',
          content: '',
        },
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Generate a simple report with single visualization.
   * 
   * Creates a basic report with formatted data table and a single primary
   * visualization. Suitable for straightforward query results.
   * 
   * Validates: Requirements 2.1, 2.5
   * 
   * @param queryResult - Query result to visualize
   * @param context - Workflow context
   * @returns Promise resolving to report generation result
   */
  private async generateSimpleReport(
    queryResult: QueryResult,
    context: WorkflowContext
  ): Promise<ReportGenerationResult> {
    // Format results using ResultPresenter
    const formattedResult = this.resultPresenter.formatResults(queryResult, {
      preserveAspectRatio: true,
      maxImageWidth: 400,
      maxImageHeight: 400,
    });

    // Generate primary visualization (chart)
    const chartHTML = this.generatePrimaryVisualization(queryResult);

    // Generate data table HTML
    const tableHTML = this.resultPresenter.generateHTML(formattedResult, 'grid');

    // Combine chart and table in a structured layout
    const reportContent = `
      <div class="simple-report">
        ${chartHTML ? `
          <div class="report-section chart-section">
            <h2 class="section-title">Visualization</h2>
            ${chartHTML}
          </div>
        ` : ''}
        <div class="report-section table-section">
          <h2 class="section-title">Data Table</h2>
          ${tableHTML}
        </div>
      </div>
      <style>
        .simple-report {
          padding: 1rem;
        }
        .report-section {
          margin-bottom: 2rem;
        }
        .section-title {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 1rem;
          color: #1f2937;
        }
        .chart-section {
          background: white;
          padding: 1.5rem;
          border-radius: 0.5rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .table-section {
          background: white;
          padding: 1.5rem;
          border-radius: 0.5rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
      </style>
    `;

    // Wrap in responsive layout
    const title = 'Query Results';
    const completeHTML = this.dashboardComposer.generateResponsiveLayout(reportContent, title);

    // Create export functions
    const exportOptions = {
      html: () => {
        this.exportService.exportToHTML(
          { 
            title, 
            description: `${queryResult.data.length} rows`,
            sections: [],
            filters: [],
            exportOptions: []
          },
          'simple-report.html',
          queryResult.data
        );
      },
    };

    return {
      success: true,
      reportHTML: completeHTML,
      exportOptions,
      renderData: {
        type: 'inline',
        content: completeHTML,
      },
    };
  }

  /**
   * Generate a comprehensive dashboard with multiple visualizations.
   * 
   * Creates a full-featured dashboard with stats cards, multiple chart types,
   * insights section, and data tables. Suitable for complex analytical queries.
   * 
   * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
   * 
   * @param queryResult - Query result to visualize
   * @param context - Workflow context
   * @returns Promise resolving to report generation result
   */
  private async generateDashboardReport(
      queryResult: QueryResult,
      context: WorkflowContext
    ): Promise<ReportGenerationResult> {
      // Format results using ResultPresenter
      const formattedResult = this.resultPresenter.formatResults(queryResult, {
        preserveAspectRatio: true,
        maxImageWidth: 400,
        maxImageHeight: 400,
      });

      // Profile data for visualization selection (Requirement 3.1)
      const profile = this.profileData(queryResult);

      // Detect analysis categories based on data characteristics (Requirement 3.2)
      const categories = this.detectAnalysisCategories(queryResult, profile);

      // Select visualizations based on data profile
      const selectionResult = this.selectVisualizationsForDashboard(queryResult, profile, categories);

      // Call DashboardComposer.compose() to create layout (Requirement 3.2)
      const dashboardLayout = this.dashboardComposer.compose(
        selectionResult,
        queryResult.data,
        profile,
        categories
      );

      // Generate HTML for each section
      const sectionsHTML = dashboardLayout.sections.map(section => {
        let sectionContent = '';

        switch (section.type) {
          case 'stats':
            // Generate stats cards for numeric metrics (Requirement 3.1)
            sectionContent = this.generateStatsCardsHTML(section.content.statsCards || []);
            break;

          case 'visualization':
            // Include multiple visualization sections (Requirement 3.2)
            sectionContent = this.generateVisualizationHTML(section.content.visualization!, queryResult);
            break;

          case 'insights':
            // Add insights section (Requirement 3.3)
            sectionContent = this.generateInsightsHTML(section.content.insights || []);
            break;

          case 'table':
            sectionContent = this.dashboardComposer.generateDataTable(
              queryResult.data,
              section.content.tableConfig?.columns || []
            );
            break;
        }

        return this.dashboardComposer.generateSection(section.title, sectionContent, section.id);
      }).join('\n');

      const dashboardContent = `
        <div class="dashboard-container">
          <header class="dashboard-header">
            <h1>${dashboardLayout.title}</h1>
            <p class="description">${dashboardLayout.description}</p>
          </header>
          ${sectionsHTML}
        </div>
      `;

      const completeHTML = this.dashboardComposer.generateResponsiveLayout(
        dashboardContent,
        dashboardLayout.title
      );

      // Create export functions
      const exportOptions = {
        html: () => {
          this.exportService.exportToHTML(
            dashboardLayout,
            'dashboard-report.html',
            queryResult.data
          );
        },
        excel: async () => {
          await this.dashboardComposer.exportToExcel(
            dashboardLayout,
            queryResult.data,
            'dashboard-report.xlsx'
          );
        },
      };

      return {
        success: true,
        reportHTML: completeHTML,
        dashboardLayout,
        exportOptions,
        renderData: {
          type: 'inline',
          content: completeHTML,
        },
      };
    }

  /**
   * Profile data to extract characteristics for visualization selection.
   *
   * Analyzes the query result to create a DataProfile with column statistics,
   * data types, and other characteristics needed for intelligent visualization.
   *
   * @param queryResult - Query result to profile
   * @returns DataProfile with column statistics and metadata
   */
  private profileData(queryResult: QueryResult): any {
    const data = queryResult.data;

    if (data.length === 0) {
      return {
        tableName: 'Query Results',
        recordCount: 0,
        columnStats: [],
      };
    }

    const columns = Object.keys(data[0]);
    const columnStats = columns.map(columnName => {
      const values = data.map(row => row[columnName]);
      const nonNullValues = values.filter(v => v != null);
      const uniqueValues = new Set(nonNullValues);

      // Determine data type
      let dataType = 'string';
      if (nonNullValues.length > 0) {
        const firstValue = nonNullValues[0];
        if (typeof firstValue === 'number') {
          dataType = 'number';
        } else if (typeof firstValue === 'boolean') {
          dataType = 'boolean';
        } else if (typeof firstValue === 'string' && this.isDateString(String(firstValue))) {
          dataType = 'date';
        }
      }

      const stats: any = {
        columnName,
        dataType,
        nullCount: values.length - nonNullValues.length,
        uniqueCount: uniqueValues.size,
      };

      // Add numeric statistics
      if (dataType === 'number') {
        const numericValues = nonNullValues.map(v => Number(v)).filter(v => !isNaN(v));
        if (numericValues.length > 0) {
          stats.min = Math.min(...numericValues);
          stats.max = Math.max(...numericValues);
          stats.mean = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;

          // Calculate standard deviation
          const variance = numericValues.reduce((sum, val) =>
            sum + Math.pow(val - stats.mean, 2), 0) / numericValues.length;
          stats.stdDev = Math.sqrt(variance);
        }
      }

      // Add top values for categorical data
      if (dataType === 'string' && uniqueValues.size <= 20) {
        const valueCounts = new Map<string, number>();
        nonNullValues.forEach(v => {
          const key = String(v);
          valueCounts.set(key, (valueCounts.get(key) || 0) + 1);
        });

        stats.topValues = Array.from(valueCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([value, count]) => ({ value, count }));
      }

      return stats;
    });

    // Detect geographic data
    const hasLat = columns.some(c => /lat(itude)?/i.test(c));
    const hasLon = columns.some(c => /lon(gitude)?/i.test(c));
    let geographicSpread;

    if (hasLat && hasLon) {
      const latCol = columns.find(c => /lat(itude)?/i.test(c))!;
      const lonCol = columns.find(c => /lon(gitude)?/i.test(c))!;
      const latValues = data.map(row => Number(row[latCol])).filter(v => !isNaN(v));
      const lonValues = data.map(row => Number(row[lonCol])).filter(v => !isNaN(v));

      if (latValues.length > 0 && lonValues.length > 0) {
        geographicSpread = {
          minLat: Math.min(...latValues),
          maxLat: Math.max(...latValues),
          minLon: Math.min(...lonValues),
          maxLon: Math.max(...lonValues),
        };
      }
    }

    // Detect time range
    const dateColumns = columnStats.filter(s => s.dataType === 'date');
    let timeRange;

    if (dateColumns.length > 0) {
      const dateCol = dateColumns[0].columnName;
      const dates = data
        .map(row => new Date(String(row[dateCol])))
        .filter(d => !isNaN(d.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());

      if (dates.length > 0) {
        timeRange = {
          start: dates[0],
          end: dates[dates.length - 1],
        };
      }
    }

    return {
      tableName: 'Query Results',
      recordCount: data.length,
      columnStats,
      geographicSpread,
      timeRange,
    };
  }

  /**
   * Detect analysis categories based on data characteristics.
   *
   * Analyzes the data profile to determine which analysis categories apply,
   * such as time_series, geographic_analysis, categorical_comparison, etc.
   *
   * @param queryResult - Query result to analyze
   * @param profile - Data profile with statistics
   * @returns Array of applicable analysis categories
   */
  private detectAnalysisCategories(queryResult: QueryResult, profile: any): any[] {
    const categories: any[] = [];

    // Time series analysis
    if (profile.timeRange) {
      categories.push('time_series');
    }

    // Geographic analysis
    if (profile.geographicSpread) {
      categories.push('geographic_analysis');
    }

    // Categorical comparison (if we have categorical columns with few unique values)
    const hasCategorical = profile.columnStats.some((stat: any) =>
      stat.dataType === 'string' && stat.uniqueCount > 1 && stat.uniqueCount <= 20
    );
    if (hasCategorical) {
      categories.push('categorical_comparison');
    }

    // Check for image data
    const imageColumns = this.detectImageColumns(queryResult);
    if (imageColumns.length > 0) {
      categories.push('similarity_search');
    }

    // Default to categorical comparison if no specific category detected
    if (categories.length === 0) {
      categories.push('categorical_comparison');
    }

    return categories;
  }

  /**
   * Select visualizations for dashboard based on data profile.
   *
   * Creates a SelectionResult with primary visualization, secondary visualizations,
   * and stats cards based on the data characteristics.
   *
   * @param queryResult - Query result to visualize
   * @param profile - Data profile with statistics
   * @param categories - Detected analysis categories
   * @returns SelectionResult with selected visualizations
   */
  private selectVisualizationsForDashboard(
    queryResult: QueryResult,
    profile: any,
    categories: any[]
  ): any {
    const data = queryResult.data;
    const statsCards: any[] = [];
    const visualizations: any[] = [];

    // Generate stats cards for numeric columns (Requirement 3.1)
    const numericColumns = profile.columnStats.filter((stat: any) => stat.dataType === 'number');

    numericColumns.slice(0, 4).forEach((stat: any) => {
      if (stat.mean !== undefined) {
        statsCards.push({
          label: this.formatColumnLabel(stat.columnName),
          value: stat.mean,
          format: 'number',
          trend: stat.max > stat.mean ? 'up' : 'neutral',
          description: `Range: ${stat.min.toFixed(2)} - ${stat.max.toFixed(2)}`,
        });
      }
    });

    // Add record count card
    statsCards.unshift({
      label: 'Total Records',
      value: profile.recordCount,
      format: 'integer',
      trend: 'neutral',
      description: `${profile.columnStats.length} columns`,
    });

    // Select primary visualization based on categories
    // Requirement 2.2, 7.2: Time-series data uses line or bar charts
    if (categories.includes('time_series')) {
      const dateColumn = profile.columnStats.find((s: any) => s.dataType === 'date');
      const numericColumn = numericColumns[0];

      if (dateColumn && numericColumn) {
        visualizations.push({
          type: 'line',
          title: `${this.formatColumnLabel(numericColumn.columnName)} Over Time`,
          xAxis: dateColumn.columnName,
          yAxis: numericColumn.columnName,
          config: {
            showLegend: true,
            showGrid: true,
          },
        });
      }
    }

    // Requirement 7.4: Geographic data uses map visualizations
    if (categories.includes('geographic_analysis')) {
      const latColumn = profile.columnStats.find((s: any) => 
        s.columnName.toLowerCase().includes('lat')
      );
      const lonColumn = profile.columnStats.find((s: any) => 
        s.columnName.toLowerCase().includes('lon')
      );
      const valueColumn = numericColumns[0];

      if (latColumn && lonColumn) {
        visualizations.push({
          type: 'map',
          title: valueColumn 
            ? `${this.formatColumnLabel(valueColumn.columnName)} by Location`
            : 'Geographic Distribution',
          xAxis: lonColumn.columnName,
          yAxis: latColumn.columnName,
          valueColumn: valueColumn?.columnName,
          config: {
            showLegend: true,
            showGrid: false,
          },
        });
      }
    }

    // Requirement 2.3, 7.3: Categorical data with groupings uses grouped/stacked charts
    if (categories.includes('categorical_comparison')) {
      const categoricalColumns = profile.columnStats.filter((s: any) =>
        s.dataType === 'string' && s.uniqueCount > 1 && s.uniqueCount <= 20
      );
      const numericColumn = numericColumns[0];

      if (categoricalColumns.length >= 2 && numericColumn) {
        // Use grouped or stacked bar for multiple categorical dimensions
        const totalCategories = categoricalColumns.reduce((sum: number, col: any) => sum + col.uniqueCount, 0);
        const chartType = totalCategories > 15 ? 'stacked-bar' : 'grouped-bar';
        
        visualizations.push({
          type: chartType,
          title: `${this.formatColumnLabel(numericColumn.columnName)} by ${categoricalColumns.map((c: any) => this.formatColumnLabel(c.columnName)).join(' and ')}`,
          xAxis: categoricalColumns[0].columnName,
          yAxis: numericColumn.columnName,
          groupBy: categoricalColumns[1].columnName,
          config: {
            showLegend: true,
            showGrid: true,
          },
        });
      } else if (categoricalColumns.length >= 1 && numericColumn) {
        // Single categorical column uses bar chart
        visualizations.push({
          type: 'bar',
          title: `${this.formatColumnLabel(numericColumn.columnName)} by ${this.formatColumnLabel(categoricalColumns[0].columnName)}`,
          xAxis: categoricalColumns[0].columnName,
          yAxis: numericColumn.columnName,
          config: {
            showLegend: false,
            showGrid: true,
          },
        });
      }
    }

    // Add secondary visualizations
    if (numericColumns.length >= 2) {
      const secondNumeric = numericColumns[1];
      visualizations.push({
        type: 'bar',
        title: `${this.formatColumnLabel(secondNumeric.columnName)} Distribution`,
        xAxis: 'index',
        yAxis: secondNumeric.columnName,
        config: {
          showLegend: false,
          showGrid: true,
        },
      });
    }

    // If we have categorical data with few values, add a pie chart
    const categoricalColumn = profile.columnStats.find((s: any) =>
      s.dataType === 'string' && s.uniqueCount > 1 && s.uniqueCount <= 7
    );

    if (categoricalColumn && categoricalColumn.topValues) {
      visualizations.push({
        type: 'pie',
        title: `Distribution by ${this.formatColumnLabel(categoricalColumn.columnName)}`,
        xAxis: categoricalColumn.columnName,
        yAxis: 'count',
        config: {
          showLegend: true,
          showGrid: false,
        },
      });
    }

    // Default visualization if none selected
    if (visualizations.length === 0 && data.length > 0) {
      const columns = Object.keys(data[0]);
      const firstNumeric = numericColumns[0];
      const firstColumn = columns[0];

      visualizations.push({
        type: 'bar',
        title: firstNumeric
          ? `${this.formatColumnLabel(firstNumeric.columnName)} Overview`
          : 'Data Overview',
        xAxis: firstColumn,
        yAxis: firstNumeric?.columnName || columns[1] || firstColumn,
        config: {
          showLegend: false,
          showGrid: true,
        },
      });
    }

    return {
      primary: visualizations[0] || {
        type: 'bar',
        title: 'Data Overview',
        xAxis: 'index',
        yAxis: 'value',
        config: { showLegend: false, showGrid: true },
      },
      secondary: visualizations.slice(1),
      statsCards,
    };
  }

  /**
   * Generate HTML for stats cards section.
   *
   * @param statsCards - Array of stats card configurations
   * @returns HTML string for stats cards
   */
  private generateStatsCardsHTML(statsCards: any[]): string {
    if (statsCards.length === 0) {
      return '';
    }

    const cardsHTML = statsCards.map(card => {
      const formattedValue = card.format === 'integer'
        ? Math.round(card.value).toLocaleString()
        : typeof card.value === 'number'
        ? card.value.toFixed(2)
        : String(card.value);

      return `
        <div class="stats-card">
          <div class="stats-label">${this.escapeHtml(card.label)}</div>
          <div class="stats-value">${formattedValue}</div>
          ${card.description ? `<div class="stats-description">${this.escapeHtml(card.description)}</div>` : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="stats-cards-grid">
        ${cardsHTML}
      </div>
      <style>
        .stats-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .stats-card {
          background: white;
          padding: 1.5rem;
          border-radius: 0.5rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          border-left: 4px solid #3b82f6;
        }
        .stats-label {
          font-size: 0.875rem;
          color: #6b7280;
          margin-bottom: 0.5rem;
          font-weight: 500;
        }
        .stats-value {
          font-size: 1.875rem;
          font-weight: 700;
          color: #1f2937;
          margin-bottom: 0.25rem;
        }
        .stats-description {
          font-size: 0.75rem;
          color: #9ca3af;
        }
      </style>
    `;
  }

  /**
   * Generate HTML for a visualization section.
   *
   * @param visualization - Visualization configuration
   * @returns HTML string for the visualization
   */
  /**
     * Generate HTML for a visualization section.
     * 
     * Extracts data from query result and generates appropriate chart HTML
     * based on the visualization configuration.
     *
     * @param visualization - Visualization configuration
     * @returns HTML string for the visualization
     */
    private generateVisualizationHTML(visualization: any, queryResult?: QueryResult): string {
      // If no query result provided, return placeholder
      if (!queryResult || !queryResult.data || queryResult.data.length === 0) {
        return `
          <div class="visualization-placeholder">
            <p style="text-align: center; color: #6b7280; padding: 2rem;">
              ${this.escapeHtml(visualization.title)}
            </p>
            <p style="text-align: center; color: #9ca3af; font-size: 0.875rem;">
              Chart type: ${visualization.type} | X: ${visualization.xAxis} | Y: ${visualization.yAxis}
            </p>
          </div>
          <style>
            .visualization-placeholder {
              background: white;
              padding: 1.5rem;
              border-radius: 0.5rem;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
              min-height: 300px;
              display: flex;
              flex-direction: column;
              justify-content: center;
            }
          </style>
        `;
      }

      const data = queryResult.data;
      const { type, xAxis, yAxis, groupBy, valueColumn } = visualization;

      // Handle map visualizations
      if (type === 'map') {
        const latitudes = data.map(row => Number(row[yAxis])).filter(v => !isNaN(v));
        const longitudes = data.map(row => Number(row[xAxis])).filter(v => !isNaN(v));
        const values = valueColumn 
          ? data.map(row => Number(row[valueColumn])).filter(v => !isNaN(v))
          : latitudes.map(() => 1);

        return this.generateMapHTML(latitudes, longitudes, values, valueColumn || 'Value');
      }

      // Handle grouped/stacked bar charts
      if (type === 'grouped-bar' || type === 'stacked-bar') {
        // Group data by xAxis and groupBy columns
        const groupedData = new Map<string, Map<string, number>>();

        data.forEach(row => {
          const xValue = String(row[xAxis]);
          const groupValue = String(row[groupBy]);
          const yValue = Number(row[yAxis]);

          if (!groupedData.has(xValue)) {
            groupedData.set(xValue, new Map());
          }
          groupedData.get(xValue)!.set(groupValue, yValue);
        });

        // Extract labels and group labels
        const labels = Array.from(groupedData.keys());
        const groupLabels = Array.from(
          new Set(data.map(row => String(row[groupBy])))
        );

        // Create dataset values for each group
        const datasetValues = groupLabels.map(groupLabel => 
          labels.map(label => groupedData.get(label)?.get(groupLabel) || 0)
        );

        const colors = [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(236, 72, 153, 0.8)',
          'rgba(6, 182, 212, 0.8)',
          'rgba(132, 204, 22, 0.8)',
          'rgba(249, 115, 22, 0.8)',
          'rgba(99, 102, 241, 0.8)',
        ];
        const borderColors = colors.map(c => c.replace('0.8', '1'));

        return this.generateGroupedChartHTML(
          type === 'stacked-bar',
          labels,
          datasetValues,
          groupLabels,
          xAxis,
          yAxis,
          colors,
          borderColors
        );
      }

      // Handle regular charts (bar, line, pie)
      const labels = data.map(row => String(row[xAxis])).slice(0, 20);
      const values = data.map(row => Number(row[yAxis])).slice(0, 20);

      return this.generateChartHTML(
        type as 'bar' | 'line' | 'pie',
        labels,
        values,
        xAxis,
        yAxis
      );
    }

  /**
   * Generate HTML for insights section.
   *
   * @param insights - Array of insight strings
   * @returns HTML string for insights
   */
  private generateInsightsHTML(insights: string[]): string {
    if (insights.length === 0) {
      return '';
    }

    const insightsHTML = insights.map(insight => `
      <li class="insight-item">
        <span class="insight-icon">💡</span>
        <span class="insight-text">${this.escapeHtml(insight)}</span>
      </li>
    `).join('');

    return `
      <div class="insights-container">
        <ul class="insights-list">
          ${insightsHTML}
        </ul>
      </div>
      <style>
        .insights-container {
          background: #f0f9ff;
          padding: 1.5rem;
          border-radius: 0.5rem;
          border-left: 4px solid #3b82f6;
        }
        .insights-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .insight-item {
          display: flex;
          align-items: flex-start;
          margin-bottom: 1rem;
          gap: 0.75rem;
        }
        .insight-item:last-child {
          margin-bottom: 0;
        }
        .insight-icon {
          font-size: 1.25rem;
          flex-shrink: 0;
        }
        .insight-text {
          color: #1f2937;
          line-height: 1.5;
        }
      </style>
    `;
  }

  /**
   * Format column label for display.
   *
   * @param columnName - Raw column name
   * @returns Formatted label
   */
  private formatColumnLabel(columnName: string): string {
    return columnName
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }


  /**
   * Generate an image gallery report.
   * 
   * Creates a gallery-style report optimized for displaying image data with
   * associated metrics (similarity scores, view counts, etc.).
   * 
   * Validates: Requirements 1.3, 2.1
   * 
   * @param queryResult - Query result containing image data
   * @param context - Workflow context
   * @returns Promise resolving to report generation result
   */
  private async generateGalleryReport(
    queryResult: QueryResult,
    context: WorkflowContext
  ): Promise<ReportGenerationResult> {
    // Detect image columns (common column names for image data)
    const imageColumns = this.detectImageColumns(queryResult);

    // Detect metadata columns for similarity scores, view counts, and distances
    const similarityColumn = this.detectMetadataColumn(queryResult, ['similarity', 'score', 'match']);
    const viewCountColumn = this.detectMetadataColumn(queryResult, ['views', 'view_count', 'viewcount', 'count']);
    const distanceColumn = this.detectMetadataColumn(queryResult, ['distance', 'dist']);

    // Format results with image extraction and metadata
    const formattedResult = this.resultPresenter.formatResults(queryResult, {
      imageColumns,
      similarityColumn,
      viewCountColumn,
      distanceColumn,
      distanceUnit: 'miles', // Default to miles, could be configurable
      preserveAspectRatio: true,
      maxImageWidth: 300,
      maxImageHeight: 300,
    });

    // Generate gallery HTML with grid layout
    const reportHTML = this.resultPresenter.generateHTML(formattedResult, 'grid');

    // Wrap in responsive layout with descriptive title
    const imageCount = queryResult.data.length;
    const title = `Image Gallery (${imageCount} ${imageCount === 1 ? 'image' : 'images'})`;
    const completeHTML = this.dashboardComposer.generateResponsiveLayout(reportHTML, title);

    // Create export functions
    const exportOptions = {
      html: () => {
        this.exportService.exportToHTML(
          {
            title,
            description: `Gallery containing ${imageCount} images with metadata`,
            sections: [],
            filters: [],
            exportOptions: []
          },
          'gallery-report.html',
          queryResult.data
        );
      },
    };

    return {
      success: true,
      reportHTML: completeHTML,
      exportOptions,
      renderData: {
        type: 'inline',
        content: completeHTML,
      },
    };
  }

  /**
   * Detect metadata column by matching common naming patterns.
   * 
   * Searches for columns that match any of the provided patterns (case-insensitive).
   * 
   * @param queryResult - Query result to analyze
   * @param patterns - Array of string patterns to match against column names
   * @returns Column name if found, undefined otherwise
   */
  private detectMetadataColumn(queryResult: QueryResult, patterns: string[]): string | undefined {
    if (queryResult.data.length === 0) {
      return undefined;
    }

    const columns = Object.keys(queryResult.data[0]);
    
    // Try exact matches first (case-insensitive)
    for (const pattern of patterns) {
      const match = columns.find(col => col.toLowerCase() === pattern.toLowerCase());
      if (match) {
        return match;
      }
    }

    // Try partial matches
    for (const pattern of patterns) {
      const match = columns.find(col => col.toLowerCase().includes(pattern.toLowerCase()));
      if (match) {
        return match;
      }
    }

    return undefined;
  }

  /**
   * Detect columns that likely contain image data.
   * 
   * Looks for common column naming patterns that indicate image content.
   * 
   * @param queryResult - Query result to analyze
   * @returns Array of column names that likely contain images
   */
  private detectImageColumns(queryResult: QueryResult): string[] {
    if (queryResult.data.length === 0) {
      return [];
    }

    const columns = Object.keys(queryResult.data[0]);
    const imageColumnPatterns = [
      /image/i,
      /img/i,
      /photo/i,
      /picture/i,
      /thumbnail/i,
      /avatar/i,
      /icon/i,
    ];

    return columns.filter(col => 
      imageColumnPatterns.some(pattern => pattern.test(col))
    );
  }

  /**
   * Generate primary visualization (chart) for the data.
   * 
   * Analyzes the data to determine the best chart type and generates
   * an appropriate visualization using Chart.js.
   * 
   * @param queryResult - Query result to visualize
   * @returns HTML string containing the chart, or empty string if no suitable visualization
   */
  private generatePrimaryVisualization(queryResult: QueryResult): string {
    if (queryResult.data.length === 0) {
      return '';
    }

    // Get column names and types
    const firstRow = queryResult.data[0];
    const columns = Object.keys(firstRow);

    // Find numeric columns
    const numericColumns = columns.filter(col => {
      const value = firstRow[col];
      return typeof value === 'number' || !isNaN(Number(value));
    });

    // Find string/categorical columns
    const categoricalColumns = columns.filter(col => {
      const value = firstRow[col];
      return typeof value === 'string' && !this.isDateString(String(value));
    });

    // Need at least one numeric column for visualization
    if (numericColumns.length === 0) {
      return '';
    }

    // Select the best columns for visualization
    const valueColumn = numericColumns[0];
    const labelColumn = categoricalColumns.length > 0 ? categoricalColumns[0] : columns[0];

    // Extract data for chart
    const labels = queryResult.data.slice(0, 20).map(row => String(row[labelColumn] ?? ''));
    const values = queryResult.data.slice(0, 20).map(row => Number(row[valueColumn]) || 0);

    // Determine chart type based on data characteristics
    const chartType = this.selectChartType(queryResult, labelColumn, valueColumn);

    // Generate chart HTML
    return this.generateChartHTML(chartType, labels, values, labelColumn, valueColumn);
  }

  /**
   * Check if a string represents a date.
   */
  private isDateString(value: string): boolean {
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}/, // ISO date
      /^\d{2}\/\d{2}\/\d{4}/, // US date
      /^\d{2}-\d{2}-\d{4}/, // EU date
    ];
    return datePatterns.some(pattern => pattern.test(value));
  }

  /**
   * Select appropriate chart type based on data characteristics.
   */
  private selectChartType(
      queryResult: QueryResult,
      labelColumn: string,
      valueColumn: string,
      options?: { allowGrouped?: boolean; allowStacked?: boolean }
    ): 'bar' | 'line' | 'pie' | 'grouped-bar' | 'stacked-bar' {
      const data = queryResult.data;

      // Check if label column contains dates (time-series data)
      // Requirement 2.2, 7.2: Time-series data uses line or bar charts
      const firstLabel = data[0][labelColumn];
      if (typeof firstLabel === 'string' && this.isDateString(firstLabel)) {
        return 'line'; // Time-series data uses line chart
      }

      // Check for categorical groupings (multiple categorical columns)
      // Requirement 2.3, 7.3: Categorical groupings use grouped or stacked charts
      const columns = Object.keys(data[0]);
      const categoricalColumns = columns.filter(col => {
        const values = data.map(row => row[col]);
        const uniqueValues = new Set(values);
        const isStringColumn = values.some(v => typeof v === 'string');
        const uniqueRatio = uniqueValues.size / values.length;
        return isStringColumn && uniqueRatio < 0.5 && uniqueValues.size > 1 && uniqueValues.size <= 20;
      });

      // If we have multiple categorical columns and grouping is allowed, use grouped/stacked bar
      if (categoricalColumns.length >= 2 && (options?.allowGrouped || options?.allowStacked)) {
        // Use stacked bar for better space efficiency with many categories
        const totalCategories = categoricalColumns.reduce((sum, col) => {
          const uniqueValues = new Set(data.map(row => row[col]));
          return sum + uniqueValues.size;
        }, 0);

        if (totalCategories > 15 || options?.allowStacked) {
          return 'stacked-bar';
        }
        return 'grouped-bar';
      }

      // Check number of unique labels for single categorical column
      const uniqueLabels = new Set(data.map(row => row[labelColumn]));

      // Requirement 2.3, 7.3: If few categories (< 8), use pie chart for categorical data
      if (uniqueLabels.size <= 7) {
        return 'pie';
      }

      // Default to bar chart for categorical data
      return 'bar';
    }

  /**
   * Generate chart HTML using Chart.js.
   */
  /**
     * Generate chart HTML using Chart.js.
     * Supports bar, line, pie, grouped-bar, stacked-bar, and map visualizations.
     * 
     * Requirements 2.2, 2.3, 2.4, 7.2, 7.3, 7.4
     */
    private generateChartHTML(
      chartType: 'bar' | 'line' | 'pie' | 'grouped-bar' | 'stacked-bar' | 'map',
      labels: string[],
      values: number[] | number[][],
      labelColumn: string,
      valueColumn: string,
      options?: {
        groupLabels?: string[];
        groupBy?: string;
        latitudes?: number[];
        longitudes?: number[];
      }
    ): string {
      const colors = [
        'rgba(59, 130, 246, 0.8)',   // blue
        'rgba(16, 185, 129, 0.8)',   // emerald
        'rgba(245, 158, 11, 0.8)',   // amber
        'rgba(239, 68, 68, 0.8)',    // red
        'rgba(139, 92, 246, 0.8)',   // violet
        'rgba(236, 72, 153, 0.8)',   // pink
        'rgba(6, 182, 212, 0.8)',    // cyan
        'rgba(132, 204, 22, 0.8)',   // lime
        'rgba(249, 115, 22, 0.8)',   // orange
        'rgba(99, 102, 241, 0.8)',   // indigo
      ];

      const borderColors = colors.map(c => c.replace('0.8', '1'));

      // Handle map visualizations separately (Requirement 7.4)
      if (chartType === 'map') {
        return this.generateMapHTML(
          options?.latitudes || [],
          options?.longitudes || [],
          values as number[],
          valueColumn
        );
      }

      // Handle grouped and stacked bar charts (Requirement 2.3, 7.3)
      if (chartType === 'grouped-bar' || chartType === 'stacked-bar') {
        return this.generateGroupedChartHTML(
          chartType === 'stacked-bar',
          labels,
          values as number[][],
          options?.groupLabels || [],
          labelColumn,
          valueColumn,
          colors,
          borderColors
        );
      }

      // For pie charts, use multiple colors
      const backgroundColors = chartType === 'pie' 
        ? labels.map((_, i) => colors[i % colors.length])
        : [colors[0]];

      const borderColorsArray = chartType === 'pie'
        ? labels.map((_, i) => borderColors[i % borderColors.length])
        : [borderColors[0]];

      const chartId = `chart-${Math.random().toString(36).substr(2, 9)}`;

      return `
        <div class="chart-wrapper" style="position: relative; height: 400px; margin-bottom: 1rem;">
          <canvas id="${chartId}"></canvas>
        </div>
        <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
        <script>
          (function() {
            const ctx = document.getElementById('${chartId}');
            if (!ctx) return;

            new Chart(ctx, {
              type: '${chartType}',
              data: {
                labels: ${JSON.stringify(labels)},
                datasets: [{
                  label: '${this.escapeHtml(valueColumn)}',
                  data: ${JSON.stringify(values)},
                  backgroundColor: ${JSON.stringify(backgroundColors)},
                  borderColor: ${JSON.stringify(borderColorsArray)},
                  borderWidth: 2,
                  ${chartType === 'line' ? 'tension: 0.3, fill: true, pointRadius: 4, pointHoverRadius: 6,' : ''}
                  ${chartType === 'bar' ? 'borderRadius: 6,' : ''}
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: ${chartType === 'pie'},
                    position: 'bottom'
                  },
                  tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: 12,
                    cornerRadius: 8
                  }
                },
                ${chartType !== 'pie' ? `
                scales: {
                  x: {
                    grid: { display: false },
                    ticks: { maxRotation: 45, minRotation: 0 }
                  },
                  y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)' }
                  }
                }` : ''}
              }
            });
          })();
        </script>
      `;
    }
    /**
     * Generate HTML for grouped or stacked bar charts.
     * Requirement 2.3, 7.3: Categorical groupings use grouped or stacked charts
     */
    private generateGroupedChartHTML(
      stacked: boolean,
      labels: string[],
      datasetValues: number[][],
      groupLabels: string[],
      labelColumn: string,
      valueColumn: string,
      colors: string[],
      borderColors: string[]
    ): string {
      const chartId = `chart-${Math.random().toString(36).substr(2, 9)}`;

      // Create datasets for each group
      const datasets = groupLabels.map((groupLabel, index) => ({
        label: groupLabel,
        data: datasetValues[index] || [],
        backgroundColor: colors[index % colors.length],
        borderColor: borderColors[index % borderColors.length],
        borderWidth: 2,
        borderRadius: 6,
      }));

      return `
        <div class="chart-wrapper" style="position: relative; height: 400px; margin-bottom: 1rem;">
          <canvas id="${chartId}"></canvas>
        </div>
        <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
        <script>
          (function() {
            const ctx = document.getElementById('${chartId}');
            if (!ctx) return;

            new Chart(ctx, {
              type: 'bar',
              data: {
                labels: ${JSON.stringify(labels)},
                datasets: ${JSON.stringify(datasets)}
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: true,
                    position: 'bottom'
                  },
                  tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: 12,
                    cornerRadius: 8
                  }
                },
                scales: {
                  x: {
                    stacked: ${stacked},
                    grid: { display: false },
                    ticks: { maxRotation: 45, minRotation: 0 }
                  },
                  y: {
                    stacked: ${stacked},
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)' }
                  }
                }
              }
            });
          })();
        </script>
      `;
    }

    /**
     * Generate HTML for map visualizations.
     * Requirement 7.4: Geographic data uses map visualizations
     */
    private generateMapHTML(
      latitudes: number[],
      longitudes: number[],
      values: number[],
      valueColumn: string
    ): string {
      const chartId = `map-${Math.random().toString(36).substr(2, 9)}`;

      // Create data points for the map
      const dataPoints = latitudes.map((lat, index) => ({
        lat,
        lon: longitudes[index],
        value: values[index] || 0,
      }));

      // Calculate bounds for the map
      const minLat = Math.min(...latitudes);
      const maxLat = Math.max(...latitudes);
      const minLon = Math.min(...longitudes);
      const maxLon = Math.max(...longitudes);
      const centerLat = (minLat + maxLat) / 2;
      const centerLon = (minLon + maxLon) / 2;

      return `
        <div class="map-wrapper" style="position: relative; height: 400px; margin-bottom: 1rem; background: #f3f4f6; border-radius: 0.5rem; overflow: hidden;">
          <div id="${chartId}" style="width: 100%; height: 100%;"></div>
        </div>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
          (function() {
            const mapElement = document.getElementById('${chartId}');
            if (!mapElement) return;

            // Initialize map
            const map = L.map('${chartId}').setView([${centerLat}, ${centerLon}], 10);

            // Add tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '© OpenStreetMap contributors',
              maxZoom: 18
            }).addTo(map);

            // Add markers for each data point
            const dataPoints = ${JSON.stringify(dataPoints)};
            const maxValue = Math.max(...dataPoints.map(p => p.value));

            dataPoints.forEach(point => {
              const radius = 5 + (point.value / maxValue) * 15;
              const marker = L.circleMarker([point.lat, point.lon], {
                radius: radius,
                fillColor: '#3b82f6',
                color: '#1e40af',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.6
              }).addTo(map);

              marker.bindPopup(\`<b>${this.escapeHtml(valueColumn)}:</b> \${point.value}\`);
            });

            // Fit bounds to show all markers
            if (dataPoints.length > 0) {
              const bounds = L.latLngBounds(dataPoints.map(p => [p.lat, p.lon]));
              map.fitBounds(bounds, { padding: [50, 50] });
            }
          })();
        </script>
      `;
    }

  /**
   * Escape HTML special characters.
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}
