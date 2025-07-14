// Integrated Workflow System - Main orchestrator for all workflow components
import { EventEmitter } from 'events';
import { WorkflowExecutionEngine, WorkflowEngine } from './core/engine/workflow-engine';
import { WorkflowSchedulerEngine, WorkflowScheduler } from './core/scheduler/workflow-scheduler';
import { WorkflowOrchestrator } from './core/orchestrator/workflow-orchestrator';
import { ProcessManager } from './core/process/ProcessDefinition';
import { ErrorHandler } from './core/error/ErrorHandler';
import { PerformanceOptimizer } from './monitors/performance/PerformanceOptimizer';
import { WorkflowPerformanceMonitor } from './monitors/performance/performance-monitor';
import { HITLSystem } from './hitl/HITLSystem';
import { SwarmMemory } from '../swarm/memory/SwarmMemory';
import { SwarmCoordinator } from '../swarm/coordinator/SwarmCoordinator';

export interface WorkflowSystemConfig {
  name: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  features: {
    scheduling: boolean;
    processManagement: boolean;
    errorHandling: boolean;
    performanceMonitoring: boolean;
    hitlIntegration: boolean;
    swarmIntegration: boolean;
  };
  performance: {
    maxConcurrentWorkflows: number;
    executionTimeout: number;
    retryPolicy: string;
    caching: boolean;
  };
  persistence: {
    enabled: boolean;
    type: 'memory' | 'database' | 'file';
    config?: any;
  };
}

export interface WorkflowSystemStatus {
  status: 'initializing' | 'running' | 'degraded' | 'maintenance' | 'shutdown';
  uptime: number;
  components: {
    engine: ComponentStatus;
    scheduler: ComponentStatus;
    orchestrator: ComponentStatus;
    processManager: ComponentStatus;
    errorHandler: ComponentStatus;
    performanceMonitor: ComponentStatus;
    hitlSystem?: ComponentStatus;
  };
  metrics: SystemMetrics;
  health: SystemHealth;
}

export interface ComponentStatus {
  name: string;
  status: 'online' | 'offline' | 'degraded' | 'error';
  initialized: boolean;
  lastActivity?: Date;
  error?: Error;
}

export interface SystemMetrics {
  totalWorkflows: number;
  activeWorkflows: number;
  completedWorkflows: number;
  failedWorkflows: number;
  averageExecutionTime: number;
  successRate: number;
  errorRate: number;
  throughput: number;
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  score: number; // 0-100
  issues: string[];
  recommendations: string[];
}

export class WorkflowSystem extends EventEmitter {
  private config: WorkflowSystemConfig;
  private status: WorkflowSystemStatus['status'] = 'initializing';
  private startTime: Date = new Date();
  
  // Core components
  private engine: WorkflowEngine;
  private scheduler: WorkflowScheduler;
  private orchestrator: WorkflowOrchestrator;
  private processManager: ProcessManager;
  private errorHandler: ErrorHandler;
  private performanceOptimizer: PerformanceOptimizer;
  private performanceMonitor: WorkflowPerformanceMonitor;
  private hitlSystem?: HITLSystem;
  
  // Swarm integration
  private swarmMemory?: SwarmMemory;
  private swarmCoordinator?: SwarmCoordinator;
  
  // System state
  private isInitialized: boolean = false;
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;

  constructor(
    config: Partial<WorkflowSystemConfig> = {},
    swarmMemory?: SwarmMemory,
    swarmCoordinator?: SwarmCoordinator
  ) {
    super();
    
    this.config = this.buildConfig(config);
    this.swarmMemory = swarmMemory;
    this.swarmCoordinator = swarmCoordinator;
    
    // Initialize core components
    this.engine = new WorkflowExecutionEngine();
    this.scheduler = new WorkflowSchedulerEngine(this.engine);
    this.orchestrator = new WorkflowOrchestrator();
    this.processManager = new ProcessManager(this.engine);
    this.errorHandler = new ErrorHandler();
    this.performanceOptimizer = new PerformanceOptimizer();
    this.performanceMonitor = new WorkflowPerformanceMonitor();
    
    this.setupEventHandlers();
  }

