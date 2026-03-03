// src/services/multi-modal-query-builder.ts
/**
 * Multi-Modal Query Builder Service
 * Constructs complex SQL queries combining vector similarity search, geospatial filtering,
 * and temporal analysis in a single query with window functions for ranking.
 * 
 * Requirements: 2.2, 2.6, 3.1, 3.2, 3.3, 3.4, 6.3
 */

/**
 * Vector embedding for similarity search
 */
export interface VectorEmbedding {
  dimensions: number;
  values: number[];
}

/**
 * Geospatial filter configuration
 */
export interface GeospatialFilter {
  type: 'distance' | 'within';
  locationName?: string;
  latitude?: number;
  longitude?: number;
  radius: number;
  unit: 'miles' | 'km';
}

/**
 * Temporal filter configuration
 */
export interface TemporalFilter {
  column: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'between';
  value: Date | { start: Date; end: Date };
  intervalYears?: number;
}

/**
 * Quality filter configuration
 */
export interface QualityFilter {
  column: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
  value: number;
}

/**
 * Ranking configuration for window functions
 */
export interface RankingConfig {
  partitionBy: string[];
  orderBy: { column: string; direction: 'ASC' | 'DESC' };
  limit: number;
}

/**
 * Multi-modal query configuration
 */
export interface MultiModalQueryConfig {
  tableName: string;
  vectorColumn?: string;
  queryEmbedding?: VectorEmbedding;
  distanceMetric?: 'COSINE' | 'EUCLIDEAN' | 'DOT';
  geospatialFilter?: GeospatialFilter;
  temporalFilter?: TemporalFilter;
  qualityFilters?: QualityFilter[];
  ranking?: RankingConfig;
  limit?: number;
}

/**
 * Multi-Modal Query Builder
 * Generates Oracle SQL queries combining vector search, spatial, and temporal filters
 */
export class MultiModalQueryBuilder {
  /**
   * Build a complete multi-modal SQL query
   * Combines vector similarity, geospatial filtering, temporal filtering, and ranking
   * 
   * Requirements: 2.2, 2.6, 3.2, 6.3
   */
  buildQuery(config: MultiModalQueryConfig): string {
    const { tableName, ranking } = config;

    // Build the main SELECT clause
    const selectClause = this.buildSelectClause(config);

    // Build FROM clause
    const fromClause = `FROM ${tableName}`;

    // Build WHERE clause combining all filters
    const whereClause = this.buildWhereClause(config);

    // If ranking is requested, wrap in a subquery with ROW_NUMBER()
    if (ranking) {
      return this.buildRankedQuery(selectClause, fromClause, whereClause, config);
    }

    // Build ORDER BY clause
    const orderByClause = this.buildOrderByClause(config);

    // Build LIMIT clause
    const limitClause = config.limit ? `FETCH FIRST ${config.limit} ROWS ONLY` : '';

    // Combine all parts
    const parts = [
      selectClause,
      fromClause,
      whereClause,
      orderByClause,
      limitClause,
    ].filter(Boolean);

    return parts.join('\n');
  }

  /**
   * Build SELECT clause with calculated columns
   * Includes vector similarity score and distance calculations
   */
  private buildSelectClause(config: MultiModalQueryConfig): string {
    const columns: string[] = ['*'];

    // Add vector similarity score if vector search is enabled
    if (config.queryEmbedding && config.vectorColumn) {
      const vectorLiteral = this.buildVectorLiteral(config.queryEmbedding);
      const metric = config.distanceMetric || 'COSINE';
      columns.push(
        `VECTOR_DISTANCE(${config.vectorColumn}, ${vectorLiteral}, ${metric}) AS similarity_score`
      );
    }

    // Add distance calculation if geospatial filter is present
    if (config.geospatialFilter) {
      const distanceCalc = this.buildDistanceCalculation(config.geospatialFilter);
      columns.push(`${distanceCalc} AS distance_${config.geospatialFilter.unit}`);
    }

    return `SELECT ${columns.join(', ')}`;
  }

  /**
   * Build WHERE clause combining all filters
   * Requirements: 2.2, 3.2
   */
  private buildWhereClause(config: MultiModalQueryConfig): string {
    const conditions: string[] = [];

    // Add geospatial filter
    if (config.geospatialFilter) {
      conditions.push(this.buildGeospatialCondition(config.geospatialFilter));
    }

    // Add temporal filter
    if (config.temporalFilter) {
      conditions.push(this.buildTemporalCondition(config.temporalFilter));
    }

    // Add quality filters
    if (config.qualityFilters && config.qualityFilters.length > 0) {
      config.qualityFilters.forEach(filter => {
        conditions.push(this.buildQualityCondition(filter));
      });
    }

    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  }

