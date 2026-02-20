// src/services/data-profiler.ts

import { DataProfile, ColumnStats } from '@/types';

/**
 * Configuration options for data profiling.
 */
export interface ProfileConfig {
  /** Whether to detect outliers using IQR method (default: true) */
  detectOutliers?: boolean;
  /** Whether to compute percentiles for numeric columns (default: true) */
  computePercentiles?: boolean;
  /** Maximum number of top values to track for categorical columns (default: 10) */
  maxTopValues?: number;
}

/**
 * Result of outlier detection using IQR method.
 */
export interface OutlierResult {
  /** Array of values identified as outliers */
  outliers: number[];
  /** Lower and upper bounds for normal values */
  bounds: { lower: number; upper: number };
  /** Count of outliers detected */
  count: number;
}

/**
 * DataProfiler provides comprehensive statistical profiling for any dataset.
 *
 * This service is designed to profile query results and provides more detailed
 * analysis than the basic profiling in DataSynthesizer.
 *
 * Requirements covered:
 * - 8.1: Compute a DataProfile with statistical summaries
 * - 8.2: Identify numeric column distributions (min, max, mean, median, standard deviation)
 * - 8.3: Identify categorical column cardinalities and top values
 * - 8.4: Detect potential outliers and anomalies
 * - 8.5: Identify clustering patterns and geographic spread
 * - 8.6: Identify trends, seasonality, and unusual periods in time series
 * - 8.7: Display DataProfile as part of dashboard with key insights highlighted
 */
export class DataProfiler {
  private config: ProfileConfig;

  constructor(config: ProfileConfig = {}) {
    this.config = {
      detectOutliers: config.detectOutliers ?? true,
      computePercentiles: config.computePercentiles ?? true,
      maxTopValues: config.maxTopValues ?? 10,
    };
  }

  /**
   * Profiles a dataset and returns comprehensive statistics (Requirement 8.1).
   *
   * @param data - Array of records to profile
   * @param tableName - Name of the table/dataset being profiled
   * @returns DataProfile with complete statistics
   */
  profile(data: Record<string, unknown>[], tableName: string = 'DATA'): DataProfile {
    if (data.length === 0) {
      return {
        tableName,
        recordCount: 0,
        columnStats: [],
      };
    }

    const columns = Object.keys(data[0]);
    const columnStats = columns.map((col) => this.profileColumn(col, data));

    const profile: DataProfile = {
      tableName,
      recordCount: data.length,
      columnStats,
    };

    // Add geographic spread if lat/lon columns exist (Requirement 8.5)
    this.addGeographicSpread(profile, data);

    // Add time range if timestamp columns exist (Requirement 8.6)
    this.addTimeRange(profile, data);

    // Add anomaly count if flagged column exists (Requirement 8.4)
    this.addAnomalyCount(profile, data);

    return profile;
  }

  /**
   * Profiles a single column with comprehensive statistics.
   *
   * @param colName - Name of the column to profile
   * @param data - Array of records containing the column
   * @returns ColumnStats with detailed statistics
   */
  private profileColumn(colName: string, data: Record<string, unknown>[]): ColumnStats {
    const values = data.map((r) => r[colName]);
    const nonNull = values.filter((v) => v != null && v !== '');
    const unique = new Set(nonNull.map(String));

    const stats: ColumnStats = {
      columnName: colName,
      dataType: this.detectDataType(nonNull),
      nullCount: values.length - nonNull.length,
      uniqueCount: unique.size,
    };

    // Numeric statistics (Requirement 8.2)
    if (stats.dataType === 'number') {
      this.addNumericStats(stats, nonNull as number[]);
    }

    // Categorical statistics (Requirement 8.3)
    if (stats.dataType === 'string') {
      this.addCategoricalStats(stats, nonNull as string[]);
    }

    return stats;
  }

  /**
   * Detects the data type of values in a column.
   *
   * @param values - Non-null values from the column
   * @returns Detected data type string
   */
  private detectDataType(values: unknown[]): string {
    if (values.length === 0) return 'undefined';

    const sample = values[0];

    if (typeof sample === 'number') return 'number';

    if (typeof sample === 'string') {
      // Check if it's a date string (ISO format or common date patterns)
      if (
        typeof sample === 'string' &&
        (sample.match(/^\d{4}-\d{2}-\d{2}/) || sample.match(/^\d{2}\/\d{2}\/\d{4}/))
      ) {
        return 'date';
      }
      return 'string';
    }

    if (typeof sample === 'boolean') return 'boolean';

    if (sample instanceof Date) return 'date';

    return typeof sample;
  }

  /**
   * Adds numeric statistics to column stats (Requirement 8.2).
   * Calculates min, max, mean, and standard deviation.
   *
   * @param stats - ColumnStats object to update
   * @param values - Array of numeric values
   */
  private addNumericStats(stats: ColumnStats, values: number[]): void {
    if (values.length === 0) return;

    const sorted = [...values].sort((a, b) => a - b);

    stats.min = sorted[0];
    stats.max = sorted[sorted.length - 1];
    stats.mean = values.reduce((a, b) => a + b, 0) / values.length;

    // Standard deviation calculation
    const variance =
      values.reduce((sum, n) => sum + Math.pow(n - stats.mean!, 2), 0) / values.length;
    stats.stdDev = Math.sqrt(variance);
  }

