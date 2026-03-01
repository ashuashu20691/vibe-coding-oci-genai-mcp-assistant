/**
 * NarrativeStreamingService
 * 
 * Generates and streams conversational explanations of agent reasoning before and after tool execution.
 * This service transforms technical tool operations into natural, flowing conversation that helps users
 * understand what the AI is doing and why.
 * 
 * Key Features:
 * - Pre-tool narrative: Explains what will be done and why before tool execution
 * - Post-tool narrative: Interprets tool results in natural language
 * - Error narrative: Explains what went wrong and what will be tried next
 * - Transition narrative: Creates smooth logical flow between steps
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
   * Stream conversational explanation before tool execution
   * Explains what the tool will do and why it's being called
   * 
   * @param toolName - Name of the tool being called
   * @param toolArgs - Arguments being passed to the tool
   * @param context - Conversation context for contextual explanations
   * @returns AsyncGenerator yielding narrative chunks
   * 
   * Validates: Requirement 13.1
   */
  async *streamPreToolNarrative(
    toolName: string,
    toolArgs: Record<string, unknown>,
    context: ConversationContext
  ): AsyncGenerator<string> {
    // Generate conversational opening phrases
    const openingPhrases = [
      'Let me check',
      'I\'ll look into',
      'Let me explore',
      'I\'m going to examine',
      'Let me investigate',
    ];
    
    // Select opening based on tool name patterns
    const opening = this.selectOpening(toolName, openingPhrases);
    
    // Format tool name to natural language
    const action = this.formatToolAction(toolName);
    
    // Summarize arguments conversationally
    const argsSummary = this.summarizeArguments(toolArgs);
    
    // Build narrative explaining intent
    const narrative = `${opening} ${action}${argsSummary}...`;
    
    // Stream the narrative character by character for smooth effect
    for (const char of narrative) {
      yield char;
      // Small delay for streaming effect (can be adjusted)
      await this.delay(10);
    }
    
    yield '\n\n';
  }

  /**
   * Stream natural language interpretation of tool results
   * Explains what was found and what it means
   * 
   * @param toolName - Name of the tool that was executed
   * @param toolResult - Result returned by the tool
   * @param context - Conversation context for interpretation
   * @returns AsyncGenerator yielding narrative chunks
   * 
   * Validates: Requirement 13.2
   */
  async *streamPostToolNarrative(
    toolName: string,
    toolResult: unknown,
    context: ConversationContext
  ): AsyncGenerator<string> {
    // Analyze the result to determine narrative approach
    const resultAnalysis = this.analyzeResult(toolResult);
    
    // Generate interpretation based on result type and content
    let narrative = '';
    
    if (resultAnalysis.isEmpty) {
      narrative = this.generateEmptyResultNarrative(toolName, context);
    } else if (resultAnalysis.isError) {
      // This shouldn't happen here (errors go to streamErrorNarrative)
      // but handle gracefully
      narrative = `I encountered an issue with ${this.formatToolAction(toolName)}.`;
    } else {
      narrative = this.generateSuccessNarrative(toolName, toolResult, resultAnalysis, context);
    }
    
    // Stream the narrative
    for (const char of narrative) {
      yield char;
      await this.delay(10);
    }
    
    yield '\n\n';
  }

  /**
   * Stream explanation of errors and recovery plans
   * Explains what went wrong and what alternative approach will be tried
   * 
   * @param error - Error that occurred
   * @param attemptCount - Current attempt number
   * @param nextAction - Description of next action to try
   * @returns AsyncGenerator yielding narrative chunks
   * 
   * Validates: Requirement 13.3
   */
  async *streamErrorNarrative(
    error: Error,
    attemptCount: number,
    nextAction: string
  ): AsyncGenerator<string> {
    // Categorize the error to provide appropriate explanation
    const errorCategory = this.categorizeError(error);
    
    // Generate empathetic error explanation
    const errorExplanation = this.explainError(errorCategory, error.message);
    
    // Generate recovery plan narrative
    const recoveryPlan = this.generateRecoveryNarrative(attemptCount, nextAction);
    
    // Combine into full narrative
    const narrative = `${errorExplanation} ${recoveryPlan}`;
    
    // Stream the narrative
    for (const char of narrative) {
      yield char;
      await this.delay(10);
    }
    
    yield '\n\n';
  }

  /**
   * Stream transition narrative explaining logical flow between steps
   * Creates smooth connections showing how one step leads to the next
   * 
   * @param fromStep - Description of the previous step
   * @param toStep - Description of the next step
   * @param reasoning - Explanation of why this transition makes sense
   * @returns AsyncGenerator yielding narrative chunks
   * 
   * Validates: Requirement 13.6
   */
  async *streamTransitionNarrative(
    fromStep: string,
    toStep: string,
    reasoning: string
  ): AsyncGenerator<string> {
    // Generate transition phrases that show logical flow
    const transitionPhrases = [
      'Based on this',
      'Now that I know',
      'With this information',
      'Given these results',
      'Using what I found',
    ];
    
    // Select appropriate transition phrase
    const transition = transitionPhrases[Math.floor(Math.random() * transitionPhrases.length)];
    
    // Build narrative showing logical progression
    const narrative = `${transition}, ${reasoning} I'll ${toStep}.`;
    
    // Stream the narrative
    for (const char of narrative) {
      yield char;
      await this.delay(10);
    }
    
    yield '\n\n';
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /**
   * Select appropriate opening phrase based on tool name
   */
  private selectOpening(toolName: string, phrases: string[]): string {
    // Use consistent opening for similar tool types
    const lowerName = toolName.toLowerCase();
    
    if (lowerName.includes('list') || lowerName.includes('get') || lowerName.includes('fetch')) {
      return phrases[0]; // "Let me check"
    }
    if (lowerName.includes('search') || lowerName.includes('find')) {
      return phrases[1]; // "I'll look into"
    }
    if (lowerName.includes('analyze') || lowerName.includes('examine')) {
      return phrases[3]; // "I'm going to examine"
    }
    
    // Default to first phrase
    return phrases[0];
  }

  /**
   * Format tool name into natural language action
   */
  private formatToolAction(toolName: string): string {
    // Remove technical prefixes
    let formatted = toolName
      .replace(/^(sqlcl|mcp|db)_/gi, '')
      .replace(/[_-]/g, ' ');
    
    // Convert to natural language
    const actionMap: Record<string, string> = {
      'list tables': 'what tables are available',
      'describe table': 'the table structure',
      'execute query': 'the data',
      'run query': 'the data',
      'get schema': 'the database schema',
      'search': 'for matching records',
      'analyze': 'the data patterns',
    };
    
    const lowerFormatted = formatted.toLowerCase();
    for (const [key, value] of Object.entries(actionMap)) {
      if (lowerFormatted.includes(key)) {
        return value;
      }
    }
    
    // Default: use the formatted name
    return formatted;
  }

  /**
   * Summarize tool arguments conversationally
   */
  private summarizeArguments(args: Record<string, unknown>): string {
    const keys = Object.keys(args);
    
    if (keys.length === 0) {
      return '';
    }
    
    // For single argument, include its value if simple
    if (keys.length === 1) {
      const key = keys[0];
      const value = args[key];
      
      if (typeof value === 'string' && value.length < 50) {
        return ` for "${value}"`;
      }
      if (typeof value === 'number') {
        return ` with ${key} ${value}`;
      }
    }
    
    // For multiple arguments, mention key parameters
    const importantKeys = keys.filter(k => 
      !k.toLowerCase().includes('limit') && 
      !k.toLowerCase().includes('offset') &&
      !k.toLowerCase().includes('page')
    );
    
    if (importantKeys.length > 0 && importantKeys.length <= 2) {
      return ` using ${importantKeys.join(' and ')}`;
    }
    
    return '';
  }

  /**
   * Analyze tool result to determine narrative approach
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

  /**
   * Generate narrative for empty results
   */
  private generateEmptyResultNarrative(toolName: string, context: ConversationContext): string {
    const action = this.formatToolAction(toolName);
    
    // Check if this is a retry attempt
    const isRetry = context.attemptHistory.length > 0;
    
    if (isRetry) {
      return `That approach didn't return any results either. Let me try a different strategy.`;
    }
    
    return `I didn't find any results for ${action}. Let me try a different approach.`;
  }

  /**
   * Generate narrative for successful results
   */
  private generateSuccessNarrative(
    toolName: string,
    result: unknown,
    analysis: ReturnType<typeof this.analyzeResult>,
    context: ConversationContext
  ): string {
    const action = this.formatToolAction(toolName);
    
    if (analysis.isArray && analysis.count > 0) {
      const items = analysis.count === 1 ? 'item' : 'items';
      return `I found ${analysis.count} ${items} from ${action}. Let me analyze this data.`;
    }
    
    if (analysis.hasData) {
      return `I retrieved the information from ${action}. Based on this, I can proceed.`;
    }
    
    return `I completed ${action} successfully.`;
  }

  /**
   * Categorize error for appropriate explanation
   */
  private categorizeError(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('connection') || message.includes('connect')) {
      return 'connection';
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'timeout';
    }
    if (message.includes('permission') || message.includes('unauthorized')) {
      return 'permission';
    }
    if (message.includes('not found') || message.includes('404')) {
      return 'not_found';
    }
    if (message.includes('syntax') || message.includes('invalid')) {
      return 'syntax';
    }
    
    return 'unknown';
  }

  /**
   * Explain error in user-friendly terms
   */
  private explainError(category: string, message: string): string {
    const explanations: Record<string, string> = {
      connection: 'I\'m having trouble connecting to the database.',
      timeout: 'That operation took too long to complete.',
      permission: 'I don\'t have permission to access that resource.',
      not_found: 'I couldn\'t find what I was looking for.',
      syntax: 'There was an issue with the query format.',
      unknown: 'I encountered an unexpected issue.',
    };
    
    return explanations[category] || explanations.unknown;
  }

  /**
   * Generate recovery plan narrative
   */
  private generateRecoveryNarrative(attemptCount: number, nextAction: string): string {
    if (attemptCount >= 5) {
      return `I've tried several approaches. Could you help me understand what you're looking for?`;
    }
    
    const recoveryPhrases = [
      `Let me try ${nextAction} instead.`,
      `I'll ${nextAction} to see if that works better.`,
      `Let me approach this differently by ${nextAction}.`,
    ];
    
    return recoveryPhrases[attemptCount % recoveryPhrases.length];
  }

  /**
   * Small delay for streaming effect
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const narrativeStreamingService = new NarrativeStreamingService();
