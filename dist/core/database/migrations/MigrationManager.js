"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationManager = void 0;
const events_1 = require("events");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class MigrationManager extends events_1.EventEmitter {
    db;
    migrationsPath;
    migrationTable = 'schema_migrations';
    lockTable = 'migration_locks';
    constructor(db, migrationsPath = './migrations') {
        super();
        this.db = db;
        this.migrationsPath = migrationsPath;
    }
    async initialize() {
        await this.createMigrationTables();
        await this.ensureMigrationLock();
        this.emit('migration:initialized');
    }
    async createMigrationTables() {
        const migrationTableSQL = `
      CREATE TABLE IF NOT EXISTS ${this.migrationTable} (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        migration_id VARCHAR(255) NOT NULL UNIQUE,
        version VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        execution_time_ms INTEGER NOT NULL,
        status VARCHAR(20) DEFAULT 'applied',
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_version ON ${this.migrationTable}(version);
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at ON ${this.migrationTable}(applied_at);
    `;
        const lockTableSQL = `
      CREATE TABLE IF NOT EXISTS ${this.lockTable} (
        id SERIAL PRIMARY KEY,
        lock_key VARCHAR(255) NOT NULL UNIQUE,
        acquired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        acquired_by VARCHAR(255),
        expires_at TIMESTAMP WITH TIME ZONE
      );
    `;
        await this.db.query(migrationTableSQL);
        await this.db.query(lockTableSQL);
    }
    async acquireLock(timeoutMs = 300000) {
        const lockKey = 'migration_lock';
        const expiresAt = new Date(Date.now() + timeoutMs);
        const acquiredBy = `${process.pid}-${Date.now()}`;
        try {
            const result = await this.db.query(`
        INSERT INTO ${this.lockTable} (lock_key, acquired_by, expires_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (lock_key) DO UPDATE SET
          acquired_by = EXCLUDED.acquired_by,
          acquired_at = NOW(),
          expires_at = EXCLUDED.expires_at
        WHERE ${this.lockTable}.expires_at < NOW()
        RETURNING id
      `, [lockKey, acquiredBy, expiresAt]);
            return result.rows.length > 0;
        }
        catch (error) {
            this.emit('migration:lock-failed', { error });
            return false;
        }
    }
    async releaseLock() {
        await this.db.query(`DELETE FROM ${this.lockTable} WHERE lock_key = 'migration_lock'`);
    }
    async ensureMigrationLock() {
        await this.db.query(`
      DELETE FROM ${this.lockTable} 
      WHERE expires_at < NOW()
    `);
    }
    async loadMigrations() {
        try {
            const files = await fs.readdir(this.migrationsPath);
            const migrationFiles = files
                .filter(file => file.endsWith('.sql') || file.endsWith('.js') || file.endsWith('.ts'))
                .sort();
            const migrations = [];
            for (const file of migrationFiles) {
                const migration = await this.loadMigrationFile(file);
                if (migration) {
                    migrations.push(migration);
                }
            }
            return migrations;
        }
        catch (error) {
            this.emit('migration:load-error', { error });
            throw new Error(`Failed to load migrations: ${error}`);
        }
    }
    async loadMigrationFile(filename) {
        const filePath = path.join(this.migrationsPath, filename);
        try {
            if (filename.endsWith('.sql')) {
                return this.loadSQLMigration(filePath, filename);
            }
            else if (filename.endsWith('.js') || filename.endsWith('.ts')) {
                return this.loadJSMigration(filePath, filename);
            }
            return null;
        }
        catch (error) {
            this.emit('migration:file-error', { filename, error });
            throw error;
        }
    }
    async loadSQLMigration(filePath, filename) {
        const content = await fs.readFile(filePath, 'utf8');
        const parts = content.split('-- DOWN');
        if (parts.length !== 2) {
            throw new Error(`Invalid migration format in ${filename}. Must contain -- DOWN separator.`);
        }
        const up = parts[0].replace(/^-- UP\s*/m, '').trim();
        const down = parts[1].trim();
        const metadataMatch = content.match(/^-- Migration: (.+)\n-- Version: (.+)\n-- Description: (.+)/m);
        const migration = {
            id: this.generateMigrationId(filename),
            name: metadataMatch?.[1] || filename.replace(/\.\w+$/, ''),
            version: metadataMatch?.[2] || this.extractVersionFromFilename(filename),
            description: metadataMatch?.[3] || '',
            up,
            down,
            checksum: this.calculateChecksum(content),
            created_at: new Date()
        };
        return migration;
    }
    async loadJSMigration(filePath, filename) {
        const migrationModule = require(filePath);
        if (!migrationModule.up || !migrationModule.down) {
            throw new Error(`Migration ${filename} must export 'up' and 'down' functions`);
        }
        const migration = {
            id: this.generateMigrationId(filename),
            name: migrationModule.name || filename.replace(/\.\w+$/, ''),
            version: migrationModule.version || this.extractVersionFromFilename(filename),
            description: migrationModule.description || '',
            up: migrationModule.up.toString(),
            down: migrationModule.down.toString(),
            dependencies: migrationModule.dependencies,
            checksum: this.calculateChecksum(JSON.stringify(migrationModule)),
            created_at: new Date()
        };
        return migration;
    }
    async getPendingMigrations() {
        const allMigrations = await this.loadMigrations();
        const appliedMigrations = await this.getAppliedMigrations();
        const appliedIds = new Set(appliedMigrations.map(m => m.migration_id));
        return allMigrations.filter(migration => !appliedIds.has(migration.id));
    }
    async getAppliedMigrations() {
        const result = await this.db.query(`
      SELECT * FROM ${this.migrationTable}
      WHERE status = 'applied'
      ORDER BY applied_at ASC
    `, [], { useReadReplica: true });
        return result.rows;
    }
    async createMigrationPlan() {
        const pendingMigrations = await this.getPendingMigrations();
        const warnings = [];
        for (const migration of pendingMigrations) {
            if (migration.dependencies) {
                for (const dep of migration.dependencies) {
                    const depExists = pendingMigrations.some(m => m.id === dep);
                    if (!depExists) {
                        warnings.push(`Migration ${migration.id} depends on ${dep} which is not found`);
                    }
                }
            }
        }
        const sortedMigrations = this.sortMigrationsByDependencies(pendingMigrations);
        return {
            migrations: sortedMigrations,
            totalMigrations: sortedMigrations.length,
            estimatedTime: sortedMigrations.length * 5000,
            warnings
        };
    }
    async migrate() {
        const lockAcquired = await this.acquireLock();
        if (!lockAcquired) {
            throw new Error('Could not acquire migration lock. Another migration may be in progress.');
        }
        try {
            const plan = await this.createMigrationPlan();
            if (plan.warnings.length > 0) {
                this.emit('migration:warnings', { warnings: plan.warnings });
            }
            const applied = [];
            const errors = [];
            for (const migration of plan.migrations) {
                try {
                    await this.applyMigration(migration);
                    applied.push(migration.id);
                    this.emit('migration:applied', { migration: migration.id });
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    errors.push(`${migration.id}: ${errorMessage}`);
                    this.emit('migration:error', { migration: migration.id, error: errorMessage });
                    break;
                }
            }
            return {
                success: errors.length === 0,
                applied,
                errors
            };
        }
        finally {
            await this.releaseLock();
        }
    }
    async applyMigration(migration) {
        const startTime = Date.now();
        try {
            await this.db.transaction(async () => {
                if (migration.up.startsWith('function') || migration.up.includes('module.exports')) {
                    const migrationFn = eval(`(${migration.up})`);
                    await migrationFn(this.db);
                }
                else {
                    await this.db.query(migration.up);
                }
                await this.recordMigration(migration, Date.now() - startTime, 'applied');
            });
            this.emit('migration:success', { migration: migration.id });
        }
        catch (error) {
            await this.recordMigration(migration, Date.now() - startTime, 'failed', error.message);
            throw error;
        }
    }
    async rollbackLast() {
        const lockAcquired = await this.acquireLock();
        if (!lockAcquired) {
            throw new Error('Could not acquire migration lock.');
        }
        try {
            const lastMigration = await this.getLastAppliedMigration();
            if (!lastMigration) {
                return { success: false, error: 'No migrations to rollback' };
            }
            const migrations = await this.loadMigrations();
            const migration = migrations.find(m => m.id === lastMigration.migration_id);
            if (!migration) {
                return { success: false, error: 'Migration file not found for rollback' };
            }
            await this.rollbackMigration(migration, lastMigration);
            return { success: true, rolledBack: migration.id };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return { success: false, error: errorMessage };
        }
        finally {
            await this.releaseLock();
        }
    }
    async rollbackMigration(migration, record) {
        const startTime = Date.now();
        try {
            await this.db.transaction(async () => {
                if (migration.down.startsWith('function') || migration.down.includes('module.exports')) {
                    const rollbackFn = eval(`(${migration.down})`);
                    await rollbackFn(this.db);
                }
                else {
                    await this.db.query(migration.down);
                }
                await this.db.query(`
          UPDATE ${this.migrationTable}
          SET status = 'rolled_back', error_message = NULL
          WHERE id = $1
        `, [record.id]);
            });
            this.emit('migration:rollback-success', { migration: migration.id });
        }
        catch (error) {
            await this.db.query(`
        UPDATE ${this.migrationTable}
        SET error_message = $1
        WHERE id = $2
      `, [error.message, record.id]);
            throw error;
        }
    }
    async getStatus() {
        const [applied, pending] = await Promise.all([
            this.getAppliedMigrations(),
            this.getPendingMigrations()
        ]);
        const lastApplied = applied[applied.length - 1];
        let health = 'healthy';
        if (pending.length > 10) {
            health = 'warning';
        }
        const failedCount = await this.getFailedMigrationCount();
        if (failedCount > 0) {
            health = 'error';
        }
        return {
            appliedCount: applied.length,
            pendingCount: pending.length,
            lastApplied,
            health
        };
    }
    async recordMigration(migration, executionTime, status, errorMessage) {
        await this.db.query(`
      INSERT INTO ${this.migrationTable} 
      (migration_id, version, name, checksum, execution_time_ms, status, error_message)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
            migration.id,
            migration.version,
            migration.name,
            migration.checksum,
            executionTime,
            status,
            errorMessage
        ]);
    }
    async getLastAppliedMigration() {
        const result = await this.db.query(`
      SELECT * FROM ${this.migrationTable}
      WHERE status = 'applied'
      ORDER BY applied_at DESC
      LIMIT 1
    `, [], { useReadReplica: true });
        return result.rows[0] || null;
    }
    async getFailedMigrationCount() {
        const result = await this.db.query(`
      SELECT COUNT(*) as count FROM ${this.migrationTable}
      WHERE status = 'failed'
    `, [], { useReadReplica: true });
        return parseInt(result.rows[0].count);
    }
    generateMigrationId(filename) {
        return filename.replace(/\.\w+$/, '');
    }
    extractVersionFromFilename(filename) {
        const match = filename.match(/^(\d+)/);
        return match ? match[1] : '0';
    }
    calculateChecksum(content) {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(content).digest('hex');
    }
    sortMigrationsByDependencies(migrations) {
        const sorted = [];
        const remaining = [...migrations];
        const processed = new Set();
        while (remaining.length > 0) {
            const canProcess = remaining.filter(migration => {
                if (!migration.dependencies)
                    return true;
                return migration.dependencies.every(dep => processed.has(dep));
            });
            if (canProcess.length === 0) {
                throw new Error('Circular dependency detected in migrations');
            }
            for (const migration of canProcess) {
                sorted.push(migration);
                processed.add(migration.id);
                const index = remaining.indexOf(migration);
                remaining.splice(index, 1);
            }
        }
        return sorted;
    }
}
exports.MigrationManager = MigrationManager;
exports.default = MigrationManager;
//# sourceMappingURL=MigrationManager.js.map