/**
 * Streaming Error Handler
 * 
 * Handles malformed streaming chunks gracefully and continues processing.
 * 
 * Validates: Requirement 11.4
 * - 11.4: Handle malformed streaming chunks gracefully and continue processing
 * - 11.7: Log errors with sufficient context for debugging
 */

export interface StreamingChunk {
  content?: string;
  toolCall?: unknown;
  toolResult?: unknown;
  tool_narrative?: string;
  adaptation?: string;
  progress?: string;
  thinking?: string;
  visualization?: unknown;
  analysis?: unknown;
  artifact_update?: unknown;
  iteration_update?: unknown;
  error?: string;
  done?: boolean;
  ping?: boolean;
  finishReason?: string;
}

export interface StreamingError {
  type: 'parse_error' | 'malformed_chunk' | 'unknown_chunk_type';
  message: string;
  rawData?: string;
  timestamp: Date;
  chunkIndex?: number;
}

export class StreamingErrorHandler {
  private errors: StreamingError[] = [];
  private chunkIndex = 0;
  private consecutiveErrors = 0;
  private readonly MAX_CONSECUTIVE_ERRORS = 5;

  /**
   * Parse a streaming chunk safely
   * Returns null if chunk is malformed, logs error, and continues
   */
  parseChunk(rawData: string): StreamingChunk | null {
    this.chunkIndex++;

    // Skip empty lines
    if (!rawData.trim()) {
      return null;
    }

    // Skip SSE comments
    if (rawData.startsWith(':')) {
      return null;
    }

    // Parse SSE data format
    if (rawData.startsWith('data: ')) {
      const jsonData = rawData.slice(6).trim();
      
      // Handle special cases
      if (jsonData === '[DONE]') {
        return { done: true };
      }

      try {
        const parsed = JSON.parse(jsonData);
        this.consecutiveErrors = 0; // Reset on successful parse
        return parsed as StreamingChunk;
      } catch (error) {
        // Requirement 11.4: Log error and continue processing
        const streamingError: StreamingError = {
          type: 'parse_error',
          message: error instanceof Error ? error.message : 'Failed to parse JSON',
          rawData: jsonData.slice(0, 200), // Truncate for logging
          timestamp: new Date(),
          chunkIndex: this.chunkIndex,
        };

        this.logError(streamingError);
        this.errors.push(streamingError);
        this.consecutiveErrors++;

        // If too many consecutive errors, something is seriously wrong
        if (this.consecutiveErrors >= this.MAX_CONSECUTIVE_ERRORS) {
          console.error(
            `[Streaming Error Handler] Too many consecutive errors (${this.consecutiveErrors}). Stream may be corrupted.`
          );
        }

        return null;
      }
    }

    // Unknown format
    const streamingError: StreamingError = {
      type: 'malformed_chunk',
      message: 'Chunk does not follow SSE format',
      rawData: rawData.slice(0, 200),
      timestamp: new Date(),
      chunkIndex: this.chunkIndex,
    };

    this.logError(streamingError);
    this.errors.push(streamingError);
    this.consecutiveErrors++;

    return null;
  }

  /**
   * Validate chunk structure
   * Returns true if chunk has expected structure
   */
  validateChunk(chunk: StreamingChunk): boolean {
    // Check if chunk has at least one known property
    const knownProperties = [
      'content',
      'toolCall',
      'toolResult',
      'tool_narrative',
      'adaptation',
      'progress',
      'thinking',
      'visualization',
      'analysis',
      'artifact_update',
      'iteration_update',
      'error',
      'done',
      'ping',
      'finishReason',
    ];

    const hasKnownProperty = knownProperties.some(prop => prop in chunk);

    if (!hasKnownProperty) {
      const streamingError: StreamingError = {
        type: 'unknown_chunk_type',
        message: 'Chunk has no recognized properties',
        rawData: JSON.stringify(chunk).slice(0, 200),
        timestamp: new Date(),
        chunkIndex: this.chunkIndex,
      };

      this.logError(streamingError);
      this.errors.push(streamingError);
      return false;
    }

    return true;
  }

  /**
   * Log error with context for debugging
   * Requirement 11.7: Log errors with sufficient context
   */
  private logError(error: StreamingError): void {
    console.error('[Streaming Error Handler] Error processing chunk:', {
      type: error.type,
      message: error.message,
      chunkIndex: error.chunkIndex,
      timestamp: error.timestamp.toISOString(),
      rawData: error.rawData,
      consecutiveErrors: this.consecutiveErrors,
    });
  }

  /**
   * Get all errors encountered during streaming
   */
  getErrors(): StreamingError[] {
    return [...this.errors];
  }

  /**
   * Get error statistics
   */
  getStats() {
    return {
      totalChunks: this.chunkIndex,
      totalErrors: this.errors.length,
      errorRate: this.chunkIndex > 0 ? (this.errors.length / this.chunkIndex) * 100 : 0,
      consecutiveErrors: this.consecutiveErrors,
      errorsByType: {
        parse_error: this.errors.filter(e => e.type === 'parse_error').length,
        malformed_chunk: this.errors.filter(e => e.type === 'malformed_chunk').length,
        unknown_chunk_type: this.errors.filter(e => e.type === 'unknown_chunk_type').length,
      },
    };
  }

  /**
   * Reset error tracking
   */
  reset(): void {
    this.errors = [];
    this.chunkIndex = 0;
    this.consecutiveErrors = 0;
  }
}

/**
 * Create a streaming error handler instance
 */
export function createStreamingErrorHandler(): StreamingErrorHandler {
  return new StreamingErrorHandler();
}
