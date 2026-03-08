/**
 * NarrativeStreamingService - CONCISE MODE
 * 
 * Generates SHORT status updates for tool execution.
 * Minimal commentary - let the data speak for itself.
 * 
 * Validates: Requirements 13.1, 13.2, 13.3, 13.6
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
   * Stream brief status before tool execution
   * Validates: Requirement 13.1
   */
  async *streamPreToolNarrative(
    toolName: string,
    toolArgs: Record<string, unknown>,
    context: ConversationContext
  ): AsyncGenerator<string> {
    // Concise mode: no pre-tool narration — let the tool call speak for itself
    // The UI shows tool call badges; we don't need text commentary too
    return;
  }

  /**
   * Stream minimal commentary after tool execution
   * Validates: Requirement 13.2
   */
  async *streamPostToolNarrative(
    toolName: string,
    toolResult: unknown,
    context: ConversationContext
  ): AsyncGenerator<string> {
    // Concise mode: no post-tool narration
    // The agent's final text response summarizes findings; we don't double-up
    return;
  }

  /**
   * Stream brief error message
   * Validates: Requirement 13.3
   */
  async *streamErrorNarrative(
    error: Error,
    attemptCount: number,
    nextAction: string
  ): AsyncGenerator<string> {
    yield `Error: ${error.message}. Trying alternative approach...\n\n`;
  }

  /**
   * Stream transition narrative (disabled in concise mode)
   * Validates: Requirement 13.6
   */
  async *streamTransitionNarrative(
    fromStep: string,
    toStep: string,
    reasoning: string
  ): AsyncGenerator<string> {
    // Concise mode: skip transitions
    return;
  }

  /**
   * Format tool name into short action description
   */
  private formatToolAction(toolName: string): string {
    const actionMap: Record<string, string> = {
      'list_connections': 'Listing databases',
      'connect': 'Connecting',
      'run_sql': 'Running query',
      'run_query': 'Running query',
      'execute_query': 'Running query',
      'list_tables': 'Checking tables',
      'describe_table': 'Checking schema',
      'get_schema': 'Checking schema',
      'schema_information': 'Checking schema',
      'disconnect': 'Disconnecting',
    };
    
    const lowerName = toolName.toLowerCase();
    
    if (actionMap[lowerName]) {
      return actionMap[lowerName];
    }
    
    for (const [key, value] of Object.entries(actionMap)) {
      if (lowerName.includes(key)) {
        return value;
      }
    }
    
    return toolName.charAt(0).toUpperCase() + toolName.slice(1).replace(/_/g, ' ');
  }

  /**
   * Analyze tool result
   */
  private analyzeResult(result: unknown): {
    isEmpty: boolean;
    isError: boolean;
    isArray: boolean;
    count: number;
    hasData: boolean;
  } {
    if (result === null || result === undefined) {
      return { isEmpty: true, isError: false, isArray: false, count: 0, hasData: false };
    }
    
    if (Array.isArray(result)) {
      return {
        isEmpty: result.length === 0,
        isError: false,
        isArray: true,
        count: result.length,
        hasData: result.length > 0,
      };
    }
    
    if (typeof result === 'object') {
      const keys = Object.keys(result);
      return {
        isEmpty: keys.length === 0,
        isError: 'error' in result || 'message' in result,
        isArray: false,
        count: keys.length,
        hasData: keys.length > 0,
      };
    }
    
    return {
      isEmpty: false,
      isError: false,
      isArray: false,
      count: 1,
      hasData: true,
    };
  }
}

// Export singleton instance
export const narrativeStreamingService = new NarrativeStreamingService();
