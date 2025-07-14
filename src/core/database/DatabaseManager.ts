// Legacy Database Persistence Layer
// This class is maintained for backward compatibility
// For new development, use DatabaseService from './DatabaseService'
import { EventEmitter } from 'events';
import { DatabaseService, DatabaseConnectionManager } from './index';

export interface DatabaseConfig {
  type: 'sqlite' | 'postgresql' | 'mysql' | 'mongodb';
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  filepath?: string; // For SQLite
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

export class DatabasePersistenceManager extends EventEmitter implements DatabaseManager {
  private connections: Map<string, DatabaseConnection> = new Map();
  private connectionPools: Map<string, any> = new Map();
  private activeTransactions: Map<string, Transaction> = new Map();
  private queryHistory: Map<string, string[]> = new Map();

  async connect(config: DatabaseConfig): Promise<DatabaseConnection> {
    const connectionId = this.generateConnectionId();
    
    const connection: DatabaseConnection = {
      id: connectionId,
      config,
      status: 'disconnected',
      lastActivity: new Date()
    };

    try {
      // Simulate database connection based on type
      await this.establishConnection(connection);
      
      connection.status = 'connected';
      this.connections.set(connectionId, connection);
      
      this.emit('connection:established', connection);
      return connection;
    } catch (error) {
      connection.status = 'error';
      this.emit('connection:error', { connection, error });
      throw error;
    }
  }

  async disconnect(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    try {
      // Close connection pool if exists
      const pool = this.connectionPools.get(connectionId);
      if (pool && pool.end) {
        await pool.end();
      }

      connection.status = 'disconnected';
      this.connections.delete(connectionId);
      this.connectionPools.delete(connectionId);
      this.queryHistory.delete(connectionId);

      this.emit('connection:closed', connection);
    } catch (error) {
      this.emit('connection:error', { connection, error });
      throw error;
    }
  }

  async query(connectionId: string, sql: string, params: any[] = []): Promise<QueryResult> {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== 'connected') {
      throw new Error(`Connection ${connectionId} not available`);
    }

    try {
      // Log query for debugging
      this.logQuery(connectionId, sql, params);
      
      // Simulate query execution based on database type
      const result = await this.executeQuery(connection, sql, params);
      
      connection.lastActivity = new Date();
      this.emit('query:executed', { connectionId, sql, params, result });
      
      return result;
    } catch (error) {
      this.emit('query:error', { connectionId, sql, params, error });
      throw error;
    }
  }

  async transaction(connectionId: string, queries: string[]): Promise<Transaction> {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== 'connected') {
      throw new Error(`Connection ${connectionId} not available`);
    }

    const transaction: Transaction = {
      id: this.generateTransactionId(),
      status: 'active',
      queries,
      startTime: new Date()
    };

    this.activeTransactions.set(transaction.id, transaction);

