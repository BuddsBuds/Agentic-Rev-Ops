export { DatabaseConnectionManager, DatabaseFactory, type DatabaseConfig, type DatabaseMetrics as ConnectionMetrics } from './connection';
export { BaseEntity, type BaseEntityData, type FindOptions, type PaginatedResult } from './entities/base';
export { BaseRepository, SQLQueryBuilder, type RepositoryOptions, type QueryBuilder } from './repositories/BaseRepository';
export { Organization, type OrganizationData } from './entities/Organization';
export { User, type UserData, type UserSession } from './entities/User';
export { SwarmConfiguration, type SwarmConfigurationData, type AgentAssignment } from './entities/SwarmConfiguration';
export { OrganizationRepository } from './repositories/OrganizationRepository';
export { SwarmRepository, type SwarmMetrics, type DecisionAnalytics } from './repositories/SwarmRepository';
export { MigrationManager, type Migration, type MigrationRecord, type MigrationPlan } from './migrations/MigrationManager';
export { MigrationCLI, MigrationCLIRunner, type MigrationCLIOptions } from './migrations/MigrationCLI';
export { DatabaseService, type DatabaseServiceConfig, type DatabaseMetrics } from './DatabaseService';
export { DatabasePersistenceManager } from './DatabaseManager';
export declare class DatabaseSetup {
    static createProductionService(config: {
        host: string;
        port: number;
        database: string;
        username: string;
        password: string;
        ssl?: boolean;
        maxConnections?: number;
        readReplicas?: Array<{
            host: string;
            port: number;
            priority: number;
        }>;
    }): Promise<DatabaseService>;
    static createDevelopmentService(config: {
        host?: string;
        port?: number;
        database: string;
        username?: string;
        password?: string;
    }): Promise<DatabaseService>;
    static createTestService(config: {
        database: string;
        cleanup?: boolean;
    }): Promise<DatabaseService>;
    static createRepositoryService(connectionManager: DatabaseConnectionManager): Promise<{
        organizations: OrganizationRepository;
        swarms: SwarmRepository;
    }>;
}
export declare class DatabaseHealthMonitor {
    private services;
    private monitoringInterval?;
    register(name: string, service: DatabaseService): void;
    startMonitoring(intervalMs?: number): void;
    stopMonitoring(): void;
    getHealthSummary(): Promise<{
        overall: 'healthy' | 'degraded' | 'unhealthy';
        services: Array<{
            name: string;
            status: 'healthy' | 'degraded' | 'unhealthy';
            details?: any;
        }>;
    }>;
}
export default DatabaseService;
//# sourceMappingURL=index.d.ts.map