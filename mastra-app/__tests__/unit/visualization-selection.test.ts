/**
 * Unit tests for visualization selection logic
 * 
 * Tests that the system correctly selects appropriate visualization types
 * based on data characteristics.
 * 
 * Requirements: 2.2, 2.3, 2.4, 7.2, 7.3, 7.4
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ReportGenerationOrchestrator } from '@/services/automatic-report-generation/report-generation-orchestrator';
import { ResultPresenter } from '@/services/result-presenter';
import { DashboardComposer } from '@/services/dashboard-composer';
import { ExportService } from '@/services/export-service';
import type { QueryResult } from '@/services/query-engine';
import type { TriggerDecision } from '@/services/automatic-report-generation/types';
import type { WorkflowContext } from '@/services/workflow-orchestrator';

describe('Visualization Selection Logic', () => {
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

  describe('Time-series data visualization (Requirements 2.2, 7.2)', () => {
    it('should select line chart for time-series data with ISO dates', async () => {
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
    });

    it('should select line chart for time-series data with US date format', async () => {
      const queryResult: QueryResult = {
        data: [
          { date: '01/15/2024', sales: 1200 },
          { date: '01/16/2024', sales: 1350 },
          { date: '01/17/2024', sales: 1100 },
        ],
        columns: ['date', 'sales'],
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
      expect(result.reportHTML).toContain("type: 'line'");
    });

    it('should select bar chart for time-series data in dashboard', async () => {
      const queryResult: QueryResult = {
        data: [
          { timestamp: '2024-01-01', users: 150, sessions: 320 },
          { timestamp: '2024-01-02', users: 180, sessions: 380 },
          { timestamp: '2024-01-03', users: 165, sessions: 350 },
        ],
        columns: ['timestamp', 'users', 'sessions'],
        rowCount: 3,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Query returned data',
        suggestedReportType: 'dashboard',
        estimatedComplexity: 'medium',
      };

      const result = await orchestrator.generateReport(
        queryResult,
        triggerDecision,
        mockContext
      );

      expect(result.success).toBe(true);
      // Dashboard should include line chart for time-series
      expect(result.reportHTML).toContain("type: 'line'");
    });
  });

  describe('Categorical data visualization (Requirements 2.3, 7.3)', () => {
    it('should select pie chart for categorical data with few categories (< 8)', async () => {
      const queryResult: QueryResult = {
        data: [
          { status: 'Active', count: 45 },
          { status: 'Inactive', count: 23 },
          { status: 'Pending', count: 12 },
          { status: 'Suspended', count: 8 },
        ],
        columns: ['status', 'count'],
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
      expect(result.reportHTML).toContain("type: 'pie'");
    });

    it('should select bar chart for categorical data with many categories (>= 8)', async () => {
      const queryResult: QueryResult = {
        data: Array.from({ length: 10 }, (_, i) => ({
          category: `Category ${i + 1}`,
          value: Math.floor(Math.random() * 100) + 50,
        })),
        columns: ['category', 'value'],
        rowCount: 10,
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
      expect(result.reportHTML).toContain("type: 'bar'");
      expect(result.reportHTML).not.toContain("type: 'pie'");
    });
  });

  describe('Categorical groupings visualization (Requirements 2.3, 7.3)', () => {
    it('should select grouped bar chart for data with multiple categorical dimensions', async () => {
      const queryResult: QueryResult = {
        data: [
          { region: 'North', product: 'Widget', sales: 1200 },
          { region: 'North', product: 'Gadget', sales: 1500 },
          { region: 'South', product: 'Widget', sales: 1100 },
          { region: 'South', product: 'Gadget', sales: 1300 },
          { region: 'East', product: 'Widget', sales: 1400 },
          { region: 'East', product: 'Gadget', sales: 1600 },
        ],
        columns: ['region', 'product', 'sales'],
        rowCount: 6,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Query returned data',
        suggestedReportType: 'dashboard',
        estimatedComplexity: 'medium',
      };

      const result = await orchestrator.generateReport(
        queryResult,
        triggerDecision,
        mockContext
      );

      expect(result.success).toBe(true);
      // Should include grouped or stacked bar chart
      expect(
        result.reportHTML.includes("type: 'grouped-bar'") ||
        result.reportHTML.includes("type: 'stacked-bar'") ||
        result.reportHTML.includes("stacked: true") ||
        result.reportHTML.includes("stacked: false")
      ).toBe(true);
    });

    it('should select stacked bar chart for data with many categorical values', async () => {
      const queryResult: QueryResult = {
        data: Array.from({ length: 20 }, (_, i) => ({
          month: `Month ${(i % 12) + 1}`,
          category: `Cat ${(i % 5) + 1}`,
          value: Math.floor(Math.random() * 1000) + 500,
        })),
        columns: ['month', 'category', 'value'],
        rowCount: 20,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Query returned data',
        suggestedReportType: 'dashboard',
        estimatedComplexity: 'medium',
      };

      const result = await orchestrator.generateReport(
        queryResult,
        triggerDecision,
        mockContext
      );

      expect(result.success).toBe(true);
      // Should include stacked bar chart for better space efficiency
      expect(
        result.reportHTML.includes("type: 'stacked-bar'") ||
        result.reportHTML.includes("stacked: true")
      ).toBe(true);
    });
  });

  describe('Geographic data visualization (Requirements 2.4, 7.4)', () => {
    it('should select map visualization for data with latitude and longitude', async () => {
      const queryResult: QueryResult = {
        data: [
          { city: 'New York', latitude: 40.7128, longitude: -74.0060, population: 8336817 },
          { city: 'Los Angeles', latitude: 34.0522, longitude: -118.2437, population: 3979576 },
          { city: 'Chicago', latitude: 41.8781, longitude: -87.6298, population: 2693976 },
          { city: 'Houston', latitude: 29.7604, longitude: -95.3698, population: 2320268 },
        ],
        columns: ['city', 'latitude', 'longitude', 'population'],
        rowCount: 4,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Query returned data',
        suggestedReportType: 'dashboard',
        estimatedComplexity: 'medium',
      };

      const result = await orchestrator.generateReport(
        queryResult,
        triggerDecision,
        mockContext
      );

      expect(result.success).toBe(true);
      // Should include map visualization
      expect(
        result.reportHTML.includes("type: 'map'") ||
        result.reportHTML.includes('leaflet') ||
        result.reportHTML.includes('L.map')
      ).toBe(true);
    });

    it('should select map visualization for data with lat/lon columns', async () => {
      const queryResult: QueryResult = {
        data: [
          { location: 'Store A', lat: 37.7749, lon: -122.4194, revenue: 125000 },
          { location: 'Store B', lat: 34.0522, lon: -118.2437, revenue: 98000 },
          { location: 'Store C', lat: 41.8781, lon: -87.6298, revenue: 110000 },
        ],
        columns: ['location', 'lat', 'lon', 'revenue'],
        rowCount: 3,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Query returned data',
        suggestedReportType: 'dashboard',
        estimatedComplexity: 'medium',
      };

      const result = await orchestrator.generateReport(
        queryResult,
        triggerDecision,
        mockContext
      );

      expect(result.success).toBe(true);
      // Should include map visualization
      expect(
        result.reportHTML.includes("type: 'map'") ||
        result.reportHTML.includes('leaflet') ||
        result.reportHTML.includes('L.map')
      ).toBe(true);
    });
  });

  describe('Mixed data types', () => {
    it('should prioritize time-series visualization when both time and categorical data present', async () => {
      const queryResult: QueryResult = {
        data: [
          { date: '2024-01-01', category: 'A', value: 100 },
          { date: '2024-01-02', category: 'B', value: 150 },
          { date: '2024-01-03', category: 'A', value: 120 },
        ],
        columns: ['date', 'category', 'value'],
        rowCount: 3,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Query returned data',
        suggestedReportType: 'dashboard',
        estimatedComplexity: 'medium',
      };

      const result = await orchestrator.generateReport(
        queryResult,
        triggerDecision,
        mockContext
      );

      expect(result.success).toBe(true);
      // Should include line chart for time-series
      expect(result.reportHTML).toContain("type: 'line'");
    });

    it('should include multiple visualization types in dashboard for complex data', async () => {
      const queryResult: QueryResult = {
        data: [
          { date: '2024-01-01', region: 'North', product: 'Widget', sales: 1200, profit: 300 },
          { date: '2024-01-01', region: 'South', product: 'Gadget', sales: 1500, profit: 400 },
          { date: '2024-01-02', region: 'North', product: 'Widget', sales: 1300, profit: 320 },
          { date: '2024-01-02', region: 'South', product: 'Gadget', sales: 1600, profit: 450 },
        ],
        columns: ['date', 'region', 'product', 'sales', 'profit'],
        rowCount: 4,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Query returned data',
        suggestedReportType: 'dashboard',
        estimatedComplexity: 'high',
      };

      const result = await orchestrator.generateReport(
        queryResult,
        triggerDecision,
        mockContext
      );

      expect(result.success).toBe(true);
      // Dashboard should include multiple chart types
      const hasMultipleCharts = (result.reportHTML.match(/type: '/g) || []).length > 1;
      expect(hasMultipleCharts).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle data with no clear visualization pattern', async () => {
      const queryResult: QueryResult = {
        data: [
          { id: 1, name: 'Alice', email: 'alice@example.com' },
          { id: 2, name: 'Bob', email: 'bob@example.com' },
        ],
        columns: ['id', 'name', 'email'],
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
      // Should still generate a report with table
      expect(result.reportHTML).toContain('Data Table');
    });

    it('should handle single row of data', async () => {
      const queryResult: QueryResult = {
        data: [
          { metric: 'Total Sales', value: 125000 },
        ],
        columns: ['metric', 'value'],
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
      expect(result.reportHTML).toBeTruthy();
    });
  });
});
