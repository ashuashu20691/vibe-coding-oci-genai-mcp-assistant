# Result Routing Implementation - Task 24.4

## Overview

This document describes the implementation of result routing logic for tool outputs in the Claude Desktop Alternative application. The routing logic determines whether tool results should be displayed inline in the chat or routed to the artifacts panel.

## Requirements Validated

- **Requirement 15.2**: Route large outputs to artifacts panel
- **Requirement 15.3**: Artifact creation from visualization
- **Requirement 15.4**: Support multiple artifact types
- **Requirement 15.5**: User modification acknowledgments
- **Requirement 18.7**: Keep small/textual results inline

## Implementation

### 1. MAX_INLINE_ROWS Constant

**Location**: `src/types/index.ts`

```typescript
/**
 * Configurable threshold for routing content to artifacts panel
 * Validates: Requirement 15.2
 */
export const MAX_INLINE_ROWS = 10;
```

**Purpose**: Defines the threshold for routing tabular data to the artifacts panel. Tables with more than 10 rows are routed to the artifacts panel, while smaller tables are displayed inline.

**Configurability**: This constant can be easily adjusted for testing or different deployment scenarios by changing the value in one location.

### 2. Result Routing Utility

**Location**: `src/utils/result-routing.ts`

#### `shouldRouteToArtifacts(visualization)`

Determines if a visualization should be routed to the artifacts panel based on size and type.

**Routing Rules**:

1. **Visual Outputs** → Always route to artifacts panel
   - Charts: `bar_chart`, `line_chart`, `pie_chart`, `scatter_chart`, `area_chart`
   - Maps: `map`, `heat_map`
   - Galleries: `photo_gallery`
   - Timelines: `timeline`
   - Diagrams: `mermaid`
   - Dashboards: `custom_dashboard`, `analysis_dashboard`

2. **Large Tables** → Route to artifacts panel
   - Tables with `> MAX_INLINE_ROWS` (more than 10 rows)

3. **Small Tables** → Display inline
   - Tables with `≤ MAX_INLINE_ROWS` (10 rows or fewer)
   - Empty tables
   - Single-row tables

4. **Textual Results** → Display inline
   - String content
   - Status messages
   - Error messages

**Example Usage**:

```typescript
import { shouldRouteToArtifacts } from '@/utils/result-routing';

const visualization = {
  type: 'table',
  data: [{ id: 1 }, { id: 2 }, ...] // 15 rows
};

if (shouldRouteToArtifacts(visualization)) {
  // Route to artifacts panel
  createAndDisplayArtifact(visualization);
} else {
  // Display inline in chat
  displayInlineVisualization(visualization);
}
```

#### `detectResultSizeAndType(data)`

Analyzes tool result data to determine its size and type characteristics.

**Returns**:
```typescript
{
  rowCount: number;      // Number of rows (for tabular data)
  isVisual: boolean;     // True for charts, maps, diagrams
  isTabular: boolean;    // True for array/table data
  isTextual: boolean;    // True for string/text data
}
```

**Example Usage**:

```typescript
import { detectResultSizeAndType } from '@/utils/result-routing';

const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
const info = detectResultSizeAndType(data);

console.log(info);
// {
//   rowCount: 3,
//   isVisual: false,
//   isTabular: true,
//   isTextual: false
// }
```

### 3. Integration in CopilotChatUI

**Location**: `src/components/CopilotChatUI.tsx`

The routing logic is integrated into the message streaming handler:

```typescript
// When visualization event is received from SSE stream
if (p.visualization) {
  setMessages((prev) => {
    const u = [...prev];
    const l = u[u.length - 1];
    if (l?.role === 'assistant') {
      // Check if visualization should route to artifacts panel
      if (shouldRouteToArtifactsPanel(p.visualization)) {
        // Route to artifacts panel
        const newArtifact = createArtifactFromVisualization(p.visualization);
        if (newArtifact) {
          setArtifact(newArtifact, conversationId);
        }
        // Don't add visualization to message, just keep the narrative
      } else {
        // Small visualization - keep inline in message
        u[u.length - 1] = { ...l, visualization: p.visualization };
      }
    }
    return u;
  });
}
```

**Automatic Panel Opening**: When a visualization is routed to the artifacts panel, the `setArtifact` function automatically opens the panel (handled by the `useArtifacts` hook).

## Testing

### Unit Tests

**Location**: `__tests__/unit/result-routing.test.ts`

Comprehensive test coverage for the routing logic:

1. **Large Table Routing** (24 tests total)
   - Tables with > MAX_INLINE_ROWS → Artifacts panel
   - Tables with ≤ MAX_INLINE_ROWS → Inline
   - Boundary cases (exactly MAX_INLINE_ROWS, MAX_INLINE_ROWS + 1)

