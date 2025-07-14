import { EventEmitter } from 'events';
import { HITLDecision } from '../core/HITLOrchestrator';
import { DelegatedTask } from '../delegation/TaskDelegationManager';
import { WorkflowExecution } from '../review/ReviewWorkflowEngine';
import { SwarmMemory } from '../../../swarm/memory/SwarmMemory';
export interface ProgressSnapshot {
    id: string;
    timestamp: Date;
    type: 'decision' | 'task' | 'workflow' | 'system';
    entityId: string;
    status: string;
    progress: number;
    metrics: ProgressMetrics;
    context: any;
}
export interface ProgressMetrics {
    timeElapsed: number;
    estimatedTimeRemaining: number;
    completionRate: number;
    qualityScore?: number;
    riskLevel: string;
    stakeholderSatisfaction?: number;
    resourceUtilization: number;
    blockers: Blocker[];
    milestones: MilestoneStatus[];
}
export interface Blocker {
    id: string;
    type: 'resource' | 'approval' | 'information' | 'technical' | 'human';
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    identifiedAt: Date;
    resolvedAt?: Date;
    assignedTo?: string;
    estimatedResolutionTime?: number;
}
export interface MilestoneStatus {
    id: string;
    name: string;
    target: Date;
    actual?: Date;
    status: 'pending' | 'at_risk' | 'completed' | 'overdue';
    progress: number;
    dependencies: string[];
    criticalPath: boolean;
}
export interface TrackingConfiguration {
    snapshotInterval: number;
    alertThresholds: {
        timeOverrun: number;
        qualityBelow: number;
        riskAbove: string;
        stakeholderSatisfactionBelow: number;
    };
    escalationRules: EscalationRule[];
    reportingSchedule: ReportingSchedule[];
    retentionPolicy: {
        snapshotRetentionDays: number;
        detailedRetentionDays: number;
        archiveAfterDays: number;
    };
}
export interface EscalationRule {
    id: string;
    name: string;
    condition: string;
    action: 'notify' | 'escalate' | 'reassign' | 'abort';
    target: string;
    priority: number;
    cooldownMinutes: number;
}
export interface ReportingSchedule {
    id: string;
    name: string;
    frequency: 'realtime' | 'hourly' | 'daily' | 'weekly';
    recipients: string[];
    format: 'dashboard' | 'email' | 'slack' | 'webhook';
    filters: ReportFilter[];
}
export interface ReportFilter {
    field: string;
    operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
    value: any;
}
export interface SystemStatus {
    overall: 'healthy' | 'warning' | 'critical' | 'degraded';
    components: ComponentStatus[];
    performance: SystemPerformance;
    capacity: CapacityMetrics;
    alerts: Alert[];
    trends: TrendAnalysis[];
}
export interface ComponentStatus {
    name: string;
    status: 'online' | 'offline' | 'degraded' | 'maintenance';
    uptime: number;
    lastCheck: Date;
    metrics: any;
}
export interface SystemPerformance {
    averageResponseTime: number;
    throughput: number;
    errorRate: number;
    cpuUsage: number;
    memoryUsage: number;
    queueDepth: number;
}
export interface CapacityMetrics {
    totalOperators: number;
    availableOperators: number;
    operatorUtilization: number;
    pendingTasks: number;
    taskBacklog: number;
    estimatedCapacity: number;
}
export interface Alert {
    id: string;
    type: 'info' | 'warning' | 'error' | 'critical';
    title: string;
    description: string;
    source: string;
    timestamp: Date;
    acknowledged: boolean;
    resolvedAt?: Date;
    metadata: any;
}
export interface TrendAnalysis {
    metric: string;
    period: string;
    trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
    changeRate: number;
    prediction: number;
    confidence: number;
}
export declare class ProgressTracker extends EventEmitter {
    private snapshots;
    private blockers;
    private alerts;
    private swarmMemory;
    private config;
    private trackingInterval?;
    private lastEscalations;
    constructor(swarmMemory: SwarmMemory, config?: Partial<TrackingConfiguration>);
    private buildConfiguration;
    private startTracking;
    trackDecision(decision: HITLDecision): Promise<void>;
    trackTask(task: DelegatedTask): Promise<void>;
    trackWorkflow(execution: WorkflowExecution): Promise<void>;
    private createDecisionSnapshot;
    private createTaskSnapshot;
    private createWorkflowSnapshot;
    private captureSystemSnapshot;
    addBlocker(entityId: string, blocker: Omit<Blocker, 'id' | 'identifiedAt'>): Blocker;
    resolveBlocker(entityId: string, blockerId: string, resolution?: string): void;
    getCurrentStatus(entityId: string): ProgressSnapshot | null;
    getStatusHistory(entityId: string, limit?: number): ProgressSnapshot[];
    getSystemStatus(): Promise<SystemStatus>;
    generateStatusReport(startDate?: Date, endDate?: Date, filters?: ReportFilter[]): any;
    private addSnapshot;
    private calculateTimeElapsed;
    private estimateDecisionTime;
    private calculateDecisionProgress;
    private calculateDecisionCompletionRate;
    private checkAlerts;
    private checkEscalations;
    private createAlert;
    private isRiskAboveThreshold;
    private evaluateEscalationCondition;
    private executeEscalation;
    private assessDecisionQuality;
    private getStakeholderSatisfaction;
    private calculateResourceUtilization;
    private getDecisionBlockers;
    private getDecisionMilestones;
    private assessTaskQuality;
    private assessTaskRisk;
    private getTaskBlockers;
    private convertTaskMilestones;
    stopTracking(): void;
    getTrackingAnalytics(): any;
    acknowledgeAlert(alertId: string, acknowledgedBy: string): void;
    private updateTaskBlockers;
    private calculateWorkflowProgress;
    private calculateWorkflowCompletionRate;
    private estimateWorkflowTimeRemaining;
    private assessWorkflowQuality;
    private assessWorkflowRisk;
    private calculateWorkflowResourceUtilization;
    private getWorkflowBlockers;
    private getWorkflowMilestones;
    private calculateSystemProgress;
    private assessSystemRisk;
    private convertAlertsToBlockers;
    private calculateAverageResponseTime;
    private calculateErrorRate;
    private determineOverallStatus;
    private analyzeTrends;
    private applyFilters;
    private getFilterValue;
    private groupByType;
    private groupByStatus;
    private calculateAverageProgress;
    private calculateOverallCompletionRate;
    private calculateAverageTimeToComplete;
    private calculateQualityMetrics;
    private calculateQualityDistribution;
    private calculateEscalationRate;
    private getActiveBlockers;
    private getRecentAlerts;
    private analyzeRiskDistribution;
    private generateRecommendations;
    private calculateSystemHealth;
    private calculateAverageTimeOverrun;
}
//# sourceMappingURL=ProgressTracker.d.ts.map