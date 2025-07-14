// Workflow Engine Module - Enhanced with proper state management and execution
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import * as cron from 'node-cron';

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'action' | 'condition' | 'parallel' | 'sequential' | 'loop' | 'wait' | 'subworkflow';
  config: any;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: any;
  error?: Error;
  startTime?: Date;
  endTime?: Date;
  retryCount?: number;
  maxRetries?: number;
  timeout?: number;
  dependencies?: string[];
  onError?: 'stop' | 'continue' | 'retry' | 'compensate';
  compensationStep?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  version?: string;
  steps: WorkflowStep[];
  status: 'idle' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';
  variables?: Record<string, any>;
  config?: WorkflowConfig;
  metadata?: WorkflowMetadata;
  startTime?: Date;
  endTime?: Date;
  currentStep?: string;
  executionHistory?: ExecutionRecord[];
}

export interface WorkflowConfig {
  maxExecutionTime?: number;
  maxRetries?: number;
  retryDelay?: number;
  parallel?: boolean;
  maxConcurrency?: number;
  errorHandling?: 'stop' | 'continue' | 'compensate';
  notifications?: NotificationConfig;
}

export interface WorkflowMetadata {
  author?: string;
  created?: Date;
  modified?: Date;
  tags?: string[];
  category?: string;
}

export interface ExecutionRecord {
  stepId: string;
  status: string;
  timestamp: Date;
  duration?: number;
  result?: any;
  error?: Error;
}

export interface NotificationConfig {
  onStart?: boolean;
  onComplete?: boolean;
  onError?: boolean;
  channels?: string[];
}

export interface WorkflowEngine {
  createWorkflow(config: any): Workflow;
  executeWorkflow(workflowId: string, context?: any): Promise<any>;
  pauseWorkflow(workflowId: string): Promise<void>;
  resumeWorkflow(workflowId: string): Promise<void>;
  queueWorkflow(execution: any): Promise<void>;
  pauseExecution(workflowId: string): Promise<void>;
  resumeExecution(workflowId: string): Promise<void>;
  cancelExecution(workflowId: string): Promise<void>;
  getWorkflow(workflowId: string): Workflow | undefined;
  getWorkflowStatus(workflowId: string): WorkflowStatus | undefined;
  getExecutionHistory(workflowId: string): ExecutionRecord[];
  validateWorkflow(workflow: Workflow): ValidationResult;
  on(event: string, listener: (...args: any[]) => void): this;
}

