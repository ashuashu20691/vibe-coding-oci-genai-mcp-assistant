// app/api/databases/connect/route.ts
/**
 * API endpoint for connecting to a database via SQLcl MCP Server.
 * Validates: Requirements 4.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMCPClient } from '@/mastra/agents/database-agent';

interface ConnectRequestBody {
  connectionName: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ConnectRequestBody = await request.json();
    const { connectionName } = body;

    console.log(`[databases/connect/POST] Connecting to database: ${connectionName}`);

    // Validation
    if (!connectionName || typeof connectionName !== 'string') {
      console.log('[databases/connect/POST] Validation failed: connectionName required');
      return NextResponse.json(
        { error: 'Connection name is required', connected: false },
        { status: 400 }
      );
    }

    // Get MCP client
    const mcpClient = await getMCPClient();
    if (!mcpClient) {
      console.log('[databases/connect/POST] MCP client not configured');
      return NextResponse.json(
        { error: 'MCP client not configured', connected: false },
        { status: 503 }
      );
    }

    // Call SQLcl MCP connect tool
    try {
      const toolsets = await mcpClient.listToolsets();
      const sqlclTools = toolsets['sqlcl'] as Record<string, unknown> | undefined;
      
      if (!sqlclTools) {
        console.log('[databases/connect/POST] SQLcl tools not available');
        return NextResponse.json(
          { error: 'SQLcl tools not available', connected: false, connectionName },
          { status: 503 }
        );
      }

      // Find the connect tool (try multiple naming conventions)
      const toolNames = ['connect', 'sqlcl_connect', 'sqlcl-connect'];
      let connectTool: { execute?: (args: unknown) => Promise<unknown> } | null = null;
      
      for (const name of toolNames) {
        if (sqlclTools[name]) {
          connectTool = sqlclTools[name] as { execute?: (args: unknown) => Promise<unknown> };
          break;
        }
      }

      if (!connectTool?.execute) {
        console.log('[databases/connect/POST] connect tool not found. Available tools:', Object.keys(sqlclTools));
        return NextResponse.json(
          { error: 'connect tool not available', connected: false, connectionName },
          { status: 503 }
        );
      }

      const result = await connectTool.execute({
        connection_name: connectionName,
      });
      console.log('[databases/connect/POST] MCP connect result:', result);

      // Check if connection was successful
      // The result format from SQLcl MCP typically indicates success in the text content
      let connected = false;
      let message = '';
      
      const resultObj = result as { content?: Array<{ type?: string; text?: string }> };
      if (resultObj?.content && Array.isArray(resultObj.content)) {
        const textContent = resultObj.content.find((c: any) => c.type === 'text')?.text || '';
        message = textContent;
        
        // Check for success indicators in the response
        // Common success patterns: "Connected", "Connection successful", etc.
        connected = textContent.toLowerCase().includes('connect') && 
                   !textContent.toLowerCase().includes('error') &&
                   !textContent.toLowerCase().includes('fail');
        
        console.log(`[databases/connect/POST] Connection ${connected ? 'successful' : 'failed'}: ${textContent}`);
      }

      return NextResponse.json({ 
        connected,
        connectionName,
        message,
      });
    } catch (mcpError) {
      console.error('[databases/connect/POST] MCP call error:', mcpError);
      return NextResponse.json(
        { 
          error: mcpError instanceof Error ? mcpError.message : 'Connection failed',
          connected: false,
          connectionName,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[databases/connect/POST] Unexpected error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        connected: false,
      },
      { status: 500 }
    );
  }
}
