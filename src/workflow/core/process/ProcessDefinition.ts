// Process Definition and Execution Management
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { WorkflowEngine, Workflow, WorkflowStep } from '../engine/workflow-engine';

export interface ProcessDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  category: 'sales' | 'marketing' | 'customer-success' | 'operations' | 'finance' | 'custom';
  owner: string;
  status: 'draft' | 'active' | 'deprecated' | 'archived';
  triggers: ProcessTrigger[];
  steps: ProcessStep[];
  variables: ProcessVariable[];
  kpis: ProcessKPI[];
  rules: BusinessRule[];
  integrations: ProcessIntegration[];
  metadata: ProcessMetadata;
}

export interface ProcessTrigger {
  id: string;
  name: string;
  type: 'event' | 'schedule' | 'condition' | 'manual' | 'api';
  config: TriggerConfig;
  enabled: boolean;
}

export interface TriggerConfig {
  event?: {
    source: string;
    type: string;
    filters?: Record<string, any>;
  };
  schedule?: {
    cron?: string;
    interval?: number;
    timezone?: string;
  };
  condition?: {
    expression: string;
    checkInterval: number;
  };
  api?: {
    endpoint: string;
    method: string;
    authentication?: string;
  };
}

export interface ProcessStep {
  id: string;
  name: string;
  description?: string;
  type: 'task' | 'decision' | 'automation' | 'integration' | 'notification' | 'approval';
  assignee?: ProcessAssignee;
  config: StepConfig;
  inputs: StepInput[];
  outputs: StepOutput[];
  sla?: StepSLA;
  rules?: BusinessRule[];
  onError?: 'stop' | 'continue' | 'retry' | 'escalate';
}

export interface ProcessAssignee {
  type: 'user' | 'role' | 'group' | 'agent' | 'dynamic';
  value: string;
  fallback?: ProcessAssignee;
}

export interface StepConfig {
  task?: TaskConfig;
  decision?: DecisionConfig;
  automation?: AutomationConfig;
  integration?: IntegrationConfig;
  notification?: NotificationConfig;
  approval?: ApprovalConfig;
}

export interface TaskConfig {
  instructions: string;
  requiredFields: string[];
  form?: FormDefinition;
  attachments?: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface DecisionConfig {
  options: DecisionOption[];
  criteria?: string;
  autoDecide?: {
    enabled: boolean;
    rules: BusinessRule[];
  };
}

export interface DecisionOption {
  id: string;
  label: string;
  nextStep?: string;
  conditions?: string;
}

export interface AutomationConfig {
  script?: string;
  function?: string;
  parameters?: Record<string, any>;
  timeout?: number;
}

export interface IntegrationConfig {
  system: string;
  action: string;
  mapping: FieldMapping[];
  authentication?: string;
  errorHandling?: 'retry' | 'skip' | 'fail';
}

export interface NotificationConfig {
  recipients: NotificationRecipient[];
  template: string;
  channels: ('email' | 'slack' | 'teams' | 'sms' | 'push')[];
  priority: 'low' | 'medium' | 'high';
}

export interface ApprovalConfig {
  approvers: ProcessAssignee[];
  threshold?: number; // Number of approvals needed
  timeout?: number;
  escalation?: ProcessAssignee;
  reminders?: ReminderConfig;
}

export interface ReminderConfig {
  intervals: number[]; // Minutes
  message: string;
}

export interface StepInput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  source: 'variable' | 'previous-step' | 'constant' | 'expression';
  value: any;
  required: boolean;
  validation?: ValidationRule;
}

export interface StepOutput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  destination: 'variable' | 'next-step' | 'storage';
  key: string;
  transform?: string;
}

export interface StepSLA {
  duration: number; // Minutes
  warningThreshold: number; // Percentage
  escalation?: ProcessAssignee;
  businessHours?: boolean;
}

export interface ProcessVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  defaultValue?: any;
  scope: 'process' | 'step' | 'global';
  sensitive?: boolean;
  validation?: ValidationRule;
}

export interface ValidationRule {
  type: 'required' | 'regex' | 'range' | 'length' | 'custom';
  value: any;
  message: string;
}

