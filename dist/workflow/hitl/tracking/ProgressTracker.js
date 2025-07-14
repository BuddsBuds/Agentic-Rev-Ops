"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressTracker = void 0;
const events_1 = require("events");
class ProgressTracker extends events_1.EventEmitter {
    snapshots = new Map();
    blockers = new Map();
    alerts = new Map();
    swarmMemory;
    config;
    trackingInterval;
    lastEscalations = new Map();
    constructor(swarmMemory, config) {
        super();
        this.swarmMemory = swarmMemory;
        this.config = this.buildConfiguration(config);
        this.startTracking();
    }
    buildConfiguration(config) {
        return {
            snapshotInterval: 5,
            alertThresholds: {
                timeOverrun: 25,
                qualityBelow: 3,
                riskAbove: 'high',
                stakeholderSatisfactionBelow: 3
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
    startTracking() {
        this.trackingInterval = setInterval(() => {
            this.captureSystemSnapshot();
        }, this.config.snapshotInterval * 60 * 1000);
        this.emit('tracking:started', { config: this.config });
    }
    async trackDecision(decision) {
        const snapshot = await this.createDecisionSnapshot(decision);
        this.addSnapshot(decision.id, snapshot);
        await this.checkAlerts(snapshot);
        await this.checkEscalations(snapshot);
        this.emit('decision:tracked', { decision, snapshot });
    }
    async trackTask(task) {
        const snapshot = await this.createTaskSnapshot(task);
        this.addSnapshot(task.id, snapshot);
        await this.updateTaskBlockers(task);
        await this.checkAlerts(snapshot);
        await this.checkEscalations(snapshot);
        this.emit('task:tracked', { task, snapshot });
    }
    async trackWorkflow(execution) {
        const snapshot = await this.createWorkflowSnapshot(execution);
        this.addSnapshot(execution.id, snapshot);
        await this.checkAlerts(snapshot);
        await this.checkEscalations(snapshot);
        this.emit('workflow:tracked', { execution, snapshot });
    }
    async createDecisionSnapshot(decision) {
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
    async createTaskSnapshot(task) {
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
    async createWorkflowSnapshot(execution) {
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
    async captureSystemSnapshot() {
        const systemStatus = await this.getSystemStatus();
        const snapshot = {
            id: `system-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
            type: 'system',
            entityId: 'system',
            status: systemStatus.overall,
            progress: this.calculateSystemProgress(systemStatus),
            metrics: {
                timeElapsed: 0,
                estimatedTimeRemaining: 0,
                completionRate: systemStatus.performance.throughput / 100,
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
    addBlocker(entityId, blocker) {
        const newBlocker = {
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
    resolveBlocker(entityId, blockerId, resolution) {
        const entityBlockers = this.blockers.get(entityId);
        if (!entityBlockers)
            return;
        const blocker = entityBlockers.find(b => b.id === blockerId);
        if (blocker) {
            blocker.resolvedAt = new Date();
            if (resolution) {
                blocker.description += ` | Resolution: ${resolution}`;
            }
            this.emit('blocker:resolved', { entityId, blocker, resolution });
        }
    }
    getCurrentStatus(entityId) {
        const snapshots = this.snapshots.get(entityId);
        if (!snapshots || snapshots.length === 0)
            return null;
        return snapshots[snapshots.length - 1];
    }
    getStatusHistory(entityId, limit) {
        const snapshots = this.snapshots.get(entityId) || [];
        return limit ? snapshots.slice(-limit) : snapshots;
    }
    async getSystemStatus() {
        const allSnapshots = Array.from(this.snapshots.values()).flat();
        const recentSnapshots = allSnapshots.filter(s => (Date.now() - s.timestamp.getTime()) < 60 * 60 * 1000);
        const components = [
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
        const performance = {
            averageResponseTime: this.calculateAverageResponseTime(recentSnapshots),
            throughput: recentSnapshots.length,
            errorRate: this.calculateErrorRate(recentSnapshots),
            cpuUsage: 65,
            memoryUsage: 78,
            queueDepth: recentSnapshots.filter(s => s.status === 'pending').length
        };
        const capacity = {
            totalOperators: 50,
            availableOperators: 32,
            operatorUtilization: 64,
            pendingTasks: recentSnapshots.filter(s => s.type === 'task' && s.status === 'pending').length,
            taskBacklog: recentSnapshots.filter(s => s.status === 'pending').length,
            estimatedCapacity: 85
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
    generateStatusReport(startDate, endDate, filters) {
        const start = startDate || new Date(Date.now() - 24 * 60 * 60 * 1000);
        const end = endDate || new Date();
        let snapshots = Array.from(this.snapshots.values()).flat()
            .filter(s => s.timestamp >= start && s.timestamp <= end);
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
    addSnapshot(entityId, snapshot) {
        const entitySnapshots = this.snapshots.get(entityId) || [];
        entitySnapshots.push(snapshot);
        const retentionLimit = this.config.retentionPolicy.snapshotRetentionDays * 24 * 12;
        if (entitySnapshots.length > retentionLimit) {
            entitySnapshots.splice(0, entitySnapshots.length - retentionLimit);
        }
        this.snapshots.set(entityId, entitySnapshots);
    }
    calculateTimeElapsed(startTime) {
        return Math.round((Date.now() - startTime.getTime()) / 60000);
    }
    estimateDecisionTime(decision) {
        const baseTime = {
            'approval': 30,
            'review': 60,
            'strategic': 180,
            'validation': 45,
            'override': 15,
            'escalation': 120
        };
        let time = baseTime[decision.type] || 60;
        const priorityMultiplier = {
            'low': 1.5,
            'medium': 1.0,
            'high': 0.8,
            'critical': 0.5
        };
        time *= priorityMultiplier[decision.metadata.priority];
        const recommendationCount = decision.context.recommendations.length;
        if (recommendationCount > 5)
            time *= 1.3;
        if (decision.context.riskLevel === 'high' || decision.context.riskLevel === 'critical')
            time *= 1.4;
        return Math.round(time);
    }
    calculateDecisionProgress(decision) {
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
    calculateDecisionCompletionRate(decision) {
        return ['approved', 'executed', 'rejected'].includes(decision.status) ? 1 : 0;
    }
    async checkAlerts(snapshot) {
        const metrics = snapshot.metrics;
        if (metrics.estimatedTimeRemaining < 0) {
            const overrun = Math.abs(metrics.estimatedTimeRemaining) / metrics.timeElapsed * 100;
            if (overrun > this.config.alertThresholds.timeOverrun) {
                this.createAlert('warning', 'Time Overrun Detected', `Entity ${snapshot.entityId} is ${overrun.toFixed(1)}% over estimated time`, snapshot);
            }
        }
        if (metrics.qualityScore && metrics.qualityScore < this.config.alertThresholds.qualityBelow) {
            this.createAlert('error', 'Quality Below Threshold', `Entity ${snapshot.entityId} quality score (${metrics.qualityScore}) below threshold`, snapshot);
        }
        if (this.isRiskAboveThreshold(metrics.riskLevel, this.config.alertThresholds.riskAbove)) {
            this.createAlert('warning', 'High Risk Level', `Entity ${snapshot.entityId} has ${metrics.riskLevel} risk level`, snapshot);
        }
        if (metrics.stakeholderSatisfaction &&
            metrics.stakeholderSatisfaction < this.config.alertThresholds.stakeholderSatisfactionBelow) {
            this.createAlert('error', 'Low Stakeholder Satisfaction', `Entity ${snapshot.entityId} stakeholder satisfaction (${metrics.stakeholderSatisfaction}) below threshold`, snapshot);
        }
        const criticalBlockers = metrics.blockers.filter(b => b.severity === 'critical');
        if (criticalBlockers.length > 0) {
            this.createAlert('critical', 'Critical Blockers Detected', `Entity ${snapshot.entityId} has ${criticalBlockers.length} critical blockers`, snapshot);
        }
    }
    async checkEscalations(snapshot) {
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
    createAlert(type, title, description, snapshot) {
        const alert = {
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
    isRiskAboveThreshold(currentRisk, threshold) {
        const riskLevels = ['low', 'medium', 'high', 'critical'];
        const currentIndex = riskLevels.indexOf(currentRisk);
        const thresholdIndex = riskLevels.indexOf(threshold);
        return currentIndex >= thresholdIndex;
    }
    evaluateEscalationCondition(condition, snapshot) {
        const context = {
            timeOverrun: snapshot.metrics.estimatedTimeRemaining < 0 ?
                Math.abs(snapshot.metrics.estimatedTimeRemaining) / snapshot.metrics.timeElapsed * 100 : 0,
            qualityScore: snapshot.metrics.qualityScore || 5,
            priority: snapshot.context?.priority || 'medium',
            stakeholderSatisfaction: snapshot.metrics.stakeholderSatisfaction || 5,
            riskLevel: snapshot.metrics.riskLevel
        };
        try {
            return eval(condition.replace(/(\w+)/g, (match) => {
                const value = context[match];
                return typeof value === 'string' ? `"${value}"` : String(value);
            }));
        }
        catch {
            return false;
        }
    }
    async executeEscalation(rule, snapshot) {
        this.emit('escalation:triggered', {
            rule,
            snapshot,
            action: rule.action,
            target: rule.target
        });
        await this.swarmMemory.store(`escalation:${snapshot.entityId}:${rule.id}`, {
            rule,
            snapshot,
            triggeredAt: new Date()
        });
    }
    async assessDecisionQuality(decision) {
        let quality = 5;
        if (decision.context.confidence < 0.7)
            quality -= 1;
        if (decision.context.riskLevel === 'high')
            quality -= 0.5;
        if (decision.context.riskLevel === 'critical')
            quality -= 1;
        return Math.max(1, quality);
    }
    async getStakeholderSatisfaction(decision) {
        return 4.2;
    }
    async calculateResourceUtilization(decision) {
        return 0.75;
    }
    getDecisionBlockers(decision) {
        return this.blockers.get(decision.id) || [];
    }
    getDecisionMilestones(decision) {
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
    async assessTaskQuality(task) {
        if (task.qualityChecks.length === 0)
            return 4;
        const passedChecks = task.qualityChecks.filter(check => check.passed).length;
        return (passedChecks / task.qualityChecks.length) * 5;
    }
    assessTaskRisk(task) {
        if (task.priority === 'critical')
            return 'high';
        if (task.complexity === 'expert')
            return 'high';
        if (task.status === 'failed')
            return 'critical';
        return 'medium';
    }
    getTaskBlockers(task) {
        return this.blockers.get(task.id) || [];
    }
    convertTaskMilestones(taskMilestones) {
        return taskMilestones.map(tm => ({
            id: tm.id,
            name: tm.name,
            target: tm.targetDate,
            actual: tm.completedAt,
            status: tm.completed ? 'completed' :
                (tm.targetDate < new Date() ? 'overdue' : 'pending'),
            progress: tm.completed ? 100 : 0,
            dependencies: [],
            criticalPath: false
        }));
    }
    stopTracking() {
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
            this.trackingInterval = undefined;
        }
        this.emit('tracking:stopped');
    }
    getTrackingAnalytics() {
        const allSnapshots = Array.from(this.snapshots.values()).flat();
        const recentSnapshots = allSnapshots.filter(s => (Date.now() - s.timestamp.getTime()) < 24 * 60 * 60 * 1000);
        return {
            totalEntitiesTracked: this.snapshots.size,
            totalSnapshots: allSnapshots.length,
            recentActivity: recentSnapshots.length,
            activeAlerts: Array.from(this.alerts.values()).filter(a => !a.acknowledged).length,
            systemHealth: this.calculateSystemHealth(recentSnapshots)
        };
    }
    acknowledgeAlert(alertId, acknowledgedBy) {
        const alert = this.alerts.get(alertId);
        if (alert) {
            alert.acknowledged = true;
            alert.metadata.acknowledgedBy = acknowledgedBy;
            alert.metadata.acknowledgedAt = new Date();
            this.emit('alert:acknowledged', alert);
        }
    }
    async updateTaskBlockers(task) {
        const blockers = [];
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
        const existingBlockers = this.blockers.get(task.id) || [];
        const newBlockers = blockers.filter(b => !existingBlockers.some(eb => eb.description === b.description));
        if (newBlockers.length > 0) {
            existingBlockers.push(...newBlockers);
            this.blockers.set(task.id, existingBlockers);
        }
    }
    calculateWorkflowProgress(execution) {
        const statusProgress = {
            'pending': 0,
            'in_progress': 50,
            'completed': 100,
            'failed': 100,
            'cancelled': 100
        };
        return statusProgress[execution.status] || 0;
    }
    calculateWorkflowCompletionRate(execution) {
        return execution.status === 'completed' ? 1 : 0;
    }
    estimateWorkflowTimeRemaining(execution) {
        const elapsed = this.calculateTimeElapsed(execution.startedAt);
        const estimatedTotal = 180;
        return Math.max(0, estimatedTotal - elapsed);
    }
    async assessWorkflowQuality(execution) {
        return 4.0;
    }
    async assessWorkflowRisk(execution) {
        return 'medium';
    }
    calculateWorkflowResourceUtilization(execution) {
        return 0.8;
    }
    async getWorkflowBlockers(execution) {
        return this.blockers.get(execution.id) || [];
    }
    async getWorkflowMilestones(execution) {
        return [];
    }
    calculateSystemProgress(systemStatus) {
        const healthScores = { 'healthy': 100, 'warning': 75, 'degraded': 50, 'critical': 25 };
        return healthScores[systemStatus.overall] || 0;
    }
    assessSystemRisk(systemStatus) {
        if (systemStatus.overall === 'critical')
            return 'critical';
        if (systemStatus.overall === 'degraded')
            return 'high';
        if (systemStatus.overall === 'warning')
            return 'medium';
        return 'low';
    }
    convertAlertsToBlockers(alerts) {
        return alerts.map(alert => ({
            id: `blocker-${alert.id}`,
            type: 'technical',
            description: alert.description,
            severity: alert.type === 'critical' ? 'critical' :
                alert.type === 'error' ? 'high' :
                    alert.type === 'warning' ? 'medium' : 'low',
            identifiedAt: alert.timestamp,
            resolvedAt: alert.resolvedAt
        }));
    }
    calculateAverageResponseTime(snapshots) {
        if (snapshots.length === 0)
            return 0;
        const totalTime = snapshots.reduce((sum, s) => sum + s.metrics.timeElapsed, 0);
        return totalTime / snapshots.length;
    }
    calculateErrorRate(snapshots) {
        if (snapshots.length === 0)
            return 0;
        const errors = snapshots.filter(s => s.status.includes('failed') || s.status.includes('error')).length;
        return (errors / snapshots.length) * 100;
    }
    determineOverallStatus(components, performance, alerts) {
        const criticalAlerts = alerts.filter(a => a.type === 'critical').length;
        const offlineComponents = components.filter(c => c.status === 'offline').length;
        if (criticalAlerts > 0 || offlineComponents > 0)
            return 'critical';
        if (performance.errorRate > 5)
            return 'degraded';
        if (alerts.filter(a => a.type === 'warning').length > 5)
            return 'warning';
        return 'healthy';
    }
    analyzeTrends(snapshots) {
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
    applyFilters(snapshots, filters) {
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
    getFilterValue(snapshot, field) {
        const fieldMap = {
            'type': snapshot.type,
            'status': snapshot.status,
            'priority': snapshot.context?.priority,
            'progress': snapshot.progress,
            'risk_level': snapshot.metrics.riskLevel
        };
        return fieldMap[field];
    }
    groupByType(snapshots) {
        return snapshots.reduce((acc, s) => {
            acc[s.type] = (acc[s.type] || 0) + 1;
            return acc;
        }, {});
    }
    groupByStatus(snapshots) {
        return snapshots.reduce((acc, s) => {
            acc[s.status] = (acc[s.status] || 0) + 1;
            return acc;
        }, {});
    }
    calculateAverageProgress(snapshots) {
        if (snapshots.length === 0)
            return 0;
        return snapshots.reduce((sum, s) => sum + s.progress, 0) / snapshots.length;
    }
    calculateOverallCompletionRate(snapshots) {
        if (snapshots.length === 0)
            return 0;
        return snapshots.reduce((sum, s) => sum + s.metrics.completionRate, 0) / snapshots.length;
    }
    calculateAverageTimeToComplete(snapshots) {
        const completed = snapshots.filter(s => s.metrics.completionRate === 1);
        if (completed.length === 0)
            return 0;
        return completed.reduce((sum, s) => sum + s.metrics.timeElapsed, 0) / completed.length;
    }
    calculateQualityMetrics(snapshots) {
        const withQuality = snapshots.filter(s => s.metrics.qualityScore !== undefined);
        if (withQuality.length === 0)
            return { average: 0, distribution: {} };
        const average = withQuality.reduce((sum, s) => sum + (s.metrics.qualityScore || 0), 0) / withQuality.length;
        return { average, distribution: this.calculateQualityDistribution(withQuality) };
    }
    calculateQualityDistribution(snapshots) {
        return snapshots.reduce((acc, s) => {
            const score = Math.floor(s.metrics.qualityScore || 0);
            acc[`${score}-${score + 1}`] = (acc[`${score}-${score + 1}`] || 0) + 1;
            return acc;
        }, {});
    }
    calculateEscalationRate(snapshots) {
        const escalated = snapshots.filter(s => s.context?.escalated || s.status.includes('escalated')).length;
        return snapshots.length > 0 ? escalated / snapshots.length : 0;
    }
    getActiveBlockers() {
        return Array.from(this.blockers.values()).flat()
            .filter(b => !b.resolvedAt);
    }
    getRecentAlerts(since) {
        return Array.from(this.alerts.values())
            .filter(a => a.timestamp >= since)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    analyzeRiskDistribution(snapshots) {
        return snapshots.reduce((acc, s) => {
            const risk = s.metrics.riskLevel;
            acc[risk] = (acc[risk] || 0) + 1;
            return acc;
        }, {});
    }
    generateRecommendations(snapshots) {
        const recommendations = [];
        const highRisk = snapshots.filter(s => s.metrics.riskLevel === 'high' || s.metrics.riskLevel === 'critical').length;
        if (highRisk > snapshots.length * 0.2) {
            recommendations.push('Consider reviewing risk assessment criteria - high proportion of high-risk items');
        }
        const overdue = snapshots.filter(s => s.metrics.estimatedTimeRemaining < 0).length;
        if (overdue > snapshots.length * 0.15) {
            recommendations.push('Review time estimation accuracy - many items are overdue');
        }
        const lowQuality = snapshots.filter(s => s.metrics.qualityScore && s.metrics.qualityScore < 3).length;
        if (lowQuality > snapshots.length * 0.1) {
            recommendations.push('Implement additional quality controls - quality scores below target');
        }
        return recommendations;
    }
    calculateSystemHealth(snapshots) {
        if (snapshots.length === 0)
            return 100;
        const healthFactors = {
            completionRate: this.calculateOverallCompletionRate(snapshots) * 30,
            timePerformance: Math.max(0, 100 - this.calculateAverageTimeOverrun(snapshots)) * 25,
            qualityScore: (this.calculateQualityMetrics(snapshots).average / 5) * 100 * 25,
            errorRate: Math.max(0, 100 - this.calculateErrorRate(snapshots)) * 20
        };
        return Object.values(healthFactors).reduce((sum, score) => sum + score, 0) / 100;
    }
    calculateAverageTimeOverrun(snapshots) {
        const overruns = snapshots
            .filter(s => s.metrics.estimatedTimeRemaining < 0)
            .map(s => Math.abs(s.metrics.estimatedTimeRemaining) / s.metrics.timeElapsed * 100);
        return overruns.length > 0 ? overruns.reduce((sum, o) => sum + o, 0) / overruns.length : 0;
    }
}
exports.ProgressTracker = ProgressTracker;
//# sourceMappingURL=ProgressTracker.js.map