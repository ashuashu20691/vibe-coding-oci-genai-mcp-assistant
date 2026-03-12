// src/mastra/providers/oci-genai.ts
/**
 * Custom OCI GenAI Provider for Mastra framework.
 * Integrates with Oracle Cloud Infrastructure Generative AI service.
 */

import * as GenerativeAiInference from 'oci-generativeaiinference';
import * as common from 'oci-common';
import { Model, StreamChunk, ToolCall, Tool, MessageRole } from '../../types';

export interface OCIProviderConfig {
  configFile?: string;
  profile?: string;
  compartmentId: string;
  endpoint?: string;
}

export interface ChatMessage {
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export class OCIGenAIProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OCIGenAIProviderError';
  }
}

export class OCIGenAIAuthError extends OCIGenAIProviderError {
  constructor(message: string) {
    super(message);
    this.name = 'OCIGenAIAuthError';
  }
}

export class OCIGenAIRateLimitError extends OCIGenAIProviderError {
  public retryAfterMs: number;
  
  constructor(message: string, retryAfterMs: number = 5000) {
    super(message);
    this.name = 'OCIGenAIRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class OCIGenAIProvider {
  private config: OCIProviderConfig;
  private client: GenerativeAiInference.GenerativeAiInferenceClient | null = null;
  private initError: Error | null = null;
  private systemPreamble: string | undefined;
  
  // Rate limiting configuration
  private lastRequestTime: number = 0;
  private minRequestIntervalMs: number = 1000; // Minimum 1 second between requests
  private maxRetries: number = 4; // Increased retries for rate-limited environments
  private baseRetryDelayMs: number = 3000; // Start with 3 second delay (increased from 2s)

  constructor(config: OCIProviderConfig) {
    this.config = config;
  }

  /**
   * Wait for rate limit cooldown before making a request.
   */
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestIntervalMs) {
      const waitTime = this.minRequestIntervalMs - timeSinceLastRequest;
      console.log(`[OCIGenAI] Rate limiting: waiting ${waitTime}ms before next request`);
      await this.sleep(waitTime);
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Sleep for specified milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute a request with exponential backoff retry logic.
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // Wait for rate limit before each attempt
        await this.waitForRateLimit();
        
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMessage = lastError.message.toLowerCase();
        
        // Check if this is a rate limit error
        const isRateLimitError = 
          errorMessage.includes('throttled') ||
          errorMessage.includes('rate limit') ||
          errorMessage.includes('service request limit') ||
          errorMessage.includes('429') ||
          errorMessage.includes('too many requests');
        
        if (isRateLimitError && attempt < this.maxRetries) {
          // Exponential backoff: 2s, 4s, 8s
          const delayMs = this.baseRetryDelayMs * Math.pow(2, attempt);
          console.log(`[OCIGenAI] Rate limit hit on ${operationName}, attempt ${attempt + 1}/${this.maxRetries + 1}. Retrying in ${delayMs}ms...`);
          await this.sleep(delayMs);
          continue;
        }
        
        // If it's a rate limit error and we've exhausted retries, throw specific error
        if (isRateLimitError) {
          throw new OCIGenAIRateLimitError(
            `Rate limit exceeded after ${this.maxRetries + 1} attempts. Please wait a moment and try again.`,
            this.baseRetryDelayMs * Math.pow(2, this.maxRetries)
          );
        }
        
        // For non-rate-limit errors, throw immediately
        throw lastError;
      }
    }
    
    // Should not reach here, but just in case
    throw lastError || new Error(`${operationName} failed after ${this.maxRetries + 1} attempts`);
  }

  /**
   * Set the system preamble (instructions) for the model.
   */
  setSystemPreamble(preamble: string): void {
    this.systemPreamble = preamble;
  }

  /**
   * Lazily initialize the OCI GenAI client.
   */
  private async getClient(): Promise<GenerativeAiInference.GenerativeAiInferenceClient> {
    if (this.initError) {
      throw this.initError;
    }

    if (!this.client) {
      try {
        const provider = new common.ConfigFileAuthenticationDetailsProvider(
          this.config.configFile,
          this.config.profile || 'DEFAULT'
        );

        this.client = new GenerativeAiInference.GenerativeAiInferenceClient({
          authenticationDetailsProvider: provider,
        });

        if (this.config.endpoint) {
          this.client.endpoint = this.config.endpoint;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.initError = new OCIGenAIAuthError(
          `Failed to initialize OCI GenAI client: ${errorMessage}. ` +
            'Check OCI configuration file and credentials.'
        );
        throw this.initError;
      }
    }

    return this.client;
  }

  /**
   * List available generative AI models.
   * Returns a predefined list of OCI GenAI models available for chat.
   * Updated to include latest models available in OCI Console (Feb 2026).
   */
  listModels(): Model[] {
    return [
      // Google Gemini Models (newest)
      {
        id: 'google.gemini-2.5-flash',
        name: 'Google Gemini 2.5 Flash',
        description: 'Fast and efficient Gemini model for quick tasks',
        contextLength: 1000000,
      },
      {
        id: 'google.gemini-2.5-flash-lite',
        name: 'Google Gemini 2.5 Flash Lite',
        description: 'Lightweight Gemini model for quick responses',
        contextLength: 1000000,
      },
      {
        id: 'google.gemini-2.5-pro',
        name: 'Google Gemini 2.5 Pro',
        description: 'Most capable Gemini model for complex reasoning',
        contextLength: 1000000,
      },
      // xAI Grok Models
      {
        id: 'xai.grok-3',
        name: 'xAI Grok 3',
        description: 'Powerful reasoning model from xAI',
        contextLength: 131072,
      },
      {
        id: 'xai.grok-3-fast',
        name: 'xAI Grok 3 Fast',
        description: 'Faster Grok 3 variant for quick responses',
        contextLength: 131072,
      },
      {
        id: 'xai.grok-3-mini',
        name: 'xAI Grok 3 Mini',
        description: 'Compact Grok 3 model for efficient tasks',
        contextLength: 131072,
      },
      {
        id: 'xai.grok-3-mini-fast',
        name: 'xAI Grok 3 Mini Fast',
        description: 'Fast compact Grok 3 model',
        contextLength: 131072,
      },
      {
        id: 'xai.grok-4',
        name: 'xAI Grok 4',
        description: 'Latest xAI Grok 4 model with advanced capabilities',
        contextLength: 131072,
      },
      {
        id: 'xai.grok-4-1-fast-non-reasoning',
        name: 'xAI Grok 4.1 Fast',
        description: 'Fast Grok 4.1 optimized for speed',
        contextLength: 131072,
      },
      // Cohere Models
      {
        id: 'cohere.command-r-plus-08-2024',
        name: 'Cohere Command R+ (08-2024)',
        description: "Cohere's most powerful model for complex tasks",
        contextLength: 128000,
      },
      {
        id: 'cohere.command-r-08-2024',
        name: 'Cohere Command R (08-2024)',
        description: "Cohere's efficient model for general tasks",
        contextLength: 128000,
      },
      {
        id: 'cohere.command-r-plus',
        name: 'Cohere Command R+',
        description: 'Cohere Command R+ model for advanced reasoning',
        contextLength: 128000,
      },
      {
        id: 'cohere.command-r-16k',
        name: 'Cohere Command R 16K',
        description: 'Cohere Command R with 16K context window',
        contextLength: 16000,
      },
      // Meta Llama Models
      {
        id: 'meta.llama-3.1-405b-instruct',
        name: 'Meta Llama 3.1 405B Instruct',
        description: "Meta's largest Llama 3.1 model for complex tasks",
        contextLength: 128000,
      },
      {
        id: 'meta.llama-3.1-70b-instruct',
        name: 'Meta Llama 3.1 70B Instruct',
        description: "Meta's efficient Llama 3.1 70B model",
        contextLength: 128000,
      },
    ];
  }

  /**
   * Get initialization error if any.
   */
  getInitError(): Error | null {
    return this.initError;
  }

  /**
   * Convert tool name to OCI-compatible format (replace hyphens with underscores).
   */
  private toOCIToolName(name: string): string {
    return name.replace(/-/g, '_');
  }

  /**
   * Build Cohere chat history from messages.
   */
  private buildChatHistory(messages: ChatMessage[]): {
    chatHistory: GenerativeAiInference.models.CohereMessage[];
    currentMessage: string;
    toolResults: GenerativeAiInference.models.CohereToolResult[];
    lastToolCalls: ToolCall[];
  } {
    const chatHistory: GenerativeAiInference.models.CohereMessage[] = [];
    let currentMessage = '';
    const toolResults: GenerativeAiInference.models.CohereToolResult[] = [];
    let lastToolCalls: ToolCall[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        // System messages (e.g., error retry context) are injected as USER messages
        // since Cohere chat history doesn't have a system role (uses preamble instead)
        if (currentMessage) {
          chatHistory.push({
            role: 'USER',
            message: currentMessage,
          } as GenerativeAiInference.models.CohereUserMessage);
        }
        currentMessage = msg.content || '';
      } else if (msg.role === 'user') {
        // If we have a pending user message, add it first
        if (currentMessage) {
          chatHistory.push({
            role: 'USER',
            message: currentMessage,
          } as GenerativeAiInference.models.CohereUserMessage);
        }
        currentMessage = msg.content || '';
      } else if (msg.role === 'assistant') {
        // Add pending user message first
        if (currentMessage) {
          chatHistory.push({
            role: 'USER',
            message: currentMessage,
          } as GenerativeAiInference.models.CohereUserMessage);
          currentMessage = '';
        }

        // Add assistant message
        chatHistory.push({
          role: 'CHATBOT',
          message: msg.content || "I'll help with that.",
        } as GenerativeAiInference.models.CohereChatBotMessage);

        // Track tool calls from this assistant message
        if (msg.toolCalls) {
          lastToolCalls = msg.toolCalls;
        }
      } else if (msg.role === 'tool') {
        // Build tool result with the matching tool call
        let toolName = 'unknown_tool';
        for (const tc of lastToolCalls) {
          if (tc.id === msg.toolCallId) {
            toolName = this.toOCIToolName(tc.name);
            break;
          }
        }

        // Extract and truncate tool result content.
        // MCP tools return { content: [{ text: '...', type: 'text' }] } — extract the text.
        // Truncate to 2000 chars to avoid Cohere API token limits.
        let resultContent = msg.content || 'No result';
        try {
          const parsed = JSON.parse(resultContent);
          // Unwrap MCP content array: { content: [{ text: '...' }] }
          if (parsed?.content?.[0]?.text) {
            resultContent = parsed.content[0].text;
          } else if (parsed?.result?.content?.[0]?.text) {
            resultContent = parsed.result.content[0].text;
          } else if (typeof parsed === 'object') {
            resultContent = JSON.stringify(parsed);
          }
        } catch {
          // Not JSON, use as-is
        }
        // Truncate to prevent token overflow
        if (resultContent.length > 2000) {
          resultContent = resultContent.slice(0, 2000) + '\n... (truncated)';
        }

        toolResults.push({
          call: {
            name: toolName,
          } as GenerativeAiInference.models.CohereToolCall,
          outputs: [{ result: resultContent }],
        } as GenerativeAiInference.models.CohereToolResult);
      }
    }

    return { chatHistory, currentMessage, toolResults, lastToolCalls };
  }

  /**
   * Convert tools to OCI Cohere format.
   * Cleans up Zod schema internal fields that shouldn't be serialized.
   */
  private convertToolsToOCIFormat(tools: Tool[]): GenerativeAiInference.models.CohereTool[] {
    return tools.map((tool) => {
      const paramDefs: Record<string, GenerativeAiInference.models.CohereParameterDefinition> = {};
      
      // Clean the input schema first
      const cleanedSchema = this.cleanJsonSchema(tool.inputSchema);
      
      const props =
        (cleanedSchema?.properties as Record<string, { description?: string; type?: string }>) || {};
      const required = (cleanedSchema?.required as string[]) || [];

      for (const [paramName, paramDef] of Object.entries(props)) {
        const safeParamName = paramName.replace(/-/g, '_');
        paramDefs[safeParamName] = {
          description: (paramDef.description || '').slice(0, 500), // Truncate long descriptions
          type: paramDef.type || 'string',
          isRequired: required.includes(paramName),
        } as GenerativeAiInference.models.CohereParameterDefinition;
      }

      // Truncate tool description to avoid issues
      const description = (tool.description || `Tool: ${tool.name}`).slice(0, 1000);

      return {
        name: this.toOCIToolName(tool.name),
        description: description,
        parameterDefinitions: Object.keys(paramDefs).length > 0 ? paramDefs : undefined,
      } as GenerativeAiInference.models.CohereTool;
    });
  }

  /**
   * Parse streaming event into StreamChunk.
   */
  private parseStreamEvent(event: unknown): StreamChunk | null {
    try {
      let data: Record<string, unknown>;

      if (typeof event === 'object' && event !== null && 'data' in event) {
        const eventData = (event as { data: unknown }).data;
        data = typeof eventData === 'string' ? JSON.parse(eventData) : (eventData as Record<string, unknown>);
      } else if (typeof event === 'object' && event !== null) {
        data = event as Record<string, unknown>;
      } else {
        return null;
      }

      // Extract text content
      let content: string | undefined;
      if ('text' in data && typeof data.text === 'string') {
        content = data.text;
      } else if ('chatResponse' in data && typeof data.chatResponse === 'object' && data.chatResponse !== null) {
        const chatResp = data.chatResponse as Record<string, unknown>;
        if ('text' in chatResp && typeof chatResp.text === 'string') {
          content = chatResp.text;
        }
      }

      // Extract tool calls - Cohere format
      let toolCalls: ToolCall[] | undefined;
      const extractToolCalls = (tcArray: unknown[]): ToolCall[] => {
        return tcArray.map((tc, i) => {
          const toolCall = tc as Record<string, unknown>;
          return {
            id: (toolCall.id as string) || `tool_${i}`,
            name: (toolCall.name as string) || '',
            arguments: (toolCall.parameters as Record<string, unknown>) || {},
          };
        });
      };

      if ('toolCalls' in data && Array.isArray(data.toolCalls)) {
        toolCalls = extractToolCalls(data.toolCalls);
      } else if ('chatResponse' in data && typeof data.chatResponse === 'object' && data.chatResponse !== null) {
        const chatResp = data.chatResponse as Record<string, unknown>;
        if ('toolCalls' in chatResp && Array.isArray(chatResp.toolCalls)) {
          toolCalls = extractToolCalls(chatResp.toolCalls);
        }
      }

      // Extract finish reason
      const finishReason = (data.finishReason as string) || (data.finish_reason as string) || undefined;

      if (content || toolCalls || finishReason) {
        return {
          content,
          toolCalls,
          finishReason,
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Parse non-streaming response into StreamChunk.
   */
  private parseResponse(response: GenerativeAiInference.responses.ChatResponse): StreamChunk {
    let content: string | undefined;
    let toolCalls: ToolCall[] | undefined;
    let finishReason = 'stop';

    const chatResponse = response.chatResult?.chatResponse;

    if (chatResponse) {
      // Access text from Cohere response - use type assertion for Cohere-specific fields
      const cohereResponse = chatResponse as GenerativeAiInference.models.CohereChatResponse;

      if (cohereResponse.text) {
        content = cohereResponse.text;
      }

      // Check for tool calls
      if (cohereResponse.toolCalls && cohereResponse.toolCalls.length > 0) {
        toolCalls = cohereResponse.toolCalls.map(
          (tc: GenerativeAiInference.models.CohereToolCall, i: number) => ({
            id: `tool_${i}`,
            name: tc.name || '',
            arguments: tc.parameters || {},
          })
        );
        finishReason = 'tool_calls';
      }

      if (cohereResponse.finishReason) {
        finishReason = cohereResponse.finishReason;
      }
    }

    return {
      content,
      toolCalls,
      finishReason,
    };
  }

  /**
   * Detect the API format based on model ID.
   */
  private getApiFormat(modelId: string): 'COHERE' | 'GENERIC' {
    // Google Gemini and xAI Grok models use GENERIC format
    if (modelId.startsWith('google.') || modelId.startsWith('xai.')) {
      return 'GENERIC';
    }
    // Cohere and Meta models use COHERE format
    return 'COHERE';
  }

  /**
   * Build generic chat request for Google/xAI models.
   * Uses the OCI GenAI GENERIC API format with proper SDK types.
   * The SDK expects properly typed Message and TextContent objects.
   * 
   * IMPORTANT: Assistant messages with toolCalls MUST be followed by corresponding
   * tool messages. If not, we strip the toolCalls to avoid API errors when
   * switching models mid-conversation.
   */
  private buildGenericChatRequest(
    messages: ChatMessage[],
    tools?: Tool[]
  ): GenerativeAiInference.models.GenericChatRequest {
    // First, collect all tool message IDs to know which toolCalls have responses
    const toolMessageIds = new Set<string>();
    for (const msg of messages) {
      if (msg.role === 'tool' && msg.toolCallId) {
        toolMessageIds.add(msg.toolCallId);
      }
    }
    console.log('[OCIGenAI] Tool message IDs in conversation:', Array.from(toolMessageIds));
    
    // Build messages array using proper SDK types
    const genericMessages: GenerativeAiInference.models.Message[] = [];
    
    // Add system message if preamble is set
    if (this.systemPreamble) {
      genericMessages.push({
        role: 'SYSTEM',
        content: [
          {
            type: 'TEXT',
            text: this.systemPreamble,
          } as GenerativeAiInference.models.TextContent,
        ],
      } as GenerativeAiInference.models.SystemMessage);
    }
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      
      if (msg.role === 'system') {
        // System messages (e.g., error retry context) are injected as USER messages
        // since the generic format uses SYSTEM only for the preamble
        genericMessages.push({
          role: 'USER',
          content: [
            {
              type: 'TEXT',
              text: msg.content || '',
            } as GenerativeAiInference.models.TextContent,
          ],
        } as GenerativeAiInference.models.UserMessage);
      } else if (msg.role === 'user') {
        genericMessages.push({
          role: 'USER',
          content: [
            {
              type: 'TEXT',
              text: msg.content || '',
            } as GenerativeAiInference.models.TextContent,
          ],
        } as GenerativeAiInference.models.UserMessage);
      } else if (msg.role === 'assistant') {
        // Handle assistant messages with tool calls
        const assistantMsg: GenerativeAiInference.models.AssistantMessage = {
          role: 'ASSISTANT',
          content: msg.content ? [
            {
              type: 'TEXT',
              text: msg.content,
            } as GenerativeAiInference.models.TextContent,
          ] : undefined, // Set to undefined when responding to tool calls per SDK docs
        };
        
        // Only add tool calls if ALL of them have corresponding tool messages
        // This prevents errors when switching models mid-conversation where
        // tool results weren't stored in the database
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          const allToolCallsHaveResponses = msg.toolCalls.every(tc => toolMessageIds.has(tc.id));
          
          if (allToolCallsHaveResponses) {
            assistantMsg.toolCalls = msg.toolCalls.map(tc => ({
              id: tc.id,
              type: 'FUNCTION',
              name: tc.name,
              arguments: JSON.stringify(tc.arguments || {}),
            } as GenerativeAiInference.models.FunctionCall));
            console.log('[OCIGenAI] Assistant message tool calls (with responses):', assistantMsg.toolCalls.map(tc => tc.id));
          } else {
            // Strip orphaned toolCalls - they don't have corresponding tool messages
            const orphanedIds = msg.toolCalls.filter(tc => !toolMessageIds.has(tc.id)).map(tc => tc.id);
            console.log('[OCIGenAI] Stripping orphaned toolCalls (no tool messages):', orphanedIds);
            // Ensure content is set when we strip toolCalls
            if (!assistantMsg.content) {
              assistantMsg.content = [
                {
                  type: 'TEXT',
                  text: msg.content || 'I attempted to use a tool.',
                } as GenerativeAiInference.models.TextContent,
              ];
            }
          }
        }
        
        genericMessages.push(assistantMsg);
      } else if (msg.role === 'tool') {
        // Handle tool result messages
        console.log('[OCIGenAI] Adding tool message with toolCallId:', msg.toolCallId);
        genericMessages.push({
          role: 'TOOL',
          toolCallId: msg.toolCallId,
          content: [
            {
              type: 'TEXT',
              text: msg.content || '',
            } as GenerativeAiInference.models.TextContent,
          ],
        } as GenerativeAiInference.models.ToolMessage);
      }
    }
    
    // Build the request object using SDK types
    const request: GenerativeAiInference.models.GenericChatRequest = {
      apiFormat: 'GENERIC',
      messages: genericMessages,
      maxTokens: 2048,
      temperature: 0,
      isStream: false,
    };
    
    // Log the request for debugging
    console.log('[OCIGenAI] Generic request:', JSON.stringify({
      apiFormat: 'GENERIC',
      messagesCount: genericMessages.length,
      messageRoles: genericMessages.map(m => m.role),
    }, null, 2));
    
    // Add tools if provided (generic format supports tools)
    if (tools && tools.length > 0) {
      request.tools = this.convertToolsToGenericFormat(tools);
      console.log('[OCIGenAI] Added tools for generic model:', request.tools?.length);
    }
    
    return request;
  }

  /**
   * Convert tools to OCI Generic format (OpenAI-compatible).
   * Cleans up Zod schema internal fields that shouldn't be serialized.
   */
  private convertToolsToGenericFormat(tools: Tool[]): GenerativeAiInference.models.ToolDefinition[] {
    return tools.map((tool) => {
      // Clean the input schema to remove Zod internal fields
      const cleanedSchema = this.cleanJsonSchema(tool.inputSchema);
      
      return {
        type: 'FUNCTION',
        name: tool.name,
        description: tool.description || '',
        parameters: cleanedSchema,
      } as GenerativeAiInference.models.FunctionDefinition;
    });
  }

  /**
   * Clean JSON schema by removing Zod internal fields and converting Zod schemas to JSON Schema.
   */
  private cleanJsonSchema(schema: Record<string, unknown> | undefined): Record<string, unknown> {
    if (!schema) {
      return { type: 'object', properties: {} };
    }
    
    // Check if this is a Zod schema (has _def field)
    if (schema._def && typeof schema._def === 'object') {
      return this.zodToJsonSchema(schema);
    }
    
    // Create a clean copy without Zod internal fields
    const cleaned: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(schema)) {
      // Skip Zod internal fields
      if (key === '_def' || key === '~standard' || key === '_cached' || key.startsWith('_')) {
        continue;
      }
      
      // Recursively clean nested objects
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        cleaned[key] = this.cleanJsonSchema(value as Record<string, unknown>);
      } else if (Array.isArray(value)) {
        // Clean arrays of objects
        cleaned[key] = value.map(item => 
          typeof item === 'object' && item !== null 
            ? this.cleanJsonSchema(item as Record<string, unknown>)
            : item
        );
      } else {
        cleaned[key] = value;
      }
    }
    
    // Ensure we have a valid JSON Schema structure
    if (!cleaned.type) {
      cleaned.type = 'object';
    }
    
    return cleaned;
  }

  /**
   * Convert a Zod schema to JSON Schema format.
   */
  private zodToJsonSchema(zodSchema: Record<string, unknown>): Record<string, unknown> {
    const def = zodSchema._def as Record<string, unknown>;
    const typeName = def.typeName as string;
    
    switch (typeName) {
      case 'ZodObject': {
        const shape = def.shape as Record<string, unknown> | undefined;
        const properties: Record<string, unknown> = {};
        const required: string[] = [];
        
        if (shape && typeof shape === 'function') {
          // Zod v3 uses a function for shape
          const shapeObj = (shape as () => Record<string, unknown>)();
          for (const [key, value] of Object.entries(shapeObj)) {
            const propSchema = this.zodToJsonSchema(value as Record<string, unknown>);
            properties[key] = propSchema;
            // Check if required (not optional)
            const propDef = (value as Record<string, unknown>)?._def as Record<string, unknown> | undefined;
            if (propDef?.typeName !== 'ZodOptional') {
              required.push(key);
            }
          }
        } else if (shape && typeof shape === 'object') {
          for (const [key, value] of Object.entries(shape)) {
            const propSchema = this.zodToJsonSchema(value as Record<string, unknown>);
            properties[key] = propSchema;
            const propDef = (value as Record<string, unknown>)?._def as Record<string, unknown> | undefined;
            if (propDef?.typeName !== 'ZodOptional') {
              required.push(key);
            }
          }
        }
        
        return {
          type: 'object',
          properties,
          required: required.length > 0 ? required : undefined,
        };
      }
      
      case 'ZodString':
        return { type: 'string', description: (def.description as string) || '' };
      
      case 'ZodNumber':
        return { type: 'number', description: (def.description as string) || '' };
      
      case 'ZodBoolean':
        return { type: 'boolean', description: (def.description as string) || '' };
      
      case 'ZodArray': {
        const itemType = def.type as Record<string, unknown> | undefined;
        return {
          type: 'array',
          items: itemType ? this.zodToJsonSchema(itemType) : { type: 'string' },
        };
      }
      
      case 'ZodOptional': {
        const innerType = def.innerType as Record<string, unknown> | undefined;
        return innerType ? this.zodToJsonSchema(innerType) : { type: 'string' };
      }
      
      case 'ZodEnum': {
        const values = def.values as string[] | undefined;
        return { type: 'string', enum: values };
      }
      
      default:
        // Default to string for unknown types
        return { type: 'string' };
    }
  }

  /**
   * Parse generic model response (Google Gemini, xAI Grok).
   * Response format: { choices: [{ message: { content: [{ type: "TEXT", text: "..." }] } }] }
   */
  private parseGenericResponse(response: GenerativeAiInference.responses.ChatResponse): StreamChunk {
    let content: string | undefined;
    let toolCalls: ToolCall[] | undefined;
    let finishReason = 'stop';

    const chatResponse = response.chatResult?.chatResponse;
    console.log('[OCIGenAI] Parsing generic response:', JSON.stringify(chatResponse, null, 2).slice(0, 1000));

    if (chatResponse) {
      const genericResponse = chatResponse as Record<string, unknown>;
      
      // Primary format: choices array (Gemini/Grok response format)
      // { choices: [{ message: { content: [{ type: "TEXT", text: "..." }], role: "ASSISTANT" }, finish-reason: "stop" }] }
      if (genericResponse.choices && Array.isArray(genericResponse.choices)) {
        const firstChoice = genericResponse.choices[0] as Record<string, unknown> | undefined;
        if (firstChoice) {
          // Get finish reason (handle different naming conventions)
          const fr = firstChoice['finish-reason'] || firstChoice.finishReason || firstChoice['finish_reason'];
          if (fr) {
            finishReason = fr as string;
          }
          
          // Get message content
          const message = firstChoice.message as Record<string, unknown> | undefined;
          if (message?.content) {
            // Content is an array of { type: "TEXT", text: "..." }
            if (Array.isArray(message.content)) {
              const textContent = message.content.find(
                (c: unknown) => typeof c === 'object' && c !== null && (c as Record<string, unknown>).type === 'TEXT'
              ) as Record<string, unknown> | undefined;
              if (textContent?.text) {
                content = textContent.text as string;
              }
            } else if (typeof message.content === 'string') {
              content = message.content;
            }
          }
          
          // Check for tool calls in the message (OCI GENERIC format)
          // Format: { toolCalls: [{ type: "FUNCTION", name: "...", arguments: "..." }] }
          const rawToolCalls = message?.toolCalls || message?.tool_calls;
          if (rawToolCalls && Array.isArray(rawToolCalls)) {
            toolCalls = rawToolCalls.map((tc: Record<string, unknown>, i: number) => {
              let args: Record<string, unknown> = {};
              
              // OCI format: arguments is directly on the tool call as a JSON string
              if (tc.arguments) {
                args = typeof tc.arguments === 'string' 
                  ? JSON.parse(tc.arguments) 
                  : tc.arguments as Record<string, unknown>;
              }
              // OpenAI format fallback: arguments is in tc.function.arguments
              else if (tc.function) {
                const func = tc.function as Record<string, unknown>;
                if (func.arguments) {
                  args = typeof func.arguments === 'string' 
                    ? JSON.parse(func.arguments) 
                    : func.arguments as Record<string, unknown>;
                }
              }
              // Cohere format fallback
              else if (tc.parameters) {
                args = tc.parameters as Record<string, unknown>;
              }
              
              // Get tool name - OCI format has it directly, OpenAI has it in function
              const toolName = (tc.name as string) || 
                              ((tc.function as Record<string, unknown>)?.name as string) || 
                              '';
              
              // Generate unique ID if not provided - use timestamp + index for uniqueness
              const toolId = (tc.id as string) || `tool_${Date.now()}_${i}`;
              
              return {
                id: toolId,
                name: toolName,
                arguments: args,
              };
            });
            finishReason = 'tool_calls';
          }
        }
      }
      
      // Fallback: direct content array
      if (!content && genericResponse.content && Array.isArray(genericResponse.content)) {
        const textContent = genericResponse.content.find(
          (c: unknown) => typeof c === 'object' && c !== null && (c as Record<string, unknown>).type === 'TEXT'
        ) as Record<string, unknown> | undefined;
        if (textContent?.text) {
          content = textContent.text as string;
        }
      }
      
      // Fallback: direct text field
      if (!content && genericResponse.text) {
        content = genericResponse.text as string;
      }

      if (genericResponse.finishReason) {
        finishReason = genericResponse.finishReason as string;
      }
    }

    console.log('[OCIGenAI] Parsed content:', content?.slice(0, 200));
    return {
      content,
      toolCalls,
      finishReason,
    };
  }

  /**
   * Stream chat completion from OCI GenAI service.
   *
   * @param messages - Conversation history
   * @param modelId - ID of the model to use
   * @param tools - Optional list of available tools
   * @yields StreamChunk objects containing response content or tool calls
   */
  async *streamChat(messages: ChatMessage[], modelId: string, tools?: Tool[], maxTokens?: number): AsyncGenerator<StreamChunk> {
    const client = await this.getClient();
    const apiFormat = this.getApiFormat(modelId);

    try {
      let chatRequest: GenerativeAiInference.models.BaseChatRequest;
      
      if (apiFormat === 'GENERIC') {
        // Use generic format for Google/xAI models
        chatRequest = this.buildGenericChatRequest(messages, tools);
        console.log(`[OCIGenAI] Using GENERIC format for model: ${modelId}`);
        console.log(`[OCIGenAI] Request messages count: ${(chatRequest as { messages?: unknown[] }).messages?.length}`);
      } else {
        // Use Cohere format for Cohere/Meta models
        const { chatHistory, currentMessage, toolResults } = this.buildChatHistory(messages);

        // Disable streaming when tools are provided or when sending tool results
        const useStream = !tools && toolResults.length === 0;

        // Build chat request
        const cohereRequest = {
          apiFormat: 'COHERE',
          chatHistory: chatHistory.length > 0 ? chatHistory : undefined,
          isStream: useStream,
          maxTokens: maxTokens || 2000,
          temperature: 0,
          message: '',
        } as GenerativeAiInference.models.CohereChatRequest;
        
        // Add preamble if set (system instructions)
        // Note: Preamble seems to cause issues with the SDK, so we'll skip it for now
        // if (this.systemPreamble) {
        //   cohereRequest.preamble = 'You are a helpful assistant.';
        // }

        // Handle message vs tool_results (mutually exclusive in Cohere API)
        if (toolResults.length > 0) {
          cohereRequest.message = '';
          cohereRequest.toolResults = toolResults;
        } else {
          cohereRequest.message = currentMessage || 'Hello';
        }

        // Add tools if provided (and not sending tool results)
        if (tools && tools.length > 0 && toolResults.length === 0) {
          cohereRequest.tools = this.convertToolsToOCIFormat(tools);
          console.log(`[OCIGenAI] Cohere tools count: ${cohereRequest.tools?.length}`);
        }
        
        chatRequest = cohereRequest;
        console.log(`[OCIGenAI] Using COHERE format for model: ${modelId}`);
        console.log(`[OCIGenAI] Cohere request:`, JSON.stringify({
          apiFormat: cohereRequest.apiFormat,
          message: cohereRequest.message?.slice(0, 100),
          chatHistoryLength: cohereRequest.chatHistory?.length,
          toolsCount: cohereRequest.tools?.length,
          hasToolResults: toolResults.length > 0,
        }, null, 2));
      }

      // Create inference request
      const chatDetails: GenerativeAiInference.models.ChatDetails = {
        compartmentId: this.config.compartmentId,
        servingMode: {
          servingType: 'ON_DEMAND',
          modelId: modelId,
        } as GenerativeAiInference.models.OnDemandServingMode,
        chatRequest: chatRequest,
      };

      // Execute request with retry logic for rate limiting
      const response = await this.executeWithRetry(
        () => client.chat({ chatDetails }),
        'chat'
      );

      if (!response) {
        throw new OCIGenAIProviderError('No response received from OCI GenAI service');
      }

      // Log response structure for debugging
      console.log(`[OCIGenAI] Response type: ${typeof response}, keys: ${Object.keys(response as object).join(', ')}`);

      // Handle different response types more flexibly
      const responseObj = response as unknown as Record<string, unknown>;
      
      // Check if it's a ChatResponse with chatResult
      if ('chatResult' in responseObj && responseObj.chatResult) {
        const chatResult = responseObj.chatResult as Record<string, unknown>;
        console.log(`[OCIGenAI] ChatResult keys: ${Object.keys(chatResult).join(', ')}`);
        
        // Check for streaming events
        if ('events' in chatResult && typeof (chatResult as { events?: () => unknown }).events === 'function') {
          const events = (chatResult as { events: () => Iterable<unknown> }).events();
          for (const event of events) {
            const chunk = this.parseStreamEvent(event);
            if (chunk) {
              yield chunk;
            }
          }
        } 
        // Check for chatResponse (non-streaming)
        else if ('chatResponse' in chatResult) {
          if (apiFormat === 'GENERIC') {
            yield this.parseGenericResponse(response as GenerativeAiInference.responses.ChatResponse);
          } else {
            yield this.parseResponse(response as GenerativeAiInference.responses.ChatResponse);
          }
        }
        // Try to extract content directly from chatResult
        else {
          const content = this.extractContentFromResult(chatResult, apiFormat);
          if (content) {
            yield { content, finishReason: 'stop' };
          } else {
            console.log(`[OCIGenAI] Could not extract content from chatResult:`, JSON.stringify(chatResult).slice(0, 500));
            throw new OCIGenAIProviderError('Could not parse response from model');
          }
        }
      }
      // Handle direct response object (some models may return differently)
      else if ('text' in responseObj || 'content' in responseObj || 'choices' in responseObj) {
        const content = this.extractContentFromResult(responseObj, apiFormat);
        if (content) {
          yield { content, finishReason: 'stop' };
        }
      }
      else {
        console.log(`[OCIGenAI] Unexpected response structure:`, JSON.stringify(responseObj).slice(0, 500));
        throw new OCIGenAIProviderError('Unexpected response structure from OCI GenAI service');
      }
    } catch (error) {
      // Re-throw rate limit errors as-is (they have retry info)
      if (error instanceof OCIGenAIRateLimitError) {
        throw error;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('401') || errorMessage.toLowerCase().includes('authentication')) {
        throw new OCIGenAIAuthError(`Authentication failed: ${errorMessage}`);
      }
      
      // Check for rate limit errors that weren't caught by retry logic
      if (
        errorMessage.includes('throttled') ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('service request limit') ||
        errorMessage.includes('429') ||
        errorMessage.includes('too many requests')
      ) {
        throw new OCIGenAIRateLimitError(
          'Rate limit exceeded. Please wait a moment before sending another message.',
          5000
        );
      }

      throw new OCIGenAIProviderError(`Chat completion failed: ${errorMessage}`);
    }
  }

  /**
   * Extract content from various response formats.
   */
  private extractContentFromResult(result: Record<string, unknown>, apiFormat: string): string | undefined {
    // Try direct text field
    if (typeof result.text === 'string') {
      return result.text;
    }
    
    // Try content array (generic format)
    if (result.content && Array.isArray(result.content)) {
      for (const item of result.content) {
        if (typeof item === 'object' && item !== null) {
          const contentItem = item as Record<string, unknown>;
          if (contentItem.type === 'TEXT' && typeof contentItem.text === 'string') {
            return contentItem.text;
          }
          if (typeof contentItem.text === 'string') {
            return contentItem.text;
          }
        }
        if (typeof item === 'string') {
          return item;
        }
      }
    }
    
    // Try choices array (OpenAI-like format)
    if (result.choices && Array.isArray(result.choices)) {
      const firstChoice = result.choices[0] as Record<string, unknown> | undefined;
      if (firstChoice?.message) {
        const message = firstChoice.message as Record<string, unknown>;
        if (typeof message.content === 'string') {
          return message.content;
        }
      }
      if (firstChoice?.text && typeof firstChoice.text === 'string') {
        return firstChoice.text;
      }
    }
    
    // Try chatResponse nested object
    if (result.chatResponse && typeof result.chatResponse === 'object') {
      return this.extractContentFromResult(result.chatResponse as Record<string, unknown>, apiFormat);
    }
    
    // Try message field
    if (result.message && typeof result.message === 'object') {
      const message = result.message as Record<string, unknown>;
      if (typeof message.content === 'string') {
        return message.content;
      }
    }
    
    return undefined;
  }
}
