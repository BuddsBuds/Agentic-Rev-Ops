import { EventEmitter } from 'events';
import { WorkflowEngine } from '../engine/workflow-engine';
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
    threshold?: number;
    timeout?: number;
    escalation?: ProcessAssignee;
    reminders?: ReminderConfig;
}
export interface ReminderConfig {
    intervals: number[];
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
    duration: number;
    warningThreshold: number;
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
    options?: {
        value: string;
        label: string;
    }[];
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
export declare class ProcessManager extends EventEmitter {
    private processes;
    private executions;
    private workflowEngine;
    private triggerHandlers;
    constructor(workflowEngine: WorkflowEngine);
    createProcess(definition: Partial<ProcessDefinition>): ProcessDefinition;
    updateProcess(processId: string, updates: Partial<ProcessDefinition>): ProcessDefinition;
    deleteProcess(processId: string): void;
    executeProcess(processId: string, context?: Record<string, any>, options?: {
        priority?: number;
        async?: boolean;
    }): Promise<string>;
    pauseExecution(executionId: string): void;
    resumeExecution(executionId: string): void;
    cancelExecution(executionId: string, reason?: string): void;
    private validateProcess;
    private initializeVariables;
    private convertToWorkflow;
    private executeWorkflow;
    private executeProcessStep;
    private executeTaskStep;
    private executeDecisionStep;
    private executeAutomationStep;
    private executeIntegrationStep;
    private executeNotificationStep;
    private executeApprovalStep;
    private evaluateRule;
    private mapData;
    private getNestedValue;
    private setNestedValue;
    private calculateKPI;
    private recordHistory;
    private handleExecutionError;
    private setupTriggers;
    private teardownTriggers;
    private createTriggerHandler;
    private createEventTrigger;
    private createScheduleTrigger;
    private createConditionTrigger;
    private createApiTrigger;
    private matchesEventFilters;
    getProcess(processId: string): ProcessDefinition | undefined;
    getProcesses(filter?: {
        category?: string;
        status?: string;
        owner?: string;
        tags?: string[];
    }): ProcessDefinition[];
    getExecution(executionId: string): ProcessExecution | undefined;
    getExecutions(filter?: {
        processId?: string;
        status?: string;
        startDate?: Date;
        endDate?: Date;
    }): ProcessExecution[];
    getProcessMetrics(processId: string): any;
    private calculateKPIAverages;
}
//# sourceMappingURL=ProcessDefinition.d.ts.map