// src/mastra/agents/analysis-agent.ts
/**
 * Analysis Agent - Orchestrates the full intelligent data analysis workflow.
 *
 * This agent coordinates:
 * - Intent analysis from natural language queries
 * - Dynamic schema generation
 * - Synthetic data generation
 * - Query execution via MCP tools
 * - Visualization selection
 * - Dashboard composition
 *
 * Requirements covered:
 * - 9.1: Use existing MCP client at src/mastra/mcp/client.ts
 * - 9.2: Execute CREATE TABLE statements via sqlcl_run_sql MCP tool
 * - 9.3: Execute INSERT statements via sqlcl_run_sql MCP tool
 * - 9.4: Use existing query execution pipeline with proper connection management
 * - 9.5: Use existing visualization components
 * - 9.6: Display user-friendly error messages with recovery suggestions
 * - 10.1: Allow users to request modifications via natural language
 * - 11.1: Execute CREATE TABLE statements to persist schema
 * - 11.2: Execute INSERT statements to persist data
 */

import { IntentAnalyzer } from '@/services/intent-analyzer';
import { SchemaGenerator } from '@/services/schema-generator';
import { DataSynthesizer, GeneratedData } from '@/services/data-synthesizer';
import { QueryEngine, QueryResult } from '@/services/query-engine';
import { VisualizationSelector } from '@/services/visualization-selector';
import { DashboardComposer } from '@/services/dashboard-composer';
import { DataProfiler } from '@/services/data-profiler';
import { getTemplateForCategories } from '@/services/analysis-templates';
import { getMCPTools } from './database-agent';
import {
  AnalysisPlan,
  GeneratedSchema,
  DashboardLayout,
  DataProfile,
} from '@/types';

/**
 * Request parameters for analysis.
 */
export interface AnalysisRequest {
  /** Natural language description of the analysis to perform */
  naturalLanguageQuery: string;
  /** Number of synthetic records to generate (default: from template or 100) */
  recordCount?: number;
  /** Whether to use existing data instead of generating new data */
  useExistingData?: boolean;
}

/**
 * Response from the analysis workflow.
 */
export interface AnalysisResponse {
  /** Whether the analysis completed successfully */
  success: boolean;
  /** The analysis plan derived from the query */
  plan: AnalysisPlan;
  /** Generated schema (if tables were created) */
  schema?: GeneratedSchema;
  /** Whether synthetic data was generated */
  dataGenerated?: boolean;
  /** Results from executed queries */
  queryResults: QueryResult[];
  /** Composed dashboard layout */
  dashboard: DashboardLayout;
  /** Error message if analysis failed */
  error?: string;
  /** Recovery suggestions for errors */
  recoverySuggestions?: string[];
}

/**
 * Agent instructions for LLM integration.
 */
export const ANALYSIS_AGENT_INSTRUCTIONS = `You are an intelligent data analysis agent that orchestrates schema generation, data synthesis, query execution, and dashboard composition.

<workflow>
When given a natural language analysis request:
1. Parse the intent to identify the analysis category (fraud detection, geographic, time series, categorical comparison, similarity search)
2. Generate an appropriate schema if no existing tables are specified
3. Synthesize realistic data that matches the domain
4. Execute targeted analytical queries — not exploratory ones
5. Select the visualization type that best communicates the findings
6. Compose a dashboard that tells a coherent story

Complete all steps autonomously. Do not pause to ask for confirmation between steps.
</workflow>

<error_handling>
If a step fails, diagnose the cause from the error message and attempt a corrected retry before surfacing the error to the user. Provide specific recovery suggestions tied to the actual error, not generic advice.
</error_handling>`;

/**
 * MCP Tool interface for type safety.
 */
interface MCPTool {
  execute: (args: { sql: string }) => Promise<unknown>;
}

/**
 * AnalysisAgent orchestrates the full intelligent data analysis workflow.
 */
