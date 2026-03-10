// File cleanup service for temporary uploads
// Validates: Requirement 12.5

import { readdir, stat, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'temp');
const MAX_FILE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Delete files older than 24 hours from the temporary upload directory
 * Validates: Requirement 12.5
 */
export async function cleanupOldFiles(): Promise<{
  deletedCount: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let deletedCount = 0;

  try {
    // Check if upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
      return { deletedCount: 0, errors: [] };
    }

    // Read all files in the upload directory
    const files = await readdir(UPLOAD_DIR);
    const now = Date.now();

    // Process each file
    for (const file of files) {
      try {
        const filepath = path.join(UPLOAD_DIR, file);
        const fileStats = await stat(filepath);

        // Check if file is older than 24 hours
        const fileAge = now - fileStats.mtimeMs;
        if (fileAge > MAX_FILE_AGE_MS) {
          await unlink(filepath);
          deletedCount++;
          console.log(`[FileCleanup] Deleted old file: ${file} (age: ${Math.round(fileAge / 1000 / 60 / 60)}h)`);
        }
      } catch (error) {
        const errorMsg = `Failed to process file ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(`[FileCleanup] ${errorMsg}`);
      }
    }

    console.log(`[FileCleanup] Cleanup complete. Deleted ${deletedCount} files, ${errors.length} errors`);
    return { deletedCount, errors };
  } catch (error) {
    const errorMsg = `Failed to read upload directory: ${error instanceof Error ? error.message : 'Unknown error'}`;
    errors.push(errorMsg);
    console.error(`[FileCleanup] ${errorMsg}`);
    return { deletedCount, errors };
  }
}

/**
 * Delete a specific file by ID
 */
export async function deleteFile(fileId: string): Promise<boolean> {
  try {
    if (!existsSync(UPLOAD_DIR)) {
      return false;
    }

    // Find file with this ID (check all possible extensions)
    const files = await readdir(UPLOAD_DIR);
    const matchingFile = files.find(f => f.startsWith(fileId));

    if (!matchingFile) {
      return false;
    }

    const filepath = path.join(UPLOAD_DIR, matchingFile);
    await unlink(filepath);
    console.log(`[FileCleanup] Deleted file: ${matchingFile}`);
    return true;
  } catch (error) {
    console.error(`[FileCleanup] Failed to delete file ${fileId}:`, error);
    return false;
  }
}

/**
 * Schedule periodic cleanup (runs every hour)
 * Call this function once when the server starts
 */
export function scheduleCleanup(): NodeJS.Timeout {
  const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  console.log('[FileCleanup] Scheduling periodic cleanup (every 1 hour)');

  // Run cleanup immediately on startup
  cleanupOldFiles().catch(error => {
    console.error('[FileCleanup] Initial cleanup failed:', error);
  });

  // Schedule periodic cleanup
  return setInterval(() => {
    cleanupOldFiles().catch(error => {
      console.error('[FileCleanup] Scheduled cleanup failed:', error);
    });
  }, CLEANUP_INTERVAL_MS);
}
