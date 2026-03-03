// __tests__/unit/schema-discovery.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SchemaDiscoveryService,
  TableSchema,
  Relationship,
} from '../../src/services/schema-discovery';
import { MCPClient } from '@mastra/mcp';

describe('SchemaDiscoveryService', () => {
  let service: SchemaDiscoveryService;
  let mockMCPClient: any;
  let mockRunSqlTool: any;

  beforeEach(() => {
    mockRunSqlTool = {
      execute: vi.fn(),
    };

    mockMCPClient = {
      listToolsets: vi.fn().mockResolvedValue({
        sqlcl: {
          sqlcl_run_sql: mockRunSqlTool,
        },
      }),
    };

    service = new SchemaDiscoveryService(mockMCPClient);
  });

  describe('listTables', () => {
    it('should list tables from database', async () => {
      mockRunSqlTool.execute.mockResolvedValue(`
TABLE_NAME
----------
CUSTOMERS
ORDERS
PRODUCTS
      `);

      const tables = await service.listTables('test_db');

      expect(tables).toEqual(['CUSTOMERS', 'ORDERS', 'PRODUCTS']);
      expect(mockRunSqlTool.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          sql_query: expect.stringContaining('SELECT table_name'),
        })
      );
    });

    it('should use cached table list on second call', async () => {
      mockRunSqlTool.execute.mockResolvedValue(`
TABLE_NAME
----------
CUSTOMERS
      `);

      // First call - should hit database
      await service.listTables('test_db');

      // Second call - should use cache
      const tables = await service.listTables('test_db');

      expect(tables).toEqual(['CUSTOMERS']);
      expect(mockRunSqlTool.execute).toHaveBeenCalledTimes(1);
    });

    it('should stream conversational updates', async () => {
      mockRunSqlTool.execute.mockResolvedValue(`
TABLE_NAME
----------
CUSTOMERS
      `);

      const streamCallback = vi.fn();
      await service.listTables('test_db', streamCallback);

      expect(streamCallback).toHaveBeenCalledWith(
        expect.stringContaining('discovering')
      );
      expect(streamCallback).toHaveBeenCalledWith(
        expect.stringContaining('Found 1 tables')
      );
    });
  });

  describe('describeTable', () => {
    it('should describe table schema with columns', async () => {
      mockRunSqlTool.execute
        .mockResolvedValueOnce([
          {
            COLUMN_NAME: 'ID',
            DATA_TYPE: 'NUMBER',
            NULLABLE: 'N',
          },
          {
            COLUMN_NAME: 'NAME',
            DATA_TYPE: 'VARCHAR2',
            DATA_LENGTH: 100,
            NULLABLE: 'Y',
          },
        ])
        .mockResolvedValueOnce([{ COLUMN_NAME: 'ID' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const schema = await service.describeTable('test_db', 'CUSTOMERS');

      expect(schema.name).toBe('CUSTOMERS');
      expect(schema.columns).toHaveLength(2);
      expect(schema.columns[0].name).toBe('ID');
      expect(schema.columns[0].nullable).toBe(false);
      expect(schema.primaryKey).toEqual(['ID']);
    });

    it('should cache table schema', async () => {
      mockRunSqlTool.execute
        .mockResolvedValueOnce([
          { COLUMN_NAME: 'ID', DATA_TYPE: 'NUMBER', NULLABLE: 'N' },
        ])
        .mockResolvedValueOnce([{ COLUMN_NAME: 'ID' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // First call
      await service.describeTable('test_db', 'CUSTOMERS');

      // Second call - should use cache
      const schema = await service.describeTable('test_db', 'CUSTOMERS');

      expect(schema.name).toBe('CUSTOMERS');
      expect(mockRunSqlTool.execute).toHaveBeenCalledTimes(4); // Only called once
    });

    it('should parse foreign keys correctly', async () => {
      mockRunSqlTool.execute
        .mockResolvedValueOnce([
          { COLUMN_NAME: 'ID', DATA_TYPE: 'NUMBER', NULLABLE: 'N' },
          { COLUMN_NAME: 'CUSTOMER_ID', DATA_TYPE: 'NUMBER', NULLABLE: 'Y' },
        ])
        .mockResolvedValueOnce([{ COLUMN_NAME: 'ID' }])
        .mockResolvedValueOnce([
          {
            CONSTRAINT_NAME: 'FK_ORDERS_CUSTOMERS',
            COLUMN_NAME: 'CUSTOMER_ID',
            REFERENCED_TABLE: 'CUSTOMERS',
            REFERENCED_COLUMN: 'ID',
          },
        ])
        .mockResolvedValueOnce([]);

      const schema = await service.describeTable('test_db', 'ORDERS');

      expect(schema.foreignKeys).toHaveLength(1);
      expect(schema.foreignKeys[0].columns).toEqual(['CUSTOMER_ID']);
      expect(schema.foreignKeys[0].referencedTable).toBe('CUSTOMERS');
      expect(schema.foreignKeys[0].referencedColumns).toEqual(['ID']);
    });
  });

  describe('inferRelationships', () => {
    it('should infer relationship from {table}_ID pattern', () => {
      const tables: TableSchema[] = [
        {
          name: 'CUSTOMERS',
          columns: [{ name: 'ID', dataType: 'NUMBER', nullable: false }],
          primaryKey: ['ID'],
          foreignKeys: [],
          indexes: [],
        },
        {
          name: 'ORDERS',
          columns: [
            { name: 'ID', dataType: 'NUMBER', nullable: false },
            { name: 'CUSTOMER_ID', dataType: 'NUMBER', nullable: true },
          ],
          primaryKey: ['ID'],
          foreignKeys: [],
          indexes: [],
        },
      ];

      const relationships = service.inferRelationships(tables);

      expect(relationships).toHaveLength(1);
      expect(relationships[0]).toMatchObject({
        fromTable: 'ORDERS',
        fromColumn: 'CUSTOMER_ID',
        toTable: 'CUSTOMERS',
        toColumn: 'ID',
        confidence: 'inferred',
      });
    });

    it('should infer relationship from singular-to-plural pattern', () => {
      const tables: TableSchema[] = [
        {
          name: 'CUSTOMERS',
          columns: [{ name: 'ID', dataType: 'NUMBER', nullable: false }],
          primaryKey: ['ID'],
          foreignKeys: [],
          indexes: [],
        },
        {
          name: 'ORDERS',
          columns: [
            { name: 'ID', dataType: 'NUMBER', nullable: false },
            { name: 'CUSTOMER_ID', dataType: 'NUMBER', nullable: true },
          ],
          primaryKey: ['ID'],
          foreignKeys: [],
          indexes: [],
        },
      ];

      const relationships = service.inferRelationships(tables);

      expect(relationships.length).toBeGreaterThan(0);
      const customerRelationship = relationships.find(
        r => r.toTable === 'CUSTOMERS'
      );
      expect(customerRelationship).toBeDefined();
    });

    it('should not infer duplicate relationships', () => {
      const tables: TableSchema[] = [
        {
          name: 'CUSTOMERS',
          columns: [{ name: 'ID', dataType: 'NUMBER', nullable: false }],
          primaryKey: ['ID'],
          foreignKeys: [],
          indexes: [],
        },
        {
          name: 'ORDERS',
          columns: [
            { name: 'ID', dataType: 'NUMBER', nullable: false },
            { name: 'CUSTOMER_ID', dataType: 'NUMBER', nullable: true },
          ],
          primaryKey: ['ID'],
          foreignKeys: [],
          indexes: [],
        },
      ];

      const relationships = service.inferRelationships(tables);

      // Should only have one relationship between ORDERS and CUSTOMERS
      const customerRelationships = relationships.filter(
        r => r.fromTable === 'ORDERS' && r.toTable === 'CUSTOMERS'
      );
      expect(customerRelationships.length).toBe(1);
    });
  });

  describe('getAllRelationships', () => {
    it('should combine explicit and inferred relationships', () => {
      const tables: TableSchema[] = [
        {
          name: 'CUSTOMERS',
          columns: [{ name: 'ID', dataType: 'NUMBER', nullable: false }],
          primaryKey: ['ID'],
          foreignKeys: [],
          indexes: [],
        },
        {
          name: 'ORDERS',
          columns: [
            { name: 'ID', dataType: 'NUMBER', nullable: false },
            { name: 'CUSTOMER_ID', dataType: 'NUMBER', nullable: true },
            { name: 'PRODUCT_ID', dataType: 'NUMBER', nullable: true },
          ],
          primaryKey: ['ID'],
          foreignKeys: [
            {
              columns: ['CUSTOMER_ID'],
              referencedTable: 'CUSTOMERS',
              referencedColumns: ['ID'],
            },
          ],
          indexes: [],
        },
        {
          name: 'PRODUCTS',
          columns: [{ name: 'ID', dataType: 'NUMBER', nullable: false }],
          primaryKey: ['ID'],
          foreignKeys: [],
          indexes: [],
        },
      ];

      const relationships = service.getAllRelationships('test_db', tables);

      // Should have explicit relationship to CUSTOMERS
      const explicitRel = relationships.find(
        r =>
          r.fromTable === 'ORDERS' &&
          r.toTable === 'CUSTOMERS' &&
          r.confidence === 'explicit'
      );
      expect(explicitRel).toBeDefined();

      // Should have inferred relationship to PRODUCTS
      const inferredRel = relationships.find(
        r =>
          r.fromTable === 'ORDERS' &&
          r.toTable === 'PRODUCTS' &&
          r.confidence === 'inferred'
      );
      expect(inferredRel).toBeDefined();
    });

    it('should not duplicate explicit relationships', () => {
      const tables: TableSchema[] = [
        {
          name: 'CUSTOMERS',
          columns: [{ name: 'ID', dataType: 'NUMBER', nullable: false }],
          primaryKey: ['ID'],
          foreignKeys: [],
          indexes: [],
        },
        {
          name: 'ORDERS',
          columns: [
            { name: 'ID', dataType: 'NUMBER', nullable: false },
            { name: 'CUSTOMER_ID', dataType: 'NUMBER', nullable: true },
          ],
          primaryKey: ['ID'],
          foreignKeys: [
            {
              columns: ['CUSTOMER_ID'],
              referencedTable: 'CUSTOMERS',
              referencedColumns: ['ID'],
            },
          ],
          indexes: [],
        },
      ];

      const relationships = service.getAllRelationships('test_db', tables);

      // Should only have one relationship between ORDERS and CUSTOMERS
      const customerRelationships = relationships.filter(
        r => r.fromTable === 'ORDERS' && r.toTable === 'CUSTOMERS'
      );
      expect(customerRelationships.length).toBe(1);
      expect(customerRelationships[0].confidence).toBe('explicit');
    });
  });

  describe('cache management', () => {
    it('should invalidate cache for specific connection', async () => {
      mockRunSqlTool.execute.mockResolvedValue(`
TABLE_NAME
----------
CUSTOMERS
      `);

      // First call - populate cache
      await service.listTables('test_db');

      // Invalidate cache
      service.invalidateCache('test_db');

      // Second call - should hit database again
      await service.listTables('test_db');

      expect(mockRunSqlTool.execute).toHaveBeenCalledTimes(2);
    });

    it('should clear all cache', async () => {
      mockRunSqlTool.execute.mockResolvedValue(`
TABLE_NAME
----------
CUSTOMERS
      `);

      // Populate cache for multiple connections
      await service.listTables('db1');
      await service.listTables('db2');

      // Clear all cache
      service.clearCache();

      // Should hit database again
      await service.listTables('db1');

      expect(mockRunSqlTool.execute).toHaveBeenCalledTimes(3);
    });

    it('should invalidate cache when connection changes', () => {
      service.setActiveConnection('db1');
      service.setActiveConnection('db2');

      // Cache for db1 should be invalidated
      expect(service.getCachedSchema('db1')).toBeUndefined();
    });

    it('should respect cache TTL', async () => {
      // Create service with short TTL
      const shortTTLService = new SchemaDiscoveryService(mockMCPClient, {
        ttl: 100, // 100ms
        sessionBased: true,
      });

      mockRunSqlTool.execute.mockResolvedValue(`
TABLE_NAME
----------
CUSTOMERS
      `);

      // First call - populate cache
      await shortTTLService.listTables('test_db');

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Second call - should hit database again
      await shortTTLService.listTables('test_db');

      expect(mockRunSqlTool.execute).toHaveBeenCalledTimes(2);
    });

    it('should check cache validity', async () => {
      mockRunSqlTool.execute.mockResolvedValue(`
TABLE_NAME
----------
CUSTOMERS
      `);

      // No cache initially
      expect(service.isCacheValid('test_db')).toBe(false);

      // Populate cache
      await service.listTables('test_db');

      // Cache should be valid
      expect(service.isCacheValid('test_db')).toBe(true);
    });
  });
});
