/**
 * Unit Tests for BaseAgent
 * Tests core agent functionality, performance metrics, and behavior patterns
 */

import { BaseAgent, BaseAgentConfig, AgentState, PerformanceMetrics } from '@/swarm/agents/BaseAgent';
import { MockMemoryFactory, PerformanceTestUtils, startPerformanceTest, endPerformanceTest } from '@tests/setup/mockSetup';

// Concrete implementation for testing
class TestAgent extends BaseAgent {
  constructor(config: BaseAgentConfig) {
    super(config);
  }

  protected async performAnalysis(topic: string, context: any): Promise<any> {
    return {
      topic,
      context,
      analysis: 'test analysis',
      relevance: this.calculateTopicRelevance(topic, context)
    };
  }

  protected async formulateRecommendation(topic: string, context: any, analysis: any): Promise<any> {
    return {
      action: 'test-action',
      priority: 'medium',
      confidence: analysis.relevance || 0.5
    };
  }

  protected async executeTask(task: any): Promise<any> {
    // Simulate task execution
    await new Promise(resolve => setTimeout(resolve, 100));
    return {
      taskType: task.type || 'unknown',
      result: 'task completed',
      timestamp: new Date()
    };
  }

  protected initializeCapabilities(): void {
    // Initialize test capabilities
    this.capabilities.set('data-analysis', {
      name: 'data-analysis',
      proficiency: 0.8,
      experience: 10
    });
    this.capabilities.set('report-generation', {
      name: 'report-generation',
      proficiency: 0.9,
      experience: 15
    });
  }
}

