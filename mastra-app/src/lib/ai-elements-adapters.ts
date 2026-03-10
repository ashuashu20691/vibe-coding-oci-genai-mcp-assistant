/**
 * AI Elements Type Adapters
 * 
 * This module provides transformation functions to map existing Message types
 * to AI Elements format for seamless integration with Vercel AI SDK components.
 * 
 * Validates: Requirements 1.1, 1.2, 7.1, 2.1, 2.2, 7.2
 */

import { Message, ToolCall } from '@/types';

/**
 * AI Elements Message format
 * Based on Vercel AI SDK message structure
 */
export interface AIElementsMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: Date;
  
  // AI Elements specific fields
  experimental_attachments?: Array<{
    name: string;
    contentType: string;
    url: string;
  }>;
  
  // Tool invocations
  toolInvocations?: Array<{
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
    state: 'partial-call' | 'call' | 'result' | 'error';
    result?: unknown;
  }>;
}

/**
 * Transform existing Message to AI Elements format
 * 
 * @param message - Existing message object
 * @returns AI Elements compatible message
 */
export function toAIElementsMessage(message: Message): AIElementsMessage {
  const aiMessage: AIElementsMessage = {
    id: message.id,
    role: message.role === 'tool' ? 'assistant' : message.role,
    content: message.content,
    createdAt: message.timestamp,
  };

  // Transform tool calls to AI Elements toolInvocations format
  if (message.toolCalls && message.toolCalls.length > 0) {
    aiMessage.toolInvocations = message.toolCalls.map((toolCall) => ({
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      args: toolCall.arguments,
      state: 'call' as const,
    }));
  }

  // Handle contentParts for ordered rendering
  // AI Elements doesn't have direct contentParts support, so we'll handle this
  // in the component layer by rendering parts in order
  
  return aiMessage;
}

/**
 * Transform AI Elements message back to existing Message format
 * (Useful for persistence and backward compatibility)
 * 
 * @param aiMessage - AI Elements message
 * @returns Existing Message format
 */
export function fromAIElementsMessage(aiMessage: AIElementsMessage): Message {
  const message: Message = {
    id: aiMessage.id,
    role: aiMessage.role,
    content: aiMessage.content,
    timestamp: aiMessage.createdAt || new Date(),
  };

  // Transform toolInvocations back to toolCalls
  if (aiMessage.toolInvocations && aiMessage.toolInvocations.length > 0) {
    message.toolCalls = aiMessage.toolInvocations.map((invocation) => ({
      id: invocation.toolCallId,
      name: invocation.toolName,
      arguments: invocation.args,
    }));
  }

  return message;
}

/**
 * Extract content parts from message for ordered rendering
 * This preserves the Claude Desktop-style interleaving of text and tool calls
 * 
 * @param message - Message with contentParts
 * @returns Array of content parts in order
 */
export function extractContentParts(message: Message): Array<
  | { type: 'text'; text: string }
  | { type: 'tool'; toolCall: ToolCall }
> {
  // If message has contentParts, use them directly
  if (message.contentParts && message.contentParts.length > 0) {
    return message.contentParts;
  }

  // Fallback: create contentParts from message content and toolCalls
  const parts: Array<
    | { type: 'text'; text: string }
    | { type: 'tool'; toolCall: ToolCall }
  > = [];

  // Add text content first
  if (message.content && message.content.trim()) {
    parts.push({ type: 'text', text: message.content });
  }

  // Add tool calls at the end
  if (message.toolCalls && message.toolCalls.length > 0) {
    message.toolCalls.forEach((toolCall) => {
      parts.push({ type: 'tool', toolCall });
    });
  }

  return parts;
}

/**
 * Check if a message has visualization data
 * 
 * @param message - Message to check
 * @returns true if message has visualization
 */
export function hasVisualization(message: Message): boolean {
  return !!(
    message.visualization &&
    (message.visualization.html || 
     message.visualization.data)
  );
}

/**
 * Check if a message has analysis data
 * 
 * @param message - Message to check
 * @returns true if message has analysis
 */
export function hasAnalysis(message: Message): boolean {
  return !!(
    message.analysis &&
    (message.analysis.summary || 
     message.analysis.insights)
  );
}

/**
 * Transform streaming chunk to AI Elements format
 * This handles the various chunk types from the backend
 * 
 * @param chunk - Streaming chunk from backend
 * @returns Partial AI Elements message update
 */
export interface StreamingChunk {
  content?: string;
  toolCall?: ToolCall;
  tool_narrative?: string;
  adaptation?: string;
  progress?: string;
  thinking?: string;
  visualization?: {
    type: string;
    html?: string;
    title?: string;
    data?: Record<string, unknown>[];
    routedToArtifacts?: boolean;
  };
  analysis?: {
    summary?: string;
    insights?: string[];
    statistics?: Record<string, unknown>;
  };
  artifact_update?: unknown;
  iteration_update?: unknown;
  error?: string;
}

export interface AIElementsChunkUpdate {
  type: 'content' | 'tool' | 'visualization' | 'analysis' | 'error';
  content?: string;
  toolInvocation?: {
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
    state: 'partial-call' | 'call' | 'result' | 'error';
  };
  visualization?: StreamingChunk['visualization'];
  analysis?: StreamingChunk['analysis'];
  error?: string;
}

/**
 * Transform streaming chunk to AI Elements update format
 * 
 * @param chunk - Streaming chunk from backend
 * @returns AI Elements chunk update
 */
