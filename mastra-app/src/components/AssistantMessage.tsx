'use client';

import { ReactNode, useState, useRef, useEffect } from 'react';
import { Message } from '@/types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolErrorDisplay } from './ToolErrorDisplay';

/**
 * AssistantMessage Component
 * 
 * Dedicated component for rendering assistant messages in a conversational chat interface.
 * Styled with left alignment and support for inline visualizations and analysis cards.
 * 
 * Validates: Requirements 2.1
 * - 2.1: Assistant messages displayed as left-aligned message area
 * 
 * Structure:
 * - Left-aligned (default)
 * - Contains: text content, inline visualizations, inline analysis cards
 * - Streaming cursor shown during active streaming
 * - Tool errors displayed inline (non-blocking)
 */

export interface AssistantMessageProps {
  /** The message object containing content and metadata */
  message: Message;
  /** Whether the message is currently being streamed */
  isStreaming: boolean;
  /** Optional children for inline visualizations and analysis cards */
  children?: ReactNode;
}

/**
 * Formats a timestamp as a relative time string (e.g., "2 min ago")
 * or absolute time for older messages
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
 * Formats a timestamp as a full date/time string for tooltip display
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
 * StreamingCursor - Pulsating cursor shown at end of streaming text
 * Validates: Requirements 16.3 - Pulsating cursor during streaming
 * Validates: Requirements 16.6 - Smooth fade-out on completion
 */
export function StreamingCursor({ isFadingOut = false }: { isFadingOut?: boolean }) {
  return (
    <span 
      className="inline-block w-0.5 h-4 ml-0.5"
      style={{ 
        background: 'var(--accent)',
        verticalAlign: 'text-bottom',
        animation: isFadingOut 
          ? 'cursor-fadeOut 0.3s ease-out forwards' 
          : 'cursor-pulse 1.2s ease-in-out infinite',
        transformOrigin: 'center'
      }}
      data-testid="streaming-cursor"
      aria-hidden="true"
    />
  );
}

/**
 * StreamingText - Component for rendering streaming text with cursor animation
 * Validates: Requirements 2.2, 2.4, 16.6
 * - 2.2: Character-by-character streaming with smooth animation
 * - 2.4: Remove streaming indicators when response is complete
 * - 16.6: Smooth fade-out animation on completion
 */
export interface StreamingTextProps {
  /** The content to display */
  content: string;
  /** Whether streaming is currently active - controls cursor visibility */
  isStreaming: boolean;
}

export function StreamingText({ content, isStreaming }: StreamingTextProps) {
  const [displayedContent, setDisplayedContent] = useState('');
  const [isFadingOut, setIsFadingOut] = useState(false);
  const targetContentRef = useRef<string>(content);
  const wasStreamingRef = useRef<boolean>(isStreaming);
  
  // Detect when streaming stops to trigger fade-out
  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming) {
      // Streaming just stopped - trigger fade-out
      setIsFadingOut(true);
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming]);
  
  useEffect(() => {
    targetContentRef.current = content;
    
    // If new content is longer, animate the new characters
    if (content.length > displayedContent.length) {
      const animateCharacters = () => {
        setDisplayedContent(prev => {
          const target = targetContentRef.current;
          if (prev.length < target.length) {
            // Add characters in small batches for smoother animation
            const charsToAdd = Math.min(3, target.length - prev.length);
            return target.slice(0, prev.length + charsToAdd);
          }
          return prev;
        });
      };
      
      // Small delay between character batches for visible animation
      const intervalId = setInterval(animateCharacters, 15);
      
      return () => {
        clearInterval(intervalId);
      };
    } else if (content.length < displayedContent.length || content !== displayedContent) {
      // Content was replaced or shortened, update immediately
      setDisplayedContent(content);
    }
  }, [content, displayedContent.length, displayedContent]);
  
  // Reset displayed content when content is cleared (new message)
  useEffect(() => {
    if (content === '' && displayedContent !== '') {
      setDisplayedContent('');
      setIsFadingOut(false);
    }
  }, [content, displayedContent]);
  
  return (
    <span className="streaming-text" data-testid="streaming-text">
      <MarkdownRenderer content={displayedContent} />
      {/* Show cursor only when streaming is active - Validates: Requirements 2.4, 16.6 */}
      {isStreaming && <StreamingCursor isFadingOut={isFadingOut} />}
    </span>
  );
}

export function AssistantMessage({ message, isStreaming, children }: AssistantMessageProps) {
  const timestamp = message.timestamp || new Date();
  
  return (
    <div 
      className="flex justify-start mb-4"
      data-testid="assistant-message"
    >
      <div className="flex flex-col items-start max-w-[90%]">
        {/* Assistant avatar/icon */}
        <div className="flex items-start gap-3 w-full">
          <div 
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1"
            style={{ 
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)'
            }}
            data-testid="assistant-avatar"
          >
            <svg 
              className="w-4 h-4 text-white" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
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
            {/* Tool errors displayed inline (non-blocking) */}
            {message.toolErrors && message.toolErrors.length > 0 && (
              <div className="mb-3" data-testid="tool-errors">
                {message.toolErrors.map((error, index) => (
                  <ToolErrorDisplay 
                    key={`${error.toolName}-${index}`}
                    error={error}
                  />
                ))}
              </div>
            )}
            
            {/* Main message content */}
            {message.content && (
              <div 
                className="px-4 py-3 rounded-2xl"
                style={{ 
                  background: 'var(--bg-secondary)',
                  borderTopLeftRadius: '0.5rem', // Slightly less rounded on top-left for chat bubble effect
                }}
                data-testid="assistant-content"
              >
                <div 
                  className="text-[15px] break-words"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {isStreaming ? (
                    <StreamingText content={message.content} isStreaming={isStreaming} />
                  ) : (
                    <MarkdownRenderer content={message.content} />
                  )}
                </div>
              </div>
            )}
            
            {/* Show streaming cursor when streaming but no content yet */}
            {isStreaming && !message.content && (
              <div 
                className="px-4 py-3 rounded-2xl"
                style={{ 
                  background: 'var(--bg-secondary)',
                  borderTopLeftRadius: '0.5rem',
                }}
                data-testid="streaming-placeholder"
              >
                <StreamingCursor />
              </div>
            )}
            
            {/* Inline visualizations and analysis cards (passed as children) */}
            {children && (
              <div className="mt-3" data-testid="inline-content">
                {children}
              </div>
            )}
            
            {/* Timestamp */}
            <span 
              className="text-xs mt-1 ml-1 block"
              style={{ color: 'var(--text-muted)' }}
              title={formatFullTime(timestamp)}
              data-testid="assistant-timestamp"
            >
              {formatRelativeTime(timestamp)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AssistantMessage;
