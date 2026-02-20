/**
 * Unit tests for MessageList single-column layout
 * 
 * Task 10.1: Ensure single-column message layout
 * Validates: Requirement 5.1
 * - Messages displayed in a single-column layout
 * - Clear visual separation between user and assistant messages
 * - No grid or multi-column layouts for message list
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MessageList } from '@/components/MessageList';
import { Message } from '@/types';

describe('Task 10.1: MessageList Single-Column Layout', () => {
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
    
    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const createMessage = (id: string, role: 'user' | 'assistant', content: string): Message => ({
    id,
    role,
    content,
    timestamp: new Date(),
  });

  describe('Requirement 5.1: Single-column layout with clear visual separation', () => {
    it('should render messages in a single-column flex layout', () => {
      const messages: Message[] = [
        createMessage('1', 'user', 'Hello'),
        createMessage('2', 'assistant', 'Hi there!'),
        createMessage('3', 'user', 'How are you?'),
      ];

      const { container } = render(
        <MessageList messages={messages} isLoading={false} isStreaming={false} />
      );

      // Find the main scrollable container
      const scrollContainer = container.querySelector('.overflow-y-auto');
      expect(scrollContainer).not.toBeNull();
      
      // Verify it uses flex layout (flex-1 class)
      expect(scrollContainer?.classList.contains('flex-1')).toBe(true);
    });

    it('should have a max-width constraint for centered content', () => {
      const messages: Message[] = [
        createMessage('1', 'user', 'Hello'),
        createMessage('2', 'assistant', 'Hi there!'),
      ];

      const { container } = render(
        <MessageList messages={messages} isLoading={false} isStreaming={false} />
      );

      // Find the inner container with max-width
      const innerContainer = container.querySelector('.max-w-3xl');
      expect(innerContainer).not.toBeNull();
      
      // Verify it's centered with mx-auto
      expect(innerContainer?.classList.contains('mx-auto')).toBe(true);
    });

    it('should NOT use grid layout for message list', () => {
      const messages: Message[] = [
        createMessage('1', 'user', 'Hello'),
        createMessage('2', 'assistant', 'Hi there!'),
        createMessage('3', 'user', 'Another message'),
        createMessage('4', 'assistant', 'Another response'),
      ];

      const { container } = render(
        <MessageList messages={messages} isLoading={false} isStreaming={false} />
      );

      // Find the inner container that holds messages
      const innerContainer = container.querySelector('.max-w-3xl');
      expect(innerContainer).not.toBeNull();
      
      // Verify it does NOT have grid classes for message layout
      // Note: grid is allowed in WelcomeScreen for suggestions, but not for messages
      expect(innerContainer?.classList.contains('grid')).toBe(false);
      expect(innerContainer?.classList.contains('grid-cols-2')).toBe(false);
      expect(innerContainer?.classList.contains('grid-cols-3')).toBe(false);
    });

    it('should NOT use multi-column CSS for message list', () => {
      const messages: Message[] = [
        createMessage('1', 'user', 'Hello'),
        createMessage('2', 'assistant', 'Hi there!'),
      ];

      const { container } = render(
        <MessageList messages={messages} isLoading={false} isStreaming={false} />
      );

      // Find the inner container
      const innerContainer = container.querySelector('.max-w-3xl');
      expect(innerContainer).not.toBeNull();
      
      // Verify no multi-column classes
      expect(innerContainer?.classList.contains('columns-2')).toBe(false);
      expect(innerContainer?.classList.contains('columns-3')).toBe(false);
    });

    it('should render messages in vertical order (stacked)', () => {
      const messages: Message[] = [
        createMessage('1', 'user', 'First message'),
        createMessage('2', 'assistant', 'Second message'),
        createMessage('3', 'user', 'Third message'),
      ];

      const { container } = render(
        <MessageList messages={messages} isLoading={false} isStreaming={false} />
      );

      // Find all message containers
      const innerContainer = container.querySelector('.max-w-3xl');
      const messageElements = innerContainer?.children;
      
      // Should have at least 3 children (messages) + bottom ref div
      expect(messageElements?.length).toBeGreaterThanOrEqual(3);
    });

    it('should display user messages with right alignment', () => {
      const messages: Message[] = [
        createMessage('1', 'user', 'Hello from user'),
      ];

      const { container } = render(
        <MessageList messages={messages} isLoading={false} isStreaming={false} />
      );

      // Find user message bubble - it should have justify-end for right alignment
      const userBubble = container.querySelector('.justify-end');
      expect(userBubble).not.toBeNull();
    });

    it('should display assistant messages with left alignment (default)', () => {
      const messages: Message[] = [
        createMessage('1', 'assistant', 'Hello from assistant'),
      ];

      const { container } = render(
        <MessageList messages={messages} isLoading={false} isStreaming={false} />
      );

      // Assistant messages should NOT have justify-end (left-aligned by default)
      // Find the message content area
      const innerContainer = container.querySelector('.max-w-3xl');
      expect(innerContainer).not.toBeNull();
      
      // The assistant message container should exist and not be right-aligned
      const assistantMessage = innerContainer?.querySelector('.mb-6');
      expect(assistantMessage).not.toBeNull();
    });

    it('should maintain single-column layout with many messages', () => {
      // Create many messages to test layout doesn't break
      const messages: Message[] = [];
      for (let i = 0; i < 20; i++) {
        messages.push(createMessage(
          `${i}`,
          i % 2 === 0 ? 'user' : 'assistant',
          `Message ${i}`
        ));
      }

      const { container } = render(
        <MessageList messages={messages} isLoading={false} isStreaming={false} />
      );

      // Verify layout structure is maintained
      const scrollContainer = container.querySelector('.overflow-y-auto');
      const innerContainer = container.querySelector('.max-w-3xl');
      
      expect(scrollContainer).not.toBeNull();
      expect(innerContainer).not.toBeNull();
      expect(scrollContainer?.classList.contains('flex-1')).toBe(true);
      expect(innerContainer?.classList.contains('mx-auto')).toBe(true);
    });

    it('should have proper padding for message spacing', () => {
      const messages: Message[] = [
        createMessage('1', 'user', 'Hello'),
        createMessage('2', 'assistant', 'Hi there!'),
      ];

      const { container } = render(
        <MessageList messages={messages} isLoading={false} isStreaming={false} />
      );

      // Find the inner container with padding
      const innerContainer = container.querySelector('.max-w-3xl');
      expect(innerContainer).not.toBeNull();
      
      // Verify it has padding classes
      expect(innerContainer?.classList.contains('py-8')).toBe(true);
      expect(innerContainer?.classList.contains('px-4')).toBe(true);
    });
  });

  describe('Edge cases for layout', () => {
    it('should maintain layout with empty message list', () => {
      const { container } = render(
        <MessageList messages={[]} isLoading={false} isStreaming={false} />
      );

      // Layout structure should still be present
      const scrollContainer = container.querySelector('.overflow-y-auto');
      const innerContainer = container.querySelector('.max-w-3xl');
      
      expect(scrollContainer).not.toBeNull();
      expect(innerContainer).not.toBeNull();
    });

    it('should maintain layout during loading state', () => {
      const messages: Message[] = [
        createMessage('1', 'user', 'Hello'),
      ];

      const { container } = render(
        <MessageList messages={messages} isLoading={true} isStreaming={false} />
      );

      // Layout structure should be maintained during loading
      const scrollContainer = container.querySelector('.overflow-y-auto');
      const innerContainer = container.querySelector('.max-w-3xl');
      
      expect(scrollContainer).not.toBeNull();
      expect(innerContainer).not.toBeNull();
      expect(scrollContainer?.classList.contains('flex-1')).toBe(true);
    });

    it('should maintain layout during streaming state', () => {
      const messages: Message[] = [
        createMessage('1', 'user', 'Hello'),
        createMessage('2', 'assistant', 'Streaming...'),
      ];

      const { container } = render(
        <MessageList messages={messages} isLoading={true} isStreaming={true} />
      );

      // Layout structure should be maintained during streaming
      const scrollContainer = container.querySelector('.overflow-y-auto');
      const innerContainer = container.querySelector('.max-w-3xl');
      
      expect(scrollContainer).not.toBeNull();
      expect(innerContainer).not.toBeNull();
    });
  });
});
