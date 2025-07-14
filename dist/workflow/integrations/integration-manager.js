"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowIntegrationManager = void 0;
const events_1 = require("events");
class WorkflowIntegrationManager extends events_1.EventEmitter {
    integrations = new Map();
    connections = new Map();
    registerIntegration(integration) {
        this.integrations.set(integration.id, integration);
        this.emit('integration:registered', integration);
    }
    async connect(integrationId) {
        const integration = this.integrations.get(integrationId);
        if (!integration) {
            throw new Error(`Integration ${integrationId} not found`);
        }
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            integration.status = 'connected';
            this.connections.set(integrationId, { connected: true });
            this.emit('integration:connected', integration);
        }
        catch (error) {
            integration.status = 'error';
            this.emit('integration:error', { integration, error });
            throw error;
        }
    }
    async disconnect(integrationId) {
        const integration = this.integrations.get(integrationId);
        if (!integration) {
            throw new Error(`Integration ${integrationId} not found`);
        }
        integration.status = 'disconnected';
        this.connections.delete(integrationId);
        this.emit('integration:disconnected', integration);
    }
    async sendData(integrationId, data) {
        const integration = this.integrations.get(integrationId);
        if (!integration) {
            throw new Error(`Integration ${integrationId} not found`);
        }
        if (integration.status !== 'connected') {
            throw new Error(`Integration ${integrationId} is not connected`);
        }
        try {
            const result = await this.processIntegrationData(integration, data);
            this.emit('integration:data-sent', { integration, data, result });
            return result;
        }
        catch (error) {
            this.emit('integration:error', { integration, error });
            throw error;
        }
    }
    getIntegrations() {
        return Array.from(this.integrations.values());
    }
    async processIntegrationData(integration, data) {
        switch (integration.type) {
            case 'webhook':
                return this.sendWebhook(integration, data);
            case 'api':
                return this.sendAPI(integration, data);
            case 'database':
                return this.saveToDatabase(integration, data);
            default:
                return { success: true, data };
        }
    }
    async sendWebhook(integration, data) {
        await new Promise(resolve => setTimeout(resolve, 200));
        return {
            success: true,
            webhookUrl: integration.config.url,
            timestamp: new Date().toISOString(),
            data
        };
    }
    async sendAPI(integration, data) {
        await new Promise(resolve => setTimeout(resolve, 300));
        return {
            success: true,
            endpoint: integration.config.endpoint,
            method: integration.config.method || 'POST',
            response: { id: Date.now(), ...data }
        };
    }
    async saveToDatabase(integration, data) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
            success: true,
            table: integration.config.table,
            recordId: Date.now(),
            data
        };
    }
    isConnected(integrationId) {
        const integration = this.integrations.get(integrationId);
        return integration?.status === 'connected' || false;
    }
    async reconnect(integrationId) {
        await this.disconnect(integrationId);
        await this.connect(integrationId);
    }
    async testConnection(integrationId) {
        try {
            await this.sendData(integrationId, { test: true });
            return true;
        }
        catch {
            return false;
        }
    }
    async initialize() {
        this.emit('integration-manager:initialized');
    }
}
exports.WorkflowIntegrationManager = WorkflowIntegrationManager;
//# sourceMappingURL=integration-manager.js.map