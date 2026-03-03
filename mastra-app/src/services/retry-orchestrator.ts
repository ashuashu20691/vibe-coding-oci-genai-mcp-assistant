/**
 * RetryOrchestrator Service
 * 
 * Implements autonomous 5-retry loop with error recovery strategies.
 * Generates conversational retry explanations and tracks retry count.
 * 
 * Validates: Requirements 1.5, 1.6, 11.1, 11.4
 */

export interface RetryContext {
  attemptNumber: number;
  maxAttempts: number;
  previousError?: Error;
  previousResult?: unknown;
  operationName: string;
}

export interface RetryStrategy {
  name: string;
  description: string;
  shouldApply: (error: Error, context: RetryContext) => boolean;
  execute: (originalOperation: () => Promise<unknown>, context: RetryContext) => Promise<unknown>;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attemptCount: number;
  strategiesApplied: string[];
  narratives: string[];
}

export interface RetryOptions {
  maxAttempts?: number;
  operationName?: string;
  onNarrative?: (narrative: string) => void;
  onRetry?: (attemptNum: number, strategy: string) => void;
  customStrategies?: RetryStrategy[];
}

/**
 * RetryOrchestrator manages autonomous retry loops with intelligent error recovery
 */
export class RetryOrchestrator {
  private readonly defaultMaxAttempts = 5;
  private strategies: RetryStrategy[] = [];

  constructor() {
    this.initializeDefaultStrategies();
  }

  /**
   * Execute an operation with automatic retry logic and error recovery
   * Validates: Requirements 1.5, 1.6, 11.4
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<RetryResult<T>> {
    const {
      maxAttempts = this.defaultMaxAttempts,
      operationName = 'operation',
      onNarrative,
      onRetry,
      customStrategies = [],
    } = options;

    const allStrategies = [...this.strategies, ...customStrategies];
    const strategiesApplied: string[] = [];
    const narratives: string[] = [];
    let lastError: Error | undefined;

    const emitNarrative = (narrative: string) => {
      narratives.push(narrative);
      if (onNarrative) {
        onNarrative(narrative);
      }
    };

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const context: RetryContext = {
        attemptNumber: attempt,
        maxAttempts,
        previousError: lastError,
        operationName,
      };

      // Emit iteration/retry callback for all attempts
      if (onRetry) {
        onRetry(attempt, attempt === 1 ? 'initial' : 'retry');
      }

      try {
        // First attempt - just try the operation
        if (attempt === 1) {
          const result = await operation();
          // Add success narrative for first attempt
          narratives.push(`Attempt 1: Success`);
          return {
            success: true,
            data: result,
            attemptCount: attempt,
            strategiesApplied,
            narratives,
          };
        }

        // Check if we should stop retrying based on error type
        if (lastError && !this.shouldRetryError(lastError)) {
          // Don't retry certain errors (auth, etc.)
          return {
            success: false,
            error: lastError,
            attemptCount: attempt - 1, // Don't count this attempt
            strategiesApplied,
            narratives,
          };
        }

        // Subsequent attempts - apply recovery strategy
        const strategy = this.selectStrategy(lastError!, context, allStrategies);
        
        if (strategy) {
          strategiesApplied.push(strategy.name);
          
          // Generate conversational retry explanation
          const narrative = this.generateRetryNarrative(attempt, maxAttempts, strategy, lastError!);
          emitNarrative(narrative);

          // Execute with strategy
          const result = await strategy.execute(operation, context);
          
          // Check if result is valid
          if (this.isValidResult(result)) {
            emitNarrative(`✓ Success after ${attempt} ${attempt === 1 ? 'attempt' : 'attempts'}!`);
            return {
              success: true,
              data: result as T,
              attemptCount: attempt,
              strategiesApplied,
              narratives,
            };
          }
          
          // Result is invalid, treat as error
          lastError = new Error('Operation returned invalid or empty result');
        } else {
          // No strategy available, just retry
          const narrative = this.generateGenericRetryNarrative(attempt, maxAttempts, lastError!);
          emitNarrative(narrative);

          const result = await operation();
          
          if (this.isValidResult(result)) {
            emitNarrative(`✓ Success after ${attempt} ${attempt === 1 ? 'attempt' : 'attempts'}!`);
            return {
              success: true,
              data: result as T,
              attemptCount: attempt,
              strategiesApplied,
              narratives,
            };
          }
          
          lastError = new Error('Operation returned invalid or empty result');
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Add narrative for first attempt failure
        if (attempt === 1) {
          narratives.push(`Attempt 1: Error - ${lastError.message}`);
        }
        
        // Check if we should stop retrying
        if (!this.shouldRetryError(lastError)) {
          narratives.push(`Attempt ${attempt}: Error - ${lastError.message} (not retrying)`);
          return {
            success: false,
            error: lastError,
            attemptCount: attempt,
            strategiesApplied,
            narratives,
          };
        }
        
        // If this is the last attempt, don't generate retry narrative
        if (attempt === maxAttempts) {
          emitNarrative(`I tried ${maxAttempts} different approaches, but couldn't complete the operation. ${lastError.message}`);
        }
      }
    }

    // All attempts exhausted
    return {
      success: false,
      error: lastError,
      attemptCount: maxAttempts,
      strategiesApplied,
      narratives,
    };
  }

  /**
   * Generate conversational retry narrative
   * Validates: Requirement 1.6
   */
  private generateRetryNarrative(
    attemptNum: number,
    maxAttempts: number,
    strategy: RetryStrategy,
    error: Error
  ): string {
    const templates = [
      `That didn't work (attempt ${attemptNum}/${maxAttempts}). ${strategy.description}...`,
      `Hmm, that approach failed. Let me try ${strategy.description.toLowerCase()}...`,
      `I ran into an issue. ${strategy.description}...`,
    ];

    // Use different templates based on attempt number
    if (attemptNum === 2) {
      return templates[0];
    } else if (attemptNum === 3) {
      return templates[1];
    } else {
      return templates[2];
    }
  }

