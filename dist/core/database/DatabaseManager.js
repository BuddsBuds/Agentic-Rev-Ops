"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabasePersistenceManager = void 0;
const events_1 = require("events");
class DatabasePersistenceManager extends events_1.EventEmitter {
    connections = new Map();
    connectionPools = new Map();
    activeTransactions = new Map();
    queryHistory = new Map();
    async connect(config) {
        const connectionId = this.generateConnectionId();
        const connection = {
            id: connectionId,
            config,
            status: 'disconnected',
            lastActivity: new Date()
        };
        try {
            await this.establishConnection(connection);
            connection.status = 'connected';
            this.connections.set(connectionId, connection);
            this.emit('connection:established', connection);
            return connection;
        }
        catch (error) {
            connection.status = 'error';
            this.emit('connection:error', { connection, error });
            throw error;
        }
    }
    async disconnect(connectionId) {
        const connection = this.connections.get(connectionId);
        if (!connection) {
            throw new Error(`Connection ${connectionId} not found`);
        }
        try {
            const pool = this.connectionPools.get(connectionId);
            if (pool && pool.end) {
                await pool.end();
            }
            connection.status = 'disconnected';
            this.connections.delete(connectionId);
            this.connectionPools.delete(connectionId);
            this.queryHistory.delete(connectionId);
            this.emit('connection:closed', connection);
        }
        catch (error) {
            this.emit('connection:error', { connection, error });
            throw error;
        }
    }
    async query(connectionId, sql, params = []) {
        const connection = this.connections.get(connectionId);
        if (!connection || connection.status !== 'connected') {
            throw new Error(`Connection ${connectionId} not available`);
        }
        try {
            this.logQuery(connectionId, sql, params);
            const result = await this.executeQuery(connection, sql, params);
            connection.lastActivity = new Date();
            this.emit('query:executed', { connectionId, sql, params, result });
            return result;
        }
        catch (error) {
            this.emit('query:error', { connectionId, sql, params, error });
            throw error;
        }
    }
    async transaction(connectionId, queries) {
        const connection = this.connections.get(connectionId);
        if (!connection || connection.status !== 'connected') {
            throw new Error(`Connection ${connectionId} not available`);
        }
        const transaction = {
            id: this.generateTransactionId(),
            status: 'active',
            queries,
            startTime: new Date()
        };
        this.activeTransactions.set(transaction.id, transaction);
        try {
            await this.executeQuery(connection, 'BEGIN', []);
            for (const query of queries) {
                await this.executeQuery(connection, query, []);
            }
            await this.executeQuery(connection, 'COMMIT', []);
            transaction.status = 'committed';
            transaction.endTime = new Date();
            this.emit('transaction:committed', transaction);
            return transaction;
        }
        catch (error) {
            try {
                await this.executeQuery(connection, 'ROLLBACK', []);
                transaction.status = 'rolled_back';
                transaction.endTime = new Date();
            }
            catch (rollbackError) {
                this.emit('transaction:rollback-error', { transaction, error: rollbackError });
            }
            this.emit('transaction:error', { transaction, error });
            throw error;
        }
        finally {
            this.activeTransactions.delete(transaction.id);
        }
    }
    async migrate(connectionId, migrationPath) {
        const connection = this.connections.get(connectionId);
        if (!connection || connection.status !== 'connected') {
            throw new Error(`Connection ${connectionId} not available`);
        }
        try {
            await this.createMigrationsTable(connection);
            const migrations = await this.loadMigrations(migrationPath);
            for (const migration of migrations) {
                const isApplied = await this.isMigrationApplied(connection, migration.name);
                if (!isApplied) {
                    await this.executeMigration(connection, migration);
                    await this.recordMigration(connection, migration.name);
                    this.emit('migration:applied', { connectionId, migration: migration.name });
                }
            }
            this.emit('migration:complete', { connectionId, migrationsApplied: migrations.length });
        }
        catch (error) {
            this.emit('migration:error', { connectionId, error });
            throw error;
        }
    }
    async backup(connectionId, backupPath) {
        const connection = this.connections.get(connectionId);
        if (!connection || connection.status !== 'connected') {
            throw new Error(`Connection ${connectionId} not available`);
        }
        try {
            await this.createDatabaseBackup(connection, backupPath);
            this.emit('backup:created', { connectionId, backupPath });
        }
        catch (error) {
            this.emit('backup:error', { connectionId, error });
            throw error;
        }
    }
    getConnections() {
        return Array.from(this.connections.values());
    }
    generateConnectionId() {
        return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateTransactionId() {
        return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    async establishConnection(connection) {
        switch (connection.config.type) {
            case 'sqlite':
                await this.connectSQLite(connection);
                break;
            case 'postgresql':
                await this.connectPostgreSQL(connection);
                break;
            case 'mysql':
                await this.connectMySQL(connection);
                break;
            case 'mongodb':
                await this.connectMongoDB(connection);
                break;
            default:
                throw new Error(`Unsupported database type: ${connection.config.type}`);
        }
    }
    async connectSQLite(_connection) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    async connectPostgreSQL(_connection) {
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    async connectMySQL(connection) {
        await new Promise(resolve => setTimeout(resolve, 150));
    }
    async connectMongoDB(connection) {
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    async executeQuery(connection, sql, params) {
        await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 50));
        if (sql.toLowerCase().startsWith('select')) {
            return {
                rows: [
                    { id: 1, name: 'Sample Record', created_at: new Date() },
                    { id: 2, name: 'Another Record', created_at: new Date() }
                ],
                metadata: { queryTime: Math.random() * 100 }
            };
        }
        else if (sql.toLowerCase().startsWith('insert')) {
            return {
                rows: [],
                affectedRows: 1,
                insertId: Math.floor(Math.random() * 1000),
                metadata: { queryTime: Math.random() * 50 }
            };
        }
        else {
            return {
                rows: [],
                affectedRows: Math.floor(Math.random() * 5),
                metadata: { queryTime: Math.random() * 30 }
            };
        }
    }
    logQuery(connectionId, sql, params) {
        const history = this.queryHistory.get(connectionId) || [];
        const queryLog = `${new Date().toISOString()}: ${sql} [${params.join(', ')}]`;
        history.push(queryLog);
        if (history.length > 100) {
            history.shift();
        }
        this.queryHistory.set(connectionId, history);
    }
    async createMigrationsTable(connection) {
        const sql = `
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
        await this.executeQuery(connection, sql, []);
    }
    async loadMigrations(migrationPath) {
        return [
            {
                name: '001_initial_tables.sql',
                sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR(255));'
            },
            {
                name: '002_add_timestamps.sql',
                sql: 'ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;'
            }
        ];
    }
    async isMigrationApplied(connection, migrationName) {
        const result = await this.executeQuery(connection, 'SELECT COUNT(*) as count FROM migrations WHERE name = ?', [migrationName]);
        return result.rows[0]?.count > 0;
    }
    async executeMigration(connection, migration) {
        await this.executeQuery(connection, migration.sql, []);
    }
    async recordMigration(connection, migrationName) {
        await this.executeQuery(connection, 'INSERT INTO migrations (name) VALUES (?)', [migrationName]);
    }
    async createDatabaseBackup(connection, backupPath) {
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    async getQueryHistory(connectionId) {
        return this.queryHistory.get(connectionId) || [];
    }
    async getActiveTransactions() {
        return Array.from(this.activeTransactions.values());
    }
    async healthCheck(connectionId) {
        try {
            await this.query(connectionId, 'SELECT 1 as health_check', []);
            return true;
        }
        catch {
            return false;
        }
    }
    async getConnectionStats(connectionId) {
        const connection = this.connections.get(connectionId);
        const queryHistory = this.queryHistory.get(connectionId) || [];
        return {
            connection,
            totalQueries: queryHistory.length,
            lastActivity: connection?.lastActivity,
            status: connection?.status
        };
    }
    async upgradeToModernService() {
        console.warn('⚠️ DatabasePersistenceManager is deprecated. Please migrate to DatabaseService.');
        throw new Error('Please use DatabaseService directly for new development');
    }
}
exports.DatabasePersistenceManager = DatabasePersistenceManager;
//# sourceMappingURL=DatabaseManager.js.map