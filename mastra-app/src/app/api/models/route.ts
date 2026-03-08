// app/api/models/route.ts
/**
 * Models API route.
 * Returns list of available OCI GenAI models.
 */

import { NextResponse } from 'next/server';
import { ociProvider } from '@/mastra';

/**
 * GET /api/models
 * List all available OCI GenAI models.
 */
export async function GET() {
  try {
    // Get models from OCI provider
    const models = ociProvider.listModels();
    
    return NextResponse.json(models);
  } catch (error) {
    console.error('[models/GET] Error listing models:', error);
    
    // Return fallback models if provider fails
    return NextResponse.json([
      {
        id: 'google.gemini-2.5-flash',
        name: 'Google Gemini 2.5 Flash',
        description: 'Fast and efficient Gemini model for quick tasks',
        contextLength: 1000000,
      },
      {
        id: 'cohere.command-r-plus',
        name: 'Cohere Command R+',
        description: 'Cohere Command R+ model for advanced reasoning',
        contextLength: 128000,
      },
      {
        id: 'meta.llama-3.1-70b-instruct',
        name: 'Meta Llama 3.1 70B Instruct',
        description: "Meta's efficient Llama 3.1 70B model",
        contextLength: 128000,
      },
    ]);
  }
}
