// src/services/schema-discovery.ts
/**
 * Schema Discovery Service
 * 
 * Discovers database schemas via SQLcl MCP Server and infers relationships
 * from column naming patterns. Caches schema metadata for session duration.
 * 
 * Requirements covered:
 * - 5.1: List all accessible tables and views via SQLcl MCP
 * - 5.2: Retrieve column names, data types, constraints, and indexes
 * - 5.3: Query foreign key relationships between tables
 * - 5.4: Infer relationships from column naming patterns
 * - 5.5: Cache schema information for session duration
 */

import { MCPClient } from '@mastra/mcp';

/**
 * Column metadata from database introspection
 */
export interface Column {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey?: boolean;
}

/**
 * Foreign key constraint information
 */
export interface ForeignKey {
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  constraintName?: string;
}

/**
 * Index information
 */
export interface Index {
  name: string;
  columns: string[];
  unique: boolean;
  indexType?: string;
}

/**
 * Complete table schema metadata
 */
export interface TableSchema {
  name: string;
  columns: Column[];
  primaryKey: string[];
  foreignKeys: ForeignKey[];
  indexes: Index[];
  rowCount?: number;
}

/**
 * Relationship between tables (explicit or inferred)
 */
export interface Relationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  confidence: 'explicit' | 'inferred';
  inferenceReason?: string;
}

/**
 * Cached schema metadata for a database connection
 */
interface SchemaCache {
  tables: Map<string, TableSchema>;
  relationships: Relationship[];
  lastUpdated: Date;
  connectionName: string;
  expiresAt: Date;
}

/**
 * Cache configuration options
 */
interface CacheOptions {
  /** Cache TTL in milliseconds (default: 1 hour) */
  ttl?: number;
  /** Whether to use session-based expiry (default: true) */
  sessionBased?: boolean;
}

/**
 * Schema Discovery Service
 * 
 * Provides database schema introspection and relationship inference
 * with session-based caching.
 */
export class SchemaDiscoveryService {
  private cache: Map<string, SchemaCache> = new Map();
  private mcpClient: MCPClient | null = null;
  private cacheOptions: CacheOptions;
  private activeConnection: string | null = null;

  constructor(mcpClient?: MCPClient, cacheOptions?: CacheOptions) {
    this.mcpClient = mcpClient || null;
    this.cacheOptions = {
      ttl: cacheOptions?.ttl || 60 * 60 * 1000, // Default: 1 hour
      sessionBased: cacheOptions?.sessionBased !== false, // Default: true
    };
  }

  /**
   * Set the MCP client for database operations
   */
  setMCPClient(client: MCPClient): void {
    this.mcpClient = client;
  }

  /**
   * Get MCP tools from the client
   */
  private async getMCPTools(): Promise<Record<string, any>> {
    if (!this.mcpClient) {
      throw new Error('MCP client not configured');
    }

    try {
      const toolsets = await this.mcpClient.listToolsets();
      const sqlclTools = toolsets['sqlcl'] as Record<string, any> | undefined;
      return sqlclTools || {};
    } catch (error) {
      console.error('[SchemaDiscovery] Failed to get MCP tools:', error);
      return {};
    }
  }

  /**
   * Set the active database connection
   * Invalidates cache when connection changes (Requirement 5.5)
   * 
   * @param connection - Database connection name
   */
  setActiveConnection(connection: string): void {
    if (this.activeConnection && this.activeConnection !== connection) {
      // Connection changed - invalidate old cache
      this.invalidateCache(this.activeConnection);
    }
    this.activeConnection = connection;
  }

  /**
   * Get the active database connection
   */
  getActiveConnection(): string | null {
    return this.activeConnection;
  }

