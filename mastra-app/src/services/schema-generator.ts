// src/services/schema-generator.ts

import {
  Entity,
  Relationship,
  AnalysisCategory,
  TableDefinition,
  ColumnDefinition,
  IndexDefinition,
  GeneratedSchema,
} from '@/types';

/**
 * SchemaGenerator dynamically creates database schemas based on analysis intent.
 * 
 * Requirements covered:
 * - 2.1: Create table definitions with appropriate columns and data types
 * - 2.2: Include fraud detection columns (amounts, timestamps, risk scores, coordinates)
 * - 2.3: Include geographic analysis columns (latitude, longitude, location identifiers)
 * - 2.4: Include similarity search columns (embedding vectors)
 * - 2.5: Add appropriate indexes for query performance
 * - 2.6: Output valid Oracle SQL CREATE TABLE statements
 * - 2.7: Support custom column additions based on user-specified attributes
 */
export class SchemaGenerator {
  private typeMapping: Record<string, string> = {
    'string': 'VARCHAR2(255)',
    'number': 'NUMBER',
    'date': 'TIMESTAMP',
    'boolean': 'NUMBER(1)',
    'coordinates': 'NUMBER(10,6)',
    'embedding': 'VECTOR(512, FLOAT32)',
  };

  /**
   * Generates a complete schema from entities, relationships, and analysis categories.
   * 
   * @param entities - List of entities to create tables for
   * @param relationships - Relationships between entities for foreign keys
   * @param categories - Analysis categories that determine additional columns
   * @returns Generated schema with tables, CREATE and DROP statements
   */
  generateSchema(
    entities: Entity[],
    relationships: Relationship[],
    categories: AnalysisCategory[]
  ): GeneratedSchema {
    const tables: TableDefinition[] = [];

    // Generate tables for each entity
    for (const entity of entities) {
      const table = this.entityToTable(entity, categories);
      tables.push(table);
    }

    // Add foreign keys based on relationships
    for (const rel of relationships) {
      this.addForeignKey(tables, rel);
    }

    // Generate SQL statements
    const dropStatements = tables.map(t => `DROP TABLE ${t.name} CASCADE CONSTRAINTS`);
    const createStatements = tables.map(t => this.generateCreateStatement(t));

    return { tables, createStatements, dropStatements };
  }


  /**
   * Converts an entity to a table definition with category-specific columns.
   * 
   * @param entity - The entity to convert
   * @param categories - Analysis categories for injecting specific columns
   * @returns Table definition with all columns, primary key, and indexes
   */
  private entityToTable(entity: Entity, categories: AnalysisCategory[]): TableDefinition {
    const tableName = this.toTableName(entity.name);
    const columns: ColumnDefinition[] = [
      { name: 'ID', oracleType: 'NUMBER GENERATED ALWAYS AS IDENTITY', nullable: false },
    ];

    // Add columns from entity attributes (Requirement 2.7 - custom column additions)
    for (const attr of entity.attributes) {
      columns.push({
        name: this.toColumnName(attr.name),
        oracleType: this.typeMapping[attr.dataType] || 'VARCHAR2(255)',
        nullable: !attr.isRequired,
      });
    }

    // Add category-specific columns (Requirements 2.2, 2.3, 2.4)
    this.injectCategoryColumns(columns, categories);

    // Generate indexes (Requirement 2.5)
    const indexes: IndexDefinition[] = this.generateIndexes(tableName, columns, categories);

    return {
      name: tableName,
      columns,
      primaryKey: ['ID'],
      foreignKeys: [],
      indexes,
    };
  }

