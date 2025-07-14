"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationHub = void 0;
const events_1 = require("events");
const IntegrationFactory_1 = require("./core/IntegrationFactory");
class IntegrationHub extends events_1.EventEmitter {
    factory;
    swarmMemory;
    hitlSystem;
    swarmCoordinator;
    config;
    healthCheckInterval;
    metricsInterval;
    webhooks = new Map();
    status = 'stopped';
    metrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalResponseTime: 0
    };
    constructor(swarmMemory, hitlSystem, swarmCoordinator, config = {}) {
        super();
        this.swarmMemory = swarmMemory;
        this.hitlSystem = hitlSystem;
        this.swarmCoordinator = swarmCoordinator;
        this.config = {
            enableAutoDiscovery: true,
            enableHealthMonitoring: true,
            healthCheckInterval: 60000,
            enableWebhooks: true,
            webhookPort: 3001,
            enableMetrics: true,
            metricsInterval: 300000,
            maxIntegrations: 50,
            defaultTimeout: 30000,
            ...config
        };
        this.factory = new IntegrationFactory_1.IntegrationFactory({
            swarmMemory: this.swarmMemory,
            hitlSystem: this.hitlSystem,
            autoInitialize: true,
            enableMetrics: this.config.enableMetrics,
            enableCaching: true
        });
        this.setupEventHandlers();
    }
    async initialize() {
        try {
            this.emit('hub:initializing');
            await this.loadExistingIntegrations();
            if (this.config.enableHealthMonitoring) {
                this.startHealthMonitoring();
            }
            if (this.config.enableMetrics) {
                this.startMetricsCollection();
            }
            if (this.config.enableWebhooks) {
                await this.setupWebhookServer();
            }
            if (this.config.enableAutoDiscovery) {
                await this.autoDiscoverIntegrations();
            }
            this.status = 'running';
            this.emit('hub:initialized', this.getStatus());
            await this.swarmMemory.store('integration_hub:initialized', {
                config: this.config,
                timestamp: new Date()
            });
        }
        catch (error) {
            this.status = 'degraded';
            this.emit('hub:initialization_failed', { error });
            throw error;
        }
    }
    async addIntegration(type, config, options) {
        try {
            if (this.factory.getAllIntegrations().length >= this.config.maxIntegrations) {
                throw new Error(`Maximum integration limit (${this.config.maxIntegrations}) reached`);
            }
            const integration = await this.factory.createIntegration(type, config, options);
            this.setupIntegrationHandlers(integration);
            if (this.config.enableWebhooks && options?.webhooks) {
                await this.createIntegrationWebhooks(config.id, options.webhooks);
            }
            if (this.swarmCoordinator) {
                await this.notifySwarmOfIntegration(integration);
            }
            this.emit('integration:added', {
                id: config.id,
                type,
                integration
            });
            return integration;
        }
        catch (error) {
            this.emit('integration:add_failed', { type, config, error });
            throw error;
        }
    }
    async removeIntegration(integrationId) {
        try {
            const integration = this.factory.getIntegration(integrationId);
            if (!integration) {
                throw new Error(`Integration ${integrationId} not found`);
            }
            await this.removeIntegrationWebhooks(integrationId);
            await integration.cleanup();
            await this.factory['manager'].unregisterIntegration(integrationId);
            this.emit('integration:removed', { integrationId });
        }
        catch (error) {
            this.emit('integration:remove_failed', { integrationId, error });
            throw error;
        }
    }
    async createClientSuite(clientName, options) {
        try {
            this.emit('suite:creating', { clientName });
            const suite = await this.factory.createRevOpsSuite(clientName, {
                includeAsana: options?.integrations?.asana,
                includeGoogle: options?.integrations?.google,
                includeNotion: options?.integrations?.notion,
                includeCRM: options?.integrations?.crm,
                customConfig: options?.credentials
            });
            if (options?.autoSetup) {
                await this.setupClientWorkspace(clientName, suite);
            }
            await this.createUnifiedDashboard(clientName, suite);
            this.emit('suite:created', {
                clientName,
                integrations: Array.from(suite.keys())
            });
            return suite;
        }
        catch (error) {
            this.emit('suite:creation_failed', { clientName, error });
            throw error;
        }
    }
    getIntegration(integrationId) {
        return this.factory.getIntegration(integrationId);
    }
    getAllIntegrations() {
        return this.factory.getAllIntegrations();
    }
    getIntegrationsByType(type) {
        return this.factory.getIntegrationsByType(type);
    }
    async testAllConnections() {
        this.emit('connections:testing');
        const results = await this.factory.testAllConnections();
        this.emit('connections:tested', { results });
        return results;
    }
    getStatus() {
        const integrations = this.factory.getAllIntegrations();
        const metrics = this.factory.getMetrics();
        const integrationStatuses = integrations.map(integration => {
            const type = this.getIntegrationType(integration);
            return {
                id: integration['config'].id,
                type,
                status: integration.isConnected() ? 'connected' : 'disconnected',
                health: integration.isConnected()
            };
        });
        const healthyCount = integrationStatuses.filter(i => i.health).length;
        const activeCount = integrationStatuses.filter(i => i.status === 'connected').length;
        return {
            status: this.status,
            totalIntegrations: integrations.length,
            activeIntegrations: activeCount,
            healthyIntegrations: healthyCount,
            metrics: {
                totalRequests: this.metrics.totalRequests,
                successRate: this.metrics.totalRequests > 0
                    ? this.metrics.successfulRequests / this.metrics.totalRequests
                    : 1,
                averageResponseTime: this.metrics.totalRequests > 0
                    ? this.metrics.totalResponseTime / this.metrics.totalRequests
                    : 0,
                lastHealthCheck: new Date()
            },
            integrations: integrationStatuses
        };
    }
    async createWebhook(integrationId, config) {
        const webhookId = `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const webhook = {
            id: webhookId,
            integrationId,
            endpoint: config.endpoint,
            events: config.events,
            secret: config.secret,
            active: true
        };
        this.webhooks.set(webhookId, webhook);
        await this.swarmMemory.store(`webhook:${webhookId}`, webhook);
        this.emit('webhook:created', { webhook });
        return webhook;
    }
    async handleWebhook(integrationId, event, data, signature) {
        try {
            const matchingWebhooks = Array.from(this.webhooks.values()).filter(webhook => webhook.integrationId === integrationId &&
                webhook.events.includes(event) &&
                webhook.active);
            for (const webhook of matchingWebhooks) {
                await this.processWebhook(webhook, event, data, signature);
            }
            this.emit('webhook:processed', { integrationId, event, webhookCount: matchingWebhooks.length });
        }
        catch (error) {
            this.emit('webhook:processing_failed', { integrationId, event, error });
            throw error;
        }
    }
    async syncIntegrations(sourceId, targetId, options) {
        try {
            const source = this.factory.getIntegration(sourceId);
            const target = this.factory.getIntegration(targetId);
            if (!source || !target) {
                throw new Error('Source or target integration not found');
            }
            this.emit('sync:started', { sourceId, targetId });
            this.emit('sync:completed', { sourceId, targetId });
        }
        catch (error) {
            this.emit('sync:failed', { sourceId, targetId, error });
            throw error;
        }
    }
    async enableMaintenanceMode(reason) {
        this.status = 'maintenance';
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        for (const integration of this.factory.getAllIntegrations()) {
            integration.emit('maintenance:enabled', { reason });
        }
        await this.swarmMemory.store('integration_hub:maintenance', {
            enabled: true,
            reason,
            timestamp: new Date()
        });
        this.emit('maintenance:enabled', { reason });
    }
    async disableMaintenanceMode() {
        this.status = 'running';
        if (this.config.enableHealthMonitoring) {
            this.startHealthMonitoring();
        }
        await this.swarmMemory.store('integration_hub:maintenance', {
            enabled: false,
            timestamp: new Date()
        });
        this.emit('maintenance:disabled');
    }
    async shutdown() {
        this.emit('hub:shutting_down');
        this.status = 'stopped';
        if (this.healthCheckInterval)
            clearInterval(this.healthCheckInterval);
        if (this.metricsInterval)
            clearInterval(this.metricsInterval);
        await this.factory.cleanup();
        await this.swarmMemory.store('integration_hub:shutdown', {
            timestamp: new Date(),
            finalMetrics: this.metrics
        });
        this.emit('hub:shutdown');
    }
    setupEventHandlers() {
        this.factory.on('integration:created', (data) => {
            this.emit('hub:integration_created', data);
        });
        this.factory.on('integration:creation_failed', (data) => {
            this.emit('hub:integration_creation_failed', data);
        });
        this.factory.on('workflow:created', (data) => {
            this.emit('hub:workflow_created', data);
        });
        this.factory['manager'].on('integration:request_success', (data) => {
            this.updateMetrics('success');
        });
        this.factory['manager'].on('integration:request_failed', (data) => {
            this.updateMetrics('failure');
        });
        this.factory['manager'].on('integration:rate_limit', (data) => {
            this.emit('hub:rate_limit', data);
        });
    }
    setupIntegrationHandlers(integration) {
        integration.on('error', (error) => {
            this.emit('integration:error', {
                integrationId: integration['config'].id,
                error
            });
        });
        integration.on('health:checked', (data) => {
            this.emit('integration:health_checked', data);
        });
    }
    async loadExistingIntegrations() {
        const integrationKeys = await this.swarmMemory.list('integration:created:*');
        for (const key of integrationKeys) {
            const data = await this.swarmMemory.retrieve(key);
            if (data) {
                try {
                    await this.factory.createIntegration(data.type, data.config, data.options);
                }
                catch (error) {
                    this.emit('integration:load_failed', { key, error });
                }
            }
        }
    }
    startHealthMonitoring() {
        this.healthCheckInterval = setInterval(async () => {
            await this.performHealthCheck();
        }, this.config.healthCheckInterval);
    }
    async performHealthCheck() {
        try {
            const results = await this.factory.testAllConnections();
            const unhealthyCount = Array.from(results.values()).filter(healthy => !healthy).length;
            if (unhealthyCount > 0) {
                this.status = 'degraded';
            }
            else if (this.status === 'degraded') {
                this.status = 'running';
            }
            this.emit('health:checked', { results, status: this.status });
        }
        catch (error) {
            this.emit('health:check_failed', { error });
        }
    }
    startMetricsCollection() {
        this.metricsInterval = setInterval(async () => {
            await this.collectMetrics();
        }, this.config.metricsInterval);
    }
    async collectMetrics() {
        const integrationMetrics = this.factory.getMetrics();
        await this.swarmMemory.store(`metrics:hub:${Date.now()}`, {
            hubMetrics: this.metrics,
            integrationMetrics,
            status: this.getStatus(),
            timestamp: new Date()
        });
        this.emit('metrics:collected', { metrics: integrationMetrics });
    }
    updateMetrics(result) {
        this.metrics.totalRequests++;
        if (result === 'success') {
            this.metrics.successfulRequests++;
        }
        else {
            this.metrics.failedRequests++;
        }
    }
    async setupWebhookServer() {
        this.emit('webhook:server_started', { port: this.config.webhookPort });
    }
    async autoDiscoverIntegrations() {
        this.emit('discovery:completed');
    }
    async createIntegrationWebhooks(integrationId, webhookConfigs) {
        for (const config of webhookConfigs) {
            await this.createWebhook(integrationId, config);
        }
    }
    async removeIntegrationWebhooks(integrationId) {
        const webhooksToRemove = Array.from(this.webhooks.entries())
            .filter(([_, webhook]) => webhook.integrationId === integrationId)
            .map(([id, _]) => id);
        for (const webhookId of webhooksToRemove) {
            this.webhooks.delete(webhookId);
        }
    }
    async processWebhook(webhook, event, data, signature) {
        if (webhook.secret && signature) {
        }
        webhook.lastTriggered = new Date();
        this.emit('webhook:triggered', { webhook, event, data });
    }
    async notifySwarmOfIntegration(integration) {
        if (!this.swarmCoordinator)
            return;
        await this.swarmCoordinator.broadcast({
            type: 'integration_added',
            data: {
                integrationId: integration['config'].id,
                integrationType: this.getIntegrationType(integration),
                timestamp: new Date()
            }
        });
    }
    async setupClientWorkspace(clientName, suite) {
        for (const [type, integration] of suite) {
            switch (type) {
                case 'asana':
                    const asana = integration;
                    await asana.createRevOpsProject(clientName);
                    break;
                case 'google':
                    const google = integration;
                    await google.createRevOpsWorkspace(clientName);
                    break;
                case 'notion':
                    const notion = integration;
                    await notion.createRevOpsKnowledgeBase(clientName);
                    break;
            }
        }
    }
    async createUnifiedDashboard(clientName, suite) {
        const google = suite.get('google');
        if (google) {
            const googleIntegration = google;
            await googleIntegration.createDataDashboard(`${clientName} - Unified RevOps Dashboard`, {
                type: 'custom',
                query: {
                    integrations: Array.from(suite.keys())
                }
            });
        }
    }
    getIntegrationType(integration) {
        return integration['config'].type || 'custom';
    }
    getWebhook(webhookId) {
        return this.webhooks.get(webhookId);
    }
    getAllWebhooks() {
        return Array.from(this.webhooks.values());
    }
    async disableWebhook(webhookId) {
        const webhook = this.webhooks.get(webhookId);
        if (webhook) {
            webhook.active = false;
            await this.swarmMemory.store(`webhook:${webhookId}`, webhook);
            this.emit('webhook:disabled', { webhookId });
        }
    }
    async enableWebhook(webhookId) {
        const webhook = this.webhooks.get(webhookId);
        if (webhook) {
            webhook.active = true;
            await this.swarmMemory.store(`webhook:${webhookId}`, webhook);
            this.emit('webhook:enabled', { webhookId });
        }
    }
}
exports.IntegrationHub = IntegrationHub;
exports.default = IntegrationHub;
//# sourceMappingURL=IntegrationHub.js.map