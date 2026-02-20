// __tests__/unit/visualization-agent.test.ts
/**
 * Unit tests for the Visualization Agent.
 */

import { describe, it, expect } from 'vitest';
import { generateVisualization } from '../../src/mastra/agents/visualization-agent';

describe('Visualization Agent', () => {
  describe('generateVisualization', () => {
    it('should generate table for empty data', async () => {
      const result = await generateVisualization({ data: [] });

      expect(result.type).toBe('table');
      const content = JSON.parse(result.content);
      expect(content.type).toBe('table');
      expect(content.columns).toEqual([]);
      expect(content.data).toEqual([]);
    });

    it('should generate bar chart when requested', async () => {
      const data = [
        { category: 'A', value: 100 },
        { category: 'B', value: 200 },
      ];

      const result = await generateVisualization({
        data,
        type: 'bar',
        title: 'Test Bar Chart',
      });

      expect(result.type).toBe('bar_chart');
      const content = JSON.parse(result.content);
      expect(content.type).toBe('bar_chart');
      expect(content.title).toBe('Test Bar Chart');
      expect(content.data).toEqual(data);
    });

    it('should generate line chart when requested', async () => {
      const data = [
        { date: '2024-01-01', amount: 100 },
        { date: '2024-01-02', amount: 150 },
      ];

      const result = await generateVisualization({
        data,
        type: 'line',
        title: 'Test Line Chart',
      });

      expect(result.type).toBe('line_chart');
      const content = JSON.parse(result.content);
      expect(content.type).toBe('line_chart');
      expect(content.title).toBe('Test Line Chart');
    });

    it('should generate pie chart when requested', async () => {
      const data = [
        { label: 'Yes', count: 60 },
        { label: 'No', count: 40 },
      ];

      const result = await generateVisualization({
        data,
        type: 'pie',
        title: 'Test Pie Chart',
      });

      expect(result.type).toBe('pie_chart');
      const content = JSON.parse(result.content);
      expect(content.type).toBe('pie_chart');
    });

    it('should generate table when requested', async () => {
      const data = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];

      const result = await generateVisualization({
        data,
        type: 'table',
        title: 'Test Table',
      });

      expect(result.type).toBe('table');
      const content = JSON.parse(result.content);
      expect(content.type).toBe('table');
      expect(content.columns).toContain('id');
      expect(content.columns).toContain('name');
    });

    it('should generate interactive HTML when requested', async () => {
      const data = [
        { id: 1, name: 'Alice', score: 85 },
        { id: 2, name: 'Bob', score: 92 },
      ];

      const result = await generateVisualization({
        data,
        type: 'html',
        title: 'Interactive Dashboard',
      });

      expect(result.type).toBe('html');
      expect(result.content).toContain('<!DOCTYPE html>');
      expect(result.content).toContain('Interactive Dashboard');
      expect(result.content).toContain('filter');
      expect(result.content).toContain('searchInput');
      expect(result.metadata?.columns).toContain('id');
      expect(result.metadata?.columns).toContain('name');
      expect(result.metadata?.rowCount).toBe(2);
    });

    it('should auto-detect line chart for time series data', async () => {
      const data = [
        { date: '2024-01-01', amount: 100 },
        { date: '2024-01-02', amount: 150 },
        { date: '2024-01-03', amount: 200 },
      ];

      const result = await generateVisualization({
        data,
        type: 'auto',
      });

      expect(result.type).toBe('line_chart');
    });

    it('should auto-detect bar chart for categorical data', async () => {
      const data = [
        { category: 'A', value: 100 },
        { category: 'B', value: 200 },
      ];

      const result = await generateVisualization({
        data,
        type: 'auto',
      });

      expect(result.type).toBe('bar_chart');
    });

    it('should default to table for complex data', async () => {
      const data = [
        { id: 1, name: 'Alice', email: 'alice@test.com', status: 'active' },
        { id: 2, name: 'Bob', email: 'bob@test.com', status: 'inactive' },
      ];

      const result = await generateVisualization({
        data,
        type: 'auto',
      });

      expect(result.type).toBe('table');
    });

    it('should include options in output', async () => {
      const data = [{ x: 1, y: 2 }];
      const options = { color: 'blue', showLegend: true };

      const result = await generateVisualization({
        data,
        type: 'bar',
        options,
      });

      const content = JSON.parse(result.content);
      expect(content.options).toEqual(options);
    });

    it('should handle non-object array data', async () => {
      const data = [1, 2, 3, 4, 5];

      const result = await generateVisualization({
        data: data as unknown as unknown[],
        type: 'auto',
      });

      expect(result.type).toBe('table');
    });
  });

  describe('Interactive HTML Dashboard', () => {
    it('should include search functionality', async () => {
      const data = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];

      const result = await generateVisualization({
        data,
        type: 'html',
      });

      expect(result.content).toContain('searchInput');
      expect(result.content).toContain('Search');
      expect(result.content).toContain('applyFilters');
    });

    it('should include filter dropdowns for each column', async () => {
      const data = [
        { category: 'A', status: 'active' },
        { category: 'B', status: 'inactive' },
      ];

      const result = await generateVisualization({
        data,
        type: 'html',
      });

      expect(result.content).toContain('filter_category');
      expect(result.content).toContain('filter_status');
    });

    it('should include sortable table headers', async () => {
      const data = [
        { id: 1, name: 'Alice' },
      ];

      const result = await generateVisualization({
        data,
        type: 'html',
      });

      expect(result.content).toContain('sortTable');
      expect(result.content).toContain('onclick');
    });

    it('should include statistics cards', async () => {
      const data = [
        { id: 1 },
        { id: 2 },
        { id: 3 },
      ];

      const result = await generateVisualization({
        data,
        type: 'html',
      });

      expect(result.content).toContain('totalCount');
      expect(result.content).toContain('filteredCount');
      expect(result.content).toContain('Total Records');
      expect(result.content).toContain('Filtered Records');
    });

    it('should have responsive styling', async () => {
      const data = [{ id: 1 }];

      const result = await generateVisualization({
        data,
        type: 'html',
      });

      expect(result.content).toContain('viewport');
      expect(result.content).toContain('max-width');
      expect(result.content).toContain('grid');
    });
    it('should auto-detect chart type for SQL data with string numbers', async () => {
      const sqlData = [
        { ORDER_ID: 1, CUSTOMER_ID: 101, ORDER_DATE: "15-01-23", TOTAL_AMOUNT: "150.75" },
        { ORDER_ID: 2, CUSTOMER_ID: 102, ORDER_DATE: "16-01-23", TOTAL_AMOUNT: "200" },
        { ORDER_ID: 3, CUSTOMER_ID: 101, ORDER_DATE: "17-01-23", TOTAL_AMOUNT: "50.25" },
        { ORDER_ID: 4, CUSTOMER_ID: 103, ORDER_DATE: "18-01-23", TOTAL_AMOUNT: "300.5" },
        { ORDER_ID: 5, CUSTOMER_ID: 102, ORDER_DATE: "19-01-23", TOTAL_AMOUNT: "75" }
      ];

      const result = await generateVisualization({
        data: sqlData,
        type: 'auto',
      });

      // Should be line because of date + numbers, or bar if date not recognized but numbers are
      expect(['line_chart', 'bar_chart', 'timeline']).toContain(result.type);
    });
  });
});