export interface WorkflowStatus {
  workflowId: string;
  status: string;
  currentStep?: string;
  progress: number;
  startTime?: Date;
  estimatedCompletion?: Date;
  errors: Error[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class WorkflowExecutionEngine extends EventEmitter implements WorkflowEngine {
  private workflows: Map<string, Workflow> = new Map();
  private executionContexts: Map<string, any> = new Map();
  private executionQueue: Map<string, WorkflowExecution> = new Map();
  private stepExecutors: Map<string, StepExecutor> = new Map();
  private activeExecutions: Set<string> = new Set();
  private pausedExecutions: Set<string> = new Set();

  constructor() {
    super();
    this.registerDefaultExecutors();
  }

  private registerDefaultExecutors(): void {
    // Register built-in step executors
    this.registerStepExecutor('action', new ActionStepExecutor());
    this.registerStepExecutor('condition', new ConditionStepExecutor());
    this.registerStepExecutor('parallel', new ParallelStepExecutor());
    this.registerStepExecutor('sequential', new SequentialStepExecutor());
    this.registerStepExecutor('loop', new LoopStepExecutor());
    this.registerStepExecutor('wait', new WaitStepExecutor());
    this.registerStepExecutor('subworkflow', new SubworkflowStepExecutor(this));
  }

  public registerStepExecutor(type: string, executor: StepExecutor): void {
    this.stepExecutors.set(type, executor);
  }

  createWorkflow(config: any): Workflow {
    const workflow: Workflow = {
      id: config.id || uuidv4(),
      name: config.name || 'Unnamed Workflow',
      description: config.description,
      version: config.version || '1.0.0',
      steps: config.steps || [],
      status: 'idle',
      variables: config.variables || {},
      config: config.config || {},
      metadata: {
        created: new Date(),
        modified: new Date(),
        ...config.metadata
      },
      executionHistory: []
    };
    
    // Validate workflow before storing
    const validation = this.validateWorkflow(workflow);
    if (!validation.valid) {
      throw new Error(`Invalid workflow: ${validation.errors.join(', ')}`);
    }
    
    this.workflows.set(workflow.id, workflow);
    this.emit('workflow:created', { workflow });
    return workflow;
  }

  async executeWorkflow(workflowId: string, context?: any): Promise<any> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    if (this.activeExecutions.has(workflowId)) {
      throw new Error(`Workflow ${workflowId} is already running`);
    }

    // Initialize execution context
    const executionContext = {
      ...workflow.variables,
      ...context,
      $workflow: {
        id: workflow.id,
        name: workflow.name,
        startTime: new Date()
      },
      $state: {}
    };

    workflow.status = 'running';
    workflow.startTime = new Date();
    this.activeExecutions.add(workflowId);
    this.executionContexts.set(workflowId, executionContext);
    
    if (workflow.config?.notifications?.onStart) {
      this.emit('notification:send', {
        type: 'workflow:start',
        workflow: workflow.name,
        channels: workflow.config.notifications.channels
      });
    }
    
    this.emit('workflow:start', { workflowId, workflow, context: executionContext });

    try {
      const result = await this.executeSteps(workflow, executionContext);
      
      workflow.status = 'completed';
      workflow.endTime = new Date();
      this.activeExecutions.delete(workflowId);
      
      if (workflow.config?.notifications?.onComplete) {
        this.emit('notification:send', {
          type: 'workflow:complete',
          workflow: workflow.name,
          duration: workflow.endTime.getTime() - workflow.startTime!.getTime(),
          channels: workflow.config.notifications.channels
        });
      }
      
      this.emit('workflow:complete', { workflowId, result, duration: workflow.endTime.getTime() - workflow.startTime!.getTime() });
      return result;
      
    } catch (error) {
      workflow.status = 'failed';
      workflow.endTime = new Date();
      this.activeExecutions.delete(workflowId);
      
      if (workflow.config?.notifications?.onError) {
        this.emit('notification:send', {
          type: 'workflow:error',
          workflow: workflow.name,
          error: error instanceof Error ? error.message : String(error),
          channels: workflow.config.notifications.channels
        });
      }
      
      this.emit('workflow:error', { workflowId, error });
      
      // Handle error based on configuration
      if (workflow.config?.errorHandling === 'compensate') {
        await this.runCompensation(workflow, executionContext);
      }
      
      throw error;
    } finally {
      this.executionContexts.delete(workflowId);
    }
  }

  async pauseWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }
    
    if (workflow.status !== 'running') {
      throw new Error(`Cannot pause workflow in status: ${workflow.status}`);
    }
    
    workflow.status = 'paused';
    this.activeExecutions.delete(workflowId);
    this.pausedExecutions.add(workflowId);
    
