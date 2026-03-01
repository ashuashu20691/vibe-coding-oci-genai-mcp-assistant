/**
 * ChatService Usage Example
 * 
 * Demonstrates how to use ChatService with event handlers for narrative streaming.
 * This example shows the integration pattern for Requirements 17.1, 17.2, 17.5.
 */

import { OCIModelAdapter } from '@/mastra/providers/oci-model-adapter';
import { ociProvider } from '@/mastra';
import { createChatService, ENHANCED_SYSTEM_PROMPT } from './chat-service';
import { narrativeStreamingService } from './narrative-streaming-service';
import { ToolCall } from '@/types';

/**
 * Example: Basic ChatService usage with narrative streaming
 */
export async function basicChatServiceExample() {
  // 1. Create model adapter
  const modelAdapter = new OCIModelAdapter({
    provider: ociProvider,
    modelId: 'cohere.command-r-plus',
    temperature: 0,
    maxTokens: 4000,
    conversationId: 'example-conversation',
  });

  // 2. Create chat service with narrative streaming
  const chatService = createChatService(modelAdapter, narrativeStreamingService, {
    systemPrompt: 'You are a helpful database assistant.',
    maxIterations: 5,
  });

  // 3. Send message and stream events
  const messages = [
    { role: 'user' as const, content: 'Show me all tables in the database' },
  ];

  console.log('Starting chat with narrative streaming...\n');

  for await (const event of chatService.sendMessageWithNarrative(messages)) {
    switch (event.type) {
      case 'narrative':
        // Narrative chunks explaining what's happening
        process.stdout.write(event.content);
        break;

      case 'content':
        // Assistant's response content
        process.stdout.write(event.content);
        break;

      case 'tool_call':
        // Tool is being called
        console.log(`\n[Tool Call: ${event.toolCall.name}]`);
        break;

      case 'tool_result':
        // Tool execution completed
        console.log(`\n[Tool Result: ${event.result.isError ? 'Error' : 'Success'}]`);
        break;

      case 'iteration_update':
        // Autonomous retry in progress
        console.log(`\n[Iteration ${event.iteration}/${event.maxIterations}]`);
        break;

      case 'error':
        // Error occurred
        console.error(`\n[Error: ${event.error}]`);
        break;

      case 'done':
        // Streaming completed
        console.log(`\n[Done: ${event.finishReason}]`);
        break;
    }
  }
}

/**
 * Example: ChatService with custom event handlers
 * 
 * Demonstrates Requirements 17.1, 17.2, 17.5
 */
export async function customEventHandlersExample() {
  // Create model adapter
  const modelAdapter = new OCIModelAdapter({
    provider: ociProvider,
    modelId: 'cohere.command-r-plus',
    temperature: 0,
    maxTokens: 4000,
    conversationId: 'custom-handlers-example',
  });

  // Create chat service
  const chatService = createChatService(modelAdapter, narrativeStreamingService);

  // Register custom event handlers
  chatService.registerEventHandlers({
    // Custom pre-tool narrative (Requirement 17.1)
    onToolCall: async function* (toolCall: ToolCall) {
      yield `\n🔧 Executing ${toolCall.name}...\n`;
      
      // Add custom logic based on tool type
      if (toolCall.name.includes('query')) {
        yield 'This query will search the database for matching records.\n';
      } else if (toolCall.name.includes('list')) {
        yield 'Fetching the list of available items.\n';
      }
    },

    // Custom post-step narrative (Requirement 17.2)
    onStepFinish: async function* (step) {
      if (step.status === 'completed') {
        yield `\n✅ Step completed successfully in ${step.duration}ms\n`;
      } else if (step.status === 'failed') {
        yield `\n❌ Step failed, will retry with different approach\n`;
      }
    },

    // Custom error narrative (Requirement 17.5)
    onError: async function* (error: Error) {
      yield `\n⚠️ Encountered issue: ${error.message}\n`;
      yield 'Don\'t worry, I\'ll try a different approach.\n';
    },
  });

  // Update conversation context for better narratives
  chatService.updateContext({
    currentGoal: 'Analyze database schema and query data',
    previousMessages: [
      { role: 'user', content: 'I need to analyze the database' },
    ],
  });

  // Send message with custom handlers
  const messages = [
    { role: 'user' as const, content: 'Show me the database schema' },
  ];

  console.log('Starting chat with custom event handlers...\n');

  for await (const event of chatService.sendMessageWithNarrative(messages)) {
    // Handle events as needed
    if (event.type === 'narrative') {
      process.stdout.write(event.content);
    } else if (event.type === 'content') {
      process.stdout.write(event.content);
    }
  }
}

/**
 * Example: Integration with API route
 * 
 * Shows how to use ChatService in a Next.js API route with SSE streaming
 */
export async function apiRouteIntegrationExample(
  messages: Array<{ role: string; content: string }>,
  modelId: string,
  conversationId: string
) {
  // Create model adapter
  const modelAdapter = new OCIModelAdapter({
    provider: ociProvider,
    modelId,
    temperature: 0,
    maxTokens: 4000,
    conversationId,
  });

  // Create chat service
  const chatService = createChatService(modelAdapter, narrativeStreamingService, {
    systemPrompt: ENHANCED_SYSTEM_PROMPT,
    maxIterations: 5,
  });

  // Register event handlers for logging and monitoring
  chatService.registerEventHandlers({
    onToolCall: async function* (toolCall: ToolCall) {
      console.log(`[API] Tool call: ${toolCall.name}`, toolCall.arguments);
      // Custom narrative can be added here
    },

    onError: async function* (error: Error) {
      console.error(`[API] Error occurred:`, error);
      // Custom error handling can be added here
    },
  });

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Stream events from chat service
        for await (const event of chatService.sendMessageWithNarrative(
          messages as Array<{ role: 'user' | 'assistant' | 'system' | 'tool'; content: string }>,
          {
            // Add tools/toolsets as needed
            maxSteps: 15,
          }
        )) {
          // Convert to SSE format
          const sseData = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
        }

        controller.close();
      } catch (error) {
        console.error('[API] Stream error:', error);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ 
            type: 'error', 
            error: error instanceof Error ? error.message : 'Unknown error' 
          })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * Example: Autonomous iteration with progress tracking
 * 
 * Demonstrates how iteration_update events work during autonomous retries
 */
export async function autonomousIterationExample() {
  const modelAdapter = new OCIModelAdapter({
    provider: ociProvider,
    modelId: 'cohere.command-r-plus',
    temperature: 0,
    maxTokens: 4000,
    conversationId: 'iteration-example',
  });

  const chatService = createChatService(modelAdapter, narrativeStreamingService, {
    maxIterations: 5,
  });

  const messages = [
    { role: 'user' as const, content: 'Find data in the database' },
  ];

  let iterationCount = 0;

  for await (const event of chatService.sendMessageWithNarrative(messages)) {
    if (event.type === 'iteration_update') {
      iterationCount = event.iteration;
      console.log(`\n[Progress] Attempt ${event.iteration} of ${event.maxIterations}`);
      
      // Show progress indicator
      const progress = '█'.repeat(event.iteration) + '░'.repeat(event.maxIterations - event.iteration);
      console.log(`[${progress}] ${Math.round((event.iteration / event.maxIterations) * 100)}%`);
    } else if (event.type === 'narrative') {
      process.stdout.write(event.content);
    }
  }

  console.log(`\n\nCompleted after ${iterationCount} iterations`);
}
