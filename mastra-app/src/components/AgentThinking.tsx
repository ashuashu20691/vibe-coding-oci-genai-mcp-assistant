'use client';

import { useState, useEffect } from 'react';

export interface ThinkingStep {
  id: string;
  type: 'thinking' | 'tool_call' | 'tool_result' | 'progress';
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
  timestamp: Date;
  status: 'pending' | 'running' | 'complete' | 'error';
  duration?: number;
}

interface AgentThinkingProps {
  steps: ThinkingStep[];
  isActive?: boolean;
  defaultExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
}

/**
 * AgentThinking - Minimal collapsible panel showing agent reasoning process
 * Inspired by Claude Desktop's clean, minimal design
 */
export function AgentThinking({ 
  steps, 
  isActive = false, 
  defaultExpanded = false,
  onToggle 
}: AgentThinkingProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  useEffect(() => {
    setIsExpanded(defaultExpanded);
  }, [defaultExpanded]);

  if (steps.length === 0) return null;

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onToggle?.(newExpanded);
  };

  const toolCallCount = steps.filter(s => s.type === 'tool_call').length;
  const runningStep = steps.find(s => s.status === 'running');

  const getSummary = (): string => {
    if (isActive && runningStep?.toolName) {
      return formatToolName(runningStep.toolName);
    }
    if (toolCallCount > 0) {
      return `Used ${toolCallCount} tool${toolCallCount !== 1 ? 's' : ''}`;
    }
    return 'Working...';
  };

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={handleToggle}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
        style={{
          background: 'var(--bg-secondary)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-color)',
        }}
        aria-expanded={isExpanded}
      >
        {isActive && (
          <div 
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: 'var(--accent)' }}
          />
        )}
        <svg
          className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span>{getSummary()}</span>
      </button>

      {isExpanded && (
        <div 
          className="mt-2 ml-4 space-y-1 max-h-[300px] overflow-y-auto"
          style={{ 
            paddingLeft: '12px',
            borderLeft: '2px solid var(--border-color)'
          }}
        >
          {steps.map((step, index) => (
            <ThinkingStepItem 
              key={step.id} 
              step={step} 
              isLast={index === steps.length - 1}
              isActive={isActive && step.status === 'running'}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Format tool name for display
 */
function formatToolName(name?: string): string {
  if (!name) return 'tool';
  return name
    .replace(/^sqlcl_/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Individual thinking step item - minimal design
 */
function ThinkingStepItem({ step, isLast, isActive }: { 
  step: ThinkingStep; 
  isLast: boolean; 
  isActive: boolean;
}) {
  const getStatusIcon = () => {
    if (step.status === 'running') {
      return (
        <div 
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ background: 'var(--accent)' }}
        />
      );
    }
    if (step.status === 'error') {
      return (
        <div 
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: 'var(--error, #ef4444)' }}
        />
      );
    }
    if (step.status === 'complete') {
      return (
        <div 
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: 'var(--success, #10a37f)' }}
        />
      );
    }
    return null;
  };

  const getStepText = () => {
    if (step.type === 'tool_call' && step.toolName) {
      return formatToolName(step.toolName);
    }
    return step.content || 'Processing...';
  };

  return (
    <div className="flex items-start gap-2 py-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
      {getStatusIcon()}
      <span className="flex-1">{getStepText()}</span>
      {step.duration !== undefined && step.status === 'complete' && (
        <span style={{ color: 'var(--text-muted)' }}>
          {step.duration < 1000 ? `${step.duration}ms` : `${(step.duration / 1000).toFixed(1)}s`}
        </span>
      )}
    </div>
  );
}
