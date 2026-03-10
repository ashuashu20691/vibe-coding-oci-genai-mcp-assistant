'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Themed wrapper for AI Elements Input component
 * Applies existing theme CSS variables for consistent input styling
 */

interface ThemedInputProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  onSubmit?: () => void;
  isDisabled?: boolean;
}

export const ThemedInput = React.forwardRef<HTMLTextAreaElement, ThemedInputProps>(
  ({ className, onSubmit, isDisabled, ...props }, ref) => {
    const baseStyles = cn(
      'copilot-input',
      'w-full',
      'rounded-[var(--radius-input)]',
      'bg-[var(--bg-secondary)]',
      'text-[var(--text-primary)]',
      'border-none',
      'outline-none',
      'transition-all',
      'duration-200',
      'focus:bg-[var(--bg-primary)]',
      'placeholder:text-[var(--text-muted)]',
      'disabled:opacity-50',
      'disabled:cursor-not-allowed',
      className
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && onSubmit) {
        e.preventDefault();
        onSubmit();
      }
      props.onKeyDown?.(e);
    };

    return (
      <textarea
        ref={ref}
        className={baseStyles}
        disabled={isDisabled}
        onKeyDown={handleKeyDown}
        {...props}
      />
    );
  }
);

ThemedInput.displayName = 'ThemedInput';

export default ThemedInput;
