// AI Elements MessageInput component with file upload support
// Validates: Requirements 3.1, 3.2, 3.5, 3.8, 11.2

'use client';

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react';
import { FileAttachment } from '@/types';
import { ErrorMessage } from '@/components/ErrorMessage';

interface MessageInputAIProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (message: string, attachments: FileAttachment[]) => void;
  disabled?: boolean;
  placeholder?: string;
  selectedModel: string;
  availableModels: Array<{ id: string; name: string; description: string }>;
  onModelChange: (modelId: string) => void;
}

export function MessageInputAI({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = 'How can I help you today?',
  selectedModel,
  availableModels,
  onModelChange,
}: MessageInputAIProps) {
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file upload with progress tracking - Task 9.5
  const uploadFile = useCallback(async (file: File): Promise<FileAttachment | null> => {
    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Create XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress(Math.round(percentComplete));
        }
      });

      // Wrap XMLHttpRequest in a Promise
      const uploadPromise = new Promise<FileAttachment>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const fileMetadata = JSON.parse(xhr.responseText);
              resolve(fileMetadata);
            } catch (error) {
              reject(new Error('Failed to parse response'));
            }
          } else {
            try {
              const error = JSON.parse(xhr.responseText);
              reject(new Error(error.message || 'Upload failed'));
            } catch {
              reject(new Error('Upload failed'));
            }
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload cancelled'));
        });

        xhr.open('POST', '/api/upload');
        xhr.send(formData);
      });

      const fileMetadata = await uploadPromise;
      setUploadProgress(100);
      return fileMetadata;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload file';
      setUploadError(errorMessage);
      console.error('File upload error:', error);
      return null;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, []);

  // Handle file selection from input
  const handleFileSelect = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const uploaded = await uploadFile(file);
    
    if (uploaded) {
      setAttachments(prev => [...prev, uploaded]);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [uploadFile]);

  // Handle drag and drop (Requirement 3.2)
  const handleDragEnter = useCallback((e: DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    const uploaded = await uploadFile(file);
    
    if (uploaded) {
      setAttachments(prev => [...prev, uploaded]);
    }
  }, [uploadFile]);

  // Remove attachment
  const removeAttachment = useCallback((attachmentId: string) => {
    setAttachments(prev => prev.filter(a => a.id !== attachmentId));
  }, []);

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (!value.trim() && attachments.length === 0) return;
    if (disabled || isUploading) return;

    onSubmit(value, attachments);
    setAttachments([]);
    setUploadError(null);
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, attachments, disabled, isUploading, onSubmit]);

  // Handle textarea change
  const handleTextareaChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
  }, [onChange]);

  // Handle key down
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  // Check if file is an image
  const isImage = (type: string) => type.startsWith('image/');

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto', width: '100%' }}>
      <form 
        onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} 
        className="chat-input-card"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag and drop overlay (Requirement 3.2) */}
        {isDragging && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--bg-hover)',
            border: '2px dashed var(--border-focus)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            pointerEvents: 'none',
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              color: 'var(--text-primary)',
            }}>
              <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span style={{ fontSize: '14px', fontWeight: 500 }}>Drop file to upload</span>
            </div>
          </div>
        )}

        {/* File attachments preview (Requirement 3.5, 3.8) */}
        {attachments.length > 0 && (
          <div style={{
            padding: '12px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
          }}>
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {/* Image thumbnail (Requirement 3.8) */}
                {isImage(attachment.type) ? (
                  <img
                    src={attachment.url}
                    alt={attachment.name}
                    style={{
                      width: '32px',
                      height: '32px',
                      objectFit: 'cover',
                      borderRadius: '4px',
                    }}
                  />
                ) : (
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
                
                {/* File info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {attachment.name}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                  }}>
                    {formatFileSize(attachment.size)}
                  </div>
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => removeAttachment(attachment.id)}
                  style={{
                    padding: '4px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  aria-label="Remove attachment"
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upload error display - Validates: Requirement 11.2 */}
        {uploadError && (
          <div style={{ padding: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
            <ErrorMessage
              type="file_upload"
              message={uploadError}
              onRetry={() => {
                setUploadError(null);
                fileInputRef.current?.click();
              }}
              onDismiss={() => setUploadError(null)}
            />
          </div>
        )}

        {/* Upload progress indicator - Task 9.5 */}
        {isUploading && uploadProgress > 0 && (
          <div style={{
            padding: '12px',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '8px',
            }}>
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                className="send-button-loading"
                style={{ color: 'var(--accent)' }}
              >
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity="0.75" />
              </svg>
              <span style={{
                fontSize: '13px',
                color: 'var(--text-primary)',
                fontWeight: 500,
              }}>
                Uploading... {uploadProgress}%
              </span>
            </div>
            <div style={{
              width: '100%',
              height: '4px',
              background: 'var(--bg-secondary)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${uploadProgress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, var(--accent), var(--accent-hover))',
                transition: 'width 0.3s ease',
                borderRadius: '2px',
              }} />
            </div>
          </div>
        )}

        {/* Textarea */}
        <label htmlFor="message-input" className="sr-only">Type your message</label>
        <textarea
          id="message-input"
          ref={textareaRef}
          value={value}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isUploading}
          rows={1}
          tabIndex={0}
          className="chat-input-textarea"
        />

        {/* Bottom toolbar */}
        <div className="chat-input-toolbar">
          {/* Left: file upload button (Requirement 3.1) */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              accept="image/*,.pdf,.txt,.csv,.md,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading}
              className="chat-file-upload-btn"
              aria-label="Upload file"
              title="Upload file"
              style={{
                padding: '6px 8px',
                background: 'none',
                border: 'none',
                cursor: disabled || isUploading ? 'not-allowed' : 'pointer',
                color: 'var(--text-muted)',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '13px',
                opacity: disabled || isUploading ? 0.5 : 1,
              }}
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
          </div>

          {/* Right: model selector + send button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label htmlFor="model-selector" className="sr-only">Select AI model</label>
            <select
              id="model-selector"
              value={selectedModel}
              onChange={(e) => onModelChange(e.target.value)}
              className="chat-model-select"
              tabIndex={0}
              aria-label="Select AI model"
            >
              {availableModels.map((model) => (
                <option key={model.id} value={model.id}>{model.name}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={(!value.trim() && attachments.length === 0) || disabled || isUploading}
              className="chat-send-btn"
              aria-label="Send message"
            >
              {isUploading ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="send-button-loading">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity="0.75" />
                </svg>
              ) : (
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
