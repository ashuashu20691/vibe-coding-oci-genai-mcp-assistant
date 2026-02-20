/**
 * Property Test: CSV Export Round-Trip
 * 
 * Feature: claude-desktop-alternative, Property 20: CSV Export Round-Trip
 * 
 * *For any* tabular data exported as CSV, parsing the CSV back SHALL produce
 * data equivalent to the original (same columns, same values, same row count).
 * 
 * **Validates: Requirements 7.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ExportService } from '../../src/services/export-service';

// ============================================================================
// CSV Parser for Round-Trip Testing
// ============================================================================

/**
 * Parse CSV content back to array of objects.
 * Handles RFC 4180 compliant CSV with proper escaping.
 */
function parseCSV(csvContent: string): Record<string, string>[] {
  if (!csvContent || csvContent.trim() === '') {
    return [];
  }

  const lines = parseCSVLines(csvContent);
  if (lines.length === 0) {
    return [];
  }

  const headers = lines[0];
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i];
    const row: Record<string, string> = {};
    
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? '';
    }
    
    rows.push(row);
  }

  return rows;
}

/**
 * Parse CSV content into array of arrays (rows of cells).
 * Handles quoted fields with embedded commas, quotes, and newlines.
 */
function parseCSVLines(csvContent: string): string[][] {
  const result: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;
  let lastWasNewline = false;

  while (i < csvContent.length) {
    const char = csvContent[i];
    const nextChar = csvContent[i + 1];
    lastWasNewline = false;

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i += 2;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        currentField += char;
        i++;
      }
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true;
        i++;
      } else if (char === ',') {
        // Field separator
        currentRow.push(currentField);
        currentField = '';
        i++;
      } else if (char === '\n') {
        // Row separator - always push the current field and row
        currentRow.push(currentField);
        result.push(currentRow);
        currentRow = [];
        currentField = '';
        lastWasNewline = true;
        i++;
      } else if (char === '\r') {
        // Handle \r\n or standalone \r
        if (nextChar === '\n') {
          i++; // Skip \r, \n will be handled next iteration
        } else {
          // Standalone \r treated as newline
          currentRow.push(currentField);
          result.push(currentRow);
          currentRow = [];
          currentField = '';
          lastWasNewline = true;
          i++;
        }
      } else {
        currentField += char;
        i++;
      }
    }
  }

  // Handle the last row:
  // - If there's content in currentField or currentRow, add it
  // - If the CSV ended with a newline (lastWasNewline), add an empty row
  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField);
    result.push(currentRow);
  } else if (lastWasNewline) {
    // CSV ended with newline, meaning there's an empty row after it
    result.push(['']);
  }

  return result;
}

// ============================================================================
// Arbitraries for Generating Test Data
// ============================================================================

/**
 * Generate a valid column name (non-empty, no special chars that break parsing)
 */
const columnNameArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s));

/**
 * Generate a string value that may contain special CSV characters.
 * This tests the escaping functionality (Requirement 7.4).
 */
const stringValueArb = fc.oneof(
  // Simple strings
  fc.string({ minLength: 0, maxLength: 50 }),
  // Strings with commas
  fc.string({ minLength: 0, maxLength: 20 }).map(s => `${s},${s}`),
  // Strings with quotes
  fc.string({ minLength: 0, maxLength: 20 }).map(s => `${s}"${s}`),
  // Strings with newlines
  fc.string({ minLength: 0, maxLength: 20 }).map(s => `${s}\n${s}`),
  // Strings with carriage returns
  fc.string({ minLength: 0, maxLength: 20 }).map(s => `${s}\r\n${s}`),
  // Strings with multiple special characters
  fc.string({ minLength: 0, maxLength: 10 }).map(s => `"${s}",\n${s}`)
);

/**
 * Generate a cell value (string, number, boolean, null, undefined).
 * All values will be converted to strings in CSV.
 */
const cellValueArb = fc.oneof(
  stringValueArb,
  fc.integer().map(n => n.toString()),
  fc.double({ noNaN: true, noDefaultInfinity: true }).map(n => n.toString()),
  fc.boolean().map(b => b.toString()),
  fc.constant(''),
  fc.constant('null'),
  fc.constant('undefined')
);

/**
 * Generate a row of data with specific columns.
 */
function rowArb(columns: string[]): fc.Arbitrary<Record<string, string>> {
  if (columns.length === 0) {
    return fc.constant({});
  }
  
  const entries = columns.map(col => 
    cellValueArb.map(val => [col, val] as [string, string])
  );
  
  return fc.tuple(...entries).map(pairs => 
    Object.fromEntries(pairs)
  );
}

/**
 * Generate tabular data with consistent columns across all rows.
 */
const tabularDataArb = fc.array(columnNameArb, { minLength: 1, maxLength: 10 })
  .chain(columns => {
    // Ensure unique column names
    const uniqueColumns = [...new Set(columns)];
    if (uniqueColumns.length === 0) {
      return fc.constant([]);
    }
    
    return fc.array(rowArb(uniqueColumns), { minLength: 1, maxLength: 20 });
  });

/**
 * Generate data specifically with special characters to stress-test escaping.
 */
