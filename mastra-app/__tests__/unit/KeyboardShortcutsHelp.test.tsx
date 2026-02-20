/**
 * Unit tests for KeyboardShortcutsHelp component
 * 
 * Validates: Requirement 11.5
 * THE Claude_Desktop_UI SHALL display a keyboard shortcuts help panel accessible via Cmd/Ctrl+?
 */

import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KeyboardShortcutsHelp, formatShortcutForDisplay } from '@/components/KeyboardShortcutsHelp';
import { KeyboardShortcut } from '@/hooks/useKeyboardShortcuts';

// Mock detectIsMac to control platform detection in tests
vi.mock('@/hooks/useKeyboardShortcuts', async () => {
  const actual = await vi.importActual('@/hooks/useKeyboardShortcuts');
  return {
    ...actual,
    detectIsMac: vi.fn(() => false), // Default to non-Mac
  };
});

import { detectIsMac } from '@/hooks/useKeyboardShortcuts';

const mockDetectIsMac = detectIsMac as ReturnType<typeof vi.fn>;

describe('KeyboardShortcutsHelp', () => {
  const mockOnClose = vi.fn();
  
  const sampleShortcuts: KeyboardShortcut[] = [
    {
      key: 'k',
      cmdOrCtrl: true,
      callback: vi.fn(),
      description: 'Focus message input',
    },
    {
      key: 'n',
      cmdOrCtrl: true,
      callback: vi.fn(),
      description: 'New conversation',
    },
    {
      key: '/',
      cmdOrCtrl: true,
      callback: vi.fn(),
      description: 'Toggle sidebar',
    },
    {
      key: 'Escape',
      callback: vi.fn(),
      description: 'Cancel streaming',
    },
    {
      key: '?',
      cmdOrCtrl: true,
      shift: true,
      callback: vi.fn(),
      description: 'Show keyboard shortcuts',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockDetectIsMac.mockReturnValue(false);
    document.body.style.overflow = '';
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      const { container } = render(
        <KeyboardShortcutsHelp
          isOpen={false}
          onClose={mockOnClose}
          shortcuts={sampleShortcuts}
        />
      );

      expect(container.querySelector('.keyboard-shortcuts-modal')).toBeFalsy();
    });

    it('should render when isOpen is true', () => {
      const { container } = render(
        <KeyboardShortcutsHelp
          isOpen={true}
          onClose={mockOnClose}
          shortcuts={sampleShortcuts}
        />
      );

      expect(container.querySelector('.keyboard-shortcuts-modal')).toBeTruthy();
      expect(screen.getByText('Keyboard Shortcuts')).toBeTruthy();
    });

    it('should display all shortcuts with descriptions', () => {
      render(
        <KeyboardShortcutsHelp
          isOpen={true}
          onClose={mockOnClose}
          shortcuts={sampleShortcuts}
        />
      );

      expect(screen.getByText('Focus message input')).toBeTruthy();
      expect(screen.getByText('New conversation')).toBeTruthy();
      expect(screen.getByText('Toggle sidebar')).toBeTruthy();
      expect(screen.getByText('Cancel streaming')).toBeTruthy();
      expect(screen.getByText('Show keyboard shortcuts')).toBeTruthy();
    });

    it('should filter out shortcuts without descriptions', () => {
      const shortcutsWithoutDescription: KeyboardShortcut[] = [
        {
          key: 'k',
          cmdOrCtrl: true,
          callback: vi.fn(),
          description: 'Focus input',
        },
        {
          key: 'x',
          cmdOrCtrl: true,
          callback: vi.fn(),
          // No description
        },
      ];

      const { container } = render(
        <KeyboardShortcutsHelp
          isOpen={true}
          onClose={mockOnClose}
          shortcuts={shortcutsWithoutDescription}
        />
      );

      expect(screen.getByText('Focus input')).toBeTruthy();
      // The shortcut without description should not be rendered
      expect(container.querySelectorAll('[data-testid^="shortcut-item-"]').length).toBe(1);
    });

    it('should show empty state when no shortcuts have descriptions', () => {
      const shortcutsWithoutDescriptions: KeyboardShortcut[] = [
        { key: 'a', callback: vi.fn() },
        { key: 'b', callback: vi.fn() },
      ];

      render(
        <KeyboardShortcutsHelp
          isOpen={true}
          onClose={mockOnClose}
          shortcuts={shortcutsWithoutDescriptions}
        />
      );

      expect(screen.getByText('No keyboard shortcuts available.')).toBeTruthy();
    });
  });

  describe('Platform-specific formatting', () => {
    it('should display Windows/Linux format when not on Mac', () => {
      mockDetectIsMac.mockReturnValue(false);

      render(
        <KeyboardShortcutsHelp
          isOpen={true}
          onClose={mockOnClose}
          shortcuts={sampleShortcuts}
        />
      );

      // Check for Ctrl+ format
      expect(screen.getByText('Ctrl+K')).toBeTruthy();
      expect(screen.getByText('Ctrl+N')).toBeTruthy();
    });

    it('should display Mac format when on Mac', () => {
      mockDetectIsMac.mockReturnValue(true);

      render(
        <KeyboardShortcutsHelp
          isOpen={true}
          onClose={mockOnClose}
          shortcuts={sampleShortcuts}
        />
      );

      // Check for ⌘ format
      expect(screen.getByText('⌘K')).toBeTruthy();
      expect(screen.getByText('⌘N')).toBeTruthy();
    });
  });

  describe('Closing behavior', () => {
    it('should call onClose when close button is clicked', () => {
      render(
        <KeyboardShortcutsHelp
          isOpen={true}
          onClose={mockOnClose}
          shortcuts={sampleShortcuts}
        />
      );

      fireEvent.click(screen.getByTestId('keyboard-shortcuts-close-btn'));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop is clicked', () => {
      render(
        <KeyboardShortcutsHelp
          isOpen={true}
          onClose={mockOnClose}
          shortcuts={sampleShortcuts}
        />
      );

      fireEvent.click(screen.getByTestId('keyboard-shortcuts-backdrop'));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when modal content is clicked', () => {
      render(
        <KeyboardShortcutsHelp
          isOpen={true}
          onClose={mockOnClose}
          shortcuts={sampleShortcuts}
        />
      );

      fireEvent.click(screen.getByTestId('keyboard-shortcuts-modal'));
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should call onClose when Escape key is pressed', () => {
      render(
        <KeyboardShortcutsHelp
          isOpen={true}
          onClose={mockOnClose}
          shortcuts={sampleShortcuts}
        />
      );

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <KeyboardShortcutsHelp
          isOpen={true}
          onClose={mockOnClose}
          shortcuts={sampleShortcuts}
        />
      );

      const backdrop = screen.getByTestId('keyboard-shortcuts-backdrop');
      expect(backdrop.getAttribute('role')).toBe('dialog');
      expect(backdrop.getAttribute('aria-modal')).toBe('true');
      expect(backdrop.getAttribute('aria-labelledby')).toBe('keyboard-shortcuts-title');
    });

    it('should have accessible close button', () => {
      render(
        <KeyboardShortcutsHelp
          isOpen={true}
          onClose={mockOnClose}
          shortcuts={sampleShortcuts}
        />
      );

      const closeButton = screen.getByTestId('keyboard-shortcuts-close-btn');
      expect(closeButton.getAttribute('aria-label')).toBe('Close keyboard shortcuts help');
    });
  });
});

