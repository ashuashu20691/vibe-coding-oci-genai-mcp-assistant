/**
 * Unit tests for InlineVisualization component
 * Task 5.1: Update VisualizationCard to be collapsed by default
 * Validates: Requirements 4.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { InlineVisualization, VisualizationData } from '@/components/InlineVisualization';

describe('Task 5.1: InlineVisualization - Collapsed by Default', () => {
  const mockVisualization: VisualizationData = {
    type: 'bar_chart',
    title: 'Sales Data',
    html: '<html><body><h1>Chart Content</h1></body></html>',
  };

  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
  });

  describe('Collapsed State (Default)', () => {
    it('should be collapsed by default', () => {
      const { container } = render(
        <InlineVisualization visualization={mockVisualization} />
      );

      // Content should not be visible when collapsed
      expect(container.querySelector('[data-testid="inline-visualization-content"]')).toBeFalsy();
    });

    it('should show title when collapsed', () => {
      render(<InlineVisualization visualization={mockVisualization} />);

      expect(screen.getByText('Sales Data')).toBeTruthy();
    });

    it('should show "Click to expand" hint when collapsed', () => {
      const { container } = render(
        <InlineVisualization visualization={mockVisualization} />
      );

      const expandHint = container.querySelector('[data-testid="expand-hint"]');
      expect(expandHint).toBeTruthy();
      expect(expandHint?.textContent).toContain('Click to expand');
    });

    it('should show Interactive badge', () => {
      render(<InlineVisualization visualization={mockVisualization} />);

      expect(screen.getByText('Interactive')).toBeTruthy();
    });

    it('should have aria-expanded set to false when collapsed', () => {
      const { container } = render(
        <InlineVisualization visualization={mockVisualization} />
      );

      const header = container.querySelector('[data-testid="inline-visualization-header"]');
      expect(header?.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('Expand/Collapse Behavior', () => {
    it('should expand when header is clicked', () => {
      const { container } = render(
        <InlineVisualization visualization={mockVisualization} />
      );

      const header = container.querySelector('[data-testid="inline-visualization-header"]');
      expect(header).toBeTruthy();
      fireEvent.click(header!);

      // Content should now be visible
      expect(container.querySelector('[data-testid="inline-visualization-content"]')).toBeTruthy();
    });

    it('should collapse when header is clicked again', () => {
      const { container } = render(
        <InlineVisualization visualization={mockVisualization} />
      );

      const header = container.querySelector('[data-testid="inline-visualization-header"]');
      
      // Expand
      fireEvent.click(header!);
      expect(container.querySelector('[data-testid="inline-visualization-content"]')).toBeTruthy();
      
      // Collapse
      fireEvent.click(header!);
      expect(container.querySelector('[data-testid="inline-visualization-content"]')).toBeFalsy();
    });

    it('should hide "Click to expand" hint when expanded', () => {
      const { container } = render(
        <InlineVisualization visualization={mockVisualization} />
      );

      const header = container.querySelector('[data-testid="inline-visualization-header"]');
      fireEvent.click(header!);

      const expandHint = container.querySelector('[data-testid="expand-hint"]');
      expect(expandHint).toBeFalsy();
    });

    it('should update aria-expanded when toggled', () => {
      const { container } = render(
        <InlineVisualization visualization={mockVisualization} />
      );

      const header = container.querySelector('[data-testid="inline-visualization-header"]');
      
      // Initially collapsed
      expect(header?.getAttribute('aria-expanded')).toBe('false');
      
      // Expand
      fireEvent.click(header!);
      expect(header?.getAttribute('aria-expanded')).toBe('true');
      
      // Collapse
      fireEvent.click(header!);
      expect(header?.getAttribute('aria-expanded')).toBe('false');
    });

    it('should rotate chevron icon when expanded', () => {
      const { container } = render(
        <InlineVisualization visualization={mockVisualization} />
      );

      const chevron = container.querySelector('[data-testid="expand-chevron"]');
      expect(chevron?.classList.contains('rotate-180')).toBe(false);

      const header = container.querySelector('[data-testid="inline-visualization-header"]');
      fireEvent.click(header!);

      expect(chevron?.classList.contains('rotate-180')).toBe(true);
    });
  });

  describe('defaultExpanded Prop', () => {
    it('should be expanded when defaultExpanded is true', () => {
      const { container } = render(
        <InlineVisualization visualization={mockVisualization} defaultExpanded={true} />
      );

      expect(container.querySelector('[data-testid="inline-visualization-content"]')).toBeTruthy();
    });

    it('should be collapsed when defaultExpanded is false', () => {
      const { container } = render(
        <InlineVisualization visualization={mockVisualization} defaultExpanded={false} />
      );

      expect(container.querySelector('[data-testid="inline-visualization-content"]')).toBeFalsy();
    });
  });

  describe('Title Generation', () => {
    it('should use provided title', () => {
      render(<InlineVisualization visualization={mockVisualization} />);

      expect(screen.getByText('Sales Data')).toBeTruthy();
    });

    it('should generate title from type when no title provided', () => {
      const vizWithoutTitle: VisualizationData = {
        type: 'bar_chart',
        html: '<html><body>Content</body></html>',
      };

      render(<InlineVisualization visualization={vizWithoutTitle} />);

      expect(screen.getByText('Bar Chart')).toBeTruthy();
    });

    it('should handle underscores in type name', () => {
      const vizWithUnderscores: VisualizationData = {
        type: 'stacked_bar_chart',
        html: '<html><body>Content</body></html>',
      };

      render(<InlineVisualization visualization={vizWithUnderscores} />);

      expect(screen.getByText('Stacked Bar Chart')).toBeTruthy();
    });
  });

  describe('Fullscreen Mode', () => {
    it('should show fullscreen button', () => {
      const { container } = render(
        <InlineVisualization visualization={mockVisualization} />
      );

      expect(container.querySelector('[data-testid="fullscreen-btn"]')).toBeTruthy();
    });

    it('should open fullscreen overlay when fullscreen button is clicked', () => {
      const { container } = render(
        <InlineVisualization visualization={mockVisualization} />
      );

      const fullscreenBtn = container.querySelector('[data-testid="fullscreen-btn"]');
      fireEvent.click(fullscreenBtn!);

      expect(container.querySelector('[data-testid="fullscreen-overlay"]')).toBeTruthy();
    });

    it('should not toggle expand when fullscreen button is clicked', () => {
      const { container } = render(
        <InlineVisualization visualization={mockVisualization} />
      );

      // Initially collapsed
      expect(container.querySelector('[data-testid="inline-visualization-content"]')).toBeFalsy();

      const fullscreenBtn = container.querySelector('[data-testid="fullscreen-btn"]');
      fireEvent.click(fullscreenBtn!);

      // Should still be collapsed (fullscreen click shouldn't toggle expand)
      expect(container.querySelector('[data-testid="inline-visualization-content"]')).toBeFalsy();
    });

    it('should close fullscreen overlay when close button is clicked', () => {
      const { container } = render(
        <InlineVisualization visualization={mockVisualization} />
      );

      // Open fullscreen
      const fullscreenBtn = container.querySelector('[data-testid="fullscreen-btn"]');
      fireEvent.click(fullscreenBtn!);
      expect(container.querySelector('[data-testid="fullscreen-overlay"]')).toBeTruthy();

      // Close fullscreen
      const closeBtn = container.querySelector('[data-testid="fullscreen-close-btn"]');
      fireEvent.click(closeBtn!);
      expect(container.querySelector('[data-testid="fullscreen-overlay"]')).toBeFalsy();
    });

    it('should display title in fullscreen overlay', () => {
      render(<InlineVisualization visualization={mockVisualization} />);

      const fullscreenBtn = screen.getByTestId('fullscreen-btn');
      fireEvent.click(fullscreenBtn);

      // Title should appear in both the card and the fullscreen overlay
      const titles = screen.getAllByText('Sales Data');
      expect(titles.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Content Rendering', () => {
    it('should render iframe with visualization HTML when expanded', () => {
      const { container } = render(
        <InlineVisualization visualization={mockVisualization} defaultExpanded={true} />
      );

      const iframe = container.querySelector('iframe');
      expect(iframe).toBeTruthy();
      expect(iframe?.getAttribute('srcDoc')).toBe(mockVisualization.html);
    });

    it('should have max-height constraint on content', () => {
      const { container } = render(
        <InlineVisualization visualization={mockVisualization} defaultExpanded={true} />
      );

      const content = container.querySelector('[data-testid="inline-visualization-content"]');
      expect(content).toBeTruthy();
      expect(content?.getAttribute('style')).toContain('max-height');
    });

    it('should not render content when no HTML provided', () => {
      const vizWithoutHtml: VisualizationData = {
        type: 'bar_chart',
        title: 'Empty Chart',
      };

      const { container } = render(
        <InlineVisualization visualization={vizWithoutHtml} defaultExpanded={true} />
      );

      expect(container.querySelector('[data-testid="inline-visualization-content"]')).toBeFalsy();
    });
  });

  /**
   * Task 5.3: Size Constraints for Expanded Visualizations
   * Validates: Requirements 4.2, 4.5
   */
  describe('Task 5.3: Size Constraints', () => {
    it('should have max-height of 400px when expanded', () => {
      const { container } = render(
        <InlineVisualization visualization={mockVisualization} defaultExpanded={true} />
      );

      const content = container.querySelector('[data-testid="inline-visualization-content"]');
      expect(content).toBeTruthy();
      expect(content?.getAttribute('style')).toContain('max-height: 400px');
    });

    it('should have overflow auto for scrolling large content', () => {
      const { container } = render(
        <InlineVisualization visualization={mockVisualization} defaultExpanded={true} />
      );

      const content = container.querySelector('[data-testid="inline-visualization-content"]');
      expect(content).toBeTruthy();
      expect(content?.getAttribute('style')).toContain('overflow: auto');
    });

    it('should have iframe height of 400px', () => {
      const { container } = render(
        <InlineVisualization visualization={mockVisualization} defaultExpanded={true} />
      );

      const iframe = container.querySelector('[data-testid="inline-visualization-content"] iframe');
      expect(iframe).toBeTruthy();
      expect(iframe?.getAttribute('style')).toContain('height: 400px');
    });

    it('should have iframe min-height of 300px', () => {
      const { container } = render(
        <InlineVisualization visualization={mockVisualization} defaultExpanded={true} />
      );

      const iframe = container.querySelector('[data-testid="inline-visualization-content"] iframe');
      expect(iframe).toBeTruthy();
      expect(iframe?.getAttribute('style')).toContain('min-height: 300px');
    });

    it('should provide fullscreen option for detailed viewing without size constraints', () => {
      const { container } = render(
        <InlineVisualization visualization={mockVisualization} />
      );

      // Open fullscreen
      const fullscreenBtn = container.querySelector('[data-testid="fullscreen-btn"]');
      expect(fullscreenBtn).toBeTruthy();
      fireEvent.click(fullscreenBtn!);

      // Fullscreen overlay should be open
      const overlay = container.querySelector('[data-testid="fullscreen-overlay"]');
      expect(overlay).toBeTruthy();

      // Fullscreen content should use full height (h-full class)
      const fullscreenIframe = overlay?.querySelector('iframe');
      expect(fullscreenIframe).toBeTruthy();
      expect(fullscreenIframe?.classList.contains('h-full')).toBe(true);
    });

    it('should not have max-height constraint in fullscreen mode', () => {
      const { container } = render(
        <InlineVisualization visualization={mockVisualization} />
      );

      // Open fullscreen
      const fullscreenBtn = container.querySelector('[data-testid="fullscreen-btn"]');
      fireEvent.click(fullscreenBtn!);

      // Fullscreen iframe should not have max-height constraint
      const overlay = container.querySelector('[data-testid="fullscreen-overlay"]');
      const fullscreenIframe = overlay?.querySelector('iframe');
      expect(fullscreenIframe).toBeTruthy();
      // Fullscreen iframe uses h-full class, not inline max-height
      expect(fullscreenIframe?.getAttribute('style')).toBeFalsy();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible header with role button', () => {
      const { container } = render(
        <InlineVisualization visualization={mockVisualization} />
      );

      const header = container.querySelector('[data-testid="inline-visualization-header"]');
      expect(header?.getAttribute('role')).toBe('button');
    });

    it('should have descriptive aria-label', () => {
      const { container } = render(
        <InlineVisualization visualization={mockVisualization} />
      );

      const header = container.querySelector('[data-testid="inline-visualization-header"]');
      expect(header?.getAttribute('aria-label')).toContain('Sales Data');
      expect(header?.getAttribute('aria-label')).toContain('Click to expand');
    });

    it('should update aria-label when expanded', () => {
      const { container } = render(
        <InlineVisualization visualization={mockVisualization} />
      );

      const header = container.querySelector('[data-testid="inline-visualization-header"]');
      fireEvent.click(header!);

      expect(header?.getAttribute('aria-label')).toContain('Click to collapse');
    });

    it('should have accessible fullscreen button', () => {
      const { container } = render(
        <InlineVisualization visualization={mockVisualization} />
      );

      const fullscreenBtn = container.querySelector('[data-testid="fullscreen-btn"]');
      expect(fullscreenBtn?.getAttribute('aria-label')).toBe('View fullscreen');
      expect(fullscreenBtn?.getAttribute('title')).toBe('View fullscreen');
    });
  });
});
