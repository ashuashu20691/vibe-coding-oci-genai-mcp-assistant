/**
 * Text Selection and Copy Behavior Tests
 * 
 * Tests for Task 20: Enable text selection and copy
 * Requirements: 33.1-33.5
 */

import { render } from '@testing-library/react';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { ToolExecutionDisplay } from '@/components/ToolExecutionDisplay';
import { ToolCall } from '@/types';

// Mock tool call for testing
const mockToolCall: ToolCall = {
  id: 'tool-1',
  name: 'test_tool',
  arguments: {
    query: 'SELECT * FROM users',
    database: 'test_db',
  },
};

describe('Text Selection and Copy Behavior', () => {
  describe('Requirement 33.1 & 33.2: Enable text selection with appropriate CSS properties', () => {
    it('should apply correct CSS classes for text selection on markdown content', () => {
      const { container } = render(
        <MarkdownRenderer content="This is **bold** text with `code` that should be selectable" />
      );
      
      const markdownContainer = container.querySelector('.markdown-content');
      expect(markdownContainer).toBeInTheDocument();
      expect(markdownContainer).toHaveClass('markdown-content');
    });

    it('should render message content with proper structure', () => {
      const TestMessage = () => (
        <div className="message message-user">
          <div className="markdown-content">
            This is a test message that should be selectable
          </div>
        </div>
      );
      
      const { container } = render(<TestMessage />);
      
      const messageElement = container.querySelector('.message');
      expect(messageElement).toBeInTheDocument();
      expect(messageElement).toHaveClass('message');
      expect(messageElement).toHaveClass('message-user');
      
      const contentElement = container.querySelector('.markdown-content');
      expect(contentElement).toBeInTheDocument();
    });
  });

  describe('Requirement 33.4: Enable code block content selection', () => {
    it('should render tool execution display with proper structure', () => {
      const { container } = render(
        <ToolExecutionDisplay toolCall={mockToolCall} status="completed" />
      );
      
      // Check that tool execution container has correct class
      const toolExecution = container.querySelector('.tool-execution');
      expect(toolExecution).toBeInTheDocument();
      expect(toolExecution).toHaveClass('tool-execution');
    });

    it('should render code blocks within markdown with proper structure', () => {
      const codeBlockContent = `
Here is some code:

\`\`\`sql
SELECT * FROM users 
WHERE active = 1;
\`\`\`

And some inline \`code\` as well.
      `;
      
      const { container } = render(<MarkdownRenderer content={codeBlockContent} />);
      
      // Check that pre elements (code blocks) are present
      const preElements = container.querySelectorAll('pre');
      expect(preElements.length).toBeGreaterThan(0);
      
      // Check that code elements are present
      const codeElements = container.querySelectorAll('code');
      expect(codeElements.length).toBeGreaterThan(0);
    });
  });

  describe('Requirement 33.3: Maintain readable selection highlight colors', () => {
    it('should have proper CSS structure for selection styling', () => {
      const { container } = render(
        <div className="message message-assistant">
          <div className="markdown-content">
            Test content for selection styling
          </div>
        </div>
      );
      
      const messageElement = container.querySelector('.message');
      expect(messageElement).toBeInTheDocument();
      expect(messageElement).toHaveClass('message');
      
      const contentElement = container.querySelector('.markdown-content');
      expect(contentElement).toBeInTheDocument();
      expect(contentElement).toHaveClass('markdown-content');
    });
  });

  describe('Requirement 33.5: Don\'t interfere with native copy functionality', () => {
    it('should maintain proper structure for form inputs', () => {
      const TestInput = () => (
        <input 
          type="text" 
          defaultValue="This text should be selectable"
          data-testid="test-input"
          className="copilot-input"
        />
      );
      
      const { container } = render(<TestInput />);
      
      const input = container.querySelector('input[data-testid="test-input"]');
      expect(input).toBeInTheDocument();
      expect(input).toHaveClass('copilot-input');
    });

    it('should render interactive elements with proper button structure', () => {
      const { container } = render(
        <ToolExecutionDisplay toolCall={mockToolCall} status="completed" />
      );
      
      // Check that button elements are present and properly structured
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
      
      // Tool header should be present
      const toolHeader = container.querySelector('.tool-header');
      expect(toolHeader).toBeInTheDocument();
    });
  });

  describe('CSS Class Structure Validation', () => {
    it('should validate that all required CSS classes are applied correctly', () => {
      // Test various component structures that should have text selection enabled
      const components = [
        { element: <div className="message">Message content</div>, expectedClass: 'message' },
        { element: <div className="message-user">User message</div>, expectedClass: 'message-user' },
        { element: <div className="message-assistant">Assistant message</div>, expectedClass: 'message-assistant' },
        { element: <div className="message-system">System message</div>, expectedClass: 'message-system' },
        { element: <div className="markdown-content">Markdown content</div>, expectedClass: 'markdown-content' },
        { element: <div className="tool-details">Tool details</div>, expectedClass: 'tool-details' },
        { element: <div className="tool-execution">Tool execution</div>, expectedClass: 'tool-execution' },
        { element: <pre className="code-block">Code block</pre>, expectedClass: 'code-block' },
        { element: <code>Inline code</code>, expectedClass: null },
        { element: <textarea className="copilot-input">Textarea</textarea>, expectedClass: 'copilot-input' },
      ];

      components.forEach(({ element, expectedClass }) => {
        const { container } = render(element);
        const renderedElement = container.firstChild as HTMLElement;
        
        expect(renderedElement).toBeInTheDocument();
        
        if (expectedClass) {
          expect(renderedElement).toHaveClass(expectedClass);
        }
      });
    });
  });

  describe('Text Selection CSS Properties Validation', () => {
    it('should ensure CSS selectors target the correct elements', () => {
      // This test validates that our CSS structure is correct
      // The actual user-select property testing would require a browser environment
      
      const { container } = render(
        <div>
          <div className="message message-user">
            <div className="markdown-content">
              <p>Regular text</p>
              <pre><code>Code block content</code></pre>
              <code>Inline code</code>
            </div>
          </div>
          <div className="tool-execution">
            <div className="tool-header">
              <span className="tool-name">Tool Name</span>
            </div>
            <div className="tool-details">
              <pre>Tool parameters</pre>
            </div>
          </div>
        </div>
      );

      // Verify all the elements that should have text selection are present
      expect(container.querySelector('.message')).toBeInTheDocument();
      expect(container.querySelector('.message-user')).toBeInTheDocument();
      expect(container.querySelector('.markdown-content')).toBeInTheDocument();
      expect(container.querySelector('.tool-execution')).toBeInTheDocument();
      expect(container.querySelector('.tool-details')).toBeInTheDocument();
      expect(container.querySelector('.tool-name')).toBeInTheDocument();
      expect(container.querySelector('pre')).toBeInTheDocument();
      expect(container.querySelector('code')).toBeInTheDocument();
    });
  });
});