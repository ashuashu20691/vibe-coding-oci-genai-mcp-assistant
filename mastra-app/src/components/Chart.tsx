'use client';

import { useMemo, useState, useRef, useCallback } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  ScatterChart,
  Scatter,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { FullscreenOverlay, FullscreenButton } from './FullscreenOverlay';
import { ExportDropdown, ExportIcons, ExportFormat } from './ExportDropdown';
import { ExportService } from '@/services/export-service';

export type ChartType = 'bar_chart' | 'line_chart' | 'pie_chart' | 'scatter_chart' | 'area_chart';

export interface ChartProps {
  data: Record<string, unknown>[];
  type: ChartType;
  xColumn: string;
  yColumn: string;
  colorColumn?: string;
  title?: string;
  fullscreenEnabled?: boolean;
  exportEnabled?: boolean;
}

// Consistent color palette for all chart types
const COLORS = [
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#06B6D4', // cyan-500
  '#84CC16', // lime-500
  '#F97316', // orange-500
  '#6366F1', // indigo-500
];

// Consistent chart styling configuration
const CHART_STYLES = {
  grid: {
    strokeDasharray: '3 3',
    stroke: '#E5E7EB',
  },
  axis: {
    tick: { fontSize: 12, fill: '#6B7280' },
    axisLine: { stroke: '#D1D5DB' },
    tickLine: { stroke: '#D1D5DB' },
  },
  tooltip: {
    contentStyle: {
      backgroundColor: '#fff',
      border: '1px solid #E5E7EB',
      borderRadius: '8px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      padding: '8px 12px',
    },
    labelStyle: {
      fontWeight: 600,
      marginBottom: '4px',
    },
  },
  margin: { top: 20, right: 30, left: 20, bottom: 60 },
  pieMargin: { top: 20, right: 30, left: 20, bottom: 20 },
};

/**
 * Chart component that renders various chart types using Recharts.
 * Supports bar, line, pie, scatter, and area charts with consistent styling.
 */
