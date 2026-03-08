// src/utils/result-routing.ts

import { MAX_INLINE_ROWS } from '@/types';
import type { Message } from '@/types';

/**
 * Result routing logic for tool outputs
 * Validates: Requirements 8.6, 8.7, 8.8, 15.2, 15.3, 15.4, 15.5, 18.7
 */

/**
 * Determines if a visualization should be routed to the artifacts panel
 * 
 * Routing rules (Claude Desktop parity):
 * - Dashboards and custom HTML → Always artifacts panel (right side)
 * - Chart types with data → Artifacts panel for native rendering
 * - Tables with > MAX_INLINE_ROWS → Artifacts panel
 * - Small tables (≤ MAX_INLINE_ROWS) → Inline in chat
 * - Simple status/text → Inline in chat
 */
export function shouldRouteToArtifacts(visualization: Message['visualization']): boolean {
  if (!visualization) return false;
  
  const type = visualization.type?.toLowerCase() || '';
  
  // Dashboards always go to artifacts panel — this is the Claude Desktop behavior
  if (type.includes('dashboard') || type === 'custom_dashboard' || type === 'analysis_dashboard') {
    return true;
  }
  
  // HTML visualizations with chart/dashboard content go to artifacts panel
  if (visualization.html) {
    // Check if the HTML is a substantial visualization (not just a small status message)
    const htmlLen = visualization.html.length;
    // Dashboards and charts are typically > 500 chars of HTML
    if (htmlLen > 500) {
      return true;
    }
    // Small HTML snippets stay inline
    return false;
  }
  
  // Data-only chart types go to artifacts panel for native rendering
  const artifactChartTypes = [
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
    'gallery',
    'grouped_gallery',
  ];
  
  if (artifactChartTypes.includes(type)) {
    return true;
  }
  
  // Tables with more than MAX_INLINE_ROWS go to artifacts panel
  if (type === 'table' && visualization.data) {
    const rowCount = Array.isArray(visualization.data) ? visualization.data.length : 0;
    return rowCount > MAX_INLINE_ROWS;
  }
  
  return false;
}

/**
 * Detects the size and type of tool result data
 * Enhanced to detect image galleries and multi-modal content
 * 
 * @param data - The tool result data
 * @returns Object with size and type information
 */
export function detectResultSizeAndType(data: unknown): {
  rowCount: number;
  isVisual: boolean;
  isTabular: boolean;
  isTextual: boolean;
  hasImages: boolean;
} {
  // Check if data is an array (tabular)
  if (Array.isArray(data)) {
    // Check if array contains image data
    const hasImages = data.some(
      item =>
        item &&
        typeof item === 'object' &&
        ('image' in item || 'imageUrl' in item || 'imageData' in item)
    );

    return {
      rowCount: data.length,
      isVisual: hasImages,
      isTabular: !hasImages,
      isTextual: false,
      hasImages,
    };
  }
  
  // Check if data has visualization type indicators
  if (data && typeof data === 'object' && 'type' in data) {
    const type = (data as { type: string }).type;
    const visualTypes = [
      'bar_chart', 'line_chart', 'pie_chart', 'scatter_chart', 'area_chart',
      'map', 'heat_map', 'photo_gallery', 'timeline', 'mermaid',
      'custom_dashboard', 'analysis_dashboard', 'gallery', 'grouped_gallery'
    ];
    
    if (visualTypes.includes(type)) {
      // Check if it has images
      const hasImages =
        type === 'photo_gallery' ||
        type === 'gallery' ||
        type === 'grouped_gallery' ||
        ('data' in data &&
          Array.isArray((data as { data: unknown }).data) &&
          (data as { data: unknown[] }).data.some(
            item => item && typeof item === 'object' && 'image' in item
          ));

      return {
        rowCount: 0,
        isVisual: true,
        isTabular: false,
        isTextual: false,
        hasImages,
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
        hasImages: false,
      };
    }
  }
  
  // Default to textual
  return {
    rowCount: 0,
    isVisual: false,
    isTabular: false,
    isTextual: true,
    hasImages: false,
  };
}

/**
 * Determines the appropriate layout for a result
 * Requirement 8.5: Support both grid and list layouts
 * 
 * @param data - The result data
 * @returns Layout type ('grid' or 'list')
 */
export function determineLayout(data: unknown): 'grid' | 'list' {
  const info = detectResultSizeAndType(data);

  // Image galleries use grid layout
  if (info.hasImages) {
    return 'grid';
  }

  // Large tables use list layout
  if (info.isTabular && info.rowCount > 20) {
    return 'list';
  }

  // Default to grid for visual content
  if (info.isVisual) {
    return 'grid';
  }

  return 'list';
}

/**
 * Determines if content should be displayed in the artifacts panel based on size and type
 * Requirement 8.6, 8.7: Route large tables/charts to artifacts panel, keep small results inline
 * 
 * @param data - The result data
 * @returns true if should route to artifacts panel
 */
export function shouldRouteDataToArtifacts(data: unknown): boolean {
  const info = detectResultSizeAndType(data);

  // Visual content always goes to artifacts panel
  if (info.isVisual) {
    return true;
  }

  // Large tables go to artifacts panel
  if (info.isTabular && info.rowCount > MAX_INLINE_ROWS) {
    return true;
  }

  // Small tables and textual content stay inline
  return false;
}
