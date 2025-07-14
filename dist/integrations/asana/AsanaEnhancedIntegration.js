"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsanaEnhancedIntegration = void 0;
const IntegrationFramework_1 = require("../core/IntegrationFramework");
const asana_integration_1 = require("./asana-integration");
class AsanaEnhancedIntegration extends IntegrationFramework_1.BaseIntegration {
    asanaClient;
    swarmMemory;
    hitlSystem;
    syncInterval;
    webhookHandlers = new Map();
    constructor(config, swarmMemory, hitlSystem) {
        super(config);
        this.swarmMemory = swarmMemory;
        this.hitlSystem = hitlSystem;
        this.asanaClient = new asana_integration_1.AsanaIntegration({
            accessToken: config.authConfig.oauth2?.accessToken || config.authConfig.apiKey?.key || '',
            workspace: config.workspace
        });
        this.setupAsanaEventHandlers();
        this.registerWebhookHandlers();
    }
    setupAsanaEventHandlers() {
        this.asanaClient.on('project-created', (project) => {
            this.emit('asana:project_created', project);
            this.syncToSwarmMemory('project', project);
        });
        this.asanaClient.on('task-created', (task) => {
            this.emit('asana:task_created', task);
            this.syncToSwarmMemory('task', task);
        });
        this.asanaClient.on('task-updated', (task) => {
            this.emit('asana:task_updated', task);
            this.checkHITLRequirements(task);
        });
        this.asanaClient.on('rate-limit-exceeded', (data) => {
            this.emit('asana:rate_limit', data);
        });
    }
    registerWebhookHandlers() {
        this.webhookHandlers.set('task.status_changed', async (event) => {
            await this.handleTaskStatusChange(event);
        });
        this.webhookHandlers.set('task.assigned', async (event) => {
            await this.handleTaskAssignment(event);
        });
        this.webhookHandlers.set('project.status_updated', async (event) => {
            await this.handleProjectStatusUpdate(event);
        });
        this.webhookHandlers.set('custom_field.changed', async (event) => {
            await this.handleCustomFieldChange(event);
        });
    }
    async initialize() {
        const isConnected = await this.testConnection();
        if (!isConnected) {
            throw new Error('Failed to connect to Asana');
        }
        if (!this.config.workspace) {
            const workspaces = await this.asanaClient.getWorkspaces();
            if (workspaces.length > 0) {
                this.config.workspace = workspaces[0].gid;
            }
        }
        if (this.config.syncInterval) {
            this.startSync();
        }
        if (this.config.enableWebhooks) {
            await this.setupWebhooks();
        }
        this.emit('initialized', { integrationId: this.config.id });
    }
    async testConnection() {
        try {
            return await this.asanaClient.testConnection();
        }
        catch (error) {
            this.emit('connection:failed', { error });
            return false;
        }
    }
    async cleanup() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        await this.cleanupWebhooks();
        this.emit('cleanup:completed', { integrationId: this.config.id });
    }
    async createRevOpsProject(clientName, options) {
        try {
            const revOpsData = await this.asanaClient.setupRevOpsProject(clientName, options?.templateId || this.config.defaultProjectTemplateId);
            if (options?.customFields) {
                await this.applyCustomFields(revOpsData.projects[0].gid, options.customFields);
            }
            if (options?.initialTasks) {
                for (const taskData of options.initialTasks) {
                    await this.asanaClient.createTask({
                        name: taskData.name,
                        notes: taskData.notes,
                        projects: [revOpsData.projects[0].gid],
                        assignee: taskData.assignee
                    });
                }
            }
            if (this.swarmMemory) {
                await this.swarmMemory.store(`asana:project:${revOpsData.projects[0].gid}`, {
                    clientName,
                    projectData: revOpsData,
                    createdAt: new Date(),
                    integrationId: this.config.id
                });
            }
            if (this.hitlSystem) {
                await this.createProjectWorkflow(revOpsData.projects[0]);
            }
            this.emit('revops:project_created', { clientName, data: revOpsData });
            return revOpsData;
        }
        catch (error) {
            this.emit('revops:project_creation_failed', { clientName, error });
            throw error;
        }
    }
    async syncProjectWithNotion(asanaProjectGid, notionDatabaseId) {
        try {
            const project = await this.asanaClient.getProject(asanaProjectGid);
            const tasks = await this.asanaClient.getProjectTasks(asanaProjectGid);
            if (this.swarmMemory) {
                await this.swarmMemory.store(`integration:sync:asana-notion:${asanaProjectGid}`, {
                    asanaProjectGid,
                    notionDatabaseId,
                    lastSync: new Date(),
                    taskCount: tasks.length
                });
            }
            this.emit('sync:asana_notion_completed', { asanaProjectGid, notionDatabaseId });
        }
        catch (error) {
            this.emit('sync:asana_notion_failed', { asanaProjectGid, notionDatabaseId, error });
            throw error;
        }
    }
    async createTaskWithApproval(taskData, approvalConfig) {
        try {
            const task = await this.asanaClient.createTask(taskData);
            if (approvalConfig.requiresApproval && this.hitlSystem) {
                const orchestrator = this.hitlSystem.getComponent('orchestrator');
                if (orchestrator) {
                    const decision = await orchestrator.createDecision({
                        title: `Approve Task: ${task.name}`,
                        description: `Task requires approval: ${task.notes || 'No description'}`,
                        type: 'task_approval',
                        source: 'asana_integration',
                        requiresApproval: true,
                        context: {
                            asanaTaskGid: task.gid,
                            taskData: task,
                            approvers: approvalConfig.approvers,
                            approvalThreshold: approvalConfig.approvalThreshold
                        },
                        options: [
                            { id: 'approve', label: 'Approve', value: true },
                            { id: 'reject', label: 'Reject', value: false }
                        ]
                    });
                    if (this.swarmMemory) {
                        await this.swarmMemory.store(`asana:task:approval:${task.gid}`, {
                            taskGid: task.gid,
                            decisionId: decision.id,
                            approvalConfig,
                            createdAt: new Date()
                        });
                    }
                }
            }
            this.emit('task:created_with_approval', { task, approvalConfig });
            return task;
        }
        catch (error) {
            this.emit('task:creation_failed', { taskData, error });
            throw error;
        }
    }
    async bulkUpdateTasks(updates) {
        const results = [];
        for (const update of updates) {
            try {
                await this.asanaClient.updateTask(update.taskGid, update.updates);
                results.push({ taskGid: update.taskGid, success: true });
            }
            catch (error) {
                results.push({ taskGid: update.taskGid, success: false, error });
            }
        }
        this.emit('bulk:tasks_updated', { results });
        return results;
    }
    async handleWebhook(event, signature) {
        if (this.config.webhookSecret && signature) {
            if (!this.verifyWebhookSignature(event, signature)) {
                throw new Error('Invalid webhook signature');
            }
        }
        const eventType = `${event.resource}.${event.action}`;
        const handler = this.webhookHandlers.get(eventType);
        if (handler) {
            await handler(event);
        }
        else {
            this.emit('webhook:unhandled', { eventType, event });
        }
    }
    verifyWebhookSignature(event, signature) {
        return true;
    }
    async handleTaskStatusChange(event) {
        const { gid: taskGid, fields } = event.resource;
        if (fields.completed && this.swarmMemory) {
            const approvalData = await this.swarmMemory.retrieve(`asana:task:approval:${taskGid}`);
            if (approvalData && this.hitlSystem) {
                const orchestrator = this.hitlSystem.getComponent('orchestrator');
                if (orchestrator) {
                    await orchestrator.completeDecision(approvalData.decisionId, {
                        outcome: 'completed',
                        metadata: { completedAt: new Date() }
                    });
                }
            }
        }
        this.emit('webhook:task_status_changed', event);
    }
    async handleTaskAssignment(event) {
        const { gid: taskGid, assignee } = event.resource;
        if (this.hitlSystem && assignee) {
            const delegationManager = this.hitlSystem.getComponent('delegation');
            if (delegationManager) {
                await delegationManager.createTask({
                    title: `Asana Task Assigned: ${event.resource.name}`,
                    type: 'asana_task',
                    assignee: assignee.email,
                    dueDate: event.resource.due_on ? new Date(event.resource.due_on) : undefined,
                    metadata: {
                        asanaTaskGid: taskGid,
                        asanaAssigneeGid: assignee.gid
                    }
                });
            }
        }
        this.emit('webhook:task_assigned', event);
    }
    async handleProjectStatusUpdate(event) {
        const { gid: projectGid, current_status } = event.resource;
        if (this.swarmMemory) {
            await this.swarmMemory.store(`asana:project:status:${projectGid}:${Date.now()}`, {
                projectGid,
                status: current_status,
                timestamp: new Date()
            });
        }
        this.emit('webhook:project_status_updated', event);
    }
    async handleCustomFieldChange(event) {
        const { gid, custom_fields } = event.resource;
        const customFieldMappings = this.config.customFieldMappings;
        if (customFieldMappings) {
            for (const [fieldName, action] of Object.entries(customFieldMappings)) {
                const field = custom_fields.find((f) => f.name === fieldName);
                if (field && field.enum_value) {
                    await this.handleCustomFieldAction(gid, fieldName, field.enum_value.name, action);
                }
            }
        }
        this.emit('webhook:custom_field_changed', event);
    }
    async syncToSwarmMemory(type, data) {
        if (!this.swarmMemory)
            return;
        await this.swarmMemory.store(`asana:${type}:${data.gid || data.id}`, {
            type,
            data,
            syncedAt: new Date(),
            integrationId: this.config.id
        });
    }
    async checkHITLRequirements(task) {
        if (!this.hitlSystem)
            return;
        const requiresReview = task.custom_fields?.some((f) => f.name === 'Priority' && f.enum_value?.name === 'Critical') ||
            task.custom_fields?.some((f) => f.name === 'Revenue Impact' && f.enum_value?.name === 'High Impact');
        if (requiresReview) {
            const orchestrator = this.hitlSystem.getComponent('orchestrator');
            if (orchestrator) {
                await orchestrator.createDecision({
                    title: `Review Critical Task: ${task.name}`,
                    description: task.notes || 'Critical task requires review',
                    type: 'task_review',
                    source: 'asana_integration',
                    requiresApproval: true,
                    criticalityScore: 0.8,
                    context: {
                        asanaTaskGid: task.gid,
                        taskData: task
                    }
                });
            }
        }
    }
    async createProjectWorkflow(project) {
        if (!this.hitlSystem)
            return;
        const workflowEngine = this.hitlSystem.getComponent('workflows');
        if (workflowEngine) {
            await workflowEngine.createWorkflow({
                name: `${project.name} - Review Workflow`,
                description: 'Automated review workflow for project milestones',
                stages: [
                    {
                        id: 'kickoff',
                        name: 'Project Kickoff',
                        type: 'approval',
                        config: {
                            requiresApproval: true,
                            approvers: ['project_manager'],
                            timeoutMinutes: 1440
                        }
                    },
                    {
                        id: 'milestone_review',
                        name: 'Milestone Review',
                        type: 'review',
                        config: {
                            requiresApproval: true,
                            minApprovers: 2,
                            timeoutMinutes: 2880
                        }
                    },
                    {
                        id: 'completion',
                        name: 'Project Completion',
                        type: 'notification',
                        config: {
                            notifyChannels: ['email', 'slack']
                        }
                    }
                ],
                metadata: {
                    asanaProjectGid: project.gid,
                    integrationId: this.config.id
                }
            });
        }
    }
    async applyCustomFields(projectGid, customFields) {
        const existingFields = await this.asanaClient.getCustomFields();
        for (const [fieldName, value] of Object.entries(customFields)) {
            const field = existingFields.find(f => f.name === fieldName);
            if (field) {
                this.emit('custom_field:applied', { projectGid, fieldName, value });
            }
        }
    }
    async handleCustomFieldAction(resourceGid, fieldName, value, action) {
        switch (action) {
            case 'escalate':
                if (this.hitlSystem) {
                    await this.hitlSystem.createHumanTask({
                        title: `Escalation Required: ${fieldName} = ${value}`,
                        type: 'escalation',
                        priority: 'high',
                        metadata: {
                            asanaResourceGid: resourceGid,
                            fieldName,
                            value
                        }
                    });
                }
                break;
            case 'notify':
                this.emit('custom_field:notification_required', {
                    resourceGid,
                    fieldName,
                    value
                });
                break;
            case 'sync':
                await this.syncToSwarmMemory('custom_field_change', {
                    resourceGid,
                    fieldName,
                    value,
                    timestamp: new Date()
                });
                break;
        }
    }
    startSync() {
        const interval = this.config.syncInterval || 300000;
        this.syncInterval = setInterval(async () => {
            await this.performSync();
        }, interval);
        this.performSync();
    }
    async performSync() {
        try {
            const workspaceGid = this.config.workspace || this.config.workspace;
            if (workspaceGid) {
                this.emit('sync:started', { integrationId: this.config.id });
            }
        }
        catch (error) {
            this.emit('sync:failed', { integrationId: this.config.id, error });
        }
    }
    async setupWebhooks() {
        this.emit('webhooks:setup_started', { integrationId: this.config.id });
    }
    async cleanupWebhooks() {
        try {
            const webhooks = await this.asanaClient.getWebhooks();
            for (const webhook of webhooks) {
                await this.asanaClient.deleteWebhook(webhook.gid);
            }
            this.emit('webhooks:cleaned_up', { integrationId: this.config.id });
        }
        catch (error) {
            this.emit('webhooks:cleanup_failed', { integrationId: this.config.id, error });
        }
    }
    getAsanaClient() {
        return this.asanaClient;
    }
    async getProjectAnalytics(projectGid) {
        const tasks = await this.asanaClient.getProjectTasks(projectGid);
        const analytics = {
            totalTasks: tasks.length,
            completedTasks: tasks.filter(t => t.completed).length,
            overdueTasks: tasks.filter(t => !t.completed && t.due_on && new Date(t.due_on) < new Date()).length,
            tasksByAssignee: this.groupTasksByAssignee(tasks),
            tasksByStatus: this.groupTasksByStatus(tasks),
            averageCompletionTime: await this.calculateAverageCompletionTime(tasks)
        };
        return analytics;
    }
    groupTasksByAssignee(tasks) {
        const grouped = {};
        for (const task of tasks) {
            const assignee = task.assignee?.name || 'Unassigned';
            grouped[assignee] = (grouped[assignee] || 0) + 1;
        }
        return grouped;
    }
    groupTasksByStatus(tasks) {
        return {
            completed: tasks.filter(t => t.completed).length,
            pending: tasks.filter(t => !t.completed).length
        };
    }
    async calculateAverageCompletionTime(tasks) {
        return 0;
    }
}
exports.AsanaEnhancedIntegration = AsanaEnhancedIntegration;
exports.default = AsanaEnhancedIntegration;
//# sourceMappingURL=AsanaEnhancedIntegration.js.map