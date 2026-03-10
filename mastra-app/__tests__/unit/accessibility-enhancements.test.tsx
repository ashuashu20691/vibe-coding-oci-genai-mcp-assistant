/**
 * Unit Tests for Accessibility Enhancements
 * 
 * Task 11: Accessibility implementation
 * Tests for Sub-tasks 11.1, 11.2, 11.3
 * 
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.6, 10.7, 10.8
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  SkipToMain,
  StatusIndicator,
  ConnectionStatus,
  ProgressIndicatorAccessible,
  KeyboardShortcut,
  FileTypeIndicator,
  StreamingIndicator,
  MessageTypeIndicator,
  LoadingAnnouncement,
  ErrorMessage,
  SuccessMessage,
} from '@/components/AccessibilityEnhancements';

describe('Accessibility Enhancements', () => {
  describe('SkipToMain', () => {
    it('should render skip to main content link', () => {
      render(<SkipToMain />);
      const link = screen.getByText('Skip to main content');
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '#main-content');
    });

    it('should be keyboard accessible', () => {
      render(<SkipToMain />);
      const link = screen.getByText('Skip to main content');
      expect(link.tagName).toBe('A');
    });
  });

  describe('StatusIndicator', () => {
    it('should render success status with icon and text', () => {
      render(<StatusIndicator status="success" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Success')).toBeInTheDocument();
    });

    it('should render error status with icon and text', () => {
      render(<StatusIndicator status="error" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('should render warning status with icon and text', () => {
      render(<StatusIndicator status="warning" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Warning')).toBeInTheDocument();
    });

    it('should render loading status with icon and text', () => {
      render(<StatusIndicator status="loading" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Loading')).toBeInTheDocument();
    });

    it('should render custom label', () => {
      render(<StatusIndicator status="success" label="Custom Success" />);
      expect(screen.getByText('Custom Success')).toBeInTheDocument();
    });

    it('should hide icon when showIcon is false', () => {
      const { container } = render(<StatusIndicator status="success" showIcon={false} />);
      const icon = container.querySelector('[aria-hidden="true"]');
      expect(icon).not.toBeInTheDocument();
    });

    it('should hide text when showText is false', () => {
      render(<StatusIndicator status="success" showText={false} />);
      expect(screen.queryByText('Success')).not.toBeInTheDocument();
    });

    it('should have proper ARIA label', () => {
      render(<StatusIndicator status="success" label="Operation completed" />);
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-label', 'Operation completed');
    });
  });

  describe('ConnectionStatus', () => {
    it('should render connected status', () => {
      render(<ConnectionStatus connected={true} />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('should render disconnected status', () => {
      render(<ConnectionStatus connected={false} />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });

    it('should render custom label', () => {
      render(<ConnectionStatus connected={true} label="Database Online" />);
      expect(screen.getByText('Database Online')).toBeInTheDocument();
    });

    it('should have proper ARIA label', () => {
      render(<ConnectionStatus connected={true} />);
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-label', 'Connected');
    });
  });

  describe('ProgressIndicatorAccessible', () => {
    it('should render progress bar with percentage', () => {
      render(<ProgressIndicatorAccessible value={50} />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('should have proper ARIA attributes', () => {
      render(<ProgressIndicatorAccessible value={75} max={100} />);
      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuenow', '75');
      expect(progressbar).toHaveAttribute('aria-valuemin', '0');
      expect(progressbar).toHaveAttribute('aria-valuemax', '100');
    });

    it('should render custom label', () => {
      render(<ProgressIndicatorAccessible value={50} label="Upload progress" />);
      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-label', 'Upload progress');
    });

    it('should hide percentage when showPercentage is false', () => {
      render(<ProgressIndicatorAccessible value={50} showPercentage={false} />);
      expect(screen.queryByText('50%')).not.toBeInTheDocument();
    });

    it('should calculate percentage correctly', () => {
      render(<ProgressIndicatorAccessible value={25} max={50} />);
      expect(screen.getByText('50%')).toBeInTheDocument();
    });
  });

  describe('KeyboardShortcut', () => {
    it('should render keyboard shortcut with single key', () => {
      render(<KeyboardShortcut keys={['Ctrl']} />);
      expect(screen.getByText('Ctrl')).toBeInTheDocument();
    });

    it('should render keyboard shortcut with multiple keys', () => {
      render(<KeyboardShortcut keys={['Ctrl', 'K']} />);
      expect(screen.getByText('Ctrl')).toBeInTheDocument();
      expect(screen.getByText('K')).toBeInTheDocument();
    });

    it('should have proper ARIA label', () => {
      const { container } = render(<KeyboardShortcut keys={['Ctrl', 'K']} description="Open command palette" />);
      const shortcut = container.querySelector('.keyboard-shortcut');
      expect(shortcut).toHaveAttribute('aria-label', 'Open command palette');
    });
  });

  describe('FileTypeIndicator', () => {
    it('should render image file type', () => {
      render(<FileTypeIndicator type="image/png" />);
      expect(screen.getByText('Image')).toBeInTheDocument();
    });

    it('should render PDF file type', () => {
      render(<FileTypeIndicator type="application/pdf" />);
      expect(screen.getByText('PDF')).toBeInTheDocument();
    });

    it('should render text file type', () => {
      render(<FileTypeIndicator type="text/plain" />);
      expect(screen.getByText('Text')).toBeInTheDocument();
    });

    it('should render generic file type for unknown types', () => {
      render(<FileTypeIndicator type="application/octet-stream" />);
      expect(screen.getByText('File')).toBeInTheDocument();
    });

    it('should include file name in ARIA label', () => {
      const { container } = render(<FileTypeIndicator type="image/png" name="photo.png" />);
      const indicator = container.querySelector('.file-type-indicator');
      expect(indicator).toHaveAttribute('aria-label', 'Image: photo.png');
    });
  });

  describe('StreamingIndicator', () => {
    it('should render streaming indicator', () => {
      render(<StreamingIndicator />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Streaming...')).toBeInTheDocument();
    });

    it('should render custom label', () => {
      render(<StreamingIndicator label="Generating response" />);
      expect(screen.getByText('Generating response')).toBeInTheDocument();
    });

    it('should have ARIA live region', () => {
      render(<StreamingIndicator />);
      const indicator = screen.getByRole('status');
      expect(indicator).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('MessageTypeIndicator', () => {
    it('should render user message type', () => {
      render(<MessageTypeIndicator type="user" />);
      expect(screen.getByText('User message')).toBeInTheDocument();
    });

    it('should render assistant message type', () => {
      render(<MessageTypeIndicator type="assistant" />);
      expect(screen.getByText('Assistant message')).toBeInTheDocument();
    });

    it('should render system message type', () => {
      render(<MessageTypeIndicator type="system" />);
      expect(screen.getByText('System message')).toBeInTheDocument();
    });

    it('should be screen reader only', () => {
      const { container } = render(<MessageTypeIndicator type="user" />);
      const indicator = container.querySelector('.sr-only');
      expect(indicator).toBeInTheDocument();
    });
  });

  describe('LoadingAnnouncement', () => {
    it('should render loading announcement', () => {
      render(<LoadingAnnouncement message="Loading conversations" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Loading conversations')).toBeInTheDocument();
    });

    it('should have ARIA live region', () => {
      render(<LoadingAnnouncement message="Loading" />);
      const announcement = screen.getByRole('status');
      expect(announcement).toHaveAttribute('aria-live', 'polite');
      expect(announcement).toHaveAttribute('aria-atomic', 'true');
    });

    it('should be screen reader only', () => {
      const { container } = render(<LoadingAnnouncement message="Loading" />);
      const announcement = container.querySelector('.sr-only');
      expect(announcement).toBeInTheDocument();
    });
  });

  describe('ErrorMessage', () => {
    it('should render error message', () => {
      render(<ErrorMessage message="An error occurred" />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('An error occurred')).toBeInTheDocument();
    });

    it('should have ARIA live region with assertive politeness', () => {
      render(<ErrorMessage message="Error" />);
      const error = screen.getByRole('alert');
      expect(error).toHaveAttribute('aria-live', 'assertive');
    });

    it('should include error icon', () => {
      const { container } = render(<ErrorMessage message="Error" />);
      const icon = container.querySelector('[aria-hidden="true"]');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('SuccessMessage', () => {
    it('should render success message', () => {
      render(<SuccessMessage message="Operation successful" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Operation successful')).toBeInTheDocument();
    });

    it('should have ARIA live region with polite politeness', () => {
      render(<SuccessMessage message="Success" />);
      const success = screen.getByRole('status');
      expect(success).toHaveAttribute('aria-live', 'polite');
    });

    it('should include success icon', () => {
      const { container } = render(<SuccessMessage message="Success" />);
      const icon = container.querySelector('[aria-hidden="true"]');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Non-color information indicators (Requirement 10.8)', () => {
    it('should provide icons alongside color for status', () => {
      const { container } = render(<StatusIndicator status="success" />);
      const icon = container.querySelector('[aria-hidden="true"]');
      expect(icon).toBeInTheDocument();
      expect(icon?.textContent).toBe('✓');
    });

    it('should provide text labels for status states', () => {
      render(<StatusIndicator status="success" />);
      expect(screen.getByText('Success')).toBeInTheDocument();
    });

    it('should ensure information is accessible without color perception', () => {
      render(<StatusIndicator status="error" label="Upload failed" />);
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-label', 'Upload failed');
      expect(screen.getByText('Upload failed')).toBeInTheDocument();
    });
  });

  describe('Keyboard navigation (Requirements 10.1, 10.6)', () => {
    it('should provide visible focus indicators', () => {
      render(<SkipToMain />);
      const link = screen.getByText('Skip to main content');
      expect(link).toHaveStyle({ position: 'absolute' });
    });

    it('should support keyboard shortcuts', () => {
      render(<KeyboardShortcut keys={['Cmd', 'K']} />);
      expect(screen.getByText('Cmd')).toBeInTheDocument();
      expect(screen.getByText('K')).toBeInTheDocument();
    });
  });

  describe('Screen reader support (Requirements 10.2, 10.3, 10.4)', () => {
    it('should provide appropriate ARIA labels', () => {
      render(<StatusIndicator status="success" label="File uploaded" />);
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-label', 'File uploaded');
    });

    it('should provide ARIA live regions for streaming updates', () => {
      render(<StreamingIndicator />);
      const indicator = screen.getByRole('status');
      expect(indicator).toHaveAttribute('aria-live', 'polite');
    });

    it('should provide ARIA live regions for status changes', () => {
      render(<ErrorMessage message="Error occurred" />);
      const error = screen.getByRole('alert');
      expect(error).toHaveAttribute('aria-live', 'assertive');
    });

    it('should announce loading states', () => {
      render(<LoadingAnnouncement message="Loading data" />);
      const announcement = screen.getByRole('status');
      expect(announcement).toHaveAttribute('aria-live', 'polite');
      expect(announcement).toHaveAttribute('aria-atomic', 'true');
    });
  });
});
