/**
 * Property Test: Visualization Type Auto-Detection
 * 
 * Feature: claude-desktop-alternative, Property 12: Visualization Type Auto-Detection
 * 
 * *For any* query result data, the auto-detected visualization type SHALL be appropriate
 * for the data structure: geographic data (lat/lon) → map, time series → line chart,
 * categorical with values → bar chart, tabular → table.
 * 
 * **Validates: Requirements 5.1, 5.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  detectOutputType,
  hasGeographicColumns,
  hasTimeSeriesData,
  hasCategoricalData,
  getNumericColumns,
} from '@/components/OutputRenderer';

// ============================================================================
// Arbitraries for generating test data
// ============================================================================

/**
 * Arbitrary for latitude values (-90 to 90)
 */
const latitudeArb = fc.double({ min: -90, max: 90, noNaN: true });

/**
 * Arbitrary for longitude values (-180 to 180)
 */
const longitudeArb = fc.double({ min: -180, max: 180, noNaN: true });

/**
 * Arbitrary for latitude column names
 */
const latColumnNameArb = fc.constantFrom('lat', 'latitude', 'LAT', 'Latitude', 'geo_lat', 'location_lat');

/**
 * Arbitrary for longitude column names
 */
const lonColumnNameArb = fc.constantFrom('lon', 'lng', 'longitude', 'LON', 'Longitude', 'geo_lng', 'location_lng');

/**
 * Arbitrary for generating geographic data rows
 */
const geographicRowArb = (latCol: string, lonCol: string) =>
  fc.record({
    id: fc.integer({ min: 1, max: 10000 }),
    [latCol]: latitudeArb,
    [lonCol]: longitudeArb,
    name: fc.string({ minLength: 1, maxLength: 50 }),
  });

/**
 * Arbitrary for date strings in YYYY-MM-DD format
 * Uses integer-based generation to avoid invalid date issues
 */
const dateStringArb = fc.tuple(
  fc.integer({ min: 2000, max: 2030 }),
  fc.integer({ min: 1, max: 12 }),
  fc.integer({ min: 1, max: 28 }) // Use 28 to avoid month-end issues
).map(([year, month, day]) => 
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
);

/**
 * Arbitrary for ISO datetime strings
 * Uses integer-based generation to avoid invalid date issues
 */
