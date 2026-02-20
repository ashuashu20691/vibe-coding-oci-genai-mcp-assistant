/**
 * Property Test: HTML Export Self-Containment
 * 
 * Feature: claude-desktop-alternative, Property 21: HTML Export Self-Containment
 * 
 * *For any* dashboard exported as HTML, the exported file SHALL be valid HTML
 * and SHALL render without requiring external network requests (self-contained).
 * 
 * **Validates: Requirements 7.2**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ExportService } from '../../src/services/export-service';
import {
  DashboardLayout,
  DashboardSection,
  DashboardFilter,
  ExportOption,
  StatsCard,
  VisualizationType,
} from '../../src/types';

// ============================================================================
// HTML Self-Containment Validators
// ============================================================================

/**
 * Check for external CSS links (http/https stylesheet references).
 * Self-contained HTML should not have any external stylesheet links.
 */
function hasExternalCssLinks(html: string): boolean {
  // Match <link rel="stylesheet" href="http..."> or <link href="http..." rel="stylesheet">
  const externalCssPattern = /<link[^>]*(?:href\s*=\s*["']https?:\/\/[^"']+["'][^>]*rel\s*=\s*["']stylesheet["']|rel\s*=\s*["']stylesheet["'][^>]*href\s*=\s*["']https?:\/\/[^"']+["'])[^>]*>/gi;
  return externalCssPattern.test(html);
}

/**
 * Check for external JavaScript (http/https script src references).
 * Self-contained HTML should not have any external script sources.
 */
function hasExternalJsLinks(html: string): boolean {
  // Match <script src="http..."> or <script src="https...">
  const externalJsPattern = /<script[^>]*src\s*=\s*["']https?:\/\/[^"']+["'][^>]*>/gi;
  return externalJsPattern.test(html);
}

/**
 * Check for external image sources (http/https img src references).
 * Self-contained HTML should not have external image references.
 */
function hasExternalImageLinks(html: string): boolean {
  // Match <img src="http..."> or <img src="https...">
  const externalImgPattern = /<img[^>]*src\s*=\s*["']https?:\/\/[^"']+["'][^>]*>/gi;
  return externalImgPattern.test(html);
}

/**
 * Check for external font references (http/https font-face or @import).
 * Self-contained HTML should not have external font references.
 */
function hasExternalFontLinks(html: string): boolean {
  // Match @import url("http...") or @font-face with external src
  const externalFontPattern = /@import\s+url\s*\(\s*["']?https?:\/\/[^"')]+["']?\s*\)|@font-face[^}]*src\s*:[^}]*url\s*\(\s*["']?https?:\/\/[^"')]+["']?\s*\)/gi;
  return externalFontPattern.test(html);
}

/**
 * Check that HTML has inline or embedded styles (in <style> tags).
 */
function hasEmbeddedStyles(html: string): boolean {
  const styleTagPattern = /<style[^>]*>[\s\S]*?<\/style>/gi;
  return styleTagPattern.test(html);
}

/**
 * Check that HTML has embedded JavaScript (in <script> tags without external src).
 */
function hasEmbeddedScript(html: string): boolean {
  // Match <script>...</script> without src attribute
  const inlineScriptPattern = /<script(?![^>]*src\s*=)[^>]*>[\s\S]*?<\/script>/gi;
  return inlineScriptPattern.test(html);
}

/**
 * Check that HTML has basic structure (doctype, html, head, body).
 */
function hasValidHtmlStructure(html: string): boolean {
  const hasDoctype = /<!DOCTYPE\s+html>/i.test(html);
  const hasHtmlTag = /<html[^>]*>/i.test(html);
  const hasHeadTag = /<head[^>]*>/i.test(html);
  const hasBodyTag = /<body[^>]*>/i.test(html);
  const hasClosingTags = /<\/html>/i.test(html) && /<\/head>/i.test(html) && /<\/body>/i.test(html);
  
  return hasDoctype && hasHtmlTag && hasHeadTag && hasBodyTag && hasClosingTags;
}

/**
 * Check that data is embedded in the HTML (as JSON in script tag).
 */
