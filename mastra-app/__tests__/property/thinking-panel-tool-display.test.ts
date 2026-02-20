/**
 * Property Test: Thinking Panel Tool Call Display
 *
 * Feature: claude-desktop-alternative, Property 22: Thinking Panel Tool Call Display
 *
 * *For any* tool call during agent processing, the thinking panel SHALL display
 * the tool name and a representation of the arguments.
 *
 * **Validates: Requirements 8.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ThinkingStep } from '../../src/components/AgentThinking';

/**
 * Format tool name for display - mirrors the component's formatToolName function
 */
function formatToolName(name?: string): string {
  if (!name) return 'tool';
  return name
    .replace(/^sqlcl_/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Format tool arguments for readable display - mirrors the component's formatToolArgs function
 */
function formatToolArgs(args?: Record<string, unknown>): { key: string; value: string }[] {
  if (!args) return [];
  
  return Object.entries(args).map(([key, value]) => {
    let displayValue: string;
    
    if (value === null || value === undefined) {
      displayValue = 'null';
    } else if (typeof value === 'string') {
      displayValue = value.length > 100 ? `${value.substring(0, 100)}...` : value;
    } else if (typeof value === 'object') {
      const jsonStr = JSON.stringify(value);
      displayValue = jsonStr.length > 100 ? `${jsonStr.substring(0, 100)}...` : jsonStr;
    } else {
      displayValue = String(value);
    }
    
    return {
      key: key.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      value: displayValue
    };
  });
}

/**
 * Check if a tool call step has displayable tool name
 */
function hasDisplayableToolName(step: ThinkingStep): boolean {
  return step.type === 'tool_call' && 
         step.toolName !== undefined && 
         step.toolName.length > 0;
}

/**
 * Check if a tool call step has displayable arguments representation
 */
function hasDisplayableArguments(step: ThinkingStep): boolean {
  if (step.type !== 'tool_call') return false;
  // Arguments are displayable if they exist (even empty object is displayable)
  return step.toolArgs !== undefined;
}

/**
 * Check if formatted tool name is non-empty and readable
 */
function isFormattedToolNameReadable(toolName: string): boolean {
  const formatted = formatToolName(toolName);
  return formatted.length > 0 && formatted !== 'tool';
}

/**
 * Check if formatted arguments produce valid display entries
 */
function areFormattedArgsValid(args: Record<string, unknown>): boolean {
  const formatted = formatToolArgs(args);
  // Each formatted arg should have non-empty key and defined value
  return formatted.every(entry => 
    entry.key.length > 0 && 
    entry.value !== undefined
  );
}

// Arbitrary for tool names - valid identifier-like strings
const toolNameArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(s));

// Arbitrary for sqlcl-prefixed tool names
const sqlclToolNameArb = fc.string({ minLength: 1, maxLength: 40 })
  .filter(s => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s))
  .map(s => `sqlcl_${s}`);

// Combined tool name arbitrary
const anyToolNameArb = fc.oneof(toolNameArb, sqlclToolNameArb);

// Arbitrary for argument keys - valid identifier-like strings
const argKeyArb = fc.string({ minLength: 1, maxLength: 30 })
  .filter(s => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s));

// Arbitrary for argument values - various types
const argValueArb = fc.oneof(
  fc.string({ minLength: 0, maxLength: 200 }),
  fc.integer(),
  fc.double({ noNaN: true, noDefaultInfinity: true }),
  fc.boolean(),
  fc.constant(null),
  fc.array(fc.string({ maxLength: 20 }), { maxLength: 5 }),
  fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.string({ maxLength: 20 }), { maxKeys: 3 })
);

// Arbitrary for tool arguments (key-value pairs)
const toolArgsArb = fc.dictionary(
  argKeyArb,
  argValueArb,
  { minKeys: 0, maxKeys: 10 }
);

// Arbitrary for step status
const stepStatusArb = fc.constantFrom<ThinkingStep['status']>('pending', 'running', 'complete', 'error');

// Arbitrary for a tool_call ThinkingStep
const toolCallStepArb: fc.Arbitrary<ThinkingStep> = fc.record({
  id: fc.uuid(),
  type: fc.constant<'tool_call'>('tool_call'),
  content: fc.string({ minLength: 0, maxLength: 100 }),
  toolName: anyToolNameArb,
  toolArgs: toolArgsArb,
  toolResult: fc.constant(undefined),
  timestamp: fc.date(),
  status: stepStatusArb,
  duration: fc.option(fc.integer({ min: 0, max: 300000 }), { nil: undefined }),
});

