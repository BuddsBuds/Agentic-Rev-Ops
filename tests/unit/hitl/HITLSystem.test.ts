import { HITLSystem } from '@/workflow/hitl/HITLSystem';
import { HITLOrchestrator } from '@/workflow/hitl/core/HITLOrchestrator';
import { TaskDelegationManager } from '@/workflow/hitl/delegation/TaskDelegationManager';
import { ReviewWorkflowEngine } from '@/workflow/hitl/review/ReviewWorkflowEngine';
import { ProgressTracker } from '@/workflow/hitl/tracking/ProgressTracker';
import { SwarmIntegration } from '@/workflow/hitl/integration/SwarmIntegration';
import { EventEmitter } from 'events';

// Mock all dependencies
jest.mock('@/workflow/hitl/core/HITLOrchestrator');
jest.mock('@/workflow/hitl/delegation/TaskDelegationManager');
jest.mock('@/workflow/hitl/review/ReviewWorkflowEngine');
jest.mock('@/workflow/hitl/tracking/ProgressTracker');
jest.mock('@/workflow/hitl/integration/SwarmIntegration');

describe('HITLSystem', () => {
  let hitlSystem: HITLSystem;
  let mockOrchestrator: jest.Mocked<HITLOrchestrator>;
  let mockDelegationManager: jest.Mocked<TaskDelegationManager>;
  let mockReviewEngine: jest.Mocked<ReviewWorkflowEngine>;
  let mockProgressTracker: jest.Mocked<ProgressTracker>;
  let mockSwarmIntegration: jest.Mocked<SwarmIntegration>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockOrchestrator = new HITLOrchestrator() as jest.Mocked<HITLOrchestrator>;
    mockDelegationManager = new TaskDelegationManager() as jest.Mocked<TaskDelegationManager>;
    mockReviewEngine = new ReviewWorkflowEngine() as jest.Mocked<ReviewWorkflowEngine>;
    mockProgressTracker = new ProgressTracker() as jest.Mocked<ProgressTracker>;
    mockSwarmIntegration = new SwarmIntegration() as jest.Mocked<SwarmIntegration>;

    // Set up default mock implementations
    mockOrchestrator.initialize = jest.fn().mockResolvedValue(undefined);
    mockOrchestrator.handleRequest = jest.fn().mockResolvedValue({
      id: 'req-123',
      status: 'completed',
      result: { approved: true },
    });

    mockDelegationManager.delegate = jest.fn().mockResolvedValue({
      taskId: 'task-123',
      delegatedTo: 'human-reviewer',
      status: 'delegated',
    });

    mockReviewEngine.processReview = jest.fn().mockResolvedValue({
      reviewId: 'review-123',
      decision: 'approved',
      feedback: 'Looks good',
    });

    mockProgressTracker.trackTask = jest.fn();
    mockProgressTracker.getProgress = jest.fn().mockReturnValue({
      total: 10,
      completed: 5,
      pending: 3,
      inProgress: 2,
    });

    mockSwarmIntegration.connect = jest.fn().mockResolvedValue(true);
    mockSwarmIntegration.sendToSwarm = jest.fn().mockResolvedValue({
      swarmId: 'swarm-123',
      status: 'processed',
    });

    // Create HITLSystem instance
    hitlSystem = new HITLSystem({
      orchestrator: mockOrchestrator,
      delegationManager: mockDelegationManager,
      reviewEngine: mockReviewEngine,
      progressTracker: mockProgressTracker,
      swarmIntegration: mockSwarmIntegration,
    });
  });

  describe('Initialization', () => {
    it('should initialize all components', async () => {
      await hitlSystem.initialize();

      expect(mockOrchestrator.initialize).toHaveBeenCalled();
      expect(mockSwarmIntegration.connect).toHaveBeenCalled();
      expect(hitlSystem.isInitialized()).toBe(true);
    });

    it('should handle initialization errors', async () => {
      mockOrchestrator.initialize.mockRejectedValueOnce(new Error('Init failed'));

      await expect(hitlSystem.initialize()).rejects.toThrow('Init failed');
      expect(hitlSystem.isInitialized()).toBe(false);
    });

    it('should prevent double initialization', async () => {
      await hitlSystem.initialize();
      await hitlSystem.initialize(); // Second call

      expect(mockOrchestrator.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('Request Processing', () => {
    beforeEach(async () => {
      await hitlSystem.initialize();
    });

    it('should process human-in-the-loop requests', async () => {
      const request = {
        type: 'approval',
        data: { document: 'contract.pdf', amount: 50000 },
        requester: 'agent-123',
        priority: 'high' as const,
      };

      const result = await hitlSystem.processRequest(request);

      expect(mockOrchestrator.handleRequest).toHaveBeenCalledWith(request);
      expect(result).toEqual({
        id: 'req-123',
        status: 'completed',
        result: { approved: true },
      });
    });

    it('should handle different request types', async () => {
      const requestTypes = ['approval', 'review', 'decision', 'validation'];

      for (const type of requestTypes) {
        const request = {
          type,
          data: { test: true },
          requester: 'agent-test',
          priority: 'medium' as const,
        };

        await hitlSystem.processRequest(request);
        expect(mockOrchestrator.handleRequest).toHaveBeenCalledWith(request);
      }
    });

    it('should emit events during processing', async () => {
      const events: any[] = [];
      hitlSystem.on('requestProcessed', (event) => events.push(event));

      const request = {
        type: 'approval',
        data: { test: true },
        requester: 'agent-123',
        priority: 'low' as const,
      };

      await hitlSystem.processRequest(request);

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        requestId: 'req-123',
        status: 'completed',
      });
    });
  });

  describe('Task Delegation', () => {
    beforeEach(async () => {
      await hitlSystem.initialize();
    });

    it('should delegate tasks to human reviewers', async () => {
      const task = {
        id: 'task-456',
        type: 'review',
        assignee: 'human-reviewer',
        data: { document: 'report.pdf' },
        deadline: new Date(Date.now() + 3600000), // 1 hour
      };

      const result = await hitlSystem.delegateTask(task);

      expect(mockDelegationManager.delegate).toHaveBeenCalledWith(task);
      expect(result).toEqual({
        taskId: 'task-123',
        delegatedTo: 'human-reviewer',
        status: 'delegated',
      });
    });

    it('should handle delegation failures', async () => {
      mockDelegationManager.delegate.mockRejectedValueOnce(
        new Error('No available reviewers')
      );

      const task = {
        id: 'task-789',
        type: 'approval',
        assignee: 'any',
        data: {},
      };

      await expect(hitlSystem.delegateTask(task)).rejects.toThrow(
        'No available reviewers'
      );
    });

    it('should track delegated tasks', async () => {
      const task = {
        id: 'task-track',
        type: 'review',
        assignee: 'reviewer-1',
        data: {},
      };

      await hitlSystem.delegateTask(task);

      expect(mockProgressTracker.trackTask).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-123',
          status: 'delegated',
        })
      );
    });
  });

  describe('Review Processing', () => {
    beforeEach(async () => {
      await hitlSystem.initialize();
    });

    it('should process reviews from humans', async () => {
      const review = {
        taskId: 'task-123',
        reviewerId: 'human-1',
        decision: 'approved' as const,
        feedback: 'All criteria met',
        timestamp: new Date(),
      };

      const result = await hitlSystem.processReview(review);

      expect(mockReviewEngine.processReview).toHaveBeenCalledWith(review);
      expect(result).toEqual({
        reviewId: 'review-123',
        decision: 'approved',
        feedback: 'Looks good',
      });
    });

    it('should validate review decisions', async () => {
      const invalidReview = {
        taskId: 'task-123',
        reviewerId: 'human-1',
        decision: 'invalid-decision' as any,
        feedback: '',
        timestamp: new Date(),
      };

      await expect(hitlSystem.processReview(invalidReview))
        .rejects.toThrow('Invalid review decision');
    });

    it('should update progress after review', async () => {
      const review = {
        taskId: 'task-123',
        reviewerId: 'human-1',
        decision: 'rejected' as const,
        feedback: 'Needs revision',
        timestamp: new Date(),
      };

      await hitlSystem.processReview(review);

      expect(mockProgressTracker.updateTaskStatus).toHaveBeenCalledWith(
        'task-123',
        'reviewed'
      );
    });
  });

  describe('Progress Tracking', () => {
    beforeEach(async () => {
      await hitlSystem.initialize();
    });

    it('should provide progress metrics', () => {
      const progress = hitlSystem.getProgress();

      expect(mockProgressTracker.getProgress).toHaveBeenCalled();
      expect(progress).toEqual({
        total: 10,
        completed: 5,
        pending: 3,
        inProgress: 2,
      });
    });

    it('should provide task-specific progress', () => {
      mockProgressTracker.getTaskProgress = jest.fn().mockReturnValue({
        taskId: 'task-123',
        status: 'in-progress',
        percentComplete: 75,
        estimatedCompletion: new Date(Date.now() + 1800000),
      });

      const taskProgress = hitlSystem.getTaskProgress('task-123');

      expect(taskProgress).toMatchObject({
        taskId: 'task-123',
        status: 'in-progress',
        percentComplete: 75,
      });
    });

    it('should provide real-time progress updates', (done) => {
      const progressUpdates: any[] = [];
      
      hitlSystem.on('progressUpdate', (update) => {
        progressUpdates.push(update);
        
        if (progressUpdates.length === 2) {
          expect(progressUpdates[0]).toMatchObject({ completed: 5 });
          expect(progressUpdates[1]).toMatchObject({ completed: 6 });
          done();
        }
      });

      // Simulate progress updates
      hitlSystem.emit('progressUpdate', { completed: 5 });
      hitlSystem.emit('progressUpdate', { completed: 6 });
    });
  });

  describe('Swarm Integration', () => {
    beforeEach(async () => {
      await hitlSystem.initialize();
    });

    it('should send tasks to swarm for processing', async () => {
      const swarmTask = {
        type: 'analysis',
        data: { dataset: 'sales-2024' },
        requiredAgents: ['analyst', 'processor'],
      };

      const result = await hitlSystem.sendToSwarm(swarmTask);

      expect(mockSwarmIntegration.sendToSwarm).toHaveBeenCalledWith(swarmTask);
      expect(result).toEqual({
        swarmId: 'swarm-123',
        status: 'processed',
      });
    });

    it('should handle swarm communication errors', async () => {
      mockSwarmIntegration.sendToSwarm.mockRejectedValueOnce(
        new Error('Swarm unavailable')
      );

      const swarmTask = {
        type: 'processing',
        data: {},
      };

      await expect(hitlSystem.sendToSwarm(swarmTask))
        .rejects.toThrow('Swarm unavailable');
    });

    it('should receive swarm results', (done) => {
      hitlSystem.on('swarmResult', (result) => {
        expect(result).toEqual({
          taskId: 'task-123',
          swarmId: 'swarm-123',
          result: { processed: true },
        });
        done();
      });

      // Simulate swarm result
      mockSwarmIntegration.emit('result', {
        taskId: 'task-123',
        swarmId: 'swarm-123',
        result: { processed: true },
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      await hitlSystem.initialize();
    });

    it('should handle and recover from component failures', async () => {
      // First call fails
      mockOrchestrator.handleRequest.mockRejectedValueOnce(
        new Error('Temporary failure')
      );

      // Implement retry logic
      const request = {
        type: 'approval',
        data: {},
        requester: 'agent-123',
        priority: 'high' as const,
      };

      // First attempt should fail
      await expect(hitlSystem.processRequest(request))
        .rejects.toThrow('Temporary failure');

      // Second attempt should succeed
      const result = await hitlSystem.processRequest(request);
      expect(result.status).toBe('completed');
    });

    it('should emit error events', (done) => {
      hitlSystem.on('error', (error) => {
        expect(error.message).toBe('Test error');
        done();
      });

      hitlSystem.emit('error', new Error('Test error'));
    });

    it('should gracefully shutdown', async () => {
      const shutdownSpy = jest.spyOn(hitlSystem, 'shutdown');
      
      await hitlSystem.shutdown();

      expect(shutdownSpy).toHaveBeenCalled();
      expect(mockSwarmIntegration.disconnect).toHaveBeenCalled();
    });
  });

  describe('Metrics and Analytics', () => {
    beforeEach(async () => {
      await hitlSystem.initialize();
    });

    it('should collect performance metrics', () => {
      const metrics = hitlSystem.getMetrics();

      expect(metrics).toMatchObject({
        totalRequests: expect.any(Number),
        completedRequests: expect.any(Number),
        averageProcessingTime: expect.any(Number),
        successRate: expect.any(Number),
      });
    });

    it('should track request processing times', async () => {
      const request = {
        type: 'approval',
        data: {},
        requester: 'agent-123',
        priority: 'medium' as const,
      };

      const startTime = Date.now();
      await hitlSystem.processRequest(request);
      const endTime = Date.now();

      const metrics = hitlSystem.getMetrics();
      expect(metrics.lastRequestDuration).toBeLessThanOrEqual(endTime - startTime);
    });
  });
});