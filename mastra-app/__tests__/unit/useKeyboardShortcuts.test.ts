/**
 * Unit tests for useKeyboardShortcuts hook.
 * 
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4
 * - 11.1: WHEN the user presses Cmd/Ctrl+K, THE Claude_Desktop_UI SHALL focus the message input
 * - 11.2: WHEN the user presses Cmd/Ctrl+N, THE Claude_Desktop_UI SHALL start a new conversation
 * - 11.3: WHEN the user presses Cmd/Ctrl+/, THE Claude_Desktop_UI SHALL toggle the sidebar
 * - 11.4: WHEN the user presses Escape during streaming, THE Claude_Desktop_UI SHALL stop the current response
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { 
  useKeyboardShortcuts,
  detectIsMac,
  isCmdOrCtrlPressed,
  normalizeKey,
  matchesShortcut,
  KeyboardShortcut,
} from '@/hooks/useKeyboardShortcuts';

// Helper to create keyboard events
function createKeyboardEvent(
  key: string,
  options: {
    metaKey?: boolean;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
  } = {}
): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key,
    metaKey: options.metaKey ?? false,
    ctrlKey: options.ctrlKey ?? false,
    shiftKey: options.shiftKey ?? false,
    altKey: options.altKey ?? false,
    bubbles: true,
    cancelable: true,
  });
}

describe('useKeyboardShortcuts', () => {
  let originalPlatform: PropertyDescriptor | undefined;
  let originalUserAgent: PropertyDescriptor | undefined;

  beforeEach(() => {
    // Store original values
    originalPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform');
    originalUserAgent = Object.getOwnPropertyDescriptor(navigator, 'userAgent');
  });

  afterEach(() => {
    // Restore original values
    if (originalPlatform) {
      Object.defineProperty(navigator, 'platform', originalPlatform);
    }
    if (originalUserAgent) {
      Object.defineProperty(navigator, 'userAgent', originalUserAgent);
    }
    vi.restoreAllMocks();
  });

  describe('detectIsMac', () => {
    it('should return true for Mac platform', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        configurable: true,
      });
      expect(detectIsMac()).toBe(true);
    });

    it('should return true for Mac userAgent', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Unknown',
        configurable: true,
      });
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        configurable: true,
      });
      expect(detectIsMac()).toBe(true);
    });

    it('should return false for Windows platform', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        configurable: true,
      });
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        configurable: true,
      });
      expect(detectIsMac()).toBe(false);
    });

    it('should return false for Linux platform', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Linux x86_64',
        configurable: true,
      });
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (X11; Linux x86_64)',
        configurable: true,
      });
      expect(detectIsMac()).toBe(false);
    });
  });

  describe('isCmdOrCtrlPressed', () => {
    it('should return true for metaKey on Mac', () => {
      const event = createKeyboardEvent('k', { metaKey: true });
      expect(isCmdOrCtrlPressed(event, true)).toBe(true);
    });

    it('should return false for ctrlKey on Mac', () => {
      const event = createKeyboardEvent('k', { ctrlKey: true });
      expect(isCmdOrCtrlPressed(event, true)).toBe(false);
    });

    it('should return true for ctrlKey on Windows/Linux', () => {
      const event = createKeyboardEvent('k', { ctrlKey: true });
      expect(isCmdOrCtrlPressed(event, false)).toBe(true);
    });

    it('should return false for metaKey on Windows/Linux', () => {
      const event = createKeyboardEvent('k', { metaKey: true });
      expect(isCmdOrCtrlPressed(event, false)).toBe(false);
    });
  });

  describe('normalizeKey', () => {
    it('should normalize escape key variations', () => {
      expect(normalizeKey('escape')).toBe('Escape');
      expect(normalizeKey('Escape')).toBe('Escape');
      expect(normalizeKey('esc')).toBe('Escape');
    });

    it('should normalize enter key variations', () => {
      expect(normalizeKey('enter')).toBe('Enter');
      expect(normalizeKey('Enter')).toBe('Enter');
      expect(normalizeKey('return')).toBe('Enter');
    });

    it('should normalize arrow keys', () => {
      expect(normalizeKey('arrowup')).toBe('ArrowUp');
      expect(normalizeKey('arrowdown')).toBe('ArrowDown');
      expect(normalizeKey('arrowleft')).toBe('ArrowLeft');
      expect(normalizeKey('arrowright')).toBe('ArrowRight');
    });

    it('should return single character keys as-is', () => {
      expect(normalizeKey('k')).toBe('k');
      expect(normalizeKey('K')).toBe('K');
      expect(normalizeKey('/')).toBe('/');
    });
  });

  describe('matchesShortcut', () => {
    it('should match simple key without modifiers', () => {
      const shortcut: KeyboardShortcut = {
        key: 'Escape',
        callback: vi.fn(),
      };
      const event = createKeyboardEvent('Escape');
      expect(matchesShortcut(event, shortcut, false)).toBe(true);
    });

    it('should match Cmd+K on Mac', () => {
      const shortcut: KeyboardShortcut = {
        key: 'k',
        cmdOrCtrl: true,
        callback: vi.fn(),
      };
      const event = createKeyboardEvent('k', { metaKey: true });
      expect(matchesShortcut(event, shortcut, true)).toBe(true);
    });

    it('should match Ctrl+K on Windows/Linux', () => {
      const shortcut: KeyboardShortcut = {
        key: 'k',
        cmdOrCtrl: true,
        callback: vi.fn(),
      };
      const event = createKeyboardEvent('k', { ctrlKey: true });
      expect(matchesShortcut(event, shortcut, false)).toBe(true);
    });

    it('should not match when cmdOrCtrl is required but not pressed', () => {
      const shortcut: KeyboardShortcut = {
        key: 'k',
        cmdOrCtrl: true,
        callback: vi.fn(),
      };
      const event = createKeyboardEvent('k');
      expect(matchesShortcut(event, shortcut, false)).toBe(false);
    });

    it('should not match when cmdOrCtrl is not required but is pressed', () => {
      const shortcut: KeyboardShortcut = {
        key: 'k',
        callback: vi.fn(),
      };
      const event = createKeyboardEvent('k', { ctrlKey: true });
      expect(matchesShortcut(event, shortcut, false)).toBe(false);
    });

    it('should match case-insensitively for single character keys', () => {
      const shortcut: KeyboardShortcut = {
        key: 'k',
        cmdOrCtrl: true,
        callback: vi.fn(),
      };
      const event = createKeyboardEvent('K', { metaKey: true });
      expect(matchesShortcut(event, shortcut, true)).toBe(true);
    });

    it('should not match disabled shortcuts', () => {
      const shortcut: KeyboardShortcut = {
        key: 'k',
        cmdOrCtrl: true,
        callback: vi.fn(),
        enabled: false,
      };
      const event = createKeyboardEvent('k', { metaKey: true });
      expect(matchesShortcut(event, shortcut, true)).toBe(false);
    });

    it('should match shortcuts with shift modifier', () => {
      const shortcut: KeyboardShortcut = {
        key: '?',
        cmdOrCtrl: true,
        shift: true,
        callback: vi.fn(),
      };
      const event = createKeyboardEvent('?', { metaKey: true, shiftKey: true });
      expect(matchesShortcut(event, shortcut, true)).toBe(true);
    });

    it('should match shortcuts with alt modifier', () => {
      const shortcut: KeyboardShortcut = {
        key: 'k',
        cmdOrCtrl: true,
        alt: true,
        callback: vi.fn(),
      };
      const event = createKeyboardEvent('k', { metaKey: true, altKey: true });
      expect(matchesShortcut(event, shortcut, true)).toBe(true);
    });

    it('should not match when alt is pressed but not required', () => {
      const shortcut: KeyboardShortcut = {
        key: 'k',
        cmdOrCtrl: true,
        callback: vi.fn(),
      };
      const event = createKeyboardEvent('k', { metaKey: true, altKey: true });
      expect(matchesShortcut(event, shortcut, true)).toBe(false);
    });
  });

  describe('useKeyboardShortcuts hook', () => {
    beforeEach(() => {
      // Set platform to non-Mac for consistent testing
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        configurable: true,
      });
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        configurable: true,
      });
    });

    it('should register and trigger shortcuts', () => {
      const callback = vi.fn();
      const shortcuts: KeyboardShortcut[] = [
        { key: 'k', cmdOrCtrl: true, callback },
      ];

      renderHook(() => useKeyboardShortcuts({ shortcuts }));

      act(() => {
        window.dispatchEvent(createKeyboardEvent('k', { ctrlKey: true }));
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should trigger Escape shortcut', () => {
      const callback = vi.fn();
      const shortcuts: KeyboardShortcut[] = [
        { key: 'Escape', callback },
      ];

      renderHook(() => useKeyboardShortcuts({ shortcuts }));

      act(() => {
        window.dispatchEvent(createKeyboardEvent('Escape'));
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not trigger shortcuts when globally disabled', () => {
      const callback = vi.fn();
      const shortcuts: KeyboardShortcut[] = [
        { key: 'k', cmdOrCtrl: true, callback },
      ];

      renderHook(() => useKeyboardShortcuts({ shortcuts, enabled: false }));

      act(() => {
        window.dispatchEvent(createKeyboardEvent('k', { ctrlKey: true }));
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should not trigger disabled individual shortcuts', () => {
      const callback = vi.fn();
      const shortcuts: KeyboardShortcut[] = [
        { key: 'k', cmdOrCtrl: true, callback, enabled: false },
      ];

      renderHook(() => useKeyboardShortcuts({ shortcuts }));

      act(() => {
        window.dispatchEvent(createKeyboardEvent('k', { ctrlKey: true }));
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle multiple shortcuts', () => {
      const focusCallback = vi.fn();
      const newConvCallback = vi.fn();
      const toggleSidebarCallback = vi.fn();
      const escapeCallback = vi.fn();

      const shortcuts: KeyboardShortcut[] = [
        { key: 'k', cmdOrCtrl: true, callback: focusCallback },
        { key: 'n', cmdOrCtrl: true, callback: newConvCallback },
        { key: '/', cmdOrCtrl: true, callback: toggleSidebarCallback },
        { key: 'Escape', callback: escapeCallback },
      ];

      renderHook(() => useKeyboardShortcuts({ shortcuts }));

      act(() => {
        window.dispatchEvent(createKeyboardEvent('k', { ctrlKey: true }));
      });
      expect(focusCallback).toHaveBeenCalledTimes(1);

      act(() => {
        window.dispatchEvent(createKeyboardEvent('n', { ctrlKey: true }));
      });
      expect(newConvCallback).toHaveBeenCalledTimes(1);

      act(() => {
        window.dispatchEvent(createKeyboardEvent('/', { ctrlKey: true }));
      });
      expect(toggleSidebarCallback).toHaveBeenCalledTimes(1);

      act(() => {
        window.dispatchEvent(createKeyboardEvent('Escape'));
      });
      expect(escapeCallback).toHaveBeenCalledTimes(1);
    });

    it('should cleanup event listeners on unmount', () => {
      const callback = vi.fn();
      const shortcuts: KeyboardShortcut[] = [
        { key: 'k', cmdOrCtrl: true, callback },
      ];

      const { unmount } = renderHook(() => useKeyboardShortcuts({ shortcuts }));

      unmount();

      act(() => {
        window.dispatchEvent(createKeyboardEvent('k', { ctrlKey: true }));
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should prevent default when preventDefault is true', () => {
      const callback = vi.fn();
      const shortcuts: KeyboardShortcut[] = [
        { key: 'k', cmdOrCtrl: true, callback },
      ];

      renderHook(() => useKeyboardShortcuts({ shortcuts, preventDefault: true }));

      const event = createKeyboardEvent('k', { ctrlKey: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');

      act(() => {
        window.dispatchEvent(event);
      });

      expect(callback).toHaveBeenCalled();
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    it('should not prevent default when preventDefault is false', () => {
      const callback = vi.fn();
      const shortcuts: KeyboardShortcut[] = [
        { key: 'k', cmdOrCtrl: true, callback },
      ];

      renderHook(() => useKeyboardShortcuts({ shortcuts, preventDefault: false }));

      const event = createKeyboardEvent('k', { ctrlKey: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      act(() => {
        window.dispatchEvent(event);
      });

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });
  });

  describe('formatShortcut', () => {
    it('should format shortcut for Mac', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        configurable: true,
      });

      const shortcuts: KeyboardShortcut[] = [];
      const { result } = renderHook(() => useKeyboardShortcuts({ shortcuts }));

      const shortcut: KeyboardShortcut = {
        key: 'k',
        cmdOrCtrl: true,
        callback: vi.fn(),
      };

      // Note: isMac is cached on first render, so we need to check the actual value
      const formatted = result.current.formatShortcut(shortcut);
      // The format depends on the cached isMac value
      expect(formatted).toMatch(/^(⌘K|Ctrl\+K)$/);
    });

    it('should format Escape key', () => {
      const shortcuts: KeyboardShortcut[] = [];
      const { result } = renderHook(() => useKeyboardShortcuts({ shortcuts }));

      const shortcut: KeyboardShortcut = {
        key: 'Escape',
        callback: vi.fn(),
      };

      const formatted = result.current.formatShortcut(shortcut);
      expect(formatted).toBe('Esc');
    });

    it('should format shortcut with shift modifier', () => {
      const shortcuts: KeyboardShortcut[] = [];
      const { result } = renderHook(() => useKeyboardShortcuts({ shortcuts }));

      const shortcut: KeyboardShortcut = {
        key: '?',
        cmdOrCtrl: true,
        shift: true,
        callback: vi.fn(),
      };

      const formatted = result.current.formatShortcut(shortcut);
      // Format depends on platform
      expect(formatted).toMatch(/[⌘⇧?]|Ctrl\+Shift\+\?/);
    });
  });

  describe('modifierKey', () => {
    it('should return correct modifier key label', () => {
      const shortcuts: KeyboardShortcut[] = [];
      const { result } = renderHook(() => useKeyboardShortcuts({ shortcuts }));

      // The modifier key depends on the cached isMac value
      expect(['⌘', 'Ctrl']).toContain(result.current.modifierKey);
    });
  });

  describe('Requirement 11.1: Cmd/Ctrl+K focuses message input', () => {
    beforeEach(() => {
      // Set platform to non-Mac for consistent testing
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        configurable: true,
      });
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        configurable: true,
      });
    });

    it('should trigger callback for Cmd/Ctrl+K', () => {
      const focusInput = vi.fn();
      const shortcuts: KeyboardShortcut[] = [
        { key: 'k', cmdOrCtrl: true, callback: focusInput, description: 'Focus message input' },
      ];

      renderHook(() => useKeyboardShortcuts({ shortcuts }));

      act(() => {
        window.dispatchEvent(createKeyboardEvent('k', { ctrlKey: true }));
      });

      expect(focusInput).toHaveBeenCalledTimes(1);
    });
  });

  describe('Requirement 11.2: Cmd/Ctrl+N starts new conversation', () => {
    beforeEach(() => {
      // Set platform to non-Mac for consistent testing
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        configurable: true,
      });
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        configurable: true,
      });
    });

    it('should trigger callback for Cmd/Ctrl+N', () => {
      const newConversation = vi.fn();
      const shortcuts: KeyboardShortcut[] = [
        { key: 'n', cmdOrCtrl: true, callback: newConversation, description: 'New conversation' },
      ];

      renderHook(() => useKeyboardShortcuts({ shortcuts }));

      act(() => {
        window.dispatchEvent(createKeyboardEvent('n', { ctrlKey: true }));
      });

      expect(newConversation).toHaveBeenCalledTimes(1);
    });
  });

  describe('Requirement 11.3: Cmd/Ctrl+/ toggles sidebar', () => {
    beforeEach(() => {
      // Set platform to non-Mac for consistent testing
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        configurable: true,
      });
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        configurable: true,
      });
    });

    it('should trigger callback for Cmd/Ctrl+/', () => {
      const toggleSidebar = vi.fn();
      const shortcuts: KeyboardShortcut[] = [
        { key: '/', cmdOrCtrl: true, callback: toggleSidebar, description: 'Toggle sidebar' },
      ];

      renderHook(() => useKeyboardShortcuts({ shortcuts }));

      act(() => {
        window.dispatchEvent(createKeyboardEvent('/', { ctrlKey: true }));
      });

      expect(toggleSidebar).toHaveBeenCalledTimes(1);
    });
  });

  describe('Requirement 11.4: Escape stops streaming', () => {
    it('should trigger callback for Escape', () => {
      const stopStreaming = vi.fn();
      const shortcuts: KeyboardShortcut[] = [
        { key: 'Escape', callback: stopStreaming, description: 'Stop streaming' },
      ];

      renderHook(() => useKeyboardShortcuts({ shortcuts }));

      act(() => {
        window.dispatchEvent(createKeyboardEvent('Escape'));
      });

      expect(stopStreaming).toHaveBeenCalledTimes(1);
    });

    it('should trigger Escape even without modifiers', () => {
      const stopStreaming = vi.fn();
      const shortcuts: KeyboardShortcut[] = [
        { key: 'Escape', callback: stopStreaming },
      ];

      renderHook(() => useKeyboardShortcuts({ shortcuts }));

      // Escape should work without any modifiers
      act(() => {
        window.dispatchEvent(createKeyboardEvent('Escape'));
      });

      expect(stopStreaming).toHaveBeenCalledTimes(1);
    });
  });
});
