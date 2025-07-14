"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HITLSystem = void 0;
const events_1 = require("events");
const HITLOrchestrator_1 = require("./core/HITLOrchestrator");
const TaskDelegationManager_1 = require("./delegation/TaskDelegationManager");
const ReviewWorkflowEngine_1 = require("./review/ReviewWorkflowEngine");
const ProgressTracker_1 = require("./tracking/ProgressTracker");
const SwarmIntegration_1 = require("./integration/SwarmIntegration");
const hitl_manager_1 = require("./interfaces/hitl-manager");
class HITLSystem extends events_1.EventEmitter {
    config;
    swarmMemory;
    swarmCoordinator;
    hitlManager;
    orchestrator;
    delegationManager;
    workflowEngine;
    progressTracker;
    swarmIntegration;
    status = 'initializing';
    startTime = new Date();
    healthCheckInterval;
    metrics;
    alerts = new Map();
    constructor(swarmMemory, swarmCoordinator, config = {}) {
        super();
        this.swarmMemory = swarmMemory;
        this.swarmCoordinator = swarmCoordinator;
        this.config = this.buildConfig(config);
        this.metrics = this.initializeMetrics();
        this.hitlManager = new hitl_manager_1.HumanInTheLoopManager();
        this.setupEventHandlers();
    }
    buildConfig(config) {
        return {
            orchestrator: {
                autoApprovalThreshold: 0.9,
                escalationThreshold: 0.5,
                reviewTimeoutMinutes: 120,
                criticalDecisionRequiresApproval: true,
                financialImpactThreshold: 50000,
                enableLearningFromDecisions: true,
                ...config.orchestrator
            },
            tracking: {
                snapshotInterval: 5,
                alertThresholds: {
                    timeOverrun: 25,
                    qualityBelow: 3,
                    riskAbove: 'high',
                    stakeholderSatisfactionBelow: 3
                },
                ...config.tracking
            },
            swarmIntegration: {
                enableAutomaticDecisionRouting: true,
                confidenceThresholds: {
                    autoApprove: 0.9,
                    requireHuman: 0.7,
                    escalate: 0.5
                },
                ...config.swarmIntegration
            },
            enableComponents: {
                orchestrator: true,
                delegation: true,
                workflows: true,
                tracking: true,
                swarmIntegration: true,
                ...config.enableComponents
            },
            systemSettings: {
                name: 'HITL System',
                version: '1.0.0',
                environment: 'development',
                logLevel: 'info',
                enableTelemetry: true,
                backupEnabled: true,
                maintenanceMode: false,
                ...config.systemSettings
            }
        };
    }
    initializeMetrics() {
        return {
            totalDecisions: 0,
            totalTasks: 0,
            totalWorkflows: 0,
            averageResolutionTime: 0,
            successRate: 1.0,
            currentLoad: 0,
            performanceScore: 100,
            resourceUtilization: {
                cpu: 0,
                memory: 0,
                operators: 0
            }
        };
    }
    async initialize() {
        try {
            this.log('info', 'Initializing HITL System...');
            await this.hitlManager.initialize();
            this.log('info', 'HITL Manager initialized');
            if (this.config.enableComponents.orchestrator) {
                await this.initializeOrchestrator();
            }
            if (this.config.enableComponents.delegation) {
                await this.initializeDelegationManager();
            }
            if (this.config.enableComponents.workflows) {
                await this.initializeWorkflowEngine();
            }
            if (this.config.enableComponents.tracking) {
                await this.initializeProgressTracker();
            }
            if (this.config.enableComponents.swarmIntegration) {
                await this.initializeSwarmIntegration();
            }
            this.startHealthMonitoring();
            await this.swarmMemory.store('hitl:system:initialized', {
                config: this.config,
                timestamp: new Date(),
                components: Object.keys(this.config.enableComponents).filter(key => this.config.enableComponents[key])
            });
            this.status = 'running';
            this.log('info', 'HITL System initialization complete');
            this.emit('system:initialized', this.getSystemStatus());
        }
        catch (error) {
            this.status = 'degraded';
            this.log('error', 'HITL System initialization failed', error);
            this.createAlert('critical', 'system', 'System initialization failed', { error });
            throw error;
        }
    }
    async initializeOrchestrator() {
        this.orchestrator = new HITLOrchestrator_1.HITLOrchestrator(this.hitlManager, this.swarmMemory, this.swarmCoordinator, this.config.orchestrator);
        this.orchestrator.on('decision:created', (decision) => {
            this.metrics.totalDecisions++;
            this.emit('decision:created', decision);
        });
        this.orchestrator.on('decision:executed', (data) => {
            this.updateSuccessMetrics(true);
            this.emit('decision:executed', data);
        });
        this.orchestrator.on('decision:rejected', (data) => {
            this.updateSuccessMetrics(false);
            this.emit('decision:rejected', data);
        });
        this.log('info', 'HITL Orchestrator initialized');
    }
    async initializeDelegationManager() {
        this.delegationManager = new TaskDelegationManager_1.TaskDelegationManager(this.swarmMemory);
        this.delegationManager.on('task:created', (task) => {
            this.metrics.totalTasks++;
            this.emit('task:created', task);
        });
        this.delegationManager.on('task:completed', (data) => {
            this.updateTaskMetrics(data.task);
            this.emit('task:completed', data);
        });
        this.delegationManager.on('task:failed', (data) => {
            this.createAlert('warning', 'delegation', `Task ${data.task.id} failed`, data);
            this.emit('task:failed', data);
        });
        this.log('info', 'Task Delegation Manager initialized');
    }
    async initializeWorkflowEngine() {
        if (!this.orchestrator) {
            throw new Error('Orchestrator must be initialized before Workflow Engine');
        }
        this.workflowEngine = new ReviewWorkflowEngine_1.ReviewWorkflowEngine(this.orchestrator, this.swarmMemory);
        this.workflowEngine.on('workflow:started', (data) => {
            this.metrics.totalWorkflows++;
            this.emit('workflow:started', data);
        });
        this.workflowEngine.on('workflow:completed', (data) => {
            this.updateWorkflowMetrics(data.execution);
            this.emit('workflow:completed', data);
        });
        this.workflowEngine.on('stage:timeout', (data) => {
            this.createAlert('warning', 'workflow', `Workflow stage timeout: ${data.stage.name}`, data);
            this.emit('stage:timeout', data);
        });
        this.log('info', 'Review Workflow Engine initialized');
    }
    async initializeProgressTracker() {
        this.progressTracker = new ProgressTracker_1.ProgressTracker(this.swarmMemory, this.config.tracking);
        this.progressTracker.on('alert:created', (alert) => {
            this.handleProgressAlert(alert);
            this.emit('alert:created', alert);
        });
        this.progressTracker.on('escalation:triggered', (data) => {
            this.createAlert('warning', 'tracking', 'Escalation triggered', data);
            this.emit('escalation:triggered', data);
        });
        this.log('info', 'Progress Tracker initialized');
    }
    async initializeSwarmIntegration() {
        if (!this.orchestrator || !this.delegationManager || !this.workflowEngine || !this.progressTracker) {
            throw new Error('All core components must be initialized before Swarm Integration');
        }
        this.swarmIntegration = new SwarmIntegration_1.SwarmIntegration(this.orchestrator, this.delegationManager, this.workflowEngine, this.progressTracker, this.swarmCoordinator, this.swarmMemory, this.config.swarmIntegration);
        this.swarmIntegration.on('swarm:decisionRequested', (request) => {
            this.emit('swarm:decisionRequested', request);
        });
        this.swarmIntegration.on('decision:autoApproved', (data) => {
            this.updateAutoApprovalMetrics();
            this.emit('decision:autoApproved', data);
        });
        this.swarmIntegration.on('agent:emergencyOverride', (data) => {
            this.createAlert('critical', 'swarm', 'Emergency override executed', data);
            this.emit('agent:emergencyOverride', data);
        });
        this.log('info', 'Swarm Integration initialized');
    }
    startHealthMonitoring() {
        this.healthCheckInterval = setInterval(async () => {
            await this.performHealthCheck();
        }, 30000);
        this.log('info', 'Health monitoring started');
    }
    async performHealthCheck() {
        try {
            const status = this.getSystemStatus();
            const degradedComponents = Object.values(status.components)
                .filter(comp => comp.status === 'degraded' || comp.status === 'error');
            if (degradedComponents.length > 0) {
                this.status = 'degraded';
                this.createAlert('warning', 'system', `${degradedComponents.length} components degraded`, { components: degradedComponents.map(c => c.name) });
            }
            else if (this.status === 'degraded') {
                this.status = 'running';
                this.log('info', 'System health restored');
            }
            this.updatePerformanceMetrics(status);
            if (this.config.systemSettings.enableTelemetry) {
                await this.swarmMemory.store(`hitl:health:${Date.now()}`, {
                    status,
                    timestamp: new Date()
                });
            }
            this.emit('health:checked', status);
        }
        catch (error) {
            this.log('error', 'Health check failed', error);
            this.createAlert('error', 'system', 'Health check failed', { error });
        }
    }
    getSystemStatus() {
        const now = new Date();
        const uptime = Math.round((now.getTime() - this.startTime.getTime()) / 1000);
        return {
            status: this.status,
            uptime,
            components: {
                orchestrator: this.getComponentStatus('orchestrator', this.orchestrator),
                delegation: this.getComponentStatus('delegation', this.delegationManager),
                workflows: this.getComponentStatus('workflows', this.workflowEngine),
                tracking: this.getComponentStatus('tracking', this.progressTracker),
                swarmIntegration: this.getComponentStatus('swarmIntegration', this.swarmIntegration)
            },
            metrics: { ...this.metrics },
            alerts: Array.from(this.alerts.values()).filter(alert => !alert.acknowledged),
            lastHealthCheck: now
        };
    }
    getComponentStatus(name, component) {
        if (!this.config.enableComponents[name]) {
            return {
                name,
                status: 'offline',
                uptime: 0,
                metrics: {}
            };
        }
        if (!component) {
            return {
                name,
                status: 'error',
                uptime: 0,
                lastError: new Error(`${name} not initialized`),
                metrics: {}
            };
        }
        let status = 'online';
        let metrics = {};
        try {
            switch (name) {
                case 'orchestrator':
                    metrics = {
                        pendingDecisions: this.orchestrator?.getPendingDecisions()?.length || 0,
                        totalDecisions: this.metrics.totalDecisions
                    };
                    break;
                case 'delegation':
                    metrics = {
                        pendingTasks: this.delegationManager?.getTasksByStatus('pending')?.length || 0,
                        activeTasks: this.delegationManager?.getTasksByStatus('in_progress')?.length || 0,
                        totalTasks: this.metrics.totalTasks
                    };
                    break;
                case 'workflows':
                    metrics = {
                        activeWorkflows: this.workflowEngine?.getActiveExecutions()?.length || 0,
                        totalWorkflows: this.metrics.totalWorkflows
                    };
                    break;
                case 'tracking':
                    const trackingAnalytics = this.progressTracker?.getTrackingAnalytics() || {};
                    metrics = {
                        entitiesTracked: trackingAnalytics.totalEntitiesTracked || 0,
                        activeAlerts: trackingAnalytics.activeAlerts || 0,
                        systemHealth: trackingAnalytics.systemHealth || 100
                    };
                    if (trackingAnalytics.systemHealth < 80)
                        status = 'degraded';
                    break;
                case 'swarmIntegration':
                    const integrationStatus = this.swarmIntegration?.getIntegrationStatus() || {};
                    metrics = {
                        pendingDecisions: integrationStatus.pendingDecisions || 0,
                        activeOverrides: integrationStatus.activeOverrides || 0,
                        learningDataCount: integrationStatus.learningDataCount || 0
                    };
                    break;
            }
        }
        catch (error) {
            status = 'error';
            metrics = { error: error instanceof Error ? error.message : String(error) };
        }
        return {
            name,
            status,
            uptime: Math.round((Date.now() - this.startTime.getTime()) / 1000),
            metrics
        };
    }
    async processSwarmDecision(request) {
        if (!this.swarmIntegration) {
            throw new Error('Swarm Integration not enabled');
        }
        this.log('info', `Processing swarm decision request from agent ${request.agentId}`);
        return await this.swarmIntegration.handleSwarmDecisionRequest(request);
    }
    async createHumanTask(taskData) {
        if (!this.delegationManager) {
            throw new Error('Task Delegation not enabled');
        }
        this.log('info', `Creating human task: ${taskData.title}`);
        return await this.delegationManager.createTask(taskData);
    }
    getSystemAnalytics() {
        const analytics = {
            system: {
                uptime: Math.round((Date.now() - this.startTime.getTime()) / 1000),
                status: this.status,
                metrics: this.metrics
            }
        };
        if (this.orchestrator) {
            analytics['decisions'] = {
                pending: this.orchestrator.getPendingDecisions().length,
                history: this.orchestrator.getDecisionHistory(100)
            };
        }
        if (this.delegationManager) {
            analytics['tasks'] = this.delegationManager.getDelegationAnalytics();
        }
        if (this.progressTracker) {
            analytics['tracking'] = this.progressTracker.getTrackingAnalytics();
        }
        if (this.swarmIntegration) {
            analytics['swarmIntegration'] = this.swarmIntegration.getIntegrationStatus();
        }
        return analytics;
    }
    async updateConfiguration(newConfig) {
        this.log('info', 'Updating system configuration');
        const oldConfig = { ...this.config };
        this.config = { ...this.config, ...newConfig };
        try {
            await this.applyConfigurationChanges(oldConfig, this.config);
            await this.swarmMemory.store('hitl:config:updated', {
                oldConfig,
                newConfig: this.config,
                timestamp: new Date()
            });
            this.emit('configuration:updated', { oldConfig, newConfig: this.config });
            this.log('info', 'Configuration updated successfully');
        }
        catch (error) {
            this.log('error', 'Configuration update failed', error);
            this.config = oldConfig;
            throw error;
        }
    }
    async enableMaintenanceMode(reason) {
        this.log('info', `Enabling maintenance mode: ${reason}`);
        this.config.systemSettings.maintenanceMode = true;
        this.status = 'maintenance';
        this.createAlert('info', 'system', 'Maintenance mode enabled', { reason });
        this.emit('maintenance:enabled', { reason, timestamp: new Date() });
    }
    async disableMaintenanceMode() {
        this.log('info', 'Disabling maintenance mode');
        this.config.systemSettings.maintenanceMode = false;
        this.status = 'running';
        this.emit('maintenance:disabled', { timestamp: new Date() });
    }
    async shutdown() {
        this.log('info', 'Shutting down HITL System...');
        this.status = 'shutdown';
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        this.progressTracker?.stopTracking();
        this.delegationManager?.cleanup();
        this.swarmIntegration?.cleanup();
        await this.swarmMemory.store('hitl:system:shutdown', {
            timestamp: new Date(),
            uptime: Math.round((Date.now() - this.startTime.getTime()) / 1000),
            finalMetrics: this.metrics
        });
        this.emit('system:shutdown', { timestamp: new Date() });
        this.log('info', 'HITL System shutdown complete');
    }
    setupEventHandlers() {
        this.on('error', (error) => {
            this.log('error', 'System error occurred', error);
            this.createAlert('error', 'system', 'System error', { error });
        });
        process.on('unhandledRejection', (reason, promise) => {
            this.log('error', 'Unhandled promise rejection', reason);
            this.createAlert('critical', 'system', 'Unhandled promise rejection', { reason, promise });
        });
    }
    handleProgressAlert(alert) {
        this.createAlert(alert.type, 'tracking', alert.title, alert);
    }
    createAlert(level, component, message, metadata = {}) {
        const alert = {
            id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            level,
            component,
            message,
            timestamp: new Date(),
            acknowledged: false,
            metadata
        };
        this.alerts.set(alert.id, alert);
        this.emit('alert:created', alert);
        if (level === 'critical' || level === 'error') {
            this.log(level, `Alert: ${message}`, metadata);
        }
    }
    log(level, message, metadata) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level: level.toUpperCase(),
            component: 'HITLSystem',
            message,
            metadata
        };
        if (this.shouldLog(level)) {
            console.log(JSON.stringify(logEntry));
        }
        this.emit('log', logEntry);
    }
    shouldLog(level) {
        const levels = ['debug', 'info', 'warn', 'error'];
        const configLevel = this.config.systemSettings.logLevel;
        const levelIndex = levels.indexOf(level);
        const configIndex = levels.indexOf(configLevel);
        return levelIndex >= configIndex;
    }
    updateSuccessMetrics(success) {
        const total = this.metrics.totalDecisions;
        const currentSuccessCount = this.metrics.successRate * total;
        const newSuccessCount = success ? currentSuccessCount + 1 : currentSuccessCount;
        this.metrics.successRate = total > 0 ? newSuccessCount / total : 1.0;
        this.updatePerformanceScore();
    }
    updateTaskMetrics(task) {
        if (task.timeSpent) {
            const currentTotal = this.metrics.averageResolutionTime * this.metrics.totalTasks;
            this.metrics.averageResolutionTime = (currentTotal + task.timeSpent) / (this.metrics.totalTasks + 1);
        }
    }
    updateWorkflowMetrics(execution) {
        if (execution.completedAt && execution.startedAt) {
            const duration = execution.completedAt.getTime() - execution.startedAt.getTime();
        }
    }
    updateAutoApprovalMetrics() {
        this.updatePerformanceScore();
    }
    updatePerformanceMetrics(status) {
        const totalActive = (status.components.orchestrator.metrics.pendingDecisions || 0) +
            (status.components.delegation.metrics.activeTasks || 0) +
            (status.components.workflows.metrics.activeWorkflows || 0);
        this.metrics.currentLoad = Math.min(100, totalActive * 10);
        this.metrics.resourceUtilization.operators =
            status.components.delegation.metrics.operatorUtilization || 0;
        this.updatePerformanceScore();
    }
    updatePerformanceScore() {
        const factors = {
            successRate: this.metrics.successRate * 40,
            load: Math.max(0, 100 - this.metrics.currentLoad) * 30,
            uptime: Math.min(100, (Date.now() - this.startTime.getTime()) / (24 * 60 * 60 * 1000) * 100) * 20,
            alerts: Math.max(0, 100 - Array.from(this.alerts.values()).filter(a => !a.acknowledged).length * 10) * 10
        };
        this.metrics.performanceScore = Object.values(factors).reduce((sum, score) => sum + score, 0);
    }
    async applyConfigurationChanges(oldConfig, newConfig) {
        if (JSON.stringify(oldConfig.tracking) !== JSON.stringify(newConfig.tracking)) {
            this.log('info', 'Tracking configuration changed - restart may be required');
        }
        if (JSON.stringify(oldConfig.swarmIntegration) !== JSON.stringify(newConfig.swarmIntegration)) {
            this.log('info', 'Swarm integration configuration changed');
        }
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
    getAlertsByLevel(level) {
        return Array.from(this.alerts.values()).filter(alert => alert.level === level);
    }
    clearAcknowledgedAlerts() {
        const toRemove = Array.from(this.alerts.entries())
            .filter(([_, alert]) => alert.acknowledged &&
            (Date.now() - alert.timestamp.getTime()) > 24 * 60 * 60 * 1000)
            .map(([id, _]) => id);
        toRemove.forEach(id => this.alerts.delete(id));
        if (toRemove.length > 0) {
            this.emit('alerts:cleared', { count: toRemove.length });
        }
    }
    async exportSystemState() {
        const state = {
            config: this.config,
            status: this.getSystemStatus(),
            metrics: this.metrics,
            alerts: Array.from(this.alerts.values()),
            timestamp: new Date()
        };
        if (this.config.systemSettings.backupEnabled) {
            await this.swarmMemory.store(`hitl:backup:${Date.now()}`, state);
        }
        return state;
    }
    getComponent(name) {
        const components = {
            orchestrator: this.orchestrator,
            delegation: this.delegationManager,
            workflows: this.workflowEngine,
            tracking: this.progressTracker,
            swarmIntegration: this.swarmIntegration,
            hitlManager: this.hitlManager
        };
        return components[name];
    }
    isHealthy() {
        return this.status === 'running' && this.metrics.performanceScore > 70;
    }
    getSystemInfo() {
        return {
            name: this.config.systemSettings.name,
            version: this.config.systemSettings.version,
            environment: this.config.systemSettings.environment,
            uptime: Math.round((Date.now() - this.startTime.getTime()) / 1000),
            status: this.status,
            enabledComponents: Object.keys(this.config.enableComponents)
                .filter(key => this.config.enableComponents[key]),
            metrics: this.metrics
        };
    }
}
exports.HITLSystem = HITLSystem;
//# sourceMappingURL=HITLSystem.js.map