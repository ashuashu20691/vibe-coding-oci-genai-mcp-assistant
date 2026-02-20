/**
 * Unit tests for CopilotChatUI progress indicators
 * 
 * Task 6.2: Display progress indicators in UI
 * 
 * Validates: Requirements 7.4, 16.3, 16.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { CopilotChatUI } from '@/components/CopilotChatUI';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

describe('CopilotChatUI Progress Indicators', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    // Mock conversations API
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ conversations: [] }),
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('Requirement 16.3: Display "Step X of Y" messages in conversation', () => {
    it('should display step progress indicator with current and total steps', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode('data: {"progress":"Step 1 of 3: Connecting to database...","step":{"current":1,"total":3}}\n\n'));
          controller.enqueue(encoder.encode('data: {"done":true}\n\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      render(<CopilotChatUI />);

      const textarea = screen.getByPlaceholderText(/reply/i) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Test query' } });
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

      // Verify "Step 1 of 3" is displayed
      await waitFor(() => {
        const texts = screen.getAllByText(/Step 1 of 3/i);
        expect(texts.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    it('should update progress indicator as steps complete', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode('data: {"progress":"Step 1 of 3: Connecting...","step":{"current":1,"total":3}}\n\n'));
          controller.enqueue(encoder.encode('data: {"progress":"Step 2 of 3: Querying...","step":{"current":2,"total":3}}\n\n'));
          controller.enqueue(encoder.encode('data: {"progress":"Step 3 of 3: Analyzing...","step":{"current":3,"total":3}}\n\n'));
          controller.enqueue(encoder.encode('data: {"done":true}\n\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      render(<CopilotChatUI />);

      const textarea = screen.getByPlaceholderText(/reply/i) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Multi-step query' } });
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

      // Verify final step is displayed
      await waitFor(() => {
        const text = screen.getByText(/Step 3 of 3/i);
        expect(text).toBeTruthy();
      }, { timeout: 3000 });
    });
  });

  describe('Requirement 7.4: Display typing indicator between steps', () => {
    it('should show typing indicator while streaming', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          // Simulate streaming with delay
          setTimeout(() => {
            controller.enqueue(encoder.encode('data: {"content":"Processing..."}\n\n'));
            controller.enqueue(encoder.encode('data: {"done":true}\n\n'));
            controller.close();
          }, 100);
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      render(<CopilotChatUI />);

      const textarea = screen.getByPlaceholderText(/reply/i) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Test' } });
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

      // Verify typing indicator appears while waiting for response
      await waitFor(() => {
        const typingIndicator = screen.getByLabelText(/assistant is typing/i);
        expect(typingIndicator).toBeTruthy();
      }, { timeout: 1000 });
    });
  });

  describe('Requirement 16.4: Show summary message when all steps complete', () => {
    it('should display completion indicator when all steps are done', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode('data: {"progress":"Step 1 of 2: Connecting...","step":{"current":1,"total":2}}\n\n'));
          controller.enqueue(encoder.encode('data: {"progress":"Step 2 of 2: Querying...","step":{"current":2,"total":2}}\n\n'));
          controller.enqueue(encoder.encode('data: {"progress":"✓ Completed all 2 steps.","step":{"current":2,"total":2}}\n\n'));
          controller.enqueue(encoder.encode('data: {"done":true}\n\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      render(<CopilotChatUI />);

      const textarea = screen.getByPlaceholderText(/reply/i) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Complete task' } });
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

      // Verify completion message is displayed
      await waitFor(() => {
        const texts = screen.getAllByText(/Completed all 2 steps/i);
        expect(texts.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    it('should show visual completion indicator (checkmark) when done', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode('data: {"progress":"Step 2 of 2: Final step...","step":{"current":2,"total":2}}\n\n'));
          controller.enqueue(encoder.encode('data: {"done":true}\n\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      render(<CopilotChatUI />);

      const textarea = screen.getByPlaceholderText(/reply/i) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Final test' } });
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

      // Wait for progress indicator to appear
      await waitFor(() => {
        const text = screen.getByText(/Step 2 of 2/i);
        expect(text).toBeTruthy();
      }, { timeout: 3000 });

      // Verify completion status is shown (aria-label includes "Completed")
      await waitFor(() => {
        const progressElement = screen.getByRole('status');
        const ariaLabel = progressElement.getAttribute('aria-label');
        expect(ariaLabel).toContain('Completed');
      }, { timeout: 3000 });
    });
  });

  describe('Progress indicator visual elements', () => {
    it('should display progress bar with correct percentage', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode('data: {"progress":"Step 2 of 4: Processing...","step":{"current":2,"total":4}}\n\n'));
          controller.enqueue(encoder.encode('data: {"done":true}\n\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      render(<CopilotChatUI />);

      const textarea = screen.getByPlaceholderText(/reply/i) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Progress test' } });
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

      // Verify percentage is displayed (50% for step 2 of 4)
      await waitFor(() => {
        const text = screen.getByText(/50%/i);
        expect(text).toBeTruthy();
      }, { timeout: 3000 });
    });

    it('should not display progress indicator for single-step operations', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          // Single step - should not show progress indicator
          controller.enqueue(encoder.encode('data: {"progress":"Querying database...","step":{"current":1,"total":1}}\n\n'));
          controller.enqueue(encoder.encode('data: {"content":"Results found."}\n\n'));
          controller.enqueue(encoder.encode('data: {"done":true}\n\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      render(<CopilotChatUI />);

      const textarea = screen.getByPlaceholderText(/reply/i) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Single step' } });
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

      // Wait for content
      await waitFor(() => {
        const text = screen.getByText(/Results found/i);
        expect(text).toBeTruthy();
      }, { timeout: 3000 });

      // Verify no progress indicator is shown for single-step operations
      expect(screen.queryByText(/Step 1 of 1/i)).toBeNull();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for progress indicators', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode('data: {"progress":"Step 1 of 3: Starting...","step":{"current":1,"total":3}}\n\n'));
          controller.enqueue(encoder.encode('data: {"done":true}\n\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      render(<CopilotChatUI />);

      const textarea = screen.getByPlaceholderText(/reply/i) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Accessibility test' } });
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

      // Verify progress indicator has role="status" and aria-label
      await waitFor(() => {
        const progressElement = screen.getByRole('status');
        const ariaLabel = progressElement.getAttribute('aria-label');
        expect(ariaLabel).toContain('Step 1 of 3');
      }, { timeout: 3000 });
    });
  });
});