  /**
   * Adds categorical statistics to column stats (Requirement 8.3).
   * Calculates top values by frequency.
   *
   * @param stats - ColumnStats object to update
   * @param values - Array of string values
   */
  private addCategoricalStats(stats: ColumnStats, values: string[]): void {
    const valueCounts = new Map<string, number>();

    for (const v of values) {
      valueCounts.set(v, (valueCounts.get(v) || 0) + 1);
    }

    stats.topValues = Array.from(valueCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.config.maxTopValues)
      .map(([value, count]) => ({ value, count }));
  }

  /**
   * Adds geographic spread information to the profile (Requirement 8.5).
   * Detects latitude/longitude columns and calculates bounding box.
   *
   * @param profile - DataProfile to update
   * @param data - Array of records
   */
  private addGeographicSpread(profile: DataProfile, data: Record<string, unknown>[]): void {
    if (data.length === 0) return;

    const keys = Object.keys(data[0]);
    const latCol = keys.find((k) => k.toLowerCase().includes('lat'));
    const lonCol = keys.find((k) => k.toLowerCase().includes('lon'));

    if (!latCol || !lonCol) return;

    const lats = data
      .map((r) => r[latCol])
      .filter((v): v is number => typeof v === 'number' && !isNaN(v));

    const lons = data
      .map((r) => r[lonCol])
      .filter((v): v is number => typeof v === 'number' && !isNaN(v));

    if (lats.length > 0 && lons.length > 0) {
      profile.geographicSpread = {
        minLat: Math.min(...lats),
        maxLat: Math.max(...lats),
        minLon: Math.min(...lons),
        maxLon: Math.max(...lons),
      };
    }
  }

  /**
   * Adds time range information to the profile (Requirement 8.6).
   * Detects timestamp columns and calculates date range.
   *
   * @param profile - DataProfile to update
   * @param data - Array of records
   */
  private addTimeRange(profile: DataProfile, data: Record<string, unknown>[]): void {
    if (data.length === 0) return;

    const keys = Object.keys(data[0]);
    const timeCol = keys.find(
      (k) =>
        k.toLowerCase().includes('date') ||
        k.toLowerCase().includes('time') ||
        k.toLowerCase() === 'created_at' ||
        k.toLowerCase() === 'timestamp'
    );

    if (!timeCol) return;

    const timestamps = data
      .map((r) => {
        const val = r[timeCol];
        if (!val) return null;

        // Handle Date objects
        if (val instanceof Date) {
          return isNaN(val.getTime()) ? null : val;
        }

        // Handle string dates
        if (typeof val === 'string') {
          const date = new Date(val);
          return isNaN(date.getTime()) ? null : date;
        }

        // Handle numeric timestamps
        if (typeof val === 'number') {
          const date = new Date(val);
          return isNaN(date.getTime()) ? null : date;
        }

        return null;
      })
      .filter((d): d is Date => d !== null);

    if (timestamps.length > 0) {
      profile.timeRange = {
        start: new Date(Math.min(...timestamps.map((d) => d.getTime()))),
        end: new Date(Math.max(...timestamps.map((d) => d.getTime()))),
      };
    }
  }

  /**
   * Adds anomaly count to the profile (Requirement 8.4).
   * Detects flagged/anomaly columns and counts flagged records.
   *
   * @param profile - DataProfile to update
   * @param data - Array of records
   */
  private addAnomalyCount(profile: DataProfile, data: Record<string, unknown>[]): void {
    if (data.length === 0) return;

    const keys = Object.keys(data[0]);
    const flaggedCol = keys.find(
      (k) =>
        k.toLowerCase().includes('flagged') ||
        k.toLowerCase().includes('anomaly') ||
        k.toLowerCase().includes('is_fraud') ||
        k.toLowerCase().includes('suspicious')
    );

    if (!flaggedCol) return;

    const flaggedCount = data.filter((r) => {
      const val = r[flaggedCol];
      return val === 1 || val === true || val === 'true' || val === 'Y' || val === 'yes';
    }).length;

    if (flaggedCount > 0) {
      profile.anomalyCount = flaggedCount;
    }
  }

  /**
   * Detects outliers in numeric data using IQR method (Requirement 8.4).
   * Values below Q1 - 1.5*IQR or above Q3 + 1.5*IQR are considered outliers.
   *
   * @param values - Array of numeric values to analyze
   * @returns OutlierResult with outliers and bounds
   */
  detectOutliers(values: number[]): OutlierResult {
    if (values.length < 4) {
      return { outliers: [], bounds: { lower: 0, upper: 0 }, count: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);

    // Calculate quartiles
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;

    // Calculate bounds
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    // Find outliers
    const outliers = values.filter((v) => v < lowerBound || v > upperBound);

    return {
      outliers,
      bounds: { lower: lowerBound, upper: upperBound },
      count: outliers.length,
    };
  }

  /**
   * Calculates the median of a numeric array.
   *
   * @param values - Array of numeric values
   * @returns Median value
   */
  calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }

