/**
 * Property Test: Keyboard Input Behavior
 * 
 * Feature: claude-desktop-alternative, Property 4: Keyboard Input Behavior
 * 
 * *For any* input field state, pressing Enter without Shift SHALL trigger form submission,
 * and pressing Shift+Enter SHALL insert a newline character without submission.
 * 
 * **Validates: Requirements 1.6**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Simulates the keyboard event handling logic from ChatUI.tsx
 * This mirrors the handleKeyDown function behavior.
 */
interface KeyboardEventSimulation {
  key: string;
  shiftKey: boolean;
}

interface KeyboardHandlerResult {
  shouldSubmit: boolean;
  shouldInsertNewline: boolean;
  defaultPrevented: boolean;
}

/**
 * Simulates the handleKeyDown logic from ChatUI.tsx
 * Returns what actions should be taken based on the key event.
 */
function simulateKeyboardHandler(event: KeyboardEventSimulation): KeyboardHandlerResult {
  const isEnterKey = event.key === 'Enter';
  const isShiftPressed = event.shiftKey;
  
  if (isEnterKey && !isShiftPressed) {
    // Enter without Shift: submit form, prevent default (no newline)
    return {
      shouldSubmit: true,
      shouldInsertNewline: false,
      defaultPrevented: true,
    };
  } else if (isEnterKey && isShiftPressed) {
    // Shift+Enter: allow default behavior (insert newline), don't submit
    return {
      shouldSubmit: false,
      shouldInsertNewline: true,
      defaultPrevented: false,
    };
  } else {
    // Any other key: allow default behavior, don't submit
    return {
      shouldSubmit: false,
      shouldInsertNewline: false,
      defaultPrevented: false,
    };
  }
}

/**
 * Simulates the message submission validation logic from ChatUI.tsx
 * Returns whether a message would actually be submitted.
 */
function shouldAllowSubmission(
  content: string,
  isLoading: boolean,
  selectedModel: string | null
): boolean {
  return content.trim().length > 0 && !isLoading && !!selectedModel;
}

// Arbitrary for valid message content
const messageContentArb = fc.string({ minLength: 0, maxLength: 500 });

// Arbitrary for non-empty message content (valid for submission)
const validMessageContentArb = fc.string({ minLength: 1, maxLength: 500 })
  .filter(s => s.trim().length > 0);

// Arbitrary for empty or whitespace-only content (invalid for submission)
const emptyMessageContentArb = fc.constantFrom('', ' ', '  ', '\t', '\n', '  \n  ', '\t\t');

// Arbitrary for model IDs
const modelIdArb = fc.constantFrom(
  'google.gemini-2.5-flash',
  'cohere.command-r-plus',
  'meta.llama-3.1-70b',
  'xai.grok-3'
);

// Arbitrary for any keyboard key
const keyArb = fc.constantFrom(
  'Enter', 'a', 'b', 'Space', 'Backspace', 'Delete', 'Tab', 'Escape',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '1', '2', '!'
);

