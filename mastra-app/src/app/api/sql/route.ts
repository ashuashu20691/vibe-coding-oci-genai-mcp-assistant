// app/api/sql/route.ts
/**
 * SQL execution API route.
 * Executes SQL queries via MCP run-sql tool for the SQL Playground feature.
 * 
 * Requirements: 13.3, 13.5, 9.2, 9.5, 9.6
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMCPTools } from '@/mastra/agents/database-agent';
import { DatabaseOrchestrator } from '@/mastra/agents/orchestrator';
import { loadConfig } from '@/config';
import { ErrorCode, classifyError, logError, formatErrorResponse } from '@/lib/errors';

const config = loadConfig();

// Maximum retry attempts for recoverable errors (Requirement 9.6)
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

interface SQLRequestBody {
  sql: string;
  connectionName?: string;
}

/**
 * Retry wrapper for SQL operations.
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  context: string,
  retryCount = 0
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const appError = classifyError(error);
    logError(context, error, { retryCount });

    if (appError.isRetryable && retryCount < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (retryCount + 1)));
      return withRetry(operation, context, retryCount + 1);
    }

    throw error;
  }
}

/**
 * POST /api/sql
 * Execute a SQL query via MCP run-sql tool.
 * Requirement 13.3, 13.5
 */
export async function POST(request: NextRequest) {
  // Check if MCP is configured
  if (!config.mcp.command) {
    return NextResponse.json(
      { 
        success: false,
        ...formatErrorResponse(new Error('MCP not configured')),
        code: ErrorCode.MCP_CONNECTION_ERROR,
      },
      { status: 503 }
    );
  }

  try {
    const body: SQLRequestBody = await request.json();
    const { sql } = body;

    if (!sql || typeof sql !== 'string' || !sql.trim()) {
      return NextResponse.json(
        { 
          success: false,
          error: 'SQL query is required',
          code: ErrorCode.VALIDATION_ERROR,
          userMessage: 'Please enter a SQL query to execute.',
          isRetryable: false,
        },
        { status: 400 }
      );
    }

    // Check if MCP tools are available
    const mcpTools = await getMCPTools();
    if (Object.keys(mcpTools).length === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'MCP tools not available',
          code: ErrorCode.MCP_CONNECTION_ERROR,
          userMessage: 'Database tools are not available. Please check MCP configuration.',
          isRetryable: false,
        },
        { status: 503 }
      );
    }

    // Use DatabaseOrchestrator for SQL execution with connection management
    const orchestrator = new DatabaseOrchestrator(
      'sql-playground',
      config.app.defaultModel || 'cohere.command-r-08-2024'
    );

    const result = await withRetry(
      () => orchestrator.executeTool('run-sql', { sql_query: sql }),
      'sql/POST'
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          code: ErrorCode.DB_QUERY_ERROR,
          userMessage: result.error,
          isRetryable: false,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      result: result.result,
    });
  } catch (error) {
    logError('sql/POST', error);
    const errorResponse = formatErrorResponse(error);
    
    return NextResponse.json(
      {
        success: false,
        ...errorResponse,
      },
      { status: 500 }
    );
  }
}
