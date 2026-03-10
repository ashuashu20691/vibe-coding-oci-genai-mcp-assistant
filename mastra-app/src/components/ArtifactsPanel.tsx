// src/components/ArtifactsPanel.tsx

'use client';

import React, { useState, useRef, useEffect, Component, ReactNode } from 'react';
import type { Artifact, ArtifactModification } from '@/types';
import { OutputRenderer } from './OutputRenderer';
import { DataTable } from './DataTable';
import { DashboardRenderer } from './DashboardRenderer';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import 'highlight.js/styles/github-dark.css'; // Syntax highlighting theme

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
  const [panelWidth, setPanelWidth] = useState(() => {
    // Restore panel width from localStorage (Requirement 5.3)
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('artifactsPanel.width');
      return saved ? parseFloat(saved) : 40;
    }
    return 40;
  });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [previousVersion, setPreviousVersion] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'table' | 'chart' | 'code'>('chart');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [versionHistory, setVersionHistory] = useState<Array<{ version: number; timestamp: Date }>>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Track version changes and trigger animations (Requirement 15.3)
  useEffect(() => {
    if (artifact && previousVersion !== null && artifact.version !== previousVersion) {
      // Version changed - trigger transition animation
      setIsTransitioning(true);
      
      // Add to version history (Requirement 5.5)
      setVersionHistory(prev => {
        const exists = prev.find(v => v.version === artifact.version);
        if (!exists) {
          return [...prev, { version: artifact.version, timestamp: artifact.updatedAt }];
        }
        return prev;
      });
      
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 300); // Match CSS transition duration
      return () => clearTimeout(timer);
    }
    if (artifact) {
      setPreviousVersion(artifact.version);
      // Initialize version history
      if (versionHistory.length === 0) {
        setVersionHistory([{ version: artifact.version, timestamp: artifact.updatedAt }]);
      }
    }
    // Reset to appropriate tab when artifact changes
    if (artifact?.content.type === 'table') {
      setActiveTab('table');
    } else if (artifact?.content.type === 'chart') {
      setActiveTab('chart');
    } else if (artifact?.content.type === 'code') {
      setActiveTab('code');
    }
  }, [artifact?.version, previousVersion, artifact, versionHistory.length]);

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

  // Persist panel width to localStorage (Requirement 5.3)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('artifactsPanel.width', panelWidth.toString());
    }
  }, [panelWidth]);

  // Handle fullscreen mode (Requirement 5.4)
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Handle Escape key to exit fullscreen
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    if (isFullscreen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isFullscreen]);

  // Handle version selection (Requirement 5.6)
  const handleVersionSelect = (version: number) => {
    setSelectedVersion(version);
    // In a real implementation, this would fetch the artifact at that version
    // For now, we just track the selection
  };

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
          // Import highlight.js dynamically for syntax highlighting (Requirement 5.9)
          const hljs = require('highlight.js');
          
          // Auto-detect language if not specified
          let detectedLanguage = content.language || 'plaintext';
          let highlightedCode = content.code;
          
          try {
            if (content.language && hljs.getLanguage(content.language)) {
              // Use specified language
              const result = hljs.highlight(content.code, { language: content.language });
              highlightedCode = result.value;
            } else {
              // Auto-detect language
              const result = hljs.highlightAuto(content.code);
              highlightedCode = result.value;
              detectedLanguage = result.language || 'plaintext';
            }
          } catch (error) {
            console.error('Syntax highlighting error:', error);
            // Fallback to plain text if highlighting fails
            highlightedCode = content.code;
          }
          
          return (
            <div className="h-full overflow-auto bg-gray-50 dark:bg-gray-900">
              <div className="sticky top-0 z-10 px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Language: {detectedLanguage}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(content.code);
                  }}
                  className="text-xs px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
                  title="Copy code"
                >
                  Copy
                </button>
              </div>
              <pre className="p-4">
                <code 
                  className={`hljs language-${detectedLanguage}`}
                  dangerouslySetInnerHTML={{ __html: highlightedCode }}
                />
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
      {/* Resize Handle - only show when not in fullscreen */}
      {!isFullscreen && (
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
      )}

      {/* Artifacts Panel */}
      <div
        ref={panelRef}
        className={`flex flex-col bg-white dark:bg-gray-800 overflow-hidden ${
          isFullscreen ? 'fixed inset-0 z-50' : ''
        }`}
        style={isFullscreen ? {} : { width: `${panelWidth}%` }}
      >
        {/* Tabs component wraps header and content (Requirements 5.1, 5.2) */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="flex-1 flex flex-col overflow-hidden">
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
                    Version {selectedVersion || artifact.version} • Updated {artifact.updatedAt.toLocaleTimeString()}
                  </p>
                  {isTransitioning && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 animate-pulse">
                      Updating...
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                {/* Version History Dropdown (Requirement 5.5, 5.6) */}
                {versionHistory.length > 1 && (
                  <div className="relative">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        // Toggle version history dropdown
                        const dropdown = document.getElementById('version-history-dropdown');
                        if (dropdown) {
                          dropdown.classList.toggle('hidden');
                        }
                      }}
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      History
                    </Button>
                    <div
                      id="version-history-dropdown"
                      className="hidden absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10"
                    >
                      <div className="p-2">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1">Version History</p>
                        {versionHistory.slice().reverse().map((v) => (
                          <button
                            key={v.version}
                            onClick={() => {
                              handleVersionSelect(v.version);
                              document.getElementById('version-history-dropdown')?.classList.add('hidden');
                            }}
                            className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                              (selectedVersion || artifact.version) === v.version
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                : 'text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span>Version {v.version}</span>
                              {(selectedVersion || artifact.version) === v.version && (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {v.timestamp.toLocaleString()}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Fullscreen Button (Requirement 5.4) */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'}
                  title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'}
                >
                  {isFullscreen ? (
                    // Exit fullscreen icon (compress/minimize)
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M15 9h4.5M15 9V4.5M15 9l5.25-5.25M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                    </svg>
                  ) : (
                    // Enter fullscreen icon (expand)
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  )}
                </Button>
                
                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Close artifacts panel"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Tabs Navigation - Only show tabs for artifacts that support multiple views */}
            {(artifact.content.type === 'table' || artifact.content.type === 'chart' || artifact.content.type === 'dashboard' || artifact.content.type === 'code') && (
              <div className="px-4 pb-2">
                <TabsList>
                  {(artifact.content.type === 'table' || (artifact.metadata?.data !== undefined)) && (
                    <TabsTrigger value="table">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Table
                    </TabsTrigger>
                  )}
                  {(artifact.content.type === 'chart' || artifact.content.type === 'dashboard') && (
                    <TabsTrigger value="chart">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Chart
                    </TabsTrigger>
                  )}
                  {artifact.content.type === 'code' && (
                    <TabsTrigger value="code">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                      Code
                    </TabsTrigger>
                  )}
                </TabsList>
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
            {/* For artifacts with tabs */}
            {(artifact.content.type === 'table' || artifact.content.type === 'chart' || artifact.content.type === 'dashboard' || artifact.content.type === 'code') ? (
              <>
                {/* Table Tab Content (Requirement 5.7) */}
                {(artifact.content.type === 'table' || (artifact.metadata?.data !== undefined)) && (
                  <TabsContent value="table" className="h-full mt-0 data-[state=active]:flex data-[state=active]:flex-col">
                    <div className="h-full overflow-auto">
                      <DataTable 
                        data={(artifact.content.type === 'table' ? artifact.content.data : artifact.metadata?.data) as Record<string, unknown>[]} 
                        title={artifact.title}
                        fullscreenEnabled
                        exportEnabled
                        onUserModification={(modificationType, details) => 
                          handleUserModification(modificationType, details)
                        }
                      />
                    </div>
                  </TabsContent>
                )}
                
                {/* Chart Tab Content (Requirement 5.8) */}
                {(artifact.content.type === 'chart' || artifact.content.type === 'dashboard') && (
                  <TabsContent value="chart" className="h-full mt-0 data-[state=active]:flex data-[state=active]:flex-col">
                    {renderArtifactContent()}
                  </TabsContent>
                )}
                
                {/* Code Tab Content (Requirement 5.9) */}
                {artifact.content.type === 'code' && (
                  <TabsContent value="code" className="h-full mt-0 data-[state=active]:flex data-[state=active]:flex-col">
                    {renderArtifactContent()}
                  </TabsContent>
                )}
              </>
            ) : (
              /* For artifacts without tabs (html, react_component, unsupported) */
              renderArtifactContent()
            )}
          </div>
        </Tabs>
      </div>
    </>
  );
}
