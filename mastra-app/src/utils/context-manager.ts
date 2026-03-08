/**
 * Context Window Manager
 * Manages conversation context to prevent exceeding model token limits.
 */

import { Message } from '@/types';

interface ModelLimits {
  maxTokens: number;
  reserveTokens: number; // Reserve for system prompt and response
}

// Model-specific token limits
const MODEL_LIMITS: Record<string, ModelLimits> = {
  // Google Gemini models
  'google.gemini-2.5-flash': { maxTokens: 1000000, reserveTokens: 10000 },
  'google.gemini-2.5-flash-lite': { maxTokens: 1000000, reserveTokens: 10000 },
  'google.gemini-2.5-pro': { maxTokens: 1000000, reserveTokens: 10000 },
  
  // xAI Grok models
  'xai.grok-3': { maxTokens: 131072, reserveTokens: 10000 },
  'xai.grok-3-fast': { maxTokens: 131072, reserveTokens: 10000 },
  'xai.grok-3-mini': { maxTokens: 131072, reserveTokens: 10000 },
  'xai.grok-3-mini-fast': { maxTokens: 131072, reserveTokens: 10000 },
  'xai.grok-4': { maxTokens: 131072, reserveTokens: 10000 },
  'xai.grok-4-1-fast-non-reasoning': { maxTokens: 131072, reserveTokens: 10000 },
  
  // Cohere models
  'cohere.command-r-plus': { maxTokens: 128000, reserveTokens: 10000 },
  'cohere.command-r-plus-08-2024': { maxTokens: 128000, reserveTokens: 10000 },
  'cohere.command-r-08-2024': { maxTokens: 128000, reserveTokens: 10000 },
  'cohere.command-r-16k': { maxTokens: 16000, reserveTokens: 2000 },
  
  // Meta Llama models
  'meta.llama-3.1-405b-instruct': { maxTokens: 128000, reserveTokens: 10000 },
  'meta.llama-3.1-70b-instruct': { maxTokens: 128000, reserveTokens: 10000 },
};

// Default limits for unknown models
const DEFAULT_LIMITS: ModelLimits = { maxTokens: 128000, reserveTokens: 10000 };

/**
 * Estimate token count for a message.
 * Uses a simple heuristic: ~4 characters per token.
 */
function estimateTokens(message: Message): number {
  let tokens = 0;
  
  // Content tokens
  if (message.content) {
    tokens += Math.ceil(message.content.length / 4);
  }
  
  // Tool calls tokens
  if (message.toolCalls) {
    const toolCallsStr = JSON.stringify(message.toolCalls);
    tokens += Math.ceil(toolCallsStr.length / 4);
  }
  
  // Tool narratives tokens
  if (message.toolNarratives) {
    const narrativesStr = JSON.stringify(message.toolNarratives);
    tokens += Math.ceil(narrativesStr.length / 4);
  }
  
  return tokens;
}

/**
 * Trim conversation history to fit within model's context window.
 * Keeps the most recent messages and always preserves the last user message.
 */
export function trimConversationHistory(
  messages: Message[],
  modelId: string
): Message[] {
  const limits = MODEL_LIMITS[modelId] || DEFAULT_LIMITS;
  const maxContextTokens = limits.maxTokens - limits.reserveTokens;
  
  // If no messages, return empty
  if (messages.length === 0) {
    return [];
  }
  
  // Calculate total tokens
  let totalTokens = 0;
  const messageTokens: number[] = [];
  
  for (const message of messages) {
    const tokens = estimateTokens(message);
    messageTokens.push(tokens);
    totalTokens += tokens;
  }
  
  // If within limit, return all messages
  if (totalTokens <= maxContextTokens) {
    return messages;
  }
  
  console.log(`[ContextManager] Total tokens (${totalTokens}) exceeds limit (${maxContextTokens}). Trimming...`);
  
  // Keep messages from the end until we hit the limit
  const trimmedMessages: Message[] = [];
  let currentTokens = 0;
  
  // Always keep the last message (current user message)
  for (let i = messages.length - 1; i >= 0; i--) {
    const tokens = messageTokens[i];
    
    if (currentTokens + tokens > maxContextTokens) {
      // If this is the last message, keep it anyway
      if (i === messages.length - 1) {
        trimmedMessages.unshift(messages[i]);
        currentTokens += tokens;
      }
      break;
    }
    
    trimmedMessages.unshift(messages[i]);
    currentTokens += tokens;
  }
  
  console.log(`[ContextManager] Trimmed from ${messages.length} to ${trimmedMessages.length} messages (${currentTokens} tokens)`);
  
  return trimmedMessages;
}

/**
 * Check if conversation is approaching context limit.
 * Returns true if > 80% of context is used.
 */
export function isApproachingContextLimit(
  messages: Message[],
  modelId: string
): boolean {
  const limits = MODEL_LIMITS[modelId] || DEFAULT_LIMITS;
  const maxContextTokens = limits.maxTokens - limits.reserveTokens;
  
  let totalTokens = 0;
  for (const message of messages) {
    totalTokens += estimateTokens(message);
  }
  
  return totalTokens > maxContextTokens * 0.8;
}

/**
 * Get context usage statistics.
 */
export function getContextStats(
  messages: Message[],
  modelId: string
): {
  totalTokens: number;
  maxTokens: number;
  usagePercent: number;
  messagesCount: number;
} {
  const limits = MODEL_LIMITS[modelId] || DEFAULT_LIMITS;
  const maxContextTokens = limits.maxTokens - limits.reserveTokens;
  
  let totalTokens = 0;
  for (const message of messages) {
    totalTokens += estimateTokens(message);
  }
  
  return {
    totalTokens,
    maxTokens: maxContextTokens,
    usagePercent: (totalTokens / maxContextTokens) * 100,
    messagesCount: messages.length,
  };
}
