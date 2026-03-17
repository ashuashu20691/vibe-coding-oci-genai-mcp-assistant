/**
 * Utility for reconstructing contentParts array from message data
 * 
 * This is used when loading conversations from history, where messages
 * from the database lack the contentParts array that is only populated
 * during streaming.
 * 
 * Validates: Requirements 2.1, 2.2
 */

import { Message, ToolCall, ToolNarrative } from '@/types';

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'tool'; toolCall: ToolCall };

/**
 * Reconstructs the contentParts array for a message when loading from history.
 *
 * During live streaming, contentParts is built incrementally with proper
 * text → tool → text interleaving. When loading from history the original
 * interleaving order is lost (DB stores final concatenated text + tool call
 * list separately).
 *
 * Strategy:
 * 1. For each tool call, predict the narrative text that was generated before it
 *    (using the same logic as NarrativeStreamingService). Find that text in the
 *    content and insert the tool badge right after it.
 * 2. If prediction fails, try using saved toolNarratives from the DB.
 * 3. If neither works, put all tool calls after the text (best-effort fallback).
 */
export function reconstructContentParts<T extends Message>(message: T): T {
  if (message.role !== 'assistant') return message;
  if (message.contentParts && message.contentParts.length > 0) return message;
  if (!message.content) return message;

  const content = message.content;
  const toolCalls = message.toolCalls;

  // No tool calls at all → simple text-only
  if (!toolCalls || toolCalls.length === 0) {
    return {
      ...message,
      contentParts: [{ type: 'text' as const, text: content }],
    };
  }

  // Try to reconstruct interleaving by finding narrative markers in content
  const parts = reconstructByNarrativeMarkers(content, toolCalls, message.toolNarratives);
  return { ...message, contentParts: parts };
}

/**
 * Predict possible pre-tool narrative texts for a given tool call.
 * Mirrors the logic in NarrativeStreamingService.describeAction().
 * Returns multiple candidates to increase matching chances.
 */
function predictNarratives(toolName: string, args: Record<string, unknown>): string[] {
  const lower = toolName.toLowerCase();
  const candidates: string[] = [];

  if (lower.includes('list_connection') || lower.includes('list_db')) {
    candidates.push('Checking available databases...');
  }
  if (lower.includes('connect') && !lower.includes('disconnect') && !lower.includes('list')) {
    const db = args.connection_name || args.database || '';
    if (db) candidates.push(`Connecting to ${db}...`);
    candidates.push('Connecting to database...');
  }
  if (lower.includes('disconnect')) {
    candidates.push('Disconnecting...');
  }
  if (lower.includes('run_sql') || lower.includes('run_query') || lower.includes('execute')) {
    const sql = String(args.sql || args.query || '').trim();
    if (sql) {
      const preview = sql.length > 80 ? sql.slice(0, 80) + '...' : sql;
      candidates.push(`Running query: \`${preview}\``);
    }
    // Always include the fallback
    candidates.push('Running SQL query...');
  }
  if (lower.includes('schema') || lower.includes('describe') || lower.includes('list_table')) {
    candidates.push('Checking database schema...');
  }

  return candidates;
}

/**
 * Reconstruct interleaved contentParts by finding narrative markers in content.
 * 
 * For each tool call, we try (in order):
 * 1. Predicted narrative text (from tool name + args)
 * 2. Saved narrative from toolNarratives DB field
 * 
 * If we find the marker, we insert the tool badge right after it.
 * Tool calls without markers are appended at the end.
 */
function reconstructByNarrativeMarkers(
  content: string,
  toolCalls: ToolCall[],
  narratives?: ToolNarrative[],
): ContentPart[] {
  // Build narrative lookup from DB
  const savedNarratives = new Map<string, string>();
  if (narratives) {
    for (const n of narratives) {
      if (n.phase === 'start' && n.narrative) {
        savedNarratives.set(n.toolCallId, n.narrative.trim());
      }
    }
  }

  interface InsertionPoint {
    position: number;
    toolCall: ToolCall;
  }

  const insertions: InsertionPoint[] = [];
  let searchFrom = 0;

  for (const tc of toolCalls) {
    let found = false;

    // Try predicted narrative candidates first (most reliable)
    const candidates = predictNarratives(tc.name, tc.arguments || {});
    for (const candidate of candidates) {
      if (found) break;
      const idx = content.indexOf(candidate, searchFrom);
      if (idx !== -1) {
        const insertPos = idx + candidate.length;
        insertions.push({ position: insertPos, toolCall: tc });
        searchFrom = insertPos;
        found = true;
      }
    }

    // Try saved narrative if prediction didn't work
    if (!found) {
      const saved = savedNarratives.get(tc.id);
      if (saved) {
        const idx = content.indexOf(saved, searchFrom);
        if (idx !== -1) {
          const insertPos = idx + saved.length;
          insertions.push({ position: insertPos, toolCall: tc });
          searchFrom = insertPos;
          found = true;
        }
      }
    }
  }

  // If no insertions found at all, fall back to text + tools at end
  if (insertions.length === 0) {
    const parts: ContentPart[] = [];
    if (content.trim()) {
      parts.push({ type: 'text' as const, text: content });
    }
    for (const tc of toolCalls) {
      parts.push({ type: 'tool' as const, toolCall: tc });
    }
    return parts;
  }

  // Sort by position
  insertions.sort((a, b) => a.position - b.position);

  // Split content at insertion points and interleave tool badges
  const parts: ContentPart[] = [];
  let lastPos = 0;

  for (const ins of insertions) {
    const textBefore = content.slice(lastPos, ins.position);
    if (textBefore.trim()) {
      parts.push({ type: 'text' as const, text: textBefore });
    }
    parts.push({ type: 'tool' as const, toolCall: ins.toolCall });
    lastPos = ins.position;
  }

  // Remaining text after the last tool badge
  const remaining = content.slice(lastPos);
  if (remaining.trim()) {
    parts.push({ type: 'text' as const, text: remaining });
  }

  // Append tool calls that couldn't be positioned
  const insertedIds = new Set(insertions.map(i => i.toolCall.id));
  for (const tc of toolCalls) {
    if (!insertedIds.has(tc.id)) {
      parts.push({ type: 'tool' as const, toolCall: tc });
    }
  }

  return parts;
}

/**
 * Reconstructs contentParts for an array of messages
 */
export function reconstructContentPartsForMessages<T extends Message>(messages: T[]): T[] {
  return messages.map(reconstructContentParts);
}
