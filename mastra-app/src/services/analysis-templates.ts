// src/services/analysis-templates.ts

import { Entity, Relationship, VisualizationGoal, AnalysisCategory } from '@/types';

export interface AnalysisTemplate {
  name: string;
  description: string;
  categories: AnalysisCategory[];
  entities: Entity[];
  relationships: Relationship[];
  visualizationGoals: VisualizationGoal[];
  defaultRecordCount: number;
}

export const FRAUD_DETECTION_TEMPLATE: AnalysisTemplate = {
  name: 'Fraud Detection',
  description: 'Analyze transactions for suspicious patterns and anomalies',
  categories: ['fraud_detection', 'geographic_analysis'],
  entities: [
    {
      name: 'Transaction',
      type: 'primary',
      attributes: [
        { name: 'transaction_id', dataType: 'string', isRequired: true },
        { name: 'amount', dataType: 'number', isRequired: true },
        { name: 'currency', dataType: 'string', isRequired: true },
        { name: 'source_wallet', dataType: 'string', isRequired: true },
        { name: 'destination_wallet', dataType: 'string', isRequired: true },
        { name: 'transaction_time', dataType: 'date', isRequired: true },
        { name: 'latitude', dataType: 'coordinates', isRequired: false },
        { name: 'longitude', dataType: 'coordinates', isRequired: false },
      ],
    },
    {
      name: 'Wallet',
      type: 'related',
      attributes: [
        { name: 'wallet_address', dataType: 'string', isRequired: true },
        { name: 'owner_name', dataType: 'string', isRequired: false },
        { name: 'created_date', dataType: 'date', isRequired: true },
        { name: 'country', dataType: 'string', isRequired: false },
      ],
    },
  ],
  relationships: [
    { from: 'Transaction', to: 'Wallet', type: 'many_to_many', foreignKey: 'SOURCE_WALLET' },
  ],
  visualizationGoals: [
    { type: 'geographic', priority: 1, description: 'Show fraud distribution on map' },
    { type: 'anomaly', priority: 2, description: 'Highlight high-risk transactions' },
    { type: 'temporal', priority: 3, description: 'Show fraud trends over time' },
  ],
  defaultRecordCount: 500,
};

export const GEOGRAPHIC_ANALYSIS_TEMPLATE: AnalysisTemplate = {
  name: 'Geographic Analysis',
  description: 'Analyze data with location-based filtering and visualization',
  categories: ['geographic_analysis'],
  entities: [
    {
      name: 'Location',
      type: 'primary',
      attributes: [
        { name: 'name', dataType: 'string', isRequired: true },
        { name: 'latitude', dataType: 'coordinates', isRequired: true },
        { name: 'longitude', dataType: 'coordinates', isRequired: true },
        { name: 'category', dataType: 'string', isRequired: false },
        { name: 'value', dataType: 'number', isRequired: false },
      ],
    },
  ],
  relationships: [],
  visualizationGoals: [
    { type: 'geographic', priority: 1, description: 'Display locations on interactive map' },
    { type: 'distribution', priority: 2, description: 'Show distribution by category' },
  ],
  defaultRecordCount: 200,
};


export const SIMILARITY_SEARCH_TEMPLATE: AnalysisTemplate = {
  name: 'Similarity Search',
  description: 'Find and display similar items using vector embeddings',
  categories: ['similarity_search'],
  entities: [
    {
      name: 'Photo',
      type: 'primary',
      attributes: [
        { name: 'image_url', dataType: 'string', isRequired: true },
        { name: 'title', dataType: 'string', isRequired: false },
        { name: 'embedding', dataType: 'embedding', isRequired: true },
        { name: 'view_count', dataType: 'number', isRequired: false },
        { name: 'latitude', dataType: 'coordinates', isRequired: false },
        { name: 'longitude', dataType: 'coordinates', isRequired: false },
        { name: 'capture_date', dataType: 'date', isRequired: false },
      ],
    },
  ],
  relationships: [],
  visualizationGoals: [
    { type: 'similarity', priority: 1, description: 'Display photo gallery with similarity scores' },
    { type: 'geographic', priority: 2, description: 'Show photo locations on map' },
  ],
  defaultRecordCount: 100,
};

export const TIME_SERIES_TEMPLATE: AnalysisTemplate = {
  name: 'Time Series Analysis',
  description: 'Analyze trends and patterns over time',
  categories: ['time_series'],
  entities: [
    {
      name: 'Measurement',
      type: 'primary',
      attributes: [
        { name: 'timestamp', dataType: 'date', isRequired: true },
        { name: 'value', dataType: 'number', isRequired: true },
        { name: 'category', dataType: 'string', isRequired: false },
        { name: 'location', dataType: 'string', isRequired: false },
      ],
    },
  ],
  relationships: [],
  visualizationGoals: [
    { type: 'temporal', priority: 1, description: 'Show trends over time' },
    { type: 'comparison', priority: 2, description: 'Compare categories' },
  ],
  defaultRecordCount: 365,
};

export const SALES_ANALYSIS_TEMPLATE: AnalysisTemplate = {
  name: 'Sales Analysis',
  description: 'Analyze sales data with products, customers, and revenue metrics',
  categories: ['sales_analysis', 'time_series'],
  entities: [
    {
      name: 'Sale',
      type: 'primary',
      attributes: [
        { name: 'sale_id', dataType: 'string', isRequired: true },
        { name: 'product_name', dataType: 'string', isRequired: true },
        { name: 'category', dataType: 'string', isRequired: true },
        { name: 'quantity', dataType: 'number', isRequired: true },
        { name: 'unit_price', dataType: 'number', isRequired: true },
        { name: 'total_amount', dataType: 'number', isRequired: true },
        { name: 'customer_name', dataType: 'string', isRequired: true },
        { name: 'region', dataType: 'string', isRequired: true },
        { name: 'sale_date', dataType: 'date', isRequired: true },
      ],
    },
  ],
  relationships: [],
  visualizationGoals: [
    { type: 'comparison', priority: 1, description: 'Compare sales by category and region' },
    { type: 'temporal', priority: 2, description: 'Show sales trends over time' },
    { type: 'distribution', priority: 3, description: 'Show revenue distribution' },
  ],
  defaultRecordCount: 200,
};

export function getTemplateForCategories(categories: AnalysisCategory[]): AnalysisTemplate | null {
  if (categories.includes('fraud_detection')) {
    return FRAUD_DETECTION_TEMPLATE;
  }
  if (categories.includes('sales_analysis')) {
    return SALES_ANALYSIS_TEMPLATE;
  }
  if (categories.includes('similarity_search')) {
    return SIMILARITY_SEARCH_TEMPLATE;
  }
  if (categories.includes('geographic_analysis')) {
    return GEOGRAPHIC_ANALYSIS_TEMPLATE;
  }
  if (categories.includes('time_series')) {
    return TIME_SERIES_TEMPLATE;
  }
  return null;
}

// Get all available templates
export function getAllTemplates(): AnalysisTemplate[] {
  return [
    FRAUD_DETECTION_TEMPLATE,
    SALES_ANALYSIS_TEMPLATE,
    GEOGRAPHIC_ANALYSIS_TEMPLATE,
    SIMILARITY_SEARCH_TEMPLATE,
    TIME_SERIES_TEMPLATE,
  ];
}

// Get template by name
export function getTemplateByName(name: string): AnalysisTemplate | null {
  const templates = getAllTemplates();
  return templates.find(t => t.name.toLowerCase() === name.toLowerCase()) || null;
}
