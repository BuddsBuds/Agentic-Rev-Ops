"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const connection_1 = require("./connection");
const MigrationManager_1 = require("./migrations/MigrationManager");
const OrganizationRepository_1 = require("./repositories/OrganizationRepository");
const SwarmRepository_1 = require("./repositories/SwarmRepository");
const events_1 = require("events");
class DatabaseService extends events_1.EventEmitter {
    config;
    connection;
    migrationManager;
    repositories;
    cache;
    metrics;
    monitoringInterval;
    healthCheckInterval;
    isInitialized = false;
    constructor(config) {
        super();
        this.config = {
            migrations: {
                path: './migrations',
                autoMigrate: false,
                ...config.migrations
            },
            caching: {
                enabled: true,
                ttl: 300000,
                maxSize: 1000,
                ...config.caching
            },
            monitoring: {
                enabled: true,
                metricsInterval: 60000,
                healthCheckInterval: 30000,
                ...config.monitoring
            },
            ...config
        };
        this.repositories = new Map();
        this.cache = new Map();
        this.metrics = this.initializeMetrics();
    }
    async initialize() {
        if (this.isInitialized) {
            throw new Error('Database service is already initialized');
        }
        try {
            this.connection = await connection_1.DatabaseFactory.create('default', this.config.database);
            this.migrationManager = new MigrationManager_1.MigrationManager(this.connection, this.config.migrations.path);
            await this.migrationManager.initialize();
            if (this.config.migrations.autoMigrate) {
                await this.runMigrations();
            }
            await this.initializeRepositories();
            if (this.config.monitoring.enabled) {
                this.startMonitoring();
            }
            this.isInitialized = true;
            this.emit('database:initialized');
        }
        catch (error) {
            this.emit('database:initialization-error', { error });
            throw error;
        }
    }
    async initializeRepositories() {
        this.repositories.set('organizations', new OrganizationRepository_1.OrganizationRepository(this.connection));
        this.repositories.set('swarms', new SwarmRepository_1.SwarmRepository(this.connection));
        this.emit('repositories:initialized', {
            count: this.repositories.size,
            repositories: Array.from(this.repositories.keys())
        });
    }
    getRepository(name) {
        const repository = this.repositories.get(name);
        if (!repository) {
            throw new Error(`Repository '${name}' not found`);
        }
        return repository;
    }
    get organizations() {
        return this.getRepository('organizations');
    }
    get swarms() {
        return this.getRepository('swarms');
    }
    get db() {
        return this.connection;
    }
    get migrations() {
        return this.migrationManager;
    }
    async runMigrations() {
        try {
            const result = await this.migrationManager.migrate();
            this.emit('migrations:completed', result);
            return result;
        }
        catch (error) {
            this.emit('migrations:error', { error });
            throw error;
        }
    }
    async transaction(callback) {
        return this.connection.transaction(async () => {
            return callback(this);
        });
    }
    async getFromCache(key) {
        if (!this.config.caching.enabled)
            return null;
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
    async setCache(key, data, ttl) {
        if (!this.config.caching.enabled)
            return;
        const expires = Date.now() + (ttl || this.config.caching.ttl);
        if (this.cache.size >= this.config.caching.maxSize) {
            const entries = Array.from(this.cache.entries());
            entries.sort((a, b) => a[1].expires - b[1].expires);
            const toRemove = Math.floor(this.config.caching.maxSize * 0.1);
            for (let i = 0; i < toRemove; i++) {
                this.cache.delete(entries[i][0]);
            }
        }
        this.cache.set(key, { data, expires });
    }
    clearCache(pattern) {
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
    async healthCheck() {
        const checks = [];
        let overallStatus = 'healthy';
        const dbStartTime = Date.now();
        try {
            const isHealthy = await this.connection.isConnectionHealthy();
            checks.push({
                name: 'database_connection',
                status: isHealthy ? 'pass' : 'fail',
                duration: Date.now() - dbStartTime,
                message: isHealthy ? 'Connection is healthy' : 'Connection failed'
            });
            if (!isHealthy)
                overallStatus = 'unhealthy';
        }
        catch (error) {
            checks.push({
                name: 'database_connection',
                status: 'fail',
                duration: Date.now() - dbStartTime,
                message: error instanceof Error ? error.message : String(error)
            });
            overallStatus = 'unhealthy';
        }
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
        }
        catch (error) {
            checks.push({
                name: 'migrations',
                status: 'fail',
                duration: Date.now() - migrationStartTime,
                message: error instanceof Error ? error.message : String(error)
            });
            overallStatus = 'unhealthy';
        }
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
            }
            catch (error) {
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
    getMetrics() {
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
    startMonitoring() {
        this.monitoringInterval = setInterval(() => {
            this.collectMetrics();
            this.emit('metrics:collected', this.getMetrics());
        }, this.config.monitoring.metricsInterval);
        this.healthCheckInterval = setInterval(async () => {
            try {
                const health = await this.healthCheck();
                this.emit('health:checked', health);
                if (health.status === 'unhealthy') {
                    this.emit('health:unhealthy', health);
                }
                else if (health.status === 'degraded') {
                    this.emit('health:degraded', health);
                }
            }
            catch (error) {
                this.emit('health:error', { error });
            }
        }, this.config.monitoring.healthCheckInterval);
    }
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
        }
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = undefined;
        }
    }
    collectMetrics() {
        const memUsage = process.memoryUsage();
        this.metrics.performance.memoryUsage = memUsage.heapUsed / 1024 / 1024;
        if (this.config.caching.enabled) {
            const now = Date.now();
            for (const [key, value] of this.cache) {
                if (now > value.expires) {
                    this.cache.delete(key);
                }
            }
        }
    }
    updateRepositoryMetrics(repository, type) {
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
        }
        else {
            this.metrics.repositories[repository].cacheMisses++;
        }
    }
    initializeMetrics() {
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
    async optimize() {
        const optimizations = [];
        const recommendations = [];
        let timesSaved = 0;
        for (const [name, repository] of this.repositories) {
            try {
                await repository.optimize();
                optimizations.push(`Optimized ${name} repository`);
                timesSaved += 1000;
            }
            catch (error) {
                recommendations.push(`Failed to optimize ${name}: ${error}`);
            }
        }
        if (this.config.caching.enabled) {
            const cacheSize = this.cache.size;
            if (cacheSize > this.config.caching.maxSize * 0.8) {
                recommendations.push('Cache usage is high - consider increasing cache size or TTL');
            }
        }
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
    async backup(backupPath) {
        try {
            await this.connection.backup('default', backupPath);
            this.emit('backup:completed', { path: backupPath });
        }
        catch (error) {
            this.emit('backup:error', { error, path: backupPath });
            throw error;
        }
    }
    async shutdown() {
        this.stopMonitoring();
        try {
            await this.connection.close();
            this.cache.clear();
            this.repositories.clear();
            this.isInitialized = false;
            this.emit('database:shutdown');
        }
        catch (error) {
            this.emit('database:shutdown-error', { error });
            throw error;
        }
    }
    getStatus() {
        return {
            initialized: this.isInitialized,
            connected: this.connection?.isConnectionHealthy() || false,
            repositories: Array.from(this.repositories.keys()),
            cacheEnabled: this.config.caching.enabled,
            monitoringEnabled: this.config.monitoring.enabled
        };
    }
}
exports.DatabaseService = DatabaseService;
exports.default = DatabaseService;
//# sourceMappingURL=DatabaseService.js.map