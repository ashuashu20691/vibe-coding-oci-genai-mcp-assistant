# ToolExecutionDisplay Component

A Claude Desktop-style expandable tool execution display component that shows tool execution details with a collapsible interface.

## Features

- **Collapsible/Expandable**: Click to toggle between collapsed and expanded states
- **Tool Name Display**: Prominently shows formatted tool name in collapsed state
- **Status Color Coding**: Visual feedback with color-coded backgrounds
  - Green: Completed
  - Amber: Executing/Pending
  - Red: Failed
- **Parameter Display**: Shows formatted JSON parameters in expanded state
- **Smooth Animations**: Expand/collapse with smooth transitions
- **Defensive Programming**: Handles null/undefined values gracefully
- **Accessible**: Proper ARIA attributes for screen readers

## Requirements Validated

- **Requirement 12.2**: Tool execution display with expandable details
- **Requirement 12.5**: Shows tool name, parameters, and request payload
- **Requirement 0.2**: Defensive null checking for all tool properties

## Usage

### Basic Usage

```tsx
import { ToolExecutionDisplay } from '@/components/ToolExecutionDisplay';

function MyComponent() {
  const toolCall = {
    id: 'tool-1',
    name: 'sqlcl_execute_query',
    arguments: {
      connection_name: 'BASE_DB_23AI',
      query: 'SELECT * FROM suppliers',
    },
  };

  return (
    <ToolExecutionDisplay 
      toolCall={toolCall} 
      status="completed" 
    />
  );
}
```

### With Different Statuses

```tsx
// Pending
<ToolExecutionDisplay toolCall={toolCall} status="pending" />

// Executing
<ToolExecutionDisplay toolCall={toolCall} status="executing" />

// Completed
<ToolExecutionDisplay toolCall={toolCall} status="completed" />

// Failed
<ToolExecutionDisplay toolCall={toolCall} status="failed" />
```

### Multiple Tool Calls

```tsx
function ToolExecutionList({ toolCalls }) {
  return (
    <div>
      {toolCalls.map((toolCall) => (
        <ToolExecutionDisplay
          key={toolCall.id}
          toolCall={toolCall}
          status="completed"
        />
      ))}
    </div>
  );
}
```

## Props

### `toolCall` (required)

Type: `ToolCall`

The tool call object containing:
- `id`: Unique identifier
- `name`: Tool name (will be formatted for display)
- `arguments`: Tool parameters (displayed as JSON)

### `status` (optional)

Type: `'pending' | 'executing' | 'completed' | 'failed'`

Default: `'completed'`

The execution status of the tool, which determines the background color.

## Styling

The component uses inline styles that match Claude Desktop's design language:

- **Font Family**: System fonts (-apple-system, BlinkMacSystemFont, etc.)
- **Colors**: 
  - Completed: `#D1FAE5` (light green)
  - Executing/Pending: `#FEF3C7` (light amber)
  - Failed: `#FEE2E2` (light red)
- **Typography**: 
  - Tool name: 14px, weight 600
  - Status: 12px, muted color
  - Parameters: 13px, monospace font
- **Spacing**: 
  - Padding: 10px 14px
  - Border radius: 6px
  - Margin bottom: 12px

## Tool Name Formatting

Tool names are automatically formatted for better readability:

- Removes `sqlcl_` prefix
- Removes `mcp_` prefix
- Converts underscores/hyphens to spaces
- Capitalizes each word

Examples:
- `sqlcl_execute_query` → "Execute Query"
- `mcp_list_tools` → "List Tools"
- `get_user_data` → "Get User Data"

## Defensive Programming

The component handles edge cases gracefully:

- Returns `null` if `toolCall` is null/undefined
- Shows "Unknown Tool" if name is missing
- Shows "No parameters" if arguments are empty/undefined
- Safely stringifies arguments that may not be valid JSON

## Accessibility

- Uses semantic `<button>` element for toggle
- Includes `aria-expanded` attribute
- Provides descriptive `aria-label`
- Keyboard accessible (Space/Enter to toggle)

## Integration Options

This component can be integrated in several ways:

1. **Debugging Panel**: Show tool execution history during development
2. **Tool History View**: Dedicated page/panel for viewing past tool executions
3. **Feature Flag**: Conditionally show in messages based on user preference
4. **Admin Interface**: Monitor tool executions in admin dashboard
5. **Separate Panel**: Tools sidebar or floating panel

## Current Integration Status

The component is **fully integrated** into the MessageList component and will display whenever messages contain tool calls. Tool execution displays appear above the message content, showing:

- Tool name (formatted for readability)
- Execution status (with color coding)
- Expandable details showing parameters

The integration validates Requirements 12.2 and 12.5 from the Claude Desktop Parity specification.

## Testing

Comprehensive unit tests are available in `__tests__/unit/ToolExecutionDisplay.test.tsx`:

- Collapsed state behavior
- Expanded state behavior
- Status color coding
- Defensive null checking
- Tool name formatting
- Accessibility features
- Animation behavior

Run tests:
```bash
npm test -- ToolExecutionDisplay.test --run
```

## Example

See `ToolExecutionDisplay.example.tsx` for complete usage examples including:
- Basic usage with different statuses
- Tool execution panel component
- Integration patterns
