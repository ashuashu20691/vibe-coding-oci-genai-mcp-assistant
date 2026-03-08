'use client';

import { useMemo } from 'react';
import { OutputType } from '@/types';
import { Chart } from './Chart';
import { DataTable } from './DataTable';
import { DashboardRenderer } from './DashboardRenderer';
import { MapRenderer } from './MapRenderer';
import { MermaidDiagram } from './MermaidDiagram';
import { PhotoGalleryRenderer } from './PhotoGalleryRenderer';
import { TimelineRenderer } from './TimelineRenderer';

export interface OutputRendererProps {
  data: unknown;
  outputType?: OutputType;
  title?: string;
}

// Column name patterns for geographic data detection
const LAT_PATTERNS = ['lat', 'latitude', 'lat_col', 'y', 'geo_lat', 'location_lat', 'start_lat', 'end_lat'];
const LON_PATTERNS = ['lon', 'lng', 'longitude', 'lon_col', 'long', 'x', 'geo_lon', 'geo_lng', 'location_lon', 'location_lng', 'start_lon', 'start_lng', 'end_lon', 'end_lng'];

// Column name patterns for time/date detection
const TIME_PATTERNS = ['date', 'time', 'timestamp', 'datetime', 'created', 'updated', 'created_at', 'updated_at', 'day', 'month', 'year', 'period', 'quarter', 'week'];

// Column name patterns for categorical data detection
const CATEGORY_PATTERNS = ['category', 'type', 'status', 'name', 'label', 'group', 'class', 'kind', 'region', 'country', 'city', 'state', 'department', 'product', 'brand', 'segment'];

/**
 * Robustly parses input data. Now that visualization-agent returns objects directly,
 * this mainly handles backward compatibility with any legacy string-based data.
 */
function cleanAndParse(input: unknown): unknown {
  // If it's not a string, return as is (this is the common case now)
  if (typeof input !== 'string') return input;

  // Try direct parse for JSON strings
  try {
    const parsed = JSON.parse(input);
    // Recursively parse if the result is still a string (double-encoded)
    if (typeof parsed === 'string') {
      return cleanAndParse(parsed);
    }
    return parsed;
  } catch (e) {
    // If parse fails, return the original string (might be plain text)
    return input;
  }
}

/**
 * Detect appropriate output types for the given data.
 * Returns a list of suggested OutputType values, ordered by relevance.
 * 
 * Detection priority:
 * 1. Geographic data (lat/lon columns) → map
 * 2. Time series (date/time columns with numeric values) → line_chart
 * 3. Categorical data (string columns with numeric values) → bar_chart
 * 4. Tabular data → table
 */
