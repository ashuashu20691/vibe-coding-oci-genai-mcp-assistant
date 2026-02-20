'use client';

import { useState, useCallback } from 'react';
import { Conversation, Message } from '@/types';

interface UseConversationOptions {
  dbConnected?: boolean;
}

interface UseConversationReturn {
  currentConversation: Conversation | null;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  dbConnected: boolean;
  selectConversation: (conversation: Conversation) => Promise<void>;
  createConversation: (title?: string) => Promise<Conversation | null>;
  clearConversation: () => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => Promise<Message | null>;
  setDbConnected: (connected: boolean) => void;
}

export function useConversation(options: UseConversationOptions = {}): UseConversationReturn {
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dbConnected, setDbConnected] = useState(options.dbConnected ?? true);

  // Select and load a conversation
  const selectConversation = useCallback(async (conversation: Conversation) => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch conversation with messages
      const response = await fetch(`/api/conversations/${conversation.id}`);

      if (!response.ok) {
        if (response.status === 503) {
          setDbConnected(false);
          throw new Error('Database not connected');
        }
        throw new Error('Failed to load conversation');
      }

      const data = await response.json();

      // Parse message dates
      const parsedMessages: Message[] = (data.messages || []).map((msg: Message) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }));

      setCurrentConversation({
        ...conversation,
        createdAt: new Date(data.createdAt || conversation.createdAt),
        updatedAt: new Date(data.updatedAt || conversation.updatedAt),
      });
      setMessages(parsedMessages);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load conversation';
      setError(errorMessage);
      
      // If database is not connected, still set the conversation but with empty messages
      if (!dbConnected) {
        setCurrentConversation(conversation);
        setMessages([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [dbConnected]);

  // Create a new conversation
  const createConversation = useCallback(async (title?: string): Promise<Conversation | null> => {
    if (!dbConnected) {
      // Create a local-only conversation
      const localConversation: Conversation = {
        id: crypto.randomUUID(),
        title: title || 'New Conversation',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setCurrentConversation(localConversation);
      setMessages([]);
      return localConversation;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title || 'New Conversation' }),
      });

      if (!response.ok) {
        if (response.status === 503) {
          setDbConnected(false);
          // Fall back to local conversation
          const localConversation: Conversation = {
            id: crypto.randomUUID(),
            title: title || 'New Conversation',
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          setCurrentConversation(localConversation);
          setMessages([]);
          return localConversation;
        }
        throw new Error('Failed to create conversation');
      }

      const conversation = await response.json();
      const parsedConversation: Conversation = {
        ...conversation,
        createdAt: new Date(conversation.createdAt),
        updatedAt: new Date(conversation.updatedAt),
      };

      setCurrentConversation(parsedConversation);
      setMessages([]);
      return parsedConversation;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create conversation';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [dbConnected]);

  // Clear the current conversation (start fresh)
  const clearConversation = useCallback(() => {
    setCurrentConversation(null);
    setMessages([]);
    setError(null);
  }, []);

  // Add a message to the current conversation
  const addMessage = useCallback(async (
    message: Omit<Message, 'id' | 'timestamp'>
  ): Promise<Message | null> => {
    const newMessage: Message = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };

    // Optimistically add to local state
    setMessages(prev => [...prev, newMessage]);

    // If we have a conversation and database is connected, persist
    if (currentConversation && dbConnected) {
      try {
        const response = await fetch(`/api/conversations/${currentConversation.id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: message.role,
            content: message.content,
            toolCalls: message.toolCalls,
            toolCallId: message.toolCallId,
          }),
        });

        if (!response.ok) {
          if (response.status === 503) {
            setDbConnected(false);
            // Message is already in local state, just continue
            return newMessage;
          }
          console.error('Failed to persist message');
        }
      } catch (err) {
        console.error('Failed to persist message:', err);
        // Message is already in local state, continue without persistence
      }
    }

    return newMessage;
  }, [currentConversation, dbConnected]);

  return {
    currentConversation,
    messages,
    isLoading,
    error,
    dbConnected,
    selectConversation,
    createConversation,
    clearConversation,
    addMessage,
    setDbConnected,
  };
}
