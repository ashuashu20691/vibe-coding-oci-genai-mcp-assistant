'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * MCP Server connection status
 */
export type MCPConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

/**
 * MCP Server information
 */
export interface MCPServerInfo {
  id: string;
  name: string;
  command: string;
  status: MCPConnectionStatus;
  lastConnected?: Date;
  errorMessage?: string;
}

/**
 * Tool execution status
 */
export type ToolExecutionStatus = 'idle' | 'running' | 'success' | 'error';

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  status: 'success' | 'error';
  data?: unknown;
  errorMessage?: string;
  duration?: number; // in milliseconds
}

/**
 * MCP Tool information
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  isExecuting?: boolean;
  lastResult?: unknown;
  // Execution status fields for Requirements 3.5, 3.6
  executionStatus?: ToolExecutionStatus;
  executionArgs?: Record<string, unknown>;
  executionResult?: ToolExecutionResult;
  executionStartTime?: number; // timestamp when execution started
}

/**
 * Server with tools information
 */
export interface MCPServerWithTools extends MCPServerInfo {
  tools: MCPTool[];
  toolsExpanded?: boolean;
}

/**
 * Props for MCPServerPanel component
 */
export interface MCPServerPanelProps {
  onToolExecuted?: (toolName: string, result: unknown) => void;
  onConnectionChange?: (serverId: string, status: MCPConnectionStatus) => void;
}

/**
 * Format error message for user-friendly display
 * Handles different error types: network errors, timeout, authentication, etc.
 * @validates Requirements 3.7 - Display error message with retry option
 */
export function formatErrorMessage(errorMessage: string): string {
  const lowerMessage = errorMessage.toLowerCase();
  
  // Network errors
  if (lowerMessage.includes('network') || lowerMessage.includes('fetch') || lowerMessage.includes('econnrefused')) {
    return 'Network error: Unable to reach the server. Please check your network connection and try again.';
  }
  
  // Timeout errors
  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out') || lowerMessage.includes('etimedout')) {
    return 'Connection timed out: The server took too long to respond. Please try again.';
  }
  
  // Authentication errors
  if (lowerMessage.includes('auth') || lowerMessage.includes('unauthorized') || lowerMessage.includes('401') || lowerMessage.includes('403')) {
    return 'Authentication failed: Please check your credentials and try again.';
  }
  
  // Server not found
  if (lowerMessage.includes('not found') || lowerMessage.includes('404') || lowerMessage.includes('enotfound')) {
    return 'Server not found: The MCP server could not be located. Please verify the server configuration.';
  }
  
  // Connection refused
  if (lowerMessage.includes('refused') || lowerMessage.includes('econnreset')) {
    return 'Connection refused: The server is not accepting connections. Please ensure the server is running.';
  }
  
  // Server errors
  if (lowerMessage.includes('500') || lowerMessage.includes('502') || lowerMessage.includes('503') || lowerMessage.includes('internal server')) {
    return 'Server error: The MCP server encountered an internal error. Please try again later.';
  }
  
  // Default: return original message if no specific pattern matched
  return errorMessage;
}

/**
 * Get status indicator color based on connection status
 */
function getStatusColor(status: MCPConnectionStatus): string {
  switch (status) {
    case 'connected':
      return '#22C55E'; // green
    case 'connecting':
      return '#F59E0B'; // amber
    case 'error':
      return '#EF4444'; // red
    case 'disconnected':
    default:
      return '#6B7280'; // gray
  }
}

/**
 * Get status label text
 */
function getStatusLabel(status: MCPConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting...';
    case 'error':
      return 'Error';
    case 'disconnected':
    default:
      return 'Disconnected';
  }
}

/**
 * MCPServerPanel component for managing MCP server connections.
 * Displays connection status for configured MCP servers with connect/disconnect buttons.
 * Lists available tools with names and descriptions when connected.
 * 
 * @validates Requirements 3.1 - Display connection status of configured MCP servers
 * @validates Requirements 3.2 - Display list of available tools with names and descriptions
 */
