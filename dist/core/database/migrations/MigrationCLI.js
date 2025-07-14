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
exports.MigrationCLIRunner = exports.MigrationCLI = void 0;
const connection_1 = require("../connection");
const MigrationManager_1 = require("./MigrationManager");
const path = __importStar(require("path"));
class MigrationCLI {
    db;
    migrationManager;
    options;
    constructor(db, options = {}) {
        this.db = db;
        this.options = {
            migrationsPath: path.join(__dirname, './'),
            ...options
        };
        this.migrationManager = new MigrationManager_1.MigrationManager(this.db, this.options.migrationsPath);
    }
    async initialize() {
        await this.migrationManager.initialize();
        if (this.options.verbose) {
            this.setupEventListeners();
        }
    }
    setupEventListeners() {
        this.migrationManager.on('migration:initialized', () => {
            console.log('✅ Migration system initialized');
        });
        this.migrationManager.on('migration:applied', (data) => {
            console.log(`✅ Applied migration: ${data.migration}`);
        });
        this.migrationManager.on('migration:error', (data) => {
            console.error(`❌ Migration failed: ${data.migration} - ${data.error}`);
        });
        this.migrationManager.on('migration:warnings', (data) => {
            console.warn('⚠️  Migration warnings:');
            data.warnings.forEach((warning) => console.warn(`   ${warning}`));
        });
        this.migrationManager.on('migration:rollback-success', (data) => {
            console.log(`↩️  Rolled back migration: ${data.migration}`);
        });
    }
    async status() {
        console.log('🔍 Checking migration status...\n');
        const status = await this.migrationManager.getStatus();
        const appliedMigrations = await this.migrationManager.getAppliedMigrations();
        const pendingMigrations = await this.migrationManager.getPendingMigrations();
        const healthIcon = {
            'healthy': '🟢',
            'warning': '🟡',
            'error': '🔴'
        }[status.health];
        console.log(`${healthIcon} Migration Health: ${status.health.toUpperCase()}`);
        console.log(`📊 Applied: ${status.appliedCount} | Pending: ${status.pendingCount}\n`);
        if (status.lastApplied) {
            console.log(`📅 Last Applied: ${status.lastApplied.name} (${status.lastApplied.version})`);
            console.log(`   Applied at: ${status.lastApplied.applied_at}`);
            console.log(`   Execution time: ${status.lastApplied.execution_time_ms}ms\n`);
        }
        if (pendingMigrations.length > 0) {
            console.log('📋 Pending Migrations:');
            pendingMigrations.forEach((migration, index) => {
                console.log(`   ${index + 1}. ${migration.name} (${migration.version})`);
                if (migration.description) {
                    console.log(`      ${migration.description}`);
                }
            });
            console.log();
        }
        if (appliedMigrations.length > 0 && this.options.verbose) {
            console.log('✅ Applied Migrations:');
            appliedMigrations.slice(-5).forEach((migration) => {
                console.log(`   • ${migration.name} (${migration.version}) - ${migration.applied_at}`);
            });
            console.log();
        }
    }
    async migrate() {
        console.log('🚀 Starting migration process...\n');
        if (this.options.dryRun) {
            console.log('🔍 DRY RUN MODE - No changes will be made\n');
            await this.showMigrationPlan();
            return;
        }
        try {
            const result = await this.migrationManager.migrate();
            if (result.success) {
                console.log(`✅ Successfully applied ${result.applied.length} migrations`);
                if (result.applied.length > 0) {
                    console.log('Applied migrations:');
                    result.applied.forEach(migration => console.log(`   • ${migration}`));
                }
            }
            else {
                console.error(`❌ Migration failed. Applied ${result.applied.length} migrations before failure.`);
                if (result.errors.length > 0) {
                    console.error('Errors:');
                    result.errors.forEach(error => console.error(`   • ${error}`));
                }
                process.exit(1);
            }
        }
        catch (error) {
            console.error(`❌ Migration process failed: ${error}`);
            process.exit(1);
        }
    }
    async showMigrationPlan() {
        const plan = await this.migrationManager.createMigrationPlan();
        if (plan.migrations.length === 0) {
            console.log('✅ No pending migrations');
            return;
        }
        console.log(`📋 Migration Plan (${plan.totalMigrations} migrations)`);
        console.log(`⏱️  Estimated time: ${Math.round(plan.estimatedTime / 1000)}s\n`);
        if (plan.warnings.length > 0) {
            console.log('⚠️  Warnings:');
            plan.warnings.forEach(warning => console.log(`   • ${warning}`));
            console.log();
        }
        console.log('📝 Migrations to apply:');
        plan.migrations.forEach((migration, index) => {
            console.log(`   ${index + 1}. ${migration.name} (${migration.version})`);
            if (migration.description) {
                console.log(`      ${migration.description}`);
            }
            if (migration.dependencies && migration.dependencies.length > 0) {
                console.log(`      Dependencies: ${migration.dependencies.join(', ')}`);
            }
        });
        console.log();
    }
    async rollback() {
        console.log('↩️  Rolling back last migration...\n');
        if (this.options.dryRun) {
            console.log('🔍 DRY RUN MODE - No changes will be made');
            const lastApplied = await this.migrationManager.getAppliedMigrations();
            if (lastApplied.length > 0) {
                const last = lastApplied[lastApplied.length - 1];
                console.log(`Would rollback: ${last.name} (${last.version})`);
            }
            else {
                console.log('No migrations to rollback');
            }
            return;
        }
        if (!this.options.force) {
            console.log('⚠️  Rollback is a destructive operation.');
            console.log('   Use --force flag to confirm rollback.');
            return;
        }
        try {
            const result = await this.migrationManager.rollbackLast();
            if (result.success) {
                console.log(`✅ Successfully rolled back migration: ${result.rolledBack}`);
            }
            else {
                console.error(`❌ Rollback failed: ${result.error}`);
                process.exit(1);
            }
        }
        catch (error) {
            console.error(`❌ Rollback process failed: ${error}`);
            process.exit(1);
        }
    }
    async create(name, type = 'sql') {
        const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
        const version = timestamp.substr(0, 8) + timestamp.substr(9, 6);
        const filename = `${version}_${name.toLowerCase().replace(/\s+/g, '_')}.${type}`;
        const filepath = path.join(this.options.migrationsPath, filename);
        let template;
        if (type === 'sql') {
            template = `-- Migration: ${name}
-- Version: ${version}
-- Description: ${name}

-- UP


-- DOWN

`;
        }
        else {
            template = `/**
 * Migration: ${name}
 * Version: ${version}
 * Description: ${name}
 */

module.exports = {
  name: '${name}',
  version: '${version}',
  description: '${name}',
  
  async up(db) {
    // Migration logic here
  },
  
  async down(db) {
    // Rollback logic here
  }
};
`;
        }
        const fs = require('fs').promises;
        await fs.writeFile(filepath, template);
        console.log(`✅ Created migration file: ${filename}`);
        console.log(`📁 Location: ${filepath}`);
    }
    async validate() {
        console.log('🔍 Validating migrations...\n');
        try {
            const migrations = await this.migrationManager.loadMigrations();
            const applied = await this.migrationManager.getAppliedMigrations();
            console.log(`📊 Found ${migrations.length} migration files`);
            console.log(`📊 ${applied.length} migrations applied\n`);
            const appliedIds = new Set(applied.map(m => m.migration_id));
            const fileIds = new Set(migrations.map(m => m.id));
            const missingFiles = applied.filter(m => !fileIds.has(m.migration_id));
            if (missingFiles.length > 0) {
                console.log('❌ Missing migration files:');
                missingFiles.forEach(m => console.log(`   • ${m.name} (${m.migration_id})`));
                console.log();
            }
            const checksumMismatches = [];
            for (const migration of migrations) {
                const applied_migration = applied.find(a => a.migration_id === migration.id);
                if (applied_migration && applied_migration.checksum !== migration.checksum) {
                    checksumMismatches.push(migration);
                }
            }
            if (checksumMismatches.length > 0) {
                console.log('⚠️  Checksum mismatches (migrations may have been modified):');
                checksumMismatches.forEach(m => console.log(`   • ${m.name} (${m.id})`));
                console.log();
            }
            if (missingFiles.length === 0 && checksumMismatches.length === 0) {
                console.log('✅ All migrations are valid');
            }
        }
        catch (error) {
            console.error(`❌ Validation failed: ${error}`);
            process.exit(1);
        }
    }
    async reset() {
        if (!this.options.force) {
            console.log('⚠️  DANGER: This will drop all data and reset the database.');
            console.log('   Use --force flag to confirm reset.');
            return;
        }
        console.log('🔥 Resetting database...\n');
        try {
            console.log('❌ Reset functionality not implemented for safety.');
            console.log('   Manually drop and recreate the database if needed.');
        }
        catch (error) {
            console.error(`❌ Reset failed: ${error}`);
            process.exit(1);
        }
    }
}
exports.MigrationCLI = MigrationCLI;
class MigrationCLIRunner {
    static async run(args) {
        const command = args[2] || 'status';
        const flags = args.slice(3);
        const options = {
            force: flags.includes('--force'),
            dryRun: flags.includes('--dry-run'),
            verbose: flags.includes('--verbose') || flags.includes('-v'),
            migrationsPath: this.getFlagValue(flags, '--migrations-path') || undefined,
            connectionName: this.getFlagValue(flags, '--connection') || 'default'
        };
        const db = connection_1.DatabaseFactory.get(options.connectionName);
        if (!db) {
            console.error(`❌ Database connection '${options.connectionName}' not found`);
            process.exit(1);
        }
        const cli = new MigrationCLI(db, options);
        await cli.initialize();
        try {
            switch (command) {
                case 'status':
                    await cli.status();
                    break;
                case 'migrate':
                    await cli.migrate();
                    break;
                case 'rollback':
                    await cli.rollback();
                    break;
                case 'plan':
                    await cli.showMigrationPlan();
                    break;
                case 'create':
                    const name = this.getFlagValue(flags, '--name') || flags[0];
                    const type = this.getFlagValue(flags, '--type') || 'sql';
                    if (!name) {
                        console.error('❌ Migration name is required');
                        process.exit(1);
                    }
                    await cli.create(name, type);
                    break;
                case 'validate':
                    await cli.validate();
                    break;
                case 'reset':
                    await cli.reset();
                    break;
                default:
                    this.showHelp();
            }
        }
        catch (error) {
            console.error(`❌ Command failed: ${error}`);
            process.exit(1);
        }
    }
    static getFlagValue(flags, flag) {
        const index = flags.indexOf(flag);
        return index !== -1 && index + 1 < flags.length ? flags[index + 1] : null;
    }
    static showHelp() {
        console.log(`
🗄️  Database Migration CLI

Usage: npm run migrate <command> [options]

Commands:
  status      Show migration status (default)
  migrate     Run pending migrations
  rollback    Rollback last migration
  plan        Show migration execution plan
  create      Create new migration file
  validate    Validate migration integrity
  reset       Reset database (dangerous)

Options:
  --force              Force destructive operations
  --dry-run            Show what would be done without executing
  --verbose, -v        Verbose output
  --migrations-path    Custom migrations directory
  --connection         Database connection name (default: 'default')

Examples:
  npm run migrate status
  npm run migrate migrate --dry-run
  npm run migrate create --name "add_user_preferences" --type sql
  npm run migrate rollback --force
`);
    }
}
exports.MigrationCLIRunner = MigrationCLIRunner;
exports.default = MigrationCLI;
//# sourceMappingURL=MigrationCLI.js.map