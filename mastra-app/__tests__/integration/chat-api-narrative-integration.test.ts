/**
 * Integration test for ChatService narrative streaming in chat API route
 * 
 * Validates that the chat API route properly integrates ChatService.sendMessageWithNarrative()
 * and streams narrative chunks before tool execution details.
 * 
 * Validates: Requirements 13.1, 13.2, 13.6, 17.1, 17.2, 17.4, 17.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '../../src/app/api/chat/route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('../../src/mastra', () => ({
  ociProvider: {
    getInitError: vi.fn(() => null),
    setSystemPreamble: vi.fn(),
  },
}));

vi.mock('../../src/db/conversation-store', () => ({
  ConversationStore: vi.fn(() => ({
    addMessage: vi.fn(),
  })),
}));

vi.mock('../../src/config', () => ({
  loadConfig: vi.fn(() => ({})),
  isOracleConfigured: vi.fn(() => false),
}));

vi.mock('../../src/mastra/agents/database-agent', () => ({
  getMCPTools: vi.fn(async () => ({
    list_tables: {
      name: 'list_tables',
      description: 'List database tables',
      inputSchema: {},
    },
  })),
  getAgentState: vi.fn(() => null),
  updateAgentState: vi.fn(),
  DATABASE_AGENT_INSTRUCTIONS: 'Test instructions',
}));

vi.mock('../../src/mastra/agents/supervisor-agent', () => ({
  classifyUserIntent: vi.fn(() => ({
    intent: 'query',
    visualizationType: null,
  })),
  generateClarificationPrompt: vi.fn(() => null),
  SUPERVISOR_AGENT_INSTRUCTIONS: 'Supervisor instructions',
}));

vi.mock('../../src/mastra/agents/data-analysis-agent', () => ({
  analyzeData: vi.fn(() => ({ summary: 'Test analysis' })),
}));

vi.mock('../../src/mastra/agents/visualization-agent', () => ({
  generateVisualization: vi.fn(async () => ({
    type: 'bar',
    content: '<div>Chart</div>',
  })),
}));

describe('Chat API - ChatService Narrative Integration', () => {
  let mockModelAdapter: any;

  beforeEach(() => {
    // Mock OCIModelAdapter
    mockModelAdapter = {
      stream: vi.fn(),
    };

    // Mock the OCIModelAdapter constructor
    vi.doMock('../../src/mastra/providers/oci-model-adapter', () => ({
      OCIModelAdapter: vi.fn(() => mockModelAdapter),
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should stream narrative chunks before tool execution', async () => {
    // Mock ChatService to emit narrative before tool_call
    const mockChatService = {
      sendMessageWithNarrative: async function* () {
        // Narrative appears first
        yield { type: 'narrative', content: 'Let me check the database tables...' };
        yield { type: 'narrative', content: ' I\'ll query the schema.' };
        
        // Then tool call
        yield {
          type: 'tool_call',
          toolCall: {
            id: 'tool-1',
            name: 'list_tables',
            arguments: {},
          },
          narrative: 'Let me check the database tables... I\'ll query the schema.',
        };
        
        // Tool result with post-tool narrative
        yield {
          type: 'tool_result',
          result: {
            toolCallId: 'tool-1',
            content: { tables: ['users', 'orders'] },
            isError: false,
          },
          narrative: 'I found 2 tables in the database.',
        };
        
        yield { type: 'narrative', content: 'I found 2 tables in the database.' };
        yield { type: 'content', content: 'Here are the tables: users, orders' };
        yield { type: 'done', finishReason: 'complete' };
      },
    };

    // Mock createChatService to return our mock
    vi.doMock('../../src/services/chat-service', () => ({
      createChatService: vi.fn(() => mockChatService),
      ENHANCED_SYSTEM_PROMPT: 'Test prompt',
    }));

    // Create request
    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { role: 'user', content: 'Show me the tables' },
        ],
        modelId: 'cohere.command-r-plus',
      }),
    });

    // Call API route
    const response = await POST(request);

    // Verify response is SSE stream
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');

    // Read stream events
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const events: any[] = [];

    let done = false;
    while (!done) {
      const { value, done: streamDone } = await reader.read();
      done = streamDone;

      if (value) {
        const text = decoder.decode(value);
        const lines = text.split('\n\n').filter(l => l.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            events.push(data);
          }
        }
      }
    }

    // Verify event order: narrative chunks come before tool_call
    const narrativeEvents = events.filter(e => e.content && e.content.includes('Let me check'));
    const toolCallEvents = events.filter(e => e.toolCall);

    expect(narrativeEvents.length).toBeGreaterThan(0);
    expect(toolCallEvents.length).toBeGreaterThan(0);

    // Find indices
    const firstNarrativeIndex = events.findIndex(e => 
      e.content && e.content.includes('Let me check')
    );
    const toolCallIndex = events.findIndex(e => e.toolCall);

    // Narrative should appear before tool call
    expect(firstNarrativeIndex).toBeLessThan(toolCallIndex);
    expect(firstNarrativeIndex).toBeGreaterThanOrEqual(0);
  });

  it('should stream post-tool narrative after tool results', async () => {
    // Mock ChatService to emit post-tool narrative
    const mockChatService = {
      sendMessageWithNarrative: async function* () {
        yield {
          type: 'tool_call',
          toolCall: {
            id: 'tool-1',
            name: 'list_tables',
            arguments: {},
          },
          narrative: 'Checking tables...',
        };
        
        yield {
          type: 'tool_result',
          result: {
            toolCallId: 'tool-1',
            content: { tables: ['users'] },
            isError: false,
          },
          narrative: 'Found 1 table.',
        };
        
        // Post-tool narrative
        yield { type: 'narrative', content: 'Found 1 table.' };
        yield { type: 'narrative', content: ' Let me analyze it.' };
        
        yield { type: 'done', finishReason: 'complete' };
      },
    };

    vi.doMock('../../src/services/chat-service', () => ({
      createChatService: vi.fn(() => mockChatService),
      ENHANCED_SYSTEM_PROMPT: 'Test prompt',
    }));

    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'List tables' }],
        modelId: 'cohere.command-r-plus',
      }),
    });

    const response = await POST(request);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const events: any[] = [];

    let done = false;
    while (!done) {
      const { value, done: streamDone } = await reader.read();
      done = streamDone;

      if (value) {
        const text = decoder.decode(value);
        const lines = text.split('\n\n').filter(l => l.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            events.push(data);
          }
        }
      }
    }

    // Verify post-tool narrative appears after tool result
    const toolResultIndex = events.findIndex(e => e.toolResult);
    const postNarrativeIndex = events.findIndex(e => 
      e.content && e.content.includes('Found 1 table')
    );

    expect(toolResultIndex).toBeGreaterThanOrEqual(0);
    expect(postNarrativeIndex).toBeGreaterThan(toolResultIndex);
  });

  it('should emit iteration_update events during processing', async () => {
    // Mock ChatService to emit iteration updates
    const mockChatService = {
      sendMessageWithNarrative: async function* () {
        yield {
          type: 'tool_call',
          toolCall: { id: 'tool-1', name: 'query', arguments: {} },
          narrative: 'Querying...',
        };
        
        yield {
          type: 'iteration_update',
          iteration: 1,
          maxIterations: 5,
        };
        
        yield {
          type: 'tool_result',
          result: {
            toolCallId: 'tool-1',
            content: { data: [] },
            isError: false,
          },
          narrative: 'No results.',
        };
        
        yield { type: 'done', finishReason: 'complete' };
      },
    };

    vi.doMock('../../src/services/chat-service', () => ({
      createChatService: vi.fn(() => mockChatService),
      ENHANCED_SYSTEM_PROMPT: 'Test prompt',
    }));

    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Query data' }],
        modelId: 'cohere.command-r-plus',
      }),
    });

    const response = await POST(request);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const events: any[] = [];

    let done = false;
    while (!done) {
      const { value, done: streamDone } = await reader.read();
      done = streamDone;

      if (value) {
        const text = decoder.decode(value);
        const lines = text.split('\n\n').filter(l => l.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            events.push(data);
          }
        }
      }
    }

    // Verify iteration_update events are present
    const iterationEvents = events.filter(e => e.iteration_update);
    expect(iterationEvents.length).toBeGreaterThan(0);
    
    if (iterationEvents.length > 0) {
      expect(iterationEvents[0].iteration_update).toHaveProperty('current');
      expect(iterationEvents[0].iteration_update).toHaveProperty('max');
    }
  });

  it('should handle error events with error narrative', async () => {
    // Mock ChatService to emit error with narrative
    const mockChatService = {
      sendMessageWithNarrative: async function* () {
        yield {
          type: 'tool_call',
          toolCall: { id: 'tool-1', name: 'query', arguments: {} },
          narrative: 'Executing query...',
        };
        
        yield {
          type: 'error',
          error: 'Connection failed',
          narrative: 'I encountered a connection error. Let me try a different approach.',
        };
        
        yield { type: 'narrative', content: 'I encountered a connection error. Let me try a different approach.' };
        yield { type: 'done', finishReason: 'error' };
      },
    };

    vi.doMock('../../src/services/chat-service', () => ({
      createChatService: vi.fn(() => mockChatService),
      ENHANCED_SYSTEM_PROMPT: 'Test prompt',
    }));

    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Query data' }],
        modelId: 'cohere.command-r-plus',
      }),
    });

    const response = await POST(request);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const events: any[] = [];

    let done = false;
    while (!done) {
      const { value, done: streamDone } = await reader.read();
      done = streamDone;

      if (value) {
        const text = decoder.decode(value);
        const lines = text.split('\n\n').filter(l => l.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            events.push(data);
          }
        }
      }
    }

    // Verify error event is present
    const errorEvents = events.filter(e => e.error);
    expect(errorEvents.length).toBeGreaterThan(0);

    // Verify error narrative is streamed
    const errorNarrativeEvents = events.filter(e => 
      e.content && e.content.includes('connection error')
    );
    expect(errorNarrativeEvents.length).toBeGreaterThan(0);
  });
});