  /**
   * Build ORDER BY clause
   * Prioritizes similarity score if vector search is enabled
   */
  private buildOrderByClause(config: MultiModalQueryConfig): string {
    if (config.queryEmbedding && config.vectorColumn) {
      return 'ORDER BY similarity_score ASC'; // Lower distance = more similar
    }
    return '';
  }

  /**
   * Build ranked query using window functions
   * Uses ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...)
   * 
   * Requirement 6.3: Window functions for ranking within groups
   */
  private buildRankedQuery(
    selectClause: string,
    fromClause: string,
    whereClause: string,
    config: MultiModalQueryConfig
  ): string {
    const { ranking } = config;
    if (!ranking) return '';

    const partitionClause = ranking.partitionBy.join(', ');
    const orderColumn = ranking.orderBy.column;
    const orderDirection = ranking.orderBy.direction;

    // Build inner query with ROW_NUMBER()
    const innerQuery = `
SELECT 
  subq.*,
  ROW_NUMBER() OVER (
    PARTITION BY ${partitionClause}
    ORDER BY ${orderColumn} ${orderDirection}
  ) AS row_num
FROM (
  ${selectClause}
  ${fromClause}
  ${whereClause}
) subq`;

    // Outer query filters by row_num
    return `
SELECT *
FROM (
${innerQuery}
)
WHERE row_num <= ${ranking.limit}
ORDER BY ${partitionClause}, row_num`;
  }

  /**
   * Build Oracle VECTOR literal from embedding
   * Format: VECTOR('[1.0, 2.0, 3.0]', 3, FLOAT32)
   */
  private buildVectorLiteral(embedding: VectorEmbedding): string {
    const values = embedding.values.join(', ');
    return `VECTOR('[${values}]', ${embedding.dimensions}, FLOAT32)`;
  }

  /**
   * Build geospatial condition using SDO_WITHIN_DISTANCE
   * Requirement 3.2: Generate SDO_WITHIN_DISTANCE predicates
   */
  private buildGeospatialCondition(filter: GeospatialFilter): string {
    const { latitude, longitude, radius, unit } = filter;

    if (latitude === undefined || longitude === undefined) {
      throw new Error('Latitude and longitude are required for geospatial filtering');
    }

    // Convert radius to meters for Oracle Spatial
    const radiusMeters = unit === 'miles' ? this.milesToMeters(radius) : this.kmToMeters(radius);

    // Build SDO_GEOMETRY point
    const point = this.buildSDOGeometryPoint(latitude, longitude);

    // Build SDO_WITHIN_DISTANCE predicate
    return `SDO_WITHIN_DISTANCE(location, ${point}, 'distance=${radiusMeters} unit=M') = 'TRUE'`;
  }

  /**
   * Build SDO_GEOMETRY point literal
   * Requirement 3.2: Generate SDO_GEOMETRY point literals
   */
  buildSDOGeometryPoint(latitude: number, longitude: number): string {
    return `SDO_GEOMETRY(2001, 4326, SDO_POINT_TYPE(${longitude}, ${latitude}, NULL), NULL, NULL)`;
  }

  /**
   * Build distance calculation for display
   * Uses SDO_GEOM.SDO_DISTANCE for accurate distance
   */
  private buildDistanceCalculation(filter: GeospatialFilter): string {
    const { latitude, longitude, unit } = filter;

    if (latitude === undefined || longitude === undefined) {
      throw new Error('Latitude and longitude are required for distance calculation');
    }

    const point = this.buildSDOGeometryPoint(latitude, longitude);
    const distanceMeters = `SDO_GEOM.SDO_DISTANCE(location, ${point}, 0.005, 'unit=M')`;

    // Convert to requested unit
    if (unit === 'miles') {
      return `(${distanceMeters} * 0.000621371)`; // meters to miles
    } else {
      return `(${distanceMeters} * 0.001)`; // meters to km
    }
  }

