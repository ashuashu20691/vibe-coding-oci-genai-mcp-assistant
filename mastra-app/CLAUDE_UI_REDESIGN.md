# Claude.ai-Style Chat UI Redesign

## Overview
Complete redesign of the CopilotChatUI component with a clean, minimal Claude.ai-inspired interface.

## Key Design Changes

### 1. Layout
- **Sidebar**: 260px collapsible left sidebar for conversation history
- **Main Content**: Centered with max-width 700px for optimal readability
- **Header**: Minimal header with just title and model selector
- **Input**: Fixed at bottom with auto-expanding textarea

### 2. Message Display
- **No Chat Bubbles**: Clean text with "You" and "Assistant" labels
- **Horizontal Separators**: Messages separated by 1px borders
- **Typography**: 
  - Base font size: 16px
  - Line height: 1.7 for excellent readability
  - Generous padding: py-8 between messages
- **Labels**: Small (text-xs), semibold, muted color

### 3. Thinking Panel (Tool Execution)
- **Collapsed by Default**: Shows compact summary like "Used 2 tools"
- **Click to Expand**: Reveals detailed tool execution steps
- **Minimal Design**: Small rounded box with subtle background
- **Active Indicator**: Animated dot when processing
- **Summary Text**: Shows current tool name when active

### 4. Visualizations
- **Button/Link Display**: Shows as "View Chart" or "View Table" button
- **Fullscreen Modal**: Click opens fullscreen overlay
- **Clean Integration**: Inline button with icon and label
- **No Inline Preview**: Keeps conversation flow clean

### 5. Analysis Cards
- **Collapsible**: Collapsed by default with "Analysis" label
- **Click to Expand**: Shows summary and insights
- **Minimal Styling**: Subtle background and border

### 6. Styling Details
- **CSS Variables**: Uses existing theme variables
- **Borders**: 1px solid var(--border-color)
- **Backgrounds**: Layered (primary, secondary, tertiary)
- **Whitespace**: Generous padding and spacing
- **Hover States**: Subtle opacity changes (hover:opacity-80)
- **Rounded Corners**: 
  - Buttons/cards: rounded-lg (8px)
  - Input: rounded-xl (12px)

### 7. Input Area
- **Auto-expanding Textarea**: Grows with content up to 200px
- **Placeholder**: "Reply..." 
- **Send Button**: Inside textarea at bottom-right
- **Rounded Design**: rounded-xl for modern look
- **Disabled State**: Subtle opacity when loading

## Component Structure

```
CopilotChatUI
├── Sidebar (260px, collapsible)
│   ├── New Chat button
│   └── Conversation list (grouped by date)
├── Main Content
│   ├── Minimal Header
│   │   ├── Sidebar toggle
│   │   ├── App title
│   │   └── Model selector
│   ├── Messages Area (max-w-[700px], centered)
│   │   ├── Welcome Screen (empty state)
│   │   └── Message List
│   │       ├── User Message
│   │       │   ├── "You" label
│   │       │   └── Content
│   │       └── Assistant Message
│   │           ├── "Assistant" label
│   │           ├── Thinking Panel (collapsed)
│   │           ├── Content (with streaming cursor)
│   │           ├── Visualization Button
│   │           └── Analysis Card
│   └── Fixed Input Area
│       └── Auto-expanding textarea with send button
```

## Removed Components
- UserMessageBubble (replaced with simple text)
- AssistantMessage (replaced with inline rendering)
- InlineVisualization (replaced with button + fullscreen modal)
- ModelSelector (replaced with simple select dropdown)

## Preserved Functionality
- ✅ Streaming responses with cursor
- ✅ Tool execution tracking
- ✅ Conversation loading and saving
- ✅ Model selection
- ✅ Auto-scroll with user scroll detection
- ✅ Keyboard shortcuts (Enter to send, Shift+Enter for newline)
- ✅ Fullscreen visualizations
- ✅ Analysis cards

## Design Principles
1. **Minimal**: Remove unnecessary UI elements
2. **Readable**: Large text, generous spacing, high contrast
3. **Clean**: No bubbles, simple borders, lots of whitespace
4. **Focused**: Max-width content area for optimal reading
5. **Unobtrusive**: Collapsed panels by default
6. **Modern**: Rounded corners, smooth transitions, subtle animations

## CSS Variables Used
- `--bg-primary`: Main background
- `--bg-secondary`: Sidebar, cards, input background
- `--bg-tertiary`: Hover states, active items
- `--text-primary`: Main text color
- `--text-secondary`: Secondary text
- `--text-muted`: Labels, hints
- `--border-color`: All borders
- `--accent`: Primary action color (send button, indicators)

## Responsive Behavior
- Sidebar collapses to 0px when toggled
- Content area maintains max-width 700px
- Textarea expands up to 200px height
- All existing responsive CSS rules still apply
