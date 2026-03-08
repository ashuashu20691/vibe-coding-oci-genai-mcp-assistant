/**
 * Unit tests for ReportTriggerDetector
 * 
 * Tests the core functionality of report trigger detection and data analysis
 */

import { ReportTriggerDetector } from '../../src/services/automatic-report-generation/report-trigger-detector';
import { ReportTriggerConfig } from '../../src/services/automatic-report-generation/types';
import { QueryResult } from '../../src/services/query-engine';
import { WorkflowContext } from '../../src/services/workflow-orchestrator';

describe('ReportTriggerDetector', () => {
  let detector: ReportTriggerDetector;
  let defaultConfig: ReportTriggerConfig;

  beforeEach(() => {
    defaultConfig = {
      minRows: 1,
      maxRows: 10000,
      enabledByDefault: true,
    };
    detector = new ReportTriggerDetector(defaultConfig);
  });

  describe('shouldTriggerReport', () => {
    it('should trigger report for valid query results', () => {
      const queryResult: QueryResult = {
        success: true,
        data: [
          { id: 1, name: 'Test', value: 100 },
          { id: 2, name: 'Test2', value: 200 },
        ],
        columns: ['id', 'name', 'value'],
        rowCount: 2,
        executionTimeMs: 50,
        sql: 'SELECT * FROM test',
      };

      const context: WorkflowContext = {};
      const decision = detector.shouldTriggerReport(queryResult, context);

      expect(decision.shouldGenerate).toBe(true);
      expect(decision.reason).toContain('valid results');
    });

    it('should not trigger report for empty results (Requirement 1.2)', () => {
      const queryResult: QueryResult = {
        success: true,
        data: [],
        columns: ['id', 'name'],
        rowCount: 0,
        executionTimeMs: 50,
        sql: 'SELECT * FROM test WHERE 1=0',
      };

      const context: WorkflowContext = {};
      const decision = detector.shouldTriggerReport(queryResult, context);

      expect(decision.shouldGenerate).toBe(false);
      expect(decision.reason).toContain('zero rows');
    });

    it('should not trigger report for failed queries', () => {
      const queryResult: QueryResult = {
        success: false,
        data: [],
        columns: [],
        rowCount: 0,
        executionTimeMs: 50,
        sql: 'SELECT * FROM nonexistent',
        error: 'Table not found',
      };

      const context: WorkflowContext = {};
      const decision = detector.shouldTriggerReport(queryResult, context);

      expect(decision.shouldGenerate).toBe(false);
      expect(decision.reason).toContain('failed');
    });

    it('should not trigger report when disabled in config', () => {
      const disabledConfig: ReportTriggerConfig = {
        ...defaultConfig,
        enabledByDefault: false,
      };
      const disabledDetector = new ReportTriggerDetector(disabledConfig);

      const queryResult: QueryResult = {
        success: true,
        data: [{ id: 1, name: 'Test' }],
        columns: ['id', 'name'],
        rowCount: 1,
        executionTimeMs: 50,
        sql: 'SELECT * FROM test',
      };

      const context: WorkflowContext = {};
      const decision = disabledDetector.shouldTriggerReport(queryResult, context);

      expect(decision.shouldGenerate).toBe(false);
      expect(decision.reason).toContain('disabled');
    });

    it('should not trigger report when row count exceeds maximum', () => {
      const queryResult: QueryResult = {
        success: true,
        data: Array(15000).fill({ id: 1, name: 'Test' }),
        columns: ['id', 'name'],
        rowCount: 15000,
        executionTimeMs: 50,
        sql: 'SELECT * FROM test',
      };

      const context: WorkflowContext = {};
      const decision = detector.shouldTriggerReport(queryResult, context);

      expect(decision.shouldGenerate).toBe(false);
      expect(decision.reason).toContain('exceeds maximum');
    });

    it('should respect user preferences for auto-generation', () => {
      const configWithPrefs: ReportTriggerConfig = {
        ...defaultConfig,
        userPreferences: {
          autoGenerate: false,
        },
      };
      const detectorWithPrefs = new ReportTriggerDetector(configWithPrefs);

      const queryResult: QueryResult = {
        success: true,
        data: [{ id: 1, name: 'Test' }],
        columns: ['id', 'name'],
        rowCount: 1,
        executionTimeMs: 50,
        sql: 'SELECT * FROM test',
      };

      const context: WorkflowContext = {};
      const decision = detectorWithPrefs.shouldTriggerReport(queryResult, context);

      expect(decision.shouldGenerate).toBe(false);
    });
  });

  describe('analyzeDataCharacteristics', () => {
    it('should detect time-series data from date columns', () => {
      const data = [
        { date: '2024-01-01', value: 100 },
        { date: '2024-01-02', value: 200 },
      ];

      const characteristics = detector.analyzeDataCharacteristics(data);

      expect(characteristics.hasTimeSeriesData).toBe(true);
    });

    it('should detect numeric metrics', () => {
      const data = [
        { id: 1, revenue: 1000, profit: 200 },
        { id: 2, revenue: 2000, profit: 400 },
      ];

      const characteristics = detector.analyzeDataCharacteristics(data);

      expect(characteristics.hasNumericMetrics).toBe(true);
    });

    it('should detect categorical data', () => {
      const data = [
        { id: 1, category: 'A', value: 100 },
        { id: 2, category: 'A', value: 200 },
        { id: 3, category: 'B', value: 150 },
        { id: 4, category: 'A', value: 300 },
        { id: 5, category: 'B', value: 250 },
        { id: 6, category: 'A', value: 400 },
      ];

      const characteristics = detector.analyzeDataCharacteristics(data);

      expect(characteristics.hasCategoricalData).toBe(true);
    });

    it('should detect image data from column names', () => {
      const data = [
        { id: 1, image_url: 'data:image/png;base64,iVBORw0KGgo...' },
      ];

      const characteristics = detector.analyzeDataCharacteristics(data);

      expect(characteristics.hasImageData).toBe(true);
    });

    it('should detect geographic data from lat/lon columns', () => {
      const data = [
        { id: 1, latitude: 37.7749, longitude: -122.4194 },
      ];

      const characteristics = detector.analyzeDataCharacteristics(data);

      expect(characteristics.hasGeographicData).toBe(true);
    });

    it('should return all false for empty data', () => {
      const data: Record<string, unknown>[] = [];

      const characteristics = detector.analyzeDataCharacteristics(data);

      expect(characteristics.hasTimeSeriesData).toBe(false);
      expect(characteristics.hasCategoricalData).toBe(false);
      expect(characteristics.hasNumericMetrics).toBe(false);
      expect(characteristics.hasImageData).toBe(false);
      expect(characteristics.hasGeographicData).toBe(false);
    });
  });

  describe('report type determination', () => {
    it('should suggest gallery report for image data', () => {
      const queryResult: QueryResult = {
        success: true,
        data: [
          { id: 1, image: 'data:image/png;base64,iVBORw0KGgo...' },
        ],
        columns: ['id', 'image'],
        rowCount: 1,
        executionTimeMs: 50,
        sql: 'SELECT * FROM images',
      };

      const context: WorkflowContext = {};
      const decision = detector.shouldTriggerReport(queryResult, context);

      expect(decision.suggestedReportType).toBe('gallery');
    });

    it('should suggest dashboard report for multi-metric data', () => {
      const queryResult: QueryResult = {
        success: true,
        data: [
          { date: '2024-01-01', revenue: 1000, profit: 200, cost: 800 },
        ],
        columns: ['date', 'revenue', 'profit', 'cost'],
        rowCount: 1,
        executionTimeMs: 50,
        sql: 'SELECT * FROM metrics',
      };

      const context: WorkflowContext = {};
      const decision = detector.shouldTriggerReport(queryResult, context);

      expect(decision.suggestedReportType).toBe('dashboard');
    });

    it('should suggest simple report for basic data', () => {
      const queryResult: QueryResult = {
        success: true,
        data: [
          { id: 1, name: 'Test' },
        ],
        columns: ['id', 'name'],
        rowCount: 1,
        executionTimeMs: 50,
        sql: 'SELECT * FROM test',
      };

      const context: WorkflowContext = {};
      const decision = detector.shouldTriggerReport(queryResult, context);

      expect(decision.suggestedReportType).toBe('simple');
    });
  });

  describe('complexity estimation', () => {
    it('should estimate low complexity for simple data', () => {
      const queryResult: QueryResult = {
        success: true,
        data: [
          { id: 1, name: 'Test' },
        ],
        columns: ['id', 'name'],
        rowCount: 1,
        executionTimeMs: 50,
        sql: 'SELECT * FROM test',
      };

      const context: WorkflowContext = {};
      const decision = detector.shouldTriggerReport(queryResult, context);

      expect(decision.estimatedComplexity).toBe('low');
    });

    it('should estimate high complexity for large datasets with images', () => {
      const queryResult: QueryResult = {
        success: true,
        data: Array(6000).fill({ id: 1, image: 'data:image/png;base64,iVBORw0KGgo...' }),
        columns: ['id', 'image'],
        rowCount: 6000,
        executionTimeMs: 50,
        sql: 'SELECT * FROM images',
      };

      const context: WorkflowContext = {};
      const decision = detector.shouldTriggerReport(queryResult, context);

      expect(decision.estimatedComplexity).toBe('high');
    });
  });
});
