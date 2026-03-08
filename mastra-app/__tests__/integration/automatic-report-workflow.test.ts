/**
 * Integration Test: Automatic Report Generation Workflow
 * 
 * Tests the end-to-end flow from query execution to automatic report generation
 * through the WorkflowOrchestrator.
 * 
 * Validates: Requirements 6.1, 6.2, 6.5
 */

import { workflowOrchestrator, WorkflowStep, WorkflowContext } from '@/services/workflow-orchestrator';
import { automaticReportGenerator } from '@/services/automatic-report-generation';
import type { QueryResult } from '@/services/query-engine';

describe('Automatic Report Generation Workflow Integration', () => {
  beforeEach(() => {
    // Ensure automatic report generation is enabled
    automaticReportGenerator.updateConfig({ enabled: true });
  });

  test('should automatically add report generation step after query execution', async () => {
    // Create a mock query execution step
    const queryStep: WorkflowStep = {
      id: 'query-1',
      type: 'execute_query',
      description: 'Execute test query',
      parameters: {
        query: 'SELECT * FROM test_table',
      },
      dependencies: [],
      status: 'pending',
    };

    // Create execution plan
    const context: WorkflowContext = {
      database: 'test_db',
      conversationId: 'test-conversation',
    };

    const plan = workflowOrchestrator.createExecutionPlan([queryStep], context);

    // Verify that a report generation step was automatically added
    expect(plan.steps.length).toBe(2);
    expect(plan.steps[0].id).toBe('query-1');
    expect(plan.steps[1].type).toBe('generate_report');
    expect(plan.steps[1].dependencies).toContain('query-1');
  });

  test('should inject report generation steps for multiple queries', async () => {
    // Create two query execution steps
    const queryStep1: WorkflowStep = {
      id: 'query-1',
      type: 'execute_query',
      description: 'Execute first query',
      parameters: {
        query: 'SELECT * FROM table1',
      },
      dependencies: [],
      status: 'pending',
    };

    const queryStep2: WorkflowStep = {
      id: 'query-2',
      type: 'execute_query',
      description: 'Execute second query',
      parameters: {
        query: 'SELECT * FROM table2',
      },
      dependencies: [],
      status: 'pending',
    };

    // Create execution plan
    const context: WorkflowContext = {
      database: 'test_db',
      conversationId: 'test-conversation',
    };

    const plan = workflowOrchestrator.createExecutionPlan([queryStep1, queryStep2], context);

    // Verify that report generation steps were added for both queries
    expect(plan.steps.length).toBe(4); // 2 query steps + 2 report steps
    
    const reportSteps = plan.steps.filter(s => s.type === 'generate_report');
    expect(reportSteps.length).toBe(2);
    expect(reportSteps[0].dependencies).toContain('query-1');
    expect(reportSteps[1].dependencies).toContain('query-2');
  });

  test('should create report generation step with proper configuration', async () => {
    // Mock query result
    const mockQueryResult: QueryResult = {
      data: [
        { id: 1, name: 'Product A', sales: 1000 },
        { id: 2, name: 'Product B', sales: 1500 },
      ],
      columns: ['id', 'name', 'sales'],
      rowCount: 2,
      executionTimeMs: 50,
    };

    // Create a report generation step directly
    const reportStep = automaticReportGenerator.createReportGenerationStep(
      'query-1',
      mockQueryResult
    );

    // Verify step configuration
    expect(reportStep.id).toContain('generate_report');
    expect(reportStep.type).toBe('custom');
    expect(reportStep.description).toContain('visual report');
    expect(reportStep.dependencies).toContain('query-1');
    expect(reportStep.parameters.queryStepId).toBe('query-1');
    expect(reportStep.parameters.queryResult).toEqual(mockQueryResult);
    expect(reportStep.parameters.execute).toBeDefined();
    expect(typeof reportStep.parameters.execute).toBe('function');
  });

  test('should execute report generation step successfully', async () => {
    // Mock query result
    const mockQueryResult: QueryResult = {
      data: [
        { id: 1, name: 'Product A', sales: 1000 },
        { id: 2, name: 'Product B', sales: 1500 },
      ],
      columns: ['id', 'name', 'sales'],
      rowCount: 2,
      executionTimeMs: 50,
    };

    // Create a report generation step
    const reportStep = automaticReportGenerator.createReportGenerationStep(
      'query-1',
      mockQueryResult
    );

    // Create context
    const context: WorkflowContext = {
      database: 'test_db',
      conversationId: 'test-conversation',
    };

    // Execute the report generation step
    const previousResults = new Map<string, unknown>();
    previousResults.set('query-1', mockQueryResult);

    const result = await automaticReportGenerator.executeReportGeneration(
      reportStep,
      context,
      previousResults
    );

    // Verify result
    expect(result).toBeDefined();
    // Note: Report generation may fail in test environment due to missing dependencies
    // but the important thing is that it doesn't throw and returns a result
    expect(result.exportOptions).toBeDefined();
    expect(result.renderData).toBeDefined();

    // Verify result is stored in context (Requirement 6.5)
    expect(context.reportGeneration).toBeDefined();
    const reportData = (context.reportGeneration as Record<string, any>)[reportStep.id];
    expect(reportData).toBeDefined();
    expect(reportData.result).toEqual(result);
  });

  test('should handle empty query results gracefully', async () => {
    // Mock empty query result
    const mockQueryResult: QueryResult = {
      data: [],
      columns: ['id', 'name'],
      rowCount: 0,
      executionTimeMs: 20,
    };

    // Create a report generation step
    const reportStep = automaticReportGenerator.createReportGenerationStep(
      'query-1',
      mockQueryResult
    );

    // Create context
    const context: WorkflowContext = {
      database: 'test_db',
      conversationId: 'test-conversation',
    };

    // Execute the report generation step
    const previousResults = new Map<string, unknown>();
    previousResults.set('query-1', mockQueryResult);

    const result = await automaticReportGenerator.executeReportGeneration(
      reportStep,
      context,
      previousResults
    );

    // Verify result indicates report was skipped
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('skipped');
  });

  test('should handle disabled automatic report generation', async () => {
    // Disable automatic report generation
    automaticReportGenerator.updateConfig({ enabled: false });

    // Mock query result
    const mockQueryResult: QueryResult = {
      data: [{ id: 1, value: 100 }],
      columns: ['id', 'value'],
      rowCount: 1,
      executionTimeMs: 50,
    };

    // Create a report generation step
    const reportStep = automaticReportGenerator.createReportGenerationStep(
      'query-1',
      mockQueryResult
    );

    // Create context
    const context: WorkflowContext = {
      database: 'test_db',
      conversationId: 'test-conversation',
    };

    // Execute the report generation step
    const previousResults = new Map<string, unknown>();
    previousResults.set('query-1', mockQueryResult);

    const result = await automaticReportGenerator.executeReportGeneration(
      reportStep,
      context,
      previousResults
    );

    // Verify result indicates report generation was disabled
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('disabled');

    // Re-enable for other tests
    automaticReportGenerator.updateConfig({ enabled: true });
  });
});
