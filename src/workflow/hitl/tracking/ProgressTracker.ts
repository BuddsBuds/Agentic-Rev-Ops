// Progress Tracker - Real-time tracking and reporting for HITL operations
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
  progress: number; // 0-100
  metrics: ProgressMetrics;
  context: any;
}

export interface ProgressMetrics {
  timeElapsed: number; // minutes
  estimatedTimeRemaining: number; // minutes
  completionRate: number; // 0-1
  qualityScore?: number; // 0-5
  riskLevel: string;
  stakeholderSatisfaction?: number; // 0-5
  resourceUtilization: number; // 0-1
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
  estimatedResolutionTime?: number; // minutes
}

export interface MilestoneStatus {
  id: string;
  name: string;
  target: Date;
  actual?: Date;
  status: 'pending' | 'at_risk' | 'completed' | 'overdue';
  progress: number; // 0-100
  dependencies: string[];
  criticalPath: boolean;
}

export interface TrackingConfiguration {
  snapshotInterval: number; // minutes
  alertThresholds: {
    timeOverrun: number; // percentage
    qualityBelow: number; // score
    riskAbove: string; // level
    stakeholderSatisfactionBelow: number; // score
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
  condition: string; // e.g., "timeOverrun > 50 && qualityScore < 3"
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
  uptime: number; // percentage
  lastCheck: Date;
  metrics: any;
}

export interface SystemPerformance {
  averageResponseTime: number; // ms
  throughput: number; // operations per minute
  errorRate: number; // percentage
  cpuUsage: number; // percentage
  memoryUsage: number; // percentage
  queueDepth: number;
}

export interface CapacityMetrics {
  totalOperators: number;
  availableOperators: number;
  operatorUtilization: number; // percentage
  pendingTasks: number;
  taskBacklog: number;
  estimatedCapacity: number; // tasks per hour
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
  changeRate: number; // percentage
  prediction: number;
  confidence: number; // 0-1
}

export class ProgressTracker extends EventEmitter {
  private snapshots: Map<string, ProgressSnapshot[]> = new Map();
  private blockers: Map<string, Blocker[]> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private swarmMemory: SwarmMemory;
  private config: TrackingConfiguration;
  private trackingInterval?: NodeJS.Timeout;
  private lastEscalations: Map<string, Date> = new Map();

  constructor(swarmMemory: SwarmMemory, config?: Partial<TrackingConfiguration>) {
    super();
    this.swarmMemory = swarmMemory;
    this.config = this.buildConfiguration(config);
    this.startTracking();
  }

  private buildConfiguration(config?: Partial<TrackingConfiguration>): TrackingConfiguration {
    return {
      snapshotInterval: 5, // 5 minutes
      alertThresholds: {
        timeOverrun: 25, // 25% over estimate
        qualityBelow: 3, // Quality score below 3
        riskAbove: 'high', // Risk level high or critical
        stakeholderSatisfactionBelow: 3 // Satisfaction below 3
      },
      escalationRules: [
        {
          id: 'critical-overrun',
          name: 'Critical Time Overrun',
          condition: 'timeOverrun > 50 && priority === "critical"',
          action: 'escalate',
          target: 'senior-manager',
          priority: 1,
          cooldownMinutes: 30
        },
        {
          id: 'quality-concern',
          name: 'Quality Below Threshold',
          condition: 'qualityScore < 2.5',
          action: 'notify',
          target: 'quality-team',
          priority: 2,
          cooldownMinutes: 60
        },
        {
          id: 'stakeholder-dissatisfaction',
          name: 'Low Stakeholder Satisfaction',
          condition: 'stakeholderSatisfaction < 2',
          action: 'escalate',
          target: 'client-success',
          priority: 1,
          cooldownMinutes: 15
        }
      ],
      reportingSchedule: [
        {
          id: 'hourly-status',
          name: 'Hourly Status Report',
          frequency: 'hourly',
          recipients: ['operations-team'],
          format: 'dashboard',
          filters: []
        },
        {
          id: 'daily-summary',
          name: 'Daily Summary',
          frequency: 'daily',
          recipients: ['management'],
          format: 'email',
          filters: [{ field: 'priority', operator: 'greater_than', value: 'medium' }]
        }
      ],
      retentionPolicy: {
        snapshotRetentionDays: 30,
        detailedRetentionDays: 90,
        archiveAfterDays: 365
      },
      ...config
    };
  }

  /**
   * Start automated progress tracking
   */
  private startTracking(): void {
    this.trackingInterval = setInterval(() => {
      this.captureSystemSnapshot();
    }, this.config.snapshotInterval * 60 * 1000);

    this.emit('tracking:started', { config: this.config });
  }

