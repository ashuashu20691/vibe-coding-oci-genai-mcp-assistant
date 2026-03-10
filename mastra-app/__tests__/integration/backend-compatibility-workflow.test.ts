/**
 * Integration test for backend compatibility - Workflow orchestrator
 * 
 * Validates that the new AI Elements frontend is fully compatible with
 * the existing workflow orchestrator for message routing, multi-agent
 * coordination, and response streaming.
 * 
 * Task 13.2: Verify workflow orchestrator compatibility
 * Validates: Requirement 7.6
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  workflowOrchestrator,
  type WorkflowStep,
  type WorkflowContext,
  type ProgressEvent,
} from '../../src/services/workflow-orchestrator';

describe('Backend Compatibility - Workflow Orchestrator', () => {
  beforeEach(() => {
    // Reset any active workflows
    const activePlans = (workflowOrchestrator as any).activePlans;
    if (activePlans) {
      activePlans.clear();
    }
  });

  describe('Message routing to agents', () => {
    it('should route database queries to database agent', async () => {
      const steps: WorkflowStep[] = [
        {
          id: 'connect',
          type: 'connect_database',
          description: 'Connect to database',
          parameters: { connection: 'LiveLab' },
          dependencies: [],
          status: 'pending',
        },
        {
          id: 'query',
          type: 'execute_query',
          description: 'Execute SQL query',
          parameters: { sql: 'SELECT * FROM users' },
          dependencies: ['connect'],
          status: 'pending',
        },
      ];

      const context: WorkflowContext = {
        database: 'LiveLab',
        conversationId: 'test-conv-1',
      };

      const plan = workflowOrchestrator.createExecutionPlan(steps, context);

      expect(plan).toBeDefined();
      expect(plan.steps.length).toBeGreaterThanOrEqual(2);
      expect(plan.context.database).toBe('LiveLab');
      
      // Find the original steps (may have report steps injected)
      const connectStep = plan.steps.find(s => s.id === 'connect');
      const queryStep = plan.steps.find(s => s.id === 'query');
      
      expect(connectStep).toBeDefined();
      expect(connectStep?.type).toBe('connect_database');
      expect(queryStep).toBeDefined();
      expect(queryStep?.type).toBe('execute_query');
    });

    it('should route analysis requests to analysis agent', async () => {
      const steps: WorkflowStep[] = [
        {
          id: 'analyze',
          type: 'analyze',
          description: 'Analyze data patterns',
          parameters: {
            data: [{ sales: 100 }, { sales: 150 }],
            analysisType: 'trend',
          },
          dependencies: [],
          status: 'pending',
        },
      ];

      const context: WorkflowContext = {
        conversationId: 'test-conv-2',
      };

      const plan = workflowOrchestrator.createExecutionPlan(steps, context);

      expect(plan).toBeDefined();
      expect(plan.steps[0].type).toBe('analyze');
      expect(plan.steps[0].parameters.analysisType).toBe('trend');
    });

    it('should route visualization requests to visualization agent', async () => {
      const steps: WorkflowStep[] = [
        {
          id: 'visualize',
          type: 'visualize',
          description: 'Create bar chart',
          parameters: {
            data: [{ month: 'Jan', sales: 100 }],
            chartType: 'bar',
          },
          dependencies: [],
          status: 'pending',
        },
      ];

      const context: WorkflowContext = {
        conversationId: 'test-conv-3',
      };

      const plan = workflowOrchestrator.createExecutionPlan(steps, context);

      expect(plan).toBeDefined();
      expect(plan.steps[0].type).toBe('visualize');
    });
  });

  describe('Multi-agent coordination', () => {
    it('should coordinate multiple agents with dependencies', async () => {
      const steps: WorkflowStep[] = [
        {
          id: 'discover',
          type: 'discover_schema',
          description: 'Discover database schema',
          parameters: {},
          dependencies: [],
          status: 'pending',
        },
        {
          id: 'query',
          type: 'execute_query',
          description: 'Query data',
          parameters: { sql: 'SELECT * FROM sales' },
          dependencies: ['discover'],
          status: 'pending',
        },
        {
          id: 'analyze',
          type: 'analyze',
          description: 'Analyze results',
          parameters: { analysisType: 'statistical' },
          dependencies: ['query'],
          status: 'pending',
        },
        {
          id: 'visualize',
          type: 'visualize',
          description: 'Create visualization',
          parameters: { chartType: 'line' },
          dependencies: ['analyze'],
          status: 'pending',
        },
      ];

      const context: WorkflowContext = {
        database: 'LiveLab',
        conversationId: 'test-conv-4',
      };

      const plan = workflowOrchestrator.createExecutionPlan(steps, context);

      expect(plan).toBeDefined();
      expect(plan.steps.length).toBeGreaterThanOrEqual(4);

      // Verify dependency order is preserved (find original steps)
      const discoverStep = plan.steps.find(s => s.id === 'discover');
      const queryStep = plan.steps.find(s => s.id === 'query');
      const analyzeStep = plan.steps.find(s => s.id === 'analyze');
      const visualizeStep = plan.steps.find(s => s.id === 'visualize');
      
      expect(discoverStep).toBeDefined();
      expect(queryStep).toBeDefined();
      expect(analyzeStep).toBeDefined();
      expect(visualizeStep).toBeDefined();
      
      // Verify order by finding indices
      const stepIds = plan.steps.map(s => s.id);
      expect(stepIds.indexOf('discover')).toBeLessThan(stepIds.indexOf('query'));
      expect(stepIds.indexOf('query')).toBeLessThan(stepIds.indexOf('analyze'));
      expect(stepIds.indexOf('analyze')).toBeLessThan(stepIds.indexOf('visualize'));
    });

    it('should handle parallel agent execution (no dependencies)', async () => {
      const steps: WorkflowStep[] = [
        {
          id: 'query1',
          type: 'execute_query',
          description: 'Query users',
          parameters: { sql: 'SELECT * FROM users' },
          dependencies: [],
          status: 'pending',
        },
        {
          id: 'query2',
          type: 'execute_query',
          description: 'Query orders',
          parameters: { sql: 'SELECT * FROM orders' },
          dependencies: [],
          status: 'pending',
        },
        {
          id: 'query3',
          type: 'execute_query',
          description: 'Query products',
          parameters: { sql: 'SELECT * FROM products' },
          dependencies: [],
          status: 'pending',
        },
      ];

      const context: WorkflowContext = {
        database: 'LiveLab',
        conversationId: 'test-conv-5',
      };

      const plan = workflowOrchestrator.createExecutionPlan(steps, context);

      expect(plan).toBeDefined();
      expect(plan.steps.length).toBeGreaterThanOrEqual(3);

      // Find original steps (report steps may be injected)
      const originalSteps = plan.steps.filter(s => 
        s.id === 'query1' || s.id === 'query2' || s.id === 'query3'
      );
      
      expect(originalSteps).toHaveLength(3);

      // All original steps should have no dependencies
      originalSteps.forEach(step => {
        expect(step.dependencies).toHaveLength(0);
      });
    });

    it('should handle complex dependency graph', async () => {
      const steps: WorkflowStep[] = [
        {
          id: 'step1',
          type: 'custom',
          description: 'Step 1',
          parameters: {},
          dependencies: [],
          status: 'pending',
        },
        {
          id: 'step2',
          type: 'custom',
          description: 'Step 2',
          parameters: {},
          dependencies: ['step1'],
          status: 'pending',
        },
        {
          id: 'step3',
          type: 'custom',
          description: 'Step 3',
          parameters: {},
          dependencies: ['step1'],
          status: 'pending',
        },
        {
          id: 'step4',
          type: 'custom',
          description: 'Step 4',
          parameters: {},
          dependencies: ['step2', 'step3'],
          status: 'pending',
        },
      ];

      const context: WorkflowContext = {
        conversationId: 'test-conv-6',
      };

      const plan = workflowOrchestrator.createExecutionPlan(steps, context);

      expect(plan).toBeDefined();
      expect(plan.steps).toHaveLength(4);

      // Verify step4 comes after step2 and step3
      const stepIds = plan.steps.map(s => s.id);
      const step4Index = stepIds.indexOf('step4');
      const step2Index = stepIds.indexOf('step2');
      const step3Index = stepIds.indexOf('step3');

      expect(step4Index).toBeGreaterThan(step2Index);
      expect(step4Index).toBeGreaterThan(step3Index);
    });
  });

  describe('Response streaming', () => {
    it('should stream progress events during workflow execution', async () => {
      const progressEvents: ProgressEvent[] = [];

      const steps: WorkflowStep[] = [
        {
          id: 'step1',
          type: 'custom',
          description: 'First step',
          parameters: {
            execute: async () => {
              return { result: 'step1 complete' };
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
              return { result: 'step2 complete' };
            },
          },
          dependencies: ['step1'],
          status: 'pending',
        },
      ];

      const context: WorkflowContext = {
        conversationId: 'test-conv-7',
      };

      const plan = workflowOrchestrator.createExecutionPlan(steps, context);

      const result = await workflowOrchestrator.execute(plan, (event) => {
        progressEvents.push(event);
      });

      expect(result.success).toBe(true);
      expect(progressEvents.length).toBeGreaterThan(0);

      // Verify we got step_start events
      const startEvents = progressEvents.filter(e => e.type === 'step_start');
      expect(startEvents.length).toBe(2);

      // Verify we got step_complete events
      const completeEvents = progressEvents.filter(e => e.type === 'step_complete');
      expect(completeEvents.length).toBe(2);

      // Verify we got workflow_complete event
      const workflowCompleteEvents = progressEvents.filter(e => e.type === 'workflow_complete');
      expect(workflowCompleteEvents.length).toBe(1);
    });

    it('should stream step progress in correct order', async () => {
      const progressEvents: ProgressEvent[] = [];

      const steps: WorkflowStep[] = [
        {
          id: 'step1',
          type: 'custom',
          description: 'Step 1',
          parameters: {
            execute: async () => ({ result: 'done' }),
          },
          dependencies: [],
          status: 'pending',
        },
        {
          id: 'step2',
          type: 'custom',
          description: 'Step 2',
          parameters: {
            execute: async () => ({ result: 'done' }),
          },
          dependencies: ['step1'],
          status: 'pending',
        },
        {
          id: 'step3',
          type: 'custom',
          description: 'Step 3',
          parameters: {
            execute: async () => ({ result: 'done' }),
          },
          dependencies: ['step2'],
          status: 'pending',
        },
      ];

      const context: WorkflowContext = {
        conversationId: 'test-conv-8',
      };

      const plan = workflowOrchestrator.createExecutionPlan(steps, context);

      await workflowOrchestrator.execute(plan, (event) => {
        progressEvents.push(event);
      });

      // Extract step IDs from events
      const stepStartEvents = progressEvents.filter(e => e.type === 'step_start');
      const stepIds = stepStartEvents.map(e => e.stepId);

      // Verify order
      expect(stepIds).toEqual(['step1', 'step2', 'step3']);
    });

    it('should stream error events when step fails', async () => {
      const progressEvents: ProgressEvent[] = [];

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
      ];

      const context: WorkflowContext = {
        conversationId: 'test-conv-9',
      };

      const plan = workflowOrchestrator.createExecutionPlan(steps, context);

      const result = await workflowOrchestrator.execute(plan, (event) => {
        progressEvents.push(event);
      });

      expect(result.success).toBe(false);

      // Verify we got step_error event
      const errorEvents = progressEvents.filter(e => e.type === 'step_error');
      expect(errorEvents.length).toBeGreaterThan(0);
      expect(errorEvents[0].error).toBeDefined();
      expect(errorEvents[0].error?.message).toContain('Step failed');
    });

    it('should stream insights during workflow execution', async () => {
      const progressEvents: ProgressEvent[] = [];

      const steps: WorkflowStep[] = [
        {
          id: 'query',
          type: 'custom',
          description: 'Query data',
          parameters: {
            execute: async () => {
              // Return data that will generate insights
              return [
                { id: 1, sales: 100 },
                { id: 2, sales: 200 },
              ];
            },
          },
          dependencies: [],
          status: 'pending',
        },
      ];

      const context: WorkflowContext = {
        conversationId: 'test-conv-10',
      };

      const plan = workflowOrchestrator.createExecutionPlan(steps, context);

      const result = await workflowOrchestrator.execute(plan, (event) => {
        progressEvents.push(event);
      });

      expect(result.success).toBe(true);
      // Workflow always generates at least completion insights
      expect(result.insights.length).toBeGreaterThan(0);

      // Verify workflow_complete event includes insights
      const completeEvent = progressEvents.find(e => e.type === 'workflow_complete');
      expect(completeEvent).toBeDefined();
      expect(completeEvent?.insights).toBeDefined();
    });
  });

  describe('Database context management', () => {
    it('should pass selected database to workflow context', async () => {
      const steps: WorkflowStep[] = [
        {
          id: 'query',
          type: 'execute_query',
          description: 'Query with database context',
          parameters: { sql: 'SELECT 1' },
          dependencies: [],
          status: 'pending',
        },
      ];

      const context: WorkflowContext = {
        database: 'LiveLab',
        conversationId: 'test-conv-11',
      };

      const plan = workflowOrchestrator.createExecutionPlan(steps, context);

      expect(plan.context.database).toBe('LiveLab');
    });

    it('should maintain database context across multiple steps', async () => {
      const steps: WorkflowStep[] = [
        {
          id: 'connect',
          type: 'connect_database',
          description: 'Connect',
          parameters: {},
          dependencies: [],
          status: 'pending',
        },
        {
          id: 'query1',
          type: 'execute_query',
          description: 'Query 1',
          parameters: {},
          dependencies: ['connect'],
          status: 'pending',
        },
        {
          id: 'query2',
          type: 'execute_query',
          description: 'Query 2',
          parameters: {},
          dependencies: ['query1'],
          status: 'pending',
        },
      ];

      const context: WorkflowContext = {
        database: 'BASE_DB_23AI',
        conversationId: 'test-conv-12',
      };

      const plan = workflowOrchestrator.createExecutionPlan(steps, context);

      // All steps should have access to the same database context
      expect(plan.context.database).toBe('BASE_DB_23AI');
    });
  });

  describe('Dynamic task injection', () => {
    it('should support adding steps during execution', async () => {
      const steps: WorkflowStep[] = [
        {
          id: 'step1',
          type: 'custom',
          description: 'Initial step',
          parameters: {
            execute: async () => {
              // Return suggested next steps
              return {
                result: 'done',
                suggestedSteps: [
                  {
                    id: 'dynamic-step',
                    type: 'custom' as const,
                    description: 'Dynamically added step',
                    parameters: {
                      execute: async () => ({ result: 'dynamic done' }),
                    },
                    dependencies: ['step1'],
                    status: 'pending' as const,
                  },
                ],
              };
            },
          },
          dependencies: [],
          status: 'pending',
        },
      ];

      const context: WorkflowContext = {
        conversationId: 'test-conv-13',
      };

      const plan = workflowOrchestrator.createExecutionPlan(steps, context);

      const result = await workflowOrchestrator.execute(plan);

      expect(result.success).toBe(true);
      // Should have executed both the initial step and the dynamically added step
      expect(result.completedSteps).toBe(2);
    });
  });
});
