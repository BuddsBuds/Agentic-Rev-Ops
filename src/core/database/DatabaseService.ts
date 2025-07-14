/**
 * Comprehensive Database Service
 * Central service for managing all database operations, repositories, and migrations
 */

import { DatabaseConnectionManager, DatabaseFactory, DatabaseConfig } from './connection';
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

export class DatabaseService extends EventEmitter {
  private config: DatabaseServiceConfig;
  private connection: DatabaseConnectionManager;
  private migrationManager: MigrationManager;
  private repositories: Map<string, BaseRepository<any>>;
  private cache: Map<string, { data: any; expires: number }>;
  private metrics: DatabaseMetrics;
  private monitoringInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private isInitialized: boolean = false;

  constructor(config: DatabaseServiceConfig) {
    super();
    this.config = {
      migrations: {
        path: './migrations',
        autoMigrate: false,
        ...config.migrations
      },
      caching: {
        enabled: true,
        ttl: 300000, // 5 minutes
        maxSize: 1000,
        ...config.caching
      },
      monitoring: {
        enabled: true,
        metricsInterval: 60000, // 1 minute
        healthCheckInterval: 30000, // 30 seconds
        ...config.monitoring
      },
      ...config
    };

    this.repositories = new Map();
    this.cache = new Map();
    this.metrics = this.initializeMetrics();
  }

  /**
   * Initialize database service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Database service is already initialized');
    }

    try {
      // Initialize database connection
      this.connection = await DatabaseFactory.create('default', this.config.database);
      
      // Initialize migration manager
      this.migrationManager = new MigrationManager(
        this.connection, 
        this.config.migrations!.path
      );
      await this.migrationManager.initialize();

      // Run auto-migrations if enabled
      if (this.config.migrations!.autoMigrate) {
        await this.runMigrations();
      }

      // Initialize repositories
      await this.initializeRepositories();

      // Start monitoring if enabled
      if (this.config.monitoring!.enabled) {
        this.startMonitoring();
      }

      this.isInitialized = true;
      this.emit('database:initialized');
      
    } catch (error) {
      this.emit('database:initialization-error', { error });
      throw error;
    }
  }

  /**
   * Initialize all repositories
   */
  private async initializeRepositories(): Promise<void> {
    // Register core repositories
    this.repositories.set('organizations', new OrganizationRepository(this.connection));
    this.repositories.set('swarms', new SwarmRepository(this.connection));
    
    // Additional repositories can be registered here
    this.emit('repositories:initialized', {
      count: this.repositories.size,
      repositories: Array.from(this.repositories.keys())
    });
  }

  /**
   * Get repository by name
   */
  getRepository<T extends BaseRepository<any>>(name: string): T {
    const repository = this.repositories.get(name);
    if (!repository) {
      throw new Error(`Repository '${name}' not found`);
    }
    return repository as T;
  }

  /**
   * Get organization repository
   */
  get organizations(): OrganizationRepository {
    return this.getRepository<OrganizationRepository>('organizations');
  }

  /**
   * Get swarm repository
   */
  get swarms(): SwarmRepository {
    return this.getRepository<SwarmRepository>('swarms');
  }

  /**
   * Get database connection
   */
  get db(): DatabaseConnectionManager {
    return this.connection;
  }

  /**
   * Get migration manager
   */
  get migrations(): MigrationManager {
    return this.migrationManager;
  }

  /**
   * Run pending migrations
   */
  async runMigrations(): Promise<{ success: boolean; applied: string[]; errors: string[] }> {
    try {
      const result = await this.migrationManager.migrate();
      this.emit('migrations:completed', result);
      return result;
    } catch (error) {
      this.emit('migrations:error', { error });
      throw error;
    }
  }

  /**
   * Execute in transaction across multiple repositories
   */
  async transaction<T>(
    callback: (service: DatabaseService) => Promise<T>
  ): Promise<T> {
    return this.connection.transaction(async () => {
      return callback(this);
    });
  }

  /**
   * Cache management
   */
  async getFromCache<T>(key: string): Promise<T | null> {
    if (!this.config.caching!.enabled) return null;
    
    const cached = this.cache.get(key);
    if (!cached) {
      this.updateRepositoryMetrics('cache', 'miss');
      return null;
    }
    
    if (Date.now() > cached.expires) {
      this.cache.delete(key);
      this.updateRepositoryMetrics('cache', 'miss');
      return null;
    }
    
    this.updateRepositoryMetrics('cache', 'hit');
    return cached.data;
  }

