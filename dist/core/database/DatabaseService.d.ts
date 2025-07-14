import { DatabaseConnectionManager, DatabaseConfig } from './connection';
import { MigrationManager } from './migrations/MigrationManager';
import { OrganizationRepository } from './repositories/OrganizationRepository';
import { SwarmRepository } from './repositories/SwarmRepository';
import { BaseRepository } from './repositories/BaseRepository';
import { EventEmitter } from 'events';
export interface DatabaseServiceConfig {
    database: DatabaseConfig;
    migrations?: {
        path?: string;
        autoMigrate?: boolean;
    };
    caching?: {
        enabled: boolean;
        ttl: number;
        maxSize: number;
    };
    monitoring?: {
        enabled: boolean;
        metricsInterval: number;
        healthCheckInterval: number;
    };
}
export interface DatabaseMetrics {
    connections: {
        total: number;
        active: number;
        idle: number;
        waiting: number;
    };
    queries: {
        total: number;
        successful: number;
        failed: number;
        avgExecutionTime: number;
    };
    performance: {
        uptime: number;
        memoryUsage: number;
        cpuUsage: number;
    };
    repositories: {
        [key: string]: {
            totalQueries: number;
            cacheHits: number;
            cacheMisses: number;
        };
    };
}
export declare class DatabaseService extends EventEmitter {
    private config;
    private connection;
    private migrationManager;
    private repositories;
    private cache;
    private metrics;
    private monitoringInterval?;
    private healthCheckInterval?;
    private isInitialized;
    constructor(config: DatabaseServiceConfig);
    initialize(): Promise<void>;
    private initializeRepositories;
    getRepository<T extends BaseRepository<any>>(name: string): T;
    get organizations(): OrganizationRepository;
    get swarms(): SwarmRepository;
    get db(): DatabaseConnectionManager;
    get migrations(): MigrationManager;
    runMigrations(): Promise<{
        success: boolean;
        applied: string[];
        errors: string[];
    }>;
    transaction<T>(callback: (service: DatabaseService) => Promise<T>): Promise<T>;
    getFromCache<T>(key: string): Promise<T | null>;
    setCache(key: string, data: any, ttl?: number): Promise<void>;
    clearCache(pattern?: string): void;
    healthCheck(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        checks: Array<{
            name: string;
            status: 'pass' | 'fail';
            duration: number;
            message?: string;
        }>;
        metrics: DatabaseMetrics;
    }>;
    getMetrics(): DatabaseMetrics;
    private startMonitoring;
    private stopMonitoring;
    private collectMetrics;
    private updateRepositoryMetrics;
    private initializeMetrics;
    optimize(): Promise<{
        optimizations: string[];
        timesSaved: number;
        recommendations: string[];
    }>;
    backup(backupPath: string): Promise<void>;
    shutdown(): Promise<void>;
    getStatus(): {
        initialized: boolean;
        connected: boolean;
        repositories: string[];
        cacheEnabled: boolean;
        monitoringEnabled: boolean;
    };
}
export default DatabaseService;
//# sourceMappingURL=DatabaseService.d.ts.map