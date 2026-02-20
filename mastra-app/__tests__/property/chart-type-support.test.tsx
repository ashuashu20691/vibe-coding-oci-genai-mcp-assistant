/**
 * Property Test: Chart Type Support
 * 
 * Feature: claude-desktop-alternative, Property 13: Chart Type Support
 * 
 * *For any* of the supported chart types (bar, line, pie, scatter, area),
 * providing valid data SHALL produce a renderable chart without errors.
 * 
 * **Validates: Requirements 5.2**
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { render } from '@testing-library/react';
import { Chart, ChartType } from '@/components/Chart';

// Mock ResizeObserver for Recharts ResponsiveContainer
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  global.ResizeObserver = ResizeObserverMock;
});

// ============================================================================
// Supported Chart Types
// ============================================================================

const SUPPORTED_CHART_TYPES: ChartType[] = [
  'bar_chart',
  'line_chart',
  'pie_chart',
  'scatter_chart',
  'area_chart',
];

// ============================================================================
// Arbitraries for generating valid chart data
// ============================================================================

/**
 * Arbitrary for generating valid category labels
 */
const categoryLabelArb = fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,19}$/).filter(s => s.trim().length > 0);

/**
 * Arbitrary for generating valid numeric values for charts
 * Excludes NaN, Infinity, and very extreme values that could cause rendering issues
 */
const chartValueArb = fc.double({ 
  min: 0, 
  max: 100000, 
  noNaN: true,
  noDefaultInfinity: true,
});

/**
 * Arbitrary for generating positive numeric values (for pie charts)
 */
const positiveValueArb = fc.double({ 
  min: 0.01, 
  max: 100000, 
  noNaN: true,
  noDefaultInfinity: true,
});

/**
 * Arbitrary for generating x/y coordinate values for scatter charts
 */
const coordinateValueArb = fc.double({ 
  min: -10000, 
  max: 10000, 
  noNaN: true,
  noDefaultInfinity: true,
});

/**
 * Arbitrary for generating a single categorical data row
 */
const categoricalRowArb = fc.record({
  category: categoryLabelArb,
  value: chartValueArb,
});

/**
 * Arbitrary for generating a single scatter data row
 */
const scatterRowArb = fc.record({
  x: coordinateValueArb,
  y: coordinateValueArb,
});

/**
 * Arbitrary for generating a single pie chart data row (positive values only)
 */
const pieRowArb = fc.record({
  category: categoryLabelArb,
  value: positiveValueArb,
});

/**
 * Arbitrary for generating categorical chart data (bar, line, area)
 * Requires at least 2 data points for line/area charts
 */
const categoricalDataArb = (minRows: number = 2) => 
  fc.array(categoricalRowArb, { minLength: minRows, maxLength: 20 })
    .map(rows => {
      // Ensure unique categories by appending index
      return rows.map((row, index) => ({
        ...row,
        category: `${row.category}_${index}`,
      }));
    });

/**
 * Arbitrary for generating scatter chart data
 * Requires at least 2 data points
 */
const scatterDataArb = fc.array(scatterRowArb, { minLength: 2, maxLength: 20 });

/**
 * Arbitrary for generating pie chart data
 * Requires at least 1 data point with positive values
 */
const pieDataArb = fc.array(pieRowArb, { minLength: 1, maxLength: 10 })
  .map(rows => {
    // Ensure unique categories by appending index
    return rows.map((row, index) => ({
      ...row,
      category: `${row.category}_${index}`,
    }));
  });

/**
 * Arbitrary for generating chart titles
 */
const chartTitleArb = fc.option(
  fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,49}$/),
  { nil: undefined }
);

/**
 * Arbitrary for selecting a chart type
 */
const chartTypeArb = fc.constantFrom(...SUPPORTED_CHART_TYPES);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Checks if a chart rendered successfully without errors
 */
