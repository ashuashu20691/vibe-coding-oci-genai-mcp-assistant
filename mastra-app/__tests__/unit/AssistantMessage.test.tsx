/**
 * Unit tests for AssistantMessage component
 * 
 * Task 2.1: Create AssistantMessage component with left-aligned styling
 * Validates: Requirements 2.1
 * - 2.1: Assistant messages displayed as left-aligned message area
 * - Support for inline visualizations and analysis cards
 * - Streaming cursor shown during active streaming
 * - Tool errors displayed inline (non-blocking)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AssistantMessage } from '@/components/AssistantMessage';
import { Message } from '@/types';

// Mock the MarkdownRenderer component
vi.mock('@/components/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div data-testid="markdown-renderer">{content}</div>
  ),
}));

// Mock the ToolErrorDisplay component
vi.mock('@/components/ToolErrorDisplay', () => ({
  ToolErrorDisplay: ({ error }: { error: { toolName: string; errorMessage: string } }) => (
    <div data-testid="tool-error-display">
      {error.toolName}: {error.errorMessage}
    </div>
  ),
}));

describe('Task 2.1: AssistantMessage Component', () => {
  beforeEach(() => {
    // Mock CSS variables
    document.documentElement.style.setProperty('--bg-secondary', '#f7f7f5');
    document.documentElement.style.setProperty('--text-primary', '#0d0d0d');
    document.documentElement.style.setProperty('--text-muted', '#999999');
    document.documentElement.style.setProperty('--accent', '#10a37f');
    document.documentElement.style.setProperty('--accent-hover', '#0d8a6a');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const createMessage = (overrides: Partial<Message> = {}): Message => ({
    id: 'test-message-1',
    role: 'assistant',
    content: 'Hello, how can I help you today?',
    timestamp: new Date('2024-01-15T10:30:00Z'),
    ...overrides,
  });

  describe('Requirement 2.1: Left-aligned styling', () => {
    it('should render assistant message with left alignment (justify-start)', () => {
      const message = createMessage();
      render(<AssistantMessage message={message} isStreaming={false} />);
      
      const container = screen.getByTestId('assistant-message');
      expect(container).toBeDefined();
      expect(container.className).toContain('justify-start');
    });

    it('should render message content', () => {
      const message = createMessage({ content: 'Test content here' });
      render(<AssistantMessage message={message} isStreaming={false} />);
      
      expect(screen.getByTestId('markdown-renderer').textContent).toBe('Test content here');
    });

    it('should render assistant avatar', () => {
      const message = createMessage();
      render(<AssistantMessage message={message} isStreaming={false} />);
      
      expect(screen.getByTestId('assistant-avatar')).toBeDefined();
    });

    it('should render timestamp', () => {
      const message = createMessage();
      render(<AssistantMessage message={message} isStreaming={false} />);
      
      const timestamp = screen.getByTestId('assistant-timestamp');
      expect(timestamp).toBeDefined();
    });

    it('should apply different background from user messages (--bg-secondary)', () => {
      const message = createMessage();
      render(<AssistantMessage message={message} isStreaming={false} />);
      
      const content = screen.getByTestId('assistant-content');
      expect((content as HTMLElement).style.background).toBe('var(--bg-secondary)');
    });
  });

  describe('Streaming behavior', () => {
    it('should show streaming content when streaming with content', () => {
      const message = createMessage({ content: 'Streaming...' });
      render(<AssistantMessage message={message} isStreaming={true} />);
      
      // The streaming text component handles the cursor internally
      expect(screen.getByTestId('assistant-content')).toBeDefined();
    });

    it('should show streaming placeholder when streaming without content', () => {
      const message = createMessage({ content: '' });
      render(<AssistantMessage message={message} isStreaming={true} />);
      
      expect(screen.getByTestId('streaming-placeholder')).toBeDefined();
      expect(screen.getByTestId('streaming-cursor')).toBeDefined();
    });

    it('should not show streaming placeholder when not streaming', () => {
      const message = createMessage({ content: 'Complete message' });
      render(<AssistantMessage message={message} isStreaming={false} />);
      
      expect(screen.queryByTestId('streaming-placeholder')).toBeNull();
    });
  });

  describe('Task 2.2: Streaming text display with cursor', () => {
    /**
     * Validates: Requirements 2.2, 2.4
     * - 2.2: Character-by-character streaming with smooth animation
     * - 2.4: Remove streaming indicators when response is complete
     */
    
    it('should show blinking cursor during streaming (Requirement 7.2)', () => {
      const message = createMessage({ content: 'Hello world' });
      render(<AssistantMessage message={message} isStreaming={true} />);
      
      const cursor = screen.getByTestId('streaming-cursor');
      expect(cursor).toBeDefined();
      // Verify cursor has pulsating animation
      expect((cursor as HTMLElement).style.animation).toContain('cursor-pulse');
    });

    it('should remove cursor when streaming completes (Requirement 2.4)', () => {
      const message = createMessage({ content: 'Complete message' });
      render(<AssistantMessage message={message} isStreaming={false} />);
      
      // Cursor should not be present when not streaming
      expect(screen.queryByTestId('streaming-cursor')).toBeNull();
    });

    it('should show cursor at end of streaming text', () => {
      const message = createMessage({ content: 'Streaming text here' });
      render(<AssistantMessage message={message} isStreaming={true} />);
      
      const streamingText = screen.getByTestId('streaming-text');
      expect(streamingText).toBeDefined();
      
      // Cursor should be inside the streaming text container
      const cursor = screen.getByTestId('streaming-cursor');
      expect(streamingText.contains(cursor)).toBe(true);
    });

    it('should use StreamingText component when streaming', () => {
      const message = createMessage({ content: 'Test content' });
      render(<AssistantMessage message={message} isStreaming={true} />);
      
      expect(screen.getByTestId('streaming-text')).toBeDefined();
    });

    it('should use MarkdownRenderer directly when not streaming', () => {
      const message = createMessage({ content: 'Test content' });
      render(<AssistantMessage message={message} isStreaming={false} />);
      
      // Should not have streaming-text wrapper
      expect(screen.queryByTestId('streaming-text')).toBeNull();
      // Should have markdown renderer directly
      expect(screen.getByTestId('markdown-renderer')).toBeDefined();
    });

    it('should have cursor with aria-hidden for accessibility', () => {
      const message = createMessage({ content: 'Test' });
      render(<AssistantMessage message={message} isStreaming={true} />);
      
      const cursor = screen.getByTestId('streaming-cursor');
      expect(cursor.getAttribute('aria-hidden')).toBe('true');
    });

    it('should transition from streaming to complete state', () => {
      const message = createMessage({ content: 'Final content' });
      
      // First render with streaming
      const { rerender } = render(<AssistantMessage message={message} isStreaming={true} />);
      expect(screen.getByTestId('streaming-cursor')).toBeDefined();
      
      // Re-render without streaming
      rerender(<AssistantMessage message={message} isStreaming={false} />);
      expect(screen.queryByTestId('streaming-cursor')).toBeNull();
    });
  });

  describe('Tool errors (non-blocking)', () => {
    it('should render tool errors inline when present', () => {
      const message = createMessage({
        toolErrors: [
          {
            toolName: 'test_tool',
            errorMessage: 'Something went wrong',
            timestamp: new Date(),
          },
        ],
      });
      render(<AssistantMessage message={message} isStreaming={false} />);
      
      expect(screen.getByTestId('tool-errors')).toBeDefined();
      expect(screen.getByTestId('tool-error-display').textContent).toContain('test_tool: Something went wrong');
    });

    it('should render multiple tool errors', () => {
      const message = createMessage({
        toolErrors: [
          { toolName: 'tool1', errorMessage: 'Error 1', timestamp: new Date() },
          { toolName: 'tool2', errorMessage: 'Error 2', timestamp: new Date() },
        ],
      });
      render(<AssistantMessage message={message} isStreaming={false} />);
      
      const errors = screen.getAllByTestId('tool-error-display');
      expect(errors.length).toBe(2);
    });

    it('should not render tool errors section when no errors', () => {
      const message = createMessage({ toolErrors: undefined });
      render(<AssistantMessage message={message} isStreaming={false} />);
      
      expect(screen.queryByTestId('tool-errors')).toBeNull();
    });
  });

  describe('Inline content (children for visualizations and analysis cards)', () => {
    it('should render children for inline visualizations and analysis cards', () => {
      const message = createMessage();
      render(
        <AssistantMessage message={message} isStreaming={false}>
          <div data-testid="inline-viz">Visualization</div>
          <div data-testid="inline-analysis">Analysis</div>
        </AssistantMessage>
      );
      
      expect(screen.getByTestId('inline-content')).toBeDefined();
      expect(screen.getByTestId('inline-viz')).toBeDefined();
      expect(screen.getByTestId('inline-analysis')).toBeDefined();
    });

    it('should not render inline content section when no children', () => {
      const message = createMessage();
      render(<AssistantMessage message={message} isStreaming={false} />);
      
      expect(screen.queryByTestId('inline-content')).toBeNull();
    });
  });

  describe('Timestamp formatting', () => {
    it('should show full timestamp on hover via title attribute', () => {
      const message = createMessage({ timestamp: new Date('2024-01-15T10:30:00Z') });
      render(<AssistantMessage message={message} isStreaming={false} />);
      
      const timestamp = screen.getByTestId('assistant-timestamp');
      expect(timestamp.getAttribute('title')).toBeDefined();
      expect(timestamp.getAttribute('title')).toContain('2024');
    });

    it('should use current date when timestamp is not provided', () => {
      const message = createMessage({ timestamp: undefined as unknown as Date });
      render(<AssistantMessage message={message} isStreaming={false} />);
      
      const timestamp = screen.getByTestId('assistant-timestamp');
      expect(timestamp).toBeDefined();
    });
  });

  describe('Styling', () => {
    it('should have max-width constraint to prevent full-width messages', () => {
      const message = createMessage();
      render(<AssistantMessage message={message} isStreaming={false} />);
      
      const container = screen.getByTestId('assistant-message');
      const innerContainer = container.querySelector('.max-w-\\[90\\%\\]');
      expect(innerContainer).not.toBeNull();
    });

    it('should have rounded corners on message bubble', () => {
      const message = createMessage();
      render(<AssistantMessage message={message} isStreaming={false} />);
      
      const content = screen.getByTestId('assistant-content');
      expect(content.className).toContain('rounded-2xl');
    });
  });
});
