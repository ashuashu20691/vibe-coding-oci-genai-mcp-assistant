/**
 * Property Test: Table Sorting Correctness
 * 
 * Feature: claude-desktop-alternative, Property 15: Table Sorting Correctness
 * 
 * *For any* table data and sort column, sorting ascending then descending SHALL produce
 * rows in opposite orders, and sorting by the same column twice SHALL toggle the direction.
 * 
 * **Validates: Requirements 5.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { sortData, filterData, type FilterState } from '@/components/DataTable';

// ============================================================================
// Arbitraries for generating test data
// ============================================================================

/**
 * Arbitrary for generating numeric values (avoiding -0 edge case)
 */
const numericValueArb = fc.double({ min: -10000, max: 10000, noNaN: true, noDefaultInfinity: true })
  .map(v => v === 0 ? 0 : v); // Normalize -0 to 0

/**
 * Arbitrary for generating string values
 */
const stringValueArb = fc.string({ minLength: 1, maxLength: 50 });

/**
 * Arbitrary for generating a row with unique numeric value
 * Uses index to ensure uniqueness
 */
const uniqueNumericRowArb = (index: number) => fc.record({
  id: fc.constant(index),
  value: fc.double({ min: index * 100, max: index * 100 + 99, noNaN: true, noDefaultInfinity: true }),
  name: stringValueArb,
});

/**
 * Arbitrary for generating a row with unique string value
 */
const uniqueStringRowArb = (index: number) => fc.record({
  id: fc.constant(index),
  category: fc.constant(`Category_${index}_${Math.random().toString(36).substring(7)}`),
  description: stringValueArb,
});

/**
 * Arbitrary for generating mixed data rows with unique ID
 */
const mixedRowWithUniqueIdArb = (index: number) => fc.record({
  id: fc.constant(index),
  numericValue: numericValueArb,
  stringValue: stringValueArb,
  count: fc.integer({ min: 0, max: 1000 }),
});

/**
 * Arbitrary for generating rows with null values
 */
const rowWithNullsArb = fc.record({
  id: fc.integer({ min: 1, max: 100000 }),
  value: fc.option(numericValueArb, { nil: null }),
  name: fc.option(stringValueArb, { nil: null }),
});

/**
 * Arbitrary for sort direction
 */
const sortDirectionArb = fc.constantFrom<'asc' | 'desc'>('asc', 'desc');

/**
 * Generate array of rows with unique values in sort column
 */
function generateUniqueValueRows(count: number): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    value: (i + 1) * 10 + Math.random(), // Unique values
    name: `Name_${i}`,
  }));
}

/**
 * Generate array of rows with unique string values
 */
function generateUniqueStringRows(count: number): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    category: `Cat_${String(i).padStart(5, '0')}`, // Ensures unique and sortable
    description: `Desc_${i}`,
  }));
}

// ============================================================================
// Property Tests
// ============================================================================

