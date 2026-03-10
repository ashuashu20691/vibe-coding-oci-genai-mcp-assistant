'use client';
import { useState, useRef, useCallback, useEffect, ReactNode } from 'react';

interface MainLayoutProps {
  sidebar: ReactNode;
  chatPanel: ReactNode;
  artifactsPanel: ReactNode | null;
  isArtifactsPanelOpen: boolean;
  sidebarOpen?: boolean;
  onSidebarClose?: () => void;
}

/**
 * MainLayout Component
 * 
 * Provides split-screen layout with:
 * - Sidebar (collapsible, mobile overlay on <768px)
 * - Chat panel (60% width when artifacts open, 100% when closed)
 * - Artifacts panel (40% width, hidden on mobile)
 * - Resize handle between chat and artifacts panels
 * 
 * Requirements: 15.1, 15.7, 6.6, 6.7, 6.8, 14.1
 * - Requirement 15.1: Split-screen layout with chat (60%) and artifacts (40%)
 * - Requirement 15.7: Hide artifacts panel on mobile viewports
 * - Requirement 6.6: Display sidebar as slide-in overlay on mobile (<768px)
 * - Requirement 6.7: Smooth slide-in/slide-out animation
 * - Requirement 6.8: Tap-outside-to-close behavior
 * - Requirement 14.1: Mobile layout below 768px
 */
export function MainLayout({
  sidebar,
  chatPanel,
  artifactsPanel,
  isArtifactsPanelOpen,
  sidebarOpen = false,
  onSidebarClose,
}: MainLayoutProps) {
  const [chatWidth, setChatWidth] = useState(60); // Percentage
  const [isMobile, setIsMobile] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sidebarOverlayRef = useRef<HTMLDivElement>(null);
  
  // Swipe gesture state (Requirement 14.6)
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchCurrent, setTouchCurrent] = useState<number | null>(null);
  const [isSwiping, setIsSwiping] = useState(false);

  // Detect mobile viewport (Requirement 15.7, 14.1)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle tap-outside-to-close on mobile (Requirement 6.8)
  useEffect(() => {
    if (!isMobile || !sidebarOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Check if click is outside sidebar
      if (sidebarOverlayRef.current && !sidebarOverlayRef.current.contains(target)) {
        onSidebarClose?.();
      }
    };

    // Add slight delay to prevent immediate close on open
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobile, sidebarOpen, onSidebarClose]);

  // Handle swipe gestures for mobile sidebar (Requirement 14.6)
  useEffect(() => {
    if (!isMobile) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      const startX = touch.clientX;
      
      // Only start swipe tracking if:
      // 1. Swipe starts from left edge (within 20px) and sidebar is closed (swipe-right to open)
      // 2. Swipe starts anywhere on the sidebar and sidebar is open (swipe-left to close)
      if ((!sidebarOpen && startX < 20) || (sidebarOpen && sidebarOverlayRef.current?.contains(e.target as Node))) {
        setTouchStart(startX);
        setTouchCurrent(startX);
        setIsSwiping(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStart === null) return;
      
      const touch = e.touches[0];
      setTouchCurrent(touch.clientX);
      
      // Prevent default scrolling during swipe
      const deltaX = touch.clientX - touchStart;
      if (Math.abs(deltaX) > 10) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = () => {
      if (touchStart === null || touchCurrent === null) {
        setTouchStart(null);
        setTouchCurrent(null);
        setIsSwiping(false);
        return;
      }

      const deltaX = touchCurrent - touchStart;
      const threshold = 50; // Minimum swipe distance in pixels

      // Swipe right to open (when closed)
      if (!sidebarOpen && deltaX > threshold) {
        // Open sidebar - handled by parent component
        // We need to trigger the sidebar toggle in CopilotChatUI
        // For now, we'll dispatch a custom event
        window.dispatchEvent(new CustomEvent('openSidebar'));
      }
      // Swipe left to close (when open)
      else if (sidebarOpen && deltaX < -threshold) {
        onSidebarClose?.();
      }

      setTouchStart(null);
      setTouchCurrent(null);
      setIsSwiping(false);
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobile, sidebarOpen, onSidebarClose, touchStart, touchCurrent]);

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
        position: 'relative',
      }}
    >
      {/* Mobile Overlay Backdrop (Requirement 6.6, 6.8) */}
      {isMobile && (sidebarOpen || isSwiping) && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 40,
            opacity: (() => {
              // Calculate opacity based on swipe progress
              if (isSwiping && touchStart !== null && touchCurrent !== null) {
                const deltaX = touchCurrent - touchStart;
                
                if (sidebarOpen) {
                  // Sidebar is open, fade out as user swipes left
                  const progress = Math.max(0, Math.min(1, 1 + deltaX / 280));
                  return progress;
                } else {
                  // Sidebar is closed, fade in as user swipes right
                  const progress = Math.max(0, Math.min(1, deltaX / 280));
                  return progress;
                }
              }
              
              return sidebarOpen ? 1 : 0;
            })(),
            transition: isSwiping ? 'none' : 'opacity 0.2s ease-out',
            pointerEvents: sidebarOpen ? 'auto' : 'none',
          }}
          onClick={() => onSidebarClose?.()}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - Desktop or Mobile Overlay (Requirements 6.6, 6.7) */}
      {isMobile ? (
        // Mobile: Slide-in overlay with swipe gesture support (Requirement 14.6)
        <div
          ref={sidebarOverlayRef}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            bottom: 0,
            width: '280px',
            maxWidth: '85vw',
            zIndex: 50,
            transform: (() => {
              // Calculate transform based on swipe progress
              if (isSwiping && touchStart !== null && touchCurrent !== null) {
                const deltaX = touchCurrent - touchStart;
                
                if (sidebarOpen) {
                  // Sidebar is open, allow swiping left to close
                  const translateX = Math.min(0, deltaX);
                  return `translateX(${translateX}px)`;
                } else {
                  // Sidebar is closed, allow swiping right to open
                  const translateX = Math.max(-280, -280 + deltaX);
                  return `translateX(${translateX}px)`;
                }
              }
              
              // Default state
              return sidebarOpen ? 'translateX(0)' : 'translateX(-100%)';
            })(),
            transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            background: 'var(--bg-sidebar)',
            boxShadow: sidebarOpen ? '2px 0 8px rgba(0, 0, 0, 0.15)' : 'none',
          }}
          aria-hidden={!sidebarOpen}
        >
          {sidebar}
        </div>
      ) : (
        // Desktop: Normal sidebar
        sidebar
      )}

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
        
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
