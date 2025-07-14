"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsanaIntegration = void 0;
const events_1 = require("events");
const axios_1 = __importDefault(require("axios"));
class AsanaIntegration extends events_1.EventEmitter {
    client;
    config;
    rateLimitRemaining = 1500;
    rateLimitResetTime = new Date();
    constructor(config) {
        super();
        this.config = {
            baseUrl: 'https://app.asana.com/api/1.0',
            ...config
        };
        this.client = axios_1.default.create({
            baseURL: this.config.baseUrl,
            headers: {
                'Authorization': `Bearer ${this.config.accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Asana-Enable': 'string_ids,new_user_task_lists'
            },
            timeout: 30000
        });
        this.setupResponseInterceptors();
    }
    setupResponseInterceptors() {
        this.client.interceptors.response.use((response) => {
            if (response.headers['x-ratelimit-remaining']) {
                this.rateLimitRemaining = parseInt(response.headers['x-ratelimit-remaining']);
            }
            if (response.headers['x-ratelimit-reset']) {
                this.rateLimitResetTime = new Date(parseInt(response.headers['x-ratelimit-reset']) * 1000);
            }
            return response;
        }, (error) => {
            if (error.response?.status === 429) {
                const retryAfter = error.response.headers['retry-after'] || 60;
                this.emit('rate-limit-exceeded', { retryAfter });
            }
            return Promise.reject(error);
        });
    }
    async testConnection() {
        try {
            const response = await this.client.get('/users/me');
            return response.status === 200;
        }
        catch (error) {
            this.emit('connection-error', error);
            return false;
        }
    }
    async getCurrentUser() {
        const response = await this.client.get('/users/me');
        return response.data.data;
    }
    async getWorkspaces() {
        const response = await this.client.get('/workspaces');
        return response.data.data;
    }
    async createProject(projectData) {
        const response = await this.client.post('/projects', {
            data: {
                ...projectData,
                workspace: this.config.workspace
            }
        });
        const project = response.data.data;
        this.emit('project-created', project);
        return project;
    }
    async createProjectFromTemplate(templateGid, projectData) {
        const response = await this.client.post(`/project_templates/${templateGid}/instantiateProject`, {
            data: {
                ...projectData,
                workspace: this.config.workspace
            }
        });
        const project = response.data.data;
        this.emit('project-created-from-template', { template: templateGid, project });
        return project;
    }
    async getProject(projectGid) {
        const response = await this.client.get(`/projects/${projectGid}`, {
            params: {
                opt_fields: 'name,notes,color,team,owner,current_status,due_date,custom_fields,members'
            }
        });
        return response.data.data;
    }
    async updateProject(projectGid, updates) {
        const response = await this.client.put(`/projects/${projectGid}`, {
            data: updates
        });
        const project = response.data.data;
        this.emit('project-updated', project);
        return project;
    }
    async deleteProject(projectGid) {
        await this.client.delete(`/projects/${projectGid}`);
        this.emit('project-deleted', { projectGid });
    }
    async getProjectTasks(projectGid) {
        const response = await this.client.get(`/projects/${projectGid}/tasks`, {
            params: {
                opt_fields: 'name,notes,assignee,due_on,due_at,completed,dependencies,parent,subtasks,tags,custom_fields'
            }
        });
        return response.data.data;
    }
    async createTask(taskData) {
        const response = await this.client.post('/tasks', {
            data: taskData
        });
        const task = response.data.data;
        this.emit('task-created', task);
        return task;
    }
    async getTask(taskGid) {
        const response = await this.client.get(`/tasks/${taskGid}`, {
            params: {
                opt_fields: 'name,notes,projects,assignee,due_on,due_at,completed,dependencies,parent,subtasks,tags,custom_fields,attachments'
            }
        });
        return response.data.data;
    }
    async updateTask(taskGid, updates) {
        const response = await this.client.put(`/tasks/${taskGid}`, {
            data: updates
        });
        const task = response.data.data;
        this.emit('task-updated', task);
        return task;
    }
    async completeTask(taskGid) {
        return this.updateTask(taskGid, { completed: true });
    }
    async deleteTask(taskGid) {
        await this.client.delete(`/tasks/${taskGid}`);
        this.emit('task-deleted', { taskGid });
    }
    async addTaskDependency(taskGid, dependencyGid) {
        await this.client.post(`/tasks/${taskGid}/addDependencies`, {
            data: {
                dependencies: [dependencyGid]
            }
        });
        this.emit('task-dependency-added', { taskGid, dependencyGid });
    }
    async addTaskComment(taskGid, text) {
        const response = await this.client.post(`/tasks/${taskGid}/stories`, {
            data: {
                text,
                type: 'comment'
            }
        });
        const comment = response.data.data;
        this.emit('task-comment-added', { taskGid, comment });
        return comment;
    }
    async createPortfolio(portfolioData) {
        const response = await this.client.post('/portfolios', {
            data: {
                ...portfolioData,
                workspace: this.config.workspace
            }
        });
        const portfolio = response.data.data;
        this.emit('portfolio-created', portfolio);
        return portfolio;
    }
    async getPortfolio(portfolioGid) {
        const response = await this.client.get(`/portfolios/${portfolioGid}`, {
            params: {
                opt_fields: 'name,color,members,projects,created_at,created_by,custom_field_settings,owner,public,workspace'
            }
        });
        return response.data.data;
    }
    async addProjectToPortfolio(portfolioGid, projectGid) {
        await this.client.post(`/portfolios/${portfolioGid}/addItem`, {
            data: {
                item: projectGid
            }
        });
        this.emit('project-added-to-portfolio', { portfolioGid, projectGid });
    }
    async createCustomField(customFieldData) {
        const response = await this.client.post('/custom_fields', {
            data: {
                ...customFieldData,
                workspace: this.config.workspace
            }
        });
        const customField = response.data.data;
        this.emit('custom-field-created', customField);
        return customField;
    }
    async getCustomFields() {
        const response = await this.client.get('/custom_fields', {
            params: {
                workspace: this.config.workspace
            }
        });
        return response.data.data;
    }
    async setCustomFieldValue(taskGid, customFieldGid, value) {
        await this.client.put(`/tasks/${taskGid}`, {
            data: {
                custom_fields: {
                    [customFieldGid]: value
                }
            }
        });
        this.emit('custom-field-updated', { taskGid, customFieldGid, value });
    }
    async createWebhook(webhookData) {
        const response = await this.client.post('/webhooks', {
            data: webhookData
        });
        const webhook = response.data.data;
        this.emit('webhook-created', webhook);
        return webhook;
    }
    async getWebhooks() {
        const response = await this.client.get('/webhooks', {
            params: {
                workspace: this.config.workspace
            }
        });
        return response.data.data;
    }
    async deleteWebhook(webhookGid) {
        await this.client.delete(`/webhooks/${webhookGid}`);
        this.emit('webhook-deleted', { webhookGid });
    }
    async setupRevOpsProject(clientName, templateGid) {
        const portfolio = await this.createPortfolio({
            name: `${clientName} - RevOps Portfolio`,
            color: 'blue',
            public: false
        });
        let project;
        if (templateGid) {
            project = await this.createProjectFromTemplate(templateGid, {
                name: `${clientName} - Revenue Operations`,
                public: false
            });
        }
        else {
            project = await this.createProject({
                name: `${clientName} - Revenue Operations`,
                notes: `Revenue Operations project for ${clientName}`,
                color: 'green',
                public: false
            });
        }
        await this.addProjectToPortfolio(portfolio.gid, project.gid);
        const tasks = await this.createRevOpsTasks(project.gid, clientName);
        const customFields = await this.setupRevOpsCustomFields();
        const webhooks = await this.setupRevOpsWebhooks(project.gid);
        const revOpsData = {
            projects: [project],
            tasks,
            portfolios: [portfolio],
            team_members: await this.getProjectMembers(project.gid),
            custom_fields: customFields,
            webhooks
        };
        this.emit('revops-project-setup', { clientName, data: revOpsData });
        return revOpsData;
    }
    async createRevOpsTasks(projectGid, clientName) {
        const taskTemplates = [
            { name: 'Client Discovery & Analysis', section: 'Discovery' },
            { name: 'Current State Assessment', section: 'Discovery' },
            { name: 'Revenue Process Mapping', section: 'Analysis' },
            { name: 'Technology Stack Audit', section: 'Analysis' },
            { name: 'Strategy Development', section: 'Strategy' },
            { name: 'Implementation Roadmap', section: 'Strategy' },
            { name: 'Process Implementation', section: 'Implementation' },
            { name: 'Technology Integration', section: 'Implementation' },
            { name: 'Training & Enablement', section: 'Implementation' },
            { name: 'Performance Monitoring', section: 'Optimization' },
            { name: 'Continuous Improvement', section: 'Optimization' }
        ];
        const tasks = [];
        for (const template of taskTemplates) {
            const task = await this.createTask({
                name: `${template.name} - ${clientName}`,
                projects: [projectGid],
                notes: `${template.name} for ${clientName} revenue operations project`
            });
            tasks.push(task);
        }
        return tasks;
    }
    async setupRevOpsCustomFields() {
        const customFieldTemplates = [
            {
                name: 'Client Priority',
                type: 'enum',
                enum_options: [
                    { name: 'Critical', color: 'red' },
                    { name: 'High', color: 'orange' },
                    { name: 'Medium', color: 'yellow' },
                    { name: 'Low', color: 'green' }
                ]
            },
            {
                name: 'Revenue Impact',
                type: 'enum',
                enum_options: [
                    { name: 'High Impact', color: 'red' },
                    { name: 'Medium Impact', color: 'yellow' },
                    { name: 'Low Impact', color: 'green' }
                ]
            },
            {
                name: 'Implementation Phase',
                type: 'enum',
                enum_options: [
                    { name: 'Discovery', color: 'blue' },
                    { name: 'Analysis', color: 'purple' },
                    { name: 'Strategy', color: 'orange' },
                    { name: 'Implementation', color: 'green' },
                    { name: 'Optimization', color: 'teal' }
                ]
            },
            {
                name: 'Budget',
                type: 'number',
                description: 'Budget allocation for this task'
            },
            {
                name: 'ROI Estimate',
                type: 'text',
                description: 'Estimated return on investment'
            }
        ];
        const customFields = [];
        for (const template of customFieldTemplates) {
            try {
                const customField = await this.createCustomField(template);
                customFields.push(customField);
            }
            catch (error) {
                console.warn(`Custom field ${template.name} may already exist:`, error);
            }
        }
        return customFields;
    }
    async setupRevOpsWebhooks(projectGid) {
        const webhookConfigs = [
            {
                resource: projectGid,
                target: `${process.env.WEBHOOK_BASE_URL}/asana/project-updates`,
                filters: [
                    { resource_type: 'task', action: 'changed' },
                    { resource_type: 'task', action: 'added' },
                    { resource_type: 'task', action: 'removed' }
                ]
            },
            {
                resource: projectGid,
                target: `${process.env.WEBHOOK_BASE_URL}/asana/status-updates`,
                filters: [
                    { resource_type: 'project', action: 'changed', fields: ['current_status'] }
                ]
            }
        ];
        const webhooks = [];
        for (const config of webhookConfigs) {
            if (config.target.includes('undefined')) {
                console.warn('Webhook base URL not configured, skipping webhook setup');
                continue;
            }
            try {
                const webhook = await this.createWebhook(config);
                webhooks.push(webhook);
            }
            catch (error) {
                console.warn('Failed to create webhook:', error);
            }
        }
        return webhooks;
    }
    async getProjectMembers(projectGid) {
        const response = await this.client.get(`/projects/${projectGid}/project_memberships`, {
            params: {
                opt_fields: 'user.name,user.email'
            }
        });
        return response.data.data.map((membership) => membership.user);
    }
    async searchTasks(query, projectGid) {
        const params = {
            resource_type: 'task',
            query,
            opt_fields: 'name,notes,projects,assignee,due_on,completed'
        };
        if (projectGid) {
            params.projects = projectGid;
        }
        const response = await this.client.get('/search', { params });
        return response.data.data;
    }
    async exportProjectData(projectGid) {
        const project = await this.getProject(projectGid);
        const tasks = await this.getProjectTasks(projectGid);
        const members = await this.getProjectMembers(projectGid);
        return {
            project,
            tasks,
            members,
            exportDate: new Date().toISOString(),
            totalTasks: tasks.length,
            completedTasks: tasks.filter(task => task.completed).length
        };
    }
    getRateLimitStatus() {
        return {
            remaining: this.rateLimitRemaining,
            resetTime: this.rateLimitResetTime
        };
    }
    async waitForRateLimit() {
        if (this.rateLimitRemaining < 10) {
            const waitTime = this.rateLimitResetTime.getTime() - Date.now();
            if (waitTime > 0) {
                this.emit('rate-limit-wait', { waitTime });
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }
}
exports.AsanaIntegration = AsanaIntegration;
exports.default = AsanaIntegration;
//# sourceMappingURL=asana-integration.js.map