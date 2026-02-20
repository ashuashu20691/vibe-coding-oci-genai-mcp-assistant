// src/db/oracle-client.ts
/**
 * Oracle Database client using oracledb with wallet-based authentication.
 * Used for conversation and session persistence.
 */

import oracledb, { Pool, Connection, BindParameters, ExecuteOptions, Result } from 'oracledb';

// Configure oracledb to fetch CLOBs as strings
oracledb.fetchAsString = [oracledb.CLOB];

export interface OracleConfig {
  user: string;
  password: string;
  connectString: string;
  walletLocation: string;
  walletPassword?: string;
}

let pool: Pool | null = null;
let isInitialized = false;

/**
 * Initialize the Oracle connection pool with wallet configuration.
 */
export async function initializePool(config: OracleConfig): Promise<void> {
  if (isInitialized && pool) {
    return;
  }

  // For thin mode (no Oracle Client needed), set configDir for wallet
  // The wallet directory should contain tnsnames.ora and wallet files
  pool = await oracledb.createPool({
    user: config.user,
    password: config.password,
    connectString: config.connectString,
    configDir: config.walletLocation,
    walletLocation: config.walletLocation,
    walletPassword: config.walletPassword,
    poolMin: 1,
    poolMax: 4,
    poolIncrement: 1,
  });

  isInitialized = true;
  console.log('[OracleClient] Connection pool created successfully');
}

/**
 * Get a connection from the pool.
 */
export async function getConnection(): Promise<Connection> {
  if (!pool) {
    throw new Error('Oracle connection pool not initialized. Call initializePool first.');
  }
  return pool.getConnection();
}

/**
 * Execute a SQL query and return results.
 */
export async function executeQuery<T = unknown>(
  sql: string,
  binds: BindParameters = {},
  options: ExecuteOptions = {}
): Promise<T[]> {
  const connection = await getConnection();
  try {
    const result = await connection.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      ...options,
    });
    return (result.rows || []) as T[];
  } finally {
    await connection.close();
  }
}

/**
 * Execute a SQL statement (INSERT, UPDATE, DELETE) and commit.
 */
export async function executeStatement(
  sql: string,
  binds: BindParameters = {},
  options: ExecuteOptions = {}
): Promise<Result<unknown>> {
  const connection = await getConnection();
  try {
    const result = await connection.execute(sql, binds, {
      autoCommit: true,
      ...options,
    });
    return result;
  } finally {
    await connection.close();
  }
}

/**
 * Check if the pool is connected and healthy.
 */
export async function isConnected(): Promise<boolean> {
  if (!pool) return false;
  try {
    const connection = await pool.getConnection();
    await connection.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * Close the connection pool.
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.close(0);
    pool = null;
    isInitialized = false;
    console.log('[OracleClient] Connection pool closed');
  }
}

/**
 * Get pool statistics.
 */
export function getPoolStats(): { connectionsOpen: number; connectionsInUse: number } | null {
  if (!pool) return null;
  return {
    connectionsOpen: pool.connectionsOpen,
    connectionsInUse: pool.connectionsInUse,
  };
}
