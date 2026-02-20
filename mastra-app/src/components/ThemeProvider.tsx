'use client';

import { useEffect } from 'react';
import { initializeTheme } from './SettingsModal';

/**
 * ThemeProvider component that initializes the theme on app load.
 * This component should be placed near the root of the app to ensure
 * the theme is applied as early as possible.
 * 
 * Validates: Requirements 9.4 - Theme toggle applies to entire application
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize theme from localStorage on mount
    initializeTheme();
    
    // Listen for system theme changes when in 'system' mode
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleSystemThemeChange = () => {
      // Only re-apply if we're in system mode (no explicit class set)
      const root = document.documentElement;
      if (!root.classList.contains('light') && !root.classList.contains('dark')) {
        // Force a re-render by toggling a data attribute
        // This ensures CSS variables update properly
        root.setAttribute('data-theme-updated', Date.now().toString());
      }
    };
    
    mediaQuery.addEventListener('change', handleSystemThemeChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, []);

  return <>{children}</>;
}
