import { EventEmitter } from 'events';
import { DatabaseService } from './index';
export interface DatabaseConfig {
    type: 'sqlite' | 'postgresql' | 'mysql' | 'mongodb';
    host?: string;
    port?: number;
    database: string;
    username?: string;
    password?: string;
    filepath?: string;
}
export interface DatabaseConnection {
    id: string;
    config: DatabaseConfig;
    status: 'connected' | 'disconnected' | 'error';
    lastActivity?: Date;
}
export interface QueryResult {
    rows: any[];
    affectedRows?: number;
    insertId?: any;
    metadata?: any;
}
export interface Transaction {
    id: string;
    status: 'active' | 'committed' | 'rolled_back';
    queries: string[];
    startTime: Date;
    endTime?: Date;
}
export interface DatabaseManager {
    connect(config: DatabaseConfig): Promise<DatabaseConnection>;
    disconnect(connectionId: string): Promise<void>;
    query(connectionId: string, sql: string, params?: any[]): Promise<QueryResult>;
    transaction(connectionId: string, queries: string[]): Promise<Transaction>;
    migrate(connectionId: string, migrationPath: string): Promise<void>;
    backup(connectionId: string, backupPath: string): Promise<void>;
    getConnections(): DatabaseConnection[];
}
export declare class DatabasePersistenceManager extends EventEmitter implements DatabaseManager {
    private connections;
    private connectionPools;
    private activeTransactions;
    private queryHistory;
    connect(config: DatabaseConfig): Promise<DatabaseConnection>;
    disconnect(connectionId: string): Promise<void>;
    query(connectionId: string, sql: string, params?: any[]): Promise<QueryResult>;
    transaction(connectionId: string, queries: string[]): Promise<Transaction>;
    migrate(connectionId: string, migrationPath: string): Promise<void>;
    backup(connectionId: string, backupPath: string): Promise<void>;
    getConnections(): DatabaseConnection[];
    private generateConnectionId;
    private generateTransactionId;
    private establishConnection;
    private connectSQLite;
    private connectPostgreSQL;
    private connectMySQL;
    private connectMongoDB;
    private executeQuery;
    private logQuery;
    private createMigrationsTable;
    private loadMigrations;
    private isMigrationApplied;
    private executeMigration;
    private recordMigration;
    private createDatabaseBackup;
    getQueryHistory(connectionId: string): Promise<string[]>;
    getActiveTransactions(): Promise<Transaction[]>;
    healthCheck(connectionId: string): Promise<boolean>;
    getConnectionStats(connectionId: string): Promise<any>;
    upgradeToModernService(): Promise<DatabaseService>;
}
//# sourceMappingURL=DatabaseManager.d.ts.map