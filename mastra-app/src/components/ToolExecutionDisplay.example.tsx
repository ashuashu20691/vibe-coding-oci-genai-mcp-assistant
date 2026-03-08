/**
 * Example usage of ToolExecutionDisplay component
 * 
 * This file demonstrates how to use the Claude Desktop-style
 * expandable tool execution display component.
 * 
 * The component can be integrated into various parts of the UI
 * where tool execution details need to be displayed.
 */

import { ToolExecutionDisplay } from './ToolExecutionDisplay';
import { ToolCall } from '@/types';

export function ToolExecutionDisplayExample() {
  // Example tool calls with different statuses
  const exampleToolCalls: Array<{ toolCall: ToolCall; status: 'pending' | 'executing' | 'completed' | 'failed' }> = [
    {
      toolCall: {
        id: 'tool-1',
        name: 'sqlcl_list_connections',
        arguments: {},
      },
      status: 'completed',
    },
    {
      toolCall: {
        id: 'tool-2',
        name: 'sqlcl_connect',
        arguments: {
          connection_name: 'BASE_DB_23AI',
        },
      },
      status: 'executing',
    },
    {
      toolCall: {
        id: 'tool-3',
        name: 'sqlcl_execute_query',
        arguments: {
          connection_name: 'BASE_DB_23AI',
          query: 'SELECT supplier_id, supplier_name, on_time_delivery_rate FROM suppliers ORDER BY on_time_delivery_rate DESC',
        },
      },
      status: 'completed',
    },
    {
      toolCall: {
        id: 'tool-4',
        name: 'sqlcl_describe_table',
        arguments: {
          table_name: 'SUPPLIERS',
        },
      },
      status: 'failed',
    },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '24px', fontSize: '24px', fontWeight: 600 }}>
        Tool Execution Display Examples
      </h1>
      
      <p style={{ marginBottom: '24px', color: '#6B7280' }}>
        This component provides a Claude Desktop-style expandable display for tool execution details.
        Click on any tool to expand and see the parameters.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {exampleToolCalls.map(({ toolCall, status }) => (
          <div key={toolCall.id}>
            <ToolExecutionDisplay toolCall={toolCall} status={status} />
          </div>
        ))}
      </div>

      <div style={{ marginTop: '32px', padding: '16px', backgroundColor: '#F3F4F6', borderRadius: '8px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
          Features:
        </h2>
        <ul style={{ listStyle: 'disc', paddingLeft: '24px', color: '#4B5563' }}>
          <li>Collapsible/expandable toggle with chevron icon</li>
          <li>Tool name displayed prominently in collapsed state</li>
          <li>Execution status with color coding (green=completed, amber=executing, red=failed)</li>
          <li>Formatted tool parameters and payload in expanded state</li>
          <li>JSON syntax highlighting for parameters</li>
          <li>Smooth expand/collapse animation</li>
          <li>Defensive null checking for all tool properties</li>
          <li>Accessible with proper ARIA attributes</li>
        </ul>
      </div>

      <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#EFF6FF', borderRadius: '8px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
          Integration Options:
        </h2>
        <p style={{ color: '#1E40AF', marginBottom: '8px' }}>
          This component can be integrated in several ways:
        </p>
        <ul style={{ listStyle: 'disc', paddingLeft: '24px', color: '#1E40AF' }}>
          <li>As part of a debugging/development panel</li>
          <li>In a separate "Tool Execution History" view</li>
          <li>Conditionally in messages based on a feature flag</li>
          <li>In a dedicated tools panel or sidebar</li>
          <li>As part of an admin or monitoring interface</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Example: Using ToolExecutionDisplay in a custom panel
 */
export function ToolExecutionPanel({ toolCalls }: { toolCalls: ToolCall[] }) {
  return (
    <div style={{
      padding: '16px',
      backgroundColor: '#FFFFFF',
      border: '1px solid #E5E7EB',
      borderRadius: '8px',
      maxHeight: '400px',
      overflowY: 'auto',
    }}>
      <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: '#374151' }}>
        Tool Execution History
      </h3>
      {toolCalls.length === 0 ? (
        <p style={{ color: '#9CA3AF', fontSize: '13px', fontStyle: 'italic' }}>
          No tool executions yet
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {toolCalls.map((toolCall) => (
            <ToolExecutionDisplay
              key={toolCall.id}
              toolCall={toolCall}
              status="completed"
            />
          ))}
        </div>
      )}
    </div>
  );
}
