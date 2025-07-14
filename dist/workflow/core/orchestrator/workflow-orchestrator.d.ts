import { EventEmitter } from 'events';
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
        schedule?: string;
        event?: string;
        threshold?: ThresholdConfig;
    };
}
export interface ThresholdConfig {
    metric: string;
    operator: '>' | '<' | '=' | '>=' | '<=';
    value: number;
    window?: string;
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
export declare class WorkflowOrchestrator extends EventEmitter {
    private engine;
    private scheduler;
    private agentCoordinator;
    private hitlManager;
    private integrationManager;
    private performanceMonitor;
    private workflows;
    private executions;
    constructor();
    initialize(): Promise<void>;
    registerWorkflow(workflow: WorkflowDefinition): Promise<void>;
    executeWorkflow(workflowId: string, context?: Record<string, any>, options?: {
        priority?: 'low' | 'medium' | 'high';
        immediate?: boolean;
    }): Promise<string>;
    pauseExecution(executionId: string): Promise<void>;
    resumeExecution(executionId: string): Promise<void>;
    cancelExecution(executionId: string): Promise<void>;
    getExecution(executionId: string): WorkflowExecution | undefined;
    getWorkflowExecutions(workflowId: string): WorkflowExecution[];
    getActiveExecutions(): WorkflowExecution[];
    getWorkflowMetrics(workflowId: string): any;
    handleHITLResponse(executionId: string, _stepId: string, response: any): Promise<void>;
    private validateWorkflow;
    private initializeEventHandlers;
    private generateExecutionId;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=workflow-orchestrator.d.ts.map