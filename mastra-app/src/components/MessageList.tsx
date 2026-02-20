'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Message } from '@/types';
import { ToolCallDisplay } from './ToolCallDisplay';
import { AgentThinking, ThinkingStep } from './AgentThinking';
import { InlineVisualization } from './InlineVisualization';
import { InlineAnalysisCard } from './InlineAnalysisCard';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
  isStreaming?: boolean;
  onSuggestionClick?: (suggestion: string) => void;
  thinkingSteps?: ThinkingStep[];
  /** Callback when a new message is submitted - used to reset scroll tracking */
  onNewMessageSubmitted?: boolean;
}

export function MessageList({ messages, isLoading = false, isStreaming = false, onSuggestionClick, thinkingSteps = [] }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const lastMessageCountRef = useRef(messages.length);
  const wasLoadingRef = useRef(false);

  // Auto-scroll to bottom when new content arrives, unless user has scrolled up
  // Validates: Requirement 2.5 - Auto-scroll to keep latest streaming content visible
  const scrollToBottom = useCallback((force = false) => {
    if (force || !userScrolled) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [userScrolled]);

  // Detect if user has scrolled away from bottom
  // Validates: Requirement 2.5 - Stop auto-scrolling if user has scrolled up
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    // Consider "at bottom" if within 100px of the bottom
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    setUserScrolled(!isAtBottom);
  }, []);

  // Auto-scroll on new messages or streaming content
  // Validates: Requirement 2.5 - Auto-scroll to latest content during streaming
  useEffect(() => {
    scrollToBottom();
  }, [messages, thinkingSteps, scrollToBottom]);

  // Reset user scroll state when a new message is submitted (loading starts)
  // Validates: Requirement 2.5 - Reset scroll tracking when new message is submitted
  useEffect(() => {
    // Detect when loading transitions from false to true (new message submitted)
    if (isLoading && !wasLoadingRef.current) {
      setUserScrolled(false);
      // Force scroll to bottom when new message is submitted
      scrollToBottom(true);
    }
    wasLoadingRef.current = isLoading;
  }, [isLoading, scrollToBottom]);

  // Also reset scroll tracking when message count increases (new user message added)
  // This ensures we scroll to the new message even before loading starts
  useEffect(() => {
    if (messages.length > lastMessageCountRef.current) {
      // New message was added - reset scroll tracking and scroll to bottom
      setUserScrolled(false);
      scrollToBottom(true);
    }
    lastMessageCountRef.current = messages.length;
  }, [messages.length, scrollToBottom]);

  // During active streaming, continuously scroll to bottom (unless user scrolled up)
  // This ensures smooth following of streaming content
  useEffect(() => {
    if (isStreaming && !userScrolled) {
      // Use a small interval to keep scrolling during streaming
      const intervalId = setInterval(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

      return () => clearInterval(intervalId);
    }
  }, [isStreaming, userScrolled]);

  // Find the last assistant message index to show thinking steps before it
  const lastAssistantIndex = messages.map((m, i) => m.role === 'assistant' ? i : -1).filter(i => i >= 0).pop() ?? -1;

  // Check if the last assistant message is currently streaming (empty or being filled)
  const lastMessage = messages[messages.length - 1];
  const isLastMessageStreaming = isLoading && lastMessage?.role === 'assistant';

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto"
      onScroll={handleScroll}
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* Add top padding for better layout */}
      <div className="pt-8">
        <div className="max-w-4xl mx-auto px-6">
          {messages.length === 0 && !isLoading && (
            <WelcomeScreen onSuggestionClick={onSuggestionClick} />
          )}

          {messages.map((message, index) => (
            <div key={message.id}>
              {/* Show thinking steps before the last assistant message */}
              {index === lastAssistantIndex && thinkingSteps.length > 0 && (
                <div className="mb-4">
                  <AgentThinking steps={thinkingSteps} isActive={isLoading} />
                </div>
              )}
              <MessageItem
                message={message}
                isLast={index === messages.length - 1}
                isStreaming={index === messages.length - 1 && isLastMessageStreaming}
              />
            </div>
          ))}

          {/* Show thinking steps at the end if loading and no assistant message yet */}
          {isLoading && thinkingSteps.length > 0 && lastAssistantIndex === -1 && (
            <div className="mb-4">
              <AgentThinking steps={thinkingSteps} isActive={true} />
            </div>
          )}

          {/* Show typing indicator when waiting for first chunk */}
          {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && thinkingSteps.length === 0 && (
            <div className="py-4">
              <TypingIndicator />
            </div>
          )}

          {/* Show typing indicator at end of streaming message */}
          {isLastMessageStreaming && lastMessage?.content && (
            <div className="mb-4">
              <StreamingCursor />
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}

interface SuggestedPrompt {
  text: string;
  icon: React.ReactNode;
  category: string;
}

function WelcomeScreen({ onSuggestionClick }: { onSuggestionClick?: (s: string) => void }) {
  const suggestions: SuggestedPrompt[] = [
    {
      text: 'Analyze supplier performance data',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      category: 'Supplier Analysis',
    },
    {
      text: 'Detect anomalies in power consumption',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      category: 'Power Theft Detection',
    },
    {
      text: 'Find similar images in the database',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      category: 'Photo Similarity',
    },
    {
      text: 'Identify potential fraud patterns',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      category: 'Fraud Detection',
    },
  ];

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        {/* Animated gradient orb */}
        <div className="welcome-orb">
          <div className="welcome-orb-inner">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
        </div>

        <h1 className="welcome-title">
          How can I help you today?
        </h1>
        <p className="welcome-subtitle">
          Analyze databases, detect anomalies, and create visualizations using Oracle Database 23ai features.
        </p>

        <div className="welcome-suggestions">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.text}
              onClick={() => onSuggestionClick?.(suggestion.text)}
              className="welcome-suggestion-btn"
            >
              <div className="welcome-suggestion-icon">
                {suggestion.icon}
              </div>
              <div className="welcome-suggestion-text">
                <span className="welcome-suggestion-category">
                  {suggestion.category}
                </span>
                <span className="welcome-suggestion-label">
                  {suggestion.text}
                </span>
              </div>
              <svg className="welcome-suggestion-arrow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageItem({ message, isLast: _isLast, isStreaming = false }: { message: Message; isLast: boolean; isStreaming?: boolean }) {
  const isUser = message.role === 'user';

  // User messages - clean, minimal style like Claude Desktop
  if (isUser) {
    return (
      <div className="py-10 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <div className="text-[11px] font-bold mb-4 uppercase tracking-wider" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
          You
        </div>
        <div style={{ 
          fontSize: '16px',
          lineHeight: '1.7',
          color: 'var(--text-primary)',
          fontWeight: '400'
        }}>
          <MarkdownRenderer content={message.content} />
        </div>
      </div>
    );
  }

  // Assistant messages - clean, minimal style like Claude Desktop
  return (
    <div className="py-10 border-b" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
      <div style={{ padding: '0 24px' }}>
        <div className="text-[11px] font-bold mb-4 uppercase tracking-wider" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
          Assistant
        </div>
        
        {/* Tool execution summary - collapsed by default */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-5"><ToolCallDisplay toolCalls={message.toolCalls} /></div>
        )}
        
        {/* Main content with markdown rendering */}
        {message.content && (
          <div style={{ 
            fontSize: '16px',
            lineHeight: '1.7',
            color: 'var(--text-primary)',
            fontWeight: '400'
          }}>
            {isStreaming ? (
              <div>
                <MarkdownRenderer content={message.content} />
                <StreamingCursor />
              </div>
            ) : (
              <MarkdownRenderer content={message.content} />
            )}
          </div>
        )}
        
        {/* Inline visualizations and analysis cards */}
        {message.analysis && (
          <div className="mt-8">
            <InlineAnalysisCard analysis={message.analysis} defaultExpanded={false} />
          </div>
        )}
        {message.visualization?.html && (
          <div className="mt-8">
            <InlineVisualization visualization={message.visualization} />
          </div>
        )}
      </div>
    </div>
  );
}

// Typing indicator with animated dots - shown while waiting for response
// Validates: Requirement 7.1 - Subtle typing indicator (animated dots)
// Validates: Requirement 7.5 - Not distracting or taking up significant screen space
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-1 pl-1" aria-label="Assistant is typing">
      <div className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: 'var(--text-muted)',
              opacity: 0.6,
              animation: 'typing-dot 1.2s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Streaming cursor - blinking cursor shown at end of streaming text
function StreamingCursor() {
  return (
    <span
      className="inline-block w-0.5 h-4 ml-0.5 animate-pulse"
      style={{
        background: 'var(--accent)',
        verticalAlign: 'text-bottom'
      }}
    />
  );
}
