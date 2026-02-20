'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Conversation, Message } from '@/types';
import { MessageList } from './MessageList';
import { ThinkingStep } from './AgentThinking';

const DEFAULT_MODEL = 'google.gemini-2.5-flash';

interface UIMessage extends Message {
  progress?: { current: number; total: number };
  isProgressMessage?: boolean;
}

export function CopilotChatUI({ appTitle = 'OCI GenAI Chat' }: { appTitle?: string }) {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
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
  }, [conversationId]);

  const loadConversation = async (conv: Conversation) => {
    setConversationId(conv.id);
    if (conv.modelId) setSelectedModel(conv.modelId);
    
    const r = await fetch('/api/conversations/' + conv.id + '/messages');
    if (r.ok) {
      const data = await r.json();
      const arr = Array.isArray(data) ? data : [];
      setMessages(
        arr.map((m: {
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
        }): UIMessage => ({
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
        }))
      );
    }
  };

  const newChat = () => {
    setConversationId(null);
    setMessages([]);
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
    setMessages((p) => [...p, userMsg]);
    setInput('');
    setIsLoading(true);
    setThinkingSteps([]);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }

    if (conversationId) {
      try {
        await fetch(`/api/conversations/${conversationId}/messages`, {
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
        body: JSON.stringify({ messages: allMsgs, modelId: selectedModel, conversationId }),
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
                  u[u.length - 1] = { ...l, content: l.content + p.content };
                }
                return u;
              });
            } else if (p.tool_narrative) {
              setMessages((prev) => {
                const u = [...prev];
                const l = u[u.length - 1];
                if (l?.role === 'assistant') {
                  u[u.length - 1] = { ...l, content: l.content + p.tool_narrative };
                }
                return u;
              });
            } else if (p.adaptation) {
              setMessages((prev) => {
                const u = [...prev];
                const l = u[u.length - 1];
                if (l?.role === 'assistant') {
                  u[u.length - 1] = { ...l, content: l.content + p.adaptation };
                }
                return u;
              });
            } else if (p.progress) {
              setMessages((prev) => {
                const u = [...prev];
                const l = u[u.length - 1];
                if (l?.role === 'assistant') {
                  u[u.length - 1] = { 
                    ...l, 
                    content: l.content + p.progress,
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
                  u[u.length - 1] = { ...l, content: l.content + p.thinking };
                }
                return u;
              });
            } else if (p.visualization) {
              setMessages((prev) => {
                const u = [...prev];
                const l = u[u.length - 1];
                if (l?.role === 'assistant') u[u.length - 1] = { ...l, visualization: p.visualization };
                return u;
              });
            } else if (p.analysis) {
              setMessages((prev) => {
                const u = [...prev];
                const l = u[u.length - 1];
                if (l?.role === 'assistant') u[u.length - 1] = { ...l, analysis: p.analysis };
                return u;
              });
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
    }
  }, [input, isLoading, conversationId, messages, selectedModel]);

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

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh', 
      width: '100%',
      background: 'var(--bg-primary)',
      overflow: 'hidden'
    }}>
      {/* Sidebar */}
      <div style={{
        width: sidebarOpen ? '260px' : '0',
        height: '100vh',
        background: 'var(--bg-secondary)',
        borderRight: sidebarOpen ? '1px solid var(--border-color)' : 'none',
        transition: 'width 0.2s ease',
        overflow: 'hidden',
        flexShrink: 0
      }}>
        <div style={{ width: '260px', height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* New Chat Button */}
          <div style={{ padding: '12px' }}>
            <button 
              onClick={newChat}
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New chat
            </button>
          </div>

          {/* Conversations */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
            {Object.entries(grouped).map(([date, convs]) => (
              <div key={date} style={{ marginBottom: '16px' }}>
                <div style={{ 
                  padding: '8px 12px', 
                  fontSize: '11px', 
                  fontWeight: '600',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  {date}
                </div>
                {convs.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => loadConversation(c)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      marginBottom: '2px',
                      borderRadius: '6px',
                      border: 'none',
                      background: conversationId === c.id ? 'var(--bg-tertiary)' : 'transparent',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {c.title || 'Untitled'}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        minWidth: 0,
        height: '100vh'
      }}>
        {/* Header */}
        <div style={{
          height: '48px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          flexShrink: 0
        }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <select
            value={selectedModel}
            onChange={(e) => handleModelChange(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            <option value="google.gemini-2.5-flash">Gemini 2.5 Flash</option>
            <option value="cohere.command-r-plus">Command R+</option>
            <option value="meta.llama-3.1-70b">Llama 3.1 70B</option>
          </select>
        </div>

        {/* Messages */}
        <MessageList 
          messages={messages}
          isLoading={isLoading}
          isStreaming={isLastMessageStreaming}
          thinkingSteps={thinkingSteps}
          onSuggestionClick={setInput}
        />

        {/* Input */}
        <div style={{
          borderTop: '1px solid var(--border-color)',
          padding: '16px',
          flexShrink: 0
        }}>
          <div style={{ maxWidth: '700px', margin: '0 auto' }}>
            <form 
              onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
              style={{ position: 'relative' }}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="How can I help you today?"
                disabled={isLoading}
                rows={1}
                style={{
                  width: '100%',
                  padding: '12px 48px 12px 16px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  resize: 'none',
                  outline: 'none',
                  fontFamily: 'inherit'
                }}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                style={{
                  position: 'absolute',
                  right: '8px',
                  bottom: '8px',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: 'none',
                  background: input.trim() && !isLoading ? 'var(--accent)' : 'var(--bg-tertiary)',
                  color: input.trim() && !isLoading ? 'white' : 'var(--text-muted)',
                  cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {isLoading ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity="0.75" />
                  </svg>
                ) : (
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CopilotChatUI;