export class AnalysisAgent {
  private intentAnalyzer: IntentAnalyzer;
  private schemaGenerator: SchemaGenerator;
  private dataSynthesizer: DataSynthesizer;
  private queryEngine: QueryEngine;
  private vizSelector: VisualizationSelector;
  private dashboardComposer: DashboardComposer;
  private dataProfiler: DataProfiler;

  /**
   * Creates a new AnalysisAgent instance.
   *
   * @param llmClient - Optional LLM client for advanced intent parsing
   */
  constructor(llmClient?: unknown) {
    this.intentAnalyzer = new IntentAnalyzer(llmClient);
    this.schemaGenerator = new SchemaGenerator();
    this.dataSynthesizer = new DataSynthesizer();
    this.queryEngine = new QueryEngine();
    this.vizSelector = new VisualizationSelector();
    this.dashboardComposer = new DashboardComposer();
    this.dataProfiler = new DataProfiler();
  }

  /**
   * Performs the full analysis workflow.
   *
   * Steps:
   * 1. Analyze intent from natural language query
   * 2. Apply template if available
   * 3. Generate schema
   * 4. Create tables via MCP tools (Requirement 9.2, 11.1)
   * 5. Generate and insert synthetic data (Requirement 9.3, 11.2)
   * 6. Execute analysis queries (Requirement 9.4)
   * 7. Select visualizations (Requirement 9.5)
   * 8. Compose dashboard
   *
   * @param request - Analysis request with natural language query
   * @returns Analysis response with dashboard and results
   */
  async analyze(request: AnalysisRequest): Promise<AnalysisResponse> {
    try {
      // Step 1: Analyze intent (Requirement 10.1)
      const plan = await this.intentAnalyzer.analyze(request.naturalLanguageQuery);

      // Handle clarification needed
      if (plan.clarificationNeeded && plan.clarificationQuestions) {
        return {
          success: false,
          plan,
          queryResults: [],
          dashboard: this.createEmptyDashboard(),
          error: `Please clarify: ${plan.clarificationQuestions.join(', ')}`,
          recoverySuggestions: [
            'Provide more details about the data you want to analyze',
            'Specify the type of analysis (fraud detection, geographic, time series, etc.)',
            'Mention the key entities and their attributes',
          ],
        };
      }

      // Step 2: Check for template match and apply defaults
      const template = getTemplateForCategories(plan.categories);
      if (template && plan.entities.length === 0) {
        plan.entities = template.entities;
        plan.relationships = template.relationships;
        plan.visualizationGoals = template.visualizationGoals;
      }

      // Step 3: Generate schema
      const schema = this.schemaGenerator.generateSchema(
        plan.entities,
        plan.relationships,
        plan.categories
      );

      // Step 4 & 5: Create tables and generate data (if not using existing data)
      let dataGenerated = false;
      if (!request.useExistingData) {
        // Create tables (Requirement 9.2, 11.1)
        await this.createTables(schema);

        // Generate and insert synthetic data (Requirement 9.3, 11.2)
        const recordCount = request.recordCount || template?.defaultRecordCount || 100;
        for (const table of schema.tables) {
          const generatedData = await this.dataSynthesizer.synthesize(table, {
            recordCount,
            categories: plan.categories,
          });
          await this.insertData(generatedData);
        }
        dataGenerated = true;
      }

      // Step 6: Execute analysis queries (Requirement 9.4)
      const queryResults = await this.queryEngine.executeAnalysisQueries({
        tableName: schema.tables[0]?.name || 'ANALYSIS_DATA',
        categories: plan.categories,
        visualizationGoals: plan.visualizationGoals,
      });

      // Step 7: Select visualizations (Requirement 9.5)
      const mainResult = queryResults.find((r) => r.success && r.data.length > 0);
      if (!mainResult) {
        return {
          success: false,
          plan,
          schema,
          dataGenerated,
          queryResults,
          dashboard: this.createEmptyDashboard(),
          error: 'No data returned from queries',
          recoverySuggestions: [
            'Check if the tables were created successfully',
            'Verify the data was inserted correctly',
            'Try running the analysis again with different parameters',
          ],
        };
      }

      // Profile the data
      const profile = this.dataProfiler.profile(mainResult.data, schema.tables[0]?.name);

      const selectionResult = this.vizSelector.selectVisualizations(
        mainResult.data,
        profile,
        plan.categories,
        plan.visualizationGoals
      );

      // Step 8: Compose dashboard
      const dashboard = this.dashboardComposer.compose(
        selectionResult,
        mainResult.data,
        profile,
        plan.categories
      );

      return {
        success: true,
        plan,
        schema,
        dataGenerated,
        queryResults,
        dashboard,
      };
    } catch (error) {
      // Requirement 9.6: User-friendly error messages with recovery suggestions
      const errorMessage = error instanceof Error ? error.message : String(error);
      const recoverySuggestions = this.getRecoverySuggestions(errorMessage);

      return {
        success: false,
        plan: {
          categories: [],
          entities: [],
          relationships: [],
          visualizationGoals: [],
          suggestedQueries: [],
          clarificationNeeded: false,
        },
        queryResults: [],
        dashboard: this.createEmptyDashboard(),
        error: errorMessage,
        recoverySuggestions,
      };
    }
  }

