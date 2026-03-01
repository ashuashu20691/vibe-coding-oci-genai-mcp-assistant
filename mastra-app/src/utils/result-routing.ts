// src/utils/result-routing.ts

import { MAX_INLINE_ROWS } from '@/types';
import type { Message } from '@/types';

/**
 * Result routing logic for tool outputs
 * Validates: Requirements 15.2, 15.3, 15.4, 15.5, 18.7
 */

/**
 * Determines if a visualization should be routed to the artifacts panel
 * 
 * Routing rules:
 * - Visual outputs (charts, maps, diagrams) → Always route to artifacts panel
 * - Tables with > MAX_INLINE_ROWS → Route to artifacts panel
 * - Small tables (≤ MAX_INLINE_ROWS) → Display inline in chat
 * - Textual results → Display inline in chat
 * 
 * @param visualization - The visualization object from a message
 * @returns true if should route to artifacts panel, false if should display inline
 */
export function shouldRouteToArtifacts(visualization: Message['visualization']): boolean {
  if (!visualization) return false;
  
  // Visual outputs always go to artifacts panel (Requirement 15.2, 18.7)
  const visualTypes = [
    'bar_chart',
    'line_chart', 
    'pie_chart',
    'scatter_chart',
    'area_chart',
    'map',
    'heat_map',
    'photo_gallery',
    'timeline',
    'mermaid',
    'custom_dashboard',
    'analysis_dashboard'
  ];
  
  if (visualTypes.includes(visualization.type)) {
    return true;
  }
  
  // Tables with more than MAX_INLINE_ROWS go to artifacts panel (Requirement 15.2)
  if (visualization.type === 'table' && visualization.data) {
    const rowCount = Array.isArray(visualization.data) ? visualization.data.length : 0;
    return rowCount > MAX_INLINE_ROWS;
  }
  
  // Everything else stays inline (small tables, textual results)
  return false;
}

/**
 * Detects the size and type of tool result data
 * 
 * @param data - The tool result data
 * @returns Object with size and type information
 */
export function detectResultSizeAndType(data: unknown): {
  rowCount: number;
  isVisual: boolean;
  isTabular: boolean;
  isTextual: boolean;
} {
  // Check if data is an array (tabular)
  if (Array.isArray(data)) {
    return {
      rowCount: data.length,
      isVisual: false,
      isTabular: true,
      isTextual: false,
    };
  }
  
  // Check if data has visualization type indicators
  if (data && typeof data === 'object' && 'type' in data) {
    const type = (data as { type: string }).type;
    const visualTypes = [
      'bar_chart', 'line_chart', 'pie_chart', 'scatter_chart', 'area_chart',
      'map', 'heat_map', 'photo_gallery', 'timeline', 'mermaid',
      'custom_dashboard', 'analysis_dashboard'
    ];
    
    if (visualTypes.includes(type)) {
      return {
        rowCount: 0,
        isVisual: true,
        isTabular: false,
        isTextual: false,
      };
    }
    
    if (type === 'table' && 'data' in data) {
      const tableData = (data as { data: unknown }).data;
      const rowCount = Array.isArray(tableData) ? tableData.length : 0;
      return {
        rowCount,
        isVisual: false,
        isTabular: true,
        isTextual: false,
      };
    }
  }
  
  // Default to textual
  return {
    rowCount: 0,
    isVisual: false,
    isTabular: false,
    isTextual: true,
  };
}
