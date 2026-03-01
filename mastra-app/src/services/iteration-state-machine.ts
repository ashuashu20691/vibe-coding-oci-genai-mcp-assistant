// src/services/iteration-state-machine.ts

/**
 * IterationStateMachine
 * 
 * Manages autonomous retry logic, allowing up to 5 refinement attempts before requesting user guidance.
 * Tracks attempt history, aggregates partial data, and generates alternative strategies on failure.
 * 
 * Validates: Requirements 14.1, 14.2, 14.3, 14.6, 14.7
 */

export interface AttemptRecord {
  attemptNumber: number;
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
  success: boolean;
  error?: Error;
  timestamp: Date;
  duration: number;
  narrative: string;
}

export interface DiscoveryStep {
  stepNumber: number;
  action: string;
  toolCalls: ToolCallRecord[];
  results: unknown[];
  insights: string[];
  nextAction?: string;
}

export interface ToolCallRecord {
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
  success: boolean;
  timestamp: Date;
}

export interface DiscoveryChain {
  goal: string;
  steps: DiscoveryStep[];
  aggregatedResults: Record<string, unknown>;
  status: 'in_progress' | 'completed' | 'failed' | 'needs_guidance';
}

export interface RetryOptions {
  maxAttempts?: number; // Default: 5
  onAttempt?: (attemptNum: number) => void;
  onIterationUpdate?: (iteration: number, maxIterations: number) => void;
  onFailure?: (error: Error, attemptNum: number) => AlternativeStrategy | null;
  shouldRetry?: (error: Error) => boolean;
}

export interface AlternativeStrategy {
  description: string;
  operation: () => Promise<unknown>;
}

export interface IterationResult<T> {
  success: boolean;
  data?: T;
  partialData: unknown[]; // Data gathered from each attempt
  attempts: number;
  errors: Error[];
  finalStrategy?: string;
  attemptSummaries: string[]; // Summary of what was tried in each attempt
}

export class IterationStateMachine {
  private currentIteration: number = 0;
  private maxIterations: number = 5;
  private attempts: AttemptRecord[] = [];
  private partialData: unknown[] = [];
  private discoveryChain: DiscoveryChain | null = null;
  private currentStepNumber: number = 0;

  /**
   * Execute an operation with automatic retry logic
   * Validates: Requirements 14.1, 14.2, 14.3
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<IterationResult<T>> {
    const {
      maxAttempts = 5,
      onAttempt,
      onIterationUpdate,
      onFailure,
      shouldRetry = () => true,
    } = options;

    this.maxIterations = maxAttempts;
    this.reset();

    const errors: Error[] = [];
    const attemptSummaries: string[] = [];
    let finalStrategy: string | undefined;
    let currentOperation = operation;

    while (this.currentIteration < this.maxIterations) {
      this.currentIteration++;

      // Emit iteration count update
      if (onIterationUpdate) {
        onIterationUpdate(this.currentIteration, this.maxIterations);
      }

      // Notify about current attempt
      if (onAttempt) {
        onAttempt(this.currentIteration);
      }

      const startTime = Date.now();
      let attemptResult: unknown;
      let attemptSuccess = false;
      let attemptError: Error | undefined;

      try {
        attemptResult = await currentOperation();
        attemptSuccess = this.isSuccessfulResult(attemptResult);

        // Store data from this attempt only if it's not empty
        // Empty arrays, empty objects, null, undefined are not stored
        if (this.hasData(attemptResult)) {
          this.partialData.push(attemptResult);
        }

        if (attemptSuccess) {
          // Success! Record and return
          const duration = Date.now() - startTime;
          const record: AttemptRecord = {
            attemptNumber: this.currentIteration,
            toolName: 'operation',
            args: {},
            result: attemptResult,
            success: true,
            timestamp: new Date(),
            duration,
            narrative: `Attempt ${this.currentIteration} succeeded`,
          };
          this.recordAttempt(record);

          return {
            success: true,
            data: attemptResult as T,
            partialData: this.partialData,
            attempts: this.currentIteration,
            errors,
            finalStrategy,
            attemptSummaries: [...attemptSummaries, `Attempt ${this.currentIteration}: Success`],
          };
        }
      } catch (error) {
        attemptError = error instanceof Error ? error : new Error(String(error));
        attemptResult = null;
      }

      // Record failed attempt
      const duration = Date.now() - startTime;
      const record: AttemptRecord = {
        attemptNumber: this.currentIteration,
        toolName: 'operation',
        args: {},
        result: attemptResult,
        success: false,
        error: attemptError,
        timestamp: new Date(),
        duration,
        narrative: attemptError
          ? `Attempt ${this.currentIteration} failed: ${attemptError.message}`
          : `Attempt ${this.currentIteration} returned empty/invalid results`,
      };
      this.recordAttempt(record);

      if (attemptError) {
        errors.push(attemptError);
      }

      attemptSummaries.push(
        attemptError
          ? `Attempt ${this.currentIteration}: Error - ${attemptError.message}`
          : `Attempt ${this.currentIteration}: Empty/invalid result`
      );

      // Check if we should continue
      if (!this.shouldContinue()) {
        break;
      }

      // Check if we should retry this error
      if (attemptError && !shouldRetry(attemptError)) {
        break;
      }

      // Generate alternative strategy for next attempt
      if (onFailure && this.currentIteration < this.maxIterations) {
        const alternativeStrategy = onFailure(
          attemptError || new Error('Empty or invalid result'),
          this.currentIteration
        );

        if (alternativeStrategy) {
          finalStrategy = alternativeStrategy.description;
          currentOperation = alternativeStrategy.operation as () => Promise<T>;
          attemptSummaries.push(`Strategy ${this.currentIteration + 1}: ${alternativeStrategy.description}`);
        }
      }
    }

    // Max iterations reached without success
    return {
      success: false,
      partialData: this.partialData,
      attempts: this.currentIteration,
      errors,
      finalStrategy,
      attemptSummaries,
    };
  }

  /**
   * Get current iteration count
   * Validates: Requirement 14.5
   */
  getCurrentIteration(): number {
    return this.currentIteration;
  }

