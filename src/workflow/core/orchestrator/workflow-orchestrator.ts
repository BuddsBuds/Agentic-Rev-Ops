/**
 * Workflow Orchestrator
 * Central coordination engine for automated RevOps workflows
 */

import { EventEmitter } from 'events';
import { WorkflowExecutionEngine, WorkflowEngine } from '../engine/workflow-engine';
import { WorkflowSchedulerEngine, WorkflowScheduler } from '../scheduler/workflow-scheduler';
import { AgentCoordinationEngine, AgentCoordinator } from '../../agents/coordinator/agent-coordinator';
import { HumanInTheLoopManager, HITLManager } from '../../hitl/interfaces/hitl-manager';
import { WorkflowIntegrationManager, IntegrationManager } from '../../integrations/integration-manager';
import { WorkflowPerformanceMonitor, PerformanceMonitor } from '../../monitors/performance/performance-monitor';

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  config: WorkflowConfig;
  metadata: WorkflowMetadata;
}

export interface WorkflowTrigger {
  type: 'schedule' | 'event' | 'threshold' | 'manual';
  config: {
    schedule?: string; // cron expression
    event?: string; // event name
    threshold?: ThresholdConfig;
  };
}

export interface ThresholdConfig {
  metric: string;
  operator: '>' | '<' | '=' | '>=' | '<=';
  value: number;
  window?: string; // time window
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'agent' | 'integration' | 'hitl' | 'condition' | 'parallel' | 'sequential';
  config: StepConfig;
  dependencies?: string[];
  timeout?: number;
  retries?: number;
  onError?: 'stop' | 'continue' | 'retry' | 'escalate';
}

export interface StepConfig {
  agent?: AgentConfig;
  integration?: IntegrationConfig;
  hitl?: HITLConfig;
  condition?: ConditionConfig;
  parallel?: WorkflowStep[];
  sequential?: WorkflowStep[];
}

export interface AgentConfig {
  type: 'analysis' | 'strategy' | 'content' | 'coordination' | 'specialist';
  specialization?: string;
  instructions: string;
  context: Record<string, any>;
  output?: OutputConfig;
}

export interface IntegrationConfig {
  platform: 'asana' | 'google' | 'notion' | 'external';
  action: string;
  params: Record<string, any>;
  mapping?: Record<string, string>;
}

export interface HITLConfig {
  type: 'review' | 'approval' | 'decision' | 'input';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  context: Record<string, any>;
  options?: string[];
  timeout?: number;
}

export interface ConditionConfig {
  expression: string;
  truePath: string;
  falsePath: string;
}

export interface OutputConfig {
  format: 'json' | 'text' | 'document' | 'visualization';
  destination?: string;
  template?: string;
}

export interface WorkflowConfig {
  parallel: boolean;
  maxConcurrency: number;
  timeout: number;
  retryPolicy: RetryPolicy;
  errorHandling: ErrorHandling;
  notifications: NotificationConfig;
}

export interface RetryPolicy {
  maxRetries: number;
  backoffStrategy: 'fixed' | 'exponential' | 'linear';
  baseDelay: number;
  maxDelay: number;
}

export interface ErrorHandling {
  strategy: 'stop' | 'continue' | 'compensate';
  escalation: EscalationConfig;
}

export interface EscalationConfig {
  enabled: boolean;
  threshold: number;
  contacts: string[];
  channels: ('email' | 'slack' | 'teams')[];
}

export interface NotificationConfig {
  onStart: boolean;
  onComplete: boolean;
  onError: boolean;
  onHITL: boolean;
  channels: ('email' | 'slack' | 'teams' | 'asana')[];
}

export interface WorkflowMetadata {
  version: string;
  author: string;
  created: Date;
  modified: Date;
  tags: string[];
  category: string;
  estimatedDuration: number;
  complexity: 'low' | 'medium' | 'high';
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  currentStep?: string;
  context: Record<string, any>;
  results: Record<string, any>;
  errors: WorkflowError[];
  metrics: ExecutionMetrics;
}

export interface WorkflowError {
  stepId: string;
  timestamp: Date;
  error: string;
  stack?: string;
  context: Record<string, any>;
}

export interface ExecutionMetrics {
  duration: number;
  stepsCompleted: number;
  stepsTotal: number;
  hitlInteractions: number;
  tokensUsed: number;
  costEstimate: number;
}

export class WorkflowOrchestrator extends EventEmitter {
  private engine: WorkflowEngine;
  private scheduler: WorkflowScheduler;
  private agentCoordinator: AgentCoordinator;
  private hitlManager: HITLManager;
  private integrationManager: IntegrationManager;
  private performanceMonitor: PerformanceMonitor;
  
  private workflows: Map<string, WorkflowDefinition>;
  private executions: Map<string, WorkflowExecution>;
  
  constructor() {
    super();
    
    this.engine = new WorkflowExecutionEngine();
    this.scheduler = new WorkflowSchedulerEngine();
    this.agentCoordinator = new AgentCoordinationEngine();
    this.hitlManager = new HumanInTheLoopManager();
    this.integrationManager = new WorkflowIntegrationManager();
    this.performanceMonitor = new WorkflowPerformanceMonitor();
    
    this.workflows = new Map();
    this.executions = new Map();
    
    this.initializeEventHandlers();
  }

  /**
   * Initialize the orchestrator with required dependencies
   */
  async initialize(): Promise<void> {
    try {
      await this.integrationManager.initialize();
      await this.agentCoordinator.initialize();
      await this.hitlManager.initialize();
      await this.scheduler.initialize();
      
      this.performanceMonitor.start();
      
      this.emit('orchestrator:initialized');
    } catch (error) {
      this.emit('orchestrator:error', { error, phase: 'initialization' });
      throw error;
    }
  }

