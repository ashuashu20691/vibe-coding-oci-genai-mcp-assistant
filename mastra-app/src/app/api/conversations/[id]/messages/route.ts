// app/api/conversations/[id]/messages/route.ts
/**
 * Conversation messages API route.
 * Handles GET and POST operations for messages within a conversation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ConversationStore } from '@/db/conversation-store';
import { loadConfig, isOracleConfigured } from '@/config';
import { MessageRole } from '@/types';
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

interface MessageRequestBody {
  role: MessageRole;
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  toolCallId?: string;
}

/**
 * GET /api/conversations/[id]/messages
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
      'messages/GET/conversation'
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
      'messages/GET/messages'
    );
    
    return NextResponse.json(messages);
  } catch (error) {
    logError('messages/GET', error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

/**
 * POST /api/conversations/[id]/messages
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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
    const body: MessageRequestBody = await request.json();

    if (!body.role || !['user', 'assistant', 'system', 'tool'].includes(body.role)) {
      return NextResponse.json(
        { 
          error: 'Valid role is required (user, assistant, system, tool)',
          code: ErrorCode.VALIDATION_ERROR,
          userMessage: 'Please provide a valid message role.',
          isRetryable: false,
        },
        { status: 400 }
      );
    }

    if (body.content === undefined || body.content === null) {
      return NextResponse.json(
        { 
          error: 'Content is required',
          code: ErrorCode.VALIDATION_ERROR,
          userMessage: 'Please provide message content.',
          isRetryable: false,
        },
        { status: 400 }
      );
    }

    const conversation = await withRetry(
      () => conversationStore.getConversation(id),
      'messages/POST/conversation'
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

    const message = await withRetry(
      () => conversationStore.addMessage(id, {
        role: body.role,
        content: body.content,
        timestamp: new Date(),
        toolCalls: body.toolCalls,
        toolCallId: body.toolCallId,
      }),
      'messages/POST/add'
    );

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    logError('messages/POST', error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}
