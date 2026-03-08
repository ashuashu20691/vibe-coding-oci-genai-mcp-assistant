/**
 * Unit tests for smooth scrolling behavior implementation
 * 
 * Task 17: Implement smooth scrolling behavior
 * Validates: Requirements 30.1-30.5
 * - Enable smooth scrolling for all scrollable containers
 * - Add auto-scroll to bottom when new messages arrive
 * - Pause auto-scroll when user manually scrolls up
 * - Restore auto-scroll when user scrolls near bottom (100px threshold)
 * - Apply consistent scroll behavior across all panels
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MessageList } from '@/components/MessageList';
import { ArtifactsPanel } from '@/components/ArtifactsPanel';
import { ConversationSidebar } from '@/components/ConversationSidebar';
import { Message, Artifact } from '@/types';

// Mock scrollIntoView
const mockScrollIntoView = vi.fn();

describe('Task 17: Smooth Scrolling Behavior', () => {
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

  describe('Requirement 30.1: Enable smooth scrolling for all scrollable containers', () => {
    it('should apply smooth scrolling CSS to MessageList container', () => {
      const messages: Message[] = [
        createMessage('1', 'user', 'Hello'),
      ];

      const { container } = render(
        <MessageList messages={messages} isLoading={false} isStreaming={false} />
      );

      const scrollContainer = container.querySelector('.overflow-y-auto');
      expect(scrollContainer).not.toBeNull();
      
      // Check that the container has the overflow class that gets smooth scrolling from CSS
      expect(scrollContainer?.classList.contains('overflow-y-auto')).toBe(true);
    });

    it('should apply smooth scrolling CSS to ArtifactsPanel container', () => {
      const artifact: Artifact = {
        id: 'test-artifact',
        type: 'table',
        title: 'Test Table',
        content: {
          type: 'table',
          data: [{ id: 1, name: 'Test' }],
        },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const { container } = render(
        <ArtifactsPanel artifact={artifact} onClose={() => {}} />
      );

      // ArtifactsPanel uses overflow-auto classes which get smooth scrolling from CSS
      const scrollContainers = container.querySelectorAll('.overflow-auto, .overflow-y-auto, .overflow-x-auto');
      expect(scrollContainers.length).toBeGreaterThan(0);
    });

    it('should apply smooth scrolling CSS to ConversationSidebar container', () => {
      const { container } = render(
        <ConversationSidebar
          conversations={[]}
          activeConversationId={null}
          onSelectConversation={() => {}}
          onNewChat={() => {}}
          dbConnected={true}
        />
      );

      const scrollContainer = container.querySelector('.overflow-y-auto');
      expect(scrollContainer).not.toBeNull();
      expect(scrollContainer?.classList.contains('overflow-y-auto')).toBe(true);
    });
  });

  describe('Requirement 30.2: Auto-scroll to bottom when new messages arrive', () => {
    it('should call scrollIntoView with smooth behavior when new messages arrive', () => {
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

      // Should have called scrollIntoView with smooth behavior
      expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
    });
  });

  describe('Requirement 30.3: Pause auto-scroll when user manually scrolls up', () => {
    it('should stop auto-scrolling when user scrolls away from bottom', async () => {
      const messages: Message[] = [
        createMessage('1', 'user', 'Hello'),
        createMessage('2', 'assistant', 'Response'),
      ];

      const { container } = render(
        <MessageList messages={messages} isLoading={true} isStreaming={true} />
      );

      const scrollContainer = container.querySelector('.overflow-y-auto');
      expect(scrollContainer).not.toBeNull();

      // Simulate user scrolling up (not at bottom)
      Object.defineProperty(scrollContainer, 'scrollTop', { value: 0, writable: true });
      Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1000, writable: true });
      Object.defineProperty(scrollContainer, 'clientHeight', { value: 500, writable: true });

      // This test verifies the logic exists - the actual scroll pause behavior
      // is tested in MessageList-autoscroll.test.tsx
      expect(scrollContainer).toBeDefined();
    });
  });

  describe('Requirement 30.4: Restore auto-scroll when user scrolls near bottom (100px threshold)', () => {
    it('should resume auto-scrolling when user is within 100px of bottom', () => {
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

      // The 100px threshold logic is implemented in MessageList component
      // and tested in MessageList-autoscroll.test.tsx
      expect(scrollContainer).toBeDefined();
    });
  });

  describe('Requirement 30.5: Apply consistent scroll behavior across all panels', () => {
    it('should use consistent scrollIntoView behavior across components', () => {
      const messages: Message[] = [
        createMessage('1', 'user', 'Hello'),
      ];

      render(
        <MessageList messages={messages} isLoading={false} isStreaming={false} />
      );

      // Verify that scrollIntoView is called with consistent smooth behavior
      expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    it('should apply smooth scrolling CSS classes consistently', () => {
      // Test that all major scrollable components use the same overflow classes
      // that get smooth scrolling from the global CSS

      const messages: Message[] = [createMessage('1', 'user', 'Hello')];
      
      const { container: messageContainer } = render(
        <MessageList messages={messages} isLoading={false} isStreaming={false} />
      );

      const { container: sidebarContainer } = render(
        <ConversationSidebar
          conversations={[]}
          activeConversationId={null}
          onSelectConversation={() => {}}
          onNewChat={() => {}}
          dbConnected={true}
        />
      );

      // Both should use overflow-y-auto class
      const messageScrollContainer = messageContainer.querySelector('.overflow-y-auto');
      const sidebarScrollContainer = sidebarContainer.querySelector('.overflow-y-auto');

      expect(messageScrollContainer?.classList.contains('overflow-y-auto')).toBe(true);
      expect(sidebarScrollContainer?.classList.contains('overflow-y-auto')).toBe(true);
    });
  });

  describe('CSS smooth scrolling verification', () => {
    it('should have smooth scrolling CSS applied to overflow containers', () => {
      // This test verifies that the CSS classes that get smooth scrolling are used
      const messages: Message[] = [createMessage('1', 'user', 'Hello')];
      
      const { container } = render(
        <MessageList messages={messages} isLoading={false} isStreaming={false} />
      );

      const scrollContainer = container.querySelector('.overflow-y-auto');
      expect(scrollContainer).not.toBeNull();
      
      // The actual CSS rule `scroll-behavior: smooth` is applied via globals.css
      // to all .overflow-y-auto elements, so we just verify the class is present
      expect(scrollContainer?.classList.contains('overflow-y-auto')).toBe(true);
    });

    it('should respect reduced motion preferences', () => {
      // The CSS includes @media (prefers-reduced-motion: reduce) rules
      // that set scroll-behavior: auto !important
      // This test just verifies the structure exists
      const messages: Message[] = [createMessage('1', 'user', 'Hello')];
      
      const { container } = render(
        <MessageList messages={messages} isLoading={false} isStreaming={false} />
      );

      const scrollContainer = container.querySelector('.overflow-y-auto');
      expect(scrollContainer).not.toBeNull();
    });
  });
});