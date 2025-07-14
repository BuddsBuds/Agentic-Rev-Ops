// Review Workflow Engine - Manages HITL review processes and workflows
import { EventEmitter } from 'events';
import { HITLDecision, HITLOrchestrator } from '../core/HITLOrchestrator';
import { HumanReviewRequest } from '../interfaces/hitl-manager';
import { SwarmMemory } from '../../../swarm/memory/SwarmMemory';

export interface ReviewWorkflow {
  id: string;
  name: string;
  description: string;
  stages: ReviewStage[];
  triggers: WorkflowTrigger[];
  configuration: WorkflowConfiguration;
  status: 'active' | 'inactive' | 'draft';
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewStage {
  id: string;
  name: string;
  type: 'validation' | 'approval' | 'review' | 'escalation' | 'execution';
  order: number;
  requiredRoles: string[];
  timeoutMinutes: number;
  autoAdvanceConditions?: string[];
  onSuccess: StageAction[];
  onFailure: StageAction[];
  onTimeout: StageAction[];
  parallel: boolean;
}

export interface StageAction {
  type: 'advance' | 'escalate' | 'reject' | 'notify' | 'execute' | 'rollback';
  target?: string;
  parameters?: any;
}

export interface WorkflowTrigger {
  type: 'decision_type' | 'risk_level' | 'financial_impact' | 'confidence' | 'client_type';
  condition: string;
  value: any;
}

export interface WorkflowConfiguration {
  allowParallelStages: boolean;
  requireAllApprovals: boolean;
  escalationPath: string[];
  notificationChannels: string[];
  auditLevel: 'basic' | 'detailed' | 'comprehensive';
  rollbackPolicy: 'automatic' | 'manual' | 'disabled';
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  decisionId: string;
  currentStage: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  stageHistory: StageExecution[];
  startedAt: Date;
  completedAt?: Date;
  result?: 'approved' | 'rejected' | 'escalated';
  metadata: any;
}

export interface StageExecution {
  stageId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped' | 'timeout';
  assignedTo: string[];
  startedAt: Date;
  completedAt?: Date;
  result?: any;
  notes?: string;
  actions: StageActionExecution[];
}

export interface StageActionExecution {
  actionId: string;
  type: string;
  executedAt: Date;
  result: 'success' | 'failure';
  details?: any;
}

export class ReviewWorkflowEngine extends EventEmitter {
  private workflows: Map<string, ReviewWorkflow> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private hitlOrchestrator: HITLOrchestrator;
  private swarmMemory: SwarmMemory;
  private activeTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(hitlOrchestrator: HITLOrchestrator, swarmMemory: SwarmMemory) {
    super();
    this.hitlOrchestrator = hitlOrchestrator;
    this.swarmMemory = swarmMemory;
    this.setupDefaultWorkflows();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.hitlOrchestrator.on('decision:created', this.handleNewDecision.bind(this));
    this.hitlOrchestrator.on('review:completed', this.handleReviewCompleted.bind(this));
  }

