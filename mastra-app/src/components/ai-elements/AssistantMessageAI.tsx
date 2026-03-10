'use client';

/**
 * AI Elements AssistantMessage Component
 * 
 * Modern assistant message component using Vercel AI SDK UI components.
 * Replaces the legacy AssistantMessage with AI Elements primitives.
 * 
 * Validates: Requirements 1.1, 1.3, 1.4, 9.1, 9.2
 * - 1.1: Assistant messages rendered using AI Elements
 * - 1.3: Streaming cursor indicator during streaming
 * - 1.4: Markdown rendering preserved
 * - 9.1: Optimized rendering performance with React.memo
 * - 9.2: Memoized expensive computations
 */

import { ReactNode, memo, useMemo } from 'react';
import { Message } from '@/types';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { extractContentParts, extractToolNarrative } from '@/lib/ai-elements-adapters';
import { ToolExecutionDisplay } from '../ToolExecutionDisplay';
import { ToolExecutionDisplayAI } from './ToolExecutionDisplayAI';
import { featureFlags } from '@/lib/feature-flags';
import { useMessageAnimation } from '@/hooks/useMessageAnimation';

export interface AssistantMessageAIProps {
  /** The message object containing content and metadata */
  message: Message;
  /** Whether the message is currently being streamed */
  isStreaming: boolean;
  /** Optional children for inline visualizations and analysis cards */
  children?: ReactNode;
}

/**
 * Formats a timestamp as a relative time string
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'Just now';
  } else if (diffMin < 60) {
    return `${diffMin} min ago`;
  } else if (diffHour < 24) {
    return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  } else if (diffDay < 7) {
    return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
}

/**
 * Formats a timestamp as a full date/time string for tooltip
 */
function formatFullTime(date: Date): string {
  return date.toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * StreamingCursor - Animated cursor shown during streaming
 * Validates: Requirements 1.3
 */
function StreamingCursor() {
  return (
    <span 
      className="inline-block w-0.5 h-4 ml-0.5"
      style={{ 
        background: 'var(--accent)',
        verticalAlign: 'text-bottom',
        animation: 'cursor-pulse 1.2s ease-in-out infinite',
      }}
      data-testid="streaming-cursor-ai"
      aria-label="Streaming"
      aria-live="polite"
    />
  );
}

/**
 * AI Elements AssistantMessage Component
 * 
 * Uses AI Elements styling and structure while maintaining compatibility
 * with existing message format and features.
 * 
 * Optimized with React.memo to prevent unnecessary re-renders.
 */
export const AssistantMessageAI = memo(function AssistantMessageAI({ 
  message, 
  isStreaming, 
  children 
}: AssistantMessageAIProps) {
  const timestamp = message.timestamp || new Date();
  
  // Memoize expensive computations - Validates: Requirement 9.1, 9.2
  const contentParts = useMemo(() => extractContentParts(message), [message]);
  const useAIElementsTools = useMemo(() => featureFlags.aiElementsTools(), []);
  
  // Apply smooth fade-in animation for new messages
  // Validates: Requirements 13.1, 13.7, 13.8
  const animation = useMessageAnimation(!isStreaming, {
    duration: 300,
    delay: 0,
  });

  return (
    <div 
      className="flex justify-start mb-4 group"
      data-testid="assistant-message-ai"
      role="article"
      aria-label="Assistant message"
      style={animation.style}
    >
      <div className="flex flex-col items-start max-w-[90%]">
        <div className="flex items-start gap-3 w-full">
          {/* Assistant avatar */}
          <div 
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1"
            style={{ 
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)',
            }}
            data-testid="assistant-avatar-ai"
            aria-hidden="true"
          >
            <svg 
              className="w-4 h-4 text-white" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
              aria-hidden="true"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" 
              />
            </svg>
          </div>
          
          <div className="flex-1 min-w-0">
            {/* Render content parts in order (text and tool calls interleaved) */}
            {contentParts.length > 0 ? (
              <div 
                className="px-4 py-3 rounded-2xl"
                style={{ 
                  background: 'var(--bg-secondary)',
                  borderTopLeftRadius: '0.5rem',
                }}
                data-testid="assistant-content-ai"
              >
                <div 
                  className="text-[15px] break-words"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {contentParts.map((part, index) => {
                    if (part.type === 'text') {
                      return (
                        <div key={`text-${index}`} className="mb-2 last:mb-0">
                          <MarkdownRenderer content={part.text} />
                        </div>
                      );
                    } else if (part.type === 'tool') {
                      // Use AI Elements tool component if feature flag is enabled
                      const toolNarrative = extractToolNarrative(message, part.toolCall.id);
                      
                      return (
                        <div key={`tool-${index}`} className="my-3">
                          {useAIElementsTools ? (
                            <ToolExecutionDisplayAI 
                              toolCall={part.toolCall} 
                              status="completed"
                              narrative={toolNarrative}
                            />
                          ) : (
                            <ToolExecutionDisplay 
                              toolCall={part.toolCall} 
                              status="completed" 
                            />
                          )}
                        </div>
                      );
                    }
                    return null;
                  })}
                  
                  {/* Show streaming cursor when streaming */}
                  {isStreaming && <StreamingCursor />}
                </div>
              </div>
            ) : (
              /* Show streaming cursor when no content yet */
              isStreaming && (
                <div 
                  className="px-4 py-3 rounded-2xl"
                  style={{ 
                    background: 'var(--bg-secondary)',
                    borderTopLeftRadius: '0.5rem',
                  }}
                  data-testid="streaming-placeholder-ai"
                >
                  <StreamingCursor />
                </div>
              )
            )}
            
            {/* Inline visualizations and analysis cards */}
            {children && (
              <div className="mt-3" data-testid="inline-content-ai">
                {children}
              </div>
            )}
            
            {/* Timestamp */}
            <span 
              className="text-xs mt-1 ml-1 block opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-muted)' }}
              title={formatFullTime(timestamp)}
              data-testid="assistant-timestamp-ai"
            >
              {formatRelativeTime(timestamp)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo - only re-render if message content or streaming state changed
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.contentParts === nextProps.message.contentParts &&
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.children === nextProps.children
  );
});

export default AssistantMessageAI;
