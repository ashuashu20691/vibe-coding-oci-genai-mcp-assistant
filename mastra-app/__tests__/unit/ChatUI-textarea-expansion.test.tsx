/**
 * Unit tests for ChatUI textarea dynamic expansion
 * 
 * Task 11.2: Implement dynamic textarea expansion
 * Validates: Requirement 8.2
 * - Textarea grows with content up to max height (200px)
 * - Resets to single line after submission
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { ChatUI } from '@/components/ChatUI';

// Mock fetch for API calls
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ models: [{ id: 'test-model', name: 'Test Model' }] }),
  })
) as unknown as typeof fetch;

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

describe('Task 11.2: Dynamic Textarea Expansion', () => {
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

  describe('Requirement 8.2: Textarea expands vertically with multi-line content', () => {
    it('should have textarea with rows=1 for single line default', () => {
      render(<ChatUI />);
      
      const textarea = screen.getByPlaceholderText(/ask about your data/i);
      expect(textarea).not.toBeNull();
      expect(textarea.getAttribute('rows')).toBe('1');
    });

    it('should have textarea with resize-none class to prevent manual resize', () => {
      render(<ChatUI />);
      
      const textarea = screen.getByPlaceholderText(/ask about your data/i);
      expect(textarea.classList.contains('resize-none')).toBe(true);
    });

    it('should update textarea height on input change', () => {
      render(<ChatUI />);
      
      const textarea = screen.getByPlaceholderText(/ask about your data/i) as HTMLTextAreaElement;
      
      // Mock scrollHeight to simulate multi-line content
      Object.defineProperty(textarea, 'scrollHeight', {
        configurable: true,
        value: 100,
      });
      
      // Trigger input change
      fireEvent.change(textarea, { target: { value: 'Line 1\nLine 2\nLine 3' } });
      
      // Verify height was set (should be min of scrollHeight and 200)
      expect(textarea.style.height).toBe('100px');
    });

    it('should cap textarea height at 200px maximum', () => {
      render(<ChatUI />);
      
      const textarea = screen.getByPlaceholderText(/ask about your data/i) as HTMLTextAreaElement;
      
      // Mock scrollHeight to exceed max height
      Object.defineProperty(textarea, 'scrollHeight', {
        configurable: true,
        value: 500,
      });
      
      // Trigger input change with lots of content
      fireEvent.change(textarea, { 
        target: { value: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10' } 
      });
      
      // Verify height is capped at 200px
      expect(textarea.style.height).toBe('200px');
    });

    it('should reset height to auto before calculating new height', () => {
      render(<ChatUI />);
      
      const textarea = screen.getByPlaceholderText(/ask about your data/i) as HTMLTextAreaElement;
      
      // Set initial height
      textarea.style.height = '150px';
      
      // Mock scrollHeight
      Object.defineProperty(textarea, 'scrollHeight', {
        configurable: true,
        value: 80,
      });
      
      // Trigger input change
      fireEvent.change(textarea, { target: { value: 'Short text' } });
      
      // Height should be recalculated based on new content
      expect(textarea.style.height).toBe('80px');
    });

    it('should handle empty input gracefully', () => {
      render(<ChatUI />);
      
      const textarea = screen.getByPlaceholderText(/ask about your data/i) as HTMLTextAreaElement;
      
      // First add some content
      Object.defineProperty(textarea, 'scrollHeight', {
        configurable: true,
        value: 100,
      });
      fireEvent.change(textarea, { target: { value: 'Some content' } });
      
      // Then clear it
      Object.defineProperty(textarea, 'scrollHeight', {
        configurable: true,
        value: 40,
      });
      fireEvent.change(textarea, { target: { value: '' } });
      
      // Height should adjust to minimal
      expect(textarea.style.height).toBe('40px');
    });
  });

  describe('Textarea reset after submission', () => {
    it('should reset textarea height to auto after form submission', async () => {
      // Mock fetch to return a model and handle chat submission
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url === '/api/models') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ models: [{ id: 'test-model', name: 'Test Model' }] }),
          });
        }
        if (url === '/api/chat') {
          return Promise.resolve({
            ok: true,
            body: {
              getReader: () => ({
                read: () => Promise.resolve({ done: true, value: undefined }),
              }),
            },
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(<ChatUI defaultModel="test-model" />);
      
      const textarea = screen.getByPlaceholderText(/ask about your data/i) as HTMLTextAreaElement;
      
      // Set height as if user typed multi-line content
      textarea.style.height = '150px';
      
      // Mock scrollHeight
      Object.defineProperty(textarea, 'scrollHeight', {
        configurable: true,
        value: 150,
      });
      
      // Type some content
      fireEvent.change(textarea, { target: { value: 'Test message' } });
      
      // Submit the form
      const form = textarea.closest('form');
      expect(form).not.toBeNull();
      fireEvent.submit(form!);
      
      // Wait for async operations
      await vi.waitFor(() => {
        // After submission, height should be reset to 'auto'
        expect(textarea.style.height).toBe('auto');
      });
    });

    it('should clear input value after submission', async () => {
      // Mock fetch
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url === '/api/models') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ models: [{ id: 'test-model', name: 'Test Model' }] }),
          });
        }
        if (url === '/api/chat') {
          return Promise.resolve({
            ok: true,
            body: {
              getReader: () => ({
                read: () => Promise.resolve({ done: true, value: undefined }),
              }),
            },
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(<ChatUI defaultModel="test-model" />);
      
      const textarea = screen.getByPlaceholderText(/ask about your data/i) as HTMLTextAreaElement;
      
      // Type some content
      fireEvent.change(textarea, { target: { value: 'Test message' } });
      expect(textarea.value).toBe('Test message');
      
      // Submit the form
      const form = textarea.closest('form');
      fireEvent.submit(form!);
      
      // Wait for async operations
      await vi.waitFor(() => {
        // Input should be cleared
        expect(textarea.value).toBe('');
      });
    });
  });

  describe('Textarea expansion implementation details', () => {
    it('should have handleInputChange that sets height based on scrollHeight', () => {
      render(<ChatUI />);
      
      const textarea = screen.getByPlaceholderText(/ask about your data/i) as HTMLTextAreaElement;
      
      // Test various scrollHeight values
      const testCases = [
        { scrollHeight: 40, expectedHeight: '40px' },
        { scrollHeight: 100, expectedHeight: '100px' },
        { scrollHeight: 200, expectedHeight: '200px' },
        { scrollHeight: 300, expectedHeight: '200px' }, // Capped at 200
      ];
      
      testCases.forEach(({ scrollHeight, expectedHeight }) => {
        Object.defineProperty(textarea, 'scrollHeight', {
          configurable: true,
          value: scrollHeight,
        });
        
        fireEvent.change(textarea, { target: { value: `Test ${scrollHeight}` } });
        expect(textarea.style.height).toBe(expectedHeight);
      });
    });
  });
});
