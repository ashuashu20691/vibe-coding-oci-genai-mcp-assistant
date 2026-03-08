/**
 * ChatReportRenderer
 * 
 * Renders reports inline in the chat interface with appropriate styling,
 * sizing constraints, and interactive elements.
 * 
 * Requirements: 4.1, 4.2, 4.3
 */

import type { ChatRenderConfig, RenderedReport } from './types';

/**
 * ChatReportRenderer renders reports for inline display in the chat interface.
 * 
 * This class applies chat-specific styling, sizing constraints, scrolling behavior,
 * and pagination to ensure reports display correctly within the chat message stream.
 * 
 * Requirements:
 * - 4.1: Chat interface integration - render reports inline
 * - 4.2: Proper sizing and scrolling behavior
 * - 4.3: Visual consistency across multiple reports
 */
export class ChatReportRenderer {
  /**
   * Creates a new ChatReportRenderer instance.
   * 
   * @param config - Configuration for chat rendering behavior
   */
  constructor(private config: ChatRenderConfig) {}

  /**
   * Render report for inline chat display.
   * 
   * Applies chat-specific styling, sizing constraints, and interactive elements
   * to ensure the report displays correctly within the chat interface.
   * 
   * Validates: Requirements 4.1, 4.2, 4.3, 4.4
   * 
   * @param reportHTML - Raw report HTML content
   * @param reportType - Type of report (simple, dashboard, gallery)
   * @returns Rendered report ready for chat display
   */
  renderForChat(
    reportHTML: string,
    reportType: 'simple' | 'dashboard' | 'gallery'
  ): RenderedReport {
    // Extract data row count from HTML if present
    const dataRowCount = this.extractDataRowCount(reportHTML);

    // Apply chat-specific styling with report type
    const styledHTML = this.applyChatStyling(reportHTML, reportType);

    // Add pagination for large datasets (Requirement 4.5)
    const finalHTML = dataRowCount > 1000
      ? this.addPagination(styledHTML, dataRowCount, 50)
      : styledHTML;

    // Generate responsive CSS
    const css = this.generateResponsiveCSS();

    // Generate metadata
    const metadata = {
      reportId: `report-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      timestamp: new Date(),
      dataRowCount,
    };

    return {
      html: finalHTML,
      css,
      metadata,
    };
  }

  /**
   * Apply chat-specific styling and constraints.
   * 
   * Wraps the report content in a chat message container with appropriate
   * styling for inline display, including max-height constraints and
   * overflow scrolling. Applies report-type-specific styling.
   * 
   * Validates: Requirements 4.2, 4.3
   * 
   * @param html - Raw report HTML
   * @param reportType - Type of report for type-specific styling
   * @returns HTML with chat-specific styling applied
   */
  private applyChatStyling(html: string, reportType: 'simple' | 'dashboard' | 'gallery'): string {
    const maxHeight = this.config.maxHeight || '600px';
    const enableScrolling = this.config.enableScrolling !== false;
    const enableInteractivity = this.config.enableInteractivity !== false;

    // Adjust max-height based on report type
    const typeSpecificMaxHeight = reportType === 'simple' ? '400px' : 
                                   reportType === 'gallery' ? '500px' : 
                                   maxHeight;

    // Wrap content in chat report container with type-specific class
    return `
      <div class="chat-report-container chat-report-${reportType}" style="
        max-height: ${typeSpecificMaxHeight};
        ${enableScrolling ? 'overflow-y: auto;' : 'overflow: hidden;'}
        overflow-x: hidden;
        border-radius: 0.5rem;
        background: #ffffff;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        margin: 0.5rem 0;
        ${enableInteractivity ? '' : 'pointer-events: none;'}
      ">
        ${html}
        ${enableInteractivity ? this.generateInteractiveControls() : ''}
      </div>
    `;
  }

  /**
   * Generate interactive controls for the report.
   * 
   * Adds export buttons, filter controls, and chart interaction handlers
   * to the report for enhanced user interaction.
   * 
   * Validates: Requirement 4.4
   * 
   * @returns HTML for interactive controls
   */
  private generateInteractiveControls(): string {
    return `
      <div class="chat-report-controls" style="
        padding: 1rem;
        border-top: 1px solid #e5e7eb;
        background: #f9fafb;
        display: flex;
        gap: 0.5rem;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
      ">
        <div class="report-filter-controls" style="display: flex; gap: 0.5rem; align-items: center;">
          <input 
            type="text" 
            id="report-filter-input"
            placeholder="Filter data..."
            style="
              padding: 0.5rem;
              border: 1px solid #d1d5db;
              border-radius: 0.375rem;
              font-size: 0.875rem;
              min-width: 200px;
            "
            oninput="window.filterReportData && window.filterReportData(this.value)"
          />
          <button 
            class="report-clear-filter-btn" 
            onclick="window.clearReportFilter && window.clearReportFilter()"
            style="
              padding: 0.5rem 0.75rem;
              background: white;
              color: #6b7280;
              border: 1px solid #d1d5db;
              border-radius: 0.375rem;
              font-size: 0.875rem;
              cursor: pointer;
              transition: all 0.2s;
            "
            onmouseover="this.style.background='#f9fafb'"
            onmouseout="this.style.background='white'"
          >
            Clear
          </button>
        </div>
        <div class="report-action-controls" style="display: flex; gap: 0.5rem;">
          <button 
            class="report-export-btn" 
            onclick="window.exportReport && window.exportReport()"
            style="
              padding: 0.5rem 1rem;
              background: #3b82f6;
              color: white;
              border: none;
              border-radius: 0.375rem;
              font-size: 0.875rem;
              font-weight: 500;
              cursor: pointer;
              transition: background 0.2s;
            "
            onmouseover="this.style.background='#2563eb'"
            onmouseout="this.style.background='#3b82f6'"
          >
            Export HTML
          </button>
        </div>
      </div>
      ${this.generateInteractiveScripts()}
    `;
  }

  /**
   * Generate JavaScript for interactive functionality.
   * 
   * Includes filter functionality, chart interaction handlers, and export logic.
   * 
   * @returns JavaScript code for interactive features
   */
  private generateInteractiveScripts(): string {
    return `
      <script>
        (function() {
          // Store original row visibility for filter restoration
          let originalRowVisibility = new Map();
          let filterActive = false;

          /**
           * Filter report data based on search term.
           * Searches across all table cells and hides rows that don't match.
           */
          window.filterReportData = function(searchTerm) {
            const term = searchTerm.toLowerCase().trim();
            
            if (!term) {
              window.clearReportFilter();
              return;
            }

            filterActive = true;
            const tables = document.querySelectorAll('.chat-report-container table');
            
            tables.forEach(table => {
              const rows = table.querySelectorAll('tbody tr');
              let visibleCount = 0;
              
              rows.forEach(row => {
                // Store original display state if not already stored
                if (!originalRowVisibility.has(row)) {
                  originalRowVisibility.set(row, row.style.display);
                }
                
                const text = row.textContent?.toLowerCase() || '';
                const matches = text.includes(term);
                
                if (matches) {
                  row.style.display = '';
                  row.style.backgroundColor = '#fef3c7'; // Highlight matching rows
                  visibleCount++;
                } else {
                  row.style.display = 'none';
                }
              });

              // Update filter status message
              updateFilterStatus(visibleCount, rows.length);
            });

            // Emit filter event for external handling
            window.dispatchEvent(new CustomEvent('reportFilterApplied', {
              detail: { searchTerm: term }
            }));
          };

          /**
           * Clear all active filters and restore original row visibility.
           */
          window.clearReportFilter = function() {
            filterActive = false;
            const filterInput = document.getElementById('report-filter-input');
            if (filterInput) {
              filterInput.value = '';
            }

            // Restore original row visibility
            originalRowVisibility.forEach((display, row) => {
              row.style.display = display;
              row.style.backgroundColor = '';
            });

            originalRowVisibility.clear();
            removeFilterStatus();

            // Emit clear event
            window.dispatchEvent(new CustomEvent('reportFilterCleared'));
          };

          /**
           * Update filter status message.
           */
          function updateFilterStatus(visibleCount, totalCount) {
            let statusDiv = document.getElementById('filter-status');
            
            if (!statusDiv) {
              statusDiv = document.createElement('div');
              statusDiv.id = 'filter-status';
              statusDiv.style.cssText = \`
                padding: 0.5rem 1rem;
                background: #fef3c7;
                border-bottom: 1px solid #fde68a;
                font-size: 0.875rem;
                color: #92400e;
              \`;
              
              const container = document.querySelector('.chat-report-container');
              if (container && container.firstChild) {
                container.insertBefore(statusDiv, container.firstChild);
              }
            }
            
            statusDiv.textContent = \`Showing \${visibleCount} of \${totalCount} rows\`;
          }

          /**
           * Remove filter status message.
           */
          function removeFilterStatus() {
            const statusDiv = document.getElementById('filter-status');
            if (statusDiv) {
              statusDiv.remove();
            }
          }

          /**
           * Export report as HTML file.
           * Creates a downloadable HTML file with all content and styling.
           */
          window.exportReport = function() {
            try {
              const container = document.querySelector('.chat-report-container');
              if (!container) {
                console.error('Report container not found');
                return;
              }

              // Clone the container to avoid modifying the original
              const clone = container.cloneNode(true);
              
              // Remove interactive controls from export
              const controls = clone.querySelector('.chat-report-controls');
              if (controls) {
                controls.remove();
              }

              // Create complete HTML document
              const htmlContent = \`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Report Export - \${new Date().toLocaleDateString()}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.5;
      color: #1f2937;
      margin: 2rem;
      background: #f9fafb;
    }
    .chat-report-container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 0.5rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      padding: 2rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
    }
    th, td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    th {
      background: #f3f4f6;
      font-weight: 600;
    }
    .stats-card {
      padding: 1.5rem;
      background: #f9fafb;
      border-radius: 0.5rem;
      border: 1px solid #e5e7eb;
    }
    .chart-wrapper {
      margin: 1.5rem 0;
    }
    @media print {
      body {
        margin: 0;
        background: white;
      }
    }
  </style>
</head>
<body>
  \${clone.innerHTML}
</body>
</html>
              \`;

              // Create blob and download
              const blob = new Blob([htmlContent], { type: 'text/html' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = \`report-\${Date.now()}.html\`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);

              // Emit export event
              window.dispatchEvent(new CustomEvent('reportExported', {
                detail: { timestamp: new Date() }
              }));

              console.log('Report exported successfully');
            } catch (error) {
              console.error('Export failed:', error);
              alert('Failed to export report. Please try again.');
            }
          };

          /**
           * Add chart interaction handlers.
           * Enables hover tooltips and click interactions on chart elements.
           */
          function initializeChartInteractions() {
            const charts = document.querySelectorAll('.chart-wrapper, [class*="chart"]');
            
            charts.forEach(chart => {
              // Add hover effect
              chart.style.cursor = 'pointer';
              chart.style.transition = 'transform 0.2s, box-shadow 0.2s';
              
              chart.addEventListener('mouseenter', function() {
                this.style.transform = 'scale(1.02)';
                this.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
              });
              
              chart.addEventListener('mouseleave', function() {
                this.style.transform = 'scale(1)';
                this.style.boxShadow = '';
              });

              // Add click handler for chart expansion (if needed)
              chart.addEventListener('click', function(e) {
                // Emit chart click event for external handling
                window.dispatchEvent(new CustomEvent('reportChartClicked', {
                  detail: { 
                    chart: this,
                    event: e
                  }
                }));
              });
            });
          }

          /**
           * Add table interaction handlers.
           * Enables row highlighting and sorting on table headers.
           */
          function initializeTableInteractions() {
            const tables = document.querySelectorAll('.chat-report-container table');
            
            tables.forEach(table => {
              // Add row hover highlighting
              const rows = table.querySelectorAll('tbody tr');
              rows.forEach(row => {
                row.addEventListener('mouseenter', function() {
                  if (!filterActive || this.style.display !== 'none') {
                    this.style.backgroundColor = '#f3f4f6';
                  }
                });
                
                row.addEventListener('mouseleave', function() {
                  if (!filterActive) {
                    this.style.backgroundColor = '';
                  }
                });
              });

              // Add sortable headers
              const headers = table.querySelectorAll('thead th');
              headers.forEach((header, index) => {
                header.style.cursor = 'pointer';
                header.style.userSelect = 'none';
                header.title = 'Click to sort';
                
                header.addEventListener('click', function() {
                  sortTableByColumn(table, index);
                });
              });
            });
          }

          /**
           * Sort table by column index.
           */
          function sortTableByColumn(table, columnIndex) {
            const tbody = table.querySelector('tbody');
            if (!tbody) return;

            const rows = Array.from(tbody.querySelectorAll('tr'));
            const isAscending = table.dataset.sortOrder !== 'asc';
            
            rows.sort((a, b) => {
              const aCell = a.cells[columnIndex]?.textContent?.trim() || '';
              const bCell = b.cells[columnIndex]?.textContent?.trim() || '';
              
              // Try numeric comparison first
              const aNum = parseFloat(aCell);
              const bNum = parseFloat(bCell);
              
              if (!isNaN(aNum) && !isNaN(bNum)) {
                return isAscending ? aNum - bNum : bNum - aNum;
              }
              
              // Fall back to string comparison
              return isAscending 
                ? aCell.localeCompare(bCell)
                : bCell.localeCompare(aCell);
            });

            // Update table
            rows.forEach(row => tbody.appendChild(row));
            table.dataset.sortOrder = isAscending ? 'asc' : 'desc';

            // Emit sort event
            window.dispatchEvent(new CustomEvent('reportTableSorted', {
              detail: { 
                columnIndex,
                order: table.dataset.sortOrder
              }
            }));
          }

          // Initialize interactions when DOM is ready
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
              initializeChartInteractions();
              initializeTableInteractions();
            });
          } else {
            initializeChartInteractions();
            initializeTableInteractions();
          }
        })();
      </script>
    `;
  }

  /**
   * Implement pagination for large datasets.
   * 
   * Adds pagination controls and implements client-side data slicing to improve
   * performance and usability for large datasets. Only displays rows for the
   * current page, hiding others to reduce DOM size and improve rendering performance.
   * 
   * Validates: Requirement 4.5
   * 
   * @param html - Report HTML content
   * @param totalRows - Total number of data rows
   * @param pageSize - Number of rows per page
   * @returns HTML with pagination controls and data slicing logic
   */
  private addPagination(
    html: string,
    totalRows: number,
    pageSize: number
  ): string {
    const totalPages = Math.ceil(totalRows / pageSize);

    // Add data-row-index attributes to table rows for pagination
    const htmlWithRowIndexes = this.addRowIndexesToTable(html);

    // Add pagination controls
    const paginationControls = `
      <div class="pagination-info" style="
        padding: 1rem;
        background: #f0f9ff;
        border-bottom: 1px solid #bfdbfe;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <div style="font-size: 0.875rem; color: #1e40af;">
          Showing <span id="pagination-start">1</span>-<span id="pagination-end">${Math.min(pageSize, totalRows)}</span> of ${totalRows} rows
        </div>
        <div class="pagination-controls" style="display: flex; gap: 0.5rem;">
          <button 
            id="prev-page-btn"
            onclick="window.changePage && window.changePage(-1)"
            disabled
            style="
              padding: 0.375rem 0.75rem;
              background: white;
              border: 1px solid #d1d5db;
              border-radius: 0.375rem;
              font-size: 0.875rem;
              cursor: pointer;
              transition: all 0.2s;
            "
          >
            Previous
          </button>
          <span style="
            padding: 0.375rem 0.75rem;
            font-size: 0.875rem;
            color: #4b5563;
          ">
            Page <span id="current-page">1</span> of ${totalPages}
          </span>
          <button 
            id="next-page-btn"
            onclick="window.changePage && window.changePage(1)"
            ${totalPages === 1 ? 'disabled' : ''}
            style="
              padding: 0.375rem 0.75rem;
              background: white;
              border: 1px solid #d1d5db;
              border-radius: 0.375rem;
              font-size: 0.875rem;
              cursor: pointer;
              transition: all 0.2s;
            "
          >
            Next
          </button>
        </div>
      </div>
      <script>
        (function() {
          let currentPage = 1;
          const totalPages = ${totalPages};
          const pageSize = ${pageSize};
          const totalRows = ${totalRows};

          // Initialize: hide rows not on first page
          updateVisibleRows();

          window.changePage = function(delta) {
            const newPage = currentPage + delta;
            if (newPage < 1 || newPage > totalPages) return;

            currentPage = newPage;
            updatePaginationUI();
            updateVisibleRows();
            
            // Emit event for external handling
            window.dispatchEvent(new CustomEvent('reportPageChange', {
              detail: { page: currentPage, pageSize, totalRows }
            }));
          };

          function updatePaginationUI() {
            const start = (currentPage - 1) * pageSize + 1;
            const end = Math.min(currentPage * pageSize, totalRows);

            document.getElementById('pagination-start').textContent = start;
            document.getElementById('pagination-end').textContent = end;
            document.getElementById('current-page').textContent = currentPage;

            const prevBtn = document.getElementById('prev-page-btn');
            const nextBtn = document.getElementById('next-page-btn');

            if (prevBtn) prevBtn.disabled = currentPage === 1;
            if (nextBtn) nextBtn.disabled = currentPage === totalPages;
          }

          function updateVisibleRows() {
            const startRow = (currentPage - 1) * pageSize;
            const endRow = currentPage * pageSize - 1;

            // Find all data rows (with data-row-index attribute)
            const allRows = document.querySelectorAll('[data-row-index]');
            allRows.forEach((row, index) => {
              const rowIndex = parseInt(row.getAttribute('data-row-index') || '0', 10);
              // Show rows in current page range, hide others
              if (rowIndex >= startRow && rowIndex <= endRow) {
                row.style.display = '';
              } else {
                row.style.display = 'none';
              }
            });
          }
        })();
      </script>
    `;

    // Insert pagination controls at the top of the content
    return paginationControls + htmlWithRowIndexes;
  }

  /**
   * Add data-row-index attributes to table rows for pagination.
   * 
   * This enables client-side row hiding/showing for pagination without
   * requiring server-side data slicing.
   * 
   * @param html - Report HTML content
   * @returns HTML with data-row-index attributes added to data rows
   */
  private addRowIndexesToTable(html: string): string {
    // Match table rows, excluding header rows
    let rowIndex = 0;
    let foundHeader = false;
    
    // Use a simpler approach: split by <tr> tags and process each row
    const rows = html.split(/<tr([^>]*)>/i);
    const result: string[] = [];
    
    for (let i = 0; i < rows.length; i++) {
      if (i === 0) {
        // First element is content before first <tr>
        result.push(rows[i]);
        continue;
      }
      
      // Get the attributes and find the closing tag
      const attributes = rows[i];
      i++; // Move to content
      if (i >= rows.length) break;
      
      const content = rows[i];
      const closingTagIndex = content.indexOf('</tr>');
      
      if (closingTagIndex === -1) {
        // No closing tag found, just add as-is
        result.push('<tr' + attributes + '>');
        result.push(content);
        continue;
      }
      
      const rowContent = content.substring(0, closingTagIndex);
      const afterRow = content.substring(closingTagIndex + 5); // 5 = length of '</tr>'
      
      // Check if this row contains <th> tags (header row)
      const isHeaderRow = /<th/i.test(rowContent);
      
      if (isHeaderRow) {
        foundHeader = true;
        result.push('<tr' + attributes + '>');
        result.push(rowContent);
        result.push('</tr>');
        result.push(afterRow);
      } else if (foundHeader) {
        // Data row after header - add index
        result.push('<tr' + attributes + ' data-row-index="' + rowIndex + '">');
        result.push(rowContent);
        result.push('</tr>');
        result.push(afterRow);
        rowIndex++;
      } else {
        // Row before header - don't add index
        result.push('<tr' + attributes + '>');
        result.push(rowContent);
        result.push('</tr>');
        result.push(afterRow);
      }
    }
    
    return result.join('');
  }

  /**
   * Generate responsive CSS for chat rendering.
   * 
   * Creates CSS rules that adapt the report layout for different screen sizes
   * (mobile, tablet, desktop) to ensure proper display across devices.
   * 
   * Validates: Requirements 4.2, 4.3
   * 
   * @returns CSS string with responsive rules
   */
  private generateResponsiveCSS(): string {
    const breakpoints = this.config.responsiveBreakpoints || {
      mobile: 640,
      tablet: 768,
      desktop: 1024,
    };

    return `
      /* Chat Report Base Styles */
      .chat-report-container {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        line-height: 1.5;
        color: #1f2937;
      }

      .chat-report-container * {
        box-sizing: border-box;
      }

      /* Scrollbar Styling */
      .chat-report-container::-webkit-scrollbar {
        width: 8px;
      }

      .chat-report-container::-webkit-scrollbar-track {
        background: #f3f4f6;
        border-radius: 4px;
      }

      .chat-report-container::-webkit-scrollbar-thumb {
        background: #d1d5db;
        border-radius: 4px;
      }

      .chat-report-container::-webkit-scrollbar-thumb:hover {
        background: #9ca3af;
      }

      /* Interactive Controls */
      .report-export-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .pagination-controls button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        background: #f3f4f6;
      }

      .pagination-controls button:not(:disabled):hover {
        background: #f9fafb;
        border-color: #9ca3af;
      }

      /* Mobile Styles (< ${breakpoints.mobile}px) */
      @media (max-width: ${breakpoints.mobile - 1}px) {
        .chat-report-container {
          max-height: 400px;
          font-size: 0.875rem;
        }

        .stats-cards-grid {
          grid-template-columns: 1fr !important;
        }

        .gallery {
          grid-template-columns: 1fr !important;
        }

        .chart-wrapper {
          height: 250px !important;
        }

        .pagination-info {
          flex-direction: column;
          gap: 0.75rem;
          align-items: flex-start;
        }

        .report-export-btn {
          width: 100%;
        }
      }

      /* Tablet Styles (${breakpoints.mobile}px - ${breakpoints.tablet - 1}px) */
      @media (min-width: ${breakpoints.mobile}px) and (max-width: ${breakpoints.tablet - 1}px) {
        .chat-report-container {
          max-height: 500px;
        }

        .stats-cards-grid {
          grid-template-columns: repeat(2, 1fr) !important;
        }

        .gallery {
          grid-template-columns: repeat(2, 1fr) !important;
        }

        .chart-wrapper {
          height: 300px !important;
        }
      }

      /* Desktop Styles (>= ${breakpoints.desktop}px) */
      @media (min-width: ${breakpoints.desktop}px) {
        .chat-report-container {
          max-height: ${this.config.maxHeight || '600px'};
        }

        .stats-cards-grid {
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)) !important;
        }

        .gallery {
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)) !important;
        }
      }

      /* Print Styles */
      @media print {
        .chat-report-container {
          max-height: none;
          overflow: visible;
          box-shadow: none;
        }

        .chat-report-controls,
        .pagination-controls {
          display: none;
        }
      }

      /* Accessibility */
      .chat-report-container:focus-within {
        outline: 2px solid #3b82f6;
        outline-offset: 2px;
      }

      button:focus-visible {
        outline: 2px solid #3b82f6;
        outline-offset: 2px;
      }
    `;
  }

  /**
   * Extract data row count from HTML content.
   * 
   * Attempts to parse the HTML to determine how many data rows are present.
   * This is used to decide whether pagination is needed.
   * 
   * @param html - Report HTML content
   * @returns Estimated number of data rows
   */
  private extractDataRowCount(html: string): number {
    // Try to extract from table rows
    const tableRowMatches = html.match(/<tr>/g);
    if (tableRowMatches && tableRowMatches.length > 1) {
      // Subtract 1 for header row
      return tableRowMatches.length - 1;
    }

    // Try to extract from gallery items
    const galleryItemMatches = html.match(/class="gallery-item"/g);
    if (galleryItemMatches) {
      return galleryItemMatches.length;
    }

    // Try to extract from description text (e.g., "50 rows")
    const rowCountMatch = html.match(/(\d+)\s+rows?/i);
    if (rowCountMatch) {
      return parseInt(rowCountMatch[1], 10);
    }

    // Default to 0 if unable to determine
    return 0;
  }
}