  async setCache(key: string, data: any, ttl?: number): Promise<void> {
    if (!this.config.caching!.enabled) return;
    
    const expires = Date.now() + (ttl || this.config.caching!.ttl);
    
    // Check cache size limit
    if (this.cache.size >= this.config.caching!.maxSize) {
      // Remove oldest entries
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].expires - b[1].expires);
      const toRemove = Math.floor(this.config.caching!.maxSize * 0.1); // Remove 10%
      
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
    
    this.cache.set(key, { data, expires });
  }

  clearCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    
    const regex = new RegExp(pattern);
    for (const [key] of this.cache) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Array<{
      name: string;
      status: 'pass' | 'fail';
      duration: number;
      message?: string;
    }>;
    metrics: DatabaseMetrics;
  }> {
    const checks = [];
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    // Database connection check
    const dbStartTime = Date.now();
    try {
      const isHealthy = await this.connection.isConnectionHealthy();
      checks.push({
        name: 'database_connection',
        status: isHealthy ? 'pass' : 'fail',
        duration: Date.now() - dbStartTime,
        message: isHealthy ? 'Connection is healthy' : 'Connection failed'
      });
      
      if (!isHealthy) overallStatus = 'unhealthy';
    } catch (error) {
      checks.push({
        name: 'database_connection',
        status: 'fail',
        duration: Date.now() - dbStartTime,
        message: error instanceof Error ? error.message : String(error)
      });
      overallStatus = 'unhealthy';
    }
    
    // Migration status check
    const migrationStartTime = Date.now();
    try {
      const migrationStatus = await this.migrationManager.getStatus();
      const hasPending = migrationStatus.pendingCount > 0;
      const isHealthy = migrationStatus.health === 'healthy';
      
      checks.push({
        name: 'migrations',
        status: isHealthy && !hasPending ? 'pass' : 'fail',
        duration: Date.now() - migrationStartTime,
        message: `${migrationStatus.appliedCount} applied, ${migrationStatus.pendingCount} pending`
      });
      
      if (!isHealthy || hasPending) {
        overallStatus = overallStatus === 'unhealthy' ? 'unhealthy' : 'degraded';
      }
    } catch (error) {
      checks.push({
        name: 'migrations',
        status: 'fail',
        duration: Date.now() - migrationStartTime,
        message: error instanceof Error ? error.message : String(error)
      });
      overallStatus = 'unhealthy';
    }
    
    // Repository health checks
    for (const [name, repository] of this.repositories) {
      const repoStartTime = Date.now();
      try {
        const stats = await repository.getTableStats();
        checks.push({
          name: `repository_${name}`,
          status: 'pass',
          duration: Date.now() - repoStartTime,
          message: `${stats.activeRows} active records`
        });
      } catch (error) {
        checks.push({
          name: `repository_${name}`,
          status: 'fail',
          duration: Date.now() - repoStartTime,
          message: error instanceof Error ? error.message : String(error)
        });
        overallStatus = overallStatus === 'unhealthy' ? 'unhealthy' : 'degraded';
      }
    }
    
    return {
      status: overallStatus,
      checks,
      metrics: this.getMetrics()
    };
  }

  /**
   * Get current metrics
   */
  getMetrics(): DatabaseMetrics {
    const dbMetrics = this.connection.getMetrics();
    
    this.metrics.connections = {
      total: dbMetrics.totalConnections,
      active: dbMetrics.totalConnections - dbMetrics.idleConnections,
      idle: dbMetrics.idleConnections,
      waiting: dbMetrics.waitingClients
    };
    
    this.metrics.queries = {
      total: dbMetrics.totalQueries,
      successful: dbMetrics.successfulQueries,
      failed: dbMetrics.failedQueries,
      avgExecutionTime: dbMetrics.averageQueryTime
    };
    
    this.metrics.performance.uptime = dbMetrics.uptime;
    
    return { ...this.metrics };
  }

  /**
   * Start monitoring
   */
  private startMonitoring(): void {
    // Metrics collection
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.emit('metrics:collected', this.getMetrics());
    }, this.config.monitoring!.metricsInterval);
    
    // Health checks
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.healthCheck();
        this.emit('health:checked', health);
        
        if (health.status === 'unhealthy') {
          this.emit('health:unhealthy', health);
        } else if (health.status === 'degraded') {
          this.emit('health:degraded', health);
        }
      } catch (error) {
        this.emit('health:error', { error });
      }
    }, this.config.monitoring!.healthCheckInterval);
  }

  /**
   * Stop monitoring
   */
  private stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  /**
   * Collect metrics
   */
  private collectMetrics(): void {
    // Update memory usage
    const memUsage = process.memoryUsage();
    this.metrics.performance.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB
    
    // Clean expired cache entries
    if (this.config.caching!.enabled) {
      const now = Date.now();
      for (const [key, value] of this.cache) {
        if (now > value.expires) {
          this.cache.delete(key);
        }
      }
    }
  }

  /**
   * Update repository metrics
   */
  private updateRepositoryMetrics(repository: string, type: 'hit' | 'miss'): void {
    if (!this.metrics.repositories[repository]) {
      this.metrics.repositories[repository] = {
        totalQueries: 0,
        cacheHits: 0,
        cacheMisses: 0
      };
    }
    
    this.metrics.repositories[repository].totalQueries++;
    
    if (type === 'hit') {
      this.metrics.repositories[repository].cacheHits++;
    } else {
      this.metrics.repositories[repository].cacheMisses++;
    }
  }

  /**
   * Initialize metrics structure
   */
  private initializeMetrics(): DatabaseMetrics {
    return {
      connections: {
        total: 0,
        active: 0,
        idle: 0,
        waiting: 0
      },
      queries: {
        total: 0,
        successful: 0,
        failed: 0,
        avgExecutionTime: 0
      },
      performance: {
        uptime: 0,
        memoryUsage: 0,
        cpuUsage: 0
      },
      repositories: {}
    };
  }

  /**
   * Optimize database performance
   */
  async optimize(): Promise<{
    optimizations: string[];
    timesSaved: number;
    recommendations: string[];
  }> {
    const optimizations: string[] = [];
    const recommendations: string[] = [];
    let timesSaved = 0;
    
    // Optimize each repository
    for (const [name, repository] of this.repositories) {
      try {
        await repository.optimize();
        optimizations.push(`Optimized ${name} repository`);
        timesSaved += 1000; // Estimated time saved in ms
      } catch (error) {
        recommendations.push(`Failed to optimize ${name}: ${error}`);
      }
    }
    
    // Cache optimization
    if (this.config.caching!.enabled) {
      const cacheSize = this.cache.size;
      if (cacheSize > this.config.caching!.maxSize * 0.8) {
        recommendations.push('Cache usage is high - consider increasing cache size or TTL');
      }
    }
    
    // Connection pool optimization
    const metrics = this.getMetrics();
    if (metrics.connections.waiting > 0) {
      recommendations.push('Connection pool exhaustion detected - consider increasing max connections');
    }
    
    return {
      optimizations,
      timesSaved,
      recommendations
    };
  }

  /**
   * Backup database
   */
  async backup(backupPath: string): Promise<void> {
    try {
      await this.connection.backup('default', backupPath);
      this.emit('backup:completed', { path: backupPath });
    } catch (error) {
      this.emit('backup:error', { error, path: backupPath });
      throw error;
    }
  }

  /**
   * Shutdown database service
   */
  async shutdown(): Promise<void> {
    this.stopMonitoring();
    
    try {
      await this.connection.close();
      this.cache.clear();
      this.repositories.clear();
      this.isInitialized = false;
      
      this.emit('database:shutdown');
    } catch (error) {
      this.emit('database:shutdown-error', { error });
      throw error;
    }
  }

  /**
   * Get service status
   */
  getStatus(): {
    initialized: boolean;
    connected: boolean;
    repositories: string[];
    cacheEnabled: boolean;
    monitoringEnabled: boolean;
  } {
    return {
      initialized: this.isInitialized,
      connected: this.connection?.isConnectionHealthy() || false,
      repositories: Array.from(this.repositories.keys()),
      cacheEnabled: this.config.caching!.enabled,
      monitoringEnabled: this.config.monitoring!.enabled
    };
  }
}

export default DatabaseService;