    this.emit('workflow:pause', { workflowId, currentStep: workflow.currentStep });
  }

  async resumeWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }
    
    if (workflow.status !== 'paused') {
      throw new Error(`Cannot resume workflow in status: ${workflow.status}`);
    }
    
    workflow.status = 'running';
    this.pausedExecutions.delete(workflowId);
    this.activeExecutions.add(workflowId);
    
    const context = this.executionContexts.get(workflowId);
    this.emit('workflow:resume', { workflowId, currentStep: workflow.currentStep });
    
    // Continue execution from current step
    if (workflow.currentStep) {
      const currentStepIndex = workflow.steps.findIndex(s => s.id === workflow.currentStep);
      if (currentStepIndex >= 0) {
        const remainingSteps = workflow.steps.slice(currentStepIndex);
        await this.executeStepsFrom(workflow, context, remainingSteps);
      }
    }
  }

  async queueWorkflow(execution: any): Promise<void> {
    const workflowExecution: WorkflowExecution = {
      workflowId: typeof execution === 'string' ? execution : execution.workflowId,
      context: typeof execution === 'object' ? execution.context : undefined,
      priority: execution.priority || 0,
      scheduledTime: execution.scheduledTime
    };
    
    this.executionQueue.set(workflowExecution.workflowId, workflowExecution);
    
    // Sort queue by priority and scheduled time
    const sortedQueue = Array.from(this.executionQueue.values())
      .sort((a, b) => {
        if (a.scheduledTime && b.scheduledTime) {
          return a.scheduledTime.getTime() - b.scheduledTime.getTime();
        }
        return b.priority - a.priority;
      });
    
    // Process queue
    for (const exec of sortedQueue) {
      if (!this.activeExecutions.has(exec.workflowId)) {
        const delay = exec.scheduledTime ? 
          Math.max(0, exec.scheduledTime.getTime() - Date.now()) : 0;
        
        setTimeout(async () => {
          try {
            this.executionQueue.delete(exec.workflowId);
            await this.executeWorkflow(exec.workflowId, exec.context);
          } catch (error) {
            this.emit('workflow:queue-error', { workflowId: exec.workflowId, error });
          }
        }, delay);
      }
    }
  }

  async pauseExecution(workflowId: string): Promise<void> {
    return this.pauseWorkflow(workflowId);
  }

  async resumeExecution(workflowId: string): Promise<void> {
    return this.resumeWorkflow(workflowId);
  }

  async cancelExecution(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }
    
    const previousStatus = workflow.status;
    workflow.status = 'cancelled';
    workflow.endTime = new Date();
    
    this.activeExecutions.delete(workflowId);
    this.pausedExecutions.delete(workflowId);
    this.executionQueue.delete(workflowId);
    this.executionContexts.delete(workflowId);
    
    this.emit('workflow:cancelled', { 
      workflowId, 
      previousStatus,
      currentStep: workflow.currentStep 
    });
  }

  private async executeSteps(workflow: Workflow, context: any): Promise<any> {
    return this.executeStepsFrom(workflow, context, workflow.steps);
  }

  private async executeStepsFrom(workflow: Workflow, context: any, steps: WorkflowStep[]): Promise<any> {
    let stepContext = { ...context };
    
    for (const step of steps) {
      if (workflow.status === 'paused' || workflow.status === 'cancelled') {
        break;
      }
      
      // Check dependencies
      if (step.dependencies && step.dependencies.length > 0) {
        const dependenciesMet = step.dependencies.every(depId => {
          const depStep = workflow.steps.find(s => s.id === depId);
          return depStep && depStep.status === 'completed';
        });
        
        if (!dependenciesMet) {
          step.status = 'skipped';
          this.emit('step:skipped', { workflowId: workflow.id, step, reason: 'dependencies not met' });
          continue;
        }
      }
      
      workflow.currentStep = step.id;
      step.status = 'running';
      step.startTime = new Date();
      step.retryCount = step.retryCount || 0;
      
      this.emit('step:start', { workflowId: workflow.id, step });
      
      try {
        // Set timeout if configured
        const executeWithTimeout = step.timeout ? 
          this.withTimeout(this.executeStep(step, stepContext, workflow), step.timeout) :
          this.executeStep(step, stepContext, workflow);
        
        const result = await executeWithTimeout;
        
        step.status = 'completed';
        step.result = result;
        step.endTime = new Date();
        
        // Update context with step result
        stepContext = { 
          ...stepContext, 
          [step.id]: result,
          $lastStep: {
            id: step.id,
            result,
            duration: step.endTime.getTime() - step.startTime.getTime()
          }
        };
        
        // Record execution history
        workflow.executionHistory?.push({
          stepId: step.id,
          status: 'completed',
          timestamp: new Date(),
          duration: step.endTime.getTime() - step.startTime.getTime(),
          result
        });
        
        this.emit('step:complete', { workflowId: workflow.id, step, result });
        
      } catch (error) {
        step.error = error instanceof Error ? error : new Error(String(error));
        step.endTime = new Date();
        
        // Handle retry logic
        if (step.onError === 'retry' && step.retryCount < (step.maxRetries || 3)) {
          step.retryCount++;
          this.emit('step:retry', { workflowId: workflow.id, step, attempt: step.retryCount });
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, workflow.config?.retryDelay || 1000));
          
          // Retry the step
          steps.unshift(step); // Add step back to beginning of remaining steps
          continue;
        }
        
        step.status = 'failed';
        
        // Record execution history
        workflow.executionHistory?.push({
          stepId: step.id,
          status: 'failed',
          timestamp: new Date(),
          duration: step.endTime.getTime() - step.startTime.getTime(),
          error: step.error
        });
        
        this.emit('step:error', { workflowId: workflow.id, step, error });
        
        // Handle error based on configuration
        if (step.onError === 'continue') {
          stepContext[step.id] = { error: step.error.message };
          continue;
        } else if (step.onError === 'compensate' && step.compensationStep) {
          const compensationStep = workflow.steps.find(s => s.id === step.compensationStep);
          if (compensationStep) {
            await this.executeStep(compensationStep, stepContext, workflow);
          }
        }
        
        // Default: stop on error
        throw error;
      }
    }
    
    return stepContext;
  }

  private async executeStep(step: WorkflowStep, context: any, workflow: Workflow): Promise<any> {
    const executor = this.stepExecutors.get(step.type);
    if (!executor) {
      throw new Error(`No executor found for step type: ${step.type}`);
    }
    
    try {
      return await executor.execute(step, context, workflow);
    } catch (error) {
      // Log detailed error information
      this.emit('step:execution-error', {
        workflowId: workflow.id,
        stepId: step.id,
        stepType: step.type,
        error,
        context
      });
      throw error;
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Step execution timeout')), timeout)
      )
    ]);
  }

  private async runCompensation(workflow: Workflow, context: any): Promise<void> {
    this.emit('workflow:compensation-start', { workflowId: workflow.id });
    
    // Run compensation steps in reverse order
    const completedSteps = workflow.steps
      .filter(s => s.status === 'completed' && s.compensationStep)
      .reverse();
    
    for (const step of completedSteps) {
      const compensationStep = workflow.steps.find(s => s.id === step.compensationStep);
      if (compensationStep) {
        try {
          await this.executeStep(compensationStep, context, workflow);
          this.emit('workflow:compensation-step', { 
            workflowId: workflow.id, 
            originalStep: step.id,
            compensationStep: compensationStep.id 
          });
        } catch (error) {
          this.emit('workflow:compensation-error', { 
            workflowId: workflow.id, 
            step: compensationStep.id, 
            error 
          });
        }
      }
    }
    
    this.emit('workflow:compensation-complete', { workflowId: workflow.id });
  }

  public getWorkflow(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId);
  }

  public getWorkflowStatus(workflowId: string): WorkflowStatus | undefined {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return undefined;
    
    const completedSteps = workflow.steps.filter(s => s.status === 'completed').length;
    const totalSteps = workflow.steps.length;
    
    return {
      workflowId,
      status: workflow.status,
      currentStep: workflow.currentStep,
      progress: totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0,
      startTime: workflow.startTime,
      estimatedCompletion: this.estimateCompletion(workflow),
      errors: workflow.steps
        .filter(s => s.error)
        .map(s => s.error!)
    };
  }

  private estimateCompletion(workflow: Workflow): Date | undefined {
    if (!workflow.startTime || workflow.status !== 'running') return undefined;
    
    const completedSteps = workflow.steps.filter(s => s.status === 'completed');
    const avgDuration = completedSteps.reduce((sum, step) => {
      if (step.startTime && step.endTime) {
        return sum + (step.endTime.getTime() - step.startTime.getTime());
      }
      return sum;
    }, 0) / completedSteps.length;
    
    const remainingSteps = workflow.steps.filter(s => 
      s.status === 'pending' || s.status === 'running'
    ).length;
    
    const estimatedRemainingTime = avgDuration * remainingSteps;
    return new Date(Date.now() + estimatedRemainingTime);
  }

  public getExecutionHistory(workflowId: string): ExecutionRecord[] {
    const workflow = this.workflows.get(workflowId);
    return workflow?.executionHistory || [];
  }

  public validateWorkflow(workflow: Workflow): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Validate basic structure
    if (!workflow.id) errors.push('Workflow must have an ID');
    if (!workflow.name) errors.push('Workflow must have a name');
    if (!workflow.steps || workflow.steps.length === 0) {
      errors.push('Workflow must have at least one step');
    }
    
    // Validate steps
    const stepIds = new Set<string>();
    for (const step of workflow.steps) {
      if (!step.id) {
        errors.push('All steps must have an ID');
      } else if (stepIds.has(step.id)) {
        errors.push(`Duplicate step ID: ${step.id}`);
      } else {
        stepIds.add(step.id);
      }
      
      if (!step.name) warnings.push(`Step ${step.id} should have a name`);
      if (!step.type) errors.push(`Step ${step.id} must have a type`);
      
      // Validate step executor exists
      if (step.type && !this.stepExecutors.has(step.type)) {
        errors.push(`Unknown step type: ${step.type}`);
      }
      
      // Validate dependencies
      if (step.dependencies) {
        for (const depId of step.dependencies) {
          if (!stepIds.has(depId)) {
            errors.push(`Step ${step.id} depends on unknown step: ${depId}`);
          }
        }
      }
      
      // Validate compensation steps
      if (step.compensationStep && !stepIds.has(step.compensationStep)) {
        errors.push(`Step ${step.id} has unknown compensation step: ${step.compensationStep}`);
      }
      
      // Validate step-specific configuration
      const executor = this.stepExecutors.get(step.type);
      if (executor) {
        const stepErrors = executor.validate(step);
        errors.push(...stepErrors);
      }
    }
    
    // Check for circular dependencies
    if (this.hasCircularDependencies(workflow)) {
      errors.push('Workflow contains circular dependencies');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private hasCircularDependencies(workflow: Workflow): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const hasCycle = (stepId: string): boolean => {
      visited.add(stepId);
      recursionStack.add(stepId);
      
      const step = workflow.steps.find(s => s.id === stepId);
      if (step?.dependencies) {
        for (const depId of step.dependencies) {
          if (!visited.has(depId)) {
            if (hasCycle(depId)) return true;
          } else if (recursionStack.has(depId)) {
            return true;
          }
        }
      }
      
      recursionStack.delete(stepId);
      return false;
    };
    
    for (const step of workflow.steps) {
      if (!visited.has(step.id)) {
        if (hasCycle(step.id)) return true;
      }
    }
    
    return false;
  }
}

