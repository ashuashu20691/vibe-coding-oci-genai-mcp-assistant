/**
 * ReportTriggerDetector Service
 * 
 * Analyzes query results to determine if automatic report generation should occur.
 * Detects data characteristics and suggests appropriate report types.
 * 
 * Validates: Requirements 1.1, 1.2, 7.1, 7.2, 7.3, 7.4
 */

import { QueryResult } from '../query-engine';
import { WorkflowContext } from '../workflow-orchestrator';
import {
  ReportTriggerConfig,
  TriggerDecision,
  DataCharacteristics,
} from './types';

/**
 * ReportTriggerDetector analyzes query results to determine if report generation should occur
 */
export class ReportTriggerDetector {
  private config: ReportTriggerConfig;

  constructor(config: ReportTriggerConfig) {
    this.config = config;
  }

  /**
   * Analyze query results and decide if report generation should occur
   * 
   * Validates: Requirements 1.1, 1.2
   * 
   * @param queryResult - The query result to analyze
   * @param context - The workflow context
   * @returns Decision on whether to generate a report
   */
  shouldTriggerReport(
    queryResult: QueryResult,
    context: WorkflowContext
  ): TriggerDecision {
    // Check if automatic generation is enabled
    const autoGenerateEnabled =
      this.config.userPreferences?.autoGenerate ?? this.config.enabledByDefault;

    if (!autoGenerateEnabled) {
      return {
        shouldGenerate: false,
        reason: 'Automatic report generation is disabled',
        suggestedReportType: 'simple',
        estimatedComplexity: 'low',
      };
    }

    // Check if query was successful
    if (!queryResult.success) {
      return {
        shouldGenerate: false,
        reason: 'Query execution failed',
        suggestedReportType: 'simple',
        estimatedComplexity: 'low',
      };
    }

    // Requirement 1.2: Skip report generation for empty results
    if (queryResult.rowCount === 0 || queryResult.data.length === 0) {
      return {
        shouldGenerate: false,
        reason: 'Query returned zero rows',
        suggestedReportType: 'simple',
        estimatedComplexity: 'low',
      };
    }

    // Check minimum row threshold
    if (queryResult.rowCount < this.config.minRows) {
      return {
        shouldGenerate: false,
        reason: `Row count (${queryResult.rowCount}) below minimum threshold (${this.config.minRows})`,
        suggestedReportType: 'simple',
        estimatedComplexity: 'low',
      };
    }

    // Check maximum row threshold
    if (queryResult.rowCount > this.config.maxRows) {
      return {
        shouldGenerate: false,
        reason: `Row count (${queryResult.rowCount}) exceeds maximum threshold (${this.config.maxRows})`,
        suggestedReportType: 'simple',
        estimatedComplexity: 'high',
      };
    }

    // Analyze data characteristics to determine report type
    const characteristics = this.analyzeDataCharacteristics(queryResult.data);

    // Determine suggested report type based on data characteristics
    const suggestedReportType = this.determineReportType(
      characteristics,
      queryResult
    );

    // Estimate complexity based on data size and characteristics
    const estimatedComplexity = this.estimateComplexity(
      queryResult,
      characteristics
    );

    // Requirement 1.1: Trigger report generation for valid results
    return {
      shouldGenerate: true,
      reason: 'Query returned valid results suitable for visualization',
      suggestedReportType,
      estimatedComplexity,
    };
  }

