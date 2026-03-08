/**
 * AutomaticReportGenerator Service
 * 
 * Main service that integrates with WorkflowOrchestrator to automatically
 * generate visual reports when database query results are retrieved.
 * 
 * This service ties together ReportTriggerDetector and ReportGenerationOrchestrator
 * to provide seamless automatic report generation as part of the workflow pipeline.
 * 
 * Requirements: 6.1, 6.2
 */

import type { WorkflowStep, WorkflowContext, StepExecutor, WorkflowOrchestrator } from '../workflow-orchestrator';
import type { QueryResult } from '../query-engine';
import type { AutoReportConfig, ReportGenerationResult } from './types';
import { ReportTriggerDetector } from './report-trigger-detector';
import { ReportGenerationOrchestrator } from './report-generation-orchestrator';

/**
 * AutomaticReportGenerator integrates report generation with the workflow system.
 * 
 * This class provides methods to create report generation workflow steps and
 * execute them as part of the autonomous workflow pipeline.
 * 
 * Requirements:
 * - 6.1: Workflow integration for automatic report generation
 * - 6.2: Proper dependency management on query execution steps
 */
export class AutomaticReportGenerator {
  /**
   * Creates a new AutomaticReportGenerator instance.
   * 
   * @param config - Configuration for automatic report generation
   * @param triggerDetector - Service for detecting when reports should be generated
   * @param reportOrchestrator - Service for orchestrating report generation pipeline
   */
  constructor(
    private config: AutoReportConfig,
    private triggerDetector: ReportTriggerDetector,
    private reportOrchestrator: ReportGenerationOrchestrator
  ) {}