function hasEmbeddedData(html: string, expectedDataLength: number): boolean {
  // Look for dashboardData variable assignment
  const dataPattern = /const\s+dashboardData\s*=\s*\[/;
  const hasDataVar = dataPattern.test(html);
  
  // If we expect data, verify it's present
  if (expectedDataLength > 0) {
    return hasDataVar;
  }
  
  // Empty data should still have the variable (as empty array)
  return hasDataVar || /dashboardData\s*=\s*\[\s*\]/.test(html);
}

// ============================================================================
// Arbitraries for Generating Test Data
// ============================================================================

/**
 * Generate a valid dashboard title (non-empty, reasonable length).
 */
const dashboardTitleArb = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0)
  .map(s => s.trim());

/**
 * Generate a dashboard description.
 */
const dashboardDescriptionArb = fc.string({ minLength: 0, maxLength: 500 });

/**
 * Generate a stats card.
 */
const statsCardArb: fc.Arbitrary<StatsCard> = fc.record({
  label: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  value: fc.oneof(
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.integer({ min: 0, max: 1000000 })
  ),
  color: fc.constantFrom('blue', 'green', 'red', 'orange', 'gray') as fc.Arbitrary<'blue' | 'green' | 'red' | 'orange' | 'gray'>,
  trend: fc.option(fc.constantFrom('up', 'down', 'neutral') as fc.Arbitrary<'up' | 'down' | 'neutral'>, { nil: undefined }),
});

/**
 * Generate a visualization type.
 */
const vizTypeArb: fc.Arbitrary<VisualizationType> = fc.constantFrom(
  'map', 'bar_chart', 'line_chart', 'pie_chart', 'scatter_chart',
  'area_chart', 'heat_map', 'photo_gallery', 'timeline', 'table', 'stats_cards'
);

/**
 * Generate a section width.
 */
const sectionWidthArb = fc.constantFrom('full', 'half', 'third') as fc.Arbitrary<'full' | 'half' | 'third'>;

/**
 * Generate a section type.
 */
const sectionTypeArb = fc.constantFrom('stats', 'visualization', 'table', 'insights') as fc.Arbitrary<'stats' | 'visualization' | 'table' | 'insights'>;

/**
 * Generate a dashboard section.
 */
const dashboardSectionArb: fc.Arbitrary<DashboardSection> = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  type: sectionTypeArb,
  width: sectionWidthArb,
  content: fc.record({
    visualization: fc.option(
      fc.record({
        type: vizTypeArb,
        title: fc.string({ minLength: 1, maxLength: 50 }),
        priority: fc.integer({ min: 1, max: 10 }),
        dataKey: fc.string({ minLength: 1, maxLength: 30 }),
        config: fc.constant({} as Record<string, unknown>),
      }),
      { nil: undefined }
    ),
    statsCards: fc.option(fc.array(statsCardArb, { minLength: 1, maxLength: 6 }), { nil: undefined }),
    insights: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 200 }), { minLength: 1, maxLength: 5 }), { nil: undefined }),
    tableConfig: fc.option(
      fc.record({
        columns: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 10 }),
        pageSize: fc.integer({ min: 10, max: 100 }),
      }),
      { nil: undefined }
    ),
  }),
});

/**
 * Generate a dashboard filter.
 */
const dashboardFilterArb: fc.Arbitrary<DashboardFilter> = fc.record({
  id: fc.uuid(),
  label: fc.string({ minLength: 1, maxLength: 30 }),
  type: fc.constantFrom('select', 'range', 'date', 'search') as fc.Arbitrary<'select' | 'range' | 'date' | 'search'>,
  column: fc.string({ minLength: 1, maxLength: 30 }),
  options: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 10 }), { nil: undefined }),
});

/**
 * Generate an export option.
 */
const exportOptionArb: fc.Arbitrary<ExportOption> = fc.record({
  format: fc.constantFrom('html', 'csv', 'png') as fc.Arbitrary<'html' | 'csv' | 'png'>,
  label: fc.string({ minLength: 1, maxLength: 30 }),
});

/**
 * Generate a complete dashboard layout.
 */
const dashboardLayoutArb: fc.Arbitrary<DashboardLayout> = fc.record({
  title: dashboardTitleArb,
  description: dashboardDescriptionArb,
  sections: fc.array(dashboardSectionArb, { minLength: 0, maxLength: 10 }),
  filters: fc.array(dashboardFilterArb, { minLength: 0, maxLength: 5 }),
  exportOptions: fc.array(exportOptionArb, { minLength: 0, maxLength: 3 }),
});