  /**
   * List all tables in the connected database (Requirement 5.1)
   * 
   * @param connection - Database connection name
   * @param streamCallback - Optional callback for streaming conversational updates
   * @returns Array of table names
   */
  async listTables(
    connection: string,
    streamCallback?: (message: string) => void
  ): Promise<string[]> {
    if (!this.mcpClient) {
      throw new Error('MCP client not configured');
    }

    // Check cache first (with expiry check)
    const cached = this.getCachedSchemaIfValid(connection);
    if (cached && cached.tables.size > 0) {
      streamCallback?.('Using cached table list...');
      return Array.from(cached.tables.keys());
    }

    streamCallback?.("I'm discovering the database schema...");

    try {
      // Get MCP tools
      const tools = await this.getMCPTools();
      const runSqlTool = tools['sqlcl_run_sql'] as { execute: (args: any) => Promise<any> } | undefined;

      if (!runSqlTool) {
        throw new Error('sqlcl_run_sql tool not available');
      }

      // Query SQLcl MCP for table list
      const result = await runSqlTool.execute({
        sql_query: `
          SELECT table_name 
          FROM user_tables 
          ORDER BY table_name
        `,
      });

      const tables = this.parseTableList(result);
      streamCallback?.(`Found ${tables.length} tables in the database.`);

      // Cache the table list by creating minimal table schemas
      for (const tableName of tables) {
        const existingCache = this.getCachedSchemaIfValid(connection);
        if (!existingCache?.tables.has(tableName)) {
          // Create a minimal schema entry to mark table as known
          this.updateCache(connection, tableName, {
            name: tableName,
            columns: [],
            primaryKey: [],
            foreignKeys: [],
            indexes: [],
          });
        }
      }

      return tables;
    } catch (error) {
      console.error('[SchemaDiscovery] Failed to list tables:', error);
      throw new Error(`Failed to list tables: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Describe a specific table's schema (Requirement 5.2)
   * 
   * @param connection - Database connection name
   * @param tableName - Name of the table to describe
   * @param streamCallback - Optional callback for streaming conversational updates
   * @returns Complete table schema with columns, constraints, and indexes
   */
  async describeTable(
    connection: string,
    tableName: string,
    streamCallback?: (message: string) => void
  ): Promise<TableSchema> {
    if (!this.mcpClient) {
      throw new Error('MCP client not configured');
    }

    // Check cache first (with expiry check)
    const cached = this.getCachedSchemaIfValid(connection);
    if (cached?.tables.has(tableName)) {
      const cachedTable = cached.tables.get(tableName)!;
      // Only return cached if it has columns (not just a placeholder)
      if (cachedTable.columns.length > 0) {
        streamCallback?.(`Using cached schema for ${tableName}...`);
        return cachedTable;
      }
    }

    streamCallback?.(`I'm examining the structure of ${tableName}...`);

    try {
      // Get MCP tools
      const tools = await this.getMCPTools();
      const runSqlTool = tools['sqlcl_run_sql'] as { execute: (args: any) => Promise<any> } | undefined;

      if (!runSqlTool) {
        throw new Error('sqlcl_run_sql tool not available');
      }

      // Get column information
      const columnsResult = await runSqlTool.execute({
        sql_query: `
          SELECT 
            column_name,
            data_type,
            data_length,
            data_precision,
            data_scale,
            nullable,
            data_default
          FROM user_tab_columns
          WHERE table_name = '${tableName.toUpperCase()}'
          ORDER BY column_id
        `,
      });

      const columns = this.parseColumns(columnsResult);

      // Get primary key information
      const pkResult = await runSqlTool.execute({
        sql_query: `
          SELECT cols.column_name
          FROM user_constraints cons
          JOIN user_cons_columns cols ON cons.constraint_name = cols.constraint_name
          WHERE cons.table_name = '${tableName.toUpperCase()}'
            AND cons.constraint_type = 'P'
          ORDER BY cols.position
        `,
      });

      const primaryKey = this.parsePrimaryKey(pkResult);

      // Get foreign key information (Requirement 5.3)
      const fkResult = await runSqlTool.execute({
        sql_query: `
          SELECT 
            cons.constraint_name,
            cols.column_name,
            ref_cons.table_name as referenced_table,
            ref_cols.column_name as referenced_column
          FROM user_constraints cons
          JOIN user_cons_columns cols ON cons.constraint_name = cols.constraint_name
          JOIN user_constraints ref_cons ON cons.r_constraint_name = ref_cons.constraint_name
          JOIN user_cons_columns ref_cols ON ref_cons.constraint_name = ref_cols.constraint_name
          WHERE cons.table_name = '${tableName.toUpperCase()}'
            AND cons.constraint_type = 'R'
          ORDER BY cons.constraint_name, cols.position
        `,
      });

      const foreignKeys = this.parseForeignKeys(fkResult);

      // Get index information
      const indexResult = await runSqlTool.execute({
        sql_query: `
          SELECT 
            i.index_name,
            i.uniqueness,
            ic.column_name,
            ic.column_position
          FROM user_indexes i
          JOIN user_ind_columns ic ON i.index_name = ic.index_name
          WHERE i.table_name = '${tableName.toUpperCase()}'
          ORDER BY i.index_name, ic.column_position
        `,
      });

      const indexes = this.parseIndexes(indexResult);

      const tableSchema: TableSchema = {
        name: tableName,
        columns,
        primaryKey,
        foreignKeys,
        indexes,
      };

      // Update cache
      this.updateCache(connection, tableName, tableSchema);

      streamCallback?.(`Discovered ${columns.length} columns and ${foreignKeys.length} foreign keys.`);

      return tableSchema;
    } catch (error) {
      console.error(`[SchemaDiscovery] Failed to describe table ${tableName}:`, error);
      throw new Error(`Failed to describe table: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Infer relationships between tables based on naming patterns (Requirement 5.4)
   * 
   * @param tables - Array of table schemas to analyze
   * @returns Array of inferred relationships
   */
  inferRelationships(tables: TableSchema[]): Relationship[] {
    const relationships: Relationship[] = [];
    const tableMap = new Map(tables.map(t => [t.name.toUpperCase(), t]));

    for (const table of tables) {
      for (const column of table.columns) {
        const columnName = column.name.toUpperCase();

        // Pattern 1: {table}_ID -> {table}.ID
        const match1 = columnName.match(/^(.+)_ID$/);
        if (match1) {
          const referencedTableName = match1[1];
          const referencedTable = tableMap.get(referencedTableName);

          if (referencedTable && referencedTable.primaryKey.includes('ID')) {
            relationships.push({
              fromTable: table.name,
              fromColumn: column.name,
              toTable: referencedTable.name,
              toColumn: 'ID',
              confidence: 'inferred',
              inferenceReason: `Column ${column.name} matches pattern {table}_ID`,
            });
            continue;
          }
        }

        // Pattern 2: {table}_{pk_column} -> {table}.{pk_column}
        for (const [refTableName, refTable] of tableMap) {
          if (refTableName === table.name.toUpperCase()) continue;

          for (const pkColumn of refTable.primaryKey) {
            const expectedColumnName = `${refTableName}_${pkColumn}`;
            if (columnName === expectedColumnName) {
              relationships.push({
                fromTable: table.name,
                fromColumn: column.name,
                toTable: refTable.name,
                toColumn: pkColumn,
                confidence: 'inferred',
                inferenceReason: `Column ${column.name} matches pattern {table}_{pk_column}`,
              });
            }
          }
        }

        // Pattern 3: Singular table name + _ID (e.g., CUSTOMER_ID -> CUSTOMERS.ID)
        if (columnName.endsWith('_ID')) {
          const singularName = columnName.slice(0, -3); // Remove _ID
          const pluralName = singularName + 'S';

          const referencedTable = tableMap.get(pluralName);
          if (referencedTable && referencedTable.primaryKey.includes('ID')) {
            // Check if we haven't already added this relationship
            const exists = relationships.some(
              r =>
                r.fromTable === table.name &&
                r.fromColumn === column.name &&
                r.toTable === referencedTable.name
            );

            if (!exists) {
              relationships.push({
                fromTable: table.name,
                fromColumn: column.name,
                toTable: referencedTable.name,
                toColumn: 'ID',
                confidence: 'inferred',
                inferenceReason: `Column ${column.name} matches singular-to-plural pattern`,
              });
            }
          }
        }
      }
    }

    return relationships;
  }

  /**
   * Get all relationships for a set of tables (explicit + inferred)
   * 
   * @param connection - Database connection name
   * @param tables - Array of table schemas
   * @returns Combined array of explicit and inferred relationships
   */
  getAllRelationships(connection: string, tables: TableSchema[]): Relationship[] {
    // Extract explicit relationships from foreign keys
    const explicitRelationships: Relationship[] = [];
    for (const table of tables) {
      for (const fk of table.foreignKeys) {
        explicitRelationships.push({
          fromTable: table.name,
          fromColumn: fk.columns[0], // Simplified: assume single-column FK
          toTable: fk.referencedTable,
          toColumn: fk.referencedColumns[0],
          confidence: 'explicit',
        });
      }
    }

    // Infer additional relationships
    const inferredRelationships = this.inferRelationships(tables);

    // Combine and deduplicate
    const allRelationships = [...explicitRelationships];
    for (const inferred of inferredRelationships) {
      const exists = explicitRelationships.some(
        explicit =>
          explicit.fromTable === inferred.fromTable &&
          explicit.fromColumn === inferred.fromColumn &&
          explicit.toTable === inferred.toTable
      );

      if (!exists) {
        allRelationships.push(inferred);
      }
    }

    return allRelationships;
  }

  /**
   * Invalidate cache for a specific connection (Requirement 5.5)
   * 
   * @param connection - Database connection name
   */
  invalidateCache(connection: string): void {
    this.cache.delete(connection);
  }

  /**
   * Clear all cached schema data
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cached schema for a connection
   * 
   * @param connection - Database connection name
   * @returns Cached schema or undefined if not cached
   */
  getCachedSchema(connection: string): SchemaCache | undefined {
    return this.cache.get(connection);
  }

  /**
   * Get cached schema if valid (not expired)
   * 
   * @param connection - Database connection name
   * @returns Cached schema or undefined if expired or not cached
   */
  private getCachedSchemaIfValid(connection: string): SchemaCache | undefined {
    const cached = this.cache.get(connection);
    if (!cached) {
      return undefined;
    }

    // Check if cache has expired
    if (this.cacheOptions.sessionBased && cached.expiresAt < new Date()) {
      this.invalidateCache(connection);
      return undefined;
    }

    return cached;
  }

  /**
   * Check if cache is valid for a connection
   * 
   * @param connection - Database connection name
   * @returns true if cache exists and is not expired
   */
  isCacheValid(connection: string): boolean {
    return this.getCachedSchemaIfValid(connection) !== undefined;
  }

  // Private helper methods

  private parseTableList(result: unknown): string[] {
    // Parse SQLcl result format
    if (typeof result === 'string') {
      // Simple parsing: extract table names from result
      const lines = result.split('\n');
      const tables: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('-') && !trimmed.includes('TABLE_NAME')) {
          tables.push(trimmed);
        }
      }

      return tables;
    }

    // Handle structured result
    if (Array.isArray(result)) {
      return result.map((row: any) => row.TABLE_NAME || row.table_name);
    }

    return [];
  }

  private parseColumns(result: unknown): Column[] {
    const columns: Column[] = [];

    if (typeof result === 'string') {
      // Parse text-based result
      const lines = result.split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3 && !line.includes('COLUMN_NAME')) {
          columns.push({
            name: parts[0],
            dataType: parts[1],
            nullable: parts[2] === 'Y',
          });
        }
      }
    } else if (Array.isArray(result)) {
      // Parse structured result
      for (const row of result) {
        columns.push({
          name: row.COLUMN_NAME || row.column_name,
          dataType: this.formatDataType(row),
          nullable: (row.NULLABLE || row.nullable) === 'Y',
          defaultValue: row.DATA_DEFAULT || row.data_default,
        });
      }
    }

    return columns;
  }

  private formatDataType(row: any): string {
    const dataType = row.DATA_TYPE || row.data_type;
    const precision = row.DATA_PRECISION || row.data_precision;
    const scale = row.DATA_SCALE || row.data_scale;
    const length = row.DATA_LENGTH || row.data_length;

    if (precision && scale !== null && scale !== undefined) {
      return `${dataType}(${precision},${scale})`;
    } else if (precision) {
      return `${dataType}(${precision})`;
    } else if (length && dataType.includes('CHAR')) {
      return `${dataType}(${length})`;
    }

    return dataType;
  }

  private parsePrimaryKey(result: unknown): string[] {
    const pkColumns: string[] = [];

    if (typeof result === 'string') {
      const lines = result.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.includes('COLUMN_NAME')) {
          pkColumns.push(trimmed);
        }
      }
    } else if (Array.isArray(result)) {
      for (const row of result) {
        pkColumns.push(row.COLUMN_NAME || row.column_name);
      }
    }

    return pkColumns;
  }

  private parseForeignKeys(result: unknown): ForeignKey[] {
    const fkMap = new Map<string, ForeignKey>();

    if (Array.isArray(result)) {
      for (const row of result) {
        const constraintName = row.CONSTRAINT_NAME || row.constraint_name;
        const columnName = row.COLUMN_NAME || row.column_name;
        const referencedTable = row.REFERENCED_TABLE || row.referenced_table;
        const referencedColumn = row.REFERENCED_COLUMN || row.referenced_column;

        if (!fkMap.has(constraintName)) {
          fkMap.set(constraintName, {
            columns: [],
            referencedTable,
            referencedColumns: [],
            constraintName,
          });
        }

        const fk = fkMap.get(constraintName)!;
        fk.columns.push(columnName);
        fk.referencedColumns.push(referencedColumn);
      }
    }

    return Array.from(fkMap.values());
  }

  private parseIndexes(result: unknown): Index[] {
    const indexMap = new Map<string, Index>();

    if (Array.isArray(result)) {
      for (const row of result) {
        const indexName = row.INDEX_NAME || row.index_name;
        const columnName = row.COLUMN_NAME || row.column_name;
        const uniqueness = row.UNIQUENESS || row.uniqueness;

        if (!indexMap.has(indexName)) {
          indexMap.set(indexName, {
            name: indexName,
            columns: [],
            unique: uniqueness === 'UNIQUE',
          });
        }

        const index = indexMap.get(indexName)!;
        index.columns.push(columnName);
      }
    }

    return Array.from(indexMap.values());
  }

  private updateCache(connection: string, tableName: string, schema: TableSchema): void {
    let cache = this.cache.get(connection);

    if (!cache) {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.cacheOptions.ttl!);

      cache = {
        tables: new Map(),
        relationships: [],
        lastUpdated: now,
        connectionName: connection,
        expiresAt,
      };
      this.cache.set(connection, cache);
    }

    cache.tables.set(tableName, schema);
    cache.lastUpdated = new Date();
  }
}

// Export singleton instance
export const schemaDiscoveryService = new SchemaDiscoveryService();
