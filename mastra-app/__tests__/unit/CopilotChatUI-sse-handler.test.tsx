/**
 * Unit tests for SSE handler in CopilotChatUI
 * Tests handling of conversational content types: tool_narrative, adaptation, progress
 * Requirements: 7.3, 9.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { CopilotChatUI } from '@/components/CopilotChatUI';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock fetch for SSE streaming
const mockSSEStream = (chunks: Array<{ data: string }>) => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      chunks.forEach(chunk => {
        controller.enqueue(encoder.encode(`data: ${chunk.data}\n\n`));
      });
      controller.close();
    }
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' }
  });
};

describe('CopilotChatUI SSE Handler', () => {
  beforeEach(() => {
    // Mock conversations API
    mockFetch.mockImplementation((url) => {
      if (url === '/api/conversations') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        } as Response);
      }
      return Promise.reject(new Error('Not found'));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handles tool_narrative messages and appends to assistant content', async () => {
    // Mock chat API with tool_narrative
    mockFetch.mockImplementation((url) => {
      if (url === '/api/conversations') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        } as Response);
      }
      if (url === '/api/chat') {
        return Promise.resolve(mockSSEStream([
          { data: JSON.stringify({ tool_narrative: 'Connecting to database...\n\n' }) },
          { data: JSON.stringify({ tool_narrative: 'Executing query...\n\n' }) },
          { data: JSON.stringify({ content: 'Found 10 results.' }) },
          { data: JSON.stringify({ done: true }) }
        ]));
      }
      return Promise.reject(new Error('Not found'));
    });

    render(<CopilotChatUI />);
    
    const input = screen.getByPlaceholderText('Reply...') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Show me data' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // Wait for all messages to be processed
    await waitFor(() => {
      const messages = screen.getAllByText(/Connecting to database|Executing query|Found 10 results/);
      expect(messages.length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    // Verify tool narratives appear in chronological order
    const assistantSection = screen.getByText(/Connecting to database/).closest('div');
    expect(assistantSection?.textContent).toContain('Connecting to database');
    expect(assistantSection?.textContent).toContain('Executing query');
    expect(assistantSection?.textContent).toContain('Found 10 results');
  });

  it('handles adaptation messages and maintains chronological order', async () => {
    // Mock chat API with adaptation messages
    mockFetch.mockImplementation((url) => {
      if (url === '/api/conversations') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        } as Response);
      }
      if (url === '/api/chat') {
        return Promise.resolve(mockSSEStream([
          { data: JSON.stringify({ content: 'Querying database...\n\n' }) },
          { data: JSON.stringify({ adaptation: 'Based on the results, I\'ll now analyze the data...\n\n' }) },
          { data: JSON.stringify({ content: 'Analysis complete.' }) },
          { data: JSON.stringify({ done: true }) }
        ]));
      }
      return Promise.reject(new Error('Not found'));
    });

    render(<CopilotChatUI />);
    
    const input = screen.getByPlaceholderText('Reply...') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Analyze data' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/Based on the results/)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Verify chronological order
    const assistantSection = screen.getByText(/Querying database/).closest('div');
    const text = assistantSection?.textContent || '';
    const queryIndex = text.indexOf('Querying database');
    const adaptationIndex = text.indexOf('Based on the results');
    const analysisIndex = text.indexOf('Analysis complete');
    
    expect(queryIndex).toBeLessThan(adaptationIndex);
    expect(adaptationIndex).toBeLessThan(analysisIndex);
  });

  it('handles progress messages for multi-step operations', async () => {
    // Mock chat API with progress messages
    mockFetch.mockImplementation((url) => {
      if (url === '/api/conversations') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        } as Response);
      }
      if (url === '/api/chat') {
        return Promise.resolve(mockSSEStream([
          { data: JSON.stringify({ progress: 'Step 1: Connecting...\n\n' }) },
          { data: JSON.stringify({ progress: 'Step 2: Querying...\n\n' }) },
          { data: JSON.stringify({ progress: 'Step 3: Processing results...\n\n' }) },
          { data: JSON.stringify({ content: 'Complete!' }) },
          { data: JSON.stringify({ done: true }) }
        ]));
      }
      return Promise.reject(new Error('Not found'));
    });

    render(<CopilotChatUI />);
    
    const input = screen.getByPlaceholderText('Reply...') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Run analysis' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/Step 1: Connecting/)).toBeInTheDocument();
      expect(screen.getByText(/Step 2: Querying/)).toBeInTheDocument();
      expect(screen.getByText(/Step 3: Processing results/)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Verify all progress messages are in the same assistant message
    const assistantSection = screen.getByText(/Step 1: Connecting/).closest('div');
    expect(assistantSection?.textContent).toContain('Step 1: Connecting');
    expect(assistantSection?.textContent).toContain('Step 2: Querying');
    expect(assistantSection?.textContent).toContain('Step 3: Processing results');
    expect(assistantSection?.textContent).toContain('Complete!');
  });

  it('handles thinking messages for backward compatibility', async () => {
    // Mock chat API with thinking messages (legacy format)
    mockFetch.mockImplementation((url) => {
      if (url === '/api/conversations') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        } as Response);
      }
      if (url === '/api/chat') {
        return Promise.resolve(mockSSEStream([
          { data: JSON.stringify({ thinking: 'Analyzing request...\n\n' }) },
          { data: JSON.stringify({ content: 'Here are the results.' }) },
          { data: JSON.stringify({ done: true }) }
        ]));
      }
      return Promise.reject(new Error('Not found'));
    });

    render(<CopilotChatUI />);
    
    const input = screen.getByPlaceholderText('Reply...') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Show data' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/Analyzing request/)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Verify thinking message is appended to assistant content
    const assistantSection = screen.getByText(/Analyzing request/).closest('div');
    expect(assistantSection?.textContent).toContain('Analyzing request');
    expect(assistantSection?.textContent).toContain('Here are the results');
  });

  it('maintains chronological order with mixed message types', async () => {
    // Mock chat API with all message types mixed
    mockFetch.mockImplementation((url) => {
      if (url === '/api/conversations') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        } as Response);
      }
      if (url === '/api/chat') {
        return Promise.resolve(mockSSEStream([
          { data: JSON.stringify({ content: 'Starting...\n\n' }) },
          { data: JSON.stringify({ tool_narrative: 'Tool 1 executing...\n\n' }) },
          { data: JSON.stringify({ progress: 'Progress update...\n\n' }) },
          { data: JSON.stringify({ adaptation: 'Adapting approach...\n\n' }) },
          { data: JSON.stringify({ thinking: 'Thinking...\n\n' }) },
          { data: JSON.stringify({ content: 'Done!' }) },
          { data: JSON.stringify({ done: true }) }
        ]));
      }
      return Promise.reject(new Error('Not found'));
    });

    render(<CopilotChatUI />);
    
    const input = screen.getByPlaceholderText('Reply...') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Complex task' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/Done!/)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Verify all messages appear in chronological order
    const assistantSection = screen.getByText(/Starting/).closest('div');
    const text = assistantSection?.textContent || '';
    
    const indices = [
      text.indexOf('Starting'),
      text.indexOf('Tool 1 executing'),
      text.indexOf('Progress update'),
      text.indexOf('Adapting approach'),
      text.indexOf('Thinking'),
      text.indexOf('Done!')
    ];

    // Verify each message appears after the previous one
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i - 1]).toBeLessThan(indices[i]);
    }
  });

  it('handles content and visualization together', async () => {
    // Mock chat API with content and visualization
    mockFetch.mockImplementation((url) => {
      if (url === '/api/conversations') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        } as Response);
      }
      if (url === '/api/chat') {
        return Promise.resolve(mockSSEStream([
          { data: JSON.stringify({ content: 'Here is your data:\n\n' }) },
          { data: JSON.stringify({ 
            visualization: { 
              html: '<div>Chart</div>', 
              type: 'bar', 
              title: 'Sales Chart' 
            } 
          }) },
          { data: JSON.stringify({ done: true }) }
        ]));
      }
      return Promise.reject(new Error('Not found'));
    });

    render(<CopilotChatUI />);
    
    const input = screen.getByPlaceholderText('Reply...') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Show chart' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/Here is your data/)).toBeInTheDocument();
      expect(screen.getByText(/View Sales Chart/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('appends all conversational content to the same assistant message', async () => {
    // Mock chat API
    mockFetch.mockImplementation((url) => {
      if (url === '/api/conversations') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        } as Response);
      }
      if (url === '/api/chat') {
        return Promise.resolve(mockSSEStream([
          { data: JSON.stringify({ content: 'Part 1\n\n' }) },
          { data: JSON.stringify({ tool_narrative: 'Part 2\n\n' }) },
          { data: JSON.stringify({ adaptation: 'Part 3\n\n' }) },
          { data: JSON.stringify({ progress: 'Part 4\n\n' }) },
          { data: JSON.stringify({ done: true }) }
        ]));
      }
      return Promise.reject(new Error('Not found'));
    });

    render(<CopilotChatUI />);
    
    const input = screen.getByPlaceholderText('Reply...') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/Part 4/)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Count assistant message sections - should only be 1
    const assistantLabels = screen.getAllByText('Assistant');
    // One for the streaming message
    expect(assistantLabels.length).toBe(1);
  });
});
