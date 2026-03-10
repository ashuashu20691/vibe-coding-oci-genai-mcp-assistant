/**
 * Unit tests for AI Elements Tool Components
 * Validates: Requirements 2.1, 2.2, 2.3, 2.5, 2.6, 2.7
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToolInvocationAI } from '@/components/ai-elements/ToolInvocationAI';
import { ToolResultAI } from '@/components/ai-elements/ToolResultAI';
import { ToolExecutionDisplayAI } from '@/components/ai-elements/ToolExecutionDisplayAI';
import { ToolCall } from '@/types';

describe('AI Elements Tool Components', () => {
  const mockToolCall: ToolCall = {
    id: 'tool-1',
    name: 'sqlcl_execute_query',
    arguments: {
      connection_name: 'LiveLab',
      query: 'SELECT * FROM users',
    },
  };

  describe('ToolInvocationAI', () => {
    it('should display tool name prominently', () => {
      render(<ToolInvocationAI toolCall={mockToolCall} status="completed" />);
      
      expect(screen.getByTestId('tool-name')).toHaveTextContent('Execute Query');
    });

    it('should show loading spinner when executing', () => {
      render(<ToolInvocationAI toolCall={mockToolCall} status="executing" />);
      
      const spinner = screen.getByLabelText('Loading');
      expect(spinner).toBeInTheDocument();
    });

    it('should show status dot when completed', () => {
      render(<ToolInvocationAI toolCall={mockToolCall} status="completed" />);
      
      const statusDot = screen.getByLabelText('Status: completed');
      expect(statusDot).toBeInTheDocument();
    });

    it('should display execution time when provided', () => {
      render(
        <ToolInvocationAI 
          toolCall={mockToolCall} 
          status="completed" 
          executionTime={150}
        />
      );
      
      expect(screen.getByTestId('execution-time')).toHaveTextContent('150ms');
    });

    it('should display tool narrative when provided', () => {
      render(
        <ToolInvocationAI 
          toolCall={mockToolCall} 
          status="completed"
          narrative="Executing database query to fetch user data"
        />
      );
      
      expect(screen.getByTestId('tool-narrative')).toHaveTextContent(
        'Executing database query to fetch user data'
      );
    });

    it('should expand to show full details when clicked', () => {
      render(<ToolInvocationAI toolCall={mockToolCall} status="completed" />);
      
      const button = screen.getByTestId('tool-header-button');
      fireEvent.click(button);
      
      expect(screen.getByTestId('tool-details')).toBeInTheDocument();
      expect(screen.getByText('Parameters:')).toBeInTheDocument();
    });

    it('should show tool parameters in expanded state', () => {
      render(<ToolInvocationAI toolCall={mockToolCall} status="completed" />);
      
      const button = screen.getByTestId('tool-header-button');
      fireEvent.click(button);
      
      expect(screen.getByTestId('tool-parameters')).toBeInTheDocument();
      expect(screen.getByText(/connection_name/i)).toBeInTheDocument();
    });

    it('should display error message when failed', () => {
      render(
        <ToolInvocationAI 
          toolCall={mockToolCall} 
          status="failed"
          error="Connection timeout"
        />
      );
      
      const button = screen.getByTestId('tool-header-button');
      fireEvent.click(button);
      
      expect(screen.getByTestId('tool-error')).toHaveTextContent('Connection timeout');
    });

    it('should display result when provided', () => {
      const result = { rows: 10, data: [] };
      
      render(
        <ToolInvocationAI 
          toolCall={mockToolCall} 
          status="completed"
          result={result}
        />
      );
      
      const button = screen.getByTestId('tool-header-button');
      fireEvent.click(button);
      
      expect(screen.getByTestId('tool-result')).toBeInTheDocument();
    });

    it('should collapse when clicked again', () => {
      render(<ToolInvocationAI toolCall={mockToolCall} status="completed" />);
      
      const button = screen.getByTestId('tool-header-button');
      
      // Expand
      fireEvent.click(button);
      expect(screen.getByTestId('tool-details')).toBeInTheDocument();
      
      // Collapse
      fireEvent.click(button);
      expect(screen.queryByTestId('tool-details')).not.toBeInTheDocument();
    });
  });

  describe('ToolResultAI', () => {
    it('should display result content', () => {
      const result = { success: true, count: 5 };
      
      render(<ToolResultAI result={result} />);
      
      expect(screen.getByTestId('tool-result-display')).toBeInTheDocument();
      expect(screen.getByText(/success/i)).toBeInTheDocument();
    });

    it('should display error message when isError is true', () => {
      render(
        <ToolResultAI 
          error="Database connection failed" 
          isError={true}
        />
      );
      
      expect(screen.getByTestId('tool-error-display')).toBeInTheDocument();
      expect(screen.getByText('Database connection failed')).toBeInTheDocument();
    });

    it('should show error icon when displaying error', () => {
      render(
        <ToolResultAI 
          error="Error occurred" 
          isError={true}
        />
      );
      
      expect(screen.getByText('Tool Execution Failed')).toBeInTheDocument();
    });

    it('should return null when no result or error', () => {
      const { container } = render(<ToolResultAI />);
      
      expect(container.firstChild).toBeNull();
    });
  });

  describe('ToolExecutionDisplayAI', () => {
    it('should display tool name', () => {
      render(<ToolExecutionDisplayAI toolCall={mockToolCall} status="completed" />);
      
      expect(screen.getByTestId('tool-name')).toHaveTextContent('Execute Query');
    });

    it('should show loading spinner when executing', () => {
      render(<ToolExecutionDisplayAI toolCall={mockToolCall} status="executing" />);
      
      const spinner = screen.getByLabelText('Loading');
      expect(spinner).toBeInTheDocument();
    });

    it('should display narrative in collapsed state', () => {
      render(
        <ToolExecutionDisplayAI 
          toolCall={mockToolCall} 
          status="completed"
          narrative="Querying the database for user information"
        />
      );
      
      expect(screen.getByTestId('tool-narrative')).toHaveTextContent(
        'Querying the database for user information'
      );
    });

    it('should expand to show full details', () => {
      render(<ToolExecutionDisplayAI toolCall={mockToolCall} status="completed" />);
      
      const button = screen.getByTestId('tool-header-button');
      fireEvent.click(button);
      
      expect(screen.getByTestId('tool-details')).toBeInTheDocument();
    });

    it('should show parameters in expanded state', () => {
      render(<ToolExecutionDisplayAI toolCall={mockToolCall} status="completed" />);
      
      const button = screen.getByTestId('tool-header-button');
      fireEvent.click(button);
      
      expect(screen.getByText('Parameters:')).toBeInTheDocument();
      expect(screen.getByTestId('tool-parameters')).toBeInTheDocument();
    });

    it('should display error in expanded state', () => {
      render(
        <ToolExecutionDisplayAI 
          toolCall={mockToolCall} 
          status="failed"
          error="Query execution failed"
        />
      );
      
      const button = screen.getByTestId('tool-header-button');
      fireEvent.click(button);
      
      expect(screen.getByTestId('tool-error')).toHaveTextContent('Query execution failed');
    });

    it('should display result in expanded state', () => {
      const result = { rows: 5 };
      
      render(
        <ToolExecutionDisplayAI 
          toolCall={mockToolCall} 
          status="completed"
          result={result}
        />
      );
      
      const button = screen.getByTestId('tool-header-button');
      fireEvent.click(button);
      
      expect(screen.getByTestId('tool-result')).toBeInTheDocument();
    });

    it('should have smooth transition styles', () => {
      const { container } = render(
        <ToolExecutionDisplayAI toolCall={mockToolCall} status="completed" />
      );
      
      const toolExecution = container.querySelector('.tool-execution');
      expect(toolExecution).toHaveStyle({ transition: 'background-color 0.3s ease, border-color 0.3s ease, transform 0.2s ease' });
    });

    it('should rotate chevron on expand', () => {
      render(<ToolExecutionDisplayAI toolCall={mockToolCall} status="completed" />);
      
      const button = screen.getByTestId('tool-header-button');
      const chevron = button.querySelector('.chevron');
      
      // Initially collapsed (0deg)
      expect(chevron).toHaveStyle({ transform: 'rotate(0deg)' });
      
      // Expand
      fireEvent.click(button);
      expect(chevron).toHaveStyle({ transform: 'rotate(90deg)' });
    });
  });

  describe('Feature Flag Integration', () => {
    it('should render ToolExecutionDisplayAI when feature flag is enabled', () => {
      // This test validates that the component can be rendered
      // The actual feature flag switching is tested in integration tests
      render(<ToolExecutionDisplayAI toolCall={mockToolCall} status="completed" />);
      
      expect(screen.getByTestId('tool-execution-display-ai')).toBeInTheDocument();
    });
  });
});
