// src/components/ArtifactsPanel.tsx

'use client';

import React, { useState, useRef, useEffect, Component, ReactNode } from 'react';
import type { Artifact, ArtifactModification } from '@/types';
import { OutputRenderer } from './OutputRenderer';
import { DataTable } from './DataTable';
import { DashboardRenderer } from './DashboardRenderer';

/**
 * Error boundary for React component artifacts
 * Catches rendering errors and displays a fallback UI
 */
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('React component artifact error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-red-500 gap-4 p-8">
          <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-center">
            <p className="font-medium text-gray-900 dark:text-gray-100">Component rendering failed</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              {this.state.error?.message || 'Unknown error occurred'}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * ArtifactsPanel component - Split-screen panel for displaying large tables, charts, and interactive dashboards
 * Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7
 */
export interface ArtifactsPanelProps {
  artifact: Artifact | null;
  onClose: () => void;
  onUserModification?: (modification: ArtifactModification) => void;
}

export function ArtifactsPanel({ artifact, onClose, onUserModification }: ArtifactsPanelProps) {
  const [isResizing, setIsResizing] = useState(false);
  const [panelWidth, setPanelWidth] = useState(40); // Default 40% width
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [previousVersion, setPreviousVersion] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'chart' | 'data'>('chart');
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Track version changes and trigger animations (Requirement 15.3)
  useEffect(() => {
    if (artifact && previousVersion !== null && artifact.version !== previousVersion) {
      // Version changed - trigger transition animation
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 300); // Match CSS transition duration
      return () => clearTimeout(timer);
    }
    if (artifact) {
      setPreviousVersion(artifact.version);
    }
    // Reset to chart tab when artifact changes
    setActiveTab('chart');
  }, [artifact?.version, previousVersion, artifact]);

  // Hide panel when no artifacts active (Requirement 15.7)
  if (!artifact) {
    return null;
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const windowWidth = window.innerWidth;
      const newWidth = ((windowWidth - e.clientX) / windowWidth) * 100;

      // Constrain width between 30% and 60%
      const constrainedWidth = Math.max(30, Math.min(60, newWidth));
      setPanelWidth(constrainedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleUserModification = (modificationType: ArtifactModification['modificationType'], details: Record<string, unknown>) => {
    if (onUserModification) {
      // Emit modification event to parent component (e.g., chat service)
      // The parent can then generate acknowledgment messages in the chat
      // Example: "I see you filtered the table by name='Alice'"
      onUserModification({
        artifactId: artifact.id,
        modificationType,
        details,
        timestamp: new Date(),
      });
    }
  };

  const renderArtifactContent = () => {
    const { content } = artifact;

    try {
      switch (content.type) {
        case 'table':
          if (!Array.isArray(content.data)) {
            throw new Error('Table data must be an array');
          }
          return (
            <DataTable
              data={content.data}
              title={artifact.title}
              fullscreenEnabled
              exportEnabled
              onUserModification={(modificationType, details) => 
                handleUserModification(modificationType, details)
              }
            />
          );

        case 'chart':
          if (!content.chartType) {
            throw new Error('Chart type is required');
          }
          return (
            <OutputRenderer
              data={content.data}
              outputType={content.chartType as any}
              title={artifact.title}
            />
          );

        case 'code':
          if (typeof content.code !== 'string') {
            throw new Error('Code content must be a string');
          }
          return (
            <div className="h-full overflow-auto">
              <pre className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <code className={`language-${content.language || 'text'}`}>
                  {content.code}
                </code>
              </pre>
            </div>
          );

        case 'html':
          if (typeof content.html !== 'string') {
            throw new Error('HTML content must be a string');
          }
          return (
            <iframe
              srcDoc={content.html}
              className="w-full h-full border-none"
              style={{ minHeight: '500px' }}
              sandbox="allow-scripts allow-same-origin"
              title={artifact.title}
            />
          );

        case 'dashboard':
          if (!Array.isArray(content.widgets)) {
            throw new Error('Dashboard widgets must be an array');
          }
          // Convert widgets to DashboardConfig format
          const dashboardConfig = {
            title: artifact.title,
            stats: [],
            alerts: [],
            charts: content.widgets
              .filter((w: any) => ['bar_chart', 'line_chart', 'pie_chart'].includes(w.type))
              .map((w: any, idx: number) => ({
                id: `chart-${idx}`,
                title: w.title || `Chart ${idx + 1}`,
                type: w.type as 'bar_chart' | 'line_chart' | 'pie_chart',
                data: Array.isArray(w.data) ? w.data : [],
                xKey: w.config?.xColumn || 'x',
                yKey: w.config?.yColumn || 'y',
              })),
            tables: content.widgets
              .filter((w: any) => w.type === 'table')
              .map((w: any, idx: number) => ({
                id: `table-${idx}`,
                title: w.title || `Table ${idx + 1}`,
                data: Array.isArray(w.data) ? w.data : [],
                columns: w.data && w.data.length > 0 ? Object.keys(w.data[0]) : [],
              })),
            metadata: {},
          };
          return <DashboardRenderer config={dashboardConfig} />;

        case 'react_component':
          if (!content.component) {
            throw new Error('React component is required');
          }
          const Component = content.component;
          return (
            <ErrorBoundary>
              <Component {...(content.props || {})} />
            </ErrorBoundary>
          );

        default:
          return (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
              <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-center">
                <p className="font-medium">Unsupported artifact type</p>
                <p className="text-sm text-gray-400 mt-1">Type: {(content as any).type}</p>
              </div>
            </div>
          );
      }
    } catch (error) {
      console.error('Error rendering artifact:', error);
      return (
        <div className="flex flex-col items-center justify-center h-full text-red-500 gap-4 p-8">
          <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-center">
            <p className="font-medium text-gray-900 dark:text-gray-100">Failed to render artifact</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              {error instanceof Error ? error.message : 'Unknown error occurred'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
  };

  return (
    <>
      {/* Resize Handle */}
      <div
        className={`
          w-1 bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 dark:hover:bg-blue-400
          cursor-col-resize transition-colors flex-shrink-0
          ${isResizing ? 'bg-blue-500 dark:bg-blue-400' : ''}
        `}
        onMouseDown={handleMouseDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize artifacts panel"
      />

      {/* Artifacts Panel */}
      <div
        ref={panelRef}
        className="flex flex-col bg-white dark:bg-gray-800 overflow-hidden"
        style={{ width: `${panelWidth}%` }}
      >
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                {artifact.title}
              </h2>
              <div className="flex items-center gap-2">
                <p className={`
                  text-xs text-gray-500 dark:text-gray-400 transition-all duration-300
                  ${isTransitioning ? 'text-blue-500 dark:text-blue-400 font-medium' : ''}
                `}>
                  Version {artifact.version} • Updated {artifact.updatedAt.toLocaleTimeString()}
                </p>
                {isTransitioning && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 animate-pulse">
                    Updating...
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="ml-4 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close artifacts panel"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* Tabs — Claude Desktop style */}
          {(artifact.metadata?.data || artifact.content.type === 'table') && (
            <div className="flex px-4 gap-1" role="tablist">
              <button
                role="tab"
                aria-selected={activeTab === 'chart'}
                onClick={() => setActiveTab('chart')}
                className={`px-3 py-1.5 text-sm font-medium rounded-t-md transition-colors ${
                  activeTab === 'chart'
                    ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 border border-b-0 border-gray-200 dark:border-gray-700'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                📊 Charts
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 'data'}
                onClick={() => setActiveTab('data')}
                className={`px-3 py-1.5 text-sm font-medium rounded-t-md transition-colors ${
                  activeTab === 'data'
                    ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 border border-b-0 border-gray-200 dark:border-gray-700'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                📋 Data
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div 
          ref={contentRef}
          className={`
            flex-1 overflow-hidden transition-opacity duration-300
            ${isTransitioning ? 'opacity-50' : 'opacity-100'}
          `}
        >
          {activeTab === 'data' && artifact.metadata?.data ? (
            <div className="h-full overflow-auto">
              <DataTable 
                data={artifact.metadata.data as Record<string, unknown>[]} 
                title={artifact.title}
                fullscreenEnabled
                exportEnabled
              />
            </div>
          ) : (
            renderArtifactContent()
          )}
        </div>
      </div>
    </>
  );
}
