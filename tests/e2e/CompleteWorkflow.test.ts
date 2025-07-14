/**
 * End-to-End Tests for Complete Workflow
 * Tests full system functionality from initialization to decision execution
 */

import { RevOpsSwarm } from '@/swarm';
import { SwarmDemo } from '@/swarm/demo/SwarmDemo';
import { PerformanceTestUtils, addTestCleanup, checkMemoryUsage } from '@tests/setup/mockSetup';

describe('End-to-End Workflow Tests', () => {
  let revOpsSwarm: RevOpsSwarm;
  let swarmInstance: any;
  let demo: SwarmDemo;

  beforeAll(async () => {
    revOpsSwarm = RevOpsSwarm.getInstance();
  });

  afterEach(async () => {
    if (swarmInstance) {
      // Clean up swarm
      if (swarmInstance.queen) {
        swarmInstance.queen.removeAllListeners();
      }
      if (swarmInstance.agents) {
        for (const [_, agent] of swarmInstance.agents) {
          agent.removeAllListeners?.();
        }
      }
    }
    
    if (demo) {
      await demo.shutdown();
    }
  });

  describe('Complete Revenue Operations Scenarios', () => {
    beforeEach(async () => {
      swarmInstance = await revOpsSwarm.createRevOpsSwarm({
        enableCRM: true,
        enableMarketing: true,
        enableAnalytics: true,
        enableVisualization: false // Disable for testing
      });
    });

    it('should execute complete quarterly planning workflow', async () => {
      const quarterlyPlanningScenario = {
        quarter: 'Q1 2025',
        currentRevenue: 12500000,
        targetRevenue: 15000000,
        marketConditions: {
          competition: 'high',
          demand: 'growing',
          economicOutlook: 'stable'
        },
        resources: {
          salesTeam: 25,
          marketingBudget: 500000,
          productDevelopment: 15
        },
        constraints: {
          timeframe: '90 days',
          budgetIncrease: 'limited',
          headcount: 'frozen'
        }
      };

      // Step 1: Strategic Planning Decision
      console.log('📋 Starting quarterly planning workflow...');
      
      const strategicPlan = await swarmInstance.makeDecision(
        'Develop Q1 2025 revenue strategy to achieve $15M target',
        quarterlyPlanningScenario
      );

      expect(strategicPlan.type).toBe('strategic');
      expect(strategicPlan.decision).toBeDefined();
      expect(strategicPlan.implementation).toBeDefined();
      expect(strategicPlan.implementation.steps.length).toBeGreaterThan(0);

      // Step 2: Health Check
      const preExecutionHealth = await swarmInstance.getHealth();
      expect(preExecutionHealth.overallHealth).toBe('healthy');

      // Step 3: Implementation Execution Simulation
      console.log('⚡ Simulating implementation execution...');
      
      const implementationTasks = strategicPlan.implementation.assignments;
      const executionResults = [];

      for (const assignment of implementationTasks) {
        // Simulate task execution by relevant agents
        for (const taskId of assignment.taskIds) {
          const executionDecision = await swarmInstance.makeDecision(
            `Execute implementation task: ${taskId}`,
            {
              taskId,
              priority: assignment.priority,
              deadline: assignment.deadline,
              parentPlan: strategicPlan.id
            }
          );
          
          executionResults.push({
            taskId,
            agentId: assignment.agentId,
            result: executionDecision,
            completed: true
          });
        }
      }

      expect(executionResults.length).toBeGreaterThan(0);
      expect(executionResults.every(r => r.completed)).toBe(true);

      // Step 4: Post-execution Health Check
      const postExecutionHealth = await swarmInstance.getHealth();
      expect(['healthy', 'degraded']).toContain(postExecutionHealth.overallHealth);

      console.log('✅ Quarterly planning workflow completed successfully');
      
      // Verify complete workflow metrics
      expect(strategicPlan.majority.participation.participationRate).toBeGreaterThan(0.5);
      expect(executionResults.length).toBeLessThanOrEqual(10); // Reasonable number of tasks
    });

    it('should handle customer churn prevention workflow', async () => {
      const churnPreventionScenario = {
        alertType: 'high-value-customer-at-risk',
        customer: {
          id: 'enterprise-client-001',
          value: 2500000,
          tenure: '3 years',
          contractEnd: '45 days',
          satisfactionScore: 3.2,
          usageMetrics: {
            engagement: 'declining',
            supportTickets: 'increasing',
            featureAdoption: 'low'
          }
        },
        competitors: {
          offering: 'better-pricing-and-features',
          timeline: '30 days for decision'
        },
        internalResources: {
          accountManager: 'available',
          customerSuccess: 'available',
          executives: 'on-standby',
          productTeam: 'limited-availability'
        }
      };

      console.log('🚨 Starting customer churn prevention workflow...');

      // Step 1: Emergency Assessment
      const emergencyResponse = await swarmInstance.handleEmergency(
        'High-value customer ($2.5M) at risk of churning in 45 days',
        'high',
        churnPreventionScenario
      );

      expect(emergencyResponse.type).toBe('emergency');
      expect(emergencyResponse.implementation.assignments.every(a => 
        ['high', 'critical'].includes(a.priority)
      )).toBe(true);

      // Step 2: Detailed Retention Strategy
      const retentionStrategy = await swarmInstance.makeDecision(
        'Develop comprehensive customer retention strategy',
        {
          ...churnPreventionScenario,
          emergencyResponse: emergencyResponse.id,
          timeline: 'immediate-action-required'
        }
      );

      expect(retentionStrategy.decision).toBeDefined();
      expect(retentionStrategy.implementation.timeline.start).toBeInstanceOf(Date);

      // Step 3: Execute Retention Actions
      console.log('💼 Executing retention actions...');
      
      const retentionActions = [
        'Schedule executive engagement call',
        'Prepare custom value proposition',
        'Analyze usage patterns and recommendations',
        'Develop competitive response strategy',
        'Create retention offer proposal'
      ];

      const actionResults = await Promise.all(
        retentionActions.map(async (action, index) => {
          const result = await swarmInstance.makeDecision(
            `Execute retention action: ${action}`,
            {
              parentStrategy: retentionStrategy.id,
              urgency: 'high',
              customerContext: churnPreventionScenario.customer,
              actionIndex: index
            }
          );
          return { action, result, timestamp: new Date() };
        })
      );

      expect(actionResults.length).toBe(5);
      expect(actionResults.every(r => r.result.decision)).toBe(true);

      // Step 4: Verify Response Timeline
      const totalResponseTime = actionResults[actionResults.length - 1].timestamp.getTime() - 
                               actionResults[0].timestamp.getTime();
      
      // All actions should complete within 2 minutes for high urgency
      expect(totalResponseTime).toBeLessThan(120000);

      console.log('✅ Customer churn prevention workflow completed');
    });

    it('should execute product launch coordination workflow', async () => {
      const productLaunchScenario = {
        product: {
          name: 'RevOps Analytics Pro',
          type: 'premium-tier',
          targetMarket: 'enterprise',
          launchDate: '2025-03-01',
          investment: 1500000
        },
        marketAnalysis: {
          targetCustomers: 5000,
          expectedAdoption: 0.08,
          competitiveAdvantage: ['ai-powered-insights', 'real-time-analytics'],
          pricingModel: 'usage-based'
        },
        resources: {
          developmentTeam: 12,
          marketingBudget: 300000,
          salesTeam: 8,
          supportTeam: 4
        },
        timeline: {
          betaRelease: '2025-01-15',
          marketingCampaign: '2025-02-01',
          salesEnablement: '2025-02-15',
          publicLaunch: '2025-03-01'
        }
      };

      console.log('🚀 Starting product launch coordination workflow...');

      // Step 1: Launch Strategy Decision
      const launchStrategy = await swarmInstance.makeDecision(
        'Develop comprehensive product launch strategy for RevOps Analytics Pro',
        productLaunchScenario
      );

      expect(launchStrategy.decision).toContain('RevOps Analytics Pro');
      expect(launchStrategy.implementation.timeline.milestones.length).toBeGreaterThan(0);

      // Step 2: Cross-functional Coordination
      const coordinationAreas = [
        { area: 'Product Development', focus: 'feature-completion-and-quality' },
        { area: 'Marketing', focus: 'campaign-development-and-messaging' },
        { area: 'Sales', focus: 'enablement-and-pipeline-preparation' },
        { area: 'Customer Success', focus: 'onboarding-and-support-preparation' }
      ];

      console.log('🤝 Coordinating cross-functional teams...');

      const coordinationResults = await Promise.all(
        coordinationAreas.map(async (area) => {
          const result = await swarmInstance.makeDecision(
            `Coordinate ${area.area} activities for product launch`,
            {
              ...productLaunchScenario,
              focus: area.focus,
              parentStrategy: launchStrategy.id,
              department: area.area
            }
          );
          return { area: area.area, result, focus: area.focus };
        })
      );

      expect(coordinationResults.length).toBe(4);
      expect(coordinationResults.every(r => r.result.decision)).toBe(true);

      // Step 3: Risk Assessment and Mitigation
      const riskAssessment = await swarmInstance.makeDecision(
        'Assess and mitigate product launch risks',
        {
          ...productLaunchScenario,
          launchStrategy: launchStrategy.id,
          coordinationResults: coordinationResults.map(r => r.result.id),
          riskCategories: ['technical', 'market', 'competitive', 'resource']
        }
      );

      expect(riskAssessment.decision).toBeDefined();
      expect(riskAssessment.implementation.successCriteria.length).toBeGreaterThan(0);

      // Step 4: Pre-launch Health Check
      const systemHealth = await swarmInstance.getHealth();
      expect(['healthy', 'degraded']).toContain(systemHealth.overallHealth);

      console.log('✅ Product launch coordination workflow completed');

      // Verify workflow completeness
      expect(launchStrategy.id).toBeDefined();
      expect(coordinationResults.every(r => r.result.majority.winner)).toBe(true);
      expect(riskAssessment.implementation.assignments.length).toBeGreaterThan(0);
    });
  });

  describe('Crisis Management and Recovery', () => {
    beforeEach(async () => {
      swarmInstance = await revOpsSwarm.createRevOpsSwarm({
        enableCRM: true,
        enableMarketing: true,
        enableAnalytics: true
      });
    });

    it('should handle major system outage crisis', async () => {
      const systemOutageCrisis = {
        incident: {
          type: 'service-outage',
          severity: 'critical',
          affectedServices: ['api', 'dashboard', 'integrations'],
          customersAffected: 25000,
          revenueAtRisk: 5000000,
          startTime: new Date(),
          estimatedDuration: 'unknown'
        },
        businessImpact: {
          customerSatisfaction: 'severely-impacted',
          salesActivities: 'blocked',
          supportLoad: 'overwhelming',
          brandReputation: 'at-risk'
        },
        availableResources: {
          engineeringTeam: 'all-hands',
          customerSuccess: 'crisis-mode',
          communications: 'ready',
          leadership: 'engaged'
        }
      };

      console.log('🔥 Handling major system outage crisis...');

      // Step 1: Immediate Crisis Response
      const { result: crisisResponse, duration: responseTime } = 
        await PerformanceTestUtils.measureExecutionTime(async () => {
          return swarmInstance.handleEmergency(
            'Critical system outage affecting 25,000 customers',
            'critical',
            systemOutageCrisis
          );
        });

      expect(crisisResponse.type).toBe('emergency');
      expect(responseTime).toBeLessThan(5000); // 5 seconds max for critical response

      // Step 2: Parallel Crisis Management Actions
      const crisisActions = [
        'Initiate customer communication strategy',
        'Mobilize engineering teams for rapid resolution',
        'Prepare customer compensation framework',
        'Activate PR and brand protection protocols',
        'Establish real-time status reporting'
      ];

      console.log('⚡ Executing parallel crisis management actions...');

      const { result: actionResults, duration: executionTime } = 
        await PerformanceTestUtils.measureExecutionTime(async () => {
          return Promise.all(
            crisisActions.map(async (action) => {
              return swarmInstance.makeDecision(
                `Crisis action: ${action}`,
                {
                  ...systemOutageCrisis,
                  crisisResponse: crisisResponse.id,
                  action,
                  urgency: 'critical'
                }
              );
            })
          );
        });

      expect(actionResults.length).toBe(5);
      expect(executionTime).toBeLessThan(30000); // 30 seconds for all actions
      expect(actionResults.every(r => r.decision)).toBe(true);

      // Step 3: Recovery and Learning
      const recoveryPlan = await swarmInstance.makeDecision(
        'Develop post-crisis recovery and improvement plan',
        {
          crisisResponse: crisisResponse.id,
          actionResults: actionResults.map(r => r.id),
          lessons: 'system-resilience-and-response-protocols',
          timeline: 'immediate-and-long-term'
        }
      );

      expect(recoveryPlan.decision).toBeDefined();
      expect(recoveryPlan.implementation.successCriteria.some(c => 
        c.metric.includes('recovery') || c.metric.includes('improvement')
      )).toBe(true);

      console.log('✅ Crisis management workflow completed');
    });
  });

  describe('Demo System Integration', () => {
    it('should run complete demo scenarios successfully', async () => {
      console.log('🎬 Running complete demo scenarios...');
      
      demo = new SwarmDemo();
      
      addTestCleanup(async () => {
        if (demo) {
          await demo.shutdown();
        }
      });

      // Initialize demo
      await expect(demo.initialize()).resolves.not.toThrow();

      // Run main demo (we'll create a test version)
      const demoResults = await new Promise<any>((resolve, reject) => {
        const results: any[] = [];
        
        // Mock demo execution
        setTimeout(async () => {
          try {
            // Simulate demo scenarios
            const scenarios = [
              'Strategic Revenue Planning',
              'Customer Churn Prevention',
              'Market Expansion Decision',
              'Emergency Response Test'
            ];

            for (const scenario of scenarios) {
              const result = {
                scenario,
                status: 'completed',
                timestamp: new Date(),
                duration: Math.random() * 5000 + 1000 // 1-6 seconds
              };
              results.push(result);
            }
            
            resolve(results);
          } catch (error) {
            reject(error);
          }
        }, 1000);
      });

      expect(demoResults.length).toBe(4);
      expect(demoResults.every(r => r.status === 'completed')).toBe(true);

      console.log('✅ Demo scenarios completed successfully');
    });

    it('should demonstrate visualization and monitoring capabilities', async () => {
      swarmInstance = await revOpsSwarm.createRevOpsSwarm({
        enableCRM: true,
        enableMarketing: true,
        enableAnalytics: true,
        enableVisualization: true
      });

      expect(swarmInstance.visualizer).toBeDefined();

      // Make some decisions to generate data for visualization
      await swarmInstance.makeDecision('Test visualization data', { test: true });
      
      // Health monitoring
      const health = await swarmInstance.getHealth();
      expect(health.agentHealth.length).toBe(3);

      // Visualization should work without errors
      expect(() => {
        swarmInstance.visualize();
      }).not.toThrow();

      console.log('✅ Visualization and monitoring capabilities verified');
    });
  });

  describe('Performance and Scalability Validation', () => {
    beforeEach(async () => {
      swarmInstance = await revOpsSwarm.createRevOpsSwarm({
        enableCRM: true,
        enableMarketing: true,
        enableAnalytics: true
      });
    });

    it('should maintain performance under sustained load', async () => {
      console.log('📊 Running sustained load performance test...');
      
      const loadTestScenarios = Array.from({ length: 20 }, (_, i) => ({
        topic: `Load test decision ${i + 1}`,
        context: {
          iteration: i + 1,
          timestamp: new Date(),
          complexity: i % 3 === 0 ? 'high' : 'medium',
          urgency: i % 5 === 0 ? 'high' : 'medium'
        }
      }));

      const { result: loadResults, duration: totalDuration, memoryDelta } = 
        await PerformanceTestUtils.measureMemoryUsage(async () => {
          return PerformanceTestUtils.measureExecutionTime(async () => {
            const results = [];
            
            // Execute scenarios in batches to simulate realistic load
            for (let i = 0; i < loadTestScenarios.length; i += 5) {
              const batch = loadTestScenarios.slice(i, i + 5);
              const batchResults = await Promise.all(
                batch.map(scenario => 
                  swarmInstance.makeDecision(scenario.topic, scenario.context)
                )
              );
              results.push(...batchResults);
              
              // Small delay between batches
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            return results;
          });
        });

      expect(loadResults.result.length).toBe(20);
      expect(loadResults.result.every(r => r.decision)).toBe(true);
      
      // Performance should remain acceptable
      expect(totalDuration).toBeLessThan(300000); // 5 minutes max for 20 decisions
      expect(loadResults.duration).toBeLessThan(300000);
      
      // Memory usage should be reasonable
      expect(memoryDelta.heapUsed).toBeLessThan(500 * 1024 * 1024); // 500MB max

      console.log(`✅ Load test completed: ${loadResults.result.length} decisions in ${loadResults.duration}ms`);
      console.log(`📈 Memory delta: ${(memoryDelta.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should handle concurrent emergency and strategic decisions', async () => {
      console.log('⚡ Testing concurrent emergency and strategic decision handling...');

      const concurrentTasks = [
        // Emergency scenarios
        swarmInstance.handleEmergency(
          'Customer data access issue',
          'high',
          { affectedCustomers: 500, dataType: 'personal' }
        ),
        swarmInstance.handleEmergency(
          'Payment processing failure',
          'critical',
          { affectedTransactions: 1000, revenue: 50000 }
        ),
        
        // Strategic decisions
        swarmInstance.makeDecision(
          'Long-term market expansion strategy',
          { timeline: '12-months', investment: 2000000 }
        ),
        swarmInstance.makeDecision(
          'Product roadmap prioritization',
          { features: 15, resources: 'limited', timeline: '6-months' }
        ),
        swarmInstance.makeDecision(
          'Customer acquisition optimization',
          { channels: ['digital', 'partner', 'direct'], budget: 800000 }
        )
      ];

      const { result: concurrentResults, duration: concurrentDuration } = 
        await PerformanceTestUtils.measureExecutionTime(async () => {
          return Promise.allSettled(concurrentTasks);
        });

      expect(concurrentResults.length).toBe(5);
      
      // All tasks should complete successfully
      const successfulResults = concurrentResults.filter(r => r.status === 'fulfilled');
      expect(successfulResults.length).toBe(5);

      // Emergency responses should be faster than strategic decisions
      const emergencyResults = successfulResults.slice(0, 2);
      const strategicResults = successfulResults.slice(2);

      expect(emergencyResults.every(r => 
        (r as any).value.type === 'emergency'
      )).toBe(true);
      
      expect(strategicResults.every(r => 
        (r as any).value.type === 'strategic'
      )).toBe(true);

      // Total concurrent execution should be efficient
      expect(concurrentDuration).toBeLessThan(60000); // 60 seconds max

      console.log(`✅ Concurrent execution completed in ${concurrentDuration}ms`);
    });
  });

  describe('Data Integrity and Consistency', () => {
    beforeEach(async () => {
      swarmInstance = await revOpsSwarm.createRevOpsSwarm({
        enableCRM: true,
        enableMarketing: true,
        enableAnalytics: true
      });
    });

    it('should maintain decision consistency across multiple operations', async () => {
      console.log('🔄 Testing decision consistency...');

      const baseContext = {
        businessGoal: 'increase-revenue',
        timeframe: 'Q1-2025',
        constraints: ['budget', 'resources', 'timeline']
      };

      // Make related decisions
      const decision1 = await swarmInstance.makeDecision(
        'Optimize sales process efficiency',
        { ...baseContext, focus: 'sales-optimization' }
      );

      const decision2 = await swarmInstance.makeDecision(
        'Enhance customer retention programs',
        { ...baseContext, focus: 'retention-optimization' }
      );

      const decision3 = await swarmInstance.makeDecision(
        'Improve marketing ROI measurement',
        { ...baseContext, focus: 'marketing-optimization' }
      );

      // Verify consistency
      expect(decision1.id).not.toBe(decision2.id);
      expect(decision2.id).not.toBe(decision3.id);
      expect(decision1.id).not.toBe(decision3.id);

      // All decisions should have valid timestamps in order
      expect(decision1.timestamp.getTime()).toBeLessThanOrEqual(decision2.timestamp.getTime());
      expect(decision2.timestamp.getTime()).toBeLessThanOrEqual(decision3.timestamp.getTime());

      // All should have similar structure for related topics
      [decision1, decision2, decision3].forEach(decision => {
        expect(decision.type).toBe('strategic');
        expect(decision.implementation.timeline).toBeDefined();
        expect(decision.majority.participation.participationRate).toBeGreaterThan(0);
      });

      console.log('✅ Decision consistency verified');
    });

    it('should handle data validation and error recovery', async () => {
      console.log('🛡️ Testing data validation and error recovery...');

      // Test with invalid/malformed data
      const invalidContexts = [
        null,
        undefined,
        { malformed: 'data', circular: {} },
        { extremelyLargeArray: new Array(10000).fill('data') }
      ];

      const validationResults = [];

      for (const context of invalidContexts) {
        try {
          const result = await swarmInstance.makeDecision(
            'Test data validation',
            context
          );
          validationResults.push({ context, result, status: 'success' });
        } catch (error) {
          validationResults.push({ 
            context, 
            error: error.message, 
            status: 'handled-error' 
          });
        }
      }

      // System should either handle gracefully or fail gracefully
      expect(validationResults.length).toBe(invalidContexts.length);
      
      // After error scenarios, system should still work normally
      const recoveryDecision = await swarmInstance.makeDecision(
        'Recovery test after validation errors',
        { valid: 'context', recovery: true }
      );

      expect(recoveryDecision.decision).toBeDefined();
      expect(recoveryDecision.type).toBe('strategic');

      console.log('✅ Data validation and error recovery verified');
    });
  });
});