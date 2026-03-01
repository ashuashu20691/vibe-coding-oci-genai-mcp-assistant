// src/types/index.ts

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  content: unknown;
  isError: boolean;
  errorMessage?: string;
}

/**
 * Tool error information for inline display
 * Validates: Requirement 10.3 - Non-blocking tool error handling
 */
export interface ToolError {
  toolName: string;
  errorMessage: string;
  errorCode?: string;
  timestamp: Date;
  isRetryable?: boolean;
  details?: Record<string, unknown>;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  visualization?: {
    type: string;
    html?: string;
    title?: string;
    data?: Record<string, unknown>[];
  };
  analysis?: {
    summary?: string;
    insights?: string[];
    statistics?: Record<string, unknown>;
  };
  /**
   * Tool errors that occurred during message processing
   * Displayed inline without blocking the conversation
   * Validates: Requirement 10.3
   */
  toolErrors?: ToolError[];
  /**
   * Tool narratives generated during message processing
   * Includes conversational explanations for tool execution
   * Validates: Requirements 12.1, 12.3
   */
  toolNarratives?: ToolNarrative[];
  /**
   * Adaptation narratives explaining how previous results informed next actions
   * Validates: Requirements 12.1, 12.3
   */
  adaptationNarratives?: string[];
}

/**
 * Tool narrative for conversational tool execution
 * Validates: Requirements 12.1, 12.3
 */
export interface ToolNarrative {
  toolCallId: string;
  toolName: string;
  phase: 'start' | 'result' | 'error';
  narrative: string;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  modelId?: string;
  /**
   * Active artifact for this conversation
   * Persists across turns until explicitly cleared or replaced
   * Validates: Requirement 15.6
   */
  activeArtifact?: Artifact | null;
}

export interface StreamChunk {
  content?: string;
  toolCalls?: ToolCall[];
  finishReason?: string;
}

export interface Model {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
  capabilities?: string[];
}

export interface ModelGroup {
  provider: string;
  models: Model[];
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type OutputType =
  | 'auto'
  | 'table'
  | 'bar_chart'
  | 'line_chart'
  | 'pie_chart'
  | 'scatter_chart'
  | 'area_chart'
  | 'mermaid'
  | 'map'
  | 'photo_gallery'
  | 'timeline'
  | 'custom_dashboard'
  | 'analysis_dashboard'
  | 'text';

export interface AppError {
  category: 'config' | 'auth' | 'connection' | 'tool' | 'render' | 'database';
  message: string;
  details?: string;
  recoverable: boolean;
  suggestedAction?: string;
}

// ============================================
// Intelligent Data Analysis Types
// ============================================

// Analysis Categories (Requirement 1.1)
export type AnalysisCategory =
  | 'fraud_detection'
  | 'geographic_analysis'
  | 'similarity_search'
  | 'time_series'
  | 'categorical_comparison'
  | 'anomaly_detection'
  | 'sales_analysis';

// Entity Types (Requirement 1.1)
export interface Entity {
  name: string;
  type: 'primary' | 'related';
  attributes: EntityAttribute[];
}

export interface EntityAttribute {
  name: string;
  dataType: 'string' | 'number' | 'date' | 'boolean' | 'coordinates' | 'embedding';
  isRequired: boolean;
  description?: string;
}

export interface Relationship {
  from: string;
  to: string;
  type: 'one_to_many' | 'many_to_many' | 'one_to_one';
  foreignKey: string;
}

export interface VisualizationGoal {
  type: 'distribution' | 'comparison' | 'geographic' | 'temporal' | 'similarity' | 'anomaly';
  priority: number;
  description: string;
}

// Analysis Plan (Requirement 1.4)
export interface AnalysisPlan {
  categories: AnalysisCategory[];
  entities: Entity[];
  relationships: Relationship[];
  visualizationGoals: VisualizationGoal[];
  suggestedQueries: string[];
  clarificationNeeded: boolean;
  clarificationQuestions?: string[];
}

// Schema Types (Requirement 2.1)
export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
  primaryKey: string[];
  foreignKeys: ForeignKeyDefinition[];
  indexes: IndexDefinition[];
}

