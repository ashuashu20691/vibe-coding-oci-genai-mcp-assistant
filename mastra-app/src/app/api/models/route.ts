// app/api/models/route.ts
/**
 * Models API route.
 * Returns list of available OCI GenAI models.
 * 
 * Requirements: 1.4, 5.2, 9.1
 */

import { NextResponse } from 'next/server';
import { ociProvider } from '@/mastra';
import { logError, formatErrorResponse } from '@/lib/errors';

export async function GET() {
  try {
    // Check for initialization errors (Requirement 9.1)
    const initError = ociProvider.getInitError();
    if (initError) {
      logError('models/GET', initError);
      // Still return models list even if OCI client failed to initialize
      // The models are statically defined
    }
    
    const models = ociProvider.listModels();
    return NextResponse.json(models);
  } catch (error) {
    logError('models/GET', error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}
