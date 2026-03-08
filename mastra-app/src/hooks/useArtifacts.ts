// src/hooks/useArtifacts.ts

import { useState, useCallback } from 'react';
import type { Artifact, ArtifactModification } from '@/types';

/**
 * Hook for managing artifacts panel state
 * Validates: Requirements 15.3, 15.5, 15.6, 15.7
 */
export interface UseArtifactsReturn {
  artifact: Artifact | null;
  isOpen: boolean;
  setArtifact: (artifact: Artifact | null, conversationId?: string | null) => void;
  updateArtifact: (updates: Partial<Artifact>, conversationId?: string | null) => void;
  closePanel: () => void;
  openPanel: () => void;
  onUserModification: (modification: Omit<ArtifactModification, 'timestamp'>) => void;
  restoreArtifact: (artifact: Artifact | null) => void;
}

export function useArtifacts(): UseArtifactsReturn {
  const [artifact, setArtifactState] = useState<Artifact | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const setArtifact = useCallback((newArtifact: Artifact | null, conversationId?: string | null) => {
    setArtifactState(newArtifact);
    setIsOpen(newArtifact !== null);
    
    // Persist artifact to conversation if conversationId is provided
    // Validates: Requirement 15.6 - Artifact persistence across turns
    if (conversationId) {
      persistArtifactToConversation(conversationId, newArtifact).catch((error) => {
        console.error('Failed to persist artifact:', error);
      });
    }
  }, []);

  const updateArtifact = useCallback((updates: Partial<Artifact>, conversationId?: string | null) => {
    setArtifactState((prev) => {
      if (!prev) return null;
      const updated = {
        ...prev,
        ...updates,
        version: prev.version + 1,
        updatedAt: new Date(),
      };
      
      // Persist updated artifact to conversation if conversationId is provided
      // Validates: Requirement 15.6 - Artifact persistence across turns
      if (conversationId) {
        persistArtifactToConversation(conversationId, updated).catch((error) => {
          console.error('Failed to persist artifact update:', error);
        });
      }
      
      return updated;
    });
  }, []);

  const closePanel = useCallback(() => {
    setIsOpen(false);
    // Keep artifact in state for potential re-opening
  }, []);

  const openPanel = useCallback(() => {
    if (artifact) {
      setIsOpen(true);
    }
  }, [artifact]);

  const onUserModification = useCallback((modification: Omit<ArtifactModification, 'timestamp'>) => {
    // This will be called when user interacts with artifact
    // The parent component can listen to this and send acknowledgment to chat
    const { modificationType, details } = modification;
    
    // Log modification details for debugging
    if (modificationType === 'filter') {
      console.log(`User filtered artifact: column="${details.column}", value="${details.value}"`);
    } else if (modificationType === 'sort') {
      console.log(`User sorted artifact: column="${details.column}", direction="${details.direction}"`);
    } else {
      console.log('User modified artifact:', modification);
    }
    
    // Update artifact version to reflect modification
    setArtifactState((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        version: prev.version + 1,
        updatedAt: new Date(),
      };
    });
  }, []);

  /**
   * Restore artifact from conversation state
   * Used when loading a conversation to restore its active artifact
   * Validates: Requirement 15.6 - Artifact persistence across turns
   */
  const restoreArtifact = useCallback((restoredArtifact: Artifact | null) => {
    setArtifactState(restoredArtifact);
    setIsOpen(restoredArtifact !== null);
  }, []);

  return {
    artifact,
    isOpen,
    setArtifact,
    updateArtifact,
    closePanel,
    openPanel,
    onUserModification,
    restoreArtifact,
  };
}

/**
 * Persist artifact to conversation in database
 * Validates: Requirement 15.6 - Artifact persistence across turns
 */
async function persistArtifactToConversation(
  conversationId: string,
  artifact: Artifact | null
): Promise<void> {
  try {
    const response = await fetch(`/api/conversations/${conversationId}/artifact`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artifact }),
    });

    if (!response.ok) {
      throw new Error(`Failed to persist artifact: ${response.statusText}`);
    }
  } catch (error) {
    // Re-throw to allow caller to handle
    throw error;
  }
}
