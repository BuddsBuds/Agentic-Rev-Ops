/**
 * Mock Setup for Agentic RevOps Testing
 * Comprehensive mocking of external dependencies and services
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Mock external dependencies
jest.mock('axios', () => ({
  default: {
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    put: jest.fn().mockResolvedValue({ data: {} }),
    delete: jest.fn().mockResolvedValue({ data: {} })
  },
  get: jest.fn().mockResolvedValue({ data: {} }),
  post: jest.fn().mockResolvedValue({ data: {} })
}));

jest.mock('ws', () => {
  return class MockWebSocket extends EventEmitter {
    constructor() {
      super();
      this.readyState = 1; // OPEN
    }
    
    send(data: any) {
      this.emit('mock:message-sent', data);
    }
    
    close() {
      this.emit('close');
    }
  };
});

jest.mock('rss-parser', () => {
  return class MockRSSParser {
    async parseURL(url: string) {
      return {
        title: 'Mock RSS Feed',
        items: [
          {
            title: 'Mock Item 1',
            link: 'https://example.com/1',
            pubDate: new Date().toISOString(),
            content: 'Mock content 1'
          },
          {
            title: 'Mock Item 2',
            link: 'https://example.com/2',
            pubDate: new Date().toISOString(),
            content: 'Mock content 2'
          }
        ]
      };
    }
  };
});

// Mock TensorFlow.js
jest.mock('@tensorflow/tfjs', () => ({
  tensor: jest.fn().mockReturnValue({
    dataSync: jest.fn().mockReturnValue([1, 2, 3]),
    dispose: jest.fn()
  }),
  sequential: jest.fn().mockReturnValue({
    add: jest.fn(),
    compile: jest.fn(),
    fit: jest.fn().mockResolvedValue({ history: { loss: [0.1] } }),
    predict: jest.fn().mockReturnValue({
      dataSync: jest.fn().mockReturnValue([0.8])
    })
  }),
  layers: {
    dense: jest.fn().mockReturnValue({}),
    dropout: jest.fn().mockReturnValue({})
  },
  train: {
    adam: jest.fn().mockReturnValue({})
  }
}));

// Mock simple-statistics
jest.mock('simple-statistics', () => ({
  mean: jest.fn().mockReturnValue(5),
  standardDeviation: jest.fn().mockReturnValue(1.5),
  regression: {
    linear: jest.fn().mockReturnValue({
      m: 0.5,
      b: 2,
      predict: jest.fn().mockReturnValue(7)
    })
  },
  bayesianClassifier: jest.fn().mockReturnValue({
    train: jest.fn(),
    score: jest.fn().mockReturnValue(0.8)
  })
}));

// Mock file system operations
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn().mockResolvedValue('{}'),
    writeFile: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
    access: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn().mockResolvedValue({ isFile: () => true, isDirectory: () => false })
  },
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue('{}'),
  writeFileSync: jest.fn().mockReturnValue(undefined)
}));

// Mock path module
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((...args) => '/' + args.join('/')),
  dirname: jest.fn((path) => path.split('/').slice(0, -1).join('/')),
  basename: jest.fn((path) => path.split('/').pop()),
  extname: jest.fn((path) => {
    const parts = path.split('.');
    return parts.length > 1 ? '.' + parts.pop() : '';
  })
}));

// Create test utilities and factories
export class MockAgentFactory {
  static createMockAgent(type: string, id?: string) {
    return {
      getId: jest.fn().mockReturnValue(id || `mock-${type}-${Date.now()}`),
      getType: jest.fn().mockReturnValue(type),
      getStatus: jest.fn().mockReturnValue('active'),
      initialize: jest.fn().mockResolvedValue(undefined),
      generateReport: jest.fn().mockResolvedValue({
        recommendation: `Mock recommendation from ${type}`,
        confidence: 0.8,
        reasoning: `Mock reasoning from ${type} agent`
      }),
      receiveResponse: jest.fn(),
      processTask: jest.fn().mockResolvedValue({
        taskId: 'mock-task',
        agentId: id || `mock-${type}`,
        status: 'success',
        output: { result: 'mock output' },
        metrics: {
          duration: 1000,
          tokensUsed: 50,
          accuracy: 0.9,
          efficiency: 0.85
        }
      }),
      on: jest.fn(),
      emit: jest.fn(),
      setQueenConnection: jest.fn()
    };
  }
  
  static createMockQueen(swarmId?: string) {
    return {
      getId: jest.fn().mockReturnValue(`queen-${swarmId || 'test'}`),
      getType: jest.fn().mockReturnValue('queen'),
      getStatus: jest.fn().mockReturnValue('active'),
      initialize: jest.fn().mockResolvedValue(undefined),
      registerAgent: jest.fn(),
      makeStrategicDecision: jest.fn().mockResolvedValue({
        id: 'mock-decision',
        type: 'strategic',
        decision: 'Mock strategic decision',
        majority: {
          winner: { id: 'option-1', value: 'proceed' },
          votingStats: { totalVotes: 3, percentagePerOption: new Map() },
          participation: { actualVoters: 3, eligibleVoters: 3, participationRate: 1.0 }
        },
        implementation: {
          steps: [],
          assignments: [],
          timeline: { start: new Date(), end: new Date(), milestones: [] },
          successCriteria: []
        },
        timestamp: new Date()
      }),
      handleEmergency: jest.fn().mockResolvedValue({
        id: 'mock-emergency',
        type: 'emergency',
        decision: 'Mock emergency response',
        majority: { winner: { value: 'immediate' } },
        implementation: {},
        timestamp: new Date()
      }),
      monitorSwarmHealth: jest.fn().mockResolvedValue({
        timestamp: new Date(),
        overallHealth: 'healthy',
        agentHealth: [],
        memoryHealth: { status: 'healthy' },
        votingMetrics: {},
        activeDecisions: 0,
        recommendations: []
      }),
      on: jest.fn(),
      emit: jest.fn()
    };
  }
}

export class MockMemoryFactory {
  static createMockMemory() {
    const storage = new Map<string, any>();
    
    return {
      initialize: jest.fn().mockResolvedValue(undefined),
      store: jest.fn().mockImplementation(async (key: string, value: any) => {
        storage.set(key, { value, timestamp: Date.now() });
        return true;
      }),
      retrieve: jest.fn().mockImplementation(async (key: string) => {
        return storage.get(key)?.value;
      }),
      delete: jest.fn().mockImplementation(async (key: string) => {
        return storage.delete(key);
      }),
      list: jest.fn().mockImplementation(async (pattern?: string) => {
        const keys = Array.from(storage.keys());
        return pattern ? keys.filter(k => k.includes(pattern)) : keys;
      }),
      clear: jest.fn().mockImplementation(async () => {
        storage.clear();
      }),
      getHealthStatus: jest.fn().mockReturnValue({
        status: 'healthy',
        usage: 0.1,
        entries: storage.size
      }),
      on: jest.fn(),
      emit: jest.fn()
    };
  }
}

export class MockVotingFactory {
  static createMockMajorityEngine() {
    const votes = new Map<string, any[]>();
    
    return {
      initialize: jest.fn().mockResolvedValue(undefined),
      startVoting: jest.fn().mockImplementation(async (topic: any, voters: string[]) => {
        const votingId = `voting-${Date.now()}`;
        votes.set(votingId, []);
        return votingId;
      }),
      castVote: jest.fn().mockImplementation(async (votingId: string, vote: any) => {
        const votingVotes = votes.get(votingId) || [];
        votingVotes.push(vote);
        votes.set(votingId, votingVotes);
        return true;
      }),
      closeVoting: jest.fn().mockImplementation(async (votingId: string) => {
        const votingVotes = votes.get(votingId) || [];
        return {
          winner: { id: 'option-1', value: 'proceed' },
          votingStats: {
            totalVotes: votingVotes.length,
            percentagePerOption: new Map([['option-1', 1.0]])
          },
          participation: {
            actualVoters: votingVotes.length,
            eligibleVoters: votingVotes.length,
            participationRate: 1.0
          }
        };
      }),
      getVotingStatus: jest.fn().mockReturnValue({
        status: 'open',
        votes: [],
        deadline: new Date(Date.now() + 30000)
      }),
      getMetrics: jest.fn().mockReturnValue({
        totalVotes: 10,
        averageConfidence: 0.8,
        participationRate: 0.9
      }),
      setAgentWeight: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    };
  }
}

// Performance testing utilities
export class PerformanceTestUtils {
  static async measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    return { result, duration };
  }
  
  static async measureMemoryUsage<T>(fn: () => Promise<T>): Promise<{ result: T; memoryDelta: NodeJS.MemoryUsage }> {
    const initialMemory = process.memoryUsage();
    const result = await fn();
    const finalMemory = process.memoryUsage();
    
    const memoryDelta = {
      rss: finalMemory.rss - initialMemory.rss,
      heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
      heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
      external: finalMemory.external - initialMemory.external,
      arrayBuffers: finalMemory.arrayBuffers - initialMemory.arrayBuffers
    };
    
    return { result, memoryDelta };
  }
}

// Export all mock factories for use in tests
export {
  MockAgentFactory,
  MockMemoryFactory,
  MockVotingFactory,
  PerformanceTestUtils
};