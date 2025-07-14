import { EventEmitter } from 'events';
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
export declare class WorkflowExecutionEngine extends EventEmitter implements WorkflowEngine {
    private workflows;
    private executionContexts;
    private executionQueue;
    private stepExecutors;
    private activeExecutions;
    private pausedExecutions;
    constructor();
    private registerDefaultExecutors;
    registerStepExecutor(type: string, executor: StepExecutor): void;
}
interface StepExecutor {
    execute(step: WorkflowStep, context: any, workflow: Workflow): Promise<any>;
    validate(step: WorkflowStep): string[];
}
export {};
//# sourceMappingURL=workflow-engine.d.ts.map