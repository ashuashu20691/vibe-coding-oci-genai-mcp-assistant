'use client';

import { useState } from 'react';
import { ToolCall } from '@/types';

interface ToolCallDisplayProps {
  toolCalls: ToolCall[];
}

export function ToolCallDisplay({ toolCalls }: ToolCallDisplayProps) {
  const [expanded, setExpanded] = useState(false);
  
  if (!toolCalls || toolCalls.length === 0) return null;
  
  return (
    <div className="mb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
        style={{
          background: 'var(--bg-secondary)',
          color: 'var(--text-secondary)',
          border: 'none',
        }}
      >
        <svg 
          className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span>Used {toolCalls.length} tool{toolCalls.length > 1 ? 's' : ''}</span>
      </button>
      
      {expanded && (
        <div className="mt-2 space-y-2">
          {toolCalls?.map((tc) => (
            <ToolCallItem key={tc?.id || Math.random()} toolCall={tc} />
          ))}
        </div>
      )}
    </div>
  );
}

function ToolCallItem({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  
  // Handle missing or partial tool data gracefully
  if (!toolCall) return null;
  
  const displayName = (toolCall?.name || 'Unknown Tool')
    .replace(/^sqlcl_/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="ml-4">
      <button 
        onClick={() => setExpanded(!expanded)} 
        className="flex items-center gap-2 text-sm transition-colors hover:opacity-70 py-1" 
        style={{ color: 'var(--text-secondary)' }}
      >
        <svg 
          className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="font-medium">{displayName}</span>
      </button>
      
      {expanded && toolCall?.arguments && (
        <div 
          className="mt-1 ml-5 p-3 rounded-lg text-xs font-mono overflow-x-auto" 
          style={{ background: 'var(--bg-secondary)', border: 'none' }}
        >
          <pre style={{ color: 'var(--text-primary)' }}>{JSON.stringify(toolCall.arguments, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