// Step Executor Implementations

class ActionStepExecutor implements StepExecutor {
  async execute(step: WorkflowStep, context: any, workflow: Workflow): Promise<any> {
    const { action, params } = step.config;
    
    // Execute custom action
    if (typeof action === 'function') {
      return await action(params, context, workflow);
    }
    
    // Built-in actions
    switch (action) {
      case 'log':
        console.log(`[${workflow.name}] ${params.message}`, params.data || '');
        return { logged: true };
      
      case 'setVariable':
        return params.value;
      
      case 'httpRequest':
        // Implement HTTP request logic
        return { status: 200, body: {} };
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }
  
  validate(step: WorkflowStep): string[] {
    const errors: string[] = [];
    if (!step.config?.action) {
      errors.push(`Action step ${step.id} must have an action`);
    }
    return errors;
  }
}

class ConditionStepExecutor implements StepExecutor {
  async execute(step: WorkflowStep, context: any): Promise<any> {
    const { expression, truePath, falsePath } = step.config;
    
    // Evaluate condition
    const result = this.evaluateExpression(expression, context);
    
    return {
      result,
      nextStep: result ? truePath : falsePath
    };
  }
  
  private evaluateExpression(expression: string, context: any): boolean {
    // Simple expression evaluation
    // In production, use a proper expression evaluator
    try {
      // Create a function that evaluates the expression in the context
      const func = new Function('context', `with(context) { return ${expression}; }`);
      return !!func(context);
    } catch (error) {
      console.error('Expression evaluation error:', error);
      return false;
    }
  }
  