export function detectOutputType(data: unknown): OutputType[] {
  const suggestions: OutputType[] = [];

  // Always suggest table for any structured data
  suggestions.push('table');

  // Handle string data
  if (typeof data === 'string') {
    if (isMermaidSyntax(data)) {
      suggestions.unshift('mermaid');
    } else {
      suggestions.unshift('text');
    }
    return suggestions;
  }

  // Handle non-array data - check for analysis dashboard structure
  if (!Array.isArray(data)) {
    // Check for analysis_dashboard structure (DashboardLayout)
    if (isAnalysisDashboard(data)) {
      suggestions.unshift('analysis_dashboard');
      return suggestions;
    }
    suggestions.unshift('text');
    return suggestions;
  }

  // Empty array - just table
  if (data.length === 0) {
    return suggestions;
  }

  // Check if it's an array of objects (tabular data)
  if (typeof data[0] !== 'object' || data[0] === null) {
    suggestions.unshift('text');
    return suggestions;
  }

  const columns = Object.keys(data[0] as Record<string, unknown>);
  const columnsLower = columns.map(c => c.toLowerCase());

  // Check for photo gallery (image URLs with similarity scores)
  const hasImageUrl = columnsLower.some(c =>
    c.includes('url') || c.includes('image') || c.includes('photo') || c.includes('img')
  );
  const hasSimilarity = columnsLower.some(c =>
    c.includes('similarity') || c.includes('score')
  );
  if (hasImageUrl && hasSimilarity) {
    suggestions.unshift('photo_gallery');
  }

  // 1. Check for geographic columns (highest priority for map)
  if (hasGeographicColumns(columns)) {
    suggestions.unshift('map');
    return suggestions; // Map is definitive for geographic data
  }

  // Get numeric columns for chart detection
  const numericColumns = getNumericColumns(data as Record<string, unknown>[]);

  // 2. Check for time series data (date/time columns with numeric values)
  if (hasTimeSeriesData(columns, numericColumns, data as Record<string, unknown>[])) {
    suggestions.unshift('line_chart');
    
    // Also suggest bar chart as alternative for time series
    if (!suggestions.includes('bar_chart')) {
      suggestions.push('bar_chart');
    }
    
    // Add scatter chart if multiple numeric columns
    if (numericColumns.length >= 2 && !suggestions.includes('scatter_chart')) {
      suggestions.push('scatter_chart');
    }
    
    // Add pie chart for small datasets
    if (data.length <= 10 && !suggestions.includes('pie_chart')) {
      suggestions.push('pie_chart');
    }
    
    return suggestions;
  }

  // 3. Check for categorical data (string columns with numeric values)
  if (hasCategoricalData(columns, numericColumns, data as Record<string, unknown>[])) {
    suggestions.unshift('bar_chart');
    
    // Add pie chart for small categorical datasets
    if (data.length <= 10 && !suggestions.includes('pie_chart')) {
      suggestions.push('pie_chart');
    }
    
    // Add scatter chart if multiple numeric columns
    if (numericColumns.length >= 2 && !suggestions.includes('scatter_chart')) {
      suggestions.push('scatter_chart');
    }
    
    return suggestions;
  }

  // Check for timeline data (date field with multiple records)
  const hasDateField = columns.some(c => {
    const cLower = c.toLowerCase();
    return cLower.includes('date') || cLower.includes('time') || cLower === 'year';
  });
  if (hasDateField && data.length > 5) {
    suggestions.push('timeline');
  }

  // Fallback chart detection for numeric data
  if (numericColumns.length >= 1) {
    // Small datasets work well with pie charts
    if (data.length <= 10 && numericColumns.length >= 1) {
      suggestions.push('pie_chart');
    }

    // Multiple numeric columns suggest scatter plots
    if (numericColumns.length >= 2) {
      suggestions.push('scatter_chart');
    }

    // Check if there's potential time series or ordered data
    if (hasOrderedData(data as Record<string, unknown>[])) {
      suggestions.splice(1, 0, 'line_chart');
    } else {
      suggestions.splice(1, 0, 'bar_chart');
    }
  }

  return suggestions;
}

/**
 * Check if text appears to be Mermaid diagram syntax.
 */
