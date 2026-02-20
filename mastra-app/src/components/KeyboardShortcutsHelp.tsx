'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { KeyboardShortcut, detectIsMac } from '@/hooks/useKeyboardShortcuts';

export interface KeyboardShortcutsHelpProps {
  /** Whether the help panel is open */
  isOpen: boolean;
  /** Callback to close the help panel */
  onClose: () => void;
  /** Array of shortcuts to display */
  shortcuts: KeyboardShortcut[];
}

/**
 * Formats a keyboard shortcut for display with platform-appropriate modifier keys.
 * 
 * @param shortcut - The shortcut configuration
 * @param isMac - Whether the current platform is macOS
 * @returns Formatted shortcut string (e.g., "⌘K" on Mac, "Ctrl+K" on Windows/Linux)
 */
export function formatShortcutForDisplay(shortcut: KeyboardShortcut, isMac: boolean): string {
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
  
  // Format the key for display
  let keyDisplay = shortcut.key;
  if (keyDisplay === 'Escape') {
    keyDisplay = 'Esc';
  } else if (keyDisplay.length === 1) {
    keyDisplay = keyDisplay.toUpperCase();
  }
  parts.push(keyDisplay);
  
  return isMac ? parts.join('') : parts.join('+');
}

/**
 * Groups shortcuts by category for organized display.
 * Shortcuts without descriptions are filtered out.
 */
interface ShortcutGroup {
  title: string;
  shortcuts: Array<{
    shortcut: KeyboardShortcut;
    formattedKey: string;
  }>;
}

/**
 * KeyboardShortcutsHelp component displays all available keyboard shortcuts
 * in a modal overlay.
 * 
 * Validates: Requirement 11.5
 * THE Claude_Desktop_UI SHALL display a keyboard shortcuts help panel accessible via Cmd/Ctrl+?
 */
export function KeyboardShortcutsHelp({ isOpen, onClose, shortcuts }: KeyboardShortcutsHelpProps) {
  const isMac = detectIsMac();

  // Handle Escape key to close
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  // Handle backdrop click
  const handleBackdropClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }, [onClose]);

  // Format and filter shortcuts for display
  const displayShortcuts = useMemo(() => {
    return shortcuts
      .filter(s => s.description) // Only show shortcuts with descriptions
      .map(s => ({
        shortcut: s,
        formattedKey: formatShortcutForDisplay(s, isMac),
      }));
  }, [shortcuts, isMac]);

  // Group shortcuts by category
  const shortcutGroups: ShortcutGroup[] = useMemo(() => {
    // For now, we'll put all shortcuts in a single "General" group
    // This can be extended later to support categories
    return [
      {
        title: 'General',
        shortcuts: displayShortcuts,
      },
    ];
  }, [displayShortcuts]);

  if (!isOpen) return null;

  return (
    <div
      className="keyboard-shortcuts-backdrop fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={handleBackdropClick}
      data-testid="keyboard-shortcuts-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-shortcuts-title"
    >
      <div
        className="keyboard-shortcuts-modal relative w-full max-w-md rounded-xl shadow-2xl overflow-hidden"
        style={{ 
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
        }}
        data-testid="keyboard-shortcuts-modal"
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border-color)' }}
        >
          <h2 
            id="keyboard-shortcuts-title"
            className="text-lg font-semibold flex items-center gap-2"
            style={{ color: 'var(--text-primary)' }}
          >
            <KeyboardIcon />
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="keyboard-shortcuts-close-btn p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            aria-label="Close keyboard shortcuts help"
            data-testid="keyboard-shortcuts-close-btn"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {shortcutGroups.map((group) => (
            <div key={group.title} className="mb-4 last:mb-0">
              <h3 
                className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: 'var(--text-muted)' }}
              >
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map(({ shortcut, formattedKey }) => (
                  <div
                    key={shortcut.key + (shortcut.cmdOrCtrl ? '-cmd' : '')}
                    className="flex items-center justify-between py-2 px-3 rounded-lg"
                    style={{ background: 'var(--bg-secondary)' }}
                    data-testid={`shortcut-item-${shortcut.key}`}
                  >
                    <span 
                      className="text-sm"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {shortcut.description}
                    </span>
                    <kbd
                      className="px-2 py-1 text-xs font-mono rounded"
                      style={{ 
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-secondary)',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                      }}
                    >
                      {formattedKey}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {displayShortcuts.length === 0 && (
            <p 
              className="text-sm text-center py-4"
              style={{ color: 'var(--text-muted)' }}
            >
              No keyboard shortcuts available.
            </p>
          )}
        </div>

        {/* Footer */}
        <div 
          className="px-6 py-3 text-center"
          style={{ 
            borderTop: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)',
          }}
        >
          <p 
            className="text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            Press <kbd 
              className="px-1.5 py-0.5 text-xs font-mono rounded mx-1"
              style={{ 
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
              }}
            >
              Esc
            </kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Keyboard icon component
 */
function KeyboardIcon() {
  return (
    <svg 
      className="w-5 h-5" 
      fill="none" 
      viewBox="0 0 24 24" 
      stroke="currentColor" 
      strokeWidth={2}
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" 
      />
    </svg>
  );
}

export default KeyboardShortcutsHelp;
