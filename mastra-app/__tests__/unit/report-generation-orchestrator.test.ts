/**
 * Unit tests for ReportGenerationOrchestrator
 * 
 * Tests the report generation pipeline coordination including simple reports,
 * dashboard reports, and gallery reports.
 * 
 * Requirements: 2.1, 3.1, 6.1
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReportGenerationOrchestrator } from '@/services/automatic-report-generation/report-generation-orchestrator';
import { ResultPresenter } from '@/services/result-presenter';
import { DashboardComposer } from '@/services/dashboard-composer';
import { ExportService } from '@/services/export-service';
import type { QueryResult } from '@/services/query-engine';
import type { TriggerDecision } from '@/services/automatic-report-generation/types';
import type { WorkflowContext } from '@/services/workflow-orchestrator';

describe('ReportGenerationOrchestrator', () => {
  let orchestrator: ReportGenerationOrchestrator;
  let resultPresenter: ResultPresenter;
  let dashboardComposer: DashboardComposer;
  let mockContext: WorkflowContext;

  beforeEach(() => {
    resultPresenter = new ResultPresenter();
    dashboardComposer = new DashboardComposer();
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

  describe('generateReport', () => {
    it('should generate a simple report when suggestedReportType is "simple"', async () => {
      const queryResult: QueryResult = {
        data: [
          { id: 1, name: 'Alice', score: 95 },
          { id: 2, name: 'Bob', score: 87 },
        ],
        columns: ['id', 'name', 'score'],
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
      expect(result.reportHTML).toBeTruthy();
      expect(result.reportHTML).toContain('<!DOCTYPE html>');
      expect(result.exportOptions.html).toBeDefined();
      expect(result.renderData.type).toBe('inline');
    });

    it('should generate a dashboard report when suggestedReportType is "dashboard"', async () => {
      const queryResult: QueryResult = {
        data: [
          { id: 1, category: 'A', value: 100 },
          { id: 2, category: 'B', value: 200 },
          { id: 3, category: 'A', value: 150 },
        ],
        columns: ['id', 'category', 'value'],
        rowCount: 3,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Complex data suitable for dashboard',
        suggestedReportType: 'dashboard',
        estimatedComplexity: 'medium',
      };

      const result = await orchestrator.generateReport(
        queryResult,
        triggerDecision,
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.reportHTML).toBeTruthy();
      expect(result.reportHTML).toContain('Categorical Comparison Dashboard');
      expect(result.dashboardLayout).toBeDefined();
      expect(result.exportOptions.html).toBeDefined();
      expect(result.exportOptions.excel).toBeDefined();
    });

    it('should generate a gallery report when suggestedReportType is "gallery"', async () => {
      const queryResult: QueryResult = {
        data: [
          { id: 1, image: 'data:image/png;base64,abc123', title: 'Image 1' },
          { id: 2, image: 'data:image/png;base64,def456', title: 'Image 2' },
        ],
        columns: ['id', 'image', 'title'],
        rowCount: 2,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Query contains image data',
        suggestedReportType: 'gallery',
        estimatedComplexity: 'low',
      };

      const result = await orchestrator.generateReport(
        queryResult,
        triggerDecision,
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.reportHTML).toBeTruthy();
      expect(result.reportHTML).toContain('Image Gallery');
      expect(result.exportOptions.html).toBeDefined();
    });

    it('should handle errors gracefully and return failed result', async () => {
      const queryResult: QueryResult = {
        data: [],
        columns: [],
        rowCount: 0,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Test error handling',
        suggestedReportType: 'simple',
        estimatedComplexity: 'low',
      };

      // Mock ResultPresenter to throw an error
      vi.spyOn(resultPresenter, 'formatResults').mockImplementation(() => {
        throw new Error('Formatting failed');
      });

      const result = await orchestrator.generateReport(
        queryResult,
        triggerDecision,
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Formatting failed');
    });

    it('should fallback to simple report for unknown report types', async () => {
      const queryResult: QueryResult = {
        data: [{ id: 1, value: 'test' }],
        columns: ['id', 'value'],
        rowCount: 1,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Unknown type test',
        suggestedReportType: 'unknown' as any,
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

  describe('simple report generation', () => {
    it('should format results with ResultPresenter', async () => {
      const queryResult: QueryResult = {
        data: [{ id: 1, name: 'Test' }],
        columns: ['id', 'name'],
        rowCount: 1,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Test',
        suggestedReportType: 'simple',
        estimatedComplexity: 'low',
      };

      const formatSpy = vi.spyOn(resultPresenter, 'formatResults');

      await orchestrator.generateReport(queryResult, triggerDecision, mockContext);

      expect(formatSpy).toHaveBeenCalledWith(queryResult, {
        preserveAspectRatio: true,
        maxImageWidth: 400,
        maxImageHeight: 400,
      });
    });

    it('should generate HTML with responsive layout', async () => {
      const queryResult: QueryResult = {
        data: [{ id: 1, value: 100 }],
        columns: ['id', 'value'],
        rowCount: 1,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Test',
        suggestedReportType: 'simple',
        estimatedComplexity: 'low',
      };

      const result = await orchestrator.generateReport(
        queryResult,
        triggerDecision,
        mockContext
      );

      expect(result.reportHTML).toContain('<meta name="viewport"');
      expect(result.reportHTML).toContain('Query Results');
    });

    it('should provide HTML export option', async () => {
      const queryResult: QueryResult = {
        data: [{ id: 1 }],
        columns: ['id'],
        rowCount: 1,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Test',
        suggestedReportType: 'simple',
        estimatedComplexity: 'low',
      };

      const result = await orchestrator.generateReport(
        queryResult,
        triggerDecision,
        mockContext
      );

      expect(result.exportOptions.html).toBeInstanceOf(Function);
      expect(result.exportOptions.excel).toBeUndefined();
    });
  });

  describe('dashboard report generation', () => {
    it('should create dashboard layout with sections', async () => {
      const queryResult: QueryResult = {
        data: [
          { id: 1, category: 'A', value: 100 },
          { id: 2, category: 'B', value: 200 },
        ],
        columns: ['id', 'category', 'value'],
        rowCount: 2,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Test',
        suggestedReportType: 'dashboard',
        estimatedComplexity: 'medium',
      };

      const result = await orchestrator.generateReport(
        queryResult,
        triggerDecision,
        mockContext
      );

      expect(result.dashboardLayout).toBeDefined();
      expect(result.dashboardLayout?.title).toBe('Categorical Comparison Dashboard');
      // Dashboard should have multiple sections: stats, primary viz, and data table
      expect(result.dashboardLayout?.sections.length).toBeGreaterThan(1);
      // Should include a data table section
      const hasTableSection = result.dashboardLayout?.sections.some(s => s.type === 'table');
      expect(hasTableSection).toBe(true);
    });

    it('should provide both HTML and Excel export options', async () => {
      const queryResult: QueryResult = {
        data: [{ id: 1, value: 100 }],
        columns: ['id', 'value'],
        rowCount: 1,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Test',
        suggestedReportType: 'dashboard',
        estimatedComplexity: 'medium',
      };

      const result = await orchestrator.generateReport(
        queryResult,
        triggerDecision,
        mockContext
      );

      expect(result.exportOptions.html).toBeInstanceOf(Function);
      expect(result.exportOptions.excel).toBeInstanceOf(Function);
    });

    it('should include dashboard header with title and description', async () => {
      const queryResult: QueryResult = {
        data: [{ id: 1 }, { id: 2 }, { id: 3 }],
        columns: ['id'],
        rowCount: 3,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Test',
        suggestedReportType: 'dashboard',
        estimatedComplexity: 'medium',
      };

      const result = await orchestrator.generateReport(
        queryResult,
        triggerDecision,
        mockContext
      );

      expect(result.reportHTML).toContain('Categorical Comparison Dashboard');
      expect(result.reportHTML).toContain('Analyzing 3 records');
    });
  });

  describe('gallery report generation', () => {
    it('should detect image columns by name patterns', async () => {
      const queryResult: QueryResult = {
        data: [
          { id: 1, image_url: 'http://example.com/img1.jpg', title: 'Image 1' },
          { id: 2, image_url: 'http://example.com/img2.jpg', title: 'Image 2' },
        ],
        columns: ['id', 'image_url', 'title'],
        rowCount: 2,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Test',
        suggestedReportType: 'gallery',
        estimatedComplexity: 'low',
      };

      const formatSpy = vi.spyOn(resultPresenter, 'formatResults');

      await orchestrator.generateReport(queryResult, triggerDecision, mockContext);

      expect(formatSpy).toHaveBeenCalledWith(
        queryResult,
        expect.objectContaining({
          imageColumns: expect.arrayContaining(['image_url']),
          preserveAspectRatio: true,
          maxImageWidth: 300,
          maxImageHeight: 300,
        })
      );
    });

    it('should detect and include similarity scores in gallery metadata', async () => {
      const queryResult: QueryResult = {
        data: [
          { id: 1, image: 'img1.jpg', similarity: 0.95 },
          { id: 2, image: 'img2.jpg', similarity: 0.87 },
        ],
        columns: ['id', 'image', 'similarity'],
        rowCount: 2,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Test',
        suggestedReportType: 'gallery',
        estimatedComplexity: 'low',
      };

      const formatSpy = vi.spyOn(resultPresenter, 'formatResults');

      await orchestrator.generateReport(queryResult, triggerDecision, mockContext);

      expect(formatSpy).toHaveBeenCalledWith(
        queryResult,
        expect.objectContaining({
          imageColumns: expect.arrayContaining(['image']),
          similarityColumn: 'similarity',
          preserveAspectRatio: true,
          maxImageWidth: 300,
          maxImageHeight: 300,
        })
      );
    });

    it('should detect and include view counts in gallery metadata', async () => {
      const queryResult: QueryResult = {
        data: [
          { id: 1, image: 'img1.jpg', view_count: 1500 },
          { id: 2, image: 'img2.jpg', view_count: 2300 },
        ],
        columns: ['id', 'image', 'view_count'],
        rowCount: 2,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Test',
        suggestedReportType: 'gallery',
        estimatedComplexity: 'low',
      };

      const formatSpy = vi.spyOn(resultPresenter, 'formatResults');

      await orchestrator.generateReport(queryResult, triggerDecision, mockContext);

      expect(formatSpy).toHaveBeenCalledWith(
        queryResult,
        expect.objectContaining({
          imageColumns: expect.arrayContaining(['image']),
          viewCountColumn: 'view_count',
          preserveAspectRatio: true,
          maxImageWidth: 300,
          maxImageHeight: 300,
        })
      );
    });

    it('should detect and include distance metadata in gallery', async () => {
      const queryResult: QueryResult = {
        data: [
          { id: 1, image: 'img1.jpg', distance: 2.5 },
          { id: 2, image: 'img2.jpg', distance: 5.8 },
        ],
        columns: ['id', 'image', 'distance'],
        rowCount: 2,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Test',
        suggestedReportType: 'gallery',
        estimatedComplexity: 'low',
      };

      const formatSpy = vi.spyOn(resultPresenter, 'formatResults');

      await orchestrator.generateReport(queryResult, triggerDecision, mockContext);

      expect(formatSpy).toHaveBeenCalledWith(
        queryResult,
        expect.objectContaining({
          imageColumns: expect.arrayContaining(['image']),
          distanceColumn: 'distance',
          distanceUnit: 'miles',
          preserveAspectRatio: true,
          maxImageWidth: 300,
          maxImageHeight: 300,
        })
      );
    });

    it('should detect multiple metadata columns simultaneously', async () => {
      const queryResult: QueryResult = {
        data: [
          { id: 1, photo: 'img1.jpg', similarity_score: 0.95, views: 1500, dist: 2.5 },
          { id: 2, photo: 'img2.jpg', similarity_score: 0.87, views: 2300, dist: 5.8 },
        ],
        columns: ['id', 'photo', 'similarity_score', 'views', 'dist'],
        rowCount: 2,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Test',
        suggestedReportType: 'gallery',
        estimatedComplexity: 'low',
      };

      const formatSpy = vi.spyOn(resultPresenter, 'formatResults');

      await orchestrator.generateReport(queryResult, triggerDecision, mockContext);

      expect(formatSpy).toHaveBeenCalledWith(
        queryResult,
        expect.objectContaining({
          imageColumns: expect.arrayContaining(['photo']),
          similarityColumn: 'similarity_score',
          viewCountColumn: 'views',
          distanceColumn: 'dist',
          distanceUnit: 'miles',
          preserveAspectRatio: true,
          maxImageWidth: 300,
          maxImageHeight: 300,
        })
      );
    });

    it('should include image count in gallery title', async () => {
      const queryResult: QueryResult = {
        data: [
          { id: 1, image: 'img1.jpg' },
          { id: 2, image: 'img2.jpg' },
          { id: 3, image: 'img3.jpg' },
        ],
        columns: ['id', 'image'],
        rowCount: 3,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Test',
        suggestedReportType: 'gallery',
        estimatedComplexity: 'low',
      };

      const result = await orchestrator.generateReport(queryResult, triggerDecision, mockContext);

      expect(result.reportHTML).toContain('Image Gallery (3 images)');
    });

    it('should use singular form for single image', async () => {
      const queryResult: QueryResult = {
        data: [
          { id: 1, image: 'img1.jpg' },
        ],
        columns: ['id', 'image'],
        rowCount: 1,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Test',
        suggestedReportType: 'gallery',
        estimatedComplexity: 'low',
      };

      const result = await orchestrator.generateReport(queryResult, triggerDecision, mockContext);

      expect(result.reportHTML).toContain('Image Gallery (1 image)');
    });

    it('should handle multiple image column patterns', async () => {
      const queryResult: QueryResult = {
        data: [
          { 
            id: 1, 
            photo: 'img1.jpg', 
            thumbnail: 'thumb1.jpg',
            avatar: 'avatar1.jpg'
          },
        ],
        columns: ['id', 'photo', 'thumbnail', 'avatar'],
        rowCount: 1,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Test',
        suggestedReportType: 'gallery',
        estimatedComplexity: 'low',
      };

      const formatSpy = vi.spyOn(resultPresenter, 'formatResults');

      await orchestrator.generateReport(queryResult, triggerDecision, mockContext);

      const callArgs = formatSpy.mock.calls[0][1];
      expect(callArgs?.imageColumns).toContain('photo');
      expect(callArgs?.imageColumns).toContain('thumbnail');
      expect(callArgs?.imageColumns).toContain('avatar');
    });

    it('should generate gallery with grid layout', async () => {
      const queryResult: QueryResult = {
        data: [
          { id: 1, image: 'img1.jpg' },
          { id: 2, image: 'img2.jpg' },
        ],
        columns: ['id', 'image'],
        rowCount: 2,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Test',
        suggestedReportType: 'gallery',
        estimatedComplexity: 'low',
      };

      const generateHTMLSpy = vi.spyOn(resultPresenter, 'generateHTML');

      await orchestrator.generateReport(queryResult, triggerDecision, mockContext);

      expect(generateHTMLSpy).toHaveBeenCalledWith(expect.anything(), 'grid');
    });

    it('should handle empty image columns gracefully', async () => {
      const queryResult: QueryResult = {
        data: [{ id: 1, value: 'test' }],
        columns: ['id', 'value'],
        rowCount: 1,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Test',
        suggestedReportType: 'gallery',
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

  describe('integration with services', () => {
    it('should use ResultPresenter for formatting', async () => {
      const queryResult: QueryResult = {
        data: [{ id: 1 }],
        columns: ['id'],
        rowCount: 1,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Test',
        suggestedReportType: 'simple',
        estimatedComplexity: 'low',
      };

      const formatSpy = vi.spyOn(resultPresenter, 'formatResults');
      const generateHTMLSpy = vi.spyOn(resultPresenter, 'generateHTML');

      await orchestrator.generateReport(queryResult, triggerDecision, mockContext);

      expect(formatSpy).toHaveBeenCalled();
      expect(generateHTMLSpy).toHaveBeenCalled();
    });

    it('should use DashboardComposer for layout generation', async () => {
      const queryResult: QueryResult = {
        data: [{ id: 1 }],
        columns: ['id'],
        rowCount: 1,
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Test',
        suggestedReportType: 'dashboard',
        estimatedComplexity: 'medium',
      };

      const generateLayoutSpy = vi.spyOn(dashboardComposer, 'generateResponsiveLayout');
      const generateTableSpy = vi.spyOn(dashboardComposer, 'generateDataTable');

      await orchestrator.generateReport(queryResult, triggerDecision, mockContext);

      expect(generateLayoutSpy).toHaveBeenCalled();
      expect(generateTableSpy).toHaveBeenCalled();
    });
  });
});
