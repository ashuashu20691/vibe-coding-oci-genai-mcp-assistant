/**
 * Unit tests for AutomaticReportGenerator
 * 
 * Tests the main service that integrates report generation with the workflow system.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AutomaticReportGenerator } from '@/services/automatic-report-generation/automatic-report-generator';
import { ReportTriggerDetector } from '@/services/automatic-report-generation/report-trigger-detector';
import { ReportGenerationOrchestrator } from '@/services/automatic-report-generation/report-generation-orchestrator';
import type { AutoReportConfig, TriggerDecision, ReportGenerationResult } from '@/services/automatic-report-generation/types';
import type { QueryResult } from '@/services/query-engine';
import type { WorkflowContext, WorkflowStep } from '@/services/workflow-orchestrator';

describe('AutomaticReportGenerator', () => {
  let generator: AutomaticReportGenerator;
  let mockTriggerDetector: ReportTriggerDetector;
  let mockReportOrchestrator: ReportGenerationOrchestrator;
  let config: AutoReportConfig;

  beforeEach(() => {
    // Create default configuration
    config = {
      enabled: true,
      triggerConfig: {
        minRows: 1,
        maxRows: 10000,
        enabledByDefault: true,
      },
      performanceConfig: {
        maxGenerationTimeMs: 5000,
        enableProgressiveRendering: true,
        cacheEnabled: true,
      },
    };

    // Create mock services
    mockTriggerDetector = {
      shouldTriggerReport: vi.fn(),
      analyzeDataCharacteristics: vi.fn(),
    } as any;

    mockReportOrchestrator = {
      generateReport: vi.fn(),
    } as any;

    // Create generator instance
    generator = new AutomaticReportGenerator(
      config,
      mockTriggerDetector,
      mockReportOrchestrator
    );
  });

  describe('createReportGenerationStep', () => {
    it('should create a workflow step with proper structure', () => {
      // Arrange
      const queryStepId = 'query_step_123';
      const queryResult: QueryResult = {
        success: true,
        data: [{ id: 1, name: 'Test' }],
        columns: ['id', 'name'],
        rowCount: 1,
        executionTimeMs: 100,
        sql: 'SELECT id, name FROM test',
      };

      // Act
      const step = generator.createReportGenerationStep(queryStepId, queryResult);

      // Assert
      expect(step).toBeDefined();
      expect(step.id).toMatch(/^generate_report_/);
      expect(step.type).toBe('custom');
      expect(step.description).toBe('Generate visual report from query results');
      expect(step.status).toBe('pending');
    });

    it('should set proper dependencies on query step (Requirement 6.2)', () => {
      // Arrange
      const queryStepId = 'query_step_456';
      const queryResult: QueryResult = {
        success: true,
        data: [{ id: 1 }],
        columns: ['id'],
        rowCount: 1,
        executionTimeMs: 50,
        sql: 'SELECT id FROM test',
      };

      // Act
      const step = generator.createReportGenerationStep(queryStepId, queryResult);

      // Assert
      expect(step.dependencies).toEqual([queryStepId]);
    });

    it('should include query result in step parameters', () => {
      // Arrange
      const queryStepId = 'query_step_789';
      const queryResult: QueryResult = {
        success: true,
        data: [{ id: 1, value: 100 }],
        columns: ['id', 'value'],
        rowCount: 1,
        executionTimeMs: 75,
        sql: 'SELECT id, value FROM test',
      };

      // Act
      const step = generator.createReportGenerationStep(queryStepId, queryResult);

      // Assert
      expect(step.parameters.queryStepId).toBe(queryStepId);
      expect(step.parameters.queryResult).toBe(queryResult);
      expect(step.parameters.reportType).toBe('automatic');
    });

    it('should generate unique step IDs for multiple calls', () => {
      // Arrange
      const queryStepId = 'query_step_001';
      const queryResult: QueryResult = {
        success: true,
        data: [{ id: 1 }],
        columns: ['id'],
        rowCount: 1,
        executionTimeMs: 50,
        sql: 'SELECT id FROM test',
      };

      // Act
      const step1 = generator.createReportGenerationStep(queryStepId, queryResult);
      const step2 = generator.createReportGenerationStep(queryStepId, queryResult);

      // Assert
      expect(step1.id).not.toBe(step2.id);
    });
  });

  describe('executeReportGeneration', () => {
    it('should execute report generation successfully (Requirement 6.1)', async () => {
      // Arrange
      const queryResult: QueryResult = {
        success: true,
        data: [{ id: 1, name: 'Test', value: 100 }],
        columns: ['id', 'name', 'value'],
        rowCount: 1,
        executionTimeMs: 100,
        sql: 'SELECT id, name, value FROM test',
      };

      const step: WorkflowStep = {
        id: 'report_step_1',
        type: 'custom',
        description: 'Generate report',
        parameters: {
          queryStepId: 'query_step_1',
          queryResult,
        },
        dependencies: ['query_step_1'],
        status: 'pending',
      };

      const context: WorkflowContext = {
        database: 'test_db',
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Valid query results',
        suggestedReportType: 'simple',
        estimatedComplexity: 'low',
      };

      const expectedResult: ReportGenerationResult = {
        success: true,
        reportHTML: '<div>Test Report</div>',
        exportOptions: {
          html: vi.fn(),
        },
        renderData: {
          type: 'inline',
          content: '<div>Test Report</div>',
        },
      };

      vi.mocked(mockTriggerDetector.shouldTriggerReport).mockReturnValue(triggerDecision);
      vi.mocked(mockReportOrchestrator.generateReport).mockResolvedValue(expectedResult);

      // Act
      const result = await generator.executeReportGeneration(
        step,
        context,
        new Map()
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.reportHTML).toBe('<div>Test Report</div>');
      expect(mockTriggerDetector.shouldTriggerReport).toHaveBeenCalledWith(
        queryResult,
        context
      );
      expect(mockReportOrchestrator.generateReport).toHaveBeenCalledWith(
        queryResult,
        triggerDecision,
        context
      );
    });

    it('should skip report generation when disabled', async () => {
      // Arrange
      generator.updateConfig({ enabled: false });

      const queryResult: QueryResult = {
        success: true,
        data: [{ id: 1 }],
        columns: ['id'],
        rowCount: 1,
        executionTimeMs: 50,
        sql: 'SELECT id FROM test',
      };

      const step: WorkflowStep = {
        id: 'report_step_2',
        type: 'custom',
        description: 'Generate report',
        parameters: {
          queryStepId: 'query_step_2',
          queryResult,
        },
        dependencies: ['query_step_2'],
        status: 'pending',
      };

      // Act
      const result = await generator.executeReportGeneration(
        step,
        {},
        new Map()
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('disabled');
      expect(mockTriggerDetector.shouldTriggerReport).not.toHaveBeenCalled();
      expect(mockReportOrchestrator.generateReport).not.toHaveBeenCalled();
    });

    it('should skip report generation when trigger decision is negative', async () => {
      // Arrange
      const queryResult: QueryResult = {
        success: true,
        data: [],
        columns: ['id'],
        rowCount: 0,
        executionTimeMs: 50,
        sql: 'SELECT id FROM test WHERE 1=0',
      };

      const step: WorkflowStep = {
        id: 'report_step_3',
        type: 'custom',
        description: 'Generate report',
        parameters: {
          queryStepId: 'query_step_3',
          queryResult,
        },
        dependencies: ['query_step_3'],
        status: 'pending',
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: false,
        reason: 'Query returned zero rows',
        suggestedReportType: 'simple',
        estimatedComplexity: 'low',
      };

      vi.mocked(mockTriggerDetector.shouldTriggerReport).mockReturnValue(triggerDecision);

      // Act
      const result = await generator.executeReportGeneration(
        step,
        {},
        new Map()
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Report generation skipped');
      expect(result.error?.message).toContain('zero rows');
      expect(mockReportOrchestrator.generateReport).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully without throwing (Requirement 6.3)', async () => {
      // Arrange
      const queryResult: QueryResult = {
        success: true,
        data: [{ id: 1 }],
        columns: ['id'],
        rowCount: 1,
        executionTimeMs: 50,
        sql: 'SELECT id FROM test',
      };

      const step: WorkflowStep = {
        id: 'report_step_4',
        type: 'custom',
        description: 'Generate report',
        parameters: {
          queryStepId: 'query_step_4',
          queryResult,
        },
        dependencies: ['query_step_4'],
        status: 'pending',
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Valid results',
        suggestedReportType: 'simple',
        estimatedComplexity: 'low',
      };

      vi.mocked(mockTriggerDetector.shouldTriggerReport).mockReturnValue(triggerDecision);
      vi.mocked(mockReportOrchestrator.generateReport).mockRejectedValue(
        new Error('Report generation failed')
      );

      // Act
      const result = await generator.executeReportGeneration(
        step,
        {},
        new Map()
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Report generation failed');
    });

    it('should handle non-Error exceptions', async () => {
      // Arrange
      const queryResult: QueryResult = {
        success: true,
        data: [{ id: 1 }],
        columns: ['id'],
        rowCount: 1,
        executionTimeMs: 50,
        sql: 'SELECT id FROM test',
      };

      const step: WorkflowStep = {
        id: 'report_step_5',
        type: 'custom',
        description: 'Generate report',
        parameters: {
          queryStepId: 'query_step_5',
          queryResult,
        },
        dependencies: ['query_step_5'],
        status: 'pending',
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Valid results',
        suggestedReportType: 'simple',
        estimatedComplexity: 'low',
      };

      vi.mocked(mockTriggerDetector.shouldTriggerReport).mockReturnValue(triggerDecision);
      vi.mocked(mockReportOrchestrator.generateReport).mockRejectedValue('String error');

      // Act
      const result = await generator.executeReportGeneration(
        step,
        {},
        new Map()
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('String error');
    });
  });

  describe('getStepExecutor', () => {
    it('should return a valid step executor function', () => {
      // Act
      const executor = generator.getStepExecutor();

      // Assert
      expect(executor).toBeDefined();
      expect(typeof executor).toBe('function');
    });

    it('should execute report generation when called', async () => {
      // Arrange
      const executor = generator.getStepExecutor();

      const queryResult: QueryResult = {
        success: true,
        data: [{ id: 1 }],
        columns: ['id'],
        rowCount: 1,
        executionTimeMs: 50,
        sql: 'SELECT id FROM test',
      };

      const step: WorkflowStep = {
        id: 'report_step_6',
        type: 'custom',
        description: 'Generate report',
        parameters: {
          queryStepId: 'query_step_6',
          queryResult,
        },
        dependencies: ['query_step_6'],
        status: 'pending',
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Valid results',
        suggestedReportType: 'simple',
        estimatedComplexity: 'low',
      };

      const expectedResult: ReportGenerationResult = {
        success: true,
        reportHTML: '<div>Report</div>',
        exportOptions: {
          html: vi.fn(),
        },
        renderData: {
          type: 'inline',
          content: '<div>Report</div>',
        },
      };

      vi.mocked(mockTriggerDetector.shouldTriggerReport).mockReturnValue(triggerDecision);
      vi.mocked(mockReportOrchestrator.generateReport).mockResolvedValue(expectedResult);

      // Act
      const result = await executor(step, {}, new Map());

      // Assert
      expect(result).toBeDefined();
      expect((result as ReportGenerationResult).success).toBe(true);
    });
  });

  describe('isEnabled', () => {
    it('should return true when enabled', () => {
      // Act & Assert
      expect(generator.isEnabled()).toBe(true);
    });

    it('should return false when disabled', () => {
      // Arrange
      generator.updateConfig({ enabled: false });

      // Act & Assert
      expect(generator.isEnabled()).toBe(false);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      // Arrange
      const newConfig: Partial<AutoReportConfig> = {
        enabled: false,
      };

      // Act
      generator.updateConfig(newConfig);

      // Assert
      expect(generator.isEnabled()).toBe(false);
    });

    it('should merge configuration partially', () => {
      // Arrange
      const originalEnabled = generator.isEnabled();

      // Act
      generator.updateConfig({
        performanceConfig: {
          maxGenerationTimeMs: 10000,
          enableProgressiveRendering: false,
          cacheEnabled: false,
        },
      });

      // Assert
      expect(generator.isEnabled()).toBe(originalEnabled); // Should remain unchanged
    });
  });

  describe('Edge cases', () => {
    it('should handle missing query result in step parameters', async () => {
      // Arrange
      const step: WorkflowStep = {
        id: 'report_step_7',
        type: 'custom',
        description: 'Generate report',
        parameters: {
          queryStepId: 'query_step_7',
          // Missing queryResult
        },
        dependencies: ['query_step_7'],
        status: 'pending',
      };

      // Act
      const result = await generator.executeReportGeneration(
        step,
        {},
        new Map()
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle empty context', async () => {
      // Arrange
      const queryResult: QueryResult = {
        success: true,
        data: [{ id: 1 }],
        columns: ['id'],
        rowCount: 1,
        executionTimeMs: 50,
        sql: 'SELECT id FROM test',
      };

      const step: WorkflowStep = {
        id: 'report_step_8',
        type: 'custom',
        description: 'Generate report',
        parameters: {
          queryStepId: 'query_step_8',
          queryResult,
        },
        dependencies: ['query_step_8'],
        status: 'pending',
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Valid results',
        suggestedReportType: 'simple',
        estimatedComplexity: 'low',
      };

      const expectedResult: ReportGenerationResult = {
        success: true,
        reportHTML: '<div>Report</div>',
        exportOptions: {
          html: vi.fn(),
        },
        renderData: {
          type: 'inline',
          content: '<div>Report</div>',
        },
      };

      vi.mocked(mockTriggerDetector.shouldTriggerReport).mockReturnValue(triggerDecision);
      vi.mocked(mockReportOrchestrator.generateReport).mockResolvedValue(expectedResult);

      // Act
      const result = await generator.executeReportGeneration(
        step,
        {}, // Empty context
        new Map()
      );

      // Assert
      expect(result.success).toBe(true);
    });

    it('should retrieve query result from previousResults when not in parameters', async () => {
      // Arrange
      const queryResult: QueryResult = {
        success: true,
        data: [{ id: 1, name: 'Test' }],
        columns: ['id', 'name'],
        rowCount: 1,
        executionTimeMs: 100,
        sql: 'SELECT id, name FROM test',
      };

      const step: WorkflowStep = {
        id: 'report_step_9',
        type: 'custom',
        description: 'Generate report',
        parameters: {
          queryStepId: 'query_step_9',
          // queryResult not in parameters
        },
        dependencies: ['query_step_9'],
        status: 'pending',
      };

      const previousResults = new Map<string, unknown>();
      previousResults.set('query_step_9', queryResult);

      const context: WorkflowContext = {};

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Valid results',
        suggestedReportType: 'simple',
        estimatedComplexity: 'low',
      };

      const expectedResult: ReportGenerationResult = {
        success: true,
        reportHTML: '<div>Report</div>',
        exportOptions: {
          html: vi.fn(),
        },
        renderData: {
          type: 'inline',
          content: '<div>Report</div>',
        },
      };

      vi.mocked(mockTriggerDetector.shouldTriggerReport).mockReturnValue(triggerDecision);
      vi.mocked(mockReportOrchestrator.generateReport).mockResolvedValue(expectedResult);

      // Act
      const result = await generator.executeReportGeneration(
        step,
        context,
        previousResults
      );

      // Assert
      expect(result.success).toBe(true);
      expect(mockTriggerDetector.shouldTriggerReport).toHaveBeenCalledWith(
        queryResult,
        expect.objectContaining({}) // Context will be modified with progress messages and report generation data
      );
    });
  });

  describe('Progress events and result storage (Requirements 6.4, 6.5)', () => {
    it('should emit progress events during report generation (Requirement 6.4)', async () => {
      // Arrange
      const queryResult: QueryResult = {
        success: true,
        data: [{ id: 1, value: 100 }],
        columns: ['id', 'value'],
        rowCount: 1,
        executionTimeMs: 100,
        sql: 'SELECT id, value FROM test',
      };

      const step: WorkflowStep = {
        id: 'report_step_10',
        type: 'custom',
        description: 'Generate report',
        parameters: {
          queryStepId: 'query_step_10',
          queryResult,
        },
        dependencies: ['query_step_10'],
        status: 'pending',
      };

      const context: WorkflowContext = {
        database: 'test_db',
      };

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Valid results',
        suggestedReportType: 'dashboard',
        estimatedComplexity: 'medium',
      };

      const expectedResult: ReportGenerationResult = {
        success: true,
        reportHTML: '<div>Dashboard Report</div>',
        exportOptions: {
          html: vi.fn(),
        },
        renderData: {
          type: 'inline',
          content: '<div>Dashboard Report</div>',
        },
      };

      vi.mocked(mockTriggerDetector.shouldTriggerReport).mockReturnValue(triggerDecision);
      vi.mocked(mockReportOrchestrator.generateReport).mockResolvedValue(expectedResult);

      // Act
      await generator.executeReportGeneration(step, context, new Map());

      // Assert - Check that progress messages were added to context
      expect(context.progressMessages).toBeDefined();
      const progressMessages = context.progressMessages as Array<{ stepId: string; message: string; timestamp: Date }>;
      expect(progressMessages).toHaveLength(3);
      expect(progressMessages[0].message).toContain('Analyzing query results');
      expect(progressMessages[1].message).toContain('Generating dashboard report');
      expect(progressMessages[2].message).toContain('completed successfully');
    });

    it('should store result in workflow context (Requirement 6.5)', async () => {
      // Arrange
      const queryResult: QueryResult = {
        success: true,
        data: [{ id: 1 }],
        columns: ['id'],
        rowCount: 1,
        executionTimeMs: 50,
        sql: 'SELECT id FROM test',
      };

      const step: WorkflowStep = {
        id: 'report_step_11',
        type: 'custom',
        description: 'Generate report',
        parameters: {
          queryStepId: 'query_step_11',
          queryResult,
        },
        dependencies: ['query_step_11'],
        status: 'pending',
      };

      const context: WorkflowContext = {};

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Valid results',
        suggestedReportType: 'simple',
        estimatedComplexity: 'low',
      };

      const expectedResult: ReportGenerationResult = {
        success: true,
        reportHTML: '<div>Simple Report</div>',
        exportOptions: {
          html: vi.fn(),
        },
        renderData: {
          type: 'inline',
          content: '<div>Simple Report</div>',
        },
      };

      vi.mocked(mockTriggerDetector.shouldTriggerReport).mockReturnValue(triggerDecision);
      vi.mocked(mockReportOrchestrator.generateReport).mockResolvedValue(expectedResult);

      // Act
      await generator.executeReportGeneration(step, context, new Map());

      // Assert - Check that result was stored in context
      expect(context.reportGeneration).toBeDefined();
      const reportGeneration = context.reportGeneration as Record<string, any>;
      expect(reportGeneration[step.id]).toBeDefined();
      expect(reportGeneration[step.id].result).toEqual(expectedResult);
      expect(reportGeneration[step.id].generationTimeMs).toBeGreaterThanOrEqual(0);
      expect(reportGeneration[step.id].timestamp).toBeInstanceOf(Date);
    });

    it('should store result in context even when generation is disabled', async () => {
      // Arrange
      generator.updateConfig({ enabled: false });

      const queryResult: QueryResult = {
        success: true,
        data: [{ id: 1 }],
        columns: ['id'],
        rowCount: 1,
        executionTimeMs: 50,
        sql: 'SELECT id FROM test',
      };

      const step: WorkflowStep = {
        id: 'report_step_12',
        type: 'custom',
        description: 'Generate report',
        parameters: {
          queryStepId: 'query_step_12',
          queryResult,
        },
        dependencies: ['query_step_12'],
        status: 'pending',
      };

      const context: WorkflowContext = {};

      // Act
      await generator.executeReportGeneration(step, context, new Map());

      // Assert
      expect(context.reportGeneration).toBeDefined();
      const reportGeneration = context.reportGeneration as Record<string, any>;
      expect(reportGeneration[step.id]).toBeDefined();
      expect(reportGeneration[step.id].result.success).toBe(false);
      expect(reportGeneration[step.id].result.error?.message).toContain('disabled');
    });

    it('should store result in context even when trigger decision is negative', async () => {
      // Arrange
      const queryResult: QueryResult = {
        success: true,
        data: [],
        columns: ['id'],
        rowCount: 0,
        executionTimeMs: 50,
        sql: 'SELECT id FROM test WHERE 1=0',
      };

      const step: WorkflowStep = {
        id: 'report_step_13',
        type: 'custom',
        description: 'Generate report',
        parameters: {
          queryStepId: 'query_step_13',
          queryResult,
        },
        dependencies: ['query_step_13'],
        status: 'pending',
      };

      const context: WorkflowContext = {};

      const triggerDecision: TriggerDecision = {
        shouldGenerate: false,
        reason: 'Query returned zero rows',
        suggestedReportType: 'simple',
        estimatedComplexity: 'low',
      };

      vi.mocked(mockTriggerDetector.shouldTriggerReport).mockReturnValue(triggerDecision);

      // Act
      await generator.executeReportGeneration(step, context, new Map());

      // Assert
      expect(context.reportGeneration).toBeDefined();
      const reportGeneration = context.reportGeneration as Record<string, any>;
      expect(reportGeneration[step.id]).toBeDefined();
      expect(reportGeneration[step.id].result.success).toBe(false);
    });

    it('should emit error progress and store result on failure (Requirements 6.3, 6.4, 6.5)', async () => {
      // Arrange
      const queryResult: QueryResult = {
        success: true,
        data: [{ id: 1 }],
        columns: ['id'],
        rowCount: 1,
        executionTimeMs: 50,
        sql: 'SELECT id FROM test',
      };

      const step: WorkflowStep = {
        id: 'report_step_14',
        type: 'custom',
        description: 'Generate report',
        parameters: {
          queryStepId: 'query_step_14',
          queryResult,
        },
        dependencies: ['query_step_14'],
        status: 'pending',
      };

      const context: WorkflowContext = {};

      const triggerDecision: TriggerDecision = {
        shouldGenerate: true,
        reason: 'Valid results',
        suggestedReportType: 'simple',
        estimatedComplexity: 'low',
      };

      vi.mocked(mockTriggerDetector.shouldTriggerReport).mockReturnValue(triggerDecision);
      vi.mocked(mockReportOrchestrator.generateReport).mockRejectedValue(
        new Error('Chart rendering failed')
      );

      // Act
      const result = await generator.executeReportGeneration(step, context, new Map());

      // Assert - Non-blocking failure (Requirement 6.3)
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Chart rendering failed');

      // Assert - Progress event emitted (Requirement 6.4)
      expect(context.progressMessages).toBeDefined();
      const progressMessages = context.progressMessages as Array<{ stepId: string; message: string; timestamp: Date }>;
      const errorMessage = progressMessages.find((m: { message: string }) => m.message.includes('failed'));
      expect(errorMessage).toBeDefined();
      expect(errorMessage?.message).toContain('Chart rendering failed');

      // Assert - Result stored in context (Requirement 6.5)
      expect(context.reportGeneration).toBeDefined();
      const reportGeneration = context.reportGeneration as Record<string, any>;
      expect(reportGeneration[step.id]).toBeDefined();
      expect(reportGeneration[step.id].result.success).toBe(false);
    });
  });
});
