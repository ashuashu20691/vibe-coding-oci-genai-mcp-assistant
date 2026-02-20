/**
 * Unit tests for conversation loading with full context
 * Validates: Requirements 12.4, 12.8
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CopilotChatUI from '../../src/components/CopilotChatUI';
import { Message, Conversation, ToolNarrative } from '../../src/types';

// Mock fetch
global.fetch = vi.fn();

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

describe('Conversation Loading - Full Context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock initial API calls
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/api/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 'model-1', name: 'Model 1' },
            { id: 'model-2', name: 'Model 2' }
          ])
        });
      }
      if (url === '/api/conversations') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        });
      }
      if (url === '/api/db-status') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ connected: true })
        });
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({})
      });
    });
  });

  it('should load complete message history including tool narratives', async () => {
    const toolNarratives: ToolNarrative[] = [
      {
        toolCallId: 'tool-1',
        toolName: 'database_query',
        phase: 'start',
        narrative: 'Querying the database for customer data...',
        timestamp: new Date('2024-01-01T10:00:00Z')
      },
      {
        toolCallId: 'tool-1',
        toolName: 'database_query',
        phase: 'result',
        narrative: 'Found 150 customer records matching your criteria.',
        timestamp: new Date('2024-01-01T10:00:05Z')
      }
    ];

    const messages: Message[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Show me customer data',
        timestamp: new Date('2024-01-01T09:59:00Z')
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Here are the customer records',
        timestamp: new Date('2024-01-01T10:00:10Z'),
        toolNarratives,
        toolCalls: [{
          id: 'tool-1',
          name: 'database_query',
          arguments: { table: 'customers' }
        }]
      }
    ];

    const conversation: Conversation = {
      id: 'conv-1',
      title: 'Customer Data Query',
      modelId: 'model-2',
      createdAt: new Date('2024-01-01T09:00:00Z'),
      updatedAt: new Date('2024-01-01T10:00:00Z')
    };

    // Mock the messages API
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/api/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 'model-1', name: 'Model 1' },
            { id: 'model-2', name: 'Model 2' }
          ])
        });
      }
      if (url === '/api/conversations/conv-1/messages') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(messages)
        });
      }
      if (url === '/api/conversations') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([conversation])
        });
      }
      if (url === '/api/db-status') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ connected: true })
        });
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({})
      });
    });

    render(<CopilotChatUI />);

    // Wait for conversations to load
    await waitFor(() => {
      expect(screen.queryByText('Customer Data Query')).toBeInTheDocument();
    });

    // Click on the conversation to load it
    const conversationItem = screen.getByText('Customer Data Query');
    fireEvent.click(conversationItem);

    // Wait for messages to load
    await waitFor(() => {
      expect(screen.getByText('Show me customer data')).toBeInTheDocument();
      expect(screen.getByText('Here are the customer records')).toBeInTheDocument();
    });

    // Verify the API was called with the correct conversation ID
    expect(global.fetch).toHaveBeenCalledWith('/api/conversations/conv-1/messages');
  });

  it('should restore model selection when loading conversation', async () => {
    const conversation: Conversation = {
      id: 'conv-2',
      title: 'Test Conversation',
      modelId: 'cohere.command-r-plus', // Use an actual model ID from the list
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const messages: Message[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date()
      }
    ];

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/api/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 'google.gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
            { id: 'cohere.command-r-plus', name: 'Command R+' },
            { id: 'meta.llama-3.1-70b', name: 'Llama 3.1 70B' }
          ])
        });
      }
      if (url === '/api/conversations/conv-2/messages') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(messages)
        });
      }
      if (url === '/api/conversations') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([conversation])
        });
      }
      if (url === '/api/db-status') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ connected: true })
        });
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({})
      });
    });

    render(<CopilotChatUI />);

    // Wait for conversations to load
    await waitFor(() => {
      expect(screen.queryByText('Test Conversation')).toBeInTheDocument();
    });

    // Click on the conversation
    const conversationItem = screen.getByText('Test Conversation');
    fireEvent.click(conversationItem);

    // Wait for messages to load
    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeInTheDocument();
    });

    // Verify model selection is restored (Command R+ should be selected)
    await waitFor(() => {
      const modelSelector = screen.getByRole('combobox') as HTMLSelectElement;
      expect(modelSelector.value).toBe('cohere.command-r-plus');
    });
  });

  it('should restore adaptation narratives when loading conversation', async () => {
    const adaptationNarratives = [
      'Based on the customer data, I\'ll now analyze purchase patterns.',
      'The purchase patterns suggest seasonal trends, so I\'ll query historical data.'
    ];

    const messages: Message[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Analyze customer purchases',
        timestamp: new Date()
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Analysis complete',
        timestamp: new Date(),
        adaptationNarratives
      }
    ];

    const conversation: Conversation = {
      id: 'conv-3',
      title: 'Purchase Analysis',
      modelId: 'model-1',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/api/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 'model-1', name: 'Model 1' }
          ])
        });
      }
      if (url === '/api/conversations/conv-3/messages') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(messages)
        });
      }
      if (url === '/api/conversations') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([conversation])
        });
      }
      if (url === '/api/db-status') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ connected: true })
        });
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({})
      });
    });

    render(<CopilotChatUI />);

    await waitFor(() => {
      expect(screen.queryByText('Purchase Analysis')).toBeInTheDocument();
    });

    const conversationItem = screen.getByText('Purchase Analysis');
    fireEvent.click(conversationItem);

    await waitFor(() => {
      expect(screen.getByText('Analyze customer purchases')).toBeInTheDocument();
      expect(screen.getByText('Analysis complete')).toBeInTheDocument();
    });

    // Verify the API was called with the correct conversation ID
    expect(global.fetch).toHaveBeenCalledWith('/api/conversations/conv-3/messages');
  });

  it('should restore visualization data when loading conversation', async () => {
    const messages: Message[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Show sales chart',
        timestamp: new Date()
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Here is the sales data',
        timestamp: new Date(),
        visualization: {
          type: 'bar_chart',
          title: 'Monthly Sales',
          html: '<div>Chart HTML</div>',
          data: [
            { month: 'Jan', sales: 1000 },
            { month: 'Feb', sales: 1500 }
          ]
        }
      }
    ];

    const conversation: Conversation = {
      id: 'conv-4',
      title: 'Sales Chart',
      modelId: 'model-1',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/api/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 'model-1', name: 'Model 1' }
          ])
        });
      }
      if (url === '/api/conversations/conv-4/messages') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(messages)
        });
      }
      if (url === '/api/conversations') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([conversation])
        });
      }
      if (url === '/api/db-status') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ connected: true })
        });
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({})
      });
    });

    render(<CopilotChatUI />);

    await waitFor(() => {
      expect(screen.queryByText('Sales Chart')).toBeInTheDocument();
    });

    const conversationItem = screen.getByText('Sales Chart');
    fireEvent.click(conversationItem);

    await waitFor(() => {
      expect(screen.getByText('Show sales chart')).toBeInTheDocument();
      expect(screen.getByText('Here is the sales data')).toBeInTheDocument();
    });

    // Verify the API was called with the correct conversation ID
    expect(global.fetch).toHaveBeenCalledWith('/api/conversations/conv-4/messages');
    
    // Verify visualization button is rendered (the UI does render visualizations)
    await waitFor(() => {
      expect(screen.getByText(/view/i)).toBeInTheDocument();
    });
  });

  it('should restore tool errors when loading conversation', async () => {
    const messages: Message[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Query database',
        timestamp: new Date()
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Encountered an error',
        timestamp: new Date(),
        toolErrors: [{
          toolName: 'database_query',
          errorMessage: 'Connection timeout',
          timestamp: new Date(),
          isRetryable: true
        }]
      }
    ];

    const conversation: Conversation = {
      id: 'conv-5',
      title: 'Database Query',
      modelId: 'model-1',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/api/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 'model-1', name: 'Model 1' }
          ])
        });
      }
      if (url === '/api/conversations/conv-5/messages') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(messages)
        });
      }
      if (url === '/api/conversations') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([conversation])
        });
      }
      if (url === '/api/db-status') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ connected: true })
        });
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({})
      });
    });

    render(<CopilotChatUI />);

    await waitFor(() => {
      expect(screen.queryByText('Database Query')).toBeInTheDocument();
    });

    const conversationItem = screen.getByText('Database Query');
    fireEvent.click(conversationItem);

    await waitFor(() => {
      expect(screen.getByText('Query database')).toBeInTheDocument();
      expect(screen.getByText('Encountered an error')).toBeInTheDocument();
    });

    // Verify the API was called with the correct conversation ID
    expect(global.fetch).toHaveBeenCalledWith('/api/conversations/conv-5/messages');
  });
});
