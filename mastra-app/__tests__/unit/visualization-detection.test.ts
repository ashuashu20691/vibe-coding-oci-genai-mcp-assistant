/**
 * Unit Tests: Visualization Type Auto-Detection
 * 
 * Tests for Task 7.1: Improve visualization type auto-detection
 * - Detect geographic data (lat/lon) for map visualization
 * - Detect time series for line charts
 * - Detect categorical data for bar charts
 * 
 * **Validates: Requirements 5.1, 5.3**
 */

import { describe, it, expect } from 'vitest';
import {
  detectOutputType,
  hasGeographicColumns,
  hasTimeSeriesData,
  hasCategoricalData,
  getNumericColumns,
} from '@/components/OutputRenderer';

describe('Task 7.1: Visualization Type Auto-Detection', () => {
  describe('Geographic Data Detection (lat/lon → map)', () => {
    it('should detect standard lat/lon columns', () => {
      const columns = ['id', 'lat', 'lon', 'name'];
      expect(hasGeographicColumns(columns)).toBe(true);
    });

    it('should detect latitude/longitude columns', () => {
      const columns = ['id', 'latitude', 'longitude', 'name'];
      expect(hasGeographicColumns(columns)).toBe(true);
    });

    it('should detect lng variant', () => {
      const columns = ['id', 'lat', 'lng', 'name'];
      expect(hasGeographicColumns(columns)).toBe(true);
    });

    it('should detect case-insensitive columns', () => {
      const columns = ['ID', 'LAT', 'LON', 'NAME'];
      expect(hasGeographicColumns(columns)).toBe(true);
    });

    it('should detect geo_lat/geo_lng columns', () => {
      const columns = ['id', 'geo_lat', 'geo_lng', 'name'];
      expect(hasGeographicColumns(columns)).toBe(true);
    });

    it('should return false without both lat and lon', () => {
      const columns = ['id', 'lat', 'name'];
      expect(hasGeographicColumns(columns)).toBe(false);
    });

    it('should suggest map as first type for geographic data', () => {
      const data = [
        { id: 1, lat: 37.7749, lon: -122.4194, name: 'San Francisco' },
        { id: 2, lat: 34.0522, lon: -118.2437, name: 'Los Angeles' },
      ];
      const suggestions = detectOutputType(data);
      expect(suggestions[0]).toBe('map');
    });
  });

  describe('Time Series Detection (date/time → line_chart)', () => {
    it('should detect date column by name', () => {
      const columns = ['date', 'value'];
      const numericColumns = ['value'];
      const data = [
        { date: '2024-01-01', value: 100 },
        { date: '2024-01-02', value: 150 },
      ];
      expect(hasTimeSeriesData(columns, numericColumns, data)).toBe(true);
    });

    it('should detect timestamp column by name', () => {
      const columns = ['timestamp', 'count'];
      const numericColumns = ['count'];
      const data = [
        { timestamp: '2024-01-01T10:00:00', count: 50 },
        { timestamp: '2024-01-01T11:00:00', count: 75 },
      ];
      expect(hasTimeSeriesData(columns, numericColumns, data)).toBe(true);
    });

    it('should detect created_at column by name', () => {
      const columns = ['created_at', 'amount'];
      const numericColumns = ['amount'];
      const data = [
        { created_at: '2024-01-01', amount: 200 },
        { created_at: '2024-01-02', amount: 250 },
      ];
      expect(hasTimeSeriesData(columns, numericColumns, data)).toBe(true);
    });

    it('should detect date values in YYYY-MM-DD format', () => {
      const columns = ['period', 'sales'];
      const numericColumns = ['sales'];
      const data = [
        { period: '2024-01-01', sales: 1000 },
        { period: '2024-01-02', sales: 1200 },
      ];
      expect(hasTimeSeriesData(columns, numericColumns, data)).toBe(true);
    });

    it('should detect ISO date format', () => {
      const columns = ['event_time', 'count'];
      const numericColumns = ['count'];
      const data = [
        { event_time: '2024-01-01T10:30:00Z', count: 10 },
        { event_time: '2024-01-01T11:30:00Z', count: 15 },
      ];
      expect(hasTimeSeriesData(columns, numericColumns, data)).toBe(true);
    });

    it('should return false without numeric columns', () => {
      const columns = ['date', 'name'];
      const numericColumns: string[] = [];
      const data = [
        { date: '2024-01-01', name: 'A' },
        { date: '2024-01-02', name: 'B' },
      ];
      expect(hasTimeSeriesData(columns, numericColumns, data)).toBe(false);
    });

    it('should return false with single data point', () => {
      const columns = ['date', 'value'];
      const numericColumns = ['value'];
      const data = [{ date: '2024-01-01', value: 100 }];
      expect(hasTimeSeriesData(columns, numericColumns, data)).toBe(false);
    });

    it('should suggest line_chart as first type for time series data', () => {
      const data = [
        { date: '2024-01-01', value: 100 },
        { date: '2024-01-02', value: 150 },
        { date: '2024-01-03', value: 200 },
      ];
      const suggestions = detectOutputType(data);
      expect(suggestions[0]).toBe('line_chart');
    });
  });

  describe('Categorical Data Detection (categories → bar_chart)', () => {
    it('should detect category column by name', () => {
      const columns = ['category', 'count'];
      const numericColumns = ['count'];
      const data = [
        { category: 'A', count: 10 },
        { category: 'B', count: 20 },
      ];
      expect(hasCategoricalData(columns, numericColumns, data)).toBe(true);
    });

    it('should detect type column by name', () => {
      const columns = ['type', 'amount'];
      const numericColumns = ['amount'];
      const data = [
        { type: 'Sales', amount: 1000 },
        { type: 'Returns', amount: 200 },
      ];
      expect(hasCategoricalData(columns, numericColumns, data)).toBe(true);
    });

    it('should detect status column by name', () => {
      const columns = ['status', 'count'];
      const numericColumns = ['count'];
      const data = [
        { status: 'Active', count: 50 },
        { status: 'Inactive', count: 30 },
      ];
      expect(hasCategoricalData(columns, numericColumns, data)).toBe(true);
    });

    it('should detect region column by name', () => {
      const columns = ['region', 'sales'];
      const numericColumns = ['sales'];
      const data = [
        { region: 'North', sales: 5000 },
        { region: 'South', sales: 3000 },
      ];
      expect(hasCategoricalData(columns, numericColumns, data)).toBe(true);
    });

    it('should detect categorical data by unique value ratio', () => {
      const columns = ['product_name', 'quantity'];
      const numericColumns = ['quantity'];
      const data = [
        { product_name: 'Widget A', quantity: 100 },
        { product_name: 'Widget A', quantity: 150 },
        { product_name: 'Widget B', quantity: 200 },
        { product_name: 'Widget B', quantity: 180 },
        { product_name: 'Widget C', quantity: 120 },
      ];
      // 3 unique values out of 5 rows = 60% < 80% threshold
      expect(hasCategoricalData(columns, numericColumns, data)).toBe(true);
    });

    it('should return false without numeric columns', () => {
      const columns = ['category', 'name'];
      const numericColumns: string[] = [];
      const data = [
        { category: 'A', name: 'Item 1' },
        { category: 'B', name: 'Item 2' },
      ];
      expect(hasCategoricalData(columns, numericColumns, data)).toBe(false);
    });

    it('should suggest bar_chart as first type for categorical data', () => {
      const data = [
        { category: 'Electronics', sales: 5000 },
        { category: 'Clothing', sales: 3000 },
        { category: 'Food', sales: 4000 },
      ];
      const suggestions = detectOutputType(data);
      expect(suggestions[0]).toBe('bar_chart');
    });
  });

  describe('getNumericColumns helper', () => {
    it('should identify numeric columns', () => {
      const data = [
        { name: 'A', value: 100, count: 5 },
        { name: 'B', value: 200, count: 10 },
      ];
      const numericCols = getNumericColumns(data);
      expect(numericCols).toContain('value');
      expect(numericCols).toContain('count');
      expect(numericCols).not.toContain('name');
    });

    it('should handle string numbers', () => {
      const data = [
        { name: 'A', value: '100' },
        { name: 'B', value: '200' },
      ];
      const numericCols = getNumericColumns(data);
      expect(numericCols).toContain('value');
    });

    it('should return empty array for empty data', () => {
      const numericCols = getNumericColumns([]);
      expect(numericCols).toEqual([]);
    });
  });

  describe('Detection Priority', () => {
    it('should prioritize map over other types for geographic data', () => {
      const data = [
        { category: 'Store A', lat: 37.7749, lon: -122.4194, sales: 1000 },
        { category: 'Store B', lat: 34.0522, lon: -118.2437, sales: 2000 },
      ];
      const suggestions = detectOutputType(data);
      expect(suggestions[0]).toBe('map');
    });

    it('should prioritize line_chart for time series over categorical', () => {
      const data = [
        { date: '2024-01-01', category: 'A', value: 100 },
        { date: '2024-01-02', category: 'A', value: 150 },
        { date: '2024-01-03', category: 'B', value: 200 },
      ];
      const suggestions = detectOutputType(data);
      expect(suggestions[0]).toBe('line_chart');
    });

    it('should always include table in suggestions', () => {
      const data = [
        { id: 1, name: 'Test' },
        { id: 2, name: 'Test 2' },
      ];
      const suggestions = detectOutputType(data);
      expect(suggestions).toContain('table');
    });
  });
});
