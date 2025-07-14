"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowOrchestrator = void 0;
const events_1 = require("events");
const workflow_engine_1 = require("../engine/workflow-engine");
const workflow_scheduler_1 = require("../scheduler/workflow-scheduler");
const agent_coordinator_1 = require("../../agents/coordinator/agent-coordinator");
const hitl_manager_1 = require("../../hitl/interfaces/hitl-manager");
const integration_manager_1 = require("../../integrations/integration-manager");
const performance_monitor_1 = require("../../monitors/performance/performance-monitor");
class WorkflowOrchestrator extends events_1.EventEmitter {
    engine;
    scheduler;
    agentCoordinator;
    hitlManager;
    integrationManager;
    performanceMonitor;
    workflows;
    executions;
    constructor() {
        super();
        this.engine = new workflow_engine_1.WorkflowExecutionEngine();
        this.scheduler = new workflow_scheduler_1.WorkflowSchedulerEngine();
        this.agentCoordinator = new agent_coordinator_1.AgentCoordinationEngine();
        this.hitlManager = new hitl_manager_1.HumanInTheLoopManager();
        this.integrationManager = new integration_manager_1.WorkflowIntegrationManager();
        this.performanceMonitor = new performance_monitor_1.WorkflowPerformanceMonitor();
        this.workflows = new Map();
        this.executions = new Map();
        this.initializeEventHandlers();
    }
    async initialize() {
        try {
            await this.integrationManager.initialize();
            await this.agentCoordinator.initialize();
            await this.hitlManager.initialize();
            await this.scheduler.initialize();
            this.performanceMonitor.start();
            this.emit('orchestrator:initialized');
        }
        catch (error) {
            this.emit('orchestrator:error', { error, phase: 'initialization' });
            throw error;
        }
    }
    async registerWorkflow(workflow) {
        this.validateWorkflow(workflow);
        this.workflows.set(workflow.id, workflow);
        if (workflow.trigger.type === 'schedule') {
            await this.scheduler.registerScheduledWorkflow(workflow.id, workflow.trigger.config.schedule || '');
        }
        this.emit('workflow:registered', { workflowId: workflow.id });
    }
    async executeWorkflow(workflowId, context = {}, options = {}) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error(`Workflow not found: ${workflowId}`);
        }
        const executionId = this.generateExecutionId();
        const execution = {
            id: executionId,
            workflowId,
            status: 'pending',
            startTime: new Date(),
            context,
            results: {},
            errors: [],
            metrics: {
                duration: 0,
                stepsCompleted: 0,
                stepsTotal: workflow.steps.length,
                hitlInteractions: 0,
                tokensUsed: 0,
                costEstimate: 0
            }
        };
        this.executions.set(executionId, execution);
        if (options.immediate) {
            await this.engine.executeWorkflow(execution.id, { workflow, context });
        }
        else {
            await this.engine.queueWorkflow(execution);
        }
        this.emit('workflow:started', { executionId, workflowId });
        return executionId;
    }
    async pauseExecution(executionId) {
        const execution = this.executions.get(executionId);
        if (!execution) {
            throw new Error(`Execution not found: ${executionId}`);
        }
        if (execution.status !== 'running') {
            throw new Error(`Cannot pause execution in status: ${execution.status}`);
        }
        await this.engine.pauseExecution(executionId);
        execution.status = 'paused';
        this.emit('workflow:paused', { executionId });
    }
    async resumeExecution(executionId) {
        const execution = this.executions.get(executionId);
        if (!execution) {
            throw new Error(`Execution not found: ${executionId}`);
        }
        if (execution.status !== 'paused') {
            throw new Error(`Cannot resume execution in status: ${execution.status}`);
        }
        await this.engine.resumeExecution(executionId);
        execution.status = 'running';
        this.emit('workflow:resumed', { executionId });
    }
    async cancelExecution(executionId) {
        const execution = this.executions.get(executionId);
        if (!execution) {
            throw new Error(`Execution not found: ${executionId}`);
        }
        await this.engine.cancelExecution(executionId);
        execution.status = 'cancelled';
        execution.endTime = new Date();
        this.emit('workflow:cancelled', { executionId });
    }
    getExecution(executionId) {
        return this.executions.get(executionId);
    }
    getWorkflowExecutions(workflowId) {
        return Array.from(this.executions.values())
            .filter(execution => execution.workflowId === workflowId);
    }
    getActiveExecutions() {
        return Array.from(this.executions.values())
            .filter(execution => ['pending', 'running', 'paused'].includes(execution.status));
    }
    getWorkflowMetrics(workflowId) {
        return this.performanceMonitor.getWorkflowMetrics(workflowId);
    }
    async handleHITLResponse(executionId, _stepId, response) {
        this.hitlManager.handleResponse(executionId, response);
    }
    validateWorkflow(workflow) {
        if (!workflow.id || !workflow.name || !workflow.steps.length) {
            throw new Error('Invalid workflow definition: missing required fields');
        }
        for (const step of workflow.steps) {
            if (!step.id || !step.name || !step.type) {
                throw new Error(`Invalid step definition: ${step.id}`);
            }
        }
        const stepIds = new Set(workflow.steps.map(s => s.id));
        for (const step of workflow.steps) {
            if (step.dependencies) {
                for (const dep of step.dependencies) {
                    if (!stepIds.has(dep)) {
                        throw new Error(`Invalid dependency: ${dep} not found in workflow`);
                    }
                }
            }
        }
    }
    initializeEventHandlers() {
        this.engine.on('execution:completed', (data) => {
            const execution = this.executions.get(data.executionId);
            if (execution) {
                execution.status = 'completed';
                execution.endTime = new Date();
                execution.metrics.duration = execution.endTime.getTime() - execution.startTime.getTime();
            }
            this.emit('workflow:completed', data);
        });
        this.engine.on('execution:failed', (data) => {
            const execution = this.executions.get(data.executionId);
            if (execution) {
                execution.status = 'failed';
                execution.endTime = new Date();
                execution.errors.push({
                    stepId: data.stepId || 'unknown',
                    timestamp: new Date(),
                    error: data.error,
                    stack: data.stack,
                    context: data.context || {}
                });
            }
            this.emit('workflow:failed', data);
        });
        this.hitlManager.on('hitl:required', (data) => {
            this.emit('workflow:hitl', data);
        });
        this.performanceMonitor.on('performance:alert', (data) => {
            this.emit('orchestrator:alert', data);
        });
    }
    generateExecutionId() {
        return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    async shutdown() {
        await this.scheduler.shutdown();
        this.performanceMonitor.stop();
        this.emit('orchestrator:shutdown');
    }
}
exports.WorkflowOrchestrator = WorkflowOrchestrator;
//# sourceMappingURL=workflow-orchestrator.js.map