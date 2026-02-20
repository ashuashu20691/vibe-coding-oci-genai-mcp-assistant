/**
 * Property Test: Output Type Detection
 * 
 * Feature: mastra-migration, Property 8: Output Type Detection
 * 
 * *For any* data returned from a SQL query, the output type detector SHALL suggest
 * appropriate output types based on data characteristics: arrays with numeric values
 * suggest charts, string data with mermaid keywords suggests diagram, and all
 * structured data suggests table view.
 * 
 * **Validates: Requirements 12.1**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { detectOutputType, isMermaidSyntax } from '@/components/OutputRenderer';
import { OutputType } from '@/types';

// Arbitrary for column names (valid identifiers)
const columnNameArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s));

// Arbitrary for numeric values
const numericValueArb = fc.float({ 
  min: -1e6, 
  max: 1e6, 
  noNaN: true, 
  noDefaultInfinity: true 
});

// Arbitrary for string values
const stringValueArb = fc.string({ minLength: 0, maxLength: 50 })
  .filter(s => !s.toLowerCase().includes('graph') && 
               !s.toLowerCase().includes('flowchart') &&
               !s.toLowerCase().includes('mermaid'));

// Arbitrary for latitude values (-90 to 90)
const latitudeArb = fc.float({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true });

// Arbitrary for longitude values (-180 to 180)
const longitudeArb = fc.float({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true });

// Arbitrary for date strings (YYYY-MM-DD format)
const dateStringArb = fc.tuple(
  fc.integer({ min: 2000, max: 2030 }),
  fc.integer({ min: 1, max: 12 }),
  fc.integer({ min: 1, max: 28 })
).map(([year, month, day]) => 
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
);

// Arbitrary for generating a row with numeric column
const numericRowArb = (colName: string) => 
  numericValueArb.map(val => ({ [colName]: val }));

// Arbitrary for generating array of objects with numeric column
const numericDataArb = fc.tuple(columnNameArb, fc.integer({ min: 1, max: 50 }))
  .chain(([colName, size]) => 
    fc.array(numericValueArb, { minLength: size, maxLength: size })
      .map(values => values.map(val => ({ [colName]: val })))
  );

// Arbitrary for generating array of objects with string column
const stringDataArb = fc.tuple(columnNameArb, fc.integer({ min: 1, max: 50 }))
  .chain(([colName, size]) => 
    fc.array(stringValueArb, { minLength: size, maxLength: size })
      .map(values => values.map(val => ({ [colName]: val })))
  );

// Arbitrary for generating array of objects with two numeric columns
const twoNumericColumnsArb = fc.tuple(
  columnNameArb,
  columnNameArb,
  fc.integer({ min: 2, max: 50 })
).filter(([col1, col2]) => col1 !== col2) // Ensure different column names
.chain(([col1, col2, size]) => 
  fc.tuple(
    fc.array(numericValueArb, { minLength: size, maxLength: size }),
    fc.array(numericValueArb, { minLength: size, maxLength: size })
  ).map(([vals1, vals2]) => 
    vals1.map((v1, i) => ({ [col1]: v1, [col2]: vals2[i] }))
  )
);

// Arbitrary for generating geographic data (lat/lon columns)
const geoDataArb = fc.integer({ min: 1, max: 50 })
  .chain(size => 
    fc.tuple(
      fc.array(latitudeArb, { minLength: size, maxLength: size }),
      fc.array(longitudeArb, { minLength: size, maxLength: size })
    ).map(([lats, lons]) => 
      lats.map((lat, i) => ({ latitude: lat, longitude: lons[i] }))
    )
  );

// Arbitrary for generating data with date column (ordered data)
const orderedDataArb = fc.integer({ min: 2, max: 20 })
  .chain(size => 
    fc.tuple(
      fc.array(dateStringArb, { minLength: size, maxLength: size }),
      fc.array(numericValueArb, { minLength: size, maxLength: size })
    ).map(([dates, values]) => 
      dates.map((date, i) => ({ date, value: values[i] }))
    )
  );

// Mermaid diagram prefixes
const mermaidPrefixes = [
  'graph TD',
  'graph LR',
  'graph ',
  'flowchart TD',
  'flowchart LR',
  'flowchart ',
  'sequenceDiagram',
  'classDiagram',
  'stateDiagram',
  'erDiagram',
  'gantt',
  'pie',
  'gitgraph',
];

// Arbitrary for mermaid syntax
const mermaidSyntaxArb = fc.tuple(
  fc.constantFrom(...mermaidPrefixes),
  fc.string({ minLength: 1, maxLength: 100 })
    .filter(s => !s.includes('```'))
).map(([prefix, content]) => `${prefix}\n${content}`);

// Arbitrary for mermaid code block
const mermaidCodeBlockArb = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => !s.includes('```'))
  .map(content => `\`\`\`mermaid\n${content}\n\`\`\``);

describe('Property 8: Output Type Detection', () => {
  it('should always suggest table for array data (Req 12.1)', () => {
    fc.assert(
      fc.property(numericDataArb, (data) => {
        const suggestions = detectOutputType(data);
        
        // Property: Table should always be in suggestions for array data
        expect(suggestions).toContain('table');
      }),
      { numRuns: 100 }
    );
  });

  it('should suggest chart types for numeric data (Req 12.1)', () => {
    fc.assert(
      fc.property(numericDataArb, (data) => {
        const suggestions = detectOutputType(data);
        
        // Property: Table should always be suggested
        expect(suggestions).toContain('table');
        
        // Property: At least one chart type should be suggested for numeric data
        const chartTypes: OutputType[] = ['bar_chart', 'line_chart', 'pie_chart', 'scatter_chart'];
        const hasChartSuggestion = chartTypes.some(ct => suggestions.includes(ct));
        expect(hasChartSuggestion).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('should suggest map for geographic data with lat/lon columns (Req 12.1)', () => {
    fc.assert(
      fc.property(geoDataArb, (data) => {
        const suggestions = detectOutputType(data);
        
        // Property: Map should be suggested for geographic data
        expect(suggestions).toContain('map');
        
        // Property: Map should be the first suggestion (highest priority)
        expect(suggestions[0]).toBe('map');
      }),
      { numRuns: 100 }
    );
  });

  it('should suggest scatter chart for multiple numeric columns (Req 12.1)', () => {
    fc.assert(
      fc.property(twoNumericColumnsArb, (data) => {
        const suggestions = detectOutputType(data);
        
        // Property: Scatter chart should be suggested for multiple numeric columns
        expect(suggestions).toContain('scatter_chart');
      }),
      { numRuns: 100 }
    );
  });

  it('should suggest pie chart for small datasets with numeric data (Req 12.1)', () => {
    // Generate small datasets (<=10 rows)
    const smallNumericDataArb = fc.tuple(columnNameArb, fc.integer({ min: 1, max: 10 }))
      .chain(([colName, size]) => 
        fc.array(numericValueArb, { minLength: size, maxLength: size })
          .map(values => values.map(val => ({ [colName]: val })))
      );

    fc.assert(
      fc.property(smallNumericDataArb, (data) => {
        const suggestions = detectOutputType(data);
        
        // Property: Pie chart should be suggested for small numeric datasets
        expect(suggestions).toContain('pie_chart');
      }),
      { numRuns: 100 }
    );
  });

  it('should suggest line chart for ordered/date data (Req 12.1)', () => {
    fc.assert(
      fc.property(orderedDataArb, (data) => {
        const suggestions = detectOutputType(data);
        
        // Property: Line chart should be suggested for ordered data
        expect(suggestions).toContain('line_chart');
        
        // Property: Line chart should be prioritized (near the top)
        const lineChartIndex = suggestions.indexOf('line_chart');
        expect(lineChartIndex).toBeLessThan(3); // Should be in top 3
      }),
      { numRuns: 100 }
    );
  });

  it('should detect mermaid syntax and suggest mermaid output (Req 12.1)', () => {
    fc.assert(
      fc.property(mermaidSyntaxArb, (mermaidCode) => {
        const suggestions = detectOutputType(mermaidCode);
        
        // Property: Mermaid should be suggested for mermaid syntax
        expect(suggestions).toContain('mermaid');
        
        // Property: Mermaid should be the first suggestion
        expect(suggestions[0]).toBe('mermaid');
      }),
      { numRuns: 100 }
    );
  });

  it('should detect mermaid code blocks (Req 12.1)', () => {
    fc.assert(
      fc.property(mermaidCodeBlockArb, (mermaidCode) => {
        const suggestions = detectOutputType(mermaidCode);
        
        // Property: Mermaid should be suggested for mermaid code blocks
        expect(suggestions).toContain('mermaid');
        
        // Property: Mermaid should be the first suggestion
        expect(suggestions[0]).toBe('mermaid');
      }),
      { numRuns: 100 }
    );
  });

  it('should suggest text for non-mermaid strings (Req 12.1)', () => {
    const plainTextArb = fc.string({ minLength: 1, maxLength: 200 })
      .filter(s => {
        const lower = s.toLowerCase().trim();
        // Filter out anything that looks like mermaid
        return !mermaidPrefixes.some(p => lower.startsWith(p.toLowerCase())) &&
               !lower.includes('```mermaid');
      });

    fc.assert(
      fc.property(plainTextArb, (text) => {
        const suggestions = detectOutputType(text);
        
        // Property: Text should be the first suggestion for plain strings
        expect(suggestions[0]).toBe('text');
        
        // Property: Table should also be suggested
        expect(suggestions).toContain('table');
      }),
      { numRuns: 100 }
    );
  });

  it('should handle empty arrays gracefully (Req 12.1)', () => {
    const emptyArray: unknown[] = [];
    const suggestions = detectOutputType(emptyArray);
    
    // Property: Table should be suggested for empty arrays
    expect(suggestions).toContain('table');
    
    // Property: No chart types should be first for empty data
    const chartTypes: OutputType[] = ['bar_chart', 'line_chart', 'pie_chart', 'scatter_chart', 'map'];
    expect(chartTypes).not.toContain(suggestions[0]);
  });

  it('should handle non-object arrays gracefully (Req 12.1)', () => {
    const primitiveArrayArb = fc.array(
      fc.oneof(fc.integer(), fc.string(), fc.boolean()),
      { minLength: 1, maxLength: 20 }
    );

    fc.assert(
      fc.property(primitiveArrayArb, (data) => {
        const suggestions = detectOutputType(data);
        
        // Property: Text should be suggested for primitive arrays
        expect(suggestions[0]).toBe('text');
        
        // Property: Table should also be in suggestions
        expect(suggestions).toContain('table');
      }),
      { numRuns: 100 }
    );
  });

  it('should handle non-array data gracefully (Req 12.1)', () => {
    const nonArrayArb = fc.oneof(
      fc.integer(),
      fc.boolean(),
      fc.record({ key: fc.string() })
    );

    fc.assert(
      fc.property(nonArrayArb, (data) => {
        const suggestions = detectOutputType(data);
        
        // Property: Text should be suggested for non-array data
        expect(suggestions[0]).toBe('text');
        
        // Property: Table should also be in suggestions
        expect(suggestions).toContain('table');
      }),
      { numRuns: 100 }
    );
  });
});

describe('isMermaidSyntax helper function', () => {
  it('should correctly identify mermaid syntax (Req 12.1)', () => {
    fc.assert(
      fc.property(mermaidSyntaxArb, (mermaidCode) => {
        // Property: isMermaidSyntax should return true for valid mermaid syntax
        expect(isMermaidSyntax(mermaidCode)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('should correctly identify mermaid code blocks (Req 12.1)', () => {
    fc.assert(
      fc.property(mermaidCodeBlockArb, (mermaidCode) => {
        // Property: isMermaidSyntax should return true for mermaid code blocks
        expect(isMermaidSyntax(mermaidCode)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('should return false for non-mermaid text (Req 12.1)', () => {
    const plainTextArb = fc.string({ minLength: 1, maxLength: 200 })
      .filter(s => {
        const lower = s.toLowerCase().trim();
        return !mermaidPrefixes.some(p => lower.startsWith(p.toLowerCase())) &&
               !lower.includes('```mermaid');
      });

    fc.assert(
      fc.property(plainTextArb, (text) => {
        // Property: isMermaidSyntax should return false for plain text
        expect(isMermaidSyntax(text)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('should handle empty and null-like inputs (Req 12.1)', () => {
    // Property: Empty string should return false
    expect(isMermaidSyntax('')).toBe(false);
    
    // Property: Whitespace-only should return false
    expect(isMermaidSyntax('   \n\t  ')).toBe(false);
  });
});