export function isMermaidSyntax(text: string): boolean {
  if (!text) return false;

  const textLower = text.trim().toLowerCase();
  const mermaidKeywords = [
    'graph ',
    'graph\n',
    'flowchart ',
    'flowchart\n',
    'sequencediagram',
    'sequence diagram',
    'classdiagram',
    'class diagram',
    'statediagram',
    'state diagram',
    'erdiagram',
    'er diagram',
    'gantt',
    'pie',
    'gitgraph',
  ];

  // Check for mermaid code block
  if (textLower.includes('```mermaid')) {
    return true;
  }

  // Check for mermaid keywords at start
  for (const keyword of mermaidKeywords) {
    if (textLower.startsWith(keyword.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Check if data is an analysis dashboard structure (DashboardLayout).
 * Analysis dashboards have title, sections array, and filters array.
 */
export function isAnalysisDashboard(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false;
  
  const obj = data as Record<string, unknown>;
  
  // Check for DashboardLayout structure
  const hasTitle = typeof obj.title === 'string';
  const hasSections = Array.isArray(obj.sections);
  const hasFilters = Array.isArray(obj.filters);
  
  // Must have title and sections at minimum
  if (!hasTitle || !hasSections) return false;
  
  // Validate sections structure if present
  if (hasSections && obj.sections && (obj.sections as unknown[]).length > 0) {
    const firstSection = (obj.sections as Record<string, unknown>[])[0];
    const hasValidSection = 
      typeof firstSection.id === 'string' &&
      typeof firstSection.type === 'string' &&
      ['stats', 'visualization', 'table', 'insights'].includes(firstSection.type as string);
    
    if (!hasValidSection) return false;
  }
  
  return hasFilters || hasSections;
}

/**
 * Check if columns include geographic (lat/lon) columns.
 * Exported for testing purposes.
 */
export function hasGeographicColumns(columns: string[]): boolean {
  const columnsLower = columns.map(c => c.toLowerCase());

  const hasLat = LAT_PATTERNS.some(pattern => columnsLower.includes(pattern));
  const hasLon = LON_PATTERNS.some(pattern => columnsLower.includes(pattern));

  return hasLat && hasLon;
}

/**
 * Check if data represents time series (date/time column with numeric values).
 * Time series data is characterized by:
 * - A column that contains date/time values
 * - At least one numeric column for the values
 * - Multiple data points (at least 2)
 * Exported for testing purposes.
 */
export function hasTimeSeriesData(
  columns: string[],
  numericColumns: string[],
  data: Record<string, unknown>[]
): boolean {
  if (data.length < 2 || numericColumns.length === 0) return false;

  const columnsLower = columns.map(c => c.toLowerCase());

  // Check for time-related column names
  const hasTimeColumn = columnsLower.some(col => 
    TIME_PATTERNS.some(pattern => col.includes(pattern))
  );

  if (hasTimeColumn) {
    return true;
  }

  // Also check for date-like values in columns
  for (const col of columns) {
    const firstVal = data[0][col];
    if (typeof firstVal === 'string') {
      // Check if it looks like a date (YYYY-MM-DD, MM/DD/YYYY, etc.)
      const datePattern = /^\d{4}-\d{2}-\d{2}|^\d{1,2}\/\d{1,2}\/\d{2,4}|^\d{1,2}-\d{1,2}-\d{2,4}|^\d{1,2}-[A-Za-z]{3}-\d{2,4}/;
      if (datePattern.test(firstVal)) {
        return true;
      }
      
      // Check for ISO date format
      const isoDatePattern = /^\d{4}-\d{2}-\d{2}T/;
      if (isoDatePattern.test(firstVal)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if data represents categorical data (string categories with numeric values).
 * Categorical data is characterized by:
 * - A column with string/categorical values (limited unique values)
 * - At least one numeric column for the values
 * - The categorical column should have fewer unique values than total rows (grouping)
 * Exported for testing purposes.
 */
export function hasCategoricalData(
  columns: string[],
  numericColumns: string[],
  data: Record<string, unknown>[]
): boolean {
  if (data.length === 0 || numericColumns.length === 0) return false;

  const columnsLower = columns.map(c => c.toLowerCase());

  // Check for category-related column names
  const hasCategoryColumn = columnsLower.some(col =>
    CATEGORY_PATTERNS.some(pattern => col.includes(pattern))
  );

  if (hasCategoryColumn) {
    return true;
  }

  // Check for string columns that could be categories
  const stringColumns = columns.filter(col => !numericColumns.includes(col));
  
  for (const col of stringColumns) {
    // Get unique values in this column
    const uniqueValues = new Set<string>();
    let isStringColumn = true;
    
    for (const row of data) {
      const val = row[col];
      if (typeof val === 'string') {
        uniqueValues.add(val);
      } else if (val !== null && val !== undefined) {
        isStringColumn = false;
        break;
      }
    }

    // If it's a string column with limited unique values (less than 80% of rows),
    // it's likely categorical data
    if (isStringColumn && uniqueValues.size > 0 && uniqueValues.size < data.length * 0.8) {
      return true;
    }
  }

  return false;
}

/**
 * Get numeric columns from data array.
 * Exported for testing purposes.
 */
export function getNumericColumns(data: Record<string, unknown>[]): string[] {
  if (data.length === 0) return [];

  const firstRow = data[0];
  const columns = Object.keys(firstRow);

  return columns.filter(col => {
    // Check if most values in this column are numeric
    let numericCount = 0;

    for (const row of data) {
      const val = row[col];
      if (typeof val === 'number' && !isNaN(val)) {
        numericCount++;
      } else if (typeof val === 'string' && val.trim() !== '' && !isNaN(parseFloat(val)) && isFinite(Number(val))) {
        numericCount++;
      }
    }

    // At least 50% numeric
    return numericCount >= data.length * 0.5;
  });
}

/**
 * Check if data has ordered/sequential characteristics (dates, sequential numbers).
 */
function hasOrderedData(data: Record<string, unknown>[]): boolean {
  if (data.length < 2) return false;

  const columns = Object.keys(data[0]);

  // Check for date-like columns
  for (const col of columns) {
    const firstVal = data[0][col];
    if (typeof firstVal === 'string') {
      // Check if it looks like a date (YYYY-MM-DD, MM/DD/YYYY, DD-MM-YY, DD-MM-YY)
      const datePattern = /^\d{4}-\d{2}-\d{2}|^\d{1,2}\/\d{1,2}\/\d{2,4}|^\d{1,2}-\d{1,2}-\d{2,4}|^\d{1,2}-[A-Za-z]{3}-\d{2,4}/;
      if (datePattern.test(firstVal)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Auto-detect x and y columns for charting.
 */
function autoDetectChartColumns(
  data: Record<string, unknown>[],
  config?: { xColumn?: string; yColumn?: string }
): { xColumn: string | null; yColumn: string | null } {
  if (data.length === 0) return { xColumn: null, yColumn: null };

  let xColumn = config?.xColumn || null;
  let yColumn = config?.yColumn || null;

  const columns = Object.keys(data[0]);
  const numericColumns = getNumericColumns(data);
  const nonNumericColumns = columns.filter(c => !numericColumns.includes(c));

  // If x not specified, use first non-numeric column
  if (!xColumn) {
    if (nonNumericColumns.length > 0) {
      xColumn = nonNumericColumns[0];
    } else if (numericColumns.length >= 2) {
      xColumn = numericColumns[0];
    }
  }

  // If y not specified, use first numeric column (excluding x)
  if (!yColumn) {
    const availableNumeric = numericColumns.filter(c => c !== xColumn);
    if (availableNumeric.length > 0) {
      yColumn = availableNumeric[0];
    } else if (numericColumns.length > 0) {
      yColumn = numericColumns[0];
    }
  }

  return { xColumn, yColumn };
}

/**
 * OutputRenderer component that renders data in various formats.
 * Supports tables, charts (bar, line, pie, scatter), mermaid diagrams, and custom dashboards.
 */
export function OutputRenderer({ data, outputType, title }: OutputRendererProps) {
  // 1. Robust Parse: handle strings, code blocks, double-encoding
  const parsedData = useMemo(() => cleanAndParse(data), [data]);

  // 2. Identify if it's a Visualization Object ({ type, data, title })
  const isVizObject = useMemo(() => {
    const obj = parsedData as any;
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'type' in obj &&
      'data' in obj
    );
  }, [parsedData]);

  // 3. Determine Effective Data, Type, Title
  const { effectiveData, effectiveType, effectiveTitle } = useMemo(() => {
    let eData = parsedData;
    let eType = outputType;
    let eTitle = title;

    if (isVizObject) {
      const obj = parsedData as any;
      // Unpack the envelope
      eData = obj.data;

      if (!eType) {
        eType = obj.type as OutputType;
      }

      if (!eTitle && typeof obj.title === 'string') {
        eTitle = obj.title;
      }
    }

    // Auto-detect if type missing
    if (!eType || eType === 'auto') {
      const suggestions = detectOutputType(eData);
      eType = suggestions[0] || 'text';
    }

    return { effectiveData: eData, effectiveType: eType, effectiveTitle: eTitle };
  }, [parsedData, isVizObject, outputType, title]);

  // Handle custom dashboard output
  if (effectiveType === 'custom_dashboard') {
    return (
      <DashboardRenderer config={effectiveData as any} />
    );
  }

  // Handle analysis dashboard output (DashboardLayout from analysis workflow)
  if (effectiveType === 'analysis_dashboard') {
    const dashboardLayout = effectiveData as {
      title: string;
      description?: string;
      sections: Array<{
        id: string;
        title: string;
        type: 'stats' | 'visualization' | 'table' | 'insights';
        width: 'full' | 'half' | 'third';
        content: {
          visualization?: { type: string; title: string; dataKey: string; config: Record<string, unknown> };
          statsCards?: Array<{ label: string; value: string | number; color: string }>;
          insights?: string[];
          tableConfig?: { columns: string[]; pageSize: number };
        };
      }>;
      filters?: Array<{ id: string; label: string; type: string; column: string }>;
      exportOptions?: Array<{ format: string; label: string }>;
    };

    return (
      <div className="analysis-dashboard space-y-6">
        {/* Dashboard Header */}
        <div className="dashboard-header p-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg text-white">
          <h2 className="text-2xl font-bold">{dashboardLayout.title}</h2>
          {dashboardLayout.description && (
            <p className="text-blue-100 mt-1">{dashboardLayout.description}</p>
          )}
        </div>

        {/* Dashboard Sections - Uses responsive classes for mobile stacking */}
        <div className="dashboard-sections grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboardLayout.sections.map((section) => (
            <div
              key={section.id}
              className={`dashboard-section bg-white rounded-lg shadow p-4 ${
                section.width === 'full' ? 'col-span-full' : 
                section.width === 'half' ? 'md:col-span-1 lg:col-span-1' : 
                section.width === 'third' ? 'md:col-span-1 lg:col-span-1' : 'col-span-full'
              }`}
            >
              <h3 className="text-lg font-semibold mb-3 text-gray-800">{section.title}</h3>
              
              {/* Stats Cards */}
              {section.type === 'stats' && section.content.statsCards && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {section.content.statsCards.map((card, idx) => (
                    <div
                      key={idx}
                      className={`stat-card p-4 rounded-lg ${
                        card.color === 'blue' ? 'bg-blue-50 border-l-4 border-blue-500' :
                        card.color === 'green' ? 'bg-green-50 border-l-4 border-green-500' :
                        card.color === 'red' ? 'bg-red-50 border-l-4 border-red-500' :
                        card.color === 'orange' ? 'bg-orange-50 border-l-4 border-orange-500' :
                        'bg-gray-50 border-l-4 border-gray-500'
                      }`}
                    >
                      <div className="text-sm text-gray-600">{card.label}</div>
                      <div className="text-2xl font-bold text-gray-900">{card.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Insights */}
              {section.type === 'insights' && section.content.insights && (
                <ul className="space-y-2">
                  {section.content.insights.map((insight, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-gray-700">
                      <span className="text-lg">{insight.charAt(0)}</span>
                      <span>{insight.slice(1).trim()}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Visualization placeholder - route to appropriate renderer */}
              {section.type === 'visualization' && section.content.visualization && (
                <div className="visualization-container">
                  <OutputRenderer
                    data={section.content.visualization}
                    outputType={section.content.visualization.type as OutputType}
                    title={section.content.visualization.title}
                  />
                </div>
              )}

              {/* Table placeholder */}
              {section.type === 'table' && section.content.tableConfig && (
                <div className="text-gray-500 text-center py-8">
                  Data table will be rendered here
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Export Options */}
        {dashboardLayout.exportOptions && dashboardLayout.exportOptions.length > 0 && (
          <div className="export-options flex gap-2 justify-end">
            {dashboardLayout.exportOptions.map((option) => (
              <button
                key={option.format}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm text-gray-700"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Handle text output
  if (effectiveType === 'text') {
    return (
      <div className="output-text p-4 bg-gray-50 rounded-lg">
        <pre className="whitespace-pre-wrap text-sm text-gray-800">
          {typeof effectiveData === 'string' ? effectiveData : JSON.stringify(effectiveData, null, 2)}
        </pre>
      </div>
    );
  }

  // Handle mermaid diagrams
  if (effectiveType === 'mermaid') {
    return <MermaidDiagram code={typeof effectiveData === 'string' ? effectiveData : ''} />;
  }

  // Handle table output
  if (effectiveType === 'table') {
    const tableData = Array.isArray(effectiveData) ? effectiveData : [];
    if (tableData.length === 0) {
      return (
        <div className="output-empty">
          No data to display
        </div>
      );
    }
    return <DataTable data={tableData as Record<string, unknown>[]} title={effectiveTitle} />;
  }

  // Handle chart outputs
  if (['bar_chart', 'line_chart', 'pie_chart', 'scatter_chart', 'area_chart'].includes(effectiveType)) {
    const chartData = Array.isArray(effectiveData) ? effectiveData : [];
    if (chartData.length === 0) {
      return (
        <div className="output-empty">
          No data to display
        </div>
      );
    }

    const typedChartData = chartData as Record<string, unknown>[];
    const { xColumn, yColumn } = autoDetectChartColumns(typedChartData);

    if (!xColumn || !yColumn) {
      // Fallback to table if we can't determine chart columns
      return <DataTable data={typedChartData} title={effectiveTitle} />;
    }

    return (
      <Chart
        data={typedChartData}
        type={effectiveType as 'bar_chart' | 'line_chart' | 'pie_chart' | 'scatter_chart' | 'area_chart'}
        xColumn={xColumn}
        yColumn={yColumn}
        title={effectiveTitle}
      />
    );
  }

  // Handle map output
  if (effectiveType === 'map') {
    const mapData = Array.isArray(effectiveData) ? effectiveData : [];
    if (mapData.length === 0) {
      return (
        <div className="output-empty">
          No data to display
        </div>
      );
    }
    return <MapRenderer data={mapData as Record<string, unknown>[]} title={effectiveTitle} />;
  }

  // Handle photo gallery output
  if (effectiveType === 'photo_gallery') {
    const galleryData = Array.isArray(effectiveData) ? effectiveData : [];
    if (galleryData.length === 0) {
      return (
        <div className="photo-gallery-empty">
          No images to display
        </div>
      );
    }
    return <PhotoGalleryRenderer data={galleryData as Record<string, unknown>[]} title={effectiveTitle} />;
  }

  // Handle timeline output
  if (effectiveType === 'timeline') {
    const timeData = Array.isArray(effectiveData) ? effectiveData : [];
    if (timeData.length === 0) {
      return (
        <div className="timeline-empty">
          No timeline data to display
        </div>
      );
    }
    return <TimelineRenderer data={timeData as Record<string, unknown>[]} title={effectiveTitle} />;
  }

  // Default fallback
  return (
    <div className="output-fallback p-4 bg-gray-50 rounded-lg">
      <pre className="whitespace-pre-wrap text-sm text-gray-800">
        {JSON.stringify(effectiveData, null, 2)}
      </pre>
    </div>
  );
}
