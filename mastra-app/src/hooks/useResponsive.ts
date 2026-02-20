/**
 * useResponsive Hook
 * 
 * Provides responsive breakpoint detection for the Claude Desktop UI.
 * Breakpoints follow the design specification:
 * - Desktop: >1024px
 * - Tablet: 768-1024px
 * - Mobile: <768px
 * 
 * Validates: Requirements 12.1
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * Breakpoint values in pixels
 * These match the CSS custom properties defined in globals.css
 */
export const BREAKPOINTS = {
  mobile: 768,    // < 768px
  tablet: 1024,   // 768px - 1024px
  desktop: 1024,  // > 1024px
} as const;

/**
 * Device type based on viewport width
 */
export type DeviceType = 'mobile' | 'tablet' | 'desktop';

/**
 * Responsive state returned by the hook
 */
export interface ResponsiveState {
  /** Current device type based on viewport width */
  deviceType: DeviceType;
  /** Whether the viewport is mobile (<768px) */
  isMobile: boolean;
  /** Whether the viewport is tablet (768-1024px) */
  isTablet: boolean;
  /** Whether the viewport is desktop (>1024px) */
  isDesktop: boolean;
  /** Current viewport width in pixels */
  width: number;
  /** Current viewport height in pixels */
  height: number;
  /** Whether the device supports touch */
  isTouchDevice: boolean;
}

/**
 * Options for the useResponsive hook
 */
export interface UseResponsiveOptions {
  /** Debounce delay in milliseconds for resize events (default: 100) */
  debounceMs?: number;
  /** Initial width for SSR (default: 1024) */
  initialWidth?: number;
  /** Initial height for SSR (default: 768) */
  initialHeight?: number;
}

/**
 * Determines the device type based on viewport width
 */
export function getDeviceType(width: number): DeviceType {
  if (width < BREAKPOINTS.mobile) {
    return 'mobile';
  }
  if (width <= BREAKPOINTS.tablet) {
    return 'tablet';
  }
  return 'desktop';
}

/**
 * Checks if the device supports touch
 */
export function detectTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-expect-error - msMaxTouchPoints is IE-specific
    navigator.msMaxTouchPoints > 0
  );
}

/**
 * Hook for responsive breakpoint detection
 * 
 * @example
 * ```tsx
 * const { isMobile, isTablet, isDesktop, deviceType } = useResponsive();
 * 
 * return (
 *   <div className={isMobile ? 'mobile-layout' : 'desktop-layout'}>
 *     {isDesktop && <Sidebar />}
 *     <MainContent />
 *   </div>
 * );
 * ```
 */
export function useResponsive(options: UseResponsiveOptions = {}): ResponsiveState {
  const {
    debounceMs = 100,
    initialWidth = 1024,
    initialHeight = 768,
  } = options;

  const [state, setState] = useState<ResponsiveState>(() => {
    // SSR-safe initial state
    const width = typeof window !== 'undefined' ? window.innerWidth : initialWidth;
    const height = typeof window !== 'undefined' ? window.innerHeight : initialHeight;
    const deviceType = getDeviceType(width);
    
    return {
      deviceType,
      isMobile: deviceType === 'mobile',
      isTablet: deviceType === 'tablet',
      isDesktop: deviceType === 'desktop',
      width,
      height,
      isTouchDevice: typeof window !== 'undefined' ? detectTouchDevice() : false,
    };
  });

  const updateState = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const deviceType = getDeviceType(width);
    
    setState({
      deviceType,
      isMobile: deviceType === 'mobile',
      isTablet: deviceType === 'tablet',
      isDesktop: deviceType === 'desktop',
      width,
      height,
      isTouchDevice: detectTouchDevice(),
    });
  }, []);

  useEffect(() => {
    // Update state on mount (for SSR hydration)
    updateState();

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const handleResize = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(updateState, debounceMs);
    };

    window.addEventListener('resize', handleResize);
    
    // Also listen for orientation changes on mobile devices
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [updateState, debounceMs]);

  return state;
}

/**
 * Utility function to check if a width matches a specific breakpoint
 */
export function matchesBreakpoint(width: number, breakpoint: DeviceType): boolean {
  switch (breakpoint) {
    case 'mobile':
      return width < BREAKPOINTS.mobile;
    case 'tablet':
      return width >= BREAKPOINTS.mobile && width <= BREAKPOINTS.tablet;
    case 'desktop':
      return width > BREAKPOINTS.desktop;
    default:
      return false;
  }
}

/**
 * CSS media query strings for use in styled-components or CSS-in-JS
 */
export const mediaQueries = {
  mobile: `(max-width: ${BREAKPOINTS.mobile - 1}px)`,
  tablet: `(min-width: ${BREAKPOINTS.mobile}px) and (max-width: ${BREAKPOINTS.tablet}px)`,
  desktop: `(min-width: ${BREAKPOINTS.desktop + 1}px)`,
  tabletAndUp: `(min-width: ${BREAKPOINTS.mobile}px)`,
  tabletAndDown: `(max-width: ${BREAKPOINTS.tablet}px)`,
} as const;
