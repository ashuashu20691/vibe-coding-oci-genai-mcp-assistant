/**
 * Accessibility Enhancement Components
 * 
 * Task 11: Accessibility implementation
 * Sub-tasks 11.1, 11.2, 11.3
 * 
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.6, 10.7, 10.8
 */

'use client';

import React from 'react';

/**
 * Skip to main content link for keyboard navigation
 * Validates: Requirement 10.6
 */
export function SkipToMain() {
  return (
    <a
      href="#main-content"
      className="skip-to-main"
      style={{
        position: 'absolute',
        top: '-40px',
        left: 0,
        background: 'var(--accent)',
        color: 'white',
        padding: '8px 16px',
        textDecoration: 'none',
        borderRadius: '0 0 4px 0',
        zIndex: 10000,
        fontWeight: 500,
      }}
      onFocus={(e) => {
        e.currentTarget.style.top = '0';
      }}
      onBlur={(e) => {
        e.currentTarget.style.top = '-40px';
      }}
    >
      Skip to main content
    </a>
  );
}

/**
 * Status indicator with icon and text for non-color accessibility
 * Validates: Requirement 10.8
 */
interface StatusIndicatorProps {
  status: 'success' | 'error' | 'warning' | 'loading' | 'info';
  label?: string;
  showIcon?: boolean;
  showText?: boolean;
}

export function StatusIndicator({
  status,
  label,
  showIcon = true,
  showText = true,
}: StatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'success':
        return {
          icon: '✓',
          text: label || 'Success',
          color: 'var(--color-status-success)',
          bgColor: 'rgba(16, 185, 129, 0.1)',
        };
      case 'error':
        return {
          icon: '✕',
          text: label || 'Error',
          color: 'var(--color-status-error)',
          bgColor: 'rgba(239, 68, 68, 0.1)',
        };
      case 'warning':
        return {
          icon: '⚠',
          text: label || 'Warning',
          color: 'var(--color-status-warning)',
          bgColor: 'rgba(245, 158, 11, 0.1)',
        };
      case 'loading':
        return {
          icon: '⟳',
          text: label || 'Loading',
          color: 'var(--accent)',
          bgColor: 'rgba(15, 118, 110, 0.1)',
        };
      case 'info':
        return {
          icon: 'ℹ',
          text: label || 'Info',
          color: 'var(--text-secondary)',
          bgColor: 'var(--bg-tertiary)',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <span
      className={`status-indicator status-${status}`}
      role="status"
      aria-label={config.text}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 8px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 500,
        color: config.color,
        background: config.bgColor,
      }}
    >
      {showIcon && (
        <span
          aria-hidden="true"
          style={{
            fontSize: '12px',
            fontWeight: 'bold',
            animation: status === 'loading' ? 'spin 1s linear infinite' : 'none',
          }}
        >
          {config.icon}
        </span>
      )}
      {showText && <span>{config.text}</span>}
    </span>
  );
}

/**
 * Connection status indicator with icon and text
 * Validates: Requirement 10.8
 */
interface ConnectionStatusProps {
  connected: boolean;
  label?: string;
}

export function ConnectionStatus({ connected, label }: ConnectionStatusProps) {
  return (
    <span
      className={`connection-status ${connected ? 'connection-status-connected' : 'connection-status-disconnected'}`}
      role="status"
      aria-label={connected ? 'Connected' : 'Disconnected'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 8px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 500,
        background: connected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
        color: connected ? 'var(--color-status-connected)' : 'var(--color-status-error)',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: '8px' }}>●</span>
      <span>{label || (connected ? 'Connected' : 'Disconnected')}</span>
    </span>
  );
}

/**
 * Progress indicator with percentage and visual bar
 * Validates: Requirement 10.8
 */
interface ProgressIndicatorProps {
  value: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
}

