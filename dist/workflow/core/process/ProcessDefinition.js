"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessManager = void 0;
const uuid_1 = require("uuid");
const events_1 = require("events");
class ProcessManager extends events_1.EventEmitter {
    processes = new Map();
    executions = new Map();
    workflowEngine;
    triggerHandlers = new Map();
    constructor(workflowEngine) {
        super();
        this.workflowEngine = workflowEngine;
    }
    createProcess(definition) {
        const process = {
            id: definition.id || (0, uuid_1.v4)(),
            name: definition.name || 'New Process',
            description: definition.description || '',
            version: definition.version || '1.0.0',
            category: definition.category || 'custom',
            owner: definition.owner || 'system',
            status: definition.status || 'draft',
            triggers: definition.triggers || [],
            steps: definition.steps || [],
            variables: definition.variables || [],
            kpis: definition.kpis || [],
            rules: definition.rules || [],
            integrations: definition.integrations || [],
            metadata: {
                created: new Date(),
                modified: new Date(),
                author: definition.metadata?.author || 'system',
                tags: definition.metadata?.tags || [],
                ...definition.metadata
            }
        };
        this.validateProcess(process);
        this.processes.set(process.id, process);
        this.emit('process:created', process);
        if (process.status === 'active') {
            this.setupTriggers(process);
        }
        return process;
    }
    updateProcess(processId, updates) {
        const process = this.processes.get(processId);
        if (!process) {
            throw new Error(`Process ${processId} not found`);
        }
        const updatedProcess = {
            ...process,
            ...updates,
            metadata: {
                ...process.metadata,
                modified: new Date()
            }
        };
        this.validateProcess(updatedProcess);
        this.processes.set(processId, updatedProcess);
        if (process.status !== updatedProcess.status ||
            JSON.stringify(process.triggers) !== JSON.stringify(updatedProcess.triggers)) {
            this.teardownTriggers(process);
            if (updatedProcess.status === 'active') {
                this.setupTriggers(updatedProcess);
            }
        }
        this.emit('process:updated', updatedProcess);
        return updatedProcess;
    }
    deleteProcess(processId) {
        const process = this.processes.get(processId);
        if (!process) {
            throw new Error(`Process ${processId} not found`);
        }
        const activeExecutions = Array.from(this.executions.values())
            .filter(exec => exec.processId === processId &&
            ['running', 'paused'].includes(exec.status));
        if (activeExecutions.length > 0) {
            throw new Error(`Cannot delete process with ${activeExecutions.length} active executions`);
        }
        this.teardownTriggers(process);
        this.processes.delete(processId);
        this.emit('process:deleted', process);
    }
    async executeProcess(processId, context = {}, options = {}) {
        const process = this.processes.get(processId);
        if (!process) {
            throw new Error(`Process ${processId} not found`);
        }
        if (process.status !== 'active') {
            throw new Error(`Process ${processId} is not active`);
        }
        const execution = {
            id: (0, uuid_1.v4)(),
            processId: process.id,
            processVersion: process.version,
            status: 'pending',
            startTime: new Date(),
            variables: this.initializeVariables(process, context),
            history: [],
            metrics: {
                stepDurations: {},
                waitTime: 0,
                activeTime: 0,
                slaCompliance: 100,
                kpiValues: {}
            }
        };
        this.executions.set(execution.id, execution);
        const workflow = this.convertToWorkflow(process, execution);
        if (options.async === false) {
            await this.executeWorkflow(workflow, execution);
        }
        else {
            this.executeWorkflow(workflow, execution).catch(error => {
                this.handleExecutionError(execution, error);
            });
        }
        this.emit('process:started', { process, execution });
        return execution.id;
    }
    pauseExecution(executionId) {
        const execution = this.executions.get(executionId);
        if (!execution) {
            throw new Error(`Execution ${executionId} not found`);
        }
        if (execution.status !== 'running') {
            throw new Error(`Cannot pause execution in status ${execution.status}`);
        }
        const workflowId = `exec-${execution.id}`;
        this.workflowEngine.pauseWorkflow(workflowId);
        execution.status = 'paused';
        this.recordHistory(execution, 'paused', 'Execution paused');
        this.emit('execution:paused', execution);
    }
    resumeExecution(executionId) {
        const execution = this.executions.get(executionId);
        if (!execution) {
            throw new Error(`Execution ${executionId} not found`);
        }
        if (execution.status !== 'paused') {
            throw new Error(`Cannot resume execution in status ${execution.status}`);
        }
        const workflowId = `exec-${execution.id}`;
        this.workflowEngine.resumeWorkflow(workflowId);
        execution.status = 'running';
        this.recordHistory(execution, 'resumed', 'Execution resumed');
        this.emit('execution:resumed', execution);
    }
    cancelExecution(executionId, reason) {
        const execution = this.executions.get(executionId);
        if (!execution) {
            throw new Error(`Execution ${executionId} not found`);
        }
        if (['completed', 'failed', 'cancelled'].includes(execution.status)) {
            throw new Error(`Cannot cancel execution in status ${execution.status}`);
        }
        const workflowId = `exec-${execution.id}`;
        this.workflowEngine.cancelExecution(workflowId);
        execution.status = 'cancelled';
        execution.endTime = new Date();
        this.recordHistory(execution, 'cancelled', reason || 'Execution cancelled');
        this.emit('execution:cancelled', execution);
    }
    validateProcess(process) {
        const errors = [];
        if (!process.name)
            errors.push('Process name is required');
        if (!process.steps || process.steps.length === 0)
            errors.push('Process must have at least one step');
        const stepIds = new Set(process.steps.map(s => s.id));
        for (const step of process.steps) {
            if (step.type === 'decision' && step.config.decision) {
                for (const option of step.config.decision.options) {
                    if (option.nextStep && !stepIds.has(option.nextStep)) {
                        errors.push(`Decision option ${option.id} references unknown step ${option.nextStep}`);
                    }
                }
            }
        }
        const varNames = new Set();
        for (const variable of process.variables) {
            if (varNames.has(variable.name)) {
                errors.push(`Duplicate variable name: ${variable.name}`);
            }
            varNames.add(variable.name);
        }
        if (errors.length > 0) {
            throw new Error(`Process validation failed: ${errors.join(', ')}`);
        }
    }
    initializeVariables(process, context) {
        const variables = {};
        for (const variable of process.variables) {
            if (variable.scope === 'process' || variable.scope === 'global') {
                variables[variable.name] = context[variable.name] ?? variable.defaultValue;
            }
        }
        return { ...variables, ...context };
    }
    convertToWorkflow(process, execution) {
        const workflowSteps = process.steps.map(step => ({
            id: step.id,
            name: step.name,
            type: 'action',
            config: {
                action: async (params, context) => {
                    return this.executeProcessStep(step, execution, context);
                },
                params: step
            },
            timeout: step.sla?.duration ? step.sla.duration * 60000 : undefined,
            onError: step.onError,
            maxRetries: step.onError === 'retry' ? 3 : 0
        }));
        return this.workflowEngine.createWorkflow({
            id: `exec-${execution.id}`,
            name: `${process.name} - Execution ${execution.id}`,
            steps: workflowSteps,
            variables: execution.variables,
            config: {
                errorHandling: 'stop',
                notifications: {
                    onError: true,
                    channels: ['system']
                }
            }
        });
    }
    async executeWorkflow(workflow, execution) {
        execution.status = 'running';
        try {
            const result = await this.workflowEngine.executeWorkflow(workflow.id, execution.variables);
            execution.status = 'completed';
            execution.endTime = new Date();
            execution.metrics.totalDuration = execution.endTime.getTime() - execution.startTime.getTime();
            const process = this.processes.get(execution.processId);
            for (const kpi of process.kpis) {
                execution.metrics.kpiValues[kpi.id] = this.calculateKPI(kpi, execution);
            }
            this.recordHistory(execution, 'completed', 'Process completed successfully');
            this.emit('execution:completed', { execution, result });
        }
        catch (error) {
            this.handleExecutionError(execution, error);
        }
    }
    async executeProcessStep(step, execution, context) {
        const startTime = Date.now();
        execution.currentStep = step.id;
        this.recordHistory(execution, 'step-started', `Started step: ${step.name}`, step.id);
        try {
            let result;
            switch (step.type) {
                case 'task':
                    result = await this.executeTaskStep(step, execution, context);
                    break;
                case 'decision':
                    result = await this.executeDecisionStep(step, execution, context);
                    break;
                case 'automation':
                    result = await this.executeAutomationStep(step, execution, context);
                    break;
                case 'integration':
                    result = await this.executeIntegrationStep(step, execution, context);
                    break;
                case 'notification':
                    result = await this.executeNotificationStep(step, execution, context);
                    break;
                case 'approval':
                    result = await this.executeApprovalStep(step, execution, context);
                    break;
                default:
                    throw new Error(`Unknown step type: ${step.type}`);
            }
            const duration = Date.now() - startTime;
            execution.metrics.stepDurations[step.id] = duration;
            execution.metrics.activeTime += duration;
            if (step.sla && duration > step.sla.duration * 60000) {
                execution.metrics.slaCompliance = Math.max(0, execution.metrics.slaCompliance - 10);
                this.emit('sla:breach', { execution, step, duration });
            }
            this.recordHistory(execution, 'step-completed', `Completed step: ${step.name}`, step.id);
            return result;
        }
        catch (error) {
            this.recordHistory(execution, 'step-failed', `Failed step: ${step.name}`, step.id);
            throw error;
        }
    }
    async executeTaskStep(step, execution, context) {
        const taskConfig = step.config.task;
        this.emit('task:created', {
            execution,
            step,
            assignee: step.assignee,
            priority: taskConfig.priority,
            instructions: taskConfig.instructions,
            form: taskConfig.form
        });
        return { completed: true, taskId: `task-${step.id}` };
    }
    async executeDecisionStep(step, execution, context) {
        const decisionConfig = step.config.decision;
        if (decisionConfig.autoDecide?.enabled) {
            for (const rule of decisionConfig.autoDecide.rules) {
                if (this.evaluateRule(rule, context)) {
                    const option = decisionConfig.options.find(o => o.id === rule.actions[0].value);
                    if (option) {
                        return { decision: option.id, nextStep: option.nextStep };
                    }
                }
            }
        }
        this.emit('decision:required', {
            execution,
            step,
            options: decisionConfig.options,
            criteria: decisionConfig.criteria
        });
        return { decision: decisionConfig.options[0].id };
    }
    async executeAutomationStep(step, execution, context) {
        const automationConfig = step.config.automation;
        if (automationConfig.script) {
            return { executed: true, script: automationConfig.script };
        }
        else if (automationConfig.function) {
            return { executed: true, function: automationConfig.function };
        }
        return { executed: true };
    }
    async executeIntegrationStep(step, execution, context) {
        const integrationConfig = step.config.integration;
        this.emit('integration:execute', {
            execution,
            step,
            system: integrationConfig.system,
            action: integrationConfig.action,
            data: this.mapData(context, integrationConfig.mapping)
        });
        return { integrated: true, system: integrationConfig.system };
    }
    async executeNotificationStep(step, execution, context) {
        const notificationConfig = step.config.notification;
        this.emit('notification:send', {
            execution,
            step,
            recipients: notificationConfig.recipients,
            template: notificationConfig.template,
            channels: notificationConfig.channels,
            priority: notificationConfig.priority,
            context
        });
        return { notified: true };
    }
    async executeApprovalStep(step, execution, context) {
        const approvalConfig = step.config.approval;
        this.emit('approval:required', {
            execution,
            step,
            approvers: approvalConfig.approvers,
            threshold: approvalConfig.threshold,
            timeout: approvalConfig.timeout,
            context
        });
        return { approved: true, approvers: [] };
    }
    evaluateRule(rule, context) {
        if (!rule.enabled)
            return false;
        try {
            const func = new Function('context', `with(context) { return ${rule.condition}; }`);
            return !!func(context);
        }
        catch (error) {
            console.error(`Rule evaluation error for ${rule.name}:`, error);
            return false;
        }
    }
    mapData(source, mapping) {
        const result = {};
        for (const map of mapping) {
            let value = this.getNestedValue(source, map.source);
            if (map.transform) {
                try {
                    const func = new Function('value', `return ${map.transform}`);
                    value = func(value);
                }
                catch (error) {
                    console.error(`Transform error for ${map.source}:`, error);
                }
            }
            this.setNestedValue(result, map.destination, value ?? map.defaultValue);
        }
        return result;
    }
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!current[key])
                current[key] = {};
            return current[key];
        }, obj);
        target[lastKey] = value;
    }
    calculateKPI(kpi, execution) {
        try {
            const func = new Function('metrics', 'variables', `return ${kpi.formula}`);
            return func(execution.metrics, execution.variables);
        }
        catch (error) {
            console.error(`KPI calculation error for ${kpi.name}:`, error);
            return 0;
        }
    }
    recordHistory(execution, action, details, stepId) {
        execution.history.push({
            stepId: stepId || execution.currentStep || '',
            timestamp: new Date(),
            action,
            actor: 'system',
            details
        });
    }
    handleExecutionError(execution, error) {
        execution.status = 'failed';
        execution.endTime = new Date();
        execution.error = {
            stepId: execution.currentStep || '',
            timestamp: new Date(),
            type: error.name || 'Error',
            message: error.message || String(error),
            stack: error.stack
        };
        this.recordHistory(execution, 'failed', error.message);
        this.emit('execution:failed', { execution, error });
    }
    setupTriggers(process) {
        for (const trigger of process.triggers) {
            if (!trigger.enabled)
                continue;
            const handler = this.createTriggerHandler(process, trigger);
            this.triggerHandlers.set(`${process.id}-${trigger.id}`, handler);
        }
    }
    teardownTriggers(process) {
        for (const trigger of process.triggers) {
            const key = `${process.id}-${trigger.id}`;
            const handler = this.triggerHandlers.get(key);
            if (handler && typeof handler.stop === 'function') {
                handler.stop();
            }
            this.triggerHandlers.delete(key);
        }
    }
    createTriggerHandler(process, trigger) {
        switch (trigger.type) {
            case 'event':
                return this.createEventTrigger(process, trigger);
            case 'schedule':
                return this.createScheduleTrigger(process, trigger);
            case 'condition':
                return this.createConditionTrigger(process, trigger);
            case 'api':
                return this.createApiTrigger(process, trigger);
            default:
                return null;
        }
    }
    createEventTrigger(process, trigger) {
        const config = trigger.config.event;
        const handler = (event) => {
            if (this.matchesEventFilters(event, config.filters)) {
                this.executeProcess(process.id, { trigger: trigger.id, event });
            }
        };
        this.on(`${config.source}:${config.type}`, handler);
        return {
            stop: () => this.off(`${config.source}:${config.type}`, handler)
        };
    }
    createScheduleTrigger(process, trigger) {
        const config = trigger.config.schedule;
        if (config.cron) {
            const scheduledWorkflow = this.workflowEngine.scheduleWorkflow(`process-${process.id}`, { type: 'cron', value: config.cron, timezone: config.timezone }, { trigger: trigger.id });
            return {
                stop: () => this.workflowEngine.cancelSchedule(scheduledWorkflow.id)
            };
        }
        else if (config.interval) {
            const intervalId = setInterval(() => {
                this.executeProcess(process.id, { trigger: trigger.id });
            }, config.interval);
            return {
                stop: () => clearInterval(intervalId)
            };
        }
        return null;
    }
    createConditionTrigger(process, trigger) {
        const config = trigger.config.condition;
        const checkCondition = async () => {
            try {
                const func = new Function('return ' + config.expression);
                if (func()) {
                    await this.executeProcess(process.id, { trigger: trigger.id });
                }
            }
            catch (error) {
                console.error(`Condition trigger error for ${trigger.name}:`, error);
            }
        };
        const intervalId = setInterval(checkCondition, config.checkInterval);
        return {
            stop: () => clearInterval(intervalId)
        };
    }
    createApiTrigger(process, trigger) {
        this.emit('api:register', {
            processId: process.id,
            triggerId: trigger.id,
            config: trigger.config.api
        });
        return {
            stop: () => {
                this.emit('api:unregister', {
                    processId: process.id,
                    triggerId: trigger.id
                });
            }
        };
    }
    matchesEventFilters(event, filters) {
        if (!filters)
            return true;
        for (const [key, value] of Object.entries(filters)) {
            const eventValue = this.getNestedValue(event, key);
            if (eventValue !== value)
                return false;
        }
        return true;
    }
    getProcess(processId) {
        return this.processes.get(processId);
    }
    getProcesses(filter) {
        let processes = Array.from(this.processes.values());
        if (filter) {
            if (filter.category) {
                processes = processes.filter(p => p.category === filter.category);
            }
            if (filter.status) {
                processes = processes.filter(p => p.status === filter.status);
            }
            if (filter.owner) {
                processes = processes.filter(p => p.owner === filter.owner);
            }
            if (filter.tags && filter.tags.length > 0) {
                processes = processes.filter(p => filter.tags.some(tag => p.metadata.tags.includes(tag)));
            }
        }
        return processes;
    }
    getExecution(executionId) {
        return this.executions.get(executionId);
    }
    getExecutions(filter) {
        let executions = Array.from(this.executions.values());
        if (filter) {
            if (filter.processId) {
                executions = executions.filter(e => e.processId === filter.processId);
            }
            if (filter.status) {
                executions = executions.filter(e => e.status === filter.status);
            }
            if (filter.startDate) {
                executions = executions.filter(e => e.startTime >= filter.startDate);
            }
            if (filter.endDate) {
                executions = executions.filter(e => e.startTime <= filter.endDate);
            }
        }
        return executions;
    }
    getProcessMetrics(processId) {
        const executions = this.getExecutions({ processId });
        if (executions.length === 0) {
            return null;
        }
        const completedExecutions = executions.filter(e => e.status === 'completed');
        const failedExecutions = executions.filter(e => e.status === 'failed');
        return {
            totalExecutions: executions.length,
            completedExecutions: completedExecutions.length,
            failedExecutions: failedExecutions.length,
            successRate: completedExecutions.length / executions.length,
            averageDuration: completedExecutions.reduce((sum, e) => sum + (e.metrics.totalDuration || 0), 0) / completedExecutions.length,
            averageSLACompliance: executions.reduce((sum, e) => sum + e.metrics.slaCompliance, 0) / executions.length,
            kpiAverages: this.calculateKPIAverages(completedExecutions)
        };
    }
    calculateKPIAverages(executions) {
        const kpiSums = {};
        const kpiCounts = {};
        for (const execution of executions) {
            for (const [kpiId, value] of Object.entries(execution.metrics.kpiValues)) {
                kpiSums[kpiId] = (kpiSums[kpiId] || 0) + value;
                kpiCounts[kpiId] = (kpiCounts[kpiId] || 0) + 1;
            }
        }
        const averages = {};
        for (const kpiId of Object.keys(kpiSums)) {
            averages[kpiId] = kpiSums[kpiId] / kpiCounts[kpiId];
        }
        return averages;
    }
}
exports.ProcessManager = ProcessManager;
//# sourceMappingURL=ProcessDefinition.js.map