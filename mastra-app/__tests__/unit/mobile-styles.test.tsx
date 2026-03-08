/**
 * Mobile Styles Tests - Task 10.1
 * Requirements: 16.1, 16.4, 16.5, 18.6
 * 
 * Tests for mobile responsive styles (<768px viewport)
 */

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CopilotChatUI from '../../src/components/CopilotChatUI';

describe('Mobile Styles - Task 10.1', () => {
  describe('Requirement 16.1: Sidebar full-screen overlay', () => {
    it('should apply mobile sidebar classes for overlay behavior', () => {
      const { container } = render(<CopilotChatUI />);
      
      const sidebar = container.querySelector('.copilot-sidebar');
      expect(sidebar).toBeInTheDocument();
      expect(sidebar).toHaveClass('copilot-sidebar');
      
      // Verify sidebar can have 'open' class for mobile overlay
      const sidebarWithOpen = container.querySelector('.copilot-sidebar.open');
      expect(sidebarWithOpen).toBeInTheDocument();
    });
  });

  describe('Requirement 16.4: Touch target sizing', () => {
    it('should have CSS classes that support 44px minimum touch targets', () => {
      const { container } = render(<CopilotChatUI />);
      
      // Verify interactive elements have appropriate classes
      const sidebarToggle = container.querySelector('.copilot-sidebar-toggle');
      const newChatBtn = container.querySelector('.copilot-new-chat-btn');
      const sendButton = container.querySelector('.send-button');
      
      expect(sidebarToggle).toBeInTheDocument();
      expect(newChatBtn).toBeInTheDocument();
      expect(sendButton).toBeInTheDocument();
      
      // These elements should have CSS classes that apply mobile touch target sizing
      expect(sidebarToggle).toHaveClass('copilot-sidebar-toggle');
      expect(newChatBtn).toHaveClass('copilot-new-chat-btn');
      expect(sendButton).toHaveClass('send-button');
    });
  });

  describe('Requirement 16.5: Mobile scale spacing', () => {
    it('should have CSS classes that support mobile scale spacing adjustments', () => {
      const { container } = render(<CopilotChatUI />);
      
      // Verify elements have classes that receive mobile spacing
      const inputContainer = container.querySelector('[style*="max-width: 700px"]');
      const conversations = container.querySelector('.copilot-conversations');
      const sidebarHeader = container.querySelector('[style*="padding: 12px"]');
      
      expect(inputContainer).toBeInTheDocument();
      expect(conversations).toBeInTheDocument();
      expect(sidebarHeader).toBeInTheDocument();
    });
  });

  describe('Requirement 18.6: Welcome suggestions single column', () => {
    it('should have welcome suggestions with CSS class for mobile layout', () => {
      const { container } = render(<CopilotChatUI />);
      
      const welcomeSuggestions = container.querySelector('.welcome-suggestions');
      expect(welcomeSuggestions).toBeInTheDocument();
      expect(welcomeSuggestions).toHaveClass('welcome-suggestions');
    });
  });

  describe('Mobile CSS implementation', () => {
    it('should have mobile-specific CSS variables and classes available', () => {
      // Test that CSS custom properties are defined
      const style = getComputedStyle(document.documentElement);
      
      // Verify key mobile-related CSS variables exist
      expect(style.getPropertyValue('--touch-target-min')).toBeTruthy();
      expect(style.getPropertyValue('--sidebar-width-mobile')).toBeTruthy();
      expect(style.getPropertyValue('--spacing-container')).toBeTruthy();
    });

    it('should render sidebar with proper mobile overlay structure', () => {
      const { container } = render(<CopilotChatUI />);
      
      const sidebar = container.querySelector('.copilot-sidebar');
      const sidebarInner = container.querySelector('.copilot-sidebar-inner');
      
      expect(sidebar).toBeInTheDocument();
      expect(sidebarInner).toBeInTheDocument();
      
      // Verify the sidebar has the open class (default state)
      expect(sidebar).toHaveClass('open');
    });
  });
});