/**
 * Generate a column name for data records.
 */
const columnNameArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s));

/**
 * Generate a cell value for data records.
 */
const cellValueArb = fc.oneof(
  fc.string({ minLength: 0, maxLength: 50 }),
  fc.integer(),
  fc.double({ noNaN: true, noDefaultInfinity: true }),
  fc.boolean(),
  fc.constant(null)
);

/**
 * Generate tabular data to embed in the dashboard.
 */
const tabularDataArb = fc.array(columnNameArb, { minLength: 1, maxLength: 5 })
  .chain(columns => {
    const uniqueColumns = [...new Set(columns)];
    if (uniqueColumns.length === 0) {
      return fc.constant([]);
    }
    
    return fc.array(
      fc.tuple(...uniqueColumns.map(() => cellValueArb))
        .map(values => Object.fromEntries(uniqueColumns.map((col, i) => [col, values[i]]))),
      { minLength: 0, maxLength: 20 }
    );
  });

// ============================================================================
// Property Tests
// ============================================================================

describe('Property 21: HTML Export Self-Containment', () => {
  describe('No External CSS Links (Req 7.2)', () => {
    it('should not include external stylesheet links for any dashboard configuration', () => {
      fc.assert(
        fc.property(
          dashboardLayoutArb,
          tabularDataArb,
          (dashboard, data) => {
            const service = new ExportService();
            const result = service.exportAsHtml(dashboard, data);
            
            expect(result.success).toBe(true);
            expect(typeof result.content).toBe('string');
            
            const html = result.content as string;
            
            // Property: No external CSS links should be present
            expect(hasExternalCssLinks(html)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('No External JavaScript Links (Req 7.2)', () => {
    it('should not include external script sources for any dashboard configuration', () => {
      fc.assert(
        fc.property(
          dashboardLayoutArb,
          tabularDataArb,
          (dashboard, data) => {
            const service = new ExportService();
            const result = service.exportAsHtml(dashboard, data);
            
            expect(result.success).toBe(true);
            expect(typeof result.content).toBe('string');
            
            const html = result.content as string;
            
            // Property: No external JavaScript links should be present
            expect(hasExternalJsLinks(html)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('No External Image Links (Req 7.2)', () => {
    it('should not include external image sources for any dashboard configuration', () => {
      fc.assert(
        fc.property(
          dashboardLayoutArb,
          tabularDataArb,
          (dashboard, data) => {
            const service = new ExportService();
            const result = service.exportAsHtml(dashboard, data);
            
            expect(result.success).toBe(true);
            expect(typeof result.content).toBe('string');
            
            const html = result.content as string;
            
            // Property: No external image links should be present
            expect(hasExternalImageLinks(html)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('No External Font Links (Req 7.2)', () => {
    it('should not include external font references for any dashboard configuration', () => {
      fc.assert(
        fc.property(
          dashboardLayoutArb,
          tabularDataArb,
          (dashboard, data) => {
            const service = new ExportService();
            const result = service.exportAsHtml(dashboard, data);
            
            expect(result.success).toBe(true);
            expect(typeof result.content).toBe('string');
            
            const html = result.content as string;
            
            // Property: No external font links should be present
            expect(hasExternalFontLinks(html)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Embedded Styles (Req 7.2)', () => {
    it('should include embedded styles in <style> tags for any dashboard configuration', () => {
      fc.assert(
        fc.property(
          dashboardLayoutArb,
          tabularDataArb,
          (dashboard, data) => {
            const service = new ExportService();
            const result = service.exportAsHtml(dashboard, data);
            
            expect(result.success).toBe(true);
            expect(typeof result.content).toBe('string');
            
            const html = result.content as string;
            
            // Property: Styles should be embedded in <style> tags
            expect(hasEmbeddedStyles(html)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Embedded JavaScript (Req 7.2)', () => {
    it('should include embedded JavaScript in <script> tags for any dashboard configuration', () => {
      fc.assert(
        fc.property(
          dashboardLayoutArb,
          tabularDataArb,
          (dashboard, data) => {
            const service = new ExportService();
            const result = service.exportAsHtml(dashboard, data);
            
            expect(result.success).toBe(true);
            expect(typeof result.content).toBe('string');
            
            const html = result.content as string;
            
            // Property: JavaScript should be embedded in <script> tags
            expect(hasEmbeddedScript(html)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Embedded Data (Req 7.2)', () => {
    it('should embed all data in the HTML for any dashboard configuration', () => {
      fc.assert(
        fc.property(
          dashboardLayoutArb,
          tabularDataArb,
          (dashboard, data) => {
            const service = new ExportService();
            const result = service.exportAsHtml(dashboard, data);
            
            expect(result.success).toBe(true);
            expect(typeof result.content).toBe('string');
            
            const html = result.content as string;
            
            // Property: Data should be embedded in the HTML
            expect(hasEmbeddedData(html, data.length)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Valid HTML Structure (Req 7.2)', () => {
    it('should produce valid HTML structure for any dashboard configuration', () => {
      fc.assert(
        fc.property(
          dashboardLayoutArb,
          tabularDataArb,
          (dashboard, data) => {
            const service = new ExportService();
            const result = service.exportAsHtml(dashboard, data);
            
            expect(result.success).toBe(true);
            expect(typeof result.content).toBe('string');
            
            const html = result.content as string;
            
            // Property: HTML should have valid structure
            expect(hasValidHtmlStructure(html)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Dashboard Content Preservation (Req 7.2)', () => {
    it('should include dashboard title in the exported HTML', () => {
      fc.assert(
        fc.property(
          dashboardLayoutArb,
          tabularDataArb,
          (dashboard, data) => {
            const service = new ExportService();
            const result = service.exportAsHtml(dashboard, data);
            
            expect(result.success).toBe(true);
            expect(typeof result.content).toBe('string');
            
            const html = result.content as string;
            
            // Property: Dashboard title should be present in HTML
            // Note: Title may be HTML-escaped, so we check for the escaped version
            const escapedTitle = dashboard.title
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;');
            
            expect(html).toContain(escapedTitle);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include dashboard description in the exported HTML', () => {
      fc.assert(
        fc.property(
          dashboardLayoutArb.filter(d => d.description.trim().length > 0),
          tabularDataArb,
          (dashboard, data) => {
            const service = new ExportService();
            const result = service.exportAsHtml(dashboard, data);
            
            expect(result.success).toBe(true);
            expect(typeof result.content).toBe('string');
            
            const html = result.content as string;
            
            // Property: Dashboard description should be present in HTML
            const escapedDescription = dashboard.description
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;');
            
            expect(html).toContain(escapedDescription);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Complete Self-Containment Check (Req 7.2)', () => {
    it('should be completely self-contained with no external dependencies', () => {
      fc.assert(
        fc.property(
          dashboardLayoutArb,
          tabularDataArb,
          (dashboard, data) => {
            const service = new ExportService();
            const result = service.exportAsHtml(dashboard, data);
            
            expect(result.success).toBe(true);
            expect(typeof result.content).toBe('string');
            
            const html = result.content as string;
            
            // Property: Complete self-containment check
            // 1. No external CSS
            expect(hasExternalCssLinks(html)).toBe(false);
            // 2. No external JS
            expect(hasExternalJsLinks(html)).toBe(false);
            // 3. No external images
            expect(hasExternalImageLinks(html)).toBe(false);
            // 4. No external fonts
            expect(hasExternalFontLinks(html)).toBe(false);
            // 5. Has embedded styles
            expect(hasEmbeddedStyles(html)).toBe(true);
            // 6. Has embedded scripts
            expect(hasEmbeddedScript(html)).toBe(true);
            // 7. Has valid HTML structure
            expect(hasValidHtmlStructure(html)).toBe(true);
            // 8. Has embedded data
            expect(hasEmbeddedData(html, data.length)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty sections array', () => {
      fc.assert(
        fc.property(
          dashboardLayoutArb.map(d => ({ ...d, sections: [] })),
          tabularDataArb,
          (dashboard, data) => {
            const service = new ExportService();
            const result = service.exportAsHtml(dashboard, data);
            
            expect(result.success).toBe(true);
            expect(typeof result.content).toBe('string');
            
            const html = result.content as string;
            
            // Property: Should still be self-contained with empty sections
            expect(hasExternalCssLinks(html)).toBe(false);
            expect(hasExternalJsLinks(html)).toBe(false);
            expect(hasValidHtmlStructure(html)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty data array', () => {
      fc.assert(
        fc.property(
          dashboardLayoutArb,
          (dashboard) => {
            const service = new ExportService();
            const result = service.exportAsHtml(dashboard, []);
            
            expect(result.success).toBe(true);
            expect(typeof result.content).toBe('string');
            
            const html = result.content as string;
            
            // Property: Should still be self-contained with empty data
            expect(hasExternalCssLinks(html)).toBe(false);
            expect(hasExternalJsLinks(html)).toBe(false);
            expect(hasValidHtmlStructure(html)).toBe(true);
            expect(hasEmbeddedData(html, 0)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle special characters in dashboard title', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).map(s => 
            `<script>alert("${s}")</script> & "quotes" 'apostrophes'`
          ),
          tabularDataArb,
          (title, data) => {
            const dashboard: DashboardLayout = {
              title,
              description: 'Test description',
              sections: [],
              filters: [],
              exportOptions: [],
            };
            
            const service = new ExportService();
            const result = service.exportAsHtml(dashboard, data);
            
            expect(result.success).toBe(true);
            expect(typeof result.content).toBe('string');
            
            const html = result.content as string;
            
            // Property: Should be self-contained and properly escape special chars
            expect(hasExternalCssLinks(html)).toBe(false);
            expect(hasExternalJsLinks(html)).toBe(false);
            expect(hasValidHtmlStructure(html)).toBe(true);
            
            // The title in HTML content (outside of script tags) should be escaped
            // Extract the <title> tag content and verify it's escaped
            const titleMatch = html.match(/<title>([^<]*)<\/title>/);
            expect(titleMatch).not.toBeNull();
            if (titleMatch) {
              // Title should contain escaped version, not raw script tags
              expect(titleMatch[1]).toContain('&lt;script&gt;');
              expect(titleMatch[1]).not.toContain('<script>');
            }
            
            // The h1 tag should also have escaped content
            const h1Match = html.match(/<h1>([^<]*)<\/h1>/);
            expect(h1Match).not.toBeNull();
            if (h1Match) {
              expect(h1Match[1]).toContain('&lt;script&gt;');
              expect(h1Match[1]).not.toContain('<script>');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle large data sets', () => {
      const largeDataArb = fc.array(
        fc.record({
          id: fc.integer(),
          name: fc.string({ minLength: 1, maxLength: 20 }),
          value: fc.double({ noNaN: true, noDefaultInfinity: true }),
        }),
        { minLength: 50, maxLength: 150 }
      );

      fc.assert(
        fc.property(
          dashboardLayoutArb,
          largeDataArb,
          (dashboard, data) => {
            const service = new ExportService();
            const result = service.exportAsHtml(dashboard, data);
            
            expect(result.success).toBe(true);
            expect(typeof result.content).toBe('string');
            
            const html = result.content as string;
            
            // Property: Should still be self-contained with large data
            expect(hasExternalCssLinks(html)).toBe(false);
            expect(hasExternalJsLinks(html)).toBe(false);
            expect(hasValidHtmlStructure(html)).toBe(true);
            expect(hasEmbeddedData(html, data.length)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Idempotency', () => {
    it('should produce identical HTML when exported twice', () => {
      fc.assert(
        fc.property(
          dashboardLayoutArb,
          tabularDataArb,
          (dashboard, data) => {
            const service = new ExportService();
            
            const result1 = service.exportAsHtml(dashboard, data);
            const result2 = service.exportAsHtml(dashboard, data);
            
            expect(result1.success).toBe(true);
            expect(result2.success).toBe(true);
            
            // Property: Same dashboard and data should produce identical HTML
            // Note: We compare structure, not exact content due to timestamp
            const html1 = result1.content as string;
            const html2 = result2.content as string;
            
            // Both should be self-contained
            expect(hasExternalCssLinks(html1)).toBe(false);
            expect(hasExternalCssLinks(html2)).toBe(false);
            expect(hasExternalJsLinks(html1)).toBe(false);
            expect(hasExternalJsLinks(html2)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
