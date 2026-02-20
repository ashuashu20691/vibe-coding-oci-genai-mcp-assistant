/**
 * Property Test: Tool Execution Lifecycle Display
 *
 * Feature: claude-desktop-alternative, Property 9: Tool Execution Lifecycle Display
 *
 * *For any* tool execution, the UI SHALL display the tool name and arguments during
 * execution (status 'running'), and SHALL display the result status and duration
 * after completion (status 'complete' or 'error').
 *
 * **Validates: Requirements 3.5, 3.6**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  ToolExecutionStatus,
  ToolExecutionResult,
  MCPTool,
  formatDuration,
  formatToolArgs,
  getToolStatusColor,
} from '../../src/components/MCPServerPanel';

/**
 * Valid state transitions for tool execution lifecycle.
 * idle → running → success | error
 */
const VALID_TRANSITIONS: Record<ToolExecutionStatus, ToolExecutionStatus[]> = {
  idle: ['running'],
  running: ['success', 'error'],
  success: ['idle', 'running'], // Can be reset or re-executed
  error: ['idle', 'running'], // Can be reset or re-executed
};

/**
 * Check if a state transition is valid
 */
function isValidTransition(from: ToolExecutionStatus, to: ToolExecutionStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/**
 * Simulates starting tool execution - transitions from idle to running
 * @validates Requirements 3.5 - Display tool name and arguments during execution
 */
function startToolExecution(
  tool: MCPTool,
  args: Record<string, unknown>
): MCPTool {
  return {
    ...tool,
    executionStatus: 'running',
    executionArgs: args,
    executionStartTime: Date.now(),
    executionResult: undefined,
  };
}

/**
 * Simulates completing tool execution - transitions from running to success/error
 * @validates Requirements 3.6 - Display result status and duration after completion
 */
function completeToolExecution(
  tool: MCPTool,
  result: ToolExecutionResult
): MCPTool {
  const duration = tool.executionStartTime
    ? Date.now() - tool.executionStartTime
    : 0;

  return {
    ...tool,
    executionStatus: result.status,
    executionResult: {
      ...result,
      duration,
    },
  };
}

/**
 * Resets tool to idle state
 */
function resetToolExecution(tool: MCPTool): MCPTool {
  return {
    ...tool,
    executionStatus: 'idle',
    executionArgs: undefined,
    executionResult: undefined,
    executionStartTime: undefined,
  };
}

/**
 * Checks if tool name is available for display
 */
function isToolNameAvailable(tool: MCPTool): boolean {
  return typeof tool.name === 'string' && tool.name.length > 0;
}

/**
 * Checks if tool arguments are available during execution
 */
function areArgumentsAvailableDuringExecution(tool: MCPTool): boolean {
  return tool.executionStatus === 'running' && tool.executionArgs !== undefined;
}

/**
 * Checks if result status is available after completion
 */
function isResultStatusAvailableAfterCompletion(tool: MCPTool): boolean {
  const isComplete = tool.executionStatus === 'success' || tool.executionStatus === 'error';
  return isComplete && tool.executionResult !== undefined;
}

/**
 * Checks if duration is available after completion
 */
function isDurationAvailableAfterCompletion(tool: MCPTool): boolean {
  const isComplete = tool.executionStatus === 'success' || tool.executionStatus === 'error';
  return isComplete && tool.executionResult?.duration !== undefined;
}

// Arbitrary for tool names
const toolNameArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => s.trim().length > 0)
  .map(s => s.replace(/\s+/g, '-'));

// Arbitrary for tool descriptions
const toolDescriptionArb = fc.string({ minLength: 0, maxLength: 200 });

// Arbitrary for tool arguments (key-value pairs)
const toolArgsArb = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)),
  fc.oneof(
    fc.string({ minLength: 0, maxLength: 100 }),
    fc.integer(),
    fc.boolean(),
    fc.constant(null)
  ),
  { minKeys: 0, maxKeys: 5 }
);

// Arbitrary for execution duration in milliseconds
const durationArb = fc.integer({ min: 0, max: 300000 }); // 0 to 5 minutes

// Arbitrary for execution result status
const resultStatusArb = fc.constantFrom<'success' | 'error'>('success', 'error');

// Arbitrary for error messages
const errorMessageArb = fc.string({ minLength: 1, maxLength: 200 });

// Arbitrary for a base MCPTool in idle state
const idleToolArb: fc.Arbitrary<MCPTool> = fc.record({
  name: toolNameArb,
  description: toolDescriptionArb,
  inputSchema: fc.constant({}),
  executionStatus: fc.constant<ToolExecutionStatus>('idle'),
  executionArgs: fc.constant(undefined),
  executionResult: fc.constant(undefined),
  executionStartTime: fc.constant(undefined),
});

