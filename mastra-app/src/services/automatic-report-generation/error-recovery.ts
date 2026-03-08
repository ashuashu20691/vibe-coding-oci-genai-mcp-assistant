/**
 * Error Recovery Strategies for Automatic Report Generation
 * 
 * Provides fallback mechanisms for various types of report generation failures,
 * ensuring that users always receive some form of data presentation even when
 * visualization or export operations fail.
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import type { QueryResult } from '../query-engine';
import type { 
  ErrorRecoveryStrategy, 
  FallbackResult,
  ReportGenerationResult 
} from './types';
import { logger } from '@/lib/logger';

/**
 * ErrorRecoveryService provides fallback strategies for report generation failures.
 * 
 * This service implements graceful degradation, ensuring that even when advanced
 * features like visualization or HTML generation fail, users still receive their
 * data in a usable format.
 * 
 * Requirements:
 * - 9.1: Graceful failure fallback to text-based presentation
 * - 9.2: Chart rendering failure fallback to data tables
 * - 9.3: Export failure fallback with error messages
 * - 9.4: Error logging with context and stack traces
 * - 9.5: Unsupported data type handling
 */
export class ErrorRecoveryService {
  private contextLogger = logger.withContext({ 
    component: 'ErrorRecoveryService' 
  });
  /**
   * Get appropriate error recovery strategy based on error type.
   * 
   * Validates: Requirement 9.4
   * 
   * @param errorType - Type of error encountered
   * @param queryResult - Original query result
   * @param error - The error that occurred
   * @returns ErrorRecoveryStrategy with fallback action
   */
  getRecoveryStrategy(
    errorType: 'data_analysis' | 'visualization' | 'html_generation' | 'export' | 'workflow',
    queryResult: QueryResult,
    error: Error
  ): ErrorRecoveryStrategy {
    // Log that we're initiating error recovery
    this.contextLogger.info(
      `Initiating error recovery for ${errorType} error`,
      {
        action: 'getRecoveryStrategy',
        metadata: {
          errorType,
          errorMessage: error.message,
          rowCount: queryResult.data.length,
        },
      }
    );

    switch (errorType) {
      case 'data_analysis':
        return {
          errorType: 'data_analysis',
          fallbackAction: () => this.handleDataAnalysisError(queryResult, error),
          shouldRetry: false,
          maxRetries: 0,
          logLevel: 'warn',
        };

      case 'visualization':
        return {
          errorType: 'visualization',
          fallbackAction: () => this.handleVisualizationError(queryResult, error),
          shouldRetry: false,
          maxRetries: 0,
          logLevel: 'warn',
        };

      case 'html_generation':
        return {
          errorType: 'html_generation',
          fallbackAction: () => this.handleHtmlGenerationError(queryResult, error),
          shouldRetry: false,
          maxRetries: 0,
          logLevel: 'error',
        };

      case 'export':
        return {
          errorType: 'export',
          fallbackAction: () => this.handleExportError(queryResult, error),
          shouldRetry: false,
          maxRetries: 0,
          logLevel: 'warn',
        };

      case 'workflow':
        return {
          errorType: 'workflow',
          fallbackAction: () => this.handleWorkflowError(queryResult, error),
          shouldRetry: false,
          maxRetries: 0,
          logLevel: 'error',
        };

      default:
        return {
          errorType: 'workflow',
          fallbackAction: () => this.handleGenericError(queryResult, error),
          shouldRetry: false,
          maxRetries: 0,
          logLevel: 'error',
        };
    }
  }