export function ProgressIndicatorAccessible({
  value,
  max = 100,
  label,
  showPercentage = true,
}: ProgressIndicatorProps) {
  const percentage = Math.round((value / max) * 100);

  return (
    <div
      className="progress-indicator"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label || `Progress: ${percentage}%`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <div
        className="progress-bar"
        style={{
          flex: 1,
          height: '4px',
          background: 'var(--bg-tertiary)',
          borderRadius: '2px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          className="progress-bar-fill"
          style={{
            height: '100%',
            width: `${percentage}%`,
            background: 'var(--accent)',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      {showPercentage && (
        <span
          className="progress-percentage"
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--text-secondary)',
            minWidth: '40px',
            textAlign: 'right',
          }}
        >
          {percentage}%
        </span>
      )}
    </div>
  );
}

/**
 * Keyboard shortcut indicator
 * Validates: Requirement 10.6
 */
interface KeyboardShortcutProps {
  keys: string[];
  description?: string;
}

export function KeyboardShortcut({ keys, description }: KeyboardShortcutProps) {
  return (
    <span
      className="keyboard-shortcut"
      aria-label={description || `Keyboard shortcut: ${keys.join(' + ')}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 6px',
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-color)',
        borderRadius: '4px',
        fontSize: '11px',
        fontFamily: 'var(--font-family-mono)',
        color: 'var(--text-muted)',
      }}
    >
      {keys.map((key, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span aria-hidden="true">+</span>}
          <kbd>{key}</kbd>
        </React.Fragment>
      ))}
    </span>
  );
}

/**
 * File type indicator with icon
 * Validates: Requirement 10.8
 */
interface FileTypeIndicatorProps {
  type: string;
  name?: string;
}

export function FileTypeIndicator({ type, name }: FileTypeIndicatorProps) {
  const getFileTypeInfo = () => {
    if (type.startsWith('image/')) {
      return { icon: '🖼️', label: 'Image' };
    } else if (type.includes('pdf')) {
      return { icon: '📄', label: 'PDF' };
    } else if (type.includes('text') || type.includes('json')) {
      return { icon: '📝', label: 'Text' };
    } else if (type.includes('video')) {
      return { icon: '🎥', label: 'Video' };
    } else if (type.includes('audio')) {
      return { icon: '🎵', label: 'Audio' };
    } else {
      return { icon: '📎', label: 'File' };
    }
  };

  const info = getFileTypeInfo();

  return (
    <span
      className="file-type-indicator"
      aria-label={`${info.label}${name ? `: ${name}` : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 6px',
        background: 'var(--bg-tertiary)',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 500,
        color: 'var(--text-secondary)',
      }}
    >
      <span aria-hidden="true">{info.icon}</span>
      <span>{info.label}</span>
    </span>
  );
}

/**
 * Streaming indicator with animation and text
 * Validates: Requirements 10.3, 10.8
 */
export function StreamingIndicator({ label }: { label?: string }) {
  return (
    <span
      className="streaming-indicator"
      role="status"
      aria-live="polite"
      aria-label={label || 'Streaming in progress'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        color: 'var(--text-muted)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: 'var(--accent)',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
      <span>{label || 'Streaming...'}</span>
    </span>
  );
}

/**
 * Message type indicator
 * Validates: Requirement 10.2
 */
interface MessageTypeIndicatorProps {
  type: 'user' | 'assistant' | 'system';
}

export function MessageTypeIndicator({ type }: MessageTypeIndicatorProps) {
  const getTypeInfo = () => {
    switch (type) {
      case 'user':
        return { icon: '👤', label: 'User message' };
      case 'assistant':
        return { icon: '🤖', label: 'Assistant message' };
      case 'system':
        return { icon: '⚙️', label: 'System message' };
    }
  };

  const info = getTypeInfo();

  return (
    <span
      className="message-type-indicator sr-only"
      aria-label={info.label}
    >
      {info.label}
    </span>
  );
}

/**
 * Loading announcement for screen readers
 * Validates: Requirement 10.2
 */
export function LoadingAnnouncement({ message }: { message: string }) {
  return (
    <div
      className="loading-announcement sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {message}
    </div>
  );
}

/**
 * Error message with icon
 * Validates: Requirements 10.2, 10.8
 */
export function ErrorMessage({ message }: { message: string }) {
  return (
    <div
      className="error-message"
      role="alert"
      aria-live="assertive"
      style={{
        color: 'var(--color-status-error)',
        fontSize: '13px',
        marginTop: '4px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      <span aria-hidden="true" style={{ fontWeight: 'bold' }}>⚠</span>
      <span>{message}</span>
    </div>
  );
}

/**
 * Success message with icon
 * Validates: Requirements 10.2, 10.8
 */
export function SuccessMessage({ message }: { message: string }) {
  return (
    <div
      className="success-message"
      role="status"
      aria-live="polite"
      style={{
        color: 'var(--color-status-success)',
        fontSize: '13px',
        marginTop: '4px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      <span aria-hidden="true" style={{ fontWeight: 'bold' }}>✓</span>
      <span>{message}</span>
    </div>
  );
}