  private buildConfig(config: Partial<WorkflowSystemConfig>): WorkflowSystemConfig {
    return {
      name: config.name || 'Workflow System',
      version: config.version || '1.0.0',
      environment: config.environment || 'development',
      features: {
        scheduling: true,
        processManagement: true,
        errorHandling: true,
        performanceMonitoring: true,
        hitlIntegration: true,
        swarmIntegration: true,
        ...config.features
      },
      performance: {
        maxConcurrentWorkflows: 100,
        executionTimeout: 300000, // 5 minutes
        retryPolicy: 'default',
        caching: true,
        ...config.performance
      },
      persistence: {
        enabled: false,
        type: 'memory',
        ...config.persistence
      }
    };
  }

  // Initialization

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Workflow system is already initialized');
    }

    try {
      this.emit('system:initializing');
      
      // Initialize components in order
      await this.initializeEngine();
      await this.initializeScheduler();
      await this.initializeOrchestrator();
      await this.initializeProcessManager();
      await this.initializeErrorHandler();
      await this.initializePerformanceMonitoring();
      
      if (this.config.features.hitlIntegration && this.swarmMemory && this.swarmCoordinator) {
        await this.initializeHITL();
      }
      
      // Start system monitoring
      this.startSystemMonitoring();
      
      // Store initialization in swarm memory
      if (this.swarmMemory) {
        await this.swarmMemory.store('workflow:system:initialized', {
          config: this.config,
          timestamp: new Date(),
          components: this.getComponentStatuses()
        });
      }
      
      this.isInitialized = true;
      this.status = 'running';
      
      this.emit('system:initialized', this.getSystemStatus());
      
    } catch (error) {
      this.status = 'degraded';
      this.emit('system:error', { error, phase: 'initialization' });
      throw error;
    }
  }

  private async initializeEngine(): Promise<void> {
    // Engine is already created, just set up integrations
    this.engine.on('workflow:start', (data) => this.handleWorkflowStart(data));
    this.engine.on('workflow:complete', (data) => this.handleWorkflowComplete(data));
    this.engine.on('workflow:error', (data) => this.handleWorkflowError(data));
    this.engine.on('step:error', (data) => this.handleStepError(data));
    
    this.emit('component:initialized', { component: 'engine' });
  }

  private async initializeScheduler(): Promise<void> {
    if (!this.config.features.scheduling) return;
    
    await this.scheduler.initialize();
    
    this.scheduler.on('workflow:scheduled', (data) => {
      this.emit('workflow:scheduled', data);
    });
    
    this.scheduler.on('workflow:run', (data) => {
      this.emit('workflow:scheduled-run', data);
    });
    
    this.emit('component:initialized', { component: 'scheduler' });
  }

  private async initializeOrchestrator(): Promise<void> {
    await this.orchestrator.initialize();
    
    this.orchestrator.on('workflow:started', (data) => {
      this.performanceMonitor.recordExecution({
        workflowId: data.workflowId,
        workflowName: 'Orchestrated Workflow',
        executionId: data.executionId,
        startTime: new Date(),
        status: 'running',
        steps: new Map()
      });
    });
    
    this.orchestrator.on('workflow:completed', (data) => {
      this.emit('orchestrator:workflow-completed', data);
    });
    
    this.emit('component:initialized', { component: 'orchestrator' });
  }

  private async initializeProcessManager(): Promise<void> {
    if (!this.config.features.processManagement) return;
    
    this.processManager.on('process:started', (data) => {
      this.emit('process:started', data);
    });
    
    this.processManager.on('execution:completed', (data) => {
      this.emit('process:completed', data);
    });
    
    this.emit('component:initialized', { component: 'processManager' });
  }

  private async initializeErrorHandler(): Promise<void> {
    if (!this.config.features.errorHandling) return;
    
    // Register default retry policies
    this.errorHandler.registerRetryPolicy('workflow-default', {
      maxRetries: 3,
      strategy: 'exponential' as any,
      baseDelay: 1000,
      maxDelay: 30000,
      jitter: true
    });
    
    this.errorHandler.on('error:created', (error) => {
      this.emit('error:detected', error);
    });
    
    this.errorHandler.on('recovery:success', (data) => {
      this.emit('error:recovered', data);
    });
    
    this.emit('component:initialized', { component: 'errorHandler' });
  }

  private async initializePerformanceMonitoring(): Promise<void> {
    if (!this.config.features.performanceMonitoring) return;
    
    this.performanceOptimizer.startMonitoring();
    this.performanceMonitor.start();
    
    this.performanceOptimizer.on('alert:created', (alert) => {
      this.emit('performance:alert', alert);
    });
    
    this.performanceOptimizer.on('optimization:suggested', (suggestion) => {
      this.emit('performance:optimization-suggested', suggestion);
    });
    
    this.emit('component:initialized', { component: 'performanceMonitor' });
  }

  private async initializeHITL(): Promise<void> {
    if (!this.swarmMemory || !this.swarmCoordinator) {
      throw new Error('HITL requires swarm memory and coordinator');
    }
    
    this.hitlSystem = new HITLSystem(this.swarmMemory, this.swarmCoordinator);
    await this.hitlSystem.initialize();
    
    this.hitlSystem.on('decision:required', (decision) => {
      this.emit('hitl:decision-required', decision);
    });
    
    this.emit('component:initialized', { component: 'hitlSystem' });
  }

  // Workflow Management

  public async createWorkflow(config: any): Promise<string> {
    this.ensureInitialized();
    
    try {
      const workflow = this.engine.createWorkflow(config);
      
      this.emit('workflow:created', { workflow });
      
      return workflow.id;
    } catch (error) {
      const workflowError = this.errorHandler.createError(
        'validation' as any,
        `Failed to create workflow: ${error instanceof Error ? error.message : String(error)}`,
        { details: config }
      );
      throw workflowError;
    }
  }

  public async executeWorkflow(
    workflowId: string,
    context?: any,
    options?: { priority?: number; scheduled?: boolean }
  ): Promise<any> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    
    try {
      // Check concurrent execution limit
      const activeCount = this.getActiveWorkflowCount();
      if (activeCount >= this.config.performance.maxConcurrentWorkflows) {
        throw new Error('Maximum concurrent workflows reached');
      }
      
      // Execute with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Workflow execution timeout')), 
          this.config.performance.executionTimeout);
      });
      
      const executionPromise = this.engine.executeWorkflow(workflowId, context);
      
      const result = await Promise.race([executionPromise, timeoutPromise]);
      
      const executionTime = Date.now() - startTime;
      this.recordSuccess(workflowId, executionTime);
      
      return result;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.recordFailure(workflowId, executionTime, error);
      
      // Attempt recovery
      if (this.config.features.errorHandling) {
        const workflowError = this.errorHandler.createError(
          'execution' as any,
          error instanceof Error ? error.message : String(error),
          { workflowId, context }
        );
        
        try {
          const recovered = await this.errorHandler.recover(workflowError);
          return recovered;
        } catch (recoveryError) {
          throw recoveryError;
        }
      }
      
      throw error;
    }
  }

  public async scheduleWorkflow(
    workflowId: string,
    schedule: string | Date | any,
    context?: any
  ): Promise<string> {
    this.ensureInitialized();
    
    if (!this.config.features.scheduling) {
      throw new Error('Scheduling feature is not enabled');
    }
    
    const scheduled = this.scheduler.scheduleWorkflow(workflowId, schedule, context);
    
    this.emit('workflow:scheduled', { scheduled });
    
    return scheduled.id;
  }

  public async createProcess(definition: any): Promise<string> {
    this.ensureInitialized();
    
    if (!this.config.features.processManagement) {
      throw new Error('Process management feature is not enabled');
    }
    
    const process = this.processManager.createProcess(definition);
    
    this.emit('process:created', { process });
    
    return process.id;
  }

  public async executeProcess(
    processId: string,
    context?: any,
    options?: any
  ): Promise<string> {
    this.ensureInitialized();
    
    if (!this.config.features.processManagement) {
      throw new Error('Process management feature is not enabled');
    }
    
    return await this.processManager.executeProcess(processId, context, options);
  }

  // System Management

  private startSystemMonitoring(): void {
    // Health check every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000);
    
    // Metrics collection every 10 seconds
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, 10000);
  }

  private performHealthCheck(): void {
    const health = this.calculateSystemHealth();
    
    if (health.status === 'critical') {
      this.status = 'degraded';
      this.emit('health:critical', health);
    } else if (health.status === 'warning' && this.status === 'running') {
      this.emit('health:warning', health);
    }
    
    this.emit('health:checked', health);
  }

  private collectMetrics(): void {
    const metrics = this.calculateSystemMetrics();
    
    this.emit('metrics:collected', metrics);
    
    // Store in swarm memory if available
    if (this.swarmMemory) {
      this.swarmMemory.store(`workflow:metrics:${Date.now()}`, metrics).catch(err => {
        console.error('Failed to store metrics:', err);
      });
    }
  }

  private calculateSystemHealth(): SystemHealth {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;
    
    // Check component health
    const componentStatuses = this.getComponentStatuses();
    for (const [name, status] of Object.entries(componentStatuses)) {
      if (status.status === 'error') {
        issues.push(`Component ${name} is in error state`);
        score -= 20;
      } else if (status.status === 'degraded') {
        issues.push(`Component ${name} is degraded`);
        score -= 10;
      }
    }
    
    // Check performance metrics
    const metrics = this.calculateSystemMetrics();
    if (metrics.errorRate > 0.1) {
      issues.push('High error rate detected');
      recommendations.push('Review failed workflows and adjust error handling');
      score -= 15;
    }
    
    if (metrics.averageExecutionTime > 60000) { // 1 minute
      issues.push('Slow average execution time');
      recommendations.push('Optimize workflow steps or enable parallel execution');
      score -= 10;
    }
    
    // Check resource usage
    const memUsage = process.memoryUsage();
    const memPercentage = memUsage.heapUsed / memUsage.heapTotal;
    if (memPercentage > 0.9) {
      issues.push('High memory usage');
      recommendations.push('Increase memory allocation or optimize memory usage');
      score -= 20;
    }
    
    const status = score >= 80 ? 'healthy' : score >= 50 ? 'warning' : 'critical';
    
    return {
      status,
      score: Math.max(0, score),
      issues,
      recommendations
    };
  }

  private calculateSystemMetrics(): SystemMetrics {
    // Get metrics from performance monitor
    const performanceMetrics = this.performanceMonitor.getWorkflowMetrics();
    
    // Calculate aggregated metrics
    let totalWorkflows = 0;
    let completedWorkflows = 0;
    let failedWorkflows = 0;
    let totalExecutionTime = 0;
    
    // This is a simplified calculation - in production, would aggregate from all sources
    const activeWorkflows = this.getActiveWorkflowCount();
    
    return {
      totalWorkflows,
      activeWorkflows,
      completedWorkflows,
      failedWorkflows,
      averageExecutionTime: totalWorkflows > 0 ? totalExecutionTime / totalWorkflows : 0,
      successRate: totalWorkflows > 0 ? completedWorkflows / totalWorkflows : 1,
      errorRate: totalWorkflows > 0 ? failedWorkflows / totalWorkflows : 0,
      throughput: 0 // Would calculate based on time window
    };
  }

  // Event Handlers

  private handleWorkflowStart(data: any): void {
    this.performanceMonitor.recordExecution({
      workflowId: data.workflowId,
      workflowName: data.workflow?.name || 'Unknown',
      executionId: data.workflowId,
      startTime: new Date(),
      status: 'running',
      steps: new Map(),
      context: data.context
    });
    
    this.emit('workflow:started', data);
  }

  private handleWorkflowComplete(data: any): void {
    this.performanceMonitor.recordExecution({
      workflowId: data.workflowId,
      workflowName: 'Unknown',
      executionId: data.workflowId,
      startTime: new Date(Date.now() - (data.duration || 0)),
      endTime: new Date(),
      status: 'completed',
      steps: new Map()
    });
    
    this.emit('workflow:completed', data);
  }

  private handleWorkflowError(data: any): void {
    const error = this.errorHandler.createError(
      'execution' as any,
      data.error?.message || 'Workflow execution failed',
      {
        workflowId: data.workflowId,
        details: data.error
      }
    );
    
    this.performanceMonitor.recordExecution({
      workflowId: data.workflowId,
      workflowName: 'Unknown',
      executionId: data.workflowId,
      startTime: new Date(),
      endTime: new Date(),
      status: 'failed',
      steps: new Map(),
      errors: [error]
    });
    
    this.emit('workflow:failed', data);
  }

  private handleStepError(data: any): void {
    const error = this.errorHandler.createError(
      'execution' as any,
      `Step ${data.step?.name || data.step?.id} failed`,
      {
        workflowId: data.workflowId,
        stepId: data.step?.id,
        details: data.error
      }
    );
    
    this.emit('step:failed', { ...data, error });
  }

  // Utility Methods

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Workflow system is not initialized');
    }
  }

  private getComponentStatuses(): Record<string, ComponentStatus> {
    return {
      engine: {
        name: 'Workflow Engine',
        status: 'online',
        initialized: true
      },
      scheduler: {
        name: 'Workflow Scheduler',
        status: this.config.features.scheduling ? 'online' : 'offline',
        initialized: this.config.features.scheduling
      },
      orchestrator: {
        name: 'Workflow Orchestrator',
        status: 'online',
        initialized: true
      },
      processManager: {
        name: 'Process Manager',
        status: this.config.features.processManagement ? 'online' : 'offline',
        initialized: this.config.features.processManagement
      },
      errorHandler: {
        name: 'Error Handler',
        status: this.config.features.errorHandling ? 'online' : 'offline',
        initialized: this.config.features.errorHandling
      },
      performanceMonitor: {
        name: 'Performance Monitor',
        status: this.config.features.performanceMonitoring ? 'online' : 'offline',
        initialized: this.config.features.performanceMonitoring
      },
      ...(this.hitlSystem ? {
        hitlSystem: {
          name: 'HITL System',
          status: 'online',
          initialized: true
        }
      } : {})
    };
  }

  private getActiveWorkflowCount(): number {
    // This would track actual active workflows
    return 0;
  }

  private recordSuccess(workflowId: string, executionTime: number): void {
    this.emit('workflow:success', { workflowId, executionTime });
  }

  private recordFailure(workflowId: string, executionTime: number, error: any): void {
    this.emit('workflow:failure', { workflowId, executionTime, error });
  }

  // Event Setup

  private setupEventHandlers(): void {
    // Set max listeners to prevent warnings
    this.setMaxListeners(50);
    
    // System error handling
    this.on('error', (error) => {
      console.error('[WorkflowSystem] Error:', error);
      this.status = 'degraded';
    });
    
    // Component error handling
    for (const component of [
      this.engine,
      this.scheduler,
      this.orchestrator,
      this.processManager,
      this.errorHandler,
      this.performanceOptimizer,
      this.performanceMonitor
    ]) {
      if (component && typeof component.on === 'function') {
        component.on('error', (error: any) => {
          this.emit('component:error', { component: component.constructor.name, error });
        });
      }
    }
  }

  // Public API

  public getSystemStatus(): WorkflowSystemStatus {
    const uptime = Date.now() - this.startTime.getTime();
    
    return {
      status: this.status,
      uptime,
      components: this.getComponentStatuses(),
      metrics: this.calculateSystemMetrics(),
      health: this.calculateSystemHealth()
    };
  }

  public async shutdown(): Promise<void> {
    this.status = 'shutdown';
    
    // Stop monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    // Shutdown components in reverse order
    if (this.hitlSystem) {
      await this.hitlSystem.shutdown();
    }
    
    this.performanceMonitor.stop();
    this.performanceOptimizer.stopMonitoring();
    await this.scheduler.shutdown();
    await this.orchestrator.shutdown();
    
    // Store shutdown event
    if (this.swarmMemory) {
      await this.swarmMemory.store('workflow:system:shutdown', {
        timestamp: new Date(),
        uptime: Date.now() - this.startTime.getTime(),
        finalMetrics: this.calculateSystemMetrics()
      });
    }
    
    this.emit('system:shutdown');
  }

  public getConfiguration(): WorkflowSystemConfig {
    return { ...this.config };
  }

  public updateConfiguration(updates: Partial<WorkflowSystemConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emit('config:updated', updates);
  }

  // Component Access

  public getEngine(): WorkflowEngine {
    return this.engine;
  }

  public getScheduler(): WorkflowScheduler {
    return this.scheduler;
  }

  public getOrchestrator(): WorkflowOrchestrator {
    return this.orchestrator;
  }

  public getProcessManager(): ProcessManager {
    return this.processManager;
  }

  public getErrorHandler(): ErrorHandler {
    return this.errorHandler;
  }

  public getPerformanceMonitor(): WorkflowPerformanceMonitor {
    return this.performanceMonitor;
  }

  public getHITLSystem(): HITLSystem | undefined {
    return this.hitlSystem;
  }
}