const specialCharDataArb = fc.array(columnNameArb, { minLength: 1, maxLength: 5 })
  .chain(columns => {
    const uniqueColumns = [...new Set(columns)];
    if (uniqueColumns.length === 0) {
      return fc.constant([]);
    }
    
    // Generate rows with guaranteed special characters
    const specialValueArb = fc.oneof(
      fc.constant('value,with,commas'),
      fc.constant('value"with"quotes'),
      fc.constant('value\nwith\nnewlines'),
      fc.constant('value\r\nwith\r\ncrlf'),
      fc.constant('"quoted,value\nwith"all"'),
      fc.string({ minLength: 1, maxLength: 30 }).map(s => `${s},"${s}"\n${s}`)
    );
    
    const specialRowArb = fc.tuple(
      ...uniqueColumns.map(() => specialValueArb)
    ).map(values => 
      Object.fromEntries(uniqueColumns.map((col, i) => [col, values[i]]))
    );
    
    return fc.array(specialRowArb, { minLength: 1, maxLength: 10 });
  });

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize a value for comparison.
 * Handles the fact that CSV export converts all values to strings.
 */
function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Normalize data for comparison after round-trip.
 */
function normalizeData(data: Record<string, unknown>[]): Record<string, string>[] {
  return data.map(row => {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[key] = normalizeValue(value);
    }
    return normalized;
  });
}

// ============================================================================
// Property Tests
// ============================================================================

