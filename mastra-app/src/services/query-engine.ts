// src/services/query-engine.ts
/**
 * Query Engine Service
 * Constructs and executes SQL queries via MCP tools.
 * Supports geographic queries with Haversine distance, time-based grouping, and fraud analysis.
 * 
 * Requirements: 4.1, 4.3, 4.4, 4.5, 4.7
 */

import { getMCPTools } from '@/mastra/agents/database-agent';
import { AnalysisCategory, VisualizationGoal } from '@/types';

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
 */
export class QueryEngine {
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
   * Requirement 4.1: Construct SQL queries appropriate for the analysis type
   */
  buildMainQuery(config: QueryConfig): string {
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
}