  /**
   * Track progress for an HITL decision
   */
  public async trackDecision(decision: HITLDecision): Promise<void> {
    const snapshot = await this.createDecisionSnapshot(decision);
    this.addSnapshot(decision.id, snapshot);

    // Check for alerts and escalations
    await this.checkAlerts(snapshot);
    await this.checkEscalations(snapshot);

    this.emit('decision:tracked', { decision, snapshot });
  }

  /**
   * Track progress for a delegated task
   */
  public async trackTask(task: DelegatedTask): Promise<void> {
    const snapshot = await this.createTaskSnapshot(task);
    this.addSnapshot(task.id, snapshot);

    // Update blockers
    await this.updateTaskBlockers(task);

    // Check for alerts and escalations
    await this.checkAlerts(snapshot);
    await this.checkEscalations(snapshot);

    this.emit('task:tracked', { task, snapshot });
  }

  /**
   * Track progress for a workflow execution
   */
  public async trackWorkflow(execution: WorkflowExecution): Promise<void> {
    const snapshot = await this.createWorkflowSnapshot(execution);
    this.addSnapshot(execution.id, snapshot);

    // Check for alerts and escalations
    await this.checkAlerts(snapshot);
    await this.checkEscalations(snapshot);

    this.emit('workflow:tracked', { execution, snapshot });
  }

  /**
   * Create snapshot for decision
   */
  private async createDecisionSnapshot(decision: HITLDecision): Promise<ProgressSnapshot> {
    const timeElapsed = this.calculateTimeElapsed(decision.metadata.createdAt);
    const estimatedTime = this.estimateDecisionTime(decision);
    
    return {
      id: `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      type: 'decision',
      entityId: decision.id,
      status: decision.status,
      progress: this.calculateDecisionProgress(decision),
      metrics: {
        timeElapsed,
        estimatedTimeRemaining: Math.max(0, estimatedTime - timeElapsed),
        completionRate: this.calculateDecisionCompletionRate(decision),
        qualityScore: await this.assessDecisionQuality(decision),
        riskLevel: decision.context.riskLevel,
        stakeholderSatisfaction: await this.getStakeholderSatisfaction(decision),
        resourceUtilization: await this.calculateResourceUtilization(decision),
        blockers: this.getDecisionBlockers(decision),
        milestones: this.getDecisionMilestones(decision)
      },
      context: {
        decision,
        swarmRecommendations: decision.context.recommendations,
        priority: decision.metadata.priority,
        type: decision.type
      }
    };
  }

  /**
   * Create snapshot for task
   */
  private async createTaskSnapshot(task: DelegatedTask): Promise<ProgressSnapshot> {
    const timeElapsed = task.startedAt ? 
      this.calculateTimeElapsed(task.startedAt) : 
      this.calculateTimeElapsed(task.delegatedAt);

    return {
      id: `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      type: 'task',
      entityId: task.id,
      status: task.status,
      progress: task.progress,
      metrics: {
        timeElapsed,
        estimatedTimeRemaining: Math.max(0, task.estimatedDuration - timeElapsed),
        completionRate: task.progress / 100,
        qualityScore: await this.assessTaskQuality(task),
        riskLevel: this.assessTaskRisk(task),
        resourceUtilization: task.assignedTo ? 1 : 0,
        blockers: this.getTaskBlockers(task),
        milestones: this.convertTaskMilestones(task.milestones)
      },
      context: {
        task,
        assignedTo: task.assignedTo,
        priority: task.priority,
        type: task.type,
        complexity: task.complexity
      }
    };
  }

  /**
   * Create snapshot for workflow
   */
  private async createWorkflowSnapshot(execution: WorkflowExecution): Promise<ProgressSnapshot> {
    const timeElapsed = this.calculateTimeElapsed(execution.startedAt);
    
    return {
      id: `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      type: 'workflow',
      entityId: execution.id,
      status: execution.status,
      progress: this.calculateWorkflowProgress(execution),
      metrics: {
        timeElapsed,
        estimatedTimeRemaining: this.estimateWorkflowTimeRemaining(execution),
        completionRate: this.calculateWorkflowCompletionRate(execution),
        qualityScore: await this.assessWorkflowQuality(execution),
        riskLevel: await this.assessWorkflowRisk(execution),
        resourceUtilization: this.calculateWorkflowResourceUtilization(execution),
        blockers: await this.getWorkflowBlockers(execution),
        milestones: await this.getWorkflowMilestones(execution)
      },
      context: {
        execution,
        workflowId: execution.workflowId,
        decisionId: execution.decisionId,
        currentStage: execution.currentStage
      }
    };
  }

  /**
   * Capture system-wide snapshot
   */
  private async captureSystemSnapshot(): Promise<void> {
    const systemStatus = await this.getSystemStatus();
    
    const snapshot: ProgressSnapshot = {
      id: `system-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      type: 'system',
      entityId: 'system',
      status: systemStatus.overall,
      progress: this.calculateSystemProgress(systemStatus),
      metrics: {
        timeElapsed: 0,
        estimatedTimeRemaining: 0,
        completionRate: systemStatus.performance.throughput / 100, // Normalize
        riskLevel: this.assessSystemRisk(systemStatus),
        resourceUtilization: systemStatus.capacity.operatorUtilization / 100,
        blockers: this.convertAlertsToBlockers(systemStatus.alerts),
        milestones: []
      },
      context: {
        systemStatus,
        componentCount: systemStatus.components.length,
        alertCount: systemStatus.alerts.length
      }
    };

    this.addSnapshot('system', snapshot);
    this.emit('system:tracked', { systemStatus, snapshot });
  }

