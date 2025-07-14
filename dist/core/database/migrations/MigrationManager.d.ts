import { DatabaseConnectionManager } from '../connection';
import { EventEmitter } from 'events';
export interface Migration {
    id: string;
    name: string;
    version: string;
    description: string;
    up: string;
    down: string;
    dependencies?: string[];
    checksum: string;
    created_at: Date;
}
export interface MigrationRecord {
    id: string;
    migration_id: string;
    version: string;
    checksum: string;
    applied_at: Date;
    execution_time_ms: number;
    status: 'applied' | 'failed' | 'rolled_back';
    error_message?: string;
}
export interface MigrationPlan {
    migrations: Migration[];
    totalMigrations: number;
    estimatedTime: number;
    warnings: string[];
}
export declare class MigrationManager extends EventEmitter {
    private db;
    private migrationsPath;
    private migrationTable;
    private lockTable;
    constructor(db: DatabaseConnectionManager, migrationsPath?: string);
    initialize(): Promise<void>;
    private createMigrationTables;
    private acquireLock;
    private releaseLock;
    private ensureMigrationLock;
    loadMigrations(): Promise<Migration[]>;
    private loadMigrationFile;
    private loadSQLMigration;
    private loadJSMigration;
    getPendingMigrations(): Promise<Migration[]>;
    getAppliedMigrations(): Promise<MigrationRecord[]>;
    createMigrationPlan(): Promise<MigrationPlan>;
    migrate(): Promise<{
        success: boolean;
        applied: string[];
        errors: string[];
    }>;
    private applyMigration;
    rollbackLast(): Promise<{
        success: boolean;
        rolledBack?: string;
        error?: string;
    }>;
    private rollbackMigration;
    getStatus(): Promise<{
        appliedCount: number;
        pendingCount: number;
        lastApplied?: MigrationRecord;
        health: 'healthy' | 'warning' | 'error';
    }>;
    private recordMigration;
    private getLastAppliedMigration;
    private getFailedMigrationCount;
    private generateMigrationId;
    private extractVersionFromFilename;
    private calculateChecksum;
    private sortMigrationsByDependencies;
}
export default MigrationManager;
//# sourceMappingURL=MigrationManager.d.ts.map