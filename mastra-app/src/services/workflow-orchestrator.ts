/**
 * WorkflowOrchestrator Service
 * 
 * Implements autonomous multi-step workflow execution with dependency resolution,
 * progress tracking, streaming, and insight generation.
 * 
 * Validates: Requirements 1.1, 1.2, 1.7
 */

import { retryOrchestrator, RetryOptions } from './retry-orchestrator';

/**
 * Workflow step types
 */
export type StepType =
  | 'embed_image'
  | 'discover_schema'
  | 'generate_sql'
  | 'execute_query'
  | 'visualize'
  | 'export'
  | 'analyze'
  | 'connect_database'
  | 'list_tables'
  | 'describe_table'
  | 'generate_report'
  | 'custom';

/**
 * Step status
 */
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  id: string;
  type: StepType;
  description: string;
  parameters: Record<string, unknown>;
  dependencies: string[]; // IDs of steps that must complete before this one
  status: StepStatus;
  result?: unknown;
  error?: Error;
  startTime?: Date;
  endTime?: Date;
  retryCount?: number;
}

/**
 * Execution plan containing all workflow steps
 */
export interface ExecutionPlan {
  id: string;
  steps: WorkflowStep[];
  context: WorkflowContext;
  createdAt: Date;
}

/**
 * Workflow execution context
 */
export interface WorkflowContext {
  database?: string;
  conversationId?: string;
  userId?: string;
  attachments?: Array<{ type: string; content: unknown; metadata?: Record<string, unknown> }>;
  userPreferences?: Record<string, unknown>;
  schemaCache?: Map<string, unknown>; // Schema cache for the selected database
  [key: string]: unknown;
}

/**
 * Workflow execution result
 */
export interface WorkflowResult {
  success: boolean;
  planId: string;
  completedSteps: number;
  totalSteps: number;
  outputs: Array<{ stepId: string; result: unknown }>;
  insights: string[];
  errors: Array<{ stepId: string; error: Error }>;
  executionTimeMs: number;
}

/**
 * Progress callback for streaming updates
 */
export type ProgressCallback = (event: ProgressEvent) => void;

/**
 * Progress event types
 */
export interface ProgressEvent {
  type: 'step_start' | 'step_progress' | 'step_complete' | 'step_error' | 'insight' | 'workflow_complete';
  stepId?: string;
  stepDescription?: string;
  stepNumber?: number;
  totalSteps?: number;
  message?: string;
  result?: unknown;
  error?: Error;
  insights?: string[];
}

/**
 * Step executor function type
 */
export type StepExecutor = (
  step: WorkflowStep,
  context: WorkflowContext,
  previousResults: Map<string, unknown>
) => Promise<unknown>;

/**
 * WorkflowOrchestrator manages autonomous multi-step workflow execution
 */
export class WorkflowOrchestrator {
  private executors: Map<StepType, StepExecutor> = new Map();
  private activePlans: Map<string, ExecutionPlan> = new Map();
  private schemaDiscoveryService: any = null; // SchemaDiscoveryService instance

  constructor() {
    this.initializeDefaultExecutors();
  }

  /**
   * Set the schema discovery service for database operations
   * Requirement 5.5: Schema caching integration
   * 
   * @param service - SchemaDiscoveryService instance
   */
  setSchemaDiscoveryService(service: any): void {
    this.schemaDiscoveryService = service;
  }

  /**
   * Register a custom step executor
   * 
   * @param type - Step type
   * @param executor - Executor function
   */
  registerExecutor(type: StepType, executor: StepExecutor): void {
    this.executors.set(type, executor);
  }

