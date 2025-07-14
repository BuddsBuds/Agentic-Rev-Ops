import { PoolClient, QueryResult } from 'pg';
import { EventEmitter } from 'events';
export interface DatabaseConfig {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl?: boolean;
    maxConnections?: number;
    idleTimeoutMs?: number;
    connectionTimeoutMs?: number;
    retryAttempts?: number;
    retryDelayMs?: number;
    readReplicas?: DatabaseReplicaConfig[];
}
export interface DatabaseReplicaConfig {
    host: string;
    port: number;
    priority: number;
}
export interface QueryOptions {
    useReadReplica?: boolean;
    timeout?: number;
    retryOnFailure?: boolean;
}
export interface DatabaseMetrics {
    totalConnections: number;
    idleConnections: number;
    waitingClients: number;
    totalQueries: number;
    successfulQueries: number;
    failedQueries: number;
    averageQueryTime: number;
    uptime: number;
}
export declare class DatabaseConnectionManager extends EventEmitter {
    private writePool;
    private readPools;
    private config;
    private metrics;
    private isHealthy;
    private startTime;
    private queryTimes;
    constructor(config: DatabaseConfig);
    private initializeConnections;
    private setupEventHandlers;
    query<T = any>(text: string, params?: any[], options?: QueryOptions): Promise<QueryResult<T>>;
    private executeWithRetry;
    private selectPool;
    transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
    healthCheck(): Promise<boolean>;
    getMetrics(): DatabaseMetrics;
    isConnectionHealthy(): boolean;
    close(): Promise<void>;
    execute<T = any>(name: string, text: string, values?: any[], options?: QueryOptions): Promise<QueryResult<T>>;
    bulkInsert(tableName: string, columns: string[], data: any[][], schema?: string): Promise<void>;
    streamQuery<T = any>(text: string, params?: any[], batchSize?: number): AsyncGenerator<T[], void, unknown>;
}
export declare class DatabaseFactory {
    private static instances;
    static create(name: string, config: DatabaseConfig): Promise<DatabaseConnectionManager>;
    static get(name: string): DatabaseConnectionManager | undefined;
    static closeAll(): Promise<void>;
}
export default DatabaseConnectionManager;
//# sourceMappingURL=connection.d.ts.map