// src/services/image-embedding-service.ts
/**
 * Image Embedding Service
 * Generates vector embeddings from images for similarity search
 * 
 * Requirements: 2.1
 */

import { VectorEmbedding } from './multi-modal-query-builder';

/**
 * Image data format for embedding generation
 */
export interface ImageData {
  data: string | Buffer | Uint8Array; // Base64 string, Buffer, or Uint8Array
  mimeType?: string;
  width?: number;
  height?: number;
}

/**
 * Image Embedding Service
 * Converts images to vector embeddings for similarity search
 */
export class ImageEmbeddingService {
  /**
   * Generate vector embedding from an image
   * Requirement 2.1: Convert image to vector embedding
   * 
   * @param image - Image data (file, URL, or base64)
   * @param streamCallback - Optional callback for streaming conversational updates
   * @returns Vector embedding
   */
  async generateEmbedding(
    image: ImageData | File | string,
    streamCallback?: (message: string) => void
  ): Promise<VectorEmbedding> {
    streamCallback?.("I'm generating the vector embedding for your image...");

    try {
      // Load image data
      const imageData = await this.loadImage(image);

      // Generate embedding
      // In production, this would call:
      // - OCI Vision API for embedding generation
      // - CLIP model via API
      // - ViT (Vision Transformer) model
      // - Custom embedding model
      //
      // For now, we'll generate a deterministic mock embedding based on image data
      const embedding = await this.generateMockEmbedding(imageData);

      streamCallback?.(`Generated ${embedding.dimensions}-dimensional embedding vector.`);

      return embedding;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      streamCallback?.(`Error generating embedding: ${errorMessage}`);
      throw new Error(`Failed to generate image embedding: ${errorMessage}`);
    }
  }

  /**
   * Load image from various formats
   * Requirement 2.1: Load image from file, URL, or base64
   * 
   * @param image - Image in various formats
   * @returns Normalized image data
   */
  private async loadImage(image: ImageData | File | string): Promise<ImageData> {
    // Handle File object
    if (image instanceof File) {
      return this.loadFromFile(image);
    }

    // Handle URL string
    if (typeof image === 'string') {
      if (image.startsWith('http://') || image.startsWith('https://')) {
        return this.loadFromURL(image);
      }
      // Assume base64 data URL
      return {
        data: image,
        mimeType: this.extractMimeType(image),
      };
    }

    // Handle ImageData object
    return image;
  }

  /**
   * Load image from File object
   */
  private async loadFromFile(file: File): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          resolve({
            data: result,
            mimeType: file.type,
          });
        } else if (result instanceof ArrayBuffer) {
          resolve({
            data: new Uint8Array(result),
            mimeType: file.type,
          });
        } else {
          reject(new Error('Unexpected FileReader result type'));
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      // Read as data URL for easier handling
      reader.readAsDataURL(file);
    });
  }

  /**
   * Load image from URL
   */
  private async loadFromURL(url: string): Promise<ImageData> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      return {
        data: new Uint8Array(arrayBuffer),
        mimeType: blob.type,
      };
    } catch (error) {
      throw new Error(`Failed to load image from URL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract MIME type from data URL
   */
  private extractMimeType(dataUrl: string): string {
    const match = dataUrl.match(/^data:([^;]+);/);
    return match ? match[1] : 'image/jpeg';
  }

  /**
   * Generate mock embedding for development/testing
   * In production, this would call an actual embedding model
   * 
   * @param imageData - Image data
   * @returns Mock vector embedding
   */
  private async generateMockEmbedding(imageData: ImageData): Promise<VectorEmbedding> {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 500));

    // Generate deterministic embedding based on image data
    // In production, this would be replaced with actual model inference
    const dimensions = 512; // Standard CLIP embedding size
    const values: number[] = [];

    // Create a simple hash from image data for deterministic results
    let hash = 0;
    const dataStr = typeof imageData.data === 'string' 
      ? imageData.data 
      : imageData.data.toString();
    
    for (let i = 0; i < dataStr.length; i++) {
      hash = ((hash << 5) - hash) + dataStr.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Generate pseudo-random but deterministic values
    for (let i = 0; i < dimensions; i++) {
      // Use hash and index to generate deterministic values
      const seed = hash + i;
      const x = Math.sin(seed) * 10000;
      values.push((x - Math.floor(x)) * 2 - 1); // Normalize to [-1, 1]
    }

    return {
      dimensions,
      values,
    };
  }

  /**
   * Resize image while maintaining aspect ratio
   * Requirement 2.1: Normalize image for embedding model
   * 
   * @param imageData - Original image data
   * @param maxWidth - Maximum width
   * @param maxHeight - Maximum height
   * @returns Resized image data
   */
  async resizeImage(
    imageData: ImageData,
    maxWidth: number = 224,
    maxHeight: number = 224
  ): Promise<ImageData> {
    // In production, this would use canvas or image processing library
    // For now, return original image data
    return imageData;
  }

  /**
   * Validate image format
   * 
   * @param mimeType - Image MIME type
   * @returns true if format is supported
   */
  isSupportedFormat(mimeType: string): boolean {
    const supportedFormats = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/bmp',
    ];

    return supportedFormats.includes(mimeType.toLowerCase());
  }
}

// Export singleton instance
export const imageEmbeddingService = new ImageEmbeddingService();