  /**
   * Get maximum iterations allowed
   * Validates: Requirement 14.3
   */
  getMaxIterations(): number {
    return this.maxIterations;
  }

  /**
   * Determine if iteration should continue
   * Validates: Requirement 14.3
   */
  shouldContinue(): boolean {
    return this.currentIteration < this.maxIterations;
  }

  /**
   * Record an attempt in history
   * Validates: Requirement 14.6
   */
  recordAttempt(attempt: AttemptRecord): void {
    this.attempts.push(attempt);
  }

  /**
   * Get all attempt records
   * Validates: Requirement 14.6
   */
  getAttemptHistory(): AttemptRecord[] {
    return [...this.attempts];
  }

  /**
   * Get partial data gathered from all attempts
   * Validates: Requirement 14.7
   */
  getPartialData(): unknown[] {
    return [...this.partialData];
  }

  /**
   * Reset the state machine for a new operation
   */
  reset(): void {
    this.currentIteration = 0;
    this.attempts = [];
    this.partialData = [];
    this.discoveryChain = null;
    this.currentStepNumber = 0;
  }

  /**
   * Initialize a new discovery chain
   * Validates: Requirement 14.4
   */
  startDiscoveryChain(goal: string): void {
    this.discoveryChain = {
      goal,
      steps: [],
      aggregatedResults: {},
      status: 'in_progress',
    };
    this.currentStepNumber = 0;
  }

  /**
   * Add a step to the current discovery chain
   * Validates: Requirement 14.4
   */
  addDiscoveryStep(
    action: string,
    toolCalls: ToolCallRecord[],
    insights: string[] = [],
    nextAction?: string
  ): void {
    if (!this.discoveryChain) {
      throw new Error('Discovery chain not initialized. Call startDiscoveryChain first.');
    }

    this.currentStepNumber++;

    const results = toolCalls.map((tc) => tc.result);

    const step: DiscoveryStep = {
      stepNumber: this.currentStepNumber,
      action,
      toolCalls,
      results,
      insights,
      nextAction,
    };

    this.discoveryChain.steps.push(step);

    // Aggregate results by tool name for easy access
    toolCalls.forEach((tc) => {
      if (tc.success && this.hasData(tc.result)) {
        const key = `${tc.toolName}_step${this.currentStepNumber}`;
        this.discoveryChain!.aggregatedResults[key] = tc.result;
      }
    });
  }

  /**
   * Complete the current discovery chain
   * Validates: Requirement 14.4
   */
  completeDiscoveryChain(status: 'completed' | 'failed' | 'needs_guidance'): void {
    if (!this.discoveryChain) {
      throw new Error('Discovery chain not initialized.');
    }

    this.discoveryChain.status = status;
  }

  /**
   * Get the current discovery chain
   * Validates: Requirement 14.4
   */
  getDiscoveryChain(): DiscoveryChain | null {
    return this.discoveryChain ? { ...this.discoveryChain } : null;
  }

  /**
   * Get aggregated results from the discovery chain
   * Returns all results collected across tool calls, maintaining relationships
   * Validates: Requirement 14.4
   */
  getAggregatedResults(): Record<string, unknown> {
    if (!this.discoveryChain) {
      return {};
    }

    return { ...this.discoveryChain.aggregatedResults };
  }

  /**
   * Get all steps from the discovery chain
   * Validates: Requirement 14.4
   */
  getDiscoverySteps(): DiscoveryStep[] {
    if (!this.discoveryChain) {
      return [];
    }

    return [...this.discoveryChain.steps];
  }

  /**
   * Determine if a result is considered successful
   * A result is successful if it contains data:
   * - Non-empty arrays
   * - Non-empty objects
   * - Non-empty strings
   * - Numbers (including 0)
   * - Booleans
   * 
   * Failures are: null, undefined, empty arrays, empty objects, empty strings
   */
  private isSuccessfulResult(result: unknown): boolean {
    if (result === null || result === undefined) {
      return false;
    }

    // Empty arrays are failures
    if (Array.isArray(result)) {
      return result.length > 0;
    }

    // Empty objects are failures
    if (typeof result === 'object') {
      return Object.keys(result).length > 0;
    }

    // Empty strings are failures
    if (typeof result === 'string') {
      return result.length > 0;
    }

    // Numbers and booleans are always successes
    return true;
  }

  /**
   * Check if a result has any data worth storing
   * Returns false for null, undefined, empty arrays, empty objects
   */
  private hasData(result: unknown): boolean {
    if (result === null || result === undefined) {
      return false;
    }

    if (Array.isArray(result)) {
      return result.length > 0;
    }

    if (typeof result === 'object') {
      return Object.keys(result).length > 0;
    }

    // All other values have data
    return true;
  }
}
