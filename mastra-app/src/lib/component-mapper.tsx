/**
 * Component Mapping Logic
 * 
 * This module provides dynamic component selection based on feature flags.
 * It allows switching between legacy and AI Elements components at runtime.
 */

import React from 'react';
import { featureFlags } from './feature-flags';

/**
 * Component mapper type definition
 */
type ComponentMapper<T = any> = {
  legacy: React.ComponentType<T>;
  aiElements: React.ComponentType<T>;
};

/**
 * Select component based on feature flag
 * @param mapper Object containing legacy and AI Elements components
 * @param flagCheck Feature flag check function
 * @returns The appropriate component based on feature flag state
 */
export function selectComponent<T>(
  mapper: ComponentMapper<T>,
  flagCheck: () => boolean = featureFlags.aiElementsMessages
): React.ComponentType<T> {
  try {
    return flagCheck() ? mapper.aiElements : mapper.legacy;
  } catch (error) {
    console.error('[Component Mapper] Error selecting component, falling back to legacy:', error);
    return mapper.legacy;
  }
}

/**
 * Higher-order component for feature flag-based rendering
 * @param LegacyComponent Legacy component to use when flag is disabled
 * @param AIElementsComponent AI Elements component to use when flag is enabled
 * @param flagCheck Feature flag check function
 * @returns Component that renders based on feature flag state
 */
export function withFeatureFlag<T extends Record<string, any>>(
  LegacyComponent: React.ComponentType<T>,
  AIElementsComponent: React.ComponentType<T>,
  flagCheck: () => boolean = featureFlags.aiElementsMessages
) {
  return function FeatureFlaggedComponent(props: T) {
    const Component = selectComponent(
      { legacy: LegacyComponent, aiElements: AIElementsComponent },
      flagCheck
    );
    return <Component {...(props as any)} />;
  };
}

/**
 * Error boundary for AI Elements components
 * Falls back to legacy component if AI Elements component fails
 * 
 * Validates: Requirements 11.1, 11.6, 11.7
 * - 11.1: Falls back to legacy component on error
 * - 11.6: Displays fallback without crashing entire message list
 * - 11.7: Logs errors with sufficient context for debugging
 */
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  componentName?: string; // For better error context
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export class ComponentErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Requirement 11.7: Log errors with sufficient context for debugging
    const context = {
      componentName: this.props.componentName || 'Unknown',
      errorMessage: error.message,
      errorStack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    };
    
    console.error('[Component Error Boundary] Component rendering failed:', {
      ...context,
      error,
      errorInfo,
    });
    
    // Store error info for potential debugging
    this.setState({ errorInfo });
    
    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  render() {
    // Requirement 11.6: Display fallback without crashing entire message list
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

/**
 * Safe component wrapper with error boundary and fallback
 * @param AIElementsComponent AI Elements component to try first
 * @param LegacyComponent Legacy component to fall back to on error
 * @param flagCheck Feature flag check function
 * @param componentName Optional component name for error logging
 * @returns Component with error boundary protection
 * 
 * Validates: Requirements 8.3, 11.1, 11.6, 11.7
 * - 8.3: Falls back to legacy component on error
 * - 11.1: Automatic fallback when AI Elements fails
 * - 11.6: Continues functioning without crashing
 * - 11.7: Logs errors with context
 */
export function safeComponent<T extends Record<string, any>>(
  AIElementsComponent: React.ComponentType<T>,
  LegacyComponent: React.ComponentType<T>,
  flagCheck: () => boolean = featureFlags.aiElementsMessages,
  componentName?: string
) {
  return function SafeComponent(props: T) {
    const useAIElements = flagCheck();
    
    if (!useAIElements) {
      return <LegacyComponent {...(props as any)} />;
    }

    return (
      <ComponentErrorBoundary
        fallback={<LegacyComponent {...(props as any)} />}
        componentName={componentName || AIElementsComponent.displayName || AIElementsComponent.name}
        onError={(error, errorInfo) => {
          // Requirement 11.7: Log fallback event with context
          console.error('[Safe Component] Falling back to legacy component:', {
            componentName: componentName || AIElementsComponent.displayName || AIElementsComponent.name,
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        }}
      >
        <AIElementsComponent {...(props as any)} />
      </ComponentErrorBoundary>
    );
  };
}

/**
 * Component registry for mapping component names to implementations
 */
export const componentRegistry = {
  // Message components
  AssistantMessage: null as ComponentMapper | null,
  UserMessage: null as ComponentMapper | null,
  SystemMessage: null as ComponentMapper | null,
  
  // Tool components
  ToolInvocation: null as ComponentMapper | null,
  ToolResult: null as ComponentMapper | null,
  ToolExecutionDisplay: null as ComponentMapper | null,
  
  // Input components
  MessageInput: null as ComponentMapper | null,
  
  // Sidebar components
  ConversationSidebar: null as ComponentMapper | null,
  
  // Artifacts components
  ArtifactsPanel: null as ComponentMapper | null,
};

/**
 * Register a component mapping
 * @param name Component name
 * @param mapper Component mapper object
 */
export function registerComponent(
  name: keyof typeof componentRegistry,
  mapper: ComponentMapper
) {
  componentRegistry[name] = mapper;
}

/**
 * Get component from registry
 * @param name Component name
 * @param flagCheck Feature flag check function
 * @returns The appropriate component based on feature flag state
 */
export function getComponent<T>(
  name: keyof typeof componentRegistry,
  flagCheck: () => boolean = featureFlags.aiElementsMessages
): React.ComponentType<T> | null {
  const mapper = componentRegistry[name];
  if (!mapper) {
    console.warn(`[Component Registry] Component "${name}" not registered`);
    return null;
  }
  return selectComponent(mapper, flagCheck);
}