export function transformStreamingChunk(chunk: StreamingChunk): AIElementsChunkUpdate | null {
  // Content chunk
  if (chunk.content) {
    return {
      type: 'content',
      content: chunk.content,
    };
  }

  // Tool call chunk
  if (chunk.toolCall) {
    return {
      type: 'tool',
      toolInvocation: {
        toolCallId: chunk.toolCall.id,
        toolName: chunk.toolCall.name,
        args: chunk.toolCall.arguments,
        state: 'call',
      },
    };
  }

  // Visualization chunk
  if (chunk.visualization) {
    return {
      type: 'visualization',
      visualization: chunk.visualization,
    };
  }

  // Analysis chunk
  if (chunk.analysis) {
    return {
      type: 'analysis',
      analysis: chunk.analysis,
    };
  }

  // Error chunk
  if (chunk.error) {
    return {
      type: 'error',
      error: chunk.error,
    };
  }

  // Other chunk types (tool_narrative, adaptation, progress, thinking, etc.)
  // are handled as content updates
  if (chunk.tool_narrative || chunk.adaptation || chunk.progress || chunk.thinking) {
    return {
      type: 'content',
      content: chunk.tool_narrative || chunk.adaptation || chunk.progress || chunk.thinking,
    };
  }

  return null;
}

// ============================================
// Tool Execution Type Adapters (Task 3.1)
// Validates: Requirements 2.1, 2.2, 7.2
// ============================================

/**
 * Tool execution status for AI Elements display
 */
export type AIElementsToolStatus = 'pending' | 'executing' | 'completed' | 'failed';

/**
 * AI Elements tool invocation format
 * Maps to the format expected by AI Elements ToolInvocation component
 */
export interface AIElementsToolInvocation {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  state: 'partial-call' | 'call' | 'result' | 'error';
  result?: unknown;
  error?: string;
  executionTime?: number;
}

/**
 * Transform existing ToolCall to AI Elements tool invocation format
 * 
 * @param toolCall - Existing tool call object
 * @param status - Optional execution status
 * @param result - Optional tool execution result
 * @param error - Optional error message
 * @param executionTime - Optional execution time in milliseconds
 * @returns AI Elements tool invocation
 */
export function toAIElementsToolInvocation(
  toolCall: ToolCall,
  status?: AIElementsToolStatus,
  result?: unknown,
  error?: string,
  executionTime?: number
): AIElementsToolInvocation {
  // Map status to AI Elements state
  let state: 'partial-call' | 'call' | 'result' | 'error' = 'call';
  
  if (status === 'pending') {
    state = 'partial-call';
  } else if (status === 'executing') {
    state = 'call';
  } else if (status === 'failed' || error) {
    state = 'error';
  } else if (status === 'completed' && result !== undefined) {
    state = 'result';
  }

  return {
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    args: toolCall.arguments,
    state,
    result,
    error,
    executionTime,
  };
}

/**
 * Transform AI Elements tool invocation back to existing ToolCall format
 * 
 * @param invocation - AI Elements tool invocation
 * @returns Existing ToolCall format
 */
export function fromAIElementsToolInvocation(
  invocation: AIElementsToolInvocation
): ToolCall {
  return {
    id: invocation.toolCallId,
    name: invocation.toolName,
    arguments: invocation.args,
  };
}

/**
 * Format tool name for display
 * Removes common prefixes and formats as human-readable text
 * 
 * @param name - Raw tool name
 * @returns Formatted display name
 */
export function formatToolName(name?: string): string {
  if (!name) return 'Unknown Tool';
  
  return name
    .replace(/^sqlcl_/, '')
    .replace(/^mcp_/, '')
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Format tool arguments for display
 * Converts arguments object to formatted JSON string
 * 
 * @param args - Tool arguments object
 * @returns Formatted JSON string
 */
export function formatToolArguments(args: Record<string, unknown>): string {
  try {
    return JSON.stringify(args, null, 2);
  } catch {
    return String(args);
  }
}

/**
 * Format tool result for display
 * Handles various result types and formats them appropriately
 * 
 * @param result - Tool execution result
 * @returns Formatted result string
 */
export function formatToolResult(result: unknown): string {
  if (result === null || result === undefined) {
    return 'No result';
  }
  
  if (typeof result === 'string') {
    return result;
  }
  
  if (typeof result === 'object') {
    try {
      return JSON.stringify(result, null, 2);
    } catch {
      return String(result);
    }
  }
  
  return String(result);
}

/**
 * Get status class for tool execution display
 * Maps tool status to CSS class name
 * 
 * @param status - Tool execution status
 * @returns CSS class name
 */
export function getToolStatusClass(status: AIElementsToolStatus): string {
  switch (status) {
    case 'pending':
      return 'status-available';
    case 'executing':
      return 'status-available';
    case 'completed':
      return 'status-connected';
    case 'failed':
      return 'status-error';
    default:
      return 'status-available';
  }
}

/**
 * Extract tool narrative from message
 * Tool narratives provide conversational context for tool execution
 * 
 * @param message - Message object
 * @param toolCallId - Tool call ID to find narrative for
 * @returns Tool narrative text or undefined
 */
export function extractToolNarrative(message: Message, toolCallId: string): string | undefined {
  if (!message.toolNarratives) return undefined;
  
  const narrative = message.toolNarratives.find(n => n.toolCallId === toolCallId);
  return narrative?.narrative;
}
