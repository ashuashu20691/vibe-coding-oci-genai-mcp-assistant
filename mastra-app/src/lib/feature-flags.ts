/**
 * Feature Flag System for Progressive Migration
 * 
 * This module provides utilities for toggling between legacy and AI Elements components
 * during the migration process. It allows for safe rollback if issues arise.
 */

/**
 * Check if AI Elements feature is enabled
 * @returns true if AI Elements should be used, false for legacy components
 */
export function useAIElements(): boolean {
  if (typeof window === 'undefined') {
    // Server-side: read from environment variable
    return process.env.NEXT_PUBLIC_USE_AI_ELEMENTS === 'true';
  }
  
  // Client-side: read from environment variable
  return process.env.NEXT_PUBLIC_USE_AI_ELEMENTS === 'true';
}

/**
 * Feature flag configuration object
 */
export const featureFlags = {
  /**
   * Enable AI Elements message components
   */
  aiElementsMessages: () => useAIElements(),
  
  /**
   * Enable AI Elements tool display components
   */
  aiElementsTools: () => useAIElements(),
  
  /**
   * Enable AI Elements input component with file upload
   */
  aiElementsInput: () => useAIElements(),
  
  /**
   * Enable enhanced sidebar with shadcn/ui
   */
  enhancedSidebar: () => useAIElements(),
  
  /**
   * Enable command palette (Cmd+K)
   */
  commandPalette: () => useAIElements(),
  
  /**
   * Enable enhanced artifacts panel
   */
  enhancedArtifacts: () => useAIElements(),
} as const;

/**
 * Get all feature flag states (useful for debugging)
 */
export function getFeatureFlagStates() {
  return {
    useAIElements: useAIElements(),
    aiElementsMessages: featureFlags.aiElementsMessages(),
    aiElementsTools: featureFlags.aiElementsTools(),
    aiElementsInput: featureFlags.aiElementsInput(),
    enhancedSidebar: featureFlags.enhancedSidebar(),
    commandPalette: featureFlags.commandPalette(),
    enhancedArtifacts: featureFlags.enhancedArtifacts(),
  };
}

/**
 * Log feature flag states to console (development only)
 */
export function logFeatureFlags() {
  if (process.env.NODE_ENV === 'development') {
    console.log('[Feature Flags]', getFeatureFlagStates());
  }
}
