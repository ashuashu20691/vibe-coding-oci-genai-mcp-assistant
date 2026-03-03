// src/services/schema-discovery-example.ts
/**
 * Example usage of SchemaDiscoveryService
 * 
 * This file demonstrates how to use the schema discovery service
 * to introspect database schemas and infer relationships.
 */

import { schemaDiscoveryService } from './schema-discovery';
import { getMCPClient } from '@/mastra/agents/database-agent';

/**
 * Example: Discover all tables in a database
 */
export async function discoverDatabaseSchema(connectionName: string) {
  // Get MCP client
  const mcpClient = await getMCPClient();
  if (!mcpClient) {
    throw new Error('MCP client not available');
  }

  // Set MCP client and active connection
  schemaDiscoveryService.setMCPClient(mcpClient);
  schemaDiscoveryService.setActiveConnection(connectionName);

  // List all tables
  console.log('Discovering tables...');
  const tables = await schemaDiscoveryService.listTables(
    connectionName,
    (message) => console.log(`[Discovery] ${message}`)
  );

  console.log(`Found ${tables.length} tables:`, tables);

  // Describe each table
  const tableSchemas = [];
  for (const tableName of tables) {
    console.log(`\nDescribing ${tableName}...`);
    const schema = await schemaDiscoveryService.describeTable(
      connectionName,
      tableName,
      (message) => console.log(`[Discovery] ${message}`)
    );

    tableSchemas.push(schema);

    console.log(`  Columns: ${schema.columns.length}`);
    console.log(`  Primary Key: ${schema.primaryKey.join(', ')}`);
    console.log(`  Foreign Keys: ${schema.foreignKeys.length}`);
    console.log(`  Indexes: ${schema.indexes.length}`);
  }

  // Infer relationships
  console.log('\nInferring relationships...');
  const allRelationships = schemaDiscoveryService.getAllRelationships(
    connectionName,
    tableSchemas
  );

  console.log(`Found ${allRelationships.length} relationships:`);
  for (const rel of allRelationships) {
    console.log(
      `  ${rel.fromTable}.${rel.fromColumn} -> ${rel.toTable}.${rel.toColumn} (${rel.confidence})`
    );
    if (rel.inferenceReason) {
      console.log(`    Reason: ${rel.inferenceReason}`);
    }
  }

  return {
    tables: tableSchemas,
    relationships: allRelationships,
  };
}

/**
 * Example: Get schema for a specific table with caching
 */
export async function getTableSchema(
  connectionName: string,
  tableName: string
) {
  const mcpClient = await getMCPClient();
  if (!mcpClient) {
    throw new Error('MCP client not available');
  }

  schemaDiscoveryService.setMCPClient(mcpClient);

  // First call - will query database
  console.log(`Getting schema for ${tableName}...`);
  const schema1 = await schemaDiscoveryService.describeTable(
    connectionName,
    tableName
  );

  // Second call - will use cache
  console.log(`Getting schema for ${tableName} again (should use cache)...`);
  const schema2 = await schemaDiscoveryService.describeTable(
    connectionName,
    tableName
  );

  console.log('Cache hit:', schema1 === schema2);

  return schema1;
}

/**
 * Example: Invalidate cache when switching connections
 */
export async function switchConnection(
  oldConnection: string,
  newConnection: string
) {
  const mcpClient = await getMCPClient();
  if (!mcpClient) {
    throw new Error('MCP client not available');
  }

  schemaDiscoveryService.setMCPClient(mcpClient);

  // Set new connection (automatically invalidates old cache)
  console.log(`Switching from ${oldConnection} to ${newConnection}...`);
  schemaDiscoveryService.setActiveConnection(newConnection);

  // Cache for old connection should be invalidated
  const oldCache = schemaDiscoveryService.getCachedSchema(oldConnection);
  console.log('Old cache invalidated:', oldCache === undefined);

  // Discover schema for new connection
  const tables = await schemaDiscoveryService.listTables(newConnection);
  console.log(`Found ${tables.length} tables in ${newConnection}`);

  return tables;
}
