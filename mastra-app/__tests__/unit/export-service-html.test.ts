/**
 * Integration tests for ExportService HTML export
 * Task 8.1: Add HTML export capability
 * 
 * Tests verify the ExportService.exportToHTML() method properly:
 * - Embeds all CSS inline
 * - Embeds all JavaScript inline
 * - Generates valid HTML5 documents
 * - Preserves interactive functionality
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { ExportService } from '@/services/export-service';
import type { DashboardLayout } from '@/types';

describe('ExportService HTML Export', () => {
  describe('Requirement 5.2, 5.3: Inline asset embedding', () => {
    it('should embed CSS inline in exported HTML', () => {
      const dashboard: DashboardLayout = {
        title: 'Test Dashboard',
        description: 'Test description',
        sections: [
          {
            id: 'stats',
            title: 'Statistics',
            type: 'stats',
            width: 'full',
            content: {
              statsCards: [
                { label: 'Total', value: 100, color: 'blue' },
                { label: 'Average', value: 50, color: 'green' },
              ],
            },
          },
        ],
        filters: [],
        exportOptions: [],
      };

      const data = [
        { id: 1, value: 100 },
        { id: 2, value: 200 },
      ];

      // Create a spy to track createElement calls
      const createElementSpy = vi.spyOn(document, 'createElement');

      // Call exportToHTML
      ExportService.exportToHTML(dashboard, 'test-export.html', data);

      // Verify the method was called (actual HTML generation is tested in other tests)
      expect(createElementSpy).toHaveBeenCalledWith('a');
      
      // Restore spy
      createElementSpy.mockRestore();
    });

    it('should generate HTML with embedded styles', () => {
      const exportService = new (ExportService as any)();
      const dashboard: DashboardLayout = {
        title: 'Style Test',
        description: 'Testing embedded styles',
        sections: [],
        filters: [],
        exportOptions: [],
      };

      const html = exportService.generateStandaloneHtml(dashboard, []);

      // Verify inline styles are present
      expect(html).toContain('<style>');
      expect(html).toContain('</style>');
      expect(html).toContain('font-family:');
      expect(html).toContain('background:');
      expect(html).toContain('.dashboard-container');
      
      // Should not have external stylesheet links
      expect(html).not.toMatch(/<link[^>]*rel="stylesheet"[^>]*href="(?!data:)/);
    });

    it('should generate HTML with embedded JavaScript', () => {
      const exportService = new (ExportService as any)();
      const dashboard: DashboardLayout = {
        title: 'JS Test',
        description: 'Testing embedded JavaScript',
        sections: [],
        filters: [],
        exportOptions: [],
      };

      const html = exportService.generateStandaloneHtml(dashboard, []);

      // Verify inline JavaScript is present
      expect(html).toContain('<script>');
      expect(html).toContain('</script>');
      expect(html).toContain('function');
      expect(html).toContain('initializeDashboard');
      
      // Should embed data as JSON
      expect(html).toContain('dashboardData');
      expect(html).toContain('dashboardConfig');
    });

    it('should embed data as inline JSON', () => {
      const exportService = new (ExportService as any)();
      const dashboard: DashboardLayout = {
        title: 'Data Test',
        description: 'Testing data embedding',
        sections: [],
        filters: [],
        exportOptions: [],
      };

      const data = [
        { id: 1, name: 'Item 1', value: 100 },
        { id: 2, name: 'Item 2', value: 200 },
      ];

      const html = exportService.generateStandaloneHtml(dashboard, data);

      // Verify data is embedded as JSON
      expect(html).toContain('const dashboardData =');
      expect(html).toContain('"id":1');
      expect(html).toContain('"name":"Item 1"');
      expect(html).toContain('"value":100');
    });
  });

  describe('Requirement 5.4: Valid HTML5 documents', () => {
    it('should generate valid HTML5 with proper DOCTYPE', () => {
      const exportService = new (ExportService as any)();
      const dashboard: DashboardLayout = {
        title: 'HTML5 Test',
        description: 'Testing HTML5 validity',
        sections: [],
        filters: [],
        exportOptions: [],
      };

      const html = exportService.generateStandaloneHtml(dashboard, []);

      // Verify HTML5 structure
      expect(html).toMatch(/^<!DOCTYPE html>/);
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('</html>');
    });

    it('should include required meta tags', () => {
      const exportService = new (ExportService as any)();
      const dashboard: DashboardLayout = {
        title: 'Meta Tags Test',
        description: 'Testing meta tags',
        sections: [],
        filters: [],
        exportOptions: [],
      };

      const html = exportService.generateStandaloneHtml(dashboard, []);

      // Verify meta tags
      expect(html).toContain('<meta charset="UTF-8">');
      expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
      expect(html).toContain('<title>Meta Tags Test</title>');
    });

    it('should have proper HTML structure', () => {
      const exportService = new (ExportService as any)();
      const dashboard: DashboardLayout = {
        title: 'Structure Test',
        description: 'Testing HTML structure',
        sections: [],
        filters: [],
        exportOptions: [],
      };

      const html = exportService.generateStandaloneHtml(dashboard, []);

      // Verify structure
      const headIndex = html.indexOf('<head>');
      const headCloseIndex = html.indexOf('</head>');
      const bodyIndex = html.indexOf('<body>');
      const bodyCloseIndex = html.indexOf('</body>');

      expect(headIndex).toBeGreaterThan(0);
      expect(headCloseIndex).toBeGreaterThan(headIndex);
      expect(bodyIndex).toBeGreaterThan(headCloseIndex);
      expect(bodyCloseIndex).toBeGreaterThan(bodyIndex);
    });

    it('should escape HTML special characters in content', () => {
      const exportService = new (ExportService as any)();
      const dashboard: DashboardLayout = {
        title: 'Test <script>alert("XSS")</script>',
        description: 'Test & "quotes" \'apostrophes\'',
        sections: [
          {
            id: 'test',
            title: 'Section <b>Title</b>',
            type: 'insights',
            width: 'full',
            content: {
              insights: ['Insight with <tags> & special "chars"'],
            },
          },
        ],
        filters: [],
        exportOptions: [],
      };

      const html = exportService.generateStandaloneHtml(dashboard, []);

      // Verify HTML escaping
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&amp;');
      expect(html).toContain('&quot;');
      expect(html).not.toContain('<script>alert("XSS")</script>');
    });
  });

  describe('Requirement 5.5: Preserve interactive functionality', () => {
    it('should include interactive table sorting functionality', () => {
      const exportService = new (ExportService as any)();
      const dashboard: DashboardLayout = {
        title: 'Interactive Test',
        description: 'Testing interactivity',
        sections: [
          {
            id: 'table',
            title: 'Data Table',
            type: 'table',
            width: 'full',
            content: {
              tableConfig: {
                columns: ['id', 'name', 'value'],
              },
            },
          },
        ],
        filters: [],
        exportOptions: [],
      };

      const data = [
        { id: 1, name: 'Item 1', value: 100 },
        { id: 2, name: 'Item 2', value: 200 },
      ];

      const html = exportService.generateStandaloneHtml(dashboard, data);

      // Verify interactive functionality
      expect(html).toContain('sortTable');
      expect(html).toContain('addEventListener');
      expect(html).toContain('click');
    });

    it('should include DOMContentLoaded event for initialization', () => {
      const exportService = new (ExportService as any)();
      const dashboard: DashboardLayout = {
        title: 'Init Test',
        description: 'Testing initialization',
        sections: [],
        filters: [],
        exportOptions: [],
      };

      const html = exportService.generateStandaloneHtml(dashboard, []);

      // Verify initialization
      expect(html).toContain('DOMContentLoaded');
      expect(html).toContain('initializeDashboard');
    });

    it('should preserve dashboard configuration for client-side use', () => {
      const exportService = new (ExportService as any)();
      const dashboard: DashboardLayout = {
        title: 'Config Test',
        description: 'Testing configuration preservation',
        sections: [
          {
            id: 'stats',
            title: 'Stats',
            type: 'stats',
            width: 'full',
            content: {
              statsCards: [{ label: 'Total', value: 100, color: 'blue' }],
            },
          },
        ],
        filters: [],
        exportOptions: [],
      };

      const html = exportService.generateStandaloneHtml(dashboard, []);

      // Verify configuration is embedded
      expect(html).toContain('const dashboardConfig =');
      expect(html).toContain('"title":"Config Test"');
      expect(html).toContain('"sections"');
    });
  });

  describe('Integration: Complete export workflow', () => {
    it('should generate a complete self-contained HTML document', () => {
      const exportService = new (ExportService as any)();
      const dashboard: DashboardLayout = {
        title: 'Complete Dashboard',
        description: 'A comprehensive test dashboard',
        sections: [
          {
            id: 'stats',
            title: 'Key Metrics',
            type: 'stats',
            width: 'full',
            content: {
              statsCards: [
                { label: 'Total Records', value: 1000, color: 'blue' },
                { label: 'Average Value', value: 250, color: 'green' },
                { label: 'Max Value', value: 500, color: 'orange' },
              ],
            },
          },
          {
            id: 'table',
            title: 'Data Table',
            type: 'table',
            width: 'full',
            content: {
              tableConfig: {
                columns: ['id', 'name', 'value', 'category'],
              },
            },
          },
          {
            id: 'insights',
            title: 'Key Insights',
            type: 'insights',
            width: 'full',
            content: {
              insights: [
                'Total value increased by 25% compared to last period',
                'Category A shows the highest growth rate',
                'Data quality is excellent with no missing values',
              ],
            },
          },
        ],
        filters: [],
        exportOptions: [],
      };

      const data = [
        { id: 1, name: 'Item 1', value: 100, category: 'A' },
        { id: 2, name: 'Item 2', value: 200, category: 'B' },
        { id: 3, name: 'Item 3', value: 300, category: 'A' },
      ];

      const html = exportService.generateStandaloneHtml(dashboard, data);

      // Verify complete structure
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<head>');
      expect(html).toContain('<meta charset="UTF-8">');
      expect(html).toContain('<title>Complete Dashboard</title>');
      expect(html).toContain('<style>');
      expect(html).toContain('</head>');
      expect(html).toContain('<body>');
      expect(html).toContain('<div class="dashboard-container">');
      expect(html).toContain('<header class="dashboard-header">');
      expect(html).toContain('<h1>Complete Dashboard</h1>');
      expect(html).toContain('<script>');
      expect(html).toContain('</body>');
      expect(html).toContain('</html>');

      // Verify all sections are rendered
      expect(html).toContain('Key Metrics');
      expect(html).toContain('Data Table');
      expect(html).toContain('Key Insights');

      // Verify stats cards
      expect(html).toContain('Total Records');
      expect(html).toContain('1000');

      // Verify table
      expect(html).toContain('<table');
      expect(html).toContain('<thead>');
      expect(html).toContain('<tbody>');

      // Verify insights
      expect(html).toContain('Total value increased by 25%');

      // Verify data is embedded
      expect(html).toContain('const dashboardData =');
      expect(html).toContain('"id":1');

      // Verify no external dependencies (except allowed CDNs)
      const externalLinks = html.match(/<link[^>]*href="(?!data:)[^"]*"/g) || [];
      const externalScripts = html.match(/<script[^>]*src="(?!data:)[^"]*"/g) || [];
      
      // Should have no external links or scripts in this case
      expect(externalLinks.length).toBe(0);
      expect(externalScripts.length).toBe(0);
    });

    it('should handle empty data gracefully', () => {
      const exportService = new (ExportService as any)();
      const dashboard: DashboardLayout = {
        title: 'Empty Dashboard',
        description: 'Dashboard with no data',
        sections: [],
        filters: [],
        exportOptions: [],
      };

      const html = exportService.generateStandaloneHtml(dashboard, []);

      // Should still generate valid HTML
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('Empty Dashboard');
      expect(html).toContain('const dashboardData = []');
    });

    it('should handle large datasets efficiently', () => {
      const exportService = new (ExportService as any)();
      const dashboard: DashboardLayout = {
        title: 'Large Dataset',
        description: 'Testing with large data',
        sections: [
          {
            id: 'table',
            title: 'Data',
            type: 'table',
            width: 'full',
            content: {
              tableConfig: {
                columns: ['id', 'value'],
              },
            },
          },
        ],
        filters: [],
        exportOptions: [],
      };

      // Generate 500 rows of data
      const data = Array.from({ length: 500 }, (_, i) => ({
        id: i + 1,
        value: Math.random() * 1000,
      }));

      const html = exportService.generateStandaloneHtml(dashboard, data);

      // Should generate HTML successfully
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Large Dataset');
      
      // Should limit displayed rows (first 100)
      expect(html).toContain('Showing first 100 of 500 rows');
      
      // But should embed all data for potential client-side use
      expect(html).toContain('const dashboardData =');
    });
  });
});
