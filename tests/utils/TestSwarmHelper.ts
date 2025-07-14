import { SwarmCoordinator } from '@/swarm/coordinator/SwarmCoordinator';
import { BaseAgent } from '@/swarm/agents/BaseAgent';
import { EventEmitter } from 'events';

/**
 * Helper class for testing swarm functionality
 */
export class TestSwarmHelper {
  private activeAgents: Map<string, BaseAgent> = new Map();
  private eventLog: SwarmEvent[] = [];
  private eventEmitter: EventEmitter = new EventEmitter();

  /**
   * Create a test agent
   */
  createTestAgent(id: string, type: string = 'worker'): BaseAgent {
    const agent = new BaseAgent(id, type);
    
    // Override process method for testing
    agent.process = jest.fn().mockImplementation(async (task) => {
      return {
        agentId: id,
        result: `Processed by ${id}`,
        confidence: 0.8 + Math.random() * 0.2,
        metadata: { processedAt: Date.now() },
      };
    });

    this.activeAgents.set(id, agent);
    return agent;
  }

  /**
   * Create multiple test agents
   */
  createTestSwarm(agentCount: number): BaseAgent[] {
    const agents: BaseAgent[] = [];
    const types = ['queen', 'specialist', 'specialist', 'worker', 'worker'];

    for (let i = 0; i < agentCount; i++) {
      const type = types[i % types.length];
      const agent = this.createTestAgent(`test-${type}-${i}`, type);
      agents.push(agent);
    }

    return agents;
  }

  /**
   * Simulate agent failure
   */
  simulateAgentFailure(agentId: string): void {
    const agent = this.activeAgents.get(agentId);
    if (agent) {
      // Override process to throw error
      agent.process = jest.fn().mockRejectedValue(
        new Error(`Agent ${agentId} simulated failure`)
      );

      this.logEvent({
        type: 'agent-failure',
        agentId,
        timestamp: Date.now(),
        details: { error: 'Simulated failure' },
      });

      this.eventEmitter.emit('agent-failed', { agentId });
    }
  }

  /**
   * Simulate agent recovery
   */
  recoverAgent(agentId: string): void {
    const agent = this.activeAgents.get(agentId);
    if (agent) {
      // Restore normal processing
      agent.process = jest.fn().mockImplementation(async (task) => {
        return {
          agentId,
          result: `Recovered and processed by ${agentId}`,
          confidence: 0.8 + Math.random() * 0.2,
          metadata: { processedAt: Date.now(), recovered: true },
        };
      });

      this.logEvent({
        type: 'agent-recovered',
        agentId,
        timestamp: Date.now(),
      });

      this.eventEmitter.emit('agent-recovered', { agentId });
    }
  }

  /**
   * Simulate network partition
   */
  simulateNetworkPartition(affectedAgents: string[]): void {
    affectedAgents.forEach(agentId => {
      const agent = this.activeAgents.get(agentId);
      if (agent) {
        // Make agent unreachable
        agent.process = jest.fn().mockImplementation(() => {
          return new Promise((resolve) => {
            // Never resolves - simulates network timeout
            setTimeout(() => {}, 100000);
          });
        });
      }
    });

    this.logEvent({
      type: 'network-partition',
      affectedAgents,
      timestamp: Date.now(),
    });
  }

  /**
   * Heal network partition
   */
  healNetworkPartition(affectedAgents: string[]): void {
    affectedAgents.forEach(agentId => {
      this.recoverAgent(agentId);
    });

    this.logEvent({
      type: 'network-healed',
      affectedAgents,
      timestamp: Date.now(),
    });
  }

  /**
   * Wait for a condition to be met
   */
  async waitForCondition(
    condition: () => boolean,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    return false;
  }

  /**
   * Monitor swarm decisions
   */
  monitorDecisions(coordinator: SwarmCoordinator): DecisionMonitor {
    const monitor: DecisionMonitor = {
      decisions: [],
      consensusRate: 0,
      averageConfidence: 0,
      participationRate: 0,
    };

    // Intercept decision processing
    const originalProcess = coordinator.processDecision.bind(coordinator);
    coordinator.processDecision = async (request) => {
      const startTime = Date.now();
      const result = await originalProcess(request);
      
      monitor.decisions.push({
        request,
        result,
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      });

      // Update metrics
      this.updateMonitorMetrics(monitor);

      return result;
    };

    return monitor;
  }

  /**
   * Update monitor metrics
   */
  private updateMonitorMetrics(monitor: DecisionMonitor): void {
    if (monitor.decisions.length === 0) return;

    const consensusCount = monitor.decisions.filter(d => d.result.consensusAchieved).length;
    monitor.consensusRate = consensusCount / monitor.decisions.length;

    const totalConfidence = monitor.decisions.reduce(
      (sum, d) => sum + (d.result.consensusScore || 0),
      0
    );
    monitor.averageConfidence = totalConfidence / monitor.decisions.length;

    const totalParticipants = monitor.decisions.reduce(
      (sum, d) => sum + (d.result.participatingAgents?.length || 0),
      0
    );
    const avgParticipants = totalParticipants / monitor.decisions.length;
    const maxPossibleAgents = this.activeAgents.size;
    monitor.participationRate = maxPossibleAgents > 0 ? avgParticipants / maxPossibleAgents : 0;
  }

