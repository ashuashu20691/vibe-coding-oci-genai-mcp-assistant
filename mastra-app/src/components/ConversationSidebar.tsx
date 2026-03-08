'use client';

import { useState, useEffect, useCallback, useImperativeHandle, forwardRef, useRef } from 'react';
import { Conversation } from '@/types';

export interface ConversationSidebarRef { refresh: () => void; }

interface Props {
  currentConversationId?: string;
  onSelectConversation: (conversation: Conversation) => void;
  onNewConversation: () => void;
  onDeleteConversation?: (id: string) => void;
  dbConnected?: boolean;
}

export const ConversationSidebar = forwardRef<ConversationSidebarRef, Props>(
  function ConversationSidebar({ currentConversationId, onSelectConversation, onNewConversation, onDeleteConversation, dbConnected = true }, ref) {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const editInputRef = useRef<HTMLInputElement>(null);

    const fetchConversations = useCallback(async (query?: string) => {
      if (!dbConnected) { setIsLoading(false); return; }
      try {
        setIsLoading(true);
        const url = query ? `/api/conversations?q=${encodeURIComponent(query)}` : '/api/conversations';
        const response = await fetch(url);
        if (!response.ok) { if (response.status === 503) setError('Not configured'); return; }
        const data = await response.json();
        const convList = Array.isArray(data) ? data : (data.conversations || []);
        setConversations(convList.map((c: Conversation) => ({ ...c, createdAt: new Date(c.createdAt), updatedAt: new Date(c.updatedAt) })));
      } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); }
      finally { setIsLoading(false); }
    }, [dbConnected]);

    useImperativeHandle(ref, () => ({ refresh: () => fetchConversations(searchQuery || undefined) }), [fetchConversations, searchQuery]);
    useEffect(() => { fetchConversations(); }, [fetchConversations]);
    useEffect(() => { const t = setTimeout(() => fetchConversations(searchQuery || undefined), 300); return () => clearTimeout(t); }, [searchQuery, fetchConversations]);

    const handleDelete = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (!confirm('Delete this conversation?')) return;
      try {
        setDeletingId(id);
        await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
        setConversations(prev => prev.filter(c => c.id !== id));
        onDeleteConversation?.(id);
      } catch {} finally { setDeletingId(null); }
    };

    const handleStartRename = (e: React.MouseEvent, conversation: Conversation) => {
      e.stopPropagation();
      setEditingId(conversation.id);
      setEditingTitle(conversation.title || '');
      // Focus input after state update
      setTimeout(() => editInputRef.current?.focus(), 0);
    };

    const handleCancelRename = () => {
      setEditingId(null);
      setEditingTitle('');
    };

    const handleSaveRename = async (id: string) => {
      const trimmedTitle = editingTitle.trim();
      if (!trimmedTitle) {
        handleCancelRename();
        return;
      }

      try {
        setIsSaving(true);
        const response = await fetch(`/api/conversations/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: trimmedTitle }),
        });

        if (response.ok) {
          setConversations(prev =>
            prev.map(c =>
              c.id === id ? { ...c, title: trimmedTitle, updatedAt: new Date() } : c
            )
          );
        }
      } catch (err) {
        console.error('Failed to rename conversation:', err);
      } finally {
        setIsSaving(false);
        setEditingId(null);
        setEditingTitle('');
      }
    };

    const handleRenameKeyDown = (e: React.KeyboardEvent, id: string) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveRename(id);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancelRename();
      }
    };

    const getDateCategory = (date: Date): string => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const thisWeekStart = new Date(today);
      thisWeekStart.setDate(thisWeekStart.getDate() - today.getDay());
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

      if (dateOnly >= today) return 'Today';
      if (dateOnly >= yesterday) return 'Yesterday';
      if (dateOnly >= thisWeekStart) return 'This Week';
      if (dateOnly >= thisMonthStart) return 'This Month';
      return 'Older';
    };

    // Sort conversations by updatedAt descending (most recent first)
    const sortedConversations = [...conversations].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );

    // Group conversations by date category while preserving sort order
    const categoryOrder = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'];
    const grouped = sortedConversations.reduce((acc, c) => {
      const category = getDateCategory(c.updatedAt);
      if (!acc[category]) acc[category] = [];
      acc[category].push(c);
      return acc;
    }, {} as Record<string, Conversation[]>);

    // Get ordered groups (only include categories that have conversations)
    const orderedGroups = categoryOrder.filter(cat => grouped[cat]?.length > 0);

    return (
      <div className="flex flex-col h-full">
        <div style={{ padding: '12px' }}>
          <button onClick={onNewConversation} className="w-full flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors copilot-new-chat-btn"
            style={{ padding: '10px 16px', border: 'none', color: 'var(--text-primary)', background: 'var(--bg-primary)' }}>
            <svg style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New chat
          </button>
        </div>

        {dbConnected && conversations.length > 3 && (
          <div style={{ padding: '0 12px 8px 12px' }}>
            <div className="relative">
              <label htmlFor="conversation-search" className="sr-only">
                Search conversations
              </label>
              <input 
                id="conversation-search"
                type="text" 
                placeholder="Search..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg text-sm outline-none"
                style={{ padding: '8px 12px 8px 32px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: 'none' }} 
                aria-label="Search conversations"
              />
              <svg style={{ width: '16px', height: '16px', position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto copilot-conversations">
          {!dbConnected && (
            <div className="copilot-conv-empty">
              <p>Database not connected</p>
              <p style={{ fontSize: '12px', marginTop: '4px' }}>Conversations are session-only</p>
            </div>
          )}

          {isLoading && dbConnected && (
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[1, 2, 3].map((i) => <div key={i} style={{ height: '40px', borderRadius: '6px', background: 'var(--bg-tertiary)' }} className="animate-pulse" />)}
            </div>
          )}

          {!isLoading && dbConnected && conversations.length === 0 && (
            <div className="copilot-conv-empty">
              {searchQuery ? 'No results found' : 'No conversations yet'}
            </div>
          )}

          {!isLoading && orderedGroups.length > 0 && (
            <div>
              {orderedGroups.map((category) => (
                <div key={category} className="copilot-conv-group">
                  <div className="copilot-conv-date">{category}</div>
                  {grouped[category].map((c) => (
                    <div key={c.id}>
                      {editingId === c.id ? (
                        <div className="flex items-center" style={{ gap: '10px', padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-tertiary)' }}>
                          <svg style={{ width: '16px', height: '16px', flexShrink: 0, opacity: 0.5 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          <label htmlFor={`rename-input-${c.id}`} className="sr-only">
                            Rename conversation
                          </label>
                          <input
                            id={`rename-input-${c.id}`}
                            ref={editInputRef}
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => handleRenameKeyDown(e, c.id)}
                            onBlur={() => handleSaveRename(c.id)}
                            disabled={isSaving}
                            className="flex-1 bg-transparent outline-none"
                            aria-label="Rename conversation"
                            style={{ fontSize: '13px', color: 'var(--text-primary)' }}
                            placeholder="Enter title..."
                          />
                        </div>
                      ) : (
                        <button onClick={() => onSelectConversation(c)}
                          className={`copilot-conv-item ${currentConversationId === c.id ? 'active' : ''} group`}>
                          <svg className="copilot-conv-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          <span className="copilot-conv-title">{c.title || 'Untitled'}</span>
                          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ gap: '2px' }}>
                            <button onClick={(e) => handleStartRename(e, c)}
                              className="rounded transition-colors hover-action-btn"
                              style={{ padding: '4px', color: 'var(--text-muted)' }}
                              title="Rename conversation"
                              aria-label="Rename conversation">
                              <svg style={{ width: '14px', height: '14px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={(e) => handleDelete(e, c.id)} disabled={deletingId === c.id}
                              className="rounded transition-colors hover-action-btn"
                              style={{ padding: '4px', color: 'var(--text-muted)' }}
                              title="Delete conversation"
                              aria-label="Delete conversation">
                              <svg style={{ width: '14px', height: '14px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
);
