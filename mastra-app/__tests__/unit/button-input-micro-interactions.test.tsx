/**
 * Unit Tests for Button and Input Micro-interactions
 * Task 9.4: Add micro-interactions for buttons and inputs
 * Requirements: 13.4, 13.5
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

describe('Button Micro-interactions', () => {
  describe('Hover Effects - Requirement 13.4', () => {
    it('should apply hover styles when button is hovered', () => {
      render(<Button>Test Button</Button>);
      const button = screen.getByRole('button', { name: /test button/i });
      
      // Check that button has hover transition classes
      expect(button.className).toContain('transition-all');
      expect(button.className).toContain('duration-200');
      expect(button.className).toContain('hover:scale-[1.02]');
    });

    it('should apply hover shadow for default variant', () => {
      render(<Button variant="default">Default Button</Button>);
      const button = screen.getByRole('button', { name: /default button/i });
      
      expect(button.className).toContain('hover:shadow-md');
    });

    it('should apply hover shadow for destructive variant', () => {
      render(<Button variant="destructive">Delete</Button>);
      const button = screen.getByRole('button', { name: /delete/i });
      
      expect(button.className).toContain('hover:shadow-md');
    });

    it('should apply hover border for outline variant', () => {
      render(<Button variant="outline">Outline Button</Button>);
      const button = screen.getByRole('button', { name: /outline button/i });
      
      expect(button.className).toContain('hover:border-accent');
    });

    it('should not apply hover effects when disabled', () => {
      render(<Button disabled>Disabled Button</Button>);
      const button = screen.getByRole('button', { name: /disabled button/i });
      
      expect(button).toBeDisabled();
      expect(button.className).toContain('disabled:pointer-events-none');
      expect(button.className).toContain('disabled:opacity-50');
    });
  });

  describe('Active/Click Effects - Requirement 13.4', () => {
    it('should apply active scale effect', () => {
      render(<Button>Click Me</Button>);
      const button = screen.getByRole('button', { name: /click me/i });
      
      expect(button.className).toContain('active:scale-[0.98]');
    });

    it('should create ripple effect on click', async () => {
      render(<Button>Ripple Button</Button>);
      const button = screen.getByRole('button', { name: /ripple button/i });
      
      // Click the button
      fireEvent.click(button);
      
      // Check that ripple element was created
      await waitFor(() => {
        const ripple = button.querySelector('.ripple');
        expect(ripple).toBeInTheDocument();
      }, { timeout: 100 });
    });

    it('should remove ripple after animation completes', async () => {
      render(<Button>Ripple Button</Button>);
      const button = screen.getByRole('button', { name: /ripple button/i });
      
      fireEvent.click(button);
      
      // Wait for ripple to be removed (600ms animation)
      await waitFor(() => {
        const ripple = button.querySelector('.ripple');
        expect(ripple).not.toBeInTheDocument();
      }, { timeout: 700 });
    });

    it('should call onClick handler when clicked', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click Handler</Button>);
      const button = screen.getByRole('button', { name: /click handler/i });
      
      fireEvent.click(button);
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should remove previous ripple before creating new one', async () => {
      render(<Button>Multi Click</Button>);
      const button = screen.getByRole('button', { name: /multi click/i });
      
      // First click
      fireEvent.click(button);
      await waitFor(() => {
        expect(button.querySelector('.ripple')).toBeInTheDocument();
      });
      
      // Second click immediately
      fireEvent.click(button);
      
      // Should only have one ripple at a time
      const ripples = button.querySelectorAll('.ripple');
      expect(ripples.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Focus Effects - Requirement 13.4', () => {
    it('should apply focus-visible styles', () => {
      render(<Button>Focus Button</Button>);
      const button = screen.getByRole('button', { name: /focus button/i });
      
      expect(button.className).toContain('focus-visible:outline-none');
      expect(button.className).toContain('focus-visible:ring-2');
      expect(button.className).toContain('focus-visible:ring-ring');
      expect(button.className).toContain('focus-visible:ring-offset-2');
    });
  });

  describe('Button Variants', () => {
    it('should render all variants with hover effects', () => {
      const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const;
      
      variants.forEach(variant => {
        const { container } = render(<Button variant={variant}>{variant}</Button>);
        const button = screen.getByRole('button', { name: variant });
        
        expect(button.className).toContain('transition-all');
        
        // Clean up for next iteration
        container.remove();
      });
    });
  });
});

describe('Input Micro-interactions', () => {
  describe('Focus Animations - Requirement 13.5', () => {
    it('should apply focus-visible styles with animation', () => {
      render(<Input placeholder="Test Input" />);
      const input = screen.getByPlaceholderText(/test input/i);
      
      expect(input.className).toContain('focus-visible:outline-none');
      expect(input.className).toContain('focus-visible:ring-2');
      expect(input.className).toContain('focus-visible:ring-ring');
      expect(input.className).toContain('focus-visible:ring-offset-2');
    });

    it('should apply scale animation on focus', () => {
      render(<Input placeholder="Scale Input" />);
      const input = screen.getByPlaceholderText(/scale input/i);
      
      expect(input.className).toContain('focus-visible:scale-[1.01]');
    });

    it('should apply border color change on focus', () => {
      render(<Input placeholder="Border Input" />);
      const input = screen.getByPlaceholderText(/border input/i);
      
      expect(input.className).toContain('focus-visible:border-ring');
    });

    it('should apply transition for smooth animation', () => {
      render(<Input placeholder="Transition Input" />);
      const input = screen.getByPlaceholderText(/transition input/i);
      
      expect(input.className).toContain('transition-all');
      expect(input.className).toContain('duration-200');
      expect(input.className).toContain('ease-in-out');
    });

    it('should trigger focus animation when input receives focus', async () => {
      const user = userEvent.setup();
      render(<Input placeholder="Focus Test" />);
      const input = screen.getByPlaceholderText(/focus test/i);
      
      // Focus the input using userEvent
      await user.click(input);
      
      // Input should be focused
      expect(input).toHaveFocus();
    });

    it('should remove focus styles when input loses focus', async () => {
      const user = userEvent.setup();
      render(
        <>
          <Input placeholder="Blur Test" />
          <button>Other Element</button>
        </>
      );
      const input = screen.getByPlaceholderText(/blur test/i);
      const button = screen.getByRole('button', { name: /other element/i });
      
      // Focus the input
      await user.click(input);
      expect(input).toHaveFocus();
      
      // Focus another element to blur the input
      await user.click(button);
      expect(input).not.toHaveFocus();
    });
  });

  describe('Hover Effects - Requirement 13.5', () => {
    it('should apply hover border color', () => {
      render(<Input placeholder="Hover Input" />);
      const input = screen.getByPlaceholderText(/hover input/i);
      
      expect(input.className).toContain('hover:border-ring/50');
    });
  });

  describe('Disabled State', () => {
    it('should not apply hover/focus effects when disabled', () => {
      render(<Input placeholder="Disabled Input" disabled />);
      const input = screen.getByPlaceholderText(/disabled input/i);
      
      expect(input).toBeDisabled();
      expect(input.className).toContain('disabled:cursor-not-allowed');
      expect(input.className).toContain('disabled:opacity-50');
    });
  });

  describe('Input Types', () => {
    it('should apply animations to text input', () => {
      render(<Input type="text" placeholder="Text" />);
      const input = screen.getByPlaceholderText(/text/i);
      
      expect(input.className).toContain('transition-all');
    });

    it('should apply animations to email input', () => {
      render(<Input type="email" placeholder="Email" />);
      const input = screen.getByPlaceholderText(/email/i);
      
      expect(input.className).toContain('transition-all');
    });

    it('should apply animations to password input', () => {
      render(<Input type="password" placeholder="Password" />);
      const input = screen.getByPlaceholderText(/password/i);
      
      expect(input.className).toContain('transition-all');
    });
  });
});

describe('Accessibility', () => {
  it('should maintain keyboard navigation for buttons', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Keyboard Button</Button>);
    const button = screen.getByRole('button', { name: /keyboard button/i });
    
    // Tab to button
    await user.tab();
    expect(button).toHaveFocus();
    
    // Enter should trigger click
    await user.keyboard('{Enter}');
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should maintain keyboard navigation for inputs', async () => {
    const user = userEvent.setup();
    render(<Input placeholder="Keyboard Input" />);
    const input = screen.getByPlaceholderText(/keyboard input/i);
    
    // Tab to input
    await user.tab();
    expect(input).toHaveFocus();
    
    // Should be able to type
    await user.type(input, 'test');
    expect(input).toHaveValue('test');
  });

  it('should show focus indicators for keyboard users', () => {
    render(
      <>
        <Button>Button 1</Button>
        <Input placeholder="Input 1" />
      </>
    );
    
    const button = screen.getByRole('button', { name: /button 1/i });
    const input = screen.getByPlaceholderText(/input 1/i);
    
    // Both should have focus-visible classes
    expect(button.className).toContain('focus-visible:ring-2');
    expect(input.className).toContain('focus-visible:ring-2');
  });
});

describe('Performance', () => {
  it('should use efficient transitions', () => {
    render(<Button>Performance Button</Button>);
    const button = screen.getByRole('button', { name: /performance button/i });
    
    // Should use duration-200 (200ms) for fast transitions
    expect(button.className).toContain('duration-200');
    expect(button.className).toContain('ease-in-out');
  });

  it('should use efficient input transitions', () => {
    render(<Input placeholder="Performance Input" />);
    const input = screen.getByPlaceholderText(/performance input/i);
    
    // Should use duration-200 (200ms) for fast transitions
    expect(input.className).toContain('duration-200');
    expect(input.className).toContain('ease-in-out');
  });

  it('should clean up ripple elements', async () => {
    render(<Button>Cleanup Button</Button>);
    const button = screen.getByRole('button', { name: /cleanup button/i });
    
    // Create multiple ripples
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    
    // Wait for cleanup (600ms + buffer)
    await waitFor(() => {
      const ripples = button.querySelectorAll('.ripple');
      expect(ripples.length).toBe(0);
    }, { timeout: 800 });
  });
});
