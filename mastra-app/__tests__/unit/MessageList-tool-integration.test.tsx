/**
 * Unit tests for MessageList component - Tool Details Integration
 * Validates: Requirement 18.3 - Tool details integrated into conversational text
 * 
 * Tests that tool execution details appear as natural conversational text
 * within assistant messages, not as separate UI event cards.
 */

import { render, screen } from '@testing-library/react';
import { MessageList } from '@/components/MessageList';
import { Message } from '@/types';

// Mock scrollIntoView for tests
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe('MessageList - Tool Details Integration (Requirement 18.3)', () => {
  it('should NOT render ToolCallDisplay component for messages with tool calls', () => {
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

    // Assert: Tool details should be in conversational text, not as separate cards
    // The content should contain the conversational description
    expect(screen.getByText(/I ran a query with the following parameters/i)).toBeInTheDocument();
    
    // Should NOT have the "Used X tools" button that ToolCallDisplay creates
    expect(screen.queryByText(/Used \d+ tool/i)).not.toBeInTheDocument();
    
    // Should NOT have expandable tool call items
    expect(container.querySelector('[class*="tool"]')).toBeNull();
  });

  it('should display tool details as natural conversational text', () => {
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

    // Assert: Tool details should be integrated into the conversational text
    expect(screen.getByText(/Let me check the database schema/i)).toBeInTheDocument();
    expect(screen.getByText(/I'll run describe_table with table_name="SUPPLIERS"/i)).toBeInTheDocument();
    
    // Should NOT have separate tool execution cards
    expect(screen.queryByText(/Used 1 tool/i)).not.toBeInTheDocument();
  });

  it('should display multiple tool calls as conversational narrative', () => {
    // Arrange: Create a message with multiple tool calls in conversational format
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
    render(<MessageList messages={messages} />);

    // Assert: All tool narratives should be in conversational text
    expect(screen.getByText(/First, I'll list the available connections/i)).toBeInTheDocument();
    expect(screen.getByText(/Then I'll connect to LiveLab/i)).toBeInTheDocument();
    expect(screen.getByText(/Now let me query the suppliers table/i)).toBeInTheDocument();
    
    // Should NOT have "Used 3 tools" button
    expect(screen.queryByText(/Used 3 tools/i)).not.toBeInTheDocument();
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
    render(<MessageList messages={messages} />);

    // Assert: Content should be displayed normally
    expect(screen.getByText(/Here are the results from the query/i)).toBeInTheDocument();
  });

  it('should display tool results as conversational text', () => {
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

    // Assert: Tool result should be described conversationally
    expect(screen.getByText(/I found 15 suppliers in the database/i)).toBeInTheDocument();
    expect(screen.getByText(/most suppliers are located in the US and Europe/i)).toBeInTheDocument();
    
    // Should NOT have separate result display cards
    expect(screen.queryByText(/Used 1 tool/i)).not.toBeInTheDocument();
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
    render(<MessageList messages={messages} />);

    // Assert: Should render content normally without tool display
    expect(screen.getByText(/Processing your request/i)).toBeInTheDocument();
    expect(screen.queryByText(/Used 0 tools/i)).not.toBeInTheDocument();
  });
});
