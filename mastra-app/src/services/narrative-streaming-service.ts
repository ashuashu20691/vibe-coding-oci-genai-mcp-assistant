/**
 * NarrativeStreamingService
 * 
 * Generates brief, Claude Desktop-style status text between tool calls.
 * Shows what the agent is doing and what it found — concise, not verbose.
 */

export interface ConversationContext {
  previousMessages: Array<{ role: string; content: string }>;
  currentGoal: string;
  attemptHistory: AttemptRecord[];
}

export interface AttemptRecord {
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
  success: boolean;
  timestamp: Date;
}

export class NarrativeStreamingService {
  /**
   * Brief status before tool execution — one line explaining what we're about to do
   */
  async *streamPreToolNarrative(
    toolName: string,
    toolArgs: Record<string, unknown>,
    _context: ConversationContext
  ): AsyncGenerator<string> {
    const action = this.describeAction(toolName, toolArgs);
    if (action) {
      yield `${action}\n\n`;
    }
  }

  /**
   * Brief status after tool execution — one line summarizing what we found
   */
  async *streamPostToolNarrative(
    toolName: string,
    toolResult: unknown,
    _context: ConversationContext
  ): AsyncGenerator<string> {
    const summary = this.summarizeResult(toolName, toolResult);
    if (summary) {
      yield `${summary}\n\n`;
    }
  }

  /**
   * Error narrative
   */
  async *streamErrorNarrative(
    error: Error,
    _attemptCount: number,
    _nextAction: string
  ): AsyncGenerator<string> {
    yield `Error: ${error.message}. Trying alternative approach...\n\n`;
  }

  /**
   * Transition narrative (unused)
   */
  async *streamTransitionNarrative(
    _fromStep: string,
    _toStep: string,
    _reasoning: string
  ): AsyncGenerator<string> {
    return;
  }

  /**
   * Describe what we're about to do — one short sentence
   */
  private describeAction(toolName: string, args: Record<string, unknown>): string {
    const lower = toolName.toLowerCase();

    if (lower.includes('list_connection') || lower.includes('list_db')) {
      return 'Checking available databases...';
    }
    if (lower.includes('connect')) {
      const db = args.connection_name || args.database || '';
      return db ? `Connecting to ${db}...` : 'Connecting to database...';
    }
    if (lower.includes('disconnect')) {
      return 'Disconnecting...';
    }
    if (lower.includes('run_sql') || lower.includes('run_query') || lower.includes('execute')) {
      const sql = String(args.sql || args.query || '').trim();
      if (sql) {
        // Show first 80 chars of the query
        const preview = sql.length > 80 ? sql.slice(0, 80) + '...' : sql;
        return `Running query: \`${preview}\``;
      }
      return 'Running SQL query...';
    }
    if (lower.includes('schema') || lower.includes('describe') || lower.includes('list_table')) {
      return 'Checking database schema...';
    }

    return '';
  }

  /**
   * Summarize what a tool result contains — one short sentence
   */
  private summarizeResult(toolName: string, result: unknown): string {
    const lower = toolName.toLowerCase();

    // Extract text content from MCP-style results
    const text = this.extractText(result);

    if (lower.includes('list_connection') || lower.includes('list_db')) {
      // Count connections mentioned
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length > 1) {
        return `Found ${lines.length - 1} database connections.`;
      }
      return '';
    }

    if (lower.includes('connect')) {
      if (text.toLowerCase().includes('success') || text.toLowerCase().includes('connected')) {
        return 'Connected successfully.';
      }
      if (text.toLowerCase().includes('error') || text.toLowerCase().includes('fail')) {
        return 'Connection failed.';
      }
      return '';
    }

    if (lower.includes('run_sql') || lower.includes('run_query') || lower.includes('execute')) {
      // Try to detect row count
      const rowMatch = text.match(/(\d+)\s*rows?\s*(selected|returned|fetched|affected)/i);
      if (rowMatch) {
        return `Got ${rowMatch[1]} rows.`;
      }
      // Check for tabular data
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length > 2) {
        return `Got ${lines.length - 1} rows of data.`;
      }
      if (text.toLowerCase().includes('no rows') || text.toLowerCase().includes('0 rows')) {
        return 'Query returned no results.';
      }
      // Only detect actual SQL errors, not just the word "error" in data
      // Check for Oracle error codes (ORA-), SQL error keywords at start of lines, or explicit error messages
      if (/\bORA-\d+/i.test(text) || /^(error|failed|exception):/im.test(text) || /\berror\s*:\s*/i.test(text)) {
        return 'Query returned an error.';
      }
      return '';
    }

    if (lower.includes('schema') || lower.includes('describe') || lower.includes('list_table')) {
      return 'Got schema information.';
    }

    return '';
  }

  /**
   * Extract readable text from various result formats
   */
  private extractText(result: unknown): string {
    if (typeof result === 'string') return result;
    if (!result || typeof result !== 'object') return '';

    // MCP-style: { content: [{ text: "..." }] }
    const obj = result as Record<string, unknown>;
    if (Array.isArray(obj.content)) {
      return obj.content
        .map((c: unknown) => {
          if (typeof c === 'string') return c;
          if (c && typeof c === 'object' && 'text' in (c as Record<string, unknown>)) {
            return String((c as Record<string, unknown>).text);
          }
          return '';
        })
        .join('\n');
    }
    if (typeof obj.text === 'string') return obj.text;
    if (typeof obj.result === 'string') return obj.result;

    try {
      return JSON.stringify(result).slice(0, 500);
    } catch {
      return '';
    }
  }
}

// Export singleton instance
export const narrativeStreamingService = new NarrativeStreamingService();
