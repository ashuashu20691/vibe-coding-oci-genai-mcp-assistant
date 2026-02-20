// src/app/api/analyze/route.ts
/**
 * Analysis API route for intelligent data analysis workflow.
 * Handles POST requests for natural language analysis queries.
 * Supports streaming for long-running analysis operations.
 *
 * Requirements covered:
 * - 10.1: Allow users to request modifications via natural language
 * - 10.6: Handle streaming for long-running analysis
 */

import { NextRequest } from 'next/server';
import { AnalysisAgent, AnalysisRequest, AnalysisResponse } from '@/mastra/agents/analysis-agent';
import { classifyError, logError, formatErrorResponse } from '@/lib/errors';

/**
 * Request body for analysis endpoint.
 */
interface AnalyzeRequestBody {
  /** Natural language query describing the analysis */
  query: string;
  /** Number of synthetic records to generate (optional) */
  recordCount?: number;
  /** Whether to use existing data instead of generating new data */
  useExistingData?: boolean;
  /** Whether to stream the response */
  stream?: boolean;
}

/**
 * POST handler for analysis requests.
 * Accepts natural language queries and returns analysis results with dashboard config.
 */
export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequestBody = await request.json();
    const { query, recordCount, useExistingData, stream } = body;

    console.log(`[analyze/POST] Received request: query="${query?.slice(0, 100)}...", recordCount=${recordCount}, stream=${stream}`);

    // Validation
    if (!query || typeof query !== 'string') {
      console.log('[analyze/POST] Validation failed: query string required');
      return new Response(
        JSON.stringify(formatErrorResponse(new Error('Query string required'))),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create analysis agent
    const analysisAgent = new AnalysisAgent();

    // Build analysis request
    const analysisRequest: AnalysisRequest = {
      naturalLanguageQuery: query,
      recordCount,
      useExistingData,
    };

    // Handle streaming response for long-running analysis
    if (stream) {
      return handleStreamingAnalysis(analysisAgent, analysisRequest);
    }

    // Non-streaming response
    const response = await analysisAgent.analyze(analysisRequest);

    console.log(`[analyze/POST] Analysis complete: success=${response.success}, sections=${response.dashboard.sections.length}`);

    return new Response(JSON.stringify(response), {
      status: response.success ? 200 : 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logError('analyze/POST', error);
    const errorResponse = formatErrorResponse(error);
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handles streaming analysis for long-running operations.
 * Sends progress updates via Server-Sent Events.
 */
function handleStreamingAnalysis(
  analysisAgent: AnalysisAgent,
  request: AnalysisRequest
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send initial progress
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ status: 'started', message: 'Starting analysis...' })}\n\n`)
        );

        // Send progress: analyzing intent
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ status: 'progress', step: 'intent', message: 'Analyzing intent...' })}\n\n`)
        );

        // Perform the analysis
        const response = await analysisAgent.analyze(request);

        // Send progress updates based on what was done
        if (response.schema) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ status: 'progress', step: 'schema', message: 'Schema generated' })}\n\n`)
          );
        }

        if (response.dataGenerated) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ status: 'progress', step: 'data', message: 'Synthetic data generated' })}\n\n`)
          );
        }

        if (response.queryResults.length > 0) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ status: 'progress', step: 'queries', message: `Executed ${response.queryResults.length} queries` })}\n\n`)
          );
        }

        // Send final result
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ status: 'complete', result: response })}\n\n`)
        );

        // Send done signal
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      } catch (error) {
        const appError = classifyError(error);
        logError('analyze/stream', error);

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              status: 'error',
              error: appError.userMessage,
              code: appError.code,
              isRetryable: appError.isRetryable,
            })}\n\n`
          )
        );
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * GET handler for analysis status/info.
 * Returns information about the analysis endpoint capabilities.
 */
export async function GET() {
  return new Response(
    JSON.stringify({
      endpoint: '/api/analyze',
      description: 'Intelligent data analysis endpoint',
      methods: ['POST'],
      parameters: {
        query: {
          type: 'string',
          required: true,
          description: 'Natural language query describing the analysis to perform',
        },
        recordCount: {
          type: 'number',
          required: false,
          default: 100,
          description: 'Number of synthetic records to generate',
        },
        useExistingData: {
          type: 'boolean',
          required: false,
          default: false,
          description: 'Whether to use existing data instead of generating new data',
        },
        stream: {
          type: 'boolean',
          required: false,
          default: false,
          description: 'Whether to stream the response for long-running analysis',
        },
      },
      supportedAnalysisTypes: [
        'fraud_detection',
        'geographic_analysis',
        'similarity_search',
        'time_series',
        'categorical_comparison',
        'anomaly_detection',
      ],
      examples: [
        {
          query: 'Analyze crypto fraud patterns in Asia',
          description: 'Fraud detection with geographic analysis',
        },
        {
          query: 'Show me sales trends over the last year',
          description: 'Time series analysis',
        },
        {
          query: 'Find similar photos to the uploaded image',
          description: 'Similarity search with photo gallery',
        },
      ],
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