export interface BusinessRule {
  id: string;
  name: string;
  condition: string;
  actions: RuleAction[];
  priority: number;
  enabled: boolean;
}

export interface RuleAction {
  type: 'assign' | 'notify' | 'escalate' | 'terminate' | 'jump';
  target?: string;
  value?: any;
}

export interface ProcessKPI {
  id: string;
  name: string;
  description: string;
  formula: string;
  unit: string;
  target: number;
  thresholds: KPIThreshold[];
  frequency: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'monthly';
}

export interface KPIThreshold {
  level: 'critical' | 'warning' | 'good' | 'excellent';
  min: number;
  max: number;
  color: string;
}

export interface ProcessIntegration {
  id: string;
  system: string;
  type: 'source' | 'destination' | 'bidirectional';
  config: IntegrationConfig;
  mapping: FieldMapping[];
  active: boolean;
}

export interface FieldMapping {
  source: string;
  destination: string;
  transform?: string;
  defaultValue?: any;
}

export interface ProcessMetadata {
  created: Date;
  modified: Date;
  author: string;
  tags: string[];
  compliance?: ComplianceInfo;
  documentation?: string;
  changeLog?: ChangeLogEntry[];
}

export interface ComplianceInfo {
  standards: string[];
  certifications: string[];
  lastAudit?: Date;
  nextAudit?: Date;
}

export interface ChangeLogEntry {
  version: string;
  date: Date;
  author: string;
  changes: string;
  approved?: boolean;
}

export interface FormDefinition {
  fields: FormField[];
  layout?: FormLayout;
  validation?: FormValidation;
}

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'checkbox' | 'radio' | 'textarea' | 'file';
  options?: { value: string; label: string }[];
  validation?: ValidationRule[];
  conditional?: {
    field: string;
    operator: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan';
    value: any;
  };
}

export interface FormLayout {
  type: 'single-column' | 'two-column' | 'custom';
  sections?: FormSection[];
}

export interface FormSection {
  title: string;
  fields: string[];
  collapsible?: boolean;
  collapsed?: boolean;
}

export interface FormValidation {
  onSubmit: boolean;
  onChange: boolean;
  customValidators?: string[];
}

export interface NotificationRecipient {
  type: 'user' | 'role' | 'email' | 'dynamic';
  value: string;
  condition?: string;
}

export interface ProcessExecution {
  id: string;
  processId: string;
  processVersion: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  currentStep?: string;
  variables: Record<string, any>;
  history: ExecutionHistory[];
  metrics: ExecutionMetrics;
  error?: ProcessError;
}

export interface ExecutionHistory {
  stepId: string;
  timestamp: Date;
  action: string;
  actor: string;
  details?: any;
  duration?: number;
}

export interface ExecutionMetrics {
  totalDuration?: number;
  stepDurations: Record<string, number>;
  waitTime: number;
  activeTime: number;
  slaCompliance: number;
  kpiValues: Record<string, number>;
}

export interface ProcessError {
  stepId: string;
  timestamp: Date;
  type: string;
  message: string;
  stack?: string;
  retryCount?: number;
}

export class ProcessManager extends EventEmitter {
  private processes: Map<string, ProcessDefinition> = new Map();
  private executions: Map<string, ProcessExecution> = new Map();
  private workflowEngine: WorkflowEngine;
  private triggerHandlers: Map<string, any> = new Map();

  constructor(workflowEngine: WorkflowEngine) {
    super();
    this.workflowEngine = workflowEngine;
  }

  // Process Definition Management
  
  public createProcess(definition: Partial<ProcessDefinition>): ProcessDefinition {
    const process: ProcessDefinition = {
      id: definition.id || uuidv4(),
      name: definition.name || 'New Process',
      description: definition.description || '',
      version: definition.version || '1.0.0',
      category: definition.category || 'custom',
      owner: definition.owner || 'system',
      status: definition.status || 'draft',
      triggers: definition.triggers || [],
      steps: definition.steps || [],
      variables: definition.variables || [],
      kpis: definition.kpis || [],
      rules: definition.rules || [],
      integrations: definition.integrations || [],
      metadata: {
        created: new Date(),
        modified: new Date(),
        author: definition.metadata?.author || 'system',
        tags: definition.metadata?.tags || [],
        ...definition.metadata
      }
    };

    this.validateProcess(process);
    this.processes.set(process.id, process);
    this.emit('process:created', process);

    // Set up triggers if process is active
    if (process.status === 'active') {
      this.setupTriggers(process);
    }

    return process;
  }

