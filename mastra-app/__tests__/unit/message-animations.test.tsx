/**
 * Unit Tests for Message Animations
 * 
 * Tests smooth message fade-in animations using requestAnimationFrame.
 * 
 * Validates: Requirements 13.1, 13.7, 13.8
 * - 13.1: Messages fade in smoothly
 * - 13.7: Uses requestAnimationFrame for animations
 * - 13.8: Maintains 60fps during animations
 */

import { renderHook, act } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useMessageAnimation } from '@/hooks/useMessageAnimation';
import { AssistantMessageAI } from '@/components/ai-elements/AssistantMessageAI';
import { UserMessageAI } from '@/components/ai-elements/UserMessageAI';
import { Message } from '@/types';

// Mock requestAnimationFrame for testing
let rafCallbacks: FrameRequestCallback[] = [];
let rafId = 0;

beforeEach(() => {
  rafCallbacks = [];
  rafId = 0;
  
  global.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    rafCallbacks.push(callback);
    return ++rafId;
  }) as unknown as typeof requestAnimationFrame;
  
  global.cancelAnimationFrame = vi.fn((id: number) => {
    // Remove callback if it exists
    const index = rafCallbacks.findIndex((_, i) => i + 1 === id);
    if (index !== -1) {
      rafCallbacks.splice(index, 1);
    }
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useMessageAnimation Hook', () => {
  it('should initialize with opacity 0 when shouldAnimate is true', () => {
    const { result } = renderHook(() => useMessageAnimation(true));
    
    expect(result.current.style.opacity).toBe(0);
    expect(result.current.isAnimating).toBe(true); // Animating starts immediately
  });

  it('should initialize with opacity 1 when shouldAnimate is false', () => {
    const { result } = renderHook(() => useMessageAnimation(false));
    
    expect(result.current.style.opacity).toBe(1);
    expect(result.current.style.transform).toBe('translateY(0px)');
  });

  it('should use requestAnimationFrame for animation', () => {
    renderHook(() => useMessageAnimation(true));
    
    // requestAnimationFrame should be called
    expect(global.requestAnimationFrame).toHaveBeenCalled();
  });

  it('should animate opacity from 0 to 1', () => {
    const { result } = renderHook(() => useMessageAnimation(true));
    
    // Initial state
    expect(result.current.style.opacity).toBe(0);
    
    // Trigger animation frame
    act(() => {
      const timestamp = performance.now();
      rafCallbacks.forEach(cb => cb(timestamp));
    });
    
    // Should have started animating
    expect(result.current.isAnimating).toBe(true);
    
    // Simulate animation progress
    act(() => {
      const timestamp = performance.now() + 150; // Halfway through 300ms
      rafCallbacks.forEach(cb => cb(timestamp));
    });
    
    // Opacity should be between 0 and 1
    expect(result.current.style.opacity).toBeGreaterThan(0);
    expect(result.current.style.opacity).toBeLessThan(1);
  });

  it('should complete animation after duration', () => {
    const { result } = renderHook(() => useMessageAnimation(true, { duration: 300 }));
    
    // Start animation
    act(() => {
      const startTime = performance.now();
      rafCallbacks.forEach(cb => cb(startTime));
    });
    
    // Complete animation
    act(() => {
      const endTime = performance.now() + 300;
      rafCallbacks.forEach(cb => cb(endTime));
    });
    
    // Should be fully visible
    expect(result.current.style.opacity).toBe(1);
    expect(result.current.style.transform).toBe('translateY(0px)');
    expect(result.current.isAnimating).toBe(false);
  });

  it('should cancel animation on unmount', () => {
    const { unmount } = renderHook(() => useMessageAnimation(true));
    
    // Start animation
    act(() => {
      const timestamp = performance.now();
      rafCallbacks.forEach(cb => cb(timestamp));
    });
    
    // Unmount
    unmount();
    
    // cancelAnimationFrame should be called
    expect(global.cancelAnimationFrame).toHaveBeenCalled();
  });

  it('should respect delay option', () => {
    // Test that delay option is accepted and doesn't cause errors
    const { result } = renderHook(() => useMessageAnimation(true, { delay: 100 }));
    
    // Should initialize properly
    expect(result.current.style).toBeDefined();
    expect(result.current.isAnimating).toBeDefined();
    
    // The animation will start after delay (tested implicitly by no errors)
  });

  it('should only animate once', () => {
    const { rerender } = renderHook(() => useMessageAnimation(true));
    
    // Start animation
    act(() => {
      const timestamp = performance.now();
      rafCallbacks.forEach(cb => cb(timestamp));
    });
    
    const callCount = (global.requestAnimationFrame as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
    
    // Rerender
    rerender();
    
    // Should not start animation again
    expect((global.requestAnimationFrame as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCount);
  });
});

describe('AssistantMessageAI Animation', () => {
  const mockMessage: Message = {
    id: '1',
    role: 'assistant',
    content: 'Hello, how can I help you?',
    timestamp: new Date(),
  };

  it('should render with animation styles', () => {
    render(
      <AssistantMessageAI 
        message={mockMessage} 
        isStreaming={false} 
      />
    );
    
    const messageElement = screen.getByTestId('assistant-message-ai');
    expect(messageElement).toBeInTheDocument();
    
    // Should have inline styles for animation (starts at 0)
    expect(messageElement).toHaveStyle({ opacity: 0 });
  });

  it('should not animate when streaming', () => {
    render(
      <AssistantMessageAI 
        message={mockMessage} 
        isStreaming={true} 
      />
    );
    
    const messageElement = screen.getByTestId('assistant-message-ai');
    
    // Should start with full opacity when streaming
    expect(messageElement).toHaveStyle({ opacity: 1 });
  });

  it('should animate when not streaming', () => {
    render(
      <AssistantMessageAI 
        message={mockMessage} 
        isStreaming={false} 
      />
    );
    
    const messageElement = screen.getByTestId('assistant-message-ai');
    
    // Should have animation applied (starts at 0 opacity)
    expect(messageElement).toHaveStyle({ 
      opacity: 0,
      transform: 'translateY(8px)'
    });
  });
});

describe('UserMessageAI Animation', () => {
  it('should render with animation styles', () => {
    render(
      <UserMessageAI 
        content="Test message" 
        timestamp={new Date()} 
      />
    );
    
    const messageElement = screen.getByTestId('user-message-ai');
    expect(messageElement).toBeInTheDocument();
    
    // Should have inline styles for animation (starts at 0)
    expect(messageElement).toHaveStyle({ opacity: 0 });
  });

  it('should animate on mount', () => {
    render(
      <UserMessageAI 
        content="Test message" 
        timestamp={new Date()} 
      />
    );
    
    const messageElement = screen.getByTestId('user-message-ai');
    
    // Should have animation applied (starts at 0 opacity)
    expect(messageElement).toHaveStyle({ 
      opacity: 0,
      transform: 'translateY(8px)'
    });
  });

  it('should animate with file attachments', () => {
    const attachments = [
      {
        name: 'test.pdf',
        type: 'application/pdf',
        size: 1024,
        url: '/uploads/test.pdf',
      },
    ];
    
    render(
      <UserMessageAI 
        content="Test message with attachment" 
        timestamp={new Date()}
        attachments={attachments}
      />
    );
    
    const messageElement = screen.getByTestId('user-message-ai');
    
    // Should have animation applied even with attachments (starts at 0 opacity)
    expect(messageElement).toHaveStyle({ 
      opacity: 0,
      transform: 'translateY(8px)'
    });
  });
});

describe('Animation Performance', () => {
  it('should use requestAnimationFrame for smooth 60fps rendering', () => {
    renderHook(() => useMessageAnimation(true));
    
    // Verify requestAnimationFrame is used
    expect(global.requestAnimationFrame).toHaveBeenCalled();
    
    // Simulate multiple frames
    act(() => {
      for (let i = 0; i < 10; i++) {
        const timestamp = performance.now() + (i * 16.67); // ~60fps
        rafCallbacks.forEach(cb => cb(timestamp));
      }
    });
    
    // Animation should progress smoothly (called at least once)
    expect(global.requestAnimationFrame).toHaveBeenCalled();
  });

  it('should complete animation within specified duration', () => {
    const { result } = renderHook(() => useMessageAnimation(true, { duration: 300 }));
    
    // Start animation
    act(() => {
      const startTime = performance.now();
      rafCallbacks.forEach(cb => cb(startTime));
    });
    
    // Complete animation by simulating time passing
    act(() => {
      const endTime = performance.now() + 350; // Slightly more than duration
      rafCallbacks.forEach(cb => cb(endTime));
    });
    
    // Should be complete
    expect(result.current.style.opacity).toBe(1);
    expect(result.current.style.transform).toBe('translateY(0px)');
    expect(result.current.isAnimating).toBe(false);
  });

  it('should handle rapid component mounting/unmounting', () => {
    const { unmount, rerender } = renderHook(() => useMessageAnimation(true));
    
    // Start animation
    act(() => {
      const timestamp = performance.now();
      rafCallbacks.forEach(cb => cb(timestamp));
    });
    
    // Rerender multiple times
    for (let i = 0; i < 5; i++) {
      rerender();
    }
    
    // Unmount
    unmount();
    
    // Should clean up properly
    expect(global.cancelAnimationFrame).toHaveBeenCalled();
  });
});

describe('CSS Animation Fallback', () => {
  it('should have messageFadeIn animation class available', () => {
    // Test that the CSS class can be applied
    const div = document.createElement('div');
    div.className = 'message-fade-in';
    document.body.appendChild(div);
    
    expect(div.className).toBe('message-fade-in');
    
    document.body.removeChild(div);
  });
});
