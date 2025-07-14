/**
 * Database Persistence Layer - Main Export File
 * Comprehensive database architecture with ORM, migrations, and repository patterns
 */

// Core database connection and management
export { 
  DatabaseConnectionManager, 
  DatabaseFactory, 
  type DatabaseConfig,
  type DatabaseMetrics as ConnectionMetrics
} from './connection';

// Base entity and repository patterns
export { BaseEntity, type BaseEntityData, type FindOptions, type PaginatedResult } from './entities/base';
export { BaseRepository, SQLQueryBuilder, type RepositoryOptions, type QueryBuilder } from './repositories/BaseRepository';

// Entity models
export { Organization, type OrganizationData } from './entities/Organization';
export { User, type UserData, type UserSession } from './entities/User';
export { SwarmConfiguration, type SwarmConfigurationData, type AgentAssignment } from './entities/SwarmConfiguration';

// Repository implementations
export { OrganizationRepository } from './repositories/OrganizationRepository';
export { SwarmRepository, type SwarmMetrics, type DecisionAnalytics } from './repositories/SwarmRepository';

// Migration system
export { MigrationManager, type Migration, type MigrationRecord, type MigrationPlan } from './migrations/MigrationManager';
export { MigrationCLI, MigrationCLIRunner, type MigrationCLIOptions } from './migrations/MigrationCLI';

// Comprehensive database service
export { DatabaseService, type DatabaseServiceConfig, type DatabaseMetrics } from './DatabaseService';

// Legacy support for existing DatabaseManager
export { DatabasePersistenceManager } from './DatabaseManager';

/**
 * Quick Setup Helper
 * Provides easy setup for common database configurations
 */
export class DatabaseSetup {
  /**
   * Create a production-ready database service
   */
  static async createProductionService(config: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl?: boolean;
    maxConnections?: number;
    readReplicas?: Array<{ host: string; port: number; priority: number }>;
  }): Promise<DatabaseService> {
    const dbService = new DatabaseService({
      database: {
        host: config.host,
        port: config.port,
        database: config.database,
        username: config.username,
        password: config.password,
        ssl: config.ssl ?? true,
        maxConnections: config.maxConnections ?? 20,
        readReplicas: config.readReplicas
      },
      migrations: {
        autoMigrate: false, // Manual migration in production
        path: './src/core/database/migrations'
      },
      caching: {
        enabled: true,
        ttl: 300000, // 5 minutes
        maxSize: 5000
      },
      monitoring: {
        enabled: true,
        metricsInterval: 60000, // 1 minute
        healthCheckInterval: 30000 // 30 seconds
      }
    });

    await dbService.initialize();
    return dbService;
  }

  /**
   * Create a development database service
   */
  static async createDevelopmentService(config: {
    host?: string;
    port?: number;
    database: string;
    username?: string;
    password?: string;
  }): Promise<DatabaseService> {
    const dbService = new DatabaseService({
      database: {
        host: config.host ?? 'localhost',
        port: config.port ?? 5432,
        database: config.database,
        username: config.username ?? 'postgres',
        password: config.password ?? 'postgres',
        ssl: false,
        maxConnections: 10
      },
      migrations: {
        autoMigrate: true, // Auto-migrate in development
        path: './src/core/database/migrations'
      },
      caching: {
        enabled: true,
        ttl: 60000, // 1 minute
        maxSize: 1000
      },
      monitoring: {
        enabled: true,
        metricsInterval: 30000, // 30 seconds
        healthCheckInterval: 15000 // 15 seconds
      }
    });

    await dbService.initialize();
    return dbService;
  }

  /**
   * Create a testing database service
   */
  static async createTestService(config: {
    database: string;
    cleanup?: boolean;
  }): Promise<DatabaseService> {
    const dbService = new DatabaseService({
      database: {
        host: 'localhost',
        port: 5432,
        database: config.database,
        username: 'postgres',
        password: 'postgres',
        ssl: false,
        maxConnections: 5
      },
      migrations: {
        autoMigrate: true,
        path: './src/core/database/migrations'
      },
      caching: {
        enabled: false // Disable caching in tests
      },
      monitoring: {
        enabled: false // Disable monitoring in tests
      }
    });

    await dbService.initialize();

    // Clean up after tests if requested
    if (config.cleanup) {
      const originalShutdown = dbService.shutdown.bind(dbService);
      dbService.shutdown = async () => {
        // Add cleanup logic here if needed
        await originalShutdown();
      };
    }

    return dbService;
  }

  /**
   * Create repository-only service (no migrations/monitoring)
   */
  static async createRepositoryService(connectionManager: DatabaseConnectionManager): Promise<{
    organizations: OrganizationRepository;
    swarms: SwarmRepository;
  }> {
    return {
      organizations: new OrganizationRepository(connectionManager),
      swarms: new SwarmRepository(connectionManager)
    };
  }
}

/**
 * Database Health Monitor
 * Utility class for monitoring database health across multiple services
 */
export class DatabaseHealthMonitor {
  private services: Map<string, DatabaseService> = new Map();
  private monitoringInterval?: NodeJS.Timeout;

  /**
   * Register a database service for monitoring
   */
  register(name: string, service: DatabaseService): void {
    this.services.set(name, service);
    
    // Set up event listeners
    service.on('health:unhealthy', (data) => {
      console.error(`❌ Database service '${name}' is unhealthy:`, data);
    });
    
    service.on('health:degraded', (data) => {
      console.warn(`⚠️ Database service '${name}' is degraded:`, data);
    });
  }

  /**
   * Start monitoring all registered services
   */
  startMonitoring(intervalMs: number = 60000): void {
    this.monitoringInterval = setInterval(async () => {
      const healthReports = await Promise.all(
        Array.from(this.services.entries()).map(async ([name, service]) => {
          try {
            const health = await service.healthCheck();
            return { name, health };
          } catch (error) {
            return { 
              name, 
              health: { 
                status: 'unhealthy' as const, 
                error: error instanceof Error ? error.message : String(error) 
              } 
            };
          }
        })
      );

      const unhealthyServices = healthReports.filter(r => r.health.status === 'unhealthy');
      const degradedServices = healthReports.filter(r => r.health.status === 'degraded');

      if (unhealthyServices.length > 0) {
        console.error(`🚨 ${unhealthyServices.length} database services are unhealthy`);
      }

      if (degradedServices.length > 0) {
        console.warn(`⚠️ ${degradedServices.length} database services are degraded`);
      }
    }, intervalMs);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  /**
   * Get health summary for all services
   */
  async getHealthSummary(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    services: Array<{
      name: string;
      status: 'healthy' | 'degraded' | 'unhealthy';
      details?: any;
    }>;
  }> {
    const results = await Promise.all(
      Array.from(this.services.entries()).map(async ([name, service]) => {
        try {
          const health = await service.healthCheck();
          return { name, status: health.status, details: health };
        } catch (error) {
          return { 
            name, 
            status: 'unhealthy' as const, 
            details: { error: error instanceof Error ? error.message : String(error) } 
          };
        }
      })
    );

    const hasUnhealthy = results.some(r => r.status === 'unhealthy');
    const hasDegraded = results.some(r => r.status === 'degraded');

    const overall = hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy';

    return {
      overall,
      services: results
    };
  }
}

/**
 * Default export for convenience
 */
export default DatabaseService;