/**
 * ChatService
 * 
 * Enhanced service that integrates narrative streaming with Mastra's event system.
 * Coordinates tool execution with conversational explanations, creating a Claude Desktop-like
 * experience where the AI explains its reasoning before and after every action.
 * 
 * Key Features:
 * - Event-driven architecture using Mastra's onToolCall, onStepFinish, onError events
 * - Integrates NarrativeStreamingService for conversational explanations
 * - Emits enhanced stream events with narrative content
 * - Manages iteration state for autonomous retry logic
 * 
 * Validates: Requirements 17.1, 17.2, 17.4, 17.5
 */

import { OCIModelAdapter, GenerateOptions, StepResult } from '@/mastra/providers/oci-model-adapter';
import { ChatMessage } from '@/mastra/providers/oci-genai';
import { ToolCall } from '@/types';
import { 
  NarrativeStreamingService, 
  ConversationContext,
} from './narrative-streaming-service';
import { ENHANCED_SYSTEM_PROMPT } from './system-prompts';

/**
 * Enhanced stream event that includes narrative content
 */
export type EnhancedStreamEvent = 
  | { type: 'narrative'; content: string }
  | { type: 'content'; content: string }
  | { type: 'tool_call'; toolCall: ToolCall; narrative: string }
  | { type: 'tool_result'; result: ToolResult; narrative: string }
  | { type: 'iteration_update'; iteration: number; maxIterations: number }
  | { type: 'error'; error: string; narrative: string }
  | { type: 'done'; finishReason: string };

export interface ToolResult {
  toolCallId: string;
  content: unknown;
  isError: boolean;
  errorMessage?: string;
  duration?: number;
}

export interface ProcessingStep {
  name: string;
  status: 'started' | 'completed' | 'failed';
  duration?: number;
  result?: unknown;
}

/**
 * Event handlers for narrative streaming integration
 */
export interface EventHandlers {
  onToolCall?: (toolCall: ToolCall) => AsyncGenerator<string>;
  onStepFinish?: (step: ProcessingStep) => AsyncGenerator<string>;
  onError?: (error: Error) => AsyncGenerator<string>;
}

/**
 * ChatService configuration
 */
export interface ChatServiceConfig {
  modelAdapter: OCIModelAdapter;
  narrativeService: NarrativeStreamingService;
  systemPrompt?: string;
  maxIterations?: number;
}

/**
 * Enhanced ChatService with event-driven narrative streaming
 * 
 * Validates: Requirements 17.1, 17.2, 17.4, 17.5
 */
export class ChatService {
  private modelAdapter: OCIModelAdapter;
  private narrativeService: NarrativeStreamingService;
  private systemPrompt: string;
  private maxIterations: number;
  private eventHandlers: EventHandlers;
  private conversationContext: ConversationContext;

  constructor(config: ChatServiceConfig) {
    this.modelAdapter = config.modelAdapter;
    this.narrativeService = config.narrativeService;
    this.systemPrompt = config.systemPrompt || '';
    this.maxIterations = config.maxIterations || 5;
    this.eventHandlers = {};
    this.conversationContext = {
      previousMessages: [],
      currentGoal: '',
      attemptHistory: [],
    };
  }

