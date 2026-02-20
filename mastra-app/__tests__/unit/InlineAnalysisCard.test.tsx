/**
 * Unit tests for InlineAnalysisCard component
 * 
 * Task 7.1: Update AnalysisCard to be collapsed by default
 * Validates: Requirements 6.1, 6.2, 6.4, 6.5
 * - 6.1: Analysis results displayed as collapsible inline cards within the message
 * - 6.2: Shows brief summary when collapsed (e.g., "3 insights, 5 statistics")
 * - 6.4: Analysis card does NOT automatically expand or take over the screen
 * - 6.5: Styling consistent with conversational theme, not dashboard-style
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { InlineAnalysisCard, AnalysisData } from '@/components/InlineAnalysisCard';

describe('Task 7.1: InlineAnalysisCard Component', () => {
  const mockAnalysis: AnalysisData = {
    summary: 'Test summary of the analysis',
    insights: ['Insight 1', 'Insight 2', 'Insight 3'],
    statistics: {
      'Total': 100,
      'Average': 50,
      'Max': 200
    }
  };

  beforeEach(() => {
    // Mock CSS variables
    document.documentElement.style.setProperty('--border-color', '#e5e5e5');
    document.documentElement.style.setProperty('--bg-secondary', '#f7f7f5');
    document.documentElement.style.setProperty('--bg-primary', '#ffffff');
    document.documentElement.style.setProperty('--text-primary', '#0d0d0d');
    document.documentElement.style.setProperty('--text-secondary', '#666666');
    document.documentElement.style.setProperty('--text-muted', '#999999');
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Validates: Requirement 6.4 - Analysis card collapsed by default
   * Property 14: Analysis Card Collapsed Default
   */
  describe('Requirement 6.4: Collapsed by default behavior', () => {
    it('should be collapsed by default when defaultExpanded is not provided', () => {
      render(<InlineAnalysisCard analysis={mockAnalysis} />);
      
      const card = screen.getByTestId('inline-analysis-card');
      expect(card.getAttribute('data-expanded')).toBe('false');
      
      // Expanded content should not be visible
      expect(screen.queryByText('Key Insights')).toBeNull();
      expect(screen.queryByText('Insight 1')).toBeNull();
    });

    it('should be collapsed when defaultExpanded is explicitly false', () => {
      render(<InlineAnalysisCard analysis={mockAnalysis} defaultExpanded={false} />);
      
      const card = screen.getByTestId('inline-analysis-card');
      expect(card.getAttribute('data-expanded')).toBe('false');
      
      // Expanded content should not be visible
      expect(screen.queryByText('Key Insights')).toBeNull();
    });

    it('should be expanded when defaultExpanded is true', () => {
      render(<InlineAnalysisCard analysis={mockAnalysis} defaultExpanded={true} />);
      
      const card = screen.getByTestId('inline-analysis-card');
      expect(card.getAttribute('data-expanded')).toBe('true');
      
      // Expanded content should be visible
      expect(screen.getByText('Key Insights')).toBeDefined();
      expect(screen.getByText('Insight 1')).toBeDefined();
    });
  });

  /**
   * Validates: Requirement 6.2 - Brief summary when collapsed
   * Property 15: Analysis Card Summary
   */
  describe('Requirement 6.2: Collapsed summary display', () => {
    it('should show insight and statistic count when collapsed without summary', () => {
      const analysisWithoutSummary: AnalysisData = {
        insights: ['Insight 1', 'Insight 2'],
        statistics: { 'Stat1': 10, 'Stat2': 20, 'Stat3': 30 }
      };
      
      render(<InlineAnalysisCard analysis={analysisWithoutSummary} />);
      
      // Should show "2 insights, 3 statistics" format
      expect(screen.getByText(/2 insights, 3 statistics/)).toBeDefined();
    });

    it('should show truncated summary when collapsed with summary', () => {
      render(<InlineAnalysisCard analysis={mockAnalysis} />);
      
      // Should show the summary text (truncated if > 100 chars)
      expect(screen.getByText(/Test summary of the analysis/)).toBeDefined();
    });

    it('should handle singular insight/statistic correctly', () => {
      const singleAnalysis: AnalysisData = {
        insights: ['Single insight'],
        statistics: { 'OnlyStat': 42 }
      };
      
      render(<InlineAnalysisCard analysis={singleAnalysis} />);
      
      expect(screen.getByText(/1 insight, 1 statistic/)).toBeDefined();
    });

    it('should truncate long summaries with ellipsis', () => {
      const longSummaryAnalysis: AnalysisData = {
        summary: 'A'.repeat(150), // More than 100 characters
        insights: [],
        statistics: {}
      };
      
      render(<InlineAnalysisCard analysis={longSummaryAnalysis} />);
      
      // Should show truncated summary with ellipsis
      const previewText = screen.getByText(/\.\.\.$/);
      expect(previewText).toBeDefined();
    });

    it('should show "0 insights, 0 statistics" when both are empty', () => {
      const emptyAnalysis: AnalysisData = {
        insights: [],
        statistics: {}
      };
      
      render(<InlineAnalysisCard analysis={emptyAnalysis} />);
      
      expect(screen.getByText(/0 insights, 0 statistics/)).toBeDefined();
    });

    it('should handle undefined insights and statistics', () => {
      const undefinedAnalysis: AnalysisData = {};
      
      render(<InlineAnalysisCard analysis={undefinedAnalysis} />);
      
      // Should show "0 insights, 0 statistics" when undefined
      expect(screen.getByText(/0 insights, 0 statistics/)).toBeDefined();
    });

    it('should prefer summary over insight/statistic count when summary exists', () => {
      const analysisWithSummary: AnalysisData = {
        summary: 'Custom summary text',
        insights: ['Insight 1', 'Insight 2'],
        statistics: { 'Stat1': 10 }
      };
      
      render(<InlineAnalysisCard analysis={analysisWithSummary} />);
      
      // Should show summary, not the count
      expect(screen.getByText(/Custom summary text/)).toBeDefined();
      // Should NOT show the count format when summary exists
      expect(screen.queryByText(/2 insights, 1 statistic/)).toBeNull();
    });

    it('should show exactly 100 characters of summary without ellipsis', () => {
      const exactLengthAnalysis: AnalysisData = {
        summary: 'A'.repeat(100), // Exactly 100 characters
        insights: [],
        statistics: {}
      };
      
      render(<InlineAnalysisCard analysis={exactLengthAnalysis} />);
      
      // Should show full summary without ellipsis
      const previewText = screen.getByText(new RegExp('A'.repeat(100)));
      expect(previewText).toBeDefined();
      expect(previewText.textContent).not.toContain('...');
    });
  });

  /**
   * Validates: Requirement 6.1 - Collapsible inline cards
   */
  describe('Requirement 6.1: Expand/collapse toggle', () => {
    it('should expand when header is clicked', () => {
      render(<InlineAnalysisCard analysis={mockAnalysis} />);
      
      const header = screen.getByRole('button', { name: /expand analysis/i });
      fireEvent.click(header);
      
      const card = screen.getByTestId('inline-analysis-card');
      expect(card.getAttribute('data-expanded')).toBe('true');
      expect(screen.getByText('Key Insights')).toBeDefined();
    });

    it('should collapse when header is clicked again', () => {
      render(<InlineAnalysisCard analysis={mockAnalysis} />);
      
      const header = screen.getByRole('button', { name: /expand analysis/i });
      
      // Expand
      fireEvent.click(header);
      expect(screen.getByText('Key Insights')).toBeDefined();
      
      // Collapse
      fireEvent.click(header);
      expect(screen.queryByText('Key Insights')).toBeNull();
    });

    it('should update aria-expanded attribute when toggled', () => {
      render(<InlineAnalysisCard analysis={mockAnalysis} />);
      
      const header = screen.getByRole('button', { name: /expand analysis/i });
      expect(header.getAttribute('aria-expanded')).toBe('false');
      
      fireEvent.click(header);
      expect(header.getAttribute('aria-expanded')).toBe('true');
    });
  });

  /**
   * Validates: Requirement 6.5 - Consistent conversational styling
   */
  describe('Requirement 6.5: Content rendering when expanded', () => {
    it('should render summary when expanded', () => {
      render(<InlineAnalysisCard analysis={mockAnalysis} defaultExpanded={true} />);
      
      expect(screen.getByText('Test summary of the analysis')).toBeDefined();
    });

    it('should render all insights when expanded', () => {
      render(<InlineAnalysisCard analysis={mockAnalysis} defaultExpanded={true} />);
      
      expect(screen.getByText('Insight 1')).toBeDefined();
      expect(screen.getByText('Insight 2')).toBeDefined();
      expect(screen.getByText('Insight 3')).toBeDefined();
    });

    it('should render all statistics when expanded', () => {
      render(<InlineAnalysisCard analysis={mockAnalysis} defaultExpanded={true} />);
      
      // Statistics are now displayed in compact inline format: "Key: Value"
      // Use regex to match the combined text
      expect(screen.getByText(/Total:/)).toBeDefined();
      expect(screen.getByText('100')).toBeDefined();
      expect(screen.getByText(/Average:/)).toBeDefined();
      expect(screen.getByText('50')).toBeDefined();
    });

    it('should format numeric statistics with locale formatting', () => {
      const largeNumberAnalysis: AnalysisData = {
        statistics: { 'Count': 1000000 }
      };
      
      render(<InlineAnalysisCard analysis={largeNumberAnalysis} defaultExpanded={true} />);
      
      // Should show formatted number (1,000,000)
      expect(screen.getByText('1,000,000')).toBeDefined();
    });

    it('should handle empty analysis gracefully', () => {
      const emptyAnalysis: AnalysisData = {};
      
      render(<InlineAnalysisCard analysis={emptyAnalysis} defaultExpanded={true} />);
      
      // Should render without crashing
      expect(screen.getByTestId('inline-analysis-card')).toBeDefined();
    });

    it('should handle analysis with only insights', () => {
      const insightsOnlyAnalysis: AnalysisData = {
        insights: ['Only insight']
      };
      
      render(<InlineAnalysisCard analysis={insightsOnlyAnalysis} defaultExpanded={true} />);
      
      expect(screen.getByText('Only insight')).toBeDefined();
    });

    it('should handle analysis with only statistics', () => {
      const statsOnlyAnalysis: AnalysisData = {
        statistics: { 'OnlyStat': 42 }
      };
      
      render(<InlineAnalysisCard analysis={statsOnlyAnalysis} defaultExpanded={true} />);
      
      // Statistics are now displayed in compact inline format: "Key: Value"
      expect(screen.getByText(/OnlyStat:/)).toBeDefined();
      expect(screen.getByText('42')).toBeDefined();
    });
  });

  describe('Styling and structure', () => {
    it('should have rounded corners for conversational styling', () => {
      render(<InlineAnalysisCard analysis={mockAnalysis} />);
      
      const card = screen.getByTestId('inline-analysis-card');
      // Uses rounded-2xl to match chat bubble styling (conversational theme)
      expect(card.className).toContain('rounded-2xl');
    });

    it('should display Data Analysis title in header', () => {
      render(<InlineAnalysisCard analysis={mockAnalysis} />);
      
      expect(screen.getByText('Data Analysis')).toBeDefined();
    });

    it('should have chevron icon that rotates when expanded', () => {
      render(<InlineAnalysisCard analysis={mockAnalysis} />);
      
      const header = screen.getByRole('button', { name: /expand analysis/i });
      const chevron = header.querySelector('svg');
      
      expect(chevron).not.toBeNull();
      expect(chevron?.classList.contains('rotate-180')).toBe(false);
      
      fireEvent.click(header);
      expect(chevron?.classList.contains('rotate-180')).toBe(true);
    });

    /**
     * Validates: Requirement 6.5 - Styling consistent with conversational theme
     * Ensures the card uses CSS variables for theming, not hardcoded dashboard colors
     */
    it('should use CSS variables for theming (not dashboard-style hardcoded colors)', () => {
      render(<InlineAnalysisCard analysis={mockAnalysis} />);
      
      const card = screen.getByTestId('inline-analysis-card');
      const style = card.getAttribute('style');
      
      // Should use CSS variables for background and border
      expect(style).toContain('var(--bg-secondary)');
      expect(style).toContain('var(--border-color)');
    });

    /**
     * Validates: Requirement 6.5 - No dashboard-style gradient header
     * The header should use subtle theming, not bold gradients
     */
    it('should not use dashboard-style gradient in header', () => {
      render(<InlineAnalysisCard analysis={mockAnalysis} />);
      
      const header = screen.getByRole('button', { name: /expand analysis/i });
      const style = header.getAttribute('style');
      
      // Should NOT contain gradient styling (dashboard-style)
      expect(style).not.toContain('linear-gradient');
      // Should use CSS variables for theming
      expect(style).toContain('var(--bg-');
    });

    /**
     * Validates: Requirement 6.5 - Compact styling consistent with chat bubbles
     * Statistics should be displayed inline, not in a dashboard grid
     */
    it('should display statistics in compact inline format when expanded', () => {
      render(<InlineAnalysisCard analysis={mockAnalysis} defaultExpanded={true} />);
      
      // Statistics are now displayed in compact inline format: "Key: Value"
      // Find the statistics container by looking for the Statistics header
      const statsHeader = screen.getByText('Statistics');
      const statsContainer = statsHeader.nextElementSibling;
      
      // Should be in a flex container, not a grid
      expect(statsContainer?.className).toContain('flex');
      expect(statsContainer?.className).not.toContain('grid');
    });
  });
});
