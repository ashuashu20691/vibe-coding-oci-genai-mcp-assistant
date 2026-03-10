'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Themed wrapper for AI Elements Message component
 * Applies existing theme CSS variables for consistent styling
 */

interface ThemedMessageProps {
  role: 'user' | 'assistant' | 'system';
  content: React.ReactNode;
  className?: string;
  isStreaming?: boolean;
}

export function ThemedMessage({ 
  role, 
  content, 
  className,
  isStreaming = false 
}: ThemedMessageProps) {
  const baseStyles = cn(
    'message',
    'rounded-lg',
    'transition-all',
    'duration-200',
    {
      'bg-[var(--color-user-message-bg)] text-[var(--color-user-message-text)] border-[var(--color-user-message-border)]': role === 'user',
      'bg-[var(--color-assistant-message-bg)] text-[var(--color-assistant-message-text)] border-[var(--color-assistant-message-border)]': role === 'assistant',
      'bg-[var(--color-system-message-bg)] text-[var(--color-system-message-text)] border-[var(--color-system-message-border)]': role === 'system',
    },
    className
  );

  return (
    <div className={baseStyles}>
      {content}
      {isStreaming && (
        <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" aria-label="Streaming" />
      )}
    </div>
  );
}

export default ThemedMessage;
