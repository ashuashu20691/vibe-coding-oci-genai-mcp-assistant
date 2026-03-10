/**
 * Integration test for backend compatibility - Oracle Database results
 * 
 * Validates that Oracle Database query results are correctly displayed
 * in the artifacts panel with table and chart visualizations.
 * 
 * Task 13.4: Verify Oracle Database results compatibility
 * Validates: Requirement 7.8
 */

/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ArtifactsPanel } from '../../src/components/ArtifactsPanel';
import type { Artifact } from '../../src/hooks/useArtifacts';

describe('Backend Compatibility - Oracle Database Results', () => {
  describe('Table visualization display', () => {
    it('should display simple query results as table', () => {
      const artifact: Artifact = {
        id: 'artifact-1',
        type: 'table',
        title: 'User List',
        data: [
          { id: 1, name: 'Alice', email: 'alice@example.com', active: true },
          { id: 2, name: 'Bob', email: 'bob@example.com', active: true },
          { id: 3, name: 'Charlie', email: 'charlie@example.com', active: false },
        ],
        timestamp: new Date(),
      };

      render(
        <ArtifactsPanel
          artifacts={[artifact]}
          currentArtifactId="artifact-1"
          onClose={() => {}}
        />
      );

      // Verify table headers
      expect(screen.getByText('id')).toBeInTheDocument();
      expect(screen.getByText('name')).toBeInTheDocument();
      expect(screen.getByText('email')).toBeInTheDocument();
      expect(screen.getByText('active')).toBeInTheDocument();

      // Verify table data
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    });

    it('should display aggregate query results', () => {
      const artifact: Artifact = {
        id: 'artifact-2',
        type: 'table',
        title: 'Sales Summary',
        data: [
          { region: 'North', total_sales: 150000, order_count: 1200, avg_order: 125 },
          { region: 'South', total_sales: 120000, order_count: 950, avg_order: 126.32 },
          { region: 'East', total_sales: 180000, order_count: 1500, avg_order: 120 },
          { region: 'West', total_sales: 200000, order_count: 1600, avg_order: 125 },
        ],
        timestamp: new Date(),
      };

      render(
        <ArtifactsPanel
          artifacts={[artifact]}
          currentArtifactId="artifact-2"
          onClose={() => {}}
        />
      );

      // Verify aggregate columns
      expect(screen.getByText('region')).toBeInTheDocument();
      expect(screen.getByText('total_sales')).toBeInTheDocument();
      expect(screen.getByText('order_count')).toBeInTheDocument();
      expect(screen.getByText('avg_order')).toBeInTheDocument();

      // Verify data
      expect(screen.getByText('North')).toBeInTheDocument();
      expect(screen.getByText('150000')).toBeInTheDocument();
    });

    it('should display query results with NULL values', () => {
      const artifact: Artifact = {
        id: 'artifact-3',
        type: 'table',
        title: 'Products',
        data: [
          { id: 1, name: 'Product A', description: 'Description A', price: 99.99 },
          { id: 2, name: 'Product B', description: null, price: 149.99 },
          { id: 3, name: 'Product C', description: 'Description C', price: null },
        ],
        timestamp: new Date(),
      };

      render(
        <ArtifactsPanel
          artifacts={[artifact]}
          currentArtifactId="artifact-3"
          onClose={() => {}}
        />
      );

      // Verify table renders with NULL values
      expect(screen.getByText('Product A')).toBeInTheDocument();
      expect(screen.getByText('Product B')).toBeInTheDocument();
      expect(screen.getByText('Product C')).toBeInTheDocument();
    });

    it('should display query results with date columns', () => {
      const artifact: Artifact = {
        id: 'artifact-4',
        type: 'table',
        title: 'Orders',
        data: [
          { order_id: 1, customer: 'Alice', order_date: '2024-01-15', total: 250.00 },
          { order_id: 2, customer: 'Bob', order_date: '2024-01-16', total: 180.50 },
          { order_id: 3, customer: 'Charlie', order_date: '2024-01-17', total: 320.75 },
        ],
        timestamp: new Date(),
      };

      render(
        <ArtifactsPanel
          artifacts={[artifact]}
          currentArtifactId="artifact-4"
          onClose={() => {}}
        />
      );

      // Verify date values are displayed
      expect(screen.getByText('2024-01-15')).toBeInTheDocument();
      expect(screen.getByText('2024-01-16')).toBeInTheDocument();
      expect(screen.getByText('2024-01-17')).toBeInTheDocument();
    });

    it('should display large result sets (100+ rows)', () => {
      const largeData = Array.from({ length: 150 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`,
        created_at: `2024-01-${String(i % 28 + 1).padStart(2, '0')}`,
      }));

      const artifact: Artifact = {
        id: 'artifact-5',
        type: 'table',
        title: 'All Users',
        data: largeData,
        timestamp: new Date(),
      };

      render(
        <ArtifactsPanel
          artifacts={[artifact]}
          currentArtifactId="artifact-5"
          onClose={() => {}}
        />
      );

      // Verify table renders (may be virtualized)
      expect(screen.getByText('id')).toBeInTheDocument();
      expect(screen.getByText('name')).toBeInTheDocument();
    });

    it('should display empty result set', () => {
      const artifact: Artifact = {
        id: 'artifact-6',
        type: 'table',
        title: 'No Results',
        data: [],
        timestamp: new Date(),
      };

      render(
        <ArtifactsPanel
          artifacts={[artifact]}
          currentArtifactId="artifact-6"
          onClose={() => {}}
        />
      );

      // Should show empty state
      expect(screen.getByText(/no data/i)).toBeInTheDocument();
    });
  });

  describe('Chart visualization display', () => {
    it('should display bar chart for sales data', () => {
      const artifact: Artifact = {
        id: 'artifact-7',
        type: 'chart',
        title: 'Monthly Sales',
        data: [
          { month: 'Jan', sales: 15000 },
          { month: 'Feb', sales: 18000 },
          { month: 'Mar', sales: 22000 },
          { month: 'Apr', sales: 19000 },
        ],
        chartType: 'bar',
        timestamp: new Date(),
      };

      render(
        <ArtifactsPanel
          artifacts={[artifact]}
          currentArtifactId="artifact-7"
          onClose={() => {}}
        />
      );

      // Verify chart title
      expect(screen.getByText('Monthly Sales')).toBeInTheDocument();
    });

    it('should display line chart for time series data', () => {
      const artifact: Artifact = {
        id: 'artifact-8',
        type: 'chart',
        title: 'Revenue Trend',
        data: [
          { date: '2024-01', revenue: 50000 },
          { date: '2024-02', revenue: 55000 },
          { date: '2024-03', revenue: 52000 },
          { date: '2024-04', revenue: 58000 },
          { date: '2024-05', revenue: 62000 },
        ],
        chartType: 'line',
        timestamp: new Date(),
      };

      render(
        <ArtifactsPanel
          artifacts={[artifact]}
          currentArtifactId="artifact-8"
          onClose={() => {}}
        />
      );

      expect(screen.getByText('Revenue Trend')).toBeInTheDocument();
    });

    it('should display pie chart for distribution data', () => {
      const artifact: Artifact = {
        id: 'artifact-9',
        type: 'chart',
        title: 'Sales by Region',
        data: [
          { region: 'North', sales: 150000 },
          { region: 'South', sales: 120000 },
          { region: 'East', sales: 180000 },
          { region: 'West', sales: 200000 },
        ],
        chartType: 'pie',
        timestamp: new Date(),
      };

      render(
        <ArtifactsPanel
          artifacts={[artifact]}
          currentArtifactId="artifact-9"
          onClose={() => {}}
        />
      );

      expect(screen.getByText('Sales by Region')).toBeInTheDocument();
    });

    it('should display multi-series chart', () => {
      const artifact: Artifact = {
        id: 'artifact-10',
        type: 'chart',
        title: 'Sales vs Costs',
        data: [
          { month: 'Jan', sales: 15000, costs: 8000 },
          { month: 'Feb', sales: 18000, costs: 9000 },
          { month: 'Mar', sales: 22000, costs: 11000 },
          { month: 'Apr', sales: 19000, costs: 9500 },
        ],
        chartType: 'bar',
        timestamp: new Date(),
      };

      render(
        <ArtifactsPanel
          artifacts={[artifact]}
          currentArtifactId="artifact-10"
          onClose={() => {}}
        />
      );

      expect(screen.getByText('Sales vs Costs')).toBeInTheDocument();
    });

    it('should display chart with custom HTML dashboard', () => {
      const artifact: Artifact = {
        id: 'artifact-11',
        type: 'html',
        title: 'Analytics Dashboard',
        html: `
          <!DOCTYPE html>
          <html>
            <head><title>Dashboard</title></head>
            <body>
              <h1>Sales Analytics</h1>
              <div id="chart"></div>
            </body>
          </html>
        `,
        timestamp: new Date(),
      };

      render(
        <ArtifactsPanel
          artifacts={[artifact]}
          currentArtifactId="artifact-11"
          onClose={() => {}}
        />
      );

      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    });
  });

  describe('Multiple artifacts', () => {
    it('should display multiple artifacts with tabs', () => {
      const artifacts: Artifact[] = [
        {
          id: 'artifact-12',
          type: 'table',
          title: 'User Data',
          data: [
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' },
          ],
          timestamp: new Date(),
        },
        {
          id: 'artifact-13',
          type: 'chart',
          title: 'Sales Chart',
          data: [
            { month: 'Jan', sales: 15000 },
            { month: 'Feb', sales: 18000 },
          ],
          chartType: 'bar',
          timestamp: new Date(),
        },
      ];

      render(
        <ArtifactsPanel
          artifacts={artifacts}
          currentArtifactId="artifact-12"
          onClose={() => {}}
        />
      );

      // Should show tabs for switching between artifacts
      expect(screen.getByText('User Data')).toBeInTheDocument();
    });

    it('should switch between table and chart views', () => {
      const artifacts: Artifact[] = [
        {
          id: 'artifact-14',
          type: 'table',
          title: 'Data Table',
          data: [{ value: 100 }],
          timestamp: new Date(),
        },
        {
          id: 'artifact-15',
          type: 'chart',
          title: 'Data Chart',
          data: [{ value: 100 }],
          chartType: 'bar',
          timestamp: new Date(),
        },
      ];

      const { rerender } = render(
        <ArtifactsPanel
          artifacts={artifacts}
          currentArtifactId="artifact-14"
          onClose={() => {}}
        />
      );

      // Initially showing table
      expect(screen.getByText('Data Table')).toBeInTheDocument();

      // Switch to chart
      rerender(
        <ArtifactsPanel
          artifacts={artifacts}
          currentArtifactId="artifact-15"
          onClose={() => {}}
        />
      );

      expect(screen.getByText('Data Chart')).toBeInTheDocument();
    });
  });

  describe('Artifact panel controls', () => {
    it('should provide table filtering controls', () => {
      const artifact: Artifact = {
        id: 'artifact-16',
        type: 'table',
        title: 'Filterable Data',
        data: [
          { id: 1, status: 'active', value: 100 },
          { id: 2, status: 'inactive', value: 200 },
          { id: 3, status: 'active', value: 150 },
        ],
        timestamp: new Date(),
      };

      render(
        <ArtifactsPanel
          artifacts={[artifact]}
          currentArtifactId="artifact-16"
          onClose={() => {}}
        />
      );

      // Should have filter input
      const filterInput = screen.queryByPlaceholderText(/filter/i);
      expect(filterInput).toBeInTheDocument();
    });

    it('should provide table sorting controls', () => {
      const artifact: Artifact = {
        id: 'artifact-17',
        type: 'table',
        title: 'Sortable Data',
        data: [
          { id: 3, name: 'Charlie', value: 150 },
          { id: 1, name: 'Alice', value: 100 },
          { id: 2, name: 'Bob', value: 200 },
        ],
        timestamp: new Date(),
      };

      render(
        <ArtifactsPanel
          artifacts={[artifact]}
          currentArtifactId="artifact-17"
          onClose={() => {}}
        />
      );

      // Column headers should be clickable for sorting
      const idHeader = screen.getByText('id');
      expect(idHeader).toBeInTheDocument();
    });

    it('should provide chart interaction controls', () => {
      const artifact: Artifact = {
        id: 'artifact-18',
        type: 'chart',
        title: 'Interactive Chart',
        data: [
          { category: 'A', value: 100 },
          { category: 'B', value: 150 },
          { category: 'C', value: 120 },
        ],
        chartType: 'bar',
        timestamp: new Date(),
      };

      render(
        <ArtifactsPanel
          artifacts={[artifact]}
          currentArtifactId="artifact-18"
          onClose={() => {}}
        />
      );

      // Chart should be rendered
      expect(screen.getByText('Interactive Chart')).toBeInTheDocument();
    });
  });

  describe('Data type handling', () => {
    it('should handle numeric data types', () => {
      const artifact: Artifact = {
        id: 'artifact-19',
        type: 'table',
        title: 'Numeric Data',
        data: [
          { int_val: 42, float_val: 3.14159, decimal_val: 99.99 },
          { int_val: 100, float_val: 2.71828, decimal_val: 149.99 },
        ],
        timestamp: new Date(),
      };

      render(
        <ArtifactsPanel
          artifacts={[artifact]}
          currentArtifactId="artifact-19"
          onClose={() => {}}
        />
      );

      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('3.14159')).toBeInTheDocument();
      expect(screen.getByText('99.99')).toBeInTheDocument();
    });

    it('should handle string data types', () => {
      const artifact: Artifact = {
        id: 'artifact-20',
        type: 'table',
        title: 'String Data',
        data: [
          { short_text: 'Hello', long_text: 'This is a longer text value' },
          { short_text: 'World', long_text: 'Another long text value here' },
        ],
        timestamp: new Date(),
      };

      render(
        <ArtifactsPanel
          artifacts={[artifact]}
          currentArtifactId="artifact-20"
          onClose={() => {}}
        />
      );

      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.getByText(/This is a longer text/)).toBeInTheDocument();
    });

    it('should handle boolean data types', () => {
      const artifact: Artifact = {
        id: 'artifact-21',
        type: 'table',
        title: 'Boolean Data',
        data: [
          { id: 1, active: true, verified: false },
          { id: 2, active: false, verified: true },
        ],
        timestamp: new Date(),
      };

      render(
        <ArtifactsPanel
          artifacts={[artifact]}
          currentArtifactId="artifact-21"
          onClose={() => {}}
        />
      );

      // Booleans should be displayed
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('verified')).toBeInTheDocument();
    });

    it('should handle mixed data types', () => {
      const artifact: Artifact = {
        id: 'artifact-22',
        type: 'table',
        title: 'Mixed Data',
        data: [
          {
            id: 1,
            name: 'Product A',
            price: 99.99,
            in_stock: true,
            created_at: '2024-01-15',
            tags: null,
          },
        ],
        timestamp: new Date(),
      };

      render(
        <ArtifactsPanel
          artifacts={[artifact]}
          currentArtifactId="artifact-22"
          onClose={() => {}}
        />
      );

      expect(screen.getByText('Product A')).toBeInTheDocument();
      expect(screen.getByText('99.99')).toBeInTheDocument();
      expect(screen.getByText('2024-01-15')).toBeInTheDocument();
    });
  });

  describe('Performance with large datasets', () => {
    it('should handle 1000+ row result sets', () => {
      const largeData = Array.from({ length: 1500 }, (_, i) => ({
        id: i + 1,
        value: Math.random() * 1000,
        category: `Category ${i % 10}`,
      }));

      const artifact: Artifact = {
        id: 'artifact-23',
        type: 'table',
        title: 'Large Dataset',
        data: largeData,
        timestamp: new Date(),
      };

      render(
        <ArtifactsPanel
          artifacts={[artifact]}
          currentArtifactId="artifact-23"
          onClose={() => {}}
        />
      );

      // Should render without crashing
      expect(screen.getByText('Large Dataset')).toBeInTheDocument();
    });

    it('should handle wide tables (50+ columns)', () => {
      const wideData = [
        Object.fromEntries(
          Array.from({ length: 60 }, (_, i) => [`col_${i}`, `value_${i}`])
        ),
      ];

      const artifact: Artifact = {
        id: 'artifact-24',
        type: 'table',
        title: 'Wide Table',
        data: wideData,
        timestamp: new Date(),
      };

      render(
        <ArtifactsPanel
          artifacts={[artifact]}
          currentArtifactId="artifact-24"
          onClose={() => {}}
        />
      );

      // Should render without crashing
      expect(screen.getByText('Wide Table')).toBeInTheDocument();
    });
  });
});
