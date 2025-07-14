/**
 * Database Migration Management System
 * Handles schema evolution and database versioning
 */

import { DatabaseConnectionManager } from '../connection';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface Migration {
  id: string;
  name: string;
  version: string;
  description: string;
  up: string;
  down: string;
  dependencies?: string[];
  checksum: string;
  created_at: Date;
}

export interface MigrationRecord {
  id: string;
  migration_id: string;
  version: string;
  checksum: string;
  applied_at: Date;
  execution_time_ms: number;
  status: 'applied' | 'failed' | 'rolled_back';
  error_message?: string;
}

export interface MigrationPlan {
  migrations: Migration[];
  totalMigrations: number;
  estimatedTime: number;
  warnings: string[];
}

export class MigrationManager extends EventEmitter {
  private db: DatabaseConnectionManager;
  private migrationsPath: string;
  private migrationTable: string = 'schema_migrations';
  private lockTable: string = 'migration_locks';

  constructor(db: DatabaseConnectionManager, migrationsPath: string = './migrations') {
    super();
    this.db = db;
    this.migrationsPath = migrationsPath;
  }

  /**
   * Initialize migration system
   */
  async initialize(): Promise<void> {
    await this.createMigrationTables();
    await this.ensureMigrationLock();
    this.emit('migration:initialized');
  }

