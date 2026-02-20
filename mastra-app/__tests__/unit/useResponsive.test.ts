/**
 * Unit tests for useResponsive hook
 * Validates: Requirements 12.1
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  useResponsive,
  BREAKPOINTS,
  getDeviceType,
  matchesBreakpoint,
  mediaQueries,
  detectTouchDevice,
} from '@/hooks/useResponsive';

// Mock window.matchMedia
const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

describe('useResponsive', () => {
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    // Reset window dimensions
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 800,
    });
    mockMatchMedia(false);
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: originalInnerHeight,
    });
  });

  describe('BREAKPOINTS', () => {
    it('should define correct breakpoint values', () => {
      expect(BREAKPOINTS.mobile).toBe(768);
      expect(BREAKPOINTS.tablet).toBe(1024);
      expect(BREAKPOINTS.desktop).toBe(1024);
    });
  });

  describe('getDeviceType', () => {
    it('should return mobile for width < 768px', () => {
      expect(getDeviceType(320)).toBe('mobile');
      expect(getDeviceType(767)).toBe('mobile');
    });

    it('should return tablet for width 768-1024px', () => {
      expect(getDeviceType(768)).toBe('tablet');
      expect(getDeviceType(900)).toBe('tablet');
      expect(getDeviceType(1024)).toBe('tablet');
    });

    it('should return desktop for width > 1024px', () => {
      expect(getDeviceType(1025)).toBe('desktop');
      expect(getDeviceType(1440)).toBe('desktop');
      expect(getDeviceType(1920)).toBe('desktop');
    });
  });

  describe('matchesBreakpoint', () => {
    it('should correctly match mobile breakpoint', () => {
      expect(matchesBreakpoint(320, 'mobile')).toBe(true);
      expect(matchesBreakpoint(767, 'mobile')).toBe(true);
      expect(matchesBreakpoint(768, 'mobile')).toBe(false);
    });

    it('should correctly match tablet breakpoint', () => {
      expect(matchesBreakpoint(767, 'tablet')).toBe(false);
      expect(matchesBreakpoint(768, 'tablet')).toBe(true);
      expect(matchesBreakpoint(1024, 'tablet')).toBe(true);
      expect(matchesBreakpoint(1025, 'tablet')).toBe(false);
    });

    it('should correctly match desktop breakpoint', () => {
      expect(matchesBreakpoint(1024, 'desktop')).toBe(false);
      expect(matchesBreakpoint(1025, 'desktop')).toBe(true);
      expect(matchesBreakpoint(1920, 'desktop')).toBe(true);
    });
  });

  describe('mediaQueries', () => {
    it('should define correct media query strings', () => {
      expect(mediaQueries.mobile).toBe('(max-width: 767px)');
      expect(mediaQueries.tablet).toBe('(min-width: 768px) and (max-width: 1024px)');
      expect(mediaQueries.desktop).toBe('(min-width: 1025px)');
      expect(mediaQueries.tabletAndUp).toBe('(min-width: 768px)');
      expect(mediaQueries.tabletAndDown).toBe('(max-width: 1024px)');
    });
  });

  describe('useResponsive hook', () => {
    it('should return desktop state for width > 1024px', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
      
      const { result } = renderHook(() => useResponsive());
      
      expect(result.current.deviceType).toBe('desktop');
      expect(result.current.isDesktop).toBe(true);
      expect(result.current.isTablet).toBe(false);
      expect(result.current.isMobile).toBe(false);
      expect(result.current.width).toBe(1200);
    });

    it('should return tablet state for width 768-1024px', () => {
      Object.defineProperty(window, 'innerWidth', { value: 900, configurable: true });
      
      const { result } = renderHook(() => useResponsive());
      
      expect(result.current.deviceType).toBe('tablet');
      expect(result.current.isDesktop).toBe(false);
      expect(result.current.isTablet).toBe(true);
      expect(result.current.isMobile).toBe(false);
      expect(result.current.width).toBe(900);
    });

    it('should return mobile state for width < 768px', () => {
      Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
      
      const { result } = renderHook(() => useResponsive());
      
      expect(result.current.deviceType).toBe('mobile');
      expect(result.current.isDesktop).toBe(false);
      expect(result.current.isTablet).toBe(false);
      expect(result.current.isMobile).toBe(true);
      expect(result.current.width).toBe(375);
    });

    it('should update state on window resize', async () => {
      Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
      
      const { result } = renderHook(() => useResponsive({ debounceMs: 0 }));
      
      expect(result.current.isDesktop).toBe(true);
      
      // Simulate resize to mobile
      await act(async () => {
        Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
        window.dispatchEvent(new Event('resize'));
        // Wait for debounce
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      
      expect(result.current.isMobile).toBe(true);
      expect(result.current.isDesktop).toBe(false);
    });

    it('should include viewport height', () => {
      Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });
      
      const { result } = renderHook(() => useResponsive());
      
      expect(result.current.height).toBe(900);
    });

    it('should use initial values for SSR', () => {
      // Test the getDeviceType function with initial values
      const initialWidth = 1024;
      const deviceType = getDeviceType(initialWidth);
      
      expect(deviceType).toBe('tablet');
    });

    it('should clean up event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      
      const { unmount } = renderHook(() => useResponsive());
      
      unmount();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('orientationchange', expect.any(Function));
      
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('detectTouchDevice', () => {
    it('should detect touch support via ontouchstart', () => {
      // Mock touch support
      Object.defineProperty(window, 'ontouchstart', {
        value: () => {},
        configurable: true,
      });
      
      expect(detectTouchDevice()).toBe(true);
      
      // Clean up
      // @ts-expect-error - Cleaning up mock
      delete window.ontouchstart;
    });

    it('should detect touch support via maxTouchPoints', () => {
      const originalMaxTouchPoints = navigator.maxTouchPoints;
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: 5,
        configurable: true,
      });
      
      expect(detectTouchDevice()).toBe(true);
      
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: originalMaxTouchPoints,
        configurable: true,
      });
    });

    it('should return false when no touch support', () => {
      // Ensure no touch properties
      // @ts-expect-error - Cleaning up mock
      delete window.ontouchstart;
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: 0,
        configurable: true,
      });
      
      expect(detectTouchDevice()).toBe(false);
    });
  });

  describe('boundary conditions', () => {
    it('should handle exact breakpoint boundaries correctly', () => {
      // At exactly 768px - should be tablet
      expect(getDeviceType(768)).toBe('tablet');
      
      // At exactly 1024px - should be tablet
      expect(getDeviceType(1024)).toBe('tablet');
      
      // At 767px - should be mobile
      expect(getDeviceType(767)).toBe('mobile');
      
      // At 1025px - should be desktop
      expect(getDeviceType(1025)).toBe('desktop');
    });

    it('should handle very small widths', () => {
      expect(getDeviceType(0)).toBe('mobile');
      expect(getDeviceType(1)).toBe('mobile');
    });

    it('should handle very large widths', () => {
      expect(getDeviceType(3840)).toBe('desktop');
      expect(getDeviceType(7680)).toBe('desktop');
    });
  });
});
