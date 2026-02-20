/**
 * Unit tests for ChatUI input area fixed positioning
 * 
 * Task 11.1: Ensure input area is fixed at bottom
 * Validates: Requirement 8.5
 * - Input area remains fixed at the bottom while scrolling through conversation history
 * - Input should not scroll with messages
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ChatUI } from '@/components/ChatUI';

// Mock fetch for API calls
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ models: [] }),
  })
) as unknown as typeof fetch;

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

describe('Task 11.1: Input Area Fixed at Bottom', () => {
  beforeEach(() => {
    // Mock CSS variables
    document.documentElement.style.setProperty('--bg-primary', '#ffffff');
    document.documentElement.style.setProperty('--bg-secondary', '#f7f7f5');
    document.documentElement.style.setProperty('--text-primary', '#0d0d0d');
    document.documentElement.style.setProperty('--text-secondary', '#666666');
    document.documentElement.style.setProperty('--text-muted', '#999999');
    document.documentElement.style.setProperty('--border-color', '#e5e5e5');
    document.documentElement.style.setProperty('--user-bg', '#f0f0f0');
    document.documentElement.style.setProperty('--accent', '#10a37f');
    document.documentElement.style.setProperty('--shadow-sm', '0 1px 2px rgba(0,0,0,0.05)');
    document.documentElement.style.setProperty('--bg-tertiary', '#e5e5e5');
    
    // Mock matchMedia for responsive hooks
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query.includes('min-width: 1025px'), // Desktop by default
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('Requirement 8.5: Input area fixed at bottom', () => {
    it('should have main container with flex column layout', () => {
      const { container } = render(<ChatUI />);
      
      // Find the main flex container
      const mainContainer = container.querySelector('.flex.h-screen');
      expect(mainContainer).not.toBeNull();
    });

    it('should have content area with flex-1 and flex-col for proper layout', () => {
      const { container } = render(<ChatUI />);
      
      // Find the content area that contains MessageList and input
      const contentArea = container.querySelector('.flex-1.flex.flex-col.min-h-0');
      expect(contentArea).not.toBeNull();
    });

    it('should have MessageList container with flex-1 and overflow-y-auto for independent scrolling', () => {
      const { container } = render(<ChatUI />);
      
      // Find the scrollable message container
      const scrollContainer = container.querySelector('.flex-1.overflow-y-auto');
      expect(scrollContainer).not.toBeNull();
      
      // Verify it has flex-1 (takes available space)
      expect(scrollContainer?.classList.contains('flex-1')).toBe(true);
      
      // Verify it has overflow-y-auto (scrolls independently)
      expect(scrollContainer?.classList.contains('overflow-y-auto')).toBe(true);
    });

    it('should have input area as a sibling to MessageList (not inside scrollable area)', () => {
      const { container } = render(<ChatUI />);
      
      // Find the content area
      const contentArea = container.querySelector('.flex-1.flex.flex-col.min-h-0');
      expect(contentArea).not.toBeNull();
      
      // Find the scrollable message area
      const scrollContainer = contentArea?.querySelector('.flex-1.overflow-y-auto');
      expect(scrollContainer).not.toBeNull();
      
      // Find the input area (has p-4 padding and border-top)
      const inputArea = contentArea?.querySelector('form')?.closest('div.p-4');
      expect(inputArea).not.toBeNull();
      
      // Verify input area is NOT inside the scroll container
      expect(scrollContainer?.contains(inputArea!)).toBe(false);
      
      // Verify both are direct children of content area
      expect(scrollContainer?.parentElement).toBe(contentArea);
      expect(inputArea?.parentElement).toBe(contentArea);
    });

    it('should have input area without flex-grow (stays at natural height)', () => {
      const { container } = render(<ChatUI />);
      
      // Find the input area container
      const inputArea = container.querySelector('form')?.closest('div.p-4');
      expect(inputArea).not.toBeNull();
      
      // Verify it does NOT have flex-1 or flex-grow classes
      expect(inputArea?.classList.contains('flex-1')).toBe(false);
      expect(inputArea?.classList.contains('flex-grow')).toBe(false);
    });

    it('should have input area with border-top for visual separation', () => {
      const { container } = render(<ChatUI />);
      
      // Find the input area container
      const inputArea = container.querySelector('form')?.closest('div.p-4');
      expect(inputArea).not.toBeNull();
      
      // Verify it has border-top style
      const style = inputArea?.getAttribute('style');
      expect(style).toContain('border-top');
    });

    it('should have min-h-0 on parent to enable proper flex shrinking', () => {
      const { container } = render(<ChatUI />);
      
      // Find the content area with min-h-0
      const contentArea = container.querySelector('.flex-1.flex.flex-col.min-h-0');
      expect(contentArea).not.toBeNull();
      
      // min-h-0 is crucial for flex containers to allow children to shrink
      // and enable proper overflow scrolling
      expect(contentArea?.classList.contains('min-h-0')).toBe(true);
    });
  });

  describe('Layout structure verification', () => {
    it('should maintain correct DOM hierarchy for fixed input', () => {
      const { container } = render(<ChatUI />);
      
      // Expected structure:
      // .flex.h-screen (main container)
      //   └── .flex-1.flex.flex-col.min-h-0 (content area)
      //       ├── .flex-1.overflow-y-auto (MessageList - scrollable)
      //       └── .p-4 (input area - fixed at bottom)
      
      const mainContainer = container.querySelector('.flex.h-screen');
      const contentArea = mainContainer?.querySelector('.flex-1.flex.flex-col.min-h-0');
      const scrollArea = contentArea?.querySelector('.flex-1.overflow-y-auto');
      const inputArea = contentArea?.querySelector('div.p-4');
      
      expect(mainContainer).not.toBeNull();
      expect(contentArea).not.toBeNull();
      expect(scrollArea).not.toBeNull();
      expect(inputArea).not.toBeNull();
      
      // Verify scroll area and input area are siblings
      expect(scrollArea?.parentElement).toBe(contentArea);
      expect(inputArea?.parentElement).toBe(contentArea);
    });

    it('should have textarea inside the fixed input area', () => {
      const { container } = render(<ChatUI />);
      
      // Find the input area
      const inputArea = container.querySelector('form')?.closest('div.p-4');
      expect(inputArea).not.toBeNull();
      
      // Verify textarea is inside
      const textarea = inputArea?.querySelector('textarea');
      expect(textarea).not.toBeNull();
    });

    it('should have send button inside the fixed input area', () => {
      const { container } = render(<ChatUI />);
      
      // Find the input area
      const inputArea = container.querySelector('form')?.closest('div.p-4');
      expect(inputArea).not.toBeNull();
      
      // Verify submit button is inside
      const submitButton = inputArea?.querySelector('button[type="submit"]');
      expect(submitButton).not.toBeNull();
    });
  });
});