  /**
   * Create mock consensus scenarios
   */
  createConsensusScenario(type: 'unanimous' | 'majority' | 'split' | 'no-consensus'): any {
    switch (type) {
      case 'unanimous':
        return {
          votes: [
            { agentId: 'agent-1', vote: 'option-a', confidence: 0.95 },
            { agentId: 'agent-2', vote: 'option-a', confidence: 0.92 },
            { agentId: 'agent-3', vote: 'option-a', confidence: 0.98 },
          ],
          expectedConsensus: true,
          expectedOption: 'option-a',
          expectedScore: 0.95,
        };

      case 'majority':
        return {
          votes: [
            { agentId: 'agent-1', vote: 'option-a', confidence: 0.85 },
            { agentId: 'agent-2', vote: 'option-a', confidence: 0.88 },
            { agentId: 'agent-3', vote: 'option-b', confidence: 0.90 },
            { agentId: 'agent-4', vote: 'option-a', confidence: 0.82 },
          ],
          expectedConsensus: true,
          expectedOption: 'option-a',
          expectedScore: 0.75,
        };

      case 'split':
        return {
          votes: [
            { agentId: 'agent-1', vote: 'option-a', confidence: 0.85 },
            { agentId: 'agent-2', vote: 'option-b', confidence: 0.85 },
            { agentId: 'agent-3', vote: 'option-a', confidence: 0.85 },
            { agentId: 'agent-4', vote: 'option-b', confidence: 0.85 },
          ],
          expectedConsensus: false,
          expectedOption: null,
          expectedScore: 0.5,
        };

      case 'no-consensus':
        return {
          votes: [
            { agentId: 'agent-1', vote: 'option-a', confidence: 0.60 },
            { agentId: 'agent-2', vote: 'option-b', confidence: 0.55 },
            { agentId: 'agent-3', vote: 'option-c', confidence: 0.58 },
          ],
          expectedConsensus: false,
          expectedOption: null,
          expectedScore: 0.33,
        };
    }
  }

  /**
   * Simulate realistic workload
   */
  async simulateWorkload(
    coordinator: SwarmCoordinator,
    config: WorkloadConfig
  ): Promise<WorkloadResult> {
    const results: any[] = [];
    const startTime = Date.now();

    for (let i = 0; i < config.requestCount; i++) {
      // Vary request types
      const requestType = config.requestTypes[i % config.requestTypes.length];
      const complexity = config.complexityDistribution[
        Math.floor(Math.random() * config.complexityDistribution.length)
      ];

      const request = {
        type: requestType,
        context: {
          iteration: i,
          complexity,
          data: this.generateTestData(complexity),
        },
        requiresConsensus: complexity !== 'simple',
        consensusThreshold: complexity === 'complex' ? 0.8 : 0.6,
      };

      try {
        const result = await coordinator.processDecision(request);
        results.push({ success: true, result, complexity });
      } catch (error) {
        results.push({ success: false, error: error.message, complexity });
      }

      // Simulate realistic pacing
      if (config.requestDelay) {
        await new Promise(resolve => setTimeout(resolve, config.requestDelay));
      }
    }

    const duration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;

    return {
      totalRequests: config.requestCount,
      successfulRequests: successCount,
      failedRequests: config.requestCount - successCount,
      duration,
      throughput: (config.requestCount / duration) * 1000,
      successRate: successCount / config.requestCount,
      resultsByComplexity: this.groupResultsByComplexity(results),
    };
  }

  /**
   * Generate test data based on complexity
   */
  private generateTestData(complexity: string): any {
    switch (complexity) {
      case 'simple':
        return { value: Math.random() * 100 };
      case 'medium':
        return {
          values: Array(10).fill(null).map(() => Math.random() * 100),
          metadata: { timestamp: Date.now(), source: 'test' },
        };
      case 'complex':
        return {
          dataset: Array(100).fill(null).map(() => ({
            id: Math.random().toString(36),
            value: Math.random() * 1000,
            category: ['A', 'B', 'C'][Math.floor(Math.random() * 3)],
            timestamp: Date.now() - Math.random() * 86400000,
          })),
          rules: [
            { condition: 'value > 500', action: 'flag' },
            { condition: 'category == A', action: 'prioritize' },
          ],
          metadata: {
            source: 'test',
            version: '1.0',
            processingRequired: true,
          },
        };
    }
  }

  /**
   * Group results by complexity
   */
  private groupResultsByComplexity(results: any[]): Record<string, any> {
    const grouped: Record<string, any> = {};

    results.forEach(result => {
      const complexity = result.complexity;
      if (!grouped[complexity]) {
        grouped[complexity] = {
          total: 0,
          successful: 0,
          failed: 0,
          averageDuration: 0,
        };
      }

      grouped[complexity].total++;
      if (result.success) {
        grouped[complexity].successful++;
      } else {
        grouped[complexity].failed++;
      }
    });

    return grouped;
  }

  /**
   * Log swarm event
   */
  private logEvent(event: SwarmEvent): void {
    this.eventLog.push(event);
    this.eventEmitter.emit('swarm-event', event);
  }

  /**
   * Get event log
   */
  getEventLog(): SwarmEvent[] {
    return [...this.eventLog];
  }

  /**
   * Clear event log
   */
  clearEventLog(): void {
    this.eventLog = [];
  }

  /**
   * Subscribe to swarm events
   */
  on(event: string, handler: (...args: any[]) => void): void {
    this.eventEmitter.on(event, handler);
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.activeAgents.clear();
    this.eventLog = [];
    this.eventEmitter.removeAllListeners();
  }
}

// Type definitions
interface SwarmEvent {
  type: string;
  timestamp: number;
  agentId?: string;
  affectedAgents?: string[];
  details?: any;
}

interface DecisionMonitor {
  decisions: Array<{
    request: any;
    result: any;
    duration: number;
    timestamp: number;
  }>;
  consensusRate: number;
  averageConfidence: number;
  participationRate: number;
}

interface WorkloadConfig {
  requestCount: number;
  requestTypes: string[];
  complexityDistribution: string[];
  requestDelay?: number;
}

interface WorkloadResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  duration: number;
  throughput: number;
  successRate: number;
  resultsByComplexity: Record<string, any>;
}