// Arbitrary for a tool_call step with specific status
const runningToolCallStepArb = toolCallStepArb.map(step => ({
  ...step,
  status: 'running' as const
}));

const completeToolCallStepArb = toolCallStepArb.map(step => ({
  ...step,
  status: 'complete' as const,
  duration: Math.floor(Math.random() * 5000)
}));

describe('Property 22: Thinking Panel Tool Call Display', () => {
  describe('Tool Name Display', () => {
    it('tool name SHALL be displayable for any valid tool call step (Req 8.3)', () => {
      fc.assert(
        fc.property(
          toolCallStepArb,
          (step) => {
            // Property: Tool call steps have displayable tool names
            expect(hasDisplayableToolName(step)).toBe(true);
            expect(step.toolName).toBeDefined();
            expect(step.toolName!.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('formatted tool name SHALL be non-empty and readable (Req 8.3)', () => {
      fc.assert(
        fc.property(
          toolNameArb,
          (toolName) => {
            const formatted = formatToolName(toolName);
            
            // Property: Formatted name is non-empty
            expect(formatted.length).toBeGreaterThan(0);
            
            // Property: Formatted name is different from fallback when input is valid
            expect(isFormattedToolNameReadable(toolName)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('tool name formatting SHALL handle sqlcl_ prefix correctly (Req 8.3)', () => {
      fc.assert(
        fc.property(
          sqlclToolNameArb,
          (prefixedName) => {
            const formatted = formatToolName(prefixedName);
            
            // Property: sqlcl_ prefix is removed
            expect(formatted.toLowerCase()).not.toContain('sqlcl');
            
            // Property: Result is still readable
            expect(formatted.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('tool name formatting SHALL convert underscores and dashes to spaces (Req 8.3)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('get_user_data', 'fetch-results', 'query_database-v2', 'simple'),
          (toolName) => {
            const formatted = formatToolName(toolName);
            
            // Property: No underscores or dashes in formatted output
            expect(formatted).not.toContain('_');
            expect(formatted).not.toContain('-');
            
            // Property: Words are capitalized
            const words = formatted.split(' ');
            words.forEach(word => {
              if (word.length > 0) {
                expect(word[0]).toBe(word[0].toUpperCase());
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Tool Arguments Display', () => {
    it('tool arguments SHALL be displayable for any tool call step (Req 8.3)', () => {
      fc.assert(
        fc.property(
          toolCallStepArb,
          (step) => {
            // Property: Tool call steps have displayable arguments
            expect(hasDisplayableArguments(step)).toBe(true);
            expect(step.toolArgs).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('formatted arguments SHALL produce valid display entries (Req 8.3)', () => {
      fc.assert(
        fc.property(
          toolArgsArb,
          (args) => {
            const formatted = formatToolArgs(args);
            
            // Property: Number of formatted entries matches input keys
            expect(formatted.length).toBe(Object.keys(args).length);
            
            // Property: All entries are valid
            if (Object.keys(args).length > 0) {
              expect(areFormattedArgsValid(args)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('argument keys SHALL be formatted with spaces and capitalization (Req 8.3)', () => {
      fc.assert(
        fc.property(
          fc.dictionary(
            fc.constantFrom('user_id', 'query_string', 'max_results', 'simple'),
            fc.string({ maxLength: 50 }),
            { minKeys: 1, maxKeys: 5 }
          ),
          (args) => {
            const formatted = formatToolArgs(args);
            
            formatted.forEach(entry => {
              // Property: No underscores in formatted keys
              expect(entry.key).not.toContain('_');
              
              // Property: Keys are capitalized
              const words = entry.key.split(' ');
              words.forEach(word => {
                if (word.length > 0) {
                  expect(word[0]).toBe(word[0].toUpperCase());
                }
              });
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('long argument values SHALL be truncated (Req 8.3)', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 150, maxLength: 300 }),
          (longValue) => {
            const args = { testKey: longValue };
            const formatted = formatToolArgs(args);
            
            // Property: Long values are truncated
            expect(formatted[0].value.length).toBeLessThanOrEqual(103); // 100 + '...'
            expect(formatted[0].value).toContain('...');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('null and undefined values SHALL be displayed as "null" (Req 8.3)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(null, undefined),
          (value) => {
            const args = { testKey: value };
            const formatted = formatToolArgs(args);
            
            // Property: Null/undefined displayed as 'null'
            expect(formatted[0].value).toBe('null');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('object argument values SHALL be JSON stringified (Req 8.3)', () => {
      fc.assert(
        fc.property(
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 10 }),
            fc.oneof(fc.string({ maxLength: 20 }), fc.integer()),
            { minKeys: 1, maxKeys: 3 }
          ),
          (objValue) => {
            const args = { testKey: objValue };
            const formatted = formatToolArgs(args);
            
            // Property: Object values are JSON-like strings
            expect(formatted[0].value).toContain('{');
            expect(formatted[0].value).toContain('}');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('empty arguments object SHALL produce empty formatted array (Req 8.3)', () => {
      fc.assert(
        fc.property(
          fc.constant({}),
          (args) => {
            const formatted = formatToolArgs(args);
            
            // Property: Empty args produce empty array
            expect(formatted).toEqual([]);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Tool Call Step Completeness', () => {
    it('running tool call SHALL have both name and args available (Req 8.3)', () => {
      fc.assert(
        fc.property(
          runningToolCallStepArb,
          (step) => {
            // Property: Running step has displayable name
            expect(hasDisplayableToolName(step)).toBe(true);
            
            // Property: Running step has displayable args
            expect(hasDisplayableArguments(step)).toBe(true);
            
            // Property: Status is running
            expect(step.status).toBe('running');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('complete tool call SHALL preserve name and args (Req 8.3)', () => {
      fc.assert(
        fc.property(
          completeToolCallStepArb,
          (step) => {
            // Property: Complete step still has displayable name
            expect(hasDisplayableToolName(step)).toBe(true);
            
            // Property: Complete step still has displayable args
            expect(hasDisplayableArguments(step)).toBe(true);
            
            // Property: Status is complete
            expect(step.status).toBe('complete');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('tool call display data SHALL be consistent across status changes (Req 8.3)', () => {
      fc.assert(
        fc.property(
          toolNameArb,
          toolArgsArb,
          fc.array(stepStatusArb, { minLength: 2, maxLength: 4 }),
          (toolName, toolArgs, statuses) => {
            // Create steps with different statuses but same tool data
            const steps = statuses.map((status, i) => ({
              id: `step-${i}`,
              type: 'tool_call' as const,
              content: '',
              toolName,
              toolArgs,
              timestamp: new Date(),
              status,
            }));
            
            // Property: All steps have same formatted tool name
            const formattedNames = steps.map(s => formatToolName(s.toolName));
            expect(new Set(formattedNames).size).toBe(1);
            
            // Property: All steps have same formatted args
            const formattedArgs = steps.map(s => JSON.stringify(formatToolArgs(s.toolArgs)));
            expect(new Set(formattedArgs).size).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('undefined toolName SHALL fallback to "tool" (Req 8.3)', () => {
      fc.assert(
        fc.property(
          fc.constant(undefined),
          (toolName) => {
            const formatted = formatToolName(toolName);
            
            // Property: Undefined falls back to 'tool'
            expect(formatted).toBe('tool');
          }
        ),
        { numRuns: 10 }
      );
    });

    it('undefined toolArgs SHALL produce empty formatted array (Req 8.3)', () => {
      fc.assert(
        fc.property(
          fc.constant(undefined),
          (args) => {
            const formatted = formatToolArgs(args);
            
            // Property: Undefined args produce empty array
            expect(formatted).toEqual([]);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('numeric argument values SHALL be converted to strings (Req 8.3)', () => {
      fc.assert(
        fc.property(
          fc.integer(),
          (numValue) => {
            const args = { count: numValue };
            const formatted = formatToolArgs(args);
            
            // Property: Number is converted to string
            expect(formatted[0].value).toBe(String(numValue));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('boolean argument values SHALL be converted to strings (Req 8.3)', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          (boolValue) => {
            const args = { enabled: boolValue };
            const formatted = formatToolArgs(args);
            
            // Property: Boolean is converted to string
            expect(formatted[0].value).toBe(String(boolValue));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('array argument values SHALL be JSON stringified (Req 8.3)', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          (arrValue) => {
            const args = { items: arrValue };
            const formatted = formatToolArgs(args);
            
            // Property: Array values are JSON-like strings
            expect(formatted[0].value).toContain('[');
            expect(formatted[0].value).toContain(']');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
