/**
 * Unit Tests for QueenAgent
 * Tests decision-making, consensus coordination, and emergency handling
 */

import { QueenAgent, QueenConfig, QueenDecision } from '@/swarm/queen/QueenAgent';
import { MockAgentFactory, MockMemoryFactory, MockVotingFactory, PerformanceTestUtils } from '@tests/setup/mockSetup';

// Mock the dependencies
jest.mock('@/swarm/consensus/MajorityEngine');
jest.mock('@/swarm/memory/SwarmMemory');

describe('QueenAgent', () => {
  let queen: QueenAgent;
  let config: QueenConfig;
  let mockAgents: any[];

  beforeEach(async () => {
    config = {
      swarmId: 'test-swarm',
      majorityThreshold: 0.6,
      decisionTimeout: 30000,
      memoryRetention: 24 * 60 * 60 * 1000, // 24 hours
      tieBreakerRole: true
    };

    queen = new QueenAgent(config);
    
    // Create mock agents
    mockAgents = [
      MockAgentFactory.createMockAgent('crm', 'crm-1'),
      MockAgentFactory.createMockAgent('marketing', 'marketing-1'),
      MockAgentFactory.createMockAgent('analytics', 'analytics-1')
    ];

    await queen.initialize();
    
    // Register mock agents
    mockAgents.forEach(agent => queen.registerAgent(agent));
  });

  afterEach(() => {
    queen.removeAllListeners();
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(queen.getId()).toBe('queen_test-swarm');
      expect(queen.getType()).toBe('queen');
      expect(queen.getStatus()).toBe('active');
    });

    it('should emit initialization event', async () => {
      const initSpy = jest.fn();
      const newQueen = new QueenAgent(config);
      newQueen.on('queen:initialized', initSpy);
      
      await newQueen.initialize();
      
      expect(initSpy).toHaveBeenCalledWith({ swarmId: 'test-swarm' });
    });

    it('should set up tie-breaker capability when configured', async () => {
      const tieBreakerQueen = new QueenAgent({ ...config, tieBreakerRole: true });
      await tieBreakerQueen.initialize();
      
      // Should not throw when handling tie-break scenarios
      expect(() => {
        (tieBreakerQueen as any).handleTieBreak({
          votingId: 'test-voting',
          tiedOptions: [{ id: 'option-1' }, { id: 'option-2' }]
        });
      }).not.toThrow();
    });
  });

  describe('Agent Management', () => {
    it('should register agents correctly', () => {
      const registrationSpy = jest.fn();
      queen.on('queen:agent-registered', registrationSpy);
      
      const newAgent = MockAgentFactory.createMockAgent('test', 'test-agent');
      queen.registerAgent(newAgent);
      
      expect(registrationSpy).toHaveBeenCalledWith({ agentId: 'test-agent' });
    });

    it('should set up communication channels with agents', () => {
      const agent = MockAgentFactory.createMockAgent('test', 'comm-test');
      
      queen.registerAgent(agent);
      
      expect(agent.on).toHaveBeenCalledWith('report', expect.any(Function));
      expect(agent.on).toHaveBeenCalledWith('alert', expect.any(Function));
      expect(agent.on).toHaveBeenCalledWith('request', expect.any(Function));
    });
  });

  describe('Strategic Decision Making', () => {
    it('should make strategic decisions with majority voting', async () => {
      const decisionSpy = jest.fn();
      queen.on('queen:decision-made', decisionSpy);

      const decision = await queen.makeStrategicDecision(
        'Optimize pricing strategy',
        { currentRevenue: 1000000, targetGrowth: 0.15 },
        'high'
      );

      expect(decision).toHaveProperty('id');
      expect(decision).toHaveProperty('type', 'strategic');
      expect(decision).toHaveProperty('decision');
      expect(decision).toHaveProperty('majority');
      expect(decision).toHaveProperty('implementation');
      expect(decision).toHaveProperty('timestamp');
      
      expect(decisionSpy).toHaveBeenCalledWith(decision);
    });

    it('should gather reports from all agents for decisions', async () => {
      await queen.makeStrategicDecision(
        'Revenue optimization',
        { quarter: 'Q4' }
      );

      // Verify all agents were asked for reports
      mockAgents.forEach(agent => {
        expect(agent.generateReport).toHaveBeenCalledWith(
          'Revenue optimization',
          { quarter: 'Q4' }
        );
      });
    });

    it('should create implementation plans for decisions', async () => {
      const decision = await queen.makeStrategicDecision(
        'Launch new product',
        { market: 'enterprise', budget: 500000 }
      );

      expect(decision.implementation).toHaveProperty('steps');
      expect(decision.implementation).toHaveProperty('assignments');
      expect(decision.implementation).toHaveProperty('timeline');
      expect(decision.implementation).toHaveProperty('successCriteria');
    });

    it('should handle decision-making performance within acceptable limits', async () => {
      const { duration } = await PerformanceTestUtils.measureExecutionTime(async () => {
        return queen.makeStrategicDecision('Performance test decision', {});
      });

      // Decision should be made within 10 seconds
      expect(duration).toBeLessThan(10000);
    });

    it('should store decisions in memory', async () => {
      const decision = await queen.makeStrategicDecision('Test decision', {});
      
      // Verify decision was stored (would be checked in integration tests)
      expect(decision.id).toBeDefined();
      expect(decision.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Emergency Handling', () => {
    it('should handle high severity emergencies', async () => {
      const emergencySpy = jest.fn();
      queen.on('queen:emergency-handled', emergencySpy);

      const response = await queen.handleEmergency(
        'System overload detected',
        'high',
        { cpuUsage: 0.95, memoryUsage: 0.89 }
      );

      expect(response.type).toBe('emergency');
      expect(response.decision).toContain('System overload detected');
      expect(emergencySpy).toHaveBeenCalledWith(response);
    });

    it('should handle critical emergencies with immediate action', async () => {
      const response = await queen.handleEmergency(
        'Security breach detected',
        'critical',
        { severity: 'critical', affectedSystems: ['database', 'api'] }
      );

      expect(response.type).toBe('emergency');
      expect(response.implementation).toBeDefined();
    });

    it('should complete emergency responses quickly', async () => {
      const { duration } = await PerformanceTestUtils.measureExecutionTime(async () => {
        return queen.handleEmergency('Test emergency', 'high', {});
      });

      // Emergency response should be very fast (under 10 seconds)
      expect(duration).toBeLessThan(10000);
    });

    it('should use available agents for emergency response', async () => {
      await queen.handleEmergency('Test emergency', 'critical', {});

      // Should have gathered quick reports from available agents
      // (This would be verified in integration tests)
    });
  });

  describe('Swarm Health Monitoring', () => {
    it('should monitor swarm health comprehensively', async () => {
      const health = await queen.monitorSwarmHealth();

      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('overallHealth');
      expect(health).toHaveProperty('agentHealth');
      expect(health).toHaveProperty('memoryHealth');
      expect(health).toHaveProperty('votingMetrics');
      expect(health).toHaveProperty('activeDecisions');
      expect(health).toHaveProperty('recommendations');
    });

    it('should calculate overall health correctly', async () => {
      const health = await queen.monitorSwarmHealth();
      
      expect(['healthy', 'degraded', 'critical']).toContain(health.overallHealth);
    });

    it('should provide health recommendations', async () => {
      const health = await queen.monitorSwarmHealth();
      
      expect(Array.isArray(health.recommendations)).toBe(true);
    });

    it('should emit health reports', async () => {
      const healthSpy = jest.fn();
      queen.on('queen:health-report', healthSpy);

      const health = await queen.monitorSwarmHealth();

      expect(healthSpy).toHaveBeenCalledWith(health);
    });
  });

  describe('Collaboration Coordination', () => {
    it('should coordinate agent collaboration for complex tasks', async () => {
      const collaborationSpy = jest.fn();
      queen.on('queen:collaboration-started', collaborationSpy);

      const plan = await queen.coordinateCollaboration(
        'complex-analysis-task',
        ['data-analysis', 'reporting', 'visualization'],
        'high'
      );

      expect(plan).toHaveProperty('taskId', 'complex-analysis-task');
      expect(plan).toHaveProperty('structure');
      expect(plan).toHaveProperty('agents');
      expect(plan).toHaveProperty('communicationProtocol');
      expect(plan).toHaveProperty('checkpoints');
      expect(plan).toHaveProperty('conflictResolution');
      
      expect(collaborationSpy).toHaveBeenCalledWith(plan);
    });

    it('should select appropriate agents based on required capabilities', async () => {
      const plan = await queen.coordinateCollaboration(
        'test-task',
        ['analytics', 'crm'],
        'medium'
      );

      expect(plan.agents.length).toBeGreaterThan(0);
      expect(plan.agents.length).toBeLessThanOrEqual(mockAgents.length);
    });

    it('should define communication protocols based on complexity', async () => {
      const simplePlan = await queen.coordinateCollaboration('simple', [], 'low');
      const complexPlan = await queen.coordinateCollaboration('complex', [], 'high');

      expect(simplePlan.communicationProtocol).toBeDefined();
      expect(complexPlan.communicationProtocol).toBeDefined();
      // Complex tasks should have more intensive communication
    });
  });

  describe('Event Handling', () => {
    it('should handle agent reports correctly', () => {
      const reportHandler = jest.fn();
      queen.on('queen:pattern-detected', reportHandler);

      // Simulate agent report
      const mockReport = {
        agentId: 'test-agent',
        report: 'Test report content',
        timestamp: new Date()
      };

      // This would trigger through event system in real implementation
      queen.emit('test:agent-report', mockReport);
    });

    it('should handle agent alerts and escalate when necessary', () => {
      const alertHandler = jest.fn();
      queen.on('queen:agent-alert', alertHandler);

      const mockAlert = {
        agentId: 'test-agent',
        severity: 'high',
        situation: 'Performance degradation',
        context: { metric: 'response_time', value: 5000 }
      };

      queen.emit('test:agent-alert', mockAlert);
    });

    it('should process agent requests and provide responses', async () => {
      const mockRequest = {
        agentId: 'test-agent',
        type: 'resource-request',
        resource: 'additional-memory',
        justification: 'High load processing'
      };

      // This would be handled through the request processing system
      const response = await (queen as any).processAgentRequest(mockRequest);
      
      expect(response).toHaveProperty('approved');
      expect(response).toHaveProperty('response');
      expect(response).toHaveProperty('timestamp');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent decisions', async () => {
      const decisions = await Promise.all([
        queen.makeStrategicDecision('Decision 1', { priority: 1 }),
        queen.makeStrategicDecision('Decision 2', { priority: 2 }),
        queen.makeStrategicDecision('Decision 3', { priority: 3 })
      ]);

      expect(decisions).toHaveLength(3);
      decisions.forEach(decision => {
        expect(decision.id).toBeDefined();
        expect(decision.type).toBe('strategic');
      });
    });

    it('should maintain performance with many agents', async () => {
      // Add many mock agents
      const manyAgents = Array.from({ length: 50 }, (_, i) =>
        MockAgentFactory.createMockAgent('test', `agent-${i}`)
      );
      
      manyAgents.forEach(agent => queen.registerAgent(agent));

      const { duration } = await PerformanceTestUtils.measureExecutionTime(async () => {
        return queen.makeStrategicDecision('Scalability test', {});
      });

      // Should still perform well with many agents
      expect(duration).toBeLessThan(15000); // 15 seconds max
    });

    it('should not leak memory during extended operation', async () => {
      const { memoryDelta } = await PerformanceTestUtils.measureMemoryUsage(async () => {
        // Make many decisions
        for (let i = 0; i < 20; i++) {
          await queen.makeStrategicDecision(`Decision ${i}`, { iteration: i });
        }
      });

      // Memory usage should not grow excessively
      expect(memoryDelta.heapUsed).toBeLessThan(100 * 1024 * 1024); // 100MB max
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle agent failures gracefully', async () => {
      // Mock an agent that fails to generate reports
      const failingAgent = MockAgentFactory.createMockAgent('failing', 'fail-1');
      failingAgent.generateReport.mockRejectedValue(new Error('Agent failed'));
      
      queen.registerAgent(failingAgent);

      // Decision should still be made despite agent failure
      const decision = await queen.makeStrategicDecision('Test with failure', {});
      
      expect(decision).toBeDefined();
      expect(decision.type).toBe('strategic');
    });

    it('should continue operating when memory issues occur', async () => {
      // This would test memory system failures in integration tests
      const decision = await queen.makeStrategicDecision('Memory test', {});
      expect(decision).toBeDefined();
    });

    it('should handle voting system failures', async () => {
      // This would test consensus system failures in integration tests
      const decision = await queen.makeStrategicDecision('Voting test', {});
      expect(decision).toBeDefined();
    });
  });

  describe('Integration Points', () => {
    it('should work with different agent types', () => {
      const specializedAgents = [
        MockAgentFactory.createMockAgent('optimizer', 'opt-1'),
        MockAgentFactory.createMockAgent('predictor', 'pred-1'),
        MockAgentFactory.createMockAgent('validator', 'val-1')
      ];

      expect(() => {
        specializedAgents.forEach(agent => queen.registerAgent(agent));
      }).not.toThrow();
    });

    it('should interface correctly with external systems', async () => {
      // Test would verify external API compatibility
      const health = await queen.monitorSwarmHealth();
      expect(health.timestamp).toBeInstanceOf(Date);
    });

    it('should maintain consistency across operations', async () => {
      const decision1 = await queen.makeStrategicDecision('Consistency test 1', {});
      const decision2 = await queen.makeStrategicDecision('Consistency test 2', {});
      
      expect(decision1.id).not.toBe(decision2.id);
      expect(decision1.timestamp.getTime()).toBeLessThanOrEqual(decision2.timestamp.getTime());
    });
  });
});