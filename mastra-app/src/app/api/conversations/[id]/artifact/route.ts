// src/app/api/conversations/[id]/artifact/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { ConversationStore } from '@/db/conversation-store';
import { loadConfig, isOracleConfigured } from '@/config';
import type { Artifact } from '@/types';

// Create conversation store if Oracle is configured
let conversationStore: ConversationStore | null = null;
const config = loadConfig();
if (isOracleConfigured(config)) {
  conversationStore = new ConversationStore(config.oracle);
}

/**
 * GET /api/conversations/[id]/artifact
 * Get the active artifact for a conversation
 * Validates: Requirement 15.6 - Artifact persistence across turns
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      );
    }

    if (!conversationStore) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    // Get conversation with artifact
    const conversation = await conversationStore.getConversation(conversationId);
    
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      artifact: conversation.activeArtifact || null 
    });
  } catch (error) {
    console.error('Error getting conversation artifact:', error);
    
    return NextResponse.json(
      { error: 'Failed to get artifact' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/conversations/[id]/artifact
 * Update the active artifact for a conversation
 * Validates: Requirement 15.6 - Artifact persistence across turns
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { artifact } = await request.json();
    const { id: conversationId } = await params;

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      );
    }

    if (!conversationStore) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }
    
    // Serialize artifact for storage
    const artifactJson = artifact ? JSON.stringify(serializeArtifact(artifact)) : null;

    // Update conversation with artifact
    await conversationStore.updateConversationArtifact(conversationId, artifactJson);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating conversation artifact:', error);
    
    // Check if it's a database connection error
    if (error instanceof Error && error.message.includes('not connected')) {
      return NextResponse.json(
        { error: 'Database not connected' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update artifact' },
      { status: 500 }
    );
  }
}

/**
 * Serialize artifact for storage
 * Handles Date objects and React components that can't be directly serialized
 */
function serializeArtifact(artifact: Artifact): Record<string, unknown> {
  const serialized: Record<string, unknown> = {
    id: artifact.id,
    type: artifact.type,
    title: artifact.title,
    version: artifact.version,
    createdAt: artifact.createdAt.toISOString(),
    updatedAt: artifact.updatedAt.toISOString(),
    metadata: artifact.metadata,
  };

  // Handle content based on type
  const content = artifact.content;
  
  if (content.type === 'react_component') {
    // React components can't be serialized - store a placeholder
    serialized.content = {
      type: 'react_component',
      component: null,
      props: content.props,
      _note: 'React component cannot be persisted',
    };
  } else {
    serialized.content = content;
  }

  return serialized;
}
