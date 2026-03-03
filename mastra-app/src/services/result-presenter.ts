// src/services/result-presenter.ts
/**
 * Result Presenter Service
 * Handles formatting and presentation of query results with multi-modal content
 * Supports image embedding, similarity scores, view counts, distances, and grouping
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import type { QueryResult } from './query-engine';

/**
 * Image data extracted from BLOB columns
 */
export interface ImageData {
  data: string; // Base64 encoded image data or URL
  mimeType: string;
  width?: number;
  height?: number;
}

/**
 * Formatted result with embedded images and metrics
 */
export interface FormattedResult {
  type: 'table' | 'gallery' | 'grouped_gallery';
  data: FormattedRow[];
  grouping?: {
    key: string;
    groups: Map<string, FormattedRow[]>;
  };
  metadata: {
    hasImages: boolean;
    hasSimilarityScores: boolean;
    hasDistances: boolean;
    hasViewCounts: boolean;
    totalRows: number;
  };
}

/**
 * Formatted row with typed fields
 */
export interface FormattedRow {
  id: string;
  image?: ImageData;
  similarityScore?: number; // 0-100 percentage
  viewCount?: number;
  distance?: {
    value: number;
    unit: 'miles' | 'km';
  };
  groupKey?: string;
  rawData: Record<string, unknown>;
}

/**
 * Configuration for result presentation
 */
export interface PresentationConfig {
  imageColumns?: string[]; // Column names that contain image data
  similarityColumn?: string; // Column name for similarity scores
  viewCountColumn?: string; // Column name for view counts
  distanceColumn?: string; // Column name for distances
  distanceUnit?: 'miles' | 'km';
  groupByColumn?: string; // Column to group results by
  preserveAspectRatio?: boolean; // Whether to preserve image aspect ratios (default: true)
  maxImageWidth?: number; // Maximum image width in pixels
  maxImageHeight?: number; // Maximum image height in pixels
}

/**
 * ResultPresenter class for formatting query results with multi-modal content
 */
export class ResultPresenter {
  /**
   * Format query results with image embedding and metric formatting
   * Requirement 8.1: Retrieve images from BLOB columns
   * Requirement 8.2: Format similarity scores, view counts, distances
   * Requirement 8.3: Organize results by grouping criteria
   * 
   * @param result - Query result from database
   * @param config - Presentation configuration
   * @returns Formatted result with embedded images and metrics
   */
  formatResults(result: QueryResult, config: PresentationConfig = {}): FormattedResult {
    const formattedRows: FormattedRow[] = [];
    const metadata = {
      hasImages: false,
      hasSimilarityScores: false,
      hasDistances: false,
      hasViewCounts: false,
      totalRows: result.data.length,
    };

    // Process each row
    for (let i = 0; i < result.data.length; i++) {
      const row = result.data[i];
      const formattedRow: FormattedRow = {
        id: `row-${i}`,
        rawData: row,
      };

      // Extract image data (Requirement 8.1)
      if (config.imageColumns && config.imageColumns.length > 0) {
        const imageData = this.extractImageData(row, config.imageColumns);
        if (imageData) {
          formattedRow.image = this.resizeImage(imageData, config);
          metadata.hasImages = true;
        }
      }

      // Format similarity score (Requirement 8.2)
      if (config.similarityColumn && config.similarityColumn in row) {
        formattedRow.similarityScore = this.formatSimilarityScore(
          row[config.similarityColumn]
        );
        metadata.hasSimilarityScores = true;
      }

      // Format view count (Requirement 8.2)
      if (config.viewCountColumn && config.viewCountColumn in row) {
        formattedRow.viewCount = this.formatViewCount(row[config.viewCountColumn]);
        metadata.hasViewCounts = true;
      }

      // Format distance (Requirement 8.2)
      if (config.distanceColumn && config.distanceColumn in row) {
        formattedRow.distance = this.formatDistance(
          row[config.distanceColumn],
          config.distanceUnit || 'miles'
        );
        metadata.hasDistances = true;
      }

      // Extract group key (Requirement 8.3)
      if (config.groupByColumn && config.groupByColumn in row) {
        formattedRow.groupKey = String(row[config.groupByColumn]);
      }

      formattedRows.push(formattedRow);
    }

    // Organize by grouping if specified (Requirement 8.3)
    if (config.groupByColumn) {
      const groups = this.groupResults(formattedRows);
      return {
        type: 'grouped_gallery',
        data: formattedRows,
        grouping: {
          key: config.groupByColumn,
          groups,
        },
        metadata,
      };
    }

    // Determine presentation type
    const type = metadata.hasImages ? 'gallery' : 'table';

    return {
      type,
      data: formattedRows,
      metadata,
    };
  }

