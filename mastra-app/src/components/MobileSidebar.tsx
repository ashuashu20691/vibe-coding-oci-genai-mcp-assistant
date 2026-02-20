'use client';

/**
 * MobileSidebar Component
 * 
 * Provides a hamburger menu button and slide-out drawer for mobile viewports.
 * The sidebar collapses into a hamburger menu on mobile (<768px) and tablet (768-1024px).
 * 
 * Validates: Requirements 12.2
 */

import { useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface MobileSidebarProps {
  /** Whether the sidebar drawer is open */
  isOpen: boolean;
  /** Callback when the sidebar should be opened/closed */
  onToggle: () => void;
  /** Callback when the sidebar should be closed (e.g., backdrop click) */
  onClose: () => void;
  /** The sidebar content to render in the drawer */
  children: React.ReactNode;
  /** Optional title for the sidebar header */
  title?: string;
}

/**
 * Hamburger menu icon component
 */
export function HamburgerIcon({ className = '' }: { className?: string }) {
  return (
    <svg 
      className={`w-5 h-5 ${className}`} 
      fill="none" 
      viewBox="0 0 24 24" 
      stroke="currentColor"
      aria-hidden="true"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M4 6h16M4 12h16M4 18h16" 
      />
    </svg>
  );
}

/**
 * Close icon component
 */
export function CloseIcon({ className = '' }: { className?: string }) {
  return (
    <svg 
      className={`w-5 h-5 ${className}`} 
      fill="none" 
      viewBox="0 0 24 24" 
      stroke="currentColor"
      aria-hidden="true"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M6 18L18 6M6 6l12 12" 
      />
    </svg>
  );
}

/**
 * Hamburger menu button component
 * Shows on mobile and tablet viewports
 */
export function HamburgerButton({ 
  onClick, 
  isOpen,
  className = '' 
}: { 
  onClick: () => void; 
  isOpen: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        p-2 rounded-lg transition-all duration-200 ease-in-out
        hover:opacity-70 active:scale-95
        responsive-touch-target
        ${className}
      `}
      style={{ 
        color: 'var(--text-secondary)',
        minWidth: 'var(--touch-target-min)',
        minHeight: 'var(--touch-target-min)',
      }}
      aria-label={isOpen ? 'Close menu' : 'Open menu'}
      aria-expanded={isOpen}
      aria-controls="mobile-sidebar-drawer"
    >
      {isOpen ? <CloseIcon /> : <HamburgerIcon />}
    </button>
  );
}

/**
 * Backdrop overlay component
 * Appears behind the drawer when open
 */
function Backdrop({ 
  isOpen, 
  onClick 
}: { 
  isOpen: boolean; 
  onClick: () => void;
}) {
  return (
    <div
      className={`
        fixed inset-0 z-40
        transition-opacity duration-300 ease-in-out
        ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
      `}
      style={{ 
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(2px)',
      }}
      onClick={onClick}
      aria-hidden="true"
    />
  );
}

/**
 * Slide-out drawer component
 * Contains the sidebar content on mobile
 */
function Drawer({ 
  isOpen, 
  onClose,
  children,
  title,
}: { 
  isOpen: boolean; 
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Handle escape key to close drawer
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Trap focus within drawer when open
  useEffect(() => {
    if (isOpen && drawerRef.current) {
      const focusableElements = drawerRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      firstElement?.focus();
    }
  }, [isOpen]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <div
      ref={drawerRef}
      id="mobile-sidebar-drawer"
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Sidebar menu'}
      className={`
        fixed top-0 left-0 h-full z-50
        w-[280px] max-w-[85vw]
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
      style={{ 
        background: 'var(--bg-secondary)',
        boxShadow: isOpen ? '4px 0 20px rgba(0, 0, 0, 0.15)' : 'none',
      }}
    >
      {/* Drawer header with close button */}
      <div 
        className="flex items-center justify-between h-[52px] px-4"
        style={{ borderBottom: '1px solid var(--border-color)' }}
      >
        {title && (
          <span 
            className="font-medium text-sm"
            style={{ color: 'var(--text-primary)' }}
          >
            {title}
          </span>
        )}
        <button
          onClick={onClose}
          className="
            p-2 rounded-lg transition-all duration-200 ease-in-out
            hover:opacity-70 active:scale-95 ml-auto
            responsive-touch-target
          "
          style={{ 
            color: 'var(--text-secondary)',
            minWidth: 'var(--touch-target-min)',
            minHeight: 'var(--touch-target-min)',
          }}
          aria-label="Close menu"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Drawer content */}
      <div className="h-[calc(100%-52px)] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

/**
 * MobileSidebar component
 * Combines the backdrop and drawer for a complete mobile sidebar experience
 */
export function MobileSidebar({ 
  isOpen, 
  onToggle, 
  onClose, 
  children,
  title = 'Conversations',
}: MobileSidebarProps) {
  // Handle click outside to close
  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  // Only render portal on client side
  if (typeof window === 'undefined') {
    return null;
  }

  return createPortal(
    <>
      <Backdrop isOpen={isOpen} onClick={handleBackdropClick} />
      <Drawer isOpen={isOpen} onClose={onClose} title={title}>
        {children}
      </Drawer>
    </>,
    document.body
  );
}

/**
 * Hook to manage mobile sidebar state
 * Provides open/close/toggle functionality with proper cleanup
 */
export function useMobileSidebar(initialOpen = false) {
  const [isOpen, setIsOpen] = useState(initialOpen);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  return {
    isOpen,
    open,
    close,
    toggle,
  };
}

// Need to import useState for the hook
import { useState } from 'react';
