// src/mastra/providers/oci-model-adapter.ts
/**
 * OCI GenAI Model Adapter for Mastra Agent framework.
 * Provides a compatible interface between OCI GenAI and Mastra's model expectations.
 */

import { OCIGenAIProvider, ChatMessage } from './oci-genai';
import { Tool, ToolCall } from '../../types';
import { DatabaseOrchestrator } from '../agents/orchestrator';

export interface OCIModelConfig {
  provider: OCIGenAIProvider;
  modelId: string;
  temperature?: number;
  maxTokens?: number;
  conversationId?: string;
}

export interface StreamChunk {
  type: 'text-delta' | 'tool-call' | 'tool-result' | 'finish' | 'error';
  textDelta?: string;
  toolCall?: ToolCall;
  toolResult?: {
    toolCallId: string;
    result: unknown;
  };
  finishReason?: string;
  error?: string;
}

export interface GenerateOptions {
  tools?: Tool[];
  toolsets?: Record<string, Record<string, unknown>>;
  maxSteps?: number;
  onStepFinish?: (step: StepResult) => void;
}

export interface StepResult {
  text: string;
  toolCalls: ToolCall[];
  toolResults: Array<{ toolCallId: string; result: unknown }>;
  finishReason: string;
}

/**
 * OCI GenAI Model Adapter that provides Mastra-compatible streaming.
 */
export class OCIModelAdapter {
  private provider: OCIGenAIProvider;
  private modelId: string;
  private temperature: number;
  private maxTokens: number;
  private conversationId: string;
  private orchestrator: DatabaseOrchestrator;

  constructor(config: OCIModelConfig) {
    this.provider = config.provider;
    this.modelId = config.modelId;
    this.temperature = config.temperature ?? 0;
    this.maxTokens = config.maxTokens ?? 700;
    this.conversationId = config.conversationId || 'default';
    this.orchestrator = new DatabaseOrchestrator(this.conversationId, this.modelId);
  }