  /**
   * Creates tables in the database via MCP tools.
   * Implements Requirements 9.2 and 11.1.
   *
   * @param schema - Generated schema with CREATE statements
   * @throws Error if MCP tool is not available or table creation fails
   */
  private async createTables(schema: GeneratedSchema): Promise<void> {
    const tools = await getMCPTools();
    // MCP tools are prefixed with 'sqlcl_' and use underscores
    const runSqlTool = (tools['sqlcl_run_sql'] || tools['run-sql'] || tools['run_sql']) as MCPTool | undefined;

    if (!runSqlTool) {
      console.error('[AnalysisAgent] Available tools:', Object.keys(tools));
      throw new Error(
        'MCP run-sql tool not available. Please ensure the database connection is configured and you are connected to a database.'
      );
    }

    // Drop existing tables (ignore errors - tables might not exist)
    for (const dropSql of schema.dropStatements) {
      try {
        await runSqlTool.execute({ sql: dropSql });
      } catch {
        // Table might not exist, ignore the error
      }
    }

    // Create new tables
    for (const createSql of schema.createStatements) {
      try {
        await runSqlTool.execute({ sql: createSql });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to create table: ${errorMessage}`);
      }
    }

    // Create indexes for better query performance
    for (const table of schema.tables) {
      const indexStatements = this.schemaGenerator.generateIndexStatements(table);
      for (const indexSql of indexStatements) {
        try {
          await runSqlTool.execute({ sql: indexSql });
        } catch {
          // Index creation failure is non-fatal, continue
          console.warn(`Failed to create index: ${indexSql}`);
        }
      }
    }
  }

  /**
   * Inserts generated data into the database via MCP tools.
   * Implements Requirements 9.3 and 11.2.
   *
   * @param generatedData - Generated data with INSERT statements
   * @throws Error if MCP tool is not available or data insertion fails
   */
  private async insertData(generatedData: GeneratedData): Promise<void> {
    const tools = await getMCPTools();
    // MCP tools are prefixed with 'sqlcl_' and use underscores
    const runSqlTool = (tools['sqlcl_run_sql'] || tools['run-sql'] || tools['run_sql']) as MCPTool | undefined;

    if (!runSqlTool) {
      console.error('[AnalysisAgent] Available tools:', Object.keys(tools));
      throw new Error(
        'MCP run-sql tool not available. Please ensure the database connection is configured and you are connected to a database.'
      );
    }

    // Execute inserts in batches to avoid overwhelming the database
    const batchSize = 50;
    let insertedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < generatedData.insertStatements.length; i += batchSize) {
      const batch = generatedData.insertStatements.slice(i, i + batchSize);

      for (const sql of batch) {
        try {
          await runSqlTool.execute({ sql });
          insertedCount++;
        } catch (error) {
          failedCount++;
          // Log but continue - some inserts might fail due to constraints
          console.warn(`Insert failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    // If all inserts failed, throw an error
    if (insertedCount === 0 && failedCount > 0) {
      throw new Error(
        `Failed to insert any data. ${failedCount} insert statements failed. Check database constraints and connection.`
      );
    }

    // Log summary
    if (failedCount > 0) {
      console.warn(
        `Data insertion completed with warnings: ${insertedCount} succeeded, ${failedCount} failed`
      );
    }
  }

  /**
   * Creates an empty dashboard for error cases.
   *
   * @returns Empty dashboard layout
   */
  private createEmptyDashboard(): DashboardLayout {
    return {
      title: 'Analysis Dashboard',
      description: 'No data available',
      sections: [],
      filters: [],
      exportOptions: [],
    };
  }

  /**
   * Gets recovery suggestions based on error message.
   * Implements Requirement 9.6.
   *
   * @param errorMessage - The error message to analyze
   * @returns Array of recovery suggestions
   */
  private getRecoverySuggestions(errorMessage: string): string[] {
    const suggestions: string[] = [];
    const errorLower = errorMessage.toLowerCase();

    // MCP/Connection errors
    if (errorLower.includes('mcp') || errorLower.includes('not available')) {
      suggestions.push('Ensure the MCP server is running and configured correctly');
      suggestions.push('Check the database connection settings in your configuration');
      suggestions.push('Try reconnecting to the database');
    }

    // Table/Schema errors
    if (errorLower.includes('table') || errorLower.includes('schema')) {
      suggestions.push('Check if you have permission to create tables in the database');
      suggestions.push('Verify the table names do not conflict with existing tables');
      suggestions.push('Try using the "useExistingData" option if tables already exist');
    }

    // Insert/Data errors
    if (errorLower.includes('insert') || errorLower.includes('data')) {
      suggestions.push('Check database constraints (unique keys, foreign keys)');
      suggestions.push('Verify the data types match the schema');
      suggestions.push('Try reducing the record count');
    }

    // Query errors
    if (errorLower.includes('query') || errorLower.includes('sql')) {
      suggestions.push('Check if the tables exist in the database');
      suggestions.push('Verify column names match the schema');
      suggestions.push('Try a simpler analysis query');
    }

    // Connection errors
    if (errorLower.includes('connection') || errorLower.includes('timeout')) {
      suggestions.push('Check your network connection');
      suggestions.push('Verify database credentials are correct');
      suggestions.push('Try reconnecting to the database');
    }

    // Default suggestions
    if (suggestions.length === 0) {
      suggestions.push('Try rephrasing your analysis request');
      suggestions.push('Check the application logs for more details');
      suggestions.push('Contact support if the issue persists');
    }

    return suggestions;
  }

  /**
   * Gets the agent instructions for use with LLM.
   *
   * @returns Agent instruction string
   */
  getInstructions(): string {
    return ANALYSIS_AGENT_INSTRUCTIONS;
  }

  /**
   * Profiles existing data without generating new data.
   * Useful for analyzing data that already exists in the database.
   *
   * @param tableName - Name of the table to profile
   * @returns Data profile with statistics
   */
  async profileExistingData(tableName: string): Promise<DataProfile | null> {
    try {
      const result = await this.queryEngine.executeQuery(`SELECT * FROM ${tableName}`);
      if (result.success && result.data.length > 0) {
        return this.dataProfiler.profile(result.data, tableName);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Re-runs visualization selection on existing query results.
   * Useful for changing visualization preferences without re-querying.
   *
   * @param data - Query result data
   * @param profile - Data profile
   * @param plan - Analysis plan with categories and goals
   * @returns New dashboard layout
   */
  recomposeVisualization(
    data: Record<string, unknown>[],
    profile: DataProfile,
    plan: AnalysisPlan
  ): DashboardLayout {
    const selectionResult = this.vizSelector.selectVisualizations(
      data,
      profile,
      plan.categories,
      plan.visualizationGoals
    );

    return this.dashboardComposer.compose(
      selectionResult,
      data,
      profile,
      plan.categories
    );
  }
}
