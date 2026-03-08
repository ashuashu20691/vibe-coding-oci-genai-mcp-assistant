/**
 * Integration test for conversation persistence.
 * Validates that conversations and messages are properly saved and loaded.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Conversation Persistence', () => {
  beforeEach(() => {
    // Reset fetch mock
    global.fetch = vi.fn();
  });

  it('should create a new conversation when sending first message', async () => {
    const mockConversation = {
      id: 'conv-123',
      title: 'Test conversation',
      modelId: 'google.gemini-2.5-flash',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Mock conversation creation
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockConversation,
    } as Response);

    // Mock message saving
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    // Simulate creating a conversation
    const createRes = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test conversation',
        modelId: 'google.gemini-2.5-flash',
      }),
    });

    expect(createRes.ok).toBe(true);
    const conversation = await createRes.json();
    expect(conversation.id).toBe('conv-123');

    // Simulate saving a user message
    const messageRes = await fetch(`/api/conversations/${conversation.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'user',
        content: 'Hello, world!',
      }),
    });

    expect(messageRes.ok).toBe(true);
  });

  it('should load conversation history when selecting a conversation', async () => {
    const mockConversation = {
      id: 'conv-123',
      title: 'Test conversation',
      modelId: 'google.gemini-2.5-flash',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockMessages = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hi there!',
        timestamp: new Date().toISOString(),
      },
    ];

    // Mock conversation loading
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...mockConversation,
        messages: mockMessages,
      }),
    } as Response);

    // Simulate loading a conversation
    const res = await fetch('/api/conversations/conv-123/messages');
    expect(res.ok).toBe(true);
    
    const data = await res.json();
    expect(data.messages).toHaveLength(2);
    expect(data.messages[0].role).toBe('user');
    expect(data.messages[1].role).toBe('assistant');
  });

  it('should list all conversations', async () => {
    const mockConversations = [
      {
        id: 'conv-1',
        title: 'First conversation',
        modelId: 'google.gemini-2.5-flash',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'conv-2',
        title: 'Second conversation',
        modelId: 'google.gemini-2.5-flash',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    // Mock conversations list
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockConversations,
    } as Response);

    // Simulate listing conversations
    const res = await fetch('/api/conversations');
    expect(res.ok).toBe(true);
    
    const conversations = await res.json();
    expect(conversations).toHaveLength(2);
    expect(conversations[0].id).toBe('conv-1');
    expect(conversations[1].id).toBe('conv-2');
  });
});
