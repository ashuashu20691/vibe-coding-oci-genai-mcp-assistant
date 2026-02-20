'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { MessageList } from './MessageList';
import { ModelSelector } from './ModelSelector';
import { ConversationSidebar, ConversationSidebarRef } from './ConversationSidebar';
import { SQLPlayground } from './SQLPlayground';
import { AgentThinking, ThinkingStep } from './AgentThinking';
import { SettingsModal, SettingsButton } from './SettingsModal';
import { RateLimitDisplay } from './RateLimitDisplay';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';
import { MobileSidebar, HamburgerButton } from './MobileSidebar';
import { useRateLimitHandler } from '@/hooks/useRateLimitHandler';
import { useKeyboardShortcuts, KeyboardShortcut } from '@/hooks/useKeyboardShortcuts';
import { useResponsive } from '@/hooks/useResponsive';
import { ErrorCode } from '@/lib/errors';
import { Message, Conversation, ToolCall, ToolError } from '@/types';


// Visualization data from the API
interface VisualizationData {
  type: string;
  html?: string;
  title?: string;
  data?: Record<string, unknown>[];
}

export interface ChatUIProps {
  defaultModel?: string;
  connectionName?: string;
  appTitle?: string;
}

type ViewMode = 'chat' | 'playground';

export function ChatUI({ defaultModel, connectionName, appTitle = 'OCI GenAI Chat' }: ChatUIProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const [selectedModel, setSelectedModel] = useState<string>(defaultModel || '');
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dbConnected, setDbConnected] = useState(!!connectionName);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  
  // Responsive state - Validates: Requirements 12.1, 12.2
  const { isMobile, isTablet, isDesktop } = useResponsive();
  
  const sidebarRef = useRef<ConversationSidebarRef>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Track pending message for rate limit retry
  const pendingRetryRef = useRef<{ content: string } | null>(null);
  
  // Rate limit handler with auto-retry
  const rateLimitHandler = useRateLimitHandler({
    defaultCooldownMs: 5000,
    minWaitMs: 2000,
    maxRetries: 3,
    onAutoRetry: useCallback(() => {
      if (pendingRetryRef.current) {
        const content = pendingRetryRef.current.content;
        pendingRetryRef.current = null;
        // Remove the failed assistant message before retrying
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg?.role === 'assistant' && lastMsg.content.includes('Rate limit')) {
            return prev.slice(0, -1);
          }
          return prev;
        });
        // Retry the message (will be called after state update)
        setTimeout(() => submitMessageInternal(content), 0);
      }
    }, []),
    onClear: useCallback(() => {
      pendingRetryRef.current = null;
    }, []),
  });

  // Cancel streaming function - Validates: Requirement 11.4
  const cancelStreaming = useCallback(() => {
    if (abortControllerRef.current && isLoading) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      // Update the last assistant message to indicate cancellation
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.role === 'assistant') {
          return prev.map((m, i) => 
            i === prev.length - 1 
              ? { ...m, content: m.content + '\n\n*[Response cancelled]*' }
              : m
          );
        }
        return prev;
      });
    }
  }, [isLoading]);

  // Keyboard shortcuts - Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5
  const shortcuts: KeyboardShortcut[] = useMemo(() => [
    {
      key: 'k',
      cmdOrCtrl: true,
      callback: () => {
        inputRef.current?.focus();
      },
      description: 'Focus message input',
    },
    {
      key: 'n',
      cmdOrCtrl: true,
      callback: () => {
        // Inline new conversation logic - Validates: Requirement 11.2
        setCurrentConversation(null);
        setMessages([]);
        setInput('');
        // Close mobile sidebar when starting new conversation
        if (isMobile || isTablet) {
          setMobileSidebarOpen(false);
        }
        inputRef.current?.focus();
      },
      description: 'New conversation',
    },
    {
      key: '/',
      cmdOrCtrl: true,
      callback: () => {
        // Toggle appropriate sidebar based on viewport - Validates: Requirement 12.2
        if (isMobile || isTablet) {
          setMobileSidebarOpen(prev => !prev);
        } else {
          setSidebarOpen(prev => !prev);
        }
      },
      description: 'Toggle sidebar',
    },
    {
      key: 'Escape',
      callback: () => {
        // Close mobile sidebar first if open, otherwise cancel streaming
        if (mobileSidebarOpen) {
          setMobileSidebarOpen(false);
        } else {
          cancelStreaming();
        }
      },
      description: 'Cancel streaming / Close sidebar',
      enabled: isLoading || mobileSidebarOpen,
    },
    {
      key: '?',
      cmdOrCtrl: true,
      shift: true, // ? requires shift on most keyboards
      callback: () => {
        setShortcutsHelpOpen(prev => !prev);
      },
      description: 'Show keyboard shortcuts',
    },
  ], [cancelStreaming, isLoading, isMobile, isTablet, mobileSidebarOpen]);

  useKeyboardShortcuts({ shortcuts });

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
  }, []);

  const addThinkingStep = useCallback((step: Omit<ThinkingStep, 'id' | 'timestamp'>) => {
    const newStep: ThinkingStep = {
      ...step,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    setThinkingSteps(prev => [...prev, newStep]);
    return newStep.id;
  }, []);

  const updateThinkingStep = useCallback((id: string, updates: Partial<ThinkingStep>) => {
    setThinkingSteps(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  const submitMessageInternal = useCallback(async (content: string) => {
    if (!content.trim() || isLoading || !selectedModel) return;
    
    setInput('');
    setThinkingSteps([]); // Clear previous thinking steps
    rateLimitHandler.clear(); // Clear any existing rate limit state
    if (inputRef.current) inputRef.current.style.height = 'auto';

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    let convId = currentConversation?.id;

    if (!convId && dbConnected) {
      try {
        const title = content.slice(0, 50) + (content.length > 50 ? '...' : '');
        const res = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title }),
        });
        if (res.ok) {
          const conv = await res.json();
          convId = conv.id;
          setCurrentConversation({ ...conv, createdAt: new Date(conv.createdAt), updatedAt: new Date(conv.updatedAt) });
          sidebarRef.current?.refresh();
        } else if (res.status === 503) setDbConnected(false);
      } catch { setDbConnected(false); }
    }

    if (convId && dbConnected) {
      try {
        await fetch(`/api/conversations/${convId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: userMessage.role, content: userMessage.content }),
        });
      } catch (e) { console.error('Failed to save:', e); }
    }

    const assistantMessage: Message = { id: crypto.randomUUID(), role: 'assistant', content: '', timestamp: new Date() };
    setMessages(prev => [...prev, assistantMessage]);

    // Create abort controller for cancellation - Validates: Requirement 11.4
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage], modelId: selectedModel, conversationId: convId }),
        signal: abortController.signal,
      });

      // Check for rate limit error (429 status)
      if (response.status === 429) {
        const errorData = await response.json().catch(() => ({}));
        const retryAfterMs = errorData.retryAfterMs || 5000;
        
        // Store the message for retry
        pendingRetryRef.current = { content: content.trim() };
        
        // Update assistant message to show rate limit error
        setMessages(prev => prev.map(m => m.id === assistantMessage.id ? { 
          ...m, 
          content: 'Rate limit exceeded. Waiting to retry...' 
        } : m));
        
        // Trigger rate limit handler
        rateLimitHandler.handleRateLimitError(
          { code: ErrorCode.RATE_LIMIT_ERROR, details: { retryAfterMs } },
          'Rate limit exceeded. Please wait before retrying.'
        );
        
        setIsLoading(false);
        return;
      }

      if (!response.ok) throw new Error(`Failed: ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      const toolCalls: ToolCall[] = [];
      const toolErrors: ToolError[] = []; // Track tool errors for inline display
      let currentToolStepId: string | null = null;
      let currentToolName: string | null = null; // Track current tool for error association

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            
            // Check for rate limit error in stream
            if (data.error && rateLimitHandler.isRateLimitError(data.error)) {
              pendingRetryRef.current = { content: content.trim() };
              rateLimitHandler.handleRateLimitError(
                { code: ErrorCode.RATE_LIMIT_ERROR, details: { retryAfterMs: 5000 } },
                data.error
              );
              setMessages(prev => prev.map(m => m.id === assistantMessage.id ? { 
                ...m, 
                content: 'Rate limit exceeded. Waiting to retry...' 
              } : m));
              setIsLoading(false);
              return;
            }
            
            // Handle thinking/progress messages
            if (data.thinking) {
              addThinkingStep({
                type: 'thinking',
                content: data.thinking,
                status: 'complete',
              });
            }
            
            if (data.progress) {
              addThinkingStep({
                type: 'progress',
                content: data.progress,
                status: 'complete',
              });
            }
            
            if (data.content) {
              assistantContent += data.content;
              setMessages(prev => prev.map(m => m.id === assistantMessage.id ? { ...m, content: assistantContent } : m));
            }
            
            if (data.toolCall) {
              toolCalls.push(data.toolCall);
              currentToolName = data.toolCall.name; // Track current tool name
              setMessages(prev => prev.map(m => m.id === assistantMessage.id ? { ...m, toolCalls: [...toolCalls] } : m));
              
              // Add thinking step for tool call
              currentToolStepId = addThinkingStep({
                type: 'tool_call',
                content: `Executing ${data.toolCall.name}`,
                toolName: data.toolCall.name,
                toolArgs: data.toolCall.arguments,
                status: 'running',
              });
            }
            
            if (data.toolResult) {
              // Update the tool call step to complete
              if (currentToolStepId) {
                updateThinkingStep(currentToolStepId, { status: 'complete' });
                currentToolStepId = null;
              }
              
              // Clear current tool name on successful completion
              currentToolName = null;
              
              // Add result step
              addThinkingStep({
                type: 'tool_result',
                content: 'Tool executed successfully',
                status: 'complete',
              });
              
              // Don't append raw JSON to content - let visualization/analysis handle display
            }
            
            // Handle visualization data
            if (data.visualization) {
              setMessages(prev => prev.map(m => m.id === assistantMessage.id ? { 
                ...m, 
                visualization: data.visualization 
              } : m));
            }
            
            // Handle analysis data
            if (data.analysis) {
              setMessages(prev => prev.map(m => m.id === assistantMessage.id ? { 
                ...m, 
                analysis: data.analysis 
              } : m));
            }
            
            // Handle tool errors inline - Validates: Requirement 10.3
            // Tool errors are displayed inline and don't block the conversation
            if (data.toolError) {
              const toolError: ToolError = {
                toolName: data.toolError.toolName || currentToolName || 'Unknown Tool',
                errorMessage: data.toolError.message || data.toolError.error || 'Tool execution failed',
                errorCode: data.toolError.code,
                timestamp: new Date(),
                isRetryable: data.toolError.isRetryable ?? true,
                details: data.toolError.details,
              };
              toolErrors.push(toolError);
              
              // Update thinking step to error status
              if (currentToolStepId) {
                updateThinkingStep(currentToolStepId, { 
                  status: 'error',
                  toolResult: { error: toolError.errorMessage },
                });
                currentToolStepId = null;
              }
              
              // Add error step to thinking panel
              addThinkingStep({
                type: 'tool_result',
                content: `Tool error: ${toolError.errorMessage}`,
                status: 'error',
              });
              
              // Update message with tool errors - conversation continues
              setMessages(prev => prev.map(m => m.id === assistantMessage.id ? { 
                ...m, 
                toolErrors: [...toolErrors] 
              } : m));
              
              currentToolName = null;
              // Don't return - allow conversation to continue
            }
            
            if (data.error) {
              // Check if this is a tool-related error
              const isToolError = currentToolName || 
                data.error.toLowerCase().includes('tool') ||
                data.error.toLowerCase().includes('execution');
              
              if (isToolError && currentToolName) {
                // Handle as inline tool error - Validates: Requirement 10.3
                const toolError: ToolError = {
                  toolName: currentToolName,
                  errorMessage: data.error,
                  timestamp: new Date(),
                  isRetryable: true,
                };
                toolErrors.push(toolError);
                
                if (currentToolStepId) {
                  updateThinkingStep(currentToolStepId, { status: 'error' });
                  currentToolStepId = null;
                }
                
                // Update message with tool errors
                setMessages(prev => prev.map(m => m.id === assistantMessage.id ? { 
                  ...m, 
                  toolErrors: [...toolErrors] 
                } : m));
                
                currentToolName = null;
                // Continue processing - don't block the conversation
              } else {
                // Non-tool error - append to content
                if (currentToolStepId) {
                  updateThinkingStep(currentToolStepId, { status: 'error' });
                }
                assistantContent += `\n\n**Error:** ${data.error}`;
                setMessages(prev => prev.map(m => m.id === assistantMessage.id ? { ...m, content: assistantContent } : m));
              }
            }
          } catch {}
        }
      }
      
      // Don't clear thinking steps - they should remain visible as part of the conversation
      // The steps show the agent's reasoning process
      
    } catch (error) {
      // Handle abort error (user cancelled streaming) - Validates: Requirement 11.4
      if (error instanceof Error && error.name === 'AbortError') {
        // Cancellation already handled in cancelStreaming callback
        return;
      }
      
      // Check if the error is a rate limit error
      if (rateLimitHandler.isRateLimitError(error)) {
        pendingRetryRef.current = { content: content.trim() };
        rateLimitHandler.handleRateLimitError(
          { code: ErrorCode.RATE_LIMIT_ERROR, details: { retryAfterMs: 5000 } },
          error instanceof Error ? error.message : 'Rate limit exceeded'
        );
        setMessages(prev => prev.map(m => m.id === assistantMessage.id ? { 
          ...m, 
          content: 'Rate limit exceeded. Waiting to retry...' 
        } : m));
      } else {
        setMessages(prev => prev.map(m => m.id === assistantMessage.id ? { ...m, content: `Error: ${error instanceof Error ? error.message : 'Failed'}` } : m));
      }
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [isLoading, selectedModel, currentConversation, messages, dbConnected, addThinkingStep, updateThinkingStep, rateLimitHandler]);

  const submitMessage = useCallback(async (content: string) => {
    await submitMessageInternal(content);
  }, [submitMessageInternal]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    submitMessage(input);
  }, [input, submitMessage]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    submitMessage(suggestion);
  }, [submitMessage]);

  const handleSelectConversation = useCallback(async (conv: Conversation) => {
    setCurrentConversation(conv);
    // Close mobile sidebar when conversation is selected - Validates: Requirement 12.2
    if (isMobile || isTablet) {
      setMobileSidebarOpen(false);
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/conversations/${conv.id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages((data.messages || []).map((msg: Message) => ({ ...msg, timestamp: new Date(msg.timestamp) })));
      } else if (res.status === 503) { setDbConnected(false); setMessages([]); }
    } catch { setMessages([]); }
    finally { setIsLoading(false); }
  }, [isMobile, isTablet]);

  const handleNewConversation = useCallback(() => {
    setCurrentConversation(null);
    setMessages([]);
    setInput('');
    // Close mobile sidebar when starting new conversation - Validates: Requirement 12.2
    if (isMobile || isTablet) {
      setMobileSidebarOpen(false);
    }
    inputRef.current?.focus();
  }, [isMobile, isTablet]);

  const handleDeleteConversation = useCallback((id: string) => {
    if (currentConversation?.id === id) { setCurrentConversation(null); setMessages([]); }
  }, [currentConversation]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
  }, [handleSubmit]);

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Desktop sidebar - visible on desktop (>1024px) when sidebarOpen is true */}
      {isDesktop && sidebarOpen && (
        <div className="w-[260px] flex-shrink-0" style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)' }}>
          <ConversationSidebar ref={sidebarRef} currentConversationId={currentConversation?.id} onSelectConversation={handleSelectConversation} onNewConversation={handleNewConversation} onDeleteConversation={handleDeleteConversation} dbConnected={dbConnected} />
        </div>
      )}

      {/* Mobile/Tablet sidebar - slide-out drawer - Validates: Requirement 12.2 */}
      {(isMobile || isTablet) && (
        <MobileSidebar
          isOpen={mobileSidebarOpen}
          onToggle={() => setMobileSidebarOpen(prev => !prev)}
          onClose={() => setMobileSidebarOpen(false)}
          title="Conversations"
        >
          <ConversationSidebar 
            ref={sidebarRef} 
            currentConversationId={currentConversation?.id} 
            onSelectConversation={handleSelectConversation} 
            onNewConversation={handleNewConversation} 
            onDeleteConversation={handleDeleteConversation} 
            dbConnected={dbConnected} 
          />
        </MobileSidebar>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between h-[52px] px-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <div className="flex items-center gap-3">
            {/* Desktop sidebar toggle button */}
            {isDesktop && (
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:opacity-70 transition-opacity">
                <svg className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
            {/* Mobile/Tablet hamburger menu button - Validates: Requirement 12.2 */}
            {(isMobile || isTablet) && (
              <HamburgerButton 
                onClick={() => setMobileSidebarOpen(prev => !prev)} 
                isOpen={mobileSidebarOpen}
              />
            )}
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{appTitle}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Hide view mode toggle on mobile for cleaner UI */}
            {!isMobile && (
              <div className="flex rounded-lg p-1" style={{ background: 'var(--bg-secondary)' }}>
                {['chat', 'playground'].map((mode) => (
                  <button key={mode} onClick={() => setViewMode(mode as ViewMode)}
                    className="px-3 py-1.5 text-sm font-medium rounded-md transition-all"
                    style={{ background: viewMode === mode ? 'var(--bg-primary)' : 'transparent', color: viewMode === mode ? 'var(--text-primary)' : 'var(--text-secondary)', boxShadow: viewMode === mode ? 'var(--shadow-sm)' : 'none' }}>
                    {mode === 'chat' ? 'Chat' : 'SQL Playground'}
                  </button>
                ))}
              </div>
            )}
            {viewMode === 'chat' && <ModelSelector value={selectedModel} onChange={setSelectedModel} defaultModel={defaultModel} />}
            <SettingsButton onClick={() => setSettingsOpen(true)} />
          </div>
        </header>

        {viewMode === 'chat' ? (
          <div className="flex-1 flex flex-col min-h-0">
            <MessageList 
              messages={messages} 
              isLoading={isLoading}
              isStreaming={isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant'}
              onSuggestionClick={handleSuggestionClick}
              thinkingSteps={thinkingSteps}
            />

            <div className="p-4" style={{ borderTop: '1px solid var(--border-color)' }}>
              {/* Rate Limit Display */}
              {rateLimitHandler.state.isRateLimited && (
                <div className="max-w-3xl mx-auto mb-4">
                  <RateLimitDisplay
                    state={rateLimitHandler.state}
                    onRetryNow={rateLimitHandler.retryNow}
                    onDismiss={rateLimitHandler.clear}
                    variant="inline"
                  />
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="max-w-3xl mx-auto relative">
                <textarea 
                  ref={inputRef} 
                  value={input} 
                  onChange={handleInputChange} 
                  onKeyDown={handleKeyDown} 
                  placeholder="Ask about your data, run queries, or analyze results..." 
                  rows={1} 
                  disabled={isLoading}
                  className="w-full px-4 py-3 pr-12 rounded-2xl resize-none outline-none text-[15px] transition-all duration-200 ease-in-out focus:ring-2 focus:ring-offset-1"
                  style={{ 
                    background: 'var(--bg-secondary)', 
                    border: '1px solid var(--border-color)', 
                    color: 'var(--text-primary)',
                    boxShadow: 'var(--shadow-sm)',
                    // @ts-expect-error CSS custom properties for focus ring
                    '--tw-ring-color': 'var(--accent)',
                    '--tw-ring-offset-color': 'var(--bg-primary)',
                  }} 
                />
                <button type="submit" disabled={isLoading || !input.trim() || !selectedModel}
                  className="absolute right-2 bottom-2 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ease-in-out disabled:opacity-40 hover:scale-105 active:scale-95"
                  style={{ background: input.trim() ? 'var(--accent)' : 'var(--bg-tertiary)', color: input.trim() ? 'white' : 'var(--text-muted)' }}>
                  {isLoading ? <LoadingSpinner /> : <SendIcon />}
                </button>
              </form>
              <div className="max-w-3xl mx-auto mt-2 text-xs flex justify-between" style={{ color: 'var(--text-muted)' }}>
                <span>{!selectedModel && 'Select a model to start'}</span>
                <span>{selectedModel?.split('.').pop()}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0"><SQLPlayground connectionName={connectionName} /></div>
        )}
      </div>

      {/* Settings Modal */}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Keyboard Shortcuts Help Panel - Validates: Requirement 11.5 */}
      <KeyboardShortcutsHelp 
        isOpen={shortcutsHelpOpen} 
        onClose={() => setShortcutsHelpOpen(false)} 
        shortcuts={shortcuts}
      />
    </div>
  );
}

const LoadingSpinner = () => (
  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const SendIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);
