/**
 * Streaming Buffer Utility
 * 
 * Buffers small streaming chunks to reduce re-renders.
 * Validates: Requirements 9.1, 9.2, 9.3
 * 
 * Target: < 10ms chunk processing time
 */

export interface StreamingChunk {
  content?: string;
  toolCall?: unknown;
  tool_narrative?: string;
  adaptation?: string;
  progress?: string;
  thinking?: string;
  visualization?: unknown;
  analysis?: unknown;
  artifact_update?: unknown;
  iteration_update?: unknown;
  error?: string;
}

export interface BufferedChunk {
  type: 'content' | 'tool' | 'other';
  data: StreamingChunk;
}

export class StreamingBuffer {
  private buffer: string = '';
  private lastFlush: number = Date.now();
  private flushInterval: number;
  private minChunkSize: number;
  private flushCallback: (content: string) => void;
  private timeoutId: NodeJS.Timeout | null = null;

  /**
   * Create a new streaming buffer
   * @param flushCallback - Called when buffer is flushed
   * @param flushInterval - Minimum time between flushes (ms)
   * @param minChunkSize - Minimum characters before flushing
   */
  constructor(
    flushCallback: (content: string) => void,
    flushInterval: number = 50,
    minChunkSize: number = 10
  ) {
    this.flushCallback = flushCallback;
    this.flushInterval = flushInterval;
    this.minChunkSize = minChunkSize;
  }

  /**
   * Add content to buffer
   */
  add(content: string): void {
    this.buffer += content;

    const now = Date.now();
    const timeSinceLastFlush = now - this.lastFlush;
    const shouldFlush =
      this.buffer.length >= this.minChunkSize &&
      timeSinceLastFlush >= this.flushInterval;

    if (shouldFlush) {
      this.flush();
    } else if (!this.timeoutId) {
      // Schedule a flush if we haven't already
      this.timeoutId = setTimeout(() => {
        this.flush();
      }, this.flushInterval);
    }
  }

  /**
   * Flush buffer immediately
   */
  flush(): void {
    if (this.buffer.length > 0) {
      this.flushCallback(this.buffer);
      this.buffer = '';
      this.lastFlush = Date.now();
    }

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * Clear buffer without flushing
   */
  clear(): void {
    this.buffer = '';
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * Get current buffer size
   */
  size(): number {
    return this.buffer.length;
  }

  /**
   * Destroy buffer and clean up
   */
  destroy(): void {
    this.flush();
    this.clear();
  }
}

/**
 * Create a streaming buffer for content chunks
 */
export function createStreamingBuffer(
  onFlush: (content: string) => void,
  options?: {
    flushInterval?: number;
    minChunkSize?: number;
  }
): StreamingBuffer {
  return new StreamingBuffer(
    onFlush,
    options?.flushInterval ?? 50,
    options?.minChunkSize ?? 10
  );
}

export default StreamingBuffer;