  validate(step: WorkflowStep): string[] {
    const errors: string[] = [];
    if (!step.config?.expression) {
      errors.push(`Condition step ${step.id} must have an expression`);
    }
    return errors;
  }
}

class ParallelStepExecutor implements StepExecutor {
  async execute(step: WorkflowStep, context: any, workflow: Workflow): Promise<any> {
    const { steps, maxConcurrency = Infinity } = step.config;
    
    if (!steps || steps.length === 0) {
      return {};
    }
    
    const results: Record<string, any> = {};
    const chunks = this.chunkArray(steps, maxConcurrency);
    
    for (const chunk of chunks) {
      const promises = chunk.map(async (subStep: WorkflowStep) => {
        const engine = new WorkflowExecutionEngine();
        const result = await engine.executeStep(subStep, context, workflow);
        results[subStep.id] = result;
      });
      
      await Promise.all(promises);
    }
    
    return results;
  }
  
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
  
  validate(step: WorkflowStep): string[] {
    const errors: string[] = [];
    if (!step.config?.steps || !Array.isArray(step.config.steps)) {
      errors.push(`Parallel step ${step.id} must have a steps array`);
    }
    return errors;
  }
}

class SequentialStepExecutor implements StepExecutor {
  async execute(step: WorkflowStep, context: any, workflow: Workflow): Promise<any> {
    const { steps } = step.config;
    
    if (!steps || steps.length === 0) {
      return {};
    }
    
    let currentContext = { ...context };
    const results: Record<string, any> = {};
    
    for (const subStep of steps) {
      const engine = new WorkflowExecutionEngine();
      const result = await engine.executeStep(subStep, currentContext, workflow);
      results[subStep.id] = result;
      currentContext[subStep.id] = result;
    }
    
    return results;
  }
  