  private setupDefaultWorkflows(): void {
    // Strategic Decision Workflow
    this.createWorkflow({
      id: 'strategic-decision',
      name: 'Strategic Decision Review',
      description: 'Multi-stage review for strategic business decisions',
      stages: [
        {
          id: 'initial-validation',
          name: 'Initial Validation',
          type: 'validation',
          order: 1,
          requiredRoles: ['analyst', 'domain-expert'],
          timeoutMinutes: 30,
          onSuccess: [{ type: 'advance', target: 'senior-review' }],
          onFailure: [{ type: 'reject' }],
          onTimeout: [{ type: 'escalate', target: 'emergency-review' }],
          parallel: false
        },
        {
          id: 'senior-review',
          name: 'Senior Leadership Review',
          type: 'approval',
          order: 2,
          requiredRoles: ['senior-manager', 'director'],
          timeoutMinutes: 60,
          onSuccess: [{ type: 'advance', target: 'final-approval' }],
          onFailure: [{ type: 'escalate', target: 'executive-review' }],
          onTimeout: [{ type: 'escalate', target: 'executive-review' }],
          parallel: false
        },
        {
          id: 'final-approval',
          name: 'Final Approval',
          type: 'approval',
          order: 3,
          requiredRoles: ['executive'],
          timeoutMinutes: 120,
          onSuccess: [{ type: 'execute' }],
          onFailure: [{ type: 'reject' }],
          onTimeout: [{ type: 'escalate', target: 'board-review' }],
          parallel: false
        }
      ],
      triggers: [
        { type: 'decision_type', condition: 'equals', value: 'strategic' },
        { type: 'financial_impact', condition: 'greater_than', value: 100000 }
      ],
      configuration: {
        allowParallelStages: false,
        requireAllApprovals: true,
        escalationPath: ['senior-manager', 'director', 'executive', 'board'],
        notificationChannels: ['email', 'slack', 'dashboard'],
        auditLevel: 'comprehensive',
        rollbackPolicy: 'manual'
      },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Quick Approval Workflow
    this.createWorkflow({
      id: 'quick-approval',
      name: 'Quick Approval Process',
      description: 'Fast-track approval for low-risk decisions',
      stages: [
        {
          id: 'peer-review',
          name: 'Peer Review',
          type: 'review',
          order: 1,
          requiredRoles: ['analyst', 'specialist'],
          timeoutMinutes: 15,
          autoAdvanceConditions: ['confidence > 0.9', 'risk_level = low'],
          onSuccess: [{ type: 'execute' }],
          onFailure: [{ type: 'escalate', target: 'detailed-review' }],
          onTimeout: [{ type: 'advance', target: 'manager-approval' }],
          parallel: true
        },
        {
          id: 'manager-approval',
          name: 'Manager Approval',
          type: 'approval',
          order: 2,
          requiredRoles: ['manager'],
          timeoutMinutes: 30,
          onSuccess: [{ type: 'execute' }],
          onFailure: [{ type: 'reject' }],
          onTimeout: [{ type: 'escalate', target: 'senior-review' }],
          parallel: false
        }
      ],
      triggers: [
        { type: 'risk_level', condition: 'equals', value: 'low' },
        { type: 'financial_impact', condition: 'less_than', value: 10000 },
        { type: 'confidence', condition: 'greater_than', value: 0.8 }
      ],
      configuration: {
        allowParallelStages: true,
        requireAllApprovals: false,
        escalationPath: ['manager', 'senior-manager'],
        notificationChannels: ['dashboard', 'slack'],
        auditLevel: 'basic',
        rollbackPolicy: 'automatic'
      },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Emergency Decision Workflow
    this.createWorkflow({
      id: 'emergency-decision',
      name: 'Emergency Decision Process',
      description: 'Rapid response for critical and time-sensitive decisions',
      stages: [
        {
          id: 'emergency-triage',
          name: 'Emergency Triage',
          type: 'validation',
          order: 1,
          requiredRoles: ['on-call-manager', 'subject-matter-expert'],
          timeoutMinutes: 5,
          onSuccess: [{ type: 'advance', target: 'rapid-approval' }],
          onFailure: [{ type: 'escalate', target: 'executive-emergency' }],
          onTimeout: [{ type: 'escalate', target: 'executive-emergency' }],
          parallel: true
        },
        {
          id: 'rapid-approval',
          name: 'Rapid Approval',
          type: 'approval',
          order: 2,
          requiredRoles: ['senior-manager', 'director'],
          timeoutMinutes: 10,
          onSuccess: [{ type: 'execute' }],
          onFailure: [{ type: 'escalate', target: 'executive-emergency' }],
          onTimeout: [{ type: 'execute' }], // Auto-approve on timeout for emergencies
          parallel: false
        }
      ],
      triggers: [
        { type: 'risk_level', condition: 'equals', value: 'critical' },
        { type: 'decision_type', condition: 'equals', value: 'emergency' }
      ],
      configuration: {
        allowParallelStages: true,
        requireAllApprovals: false,
        escalationPath: ['on-call-manager', 'senior-manager', 'director', 'executive'],
        notificationChannels: ['sms', 'phone', 'slack', 'email'],
        auditLevel: 'detailed',
        rollbackPolicy: 'automatic'
      },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  /**
   * Create a new workflow
   */
  public createWorkflow(workflow: Omit<ReviewWorkflow, 'id'> & { id?: string }): ReviewWorkflow {
    const newWorkflow: ReviewWorkflow = {
      id: workflow.id || `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...workflow,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.workflows.set(newWorkflow.id, newWorkflow);
    this.emit('workflow:created', newWorkflow);
    return newWorkflow;
  }

  /**
   * Handle new decision and trigger appropriate workflow
   */
  private async handleNewDecision(decision: HITLDecision): Promise<void> {
    const applicableWorkflows = this.findApplicableWorkflows(decision);
    
    if (applicableWorkflows.length === 0) {
      // Use default workflow or handle without workflow
      await this.handleDecisionWithoutWorkflow(decision);
      return;
    }

    // Use the most specific workflow (first match)
    const workflow = applicableWorkflows[0];
    await this.startWorkflowExecution(workflow, decision);
  }

  /**
   * Find workflows that apply to a decision
   */
  private findApplicableWorkflows(decision: HITLDecision): ReviewWorkflow[] {
    return Array.from(this.workflows.values())
      .filter(workflow => 
        workflow.status === 'active' && 
        this.evaluateWorkflowTriggers(workflow, decision)
      )
      .sort((a, b) => b.triggers.length - a.triggers.length); // More specific first
  }

  /**
   * Evaluate if workflow triggers match decision
   */
  private evaluateWorkflowTriggers(workflow: ReviewWorkflow, decision: HITLDecision): boolean {
    return workflow.triggers.every(trigger => {
      switch (trigger.type) {
        case 'decision_type':
          return this.evaluateCondition(decision.type, trigger.condition, trigger.value);
        case 'risk_level':
          return this.evaluateCondition(decision.context.riskLevel, trigger.condition, trigger.value);
        case 'financial_impact':
          return this.evaluateCondition(decision.context.financialImpact || 0, trigger.condition, trigger.value);
        case 'confidence':
          return this.evaluateCondition(decision.context.confidence, trigger.condition, trigger.value);
        case 'client_type':
          return this.evaluateCondition(decision.metadata.clientId ? 'external' : 'internal', trigger.condition, trigger.value);
        default:
          return false;
      }
    });
  }

  /**
   * Evaluate a condition
   */
  private evaluateCondition(value: any, condition: string, expected: any): boolean {
    switch (condition) {
      case 'equals': return value === expected;
      case 'not_equals': return value !== expected;
      case 'greater_than': return value > expected;
      case 'less_than': return value < expected;
      case 'greater_or_equal': return value >= expected;
      case 'less_or_equal': return value <= expected;
      case 'contains': return String(value).includes(String(expected));
      case 'starts_with': return String(value).startsWith(String(expected));
      case 'ends_with': return String(value).endsWith(String(expected));
      default: return false;
    }
  }

  /**
   * Start workflow execution
   */
  private async startWorkflowExecution(workflow: ReviewWorkflow, decision: HITLDecision): Promise<WorkflowExecution> {
    const execution: WorkflowExecution = {
      id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      workflowId: workflow.id,
      decisionId: decision.id,
      currentStage: workflow.stages[0].id,
      status: 'in_progress',
      stageHistory: [],
      startedAt: new Date(),
      metadata: {
        workflow: workflow.name,
        decision: decision.title,
        priority: decision.metadata.priority
      }
    };

    this.executions.set(execution.id, execution);
    
    // Store in swarm memory
    await this.swarmMemory.store(`workflow:execution:${execution.id}`, execution);

    // Start first stage
    await this.executeStage(execution, workflow.stages[0]);

    this.emit('workflow:started', { execution, workflow, decision });
    return execution;
  }

  /**
   * Execute a workflow stage
   */
  private async executeStage(execution: WorkflowExecution, stage: ReviewStage): Promise<void> {
    const stageExecution: StageExecution = {
      stageId: stage.id,
      status: 'in_progress',
      assignedTo: stage.requiredRoles,
      startedAt: new Date(),
      actions: []
    };

    execution.stageHistory.push(stageExecution);
    execution.currentStage = stage.id;

    // Set timeout
    if (stage.timeoutMinutes > 0) {
      const timeoutMs = stage.timeoutMinutes * 60 * 1000;
      const timer = setTimeout(() => {
        this.handleStageTimeout(execution.id, stage.id);
      }, timeoutMs);
      
      this.activeTimers.set(`${execution.id}-${stage.id}`, timer);
    }

    // Check auto-advance conditions
    if (stage.autoAdvanceConditions && await this.checkAutoAdvanceConditions(execution, stage)) {
      await this.completeStage(execution, stage, 'auto-advanced');
      return;
    }

    // Request human review for this stage
    await this.requestStageReview(execution, stage);

    this.emit('stage:started', { execution, stage });
  }

  /**
   * Request human review for a stage
   */
  private async requestStageReview(execution: WorkflowExecution, stage: ReviewStage): Promise<void> {
    const decision = this.hitlOrchestrator.getDecision(execution.decisionId);
    if (!decision) return;

    const reviewRequest: Partial<HumanReviewRequest> = {
      type: stage.type as any,
      context: {
        decision,
        stage,
        execution,
        workflow: this.workflows.get(execution.workflowId),
        requiredRoles: stage.requiredRoles,
        timeoutMinutes: stage.timeoutMinutes
      }
    };

    // This would integrate with the HITL manager to request review
    this.emit('stage:reviewRequested', { execution, stage, reviewRequest });
  }

  /**
   * Handle stage completion
   */
  public async completeStage(
    execution: WorkflowExecution, 
    stage: ReviewStage, 
    result: 'approved' | 'rejected' | 'escalated' | 'auto-advanced',
    notes?: string
  ): Promise<void> {
    const stageExecution = execution.stageHistory.find(s => s.stageId === stage.id);
    if (!stageExecution) return;

    stageExecution.status = 'completed';
    stageExecution.completedAt = new Date();
    stageExecution.result = result;
    stageExecution.notes = notes;

    // Clear timeout
    const timerKey = `${execution.id}-${stage.id}`;
    const timer = this.activeTimers.get(timerKey);
    if (timer) {
      clearTimeout(timer);
      this.activeTimers.delete(timerKey);
    }

    // Execute stage actions based on result
    const actions = result === 'approved' ? stage.onSuccess :
                   result === 'rejected' ? stage.onFailure :
                   stage.onTimeout;

    for (const action of actions) {
      await this.executeStageAction(execution, stage, action);
    }

    this.emit('stage:completed', { execution, stage, result });
  }

  /**
   * Execute a stage action
   */
  private async executeStageAction(
    execution: WorkflowExecution, 
    stage: ReviewStage, 
    action: StageAction
  ): Promise<void> {
    const actionExecution: StageActionExecution = {
      actionId: `action-${Date.now()}`,
      type: action.type,
      executedAt: new Date(),
      result: 'success'
    };

    const stageExecution = execution.stageHistory.find(s => s.stageId === stage.id);
    stageExecution?.actions.push(actionExecution);

    try {
      switch (action.type) {
        case 'advance':
          await this.advanceToNextStage(execution, action.target);
          break;
        
        case 'escalate':
          await this.escalateWorkflow(execution, action.target);
          break;
        
        case 'reject':
          await this.rejectWorkflow(execution);
          break;
        
        case 'execute':
          await this.executeDecision(execution);
          break;
        
        case 'notify':
          await this.sendNotification(execution, action.parameters);
          break;
        
        case 'rollback':
          await this.rollbackExecution(execution);
          break;
      }
    } catch (error) {
      actionExecution.result = 'failure';
      actionExecution.details = { error: error instanceof Error ? error.message : String(error) };
      this.emit('action:failed', { execution, stage, action, error });
    }
  }

  /**
   * Advance to next stage
   */
  private async advanceToNextStage(execution: WorkflowExecution, targetStageId?: string): Promise<void> {
    const workflow = this.workflows.get(execution.workflowId);
    if (!workflow) return;

    let nextStage: ReviewStage | undefined;

    if (targetStageId) {
      nextStage = workflow.stages.find(s => s.id === targetStageId);
    } else {
      const currentStageIndex = workflow.stages.findIndex(s => s.id === execution.currentStage);
      nextStage = workflow.stages[currentStageIndex + 1];
    }

    if (!nextStage) {
      // No more stages, complete workflow
      await this.completeWorkflow(execution, 'approved');
      return;
    }

    await this.executeStage(execution, nextStage);
  }

  /**
   * Complete workflow execution
   */
  private async completeWorkflow(
    execution: WorkflowExecution, 
    result: 'approved' | 'rejected' | 'escalated'
  ): Promise<void> {
    execution.status = 'completed';
    execution.completedAt = new Date();
    execution.result = result;

    // Update swarm memory
    await this.swarmMemory.store(`workflow:execution:${execution.id}`, execution);

    // Clear any remaining timers
    for (const [key, timer] of this.activeTimers.entries()) {
      if (key.startsWith(execution.id)) {
        clearTimeout(timer);
        this.activeTimers.delete(key);
      }
    }

    this.emit('workflow:completed', { execution, result });
  }

  /**
   * Check auto-advance conditions
   */
  private async checkAutoAdvanceConditions(execution: WorkflowExecution, stage: ReviewStage): Promise<boolean> {
    if (!stage.autoAdvanceConditions) return false;

    const decision = this.hitlOrchestrator.getDecision(execution.decisionId);
    if (!decision) return false;

    return stage.autoAdvanceConditions.every(condition => {
      // Parse and evaluate conditions like "confidence > 0.9"
      const [field, operator, value] = condition.split(' ');
      
      let fieldValue: any;
      switch (field) {
        case 'confidence':
          fieldValue = decision.context.confidence;
          break;
        case 'risk_level':
          fieldValue = decision.context.riskLevel;
          break;
        case 'financial_impact':
          fieldValue = decision.context.financialImpact || 0;
          break;
        default:
          return false;
      }

      return this.evaluateCondition(fieldValue, operator, isNaN(Number(value)) ? value : Number(value));
    });
  }

  /**
   * Handle stage timeout
   */
  private async handleStageTimeout(executionId: string, stageId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) return;

    const workflow = this.workflows.get(execution.workflowId);
    if (!workflow) return;

    const stage = workflow.stages.find(s => s.id === stageId);
    if (!stage) return;

    const stageExecution = execution.stageHistory.find(s => s.stageId === stageId);
    if (stageExecution) {
      stageExecution.status = 'timeout';
      stageExecution.completedAt = new Date();
    }

    // Execute timeout actions
    for (const action of stage.onTimeout) {
      await this.executeStageAction(execution, stage, action);
    }

    this.emit('stage:timeout', { execution, stage });
  }

  /**
   * Handle decision without workflow
   */
  private async handleDecisionWithoutWorkflow(decision: HITLDecision): Promise<void> {
    // Create a simple single-stage workflow
    const simpleWorkflow: ReviewWorkflow = {
      id: 'simple-approval',
      name: 'Simple Approval',
      description: 'Basic approval process',
      stages: [{
        id: 'simple-review',
        name: 'Review',
        type: 'approval',
        order: 1,
        requiredRoles: ['reviewer'],
        timeoutMinutes: 60,
        onSuccess: [{ type: 'execute' }],
        onFailure: [{ type: 'reject' }],
        onTimeout: [{ type: 'escalate' }],
        parallel: false
      }],
      triggers: [],
      configuration: {
        allowParallelStages: false,
        requireAllApprovals: true,
        escalationPath: ['manager'],
        notificationChannels: ['dashboard'],
        auditLevel: 'basic',
        rollbackPolicy: 'manual'
      },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.startWorkflowExecution(simpleWorkflow, decision);
  }

  // Additional workflow management methods
  private async escalateWorkflow(execution: WorkflowExecution, target?: string): Promise<void> {
    execution.metadata.escalated = true;
    execution.metadata.escalatedAt = new Date();
    execution.metadata.escalationTarget = target;

    this.emit('workflow:escalated', { execution, target });
  }

  private async rejectWorkflow(execution: WorkflowExecution): Promise<void> {
    await this.completeWorkflow(execution, 'rejected');
  }

  private async executeDecision(execution: WorkflowExecution): Promise<void> {
    const decision = this.hitlOrchestrator.getDecision(execution.decisionId);
    if (decision) {
      // Signal to HITL orchestrator to execute
      this.emit('workflow:executeDecision', { execution, decision });
    }
    await this.completeWorkflow(execution, 'approved');
  }

  private async sendNotification(execution: WorkflowExecution, parameters: any): Promise<void> {
    this.emit('workflow:notification', { execution, parameters });
  }

  private async rollbackExecution(execution: WorkflowExecution): Promise<void> {
    execution.metadata.rolledBack = true;
    execution.metadata.rolledBackAt = new Date();
    this.emit('workflow:rolledBack', { execution });
  }

  private async handleReviewCompleted(reviewResponse: HumanReviewRequest): Promise<void> {
    // Find related workflow execution and continue processing
    const execution = Array.from(this.executions.values()).find(exec =>
      exec.decisionId === reviewResponse.context?.decision?.id
    );

    if (execution) {
      const workflow = this.workflows.get(execution.workflowId);
      const stage = workflow?.stages.find(s => s.id === execution.currentStage);
      
      if (stage) {
        const result = reviewResponse.response?.approved ? 'approved' : 'rejected';
        await this.completeStage(execution, stage, result, reviewResponse.response?.notes);
      }
    }
  }

  /**
   * Get workflow by ID
   */
  public getWorkflow(id: string): ReviewWorkflow | undefined {
    return this.workflows.get(id);
  }

  /**
   * Get all workflows
   */
  public getWorkflows(): ReviewWorkflow[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Get workflow execution by ID
   */
  public getExecution(id: string): WorkflowExecution | undefined {
    return this.executions.get(id);
  }

  /**
   * Get active executions
   */
  public getActiveExecutions(): WorkflowExecution[] {
    return Array.from(this.executions.values())
      .filter(exec => exec.status === 'in_progress');
  }

  /**
   * Get executions by status
   */
  public getExecutionsByStatus(status: WorkflowExecution['status']): WorkflowExecution[] {
    return Array.from(this.executions.values()).filter(exec => exec.status === status);
  }
}