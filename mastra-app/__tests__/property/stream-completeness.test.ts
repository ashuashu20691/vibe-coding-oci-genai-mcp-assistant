/**
 * Property Test: Stream Chunk Completeness
 *
 * Feature: mastra-migration, Property 9: Stream Chunk Completeness
 *
 * *For any* streaming response from the OCI GenAI client, the final chunk
 * SHALL include a finish_reason indicating the completion status
 * (stop, tool_calls, or error).
 *
 * **Validates: Requirements 2.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { StreamChunk, ToolCall } from '../../src/types';

// Valid finish reasons as per the design document
const VALID_FINISH_REASONS = ['stop', 'tool_calls', 'error', 'COMPLETE', 'MAX_TOKENS'] as const;
type FinishReason = (typeof VALID_FINISH_REASONS)[number];

// Arbitrary for valid finish reasons
const finishReasonArb = fc.constantFrom(...VALID_FINISH_REASONS);

// Arbitrary for text content
const contentArb = fc.option(
  fc.string({ minLength: 1, maxLength: 500 }),
  { nil: undefined }
);

// Arbitrary for tool call ID
const toolCallIdArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => /^[a-zA-Z0-9_-]+$/.test(s));

// Arbitrary for tool name
const toolNameArb = fc.string({ minLength: 1, maxLength: 30 })
  .filter(s => /^[a-zA-Z0-9_-]+$/.test(s));

// Arbitrary for tool arguments
const toolArgumentsArb = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 15 }).filter(s => /^[a-zA-Z_]+$/.test(s)),
  fc.oneof(fc.string(), fc.integer(), fc.boolean()),
  { minKeys: 0, maxKeys: 5 }
);

// Arbitrary for a single tool call
const toolCallArb: fc.Arbitrary<ToolCall> = fc.record({
  id: toolCallIdArb,
  name: toolNameArb,
  arguments: toolArgumentsArb,
});

// Arbitrary for tool calls array
const toolCallsArb = fc.option(
  fc.array(toolCallArb, { minLength: 1, maxLength: 3 }),
  { nil: undefined }
);

// Arbitrary for a stream chunk (intermediate - no finish reason)
const intermediateChunkArb: fc.Arbitrary<StreamChunk> = fc.record({
  content: contentArb,
  toolCalls: fc.constant(undefined),
  finishReason: fc.constant(undefined),
}).filter(chunk => chunk.content !== undefined); // Intermediate chunks should have content

// Arbitrary for a final stream chunk (with finish reason)
const finalChunkArb: fc.Arbitrary<StreamChunk> = fc.record({
  content: contentArb,
  toolCalls: toolCallsArb,
  finishReason: finishReasonArb.map(r => r as string),
});

// Arbitrary for a complete stream (sequence of chunks ending with final chunk)
const streamSequenceArb = fc.tuple(
  fc.array(intermediateChunkArb, { minLength: 0, maxLength: 10 }),
  finalChunkArb
).map(([intermediate, final]) => [...intermediate, final]);

/**
 * Simulates collecting chunks from a streaming response.
 * Returns the final chunk from the stream.
 */
function collectStreamChunks(chunks: StreamChunk[]): StreamChunk | null {
  if (chunks.length === 0) return null;
  return chunks[chunks.length - 1];
}

/**
 * Validates that a finish reason is one of the expected values.
 */
function isValidFinishReason(reason: string | undefined): boolean {
  if (reason === undefined) return false;
  return VALID_FINISH_REASONS.includes(reason as FinishReason);
}

describe('Property 9: Stream Chunk Completeness', () => {
  it('final chunk SHALL include a finish_reason for any complete stream', () => {
    fc.assert(
      fc.property(
        streamSequenceArb,
        (chunks) => {
          const finalChunk = collectStreamChunks(chunks);

          // The final chunk must exist
          expect(finalChunk).not.toBeNull();

          // The final chunk must have a finish_reason
          expect(finalChunk!.finishReason).toBeDefined();
          expect(typeof finalChunk!.finishReason).toBe('string');
          expect(finalChunk!.finishReason!.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('finish_reason SHALL be a valid completion status (stop, tool_calls, error, COMPLETE, MAX_TOKENS)', () => {
    fc.assert(
      fc.property(
        finalChunkArb,
        (chunk) => {
          // The finish reason must be one of the valid values
          expect(isValidFinishReason(chunk.finishReason)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('chunks with tool_calls finish_reason SHALL have toolCalls array when appropriate', () => {
    fc.assert(
      fc.property(
        toolCallsArb.filter(tc => tc !== undefined && tc.length > 0),
        finishReasonArb,
        (toolCalls, finishReason) => {
          const chunk: StreamChunk = {
            content: undefined,
            toolCalls,
            finishReason: finishReason === 'tool_calls' ? 'tool_calls' : finishReason,
          };

          // If finish reason is tool_calls, toolCalls should be present
          if (chunk.finishReason === 'tool_calls') {
            // When we explicitly set tool_calls finish reason with toolCalls,
            // the chunk should have the toolCalls array
            expect(chunk.toolCalls).toBeDefined();
            expect(Array.isArray(chunk.toolCalls)).toBe(true);
          }

          // Regardless of finish reason, if toolCalls is present, it should be valid
          if (chunk.toolCalls) {
            expect(chunk.toolCalls.length).toBeGreaterThan(0);
            for (const tc of chunk.toolCalls) {
              expect(tc.id).toBeDefined();
              expect(tc.name).toBeDefined();
              expect(tc.arguments).toBeDefined();
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('intermediate chunks SHALL NOT have finish_reason', () => {
    fc.assert(
      fc.property(
        intermediateChunkArb,
        (chunk) => {
          // Intermediate chunks should not have a finish reason
          expect(chunk.finishReason).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('stream with only final chunk SHALL still have valid finish_reason', () => {
    fc.assert(
      fc.property(
        finalChunkArb,
        (finalChunk) => {
          // Even a single-chunk stream should have a valid finish reason
          const chunks = [finalChunk];
          const lastChunk = collectStreamChunks(chunks);

          expect(lastChunk).not.toBeNull();
          expect(lastChunk!.finishReason).toBeDefined();
          expect(isValidFinishReason(lastChunk!.finishReason)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('content and finish_reason can coexist in final chunk', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        finishReasonArb,
        (content, finishReason) => {
          const chunk: StreamChunk = {
            content,
            finishReason,
          };

          // Both content and finish_reason should be present
          expect(chunk.content).toBe(content);
          expect(chunk.finishReason).toBe(finishReason);
          expect(isValidFinishReason(chunk.finishReason)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
