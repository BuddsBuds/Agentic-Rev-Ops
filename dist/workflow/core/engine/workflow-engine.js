"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowExecutionEngine = void 0;
const events_1 = require("events");
const uuid_1 = require("uuid");
class WorkflowExecutionEngine extends events_1.EventEmitter {
    workflows = new Map();
    executionContexts = new Map();
    executionQueue = new Map();
    stepExecutors = new Map();
    activeExecutions = new Set();
    pausedExecutions = new Set();
    constructor() {
        super();
        this.registerDefaultExecutors();
    }
    registerDefaultExecutors() {
        this.registerStepExecutor('action', new ActionStepExecutor());
        this.registerStepExecutor('condition', new ConditionStepExecutor());
        this.registerStepExecutor('parallel', new ParallelStepExecutor());
        this.registerStepExecutor('sequential', new SequentialStepExecutor());
        this.registerStepExecutor('loop', new LoopStepExecutor());
        this.registerStepExecutor('wait', new WaitStepExecutor());
        this.registerStepExecutor('subworkflow', new SubworkflowStepExecutor(this));
    }
    registerStepExecutor(type, executor) {
        this.stepExecutors.set(type, executor);
    }
}
exports.WorkflowExecutionEngine = WorkflowExecutionEngine;
createWorkflow(config, any);
Workflow;
{
    const workflow = {
        id: config.id || (0, uuid_1.v4)(),
        name: config.name || 'Unnamed Workflow',
        description: config.description,
        version: config.version || '1.0.0',
        steps: config.steps || [],
        status: 'idle',
        variables: config.variables || {},
        config: config.config || {},
        metadata: {
            created: new Date(),
            modified: new Date(),
            ...config.metadata
        },
        executionHistory: []
    };
    const validation = this.validateWorkflow(workflow);
    if (!validation.valid) {
        throw new Error(`Invalid workflow: ${validation.errors.join(', ')}`);
    }
    this.workflows.set(workflow.id, workflow);
    this.emit('workflow:created', { workflow });
    return workflow;
}
async;
executeWorkflow(workflowId, string, context ?  : any);
Promise < any > {
    const: workflow = this.workflows.get(workflowId),
    if(, workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
    },
    : .activeExecutions.has(workflowId)
};
{
    throw new Error(`Workflow ${workflowId} is already running`);
}
const executionContext = {
    ...workflow.variables,
    ...context,
    $workflow: {
        id: workflow.id,
        name: workflow.name,
        startTime: new Date()
    },
    $state: {}
};
workflow.status = 'running';
workflow.startTime = new Date();
this.activeExecutions.add(workflowId);
this.executionContexts.set(workflowId, executionContext);
if (workflow.config?.notifications?.onStart) {
    this.emit('notification:send', {
        type: 'workflow:start',
        workflow: workflow.name,
        channels: workflow.config.notifications.channels
    });
}
this.emit('workflow:start', { workflowId, workflow, context: executionContext });
try {
    const result = await this.executeSteps(workflow, executionContext);
    workflow.status = 'completed';
    workflow.endTime = new Date();
    this.activeExecutions.delete(workflowId);
    if (workflow.config?.notifications?.onComplete) {
        this.emit('notification:send', {
            type: 'workflow:complete',
            workflow: workflow.name,
            duration: workflow.endTime.getTime() - workflow.startTime.getTime(),
            channels: workflow.config.notifications.channels
        });
    }
    this.emit('workflow:complete', { workflowId, result, duration: workflow.endTime.getTime() - workflow.startTime.getTime() });
    return result;
}
catch (error) {
    workflow.status = 'failed';
    workflow.endTime = new Date();
    this.activeExecutions.delete(workflowId);
    if (workflow.config?.notifications?.onError) {
        this.emit('notification:send', {
            type: 'workflow:error',
            workflow: workflow.name,
            error: error instanceof Error ? error.message : String(error),
            channels: workflow.config.notifications.channels
        });
    }
    this.emit('workflow:error', { workflowId, error });
    if (workflow.config?.errorHandling === 'compensate') {
        await this.runCompensation(workflow, executionContext);
    }
    throw error;
}
finally {
    this.executionContexts.delete(workflowId);
}
async;
pauseWorkflow(workflowId, string);
Promise < void  > {
    const: workflow = this.workflows.get(workflowId),
    if(, workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
    },
    if(workflow) { }, : .status !== 'running'
};
{
    throw new Error(`Cannot pause workflow in status: ${workflow.status}`);
}
workflow.status = 'paused';
this.activeExecutions.delete(workflowId);
this.pausedExecutions.add(workflowId);
this.emit('workflow:pause', { workflowId, currentStep: workflow.currentStep });
async;
resumeWorkflow(workflowId, string);
Promise < void  > {
    const: workflow = this.workflows.get(workflowId),
    if(, workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
    },
    if(workflow) { }, : .status !== 'paused'
};
{
    throw new Error(`Cannot resume workflow in status: ${workflow.status}`);
}
workflow.status = 'running';
this.pausedExecutions.delete(workflowId);
this.activeExecutions.add(workflowId);
const context = this.executionContexts.get(workflowId);
this.emit('workflow:resume', { workflowId, currentStep: workflow.currentStep });
if (workflow.currentStep) {
    const currentStepIndex = workflow.steps.findIndex(s => s.id === workflow.currentStep);
    if (currentStepIndex >= 0) {
        const remainingSteps = workflow.steps.slice(currentStepIndex);
        await this.executeStepsFrom(workflow, context, remainingSteps);
    }
}
async;
queueWorkflow(execution, any);
Promise < void  > {
    const: workflowExecution, WorkflowExecution = {
        workflowId: typeof execution === 'string' ? execution : execution.workflowId,
        context: typeof execution === 'object' ? execution.context : undefined,
        priority: execution.priority || 0,
        scheduledTime: execution.scheduledTime
    },
    this: .executionQueue.set(workflowExecution.workflowId, workflowExecution),
    const: sortedQueue = Array.from(this.executionQueue.values())
        .sort((a, b) => {
        if (a.scheduledTime && b.scheduledTime) {
            return a.scheduledTime.getTime() - b.scheduledTime.getTime();
        }
        return b.priority - a.priority;
    }),
    for(, exec, of, sortedQueue) {
        if (!this.activeExecutions.has(exec.workflowId)) {
            const delay = exec.scheduledTime ?
                Math.max(0, exec.scheduledTime.getTime() - Date.now()) : 0;
            setTimeout(async () => {
                try {
                    this.executionQueue.delete(exec.workflowId);
                    await this.executeWorkflow(exec.workflowId, exec.context);
                }
                catch (error) {
                    this.emit('workflow:queue-error', { workflowId: exec.workflowId, error });
                }
            }, delay);
        }
    }
};
async;
pauseExecution(workflowId, string);
Promise < void  > {
    return: this.pauseWorkflow(workflowId)
};
async;
resumeExecution(workflowId, string);
Promise < void  > {
    return: this.resumeWorkflow(workflowId)
};
async;
cancelExecution(workflowId, string);
Promise < void  > {
    const: workflow = this.workflows.get(workflowId),
    if(, workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
    },
    const: previousStatus = workflow.status,
    workflow, : .status = 'cancelled',
    workflow, : .endTime = new Date(),
    this: .activeExecutions.delete(workflowId),
    this: .pausedExecutions.delete(workflowId),
    this: .executionQueue.delete(workflowId),
    this: .executionContexts.delete(workflowId),
    this: .emit('workflow:cancelled', {
        workflowId,
        previousStatus,
        currentStep: workflow.currentStep
    })
};
async;
executeSteps(workflow, Workflow, context, any);
Promise < any > {
    return: this.executeStepsFrom(workflow, context, workflow.steps)
};
async;
executeStepsFrom(workflow, Workflow, context, any, steps, WorkflowStep[]);
Promise < any > {
    let, stepContext = { ...context },
    for(, step, of, steps) {
        if (workflow.status === 'paused' || workflow.status === 'cancelled') {
            break;
        }
        if (step.dependencies && step.dependencies.length > 0) {
            const dependenciesMet = step.dependencies.every(depId => {
                const depStep = workflow.steps.find(s => s.id === depId);
                return depStep && depStep.status === 'completed';
            });
            if (!dependenciesMet) {
                step.status = 'skipped';
                this.emit('step:skipped', { workflowId: workflow.id, step, reason: 'dependencies not met' });
                continue;
            }
        }
        workflow.currentStep = step.id;
        step.status = 'running';
        step.startTime = new Date();
        step.retryCount = step.retryCount || 0;
        this.emit('step:start', { workflowId: workflow.id, step });
        try {
            const executeWithTimeout = step.timeout ?
                this.withTimeout(this.executeStep(step, stepContext, workflow), step.timeout) :
                this.executeStep(step, stepContext, workflow);
            const result = await executeWithTimeout;
            step.status = 'completed';
            step.result = result;
            step.endTime = new Date();
            stepContext = {
                ...stepContext,
                [step.id]: result,
                $lastStep: {
                    id: step.id,
                    result,
                    duration: step.endTime.getTime() - step.startTime.getTime()
                }
            };
            workflow.executionHistory?.push({
                stepId: step.id,
                status: 'completed',
                timestamp: new Date(),
                duration: step.endTime.getTime() - step.startTime.getTime(),
                result
            });
            this.emit('step:complete', { workflowId: workflow.id, step, result });
        }
        catch (error) {
            step.error = error instanceof Error ? error : new Error(String(error));
            step.endTime = new Date();
            if (step.onError === 'retry' && step.retryCount < (step.maxRetries || 3)) {
                step.retryCount++;
                this.emit('step:retry', { workflowId: workflow.id, step, attempt: step.retryCount });
                await new Promise(resolve => setTimeout(resolve, workflow.config?.retryDelay || 1000));
                steps.unshift(step);
                continue;
            }
            step.status = 'failed';
            workflow.executionHistory?.push({
                stepId: step.id,
                status: 'failed',
                timestamp: new Date(),
                duration: step.endTime.getTime() - step.startTime.getTime(),
                error: step.error
            });
            this.emit('step:error', { workflowId: workflow.id, step, error });
            if (step.onError === 'continue') {
                stepContext[step.id] = { error: step.error.message };
                continue;
            }
            else if (step.onError === 'compensate' && step.compensationStep) {
                const compensationStep = workflow.steps.find(s => s.id === step.compensationStep);
                if (compensationStep) {
                    await this.executeStep(compensationStep, stepContext, workflow);
                }
            }
            throw error;
        }
    },
    return: stepContext
};
async;
executeStep(step, WorkflowStep, context, any, workflow, Workflow);
Promise < any > {
    const: executor = this.stepExecutors.get(step.type),
    if(, executor) {
        throw new Error(`No executor found for step type: ${step.type}`);
    },
    try: {
        return: await executor.execute(step, context, workflow)
    }, catch(error) {
        this.emit('step:execution-error', {
            workflowId: workflow.id,
            stepId: step.id,
            stepType: step.type,
            error,
            context
        });
        throw error;
    }
};
async;
withTimeout(promise, (Promise), timeout, number);
Promise < T > {
    return: Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Step execution timeout')), timeout))
    ])
};
async;
runCompensation(workflow, Workflow, context, any);
Promise < void  > {
    this: .emit('workflow:compensation-start', { workflowId: workflow.id }),
    const: completedSteps = workflow.steps
        .filter(s => s.status === 'completed' && s.compensationStep)
        .reverse(),
    for(, step, of, completedSteps) {
        const compensationStep = workflow.steps.find(s => s.id === step.compensationStep);
        if (compensationStep) {
            try {
                await this.executeStep(compensationStep, context, workflow);
                this.emit('workflow:compensation-step', {
                    workflowId: workflow.id,
                    originalStep: step.id,
                    compensationStep: compensationStep.id
                });
            }
            catch (error) {
                this.emit('workflow:compensation-error', {
                    workflowId: workflow.id,
                    step: compensationStep.id,
                    error
                });
            }
        }
    },
    this: .emit('workflow:compensation-complete', { workflowId: workflow.id })
};
getWorkflow(workflowId, string);
Workflow | undefined;
{
    return this.workflows.get(workflowId);
}
getWorkflowStatus(workflowId, string);
WorkflowStatus | undefined;
{
    const workflow = this.workflows.get(workflowId);
    if (!workflow)
        return undefined;
    const completedSteps = workflow.steps.filter(s => s.status === 'completed').length;
    const totalSteps = workflow.steps.length;
    return {
        workflowId,
        status: workflow.status,
        currentStep: workflow.currentStep,
        progress: totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0,
        startTime: workflow.startTime,
        estimatedCompletion: this.estimateCompletion(workflow),
        errors: workflow.steps
            .filter(s => s.error)
            .map(s => s.error)
    };
}
estimateCompletion(workflow, Workflow);
Date | undefined;
{
    if (!workflow.startTime || workflow.status !== 'running')
        return undefined;
    const completedSteps = workflow.steps.filter(s => s.status === 'completed');
    const avgDuration = completedSteps.reduce((sum, step) => {
        if (step.startTime && step.endTime) {
            return sum + (step.endTime.getTime() - step.startTime.getTime());
        }
        return sum;
    }, 0) / completedSteps.length;
    const remainingSteps = workflow.steps.filter(s => s.status === 'pending' || s.status === 'running').length;
    const estimatedRemainingTime = avgDuration * remainingSteps;
    return new Date(Date.now() + estimatedRemainingTime);
}
getExecutionHistory(workflowId, string);
ExecutionRecord[];
{
    const workflow = this.workflows.get(workflowId);
    return workflow?.executionHistory || [];
}
validateWorkflow(workflow, Workflow);
ValidationResult;
{
    const errors = [];
    const warnings = [];
    if (!workflow.id)
        errors.push('Workflow must have an ID');
    if (!workflow.name)
        errors.push('Workflow must have a name');
    if (!workflow.steps || workflow.steps.length === 0) {
        errors.push('Workflow must have at least one step');
    }
    const stepIds = new Set();
    for (const step of workflow.steps) {
        if (!step.id) {
            errors.push('All steps must have an ID');
        }
        else if (stepIds.has(step.id)) {
            errors.push(`Duplicate step ID: ${step.id}`);
        }
        else {
            stepIds.add(step.id);
        }
        if (!step.name)
            warnings.push(`Step ${step.id} should have a name`);
        if (!step.type)
            errors.push(`Step ${step.id} must have a type`);
        if (step.type && !this.stepExecutors.has(step.type)) {
            errors.push(`Unknown step type: ${step.type}`);
        }
        if (step.dependencies) {
            for (const depId of step.dependencies) {
                if (!stepIds.has(depId)) {
                    errors.push(`Step ${step.id} depends on unknown step: ${depId}`);
                }
            }
        }
        if (step.compensationStep && !stepIds.has(step.compensationStep)) {
            errors.push(`Step ${step.id} has unknown compensation step: ${step.compensationStep}`);
        }
        const executor = this.stepExecutors.get(step.type);
        if (executor) {
            const stepErrors = executor.validate(step);
            errors.push(...stepErrors);
        }
    }
    if (this.hasCircularDependencies(workflow)) {
        errors.push('Workflow contains circular dependencies');
    }
    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}
