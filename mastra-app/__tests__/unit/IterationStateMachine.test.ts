// __tests__/unit/IterationStateMachine.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  IterationStateMachine,
  type RetryOptions,
  type AlternativeStrategy,
  type ToolCallRecord,
} from '../../src/services/iteration-state-machine';

describe('IterationStateMachine', () => {
  let stateMachine: IterationStateMachine;

  beforeEach(() => {
    stateMachine = new IterationStateMachine();
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt with valid result', async () => {
      const operation = vi.fn().mockResolvedValue({ data: 'success' });

      const result = await stateMachine.executeWithRetry(operation);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ data: 'success' });
      expect(result.attempts).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed on second attempt', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce({ data: 'success' });

      const onAttempt = vi.fn();
      const result = await stateMachine.executeWithRetry(operation, { onAttempt });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ data: 'success' });
      expect(result.attempts).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(operation).toHaveBeenCalledTimes(2);
      expect(onAttempt).toHaveBeenCalledTimes(2);
    });

    it('should stop after max attempts (default 5)', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Always fails'));

      const result = await stateMachine.executeWithRetry(operation);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(5);
      expect(result.errors).toHaveLength(5);
      expect(operation).toHaveBeenCalledTimes(5);
    });

    it('should respect custom maxAttempts', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Always fails'));

      const result = await stateMachine.executeWithRetry(operation, { maxAttempts: 3 });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3);
      expect(result.errors).toHaveLength(3);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should treat empty array as failure and retry', async () => {
      const operation = vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ data: 'success' }]);

      const result = await stateMachine.executeWithRetry(operation);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
      expect(result.data).toEqual([{ data: 'success' }]);
    });

    it('should treat null as failure and retry', async () => {
      const operation = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ data: 'success' });

      const result = await stateMachine.executeWithRetry(operation);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });

    it('should treat undefined as failure and retry', async () => {
      const operation = vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ data: 'success' });

      const result = await stateMachine.executeWithRetry(operation);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });

    it('should treat empty object as failure and retry', async () => {
      const operation = vi
        .fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ data: 'success' });

      const result = await stateMachine.executeWithRetry(operation);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });

    it('should use alternative strategy on failure', async () => {
      const firstOperation = vi.fn().mockRejectedValue(new Error('First strategy failed'));
      const secondOperation = vi.fn().mockResolvedValue({ data: 'success' });

      const onFailure = vi.fn().mockReturnValue({
        description: 'Try alternative approach',
        operation: secondOperation,
      } as AlternativeStrategy);

      const result = await stateMachine.executeWithRetry(firstOperation, { onFailure });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
      expect(onFailure).toHaveBeenCalledTimes(1);
      expect(secondOperation).toHaveBeenCalledTimes(1);
      expect(result.finalStrategy).toBe('Try alternative approach');
    });

    it('should respect shouldRetry callback', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Non-retryable error'));
      const shouldRetry = vi.fn().mockReturnValue(false);

      const result = await stateMachine.executeWithRetry(operation, { shouldRetry });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(shouldRetry).toHaveBeenCalledTimes(1);
    });

    it('should collect partial data from all attempts', async () => {
      const operation = vi
        .fn()
        .mockResolvedValueOnce([]) // Empty array - failure, but no data to collect
        .mockResolvedValueOnce({}) // Empty object - failure, but no data to collect
        .mockResolvedValueOnce([{ complete: 'data' }]); // Success

      const result = await stateMachine.executeWithRetry(operation);

      expect(result.success).toBe(true);
      // Only the successful attempt has data
      expect(result.partialData).toHaveLength(1);
      expect(result.partialData[0]).toEqual([{ complete: 'data' }]);
    });

    it('should generate attempt summaries', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce({}) // Empty object - failure
        .mockResolvedValueOnce({ data: 'success' });

      const result = await stateMachine.executeWithRetry(operation);

      expect(result.attemptSummaries).toHaveLength(3);
      expect(result.attemptSummaries[0]).toContain('Error - First error');
      expect(result.attemptSummaries[1]).toContain('Empty/invalid result');
      expect(result.attemptSummaries[2]).toContain('Success');
    });

    it('should return partial data when max iterations reached', async () => {
      const operation = vi
        .fn()
        .mockResolvedValueOnce({}) // Empty - failure
        .mockResolvedValueOnce({}) // Empty - failure
        .mockResolvedValueOnce({}) // Empty - failure
        .mockResolvedValueOnce({}) // Empty - failure
        .mockResolvedValueOnce({}); // Empty - failure

      const result = await stateMachine.executeWithRetry(operation);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(5);
      // No partial data since all were empty
      expect(result.partialData).toHaveLength(0);
      expect(result.attemptSummaries).toHaveLength(5);
    });
  });

  describe('getCurrentIteration', () => {
    it('should return 0 initially', () => {
      expect(stateMachine.getCurrentIteration()).toBe(0);
    });

    it('should return current iteration count during execution', async () => {
      const operation = vi.fn().mockImplementation(async () => {
        const current = stateMachine.getCurrentIteration();
        if (current < 2) {
          throw new Error('Not yet');
        }
        return { data: 'success' };
      });

      await stateMachine.executeWithRetry(operation);

      expect(stateMachine.getCurrentIteration()).toBe(2);
    });

    it('should emit iteration updates with each attempt', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('First'))
        .mockRejectedValueOnce(new Error('Second'))
        .mockResolvedValueOnce({ data: 'success' });

      const onIterationUpdate = vi.fn();

      await stateMachine.executeWithRetry(operation, { onIterationUpdate });

      expect(onIterationUpdate).toHaveBeenCalledTimes(3);
      expect(onIterationUpdate).toHaveBeenNthCalledWith(1, 1, 5);
      expect(onIterationUpdate).toHaveBeenNthCalledWith(2, 2, 5);
      expect(onIterationUpdate).toHaveBeenNthCalledWith(3, 3, 5);
    });

    it('should emit iteration updates with custom max attempts', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('First'))
        .mockResolvedValueOnce({ data: 'success' });

      const onIterationUpdate = vi.fn();

      await stateMachine.executeWithRetry(operation, {
        maxAttempts: 3,
        onIterationUpdate,
      });

      expect(onIterationUpdate).toHaveBeenCalledTimes(2);
      expect(onIterationUpdate).toHaveBeenNthCalledWith(1, 1, 3);
      expect(onIterationUpdate).toHaveBeenNthCalledWith(2, 2, 3);
    });

    it('should emit iteration updates before onAttempt callback', async () => {
      const operation = vi.fn().mockResolvedValue({ data: 'success' });
      const callOrder: string[] = [];

      const onIterationUpdate = vi.fn(() => callOrder.push('iteration'));
      const onAttempt = vi.fn(() => callOrder.push('attempt'));

      await stateMachine.executeWithRetry(operation, {
        onIterationUpdate,
        onAttempt,
      });

      expect(callOrder).toEqual(['iteration', 'attempt']);
    });
  });

  describe('getMaxIterations', () => {
    it('should return default max iterations (5)', () => {
      expect(stateMachine.getMaxIterations()).toBe(5);
    });

    it('should return custom max iterations after executeWithRetry', async () => {
      const operation = vi.fn().mockResolvedValue({ data: 'success' });

      await stateMachine.executeWithRetry(operation, { maxAttempts: 3 });

      expect(stateMachine.getMaxIterations()).toBe(3);
    });
  });

  describe('shouldContinue', () => {
    it('should return true when under max iterations', async () => {
      const operation = vi.fn().mockImplementation(async () => {
        if (stateMachine.getCurrentIteration() === 1) {
          expect(stateMachine.shouldContinue()).toBe(true);
        }
        throw new Error('Continue');
      });

      await stateMachine.executeWithRetry(operation, { maxAttempts: 3 });
    });

    it('should return false when at max iterations', async () => {
      const operation = vi.fn().mockImplementation(async () => {
        if (stateMachine.getCurrentIteration() === 3) {
          expect(stateMachine.shouldContinue()).toBe(false);
        }
        throw new Error('Continue');
      });

      await stateMachine.executeWithRetry(operation, { maxAttempts: 3 });
    });
  });

  describe('recordAttempt and getAttemptHistory', () => {
    it('should record attempts during execution', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('First'))
        .mockResolvedValueOnce({ data: 'success' });

      await stateMachine.executeWithRetry(operation);

      const history = stateMachine.getAttemptHistory();
      expect(history).toHaveLength(2);
      expect(history[0].attemptNumber).toBe(1);
      expect(history[0].success).toBe(false);
      expect(history[0].error?.message).toBe('First');
      expect(history[1].attemptNumber).toBe(2);
      expect(history[1].success).toBe(true);
    });

    it('should include timestamps and durations in attempt records', async () => {
      const operation = vi.fn().mockResolvedValue({ data: 'success' });

      await stateMachine.executeWithRetry(operation);

      const history = stateMachine.getAttemptHistory();
      expect(history[0].timestamp).toBeInstanceOf(Date);
      expect(history[0].duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getPartialData', () => {
    it('should return empty array initially', () => {
      expect(stateMachine.getPartialData()).toEqual([]);
    });

    it('should return partial data collected during execution', async () => {
      const operation = vi
        .fn()
        .mockResolvedValueOnce({}) // Empty - failure, no data
        .mockResolvedValueOnce([]) // Empty - failure, no data
        .mockResolvedValueOnce([{ complete: true }]); // Success

      await stateMachine.executeWithRetry(operation);

      const partialData = stateMachine.getPartialData();
      expect(partialData).toHaveLength(1);
      expect(partialData[0]).toEqual([{ complete: true }]);
    });
  });

  describe('reset', () => {
    it('should reset state after execution', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('First'))
        .mockResolvedValueOnce({ data: 'success' });

      await stateMachine.executeWithRetry(operation);

      expect(stateMachine.getCurrentIteration()).toBe(2);
      expect(stateMachine.getAttemptHistory()).toHaveLength(2);

      stateMachine.reset();

      expect(stateMachine.getCurrentIteration()).toBe(0);
      expect(stateMachine.getAttemptHistory()).toHaveLength(0);
      expect(stateMachine.getPartialData()).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle string results as success', async () => {
      const operation = vi.fn().mockResolvedValue('success string');

      const result = await stateMachine.executeWithRetry(operation);

      expect(result.success).toBe(true);
      expect(result.data).toBe('success string');
    });

    it('should handle number results as success', async () => {
      const operation = vi.fn().mockResolvedValue(42);

      const result = await stateMachine.executeWithRetry(operation);

      expect(result.success).toBe(true);
      expect(result.data).toBe(42);
    });

    it('should handle boolean true as success', async () => {
      const operation = vi.fn().mockResolvedValue(true);

      const result = await stateMachine.executeWithRetry(operation);

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it('should handle boolean false as success', async () => {
      const operation = vi.fn().mockResolvedValue(false);

      const result = await stateMachine.executeWithRetry(operation);

      expect(result.success).toBe(true);
      expect(result.data).toBe(false);
    });

    it('should handle zero as success', async () => {
      const operation = vi.fn().mockResolvedValue(0);

      const result = await stateMachine.executeWithRetry(operation);

      expect(result.success).toBe(true);
      expect(result.data).toBe(0);
    });

    it('should handle empty string as success', async () => {
      const operation = vi.fn().mockResolvedValue('');

      const result = await stateMachine.executeWithRetry(operation);

      expect(result.success).toBe(false); // Empty string is failure
      expect(result.attempts).toBe(5); // Will retry until max attempts
    });

    it('should handle non-Error thrown values', async () => {
      const operation = vi.fn().mockRejectedValue('string error');

      const result = await stateMachine.executeWithRetry(operation, { maxAttempts: 1 });

      expect(result.success).toBe(false);
      expect(result.errors[0].message).toBe('string error');
    });

    it('should not store null/undefined in partial data', async () => {
      const operation = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ data: 'success' });

      const result = await stateMachine.executeWithRetry(operation);

      expect(result.success).toBe(true);
      expect(result.partialData).toHaveLength(1);
      expect(result.partialData[0]).toEqual({ data: 'success' });
    });
  });

  describe('discovery chain management', () => {
    describe('startDiscoveryChain', () => {
      it('should initialize a new discovery chain', () => {
        stateMachine.startDiscoveryChain('Find all customers in California');

        const chain = stateMachine.getDiscoveryChain();
        expect(chain).not.toBeNull();
        expect(chain?.goal).toBe('Find all customers in California');
        expect(chain?.steps).toHaveLength(0);
        expect(chain?.status).toBe('in_progress');
        expect(chain?.aggregatedResults).toEqual({});
      });

      it('should reset discovery chain on subsequent calls', () => {
        stateMachine.startDiscoveryChain('First goal');
        stateMachine.addDiscoveryStep('Step 1', [
          {
            toolName: 'list_tables',
            args: {},
            result: ['table1'],
            success: true,
            timestamp: new Date(),
          },
        ]);

        stateMachine.startDiscoveryChain('Second goal');

        const chain = stateMachine.getDiscoveryChain();
        expect(chain?.goal).toBe('Second goal');
        expect(chain?.steps).toHaveLength(0);
      });
    });

    describe('addDiscoveryStep', () => {
      beforeEach(() => {
        stateMachine.startDiscoveryChain('Test goal');
      });

      it('should add a step to the discovery chain', () => {
        const toolCalls = [
          {
            toolName: 'list_tables',
            args: {},
            result: ['customers', 'orders'],
            success: true,
            timestamp: new Date(),
          },
        ];

        stateMachine.addDiscoveryStep('List all tables', toolCalls, ['Found 2 tables']);

        const steps = stateMachine.getDiscoverySteps();
        expect(steps).toHaveLength(1);
        expect(steps[0].stepNumber).toBe(1);
        expect(steps[0].action).toBe('List all tables');
        expect(steps[0].toolCalls).toEqual(toolCalls);
        expect(steps[0].results).toEqual([['customers', 'orders']]);
        expect(steps[0].insights).toEqual(['Found 2 tables']);
      });

      it('should increment step numbers correctly', () => {
        stateMachine.addDiscoveryStep('Step 1', [
          {
            toolName: 'tool1',
            args: {},
            result: 'result1',
            success: true,
            timestamp: new Date(),
          },
        ]);

        stateMachine.addDiscoveryStep('Step 2', [
          {
            toolName: 'tool2',
            args: {},
            result: 'result2',
            success: true,
            timestamp: new Date(),
          },
        ]);

        const steps = stateMachine.getDiscoverySteps();
        expect(steps).toHaveLength(2);
        expect(steps[0].stepNumber).toBe(1);
        expect(steps[1].stepNumber).toBe(2);
      });

      it('should aggregate results from successful tool calls', () => {
        stateMachine.addDiscoveryStep('Step 1', [
          {
            toolName: 'list_tables',
            args: {},
            result: ['table1', 'table2'],
            success: true,
            timestamp: new Date(),
          },
        ]);

        stateMachine.addDiscoveryStep('Step 2', [
          {
            toolName: 'describe_table',
            args: { table: 'table1' },
            result: { columns: ['id', 'name'] },
            success: true,
            timestamp: new Date(),
          },
        ]);

        const aggregated = stateMachine.getAggregatedResults();
        expect(aggregated).toHaveProperty('list_tables_step1');
        expect(aggregated['list_tables_step1']).toEqual(['table1', 'table2']);
        expect(aggregated).toHaveProperty('describe_table_step2');
        expect(aggregated['describe_table_step2']).toEqual({ columns: ['id', 'name'] });
      });

      it('should not aggregate results from failed tool calls', () => {
        stateMachine.addDiscoveryStep('Step 1', [
          {
            toolName: 'query',
            args: {},
            result: null,
            success: false,
            timestamp: new Date(),
          },
        ]);

        const aggregated = stateMachine.getAggregatedResults();
        expect(Object.keys(aggregated)).toHaveLength(0);
      });

      it('should not aggregate empty results', () => {
        stateMachine.addDiscoveryStep('Step 1', [
          {
            toolName: 'query',
            args: {},
            result: [],
            success: true,
            timestamp: new Date(),
          },
        ]);

        const aggregated = stateMachine.getAggregatedResults();
        expect(Object.keys(aggregated)).toHaveLength(0);
      });

      it('should handle multiple tool calls in a single step', () => {
        const toolCalls = [
          {
            toolName: 'tool1',
            args: {},
            result: 'result1',
            success: true,
            timestamp: new Date(),
          },
          {
            toolName: 'tool2',
            args: {},
            result: 'result2',
            success: true,
            timestamp: new Date(),
          },
        ];

        stateMachine.addDiscoveryStep('Multi-tool step', toolCalls);

        const steps = stateMachine.getDiscoverySteps();
        expect(steps[0].toolCalls).toHaveLength(2);
        expect(steps[0].results).toEqual(['result1', 'result2']);

        const aggregated = stateMachine.getAggregatedResults();
        expect(aggregated['tool1_step1']).toBe('result1');
        expect(aggregated['tool2_step1']).toBe('result2');
      });

      it('should store nextAction when provided', () => {
        stateMachine.addDiscoveryStep(
          'Step 1',
          [
            {
              toolName: 'list_tables',
              args: {},
              result: ['table1'],
              success: true,
              timestamp: new Date(),
            },
          ],
          ['Found 1 table'],
          'Describe table1'
        );

        const steps = stateMachine.getDiscoverySteps();
        expect(steps[0].nextAction).toBe('Describe table1');
      });

      it('should throw error if discovery chain not initialized', () => {
        const newMachine = new IterationStateMachine();

        expect(() => {
          newMachine.addDiscoveryStep('Step 1', [
            {
              toolName: 'tool1',
              args: {},
              result: 'result',
              success: true,
              timestamp: new Date(),
            },
          ]);
        }).toThrow('Discovery chain not initialized');
      });
    });

    describe('completeDiscoveryChain', () => {
      beforeEach(() => {
        stateMachine.startDiscoveryChain('Test goal');
      });

      it('should mark discovery chain as completed', () => {
        stateMachine.completeDiscoveryChain('completed');

        const chain = stateMachine.getDiscoveryChain();
        expect(chain?.status).toBe('completed');
      });

      it('should mark discovery chain as failed', () => {
        stateMachine.completeDiscoveryChain('failed');

        const chain = stateMachine.getDiscoveryChain();
        expect(chain?.status).toBe('failed');
      });

      it('should mark discovery chain as needs_guidance', () => {
        stateMachine.completeDiscoveryChain('needs_guidance');

        const chain = stateMachine.getDiscoveryChain();
        expect(chain?.status).toBe('needs_guidance');
      });

      it('should throw error if discovery chain not initialized', () => {
        const newMachine = new IterationStateMachine();

        expect(() => {
          newMachine.completeDiscoveryChain('completed');
        }).toThrow('Discovery chain not initialized');
      });
    });

    describe('getDiscoveryChain', () => {
      it('should return null when no discovery chain exists', () => {
        expect(stateMachine.getDiscoveryChain()).toBeNull();
      });

      it('should return a copy of the discovery chain', () => {
        stateMachine.startDiscoveryChain('Test goal');
        stateMachine.addDiscoveryStep('Step 1', [
          {
            toolName: 'tool1',
            args: {},
            result: 'result',
            success: true,
            timestamp: new Date(),
          },
        ]);

        const chain1 = stateMachine.getDiscoveryChain();
        const chain2 = stateMachine.getDiscoveryChain();

        expect(chain1).not.toBe(chain2); // Different objects
        expect(chain1).toEqual(chain2); // Same content
      });
    });

    describe('getAggregatedResults', () => {
      it('should return empty object when no discovery chain exists', () => {
        expect(stateMachine.getAggregatedResults()).toEqual({});
      });

      it('should return aggregated results from all steps', () => {
        stateMachine.startDiscoveryChain('Multi-step discovery');

        stateMachine.addDiscoveryStep('Step 1', [
          {
            toolName: 'list_tables',
            args: {},
            result: ['table1', 'table2'],
            success: true,
            timestamp: new Date(),
          },
        ]);

        stateMachine.addDiscoveryStep('Step 2', [
          {
            toolName: 'describe_table',
            args: { table: 'table1' },
            result: { columns: ['id', 'name'] },
            success: true,
            timestamp: new Date(),
          },
        ]);

        stateMachine.addDiscoveryStep('Step 3', [
          {
            toolName: 'query_table',
            args: { table: 'table1' },
            result: [{ id: 1, name: 'Alice' }],
            success: true,
            timestamp: new Date(),
          },
        ]);

        const aggregated = stateMachine.getAggregatedResults();
        expect(Object.keys(aggregated)).toHaveLength(3);
        expect(aggregated['list_tables_step1']).toEqual(['table1', 'table2']);
        expect(aggregated['describe_table_step2']).toEqual({ columns: ['id', 'name'] });
        expect(aggregated['query_table_step3']).toEqual([{ id: 1, name: 'Alice' }]);
      });

      it('should return a copy of aggregated results', () => {
        stateMachine.startDiscoveryChain('Test');
        stateMachine.addDiscoveryStep('Step 1', [
          {
            toolName: 'tool1',
            args: {},
            result: 'result',
            success: true,
            timestamp: new Date(),
          },
        ]);

        const results1 = stateMachine.getAggregatedResults();
        const results2 = stateMachine.getAggregatedResults();

        expect(results1).not.toBe(results2); // Different objects
        expect(results1).toEqual(results2); // Same content
      });
    });

    describe('getDiscoverySteps', () => {
      it('should return empty array when no discovery chain exists', () => {
        expect(stateMachine.getDiscoverySteps()).toEqual([]);
      });

      it('should return all steps in order', () => {
        stateMachine.startDiscoveryChain('Test');

        stateMachine.addDiscoveryStep('First step', [
          {
            toolName: 'tool1',
            args: {},
            result: 'result1',
            success: true,
            timestamp: new Date(),
          },
        ]);

        stateMachine.addDiscoveryStep('Second step', [
          {
            toolName: 'tool2',
            args: {},
            result: 'result2',
            success: true,
            timestamp: new Date(),
          },
        ]);

        const steps = stateMachine.getDiscoverySteps();
        expect(steps).toHaveLength(2);
        expect(steps[0].action).toBe('First step');
        expect(steps[1].action).toBe('Second step');
      });

      it('should return a copy of steps array', () => {
        stateMachine.startDiscoveryChain('Test');
        stateMachine.addDiscoveryStep('Step 1', [
          {
            toolName: 'tool1',
            args: {},
            result: 'result',
            success: true,
            timestamp: new Date(),
          },
        ]);

        const steps1 = stateMachine.getDiscoverySteps();
        const steps2 = stateMachine.getDiscoverySteps();

        expect(steps1).not.toBe(steps2); // Different arrays
        expect(steps1).toEqual(steps2); // Same content
      });
    });

    describe('reset', () => {
      it('should clear discovery chain', () => {
        stateMachine.startDiscoveryChain('Test goal');
        stateMachine.addDiscoveryStep('Step 1', [
          {
            toolName: 'tool1',
            args: {},
            result: 'result',
            success: true,
            timestamp: new Date(),
          },
        ]);

        stateMachine.reset();

        expect(stateMachine.getDiscoveryChain()).toBeNull();
        expect(stateMachine.getDiscoverySteps()).toEqual([]);
        expect(stateMachine.getAggregatedResults()).toEqual({});
      });
    });

    describe('integration with multi-step discovery', () => {
      it('should track a complete discovery chain: list → describe → query → analyze', () => {
        // Simulating a real discovery flow
        stateMachine.startDiscoveryChain('Find customers in California');

        // Step 1: List tables
        stateMachine.addDiscoveryStep(
          'List all tables',
          [
            {
              toolName: 'list_tables',
              args: {},
              result: ['customers', 'orders', 'products'],
              success: true,
              timestamp: new Date(),
            },
          ],
          ['Found 3 tables'],
          'Describe customers table'
        );

        // Step 2: Describe table
        stateMachine.addDiscoveryStep(
          'Describe customers table',
          [
            {
              toolName: 'describe_table',
              args: { table: 'customers' },
              result: {
                columns: [
                  { name: 'id', type: 'NUMBER' },
                  { name: 'name', type: 'VARCHAR2' },
                  { name: 'state', type: 'VARCHAR2' },
                ],
              },
              success: true,
              timestamp: new Date(),
            },
          ],
          ['Table has state column'],
          'Query for California customers'
        );

        // Step 3: Query table
        stateMachine.addDiscoveryStep(
          'Query California customers',
          [
            {
              toolName: 'query_table',
              args: { table: 'customers', where: "state = 'CA'" },
              result: [
                { id: 1, name: 'Alice', state: 'CA' },
                { id: 2, name: 'Bob', state: 'CA' },
              ],
              success: true,
              timestamp: new Date(),
            },
          ],
          ['Found 2 customers in California'],
          'Analyze results'
        );

        // Step 4: Analyze results
        stateMachine.addDiscoveryStep(
          'Analyze customer distribution',
          [
            {
              toolName: 'analyze',
              args: { data: 'customers' },
              result: { total: 2, avgAge: 35 },
              success: true,
              timestamp: new Date(),
            },
          ],
          ['Average age is 35']
        );

        stateMachine.completeDiscoveryChain('completed');

        // Verify the complete chain
        const chain = stateMachine.getDiscoveryChain();
        expect(chain?.goal).toBe('Find customers in California');
        expect(chain?.status).toBe('completed');
        expect(chain?.steps).toHaveLength(4);

        // Verify step relationships
        expect(chain?.steps[0].nextAction).toBe('Describe customers table');
        expect(chain?.steps[1].nextAction).toBe('Query for California customers');
        expect(chain?.steps[2].nextAction).toBe('Analyze results');

        // Verify aggregated results
        const aggregated = stateMachine.getAggregatedResults();
        expect(aggregated['list_tables_step1']).toEqual(['customers', 'orders', 'products']);
        expect(aggregated['describe_table_step2']).toHaveProperty('columns');
        expect(aggregated['query_table_step3']).toHaveLength(2);
        expect(aggregated['analyze_step4']).toEqual({ total: 2, avgAge: 35 });
      });
    });
  });
});
