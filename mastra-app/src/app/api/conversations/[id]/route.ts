// app/api/conversations/[id]/route.ts
/**
 * Individual conversation API route.
 * Handles GET, PATCH, and DELETE operations for a specific conversation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ConversationStore, DBConnectionError } from '@/db/conversation-store';
import { loadConfig, isOracleConfigured } from '@/config';
import { ErrorCode, classifyError, logError, formatErrorResponse } from '@/lib/errors';

const config = loadConfig();

// Singleton store instance
let store: ConversationStore | null = null;

function getStore(): ConversationStore | null {
  if (!isOracleConfigured(config)) {
    return null;
  }
  if (!store) {
    store = new ConversationStore(config.oracle);
  }
  return store;
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

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

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/conversations/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const conversationStore = getStore();
  
  if (!conversationStore) {
    return NextResponse.json(
      { 
        ...formatErrorResponse(new Error('Database not configured')),
        code: ErrorCode.DB_CONNECTION_ERROR,
      },
      { status: 503 }
    );
  }

  try {
    const { id } = await params;

    const conversation = await withRetry(
      () => conversationStore.getConversation(id),
      'conversations/[id]/GET'
    );
    
    if (!conversation) {
      return NextResponse.json(
        { 
          error: 'Conversation not found',
          code: ErrorCode.VALIDATION_ERROR,
          userMessage: 'The requested conversation could not be found.',
          isRetryable: false,
        },
        { status: 404 }
      );
    }

    const messages = await withRetry(
      () => conversationStore.getMessages(id),
      'conversations/[id]/GET/messages'
    );

    return NextResponse.json({
      ...conversation,
      messages,
    });
  } catch (error) {
    logError('conversations/[id]/GET', error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

/**
 * PATCH /api/conversations/[id]
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const conversationStore = getStore();
  
  if (!conversationStore) {
    return NextResponse.json(
      { 
        ...formatErrorResponse(new Error('Database not configured')),
        code: ErrorCode.DB_CONNECTION_ERROR,
      },
      { status: 503 }
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { title, modelId } = body;

    // At least one field must be provided
    if (!title && !modelId) {
      return NextResponse.json(
        { 
          error: 'Title or modelId is required',
          code: ErrorCode.VALIDATION_ERROR,
          userMessage: 'Please provide a title or model ID to update.',
          isRetryable: false,
        },
        { status: 400 }
      );
    }

    const conversation = await withRetry(
      () => conversationStore.getConversation(id),
      'conversations/[id]/PATCH/get'
    );
    
    if (!conversation) {
      return NextResponse.json(
        { 
          error: 'Conversation not found',
          code: ErrorCode.VALIDATION_ERROR,
          userMessage: 'The requested conversation could not be found.',
          isRetryable: false,
        },
        { status: 404 }
      );
    }

    // Update title if provided
    if (title && typeof title === 'string') {
      await withRetry(
        () => conversationStore.updateConversationTitle(id, title),
        'conversations/[id]/PATCH/updateTitle'
      );
    }

    // Update modelId if provided
    if (modelId && typeof modelId === 'string') {
      await withRetry(
        () => conversationStore.updateConversationModelId(id, modelId),
        'conversations/[id]/PATCH/updateModelId'
      );
    }

    return NextResponse.json({
      ...conversation,
      title: title || conversation.title,
      modelId: modelId || conversation.modelId,
      updatedAt: new Date(),
    });
  } catch (error) {
    logError('conversations/[id]/PATCH', error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

/**
 * DELETE /api/conversations/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const conversationStore = getStore();
  
  if (!conversationStore) {
    return NextResponse.json(
      { 
        ...formatErrorResponse(new Error('Database not configured')),
        code: ErrorCode.DB_CONNECTION_ERROR,
      },
      { status: 503 }
    );
  }

  try {
    const { id } = await params;

    const conversation = await withRetry(
      () => conversationStore.getConversation(id),
      'conversations/[id]/DELETE/get'
    );
    
    if (!conversation) {
      return NextResponse.json(
        { 
          error: 'Conversation not found',
          code: ErrorCode.VALIDATION_ERROR,
          userMessage: 'The requested conversation could not be found.',
          isRetryable: false,
        },
        { status: 404 }
      );
    }

    await withRetry(
      () => conversationStore.deleteConversation(id),
      'conversations/[id]/DELETE/delete'
    );

    return NextResponse.json({ success: true, deleted: id });
  } catch (error) {
    logError('conversations/[id]/DELETE', error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}
