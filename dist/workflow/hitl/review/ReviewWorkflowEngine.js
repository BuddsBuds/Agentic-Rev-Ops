"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewWorkflowEngine = void 0;
const events_1 = require("events");
class ReviewWorkflowEngine extends events_1.EventEmitter {
    workflows = new Map();
    executions = new Map();
    hitlOrchestrator;
    swarmMemory;
    activeTimers = new Map();
    constructor(hitlOrchestrator, swarmMemory) {
        super();
        this.hitlOrchestrator = hitlOrchestrator;
        this.swarmMemory = swarmMemory;
        this.setupDefaultWorkflows();
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        this.hitlOrchestrator.on('decision:created', this.handleNewDecision.bind(this));
        this.hitlOrchestrator.on('review:completed', this.handleReviewCompleted.bind(this));
    }
    setupDefaultWorkflows() {
        this.createWorkflow({
            id: 'strategic-decision',
            name: 'Strategic Decision Review',
            description: 'Multi-stage review for strategic business decisions',
            stages: [
                {
                    id: 'initial-validation',
                    name: 'Initial Validation',
                    type: 'validation',
                    order: 1,
                    requiredRoles: ['analyst', 'domain-expert'],
                    timeoutMinutes: 30,
                    onSuccess: [{ type: 'advance', target: 'senior-review' }],
                    onFailure: [{ type: 'reject' }],
                    onTimeout: [{ type: 'escalate', target: 'emergency-review' }],
                    parallel: false
                },
                {
                    id: 'senior-review',
                    name: 'Senior Leadership Review',
                    type: 'approval',
                    order: 2,
                    requiredRoles: ['senior-manager', 'director'],
                    timeoutMinutes: 60,
                    onSuccess: [{ type: 'advance', target: 'final-approval' }],
                    onFailure: [{ type: 'escalate', target: 'executive-review' }],
                    onTimeout: [{ type: 'escalate', target: 'executive-review' }],
                    parallel: false
                },
                {
                    id: 'final-approval',
                    name: 'Final Approval',
                    type: 'approval',
                    order: 3,
                    requiredRoles: ['executive'],
                    timeoutMinutes: 120,
                    onSuccess: [{ type: 'execute' }],
                    onFailure: [{ type: 'reject' }],
                    onTimeout: [{ type: 'escalate', target: 'board-review' }],
                    parallel: false
                }
            ],
            triggers: [
                { type: 'decision_type', condition: 'equals', value: 'strategic' },
                { type: 'financial_impact', condition: 'greater_than', value: 100000 }
            ],
            configuration: {
                allowParallelStages: false,
                requireAllApprovals: true,
                escalationPath: ['senior-manager', 'director', 'executive', 'board'],
                notificationChannels: ['email', 'slack', 'dashboard'],
                auditLevel: 'comprehensive',
                rollbackPolicy: 'manual'
            },
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
        });
        this.createWorkflow({
            id: 'quick-approval',
            name: 'Quick Approval Process',
            description: 'Fast-track approval for low-risk decisions',
            stages: [
                {
                    id: 'peer-review',
                    name: 'Peer Review',
                    type: 'review',
                    order: 1,
                    requiredRoles: ['analyst', 'specialist'],
                    timeoutMinutes: 15,
                    autoAdvanceConditions: ['confidence > 0.9', 'risk_level = low'],
                    onSuccess: [{ type: 'execute' }],
                    onFailure: [{ type: 'escalate', target: 'detailed-review' }],
                    onTimeout: [{ type: 'advance', target: 'manager-approval' }],
                    parallel: true
                },
                {
                    id: 'manager-approval',
                    name: 'Manager Approval',
                    type: 'approval',
                    order: 2,
                    requiredRoles: ['manager'],
                    timeoutMinutes: 30,
                    onSuccess: [{ type: 'execute' }],
                    onFailure: [{ type: 'reject' }],
                    onTimeout: [{ type: 'escalate', target: 'senior-review' }],
                    parallel: false
                }
            ],
            triggers: [
                { type: 'risk_level', condition: 'equals', value: 'low' },
                { type: 'financial_impact', condition: 'less_than', value: 10000 },
                { type: 'confidence', condition: 'greater_than', value: 0.8 }
            ],
            configuration: {
                allowParallelStages: true,
                requireAllApprovals: false,
                escalationPath: ['manager', 'senior-manager'],
                notificationChannels: ['dashboard', 'slack'],
                auditLevel: 'basic',
                rollbackPolicy: 'automatic'
            },
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
        });
        this.createWorkflow({
            id: 'emergency-decision',
            name: 'Emergency Decision Process',
            description: 'Rapid response for critical and time-sensitive decisions',
            stages: [
                {
                    id: 'emergency-triage',
                    name: 'Emergency Triage',
                    type: 'validation',
                    order: 1,
                    requiredRoles: ['on-call-manager', 'subject-matter-expert'],
                    timeoutMinutes: 5,
                    onSuccess: [{ type: 'advance', target: 'rapid-approval' }],
                    onFailure: [{ type: 'escalate', target: 'executive-emergency' }],
                    onTimeout: [{ type: 'escalate', target: 'executive-emergency' }],
                    parallel: true
                },
                {
                    id: 'rapid-approval',
                    name: 'Rapid Approval',
                    type: 'approval',
                    order: 2,
                    requiredRoles: ['senior-manager', 'director'],
                    timeoutMinutes: 10,
                    onSuccess: [{ type: 'execute' }],
                    onFailure: [{ type: 'escalate', target: 'executive-emergency' }],
                    onTimeout: [{ type: 'execute' }],
                    parallel: false
                }
            ],
            triggers: [
                { type: 'risk_level', condition: 'equals', value: 'critical' },
                { type: 'decision_type', condition: 'equals', value: 'emergency' }
            ],
            configuration: {
                allowParallelStages: true,
                requireAllApprovals: false,
                escalationPath: ['on-call-manager', 'senior-manager', 'director', 'executive'],
                notificationChannels: ['sms', 'phone', 'slack', 'email'],
                auditLevel: 'detailed',
                rollbackPolicy: 'automatic'
            },
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }
    createWorkflow(workflow) {
        const newWorkflow = {
            id: workflow.id || `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ...workflow,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        this.workflows.set(newWorkflow.id, newWorkflow);
        this.emit('workflow:created', newWorkflow);
        return newWorkflow;
    }
    async handleNewDecision(decision) {
        const applicableWorkflows = this.findApplicableWorkflows(decision);
        if (applicableWorkflows.length === 0) {
            await this.handleDecisionWithoutWorkflow(decision);
            return;
        }
        const workflow = applicableWorkflows[0];
        await this.startWorkflowExecution(workflow, decision);
    }
    findApplicableWorkflows(decision) {
        return Array.from(this.workflows.values())
            .filter(workflow => workflow.status === 'active' &&
            this.evaluateWorkflowTriggers(workflow, decision))
            .sort((a, b) => b.triggers.length - a.triggers.length);
    }
    evaluateWorkflowTriggers(workflow, decision) {
        return workflow.triggers.every(trigger => {
            switch (trigger.type) {
                case 'decision_type':
                    return this.evaluateCondition(decision.type, trigger.condition, trigger.value);
                case 'risk_level':
                    return this.evaluateCondition(decision.context.riskLevel, trigger.condition, trigger.value);
                case 'financial_impact':
                    return this.evaluateCondition(decision.context.financialImpact || 0, trigger.condition, trigger.value);
                case 'confidence':
                    return this.evaluateCondition(decision.context.confidence, trigger.condition, trigger.value);
                case 'client_type':
                    return this.evaluateCondition(decision.metadata.clientId ? 'external' : 'internal', trigger.condition, trigger.value);
                default:
                    return false;
            }
        });
    }
    evaluateCondition(value, condition, expected) {
        switch (condition) {
            case 'equals': return value === expected;
            case 'not_equals': return value !== expected;
            case 'greater_than': return value > expected;
            case 'less_than': return value < expected;
            case 'greater_or_equal': return value >= expected;
            case 'less_or_equal': return value <= expected;
            case 'contains': return String(value).includes(String(expected));
            case 'starts_with': return String(value).startsWith(String(expected));
            case 'ends_with': return String(value).endsWith(String(expected));
            default: return false;
        }
    }
    async startWorkflowExecution(workflow, decision) {
        const execution = {
            id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            workflowId: workflow.id,
            decisionId: decision.id,
            currentStage: workflow.stages[0].id,
            status: 'in_progress',
            stageHistory: [],
            startedAt: new Date(),
            metadata: {
                workflow: workflow.name,
                decision: decision.title,
                priority: decision.metadata.priority
            }
        };
        this.executions.set(execution.id, execution);
        await this.swarmMemory.store(`workflow:execution:${execution.id}`, execution);
        await this.executeStage(execution, workflow.stages[0]);
        this.emit('workflow:started', { execution, workflow, decision });
        return execution;
    }
    async executeStage(execution, stage) {
        const stageExecution = {
            stageId: stage.id,
            status: 'in_progress',
            assignedTo: stage.requiredRoles,
            startedAt: new Date(),
            actions: []
        };
        execution.stageHistory.push(stageExecution);
        execution.currentStage = stage.id;
        if (stage.timeoutMinutes > 0) {
            const timeoutMs = stage.timeoutMinutes * 60 * 1000;
            const timer = setTimeout(() => {
                this.handleStageTimeout(execution.id, stage.id);
            }, timeoutMs);
            this.activeTimers.set(`${execution.id}-${stage.id}`, timer);
        }
        if (stage.autoAdvanceConditions && await this.checkAutoAdvanceConditions(execution, stage)) {
            await this.completeStage(execution, stage, 'auto-advanced');
            return;
        }
        await this.requestStageReview(execution, stage);
        this.emit('stage:started', { execution, stage });
    }
    async requestStageReview(execution, stage) {
        const decision = this.hitlOrchestrator.getDecision(execution.decisionId);
        if (!decision)
            return;
        const reviewRequest = {
            type: stage.type,
            context: {
                decision,
                stage,
                execution,
                workflow: this.workflows.get(execution.workflowId),
                requiredRoles: stage.requiredRoles,
                timeoutMinutes: stage.timeoutMinutes
            }
        };
        this.emit('stage:reviewRequested', { execution, stage, reviewRequest });
    }
    async completeStage(execution, stage, result, notes) {
        const stageExecution = execution.stageHistory.find(s => s.stageId === stage.id);
        if (!stageExecution)
            return;
        stageExecution.status = 'completed';
        stageExecution.completedAt = new Date();
        stageExecution.result = result;
        stageExecution.notes = notes;
        const timerKey = `${execution.id}-${stage.id}`;
        const timer = this.activeTimers.get(timerKey);
        if (timer) {
            clearTimeout(timer);
            this.activeTimers.delete(timerKey);
        }
        const actions = result === 'approved' ? stage.onSuccess :
            result === 'rejected' ? stage.onFailure :
                stage.onTimeout;
        for (const action of actions) {
            await this.executeStageAction(execution, stage, action);
        }
        this.emit('stage:completed', { execution, stage, result });
    }
    async executeStageAction(execution, stage, action) {
        const actionExecution = {
            actionId: `action-${Date.now()}`,
            type: action.type,
            executedAt: new Date(),
            result: 'success'
        };
        const stageExecution = execution.stageHistory.find(s => s.stageId === stage.id);
        stageExecution?.actions.push(actionExecution);
        try {
            switch (action.type) {
                case 'advance':
                    await this.advanceToNextStage(execution, action.target);
                    break;
                case 'escalate':
                    await this.escalateWorkflow(execution, action.target);
                    break;
                case 'reject':
                    await this.rejectWorkflow(execution);
                    break;
                case 'execute':
                    await this.executeDecision(execution);
                    break;
                case 'notify':
                    await this.sendNotification(execution, action.parameters);
                    break;
                case 'rollback':
                    await this.rollbackExecution(execution);
                    break;
            }
        }
        catch (error) {
            actionExecution.result = 'failure';
            actionExecution.details = { error: error instanceof Error ? error.message : String(error) };
            this.emit('action:failed', { execution, stage, action, error });
        }
    }
    async advanceToNextStage(execution, targetStageId) {
        const workflow = this.workflows.get(execution.workflowId);
        if (!workflow)
            return;
        let nextStage;
        if (targetStageId) {
            nextStage = workflow.stages.find(s => s.id === targetStageId);
        }
        else {
            const currentStageIndex = workflow.stages.findIndex(s => s.id === execution.currentStage);
            nextStage = workflow.stages[currentStageIndex + 1];
        }
        if (!nextStage) {
            await this.completeWorkflow(execution, 'approved');
            return;
        }
        await this.executeStage(execution, nextStage);
    }
    async completeWorkflow(execution, result) {
        execution.status = 'completed';
        execution.completedAt = new Date();
        execution.result = result;
        await this.swarmMemory.store(`workflow:execution:${execution.id}`, execution);
        for (const [key, timer] of this.activeTimers.entries()) {
            if (key.startsWith(execution.id)) {
                clearTimeout(timer);
                this.activeTimers.delete(key);
            }
        }
        this.emit('workflow:completed', { execution, result });
    }
    async checkAutoAdvanceConditions(execution, stage) {
        if (!stage.autoAdvanceConditions)
            return false;
        const decision = this.hitlOrchestrator.getDecision(execution.decisionId);
        if (!decision)
            return false;
        return stage.autoAdvanceConditions.every(condition => {
            const [field, operator, value] = condition.split(' ');
            let fieldValue;
            switch (field) {
                case 'confidence':
                    fieldValue = decision.context.confidence;
                    break;
                case 'risk_level':
                    fieldValue = decision.context.riskLevel;
                    break;
                case 'financial_impact':
                    fieldValue = decision.context.financialImpact || 0;
                    break;
                default:
                    return false;
            }
            return this.evaluateCondition(fieldValue, operator, isNaN(Number(value)) ? value : Number(value));
        });
    }
    async handleStageTimeout(executionId, stageId) {
        const execution = this.executions.get(executionId);
        if (!execution)
            return;
        const workflow = this.workflows.get(execution.workflowId);
        if (!workflow)
            return;
        const stage = workflow.stages.find(s => s.id === stageId);
        if (!stage)
            return;
        const stageExecution = execution.stageHistory.find(s => s.stageId === stageId);
        if (stageExecution) {
            stageExecution.status = 'timeout';
            stageExecution.completedAt = new Date();
        }
        for (const action of stage.onTimeout) {
            await this.executeStageAction(execution, stage, action);
        }
        this.emit('stage:timeout', { execution, stage });
    }
    async handleDecisionWithoutWorkflow(decision) {
        const simpleWorkflow = {
            id: 'simple-approval',
            name: 'Simple Approval',
            description: 'Basic approval process',
            stages: [{
                    id: 'simple-review',
                    name: 'Review',
                    type: 'approval',
                    order: 1,
                    requiredRoles: ['reviewer'],
                    timeoutMinutes: 60,
                    onSuccess: [{ type: 'execute' }],
                    onFailure: [{ type: 'reject' }],
                    onTimeout: [{ type: 'escalate' }],
                    parallel: false
                }],
            triggers: [],
            configuration: {
                allowParallelStages: false,
                requireAllApprovals: true,
                escalationPath: ['manager'],
                notificationChannels: ['dashboard'],
                auditLevel: 'basic',
                rollbackPolicy: 'manual'
            },
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        await this.startWorkflowExecution(simpleWorkflow, decision);
    }
    async escalateWorkflow(execution, target) {
        execution.metadata.escalated = true;
        execution.metadata.escalatedAt = new Date();
        execution.metadata.escalationTarget = target;
        this.emit('workflow:escalated', { execution, target });
    }
    async rejectWorkflow(execution) {
        await this.completeWorkflow(execution, 'rejected');
    }
    async executeDecision(execution) {
        const decision = this.hitlOrchestrator.getDecision(execution.decisionId);
        if (decision) {
            this.emit('workflow:executeDecision', { execution, decision });
        }
        await this.completeWorkflow(execution, 'approved');
    }
    async sendNotification(execution, parameters) {
        this.emit('workflow:notification', { execution, parameters });
    }
    async rollbackExecution(execution) {
        execution.metadata.rolledBack = true;
        execution.metadata.rolledBackAt = new Date();
        this.emit('workflow:rolledBack', { execution });
    }
    async handleReviewCompleted(reviewResponse) {
        const execution = Array.from(this.executions.values()).find(exec => exec.decisionId === reviewResponse.context?.decision?.id);
        if (execution) {
            const workflow = this.workflows.get(execution.workflowId);
            const stage = workflow?.stages.find(s => s.id === execution.currentStage);
            if (stage) {
                const result = reviewResponse.response?.approved ? 'approved' : 'rejected';
                await this.completeStage(execution, stage, result, reviewResponse.response?.notes);
            }
        }
    }
    getWorkflow(id) {
        return this.workflows.get(id);
    }
    getWorkflows() {
        return Array.from(this.workflows.values());
    }
    getExecution(id) {
        return this.executions.get(id);
    }
    getActiveExecutions() {
        return Array.from(this.executions.values())
            .filter(exec => exec.status === 'in_progress');
    }
    getExecutionsByStatus(status) {
        return Array.from(this.executions.values()).filter(exec => exec.status === status);
    }
}
exports.ReviewWorkflowEngine = ReviewWorkflowEngine;
//# sourceMappingURL=ReviewWorkflowEngine.js.map