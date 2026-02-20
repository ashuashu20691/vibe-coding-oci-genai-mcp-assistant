/**
 * Unit tests for MobileSidebar component
 * 
 * Tests the hamburger menu button, slide-out drawer, and backdrop overlay
 * for mobile viewport sidebar functionality.
 * 
 * Validates: Requirements 12.2
 */

import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  MobileSidebar, 
  HamburgerButton, 
  HamburgerIcon, 
  CloseIcon 
} from '@/components/MobileSidebar';

// Mock createPortal for testing
vi.mock('react-dom', () => ({
  ...vi.importActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));

describe('MobileSidebar', () => {
  const defaultProps = {
    isOpen: false,
    onToggle: vi.fn(),
    onClose: vi.fn(),
    children: <div data-testid="sidebar-content">Sidebar Content</div>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset body overflow style
    document.body.style.overflow = '';
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
  });

  describe('HamburgerIcon', () => {
    it('renders hamburger icon SVG', () => {
      render(<HamburgerIcon />);
      const svg = document.querySelector('svg');
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    });

    it('applies custom className', () => {
      render(<HamburgerIcon className="custom-class" />);
      const svg = document.querySelector('svg');
      // SVG className is an SVGAnimatedString, use classList or getAttribute
      expect(svg?.classList.contains('custom-class')).toBe(true);
    });
  });

  describe('CloseIcon', () => {
    it('renders close icon SVG', () => {
      render(<CloseIcon />);
      const svg = document.querySelector('svg');
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    });

    it('applies custom className', () => {
      render(<CloseIcon className="custom-class" />);
      const svg = document.querySelector('svg');
      // SVG className is an SVGAnimatedString, use classList or getAttribute
      expect(svg?.classList.contains('custom-class')).toBe(true);
    });
  });

  describe('HamburgerButton', () => {
    it('renders hamburger icon when closed', () => {
      render(<HamburgerButton onClick={vi.fn()} isOpen={false} />);
      const button = screen.getByRole('button', { name: /open menu/i });
      expect(button).toBeTruthy();
      expect(button.getAttribute('aria-expanded')).toBe('false');
    });

    it('renders close icon when open', () => {
      render(<HamburgerButton onClick={vi.fn()} isOpen={true} />);
      const button = screen.getByRole('button', { name: /close menu/i });
      expect(button).toBeTruthy();
      expect(button.getAttribute('aria-expanded')).toBe('true');
    });

    it('calls onClick when clicked', () => {
      const onClick = vi.fn();
      render(<HamburgerButton onClick={onClick} isOpen={false} />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('has accessible aria-controls attribute', () => {
      render(<HamburgerButton onClick={vi.fn()} isOpen={false} />);
      const button = screen.getByRole('button');
      expect(button.getAttribute('aria-controls')).toBe('mobile-sidebar-drawer');
    });

    it('has touch-friendly minimum size', () => {
      render(<HamburgerButton onClick={vi.fn()} isOpen={false} />);
      const button = screen.getByRole('button');
      expect(button.className).toContain('responsive-touch-target');
    });
  });

  describe('MobileSidebar Component', () => {
    it('renders children content', () => {
      render(<MobileSidebar {...defaultProps} isOpen={true} />);
      expect(screen.getByTestId('sidebar-content')).toBeTruthy();
    });

    it('renders with custom title', () => {
      render(<MobileSidebar {...defaultProps} isOpen={true} title="Custom Title" />);
      expect(screen.getByText('Custom Title')).toBeTruthy();
    });

    it('renders default title when not provided', () => {
      render(<MobileSidebar {...defaultProps} isOpen={true} />);
      expect(screen.getByText('Conversations')).toBeTruthy();
    });

    it('has correct aria attributes for accessibility', () => {
      render(<MobileSidebar {...defaultProps} isOpen={true} />);
      const drawer = screen.getByRole('dialog');
      expect(drawer.getAttribute('aria-modal')).toBe('true');
      expect(drawer.getAttribute('id')).toBe('mobile-sidebar-drawer');
    });

    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn();
      render(<MobileSidebar {...defaultProps} isOpen={true} onClose={onClose} />);
      
      const closeButton = screen.getByRole('button', { name: /close menu/i });
      fireEvent.click(closeButton);
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when backdrop is clicked', () => {
      const onClose = vi.fn();
      render(<MobileSidebar {...defaultProps} isOpen={true} onClose={onClose} />);
      
      // Find the backdrop (the element with opacity transition)
      const backdrop = document.querySelector('[aria-hidden="true"]');
      expect(backdrop).toBeTruthy();
      
      fireEvent.click(backdrop!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape key is pressed', () => {
      const onClose = vi.fn();
      render(<MobileSidebar {...defaultProps} isOpen={true} onClose={onClose} />);
      
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose on Escape when closed', () => {
      const onClose = vi.fn();
      render(<MobileSidebar {...defaultProps} isOpen={false} onClose={onClose} />);
      
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('prevents body scroll when open', () => {
      const { rerender } = render(<MobileSidebar {...defaultProps} isOpen={false} />);
      expect(document.body.style.overflow).toBe('');
      
      rerender(<MobileSidebar {...defaultProps} isOpen={true} />);
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores body scroll when closed', () => {
      const { rerender } = render(<MobileSidebar {...defaultProps} isOpen={true} />);
      expect(document.body.style.overflow).toBe('hidden');
      
      rerender(<MobileSidebar {...defaultProps} isOpen={false} />);
      expect(document.body.style.overflow).toBe('');
    });

    it('restores body scroll on unmount', () => {
      const { unmount } = render(<MobileSidebar {...defaultProps} isOpen={true} />);
      expect(document.body.style.overflow).toBe('hidden');
      
      unmount();
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('Drawer Animation Classes', () => {
    it('applies translate-x-0 when open', () => {
      render(<MobileSidebar {...defaultProps} isOpen={true} />);
      const drawer = screen.getByRole('dialog');
      expect(drawer.className).toContain('translate-x-0');
    });

    it('applies -translate-x-full when closed', () => {
      render(<MobileSidebar {...defaultProps} isOpen={false} />);
      const drawer = screen.getByRole('dialog');
      expect(drawer.className).toContain('-translate-x-full');
    });

    it('has transition classes for smooth animation', () => {
      render(<MobileSidebar {...defaultProps} isOpen={true} />);
      const drawer = screen.getByRole('dialog');
      expect(drawer.className).toContain('transition-transform');
      expect(drawer.className).toContain('duration-300');
      expect(drawer.className).toContain('ease-in-out');
    });
  });

  describe('Backdrop Animation', () => {
    it('has opacity-100 when open', () => {
      render(<MobileSidebar {...defaultProps} isOpen={true} />);
      const backdrop = document.querySelector('[aria-hidden="true"]');
      expect(backdrop?.className).toContain('opacity-100');
      expect(backdrop?.className).toContain('pointer-events-auto');
    });

    it('has opacity-0 when closed', () => {
      render(<MobileSidebar {...defaultProps} isOpen={false} />);
      const backdrop = document.querySelector('[aria-hidden="true"]');
      expect(backdrop?.className).toContain('opacity-0');
      expect(backdrop?.className).toContain('pointer-events-none');
    });
  });

  describe('Responsive Sizing', () => {
    it('drawer has appropriate width constraints', () => {
      render(<MobileSidebar {...defaultProps} isOpen={true} />);
      const drawer = screen.getByRole('dialog');
      expect(drawer.className).toContain('w-[280px]');
      expect(drawer.className).toContain('max-w-[85vw]');
    });

    it('drawer is full height', () => {
      render(<MobileSidebar {...defaultProps} isOpen={true} />);
      const drawer = screen.getByRole('dialog');
      expect(drawer.className).toContain('h-full');
    });
  });
});
