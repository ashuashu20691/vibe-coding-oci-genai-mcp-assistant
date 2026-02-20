/**
 * Property Test: Keyboard Shortcuts Functionality
 * 
 * Feature: claude-desktop-alternative, Property 27: Keyboard Shortcuts Functionality
 * 
 * *For any* registered keyboard shortcut (Cmd/Ctrl+K, Cmd/Ctrl+N, Cmd/Ctrl+/, Escape),
 * pressing the shortcut SHALL trigger the associated action (focus input, new conversation,
 * toggle sidebar, cancel streaming respectively).
 * 
 * **Validates: Requirements 11.1, 11.2, 11.3, 11.4**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  matchesShortcut,
  isCmdOrCtrlPressed,
  normalizeKey,
  KeyboardShortcut,
} from '@/hooks/useKeyboardShortcuts';

/**
 * Represents a keyboard event for testing
 */
interface TestKeyboardEvent {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/**
 * Creates a mock KeyboardEvent for testing
 */
function createMockKeyboardEvent(config: TestKeyboardEvent): KeyboardEvent {
  return {
    key: config.key,
    metaKey: config.metaKey,
    ctrlKey: config.ctrlKey,
    shiftKey: config.shiftKey,
    altKey: config.altKey,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as KeyboardEvent;
}

/**
 * Registered shortcuts as defined in Requirements 11.1-11.4
 */
const REGISTERED_SHORTCUTS = [
  { key: 'k', cmdOrCtrl: true, action: 'focusInput', description: 'Focus message input' },
  { key: 'n', cmdOrCtrl: true, action: 'newConversation', description: 'New conversation' },
  { key: '/', cmdOrCtrl: true, action: 'toggleSidebar', description: 'Toggle sidebar' },
  { key: 'Escape', cmdOrCtrl: false, action: 'cancelStreaming', description: 'Cancel streaming' },
] as const;

// Arbitrary for platform (Mac vs Windows/Linux)
const platformArb = fc.boolean();

// Arbitrary for registered shortcut selection
const registeredShortcutArb = fc.constantFrom(...REGISTERED_SHORTCUTS);

// Arbitrary for wrong modifier combinations
const wrongModifierArb = fc.record({
  metaKey: fc.boolean(),
  ctrlKey: fc.boolean(),
  shiftKey: fc.boolean(),
  altKey: fc.boolean(),
});

// Arbitrary for keys that are NOT registered shortcuts
const nonRegisteredKeyArb = fc.constantFrom(
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'l', 'm', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
  'Tab', 'Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Home', 'End', 'PageUp', 'PageDown', 'F1', 'F2', 'F3'
);

describe('Property 27: Keyboard Shortcuts Functionality', () => {
  describe('Registered shortcuts trigger callbacks', () => {
    it('Any registered shortcut with correct modifiers SHALL trigger its callback (Req 11.1-11.4)', () => {
      fc.assert(
        fc.property(
          registeredShortcutArb,
          platformArb,
          (shortcutConfig, isMac) => {
            const callback = vi.fn();
            const shortcut: KeyboardShortcut = {
              key: shortcutConfig.key,
              cmdOrCtrl: shortcutConfig.cmdOrCtrl,
              callback,
            };

            // Create event with correct modifiers for the platform
            const event = createMockKeyboardEvent({
              key: shortcutConfig.key,
              metaKey: shortcutConfig.cmdOrCtrl && isMac,
              ctrlKey: shortcutConfig.cmdOrCtrl && !isMac,
              shiftKey: false,
              altKey: false,
            });

            const matches = matchesShortcut(event, shortcut, isMac);

            // Property: Registered shortcut with correct modifiers SHALL match
            expect(matches).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Cmd+K on Mac SHALL trigger focus input action (Req 11.1)', () => {
      fc.assert(
        fc.property(
          fc.constant(true), // Always Mac
          () => {
            const callback = vi.fn();
            const shortcut: KeyboardShortcut = {
              key: 'k',
              cmdOrCtrl: true,
              callback,
              description: 'Focus message input',
            };

            const event = createMockKeyboardEvent({
              key: 'k',
              metaKey: true,
              ctrlKey: false,
              shiftKey: false,
              altKey: false,
            });

            const matches = matchesShortcut(event, shortcut, true);
            expect(matches).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Ctrl+K on Windows/Linux SHALL trigger focus input action (Req 11.1)', () => {
      fc.assert(
        fc.property(
          fc.constant(false), // Always Windows/Linux
          () => {
            const callback = vi.fn();
            const shortcut: KeyboardShortcut = {
              key: 'k',
              cmdOrCtrl: true,
              callback,
              description: 'Focus message input',
            };

            const event = createMockKeyboardEvent({
              key: 'k',
              metaKey: false,
              ctrlKey: true,
              shiftKey: false,
              altKey: false,
            });

            const matches = matchesShortcut(event, shortcut, false);
            expect(matches).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Cmd/Ctrl+N SHALL trigger new conversation action (Req 11.2)', () => {
      fc.assert(
        fc.property(
          platformArb,
          (isMac) => {
            const callback = vi.fn();
            const shortcut: KeyboardShortcut = {
              key: 'n',
              cmdOrCtrl: true,
              callback,
              description: 'New conversation',
            };

            const event = createMockKeyboardEvent({
              key: 'n',
              metaKey: isMac,
              ctrlKey: !isMac,
              shiftKey: false,
              altKey: false,
            });

            const matches = matchesShortcut(event, shortcut, isMac);
            expect(matches).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Cmd/Ctrl+/ SHALL trigger toggle sidebar action (Req 11.3)', () => {
      fc.assert(
        fc.property(
          platformArb,
          (isMac) => {
            const callback = vi.fn();
            const shortcut: KeyboardShortcut = {
              key: '/',
              cmdOrCtrl: true,
              callback,
              description: 'Toggle sidebar',
            };

            const event = createMockKeyboardEvent({
              key: '/',
              metaKey: isMac,
              ctrlKey: !isMac,
              shiftKey: false,
              altKey: false,
            });

            const matches = matchesShortcut(event, shortcut, isMac);
            expect(matches).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Escape SHALL trigger cancel streaming action (Req 11.4)', () => {
      fc.assert(
        fc.property(
          platformArb,
          (isMac) => {
            const callback = vi.fn();
            const shortcut: KeyboardShortcut = {
              key: 'Escape',
              cmdOrCtrl: false,
              callback,
              description: 'Cancel streaming',
            };

            const event = createMockKeyboardEvent({
              key: 'Escape',
              metaKey: false,
              ctrlKey: false,
              shiftKey: false,
              altKey: false,
            });

            const matches = matchesShortcut(event, shortcut, isMac);
            expect(matches).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Platform-specific modifier detection', () => {
    it('Cmd (metaKey) SHALL be the modifier on Mac (Req 11.1-11.3)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('k', 'n', '/'),
          (key) => {
            const event = createMockKeyboardEvent({
              key,
              metaKey: true,
              ctrlKey: false,
              shiftKey: false,
              altKey: false,
            });

            // On Mac, metaKey should be detected as Cmd/Ctrl
            expect(isCmdOrCtrlPressed(event, true)).toBe(true);
            // ctrlKey should NOT be detected as Cmd/Ctrl on Mac
            const ctrlEvent = createMockKeyboardEvent({
              key,
              metaKey: false,
              ctrlKey: true,
              shiftKey: false,
              altKey: false,
            });
            expect(isCmdOrCtrlPressed(ctrlEvent, true)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Ctrl (ctrlKey) SHALL be the modifier on Windows/Linux (Req 11.1-11.3)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('k', 'n', '/'),
          (key) => {
            const event = createMockKeyboardEvent({
              key,
              metaKey: false,
              ctrlKey: true,
              shiftKey: false,
              altKey: false,
            });

            // On Windows/Linux, ctrlKey should be detected as Cmd/Ctrl
            expect(isCmdOrCtrlPressed(event, false)).toBe(true);
            // metaKey should NOT be detected as Cmd/Ctrl on Windows/Linux
            const metaEvent = createMockKeyboardEvent({
              key,
              metaKey: true,
              ctrlKey: false,
              shiftKey: false,
              altKey: false,
            });
            expect(isCmdOrCtrlPressed(metaEvent, false)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Wrong modifiers do not trigger shortcuts', () => {
    it('Shortcuts requiring Cmd/Ctrl SHALL NOT trigger without modifier (Req 11.1-11.3)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            { key: 'k', cmdOrCtrl: true },
            { key: 'n', cmdOrCtrl: true },
            { key: '/', cmdOrCtrl: true }
          ),
          platformArb,
          (shortcutConfig, isMac) => {
            const callback = vi.fn();
            const shortcut: KeyboardShortcut = {
              key: shortcutConfig.key,
              cmdOrCtrl: shortcutConfig.cmdOrCtrl,
              callback,
            };

            // Event WITHOUT any modifier
            const event = createMockKeyboardEvent({
              key: shortcutConfig.key,
              metaKey: false,
              ctrlKey: false,
              shiftKey: false,
              altKey: false,
            });

            const matches = matchesShortcut(event, shortcut, isMac);

            // Property: Shortcut requiring Cmd/Ctrl SHALL NOT match without modifier
            expect(matches).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Shortcuts SHALL NOT trigger with wrong platform modifier (Req 11.1-11.3)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            { key: 'k', cmdOrCtrl: true },
            { key: 'n', cmdOrCtrl: true },
            { key: '/', cmdOrCtrl: true }
          ),
          platformArb,
          (shortcutConfig, isMac) => {
            const callback = vi.fn();
            const shortcut: KeyboardShortcut = {
              key: shortcutConfig.key,
              cmdOrCtrl: shortcutConfig.cmdOrCtrl,
              callback,
            };

            // Event with WRONG modifier for the platform
            const event = createMockKeyboardEvent({
              key: shortcutConfig.key,
              metaKey: !isMac, // Wrong: metaKey on Windows/Linux
              ctrlKey: isMac,  // Wrong: ctrlKey on Mac
              shiftKey: false,
              altKey: false,
            });

            const matches = matchesShortcut(event, shortcut, isMac);

            // Property: Shortcut SHALL NOT match with wrong platform modifier
            expect(matches).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Shortcuts SHALL NOT trigger with extra Alt modifier (Req 11.1-11.4)', () => {
      fc.assert(
        fc.property(
          registeredShortcutArb,
          platformArb,
          (shortcutConfig, isMac) => {
            const callback = vi.fn();
            const shortcut: KeyboardShortcut = {
              key: shortcutConfig.key,
              cmdOrCtrl: shortcutConfig.cmdOrCtrl,
              callback,
            };

            // Event with extra Alt modifier
            const event = createMockKeyboardEvent({
              key: shortcutConfig.key,
              metaKey: shortcutConfig.cmdOrCtrl && isMac,
              ctrlKey: shortcutConfig.cmdOrCtrl && !isMac,
              shiftKey: false,
              altKey: true, // Extra modifier
            });

            const matches = matchesShortcut(event, shortcut, isMac);

            // Property: Shortcut SHALL NOT match with extra Alt modifier
            expect(matches).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Escape SHALL NOT trigger with Cmd/Ctrl modifier (Req 11.4)', () => {
      fc.assert(
        fc.property(
          platformArb,
          (isMac) => {
            const callback = vi.fn();
            const shortcut: KeyboardShortcut = {
              key: 'Escape',
              cmdOrCtrl: false,
              callback,
            };

            // Escape with Cmd/Ctrl modifier (should not match)
            const event = createMockKeyboardEvent({
              key: 'Escape',
              metaKey: isMac,
              ctrlKey: !isMac,
              shiftKey: false,
              altKey: false,
            });

            const matches = matchesShortcut(event, shortcut, isMac);

            // Property: Escape without cmdOrCtrl SHALL NOT match when modifier is pressed
            expect(matches).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Disabled shortcuts do not trigger', () => {
    it('Disabled shortcuts SHALL NOT trigger even with correct modifiers (Req 11.1-11.4)', () => {
      fc.assert(
        fc.property(
          registeredShortcutArb,
          platformArb,
          (shortcutConfig, isMac) => {
            const callback = vi.fn();
            const shortcut: KeyboardShortcut = {
              key: shortcutConfig.key,
              cmdOrCtrl: shortcutConfig.cmdOrCtrl,
              callback,
              enabled: false, // Disabled
            };

            // Event with correct modifiers
            const event = createMockKeyboardEvent({
              key: shortcutConfig.key,
              metaKey: shortcutConfig.cmdOrCtrl && isMac,
              ctrlKey: shortcutConfig.cmdOrCtrl && !isMac,
              shiftKey: false,
              altKey: false,
            });

            const matches = matchesShortcut(event, shortcut, isMac);

            // Property: Disabled shortcut SHALL NOT match
            expect(matches).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Re-enabled shortcuts SHALL trigger with correct modifiers (Req 11.1-11.4)', () => {
      fc.assert(
        fc.property(
          registeredShortcutArb,
          platformArb,
          (shortcutConfig, isMac) => {
            const callback = vi.fn();
            
            // First disabled
            const disabledShortcut: KeyboardShortcut = {
              key: shortcutConfig.key,
              cmdOrCtrl: shortcutConfig.cmdOrCtrl,
              callback,
              enabled: false,
            };

            // Then enabled
            const enabledShortcut: KeyboardShortcut = {
              key: shortcutConfig.key,
              cmdOrCtrl: shortcutConfig.cmdOrCtrl,
              callback,
              enabled: true,
            };

            const event = createMockKeyboardEvent({
              key: shortcutConfig.key,
              metaKey: shortcutConfig.cmdOrCtrl && isMac,
              ctrlKey: shortcutConfig.cmdOrCtrl && !isMac,
              shiftKey: false,
              altKey: false,
            });

            // Property: Disabled should not match, enabled should match
            expect(matchesShortcut(event, disabledShortcut, isMac)).toBe(false);
            expect(matchesShortcut(event, enabledShortcut, isMac)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Non-registered keys do not trigger registered shortcuts', () => {
    it('Non-registered keys SHALL NOT trigger any registered shortcut (Req 11.1-11.4)', () => {
      fc.assert(
        fc.property(
          nonRegisteredKeyArb,
          platformArb,
          wrongModifierArb,
          (key, isMac, modifiers) => {
            // Test against all registered shortcuts
            for (const shortcutConfig of REGISTERED_SHORTCUTS) {
              const callback = vi.fn();
              const shortcut: KeyboardShortcut = {
                key: shortcutConfig.key,
                cmdOrCtrl: shortcutConfig.cmdOrCtrl,
                callback,
              };

              const event = createMockKeyboardEvent({
                key,
                ...modifiers,
              });

              const matches = matchesShortcut(event, shortcut, isMac);

              // Property: Non-registered key SHALL NOT match any registered shortcut
              expect(matches).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Key normalization', () => {
    it('Key normalization SHALL handle case variations (Req 11.1-11.3)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('k', 'K', 'n', 'N'),
          (key) => {
            const normalized = normalizeKey(key);
            // Single character keys should be returned as-is
            expect(normalized).toBe(key);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Escape key variations SHALL be normalized (Req 11.4)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('escape', 'Escape', 'esc', 'ESC'),
          (key) => {
            const normalized = normalizeKey(key);
            expect(normalized).toBe('Escape');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Case-insensitive key matching', () => {
    it('Single character shortcuts SHALL match case-insensitively (Req 11.1-11.3)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            { shortcutKey: 'k', eventKey: 'K' },
            { shortcutKey: 'K', eventKey: 'k' },
            { shortcutKey: 'n', eventKey: 'N' },
            { shortcutKey: 'N', eventKey: 'n' }
          ),
          platformArb,
          (keyPair, isMac) => {
            const callback = vi.fn();
            const shortcut: KeyboardShortcut = {
              key: keyPair.shortcutKey,
              cmdOrCtrl: true,
              callback,
            };

            const event = createMockKeyboardEvent({
              key: keyPair.eventKey,
              metaKey: isMac,
              ctrlKey: !isMac,
              shiftKey: false,
              altKey: false,
            });

            const matches = matchesShortcut(event, shortcut, isMac);

            // Property: Single character keys SHALL match case-insensitively
            expect(matches).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('All four shortcuts work together', () => {
    it('All registered shortcuts SHALL be distinguishable (Req 11.1-11.4)', () => {
      fc.assert(
        fc.property(
          platformArb,
          (isMac) => {
            const shortcuts: KeyboardShortcut[] = REGISTERED_SHORTCUTS.map(config => ({
              key: config.key,
              cmdOrCtrl: config.cmdOrCtrl,
              callback: vi.fn(),
              description: config.description,
            }));

            // Test each shortcut triggers only its own callback
            for (let i = 0; i < shortcuts.length; i++) {
              const targetShortcut = REGISTERED_SHORTCUTS[i];
              const event = createMockKeyboardEvent({
                key: targetShortcut.key,
                metaKey: targetShortcut.cmdOrCtrl && isMac,
                ctrlKey: targetShortcut.cmdOrCtrl && !isMac,
                shiftKey: false,
                altKey: false,
              });

              // Check that only the target shortcut matches
              for (let j = 0; j < shortcuts.length; j++) {
                const matches = matchesShortcut(event, shortcuts[j], isMac);
                if (i === j) {
                  expect(matches).toBe(true);
                } else {
                  expect(matches).toBe(false);
                }
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