  /**
   * Create an execution plan from a list of steps
   * Validates: Requirement 1.1 (identify required steps)
   * Requirement 4.4: Pass selected database to workflow context
   * Requirement 5.5: Update schema cache on database change
   * 
   * @param steps - Array of workflow steps
   * @param context - Workflow context
   * @returns Execution plan with dependency-ordered steps
   */
  createExecutionPlan(steps: WorkflowStep[], context: WorkflowContext = {}): ExecutionPlan {
    const planId = this.generatePlanId();
    
    // Automatically inject report generation steps after query execution
    // Validates: Requirements 6.1, 6.2
    const stepsWithReports = this.injectReportGenerationSteps(steps);
    
    // Validate dependencies
    this.validateDependencies(stepsWithReports);
    
    // Sort steps by dependencies (topological sort)
    const sortedSteps = this.topologicalSort(stepsWithReports);
    
    // Handle database change - invalidate schema cache if database changed
    // Requirement 5.5: Update schema cache on database change
    if (context.database && this.schemaDiscoveryService) {
      const currentConnection = this.schemaDiscoveryService.getActiveConnection();
      if (currentConnection && currentConnection !== context.database) {
        // Database changed - invalidate old cache
        this.schemaDiscoveryService.invalidateCache(currentConnection);
      }
      // Set new active connection
      this.schemaDiscoveryService.setActiveConnection(context.database);
    }
    
    const plan: ExecutionPlan = {
      id: planId,
      steps: sortedSteps,
      context,
      createdAt: new Date(),
    };
    
    this.activePlans.set(planId, plan);
    return plan;
  }
  /**
   * Automatically inject report generation steps after query execution steps
   * Validates: Requirements 6.1, 6.2
   *
   * @param steps - Array of workflow steps
   * @returns Steps with report generation steps injected
   */
  private injectReportGenerationSteps(steps: WorkflowStep[]): WorkflowStep[] {
    const newSteps: WorkflowStep[] = [];

    for (const step of steps) {
      newSteps.push(step);

      // After each execute_query step, add a generate_report step
      if (step.type === 'execute_query') {
        const reportStep: WorkflowStep = {
          id: `${step.id}_report`,
          type: 'generate_report',
          description: `Generate visual report for ${step.description}`,
          parameters: {
            queryStepId: step.id,
          },
          dependencies: [step.id], // Depends on the query step
          status: 'pending',
        };
        newSteps.push(reportStep);
      }
    }

    return newSteps;
  }

  /**
   * Execute a workflow plan with progress streaming
   * Validates: Requirements 1.1, 1.2, 1.7
   * 
   * @param plan - Execution plan to run
   * @param onProgress - Progress callback for streaming updates
   * @returns Workflow execution result
   */
  async execute(plan: ExecutionPlan, onProgress?: ProgressCallback): Promise<WorkflowResult> {
    const startTime = Date.now();
    const outputs: Array<{ stepId: string; result: unknown }> = [];
    const errors: Array<{ stepId: string; error: Error }> = [];
    const insights: string[] = [];
    const previousResults = new Map<string, unknown>();
    
    let completedSteps = 0;
    const totalSteps = plan.steps.length;

    try {
      // Execute steps in dependency order
      for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i];
        
        // Check if dependencies are satisfied
        if (!this.areDependenciesSatisfied(step, plan.steps)) {
          step.status = 'skipped';
          continue;
        }
        
        // Emit step start event
        step.status = 'running';
        step.startTime = new Date();
        
        if (onProgress) {
          onProgress({
            type: 'step_start',
            stepId: step.id,
            stepDescription: step.description,
            stepNumber: i + 1,
            totalSteps,
            message: `Step ${i + 1}/${totalSteps}: ${step.description}`,
          });
        }
        
        try {
          // Execute step with retry logic
          const result = await this.executeStepWithRetry(
            step,
            plan.context,
            previousResults,
            onProgress
          );
          
          // Mark step as completed
          step.status = 'completed';
          step.result = result;
          step.endTime = new Date();
          completedSteps++;
          
          // Store result for dependent steps
          previousResults.set(step.id, result);
          outputs.push({ stepId: step.id, result });
          
          // Emit step complete event
          if (onProgress) {
            onProgress({
              type: 'step_complete',
              stepId: step.id,
              stepDescription: step.description,
              stepNumber: i + 1,
              totalSteps,
              result,
            });
          }
          
          // Generate insights from step result
          const stepInsights = this.generateStepInsights(step, result);
          insights.push(...stepInsights);
          
          if (stepInsights.length > 0 && onProgress) {
            onProgress({
              type: 'insight',
              stepId: step.id,
              insights: stepInsights,
            });
          }
        } catch (error) {
          // Mark step as failed
          step.status = 'failed';
          step.error = error instanceof Error ? error : new Error(String(error));
          step.endTime = new Date();
          
          errors.push({
            stepId: step.id,
            error: step.error,
          });
          
          // Emit step error event
          if (onProgress) {
            onProgress({
              type: 'step_error',
              stepId: step.id,
              stepDescription: step.description,
              stepNumber: i + 1,
              totalSteps,
              error: step.error,
            });
          }
          
          // Check if this is a critical step (has dependents)
          const hasDependents = plan.steps.some(s => s.dependencies.includes(step.id));
          if (hasDependents) {
            // Critical step failed - abort workflow
            throw new Error(
              `Critical step "${step.description}" failed: ${step.error.message}`
            );
          }
          
          // Non-critical step - continue with remaining steps
        }
      }
      
      // Generate final insights from all results
      const finalInsights = this.generateWorkflowInsights(plan, outputs);
      insights.push(...finalInsights);
      
      // Emit workflow complete event
      if (onProgress) {
        onProgress({
          type: 'workflow_complete',
          totalSteps,
          insights: finalInsights,
        });
      }
      