  /**
   * Add blocker for entity
   */
  public addBlocker(entityId: string, blocker: Omit<Blocker, 'id' | 'identifiedAt'>): Blocker {
    const newBlocker: Blocker = {
      id: `blocker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      identifiedAt: new Date(),
      ...blocker
    };

    const entityBlockers = this.blockers.get(entityId) || [];
    entityBlockers.push(newBlocker);
    this.blockers.set(entityId, entityBlockers);

    this.emit('blocker:added', { entityId, blocker: newBlocker });
    return newBlocker;
  }

  /**
   * Resolve blocker
   */
  public resolveBlocker(entityId: string, blockerId: string, resolution?: string): void {
    const entityBlockers = this.blockers.get(entityId);
    if (!entityBlockers) return;

    const blocker = entityBlockers.find(b => b.id === blockerId);
    if (blocker) {
      blocker.resolvedAt = new Date();
      if (resolution) {
        blocker.description += ` | Resolution: ${resolution}`;
      }
      this.emit('blocker:resolved', { entityId, blocker, resolution });
    }
  }

  /**
   * Get current status for entity
   */
  public getCurrentStatus(entityId: string): ProgressSnapshot | null {
    const snapshots = this.snapshots.get(entityId);
    if (!snapshots || snapshots.length === 0) return null;
    
    return snapshots[snapshots.length - 1];
  }

  /**
   * Get status history for entity
   */
  public getStatusHistory(entityId: string, limit?: number): ProgressSnapshot[] {
    const snapshots = this.snapshots.get(entityId) || [];
    return limit ? snapshots.slice(-limit) : snapshots;
  }

  /**
   * Get system status
   */
  public async getSystemStatus(): Promise<SystemStatus> {
    // This would integrate with actual system monitoring
    // For now, we'll simulate based on tracked entities
    
    const allSnapshots = Array.from(this.snapshots.values()).flat();
    const recentSnapshots = allSnapshots.filter(s => 
      (Date.now() - s.timestamp.getTime()) < 60 * 60 * 1000 // Last hour
    );

    const components: ComponentStatus[] = [
      {
        name: 'HITL Orchestrator',
        status: 'online',
        uptime: 99.9,
        lastCheck: new Date(),
        metrics: { activeDecisions: recentSnapshots.filter(s => s.type === 'decision').length }
      },
      {
        name: 'Task Delegation',
        status: 'online',
        uptime: 99.8,
        lastCheck: new Date(),
        metrics: { activeTasks: recentSnapshots.filter(s => s.type === 'task').length }
      },
      {
        name: 'Workflow Engine',
        status: 'online',
        uptime: 99.7,
        lastCheck: new Date(),
        metrics: { activeWorkflows: recentSnapshots.filter(s => s.type === 'workflow').length }
      }
    ];

    const performance: SystemPerformance = {
      averageResponseTime: this.calculateAverageResponseTime(recentSnapshots),
      throughput: recentSnapshots.length,
      errorRate: this.calculateErrorRate(recentSnapshots),
      cpuUsage: 65, // Would come from actual monitoring
      memoryUsage: 78, // Would come from actual monitoring
      queueDepth: recentSnapshots.filter(s => s.status === 'pending').length
    };

    const capacity: CapacityMetrics = {
      totalOperators: 50, // Would come from operator registry
      availableOperators: 32, // Would come from operator registry
      operatorUtilization: 64,
      pendingTasks: recentSnapshots.filter(s => s.type === 'task' && s.status === 'pending').length,
      taskBacklog: recentSnapshots.filter(s => s.status === 'pending').length,
      estimatedCapacity: 85 // tasks per hour
    };

    const systemAlerts = Array.from(this.alerts.values())
      .filter(alert => !alert.acknowledged)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const overall = this.determineOverallStatus(components, performance, systemAlerts);

    return {
      overall,
      components,
      performance,
      capacity,
      alerts: systemAlerts,
      trends: this.analyzeTrends(recentSnapshots)
    };
  }

  /**
   * Generate status report
   */
  public generateStatusReport(
    startDate?: Date, 
    endDate?: Date, 
    filters?: ReportFilter[]
  ): any {
    const start = startDate || new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
    const end = endDate || new Date();

    let snapshots = Array.from(this.snapshots.values()).flat()
      .filter(s => s.timestamp >= start && s.timestamp <= end);

    // Apply filters
    if (filters) {
      snapshots = this.applyFilters(snapshots, filters);
    }

    return {
      period: { start, end },
      summary: {
        totalSnapshots: snapshots.length,
        byType: this.groupByType(snapshots),
        byStatus: this.groupByStatus(snapshots),
        averageProgress: this.calculateAverageProgress(snapshots)
      },
      performance: {
        completionRate: this.calculateOverallCompletionRate(snapshots),
        averageTimeToComplete: this.calculateAverageTimeToComplete(snapshots),
        qualityMetrics: this.calculateQualityMetrics(snapshots),
        escalationRate: this.calculateEscalationRate(snapshots)
      },
      issues: {
        activeBlockers: this.getActiveBlockers(),
        recentAlerts: this.getRecentAlerts(start),
        riskDistribution: this.analyzeRiskDistribution(snapshots)
      },
      trends: this.analyzeTrends(snapshots),
      recommendations: this.generateRecommendations(snapshots)
    };
  }

  // Helper methods for calculations and analysis

  private addSnapshot(entityId: string, snapshot: ProgressSnapshot): void {
    const entitySnapshots = this.snapshots.get(entityId) || [];
    entitySnapshots.push(snapshot);
    
    // Implement retention policy
    const retentionLimit = this.config.retentionPolicy.snapshotRetentionDays * 24 * 12; // 12 snapshots per day
    if (entitySnapshots.length > retentionLimit) {
      entitySnapshots.splice(0, entitySnapshots.length - retentionLimit);
    }
    
    this.snapshots.set(entityId, entitySnapshots);
  }

  private calculateTimeElapsed(startTime: Date): number {
    return Math.round((Date.now() - startTime.getTime()) / 60000); // minutes
  }

  private estimateDecisionTime(decision: HITLDecision): number {
    // Estimate based on decision complexity
    const baseTime = {
      'approval': 30,
      'review': 60,
      'strategic': 180,
      'validation': 45,
      'override': 15,
      'escalation': 120
    };
    
    let time = baseTime[decision.type] || 60;
    
    // Adjust for priority
    const priorityMultiplier = {
      'low': 1.5,
      'medium': 1.0,
      'high': 0.8,
      'critical': 0.5
    };
    
    time *= priorityMultiplier[decision.metadata.priority];
    
    // Adjust for complexity
    const recommendationCount = decision.context.recommendations.length;
    if (recommendationCount > 5) time *= 1.3;
    if (decision.context.riskLevel === 'high' || decision.context.riskLevel === 'critical') time *= 1.4;
    
    return Math.round(time);
  }

  private calculateDecisionProgress(decision: HITLDecision): number {
    const statusProgress = {
      'pending': 10,
      'in_review': 50,
      'approved': 90,
      'rejected': 100,
      'executed': 100,
      'cancelled': 100
    };
    
    return statusProgress[decision.status] || 0;
  }

  private calculateDecisionCompletionRate(decision: HITLDecision): number {
    return ['approved', 'executed', 'rejected'].includes(decision.status) ? 1 : 0;
  }

  private async checkAlerts(snapshot: ProgressSnapshot): Promise<void> {
    const metrics = snapshot.metrics;
    
    // Time overrun alert
    if (metrics.estimatedTimeRemaining < 0) {
      const overrun = Math.abs(metrics.estimatedTimeRemaining) / metrics.timeElapsed * 100;
      if (overrun > this.config.alertThresholds.timeOverrun) {
        this.createAlert('warning', 'Time Overrun Detected', 
          `Entity ${snapshot.entityId} is ${overrun.toFixed(1)}% over estimated time`,
          snapshot);
      }
    }
    
    // Quality alert
    if (metrics.qualityScore && metrics.qualityScore < this.config.alertThresholds.qualityBelow) {
      this.createAlert('error', 'Quality Below Threshold',
        `Entity ${snapshot.entityId} quality score (${metrics.qualityScore}) below threshold`,
        snapshot);
    }
    
    // Risk alert
    if (this.isRiskAboveThreshold(metrics.riskLevel, this.config.alertThresholds.riskAbove)) {
      this.createAlert('warning', 'High Risk Level',
        `Entity ${snapshot.entityId} has ${metrics.riskLevel} risk level`,
        snapshot);
    }
    
    // Stakeholder satisfaction alert
    if (metrics.stakeholderSatisfaction && 
        metrics.stakeholderSatisfaction < this.config.alertThresholds.stakeholderSatisfactionBelow) {
      this.createAlert('error', 'Low Stakeholder Satisfaction',
        `Entity ${snapshot.entityId} stakeholder satisfaction (${metrics.stakeholderSatisfaction}) below threshold`,
        snapshot);
    }
    
    // Blocker alerts
    const criticalBlockers = metrics.blockers.filter(b => b.severity === 'critical');
    if (criticalBlockers.length > 0) {
      this.createAlert('critical', 'Critical Blockers Detected',
        `Entity ${snapshot.entityId} has ${criticalBlockers.length} critical blockers`,
        snapshot);
    }
  }

  private async checkEscalations(snapshot: ProgressSnapshot): Promise<void> {
    for (const rule of this.config.escalationRules) {
      if (this.evaluateEscalationCondition(rule.condition, snapshot)) {
        const lastEscalation = this.lastEscalations.get(`${snapshot.entityId}-${rule.id}`);
        const cooldownExpired = !lastEscalation || 
          (Date.now() - lastEscalation.getTime()) > (rule.cooldownMinutes * 60 * 1000);
        
        if (cooldownExpired) {
          await this.executeEscalation(rule, snapshot);
          this.lastEscalations.set(`${snapshot.entityId}-${rule.id}`, new Date());
        }
      }
    }
  }

  private createAlert(
    type: Alert['type'], 
    title: string, 
    description: string, 
    snapshot: ProgressSnapshot
  ): void {
    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      description,
      source: `progress-tracker-${snapshot.type}`,
      timestamp: new Date(),
      acknowledged: false,
      metadata: {
        entityId: snapshot.entityId,
        snapshotId: snapshot.id,
        metrics: snapshot.metrics
      }
    };

    this.alerts.set(alert.id, alert);
    this.emit('alert:created', alert);
  }

  private isRiskAboveThreshold(currentRisk: string, threshold: string): boolean {
    const riskLevels = ['low', 'medium', 'high', 'critical'];
    const currentIndex = riskLevels.indexOf(currentRisk);
    const thresholdIndex = riskLevels.indexOf(threshold);
    return currentIndex >= thresholdIndex;
  }

  private evaluateEscalationCondition(condition: string, snapshot: ProgressSnapshot): boolean {
    // Simple evaluation - in practice would use a more robust expression evaluator
    const context = {
      timeOverrun: snapshot.metrics.estimatedTimeRemaining < 0 ? 
        Math.abs(snapshot.metrics.estimatedTimeRemaining) / snapshot.metrics.timeElapsed * 100 : 0,
      qualityScore: snapshot.metrics.qualityScore || 5,
      priority: snapshot.context?.priority || 'medium',
      stakeholderSatisfaction: snapshot.metrics.stakeholderSatisfaction || 5,
      riskLevel: snapshot.metrics.riskLevel
    };

    // This is a simplified evaluator - would use a proper expression engine in production
    try {
      return eval(condition.replace(/(\w+)/g, (match) => {
        const value = context[match as keyof typeof context];
        return typeof value === 'string' ? `"${value}"` : String(value);
      }));
    } catch {
      return false;
    }
  }

  private async executeEscalation(rule: EscalationRule, snapshot: ProgressSnapshot): Promise<void> {
    this.emit('escalation:triggered', {
      rule,
      snapshot,
      action: rule.action,
      target: rule.target
    });

    // Store escalation in memory
    await this.swarmMemory.store(`escalation:${snapshot.entityId}:${rule.id}`, {
      rule,
      snapshot,
      triggeredAt: new Date()
    });
  }

  // Additional calculation methods would continue here...
  // These are simplified implementations

  private async assessDecisionQuality(decision: HITLDecision): Promise<number> {
    // Quality assessment based on various factors
    let quality = 5; // Start with perfect score
    
    if (decision.context.confidence < 0.7) quality -= 1;
    if (decision.context.riskLevel === 'high') quality -= 0.5;
    if (decision.context.riskLevel === 'critical') quality -= 1;
    
    return Math.max(1, quality);
  }

  private async getStakeholderSatisfaction(decision: HITLDecision): Promise<number> {
    // In practice, this would query stakeholder feedback systems
    return 4.2; // Simulated score
  }

  private async calculateResourceUtilization(decision: HITLDecision): Promise<number> {
    // Calculate how much resources are being used for this decision
    return 0.75; // 75% utilization
  }

  private getDecisionBlockers(decision: HITLDecision): Blocker[] {
    return this.blockers.get(decision.id) || [];
  }

  private getDecisionMilestones(decision: HITLDecision): MilestoneStatus[] {
    // Convert decision stages to milestones
    return [
      {
        id: 'review-started',
        name: 'Review Started',
        target: new Date(decision.metadata.createdAt.getTime() + 30 * 60 * 1000),
        status: decision.status === 'in_review' ? 'completed' : 'pending',
        progress: decision.status === 'in_review' ? 100 : 0,
        dependencies: [],
        criticalPath: true
      },
      {
        id: 'decision-made',
        name: 'Decision Made',
        target: new Date(decision.metadata.createdAt.getTime() + 120 * 60 * 1000),
        status: ['approved', 'rejected', 'executed'].includes(decision.status) ? 'completed' : 'pending',
        progress: ['approved', 'rejected', 'executed'].includes(decision.status) ? 100 : 0,
        dependencies: ['review-started'],
        criticalPath: true
      }
    ];
  }

  private async assessTaskQuality(task: DelegatedTask): Promise<number> {
    if (task.qualityChecks.length === 0) return 4; // Default good quality
    
    const passedChecks = task.qualityChecks.filter(check => check.passed).length;
    return (passedChecks / task.qualityChecks.length) * 5;
  }

  private assessTaskRisk(task: DelegatedTask): string {
    if (task.priority === 'critical') return 'high';
    if (task.complexity === 'expert') return 'high';
    if (task.status === 'failed') return 'critical';
    return 'medium';
  }

  private getTaskBlockers(task: DelegatedTask): Blocker[] {
    return this.blockers.get(task.id) || [];
  }

  private convertTaskMilestones(taskMilestones: any[]): MilestoneStatus[] {
    return taskMilestones.map(tm => ({
      id: tm.id,
      name: tm.name,
      target: tm.targetDate,
      actual: tm.completedAt,
      status: tm.completed ? 'completed' : 
              (tm.targetDate < new Date() ? 'overdue' : 'pending') as any,
      progress: tm.completed ? 100 : 0,
      dependencies: [],
      criticalPath: false
    }));
  }

  // Cleanup and additional utility methods...

  /**
   * Stop tracking and cleanup
   */
  public stopTracking(): void {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = undefined;
    }
    this.emit('tracking:stopped');
  }

  /**
   * Get tracking analytics
   */
  public getTrackingAnalytics(): any {
    const allSnapshots = Array.from(this.snapshots.values()).flat();
    const recentSnapshots = allSnapshots.filter(s => 
      (Date.now() - s.timestamp.getTime()) < 24 * 60 * 60 * 1000
    );

    return {
      totalEntitiesTracked: this.snapshots.size,
      totalSnapshots: allSnapshots.length,
      recentActivity: recentSnapshots.length,
      activeAlerts: Array.from(this.alerts.values()).filter(a => !a.acknowledged).length,
      systemHealth: this.calculateSystemHealth(recentSnapshots)
    };
  }

  /**
   * Acknowledge alert
   */
  public acknowledgeAlert(alertId: string, acknowledgedBy: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.metadata.acknowledgedBy = acknowledgedBy;
      alert.metadata.acknowledgedAt = new Date();
      this.emit('alert:acknowledged', alert);
    }
  }

  /**
   * Update task blockers
   */
  private async updateTaskBlockers(task: DelegatedTask): Promise<void> {
    // Automatically detect common blockers
    const blockers: Blocker[] = [];

    if (task.status === 'pending' && !task.assignedTo) {
      blockers.push({
        id: `blocker-${Date.now()}-no-assignment`,
        type: 'resource',
        description: 'Task not assigned to any operator',
        severity: 'medium',
        identifiedAt: new Date()
      });
    }

    if (task.deadline && task.deadline < new Date() && task.status !== 'completed') {
      blockers.push({
        id: `blocker-${Date.now()}-overdue`,
        type: 'approval',
        description: 'Task past deadline',
        severity: 'high',
        identifiedAt: new Date()
      });
    }

    // Add new blockers
    const existingBlockers = this.blockers.get(task.id) || [];
    const newBlockers = blockers.filter(b => 
      !existingBlockers.some(eb => eb.description === b.description)
    );

    if (newBlockers.length > 0) {
      existingBlockers.push(...newBlockers);
      this.blockers.set(task.id, existingBlockers);
    }
  }

  // Additional helper methods for calculations
  private calculateWorkflowProgress(execution: WorkflowExecution): number {
    const statusProgress = {
      'pending': 0,
      'in_progress': 50,
      'completed': 100,
      'failed': 100,
      'cancelled': 100
    };
    return statusProgress[execution.status] || 0;
  }

  private calculateWorkflowCompletionRate(execution: WorkflowExecution): number {
    return execution.status === 'completed' ? 1 : 0;
  }

  private estimateWorkflowTimeRemaining(execution: WorkflowExecution): number {
    // Simplified estimation
    const elapsed = this.calculateTimeElapsed(execution.startedAt);
    const estimatedTotal = 180; // 3 hours default
    return Math.max(0, estimatedTotal - elapsed);
  }

  private async assessWorkflowQuality(execution: WorkflowExecution): Promise<number> {
    // Quality based on stage completion and timing
    return 4.0; // Simplified
  }

  private async assessWorkflowRisk(execution: WorkflowExecution): Promise<string> {
    return 'medium'; // Simplified
  }

  private calculateWorkflowResourceUtilization(execution: WorkflowExecution): number {
    return 0.8; // 80% utilization
  }

  private async getWorkflowBlockers(execution: WorkflowExecution): Promise<Blocker[]> {
    return this.blockers.get(execution.id) || [];
  }

  private async getWorkflowMilestones(execution: WorkflowExecution): Promise<MilestoneStatus[]> {
    return []; // Simplified
  }

  private calculateSystemProgress(systemStatus: SystemStatus): number {
    // System progress based on overall health
    const healthScores = { 'healthy': 100, 'warning': 75, 'degraded': 50, 'critical': 25 };
    return healthScores[systemStatus.overall] || 0;
  }

  private assessSystemRisk(systemStatus: SystemStatus): string {
    if (systemStatus.overall === 'critical') return 'critical';
    if (systemStatus.overall === 'degraded') return 'high';
    if (systemStatus.overall === 'warning') return 'medium';
    return 'low';
  }

  private convertAlertsToBlockers(alerts: Alert[]): Blocker[] {
    return alerts.map(alert => ({
      id: `blocker-${alert.id}`,
      type: 'technical' as const,
      description: alert.description,
      severity: alert.type === 'critical' ? 'critical' as const :
                alert.type === 'error' ? 'high' as const :
                alert.type === 'warning' ? 'medium' as const : 'low' as const,
      identifiedAt: alert.timestamp,
      resolvedAt: alert.resolvedAt
    }));
  }

  private calculateAverageResponseTime(snapshots: ProgressSnapshot[]): number {
    if (snapshots.length === 0) return 0;
    const totalTime = snapshots.reduce((sum, s) => sum + s.metrics.timeElapsed, 0);
    return totalTime / snapshots.length;
  }

  private calculateErrorRate(snapshots: ProgressSnapshot[]): number {
    if (snapshots.length === 0) return 0;
    const errors = snapshots.filter(s => s.status.includes('failed') || s.status.includes('error')).length;
    return (errors / snapshots.length) * 100;
  }

  private determineOverallStatus(
    components: ComponentStatus[], 
    performance: SystemPerformance, 
    alerts: Alert[]
  ): SystemStatus['overall'] {
    const criticalAlerts = alerts.filter(a => a.type === 'critical').length;
    const offlineComponents = components.filter(c => c.status === 'offline').length;
    
    if (criticalAlerts > 0 || offlineComponents > 0) return 'critical';
    if (performance.errorRate > 5) return 'degraded';
    if (alerts.filter(a => a.type === 'warning').length > 5) return 'warning';
    return 'healthy';
  }

  private analyzeTrends(snapshots: ProgressSnapshot[]): TrendAnalysis[] {
    // Simplified trend analysis
    return [
      {
        metric: 'completion_rate',
        period: '24h',
        trend: 'increasing',
        changeRate: 5.2,
        prediction: 0.92,
        confidence: 0.85
      }
    ];
  }

  private applyFilters(snapshots: ProgressSnapshot[], filters: ReportFilter[]): ProgressSnapshot[] {
    return snapshots.filter(snapshot => {
      return filters.every(filter => {
        const value = this.getFilterValue(snapshot, filter.field);
        switch (filter.operator) {
          case 'equals': return value === filter.value;
          case 'contains': return String(value).includes(String(filter.value));
          case 'greater_than': return Number(value) > Number(filter.value);
          case 'less_than': return Number(value) < Number(filter.value);
          default: return true;
        }
      });
    });
  }

  private getFilterValue(snapshot: ProgressSnapshot, field: string): any {
    const fieldMap: { [key: string]: any } = {
      'type': snapshot.type,
      'status': snapshot.status,
      'priority': snapshot.context?.priority,
      'progress': snapshot.progress,
      'risk_level': snapshot.metrics.riskLevel
    };
    return fieldMap[field];
  }

  private groupByType(snapshots: ProgressSnapshot[]): { [key: string]: number } {
    return snapshots.reduce((acc, s) => {
      acc[s.type] = (acc[s.type] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });
  }

  private groupByStatus(snapshots: ProgressSnapshot[]): { [key: string]: number } {
    return snapshots.reduce((acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });
  }

  private calculateAverageProgress(snapshots: ProgressSnapshot[]): number {
    if (snapshots.length === 0) return 0;
    return snapshots.reduce((sum, s) => sum + s.progress, 0) / snapshots.length;
  }

  private calculateOverallCompletionRate(snapshots: ProgressSnapshot[]): number {
    if (snapshots.length === 0) return 0;
    return snapshots.reduce((sum, s) => sum + s.metrics.completionRate, 0) / snapshots.length;
  }

  private calculateAverageTimeToComplete(snapshots: ProgressSnapshot[]): number {
    const completed = snapshots.filter(s => s.metrics.completionRate === 1);
    if (completed.length === 0) return 0;
    return completed.reduce((sum, s) => sum + s.metrics.timeElapsed, 0) / completed.length;
  }

  private calculateQualityMetrics(snapshots: ProgressSnapshot[]): any {
    const withQuality = snapshots.filter(s => s.metrics.qualityScore !== undefined);
    if (withQuality.length === 0) return { average: 0, distribution: {} };
    
    const average = withQuality.reduce((sum, s) => sum + (s.metrics.qualityScore || 0), 0) / withQuality.length;
    return { average, distribution: this.calculateQualityDistribution(withQuality) };
  }

  private calculateQualityDistribution(snapshots: ProgressSnapshot[]): { [key: string]: number } {
    return snapshots.reduce((acc, s) => {
      const score = Math.floor(s.metrics.qualityScore || 0);
      acc[`${score}-${score + 1}`] = (acc[`${score}-${score + 1}`] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });
  }

  private calculateEscalationRate(snapshots: ProgressSnapshot[]): number {
    // Count escalations in the snapshots
    const escalated = snapshots.filter(s => 
      s.context?.escalated || s.status.includes('escalated')
    ).length;
    return snapshots.length > 0 ? escalated / snapshots.length : 0;
  }

  private getActiveBlockers(): Blocker[] {
    return Array.from(this.blockers.values()).flat()
      .filter(b => !b.resolvedAt);
  }

  private getRecentAlerts(since: Date): Alert[] {
    return Array.from(this.alerts.values())
      .filter(a => a.timestamp >= since)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  private analyzeRiskDistribution(snapshots: ProgressSnapshot[]): { [key: string]: number } {
    return snapshots.reduce((acc, s) => {
      const risk = s.metrics.riskLevel;
      acc[risk] = (acc[risk] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });
  }

  private generateRecommendations(snapshots: ProgressSnapshot[]): string[] {
    const recommendations: string[] = [];
    
    const highRisk = snapshots.filter(s => s.metrics.riskLevel === 'high' || s.metrics.riskLevel === 'critical').length;
    if (highRisk > snapshots.length * 0.2) {
      recommendations.push('Consider reviewing risk assessment criteria - high proportion of high-risk items');
    }
    
    const overdue = snapshots.filter(s => s.metrics.estimatedTimeRemaining < 0).length;
    if (overdue > snapshots.length * 0.15) {
      recommendations.push('Review time estimation accuracy - many items are overdue');
    }
    
    const lowQuality = snapshots.filter(s => 
      s.metrics.qualityScore && s.metrics.qualityScore < 3
    ).length;
    if (lowQuality > snapshots.length * 0.1) {
      recommendations.push('Implement additional quality controls - quality scores below target');
    }
    
    return recommendations;
  }

  private calculateSystemHealth(snapshots: ProgressSnapshot[]): number {
    if (snapshots.length === 0) return 100;
    
    const healthFactors = {
      completionRate: this.calculateOverallCompletionRate(snapshots) * 30,
      timePerformance: Math.max(0, 100 - this.calculateAverageTimeOverrun(snapshots)) * 25,
      qualityScore: (this.calculateQualityMetrics(snapshots).average / 5) * 100 * 25,
      errorRate: Math.max(0, 100 - this.calculateErrorRate(snapshots)) * 20
    };
    
    return Object.values(healthFactors).reduce((sum, score) => sum + score, 0) / 100;
  }

  private calculateAverageTimeOverrun(snapshots: ProgressSnapshot[]): number {
    const overruns = snapshots
      .filter(s => s.metrics.estimatedTimeRemaining < 0)
      .map(s => Math.abs(s.metrics.estimatedTimeRemaining) / s.metrics.timeElapsed * 100);
    
    return overruns.length > 0 ? overruns.reduce((sum, o) => sum + o, 0) / overruns.length : 0;
  }
}