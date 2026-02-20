'use client';

/**
 * UserMessageBubble Component
 * 
 * Dedicated component for rendering user messages in a conversational chat interface.
 * Styled with right alignment, distinct background color, and rounded corners.
 * 
 * Validates: Requirements 1.1, 1.2, 1.4
 * - 1.1: User messages displayed as right-aligned bubbles with distinct styling
 * - 1.2: Full message content with proper text wrapping
 * - 1.4: Visually distinct background color from assistant messages
 */

export interface UserMessageBubbleProps {
  /** The text content of the user message */
  content: string;
  /** Timestamp when the message was sent */
  timestamp: Date;
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

export function UserMessageBubble({ content, timestamp }: UserMessageBubbleProps) {
  return (
    <div 
      className="flex justify-end mb-4"
      data-testid="user-message-bubble"
    >
      <div className="flex flex-col items-end max-w-[85%]">
        <div 
          className="px-4 py-3 rounded-2xl"
          style={{ 
            background: 'var(--user-bg)',
            borderBottomRightRadius: '0.5rem', // Slightly less rounded on bottom-right for chat bubble effect
          }}
        >
          <p 
            className="whitespace-pre-wrap text-[15px] break-words"
            style={{ color: 'var(--text-primary)' }}
          >
            {content}
          </p>
        </div>
        <span 
          className="text-xs mt-1 mr-1"
          style={{ color: 'var(--text-muted)' }}
          title={formatFullTime(timestamp)}
        >
          {formatRelativeTime(timestamp)}
        </span>
      </div>
    </div>
  );
}

export default UserMessageBubble;
