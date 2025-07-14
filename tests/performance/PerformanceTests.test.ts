import { performance } from 'perf_hooks';
import { SwarmCoordinator } from '@/swarm/coordinator/SwarmCoordinator';
import { DatabaseService } from '@/core/database/DatabaseService';
import { WorkflowEngine } from '@/workflow/core/engine/workflow-engine';
import { TestDatabaseHelper } from '@tests/utils/TestDatabaseHelper';
import { PerformanceProfiler } from '@tests/utils/PerformanceProfiler';
import { MemoryMonitor } from '@tests/utils/MemoryMonitor';

/**
 * Performance tests for the Agentic RevOps system
 * Measures throughput, latency, resource usage, and scalability
 */
describe('Performance Tests', () => {
  let swarmCoordinator: SwarmCoordinator;
  let dbService: DatabaseService;
  let workflowEngine: WorkflowEngine;
  let testDbHelper: TestDatabaseHelper;
  let profiler: PerformanceProfiler;
  let memoryMonitor: MemoryMonitor;

  beforeAll(async () => {
    testDbHelper = new TestDatabaseHelper();
    profiler = new PerformanceProfiler();
    memoryMonitor = new MemoryMonitor();

    await testDbHelper.setupTestDatabase();
    
    dbService = new DatabaseService();
    await dbService.initialize();

    // Initialize with performance configuration
    swarmCoordinator = new SwarmCoordinator({
      performanceMode: true,
      maxAgents: 20,
      cacheEnabled: true,
    });

    workflowEngine = new WorkflowEngine({
      swarmCoordinator,
      databaseService: dbService,
      performanceTracking: true,
    });
  }, 60000);

  afterAll(async () => {
    await testDbHelper.teardownTestDatabase();
    await swarmCoordinator.shutdown();
    
    // Generate performance report
    profiler.generateReport('performance-report.json');
  });

  describe('Swarm Decision Performance', () => {
    it('should measure decision latency', async () => {
      const iterations = 100;
      const latencies: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        
        await swarmCoordinator.processDecision({
          type: 'performance-test',
          context: {
            iteration: i,
            complexity: 'medium',
            data: Array(100).fill(null).map(() => Math.random()),
          },
          requiresConsensus: true,
          consensusThreshold: 0.6,
        });

        const latency = performance.now() - start;
        latencies.push(latency);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(iterations * 0.95)];
      const p99Latency = latencies.sort((a, b) => a - b)[Math.floor(iterations * 0.99)];

      console.log(`Decision Latency - Avg: ${avgLatency.toFixed(2)}ms, P95: ${p95Latency.toFixed(2)}ms, P99: ${p99Latency.toFixed(2)}ms`);

      // Performance assertions
      expect(avgLatency).toBeLessThan(100); // Average under 100ms
      expect(p95Latency).toBeLessThan(200); // 95th percentile under 200ms
      expect(p99Latency).toBeLessThan(500); // 99th percentile under 500ms
    });

    it('should handle high-throughput decisions', async () => {
      const concurrentDecisions = 50;
      const startTime = performance.now();
      const startMemory = memoryMonitor.getCurrentUsage();

      const decisions = Array(concurrentDecisions).fill(null).map((_, i) => 
        swarmCoordinator.processDecision({
          type: 'throughput-test',
          context: { id: i, data: { value: Math.random() * 1000 } },
          requiresConsensus: false, // Faster processing
        })
      );

      const results = await Promise.all(decisions);
      const duration = performance.now() - startTime;
      const memoryIncrease = memoryMonitor.getCurrentUsage() - startMemory;

      const throughput = (concurrentDecisions / duration) * 1000; // Decisions per second

      console.log(`Throughput: ${throughput.toFixed(2)} decisions/sec`);
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);

      expect(throughput).toBeGreaterThan(100); // At least 100 decisions/sec
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
    });
  });

  describe('Database Performance', () => {
    beforeEach(async () => {
      await testDbHelper.clearAllTables();
    });

    it('should measure write performance', async () => {
      const recordCount = 1000;
      const batchSize = 100;
      const batches = recordCount / batchSize;

      profiler.start('database-writes');

      for (let batch = 0; batch < batches; batch++) {
        const promises = Array(batchSize).fill(null).map((_, i) => 
          dbService.organizations.create({
            name: `Perf Org ${batch * batchSize + i}`,
            industry: 'Technology',
            size: 'medium',
            metadata: {
              testRun: 'performance',
              timestamp: Date.now(),
              data: Array(10).fill(null).map(() => Math.random()),
            },
          })
        );

        await Promise.all(promises);
      }

      const metrics = profiler.stop('database-writes');
      const writesPerSecond = recordCount / (metrics.duration / 1000);

      console.log(`Database writes: ${writesPerSecond.toFixed(2)} records/sec`);

      expect(writesPerSecond).toBeGreaterThan(100); // At least 100 writes/sec
    });

    it('should measure read performance', async () => {
      // Prepare test data
      await testDbHelper.createPerformanceTestData(5000);

      profiler.start('database-reads');

      // Perform various read operations
      const readOperations = [
        // Full table scan
        dbService.organizations.findAll(),
        // Filtered queries
        dbService.organizations.findAll({ industry: 'Technology' }),
        dbService.organizations.findAll({ size: 'large' }),
        // Individual lookups (100 random)
        ...Array(100).fill(null).map((_, i) => 
          dbService.organizations.findById(`perf-org-${i}`)
        ),
      ];

      await Promise.all(readOperations);

      const metrics = profiler.stop('database-reads');
      const readsPerSecond = readOperations.length / (metrics.duration / 1000);

      console.log(`Database reads: ${readsPerSecond.toFixed(2)} operations/sec`);

      expect(metrics.duration).toBeLessThan(5000); // Complete within 5 seconds
      expect(readsPerSecond).toBeGreaterThan(20); // At least 20 operations/sec
    });

    it('should measure transaction performance', async () => {
      const transactionCount = 50;
      const operationsPerTransaction = 5;

      profiler.start('database-transactions');

      const transactions = Array(transactionCount).fill(null).map((_, i) => 
        dbService.transaction(async (tx) => {
          // Create organization
          const org = await tx.organizations.create({
            name: `Transaction Org ${i}`,
            industry: 'Finance',
            size: 'large',
          });

          // Create multiple related records
          for (let j = 0; j < operationsPerTransaction - 1; j++) {
            await tx.swarmConfigurations.create({
              organizationId: org.id,
              name: `Config ${j}`,
              topology: 'mesh',
              consensus: { type: 'simple_majority', threshold: 0.5 },
              agents: [],
              performance: {
                avgResponseTime: 0,
                successRate: 1,
                totalDecisions: 0,
              },
            });
          }

          return org;
        })
      );

      const results = await Promise.all(transactions);
      const metrics = profiler.stop('database-transactions');

      const transactionsPerSecond = transactionCount / (metrics.duration / 1000);
      const operationsPerSecond = (transactionCount * operationsPerTransaction) / (metrics.duration / 1000);

      console.log(`Transactions: ${transactionsPerSecond.toFixed(2)} tx/sec`);
      console.log(`Operations: ${operationsPerSecond.toFixed(2)} ops/sec`);

      expect(transactionsPerSecond).toBeGreaterThan(10); // At least 10 tx/sec
    });
  });

  describe('Workflow Engine Performance', () => {
    it('should measure workflow execution performance', async () => {
      const workflowCount = 20;
      const workflows: any[] = [];

      // Create workflows
      for (let i = 0; i < workflowCount; i++) {
        const workflow = await workflowEngine.createWorkflow({
          type: 'performance-test',
          organizationId: 'org-1',
          parameters: {
            steps: 10,
            complexity: i % 3 === 0 ? 'high' : 'medium',
          },
          requester: 'perf-user',
        });
        workflows.push(workflow);
      }

      profiler.start('workflow-execution');
      memoryMonitor.startTracking('workflow-memory');

      // Execute workflows concurrently
      const executions = workflows.map(w => workflowEngine.executeWorkflow(w.id));
      const results = await Promise.all(executions);

      const metrics = profiler.stop('workflow-execution');
      const memoryMetrics = memoryMonitor.stopTracking('workflow-memory');

      const avgExecutionTime = metrics.duration / workflowCount;
      const throughput = (workflowCount / metrics.duration) * 1000;

      console.log(`Workflow execution - Avg: ${avgExecutionTime.toFixed(2)}ms, Throughput: ${throughput.toFixed(2)} workflows/sec`);
      console.log(`Memory - Peak: ${(memoryMetrics.peak / 1024 / 1024).toFixed(2)}MB, Avg: ${(memoryMetrics.average / 1024 / 1024).toFixed(2)}MB`);

      expect(avgExecutionTime).toBeLessThan(2000); // Under 2 seconds per workflow
      expect(memoryMetrics.peak).toBeLessThan(500 * 1024 * 1024); // Peak under 500MB
    });
  });

  describe('Scalability Tests', () => {
    it('should scale with increasing agent count', async () => {
      const agentCounts = [5, 10, 20, 40];
      const results: any[] = [];

      for (const agentCount of agentCounts) {
        // Reconfigure swarm with different agent counts
        await swarmCoordinator.reconfigure({
          maxAgents: agentCount,
          topology: 'hierarchical',
        });

        const start = performance.now();
        const decisions = Array(100).fill(null).map(() => 
          swarmCoordinator.processDecision({
            type: 'scalability-test',
            context: { agentCount, timestamp: Date.now() },
            requiresConsensus: true,
          })
        );

        await Promise.all(decisions);
        const duration = performance.now() - start;

        results.push({
          agentCount,
          duration,
          throughput: (100 / duration) * 1000,
        });
      }

      console.log('Scalability Results:');
      results.forEach(r => {
        console.log(`  ${r.agentCount} agents: ${r.throughput.toFixed(2)} decisions/sec`);
      });

      // Verify sub-linear scaling (should not degrade linearly with agent count)
      const scalingFactor = results[3].duration / results[0].duration;
      expect(scalingFactor).toBeLessThan(4); // Less than 4x slower with 8x agents
    });

    it('should handle memory pressure gracefully', async () => {
      const initialMemory = memoryMonitor.getCurrentUsage();
      const largeDatasets: any[] = [];

      // Create memory pressure
      for (let i = 0; i < 100; i++) {
        largeDatasets.push({
          id: i,
          data: Array(10000).fill(null).map(() => ({
            value: Math.random(),
            timestamp: Date.now(),
            metadata: { index: i },
          })),
        });
      }

      // Process under memory pressure
      const decisions = largeDatasets.slice(0, 20).map(dataset => 
        swarmCoordinator.processDecision({
          type: 'memory-pressure-test',
          context: dataset,
          requiresConsensus: false,
        })
      );

      await Promise.all(decisions);

      const finalMemory = memoryMonitor.getCurrentUsage();
      const memoryIncrease = finalMemory - initialMemory;

      console.log(`Memory increase under pressure: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

      // Should not leak excessive memory
      expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024); // Less than 200MB

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        const afterGC = memoryMonitor.getCurrentUsage();
        const recovered = finalMemory - afterGC;
        console.log(`Memory recovered after GC: ${(recovered / 1024 / 1024).toFixed(2)}MB`);
      }
    });
  });

  describe('Stress Tests', () => {
    it('should maintain stability under sustained load', async () => {
      const duration = 30000; // 30 seconds
      const startTime = Date.now();
      let operationCount = 0;
      let errorCount = 0;

      profiler.start('sustained-load');

      while (Date.now() - startTime < duration) {
        const operations = Array(10).fill(null).map(() => {
          const opType = Math.random();
          
          if (opType < 0.3) {
            // Database operation
            return dbService.organizations.findAll({ size: 'medium' })
              .catch(() => { errorCount++; });
          } else if (opType < 0.6) {
            // Swarm decision
            return swarmCoordinator.processDecision({
              type: 'stress-test',
              context: { timestamp: Date.now() },
              requiresConsensus: false,
            }).catch(() => { errorCount++; });
          } else {
            // Workflow execution
            return workflowEngine.createWorkflow({
              type: 'stress-test',
              organizationId: 'org-1',
              parameters: { quick: true },
              requester: 'stress-test',
            }).then(w => workflowEngine.executeWorkflow(w.id))
              .catch(() => { errorCount++; });
          }
        });

        await Promise.all(operations);
        operationCount += operations.length;

        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const metrics = profiler.stop('sustained-load');
      const errorRate = (errorCount / operationCount) * 100;
      const opsPerSecond = operationCount / (duration / 1000);

      console.log(`Sustained load - Operations: ${operationCount}, Errors: ${errorCount} (${errorRate.toFixed(2)}%)`);
      console.log(`Throughput: ${opsPerSecond.toFixed(2)} ops/sec`);

      expect(errorRate).toBeLessThan(1); // Less than 1% error rate
      expect(opsPerSecond).toBeGreaterThan(50); // At least 50 ops/sec sustained
    }, 45000);
  });
});