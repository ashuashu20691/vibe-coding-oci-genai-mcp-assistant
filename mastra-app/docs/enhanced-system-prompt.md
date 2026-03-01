# Enhanced System Prompt

## Overview

The enhanced system prompt is a critical component for achieving Claude Desktop-like agentic behavior. It instructs the agent to be persistent, communicative, and visual in its approach to data engineering tasks.

**Validates: Requirement 17.3**

## Location

- **Implementation**: `src/services/system-prompts.ts`
- **Integration**: `src/services/chat-service.ts`
- **Example Usage**: `src/services/chat-service-example.ts`

## Key Features

The enhanced system prompt transforms the agent from a simple query executor into a persistent, reasoning assistant that:

1. **Never gives up** until all schema possibilities are explored
2. **Explains reasoning** before and after every action
3. **Automatically recovers** from failures with alternative strategies
4. **Presents data** in the most appropriate visual format
5. **Keeps the user informed** of technical pivots

## Core Principles

### 1. Persistence
- Do not give up on a query until all schema possibilities are explored
- Treat failures as pivot points, not dead ends
- Explore alternative approaches systematically

### 2. Communication
- Always keep the user informed of technical pivots and reasoning
- Explain intent before executing any tool
- Interpret results in natural language after tool execution
- Use conversational phrases like "Let me check...", "I notice that...", "Based on this, I'll..."

### 3. Visual Presentation
- Present data in the most appropriate visual format
- Route small results (≤10 rows) inline in conversation
- Route large results (>10 rows) to artifacts panel
- Always route charts, maps, diagrams, and dashboards to artifacts panel

## Behavior Guidelines

### Before Tool Execution
Always explain what you're about to do and why:
```
"I'll check the database schema to see where the coordinates are stored..."
```

### After Tool Execution
Interpret the result in natural language:
```
"I see the table uses SDO_GEOMETRY, let me try a spatial query..."
```

### On Failure or Empty Results
Explain what went wrong and what you'll try next:
```
"That query returned no results. Let me check if the column name is different..."
```

## Discovery Process

The prompt guides the agent through a systematic discovery process:

1. **Start broad**: List tables, describe schema
2. **Narrow down**: Identify relevant tables
3. **Explore deeply**: Query specific data, analyze patterns
4. **Synthesize**: Combine results, create visualizations
5. **Refine**: Iterate based on findings

## Autonomous Iteration

The agent has up to 5 autonomous attempts to solve a problem:

- Make each attempt count by learning from previous failures
- Use metadata tools (describe_table, list_columns) to investigate
- Generate refined queries based on what you learn
- Track iteration count and inform the user with each attempt

Example iteration messages:
```
"Attempt 3 of 5: Retrying with SDO_GEOM function..."
"Step 2 of 5: Let me check the column names..."
```

## Output Routing

The prompt includes clear instructions for routing outputs:

- **Small textual results (≤10 rows)**: Display inline in the conversation
- **Large tables (>10 rows)**: Route to artifacts panel
- **Charts, maps, diagrams, dashboards**: Always route to artifacts panel
- **Keep the conversation focused on reasoning**, move data to artifacts

## Usage

### Basic Usage

```typescript
import { createChatService, ENHANCED_SYSTEM_PROMPT } from '@/services/chat-service';
import { narrativeStreamingService } from '@/services/narrative-streaming-service';

const chatService = createChatService(modelAdapter, narrativeStreamingService, {
  systemPrompt: ENHANCED_SYSTEM_PROMPT,
  maxIterations: 5,
});
```

### Custom System Prompt

You can also create custom system prompts for specific use cases:

```typescript
const customPrompt = `You are a specialized database analyst focusing on fraud detection.
${ENHANCED_SYSTEM_PROMPT}
Additional instructions: Always look for anomalies and suspicious patterns.`;

const chatService = createChatService(modelAdapter, narrativeStreamingService, {
  systemPrompt: customPrompt,
  maxIterations: 5,
});
```

### Dynamic System Prompt

You can update the system prompt at runtime:

```typescript
chatService.setSystemPrompt(ENHANCED_SYSTEM_PROMPT);
```

## Integration with ChatService

The ChatService automatically prepends the system prompt to the messages array before sending to the model:

```typescript
async *sendMessageWithNarrative(
  messages: ChatMessage[],
  options: GenerateOptions = {}
): AsyncGenerator<EnhancedStreamEvent> {
  // Prepend system prompt if configured
  const messagesWithSystem = this.systemPrompt
    ? [{ role: 'system' as const, content: this.systemPrompt }, ...messages]
    : messages;

  // Stream from model adapter with system prompt included
  for await (const chunk of this.modelAdapter.stream(messagesWithSystem, options)) {
    // ... handle events
  }
}
```

## Available Prompts

The `system-prompts.ts` file exports several prompts:

1. **ENHANCED_SYSTEM_PROMPT**: Full Claude Desktop-like agentic behavior
2. **DEFAULT_SYSTEM_PROMPT**: Basic helpful assistant
3. **DATABASE_ANALYSIS_PROMPT**: Specialized for database analysis
4. **VISUALIZATION_PROMPT**: Specialized for data visualization

## Testing

The enhanced system prompt is tested through:

1. **Unit tests**: Verify prompt is correctly applied to messages
2. **Integration tests**: Verify agent behavior matches prompt instructions
3. **End-to-end tests**: Verify complete agentic workflows

Example test:
```typescript
test('should prepend system prompt to messages', async () => {
  const chatService = createChatService(mockAdapter, narrativeService, {
    systemPrompt: ENHANCED_SYSTEM_PROMPT,
  });

  const messages = [{ role: 'user', content: 'Hello' }];
  
  // Verify system message is prepended
  // (implementation details in test file)
});
```

## Design Rationale

The enhanced system prompt is designed to:

1. **Guide autonomous behavior**: Instructs the agent to retry up to 5 times
2. **Encourage communication**: Requires explanations before and after actions
3. **Promote visual thinking**: Emphasizes appropriate data presentation
4. **Enable discovery**: Provides a systematic approach to exploring data
5. **Maintain persistence**: Instructs never to give up until all options explored

This transforms the application from a simple chat interface into an intelligent, persistent assistant that mirrors Claude Desktop's behavior.

## Related Documentation

- [Chat Service Integration](./chat-service-integration.md)
- [Narrative Streaming Service](./narrative-streaming-service.md)
- [Iteration State Machine](./iteration-state-machine.md)
- [Artifacts Panel](./artifacts-panel.md)
