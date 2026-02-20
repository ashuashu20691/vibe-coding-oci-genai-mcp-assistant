/**
 * Unit tests for AgentThinking component
 * 
 * Task 4.2: Implement compact collapsed state
 * Validates: Requirements 3.1, 3.6
 * - 3.1: Show tool name when collapsed
 * - 3.6: Show "Working... N tools" when collapsed with multiple tools
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { AgentThinking, ThinkingStep } from '@/components/AgentThinking';

describe('Task 4.2: AgentThinking Compact Collapsed State', () => {
  beforeEach(() => {
    // Mock CSS variables
    document.documentElement.style.setProperty('--bg-secondary', '#f5f5f5');
    document.documentElement.style.setProperty('--bg-tertiary', '#e5e5e5');
    document.documentElement.style.setProperty('--border-color', '#ddd');
    document.documentElement.style.setProperty('--text-primary', '#0d0d0d');
    document.documentElement.style.setProperty('--text-muted', '#999999');
    document.documentElement.style.setProperty('--text-secondary', '#666666');
    document.documentElement.style.setProperty('--accent', '#0066cc');
    document.documentElement.style.setProperty('--success', '#10a37f');
    document.documentElement.style.setProperty('--error', '#ef4444');
    document.documentElement.style.setProperty('--shadow-sm', '0 1px 2px rgba(0,0,0,0.05)');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const createToolCallStep = (
    id: string,
    toolName: string,
    status: ThinkingStep['status'] = 'running'
  ): ThinkingStep => ({
    id,
    type: 'tool_call',
    content: `Calling ${toolName}`,
    toolName,
    toolArgs: { arg1: 'value1' },
    timestamp: new Date(),
    status,
  });

  const createThinkingStep = (
    id: string,
    content: string,
    status: ThinkingStep['status'] = 'complete'
  ): ThinkingStep => ({
    id,
    type: 'thinking',
    content,
    timestamp: new Date(),
    status,
  });

  describe('Requirement 3.1: Show tool name when collapsed', () => {
    it('should show tool name in collapsed summary when a single tool is running', () => {
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'sqlcl_list_connections', 'running'),
      ];

      render(<AgentThinking steps={steps} isActive={true} defaultExpanded={false} />);

      const summary = screen.getByTestId('thinking-summary');
      expect(summary.textContent).toContain('Working...');
      expect(summary.textContent).toContain('List Connections');
    });

    it('should format tool name by removing prefix and capitalizing', () => {
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'sqlcl_execute_query', 'running'),
      ];

      render(<AgentThinking steps={steps} isActive={true} defaultExpanded={false} />);

      const summary = screen.getByTestId('thinking-summary');
      expect(summary.textContent).toContain('Execute Query');
    });

    it('should show tool name with underscores converted to spaces', () => {
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'get_user_data', 'running'),
      ];

      render(<AgentThinking steps={steps} isActive={true} defaultExpanded={false} />);

      const summary = screen.getByTestId('thinking-summary');
      expect(summary.textContent).toContain('Get User Data');
    });
  });

  describe('Requirement 3.6: Show "Working... N tools" when collapsed', () => {
    it('should show tool name when a tool is currently running', () => {
      // When a tool is running, it shows the tool name instead of count
      const steps: ThinkingStep[] = [
        createThinkingStep('1', 'Analyzing request', 'complete'),
        createToolCallStep('2', 'some_tool', 'running'),
      ];

      render(<AgentThinking steps={steps} isActive={true} defaultExpanded={false} />);

      const summary = screen.getByTestId('thinking-summary');
      expect(summary.textContent).toContain('Working...');
      expect(summary.textContent).toContain('Some Tool');
    });

    it('should show "Working... N tools" when active but no tool is currently running', () => {
      // When isActive but no tool is running, show the count
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'tool_one', 'complete'),
        createToolCallStep('2', 'tool_two', 'complete'),
      ];

      render(<AgentThinking steps={steps} isActive={true} defaultExpanded={false} />);

      const summary = screen.getByTestId('thinking-summary');
      expect(summary.textContent).toContain('Working...');
      expect(summary.textContent).toContain('2 tools');
    });

    it('should show "Working... N tools" with correct pluralization', () => {
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'tool_one', 'complete'),
        createToolCallStep('2', 'tool_two', 'complete'),
        createToolCallStep('3', 'tool_three', 'complete'),
      ];

      render(<AgentThinking steps={steps} isActive={true} defaultExpanded={false} />);

      const summary = screen.getByTestId('thinking-summary');
      expect(summary.textContent).toContain('3 tools');
    });

    it('should show singular "tool" for exactly one tool when no tool is running', () => {
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'single_tool', 'complete'),
      ];

      render(<AgentThinking steps={steps} isActive={true} defaultExpanded={false} />);

      const summary = screen.getByTestId('thinking-summary');
      expect(summary.textContent).toContain('1 tool');
      expect(summary.textContent).not.toContain('1 tools');
    });
  });

  describe('Expand/Collapse Toggle Button', () => {
    // Helper to get the main toggle button (the one with aria-controls)
    const getMainToggleButton = (container: HTMLElement) => {
      return container.querySelector('button[aria-controls="thinking-panel-content"]') as HTMLButtonElement;
    };

    it('should have an expand/collapse toggle button', () => {
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'test_tool', 'running'),
      ];

      const { container } = render(<AgentThinking steps={steps} isActive={true} defaultExpanded={false} />);

      const toggleButton = getMainToggleButton(container);
      expect(toggleButton).not.toBeNull();
      expect(toggleButton.getAttribute('aria-expanded')).toBe('false');
    });

    it('should have aria-expanded attribute set correctly when collapsed', () => {
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'test_tool', 'running'),
      ];

      const { container } = render(<AgentThinking steps={steps} isActive={true} defaultExpanded={false} />);

      const toggleButton = getMainToggleButton(container);
      expect(toggleButton.getAttribute('aria-expanded')).toBe('false');
    });

    it('should have aria-expanded attribute set correctly when expanded', () => {
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'test_tool', 'running'),
      ];

      const { container } = render(<AgentThinking steps={steps} isActive={true} defaultExpanded={true} />);

      const toggleButton = getMainToggleButton(container);
      expect(toggleButton.getAttribute('aria-expanded')).toBe('true');
    });

    it('should toggle expanded state when clicked', () => {
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'test_tool', 'running'),
      ];

      const { container } = render(<AgentThinking steps={steps} isActive={true} defaultExpanded={false} />);

      const toggleButton = getMainToggleButton(container);
      expect(toggleButton.getAttribute('aria-expanded')).toBe('false');

      fireEvent.click(toggleButton);
      expect(toggleButton.getAttribute('aria-expanded')).toBe('true');

      fireEvent.click(toggleButton);
      expect(toggleButton.getAttribute('aria-expanded')).toBe('false');
    });

    it('should call onToggle callback when toggled', () => {
      const onToggle = vi.fn();
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'test_tool', 'running'),
      ];

      const { container } = render(
        <AgentThinking 
          steps={steps} 
          isActive={true} 
          defaultExpanded={false} 
          onToggle={onToggle}
        />
      );

      const toggleButton = getMainToggleButton(container);
      fireEvent.click(toggleButton);

      expect(onToggle).toHaveBeenCalledWith(true);
    });

    it('should have a chevron icon that rotates when expanded', () => {
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'test_tool', 'running'),
      ];

      const { container } = render(
        <AgentThinking steps={steps} isActive={true} defaultExpanded={false} />
      );

      // Get the main toggle button's chevron (the one inside the button with aria-controls)
      const mainButton = getMainToggleButton(container);
      const svg = mainButton?.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg?.style.transform).toContain('rotate(0deg)');

      fireEvent.click(mainButton!);

      expect(svg?.style.transform).toContain('rotate(180deg)');
    });
  });

  describe('Collapsed State Display', () => {
    it('should be collapsed by default', () => {
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'test_tool', 'running'),
      ];

      const { container } = render(<AgentThinking steps={steps} isActive={true} />);

      const toggleButton = container.querySelector('button[aria-controls="thinking-panel-content"]');
      expect(toggleButton?.getAttribute('aria-expanded')).toBe('false');
    });

    it('should show compact summary when collapsed', () => {
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'test_tool', 'running'),
      ];

      render(<AgentThinking steps={steps} isActive={true} defaultExpanded={false} />);

      const summary = screen.getByTestId('thinking-summary');
      expect(summary.textContent).toContain('Working...');
    });

    it('should hide detailed steps when collapsed', () => {
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'test_tool', 'running'),
      ];

      const { container } = render(
        <AgentThinking steps={steps} isActive={true} defaultExpanded={false} />
      );

      const contentPanel = container.querySelector('#thinking-panel-content') as HTMLElement;
      expect(contentPanel).not.toBeNull();
      expect(contentPanel?.style.maxHeight).toBe('0px');
      expect(contentPanel?.style.opacity).toBe('0');
    });

    it('should show detailed steps when expanded', () => {
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'test_tool', 'running'),
      ];

      const { container } = render(
        <AgentThinking steps={steps} isActive={true} defaultExpanded={true} />
      );

      const contentPanel = container.querySelector('#thinking-panel-content') as HTMLElement;
      expect(contentPanel).not.toBeNull();
      expect(contentPanel?.style.opacity).toBe('1');
    });
  });

  describe('Status Indicators', () => {
    it('should show animated pulse indicator when active', () => {
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'test_tool', 'running'),
      ];

      const { container } = render(
        <AgentThinking steps={steps} isActive={true} defaultExpanded={false} />
      );

      const pulseIndicator = container.querySelector('.animate-pulse');
      expect(pulseIndicator).not.toBeNull();
    });

    it('should show success indicator when completed without errors', () => {
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'test_tool', 'complete'),
      ];

      const { container } = render(
        <AgentThinking steps={steps} isActive={false} defaultExpanded={false} />
      );

      // Should have a green success indicator
      const indicator = container.querySelector('[style*="--success"]');
      expect(indicator).not.toBeNull();
    });

    it('should show error indicator when there are errors', () => {
      const steps: ThinkingStep[] = [
        { ...createToolCallStep('1', 'test_tool', 'error') },
      ];

      const { container } = render(
        <AgentThinking steps={steps} isActive={false} defaultExpanded={false} />
      );

      // Should have a red error indicator
      const indicator = container.querySelector('[style*="--error"]');
      expect(indicator).not.toBeNull();
    });

    it('should show bouncing dots animation when running', () => {
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'test_tool', 'running'),
      ];

      const { container } = render(
        <AgentThinking steps={steps} isActive={true} defaultExpanded={false} />
      );

      // Should have bouncing dots
      const dots = container.querySelectorAll('[style*="animation: bounce"]');
      expect(dots.length).toBe(3);
    });
  });

  describe('Completed State Summary', () => {
    it('should show completion summary when not active', () => {
      const steps: ThinkingStep[] = [
        createThinkingStep('1', 'Analyzing', 'complete'),
        createToolCallStep('2', 'tool_one', 'complete'),
        createToolCallStep('3', 'tool_two', 'complete'),
      ];

      render(<AgentThinking steps={steps} isActive={false} defaultExpanded={false} />);

      const summary = screen.getByTestId('thinking-summary');
      expect(summary.textContent).toContain('completed');
      expect(summary.textContent).toContain('2 tools');
    });

    it('should show error summary when completed with errors', () => {
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'failing_tool', 'error'),
      ];

      render(<AgentThinking steps={steps} isActive={false} defaultExpanded={false} />);

      const summary = screen.getByTestId('thinking-summary');
      expect(summary.textContent).toContain('error');
    });
  });

  describe('Edge Cases', () => {
    it('should return null when steps array is empty', () => {
      const { container } = render(
        <AgentThinking steps={[]} isActive={false} defaultExpanded={false} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should handle steps without tool names', () => {
      const steps: ThinkingStep[] = [
        createThinkingStep('1', 'Processing...', 'running'),
      ];

      render(<AgentThinking steps={steps} isActive={true} defaultExpanded={false} />);

      const summary = screen.getByTestId('thinking-summary');
      expect(summary.textContent).toContain('Working...');
    });

    it('should handle mixed step types', () => {
      const steps: ThinkingStep[] = [
        createThinkingStep('1', 'Analyzing', 'complete'),
        createToolCallStep('2', 'tool_one', 'complete'),
        {
          id: '3',
          type: 'progress',
          content: 'Making progress',
          timestamp: new Date(),
          status: 'complete',
        },
        createToolCallStep('4', 'tool_two', 'running'),
      ];

      render(<AgentThinking steps={steps} isActive={true} defaultExpanded={false} />);

      const summary = screen.getByTestId('thinking-summary');
      expect(summary.textContent).toContain('Working...');
    });
  });
});


describe('Task 4.4: Prevent auto-expand on tool completion', () => {
  /**
   * Validates: Requirement 3.4
   * WHEN tool execution completes, THE Thinking_Panel SHALL update the status without expanding automatically
   * 
   * Property 5: Thinking Panel Collapsed Default
   * For any tool execution, the thinking panel SHALL start in collapsed state 
   * and SHALL NOT auto-expand on tool completion.
   */
  beforeEach(() => {
    // Mock CSS variables
    document.documentElement.style.setProperty('--bg-secondary', '#f5f5f5');
    document.documentElement.style.setProperty('--bg-tertiary', '#e5e5e5');
    document.documentElement.style.setProperty('--border-color', '#ddd');
    document.documentElement.style.setProperty('--text-primary', '#0d0d0d');
    document.documentElement.style.setProperty('--text-muted', '#999999');
    document.documentElement.style.setProperty('--text-secondary', '#666666');
    document.documentElement.style.setProperty('--accent', '#0066cc');
    document.documentElement.style.setProperty('--success', '#10a37f');
    document.documentElement.style.setProperty('--error', '#ef4444');
    document.documentElement.style.setProperty('--shadow-sm', '0 1px 2px rgba(0,0,0,0.05)');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const createToolCallStep = (
    id: string,
    toolName: string,
    status: ThinkingStep['status'] = 'running'
  ): ThinkingStep => ({
    id,
    type: 'tool_call',
    content: `Calling ${toolName}`,
    toolName,
    toolArgs: { arg1: 'value1' },
    timestamp: new Date(),
    status,
  });

  const createToolResultStep = (
    id: string,
    status: ThinkingStep['status'] = 'complete'
  ): ThinkingStep => ({
    id,
    type: 'tool_result',
    content: 'Tool completed',
    toolResult: { success: true },
    timestamp: new Date(),
    status,
  });

  // Helper to get the main toggle button
  const getMainToggleButton = (container: HTMLElement) => {
    return container.querySelector('button[aria-controls="thinking-panel-content"]') as HTMLButtonElement;
  };

  describe('Requirement 3.4: Panel stays collapsed when tools complete', () => {
    it('should remain collapsed when tool transitions from running to complete', () => {
      const runningSteps: ThinkingStep[] = [
        createToolCallStep('1', 'test_tool', 'running'),
      ];

      const { container, rerender } = render(
        <AgentThinking steps={runningSteps} isActive={true} defaultExpanded={false} />
      );

      // Verify initially collapsed
      const toggleButton = getMainToggleButton(container);
      expect(toggleButton.getAttribute('aria-expanded')).toBe('false');

      // Simulate tool completion - update steps and isActive
      const completedSteps: ThinkingStep[] = [
        createToolCallStep('1', 'test_tool', 'complete'),
        createToolResultStep('2', 'complete'),
      ];

      rerender(
        <AgentThinking steps={completedSteps} isActive={false} defaultExpanded={false} />
      );

      // Should still be collapsed after completion
      expect(toggleButton.getAttribute('aria-expanded')).toBe('false');
    });

    it('should remain collapsed when isActive changes from true to false', () => {
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'test_tool', 'complete'),
      ];

      const { container, rerender } = render(
        <AgentThinking steps={steps} isActive={true} defaultExpanded={false} />
      );

      const toggleButton = getMainToggleButton(container);
      expect(toggleButton.getAttribute('aria-expanded')).toBe('false');

      // Simulate completion by setting isActive to false
      rerender(
        <AgentThinking steps={steps} isActive={false} defaultExpanded={false} />
      );

      // Should still be collapsed
      expect(toggleButton.getAttribute('aria-expanded')).toBe('false');
    });

    it('should remain collapsed when multiple tools complete in sequence', () => {
      // Start with first tool running
      const step1: ThinkingStep[] = [
        createToolCallStep('1', 'tool_one', 'running'),
      ];

      const { container, rerender } = render(
        <AgentThinking steps={step1} isActive={true} defaultExpanded={false} />
      );

      const toggleButton = getMainToggleButton(container);
      expect(toggleButton.getAttribute('aria-expanded')).toBe('false');

      // First tool completes, second starts
      const step2: ThinkingStep[] = [
        createToolCallStep('1', 'tool_one', 'complete'),
        createToolResultStep('2', 'complete'),
        createToolCallStep('3', 'tool_two', 'running'),
      ];

      rerender(
        <AgentThinking steps={step2} isActive={true} defaultExpanded={false} />
      );

      expect(toggleButton.getAttribute('aria-expanded')).toBe('false');

      // All tools complete
      const step3: ThinkingStep[] = [
        createToolCallStep('1', 'tool_one', 'complete'),
        createToolResultStep('2', 'complete'),
        createToolCallStep('3', 'tool_two', 'complete'),
        createToolResultStep('4', 'complete'),
      ];

      rerender(
        <AgentThinking steps={step3} isActive={false} defaultExpanded={false} />
      );

      // Should still be collapsed after all tools complete
      expect(toggleButton.getAttribute('aria-expanded')).toBe('false');
    });

    it('should remain collapsed when tool completes with error', () => {
      const runningSteps: ThinkingStep[] = [
        createToolCallStep('1', 'failing_tool', 'running'),
      ];

      const { container, rerender } = render(
        <AgentThinking steps={runningSteps} isActive={true} defaultExpanded={false} />
      );

      const toggleButton = getMainToggleButton(container);
      expect(toggleButton.getAttribute('aria-expanded')).toBe('false');

      // Tool fails
      const errorSteps: ThinkingStep[] = [
        createToolCallStep('1', 'failing_tool', 'error'),
      ];

      rerender(
        <AgentThinking steps={errorSteps} isActive={false} defaultExpanded={false} />
      );

      // Should still be collapsed even on error
      expect(toggleButton.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('Only expand on user click', () => {
    it('should only expand when user explicitly clicks the toggle button', () => {
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'test_tool', 'complete'),
      ];

      const { container } = render(
        <AgentThinking steps={steps} isActive={false} defaultExpanded={false} />
      );

      const toggleButton = getMainToggleButton(container);
      
      // Initially collapsed
      expect(toggleButton.getAttribute('aria-expanded')).toBe('false');

      // User clicks to expand
      fireEvent.click(toggleButton);
      expect(toggleButton.getAttribute('aria-expanded')).toBe('true');
    });

    it('should stay expanded after user expands even when new tools complete', () => {
      const initialSteps: ThinkingStep[] = [
        createToolCallStep('1', 'tool_one', 'running'),
      ];

      const { container, rerender } = render(
        <AgentThinking steps={initialSteps} isActive={true} defaultExpanded={false} />
      );

      const toggleButton = getMainToggleButton(container);
      
      // User expands the panel
      fireEvent.click(toggleButton);
      expect(toggleButton.getAttribute('aria-expanded')).toBe('true');

      // Tool completes
      const completedSteps: ThinkingStep[] = [
        createToolCallStep('1', 'tool_one', 'complete'),
        createToolResultStep('2', 'complete'),
      ];

      rerender(
        <AgentThinking steps={completedSteps} isActive={false} defaultExpanded={false} />
      );

      // Should remain expanded because user expanded it
      expect(toggleButton.getAttribute('aria-expanded')).toBe('true');
    });

    it('should call onToggle callback only on user interaction, not on completion', () => {
      const onToggle = vi.fn();
      const runningSteps: ThinkingStep[] = [
        createToolCallStep('1', 'test_tool', 'running'),
      ];

      const { container, rerender } = render(
        <AgentThinking 
          steps={runningSteps} 
          isActive={true} 
          defaultExpanded={false}
          onToggle={onToggle}
        />
      );

      // onToggle should not be called on initial render
      expect(onToggle).not.toHaveBeenCalled();

      // Tool completes
      const completedSteps: ThinkingStep[] = [
        createToolCallStep('1', 'test_tool', 'complete'),
      ];

      rerender(
        <AgentThinking 
          steps={completedSteps} 
          isActive={false} 
          defaultExpanded={false}
          onToggle={onToggle}
        />
      );

      // onToggle should still not be called - no auto-expand on completion
      expect(onToggle).not.toHaveBeenCalled();

      // User clicks to expand
      const toggleButton = getMainToggleButton(container);
      fireEvent.click(toggleButton);

      // Now onToggle should be called
      expect(onToggle).toHaveBeenCalledWith(true);
      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('Content panel visibility on completion', () => {
    it('should keep content panel hidden (max-height: 0) when tools complete', () => {
      const runningSteps: ThinkingStep[] = [
        createToolCallStep('1', 'test_tool', 'running'),
      ];

      const { container, rerender } = render(
        <AgentThinking steps={runningSteps} isActive={true} defaultExpanded={false} />
      );

      const contentPanel = container.querySelector('#thinking-panel-content') as HTMLElement;
      expect(contentPanel.style.maxHeight).toBe('0px');
      expect(contentPanel.style.opacity).toBe('0');

      // Tool completes
      const completedSteps: ThinkingStep[] = [
        createToolCallStep('1', 'test_tool', 'complete'),
      ];

      rerender(
        <AgentThinking steps={completedSteps} isActive={false} defaultExpanded={false} />
      );

      // Content should still be hidden
      expect(contentPanel.style.maxHeight).toBe('0px');
      expect(contentPanel.style.opacity).toBe('0');
    });

    it('should update summary text when tools complete without expanding', () => {
      const runningSteps: ThinkingStep[] = [
        createToolCallStep('1', 'test_tool', 'running'),
      ];

      const { rerender } = render(
        <AgentThinking steps={runningSteps} isActive={true} defaultExpanded={false} />
      );

      let summary = screen.getByTestId('thinking-summary');
      expect(summary.textContent).toContain('Working...');

      // Tool completes
      const completedSteps: ThinkingStep[] = [
        createToolCallStep('1', 'test_tool', 'complete'),
      ];

      rerender(
        <AgentThinking steps={completedSteps} isActive={false} defaultExpanded={false} />
      );

      // Summary should update to show completion
      summary = screen.getByTestId('thinking-summary');
      expect(summary.textContent).toContain('completed');
      expect(summary.textContent).toContain('1 tool');
    });
  });
});


describe('Task 4.3: Max-height constraint for thinking panel', () => {
  beforeEach(() => {
    // Mock CSS variables
    document.documentElement.style.setProperty('--bg-secondary', '#f5f5f5');
    document.documentElement.style.setProperty('--bg-tertiary', '#e5e5e5');
    document.documentElement.style.setProperty('--border-color', '#ddd');
    document.documentElement.style.setProperty('--text-primary', '#0d0d0d');
    document.documentElement.style.setProperty('--text-muted', '#999999');
    document.documentElement.style.setProperty('--text-secondary', '#666666');
    document.documentElement.style.setProperty('--accent', '#0066cc');
    document.documentElement.style.setProperty('--success', '#10a37f');
    document.documentElement.style.setProperty('--error', '#ef4444');
    document.documentElement.style.setProperty('--shadow-sm', '0 1px 2px rgba(0,0,0,0.05)');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const createToolCallStep = (
    id: string,
    toolName: string,
    status: ThinkingStep['status'] = 'running'
  ): ThinkingStep => ({
    id,
    type: 'tool_call',
    content: `Calling ${toolName}`,
    toolName,
    toolArgs: { arg1: 'value1' },
    timestamp: new Date(),
    status,
  });

  describe('Requirement 3.5: Max-height constraint to prevent dominating screen', () => {
    /**
     * Validates: Requirement 3.5, Property 7
     * The thinking panel SHALL have a maximum height constraint that prevents it from dominating the screen
     */
    it('should have a fixed max-height when expanded', () => {
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'tool_one', 'complete'),
        createToolCallStep('2', 'tool_two', 'complete'),
        createToolCallStep('3', 'tool_three', 'complete'),
      ];

      const { container } = render(
        <AgentThinking steps={steps} isActive={false} defaultExpanded={true} />
      );

      const contentPanel = container.querySelector('#thinking-panel-content') as HTMLElement;
      expect(contentPanel).not.toBeNull();
      // Should have a fixed max-height of 300px when expanded
      expect(contentPanel?.style.maxHeight).toBe('300px');
    });

    it('should have max-height of 0px when collapsed', () => {
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'tool_one', 'complete'),
      ];

      const { container } = render(
        <AgentThinking steps={steps} isActive={false} defaultExpanded={false} />
      );

      const contentPanel = container.querySelector('#thinking-panel-content') as HTMLElement;
      expect(contentPanel?.style.maxHeight).toBe('0px');
    });

    it('should have scrollable content area for many tools', () => {
      const steps: ThinkingStep[] = Array.from({ length: 10 }, (_, i) => 
        createToolCallStep(`${i + 1}`, `tool_${i + 1}`, 'complete')
      );

      const { container } = render(
        <AgentThinking steps={steps} isActive={false} defaultExpanded={true} />
      );

      const scrollableContent = container.querySelector('[data-testid="thinking-panel-scrollable-content"]') as HTMLElement;
      expect(scrollableContent).not.toBeNull();
      // Should have overflow-y-auto class for scrolling
      expect(scrollableContent?.classList.contains('overflow-y-auto')).toBe(true);
    });

    it('should maintain fixed max-height regardless of step count', () => {
      // Test with many steps - max-height should remain fixed at 300px
      const manySteps: ThinkingStep[] = Array.from({ length: 20 }, (_, i) => 
        createToolCallStep(`${i + 1}`, `tool_${i + 1}`, 'complete')
      );

      const { container } = render(
        <AgentThinking steps={manySteps} isActive={false} defaultExpanded={true} />
      );

      const contentPanel = container.querySelector('#thinking-panel-content') as HTMLElement;
      // Should still be 300px, not dynamically calculated based on step count
      expect(contentPanel?.style.maxHeight).toBe('300px');
    });

    it('should have inner scrollable container with appropriate max-height', () => {
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'tool_one', 'complete'),
      ];

      const { container } = render(
        <AgentThinking steps={steps} isActive={false} defaultExpanded={true} />
      );

      const scrollableContent = container.querySelector('[data-testid="thinking-panel-scrollable-content"]') as HTMLElement;
      expect(scrollableContent).not.toBeNull();
      // Inner container should have max-height slightly less than outer to account for padding
      expect(scrollableContent?.style.maxHeight).toBe('284px');
    });
  });
});


describe('Task 8.3: Compact tool execution indicator', () => {
  /**
   * Validates: Requirement 7.3
   * WHEN tools are executing, THE Chat_Interface SHALL show a compact "Working..." indicator in the Thinking_Panel
   * 
   * The indicator should be:
   * - Small and unobtrusive (collapsed by default)
   * - Show "Working..." during tool execution
   * - Display tool name or count in a compact format
   */
  beforeEach(() => {
    // Mock CSS variables
    document.documentElement.style.setProperty('--bg-secondary', '#f5f5f5');
    document.documentElement.style.setProperty('--bg-tertiary', '#e5e5e5');
    document.documentElement.style.setProperty('--border-color', '#ddd');
    document.documentElement.style.setProperty('--text-primary', '#0d0d0d');
    document.documentElement.style.setProperty('--text-muted', '#999999');
    document.documentElement.style.setProperty('--text-secondary', '#666666');
    document.documentElement.style.setProperty('--accent', '#0066cc');
    document.documentElement.style.setProperty('--success', '#10a37f');
    document.documentElement.style.setProperty('--error', '#ef4444');
    document.documentElement.style.setProperty('--shadow-sm', '0 1px 2px rgba(0,0,0,0.05)');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const createToolCallStep = (
    id: string,
    toolName: string,
    status: ThinkingStep['status'] = 'running'
  ): ThinkingStep => ({
    id,
    type: 'tool_call',
    content: `Calling ${toolName}`,
    toolName,
    toolArgs: { arg1: 'value1' },
    timestamp: new Date(),
    status,
  });

  describe('Requirement 7.3: Compact "Working..." indicator during tool execution', () => {
    it('should show "Working..." indicator when a tool is executing', () => {
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'sqlcl_execute_query', 'running'),
      ];

      render(<AgentThinking steps={steps} isActive={true} defaultExpanded={false} />);

      const summary = screen.getByTestId('thinking-summary');
      expect(summary.textContent).toContain('Working...');
    });

    it('should display tool name alongside "Working..." when tool is running', () => {
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'fetch_data', 'running'),
      ];

      render(<AgentThinking steps={steps} isActive={true} defaultExpanded={false} />);

      const summary = screen.getByTestId('thinking-summary');
      expect(summary.textContent).toContain('Working...');
      expect(summary.textContent).toContain('Fetch Data');
    });

    it('should be collapsed by default (small and unobtrusive)', () => {
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'test_tool', 'running'),
      ];

      const { container } = render(
        <AgentThinking steps={steps} isActive={true} defaultExpanded={false} />
      );

      // Verify collapsed state
      const toggleButton = container.querySelector('button[aria-controls="thinking-panel-content"]');
      expect(toggleButton?.getAttribute('aria-expanded')).toBe('false');

      // Verify content panel is hidden
      const contentPanel = container.querySelector('#thinking-panel-content') as HTMLElement;
      expect(contentPanel?.style.maxHeight).toBe('0px');
    });

    it('should show compact single-line summary when collapsed', () => {
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'process_request', 'running'),
      ];

      const { container } = render(
        <AgentThinking steps={steps} isActive={true} defaultExpanded={false} />
      );

      // The summary should be in a single line (truncate class)
      const summary = screen.getByTestId('thinking-summary');
      expect(summary.classList.contains('truncate')).toBe(true);
    });

    it('should show animated status indicator during tool execution', () => {
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'test_tool', 'running'),
      ];

      const { container } = render(
        <AgentThinking steps={steps} isActive={true} defaultExpanded={false} />
      );

      // Should have animated pulse indicator
      const pulseIndicator = container.querySelector('.animate-pulse');
      expect(pulseIndicator).not.toBeNull();

      // Should have bouncing dots animation
      const dots = container.querySelectorAll('[style*="animation: bounce"]');
      expect(dots.length).toBe(3);
    });

    it('should not dominate the screen when showing tool execution', () => {
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'tool_one', 'running'),
        createToolCallStep('2', 'tool_two', 'complete'),
        createToolCallStep('3', 'tool_three', 'complete'),
      ];

      const { container } = render(
        <AgentThinking steps={steps} isActive={true} defaultExpanded={false} />
      );

      // When collapsed, content should be hidden (max-height: 0)
      const contentPanel = container.querySelector('#thinking-panel-content') as HTMLElement;
      expect(contentPanel?.style.maxHeight).toBe('0px');

      // The component should have a reasonable size constraint
      const mainContainer = container.firstChild as HTMLElement;
      expect(mainContainer).not.toBeNull();
    });

    it('should show "Working..." with tool count when multiple tools are executing', () => {
      const steps: ThinkingStep[] = [
        createToolCallStep('1', 'tool_one', 'complete'),
        createToolCallStep('2', 'tool_two', 'complete'),
        createToolCallStep('3', 'tool_three', 'complete'),
      ];

      render(<AgentThinking steps={steps} isActive={true} defaultExpanded={false} />);

      const summary = screen.getByTestId('thinking-summary');
      expect(summary.textContent).toContain('Working...');
      expect(summary.textContent).toContain('3 tools');
    });

    it('should update indicator when tool execution completes', () => {
      const runningSteps: ThinkingStep[] = [
        createToolCallStep('1', 'test_tool', 'running'),
      ];

      const { rerender } = render(
        <AgentThinking steps={runningSteps} isActive={true} defaultExpanded={false} />
      );

      let summary = screen.getByTestId('thinking-summary');
      expect(summary.textContent).toContain('Working...');

      // Tool completes
      const completedSteps: ThinkingStep[] = [
        createToolCallStep('1', 'test_tool', 'complete'),
      ];

      rerender(
        <AgentThinking steps={completedSteps} isActive={false} defaultExpanded={false} />
      );

      summary = screen.getByTestId('thinking-summary');
      expect(summary.textContent).toContain('completed');
      expect(summary.textContent).not.toContain('Working...');
    });
  });
});
