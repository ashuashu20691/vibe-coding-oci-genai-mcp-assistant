// src/services/intent-analyzer.ts

import {
  AnalysisCategory,
  Entity,
  EntityAttribute,
  Relationship,
  VisualizationGoal,
  AnalysisPlan,
} from '@/types';

export class IntentAnalyzer {
  private llmClient: any; // OCI GenAI client

  constructor(llmClient?: any) {
    this.llmClient = llmClient;
  }

  async analyze(naturalLanguageRequest: string): Promise<AnalysisPlan> {
    // First try keyword-based detection
    const categories = this.detectCategories(naturalLanguageRequest);
    
    // If LLM client available, use it for complex parsing
    if (this.llmClient) {
      const prompt = this.buildAnalysisPrompt(naturalLanguageRequest);
      const response = await this.llmClient.generate(prompt);
      return this.parseAnalysisPlan(response);
    }
    
    // Otherwise use keyword-based analysis
    return this.buildPlanFromKeywords(naturalLanguageRequest, categories);
  }

  private buildAnalysisPrompt(request: string): string {
    return `Analyze this data analysis request and extract structured information:

Request: "${request}"

Identify:
1. Analysis categories (fraud_detection, geographic_analysis, similarity_search, time_series, categorical_comparison, anomaly_detection)
2. Key entities and their attributes
3. Relationships between entities
4. Visualization goals
5. Any clarification needed

Respond in JSON format.`;
  }

  private parseAnalysisPlan(response: string): AnalysisPlan {
    try {
      const parsed = JSON.parse(response);
      return {
        categories: parsed.categories || [],
        entities: parsed.entities || [],
        relationships: parsed.relationships || [],
        visualizationGoals: parsed.visualizationGoals || [],
        suggestedQueries: parsed.suggestedQueries || [],
        clarificationNeeded: parsed.clarificationNeeded || false,
        clarificationQuestions: parsed.clarificationQuestions,
      };
    } catch {
      return {
        categories: ['categorical_comparison'],
        entities: [],
        relationships: [],
        visualizationGoals: [],
        suggestedQueries: [],
        clarificationNeeded: true,
        clarificationQuestions: ['Could you provide more details about your analysis needs?'],
      };
    }
  }

  detectCategories(request: string): AnalysisCategory[] {
    const categories: AnalysisCategory[] = [];
    const requestLower = request.toLowerCase();

    if (this.matchesKeywords(requestLower, ['fraud', 'suspicious', 'anomaly', 'unusual', 'risk', 'flagged'])) {
      categories.push('fraud_detection');
    }
    if (this.matchesKeywords(requestLower, ['sales', 'revenue', 'orders', 'customers', 'products', 'purchase', 'sell', 'sold', 'retail', 'commerce', 'ecommerce'])) {
      categories.push('sales_analysis');
    }
    if (this.matchesKeywords(requestLower, ['map', 'location', 'geographic', 'city', 'country', 'near', 'within', 'latitude', 'longitude', 'region'])) {
      categories.push('geographic_analysis');
    }
    if (this.matchesKeywords(requestLower, ['similar', 'like', 'matching', 'resembling', 'photo', 'image', 'vector', 'embedding'])) {
      categories.push('similarity_search');
    }
    if (this.matchesKeywords(requestLower, ['trend', 'over time', 'by year', 'by month', 'historical', 'time series', 'temporal'])) {
      categories.push('time_series');
    }
    if (this.matchesKeywords(requestLower, ['compare', 'breakdown', 'by category', 'distribution', 'group by'])) {
      categories.push('categorical_comparison');
    }
    if (this.matchesKeywords(requestLower, ['outlier', 'detect anomaly', 'abnormal', 'deviation'])) {
      categories.push('anomaly_detection');
    }

    return categories.length > 0 ? categories : ['categorical_comparison'];
  }

  private matchesKeywords(text: string, keywords: string[]): boolean {
    return keywords.some(k => text.includes(k));
  }


  private buildPlanFromKeywords(request: string, categories: AnalysisCategory[]): AnalysisPlan {
    const entities = this.extractEntities(request);
    const relationships = this.extractRelationships(request, entities);
    const visualizationGoals = this.determineVisualizationGoals(categories);

    return {
      categories,
      entities,
      relationships,
      visualizationGoals,
      suggestedQueries: [],
      clarificationNeeded: entities.length === 0,
      clarificationQuestions: entities.length === 0 
        ? ['What data entities would you like to analyze?'] 
        : undefined,
    };
  }

