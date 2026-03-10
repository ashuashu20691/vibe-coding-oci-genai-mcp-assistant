// Modern Chat UI (primary)
export { CopilotChatUI } from './CopilotChatUI';

// Core components
export { MessageList } from './MessageList';
export { MarkdownRenderer } from './MarkdownRenderer';
export { ModelSelector } from './ModelSelector';
export { ConversationSidebar } from './ConversationSidebar';
export type { ConversationSidebarRef } from './ConversationSidebar';
export { OutputRenderer, detectOutputType, isMermaidSyntax, hasGeographicColumns, hasTimeSeriesData, hasCategoricalData, getNumericColumns } from './OutputRenderer';
export type { OutputRendererProps } from './OutputRenderer';
export { DataTable } from './DataTable';
export type { DataTableProps } from './DataTable';

// Heavy components - use lazy-loaded versions for better bundle size
// Import from ChartLazy instead of Chart directly
export { Chart } from './ChartLazy';
export type { ChartProps, ChartType } from './Chart';

// Import from MermaidDiagramLazy instead of MermaidDiagram directly
export { MermaidDiagram } from './MermaidDiagramLazy';
export type { MermaidDiagramProps } from './MermaidDiagram';

export { SQLPlayground } from './SQLPlayground';
export type { SQLPlaygroundProps } from './SQLPlayground';
// export { ChatUI } from './ChatUI';
// export type { ChatUIProps } from './ChatUI';
export { ErrorDisplay, useErrorState } from './ErrorDisplay';
export type { ErrorInfo, ErrorCode } from './ErrorDisplay';
export { ToolCallDisplay } from './ToolCallDisplay';
export { AnalysisCard } from './AnalysisCard';
export type { AnalysisResult } from './AnalysisCard';

// New visualization components
export { PhotoGalleryRenderer } from './PhotoGalleryRenderer';
export type { PhotoGalleryProps } from './PhotoGalleryRenderer';
export { MapRenderer } from './MapRenderer';
export type { MapRendererProps } from './MapRenderer';
export { TimelineRenderer } from './TimelineRenderer';
export type { TimelineRendererProps } from './TimelineRenderer';

// Export functionality
export { ExportDropdown, ExportIcons } from './ExportDropdown';
export type { ExportDropdownProps, ExportOption, ExportFormat } from './ExportDropdown';

// MCP Server Management
export { MCPServerPanel } from './MCPServerPanel';
export type { MCPServerPanelProps, MCPServerInfo, MCPTool, MCPConnectionStatus } from './MCPServerPanel';

// Settings
export { SettingsModal, SettingsButton } from './SettingsModal';
export type { SettingsModalProps, SettingsButtonProps, SettingsTab } from './SettingsModal';

// Rate Limit Handling
export { RateLimitDisplay } from './RateLimitDisplay';
export type { RateLimitDisplayProps } from './RateLimitDisplay';

// Error Handling with Retry Support
export { ToolErrorDisplay, InlineToolError, formatToolErrorMessage } from './ToolErrorDisplay';
export { RetryableErrorDisplay, isRecoverableError, RECOVERABLE_ERROR_CODES } from './RetryableErrorDisplay';
export type { RetryableError, RetryableErrorDisplayProps } from './RetryableErrorDisplay';

// Keyboard Shortcuts Help
export { KeyboardShortcutsHelp, formatShortcutForDisplay } from './KeyboardShortcutsHelp';
export type { KeyboardShortcutsHelpProps } from './KeyboardShortcutsHelp';

// Conversational Chat Components
export { UserMessageBubble } from './UserMessageBubble';
export type { UserMessageBubbleProps } from './UserMessageBubble';
export { InlineVisualization } from './InlineVisualization';
export type { InlineVisualizationProps, VisualizationData } from './InlineVisualization';

// Artifacts Panel - use lazy-loaded version for better bundle size
export { ArtifactsPanel } from './ArtifactsPanelLazy';
export type { ArtifactsPanelProps } from './ArtifactsPanel';

