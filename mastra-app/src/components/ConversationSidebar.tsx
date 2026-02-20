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
        <div className="p-3">
          <button onClick={onNewConversation} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{ border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New chat
          </button>
        </div>

        {dbConnected && conversations.length > 3 && (
          <div className="px-3 pb-2">
            <div className="relative">
              <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 pl-8 rounded-lg text-sm outline-none"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: 'none' }} />
              <svg className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-2">
          {!dbConnected && (
            <div className="p-4 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              <p>Database not connected</p>
              <p className="text-xs mt-1">Conversations are session-only</p>
            </div>
          )}

          {isLoading && dbConnected && (
            <div className="p-3 space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: 'var(--bg-tertiary)' }} />)}
            </div>
          )}

          {!isLoading && dbConnected && conversations.length === 0 && (
            <div className="p-4 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              {searchQuery ? 'No results' : 'No conversations yet'}
            </div>
          )}

          {!isLoading && orderedGroups.length > 0 && (
            <div className="py-1">
              {orderedGroups.map((category) => (
                <div key={category}>
                  <div className="px-3 py-2 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{category}</div>
                  {grouped[category].map((c) => (
                    <div key={c.id} className="relative">
                      {editingId === c.id ? (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                          style={{ background: 'var(--bg-tertiary)' }}>
                          <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => handleRenameKeyDown(e, c.id)}
                            onBlur={() => handleSaveRename(c.id)}
                            disabled={isSaving}
                            className="flex-1 bg-transparent text-sm outline-none"
                            style={{ color: 'var(--text-primary)' }}
                            placeholder="Enter title..."
                          />
                        </div>
                      ) : (
                        <button onClick={() => onSelectConversation(c)}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors group"
                          style={{ background: currentConversationId === c.id ? 'var(--bg-tertiary)' : 'transparent', color: 'var(--text-primary)' }}>
                          <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          <span className="flex-1 truncate">{c.title || 'Untitled'}</span>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => handleStartRename(e, c)}
                              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                              style={{ color: 'var(--text-muted)' }}
                              title="Rename conversation">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={(e) => handleDelete(e, c.id)} disabled={deletingId === c.id}
                              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                              style={{ color: 'var(--text-muted)' }}
                              title="Delete conversation">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