  public updateProcess(processId: string, updates: Partial<ProcessDefinition>): ProcessDefinition {
    const process = this.processes.get(processId);
    if (!process) {
      throw new Error(`Process ${processId} not found`);
    }

    const updatedProcess = {
      ...process,
      ...updates,
      metadata: {
        ...process.metadata,
        modified: new Date()
      }
    };

    this.validateProcess(updatedProcess);
    this.processes.set(processId, updatedProcess);

    // Update triggers if needed
    if (process.status !== updatedProcess.status || 
        JSON.stringify(process.triggers) !== JSON.stringify(updatedProcess.triggers)) {
      this.teardownTriggers(process);
      if (updatedProcess.status === 'active') {
        this.setupTriggers(updatedProcess);
      }
    }

    this.emit('process:updated', updatedProcess);
    return updatedProcess;
  }

  public deleteProcess(processId: string): void {
    const process = this.processes.get(processId);
    if (!process) {
      throw new Error(`Process ${processId} not found`);
    }

    // Check for active executions
    const activeExecutions = Array.from(this.executions.values())
      .filter(exec => exec.processId === processId && 
              ['running', 'paused'].includes(exec.status));

    if (activeExecutions.length > 0) {
      throw new Error(`Cannot delete process with ${activeExecutions.length} active executions`);
    }

    this.teardownTriggers(process);
    this.processes.delete(processId);
    this.emit('process:deleted', process);
  }

  // Process Execution Management

  public async executeProcess(
    processId: string, 
    context: Record<string, any> = {},
    options: { priority?: number; async?: boolean } = {}
  ): Promise<string> {
    const process = this.processes.get(processId);
    if (!process) {
      throw new Error(`Process ${processId} not found`);
    }

    if (process.status !== 'active') {
      throw new Error(`Process ${processId} is not active`);
    }

    const execution: ProcessExecution = {
      id: uuidv4(),
      processId: process.id,
      processVersion: process.version,
      status: 'pending',
      startTime: new Date(),
      variables: this.initializeVariables(process, context),
      history: [],
      metrics: {
        stepDurations: {},
        waitTime: 0,
        activeTime: 0,
        slaCompliance: 100,
        kpiValues: {}
      }
    };

    this.executions.set(execution.id, execution);

    // Convert process to workflow
    const workflow = this.convertToWorkflow(process, execution);
    
    // Execute workflow
    if (options.async === false) {
      await this.executeWorkflow(workflow, execution);
    } else {
      this.executeWorkflow(workflow, execution).catch(error => {
        this.handleExecutionError(execution, error);
      });
    }

    this.emit('process:started', { process, execution });
    return execution.id;
  }

  public pauseExecution(executionId: string): void {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    if (execution.status !== 'running') {
      throw new Error(`Cannot pause execution in status ${execution.status}`);
    }

    // Pause the underlying workflow
    const workflowId = `exec-${execution.id}`;
    this.workflowEngine.pauseWorkflow(workflowId);

    execution.status = 'paused';
    this.recordHistory(execution, 'paused', 'Execution paused');
    this.emit('execution:paused', execution);
  }

  public resumeExecution(executionId: string): void {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    if (execution.status !== 'paused') {
      throw new Error(`Cannot resume execution in status ${execution.status}`);
    }

    // Resume the underlying workflow
    const workflowId = `exec-${execution.id}`;
    this.workflowEngine.resumeWorkflow(workflowId);

    execution.status = 'running';
    this.recordHistory(execution, 'resumed', 'Execution resumed');
    this.emit('execution:resumed', execution);
  }

  public cancelExecution(executionId: string, reason?: string): void {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    if (['completed', 'failed', 'cancelled'].includes(execution.status)) {
      throw new Error(`Cannot cancel execution in status ${execution.status}`);
    }

    // Cancel the underlying workflow
    const workflowId = `exec-${execution.id}`;
    this.workflowEngine.cancelExecution(workflowId);

    execution.status = 'cancelled';
    execution.endTime = new Date();
    this.recordHistory(execution, 'cancelled', reason || 'Execution cancelled');
    this.emit('execution:cancelled', execution);
  }