export function MCPServerPanel({ onToolExecuted, onConnectionChange }: MCPServerPanelProps) {
  const [servers, setServers] = useState<MCPServerWithTools[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  // Load configured MCP servers
  useEffect(() => {
    async function loadServers() {
      try {
        setIsLoading(true);
        // Try to fetch server configuration from API
        const response = await fetch('/api/mcp/servers');
        if (response.ok) {
          const data = await response.json();
          const serversWithTools = (data.servers || []).map((s: MCPServerInfo) => ({
            ...s,
            tools: [],
            toolsExpanded: false,
          }));
          setServers(serversWithTools);
        } else {
          // Default to SQLcl server if API not available
          setServers([
            {
              id: 'sqlcl',
              name: 'SQLcl MCP Server',
              command: 'npx @anthropic/sqlcl-mcp',
              status: 'disconnected',
              tools: [],
              toolsExpanded: false,
            },
          ]);
        }
      } catch {
        // Default configuration on error
        setServers([
          {
            id: 'sqlcl',
            name: 'SQLcl MCP Server',
            command: 'npx @anthropic/sqlcl-mcp',
            status: 'disconnected',
            tools: [],
            toolsExpanded: false,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    }
    loadServers();
  }, []);

  /**
   * Fetch tools for a connected server
   */
  const fetchTools = useCallback(async (serverId: string): Promise<MCPTool[]> => {
    try {
      const response = await fetch(`/api/mcp/servers/${serverId}/tools`);
      if (response.ok) {
        const data = await response.json();
        return data.tools || [];
      }
    } catch (err) {
      console.error(`[MCPServerPanel] Failed to fetch tools for ${serverId}:`, err);
    }
    return [];
  }, []);

  /**
   * Handle server connection
   */
  const handleConnect = useCallback(async (serverId: string) => {
    setServers(prev =>
      prev.map(s =>
        s.id === serverId ? { ...s, status: 'connecting' as MCPConnectionStatus, errorMessage: undefined, tools: [] } : s
      )
    );
    onConnectionChange?.(serverId, 'connecting');

    try {
      const response = await fetch(`/api/mcp/servers/${serverId}/connect`, {
        method: 'POST',
      });

      if (response.ok) {
        // Fetch tools after successful connection
        const tools = await fetchTools(serverId);
        
        setServers(prev =>
          prev.map(s =>
            s.id === serverId
              ? { 
                  ...s, 
                  status: 'connected' as MCPConnectionStatus, 
                  lastConnected: new Date(),
                  tools,
                  toolsExpanded: tools.length > 0, // Auto-expand if tools available
                }
              : s
          )
        );
        onConnectionChange?.(serverId, 'connected');
      } else {
        const error = await response.json().catch(() => ({ message: 'Connection failed' }));
        setServers(prev =>
          prev.map(s =>
            s.id === serverId
              ? { ...s, status: 'error' as MCPConnectionStatus, errorMessage: error.message, tools: [] }
              : s
          )
        );
        onConnectionChange?.(serverId, 'error');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Connection failed';
      setServers(prev =>
        prev.map(s =>
          s.id === serverId ? { ...s, status: 'error' as MCPConnectionStatus, errorMessage, tools: [] } : s
        )
      );
      onConnectionChange?.(serverId, 'error');
    }
  }, [onConnectionChange, fetchTools]);

  /**
   * Handle server disconnection
   */
  const handleDisconnect = useCallback(async (serverId: string) => {
    try {
      await fetch(`/api/mcp/servers/${serverId}/disconnect`, {
        method: 'POST',
      });
    } catch {
      // Ignore disconnect errors
    }

    setServers(prev =>
      prev.map(s =>
        s.id === serverId ? { ...s, status: 'disconnected' as MCPConnectionStatus, tools: [], toolsExpanded: false } : s
      )
    );
    onConnectionChange?.(serverId, 'disconnected');
  }, [onConnectionChange]);

  /**
   * Toggle tools section expansion for a server
   */
  const handleToggleTools = useCallback((serverId: string) => {
    setServers(prev =>
      prev.map(s =>
        s.id === serverId ? { ...s, toolsExpanded: !s.toolsExpanded } : s
      )
    );
  }, []);

  if (isLoading) {
    return (
      <div
        className="rounded-lg p-3"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full animate-pulse" style={{ background: 'var(--bg-tertiary)' }} />
          <div className="h-4 w-24 rounded animate-pulse" style={{ background: 'var(--bg-tertiary)' }} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors"
        style={{ color: 'var(--text-primary)' }}
      >
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4"
            style={{ color: 'var(--text-muted)' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
            />
          </svg>
          <span>MCP Servers</span>
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
          >
            {servers.length}
          </span>
        </div>
        <svg
          className="w-4 h-4 transition-transform"
          style={{
            color: 'var(--text-muted)',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Server List */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          {servers.length === 0 ? (
            <div
              className="text-sm text-center py-4"
              style={{ color: 'var(--text-muted)' }}
            >
              No MCP servers configured
            </div>
          ) : (
            servers.map(server => (
              <ServerItem
                key={server.id}
                server={server}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onToggleTools={handleToggleTools}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Individual server item component
 */
interface ServerItemProps {
  server: MCPServerWithTools;
  onConnect: (serverId: string) => void;
  onDisconnect: (serverId: string) => void;
  onToggleTools: (serverId: string) => void;
}

function ServerItem({ server, onConnect, onDisconnect, onToggleTools }: ServerItemProps) {
  const statusColor = getStatusColor(server.status);
  const statusLabel = getStatusLabel(server.status);
  const isConnecting = server.status === 'connecting';
  const isConnected = server.status === 'connected';
  const toolCount = server.tools?.length || 0;

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-3">
          {/* Server Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {/* Status Indicator */}
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: statusColor,
                  boxShadow: server.status === 'connected' ? `0 0 6px ${statusColor}` : 'none',
                }}
                title={statusLabel}
              />
              <span
                className="text-sm font-medium truncate"
                style={{ color: 'var(--text-primary)' }}
              >
                {server.name}
              </span>
              {/* Tool Count Badge - shown when connected */}
              {isConnected && toolCount > 0 && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                  style={{ 
                    background: 'var(--accent-color, #3B82F6)', 
                    color: 'white',
                  }}
                  title={`${toolCount} tool${toolCount !== 1 ? 's' : ''} available`}
                >
                  {toolCount}
                </span>
              )}
            </div>

            {/* Command */}
            <div
              className="text-xs mt-1 truncate font-mono"
              style={{ color: 'var(--text-muted)' }}
              title={server.command}
            >
              {server.command}
            </div>

            {/* Status / Error Message */}
            <div className="flex items-center gap-2 mt-1.5">
              <span
                className="text-xs"
                style={{ color: statusColor }}
              >
                {statusLabel}
              </span>
              {server.lastConnected && server.status === 'connected' && (
                <span
                  className="text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  • Connected {formatTimeAgo(server.lastConnected)}
                </span>
              )}
            </div>

            {/* Error Message with Retry Button */}
            {server.status === 'error' && server.errorMessage && (
              <div
                className="mt-2 p-2 rounded"
                style={{ background: 'rgba(239, 68, 68, 0.1)' }}
                data-testid="connection-error-container"
              >
                <div
                  className="text-xs mb-2"
                  style={{ color: '#EF4444' }}
                  data-testid="connection-error-message"
                >
                  {formatErrorMessage(server.errorMessage)}
                </div>
                <button
                  type="button"
                  onClick={() => onConnect(server.id)}
                  className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5"
                  style={{
                    background: '#EF4444',
                    color: 'white',
                    border: 'none',
                  }}
                  data-testid="retry-connection-button"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Retry Connection
                </button>
              </div>
            )}
          </div>

          {/* Connect/Disconnect Button */}
          <div className="flex-shrink-0">
            {isConnected ? (
              <button
                type="button"
                onClick={() => onDisconnect(server.id)}
                className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
                style={{
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-color)',
                }}
              >
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onConnect(server.id)}
                disabled={isConnecting}
                className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'var(--accent-color, #3B82F6)',
                  color: 'white',
                  border: 'none',
                }}
              >
                {isConnecting ? (
                  <span className="flex items-center gap-1.5">
                    <svg
                      className="w-3 h-3 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Connecting
                  </span>
                ) : (
                  'Connect'
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Collapsible Tools Section - shown when connected and has tools */}
      {isConnected && toolCount > 0 && (
        <div style={{ borderTop: '1px solid var(--border-color)' }}>
          {/* Tools Header - Clickable to expand/collapse */}
          <button
            type="button"
            onClick={() => onToggleTools(server.id)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors"
            style={{ 
              background: 'var(--bg-secondary)',
              color: 'var(--text-muted)',
            }}
          >
            <div className="flex items-center gap-1.5">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span>Available Tools ({toolCount})</span>
            </div>
            <svg
              className="w-3.5 h-3.5 transition-transform"
              style={{
                transform: server.toolsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Tools List */}
          {server.toolsExpanded && (
            <div className="px-3 py-2 space-y-1.5" style={{ background: 'var(--bg-secondary)' }}>
              {server.tools.map((tool) => (
                <ToolItem key={tool.name} tool={tool} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Format execution duration for display
 * @validates Requirements 3.6 - Display execution time on completion
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = (seconds % 60).toFixed(0);
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Format tool arguments for display
 * @validates Requirements 3.5 - Display tool arguments during execution
 */
export function formatToolArgs(args: Record<string, unknown> | undefined): string {
  if (!args || Object.keys(args).length === 0) return 'No arguments';
  try {
    return JSON.stringify(args, null, 2);
  } catch {
    return 'Unable to display arguments';
  }
}

/**
 * Get status indicator color for tool execution
 * @validates Requirements 3.5, 3.6 - Visual status indication
 */
export function getToolStatusColor(status: ToolExecutionStatus | undefined): string {
  switch (status) {
    case 'running':
      return '#F59E0B'; // amber
    case 'success':
      return '#22C55E'; // green
    case 'error':
      return '#EF4444'; // red
    case 'idle':
    default:
      return 'var(--text-muted)';
  }
}

/**
 * Individual tool item component
 * @validates Requirements 3.2 - Display tool names and descriptions
 * @validates Requirements 3.5 - Display tool name, arguments, and running indicator during execution
 * @validates Requirements 3.6 - Display result status and execution time on completion
 */
interface ToolItemProps {
  tool: MCPTool;
}

function ToolItem({ tool }: ToolItemProps) {
  const isRunning = tool.executionStatus === 'running' || tool.isExecuting;
  const hasResult = tool.executionStatus === 'success' || tool.executionStatus === 'error';
  const statusColor = getToolStatusColor(tool.executionStatus);

  return (
    <div
      className="rounded p-2"
      style={{ 
        background: 'var(--bg-primary)', 
        border: `1px solid ${isRunning ? '#F59E0B' : 'var(--border-color)'}`,
        transition: 'border-color 0.2s ease',
      }}
      data-testid="tool-item"
      data-tool-name={tool.name}
      data-execution-status={tool.executionStatus || 'idle'}
    >
      <div className="flex items-start gap-2">
        {/* Tool Icon / Status Indicator */}
        <div
          className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: isRunning ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-tertiary)' }}
        >
          {isRunning ? (
            /* Spinning indicator for running status */
            <svg
              className="w-3 h-3 animate-spin"
              style={{ color: '#F59E0B' }}
              fill="none"
              viewBox="0 0 24 24"
              data-testid="tool-running-indicator"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : hasResult ? (
            /* Status icon for completed execution */
            tool.executionStatus === 'success' ? (
              <svg
                className="w-3 h-3"
                style={{ color: '#22C55E' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                data-testid="tool-success-indicator"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                className="w-3 h-3"
                style={{ color: '#EF4444' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                data-testid="tool-error-indicator"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            )
          ) : (
            /* Default tool icon */
            <svg
              className="w-3 h-3"
              style={{ color: 'var(--text-muted)' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          )}
        </div>
        
        {/* Tool Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div
              className="text-xs font-medium font-mono truncate"
              style={{ color: 'var(--text-primary)' }}
              title={tool.name}
            >
              {tool.name}
            </div>
            {/* Execution status badge */}
            {isRunning && (
              <span
                className="text-xs px-1.5 py-0.5 rounded font-medium"
                style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' }}
                data-testid="tool-status-badge"
              >
                Running
              </span>
            )}
            {hasResult && (
              <span
                className="text-xs px-1.5 py-0.5 rounded font-medium"
                style={{ 
                  background: tool.executionStatus === 'success' 
                    ? 'rgba(34, 197, 94, 0.1)' 
                    : 'rgba(239, 68, 68, 0.1)',
                  color: statusColor,
                }}
                data-testid="tool-status-badge"
              >
                {tool.executionStatus === 'success' ? 'Success' : 'Error'}
              </span>
            )}
          </div>
          
          {tool.description && !isRunning && !hasResult && (
            <div
              className="text-xs mt-0.5 line-clamp-2"
              style={{ color: 'var(--text-muted)' }}
              title={tool.description}
            >
              {tool.description}
            </div>
          )}

          {/* Arguments display during execution */}
          {isRunning && tool.executionArgs && (
            <div className="mt-1.5" data-testid="tool-arguments">
              <div
                className="text-xs font-medium mb-0.5"
                style={{ color: 'var(--text-muted)' }}
              >
                Arguments:
              </div>
              <pre
                className="text-xs p-1.5 rounded overflow-x-auto max-h-20"
                style={{ 
                  background: 'var(--bg-tertiary)', 
                  color: 'var(--text-primary)',
                  fontSize: '10px',
                  lineHeight: '1.4',
                }}
              >
                {formatToolArgs(tool.executionArgs)}
              </pre>
            </div>
          )}

          {/* Result display after completion */}
          {hasResult && tool.executionResult && (
            <div className="mt-1.5" data-testid="tool-result">
              {/* Duration display */}
              {tool.executionResult.duration !== undefined && (
                <div
                  className="text-xs mb-1"
                  style={{ color: 'var(--text-muted)' }}
                  data-testid="tool-duration"
                >
                  Completed in {formatDuration(tool.executionResult.duration)}
                </div>
              )}
              
              {/* Error message for failed execution */}
              {tool.executionStatus === 'error' && tool.executionResult.errorMessage && (
                <div
                  className="text-xs p-1.5 rounded"
                  style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}
                  data-testid="tool-error-message"
                >
                  {tool.executionResult.errorMessage}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Format time ago string
 */
export function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return date.toLocaleDateString();
}
