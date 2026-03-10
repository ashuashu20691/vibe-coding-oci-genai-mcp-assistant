/**
 * Unit tests for AI Elements Message Components
 * 
 * Tests the new AI Elements message components (AssistantMessageAI, UserMessageAI)
 * and their integration with the feature flag system.
 * 
 * Validates: Requirements 1.1, 1.2, 1.3, 8.1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AssistantMessageAI } from '@/components/ai-elements/AssistantMessageAI';
import { UserMessageAI } from '@/components/ai-elements/UserMessageAI';
import { Message } from '@/types';

describe('AssistantMessageAI', () => {
  const mockMessage: Message = {
    id: '1',
    role: 'assistant',
    content: 'Hello, how can I help you?',
    timestamp: new Date('2024-01-01T12:00:00Z'),
  };

  it('should render assistant message with content', () => {
    render(<AssistantMessageAI message={mockMessage} isStreaming={false} />);
    
    expect(screen.getByTestId('assistant-message-ai')).toBeInTheDocument();
    expect(screen.getByTestId('assistant-content-ai')).toBeInTheDocument();
    expect(screen.getByText('Hello, how can I help you?')).toBeInTheDocument();
  });

  it('should display streaming cursor when isStreaming is true', () => {
    render(<AssistantMessageAI message={mockMessage} isStreaming={true} />);
    
    expect(screen.getByTestId('streaming-cursor-ai')).toBeInTheDocument();
  });

  it('should not display streaming cursor when isStreaming is false', () => {
    render(<AssistantMessageAI message={mockMessage} isStreaming={false} />);
    
    expect(screen.queryByTestId('streaming-cursor-ai')).not.toBeInTheDocument();
  });

  it('should display streaming placeholder when no content and streaming', () => {
    const emptyMessage: Message = {
      ...mockMessage,
      content: '',
    };
    
    render(<AssistantMessageAI message={emptyMessage} isStreaming={true} />);
    
    expect(screen.getByTestId('streaming-placeholder-ai')).toBeInTheDocument();
    expect(screen.getByTestId('streaming-cursor-ai')).toBeInTheDocument();
  });

  it('should render assistant avatar', () => {
    render(<AssistantMessageAI message={mockMessage} isStreaming={false} />);
    
    expect(screen.getByTestId('assistant-avatar-ai')).toBeInTheDocument();
  });

  it('should render timestamp', () => {
    render(<AssistantMessageAI message={mockMessage} isStreaming={false} />);
    
    expect(screen.getByTestId('assistant-timestamp-ai')).toBeInTheDocument();
  });

  it('should render children (inline content)', () => {
    render(
      <AssistantMessageAI message={mockMessage} isStreaming={false}>
        <div data-testid="test-child">Test Child</div>
      </AssistantMessageAI>
    );
    
    expect(screen.getByTestId('inline-content-ai')).toBeInTheDocument();
    expect(screen.getByTestId('test-child')).toBeInTheDocument();
  });

  it('should render content parts with tool calls', () => {
    const messageWithTools: Message = {
      ...mockMessage,
      contentParts: [
        { type: 'text', text: 'Let me check that for you.' },
        { 
          type: 'tool', 
          toolCall: { 
            id: 'tool-1', 
            name: 'search', 
            arguments: { query: 'test' } 
          } 
        },
        { type: 'text', text: 'Here are the results.' },
      ],
    };
    
    render(<AssistantMessageAI message={messageWithTools} isStreaming={false} />);
    
    expect(screen.getByText('Let me check that for you.')).toBeInTheDocument();
    expect(screen.getByText('Here are the results.')).toBeInTheDocument();
  });
});

describe('UserMessageAI', () => {
  const mockTimestamp = new Date('2024-01-01T12:00:00Z');

  it('should render user message with content', () => {
    render(
      <UserMessageAI 
        content="What is the weather today?" 
        timestamp={mockTimestamp} 
      />
    );
    
    expect(screen.getByTestId('user-message-ai')).toBeInTheDocument();
    expect(screen.getByTestId('user-content-ai')).toBeInTheDocument();
    expect(screen.getByText('What is the weather today?')).toBeInTheDocument();
  });

  it('should render timestamp', () => {
    render(
      <UserMessageAI 
        content="Test message" 
        timestamp={mockTimestamp} 
      />
    );
    
    expect(screen.getByTestId('user-timestamp-ai')).toBeInTheDocument();
  });

  it('should render file attachments', () => {
    const attachments = [
      {
        name: 'document.pdf',
        contentType: 'application/pdf',
        url: 'https://example.com/document.pdf',
        size: 1024000,
      },
    ];
    
    render(
      <UserMessageAI 
        content="Please review this document" 
        timestamp={mockTimestamp}
        attachments={attachments}
      />
    );
    
    expect(screen.getByTestId('attachment-0')).toBeInTheDocument();
    expect(screen.getByText('document.pdf')).toBeInTheDocument();
    expect(screen.getByText('1000.0 KB')).toBeInTheDocument();
  });

  it('should render image thumbnail for image attachments', () => {
    const attachments = [
      {
        name: 'photo.jpg',
        contentType: 'image/jpeg',
        url: 'https://example.com/photo.jpg',
        size: 512000,
      },
    ];
    
    render(
      <UserMessageAI 
        content="Check out this photo" 
        timestamp={mockTimestamp}
        attachments={attachments}
      />
    );
    
    const img = screen.getByAltText('photo.jpg');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
  });

  it('should render multiple attachments', () => {
    const attachments = [
      {
        name: 'file1.pdf',
        contentType: 'application/pdf',
        url: 'https://example.com/file1.pdf',
        size: 1024,
      },
      {
        name: 'file2.txt',
        contentType: 'text/plain',
        url: 'https://example.com/file2.txt',
        size: 2048,
      },
    ];
    
    render(
      <UserMessageAI 
        content="Here are the files" 
        timestamp={mockTimestamp}
        attachments={attachments}
      />
    );
    
    expect(screen.getByTestId('attachment-0')).toBeInTheDocument();
    expect(screen.getByTestId('attachment-1')).toBeInTheDocument();
    expect(screen.getByText('file1.pdf')).toBeInTheDocument();
    expect(screen.getByText('file2.txt')).toBeInTheDocument();
  });

  it('should not render attachments section when no attachments', () => {
    render(
      <UserMessageAI 
        content="Simple message" 
        timestamp={mockTimestamp}
      />
    );
    
    expect(screen.queryByTestId('attachment-0')).not.toBeInTheDocument();
  });
});

describe('Feature Flag Integration', () => {
  it('should use AI Elements components when feature flag is enabled', () => {
    // This test verifies the component can be imported and rendered
    // The actual feature flag switching is tested in the safeComponent wrapper
    const mockMessage: Message = {
      id: '1',
      role: 'assistant',
      content: 'Test',
      timestamp: new Date(),
    };
    
    const { container } = render(
      <AssistantMessageAI message={mockMessage} isStreaming={false} />
    );
    
    expect(container.querySelector('[data-testid="assistant-message-ai"]')).toBeInTheDocument();
  });
});