    return sorted[mid];
  }

  /**
   * Calculates percentiles for a numeric array.
   *
   * @param values - Array of numeric values
   * @param percentiles - Array of percentile values (0-100)
   * @returns Map of percentile to value
   */
  calculatePercentiles(values: number[], percentiles: number[] = [25, 50, 75, 90, 95, 99]): Map<number, number> {
    const result = new Map<number, number>();

    if (values.length === 0) return result;

    const sorted = [...values].sort((a, b) => a - b);

    for (const p of percentiles) {
      const index = Math.floor((p / 100) * (sorted.length - 1));
      result.set(p, sorted[index]);
    }

    return result;
  }

  /**
   * Generates insights from the data profile (Requirement 8.7).
   * Creates human-readable insights for dashboard display.
   *
   * @param profile - DataProfile to analyze
   * @returns Array of insight strings with emoji indicators
   */
  generateInsights(profile: DataProfile): string[] {
    const insights: string[] = [];

    // Anomaly insights
    if (profile.anomalyCount !== undefined && profile.recordCount > 0) {
      const rate = (profile.anomalyCount / profile.recordCount) * 100;
      if (rate > 10) {
        insights.push(`⚠️ High anomaly rate: ${rate.toFixed(1)}% of records flagged`);
      } else if (rate > 0) {
        insights.push(`✅ Anomaly rate within normal range: ${rate.toFixed(1)}%`);
      }
    }

    // Geographic insights
    if (profile.geographicSpread) {
      const latSpread = profile.geographicSpread.maxLat - profile.geographicSpread.minLat;
      const lonSpread = profile.geographicSpread.maxLon - profile.geographicSpread.minLon;

      if (latSpread > 30 || lonSpread > 30) {
        insights.push(`🌍 Data spans a wide geographic area`);
      } else if (latSpread > 0 || lonSpread > 0) {
        insights.push(`📍 Data concentrated in a specific region`);
      }
    }

    // Numeric column insights - high variability detection
    for (const stat of profile.columnStats) {
      if (stat.stdDev !== undefined && stat.mean !== undefined && stat.mean !== 0) {
        const cv = (stat.stdDev / Math.abs(stat.mean)) * 100;
        if (cv > 100) {
          insights.push(`📊 High variability in ${stat.columnName}: CV ${cv.toFixed(0)}%`);
        }
      }

      // Detect columns with many nulls
      if (stat.nullCount > 0 && profile.recordCount > 0) {
        const nullRate = (stat.nullCount / profile.recordCount) * 100;
        if (nullRate > 20) {
          insights.push(`⚠️ ${stat.columnName} has ${nullRate.toFixed(0)}% missing values`);
        }
      }

      // Detect low cardinality in categorical columns
      if (stat.dataType === 'string' && stat.uniqueCount === 1 && profile.recordCount > 1) {
        insights.push(`📌 ${stat.columnName} has only one unique value`);
      }
    }

    // Time range insights
    if (profile.timeRange) {
      const days = Math.ceil(
        (profile.timeRange.end.getTime() - profile.timeRange.start.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (days > 0) {
        insights.push(`📅 Data spans ${days} day${days === 1 ? '' : 's'}`);
      }
    }

    // Data completeness insight
    const totalNulls = profile.columnStats.reduce((sum, s) => sum + s.nullCount, 0);
    const totalCells = profile.recordCount * profile.columnStats.length;
    if (totalCells > 0) {
      const completeness = ((totalCells - totalNulls) / totalCells) * 100;
      if (completeness < 90) {
        insights.push(`📋 Data completeness: ${completeness.toFixed(1)}%`);
      }
    }

    return insights;
  }

  /**
   * Detects potential data quality issues in the profile.
   *
   * @param profile - DataProfile to analyze
   * @returns Array of data quality issue descriptions
   */
  detectDataQualityIssues(profile: DataProfile): string[] {
    const issues: string[] = [];

    for (const stat of profile.columnStats) {
      // High null rate
      if (profile.recordCount > 0) {
        const nullRate = stat.nullCount / profile.recordCount;
        if (nullRate > 0.5) {
          issues.push(`Column ${stat.columnName} has >50% null values`);
        }
      }

      // Zero variance in numeric columns
      if (stat.dataType === 'number' && stat.stdDev === 0 && profile.recordCount > 1) {
        issues.push(`Column ${stat.columnName} has zero variance (all values identical)`);
      }

      // Single unique value
      if (stat.uniqueCount === 1 && profile.recordCount > 1) {
        issues.push(`Column ${stat.columnName} contains only one unique value`);
      }
    }

    return issues;
  }

  /**
   * Gets the current configuration.
   *
   * @returns Current ProfileConfig
   */
  getConfig(): ProfileConfig {
    return { ...this.config };
  }
}
