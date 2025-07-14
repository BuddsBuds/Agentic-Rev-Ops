import { DatabaseManager } from '@/core/database/DatabaseManager';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Helper class for managing test database setup and teardown
 */
export class TestDatabaseHelper {
  private dbManager: DatabaseManager;
  private testDbName: string;
  private originalDbName: string;

  constructor() {
    this.dbManager = DatabaseManager.getInstance();
    this.testDbName = `test_agentic_revops_${process.pid}_${Date.now()}`;
    this.originalDbName = process.env.DB_NAME || 'agentic_revops';
  }

  /**
   * Setup test database
   */
  async setupTestDatabase(): Promise<void> {
    // Store original DB name
    process.env.DB_NAME = this.testDbName;

    // Connect to postgres database to create test DB
    process.env.DB_NAME = 'postgres';
    await this.dbManager.connect();

    try {
      // Drop test database if exists
      await this.dbManager.query(
        `DROP DATABASE IF EXISTS ${this.testDbName}`
      );

      // Create test database
      await this.dbManager.query(
        `CREATE DATABASE ${this.testDbName}`
      );

      // Disconnect from postgres
      await this.dbManager.disconnect();

      // Connect to test database
      process.env.DB_NAME = this.testDbName;
      await this.dbManager.connect();

      // Create schema
      await this.createSchema();
    } catch (error) {
      process.env.DB_NAME = this.originalDbName;
      throw error;
    }
  }

  /**
   * Teardown test database
   */
  async teardownTestDatabase(): Promise<void> {
    try {
      // Disconnect from test database
      await this.dbManager.disconnect();

      // Connect to postgres database
      process.env.DB_NAME = 'postgres';
      await this.dbManager.connect();

      // Drop test database
      await this.dbManager.query(
        `DROP DATABASE IF EXISTS ${this.testDbName}`
      );

      // Disconnect
      await this.dbManager.disconnect();
    } finally {
      // Restore original DB name
      process.env.DB_NAME = this.originalDbName;
    }
  }

  /**
   * Clear all tables in the test database
   */
  async clearAllTables(): Promise<void> {
    const tables = [
      'swarm_agent_performance',
      'swarm_decisions',
      'swarm_agents',
      'swarm_configurations',
      'user_sessions',
      'users',
      'organizations',
    ];

    for (const table of tables) {
      await this.dbManager.query(`TRUNCATE TABLE ${table} CASCADE`);
    }
  }

  /**
   * Seed basic test data
   */
  async seedBasicData(): Promise<void> {
    // Create test organizations
    await this.dbManager.query(`
      INSERT INTO organizations (id, name, industry, size, metadata)
      VALUES 
        ('org-1', 'Test Corp', 'Technology', 'large', '{"tier": "premium"}'),
        ('org-2', 'Small Biz', 'Retail', 'small', '{"tier": "basic"}')
    `);

    // Create test users
    await this.dbManager.query(`
      INSERT INTO users (id, email, name, role, organization_id, metadata)
      VALUES
        ('user-1', 'admin@testcorp.com', 'Admin User', 'admin', 'org-1', '{}'),
        ('user-2', 'user@testcorp.com', 'Regular User', 'user', 'org-1', '{}'),
        ('user-3', 'owner@smallbiz.com', 'Owner', 'admin', 'org-2', '{}')
    `);
  }

  /**
   * Create database schema
   */
  private async createSchema(): Promise<void> {
    const schemaPath = join(__dirname, '../../src/core/database/schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    // Split schema into individual statements
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // Execute each statement
    for (const statement of statements) {
      await this.dbManager.query(statement);
    }
  }

  /**
   * Create test data for specific scenarios
   */
  async createSwarmTestData(): Promise<{
    organizationId: string;
    swarmId: string;
    agentIds: string[];
  }> {
    // Create swarm configuration
    const swarmResult = await this.dbManager.query(`
      INSERT INTO swarm_configurations (
        id, organization_id, name, topology, consensus_type, 
        consensus_threshold, status, metadata
      )
      VALUES (
        'swarm-test-1', 'org-1', 'Test Swarm', 'hierarchical', 
        'weighted_majority', 0.7, 'active', 
        '{
          "weights": {"queen": 0.3, "specialist": 0.15, "worker": 0.05},
          "performance": {"avgResponseTime": 0, "successRate": 1}
        }'
      )
      RETURNING id
    `);

    const swarmId = swarmResult.rows[0].id;

    // Create agents
    const agentIds = ['queen-1', 'spec-1', 'spec-2', 'worker-1', 'worker-2'];
    const agentTypes = ['queen', 'specialist', 'specialist', 'worker', 'worker'];
    const agentRoles = ['coordinator', 'analytics', 'crm', 'processor', 'processor'];

    for (let i = 0; i < agentIds.length; i++) {
      await this.dbManager.query(`
        INSERT INTO swarm_agents (
          id, swarm_id, agent_type, role, status, performance_score
        )
        VALUES ($1, $2, $3, $4, 'active', 1.0)
      `, [agentIds[i], swarmId, agentTypes[i], agentRoles[i]]);
    }

    return {
      organizationId: 'org-1',
      swarmId,
      agentIds,
    };
  }

  /**
   * Create performance test data
   */
  async createPerformanceTestData(count: number): Promise<void> {
    const batchSize = 100;
    const batches = Math.ceil(count / batchSize);

    for (let batch = 0; batch < batches; batch++) {
      const values: any[] = [];
      const params: any[] = [];
      
      const startIdx = batch * batchSize;
      const endIdx = Math.min(startIdx + batchSize, count);

      for (let i = startIdx; i < endIdx; i++) {
        const paramOffset = (i - startIdx) * 4;
        values.push(
          `($${paramOffset + 1}, $${paramOffset + 2}, $${paramOffset + 3}, $${paramOffset + 4})`
        );
        params.push(
          `perf-org-${i}`,
          `Performance Org ${i}`,
          ['Technology', 'Finance', 'Healthcare', 'Retail'][i % 4],
          ['small', 'medium', 'large'][i % 3]
        );
      }

      await this.dbManager.query(`
        INSERT INTO organizations (id, name, industry, size)
        VALUES ${values.join(', ')}
      `, params);
    }
  }

  /**
   * Wait for database to be ready
   */
  async waitForDatabase(maxAttempts = 10, delayMs = 1000): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        await this.dbManager.query('SELECT 1');
        return true;
      } catch (error) {
        if (i < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    return false;
  }

  /**
   * Get table row counts for verification
   */
  async getTableCounts(): Promise<Record<string, number>> {
    const tables = [
      'organizations',
      'users',
      'swarm_configurations',
      'swarm_agents',
      'swarm_decisions',
      'user_sessions',
    ];

    const counts: Record<string, number> = {};

    for (const table of tables) {
      const result = await this.dbManager.query(
        `SELECT COUNT(*) as count FROM ${table}`
      );
      counts[table] = parseInt(result.rows[0].count, 10);
    }

    return counts;
  }
}