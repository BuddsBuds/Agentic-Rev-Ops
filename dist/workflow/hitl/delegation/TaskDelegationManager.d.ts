import { EventEmitter } from 'events';
import { HITLDecision } from '../core/HITLOrchestrator';
import { SwarmMemory } from '../../../swarm/memory/SwarmMemory';
export interface DelegatedTask {
    id: string;
    title: string;
    description: string;
    type: 'analysis' | 'validation' | 'decision' | 'execution' | 'review' | 'research';
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
    estimatedDuration: number;
    deadline?: Date;
    requiredSkills: string[];
    requiredRole: string;
    complexity: 'simple' | 'moderate' | 'complex' | 'expert';
    originatingDecision?: string;
    delegatedBy: string;
    assignedTo?: string;
    delegatedAt: Date;
    assignedAt?: Date;
    startedAt?: Date;
    completedAt?: Date;
    inputs: any;
    expectedOutputs: TaskOutput[];
    context: TaskContext;
    instructions: TaskInstruction[];
    resources: TaskResource[];
    progress: number;
    milestones: TaskMilestone[];
    timeSpent: number;
    qualityChecks: QualityCheck[];
    reviewRequired: boolean;
    reviewedBy?: string;
    outputs?: any;
    feedback?: string;
    lessons?: string[];
    metadata: {
        clientId?: string;
        projectId?: string;
        tags: string[];
        urgencyReason?: string;
        escalationPath: string[];
    };
}
export interface TaskOutput {
    id: string;
    name: string;
    type: 'document' | 'decision' | 'analysis' | 'recommendation' | 'data' | 'approval';
    format: string;
    required: boolean;
    description: string;
    validationCriteria: string[];
}
export interface TaskContext {
    background: string;
    goals: string[];
    constraints: string[];
    stakeholders: string[];
    relatedTasks: string[];
    dependencies: string[];
    risks: string[];
    successCriteria: string[];
}
export interface TaskInstruction {
    step: number;
    action: string;
    details: string;
    tools?: string[];
    checkpoints?: string[];
    alternatives?: string[];
}
export interface TaskResource {
    id: string;
    name: string;
    type: 'document' | 'tool' | 'contact' | 'system' | 'data';
    location: string;
    description: string;
    accessInstructions?: string;
}
export interface TaskMilestone {
    id: string;
    name: string;
    description: string;
    targetDate: Date;
    completed: boolean;
    completedAt?: Date;
    deliverables: string[];
}
export interface QualityCheck {
    id: string;
    name: string;
    criteria: string;
    type: 'automatic' | 'manual';
    passed?: boolean;
    notes?: string;
    checkedAt?: Date;
}
export interface HumanOperator {
    id: string;
    name: string;
    email: string;
    role: string;
    skills: string[];
    expertise: string[];
    availability: OperatorAvailability;
    workload: number;
    performance: OperatorPerformance;
    preferences: OperatorPreferences;
    status: 'available' | 'busy' | 'offline' | 'vacation';
}
export interface OperatorAvailability {
    timezone: string;
    workingHours: {
        start: string;
        end: string;
    };
    workingDays: number[];
    vacationDates: Date[];
    currentCapacity: number;
}
export interface OperatorPerformance {
    completionRate: number;
    averageQuality: number;
    averageTime: number;
    tasksCompleted: number;
    expertiseAreas: string[];
    strengthsWeaknesses: {
        strengths: string[];
        improvementAreas: string[];
    };
}
export interface OperatorPreferences {
    preferredTaskTypes: string[];
    preferredComplexity: string[];
    communicationStyle: 'brief' | 'detailed' | 'visual';
    notificationChannels: string[];
    workingStyle: 'collaborative' | 'independent' | 'guided';
}
export interface DelegationStrategy {
    id: string;
    name: string;
    description: string;
    rules: DelegationRule[];
    priority: number;
    active: boolean;
}
export interface DelegationRule {
    condition: string;
    action: 'assign_to_role' | 'assign_to_person' | 'require_approval' | 'split_task' | 'escalate';
    parameters: any;
    weight: number;
}
export declare class TaskDelegationManager extends EventEmitter {
    private tasks;
    private operators;
    private strategies;
    private swarmMemory;
    private assignmentQueue;
    private processingInterval?;
    constructor(swarmMemory: SwarmMemory);
    private setupDefaultStrategies;
    delegateFromDecision(decision: HITLDecision, taskType: DelegatedTask['type'], customInstructions?: Partial<DelegatedTask>): Promise<DelegatedTask>;
    createTask(taskData: Partial<DelegatedTask> & {
        title: string;
        description: string;
        type: DelegatedTask['type'];
    }): Promise<DelegatedTask>;
    registerOperator(operator: HumanOperator): void;
    updateOperatorStatus(operatorId: string, status: HumanOperator['status']): void;
    private startProcessing;
    private processAssignmentQueue;
    private assignTask;
    private findBestOperator;
    private isOperatorEligible;
    private scoreOperatorForTask;
    private isOperatorAvailableForTask;
    startTask(taskId: string, operatorId: string): Promise<void>;
    updateTaskProgress(taskId: string, progress: number, notes?: string): Promise<void>;
    completeTask(taskId: string, outputs: any, feedback?: string, lessons?: string[]): Promise<void>;
    private escalateTaskAssignment;
    private mapPriorityFromDecision;
    private estimateTaskDuration;
    private calculateDeadline;
    private determineRequiredSkills;
    private determineRequiredRole;
    private assessComplexity;
    private generateExpectedOutputs;
    private buildTaskContext;
    private generateInstructions;
    private gatherResources;
    private generateMilestones;
    private generateQualityChecks;
    private shouldRequireReview;
    private determineUrgencyReason;
    private buildEscalationPath;
    private calculateWorkloadImpact;
    private updateOperatorPerformance;
    private checkMilestoneCompletion;
    private getMilestoneThreshold;
    private runQualityChecks;
    private runAutomaticQualityCheck;
    private increasePriority;
    private addStrategy;
    getTask(id: string): DelegatedTask | undefined;
    getTasksByStatus(status: DelegatedTask['status']): DelegatedTask[];
    getTasksForOperator(operatorId: string): DelegatedTask[];
    getOperator(id: string): HumanOperator | undefined;
    getOperators(): HumanOperator[];
    cancelTask(taskId: string, reason: string): Promise<void>;
    getDelegationAnalytics(): any;
    private calculateAverageCompletionTime;
    private calculateQualityMetrics;
    cleanup(): void;
}
//# sourceMappingURL=TaskDelegationManager.d.ts.map