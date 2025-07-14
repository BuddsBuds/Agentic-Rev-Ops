"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseHealthMonitor = exports.DatabaseSetup = exports.DatabasePersistenceManager = exports.DatabaseService = exports.MigrationCLIRunner = exports.MigrationCLI = exports.MigrationManager = exports.SwarmRepository = exports.OrganizationRepository = exports.SwarmConfiguration = exports.User = exports.Organization = exports.SQLQueryBuilder = exports.BaseRepository = exports.BaseEntity = exports.DatabaseFactory = exports.DatabaseConnectionManager = void 0;
var connection_1 = require("./connection");
Object.defineProperty(exports, "DatabaseConnectionManager", { enumerable: true, get: function () { return connection_1.DatabaseConnectionManager; } });
Object.defineProperty(exports, "DatabaseFactory", { enumerable: true, get: function () { return connection_1.DatabaseFactory; } });
var base_1 = require("./entities/base");
Object.defineProperty(exports, "BaseEntity", { enumerable: true, get: function () { return base_1.BaseEntity; } });
var BaseRepository_1 = require("./repositories/BaseRepository");
Object.defineProperty(exports, "BaseRepository", { enumerable: true, get: function () { return BaseRepository_1.BaseRepository; } });
Object.defineProperty(exports, "SQLQueryBuilder", { enumerable: true, get: function () { return BaseRepository_1.SQLQueryBuilder; } });
var Organization_1 = require("./entities/Organization");
Object.defineProperty(exports, "Organization", { enumerable: true, get: function () { return Organization_1.Organization; } });
var User_1 = require("./entities/User");
Object.defineProperty(exports, "User", { enumerable: true, get: function () { return User_1.User; } });
var SwarmConfiguration_1 = require("./entities/SwarmConfiguration");
Object.defineProperty(exports, "SwarmConfiguration", { enumerable: true, get: function () { return SwarmConfiguration_1.SwarmConfiguration; } });
var OrganizationRepository_1 = require("./repositories/OrganizationRepository");
Object.defineProperty(exports, "OrganizationRepository", { enumerable: true, get: function () { return OrganizationRepository_1.OrganizationRepository; } });
var SwarmRepository_1 = require("./repositories/SwarmRepository");
Object.defineProperty(exports, "SwarmRepository", { enumerable: true, get: function () { return SwarmRepository_1.SwarmRepository; } });
var MigrationManager_1 = require("./migrations/MigrationManager");
Object.defineProperty(exports, "MigrationManager", { enumerable: true, get: function () { return MigrationManager_1.MigrationManager; } });
var MigrationCLI_1 = require("./migrations/MigrationCLI");
Object.defineProperty(exports, "MigrationCLI", { enumerable: true, get: function () { return MigrationCLI_1.MigrationCLI; } });
Object.defineProperty(exports, "MigrationCLIRunner", { enumerable: true, get: function () { return MigrationCLI_1.MigrationCLIRunner; } });
var DatabaseService_1 = require("./DatabaseService");
Object.defineProperty(exports, "DatabaseService", { enumerable: true, get: function () { return DatabaseService_1.DatabaseService; } });
var DatabaseManager_1 = require("./DatabaseManager");
Object.defineProperty(exports, "DatabasePersistenceManager", { enumerable: true, get: function () { return DatabaseManager_1.DatabasePersistenceManager; } });
class DatabaseSetup {
    static async createProductionService(config) {
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
                autoMigrate: false,
                path: './src/core/database/migrations'
            },
            caching: {
                enabled: true,
                ttl: 300000,
                maxSize: 5000
            },
            monitoring: {
                enabled: true,
                metricsInterval: 60000,
                healthCheckInterval: 30000
            }
        });
        await dbService.initialize();
        return dbService;
    }
    static async createDevelopmentService(config) {
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
                autoMigrate: true,
                path: './src/core/database/migrations'
            },
            caching: {
                enabled: true,
                ttl: 60000,
                maxSize: 1000
            },
            monitoring: {
                enabled: true,
                metricsInterval: 30000,
                healthCheckInterval: 15000
            }
        });
        await dbService.initialize();
        return dbService;
    }
    static async createTestService(config) {
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
                enabled: false
            },
            monitoring: {
                enabled: false
            }
        });
        await dbService.initialize();
        if (config.cleanup) {
            const originalShutdown = dbService.shutdown.bind(dbService);
            dbService.shutdown = async () => {
                await originalShutdown();
            };
        }
        return dbService;
    }
    static async createRepositoryService(connectionManager) {
        return {
            organizations: new OrganizationRepository(connectionManager),
            swarms: new SwarmRepository(connectionManager)
        };
    }
}
exports.DatabaseSetup = DatabaseSetup;
class DatabaseHealthMonitor {
    services = new Map();
    monitoringInterval;
    register(name, service) {
        this.services.set(name, service);
        service.on('health:unhealthy', (data) => {
            console.error(`❌ Database service '${name}' is unhealthy:`, data);
        });
        service.on('health:degraded', (data) => {
            console.warn(`⚠️ Database service '${name}' is degraded:`, data);
        });
    }
    startMonitoring(intervalMs = 60000) {
        this.monitoringInterval = setInterval(async () => {
            const healthReports = await Promise.all(Array.from(this.services.entries()).map(async ([name, service]) => {
                try {
                    const health = await service.healthCheck();
                    return { name, health };
                }
                catch (error) {
                    return {
                        name,
                        health: {
                            status: 'unhealthy',
                            error: error instanceof Error ? error.message : String(error)
                        }
                    };
                }
            }));
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
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
        }
    }
    async getHealthSummary() {
        const results = await Promise.all(Array.from(this.services.entries()).map(async ([name, service]) => {
            try {
                const health = await service.healthCheck();
                return { name, status: health.status, details: health };
            }
            catch (error) {
                return {
                    name,
                    status: 'unhealthy',
                    details: { error: error instanceof Error ? error.message : String(error) }
                };
            }
        }));
        const hasUnhealthy = results.some(r => r.status === 'unhealthy');
        const hasDegraded = results.some(r => r.status === 'degraded');
        const overall = hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy';
        return {
            overall,
            services: results
        };
    }
}
exports.DatabaseHealthMonitor = DatabaseHealthMonitor;
exports.default = DatabaseService;
//# sourceMappingURL=index.js.map