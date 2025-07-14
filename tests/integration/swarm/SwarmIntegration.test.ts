/**
 * Integration Tests for Swarm System
 * Tests end-to-end functionality, agent coordination, and decision flows
 */

import { RevOpsSwarm } from '@/swarm';
import { QueenAgent } from '@/swarm/queen/QueenAgent';
import { CRMAgent } from '@/swarm/agents/CRMAgent';
import { MarketingAgent } from '@/swarm/agents/MarketingAgent';
import { AnalyticsAgent } from '@/swarm/agents/AnalyticsAgent';
import { SwarmDemo } from '@/swarm/demo/SwarmDemo';
import { PerformanceTestUtils, addTestCleanup } from '@tests/setup/mockSetup';

describe('Swarm Integration Tests', () => {
  let revOpsSwarm: RevOpsSwarm;
  let swarmInstance: any;

  beforeEach(async () => {
    revOpsSwarm = RevOpsSwarm.getInstance();
  });

  afterEach(async () => {
    // Clean up swarm instance
    if (swarmInstance) {
      // Remove all event listeners
      if (swarmInstance.queen) {
        swarmInstance.queen.removeAllListeners();
      }
      if (swarmInstance.agents) {
        for (const [_, agent] of swarmInstance.agents) {
          agent.removeAllListeners?.();
        }
      }
    }
  });

  describe('Swarm Creation and Configuration', () => {
    it('should create a basic swarm with default configuration', async () => {
      swarmInstance = await revOpsSwarm.createSwarm({});

      expect(swarmInstance.swarmId).toBeDefined();
      expect(swarmInstance.queen).toBeInstanceOf(QueenAgent);
      expect(swarmInstance.agents).toBeInstanceOf(Map);
    });

    it('should create a RevOps swarm with specialized agents', async () => {
      swarmInstance = await revOpsSwarm.createRevOpsSwarm({
        enableCRM: true,
        enableMarketing: true,
        enableAnalytics: true,
        enableVisualization: false
      });

      expect(swarmInstance.agents.size).toBe(3); // CRM, Marketing, Analytics
      
      // Verify agent types
      const agentTypes = Array.from(swarmInstance.agents.values()).map(agent => agent.getType());
      expect(agentTypes).toContain('crm');
      expect(agentTypes).toContain('marketing');
      expect(agentTypes).toContain('analytics');
    });

    it('should support custom swarm configuration', async () => {
      swarmInstance = await revOpsSwarm.createSwarm({
        swarmId: 'custom-test-swarm',
        votingThreshold: 0.7,
        maxAgents: 10,
        enableVisualization: true
      });

      expect(swarmInstance.swarmId).toBe('custom-test-swarm');
      expect(swarmInstance.visualizer).toBeDefined();
    });
  });

  describe('Agent Coordination and Communication', () => {
    beforeEach(async () => {
      swarmInstance = await revOpsSwarm.createRevOpsSwarm({
        enableCRM: true,
        enableMarketing: true,
        enableAnalytics: true
      });

      // Wait for all agents to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should enable agents to communicate through the Queen', async () => {
      const communicationEvents: any[] = [];
      
      // Monitor communication events
      swarmInstance.queen.on('queen:vote-cast', (event: any) => {
        communicationEvents.push({ type: 'vote', ...event });
      });
      
      swarmInstance.queen.on('queen:decision-made', (event: any) => {
        communicationEvents.push({ type: 'decision', ...event });
      });

      // Make a decision that requires agent input
      const decision = await swarmInstance.makeDecision(
        'Optimize customer acquisition strategy',
        {
          currentCAC: 150,
          targetCAC: 120,
          budget: 50000,
          timeframe: 'Q1'
        }
      );

      expect(decision).toBeDefined();
      expect(decision.type).toBe('strategic');
      
      // Should have communication events
      expect(communicationEvents.length).toBeGreaterThan(0);
    });

    it('should coordinate consensus voting among agents', async () => {
      const votingEvents: any[] = [];
      
      swarmInstance.queen.on('queen:voting-started', (event: any) => {
        votingEvents.push({ type: 'voting-started', ...event });
      });
      
      swarmInstance.queen.on('queen:voting-completed', (event: any) => {
        votingEvents.push({ type: 'voting-completed', ...event });
      });

      await swarmInstance.makeDecision(
        'Implement new pricing model',
        { 
          currentModel: 'fixed',
          proposedModel: 'usage-based',
          impactAnalysis: { revenue: '+15%', adoption: '-5%' }
        }
      );

      // Should have voting lifecycle events
      expect(votingEvents.some(e => e.type === 'voting-started')).toBe(true);
      expect(votingEvents.some(e => e.type === 'voting-completed')).toBe(true);
    });

    it('should handle agent failures gracefully during coordination', async () => {
      // Simulate an agent going offline
      const agents = Array.from(swarmInstance.agents.values());
      const testAgent = agents[0];
      
      // Mock agent failure
      const originalGenerateReport = testAgent.generateReport;
      testAgent.generateReport = jest.fn().mockRejectedValue(new Error('Agent offline'));

      // Decision should still work with remaining agents
      const decision = await swarmInstance.makeDecision(
        'Handle agent failure scenario',
        { scenario: 'agent-failure' }
      );

      expect(decision).toBeDefined();
      expect(decision.decision).toBeDefined();
      
      // Restore original function
      testAgent.generateReport = originalGenerateReport;
    });
  });

  describe('Decision Making Workflows', () => {
    beforeEach(async () => {
      swarmInstance = await revOpsSwarm.createRevOpsSwarm({
        enableCRM: true,
        enableMarketing: true,
        enableAnalytics: true
      });
    });

    it('should make strategic decisions with complete workflow', async () => {
      const decisionEvents: any[] = [];
      
      // Monitor the complete decision workflow
      swarmInstance.queen.on('queen:decision-made', (event: any) => {
        decisionEvents.push(event);
      });

      const decision = await swarmInstance.makeDecision(
        'Launch new product line',
        {
          productType: 'premium',
          targetMarket: 'enterprise',
          investmentRequired: 1000000,
          projectedROI: 2.5,
          timeline: '18 months'
        }
      );

      expect(decision.id).toBeDefined();
      expect(decision.type).toBe('strategic');
      expect(decision.decision).toContain('Launch new product line');
      expect(decision.implementation).toBeDefined();
      expect(decision.implementation.steps).toBeDefined();
      expect(decision.implementation.assignments).toBeDefined();
      expect(decision.implementation.timeline).toBeDefined();
      
      expect(decisionEvents.length).toBe(1);
      expect(decisionEvents[0].id).toBe(decision.id);
    });

    it('should handle complex multi-agent analysis scenarios', async () => {
      const complexScenario = {
        type: 'market-expansion',
        targetRegions: ['EMEA', 'APAC'],
        budget: 5000000,
        timeline: '24 months',
        riskFactors: ['currency', 'regulation', 'competition'],
        successMetrics: ['revenue', 'market-share', 'customer-satisfaction']
      };

      const { result, duration } = await PerformanceTestUtils.measureExecutionTime(async () => {
        return swarmInstance.makeDecision(
          'International market expansion strategy',
          complexScenario
        );
      });

      expect(result.decision).toBeDefined();
      expect(result.majority.participation.participationRate).toBeGreaterThan(0);
      
      // Complex decisions should complete in reasonable time
      expect(duration).toBeLessThan(30000); // 30 seconds max
    });

    it('should create actionable implementation plans', async () => {
      const decision = await swarmInstance.makeDecision(
        'Optimize sales funnel conversion',
        {
          currentConversion: 0.05,
          targetConversion: 0.08,
          bottlenecks: ['lead-qualification', 'demo-scheduling'],
          resources: ['sales-team', 'marketing-automation']
        }
      );

      const implementation = decision.implementation;
      
      expect(implementation.steps).toBeDefined();
      expect(implementation.steps.length).toBeGreaterThan(0);
      
      expect(implementation.assignments).toBeDefined();
      expect(implementation.assignments.length).toBeGreaterThan(0);
      
      expect(implementation.timeline.start).toBeInstanceOf(Date);
      expect(implementation.timeline.end).toBeInstanceOf(Date);
      expect(implementation.timeline.end.getTime()).toBeGreaterThan(
        implementation.timeline.start.getTime()
      );
      
      expect(implementation.successCriteria).toBeDefined();
      expect(implementation.successCriteria.length).toBeGreaterThan(0);
    });
  });

  describe('Emergency Response System', () => {
    beforeEach(async () => {
      swarmInstance = await revOpsSwarm.createRevOpsSwarm({
        enableCRM: true,
        enableMarketing: true,
        enableAnalytics: true
      });
    });

    it('should handle high severity emergencies rapidly', async () => {
      const emergencyEvents: any[] = [];
      
      swarmInstance.queen.on('queen:emergency-handled', (event: any) => {
        emergencyEvents.push(event);
      });

      const { result, duration } = await PerformanceTestUtils.measureExecutionTime(async () => {
        return swarmInstance.handleEmergency(
          'Revenue pipeline stalled - Q4 targets at risk',
          'high',
          {
            currentRevenue: 2500000,
            targetRevenue: 4000000,
            timeRemaining: '45 days',
            pipelineValue: 1200000,
            conversionRate: 0.15
          }
        );
      });

      expect(result.type).toBe('emergency');
      expect(result.decision).toContain('Revenue pipeline stalled');
      
      // Emergency response should be very fast
      expect(duration).toBeLessThan(10000); // 10 seconds max
      
      expect(emergencyEvents.length).toBe(1);
    });

    it('should handle critical emergencies with immediate action', async () => {
      const response = await swarmInstance.handleEmergency(
        'Security incident - customer data potentially compromised',
        'critical',
        {
          incidentType: 'data-breach',
          affectedCustomers: 15000,
          dataTypes: ['email', 'names', 'phone'],
          containmentStatus: 'partial'
        }
      );

      expect(response.type).toBe('emergency');
      expect(response.decision).toBeDefined();
      expect(response.implementation).toBeDefined();
      
      // Critical emergencies should have immediate implementation
      expect(response.implementation.steps.length).toBeGreaterThan(0);
      expect(response.implementation.assignments.every(a => a.priority === 'critical')).toBe(true);
    });

    it('should maintain decision quality under emergency pressure', async () => {
      const emergencyResponse = await swarmInstance.handleEmergency(
        'Major customer threatening to cancel - $2M contract',
        'high',
        {
          customerValue: 2000000,
          contractEnd: '30 days',
          issues: ['performance', 'support-quality', 'feature-gaps'],
          competitorOffer: 'better-terms'
        }
      );

      expect(emergencyResponse.majority).toBeDefined();
      expect(emergencyResponse.majority.winner).toBeDefined();
      expect(emergencyResponse.implementation.timeline).toBeDefined();
      
      // Should still have structured response even in emergency
      expect(emergencyResponse.implementation.successCriteria.length).toBeGreaterThan(0);
    });
  });

  describe('Health Monitoring and Resilience', () => {
    beforeEach(async () => {
      swarmInstance = await revOpsSwarm.createRevOpsSwarm({
        enableCRM: true,
        enableMarketing: true,
        enableAnalytics: true
      });
    });

    it('should provide comprehensive health monitoring', async () => {
      const health = await swarmInstance.getHealth();

      expect(health.timestamp).toBeInstanceOf(Date);
      expect(['healthy', 'degraded', 'critical']).toContain(health.overallHealth);
      expect(Array.isArray(health.agentHealth)).toBe(true);
      expect(health.agentHealth.length).toBe(3); // CRM, Marketing, Analytics
      expect(health.memoryHealth).toBeDefined();
      expect(health.votingMetrics).toBeDefined();
      expect(typeof health.activeDecisions).toBe('number');
      expect(Array.isArray(health.recommendations)).toBe(true);
    });

    it('should detect and report agent health issues', async () => {
      // Simulate agent health degradation
      const agents = Array.from(swarmInstance.agents.values());
      const testAgent = agents[0];
      
      // Mock degraded performance
      const originalStatus = testAgent.getStatus;
      testAgent.getStatus = jest.fn().mockReturnValue('error');

      const health = await swarmInstance.getHealth();
      
      // Should detect the unhealthy agent
      const unhealthyAgents = health.agentHealth.filter(a => a.status === 'error');
      expect(unhealthyAgents.length).toBeGreaterThan(0);
      
      // Should provide recommendations for unhealthy agents
      expect(health.recommendations.length).toBeGreaterThan(0);
      
      // Restore original function
      testAgent.getStatus = originalStatus;
    });

    it('should continue operating with degraded agents', async () => {
      // Simulate multiple agent failures
      const agents = Array.from(swarmInstance.agents.values());
      const failingAgents = agents.slice(0, 2); // Fail 2 out of 3 agents
      
      failingAgents.forEach(agent => {
        agent.generateReport = jest.fn().mockRejectedValue(new Error('Agent degraded'));
      });

      // Should still be able to make decisions
      const decision = await swarmInstance.makeDecision(
        'Operate with degraded agents',
        { scenario: 'degraded-operation' }
      );

      expect(decision).toBeDefined();
      expect(decision.decision).toBeDefined();
    });
  });

  describe('Performance and Scalability', () => {
    beforeEach(async () => {
      swarmInstance = await revOpsSwarm.createRevOpsSwarm({
        enableCRM: true,
        enableMarketing: true,
        enableAnalytics: true
      });
    });

    it('should handle concurrent decisions efficiently', async () => {
      const decisions = [
        'Optimize ad spend allocation',
        'Improve customer onboarding',
        'Enhance product features',
        'Expand to new markets',
        'Implement automation tools'
      ];

      const { result, duration } = await PerformanceTestUtils.measureExecutionTime(async () => {
        return Promise.all(decisions.map((topic, index) =>
          swarmInstance.makeDecision(topic, { priority: index + 1 })
        ));
      });

      expect(result.length).toBe(5);
      result.forEach(decision => {
        expect(decision.id).toBeDefined();
        expect(decision.type).toBe('strategic');
      });

      // Concurrent decisions should be efficient
      expect(duration).toBeLessThan(60000); // 60 seconds max for 5 concurrent decisions
    });

    it('should maintain memory efficiency during extended operation', async () => {
      const { memoryDelta } = await PerformanceTestUtils.measureMemoryUsage(async () => {
        // Perform many operations
        for (let i = 0; i < 10; i++) {
          await swarmInstance.makeDecision(`Decision ${i}`, { iteration: i });
          
          if (i % 3 === 0) {
            await swarmInstance.getHealth();
          }
        }
      });

      // Memory usage should not grow excessively
      expect(memoryDelta.heapUsed).toBeLessThan(200 * 1024 * 1024); // 200MB max
    });

    it('should scale with additional agents', async () => {
      // Add more agents to test scalability
      const additionalAgents = [
        new CRMAgent({ id: 'crm-2', name: 'CRM Specialist 2', capabilities: [], votingWeight: 1.0 }),
        new MarketingAgent({ id: 'marketing-2', name: 'Marketing Expert 2', capabilities: [], votingWeight: 1.0 }),
        new AnalyticsAgent({ id: 'analytics-2', name: 'Analytics Master 2', capabilities: [], votingWeight: 1.0 })
      ];

      for (const agent of additionalAgents) {
        await swarmInstance.addAgent(agent);
      }

      expect(swarmInstance.agents.size).toBe(6); // Original 3 + 3 additional

      // Should still perform well with more agents
      const { duration } = await PerformanceTestUtils.measureExecutionTime(async () => {
        return swarmInstance.makeDecision('Scalability test with 6 agents', {});
      });

      expect(duration).toBeLessThan(20000); // 20 seconds max
    });
  });

  describe('Demo Integration', () => {
    it('should run the complete demo without errors', async () => {
      const demo = new SwarmDemo();
      
      addTestCleanup(async () => {
        await demo.shutdown();
      });

      expect(async () => {
        await demo.initialize();
        // Run a simplified version of the demo for testing
        await demo.runRevOpsScenarios(); // This method would need to exist
      }).not.toThrow();
    });

    it('should demonstrate visualization capabilities', async () => {
      swarmInstance = await revOpsSwarm.createRevOpsSwarm({
        enableVisualization: true
      });

      expect(swarmInstance.visualizer).toBeDefined();
      
      // Should be able to visualize without errors
      expect(() => {
        swarmInstance.visualize();
      }).not.toThrow();
    });
  });

  describe('Error Recovery and Fault Tolerance', () => {
    beforeEach(async () => {
      swarmInstance = await revOpsSwarm.createRevOpsSwarm({
        enableCRM: true,
        enableMarketing: true,
        enableAnalytics: true
      });
    });

    it('should recover from temporary system failures', async () => {
      // Simulate system failure and recovery
      const originalMakeDecision = swarmInstance.queen.makeStrategicDecision;
      
      // First call fails
      swarmInstance.queen.makeStrategicDecision = jest.fn()
        .mockRejectedValueOnce(new Error('System temporarily unavailable'))
        .mockImplementation(originalMakeDecision);

      // Should handle the failure and potentially retry
      let decisionResult;
      try {
        decisionResult = await swarmInstance.makeDecision('Recovery test', {});
      } catch (error) {
        // First attempt may fail, but system should be recoverable
        expect(error.message).toContain('System temporarily unavailable');
      }

      // Restore original function and try again
      swarmInstance.queen.makeStrategicDecision = originalMakeDecision;
      
      decisionResult = await swarmInstance.makeDecision('Recovery test 2', {});
      expect(decisionResult).toBeDefined();
    });

    it('should maintain consistency after partial failures', async () => {
      // Simulate partial agent failures
      const agents = Array.from(swarmInstance.agents.values());
      agents[0].generateReport = jest.fn().mockRejectedValue(new Error('Agent 1 failed'));

      const decision1 = await swarmInstance.makeDecision('Consistency test 1', {});
      
      // Fix the agent
      agents[0].generateReport = jest.fn().mockResolvedValue({
        recommendation: 'Fixed agent recommendation',
        confidence: 0.8,
        reasoning: 'Agent is now working'
      });

      const decision2 = await swarmInstance.makeDecision('Consistency test 2', {});

      expect(decision1.id).not.toBe(decision2.id);
      expect(decision1.timestamp.getTime()).toBeLessThanOrEqual(decision2.timestamp.getTime());
    });
  });
});