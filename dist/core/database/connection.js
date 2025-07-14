"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseFactory = exports.DatabaseConnectionManager = void 0;
const pg_1 = require("pg");
const events_1 = require("events");
class DatabaseConnectionManager extends events_1.EventEmitter {
    writePool;
    readPools = new Map();
    config;
    metrics;
    isHealthy = false;
    startTime;
    queryTimes = [];
    constructor(config) {
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
    async initializeConnections() {
        try {
            this.writePool = new pg_1.Pool({
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
            if (this.config.readReplicas) {
                for (const replica of this.config.readReplicas) {
                    const replicaPool = new pg_1.Pool({
                        host: replica.host,
                        port: replica.port,
                        database: this.config.database,
                        user: this.config.username,
                        password: this.config.password,
                        ssl: this.config.ssl,
                        max: Math.floor(this.config.maxConnections / 2),
                        idleTimeoutMillis: this.config.idleTimeoutMs,
                        connectionTimeoutMillis: this.config.connectionTimeoutMs,
                        application_name: `agentic-revops-read-${replica.priority}`
                    });
                    this.readPools.set(`${replica.host}:${replica.port}`, replicaPool);
                }
            }
            this.setupEventHandlers();
            await this.healthCheck();
            this.emit('connected');
        }
        catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
    setupEventHandlers() {
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
        for (const [key, pool] of Array.from(this.readPools)) {
            pool.on('error', (error) => {
                this.emit('replica:error', { replica: key, error });
            });
        }
    }
    async query(text, params, options = {}) {
        const startTime = Date.now();
        this.metrics.totalQueries++;
        try {
            const pool = this.selectPool(options);
            const result = await this.executeWithRetry(pool, text, params, options);
            const queryTime = Date.now() - startTime;
            this.queryTimes.push(queryTime);
            if (this.queryTimes.length > 1000) {
                this.queryTimes.shift();
            }
            this.metrics.averageQueryTime = this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length;
            this.metrics.successfulQueries++;
            this.emit('query:success', { text, duration: queryTime });
            return result;
        }
        catch (error) {
            this.metrics.failedQueries++;
            this.emit('query:error', { text, error, duration: Date.now() - startTime });
            throw error;
        }
    }
    async executeWithRetry(pool, text, params, options = {}) {
        let attempt = 0;
        const maxAttempts = options.retryOnFailure ? this.config.retryAttempts : 1;
        while (attempt < maxAttempts) {
            try {
                const client = await pool.connect();
                try {
                    if (options.timeout) {
                        await client.query('SET statement_timeout = $1', [options.timeout]);
                    }
                    const result = await client.query(text, params);
                    return result;
                }
                finally {
                    client.release();
                }
            }
            catch (error) {
                attempt++;
                if (attempt >= maxAttempts) {
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, this.config.retryDelayMs * attempt));
            }
        }
        throw new Error('Max retry attempts exceeded');
    }
    selectPool(options) {
        if (options.useReadReplica && this.readPools.size > 0) {
            const sortedReplicas = Array.from(this.readPools.entries())
                .map(([key, pool]) => {
                const priority = this.config.readReplicas
                    .find(r => `${r.host}:${r.port}` === key)?.priority || 999;
                return { key, pool, priority };
            })
                .sort((a, b) => a.priority - b.priority);
            return sortedReplicas[0].pool;
        }
        return this.writePool;
    }
    async transaction(callback) {
        const client = await this.writePool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async healthCheck() {
        try {
            await this.writePool.query('SELECT 1');
            for (const pool of Array.from(this.readPools.values())) {
                await pool.query('SELECT 1');
            }
            this.isHealthy = true;
            this.emit('health:healthy');
            return true;
        }
        catch (error) {
            this.isHealthy = false;
            this.emit('health:unhealthy', error);
            return false;
        }
    }
    getMetrics() {
        return {
            ...this.metrics,
            totalConnections: this.writePool.totalCount,
            idleConnections: this.writePool.idleCount,
            waitingClients: this.writePool.waitingCount,
            uptime: Date.now() - this.startTime
        };
    }
    isConnectionHealthy() {
        return this.isHealthy;
    }
    async close() {
        try {
            await this.writePool.end();
            for (const pool of Array.from(this.readPools.values())) {
                await pool.end();
            }
            this.emit('disconnected');
        }
        catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
    async execute(name, text, values, options) {
        const pool = this.selectPool(options || {});
        const client = await pool.connect();
        try {
            await client.query(`PREPARE ${name} AS ${text}`);
            const result = await client.query(`EXECUTE ${name}`, values);
            await client.query(`DEALLOCATE ${name}`);
            return result;
        }
        finally {
            client.release();
        }
    }
    async bulkInsert(tableName, columns, data, schema = 'core') {
        if (data.length === 0)
            return;
        const client = await this.writePool.connect();
        try {
            const placeholders = data.map((_, rowIndex) => `(${columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`).join(', ')})`).join(', ');
            const query = `INSERT INTO ${schema}.${tableName}(${columns.join(', ')}) VALUES ${placeholders}`;
            const values = data.flat();
            await client.query(query, values);
        }
        finally {
            client.release();
        }
    }
    async *streamQuery(text, params, batchSize = 1000) {
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
            const batchQuery = `${text} LIMIT ${batchSize} OFFSET ${offset}`;
            const result = await this.query(batchQuery, params, { useReadReplica: true });
            if (result.rows.length === 0) {
                hasMore = false;
            }
            else {
                yield result.rows;
                offset += batchSize;
                hasMore = result.rows.length === batchSize;
            }
        }
    }
}
exports.DatabaseConnectionManager = DatabaseConnectionManager;
class DatabaseFactory {
    static instances = new Map();
    static async create(name, config) {
        if (this.instances.has(name)) {
            return this.instances.get(name);
        }
        const connection = new DatabaseConnectionManager(config);
        this.instances.set(name, connection);
        return connection;
    }
    static get(name) {
        return this.instances.get(name);
    }
    static async closeAll() {
        const promises = Array.from(this.instances.values()).map(conn => conn.close());
        await Promise.all(promises);
        this.instances.clear();
    }
}
exports.DatabaseFactory = DatabaseFactory;
exports.default = DatabaseConnectionManager;
//# sourceMappingURL=connection.js.map