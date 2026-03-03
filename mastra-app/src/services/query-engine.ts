// src/services/query-engine.ts
/**
 * Query Engine Service
 * Constructs and executes SQL queries via MCP tools.
 * Supports geographic queries with Haversine distance, time-based grouping, and fraud analysis.
 * Enhanced with JOIN generation, window functions, and performance grading.
 * 
 * Requirements: 4.1, 4.3, 4.4, 4.5, 4.7, 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { getMCPTools } from '@/mastra/agents/database-agent';
import { AnalysisCategory, VisualizationGoal } from '@/types';
import { TableSchema, Relationship } from './schema-discovery';
import { ResultPresenter, type PresentationConfig, type FormattedResult } from './result-presenter';

/**
 * Configuration for building analysis queries
 */
export interface QueryConfig {
  tableName: string;
  categories: AnalysisCategory[];
  visualizationGoals: VisualizationGoal[];
  filters?: QueryFilter[];
  groupBy?: string[];
  orderBy?: { column: string; direction: 'ASC' | 'DESC' };
  limit?: number;
  // Enhanced configuration for complex queries
  joins?: JoinConfig[];
  windowFunctions?: WindowFunctionConfig[];
  aggregations?: AggregationConfig[];
  performanceGrading?: PerformanceGradingConfig;
  temporalAnalysis?: TemporalAnalysisConfig;
}

/**
 * JOIN configuration for multi-table queries (Requirement 6.1)
 */
export interface JoinConfig {
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL OUTER';
  table: string;
  on: {
    leftColumn: string;
    rightColumn: string;
  };
  alias?: string;
}

/**
 * Window function configuration for ranking (Requirement 6.3)
 */
export interface WindowFunctionConfig {
  function: 'ROW_NUMBER' | 'RANK' | 'DENSE_RANK' | 'NTILE';
  alias: string;
  partitionBy?: string[];
  orderBy: { column: string; direction: 'ASC' | 'DESC' }[];
}

/**
 * Aggregation configuration (Requirement 6.2)
 */
export interface AggregationConfig {
  function: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' | 'STDDEV' | 'VARIANCE';
  column: string;
  alias: string;
}

/**
 * Performance grading configuration (Requirement 6.5)
 */
export interface PerformanceGradingConfig {
  metricColumn: string;
  gradeColumn: string;
  thresholds: {
    A: { min?: number; max?: number };
    B: { min?: number; max?: number };
    C: { min?: number; max?: number };
    D: { min?: number; max?: number };
    F: { min?: number; max?: number };
  };
}

/**
 * Temporal analysis configuration (Requirement 6.4)
 */
export interface TemporalAnalysisConfig {
  dateColumn: string;
  interval?: 'YEAR' | 'MONTH' | 'DAY' | 'HOUR';
  rangeStart?: Date;
  rangeEnd?: Date;
  relativePeriod?: string; // e.g., "5 YEAR", "30 DAY"
}

/**
 * Filter configuration for WHERE clauses
 */
export interface QueryFilter {
  column: string;
  operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'like' | 'in' | 'distance';
  value: unknown;
  unit?: string;
}

/**
 * Distance filter value for geographic queries
 */
export interface DistanceFilterValue {
  lat: number;
  lon: number;
  radius: number;
}

/**
 * Result of a query execution
 */
export interface QueryResult {
  success: boolean;
  data: Record<string, unknown>[];
  columns: string[];
  rowCount: number;
  executionTimeMs: number;
  sql: string;
  error?: string;
}

/**
 * QueryEngine class for constructing and executing SQL queries
 * Integrates with MCP tools for database operations
 * Enhanced with JOIN generation, window functions, and performance grading
 */
export class QueryEngine {
  private resultPresenter: ResultPresenter;

