// __tests__/integration/multi-agent.test.ts
/**
 * Integration tests for the Multi-Agent System.
 * Tests the full workflow of database query -> analysis -> visualization.
 */

import { describe, it, expect } from 'vitest';
import { analyzeData } from '../../src/mastra/agents/data-analysis-agent';
import { generateVisualization } from '../../src/mastra/agents/visualization-agent';

describe('Multi-Agent System Integration', () => {
  // Sample data simulating database query results
  const ordersData = [
    { ORDER_ID: 1, CUSTOMER_ID: 101, ORDER_DATE: '15-01-23', TOTAL_AMOUNT: 150.75 },
    { ORDER_ID: 2, CUSTOMER_ID: 102, ORDER_DATE: '16-01-23', TOTAL_AMOUNT: 200 },
    { ORDER_ID: 3, CUSTOMER_ID: 101, ORDER_DATE: '17-01-23', TOTAL_AMOUNT: 50.25 },
    { ORDER_ID: 4, CUSTOMER_ID: 103, ORDER_DATE: '18-01-23', TOTAL_AMOUNT: 300.5 },
    { ORDER_ID: 5, CUSTOMER_ID: 102, ORDER_DATE: '19-01-23', TOTAL_AMOUNT: 75 },
  ];

  describe('Full Workflow: Query -> Analysis -> Visualization', () => {
    it('should analyze orders data and generate insights', () => {
      const analysis = analyzeData({ data: ordersData });
      
      // Verify analysis structure
      expect(analysis.summary).toContain('5 rows');
      expect(analysis.summary).toContain('4 columns');
      
      // Verify statistics
      expect(analysis.statistics.rowCount).toBe(5);
      expect(analysis.statistics.columnCount).toBe(4);
      
      // Verify column stats
      const columnStats = analysis.statistics.columnStats as Record<string, unknown>;
      expect(columnStats).toHaveProperty('ORDER_ID');
      expect(columnStats).toHaveProperty('CUSTOMER_ID');
      expect(columnStats).toHaveProperty('TOTAL_AMOUNT');
      
      // Verify numeric analysis
      const amountStats = columnStats.TOTAL_AMOUNT as { type: string; sum: number; avg: number };
      expect(amountStats.type).toBe('numeric');
      expect(amountStats.sum).toBeCloseTo(776.5, 1);
      expect(amountStats.avg).toBeCloseTo(155.3, 1);
      
      // Verify insights and recommendations exist
      expect(analysis.insights.length + analysis.recommendations.length).toBeGreaterThan(0);
      expect(analysis.suggestedVisualizations.length).toBeGreaterThan(0);
    });

    it('should generate table visualization from orders data', async () => {
      const viz = await generateVisualization({
        data: ordersData,
        type: 'table',
        title: 'Orders Table',
      });
      
      expect(viz.type).toBe('table');
      
      const content = JSON.parse(viz.content);
      expect(content.title).toBe('Orders Table');
      expect(content.columns).toContain('ORDER_ID');
      expect(content.columns).toContain('CUSTOMER_ID');
      expect(content.columns).toContain('TOTAL_AMOUNT');
      expect(content.data.length).toBe(5);
    });

    it('should generate bar chart from aggregated data', async () => {
      // Simulate aggregated query result
      const aggregatedData = [
        { CUSTOMER_ID: 101, ORDER_COUNT: 2, TOTAL_REVENUE: 201 },
        { CUSTOMER_ID: 102, ORDER_COUNT: 2, TOTAL_REVENUE: 275 },
        { CUSTOMER_ID: 103, ORDER_COUNT: 1, TOTAL_REVENUE: 300.5 },
      ];
      
      const viz = await generateVisualization({
        data: aggregatedData,
        type: 'bar',
        title: 'Orders by Customer',
      });
      
      expect(viz.type).toBe('bar_chart');
      
      const content = JSON.parse(viz.content);
      expect(content.title).toBe('Orders by Customer');
      expect(content.data.length).toBe(3);
    });

    it('should generate interactive HTML dashboard', async () => {
      const viz = await generateVisualization({
        data: ordersData,
        type: 'html',
        title: 'Orders Dashboard',
      });
      
      expect(viz.type).toBe('html');
      expect(viz.metadata?.rowCount).toBe(5);
      expect(viz.metadata?.columns).toContain('ORDER_ID');
      
      // Verify HTML structure
      const html = viz.content;
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Orders Dashboard');
      expect(html).toContain('searchInput');
      expect(html).toContain('filter_ORDER_ID');
      expect(html).toContain('filter_CUSTOMER_ID');
      expect(html).toContain('sortTable');
      expect(html).toContain('totalCount');
      expect(html).toContain('filteredCount');
    });

    it('should auto-detect visualization type', async () => {
      // Time series data should get line chart
      const timeSeriesData = [
        { date: '2024-01-01', amount: 100 },
        { date: '2024-01-02', amount: 150 },
        { date: '2024-01-03', amount: 200 },
      ];
      
      const viz = await generateVisualization({
        data: timeSeriesData,
        type: 'auto',
      });
      
      expect(viz.type).toBe('line_chart');
    });
  });

  describe('End-to-End Scenario: Orders Analysis', () => {
    it('should provide complete analysis and visualization for orders', async () => {
      // Step 1: Analyze the data
      const analysis = analyzeData({
        data: ordersData,
        query: 'SELECT * FROM orders',
      });
      
      // Step 2: Generate multiple visualizations
      const tableViz = await generateVisualization({
        data: ordersData,
        type: 'table',
      });
      
      const chartViz = await generateVisualization({
        data: ordersData,
        type: 'auto',
      });
      
      const dashboardViz = await generateVisualization({
        data: ordersData,
        type: 'html',
        title: 'Orders Explorer',
      });
      
      // Verify complete output
      expect(analysis.statistics.rowCount).toBe(5);
      expect(tableViz.type).toBe('table');
      expect(chartViz.type).toBeDefined();
      expect(dashboardViz.type).toBe('html');
      
      // Verify insights are actionable
      expect(analysis.suggestedVisualizations.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single row data', async () => {
      const singleRow = [{ id: 1, value: 100 }];
      
      const analysis = analyzeData({ data: singleRow });
      const viz = await generateVisualization({ data: singleRow, type: 'table' });
      
      expect(analysis.statistics.rowCount).toBe(1);
      expect(viz.type).toBe('table');
    });

    it('should handle data with null values', async () => {
      const dataWithNulls = [
        { id: 1, name: 'Alice', score: 85 },
        { id: 2, name: null, score: 90 },
        { id: 3, name: 'Charlie', score: null },
      ];
      
      const analysis = analyzeData({ data: dataWithNulls });
      const viz = await generateVisualization({ data: dataWithNulls, type: 'table' });
      
      expect(analysis.statistics.rowCount).toBe(3);
      expect(viz.type).toBe('table');
    });

    it('should handle large datasets', async () => {
      // Generate 100 rows
      const largeData = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        value: Math.random() * 1000,
        category: ['A', 'B', 'C'][i % 3],
      }));
      
      const analysis = analyzeData({ data: largeData });
      const viz = await generateVisualization({ data: largeData, type: 'html' });
      
      expect(analysis.statistics.rowCount).toBe(100);
      expect(viz.type).toBe('html');
      expect(viz.metadata?.rowCount).toBe(100);
    });
  });
});
