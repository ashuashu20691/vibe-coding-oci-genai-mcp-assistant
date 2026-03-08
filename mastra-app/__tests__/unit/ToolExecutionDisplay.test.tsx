/**
 * Unit tests for ToolExecutionDisplay component
 * Validates: Requirements 12.2, 12.5, 0.2
 * 
 * Tests the Claude Desktop-style expandable tool execution display component
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToolExecutionDisplay } from '@/components/ToolExecutionDisplay';
import { ToolCall } from '@/types';

describe('ToolExecutionDisplay', () => {
  const mockToolCall: ToolCall = {
    id: 'tool-1',
    name: 'sqlcl_execute_query',
    arguments: {
      connection_name: 'LiveLab',
      query: 'SELECT * FROM suppliers',
    },
  };

  describe('Collapsed State', () => {
    it('should display tool name prominently in collapsed state', () => {
      render(<ToolExecutionDisplay toolCall={mockToolCall} status="completed" />);
      
      // Tool name should be formatted and displayed
      expect(screen.getByText('Execute Query')).toBeInTheDocument();
    });

    it('should show execution status in collapsed state', () => {
      render(<ToolExecutionDisplay toolCall={mockToolCall} status="completed" />);
      
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('should display chevron icon in collapsed state', () => {
      const { container } = render(<ToolExecutionDisplay toolCall={mockToolCall} status="completed" />);
      
      const chevron = container.querySelector('.chevron');
      expect(chevron).toBeInTheDocument();
    });

    it('should not show tool details in collapsed state', () => {
      render(<ToolExecutionDisplay toolCall={mockToolCall} status="completed" />);
      
      // Parameters should not be visible
      expect(screen.queryByText('Parameters:')).not.toBeInTheDocument();
    });
  });

  describe('Expanded State', () => {
    it('should expand when clicked', () => {
      render(<ToolExecutionDisplay toolCall={mockToolCall} status="completed" />);
      
      const button = screen.getByRole('button', { name: /expand tool execution details/i });
      fireEvent.click(button);
      
      // Details should now be visible
      expect(screen.getByText('Parameters:')).toBeInTheDocument();
    });

    it('should show formatted tool parameters in expanded state', () => {
      render(<ToolExecutionDisplay toolCall={mockToolCall} status="completed" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      // JSON parameters should be visible
      expect(screen.getByText(/connection_name/i)).toBeInTheDocument();
      expect(screen.getByText(/LiveLab/i)).toBeInTheDocument();
    });

    it('should show tool name in details section', () => {
      render(<ToolExecutionDisplay toolCall={mockToolCall} status="completed" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(screen.getByText('Tool:')).toBeInTheDocument();
      expect(screen.getByText('sqlcl_execute_query')).toBeInTheDocument();
    });

    it('should collapse when clicked again', () => {
      render(<ToolExecutionDisplay toolCall={mockToolCall} status="completed" />);
      
      const button = screen.getByRole('button');
      
      // Expand
      fireEvent.click(button);
      expect(screen.getByText('Parameters:')).toBeInTheDocument();
      
      // Collapse
      fireEvent.click(button);
      expect(screen.queryByText('Parameters:')).not.toBeInTheDocument();
    });
  });

  describe('Status Color Coding', () => {
    it('should apply completed class for completed status', () => {
      const { container } = render(<ToolExecutionDisplay toolCall={mockToolCall} status="completed" />);
      
      const toolExecution = container.querySelector('.tool-execution');
      expect(toolExecution).toHaveClass('tool-completed');
    });

    it('should apply executing class for executing status', () => {
      const { container } = render(<ToolExecutionDisplay toolCall={mockToolCall} status="executing" />);
      
      const toolExecution = container.querySelector('.tool-execution');
      expect(toolExecution).toHaveClass('tool-executing');
    });

    it('should apply failed class for failed status', () => {
      const { container } = render(<ToolExecutionDisplay toolCall={mockToolCall} status="failed" />);
      
      const toolExecution = container.querySelector('.tool-execution');
      expect(toolExecution).toHaveClass('tool-failed');
    });

    it('should apply pending class for pending status', () => {
      const { container } = render(<ToolExecutionDisplay toolCall={mockToolCall} status="pending" />);
      
      const toolExecution = container.querySelector('.tool-execution');
      expect(toolExecution).toHaveClass('tool-pending');
    });
  });

  describe('Defensive Null Checking (Requirement 0.2)', () => {
    it('should return null for null toolCall', () => {
      const { container } = render(<ToolExecutionDisplay toolCall={null as any} status="completed" />);
      
      expect(container.firstChild).toBeNull();
    });

    it('should handle missing tool name gracefully', () => {
      const toolCallWithoutName: ToolCall = {
        id: 'tool-1',
        name: '',
        arguments: {},
      };
      
      render(<ToolExecutionDisplay toolCall={toolCallWithoutName} status="completed" />);
      
      expect(screen.getByText('Unknown Tool')).toBeInTheDocument();
    });

    it('should handle missing arguments gracefully', () => {
      const toolCallWithoutArgs: ToolCall = {
        id: 'tool-1',
        name: 'test_tool',
        arguments: {},
      };
      
      render(<ToolExecutionDisplay toolCall={toolCallWithoutArgs} status="completed" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(screen.getByText('No parameters')).toBeInTheDocument();
    });

    it('should handle undefined arguments gracefully', () => {
      const toolCallWithUndefinedArgs: ToolCall = {
        id: 'tool-1',
        name: 'test_tool',
        arguments: undefined as any,
      };
      
      render(<ToolExecutionDisplay toolCall={toolCallWithUndefinedArgs} status="completed" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(screen.getByText('No parameters')).toBeInTheDocument();
    });
  });

  describe('Tool Name Formatting', () => {
    it('should remove sqlcl_ prefix from tool names', () => {
      render(<ToolExecutionDisplay toolCall={mockToolCall} status="completed" />);
      
      expect(screen.getByText('Execute Query')).toBeInTheDocument();
      expect(screen.queryByText('Sqlcl Execute Query')).not.toBeInTheDocument();
    });

    it('should remove mcp_ prefix from tool names', () => {
      const mcpToolCall: ToolCall = {
        id: 'tool-1',
        name: 'mcp_list_tools',
        arguments: {},
      };
      
      render(<ToolExecutionDisplay toolCall={mcpToolCall} status="completed" />);
      
      expect(screen.getByText('List Tools')).toBeInTheDocument();
    });

    it('should capitalize words in tool name', () => {
      const toolCall: ToolCall = {
        id: 'tool-1',
        name: 'get_user_data',
        arguments: {},
      };
      
      render(<ToolExecutionDisplay toolCall={toolCall} status="completed" />);
      
      expect(screen.getByText('Get User Data')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-expanded attribute when collapsed', () => {
      render(<ToolExecutionDisplay toolCall={mockToolCall} status="completed" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('should have proper aria-expanded attribute when expanded', () => {
      render(<ToolExecutionDisplay toolCall={mockToolCall} status="completed" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('should have descriptive aria-label', () => {
      render(<ToolExecutionDisplay toolCall={mockToolCall} status="completed" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Expand tool execution details for Execute Query');
    });
  });

  describe('Animation', () => {
    it('should have tool-execution class with transition styles', () => {
      const { container } = render(<ToolExecutionDisplay toolCall={mockToolCall} status="completed" />);
      
      const toolExecution = container.querySelector('.tool-execution');
      expect(toolExecution).toHaveClass('tool-execution');
    });

    it('should rotate chevron on expand', () => {
      const { container } = render(<ToolExecutionDisplay toolCall={mockToolCall} status="completed" />);
      
      const button = screen.getByRole('button');
      const chevron = container.querySelector('.chevron');
      
      // Initially rotated 0deg
      expect(chevron).toHaveStyle({ transform: 'rotate(0deg)' });
      
      // After click, rotated 90deg
      fireEvent.click(button);
      expect(chevron).toHaveStyle({ transform: 'rotate(90deg)' });
    });
  });
});