  /**
   * Register event handlers for narrative streaming
   * 
   * @param handlers - Event handlers for tool calls, step completion, and errors
   * 
   * Validates: Requirement 17.4
   */
  registerEventHandlers(handlers: EventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Set system prompt for the agent
   * 
   * @param prompt - System prompt to guide agent behavior
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  /**
   * Update conversation context for narrative generation
   * 
   * @param context - Updated conversation context
   */
  updateContext(context: Partial<ConversationContext>): void {
    this.conversationContext = {
      ...this.conversationContext,
      ...context,
    };
  }

  /**
   * Send message with narrative streaming integration
   * 
   * Streams enhanced events that include:
   * - Pre-tool narratives (explaining intent before execution)
   * - Post-tool narratives (interpreting results after execution)
   * - Error narratives (explaining failures and recovery plans)
   * - Iteration updates (tracking autonomous retry attempts)
   * 
   * @param messages - Conversation messages
   * @param options - Generation options (tools, maxSteps, etc.)
   * @returns AsyncGenerator yielding enhanced stream events
   * 
   * Validates: Requirements 17.1, 17.2, 17.5
   */
  async *sendMessageWithNarrative(
    messages: ChatMessage[],
    options: GenerateOptions = {}
  ): AsyncGenerator<EnhancedStreamEvent> {
    // Prepend system prompt if configured
    const messagesWithSystem = this.systemPrompt
      ? [{ role: 'system' as const, content: this.systemPrompt }, ...messages]
      : messages;
    // Track tool calls and results for narrative context
    const toolCallsInStep: ToolCall[] = [];
    const toolResultsInStep: Array<{ toolCallId: string; result: unknown }> = [];
    let currentIteration = 0;

    // Register onStepFinish handler to track iterations and generate post-tool narratives
    const originalOnStepFinish = options.onStepFinish;
    options.onStepFinish = async (step: StepResult) => {
      // Call original handler if provided
      if (originalOnStepFinish) {
        originalOnStepFinish(step);
      }

      // Track iteration count
      currentIteration++;

      // Generate post-tool narratives for completed tools
      // Validates: Requirement 17.2
      if (step.toolCalls.length > 0 && step.toolResults.length > 0) {
        for (let i = 0; i < step.toolCalls.length; i++) {
          const toolCall = step.toolCalls[i];
          const toolResult = step.toolResults[i];

          if (toolResult) {
            // Stream post-tool narrative using NarrativeStreamingService
            const narrative = this.narrativeService.streamPostToolNarrative(
              toolCall.name,
              toolResult.result,
              this.conversationContext
            );

            let fullNarrative = '';
            for await (const chunk of narrative) {
              fullNarrative += chunk;
            }

            // Record attempt in history
            this.conversationContext.attemptHistory.push({
              toolName: toolCall.name,
              args: toolCall.arguments || {},
              result: toolResult.result,
              success: !this.isErrorResult(toolResult.result),
              timestamp: new Date(),
            });
          }
        }
      }

      // Call custom onStepFinish handler if registered
      // Validates: Requirement 17.4
      if (this.eventHandlers.onStepFinish) {
        const processingStep: ProcessingStep = {
          name: step.toolCalls.length > 0 ? step.toolCalls[0].name : 'unknown',
          status: 'completed',
          result: step.toolResults.length > 0 ? step.toolResults[0].result : undefined,
        };
        
        // Note: Custom handler narrative is not yielded here because this is a callback
        // The handler can be used for side effects or logging
        const customNarrative = this.eventHandlers.onStepFinish(processingStep);
        for await (const _chunk of customNarrative) {
          // Consume the generator but don't yield (callback context)
        }
      }

      // Emit iteration update if in autonomous loop
      if (currentIteration > 1 && currentIteration <= this.maxIterations) {
        // This is an autonomous retry - emit iteration update
        // Note: We don't yield here because this is a callback
        // The iteration update will be emitted in the main stream loop
      }
    };

    try {
      // Stream from model adapter with enhanced event handling
      for await (const chunk of this.modelAdapter.stream(messagesWithSystem, options)) {
        switch (chunk.type) {
          case 'text-delta':
            // Pass through text content
            if (chunk.textDelta) {
              yield {
                type: 'content',
                content: chunk.textDelta,
              };
            }
            break;

          case 'tool-call':
            if (chunk.toolCall) {
              toolCallsInStep.push(chunk.toolCall);

              // Generate pre-tool narrative
              // Validates: Requirement 17.1
              const preNarrative = this.narrativeService.streamPreToolNarrative(
                chunk.toolCall.name,
                chunk.toolCall.arguments || {},
                this.conversationContext
              );

              let fullPreNarrative = '';
              for await (const narrativeChunk of preNarrative) {
                fullPreNarrative += narrativeChunk;
                // Stream narrative as it's generated
                yield {
                  type: 'narrative',
                  content: narrativeChunk,
                };
              }

              // Emit tool call event with narrative
              yield {
                type: 'tool_call',
                toolCall: chunk.toolCall,
                narrative: fullPreNarrative,
              };

              // Call custom onToolCall handler if registered
              if (this.eventHandlers.onToolCall) {
                const customNarrative = this.eventHandlers.onToolCall(chunk.toolCall);
                for await (const narrativeChunk of customNarrative) {
                  yield {
                    type: 'narrative',
                    content: narrativeChunk,
                  };
                }
              }
            }
            break;

          case 'tool-result':
            if (chunk.toolResult) {
              toolResultsInStep.push(chunk.toolResult);

              // Find corresponding tool call
              const toolCall = toolCallsInStep.find(
                tc => tc.id === chunk.toolResult!.toolCallId
              );

              if (toolCall) {
                // Emit tool result event first
                yield {
                  type: 'tool_result',
                  result: {
                    toolCallId: chunk.toolResult.toolCallId,
                    content: chunk.toolResult.result,
                    isError: this.isErrorResult(chunk.toolResult.result),
                  },
                  narrative: '', // Will be filled after streaming
                };

                // Generate post-tool narrative AFTER emitting tool result
                // Validates: Requirement 17.2
                const postNarrative = this.narrativeService.streamPostToolNarrative(
                  toolCall.name,
                  chunk.toolResult.result,
                  this.conversationContext
                );

                let fullPostNarrative = '';
                for await (const narrativeChunk of postNarrative) {
                  fullPostNarrative += narrativeChunk;
                  // Stream narrative as it's generated
                  yield {
                    type: 'narrative',
                    content: narrativeChunk,
                  };
                }

                // Record attempt in history
                this.conversationContext.attemptHistory.push({
                  toolName: toolCall.name,
                  args: toolCall.arguments || {},
                  result: chunk.toolResult.result,
                  success: !this.isErrorResult(chunk.toolResult.result),
                  timestamp: new Date(),
                });
              }
            }
            break;

          case 'error':
            // Generate error narrative
            // Validates: Requirement 17.5
            if (chunk.error) {
              const error = new Error(chunk.error);
              const errorNarrative = this.narrativeService.streamErrorNarrative(
                error,
                currentIteration,
                'trying a different approach'
              );

              let fullErrorNarrative = '';
              for await (const narrativeChunk of errorNarrative) {
                fullErrorNarrative += narrativeChunk;
                // Stream narrative as it's generated
                yield {
                  type: 'narrative',
                  content: narrativeChunk,
                };
              }

              // Emit error event with narrative
              yield {
                type: 'error',
                error: chunk.error,
                narrative: fullErrorNarrative,
              };

              // Call custom onError handler if registered
              if (this.eventHandlers.onError) {
                const customNarrative = this.eventHandlers.onError(error);
                for await (const narrativeChunk of customNarrative) {
                  yield {
                    type: 'narrative',
                    content: narrativeChunk,
                  };
                }
              }

              // Emit iteration update for retry
              currentIteration++;
              if (currentIteration <= this.maxIterations) {
                yield {
                  type: 'iteration_update',
                  iteration: currentIteration,
                  maxIterations: this.maxIterations,
                };
              }
            }
            break;

          case 'finish':
            // Emit completion event
            yield {
              type: 'done',
              finishReason: chunk.finishReason || 'complete',
            };
            break;
        }
      }
    } catch (error) {
      // Handle unexpected errors
      const err = error instanceof Error ? error : new Error(String(error));
      
      // Generate error narrative
      const errorNarrative = this.narrativeService.streamErrorNarrative(
        err,
        currentIteration,
        'recovering from this error'
      );

      let fullErrorNarrative = '';
      for await (const narrativeChunk of errorNarrative) {
        fullErrorNarrative += narrativeChunk;
        yield {
          type: 'narrative',
          content: narrativeChunk,
        };
      }

      yield {
        type: 'error',
        error: err.message,
        narrative: fullErrorNarrative,
      };

      // Call custom onError handler if registered
      if (this.eventHandlers.onError) {
        const customNarrative = this.eventHandlers.onError(err);
        for await (const narrativeChunk of customNarrative) {
          yield {
            type: 'narrative',
            content: narrativeChunk,
          };
        }
      }
    }
  }

  /**
   * Check if a tool result represents an error
   */
  private isErrorResult(result: unknown): boolean {
    if (!result || typeof result !== 'object') {
      return false;
    }

    const resultObj = result as Record<string, unknown>;
    return (
      'error' in resultObj ||
      'isError' in resultObj ||
      ('content' in resultObj && 
        Array.isArray(resultObj.content) && 
        resultObj.content.some((c: unknown) => 
          typeof c === 'object' && c !== null && 'error' in c
        ))
    );
  }
}

/**
 * Factory function to create ChatService with default configuration
 */
export function createChatService(
  modelAdapter: OCIModelAdapter,
  narrativeService: NarrativeStreamingService,
  options: {
    systemPrompt?: string;
    maxIterations?: number;
  } = {}
): ChatService {
  return new ChatService({
    modelAdapter,
    narrativeService,
    systemPrompt: options.systemPrompt,
    maxIterations: options.maxIterations,
  });
}

/**
 * Re-export system prompts for convenience
 */
export { ENHANCED_SYSTEM_PROMPT } from './system-prompts';
