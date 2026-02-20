// app/api/conversations/route.ts
/**
 * Conversations API route.
 * Handles listing and creating conversations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ConversationStore, DBConnectionError, SQLExecutionError } from '@/db/conversation-store';
import { loadConfig, isOracleConfigured } from '@/config';
import { ErrorCode, classifyError, logError, formatErrorResponse } from '@/lib/errors';

const config = loadConfig();

// Singleton store instance
let store: ConversationStore | null = null;

function getStore(): ConversationStore | null {
  console.log('[conversations/route] Checking Oracle config:', {
    user: config.oracle.user ? '***' : 'missing',
    password: config.oracle.password ? '***' : 'missing',
    connectString: config.oracle.connectString || 'missing',
    walletLocation: config.oracle.walletLocation || 'missing',
  });
  console.log('[conversations/route] isOracleConfigured:', isOracleConfigured(config));
  
  if (!isOracleConfigured(config)) {
    return null;
  }
  if (!store) {
    store = new ConversationStore(config.oracle);
  }
  return store;
}

// Maximum retry attempts for recoverable errors
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

/**
 * Retry wrapper for database operations.
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
 * GET /api/conversations
 * List conversations, optionally filtered by search query.
 */
export async function GET(request: NextRequest) {
  const conversationStore = getStore();
  
  if (!conversationStore) {
    return NextResponse.json(
      { 
        error: 'Database not configured',
        code: ErrorCode.DB_CONNECTION_ERROR,
        userMessage: 'Database is not configured. Conversations are stored in session only.',
        conversations: [],
        isRetryable: false,
      },
      { status: 503 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    const conversations = await withRetry(
      () => query ? conversationStore.searchConversations(query) : conversationStore.listConversations(),
      'conversations/GET'
    );

    return NextResponse.json(conversations);
  } catch (error) {
    logError('conversations/GET', error);
    
    if (error instanceof DBConnectionError) {
      return NextResponse.json(
        { 
          ...formatErrorResponse(error),
          conversations: [],
        },
        { status: 503 }
      );
    }

    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

/**
 * POST /api/conversations
 * Create a new conversation.
 */
export async function POST(request: NextRequest) {
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
    const body = await request.json();
    const { title, modelId } = body;

    const conversation = await withRetry(
      () => conversationStore.createConversation(title, modelId),
      'conversations/POST'
    );

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    logError('conversations/POST', error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}
