// __tests__/unit/data-analysis-agent.test.ts
/**
 * Unit tests for the Data Analysis Agent.
 */

import { describe, it, expect } from 'vitest';
import { analyzeData, type AnalysisResult } from '../../src/mastra/agents/data-analysis-agent';

describe('Data Analysis Agent', () => {
  describe('analyzeData', () => {
    it('should return empty analysis for empty data', () => {
      const result = analyzeData({ data: [] });
      
      expect(result.summary).toBe('No data available for analysis');
      expect(result.statistics).toEqual({});
      expect(result.insights).toEqual([]);
      expect(result.recommendations).toContain('Run a query to retrieve data');
    });

    it('should analyze numeric data correctly', () => {
      const data = [
        { id: 1, amount: 100 },
        { id: 2, amount: 200 },
        { id: 3, amount: 300 },
      ];
      
      const result = analyzeData({ data });
      
      expect(result.statistics.rowCount).toBe(3);
      expect(result.statistics.columnCount).toBe(2);
      expect(result.statistics.columns).toContain('id');
      expect(result.statistics.columns).toContain('amount');
      
      const columnStats = result.statistics.columnStats as Record<string, { type: string; avg?: number }>;
      expect(columnStats.amount.type).toBe('numeric');
      expect(columnStats.amount.avg).toBe(200);
    });

    it('should analyze categorical data correctly', () => {
      const data = [
        { category: 'A', value: 10 },
        { category: 'B', value: 20 },
        { category: 'A', value: 30 },
      ];
      
      const result = analyzeData({ data });
      
      const columnStats = result.statistics.columnStats as Record<string, { type: string; uniqueCount?: number }>;
      expect(columnStats.category.type).toBe('categorical');
      expect(columnStats.category.uniqueCount).toBe(2);
    });

    it('should generate insights for high variability data', () => {
      const data = [
        { id: 1, amount: 10 },
        { id: 2, amount: 1000 },
      ];
      
      const result = analyzeData({ data });
      
      // Check that statistics are calculated correctly
      const columnStats = result.statistics.columnStats as Record<string, { type: string; min?: number; max?: number }>;
      expect(columnStats.amount.type).toBe('numeric');
      expect(columnStats.amount.min).toBe(10);
      expect(columnStats.amount.max).toBe(1000);
      
      // The analysis should have some insights or recommendations
      expect(result.insights.length + result.recommendations.length).toBeGreaterThan(0);
    });

    it('should suggest visualizations based on data structure', () => {
      const data = [
        { category: 'A', value: 100 },
        { category: 'B', value: 200 },
      ];
      
      const result = analyzeData({ data });
      
      expect(result.suggestedVisualizations.length).toBeGreaterThan(0);
      expect(result.suggestedVisualizations.some(v => v.includes('Table'))).toBe(true);
    });

    it('should recommend time-based analysis for date columns', () => {
      const data = [
        { order_date: '2024-01-01', amount: 100 },
        { order_date: '2024-01-02', amount: 200 },
      ];
      
      const result = analyzeData({ data });
      
      expect(result.recommendations.some(r => r.includes('time') || r.includes('date'))).toBe(true);
    });

    it('should handle mixed data types', () => {
      const data = [
        { id: 1, name: 'Alice', score: 85.5 },
        { id: 2, name: 'Bob', score: 92.0 },
        { id: 3, name: 'Charlie', score: 78.5 },
      ];
      
      const result = analyzeData({ data });
      
      expect(result.statistics.rowCount).toBe(3);
      expect(result.statistics.columnCount).toBe(3);
      
      const columnStats = result.statistics.columnStats as Record<string, { type: string }>;
      expect(columnStats.id.type).toBe('numeric');
      expect(columnStats.name.type).toBe('categorical');
      expect(columnStats.score.type).toBe('numeric');
    });

    it('should generate summary text', () => {
      const data = [
        { a: 1, b: 2, c: 3 },
        { a: 4, b: 5, c: 6 },
      ];
      
      const result = analyzeData({ data });
      
      expect(result.summary).toContain('2 rows');
      expect(result.summary).toContain('3 columns');
    });
  });
});
