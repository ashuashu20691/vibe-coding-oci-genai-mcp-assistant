/**
 * Property Test: Tool Name Round-Trip
 * 
 * Feature: mastra-migration, Property 4: Tool Name Round-Trip
 * 
 * *For any* MCP tool name containing hyphens, converting to OCI format
 * (replacing hyphens with underscores) and back to MCP format (replacing
 * underscores with hyphens) SHALL produce the original tool name.
 * 
 * **Validates: Requirements 3.6**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { toOCIToolName, toMCPToolName } from '../../src/mastra/mcp/client';

// Arbitrary for valid MCP tool names (may contain hyphens)
// MCP tool names typically follow kebab-case convention
const mcpToolNameArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => /^[a-z][a-z0-9-]*$/.test(s))
  .filter(s => !s.endsWith('-') && !s.includes('--'));

// Arbitrary for valid OCI tool names (uses underscores instead of hyphens)
// OCI GenAI (Cohere) requires tool names with underscores
const ociToolNameArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => /^[a-z][a-z0-9_]*$/.test(s))
  .filter(s => !s.endsWith('_') && !s.includes('__'));

// Arbitrary for tool names that contain only letters and numbers (no separators)
const simpleToolNameArb = fc.string({ minLength: 1, maxLength: 30 })
  .filter(s => /^[a-z][a-z0-9]*$/.test(s));

describe('Property 4: Tool Name Round-Trip', () => {
  it('should preserve MCP tool names through OCI conversion and back (Req 3.6)', () => {
    fc.assert(
      fc.property(mcpToolNameArb, (mcpName) => {
        // Convert MCP name to OCI format (hyphens -> underscores)
        const ociName = toOCIToolName(mcpName);
        
        // Convert back to MCP format (underscores -> hyphens)
        const roundTrippedName = toMCPToolName(ociName);
        
        // Property: Round-trip should produce the original name
        expect(roundTrippedName).toBe(mcpName);
      }),
      { numRuns: 100 }
    );
  });

  it('should convert hyphens to underscores for OCI compatibility (Req 3.6)', () => {
    fc.assert(
      fc.property(mcpToolNameArb, (mcpName) => {
        const ociName = toOCIToolName(mcpName);
        
        // Property: OCI name should not contain hyphens
        expect(ociName).not.toContain('-');
        
        // Property: Number of underscores in OCI name should equal
        // number of hyphens in MCP name (plus any existing underscores)
        const hyphenCount = (mcpName.match(/-/g) || []).length;
        const originalUnderscoreCount = (mcpName.match(/_/g) || []).length;
        const resultUnderscoreCount = (ociName.match(/_/g) || []).length;
        
        expect(resultUnderscoreCount).toBe(hyphenCount + originalUnderscoreCount);
      }),
      { numRuns: 100 }
    );
  });

  it('should convert underscores to hyphens for MCP format (Req 3.6)', () => {
    fc.assert(
      fc.property(ociToolNameArb, (ociName) => {
        const mcpName = toMCPToolName(ociName);
        
        // Property: MCP name should not contain underscores
        expect(mcpName).not.toContain('_');
        
        // Property: Number of hyphens in MCP name should equal
        // number of underscores in OCI name (plus any existing hyphens)
        const underscoreCount = (ociName.match(/_/g) || []).length;
        const originalHyphenCount = (ociName.match(/-/g) || []).length;
        const resultHyphenCount = (mcpName.match(/-/g) || []).length;
        
        expect(resultHyphenCount).toBe(underscoreCount + originalHyphenCount);
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve tool names without separators (Req 3.6)', () => {
    fc.assert(
      fc.property(simpleToolNameArb, (name) => {
        // Names without hyphens or underscores should be unchanged
        const ociName = toOCIToolName(name);
        const mcpName = toMCPToolName(name);
        
        expect(ociName).toBe(name);
        expect(mcpName).toBe(name);
      }),
      { numRuns: 100 }
    );
  });

  it('should handle real-world SQLcl MCP tool names (Req 3.6)', () => {
    // Test with actual SQLcl MCP Server tool names
    const realToolNames = [
      'run-sql',
      'run-sqlcl',
      'connect',
      'list-connections',
      'get-schema',
    ];

    for (const mcpName of realToolNames) {
      const ociName = toOCIToolName(mcpName);
      const roundTripped = toMCPToolName(ociName);
      
      // Property: Round-trip preserves the original name
      expect(roundTripped).toBe(mcpName);
      
      // Property: OCI name has no hyphens
      expect(ociName).not.toContain('-');
    }
  });

  it('should be idempotent when applied multiple times (Req 3.6)', () => {
    fc.assert(
      fc.property(mcpToolNameArb, (mcpName) => {
        // Apply toOCIToolName multiple times
        const once = toOCIToolName(mcpName);
        const twice = toOCIToolName(once);
        
        // Property: Applying twice should be same as once (idempotent)
        expect(twice).toBe(once);
      }),
      { numRuns: 100 }
    );

    fc.assert(
      fc.property(ociToolNameArb, (ociName) => {
        // Apply toMCPToolName multiple times
        const once = toMCPToolName(ociName);
        const twice = toMCPToolName(once);
        
        // Property: Applying twice should be same as once (idempotent)
        expect(twice).toBe(once);
      }),
      { numRuns: 100 }
    );
  });
});
