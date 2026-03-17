/**
 * Utility for reconstructing contentParts array from message data
 * 
 * This is used when loading conversations from history, where messages
 * from the database lack the contentParts array that is only populated
 * during streaming.
 * 
 * Validates: Requirements 2.1, 2.2
 */

import { Message, ToolCall } from '@/types';

/**
 * Reconstructs the contentParts array for a message based on its content and toolCalls
 * 
 * Heuristic: Tool calls typically follow the text that requested them.
 * During streaming, contentParts is built incrementally as text and tool calls arrive.
 * When loading from history, we reconstruct this by placing text first, then tool calls.
 * 
 * @param message - The message to reconstruct contentParts for
 * @returns The message with contentParts reconstructed (if applicable)
 */
export function reconstructContentParts<T extends Message>(message: T): T {
  // Only reconstruct for assistant messages with tool calls
  if (message.role !== 'assistant') {
    return message;
  }
  
  // If contentParts already exists, don't reconstruct
  if (message.contentParts && message.contentParts.length > 0) {
    return message;
  }
  
  // If there are tool calls, reconstruct contentParts
  if (message.toolCalls && message.toolCalls.length > 0) {
    const contentParts: Array<
      | { type: 'text'; text: string }
      | { type: 'tool'; toolCall: ToolCall }
    > = [];
    
    const content = message.content || '';
    
    // Add text content first (if any)
    if (content.trim()) {
      contentParts.push({ type: 'text', text: content });
    }
    
    // Add all tool calls after the text
    // During streaming, tool calls are appended as they execute
    for (const toolCall of message.toolCalls) {
      contentParts.push({ type: 'tool', toolCall });
    }
    
    return {
      ...message,
      contentParts,
    };
  }
  
  // For text-only assistant messages, create simple contentParts
  if (message.content) {
    return {
      ...message,
      contentParts: [{ type: 'text', text: message.content }],
    };
  }
  
  // No reconstruction needed
  return message;
}

/**
 * Reconstructs contentParts for an array of messages
 * 
 * @param messages - Array of messages to process
 * @returns Array of messages with contentParts reconstructed
 */
export function reconstructContentPartsForMessages<T extends Message>(messages: T[]): T[] {
  return messages.map(reconstructContentParts);
}
