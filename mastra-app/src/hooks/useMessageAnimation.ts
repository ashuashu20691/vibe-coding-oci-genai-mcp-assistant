/**
 * useMessageAnimation Hook
 * 
 * Custom hook for smooth message animations using requestAnimationFrame.
 * Ensures 60fps performance during message fade-in animations.
 * 
 * Validates: Requirements 13.1, 13.7, 13.8
 * - 13.1: Smooth fade-in animation for new messages
 * - 13.7: Uses requestAnimationFrame for all animations
 * - 13.8: Maintains 60fps during animations
 */

import { useEffect, useRef, useState } from 'react';

interface AnimationOptions {
  /** Duration of the animation in milliseconds */
  duration?: number;
  /** Easing function for the animation */
  easing?: (t: number) => number;
  /** Delay before starting the animation in milliseconds */
  delay?: number;
}

/**
 * Default easing function (ease-out cubic)
 */
const defaultEasing = (t: number): number => {
  return 1 - Math.pow(1 - t, 3);
};

/**
 * Hook for managing smooth message fade-in animations
 * 
 * @param shouldAnimate - Whether the animation should run
 * @param options - Animation configuration options
 * @returns Animation state and styles
 */
export function useMessageAnimation(
  shouldAnimate: boolean = true,
  options: AnimationOptions = {}
) {
  const {
    duration = 300,
    easing = defaultEasing,
    delay = 0,
  } = options;

  const [isAnimating, setIsAnimating] = useState(shouldAnimate);
  const [opacity, setOpacity] = useState(shouldAnimate ? 0 : 1);
  const [translateY, setTranslateY] = useState(shouldAnimate ? 8 : 0);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    // Only animate once when component mounts
    if (!shouldAnimate || hasAnimatedRef.current) {
      setOpacity(1);
      setTranslateY(0);
      setIsAnimating(false);
      return;
    }

    // Mark as animated
    hasAnimatedRef.current = true;

    // Handle delay
    if (delay > 0) {
      const delayTimeout = setTimeout(() => {
        startAnimation();
      }, delay);
      return () => clearTimeout(delayTimeout);
    } else {
      startAnimation();
    }

    function startAnimation() {
      setIsAnimating(true);
      startTimeRef.current = null;

      const animate = (timestamp: number) => {
        if (startTimeRef.current === null) {
          startTimeRef.current = timestamp;
        }

        const elapsed = timestamp - startTimeRef.current;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easing(progress);

        // Update opacity and translateY
        setOpacity(easedProgress);
        setTranslateY(8 * (1 - easedProgress));

        if (progress < 1) {
          // Continue animation
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          // Animation complete
          setIsAnimating(false);
          setOpacity(1);
          setTranslateY(0);
          animationFrameRef.current = null;
        }
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    }

    // Cleanup function
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [shouldAnimate, duration, easing, delay]);

  return {
    isAnimating,
    style: {
      opacity,
      transform: `translateY(${translateY}px)`,
      transition: isAnimating ? 'none' : 'opacity 0.15s ease, transform 0.15s ease',
    },
  };
}

/**
 * Hook for managing staggered animations for multiple items
 * 
 * @param itemCount - Number of items to animate
 * @param staggerDelay - Delay between each item's animation start
 * @param options - Animation configuration options
 * @returns Array of animation states for each item
 */
export function useStaggeredAnimation(
  itemCount: number,
  staggerDelay: number = 50,
  options: AnimationOptions = {}
) {
  const animations = [];
  
  for (let i = 0; i < itemCount; i++) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const animation = useMessageAnimation(true, {
      ...options,
      delay: i * staggerDelay,
    });
    animations.push(animation);
  }
  
  return animations;
}
