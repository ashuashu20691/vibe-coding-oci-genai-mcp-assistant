// src/services/export-service.ts

import { DashboardLayout, DashboardSection } from '@/types';

/**
 * Result of an export operation.
 */
export interface ExportResult {
  success: boolean;
  content?: string | Blob;
  filename?: string;
  mimeType?: string;
  error?: string;
}

/**
 * Options for PNG export.
 */
export interface PNGExportOptions {
  /** Background color for the PNG (default: white) */
  backgroundColor?: string;
  /** Scale factor for higher resolution (default: 2 for retina) */
  scale?: number;
  /** Padding around the element in pixels (default: 10) */
  padding?: number;
}

/**
 * ExportService provides functionality to export dashboards and data in various formats.
 * Implements Requirements 7.1-7.6 for export capabilities.
 */
export class ExportService {
  /**
   * Static method to export a dashboard as a self-contained HTML file and trigger download.
   * Generates HTML with embedded CSS, JavaScript, and data - no external dependencies.
   * Implements Requirements 7.1, 7.2.
   * 
   * @param dashboard - The dashboard layout configuration
   * @param filename - The name of the file to download (should include .html extension)
   * @param data - Optional data to embed in the HTML (defaults to empty array)
   */
  static exportToHTML(
    dashboard: DashboardLayout,
    filename: string,
    data: Record<string, unknown>[] = []
  ): void {
    if (!dashboard) {
      console.warn('ExportService.exportToHTML: No dashboard to export');
      return;
    }

    const service = new ExportService();
    const htmlContent = service.generateStandaloneHtml(dashboard, data);
    ExportService.triggerDownload(htmlContent, filename, 'text/html;charset=utf-8;');
  }

  /**
   * Static method to export tabular data to CSV and trigger download.
   * Supports both array of objects and 2D array formats.
   * Implements Requirements 7.3, 7.4.
   * 
   * @param data - Either an array of objects (Record<string, unknown>[]) or a 2D array (unknown[][])
   * @param filename - The name of the file to download (should include .csv extension)
   */
  static exportToCSV(data: Record<string, unknown>[] | unknown[][], filename: string): void {
    if (!data || data.length === 0) {
      console.warn('ExportService.exportToCSV: No data to export');
      return;
    }

    const csvContent = ExportService.generateCSVContent(data);
    ExportService.triggerDownload(csvContent, filename, 'text/csv;charset=utf-8;');
  }

  /**
   * Static method to export a DOM element (typically a chart) as a PNG image and trigger download.
   * Converts the element to a canvas and generates a PNG blob.
   * Implements Requirement 7.5.
   * 
   * @param element - The HTMLElement to export (chart container, SVG, or canvas)
   * @param filename - The name of the file to download (should include .png extension)
   * @param options - Optional configuration for the PNG export
   */
  static async exportToPNG(
    element: HTMLElement,
    filename: string,
    options: PNGExportOptions = {}
  ): Promise<void> {
    if (!element) {
      console.warn('ExportService.exportToPNG: No element to export');
      return;
    }

    const {
      backgroundColor = '#ffffff',
      scale = 2,
      padding = 10,
    } = options;

    try {
      const canvas = await ExportService.elementToCanvas(element, { backgroundColor, scale, padding });
      const blob = await ExportService.canvasToBlob(canvas);
      ExportService.triggerBlobDownload(blob, filename);
    } catch (error) {
      console.error('ExportService.exportToPNG: Failed to export', error);
      throw error;
    }
  }

  /**
   * Converts an HTMLElement to a canvas.
   * Handles SVG elements, existing canvas elements, and general DOM elements.
   */
  private static async elementToCanvas(
    element: HTMLElement,
    options: { backgroundColor: string; scale: number; padding: number }
  ): Promise<HTMLCanvasElement> {
    const { backgroundColor, scale, padding } = options;

    // Check if the element contains an SVG (common for chart libraries)
    const svgElement = element.querySelector('svg');
    if (svgElement) {
      return ExportService.svgToCanvas(svgElement as SVGSVGElement, { backgroundColor, scale, padding });
    }

    // Check if the element is or contains a canvas (some chart libraries render to canvas)
    const canvasElement = element instanceof HTMLCanvasElement 
      ? element 
      : element.querySelector('canvas');
    if (canvasElement) {
      return ExportService.cloneCanvas(canvasElement as HTMLCanvasElement, { backgroundColor, scale, padding });
    }

    // Fallback: Create a simple canvas representation
    // For complex DOM elements, html2canvas library would be needed
    return ExportService.createFallbackCanvas(element, { backgroundColor, scale, padding });
  }

