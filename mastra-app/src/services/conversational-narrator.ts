/**
 * ConversationalNarrator Service
 * 
 * Generates natural language explanations for tool executions, results, errors,
 * and adaptations to make the AI's reasoning process transparent and conversational.
 * 
 * Set ENABLE_VERBOSE_NARRATION=false to disable verbose step-by-step narration (Claude Desktop style)
 */

export interface AdaptationContext {
  previousAction: string;
  previousResult: unknown;
  nextAction: string;
  reason: string;
}

export interface ConversationContext {
  lastToolResult: unknown;
  conversationHistory: Array<{ role: string; content: string }>;
  availableTools: string[];
}

export class ConversationalNarrator {
  private verboseMode: boolean;

  constructor() {
    // Default to true per Requirements 13 and 18.3 - tool details SHALL appear as conversational text
    // Can be disabled by setting ENABLE_VERBOSE_NARRATION=false
    this.verboseMode = process.env.ENABLE_VERBOSE_NARRATION !== 'false';
  }

  /**
   * Generate natural language explanation for tool execution start
   * Converts technical tool names to user-friendly descriptions
   * Returns empty string if verbose mode is disabled
   */
  narrateToolStart(toolName: string, args: Record<string, unknown>): string {
    if (!this.verboseMode) return '';
    
    const formattedToolName = this.formatToolName(toolName);
    const argsSummary = this.summarizeArgs(args);
    
    // Template-based generation with context-aware logic
    const templates = [
      `I'm ${formattedToolName}${argsSummary}...`,
      `Let me ${formattedToolName}${argsSummary}...`,
      `Now ${formattedToolName}${argsSummary}...`,
    ];
    
    // Use first template for consistency
    return templates[0];
  }

  /**
   * Generate conversational summary of tool results
   * Handles different data types and structures
   * Returns empty string if verbose mode is disabled
   */
  narrateToolResult(toolName: string, result: unknown): string {
    if (!this.verboseMode) return '';
    
    const formattedToolName = this.formatToolName(toolName);
    
    // Handle null/undefined results
    if (result === null || result === undefined) {
      return `I didn't find any data from ${formattedToolName}.`;
    }
    
    // Handle empty results
    if (this.isEmpty(result)) {
      return `The ${formattedToolName} returned no results.`;
    }
    
    // Handle structured data (arrays)
    if (Array.isArray(result)) {
      const count = result.length;
      if (count === 0) {
        return `The ${formattedToolName} returned no results.`;
      }
      return `I found ${count} ${count === 1 ? 'result' : 'results'} from ${formattedToolName}.`;
    }
    
    // Handle objects
    if (typeof result === 'object') {
      const keys = Object.keys(result);
      if (keys.length === 0) {
        return `The ${formattedToolName} returned an empty result.`;
      }
      return `I retrieved data from ${formattedToolName} with ${keys.length} ${keys.length === 1 ? 'field' : 'fields'}.`;
    }
    
    // Handle primitive values
    if (typeof result === 'string') {
      return `The ${formattedToolName} returned: "${result}"`;
    }
    
    if (typeof result === 'number') {
      return `The ${formattedToolName} returned: ${result}`;
    }
    
    if (typeof result === 'boolean') {
      return `The ${formattedToolName} returned: ${result}`;
    }
    
    // Default case
    return `I completed ${formattedToolName} successfully.`;
  }

  /**
   * Generate user-friendly error explanations
   * Translates technical errors to conversational language
   */
  narrateToolError(toolName: string, error: Error): string {
    const formattedToolName = this.formatToolName(toolName);
    const errorMessage = error.message.toLowerCase();
    
    // Connection errors
    if (errorMessage.includes('connection') || errorMessage.includes('connect')) {
      return `I'm having trouble connecting while ${formattedToolName}. This might be a temporary network issue. Let me try a different approach.`;
    }
    
    // Timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      return `The ${formattedToolName} operation took too long. Let me try with a simpler query.`;
    }
    
    // Permission errors
    if (errorMessage.includes('permission') || errorMessage.includes('unauthorized') || errorMessage.includes('forbidden')) {
      return `I don't have permission to complete ${formattedToolName}. You may need to check the access settings.`;
    }
    
