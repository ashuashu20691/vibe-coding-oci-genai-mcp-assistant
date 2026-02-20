// src/services/visualization-selector.ts

import {
  AnalysisCategory,
  VisualizationGoal,
  DataProfile,
  VisualizationConfig,
  StatsCard,
} from '@/types';

export interface SelectionResult {
  primary: VisualizationConfig;
  secondary: VisualizationConfig[];
  statsCards: StatsCard[];
}

export class VisualizationSelector {
  /**
   * Selects appropriate visualizations based on data characteristics and analysis categories.
   * Implements Requirements 5.1-5.7 for intelligent visualization selection.
   */
  selectVisualizations(
    data: Record<string, unknown>[],
    profile: DataProfile,
    categories: AnalysisCategory[],
    _goals: VisualizationGoal[]
  ): SelectionResult {
    const configs: VisualizationConfig[] = [];

    // Analyze data structure (Requirement 5.1)
    const hasGeo = this.hasGeographicData(data);
    const hasTime = this.hasTimeData(data);
    const hasImages = this.hasImageData(data);
    const hasRiskScores = this.hasRiskData(data);
    const numericCols = this.getNumericColumns(data);
    const categoricalCols = this.getCategoricalColumns(data);

    // Select visualizations based on data characteristics and categories
    // (Requirements 5.2, 5.3, 5.4, 5.5, 5.6)
    if (hasGeo) {
      configs.push(this.createMapConfig(data, categories));
    }

    if (hasImages) {
      configs.push(this.createPhotoGalleryConfig(data));
    }

    if (hasRiskScores && categories.includes('fraud_detection')) {
      configs.push(this.createHeatMapConfig(data));
    }

    if (hasTime && numericCols.length > 0) {
      configs.push(this.createTimeSeriesConfig(data, numericCols[0]));
    }

    if (categoricalCols.length > 0 && numericCols.length > 0) {
      configs.push(this.createBarChartConfig(data, categoricalCols[0], numericCols[0]));
    }

    // Always include table as fallback
    configs.push(this.createTableConfig(data));

    // Sort by priority (Requirement 5.7)
    configs.sort((a, b) => b.priority - a.priority);

    // Generate stats cards
    const statsCards = this.generateStatsCards(profile, categories);

    return {
      primary: configs[0],
      secondary: configs.slice(1),
      statsCards,
    };
  }

  /**
   * Detects if data contains geographic coordinates (Requirement 5.2)
   */
  private hasGeographicData(data: Record<string, unknown>[]): boolean {
    if (data.length === 0) return false;
    const keys = Object.keys(data[0]).map(k => k.toLowerCase());
    return keys.some(k => k.includes('lat')) && keys.some(k => k.includes('lon'));
  }

  /**
   * Detects if data contains time series information (Requirement 5.3)
   */
  private hasTimeData(data: Record<string, unknown>[]): boolean {
    if (data.length === 0) return false;
    const keys = Object.keys(data[0]).map(k => k.toLowerCase());
    return keys.some(k => 
      k.includes('date') || 
      k.includes('time') || 
      k === 'year' || 
      k === 'month' || 
      k === 'created_at'
    );
  }

  /**
   * Detects if data contains image URLs (Requirement 5.5)
   */
  private hasImageData(data: Record<string, unknown>[]): boolean {
    if (data.length === 0) return false;
    const keys = Object.keys(data[0]).map(k => k.toLowerCase());
    return keys.some(k => k.includes('url') || k.includes('image') || k.includes('photo'));
  }

  /**
   * Detects if data contains risk/anomaly scores (Requirement 5.6)
   */
  private hasRiskData(data: Record<string, unknown>[]): boolean {
    if (data.length === 0) return false;
    const keys = Object.keys(data[0]).map(k => k.toLowerCase());
    return keys.some(k => k.includes('risk') || k.includes('score') || k.includes('flagged'));
  }

  /**
   * Gets numeric columns from data, excluding ID columns
   */
  private getNumericColumns(data: Record<string, unknown>[]): string[] {
    if (data.length === 0) return [];
    return Object.keys(data[0]).filter(k => {
      const val = data[0][k];
      return typeof val === 'number' && !k.toLowerCase().includes('id');
    });
  }

  /**
   * Gets categorical (string) columns from data, excluding URLs and IDs
   */
  private getCategoricalColumns(data: Record<string, unknown>[]): string[] {
    if (data.length === 0) return [];
    return Object.keys(data[0]).filter(k => {
      const val = data[0][k];
      return typeof val === 'string' && 
             !k.toLowerCase().includes('url') && 
             !k.toLowerCase().includes('id');
    });
  }