  // Helper Methods

  private validateProcess(process: ProcessDefinition): void {
    const errors: string[] = [];

    if (!process.name) errors.push('Process name is required');
    if (!process.steps || process.steps.length === 0) errors.push('Process must have at least one step');

    // Validate step references
    const stepIds = new Set(process.steps.map(s => s.id));
    for (const step of process.steps) {
      // Validate decision next steps
      if (step.type === 'decision' && step.config.decision) {
        for (const option of step.config.decision.options) {
          if (option.nextStep && !stepIds.has(option.nextStep)) {
            errors.push(`Decision option ${option.id} references unknown step ${option.nextStep}`);
          }
        }
      }
    }

    // Validate variables
    const varNames = new Set<string>();
    for (const variable of process.variables) {
      if (varNames.has(variable.name)) {
        errors.push(`Duplicate variable name: ${variable.name}`);
      }
      varNames.add(variable.name);
    }

    if (errors.length > 0) {
      throw new Error(`Process validation failed: ${errors.join(', ')}`);
    }
  }

  private initializeVariables(process: ProcessDefinition, context: Record<string, any>): Record<string, any> {
    const variables: Record<string, any> = {};

    // Initialize process variables with defaults
    for (const variable of process.variables) {
      if (variable.scope === 'process' || variable.scope === 'global') {
        variables[variable.name] = context[variable.name] ?? variable.defaultValue;
      }
    }

    // Add context variables
    return { ...variables, ...context };
  }

  private convertToWorkflow(process: ProcessDefinition, execution: ProcessExecution): Workflow {
    const workflowSteps: WorkflowStep[] = process.steps.map(step => ({
      id: step.id,
      name: step.name,
      type: 'action' as const,
      config: {
        action: async (params: any, context: any) => {
          return this.executeProcessStep(step, execution, context);
        },
        params: step
      },
      timeout: step.sla?.duration ? step.sla.duration * 60000 : undefined,
      onError: step.onError,
      maxRetries: step.onError === 'retry' ? 3 : 0
    }));

    return this.workflowEngine.createWorkflow({
      id: `exec-${execution.id}`,
      name: `${process.name} - Execution ${execution.id}`,
      steps: workflowSteps,
      variables: execution.variables,
      config: {
        errorHandling: 'stop',
        notifications: {
          onError: true,
          channels: ['system']
        }
      }
    });
  }

  private async executeWorkflow(workflow: Workflow, execution: ProcessExecution): Promise<void> {
    execution.status = 'running';
    
    try {
      const result = await this.workflowEngine.executeWorkflow(workflow.id, execution.variables);
      
      execution.status = 'completed';
      execution.endTime = new Date();
      execution.metrics.totalDuration = execution.endTime.getTime() - execution.startTime.getTime();
      
      // Calculate KPIs
      const process = this.processes.get(execution.processId)!;
      for (const kpi of process.kpis) {
        execution.metrics.kpiValues[kpi.id] = this.calculateKPI(kpi, execution);
      }
      
      this.recordHistory(execution, 'completed', 'Process completed successfully');
      this.emit('execution:completed', { execution, result });
      
    } catch (error) {
      this.handleExecutionError(execution, error);
    }
  }

  private async executeProcessStep(
    step: ProcessStep, 
    execution: ProcessExecution, 
    context: any
  ): Promise<any> {
    const startTime = Date.now();
    execution.currentStep = step.id;
    
    this.recordHistory(execution, 'step-started', `Started step: ${step.name}`, step.id);
    
    try {
      let result: any;
      
      switch (step.type) {
        case 'task':
          result = await this.executeTaskStep(step, execution, context);
          break;
        case 'decision':
          result = await this.executeDecisionStep(step, execution, context);
          break;
        case 'automation':
          result = await this.executeAutomationStep(step, execution, context);
          break;
        case 'integration':
          result = await this.executeIntegrationStep(step, execution, context);
          break;
        case 'notification':
          result = await this.executeNotificationStep(step, execution, context);
          break;
        case 'approval':
          result = await this.executeApprovalStep(step, execution, context);
          break;
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }
      
      const duration = Date.now() - startTime;
      execution.metrics.stepDurations[step.id] = duration;
      execution.metrics.activeTime += duration;
      
      // Check SLA compliance
      if (step.sla && duration > step.sla.duration * 60000) {
        execution.metrics.slaCompliance = Math.max(0, execution.metrics.slaCompliance - 10);
        this.emit('sla:breach', { execution, step, duration });
      }
      
      this.recordHistory(execution, 'step-completed', `Completed step: ${step.name}`, step.id);
      return result;
      
    } catch (error) {
      this.recordHistory(execution, 'step-failed', `Failed step: ${step.name}`, step.id);
      throw error;
    }
  }