function chartRenderedSuccessfully(container: HTMLElement): boolean {
  // Check for chart container (successful render)
  const chartContainer = container.querySelector('.chart-container');
  
  // Check for error states
  const emptyState = container.querySelector('.chart-empty');
  const unsupportedState = container.querySelector('.chart-unsupported');
  
  // Chart is successful if container exists and no error states
  return chartContainer !== null && emptyState === null && unsupportedState === null;
}

/**
 * Gets the appropriate data and columns for a chart type
 */
function getChartConfig(chartType: ChartType, data: Record<string, unknown>[]) {
  if (chartType === 'scatter_chart') {
    return { xColumn: 'x', yColumn: 'y' };
  }
  return { xColumn: 'category', yColumn: 'value' };
}

// ============================================================================
// Property Tests
// ============================================================================

describe('Property 13: Chart Type Support', () => {
  describe('All Supported Chart Types Render Without Errors', () => {
    it('should render bar_chart without errors for valid categorical data (Req 5.2)', () => {
      fc.assert(
        fc.property(
          categoricalDataArb(1), // Bar charts work with 1+ data points
          chartTitleArb,
          (data, title) => {
            const { container } = render(
              <Chart
                data={data}
                type="bar_chart"
                xColumn="category"
                yColumn="value"
                title={title}
              />
            );

            // Property: Bar chart should render successfully
            expect(chartRenderedSuccessfully(container)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should render line_chart without errors for valid time series data (Req 5.2)', () => {
      fc.assert(
        fc.property(
          categoricalDataArb(2), // Line charts need 2+ data points
          chartTitleArb,
          (data, title) => {
            const { container } = render(
              <Chart
                data={data}
                type="line_chart"
                xColumn="category"
                yColumn="value"
                title={title}
              />
            );

            // Property: Line chart should render successfully
            expect(chartRenderedSuccessfully(container)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should render pie_chart without errors for valid distribution data (Req 5.2)', () => {
      fc.assert(
        fc.property(
          pieDataArb,
          chartTitleArb,
          (data, title) => {
            const { container } = render(
              <Chart
                data={data}
                type="pie_chart"
                xColumn="category"
                yColumn="value"
                title={title}
              />
            );

            // Property: Pie chart should render successfully
            expect(chartRenderedSuccessfully(container)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should render scatter_chart without errors for valid coordinate data (Req 5.2)', () => {
      fc.assert(
        fc.property(
          scatterDataArb,
          chartTitleArb,
          (data, title) => {
            const { container } = render(
              <Chart
                data={data}
                type="scatter_chart"
                xColumn="x"
                yColumn="y"
                title={title}
              />
            );

            // Property: Scatter chart should render successfully
            expect(chartRenderedSuccessfully(container)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should render area_chart without errors for valid area data (Req 5.2)', () => {
      fc.assert(
        fc.property(
          categoricalDataArb(2), // Area charts need 2+ data points
          chartTitleArb,
          (data, title) => {
            const { container } = render(
              <Chart
                data={data}
                type="area_chart"
                xColumn="category"
                yColumn="value"
                title={title}
              />
            );

            // Property: Area chart should render successfully
            expect(chartRenderedSuccessfully(container)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Chart Type Invariants', () => {
    it('should render any supported chart type without throwing exceptions (Req 5.2)', () => {
      fc.assert(
        fc.property(
          chartTypeArb,
          fc.integer({ min: 2, max: 15 }),
          chartTitleArb,
          (chartType, rowCount, title) => {
            // Generate appropriate data based on chart type
            let data: Record<string, unknown>[];
            let xColumn: string;
            let yColumn: string;

            if (chartType === 'scatter_chart') {
              data = fc.sample(scatterRowArb, rowCount);
              xColumn = 'x';
              yColumn = 'y';
            } else if (chartType === 'pie_chart') {
              data = fc.sample(pieRowArb, rowCount).map((row, i) => ({
                ...row,
                category: `${row.category}_${i}`,
              }));
              xColumn = 'category';
              yColumn = 'value';
            } else {
              data = fc.sample(categoricalRowArb, rowCount).map((row, i) => ({
                ...row,
                category: `${row.category}_${i}`,
              }));
              xColumn = 'category';
              yColumn = 'value';
            }

            // Property: Rendering should not throw an exception
            expect(() => {
              render(
                <Chart
                  data={data}
                  type={chartType}
                  xColumn={xColumn}
                  yColumn={yColumn}
                  title={title}
                />
              );
            }).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always produce a chart container for valid data (Req 5.2)', () => {
      fc.assert(
        fc.property(
          chartTypeArb,
          fc.integer({ min: 2, max: 15 }),
          (chartType, rowCount) => {
            // Generate appropriate data based on chart type
            let data: Record<string, unknown>[];
            let xColumn: string;
            let yColumn: string;

            if (chartType === 'scatter_chart') {
              data = fc.sample(scatterRowArb, rowCount);
              xColumn = 'x';
              yColumn = 'y';
            } else if (chartType === 'pie_chart') {
              data = fc.sample(pieRowArb, rowCount).map((row, i) => ({
                ...row,
                category: `${row.category}_${i}`,
              }));
              xColumn = 'category';
              yColumn = 'value';
            } else {
              data = fc.sample(categoricalRowArb, rowCount).map((row, i) => ({
                ...row,
                category: `${row.category}_${i}`,
              }));
              xColumn = 'category';
              yColumn = 'value';
            }

            const { container } = render(
              <Chart
                data={data}
                type={chartType}
                xColumn={xColumn}
                yColumn={yColumn}
              />
            );

            // Property: Valid data should always produce a chart container
            expect(container.querySelector('.chart-container')).not.toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Data Shape Handling', () => {
    it('should handle various data sizes for all chart types (Req 5.2)', () => {
      fc.assert(
        fc.property(
          chartTypeArb,
          fc.integer({ min: 2, max: 50 }), // Test with various sizes
          (chartType, rowCount) => {
            // Generate data of the specified size
            let data: Record<string, unknown>[];
            let xColumn: string;
            let yColumn: string;

            if (chartType === 'scatter_chart') {
              data = fc.sample(scatterRowArb, rowCount);
              xColumn = 'x';
              yColumn = 'y';
            } else if (chartType === 'pie_chart') {
              // Limit pie chart to reasonable number of slices
              const pieCount = Math.min(rowCount, 10);
              data = fc.sample(pieRowArb, pieCount).map((row, i) => ({
                ...row,
                category: `${row.category}_${i}`,
              }));
              xColumn = 'category';
              yColumn = 'value';
            } else {
              data = fc.sample(categoricalRowArb, rowCount).map((row, i) => ({
                ...row,
                category: `${row.category}_${i}`,
              }));
              xColumn = 'category';
              yColumn = 'value';
            }

            const { container } = render(
              <Chart
                data={data}
                type={chartType}
                xColumn={xColumn}
                yColumn={yColumn}
              />
            );

            // Property: Charts should handle various data sizes
            expect(chartRenderedSuccessfully(container)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle numeric string values in data (Req 5.2)', () => {
      fc.assert(
        fc.property(
          chartTypeArb.filter(t => t !== 'scatter_chart'), // Exclude scatter for this test
          fc.array(
            fc.record({
              category: categoryLabelArb,
              value: fc.integer({ min: 0, max: 10000 }).map(String), // String numbers
            }),
            { minLength: 2, maxLength: 10 }
          ),
          (chartType, data) => {
            const uniqueData = data.map((row, i) => ({
              ...row,
              category: `${row.category}_${i}`,
            }));

            const { container } = render(
              <Chart
                data={uniqueData}
                type={chartType}
                xColumn="category"
                yColumn="value"
              />
            );

            // Property: String numeric values should be handled
            expect(chartRenderedSuccessfully(container)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle zero values in data (Req 5.2)', () => {
      fc.assert(
        fc.property(
          chartTypeArb.filter(t => t !== 'pie_chart'), // Pie charts need positive values
          fc.integer({ min: 2, max: 10 }),
          (chartType, rowCount) => {
            // Generate data with some zero values
            const data = Array.from({ length: rowCount }, (_, i) => ({
              category: `Cat_${i}`,
              value: i % 2 === 0 ? 0 : Math.random() * 1000,
              x: i % 2 === 0 ? 0 : Math.random() * 100,
              y: i % 2 === 0 ? 0 : Math.random() * 100,
            }));

            const config = getChartConfig(chartType, data);

            const { container } = render(
              <Chart
                data={data}
                type={chartType}
                xColumn={config.xColumn}
                yColumn={config.yColumn}
              />
            );

            // Property: Zero values should be handled gracefully
            expect(chartRenderedSuccessfully(container)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle negative values for appropriate chart types (Req 5.2)', () => {
      // Bar, line, area, and scatter can handle negative values
      const negativeCompatibleTypes: ChartType[] = ['bar_chart', 'line_chart', 'area_chart', 'scatter_chart'];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...negativeCompatibleTypes),
          fc.integer({ min: 2, max: 10 }),
          (chartType, rowCount) => {
            // Generate data with negative values
            const data = Array.from({ length: rowCount }, (_, i) => ({
              category: `Cat_${i}`,
              value: (Math.random() - 0.5) * 2000, // Range: -1000 to 1000
              x: (Math.random() - 0.5) * 200,
              y: (Math.random() - 0.5) * 200,
            }));

            const config = getChartConfig(chartType, data);

            const { container } = render(
              <Chart
                data={data}
                type={chartType}
                xColumn={config.xColumn}
                yColumn={config.yColumn}
              />
            );

            // Property: Negative values should be handled for compatible chart types
            expect(chartRenderedSuccessfully(container)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Chart Title Handling', () => {
    it('should render title when provided for any chart type (Req 5.2)', () => {
      fc.assert(
        fc.property(
          chartTypeArb,
          fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{2,29}$/), // Non-empty title
          (chartType, title) => {
            // Generate minimal valid data
            let data: Record<string, unknown>[];
            let xColumn: string;
            let yColumn: string;

            if (chartType === 'scatter_chart') {
              data = [{ x: 10, y: 20 }, { x: 30, y: 40 }];
              xColumn = 'x';
              yColumn = 'y';
            } else {
              data = [
                { category: 'A', value: 100 },
                { category: 'B', value: 200 },
              ];
              xColumn = 'category';
              yColumn = 'value';
            }

            const { container } = render(
              <Chart
                data={data}
                type={chartType}
                xColumn={xColumn}
                yColumn={yColumn}
                title={title}
              />
            );

            // Property: Title should be rendered when provided
            expect(container.textContent).toContain(title);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Color Column Support', () => {
    it('should handle colorColumn for bar charts (Req 5.2)', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              category: categoryLabelArb,
              value: chartValueArb,
              group: fc.constantFrom('Group A', 'Group B', 'Group C'),
            }),
            { minLength: 2, maxLength: 15 }
          ),
          (data) => {
            const uniqueData = data.map((row, i) => ({
              ...row,
              category: `${row.category}_${i}`,
            }));

            const { container } = render(
              <Chart
                data={uniqueData}
                type="bar_chart"
                xColumn="category"
                yColumn="value"
                colorColumn="group"
              />
            );

            // Property: Bar chart with colorColumn should render successfully
            expect(chartRenderedSuccessfully(container)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle colorColumn for scatter charts (Req 5.2)', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              x: coordinateValueArb,
              y: coordinateValueArb,
              cluster: fc.constantFrom('Cluster 1', 'Cluster 2', 'Cluster 3'),
            }),
            { minLength: 2, maxLength: 15 }
          ),
          (data) => {
            const { container } = render(
              <Chart
                data={data}
                type="scatter_chart"
                xColumn="x"
                yColumn="y"
                colorColumn="cluster"
              />
            );

            // Property: Scatter chart with colorColumn should render successfully
            expect(chartRenderedSuccessfully(container)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