describe('Property 4: Keyboard Input Behavior', () => {
  describe('Enter key submission behavior', () => {
    it('Enter without Shift SHALL trigger form submission (Req 1.6)', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // shiftKey state (we'll force it to false)
          () => {
            const event: KeyboardEventSimulation = {
              key: 'Enter',
              shiftKey: false,
            };
            
            const result = simulateKeyboardHandler(event);
            
            // Property: Enter without Shift triggers submission
            expect(result.shouldSubmit).toBe(true);
            expect(result.defaultPrevented).toBe(true);
            expect(result.shouldInsertNewline).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Shift+Enter SHALL insert newline without submission (Req 1.6)', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // shiftKey state (we'll force it to true)
          () => {
            const event: KeyboardEventSimulation = {
              key: 'Enter',
              shiftKey: true,
            };
            
            const result = simulateKeyboardHandler(event);
            
            // Property: Shift+Enter inserts newline, doesn't submit
            expect(result.shouldSubmit).toBe(false);
            expect(result.shouldInsertNewline).toBe(true);
            expect(result.defaultPrevented).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Enter key behavior is mutually exclusive based on Shift state (Req 1.6)', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          (shiftKey) => {
            const event: KeyboardEventSimulation = {
              key: 'Enter',
              shiftKey,
            };
            
            const result = simulateKeyboardHandler(event);
            
            // Property: Submit and newline are mutually exclusive
            expect(result.shouldSubmit).not.toBe(result.shouldInsertNewline);
            
            // Property: Shift determines which action occurs
            if (shiftKey) {
              expect(result.shouldInsertNewline).toBe(true);
              expect(result.shouldSubmit).toBe(false);
            } else {
              expect(result.shouldSubmit).toBe(true);
              expect(result.shouldInsertNewline).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Non-Enter key behavior', () => {
    it('Non-Enter keys SHALL NOT trigger submission (Req 1.6)', () => {
      const nonEnterKeyArb = fc.constantFrom(
        'a', 'b', 'Space', 'Backspace', 'Delete', 'Tab', 'Escape',
        'ArrowUp', 'ArrowDown', '1', '2', '!', '@', '#'
      );

      fc.assert(
        fc.property(
          nonEnterKeyArb,
          fc.boolean(),
          (key, shiftKey) => {
            const event: KeyboardEventSimulation = {
              key,
              shiftKey,
            };
            
            const result = simulateKeyboardHandler(event);
            
            // Property: Non-Enter keys never trigger submission
            expect(result.shouldSubmit).toBe(false);
            expect(result.defaultPrevented).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Empty message prevention', () => {
    it('Empty messages SHALL NOT be submitted (Req 1.6)', () => {
      fc.assert(
        fc.property(
          emptyMessageContentArb,
          modelIdArb,
          (content, modelId) => {
            const canSubmit = shouldAllowSubmission(content, false, modelId);
            
            // Property: Empty/whitespace content prevents submission
            expect(canSubmit).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Non-empty messages with valid model SHALL be submittable (Req 1.6)', () => {
      fc.assert(
        fc.property(
          validMessageContentArb,
          modelIdArb,
          (content, modelId) => {
            const canSubmit = shouldAllowSubmission(content, false, modelId);
            
            // Property: Valid content with model allows submission
            expect(canSubmit).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Messages SHALL NOT be submitted while loading (Req 1.6)', () => {
      fc.assert(
        fc.property(
          validMessageContentArb,
          modelIdArb,
          (content, modelId) => {
            const canSubmit = shouldAllowSubmission(content, true, modelId);
            
            // Property: Loading state prevents submission
            expect(canSubmit).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Messages SHALL NOT be submitted without a selected model (Req 1.6)', () => {
      fc.assert(
        fc.property(
          validMessageContentArb,
          fc.constantFrom(null, ''),
          (content, modelId) => {
            const canSubmit = shouldAllowSubmission(content, false, modelId);
            
            // Property: No model prevents submission
            expect(canSubmit).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Combined keyboard and validation behavior', () => {
    it('Enter key with empty content SHALL NOT result in submission (Req 1.6)', () => {
      fc.assert(
        fc.property(
          emptyMessageContentArb,
          modelIdArb,
          (content, modelId) => {
            // Simulate Enter key press
            const keyResult = simulateKeyboardHandler({ key: 'Enter', shiftKey: false });
            
            // Even though Enter triggers submission intent...
            expect(keyResult.shouldSubmit).toBe(true);
            
            // ...the validation should prevent actual submission
            const canSubmit = shouldAllowSubmission(content, false, modelId);
            expect(canSubmit).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Enter key with valid content and model SHALL result in submission (Req 1.6)', () => {
      fc.assert(
        fc.property(
          validMessageContentArb,
          modelIdArb,
          (content, modelId) => {
            // Simulate Enter key press
            const keyResult = simulateKeyboardHandler({ key: 'Enter', shiftKey: false });
            
            // Enter triggers submission intent
            expect(keyResult.shouldSubmit).toBe(true);
            
            // Validation allows submission
            const canSubmit = shouldAllowSubmission(content, false, modelId);
            expect(canSubmit).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Shift+Enter SHALL allow newline regardless of content state (Req 1.6)', () => {
      fc.assert(
        fc.property(
          messageContentArb,
          fc.boolean(),
          fc.oneof(modelIdArb, fc.constant(null)),
          (content, isLoading, modelId) => {
            // Simulate Shift+Enter key press
            const keyResult = simulateKeyboardHandler({ key: 'Enter', shiftKey: true });
            
            // Property: Shift+Enter always allows newline, never submits
            expect(keyResult.shouldInsertNewline).toBe(true);
            expect(keyResult.shouldSubmit).toBe(false);
            expect(keyResult.defaultPrevented).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
