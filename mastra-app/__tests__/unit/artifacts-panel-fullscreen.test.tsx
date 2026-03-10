/**
 * Unit tests for ArtifactsPanel fullscreen functionality
 * Validates: Requirement 5.4
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ArtifactsPanel } from '@/components/ArtifactsPanel';
import type { Artifact } from '@/types';

describe('ArtifactsPanel Fullscreen Mode', () => {
  const mockArtifact: Artifact = {
    id: 'test-artifact-1',
    type: 'chart',
    title: 'Test Chart',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    content: {
      type: 'chart',
      chartType: 'bar_chart',
      data: [
        { name: 'A', value: 10 },
        { name: 'B', value: 20 },
      ],
    },
    metadata: {},
  };

  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should display fullscreen button in panel header', () => {
    render(<ArtifactsPanel artifact={mockArtifact} onClose={mockOnClose} />);

    const fullscreenButton = screen.getByLabelText('Enter fullscreen');
    expect(fullscreenButton).toBeInTheDocument();
  });

  test('should expand panel to fullscreen when fullscreen button is clicked', () => {
    const { container } = render(
      <ArtifactsPanel artifact={mockArtifact} onClose={mockOnClose} />
    );

    const fullscreenButton = screen.getByLabelText('Enter fullscreen');
    fireEvent.click(fullscreenButton);

    // Check that panel has fullscreen classes
    const panel = container.querySelector('.fixed.inset-0.z-50');
    expect(panel).toBeInTheDocument();
  });

  test('should show exit fullscreen button when in fullscreen mode', () => {
    render(<ArtifactsPanel artifact={mockArtifact} onClose={mockOnClose} />);

    const fullscreenButton = screen.getByLabelText('Enter fullscreen');
    fireEvent.click(fullscreenButton);

    // Button label should change
    const exitButton = screen.getByLabelText(/Exit fullscreen/);
    expect(exitButton).toBeInTheDocument();
  });

  test('should exit fullscreen when exit button is clicked', () => {
    const { container } = render(
      <ArtifactsPanel artifact={mockArtifact} onClose={mockOnClose} />
    );

    // Enter fullscreen
    const fullscreenButton = screen.getByLabelText('Enter fullscreen');
    fireEvent.click(fullscreenButton);

    // Exit fullscreen
    const exitButton = screen.getByLabelText(/Exit fullscreen/);
    fireEvent.click(exitButton);

    // Panel should no longer have fullscreen classes
    const panel = container.querySelector('.fixed.inset-0.z-50');
    expect(panel).not.toBeInTheDocument();
  });

  test('should exit fullscreen when Escape key is pressed', async () => {
    const { container } = render(
      <ArtifactsPanel artifact={mockArtifact} onClose={mockOnClose} />
    );

    // Enter fullscreen
    const fullscreenButton = screen.getByLabelText('Enter fullscreen');
    fireEvent.click(fullscreenButton);

    // Verify fullscreen is active
    let panel = container.querySelector('.fixed.inset-0.z-50');
    expect(panel).toBeInTheDocument();

    // Press Escape key
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

    // Wait for state update
    await waitFor(() => {
      const enterButton = screen.getByLabelText('Enter fullscreen');
      expect(enterButton).toBeInTheDocument();
    });

    // Panel should no longer have fullscreen classes
    panel = container.querySelector('.fixed.inset-0.z-50');
    expect(panel).not.toBeInTheDocument();
  });

  test('should not exit fullscreen when Escape is pressed and not in fullscreen mode', () => {
    render(<ArtifactsPanel artifact={mockArtifact} onClose={mockOnClose} />);

    // Press Escape key without entering fullscreen
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

    // Should still show enter fullscreen button
    const fullscreenButton = screen.getByLabelText('Enter fullscreen');
    expect(fullscreenButton).toBeInTheDocument();
  });

  test('should hide resize handle when in fullscreen mode', () => {
    const { container } = render(
      <ArtifactsPanel artifact={mockArtifact} onClose={mockOnClose} />
    );

    // Resize handle should be visible initially
    let resizeHandle = container.querySelector('[role="separator"]');
    expect(resizeHandle).toBeInTheDocument();

    // Enter fullscreen
    const fullscreenButton = screen.getByLabelText('Enter fullscreen');
    fireEvent.click(fullscreenButton);

    // Resize handle should be hidden in fullscreen
    resizeHandle = container.querySelector('[role="separator"]');
    expect(resizeHandle).not.toBeInTheDocument();
  });

  test('should show resize handle when exiting fullscreen', () => {
    const { container } = render(
      <ArtifactsPanel artifact={mockArtifact} onClose={mockOnClose} />
    );

    // Enter fullscreen
    const fullscreenButton = screen.getByLabelText('Enter fullscreen');
    fireEvent.click(fullscreenButton);

    // Exit fullscreen
    const exitButton = screen.getByLabelText(/Exit fullscreen/);
    fireEvent.click(exitButton);

    // Resize handle should be visible again
    const resizeHandle = container.querySelector('[role="separator"]');
    expect(resizeHandle).toBeInTheDocument();
  });

  test('should have proper ARIA labels for accessibility', () => {
    render(<ArtifactsPanel artifact={mockArtifact} onClose={mockOnClose} />);

    // Check initial ARIA label
    const fullscreenButton = screen.getByLabelText('Enter fullscreen');
    expect(fullscreenButton).toHaveAttribute('aria-label', 'Enter fullscreen');

    // Enter fullscreen
    fireEvent.click(fullscreenButton);

    // Check updated ARIA label
    const exitButton = screen.getByLabelText(/Exit fullscreen/);
    expect(exitButton).toHaveAttribute('aria-label', 'Exit fullscreen (Esc)');
  });

  test('should have tooltip showing Escape key hint in fullscreen mode', () => {
    render(<ArtifactsPanel artifact={mockArtifact} onClose={mockOnClose} />);

    // Enter fullscreen
    const fullscreenButton = screen.getByLabelText('Enter fullscreen');
    fireEvent.click(fullscreenButton);

    // Check tooltip
    const exitButton = screen.getByLabelText(/Exit fullscreen/);
    expect(exitButton).toHaveAttribute('title', 'Exit fullscreen (Esc)');
  });

  test('should maintain panel functionality in fullscreen mode', () => {
    render(<ArtifactsPanel artifact={mockArtifact} onClose={mockOnClose} />);

    // Enter fullscreen
    const fullscreenButton = screen.getByLabelText('Enter fullscreen');
    fireEvent.click(fullscreenButton);

    // Close button should still work
    const closeButton = screen.getByLabelText('Close artifacts panel');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('should display different icons for enter and exit fullscreen', () => {
    const { container } = render(
      <ArtifactsPanel artifact={mockArtifact} onClose={mockOnClose} />
    );

    // Get initial button
    const fullscreenButton = screen.getByLabelText('Enter fullscreen');
    expect(fullscreenButton).toBeInTheDocument();

    // Enter fullscreen
    fireEvent.click(fullscreenButton);

    // Get exit button - should have different label
    const exitButton = screen.getByLabelText(/Exit fullscreen/);
    expect(exitButton).toBeInTheDocument();
    
    // Verify the button changed (different aria-label indicates different state)
    expect(exitButton).toHaveAttribute('aria-label', 'Exit fullscreen (Esc)');
  });
});
