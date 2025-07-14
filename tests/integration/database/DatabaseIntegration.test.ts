import { DatabaseManager } from '@/core/database/DatabaseManager';
import { DatabaseService } from '@/core/database/DatabaseService';
import { OrganizationRepository } from '@/core/database/repositories/OrganizationRepository';
import { SwarmRepository } from '@/core/database/repositories/SwarmRepository';
import { MigrationManager } from '@/core/database/migrations/MigrationManager';
import { TestDatabaseHelper } from '@tests/utils/TestDatabaseHelper';

/**
 * Integration tests for the complete database layer
 * Tests real database interactions with a test database
 */
describe('Database Integration Tests', () => {
  let dbManager: DatabaseManager;
  let dbService: DatabaseService;
  let testHelper: TestDatabaseHelper;
  let migrationManager: MigrationManager;

  beforeAll(async () => {
    // Setup test database
    testHelper = new TestDatabaseHelper();
    await testHelper.setupTestDatabase();
    
    // Initialize database components
    dbManager = DatabaseManager.getInstance();
    dbService = new DatabaseService();
    migrationManager = new MigrationManager(dbManager);

    // Run migrations
    await migrationManager.runMigrations();
  });

  afterAll(async () => {
    await testHelper.teardownTestDatabase();
    await dbManager.disconnect();
  });

  beforeEach(async () => {
    await testHelper.clearAllTables();
    await testHelper.seedBasicData();
  });

  describe('DatabaseService Integration', () => {
    it('should initialize all repositories', async () => {
      await dbService.initialize();

      expect(dbService.users).toBeDefined();
      expect(dbService.organizations).toBeDefined();
      expect(dbService.swarmConfigurations).toBeDefined();
      expect(dbService.isInitialized()).toBe(true);
    });

    it('should handle concurrent initialization attempts', async () => {
      const initPromises = Array(5).fill(null).map(() => dbService.initialize());
      const results = await Promise.all(initPromises);

      // All should succeed without errors
      results.forEach(result => expect(result).toBe(true));
      expect(dbService.isInitialized()).toBe(true);
    });
  });

  describe('Organization Repository Integration', () => {
    let orgRepo: OrganizationRepository;

    beforeEach(async () => {
      await dbService.initialize();
      orgRepo = dbService.organizations;
    });

    it('should create and retrieve organizations', async () => {
      const orgData = {
        name: 'Test Organization',
        industry: 'Technology',
        size: 'medium',
        metadata: { region: 'US', tier: 'premium' },
      };

      const created = await orgRepo.create(orgData);
      expect(created.id).toBeDefined();
      expect(created.name).toBe(orgData.name);

      const retrieved = await orgRepo.findById(created.id);
      expect(retrieved).toMatchObject(orgData);
    });

    it('should update organizations with optimistic locking', async () => {
      const org = await orgRepo.create({
        name: 'Test Org',
        industry: 'Tech',
        size: 'small',
      });

      // Simulate concurrent updates
      const update1 = orgRepo.update(org.id, { name: 'Updated 1' }, org.version);
      const update2 = orgRepo.update(org.id, { name: 'Updated 2' }, org.version);

      const [result1, result2] = await Promise.allSettled([update1, update2]);

      // One should succeed, one should fail due to version mismatch
      const successes = [result1, result2].filter(r => r.status === 'fulfilled');
      const failures = [result1, result2].filter(r => r.status === 'rejected');

      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
    });

    it('should handle complex queries with filters', async () => {
      // Create test data
      await Promise.all([
        orgRepo.create({ name: 'Tech Corp', industry: 'Technology', size: 'large' }),
        orgRepo.create({ name: 'Health Inc', industry: 'Healthcare', size: 'medium' }),
        orgRepo.create({ name: 'Fin Ltd', industry: 'Finance', size: 'large' }),
        orgRepo.create({ name: 'Edu Org', industry: 'Education', size: 'small' }),
      ]);

      // Test filtering
      const largeOrgs = await orgRepo.findAll({ size: 'large' });
      expect(largeOrgs).toHaveLength(2);

      const techOrgs = await orgRepo.findAll({ industry: 'Technology' });
      expect(techOrgs).toHaveLength(1);
      expect(techOrgs[0].name).toBe('Tech Corp');
    });
  });

  describe('Swarm Configuration Integration', () => {
    let swarmRepo: SwarmRepository;
    let orgId: string;

    beforeEach(async () => {
      await dbService.initialize();
      swarmRepo = dbService.swarmConfigurations;
      
      // Create test organization
      const org = await dbService.organizations.create({
        name: 'Test Org',
        industry: 'Tech',
        size: 'medium',
      });
      orgId = org.id;
    });

    it('should manage swarm configurations', async () => {
      const swarmConfig = {
        organizationId: orgId,
        name: 'Production Swarm',
        topology: 'hierarchical' as const,
        consensus: {
          type: 'weighted_majority',
          threshold: 0.7,
          weights: {
            queen: 0.3,
            specialist: 0.15,
            worker: 0.05,
          },
        },
        agents: [
          { id: 'queen-1', type: 'queen', role: 'coordinator' },
          { id: 'spec-1', type: 'specialist', role: 'analytics' },
          { id: 'spec-2', type: 'specialist', role: 'crm' },
        ],
        performance: {
          avgResponseTime: 0,
          successRate: 1,
          totalDecisions: 0,
        },
      };

      const created = await swarmRepo.create(swarmConfig);
      expect(created.id).toBeDefined();
      expect(created.agents).toHaveLength(3);

      // Update performance metrics
      await swarmRepo.updatePerformance(created.id, {
        avgResponseTime: 150,
        successRate: 0.95,
        totalDecisions: 100,
      });

      const updated = await swarmRepo.findById(created.id);
      expect(updated?.performance.totalDecisions).toBe(100);
    });

    it('should handle swarm lifecycle operations', async () => {
      const swarm = await swarmRepo.create({
        organizationId: orgId,
        name: 'Test Swarm',
        topology: 'mesh',
        consensus: {
          type: 'simple_majority',
          threshold: 0.5,
        },
        agents: [],
        performance: {
          avgResponseTime: 0,
          successRate: 1,
          totalDecisions: 0,
        },
      });

      // Add agents
      await swarmRepo.addAgent(swarm.id, {
        id: 'agent-1',
        type: 'worker',
        role: 'data-processor',
      });

      // Deactivate swarm
      await swarmRepo.update(swarm.id, { status: 'inactive' });

      // Verify status
      const inactive = await swarmRepo.findById(swarm.id);
      expect(inactive?.status).toBe('inactive');

      // Find active swarms
      const activeSwarms = await swarmRepo.findActiveByOrganization(orgId);
      expect(activeSwarms).toHaveLength(0);
    });
  });

  describe('Transaction Handling', () => {
    it('should handle complex transactions correctly', async () => {
      await dbService.initialize();

      const result = await dbManager.transaction(async (client) => {
        // Create organization
        const org = await dbService.organizations.create({
          name: 'Transaction Test Org',
          industry: 'Tech',
          size: 'large',
        });

        // Create swarm
        const swarm = await dbService.swarmConfigurations.create({
          organizationId: org.id,
          name: 'Transaction Test Swarm',
          topology: 'star',
          consensus: {
            type: 'unanimous',
            threshold: 1.0,
          },
          agents: [],
          performance: {
            avgResponseTime: 0,
            successRate: 1,
            totalDecisions: 0,
          },
        });

        return { org, swarm };
      });

      // Verify both were created
      expect(result.org.id).toBeDefined();
      expect(result.swarm.id).toBeDefined();

      const org = await dbService.organizations.findById(result.org.id);
      const swarm = await dbService.swarmConfigurations.findById(result.swarm.id);

      expect(org).toBeDefined();
      expect(swarm).toBeDefined();
    });

    it('should rollback on transaction failure', async () => {
      await dbService.initialize();

      const orgCountBefore = (await dbService.organizations.findAll()).length;

      try {
        await dbManager.transaction(async (client) => {
          // Create organization
          await dbService.organizations.create({
            name: 'Rollback Test Org',
            industry: 'Tech',
            size: 'small',
          });

          // Force an error
          throw new Error('Forced transaction failure');
        });
      } catch (error) {
        // Expected error
      }

      // Verify rollback
      const orgCountAfter = (await dbService.organizations.findAll()).length;
      expect(orgCountAfter).toBe(orgCountBefore);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle bulk operations efficiently', async () => {
      await dbService.initialize();

      const startTime = Date.now();
      const orgCount = 100;

      // Bulk create organizations
      const createPromises = Array(orgCount).fill(null).map((_, i) => 
        dbService.organizations.create({
          name: `Bulk Org ${i}`,
          industry: ['Tech', 'Finance', 'Healthcare'][i % 3],
          size: ['small', 'medium', 'large'][i % 3],
          metadata: { index: i },
        })
      );

      const orgs = await Promise.all(createPromises);
      const createTime = Date.now() - startTime;

      expect(orgs).toHaveLength(orgCount);
      expect(createTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Test bulk read performance
      const readStart = Date.now();
      const allOrgs = await dbService.organizations.findAll();
      const readTime = Date.now() - readStart;

      expect(allOrgs.length).toBeGreaterThanOrEqual(orgCount);
      expect(readTime).toBeLessThan(1000); // Should read all within 1 second
    });

    it('should maintain performance under concurrent load', async () => {
      await dbService.initialize();

      const concurrentOps = 50;
      const results: any[] = [];

      // Simulate concurrent operations
      const operations = Array(concurrentOps).fill(null).map((_, i) => {
        const opType = i % 3;
        
        switch (opType) {
          case 0: // Create
            return dbService.organizations.create({
              name: `Concurrent Org ${i}`,
              industry: 'Tech',
              size: 'medium',
            });
          case 1: // Read
            return dbService.organizations.findAll({ size: 'medium' });
          case 2: // Update
            return dbService.organizations.findAll().then(orgs => {
              if (orgs.length > 0) {
                return dbService.organizations.update(
                  orgs[0].id,
                  { metadata: { updated: i } }
                );
              }
            });
        }
      });

      const startTime = Date.now();
      const opResults = await Promise.allSettled(operations);
      const totalTime = Date.now() - startTime;

      const successful = opResults.filter(r => r.status === 'fulfilled').length;
      const failed = opResults.filter(r => r.status === 'rejected').length;

      expect(successful).toBeGreaterThan(concurrentOps * 0.9); // 90% success rate
      expect(totalTime).toBeLessThan(10000); // Complete within 10 seconds
    });
  });
});