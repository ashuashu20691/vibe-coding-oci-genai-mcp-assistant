/**
 * Unit Tests: Chart Component Fullscreen Mode
 * 
 * Tests for Task 7.7: Add fullscreen mode for visualizations
 * - Verify fullscreen toggle button is present
 * - Verify fullscreen overlay opens and closes
 * 
 * **Validates: Requirements 5.7**
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Chart } from '@/components/Chart';

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
];

describe('Task 7.7: Chart Component - Fullscreen Mode', () => {
  describe('Fullscreen Toggle Button', () => {
    it('should render fullscreen toggle button by default', () => {
      const { container } = render(
        <Chart
          data={sampleData}
          type="bar_chart"
          xColumn="category"
          yColumn="value"
        />
      );
      
      expect(container.querySelector('.fullscreen-toggle-btn')).toBeTruthy();
    });

    it('should not render fullscreen toggle button when fullscreenEnabled is false', () => {
      const { container } = render(
        <Chart
          data={sampleData}
          type="bar_chart"
          xColumn="category"
          yColumn="value"
          fullscreenEnabled={false}
        />
      );
      
      expect(container.querySelector('.fullscreen-toggle-btn')).toBeFalsy();
    });

    it('should open fullscreen overlay when toggle button is clicked', () => {
      const { container } = render(
        <Chart
          data={sampleData}
          type="bar_chart"
          xColumn="category"
          yColumn="value"
          title="Test Chart"
        />
      );
      
      // Initially, fullscreen overlay should not be visible
      expect(container.querySelector('.fullscreen-overlay')).toBeFalsy();
      
      // Click the fullscreen toggle button
      const toggleBtn = container.querySelector('.fullscreen-toggle-btn');
      expect(toggleBtn).toBeTruthy();
      fireEvent.click(toggleBtn!);
      
      // Fullscreen overlay should now be visible
      expect(container.querySelector('.fullscreen-overlay')).toBeTruthy();
    });

    it('should close fullscreen overlay when close button is clicked', () => {
      const { container } = render(
        <Chart
          data={sampleData}
          type="bar_chart"
          xColumn="category"
          yColumn="value"
        />
      );
      
      // Open fullscreen
      const toggleBtn = container.querySelector('.fullscreen-toggle-btn');
      fireEvent.click(toggleBtn!);
      expect(container.querySelector('.fullscreen-overlay')).toBeTruthy();
      
      // Close fullscreen
      const closeBtn = container.querySelector('.fullscreen-close-btn');
      expect(closeBtn).toBeTruthy();
      fireEvent.click(closeBtn!);
      
      // Fullscreen overlay should be closed
      expect(container.querySelector('.fullscreen-overlay')).toBeFalsy();
    });

    it('should close fullscreen overlay when Escape key is pressed', () => {
      const { container } = render(
        <Chart
          data={sampleData}
          type="bar_chart"
          xColumn="category"
          yColumn="value"
        />
      );
      
      // Open fullscreen
      const toggleBtn = container.querySelector('.fullscreen-toggle-btn');
      fireEvent.click(toggleBtn!);
      expect(container.querySelector('.fullscreen-overlay')).toBeTruthy();
      
      // Press Escape
      fireEvent.keyDown(document, { key: 'Escape' });
      
      // Fullscreen overlay should be closed
      expect(container.querySelector('.fullscreen-overlay')).toBeFalsy();
    });

    it('should display chart title in fullscreen overlay', () => {
      const { container } = render(
        <Chart
          data={sampleData}
          type="bar_chart"
          xColumn="category"
          yColumn="value"
          title="Sales by Category"
        />
      );
      
      // Open fullscreen
      const toggleBtn = container.querySelector('.fullscreen-toggle-btn');
      fireEvent.click(toggleBtn!);
      
      // Title should be visible in the overlay
      expect(screen.getAllByText('Sales by Category').length).toBeGreaterThan(0);
    });
  });

  describe('Fullscreen for Different Chart Types', () => {
    const chartTypes = ['bar_chart', 'line_chart', 'pie_chart', 'area_chart'] as const;
    
    chartTypes.forEach((chartType) => {
      it(`should have fullscreen button for ${chartType}`, () => {
        const { container } = render(
          <Chart
            data={sampleData}
            type={chartType}
            xColumn="category"
            yColumn="value"
          />
        );
        
        expect(container.querySelector('.fullscreen-toggle-btn')).toBeTruthy();
      });
    });
  });
});
