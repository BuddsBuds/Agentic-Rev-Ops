import { SwarmCoordinator } from '@/swarm/coordinator/SwarmCoordinator';
import { EnhancedQueenAgent } from '@/swarm/queen/EnhancedQueenAgent';
import { DatabaseService } from '@/core/database/DatabaseService';
import { HITLSystem } from '@/workflow/hitl/HITLSystem';
import { WorkflowEngine } from '@/workflow/core/engine/workflow-engine';
import { IntegrationManager } from '@/workflow/integrations/integration-manager';
import { TestDatabaseHelper } from '@tests/utils/TestDatabaseHelper';
import { TestSwarmHelper } from '@tests/utils/TestSwarmHelper';
import { MockAPIServer } from '@tests/mocks/MockAPIServer';

/**
 * End-to-End tests for the complete Agentic RevOps system
 * Tests full workflows from request to completion
 */
describe('Agentic RevOps E2E Tests', () => {
  let swarmCoordinator: SwarmCoordinator;
  let queenAgent: EnhancedQueenAgent;
  let dbService: DatabaseService;
  let hitlSystem: HITLSystem;
  let workflowEngine: WorkflowEngine;
  let integrationManager: IntegrationManager;
  let testDbHelper: TestDatabaseHelper;
  let testSwarmHelper: TestSwarmHelper;
  let mockAPIServer: MockAPIServer;

  beforeAll(async () => {
    // Setup test environment
    testDbHelper = new TestDatabaseHelper();
    testSwarmHelper = new TestSwarmHelper();
    mockAPIServer = new MockAPIServer();

    // Start mock API server
    await mockAPIServer.start(3001);

    // Setup test database
    await testDbHelper.setupTestDatabase();

    // Initialize core services
    dbService = new DatabaseService();
    await dbService.initialize();

    // Initialize swarm
    queenAgent = new EnhancedQueenAgent('queen-e2e');
    swarmCoordinator = new SwarmCoordinator({
      queen: queenAgent,
      databaseService: dbService,
    });

    // Initialize HITL system
    hitlSystem = new HITLSystem();
    await hitlSystem.initialize();

    // Initialize workflow engine
    workflowEngine = new WorkflowEngine({
      swarmCoordinator,
      hitlSystem,
      databaseService: dbService,
    });

    // Initialize integration manager
    integrationManager = new IntegrationManager({
      apiEndpoint: 'http://localhost:3001',
    });

    // Seed test data
    await testDbHelper.seedBasicData();
    const swarmData = await testDbHelper.createSwarmTestData();
  }, 30000);

  afterAll(async () => {
    await mockAPIServer.stop();
    await testDbHelper.teardownTestDatabase();
    await swarmCoordinator.shutdown();
    await hitlSystem.shutdown();
  });

  describe('Complete Revenue Analysis Workflow', () => {
    it('should execute full revenue analysis pipeline', async () => {
      // Create workflow request
      const workflowRequest = {
        type: 'revenue-analysis',
        organizationId: 'org-1',
        parameters: {
          timeRange: { start: '2024-01-01', end: '2024-12-31' },
          includeForecasting: true,
          analysisDepth: 'comprehensive',
        },
        requester: 'user-1',
      };

      // Start workflow
      const workflow = await workflowEngine.createWorkflow(workflowRequest);
      expect(workflow.id).toBeDefined();
      expect(workflow.status).toBe('initialized');

      // Execute workflow
      const executionResult = await workflowEngine.executeWorkflow(workflow.id);

      // Verify workflow steps executed
      expect(executionResult.stepsCompleted).toContain('data-collection');
      expect(executionResult.stepsCompleted).toContain('data-validation');
      expect(executionResult.stepsCompleted).toContain('analysis');
      expect(executionResult.stepsCompleted).toContain('forecasting');
      expect(executionResult.stepsCompleted).toContain('report-generation');

      // Verify swarm participation
      const swarmMetrics = await swarmCoordinator.getMetrics();
      expect(swarmMetrics.decisionsProcessed).toBeGreaterThan(0);
      expect(swarmMetrics.consensusAchieved).toBeGreaterThan(0);

      // Verify results
      expect(executionResult.results).toMatchObject({
        revenue: {
          total: expect.any(Number),
          byMonth: expect.any(Array),
          byProduct: expect.any(Object),
          forecast: expect.any(Object),
        },
        insights: expect.any(Array),
        recommendations: expect.any(Array),
      });
    }, 60000);

    it('should handle human approval requirements', async () => {
      // Create workflow with approval requirement
      const workflowRequest = {
        type: 'budget-approval',
        organizationId: 'org-1',
        parameters: {
          amount: 150000,
          department: 'Marketing',
          requiresApproval: true,
        },
        requester: 'user-2',
      };

      const workflow = await workflowEngine.createWorkflow(workflowRequest);

      // Start execution
      const executionPromise = workflowEngine.executeWorkflow(workflow.id);

      // Wait for HITL request
      await testSwarmHelper.waitForCondition(() => {
        const pendingRequests = hitlSystem.getPendingRequests();
        return pendingRequests.length > 0;
      });

      // Simulate human approval
      const pendingRequests = hitlSystem.getPendingRequests();
      const approvalRequest = pendingRequests[0];

      await hitlSystem.processReview({
        taskId: approvalRequest.id,
        reviewerId: 'human-approver',
        decision: 'approved',
        feedback: 'Budget approved for Q1 campaigns',
        timestamp: new Date(),
      });

      // Complete workflow
      const result = await executionPromise;

      expect(result.status).toBe('completed');
      expect(result.results.approved).toBe(true);
      expect(result.stepsCompleted).toContain('human-approval');
    }, 45000);
  });

  describe('CRM Integration Workflow', () => {
    it('should sync and analyze CRM data', async () => {
      // Setup mock CRM data
      mockAPIServer.addEndpoint('/crm/contacts', {
        method: 'GET',
        response: {
          contacts: [
            { id: '1', name: 'John Doe', value: 50000, stage: 'qualified' },
            { id: '2', name: 'Jane Smith', value: 75000, stage: 'negotiation' },
            { id: '3', name: 'Bob Johnson', value: 100000, stage: 'proposal' },
          ],
        },
      });

      // Create CRM sync workflow
      const workflowRequest = {
        type: 'crm-sync-analysis',
        organizationId: 'org-1',
        parameters: {
          crmSystem: 'salesforce',
          syncType: 'full',
          analyzeOpportunities: true,
        },
        requester: 'user-1',
      };

      const workflow = await workflowEngine.createWorkflow(workflowRequest);
      const result = await workflowEngine.executeWorkflow(workflow.id);

      // Verify sync completed
      expect(result.stepsCompleted).toContain('crm-connection');
      expect(result.stepsCompleted).toContain('data-sync');
      expect(result.stepsCompleted).toContain('opportunity-analysis');

      // Verify analysis results
      expect(result.results).toMatchObject({
        syncedContacts: 3,
        totalPipelineValue: 225000,
        opportunitiesByStage: {
          qualified: 1,
          negotiation: 1,
          proposal: 1,
        },
        recommendations: expect.arrayContaining([
          expect.objectContaining({
            type: 'follow-up',
            priority: 'high',
          }),
        ]),
      });
    });
  });

  describe('Swarm Decision Making', () => {
    it('should handle complex multi-agent decisions', async () => {
      // Create decision request
      const decisionRequest = {
        type: 'strategic-decision',
        context: {
          decision: 'market-expansion',
          options: [
            { market: 'Europe', investment: 500000, risk: 'medium' },
            { market: 'Asia', investment: 750000, risk: 'high' },
            { market: 'South America', investment: 300000, risk: 'low' },
          ],
        },
        requiresConsensus: true,
        consensusThreshold: 0.7,
      };

      // Submit to swarm
      const decision = await swarmCoordinator.processDecision(decisionRequest);

      // Verify consensus was achieved
      expect(decision.consensusAchieved).toBe(true);
      expect(decision.consensusScore).toBeGreaterThanOrEqual(0.7);

      // Verify multiple agents participated
      expect(decision.participatingAgents).toContain('queen-e2e');
      expect(decision.participatingAgents.length).toBeGreaterThanOrEqual(3);

      // Verify decision quality
      expect(decision.selectedOption).toBeDefined();
      expect(decision.rationale).toBeDefined();
      expect(decision.riskAssessment).toBeDefined();
    });

    it('should handle decision conflicts and escalation', async () => {
      // Create conflicting decision scenario
      const conflictRequest = {
        type: 'resource-allocation',
        context: {
          totalBudget: 100000,
          requests: [
            { department: 'Sales', requested: 60000 },
            { department: 'Marketing', requested: 50000 },
            { department: 'R&D', requested: 40000 },
          ],
        },
        requiresConsensus: true,
        consensusThreshold: 0.8, // High threshold likely to cause conflict
      };

      const decision = await swarmCoordinator.processDecision(conflictRequest);

      // If consensus not achieved, should escalate to HITL
      if (!decision.consensusAchieved) {
        expect(decision.escalatedToHuman).toBe(true);
        expect(decision.escalationReason).toContain('consensus threshold');
      } else {
        // If consensus achieved, verify allocation
        const totalAllocated = Object.values(decision.allocation as Record<string, number>)
          .reduce((sum, val) => sum + val, 0);
        expect(totalAllocated).toBeLessThanOrEqual(100000);
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-volume concurrent workflows', async () => {
      const workflowCount = 20;
      const workflows: any[] = [];

      // Create multiple concurrent workflows
      const workflowPromises = Array(workflowCount).fill(null).map((_, i) => 
        workflowEngine.createWorkflow({
          type: 'data-processing',
          organizationId: 'org-1',
          parameters: {
            dataSize: 'large',
            priority: i % 3 === 0 ? 'high' : 'normal',
          },
          requester: `user-${i % 3 + 1}`,
        })
      );

      workflows.push(...await Promise.all(workflowPromises));

      // Execute all workflows concurrently
      const startTime = Date.now();
      const executionPromises = workflows.map(w => 
        workflowEngine.executeWorkflow(w.id)
      );

      const results = await Promise.allSettled(executionPromises);
      const executionTime = Date.now() - startTime;

      // Verify performance
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThanOrEqual(workflowCount * 0.95); // 95% success rate
      expect(executionTime).toBeLessThan(30000); // Complete within 30 seconds

      // Verify system remained stable
      const systemHealth = await swarmCoordinator.getHealthStatus();
      expect(systemHealth.status).toBe('healthy');
      expect(systemHealth.activeAgents).toBeGreaterThan(0);
    }, 45000);

    it('should maintain data consistency under load', async () => {
      const operations = 50;
      const orgId = 'org-1';

      // Get initial state
      const initialOrg = await dbService.organizations.findById(orgId);
      const initialMetadata = initialOrg?.metadata || {};

      // Perform concurrent updates
      const updatePromises = Array(operations).fill(null).map((_, i) => 
        dbService.organizations.update(orgId, {
          metadata: {
            ...initialMetadata,
            [`counter_${i % 5}`]: (initialMetadata[`counter_${i % 5}`] || 0) + 1,
          },
        })
      );

      await Promise.allSettled(updatePromises);

      // Verify final state
      const finalOrg = await dbService.organizations.findById(orgId);
      const finalMetadata = finalOrg?.metadata || {};

      // Each counter should have been incremented by the number of operations targeting it
      for (let i = 0; i < 5; i++) {
        const expectedCount = Math.floor(operations / 5);
        const actualCount = finalMetadata[`counter_${i}`] || 0;
        // Allow for some operations to fail due to optimistic locking
        expect(actualCount).toBeGreaterThanOrEqual(expectedCount * 0.8);
      }
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from agent failures', async () => {
      // Simulate agent failure during workflow
      const workflow = await workflowEngine.createWorkflow({
        type: 'resilience-test',
        organizationId: 'org-1',
        parameters: {
          simulateFailure: true,
          failurePoint: 'mid-execution',
        },
        requester: 'user-1',
      });

      // Inject agent failure
      setTimeout(() => {
        testSwarmHelper.simulateAgentFailure('specialist-1');
      }, 2000);

      const result = await workflowEngine.executeWorkflow(workflow.id);

      // Workflow should complete despite failure
      expect(result.status).toBe('completed');
      expect(result.recoveryActions).toContain('agent-replacement');
      expect(result.affectedAgents).toContain('specialist-1');
    });

    it('should handle database connection issues', async () => {
      // Temporarily disrupt database connection
      const disruptionPromise = testDbHelper.simulateConnectionIssue(5000); // 5 second disruption

      // Try to execute workflow during disruption
      const workflow = await workflowEngine.createWorkflow({
        type: 'database-resilience',
        organizationId: 'org-1',
        parameters: {},
        requester: 'user-1',
      });

      const result = await workflowEngine.executeWorkflow(workflow.id);

      // Should complete with retries
      expect(result.status).toBe('completed');
      expect(result.retryAttempts).toBeGreaterThan(0);
      expect(result.warnings).toContain('database-connection-retry');

      await disruptionPromise;
    });
  });

  describe('Integration Endpoints', () => {
    it('should integrate with multiple external systems', async () => {
      // Setup mock endpoints for various integrations
      mockAPIServer.addEndpoint('/asana/tasks', {
        method: 'GET',
        response: { tasks: [{ id: '1', name: 'Test Task' }] },
      });

      mockAPIServer.addEndpoint('/slack/messages', {
        method: 'POST',
        response: { success: true, messageId: 'msg-123' },
      });

      mockAPIServer.addEndpoint('/analytics/revenue', {
        method: 'GET',
        response: { revenue: 1500000, trend: 'increasing' },
      });

      // Execute multi-integration workflow
      const workflow = await workflowEngine.createWorkflow({
        type: 'multi-integration',
        organizationId: 'org-1',
        parameters: {
          integrations: ['asana', 'slack', 'analytics'],
          actions: [
            { integration: 'asana', action: 'fetch-tasks' },
            { integration: 'analytics', action: 'get-revenue' },
            { integration: 'slack', action: 'send-summary' },
          ],
        },
        requester: 'user-1',
      });

      const result = await workflowEngine.executeWorkflow(workflow.id);

      // Verify all integrations were successful
      expect(result.integrationResults).toMatchObject({
        asana: { success: true, tasksFound: 1 },
        analytics: { success: true, revenue: 1500000 },
        slack: { success: true, messageSent: true },
      });
    });
  });
});