  constructor() {
    this.resultPresenter = new ResultPresenter();
  }
  /**
   * Generate JOINs based on discovered relationships (Requirement 6.1)
   * 
   * @param baseTable - Base table name
   * @param relationships - Array of discovered relationships
   * @param requiredTables - Tables that need to be joined
   * @returns Array of JOIN configurations
   */
  generateJoinsFromRelationships(
    baseTable: string,
    relationships: Relationship[],
    requiredTables: string[]
  ): JoinConfig[] {
    const joins: JoinConfig[] = [];
    const joinedTables = new Set<string>([baseTable.toUpperCase()]);

    // Find relationships that connect base table to required tables
    for (const targetTable of requiredTables) {
      if (joinedTables.has(targetTable.toUpperCase())) {
        continue;
      }

      // Find direct relationship from base table to target
      const directRel = relationships.find(
        r =>
          r.fromTable.toUpperCase() === baseTable.toUpperCase() &&
          r.toTable.toUpperCase() === targetTable.toUpperCase()
      );

      if (directRel) {
        joins.push({
          type: 'INNER',
          table: directRel.toTable,
          on: {
            leftColumn: `${baseTable}.${directRel.fromColumn}`,
            rightColumn: `${directRel.toTable}.${directRel.toColumn}`,
          },
        });
        joinedTables.add(targetTable.toUpperCase());
        continue;
      }

      // Find reverse relationship (target to base)
      const reverseRel = relationships.find(
        r =>
          r.fromTable.toUpperCase() === targetTable.toUpperCase() &&
          r.toTable.toUpperCase() === baseTable.toUpperCase()
      );

      if (reverseRel) {
        joins.push({
          type: 'INNER',
          table: reverseRel.fromTable,
          on: {
            leftColumn: `${baseTable}.${reverseRel.toColumn}`,
            rightColumn: `${reverseRel.fromTable}.${reverseRel.fromColumn}`,
          },
        });
        joinedTables.add(targetTable.toUpperCase());
      }
    }

    return joins;
  }

  /**
   * Build JOIN clause from configuration (Requirement 6.1)
   * 
   * @param joins - Array of JOIN configurations
   * @returns SQL JOIN clause string
   */
  buildJoinClause(joins: JoinConfig[]): string {
    if (!joins || joins.length === 0) {
      return '';
    }

    return joins
      .map(join => {
        const tableRef = join.alias ? `${join.table} ${join.alias}` : join.table;
        return `${join.type} JOIN ${tableRef} ON ${join.on.leftColumn} = ${join.on.rightColumn}`;
      })
      .join('\n');
  }

  /**
   * Build window function clause (Requirement 6.3)
   * 
   * @param windowFunc - Window function configuration
   * @returns SQL window function expression
   */
  buildWindowFunction(windowFunc: WindowFunctionConfig): string {
    let sql = `${windowFunc.function}()`;

    const overParts: string[] = [];

    if (windowFunc.partitionBy && windowFunc.partitionBy.length > 0) {
      overParts.push(`PARTITION BY ${windowFunc.partitionBy.join(', ')}`);
    }

    if (windowFunc.orderBy && windowFunc.orderBy.length > 0) {
      const orderClauses = windowFunc.orderBy
        .map(o => `${o.column} ${o.direction}`)
        .join(', ');
      overParts.push(`ORDER BY ${orderClauses}`);
    }

    if (overParts.length > 0) {
      sql += ` OVER (${overParts.join(' ')})`;
    }

    return `${sql} AS ${windowFunc.alias}`;
  }

  /**
   * Build aggregation expressions (Requirement 6.2)
   * 
   * @param aggregations - Array of aggregation configurations
   * @returns SQL aggregation expressions
   */
  buildAggregations(aggregations: AggregationConfig[]): string[] {
    if (!aggregations || aggregations.length === 0) {
      return [];
    }

    return aggregations.map(agg => {
      const column = agg.column === '*' ? '*' : agg.column;
      return `${agg.function}(${column}) AS ${agg.alias}`;
    });
  }

  /**
   * Build performance grading CASE expression (Requirement 6.5)
   * 
   * @param config - Performance grading configuration
   * @returns SQL CASE expression for grading
   */
  buildPerformanceGrading(config: PerformanceGradingConfig): string {
    const cases: string[] = [];

    // Build CASE conditions for each grade
    const grades = ['A', 'B', 'C', 'D', 'F'] as const;
    for (const grade of grades) {
      const threshold = config.thresholds[grade];
      if (!threshold) continue;

      const conditions: string[] = [];
      if (threshold.min !== undefined) {
        conditions.push(`${config.metricColumn} >= ${threshold.min}`);
      }
      if (threshold.max !== undefined) {
        conditions.push(`${config.metricColumn} <= ${threshold.max}`);
      }

      if (conditions.length > 0) {
        cases.push(`WHEN ${conditions.join(' AND ')} THEN '${grade}'`);
      }
    }

    return `CASE ${cases.join(' ')} ELSE 'F' END AS ${config.gradeColumn}`;
  }