  /**
   * Injects category-specific columns into the column list.
   * Avoids duplicates by checking if columns already exist.
   * 
   * @param columns - Existing columns array to modify
   * @param categories - Analysis categories determining which columns to add
   */
  private injectCategoryColumns(columns: ColumnDefinition[], categories: AnalysisCategory[]): void {
    // Fraud detection columns (Requirement 2.2)
    if (categories.includes('fraud_detection')) {
      if (!columns.some(c => c.name === 'RISK_SCORE')) {
        columns.push(
          { name: 'RISK_SCORE', oracleType: 'NUMBER(5,2)', nullable: true },
          { name: 'IS_FLAGGED', oracleType: 'NUMBER(1)', nullable: true, defaultValue: '0' }
        );
      }
    }

    // Geographic analysis columns (Requirement 2.3)
    if (categories.includes('geographic_analysis')) {
      if (!columns.some(c => c.name === 'LATITUDE')) {
        columns.push(
          { name: 'LATITUDE', oracleType: 'NUMBER(10,6)', nullable: true },
          { name: 'LONGITUDE', oracleType: 'NUMBER(10,6)', nullable: true }
        );
      }
    }

    // Time series columns
    if (categories.includes('time_series')) {
      const hasTimeColumn = columns.some(c => 
        c.name.includes('DATE') || c.name.includes('TIME') || c.name === 'CREATED_AT'
      );
      if (!hasTimeColumn) {
        columns.push(
          { name: 'CREATED_AT', oracleType: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP', nullable: false }
        );
      }
    }

    // Similarity search columns (Requirement 2.4)
    if (categories.includes('similarity_search')) {
      if (!columns.some(c => c.name === 'EMBEDDING')) {
        columns.push(
          { name: 'EMBEDDING', oracleType: 'VECTOR(512, FLOAT32)', nullable: true }
        );
      }
    }
  }

  /**
   * Generates indexes based on table columns and analysis categories.
   * 
   * @param tableName - Name of the table for index naming
   * @param columns - Columns in the table
   * @param categories - Analysis categories for determining index types
   * @returns Array of index definitions
   */
  private generateIndexes(
    tableName: string,
    columns: ColumnDefinition[],
    categories: AnalysisCategory[]
  ): IndexDefinition[] {
    const indexes: IndexDefinition[] = [];

    // Geographic index (Requirement 2.5)
    if (categories.includes('geographic_analysis') && columns.some(c => c.name === 'LATITUDE')) {
      indexes.push({
        name: `IDX_${tableName}_GEO`,
        columns: ['LATITUDE', 'LONGITUDE'],
        unique: false,
      });
    }

    // Time series index
    if (categories.includes('time_series')) {
      const timeCol = columns.find(c => 
        c.name.includes('DATE') || c.name.includes('TIME') || c.name === 'CREATED_AT'
      );
      if (timeCol) {
        indexes.push({
          name: `IDX_${tableName}_TIME`,
          columns: [timeCol.name],
          unique: false,
        });
      }
    }

    // Fraud detection index on risk score
    if (categories.includes('fraud_detection') && columns.some(c => c.name === 'RISK_SCORE')) {
      indexes.push({
        name: `IDX_${tableName}_RISK`,
        columns: ['RISK_SCORE', 'IS_FLAGGED'],
        unique: false,
      });
    }

    return indexes;
  }


  /**
   * Generates a valid Oracle SQL CREATE TABLE statement (Requirement 2.6).
   * 
   * @param table - Table definition to generate SQL for
   * @returns Complete CREATE TABLE SQL statement
   */
  private generateCreateStatement(table: TableDefinition): string {
    const columnDefs = table.columns.map(col => {
      let def = `  ${col.name} ${col.oracleType}`;
      if (!col.nullable) def += ' NOT NULL';
      if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
      return def;
    });

    // Add primary key constraint
    const pkDef = `  CONSTRAINT PK_${table.name} PRIMARY KEY (${table.primaryKey.join(', ')})`;
    columnDefs.push(pkDef);

    // Add foreign key constraints
    for (const fk of table.foreignKeys) {
      const fkDef = `  CONSTRAINT FK_${table.name}_${fk.referencesTable} FOREIGN KEY (${fk.columns.join(', ')}) REFERENCES ${fk.referencesTable}(${fk.referencesColumns.join(', ')})`;
      columnDefs.push(fkDef);
    }

    return `CREATE TABLE ${table.name} (\n${columnDefs.join(',\n')}\n)`;
  }

  /**
   * Generates CREATE INDEX statements for a table.
   * 
   * @param table - Table definition with indexes
   * @returns Array of CREATE INDEX SQL statements
   */
  generateIndexStatements(table: TableDefinition): string[] {
    return table.indexes.map(idx => {
      const uniqueKeyword = idx.unique ? 'UNIQUE ' : '';
      return `CREATE ${uniqueKeyword}INDEX ${idx.name} ON ${table.name} (${idx.columns.join(', ')})`;
    });
  }

  /**
   * Adds a foreign key to a table based on a relationship.
   * 
   * @param tables - All tables to search for the source table
   * @param rel - Relationship defining the foreign key
   */
  private addForeignKey(tables: TableDefinition[], rel: Relationship): void {
    const fromTable = tables.find(t => t.name === this.toTableName(rel.from));
    if (fromTable) {
      // Add the foreign key column if it doesn't exist
      const fkColumnName = this.toColumnName(rel.foreignKey);
      if (!fromTable.columns.some(c => c.name === fkColumnName)) {
        fromTable.columns.push({
          name: fkColumnName,
          oracleType: 'NUMBER',
          nullable: true,
        });
      }

      fromTable.foreignKeys.push({
        columns: [fkColumnName],
        referencesTable: this.toTableName(rel.to),
        referencesColumns: ['ID'],
      });
    }
  }

  /**
   * Converts an entity name to a valid Oracle table name.
   * Converts to uppercase and replaces spaces with underscores.
   * 
   * @param name - Entity name to convert
   * @returns Valid Oracle table name
   */
  private toTableName(name: string): string {
    return name.toUpperCase().replace(/\s+/g, '_');
  }

  /**
   * Converts an attribute name to a valid Oracle column name.
   * Converts to uppercase and replaces spaces with underscores.
   * 
   * @param name - Attribute name to convert
   * @returns Valid Oracle column name
   */
  private toColumnName(name: string): string {
    return name.toUpperCase().replace(/\s+/g, '_');
  }

  /**
   * Maps a data type to its Oracle SQL equivalent.
   * 
   * @param dataType - The abstract data type
   * @returns Oracle SQL data type string
   */
  getOracleType(dataType: string): string {
    return this.typeMapping[dataType] || 'VARCHAR2(255)';
  }
}
