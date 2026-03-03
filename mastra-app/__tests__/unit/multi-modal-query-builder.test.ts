/**
 * Unit tests for MultiModalQueryBuilder service.
 * Tests Requirements 2.2, 2.6, 3.1, 3.2, 3.3, 3.4, 6.3.
 */

import { describe, it, expect } from 'vitest';
import {
  MultiModalQueryBuilder,
  MultiModalQueryConfig,
  VectorEmbedding,
  GeospatialFilter,
  TemporalFilter,
  QualityFilter,
  RankingConfig,
} from '../../src/services/multi-modal-query-builder';

describe('MultiModalQueryBuilder', () => {
  const builder = new MultiModalQueryBuilder();

  describe('buildQuery - basic functionality', () => {
    it('should build a simple query with table name only', () => {
      const config: MultiModalQueryConfig = {
        tableName: 'photos',
      };

      const sql = builder.buildQuery(config);

      expect(sql).toContain('SELECT *');
      expect(sql).toContain('FROM photos');
    });

    it('should build query with limit', () => {
      const config: MultiModalQueryConfig = {
        tableName: 'photos',
        limit: 10,
      };

      const sql = builder.buildQuery(config);

      expect(sql).toContain('FETCH FIRST 10 ROWS ONLY');
    });
  });

  describe('buildQuery - vector similarity search (Requirement 2.2)', () => {
    it('should include VECTOR_DISTANCE in SELECT clause', () => {
      const embedding: VectorEmbedding = {
        dimensions: 3,
        values: [0.1, 0.2, 0.3],
      };

      const config: MultiModalQueryConfig = {
        tableName: 'photos',
        vectorColumn: 'embedding_vector',
        queryEmbedding: embedding,
        distanceMetric: 'COSINE',
      };

      const sql = builder.buildQuery(config);

      expect(sql).toContain('VECTOR_DISTANCE');
      expect(sql).toContain('embedding_vector');
      expect(sql).toContain('COSINE');
      expect(sql).toContain('similarity_score');
    });

    it('should order by similarity score ascending', () => {
      const embedding: VectorEmbedding = {
        dimensions: 2,
        values: [1.0, 2.0],
      };

      const config: MultiModalQueryConfig = {
        tableName: 'photos',
        vectorColumn: 'embedding_vector',
        queryEmbedding: embedding,
      };

      const sql = builder.buildQuery(config);

      expect(sql).toContain('ORDER BY similarity_score ASC');
    });

    it('should support different distance metrics', () => {
      const embedding: VectorEmbedding = {
        dimensions: 2,
        values: [1.0, 2.0],
      };

      const metrics: Array<'COSINE' | 'EUCLIDEAN' | 'DOT'> = ['COSINE', 'EUCLIDEAN', 'DOT'];

      metrics.forEach(metric => {
        const config: MultiModalQueryConfig = {
          tableName: 'photos',
          vectorColumn: 'embedding_vector',
          queryEmbedding: embedding,
          distanceMetric: metric,
        };

        const sql = builder.buildQuery(config);
        expect(sql).toContain(metric);
      });
    });
  });

  describe('buildQuery - geospatial filtering (Requirements 3.2, 3.3)', () => {
    it('should include SDO_WITHIN_DISTANCE predicate', () => {
      const filter: GeospatialFilter = {
        type: 'distance',
        latitude: 28.6139,
        longitude: 77.2090,
        radius: 20,
        unit: 'miles',
      };

      const config: MultiModalQueryConfig = {
        tableName: 'photos',
        geospatialFilter: filter,
      };

      const sql = builder.buildQuery(config);

      expect(sql).toContain('SDO_WITHIN_DISTANCE');
      expect(sql).toContain('SDO_GEOMETRY');
      expect(sql).toContain('distance=');
    });

    it('should include distance calculation in SELECT', () => {
      const filter: GeospatialFilter = {
        type: 'distance',
        latitude: 28.6139,
        longitude: 77.2090,
        radius: 20,
        unit: 'miles',
      };

      const config: MultiModalQueryConfig = {
        tableName: 'photos',
        geospatialFilter: filter,
      };

      const sql = builder.buildQuery(config);

      expect(sql).toContain('distance_miles');
    });

    it('should handle kilometers unit', () => {
      const filter: GeospatialFilter = {
        type: 'distance',
        latitude: 28.6139,
        longitude: 77.2090,
        radius: 30,
        unit: 'km',
      };

      const config: MultiModalQueryConfig = {
        tableName: 'photos',
        geospatialFilter: filter,
      };

      const sql = builder.buildQuery(config);

      expect(sql).toContain('distance_km');
    });
  });

  describe('buildQuery - temporal filtering', () => {
    it('should include date comparison with INTERVAL', () => {
      const filter: TemporalFilter = {
        column: 'taken_at',
        operator: 'gte',
        value: new Date('2020-01-01'),
        intervalYears: 5,
      };

      const config: MultiModalQueryConfig = {
        tableName: 'photos',
        temporalFilter: filter,
      };

      const sql = builder.buildQuery(config);

      expect(sql).toContain('taken_at');
      expect(sql).toContain('SYSDATE');
      expect(sql).toContain("INTERVAL '5' YEAR");
    });

    it('should handle BETWEEN operator', () => {
      const filter: TemporalFilter = {
        column: 'created_at',
        operator: 'between',
        value: {
          start: new Date('2020-01-01'),
          end: new Date('2023-12-31'),
        },
      };

      const config: MultiModalQueryConfig = {
        tableName: 'photos',
        temporalFilter: filter,
      };

      const sql = builder.buildQuery(config);

      expect(sql).toContain('created_at');
      expect(sql).toContain('BETWEEN');
      expect(sql).toContain('2020-01-01');
      expect(sql).toContain('2023-12-31');
    });
  });

  describe('buildQuery - quality filtering', () => {
    it('should include quality filter conditions', () => {
      const filters: QualityFilter[] = [
        { column: 'views', operator: 'gte', value: 100 },
        { column: 'rating', operator: 'gt', value: 4.0 },
      ];

      const config: MultiModalQueryConfig = {
        tableName: 'photos',
        qualityFilters: filters,
      };

      const sql = builder.buildQuery(config);

      expect(sql).toContain('views >= 100');
      expect(sql).toContain('rating > 4');
    });

    it('should support all comparison operators', () => {
      const operators: Array<QualityFilter['operator']> = ['gt', 'gte', 'lt', 'lte', 'eq'];

      operators.forEach(op => {
        const filter: QualityFilter = {
          column: 'score',
          operator: op,
          value: 50,
        };

        const config: MultiModalQueryConfig = {
          tableName: 'photos',
          qualityFilters: [filter],
        };

        const sql = builder.buildQuery(config);
        expect(sql).toContain('score');
        expect(sql).toContain('50');
      });
    });
  });

  describe('buildQuery - ranking with window functions (Requirement 6.3)', () => {
    it('should include ROW_NUMBER() with PARTITION BY', () => {
      const ranking: RankingConfig = {
        partitionBy: ['EXTRACT(YEAR FROM taken_at)'],
        orderBy: { column: 'similarity_score', direction: 'ASC' },
        limit: 5,
      };

      const config: MultiModalQueryConfig = {
        tableName: 'photos',
        ranking,
      };

      const sql = builder.buildQuery(config);

      expect(sql).toContain('ROW_NUMBER()');
      expect(sql).toContain('PARTITION BY');
      expect(sql).toContain('EXTRACT(YEAR FROM taken_at)');
      expect(sql).toContain('ORDER BY similarity_score ASC');
      expect(sql).toContain('row_num <= 5');
    });

    it('should support multiple partition columns', () => {
      const ranking: RankingConfig = {
        partitionBy: ['year', 'category'],
        orderBy: { column: 'views', direction: 'DESC' },
        limit: 3,
      };

      const config: MultiModalQueryConfig = {
        tableName: 'photos',
        ranking,
      };

      const sql = builder.buildQuery(config);

      expect(sql).toContain('PARTITION BY year, category');
      expect(sql).toContain('row_num <= 3');
    });
  });

  describe('buildQuery - combined multi-modal query (Requirement 2.6)', () => {
    it('should combine vector + geospatial + temporal + quality filters', () => {
      const embedding: VectorEmbedding = {
        dimensions: 512,
        values: Array(512).fill(0.1),
      };

      const geospatialFilter: GeospatialFilter = {
        type: 'distance',
        latitude: 28.6139,
        longitude: 77.2090,
        radius: 20,
        unit: 'miles',
      };

      const temporalFilter: TemporalFilter = {
        column: 'taken_at',
        operator: 'gte',
        value: new Date(),
        intervalYears: 5,
      };

      const qualityFilters: QualityFilter[] = [
        { column: 'views', operator: 'gte', value: 100 },
      ];

      const ranking: RankingConfig = {
        partitionBy: ['EXTRACT(YEAR FROM taken_at)'],
        orderBy: { column: 'similarity_score', direction: 'ASC' },
        limit: 5,
      };

      const config: MultiModalQueryConfig = {
        tableName: 'photos',
        vectorColumn: 'embedding_vector',
        queryEmbedding: embedding,
        distanceMetric: 'COSINE',
        geospatialFilter,
        temporalFilter,
        qualityFilters,
        ranking,
      };

      const sql = builder.buildQuery(config);

      // Verify all components are present
      expect(sql).toContain('VECTOR_DISTANCE');
      expect(sql).toContain('SDO_WITHIN_DISTANCE');
      expect(sql).toContain('taken_at');
      expect(sql).toContain('views >= 100');
      expect(sql).toContain('ROW_NUMBER()');
      expect(sql).toContain('PARTITION BY');
    });
  });

  describe('buildSDOGeometryPoint (Requirement 3.2)', () => {
    it('should generate valid SDO_GEOMETRY point literal', () => {
      const point = builder.buildSDOGeometryPoint(28.6139, 77.2090);

      expect(point).toContain('SDO_GEOMETRY');
      expect(point).toContain('2001'); // Point type
      expect(point).toContain('4326'); // WGS84 SRID
      expect(point).toContain('SDO_POINT_TYPE');
      expect(point).toContain('77.209'); // Longitude first
      expect(point).toContain('28.6139'); // Latitude second
    });
  });

  describe('distance unit conversion (Requirement 3.4)', () => {
    it('should convert miles to meters correctly', () => {
      const meters = builder.milesToMeters(1);
      expect(meters).toBeCloseTo(1609.34, 2);
    });

    it('should convert kilometers to meters correctly', () => {
      const meters = builder.kmToMeters(1);
      expect(meters).toBe(1000);
    });

    it('should convert meters to miles correctly', () => {
      const miles = builder.metersToMiles(1609.34);
      expect(miles).toBeCloseTo(1, 2);
    });

    it('should convert meters to kilometers correctly', () => {
      const km = builder.metersToKm(1000);
      expect(km).toBe(1);
    });

    it('should round-trip miles conversion', () => {
      const originalMiles = 20;
      const meters = builder.milesToMeters(originalMiles);
      const backToMiles = builder.metersToMiles(meters);
      expect(backToMiles).toBeCloseTo(originalMiles, 2);
    });

    it('should round-trip kilometers conversion', () => {
      const originalKm = 30;
      const meters = builder.kmToMeters(originalKm);
      const backToKm = builder.metersToKm(meters);
      expect(backToKm).toBeCloseTo(originalKm, 2);
    });
  });

  describe('geocodeLocation (Requirement 3.1)', () => {
    it('should geocode known location names', async () => {
      const coords = await builder.geocodeLocation('Delhi');
      expect(coords.latitude).toBeCloseTo(28.6139, 2);
      expect(coords.longitude).toBeCloseTo(77.2090, 2);
    });

    it('should be case-insensitive', async () => {
      const coords1 = await builder.geocodeLocation('delhi');
      const coords2 = await builder.geocodeLocation('DELHI');
      const coords3 = await builder.geocodeLocation('Delhi');

      expect(coords1).toEqual(coords2);
      expect(coords2).toEqual(coords3);
    });

    it('should handle location names with spaces', async () => {
      const coords = await builder.geocodeLocation('New York');
      expect(coords.latitude).toBeCloseTo(40.7128, 2);
      expect(coords.longitude).toBeCloseTo(-74.0060, 2);
    });

    it('should throw error for unknown locations', async () => {
      await expect(builder.geocodeLocation('UnknownCity123')).rejects.toThrow(
        'Location "UnknownCity123" not found'
      );
    });
  });

  describe('validateCoordinates', () => {
    it('should validate correct coordinates', () => {
      expect(builder.validateCoordinates(28.6139, 77.2090)).toBe(true);
      expect(builder.validateCoordinates(0, 0)).toBe(true);
      expect(builder.validateCoordinates(-90, -180)).toBe(true);
      expect(builder.validateCoordinates(90, 180)).toBe(true);
    });

    it('should reject invalid latitude', () => {
      expect(builder.validateCoordinates(91, 0)).toBe(false);
      expect(builder.validateCoordinates(-91, 0)).toBe(false);
    });

    it('should reject invalid longitude', () => {
      expect(builder.validateCoordinates(0, 181)).toBe(false);
      expect(builder.validateCoordinates(0, -181)).toBe(false);
    });
  });

  describe('calculateHaversineDistance (Requirement 3.4)', () => {
    it('should calculate distance between two points', () => {
      // Delhi to Mumbai
      const distance = builder.calculateHaversineDistance(
        28.6139, 77.2090, // Delhi
        19.0760, 72.8777  // Mumbai
      );

      // Approximate distance is ~1150 km
      expect(distance).toBeGreaterThan(1100);
      expect(distance).toBeLessThan(1200);
    });

    it('should return 0 for same point', () => {
      const distance = builder.calculateHaversineDistance(
        28.6139, 77.2090,
        28.6139, 77.2090
      );

      expect(distance).toBeCloseTo(0, 1);
    });

    it('should handle negative coordinates', () => {
      // New York to London
      const distance = builder.calculateHaversineDistance(
        40.7128, -74.0060, // New York
        51.5074, -0.1278   // London
      );

      // Approximate distance is ~5570 km
      expect(distance).toBeGreaterThan(5500);
      expect(distance).toBeLessThan(5600);
    });
  });

  describe('buildGeospatialQuery', () => {
    it('should build standalone geospatial query', () => {
      const filter: GeospatialFilter = {
        type: 'distance',
        latitude: 28.6139,
        longitude: 77.2090,
        radius: 20,
        unit: 'miles',
      };

      const sql = builder.buildGeospatialQuery('photos', 'location', filter);

      expect(sql).toContain('SELECT *');
      expect(sql).toContain('FROM photos');
      expect(sql).toContain('SDO_WITHIN_DISTANCE');
      expect(sql).toContain('distance_miles');
      expect(sql).toContain('ORDER BY distance_miles ASC');
    });

    it('should include additional columns', () => {
      const filter: GeospatialFilter = {
        type: 'distance',
        latitude: 28.6139,
        longitude: 77.2090,
        radius: 20,
        unit: 'miles',
      };

      const sql = builder.buildGeospatialQuery(
        'photos',
        'location',
        filter,
        ['photo_id', 'title']
      );

      expect(sql).toContain('photo_id');
      expect(sql).toContain('title');
    });
  });

  describe('error handling', () => {
    it('should throw error for geospatial filter without coordinates', () => {
      const filter: GeospatialFilter = {
        type: 'distance',
        radius: 20,
        unit: 'miles',
      };

      const config: MultiModalQueryConfig = {
        tableName: 'photos',
        geospatialFilter: filter,
      };

      expect(() => builder.buildQuery(config)).toThrow(
        'Latitude and longitude are required'
      );
    });
  });
});
