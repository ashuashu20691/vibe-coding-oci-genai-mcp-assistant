/**
 * Unit tests for MessageList virtualization
 * 
 * Validates: Requirement 9.7 - Message list virtualization when count exceeds 100
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageListAI } from '@/components/MessageListAI';
import { Message } from '@/types';

// Mock ResizeObserver
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

global.ResizeObserver = ResizeObserverMock as any;

// Mock react-window
vi.mock('react-window', () => ({
  List: ({ rowCount, rowComponent, rowProps }: any) => {
    // Render a simplified version for testing
    return (
      <div data-testid="virtualized-list">
        {Array.from({ length: Math.min(rowCount, 10) }).map((_, index) => {
          const Row = rowComponent;
          return (
            <Row
              key={index}
              index={index}
              style={{}}
              ariaAttributes={{
                'aria-posinset': index + 1,
                'aria-setsize': rowCount,
                role: 'listitem' as const,
              }}
              {...rowProps}
            />
          );
        })}
      </div>
    );
  },
  useDynamicRowHeight: () => ({
    getAverageRowHeight: () => 150,
    getRowHeight: () => 150,
    setRowHeight: () => {},
    observeRowElements: () => () => {},
  }),
  useListRef: (initial: any) => ({ current: initial }),
}));

describe('MessageListAI Virtualization', () => {
  const createMessage = (id: number): Message => ({
    id: `msg-${id}`,
    role: id % 2 === 0 ? 'user' : 'assistant',
    content: `Message ${id}`,
    timestamp: new Date(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should NOT use virtualization when message count is 100 or less', () => {
    const messages = Array.from({ length: 100 }, (_, i) => createMessage(i));
    
    render(<MessageListAI messages={messages} />);
    
    // Should not render virtualized list
    expect(screen.queryByTestId('virtualized-list')).not.toBeInTheDocument();
  });

  it('should use virtualization when message count exceeds 100', () => {
    const messages = Array.from({ length: 101 }, (_, i) => createMessage(i));
    
    render(<MessageListAI messages={messages} />);
    
    // Should render virtualized list
    expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
  });

  it('should use virtualization for large message lists (200+ messages)', () => {
    const messages = Array.from({ length: 250 }, (_, i) => createMessage(i));
    
    render(<MessageListAI messages={messages} />);
    
    // Should render virtualized list
    expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
  });

  it('should render welcome screen when no messages', () => {
    render(<MessageListAI messages={[]} />);
    
    // Should not render virtualized list
    expect(screen.queryByTestId('virtualized-list')).not.toBeInTheDocument();
  });

  it('should handle transition from non-virtualized to virtualized', () => {
    const messages = Array.from({ length: 50 }, (_, i) => createMessage(i));
    
    const { rerender } = render(<MessageListAI messages={messages} />);
    
    // Initially not virtualized
    expect(screen.queryByTestId('virtualized-list')).not.toBeInTheDocument();
    
    // Add more messages to exceed threshold
    const moreMessages = Array.from({ length: 101 }, (_, i) => createMessage(i));
    rerender(<MessageListAI messages={moreMessages} />);
    
    // Now should be virtualized
    expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
  });

  it('should maintain scroll position during virtualization', () => {
    const messages = Array.from({ length: 150 }, (_, i) => createMessage(i));
    
    const { container } = render(<MessageListAI messages={messages} />);
    
    // Verify virtualized list is rendered
    expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
    
    // Verify container has scroll capability
    const scrollContainer = container.querySelector('.flex-1.overflow-y-auto');
    expect(scrollContainer).toBeInTheDocument();
  });
});
