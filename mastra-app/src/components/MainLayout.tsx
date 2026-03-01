'use client';
import { useState, useRef, useCallback, useEffect, ReactNode } from 'react';

interface MainLayoutProps {
  sidebar: ReactNode;
  chatPanel: ReactNode;
  artifactsPanel: ReactNode | null;
  isArtifactsPanelOpen: boolean;
}

/**
 * MainLayout Component
 * 
 * Provides split-screen layout with:
 * - Sidebar (collapsible)
 * - Chat panel (60% width when artifacts open, 100% when closed)
 * - Artifacts panel (40% width, hidden on mobile)
 * - Resize handle between chat and artifacts panels
 * 
 * Requirements: 15.1, 15.7
 * - Requirement 15.1: Split-screen layout with chat (60%) and artifacts (40%)
 * - Requirement 15.7: Hide artifacts panel on mobile viewports
 */
export function MainLayout({
  sidebar,
  chatPanel,
  artifactsPanel,
  isArtifactsPanelOpen,
}: MainLayoutProps) {
  const [chatWidth, setChatWidth] = useState(60); // Percentage
  const [isMobile, setIsMobile] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Detect mobile viewport (Requirement 15.7)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle resize drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const newChatWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    
    // Constrain between 40% and 80%
    const constrainedWidth = Math.max(40, Math.min(80, newChatWidth));
    setChatWidth(constrainedWidth);
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Reset chat width when artifacts panel closes
  useEffect(() => {
    if (!isArtifactsPanelOpen) {
      setChatWidth(60);
    }
  }, [isArtifactsPanelOpen]);

  // On mobile, hide artifacts panel (Requirement 15.7)
  const showArtifacts = isArtifactsPanelOpen && !isMobile;

  return (
    <div 
      ref={containerRef}
      style={{ 
        display: 'flex', 
        height: '100vh', 
        width: '100%',
        background: 'var(--bg-primary)',
        overflow: 'hidden',
        cursor: isResizing ? 'col-resize' : 'default',
        userSelect: isResizing ? 'none' : 'auto',
      }}
    >
      {/* Sidebar */}
      {sidebar}

      {/* Chat Panel */}
      <div style={{ 
        flex: showArtifacts ? `0 0 ${chatWidth}%` : 1, 
        display: 'flex', 
        flexDirection: 'column',
        minWidth: 0,
        height: '100vh',
        transition: isResizing ? 'none' : 'flex 0.3s ease',
      }}>
        {chatPanel}
      </div>

      {/* Resize Handle - only visible when artifacts panel is open */}
      {showArtifacts && (
        <div
          onMouseDown={handleMouseDown}
          style={{
            width: '4px',
            height: '100vh',
            background: 'var(--border-color)',
            cursor: 'col-resize',
            flexShrink: 0,
            position: 'relative',
            transition: 'background 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            if (!isResizing) {
              e.currentTarget.style.background = 'var(--border-color)';
            }
          }}
        >
          {/* Visual indicator for resize handle */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '20px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-secondary)',
              borderRadius: '4px',
              opacity: 0,
              transition: 'opacity 0.2s ease',
              pointerEvents: 'none',
            }}
            className="resize-indicator"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="var(--text-muted)">
              <circle cx="3" cy="6" r="1" />
              <circle cx="9" cy="6" r="1" />
            </svg>
          </div>
        </div>
      )}

      {/* Artifacts Panel */}
      {showArtifacts && artifactsPanel}

      <style jsx>{`
        div:hover .resize-indicator {
          opacity: 1;
        }
      `}</style>
    </div>
  );
}