  /**
   * Handle data analysis errors by using default visualization types.
   * 
   * When data profiling or characteristic detection fails, fall back to
   * simple table display with a basic bar chart.
   * 
   * Validates: Requirements 9.1, 9.4
   * 
   * @param queryResult - Original query result
   * @param error - The error that occurred
   * @returns FallbackResult with simple table and chart
   */
  private async handleDataAnalysisError(
    queryResult: QueryResult,
    error: Error
  ): Promise<FallbackResult> {
    // Log error with context and sanitized data sample
    this.contextLogger.warn(
      'Data analysis failed, falling back to basic table view',
      {
        action: 'handleDataAnalysisError',
        metadata: {
          errorMessage: error.message,
          errorName: error.name,
          stackTrace: error.stack,
          dataSample: this.sanitizeDataSample(queryResult),
          rowCount: queryResult.data.length,
          columnCount: queryResult.data.length > 0 ? Object.keys(queryResult.data[0]).length : 0,
        },
      }
    );

    try {
      // Generate simple HTML table from raw data
      const tableHTML = this.generateSimpleTable(queryResult);
      
      // Try to add a basic bar chart if we have numeric data
      const chartHTML = this.tryGenerateBasicChart(queryResult);
      
      const content = `
        <div class="fallback-report">
          <div class="fallback-notice">
            <p><strong>Note:</strong> Advanced data analysis unavailable. Showing basic view.</p>
          </div>
          ${chartHTML}
          ${tableHTML}
        </div>
        <style>
          .fallback-report {
            padding: 1rem;
          }
          .fallback-notice {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 1rem;
            margin-bottom: 1.5rem;
            border-radius: 0.25rem;
          }
          .fallback-notice p {
            margin: 0;
            color: #92400e;
          }
        </style>
      `;

      return {
        success: true,
        content,
        message: 'Data analysis failed, showing basic table view',
        technicalDetails: `Data analysis error: ${error.message}`,
      };
    } catch (fallbackError) {
      // Log fallback failure
      this.contextLogger.error(
        'Fallback to basic table view also failed',
        fallbackError,
        {
          action: 'handleDataAnalysisError',
          metadata: {
            originalError: error.message,
            dataSample: this.sanitizeDataSample(queryResult),
          },
        }
      );
      
      // If even the fallback fails, return plain text
      return this.generatePlainTextFallback(queryResult, error);
    }
  }

  /**
   * Handle visualization generation errors by displaying data table without charts.
   * 
   * When chart rendering fails, ensure users still see their data in a
   * formatted table.
   * 
   * Validates: Requirements 9.2, 9.4
   * 
   * @param queryResult - Original query result
   * @param error - The error that occurred
   * @returns FallbackResult with data table only
   */
  private async handleVisualizationError(
    queryResult: QueryResult,
    error: Error
  ): Promise<FallbackResult> {
    // Log error with context and sanitized data sample
    this.contextLogger.warn(
      'Visualization generation failed, falling back to table-only view',
      {
        action: 'handleVisualizationError',
        metadata: {
          errorMessage: error.message,
          errorName: error.name,
          stackTrace: error.stack,
          dataSample: this.sanitizeDataSample(queryResult),
          rowCount: queryResult.data.length,
        },
      }
    );

    try {
      const tableHTML = this.generateSimpleTable(queryResult);
      
      const content = `
        <div class="fallback-report">
          <div class="fallback-notice">
            <p><strong>Note:</strong> Chart generation failed. Showing data table only.</p>
          </div>
          ${tableHTML}
        </div>
        <style>
          .fallback-report {
            padding: 1rem;
          }
          .fallback-notice {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 1rem;
            margin-bottom: 1.5rem;
            border-radius: 0.25rem;
          }
          .fallback-notice p {
            margin: 0;
            color: #92400e;
          }
        </style>
      `;

      return {
        success: true,
        content,
        message: 'Visualization failed, showing data table',
        technicalDetails: `Visualization error: ${error.message}`,
      };
    } catch (fallbackError) {
      // Log fallback failure
      this.contextLogger.error(
        'Fallback to table-only view also failed',
        fallbackError,
        {
          action: 'handleVisualizationError',
          metadata: {
            originalError: error.message,
            dataSample: this.sanitizeDataSample(queryResult),
          },
        }
      );
      
      return this.generatePlainTextFallback(queryResult, error);
    }
  }

  /**
   * Handle HTML generation errors by returning formatted text representation.
   * 
   * When HTML generation completely fails, fall back to plain text or
   * minimal HTML representation of the data.
   * 
   * Validates: Requirements 9.1, 9.4
   * 
   * @param queryResult - Original query result
   * @param error - The error that occurred
   * @returns FallbackResult with text representation
   */
  private async handleHtmlGenerationError(
    queryResult: QueryResult,
    error: Error
  ): Promise<FallbackResult> {
    // Log error with context and sanitized data sample
    this.contextLogger.error(
      'HTML generation failed completely, falling back to plain text',
      error,
      {
        action: 'handleHtmlGenerationError',
        metadata: {
          dataSample: this.sanitizeDataSample(queryResult),
          rowCount: queryResult.data.length,
        },
      }
    );

    return this.generatePlainTextFallback(queryResult, error);
  }

