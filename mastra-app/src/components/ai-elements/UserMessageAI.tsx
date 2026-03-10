'use client';

import { memo, useMemo } from 'react';
import { FileAttachment } from '@/types';
import { useMessageAnimation } from '@/hooks/useMessageAnimation';

/**
 * AI Elements UserMessage Component
 * 
 * Modern user message component using Vercel AI SDK UI patterns.
 * Replaces the legacy UserMessageBubble with AI Elements styling.
 * 
 * Validates: Requirements 1.2, 3.7, 3.8, 13.1, 13.7, 13.8
 * - 1.2: User messages rendered using AI Elements
 * - 3.7: File attachment display support
 * - 3.8: Image thumbnail display
 * - 13.1: Smooth fade-in animation for new messages
 * - 13.7: Uses requestAnimationFrame for animations
 * - 13.8: Maintains 60fps during animations
 */

export interface UserMessageAIProps {
  /** The text content of the user message */
  content: string;
  /** Timestamp when the message was sent */
  timestamp: Date;
  /** Optional file attachments */
  attachments?: FileAttachment[];
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
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get file icon based on content type
 */
function getFileIcon(type: string): React.ReactNode {
  if (type.startsWith('image/')) {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  if (type.includes('pdf')) {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  }
  if (type.includes('text') || type.includes('json')) {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }
  // Default file icon
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

/**
 * AI Elements UserMessage Component
 * 
 * Right-aligned user message with file attachment support.
 * Optimized with React.memo to prevent unnecessary re-renders.
 */
export const UserMessageAI = memo(function UserMessageAI({ 
  content, 
  timestamp, 
  attachments 
}: UserMessageAIProps) {
  const hasAttachments = useMemo(() => attachments && attachments.length > 0, [attachments]);
  
  // Apply smooth fade-in animation for new messages
  // Validates: Requirements 13.1, 13.7, 13.8
  const animation = useMessageAnimation(true, {
    duration: 300,
    delay: 0,
  });

  return (
    <div 
      className="flex justify-end mb-4 group"
      data-testid="user-message-ai"
      role="article"
      aria-label="User message"
      style={animation.style}
    >
      <div className="flex flex-col items-end max-w-[85%]">
        {/* File attachments */}
        {hasAttachments && attachments && (
          <div className="mb-2 flex flex-col gap-2 w-full">
            {attachments.map((attachment, index) => {
              const isImage = attachment.type.startsWith('image/');
              
              return (
                <div
                  key={index}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                  }}
                  data-testid={`attachment-${index}`}
                >
                  {isImage && attachment.url ? (
                    /* Image thumbnail */
                    <img
                      src={attachment.url}
                      alt={attachment.name}
                      className="w-12 h-12 rounded object-cover"
                      loading="lazy"
                    />
                  ) : (
                    /* File icon */
                    <div
                      className="w-10 h-10 rounded flex items-center justify-center"
                      style={{ background: 'var(--bg-tertiary)' }}
                    >
                      {getFileIcon(attachment.type)}
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div 
                      className="text-sm font-medium truncate"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {attachment.name}
                    </div>
                    {attachment.size && (
                      <div 
                        className="text-xs"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {formatFileSize(attachment.size)}
                      </div>
                    )}
                  </div>
                  
                  {/* Download link */}
                  {attachment.url && (
                    <a
                      href={attachment.url}
                      download={attachment.name}
                      className="p-1 rounded hover:bg-opacity-10"
                      style={{ color: 'var(--text-muted)' }}
                      aria-label={`Download ${attachment.name}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        {/* Message content */}
        <div 
          className="px-4 py-3 rounded-2xl"
          style={{ 
            background: 'var(--user-bg)',
            borderBottomRightRadius: '0.5rem',
          }}
          data-testid="user-content-ai"
        >
          <p 
            className="whitespace-pre-wrap text-[15px] break-words"
            style={{ color: 'var(--text-primary)' }}
          >
            {content}
          </p>
        </div>
        
        {/* Timestamp */}
        <span 
          className="text-xs mt-1 mr-1 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: 'var(--text-muted)' }}
          title={formatFullTime(timestamp)}
          data-testid="user-timestamp-ai"
        >
          {formatRelativeTime(timestamp)}
        </span>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo - only re-render if content, timestamp, or attachments changed
  return (
    prevProps.content === nextProps.content &&
    prevProps.timestamp.getTime() === nextProps.timestamp.getTime() &&
    prevProps.attachments === nextProps.attachments
  );
});

export default UserMessageAI;
