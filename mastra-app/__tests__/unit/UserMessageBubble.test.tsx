/**
 * Unit tests for UserMessageBubble component
 * 
 * Task 1.1: Create UserMessageBubble component with right-aligned styling
 * Validates: Requirements 1.1, 1.2, 1.4
 * - 1.1: User messages displayed as right-aligned bubbles with distinct styling
 * - 1.2: Full message content with proper text wrapping
 * - 1.4: Visually distinct background color from assistant messages
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { UserMessageBubble } from '@/components/UserMessageBubble';

describe('Task 1.1: UserMessageBubble Component', () => {
  beforeEach(() => {
    // Mock CSS variables
    document.documentElement.style.setProperty('--user-bg', '#f7f7f5');
    document.documentElement.style.setProperty('--text-primary', '#0d0d0d');
    document.documentElement.style.setProperty('--text-muted', '#999999');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('Requirement 1.1: Right-aligned bubble with distinct styling', () => {
    it('should render with right alignment (justify-end)', () => {
      render(
        <UserMessageBubble 
          content="Hello, world!" 
          timestamp={new Date()} 
        />
      );
      
      const container = screen.getByTestId('user-message-bubble');
      expect(container.className).toContain('justify-end');
    });

    it('should have rounded corners (rounded-2xl)', () => {
      render(
        <UserMessageBubble 
          content="Test message" 
          timestamp={new Date()} 
        />
      );
      
      const container = screen.getByTestId('user-message-bubble');
      const bubble = container.querySelector('.rounded-2xl');
      expect(bubble).not.toBeNull();
    });

    it('should have distinct background color using --user-bg CSS variable', () => {
      render(
        <UserMessageBubble 
          content="Test message" 
          timestamp={new Date()} 
        />
      );
      
      const container = screen.getByTestId('user-message-bubble');
      const bubble = container.querySelector('.rounded-2xl');
      expect(bubble).not.toBeNull();
      expect((bubble as HTMLElement).style.background).toBe('var(--user-bg)');
    });
  });

  describe('Requirement 1.2: Full message content with proper text wrapping', () => {
    it('should display the full message content', () => {
      const content = 'This is a test message with some content';
      render(
        <UserMessageBubble 
          content={content} 
          timestamp={new Date()} 
        />
      );
      
      expect(screen.getByText(content)).toBeDefined();
    });

    it('should preserve whitespace with whitespace-pre-wrap', () => {
      const content = 'Line 1\nLine 2\n  Indented line';
      render(
        <UserMessageBubble 
          content={content} 
          timestamp={new Date()} 
        />
      );
      
      // Find the p element specifically
      const textElement = screen.getByText((_, element) => {
        return element?.tagName === 'P' && element?.textContent === content;
      });
      expect(textElement.className).toContain('whitespace-pre-wrap');
    });

    it('should have break-words class for proper text wrapping', () => {
      const content = 'A very long word: supercalifragilisticexpialidocious';
      render(
        <UserMessageBubble 
          content={content} 
          timestamp={new Date()} 
        />
      );
      
      const textElement = screen.getByText(content);
      expect(textElement.className).toContain('break-words');
    });

    it('should handle multi-line content correctly', () => {
      const content = 'First line\nSecond line\nThird line';
      render(
        <UserMessageBubble 
          content={content} 
          timestamp={new Date()} 
        />
      );
      
      // Find the p element specifically
      const textElement = screen.getByText((_, element) => {
        return element?.tagName === 'P' && element?.textContent === content;
      });
      expect(textElement).toBeDefined();
    });

    it('should handle empty content', () => {
      render(
        <UserMessageBubble 
          content="" 
          timestamp={new Date()} 
        />
      );
      
      const container = screen.getByTestId('user-message-bubble');
      expect(container).toBeDefined();
    });
  });

  describe('Max-width constraint (85%)', () => {
    it('should have max-width of 85%', () => {
      render(
        <UserMessageBubble 
          content="Test message" 
          timestamp={new Date()} 
        />
      );
      
      const container = screen.getByTestId('user-message-bubble');
      const innerContainer = container.querySelector('.max-w-\\[85\\%\\]');
      expect(innerContainer).not.toBeNull();
    });
  });

  describe('Timestamp display', () => {
    it('should display "Just now" for recent messages', () => {
      render(
        <UserMessageBubble 
          content="Test message" 
          timestamp={new Date()} 
        />
      );
      
      expect(screen.getByText('Just now')).toBeDefined();
    });

    it('should display relative time for older messages', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      render(
        <UserMessageBubble 
          content="Test message" 
          timestamp={fiveMinutesAgo} 
        />
      );
      
      expect(screen.getByText('5 min ago')).toBeDefined();
    });

    it('should display hours for messages from hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      render(
        <UserMessageBubble 
          content="Test message" 
          timestamp={twoHoursAgo} 
        />
      );
      
      expect(screen.getByText('2 hours ago')).toBeDefined();
    });

    it('should display days for messages from days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      render(
        <UserMessageBubble 
          content="Test message" 
          timestamp={threeDaysAgo} 
        />
      );
      
      expect(screen.getByText('3 days ago')).toBeDefined();
    });

    it('should have title attribute with full timestamp', () => {
      const timestamp = new Date('2024-01-15T10:30:00');
      render(
        <UserMessageBubble 
          content="Test message" 
          timestamp={timestamp} 
        />
      );
      
      const container = screen.getByTestId('user-message-bubble');
      const timestampElement = container.querySelector('[title]');
      expect(timestampElement).not.toBeNull();
      expect(timestampElement?.getAttribute('title')).toContain('2024');
    });
  });

  describe('Accessibility', () => {
    it('should have proper text color using CSS variable', () => {
      render(
        <UserMessageBubble 
          content="Test message" 
          timestamp={new Date()} 
        />
      );
      
      const textElement = screen.getByText('Test message');
      expect(textElement.style.color).toBe('var(--text-primary)');
    });

    it('should have muted color for timestamp', () => {
      render(
        <UserMessageBubble 
          content="Test message" 
          timestamp={new Date()} 
        />
      );
      
      const timestampElement = screen.getByText('Just now');
      expect(timestampElement.style.color).toBe('var(--text-muted)');
    });
  });

  describe('Edge cases', () => {
    it('should handle very long messages', () => {
      const longContent = 'A'.repeat(1000);
      render(
        <UserMessageBubble 
          content={longContent} 
          timestamp={new Date()} 
        />
      );
      
      expect(screen.getByText(longContent)).toBeDefined();
    });

    it('should handle special characters', () => {
      const content = '<script>alert("xss")</script> & "quotes" \'apostrophes\'';
      render(
        <UserMessageBubble 
          content={content} 
          timestamp={new Date()} 
        />
      );
      
      expect(screen.getByText(content)).toBeDefined();
    });

    it('should handle unicode characters', () => {
      const content = '你好世界 🌍 مرحبا';
      render(
        <UserMessageBubble 
          content={content} 
          timestamp={new Date()} 
        />
      );
      
      expect(screen.getByText(content)).toBeDefined();
    });
  });
});
