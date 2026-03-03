'use client';

import { ToolExecutionDisplay } from '@/components/ToolExecutionDisplay';
import { ToolCall } from '@/types';

/**
 * Demo page to showcase the ToolExecutionDisplay component
 * Navigate to http://localhost:3000/tool-display-demo to see it
 */
export default function ToolDisplayDemoPage() {
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
        status: 'completed',
      },
      status: 'completed',
    },
    {
      toolCall: {
        id: 'tool-3',
        name: 'sqlcl_execute_query',
        arguments: {
          connection_name: 'BASE_DB_23AI',
          query: 'SELECT * FROM suppliers ORDER BY on_time_delivery_rate DESC',
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
      status: 'executing',
    },
  ];

  return (
    <div style={{ 
      padding: '40px', 
      maxWidth: '900px', 
      margin: '0 auto',
      backgroundColor: '#f5f5f5',
      minHeight: '100vh'
    }}>
      <div style={{ 
        backgroundColor: 'white', 
        padding: '32px', 
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ 
          fontSize: '28px', 
          fontWeight: 700, 
          marginBottom: '8px',
          color: '#1F2937'
        }}>
          Tool Execution Display Demo
        </h1>
        <p style={{ 
          color: '#6B7280', 
          marginBottom: '32px',
          fontSize: '15px'
        }}>
          This page demonstrates the Claude Desktop-style expandable tool execution displays.
          Click on any tool card to expand and see the parameters.
        </p>

        <div style={{ 
          backgroundColor: '#F9FAFB', 
          padding: '24px', 
          borderRadius: '8px',
          border: '1px solid #E5E7EB'
        }}>
          <h2 style={{ 
            fontSize: '16px', 
            fontWeight: 600, 
            marginBottom: '16px',
            color: '#374151'
          }}>
            Example Tool Executions:
          </h2>
          
          {exampleToolCalls.map(({ toolCall, status }) => (
            <ToolExecutionDisplay
              key={toolCall.id}
              toolCall={toolCall}
              status={status}
            />
          ))}
        </div>

        <div style={{ 
          marginTop: '32px', 
          padding: '20px', 
          backgroundColor: '#EFF6FF', 
          borderRadius: '8px',
          border: '1px solid #BFDBFE'
        }}>
          <h3 style={{ 
            fontSize: '14px', 
            fontWeight: 600, 
            marginBottom: '12px',
            color: '#1E40AF'
          }}>
            ℹ️ How to see this in the chat:
          </h3>
          <ol style={{ 
            paddingLeft: '24px', 
            color: '#1E40AF',
            fontSize: '14px',
            lineHeight: '1.8'
          }}>
            <li>Start a <strong>new conversation</strong> (click "New Chat")</li>
            <li>Ask a question that uses database tools, like:
              <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                <li>"List all database connections"</li>
                <li>"Show me the suppliers table"</li>
                <li>"Analyze supplier performance"</li>
              </ul>
            </li>
            <li>The tool execution displays will appear above the assistant's response</li>
          </ol>
        </div>

        <div style={{ 
          marginTop: '20px', 
          padding: '16px', 
          backgroundColor: '#FEF3C7', 
          borderRadius: '8px',
          border: '1px solid #FDE68A'
        }}>
          <p style={{ 
            fontSize: '13px', 
            color: '#92400E',
            margin: 0
          }}>
            <strong>Note:</strong> Existing conversations won't show tool displays because they were created before this feature was added. Only new messages will include the tool execution information.
          </p>
        </div>
      </div>
    </div>
  );
}
