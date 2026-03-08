/**
 * Unit tests for error logging in ErrorRecoveryService
 * 
 * Validates: Requirement 9.4 - Error logging with context and stack traces
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorRecoveryService } from '@/services/automatic-report-generation/error-recovery';
import { logger } from '@/lib/logger';
import type { QueryResult } from '@/services/query-engine';

describe('ErrorRecoveryService - Error Logging', () => {
  let errorRecoveryService: ErrorRecoveryService;
  let loggerSpies: {
    info: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    errorRecoveryService = new ErrorRecoveryService();
    
    // Spy on the base logger methods
    loggerSpies = {
      info: vi.spyOn(logger, 'info'),
      warn: vi.spyOn(logger, 'warn'),
      error: vi.spyOn(logger, 'error'),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getRecoveryStrategy', () => {
    it('should log info when initiating error recovery', () => {
      const queryResult: QueryResult = {
        data: [{ id: 1, name: 'Test' }],
        columns: ['id', 'name'],
        rowCount: 1,
      };
      const error = new Error('Test error');

      errorRecoveryService.getRecoveryStrategy('data_analysis', queryResult, error);

      expect(loggerSpies.info).toHaveBeenCalledWith(
        'Initiating error recovery for data_analysis error',
        expect.objectContaining({
          component: 'ErrorRecoveryService',
          action: 'getRecoveryStrategy',
          metadata: expect.objectContaining({
            errorType: 'data_analysis',
            errorMessage: 'Test error',
            rowCount: 1,
          }),
        })
      );
    });
  });

  describe('handleDataAnalysisError', () => {
    it('should log warning with context and sanitized data sample', async () => {
      const queryResult: QueryResult = {
        data: [
          { id: 1, name: 'Alice', email: 'alice@example.com' },
          { id: 2, name: 'Bob', email: 'bob@example.com' },
        ],
        columns: ['id', 'name', 'email'],
        rowCount: 2,
      };
      const error = new Error('Data analysis failed');
      error.stack = 'Error: Data analysis failed\n  at test.ts:10:20';

      const strategy = errorRecoveryService.getRecoveryStrategy(
        'data_analysis',
        queryResult,
        error
      );
      await strategy.fallbackAction();

      expect(loggerSpies.warn).toHaveBeenCalledWith(
        'Data analysis failed, falling back to basic table view',
        expect.objectContaining({
          component: 'ErrorRecoveryService',
          action: 'handleDataAnalysisError',
          metadata: expect.objectContaining({
            errorMessage: 'Data analysis failed',
            errorName: 'Error',
            stackTrace: expect.stringContaining('Error: Data analysis failed'),
            dataSample: expect.objectContaining({
              totalRows: 2,
              columns: ['id', 'name', 'email'],
              sampleRows: expect.any(Array),
            }),
            rowCount: 2,
            columnCount: 3,
          }),
        })
      );
    });
  });

  describe('handleVisualizationError', () => {
    it('should log warning with error details', async () => {
      const queryResult: QueryResult = {
        data: [{ value: 100 }],
        columns: ['value'],
        rowCount: 1,
      };
      const error = new Error('Chart rendering failed');

      const strategy = errorRecoveryService.getRecoveryStrategy(
        'visualization',
        queryResult,
        error
      );
      await strategy.fallbackAction();

      expect(loggerSpies.warn).toHaveBeenCalledWith(
        'Visualization generation failed, falling back to table-only view',
        expect.objectContaining({
          component: 'ErrorRecoveryService',
          action: 'handleVisualizationError',
          metadata: expect.objectContaining({
            errorMessage: 'Chart rendering failed',
            errorName: 'Error',
            dataSample: expect.any(Object),
            rowCount: 1,
          }),
        })
      );
    });
  });

  describe('handleHtmlGenerationError', () => {
    it('should log error with context', async () => {
      const queryResult: QueryResult = {
        data: [{ test: 'data' }],
        columns: ['test'],
        rowCount: 1,
      };
      const error = new Error('HTML generation failed');

      const strategy = errorRecoveryService.getRecoveryStrategy(
        'html_generation',
        queryResult,
        error
      );
      await strategy.fallbackAction();

      expect(loggerSpies.error).toHaveBeenCalledWith(
        'HTML generation failed completely, falling back to plain text',
        error,
        expect.objectContaining({
          component: 'ErrorRecoveryService',
          action: 'handleHtmlGenerationError',
          metadata: expect.objectContaining({
            dataSample: expect.any(Object),
            rowCount: 1,
          }),
        })
      );
    });
  });

  describe('handleExportError', () => {
    it('should log warning with export error details', async () => {
      const queryResult: QueryResult = {
        data: [{ col1: 'value1', col2: 'value2' }],
        columns: ['col1', 'col2'],
        rowCount: 1,
      };
      const error = new Error('Export to HTML failed');

      const strategy = errorRecoveryService.getRecoveryStrategy(
        'export',
        queryResult,
        error
      );
      await strategy.fallbackAction();

      expect(loggerSpies.warn).toHaveBeenCalledWith(
        'Report export failed',
        expect.objectContaining({
          component: 'ErrorRecoveryService',
          action: 'handleExportError',
          metadata: expect.objectContaining({
            errorMessage: 'Export to HTML failed',
            errorName: 'Error',
            stackTrace: expect.any(String),
            dataSample: expect.any(Object),
            rowCount: 1,
          }),
        })
      );
    });
  });

  describe('handleWorkflowError', () => {
    it('should log error with workflow context', async () => {
      const queryResult: QueryResult = {
        data: [],
        columns: [],
        rowCount: 0,
      };
      const error = new Error('Workflow integration failed');

      const strategy = errorRecoveryService.getRecoveryStrategy(
        'workflow',
        queryResult,
        error
      );
      await strategy.fallbackAction();

      expect(loggerSpies.error).toHaveBeenCalledWith(
        'Workflow integration error during report generation',
        error,
        expect.objectContaining({
          component: 'ErrorRecoveryService',
          action: 'handleWorkflowError',
          metadata: expect.objectContaining({
            dataSample: expect.any(Object),
            rowCount: 0,
          }),
        })
      );
    });
  });

  describe('Data Sanitization', () => {
    it('should redact sensitive column names in logs', async () => {
      const queryResult: QueryResult = {
        data: [
          {
            id: 1,
            username: 'alice',
            password: 'secret123',
            api_key: 'abc123',
            ssn: '123-45-6789',
            credit_card: '4111-1111-1111-1111',
          },
        ],
        columns: ['id', 'username', 'password', 'api_key', 'ssn', 'credit_card'],
        rowCount: 1,
      };
      const error = new Error('Test error');

      const strategy = errorRecoveryService.getRecoveryStrategy(
        'data_analysis',
        queryResult,
        error
      );
      await strategy.fallbackAction();

      // Get the logged data sample
      const logCall = loggerSpies.warn.mock.calls.find(call => 
        call[0] === 'Data analysis failed, falling back to basic table view'
      );
      expect(logCall).toBeDefined();
      
      const context = logCall![1] as any;
      const dataSample = context?.metadata?.dataSample;

      expect(dataSample).toBeDefined();
      expect(dataSample.sampleRows).toBeDefined();
      expect(dataSample.sampleRows[0]).toEqual(
        expect.objectContaining({
          id: 1,
          username: 'alice',
          password: '[REDACTED]',
          api_key: '[REDACTED]',
          ssn: '[REDACTED]',
          credit_card: '[REDACTED]',
        })
      );
    });

    it('should truncate long string values in logs', async () => {
      const longString = 'a'.repeat(200);
      const queryResult: QueryResult = {
        data: [{ id: 1, description: longString }],
        columns: ['id', 'description'],
        rowCount: 1,
      };
      const error = new Error('Test error');

      const strategy = errorRecoveryService.getRecoveryStrategy(
        'data_analysis',
        queryResult,
        error
      );
      await strategy.fallbackAction();

      const logCall = loggerSpies.warn.mock.calls.find(call => 
        call[0] === 'Data analysis failed, falling back to basic table view'
      );
      const context = logCall![1] as any;
      const dataSample = context?.metadata?.dataSample;

      expect(dataSample.sampleRows[0].description).toHaveLength(103); // 100 + '...'
      expect(dataSample.sampleRows[0].description).toMatch(/^a{100}\.\.\.$/);
    });

    it('should limit sample to first 3 rows', async () => {
      const queryResult: QueryResult = {
        data: [
          { id: 1 },
          { id: 2 },
          { id: 3 },
          { id: 4 },
          { id: 5 },
        ],
        columns: ['id'],
        rowCount: 5,
      };
      const error = new Error('Test error');

      const strategy = errorRecoveryService.getRecoveryStrategy(
        'data_analysis',
        queryResult,
        error
      );
      await strategy.fallbackAction();

      const logCall = loggerSpies.warn.mock.calls.find(call => 
        call[0] === 'Data analysis failed, falling back to basic table view'
      );
      const context = logCall![1] as any;
      const dataSample = context?.metadata?.dataSample;

      expect(dataSample.sampleRows).toHaveLength(3);
      expect(dataSample.totalRows).toBe(5);
    });

    it('should handle null and undefined values', async () => {
      const queryResult: QueryResult = {
        data: [{ id: 1, value: null, other: undefined }],
        columns: ['id', 'value', 'other'],
        rowCount: 1,
      };
      const error = new Error('Test error');

      const strategy = errorRecoveryService.getRecoveryStrategy(
        'data_analysis',
        queryResult,
        error
      );
      await strategy.fallbackAction();

      const logCall = loggerSpies.warn.mock.calls.find(call => 
        call[0] === 'Data analysis failed, falling back to basic table view'
      );
      const context = logCall![1] as any;
      const dataSample = context?.metadata?.dataSample;

      expect(dataSample.sampleRows[0]).toEqual({
        id: 1,
        value: null,
        other: null,
      });
    });

    it('should replace complex objects with [Object] placeholder', async () => {
      const queryResult: QueryResult = {
        data: [{ id: 1, metadata: { nested: { deep: 'value' } } }],
        columns: ['id', 'metadata'],
        rowCount: 1,
      };
      const error = new Error('Test error');

      const strategy = errorRecoveryService.getRecoveryStrategy(
        'data_analysis',
        queryResult,
        error
      );
      await strategy.fallbackAction();

      const logCall = loggerSpies.warn.mock.calls.find(call => 
        call[0] === 'Data analysis failed, falling back to basic table view'
      );
      const context = logCall![1] as any;
      const dataSample = context?.metadata?.dataSample;

      expect(dataSample.sampleRows[0].metadata).toBe('[Object]');
    });
  });

  describe('Stack Traces', () => {
    it('should include stack traces in error logs', async () => {
      const queryResult: QueryResult = {
        data: [{ test: 'data' }],
        columns: ['test'],
        rowCount: 1,
      };
      const error = new Error('Test error with stack');
      error.stack = 'Error: Test error with stack\n  at test.ts:100:20\n  at handler.ts:50:10';

      const strategy = errorRecoveryService.getRecoveryStrategy(
        'html_generation',
        queryResult,
        error
      );
      await strategy.fallbackAction();

      const logCall = loggerSpies.error.mock.calls.find(call => 
        call[0] === 'HTML generation failed completely, falling back to plain text'
      );
      expect(logCall).toBeDefined();
      expect(logCall![1]).toBe(error); // Error object passed directly
      expect(error.stack).toContain('test.ts:100:20');
    });
  });

  describe('Log Levels', () => {
    it('should use appropriate log levels for different error types', async () => {
      const queryResult: QueryResult = {
        data: [{ test: 'data' }],
        columns: ['test'],
        rowCount: 1,
      };
      const error = new Error('Test error');

      // Data analysis - warn level
      const dataStrategy = errorRecoveryService.getRecoveryStrategy(
        'data_analysis',
        queryResult,
        error
      );
      expect(dataStrategy.logLevel).toBe('warn');

      // Visualization - warn level
      const vizStrategy = errorRecoveryService.getRecoveryStrategy(
        'visualization',
        queryResult,
        error
      );
      expect(vizStrategy.logLevel).toBe('warn');

      // HTML generation - error level
      const htmlStrategy = errorRecoveryService.getRecoveryStrategy(
        'html_generation',
        queryResult,
        error
      );
      expect(htmlStrategy.logLevel).toBe('error');

      // Export - warn level
      const exportStrategy = errorRecoveryService.getRecoveryStrategy(
        'export',
        queryResult,
        error
      );
      expect(exportStrategy.logLevel).toBe('warn');

      // Workflow - error level
      const workflowStrategy = errorRecoveryService.getRecoveryStrategy(
        'workflow',
        queryResult,
        error
      );
      expect(workflowStrategy.logLevel).toBe('error');
    });
  });
});