  /**
   * Converts an SVG element to a canvas.
   * This is the primary method for chart export since most chart libraries use SVG.
   */
  private static async svgToCanvas(
    svg: SVGSVGElement,
    options: { backgroundColor: string; scale: number; padding: number }
  ): Promise<HTMLCanvasElement> {
    const { backgroundColor, scale, padding } = options;

    // Get SVG dimensions
    const bbox = svg.getBoundingClientRect();
    const width = bbox.width || parseInt(svg.getAttribute('width') || '400');
    const height = bbox.height || parseInt(svg.getAttribute('height') || '300');

    // Create canvas with padding and scale
    const canvas = document.createElement('canvas');
    const totalWidth = (width + padding * 2) * scale;
    const totalHeight = (height + padding * 2) * scale;
    canvas.width = totalWidth;
    canvas.height = totalHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas 2D context');
    }

    // Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    // Clone SVG to avoid modifying the original
    const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
    
    // Ensure SVG has explicit dimensions
    clonedSvg.setAttribute('width', String(width));
    clonedSvg.setAttribute('height', String(height));

    // Inline all computed styles to ensure proper rendering
    ExportService.inlineSvgStyles(clonedSvg);

    // Serialize SVG to string
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clonedSvg);

    // Create a blob URL for the SVG
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    // Load SVG as image and draw to canvas
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        ctx.scale(scale, scale);
        ctx.drawImage(img, padding, padding, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas);
      };
      img.onerror = (error) => {
        URL.revokeObjectURL(url);
        reject(new Error(`Failed to load SVG as image: ${error}`));
      };
      img.src = url;
    });
  }

  /**
   * Inlines computed styles into SVG elements for proper export.
   * This ensures styles are preserved when the SVG is serialized.
   */
  private static inlineSvgStyles(svg: SVGSVGElement): void {
    const elements = svg.querySelectorAll('*');
    elements.forEach((el) => {
      if (el instanceof SVGElement || el instanceof HTMLElement) {
        const computedStyle = window.getComputedStyle(el);
        const importantStyles = [
          'fill', 'stroke', 'stroke-width', 'font-family', 'font-size',
          'font-weight', 'text-anchor', 'dominant-baseline', 'opacity',
          'fill-opacity', 'stroke-opacity'
        ];
        
        importantStyles.forEach((prop) => {
          const value = computedStyle.getPropertyValue(prop);
          if (value && value !== 'none' && value !== '') {
            (el as SVGElement).style.setProperty(prop, value);
          }
        });
      }
    });
  }

  /**
   * Clones an existing canvas element with optional background and padding.
   */
  private static cloneCanvas(
    sourceCanvas: HTMLCanvasElement,
    options: { backgroundColor: string; scale: number; padding: number }
  ): HTMLCanvasElement {
    const { backgroundColor, scale, padding } = options;

    const width = sourceCanvas.width;
    const height = sourceCanvas.height;

    const canvas = document.createElement('canvas');
    canvas.width = (width + padding * 2) * scale;
    canvas.height = (height + padding * 2) * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas 2D context');
    }

    // Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw source canvas with scale and padding
    ctx.scale(scale, scale);
    ctx.drawImage(sourceCanvas, padding, padding);

    return canvas;
  }

  /**
   * Creates a fallback canvas for elements that are neither SVG nor canvas.
   * This provides basic text representation - for full DOM rendering, html2canvas would be needed.
   */
  private static createFallbackCanvas(
    element: HTMLElement,
    options: { backgroundColor: string; scale: number; padding: number }
  ): HTMLCanvasElement {
    const { backgroundColor, scale, padding } = options;

    const bbox = element.getBoundingClientRect();
    const width = bbox.width || 400;
    const height = bbox.height || 300;

    const canvas = document.createElement('canvas');
    canvas.width = (width + padding * 2) * scale;
    canvas.height = (height + padding * 2) * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas 2D context');
    }

    // Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add a message indicating this is a fallback
    ctx.scale(scale, scale);
    ctx.fillStyle = '#666666';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      'Chart exported from ' + (element.getAttribute('data-chart-title') || 'visualization'),
      (width + padding * 2) / 2,
      (height + padding * 2) / 2
    );

    return canvas;
  }

  /**
   * Converts a canvas to a PNG blob.
   */
  private static canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create PNG blob from canvas'));
          }
        },
        'image/png',
        1.0
      );
    });
  }

  /**
   * Triggers a file download from a Blob.
   */
  private static triggerBlobDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Generates CSV content from data.
   * Handles both array of objects and 2D array formats.
   * Implements Requirement 7.4 for proper escaping.
   */
  private static generateCSVContent(data: Record<string, unknown>[] | unknown[][]): string {
    // Check if data is a 2D array
    if (Array.isArray(data[0]) && !ExportService.isRecordArray(data)) {
      return ExportService.generate2DArrayCSV(data as unknown[][]);
    }
    
    // Data is an array of objects
    return ExportService.generateObjectArrayCSV(data as Record<string, unknown>[]);
  }

  /**
   * Type guard to check if data is an array of Record objects.
   */
  private static isRecordArray(data: unknown[]): data is Record<string, unknown>[] {
    if (data.length === 0) return false;
    const firstItem = data[0];
    return typeof firstItem === 'object' && firstItem !== null && !Array.isArray(firstItem);
  }

  /**
   * Generates CSV from a 2D array.
   * First row is treated as headers if it contains strings.
   */
  private static generate2DArrayCSV(data: unknown[][]): string {
    const lines: string[] = [];
    
    for (const row of data) {
      const escapedValues = row.map(cell => ExportService.escapeCSVValue(cell));
      lines.push(escapedValues.join(','));
    }
    
    return lines.join('\n');
  }

  /**
   * Generates CSV from an array of objects.
   * Keys from the first object are used as headers.
   */
  private static generateObjectArrayCSV(data: Record<string, unknown>[]): string {
    if (data.length === 0) return '';
    
    // Get all unique keys from all objects to handle sparse data
    const allKeys = new Set<string>();
    for (const row of data) {
      Object.keys(row).forEach(key => allKeys.add(key));
    }
    const columns = Array.from(allKeys);
    
    const lines: string[] = [];
    
    // Header row
    lines.push(columns.map(col => ExportService.escapeCSVValue(col)).join(','));
    
    // Data rows
    for (const row of data) {
      const values = columns.map(col => ExportService.escapeCSVValue(row[col]));
      lines.push(values.join(','));
    }
    
    return lines.join('\n');
  }

  /**
   * Escapes a value for CSV format.
   * Handles commas, quotes, newlines, and various data types.
   * Implements Requirement 7.4 for proper escaping.
   */
  private static escapeCSVValue(value: unknown): string {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return '';
    }
    
    // Convert to string
    let stringValue: string;
    if (typeof value === 'object') {
      stringValue = JSON.stringify(value);
    } else {
      stringValue = String(value);
    }
    
    // Check if escaping is needed (contains comma, quote, newline, or carriage return)
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
      // Escape quotes by doubling them and wrap in quotes
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    
    return stringValue;
  }

  /**
   * Triggers a file download in the browser.
   * Creates a blob and uses a temporary anchor element to initiate download.
   */
  private static triggerDownload(content: string, filename: string, mimeType: string): void {
    // Create blob with BOM for Excel compatibility
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + content], { type: mimeType });
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Exports dashboard as standalone HTML with embedded CSS/JS.
   * Implements Requirements 7.1 and 7.2.
   */
  exportAsHtml(
    dashboard: DashboardLayout,
    data: Record<string, unknown>[]
  ): ExportResult {
    try {
      const html = this.generateStandaloneHtml(dashboard, data);
      return {
        success: true,
        content: html,
        filename: `${this.sanitizeFilename(dashboard.title)}.html`,
        mimeType: 'text/html',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Exports data as CSV with proper escaping.
   * Implements Requirements 7.3, 7.4.
   */
  exportAsCsv(
    data: Record<string, unknown>[],
    filename?: string
  ): ExportResult {
    try {
      if (data.length === 0) {
        return { success: false, error: 'No data to export' };
      }

      const csv = this.generateCsv(data);
      return {
        success: true,
        content: csv,
        filename: filename || 'data-export.csv',
        mimeType: 'text/csv',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Exports a chart element as PNG.
   * Implements Requirement 7.5.
   * 
   * @param element - The HTMLElement containing the chart (SVG or canvas)
   * @param filename - Optional filename (defaults to 'chart-export.png')
   * @param options - Optional PNG export options
   * @returns Promise<ExportResult> with the PNG blob on success
   */
  async exportAsPng(
    element: HTMLElement,
    filename?: string,
    options: PNGExportOptions = {}
  ): Promise<ExportResult> {
    try {
      if (!element) {
        return { success: false, error: 'No element to export' };
      }

      const {
        backgroundColor = '#ffffff',
        scale = 2,
        padding = 10,
      } = options;

      const canvas = await ExportService.elementToCanvas(element, { backgroundColor, scale, padding });
      const blob = await ExportService.canvasToBlob(canvas);

      return {
        success: true,
        content: blob,
        filename: filename || 'chart-export.png',
        mimeType: 'image/png',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Generates standalone HTML with embedded CSS and JS.
   * Implements Requirements 7.1, 7.2.
   */
  private generateStandaloneHtml(
    dashboard: DashboardLayout,
    data: Record<string, unknown>[]
  ): string {
    const dataJson = JSON.stringify(data);
    const dashboardJson = JSON.stringify(dashboard);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(dashboard.title)}</title>
  <style>
    ${this.getEmbeddedCss()}
  </style>
</head>
<body>
  <div class="dashboard-container">
    <header class="dashboard-header">
      <h1>${this.escapeHtml(dashboard.title)}</h1>
      <p class="description">${this.escapeHtml(dashboard.description)}</p>
    </header>
    
    <div class="dashboard-content">
      ${this.generateSectionsHtml(dashboard.sections, data)}
    </div>
    
    <footer class="dashboard-footer">
      <p>Generated on ${new Date().toLocaleString()}</p>
    </footer>
  </div>
  
  <script>
    ${this.getEmbeddedJs()}
    
    // Initialize dashboard with data
    const dashboardData = ${dataJson};
    const dashboardConfig = ${dashboardJson};
    
    document.addEventListener('DOMContentLoaded', function() {
      initializeDashboard(dashboardData, dashboardConfig);
    });
  </script>
</body>
</html>`;
  }

  /**
   * Generates HTML for dashboard sections.
   */
  private generateSectionsHtml(
    sections: DashboardSection[],
    data: Record<string, unknown>[]
  ): string {
    return sections.map(section => {
      const widthClass = section.width === 'full' ? 'section-full' : 
                         section.width === 'half' ? 'section-half' : 'section-third';
      
      let contentHtml = '';
      
      if (section.type === 'stats' && section.content.statsCards) {
        contentHtml = this.generateStatsCardsHtml(section.content.statsCards);
      } else if (section.type === 'table' && section.content.tableConfig) {
        contentHtml = this.generateTableHtml(data, section.content.tableConfig.columns);
      } else if (section.type === 'insights' && section.content.insights) {
        contentHtml = this.generateInsightsHtml(section.content.insights);
      } else if (section.type === 'visualization') {
        contentHtml = `<div class="chart-placeholder" data-viz-type="${section.content.visualization?.type || 'table'}">
          <p>Visualization: ${section.content.visualization?.title || 'Chart'}</p>
        </div>`;
      }
      
      return `
        <section class="dashboard-section ${widthClass}" id="${section.id}">
          <h2>${this.escapeHtml(section.title)}</h2>
          <div class="section-content">
            ${contentHtml}
          </div>
        </section>
      `;
    }).join('\n');
  }

  /**
   * Generates HTML for stats cards.
   */
  private generateStatsCardsHtml(
    statsCards: Array<{ label: string; value: string | number; color: string }>
  ): string {
    return `
      <div class="stats-grid">
        ${statsCards.map(card => `
          <div class="stat-card stat-${card.color}">
            <div class="stat-value">${card.value}</div>
            <div class="stat-label">${this.escapeHtml(card.label)}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Generates HTML for data table.
   */
  private generateTableHtml(
    data: Record<string, unknown>[],
    columns: string[]
  ): string {
    if (data.length === 0) return '<p>No data available</p>';
    
    const cols = columns.length > 0 ? columns : Object.keys(data[0]);
    
    return `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              ${cols.map(col => `<th>${this.escapeHtml(col)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${data.slice(0, 100).map(row => `
              <tr>
                ${cols.map(col => `<td>${this.escapeHtml(String(row[col] ?? ''))}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${data.length > 100 ? `<p class="table-note">Showing first 100 of ${data.length} rows</p>` : ''}
      </div>
    `;
  }

  /**
   * Generates HTML for insights.
   */
  private generateInsightsHtml(insights: string[]): string {
    return `
      <ul class="insights-list">
        ${insights.map(insight => `<li>${this.escapeHtml(insight)}</li>`).join('')}
      </ul>
    `;
  }

  /**
   * Generates CSV with proper escaping.
   * Implements Requirements 7.3, 7.4.
   */
  private generateCsv(data: Record<string, unknown>[]): string {
    return ExportService.generateObjectArrayCSV(data);
  }

  /**
   * Escapes HTML special characters.
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
   * Sanitizes a string for use as a filename.
   */
  private sanitizeFilename(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50) || 'export';
  }

  /**
   * Returns embedded CSS for standalone HTML.
   * Implements Requirement 7.2 for standalone viewing.
   */
  private getEmbeddedCss(): string {
    return `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; line-height: 1.6; }
      .dashboard-container { max-width: 1400px; margin: 0 auto; padding: 20px; }
      .dashboard-header { text-align: center; margin-bottom: 30px; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
      .dashboard-header h1 { font-size: 2rem; margin-bottom: 10px; }
      .description { color: #666; }
      .dashboard-content { display: flex; flex-wrap: wrap; gap: 20px; }
      .dashboard-section { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
      .section-full { width: 100%; }
      .section-half { width: calc(50% - 10px); }
      .section-third { width: calc(33.333% - 14px); }
      .dashboard-section h2 { font-size: 1.25rem; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee; }
      .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
      .stat-card { padding: 20px; border-radius: 8px; text-align: center; }
      .stat-blue { background: #e3f2fd; color: #1565c0; }
      .stat-green { background: #e8f5e9; color: #2e7d32; }
      .stat-red { background: #ffebee; color: #c62828; }
      .stat-orange { background: #fff3e0; color: #ef6c00; }
      .stat-gray { background: #f5f5f5; color: #616161; }
      .stat-value { font-size: 2rem; font-weight: bold; }
      .stat-label { font-size: 0.875rem; margin-top: 5px; }
      .table-container { overflow-x: auto; }
      .data-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
      .data-table th, .data-table td { padding: 10px; text-align: left; border-bottom: 1px solid #eee; }
      .data-table th { background: #f5f5f5; font-weight: 600; }
      .data-table tr:hover { background: #fafafa; }
      .table-note { margin-top: 10px; font-size: 0.75rem; color: #666; }
      .insights-list { list-style: none; }
      .insights-list li { padding: 10px; margin-bottom: 8px; background: #f9f9f9; border-radius: 4px; border-left: 3px solid #2196f3; }
      .chart-placeholder { padding: 40px; text-align: center; background: #f9f9f9; border-radius: 4px; color: #666; }
      .dashboard-footer { text-align: center; margin-top: 30px; padding: 20px; color: #666; font-size: 0.875rem; }
      @media (max-width: 768px) { .section-half, .section-third { width: 100%; } }
    `;
  }

  /**
   * Returns embedded JavaScript for standalone HTML.
   * Implements Requirement 7.2 for maintaining interactivity.
   */
  private getEmbeddedJs(): string {
    return `
      function initializeDashboard(data, config) {
        console.log('Dashboard initialized with', data.length, 'records');
        
        // Add sorting to tables
        document.querySelectorAll('.data-table th').forEach((th, index) => {
          th.style.cursor = 'pointer';
          th.addEventListener('click', () => sortTable(th.closest('table'), index));
        });
        
        // Add search functionality
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
          searchInput.addEventListener('input', (e) => filterTable(e.target.value));
        }
      }
      
      function sortTable(table, columnIndex) {
        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const isAsc = table.dataset.sortDir !== 'asc';
        
        rows.sort((a, b) => {
          const aVal = a.cells[columnIndex].textContent;
          const bVal = b.cells[columnIndex].textContent;
          const aNum = parseFloat(aVal);
          const bNum = parseFloat(bVal);
          
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return isAsc ? aNum - bNum : bNum - aNum;
          }
          return isAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        });
        
        table.dataset.sortDir = isAsc ? 'asc' : 'desc';
        rows.forEach(row => tbody.appendChild(row));
      }
      
      function filterTable(searchTerm) {
        const tables = document.querySelectorAll('.data-table');
        const term = searchTerm.toLowerCase();
        
        tables.forEach(table => {
          const rows = table.querySelectorAll('tbody tr');
          rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
          });
        });
      }
    `;
  }
}