  /**
   * Handle export errors by providing raw data download option.
   * 
   * When export to HTML or other formats fails, provide users with
   * an error message and suggest alternative ways to access their data.
   * 
   * Validates: Requirements 9.3, 9.4
   * 
   * @param queryResult - Original query result
   * @param error - The error that occurred
   * @returns FallbackResult with error message and raw data
   */
  private async handleExportError(
    queryResult: QueryResult,
    error: Error
  ): Promise<FallbackResult> {
    // Log error with context and sanitized data sample
    this.contextLogger.warn(
      'Report export failed',
      {
        action: 'handleExportError',
        metadata: {
          errorMessage: error.message,
          errorName: error.name,
          stackTrace: error.stack,
          dataSample: this.sanitizeDataSample(queryResult),
          rowCount: queryResult.data.length,
        },
      }
    );

    const rowCount = queryResult.data.length;
    const columnCount = queryResult.data.length > 0 ? Object.keys(queryResult.data[0]).length : 0;
    
    const content = `
      <div class="export-error">
        <h3>Export Failed</h3>
        <p>Unable to export report to the requested format.</p>
        <div class="error-details">
          <p><strong>Error:</strong> ${this.escapeHtml(error.message)}</p>
        </div>
        <div class="data-summary">
          <p><strong>Data Summary:</strong></p>
          <ul>
            <li>Rows: ${rowCount}</li>
            <li>Columns: ${columnCount}</li>
          </ul>
        </div>
        <div class="alternative-options">
          <p><strong>Alternative Options:</strong></p>
          <ul>
            <li>Copy the data from the table view in the chat interface</li>
            <li>Try exporting again after refreshing the page</li>
            <li>Contact support if the issue persists</li>
          </ul>
        </div>
      </div>
      <style>
        .export-error {
          background: white;
          padding: 2rem;
          border-radius: 0.5rem;
          border-left: 4px solid #ef4444;
          max-width: 600px;
        }
        .export-error h3 {
          color: #dc2626;
          margin-top: 0;
          margin-bottom: 1rem;
        }
        .error-details {
          background: #fee2e2;
          padding: 1rem;
          border-radius: 0.25rem;
          margin: 1rem 0;
        }
        .error-details p {
          margin: 0;
          color: #991b1b;
          font-size: 0.875rem;
        }
        .data-summary, .alternative-options {
          margin: 1rem 0;
        }
        .data-summary ul, .alternative-options ul {
          margin: 0.5rem 0;
          padding-left: 1.5rem;
        }
        .data-summary li, .alternative-options li {
          margin: 0.25rem 0;
          color: #4b5563;
        }
      </style>
    `;

    return {
      success: false,
      content,
      message: 'Export failed - raw data still available in chat view',
      technicalDetails: `Export error: ${error.message}`,
    };
  }

  /**
   * Handle workflow integration errors.
   * 
   * When report generation fails to integrate with the workflow system,
   * ensure the workflow continues without blocking.
   * 
   * Validates: Requirement 9.4
   * 
   * @param queryResult - Original query result
   * @param error - The error that occurred
   * @returns FallbackResult indicating workflow should continue
   */
  private async handleWorkflowError(
    queryResult: QueryResult,
    error: Error
  ): Promise<FallbackResult> {
    // Log error with context
    this.contextLogger.error(
      'Workflow integration error during report generation',
      error,
      {
        action: 'handleWorkflowError',
        metadata: {
          dataSample: this.sanitizeDataSample(queryResult),
          rowCount: queryResult.data.length,
        },
      }
    );

    return {
      success: false,
      content: '',
      message: 'Report generation skipped due to workflow error',
      technicalDetails: `Workflow error: ${error.message}. Query results are still available.`,
    };
  }

  /**
   * Handle generic/unknown errors.
   * 
   * Validates: Requirement 9.4
   * 
   * @param queryResult - Original query result
   * @param error - The error that occurred
   * @returns FallbackResult with generic error handling
   */
  private async handleGenericError(
    queryResult: QueryResult,
    error: Error
  ): Promise<FallbackResult> {
    // Log error with context
    this.contextLogger.error(
      'Unknown error during report generation',
      error,
      {
        action: 'handleGenericError',
        metadata: {
          dataSample: this.sanitizeDataSample(queryResult),
          rowCount: queryResult.data.length,
        },
      }
    );

    return this.generatePlainTextFallback(queryResult, error);
  }

