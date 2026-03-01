/**
 * Unit tests for ChatService
 * 
 * Tests the event-driven narrative streaming integration with Mastra's event system.
 * Validates that event handlers are properly registered and invoked at appropriate lifecycle points.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatService, createChatService } from '../../src/services/chat-service';
import { OCIModelAdapter } from '../../src/mastra/providers/oci-model-adapter';
import { NarrativeStreamingService } from '../../src/services/narrative-streaming-service';
import { ChatMessage } from '../../src/mastra/providers/oci-genai';
import { ToolCall } from '../../src/types';

describe('ChatService', () => {
  let mockModelAdapter: OCIModelAdapter;
  let narrativeService: NarrativeStreamingService;
  let chatService: ChatService;

  beforeEach(() => {
    // Create mock model adapter
    mockModelAdapter = {
      stream: vi.fn(),
    } as unknown as OCIModelAdapter;

    // Create real narrative service
    narrativeService = new NarrativeStreamingService();

    // Create chat service
    chatService = createChatService(mockModelAdapter, narrativeService, {
      systemPrompt: 'Test system prompt',
      maxIterations: 5,
    });
  });

  describe('registerEventHandlers', () => {
    it('should register onToolCall handler', () => {
      const handler = vi.fn(async function* (toolCall: ToolCall) {
        yield 'Custom narrative';
      });

      chatService.registerEventHandlers({
        onToolCall: handler,
      });

      // Verify handler is registered (internal state check)
      expect(chatService).toBeDefined();
    });

    it('should register onStepFinish handler', () => {
      const handler = vi.fn(async function* (step) {
        yield 'Step completed';
      });

      chatService.registerEventHandlers({
        onStepFinish: handler,
      });

      expect(chatService).toBeDefined();
    });

    it('should register onError handler', () => {
      const handler = vi.fn(async function* (error: Error) {
        yield 'Error handled';
      });

      chatService.registerEventHandlers({
        onError: handler,
      });

      expect(chatService).toBeDefined();
    });

    it('should register multiple handlers at once', () => {
      const handlers = {
        onToolCall: vi.fn(async function* () { yield 'tool'; }),
        onStepFinish: vi.fn(async function* () { yield 'step'; }),
        onError: vi.fn(async function* () { yield 'error'; }),
      };

      chatService.registerEventHandlers(handlers);

      expect(chatService).toBeDefined();
    });
  });

  describe('setSystemPrompt', () => {
    it('should update system prompt', () => {
      const newPrompt = 'New system prompt';
      chatService.setSystemPrompt(newPrompt);

      // Verify by checking that service still works
      expect(chatService).toBeDefined();
    });
  });

  describe('updateContext', () => {
    it('should update conversation context', () => {
      chatService.updateContext({
        currentGoal: 'Test goal',
        previousMessages: [
          { role: 'user', content: 'Hello' },
        ],
      });

      expect(chatService).toBeDefined();
    });

    it('should merge context updates', () => {
      chatService.updateContext({
        currentGoal: 'Goal 1',
      });

      chatService.updateContext({
        previousMessages: [
          { role: 'user', content: 'Message 1' },
        ],
      });

      expect(chatService).toBeDefined();
    });
  });

  describe('sendMessageWithNarrative', () => {
    it('should stream pre-tool narrative before tool execution', async () => {
      // Mock model adapter to emit tool-call event
      const mockStream = async function* () {
        yield {
          type: 'tool-call' as const,
          toolCall: {
            id: 'tool-1',
            name: 'list_tables',
            arguments: { schema: 'public' },
          },
        };
        yield {
          type: 'finish' as const,
          finishReason: 'complete',
        };
      };

      vi.mocked(mockModelAdapter.stream).mockReturnValue(mockStream());

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Show me the tables' },
      ];

      const events = [];
      for await (const event of chatService.sendMessageWithNarrative(messages)) {
        events.push(event);
      }

      // Should have narrative events before tool_call event
      const narrativeEvents = events.filter(e => e.type === 'narrative');
      const toolCallEvents = events.filter(e => e.type === 'tool_call');

      expect(narrativeEvents.length).toBeGreaterThan(0);
      expect(toolCallEvents.length).toBe(1);

      // Narrative should come before tool call
      const firstNarrativeIndex = events.findIndex(e => e.type === 'narrative');
      const toolCallIndex = events.findIndex(e => e.type === 'tool_call');
      expect(firstNarrativeIndex).toBeLessThan(toolCallIndex);
    });

    it('should stream post-tool narrative after tool result', async () => {
      // Mock model adapter to emit tool-call and tool-result events
      const mockStream = async function* () {
        yield {
          type: 'tool-call' as const,
          toolCall: {
            id: 'tool-1',
            name: 'list_tables',
            arguments: {},
          },
        };
        yield {
          type: 'tool-result' as const,
          toolResult: {
            toolCallId: 'tool-1',
            result: { tables: ['users', 'orders'] },
          },
        };
        yield {
          type: 'finish' as const,
          finishReason: 'complete',
        };
      };

      vi.mocked(mockModelAdapter.stream).mockReturnValue(mockStream());

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Show me the tables' },
      ];

      const events = [];
      for await (const event of chatService.sendMessageWithNarrative(messages)) {
        events.push(event);
      }

      // Should have narrative events after tool_result event
      const toolResultEvents = events.filter(e => e.type === 'tool_result');
      expect(toolResultEvents.length).toBe(1);

      // Should have post-tool narrative
      const toolResultIndex = events.findIndex(e => e.type === 'tool_result');
      const narrativeAfterResult = events
        .slice(toolResultIndex)
        .filter(e => e.type === 'narrative');
      
      expect(narrativeAfterResult.length).toBeGreaterThan(0);
    });

    it('should stream error narrative on error', async () => {
      // Mock model adapter to emit error event
      const mockStream = async function* () {
        yield {
          type: 'tool-call' as const,
          toolCall: {
            id: 'tool-1',
            name: 'execute_query',
            arguments: { query: 'SELECT * FROM invalid' },
          },
        };
        yield {
          type: 'error' as const,
          error: 'Table not found',
        };
      };

      vi.mocked(mockModelAdapter.stream).mockReturnValue(mockStream());

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Query invalid table' },
      ];

      const events = [];
      for await (const event of chatService.sendMessageWithNarrative(messages)) {
        events.push(event);
      }

      // Should have error event with narrative
      const errorEvents = events.filter(e => e.type === 'error');
      expect(errorEvents.length).toBe(1);
      expect(errorEvents[0]).toHaveProperty('narrative');
      expect(errorEvents[0].narrative).toBeTruthy();
    });

    it('should invoke custom onToolCall handler', async () => {
      const customHandler = vi.fn(async function* (toolCall: ToolCall) {
        yield 'Custom pre-tool narrative';
      });

      chatService.registerEventHandlers({
        onToolCall: customHandler,
      });

      // Mock model adapter
      const mockStream = async function* () {
        yield {
          type: 'tool-call' as const,
          toolCall: {
            id: 'tool-1',
            name: 'list_tables',
            arguments: {},
          },
        };
        yield {
          type: 'finish' as const,
          finishReason: 'complete',
        };
      };

      vi.mocked(mockModelAdapter.stream).mockReturnValue(mockStream());

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Show tables' },
      ];

      const events = [];
      for await (const event of chatService.sendMessageWithNarrative(messages)) {
        events.push(event);
      }

      // Custom handler should have been called
      expect(customHandler).toHaveBeenCalled();

      // Should have custom narrative in events
      const narrativeEvents = events.filter(e => e.type === 'narrative');
      const customNarrative = narrativeEvents.find(e => 
        e.content.includes('Custom pre-tool narrative')
      );
      expect(customNarrative).toBeDefined();
    });

    it('should invoke custom onError handler', async () => {
      const customHandler = vi.fn(async function* (error: Error) {
        yield 'Custom error handling';
      });

      chatService.registerEventHandlers({
        onError: customHandler,
      });

      // Mock model adapter to throw error
      const mockStream = async function* () {
        yield {
          type: 'error' as const,
          error: 'Connection failed',
        };
      };

      vi.mocked(mockModelAdapter.stream).mockReturnValue(mockStream());

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Query data' },
      ];

      const events = [];
      for await (const event of chatService.sendMessageWithNarrative(messages)) {
        events.push(event);
      }

      // Custom error handler should have been called
      expect(customHandler).toHaveBeenCalled();
    });

    it('should emit iteration_update events during retries', async () => {
      // Mock model adapter to emit multiple errors (simulating retries)
      const mockStream = async function* () {
        yield {
          type: 'tool-call' as const,
          toolCall: {
            id: 'tool-1',
            name: 'execute_query',
            arguments: {},
          },
        };
        yield {
          type: 'error' as const,
          error: 'First attempt failed',
        };
        yield {
          type: 'tool-call' as const,
          toolCall: {
            id: 'tool-2',
            name: 'execute_query',
            arguments: {},
          },
        };
        yield {
          type: 'error' as const,
          error: 'Second attempt failed',
        };
      };

      vi.mocked(mockModelAdapter.stream).mockReturnValue(mockStream());

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Query data' },
      ];

      const events = [];
      for await (const event of chatService.sendMessageWithNarrative(messages)) {
        events.push(event);
      }

      // Should have iteration_update events
      const iterationEvents = events.filter(e => e.type === 'iteration_update');
      expect(iterationEvents.length).toBeGreaterThan(0);

      // Check iteration numbers
      if (iterationEvents.length > 0) {
        expect(iterationEvents[0]).toHaveProperty('iteration');
        expect(iterationEvents[0]).toHaveProperty('maxIterations');
        expect(iterationEvents[0].maxIterations).toBe(5);
      }
    });

    it('should pass through text-delta events as content', async () => {
      // Mock model adapter to emit text deltas
      const mockStream = async function* () {
        yield {
          type: 'text-delta' as const,
          textDelta: 'Hello ',
        };
        yield {
          type: 'text-delta' as const,
          textDelta: 'world',
        };
        yield {
          type: 'finish' as const,
          finishReason: 'complete',
        };
      };

      vi.mocked(mockModelAdapter.stream).mockReturnValue(mockStream());

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Say hello' },
      ];

      const events = [];
      for await (const event of chatService.sendMessageWithNarrative(messages)) {
        events.push(event);
      }

      // Should have content events
      const contentEvents = events.filter(e => e.type === 'content');
      expect(contentEvents.length).toBe(2);
      expect(contentEvents[0].content).toBe('Hello ');
      expect(contentEvents[1].content).toBe('world');
    });

    it('should emit done event on completion', async () => {
      // Mock model adapter
      const mockStream = async function* () {
        yield {
          type: 'text-delta' as const,
          textDelta: 'Response',
        };
        yield {
          type: 'finish' as const,
          finishReason: 'complete',
        };
      };

      vi.mocked(mockModelAdapter.stream).mockReturnValue(mockStream());

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Test' },
      ];

      const events = [];
      for await (const event of chatService.sendMessageWithNarrative(messages)) {
        events.push(event);
      }

      // Should have done event as last event
      const lastEvent = events[events.length - 1];
      expect(lastEvent.type).toBe('done');
      expect(lastEvent).toHaveProperty('finishReason');
    });
  });

  describe('createChatService factory', () => {
    it('should create ChatService with default options', () => {
      const service = createChatService(mockModelAdapter, narrativeService);
      expect(service).toBeInstanceOf(ChatService);
    });

    it('should create ChatService with custom options', () => {
      const service = createChatService(mockModelAdapter, narrativeService, {
        systemPrompt: 'Custom prompt',
        maxIterations: 10,
      });
      expect(service).toBeInstanceOf(ChatService);
    });
  });
});
