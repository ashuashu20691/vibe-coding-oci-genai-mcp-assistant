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
});
