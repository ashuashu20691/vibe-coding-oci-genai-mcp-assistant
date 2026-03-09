'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Conversation, Message, Artifact, ArtifactModification } from '@/types';
import { MessageList } from './MessageList';
import { WorkingBadge } from './WorkingBadge';
import { ArtifactsPanel } from './ArtifactsPanel';
import { MainLayout } from './MainLayout';
import { useArtifacts } from '@/hooks/useArtifacts';
import { shouldRouteToArtifacts } from '@/utils/result-routing';

const DEFAULT_MODEL = 'google.gemini-2.5-flash';

interface UIMessage extends Message {
  progress?: { current: number; total: number };
  isProgressMessage?: boolean;
}

interface IterationState {
  currentIteration: number;
  maxIterations: number;
  strategy?: string;
  isFadingOut?: boolean;
}

export function CopilotChatUI({ appTitle = 'OCI GenAI Chat' }: { appTitle?: string }) {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);
  const [iterationState, setIterationState] = useState<IterationState | null>(null);
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string; description: string }>>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fadeOutTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Artifacts state management (Requirement 15.2, 15.3, 15.5)
  const {
    artifact,
    isOpen: isArtifactsPanelOpen,
    setArtifact,
    updateArtifact,
    closePanel: closeArtifactsPanel,
    openPanel: openArtifactsPanel,
    onUserModification: handleArtifactModification,
    restoreArtifact,
  } = useArtifacts();

  // Handle user modifications to artifacts (Requirement 15.5)
  const onArtifactModification = useCallback((modification: ArtifactModification) => {
    // Call the hook's handler
    handleArtifactModification(modification);
    
    // Generate acknowledgment message in chat
    let acknowledgment = '';
    if (modification.modificationType === 'filter') {
      const { column, value } = modification.details;
      acknowledgment = `I see you filtered the table by ${column}="${value}".`;
    } else if (modification.modificationType === 'sort') {
      const { column, direction } = modification.details;
      acknowledgment = `I see you sorted the table by ${column} in ${direction} order.`;
    } else if (modification.modificationType === 'edit') {
      acknowledgment = `I see you edited the artifact.`;
    } else if (modification.modificationType === 'interact') {
      acknowledgment = `I see you interacted with the artifact.`;
    }
    
    if (acknowledgment) {
      const ackMsg: UIMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: acknowledgment,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, ackMsg]);
    }
  }, [handleArtifactModification]);

  // Helper to determine if visualization should route to artifacts panel (Requirement 15.2)
  // Uses the centralized routing logic from result-routing utility
  const shouldRouteToArtifactsPanel = useCallback((visualization: Message['visualization']): boolean => {
    return shouldRouteToArtifacts(visualization);
  }, []);

  // Helper to create artifact from visualization (Requirement 15.3)
  const createArtifactFromVisualization = useCallback((visualization: Message['visualization']): Artifact | null => {
    if (!visualization) return null;
    
    const now = new Date();
    const artifactId = `artifact-${Date.now()}`;
    
    if (visualization.type === 'table') {
      return {
        id: artifactId,
        type: 'table',
        title: visualization.title || 'Data Table',
        content: {
          type: 'table',
          data: Array.isArray(visualization.data) ? visualization.data : [],
        },
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
    } else if (['bar_chart', 'line_chart', 'pie_chart', 'scatter_chart', 'area_chart'].includes(visualization.type)) {
      return {
        id: artifactId,
        type: 'chart',
        title: visualization.title || 'Chart',
        content: {
          type: 'chart',
          chartType: visualization.type,
          data: visualization.data,
        },
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
    } else if (visualization.type === 'map') {
      return {
        id: artifactId,
        type: 'chart',
        title: visualization.title || 'Map',
        content: {
          type: 'chart',
          chartType: 'map',
          data: visualization.data,
        },
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
    } else if (visualization.html) {
      // HTML dashboards — render as iframe in artifacts panel
      // If we also have structured data, prefer native chart rendering
      if (visualization.data && Array.isArray(visualization.data) && visualization.data.length > 0) {
        // We have both HTML and data — use HTML for the rich dashboard experience
        // but also store data for potential table/chart tab switching
        return {
          id: artifactId,
          type: 'html',
          title: visualization.title || 'Dashboard',
          content: {
            type: 'html',
            html: visualization.html,
          },
          version: 1,
          createdAt: now,
          updatedAt: now,
          metadata: { data: visualization.data },
        };
      }
      return {
        id: artifactId,
        type: 'html',
        title: visualization.title || 'Dashboard',
        content: {
          type: 'html',
          html: visualization.html,
        },
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
    }
    
    return null;
  }, []);

  // Handle fade-out animation completion
  useEffect(() => {
    if (iterationState?.isFadingOut) {
      // Clear any existing timeout
      if (fadeOutTimeoutRef.current) {
        clearTimeout(fadeOutTimeoutRef.current);
      }
      
      // Set new timeout for cleanup
      fadeOutTimeoutRef.current = setTimeout(() => {
        setIterationState(null);
        fadeOutTimeoutRef.current = null;
      }, 350); // Wait for fade-out animation to complete
    }
    
    return () => {
      if (fadeOutTimeoutRef.current) {
        clearTimeout(fadeOutTimeoutRef.current);
      }
    };
  }, [iterationState?.isFadingOut]);

  useEffect(() => {
    fetchConversations();
  }, [conversationId]);

  // Load available models from API
  useEffect(() => {
    fetch('/api/models')
      .then((r) => (r.ok ? r.json() : []))
      .then((models) => {
        if (Array.isArray(models) && models.length > 0) {
          setAvailableModels(models);
        }
      })
      .catch(() => {
        // Fallback to default models if API fails
        setAvailableModels([
          { id: 'google.gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast and efficient' },
          { id: 'cohere.command-r-plus', name: 'Command R+', description: 'Advanced reasoning' },
          { id: 'meta.llama-3.1-70b-instruct', name: 'Llama 3.1 70B', description: 'Efficient model' },
        ]);
      });
  }, []);

  const fetchConversations = useCallback(() => {
    fetch('/api/conversations')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data.conversations || [];
        setConversations(
          list.map((c: Conversation) => ({
            ...c,
            createdAt: new Date(c.createdAt),
            updatedAt: new Date(c.updatedAt),
          }))
        );
      })
      .catch(() => {});
  }, []);

  const loadConversation = async (conv: Conversation) => {
    console.log('[loadConversation] Loading conversation:', conv.id);
    setConversationId(conv.id);
    if (conv.modelId) setSelectedModel(conv.modelId);
    
    try {
      const r = await fetch('/api/conversations/' + conv.id);
      console.log('[loadConversation] API response status:', r.status);
      
      if (r.ok) {
        const data = await r.json();
        console.log('[loadConversation] API response data:', data);
        console.log('[loadConversation] Messages array:', data.messages);
        
        const arr = Array.isArray(data.messages) ? data.messages : [];
        console.log('[loadConversation] Processing', arr.length, 'messages');
        
        const processedMessages = arr.map((m: {
          id: string;
          role: string;
          content: string;
          timestamp?: string;
          toolCalls?: unknown;
          toolCallId?: string;
          toolNarratives?: unknown;
          adaptationNarratives?: unknown;
          visualization?: unknown;
          analysis?: unknown;
          toolErrors?: unknown;
        }): UIMessage => {
          const msg = {
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
            toolCalls: m.toolCalls as Message['toolCalls'],
            toolCallId: m.toolCallId,
            toolNarratives: m.toolNarratives as Message['toolNarratives'],
            adaptationNarratives: m.adaptationNarratives as Message['adaptationNarratives'],
            visualization: m.visualization as Message['visualization'],
            analysis: m.analysis as Message['analysis'],
            toolErrors: m.toolErrors as Message['toolErrors'],
          };
          if (msg.visualization) {
            console.log(`[loadConversation] Message ${msg.id} has visualization:`, msg.visualization);
          }
          return msg;
        });
        
        console.log('[loadConversation] Processed messages:', processedMessages);
        setMessages(processedMessages);
        console.log('[loadConversation] Messages state updated');
      } else {
        console.error('[loadConversation] API request failed:', r.status, r.statusText);
      }
    } catch (error) {
      console.error('[loadConversation] Error loading conversation:', error);
    }
    
    // Restore artifact from conversation (Requirement 15.6)
    try {
      const artifactRes = await fetch(`/api/conversations/${conv.id}/artifact`);
      if (artifactRes.ok) {
        const artifactData = await artifactRes.json();
        if (artifactData.artifact) {
          // Convert date strings back to Date objects
          const restoredArtifact: Artifact = {
            ...artifactData.artifact,
            createdAt: new Date(artifactData.artifact.createdAt),
            updatedAt: new Date(artifactData.artifact.updatedAt),
          };
          restoreArtifact(restoredArtifact);
        } else {
          restoreArtifact(null);
        }
      }
    } catch (err) {
      console.error('Failed to restore artifact:', err);
      restoreArtifact(null);
    }
  };

  const newChat = () => {
    setConversationId(null);
    setMessages([]);
    closeArtifactsPanel(); // Clear artifacts when starting new chat
  };

  const handleModelChange = useCallback(async (modelId: string) => {
    setSelectedModel(modelId);
    if (conversationId) {
      try {
        await fetch(`/api/conversations/${conversationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modelId }),
        });
      } catch {}
    }
  }, [conversationId]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    
    const userMsg: UIMessage = { 
      id: Date.now().toString(), 
      role: 'user', 
      content: input.trim(),
      timestamp: new Date()
    };
    
    // Clear input field immediately on submit
    setInput('');
    
    // Reset textarea height to default immediately
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
    
    setMessages((p) => [...p, userMsg]);
    setIsLoading(true);
    setIterationState(null); // Reset iteration state on new message

    // Create conversation if it doesn't exist
    let currentConversationId = conversationId;
    if (!currentConversationId) {
      try {
        const createRes = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: userMsg.content.slice(0, 50), // Use first 50 chars as title
            modelId: selectedModel,
          }),
        });
        
        if (createRes.ok) {
          const newConv = await createRes.json();
          currentConversationId = newConv.id;
          setConversationId(newConv.id);
          console.log('[CopilotChatUI] Created new conversation:', newConv.id);
          // Refresh conversations list to show the new conversation
          fetchConversations();
        }
      } catch (err) {
        console.error('Failed to create conversation:', err);
      }
    }

    // Save user message
    if (currentConversationId) {
      try {
        await fetch(`/api/conversations/${currentConversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: 'user',
            content: userMsg.content,
          }),
        });
      } catch (err) {
        console.error('Failed to save user message:', err);
      }
    }

    try {
      const allMsgs = [...messages, userMsg]
        .filter((m) => m.role === 'user' || m.content.trim())
        .map((m) => ({ id: m.id, role: m.role, content: m.content || '' }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: allMsgs, 
          modelId: selectedModel, 
          conversationId: currentConversationId, // Use the current conversation ID
        }),
      });

      if (!res.ok) throw new Error('Failed');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No body');

      const asstMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };
      setMessages((p) => [...p, asstMsg]);

      const dec = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';

        for (const ln of lines) {
          if (!ln.startsWith('data: ')) continue;
          const d = ln.slice(6);
          if (d === '[DONE]') continue;

          try {
            const p = JSON.parse(d);

            if (p.content) {
              setMessages((prev) => {
                const u = [...prev];
                const l = u[u.length - 1];
                if (l?.role === 'assistant') {
                  // Append to flat content string (for persistence/fallback)
                  const newContent = l.content + p.content;
                  // Also append to contentParts for ordered rendering
                  const parts = [...(l.contentParts || [])];
                  const lastPart = parts[parts.length - 1];
                  if (lastPart && lastPart.type === 'text') {
                    // Extend the last text part
                    parts[parts.length - 1] = { type: 'text', text: lastPart.text + p.content };
                  } else {
                    // Start a new text part
                    parts.push({ type: 'text', text: p.content });
                  }
                  u[u.length - 1] = { ...l, content: newContent, contentParts: parts };
                }
                return u;
              });
            } else if (p.toolCall) {
              // Handle real-time tool call events (Requirement 12.2, 12.5)
              setMessages((prev) => {
                const u = [...prev];
                const l = u[u.length - 1];
                if (l?.role === 'assistant') {
                  const toolCalls = [...(l.toolCalls || []), p.toolCall];
                  // Append tool to contentParts for ordered rendering
                  const parts = [...(l.contentParts || [])];
                  parts.push({ type: 'tool', toolCall: p.toolCall });
                  u[u.length - 1] = { ...l, toolCalls, contentParts: parts };
                }
                return u;
              });
            } else if (p.tool_narrative) {
              setMessages((prev) => {
                const u = [...prev];
                const l = u[u.length - 1];
                if (l?.role === 'assistant') {
                  const newContent = l.content + p.tool_narrative;
                  const parts = [...(l.contentParts || [])];
                  const lastPart = parts[parts.length - 1];
                  if (lastPart && lastPart.type === 'text') {
                    parts[parts.length - 1] = { type: 'text', text: lastPart.text + p.tool_narrative };
                  } else {
                    parts.push({ type: 'text', text: p.tool_narrative });
                  }
                  u[u.length - 1] = { ...l, content: newContent, contentParts: parts };
                }
                return u;
              });
            } else if (p.adaptation) {
              setMessages((prev) => {
                const u = [...prev];
                const l = u[u.length - 1];
                if (l?.role === 'assistant') {
                  const newContent = l.content + p.adaptation;
                  const parts = [...(l.contentParts || [])];
                  const lastPart = parts[parts.length - 1];
                  if (lastPart && lastPart.type === 'text') {
                    parts[parts.length - 1] = { type: 'text', text: lastPart.text + p.adaptation };
                  } else {
                    parts.push({ type: 'text', text: p.adaptation });
                  }
                  u[u.length - 1] = { ...l, content: newContent, contentParts: parts };
                }
                return u;
              });
            } else if (p.progress) {
              setMessages((prev) => {
                const u = [...prev];
                const l = u[u.length - 1];
                if (l?.role === 'assistant') {
                  const newContent = l.content + p.progress;
                  // Also append to contentParts for ordered rendering
                  const parts = [...(l.contentParts || [])];
                  const lastPart = parts[parts.length - 1];
                  if (lastPart && lastPart.type === 'text') {
                    parts[parts.length - 1] = { type: 'text', text: lastPart.text + p.progress };
                  } else {
                    parts.push({ type: 'text', text: p.progress });
                  }
                  u[u.length - 1] = { 
                    ...l, 
                    content: newContent,
                    contentParts: parts,
                    progress: p.step,
                    isProgressMessage: true
                  };
                }
                return u;
              });
            } else if (p.thinking) {
              setMessages((prev) => {
                const u = [...prev];
                const l = u[u.length - 1];
                if (l?.role === 'assistant') {
                  const newContent = l.content + p.thinking;
                  const parts = [...(l.contentParts || [])];
                  const lastPart = parts[parts.length - 1];
                  if (lastPart && lastPart.type === 'text') {
                    parts[parts.length - 1] = { type: 'text', text: lastPart.text + p.thinking };
                  } else {
                    parts.push({ type: 'text', text: p.thinking });
                  }
                  u[u.length - 1] = { ...l, content: newContent, contentParts: parts };
                }
                return u;
              });
            } else if (p.visualization) {
              // Route visualization to either inline or artifacts panel
              const routeToArtifacts = shouldRouteToArtifactsPanel(p.visualization);
              
              if (routeToArtifacts) {
                // Route to artifacts panel (Claude Desktop right-side panel)
                const newArtifact = createArtifactFromVisualization(p.visualization);
                if (newArtifact) {
                  setArtifact(newArtifact, conversationId);
                }
                // Also keep a lightweight reference in the message so user knows a viz was generated
                setMessages((prev) => {
                  const u = [...prev];
                  const l = u[u.length - 1];
                  if (l?.role === 'assistant') {
                    // Don't store the full HTML or data in the message — just a marker with routedToArtifacts flag
                    u[u.length - 1] = { ...l, visualization: { 
                      type: p.visualization.type, 
                      title: p.visualization.title,
                      routedToArtifacts: true,
                    }};
                  }
                  return u;
                });
              } else {
                // Small visualization - keep inline in message
                setMessages((prev) => {
                  const u = [...prev];
                  const l = u[u.length - 1];
                  if (l?.role === 'assistant') {
                    u[u.length - 1] = { ...l, visualization: p.visualization };
                  }
                  return u;
                });
              }
            } else if (p.analysis) {
              setMessages((prev) => {
                const u = [...prev];
                const l = u[u.length - 1];
                if (l?.role === 'assistant') u[u.length - 1] = { ...l, analysis: p.analysis };
                return u;
              });
            } else if (p.iteration_update) {
              // Handle iteration_update events for working badge
              setIterationState({
                currentIteration: p.iteration_update.current || 0,
                maxIterations: p.iteration_update.max || 5,
                strategy: p.iteration_update.strategy,
              });
            } else if (p.artifact_update) {
              // Handle artifact_update events (Requirement 15.3)
              if (artifact && p.artifact_update.artifactId === artifact.id) {
                // Update existing artifact
                updateArtifact({
                  content: p.artifact_update.content,
                  title: p.artifact_update.title || artifact.title,
                }, conversationId);
              } else {
                // Create new artifact
                const newArtifact: Artifact = {
                  id: p.artifact_update.artifactId || `artifact-${Date.now()}`,
                  type: p.artifact_update.type || 'table',
                  title: p.artifact_update.title || 'Artifact',
                  content: p.artifact_update.content,
                  version: 1,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                };
                setArtifact(newArtifact, conversationId);
              }
            } else if (p.error) {
              setMessages((prev) => {
                const u = [...prev];
                const l = u[u.length - 1];
                if (l?.role === 'assistant') u[u.length - 1] = { ...l, content: l.content + '\nError: ' + p.error };
                return u;
              });
            }
          } catch {}
        }
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Unknown error';
      setMessages((p) => [...p, { id: Date.now().toString(), role: 'assistant', content: 'Error: ' + errMsg, timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
      
      // Fade out iteration state with smooth animation
      // Check if there's an active iteration state to fade out
      setIterationState((prev) => {
        if (prev && !prev.isFadingOut) {
          return { ...prev, isFadingOut: true };
        }
        return prev;
      });
    }
  }, [input, isLoading, conversationId, messages, selectedModel, shouldRouteToArtifactsPanel, createArtifactFromVisualization, setArtifact, artifact, updateArtifact, fetchConversations]);

  const formatDate = (d: Date) => {
    const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
    return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : diff + 'd ago';
  };

  const grouped = conversations.reduce((a, c) => {
    const d = formatDate(c.updatedAt);
    (a[d] = a[d] || []).push(c);
    return a;
  }, {} as Record<string, Conversation[]>);

  const lastMessage = messages[messages.length - 1];
  const isLastMessageStreaming = isLoading && lastMessage?.role === 'assistant';

  // Sidebar component
  const sidebarComponent = (
    <aside 
      className={`copilot-sidebar ${sidebarOpen ? 'open' : ''}`}
      role="navigation"
      aria-label="Conversation history"
    >
      <nav className="copilot-sidebar-inner">
        {/* New Chat Button */}
        <div style={{ padding: '12px' }}>
          <button 
            onClick={newChat}
            onKeyDown={(e) => {
              // Support Space and Enter keys for activation - Requirement 27.4
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                newChat();
              }
            }}
            className="copilot-new-chat-btn"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New chat
          </button>
        </div>

        {/* Conversations */}
        <div className="copilot-conversations">
          {Object.entries(grouped).map(([date, convs]) => (
            <div key={date} className="copilot-conv-group">
              <div className="copilot-conv-date">
                {date}
              </div>
              {convs.map((c) => (
                <div key={c.id} className={`copilot-conv-item ${conversationId === c.id ? 'active' : ''}`}>
                  <button
                    onClick={() => loadConversation(c)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', textAlign: 'left', minWidth: 0, padding: 0 }}
                  >
                    <svg className="copilot-conv-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ flexShrink: 0 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span className="copilot-conv-title">{c.title || 'Untitled'}</span>
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm('Delete this conversation?')) return;
                      try {
                        await fetch(`/api/conversations/${c.id}`, { method: 'DELETE' });
                        if (conversationId === c.id) { setConversationId(null); setMessages([]); }
                        fetchConversations();
                      } catch {}
                    }}
                    title="Delete"
                    className="conv-delete-btn"
                    style={{ flexShrink: 0, padding: '2px 4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', borderRadius: '4px' }}
                  >
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </nav>
    </aside>
  );

  // Chat panel component
  const chatPanelComponent = (
    <main 
      role="main" 
      aria-label="Chat conversation"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'
      }}
    >
      <style jsx>{`
        @keyframes fadeOut {
          from {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
          to {
            opacity: 0;
            transform: translateX(-50%) translateY(-4px);
          }
        }
      `}</style>
      {/* Header */}
      <div style={{
        height: '48px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        flexShrink: 0
      }}>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          onKeyDown={(e) => {
            // Support Space and Enter keys for activation - Requirement 27.4
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              setSidebarOpen(!sidebarOpen);
            }
          }}
          className="copilot-sidebar-toggle"
          aria-label="Toggle sidebar"
          aria-expanded={sidebarOpen}
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <MessageList 
        messages={messages}
        isLoading={isLoading}
        isStreaming={isLastMessageStreaming}
        onSuggestionClick={setInput}
        onViewArtifact={openArtifactsPanel}
      />

      {/* Working Badge - displayed during autonomous iteration loops */}
      {iterationState && (
        <div style={{
          position: 'fixed',
          bottom: '100px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          animation: iterationState.isFadingOut ? 'fadeOut 0.3s ease-out forwards' : 'none',
        }}>
          <WorkingBadge
            currentIteration={iterationState.currentIteration}
            maxIterations={iterationState.maxIterations}
            strategy={iterationState.strategy}
          />
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: '12px 20px 20px',
        flexShrink: 0,
        background: 'var(--bg-primary)'
      }}>
        {/* Claude-style unified input card */}
        <div style={{ maxWidth: '780px', margin: '0 auto', width: '100%' }}>
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="chat-input-card">
            {/* Textarea row */}
            <label htmlFor="message-input" className="sr-only">Type your message</label>
            <textarea
              id="message-input"
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
              }}
              placeholder="How can I help you today?"
              disabled={isLoading}
              rows={1}
              tabIndex={0}
              className="chat-input-textarea"
            />
            {/* Bottom toolbar row */}
            <div className="chat-input-toolbar">
              {/* Left: spacer */}
              <div />
              {/* Right: model selector + send button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label htmlFor="model-selector" className="sr-only">Select AI model</label>
                <select
                  id="model-selector"
                  value={selectedModel}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="chat-model-select"
                  tabIndex={0}
                  aria-label="Select AI model"
                >
                  {availableModels.map((model) => (
                    <option key={model.id} value={model.id}>{model.name}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="chat-send-btn"
                  aria-label="Send message"
                >
                  {isLoading ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="send-button-loading">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity="0.75" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </main>
  );

  // Artifacts panel component (Requirement 15.1, 15.7)
  const artifactsPanelComponent = artifact ? (
    <ArtifactsPanel
      artifact={artifact}
      onClose={closeArtifactsPanel}
      onUserModification={onArtifactModification}
    />
  ) : null;

  return (
    <MainLayout
      sidebar={sidebarComponent}
      chatPanel={chatPanelComponent}
      artifactsPanel={artifactsPanelComponent}
      isArtifactsPanelOpen={isArtifactsPanelOpen}
    />
  );
}

export default CopilotChatUI;