  /**
   * Build temporal filter clause (Requirement 6.4)
   * 
   * @param config - Temporal analysis configuration
   * @returns SQL temporal filter clause
   */
  buildTemporalFilter(config: TemporalAnalysisConfig): string {
    const conditions: string[] = [];

    if (config.rangeStart) {
      const startDate = config.rangeStart.toISOString().split('T')[0];
      conditions.push(`${config.dateColumn} >= TO_DATE('${startDate}', 'YYYY-MM-DD')`);
    }

    if (config.rangeEnd) {
      const endDate = config.rangeEnd.toISOString().split('T')[0];
      conditions.push(`${config.dateColumn} <= TO_DATE('${endDate}', 'YYYY-MM-DD')`);
    }

    if (config.relativePeriod) {
      conditions.push(`${config.dateColumn} >= SYSDATE - INTERVAL '${config.relativePeriod}'`);
    }

    return conditions.join(' AND ');
  }

  /**
   * Build temporal extraction expressions (Requirement 6.4)
   * 
   * @param config - Temporal analysis configuration
   * @returns SQL date extraction expressions
   */
  buildTemporalExtractions(config: TemporalAnalysisConfig): string[] {
    const extractions: string[] = [];

    if (config.interval) {
      switch (config.interval) {
        case 'YEAR':
          extractions.push(`EXTRACT(YEAR FROM ${config.dateColumn}) AS YEAR`);
          break;
        case 'MONTH':
          extractions.push(`EXTRACT(YEAR FROM ${config.dateColumn}) AS YEAR`);
          extractions.push(`EXTRACT(MONTH FROM ${config.dateColumn}) AS MONTH`);
          break;
        case 'DAY':
          extractions.push(`TRUNC(${config.dateColumn}) AS DAY`);
          break;
        case 'HOUR':
          extractions.push(`TRUNC(${config.dateColumn}, 'HH') AS HOUR`);
          break;
      }
    }

    return extractions;
  }

  /**
   * Build enhanced query with JOINs, window functions, and aggregations
   * (Requirements 6.1, 6.2, 6.3, 6.4, 6.5)
   * 
   * @param config - Enhanced query configuration
   * @returns Complete SQL query string
   */
  buildEnhancedQuery(config: QueryConfig): string {
    const selectParts: string[] = [];

    // Base columns
    if (config.aggregations && config.aggregations.length > 0) {
      // Aggregation query - only select group by columns and aggregations
      if (config.groupBy && config.groupBy.length > 0) {
        selectParts.push(...config.groupBy);
      }
      selectParts.push(...this.buildAggregations(config.aggregations));
    } else {
      // Regular query - select all columns
      selectParts.push('*');
    }

    // Add window functions
    if (config.windowFunctions && config.windowFunctions.length > 0) {
      selectParts.push(
        ...config.windowFunctions.map(wf => this.buildWindowFunction(wf))
      );
    }

    // Add temporal extractions
    if (config.temporalAnalysis) {
      selectParts.push(...this.buildTemporalExtractions(config.temporalAnalysis));
    }

    // Add performance grading
    if (config.performanceGrading) {
      selectParts.push(this.buildPerformanceGrading(config.performanceGrading));
    }

    // Build SELECT clause
    let sql = `SELECT ${selectParts.join(', ')}\nFROM ${config.tableName}`;

    // Add JOINs
    if (config.joins && config.joins.length > 0) {
      sql += '\n' + this.buildJoinClause(config.joins);
    }

    // Build WHERE clause
    const whereClauses: string[] = [];

    if (config.filters && config.filters.length > 0) {
      whereClauses.push(...config.filters.map(f => this.buildFilterClause(f)));
    }

    if (config.temporalAnalysis) {
      const temporalFilter = this.buildTemporalFilter(config.temporalAnalysis);
      if (temporalFilter) {
        whereClauses.push(temporalFilter);
      }
    }

    if (whereClauses.length > 0) {
      sql += `\nWHERE ${whereClauses.join(' AND ')}`;
    }

    // Add GROUP BY
    if (config.groupBy && config.groupBy.length > 0) {
      sql += `\nGROUP BY ${config.groupBy.join(', ')}`;
    }

    // Add ORDER BY
    if (config.orderBy) {
      sql += `\nORDER BY ${config.orderBy.column} ${config.orderBy.direction}`;
    }

    // Add LIMIT
    if (config.limit) {
      sql += `\nFETCH FIRST ${config.limit} ROWS ONLY`;
    }

    return sql;
  }
  /**
   * Execute multiple analysis queries based on configuration
   * Builds and runs main query plus category-specific queries
   * 
   * @param config - Query configuration with table, categories, filters
   * @returns Array of query results
   */
  async executeAnalysisQueries(config: QueryConfig): Promise<QueryResult[]> {
    const queries = this.buildAnalysisQueries(config);
    const results: QueryResult[] = [];

    for (const sql of queries) {
      const result = await this.executeQuery(sql);
      results.push(result);
    }

    return results;
  }

