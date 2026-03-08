/**
 * Integration test for model compatibility.
 * Validates that all available models can be selected and used.
 */

import { describe, it, expect } from 'vitest';

describe('Model Compatibility', () => {
  it('should list all available models from API', async () => {
    const response = await fetch('http://localhost:3000/api/models');
    expect(response.ok).toBe(true);
    
    const models = await response.json();
    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(3); // Should have more than 3 models
    
    // Verify model structure
    for (const model of models) {
      expect(model).toHaveProperty('id');
      expect(model).toHaveProperty('name');
      expect(model).toHaveProperty('description');
      expect(typeof model.id).toBe('string');
      expect(typeof model.name).toBe('string');
    }
  });

  it('should include Google Gemini models', async () => {
    const response = await fetch('http://localhost:3000/api/models');
    const models = await response.json();
    
    const geminiModels = models.filter((m: { id: string }) => m.id.startsWith('google.'));
    expect(geminiModels.length).toBeGreaterThan(0);
    
    // Check for specific Gemini models
    const geminiFlash = models.find((m: { id: string }) => m.id === 'google.gemini-2.5-flash');
    expect(geminiFlash).toBeDefined();
    expect(geminiFlash.name).toContain('Gemini');
  });

  it('should include Cohere models', async () => {
    const response = await fetch('http://localhost:3000/api/models');
    const models = await response.json();
    
    const cohereModels = models.filter((m: { id: string }) => m.id.startsWith('cohere.'));
    expect(cohereModels.length).toBeGreaterThan(0);
    
    // Check for specific Cohere models
    const commandRPlus = models.find((m: { id: string }) => m.id === 'cohere.command-r-plus');
    expect(commandRPlus).toBeDefined();
    expect(commandRPlus.name).toContain('Command');
  });

  it('should include Meta Llama models', async () => {
    const response = await fetch('http://localhost:3000/api/models');
    const models = await response.json();
    
    const metaModels = models.filter((m: { id: string }) => m.id.startsWith('meta.'));
    expect(metaModels.length).toBeGreaterThan(0);
    
    // Check for specific Meta models
    const llama70b = models.find((m: { id: string }) => m.id === 'meta.llama-3.1-70b-instruct');
    expect(llama70b).toBeDefined();
    expect(llama70b.name).toContain('Llama');
  });

  it('should include xAI Grok models', async () => {
    const response = await fetch('http://localhost:3000/api/models');
    const models = await response.json();
    
    const xaiModels = models.filter((m: { id: string }) => m.id.startsWith('xai.'));
    expect(xaiModels.length).toBeGreaterThan(0);
    
    // Check for specific xAI models
    const grok3 = models.find((m: { id: string }) => m.id === 'xai.grok-3');
    expect(grok3).toBeDefined();
    expect(grok3.name).toContain('Grok');
  });
});