export function Chart({ data, type, xColumn, yColumn, colorColumn, title, fullscreenEnabled = true, exportEnabled = true }: ChartProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [zoomDomain, setZoomDomain] = useState<{ x?: [number, number]; y?: [number, number] } | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Export handler for PNG export
  const handleExport = useCallback(async (format: ExportFormat) => {
    if (format === 'png' && chartContainerRef.current) {
      const chartElement = chartContainerRef.current.querySelector('.recharts-wrapper') as HTMLElement;
      if (chartElement) {
        const filename = `${title || type.replace('_', '-')}-${new Date().toISOString().split('T')[0]}.png`;
        await ExportService.exportToPNG(chartElement, filename, {
          backgroundColor: '#ffffff',
          scale: 2,
          padding: 20,
        });
      }
    }
  }, [title, type]);

  // Reset zoom handler (Requirement 5.8)
  const handleResetZoom = useCallback(() => {
    setZoomDomain(null);
  }, []);

  // Toggle legend handler (Requirement 5.8)
  const handleToggleLegend = useCallback(() => {
    setShowLegend(prev => !prev);
  }, []);

  // Export options for charts (PNG only)
  const exportOptions = [
    {
      format: 'png' as ExportFormat,
      label: 'Export as PNG',
      icon: ExportIcons.png,
      description: 'Download chart as image',
    },
  ];
  // Process data for charting
  const chartData = useMemo(() => {
    // Add data structure validation before processing
    if (!data || !Array.isArray(data) || data.length === 0) {
      return [];
    }
    
    return data.map((row, index) => {
      // Validate row is an object
      if (!row || typeof row !== 'object') {
        return { _index: index };
      }
      
      return {
        ...row,
        _index: index,
        [xColumn]: row[xColumn],
        [yColumn]: typeof row[yColumn] === 'number' ? row[yColumn] : parseFloat(String(row[yColumn])) || 0,
      };
    });
  }, [data, xColumn, yColumn]);

  // Get unique color values if colorColumn is specified
  const colorValues = useMemo(() => {
    if (!colorColumn || !data || !Array.isArray(data)) return [];
    const values = new Set(data.map(row => row && row[colorColumn] ? String(row[colorColumn]) : ''));
    return Array.from(values);
  }, [data, colorColumn]);

  // Handle empty data
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="chart-empty">
        <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-sm font-medium">No data to display</p>
        <p className="text-xs mt-1">Add data to see the chart</p>
      </div>
    );
  }

  // Handle single data point - show a message for chart types that need multiple points
  if (data.length === 1 && (type === 'line_chart' || type === 'area_chart' || type === 'scatter_chart')) {
    return (
      <div className="chart-single-point p-8 text-gray-500 text-center border border-dashed border-gray-300 rounded-lg bg-gray-50">
        <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm font-medium">Single data point</p>
        <p className="text-xs text-gray-400 mt-1">
          {type === 'line_chart' ? 'Line charts' : type === 'area_chart' ? 'Area charts' : 'Scatter charts'} require at least 2 data points
        </p>
        <div className="mt-4 p-3 bg-white rounded border text-left">
          <p className="text-xs text-gray-600">
            <span className="font-medium">{xColumn}:</span> {String((chartData[0] as any)[xColumn])}
          </p>
          <p className="text-xs text-gray-600">
            <span className="font-medium">{yColumn}:</span> {String((chartData[0] as any)[yColumn])}
          </p>
        </div>
      </div>
    );
  }

  const renderChart = () => {
    switch (type) {
      case 'bar_chart':
        return (
          <BarChart data={chartData} margin={CHART_STYLES.margin}>
            <CartesianGrid {...CHART_STYLES.grid} />
            <XAxis
              dataKey={xColumn}
              tick={CHART_STYLES.axis.tick}
              axisLine={CHART_STYLES.axis.axisLine}
              tickLine={CHART_STYLES.axis.tickLine}
              angle={-45}
              textAnchor="end"
              height={60}
              domain={zoomDomain?.x}
            />
            <YAxis
              tick={CHART_STYLES.axis.tick}
              axisLine={CHART_STYLES.axis.axisLine}
              tickLine={CHART_STYLES.axis.tickLine}
              domain={zoomDomain?.y}
            />
            <Tooltip {...CHART_STYLES.tooltip} />
            {showLegend && <Legend wrapperStyle={{ paddingTop: '20px' }} />}
            <Bar dataKey={yColumn} fill={COLORS[0]} radius={[4, 4, 0, 0]} name={yColumn}>
              {colorColumn && colorValues.length > 0 && chartData.map((entry, index) => {
                const colorIndex = colorValues.indexOf(String((entry as any)[colorColumn]));
                return (
                  <Cell key={`cell-${index}`} fill={COLORS[colorIndex >= 0 ? colorIndex % COLORS.length : 0]} />
                );
              })}
            </Bar>
          </BarChart>
        );

      case 'line_chart':
        return (
          <LineChart data={chartData} margin={CHART_STYLES.margin}>
            <CartesianGrid {...CHART_STYLES.grid} />
            <XAxis
              dataKey={xColumn}
              tick={CHART_STYLES.axis.tick}
              axisLine={CHART_STYLES.axis.axisLine}
              tickLine={CHART_STYLES.axis.tickLine}
              angle={-45}
              textAnchor="end"
              height={60}
              domain={zoomDomain?.x}
            />
            <YAxis
              tick={CHART_STYLES.axis.tick}
              axisLine={CHART_STYLES.axis.axisLine}
              tickLine={CHART_STYLES.axis.tickLine}
              domain={zoomDomain?.y}
            />
            <Tooltip {...CHART_STYLES.tooltip} />
            {showLegend && <Legend wrapperStyle={{ paddingTop: '20px' }} />}
            <Line
              type="monotone"
              dataKey={yColumn}
              stroke={COLORS[0]}
              strokeWidth={2}
              dot={{ fill: COLORS[0], strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: COLORS[0], strokeWidth: 2, fill: '#fff' }}
              name={yColumn}
            />
          </LineChart>
        );

      case 'area_chart':
        return (
          <AreaChart data={chartData} margin={CHART_STYLES.margin}>
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid {...CHART_STYLES.grid} />
            <XAxis
              dataKey={xColumn}
              tick={CHART_STYLES.axis.tick}
              axisLine={CHART_STYLES.axis.axisLine}
              tickLine={CHART_STYLES.axis.tickLine}
              angle={-45}
              textAnchor="end"
              height={60}
              domain={zoomDomain?.x}
            />
            <YAxis
              tick={CHART_STYLES.axis.tick}
              axisLine={CHART_STYLES.axis.axisLine}
              tickLine={CHART_STYLES.axis.tickLine}
              domain={zoomDomain?.y}
            />
            <Tooltip {...CHART_STYLES.tooltip} />
            {showLegend && <Legend wrapperStyle={{ paddingTop: '20px' }} />}
            <Area
              type="monotone"
              dataKey={yColumn}
              stroke={COLORS[0]}
              strokeWidth={2}
              fill="url(#areaGradient)"
              dot={{ fill: COLORS[0], strokeWidth: 2, r: 3 }}
              activeDot={{ r: 6, stroke: COLORS[0], strokeWidth: 2, fill: '#fff' }}
              name={yColumn}
            />
          </AreaChart>
        );

      case 'pie_chart':
        return (
          <PieChart margin={CHART_STYLES.pieMargin}>
            <Pie
              data={chartData}
              dataKey={yColumn}
              nameKey={xColumn}
              cx="50%"
              cy="50%"
              outerRadius={120}
              innerRadius={0}
              paddingAngle={1}
              label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
              labelLine={{ stroke: '#6B7280', strokeWidth: 1 }}
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip {...CHART_STYLES.tooltip} />
            {showLegend && <Legend wrapperStyle={{ paddingTop: '10px' }} />}
          </PieChart>
        );

      case 'scatter_chart':
        return (
          <ScatterChart margin={CHART_STYLES.margin}>
            <CartesianGrid {...CHART_STYLES.grid} />
            <XAxis
              dataKey={xColumn}
              type="number"
              tick={CHART_STYLES.axis.tick}
              axisLine={CHART_STYLES.axis.axisLine}
              tickLine={CHART_STYLES.axis.tickLine}
              name={xColumn}
              domain={zoomDomain?.x}
            />
            <YAxis
              dataKey={yColumn}
              type="number"
              tick={CHART_STYLES.axis.tick}
              axisLine={CHART_STYLES.axis.axisLine}
              tickLine={CHART_STYLES.axis.tickLine}
              name={yColumn}
              domain={zoomDomain?.y}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              {...CHART_STYLES.tooltip}
            />
            {showLegend && <Legend wrapperStyle={{ paddingTop: '20px' }} />}
            <Scatter
              name={`${xColumn} vs ${yColumn}`}
              data={chartData}
              fill={COLORS[0]}
            >
              {colorColumn && colorValues.length > 0 && chartData.map((entry, index) => {
                const colorIndex = colorValues.indexOf(String((entry as any)[colorColumn]));
                return (
                  <Cell key={`cell-${index}`} fill={COLORS[colorIndex >= 0 ? colorIndex % COLORS.length : 0]} />
                );
              })}
            </Scatter>
          </ScatterChart>
        );

      default:
        return null;
    }
  };

  const renderedChart = renderChart();

  // Handle unsupported chart type
  if (!renderedChart) {
    return (
      <div className="chart-unsupported p-8 text-gray-500 text-center border border-dashed border-gray-300 rounded-lg bg-gray-50">
        <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-sm font-medium">Unsupported chart type: {type}</p>
        <p className="text-xs text-gray-400 mt-1">Supported types: bar, line, pie, scatter, area</p>
      </div>
    );
  }

  return (
    <div className="chart-container bg-white rounded-lg p-4" ref={chartContainerRef}>
      <div className="flex items-center justify-between mb-4">
        {title && (
          <h3 className="text-lg font-semibold text-gray-800">
            {title}
          </h3>
        )}
        {!title && <div />}
        <div className="flex items-center gap-2">
          {/* Chart Controls (Requirement 5.8) */}
          <div className="flex items-center gap-1 mr-2 border-r border-gray-200 pr-2">
            <button
              onClick={handleToggleLegend}
              className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${
                showLegend ? 'text-blue-600' : 'text-gray-400'
              }`}
              title={showLegend ? 'Hide legend' : 'Show legend'}
              aria-label={showLegend ? 'Hide legend' : 'Show legend'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {zoomDomain && (
              <button
                onClick={handleResetZoom}
                className="p-1.5 rounded hover:bg-gray-100 transition-colors text-gray-600"
                title="Reset zoom"
                aria-label="Reset zoom"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                </svg>
              </button>
            )}
          </div>
          {exportEnabled && data.length > 0 && (
            <ExportDropdown
              options={exportOptions}
              onExport={handleExport}
            />
          )}
          {fullscreenEnabled && (
            <FullscreenButton onClick={() => setIsFullscreen(true)} />
          )}
        </div>
      </div>
      <div className="w-full h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          {renderedChart}
        </ResponsiveContainer>
      </div>

      {/* Fullscreen overlay */}
      <FullscreenOverlay
        isOpen={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        title={title || `${type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`}
      >
        <div className="w-full h-full p-6">
          {title && (
            <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">
              {title}
            </h3>
          )}
          <div className="w-full" style={{ height: 'calc(100% - 60px)' }}>
            <ResponsiveContainer width="100%" height="100%">
              {renderedChart}
            </ResponsiveContainer>
          </div>
        </div>
      </FullscreenOverlay>
    </div>
  );
}
