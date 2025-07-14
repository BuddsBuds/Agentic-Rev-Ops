import { EventEmitter } from 'events';
import { HITLOrchestrator } from '../core/HITLOrchestrator';
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
export declare class ReviewWorkflowEngine extends EventEmitter {
    private workflows;
    private executions;
    private hitlOrchestrator;
    private swarmMemory;
    private activeTimers;
    constructor(hitlOrchestrator: HITLOrchestrator, swarmMemory: SwarmMemory);
    private setupEventHandlers;
    private setupDefaultWorkflows;
    createWorkflow(workflow: Omit<ReviewWorkflow, 'id'> & {
        id?: string;
    }): ReviewWorkflow;
    private handleNewDecision;
    private findApplicableWorkflows;
    private evaluateWorkflowTriggers;
    private evaluateCondition;
    private startWorkflowExecution;
    private executeStage;
    private requestStageReview;
    completeStage(execution: WorkflowExecution, stage: ReviewStage, result: 'approved' | 'rejected' | 'escalated' | 'auto-advanced', notes?: string): Promise<void>;
    private executeStageAction;
    private advanceToNextStage;
    private completeWorkflow;
    private checkAutoAdvanceConditions;
    private handleStageTimeout;
    private handleDecisionWithoutWorkflow;
    private escalateWorkflow;
    private rejectWorkflow;
    private executeDecision;
    private sendNotification;
    private rollbackExecution;
    private handleReviewCompleted;
    getWorkflow(id: string): ReviewWorkflow | undefined;
    getWorkflows(): ReviewWorkflow[];
    getExecution(id: string): WorkflowExecution | undefined;
    getActiveExecutions(): WorkflowExecution[];
    getExecutionsByStatus(status: WorkflowExecution['status']): WorkflowExecution[];
}
//# sourceMappingURL=ReviewWorkflowEngine.d.ts.map