/**
 * Unit Tests: Chart Component
 * 
 * Tests for Task 7.3: Ensure all chart types render correctly
 * - Verify bar, line, pie, scatter, area charts work
 * - Add consistent styling across chart types
 * - Handle edge cases (empty data, single data point)
 * 
 * **Validates: Requirements 5.2**
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Chart, ChartType } from '@/components/Chart';

// Mock ResizeObserver for Recharts ResponsiveContainer
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = ResizeObserverMock;

// Sample test data
const sampleData = [
  { category: 'A', value: 100 },
  { category: 'B', value: 200 },
  { category: 'C', value: 150 },
  { category: 'D', value: 300 },
  { category: 'E', value: 250 },
];

const timeSeriesData = [
  { date: '2024-01', value: 100 },
  { date: '2024-02', value: 150 },
  { date: '2024-03', value: 200 },
  { date: '2024-04', value: 180 },
  { date: '2024-05', value: 220 },
];

const scatterData = [
  { x: 10, y: 20 },
  { x: 20, y: 40 },
  { x: 30, y: 35 },
  { x: 40, y: 50 },
  { x: 50, y: 45 },
];

describe('Task 7.3: Chart Component - All Chart Types', () => {
  describe('Bar Chart', () => {
    it('should render bar chart container without errors', () => {
      const { container } = render(
        <Chart
          data={sampleData}
          type="bar_chart"
          xColumn="category"
          yColumn="value"
        />
      );
      
      expect(container.querySelector('.chart-container')).toBeTruthy();
    });

    it('should render bar chart with title', () => {
      render(
        <Chart
          data={sampleData}
          type="bar_chart"
          xColumn="category"
          yColumn="value"
          title="Sales by Category"
        />
      );
      
      expect(screen.getByText('Sales by Category')).toBeTruthy();
    });

    it('should render bar chart with color column', () => {
      const dataWithColor = sampleData.map((d, i) => ({
        ...d,
        group: i % 2 === 0 ? 'Group A' : 'Group B',
      }));
      
      const { container } = render(
        <Chart
          data={dataWithColor}
          type="bar_chart"
          xColumn="category"
          yColumn="value"
          colorColumn="group"
        />
      );
      
      expect(container.querySelector('.chart-container')).toBeTruthy();
    });
  });

  describe('Line Chart', () => {
    it('should render line chart container without errors', () => {
      const { container } = render(
        <Chart
          data={timeSeriesData}
          type="line_chart"
          xColumn="date"
          yColumn="value"
        />
      );
      
      expect(container.querySelector('.chart-container')).toBeTruthy();
    });

    it('should render line chart with title', () => {
      render(
        <Chart
          data={timeSeriesData}
          type="line_chart"
          xColumn="date"
          yColumn="value"
          title="Monthly Trend"
        />
      );
      
      expect(screen.getByText('Monthly Trend')).toBeTruthy();
    });
  });

  describe('Pie Chart', () => {
    it('should render pie chart container without errors', () => {
      const { container } = render(
        <Chart
          data={sampleData}
          type="pie_chart"
          xColumn="category"
          yColumn="value"
        />
      );
      
      expect(container.querySelector('.chart-container')).toBeTruthy();
    });

    it('should render pie chart with title', () => {
      render(
        <Chart
          data={sampleData}
          type="pie_chart"
          xColumn="category"
          yColumn="value"
          title="Distribution"
        />
      );
      
      expect(screen.getByText('Distribution')).toBeTruthy();
    });

    it('should render pie chart with single data point', () => {
      const singleData = [{ category: 'Only', value: 100 }];
      
      const { container } = render(
        <Chart
          data={singleData}
          type="pie_chart"
          xColumn="category"
          yColumn="value"
        />
      );
      
      // Pie chart should still render with single data point
      expect(container.querySelector('.chart-container')).toBeTruthy();
    });
  });

  describe('Scatter Chart', () => {
    it('should render scatter chart container without errors', () => {
      const { container } = render(
        <Chart
          data={scatterData}
          type="scatter_chart"
          xColumn="x"
          yColumn="y"
        />
      );
      
      expect(container.querySelector('.chart-container')).toBeTruthy();
    });

    it('should render scatter chart with title', () => {
      render(
        <Chart
          data={scatterData}
          type="scatter_chart"
          xColumn="x"
          yColumn="y"
          title="X vs Y Correlation"
        />
      );
      
      expect(screen.getByText('X vs Y Correlation')).toBeTruthy();
    });
  });

  describe('Area Chart', () => {
    it('should render area chart container without errors', () => {
      const { container } = render(
        <Chart
          data={timeSeriesData}
          type="area_chart"
          xColumn="date"
          yColumn="value"
        />
      );
      
      expect(container.querySelector('.chart-container')).toBeTruthy();
    });

    it('should render area chart with title', () => {
      render(
        <Chart
          data={timeSeriesData}
          type="area_chart"
          xColumn="date"
          yColumn="value"
          title="Cumulative Growth"
        />
      );
      
      expect(screen.getByText('Cumulative Growth')).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    describe('Empty Data', () => {
      const chartTypes: ChartType[] = ['bar_chart', 'line_chart', 'pie_chart', 'scatter_chart', 'area_chart'];
      
      chartTypes.forEach((chartType) => {
        it(`should handle empty data for ${chartType}`, () => {
          const { container } = render(
            <Chart
              data={[]}
              type={chartType}
              xColumn="category"
              yColumn="value"
            />
          );
          
          expect(container.querySelector('.chart-empty')).toBeTruthy();
          expect(screen.getByText('No data to display')).toBeTruthy();
        });
      });
    });

    describe('Single Data Point', () => {
      const singleData = [{ category: 'Single', value: 100 }];
      
      it('should show message for line chart with single data point', () => {
        const { container } = render(
          <Chart
            data={singleData}
            type="line_chart"
            xColumn="category"
            yColumn="value"
          />
        );
        
        expect(container.querySelector('.chart-single-point')).toBeTruthy();
        expect(screen.getByText('Single data point')).toBeTruthy();
        expect(screen.getByText(/Line charts require at least 2 data points/)).toBeTruthy();
      });

      it('should show message for area chart with single data point', () => {
        const { container } = render(
          <Chart
            data={singleData}
            type="area_chart"
            xColumn="category"
            yColumn="value"
          />
        );
        
        expect(container.querySelector('.chart-single-point')).toBeTruthy();
        expect(screen.getByText('Single data point')).toBeTruthy();
        expect(screen.getByText(/Area charts require at least 2 data points/)).toBeTruthy();
      });

      it('should show message for scatter chart with single data point', () => {
        const { container } = render(
          <Chart
            data={singleData}
            type="scatter_chart"
            xColumn="category"
            yColumn="value"
          />
        );
        
        expect(container.querySelector('.chart-single-point')).toBeTruthy();
        expect(screen.getByText('Single data point')).toBeTruthy();
        expect(screen.getByText(/Scatter charts require at least 2 data points/)).toBeTruthy();
      });

      it('should render bar chart with single data point', () => {
        const { container } = render(
          <Chart
            data={singleData}
            type="bar_chart"
            xColumn="category"
            yColumn="value"
          />
        );
        
        // Bar chart should render normally with single data point
        expect(container.querySelector('.chart-container')).toBeTruthy();
        expect(container.querySelector('.chart-empty')).toBeFalsy();
        expect(container.querySelector('.chart-single-point')).toBeFalsy();
      });

      it('should render pie chart with single data point', () => {
        const { container } = render(
          <Chart
            data={singleData}
            type="pie_chart"
            xColumn="category"
            yColumn="value"
          />
        );
        
        // Pie chart should render normally with single data point
        expect(container.querySelector('.chart-container')).toBeTruthy();
        expect(container.querySelector('.chart-empty')).toBeFalsy();
        expect(container.querySelector('.chart-single-point')).toBeFalsy();
      });
    });

    describe('Data Type Handling', () => {
      it('should handle string numeric values', () => {
        const stringData = [
          { category: 'A', value: '100' },
          { category: 'B', value: '200' },
        ];
        
        const { container } = render(
          <Chart
            data={stringData}
            type="bar_chart"
            xColumn="category"
            yColumn="value"
          />
        );
        
        expect(container.querySelector('.chart-container')).toBeTruthy();
      });

      it('should handle non-numeric values gracefully', () => {
        const mixedData = [
          { category: 'A', value: 'not a number' },
          { category: 'B', value: 200 },
        ];
        
        const { container } = render(
          <Chart
            data={mixedData}
            type="bar_chart"
            xColumn="category"
            yColumn="value"
          />
        );
        
        // Should render without crashing (non-numeric becomes 0)
        expect(container.querySelector('.chart-container')).toBeTruthy();
      });
    });

    describe('Unsupported Chart Type', () => {
      it('should handle unsupported chart type gracefully', () => {
        const { container } = render(
          <Chart
            data={sampleData}
            type={'unknown_chart' as ChartType}
            xColumn="category"
            yColumn="value"
          />
        );
        
        expect(container.querySelector('.chart-unsupported')).toBeTruthy();
        expect(screen.getByText(/Unsupported chart type/)).toBeTruthy();
      });
    });
  });

  describe('Consistent Styling', () => {
    const chartTypes: ChartType[] = ['bar_chart', 'line_chart', 'pie_chart', 'scatter_chart', 'area_chart'];
    
    chartTypes.forEach((chartType) => {
      it(`should have consistent container styling for ${chartType}`, () => {
        const { container } = render(
          <Chart
            data={chartType === 'scatter_chart' ? scatterData : sampleData}
            type={chartType}
            xColumn={chartType === 'scatter_chart' ? 'x' : 'category'}
            yColumn={chartType === 'scatter_chart' ? 'y' : 'value'}
          />
        );
        
        const chartContainer = container.querySelector('.chart-container');
        expect(chartContainer).toBeTruthy();
        expect(chartContainer?.classList.contains('bg-white')).toBe(true);
        expect(chartContainer?.classList.contains('rounded-lg')).toBe(true);
      });
    });
  });

  describe('All Chart Types Render Without Errors', () => {
    it('should render all 5 chart types successfully', () => {
      const chartConfigs: Array<{ type: ChartType; data: Record<string, unknown>[]; xCol: string; yCol: string }> = [
        { type: 'bar_chart', data: sampleData, xCol: 'category', yCol: 'value' },
        { type: 'line_chart', data: timeSeriesData, xCol: 'date', yCol: 'value' },
        { type: 'pie_chart', data: sampleData, xCol: 'category', yCol: 'value' },
        { type: 'scatter_chart', data: scatterData, xCol: 'x', yCol: 'y' },
        { type: 'area_chart', data: timeSeriesData, xCol: 'date', yCol: 'value' },
      ];

      chartConfigs.forEach(({ type, data, xCol, yCol }) => {
        const { container } = render(
          <Chart
            data={data}
            type={type}
            xColumn={xCol}
            yColumn={yCol}
          />
        );
        
        // Each chart type should render its container without errors
        expect(container.querySelector('.chart-container')).toBeTruthy();
        expect(container.querySelector('.chart-empty')).toBeFalsy();
        expect(container.querySelector('.chart-unsupported')).toBeFalsy();
      });
    });
  });
});
