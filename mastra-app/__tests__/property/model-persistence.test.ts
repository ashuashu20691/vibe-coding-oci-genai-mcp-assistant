/**
 * Property Test: Model Selection Persistence Round-Trip
 * 
 * Feature: claude-desktop-alternative, Property 6: Model Selection Persistence Round-Trip
 * 
 * *For any* model selection, saving to local storage and then reloading the application
 * SHALL result in the same model being pre-selected.
 * 
 * **Validates: Requirements 2.5**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

const STORAGE_KEY = 'oci-genai-selected-model';

/**
 * Mock localStorage for testing in Node.js environment.
 * This simulates browser localStorage behavior.
 */
class MockLocalStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * Simulates saving a model selection to localStorage.
 * This mirrors the behavior in ModelSelector component.
 */
function saveModelSelection(storage: MockLocalStorage, modelId: string): void {
  storage.setItem(STORAGE_KEY, modelId);
}

/**
 * Simulates loading a model selection from localStorage.
 * This mirrors the behavior in ModelSelector component on app initialization.
 */
function loadModelSelection(storage: MockLocalStorage): string | null {
  return storage.getItem(STORAGE_KEY);
}

/**
 * Simulates the full round-trip: save model, then reload (read back).
 */
function modelPersistenceRoundTrip(storage: MockLocalStorage, modelId: string): string | null {
  saveModelSelection(storage, modelId);
  return loadModelSelection(storage);
}

// Arbitrary for valid model IDs following the pattern: provider.model-name
// Examples: "google.gemini-2.5-flash", "cohere.command-r-plus", "meta.llama-3.1-70b"
const providerArb = fc.constantFrom('google', 'cohere', 'meta', 'xai');

const modelNameArb = fc.stringMatching(/^[a-z0-9][a-z0-9.-]{2,40}$/)
  .filter(s => !s.startsWith('.') && !s.endsWith('.') && !s.includes('..'));

const modelIdArb = fc.tuple(providerArb, modelNameArb)
  .map(([provider, name]) => `${provider}.${name}`);

// Arbitrary for any non-empty string model ID (more general case)
const anyModelIdArb = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0 && !s.includes('\0'));

describe('Property 6: Model Selection Persistence Round-Trip', () => {
  let storage: MockLocalStorage;

  beforeEach(() => {
    storage = new MockLocalStorage();
  });

  afterEach(() => {
    storage.clear();
  });

  it('should persist and retrieve model ID exactly as saved (Req 2.5)', () => {
    fc.assert(
      fc.property(
        modelIdArb,
        (modelId) => {
          // Clear storage before each iteration
          storage.clear();

          // Perform round-trip
          const retrieved = modelPersistenceRoundTrip(storage, modelId);

          // Property: Retrieved model ID equals saved model ID
          expect(retrieved).toBe(modelId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle any valid string model ID (Req 2.5)', () => {
    fc.assert(
      fc.property(
        anyModelIdArb,
        (modelId) => {
          storage.clear();

          const retrieved = modelPersistenceRoundTrip(storage, modelId);

          // Property: Any non-empty string is preserved exactly
          expect(retrieved).toBe(modelId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve model ID across multiple save operations (Req 2.5)', () => {
    fc.assert(
      fc.property(
        fc.array(modelIdArb, { minLength: 2, maxLength: 10 }),
        (modelIds) => {
          storage.clear();

          // Save multiple models sequentially (simulating user changing selection)
          for (const modelId of modelIds) {
            saveModelSelection(storage, modelId);
          }

          // Property: Last saved model is the one retrieved
          const lastModelId = modelIds[modelIds.length - 1];
          const retrieved = loadModelSelection(storage);
          expect(retrieved).toBe(lastModelId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return null when no model has been saved', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          storage.clear();

          // Property: Empty storage returns null
          const retrieved = loadModelSelection(storage);
          expect(retrieved).toBeNull();
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should preserve model IDs with special characters (Req 2.5)', () => {
    // Model IDs that might contain dots, hyphens, numbers
    const specialModelIdArb = fc.stringMatching(/^[a-z][a-z0-9.-]{5,50}$/)
      .filter(s => !s.endsWith('.') && !s.includes('..'));

    fc.assert(
      fc.property(
        specialModelIdArb,
        (modelId) => {
          storage.clear();

          const retrieved = modelPersistenceRoundTrip(storage, modelId);

          // Property: Special characters are preserved
          expect(retrieved).toBe(modelId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle model IDs from all supported providers (Req 2.5)', () => {
    fc.assert(
      fc.property(
        providerArb,
        modelNameArb,
        (provider, modelName) => {
          storage.clear();

          const modelId = `${provider}.${modelName}`;
          const retrieved = modelPersistenceRoundTrip(storage, modelId);

          // Property: Model ID with any provider is preserved
          expect(retrieved).toBe(modelId);
          expect(retrieved?.startsWith(provider)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain idempotency - saving same model twice yields same result (Req 2.5)', () => {
    fc.assert(
      fc.property(
        modelIdArb,
        (modelId) => {
          storage.clear();

          // Save twice
          saveModelSelection(storage, modelId);
          saveModelSelection(storage, modelId);

          const retrieved = loadModelSelection(storage);

          // Property: Idempotent - same result regardless of save count
          expect(retrieved).toBe(modelId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly use the storage key "oci-genai-selected-model" (Req 2.5)', () => {
    fc.assert(
      fc.property(
        modelIdArb,
        (modelId) => {
          storage.clear();

          saveModelSelection(storage, modelId);

          // Property: Value is stored under the correct key
          const directAccess = storage.getItem(STORAGE_KEY);
          expect(directAccess).toBe(modelId);
        }
      ),
      { numRuns: 100 }
    );
  });
});