  /**
   * Creates map visualization config for geographic data (Requirement 5.2)
   */
  private createMapConfig(
    data: Record<string, unknown>[],
    categories: AnalysisCategory[]
  ): VisualizationConfig {
    const latCol = Object.keys(data[0]).find(k => k.toLowerCase().includes('lat')) || 'LATITUDE';
    const lonCol = Object.keys(data[0]).find(k => k.toLowerCase().includes('lon')) || 'LONGITUDE';

    return {
      type: 'map',
      title: categories.includes('fraud_detection') ? 'Fraud Distribution Map' : 'Geographic Distribution',
      priority: 90,
      dataKey: 'main',
      config: {
        latField: latCol,
        lonField: lonCol,
        colorField: categories.includes('fraud_detection') ? 'RISK_SCORE' : undefined,
        clusterMarkers: data.length > 100,
      },
    };
  }

  /**
   * Creates photo gallery config for image data (Requirement 5.5)
   */
  private createPhotoGalleryConfig(data: Record<string, unknown>[]): VisualizationConfig {
    const urlCol = Object.keys(data[0]).find(k =>
      k.toLowerCase().includes('url') || k.toLowerCase().includes('image')
    ) || 'IMAGE_URL';

    return {
      type: 'photo_gallery',
      title: 'Photo Gallery',
      priority: 85,
      dataKey: 'main',
      config: {
        imageUrlField: urlCol,
        similarityField: 'SIMILARITY_SCORE',
      },
    };
  }

  /**
   * Creates heat map config for risk/anomaly data (Requirement 5.6)
   */
  private createHeatMapConfig(_data: Record<string, unknown>[]): VisualizationConfig {
    return {
      type: 'heat_map',
      title: 'Risk Heat Map',
      priority: 80,
      dataKey: 'main',
      config: {
        valueField: 'RISK_SCORE',
        colorScale: ['#22c55e', '#eab308', '#ef4444'],
      },
    };
  }

  /**
   * Creates time series line chart config (Requirement 5.3)
   */
  private createTimeSeriesConfig(
    data: Record<string, unknown>[],
    valueCol: string
  ): VisualizationConfig {
    const timeCol = Object.keys(data[0]).find(k =>
      k.toLowerCase().includes('date') || 
      k.toLowerCase().includes('time') || 
      k.toLowerCase() === 'created_at'
    ) || 'CREATED_AT';

    return {
      type: 'line_chart',
      title: 'Trend Over Time',
      priority: 70,
      dataKey: 'timeseries',
      config: {
        xField: timeCol,
        yField: valueCol,
      },
    };
  }

  /**
   * Creates bar chart config for categorical comparisons (Requirement 5.4)
   */
  private createBarChartConfig(
    _data: Record<string, unknown>[],
    categoryCol: string,
    valueCol: string
  ): VisualizationConfig {
    return {
      type: 'bar_chart',
      title: `${valueCol} by ${categoryCol}`,
      priority: 60,
      dataKey: 'main',
      config: {
        xField: categoryCol,
        yField: valueCol,
      },
    };
  }

  /**
   * Creates table config as fallback visualization
   */
  private createTableConfig(_data: Record<string, unknown>[]): VisualizationConfig {
    return {
      type: 'table',
      title: 'Data Table',
      priority: 10,
      dataKey: 'main',
      config: {
        pageSize: 20,
        sortable: true,
        filterable: true,
      },
    };
  }

  /**
   * Generates stats cards from data profile
   */
  private generateStatsCards(
    profile: DataProfile,
    _categories: AnalysisCategory[]
  ): StatsCard[] {
    const cards: StatsCard[] = [
      {
        label: 'Total Records',
        value: profile.recordCount.toLocaleString(),
        color: 'blue',
      },
    ];

    if (profile.anomalyCount !== undefined) {
      cards.push({
        label: 'Flagged Records',
        value: profile.anomalyCount,
        color: 'red',
      });

      const flaggedPercent = ((profile.anomalyCount / profile.recordCount) * 100).toFixed(1);
      cards.push({
        label: 'Flagged Rate',
        value: `${flaggedPercent}%`,
        color: profile.anomalyCount > profile.recordCount * 0.1 ? 'red' : 'green',
      });
    }

    // Add numeric column stats
    for (const stat of profile.columnStats) {
      if (stat.mean !== undefined && stat.columnName.includes('AMOUNT')) {
        cards.push({
          label: `Avg ${stat.columnName}`,
          value: stat.mean.toLocaleString(undefined, { maximumFractionDigits: 2 }),
          color: 'green',
        });
      }
    }

    return cards;
  }
}
