'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import hljs from 'highlight.js/lib/core';
import sql from 'highlight.js/lib/languages/sql';
import { OutputRenderer } from './OutputRenderer';

// Register SQL language for highlighting
hljs.registerLanguage('sql', sql);

export interface SQLPlaygroundProps {
  connectionName?: string;
}

interface QueryHistoryItem {
  sql: string;
  timestamp: Date;
}

/**
 * SQLPlayground component provides an interactive SQL editor for direct Oracle database queries.
 * Features:
 * - SQL text editor with syntax highlighting
 * - Execute button and Ctrl+Enter keyboard shortcut
 * - Query results displayed using OutputRenderer
 * - Query history for quick re-execution
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7
 */
export function SQLPlayground({ connectionName }: SQLPlaygroundProps) {
  const [sql, setSQL] = useState('');
  const [highlightedSQL, setHighlightedSQL] = useState('');
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);

  // Sync scroll between textarea and highlighted code
  const syncScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  // Update syntax highlighting when SQL changes
  useEffect(() => {
    if (sql) {
      try {
        const highlighted = hljs.highlight(sql, { language: 'sql' }).value;
        setHighlightedSQL(highlighted);
      } catch {
        // Fallback to plain text if highlighting fails
        setHighlightedSQL(sql);
      }
    } else {
      setHighlightedSQL('');
    }
  }, [sql]);

  /**
   * Execute the current SQL query via the /api/sql endpoint.
   * Requirement 13.3: Execute queries via MCP run-sql tool
   */
  const executeSQL = useCallback(async () => {
    if (!sql.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql, connectionName }),
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.result);
        // Add to history (avoid duplicates at the top)
        setHistory(prev => {
          const filtered = prev.filter(item => item.sql !== sql);
          return [{ sql, timestamp: new Date() }, ...filtered.slice(0, 9)];
        });
      } else {
        setError(data.error || 'Query execution failed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }, [sql, connectionName]);

  /**
   * Handle keyboard shortcuts.
   * Requirement 13.7: Support Ctrl+Enter for query execution
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        executeSQL();
      }
      // Handle Tab key for indentation
      if (e.key === 'Tab') {
        e.preventDefault();
        const textarea = e.currentTarget;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newValue = sql.substring(0, start) + '  ' + sql.substring(end);
        setSQL(newValue);
        // Restore cursor position after state update
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }, 0);
      }
    },
    [executeSQL, sql]
  );

  /**
   * Load a query from history into the editor.
   * Requirement 13.6: Quick re-execution from history
   */
  const loadFromHistory = useCallback((historySql: string) => {
    setSQL(historySql);
    textareaRef.current?.focus();
  }, []);

  /**
   * Clear the current query and results.
   */
  const clearAll = useCallback(() => {
    setSQL('');
    setResult(null);
    setError(null);
    textareaRef.current?.focus();
  }, []);

  return (
    <div className="sql-playground flex flex-col h-full bg-white">
      {/* Toolbar */}
      <div className="toolbar p-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-gray-800">SQL Playground</span>
          {connectionName && (
            <span className="text-sm text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
              {connectionName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearAll}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
            title="Clear editor"
          >
            Clear
          </button>
          <button
            onClick={executeSQL}
            disabled={isLoading || !sql.trim()}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            title="Execute query (Ctrl+Enter)"
          >
            {isLoading ? (
              <>
                <span className="animate-spin">⟳</span>
                Running...
              </>
            ) : (
              <>
                <span>▶</span>
                Execute
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* SQL Editor Panel */}
        <div className="w-full lg:w-1/2 flex flex-col border-b lg:border-b-0 lg:border-r border-gray-200">
          <div className="flex-1 relative overflow-hidden">
            {/* Syntax highlighted background */}
            <pre
              ref={highlightRef}
              className="absolute inset-0 p-4 font-mono text-sm overflow-auto pointer-events-none whitespace-pre-wrap break-words m-0"
              style={{
                color: 'transparent',
                background: 'white',
              }}
              aria-hidden="true"
            >
              <code
                className="hljs language-sql"
                dangerouslySetInnerHTML={{ __html: highlightedSQL || '&nbsp;' }}
              />
            </pre>
            {/* Actual textarea for input */}
            <textarea
              ref={textareaRef}
              value={sql}
              onChange={e => setSQL(e.target.value)}
              onScroll={syncScroll}
              onKeyDown={handleKeyDown}
              placeholder="Enter SQL query...&#10;&#10;Example:&#10;SELECT * FROM employees&#10;WHERE department = 'Engineering'&#10;ORDER BY hire_date DESC"
              className="absolute inset-0 w-full h-full p-4 font-mono text-sm resize-none focus:outline-none bg-transparent text-gray-800 caret-gray-800"
              style={{
                caretColor: '#1f2937',
                WebkitTextFillColor: 'transparent',
              }}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
          </div>
          <div className="p-2 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
            <span>Ctrl+Enter to execute • Tab for indent</span>
            <span>{sql.length} characters</span>
          </div>
        </div>

        {/* Results Panel */}
        <div className="w-full lg:w-1/2 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin text-4xl mb-2">⟳</div>
                  <div className="text-gray-500">Executing query...</div>
                </div>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="text-red-500 text-xl">⚠</span>
                  <div>
                    <div className="font-semibold text-red-800 mb-1">Query Error</div>
                    <div className="text-red-700 text-sm whitespace-pre-wrap font-mono">
                      {error}
                    </div>
                  </div>
                </div>
              </div>
            ) : result !== null ? (
              <div className="h-full">
                <OutputRenderer data={result} />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <div className="text-4xl mb-2">📊</div>
                  <div>Execute a query to see results</div>
                </div>
              </div>
            )}
          </div>

          {/* Query History */}
          {history.length > 0 && (
            <div className="border-t border-gray-200 p-3 bg-gray-50">
              <div className="text-xs text-gray-500 mb-2 font-medium">Recent Queries</div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {history.map((item, index) => (
                  <button
                    key={`${item.timestamp.getTime()}-${index}`}
                    onClick={() => loadFromHistory(item.sql)}
                    className="text-xs px-2 py-1 bg-white border border-gray-200 rounded hover:bg-blue-50 hover:border-blue-300 truncate max-w-[200px] transition-colors"
                    title={item.sql}
                  >
                    {item.sql.slice(0, 40)}{item.sql.length > 40 ? '...' : ''}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

