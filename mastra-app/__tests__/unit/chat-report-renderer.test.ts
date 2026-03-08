/**
 * Unit tests for ChatReportRenderer
 * 
 * Tests chat-specific styling, responsive CSS, and pagination functionality
 * Requirements: 4.2, 4.3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ChatReportRenderer } from '../../src/services/automatic-report-generation/chat-report-renderer';
import { ChatRenderConfig } from '../../src/services/automatic-report-generation/types';

describe('ChatReportRenderer', () => {
  let renderer: ChatReportRenderer;
  let defaultConfig: ChatRenderConfig;

  beforeEach(() => {
    defaultConfig = {
      maxHeight: '600px',
      enableScrolling: true,
      enableInteractivity: true,
      responsiveBreakpoints: {
        mobile: 640,
        tablet: 768,
        desktop: 1024,
      },
    };
    renderer = new ChatReportRenderer(defaultConfig);
  });

  describe('renderForChat', () => {
    it('should wrap content in chat message container', () => {
      const reportHTML = '<div class="report-content">Test Report</div>';
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.html).toContain('chat-report-container');
      expect(result.html).toContain('Test Report');
    });

    it('should apply max-height constraints for scrolling (Requirement 4.2)', () => {
      const reportHTML = '<div>Test Report</div>';
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.html).toContain('max-height:');
      expect(result.html).toContain('overflow-y: auto');
    });

    it('should apply different max-height for simple reports', () => {
      const reportHTML = '<div>Simple Report</div>';
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.html).toContain('max-height: 400px');
    });

    it('should apply different max-height for gallery reports', () => {
      const reportHTML = '<div>Gallery Report</div>';
      const result = renderer.renderForChat(reportHTML, 'gallery');

      expect(result.html).toContain('max-height: 500px');
    });

    it('should apply configured max-height for dashboard reports', () => {
      const reportHTML = '<div>Dashboard Report</div>';
      const result = renderer.renderForChat(reportHTML, 'dashboard');

      expect(result.html).toContain('max-height: 600px');
    });

    it('should add report type class for type-specific styling', () => {
      const reportHTML = '<div>Test Report</div>';
      const simpleResult = renderer.renderForChat(reportHTML, 'simple');
      const dashboardResult = renderer.renderForChat(reportHTML, 'dashboard');
      const galleryResult = renderer.renderForChat(reportHTML, 'gallery');

      expect(simpleResult.html).toContain('chat-report-simple');
      expect(dashboardResult.html).toContain('chat-report-dashboard');
      expect(galleryResult.html).toContain('chat-report-gallery');
    });

    it('should disable scrolling when configured', () => {
      const noScrollConfig: ChatRenderConfig = {
        ...defaultConfig,
        enableScrolling: false,
      };
      const noScrollRenderer = new ChatReportRenderer(noScrollConfig);
      const reportHTML = '<div>Test Report</div>';
      const result = noScrollRenderer.renderForChat(reportHTML, 'simple');

      expect(result.html).toContain('overflow: hidden');
    });

    it('should include interactive controls when enabled', () => {
      const reportHTML = '<div>Test Report</div>';
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.html).toContain('chat-report-controls');
      expect(result.html).toContain('Export HTML');
    });

    it('should exclude interactive controls when disabled', () => {
      const noInteractivityConfig: ChatRenderConfig = {
        ...defaultConfig,
        enableInteractivity: false,
      };
      const noInteractivityRenderer = new ChatReportRenderer(noInteractivityConfig);
      const reportHTML = '<div>Test Report</div>';
      const result = noInteractivityRenderer.renderForChat(reportHTML, 'simple');

      expect(result.html).not.toContain('chat-report-controls');
      expect(result.html).toContain('pointer-events: none');
    });

    it('should generate unique report IDs', () => {
      const reportHTML = '<div>Test Report</div>';
      const result1 = renderer.renderForChat(reportHTML, 'simple');
      const result2 = renderer.renderForChat(reportHTML, 'simple');

      expect(result1.metadata.reportId).not.toBe(result2.metadata.reportId);
    });

    it('should include timestamp in metadata', () => {
      const reportHTML = '<div>Test Report</div>';
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.metadata.timestamp).toBeInstanceOf(Date);
    });

    it('should extract data row count from table rows', () => {
      const reportHTML = `
        <table>
          <tr><th>Header</th></tr>
          <tr><td>Row 1</td></tr>
          <tr><td>Row 2</td></tr>
          <tr><td>Row 3</td></tr>
        </table>
      `;
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.metadata.dataRowCount).toBe(3);
    });

    it('should extract data row count from gallery items', () => {
      const reportHTML = `
        <div class="gallery">
          <div class="gallery-item">Item 1</div>
          <div class="gallery-item">Item 2</div>
          <div class="gallery-item">Item 3</div>
        </div>
      `;
      const result = renderer.renderForChat(reportHTML, 'gallery');

      expect(result.metadata.dataRowCount).toBe(3);
    });

    it('should extract data row count from text description', () => {
      const reportHTML = '<div>Query returned 42 rows</div>';
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.metadata.dataRowCount).toBe(42);
    });
  });

  describe('pagination', () => {
    it('should add pagination for large datasets (Requirement 4.5)', () => {
      const reportHTML = `
        <table>
          <tr><th>Header</th></tr>
          ${Array(1500).fill('<tr><td>Row</td></tr>').join('')}
        </table>
      `;
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.html).toContain('pagination-info');
      expect(result.html).toContain('pagination-controls');
      expect(result.html).toContain('Previous');
      expect(result.html).toContain('Next');
    });

    it('should not add pagination for small datasets', () => {
      const reportHTML = `
        <table>
          <tr><th>Header</th></tr>
          <tr><td>Row 1</td></tr>
          <tr><td>Row 2</td></tr>
        </table>
      `;
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.html).not.toContain('pagination-info');
      expect(result.html).not.toContain('pagination-controls');
    });

    it('should calculate correct total pages', () => {
      const reportHTML = `
        <table>
          <tr><th>Header</th></tr>
          ${Array(1500).fill('<tr><td>Row</td></tr>').join('')}
        </table>
      `;
      const result = renderer.renderForChat(reportHTML, 'simple');

      // 1500 rows / 50 per page = 30 pages
      expect(result.html).toContain('Page <span id="current-page">1</span> of 30');
    });

    it('should show correct row range in pagination info', () => {
      const reportHTML = `
        <table>
          <tr><th>Header</th></tr>
          ${Array(1500).fill('<tr><td>Row</td></tr>').join('')}
        </table>
      `;
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.html).toContain('Showing <span id="pagination-start">1</span>-<span id="pagination-end">50</span> of 1500 rows');
    });

    it('should include pagination JavaScript', () => {
      const reportHTML = `
        <table>
          <tr><th>Header</th></tr>
          ${Array(1500).fill('<tr><td>Row</td></tr>').join('')}
        </table>
      `;
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.html).toContain('window.changePage');
      expect(result.html).toContain('reportPageChange');
    });
  });

  describe('responsive CSS generation', () => {
    it('should generate responsive CSS for mobile/tablet/desktop (Requirement 4.3)', () => {
      const reportHTML = '<div>Test Report</div>';
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.css).toContain('@media (max-width: 639px)'); // Mobile
      expect(result.css).toContain('@media (min-width: 640px) and (max-width: 767px)'); // Tablet
      expect(result.css).toContain('@media (min-width: 1024px)'); // Desktop
    });

    it('should include mobile-specific styles', () => {
      const reportHTML = '<div>Test Report</div>';
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.css).toContain('max-height: 400px'); // Mobile max-height
      expect(result.css).toContain('grid-template-columns: 1fr'); // Mobile single column
    });

    it('should include tablet-specific styles', () => {
      const reportHTML = '<div>Test Report</div>';
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.css).toContain('max-height: 500px'); // Tablet max-height
      expect(result.css).toContain('grid-template-columns: repeat(2, 1fr)'); // Tablet two columns
    });

    it('should include desktop-specific styles', () => {
      const reportHTML = '<div>Test Report</div>';
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.css).toContain('grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))'); // Desktop responsive grid
    });

    it('should use custom breakpoints when provided', () => {
      const customConfig: ChatRenderConfig = {
        ...defaultConfig,
        responsiveBreakpoints: {
          mobile: 480,
          tablet: 900,
          desktop: 1200,
        },
      };
      const customRenderer = new ChatReportRenderer(customConfig);
      const reportHTML = '<div>Test Report</div>';
      const result = customRenderer.renderForChat(reportHTML, 'simple');

      expect(result.css).toContain('@media (max-width: 479px)'); // Custom mobile
      expect(result.css).toContain('@media (min-width: 480px) and (max-width: 899px)'); // Custom tablet
      expect(result.css).toContain('@media (min-width: 1200px)'); // Custom desktop
    });

    it('should include scrollbar styling', () => {
      const reportHTML = '<div>Test Report</div>';
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.css).toContain('::-webkit-scrollbar');
      expect(result.css).toContain('::-webkit-scrollbar-track');
      expect(result.css).toContain('::-webkit-scrollbar-thumb');
    });

    it('should include print styles', () => {
      const reportHTML = '<div>Test Report</div>';
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.css).toContain('@media print');
      expect(result.css).toContain('max-height: none');
      expect(result.css).toContain('overflow: visible');
    });

    it('should include accessibility styles', () => {
      const reportHTML = '<div>Test Report</div>';
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.css).toContain(':focus-within');
      expect(result.css).toContain(':focus-visible');
      expect(result.css).toContain('outline: 2px solid');
    });
  });

  describe('visual consistency', () => {
    it('should apply consistent styling across multiple reports (Requirement 4.3)', () => {
      const reportHTML1 = '<div>Report 1</div>';
      const reportHTML2 = '<div>Report 2</div>';
      
      const result1 = renderer.renderForChat(reportHTML1, 'simple');
      const result2 = renderer.renderForChat(reportHTML2, 'simple');

      // Both should use the same CSS
      expect(result1.css).toBe(result2.css);
      
      // Both should have the same container class
      expect(result1.html).toContain('chat-report-container');
      expect(result2.html).toContain('chat-report-container');
      
      // Both should have the same styling properties
      expect(result1.html).toContain('border-radius: 0.5rem');
      expect(result2.html).toContain('border-radius: 0.5rem');
    });

    it('should use consistent color scheme', () => {
      const reportHTML = '<div>Test Report</div>';
      const result = renderer.renderForChat(reportHTML, 'simple');

      // Check for consistent colors in HTML
      expect(result.html).toContain('background: #ffffff');
      expect(result.html).toContain('background: #3b82f6'); // Primary button color
      
      // Check for consistent colors in CSS
      expect(result.css).toContain('color: #1f2937'); // Text color
      expect(result.css).toContain('background: #f3f4f6'); // Scrollbar track
    });

    it('should use consistent spacing', () => {
      const reportHTML = '<div>Test Report</div>';
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.html).toContain('margin: 0.5rem 0');
      expect(result.html).toContain('padding: 1rem');
    });

    it('should use consistent border radius', () => {
      const reportHTML = '<div>Test Report</div>';
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.html).toContain('border-radius: 0.5rem');
      expect(result.html).toContain('border-radius: 0.375rem');
    });
  });

  describe('interactive elements', () => {
    it('should include export button (Requirement 4.4)', () => {
      const reportHTML = '<div>Test Report</div>';
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.html).toContain('report-export-btn');
      expect(result.html).toContain('Export HTML');
      expect(result.html).toContain('window.exportReport');
    });

    it('should include filter controls (Requirement 4.4)', () => {
      const reportHTML = '<div>Test Report</div>';
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.html).toContain('report-filter-controls');
      expect(result.html).toContain('report-filter-input');
      expect(result.html).toContain('Filter data...');
      expect(result.html).toContain('window.filterReportData');
    });

    it('should include clear filter button (Requirement 4.4)', () => {
      const reportHTML = '<div>Test Report</div>';
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.html).toContain('report-clear-filter-btn');
      expect(result.html).toContain('Clear');
      expect(result.html).toContain('window.clearReportFilter');
    });

    it('should include chart interaction handlers (Requirement 4.4)', () => {
      const reportHTML = '<div>Test Report</div>';
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.html).toContain('initializeChartInteractions');
      expect(result.html).toContain('reportChartClicked');
    });

    it('should include table interaction handlers (Requirement 4.4)', () => {
      const reportHTML = '<div>Test Report</div>';
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.html).toContain('initializeTableInteractions');
      expect(result.html).toContain('reportTableSorted');
    });

    it('should include filter event emissions (Requirement 4.4)', () => {
      const reportHTML = '<div>Test Report</div>';
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.html).toContain('reportFilterApplied');
      expect(result.html).toContain('reportFilterCleared');
    });

    it('should include export event emission (Requirement 4.4)', () => {
      const reportHTML = '<div>Test Report</div>';
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.html).toContain('reportExported');
    });

    it('should include complete export functionality (Requirement 4.4)', () => {
      const reportHTML = '<div>Test Report</div>';
      const result = renderer.renderForChat(reportHTML, 'simple');

      // Check for export HTML generation
      expect(result.html).toContain('<!DOCTYPE html>');
      expect(result.html).toContain('Report Export');
      expect(result.html).toContain('createObjectURL');
      expect(result.html).toContain('download');
    });

    it('should include filter status updates (Requirement 4.4)', () => {
      const reportHTML = '<div>Test Report</div>';
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.html).toContain('updateFilterStatus');
      expect(result.html).toContain('removeFilterStatus');
      expect(result.html).toContain('filter-status');
    });

    it('should include table sorting functionality (Requirement 4.4)', () => {
      const reportHTML = '<div>Test Report</div>';
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.html).toContain('sortTableByColumn');
      expect(result.html).toContain('Click to sort');
    });

    it('should include hover effects on buttons', () => {
      const reportHTML = '<div>Test Report</div>';
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.html).toContain('onmouseover');
      expect(result.html).toContain('onmouseout');
    });

    it('should include disabled state styling in CSS', () => {
      const reportHTML = '<div>Test Report</div>';
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.css).toContain(':disabled');
      expect(result.css).toContain('cursor: not-allowed');
    });

    it('should organize controls into filter and action sections', () => {
      const reportHTML = '<div>Test Report</div>';
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.html).toContain('report-filter-controls');
      expect(result.html).toContain('report-action-controls');
    });

    it('should use flexbox layout for controls', () => {
      const reportHTML = '<div>Test Report</div>';
      const result = renderer.renderForChat(reportHTML, 'simple');

      expect(result.html).toContain('display: flex');
      expect(result.html).toContain('justify-content: space-between');
      expect(result.html).toContain('flex-wrap: wrap');
    });
  });
});