    try {
      // Begin transaction
      await this.executeQuery(connection, 'BEGIN', []);
      
      // Execute all queries in transaction
      for (const query of queries) {
        await this.executeQuery(connection, query, []);
      }
      
      // Commit transaction
      await this.executeQuery(connection, 'COMMIT', []);
      
      transaction.status = 'committed';
      transaction.endTime = new Date();
      
      this.emit('transaction:committed', transaction);
      return transaction;
    } catch (error) {
      // Rollback on error
      try {
        await this.executeQuery(connection, 'ROLLBACK', []);
        transaction.status = 'rolled_back';
        transaction.endTime = new Date();
      } catch (rollbackError) {
        this.emit('transaction:rollback-error', { transaction, error: rollbackError });
      }
      
      this.emit('transaction:error', { transaction, error });
      throw error;
    } finally {
      this.activeTransactions.delete(transaction.id);
    }
  }

  async migrate(connectionId: string, migrationPath: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== 'connected') {
      throw new Error(`Connection ${connectionId} not available`);
    }

    try {
      // Create migrations table if it doesn't exist
      await this.createMigrationsTable(connection);
      
      // Load and execute migration files
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
    } catch (error) {
      this.emit('migration:error', { connectionId, error });
      throw error;
    }
  }

  async backup(connectionId: string, backupPath: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== 'connected') {
      throw new Error(`Connection ${connectionId} not available`);
    }

    try {
      // Create backup based on database type
      await this.createDatabaseBackup(connection, backupPath);
      
      this.emit('backup:created', { connectionId, backupPath });
    } catch (error) {
      this.emit('backup:error', { connectionId, error });
      throw error;
    }
  }

  getConnections(): DatabaseConnection[] {
    return Array.from(this.connections.values());
  }

  // Helper methods
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTransactionId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async establishConnection(connection: DatabaseConnection): Promise<void> {
    // Simulate connection establishment based on database type
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

  private async connectSQLite(_connection: DatabaseConnection): Promise<void> {
    // Simulate SQLite connection
    await new Promise(resolve => setTimeout(resolve, 100));
    // In a real implementation, you would use sqlite3 library
  }

  private async connectPostgreSQL(_connection: DatabaseConnection): Promise<void> {
    // Simulate PostgreSQL connection
    await new Promise(resolve => setTimeout(resolve, 200));
    // In a real implementation, you would use pg library
  }

  private async connectMySQL(connection: DatabaseConnection): Promise<void> {
    // Simulate MySQL connection
    await new Promise(resolve => setTimeout(resolve, 150));
    // In a real implementation, you would use mysql2 library
  }

  private async connectMongoDB(connection: DatabaseConnection): Promise<void> {
    // Simulate MongoDB connection
    await new Promise(resolve => setTimeout(resolve, 250));
    // In a real implementation, you would use mongodb library
  }

  private async executeQuery(connection: DatabaseConnection, sql: string, params: any[]): Promise<QueryResult> {
    // Simulate query execution
    await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 50));
    
    // Mock result based on query type
    if (sql.toLowerCase().startsWith('select')) {
      return {
        rows: [
          { id: 1, name: 'Sample Record', created_at: new Date() },
          { id: 2, name: 'Another Record', created_at: new Date() }
        ],
        metadata: { queryTime: Math.random() * 100 }
      };
    } else if (sql.toLowerCase().startsWith('insert')) {
      return {
        rows: [],
        affectedRows: 1,
        insertId: Math.floor(Math.random() * 1000),
        metadata: { queryTime: Math.random() * 50 }
      };
    } else {
      return {
        rows: [],
        affectedRows: Math.floor(Math.random() * 5),
        metadata: { queryTime: Math.random() * 30 }
      };
    }
  }

  private logQuery(connectionId: string, sql: string, params: any[]): void {
    const history = this.queryHistory.get(connectionId) || [];
    const queryLog = `${new Date().toISOString()}: ${sql} [${params.join(', ')}]`;
    history.push(queryLog);
    
    // Keep only last 100 queries
    if (history.length > 100) {
      history.shift();
    }
    
    this.queryHistory.set(connectionId, history);
  }

  private async createMigrationsTable(connection: DatabaseConnection): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await this.executeQuery(connection, sql, []);
  }

  private async loadMigrations(migrationPath: string): Promise<Array<{ name: string; sql: string }>> {
    // Simulate loading migration files
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

  private async isMigrationApplied(connection: DatabaseConnection, migrationName: string): Promise<boolean> {
    const result = await this.executeQuery(
      connection,
      'SELECT COUNT(*) as count FROM migrations WHERE name = ?',
      [migrationName]
    );
    return result.rows[0]?.count > 0;
  }

  private async executeMigration(connection: DatabaseConnection, migration: { name: string; sql: string }): Promise<void> {
    await this.executeQuery(connection, migration.sql, []);
  }

  private async recordMigration(connection: DatabaseConnection, migrationName: string): Promise<void> {
    await this.executeQuery(
      connection,
      'INSERT INTO migrations (name) VALUES (?)',
      [migrationName]
    );
  }

  private async createDatabaseBackup(connection: DatabaseConnection, backupPath: string): Promise<void> {
    // Simulate backup creation
    await new Promise(resolve => setTimeout(resolve, 1000));
    // In a real implementation, this would create actual database backups
  }

  // Utility methods
  async getQueryHistory(connectionId: string): Promise<string[]> {
    return this.queryHistory.get(connectionId) || [];
  }

  async getActiveTransactions(): Promise<Transaction[]> {
    return Array.from(this.activeTransactions.values());
  }

  async healthCheck(connectionId: string): Promise<boolean> {
    try {
      await this.query(connectionId, 'SELECT 1 as health_check', []);
      return true;
    } catch {
      return false;
    }
  }

  async getConnectionStats(connectionId: string): Promise<any> {
    const connection = this.connections.get(connectionId);
    const queryHistory = this.queryHistory.get(connectionId) || [];
    
    return {
      connection,
      totalQueries: queryHistory.length,
      lastActivity: connection?.lastActivity,
      status: connection?.status
    };
  }

  /**
   * @deprecated Use DatabaseService instead for new development
   * This method creates a modern DatabaseService for migration purposes
   */
  async upgradeToModernService(): Promise<DatabaseService> {
    console.warn('⚠️ DatabasePersistenceManager is deprecated. Please migrate to DatabaseService.');
    
    // This would help migrate existing code to the new system
    // Implementation would depend on current connection configuration
    throw new Error('Please use DatabaseService directly for new development');
  }
}

/**
 * MIGRATION NOTICE
 * 
 * This DatabasePersistenceManager is deprecated and maintained only for backward compatibility.
 * 
 * For new development, please use:
 * 
 * ```typescript
 * import { DatabaseService, DatabaseSetup } from './database';
 * 
 * // Production setup
 * const dbService = await DatabaseSetup.createProductionService({
 *   host: 'localhost',
 *   port: 5432,
 *   database: 'agentic_revops',
 *   username: 'user',
 *   password: 'password'
 * });
 * 
 * // Use repositories
 * const org = await dbService.organizations.findById('org-id');
 * const swarms = await dbService.swarms.findByOrganization('org-id');
 * 
 * // Use migrations
 * await dbService.runMigrations();
 * ```
 * 
 * Benefits of the new system:
 * - Type-safe entity models with validation
 * - Repository pattern for clean data access
 * - Advanced migration system with rollback support
 * - Built-in caching and performance optimization
 * - Comprehensive monitoring and health checks
 * - Connection pooling and read replica support
 */