  /**
   * Detect data characteristics for visualization selection
   * 
   * Validates: Requirements 7.1, 7.2, 7.3, 7.4
   * 
   * @param data - The query result data
   * @returns Detected data characteristics
   */
  analyzeDataCharacteristics(
    data: Record<string, unknown>[]
  ): DataCharacteristics {
    if (data.length === 0) {
      return {
        hasTimeSeriesData: false,
        hasCategoricalData: false,
        hasNumericMetrics: false,
        hasImageData: false,
        hasGeographicData: false,
      };
    }

    const firstRow = data[0];
    const columns = Object.keys(firstRow);

    // Detect time-series data (date/timestamp columns)
    const hasTimeSeriesData = columns.some((col) => {
      const colLower = col.toLowerCase();
      const value = firstRow[col];

      // Check column name patterns
      if (
        colLower.includes('date') ||
        colLower.includes('time') ||
        colLower.includes('timestamp') ||
        colLower.includes('created') ||
        colLower.includes('updated')
      ) {
        return true;
      }

      // Check if value is a date string or timestamp
      if (typeof value === 'string') {
        const datePattern = /^\d{4}-\d{2}-\d{2}|^\d{2}\/\d{2}\/\d{4}/;
        return datePattern.test(value);
      }

      return false;
    });

    // Detect categorical data (string columns with limited unique values)
    const hasCategoricalData = columns.some((col) => {
      const values = data.map((row) => row[col]);
      const uniqueValues = new Set(values);

      // Consider categorical if string column with < 50% unique values
      const isStringColumn = values.some((v) => typeof v === 'string');
      const uniqueRatio = uniqueValues.size / values.length;

      return isStringColumn && uniqueRatio < 0.5 && uniqueValues.size > 1;
    });

    // Detect numeric metrics (number columns)
    const hasNumericMetrics = columns.some((col) => {
      const value = firstRow[col];
      return typeof value === 'number' && !isNaN(value);
    });

    // Detect image data (BLOB columns or base64 strings)
    const hasImageData = columns.some((col) => {
      const colLower = col.toLowerCase();
      const value = firstRow[col];

      // Check column name patterns
      if (
        colLower.includes('image') ||
        colLower.includes('photo') ||
        colLower.includes('picture') ||
        colLower.includes('thumbnail') ||
        colLower.includes('blob')
      ) {
        return true;
      }

      // Check if value is a base64 string
      if (typeof value === 'string') {
        return (
          value.startsWith('data:image/') ||
          value.startsWith('iVBORw0KGgo') || // PNG base64
          value.startsWith('/9j/') // JPEG base64
        );
      }

      return false;
    });

    // Detect geographic data (lat/lon columns)
    const hasGeographicData = columns.some((col) => {
      const colLower = col.toLowerCase();
      return (
        colLower.includes('latitude') ||
        colLower.includes('longitude') ||
        colLower.includes('lat') ||
        colLower.includes('lon') ||
        colLower.includes('geo') ||
        colLower.includes('location')
      );
    });

    return {
      hasTimeSeriesData,
      hasCategoricalData,
      hasNumericMetrics,
      hasImageData,
      hasGeographicData,
    };
  }

  /**
   * Determine the appropriate report type based on data characteristics
   * 
   * Validates: Requirements 1.3, 1.4, 3.1
   * 
   * @param characteristics - Detected data characteristics
   * @param queryResult - The query result
   * @returns Suggested report type
   */
  private determineReportType(
    characteristics: DataCharacteristics,
    queryResult: QueryResult
  ): 'simple' | 'dashboard' | 'gallery' {
    // Requirement 1.3: Return 'gallery' for image-heavy datasets
    if (characteristics.hasImageData) {
      return 'gallery';
    }

    // Requirement 3.1: Return 'dashboard' for multi-metric datasets
    const numericColumnCount = queryResult.columns.filter((col) => {
      const firstValue = queryResult.data[0]?.[col];
      return typeof firstValue === 'number';
    }).length;

    if (
      numericColumnCount >= 3 ||
      (characteristics.hasNumericMetrics &&
        (characteristics.hasTimeSeriesData || characteristics.hasCategoricalData))
    ) {
      return 'dashboard';
    }

    // Default to simple report for basic datasets
    return 'simple';
  }

  /**
   * Estimate the complexity of report generation
   * 
   * @param queryResult - The query result
   * @param characteristics - Detected data characteristics
   * @returns Estimated complexity level
   */
  private estimateComplexity(
    queryResult: QueryResult,
    characteristics: DataCharacteristics
  ): 'low' | 'medium' | 'high' {
    const rowCount = queryResult.rowCount;
    const columnCount = queryResult.columns.length;

    // Count complex data types
    let complexityScore = 0;

    if (characteristics.hasTimeSeriesData) complexityScore++;
    if (characteristics.hasCategoricalData) complexityScore++;
    if (characteristics.hasImageData) complexityScore += 2;
    if (characteristics.hasGeographicData) complexityScore += 2;

    // Factor in data size
    if (rowCount > 5000) complexityScore += 3;
    else if (rowCount > 1000) complexityScore += 1;

    if (columnCount > 10) complexityScore += 1;

    // Determine complexity level
    if (complexityScore >= 5) return 'high';
    if (complexityScore >= 2) return 'medium';
    return 'low';
  }
}
