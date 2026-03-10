/**
 * useAriaLive Hook
 * 
 * Manages ARIA live regions for announcing dynamic content updates to screen readers.
 * 
 * Sub-task 11.2: Screen reader support
 * Validates: Requirements 10.3, 10.4
 * - 10.3: ARIA live regions for streaming message updates
 * - 10.4: ARIA live regions for tool execution status changes
 */

import { useEffect, useRef, useCallback } from 'react';

export type AriaLivePoliteness = 'polite' | 'assertive' | 'off';

interface UseAriaLiveOptions {
  /** Politeness level for announcements */
  politeness?: AriaLivePoliteness;
  /** Delay before announcing (ms) to debounce rapid updates */
  delay?: number;
  /** Whether to clear previous announcement before new one */
  clearPrevious?: boolean;
}

/**
 * Hook for managing ARIA live region announcements
 * 
 * @example
 * ```tsx
 * const { announce } = useAriaLive({ politeness: 'polite' });
 * 
 * // Announce streaming message update
 * announce('New message received from assistant');
 * 
 * // Announce tool execution status
 * announce('Tool execution completed successfully', { politeness: 'assertive' });
 * ```
 */
export function useAriaLive(options: UseAriaLiveOptions = {}) {
  const {
    politeness = 'polite',
    delay = 100,
    clearPrevious = true,
  } = options;

  const liveRegionRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Create live region on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Create live region element
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', politeness);
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'aria-live-region sr-only';
    
    // Add to document
    document.body.appendChild(liveRegion);
    liveRegionRef.current = liveRegion;

    // Cleanup on unmount
    return () => {
      if (liveRegionRef.current) {
        document.body.removeChild(liveRegionRef.current);
        liveRegionRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [politeness]);

  /**
   * Announce a message to screen readers
   * 
   * @param message - The message to announce
   * @param overrideOptions - Override default options for this announcement
   */
  const announce = useCallback((
    message: string,
    overrideOptions?: Partial<UseAriaLiveOptions>
  ) => {
    if (!liveRegionRef.current || !message) return;

    const announcePoliteness = overrideOptions?.politeness || politeness;
    const announceDelay = overrideOptions?.delay ?? delay;
    const shouldClear = overrideOptions?.clearPrevious ?? clearPrevious;

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Clear previous announcement if requested
    if (shouldClear) {
      liveRegionRef.current.textContent = '';
    }

    // Update politeness level if changed
    if (liveRegionRef.current.getAttribute('aria-live') !== announcePoliteness) {
      liveRegionRef.current.setAttribute('aria-live', announcePoliteness);
    }

    // Announce after delay (to debounce rapid updates)
    timeoutRef.current = setTimeout(() => {
      if (liveRegionRef.current) {
        liveRegionRef.current.textContent = message;
      }
    }, announceDelay);
  }, [politeness, delay, clearPrevious]);

  /**
   * Clear the current announcement
   */
  const clear = useCallback(() => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = '';
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  return {
    announce,
    clear,
  };
}

/**
 * Hook specifically for streaming message updates
 * Uses 'polite' politeness to avoid interrupting screen reader
 * 
 * Validates: Requirement 10.3
 */
export function useStreamingAnnouncements() {
  return useAriaLive({
    politeness: 'polite',
    delay: 500, // Longer delay to avoid announcing every character
    clearPrevious: true,
  });
}

/**
 * Hook specifically for tool execution status changes
 * Uses 'assertive' politeness to immediately announce status changes
 * 
 * Validates: Requirement 10.4
 */
export function useToolStatusAnnouncements() {
  return useAriaLive({
    politeness: 'assertive',
    delay: 100,
    clearPrevious: true,
  });
}