  /**
   * Generate a simple HTML table from query results.
   * 
   * Creates a basic, styled table without any advanced features.
   * 
   * @param queryResult - Query result to display
   * @returns HTML string containing the table
   */
  private generateSimpleTable(queryResult: QueryResult): string {
    if (queryResult.data.length === 0) {
      return '<p>No data to display.</p>';
    }

    const columns = Object.keys(queryResult.data[0]);
    const maxRows = 100; // Limit to first 100 rows for performance
    const displayData = queryResult.data.slice(0, maxRows);
    const hasMore = queryResult.data.length > maxRows;

    const headerHTML = columns.map(col => 
      `<th>${this.escapeHtml(col)}</th>`
    ).join('');

    const rowsHTML = displayData.map(row => {
      const cellsHTML = columns.map(col => {
        const value = row[col];
        const displayValue = value == null ? '' : String(value);
        // Truncate long values
        const truncated = displayValue.length > 100 
          ? displayValue.substring(0, 100) + '...'
          : displayValue;
        return `<td>${this.escapeHtml(truncated)}</td>`;
      }).join('');
      return `<tr>${cellsHTML}</tr>`;
    }).join('');

    return `
      <div class="simple-table-container">
        <table class="simple-table">
          <thead>
            <tr>${headerHTML}</tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>
        ${hasMore ? `<p class="table-note">Showing first ${maxRows} of ${queryResult.data.length} rows</p>` : ''}
      </div>
      <style>
        .simple-table-container {
          overflow-x: auto;
          background: white;
          border-radius: 0.5rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .simple-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }
        .simple-table th {
          background: #f3f4f6;
          padding: 0.75rem;
          text-align: left;
          font-weight: 600;
          color: #1f2937;
          border-bottom: 2px solid #e5e7eb;
          position: sticky;
          top: 0;
        }
        .simple-table td {
          padding: 0.75rem;
          border-bottom: 1px solid #e5e7eb;
          color: #4b5563;
        }
        .simple-table tbody tr:hover {
          background: #f9fafb;
        }
        .table-note {
          padding: 0.75rem;
          text-align: center;
          color: #6b7280;
          font-size: 0.875rem;
          background: #f9fafb;
          margin: 0;
        }
      </style>
    `;
  }

  /**
   * Try to generate a basic bar chart from numeric data.
   * 
   * Attempts to create a simple visualization if numeric columns exist.
   * Returns empty string if no suitable data found.
   * 
   * @param queryResult - Query result to visualize
   * @returns HTML string with chart or empty string
   */
  private tryGenerateBasicChart(queryResult: QueryResult): string {
    if (queryResult.data.length === 0) {
      return '';
    }

    try {
      const firstRow = queryResult.data[0];
      const columns = Object.keys(firstRow);

      // Find first numeric column
      const numericColumn = columns.find(col => {
        const value = firstRow[col];
        return typeof value === 'number' || !isNaN(Number(value));
      });

      if (!numericColumn) {
        return '';
      }

      // Use first column as labels, numeric column as values
      const labelColumn = columns[0];
      const labels = queryResult.data.slice(0, 20).map(row => String(row[labelColumn] ?? ''));
      const values = queryResult.data.slice(0, 20).map(row => Number(row[numericColumn]) || 0);

      const chartId = `fallback-chart-${Math.random().toString(36).substring(2, 11)}`;

      return `
        <div class="chart-section" style="background: white; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1.5rem;">
          <h3 style="margin-top: 0; margin-bottom: 1rem; font-size: 1.125rem; color: #1f2937;">Basic Visualization</h3>
          <div style="position: relative; height: 300px;">
            <canvas id="${chartId}"></canvas>
          </div>
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
                datasets: [{
                  label: '${this.escapeHtml(numericColumn)}',
                  data: ${JSON.stringify(values)},
                  backgroundColor: 'rgba(59, 130, 246, 0.8)',
                  borderColor: 'rgba(59, 130, 246, 1)',
                  borderWidth: 2,
                  borderRadius: 6
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: 12,
                    cornerRadius: 8
                  }
                },
                scales: {
                  x: {
                    grid: { display: false },
                    ticks: { maxRotation: 45, minRotation: 0 }
                  },
                  y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)' }
                  }
                }
              }
            });
          })();
        </script>
      `;
    } catch (error) {
      // If chart generation fails, just return empty string
      return '';
    }
  }

