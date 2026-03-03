// __tests__/unit/dashboard-composer.test.ts

import { DashboardComposer, PERFORMANCE_COLORS } from '@/services/dashboard-composer';
import { AnalysisCategory, DataProfile } from '@/types';
import { SelectionResult } from '@/services/visualization-selector';

describe('DashboardComposer - Professional HTML Generation', () => {
  let composer: DashboardComposer;

  beforeEach(() => {
    composer = new DashboardComposer();
  });

  describe('Responsive Layout Generation (Requirement 9.1)', () => {
    it('should generate responsive HTML with viewport meta tag', () => {
      const content = '<div>Test Content</div>';
      const title = 'Test Dashboard';
      
      const html = composer.generateResponsiveLayout(content, title);
      
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
      expect(html).toContain('<title>Test Dashboard</title>');
      expect(html).toContain(content);
    });

    it('should include responsive CSS with media queries', () => {
      const html = composer.generateResponsiveLayout('<div>Content</div>', 'Dashboard');
      
      expect(html).toContain('@media (max-width: 768px)');
      expect(html).toContain('@media (max-width: 480px)');
      expect(html).toContain('@media print');
    });

    it('should escape HTML in title', () => {
      const html = composer.generateResponsiveLayout('<div>Content</div>', '<script>alert("xss")</script>');
      
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>alert');
    });
  });

  describe('Image Embedding with Alt Text (Requirement 9.2)', () => {
    it('should embed image with alt text', () => {
      const config = {
        src: 'https://example.com/image.jpg',
        alt: 'Sample image description',
      };
      
      const html = composer.embedImage(config);
      
      expect(html).toContain('<img');
      expect(html).toContain('src="https://example.com/image.jpg"');
      expect(html).toContain('alt="Sample image description"');
      expect(html).toContain('class="embedded-image"');
    });

    it('should include width and height attributes when provided', () => {
      const config = {
        src: 'image.jpg',
        alt: 'Test image',
        width: 800,
        height: 600,
      };
      
      const html = composer.embedImage(config);
      
      expect(html).toContain('width="800"');
      expect(html).toContain('height="600"');
    });

    it('should include caption when provided', () => {
      const config = {
        src: 'image.jpg',
        alt: 'Test image',
        caption: 'This is a test caption',
      };
      
      const html = composer.embedImage(config);
      
      expect(html).toContain('<p class="image-caption">This is a test caption</p>');
    });

    it('should escape HTML in alt text and caption', () => {
      const config = {
        src: 'image.jpg',
        alt: '<script>alert("xss")</script>',
        caption: '<b>Bold</b> text',
      };
      
      const html = composer.embedImage(config);
      
      expect(html).toContain('alt="&lt;script&gt;');
      expect(html).toContain('&lt;b&gt;Bold&lt;/b&gt;');
    });

    it('should warn when alt text is missing', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      composer.embedImage({ src: 'image.jpg', alt: '' });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Image embedded without alt text')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Number Formatting with Precision (Requirement 9.3)', () => {
    it('should format percentages with 1-2 decimal places', () => {
      expect(composer.formatNumber(85.5, { type: 'percentage' })).toBe('85.5%');
      expect(composer.formatNumber(85.567, { type: 'percentage', precision: 2 })).toBe('85.57%');
      expect(composer.formatNumber(100, { type: 'percentage' })).toBe('100.0%');
    });

    it('should format currency with 2 decimal places', () => {
      const result = composer.formatNumber(1234.56, { type: 'currency' });
      expect(result).toContain('1,234.56');
      expect(result).toContain('$');
    });

    it('should format counts with 0 decimal places', () => {
      expect(composer.formatNumber(1234567, { type: 'count' })).toBe('1,234,567');
      expect(composer.formatNumber(42.9, { type: 'count' })).toBe('43');
    });

    it('should format decimals with configurable precision', () => {
      expect(composer.formatNumber(3.14159, { type: 'decimal' })).toBe('3.14');
      expect(composer.formatNumber(3.14159, { type: 'decimal', precision: 4 })).toBe('3.1416');
    });
  });

  describe('Color-Coded Performance Indicators (Requirement 9.4)', () => {
    it('should generate green indicators for grades A and B', () => {
      const gradeA = composer.generatePerformanceGrade('A');
      const gradeB = composer.generatePerformanceGrade('B');
      
      expect(gradeA).toContain('grade-a');
      expect(gradeA).toContain('>A</span>');
      expect(gradeB).toContain('grade-b');
    });

    it('should generate yellow indicator for grade C', () => {
      const gradeC = composer.generatePerformanceGrade('C');
      
      expect(gradeC).toContain('grade-c');
      expect(gradeC).toContain('>C</span>');
    });

    it('should generate red indicators for grades D and F', () => {
      const gradeD = composer.generatePerformanceGrade('D');
      const gradeF = composer.generatePerformanceGrade('F');
      
      expect(gradeD).toContain('grade-d');
      expect(gradeF).toContain('grade-f');
    });

    it('should include label when provided', () => {
      const html = composer.generatePerformanceGrade('A', 'Excellent');
      
      expect(html).toContain('A - Excellent');
    });

    it('should verify PERFORMANCE_COLORS constant mapping', () => {
      expect(PERFORMANCE_COLORS.A).toBe('#4caf50'); // Green
      expect(PERFORMANCE_COLORS.B).toBe('#4caf50'); // Green
      expect(PERFORMANCE_COLORS.C).toBe('#ffc107'); // Yellow
      expect(PERFORMANCE_COLORS.D).toBe('#f44336'); // Red
      expect(PERFORMANCE_COLORS.F).toBe('#f44336'); // Red
    });
  });

  describe('Clear Section Headers and Visual Hierarchy (Requirement 9.5)', () => {
    it('should generate section with header and content', () => {
      const html = composer.generateSection('Test Section', '<p>Content</p>');
      
      expect(html).toContain('<section class="dashboard-section"');
      expect(html).toContain('<div class="section-header">');
      expect(html).toContain('<h2>Test Section</h2>');
      expect(html).toContain('<div class="section-content">');
      expect(html).toContain('<p>Content</p>');
    });

    it('should include ID attribute when provided', () => {
      const html = composer.generateSection('Test', '<p>Content</p>', 'test-section');
      
      expect(html).toContain('id="test-section"');
    });

    it('should escape HTML in section title', () => {
      const html = composer.generateSection('<script>alert("xss")</script>', '<p>Content</p>');
      
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('Metric Generation', () => {
    it('should generate metric with formatted value and label', () => {
      const html = composer.generateMetric('Total Revenue', 1234567.89, { type: 'currency' });
      
      expect(html).toContain('<div class="metric">');
      expect(html).toContain('<div class="metric-value">');
      expect(html).toContain('1,234,567.89');
      expect(html).toContain('<div class="metric-label">Total Revenue</div>');
    });

    it('should format percentage metrics correctly', () => {
      const html = composer.generateMetric('Success Rate', 95.5, { type: 'percentage' });
      
      expect(html).toContain('95.5%');
      expect(html).toContain('Success Rate');
    });
  });

  describe('Data Table Generation', () => {
    it('should generate table with data', () => {
      const data = [
        { name: 'Alice', score: 95, grade: 'A' },
        { name: 'Bob', score: 82, grade: 'B' },
      ];
      const columns = ['name', 'score', 'grade'];
      
      const html = composer.generateDataTable(data, columns);
      
      expect(html).toContain('<table>');
      expect(html).toContain('<thead>');
      expect(html).toContain('<th>name</th>');
      expect(html).toContain('<th>score</th>');
      expect(html).toContain('<th>grade</th>');
      expect(html).toContain('Alice');
      expect(html).toContain('Bob');
    });

    it('should apply performance grade formatting to grade column', () => {
      const data = [
        { name: 'Alice', grade: 'A' },
        { name: 'Bob', grade: 'C' },
        { name: 'Charlie', grade: 'F' },
      ];
      
      const html = composer.generateDataTable(data, ['name', 'grade'], 'grade');
      
      expect(html).toContain('grade-a');
      expect(html).toContain('grade-c');
      expect(html).toContain('grade-f');
    });

    it('should format numeric values with precision', () => {
      const data = [
        { name: 'Test', value: 123.456789 },
      ];
      
      const html = composer.generateDataTable(data, ['name', 'value']);
      
      expect(html).toContain('123.46');
    });

    it('should handle empty data', () => {
      const html = composer.generateDataTable([], []);
      
      expect(html).toContain('No data available');
    });

    it('should escape HTML in cell values', () => {
      const data = [
        { name: '<script>alert("xss")</script>' },
      ];
      
      const html = composer.generateDataTable(data, ['name']);
      
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>alert');
    });
  });

  describe('Integration - Complete Dashboard', () => {
    it('should compose dashboard with all enhanced features', () => {
      const selectionResult: SelectionResult = {
        primary: {
          type: 'bar_chart',
          title: 'Sales by Region',
          priority: 1,
          dataKey: 'sales',
          config: {},
        },
        secondary: [],
        statsCards: [
          { label: 'Total Sales', value: 1000000, color: 'blue' },
          { label: 'Growth Rate', value: '15.5%', color: 'green' },
        ],
      };

      const data = [
        { region: 'North', sales: 50000, grade: 'A' },
        { region: 'South', sales: 30000, grade: 'C' },
      ];

      const profile: DataProfile = {
        recordCount: 2,
        columnStats: [],
        dataTypes: {},
      };

      const categories: AnalysisCategory[] = ['categorical_comparison'];

      const dashboard = composer.compose(selectionResult, data, profile, categories);

      expect(dashboard.title).toBe('Categorical Comparison Dashboard');
      expect(dashboard.sections.length).toBeGreaterThan(0);
      expect(dashboard.exportOptions).toContainEqual({ format: 'html', label: 'Export as HTML' });
    });
  });
});
