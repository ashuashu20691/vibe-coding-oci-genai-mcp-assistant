// File upload endpoint for chat attachments
// Validates: Requirements 3.3, 3.4, 12.1, 12.2, 12.4

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

// File upload configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // Documents
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
  // Office documents
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/msword', // .doc
  'application/vnd.ms-excel', // .xls
  'application/vnd.ms-powerpoint', // .ppt
];

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'temp');

// Ensure upload directory exists
async function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

// Generate unique file ID
function generateFileId(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Get file extension from filename
function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

export async function POST(request: NextRequest) {
  try {
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size (Requirement 3.4, 12.2)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { 
          error: 'File too large',
          message: `File size exceeds the maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`
        },
        { status: 400 }
      );
    }

    // Validate file type (Requirement 3.3, 12.1)
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { 
          error: 'Invalid file type',
          message: `File type "${file.type}" is not allowed. Supported types: images, PDFs, text files, and Office documents.`
        },
        { status: 400 }
      );
    }

    // Ensure upload directory exists (Requirement 12.4)
    await ensureUploadDir();

    // Generate unique file ID and construct file path
    const fileId = generateFileId();
    const extension = getFileExtension(file.name);
    const filename = extension ? `${fileId}.${extension}` : fileId;
    const filepath = path.join(UPLOAD_DIR, filename);

    // Convert file to buffer and write to disk (Requirement 12.4)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // Return file metadata (Requirement 3.6)
    const fileMetadata = {
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type,
      url: `/api/upload/${fileId}`,
      uploadedAt: new Date().toISOString(),
    };

    return NextResponse.json(fileMetadata, { status: 201 });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { 
        error: 'Upload failed',
        message: 'An error occurred while uploading the file'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve uploaded files
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('id');

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID required' },
        { status: 400 }
      );
    }

    // Find file with this ID (check all possible extensions)
    const files = await import('fs/promises').then(fs => fs.readdir(UPLOAD_DIR));
    const matchingFile = files.find(f => f.startsWith(fileId));

    if (!matchingFile) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    const filepath = path.join(UPLOAD_DIR, matchingFile);
    const fileBuffer = await import('fs/promises').then(fs => fs.readFile(filepath));

    // Determine content type from extension
    const ext = getFileExtension(matchingFile);
    const contentTypeMap: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'pdf': 'application/pdf',
      'txt': 'text/plain',
      'csv': 'text/csv',
      'md': 'text/markdown',
      'json': 'application/json',
    };

    const contentType = contentTypeMap[ext] || 'application/octet-stream';

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${matchingFile}"`,
      },
    });
  } catch (error) {
    console.error('File retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve file' },
      { status: 500 }
    );
  }
}
