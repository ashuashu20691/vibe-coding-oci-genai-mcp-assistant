'use client';

import { useState } from 'react';

/**
 * Analysis data structure for inline display
 * Validates: Requirement 6.1 - Analysis results displayed as collapsible inline cards
 */
export interface AnalysisData {
  summary?: string;
  insights?: string[];
  statistics?: Record<string, unknown>;
}

/**
 * Props for InlineAnalysisCard component
 * Validates: Requirement 6.4 - Analysis card collapsed by default
 */
export interface InlineAnalysisCardProps {
  analysis: AnalysisData;
  defaultExpanded?: boolean; // false by default
}

/**
 * InlineAnalysisCard - Collapsible analysis card for conversational chat flow
 * 
 * Displays analysis results as a compact, collapsible card within the conversation.
 * Collapsed by default to maintain conversational flow without dominating the screen.
 * Uses compact styling consistent with chat bubbles, not dashboard-style cards.
 * 
 * Validates: Requirements 6.1, 6.2, 6.4, 6.5
 * - 6.1: Analysis results displayed as collapsible inline cards within the message
 * - 6.2: Shows brief summary when collapsed (e.g., "3 insights, 5 statistics")
 * - 6.4: Analysis card does NOT automatically expand or take over the screen
 * - 6.5: Styling consistent with conversational theme, not dashboard-style
 */
export function InlineAnalysisCard({ analysis, defaultExpanded = false }: InlineAnalysisCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  
  // Generate summary preview for collapsed state
  // Validates: Requirement 6.2 - Show brief summary when collapsed
  const insightCount = analysis.insights?.length || 0;
  const statisticCount = Object.keys(analysis.statistics || {}).length;
  const previewText = analysis.summary 
    ? analysis.summary.slice(0, 100) + (analysis.summary.length > 100 ? '...' : '')
    : `${insightCount} insight${insightCount !== 1 ? 's' : ''}, ${statisticCount} statistic${statisticCount !== 1 ? 's' : ''}`;
  
  return (
    <div 
      className="mt-3 rounded-2xl overflow-hidden" 
      style={{ 
        border: 'none', 
        background: 'var(--bg-secondary)'
      }}
      data-testid="inline-analysis-card"
      data-expanded={expanded}
    >
      {/* Header - compact, conversational style (not dashboard gradient) */}
      <div 
        className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => setExpanded(!expanded)}
        style={{ 
          background: 'var(--bg-tertiary, var(--bg-secondary))',
          borderBottom: 'none'
        }}
        role="button"
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse analysis' : 'Expand analysis'}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span 
            className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            📊
          </span>
          <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            Data Analysis
          </span>
          {/* Show preview text when collapsed - conversational inline style */}
          {!expanded && (
            <span 
              className="text-sm ml-1 truncate hidden sm:inline"
              style={{ color: 'var(--text-muted)' }}
            >
              — {previewText}
            </span>
          )}
        </div>
        {/* Expand/collapse chevron indicator */}
        <svg 
          className={`w-4 h-4 flex-shrink-0 ml-2 transition-transform ${expanded ? 'rotate-180' : ''}`} 
          style={{ color: 'var(--text-muted)' }}
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      
      {/* Expanded content - compact conversational layout */}
      {expanded && (
        <div className="px-3 py-3 space-y-3">
          {/* Summary section */}
          {analysis.summary && (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              {analysis.summary}
            </p>
          )}
          
          {/* Insights section - compact list style */}
          {analysis.insights && analysis.insights.length > 0 && (
            <div>
              <h4 
                className="text-xs font-medium mb-1.5 uppercase tracking-wide" 
                style={{ color: 'var(--text-muted)' }}
              >
                Key Insights
              </h4>
              <ul className="space-y-1">
                {analysis.insights.map((insight, i) => (
                  <li 
                    key={i} 
                    className="text-sm flex items-start gap-2 leading-relaxed" 
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <span style={{ color: 'var(--accent)' }}>•</span>
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Statistics - compact inline style instead of dashboard grid */}
          {analysis.statistics && Object.keys(analysis.statistics).length > 0 && (
            <div>
              <h4 
                className="text-xs font-medium mb-1.5 uppercase tracking-wide" 
                style={{ color: 'var(--text-muted)' }}
              >
                Statistics
              </h4>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {Object.entries(analysis.statistics).map(([key, value]) => (
                  <span key={key} className="text-sm" style={{ color: 'var(--text-primary)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{key}:</span>{' '}
                    <span className="font-medium">
                      {typeof value === 'number' ? value.toLocaleString() : String(value)}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
