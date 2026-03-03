/**
 * Unit tests for MessageList component - Tool Details Integration
 * Validates: Requirement 12.2, 12.5 - Tool execution display with expandable details
 * 
 * Tests that tool execution details appear as expandable Claude Desktop-style
 * tool execution displays within assistant messages.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageList } from '@/components/MessageList';
import { Message } from '@/types';

// Mock scrollIntoView for tests
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe('MessageList - Tool Details Integration (Requirement 12.2, 12.5)', () => {
  it('should render ToolExecutionDisplay component for messages with tool calls', () => {
    // Arrange: Create a message with tool calls
    const messages: Message[] = [
      {
        id: '1',
        role: 'assistant',
        content: 'I ran a query with the following parameters: connection_name="LiveLab", query="SELECT * FROM suppliers"',
        timestamp: new Date(),
        toolCalls: [
          {
            id: 'tool-1',
            name: 'sqlcl_execute_query',
            arguments: {
              connection_name: 'LiveLab',
              query: 'SELECT * FROM suppliers',
            },
          },
        ],
      },
    ];

    // Act: Render the MessageList
    const { container } = render(<MessageList messages={messages} />);

    // Assert: Tool execution display should be rendered
    expect(screen.getByText('Execute Query')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    
    // Should have the tool execution display
    expect(container.querySelector('.tool-execution')).toBeInTheDocument();
  });

  it('should display tool details as expandable components', () => {
    // Arrange: Create a message with conversational tool narrative
    const messages: Message[] = [
      {
        id: '1',
        role: 'assistant',
        content: 'Let me check the database schema... I\'ll run describe_table with table_name="SUPPLIERS" to see the structure.',
        timestamp: new Date(),
        toolCalls: [
          {
            id: 'tool-1',
            name: 'sqlcl_describe_table',
            arguments: {
              table_name: 'SUPPLIERS',
            },
          },
        ],
      },
    ];

    // Act: Render the MessageList
    render(<MessageList messages={messages} />);

    // Assert: Tool execution display should be present
    expect(screen.getByText('Describe Table')).toBeInTheDocument();
    expect(screen.getByText(/Let me check the database schema/i)).toBeInTheDocument();
  });

  it('should display multiple tool calls as separate execution displays', () => {
    // Arrange: Create a message with multiple tool calls
    const messages: Message[] = [
      {
        id: '1',
        role: 'assistant',
        content: 'First, I\'ll list the available connections... Then I\'ll connect to LiveLab... Now let me query the suppliers table...',
        timestamp: new Date(),
        toolCalls: [
          {
            id: 'tool-1',
            name: 'sqlcl_list_connections',
            arguments: {},
          },
          {
            id: 'tool-2',
            name: 'sqlcl_connect',
            arguments: { connection_name: 'LiveLab' },
          },
          {
            id: 'tool-3',
            name: 'sqlcl_execute_query',
            arguments: { query: 'SELECT * FROM suppliers' },
          },
        ],
      },
    ];

    // Act: Render the MessageList
    const { container } = render(<MessageList messages={messages} />);

    // Assert: All tool execution displays should be rendered
    expect(screen.getByText('List Connections')).toBeInTheDocument();
    expect(screen.getByText('Connect')).toBeInTheDocument();
    expect(screen.getByText('Execute Query')).toBeInTheDocument();
    
    // Should have 3 tool execution displays
    const toolExecutions = container.querySelectorAll('.tool-execution');
    expect(toolExecutions).toHaveLength(3);
  });

  it('should render messages without tool calls normally', () => {
    // Arrange: Create a message without tool calls
    const messages: Message[] = [
      {
        id: '1',
        role: 'assistant',
        content: 'Here are the results from the query.',
        timestamp: new Date(),
      },
    ];

    // Act: Render the MessageList
    const { container } = render(<MessageList messages={messages} />);

    // Assert: Content should be displayed normally without tool displays
    expect(screen.getByText(/Here are the results from the query/i)).toBeInTheDocument();
    expect(container.querySelector('.tool-execution')).not.toBeInTheDocument();
  });

  it('should display tool results with execution displays', () => {
    // Arrange: Create a message with tool result narrative
    const messages: Message[] = [
      {
        id: '1',
        role: 'assistant',
        content: 'I found 15 suppliers in the database. The results show that most suppliers are located in the US and Europe.',
        timestamp: new Date(),
        toolCalls: [
          {
            id: 'tool-1',
            name: 'sqlcl_execute_query',
            arguments: { query: 'SELECT * FROM suppliers' },
          },
        ],
      },
    ];

    // Act: Render the MessageList
    render(<MessageList messages={messages} />);

    // Assert: Both tool display and result text should be present
    expect(screen.getByText('Execute Query')).toBeInTheDocument();
    expect(screen.getByText(/I found 15 suppliers in the database/i)).toBeInTheDocument();
  });

  it('should handle empty tool calls array gracefully', () => {
    // Arrange: Create a message with empty tool calls array
    const messages: Message[] = [
      {
        id: '1',
        role: 'assistant',
        content: 'Processing your request...',
        timestamp: new Date(),
        toolCalls: [],
      },
    ];

    // Act: Render the MessageList
    const { container } = render(<MessageList messages={messages} />);

    // Assert: Should render content normally without tool display
    expect(screen.getByText(/Processing your request/i)).toBeInTheDocument();
    expect(container.querySelector('.tool-execution')).not.toBeInTheDocument();
  });
});