    // Not found errors
    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      return `I couldn't find the resource while ${formattedToolName}. Let me try looking elsewhere.`;
    }
    
    // Syntax/validation errors
    if (errorMessage.includes('syntax') || errorMessage.includes('invalid') || errorMessage.includes('validation')) {
      return `I encountered an issue with the query while ${formattedToolName}. Let me reformulate and try again.`;
    }
    
    // Generic error with recovery suggestion
    return `I ran into an issue while ${formattedToolName}. Let me try a different approach.`;
  }

  /**
   * Generate explanation of how results inform next actions
   * Creates narrative thread across multi-step operations
   * Returns empty string if verbose mode is disabled
   */
  narrateAdaptation(context: AdaptationContext): string {
    if (!this.verboseMode) return '';
    
    const { previousAction, previousResult, nextAction, reason } = context;
    
    const formattedPrevious = this.formatToolName(previousAction);
    const formattedNext = this.formatToolName(nextAction);
    
    // Handle different adaptation scenarios
    if (reason.toLowerCase().includes('refine') || reason.toLowerCase().includes('narrow')) {
      return `Based on what I found from ${formattedPrevious}, I'll now ${formattedNext} to get more specific information.`;
    }
    
    if (reason.toLowerCase().includes('expand') || reason.toLowerCase().includes('broaden')) {
      return `Since ${formattedPrevious} gave us limited results, I'll ${formattedNext} to explore more options.`;
    }
    
    if (reason.toLowerCase().includes('alternative') || reason.toLowerCase().includes('different')) {
      return `The ${formattedPrevious} didn't work as expected, so I'll ${formattedNext} instead.`;
    }
    
    if (reason.toLowerCase().includes('follow') || reason.toLowerCase().includes('next')) {
      return `Now that I've completed ${formattedPrevious}, I'll ${formattedNext} to continue.`;
    }
    
    // Default adaptation narrative
    return `Using the results from ${formattedPrevious}, I'll now ${formattedNext}.`;
  }

  /**
   * Generate conversational progress message for multi-step operations
   * Shows current step, total steps, and what's being done
   * Returns empty string if verbose mode is disabled
   */
  narrateProgress(currentStep: number, totalSteps: number, stepDescription: string): string {
    if (!this.verboseMode) return '';
    
    // Format: "Step X of Y: [description]..."
    return `Step ${currentStep} of ${totalSteps}: ${stepDescription}...`;
  }

  /**
   * Generate summary message when all steps complete
   * Returns empty string if verbose mode is disabled
   */
  narrateCompletion(totalSteps: number, summary: string): string {
    if (!this.verboseMode) return '';
    
    return `✓ Completed all ${totalSteps} steps. ${summary}`;
  }

  /**
   * Generate contextually relevant follow-up suggestions
   * Based on last tool result and conversation context
   */
  generateSuggestions(context: ConversationContext): string[] {
    const { lastToolResult, availableTools } = context;
    const suggestions: string[] = [];
    
    // If we have array results, suggest analysis
    if (Array.isArray(lastToolResult) && lastToolResult.length > 0) {
      suggestions.push('Show me a visualization of this data');
      suggestions.push('What are the key insights from this data?');
      
      // If data has numeric fields, suggest aggregations
      const firstItem = lastToolResult[0];
      if (typeof firstItem === 'object' && firstItem !== null) {
        const hasNumericFields = Object.values(firstItem).some(v => typeof v === 'number');
        if (hasNumericFields) {
          suggestions.push('Calculate summary statistics');
        }
      }
    }
    
    // If we have object results, suggest exploration
    if (typeof lastToolResult === 'object' && lastToolResult !== null && !Array.isArray(lastToolResult)) {
      suggestions.push('Tell me more about this');
      suggestions.push('What else can you show me?');
    }
    
    // If we have database tools, suggest queries
    if (availableTools.some(tool => tool.includes('sql') || tool.includes('query') || tool.includes('database'))) {
      if (suggestions.length < 3) {
        suggestions.push('Run a different query');
      }
    }
    
    // Generic exploration suggestion
    if (suggestions.length < 3) {
      suggestions.push('What other data is available?');
    }
    
    // Limit to 3-4 suggestions
    return suggestions.slice(0, 4);
  }

  /**
   * Format technical tool names to natural language
   * Converts underscores/hyphens to spaces, expands abbreviations
   */
  private formatToolName(toolName: string): string {
    // Remove common technical prefixes
    let formatted = toolName
      .replace(/^(sqlcl|mcp|db)_/gi, '') // Remove technical prefixes
      .replace(/[_-]/g, ' '); // Replace underscores and hyphens with spaces
    
    // Expand common abbreviations
    const abbreviations: Record<string, string> = {
      'sql': 'querying the database',
      'db': 'database',
      'api': 'API',
      'http': 'web request',
      'get': 'retrieving',
      'post': 'sending',
      'put': 'updating',
      'delete': 'removing',
      'fetch': 'fetching',
      'search': 'searching',
      'query': 'querying',
      'run': 'running',
      'execute': 'executing',
      'list': 'listing',
      'create': 'creating',
      'update': 'updating',
      'read': 'reading',
      'write': 'writing',
    };
    
    // Check if the tool name matches common patterns
    const lowerName = formatted.toLowerCase();
    for (const [abbr, expansion] of Object.entries(abbreviations)) {
      if (lowerName.includes(abbr)) {
        formatted = formatted.replace(new RegExp(abbr, 'gi'), expansion);
        break;
      }
    }
    
    // Ensure it starts with a verb (action-oriented)
    const startsWithVerb = /^(querying|fetching|searching|running|executing|listing|creating|updating|reading|writing|retrieving|sending|removing)/i.test(formatted);
    
    if (!startsWithVerb) {
      // Add a generic action verb if none present
      formatted = `using ${formatted}`;
    }
    
    return formatted.trim();
  }

  /**
   * Summarize tool arguments for conversational context
   */
  private summarizeArgs(args: Record<string, unknown>): string {
    const keys = Object.keys(args);
    
    if (keys.length === 0) {
      return '';
    }
    
    // For single argument, include its value if it's simple
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
    
    // For multiple arguments, just mention we have parameters
    if (keys.length <= 3) {
      return ` with ${keys.join(', ')}`;
    }
    
    return ` with ${keys.length} parameters`;
  }

  /**
   * Check if a result is empty
   */
  private isEmpty(value: unknown): boolean {
    if (value === null || value === undefined) {
      return true;
    }
    
    if (Array.isArray(value)) {
      return value.length === 0;
    }
    
    if (typeof value === 'object') {
      return Object.keys(value).length === 0;
    }
    
    if (typeof value === 'string') {
      return value.trim().length === 0;
    }
    
    return false;
  }
}

// Export singleton instance
export const conversationalNarrator = new ConversationalNarrator();
