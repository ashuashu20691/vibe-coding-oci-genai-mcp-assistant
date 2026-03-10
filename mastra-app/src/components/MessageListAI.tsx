'use client';

/**
 * MessageList Component with AI Elements Integration
 * 
 * Enhanced message list that uses feature flags to switch between
 * legacy and AI Elements message components.
 * 
 * Validates: Requirements 1.5, 1.6, 8.1, 9.7, 10.3
 * - 1.5: Auto-scroll behavior maintained
 * - 1.6: Welcome screen when conversation is empty
 * - 8.1: Feature flag integration for progressive migration
 * - 9.7: Virtualization when message count exceeds 100
 * - 10.3: ARIA live regions for streaming message updates
 */

import { useRef, useEffect, useState, useCallback, useMemo, memo } from 'react';
import { List, useDynamicRowHeight, useListRef } from 'react-window';
import { Message } from '@/types';
import { InlineVisualization } from './InlineVisualization';
import { InlineAnalysisCard } from './InlineAnalysisCard';
import { ProgressIndicator } from './ProgressIndicator';
import { featureFlags } from '@/lib/feature-flags';
import { safeComponent } from '@/lib/component-mapper';
import { SkeletonLoader } from './SkeletonLoader';
import { useThrottle } from '@/hooks/useThrottle';
import { useStreamingAnnouncements } from '@/hooks/useAriaLive';

// Import legacy components
import { AssistantMessage } from './AssistantMessage';
import { UserMessageBubble } from './UserMessageBubble';

// Import AI Elements components
import { AssistantMessageAI } from './ai-elements/AssistantMessageAI';
import { UserMessageAI } from './ai-elements/UserMessageAI';

interface UIMessage extends Message {
  progress?: { current: number; total: number };
  isProgressMessage?: boolean;
}

interface MessageListProps {
  messages: UIMessage[];
  isLoading?: boolean;
  isStreaming?: boolean;
  onSuggestionClick?: (suggestion: string) => void;
  onViewArtifact?: () => void;
}

// Create safe components with feature flag and error boundary
// Validates: Requirements 11.1, 11.6, 11.7
const SafeAssistantMessage = safeComponent(
  AssistantMessageAI,
  AssistantMessage,
  featureFlags.aiElementsMessages,
  'AssistantMessage'
);

const SafeUserMessage = safeComponent(
  UserMessageAI,
  UserMessageBubble,
  featureFlags.aiElementsMessages,
  'UserMessage'
);

