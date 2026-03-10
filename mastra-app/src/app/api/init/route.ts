// Initialization endpoint for server startup tasks
// This endpoint should be called once when the server starts

import { NextResponse } from 'next/server';
import { scheduleCleanup } from '@/services/file-cleanup-service';

let cleanupScheduled = false;
let cleanupInterval: NodeJS.Timeout | null = null;

export async function POST() {
  if (!cleanupScheduled) {
    cleanupInterval = scheduleCleanup();
    cleanupScheduled = true;
    
    return NextResponse.json({ 
      message: 'File cleanup service initialized',
      status: 'success'
    });
  }
  
  return NextResponse.json({ 
    message: 'File cleanup service already running',
    status: 'already_running'
  });
}

export async function GET() {
  return NextResponse.json({ 
    cleanupScheduled,
    message: cleanupScheduled 
      ? 'File cleanup service is running' 
      : 'File cleanup service not initialized'
  });
}