const isoDateTimeArb = fc.tuple(
  fc.integer({ min: 2000, max: 2030 }),
  fc.integer({ min: 1, max: 12 }),
  fc.integer({ min: 1, max: 28 }),
  fc.integer({ min: 0, max: 23 }),
  fc.integer({ min: 0, max: 59 }),
  fc.integer({ min: 0, max: 59 })
).map(([year, month, day, hour, min, sec]) => 
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}Z`
);

/**
 * Arbitrary for time column names
 */
const timeColumnNameArb = fc.constantFrom(
  'date', 'time', 'timestamp', 'datetime', 'created_at', 'updated_at', 'period', 'day'
);

/**
 * Arbitrary for generating time series data rows
 */
const timeSeriesRowArb = (timeCol: string, dateGen: fc.Arbitrary<string>) =>
  fc.record({
    [timeCol]: dateGen,
    value: fc.double({ min: 0, max: 10000, noNaN: true }),
    count: fc.integer({ min: 0, max: 1000 }),
  });

/**
 * Arbitrary for category column names
 */
const categoryColumnNameArb = fc.constantFrom(
  'category', 'type', 'status', 'name', 'label', 'group', 'region', 'country', 'product'
);

/**
 * Arbitrary for category values
 */
const categoryValueArb = fc.constantFrom(
  'Electronics', 'Clothing', 'Food', 'Sports', 'Books',
  'Active', 'Inactive', 'Pending',
  'North', 'South', 'East', 'West',
  'TypeA', 'TypeB', 'TypeC'
);

/**
 * Arbitrary for generating categorical data rows
 */
const categoricalRowArb = (catCol: string) =>
  fc.record({
    [catCol]: categoryValueArb,
    value: fc.double({ min: 0, max: 10000, noNaN: true }),
    count: fc.integer({ min: 0, max: 1000 }),
  });

/**
 * Arbitrary for generating plain tabular data (no special patterns)
 */
const tabularRowArb = fc.record({
  id: fc.integer({ min: 1, max: 10000 }),
  description: fc.string({ minLength: 1, maxLength: 100 }),
  notes: fc.string({ minLength: 0, maxLength: 200 }),
});

// ============================================================================
// Property Tests
// ============================================================================

describe('Property 12: Visualization Type Auto-Detection', () => {
  describe('Geographic Data → Map', () => {
    it('should detect map type for data with lat/lon columns (Req 5.1, 5.3)', () => {
      fc.assert(
        fc.property(
          latColumnNameArb,
          lonColumnNameArb,
          fc.integer({ min: 2, max: 20 }),
          (latCol, lonCol, rowCount) => {
            // Generate geographic data with the specified column names
            const data = fc.sample(geographicRowArb(latCol, lonCol), rowCount);

            // Property: detectOutputType should return 'map' as first suggestion
            const suggestions = detectOutputType(data);
            expect(suggestions[0]).toBe('map');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect geographic columns regardless of case (Req 5.1)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('lat', 'LAT', 'Lat', 'latitude', 'LATITUDE'),
          fc.constantFrom('lon', 'LON', 'Lon', 'lng', 'LNG', 'longitude', 'LONGITUDE'),
          (latCol, lonCol) => {
            const columns = ['id', latCol, lonCol, 'name'];

            // Property: hasGeographicColumns should return true for any case variant
            expect(hasGeographicColumns(columns)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should require both lat AND lon columns for geographic detection (Req 5.1)', () => {
      fc.assert(
        fc.property(
          latColumnNameArb,
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          (latCol, otherCols) => {
            // Filter out any accidental lon-like columns
            const filteredCols = otherCols.filter(c => 
              !['lon', 'lng', 'longitude', 'long', 'x', 'geo_lon', 'geo_lng'].includes(c.toLowerCase())
            );
            const columns = [latCol, ...filteredCols];

            // Property: Should NOT detect geographic without lon column
            expect(hasGeographicColumns(columns)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Time Series Data → Line Chart', () => {
    it('should detect line_chart type for data with time columns and numeric values (Req 5.1, 5.3)', () => {
      fc.assert(
        fc.property(
          timeColumnNameArb,
          fc.integer({ min: 2, max: 20 }),
          (timeCol, rowCount) => {
            // Generate time series data
            const data = fc.sample(timeSeriesRowArb(timeCol, dateStringArb), rowCount);

            // Property: detectOutputType should return 'line_chart' as first suggestion
            const suggestions = detectOutputType(data);
            expect(suggestions[0]).toBe('line_chart');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect time series from ISO datetime format (Req 5.1)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 20 }),
          (rowCount) => {
            // Generate data with ISO datetime strings
            const data = fc.sample(timeSeriesRowArb('timestamp', isoDateTimeArb), rowCount);
            const columns = Object.keys(data[0]);
            const numericColumns = getNumericColumns(data);

            // Property: hasTimeSeriesData should return true for ISO datetime
            expect(hasTimeSeriesData(columns, numericColumns, data)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should require at least 2 data points for time series detection (Req 5.1)', () => {
      fc.assert(
        fc.property(
          timeColumnNameArb,
          (timeCol) => {
            // Generate single row of time series data
            const data = fc.sample(timeSeriesRowArb(timeCol, dateStringArb), 1);
            const columns = Object.keys(data[0]);
            const numericColumns = getNumericColumns(data);

            // Property: Single data point should NOT be detected as time series
            expect(hasTimeSeriesData(columns, numericColumns, data)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should require numeric columns for time series detection (Req 5.1)', () => {
      fc.assert(
        fc.property(
          timeColumnNameArb,
          fc.integer({ min: 2, max: 10 }),
          (timeCol, rowCount) => {
            // Generate data with time column but no numeric values
            const data = Array.from({ length: rowCount }, (_, i) => ({
              [timeCol]: `2024-01-${String(i + 1).padStart(2, '0')}`,
              label: `Item ${i}`,
              description: `Description ${i}`,
            }));
            const columns = Object.keys(data[0]);
            const numericColumns = getNumericColumns(data);

            // Property: No numeric columns means no time series detection
            expect(numericColumns.length).toBe(0);
            expect(hasTimeSeriesData(columns, numericColumns, data)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Categorical Data → Bar Chart', () => {
    it('should detect bar_chart type for data with category columns and numeric values (Req 5.1, 5.3)', () => {
      fc.assert(
        fc.property(
          categoryColumnNameArb,
          fc.integer({ min: 2, max: 20 }),
          (catCol, rowCount) => {
            // Generate categorical data
            const data = fc.sample(categoricalRowArb(catCol), rowCount);

            // Property: detectOutputType should return 'bar_chart' as first suggestion
            const suggestions = detectOutputType(data);
            expect(suggestions[0]).toBe('bar_chart');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect categorical data by column name patterns (Req 5.1)', () => {
      fc.assert(
        fc.property(
          categoryColumnNameArb,
          (catCol) => {
            const data = [
              { [catCol]: 'A', value: 100 },
              { [catCol]: 'B', value: 200 },
            ];
            const columns = Object.keys(data[0]);
            const numericColumns = getNumericColumns(data);

            // Property: Category column names should trigger categorical detection
            expect(hasCategoricalData(columns, numericColumns, data)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect categorical data by unique value ratio (Req 5.1)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 5, max: 20 }),
          fc.integer({ min: 2, max: 4 }),
          (rowCount, uniqueCategories) => {
            // Generate data where unique categories < 80% of rows
            const categories = Array.from({ length: uniqueCategories }, (_, i) => `Cat${i}`);
            const data = Array.from({ length: rowCount }, (_, i) => ({
              item: categories[i % uniqueCategories],
              value: Math.random() * 1000,
            }));
            const columns = Object.keys(data[0]);
            const numericColumns = getNumericColumns(data);

            // Property: Low unique value ratio should indicate categorical data
            const uniqueRatio = uniqueCategories / rowCount;
            if (uniqueRatio < 0.8) {
              expect(hasCategoricalData(columns, numericColumns, data)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should require numeric columns for categorical detection (Req 5.1)', () => {
      fc.assert(
        fc.property(
          categoryColumnNameArb,
          fc.integer({ min: 2, max: 10 }),
          (catCol, rowCount) => {
            // Generate data with category column but no numeric values
            const data = Array.from({ length: rowCount }, (_, i) => ({
              [catCol]: `Category${i % 3}`,
              label: `Label ${i}`,
              description: `Desc ${i}`,
            }));
            const columns = Object.keys(data[0]);
            const numericColumns = getNumericColumns(data);

            // Property: No numeric columns means no categorical detection
            expect(numericColumns.length).toBe(0);
            expect(hasCategoricalData(columns, numericColumns, data)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Tabular Data → Table', () => {
    it('should always include table in suggestions for array data (Req 5.1)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          (rowCount) => {
            // Generate plain tabular data
            const data = fc.sample(tabularRowArb, rowCount);

            // Property: 'table' should always be in suggestions
            const suggestions = detectOutputType(data);
            expect(suggestions).toContain('table');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return table as primary type for data without special patterns (Req 5.1)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          (rowCount) => {
            // Generate data without geographic, time, or categorical patterns
            const data = Array.from({ length: rowCount }, (_, i) => ({
              record_id: `REC-${i}`,
              field_a: `Value A ${i}`,
              field_b: `Value B ${i}`,
            }));

            // Property: Plain string data should default to table
            const suggestions = detectOutputType(data);
            expect(suggestions[0]).toBe('table');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty arrays gracefully (Req 5.1)', () => {
      fc.assert(
        fc.property(
          fc.constant([]),
          (data) => {
            // Property: Empty array should return table as suggestion
            const suggestions = detectOutputType(data);
            expect(suggestions).toContain('table');
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Detection Priority', () => {
    it('should prioritize map over other types when geographic columns present (Req 5.1, 5.3)', () => {
      fc.assert(
        fc.property(
          latColumnNameArb,
          lonColumnNameArb,
          categoryColumnNameArb,
          fc.integer({ min: 2, max: 10 }),
          (latCol, lonCol, catCol, rowCount) => {
            // Generate data with both geographic AND categorical columns
            const data = Array.from({ length: rowCount }, (_, i) => ({
              [latCol]: -90 + Math.random() * 180,
              [lonCol]: -180 + Math.random() * 360,
              [catCol]: `Category${i % 3}`,
              value: Math.random() * 1000,
            }));

            // Property: Map should take priority over bar_chart
            const suggestions = detectOutputType(data);
            expect(suggestions[0]).toBe('map');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prioritize line_chart over bar_chart for time series with categories (Req 5.1, 5.3)', () => {
      fc.assert(
        fc.property(
          timeColumnNameArb,
          categoryColumnNameArb,
          fc.integer({ min: 2, max: 10 }),
          (timeCol, catCol, rowCount) => {
            // Generate data with both time AND categorical columns
            const data = Array.from({ length: rowCount }, (_, i) => ({
              [timeCol]: `2024-01-${String(i + 1).padStart(2, '0')}`,
              [catCol]: `Category${i % 3}`,
              value: Math.random() * 1000,
            }));

            // Property: Line chart should take priority for time series
            const suggestions = detectOutputType(data);
            expect(suggestions[0]).toBe('line_chart');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('getNumericColumns Helper', () => {
    it('should correctly identify numeric columns (Req 5.1)', () => {
      fc.assert(
        fc.property(
          fc.array(fc.double({ min: -10000, max: 10000, noNaN: true }), { minLength: 2, maxLength: 20 }),
          (numericValues) => {
            // Create data with known numeric and non-numeric string columns
            // Use strings that are clearly NOT numeric (contain letters)
            const data = numericValues.map((num, i) => ({
              numeric_col: num,
              string_col: `text_value_${i}`,
            }));

            const numericCols = getNumericColumns(data);

            // Property: numeric_col should be detected as numeric
            expect(numericCols).toContain('numeric_col');
            // Property: string_col with text should NOT be detected as numeric
            expect(numericCols).not.toContain('string_col');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle string numbers as numeric (Req 5.1)', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 10000 }), { minLength: 2, maxLength: 20 }),
          (numbers) => {
            // Create data with numeric strings
            const data = numbers.map(n => ({
              string_number: String(n),
              label: 'text',
            }));

            const numericCols = getNumericColumns(data);

            // Property: String numbers should be detected as numeric
            expect(numericCols).toContain('string_number');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty array for empty data (Req 5.1)', () => {
      fc.assert(
        fc.property(
          fc.constant([]),
          (data) => {
            const numericCols = getNumericColumns(data);

            // Property: Empty data should return empty numeric columns
            expect(numericCols).toEqual([]);
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