  /**
   * Build all analysis queries based on configuration
   * Includes main data query and category-specific summary queries
   */
  buildAnalysisQueries(config: QueryConfig): string[] {
    const queries: string[] = [];

    // Main data query
    queries.push(this.buildMainQuery(config));

    // Category-specific queries
    if (config.categories.includes('fraud_detection')) {
      queries.push(this.buildFraudSummaryQuery(config.tableName));
    }

    if (config.categories.includes('geographic_analysis')) {
      queries.push(this.buildGeographicSummaryQuery(config.tableName));
    }

    if (config.categories.includes('time_series')) {
      queries.push(this.buildTimeSeriesQuery(config.tableName));
    }

    return queries;
  }

  /**
   * Build the main SELECT query with filters, ordering, and limits
   * Uses enhanced query builder if advanced features are configured
   * Requirement 4.1: Construct SQL queries appropriate for the analysis type
   * Requirements 6.1-6.5: Support JOINs, aggregations, window functions, temporal analysis, and performance grading
   */
  buildMainQuery(config: QueryConfig): string {
    // Use enhanced query builder if any advanced features are present
    if (
      config.joins ||
      config.windowFunctions ||
      config.aggregations ||
      config.performanceGrading ||
      config.temporalAnalysis
    ) {
      return this.buildEnhancedQuery(config);
    }

    // Fall back to simple query builder for basic queries
    let sql = `SELECT * FROM ${config.tableName}`;

    if (config.filters && config.filters.length > 0) {
      const whereClauses = config.filters.map(f => this.buildFilterClause(f));
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    if (config.orderBy) {
      sql += ` ORDER BY ${config.orderBy.column} ${config.orderBy.direction}`;
    }

    if (config.limit) {
      sql += ` FETCH FIRST ${config.limit} ROWS ONLY`;
    }

    return sql;
  }

  /**
   * Build a WHERE clause for a single filter
   * Supports equality, comparison, LIKE, IN, and distance operators
   * Requirement 4.3: Geographic filtering with Haversine formula
   */
  buildFilterClause(filter: QueryFilter): string {
    if (filter.operator === 'distance') {
      // Haversine distance calculation for geographic queries (Requirement 4.3)
      const { lat, lon, radius } = filter.value as DistanceFilterValue;
      return this.buildHaversineClause(lat, lon, radius);
    }

    switch (filter.operator) {
      case 'eq':
        return `${filter.column} = '${filter.value}'`;
      case 'gt':
        return `${filter.column} > ${filter.value}`;
      case 'lt':
        return `${filter.column} < ${filter.value}`;
      case 'gte':
        return `${filter.column} >= ${filter.value}`;
      case 'lte':
        return `${filter.column} <= ${filter.value}`;
      case 'like':
        return `${filter.column} LIKE '%${filter.value}%'`;
      case 'in':
        return `${filter.column} IN (${(filter.value as string[]).map(v => `'${v}'`).join(', ')})`;
      default:
        return '1=1';
    }
  }

  /**
   * Build Haversine distance calculation clause for geographic filtering
   * Uses the Haversine formula to calculate great-circle distance in miles
   * Requirement 4.3: Distance calculations using the Haversine formula
   * 
   * @param centerLat - Center latitude in degrees
   * @param centerLon - Center longitude in degrees
   * @param radiusMiles - Radius in miles
   * @returns SQL WHERE clause for distance filtering
   */
  buildHaversineClause(centerLat: number, centerLon: number, radiusMiles: number): string {
    // Earth's radius in miles: 3959
    // Convert degrees to radians: multiply by PI/180
    const PI = '3.14159265359';
    return `(3959 * ACOS(
      COS(${centerLat} * ${PI} / 180) * 
      COS(LATITUDE * ${PI} / 180) * 
      COS((LONGITUDE - ${centerLon}) * ${PI} / 180) + 
      SIN(${centerLat} * ${PI} / 180) * 
      SIN(LATITUDE * ${PI} / 180)
    )) <= ${radiusMiles}`;
  }

  /**
   * Build a distance query that returns records with calculated distance
   * Includes DISTANCE_MILES column for sorting and filtering
   * Requirement 4.3: Geographic filtering with Haversine formula
   * 
   * @param tableName - Name of the table to query
   * @param centerLat - Center latitude in degrees
   * @param centerLon - Center longitude in degrees
   * @param radiusMiles - Maximum distance in miles
   * @returns SQL query with distance calculation
   */
  buildDistanceQuery(
    tableName: string,
    centerLat: number,
    centerLon: number,
    radiusMiles: number
  ): string {
    const PI = '3.14159265359';
    return `SELECT *, 
      (3959 * ACOS(
        COS(${centerLat} * ${PI} / 180) * 
        COS(LATITUDE * ${PI} / 180) * 
        COS((LONGITUDE - ${centerLon}) * ${PI} / 180) + 
        SIN(${centerLat} * ${PI} / 180) * 
        SIN(LATITUDE * ${PI} / 180)
      )) AS DISTANCE_MILES
    FROM ${tableName}
    WHERE LATITUDE IS NOT NULL AND LONGITUDE IS NOT NULL
    HAVING DISTANCE_MILES <= ${radiusMiles}
    ORDER BY DISTANCE_MILES`;
  }

  /**
   * Build fraud summary query with aggregations
   * Calculates total records, flagged count, and risk score statistics
   * Requirement 4.4: Appropriate GROUP BY and aggregate functions
   */
  buildFraudSummaryQuery(tableName: string): string {
    return `SELECT 
      COUNT(*) AS TOTAL_RECORDS,
      SUM(CASE WHEN IS_FLAGGED = 1 THEN 1 ELSE 0 END) AS FLAGGED_COUNT,
      AVG(RISK_SCORE) AS AVG_RISK_SCORE,
      MAX(RISK_SCORE) AS MAX_RISK_SCORE
    FROM ${tableName}`;
  }

  /**
   * Build geographic summary query grouped by region
   * Groups data by rounded lat/lon coordinates
   * Requirement 4.4: Appropriate GROUP BY and aggregate functions
   */
  buildGeographicSummaryQuery(tableName: string): string {
    return `SELECT 
      ROUND(LATITUDE, 0) AS LAT_REGION,
      ROUND(LONGITUDE, 0) AS LON_REGION,
      COUNT(*) AS RECORD_COUNT,
      AVG(RISK_SCORE) AS AVG_RISK
    FROM ${tableName}
    WHERE LATITUDE IS NOT NULL AND LONGITUDE IS NOT NULL
    GROUP BY ROUND(LATITUDE, 0), ROUND(LONGITUDE, 0)
    ORDER BY RECORD_COUNT DESC`;
  }

  /**
   * Build time series query grouped by year and month
   * Uses EXTRACT function for date extraction
   * Requirement 4.5: Appropriate date extraction functions
   */
  buildTimeSeriesQuery(tableName: string): string {
    return `SELECT 
      EXTRACT(YEAR FROM CREATED_AT) AS YEAR,
      EXTRACT(MONTH FROM CREATED_AT) AS MONTH,
      COUNT(*) AS RECORD_COUNT
    FROM ${tableName}
    WHERE CREATED_AT IS NOT NULL
    GROUP BY EXTRACT(YEAR FROM CREATED_AT), EXTRACT(MONTH FROM CREATED_AT)
    ORDER BY YEAR DESC, MONTH DESC`;
  }

  /**
   * Execute a SQL query via MCP tools
   * Integrates with existing getMCPTools() for execution
   * Requirement 4.7: Parse results into structured data for visualization
   * 
   * @param sql - SQL query to execute
   * @returns Query result with parsed data
   */
  async executeQuery(sql: string): Promise<QueryResult> {
    const startTime = Date.now();

    try {
      const tools = await getMCPTools();
      // MCP tools are prefixed with 'sqlcl_' and use underscores
      const runSqlTool = (tools['sqlcl_run_sql'] || tools['run-sql'] || tools['run_sql']) as { execute: (args: unknown) => Promise<unknown> } | undefined;

      if (!runSqlTool) {
        console.error('[QueryEngine] Available tools:', Object.keys(tools));
        throw new Error('MCP run-sql tool not available. Please ensure you are connected to a database.');
      }

      const result = await runSqlTool.execute({ sql });
      const executionTimeMs = Date.now() - startTime;

      const parsed = this.parseResult(result);

      return {
        success: true,
        data: parsed.data,
        columns: parsed.columns,
        rowCount: parsed.data.length,
        executionTimeMs,
        sql,
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        columns: [],
        rowCount: 0,
        executionTimeMs: Date.now() - startTime,
        sql,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Parse MCP tool result into structured data
   * Handles CSV format with proper type conversion
   * Requirement 4.7: Parse results into structured data for visualization
   */
  parseResult(result: unknown): { data: Record<string, unknown>[]; columns: string[] } {
    const content = (result as { content?: Array<{ text?: string }> })?.content?.[0]?.text || '';

    if (!content.trim()) {
      return { data: [], columns: [] };
    }

    const lines = content.trim().split('\n');
    if (lines.length < 1) {
      return { data: [], columns: [] };
    }

    // Parse header line for column names
    const columns = this.parseCSVLine(lines[0]).map(c => c.trim());
    const data: Record<string, unknown>[] = [];

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      const row: Record<string, unknown> = {};

      columns.forEach((col, idx) => {
        const val = values[idx]?.trim();
        row[col] = this.parseValue(val);
      });

      data.push(row);
    }

    return { data, columns };
  }

  /**
   * Parse a single CSV line handling quoted values with commas
   * Properly handles escaped quotes and embedded commas
   */
  parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        // Handle escaped quotes (double quotes)
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.replace(/"/g, ''));
        current = '';
      } else {
        current += char;
      }
    }

    // Add the last field
    result.push(current.replace(/"/g, ''));
    return result;
  }

  /**
   * Parse a string value to appropriate type (null, number, or string)
   */
  parseValue(val: string | undefined): unknown {
    if (val === '' || val === 'NULL' || val === undefined || val === null) {
      return null;
    }

    // Try to parse as number
    if (!isNaN(parseFloat(val)) && isFinite(Number(val))) {
      return parseFloat(val);
    }

    return val;
  }

  /**
   * Format query results with image embedding and multi-modal content
   * Requirement 8.1: Retrieve images from BLOB columns
   * Requirement 8.2: Format similarity scores, view counts, distances
   * Requirement 8.3: Organize results by grouping criteria
   * 
   * @param result - Query result from database
   * @param config - Presentation configuration
   * @returns Formatted result with embedded images and metrics
   */
  formatResultsWithImages(result: QueryResult, config: PresentationConfig = {}): FormattedResult {
    return this.resultPresenter.formatResults(result, config);
  }

  /**
   * Generate HTML for formatted results
   * Requirement 8.5: Support both grid and list layouts
   * 
   * @param formattedResult - Formatted result
   * @param layout - Layout type ('grid' or 'list')
   * @returns HTML string
   */
  generateResultHTML(formattedResult: FormattedResult, layout: 'grid' | 'list' = 'grid'): string {
    return this.resultPresenter.generateHTML(formattedResult, layout);
  }
}
