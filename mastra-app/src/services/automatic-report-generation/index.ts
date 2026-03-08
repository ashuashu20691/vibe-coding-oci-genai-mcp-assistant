/**
 * Automatic Report Generation Service - Main Export
 * 
 * This module creates and exports a singleton instance of AutomaticReportGenerator
 * configured with all necessary dependencies.
 * 
 * The singleton is automatically registered with the WorkflowOrchestrator and
 * ready to generate reports when query execution steps complete.
 * 
 * Requirements: 6.1, 6.2
 */

import { AutomaticReportGenerator } from './automatic-report-generator';
import { ReportTriggerDetector } from './report-trigger-detector';
import { ReportGenerationOrchestrator } from './report-generation-orchestrator';
import { ResultPresenter } from '../result-presenter';
import { DashboardComposer } from '../dashboard-composer';
import { ExportService } from '../export-service';
import { workflowOrchestrator } from '../workflow-orchestrator';
import type { AutoReportConfig } from './types';

/**
 * Default configuration for automatic report generation.
 * Can be overridden by user preferences or per-query configuration.
 */
const defaultConfig: AutoReportConfig = {
  enabled: true, // Automatic report generation is enabled by default
  triggerConfig: {
    minRows: 1, // Generate reports for any non-empty result
    maxRows: 10000, // Switch to summary for very large datasets
    enabledByDefault: true,
    userPreferences: {
      autoGenerate: true,
      preferredChartTypes: ['bar', 'line', 'pie'],
      preferredLayout: 'grid',
    },
  },
  performanceConfig: {
    maxGenerationTimeMs: 30000, // 30 seconds max
    enableProgressiveRendering: true,
    cacheEnabled: true,
  },
};

/**
 * Create singleton instances of dependencies
 */
const triggerDetector = new ReportTriggerDetector(defaultConfig.triggerConfig);
const resultPresenter = new ResultPresenter();
const dashboardComposer = new DashboardComposer();
const reportOrchestrator = new ReportGenerationOrchestrator(
  resultPresenter,
  dashboardComposer,
  ExportService
);

/**
 * Create singleton instance of AutomaticReportGenerator
 * 
 * This instance is configured with all necessary dependencies and
 * ready to be used by the chat API and workflow orchestrator.
 */
export const automaticReportGenerator = new AutomaticReportGenerator(
  defaultConfig,
  triggerDetector,
  reportOrchestrator
);

/**
 * Register the automatic report generator with the workflow orchestrator.
 * 
 * This enables automatic report generation as part of the workflow pipeline.
 * Report generation steps will be automatically injected after query execution steps.
 * 
 * Validates: Requirement 6.1
 */
automaticReportGenerator.registerWithOrchestrator(workflowOrchestrator);

/**
 * Export all components for direct use if needed
 */
export {
  AutomaticReportGenerator,
  ReportTriggerDetector,
  ReportGenerationOrchestrator,
};

/**
 * Export types for external use
 */
export type {
  AutoReportConfig,
  ReportGenerationResult,
  TriggerDecision,
  ReportTriggerConfig,
} from './types';
