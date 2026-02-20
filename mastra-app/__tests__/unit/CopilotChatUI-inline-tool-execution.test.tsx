/**
 * Unit tests for CopilotChatUI inline tool execution display
 * 
 * Task 4.2: Integrate tool execution into message stream
 * 
 * Validates: Requirements 6.3, 6.5, 2.2, 3.5, 4.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { CopilotChatUI } from '@/components/CopilotChatUI';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

describe('CopilotChatUI Inline Tool Execution Display', () => {
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

  describe('Requirement 6.3: Tool execution displayed inline in message stream', () => {
    it('should display tool narratives as assistant message content', async () => {
      // Mock SSE stream with tool narrative
      const mockStream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode('data: {"content":"I\'m querying the database..."}\n\n'));
          controller.enqueue(encoder.encode('data: {"done":true}\n\n'));
          controller.close();
        },
      });

      // First call is for conversations, second is for chat
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      render(<CopilotChatUI />);

      // Simulate sending a message
      const textarea = screen.getByPlaceholderText(/reply/i) as HTMLTextAreaElement;
      
      // Type in the textarea
      fireEvent.change(textarea, { target: { value: 'Show me data' } });
      
      // Submit the form
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

      // Wait for the tool narrative to appear in the message stream
      await waitFor(() => {
        const text = screen.queryByText(/querying the database/i);
        expect(text).not.toBeNull();
      }, { timeout: 3000 });
    });
  });

  describe('Requirement 6.5: All tool information integrated into assistant messages', () => {
    it('should stream multiple tool narratives as continuous assistant content', async () => {
      // Mock SSE stream with multiple tool narratives
      const mockStream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode('data: {"content":"I\'m querying the database..."}\n\n'));
          controller.enqueue(encoder.encode('data: {"content":"\\n\\nI found 10 results from querying the database."}\n\n'));
          controller.enqueue(encoder.encode('data: {"content":"\\n\\nNow analyzing the data..."}\n\n'));
          controller.enqueue(encoder.encode('data: {"done":true}\n\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      render(<CopilotChatUI />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/reply/i)).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(/reply/i) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Analyze data' } });
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

      // Wait for all narratives to appear in sequence
      await waitFor(() => {
        const elements = screen.getAllByText(/querying the database/i);
        expect(elements.length).toBeGreaterThan(0);
        // Check that all the narrative parts are present in the document
        expect(screen.getByText(/I'm querying the database/i)).toBeInTheDocument();
        expect(screen.getByText(/found 10 results/i)).toBeInTheDocument();
        expect(screen.getByText(/analyzing the data/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('No collapsed panels or expand/collapse interactions', () => {
    it('should not render ThinkingPanel component', async () => {
      // Mock SSE stream
      const mockStream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode('data: {"content":"Processing..."}\n\n'));
          controller.enqueue(encoder.encode('data: {"done":true}\n\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      const { container } = render(<CopilotChatUI />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/reply/i)).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(/reply/i) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Test' } });
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/Processing/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify no ThinkingPanel-related classes or elements
      const thinkingPanels = container.querySelectorAll('[class*="thinking"]');
      expect(thinkingPanels).toHaveLength(0);
    });
  });

  describe('SSE event handling', () => {
    it('should ignore toolCall SSE events and only display content', async () => {
      // Mock SSE stream with toolCall event (should be ignored)
      const mockStream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          // Send a toolCall event - this should be ignored
          controller.enqueue(encoder.encode('data: {"toolCall":{"id":"1","name":"query_db","arguments":{}}}\n\n'));
          // Send content - this should be displayed
          controller.enqueue(encoder.encode('data: {"content":"Querying the database..."}\n\n'));
          controller.enqueue(encoder.encode('data: {"done":true}\n\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      render(<CopilotChatUI />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/reply/i)).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(/reply/i) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Test' } });
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

      // Only the content should appear
      await waitFor(() => {
        expect(screen.getByText(/Querying the database/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify no tool call display elements (like "query_db" as a separate element)
      expect(screen.queryByText('query_db')).not.toBeInTheDocument();
    });

    it('should ignore toolResult SSE events and only display content', async () => {
      // Mock SSE stream with toolResult event (should be ignored)
      const mockStream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          // Send a toolResult event - this should be ignored
          controller.enqueue(encoder.encode('data: {"toolResult":{"toolCallId":"1","result":"some data"}}\n\n'));
          // Send content - this should be displayed
          controller.enqueue(encoder.encode('data: {"content":"Found results."}\n\n'));
          controller.enqueue(encoder.encode('data: {"done":true}\n\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      render(<CopilotChatUI />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/reply/i)).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(/reply/i) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Test' } });
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

      // Only the content should appear
      await waitFor(() => {
        expect(screen.getByText(/Found results/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should display progress messages with step information', async () => {
      // Mock SSE stream with thinking and progress events
      const mockStream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          // Send thinking event - should be appended to content
          controller.enqueue(encoder.encode('data: {"thinking":"Analyzing request..."}\n\n'));
          // Send progress event with step info - should be displayed
          controller.enqueue(encoder.encode('data: {"progress":"Step 1 of 3: Connecting to database...","step":{"current":1,"total":3}}\n\n'));
          // Send content - this should be displayed
          controller.enqueue(encoder.encode('data: {"content":"Here are the results."}\n\n'));
          controller.enqueue(encoder.encode('data: {"done":true}\n\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      render(<CopilotChatUI />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/reply/i)).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(/reply/i) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Test' } });
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

      // Wait for content to appear
      await waitFor(() => {
        expect(screen.getByText(/Here are the results/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify progress indicator is displayed with step information
      await waitFor(() => {
        const elements = screen.getAllByText(/Step 1 of 3/i);
        // Should find the text in both the progress indicator and the message content
        expect(elements.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });
  });

  describe('Message interface changes', () => {
    it('should not include toolCalls field in message state', async () => {
      // This test verifies that the Message interface no longer has toolCalls
      // by checking that messages are rendered without tool call information
      
      const mockStream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode('data: {"content":"Response text"}\n\n'));
          controller.enqueue(encoder.encode('data: {"done":true}\n\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      const { container } = render(<CopilotChatUI />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/reply/i)).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(/reply/i) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Test' } });
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/Response text/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify no tool call display components are rendered
      const toolCallElements = container.querySelectorAll('[class*="tool"]');
      // Filter out the toolbar/tooltip elements that might have "tool" in their class
      const actualToolCallElements = Array.from(toolCallElements).filter(el => 
        el.textContent?.includes('tool') && !el.textContent?.includes('Response text')
      );
      expect(actualToolCallElements).toHaveLength(0);
    });
  });
});