export interface ColumnDefinition {
  name: string;
  oracleType: string;
  nullable: boolean;
  defaultValue?: string;
}

export interface ForeignKeyDefinition {
  columns: string[];
  referencesTable: string;
  referencesColumns: string[];
}

export interface IndexDefinition {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface GeneratedSchema {
  tables: TableDefinition[];
  createStatements: string[];
  dropStatements: string[];
}

// Data Profile Types (Requirement 1.1)
export interface DataProfile {
  tableName: string;
  recordCount: number;
  columnStats: ColumnStats[];
  anomalyCount?: number;
  geographicSpread?: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  timeRange?: { start: Date; end: Date };
}

export interface ColumnStats {
  columnName: string;
  dataType: string;
  nullCount: number;
  uniqueCount: number;
  min?: number | string;
  max?: number | string;
  mean?: number;
  stdDev?: number;
  topValues?: Array<{ value: string; count: number }>;
}

// Dashboard Types (Requirement 6.1)
export interface DashboardLayout {
  title: string;
  description: string;
  sections: DashboardSection[];
  filters: DashboardFilter[];
  exportOptions: ExportOption[];
}

export interface DashboardSection {
  id: string;
  title: string;
  type: 'stats' | 'visualization' | 'table' | 'insights';
  width: 'full' | 'half' | 'third';
  content: DashboardContent;
}

export interface DashboardContent {
  visualization?: VisualizationConfig;
  statsCards?: StatsCard[];
  insights?: string[];
  tableConfig?: { columns: string[]; pageSize: number };
}

export interface DashboardFilter {
  id: string;
  label: string;
  type: 'select' | 'range' | 'date' | 'search';
  column: string;
  options?: string[];
}

export interface ExportOption {
  format: 'html' | 'csv' | 'png';
  label: string;
}

// Visualization Types
export type VisualizationType =
  | 'map'
  | 'bar_chart'
  | 'line_chart'
  | 'pie_chart'
  | 'scatter_chart'
  | 'area_chart'
  | 'heat_map'
  | 'photo_gallery'
  | 'timeline'
  | 'table'
  | 'stats_cards';

export interface VisualizationConfig {
  type: VisualizationType;
  title: string;
  priority: number;
  dataKey: string;
  config: Record<string, unknown>;
}

export interface StatsCard {
  label: string;
  value: string | number;
  color: 'blue' | 'green' | 'red' | 'orange' | 'gray';
  trend?: 'up' | 'down' | 'neutral';
}

// ============================================
// Artifacts Panel Types (Requirement 15)
// ============================================

/**
 * Artifact types supported in the artifacts panel
 * Validates: Requirement 15.4
 */
export type ArtifactType = 
  | 'table' 
  | 'chart' 
  | 'code' 
  | 'html' 
  | 'react_component' 
  | 'dashboard';

/**
 * Artifact content union type
 */
export type ArtifactContent = 
  | { type: 'table'; data: Record<string, unknown>[]; columns?: string[] }
  | { type: 'chart'; chartType: string; data: unknown; config?: Record<string, unknown> }
  | { type: 'code'; code: string; language: string }
  | { type: 'html'; html: string }
  | { type: 'react_component'; component: React.ComponentType; props: Record<string, unknown> }
  | { type: 'dashboard'; widgets: VisualizationConfig[] };

/**
 * Artifact displayed in the artifacts panel
 * Validates: Requirements 15.3, 15.6
 */
export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  content: ArtifactContent;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * User modification to an artifact
 * Validates: Requirement 15.5
 */
export interface ArtifactModification {
  artifactId: string;
  modificationType: 'filter' | 'sort' | 'edit' | 'interact';
  details: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Configurable threshold for routing content to artifacts panel
 * Validates: Requirement 15.2
 */
export const MAX_INLINE_ROWS = 10;