describe('Property 20: CSV Export Round-Trip', () => {
  describe('Round-Trip Data Integrity', () => {
    it('should preserve row count after round-trip (Req 7.4)', () => {
      fc.assert(
        fc.property(
          tabularDataArb.filter(data => data.length > 0),
          (data) => {
            const service = new ExportService();
            const result = service.exportAsCsv(data);
            
            expect(result.success).toBe(true);
            expect(typeof result.content).toBe('string');
            
            const parsed = parseCSV(result.content as string);
            
            // Property: Row count should be preserved
            expect(parsed.length).toBe(data.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve column names after round-trip (Req 7.4)', () => {
      fc.assert(
        fc.property(
          tabularDataArb.filter(data => data.length > 0),
          (data) => {
            const service = new ExportService();
            const result = service.exportAsCsv(data);
            
            expect(result.success).toBe(true);
            
            const parsed = parseCSV(result.content as string);
            
            if (parsed.length > 0) {
              const originalColumns = new Set(Object.keys(data[0]));
              const parsedColumns = new Set(Object.keys(parsed[0]));
              
              // Property: Column names should be preserved
              expect(parsedColumns).toEqual(originalColumns);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve cell values after round-trip (Req 7.4)', () => {
      fc.assert(
        fc.property(
          tabularDataArb.filter(data => data.length > 0),
          (data) => {
            const service = new ExportService();
            const result = service.exportAsCsv(data);
            
            expect(result.success).toBe(true);
            
            const parsed = parseCSV(result.content as string);
            const normalizedOriginal = normalizeData(data);
            
            // Property: Each cell value should be preserved
            for (let i = 0; i < normalizedOriginal.length; i++) {
              for (const [key, value] of Object.entries(normalizedOriginal[i])) {
                expect(parsed[i][key]).toBe(value);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Special Character Escaping (Req 7.4)', () => {
    it('should properly escape and preserve commas in values', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              col1: fc.string({ minLength: 0, maxLength: 20 }).map(s => `${s},${s}`),
              col2: fc.string({ minLength: 0, maxLength: 20 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (data) => {
            const service = new ExportService();
            const result = service.exportAsCsv(data);
            
            expect(result.success).toBe(true);
            
            const parsed = parseCSV(result.content as string);
            const normalizedOriginal = normalizeData(data);
            
            // Property: Values with commas should be preserved
            for (let i = 0; i < normalizedOriginal.length; i++) {
              expect(parsed[i].col1).toBe(normalizedOriginal[i].col1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should properly escape and preserve quotes in values', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              col1: fc.string({ minLength: 0, maxLength: 20 }).map(s => `${s}"${s}`),
              col2: fc.string({ minLength: 0, maxLength: 20 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (data) => {
            const service = new ExportService();
            const result = service.exportAsCsv(data);
            
            expect(result.success).toBe(true);
            
            const parsed = parseCSV(result.content as string);
            const normalizedOriginal = normalizeData(data);
            
            // Property: Values with quotes should be preserved
            for (let i = 0; i < normalizedOriginal.length; i++) {
              expect(parsed[i].col1).toBe(normalizedOriginal[i].col1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should properly escape and preserve newlines in values', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              col1: fc.string({ minLength: 0, maxLength: 20 }).map(s => `${s}\n${s}`),
              col2: fc.string({ minLength: 0, maxLength: 20 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (data) => {
            const service = new ExportService();
            const result = service.exportAsCsv(data);
            
            expect(result.success).toBe(true);
            
            const parsed = parseCSV(result.content as string);
            const normalizedOriginal = normalizeData(data);
            
            // Property: Values with newlines should be preserved
            for (let i = 0; i < normalizedOriginal.length; i++) {
              expect(parsed[i].col1).toBe(normalizedOriginal[i].col1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should properly escape and preserve CRLF in values', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              col1: fc.string({ minLength: 0, maxLength: 20 }).map(s => `${s}\r\n${s}`),
              col2: fc.string({ minLength: 0, maxLength: 20 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (data) => {
            const service = new ExportService();
            const result = service.exportAsCsv(data);
            
            expect(result.success).toBe(true);
            
            const parsed = parseCSV(result.content as string);
            const normalizedOriginal = normalizeData(data);
            
            // Property: Values with CRLF should be preserved
            for (let i = 0; i < normalizedOriginal.length; i++) {
              expect(parsed[i].col1).toBe(normalizedOriginal[i].col1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle values with multiple special characters combined', () => {
      fc.assert(
        fc.property(
          specialCharDataArb.filter(data => data.length > 0),
          (data) => {
            const service = new ExportService();
            const result = service.exportAsCsv(data);
            
            expect(result.success).toBe(true);
            
            const parsed = parseCSV(result.content as string);
            const normalizedOriginal = normalizeData(data);
            
            // Property: All values should be preserved regardless of special chars
            expect(parsed.length).toBe(normalizedOriginal.length);
            
            for (let i = 0; i < normalizedOriginal.length; i++) {
              for (const [key, value] of Object.entries(normalizedOriginal[i])) {
                expect(parsed[i][key]).toBe(value);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string values', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              col1: fc.constant(''),
              col2: fc.string({ minLength: 0, maxLength: 20 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (data) => {
            const service = new ExportService();
            const result = service.exportAsCsv(data);
            
            expect(result.success).toBe(true);
            
            const parsed = parseCSV(result.content as string);
            
            // Property: Empty strings should be preserved
            for (let i = 0; i < data.length; i++) {
              expect(parsed[i].col1).toBe('');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle single row data', () => {
      fc.assert(
        fc.property(
          fc.array(columnNameArb, { minLength: 1, maxLength: 5 })
            .chain(columns => {
              const uniqueColumns = [...new Set(columns)];
              return rowArb(uniqueColumns).map(row => [row]);
            })
            .filter(data => data.length > 0 && Object.keys(data[0]).length > 0),
          (data) => {
            const service = new ExportService();
            const result = service.exportAsCsv(data);
            
            expect(result.success).toBe(true);
            
            const parsed = parseCSV(result.content as string);
            
            // Property: Single row should be preserved
            expect(parsed.length).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle single column data', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({ singleCol: stringValueArb }),
            { minLength: 1, maxLength: 10 }
          ),
          (data) => {
            const service = new ExportService();
            const result = service.exportAsCsv(data);
            
            expect(result.success).toBe(true);
            
            const parsed = parseCSV(result.content as string);
            const normalizedOriginal = normalizeData(data);
            
            // Property: Single column data should be preserved
            expect(parsed.length).toBe(normalizedOriginal.length);
            for (let i = 0; i < normalizedOriginal.length; i++) {
              expect(parsed[i].singleCol).toBe(normalizedOriginal[i].singleCol);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle numeric string values', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              num: fc.integer().map(n => n.toString()),
              float: fc.double({ noNaN: true, noDefaultInfinity: true }).map(n => n.toString())
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (data) => {
            const service = new ExportService();
            const result = service.exportAsCsv(data);
            
            expect(result.success).toBe(true);
            
            const parsed = parseCSV(result.content as string);
            
            // Property: Numeric values should be preserved as strings
            for (let i = 0; i < data.length; i++) {
              expect(parsed[i].num).toBe(data[i].num);
              expect(parsed[i].float).toBe(data[i].float);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return error for empty data array', () => {
      const service = new ExportService();
      const result = service.exportAsCsv([]);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('No data to export');
    });
  });

  describe('Idempotency', () => {
    it('should produce identical CSV when exported twice', () => {
      fc.assert(
        fc.property(
          tabularDataArb.filter(data => data.length > 0),
          (data) => {
            const service = new ExportService();
            
            const result1 = service.exportAsCsv(data);
            const result2 = service.exportAsCsv(data);
            
            expect(result1.success).toBe(true);
            expect(result2.success).toBe(true);
            
            // Property: Same data should produce identical CSV
            expect(result1.content).toBe(result2.content);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce equivalent data after double round-trip', () => {
      fc.assert(
        fc.property(
          tabularDataArb.filter(data => data.length > 0),
          (data) => {
            const service = new ExportService();
            
            // First round-trip
            const result1 = service.exportAsCsv(data);
            expect(result1.success).toBe(true);
            const parsed1 = parseCSV(result1.content as string);
            
            // Second round-trip
            const result2 = service.exportAsCsv(parsed1);
            expect(result2.success).toBe(true);
            const parsed2 = parseCSV(result2.content as string);
            
            // Property: Double round-trip should preserve data
            expect(parsed2.length).toBe(parsed1.length);
            
            for (let i = 0; i < parsed1.length; i++) {
              for (const [key, value] of Object.entries(parsed1[i])) {
                expect(parsed2[i][key]).toBe(value);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
