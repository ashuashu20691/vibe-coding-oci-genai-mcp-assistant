/**
 * Property Test: Configuration Validation
 * 
 * Feature: mastra-migration, Property 6: Configuration Validation
 * 
 * *For any* configuration missing required fields (OCI_COMPARTMENT_ID, MCP_COMMAND),
 * the validateConfig function SHALL return an error list containing the names of
 * all missing required fields.
 * 
 * **Validates: Requirements 8.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Config, validateConfig } from '../../src/config';

// Arbitrary for valid compartment IDs (non-empty strings)
const validCompartmentIdArb = fc.string({ minLength: 1, maxLength: 60 })
  .filter(s => /^[a-z0-9.]+$/.test(s));

// Arbitrary for valid MCP commands (non-empty strings)
const validMcpCommandArb = fc.string({ minLength: 1, maxLength: 30 })
  .filter(s => /^[a-zA-Z0-9/_.-]+$/.test(s));

// Arbitrary for optional string fields
const optionalStringArb = fc.option(
  fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z0-9/_.-]+$/.test(s)),
  { nil: undefined }
);

// Arbitrary for MCP args array
const mcpArgsArb = fc.array(
  fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
  { minLength: 0, maxLength: 5 }
);

// Arbitrary for MCP env record
const mcpEnvArb = fc.option(
  fc.dictionary(
    fc.string({ minLength: 1, maxLength: 15 }).filter(s => /^[A-Z_]+$/.test(s)),
    fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9]+$/.test(s)),
    { minKeys: 0, maxKeys: 3 }
  ),
  { nil: undefined }
);

// Helper to create a valid config
function createConfig(overrides: Partial<{
  compartmentId: string;
  mcpCommand: string;
  configFile?: string;
  profile: string;
  endpoint?: string;
  mcpArgs: string[];
  mcpEnv?: Record<string, string>;
  connectionName: string;
  appTitle: string;
  defaultModel?: string;
}>): Config {
  return {
    oci: {
      configFile: overrides.configFile,
      profile: overrides.profile ?? 'DEFAULT',
      compartmentId: overrides.compartmentId ?? '',
      endpoint: overrides.endpoint,
    },
    mcp: {
      command: overrides.mcpCommand ?? '',
      args: overrides.mcpArgs ?? [],
      env: overrides.mcpEnv,
    },
    oracle: {
      connectionName: overrides.connectionName ?? '',
    },
    app: {
      title: overrides.appTitle ?? 'OCI GenAI Chat',
      defaultModel: overrides.defaultModel,
    },
  };
}

describe('Property 6: Configuration Validation', () => {
  it('should return no errors when all required fields are present', () => {
    fc.assert(
      fc.property(
        validCompartmentIdArb,
        validMcpCommandArb,
        optionalStringArb,
        optionalStringArb,
        mcpArgsArb,
        mcpEnvArb,
        optionalStringArb,
        optionalStringArb,
        (compartmentId, mcpCommand, configFile, endpoint, mcpArgs, mcpEnv, connectionName, defaultModel) => {
          const config = createConfig({
            compartmentId,
            mcpCommand,
            configFile,
            endpoint,
            mcpArgs,
            mcpEnv: mcpEnv && Object.keys(mcpEnv).length > 0 ? mcpEnv : undefined,
            connectionName: connectionName ?? '',
            defaultModel,
          });

          const errors = validateConfig(config);

          // When all required fields are present, no errors should be returned
          expect(errors).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return error for missing OCI_COMPARTMENT_ID', () => {
    fc.assert(
      fc.property(
        validMcpCommandArb,
        mcpArgsArb,
        (mcpCommand, mcpArgs) => {
          const config = createConfig({
            compartmentId: '', // Missing required field
            mcpCommand,
            mcpArgs,
          });

          const errors = validateConfig(config);

          // Should contain error about missing OCI_COMPARTMENT_ID
          expect(errors).toContain('OCI_COMPARTMENT_ID is required');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return error for missing MCP_COMMAND', () => {
    fc.assert(
      fc.property(
        validCompartmentIdArb,
        mcpArgsArb,
        (compartmentId, mcpArgs) => {
          const config = createConfig({
            compartmentId,
            mcpCommand: '', // Missing required field
            mcpArgs,
          });

          const errors = validateConfig(config);

          // Should contain error about missing MCP_COMMAND
          expect(errors).toContain('MCP_COMMAND is required');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return errors for ALL missing required fields when multiple are missing', () => {
    fc.assert(
      fc.property(
        mcpArgsArb,
        mcpEnvArb,
        optionalStringArb,
        (mcpArgs, mcpEnv, connectionName) => {
          const config = createConfig({
            compartmentId: '', // Missing
            mcpCommand: '', // Missing
            mcpArgs,
            mcpEnv: mcpEnv && Object.keys(mcpEnv).length > 0 ? mcpEnv : undefined,
            connectionName: connectionName ?? '',
          });

          const errors = validateConfig(config);

          // Should contain errors for BOTH missing required fields
          expect(errors).toContain('OCI_COMPARTMENT_ID is required');
          expect(errors).toContain('MCP_COMMAND is required');
          expect(errors.length).toBe(2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not require ORACLE_CONNECTION_NAME (optional field)', () => {
    fc.assert(
      fc.property(
        validCompartmentIdArb,
        validMcpCommandArb,
        (compartmentId, mcpCommand) => {
          const config = createConfig({
            compartmentId,
            mcpCommand,
            connectionName: '', // Empty - should be allowed
          });

          const errors = validateConfig(config);

          // ORACLE_CONNECTION_NAME is optional, so no error should be returned
          expect(errors).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });
});
