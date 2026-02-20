/**
 * useKeyboardShortcuts hook for registering global keyboard event listeners.
 * 
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4
 * - 11.1: WHEN the user presses Cmd/Ctrl+K, THE Claude_Desktop_UI SHALL focus the message input
 * - 11.2: WHEN the user presses Cmd/Ctrl+N, THE Claude_Desktop_UI SHALL start a new conversation
 * - 11.3: WHEN the user presses Cmd/Ctrl+/, THE Claude_Desktop_UI SHALL toggle the sidebar
 * - 11.4: WHEN the user presses Escape during streaming, THE Claude_Desktop_UI SHALL stop the current response
 * 
 * This hook provides:
 * - Global keyboard event listener registration
 * - Cmd (Mac) / Ctrl (Windows/Linux) modifier detection
 * - Support for registering multiple shortcuts with callbacks
 * - Proper cleanup on unmount
 */

import { useEffect, useCallback, useRef } from 'react';

/**
 * Represents a keyboard shortcut configuration
 */
export interface KeyboardShortcut {
  /** The key to listen for (e.g., 'k', 'n', '/', 'Escape') */
  key: string;
  /** Whether Cmd (Mac) or Ctrl (Windows/Linux) modifier is required */
  cmdOrCtrl?: boolean;
  /** Whether Shift modifier is required */
  shift?: boolean;
  /** Whether Alt/Option modifier is required */
  alt?: boolean;
  /** Callback to execute when shortcut is triggered */
  callback: () => void;
  /** Optional description for help panel */
  description?: string;
  /** Whether the shortcut is currently enabled (default: true) */
  enabled?: boolean;
}

export interface UseKeyboardShortcutsOptions {
  /** Array of shortcuts to register */
  shortcuts: KeyboardShortcut[];
  /** Whether to prevent default browser behavior for matched shortcuts (default: true) */
  preventDefault?: boolean;
  /** Whether shortcuts are globally enabled (default: true) */
  enabled?: boolean;
}

export interface UseKeyboardShortcutsReturn {
  /** Check if the current platform uses Cmd (Mac) or Ctrl (Windows/Linux) */
  isMac: boolean;
  /** Get the modifier key label for the current platform */
  modifierKey: string;
  /** Get a formatted shortcut string (e.g., "⌘K" or "Ctrl+K") */
  formatShortcut: (shortcut: KeyboardShortcut) => string;
}

/**
 * Detects if the current platform is macOS
 */
export function detectIsMac(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  return navigator.platform?.toLowerCase().includes('mac') || 
         navigator.userAgent?.toLowerCase().includes('mac');
}

/**
 * Checks if the Cmd (Mac) or Ctrl (Windows/Linux) modifier is pressed
 */
export function isCmdOrCtrlPressed(event: KeyboardEvent, isMac: boolean): boolean {
  return isMac ? event.metaKey : event.ctrlKey;
}

/**
 * Normalizes a key for comparison (handles case sensitivity and special keys)
 */
export function normalizeKey(key: string): string {
  // Handle special key names
  const specialKeys: Record<string, string> = {
    'escape': 'Escape',
    'esc': 'Escape',
    'enter': 'Enter',
    'return': 'Enter',
    'tab': 'Tab',
    'space': ' ',
    'backspace': 'Backspace',
    'delete': 'Delete',
    'arrowup': 'ArrowUp',
    'arrowdown': 'ArrowDown',
    'arrowleft': 'ArrowLeft',
    'arrowright': 'ArrowRight',
  };
  
  const lowerKey = key.toLowerCase();
  return specialKeys[lowerKey] || key;
}

/**
 * Checks if a keyboard event matches a shortcut configuration
 */