  private extractEntities(request: string): Entity[] {
    const entities: Entity[] = [];
    const requestLower = request.toLowerCase();

    // Common entity patterns
    const entityPatterns: Array<{ keywords: string[]; name: string; attributes: EntityAttribute[] }> = [
      {
        keywords: ['transaction', 'payment', 'transfer'],
        name: 'Transaction',
        attributes: [
          { name: 'amount', dataType: 'number', isRequired: true },
          { name: 'timestamp', dataType: 'date', isRequired: true },
          { name: 'source', dataType: 'string', isRequired: true },
          { name: 'destination', dataType: 'string', isRequired: true },
        ],
      },
      {
        keywords: ['sales', 'sale', 'order', 'purchase', 'revenue'],
        name: 'Sale',
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
      {
        keywords: ['wallet', 'account', 'user'],
        name: 'Wallet',
        attributes: [
          { name: 'address', dataType: 'string', isRequired: true },
          { name: 'owner', dataType: 'string', isRequired: false },
          { name: 'created_date', dataType: 'date', isRequired: true },
        ],
      },
      {
        keywords: ['photo', 'image', 'picture'],
        name: 'Photo',
        attributes: [
          { name: 'url', dataType: 'string', isRequired: true },
          { name: 'title', dataType: 'string', isRequired: false },
          { name: 'embedding', dataType: 'embedding', isRequired: false },
        ],
      },
      {
        keywords: ['location', 'place', 'city', 'store'],
        name: 'Location',
        attributes: [
          { name: 'name', dataType: 'string', isRequired: true },
          { name: 'latitude', dataType: 'coordinates', isRequired: true },
          { name: 'longitude', dataType: 'coordinates', isRequired: true },
        ],
      },
    ];

    for (const pattern of entityPatterns) {
      if (pattern.keywords.some(k => requestLower.includes(k))) {
        entities.push({
          name: pattern.name,
          type: entities.length === 0 ? 'primary' : 'related',
          attributes: pattern.attributes,
        });
      }
    }

    // If no entities found, create a generic one
    if (entities.length === 0) {
      entities.push({
        name: 'Data',
        type: 'primary',
        attributes: [
          { name: 'value', dataType: 'number', isRequired: true },
          { name: 'category', dataType: 'string', isRequired: false },
          { name: 'timestamp', dataType: 'date', isRequired: false },
        ],
      });
    }

    return entities;
  }

  private extractRelationships(_request: string, entities: Entity[]): Relationship[] {
    const relationships: Relationship[] = [];

    // If we have Transaction and Wallet, create relationship
    const hasTransaction = entities.some(e => e.name === 'Transaction');
    const hasWallet = entities.some(e => e.name === 'Wallet');

    if (hasTransaction && hasWallet) {
      relationships.push({
        from: 'Transaction',
        to: 'Wallet',
        type: 'many_to_many',
        foreignKey: 'SOURCE',
      });
    }

    return relationships;
  }

  private determineVisualizationGoals(categories: AnalysisCategory[]): VisualizationGoal[] {
    const goals: VisualizationGoal[] = [];
    let priority = 1;

    if (categories.includes('geographic_analysis')) {
      goals.push({
        type: 'geographic',
        priority: priority++,
        description: 'Display data on interactive map',
      });
    }

    if (categories.includes('fraud_detection') || categories.includes('anomaly_detection')) {
      goals.push({
        type: 'anomaly',
        priority: priority++,
        description: 'Highlight anomalies and risk scores',
      });
    }

    if (categories.includes('sales_analysis')) {
      goals.push({
        type: 'comparison',
        priority: priority++,
        description: 'Compare sales by category and region',
      });
      goals.push({
        type: 'temporal',
        priority: priority++,
        description: 'Show sales trends over time',
      });
    }

    if (categories.includes('time_series')) {
      goals.push({
        type: 'temporal',
        priority: priority++,
        description: 'Show trends over time',
      });
    }

    if (categories.includes('similarity_search')) {
      goals.push({
        type: 'similarity',
        priority: priority++,
        description: 'Display similar items with scores',
      });
    }

    if (categories.includes('categorical_comparison')) {
      goals.push({
        type: 'comparison',
        priority: priority++,
        description: 'Compare categories and distributions',
      });
    }

    // Always add distribution as fallback
    if (goals.length === 0) {
      goals.push({
        type: 'distribution',
        priority: 1,
        description: 'Show data distribution',
      });
    }

    return goals;
  }
}