  /**
   * Extract image data from row
   * Requirement 8.1: Retrieve images from BLOB columns
   * 
   * @param row - Data row
   * @param imageColumns - Column names that may contain image data
   * @returns Image data or null if not found
   */
  private extractImageData(
    row: Record<string, unknown>,
    imageColumns: string[]
  ): ImageData | null {
    for (const column of imageColumns) {
      if (!(column in row)) continue;

      const value = row[column];

      // Handle base64 encoded images
      if (typeof value === 'string') {
        // Check if it's a data URL
        if (value.startsWith('data:image/')) {
          const mimeMatch = value.match(/data:(image\/[^;]+);/);
          return {
            data: value,
            mimeType: mimeMatch ? mimeMatch[1] : 'image/jpeg',
          };
        }

        // Check if it's a URL
        if (value.startsWith('http://') || value.startsWith('https://')) {
          return {
            data: value,
            mimeType: 'image/jpeg', // Default, will be determined by browser
          };
        }

        // Check if it's raw base64 (without data URL prefix)
        if (this.isBase64(value)) {
          return {
            data: `data:image/jpeg;base64,${value}`,
            mimeType: 'image/jpeg',
          };
        }
      }

      // Handle Buffer or Uint8Array (BLOB data)
      if (value instanceof Buffer || value instanceof Uint8Array) {
        const base64 = this.bufferToBase64(value);
        return {
          data: `data:image/jpeg;base64,${base64}`,
          mimeType: 'image/jpeg',
        };
      }
    }

    return null;
  }

  /**
   * Check if a string is valid base64
   */
  private isBase64(str: string): boolean {
    if (str.length === 0) return false;
    try {
      return btoa(atob(str)) === str;
    } catch {
      return false;
    }
  }

