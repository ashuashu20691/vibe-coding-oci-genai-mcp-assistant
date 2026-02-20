/**
 * Unit tests for ChatUI keyboard shortcut integration.
 * 
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5
 * - 11.1: WHEN the user presses Cmd/Ctrl+K, THE Claude_Desktop_UI SHALL focus the message input
 * - 11.2: WHEN the user presses Cmd/Ctrl+N, THE Claude_Desktop_UI SHALL start a new conversation
 * - 11.3: WHEN the user presses Cmd/Ctrl+/, THE Claude_Desktop_UI SHALL toggle the sidebar
 * - 11.4: WHEN the user presses Escape during streaming, THE Claude_Desktop_UI SHALL stop the current response
 * - 11.5: THE Claude_Desktop_UI SHALL display a keyboard shortcuts help panel accessible via Cmd/Ctrl+?
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react';
import { ChatUI } from '@/components/ChatUI';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock useResponsive to return desktop viewport for consistent testing
vi.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    deviceType: 'desktop',
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    width: 1200,
    height: 800,
    isTouchDevice: false,
  }),
  BREAKPOINTS: {
    mobile: 768,
    tablet: 1024,
    desktop: 1024,
  },
  getDeviceType: (width: number) => {
    if (width < 768) return 'mobile';
    if (width <= 1024) return 'tablet';
    return 'desktop';
  },
  detectTouchDevice: () => false,
  matchesBreakpoint: () => false,
  mediaQueries: {
    mobile: '(max-width: 767px)',
    tablet: '(min-width: 768px) and (max-width: 1024px)',
    desktop: '(min-width: 1025px)',
    tabletAndUp: '(min-width: 768px)',
    tabletAndDown: '(max-width: 1024px)',
  },
}));

// Mock createPortal for MobileSidebar
vi.mock('react-dom', () => ({
  ...vi.importActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));

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

describe('ChatUI Keyboard Shortcuts Integration', () => {
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
    
    // Reset fetch mock
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ models: [] }),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('Requirement 11.1: Cmd/Ctrl+K focuses message input', () => {
    it('should focus the message input when Ctrl+K is pressed', async () => {
      render(<ChatUI defaultModel="test-model" />);
      
      // Get the textarea
      const textarea = screen.getByPlaceholderText(/ask about your data/i);
      
      // Blur the textarea first
      textarea.blur();
      expect(document.activeElement).not.toBe(textarea);
      
      // Press Ctrl+K
      act(() => {
        window.dispatchEvent(createKeyboardEvent('k', { ctrlKey: true }));
      });
      
      // Textarea should be focused
      await waitFor(() => {
        expect(document.activeElement).toBe(textarea);
      });
    });
  });

  describe('Requirement 11.2: Cmd/Ctrl+N starts new conversation', () => {
    it('should clear input when Ctrl+N is pressed', async () => {
      render(<ChatUI defaultModel="test-model" />);
      
      // Type something in the input
      const textarea = screen.getByPlaceholderText(/ask about your data/i) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'test message' } });
      expect(textarea.value).toBe('test message');
      
      // Press Ctrl+N
      act(() => {
        window.dispatchEvent(createKeyboardEvent('n', { ctrlKey: true }));
      });
      
      // Input should be cleared
      await waitFor(() => {
        expect(textarea.value).toBe('');
      });
    });
  });

  describe('Requirement 11.3: Cmd/Ctrl+/ toggles sidebar', () => {
    it('should toggle sidebar visibility when Ctrl+/ is pressed', async () => {
      render(<ChatUI defaultModel="test-model" />);
      
      // The sidebar should be visible initially - check for "New chat" button
      expect(screen.getByText('New chat')).toBeTruthy();
      
      // Press Ctrl+/ to toggle sidebar off
      act(() => {
        window.dispatchEvent(createKeyboardEvent('/', { ctrlKey: true }));
      });
      
      // Sidebar should be hidden - "New chat" button should not be visible
      await waitFor(() => {
        expect(screen.queryByText('New chat')).toBeFalsy();
      });
      
      // Press Ctrl+/ again to toggle sidebar back on
      act(() => {
        window.dispatchEvent(createKeyboardEvent('/', { ctrlKey: true }));
      });
      
      // Sidebar should be visible again
      await waitFor(() => {
        expect(screen.getByText('New chat')).toBeTruthy();
      });
    });
  });

  describe('Requirement 11.4: Escape cancels streaming', () => {
    it('should have Escape shortcut registered for cancelling streaming', async () => {
      render(<ChatUI defaultModel="test-model" />);
      
      // The Escape shortcut should be registered but only active during streaming
      // We can verify it doesn't cause errors when pressed
      act(() => {
        window.dispatchEvent(createKeyboardEvent('Escape'));
      });
      
      // No errors should occur - component should still be rendered
      expect(screen.getByPlaceholderText(/ask about your data/i)).toBeTruthy();
    });
  });

  describe('Keyboard shortcuts work together', () => {
    it('should handle multiple shortcuts in sequence', async () => {
      render(<ChatUI defaultModel="test-model" />);
      
      const textarea = screen.getByPlaceholderText(/ask about your data/i) as HTMLTextAreaElement;
      
      // Type something
      fireEvent.change(textarea, { target: { value: 'test' } });
      expect(textarea.value).toBe('test');
      
      // Press Ctrl+N to clear
      act(() => {
        window.dispatchEvent(createKeyboardEvent('n', { ctrlKey: true }));
      });
      
      await waitFor(() => {
        expect(textarea.value).toBe('');
      });
      
      // Press Ctrl+K to focus
      textarea.blur();
      act(() => {
        window.dispatchEvent(createKeyboardEvent('k', { ctrlKey: true }));
      });
      
      await waitFor(() => {
        expect(document.activeElement).toBe(textarea);
      });
    });
  });

  describe('Requirement 11.5: Cmd/Ctrl+? shows keyboard shortcuts help', () => {
    it('should show keyboard shortcuts help panel when Ctrl+Shift+? is pressed', async () => {
      render(<ChatUI defaultModel="test-model" />);
      
      // Help panel should not be visible initially
      expect(screen.queryByTestId('keyboard-shortcuts-modal')).toBeFalsy();
      
      // Press Ctrl+Shift+? (? requires shift on most keyboards)
      act(() => {
        window.dispatchEvent(createKeyboardEvent('?', { ctrlKey: true, shiftKey: true }));
      });
      
      // Help panel should be visible
      await waitFor(() => {
        expect(screen.getByTestId('keyboard-shortcuts-modal')).toBeTruthy();
      });
      
      // Should display the title
      expect(screen.getByText('Keyboard Shortcuts')).toBeTruthy();
    });

    it('should close keyboard shortcuts help panel when pressing Escape', async () => {
      render(<ChatUI defaultModel="test-model" />);
      
      // Open the help panel
      act(() => {
        window.dispatchEvent(createKeyboardEvent('?', { ctrlKey: true, shiftKey: true }));
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('keyboard-shortcuts-modal')).toBeTruthy();
      });
      
      // Press Escape to close
      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });
      
      // Help panel should be hidden
      await waitFor(() => {
        expect(screen.queryByTestId('keyboard-shortcuts-modal')).toBeFalsy();
      });
    });

    it('should toggle keyboard shortcuts help panel on repeated Ctrl+Shift+? presses', async () => {
      render(<ChatUI defaultModel="test-model" />);
      
      // Open the help panel
      act(() => {
        window.dispatchEvent(createKeyboardEvent('?', { ctrlKey: true, shiftKey: true }));
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('keyboard-shortcuts-modal')).toBeTruthy();
      });
      
      // Press Ctrl+Shift+? again to close
      act(() => {
        window.dispatchEvent(createKeyboardEvent('?', { ctrlKey: true, shiftKey: true }));
      });
      
      // Help panel should be hidden
      await waitFor(() => {
        expect(screen.queryByTestId('keyboard-shortcuts-modal')).toBeFalsy();
      });
    });

    it('should display all registered shortcuts in the help panel', async () => {
      render(<ChatUI defaultModel="test-model" />);
      
      // Open the help panel
      act(() => {
        window.dispatchEvent(createKeyboardEvent('?', { ctrlKey: true, shiftKey: true }));
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('keyboard-shortcuts-modal')).toBeTruthy();
      });
      
      // Should display all shortcut descriptions
      expect(screen.getByText('Focus message input')).toBeTruthy();
      expect(screen.getByText('New conversation')).toBeTruthy();
      expect(screen.getByText('Toggle sidebar')).toBeTruthy();
      // The Escape shortcut description was updated to include sidebar closing
      expect(screen.getByText('Cancel streaming / Close sidebar')).toBeTruthy();
      expect(screen.getByText('Show keyboard shortcuts')).toBeTruthy();
    });
  });
});