export function MessageListAI({ 
  messages, 
  isLoading = false, 
  isStreaming = false, 
  onSuggestionClick, 
  onViewArtifact 
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useListRef(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const lastMessageCountRef = useRef(messages.length);
  const wasLoadingRef = useRef(false);
  const [containerHeight, setContainerHeight] = useState(600);
  
  // ARIA live announcements for streaming updates - Validates: Requirement 10.3
  const { announce: announceStreamingUpdate } = useStreamingAnnouncements();

  // Threshold for enabling virtualization - Validates: Requirement 9.7
  const VIRTUALIZATION_THRESHOLD = 100;
  const shouldVirtualize = messages.length > VIRTUALIZATION_THRESHOLD;

  // Dynamic row height for virtualization
  const dynamicRowHeight = useDynamicRowHeight({
    defaultRowHeight: 150,
    key: messages.length, // Re-initialize when message count changes
  });

  // Measure container height for virtualization
  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Auto-scroll to bottom when new content arrives, unless user has scrolled up
  // Validates: Requirement 1.5 - Auto-scroll to keep latest streaming content visible
  const scrollToBottom = useCallback((force = false) => {
    if (force || !userScrolled) {
      requestAnimationFrame(() => {
        if (shouldVirtualize && listRef.current) {
          // For virtualized list, scroll to last item
          listRef.current.scrollToRow({
            index: messages.length - 1,
            align: 'end',
            behavior: 'smooth',
          });
        } else {
          // For non-virtualized list, use bottom ref
          bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      });
    }
  }, [userScrolled, shouldVirtualize, messages.length, listRef]);

  // Detect if user has scrolled away from bottom
  // Debounce scroll events to prevent performance issues - Validates: Requirement 9.2
  const handleScrollRaw = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 150;
    setUserScrolled(!isAtBottom);
  }, []);

  // Throttle scroll handler to 100ms for better performance
  const handleScroll = useThrottle(handleScrollRaw, 100);

  // Auto-scroll on new messages
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      scrollToBottom();
    }, 50);
    
    return () => clearTimeout(timeoutId);
  }, [messages.length, scrollToBottom]);

  // Reset scroll state when loading starts
  useEffect(() => {
    if (isLoading && !wasLoadingRef.current) {
      setUserScrolled(false);
      scrollToBottom(true);
    }
    wasLoadingRef.current = isLoading;
  }, [isLoading, scrollToBottom]);

  // Reset scroll tracking when message count increases
  useEffect(() => {
    if (messages.length > lastMessageCountRef.current) {
      setUserScrolled(false);
      scrollToBottom(true);
    }
    lastMessageCountRef.current = messages.length;
  }, [messages.length, scrollToBottom]);

  // Auto-scroll during streaming
  useEffect(() => {
    if (isStreaming && !userScrolled) {
      if (shouldVirtualize && listRef.current) {
        listRef.current.scrollToRow({
          index: messages.length - 1,
          align: 'end',
          behavior: 'smooth',
        });
      } else {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [isStreaming, userScrolled, messages, shouldVirtualize, listRef]);

  const lastMessage = messages?.[messages.length - 1];
  const isLastMessageStreaming = isLoading && lastMessage?.role === 'assistant';
  
  // Announce streaming updates to screen readers - Validates: Requirement 10.3
  useEffect(() => {
    if (isStreaming && lastMessage?.content) {
      // Announce the latest content chunk (debounced by useStreamingAnnouncements)
      const contentPreview = lastMessage.content.slice(0, 100);
      announceStreamingUpdate(`Assistant is responding: ${contentPreview}${lastMessage.content.length > 100 ? '...' : ''}`);
    }
  }, [isStreaming, lastMessage?.content, announceStreamingUpdate]);

  // Render virtualized row
  const VirtualizedRow = useCallback((props: {
    ariaAttributes: {
      "aria-posinset": number;
      "aria-setsize": number;
      role: "listitem";
    };
    index: number;
    style: React.CSSProperties;
  }) => {
    const { index, style, ariaAttributes } = props;
    const message = messages[index];

    return (
      <div style={style} {...ariaAttributes}>
        <MessageItem
          message={message}
          isLast={index === messages.length - 1}
          isStreaming={index === messages.length - 1 && isLastMessageStreaming}
          onViewArtifact={onViewArtifact}
        />
      </div>
    );
  }, [messages, isLastMessageStreaming, onViewArtifact]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto"
      onScroll={handleScroll}
      style={{ background: 'var(--bg-primary)' }}
      role="log"
      aria-label="Chat messages"
      aria-live="polite"
      aria-atomic="false"
    >
      <div className="pt-8">
        <div className="max-w-4xl mx-auto px-6">
          {/* Welcome screen when no messages - Validates: Requirement 1.6 */}
          {(!messages || messages.length === 0) && !isLoading && (
            <WelcomeScreen onSuggestionClick={onSuggestionClick} />
          )}

          {/* Skeleton loader while loading initial messages - Task 9.5 */}
          {isLoading && (!messages || messages.length === 0) && (
            <SkeletonLoader variant="message" count={2} />
          )}

          {/* Render messages - virtualized if count exceeds threshold */}
          {shouldVirtualize ? (
            <List
              listRef={listRef}
              defaultHeight={containerHeight - 64} // Subtract padding
              rowCount={messages.length}
              rowHeight={dynamicRowHeight}
              rowComponent={VirtualizedRow}
              rowProps={{}}
              overscanCount={5}
              style={{ height: containerHeight - 64 }}
            />
          ) : (
            <>
              {messages?.map((message, index) => (
                <div key={message?.id || `msg-${index}`}>
                  <MessageItem
                    message={message}
                    isLast={index === messages.length - 1}
                    isStreaming={index === messages.length - 1 && isLastMessageStreaming}
                    onViewArtifact={onViewArtifact}
                  />
                </div>
              ))}
            </>
          )}

          {/* Typing indicator */}
          {isLoading && messages?.length > 0 && messages[messages.length - 1]?.role === 'user' && (
            <div className="py-4">
              <TypingIndicator />
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}

// Memoize MessageItem to prevent unnecessary re-renders - Validates: Requirement 9.1, 9.2
const MessageItem = memo(function MessageItem({ 
  message, 
  isLast: _isLast, 
  isStreaming = false, 
  onViewArtifact 
}: { 
  message: UIMessage; 
  isLast: boolean; 
  isStreaming?: boolean; 
  onViewArtifact?: () => void;
}) {
  const isUser = message?.role === 'user';

  // Extract progress information - memoize expensive computation
  const progressInfo = useMemo(() => {
    const progressMatch = message?.content?.match(/Step (\d+) of (\d+): (.+?)(?:\.\.\.|$)/);
    const completionMatch = message?.content?.match(/✓ Completed all (\d+) steps/);
    
    let info: { current: number; total: number; description: string } | null = null;
    let isCompleted = false;

    if (progressMatch) {
      info = {
        current: parseInt(progressMatch[1], 10),
        total: parseInt(progressMatch[2], 10),
        description: progressMatch[3].trim(),
      };
    } else if (message?.progress) {
      const descMatch = message.content?.match(/Step \d+ of \d+: (.+?)(?:\.\.\.|$)/);
      info = {
        current: message.progress.current,
        total: message.progress.total,
        description: descMatch ? descMatch[1].trim() : 'Processing...',
      };
    }

    if (completionMatch) {
      isCompleted = true;
      const total = parseInt(completionMatch[1], 10);
      info = {
        current: total,
        total: total,
        description: 'All steps completed',
      };
    }

    return { info, isCompleted };
  }, [message?.content, message?.progress]);

  // User messages
  if (isUser) {
    return (
      <SafeUserMessage
        content={message?.content || ''}
        timestamp={message?.timestamp || new Date()}
      />
    );
  }

  // Assistant messages
  return (
    <SafeAssistantMessage
      message={message}
      isStreaming={isStreaming}
    >
      {/* Progress indicator */}
      {progressInfo.info && (
        <ProgressIndicator
          currentStep={progressInfo.info.current}
          totalSteps={progressInfo.info.total}
          stepDescription={progressInfo.info.description}
          isCompleted={progressInfo.isCompleted}
        />
      )}
      
      {/* Analysis card */}
      {message?.analysis && (
        <div className="mt-8">
          <InlineAnalysisCard analysis={message.analysis} defaultExpanded={false} />
        </div>
      )}
      
      {/* Visualization */}
      {message?.visualization && (
        <div className="mt-4">
          {(message.visualization.routedToArtifacts || 
            (message.visualization.html && message.visualization.html.length > 500)) ? (
            <button
              onClick={() => onViewArtifact?.()}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px', 
                padding: '12px 16px', 
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                transition: 'background 0.15s ease, border-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-tertiary, var(--bg-secondary))';
                e.currentTarget.style.borderColor = 'var(--accent, #3b82f6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-secondary)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
            >
              <span style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                width: '36px', 
                height: '36px', 
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                flexShrink: 0,
              }}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--accent, #3b82f6)' }}>
                  View your report
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {message.visualization.title} — Interactive Dashboard
                </div>
              </div>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--text-muted)" strokeWidth={2} style={{ flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : message.visualization.html ? (
            <InlineVisualization visualization={message.visualization} defaultExpanded={true} />
          ) : message.visualization.data && Array.isArray(message.visualization.data) && message.visualization.data.length > 0 ? (
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    {Object.keys(message.visualization.data[0]).map(col => (
                      <th key={col} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', fontWeight: 600 }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {message.visualization.data.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      {Object.values(row).map((val, j) => (
                        <td key={j} style={{ padding: '8px 12px' }}>{String(val)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      )}
    </SafeAssistantMessage>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for memo
  // Only re-render if message content, streaming state, or isLast changed
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.visualization === nextProps.message.visualization &&
    prevProps.message.analysis === nextProps.message.analysis &&
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.isLast === nextProps.isLast
  );
});

// Memoize WelcomeScreen to prevent unnecessary re-renders
const WelcomeScreen = memo(function WelcomeScreen({ onSuggestionClick }: { onSuggestionClick?: (s: string) => void }) {
  const suggestions = useMemo(() => [
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
  ], []);

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
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
});

// Memoize TypingIndicator as it's a static component
const TypingIndicator = memo(function TypingIndicator() {
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
});

export default MessageListAI;
