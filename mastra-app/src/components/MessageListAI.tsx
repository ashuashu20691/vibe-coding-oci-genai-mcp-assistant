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
      <div className="pt-8" style={(!messages || messages.length === 0) && !isLoading ? { display: 'flex', flexDirection: 'column', height: '100%' } : undefined}>
        <div className="max-w-7xl mx-auto px-12" style={(!messages || messages.length === 0) && !isLoading ? { flex: 1, display: 'flex', flexDirection: 'column' } : undefined}>
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

// Suggestion prompts for the welcome screen
const WELCOME_SUGGESTIONS = [
  {
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
      </svg>
    ),
    label: 'Show me all tables in the database',
    prompt: 'List all tables in the database',
  },
  {
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    label: 'Create a sales dashboard',
    prompt: 'Create a sales dashboard',
  },
  {
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
    label: 'Display orders trend over time',
    prompt: 'Display orders trend over time',
  },
  {
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
      </svg>
    ),
    label: 'Top suppliers by delivery performance',
    prompt: 'Show me top suppliers by delivery performance',
  },
];

// Memoize WelcomeScreen to prevent unnecessary re-renders
const WelcomeScreen = memo(function WelcomeScreen({ onSuggestionClick }: { onSuggestionClick?: (s: string) => void }) {
  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-orb">
          <div className="welcome-orb-inner">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125v-3.75" />
            </svg>
          </div>
        </div>

        <h1 className="welcome-title">
          What would you like to explore?
        </h1>
        <p className="welcome-subtitle">
          Ask me anything about your data — I can query tables, build dashboards, spot trends, and surface insights.
        </p>

        <div className="welcome-suggestions">
          {WELCOME_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion.prompt}
              className="welcome-suggestion-chip"
              onClick={() => onSuggestionClick?.(suggestion.prompt)}
              type="button"
            >
              <span className="welcome-suggestion-icon">{suggestion.icon}</span>
              <span>{suggestion.label}</span>
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