2. **Visual Output Routing**
   - All chart types → Artifacts panel
   - Maps → Artifacts panel
   - Diagrams → Artifacts panel
   - Dashboards → Artifacts panel

3. **Edge Cases**
   - Empty tables
   - Null/undefined data
   - Invalid data structures
   - Unknown visualization types

4. **Size Detection**
   - Array data detection
   - Row counting
   - Type classification

### Integration Tests

**Location**: `__tests__/unit/artifacts-chat-integration.test.ts`

Tests the integration of routing logic with the chat UI:

1. Artifact creation from visualizations
2. User modification acknowledgments
3. Artifact persistence across conversation turns
4. Panel opening/closing behavior

## Examples

### Example 1: Small Table (Inline Display)

```typescript
// Tool returns 5 rows
const result = {
  type: 'table',
  data: [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
    { id: 3, name: 'Charlie' },
    { id: 4, name: 'David' },
    { id: 5, name: 'Eve' }
  ]
};

// shouldRouteToArtifacts(result) → false
// Result is displayed inline in the chat
```

### Example 2: Large Table (Artifacts Panel)

```typescript
// Tool returns 15 rows
const result = {
  type: 'table',
  data: Array.from({ length: 15 }, (_, i) => ({
    id: i + 1,
    name: `User ${i + 1}`
  }))
};

// shouldRouteToArtifacts(result) → true
// Result is routed to artifacts panel
// Panel automatically opens
```

### Example 3: Chart (Artifacts Panel)

```typescript
// Tool returns a bar chart
const result = {
  type: 'bar_chart',
  title: 'Sales by Region',
  data: {
    labels: ['North', 'South', 'East', 'West'],
    values: [120, 150, 180, 90]
  }
};

// shouldRouteToArtifacts(result) → true
// Chart is routed to artifacts panel
// Panel automatically opens
```

### Example 4: Textual Result (Inline Display)

```typescript
// Tool returns a status message
const result = {
  type: 'text',
  content: 'Query executed successfully. 3 rows affected.'
};

// shouldRouteToArtifacts(result) → false
// Message is displayed inline in the chat
```

## Configuration

### Adjusting the Threshold

To change the inline display threshold, modify the `MAX_INLINE_ROWS` constant in `src/types/index.ts`:

```typescript
// For more aggressive routing to artifacts panel
export const MAX_INLINE_ROWS = 5;

// For more inline display
export const MAX_INLINE_ROWS = 20;
```

**Note**: The constant is used throughout the codebase, so changing it in one place updates all routing decisions.

### Adding New Visual Types

To add support for new visualization types that should always route to artifacts panel, update the `visualTypes` array in `src/utils/result-routing.ts`:

```typescript
const visualTypes = [
  'bar_chart',
  'line_chart',
  // ... existing types
  'new_chart_type',  // Add new type here
];
```

## Architecture Decisions

### Why a Separate Utility Module?

1. **Testability**: Pure functions are easier to test in isolation
2. **Reusability**: Logic can be used in multiple components
3. **Maintainability**: Centralized logic is easier to update
4. **Documentation**: Clear separation of concerns

### Why MAX_INLINE_ROWS = 10?

The value of 10 rows was chosen based on:
- **Visual Balance**: 10 rows fit comfortably in a chat message without overwhelming the conversation
- **User Experience**: Small tables are quick to scan inline, larger tables benefit from dedicated space
- **Design Consistency**: Aligns with Claude Desktop's behavior
- **Configurability**: Can be adjusted based on user feedback or testing

### Why Route All Visual Outputs to Artifacts?

Visual outputs (charts, maps, diagrams) are always routed to the artifacts panel because:
- They require more space to be effective
- They benefit from dedicated viewing area
- They often need interaction (zoom, pan, filter)
- They shouldn't interrupt the conversation flow

## Performance Considerations

- **O(1) Type Checking**: Visual type detection uses array includes, which is fast
- **O(1) Row Counting**: Array length property access is constant time
- **No Re-renders**: Routing decision is made once per visualization
- **Memoization**: `shouldRouteToArtifactsPanel` is wrapped in `useCallback` to prevent unnecessary re-renders

## Future Enhancements

Potential improvements for future iterations:

1. **Dynamic Threshold**: Adjust MAX_INLINE_ROWS based on viewport size
2. **User Preference**: Allow users to configure their preferred threshold
3. **Smart Routing**: Use ML to predict optimal routing based on user behavior
4. **Preview Mode**: Show preview of large tables inline with "View in Artifacts" button
5. **Responsive Routing**: Different thresholds for mobile vs desktop

## Conclusion

The result routing implementation provides a clean, testable, and maintainable solution for determining how tool outputs are displayed. The logic is centralized, well-documented, and easily configurable, making it simple to adjust behavior based on user feedback or changing requirements.