  /**
   * Stream chat completion with tool support.
   */
  async *stream(
    messages: ChatMessage[],
    options: GenerateOptions = {}
  ): AsyncGenerator<StreamChunk> {
    const { tools, toolsets, maxSteps = 5, onStepFinish } = options;

    // Convert toolsets to tools array if provided
    let allTools: Tool[] = tools || [];
    if (toolsets) {
      for (const [, serverTools] of Object.entries(toolsets)) {
        for (const [toolName, tool] of Object.entries(serverTools)) {
          const toolObj = tool as {
            description?: string;
            inputSchema?: Record<string, unknown>;
            execute?: (args: unknown) => Promise<unknown>;
          };
          allTools.push({
            name: `sqlcl_${toolName.replace(/-/g, '_')}`,
            description: toolObj.description || `Tool: ${toolName}`,
            inputSchema: toolObj.inputSchema || {},
          });
        }
      }
    }

    let currentMessages = [...messages];
    let stepCount = 0;
    let lastError: { message: string; failedSql?: string; toolName?: string } | null = null;
    let consecutiveValidationErrors = 0;
    const MAX_VALIDATION_RETRIES = 2;

    while (stepCount < maxSteps) {
      stepCount++;
      let stepText = '';
      const stepToolCalls: ToolCall[] = [];
      const stepToolResults: Array<{ toolCallId: string; result: unknown; hasError: boolean }> = [];
      let finishReason = '';

      try {
        // If there was an error in the previous step, add a forceful retry message
        if (lastError) {
          // Check if this is a repeated validation error - if so, stop retrying
          if (lastError.message.includes('validation failed') && consecutiveValidationErrors >= MAX_VALIDATION_RETRIES) {
            console.log(`[OCIModelAdapter] Max validation retries (${MAX_VALIDATION_RETRIES}) reached, stopping`);
            yield { 
              type: 'text-delta', 
              textDelta: `\n\nI apologize, but I'm having trouble with the tool parameters. The ${lastError.toolName || 'tool'} requires specific parameters that I'm not providing correctly. Please try rephrasing your request or specify the exact parameter values needed.` 
            };
            yield { type: 'finish', finishReason: 'error' };
            break;
          }
          
          const retryMessage = this.buildRetryMessage(lastError);
          currentMessages.push({
            role: 'user',
            content: retryMessage,
          });
          console.log(`[OCIModelAdapter] Added retry message: ${retryMessage.slice(0, 200)}...`);
          lastError = null;
        }

        // Stream from OCI GenAI
        for await (const chunk of this.provider.streamChat(
          currentMessages,
          this.modelId,
          allTools.length > 0 ? allTools : undefined
        )) {
          // Handle text content
          if (chunk.content) {
            stepText += chunk.content;
            yield { type: 'text-delta', textDelta: chunk.content };
          }

          // Handle tool calls
          if (chunk.toolCalls && chunk.toolCalls.length > 0) {
            for (const tc of chunk.toolCalls) {
              stepToolCalls.push(tc);
              yield { type: 'tool-call', toolCall: tc };
            }
          }

          // Handle finish reason
          if (chunk.finishReason) {
            finishReason = chunk.finishReason;
          }
        }

        // Execute tool calls if any using the orchestrator
        if (stepToolCalls.length > 0 && toolsets) {
          // First, add the assistant message with tool calls (once, not per tool)
          currentMessages.push({
            role: 'assistant',
            content: stepText,
            toolCalls: stepToolCalls,
          });
          
          for (let i = 0; i < stepToolCalls.length; i++) {
            const tc = stepToolCalls[i];
            
            // Add a small delay between tool calls to help with rate limiting
            // Skip delay for the first tool call
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            const result = await this.executeToolCall(tc, toolsets);
            
            // Check if result has an error
            const hasError = this.isErrorResult(result);
            if (hasError) {
              const errorMsg = this.extractErrorMessage(result);
              // Extract the SQL that failed for better retry context
              const failedSql = tc.arguments?.sql_query || tc.arguments?.sql || tc.arguments?.sqlcl;
              lastError = { 
                message: errorMsg, 
                failedSql: typeof failedSql === 'string' ? failedSql : undefined,
                toolName: tc.name,
              };
              console.log(`[OCIModelAdapter] Tool error detected: ${errorMsg}`);
              
              // Track validation errors specifically
              if (errorMsg.includes('validation failed')) {
                consecutiveValidationErrors++;
              } else {
                consecutiveValidationErrors = 0;
              }
            } else {
              consecutiveValidationErrors = 0;
            }
            
            stepToolResults.push({ toolCallId: tc.id, result, hasError });
            yield { type: 'tool-result', toolResult: { toolCallId: tc.id, result } };

            // Add tool result to messages for next iteration
            currentMessages.push({
              role: 'tool',
              content: JSON.stringify(result),
              toolCallId: tc.id,
            });
          }
        }

        // Call step finish callback
        if (onStepFinish) {
          onStepFinish({
            text: stepText,
            toolCalls: stepToolCalls,
            toolResults: stepToolResults.map(r => ({ toolCallId: r.toolCallId, result: r.result })),
            finishReason,
          });
        }

        // Continue if there was an error (to allow retry)
        const hasErrors = stepToolResults.some(r => r.hasError);
        
        // Detect if model said it would retry but didn't make a tool call
        const saidWillRetry = this.detectRetryIntent(stepText);
        
        // If no tool calls and no errors to retry, we're done (unless model said it would retry)
        if (stepToolCalls.length === 0 && !hasErrors && !saidWillRetry) {
          yield { type: 'finish', finishReason };
          break;
        }
        
        // If model said it would retry but didn't make a tool call, force another iteration
        if (stepToolCalls.length === 0 && saidWillRetry) {
          console.log(`[OCIModelAdapter] Model said it would retry but didn't make tool call, forcing retry`);
          lastError = { message: 'You said you would retry but did not make a tool call. Please make the tool call now.' };
          currentMessages.push({
            role: 'assistant',
            content: stepText,
          });
          continue;
        }
        
        // If there were tool calls with errors, continue to retry
        if (hasErrors) {
          console.log(`[OCIModelAdapter] Continuing due to error, step ${stepCount}/${maxSteps}`);
          continue;
        }
        
        // If there were successful tool calls, check if we should continue
        // For GENERIC format models, we need to send tool results back and let the model decide
        if (stepToolCalls.length > 0 && !hasErrors) {
          // Check if finish reason indicates the model wants to continue (tool_calls)
          // or if it's done (stop, COMPLETE)
          const shouldContinue = finishReason === 'tool_calls' || 
                                  finishReason === 'tool_use' ||
                                  !finishReason;
          
          if (shouldContinue && stepCount < maxSteps) {
            console.log(`[OCIModelAdapter] Tool calls completed, continuing to let model process results (step ${stepCount}/${maxSteps})`);
            // The tool results are already added to currentMessages, so the next iteration
            // will send them to the model
            continue;
          }
          
          yield { type: 'finish', finishReason: finishReason || 'stop' };
          break;
        }
      } catch (error) {
        yield {
          type: 'error',
          error: error instanceof Error ? error.message : String(error),
        };
        break;
      }
    }
  }

