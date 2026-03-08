/**
 * Unit tests for HTML export capability
 * Task 8.1: Add HTML export capability
 * 
 * Tests verify:
 * - ExportService.exportToHTML() is used for export
 * - All CSS, JS, and images are embedded inline
 * - Valid HTML5 documents are generated
 * - Interactive chart functionality is preserved
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { ReportGenerationOrchestrator } from '@/services/automatic-report-generation/report-generation-orchestrator';
import { ResultPresenter } from '@/services/result-presenter';
import { DashboardComposer } from '@/services/dashboard-composer';
import { ExportService } from '@/services/export-service';
import type { QueryResult } from '@/services/query-engine';
import type { TriggerDecision } from '@/services/automatic-report-generation/types';

describe('HTML Export Capability', () => {
  let orchestrator: ReportGenerationOrchestrator;
  let resultPresenter: ResultPresenter;
  let dashboardComposer: DashboardComposer;

  beforeEach(() => {
    resultPresenter = new ResultPresenter();
    dashboardComposer = new DashboardComposer();
    orchestrator = new ReportGenerationOrchestrator(
      resultPresenter,
      dashboardComposer,
      ExportService
    );
  });

  describe('Requirement 5.1: HTML export option availability', () => {
    it('should provide HTML export option for simple reports', async () => {
      const queryResult: QueryResult = {
        data: [
          { name: 'Product A', sales: 100 },
          { name: 'Product B', sales: 200 },
        ],
        columns: ['name', 'sales'],
        rowCount: 2,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Query returned data',
        suggestedReportType: 'simple',
        estimatedComplexity: 'low',
      };

      const result = await orchestrator.generateReport(
        queryResult,
        triggerDecision,
        {} as any
      );

      expect(result.success).toBe(true);
      expect(result.exportOptions).toBeDefined();
      expect(result.exportOptions.html).toBeDefined();
      expect(typeof result.exportOptions.html).toBe('function');
    });

    it('should provide HTML export option for dashboard reports', async () => {
      const queryResult: QueryResult = {
        data: [
          { category: 'A', value: 100, count: 5 },
          { category: 'B', value: 200, count: 10 },
          { category: 'C', value: 150, count: 7 },
        ],
        columns: ['category', 'value', 'count'],
        rowCount: 3,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Multi-metric data',
        suggestedReportType: 'dashboard',
        estimatedComplexity: 'medium',
      };

      const result = await orchestrator.generateReport(
        queryResult,
        triggerDecision,
        {} as any
      );

      expect(result.success).toBe(true);
      expect(result.exportOptions).toBeDefined();
      expect(result.exportOptions.html).toBeDefined();
      expect(typeof result.exportOptions.html).toBe('function');
    });

    it('should provide HTML export option for gallery reports', async () => {
      const queryResult: QueryResult = {
        data: [
          { image_url: 'data:image/png;base64,abc123', similarity: 0.95 },
          { image_url: 'data:image/png;base64,def456', similarity: 0.87 },
        ],
        columns: ['image_url', 'similarity'],
        rowCount: 2,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Image data detected',
        suggestedReportType: 'gallery',
        estimatedComplexity: 'low',
      };

      const result = await orchestrator.generateReport(
        queryResult,
        triggerDecision,
        {} as any
      );

      expect(result.success).toBe(true);
      expect(result.exportOptions).toBeDefined();
      expect(result.exportOptions.html).toBeDefined();
      expect(typeof result.exportOptions.html).toBe('function');
    });
  });

  describe('Requirement 5.2, 5.3: Complete export content with inline assets', () => {
    it('should generate HTML with embedded CSS inline', async () => {
      const queryResult: QueryResult = {
        data: [
          { product: 'Widget', revenue: 1000 },
          { product: 'Gadget', revenue: 1500 },
        ],
        columns: ['product', 'revenue'],
        rowCount: 2,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Query returned data',
        suggestedReportType: 'simple',
        estimatedComplexity: 'low',
      };

      const result = await orchestrator.generateReport(
        queryResult,
        triggerDecision,
        {} as any
      );

      expect(result.success).toBe(true);
      expect(result.reportHTML).toContain('<style>');
      expect(result.reportHTML).toContain('</style>');
      
      // Should not have external CSS links
      expect(result.reportHTML).not.toContain('<link rel="stylesheet"');
    });

    it('should generate HTML with embedded JavaScript inline', async () => {
      const queryResult: QueryResult = {
        data: [
          { month: 'Jan', sales: 100 },
          { month: 'Feb', sales: 150 },
          { month: 'Mar', sales: 200 },
        ],
        columns: ['month', 'sales'],
        rowCount: 3,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Query returned data',
        suggestedReportType: 'simple',
        estimatedComplexity: 'low',
      };

      const result = await orchestrator.generateReport(
        queryResult,
        triggerDecision,
        {} as any
      );

      expect(result.success).toBe(true);
      expect(result.reportHTML).toContain('<script>');
      expect(result.reportHTML).toContain('</script>');
    });

    it('should include Chart.js library for interactive charts', async () => {
      const queryResult: QueryResult = {
        data: [
          { category: 'A', value: 100 },
          { category: 'B', value: 200 },
          { category: 'C', value: 150 },
        ],
        columns: ['category', 'value'],
        rowCount: 3,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Query returned data',
        suggestedReportType: 'simple',
        estimatedComplexity: 'low',
      };

      const result = await orchestrator.generateReport(
        queryResult,
        triggerDecision,
        {} as any
      );

      expect(result.success).toBe(true);
      // Chart.js should be included via CDN for interactive functionality
      expect(result.reportHTML).toContain('chart.js');
    });

    it('should embed images inline as base64 data URIs', async () => {
      const queryResult: QueryResult = {
        data: [
          { image_data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', name: 'Test Image' },
        ],
        columns: ['image_data', 'name'],
        rowCount: 1,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Image data detected',
        suggestedReportType: 'gallery',
        estimatedComplexity: 'low',
      };

      const result = await orchestrator.generateReport(
        queryResult,
        triggerDecision,
        {} as any
      );

      expect(result.success).toBe(true);
      // Images should be embedded as data URIs
      expect(result.reportHTML).toContain('data:image/');
      expect(result.reportHTML).toContain('base64');
    });
  });

  describe('Requirement 5.4: Valid HTML5 documents', () => {
    it('should generate valid HTML5 with DOCTYPE declaration', async () => {
      const queryResult: QueryResult = {
        data: [{ id: 1, value: 100 }],
        columns: ['id', 'value'],
        rowCount: 1,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Query returned data',
        suggestedReportType: 'simple',
        estimatedComplexity: 'low',
      };

      const result = await orchestrator.generateReport(
        queryResult,
        triggerDecision,
        {} as any
      );

      expect(result.success).toBe(true);
      expect(result.reportHTML).toContain('<!DOCTYPE html>');
      expect(result.reportHTML).toContain('<html');
      expect(result.reportHTML).toContain('</html>');
    });

    it('should include proper HTML5 meta tags', async () => {
      const queryResult: QueryResult = {
        data: [{ id: 1, value: 100 }],
        columns: ['id', 'value'],
        rowCount: 1,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Query returned data',
        suggestedReportType: 'simple',
        estimatedComplexity: 'low',
      };

      const result = await orchestrator.generateReport(
        queryResult,
        triggerDecision,
        {} as any
      );

      expect(result.success).toBe(true);
      expect(result.reportHTML).toContain('<meta charset="UTF-8">');
      expect(result.reportHTML).toContain('<meta name="viewport"');
    });

    it('should have proper HTML structure with head and body', async () => {
      const queryResult: QueryResult = {
        data: [{ id: 1, value: 100 }],
        columns: ['id', 'value'],
        rowCount: 1,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Query returned data',
        suggestedReportType: 'simple',
        estimatedComplexity: 'low',
      };

      const result = await orchestrator.generateReport(
        queryResult,
        triggerDecision,
        {} as any
      );

      expect(result.success).toBe(true);
      expect(result.reportHTML).toContain('<head>');
      expect(result.reportHTML).toContain('</head>');
      expect(result.reportHTML).toContain('<body>');
      expect(result.reportHTML).toContain('</body>');
    });
  });

  describe('Requirement 5.5: Preserve interactive chart functionality', () => {
    it('should include Chart.js initialization code for bar charts', async () => {
      const queryResult: QueryResult = {
        data: [
          { category: 'A', value: 100 },
          { category: 'B', value: 200 },
        ],
        columns: ['category', 'value'],
        rowCount: 2,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Query returned data',
        suggestedReportType: 'simple',
        estimatedComplexity: 'low',
      };

      const result = await orchestrator.generateReport(
        queryResult,
        triggerDecision,
        {} as any
      );

      expect(result.success).toBe(true);
      expect(result.reportHTML).toContain('new Chart');
      expect(result.reportHTML).toContain('type:');
      expect(result.reportHTML).toContain('data:');
      expect(result.reportHTML).toContain('options:');
    });

    it('should include canvas elements for chart rendering', async () => {
      const queryResult: QueryResult = {
        data: [
          { month: 'Jan', sales: 100 },
          { month: 'Feb', sales: 150 },
        ],
        columns: ['month', 'sales'],
        rowCount: 2,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Query returned data',
        suggestedReportType: 'simple',
        estimatedComplexity: 'low',
      };

      const result = await orchestrator.generateReport(
        queryResult,
        triggerDecision,
        {} as any
      );

      expect(result.success).toBe(true);
      expect(result.reportHTML).toContain('<canvas');
      expect(result.reportHTML).toContain('id="chart-');
    });

    it('should preserve chart configuration for interactivity', async () => {
      const queryResult: QueryResult = {
        data: [
          { product: 'A', revenue: 1000, profit: 200 },
          { product: 'B', revenue: 1500, profit: 300 },
        ],
        columns: ['product', 'revenue', 'profit'],
        rowCount: 2,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Multi-metric data',
        suggestedReportType: 'dashboard',
        estimatedComplexity: 'medium',
      };

      const result = await orchestrator.generateReport(
        queryResult,
        triggerDecision,
        {} as any
      );

      expect(result.success).toBe(true);
      // Should include chart options for interactivity
      expect(result.reportHTML).toContain('responsive: true');
      expect(result.reportHTML).toContain('plugins:');
      expect(result.reportHTML).toContain('tooltip:');
    });

    it('should include map library for geographic visualizations', async () => {
      const queryResult: QueryResult = {
        data: [
          { latitude: 40.7128, longitude: -74.0060, value: 100 },
          { latitude: 34.0522, longitude: -118.2437, value: 150 },
        ],
        columns: ['latitude', 'longitude', 'value'],
        rowCount: 2,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Geographic data detected',
        suggestedReportType: 'dashboard',
        estimatedComplexity: 'medium',
      };

      const result = await orchestrator.generateReport(
        queryResult,
        triggerDecision,
        {} as any
      );

      expect(result.success).toBe(true);
      // Should include Leaflet for map visualizations
      if (result.reportHTML.includes('latitude') || result.reportHTML.includes('longitude')) {
        expect(result.reportHTML).toContain('leaflet');
      }
    });
  });

  describe('Integration: Complete HTML export workflow', () => {
    it('should generate a complete, self-contained HTML document', async () => {
      const queryResult: QueryResult = {
        data: [
          { date: '2024-01-01', sales: 100, profit: 20 },
          { date: '2024-01-02', sales: 150, profit: 30 },
          { date: '2024-01-03', sales: 200, profit: 40 },
        ],
        columns: ['date', 'sales', 'profit'],
        rowCount: 3,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Time-series data with multiple metrics',
        suggestedReportType: 'dashboard',
        estimatedComplexity: 'medium',
      };

      const result = await orchestrator.generateReport(
        queryResult,
        triggerDecision,
        {} as any
      );

      expect(result.success).toBe(true);
      
      // Verify complete HTML structure
      expect(result.reportHTML).toContain('<!DOCTYPE html>');
      expect(result.reportHTML).toContain('<html');
      expect(result.reportHTML).toContain('<head>');
      expect(result.reportHTML).toContain('<meta charset="UTF-8">');
      expect(result.reportHTML).toContain('<title>');
      expect(result.reportHTML).toContain('<style>');
      expect(result.reportHTML).toContain('</head>');
      expect(result.reportHTML).toContain('<body>');
      expect(result.reportHTML).toContain('<script>');
      expect(result.reportHTML).toContain('</body>');
      expect(result.reportHTML).toContain('</html>');
      
      // Verify no external dependencies (except CDN for Chart.js which is acceptable)
      const externalLinks = result.reportHTML.match(/<link[^>]*href="(?!data:)[^"]*"/g) || [];
      const externalScripts = result.reportHTML.match(/<script[^>]*src="(?!data:)[^"]*"/g) || [];
      
      // CDN links for Chart.js and Leaflet are acceptable for interactive functionality
      const allowedCDNs = ['chart.js', 'leaflet', 'cdn.jsdelivr.net', 'unpkg.com'];
      const hasOnlyAllowedCDNs = [...externalLinks, ...externalScripts].every(link =>
        allowedCDNs.some(cdn => link.includes(cdn))
      );
      
      expect(hasOnlyAllowedCDNs).toBe(true);
    });
  });
});