hasCircularDependencies(workflow, Workflow);
boolean;
{
    const visited = new Set();
    const recursionStack = new Set();
    const hasCycle = (stepId) => {
        visited.add(stepId);
        recursionStack.add(stepId);
        const step = workflow.steps.find(s => s.id === stepId);
        if (step?.dependencies) {
            for (const depId of step.dependencies) {
                if (!visited.has(depId)) {
                    if (hasCycle(depId))
                        return true;
                }
                else if (recursionStack.has(depId)) {
                    return true;
                }
            }
        }
        recursionStack.delete(stepId);
        return false;
    };
    for (const step of workflow.steps) {
        if (!visited.has(step.id)) {
            if (hasCycle(step.id))
                return true;
        }
    }
    return false;
}
class ActionStepExecutor {
    async execute(step, context, workflow) {
        const { action, params } = step.config;
        if (typeof action === 'function') {
            return await action(params, context, workflow);
        }
        switch (action) {
            case 'log':
                console.log(`[${workflow.name}] ${params.message}`, params.data || '');
                return { logged: true };
            case 'setVariable':
                return params.value;
            case 'httpRequest':
                return { status: 200, body: {} };
            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }
    validate(step) {
        const errors = [];
        if (!step.config?.action) {
            errors.push(`Action step ${step.id} must have an action`);
        }
        return errors;
    }
}
class ConditionStepExecutor {
    async execute(step, context) {
        const { expression, truePath, falsePath } = step.config;
        const result = this.evaluateExpression(expression, context);
        return {
            result,
            nextStep: result ? truePath : falsePath
        };
    }
    evaluateExpression(expression, context) {
        try {
            const func = new Function('context', `with(context) { return ${expression}; }`);
            return !!func(context);
        }
        catch (error) {
            console.error('Expression evaluation error:', error);
            return false;
        }
    }
    validate(step) {
        const errors = [];
        if (!step.config?.expression) {
            errors.push(`Condition step ${step.id} must have an expression`);
        }
        return errors;
    }
}
class ParallelStepExecutor {
    async execute(step, context, workflow) {
        const { steps, maxConcurrency = Infinity } = step.config;
        if (!steps || steps.length === 0) {
            return {};
        }
        const results = {};
        const chunks = this.chunkArray(steps, maxConcurrency);
        for (const chunk of chunks) {
            const promises = chunk.map(async (subStep) => {
                const engine = new WorkflowExecutionEngine();
                const result = await engine.executeStep(subStep, context, workflow);
                results[subStep.id] = result;
            });
            await Promise.all(promises);
        }
        return results;
    }
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
    validate(step) {
        const errors = [];
        if (!step.config?.steps || !Array.isArray(step.config.steps)) {
            errors.push(`Parallel step ${step.id} must have a steps array`);
        }
        return errors;
    }
}
class SequentialStepExecutor {
    async execute(step, context, workflow) {
        const { steps } = step.config;
        if (!steps || steps.length === 0) {
            return {};
        }
        let currentContext = { ...context };
        const results = {};
        for (const subStep of steps) {
            const engine = new WorkflowExecutionEngine();
            const result = await engine.executeStep(subStep, currentContext, workflow);
            results[subStep.id] = result;
            currentContext[subStep.id] = result;
        }
        return results;
    }
    validate(step) {
        const errors = [];
        if (!step.config?.steps || !Array.isArray(step.config.steps)) {
            errors.push(`Sequential step ${step.id} must have a steps array`);
        }
        return errors;
    }
}
class LoopStepExecutor {
    async execute(step, context, workflow) {
        const { items, itemVariable = 'item', indexVariable = 'index', body } = step.config;
        if (!items || !Array.isArray(items)) {
            return [];
        }
        const results = [];
        for (let i = 0; i < items.length; i++) {
            const loopContext = {
                ...context,
                [itemVariable]: items[i],
                [indexVariable]: i
            };
            const engine = new WorkflowExecutionEngine();
            const result = await engine.executeStep(body, loopContext, workflow);
            results.push(result);
        }
        return results;
    }
    validate(step) {
        const errors = [];
        if (!step.config?.items) {
            errors.push(`Loop step ${step.id} must have items`);
        }
        if (!step.config?.body) {
            errors.push(`Loop step ${step.id} must have a body`);
        }
        return errors;
    }
}
class WaitStepExecutor {
    async execute(step, context) {
        const { duration, until } = step.config;
        if (duration) {
            await new Promise(resolve => setTimeout(resolve, duration));
        }
        else if (until) {
            const targetTime = new Date(until).getTime();
            const delay = Math.max(0, targetTime - Date.now());
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        return { waited: true };
    }
    validate(step) {
        const errors = [];
        if (!step.config?.duration && !step.config?.until) {
            errors.push(`Wait step ${step.id} must have either duration or until`);
        }
        return errors;
    }
}
class SubworkflowStepExecutor {
    engine;
    constructor(engine) {
        this.engine = engine;
    }
    async execute(step, context) {
        const { workflowId, inputMapping, outputMapping } = step.config;
        let subContext = { ...context };
        if (inputMapping) {
            subContext = this.mapData(context, inputMapping);
        }
        const result = await this.engine.executeWorkflow(workflowId, subContext);
        if (outputMapping) {
            return this.mapData(result, outputMapping);
        }
        return result;
    }
    mapData(source, mapping) {
        const result = {};
        for (const [targetKey, sourceKey] of Object.entries(mapping)) {
            result[targetKey] = this.getNestedValue(source, sourceKey);
        }
        return result;
    }
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
    validate(step) {
        const errors = [];
        if (!step.config?.workflowId) {
            errors.push(`Subworkflow step ${step.id} must have a workflowId`);
        }
        return errors;
    }
}
//# sourceMappingURL=workflow-engine.js.map