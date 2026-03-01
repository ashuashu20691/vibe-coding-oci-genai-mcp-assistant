/**
 * Unit tests for CopilotChatUI input field clearing on submission
 * 
 * Task 5.1: Update input field handler to clear on submission
 * Validates: Requirements 1.1, 1.2, 1.4
 * - Input field clears immediately after submission
 * - Textarea height resets to single line
 * - Focus is maintained on input field
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { CopilotChatUI } from '@/components/CopilotChatUI';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

describe('CopilotChatUI Input Field Clearing', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    
    // Mock conversations API
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/conversations') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ conversations: [] }),
        });
      }
      if (url === '/api/chat') {
        return Promise.resolve({
          ok: true,
          body: {
            getReader: () => ({
              read: vi.fn()
                .mockResolvedValueOnce({
                  done: false,
                  value: new TextEncoder().encode('data: {"content":"Hello"}\n'),
                })
                .mockResolvedValueOnce({
                  done: true,
                  value: undefined,
                }),
            }),
          },
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('Requirement 1.1: Input field clears immediately after submission', () => {
    it('should clear input field when Enter key is pressed', async () => {
      render(<CopilotChatUI />);
      
      const textarea = screen.getByPlaceholderText('How can I help you today?') as HTMLTextAreaElement;
      
      // Type a message
      fireEvent.change(textarea, { target: { value: 'Test message' } });
      expect(textarea.value).toBe('Test message');
      
      // Press Enter to submit
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
      
      // Input should be cleared immediately
      await waitFor(() => {
        expect(textarea.value).toBe('');
      });
    });

    it('should clear input field when send button is clicked', async () => {
      render(<CopilotChatUI />);
      
      const textarea = screen.getByPlaceholderText('How can I help you today?') as HTMLTextAreaElement;
      
      // Type a message
      fireEvent.change(textarea, { target: { value: 'Test message' } });
      expect(textarea.value).toBe('Test message');
      
      // Click send button
      const form = textarea.closest('form');
      expect(form).not.toBeNull();
      fireEvent.submit(form!);
      
      // Input should be cleared immediately
      await waitFor(() => {
        expect(textarea.value).toBe('');
      });
    });
  });

  describe('Requirement 1.2: Textarea height resets to single line', () => {
    it('should reset textarea height to auto after submission', async () => {
      render(<CopilotChatUI />);
      
      const textarea = screen.getByPlaceholderText('How can I help you today?') as HTMLTextAreaElement;
      
      // Simulate multi-line content by setting height
      textarea.style.height = '150px';
      
      // Type a message
      fireEvent.change(textarea, { target: { value: 'Test message' } });
      
      // Submit the form
      const form = textarea.closest('form');
      fireEvent.submit(form!);
      
      // Height should be reset to 'auto'
      await waitFor(() => {
        expect(textarea.style.height).toBe('auto');
      });
    });
  });

  describe('Requirement 1.4: Focus is maintained on input field', () => {
    it('should maintain focus on input field after submission', async () => {
      render(<CopilotChatUI />);
      
      const textarea = screen.getByPlaceholderText('How can I help you today?') as HTMLTextAreaElement;
      
      // Focus the textarea
      textarea.focus();
      expect(document.activeElement).toBe(textarea);
      
      // Type a message
      fireEvent.change(textarea, { target: { value: 'Test message' } });
      
      // Submit the form
      const form = textarea.closest('form');
      fireEvent.submit(form!);
      
      // Focus should be maintained
      await waitFor(() => {
        expect(document.activeElement).toBe(textarea);
      });
    });

    it('should allow immediate typing after submission', async () => {
      render(<CopilotChatUI />);
      
      const textarea = screen.getByPlaceholderText('How can I help you today?') as HTMLTextAreaElement;
      
      // Type and submit first message
      fireEvent.change(textarea, { target: { value: 'First message' } });
      const form = textarea.closest('form');
      fireEvent.submit(form!);
      
      // Wait for input to clear
      await waitFor(() => {
        expect(textarea.value).toBe('');
      });
      
      // Should be able to type immediately
      fireEvent.change(textarea, { target: { value: 'Second message' } });
      expect(textarea.value).toBe('Second message');
      expect(document.activeElement).toBe(textarea);
    });
  });

  describe('Combined behavior', () => {
    it('should clear input, reset height, and maintain focus all together', async () => {
      render(<CopilotChatUI />);
      
      const textarea = screen.getByPlaceholderText('How can I help you today?') as HTMLTextAreaElement;
      
      // Set up multi-line state
      textarea.style.height = '120px';
      textarea.focus();
      
      // Type a message
      fireEvent.change(textarea, { target: { value: 'Multi-line\nmessage\nhere' } });
      
      // Submit
      const form = textarea.closest('form');
      fireEvent.submit(form!);
      
      // All three requirements should be met
      await waitFor(() => {
        expect(textarea.value).toBe(''); // Cleared
        expect(textarea.style.height).toBe('auto'); // Height reset
        expect(document.activeElement).toBe(textarea); // Focus maintained
      });
    });
  });
});
