/**
 * Type definitions for Automatic Report Generation feature
 * 
 * Validates: Requirements 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 10.1
 */

/**
 * Configuration for report trigger detection
 */
export interface ReportTriggerConfig {
  minRows: number; // Minimum rows to trigger report (default: 1)
  maxRows: number; // Maximum rows before switching to summary (default: 10000)
  enabledByDefault: boolean; // Whether auto-generation is enabled
  userPreferences?: {
    autoGenerate: boolean;
    preferredChartTypes?: string[];
    preferredLayout?: 'grid' | 'list';
  };
}

/**
 * Decision result from trigger detection
 */
export interface TriggerDecision {
  shouldGenerate: boolean;
  reason: string;
  suggestedReportType: 'simple' | 'dashboard' | 'gallery';
  estimatedComplexity: 'low' | 'medium' | 'high';
}

/**
 * Data characteristics detected from query results
 */
export interface DataCharacteristics {
  hasTimeSeriesData: boolean;
  hasCategoricalData: boolean;
  hasNumericMetrics: boolean;
  hasImageData: boolean;
  hasGeographicData: boolean;
}

/**
 * Report generation result
 */
export interface ReportGenerationResult {
  success: boolean;
  reportHTML: string;
  dashboardLayout?: unknown;
  exportOptions: {
    html: () => void;
    excel?: () => void;
  };
  renderData: {
    type: 'inline' | 'modal' | 'expandable';
    content: string;
  };
  error?: Error;
}

/**
 * Report metadata
 */
export interface ReportMetadata {
  id: string;
  generatedAt: Date;
  queryId: string;
  reportType: 'simple' | 'dashboard' | 'gallery';
  dataSource: {
    database: string;
    query: string;
    rowCount: number;
  };
  visualizations: {
    type: string;
    title: string;
  }[];
  exportFormats: ('html' | 'excel' | 'csv')[];
}

/**
 * Report configuration
 */
export interface ReportConfiguration {
  automatic: {
    enabled: boolean;
    minRows: number;
    maxRows: number;
  };
  visualization: {
    preferredChartTypes: string[];
    colorScheme: 'light' | 'dark' | 'auto';
    showLegends: boolean;
    showGridLines: boolean;
  };
  layout: {
    type: 'grid' | 'list';
    columnsPerRow: number;
    spacing: 'compact' | 'normal' | 'spacious';
  };
  export: {
    includeRawData: boolean;
    embedImages: boolean;
    format: 'html' | 'excel' | 'both';
  };
}

/**
 * Workflow integration data
 */
export interface ReportWorkflowData {
  queryStepId: string;
  reportStepId: string;
  queryResult: unknown;
  reportResult?: ReportGenerationResult;
  triggerDecision: TriggerDecision;
  generationStartTime: Date;
  generationEndTime?: Date;
  error?: Error;
}

/**
 * Configuration for automatic report generation
 */
export interface AutoReportConfig {
  enabled: boolean;
  triggerConfig: ReportTriggerConfig;
  performanceConfig: {
    maxGenerationTimeMs: number;
    enableProgressiveRendering: boolean;
    cacheEnabled: boolean;
  };
}

/**
 * Chat rendering configuration
 */
export interface ChatRenderConfig {
  maxHeight: string; // CSS max-height value
  enableScrolling: boolean;
  enableInteractivity: boolean;
  responsiveBreakpoints: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
}

/**
 * Rendered report for chat display
 */
export interface RenderedReport {
  html: string;
  css: string;
  scripts?: string;
  metadata: {
    reportId: string;
    timestamp: Date;
    dataRowCount: number;
  };
}