  /**
   * Create workflow step for automatic report generation.
   * 
   * Creates a WorkflowStep that will generate a report based on query results.
   * The step is configured with proper dependencies on the query execution step.
   * 
   * Validates: Requirements 6.1, 6.2
   * 
   * @param queryStepId - ID of the query execution step to depend on
   * @param queryResult - Query result from database execution
   * @returns WorkflowStep configured for report generation
   */
  createReportGenerationStep(
    queryStepId: string,
    queryResult: QueryResult
  ): WorkflowStep {
    // Generate unique step ID
    const stepId = `generate_report_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Create workflow step with proper dependencies (Requirement 6.2)
    const step: WorkflowStep = {
      id: stepId,
      type: 'custom', // Using 'custom' type for report generation
      description: 'Generate visual report from query results',
      parameters: {
        queryStepId,
        queryResult,
        reportType: 'automatic',
        // Provide execute function for custom step executor
        execute: async (context: WorkflowContext, previousResults: Map<string, unknown>) => {
          return await this.executeReportGeneration(step, context, previousResults);
        },
      },
      dependencies: [queryStepId], // Depend on query execution step (Requirement 6.2)
      status: 'pending',
    };

    return step;
  }

  /**
   * Execute report generation as a workflow step.
   * 
   * This method is called by the WorkflowOrchestrator when executing the
   * report generation step. It analyzes the query result, decides whether
   * to generate a report, and orchestrates the generation pipeline.
   * 
   * Validates: Requirements 6.1, 6.3, 6.4, 6.5
   * 
   * @param step - Workflow step to execute
   * @param context - Workflow context for integration
   * @param previousResults - Results from previous workflow steps
   * @returns Promise resolving to report generation result
   */
  async executeReportGeneration(
    step: WorkflowStep,
    context: WorkflowContext,
    previousResults: Map<string, unknown>
  ): Promise<ReportGenerationResult> {
    const startTime = Date.now();
    
    try {
      // Extract query result from step parameters or previous results (Requirement 6.1)
      let queryResult = step.parameters.queryResult as QueryResult;
      const queryStepId = step.parameters.queryStepId as string;
      
      // If query result not in parameters, try to get it from previous results
      if (!queryResult && queryStepId && previousResults.has(queryStepId)) {
        queryResult = previousResults.get(queryStepId) as QueryResult;
      }

      // Check if automatic report generation is enabled
      if (!this.config.enabled) {
        const result: ReportGenerationResult = {
          success: false,
          reportHTML: '',
          exportOptions: {
            html: () => {},
          },
          renderData: {
            type: 'inline',
            content: '',
          },
          error: new Error('Automatic report generation is disabled'),
        };
        
        // Store result in workflow context (Requirement 6.5)
        this.storeResultInContext(context, step.id, result, startTime);
        
        return result;
      }

      // Emit progress: Analyzing query results (Requirement 6.4)
      this.emitProgress(context, step.id, 'Analyzing query results for report generation');

      // Analyze query result to determine if report should be generated
      const triggerDecision = this.triggerDetector.shouldTriggerReport(
        queryResult,
        context
      );

      // If report generation is not warranted, return early
      if (!triggerDecision.shouldGenerate) {
        const result: ReportGenerationResult = {
          success: false,
          reportHTML: '',
          exportOptions: {
            html: () => {},
          },
          renderData: {
            type: 'inline',
            content: '',
          },
          error: new Error(`Report generation skipped: ${triggerDecision.reason}`),
        };
        
        // Store result in workflow context (Requirement 6.5)
        this.storeResultInContext(context, step.id, result, startTime);
        
        return result;
      }

      // Emit progress: Generating report (Requirement 6.4)
      this.emitProgress(
        context,
        step.id,
        `Generating ${triggerDecision.suggestedReportType} report with ${triggerDecision.estimatedComplexity} complexity`
      );

      // Generate the report using the orchestrator
      const reportResult = await this.reportOrchestrator.generateReport(
        queryResult,
        triggerDecision,
        context
      );

      // Emit progress: Report generation complete (Requirement 6.4)
      if (reportResult.success) {
        this.emitProgress(context, step.id, 'Report generation completed successfully');
      }

      // Store result in workflow context (Requirement 6.5)
      this.storeResultInContext(context, step.id, reportResult, startTime);

      return reportResult;
    } catch (error) {
      // Requirement 6.3: Non-blocking failure - return failed result but don't throw
      const result: ReportGenerationResult = {
        success: false,
        reportHTML: '',
        exportOptions: {
          html: () => {},
        },
        renderData: {
          type: 'inline',
          content: '',
        },
        error: error instanceof Error ? error : new Error(String(error)),
      };
      
      // Emit progress: Error occurred (Requirement 6.4)
      this.emitProgress(
        context,
        step.id,
        `Report generation failed: ${result.error?.message || 'Unknown error'}`
      );
      
      // Store result in workflow context even on failure (Requirement 6.5)
      this.storeResultInContext(context, step.id, result, startTime);
      
      return result;
    }
  }

  /**
   * Store report generation result in workflow context.
   * 
   * Validates: Requirement 6.5
   * 
   * @param context - Workflow context to store result in
   * @param stepId - ID of the report generation step
   * @param result - Report generation result
   * @param startTime - When report generation started
   */
  private storeResultInContext(
    context: WorkflowContext,
    stepId: string,
    result: ReportGenerationResult,
    startTime: number
  ): void {
    // Initialize reportGeneration object in context if it doesn't exist
    if (!context.reportGeneration) {
      context.reportGeneration = {};
    }
    
    // Store the result with metadata
    (context.reportGeneration as Record<string, unknown>)[stepId] = {
      result,
      generationTimeMs: Date.now() - startTime,
      timestamp: new Date(),
    };
  }

  /**
   * Emit progress event during report generation.
   * 
   * This method stores progress messages in the workflow context so they can
   * be picked up by the retry orchestrator's narrative system.
   * 
   * Validates: Requirement 6.4
   * 
   * @param context - Workflow context
   * @param stepId - ID of the report generation step
   * @param message - Progress message
   */
  private emitProgress(
    context: WorkflowContext,
    stepId: string,
    message: string
  ): void {
    // Store progress messages in context for workflow orchestrator
    if (!context.progressMessages) {
      context.progressMessages = [];
    }
    
    (context.progressMessages as Array<{ stepId: string; message: string; timestamp: Date }>).push({
      stepId,
      message,
      timestamp: new Date(),
    });
  }

  /**
   * Get step executor function for WorkflowOrchestrator registration.
   * 
   * Returns a StepExecutor function that can be registered with the
   * WorkflowOrchestrator to handle report generation steps.
   * 
   * @returns StepExecutor function for report generation
   */
  getStepExecutor(): StepExecutor {
    return async (
      step: WorkflowStep,
      context: WorkflowContext,
      previousResults: Map<string, unknown>
    ): Promise<unknown> => {
      return await this.executeReportGeneration(step, context, previousResults);
    };
  }

  /**
   * Check if automatic report generation is enabled.
   * 
   * @returns True if automatic report generation is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Update configuration for automatic report generation.
   * 
   * @param config - New configuration to apply
   */
  updateConfig(config: Partial<AutoReportConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Register this service with WorkflowOrchestrator.
   * 
   * This method sets up automatic step injection after query execution.
   * Since we use the 'custom' step type with an execute function in parameters,
   * no explicit executor registration is needed. The WorkflowOrchestrator's
   * built-in custom executor will automatically call our execute function.
   * 
   * The integration works as follows:
   * 1. createReportGenerationStep() creates a step with type 'custom'
   * 2. The step includes an execute function in its parameters
   * 3. WorkflowOrchestrator's custom executor calls this execute function
   * 4. This enables automatic report generation as part of the workflow
   * 
   * Validates: Requirement 6.1
   * 
   * @param orchestrator - WorkflowOrchestrator instance (for future extensibility)
   */
  registerWithOrchestrator(orchestrator: WorkflowOrchestrator): void {
    // No explicit registration needed since we leverage the existing 'custom' executor
    // The orchestrator is now ready to execute report generation steps created by
    // createReportGenerationStep()
    
    // Future enhancement: Could add hooks here to automatically inject report
    // generation steps after query execution steps
  }

}
