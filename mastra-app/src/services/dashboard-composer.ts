// src/services/dashboard-composer.ts

import {
  AnalysisCategory,
  DataProfile,
  DashboardLayout,
  DashboardSection,
  DashboardFilter,
  ExportOption,
} from '@/types';
import { SelectionResult } from './visualization-selector';

/**
 * DashboardComposer assembles multiple visualizations into cohesive, interactive dashboards.
 * Implements Requirements 6.1-6.6 for interactive dashboard composition.
 */
export class DashboardComposer {
  /**
   * Composes a complete dashboard layout from visualization selection results.
   * Implements Requirement 6.1: Combine multiple relevant visualizations into a unified view.
   */
  compose(
    selectionResult: SelectionResult,
    data: Record<string, unknown>[],
    profile: DataProfile,
    categories: AnalysisCategory[]
  ): DashboardLayout {
    const sections: DashboardSection[] = [];

    // Stats section (Requirement 6.2, 6.3)
    if (selectionResult.statsCards.length > 0) {
      sections.push({
        id: 'stats',
        title: 'Key Metrics',
        type: 'stats',
        width: 'full',
        content: { statsCards: selectionResult.statsCards },
      });
    }

    // Primary visualization
    sections.push({
      id: 'primary-viz',
      title: selectionResult.primary.title,
      type: 'visualization',
      width: 'full',
      content: { visualization: selectionResult.primary },
    });

    // Secondary visualizations (limit to 3 for layout)
    for (let i = 0; i < Math.min(selectionResult.secondary.length, 3); i++) {
      const viz = selectionResult.secondary[i];
      sections.push({
        id: `secondary-viz-${i}`,
        title: viz.title,
        type: 'visualization',
        width: selectionResult.secondary.length === 1 ? 'full' : 'half',
        content: { visualization: viz },
      });
    }

    // Insights section (Requirement 6.2, 6.3)
    const insights = this.generateInsights(profile, categories);
    if (insights.length > 0) {
      sections.push({
        id: 'insights',
        title: 'Key Insights',
        type: 'insights',
        width: 'full',
        content: { insights },
      });
    }

    // Data table section (Requirement 6.3)
    sections.push({
      id: 'data-table',
      title: 'Detailed Data',
      type: 'table',
      width: 'full',
      content: {
        tableConfig: {
          columns: data.length > 0 ? Object.keys(data[0]) : [],
          pageSize: 20,
        },
      },
    });

    // Generate filters (Requirement 6.5)
    const filters = this.generateFilters(data, categories);

    // Generate export options (Requirement 6.6)
    const exportOptions = this.generateExportOptions();

    return {
      title: this.generateTitle(categories),
      description: this.generateDescription(profile, categories),
      sections,
      filters,
      exportOptions,
    };
  }

  /**
   * Generates a dashboard title based on analysis categories.
   * Implements Requirement 6.2, 6.3, 6.4 for category-specific dashboards.
   */
  private generateTitle(categories: AnalysisCategory[]): string {
    if (categories.includes('fraud_detection')) {
      return 'Fraud Detection Analysis Dashboard';
    }
    if (categories.includes('geographic_analysis')) {
      return 'Geographic Analysis Dashboard';
    }
    if (categories.includes('similarity_search')) {
      return 'Similarity Search Results';
    }
    if (categories.includes('time_series')) {
      return 'Time Series Analysis Dashboard';
    }
    if (categories.includes('anomaly_detection')) {
      return 'Anomaly Detection Dashboard';
    }
    if (categories.includes('categorical_comparison')) {
      return 'Categorical Comparison Dashboard';
    }
    return 'Data Analysis Dashboard';
  }

  /**
   * Generates a dashboard description from data profile.
   */
  private generateDescription(profile: DataProfile, _categories: AnalysisCategory[]): string {
    const parts: string[] = [`Analyzing ${profile.recordCount.toLocaleString()} records`];

    if (profile.anomalyCount !== undefined) {
      parts.push(`${profile.anomalyCount} flagged for review`);
    }

    if (profile.geographicSpread) {
      parts.push('with geographic distribution');
    }

    if (profile.timeRange) {
      parts.push(
        `from ${profile.timeRange.start.toLocaleDateString()} to ${profile.timeRange.end.toLocaleDateString()}`
      );
    }

    return parts.join(' • ');
  }