  /**
   * Generate generic retry narrative when no specific strategy applies
   */
  private generateGenericRetryNarrative(
    attemptNum: number,
    maxAttempts: number,
    error: Error
  ): string {
    return `That didn't work (attempt ${attemptNum}/${maxAttempts}). Let me try a different approach...`;
  }

  /**
   * Select the most appropriate retry strategy based on error and context
   */
  private selectStrategy(
    error: Error,
    context: RetryContext,
    strategies: RetryStrategy[]
  ): RetryStrategy | null {
    for (const strategy of strategies) {
      if (strategy.shouldApply(error, context)) {
        return strategy;
      }
    }
    return null;
  }

  /**
   * Check if a result is valid (not null, undefined, empty array, or empty object)
   */
  private isValidResult(result: unknown): boolean {
    if (result === null || result === undefined) {
      return false;
    }

    if (Array.isArray(result)) {
      return result.length > 0;
    }

    if (typeof result === 'object') {
      return Object.keys(result).length > 0;
    }

    if (typeof result === 'string') {
      return result.trim().length > 0;
    }

    return true;
  }

  /**
   * Determine if an error should trigger a retry
   * Some errors (like authentication failures) should not be retried
   */
  private shouldRetryError(error: Error): boolean {
    const msg = error.message.toLowerCase();
    
    // Don't retry authentication/authorization errors
    if (msg.includes('authentication') || 
        msg.includes('unauthorized') || 
        msg.includes('forbidden') ||
        msg.includes('access denied')) {
      return false;
    }
    
    // Retry all other errors
    return true;
  }

  /**
   * Initialize default retry strategies
   */
  private initializeDefaultStrategies(): void {
    // Strategy 1: Schema refresh for table/column not found errors
    // Validates: Requirements 1.6, 11.1, 11.2
    this.strategies.push({
      name: 'schema_refresh',
      description: "That didn't work, let me check the schema first",
      shouldApply: (error: Error) => {
        const msg = error.message.toLowerCase();
        return msg.includes('table not found') || 
               msg.includes('table does not exist') ||
               msg.includes('column not found') ||
               msg.includes('column does not exist') ||
               msg.includes('invalid table') ||
               msg.includes('invalid column') ||
               msg.includes('no such table') ||
               msg.includes('no such column');
      },
      execute: async (operation) => {
        // Note: Schema refresh should be handled by the caller
        // This strategy just provides the narrative and retry
        return operation();
      },
    });

    // Strategy 2: Connection retry with exponential backoff
    this.strategies.push({
      name: 'connection_retry',
      description: 'Let me try reconnecting to the database',
      shouldApply: (error: Error) => {
        const msg = error.message.toLowerCase();
        return msg.includes('connection') || 
               msg.includes('connect') || 
               msg.includes('network') ||
               msg.includes('timeout') ||
               msg.includes('not connected');
      },
      execute: async (operation, context) => {
        // Wait with exponential backoff: 1s, 2s, 4s, 8s
        // In test environment, use shorter delays (10ms, 20ms, 40ms, 80ms)
        const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
        const baseDelay = isTest ? 10 : 1000;
        const backoffMs = Math.min(baseDelay * Math.pow(2, context.attemptNumber - 2), isTest ? 80 : 8000);
        await this.sleep(backoffMs);
        return operation();
      },
    });

    // Strategy 3: Parameter correction
    this.strategies.push({
      name: 'parameter_correction',
      description: 'Let me try with different parameters',
      shouldApply: (error: Error) => {
        const msg = error.message.toLowerCase();
        return msg.includes('parameter') || 
               msg.includes('argument') || 
               msg.includes('invalid') ||
               msg.includes('missing');
      },
      execute: async (operation) => {
        // Just retry - the caller should handle parameter mapping
        return operation();
      },
    });

    // Strategy 4: SQL syntax correction
    this.strategies.push({
      name: 'sql_correction',
      description: 'Let me reformulate the query',
      shouldApply: (error: Error) => {
        const msg = error.message.toLowerCase();
        return msg.includes('syntax') || 
               msg.includes('sql') || 
               msg.includes('parse') ||
               msg.includes('invalid query');
      },
      execute: async (operation) => {
        // Retry - caller should regenerate SQL
        return operation();
      },
    });

    // Strategy 5: Permission/auth retry
    this.strategies.push({
      name: 'auth_retry',
      description: 'Let me check the permissions',
      shouldApply: (error: Error) => {
        const msg = error.message.toLowerCase();
        return msg.includes('permission') || 
               msg.includes('unauthorized') || 
               msg.includes('forbidden') ||
               msg.includes('access denied');
      },
      execute: async (operation) => {
        // Wait a bit and retry
        await this.sleep(1000);
        return operation();
      },
    });

    // Strategy 6: Generic retry with delay
    this.strategies.push({
      name: 'delayed_retry',
      description: 'Let me try again',
      shouldApply: () => true, // Catch-all strategy
      execute: async (operation, context) => {
        // Small delay before retry
        // In test environment, use minimal delays
        const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
        const delay = isTest ? 10 : 500 * context.attemptNumber;
        await this.sleep(delay);
        return operation();
      },
    });
  }

  /**
   * Add a custom retry strategy
   */
  addStrategy(strategy: RetryStrategy): void {
    this.strategies.unshift(strategy); // Add to front so custom strategies are checked first
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const retryOrchestrator = new RetryOrchestrator();
