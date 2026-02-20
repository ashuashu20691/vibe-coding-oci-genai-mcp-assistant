'use client';

import { useEffect, useCallback, ReactNode } from 'react';

export interface FullscreenOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/**
 * FullscreenOverlay component that displays content in a fullscreen modal.
 * Supports closing via close button, Escape key, or clicking the backdrop.
 */
export function FullscreenOverlay({ isOpen, onClose, title, children }: FullscreenOverlayProps) {
  // Handle Escape key to close
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when overlay is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fullscreen-overlay fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)' }}
      data-testid="fullscreen-overlay"
    >
      {/* Header with title and close button */}
      <div 
        className="flex items-center justify-between px-6 py-4"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      >
        <h2 className="text-lg font-semibold text-white truncate">
          {title || 'Fullscreen View'}
        </h2>
        <button
          onClick={onClose}
          className="fullscreen-close-btn close-btn p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
          aria-label="Close fullscreen"
          data-testid="fullscreen-close-btn"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content area */}
      <div 
        className="flex-1 overflow-auto p-6"
        onClick={(e) => {
          // Close when clicking the backdrop (not the content)
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div 
          className="fullscreen-content w-full h-full rounded-lg overflow-hidden"
          style={{ backgroundColor: 'var(--bg-primary, #ffffff)' }}
        >
          {children}
        </div>
      </div>

      {/* Footer hint */}
      <div 
        className="px-6 py-3 text-center text-sm text-gray-400"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      >
        Press <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Esc</kbd> or click outside to close
      </div>
    </div>
  );
}

/**
 * FullscreenButton component - a reusable button to toggle fullscreen mode.
 */
export interface FullscreenButtonProps {
  onClick: () => void;
  className?: string;
}

export function FullscreenButton({ onClick, className = '' }: FullscreenButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`fullscreen-toggle-btn p-2 rounded-lg transition-colors hover:bg-gray-100 ${className}`}
      style={{ 
        color: 'var(--text-secondary, #6B7280)',
        border: '1px solid var(--border-color, #E5E7EB)'
      }}
      aria-label="Toggle fullscreen"
      title="View fullscreen"
      data-testid="fullscreen-toggle-btn"
    >
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
        />
      </svg>
    </button>
  );
}
