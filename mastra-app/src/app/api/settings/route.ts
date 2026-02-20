// app/api/settings/route.ts
/**
 * Settings API route.
 * Manages application settings like SQLcl path.
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const ENV_FILE_PATH = path.join(process.cwd(), '.env');

interface Settings {
  sqlclPath?: string;
}

/**
 * Parse .env file content into key-value pairs.
 */
function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Serialize key-value pairs back to .env format, preserving comments.
 */
function serializeEnvFile(original: string, updates: Record<string, string>): string {
  const lines = original.split('\n');
  const updatedKeys = new Set<string>();
  
  const result = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex).trim();
      if (key in updates) {
        updatedKeys.add(key);
        return `${key}=${updates[key]}`;
      }
    }
    return line;
  });
  
  // Add any new keys that weren't in the original file
  for (const [key, value] of Object.entries(updates)) {
    if (!updatedKeys.has(key)) {
      result.push(`${key}=${value}`);
    }
  }
  
  return result.join('\n');
}

/**
 * GET /api/settings - Get current settings.
 */
export async function GET() {
  try {
    const content = await fs.readFile(ENV_FILE_PATH, 'utf-8');
    const env = parseEnvFile(content);
    
    const settings: Settings = {
      sqlclPath: env.MCP_COMMAND || '',
    };
    
    return NextResponse.json(settings);
  } catch (error) {
    console.error('[settings/GET] Error reading settings:', error);
    return NextResponse.json({ sqlclPath: '' });
  }
}

/**
 * POST /api/settings - Update settings.
 */
export async function POST(request: NextRequest) {
  try {
    const body: Settings = await request.json();
    
    // Read current .env file
    let content = '';
    try {
      content = await fs.readFile(ENV_FILE_PATH, 'utf-8');
    } catch {
      // File doesn't exist, start fresh
      content = '';
    }
    
    // Prepare updates
    const updates: Record<string, string> = {};
    if (body.sqlclPath !== undefined) {
      updates.MCP_COMMAND = body.sqlclPath;
    }
    
    // Write updated .env file
    const newContent = serializeEnvFile(content, updates);
    await fs.writeFile(ENV_FILE_PATH, newContent, 'utf-8');
    
    console.log('[settings/POST] Settings saved successfully');
    
    return NextResponse.json({ success: true, message: 'Settings saved. Restart the server for changes to take effect.' });
  } catch (error) {
    console.error('[settings/POST] Error saving settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}
