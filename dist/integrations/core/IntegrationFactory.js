"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationFactory = void 0;
const IntegrationFramework_1 = require("./IntegrationFramework");
const AsanaEnhancedIntegration_1 = require("../asana/AsanaEnhancedIntegration");
const GoogleEnhancedIntegration_1 = require("../google/GoogleEnhancedIntegration");
const NotionEnhancedIntegration_1 = require("../notion/NotionEnhancedIntegration");
const events_1 = require("events");
class IntegrationFactory extends events_1.EventEmitter {
    manager;
    swarmMemory;
    hitlSystem;
    config;
    templates = new Map();
    integrationCache = new Map();
    constructor(config) {
        super();
        this.config = config;
        this.swarmMemory = config.swarmMemory;
        this.hitlSystem = config.hitlSystem;
        this.manager = new IntegrationFramework_1.IntegrationManager(this.swarmMemory, this.hitlSystem);
        this.initializeTemplates();
        this.setupEventHandlers();
    }
    async createIntegration(type, config, options) {
        try {
            const cacheKey = `${type}:${config.id}`;
            if (this.config.enableCaching && this.integrationCache.has(cacheKey)) {
                return this.integrationCache.get(cacheKey);
            }
            if (options?.templateId) {
                const template = this.templates.get(options.templateId);
                if (template) {
                    config = this.applyTemplate(config, template);
                }
            }
            const defaultConfig = this.config.defaultConfigs?.[type];
            if (defaultConfig) {
                config = { ...defaultConfig, ...config };
            }
            const integration = await this.createIntegrationInstance(type, config);
            if (options?.customHandlers) {
                this.setupCustomHandlers(integration, options.customHandlers);
            }
            await this.manager.registerIntegration(integration);
            if (options?.autoConnect && this.config.autoInitialize) {
                await integration.initialize();
            }
            if (this.config.enableCaching) {
                this.integrationCache.set(cacheKey, integration);
            }
            await this.swarmMemory.store(`integration:created:${config.id}`, {
                type,
                config,
                options,
                createdAt: new Date()
            });
            this.emit('integration:created', { type, id: config.id, integration });
            return integration;
        }
        catch (error) {
            this.emit('integration:creation_failed', { type, config, error });
            throw error;
        }
    }
    async createBulkIntegrations(integrations) {
        const results = new Map();
        const errors = [];
        for (const integration of integrations) {
            try {
                const instance = await this.createIntegration(integration.type, integration.config, integration.options);
                results.set(integration.config.id, instance);
            }
            catch (error) {
                errors.push({
                    id: integration.config.id,
                    type: integration.type,
                    error
                });
            }
        }
        if (errors.length > 0) {
            this.emit('bulk:creation_errors', { errors });
        }
        this.emit('bulk:creation_completed', {
            total: integrations.length,
            successful: results.size,
            failed: errors.length
        });
        return results;
    }
    async createIntegrationWorkflow(name, workflow) {
        try {
            const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const integrationMap = new Map();
            for (const integration of workflow.integrations) {
                const instance = await this.createIntegration(integration.type, integration.config, { autoConnect: true });
                integrationMap.set(integration.config.id, instance);
            }
            await this.setupDataFlow(integrationMap, workflow.dataFlow);
            if (workflow.triggers) {
                await this.setupTriggers(integrationMap, workflow.triggers);
            }
            const workflowConfig = {
                id: workflowId,
                name,
                workflow,
                integrations: Array.from(integrationMap.keys()),
                createdAt: new Date()
            };
            await this.swarmMemory.store(`workflow:${workflowId}`, workflowConfig);
            this.emit('workflow:created', { workflowId, name, integrations: integrationMap.size });
            return workflowConfig;
        }
        catch (error) {
            this.emit('workflow:creation_failed', { name, error });
            throw error;
        }
    }
    getTemplates() {
        return Array.from(this.templates.values());
    }
    getTemplate(templateId) {
        return this.templates.get(templateId);
    }
    createTemplate(template) {
        this.templates.set(template.id, template);
        this.emit('template:created', { template });
    }
    getIntegration(integrationId) {
        return this.manager.getIntegration(integrationId);
    }
    getAllIntegrations() {
        return this.manager.getAllIntegrations();
    }
    getIntegrationsByType(type) {
        return this.manager.getAllIntegrations().filter(integration => this.getIntegrationType(integration) === type);
    }
    async testAllConnections() {
        return await this.manager.testAllConnections();
    }
    getMetrics() {
        const metrics = this.manager.getMetrics();
        const summary = {
            totalIntegrations: this.manager.getAllIntegrations().length,
            byType: this.getIntegrationCountByType(),
            healthStatus: this.getHealthStatus(),
            metrics
        };
        return summary;
    }
    async createRevOpsSuite(clientName, options) {
        const suite = new Map();
        try {
            if (options?.includeAsana !== false) {
                const asana = await this.createIntegration('asana', {
                    id: `asana-${clientName.toLowerCase().replace(/\s+/g, '-')}`,
                    name: `${clientName} - Asana`,
                    type: 'api_key',
                    baseUrl: 'https://app.asana.com/api/1.0',
                    authConfig: {
                        type: 'api_key',
                        apiKey: {
                            key: options?.customConfig?.asanaApiKey || '',
                            placement: 'header',
                            headerName: 'Authorization'
                        }
                    },
                    ...options?.customConfig?.asana
                }, {
                    templateId: 'revops-asana',
                    autoConnect: true
                });
                suite.set('asana', asana);
            }
            if (options?.includeGoogle !== false) {
                const google = await this.createIntegration('google', {
                    id: `google-${clientName.toLowerCase().replace(/\s+/g, '-')}`,
                    name: `${clientName} - Google Workspace`,
                    type: 'oauth2',
                    baseUrl: 'https://www.googleapis.com',
                    authConfig: {
                        type: 'oauth2',
                        oauth2: {
                            clientId: options?.customConfig?.googleClientId || '',
                            clientSecret: options?.customConfig?.googleClientSecret || '',
                            authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
                            tokenUrl: 'https://oauth2.googleapis.com/token',
                            scopes: [
                                'https://www.googleapis.com/auth/drive',
                                'https://www.googleapis.com/auth/documents',
                                'https://www.googleapis.com/auth/spreadsheets',
                                'https://www.googleapis.com/auth/gmail.send',
                                'https://www.googleapis.com/auth/calendar'
                            ],
                            redirectUri: options?.customConfig?.googleRedirectUri || 'http://localhost:3000/auth/callback',
                            grantType: 'authorization_code'
                        }
                    },
                    ...options?.customConfig?.google
                }, {
                    templateId: 'revops-google',
                    autoConnect: true
                });
                suite.set('google', google);
            }
            if (options?.includeNotion !== false) {
                const notion = await this.createIntegration('notion', {
                    id: `notion-${clientName.toLowerCase().replace(/\s+/g, '-')}`,
                    name: `${clientName} - Notion`,
                    type: 'api_key',
                    baseUrl: 'https://api.notion.com/v1',
                    authConfig: {
                        type: 'api_key',
                        apiKey: {
                            key: options?.customConfig?.notionApiKey || '',
                            placement: 'header',
                            headerName: 'Authorization'
                        }
                    },
                    ...options?.customConfig?.notion
                }, {
                    templateId: 'revops-notion',
                    autoConnect: true
                });
                suite.set('notion', notion);
            }
            if (suite.size > 1) {
                await this.createIntegrationWorkflow(`${clientName} - RevOps Workflow`, {
                    integrations: Array.from(suite.entries()).map(([key, integration]) => ({
                        type: key,
                        config: integration['config'],
                        role: key === 'asana' ? 'source' : 'destination'
                    })),
                    dataFlow: this.createRevOpsDataFlow(suite),
                    triggers: this.createRevOpsTriggers(suite)
                });
            }
            this.emit('revops:suite_created', {
                clientName,
                integrations: Array.from(suite.keys())
            });
            return suite;
        }
        catch (error) {
            this.emit('revops:suite_creation_failed', { clientName, error });
            throw error;
        }
    }
    initializeTemplates() {
        this.templates.set('revops-asana', {
            id: 'revops-asana',
            name: 'RevOps Asana Template',
            type: 'asana',
            description: 'Pre-configured Asana integration for RevOps workflows',
            requiredScopes: ['default'],
            defaultConfig: {
                rateLimiting: {
                    maxRequests: 1500,
                    windowMs: 60000,
                    strategy: 'sliding',
                    respectRetryAfter: true
                },
                retryConfig: {
                    maxRetries: 3,
                    initialDelayMs: 1000,
                    maxDelayMs: 10000,
                    backoffFactor: 2,
                    retryableStatuses: [429, 500, 502, 503, 504],
                    retryableErrors: ['ECONNRESET', 'ETIMEDOUT']
                },
                cacheConfig: {
                    enabled: true,
                    ttlMs: 300000,
                    maxSize: 100,
                    strategy: 'lru'
                }
            },
            setupSteps: [
                { step: 1, name: 'API Key', description: 'Enter your Asana API key', required: true },
                { step: 2, name: 'Workspace', description: 'Select default workspace', required: true },
                { step: 3, name: 'Templates', description: 'Configure project templates', required: false }
            ]
        });
        this.templates.set('revops-google', {
            id: 'revops-google',
            name: 'RevOps Google Workspace Template',
            type: 'google',
            description: 'Pre-configured Google Workspace integration for RevOps',
            requiredScopes: [
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/documents',
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/gmail.send',
                'https://www.googleapis.com/auth/calendar'
            ],
            defaultConfig: {
                timeout: 30000,
                maxConcurrentRequests: 10,
                cacheConfig: {
                    enabled: true,
                    ttlMs: 600000,
                    maxSize: 200,
                    strategy: 'lru'
                }
            },
            setupSteps: [
                { step: 1, name: 'OAuth Setup', description: 'Configure OAuth2 credentials', required: true },
                { step: 2, name: 'Authorize', description: 'Authorize access to Google Workspace', required: true },
                { step: 3, name: 'Templates', description: 'Select document templates', required: false }
            ]
        });
        this.templates.set('revops-notion', {
            id: 'revops-notion',
            name: 'RevOps Notion Template',
            type: 'notion',
            description: 'Pre-configured Notion integration for knowledge management',
            defaultConfig: {
                version: '2022-06-28',
                rateLimiting: {
                    maxRequests: 3,
                    windowMs: 1000,
                    strategy: 'fixed',
                    respectRetryAfter: true
                },
                cacheConfig: {
                    enabled: true,
                    ttlMs: 300000,
                    maxSize: 150,
                    strategy: 'ttl'
                }
            },
            setupSteps: [
                { step: 1, name: 'API Key', description: 'Enter your Notion integration token', required: true },
                { step: 2, name: 'Databases', description: 'Configure database templates', required: false },
                { step: 3, name: 'Automations', description: 'Setup automation rules', required: false }
            ]
        });
    }
    async createIntegrationInstance(type, config) {
        switch (type) {
            case 'asana':
                return new AsanaEnhancedIntegration_1.AsanaEnhancedIntegration(config, this.swarmMemory, this.hitlSystem);
            case 'google':
                return new GoogleEnhancedIntegration_1.GoogleEnhancedIntegration(config, this.swarmMemory, this.hitlSystem);
            case 'notion':
                return new NotionEnhancedIntegration_1.NotionEnhancedIntegration(config, this.swarmMemory, this.hitlSystem);
            case 'salesforce':
            case 'hubspot':
            case 'slack':
            case 'github':
            case 'jira':
                throw new Error(`Integration type ${type} not yet implemented`);
            case 'custom':
                throw new Error('Custom integrations must extend BaseIntegration directly');
            default:
                throw new Error(`Unknown integration type: ${type}`);
        }
    }
    applyTemplate(config, template) {
        return {
            ...template.defaultConfig,
            ...config,
            authConfig: {
                ...template.defaultConfig.authConfig,
                ...config.authConfig
            },
            rateLimiting: {
                ...template.defaultConfig.rateLimiting,
                ...config.rateLimiting
            },
            retryConfig: {
                ...template.defaultConfig.retryConfig,
                ...config.retryConfig
            },
            cacheConfig: {
                ...template.defaultConfig.cacheConfig,
                ...config.cacheConfig
            }
        };
    }
    setupCustomHandlers(integration, handlers) {
        for (const [event, handler] of Object.entries(handlers)) {
            integration.on(event, handler);
        }
    }
    async setupDataFlow(integrations, dataFlow) {
        for (const flow of dataFlow) {
            const source = integrations.get(flow.from);
            const destination = integrations.get(flow.to);
            if (source && destination) {
                source.on('data:available', async (data) => {
                    let transformedData = data;
                    if (flow.transformations) {
                        for (const transformation of flow.transformations) {
                            transformedData = await this.applyTransformation(transformedData, transformation);
                        }
                    }
                    await this.sendToDestination(destination, transformedData);
                });
            }
        }
    }
    async setupTriggers(integrations, triggers) {
        for (const trigger of triggers) {
            const integration = integrations.get(trigger.integration);
            if (integration) {
                integration.on(trigger.event, async (data) => {
                    if (this.checkTriggerConditions(data, trigger.conditions)) {
                        this.emit('workflow:triggered', {
                            integration: trigger.integration,
                            event: trigger.event,
                            data
                        });
                    }
                });
            }
        }
    }
    async applyTransformation(data, transformation) {
        return data;
    }
    async sendToDestination(destination, data) {
        destination.emit('data:received', data);
    }
    checkTriggerConditions(data, conditions) {
        return true;
    }
    getIntegrationType(integration) {
        if (integration instanceof AsanaEnhancedIntegration_1.AsanaEnhancedIntegration)
            return 'asana';
        if (integration instanceof GoogleEnhancedIntegration_1.GoogleEnhancedIntegration)
            return 'google';
        if (integration instanceof NotionEnhancedIntegration_1.NotionEnhancedIntegration)
            return 'notion';
        return 'custom';
    }
    getIntegrationCountByType() {
        const counts = {};
        for (const integration of this.manager.getAllIntegrations()) {
            const type = this.getIntegrationType(integration);
            counts[type] = (counts[type] || 0) + 1;
        }
        return counts;
    }
    getHealthStatus() {
        const integrations = this.manager.getAllIntegrations();
        let healthy = 0;
        let unhealthy = 0;
        for (const integration of integrations) {
            if (integration.isConnected()) {
                healthy++;
            }
            else {
                unhealthy++;
            }
        }
        return {
            healthy,
            unhealthy,
            total: integrations.length,
            healthPercentage: integrations.length > 0
                ? (healthy / integrations.length) * 100
                : 0
        };
    }
    createRevOpsDataFlow(suite) {
        const dataFlow = [];
        if (suite.has('asana') && suite.has('notion')) {
            dataFlow.push({
                from: suite.get('asana')['config'].id,
                to: suite.get('notion')['config'].id,
                transformations: [{
                        type: 'field_mapping',
                        config: {
                            'name': 'title',
                            'notes': 'description',
                            'assignee': 'owner'
                        }
                    }]
            });
        }
        if (suite.has('asana') && suite.has('google')) {
            dataFlow.push({
                from: suite.get('asana')['config'].id,
                to: suite.get('google')['config'].id,
                transformations: [{
                        type: 'document_generation',
                        config: {
                            template: 'project_report'
                        }
                    }]
            });
        }
        return dataFlow;
    }
    createRevOpsTriggers(suite) {
        const triggers = [];
        if (suite.has('asana')) {
            triggers.push({
                integration: suite.get('asana')['config'].id,
                event: 'asana:project_created',
                conditions: { type: 'revops_project' }
            });
        }
        if (suite.has('google')) {
            triggers.push({
                integration: suite.get('google')['config'].id,
                event: 'google:document_created',
                conditions: { folder: 'revops' }
            });
        }
        return triggers;
    }
    setupEventHandlers() {
        this.manager.on('integration:registered', (data) => {
            this.emit('factory:integration_registered', data);
        });
        this.manager.on('integration:request_success', (data) => {
            if (this.config.enableMetrics) {
                this.updateMetrics('request_success', data);
            }
        });
        this.manager.on('integration:request_failed', (data) => {
            if (this.config.enableMetrics) {
                this.updateMetrics('request_failed', data);
            }
        });
    }
    updateMetrics(event, data) {
        this.swarmMemory.store(`metrics:integration:${event}:${Date.now()}`, {
            event,
            data,
            timestamp: new Date()
        });
    }
    async cleanup() {
        await this.manager.cleanup();
        this.integrationCache.clear();
        this.emit('factory:cleanup_completed');
    }
}
exports.IntegrationFactory = IntegrationFactory;
exports.default = IntegrationFactory;
//# sourceMappingURL=IntegrationFactory.js.map