  /**
   * Create migration tracking tables
   */
  private async createMigrationTables(): Promise<void> {
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

  /**
   * Acquire migration lock
   */
  private async acquireLock(timeoutMs: number = 300000): Promise<boolean> {
    const lockKey = 'migration_lock';
    const expiresAt = new Date(Date.now() + timeoutMs);
    const acquiredBy = `${process.pid}-${Date.now()}`;

    try {
      // Try to acquire lock
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
    } catch (error) {
      this.emit('migration:lock-failed', { error });
      return false;
    }
  }

  /**
   * Release migration lock
   */
  private async releaseLock(): Promise<void> {
    await this.db.query(`DELETE FROM ${this.lockTable} WHERE lock_key = 'migration_lock'`);
  }

  /**
   * Ensure migration lock exists
   */
  private async ensureMigrationLock(): Promise<void> {
    // Clean up expired locks
    await this.db.query(`
      DELETE FROM ${this.lockTable} 
      WHERE expires_at < NOW()
    `);
  }

  /**
   * Load migration files from directory
   */
  async loadMigrations(): Promise<Migration[]> {
    try {
      const files = await fs.readdir(this.migrationsPath);
      const migrationFiles = files
        .filter(file => file.endsWith('.sql') || file.endsWith('.js') || file.endsWith('.ts'))
        .sort();

      const migrations: Migration[] = [];

      for (const file of migrationFiles) {
        const migration = await this.loadMigrationFile(file);
        if (migration) {
          migrations.push(migration);
        }
      }

      return migrations;
    } catch (error) {
      this.emit('migration:load-error', { error });
      throw new Error(`Failed to load migrations: ${error}`);
    }
  }

  /**
   * Load individual migration file
   */
  private async loadMigrationFile(filename: string): Promise<Migration | null> {
    const filePath = path.join(this.migrationsPath, filename);
    
    try {
      if (filename.endsWith('.sql')) {
        return this.loadSQLMigration(filePath, filename);
      } else if (filename.endsWith('.js') || filename.endsWith('.ts')) {
        return this.loadJSMigration(filePath, filename);
      }
      
      return null;
    } catch (error) {
      this.emit('migration:file-error', { filename, error });
      throw error;
    }
  }

  /**
   * Load SQL migration file
   */
  private async loadSQLMigration(filePath: string, filename: string): Promise<Migration> {
    const content = await fs.readFile(filePath, 'utf8');
    const parts = content.split('-- DOWN');
    
    if (parts.length !== 2) {
      throw new Error(`Invalid migration format in ${filename}. Must contain -- DOWN separator.`);
    }

    const up = parts[0].replace(/^-- UP\s*/m, '').trim();
    const down = parts[1].trim();
    
    // Extract metadata from comments
    const metadataMatch = content.match(/^-- Migration: (.+)\n-- Version: (.+)\n-- Description: (.+)/m);
    
    const migration: Migration = {
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

  /**
   * Load JavaScript/TypeScript migration file
   */
  private async loadJSMigration(filePath: string, filename: string): Promise<Migration> {
    const migrationModule = require(filePath);
    
    if (!migrationModule.up || !migrationModule.down) {
      throw new Error(`Migration ${filename} must export 'up' and 'down' functions`);
    }

    const migration: Migration = {
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

  /**
   * Get pending migrations
   */
  async getPendingMigrations(): Promise<Migration[]> {
    const allMigrations = await this.loadMigrations();
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedIds = new Set(appliedMigrations.map(m => m.migration_id));

    return allMigrations.filter(migration => !appliedIds.has(migration.id));
  }

  /**
   * Get applied migrations
   */
  async getAppliedMigrations(): Promise<MigrationRecord[]> {
    const result = await this.db.query(`
      SELECT * FROM ${this.migrationTable}
      WHERE status = 'applied'
      ORDER BY applied_at ASC
    `, [], { useReadReplica: true });

    return result.rows;
  }

  /**
   * Create migration plan
   */
  async createMigrationPlan(): Promise<MigrationPlan> {
    const pendingMigrations = await this.getPendingMigrations();
    const warnings: string[] = [];
    
    // Check for dependency conflicts
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

    // Sort by dependencies
    const sortedMigrations = this.sortMigrationsByDependencies(pendingMigrations);
    
    return {
      migrations: sortedMigrations,
      totalMigrations: sortedMigrations.length,
      estimatedTime: sortedMigrations.length * 5000, // 5 seconds per migration estimate
      warnings
    };
  }

  /**
   * Run pending migrations
   */
  async migrate(): Promise<{ success: boolean; applied: string[]; errors: string[] }> {
    const lockAcquired = await this.acquireLock();
    if (!lockAcquired) {
      throw new Error('Could not acquire migration lock. Another migration may be in progress.');
    }

    try {
      const plan = await this.createMigrationPlan();
      
      if (plan.warnings.length > 0) {
        this.emit('migration:warnings', { warnings: plan.warnings });
      }

      const applied: string[] = [];
      const errors: string[] = [];

      for (const migration of plan.migrations) {
        try {
          await this.applyMigration(migration);
          applied.push(migration.id);
          this.emit('migration:applied', { migration: migration.id });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push(`${migration.id}: ${errorMessage}`);
          this.emit('migration:error', { migration: migration.id, error: errorMessage });
          break; // Stop on first error
        }
      }

      return {
        success: errors.length === 0,
        applied,
        errors
      };
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Apply a single migration
   */
  private async applyMigration(migration: Migration): Promise<void> {
    const startTime = Date.now();
    
    try {
      await this.db.transaction(async () => {
        // Execute migration
        if (migration.up.startsWith('function') || migration.up.includes('module.exports')) {
          // JavaScript migration
          const migrationFn = eval(`(${migration.up})`);
          await migrationFn(this.db);
        } else {
          // SQL migration
          await this.db.query(migration.up);
        }

        // Record migration
        await this.recordMigration(migration, Date.now() - startTime, 'applied');
      });

      this.emit('migration:success', { migration: migration.id });
    } catch (error) {
      await this.recordMigration(migration, Date.now() - startTime, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Rollback last migration
   */
  async rollbackLast(): Promise<{ success: boolean; rolledBack?: string; error?: string }> {
    const lockAcquired = await this.acquireLock();
    if (!lockAcquired) {
      throw new Error('Could not acquire migration lock.');
    }

    try {
      const lastMigration = await this.getLastAppliedMigration();
      if (!lastMigration) {
        return { success: false, error: 'No migrations to rollback' };
      }

      // Load migration to get rollback script
      const migrations = await this.loadMigrations();
      const migration = migrations.find(m => m.id === lastMigration.migration_id);
      
      if (!migration) {
        return { success: false, error: 'Migration file not found for rollback' };
      }

      await this.rollbackMigration(migration, lastMigration);
      
      return { success: true, rolledBack: migration.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Rollback a specific migration
   */
  private async rollbackMigration(migration: Migration, record: MigrationRecord): Promise<void> {
    const startTime = Date.now();
    
    try {
      await this.db.transaction(async () => {
        // Execute rollback
        if (migration.down.startsWith('function') || migration.down.includes('module.exports')) {
          // JavaScript migration
          const rollbackFn = eval(`(${migration.down})`);
          await rollbackFn(this.db);
        } else {
          // SQL migration
          await this.db.query(migration.down);
        }

        // Update migration record
        await this.db.query(`
          UPDATE ${this.migrationTable}
          SET status = 'rolled_back', error_message = NULL
          WHERE id = $1
        `, [record.id]);
      });

      this.emit('migration:rollback-success', { migration: migration.id });
    } catch (error) {
      await this.db.query(`
        UPDATE ${this.migrationTable}
        SET error_message = $1
        WHERE id = $2
      `, [error.message, record.id]);
      
      throw error;
    }
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<{
    appliedCount: number;
    pendingCount: number;
    lastApplied?: MigrationRecord;
    health: 'healthy' | 'warning' | 'error';
  }> {
    const [applied, pending] = await Promise.all([
      this.getAppliedMigrations(),
      this.getPendingMigrations()
    ]);

    const lastApplied = applied[applied.length - 1];
    
    let health: 'healthy' | 'warning' | 'error' = 'healthy';
    if (pending.length > 10) {
      health = 'warning';
    }
    
    // Check for failed migrations
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

  /**
   * Record migration execution
   */
  private async recordMigration(
    migration: Migration,
    executionTime: number,
    status: 'applied' | 'failed',
    errorMessage?: string
  ): Promise<void> {
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

  /**
   * Get last applied migration
   */
  private async getLastAppliedMigration(): Promise<MigrationRecord | null> {
    const result = await this.db.query(`
      SELECT * FROM ${this.migrationTable}
      WHERE status = 'applied'
      ORDER BY applied_at DESC
      LIMIT 1
    `, [], { useReadReplica: true });

    return result.rows[0] || null;
  }

  /**
   * Get failed migration count
   */
  private async getFailedMigrationCount(): Promise<number> {
    const result = await this.db.query(`
      SELECT COUNT(*) as count FROM ${this.migrationTable}
      WHERE status = 'failed'
    `, [], { useReadReplica: true });

    return parseInt(result.rows[0].count);
  }

  /**
   * Utility methods
   */
  private generateMigrationId(filename: string): string {
    return filename.replace(/\.\w+$/, '');
  }

  private extractVersionFromFilename(filename: string): string {
    const match = filename.match(/^(\d+)/);
    return match ? match[1] : '0';
  }

  private calculateChecksum(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private sortMigrationsByDependencies(migrations: Migration[]): Migration[] {
    const sorted: Migration[] = [];
    const remaining = [...migrations];
    const processed = new Set<string>();

    while (remaining.length > 0) {
      const canProcess = remaining.filter(migration => {
        if (!migration.dependencies) return true;
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

export default MigrationManager;