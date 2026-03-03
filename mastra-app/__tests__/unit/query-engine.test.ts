// __tests__/unit/query-engine.test.ts
/**
 * Unit tests for QueryEngine
 * Tests JOIN generation, window functions, aggregations, temporal analysis, and performance grading
 * 
 * Requirements tested: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { QueryEngine } from '@/services/query-engine';
import type { Relationship } from '@/services/schema-discovery';

describe('QueryEngine - Enhanced SQL Generation', () => {
  let queryEngine: QueryEngine;

  beforeEach(() => {
    queryEngine = new QueryEngine();
  });

  describe('JOIN Generation (Requirement 6.1)', () => {
    it('should generate INNER JOIN from direct relationship', () => {
      const relationships: Relationship[] = [
        {
          fromTable: 'ORDERS',
          fromColumn: 'CUSTOMER_ID',
          toTable: 'CUSTOMERS',
          toColumn: 'ID',
          confidence: 'explicit',
        },
      ];

      const joins = queryEngine.generateJoinsFromRelationships(
        'ORDERS',
        relationships,
        ['CUSTOMERS']
      );

      expect(joins).toHaveLength(1);
      expect(joins[0]).toEqual({
        type: 'INNER',
        table: 'CUSTOMERS',
        on: {
          leftColumn: 'ORDERS.CUSTOMER_ID',
          rightColumn: 'CUSTOMERS.ID',
        },
      });
    });

    it('should generate JOIN from reverse relationship', () => {
      const relationships: Relationship[] = [
        {
          fromTable: 'ORDER_ITEMS',
          fromColumn: 'ORDER_ID',
          toTable: 'ORDERS',
          toColumn: 'ID',
          confidence: 'explicit',
        },
      ];

      const joins = queryEngine.generateJoinsFromRelationships(
        'ORDERS',
        relationships,
        ['ORDER_ITEMS']
      );

      expect(joins).toHaveLength(1);
      expect(joins[0].table).toBe('ORDER_ITEMS');
    });

    it('should build JOIN clause with multiple joins', () => {
      const joins = [
        {
          type: 'INNER' as const,
          table: 'CUSTOMERS',
          on: {
            leftColumn: 'ORDERS.CUSTOMER_ID',
            rightColumn: 'CUSTOMERS.ID',
          },
        },
        {
          type: 'LEFT' as const,
          table: 'SHIPMENTS',
          on: {
            leftColumn: 'ORDERS.ID',
            rightColumn: 'SHIPMENTS.ORDER_ID',
          },
        },
      ];

      const joinClause = queryEngine.buildJoinClause(joins);

      expect(joinClause).toContain('INNER JOIN CUSTOMERS');
      expect(joinClause).toContain('ON ORDERS.CUSTOMER_ID = CUSTOMERS.ID');
      expect(joinClause).toContain('LEFT JOIN SHIPMENTS');
      expect(joinClause).toContain('ON ORDERS.ID = SHIPMENTS.ORDER_ID');
    });

    it('should handle table aliases in JOIN clause', () => {
      const joins = [
        {
          type: 'INNER' as const,
          table: 'CUSTOMERS',
          alias: 'c',
          on: {
            leftColumn: 'o.CUSTOMER_ID',
            rightColumn: 'c.ID',
          },
        },
      ];

      const joinClause = queryEngine.buildJoinClause(joins);

      expect(joinClause).toContain('CUSTOMERS c');
      expect(joinClause).toContain('ON o.CUSTOMER_ID = c.ID');
    });

    it('should return empty string for no joins', () => {
      const joinClause = queryEngine.buildJoinClause([]);
      expect(joinClause).toBe('');
    });
  });

  describe('Window Functions (Requirement 6.3)', () => {
    it('should build ROW_NUMBER with PARTITION BY and ORDER BY', () => {
      const windowFunc = {
        function: 'ROW_NUMBER' as const,
        alias: 'rank',
        partitionBy: ['YEAR'],
        orderBy: [{ column: 'SIMILARITY', direction: 'DESC' as const }],
      };

      const sql = queryEngine.buildWindowFunction(windowFunc);

      expect(sql).toContain('ROW_NUMBER()');
      expect(sql).toContain('PARTITION BY YEAR');
      expect(sql).toContain('ORDER BY SIMILARITY DESC');
      expect(sql).toContain('AS rank');
    });

    it('should build RANK without PARTITION BY', () => {
      const windowFunc = {
        function: 'RANK' as const,
        alias: 'overall_rank',
        orderBy: [{ column: 'SCORE', direction: 'DESC' as const }],
      };

      const sql = queryEngine.buildWindowFunction(windowFunc);

      expect(sql).toContain('RANK()');
      expect(sql).not.toContain('PARTITION BY');
      expect(sql).toContain('ORDER BY SCORE DESC');
    });

    it('should build window function with multiple partition columns', () => {
      const windowFunc = {
        function: 'DENSE_RANK' as const,
        alias: 'category_rank',
        partitionBy: ['CATEGORY', 'REGION'],
        orderBy: [
          { column: 'SALES', direction: 'DESC' as const },
          { column: 'DATE', direction: 'ASC' as const },
        ],
      };

      const sql = queryEngine.buildWindowFunction(windowFunc);

      expect(sql).toContain('PARTITION BY CATEGORY, REGION');
      expect(sql).toContain('ORDER BY SALES DESC, DATE ASC');
    });
  });

  describe('Aggregations (Requirement 6.2)', () => {
    it('should build aggregation expressions', () => {
      const aggregations = [
        { function: 'SUM' as const, column: 'AMOUNT', alias: 'TOTAL_AMOUNT' },
        { function: 'AVG' as const, column: 'SCORE', alias: 'AVG_SCORE' },
        { function: 'COUNT' as const, column: '*', alias: 'RECORD_COUNT' },
      ];

      const expressions = queryEngine.buildAggregations(aggregations);

      expect(expressions).toHaveLength(3);
      expect(expressions[0]).toBe('SUM(AMOUNT) AS TOTAL_AMOUNT');
      expect(expressions[1]).toBe('AVG(SCORE) AS AVG_SCORE');
      expect(expressions[2]).toBe('COUNT(*) AS RECORD_COUNT');
    });

    it('should handle MIN and MAX aggregations', () => {
      const aggregations = [
        { function: 'MIN' as const, column: 'PRICE', alias: 'MIN_PRICE' },
        { function: 'MAX' as const, column: 'PRICE', alias: 'MAX_PRICE' },
      ];

      const expressions = queryEngine.buildAggregations(aggregations);

      expect(expressions).toContain('MIN(PRICE) AS MIN_PRICE');
      expect(expressions).toContain('MAX(PRICE) AS MAX_PRICE');
    });

    it('should return empty array for no aggregations', () => {
      const expressions = queryEngine.buildAggregations([]);
      expect(expressions).toEqual([]);
    });
  });

  describe('Performance Grading (Requirement 6.5)', () => {
    it('should build CASE expression for performance grades', () => {
      const config = {
        metricColumn: 'ON_TIME_PERCENTAGE',
        gradeColumn: 'PERFORMANCE_GRADE',
        thresholds: {
          A: { min: 95 },
          B: { min: 85, max: 94.99 },
          C: { min: 75, max: 84.99 },
          D: { min: 60, max: 74.99 },
          F: { max: 59.99 },
        },
      };

      const sql = queryEngine.buildPerformanceGrading(config);

      expect(sql).toContain('CASE');
      expect(sql).toContain('WHEN ON_TIME_PERCENTAGE >= 95 THEN \'A\'');
      expect(sql).toContain('WHEN ON_TIME_PERCENTAGE >= 85 AND ON_TIME_PERCENTAGE <= 94.99 THEN \'B\'');
      expect(sql).toContain('ELSE \'F\'');
      expect(sql).toContain('AS PERFORMANCE_GRADE');
    });

    it('should handle min-only thresholds', () => {
      const config = {
        metricColumn: 'SCORE',
        gradeColumn: 'GRADE',
        thresholds: {
          A: { min: 90 },
          B: { min: 80 },
          C: { min: 70 },
          D: { min: 60 },
          F: {},
        },
      };

      const sql = queryEngine.buildPerformanceGrading(config);

      expect(sql).toContain('WHEN SCORE >= 90 THEN \'A\'');
      expect(sql).toContain('WHEN SCORE >= 80 THEN \'B\'');
    });
  });

  describe('Temporal Analysis (Requirement 6.4)', () => {
    it('should build temporal filter with date range', () => {
      const config = {
        dateColumn: 'CREATED_AT',
        rangeStart: new Date('2024-01-01'),
        rangeEnd: new Date('2024-12-31'),
      };

      const filter = queryEngine.buildTemporalFilter(config);

      expect(filter).toContain('CREATED_AT >= TO_DATE(\'2024-01-01\', \'YYYY-MM-DD\')');
      expect(filter).toContain('CREATED_AT <= TO_DATE(\'2024-12-31\', \'YYYY-MM-DD\')');
    });

    it('should build temporal filter with relative period', () => {
      const config = {
        dateColumn: 'ORDER_DATE',
        relativePeriod: '5 YEAR',
      };

      const filter = queryEngine.buildTemporalFilter(config);

      expect(filter).toContain('ORDER_DATE >= SYSDATE - INTERVAL \'5 YEAR\'');
    });

    it('should build temporal extractions for YEAR interval', () => {
      const config = {
        dateColumn: 'CREATED_AT',
        interval: 'YEAR' as const,
      };

      const extractions = queryEngine.buildTemporalExtractions(config);

      expect(extractions).toHaveLength(1);
      expect(extractions[0]).toBe('EXTRACT(YEAR FROM CREATED_AT) AS YEAR');
    });

    it('should build temporal extractions for MONTH interval', () => {
      const config = {
        dateColumn: 'CREATED_AT',
        interval: 'MONTH' as const,
      };

      const extractions = queryEngine.buildTemporalExtractions(config);

      expect(extractions).toHaveLength(2);
      expect(extractions[0]).toBe('EXTRACT(YEAR FROM CREATED_AT) AS YEAR');
      expect(extractions[1]).toBe('EXTRACT(MONTH FROM CREATED_AT) AS MONTH');
    });

    it('should build temporal extractions for DAY interval', () => {
      const config = {
        dateColumn: 'CREATED_AT',
        interval: 'DAY' as const,
      };

      const extractions = queryEngine.buildTemporalExtractions(config);

      expect(extractions).toHaveLength(1);
      expect(extractions[0]).toBe('TRUNC(CREATED_AT) AS DAY');
    });
  });

  describe('Enhanced Query Building (Requirements 6.1-6.5)', () => {
    it('should build query with JOINs and aggregations', () => {
      const config = {
        tableName: 'ORDERS',
        categories: [],
        visualizationGoals: [],
        joins: [
          {
            type: 'INNER' as const,
            table: 'CUSTOMERS',
            on: {
              leftColumn: 'ORDERS.CUSTOMER_ID',
              rightColumn: 'CUSTOMERS.ID',
            },
          },
        ],
        aggregations: [
          { function: 'COUNT' as const, column: '*', alias: 'ORDER_COUNT' },
          { function: 'SUM' as const, column: 'AMOUNT', alias: 'TOTAL_AMOUNT' },
        ],
        groupBy: ['CUSTOMERS.NAME'],
      };

      const sql = queryEngine.buildEnhancedQuery(config);

      expect(sql).toContain('SELECT CUSTOMERS.NAME, COUNT(*) AS ORDER_COUNT, SUM(AMOUNT) AS TOTAL_AMOUNT');
      expect(sql).toContain('FROM ORDERS');
      expect(sql).toContain('INNER JOIN CUSTOMERS ON ORDERS.CUSTOMER_ID = CUSTOMERS.ID');
      expect(sql).toContain('GROUP BY CUSTOMERS.NAME');
    });

    it('should build query with window functions for ranking', () => {
      const config = {
        tableName: 'PHOTOS',
        categories: [],
        visualizationGoals: [],
        windowFunctions: [
          {
            function: 'ROW_NUMBER' as const,
            alias: 'rank',
            partitionBy: ['YEAR'],
            orderBy: [{ column: 'SIMILARITY', direction: 'DESC' as const }],
          },
        ],
      };

      const sql = queryEngine.buildEnhancedQuery(config);

      expect(sql).toContain('ROW_NUMBER() OVER (PARTITION BY YEAR ORDER BY SIMILARITY DESC) AS rank');
    });

    it('should build query with temporal analysis and performance grading', () => {
      const config = {
        tableName: 'SUPPLIERS',
        categories: [],
        visualizationGoals: [],
        temporalAnalysis: {
          dateColumn: 'DELIVERY_DATE',
          relativePeriod: '1 YEAR',
        },
        performanceGrading: {
          metricColumn: 'ON_TIME_PERCENTAGE',
          gradeColumn: 'GRADE',
          thresholds: {
            A: { min: 95 },
            B: { min: 85, max: 94.99 },
            C: { min: 75, max: 84.99 },
            D: { min: 60, max: 74.99 },
            F: { max: 59.99 },
          },
        },
      };

      const sql = queryEngine.buildEnhancedQuery(config);

      expect(sql).toContain('CASE');
      expect(sql).toContain('WHEN ON_TIME_PERCENTAGE >= 95 THEN \'A\'');
      expect(sql).toContain('WHERE DELIVERY_DATE >= SYSDATE - INTERVAL \'1 YEAR\'');
    });

    it('should build complex multi-table query with all features', () => {
      const config = {
        tableName: 'ORDERS',
        categories: [],
        visualizationGoals: [],
        joins: [
          {
            type: 'INNER' as const,
            table: 'CUSTOMERS',
            on: {
              leftColumn: 'ORDERS.CUSTOMER_ID',
              rightColumn: 'CUSTOMERS.ID',
            },
          },
        ],
        aggregations: [
          { function: 'COUNT' as const, column: '*', alias: 'ORDER_COUNT' },
          { function: 'AVG' as const, column: 'AMOUNT', alias: 'AVG_AMOUNT' },
        ],
        groupBy: ['CUSTOMERS.REGION'],
        temporalAnalysis: {
          dateColumn: 'ORDERS.CREATED_AT',
          interval: 'YEAR' as const,
          relativePeriod: '5 YEAR',
        },
        orderBy: { column: 'ORDER_COUNT', direction: 'DESC' as const },
        limit: 10,
      };

      const sql = queryEngine.buildEnhancedQuery(config);

      expect(sql).toContain('SELECT CUSTOMERS.REGION');
      expect(sql).toContain('COUNT(*) AS ORDER_COUNT');
      expect(sql).toContain('AVG(AMOUNT) AS AVG_AMOUNT');
      expect(sql).toContain('EXTRACT(YEAR FROM ORDERS.CREATED_AT) AS YEAR');
      expect(sql).toContain('INNER JOIN CUSTOMERS');
      expect(sql).toContain('WHERE ORDERS.CREATED_AT >= SYSDATE - INTERVAL \'5 YEAR\'');
      expect(sql).toContain('GROUP BY CUSTOMERS.REGION');
      expect(sql).toContain('ORDER BY ORDER_COUNT DESC');
      expect(sql).toContain('FETCH FIRST 10 ROWS ONLY');
    });
  });

  describe('buildMainQuery integration', () => {
    it('should use enhanced query builder when advanced features are present', () => {
      const config = {
        tableName: 'ORDERS',
        categories: [],
        visualizationGoals: [],
        aggregations: [
          { function: 'COUNT' as const, column: '*', alias: 'TOTAL' },
        ],
        groupBy: ['STATUS'],
      };

      const sql = queryEngine.buildMainQuery(config);

      expect(sql).toContain('SELECT STATUS, COUNT(*) AS TOTAL');
      expect(sql).toContain('GROUP BY STATUS');
    });

    it('should use simple query builder for basic queries', () => {
      const config = {
        tableName: 'CUSTOMERS',
        categories: [],
        visualizationGoals: [],
        filters: [
          { column: 'STATUS', operator: 'eq' as const, value: 'ACTIVE' },
        ],
        limit: 100,
      };

      const sql = queryEngine.buildMainQuery(config);

      expect(sql).toContain('SELECT * FROM CUSTOMERS');
      expect(sql).toContain('WHERE STATUS = \'ACTIVE\'');
      expect(sql).toContain('FETCH FIRST 100 ROWS ONLY');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty relationships array', () => {
      const joins = queryEngine.generateJoinsFromRelationships('ORDERS', [], ['CUSTOMERS']);
      expect(joins).toEqual([]);
    });

    it('should handle missing table in relationships', () => {
      const relationships: Relationship[] = [
        {
          fromTable: 'ORDERS',
          fromColumn: 'PRODUCT_ID',
          toTable: 'PRODUCTS',
          toColumn: 'ID',
          confidence: 'explicit',
        },
      ];

      const joins = queryEngine.generateJoinsFromRelationships(
        'ORDERS',
        relationships,
        ['CUSTOMERS'] // Not in relationships
      );

      expect(joins).toEqual([]);
    });

    it('should handle query with only window functions', () => {
      const config = {
        tableName: 'SALES',
        categories: [],
        visualizationGoals: [],
        windowFunctions: [
          {
            function: 'RANK' as const,
            alias: 'sales_rank',
            orderBy: [{ column: 'AMOUNT', direction: 'DESC' as const }],
          },
        ],
      };

      const sql = queryEngine.buildEnhancedQuery(config);

      expect(sql).toContain('SELECT *, RANK() OVER (ORDER BY AMOUNT DESC) AS sales_rank');
    });
  });
});
