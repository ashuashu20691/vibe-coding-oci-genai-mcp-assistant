/**
 * Unit tests for WorkflowOrchestrator
 * 
 * Tests workflow execution, dependency resolution, progress tracking,
 * and insight generation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  WorkflowOrchestrator,
  WorkflowStep,
  WorkflowContext,
  ProgressEvent,
} from '@/services/workflow-orchestrator';

describe('WorkflowOrchestrator', () => {
  let orchestrator: WorkflowOrchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator();
  });

  describe('createExecutionPlan', () => {
    it('should create a valid execution plan', () => {
      const steps: WorkflowStep[] = [
        {
          id: 'step1',
          type: 'custom',
          description: 'First step',
          parameters: {},
          dependencies: [],
          status: 'pending',
        },
        {
          id: 'step2',
          type: 'custom',
          description: 'Second step',
          parameters: {},
          dependencies: ['step1'],
          status: 'pending',
        },
      ];

      const context: WorkflowContext = {
        database: 'test_db',
      };

      const plan = orchestrator.createExecutionPlan(steps, context);

      expect(plan.id).toBeDefined();
      expect(plan.steps).toHaveLength(2);
      expect(plan.context.database).toBe('test_db');
      expect(plan.createdAt).toBeInstanceOf(Date);
    });

    it('should sort steps by dependencies (topological sort)', () => {
      const steps: WorkflowStep[] = [
        {
          id: 'step3',
          type: 'custom',
          description: 'Third step',
          parameters: {},
          dependencies: ['step1', 'step2'],
          status: 'pending',
        },
        {
          id: 'step1',
          type: 'custom',
          description: 'First step',
          parameters: {},
          dependencies: [],
          status: 'pending',
        },
        {
          id: 'step2',
          type: 'custom',
          description: 'Second step',
          parameters: {},
          dependencies: ['step1'],
          status: 'pending',
        },
      ];

      const plan = orchestrator.createExecutionPlan(steps, {});

      // Steps should be sorted: step1, step2, step3
      expect(plan.steps[0].id).toBe('step1');
      expect(plan.steps[1].id).toBe('step2');
      expect(plan.steps[2].id).toBe('step3');
    });

    it('should throw error for invalid dependencies', () => {
      const steps: WorkflowStep[] = [
        {
          id: 'step1',
          type: 'custom',
          description: 'First step',
          parameters: {},
          dependencies: ['nonexistent'],
          status: 'pending',
        },
      ];

      expect(() => orchestrator.createExecutionPlan(steps, {})).toThrow(
        'invalid dependency'
      );
    });

    it('should detect circular dependencies', () => {
      const steps: WorkflowStep[] = [
        {
          id: 'step1',
          type: 'custom',
          description: 'First step',
          parameters: {},
          dependencies: ['step2'],
          status: 'pending',
        },
        {
          id: 'step2',
          type: 'custom',
          description: 'Second step',
          parameters: {},
          dependencies: ['step1'],
          status: 'pending',
        },
      ];

      expect(() => orchestrator.createExecutionPlan(steps, {})).toThrow(
        'Circular dependency'
      );
    });
  });

  describe('execute', () => {
    it('should execute steps in dependency order', async () => {
      const executionOrder: string[] = [];

      const steps: WorkflowStep[] = [
        {
          id: 'step1',
          type: 'custom',
          description: 'First step',
          parameters: {
            execute: async () => {
              executionOrder.push('step1');
              return 'result1';
            },
          },
          dependencies: [],
          status: 'pending',
        },
        {
          id: 'step2',
          type: 'custom',
          description: 'Second step',
          parameters: {
            execute: async () => {
              executionOrder.push('step2');
              return 'result2';
            },
          },
          dependencies: ['step1'],
          status: 'pending',
        },
      ];

      const plan = orchestrator.createExecutionPlan(steps, {});
      const result = await orchestrator.execute(plan);

      expect(result.success).toBe(true);
      expect(result.completedSteps).toBe(2);
      expect(executionOrder).toEqual(['step1', 'step2']);
    });

    it('should stream progress events', async () => {
      const progressEvents: ProgressEvent[] = [];

      const steps: WorkflowStep[] = [
        {
          id: 'step1',
          type: 'custom',
          description: 'Test step',
          parameters: {
            execute: async () => 'result',
          },
          dependencies: [],
          status: 'pending',
        },
      ];

      const plan = orchestrator.createExecutionPlan(steps, {});
      await orchestrator.execute(plan, (event) => {
        progressEvents.push(event);
      });

      // Should have step_start, step_complete, and workflow_complete events
      expect(progressEvents.some((e) => e.type === 'step_start')).toBe(true);
      expect(progressEvents.some((e) => e.type === 'step_complete')).toBe(true);
      expect(progressEvents.some((e) => e.type === 'workflow_complete')).toBe(true);
    });

    it('should handle step failures gracefully', async () => {
      const steps: WorkflowStep[] = [
        {
          id: 'step1',
          type: 'custom',
          description: 'Failing step',
          parameters: {
            execute: async () => {
              throw new Error('Step failed');
            },
          },
          dependencies: [],
          status: 'pending',
        },
        {
          id: 'step2',
          type: 'custom',
          description: 'Independent step',
          parameters: {
            execute: async () => 'result2',
          },
          dependencies: [],
          status: 'pending',
        },
      ];

      const plan = orchestrator.createExecutionPlan(steps, {});
      const result = await orchestrator.execute(plan);

      // Should complete step2 even though step1 failed
      expect(result.completedSteps).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error.message).toBe('Step failed');
    });

    it('should abort workflow if critical step fails', async () => {
      const steps: WorkflowStep[] = [
        {
          id: 'step1',
          type: 'custom',
          description: 'Critical step',
          parameters: {
            execute: async () => {
              throw new Error('Critical failure');
            },
          },
          dependencies: [],
          status: 'pending',
        },
        {
          id: 'step2',
          type: 'custom',
          description: 'Dependent step',
          parameters: {
            execute: async () => 'result2',
          },
          dependencies: ['step1'],
          status: 'pending',
        },
      ];

      const plan = orchestrator.createExecutionPlan(steps, {});
      const result = await orchestrator.execute(plan);

      // Should not execute step2 since step1 (its dependency) failed
      expect(result.success).toBe(false);
      expect(result.completedSteps).toBe(0);
    });

    it('should generate insights from workflow results', async () => {
      // Register executors for both execute_query and generate_report
      orchestrator.registerExecutor('execute_query', async (step) => {
        const execute = step.parameters.execute as (() => Promise<unknown>) | undefined;
        if (execute) {
          return execute();
        }
        return [];
      });

      orchestrator.registerExecutor('generate_report', async () => {
        return { success: true, reportHTML: '<div>Report</div>' };
      });

      const steps: WorkflowStep[] = [
        {
          id: 'step1',
          type: 'execute_query',
          description: 'Query data',
          parameters: {
            execute: async () => [{ id: 1 }, { id: 2 }],
          },
          dependencies: [],
          status: 'pending',
        },
      ];

      const plan = orchestrator.createExecutionPlan(steps, {});
      const result = await orchestrator.execute(plan);

      expect(result.insights.length).toBeGreaterThan(0);
      // Check for workflow completion insight (uses "Successfully completed" or "Completed")
      expect(result.insights.some((i) => i.toLowerCase().includes('complete'))).toBe(true);
    });

    it('should pass previous results to dependent steps', async () => {
      let receivedPreviousResults: Map<string, unknown> | null = null;

      const steps: WorkflowStep[] = [
        {
          id: 'step1',
          type: 'custom',
          description: 'First step',
          parameters: {
            execute: async () => 'result1',
          },
          dependencies: [],
          status: 'pending',
        },
        {
          id: 'step2',
          type: 'custom',
          description: 'Second step',
          parameters: {
            execute: async (_context: WorkflowContext, previousResults: Map<string, unknown>) => {
              receivedPreviousResults = previousResults;
              return 'result2';
            },
          },
          dependencies: ['step1'],
          status: 'pending',
        },
      ];

      const plan = orchestrator.createExecutionPlan(steps, {});
      await orchestrator.execute(plan);

      expect(receivedPreviousResults).not.toBeNull();
      expect(receivedPreviousResults?.get('step1')).toBe('result1');
    });
  });

  describe('registerExecutor', () => {
    it('should allow registering custom executors', async () => {
      let customExecutorCalled = false;

      orchestrator.registerExecutor('custom', async () => {
        customExecutorCalled = true;
        return 'custom result';
      });

      const steps: WorkflowStep[] = [
        {
          id: 'step1',
          type: 'custom',
          description: 'Custom step',
          parameters: {},
          dependencies: [],
          status: 'pending',
        },
      ];

      const plan = orchestrator.createExecutionPlan(steps, {});
      await orchestrator.execute(plan);

      expect(customExecutorCalled).toBe(true);
    });
  });

  describe('cancelWorkflow', () => {
    it('should cancel an active workflow', () => {
      const steps: WorkflowStep[] = [
        {
          id: 'step1',
          type: 'custom',
          description: 'Test step',
          parameters: {},
          dependencies: [],
          status: 'pending',
        },
      ];

      const plan = orchestrator.createExecutionPlan(steps, {});
      const cancelled = orchestrator.cancelWorkflow(plan.id);

      expect(cancelled).toBe(true);
      expect(orchestrator.getActivePlan(plan.id)).toBeUndefined();
    });

    it('should return false for non-existent plan', () => {
      const cancelled = orchestrator.cancelWorkflow('nonexistent');
      expect(cancelled).toBe(false);
    });
  });

  describe('getActivePlan', () => {
    it('should retrieve an active plan', () => {
      const steps: WorkflowStep[] = [
        {
          id: 'step1',
          type: 'custom',
          description: 'Test step',
          parameters: {},
          dependencies: [],
          status: 'pending',
        },
      ];

      const plan = orchestrator.createExecutionPlan(steps, {});
      const retrieved = orchestrator.getActivePlan(plan.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(plan.id);
    });

    it('should return undefined for non-existent plan', () => {
      const retrieved = orchestrator.getActivePlan('nonexistent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('automatic report generation', () => {
    it('should automatically inject report generation step after execute_query step', () => {
      const steps: WorkflowStep[] = [
        {
          id: 'query1',
          type: 'execute_query',
          description: 'Execute SQL query',
          parameters: {},
          dependencies: [],
          status: 'pending',
        },
      ];

      const plan = orchestrator.createExecutionPlan(steps, {});

      // Should have 2 steps: original query + auto-generated report
      expect(plan.steps).toHaveLength(2);
      expect(plan.steps[0].type).toBe('execute_query');
      expect(plan.steps[1].type).toBe('generate_report');
      expect(plan.steps[1].id).toBe('query1_report');
      expect(plan.steps[1].dependencies).toContain('query1');
    });

    it('should inject report generation steps for multiple query steps', () => {
      const steps: WorkflowStep[] = [
        {
          id: 'query1',
          type: 'execute_query',
          description: 'First query',
          parameters: {},
          dependencies: [],
          status: 'pending',
        },
        {
          id: 'query2',
          type: 'execute_query',
          description: 'Second query',
          parameters: {},
          dependencies: [],
          status: 'pending',
        },
      ];

      const plan = orchestrator.createExecutionPlan(steps, {});

      // Should have 4 steps: 2 queries + 2 reports
      expect(plan.steps).toHaveLength(4);
      
      // Find report steps
      const reportSteps = plan.steps.filter(s => s.type === 'generate_report');
      expect(reportSteps).toHaveLength(2);
      expect(reportSteps[0].dependencies).toContain('query1');
      expect(reportSteps[1].dependencies).toContain('query2');
    });

    it('should not inject report steps for non-query steps', () => {
      const steps: WorkflowStep[] = [
        {
          id: 'step1',
          type: 'discover_schema',
          description: 'Discover schema',
          parameters: {},
          dependencies: [],
          status: 'pending',
        },
        {
          id: 'step2',
          type: 'visualize',
          description: 'Visualize data',
          parameters: {},
          dependencies: [],
          status: 'pending',
        },
      ];

      const plan = orchestrator.createExecutionPlan(steps, {});

      // Should have only the original 2 steps
      expect(plan.steps).toHaveLength(2);
      expect(plan.steps.every(s => s.type !== 'generate_report')).toBe(true);
    });

    it('should properly order report steps with dependencies', () => {
      const steps: WorkflowStep[] = [
        {
          id: 'query1',
          type: 'execute_query',
          description: 'First query',
          parameters: {},
          dependencies: [],
          status: 'pending',
        },
        {
          id: 'analyze1',
          type: 'analyze',
          description: 'Analyze results',
          parameters: {},
          dependencies: ['query1'],
          status: 'pending',
        },
      ];

      const plan = orchestrator.createExecutionPlan(steps, {});

      // Should have 3 steps: query1, query1_report, analyze1
      expect(plan.steps).toHaveLength(3);
      
      // Find the positions
      const query1Index = plan.steps.findIndex(s => s.id === 'query1');
      const reportIndex = plan.steps.findIndex(s => s.id === 'query1_report');
      const analyzeIndex = plan.steps.findIndex(s => s.id === 'analyze1');
      
      // query1 should come first
      expect(query1Index).toBe(0);
      // report should come after query1 but before or after analyze1 (both depend on query1)
      expect(reportIndex).toBeGreaterThan(query1Index);
      expect(analyzeIndex).toBeGreaterThan(query1Index);
    });

    it('should execute report generation step when executor is registered', async () => {
      let reportExecutorCalled = false;
      let receivedQueryStepId = '';

      // Register a mock report executor
      orchestrator.registerExecutor('generate_report', async (step) => {
        reportExecutorCalled = true;
        receivedQueryStepId = step.parameters.queryStepId as string;
        return { success: true, reportHTML: '<div>Report</div>' };
      });

      const steps: WorkflowStep[] = [
        {
          id: 'query1',
          type: 'execute_query',
          description: 'Execute query',
          parameters: {
            execute: async () => [{ id: 1, name: 'Test' }],
          },
          dependencies: [],
          status: 'pending',
        },
      ];

      const plan = orchestrator.createExecutionPlan(steps, {});
      
      // Override the execute_query executor to return data
      orchestrator.registerExecutor('execute_query', async () => {
        return [{ id: 1, name: 'Test' }];
      });

      const result = await orchestrator.execute(plan);

      expect(result.success).toBe(true);
      expect(reportExecutorCalled).toBe(true);
      expect(receivedQueryStepId).toBe('query1');
      expect(result.completedSteps).toBe(2); // query + report
    });

    it('should generate insights for successful report generation', async () => {
      orchestrator.registerExecutor('generate_report', async () => {
        return { success: true, reportHTML: '<div>Report</div>' };
      });

      orchestrator.registerExecutor('execute_query', async () => {
        return [{ id: 1 }];
      });

      const steps: WorkflowStep[] = [
        {
          id: 'query1',
          type: 'execute_query',
          description: 'Execute query',
          parameters: {},
          dependencies: [],
          status: 'pending',
        },
      ];

      const plan = orchestrator.createExecutionPlan(steps, {});
      const result = await orchestrator.execute(plan);

      // Should have insight about successful report generation
      expect(result.insights.some(i => i.includes('Visual report generated successfully'))).toBe(true);
    });

    it('should handle report generation failure gracefully', async () => {
      orchestrator.registerExecutor('generate_report', async () => {
        return { success: false, error: new Error('Report generation failed') };
      });

      orchestrator.registerExecutor('execute_query', async () => {
        return [{ id: 1 }];
      });

      const steps: WorkflowStep[] = [
        {
          id: 'query1',
          type: 'execute_query',
          description: 'Execute query',
          parameters: {},
          dependencies: [],
          status: 'pending',
        },
      ];

      const plan = orchestrator.createExecutionPlan(steps, {});
      const result = await orchestrator.execute(plan);

      // Workflow should still succeed even if report generation fails
      expect(result.completedSteps).toBe(2);
      // Should have insight about report generation failure
      expect(result.insights.some(i => i.includes('Report generation failed'))).toBe(true);
    });
  });
});
