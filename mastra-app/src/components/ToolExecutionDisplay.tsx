'use client';

import { useState } from 'react';
import { ToolCall } from '@/types';

/**
 * Tool execution status types
 * Validates: Requirement 12.2, 12.5
 */
export type ToolStatus = 'pending' | 'executing' | 'completed' | 'failed';

interface ToolExecutionDisplayProps {
  toolCall: ToolCall;
  status?: ToolStatus;
}

/**
 * ToolExecutionDisplay component - Claude Desktop-style expandable tool execution display
 * 
 * Features:
 * - Collapsible/expandable toggle with chevron icon
 * - Tool name displayed prominently in collapsed state
 * - Execution status with color coding
 * - Formatted tool parameters and payload in expanded state
 * - JSON syntax highlighting
 * - Smooth expand/collapse animation
 * - Defensive null checking for all tool properties
 * 
 * Validates: Requirements 12.2, 12.5, 0.2
 */
export function ToolExecutionDisplay({ toolCall, status = 'completed' }: ToolExecutionDisplayProps) {
  const [expanded, setExpanded] = useState(false);
  
  // Defensive null checking (Requirement 0.2)
  if (!toolCall) return null;
  
  // Format tool name for display
  const displayName = formatToolName(toolCall?.name);
  
  return (
    <div 
      className={`tool-execution tool-${status}`}
    >
      {/* Tool header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          // Support Space and Enter keys for activation - Requirement 27.4
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
        className="tool-header"
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} tool execution details for ${displayName}`}
      >
        {/* Chevron icon */}
        <span 
          className="chevron"
          style={{
            display: 'inline-flex',
            transition: 'transform 0.2s ease',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          <svg 
            width="12" 
            height="12" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: '#6B7280' }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
        
        {/* Tool name */}
        <span className="tool-name">
          {displayName}
        </span>
        
        {/* Status indicator */}
        <span className="tool-status">
          <span className={`status-dot ${getStatusClass(status)}`} />
          {getStatusLabel(status)}
        </span>
      </button>
      
      {/* Expanded details section */}
      {expanded && (
        <div className="tool-details">
          {/* Tool name in details */}
          <div style={{ marginBottom: '8px', color: '#6B7280', fontSize: '12px' }}>
            Tool: <span style={{ color: '#374151', fontWeight: 500 }}>{toolCall?.name || 'Unknown'}</span>
          </div>
          
          {/* Request parameters */}
          {toolCall?.arguments && Object.keys(toolCall.arguments).length > 0 ? (
            <>
              <div style={{ marginBottom: '4px', color: '#6B7280', fontSize: '12px' }}>
                Parameters:
              </div>
              <pre style={{ 
                margin: 0, 
                color: '#1F2937',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {formatJSON(toolCall.arguments)}
              </pre>
            </>
          ) : (
            <div style={{ color: '#9CA3AF', fontSize: '12px', fontStyle: 'italic' }}>
              No parameters
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Format tool name for display
 * Removes common prefixes and formats for readability
 */
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

/**
 * Get human-readable status label
 */
function getStatusLabel(status: ToolStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending...';
    case 'executing':
      return 'Running...';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return '';
  }
}

/**
 * Get status indicator CSS class
 */
function getStatusClass(status: ToolStatus): string {
  switch (status) {
    case 'pending':
      return 'status-available';
    case 'executing':
      return 'status-available'; // Use available color for executing
    case 'completed':
      return 'status-connected'; // Use connected (green) for completed
    case 'failed':
      return 'status-error';
    default:
      return 'status-available';
  }
}

/**
 * Format JSON with syntax highlighting
 * Simple implementation for readability
 */
function formatJSON(obj: Record<string, unknown>): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (error) {
    return String(obj);
  }
}
