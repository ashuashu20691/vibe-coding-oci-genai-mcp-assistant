# File Upload Feature

## Overview

The file upload feature allows users to attach files to their chat messages. This feature is part of Phase 4 of the Vercel UI adoption spec and includes:

- File upload via button click or drag-and-drop
- File type and size validation
- File preview with thumbnails for images
- Automatic file cleanup after 24 hours
- Secure file storage in isolated directory

## Components

### 1. Upload API Endpoint (`/api/upload`)

**Location**: `src/app/api/upload/route.ts`

**Features**:
- POST endpoint for file uploads
- File type validation (images, PDFs, text files, Office documents)
- File size validation (10MB limit)
- Secure storage in isolated temporary directory
- Returns file metadata (id, name, size, type, url)

**Usage**:
```typescript
const formData = new FormData();
formData.append('file', file);

const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData,
});

const fileMetadata = await response.json();
// { id, name, size, type, url, uploadedAt }
```

### 2. File Cleanup Service

**Location**: `src/services/file-cleanup-service.ts`

**Features**:
- Automatic deletion of files older than 24 hours
- Scheduled cleanup runs every hour
- Manual file deletion by ID

**Initialization**:
The cleanup service should be initialized when the server starts. Call the initialization endpoint:

```bash
curl -X POST http://localhost:3000/api/init
```

Or add this to your server startup script.

### 3. MessageInputAI Component

**Location**: `src/components/ai-elements/MessageInputAI.tsx`

**Features**:
- File upload button with icon
- Drag-and-drop zone with visual indicator
- File preview with name and size
- Image thumbnails for image files
- Upload progress indicator
- Error handling with user-friendly messages
- Remove attachment functionality

**Usage**:
```tsx
<MessageInputAI
  value={input}
  onChange={setInput}
  onSubmit={(message, attachments) => {
    // Handle message submission with attachments
  }}
  disabled={isLoading}
  selectedModel={selectedModel}
  availableModels={availableModels}
  onModelChange={handleModelChange}
/>
```

### 4. File Attachment Display

**Location**: `src/components/ai-elements/UserMessageAI.tsx`

**Features**:
- Display file icons and names for all file types
- Display image thumbnails for image files
- File download functionality
- File size display

## File Types Supported

### Images
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)
- SVG (.svg)

### Documents
- PDF (.pdf)
- Plain text (.txt)
- CSV (.csv)
- Markdown (.md)
- JSON (.json)

### Office Documents
- Word (.doc, .docx)
- Excel (.xls, .xlsx)
- PowerPoint (.ppt, .pptx)

## Configuration

### File Size Limit
Default: 10MB

To change the limit, update `MAX_FILE_SIZE` in `src/app/api/upload/route.ts`:

```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
```

### File Cleanup Age
Default: 24 hours

To change the cleanup age, update `MAX_FILE_AGE_MS` in `src/services/file-cleanup-service.ts`:

```typescript
const MAX_FILE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
```

### Upload Directory
Default: `uploads/temp/`

To change the upload directory, update `UPLOAD_DIR` in both:
- `src/app/api/upload/route.ts`
- `src/services/file-cleanup-service.ts`

## Feature Flag

The file upload feature is controlled by the `aiElementsInput` feature flag.

To enable:
```bash
export NEXT_PUBLIC_USE_AI_ELEMENTS=true
```

To disable (fallback to legacy input):
```bash
export NEXT_PUBLIC_USE_AI_ELEMENTS=false
```

## Security Considerations

1. **File Type Validation**: Only allowed file types can be uploaded (allowlist approach)
2. **File Size Validation**: Files exceeding 10MB are rejected
3. **Isolated Storage**: Files are stored in a dedicated temporary directory
4. **Automatic Cleanup**: Files are automatically deleted after 24 hours
5. **Unique File IDs**: Each file gets a unique cryptographic ID to prevent collisions

## Error Handling

The upload feature handles the following errors gracefully:

1. **File too large**: Displays error message with size limit
2. **Invalid file type**: Displays error message with supported types
3. **Upload failed**: Displays generic error message
4. **Network error**: Displays connection error message

All errors are displayed inline in the input component without blocking the UI.

## Testing

To test the file upload feature:

1. Enable the feature flag:
   ```bash
   export NEXT_PUBLIC_USE_AI_ELEMENTS=true
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Initialize the cleanup service:
   ```bash
   curl -X POST http://localhost:3000/api/init
   ```

4. Test file upload:
   - Click the file upload button
   - Or drag and drop a file onto the input area
   - Verify file preview appears
   - Send message with attachment
   - Verify attachment displays in the message

## Future Enhancements

Potential improvements for future versions:

1. **Multiple file uploads**: Allow uploading multiple files at once
2. **File encryption**: Encrypt files at rest
3. **Virus scanning**: Integrate malware scanning
4. **Cloud storage**: Store files in S3 or similar cloud storage
5. **File compression**: Compress large files before storage
6. **Progress tracking**: Show detailed upload progress for large files
7. **File preview**: Preview file contents before sending
8. **File editing**: Allow basic editing of text files before sending

## Troubleshooting

### Files not uploading
- Check that the `uploads/temp/` directory exists and is writable
- Verify the file size is under 10MB
- Verify the file type is in the allowed list
- Check browser console for errors

### Files not being cleaned up
- Verify the cleanup service is initialized (call `/api/init`)
- Check server logs for cleanup errors
- Verify the `uploads/temp/` directory is readable

### File download not working
- Verify the file still exists (not cleaned up)
- Check the file URL is correct
- Verify the file ID matches an existing file

## Requirements Validated

This implementation validates the following requirements from the spec:

- **Requirement 3.1**: File upload button with icon
- **Requirement 3.2**: Drag-and-drop zone with visual indicator
- **Requirement 3.3**: File type validation
- **Requirement 3.4**: File size validation (10MB limit)
- **Requirement 3.5**: File preview with name and size
- **Requirement 3.6**: Upload files before sending message
- **Requirement 3.7**: Display file icons and names in messages
- **Requirement 3.8**: Display image thumbnails
- **Requirement 11.2**: User-friendly error messages
- **Requirement 12.1**: File type validation against allowlist
- **Requirement 12.2**: File size validation
- **Requirement 12.4**: Store files in isolated directory
- **Requirement 12.5**: Delete temporary files after 24 hours