export function matchesShortcut(
  event: KeyboardEvent, 
  shortcut: KeyboardShortcut, 
  isMac: boolean
): boolean {
  // Check if shortcut is enabled
  if (shortcut.enabled === false) {
    return false;
  }

  // Normalize the key for comparison
  const normalizedShortcutKey = normalizeKey(shortcut.key);
  const eventKey = event.key;
  
  // Check key match (case-insensitive for single characters)
  const keyMatches = normalizedShortcutKey.length === 1
    ? eventKey.toLowerCase() === normalizedShortcutKey.toLowerCase()
    : eventKey === normalizedShortcutKey;
  
  if (!keyMatches) {
    return false;
  }

  // Check Cmd/Ctrl modifier
  if (shortcut.cmdOrCtrl) {
    if (!isCmdOrCtrlPressed(event, isMac)) {
      return false;
    }
  } else {
    // If cmdOrCtrl is not required, make sure neither is pressed
    if (event.metaKey || event.ctrlKey) {
      return false;
    }
  }

  // Check Shift modifier
  if (shortcut.shift) {
    if (!event.shiftKey) {
      return false;
    }
  } else {
    // If shift is not required, make sure it's not pressed
    // Exception: allow shift for special characters like '?' which require shift
    if (event.shiftKey && !['?', '/', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '+'].includes(event.key)) {
      return false;
    }
  }

  // Check Alt modifier
  if (shortcut.alt) {
    if (!event.altKey) {
      return false;
    }
  } else {
    if (event.altKey) {
      return false;
    }
  }

  return true;
}

/**
 * Hook for registering global keyboard shortcuts
 */
export function useKeyboardShortcuts(
  options: UseKeyboardShortcutsOptions
): UseKeyboardShortcutsReturn {
  const { shortcuts, preventDefault = true, enabled = true } = options;
  
  // Detect platform on each render (detectIsMac is cheap)
  const isMac = detectIsMac();

  // Store shortcuts in a ref to avoid re-registering on every render
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  // Store enabled state in a ref
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // Store preventDefault in a ref
  const preventDefaultRef = useRef(preventDefault);
  preventDefaultRef.current = preventDefault;

  // Store isMac in a ref for the callback
  const isMacRef = useRef(isMac);
  isMacRef.current = isMac;

  // Handle keydown events
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Skip if shortcuts are globally disabled
    if (!enabledRef.current) {
      return;
    }

    // Skip if the event target is an input, textarea, or contenteditable
    // unless it's the Escape key (which should always work)
    const target = event.target as HTMLElement;
    const isInputElement = 
      target.tagName === 'INPUT' || 
      target.tagName === 'TEXTAREA' || 
      target.isContentEditable;
    
    // Find matching shortcut
    for (const shortcut of shortcutsRef.current) {
      if (matchesShortcut(event, shortcut, isMacRef.current)) {
        // For Escape key, always allow it even in input elements
        // For other shortcuts with cmdOrCtrl, allow them in input elements
        // For shortcuts without modifiers, skip if in input element
        if (isInputElement && !shortcut.cmdOrCtrl && shortcut.key !== 'Escape') {
          continue;
        }

        if (preventDefaultRef.current) {
          event.preventDefault();
          event.stopPropagation();
        }
        
        shortcut.callback();
        return;
      }
    }
  }, []);

  // Register event listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Format shortcut for display
  const formatShortcut = useCallback((shortcut: KeyboardShortcut): string => {
    const parts: string[] = [];
    
    if (shortcut.cmdOrCtrl) {
      parts.push(isMac ? '⌘' : 'Ctrl');
    }
    if (shortcut.shift) {
      parts.push(isMac ? '⇧' : 'Shift');
    }
    if (shortcut.alt) {
      parts.push(isMac ? '⌥' : 'Alt');
    }
    
    // Format the key
    let keyDisplay = shortcut.key;
    if (keyDisplay === 'Escape') {
      keyDisplay = 'Esc';
    } else if (keyDisplay.length === 1) {
      keyDisplay = keyDisplay.toUpperCase();
    }
    parts.push(keyDisplay);
    
    return isMac ? parts.join('') : parts.join('+');
  }, [isMac]);

  return {
    isMac,
    modifierKey: isMac ? '⌘' : 'Ctrl',
    formatShortcut,
  };
}

export default useKeyboardShortcuts;