  validate(step: WorkflowStep): string[] {
    const errors: string[] = [];
    if (!step.config?.steps || !Array.isArray(step.config.steps)) {
      errors.push(`Sequential step ${step.id} must have a steps array`);
    }
    return errors;
  }
}

class LoopStepExecutor implements StepExecutor {
  async execute(step: WorkflowStep, context: any, workflow: Workflow): Promise<any> {
    const { items, itemVariable = 'item', indexVariable = 'index', body } = step.config;
    
    if (!items || !Array.isArray(items)) {
      return [];
    }
    
    const results: any[] = [];
    
    for (let i = 0; i < items.length; i++) {
      const loopContext = {
        ...context,
        [itemVariable]: items[i],
        [indexVariable]: i
      };
      
      const engine = new WorkflowExecutionEngine();
      const result = await engine.executeStep(body, loopContext, workflow);
      results.push(result);
    }
    
    return results;
  }
  
  validate(step: WorkflowStep): string[] {
    const errors: string[] = [];
    if (!step.config?.items) {
      errors.push(`Loop step ${step.id} must have items`);
    }
    if (!step.config?.body) {
      errors.push(`Loop step ${step.id} must have a body`);
    }
    return errors;
  }
}

class WaitStepExecutor implements StepExecutor {
  async execute(step: WorkflowStep, context: any): Promise<any> {
    const { duration, until } = step.config;
    
    if (duration) {
      await new Promise(resolve => setTimeout(resolve, duration));
    } else if (until) {
      const targetTime = new Date(until).getTime();
      const delay = Math.max(0, targetTime - Date.now());
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    return { waited: true };
  }
  
  validate(step: WorkflowStep): string[] {
    const errors: string[] = [];
    if (!step.config?.duration && !step.config?.until) {
      errors.push(`Wait step ${step.id} must have either duration or until`);
    }
    return errors;
  }
}

class SubworkflowStepExecutor implements StepExecutor {
  constructor(private engine: WorkflowEngine) {}
  
  async execute(step: WorkflowStep, context: any): Promise<any> {
    const { workflowId, inputMapping, outputMapping } = step.config;
    
    // Map inputs
    let subContext = { ...context };
    if (inputMapping) {
      subContext = this.mapData(context, inputMapping);
    }
    
    // Execute subworkflow
    const result = await this.engine.executeWorkflow(workflowId, subContext);
    
    // Map outputs
    if (outputMapping) {
      return this.mapData(result, outputMapping);
    }
    
    return result;
  }
  
  private mapData(source: any, mapping: Record<string, string>): any {
    const result: any = {};
    for (const [targetKey, sourceKey] of Object.entries(mapping)) {
      result[targetKey] = this.getNestedValue(source, sourceKey);
    }
    return result;
  }
  
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
  
  validate(step: WorkflowStep): string[] {
    const errors: string[] = [];
    if (!step.config?.workflowId) {
      errors.push(`Subworkflow step ${step.id} must have a workflowId`);
    }
    return errors;
  }
}
}