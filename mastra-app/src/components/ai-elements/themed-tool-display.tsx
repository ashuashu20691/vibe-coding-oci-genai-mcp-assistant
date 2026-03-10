'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Themed wrapper for AI Elements Tool components
 * Applies existing theme CSS variables for tool execution display
 */

interface ThemedToolDisplayProps {
  toolName: string;
  status: 'executing' | 'completed' | 'failed';
  children: React.ReactNode;
  className?: string;
}

export function ThemedToolDisplay({ 
  toolName, 
  status, 
  children, 
  className 
}: ThemedToolDisplayProps) {
  const baseStyles = cn(
    'tool-execution',
    'rounded-md',
    'p-3',
    'transition-all',
    'duration-200',
    {
      'bg-[var(--color-tool-executing)]': status === 'executing',
      'bg-[var(--color-tool-completed)]': status === 'completed',
      'bg-[var(--color-tool-failed)]': status === 'failed',
    },
    className
  );

  const statusIcon = {
    executing: '⏳',
    completed: '✓',
    failed: '✗',
  }[status];

  return (
    <div className={baseStyles}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium text-[var(--color-tool-text)]">
          {statusIcon} {toolName}
        </span>
        <span className="text-xs text-[var(--color-tool-status)] capitalize">
          {status}
        </span>
      </div>
      <div className="text-sm text-[var(--color-tool-text)]">
        {children}
      </div>
    </div>
  );
}

export default ThemedToolDisplay;
