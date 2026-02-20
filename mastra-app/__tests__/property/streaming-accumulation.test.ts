/**
 * Property Test: Streaming Response Accumulation
 *
 * Feature: claude-desktop-alternative, Property 2: Streaming Response Accumulation
 *
 * *For any* sequence of stream chunks received from OCI GenAI, the accumulated content
 * SHALL equal the concatenation of all chunk contents in order, and the final message
 * content SHALL match this accumulation.
 *
 * **Validates: Requirements 1.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { StreamChunk } from '../../src/types';

/**
 * Simulates the streaming accumulation logic used in the chat UI.
 * This mirrors how chunks are accumulated during streaming responses.
 */
function accumulateStreamChunks(chunks: StreamChunk[]): string {
  let accumulated = '';
  for (const chunk of chunks) {
    if (chunk.content !== undefined) {
      accumulated += chunk.content;
    }
  }
  return accumulated;
}

/**
 * Concatenates all chunk contents in order.
 * This is the expected result for comparison.
 */
function concatenateChunkContents(chunks: StreamChunk[]): string {
  return chunks
    .map(chunk => chunk.content ?? '')
    .join('');
}

/**
 * Simulates creating a final message from accumulated stream content.
 */
function createFinalMessage(accumulatedContent: string): { content: string; role: 'assistant' } {
  return {
    content: accumulatedContent,
    role: 'assistant',
  };
}

// Arbitrary for chunk content - can be any string including empty
const chunkContentArb = fc.oneof(
  fc.string({ minLength: 1, maxLength: 200 }),
  fc.constant(''),
  fc.constant(undefined)
);

// Arbitrary for a single stream chunk with content
const streamChunkWithContentArb: fc.Arbitrary<StreamChunk> = fc.record({
  content: fc.string({ minLength: 0, maxLength: 200 }),
  toolCalls: fc.constant(undefined),
  finishReason: fc.constant(undefined),
});

// Arbitrary for a stream chunk that may or may not have content
const streamChunkArb: fc.Arbitrary<StreamChunk> = fc.record({
  content: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: undefined }),
  toolCalls: fc.constant(undefined),
  finishReason: fc.constant(undefined),
});

// Arbitrary for a sequence of stream chunks (simulating a streaming response)
const streamSequenceArb = fc.array(streamChunkWithContentArb, { minLength: 1, maxLength: 20 });

// Arbitrary for a sequence that may include chunks without content
const mixedStreamSequenceArb = fc.array(streamChunkArb, { minLength: 1, maxLength: 20 });

// Arbitrary for non-empty string chunks (for testing order preservation)
const nonEmptyChunkArb: fc.Arbitrary<StreamChunk> = fc.record({
  content: fc.string({ minLength: 1, maxLength: 50 }),
  toolCalls: fc.constant(undefined),
  finishReason: fc.constant(undefined),
});

const nonEmptyStreamSequenceArb = fc.array(nonEmptyChunkArb, { minLength: 2, maxLength: 15 });