  /**
   * Generate plain text fallback when all HTML generation fails.
   * 
   * Creates a minimal HTML representation with just text content.
   * This is the last resort fallback.
   * 
   * Validates: Requirements 9.1, 9.4, 9.5
   * 
   * @param queryResult - Original query result
   * @param error - The error that occurred
   * @returns FallbackResult with plain text representation
   */
  private generatePlainTextFallback(
    queryResult: QueryResult,
    error: Error
  ): FallbackResult {
    // Log error with context
    this.contextLogger.error(
      'All report generation attempts failed, using plain text fallback',
      error,
      {
        action: 'generatePlainTextFallback',
        metadata: {
          dataSample: this.sanitizeDataSample(queryResult),
          rowCount: queryResult.data.length,
        },
      }
    );

    const rowCount = queryResult.data.length;
    const columnCount = queryResult.data.length > 0 ? Object.keys(queryResult.data[0]).length : 0;
    
    // Generate text summary
    let textContent = `Report Generation Failed\n\n`;
    textContent += `Error: ${error.message}\n\n`;
    textContent += `Data Summary:\n`;
    textContent += `- Rows: ${rowCount}\n`;
    textContent += `- Columns: ${columnCount}\n\n`;

    if (queryResult.data.length > 0) {
      const columns = Object.keys(queryResult.data[0]);
      textContent += `Columns: ${columns.join(', ')}\n\n`;
      
      // Show first few rows as text
      textContent += `Sample Data (first 5 rows):\n`;
      queryResult.data.slice(0, 5).forEach((row, index) => {
        textContent += `\nRow ${index + 1}:\n`;
        columns.forEach(col => {
          const value = row[col];
          textContent += `  ${col}: ${value == null ? 'null' : String(value)}\n`;
        });
      });
    }

    const content = `
      <div class="plain-text-fallback">
        <pre>${this.escapeHtml(textContent)}</pre>
      </div>
      <style>
        .plain-text-fallback {
          background: #f9fafb;
          padding: 1.5rem;
          border-radius: 0.5rem;
          border-left: 4px solid #6b7280;
          font-family: monospace;
          font-size: 0.875rem;
          overflow-x: auto;
        }
        .plain-text-fallback pre {
          margin: 0;
          white-space: pre-wrap;
          word-wrap: break-word;
          color: #1f2937;
        }
      </style>
    `;

    return {
      success: false,
      content,
      message: 'Report generation failed, showing text summary',
      technicalDetails: `Complete failure: ${error.message}`,
    };
  }

  /**
   * Sanitize data sample for logging.
   * 
   * Removes sensitive information and limits data size for logging.
   * 
   * Validates: Requirement 9.4
   * 
   * @param queryResult - Query result to sanitize
   * @returns Sanitized data sample safe for logging
   */
  private sanitizeDataSample(queryResult: QueryResult): Record<string, unknown> {
    const maxRows = 3;
    const maxValueLength = 100;
    
    // Get first few rows
    const sampleData = queryResult.data.slice(0, maxRows);
    
    // Sanitize each row
    const sanitized = sampleData.map(row => {
      const sanitizedRow: Record<string, unknown> = {};
      
      for (const [key, value] of Object.entries(row)) {
        // Redact potentially sensitive column names
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes('password') ||
          lowerKey.includes('secret') ||
          lowerKey.includes('token') ||
          lowerKey.includes('key') ||
          lowerKey.includes('ssn') ||
          lowerKey.includes('credit')
        ) {
          sanitizedRow[key] = '[REDACTED]';
          continue;
        }
        
        // Truncate long values
        if (typeof value === 'string' && value.length > maxValueLength) {
          sanitizedRow[key] = value.substring(0, maxValueLength) + '...';
        } else if (value === null || value === undefined) {
          sanitizedRow[key] = null;
        } else if (typeof value === 'object') {
          // Don't log complex objects, just indicate type
          sanitizedRow[key] = '[Object]';
        } else {
          sanitizedRow[key] = value;
        }
      }
      
      return sanitizedRow;
    });
    
    return {
      sampleRows: sanitized,
      totalRows: queryResult.data.length,
      columns: queryResult.data.length > 0 ? Object.keys(queryResult.data[0]) : [],
    };
  }

  /**
   * Escape HTML special characters to prevent XSS.
   * 
   * @param text - Text to escape
   * @returns Escaped text safe for HTML
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

  /**
   * Create a failed ReportGenerationResult with fallback content.
   * 
   * Helper method to create a properly structured ReportGenerationResult
   * when report generation fails but fallback content is available.
   * 
   * @param fallbackResult - Result from fallback operation
   * @param originalError - The original error that triggered fallback
   * @returns ReportGenerationResult with fallback content
   */
  createFallbackReportResult(
    fallbackResult: FallbackResult,
    originalError: Error
  ): ReportGenerationResult {
    return {
      success: false,
      reportHTML: fallbackResult.content,
      exportOptions: {
        html: () => {
          console.warn('Export not available for fallback report');
        },
      },
      renderData: {
        type: 'inline',
        content: fallbackResult.content,
      },
      error: originalError,
    };
  }
}
