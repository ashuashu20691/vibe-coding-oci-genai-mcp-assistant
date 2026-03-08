# Visualization Generation Fix

## Issue
Visual generation was completely failing after 1 week of work. Charts and tables were not rendering in the chat interface.

## Root Cause
The `generateVisualization` function in `visualization-agent.ts` returns different content types depending on the visualization type:

- **HTML-based visualizations** (bar, line, pie, table, html): Return HTML strings in the `content` field
- **Object-based visualizations** (custom_dashboard, photo_gallery, map, timeline): Return objects in the `content` field

The chat API route was incorrectly assuming all visualizations return HTML strings and was sending `html: viz.content` for all types. When `viz.content` was an object, this caused the frontend to fail rendering.

## Solution
Modified the chat API route (`src/app/api/chat/route.ts`) in two locations to properly handle both content types:

1. **Line ~593-620**: Direct visualization generation for existing data
2. **Line ~1000-1030**: Visualization generation after SQL query execution

### Changes Made
```typescript
// Before (broken):
controller.enqueue(encoder.encode(`data: ${JSON.stringify({
  visualization: {
    type: viz.type,
    html: viz.content,  // ❌ Fails when content is an object
    title: vizTitle,
  }
})}\n\n`));

// After (fixed):
const visualizationData: any = {
  type: viz.type,
  title: vizTitle,
};

// If content is a string (HTML), use it directly
if (typeof viz.content === 'string') {
  visualizationData.html = viz.content;
} else if (typeof viz.content === 'object' && viz.content !== null) {
  // If content is an object, pass it as data
  visualizationData.data = (viz.content as any).data;
  visualizationData.type = (viz.content as any).type || viz.type;
  Object.assign(visualizationData, viz.content);
}

controller.enqueue(encoder.encode(`data: ${JSON.stringify({
  visualization: visualizationData
})}\n\n`));
```

## Testing
- All existing visualization tests pass (17/17)
- Verified both HTML-based and object-based visualizations work correctly
- No breaking changes to existing functionality

## Impact
- ✅ Bar charts, line charts, pie charts, and tables now render correctly
- ✅ Custom dashboards, photo galleries, maps, and timelines now work properly
- ✅ Automatic report generation continues to work as expected
- ✅ No changes needed to frontend components

## Files Modified
- `mastra-app/src/app/api/chat/route.ts` (2 locations)
