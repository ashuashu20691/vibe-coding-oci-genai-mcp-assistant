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
import { exportDashboardToExcel, exportDashboardToHTML } from './dashboard-export-integration';

/**
 * Performance grade color mapping for conditional formatting.
 * Implements Requirement 9.4: Color-coded performance indicators.
 */
export const PERFORMANCE_COLORS = {
  A: '#4caf50', // Green
  B: '#4caf50', // Green
  C: '#ffc107', // Yellow
  D: '#f44336', // Red
  F: '#f44336', // Red
} as const;

/**
 * Number formatting configuration for different metric types.
 * Implements Requirement 9.3: Number formatting with precision.
 */
export interface NumberFormatConfig {
  type: 'percentage' | 'currency' | 'count' | 'decimal';
  precision?: number;
  currency?: string;
}

/**
 * Image embedding configuration for HTML output.
 * Implements Requirement 9.2: Image embedding with alt text.
 */
export interface ImageEmbedConfig {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  caption?: string;
}

/**
 * DashboardComposer assembles multiple visualizations into cohesive, interactive dashboards.
 * Implements Requirements 6.1-6.6 for interactive dashboard composition.
 * Enhanced for Requirements 9.1-9.5 for professional HTML dashboard generation.
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

  /**
   * Generates responsive HTML layout with proper viewport and media queries.
   * Implements Requirement 9.1: Responsive layout generation.
   * 
   * @param content - The HTML content to wrap in responsive layout
   * @param title - The dashboard title
   * @returns Complete HTML with responsive meta tags and CSS
   */
  generateResponsiveLayout(content: string, title: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${this.escapeHtml(title)} - Professional Data Dashboard">
  <title>${this.escapeHtml(title)}</title>
  <style>
    ${this.getResponsiveCSS()}
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
  }

  /**
   * Generates responsive CSS with mobile-first approach.
   * Implements Requirement 9.1: Responsive layouts that work across devices.
   */
  private getResponsiveCSS(): string {
    return `
      /* Reset and base styles */
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        background: #f5f7fa;
        padding: 1rem;
      }
      
      /* Container with max-width for large screens */
      .dashboard-container {
        max-width: 1400px;
        margin: 0 auto;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }
      
      /* Header with clear visual hierarchy */
      .dashboard-header {
        padding: 2rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        text-align: center;
      }
      
      .dashboard-header h1 {
        font-size: 2rem;
        font-weight: 700;
        margin-bottom: 0.5rem;
      }
      
      .dashboard-header .description {
        font-size: 1rem;
        opacity: 0.95;
      }
      
      /* Section layout with clear hierarchy */
      .dashboard-section {
        padding: 2rem;
        border-bottom: 1px solid #e5e7eb;
      }
      
      .dashboard-section:last-child {
        border-bottom: none;
      }
      
      .section-header {
        margin-bottom: 1.5rem;
        padding-bottom: 0.75rem;
        border-bottom: 2px solid #667eea;
      }
      
      .section-header h2 {
        font-size: 1.5rem;
        font-weight: 600;
        color: #1f2937;
      }
      
      /* Grid layout for responsive content */
      .content-grid {
        display: grid;
        gap: 1.5rem;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      }
      
      /* Image embedding with proper aspect ratio */
      .embedded-image {
        max-width: 100%;
        height: auto;
        border-radius: 4px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }
      
      .image-container {
        margin: 1rem 0;
        text-align: center;
      }
      
      .image-caption {
        margin-top: 0.5rem;
        font-size: 0.875rem;
        color: #6b7280;
        font-style: italic;
      }
      
      /* Performance indicators with color coding */
      .performance-grade {
        display: inline-block;
        padding: 0.25rem 0.75rem;
        border-radius: 4px;
        font-weight: 600;
        font-size: 0.875rem;
      }
      
      .grade-a, .grade-b {
        background-color: #d1fae5;
        color: #065f46;
      }
      
      .grade-c {
        background-color: #fef3c7;
        color: #92400e;
      }
      
      .grade-d, .grade-f {
        background-color: #fee2e2;
        color: #991b1b;
      }
      
      /* Number formatting with proper alignment */
      .metric-value {
        font-size: 1.25rem;
        font-weight: 600;
        color: #1f2937;
      }
      
      .metric-label {
        font-size: 0.875rem;
        color: #6b7280;
        margin-top: 0.25rem;
      }
      
      /* Table styling with responsive overflow */
      .table-container {
        overflow-x: auto;
        margin: 1rem 0;
        border-radius: 4px;
        border: 1px solid #e5e7eb;
      }
      
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;
      }
      
      th, td {
        padding: 0.75rem 1rem;
        text-align: left;
        border-bottom: 1px solid #e5e7eb;
      }
      
      th {
        background-color: #f9fafb;
        font-weight: 600;
        color: #374151;
      }
      
      tr:hover {
        background-color: #f9fafb;
      }
      
      /* Responsive breakpoints */
      @media (max-width: 768px) {
        body { padding: 0.5rem; }
        .dashboard-header { padding: 1.5rem 1rem; }
        .dashboard-header h1 { font-size: 1.5rem; }
        .dashboard-section { padding: 1.5rem 1rem; }
        .section-header h2 { font-size: 1.25rem; }
        .content-grid { grid-template-columns: 1fr; }
      }
      
      @media (max-width: 480px) {
        .dashboard-header h1 { font-size: 1.25rem; }
        .section-header h2 { font-size: 1.125rem; }
        th, td { padding: 0.5rem; font-size: 0.8125rem; }
      }
      
      /* Print styles */
      @media print {
        body { background: white; padding: 0; }
        .dashboard-container { box-shadow: none; }
        .dashboard-section { page-break-inside: avoid; }
      }
    `;
  }

  /**
   * Embeds an image in HTML with proper alt text and responsive sizing.
   * Implements Requirement 9.2: Image embedding with alt text.
   * 
   * @param config - Image embedding configuration
   * @returns HTML string with properly formatted image tag
   */
  embedImage(config: ImageEmbedConfig): string {
    const { src, alt, width, height, caption } = config;
    
    // Validate alt text is provided (accessibility requirement)
    if (!alt || alt.trim() === '') {
      console.warn('Image embedded without alt text - accessibility issue');
    }
    
    const widthAttr = width ? ` width="${width}"` : '';
    const heightAttr = height ? ` height="${height}"` : '';
    
    let html = `<div class="image-container">
  <img src="${this.escapeHtml(src)}" alt="${this.escapeHtml(alt)}"${widthAttr}${heightAttr} class="embedded-image" loading="lazy">`;
    
    if (caption) {
      html += `\n  <p class="image-caption">${this.escapeHtml(caption)}</p>`;
    }
    
    html += '\n</div>';
    
    return html;
  }

  /**
   * Formats a number with appropriate precision based on type.
   * Implements Requirement 9.3: Number formatting with precision.
   * 
   * @param value - The numeric value to format
   * @param config - Formatting configuration
   * @returns Formatted string representation
   */
  formatNumber(value: number, config: NumberFormatConfig): string {
    const { type, precision, currency = 'USD' } = config;
    
    switch (type) {
      case 'percentage':
        // Percentages: 1-2 decimal places
        const pctPrecision = precision ?? 1;
        return `${value.toFixed(pctPrecision)}%`;
      
      case 'currency':
        // Currency: 2 decimal places
        const currencyPrecision = precision ?? 2;
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
          minimumFractionDigits: currencyPrecision,
          maximumFractionDigits: currencyPrecision,
        }).format(value);
      
      case 'count':
        // Counts: 0 decimal places with thousand separators
        return new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(value);
      
      case 'decimal':
        // Decimals: configurable precision (default 2)
        const decimalPrecision = precision ?? 2;
        return new Intl.NumberFormat('en-US', {
          minimumFractionDigits: decimalPrecision,
          maximumFractionDigits: decimalPrecision,
        }).format(value);
      
      default:
        return String(value);
    }
  }

  /**
   * Generates HTML for a performance grade with color coding.
   * Implements Requirement 9.4: Color-coded performance indicators (Green/Yellow/Red).
   * 
   * @param grade - Performance grade (A, B, C, D, F)
   * @param label - Optional label to display alongside grade
   * @returns HTML string with color-coded grade indicator
   */
  generatePerformanceGrade(grade: 'A' | 'B' | 'C' | 'D' | 'F', label?: string): string {
    const gradeClass = `grade-${grade.toLowerCase()}`;
    const displayText = label ? `${grade} - ${label}` : grade;
    
    return `<span class="performance-grade ${gradeClass}">${this.escapeHtml(displayText)}</span>`;
  }

  /**
   * Generates a complete HTML section with header and content.
   * Implements Requirement 9.5: Clear section headers and visual hierarchy.
   * 
   * @param title - Section title
   * @param content - Section content HTML
   * @param id - Optional section ID for navigation
   * @returns Complete section HTML with proper hierarchy
   */
  generateSection(title: string, content: string, id?: string): string {
    const idAttr = id ? ` id="${this.escapeHtml(id)}"` : '';
    
    return `<section class="dashboard-section"${idAttr}>
  <div class="section-header">
    <h2>${this.escapeHtml(title)}</h2>
  </div>
  <div class="section-content">
    ${content}
  </div>
</section>`;
  }

  /**
   * Generates a metric display with formatted value and label.
   * Implements Requirements 9.3 and 9.5: Number formatting and visual hierarchy.
   * 
   * @param label - Metric label
   * @param value - Numeric value
   * @param formatConfig - Number formatting configuration
   * @returns HTML string with formatted metric
   */
  generateMetric(label: string, value: number, formatConfig: NumberFormatConfig): string {
    const formattedValue = this.formatNumber(value, formatConfig);
    
    return `<div class="metric">
  <div class="metric-value">${this.escapeHtml(formattedValue)}</div>
  <div class="metric-label">${this.escapeHtml(label)}</div>
</div>`;
  }

  /**
   * Generates a data table with optional performance grade column.
   * Implements Requirements 9.3, 9.4, 9.5: Formatting, color coding, and hierarchy.
   * 
   * @param data - Array of data objects
   * @param columns - Column names to display
   * @param gradeColumn - Optional column name containing performance grades
   * @returns HTML string with formatted table
   */
  generateDataTable(
    data: Record<string, unknown>[],
    columns: string[],
    gradeColumn?: string
  ): string {
    if (data.length === 0) {
      return '<p>No data available</p>';
    }
    
    const cols = columns.length > 0 ? columns : Object.keys(data[0]);
    
    let html = '<div class="table-container">\n  <table>\n    <thead>\n      <tr>\n';
    
    // Generate header row
    for (const col of cols) {
      html += `        <th>${this.escapeHtml(col)}</th>\n`;
    }
    html += '      </tr>\n    </thead>\n    <tbody>\n';
    
    // Generate data rows
    for (const row of data) {
      html += '      <tr>\n';
      for (const col of cols) {
        const value = row[col];
        let cellContent: string;
        
        // Apply performance grade formatting if this is the grade column
        if (col === gradeColumn && typeof value === 'string' && /^[A-F]$/.test(value)) {
          cellContent = this.generatePerformanceGrade(value as 'A' | 'B' | 'C' | 'D' | 'F');
        } else if (typeof value === 'number') {
          // Format numbers with appropriate precision
          cellContent = this.escapeHtml(this.formatNumber(value, { type: 'decimal', precision: 2 }));
        } else {
          cellContent = this.escapeHtml(String(value ?? ''));
        }
        
        html += `        <td>${cellContent}</td>\n`;
      }
      html += '      </tr>\n';
    }
    
    html += '    </tbody>\n  </table>\n</div>';
    
    return html;
  }

  /**
   * Escapes HTML special characters to prevent XSS.
   * 
   * @param text - Text to escape
   * @returns Escaped text safe for HTML
   */
  private escapeHtml(text: string): string {
    const htmlEntities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, char => htmlEntities[char] || char);
  }

  /**
   * Export dashboard to Excel with formatting preservation
   * Requirement 10.1: Connect dashboard generation to Excel export
   * Requirement 10.2: Preserve formatting in exports
   * Requirement 10.3: Handle image and chart embedding
   * Requirement 10.4: Apply conditional formatting
   * 
   * @param dashboard - Dashboard layout to export
   * @param data - Raw data used in the dashboard
   * @param filename - Output filename (default: 'dashboard-export.xlsx')
   */
  async exportToExcel(
    dashboard: DashboardLayout,
    data: Record<string, unknown>[],
    filename: string = 'dashboard-export.xlsx'
  ): Promise<void> {
    await exportDashboardToExcel(dashboard, data, filename);
  }

  /**
   * Export dashboard to HTML
   * Requirement 10.1: Connect dashboard generation to HTML export
   * 
   * @param dashboard - Dashboard layout to export
   * @param data - Raw data used in the dashboard
   * @param filename - Output filename (default: 'dashboard-export.html')
   */
  exportToHTML(
    dashboard: DashboardLayout,
    data: Record<string, unknown>[],
    filename: string = 'dashboard-export.html'
  ): void {
    exportDashboardToHTML(dashboard, data, filename);
  }
}