  /**
   * Detect if the model's response indicates it intends to retry.
   */
  private detectRetryIntent(text: string): boolean {
    const lowerText = text.toLowerCase();
    const retryPhrases = [
      'i\'ll try again',
      'i will try again',
      'let me try again',
      'trying again',
      'i\'ll retry',
      'i will retry',
      'let me retry',
      'i\'ll fix',
      'i will fix',
      'let me fix',
      'i\'ll correct',
      'i will correct',
      'let me correct',
      'i\'ll use a different',
      'i will use a different',
    ];
    
    return retryPhrases.some(phrase => lowerText.includes(phrase));
  }

  /**
   * Build a forceful retry message that instructs the model to make a tool call.
   */
  private buildRetryMessage(error: { message: string; failedSql?: string; toolName?: string }): string {
    const errorMsg = error.message;
    const toolName = error.toolName || 'the tool';
    
    // Detect validation errors and provide specific parameter guidance
    if (errorMsg.includes('validation failed') || errorMsg.includes('Required')) {
      // Extract the missing parameter name from the error
      const paramMatch = errorMsg.match(/- (\w+): Required/);
      const missingParam = paramMatch ? paramMatch[1] : 'required parameter';
      
      // Provide specific guidance based on the tool
      if (toolName.includes('connect')) {
        return `ERROR: The sqlcl_connect tool requires a "connection_name" parameter.

EXAMPLE: To connect to a database named "insurance-app", call:
sqlcl_connect with arguments: { "connection_name": "insurance-app" }

First, call sqlcl_list_connections to see available connection names, then call sqlcl_connect with the correct connection_name.`;
      }
      
      if (toolName.includes('run_sql') || toolName.includes('run-sql')) {
        return `ERROR: The sqlcl_run_sql tool requires a "sql" parameter (NOT "sql_query").

EXAMPLE: To run a SELECT query, call:
sqlcl_run_sql with arguments: { "sql": "SELECT * FROM employees" }

Make sure to use the parameter name "sql" (not "sql_query" or "query").`;
      }
      
      if (toolName.includes('run_sqlcl')) {
        return `ERROR: The sqlcl_run_sqlcl tool requires a "sqlcl" parameter.

EXAMPLE: To show tables, call:
sqlcl_run_sqlcl with arguments: { "sqlcl": "show tables" }

Make sure to include the sqlcl parameter with your SQLcl command.`;
      }
      
      return `ERROR: ${toolName} requires the "${missingParam}" parameter.

Please call the tool again with the correct parameters. Check the tool description for required parameters.`;
    }
    
    // Detect specific Oracle errors and provide targeted fixes
    if (errorMsg.includes('ORA-00903') || errorMsg.toLowerCase().includes('invalid table name')) {
      return `ERROR: The SQL failed with "invalid table name". This is because "ORDER" is a reserved keyword in Oracle.

FIX REQUIRED: Change the table name from "order" to "orders" (plural) and execute the corrected SQL.

YOU MUST NOW call sqlcl_run_sql with the corrected SQL. Do not just explain - make the tool call now.`;
    }
    
    if (errorMsg.includes('ORA-00942') || errorMsg.toLowerCase().includes('does not exist')) {
      return `ERROR: Table or view does not exist. Please verify the table name and try again.

YOU MUST NOW call the appropriate tool to fix this. Do not just explain - make the tool call now.`;
    }
    
    if (errorMsg.includes('null connection') || errorMsg.toLowerCase().includes('not connected')) {
      return `ERROR: No database connection. You must connect first.

YOU MUST NOW call sqlcl_connect with the connection_name parameter. Do not just explain - make the tool call now.`;
    }
    
    // Generic error retry
    return `ERROR: The previous operation failed with: "${errorMsg}"

YOU MUST fix the issue and retry by making another tool call NOW. Do not just explain what went wrong - actually call the tool with corrected parameters.

If the error was about a table name, use "orders" instead of "order".
If the error was about parameters, use the correct parameter names:
- sqlcl_run_sql: use "sql" parameter (NOT "sql_query")
- sqlcl_run_sqlcl: use "sqlcl" parameter
- sqlcl_connect: use "connection_name" parameter`;
  }

