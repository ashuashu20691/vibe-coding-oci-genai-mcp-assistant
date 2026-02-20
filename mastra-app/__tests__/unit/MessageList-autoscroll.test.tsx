/**
 * Unit tests for MessageList auto-scroll behavior
 * 
 * Task 2.4: Implement auto-scroll behavior during streaming
 * Validates: Requirement 2.5
 * - Auto-scroll to latest content unless user has scrolled up
 * - Reset scroll tracking when new message is submitted
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { MessageList } from '@/components/MessageList';
import { Message } from '@/types';

// Mock scrollIntoView
const mockScrollIntoView = vi.fn();

describe('Task 2.4: MessageList Auto-scroll Behavior', () => {
  beforeEach(() => {
    // Mock CSS variables
    document.documentElement.style.setProperty('--bg-primary', '#ffffff');
    document.documentElement.style.setProperty('--bg-secondary', '#f7f7f5');
    document.documentElement.style.setProperty('--text-primary', '#0d0d0d');
    document.documentElement.style.setProperty('--text-secondary', '#666666');
    document.documentElement.style.setProperty('--text-muted', '#999999');
    document.documentElement.style.setProperty('--border-color', '#e5e5e5');
    document.documentElement.style.setProperty('--user-bg', '#f0f0f0');
    document.documentElement.style.setProperty('--accent', '#10a37f');
    
    // Mock scrollIntoView on Element prototype
    Element.prototype.scrollIntoView = mockScrollIntoView;
    
    // Reset timers
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  const createMessage = (id: string, role: 'user' | 'assistant', content: string): Message => ({
    id,
    role,
    content,
    timestamp: new Date(),
  });

  describe('Requirement 2.5: Auto-scroll to latest content during streaming', () => {
    it('should scroll to bottom when messages change', async () => {
      const messages: Message[] = [
        createMessage('1', 'user', 'Hello'),
      ];

      const { rerender } = render(
        <MessageList messages={messages} isLoading={false} isStreaming={false} />
      );

      // Clear initial scroll calls
      mockScrollIntoView.mockClear();

      // Add a new message
      const updatedMessages = [
        ...messages,
        createMessage('2', 'assistant', 'Hi there!'),
      ];

      rerender(
        <MessageList messages={updatedMessages} isLoading={false} isStreaming={false} />
      );

      // Should have called scrollIntoView
      expect(mockScrollIntoView).toHaveBeenCalled();
    });

    it('should continuously scroll during streaming', async () => {
      const messages: Message[] = [
        createMessage('1', 'user', 'Hello'),
        createMessage('2', 'assistant', 'Streaming response...'),
      ];

      render(
        <MessageList messages={messages} isLoading={true} isStreaming={true} />
      );

      // Clear initial scroll calls
      mockScrollIntoView.mockClear();

      // Advance timers to trigger the streaming scroll interval
      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Should have called scrollIntoView multiple times during streaming
      expect(mockScrollIntoView.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('should stop auto-scrolling when user scrolls up', async () => {
      const messages: Message[] = [
        createMessage('1', 'user', 'Hello'),
        createMessage('2', 'assistant', 'Response'),
      ];

      const { container } = render(
        <MessageList messages={messages} isLoading={true} isStreaming={true} />
      );

      // Find the scrollable container
      const scrollContainer = container.querySelector('.overflow-y-auto');
      expect(scrollContainer).not.toBeNull();

      // Simulate user scrolling up (not at bottom)
      Object.defineProperty(scrollContainer, 'scrollTop', { value: 0, writable: true });
      Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1000, writable: true });
      Object.defineProperty(scrollContainer, 'clientHeight', { value: 500, writable: true });

      fireEvent.scroll(scrollContainer!);

      // Clear scroll calls after user scroll
      mockScrollIntoView.mockClear();

      // Advance timers
      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Should NOT have called scrollIntoView since user scrolled up
      expect(mockScrollIntoView).not.toHaveBeenCalled();
    });

    it('should resume auto-scrolling when user scrolls back to bottom', async () => {
      const messages: Message[] = [
        createMessage('1', 'user', 'Hello'),
        createMessage('2', 'assistant', 'Response'),
      ];

      const { container } = render(
        <MessageList messages={messages} isLoading={true} isStreaming={true} />
      );

      const scrollContainer = container.querySelector('.overflow-y-auto');
      expect(scrollContainer).not.toBeNull();

      // First, simulate user scrolling up
      Object.defineProperty(scrollContainer, 'scrollTop', { value: 0, writable: true });
      Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1000, writable: true });
      Object.defineProperty(scrollContainer, 'clientHeight', { value: 500, writable: true });
      fireEvent.scroll(scrollContainer!);

      // Then, simulate user scrolling back to bottom (within 100px threshold)
      Object.defineProperty(scrollContainer, 'scrollTop', { value: 450, writable: true });
      fireEvent.scroll(scrollContainer!);

      // Clear scroll calls
      mockScrollIntoView.mockClear();

      // Advance timers
      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Should have called scrollIntoView since user is at bottom
      expect(mockScrollIntoView).toHaveBeenCalled();
    });
  });

  describe('Reset scroll tracking when new message is submitted', () => {
    it('should reset scroll tracking when isLoading transitions to true', async () => {
      const messages: Message[] = [
        createMessage('1', 'user', 'Hello'),
        createMessage('2', 'assistant', 'Response'),
      ];

      const { container, rerender } = render(
        <MessageList messages={messages} isLoading={false} isStreaming={false} />
      );

      const scrollContainer = container.querySelector('.overflow-y-auto');
      
      // Simulate user scrolling up
      Object.defineProperty(scrollContainer, 'scrollTop', { value: 0, writable: true });
      Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1000, writable: true });
      Object.defineProperty(scrollContainer, 'clientHeight', { value: 500, writable: true });
      fireEvent.scroll(scrollContainer!);

      // Clear scroll calls
      mockScrollIntoView.mockClear();

      // Simulate new message submission (isLoading becomes true)
      rerender(
        <MessageList messages={messages} isLoading={true} isStreaming={false} />
      );

      // Should have force-scrolled to bottom (reset scroll tracking)
      expect(mockScrollIntoView).toHaveBeenCalled();
    });

    it('should reset scroll tracking when message count increases', async () => {
      const messages: Message[] = [
        createMessage('1', 'user', 'Hello'),
      ];

      const { container, rerender } = render(
        <MessageList messages={messages} isLoading={false} isStreaming={false} />
      );

      const scrollContainer = container.querySelector('.overflow-y-auto');
      
      // Simulate user scrolling up
      Object.defineProperty(scrollContainer, 'scrollTop', { value: 0, writable: true });
      Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1000, writable: true });
      Object.defineProperty(scrollContainer, 'clientHeight', { value: 500, writable: true });
      fireEvent.scroll(scrollContainer!);

      // Clear scroll calls
      mockScrollIntoView.mockClear();

      // Add a new message
      const updatedMessages = [
        ...messages,
        createMessage('2', 'user', 'Another message'),
      ];

      rerender(
        <MessageList messages={updatedMessages} isLoading={false} isStreaming={false} />
      );

      // Should have force-scrolled to bottom (reset scroll tracking)
      expect(mockScrollIntoView).toHaveBeenCalled();
    });
  });

  describe('Scroll threshold behavior', () => {
    it('should consider user at bottom when within 100px of bottom', async () => {
      const messages: Message[] = [
        createMessage('1', 'user', 'Hello'),
      ];

      const { container } = render(
        <MessageList messages={messages} isLoading={true} isStreaming={true} />
      );

      const scrollContainer = container.querySelector('.overflow-y-auto');
      
      // Simulate being 50px from bottom (within threshold)
      Object.defineProperty(scrollContainer, 'scrollTop', { value: 450, writable: true });
      Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1000, writable: true });
      Object.defineProperty(scrollContainer, 'clientHeight', { value: 500, writable: true });
      fireEvent.scroll(scrollContainer!);

      // Clear scroll calls
      mockScrollIntoView.mockClear();

      // Advance timers
      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Should continue auto-scrolling since within threshold
      expect(mockScrollIntoView).toHaveBeenCalled();
    });

    it('should stop auto-scrolling when more than 100px from bottom', async () => {
      const messages: Message[] = [
        createMessage('1', 'user', 'Hello'),
      ];

      const { container } = render(
        <MessageList messages={messages} isLoading={true} isStreaming={true} />
      );

      const scrollContainer = container.querySelector('.overflow-y-auto');
      
      // Simulate being 200px from bottom (outside threshold)
      Object.defineProperty(scrollContainer, 'scrollTop', { value: 300, writable: true });
      Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1000, writable: true });
      Object.defineProperty(scrollContainer, 'clientHeight', { value: 500, writable: true });
      fireEvent.scroll(scrollContainer!);

      // Clear scroll calls
      mockScrollIntoView.mockClear();

      // Advance timers
      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Should NOT auto-scroll since outside threshold
      expect(mockScrollIntoView).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty message list', () => {
      render(
        <MessageList messages={[]} isLoading={false} isStreaming={false} />
      );

      // Should render without errors
      expect(screen.getByText('How can I help you today?')).toBeDefined();
    });

    it('should handle rapid message updates', async () => {
      const messages: Message[] = [
        createMessage('1', 'user', 'Hello'),
      ];

      const { rerender } = render(
        <MessageList messages={messages} isLoading={true} isStreaming={true} />
      );

      // Rapidly update messages
      for (let i = 0; i < 5; i++) {
        const updatedMessages = [
          ...messages,
          createMessage(`${i + 2}`, 'assistant', `Response ${i}`),
        ];
        rerender(
          <MessageList messages={updatedMessages} isLoading={true} isStreaming={true} />
        );
      }

      // Should not throw errors
      expect(mockScrollIntoView).toHaveBeenCalled();
    });

    it('should clean up interval when streaming stops', async () => {
      const messages: Message[] = [
        createMessage('1', 'user', 'Hello'),
        createMessage('2', 'assistant', 'Response'),
      ];

      const { rerender } = render(
        <MessageList messages={messages} isLoading={true} isStreaming={true} />
      );

      // Clear initial calls
      mockScrollIntoView.mockClear();

      // Stop streaming
      rerender(
        <MessageList messages={messages} isLoading={false} isStreaming={false} />
      );

      // Advance timers significantly
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Should not have many scroll calls after streaming stopped
      // (only the initial scroll from the rerender)
      expect(mockScrollIntoView.mock.calls.length).toBeLessThanOrEqual(2);
    });
  });
});