describe('Property 15: Table Sorting Correctness', () => {
  describe('Ascending then Descending Produces Opposite Orders', () => {
    it('should produce opposite orders when sorting ascending then descending by numeric column with unique values (Req 5.5)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 50 }),
          (rowCount) => {
            // Generate data with unique values to ensure deterministic ordering
            const data = generateUniqueValueRows(rowCount);
            const column = 'value';
            
            // Sort ascending
            const sortedAsc = sortData(data, column, 'asc');
            // Sort descending
            const sortedDesc = sortData(data, column, 'desc');
            
            // Property: Ascending and descending should produce opposite orders
            // When all values are unique, reverse of ascending equals descending
            const reversedAsc = [...sortedAsc].reverse();
            
            expect(sortedDesc.length).toBe(reversedAsc.length);
            for (let i = 0; i < sortedDesc.length; i++) {
              expect(sortedDesc[i].id).toBe(reversedAsc[i].id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce opposite orders when sorting ascending then descending by string column with unique values (Req 5.5)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 50 }),
          (rowCount) => {
            // Generate data with unique string values
            const data = generateUniqueStringRows(rowCount);
            const column = 'category';
            
            // Sort ascending
            const sortedAsc = sortData(data, column, 'asc');
            // Sort descending
            const sortedDesc = sortData(data, column, 'desc');
            
            // Property: Ascending and descending should produce opposite orders
            const reversedAsc = [...sortedAsc].reverse();
            
            expect(sortedDesc.length).toBe(reversedAsc.length);
            for (let i = 0; i < sortedDesc.length; i++) {
              expect(sortedDesc[i].id).toBe(reversedAsc[i].id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce opposite value ordering for mixed data types (Req 5.5)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 50 }),
          (rowCount) => {
            // Generate data with unique numeric values
            const data = Array.from({ length: rowCount }, (_, i) => ({
              id: i + 1,
              numericValue: (i + 1) * 7.5, // Unique values
              stringValue: `Str_${i}`,
              count: (i + 1) * 3,
            }));
            
            const column = 'numericValue';
            
            // Sort ascending
            const sortedAsc = sortData(data, column, 'asc');
            // Sort descending
            const sortedDesc = sortData(data, column, 'desc');
            
            // Property: Values should be in opposite order
            for (let i = 0; i < sortedAsc.length; i++) {
              expect(sortedAsc[i].numericValue).toBe(sortedDesc[sortedDesc.length - 1 - i].numericValue);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Sorting Preserves All Data', () => {
    it('should preserve all rows when sorting (no rows lost) (Req 5.5)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.constantFrom('id', 'numericValue', 'stringValue', 'count'),
          sortDirectionArb,
          (rowCount, column, direction) => {
            // Generate data with unique IDs
            const data = Array.from({ length: rowCount }, (_, i) => ({
              id: i + 1,
              numericValue: Math.random() * 1000,
              stringValue: `Value_${i}`,
              count: Math.floor(Math.random() * 100),
            }));
            
            const sorted = sortData(data, column, direction);
            
            // Property: Sorted data should have same length as original
            expect(sorted.length).toBe(data.length);
            
            // Property: All original IDs should be present in sorted data
            const originalIds = new Set(data.map(row => row.id));
            const sortedIds = new Set(sorted.map(row => row.id));
            expect(sortedIds).toEqual(originalIds);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve row data integrity when sorting (Req 5.5)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          fc.constantFrom('id', 'numericValue', 'stringValue', 'count'),
          sortDirectionArb,
          (rowCount, column, direction) => {
            // Generate data with unique IDs for reliable lookup
            const data = Array.from({ length: rowCount }, (_, i) => ({
              id: i + 1, // Unique ID
              numericValue: Math.random() * 1000,
              stringValue: `Value_${i}`,
              count: Math.floor(Math.random() * 100),
            }));
            
            const sorted = sortData(data, column, direction);
            
            // Property: Each row in sorted data should match an original row exactly
            for (const sortedRow of sorted) {
              const originalRow = data.find(row => row.id === sortedRow.id);
              expect(originalRow).toBeDefined();
              expect(sortedRow.numericValue).toBe(originalRow!.numericValue);
              expect(sortedRow.stringValue).toBe(originalRow!.stringValue);
              expect(sortedRow.count).toBe(originalRow!.count);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Sorting Handles Different Data Types', () => {
    it('should correctly sort numeric values in ascending order (Req 5.5)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 50 }),
          (rowCount) => {
            const data = generateUniqueValueRows(rowCount);
            const sorted = sortData(data, 'value', 'asc');
            
            // Property: Each value should be <= the next value
            for (let i = 0; i < sorted.length - 1; i++) {
              const current = sorted[i].value as number;
              const next = sorted[i + 1].value as number;
              expect(current).toBeLessThanOrEqual(next);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly sort numeric values in descending order (Req 5.5)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 50 }),
          (rowCount) => {
            const data = generateUniqueValueRows(rowCount);
            const sorted = sortData(data, 'value', 'desc');
            
            // Property: Each value should be >= the next value
            for (let i = 0; i < sorted.length - 1; i++) {
              const current = sorted[i].value as number;
              const next = sorted[i + 1].value as number;
              expect(current).toBeGreaterThanOrEqual(next);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly sort string values in ascending order (Req 5.5)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 50 }),
          (rowCount) => {
            const data = generateUniqueStringRows(rowCount);
            const sorted = sortData(data, 'category', 'asc');
            
            // Property: Each string should be <= the next string (lexicographically)
            for (let i = 0; i < sorted.length - 1; i++) {
              const current = String(sorted[i].category);
              const next = String(sorted[i + 1].category);
              expect(current.localeCompare(next)).toBeLessThanOrEqual(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly sort string values in descending order (Req 5.5)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 50 }),
          (rowCount) => {
            const data = generateUniqueStringRows(rowCount);
            const sorted = sortData(data, 'category', 'desc');
            
            // Property: Each string should be >= the next string (lexicographically)
            for (let i = 0; i < sorted.length - 1; i++) {
              const current = String(sorted[i].category);
              const next = String(sorted[i + 1].category);
              expect(current.localeCompare(next)).toBeGreaterThanOrEqual(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle integer sorting correctly (Req 5.5)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 50 }),
          sortDirectionArb,
          (rowCount, direction) => {
            // Generate data with unique count values
            const data = Array.from({ length: rowCount }, (_, i) => ({
              id: i + 1,
              numericValue: Math.random() * 100,
              stringValue: `Str_${i}`,
              count: i * 5, // Unique integer values
            }));
            
            const sorted = sortData(data, 'count', direction);
            
            // Property: Integer values should be sorted correctly
            for (let i = 0; i < sorted.length - 1; i++) {
              const current = sorted[i].count as number;
              const next = sorted[i + 1].count as number;
              if (direction === 'asc') {
                expect(current).toBeLessThanOrEqual(next);
              } else {
                expect(current).toBeGreaterThanOrEqual(next);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Null Value Handling', () => {
    it('should place null values at the end when sorting ascending (Req 5.5)', () => {
      fc.assert(
        fc.property(
          fc.array(rowWithNullsArb, { minLength: 2, maxLength: 50 }),
          (data) => {
            const sorted = sortData(data, 'value', 'asc');
            
            // Find first null index
            const firstNullIndex = sorted.findIndex(row => row.value == null);
            
            if (firstNullIndex !== -1) {
              // Property: All values after first null should also be null
              for (let i = firstNullIndex; i < sorted.length; i++) {
                expect(sorted[i].value).toBeNull();
              }
              
              // Property: All values before first null should be non-null and sorted
              for (let i = 0; i < firstNullIndex - 1; i++) {
                const current = sorted[i].value as number;
                const next = sorted[i + 1].value as number;
                expect(current).toBeLessThanOrEqual(next);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should place null values at the end when sorting descending (Req 5.5)', () => {
      fc.assert(
        fc.property(
          fc.array(rowWithNullsArb, { minLength: 2, maxLength: 50 }),
          (data) => {
            const sorted = sortData(data, 'value', 'desc');
            
            // Find first null index
            const firstNullIndex = sorted.findIndex(row => row.value == null);
            
            if (firstNullIndex !== -1) {
              // Property: All values after first null should also be null
              for (let i = firstNullIndex; i < sorted.length; i++) {
                expect(sorted[i].value).toBeNull();
              }
              
              // Property: All values before first null should be non-null and sorted descending
              for (let i = 0; i < firstNullIndex - 1; i++) {
                const current = sorted[i].value as number;
                const next = sorted[i + 1].value as number;
                expect(current).toBeGreaterThanOrEqual(next);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('No Sort Column Behavior', () => {
    it('should return data unchanged when sort column is null (Req 5.5)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          sortDirectionArb,
          (rowCount, direction) => {
            const data = Array.from({ length: rowCount }, (_, i) => ({
              id: i + 1,
              numericValue: Math.random() * 100,
              stringValue: `Str_${i}`,
              count: i,
            }));
            
            const sorted = sortData(data, null, direction);
            
            // Property: Data should be unchanged when no sort column specified
            expect(sorted.length).toBe(data.length);
            for (let i = 0; i < data.length; i++) {
              expect(sorted[i]).toEqual(data[i]);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Sorting Stability and Idempotence', () => {
    it('should produce same result when sorting twice with same parameters (Req 5.5)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 50 }),
          fc.constantFrom('id', 'numericValue', 'stringValue', 'count'),
          sortDirectionArb,
          (rowCount, column, direction) => {
            const data = Array.from({ length: rowCount }, (_, i) => ({
              id: i + 1,
              numericValue: Math.random() * 100,
              stringValue: `Str_${i}`,
              count: i,
            }));
            
            const sorted1 = sortData(data, column, direction);
            const sorted2 = sortData(data, column, direction);
            
            // Property: Sorting should be deterministic
            expect(sorted1.length).toBe(sorted2.length);
            for (let i = 0; i < sorted1.length; i++) {
              expect(sorted1[i].id).toBe(sorted2[i].id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not mutate original data when sorting (Req 5.5)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 50 }),
          fc.constantFrom('id', 'numericValue', 'stringValue', 'count'),
          sortDirectionArb,
          (rowCount, column, direction) => {
            // Generate data with simple values to avoid -0/0 issues
            const data = Array.from({ length: rowCount }, (_, i) => ({
              id: i + 1,
              numericValue: (i + 1) * 10, // Simple positive integers
              stringValue: `Str_${i}`,
              count: i,
            }));
            
            // Store original order of IDs
            const originalIds = data.map(row => row.id);
            
            // Sort the data
            sortData(data, column, direction);
            
            // Property: Original data order should not be mutated
            const currentIds = data.map(row => row.id);
            expect(currentIds).toEqual(originalIds);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Empty Data Handling', () => {
    it('should handle empty array gracefully (Req 5.5)', () => {
      fc.assert(
        fc.property(
          fc.constant<Record<string, unknown>[]>([]),
          fc.string({ minLength: 1, maxLength: 20 }),
          sortDirectionArb,
          (data, column, direction) => {
            const sorted = sortData(data, column, direction);
            
            // Property: Empty array should return empty array
            expect(sorted).toEqual([]);
            expect(sorted.length).toBe(0);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should handle single row array (Req 5.5)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('id', 'numericValue', 'stringValue', 'count'),
          sortDirectionArb,
          (column, direction) => {
            const data = [{
              id: 1,
              numericValue: 42,
              stringValue: 'test',
              count: 5,
            }];
            
            const sorted = sortData(data, column, direction);
            
            // Property: Single row should remain unchanged
            expect(sorted.length).toBe(1);
            expect(sorted[0].id).toBe(data[0].id);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

describe('Filter Data Helper', () => {
  describe('Filter Preserves Data Integrity', () => {
    it('should preserve all rows when no filters are active (Req 5.5)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          (rowCount) => {
            const data = Array.from({ length: rowCount }, (_, i) => ({
              id: i + 1,
              numericValue: Math.random() * 100,
              stringValue: `Str_${i}`,
              count: i,
            }));
            
            const filters: FilterState = {};
            const filtered = filterData(data, filters);
            
            // Property: No filters should return all data
            expect(filtered.length).toBe(data.length);
            for (let i = 0; i < data.length; i++) {
              expect(filtered[i]).toEqual(data[i]);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all rows when filters are empty strings (Req 5.5)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          (rowCount) => {
            const data = Array.from({ length: rowCount }, (_, i) => ({
              id: i + 1,
              numericValue: Math.random() * 100,
              stringValue: `Str_${i}`,
              count: i,
            }));
            
            const filters: FilterState = {
              id: '',
              numericValue: '  ',
              stringValue: '',
            };
            const filtered = filterData(data, filters);
            
            // Property: Empty string filters should return all data
            expect(filtered.length).toBe(data.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Filter Correctness', () => {
    it('should filter rows that match the filter value (case-insensitive) (Req 5.5)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 5, max: 50 }),
          (rowCount) => {
            const data = Array.from({ length: rowCount }, (_, i) => ({
              id: i + 1,
              category: `Category_${i % 5}`, // Creates repeating categories
              description: `Desc_${i}`,
            }));
            
            // Filter for a specific category
            const searchTerm = 'category_0';
            const filters: FilterState = { category: searchTerm };
            const filtered = filterData(data, filters);
            
            // Property: All filtered rows should contain the search term (case-insensitive)
            for (const row of filtered) {
              const cellValue = String(row.category).toLowerCase();
              expect(cellValue).toContain(searchTerm.toLowerCase());
            }
            
            // Property: Should have found some matches
            expect(filtered.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty array when no rows match filter (Req 5.5)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          (rowCount) => {
            const data = Array.from({ length: rowCount }, (_, i) => ({
              id: i + 1,
              value: i * 10,
              name: `Name_${i}`,
            }));
            
            // Use a filter value that won't match any data
            const filters: FilterState = { value: 'ZZZZNONEXISTENT' };
            const filtered = filterData(data, filters);
            
            // Property: No matches should return empty array
            expect(filtered.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