describe('BaseAgent', () => {
  let agent: TestAgent;
  let config: BaseAgentConfig;

  beforeEach(() => {
    config = {
      id: 'test-agent-1',
      type: 'test',
      name: 'Test Agent',
      capabilities: ['data-analysis', 'report-generation'],
      votingWeight: 1.0,
      learningEnabled: true
    };
    agent = new TestAgent(config);
  });

  afterEach(() => {
    // Clean up any event listeners
    agent.removeAllListeners();
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', async () => {
      await agent.initialize();
      
      expect(agent.getId()).toBe('test-agent-1');
      expect(agent.getType()).toBe('test');
      expect(agent.getStatus()).toBe('active');
      expect(agent.getCapabilities()).toEqual(['data-analysis', 'report-generation']);
    });

    it('should set up capabilities correctly', async () => {
      await agent.initialize();
      
      const capabilities = agent.getCapabilities();
      expect(capabilities).toContain('data-analysis');
      expect(capabilities).toContain('report-generation');
    });

    it('should emit initialization event', async () => {
      const initSpy = jest.fn();
      agent.on('agent:initialized', initSpy);
      
      await agent.initialize();
      
      expect(initSpy).toHaveBeenCalledWith({ agentId: 'test-agent-1' });
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock a failing capability setup
      const failingAgent = new (class extends TestAgent {
        protected initializeCapabilities(): void {
          throw new Error('Capability initialization failed');
        }
      })(config);

      await expect(failingAgent.initialize()).rejects.toThrow('Capability initialization failed');
    });
  });

  describe('Report Generation', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should generate reports with correct structure', async () => {
      const topic = 'revenue optimization';
      const context = { quarter: 'Q4', revenue: 1000000 };

      const report = await agent.generateReport(topic, context);

      expect(report).toHaveProperty('recommendation');
      expect(report).toHaveProperty('confidence');
      expect(report).toHaveProperty('reasoning');
      expect(report.confidence).toBeGreaterThanOrEqual(0);
      expect(report.confidence).toBeLessThanOrEqual(1);
    });

    it('should calculate topic relevance correctly', async () => {
      const relevantTopic = 'data analysis and reporting';
      const irrelevantTopic = 'unrelated topic';

      const relevantReport = await agent.generateReport(relevantTopic, {});
      const irrelevantReport = await agent.generateReport(irrelevantTopic, {});

      expect(relevantReport.confidence).toBeGreaterThan(irrelevantReport.confidence);
    });

    it('should emit report generation events', async () => {
      const reportSpy = jest.fn();
      agent.on('agent:report-generated', reportSpy);

      await agent.generateReport('test topic', {});

      expect(reportSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'test-agent-1',
          topic: 'test topic'
        })
      );
    });

    it('should handle report generation errors', async () => {
      // Force an error in analysis
      const errorAgent = new (class extends TestAgent {
        protected async performAnalysis(): Promise<any> {
          throw new Error('Analysis failed');
        }
      })(config);

      await errorAgent.initialize();
      const report = await errorAgent.generateReport('test', {});

      expect(report.recommendation).toBeNull();
      expect(report.confidence).toBe(0);
      expect(report.reasoning).toContain('Error generating report');
    });

    it('should update performance metrics after report generation', async () => {
      const initialMetrics = agent.getPerformance();
      
      await agent.generateReport('test topic', {});
      
      const updatedMetrics = agent.getPerformance();
      expect(updatedMetrics.tasksTotal).toBeGreaterThan(initialMetrics.tasksTotal);
    });
  });

  describe('Task Processing', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should process tasks successfully', async () => {
      const task = {
        type: 'analysis',
        data: { sample: 'data' },
        estimatedDuration: 5000
      };

      const result = await agent.processTask('task-1', task);

      expect(result.taskId).toBe('task-1');
      expect(result.agentId).toBe('test-agent-1');
      expect(result.status).toBe('success');
      expect(result.output).toBeDefined();
      expect(result.metrics).toBeDefined();
    });

    it('should measure task performance metrics', async () => {
      const task = { type: 'test', estimatedDuration: 1000 };
      
      const result = await agent.processTask('perf-test', task);

      expect(result.metrics.duration).toBeGreaterThan(0);
      expect(result.metrics.accuracy).toBeGreaterThanOrEqual(0);
      expect(result.metrics.efficiency).toBeGreaterThanOrEqual(0);
    });

    it('should handle task failures gracefully', async () => {
      const errorAgent = new (class extends TestAgent {
        protected async executeTask(): Promise<any> {
          throw new Error('Task execution failed');
        }
      })(config);

      await errorAgent.initialize();
      const result = await errorAgent.processTask('fail-task', {});

      expect(result.status).toBe('failure');
      expect(result.output.error).toContain('Task execution failed');
    });

    it('should learn from successful tasks when learning is enabled', async () => {
      const task = { type: 'learning-test' };
      const learnSpy = jest.fn();
      agent.on('agent:learning', learnSpy);

      await agent.processTask('learn-task', task);

      expect(learnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'test-agent-1',
          taskId: 'learn-task'
        })
      );
    });
  });

  describe('Performance Metrics', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should track performance metrics correctly', async () => {
      const initialMetrics = agent.getPerformance();
      expect(initialMetrics.tasksCompleted).toBe(0);
      expect(initialMetrics.tasksTotal).toBe(0);

      // Perform some tasks
      await agent.generateReport('test1', {});
      await agent.generateReport('test2', {});

      const updatedMetrics = agent.getPerformance();
      expect(updatedMetrics.tasksTotal).toBe(2);
      expect(updatedMetrics.avgResponseTime).toBeGreaterThan(0);
    });

    it('should calculate success rate correctly', async () => {
      // Process successful task
      await agent.processTask('success-1', { type: 'test' });
      
      // Simulate feedback
      agent.receiveResponse({
        type: 'feedback',
        taskId: 'success-1',
        success: true,
        feedback: 'Great work!'
      });

      const metrics = agent.getPerformance();
      expect(metrics.successRate).toBeGreaterThan(0);
    });

    it('should handle confidence tracking', async () => {
      await agent.generateReport('confidence-test', { relevantData: true });
      
      const metrics = agent.getPerformance();
      expect(metrics.avgConfidence).toBeGreaterThan(0);
      expect(metrics.avgConfidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Communication and Responses', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should handle task assignments', () => {
      const responseSpy = jest.fn();
      agent.on('agent:tasks-assigned', responseSpy);

      agent.receiveResponse({
        type: 'task-assignment',
        taskIds: ['task-1', 'task-2'],
        priority: 'high',
        deadline: new Date()
      });

      expect(responseSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'test-agent-1',
          taskCount: 2,
          priority: 'high'
        })
      );
    });

    it('should handle feedback responses', () => {
      agent.receiveResponse({
        type: 'feedback',
        taskId: 'test-task',
        success: true,
        feedback: 'Excellent analysis'
      });

      const metrics = agent.getPerformance();
      expect(metrics.tasksCompleted).toBeGreaterThan(0);
    });

    it('should handle collaboration requests', () => {
      const collabSpy = jest.fn();
      agent.on('agent:collaboration-response', collabSpy);

      agent.receiveResponse({
        type: 'collaboration-request',
        requestingAgent: 'other-agent',
        task: 'joint analysis',
        urgency: 'medium'
      });

      expect(collabSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'test-agent-1',
          requestingAgent: 'other-agent'
        })
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should emit error events when errors occur', () => {
      const errorSpy = jest.fn();
      agent.on('agent:error', errorSpy);

      // Trigger an error
      (agent as any).handleError(new Error('Test error'));

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'test-agent-1',
          error: 'Test error'
        })
      );
    });

    it('should set error status when errors occur', () => {
      (agent as any).handleError(new Error('Test error'));
      
      expect(agent.getStatus()).toBe('error');
    });
  });

  describe('Performance Benchmarks', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should generate reports within acceptable time limits', async () => {
      const startTime = startPerformanceTest();
      
      await agent.generateReport('performance test', { largeData: true });
      
      const duration = endPerformanceTest(startTime, 'report-generation');
      expect(duration).toBeLessThan(5000); // 5 seconds max
    });

    it('should process tasks efficiently', async () => {
      const { duration } = await PerformanceTestUtils.measureExecutionTime(async () => {
        return agent.processTask('perf-task', { type: 'benchmark' });
      });

      expect(duration).toBeLessThan(1000); // 1 second max
    });

    it('should not leak memory during extended operation', async () => {
      const { memoryDelta } = await PerformanceTestUtils.measureMemoryUsage(async () => {
        // Perform many operations
        for (let i = 0; i < 100; i++) {
          await agent.generateReport(`test-${i}`, { iteration: i });
        }
      });

      // Memory usage should not grow excessively (less than 50MB)
      expect(memoryDelta.heapUsed).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Integration Points', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should connect to Queen agent correctly', () => {
      const mockQueen = { id: 'queen-test', type: 'queen' };
      
      expect(() => agent.setQueenConnection(mockQueen)).not.toThrow();
    });

    it('should handle concurrent operations safely', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        agent.generateReport(`concurrent-${i}`, { index: i })
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.recommendation).toBeDefined();
      });
    });

    it('should maintain consistency under load', async () => {
      const tasks = Array.from({ length: 50 }, (_, i) => ({
        id: `load-test-${i}`,
        type: 'load',
        data: { index: i }
      }));

      const startMetrics = agent.getPerformance();
      
      await Promise.all(tasks.map(task => agent.processTask(task.id, task)));
      
      const endMetrics = agent.getPerformance();
      expect(endMetrics.tasksTotal).toBe(startMetrics.tasksTotal + 50);
    });
  });
});