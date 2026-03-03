// __tests__/unit/result-presenter.test.ts
/**
 * Unit tests for ResultPresenter
 * Tests image embedding, metric formatting, and result organization
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { describe, it, expect } from 'vitest';
import { ResultPresenter } from '@/services/result-presenter';
import type { QueryResult } from '@/services/query-engine';

describe('ResultPresenter', () => {
  const presenter = new ResultPresenter();

  describe('formatResults - Basic Functionality', () => {
    it('should format results without images', () => {
      const queryResult: QueryResult = {
        success: true,
        data: [
          { id: 1, name: 'Item 1', value: 100 },
          { id: 2, name: 'Item 2', value: 200 },
        ],
        columns: ['id', 'name', 'value'],
        rowCount: 2,
        executionTimeMs: 50,
        sql: 'SELECT * FROM items',
      };

      const result = presenter.formatResults(queryResult);

      expect(result.type).toBe('table');
      expect(result.data).toHaveLength(2);
      expect(result.metadata.hasImages).toBe(false);
      expect(result.metadata.totalRows).toBe(2);
    });

    it('should format similarity scores to percentage (Requirement 8.2)', () => {
      const queryResult: QueryResult = {
        success: true,
        data: [
          { id: 1, similarity: 0.95 },
          { id: 2, similarity: 0.75 },
        ],
        columns: ['id', 'similarity'],
        rowCount: 2,
        executionTimeMs: 50,
        sql: 'SELECT * FROM results',
      };

      const result = presenter.formatResults(queryResult, {
        similarityColumn: 'similarity',
      });

      expect(result.data[0].similarityScore).toBe(95);
      expect(result.data[1].similarityScore).toBe(75);
      expect(result.metadata.hasSimilarityScores).toBe(true);
    });

    it('should format view counts (Requirement 8.2)', () => {
      const queryResult: QueryResult = {
        success: true,
        data: [
          { id: 1, views: 1234 },
          { id: 2, views: '5678' },
        ],
        columns: ['id', 'views'],
        rowCount: 2,
        executionTimeMs: 50,
        sql: 'SELECT * FROM photos',
      };

      const result = presenter.formatResults(queryResult, {
        viewCountColumn: 'views',
      });

      expect(result.data[0].viewCount).toBe(1234);
      expect(result.data[1].viewCount).toBe(5678);
      expect(result.metadata.hasViewCounts).toBe(true);
    });

    it('should format distances with units (Requirement 8.2)', () => {
      const queryResult: QueryResult = {
        success: true,
        data: [
          { id: 1, distance: 12.5 },
          { id: 2, distance: '25.75' },
        ],
        columns: ['id', 'distance'],
        rowCount: 2,
        executionTimeMs: 50,
        sql: 'SELECT * FROM locations',
      };

      const result = presenter.formatResults(queryResult, {
        distanceColumn: 'distance',
        distanceUnit: 'miles',
      });

      expect(result.data[0].distance).toEqual({ value: 12.5, unit: 'miles' });
      expect(result.data[1].distance).toEqual({ value: 25.75, unit: 'miles' });
      expect(result.metadata.hasDistances).toBe(true);
    });
  });

  describe('Image Handling (Requirement 8.1)', () => {
    it('should detect base64 encoded images', () => {
      const queryResult: QueryResult = {
        success: true,
        data: [
          {
            id: 1,
            image: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
          },
        ],
        columns: ['id', 'image'],
        rowCount: 1,
        executionTimeMs: 50,
        sql: 'SELECT * FROM photos',
      };

      const result = presenter.formatResults(queryResult, {
        imageColumns: ['image'],
      });

      expect(result.type).toBe('gallery');
      expect(result.data[0].image).toBeDefined();
      expect(result.data[0].image?.data).toContain('data:image/jpeg');
      expect(result.metadata.hasImages).toBe(true);
    });

    it('should detect image URLs', () => {
      const queryResult: QueryResult = {
        success: true,
        data: [
          {
            id: 1,
            image: 'https://example.com/photo.jpg',
          },
        ],
        columns: ['id', 'image'],
        rowCount: 1,
        executionTimeMs: 50,
        sql: 'SELECT * FROM photos',
      };

      const result = presenter.formatResults(queryResult, {
        imageColumns: ['image'],
      });

      expect(result.type).toBe('gallery');
      expect(result.data[0].image).toBeDefined();
      expect(result.data[0].image?.data).toBe('https://example.com/photo.jpg');
      expect(result.metadata.hasImages).toBe(true);
    });

    it('should handle missing image data gracefully', () => {
      const queryResult: QueryResult = {
        success: true,
        data: [
          { id: 1, image: null },
          { id: 2, image: '' },
        ],
        columns: ['id', 'image'],
        rowCount: 2,
        executionTimeMs: 50,
        sql: 'SELECT * FROM photos',
      };

      const result = presenter.formatResults(queryResult, {
        imageColumns: ['image'],
      });

      expect(result.data[0].image).toBeUndefined();
      expect(result.data[1].image).toBeUndefined();
    });
  });

  describe('Grouping (Requirement 8.3)', () => {
    it('should organize results by grouping criteria', () => {
      const queryResult: QueryResult = {
        success: true,
        data: [
          { id: 1, year: '2020', name: 'Photo 1' },
          { id: 2, year: '2020', name: 'Photo 2' },
          { id: 3, year: '2021', name: 'Photo 3' },
          { id: 4, year: '2021', name: 'Photo 4' },
        ],
        columns: ['id', 'year', 'name'],
        rowCount: 4,
        executionTimeMs: 50,
        sql: 'SELECT * FROM photos',
      };

      const result = presenter.formatResults(queryResult, {
        groupByColumn: 'year',
      });

      expect(result.type).toBe('grouped_gallery');
      expect(result.grouping).toBeDefined();
      expect(result.grouping?.key).toBe('year');
      expect(result.grouping?.groups.size).toBe(2);
      expect(result.grouping?.groups.get('2020')).toHaveLength(2);
      expect(result.grouping?.groups.get('2021')).toHaveLength(2);
    });

    it('should handle empty groups', () => {
      const queryResult: QueryResult = {
        success: true,
        data: [],
        columns: ['id', 'year', 'name'],
        rowCount: 0,
        executionTimeMs: 50,
        sql: 'SELECT * FROM photos',
      };

      const result = presenter.formatResults(queryResult, {
        groupByColumn: 'year',
      });

      expect(result.type).toBe('grouped_gallery');
      expect(result.grouping?.groups.size).toBe(0);
    });
  });

  describe('HTML Generation (Requirement 8.5)', () => {
    it('should generate gallery HTML with grid layout', () => {
      const queryResult: QueryResult = {
        success: true,
        data: [
          {
            id: 1,
            image: 'https://example.com/photo1.jpg',
            similarity: 0.95,
            views: 1000,
          },
        ],
        columns: ['id', 'image', 'similarity', 'views'],
        rowCount: 1,
        executionTimeMs: 50,
        sql: 'SELECT * FROM photos',
      };

      const formattedResult = presenter.formatResults(queryResult, {
        imageColumns: ['image'],
        similarityColumn: 'similarity',
        viewCountColumn: 'views',
      });

      const html = presenter.generateHTML(formattedResult, 'grid');

      expect(html).toContain('gallery');
      expect(html).toContain('grid');
      expect(html).toContain('https://example.com/photo1.jpg');
      expect(html).toContain('Similarity');
      expect(html).toContain('95');
      expect(html).toContain('Views');
      expect(html).toContain('1,000');
    });

    it('should generate gallery HTML with list layout', () => {
      const queryResult: QueryResult = {
        success: true,
        data: [
          {
            id: 1,
            image: 'https://example.com/photo1.jpg',
          },
        ],
        columns: ['id', 'image'],
        rowCount: 1,
        executionTimeMs: 50,
        sql: 'SELECT * FROM photos',
      };

      const formattedResult = presenter.formatResults(queryResult, {
        imageColumns: ['image'],
      });

      const html = presenter.generateHTML(formattedResult, 'list');

      expect(html).toContain('gallery');
      expect(html).toContain('flex-direction: column');
      expect(html).toContain('https://example.com/photo1.jpg');
    });

    it('should generate table HTML for non-image results', () => {
      const queryResult: QueryResult = {
        success: true,
        data: [
          { id: 1, name: 'Item 1', value: 100 },
          { id: 2, name: 'Item 2', value: 200 },
        ],
        columns: ['id', 'name', 'value'],
        rowCount: 2,
        executionTimeMs: 50,
        sql: 'SELECT * FROM items',
      };

      const formattedResult = presenter.formatResults(queryResult);
      const html = presenter.generateHTML(formattedResult);

      expect(html).toContain('<table');
      expect(html).toContain('<th');
      expect(html).toContain('Item 1');
      expect(html).toContain('Item 2');
    });

    it('should generate grouped gallery HTML', () => {
      const queryResult: QueryResult = {
        success: true,
        data: [
          { id: 1, year: '2020', image: 'https://example.com/photo1.jpg' },
          { id: 2, year: '2021', image: 'https://example.com/photo2.jpg' },
        ],
        columns: ['id', 'year', 'image'],
        rowCount: 2,
        executionTimeMs: 50,
        sql: 'SELECT * FROM photos',
      };

      const formattedResult = presenter.formatResults(queryResult, {
        imageColumns: ['image'],
        groupByColumn: 'year',
      });

      const html = presenter.generateHTML(formattedResult);

      expect(html).toContain('grouped-gallery');
      expect(html).toContain('group-section');
      expect(html).toContain('2020');
      expect(html).toContain('2021');
    });
  });

  describe('Multi-Modal Results (Requirements 8.1, 8.2, 8.3)', () => {
    it('should format complete multi-modal result with all metrics', () => {
      const queryResult: QueryResult = {
        success: true,
        data: [
          {
            id: 1,
            year: '2020',
            image: 'https://example.com/photo1.jpg',
            similarity: 0.95,
            views: 1234,
            distance: 12.5,
          },
          {
            id: 2,
            year: '2020',
            image: 'https://example.com/photo2.jpg',
            similarity: 0.85,
            views: 5678,
            distance: 25.3,
          },
        ],
        columns: ['id', 'year', 'image', 'similarity', 'views', 'distance'],
        rowCount: 2,
        executionTimeMs: 50,
        sql: 'SELECT * FROM photos',
      };

      const result = presenter.formatResults(queryResult, {
        imageColumns: ['image'],
        similarityColumn: 'similarity',
        viewCountColumn: 'views',
        distanceColumn: 'distance',
        distanceUnit: 'miles',
        groupByColumn: 'year',
      });

      expect(result.type).toBe('grouped_gallery');
      expect(result.metadata.hasImages).toBe(true);
      expect(result.metadata.hasSimilarityScores).toBe(true);
      expect(result.metadata.hasViewCounts).toBe(true);
      expect(result.metadata.hasDistances).toBe(true);

      const firstRow = result.data[0];
      expect(firstRow.image).toBeDefined();
      expect(firstRow.similarityScore).toBe(95);
      expect(firstRow.viewCount).toBe(1234);
      expect(firstRow.distance).toEqual({ value: 12.5, unit: 'miles' });
      expect(firstRow.groupKey).toBe('2020');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty result set', () => {
      const queryResult: QueryResult = {
        success: true,
        data: [],
        columns: [],
        rowCount: 0,
        executionTimeMs: 50,
        sql: 'SELECT * FROM photos',
      };

      const result = presenter.formatResults(queryResult);

      expect(result.data).toHaveLength(0);
      expect(result.metadata.totalRows).toBe(0);
    });

    it('should handle invalid similarity scores', () => {
      const queryResult: QueryResult = {
        success: true,
        data: [
          { id: 1, similarity: 'invalid' },
          { id: 2, similarity: null },
        ],
        columns: ['id', 'similarity'],
        rowCount: 2,
        executionTimeMs: 50,
        sql: 'SELECT * FROM results',
      };

      const result = presenter.formatResults(queryResult, {
        similarityColumn: 'similarity',
      });

      expect(result.data[0].similarityScore).toBe(0);
      expect(result.data[1].similarityScore).toBe(0);
    });

    it('should handle invalid view counts', () => {
      const queryResult: QueryResult = {
        success: true,
        data: [
          { id: 1, views: 'invalid' },
          { id: 2, views: null },
        ],
        columns: ['id', 'views'],
        rowCount: 2,
        executionTimeMs: 50,
        sql: 'SELECT * FROM photos',
      };

      const result = presenter.formatResults(queryResult, {
        viewCountColumn: 'views',
      });

      expect(result.data[0].viewCount).toBe(0);
      expect(result.data[1].viewCount).toBe(0);
    });
  });
});
