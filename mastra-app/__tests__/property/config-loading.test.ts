/**
 * Property Test: Configuration Loading
 * 
 * Feature: mastra-migration, Property 5: Configuration Loading
 * 
 * *For any* valid set of environment variables for OCI, MCP, and app configuration,
 * the loadConfig function SHALL correctly parse and return a Config object with
 * all values matching the environment variables.
 * 
 * **Validates: Requirements 8.1, 8.2, 8.4**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { loadConfig } from '../../src/config';

// Store original env to restore after tests
const originalEnv = { ...process.env };

// Helper to clean environment variables before each test
function cleanEnv() {
  delete process.env.OCI_CONFIG_FILE;
  delete process.env.OCI_PROFILE;
  delete process.env.OCI_COMPARTMENT_ID;
  delete process.env.OCI_ENDPOINT;
  delete process.env.MCP_COMMAND;
  delete process.env.MCP_ARGS;
  delete process.env.MCP_ENV;
  delete process.env.ORACLE_CONNECTION_NAME;
  delete process.env.APP_TITLE;
  delete process.env.APP_DEFAULT_MODEL;
}

// Arbitrary for valid OCI config file paths
const ociConfigFileArb = fc.option(
  fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z0-9/_.-]+$/.test(s)),
  { nil: undefined }
);

// Arbitrary for valid OCI profile names
const ociProfileArb = fc.option(
  fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[A-Z_]+$/.test(s)),
  { nil: undefined }
);

// Arbitrary for valid compartment IDs (OCID format simplified)
const ociCompartmentIdArb = fc.option(
  fc.string({ minLength: 10, maxLength: 60 }).filter(s => /^[a-z0-9.]+$/.test(s)),
  { nil: undefined }
);

// Arbitrary for valid OCI endpoints
const ociEndpointArb = fc.option(
  fc.webUrl({ withFragments: false, withQueryParameters: false }),
  { nil: undefined }
);

// Arbitrary for MCP command
const mcpCommandArb = fc.option(
  fc.string({ minLength: 1, maxLength: 30 }).filter(s => /^[a-zA-Z0-9/_.-]+$/.test(s)),
  { nil: undefined }
);

// Arbitrary for MCP args (comma-separated list without commas in values)
const mcpArgsArb = fc.option(
  fc.array(
    fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
    { minLength: 0, maxLength: 5 }
  ).map(args => args.join(',')),
  { nil: undefined }
);

// Arbitrary for MCP env (comma-separated key=value pairs)
const mcpEnvArb = fc.option(
  fc.array(
    fc.tuple(
      fc.string({ minLength: 1, maxLength: 15 }).filter(s => /^[A-Z_]+$/.test(s)),
      fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9]+$/.test(s))
    ).map(([k, v]) => `${k}=${v}`),
    { minLength: 0, maxLength: 3 }
  ).map(pairs => pairs.join(',')),
  { nil: undefined }
);

// Arbitrary for Oracle connection name
const oracleConnectionNameArb = fc.option(
  fc.string({ minLength: 1, maxLength: 30 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
  { nil: undefined }
);

// Arbitrary for app title
const appTitleArb = fc.option(
  fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z0-9 -]+$/.test(s)),
  { nil: undefined }
);

// Arbitrary for app default model
const appDefaultModelArb = fc.option(
  fc.string({ minLength: 1, maxLength: 40 }).filter(s => /^[a-zA-Z0-9.-]+$/.test(s)),
  { nil: undefined }
);

describe('Property 5: Configuration Loading', () => {
  beforeEach(() => {
    cleanEnv();
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  it('should correctly parse OCI configuration from environment variables (Req 8.1)', () => {
    fc.assert(
      fc.property(
        ociConfigFileArb,
        ociProfileArb,
        ociCompartmentIdArb,
        ociEndpointArb,
        (configFile, profile, compartmentId, endpoint) => {
          // Set environment variables
          if (configFile !== undefined) process.env.OCI_CONFIG_FILE = configFile;
          if (profile !== undefined) process.env.OCI_PROFILE = profile;
          if (compartmentId !== undefined) process.env.OCI_COMPARTMENT_ID = compartmentId;
          if (endpoint !== undefined) process.env.OCI_ENDPOINT = endpoint;

          const config = loadConfig();

          // Verify OCI config matches environment variables
          expect(config.oci.configFile).toBe(configFile);
          expect(config.oci.profile).toBe(profile ?? 'DEFAULT');
          expect(config.oci.compartmentId).toBe(compartmentId ?? '');
          expect(config.oci.endpoint).toBe(endpoint);

          // Clean up for next iteration
          cleanEnv();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly parse MCP configuration from environment variables (Req 8.2)', () => {
    fc.assert(
      fc.property(
        mcpCommandArb,
        mcpArgsArb,
        mcpEnvArb,
        (command, args, env) => {
          // Set environment variables
          if (command !== undefined) process.env.MCP_COMMAND = command;
          if (args !== undefined) process.env.MCP_ARGS = args;
          if (env !== undefined) process.env.MCP_ENV = env;

          const config = loadConfig();

          // Verify MCP command
          expect(config.mcp.command).toBe(command ?? '');

          // Verify MCP args parsing
          const expectedArgs = args 
            ? args.split(',').filter(Boolean).map(s => s.trim())
            : [];
          expect(config.mcp.args).toEqual(expectedArgs);

          // Verify MCP env parsing
          if (env && env.length > 0) {
            const expectedEnv: Record<string, string> = {};
            env.split(',').forEach(pair => {
              const [key, value] = pair.split('=');
              if (key && value) expectedEnv[key.trim()] = value.trim();
            });
            if (Object.keys(expectedEnv).length > 0) {
              expect(config.mcp.env).toEqual(expectedEnv);
            } else {
              expect(config.mcp.env).toBeUndefined();
            }
          } else {
            expect(config.mcp.env).toBeUndefined();
          }

          // Clean up for next iteration
          cleanEnv();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly parse app configuration from environment variables (Req 8.4)', () => {
    fc.assert(
      fc.property(
        appTitleArb,
        appDefaultModelArb,
        oracleConnectionNameArb,
        (title, defaultModel, connectionName) => {
          // Set environment variables
          if (title !== undefined) process.env.APP_TITLE = title;
          if (defaultModel !== undefined) process.env.APP_DEFAULT_MODEL = defaultModel;
          if (connectionName !== undefined) process.env.ORACLE_CONNECTION_NAME = connectionName;

          const config = loadConfig();

          // Verify app config
          expect(config.app.title).toBe(title ?? 'OCI GenAI Chat');
          expect(config.app.defaultModel).toBe(defaultModel);

          // Verify Oracle connection name
          expect(config.oracle.connectionName).toBe(connectionName ?? '');

          // Clean up for next iteration
          cleanEnv();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return complete Config object with all fields for any valid environment', () => {
    fc.assert(
      fc.property(
        ociConfigFileArb,
        ociProfileArb,
        ociCompartmentIdArb,
        ociEndpointArb,
        mcpCommandArb,
        mcpArgsArb,
        mcpEnvArb,
        oracleConnectionNameArb,
        appTitleArb,
        appDefaultModelArb,
        (configFile, profile, compartmentId, endpoint, command, args, env, connectionName, title, defaultModel) => {
          // Set all environment variables
          if (configFile !== undefined) process.env.OCI_CONFIG_FILE = configFile;
          if (profile !== undefined) process.env.OCI_PROFILE = profile;
          if (compartmentId !== undefined) process.env.OCI_COMPARTMENT_ID = compartmentId;
          if (endpoint !== undefined) process.env.OCI_ENDPOINT = endpoint;
          if (command !== undefined) process.env.MCP_COMMAND = command;
          if (args !== undefined) process.env.MCP_ARGS = args;
          if (env !== undefined) process.env.MCP_ENV = env;
          if (connectionName !== undefined) process.env.ORACLE_CONNECTION_NAME = connectionName;
          if (title !== undefined) process.env.APP_TITLE = title;
          if (defaultModel !== undefined) process.env.APP_DEFAULT_MODEL = defaultModel;

          const config = loadConfig();

          // Verify config structure is complete
          expect(config).toHaveProperty('oci');
          expect(config).toHaveProperty('mcp');
          expect(config).toHaveProperty('oracle');
          expect(config).toHaveProperty('app');

          // Verify OCI structure
          expect(config.oci).toHaveProperty('configFile');
          expect(config.oci).toHaveProperty('profile');
          expect(config.oci).toHaveProperty('compartmentId');
          expect(config.oci).toHaveProperty('endpoint');

          // Verify MCP structure
          expect(config.mcp).toHaveProperty('command');
          expect(config.mcp).toHaveProperty('args');
          expect(Array.isArray(config.mcp.args)).toBe(true);

          // Verify Oracle structure
          expect(config.oracle).toHaveProperty('connectionName');

          // Verify App structure
          expect(config.app).toHaveProperty('title');
          expect(config.app).toHaveProperty('defaultModel');

          // Clean up for next iteration
          cleanEnv();
        }
      ),
      { numRuns: 100 }
    );
  });
});