  /**
   * Build temporal condition
   * Supports various date comparison operators
   */
  private buildTemporalCondition(filter: TemporalFilter): string {
    const { column, operator, value, intervalYears } = filter;

    if (intervalYears !== undefined) {
      // Use INTERVAL for relative date filtering
      return `${column} >= SYSDATE - INTERVAL '${intervalYears}' YEAR`;
    }

    if (operator === 'between' && typeof value === 'object' && 'start' in value) {
      const start = this.formatDate(value.start);
      const end = this.formatDate(value.end);
      return `${column} BETWEEN TO_DATE('${start}', 'YYYY-MM-DD') AND TO_DATE('${end}', 'YYYY-MM-DD')`;
    }

    const dateValue = this.formatDate(value as Date);
    const operatorMap = {
      gt: '>',
      gte: '>=',
      lt: '<',
      lte: '<=',
    };

    return `${column} ${operatorMap[operator]} TO_DATE('${dateValue}', 'YYYY-MM-DD')`;
  }

  /**
   * Build quality filter condition
   */
  private buildQualityCondition(filter: QualityFilter): string {
    const { column, operator, value } = filter;

    const operatorMap = {
      gt: '>',
      gte: '>=',
      lt: '<',
      lte: '<=',
      eq: '=',
    };

    return `${column} ${operatorMap[operator]} ${value}`;
  }

  /**
   * Convert miles to meters
   * Requirement 3.4: Distance unit conversion
   */
  milesToMeters(miles: number): number {
    return miles * 1609.34;
  }

  /**
   * Convert kilometers to meters
   * Requirement 3.4: Distance unit conversion
   */
  kmToMeters(km: number): number {
    return km * 1000;
  }

  /**
   * Convert meters to miles
   * Requirement 3.4: Distance unit conversion
   */
  metersToMiles(meters: number): number {
    return meters * 0.000621371;
  }

  /**
   * Convert meters to kilometers
   * Requirement 3.4: Distance unit conversion
   */
  metersToKm(meters: number): number {
    return meters * 0.001;
  }

  /**
   * Format Date object to YYYY-MM-DD string
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Convert location name to coordinates (geocoding)
   * This is a placeholder - in production, would call a geocoding service
   * Requirement 3.1: Location name to coordinates conversion
   */
  async geocodeLocation(locationName: string): Promise<{ latitude: number; longitude: number }> {
    // Placeholder implementation with common locations
    const knownLocations: Record<string, { latitude: number; longitude: number }> = {
      'delhi': { latitude: 28.6139, longitude: 77.2090 },
      'new delhi': { latitude: 28.6139, longitude: 77.2090 },
      'mumbai': { latitude: 19.0760, longitude: 72.8777 },
      'bangalore': { latitude: 12.9716, longitude: 77.5946 },
      'london': { latitude: 51.5074, longitude: -0.1278 },
      'new york': { latitude: 40.7128, longitude: -74.0060 },
      'san francisco': { latitude: 37.7749, longitude: -122.4194 },
      'tokyo': { latitude: 35.6762, longitude: 139.6503 },
      'paris': { latitude: 48.8566, longitude: 2.3522 },
    };

    const normalized = locationName.toLowerCase().trim();
    const coords = knownLocations[normalized];

    if (!coords) {
      throw new Error(`Location "${locationName}" not found. Please provide latitude and longitude directly.`);
    }

    return coords;
  }

  /**
   * Build a geospatial query with distance filtering
   * Standalone method for geospatial-only queries
   * Requirements: 3.1, 3.2, 3.3, 3.4
   */
  buildGeospatialQuery(
    tableName: string,
    locationColumn: string,
    filter: GeospatialFilter,
    additionalColumns?: string[]
  ): string {
    const { latitude, longitude, radius, unit } = filter;

    if (latitude === undefined || longitude === undefined) {
      throw new Error('Latitude and longitude are required for geospatial query');
    }

    // Build SELECT clause
    const columns = ['*', ...(additionalColumns || [])];
    const distanceCalc = this.buildDistanceCalculation(filter);
    columns.push(`${distanceCalc} AS distance_${unit}`);

    // Build WHERE clause
    const whereCondition = this.buildGeospatialCondition(filter);

    // Build complete query
    return `
SELECT ${columns.join(', ')}
FROM ${tableName}
${whereCondition ? `WHERE ${whereCondition}` : ''}
ORDER BY distance_${unit} ASC`;
  }

  /**
   * Validate coordinates are within valid ranges
   * Latitude: -90 to 90, Longitude: -180 to 180
   */
  validateCoordinates(latitude: number, longitude: number): boolean {
    return (
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    );
  }

  /**
   * Calculate distance between two points using Haversine formula
   * Returns distance in kilometers
   * Requirement 3.4: Distance calculations
   */
  calculateHaversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
