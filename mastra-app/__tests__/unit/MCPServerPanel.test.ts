// __tests__/unit/MCPServerPanel.test.ts
/**
 * Unit tests for MCPServerPanel component logic.
 * Tests the helper functions and status handling.
 */

import { describe, it, expect } from 'vitest';

// Test the status color mapping logic
describe('MCPServerPanel Status Colors', () => {
  // Replicate the getStatusColor logic for testing
  function getStatusColor(status: 'connected' | 'disconnected' | 'connecting' | 'error'): string {
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

  it('should return green for connected status', () => {
    expect(getStatusColor('connected')).toBe('#22C55E');
  });

  it('should return amber for connecting status', () => {
    expect(getStatusColor('connecting')).toBe('#F59E0B');
  });

  it('should return red for error status', () => {
    expect(getStatusColor('error')).toBe('#EF4444');
  });

  it('should return gray for disconnected status', () => {
    expect(getStatusColor('disconnected')).toBe('#6B7280');
  });
});

// Test the status label mapping logic
describe('MCPServerPanel Status Labels', () => {
  function getStatusLabel(status: 'connected' | 'disconnected' | 'connecting' | 'error'): string {
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

  it('should return "Connected" for connected status', () => {
    expect(getStatusLabel('connected')).toBe('Connected');
  });

  it('should return "Connecting..." for connecting status', () => {
    expect(getStatusLabel('connecting')).toBe('Connecting...');
  });

  it('should return "Error" for error status', () => {
    expect(getStatusLabel('error')).toBe('Error');
  });

  it('should return "Disconnected" for disconnected status', () => {
    expect(getStatusLabel('disconnected')).toBe('Disconnected');
  });
});

// Test the time ago formatting logic
describe('MCPServerPanel Time Formatting', () => {
  function formatTimeAgo(date: Date): string {
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

  it('should return "just now" for times less than 60 seconds ago', () => {
    const date = new Date(Date.now() - 30 * 1000); // 30 seconds ago
    expect(formatTimeAgo(date)).toBe('just now');
  });

  it('should return minutes ago for times less than 60 minutes ago', () => {
    const date = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
    expect(formatTimeAgo(date)).toBe('5m ago');
  });

  it('should return hours ago for times less than 24 hours ago', () => {
    const date = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
    expect(formatTimeAgo(date)).toBe('3h ago');
  });

  it('should return formatted date for times more than 24 hours ago', () => {
    const date = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago
    const result = formatTimeAgo(date);
    // Should be a date string, not a relative time
    expect(result).not.toContain('ago');
    expect(result).not.toBe('just now');
  });
});

// Test MCPServerInfo interface structure
describe('MCPServerInfo Interface', () => {
  interface MCPServerInfo {
    id: string;
    name: string;
    command: string;
    status: 'connected' | 'disconnected' | 'connecting' | 'error';
    lastConnected?: Date;
    errorMessage?: string;
  }

  it('should accept valid server info with required fields', () => {
    const server: MCPServerInfo = {
      id: 'sqlcl',
      name: 'SQLcl MCP Server',
      command: 'npx @anthropic/sqlcl-mcp',
      status: 'disconnected',
    };

    expect(server.id).toBe('sqlcl');
    expect(server.name).toBe('SQLcl MCP Server');
    expect(server.command).toBe('npx @anthropic/sqlcl-mcp');
    expect(server.status).toBe('disconnected');
  });

  it('should accept server info with optional fields', () => {
    const server: MCPServerInfo = {
      id: 'sqlcl',
      name: 'SQLcl MCP Server',
      command: 'npx @anthropic/sqlcl-mcp',
      status: 'error',
      lastConnected: new Date(),
      errorMessage: 'Connection refused',
    };

    expect(server.lastConnected).toBeInstanceOf(Date);
    expect(server.errorMessage).toBe('Connection refused');
  });
});

// Test status transitions
describe('MCPServerPanel Status Transitions', () => {
  type MCPConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

  interface MCPServerInfo {
    id: string;
    name: string;
    command: string;
    status: MCPConnectionStatus;
    lastConnected?: Date;
    errorMessage?: string;
  }

  function updateServerStatus(
    servers: MCPServerInfo[],
    serverId: string,
    newStatus: MCPConnectionStatus,
    errorMessage?: string
  ): MCPServerInfo[] {
    return servers.map(s =>
      s.id === serverId
        ? { ...s, status: newStatus, errorMessage: newStatus === 'error' ? errorMessage : undefined }
        : s
    );
  }

  it('should transition from disconnected to connecting', () => {
    const servers: MCPServerInfo[] = [
      { id: 'sqlcl', name: 'SQLcl', command: 'npx sqlcl', status: 'disconnected' },
    ];

    const updated = updateServerStatus(servers, 'sqlcl', 'connecting');
    expect(updated[0].status).toBe('connecting');
  });

  it('should transition from connecting to connected', () => {
    const servers: MCPServerInfo[] = [
      { id: 'sqlcl', name: 'SQLcl', command: 'npx sqlcl', status: 'connecting' },
    ];

    const updated = updateServerStatus(servers, 'sqlcl', 'connected');
    expect(updated[0].status).toBe('connected');
  });

  it('should transition from connecting to error with message', () => {
    const servers: MCPServerInfo[] = [
      { id: 'sqlcl', name: 'SQLcl', command: 'npx sqlcl', status: 'connecting' },
    ];

    const updated = updateServerStatus(servers, 'sqlcl', 'error', 'Connection refused');
    expect(updated[0].status).toBe('error');
    expect(updated[0].errorMessage).toBe('Connection refused');
  });

  it('should transition from connected to disconnected', () => {
    const servers: MCPServerInfo[] = [
      { id: 'sqlcl', name: 'SQLcl', command: 'npx sqlcl', status: 'connected' },
    ];

    const updated = updateServerStatus(servers, 'sqlcl', 'disconnected');
    expect(updated[0].status).toBe('disconnected');
  });

  it('should only update the specified server', () => {
    const servers: MCPServerInfo[] = [
      { id: 'sqlcl', name: 'SQLcl', command: 'npx sqlcl', status: 'disconnected' },
      { id: 'other', name: 'Other', command: 'npx other', status: 'connected' },
    ];

    const updated = updateServerStatus(servers, 'sqlcl', 'connecting');
    expect(updated[0].status).toBe('connecting');
    expect(updated[1].status).toBe('connected'); // Unchanged
  });
});

// Test MCPTool interface structure
describe('MCPTool Interface', () => {
  interface MCPTool {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    isExecuting?: boolean;
    lastResult?: unknown;
    executionStatus?: 'idle' | 'running' | 'success' | 'error';
    executionArgs?: Record<string, unknown>;
    executionResult?: {
      status: 'success' | 'error';
      data?: unknown;
      errorMessage?: string;
      duration?: number;
    };
    executionStartTime?: number;
  }

  it('should accept valid tool with required fields', () => {
    const tool: MCPTool = {
      name: 'sqlcl_run_sql',
      description: 'Execute SQL queries',
      inputSchema: { type: 'object', properties: { sql: { type: 'string' } } },
    };

    expect(tool.name).toBe('sqlcl_run_sql');
    expect(tool.description).toBe('Execute SQL queries');
    expect(tool.inputSchema).toHaveProperty('type', 'object');
  });

  it('should accept tool with optional fields', () => {
    const tool: MCPTool = {
      name: 'sqlcl_run_sql',
      description: 'Execute SQL queries',
      inputSchema: {},
      isExecuting: true,
      lastResult: { rows: [] },
    };

    expect(tool.isExecuting).toBe(true);
    expect(tool.lastResult).toEqual({ rows: [] });
  });

  it('should accept tool with empty description', () => {
    const tool: MCPTool = {
      name: 'sqlcl_connect',
      description: '',
      inputSchema: {},
    };

    expect(tool.description).toBe('');
  });

  it('should accept tool with execution status fields', () => {
    const tool: MCPTool = {
      name: 'sqlcl_run_sql',
      description: 'Execute SQL queries',
      inputSchema: {},
      executionStatus: 'running',
      executionArgs: { sql: 'SELECT * FROM users' },
      executionStartTime: Date.now(),
    };

    expect(tool.executionStatus).toBe('running');
    expect(tool.executionArgs).toEqual({ sql: 'SELECT * FROM users' });
    expect(tool.executionStartTime).toBeDefined();
  });

  it('should accept tool with execution result on success', () => {
    const tool: MCPTool = {
      name: 'sqlcl_run_sql',
      description: 'Execute SQL queries',
      inputSchema: {},
      executionStatus: 'success',
      executionResult: {
        status: 'success',
        data: { rows: [{ id: 1 }] },
        duration: 1234,
      },
    };

    expect(tool.executionStatus).toBe('success');
    expect(tool.executionResult?.status).toBe('success');
    expect(tool.executionResult?.duration).toBe(1234);
  });

  it('should accept tool with execution result on error', () => {
    const tool: MCPTool = {
      name: 'sqlcl_run_sql',
      description: 'Execute SQL queries',
      inputSchema: {},
      executionStatus: 'error',
      executionResult: {
        status: 'error',
        errorMessage: 'Connection timeout',
        duration: 5000,
      },
    };

    expect(tool.executionStatus).toBe('error');
    expect(tool.executionResult?.status).toBe('error');
    expect(tool.executionResult?.errorMessage).toBe('Connection timeout');
  });
});

// Test MCPServerWithTools interface structure
describe('MCPServerWithTools Interface', () => {
  type MCPConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

  interface MCPTool {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    isExecuting?: boolean;
    lastResult?: unknown;
  }

  interface MCPServerWithTools {
    id: string;
    name: string;
    command: string;
    status: MCPConnectionStatus;
    lastConnected?: Date;
    errorMessage?: string;
    tools: MCPTool[];
    toolsExpanded?: boolean;
  }

  it('should accept server with empty tools array', () => {
    const server: MCPServerWithTools = {
      id: 'sqlcl',
      name: 'SQLcl MCP Server',
      command: 'npx @anthropic/sqlcl-mcp',
      status: 'disconnected',
      tools: [],
    };

    expect(server.tools).toHaveLength(0);
    expect(server.toolsExpanded).toBeUndefined();
  });

  it('should accept server with tools when connected', () => {
    const server: MCPServerWithTools = {
      id: 'sqlcl',
      name: 'SQLcl MCP Server',
      command: 'npx @anthropic/sqlcl-mcp',
      status: 'connected',
      lastConnected: new Date(),
      tools: [
        { name: 'sqlcl_run_sql', description: 'Execute SQL', inputSchema: {} },
        { name: 'sqlcl_connect', description: 'Connect to database', inputSchema: {} },
      ],
      toolsExpanded: true,
    };

    expect(server.tools).toHaveLength(2);
    expect(server.toolsExpanded).toBe(true);
  });

  it('should track tool count correctly', () => {
    const server: MCPServerWithTools = {
      id: 'sqlcl',
      name: 'SQLcl MCP Server',
      command: 'npx @anthropic/sqlcl-mcp',
      status: 'connected',
      tools: [
        { name: 'tool1', description: 'Tool 1', inputSchema: {} },
        { name: 'tool2', description: 'Tool 2', inputSchema: {} },
        { name: 'tool3', description: 'Tool 3', inputSchema: {} },
      ],
    };

    expect(server.tools.length).toBe(3);
  });
});

// Test tool list update logic
describe('MCPServerPanel Tool List Updates', () => {
  type MCPConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

  interface MCPTool {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }

  interface MCPServerWithTools {
    id: string;
    name: string;
    command: string;
    status: MCPConnectionStatus;
    tools: MCPTool[];
    toolsExpanded?: boolean;
  }

  function updateServerWithTools(
    servers: MCPServerWithTools[],
    serverId: string,
    tools: MCPTool[],
    expanded: boolean
  ): MCPServerWithTools[] {
    return servers.map(s =>
      s.id === serverId
        ? { ...s, tools, toolsExpanded: expanded }
        : s
    );
  }

  function clearServerTools(
    servers: MCPServerWithTools[],
    serverId: string
  ): MCPServerWithTools[] {
    return servers.map(s =>
      s.id === serverId
        ? { ...s, tools: [], toolsExpanded: false }
        : s
    );
  }

  it('should update server with tools on connection', () => {
    const servers: MCPServerWithTools[] = [
      { id: 'sqlcl', name: 'SQLcl', command: 'npx sqlcl', status: 'connected', tools: [] },
    ];

    const tools: MCPTool[] = [
      { name: 'sqlcl_run_sql', description: 'Execute SQL', inputSchema: {} },
    ];

    const updated = updateServerWithTools(servers, 'sqlcl', tools, true);
    expect(updated[0].tools).toHaveLength(1);
    expect(updated[0].tools[0].name).toBe('sqlcl_run_sql');
    expect(updated[0].toolsExpanded).toBe(true);
  });

  it('should clear tools on disconnection', () => {
    const servers: MCPServerWithTools[] = [
      {
        id: 'sqlcl',
        name: 'SQLcl',
        command: 'npx sqlcl',
        status: 'connected',
        tools: [{ name: 'sqlcl_run_sql', description: 'Execute SQL', inputSchema: {} }],
        toolsExpanded: true,
      },
    ];

    const updated = clearServerTools(servers, 'sqlcl');
    expect(updated[0].tools).toHaveLength(0);
    expect(updated[0].toolsExpanded).toBe(false);
  });

  it('should toggle tools expansion', () => {
    const servers: MCPServerWithTools[] = [
      {
        id: 'sqlcl',
        name: 'SQLcl',
        command: 'npx sqlcl',
        status: 'connected',
        tools: [{ name: 'tool1', description: 'Tool 1', inputSchema: {} }],
        toolsExpanded: false,
      },
    ];

    // Toggle to expanded
    const expanded = servers.map(s =>
      s.id === 'sqlcl' ? { ...s, toolsExpanded: !s.toolsExpanded } : s
    );
    expect(expanded[0].toolsExpanded).toBe(true);

    // Toggle back to collapsed
    const collapsed = expanded.map(s =>
      s.id === 'sqlcl' ? { ...s, toolsExpanded: !s.toolsExpanded } : s
    );
    expect(collapsed[0].toolsExpanded).toBe(false);
  });

  it('should only update tools for specified server', () => {
    const servers: MCPServerWithTools[] = [
      { id: 'sqlcl', name: 'SQLcl', command: 'npx sqlcl', status: 'connected', tools: [] },
      { id: 'other', name: 'Other', command: 'npx other', status: 'connected', tools: [{ name: 'existing', description: 'Existing', inputSchema: {} }] },
    ];

    const tools: MCPTool[] = [
      { name: 'new_tool', description: 'New Tool', inputSchema: {} },
    ];

    const updated = updateServerWithTools(servers, 'sqlcl', tools, true);
    expect(updated[0].tools).toHaveLength(1);
    expect(updated[0].tools[0].name).toBe('new_tool');
    expect(updated[1].tools).toHaveLength(1);
    expect(updated[1].tools[0].name).toBe('existing'); // Unchanged
  });
});


// Test formatDuration helper function
// @validates Requirements 3.6 - Display execution time on completion
describe('MCPServerPanel formatDuration', () => {
  // Replicate the formatDuration logic for testing
  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = (seconds % 60).toFixed(0);
    return `${minutes}m ${remainingSeconds}s`;
  }

  it('should format milliseconds for durations under 1 second', () => {
    expect(formatDuration(0)).toBe('0ms');
    expect(formatDuration(100)).toBe('100ms');
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(999)).toBe('999ms');
  });

  it('should format seconds for durations under 1 minute', () => {
    expect(formatDuration(1000)).toBe('1.0s');
    expect(formatDuration(1500)).toBe('1.5s');
    expect(formatDuration(30000)).toBe('30.0s');
    expect(formatDuration(59999)).toBe('60.0s');
  });

  it('should format minutes and seconds for durations over 1 minute', () => {
    expect(formatDuration(60000)).toBe('1m 0s');
    expect(formatDuration(90000)).toBe('1m 30s');
    expect(formatDuration(120000)).toBe('2m 0s');
    expect(formatDuration(185000)).toBe('3m 5s');
  });
});

// Test formatToolArgs helper function
// @validates Requirements 3.5 - Display tool arguments during execution
describe('MCPServerPanel formatToolArgs', () => {
  function formatToolArgs(args: Record<string, unknown> | undefined): string {
    if (!args || Object.keys(args).length === 0) return 'No arguments';
    try {
      return JSON.stringify(args, null, 2);
    } catch {
      return 'Unable to display arguments';
    }
  }

  it('should return "No arguments" for undefined args', () => {
    expect(formatToolArgs(undefined)).toBe('No arguments');
  });

  it('should return "No arguments" for empty object', () => {
    expect(formatToolArgs({})).toBe('No arguments');
  });

  it('should format simple arguments as JSON', () => {
    const args = { sql: 'SELECT * FROM users' };
    const result = formatToolArgs(args);
    expect(result).toContain('"sql"');
    expect(result).toContain('SELECT * FROM users');
  });

  it('should format complex arguments with proper indentation', () => {
    const args = {
      query: 'SELECT * FROM orders',
      params: { limit: 10, offset: 0 },
    };
    const result = formatToolArgs(args);
    expect(result).toContain('"query"');
    expect(result).toContain('"params"');
    expect(result).toContain('"limit"');
  });
});

// Test getToolStatusColor helper function
// @validates Requirements 3.5, 3.6 - Visual status indication
describe('MCPServerPanel getToolStatusColor', () => {
  type ToolExecutionStatus = 'idle' | 'running' | 'success' | 'error';

  function getToolStatusColor(status: ToolExecutionStatus | undefined): string {
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

  it('should return amber for running status', () => {
    expect(getToolStatusColor('running')).toBe('#F59E0B');
  });

  it('should return green for success status', () => {
    expect(getToolStatusColor('success')).toBe('#22C55E');
  });

  it('should return red for error status', () => {
    expect(getToolStatusColor('error')).toBe('#EF4444');
  });

  it('should return muted color for idle status', () => {
    expect(getToolStatusColor('idle')).toBe('var(--text-muted)');
  });

  it('should return muted color for undefined status', () => {
    expect(getToolStatusColor(undefined)).toBe('var(--text-muted)');
  });
});

// Test tool execution lifecycle state transitions
// @validates Requirements 3.5, 3.6 - Tool execution status display
describe('MCPServerPanel Tool Execution Lifecycle', () => {
  type ToolExecutionStatus = 'idle' | 'running' | 'success' | 'error';

  interface ToolExecutionResult {
    status: 'success' | 'error';
    data?: unknown;
    errorMessage?: string;
    duration?: number;
  }

  interface MCPTool {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    executionStatus?: ToolExecutionStatus;
    executionArgs?: Record<string, unknown>;
    executionResult?: ToolExecutionResult;
    executionStartTime?: number;
  }

  function startToolExecution(
    tool: MCPTool,
    args: Record<string, unknown>
  ): MCPTool {
    return {
      ...tool,
      executionStatus: 'running',
      executionArgs: args,
      executionStartTime: Date.now(),
      executionResult: undefined,
    };
  }

  function completeToolExecution(
    tool: MCPTool,
    result: ToolExecutionResult
  ): MCPTool {
    return {
      ...tool,
      executionStatus: result.status,
      executionResult: result,
    };
  }

  function resetToolExecution(tool: MCPTool): MCPTool {
    return {
      ...tool,
      executionStatus: 'idle',
      executionArgs: undefined,
      executionResult: undefined,
      executionStartTime: undefined,
    };
  }

  it('should transition from idle to running with args', () => {
    const tool: MCPTool = {
      name: 'sqlcl_run_sql',
      description: 'Execute SQL',
      inputSchema: {},
      executionStatus: 'idle',
    };

    const args = { sql: 'SELECT 1' };
    const running = startToolExecution(tool, args);

    expect(running.executionStatus).toBe('running');
    expect(running.executionArgs).toEqual(args);
    expect(running.executionStartTime).toBeDefined();
  });

  it('should transition from running to success with result', () => {
    const tool: MCPTool = {
      name: 'sqlcl_run_sql',
      description: 'Execute SQL',
      inputSchema: {},
      executionStatus: 'running',
      executionArgs: { sql: 'SELECT 1' },
      executionStartTime: Date.now() - 1000,
    };

    const result: ToolExecutionResult = {
      status: 'success',
      data: { rows: [{ result: 1 }] },
      duration: 1000,
    };
    const completed = completeToolExecution(tool, result);

    expect(completed.executionStatus).toBe('success');
    expect(completed.executionResult?.status).toBe('success');
    expect(completed.executionResult?.duration).toBe(1000);
  });

  it('should transition from running to error with message', () => {
    const tool: MCPTool = {
      name: 'sqlcl_run_sql',
      description: 'Execute SQL',
      inputSchema: {},
      executionStatus: 'running',
      executionArgs: { sql: 'INVALID SQL' },
      executionStartTime: Date.now() - 500,
    };

    const result: ToolExecutionResult = {
      status: 'error',
      errorMessage: 'Syntax error in SQL',
      duration: 500,
    };
    const completed = completeToolExecution(tool, result);

    expect(completed.executionStatus).toBe('error');
    expect(completed.executionResult?.status).toBe('error');
    expect(completed.executionResult?.errorMessage).toBe('Syntax error in SQL');
  });

  it('should reset tool execution state', () => {
    const tool: MCPTool = {
      name: 'sqlcl_run_sql',
      description: 'Execute SQL',
      inputSchema: {},
      executionStatus: 'success',
      executionArgs: { sql: 'SELECT 1' },
      executionResult: { status: 'success', duration: 1000 },
      executionStartTime: Date.now() - 1000,
    };

    const reset = resetToolExecution(tool);

    expect(reset.executionStatus).toBe('idle');
    expect(reset.executionArgs).toBeUndefined();
    expect(reset.executionResult).toBeUndefined();
    expect(reset.executionStartTime).toBeUndefined();
  });

  it('should preserve tool name and description during execution', () => {
    const tool: MCPTool = {
      name: 'sqlcl_run_sql',
      description: 'Execute SQL queries',
      inputSchema: { type: 'object' },
    };

    const running = startToolExecution(tool, { sql: 'SELECT 1' });
    const completed = completeToolExecution(running, { status: 'success', duration: 100 });
    const reset = resetToolExecution(completed);

    expect(reset.name).toBe('sqlcl_run_sql');
    expect(reset.description).toBe('Execute SQL queries');
    expect(reset.inputSchema).toEqual({ type: 'object' });
  });
});


// Test formatErrorMessage helper function
// @validates Requirements 3.7 - Display error message with retry option
describe('MCPServerPanel formatErrorMessage', () => {
  // Replicate the formatErrorMessage logic for testing
  function formatErrorMessage(errorMessage: string): string {
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

  it('should format network errors with user-friendly message', () => {
    expect(formatErrorMessage('Network error occurred')).toBe(
      'Network error: Unable to reach the server. Please check your network connection and try again.'
    );
    expect(formatErrorMessage('Failed to fetch')).toBe(
      'Network error: Unable to reach the server. Please check your network connection and try again.'
    );
    expect(formatErrorMessage('ECONNREFUSED')).toBe(
      'Network error: Unable to reach the server. Please check your network connection and try again.'
    );
  });

  it('should format timeout errors with user-friendly message', () => {
    expect(formatErrorMessage('Connection timeout')).toBe(
      'Connection timed out: The server took too long to respond. Please try again.'
    );
    expect(formatErrorMessage('Request timed out')).toBe(
      'Connection timed out: The server took too long to respond. Please try again.'
    );
    expect(formatErrorMessage('ETIMEDOUT')).toBe(
      'Connection timed out: The server took too long to respond. Please try again.'
    );
  });

  it('should format authentication errors with user-friendly message', () => {
    expect(formatErrorMessage('Authentication failed')).toBe(
      'Authentication failed: Please check your credentials and try again.'
    );
    expect(formatErrorMessage('Unauthorized access')).toBe(
      'Authentication failed: Please check your credentials and try again.'
    );
    expect(formatErrorMessage('Error 401')).toBe(
      'Authentication failed: Please check your credentials and try again.'
    );
    expect(formatErrorMessage('Error 403 Forbidden')).toBe(
      'Authentication failed: Please check your credentials and try again.'
    );
  });

  it('should format not found errors with user-friendly message', () => {
    expect(formatErrorMessage('Server not found')).toBe(
      'Server not found: The MCP server could not be located. Please verify the server configuration.'
    );
    expect(formatErrorMessage('Error 404')).toBe(
      'Server not found: The MCP server could not be located. Please verify the server configuration.'
    );
    expect(formatErrorMessage('ENOTFOUND')).toBe(
      'Server not found: The MCP server could not be located. Please verify the server configuration.'
    );
  });

  it('should format connection refused errors with user-friendly message', () => {
    expect(formatErrorMessage('Connection refused')).toBe(
      'Connection refused: The server is not accepting connections. Please ensure the server is running.'
    );
    expect(formatErrorMessage('ECONNRESET')).toBe(
      'Connection refused: The server is not accepting connections. Please ensure the server is running.'
    );
  });

  it('should format server errors with user-friendly message', () => {
    expect(formatErrorMessage('Error 500')).toBe(
      'Server error: The MCP server encountered an internal error. Please try again later.'
    );
    expect(formatErrorMessage('Error 502 Bad Gateway')).toBe(
      'Server error: The MCP server encountered an internal error. Please try again later.'
    );
    expect(formatErrorMessage('Error 503 Service Unavailable')).toBe(
      'Server error: The MCP server encountered an internal error. Please try again later.'
    );
    expect(formatErrorMessage('Internal server error')).toBe(
      'Server error: The MCP server encountered an internal error. Please try again later.'
    );
  });

  it('should return original message for unknown error types', () => {
    expect(formatErrorMessage('Unknown error')).toBe('Unknown error');
    expect(formatErrorMessage('Something went wrong')).toBe('Something went wrong');
    expect(formatErrorMessage('Custom error message')).toBe('Custom error message');
  });

  it('should handle case-insensitive matching', () => {
    expect(formatErrorMessage('NETWORK ERROR')).toBe(
      'Network error: Unable to reach the server. Please check your network connection and try again.'
    );
    expect(formatErrorMessage('TIMEOUT')).toBe(
      'Connection timed out: The server took too long to respond. Please try again.'
    );
    expect(formatErrorMessage('UNAUTHORIZED')).toBe(
      'Authentication failed: Please check your credentials and try again.'
    );
  });
});

// Test error state with retry functionality
// @validates Requirements 3.7 - Display error message with retry option
describe('MCPServerPanel Error State with Retry', () => {
  type MCPConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

  interface MCPServerInfo {
    id: string;
    name: string;
    command: string;
    status: MCPConnectionStatus;
    errorMessage?: string;
  }

  it('should have error status and error message when connection fails', () => {
    const server: MCPServerInfo = {
      id: 'sqlcl',
      name: 'SQLcl MCP Server',
      command: 'npx @anthropic/sqlcl-mcp',
      status: 'error',
      errorMessage: 'Connection refused',
    };

    expect(server.status).toBe('error');
    expect(server.errorMessage).toBeDefined();
    expect(server.errorMessage).toBe('Connection refused');
  });

  it('should clear error message when transitioning to connecting', () => {
    const server: MCPServerInfo = {
      id: 'sqlcl',
      name: 'SQLcl MCP Server',
      command: 'npx @anthropic/sqlcl-mcp',
      status: 'error',
      errorMessage: 'Connection refused',
    };

    // Simulate retry - transition to connecting
    const retrying: MCPServerInfo = {
      ...server,
      status: 'connecting',
      errorMessage: undefined,
    };

    expect(retrying.status).toBe('connecting');
    expect(retrying.errorMessage).toBeUndefined();
  });

  it('should allow retry after error by transitioning back to connecting', () => {
    // Initial state: error
    const errorState: MCPServerInfo = {
      id: 'sqlcl',
      name: 'SQLcl MCP Server',
      command: 'npx @anthropic/sqlcl-mcp',
      status: 'error',
      errorMessage: 'Network error',
    };

    // Retry: transition to connecting
    const connectingState: MCPServerInfo = {
      ...errorState,
      status: 'connecting',
      errorMessage: undefined,
    };

    // Success: transition to connected
    const connectedState: MCPServerInfo = {
      ...connectingState,
      status: 'connected',
    };

    expect(errorState.status).toBe('error');
    expect(connectingState.status).toBe('connecting');
    expect(connectedState.status).toBe('connected');
  });

  it('should preserve server info during retry cycle', () => {
    const server: MCPServerInfo = {
      id: 'sqlcl',
      name: 'SQLcl MCP Server',
      command: 'npx @anthropic/sqlcl-mcp',
      status: 'error',
      errorMessage: 'Timeout',
    };

    // Retry
    const retrying: MCPServerInfo = {
      ...server,
      status: 'connecting',
      errorMessage: undefined,
    };

    expect(retrying.id).toBe(server.id);
    expect(retrying.name).toBe(server.name);
    expect(retrying.command).toBe(server.command);
  });
});