  /**
   * Generates insights from data profile.
   * Implements Requirement 6.2 for fraud detection insights.
   */
  private generateInsights(profile: DataProfile, _categories: AnalysisCategory[]): string[] {
    const insights: string[] = [];

    // Anomaly rate insight
    if (profile.anomalyCount !== undefined && profile.recordCount > 0) {
      const rate = (profile.anomalyCount / profile.recordCount) * 100;
      if (rate > 10) {
        insights.push(`⚠️ High anomaly rate detected: ${rate.toFixed(1)}% of records flagged`);
      } else {
        insights.push(`✅ Anomaly rate within normal range: ${rate.toFixed(1)}%`);
      }
    }

    // Column variability insights
    for (const stat of profile.columnStats) {
      if (stat.stdDev !== undefined && stat.mean !== undefined && stat.mean !== 0) {
        const cv = (stat.stdDev / Math.abs(stat.mean)) * 100;
        if (cv > 100) {
          insights.push(
            `📊 High variability in ${stat.columnName}: coefficient of variation ${cv.toFixed(0)}%`
          );
        }
      }
    }

    // Geographic spread insight
    if (profile.geographicSpread) {
      const latSpread = profile.geographicSpread.maxLat - profile.geographicSpread.minLat;
      const lonSpread = profile.geographicSpread.maxLon - profile.geographicSpread.minLon;
      if (latSpread > 30 || lonSpread > 30) {
        insights.push(`🌍 Data spans a wide geographic area`);
      } else {
        insights.push(`📍 Data concentrated in a specific region`);
      }
    }

    // Time range insight
    if (profile.timeRange) {
      const daysDiff = Math.ceil(
        (profile.timeRange.end.getTime() - profile.timeRange.start.getTime()) / (1000 * 60 * 60 * 24)
      );
      insights.push(`📅 Data covers ${daysDiff} days`);
    }

    return insights;
  }

  /**
   * Generates interactive filters from data columns.
   * Implements Requirement 6.5 for interactive filters that update all visualizations.
   */
  private generateFilters(
    data: Record<string, unknown>[],
    categories: AnalysisCategory[]
  ): DashboardFilter[] {
    const filters: DashboardFilter[] = [];

    if (data.length === 0) return filters;

    const keys = Object.keys(data[0]);

    // Add categorical filters (select dropdowns)
    for (const key of keys) {
      const values = data.map((r) => r[key]);
      const uniqueValues = [...new Set(values.filter((v) => typeof v === 'string'))] as string[];

      // Only create select filter if there are 2-20 unique values
      if (uniqueValues.length > 1 && uniqueValues.length <= 20) {
        filters.push({
          id: `filter-${key.toLowerCase().replace(/\s+/g, '-')}`,
          label: this.formatColumnLabel(key),
          type: 'select',
          column: key,
          options: uniqueValues,
        });
      }
    }

    // Add risk score range filter for fraud detection (Requirement 6.2)
    if (categories.includes('fraud_detection')) {
      const riskCol = keys.find((k) => k.toUpperCase().includes('RISK_SCORE'));
      if (riskCol) {
        filters.push({
          id: 'filter-risk',
          label: 'Risk Score Range',
          type: 'range',
          column: riskCol,
        });
      }
    }

    // Add date filter for time series data
    const dateCol = keys.find(
      (k) => k.toLowerCase().includes('date') || k.toLowerCase().includes('time') || k.toLowerCase() === 'created_at'
    );
    if (dateCol) {
      filters.push({
        id: 'filter-date',
        label: 'Date Range',
        type: 'date',
        column: dateCol,
      });
    }

    // Add search filter (always available)
    filters.push({
      id: 'filter-search',
      label: 'Search',
      type: 'search',
      column: '*',
    });

    return filters;
  }

  /**
   * Formats a column name into a human-readable label.
   */
  private formatColumnLabel(columnName: string): string {
    return columnName
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Generates export options configuration.
   * Implements Requirement 6.6 for data export capabilities.
   */
  private generateExportOptions(): ExportOption[] {
    return [
      { format: 'html', label: 'Export as HTML' },
      { format: 'csv', label: 'Export as CSV' },
      { format: 'png', label: 'Export Charts as PNG' },
    ];
  }
}
