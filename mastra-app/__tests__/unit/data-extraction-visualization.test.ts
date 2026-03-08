/**
 * Tests for the data extraction and visualization pipeline.
 * Covers extractDataFromToolResult (all MCP result formats) and
 * the generateVisualization call that follows.
 */

import { generateVisualization } from '../../src/mastra/agents/visualization-agent';

// ─── Inline the functions under test (copied from route.ts) ──────────────────
// We test them directly here to avoid spinning up the full Next.js route.

function extractDataFromToolResult(result: unknown): Record<string, unknown>[] | null {
  if (!result || typeof result !== 'object') return null;

  // Unwrap { success, result } envelope from DatabaseOrchestrator
  const maybeWrapped = result as { success?: boolean; result?: unknown };
  if (maybeWrapped.success !== undefined && maybeWrapped.result !== undefined) {
    result = maybeWrapped.result;
  }

  const resultObj = result as { content?: Array<{ text?: string; type?: string }> };
  if (!resultObj.content?.[0]?.text) return null;

  try {
    const text = resultObj.content[0].text.trim();

    if (text.startsWith('[') || text.startsWith('{')) {
      try {
        const parsed = JSON.parse(text);

        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
          return parsed as Record<string, unknown>[];
        }

        if (typeof parsed === 'object' && parsed !== null) {
          // SQLcl columnar FIRST — check before generic "rows" key
          if (
            Array.isArray((parsed as Record<string, unknown>).columns) &&
            Array.isArray((parsed as Record<string, unknown>).rows)
          ) {
            const cols = (parsed as { columns: string[]; rows: unknown[][] }).columns;
            const rows = (parsed as { columns: string[]; rows: unknown[][] }).rows;
            if (rows.length === 0 || Array.isArray(rows[0])) {
              return rows.map(row => {
                const obj: Record<string, unknown> = {};
                cols.forEach((col, i) => {
                  const val = row[i];
                  const isDateLike = typeof val === 'string' && /^\d{4}-\d{2}|\d{2}\/\d{2}\/\d{4}/.test(val);
                  obj[col] = typeof val === 'string' ? (isNaN(parseFloat(val)) || isDateLike ? val : parseFloat(val)) : val;
                });
                return obj;
              });
            }
          }

          const dataKey = ['rows', 'data', 'results', 'items', 'records'].find(
            k => Array.isArray((parsed as Record<string, unknown>)[k])
          );
          if (dataKey) return (parsed as Record<string, unknown[]>)[dataKey] as Record<string, unknown>[];
        }
      } catch { /* fall through to CSV */ }
    }

    // CSV fallback
    const lines = text.split('\n').filter((l: string) => l.trim());
    if (lines.length < 2) return null;

    const headers = lines[0].split(',').map((h: string) => h.replace(/"/g, '').trim());
    return lines.slice(1).map((line: string) => {
      const values =
        line.match(/(".*?"|[^,]+)(?=,|$)/g)?.map((v: string) => v.replace(/^"|"$/g, '').trim()) ||
        line.split(',').map((v: string) => v.replace(/"/g, '').trim());
      const row: Record<string, unknown> = {};
      headers.forEach((header: string, i: number) => {
        const value = values[i] ?? '';
        const numValue = parseFloat(value);
        const isDateLike = /^\d{4}-\d{2}|\d{2}\/\d{2}\/\d{4}/.test(value);
        row[header] = (isNaN(numValue) || isDateLike) ? value : numValue;
      });
      return row;
    });
  } catch {
    return null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Wrap text the way the MCP tool returns it */
const mcpText = (text: string) => ({ content: [{ type: 'text', text }] });

/** Wrap with the DatabaseOrchestrator envelope */
const orchestratorWrap = (inner: unknown) => ({ success: true, result: inner });

// ─── extractDataFromToolResult ────────────────────────────────────────────────

describe('extractDataFromToolResult', () => {
  // ── null / bad input ──────────────────────────────────────────────────────
  it('returns null for null input', () => {
    expect(extractDataFromToolResult(null)).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(extractDataFromToolResult('string')).toBeNull();
    expect(extractDataFromToolResult(42)).toBeNull();
  });

  it('returns null when content array is missing', () => {
    expect(extractDataFromToolResult({})).toBeNull();
  });

  it('returns null when content[0].text is empty', () => {
    expect(extractDataFromToolResult({ content: [{ text: '' }] })).toBeNull();
  });

  // ── CSV format (what SQLcl MCP actually returns) ──────────────────────────
  it('parses plain CSV', () => {
    const csv = 'SALE_DATE,REVENUE,ORDERS\n2024-01-01,15000,42\n2024-01-02,18500,55';
    const result = extractDataFromToolResult(mcpText(csv));
    expect(result).toHaveLength(2);
    expect(result![0]).toEqual({ SALE_DATE: '2024-01-01', REVENUE: 15000, ORDERS: 42 });
    expect(result![1].REVENUE).toBe(18500);
  });

  it('parses CSV with quoted values', () => {
    const csv = 'NAME,AMOUNT\n"Smith, John",1000\n"Doe, Jane",2000';
    const result = extractDataFromToolResult(mcpText(csv));
    expect(result).toHaveLength(2);
    expect(result![0].NAME).toBe('Smith, John');
  });

  it('returns null for CSV with only a header row', () => {
    expect(extractDataFromToolResult(mcpText('COL1,COL2'))).toBeNull();
  });

  // ── DatabaseOrchestrator envelope ─────────────────────────────────────────
  it('unwraps { success, result } envelope before parsing CSV', () => {
    const csv = 'PRODUCT,SALES\nWidget,500\nGadget,750';
    const wrapped = orchestratorWrap(mcpText(csv));
    const result = extractDataFromToolResult(wrapped);
    expect(result).toHaveLength(2);
    expect(result![0]).toEqual({ PRODUCT: 'Widget', SALES: 500 });
  });

  it('unwraps envelope before parsing JSON array', () => {
    const json = JSON.stringify([{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]);
    const wrapped = orchestratorWrap(mcpText(json));
    const result = extractDataFromToolResult(wrapped);
    expect(result).toHaveLength(2);
    expect(result![0].name).toBe('Alice');
  });

  // ── JSON array ────────────────────────────────────────────────────────────
  it('parses JSON array of objects', () => {
    const json = JSON.stringify([
      { region: 'North', revenue: 12000 },
      { region: 'South', revenue: 9500 },
    ]);
    const result = extractDataFromToolResult(mcpText(json));
    expect(result).toHaveLength(2);
    expect(result![0].region).toBe('North');
  });

  // ── JSON with data key ────────────────────────────────────────────────────
  it('parses JSON object with "rows" key', () => {
    const json = JSON.stringify({ rows: [{ a: 1 }, { a: 2 }] });
    const result = extractDataFromToolResult(mcpText(json));
    expect(result).toHaveLength(2);
  });

  it('parses JSON object with "data" key', () => {
    const json = JSON.stringify({ data: [{ x: 'foo' }, { x: 'bar' }] });
    const result = extractDataFromToolResult(mcpText(json));
    expect(result).toHaveLength(2);
  });

  // ── SQLcl columnar format ─────────────────────────────────────────────────
  it('parses SQLcl columnar { columns, rows } format', () => {
    const json = JSON.stringify({
      columns: ['DEPT', 'HEADCOUNT', 'AVG_SALARY'],
      rows: [
        ['Engineering', '45', '95000'],
        ['Sales', '30', '72000'],
        ['Marketing', '20', '68000'],
      ],
    });
    const result = extractDataFromToolResult(mcpText(json));
    expect(result).toHaveLength(3);
    expect(result![0]).toEqual({ DEPT: 'Engineering', HEADCOUNT: 45, AVG_SALARY: 95000 });
    expect(result![1].DEPT).toBe('Sales');
  });

  it('keeps string values as strings in columnar format', () => {
    const json = JSON.stringify({
      columns: ['NAME', 'CODE'],
      rows: [['Alice', 'A001']],
    });
    const result = extractDataFromToolResult(mcpText(json));
    expect(result![0].NAME).toBe('Alice');
    expect(result![0].CODE).toBe('A001'); // not a number
  });
});

// ─── generateVisualization ────────────────────────────────────────────────────

const salesData = [
  { SALE_DATE: '2024-01-01', REVENUE: 15000, ORDERS: 42 },
  { SALE_DATE: '2024-01-02', REVENUE: 18500, ORDERS: 55 },
  { SALE_DATE: '2024-01-03', REVENUE: 12000, ORDERS: 38 },
  { SALE_DATE: '2024-01-04', REVENUE: 22000, ORDERS: 67 },
  { SALE_DATE: '2024-01-05', REVENUE: 19500, ORDERS: 59 },
];

const categoryData = [
  { CATEGORY: 'Electronics', SALES: 45000 },
  { CATEGORY: 'Clothing', SALES: 32000 },
  { CATEGORY: 'Food', SALES: 28000 },
  { CATEGORY: 'Books', SALES: 15000 },
];

describe('generateVisualization', () => {
  it('auto-detects and returns a valid visualization for sales data', async () => {
    const viz = await generateVisualization({ data: salesData, type: 'auto' });
    expect(viz.type).toBeTruthy();
    expect(viz.content).toBeTruthy();
  });

  it('generates bar chart with HTML string content', async () => {
    const viz = await generateVisualization({ data: categoryData, type: 'bar', title: 'Sales by Category' });
    expect(viz.type).toBe('bar_chart');
    expect(typeof viz.content).toBe('string');
    expect(viz.content as string).toContain('<!DOCTYPE html>');
    expect(viz.content as string).toContain('Sales by Category');
  });

  it('generates line chart for time-series data', async () => {
    const viz = await generateVisualization({ data: salesData, type: 'line', title: 'Revenue Trend' });
    expect(viz.type).toBe('line_chart');
    expect(typeof viz.content).toBe('string');
    expect(viz.content as string).toContain('<!DOCTYPE html>');
  });

  it('generates pie chart', async () => {
    const viz = await generateVisualization({ data: categoryData, type: 'pie', title: 'Category Share' });
    expect(viz.type).toBe('pie_chart');
    expect(typeof viz.content).toBe('string');
    expect(viz.content as string).toContain('<!DOCTYPE html>');
  });

  it('generates interactive HTML dashboard', async () => {
    const viz = await generateVisualization({ data: salesData, type: 'html', title: 'Sales Dashboard' });
    expect(viz.type).toBe('html');
    expect(typeof viz.content).toBe('string');
    const html = viz.content as string;
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Sales Dashboard');
    // Should have interactive elements
    expect(html).toContain('<script>');
  });

  it('generates table visualization', async () => {
    const viz = await generateVisualization({ data: salesData, type: 'table' });
    expect(viz.type).toBe('table');
    expect(typeof viz.content).toBe('string');
    expect(viz.content as string).toContain('<table');
  });

  it('html content can be set as visualization.html for SSE event', async () => {
    const viz = await generateVisualization({ data: salesData, type: 'html', title: 'Dashboard' });
    // Simulate what route.ts does
    const visualizationData: Record<string, unknown> = { type: viz.type, title: 'Dashboard' };
    if (typeof viz.content === 'string') {
      visualizationData.html = viz.content;
    } else if (typeof viz.content === 'object' && viz.content !== null) {
      Object.assign(visualizationData, viz.content);
    }
    expect(visualizationData.html).toBeTruthy();
    expect(typeof visualizationData.html).toBe('string');
  });
});

// ─── Full pipeline: extract → visualize ──────────────────────────────────────

describe('full pipeline: MCP result → extract → visualize', () => {
  it('handles CSV from MCP wrapped in orchestrator envelope', async () => {
    const csv = 'SALE_DATE,REVENUE,ORDERS\n2024-01-01,15000,42\n2024-01-02,18500,55\n2024-01-03,12000,38';
    const mcpResult = orchestratorWrap(mcpText(csv));

    const data = extractDataFromToolResult(mcpResult);
    expect(data).not.toBeNull();
    expect(data!.length).toBe(3);

    const viz = await generateVisualization({ data: data!, type: 'html', title: 'Sales Dashboard' });
    expect(viz.type).toBe('html');
    expect(typeof viz.content).toBe('string');
    expect((viz.content as string).length).toBeGreaterThan(100);
  });

  it('handles JSON array from MCP wrapped in orchestrator envelope', async () => {
    const rows = [
      { PRODUCT: 'Widget', REVENUE: 5000, UNITS: 100 },
      { PRODUCT: 'Gadget', REVENUE: 8000, UNITS: 160 },
      { PRODUCT: 'Doohickey', REVENUE: 3500, UNITS: 70 },
    ];
    const mcpResult = orchestratorWrap(mcpText(JSON.stringify(rows)));

    const data = extractDataFromToolResult(mcpResult);
    expect(data).toHaveLength(3);

    const viz = await generateVisualization({ data: data!, type: 'bar', title: 'Product Revenue' });
    expect(viz.type).toBe('bar_chart');
    expect(typeof viz.content).toBe('string');
  });

  it('handles SQLcl columnar format wrapped in orchestrator envelope', async () => {
    const columnar = {
      columns: ['REGION', 'TOTAL_SALES', 'AVG_ORDER'],
      rows: [
        ['North', '125000', '450'],
        ['South', '98000', '380'],
        ['East', '112000', '420'],
        ['West', '87000', '340'],
      ],
    };
    const mcpResult = orchestratorWrap(mcpText(JSON.stringify(columnar)));

    const data = extractDataFromToolResult(mcpResult);
    expect(data).toHaveLength(4);
    expect(data![0]).toEqual({ REGION: 'North', TOTAL_SALES: 125000, AVG_ORDER: 450 });

    const viz = await generateVisualization({ data: data!, type: 'bar', title: 'Regional Sales' });
    expect(viz.type).toBe('bar_chart');
    expect(typeof viz.content).toBe('string');
  });

  it('visualization SSE payload has html field for inline rendering', async () => {
    const csv = 'MONTH,REVENUE\nJan,10000\nFeb,12000\nMar,9500';
    const data = extractDataFromToolResult(orchestratorWrap(mcpText(csv)));
    expect(data).not.toBeNull();

    const viz = await generateVisualization({ data: data!, type: 'auto' });

    // Simulate route.ts SSE payload construction
    const visualizationData: Record<string, unknown> = { type: viz.type, title: 'Query Results' };
    if (typeof viz.content === 'string') {
      visualizationData.html = viz.content;
    } else if (typeof viz.content === 'object' && viz.content !== null) {
      Object.assign(visualizationData, viz.content);
    }

    // shouldRouteToArtifacts returns false when html is present → stays inline
    const hasHtml = typeof visualizationData.html === 'string' && (visualizationData.html as string).length > 0;
    expect(hasHtml).toBe(true);
  });
});