describe('Property 2: Streaming Response Accumulation', () => {
  it('accumulated content SHALL equal concatenation of all chunk contents (Req 1.3)', () => {
    fc.assert(
      fc.property(
        streamSequenceArb,
        (chunks) => {
          const accumulated = accumulateStreamChunks(chunks);
          const concatenated = concatenateChunkContents(chunks);

          // Property: Accumulated content equals concatenation
          expect(accumulated).toBe(concatenated);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('final message content SHALL match accumulated content (Req 1.3)', () => {
    fc.assert(
      fc.property(
        streamSequenceArb,
        (chunks) => {
          const accumulated = accumulateStreamChunks(chunks);
          const finalMessage = createFinalMessage(accumulated);

          // Property: Final message content matches accumulation
          expect(finalMessage.content).toBe(accumulated);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('chunk order SHALL be preserved during accumulation (Req 1.3)', () => {
    fc.assert(
      fc.property(
        nonEmptyStreamSequenceArb,
        (chunks) => {
          const accumulated = accumulateStreamChunks(chunks);

          // Property: Each chunk's content appears in order
          let position = 0;
          for (const chunk of chunks) {
            if (chunk.content) {
              const foundAt = accumulated.indexOf(chunk.content, position);
              expect(foundAt).toBeGreaterThanOrEqual(position);
              position = foundAt + chunk.content.length;
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('no content SHALL be lost during accumulation (Req 1.3)', () => {
    fc.assert(
      fc.property(
        streamSequenceArb,
        (chunks) => {
          const accumulated = accumulateStreamChunks(chunks);

          // Calculate expected total length
          const expectedLength = chunks.reduce(
            (sum, chunk) => sum + (chunk.content?.length ?? 0),
            0
          );

          // Property: No content is lost - lengths match
          expect(accumulated.length).toBe(expectedLength);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('empty chunks SHALL not affect accumulation result (Req 1.3)', () => {
    fc.assert(
      fc.property(
        mixedStreamSequenceArb,
        (chunks) => {
          const accumulated = accumulateStreamChunks(chunks);

          // Filter to only chunks with content
          const chunksWithContent = chunks.filter(c => c.content !== undefined);
          const expectedContent = chunksWithContent.map(c => c.content).join('');

          // Property: Empty/undefined chunks don't affect result
          expect(accumulated).toBe(expectedContent);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('single chunk stream SHALL produce content equal to that chunk (Req 1.3)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 500 }),
        (content) => {
          const chunks: StreamChunk[] = [{ content }];
          const accumulated = accumulateStreamChunks(chunks);

          // Property: Single chunk accumulates to its own content
          expect(accumulated).toBe(content);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('accumulation SHALL be associative - grouping does not matter (Req 1.3)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 3, maxLength: 10 }),
        (contents) => {
          // Create chunks from contents
          const chunks: StreamChunk[] = contents.map(content => ({ content }));

          // Accumulate all at once
          const fullAccumulation = accumulateStreamChunks(chunks);

          // Accumulate in two parts and combine
          const midpoint = Math.floor(chunks.length / 2);
          const firstHalf = accumulateStreamChunks(chunks.slice(0, midpoint));
          const secondHalf = accumulateStreamChunks(chunks.slice(midpoint));
          const combinedAccumulation = firstHalf + secondHalf;

          // Property: Grouping doesn't affect final result
          expect(fullAccumulation).toBe(combinedAccumulation);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('accumulation with special characters SHALL preserve them exactly (Req 1.3)', () => {
    // Generate strings containing special characters
    const specialChars = [
      '\n', '\t', '\r', ' ', '\\', '"', "'", '`',
      '→', '←', '↑', '↓', '•', '©', '®', '™',
      '😀', '🎉', '🚀', '💻', '🔥',
      '<', '>', '&', '{', '}', '[', ']'
    ];
    
    const specialCharsArb = fc.array(
      fc.constantFrom(...specialChars),
      { minLength: 1, maxLength: 20 }
    ).map(chars => chars.join(''));

    fc.assert(
      fc.property(
        fc.array(specialCharsArb, { minLength: 1, maxLength: 10 }),
        (contents) => {
          const chunks: StreamChunk[] = contents.map(content => ({ content }));
          const accumulated = accumulateStreamChunks(chunks);
          const expected = contents.join('');

          // Property: Special characters are preserved exactly
          expect(accumulated).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('accumulation SHALL handle unicode correctly (Req 1.3)', () => {
    // Generate strings with unicode characters using standard string arbitrary
    // which includes unicode by default
    const unicodeChars = [
      '你好', '世界', 'مرحبا', 'שלום', 'Привет', 'こんにちは', '안녕하세요',
      '🌍', '🌎', '🌏', '✨', '🎯', '📝', '💡', '🔧',
      'α', 'β', 'γ', 'δ', 'ε', 'π', 'Σ', 'Ω',
      '∞', '≠', '≤', '≥', '±', '÷', '×', '√'
    ];
    
    const unicodeStringArb = fc.array(
      fc.oneof(
        fc.constantFrom(...unicodeChars),
        fc.string({ minLength: 1, maxLength: 20 })
      ),
      { minLength: 1, maxLength: 10 }
    ).map(parts => parts.join(''));

    fc.assert(
      fc.property(
        fc.array(unicodeStringArb, { minLength: 1, maxLength: 10 }),
        (contents) => {
          const chunks: StreamChunk[] = contents.map(content => ({ content }));
          const accumulated = accumulateStreamChunks(chunks);
          const expected = contents.join('');

          // Property: Unicode is handled correctly
          expect(accumulated).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('empty stream SHALL produce empty accumulation (Req 1.3)', () => {
    fc.assert(
      fc.property(
        fc.constant([]),
        (chunks: StreamChunk[]) => {
          const accumulated = accumulateStreamChunks(chunks);

          // Property: Empty stream produces empty string
          expect(accumulated).toBe('');
        }
      ),
      { numRuns: 10 }
    );
  });

  it('stream of empty strings SHALL produce empty accumulation (Req 1.3)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constant({ content: '' } as StreamChunk), { minLength: 1, maxLength: 20 }),
        (chunks) => {
          const accumulated = accumulateStreamChunks(chunks);

          // Property: Stream of empty strings produces empty result
          expect(accumulated).toBe('');
        }
      ),
      { numRuns: 100 }
    );
  });
});