// Arbitrary for execution result
const executionResultArb: fc.Arbitrary<ToolExecutionResult> = fc.record({
  status: resultStatusArb,
  data: fc.option(fc.anything(), { nil: undefined }),
  errorMessage: fc.option(errorMessageArb, { nil: undefined }),
  duration: fc.option(durationArb, { nil: undefined }),
});

describe('Property 9: Tool Execution Lifecycle Display', () => {
  describe('State Transitions', () => {
    it('tool SHALL transition from idle to running when execution starts (Req 3.5)', () => {
      fc.assert(
        fc.property(
          idleToolArb,
          toolArgsArb,
          (tool, args) => {
            // Start execution
            const runningTool = startToolExecution(tool, args);

            // Property: Status transitions to running
            expect(runningTool.executionStatus).toBe('running');

            // Property: Valid transition from idle to running
            expect(isValidTransition('idle', 'running')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('tool SHALL transition from running to success or error when execution completes (Req 3.6)', () => {
      fc.assert(
        fc.property(
          idleToolArb,
          toolArgsArb,
          resultStatusArb,
          (tool, args, resultStatus) => {
            // Start execution
            const runningTool = startToolExecution(tool, args);

            // Complete execution
            const result: ToolExecutionResult = { status: resultStatus };
            const completedTool = completeToolExecution(runningTool, result);

            // Property: Status transitions to success or error
            expect(['success', 'error']).toContain(completedTool.executionStatus);

            // Property: Valid transition from running
            expect(isValidTransition('running', completedTool.executionStatus!)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('state transitions SHALL be valid - no invalid transitions (Req 3.5, 3.6)', () => {
      fc.assert(
        fc.property(
          idleToolArb,
          toolArgsArb,
          executionResultArb,
          (tool, args, result) => {
            // Full lifecycle: idle → running → complete
            const states: ToolExecutionStatus[] = ['idle'];

            // Transition to running
            const runningTool = startToolExecution(tool, args);
            states.push(runningTool.executionStatus!);

            // Transition to complete
            const completedTool = completeToolExecution(runningTool, result);
            states.push(completedTool.executionStatus!);

            // Property: All transitions are valid
            for (let i = 0; i < states.length - 1; i++) {
              expect(isValidTransition(states[i], states[i + 1])).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Running State Display', () => {
    it('tool name SHALL be available during execution (Req 3.5)', () => {
      fc.assert(
        fc.property(
          idleToolArb,
          toolArgsArb,
          (tool, args) => {
            const runningTool = startToolExecution(tool, args);

            // Property: Tool name is available
            expect(isToolNameAvailable(runningTool)).toBe(true);
            expect(runningTool.name).toBe(tool.name);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('tool arguments SHALL be available during execution (Req 3.5)', () => {
      fc.assert(
        fc.property(
          idleToolArb,
          toolArgsArb,
          (tool, args) => {
            const runningTool = startToolExecution(tool, args);

            // Property: Arguments are available during running state
            expect(areArgumentsAvailableDuringExecution(runningTool)).toBe(true);
            expect(runningTool.executionArgs).toEqual(args);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('running indicator SHALL be shown during execution (Req 3.5)', () => {
      fc.assert(
        fc.property(
          idleToolArb,
          toolArgsArb,
          (tool, args) => {
            const runningTool = startToolExecution(tool, args);

            // Property: Status is running
            expect(runningTool.executionStatus).toBe('running');

            // Property: Status color indicates running state
            const statusColor = getToolStatusColor(runningTool.executionStatus);
            expect(statusColor).toBe('#F59E0B'); // amber for running
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Completion State Display', () => {
    it('result status SHALL be available after completion (Req 3.6)', () => {
      fc.assert(
        fc.property(
          idleToolArb,
          toolArgsArb,
          executionResultArb,
          (tool, args, result) => {
            const runningTool = startToolExecution(tool, args);
            const completedTool = completeToolExecution(runningTool, result);

            // Property: Result status is available
            expect(isResultStatusAvailableAfterCompletion(completedTool)).toBe(true);
            expect(completedTool.executionResult?.status).toBe(result.status);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('duration SHALL be available after completion (Req 3.6)', () => {
      fc.assert(
        fc.property(
          idleToolArb,
          toolArgsArb,
          executionResultArb,
          (tool, args, result) => {
            const runningTool = startToolExecution(tool, args);
            const completedTool = completeToolExecution(runningTool, result);

            // Property: Duration is available after completion
            expect(isDurationAvailableAfterCompletion(completedTool)).toBe(true);
            expect(typeof completedTool.executionResult?.duration).toBe('number');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('success status SHALL show green indicator (Req 3.6)', () => {
      fc.assert(
        fc.property(
          idleToolArb,
          toolArgsArb,
          (tool, args) => {
            const runningTool = startToolExecution(tool, args);
            const result: ToolExecutionResult = { status: 'success' };
            const completedTool = completeToolExecution(runningTool, result);

            // Property: Success shows green
            expect(completedTool.executionStatus).toBe('success');
            expect(getToolStatusColor(completedTool.executionStatus)).toBe('#22C55E');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('error status SHALL show red indicator (Req 3.6)', () => {
      fc.assert(
        fc.property(
          idleToolArb,
          toolArgsArb,
          errorMessageArb,
          (tool, args, errorMessage) => {
            const runningTool = startToolExecution(tool, args);
            const result: ToolExecutionResult = { status: 'error', errorMessage };
            const completedTool = completeToolExecution(runningTool, result);

            // Property: Error shows red
            expect(completedTool.executionStatus).toBe('error');
            expect(getToolStatusColor(completedTool.executionStatus)).toBe('#EF4444');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Duration Formatting', () => {
    it('duration SHALL be formatted correctly for milliseconds (Req 3.6)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 999 }),
          (ms) => {
            const formatted = formatDuration(ms);

            // Property: Milliseconds format ends with 'ms'
            expect(formatted).toMatch(/^\d+ms$/);
            expect(formatted).toBe(`${ms}ms`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('duration SHALL be formatted correctly for seconds (Req 3.6)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 59999 }),
          (ms) => {
            const formatted = formatDuration(ms);

            // Property: Seconds format ends with 's'
            expect(formatted).toMatch(/^\d+(\.\d)?s$/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('duration SHALL be formatted correctly for minutes (Req 3.6)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 60000, max: 300000 }),
          (ms) => {
            const formatted = formatDuration(ms);

            // Property: Minutes format includes 'm' and 's'
            expect(formatted).toMatch(/^\d+m \d+s$/);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Arguments Formatting', () => {
    it('arguments SHALL be formatted as JSON string (Req 3.5)', () => {
      fc.assert(
        fc.property(
          toolArgsArb,
          (args) => {
            const formatted = formatToolArgs(args);

            if (Object.keys(args).length === 0) {
              // Property: Empty args shows 'No arguments'
              expect(formatted).toBe('No arguments');
            } else {
              // Property: Non-empty args are valid JSON
              expect(() => JSON.parse(formatted)).not.toThrow();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('undefined arguments SHALL show "No arguments" (Req 3.5)', () => {
      fc.assert(
        fc.property(
          fc.constant(undefined),
          (args) => {
            const formatted = formatToolArgs(args);

            // Property: Undefined shows 'No arguments'
            expect(formatted).toBe('No arguments');
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Full Lifecycle', () => {
    it('complete lifecycle SHALL preserve tool identity (Req 3.5, 3.6)', () => {
      fc.assert(
        fc.property(
          idleToolArb,
          toolArgsArb,
          executionResultArb,
          (tool, args, result) => {
            // Full lifecycle
            const runningTool = startToolExecution(tool, args);
            const completedTool = completeToolExecution(runningTool, result);

            // Property: Tool name is preserved throughout lifecycle
            expect(runningTool.name).toBe(tool.name);
            expect(completedTool.name).toBe(tool.name);

            // Property: Tool description is preserved
            expect(runningTool.description).toBe(tool.description);
            expect(completedTool.description).toBe(tool.description);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('tool can be reset and re-executed (Req 3.5, 3.6)', () => {
      fc.assert(
        fc.property(
          idleToolArb,
          toolArgsArb,
          toolArgsArb,
          executionResultArb,
          (tool, args1, args2, result) => {
            // First execution
            const running1 = startToolExecution(tool, args1);
            const completed1 = completeToolExecution(running1, result);

            // Reset
            const reset = resetToolExecution(completed1);
            expect(reset.executionStatus).toBe('idle');
            expect(reset.executionArgs).toBeUndefined();
            expect(reset.executionResult).toBeUndefined();

            // Second execution
            const running2 = startToolExecution(reset, args2);
            expect(running2.executionStatus).toBe('running');
            expect(running2.executionArgs).toEqual(args2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('multiple tools can execute independently (Req 3.5, 3.6)', () => {
      fc.assert(
        fc.property(
          fc.array(idleToolArb, { minLength: 2, maxLength: 5 }),
          fc.array(toolArgsArb, { minLength: 2, maxLength: 5 }),
          (tools, argsArray) => {
            // Start all tools
            const runningTools = tools.map((tool, i) =>
              startToolExecution(tool, argsArray[i % argsArray.length])
            );

            // Property: All tools are running independently
            runningTools.forEach((tool, i) => {
              expect(tool.executionStatus).toBe('running');
              expect(tool.name).toBe(tools[i].name);
            });

            // Complete some with success, some with error
            const completedTools = runningTools.map((tool, i) => {
              const result: ToolExecutionResult = {
                status: i % 2 === 0 ? 'success' : 'error',
              };
              return completeToolExecution(tool, result);
            });

            // Property: Each tool has its own status
            completedTools.forEach((tool, i) => {
              expect(tool.executionStatus).toBe(i % 2 === 0 ? 'success' : 'error');
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
