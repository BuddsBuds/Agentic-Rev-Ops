"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowSystem = void 0;
const events_1 = require("events");
const workflow_engine_1 = require("./core/engine/workflow-engine");
const workflow_scheduler_1 = require("./core/scheduler/workflow-scheduler");
const workflow_orchestrator_1 = require("./core/orchestrator/workflow-orchestrator");
const ProcessDefinition_1 = require("./core/process/ProcessDefinition");
const ErrorHandler_1 = require("./core/error/ErrorHandler");
const PerformanceOptimizer_1 = require("./monitors/performance/PerformanceOptimizer");
const performance_monitor_1 = require("./monitors/performance/performance-monitor");
const HITLSystem_1 = require("./hitl/HITLSystem");
class WorkflowSystem extends events_1.EventEmitter {
    config;
    status = 'initializing';
    startTime = new Date();
    engine;
    scheduler;
    orchestrator;
    processManager;
    errorHandler;
    performanceOptimizer;
    performanceMonitor;
    hitlSystem;
    swarmMemory;
    swarmCoordinator;
    isInitialized = false;
    healthCheckInterval;
    metricsInterval;
    constructor(config = {}, swarmMemory, swarmCoordinator) {
        super();
        this.config = this.buildConfig(config);
        this.swarmMemory = swarmMemory;
        this.swarmCoordinator = swarmCoordinator;
        this.engine = new workflow_engine_1.WorkflowExecutionEngine();
        this.scheduler = new workflow_scheduler_1.WorkflowSchedulerEngine(this.engine);
        this.orchestrator = new workflow_orchestrator_1.WorkflowOrchestrator();
        this.processManager = new ProcessDefinition_1.ProcessManager(this.engine);
        this.errorHandler = new ErrorHandler_1.ErrorHandler();
        this.performanceOptimizer = new PerformanceOptimizer_1.PerformanceOptimizer();
        this.performanceMonitor = new performance_monitor_1.WorkflowPerformanceMonitor();
        this.setupEventHandlers();
    }
    buildConfig(config) {
        return {
            name: config.name || 'Workflow System',
            version: config.version || '1.0.0',
            environment: config.environment || 'development',
            features: {
                scheduling: true,
                processManagement: true,
                errorHandling: true,
                performanceMonitoring: true,
                hitlIntegration: true,
                swarmIntegration: true,
                ...config.features
            },
            performance: {
                maxConcurrentWorkflows: 100,
                executionTimeout: 300000,
                retryPolicy: 'default',
                caching: true,
                ...config.performance
            },
            persistence: {
                enabled: false,
                type: 'memory',
                ...config.persistence
            }
        };
    }
    async initialize() {
        if (this.isInitialized) {
            throw new Error('Workflow system is already initialized');
        }
        try {
            this.emit('system:initializing');
            await this.initializeEngine();
            await this.initializeScheduler();
            await this.initializeOrchestrator();
            await this.initializeProcessManager();
            await this.initializeErrorHandler();
            await this.initializePerformanceMonitoring();
            if (this.config.features.hitlIntegration && this.swarmMemory && this.swarmCoordinator) {
                await this.initializeHITL();
            }
            this.startSystemMonitoring();
            if (this.swarmMemory) {
                await this.swarmMemory.store('workflow:system:initialized', {
                    config: this.config,
                    timestamp: new Date(),
                    components: this.getComponentStatuses()
                });
            }
            this.isInitialized = true;
            this.status = 'running';
            this.emit('system:initialized', this.getSystemStatus());
        }
        catch (error) {
            this.status = 'degraded';
            this.emit('system:error', { error, phase: 'initialization' });
            throw error;
        }
    }
    async initializeEngine() {
        this.engine.on('workflow:start', (data) => this.handleWorkflowStart(data));
        this.engine.on('workflow:complete', (data) => this.handleWorkflowComplete(data));
        this.engine.on('workflow:error', (data) => this.handleWorkflowError(data));
        this.engine.on('step:error', (data) => this.handleStepError(data));
        this.emit('component:initialized', { component: 'engine' });
    }
    async initializeScheduler() {
        if (!this.config.features.scheduling)
            return;
        await this.scheduler.initialize();
        this.scheduler.on('workflow:scheduled', (data) => {
            this.emit('workflow:scheduled', data);
        });
        this.scheduler.on('workflow:run', (data) => {
            this.emit('workflow:scheduled-run', data);
        });
        this.emit('component:initialized', { component: 'scheduler' });
    }
    async initializeOrchestrator() {
        await this.orchestrator.initialize();
        this.orchestrator.on('workflow:started', (data) => {
            this.performanceMonitor.recordExecution({
                workflowId: data.workflowId,
                workflowName: 'Orchestrated Workflow',
                executionId: data.executionId,
                startTime: new Date(),
                status: 'running',
                steps: new Map()
            });
        });
        this.orchestrator.on('workflow:completed', (data) => {
            this.emit('orchestrator:workflow-completed', data);
        });
        this.emit('component:initialized', { component: 'orchestrator' });
    }
    async initializeProcessManager() {
        if (!this.config.features.processManagement)
            return;
        this.processManager.on('process:started', (data) => {
            this.emit('process:started', data);
        });
        this.processManager.on('execution:completed', (data) => {
            this.emit('process:completed', data);
        });
        this.emit('component:initialized', { component: 'processManager' });
    }
    async initializeErrorHandler() {
        if (!this.config.features.errorHandling)
            return;
        this.errorHandler.registerRetryPolicy('workflow-default', {
            maxRetries: 3,
            strategy: 'exponential',
            baseDelay: 1000,
            maxDelay: 30000,
            jitter: true
        });
        this.errorHandler.on('error:created', (error) => {
            this.emit('error:detected', error);
        });
        this.errorHandler.on('recovery:success', (data) => {
            this.emit('error:recovered', data);
        });
        this.emit('component:initialized', { component: 'errorHandler' });
    }
    async initializePerformanceMonitoring() {
        if (!this.config.features.performanceMonitoring)
            return;
        this.performanceOptimizer.startMonitoring();
        this.performanceMonitor.start();
        this.performanceOptimizer.on('alert:created', (alert) => {
            this.emit('performance:alert', alert);
        });
        this.performanceOptimizer.on('optimization:suggested', (suggestion) => {
            this.emit('performance:optimization-suggested', suggestion);
        });
        this.emit('component:initialized', { component: 'performanceMonitor' });
    }
    async initializeHITL() {
        if (!this.swarmMemory || !this.swarmCoordinator) {
            throw new Error('HITL requires swarm memory and coordinator');
        }
        this.hitlSystem = new HITLSystem_1.HITLSystem(this.swarmMemory, this.swarmCoordinator);
        await this.hitlSystem.initialize();
        this.hitlSystem.on('decision:required', (decision) => {
            this.emit('hitl:decision-required', decision);
        });
        this.emit('component:initialized', { component: 'hitlSystem' });
    }
    async createWorkflow(config) {
        this.ensureInitialized();
        try {
            const workflow = this.engine.createWorkflow(config);
            this.emit('workflow:created', { workflow });
            return workflow.id;
        }
        catch (error) {
            const workflowError = this.errorHandler.createError('validation', `Failed to create workflow: ${error instanceof Error ? error.message : String(error)}`, { details: config });
            throw workflowError;
        }
    }
    async executeWorkflow(workflowId, context, options) {
        this.ensureInitialized();
        const startTime = Date.now();
        try {
            const activeCount = this.getActiveWorkflowCount();
            if (activeCount >= this.config.performance.maxConcurrentWorkflows) {
                throw new Error('Maximum concurrent workflows reached');
            }
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Workflow execution timeout')), this.config.performance.executionTimeout);
            });
            const executionPromise = this.engine.executeWorkflow(workflowId, context);
            const result = await Promise.race([executionPromise, timeoutPromise]);
            const executionTime = Date.now() - startTime;
            this.recordSuccess(workflowId, executionTime);
            return result;
        }
        catch (error) {
            const executionTime = Date.now() - startTime;
            this.recordFailure(workflowId, executionTime, error);
            if (this.config.features.errorHandling) {
                const workflowError = this.errorHandler.createError('execution', error instanceof Error ? error.message : String(error), { workflowId, context });
                try {
                    const recovered = await this.errorHandler.recover(workflowError);
                    return recovered;
                }
                catch (recoveryError) {
                    throw recoveryError;
                }
            }
            throw error;
        }
    }
    async scheduleWorkflow(workflowId, schedule, context) {
        this.ensureInitialized();
        if (!this.config.features.scheduling) {
            throw new Error('Scheduling feature is not enabled');
        }
        const scheduled = this.scheduler.scheduleWorkflow(workflowId, schedule, context);
        this.emit('workflow:scheduled', { scheduled });
        return scheduled.id;
    }
    async createProcess(definition) {
        this.ensureInitialized();
        if (!this.config.features.processManagement) {
            throw new Error('Process management feature is not enabled');
        }
        const process = this.processManager.createProcess(definition);
        this.emit('process:created', { process });
        return process.id;
    }
    async executeProcess(processId, context, options) {
        this.ensureInitialized();
        if (!this.config.features.processManagement) {
            throw new Error('Process management feature is not enabled');
        }
        return await this.processManager.executeProcess(processId, context, options);
    }
    startSystemMonitoring() {
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, 30000);
        this.metricsInterval = setInterval(() => {
            this.collectMetrics();
        }, 10000);
    }
    performHealthCheck() {
        const health = this.calculateSystemHealth();
        if (health.status === 'critical') {
            this.status = 'degraded';
            this.emit('health:critical', health);
        }
        else if (health.status === 'warning' && this.status === 'running') {
            this.emit('health:warning', health);
        }
        this.emit('health:checked', health);
    }
    collectMetrics() {
        const metrics = this.calculateSystemMetrics();
        this.emit('metrics:collected', metrics);
        if (this.swarmMemory) {
            this.swarmMemory.store(`workflow:metrics:${Date.now()}`, metrics).catch(err => {
                console.error('Failed to store metrics:', err);
            });
        }
    }
    calculateSystemHealth() {
        const issues = [];
        const recommendations = [];
        let score = 100;
        const componentStatuses = this.getComponentStatuses();
        for (const [name, status] of Object.entries(componentStatuses)) {
            if (status.status === 'error') {
                issues.push(`Component ${name} is in error state`);
                score -= 20;
            }
            else if (status.status === 'degraded') {
                issues.push(`Component ${name} is degraded`);
                score -= 10;
            }
        }
        const metrics = this.calculateSystemMetrics();
        if (metrics.errorRate > 0.1) {
            issues.push('High error rate detected');
            recommendations.push('Review failed workflows and adjust error handling');
            score -= 15;
        }
        if (metrics.averageExecutionTime > 60000) {
            issues.push('Slow average execution time');
            recommendations.push('Optimize workflow steps or enable parallel execution');
            score -= 10;
        }
        const memUsage = process.memoryUsage();
        const memPercentage = memUsage.heapUsed / memUsage.heapTotal;
        if (memPercentage > 0.9) {
            issues.push('High memory usage');
            recommendations.push('Increase memory allocation or optimize memory usage');
            score -= 20;
        }
        const status = score >= 80 ? 'healthy' : score >= 50 ? 'warning' : 'critical';
        return {
            status,
            score: Math.max(0, score),
            issues,
            recommendations
        };
    }
    calculateSystemMetrics() {
        const performanceMetrics = this.performanceMonitor.getWorkflowMetrics();
        let totalWorkflows = 0;
        let completedWorkflows = 0;
        let failedWorkflows = 0;
        let totalExecutionTime = 0;
        const activeWorkflows = this.getActiveWorkflowCount();
        return {
            totalWorkflows,
            activeWorkflows,
            completedWorkflows,
            failedWorkflows,
            averageExecutionTime: totalWorkflows > 0 ? totalExecutionTime / totalWorkflows : 0,
            successRate: totalWorkflows > 0 ? completedWorkflows / totalWorkflows : 1,
            errorRate: totalWorkflows > 0 ? failedWorkflows / totalWorkflows : 0,
            throughput: 0
        };
    }
    handleWorkflowStart(data) {
        this.performanceMonitor.recordExecution({
            workflowId: data.workflowId,
            workflowName: data.workflow?.name || 'Unknown',
            executionId: data.workflowId,
            startTime: new Date(),
            status: 'running',
            steps: new Map(),
            context: data.context
        });
        this.emit('workflow:started', data);
    }
    handleWorkflowComplete(data) {
        this.performanceMonitor.recordExecution({
            workflowId: data.workflowId,
            workflowName: 'Unknown',
            executionId: data.workflowId,
            startTime: new Date(Date.now() - (data.duration || 0)),
            endTime: new Date(),
            status: 'completed',
            steps: new Map()
        });
        this.emit('workflow:completed', data);
    }
    handleWorkflowError(data) {
        const error = this.errorHandler.createError('execution', data.error?.message || 'Workflow execution failed', {
            workflowId: data.workflowId,
            details: data.error
        });
        this.performanceMonitor.recordExecution({
            workflowId: data.workflowId,
            workflowName: 'Unknown',
            executionId: data.workflowId,
            startTime: new Date(),
            endTime: new Date(),
            status: 'failed',
            steps: new Map(),
            errors: [error]
        });
        this.emit('workflow:failed', data);
    }
    handleStepError(data) {
        const error = this.errorHandler.createError('execution', `Step ${data.step?.name || data.step?.id} failed`, {
            workflowId: data.workflowId,
            stepId: data.step?.id,
            details: data.error
        });
        this.emit('step:failed', { ...data, error });
    }
    ensureInitialized() {
        if (!this.isInitialized) {
            throw new Error('Workflow system is not initialized');
        }
    }
    getComponentStatuses() {
        return {
            engine: {
                name: 'Workflow Engine',
                status: 'online',
                initialized: true
            },
            scheduler: {
                name: 'Workflow Scheduler',
                status: this.config.features.scheduling ? 'online' : 'offline',
                initialized: this.config.features.scheduling
            },
            orchestrator: {
                name: 'Workflow Orchestrator',
                status: 'online',
                initialized: true
            },
            processManager: {
                name: 'Process Manager',
                status: this.config.features.processManagement ? 'online' : 'offline',
                initialized: this.config.features.processManagement
            },
            errorHandler: {
                name: 'Error Handler',
                status: this.config.features.errorHandling ? 'online' : 'offline',
                initialized: this.config.features.errorHandling
            },
            performanceMonitor: {
                name: 'Performance Monitor',
                status: this.config.features.performanceMonitoring ? 'online' : 'offline',
                initialized: this.config.features.performanceMonitoring
            },
            ...(this.hitlSystem ? {
                hitlSystem: {
                    name: 'HITL System',
                    status: 'online',
                    initialized: true
                }
            } : {})
        };
    }
    getActiveWorkflowCount() {
        return 0;
    }
    recordSuccess(workflowId, executionTime) {
        this.emit('workflow:success', { workflowId, executionTime });
    }
    recordFailure(workflowId, executionTime, error) {
        this.emit('workflow:failure', { workflowId, executionTime, error });
    }
    setupEventHandlers() {
        this.setMaxListeners(50);
        this.on('error', (error) => {
            console.error('[WorkflowSystem] Error:', error);
            this.status = 'degraded';
        });
        for (const component of [
            this.engine,
            this.scheduler,
            this.orchestrator,
            this.processManager,
            this.errorHandler,
            this.performanceOptimizer,
            this.performanceMonitor
        ]) {
            if (component && typeof component.on === 'function') {
                component.on('error', (error) => {
                    this.emit('component:error', { component: component.constructor.name, error });
                });
            }
        }
    }
    getSystemStatus() {
        const uptime = Date.now() - this.startTime.getTime();
        return {
            status: this.status,
            uptime,
            components: this.getComponentStatuses(),
            metrics: this.calculateSystemMetrics(),
            health: this.calculateSystemHealth()
        };
    }
    async shutdown() {
        this.status = 'shutdown';
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }
        if (this.hitlSystem) {
            await this.hitlSystem.shutdown();
        }
        this.performanceMonitor.stop();
        this.performanceOptimizer.stopMonitoring();
        await this.scheduler.shutdown();
        await this.orchestrator.shutdown();
        if (this.swarmMemory) {
            await this.swarmMemory.store('workflow:system:shutdown', {
                timestamp: new Date(),
                uptime: Date.now() - this.startTime.getTime(),
                finalMetrics: this.calculateSystemMetrics()
            });
        }
        this.emit('system:shutdown');
    }
    getConfiguration() {
        return { ...this.config };
    }
    updateConfiguration(updates) {
        this.config = { ...this.config, ...updates };
        this.emit('config:updated', updates);
    }
    getEngine() {
        return this.engine;
    }
    getScheduler() {
        return this.scheduler;
    }
    getOrchestrator() {
        return this.orchestrator;
    }
    getProcessManager() {
        return this.processManager;
    }
    getErrorHandler() {
        return this.errorHandler;
    }
    getPerformanceMonitor() {
        return this.performanceMonitor;
    }
    getHITLSystem() {
        return this.hitlSystem;
    }
}
exports.WorkflowSystem = WorkflowSystem;
//# sourceMappingURL=WorkflowSystem.js.map