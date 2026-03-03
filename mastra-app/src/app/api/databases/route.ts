// app/api/databases/route.ts
/**
 * API endpoint for listing available database connections from SQLcl MCP Server.
 * Validates: Requirements 4.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMCPClient } from '@/mastra/agents/database-agent';

export async function GET(request: NextRequest) {
  try {
    console.log('[databases/GET] Fetching available database connections');

    // Get MCP client
    const mcpClient = await getMCPClient();
    if (!mcpClient) {
      console.log('[databases/GET] MCP client not configured');
      return NextResponse.json(
        { error: 'MCP client not configured', connections: [] },
        { status: 503 }
      );
    }

    // Call SQLcl MCP list-connections tool
    try {
      const toolsets = await mcpClient.listToolsets();
      const sqlclTools = toolsets['sqlcl'] as Record<string, unknown> | undefined;
      
      if (!sqlclTools) {
        console.log('[databases/GET] SQLcl tools not available');
        return NextResponse.json(
          { error: 'SQLcl tools not available', connections: [] },
          { status: 503 }
        );
      }

      // Find the list-connections tool (try multiple naming conventions)
      const toolNames = ['list-connections', 'list_connections', 'sqlcl_list_connections', 'sqlcl_list-connections'];
      let listConnectionsTool: { execute?: (args: unknown) => Promise<unknown> } | null = null;
      
      for (const name of toolNames) {
        if (sqlclTools[name]) {
          listConnectionsTool = sqlclTools[name] as { execute?: (args: unknown) => Promise<unknown> };
          break;
        }
      }

      if (!listConnectionsTool?.execute) {
        console.log('[databases/GET] list-connections tool not found. Available tools:', Object.keys(sqlclTools));
        return NextResponse.json(
          { error: 'list-connections tool not available', connections: [] },
          { status: 503 }
        );
      }

      const result = await listConnectionsTool.execute({});
      console.log('[databases/GET] MCP list-connections result:', result);

      // Parse the result to extract connection names
      // The result format from SQLcl MCP can be:
      // { content: [{ type: 'text', text: 'connection1,connection2,...' }] } (comma-separated)
      // OR { content: [{ type: 'text', text: 'connection1\nconnection2\n...' }] } (newline-separated)
      let connections: Array<{ name: string }> = [];
      
      const resultObj = result as { content?: Array<{ type?: string; text?: string }> };
      if (resultObj?.content && Array.isArray(resultObj.content)) {
        const textContent = resultObj.content.find((c: any) => c.type === 'text')?.text || '';
        console.log('[databases/GET] Raw text content:', textContent);
        
        // Try comma-separated first, then newline-separated
        let connectionNames: string[] = [];
        if (textContent.includes(',')) {
          // Comma-separated format
          connectionNames = textContent
            .split(',')
            .map((name: string) => name.trim())
            .filter((name: string) => name.length > 0);
        } else {
          // Newline-separated format
          connectionNames = textContent
            .split('\n')
            .map((line: string) => line.trim())
            .filter((line: string) => line.length > 0);
        }
        
        connections = connectionNames.map((name: string) => ({ name }));
        console.log(`[databases/GET] Found ${connections.length} connections:`, connectionNames);
      }

      return NextResponse.json({ connections });
    } catch (mcpError) {
      console.error('[databases/GET] MCP call error:', mcpError);
      return NextResponse.json(
        { 
          error: mcpError instanceof Error ? mcpError.message : 'Failed to list connections',
          connections: [] 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[databases/GET] Unexpected error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        connections: [] 
      },
      { status: 500 }
    );
  }
}
