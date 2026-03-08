/**
 * Integration test for pagination functionality
 * 
 * Validates that pagination works correctly for large datasets
 * Requirements: 4.5
 */

import { describe, it, expect } from 'vitest';
import { ChatReportRenderer } from '../../src/services/automatic-report-generation/chat-report-renderer';
import type { ChatRenderConfig } from '../../src/services/automatic-report-generation/types';

describe('Pagination Integration', () => {
  it('should correctly implement pagination for datasets with exactly 1001 rows', () => {
    const config: ChatRenderConfig = {
      maxHeight: '600px',
      enableScrolling: true,
      enableInteractivity: true,
      responsiveBreakpoints: {
        mobile: 640,
        tablet: 768,
        desktop: 1024,
      },
    };
    const renderer = new ChatReportRenderer(config);

    // Create a report with exactly 1001 rows (threshold + 1)
    const reportHTML = `
      <table>
        <tr><th>ID</th><th>Name</th><th>Value</th></tr>
        ${Array(1001).fill(0).map((_, i) => `<tr><td>${i + 1}</td><td>Item ${i + 1}</td><td>${Math.random()}</td></tr>`).join('')}
      </table>
    `;

    const result = renderer.renderForChat(reportHTML, 'simple');

    // Should have pagination
    expect(result.html).toContain('pagination-info');
    expect(result.html).toContain('pagination-controls');
    
    // Should show correct total pages (1001 / 50 = 21 pages)
    expect(result.html).toContain('Page <span id="current-page">1</span> of 21');
    
    // Should show correct row range
    expect(result.html).toContain('Showing <span id="pagination-start">1</span>-<span id="pagination-end">50</span> of 1001 rows');
    
    // Previous button should be disabled on first page
    expect(result.html).toMatch(/id="prev-page-btn"[^>]*disabled/);
    
    // Next button should NOT be disabled (more pages available)
    expect(result.html).not.toMatch(/id="next-page-btn"[^>]*disabled/);
  });

  it('should not add pagination for datasets with exactly 1000 rows', () => {
    const config: ChatRenderConfig = {
      maxHeight: '600px',
      enableScrolling: true,
      enableInteractivity: true,
      responsiveBreakpoints: {
        mobile: 640,
        tablet: 768,
        desktop: 1024,
      },
    };
    const renderer = new ChatReportRenderer(config);

    // Create a report with exactly 1000 rows (at threshold)
    const reportHTML = `
      <table>
        <tr><th>ID</th><th>Name</th></tr>
        ${Array(1000).fill(0).map((_, i) => `<tr><td>${i + 1}</td><td>Item ${i + 1}</td></tr>`).join('')}
      </table>
    `;

    const result = renderer.renderForChat(reportHTML, 'simple');

    // Should NOT have pagination (threshold is > 1000, not >= 1000)
    expect(result.html).not.toContain('pagination-info');
    expect(result.html).not.toContain('pagination-controls');
  });

  it('should handle single page of large dataset correctly', () => {
    const config: ChatRenderConfig = {
      maxHeight: '600px',
      enableScrolling: true,
      enableInteractivity: true,
      responsiveBreakpoints: {
        mobile: 640,
        tablet: 768,
        desktop: 1024,
      },
    };
    const renderer = new ChatReportRenderer(config);

    // Create a report with 1025 rows (just over 1 page at 50 rows/page)
    const reportHTML = `
      <table>
        <tr><th>ID</th></tr>
        ${Array(1025).fill(0).map((_, i) => `<tr><td>${i + 1}</td></tr>`).join('')}
      </table>
    `;

    const result = renderer.renderForChat(reportHTML, 'simple');

    // Should have pagination
    expect(result.html).toContain('pagination-info');
    
    // Should show 21 pages (1025 / 50 = 20.5, rounded up to 21)
    expect(result.html).toContain('Page <span id="current-page">1</span> of 21');
  });

  it('should include JavaScript for page navigation', () => {
    const config: ChatRenderConfig = {
      maxHeight: '600px',
      enableScrolling: true,
      enableInteractivity: true,
      responsiveBreakpoints: {
        mobile: 640,
        tablet: 768,
        desktop: 1024,
      },
    };
    const renderer = new ChatReportRenderer(config);

    const reportHTML = `
      <table>
        <tr><th>ID</th></tr>
        ${Array(1500).fill(0).map((_, i) => `<tr><td>${i + 1}</td></tr>`).join('')}
      </table>
    `;

    const result = renderer.renderForChat(reportHTML, 'simple');

    // Should include changePage function
    expect(result.html).toContain('window.changePage = function(delta)');
    
    // Should include updatePaginationUI function
    expect(result.html).toContain('function updatePaginationUI()');
    
    // Should emit custom event
    expect(result.html).toContain('reportPageChange');
    
    // Should update UI elements
    expect(result.html).toContain('getElementById(\'pagination-start\')');
    expect(result.html).toContain('getElementById(\'pagination-end\')');
    expect(result.html).toContain('getElementById(\'current-page\')');
    expect(result.html).toContain('getElementById(\'prev-page-btn\')');
    expect(result.html).toContain('getElementById(\'next-page-btn\')');
  });

  it('should calculate correct page ranges for various dataset sizes', () => {
    const config: ChatRenderConfig = {
      maxHeight: '600px',
      enableScrolling: true,
      enableInteractivity: true,
      responsiveBreakpoints: {
        mobile: 640,
        tablet: 768,
        desktop: 1024,
      },
    };
    const renderer = new ChatReportRenderer(config);

    const testCases = [
      { rows: 1001, expectedPages: 21, expectedEnd: 50 },
      { rows: 1500, expectedPages: 30, expectedEnd: 50 },
      { rows: 2000, expectedPages: 40, expectedEnd: 50 },
      { rows: 5000, expectedPages: 100, expectedEnd: 50 },
      { rows: 10000, expectedPages: 200, expectedEnd: 50 },
    ];

    testCases.forEach(({ rows, expectedPages, expectedEnd }) => {
      const reportHTML = `
        <table>
          <tr><th>ID</th></tr>
          ${Array(rows).fill(0).map((_, i) => `<tr><td>${i + 1}</td></tr>`).join('')}
        </table>
      `;

      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.html).toContain(`Page <span id="current-page">1</span> of ${expectedPages}`);
      expect(result.html).toContain(`Showing <span id="pagination-start">1</span>-<span id="pagination-end">${expectedEnd}</span> of ${rows} rows`);
    });
  });

  it('should add data-row-index attributes to table rows for client-side pagination', () => {
    const config: ChatRenderConfig = {
      maxHeight: '600px',
      enableScrolling: true,
      enableInteractivity: true,
      responsiveBreakpoints: {
        mobile: 640,
        tablet: 768,
        desktop: 1024,
      },
    };
    const renderer = new ChatReportRenderer(config);

    const reportHTML = `
      <table>
        <tr><th>ID</th><th>Name</th></tr>
        ${Array(1500).fill(0).map((_, i) => `<tr><td>${i + 1}</td><td>Item ${i + 1}</td></tr>`).join('')}
      </table>
    `;

    const result = renderer.renderForChat(reportHTML, 'simple');

    // Should add data-row-index to data rows
    expect(result.html).toContain('data-row-index="0"');
    expect(result.html).toContain('data-row-index="1"');
    expect(result.html).toContain('data-row-index="100"');
    
    // Should NOT add data-row-index to header rows
    expect(result.html).toMatch(/<tr[^>]*><th>ID<\/th><th>Name<\/th><\/tr>/);
    expect(result.html).not.toMatch(/<tr[^>]*data-row-index[^>]*><th>/);
  });

  it('should include updateVisibleRows function for client-side row hiding', () => {
    const config: ChatRenderConfig = {
      maxHeight: '600px',
      enableScrolling: true,
      enableInteractivity: true,
      responsiveBreakpoints: {
        mobile: 640,
        tablet: 768,
        desktop: 1024,
      },
    };
    const renderer = new ChatReportRenderer(config);

    const reportHTML = `
      <table>
        <tr><th>ID</th></tr>
        ${Array(1500).fill(0).map((_, i) => `<tr><td>${i + 1}</td></tr>`).join('')}
      </table>
    `;

    const result = renderer.renderForChat(reportHTML, 'simple');

    // Should include updateVisibleRows function
    expect(result.html).toContain('function updateVisibleRows()');
    
    // Should call updateVisibleRows on initialization
    expect(result.html).toContain('updateVisibleRows();');
    
    // Should query for data-row-index attributes
    expect(result.html).toContain('querySelectorAll(\'[data-row-index]\')');
    
    // Should hide/show rows based on page
    expect(result.html).toContain('row.style.display');
  });
});
