/**
 * Property-Based Tests for Tool Details Integration
 * Feature: claude-desktop-alternative, Property 47: Tool Details as Conversational Text
 * 
 * **Validates: Requirements 18.3**
 * 
 * For any tool execution within an assistant message, the tool name, arguments, and results
 * SHALL be formatted as natural conversational text (e.g., "I ran describe_table with...")
 * and SHALL NOT appear as separate UI event cards.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageList } from '@/components/MessageList';
import { Message, ToolCall } from '@/types';
import * as fc from 'fast-check';

// Mock scrollIntoView for tests
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe('Property 47: Tool Details as Conversational Text (Requirement 18.3)', () => {
  it('tool calls should be integrated into conversational text, not displayed as separate cards', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string(),
            name: fc.constantFrom(
              'sqlcl_execute_query',
              'sqlcl_describe_table',
              'sqlcl_list_connections',
              'sqlcl_connect',
              'sqlcl_disconnect'
            ),
            arguments: fc.dictionary(fc.string(), fc.anything()),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        fc.string({ minLength: 10 }),
        (toolCalls, content) => {
      // Arrange: Create a message with tool calls and conversational content
      const messages: Message[] = [
        {
          id: '1',
          role: 'assistant',
          content,
          timestamp: new Date(),
          toolCalls,
        },
      ];

      // Act: Render the MessageList
      const { container } = render(<MessageList messages={messages} />);

          // Assert: Content should be displayed
          expect(screen.getByText(content)).toBeInTheDocument();

          // Assert: Should NOT have "Used X tools" button (from ToolCallDisplay)
          expect(screen.queryByText(/Used \d+ tool/i)).not.toBeInTheDocument();

          // Assert: Should NOT have expandable tool call items
          const toolElements = container.querySelectorAll('[class*="tool"]');
          // Filter out elements that are part of the content text itself
          const separateToolCards = Array.from(toolElements).filter(
            (el) => !el.textContent?.includes(content)
          );
          expect(separateToolCards.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('tool execution details should appear in natural language format', () => {
    fc.assert(
      fc.property(
        fc.record({
          toolName: fc.constantFrom(
            'sqlcl_execute_query',
            'sqlcl_describe_table',
            'sqlcl_list_connections'
          ),
          args: fc.dictionary(fc.string(), fc.string()),
        }),
        ({ toolName, args }) => {
      // Arrange: Create conversational content that describes the tool execution
      const argDescriptions = Object.entries(args)
        .map(([key, value]) => `${key}="${value}"`)
        .join(', ');
      const content = `I'll run ${toolName} with ${argDescriptions}`;

      const messages: Message[] = [
        {
          id: '1',
          role: 'assistant',
          content,
          timestamp: new Date(),
          toolCalls: [
            {
              id: 'tool-1',
              name: toolName,
              arguments: args,
            },
          ],
        },
      ];

      // Act: Render the MessageList
      render(<MessageList messages={messages} />);

          // Assert: Conversational description should be visible
          expect(screen.getByText(new RegExp(toolName))).toBeInTheDocument();

          // Assert: Should NOT have separate tool execution cards
          expect(screen.queryByText(/Used 1 tool/i)).not.toBeInTheDocument();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('messages with or without tool calls should never display separate tool execution cards', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string(),
            role: fc.constant('assistant' as const),
            content: fc.string({ minLength: 10 }),
            timestamp: fc.date(),
            toolCalls: fc.option(
              fc.array(
                fc.record({
                  id: fc.string(),
                  name: fc.string(),
                  arguments: fc.dictionary(fc.string(), fc.anything()),
                }),
                { maxLength: 3 }
              ),
              { nil: undefined }
            ),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (messages) => {
      // Act: Render the MessageList
      const { container } = render(<MessageList messages={messages} />);

          // Assert: Should NEVER have "Used X tools" button
          expect(screen.queryByText(/Used \d+ tool/i)).not.toBeInTheDocument();

          // Assert: Should NOT have expandable chevron icons for tool calls
          const chevrons = container.querySelectorAll('svg[class*="rotate"]');
          // Filter out chevrons that might be part of other UI elements
          const toolCallChevrons = Array.from(chevrons).filter((svg) => {
            const parent = svg.closest('button');
            return parent?.textContent?.includes('tool');
          });
          expect(toolCallChevrons.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('tool narratives should flow naturally in the conversation', () => {
    fc.assert(
      fc.property(
        fc.record({
          toolName: fc.string({ minLength: 5 }),
          preNarrative: fc.string({ minLength: 10 }),
          postNarrative: fc.string({ minLength: 10 }),
        }),
        ({ toolName, preNarrative, postNarrative }) => {
      // Arrange: Create a message with pre and post tool narratives
      const content = `${preNarrative} ${postNarrative}`;
      const messages: Message[] = [
        {
          id: '1',
          role: 'assistant',
          content,
          timestamp: new Date(),
          toolCalls: [
            {
              id: 'tool-1',
              name: toolName,
              arguments: {},
            },
          ],
        },
      ];

      // Act: Render the MessageList
      render(<MessageList messages={messages} />);

          // Assert: Both narratives should be visible in the content
          expect(screen.getByText(new RegExp(preNarrative))).toBeInTheDocument();
          expect(screen.getByText(new RegExp(postNarrative))).toBeInTheDocument();

          // Assert: Should NOT have separate tool display
          expect(screen.queryByText(/Used 1 tool/i)).not.toBeInTheDocument();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('empty or undefined tool calls should not create tool display elements', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),
        fc.string({ minLength: 10 }),
        (toolCallCount, content) => {
      // Arrange: Create messages with varying tool call counts
      const toolCalls: ToolCall[] | undefined =
        toolCallCount === 0
          ? undefined
          : Array.from({ length: toolCallCount }, (_, i) => ({
              id: `tool-${i}`,
              name: `tool_${i}`,
              arguments: {},
            }));

      const messages: Message[] = [
        {
          id: '1',
          role: 'assistant',
          content,
          timestamp: new Date(),
          toolCalls,
        },
      ];

      // Act: Render the MessageList
      render(<MessageList messages={messages} />);

          // Assert: Content should be displayed
          expect(screen.getByText(content)).toBeInTheDocument();

          // Assert: Should NEVER have "Used X tools" button regardless of tool count
          expect(screen.queryByText(/Used \d+ tool/i)).not.toBeInTheDocument();
        }
      ),
      { numRuns: 100 }
    );
  });
});