  private async executeTaskStep(step: ProcessStep, execution: ProcessExecution, context: any): Promise<any> {
    const taskConfig = step.config.task!;
    
    // Emit task for human processing
    this.emit('task:created', {
      execution,
      step,
      assignee: step.assignee,
      priority: taskConfig.priority,
      instructions: taskConfig.instructions,
      form: taskConfig.form
    });
    
    // In a real implementation, this would wait for task completion
    return { completed: true, taskId: `task-${step.id}` };
  }

  private async executeDecisionStep(step: ProcessStep, execution: ProcessExecution, context: any): Promise<any> {
    const decisionConfig = step.config.decision!;
    
    // Auto-decide if enabled
    if (decisionConfig.autoDecide?.enabled) {
      for (const rule of decisionConfig.autoDecide.rules) {
        if (this.evaluateRule(rule, context)) {
          const option = decisionConfig.options.find(o => o.id === rule.actions[0].value);
          if (option) {
            return { decision: option.id, nextStep: option.nextStep };
          }
        }
      }
    }
    
    // Manual decision required
    this.emit('decision:required', {
      execution,
      step,
      options: decisionConfig.options,
      criteria: decisionConfig.criteria
    });
    
    // In a real implementation, this would wait for decision
    return { decision: decisionConfig.options[0].id };
  }

  private async executeAutomationStep(step: ProcessStep, execution: ProcessExecution, context: any): Promise<any> {
    const automationConfig = step.config.automation!;
    
    // Execute automation
    if (automationConfig.script) {
      // Execute script in sandboxed environment
      return { executed: true, script: automationConfig.script };
    } else if (automationConfig.function) {
      // Call registered function
      return { executed: true, function: automationConfig.function };
    }
    
    return { executed: true };
  }

  private async executeIntegrationStep(step: ProcessStep, execution: ProcessExecution, context: any): Promise<any> {
    const integrationConfig = step.config.integration!;
    
    this.emit('integration:execute', {
      execution,
      step,
      system: integrationConfig.system,
      action: integrationConfig.action,
      data: this.mapData(context, integrationConfig.mapping)
    });
    
    // In a real implementation, this would call the actual integration
    return { integrated: true, system: integrationConfig.system };
  }

  private async executeNotificationStep(step: ProcessStep, execution: ProcessExecution, context: any): Promise<any> {
    const notificationConfig = step.config.notification!;
    
    this.emit('notification:send', {
      execution,
      step,
      recipients: notificationConfig.recipients,
      template: notificationConfig.template,
      channels: notificationConfig.channels,
      priority: notificationConfig.priority,
      context
    });
    
    return { notified: true };
  }

  private async executeApprovalStep(step: ProcessStep, execution: ProcessExecution, context: any): Promise<any> {
    const approvalConfig = step.config.approval!;
    
    this.emit('approval:required', {
      execution,
      step,
      approvers: approvalConfig.approvers,
      threshold: approvalConfig.threshold,
      timeout: approvalConfig.timeout,
      context
    });
    
    // In a real implementation, this would wait for approvals
    return { approved: true, approvers: [] };
  }

  private evaluateRule(rule: BusinessRule, context: any): boolean {
    if (!rule.enabled) return false;
    
    try {
      // Simple expression evaluation
      const func = new Function('context', `with(context) { return ${rule.condition}; }`);
      return !!func(context);
    } catch (error) {
      console.error(`Rule evaluation error for ${rule.name}:`, error);
      return false;
    }
  }