  /**
   * Register a new workflow definition
   */
  async registerWorkflow(workflow: WorkflowDefinition): Promise<void> {
    // Validate workflow definition
    this.validateWorkflow(workflow);
    
    // Store workflow
    this.workflows.set(workflow.id, workflow);
    
    // Register with scheduler if applicable
    if (workflow.trigger.type === 'schedule') {
      await this.scheduler.registerScheduledWorkflow(workflow.id, workflow.trigger.config.schedule || '');
    }
    
    this.emit('workflow:registered', { workflowId: workflow.id });
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(
    workflowId: string, 
    context: Record<string, any> = {},
    options: { priority?: 'low' | 'medium' | 'high'; immediate?: boolean } = {}
  ): Promise<string> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const executionId = this.generateExecutionId();
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      status: 'pending',
      startTime: new Date(),
      context,
      results: {},
      errors: [],
      metrics: {
        duration: 0,
        stepsCompleted: 0,
        stepsTotal: workflow.steps.length,
        hitlInteractions: 0,
        tokensUsed: 0,
        costEstimate: 0
      }
    };

    this.executions.set(executionId, execution);
    
    // Execute workflow
    if (options.immediate) {
      await this.engine.executeWorkflow(execution.id, { workflow, context });
    } else {
      // Queue for execution
      await this.engine.queueWorkflow(execution);
    }

    this.emit('workflow:started', { executionId, workflowId });
    return executionId;
  }

  /**
   * Pause a running workflow execution
   */
  async pauseExecution(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    if (execution.status !== 'running') {
      throw new Error(`Cannot pause execution in status: ${execution.status}`);
    }

    await this.engine.pauseExecution(executionId);
    execution.status = 'paused';
    
    this.emit('workflow:paused', { executionId });
  }

  /**
   * Resume a paused workflow execution
   */
  async resumeExecution(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    if (execution.status !== 'paused') {
      throw new Error(`Cannot resume execution in status: ${execution.status}`);
    }

    await this.engine.resumeExecution(executionId);
    execution.status = 'running';
    
    this.emit('workflow:resumed', { executionId });
  }

  /**
   * Cancel a workflow execution
   */
  async cancelExecution(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    await this.engine.cancelExecution(executionId);
    execution.status = 'cancelled';
    execution.endTime = new Date();
    
    this.emit('workflow:cancelled', { executionId });
  }

  /**
   * Get execution status and details
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get all executions for a workflow
   */
  getWorkflowExecutions(workflowId: string): WorkflowExecution[] {
    return Array.from(this.executions.values())
      .filter(execution => execution.workflowId === workflowId);
  }

  /**
   * Get active executions
   */
  getActiveExecutions(): WorkflowExecution[] {
    return Array.from(this.executions.values())
      .filter(execution => ['pending', 'running', 'paused'].includes(execution.status));
  }

  /**
   * Get workflow performance metrics
   */
  getWorkflowMetrics(workflowId: string): any {
    return this.performanceMonitor.getWorkflowMetrics(workflowId);
  }

  /**
   * Handle HITL responses
   */
  async handleHITLResponse(
    executionId: string, 
    _stepId: string, 
    response: any
  ): Promise<void> {
    this.hitlManager.handleResponse(executionId, response);
  }

  /**
   * Validate workflow definition
   */
  private validateWorkflow(workflow: WorkflowDefinition): void {
    if (!workflow.id || !workflow.name || !workflow.steps.length) {
      throw new Error('Invalid workflow definition: missing required fields');
    }

    // Validate steps
    for (const step of workflow.steps) {
      if (!step.id || !step.name || !step.type) {
        throw new Error(`Invalid step definition: ${step.id}`);
      }
    }

    // Validate dependencies
    const stepIds = new Set(workflow.steps.map(s => s.id));
    for (const step of workflow.steps) {
      if (step.dependencies) {
        for (const dep of step.dependencies) {
          if (!stepIds.has(dep)) {
            throw new Error(`Invalid dependency: ${dep} not found in workflow`);
          }
        }
      }
    }
  }

  /**
   * Initialize event handlers
   */
  private initializeEventHandlers(): void {
    this.engine.on('execution:completed', (data) => {
      const execution = this.executions.get(data.executionId);
      if (execution) {
        execution.status = 'completed';
        execution.endTime = new Date();
        execution.metrics.duration = execution.endTime.getTime() - execution.startTime.getTime();
      }
      this.emit('workflow:completed', data);
    });

    this.engine.on('execution:failed', (data) => {
      const execution = this.executions.get(data.executionId);
      if (execution) {
        execution.status = 'failed';
        execution.endTime = new Date();
        execution.errors.push({
          stepId: data.stepId || 'unknown',
          timestamp: new Date(),
          error: data.error,
          stack: data.stack,
          context: data.context || {}
        });
      }
      this.emit('workflow:failed', data);
    });

    this.hitlManager.on('hitl:required', (data) => {
      this.emit('workflow:hitl', data);
    });

    this.performanceMonitor.on('performance:alert', (data) => {
      this.emit('orchestrator:alert', data);
    });
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    await this.scheduler.shutdown();
    // Note: WorkflowEngine interface doesn't define shutdown method
    // await this.engine.shutdown();
    this.performanceMonitor.stop();
    
    this.emit('orchestrator:shutdown');
  }
}