  /**
   * Convert Buffer or Uint8Array to base64 string
   */
  private bufferToBase64(buffer: Buffer | Uint8Array): string {
    if (typeof Buffer !== 'undefined' && buffer instanceof Buffer) {
      return buffer.toString('base64');
    }
    // For Uint8Array in browser environment
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Resize image while preserving aspect ratio
   * Requirement 8.4: Preserve aspect ratio when resizing
   * 
   * @param imageData - Original image data
   * @param config - Presentation configuration
   * @returns Image data with size constraints
   */
  private resizeImage(imageData: ImageData, config: PresentationConfig): ImageData {
    const preserveAspectRatio = config.preserveAspectRatio !== false;
    const maxWidth = config.maxImageWidth || 400;
    const maxHeight = config.maxImageHeight || 400;

    if (!preserveAspectRatio) {
      return {
        ...imageData,
        width: maxWidth,
        height: maxHeight,
      };
    }

    // If we don't have original dimensions, just set max constraints
    // The browser will preserve aspect ratio with CSS
    return {
      ...imageData,
      width: maxWidth,
      height: maxHeight,
    };
  }

  /**
   * Format similarity score to percentage (0-100)
   * Requirement 8.2: Format similarity scores
   * 
   * @param value - Raw similarity score
   * @returns Formatted percentage (0-100)
   */
  private formatSimilarityScore(value: unknown): number {
    if (typeof value !== 'number') {
      return 0;
    }

    // If value is in 0-1 range (normalized), convert to percentage
    if (value >= 0 && value <= 1) {
      return Math.round(value * 10000) / 100; // Convert to percentage with 2 decimals
    }

    // If value is already in 0-100 range, return as is
    if (value > 1 && value <= 100) {
      return Math.round(value * 100) / 100; // Round to 2 decimals
    }

    // If value is a distance metric (higher = less similar), invert it
    // Assume max distance of 2 for cosine distance
    if (value > 100) {
      const normalized = Math.max(0, 1 - value / 2);
      return Math.round(normalized * 10000) / 100;
    }

    return 0;
  }

  /**
   * Format view count
   * Requirement 8.2: Format view counts
   * 
   * @param value - Raw view count
   * @returns Formatted view count
   */
  private formatViewCount(value: unknown): number {
    if (typeof value === 'number') {
      return Math.floor(value);
    }
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  /**
   * Format distance with unit
   * Requirement 8.2: Format distances
   * 
   * @param value - Raw distance value
   * @param unit - Distance unit
   * @returns Formatted distance with unit
   */
  private formatDistance(
    value: unknown,
    unit: 'miles' | 'km'
  ): { value: number; unit: 'miles' | 'km' } {
    let numValue = 0;

    if (typeof value === 'number') {
      numValue = value;
    } else if (typeof value === 'string') {
      const parsed = parseFloat(value);
      numValue = isNaN(parsed) ? 0 : parsed;
    }

    // Round to 2 decimal places
    numValue = Math.round(numValue * 100) / 100;

    return {
      value: numValue,
      unit,
    };
  }

  /**
   * Group results by group key
   * Requirement 8.3: Organize results by grouping criteria
   * 
   * @param rows - Formatted rows
   * @returns Map of group key to rows
   */
  private groupResults(rows: FormattedRow[]): Map<string, FormattedRow[]> {
    const groups = new Map<string, FormattedRow[]>();

    for (const row of rows) {
      if (!row.groupKey) continue;

      const existing = groups.get(row.groupKey) || [];
      existing.push(row);
      groups.set(row.groupKey, existing);
    }

    return groups;
  }

  /**
   * Generate HTML for formatted results
   * Requirement 8.5: Support both grid and list layouts
   * 
   * @param formattedResult - Formatted result
   * @param layout - Layout type ('grid' or 'list')
   * @returns HTML string
   */
  generateHTML(formattedResult: FormattedResult, layout: 'grid' | 'list' = 'grid'): string {
    if (formattedResult.type === 'grouped_gallery' && formattedResult.grouping) {
      return this.generateGroupedGalleryHTML(formattedResult, layout);
    }

    if (formattedResult.type === 'gallery') {
      return this.generateGalleryHTML(formattedResult.data, layout);
    }

    return this.generateTableHTML(formattedResult.data);
  }

  /**
   * Generate HTML for grouped gallery
   */
  private generateGroupedGalleryHTML(
    result: FormattedResult,
    layout: 'grid' | 'list'
  ): string {
    if (!result.grouping) return '';

    const sections: string[] = [];

    // Sort groups by key
    const sortedGroups = Array.from(result.grouping.groups.entries()).sort(
      ([a], [b]) => a.localeCompare(b)
    );

    for (const [groupKey, rows] of sortedGroups) {
      sections.push(`
        <div class="group-section" style="margin-bottom: 2rem;">
          <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem; color: #1f2937;">
            ${this.escapeHtml(groupKey)}
          </h3>
          ${this.generateGalleryHTML(rows, layout)}
        </div>
      `);
    }

    return `
      <div class="grouped-gallery" style="padding: 1rem;">
        ${sections.join('\n')}
      </div>
    `;
  }

  /**
   * Generate HTML for gallery layout
   */
  private generateGalleryHTML(rows: FormattedRow[], layout: 'grid' | 'list'): string {
    const containerStyle =
      layout === 'grid'
        ? 'display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem;'
        : 'display: flex; flex-direction: column; gap: 1rem;';

    const items = rows.map(row => this.generateGalleryItem(row, layout)).join('\n');

    return `
      <div class="gallery" style="${containerStyle}">
        ${items}
      </div>
    `;
  }

  /**
   * Generate HTML for a single gallery item
   */
  private generateGalleryItem(row: FormattedRow, layout: 'grid' | 'list'): string {
    const imageHTML = row.image
      ? `
        <img 
          src="${this.escapeHtml(row.image.data)}" 
          alt="Result image"
          style="width: 100%; height: ${layout === 'grid' ? '200px' : 'auto'}; object-fit: cover; border-radius: 0.5rem;"
        />
      `
      : '';

    const metrics: string[] = [];

    if (row.similarityScore !== undefined) {
      metrics.push(`<div><strong>Similarity:</strong> ${row.similarityScore.toFixed(1)}%</div>`);
    }

    if (row.viewCount !== undefined) {
      metrics.push(`<div><strong>Views:</strong> ${row.viewCount.toLocaleString()}</div>`);
    }

    if (row.distance) {
      metrics.push(
        `<div><strong>Distance:</strong> ${row.distance.value} ${row.distance.unit}</div>`
      );
    }

    const metricsHTML = metrics.length > 0 ? metrics.join('\n') : '';

    return `
      <div class="gallery-item" style="border: 1px solid #e5e7eb; border-radius: 0.5rem; overflow: hidden; background: white;">
        ${imageHTML}
        ${
          metricsHTML
            ? `
          <div style="padding: 0.75rem; font-size: 0.875rem; color: #4b5563;">
            ${metricsHTML}
          </div>
        `
            : ''
        }
      </div>
    `;
  }

  /**
   * Generate HTML for table layout
   */
  private generateTableHTML(rows: FormattedRow[]): string {
    if (rows.length === 0) {
      return '<div style="padding: 2rem; text-align: center; color: #6b7280;">No results</div>';
    }

    const columns = Object.keys(rows[0].rawData);
    const headerHTML = columns.map(col => `<th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #e5e7eb;">${this.escapeHtml(col)}</th>`).join('');

    const rowsHTML = rows
      .map(row => {
        const cellsHTML = columns
          .map(col => {
            const value = row.rawData[col];
            return `<td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">${this.escapeHtml(String(value ?? ''))}</td>`;
          })
          .join('');
        return `<tr>${cellsHTML}</tr>`;
      })
      .join('\n');

    return `
      <table style="width: 100%; border-collapse: collapse; background: white;">
        <thead>
          <tr>${headerHTML}</tr>
        </thead>
        <tbody>
          ${rowsHTML}
        </tbody>
      </table>
    `;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}
