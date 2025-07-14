/**
 * Database Connection Manager
 * Handles PostgreSQL connections with connection pooling, health checks, and failover
 */

import { Pool, PoolClient, QueryResult } from 'pg';
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
  priority: number; // 1 = highest priority
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

export class DatabaseConnectionManager extends EventEmitter {
  private writePool: Pool;
  private readPools: Map<string, Pool> = new Map();
  private config: DatabaseConfig;
  private metrics: DatabaseMetrics;
  private isHealthy: boolean = false;
  private startTime: number;
  private queryTimes: number[] = [];
  
  constructor(config: DatabaseConfig) {
    super();
    this.config = {
      maxConnections: 20,
      idleTimeoutMs: 30000,
      connectionTimeoutMs: 5000,
      retryAttempts: 3,
      retryDelayMs: 1000,
      ...config
    };
    
    this.startTime = Date.now();
    this.metrics = {
      totalConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      averageQueryTime: 0,
      uptime: 0
    };
    
    this.initializeConnections();
  }

  /**
   * Initialize database connections
   */
  private async initializeConnections(): Promise<void> {
    try {
      // Initialize write pool
      this.writePool = new Pool({
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.username,
        password: this.config.password,
        ssl: this.config.ssl,
        max: this.config.maxConnections,
        idleTimeoutMillis: this.config.idleTimeoutMs,
        connectionTimeoutMillis: this.config.connectionTimeoutMs,
        application_name: 'agentic-revops-write'
      });

      // Initialize read replica pools
      if (this.config.readReplicas) {
        for (const replica of this.config.readReplicas) {
          const replicaPool = new Pool({
            host: replica.host,
            port: replica.port,
            database: this.config.database,
            user: this.config.username,
            password: this.config.password,
            ssl: this.config.ssl,
            max: Math.floor(this.config.maxConnections! / 2),
            idleTimeoutMillis: this.config.idleTimeoutMs,
            connectionTimeoutMillis: this.config.connectionTimeoutMs,
            application_name: `agentic-revops-read-${replica.priority}`
          });
          
          this.readPools.set(`${replica.host}:${replica.port}`, replicaPool);
        }
      }

      // Set up event handlers
      this.setupEventHandlers();
      
      // Perform initial health check
      await this.healthCheck();
      
      this.emit('connected');
      
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Set up pool event handlers
   */
  private setupEventHandlers(): void {
    this.writePool.on('connect', () => {
      this.metrics.totalConnections++;
      this.emit('connection:acquired');
    });

    this.writePool.on('remove', () => {
      this.metrics.totalConnections--;
      this.emit('connection:released');
    });

    this.writePool.on('error', (error) => {
      this.emit('error', error);
    });

    // Set up handlers for read replicas
    for (const [key, pool] of Array.from(this.readPools)) {
      pool.on('error', (error) => {
        this.emit('replica:error', { replica: key, error });
      });
    }
  }

  /**
   * Execute a query with options
   */
  async query<T = any>(
    text: string, 
    params?: any[], 
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();
    this.metrics.totalQueries++;
    
    try {
      const pool = this.selectPool(options);
      const result = await this.executeWithRetry(pool, text, params, options);
      
      // Track metrics
      const queryTime = Date.now() - startTime;
      this.queryTimes.push(queryTime);
      if (this.queryTimes.length > 1000) {
        this.queryTimes.shift();
      }
      this.metrics.averageQueryTime = this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length;
      this.metrics.successfulQueries++;
      
      this.emit('query:success', { text, duration: queryTime });
      
      return result;
      
    } catch (error) {
      this.metrics.failedQueries++;
      this.emit('query:error', { text, error, duration: Date.now() - startTime });
      throw error;
    }
  }

  /**
   * Execute query with retry logic
   */
  private async executeWithRetry<T = any>(
    pool: Pool,
    text: string,
    params?: any[],
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    let attempt = 0;
    const maxAttempts = options.retryOnFailure ? this.config.retryAttempts! : 1;
    
    while (attempt < maxAttempts) {
      try {
        const client = await pool.connect();
        
        try {
          // Set query timeout if specified
          if (options.timeout) {
            await client.query('SET statement_timeout = $1', [options.timeout]);
          }
          
          const result = await client.query<T>(text, params);
          return result;
          
        } finally {
          client.release();
        }
        
      } catch (error) {
        attempt++;
        
        if (attempt >= maxAttempts) {
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelayMs! * attempt));
      }
    }
    
    throw new Error('Max retry attempts exceeded');
  }

  /**
   * Select appropriate pool based on options
   */
  private selectPool(options: QueryOptions): Pool {
    if (options.useReadReplica && this.readPools.size > 0) {
      // Select read replica with highest priority (lowest number)
      const sortedReplicas = Array.from(this.readPools.entries())
        .map(([key, pool]) => {
          const priority = this.config.readReplicas!
            .find(r => `${r.host}:${r.port}` === key)?.priority || 999;
          return { key, pool, priority };
        })
        .sort((a, b) => a.priority - b.priority);
      
      return sortedReplicas[0].pool;
    }
    
    return this.writePool;
  }

  /**
   * Begin a transaction
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.writePool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
      
    } finally {
      client.release();
    }
  }

  /**
   * Perform health check on all connections
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check write pool
      await this.writePool.query('SELECT 1');
      
      // Check read replicas
      for (const pool of Array.from(this.readPools.values())) {
        await pool.query('SELECT 1');
      }
      
      this.isHealthy = true;
      this.emit('health:healthy');
      return true;
      
    } catch (error) {
      this.isHealthy = false;
      this.emit('health:unhealthy', error);
      return false;
    }
  }

  /**
   * Get current database metrics
   */
  getMetrics(): DatabaseMetrics {
    return {
      ...this.metrics,
      totalConnections: this.writePool.totalCount,
      idleConnections: this.writePool.idleCount,
      waitingClients: this.writePool.waitingCount,
      uptime: Date.now() - this.startTime
    };
  }

  /**
   * Get health status
   */
  isConnectionHealthy(): boolean {
    return this.isHealthy;
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    try {
      await this.writePool.end();
      
      for (const pool of Array.from(this.readPools.values())) {
        await pool.end();
      }
      
      this.emit('disconnected');
      
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Utility methods for common operations
   */

  /**
   * Execute a prepared statement
   */
  async execute<T = any>(
    name: string,
    text: string,
    values?: any[],
    options?: QueryOptions
  ): Promise<QueryResult<T>> {
    const pool = this.selectPool(options || {});
    const client = await pool.connect();
    
    try {
      await client.query(`PREPARE ${name} AS ${text}`);
      const result = await client.query<T>(`EXECUTE ${name}`, values);
      await client.query(`DEALLOCATE ${name}`);
      return result;
      
    } finally {
      client.release();
    }
  }

  /**
   * Bulk insert with batch INSERT for performance
   */
  async bulkInsert(
    tableName: string,
    columns: string[],
    data: any[][],
    schema: string = 'core'
  ): Promise<void> {
    if (data.length === 0) return;
    
    const client = await this.writePool.connect();
    
    try {
      const placeholders = data.map((_, rowIndex) => 
        `(${columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`).join(', ')})`
      ).join(', ');
      
      const query = `INSERT INTO ${schema}.${tableName}(${columns.join(', ')}) VALUES ${placeholders}`;
      const values = data.flat();
      
      await client.query(query, values);
      
    } finally {
      client.release();
    }
  }

  /**
   * Stream query results for large datasets using LIMIT/OFFSET
   */
  async *streamQuery<T = any>(
    text: string,
    params?: any[],
    batchSize: number = 1000
  ): AsyncGenerator<T[], void, unknown> {
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
      const batchQuery = `${text} LIMIT ${batchSize} OFFSET ${offset}`;
      const result = await this.query<T>(batchQuery, params, { useReadReplica: true });
      
      if (result.rows.length === 0) {
        hasMore = false;
      } else {
        yield result.rows;
        offset += batchSize;
        hasMore = result.rows.length === batchSize;
      }
    }
  }
}

/**
 * Database factory for creating connections
 */
export class DatabaseFactory {
  private static instances: Map<string, DatabaseConnectionManager> = new Map();
  
  static async create(
    name: string,
    config: DatabaseConfig
  ): Promise<DatabaseConnectionManager> {
    if (this.instances.has(name)) {
      return this.instances.get(name)!;
    }
    
    const connection = new DatabaseConnectionManager(config);
    this.instances.set(name, connection);
    
    return connection;
  }
  
  static get(name: string): DatabaseConnectionManager | undefined {
    return this.instances.get(name);
  }
  
  static async closeAll(): Promise<void> {
    const promises = Array.from(this.instances.values()).map(conn => conn.close());
    await Promise.all(promises);
    this.instances.clear();
  }
}

export default DatabaseConnectionManager;