'use client';

import { useState, useCallback } from 'react';
import { SQLPlayground } from './SQLPlayground';
import { 
  MultiModalQueryBuilder, 
  MultiModalQueryConfig,
  VectorEmbedding,
  GeospatialFilter,
  TemporalFilter,
  QualityFilter,
  RankingConfig
} from '@/services/multi-modal-query-builder';
import { imageEmbeddingService } from '@/services/image-embedding-service';

export interface MultiModalSQLPlaygroundProps {
  connectionName?: string;
}

/**
 * MultiModalSQLPlayground component provides an enhanced SQL editor with
 * multi-modal query building capabilities including vector search, geospatial
 * filtering, and temporal analysis.
 * 
 * Requirements: 2.2, 2.6, 7.2
 */
export function MultiModalSQLPlayground({ connectionName }: MultiModalSQLPlaygroundProps) {
  const [showBuilder, setShowBuilder] = useState(false);
  const [generatedSQL, setGeneratedSQL] = useState('');
  const [queryConfig, setQueryConfig] = useState<Partial<MultiModalQueryConfig>>({
    tableName: '',
  });

  const queryBuilder = new MultiModalQueryBuilder();

  /**
   * Generate SQL from the multi-modal configuration
   * Requirement 2.2: Combine vector search + spatial + temporal filters
   * Requirement 2.6: Generate combined vector + spatial + temporal SQL
   */
  const generateSQL = useCallback(() => {
    try {
      if (!queryConfig.tableName) {
        alert('Please enter a table name');
        return;
      }

      // Requirement 2.6: Generate combined vector + spatial + temporal SQL
      const sql = queryBuilder.buildQuery(queryConfig as MultiModalQueryConfig);
      setGeneratedSQL(sql);
      setShowBuilder(false);
      
      console.log('[MultiModalSQLPlayground] Generated multi-modal SQL:', {
        hasVectorSearch: !!queryConfig.queryEmbedding,
        hasGeospatialFilter: !!queryConfig.geospatialFilter,
        hasTemporalFilter: !!queryConfig.temporalFilter,
        hasQualityFilters: (queryConfig.qualityFilters?.length || 0) > 0,
        hasRanking: !!queryConfig.ranking,
      });
    } catch (error) {
      alert(`Error generating SQL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [queryConfig, queryBuilder]);

  /**
   * Handle image upload for embedding generation
   * Requirement 2.1: Image embedding generation
   * Requirement 2.2: Pass embedding to query builder
   * Requirement 2.6: Generate combined vector + spatial + temporal SQL
   */
  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Generate actual embedding using the image embedding service
      // Requirement 2.1: Connect image upload to embedding service
      const embedding = await imageEmbeddingService.generateEmbedding(
        file,
        (message) => {
          console.log('[MultiModalSQLPlayground] Embedding progress:', message);
        }
      );

      // Requirement 2.2: Pass embedding to query builder
      setQueryConfig(prev => ({
        ...prev,
        queryEmbedding: embedding,
        vectorColumn: 'embedding_vector',
        distanceMetric: 'COSINE',
      }));

      alert(`Image embedding generated: ${embedding.dimensions} dimensions. Configure other filters and generate SQL.`);
    } catch (error) {
      alert(`Error processing image: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, []);

  /**
   * Handle location geocoding
   * Requirement 3.1: Location name to coordinates conversion
   */
  const handleLocationGeocode = useCallback(async (locationName: string) => {
    try {
      const coords = await queryBuilder.geocodeLocation(locationName);
      
      setQueryConfig(prev => ({
        ...prev,
        geospatialFilter: {
          ...prev.geospatialFilter,
          latitude: coords.latitude,
          longitude: coords.longitude,
        } as GeospatialFilter,
      }));

      alert(`Location "${locationName}" geocoded to: ${coords.latitude}, ${coords.longitude}`);
    } catch (error) {
      alert(`Error geocoding location: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [queryBuilder]);

  if (!showBuilder) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <span className="text-sm text-gray-600">Standard SQL Mode</span>
          <button
            onClick={() => setShowBuilder(true)}
            className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            🔮 Multi-Modal Query Builder
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <SQLPlayground connectionName={connectionName} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 bg-purple-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔮</span>
          <span className="font-semibold text-gray-800">Multi-Modal Query Builder</span>
        </div>
        <button
          onClick={() => setShowBuilder(false)}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
        >
          ← Back to SQL Editor
        </button>
      </div>

      {/* Builder Form */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Table Name */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Table Name *
            </label>
            <input
              type="text"
              value={queryConfig.tableName || ''}
              onChange={e => setQueryConfig(prev => ({ ...prev, tableName: e.target.value }))}
              placeholder="e.g., photos, products, locations"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Vector Search */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">🖼️ Vector Similarity Search</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-2">Upload Query Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="text-sm"
                />
                {queryConfig.queryEmbedding && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ Embedding generated ({queryConfig.queryEmbedding.dimensions} dimensions)
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-2">Vector Column Name</label>
                <input
                  type="text"
                  value={queryConfig.vectorColumn || ''}
                  onChange={e => setQueryConfig(prev => ({ ...prev, vectorColumn: e.target.value }))}
                  placeholder="e.g., embedding_vector"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-2">Distance Metric</label>
                <select
                  value={queryConfig.distanceMetric || 'COSINE'}
                  onChange={e => setQueryConfig(prev => ({ ...prev, distanceMetric: e.target.value as 'COSINE' | 'EUCLIDEAN' | 'DOT' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="COSINE">Cosine</option>
                  <option value="EUCLIDEAN">Euclidean</option>
                  <option value="DOT">Dot Product</option>
                </select>
              </div>
            </div>
          </div>

          {/* Geospatial Filter */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">📍 Geospatial Filter</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-2">Location Name</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="locationName"
                    placeholder="e.g., Delhi, New York, London"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={() => {
                      const input = document.getElementById('locationName') as HTMLInputElement;
                      if (input.value) handleLocationGeocode(input.value);
                    }}
                    className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    Geocode
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={queryConfig.geospatialFilter?.latitude || ''}
                    onChange={e => setQueryConfig(prev => ({
                      ...prev,
                      geospatialFilter: {
                        ...prev.geospatialFilter,
                        latitude: parseFloat(e.target.value),
                        type: 'distance',
                        radius: prev.geospatialFilter?.radius || 10,
                        unit: prev.geospatialFilter?.unit || 'miles',
                      } as GeospatialFilter,
                    }))}
                    placeholder="e.g., 28.6139"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={queryConfig.geospatialFilter?.longitude || ''}
                    onChange={e => setQueryConfig(prev => ({
                      ...prev,
                      geospatialFilter: {
                        ...prev.geospatialFilter,
                        longitude: parseFloat(e.target.value),
                        type: 'distance',
                        radius: prev.geospatialFilter?.radius || 10,
                        unit: prev.geospatialFilter?.unit || 'miles',
                      } as GeospatialFilter,
                    }))}
                    placeholder="e.g., 77.2090"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Radius</label>
                  <input
                    type="number"
                    value={queryConfig.geospatialFilter?.radius || ''}
                    onChange={e => setQueryConfig(prev => ({
                      ...prev,
                      geospatialFilter: {
                        ...prev.geospatialFilter,
                        radius: parseFloat(e.target.value),
                        type: 'distance',
                        latitude: prev.geospatialFilter?.latitude || 0,
                        longitude: prev.geospatialFilter?.longitude || 0,
                        unit: prev.geospatialFilter?.unit || 'miles',
                      } as GeospatialFilter,
                    }))}
                    placeholder="e.g., 20"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Unit</label>
                  <select
                    value={queryConfig.geospatialFilter?.unit || 'miles'}
                    onChange={e => setQueryConfig(prev => ({
                      ...prev,
                      geospatialFilter: {
                        ...prev.geospatialFilter,
                        unit: e.target.value as 'miles' | 'km',
                        type: 'distance',
                        radius: prev.geospatialFilter?.radius || 10,
                        latitude: prev.geospatialFilter?.latitude || 0,
                        longitude: prev.geospatialFilter?.longitude || 0,
                      } as GeospatialFilter,
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="miles">Miles</option>
                    <option value="km">Kilometers</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Temporal Filter */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">📅 Temporal Filter</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-2">Date Column</label>
                <input
                  type="text"
                  value={queryConfig.temporalFilter?.column || ''}
                  onChange={e => setQueryConfig(prev => ({
                    ...prev,
                    temporalFilter: {
                      ...prev.temporalFilter,
                      column: e.target.value,
                      operator: prev.temporalFilter?.operator || 'gte',
                      value: prev.temporalFilter?.value || new Date(),
                    } as TemporalFilter,
                  }))}
                  placeholder="e.g., created_at, taken_at"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-2">Past Years (relative)</label>
                <input
                  type="number"
                  value={queryConfig.temporalFilter?.intervalYears || ''}
                  onChange={e => setQueryConfig(prev => ({
                    ...prev,
                    temporalFilter: {
                      ...prev.temporalFilter,
                      column: prev.temporalFilter?.column || 'created_at',
                      operator: 'gte',
                      value: new Date(),
                      intervalYears: parseInt(e.target.value),
                    } as TemporalFilter,
                  }))}
                  placeholder="e.g., 5 (for last 5 years)"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Quality Filters */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">⭐ Quality Filters</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Column</label>
                  <input
                    type="text"
                    placeholder="e.g., views"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    id="qualityColumn"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Operator</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    id="qualityOperator"
                  >
                    <option value="gte">≥</option>
                    <option value="gt">&gt;</option>
                    <option value="lte">≤</option>
                    <option value="lt">&lt;</option>
                    <option value="eq">=</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Value</label>
                  <input
                    type="number"
                    placeholder="e.g., 100"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    id="qualityValue"
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  const column = (document.getElementById('qualityColumn') as HTMLInputElement).value;
                  const operator = (document.getElementById('qualityOperator') as HTMLSelectElement).value;
                  const value = parseFloat((document.getElementById('qualityValue') as HTMLInputElement).value);
                  
                  if (column && !isNaN(value)) {
                    setQueryConfig(prev => ({
                      ...prev,
                      qualityFilters: [
                        ...(prev.qualityFilters || []),
                        { column, operator: operator as QualityFilter['operator'], value },
                      ],
                    }));
                    
                    // Clear inputs
                    (document.getElementById('qualityColumn') as HTMLInputElement).value = '';
                    (document.getElementById('qualityValue') as HTMLInputElement).value = '';
                  }
                }}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                + Add Filter
              </button>
              {queryConfig.qualityFilters && queryConfig.qualityFilters.length > 0 && (
                <div className="mt-2 space-y-1">
                  {queryConfig.qualityFilters.map((filter, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded text-sm">
                      <span>{filter.column} {filter.operator} {filter.value}</span>
                      <button
                        onClick={() => setQueryConfig(prev => ({
                          ...prev,
                          qualityFilters: prev.qualityFilters?.filter((_, i) => i !== idx),
                        }))}
                        className="text-red-600 hover:text-red-800"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Ranking */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">🏆 Ranking (Window Functions)</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-2">Partition By (comma-separated)</label>
                <input
                  type="text"
                  value={queryConfig.ranking?.partitionBy.join(', ') || ''}
                  onChange={e => setQueryConfig(prev => ({
                    ...prev,
                    ranking: {
                      ...prev.ranking,
                      partitionBy: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                      orderBy: prev.ranking?.orderBy || { column: 'similarity_score', direction: 'ASC' },
                      limit: prev.ranking?.limit || 5,
                    } as RankingConfig,
                  }))}
                  placeholder="e.g., EXTRACT(YEAR FROM taken_at)"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm text-gray-600 mb-2">Order By Column</label>
                  <input
                    type="text"
                    value={queryConfig.ranking?.orderBy.column || ''}
                    onChange={e => setQueryConfig(prev => ({
                      ...prev,
                      ranking: {
                        ...prev.ranking,
                        partitionBy: prev.ranking?.partitionBy || [],
                        orderBy: {
                          column: e.target.value,
                          direction: prev.ranking?.orderBy.direction || 'ASC',
                        },
                        limit: prev.ranking?.limit || 5,
                      } as RankingConfig,
                    }))}
                    placeholder="e.g., similarity_score"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Direction</label>
                  <select
                    value={queryConfig.ranking?.orderBy.direction || 'ASC'}
                    onChange={e => setQueryConfig(prev => ({
                      ...prev,
                      ranking: {
                        ...prev.ranking,
                        partitionBy: prev.ranking?.partitionBy || [],
                        orderBy: {
                          column: prev.ranking?.orderBy.column || 'similarity_score',
                          direction: e.target.value as 'ASC' | 'DESC',
                        },
                        limit: prev.ranking?.limit || 5,
                      } as RankingConfig,
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="ASC">ASC</option>
                    <option value="DESC">DESC</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-2">Top N per Group</label>
                <input
                  type="number"
                  value={queryConfig.ranking?.limit || ''}
                  onChange={e => setQueryConfig(prev => ({
                    ...prev,
                    ranking: {
                      ...prev.ranking,
                      partitionBy: prev.ranking?.partitionBy || [],
                      orderBy: prev.ranking?.orderBy || { column: 'similarity_score', direction: 'ASC' },
                      limit: parseInt(e.target.value),
                    } as RankingConfig,
                  }))}
                  placeholder="e.g., 5"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <div className="flex gap-3">
            <button
              onClick={generateSQL}
              className="flex-1 px-4 py-3 bg-purple-600 text-white font-medium rounded hover:bg-purple-700 transition-colors"
            >
              🔮 Generate Multi-Modal SQL
            </button>
          </div>

          {/* Generated SQL Preview */}
          {generatedSQL && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Generated SQL:</h3>
              <pre className="text-xs bg-white p-3 rounded border border-gray-200 overflow-x-auto">
                {generatedSQL}
              </pre>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedSQL);
                  alert('SQL copied to clipboard!');
                }}
                className="mt-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                📋 Copy to Clipboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