  private mapData(source: any, mapping: FieldMapping[]): any {
    const result: any = {};
    
    for (const map of mapping) {
      let value = this.getNestedValue(source, map.source);
      
      if (map.transform) {
        // Apply transformation
        try {
          const func = new Function('value', `return ${map.transform}`);
          value = func(value);
        } catch (error) {
          console.error(`Transform error for ${map.source}:`, error);
        }
      }
      
      this.setNestedValue(result, map.destination, value ?? map.defaultValue);
    }
    
    return result;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  private calculateKPI(kpi: ProcessKPI, execution: ProcessExecution): number {
    try {
      // Simple KPI calculation
      const func = new Function('metrics', 'variables', `return ${kpi.formula}`);
      return func(execution.metrics, execution.variables);
    } catch (error) {
      console.error(`KPI calculation error for ${kpi.name}:`, error);
      return 0;
    }
  }

  private recordHistory(execution: ProcessExecution, action: string, details?: any, stepId?: string): void {
    execution.history.push({
      stepId: stepId || execution.currentStep || '',
      timestamp: new Date(),
      action,
      actor: 'system',
      details
    });
  }

  private handleExecutionError(execution: ProcessExecution, error: any): void {
    execution.status = 'failed';
    execution.endTime = new Date();
    execution.error = {
      stepId: execution.currentStep || '',
      timestamp: new Date(),
      type: error.name || 'Error',
      message: error.message || String(error),
      stack: error.stack
    };
    
    this.recordHistory(execution, 'failed', error.message);
    this.emit('execution:failed', { execution, error });
  }

  private setupTriggers(process: ProcessDefinition): void {
    for (const trigger of process.triggers) {
      if (!trigger.enabled) continue;
      
      const handler = this.createTriggerHandler(process, trigger);
      this.triggerHandlers.set(`${process.id}-${trigger.id}`, handler);
    }
  }

  private teardownTriggers(process: ProcessDefinition): void {
    for (const trigger of process.triggers) {
      const key = `${process.id}-${trigger.id}`;
      const handler = this.triggerHandlers.get(key);
      if (handler && typeof handler.stop === 'function') {
        handler.stop();
      }
      this.triggerHandlers.delete(key);
    }
  }

  private createTriggerHandler(process: ProcessDefinition, trigger: ProcessTrigger): any {
    switch (trigger.type) {
      case 'event':
        return this.createEventTrigger(process, trigger);
      case 'schedule':
        return this.createScheduleTrigger(process, trigger);
      case 'condition':
        return this.createConditionTrigger(process, trigger);
      case 'api':
        return this.createApiTrigger(process, trigger);
      default:
        return null;
    }
  }

  private createEventTrigger(process: ProcessDefinition, trigger: ProcessTrigger): any {
    const config = trigger.config.event!;
    const handler = (event: any) => {
      if (this.matchesEventFilters(event, config.filters)) {
        this.executeProcess(process.id, { trigger: trigger.id, event });
      }
    };
    
    this.on(`${config.source}:${config.type}`, handler);
    
    return {
      stop: () => this.off(`${config.source}:${config.type}`, handler)
    };
  }

  private createScheduleTrigger(process: ProcessDefinition, trigger: ProcessTrigger): any {
    const config = trigger.config.schedule!;
    
    if (config.cron) {
      // Use workflow scheduler for cron-based triggers
      const scheduledWorkflow = this.workflowEngine.scheduleWorkflow(
        `process-${process.id}`,
        { type: 'cron', value: config.cron, timezone: config.timezone },
        { trigger: trigger.id }
      );
      
      return {
        stop: () => this.workflowEngine.cancelSchedule(scheduledWorkflow.id)
      };
    } else if (config.interval) {
      const intervalId = setInterval(() => {
        this.executeProcess(process.id, { trigger: trigger.id });
      }, config.interval);
      
      return {
        stop: () => clearInterval(intervalId)
      };
    }
    
    return null;
  }

  private createConditionTrigger(process: ProcessDefinition, trigger: ProcessTrigger): any {
    const config = trigger.config.condition!;
    
    const checkCondition = async () => {
      try {
        const func = new Function('return ' + config.expression);
        if (func()) {
          await this.executeProcess(process.id, { trigger: trigger.id });
        }
      } catch (error) {
        console.error(`Condition trigger error for ${trigger.name}:`, error);
      }
    };
    
    const intervalId = setInterval(checkCondition, config.checkInterval);
    
    return {
      stop: () => clearInterval(intervalId)
    };
  }

  private createApiTrigger(process: ProcessDefinition, trigger: ProcessTrigger): any {
    // API triggers would be handled by external webhook registration
    this.emit('api:register', {
      processId: process.id,
      triggerId: trigger.id,
      config: trigger.config.api
    });
    
    return {
      stop: () => {
        this.emit('api:unregister', {
          processId: process.id,
          triggerId: trigger.id
        });
      }
    };
  }

  private matchesEventFilters(event: any, filters?: Record<string, any>): boolean {
    if (!filters) return true;
    
    for (const [key, value] of Object.entries(filters)) {
      const eventValue = this.getNestedValue(event, key);
      if (eventValue !== value) return false;
    }
    
    return true;
  }

  // Public API Methods

  public getProcess(processId: string): ProcessDefinition | undefined {
    return this.processes.get(processId);
  }

  public getProcesses(filter?: { 
    category?: string; 
    status?: string; 
    owner?: string; 
    tags?: string[] 
  }): ProcessDefinition[] {
    let processes = Array.from(this.processes.values());
    
    if (filter) {
      if (filter.category) {
        processes = processes.filter(p => p.category === filter.category);
      }
      if (filter.status) {
        processes = processes.filter(p => p.status === filter.status);
      }
      if (filter.owner) {
        processes = processes.filter(p => p.owner === filter.owner);
      }
      if (filter.tags && filter.tags.length > 0) {
        processes = processes.filter(p => 
          filter.tags!.some(tag => p.metadata.tags.includes(tag))
        );
      }
    }
    
    return processes;
  }

  public getExecution(executionId: string): ProcessExecution | undefined {
    return this.executions.get(executionId);
  }

  public getExecutions(filter?: {
    processId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }): ProcessExecution[] {
    let executions = Array.from(this.executions.values());
    
    if (filter) {
      if (filter.processId) {
        executions = executions.filter(e => e.processId === filter.processId);
      }
      if (filter.status) {
        executions = executions.filter(e => e.status === filter.status);
      }
      if (filter.startDate) {
        executions = executions.filter(e => e.startTime >= filter.startDate!);
      }
      if (filter.endDate) {
        executions = executions.filter(e => e.startTime <= filter.endDate!);
      }
    }
    
    return executions;
  }

  public getProcessMetrics(processId: string): any {
    const executions = this.getExecutions({ processId });
    
    if (executions.length === 0) {
      return null;
    }
    
    const completedExecutions = executions.filter(e => e.status === 'completed');
    const failedExecutions = executions.filter(e => e.status === 'failed');
    
    return {
      totalExecutions: executions.length,
      completedExecutions: completedExecutions.length,
      failedExecutions: failedExecutions.length,
      successRate: completedExecutions.length / executions.length,
      averageDuration: completedExecutions.reduce((sum, e) => 
        sum + (e.metrics.totalDuration || 0), 0) / completedExecutions.length,
      averageSLACompliance: executions.reduce((sum, e) => 
        sum + e.metrics.slaCompliance, 0) / executions.length,
      kpiAverages: this.calculateKPIAverages(completedExecutions)
    };
  }

  private calculateKPIAverages(executions: ProcessExecution[]): Record<string, number> {
    const kpiSums: Record<string, number> = {};
    const kpiCounts: Record<string, number> = {};
    
    for (const execution of executions) {
      for (const [kpiId, value] of Object.entries(execution.metrics.kpiValues)) {
        kpiSums[kpiId] = (kpiSums[kpiId] || 0) + value;
        kpiCounts[kpiId] = (kpiCounts[kpiId] || 0) + 1;
      }
    }
    
    const averages: Record<string, number> = {};
    for (const kpiId of Object.keys(kpiSums)) {
      averages[kpiId] = kpiSums[kpiId] / kpiCounts[kpiId];
    }
    
    return averages;
  }
}