describe('formatShortcutForDisplay', () => {
  describe('Windows/Linux format (isMac = false)', () => {
    it('should format simple key with Ctrl modifier', () => {
      const shortcut: KeyboardShortcut = {
        key: 'k',
        cmdOrCtrl: true,
        callback: vi.fn(),
      };
      expect(formatShortcutForDisplay(shortcut, false)).toBe('Ctrl+K');
    });

    it('should format key with Shift modifier', () => {
      const shortcut: KeyboardShortcut = {
        key: '?',
        cmdOrCtrl: true,
        shift: true,
        callback: vi.fn(),
      };
      expect(formatShortcutForDisplay(shortcut, false)).toBe('Ctrl+Shift+?');
    });

    it('should format key with Alt modifier', () => {
      const shortcut: KeyboardShortcut = {
        key: 'a',
        cmdOrCtrl: true,
        alt: true,
        callback: vi.fn(),
      };
      expect(formatShortcutForDisplay(shortcut, false)).toBe('Ctrl+Alt+A');
    });

    it('should format Escape key', () => {
      const shortcut: KeyboardShortcut = {
        key: 'Escape',
        callback: vi.fn(),
      };
      expect(formatShortcutForDisplay(shortcut, false)).toBe('Esc');
    });

    it('should format key without modifiers', () => {
      const shortcut: KeyboardShortcut = {
        key: '/',
        callback: vi.fn(),
      };
      expect(formatShortcutForDisplay(shortcut, false)).toBe('/');
    });
  });

  describe('Mac format (isMac = true)', () => {
    it('should format simple key with Cmd modifier', () => {
      const shortcut: KeyboardShortcut = {
        key: 'k',
        cmdOrCtrl: true,
        callback: vi.fn(),
      };
      expect(formatShortcutForDisplay(shortcut, true)).toBe('⌘K');
    });

    it('should format key with Shift modifier', () => {
      const shortcut: KeyboardShortcut = {
        key: '?',
        cmdOrCtrl: true,
        shift: true,
        callback: vi.fn(),
      };
      expect(formatShortcutForDisplay(shortcut, true)).toBe('⌘⇧?');
    });

    it('should format key with Option modifier', () => {
      const shortcut: KeyboardShortcut = {
        key: 'a',
        cmdOrCtrl: true,
        alt: true,
        callback: vi.fn(),
      };
      expect(formatShortcutForDisplay(shortcut, true)).toBe('⌘⌥A');
    });

    it('should format Escape key', () => {
      const shortcut: KeyboardShortcut = {
        key: 'Escape',
        callback: vi.fn(),
      };
      expect(formatShortcutForDisplay(shortcut, true)).toBe('Esc');
    });

    it('should format all modifiers combined', () => {
      const shortcut: KeyboardShortcut = {
        key: 'x',
        cmdOrCtrl: true,
        shift: true,
        alt: true,
        callback: vi.fn(),
      };
      expect(formatShortcutForDisplay(shortcut, true)).toBe('⌘⇧⌥X');
    });
  });
});