      const executionTimeMs = Date.now() - startTime;
      
      return {
        success: errors.length === 0,
        planId: plan.id,
        completedSteps,
        totalSteps,
        outputs,
        insights,
        errors,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      
      return {
        success: false,
        planId: plan.id,
        completedSteps,
        totalSteps,
        outputs,
        insights,
        errors: [
          ...errors,
          {
            stepId: 'workflow',
            error: error instanceof Error ? error : new Error(String(error)),
          },
        ],
        executionTimeMs,
      };
    } finally {
      // Clean up active plan
      this.activePlans.delete(plan.id);
    }
  }

  /**
   * Execute a single step with retry logic
   * Integrates with RetryOrchestrator for error recovery
   * 
   * @param step - Step to execute
   * @param context - Workflow context
   * @param previousResults - Results from previous steps
   * @param onProgress - Progress callback
   * @returns Step execution result
   */
  private async executeStepWithRetry(
    step: WorkflowStep,
    context: WorkflowContext,
    previousResults: Map<string, unknown>,
    onProgress?: ProgressCallback
  ): Promise<unknown> {
    const executor = this.executors.get(step.type);
    
    if (!executor) {
      throw new Error(`No executor registered for step type: ${step.type}`);
    }
    
    // Configure retry options
    const retryOptions: RetryOptions = {
      maxAttempts: 5,
      operationName: step.description,
      onNarrative: (narrative) => {
        if (onProgress) {
          onProgress({
            type: 'step_progress',
            stepId: step.id,
            message: narrative,
          });
        }
      },
      onRetry: (attemptNum) => {
        step.retryCount = attemptNum;
      },
    };
    
    // Execute with retry orchestrator
    const result = await retryOrchestrator.executeWithRetry(
      () => executor(step, context, previousResults),
      retryOptions
    );
    
    if (!result.success) {
      throw result.error || new Error('Step execution failed');
    }
    
    return result.data;
  }

  /**
   * Validate that all step dependencies exist
   * 
   * @param steps - Array of workflow steps
   * @throws Error if dependencies are invalid
   */
  private validateDependencies(steps: WorkflowStep[]): void {
    const stepIds = new Set(steps.map(s => s.id));
    
    for (const step of steps) {
      for (const depId of step.dependencies) {
        if (!stepIds.has(depId)) {
          throw new Error(
            `Step "${step.id}" has invalid dependency: "${depId}" does not exist`
          );
        }
      }
    }
    
    // Check for circular dependencies
    this.detectCircularDependencies(steps);
  }

  /**
   * Detect circular dependencies in workflow steps
   * 
   * @param steps - Array of workflow steps
   * @throws Error if circular dependencies are detected
   */
  private detectCircularDependencies(steps: WorkflowStep[]): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const visit = (stepId: string): void => {
      if (recursionStack.has(stepId)) {
        throw new Error(`Circular dependency detected involving step: ${stepId}`);
      }
      
      if (visited.has(stepId)) {
        return;
      }
      
      visited.add(stepId);
      recursionStack.add(stepId);
      
      const step = steps.find(s => s.id === stepId);
      if (step) {
        for (const depId of step.dependencies) {
          visit(depId);
        }
      }
      
      recursionStack.delete(stepId);
    };
    
    for (const step of steps) {
      visit(step.id);
    }
  }

  /**
   * Sort steps by dependencies using topological sort
   * Validates: Requirement 1.2 (dependency-respecting order)
   * 
   * @param steps - Array of workflow steps
   * @returns Sorted array of steps
   */
  private topologicalSort(steps: WorkflowStep[]): WorkflowStep[] {
    const sorted: WorkflowStep[] = [];
    const visited = new Set<string>();
    
    const visit = (stepId: string): void => {
      if (visited.has(stepId)) {
        return;
      }
      
      const step = steps.find(s => s.id === stepId);
      if (!step) {
        return;
      }
      
      // Visit dependencies first
      for (const depId of step.dependencies) {
        visit(depId);
      }
      
      visited.add(stepId);
      sorted.push(step);
    };
    
    // Visit all steps
    for (const step of steps) {
      visit(step.id);
    }
    
    return sorted;
  }

  /**
   * Check if all dependencies for a step are satisfied
   * 
   * @param step - Step to check
   * @param allSteps - All steps in the plan
   * @returns True if dependencies are satisfied
   */
  private areDependenciesSatisfied(step: WorkflowStep, allSteps: WorkflowStep[]): boolean {
    for (const depId of step.dependencies) {
      const depStep = allSteps.find(s => s.id === depId);
      if (!depStep || depStep.status !== 'completed') {
        return false;
      }
    }
    return true;
  }

  /**
   * Generate insights from a single step result
   * Validates: Requirement 1.7 (synthesize results into actionable insights)
   * 
   * @param step - Completed step
   * @param result - Step result
   * @returns Array of insight strings
   */
  private generateStepInsights(step: WorkflowStep, result: unknown): string[] {
    const insights: string[] = [];
    
    // Generate insights based on step type
    switch (step.type) {
      case 'execute_query':
        if (Array.isArray(result)) {
          if (result.length === 0) {
            insights.push('No data found matching the query criteria.');
          } else if (result.length > 100) {
            insights.push(`Found ${result.length} records - this is a large dataset.`);
          }
        }
        break;
        
      case 'discover_schema':
        if (typeof result === 'object' && result !== null) {
          const tables = (result as { tables?: unknown[] }).tables;
          if (Array.isArray(tables)) {
            insights.push(`Discovered ${tables.length} tables in the database.`);
          }
        }
        break;
        
      case 'analyze':
        // Analysis results typically contain insights directly
        if (typeof result === 'object' && result !== null) {
          const analysisInsights = (result as { insights?: string[] }).insights;
          if (Array.isArray(analysisInsights)) {
            insights.push(...analysisInsights);
          }
        }
        break;
        
      case 'generate_report':
        // Report generation insights
        if (typeof result === 'object' && result !== null) {
          const reportResult = result as { success?: boolean; reportHTML?: string; error?: Error };
          if (reportResult.success) {
            insights.push('✓ Visual report generated successfully.');
          } else if (reportResult.error) {
            insights.push(`⚠️ Report generation failed: ${reportResult.error.message}`);
          }
        }
        break;
    }
    
    return insights;
  }

  /**
   * Generate final insights from all workflow results
   * Validates: Requirement 1.7 (synthesize results into actionable insights)
   * 
   * @param plan - Execution plan
   * @param outputs - All step outputs
   * @returns Array of insight strings
   */
  private generateWorkflowInsights(
    plan: ExecutionPlan,
    outputs: Array<{ stepId: string; result: unknown }>
  ): string[] {
    const insights: string[] = [];
    
    // Count completed steps
    const completedCount = plan.steps.filter(s => s.status === 'completed').length;
    const totalCount = plan.steps.length;
    
    if (completedCount === totalCount) {
      insights.push(`✓ Successfully completed all ${totalCount} workflow steps.`);
    } else {
      insights.push(
        `Completed ${completedCount} of ${totalCount} steps (${Math.round((completedCount / totalCount) * 100)}%).`
      );
    }
    
    // Calculate total execution time
    const executionTimes = plan.steps
      .filter(s => s.startTime && s.endTime)
      .map(s => s.endTime!.getTime() - s.startTime!.getTime());
    
    if (executionTimes.length > 0) {
      const totalTime = executionTimes.reduce((sum, t) => sum + t, 0);
      insights.push(`Total execution time: ${(totalTime / 1000).toFixed(2)}s`);
    }
    
    // Identify any failed steps
    const failedSteps = plan.steps.filter(s => s.status === 'failed');
    if (failedSteps.length > 0) {
      insights.push(
        `⚠️ ${failedSteps.length} step(s) failed: ${failedSteps.map(s => s.description).join(', ')}`
      );
    }
    
    return insights;
  }

  /**
   * Initialize default step executors
   */
  private initializeDefaultExecutors(): void {
    // Custom executor - delegates to parameters.execute function
    this.executors.set('custom', async (step, context, previousResults) => {
      const execute = step.parameters.execute as
        | ((context: WorkflowContext, previousResults: Map<string, unknown>) => Promise<unknown>)
        | undefined;
      
      if (!execute || typeof execute !== 'function') {
        throw new Error('Custom step must have an execute function in parameters');
      }
      
      return execute(context, previousResults);
    });
  }

  /**
   * Generate a unique plan ID
   */
  private generatePlanId(): string {
    return `plan_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get an active plan by ID
   * 
   * @param planId - Plan ID
   * @returns Execution plan or undefined
   */
  getActivePlan(planId: string): ExecutionPlan | undefined {
    return this.activePlans.get(planId);
  }

  /**
   * Cancel an active workflow
   * 
   * @param planId - Plan ID to cancel
   * @returns True if plan was cancelled
   */
  cancelWorkflow(planId: string): boolean {
    const plan = this.activePlans.get(planId);
    if (!plan) {
      return false;
    }
    
    // Mark all pending/running steps as skipped
    for (const step of plan.steps) {
      if (step.status === 'pending' || step.status === 'running') {
        step.status = 'skipped';
      }
    }
    
    this.activePlans.delete(planId);
    return true;
  }
}

// Export singleton instance
export const workflowOrchestrator = new WorkflowOrchestrator();
