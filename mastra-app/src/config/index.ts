// src/config/index.ts

export interface Config {
  oci: {
    configFile?: string;
    profile: string;
    compartmentId: string;
    endpoint?: string;
  };
  mcp: {
    command: string;
    args: string[];
    env?: Record<string, string>;
  };
  oracle: {
    user: string;
    password: string;
    connectString: string;
    walletLocation: string;
    walletPassword?: string;
  };
  app: {
    title: string;
    defaultModel?: string;
  };
}

export function loadConfig(): Config {
  const mcpArgsStr = process.env.MCP_ARGS || '';
  const mcpArgs = mcpArgsStr.split(',').filter(Boolean).map(s => s.trim());
  
  const mcpEnvStr = process.env.MCP_ENV || '';
  const mcpEnv: Record<string, string> = {};
  mcpEnvStr.split(',').forEach(pair => {
    const [key, value] = pair.split('=');
    if (key && value) mcpEnv[key.trim()] = value.trim();
  });

  return {
    oci: {
      configFile: process.env.OCI_CONFIG_FILE,
      profile: process.env.OCI_PROFILE || 'DEFAULT',
      compartmentId: process.env.OCI_COMPARTMENT_ID || '',
      endpoint: process.env.OCI_ENDPOINT,
    },
    mcp: {
      command: process.env.MCP_COMMAND || '',
      args: mcpArgs,
      env: Object.keys(mcpEnv).length > 0 ? mcpEnv : undefined,
    },
    oracle: {
      user: process.env.ORACLE_USER || '',
      password: process.env.ORACLE_PASSWORD || '',
      connectString: process.env.ORACLE_DSN || '',
      walletLocation: process.env.ORACLE_WALLET_LOCATION || '',
      walletPassword: process.env.ORACLE_WALLET_PASSWORD,
    },
    app: {
      title: process.env.APP_TITLE || 'OCI GenAI Chat',
      defaultModel: process.env.APP_DEFAULT_MODEL,
    },
  };
}

export function validateConfig(config: Config): string[] {
  const errors: string[] = [];
  
  if (!config.oci.compartmentId) {
    errors.push('OCI_COMPARTMENT_ID is required');
  }
  if (!config.mcp.command) {
    errors.push('MCP_COMMAND is required');
  }
  // Oracle config is optional - app works without persistent history
  
  return errors;
}

/**
 * Check if Oracle DB is configured for conversation persistence.
 */
export function isOracleConfigured(config: Config): boolean {
  return Boolean(
    config.oracle.user &&
    config.oracle.password &&
    config.oracle.connectString &&
    config.oracle.walletLocation
  );
}
