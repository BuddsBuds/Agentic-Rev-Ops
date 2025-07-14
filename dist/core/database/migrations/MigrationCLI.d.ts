import { DatabaseConnectionManager } from '../connection';
export interface MigrationCLIOptions {
    connectionName?: string;
    migrationsPath?: string;
    force?: boolean;
    dryRun?: boolean;
    verbose?: boolean;
}
export declare class MigrationCLI {
    private db;
    private migrationManager;
    private options;
    constructor(db: DatabaseConnectionManager, options?: MigrationCLIOptions);
    initialize(): Promise<void>;
    private setupEventListeners;
    status(): Promise<void>;
    migrate(): Promise<void>;
    showMigrationPlan(): Promise<void>;
    rollback(): Promise<void>;
    create(name: string, type?: 'sql' | 'js'): Promise<void>;
    validate(): Promise<void>;
    reset(): Promise<void>;
}
export declare class MigrationCLIRunner {
    static run(args: string[]): Promise<void>;
    private static getFlagValue;
    private static showHelp;
}
export default MigrationCLI;
//# sourceMappingURL=MigrationCLI.d.ts.map