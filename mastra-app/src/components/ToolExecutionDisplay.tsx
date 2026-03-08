'use client';

import { useState } from 'react';
import { ToolCall } from '@/types';

/**
 * Tool execution status types
 */
export type ToolStatus = 'pending' | 'executing' | 'completed' | 'failed';

interface ToolExecutionDisplayProps {
  toolCall: ToolCall;
  status?: ToolStatus;
}

/**
 * ToolExecutionDisplay — Claude Desktop-style compact tool pill
 * Expandable to show parameters. Collapsed = small inline pill.
 */
export function ToolExecutionDisplay({ toolCall, status = 'completed' }: ToolExecutionDisplayProps) {
  const [expanded, setExpanded] = useState(false);

  if (!toolCall) return null;

  const displayName = formatToolName(toolCall?.name);

  return (
    <div className={`tool-execution tool-${status}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
        className="tool-header"
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} tool details for ${displayName}`}
      >
        <span
          className="chevron"
          style={{
            display: 'inline-flex',
            transition: 'transform 0.2s ease',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: 'var(--text-muted)' }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
        <span className="tool-name">{displayName}</span>
        <span className="tool-status">
          <span className={`status-dot ${getStatusClass(status)}`} />
        </span>
      </button>

      {expanded && (
        <div className="tool-details">
          <div style={{ marginBottom: '4px', color: 'var(--text-muted)', fontSize: '11px' }}>
            Tool: <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{toolCall?.name || 'Unknown'}</span>
          </div>
          {toolCall?.arguments && Object.keys(toolCall.arguments).length > 0 ? (
            <>
              <div style={{ marginBottom: '2px', color: 'var(--text-muted)', fontSize: '11px' }}>
                Parameters:
              </div>
              <pre style={{
                margin: 0,
                color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: '12px',
              }}>
                {formatJSON(toolCall.arguments)}
              </pre>
            </>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic' }}>
              No parameters
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatToolName(name?: string): string {
  if (!name) return 'Unknown Tool';
  return name
    .replace(/^sqlcl_/, '')
    .replace(/^mcp_/, '')
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function getStatusClass(status: ToolStatus): string {
  switch (status) {
    case 'pending': return 'status-available';
    case 'executing': return 'status-available';
    case 'completed': return 'status-connected';
    case 'failed': return 'status-error';
    default: return 'status-available';
  }
}

function formatJSON(obj: Record<string, unknown>): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}
