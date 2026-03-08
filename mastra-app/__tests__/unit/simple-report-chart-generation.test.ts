/**
 * Integration tests for simple report chart generation
 * 
 * Tests that the generateSimpleReport method correctly generates
 * visualizations based on data characteristics.
 * 
 * Requirements: 2.1, 2.5
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ReportGenerationOrchestrator } from '@/services/automatic-report-generation/report-generation-orchestrator';
import { ResultPresenter } from '@/services/result-presenter';
import { DashboardComposer } from '@/services/dashboard-composer';
import { ExportService } from '@/services/export-service';
import type { QueryResult } from '@/services/query-engine';
import type { TriggerDecision } from '@/services/automatic-report-generation/types';
import type { WorkflowContext } from '@/services/workflow-orchestrator';

describe('Simple Report Chart Generation', () => {
  let orchestrator: ReportGenerationOrchestrator;
  let mockContext: WorkflowContext;

  beforeEach(() => {
    const resultPresenter = new ResultPresenter();
    const dashboardComposer = new DashboardComposer();
    orchestrator = new ReportGenerationOrchestrator(
      resultPresenter,
      dashboardComposer,
      ExportService
    );

    mockContext = {
      workflowId: 'test-workflow',
      steps: [],
      results: new Map(),
      metadata: {},
    };
  });

  describe('chart generation with numeric data', () => {
    it('should generate a bar chart for categorical data with numeric values', async () => {
      const queryResult: QueryResult = {
        data: [
          { category: 'Product A', sales: 1500 },
          { category: 'Product B', sales: 2300 },
          { category: 'Product C', sales: 1800 },
          { category: 'Product D', sales: 2100 },
        ],
        columns: ['category', 'sales'],
        rowCount: 4,
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
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.reportHTML).toContain('chart.js');
      expect(result.reportHTML).toContain('canvas');
      expect(result.reportHTML).toContain('Visualization');
      expect(result.reportHTML).toContain('Data Table');
    });

    it('should generate a pie chart for data with few categories', async () => {
      const queryResult: QueryResult = {
        data: [
          { status: 'Active', count: 45 },
          { status: 'Inactive', count: 23 },
          { status: 'Pending', count: 12 },
        ],
        columns: ['status', 'count'],
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
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.reportHTML).toContain("type: 'pie'");
      expect(result.reportHTML).toContain('chart.js');
    });

    it('should generate a line chart for time-series data', async () => {
      const queryResult: QueryResult = {
        data: [
          { date: '2024-01-01', revenue: 5000 },
          { date: '2024-01-02', revenue: 5500 },
          { date: '2024-01-03', revenue: 4800 },
          { date: '2024-01-04', revenue: 6200 },
        ],
        columns: ['date', 'revenue'],
        rowCount: 4,
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
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.reportHTML).toContain("type: 'line'");
      expect(result.reportHTML).toContain('chart.js');
    });
  });

  describe('chart generation edge cases', () => {
    it('should handle data with no numeric columns gracefully', async () => {
      const queryResult: QueryResult = {
        data: [
          { name: 'Alice', email: 'alice@example.com' },
          { name: 'Bob', email: 'bob@example.com' },
        ],
        columns: ['name', 'email'],
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
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.reportHTML).toContain('Data Table');
      // Should still have table even without chart
      expect(result.reportHTML).toBeTruthy();
    });

    it('should handle empty data gracefully', async () => {
      const queryResult: QueryResult = {
        data: [],
        columns: ['id', 'value'],
        rowCount: 0,
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
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.reportHTML).toBeTruthy();
    });

    it('should limit chart data to first 20 rows', async () => {
      const data = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        value: Math.random() * 100,
      }));

      const queryResult: QueryResult = {
        data,
        columns: ['id', 'value'],
        rowCount: 50,
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
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.reportHTML).toContain('chart.js');
      // Chart should be generated even with large dataset
      expect(result.reportHTML).toContain('canvas');
    });
  });

  describe('report structure', () => {
    it('should include both chart and table sections', async () => {
      const queryResult: QueryResult = {
        data: [
          { product: 'Widget', quantity: 100 },
          { product: 'Gadget', quantity: 150 },
        ],
        columns: ['product', 'quantity'],
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
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.reportHTML).toContain('chart-section');
      expect(result.reportHTML).toContain('table-section');
      expect(result.reportHTML).toContain('Visualization');
      expect(result.reportHTML).toContain('Data Table');
    });

    it('should apply consistent styling to report sections', async () => {
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
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.reportHTML).toContain('simple-report');
      expect(result.reportHTML).toContain('report-section');
      expect(result.reportHTML).toContain('section-title');
      // Should include CSS styling
      expect(result.reportHTML).toContain('<style>');
    });

    it('should wrap report in responsive layout', async () => {
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
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.reportHTML).toContain('<!DOCTYPE html>');
      expect(result.reportHTML).toContain('<meta name="viewport"');
      expect(result.reportHTML).toContain('Query Results');
    });
  });

  describe('chart configuration', () => {
    it('should use appropriate colors for charts', async () => {
      const queryResult: QueryResult = {
        data: [
          { category: 'A', value: 10 },
          { category: 'B', value: 20 },
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
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.reportHTML).toContain('rgba(');
      expect(result.reportHTML).toContain('backgroundColor');
      expect(result.reportHTML).toContain('borderColor');
    });

    it('should configure chart with proper options', async () => {
      const queryResult: QueryResult = {
        data: [
          { month: 'Jan', sales: 1000 },
          { month: 'Feb', sales: 1200 },
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
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.reportHTML).toContain('responsive: true');
      expect(result.reportHTML).toContain('maintainAspectRatio: false');
      expect(result.reportHTML).toContain('plugins');
    });
  });
});