  /**
   * Check if a tool result indicates an error.
   */
  private isErrorResult(result: unknown): boolean {
    if (!result || typeof result !== 'object') return false;
    
    const obj = result as Record<string, unknown>;
    
    // Check for explicit error flags
    if (obj.error === true || obj.isError === true) return true;
    
    // Check for error in content
    if (obj.content && Array.isArray(obj.content)) {
      for (const item of obj.content) {
        if (typeof item === 'object' && item !== null) {
          const contentItem = item as Record<string, unknown>;
          if (typeof contentItem.text === 'string') {
            const text = contentItem.text.toLowerCase();
            if (text.includes('error') || text.includes('ora-') || text.includes('failed')) {
              return true;
            }
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Extract error message from a tool result.
   */
  private extractErrorMessage(result: unknown): string {
    if (!result || typeof result !== 'object') return 'Unknown error';
    
    const obj = result as Record<string, unknown>;
    
    // Check for error message
    if (typeof obj.error === 'string') return obj.error;
    if (typeof obj.message === 'string') return obj.message;
    
    // Check content for error text
    if (obj.content && Array.isArray(obj.content)) {
      for (const item of obj.content) {
        if (typeof item === 'object' && item !== null) {
          const contentItem = item as Record<string, unknown>;
          if (typeof contentItem.text === 'string') {
            // Extract first line or ORA error
            const text = contentItem.text;
            const oraMatch = text.match(/ORA-\d+:[^\n]+/);
            if (oraMatch) return oraMatch[0];
            return text.split('\n')[0].slice(0, 200);
          }
        }
      }
    }
    
    return 'Tool execution failed';
  }

  /**
   * Execute a tool call using the orchestrator for proper connection management.
   */
  private async executeToolCall(
    toolCall: ToolCall,
    toolsets: Record<string, Record<string, unknown>>
  ): Promise<unknown> {
    // Parse tool name (format: serverName_toolName)
    const parts = toolCall.name.split('_');
    const serverName = parts[0];
    const toolNameWithUnderscores = parts.slice(1).join('_');
    const toolNameWithHyphens = toolNameWithUnderscores.replace(/_/g, '-');

    // Use orchestrator for execution with connection management
    const result = await this.orchestrator.executeTool(toolNameWithHyphens, toolCall.arguments || {});

    if (!result.success) {
      return { error: result.error, isError: true };
    }

    return result.result;
  }

  /**
   * Generate a complete response (non-streaming).
   */
  async generate(
    messages: ChatMessage[],
    options: GenerateOptions = {}
  ): Promise<{ text: string; toolCalls: ToolCall[]; toolResults: Array<{ toolCallId: string; result: unknown }> }> {
    let text = '';
    const toolCalls: ToolCall[] = [];
    const toolResults: Array<{ toolCallId: string; result: unknown }> = [];

    for await (const chunk of this.stream(messages, options)) {
      if (chunk.type === 'text-delta' && chunk.textDelta) {
        text += chunk.textDelta;
      }
      if (chunk.type === 'tool-call' && chunk.toolCall) {
        toolCalls.push(chunk.toolCall);
      }
      if (chunk.type === 'tool-result' && chunk.toolResult) {
        toolResults.push(chunk.toolResult);
      }
    }

    return { text, toolCalls, toolResults };
  }
}
