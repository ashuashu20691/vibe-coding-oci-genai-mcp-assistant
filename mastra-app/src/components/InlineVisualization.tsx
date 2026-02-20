'use client';

import { useState } from 'react';
import { FullscreenOverlay } from './FullscreenOverlay';

/**
 * InlineVisualization Component
 * 
 * Displays visualizations inline within the conversation flow.
 * Collapsed by default with title and "Click to expand" hint.
 * Supports fullscreen mode for detailed viewing.
 * 
 * Task 5.1: Update VisualizationCard to be collapsed by default
 * Validates: Requirements 4.3
 */

export interface VisualizationData {
  type: string;
  html?: string;
  title?: string;
  data?: Record<string, unknown>[];
}

export interface InlineVisualizationProps {
  visualization: VisualizationData;
  defaultExpanded?: boolean; // false by default
}

export function InlineVisualization({ 
  visualization, 
  defaultExpanded = false 
}: InlineVisualizationProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [fullscreen, setFullscreen] = useState(false);
  
  // Generate display title from visualization type or use provided title
  const displayTitle = visualization.title || 
    visualization.type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  
  // Get icon based on visualization type
  const getVisualizationIcon = () => {
    const type = visualization.type.toLowerCase();
    if (type.includes('chart') || type.includes('bar') || type.includes('line')) {
      return (
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    }
    if (type.includes('pie') || type.includes('donut')) {
      return (
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
      );
    }
    if (type.includes('table') || type.includes('data')) {
      return (
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      );
    }
    // Default chart icon
    return (
      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
      </svg>
    );
  };

  const handleToggleExpand = () => {
    setExpanded(!expanded);
  };

  const handleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFullscreen(true);
  };

  return (
    <>
      {/* Fullscreen overlay */}
      <FullscreenOverlay
        isOpen={fullscreen}
        onClose={() => setFullscreen(false)}
        title={displayTitle}
      >
        {visualization.html && (
          <iframe
            srcDoc={visualization.html}
            className="w-full h-full border-none"
            sandbox="allow-scripts allow-same-origin"
            title={displayTitle}
          />
        )}
      </FullscreenOverlay>

      {/* Inline visualization card */}
      <div 
        className="inline-visualization mt-4 rounded-xl overflow-hidden"
        style={{ 
          border: '1px solid var(--border-color)', 
          background: 'var(--bg-secondary)' 
        }}
        data-testid="inline-visualization"
      >
        {/* Header - always visible */}
        <div
          className="inline-visualization-header flex items-center justify-between px-4 py-3 cursor-pointer"
          onClick={handleToggleExpand}
          style={{ 
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' 
          }}
          role="button"
          aria-expanded={expanded}
          aria-label={`${displayTitle} - ${expanded ? 'Click to collapse' : 'Click to expand'}`}
          data-testid="inline-visualization-header"
        >
          <div className="flex items-center gap-2">
            {getVisualizationIcon()}
            <span className="font-medium text-white">{displayTitle}</span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-white/20 text-white">
              Interactive
            </span>
            {!expanded && (
              <span 
                className="text-white/70 text-sm ml-2 hidden sm:inline"
                data-testid="expand-hint"
              >
                — Click to expand
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Fullscreen button */}
            <button
              onClick={handleFullscreen}
              className="p-1 rounded hover:bg-white/20 transition-colors"
              title="View fullscreen"
              aria-label="View fullscreen"
              data-testid="fullscreen-btn"
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" 
                />
              </svg>
            </button>
            {/* Expand/collapse chevron */}
            <svg 
              className={`w-5 h-5 text-white transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
              data-testid="expand-chevron"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Content - only visible when expanded */}
        {expanded && visualization.html && (
          <div 
            className="inline-visualization-content"
            style={{ 
              background: 'var(--bg-primary, #ffffff)', 
              maxHeight: '400px',
              overflow: 'auto'
            }}
            data-testid="inline-visualization-content"
          >
            <iframe
              srcDoc={visualization.html}
              className="w-full border-none block"
              style={{ height: '400px', minHeight: '300px' }}
              sandbox="allow-scripts allow-same-origin"
              title={displayTitle}
            />
          </div>
        )}
      </div>
    </>
  );
}
