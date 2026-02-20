/**
 * Unit tests for FullscreenOverlay component
 * Task 7.7: Add fullscreen mode for visualizations
 * Validates: Requirements 5.7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { FullscreenOverlay, FullscreenButton } from '@/components/FullscreenOverlay';

describe('Task 7.7: Fullscreen Mode for Visualizations', () => {
  beforeEach(() => {
    // Reset body overflow style before each test
    document.body.style.overflow = '';
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
  });

  describe('FullscreenOverlay Component', () => {
    it('should not render when isOpen is false', () => {
      const { container } = render(
        <FullscreenOverlay isOpen={false} onClose={() => {}}>
          <div>Content</div>
        </FullscreenOverlay>
      );

      expect(container.querySelector('.fullscreen-overlay')).toBeFalsy();
    });

    it('should render when isOpen is true', () => {
      const { container } = render(
        <FullscreenOverlay isOpen={true} onClose={() => {}}>
          <div>Content</div>
        </FullscreenOverlay>
      );

      expect(container.querySelector('.fullscreen-overlay')).toBeTruthy();
    });

    it('should display the provided title', () => {
      render(
        <FullscreenOverlay isOpen={true} onClose={() => {}} title="Test Chart">
          <div>Content</div>
        </FullscreenOverlay>
      );

      expect(screen.getByText('Test Chart')).toBeTruthy();
    });

    it('should display default title when no title provided', () => {
      render(
        <FullscreenOverlay isOpen={true} onClose={() => {}}>
          <div>Content</div>
        </FullscreenOverlay>
      );

      expect(screen.getByText('Fullscreen View')).toBeTruthy();
    });

    it('should render children content', () => {
      const { container } = render(
        <FullscreenOverlay isOpen={true} onClose={() => {}}>
          <div className="child-content">Child Content</div>
        </FullscreenOverlay>
      );

      expect(container.querySelector('.child-content')).toBeTruthy();
      expect(screen.getByText('Child Content')).toBeTruthy();
    });

    it('should call onClose when close button is clicked', () => {
      const onClose = vi.fn();
      const { container } = render(
        <FullscreenOverlay isOpen={true} onClose={onClose}>
          <div>Content</div>
        </FullscreenOverlay>
      );

      const closeBtn = container.querySelector('.fullscreen-close-btn');
      expect(closeBtn).toBeTruthy();
      fireEvent.click(closeBtn!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when Escape key is pressed', () => {
      const onClose = vi.fn();
      render(
        <FullscreenOverlay isOpen={true} onClose={onClose}>
          <div>Content</div>
        </FullscreenOverlay>
      );

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose for other keys', () => {
      const onClose = vi.fn();
      render(
        <FullscreenOverlay isOpen={true} onClose={onClose}>
          <div>Content</div>
        </FullscreenOverlay>
      );

      fireEvent.keyDown(document, { key: 'Enter' });
      fireEvent.keyDown(document, { key: 'a' });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('should prevent body scroll when open', () => {
      render(
        <FullscreenOverlay isOpen={true} onClose={() => {}}>
          <div>Content</div>
        </FullscreenOverlay>
      );

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('should restore body scroll when closed', () => {
      const { rerender } = render(
        <FullscreenOverlay isOpen={true} onClose={() => {}}>
          <div>Content</div>
        </FullscreenOverlay>
      );

      expect(document.body.style.overflow).toBe('hidden');

      rerender(
        <FullscreenOverlay isOpen={false} onClose={() => {}}>
          <div>Content</div>
        </FullscreenOverlay>
      );

      expect(document.body.style.overflow).toBe('');
    });

    it('should display Escape key hint', () => {
      render(
        <FullscreenOverlay isOpen={true} onClose={() => {}}>
          <div>Content</div>
        </FullscreenOverlay>
      );

      expect(screen.getByText('Esc')).toBeTruthy();
    });
  });

  describe('FullscreenButton Component', () => {
    it('should render the fullscreen toggle button', () => {
      const { container } = render(<FullscreenButton onClick={() => {}} />);

      expect(container.querySelector('.fullscreen-toggle-btn')).toBeTruthy();
    });

    it('should call onClick when clicked', () => {
      const onClick = vi.fn();
      const { container } = render(<FullscreenButton onClick={onClick} />);

      const button = container.querySelector('.fullscreen-toggle-btn');
      expect(button).toBeTruthy();
      fireEvent.click(button!);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should have accessible label', () => {
      const { container } = render(<FullscreenButton onClick={() => {}} />);

      const button = container.querySelector('.fullscreen-toggle-btn');
      expect(button).toBeTruthy();
      expect(button?.getAttribute('aria-label')).toBe('Toggle fullscreen');
      expect(button?.getAttribute('title')).toBe('View fullscreen');
    });

    it('should apply custom className', () => {
      const { container } = render(<FullscreenButton onClick={() => {}} className="custom-class" />);

      const button = container.querySelector('.fullscreen-toggle-btn');
      expect(button).toBeTruthy();
      expect(button?.classList.contains('custom-class')).toBe(true);
    });
  });
});
