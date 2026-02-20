// Type declaration for oracledb module
declare module 'oracledb' {
  export const CLOB: number;
  export let fetchAsString: number[];
  export const OUT_FORMAT_OBJECT: number;
  
  export interface PoolAttributes {
    user: string;
    password: string;
    connectString: string;
    configDir?: string;
    walletLocation?: string;
    walletPassword?: string;
    poolMin?: number;
    poolMax?: number;
    poolIncrement?: number;
  }
  
  export interface Pool {
    getConnection(): Promise<Connection>;
    close(drainTime?: number): Promise<void>;
    connectionsOpen: number;
    connectionsInUse: number;
  }
  
  export interface Connection {
    execute<T = unknown>(sql: string, binds?: BindParameters, options?: ExecuteOptions): Promise<Result<T>>;
    commit(): Promise<void>;
    close(): Promise<void>;
  }
  
  export type BindParameters = Record<string, unknown> | unknown[];
  
  export interface ExecuteOptions {
    outFormat?: number;
    autoCommit?: boolean;
  }
  
  export interface Result<T = unknown> {
    rows?: T[];
    metaData?: Array<{ name: string }>;
    rowsAffected?: number;
  }
  
  export function createPool(attrs: PoolAttributes): Promise<Pool>;
  
  const oracledb: {
    CLOB: number;
    fetchAsString: number[];
    OUT_FORMAT_OBJECT: number;
    createPool: typeof createPool;
  };
  
  export default oracledb;
}
