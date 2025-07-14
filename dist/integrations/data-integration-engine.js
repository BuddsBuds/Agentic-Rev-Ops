"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataIntegrationEngine = void 0;
const events_1 = require("events");
const data_sources_1 = require("../horizon-scanning/data-sources");
const crm_integration_1 = require("./crm/crm-integration");
const marketing_integration_1 = require("./marketing-automation/marketing-integration");
const pipeline_engine_1 = require("./data-pipelines/pipeline-engine");
const data_transformer_1 = require("./transformation/data-transformer");
const realtime_processor_1 = require("./data-pipelines/realtime-processor");
class DataIntegrationEngine extends events_1.EventEmitter {
    horizonScanning;
    crmIntegration;
    marketingIntegration;
    pipelineEngine;
    dataTransformer;
    realtimeProcessor;
    enhancedSources = new Map();
    dataFlows = new Map();
    syncStates = new Map();
    constructor() {
        super();
        this.horizonScanning = new data_sources_1.DataSourceManager();
        this.crmIntegration = new crm_integration_1.CRMIntegrationManager();
        this.marketingIntegration = new marketing_integration_1.MarketingAutomationManager();
        this.pipelineEngine = new pipeline_engine_1.DataPipelineEngine();
        this.dataTransformer = new data_transformer_1.DataTransformationEngine();
        this.realtimeProcessor = new realtime_processor_1.RealtimeDataProcessor();
        this.initializeEnhancedSources();
        this.setupEventHandlers();
    }
    initializeEnhancedSources() {
        this.registerEnhancedSource({
            id: 'salesforce-crm',
            name: 'Salesforce CRM',
            type: 'crm',
            category: 'customer-data',
            priority: 'critical',
            updateFrequency: 300000,
            authentication: {
                type: 'oauth2',
                credentials: {
                    clientId: process.env.SALESFORCE_CLIENT_ID || '',
                    clientSecret: process.env.SALESFORCE_CLIENT_SECRET || '',
                    refreshToken: process.env.SALESFORCE_REFRESH_TOKEN || ''
                },
                refreshInterval: 3600000
            },
            rateLimit: {
                requestsPerMinute: 100,
                burstCapacity: 20,
                concurrentConnections: 10
            },
            syncStrategy: 'hybrid',
            dataSchema: {
                fields: [
                    { name: 'id', type: 'string', required: true },
                    { name: 'accountName', type: 'string', required: true },
                    { name: 'revenue', type: 'number', required: false },
                    { name: 'stage', type: 'string', required: true },
                    { name: 'probability', type: 'number', required: false },
                    { name: 'closeDate', type: 'date', required: false },
                    { name: 'lastActivity', type: 'date', required: false },
                    { name: 'contactInfo', type: 'object', required: false }
                ],
                relationships: [
                    {
                        sourceField: 'accountId',
                        targetSource: 'hubspot-crm',
                        targetField: 'companyId',
                        type: 'one-to-one'
                    }
                ]
            },
            transformationRules: [
                {
                    sourceField: 'Amount',
                    targetField: 'revenue',
                    transformation: 'normalize',
                    parameters: { currency: 'USD' }
                },
                {
                    sourceField: 'StageName',
                    targetField: 'stage',
                    transformation: 'map',
                    parameters: {
                        mapping: {
                            'Prospecting': 'lead',
                            'Qualification': 'qualified',
                            'Proposal': 'proposal',
                            'Closed Won': 'won',
                            'Closed Lost': 'lost'
                        }
                    }
                }
            ]
        });
        this.registerEnhancedSource({
            id: 'hubspot-crm',
            name: 'HubSpot CRM',
            type: 'crm',
            category: 'customer-data',
            priority: 'critical',
            updateFrequency: 300000,
            authentication: {
                type: 'api-key',
                credentials: { key: process.env.HUBSPOT_API_KEY || '' }
            },
            rateLimit: {
                requestsPerMinute: 100,
                burstCapacity: 10
            },
            syncStrategy: 'real-time',
            dataSchema: {
                fields: [
                    { name: 'id', type: 'string', required: true },
                    { name: 'companyName', type: 'string', required: true },
                    { name: 'dealValue', type: 'number', required: false },
                    { name: 'dealStage', type: 'string', required: true },
                    { name: 'lastContactDate', type: 'date', required: false },
                    { name: 'leadScore', type: 'number', required: false }
                ]
            }
        });
        this.registerEnhancedSource({
            id: 'marketo-marketing',
            name: 'Marketo Marketing Automation',
            type: 'marketing',
            category: 'lead-intelligence',
            priority: 'high',
            updateFrequency: 600000,
            authentication: {
                type: 'oauth2',
                credentials: {
                    clientId: process.env.MARKETO_CLIENT_ID || '',
                    clientSecret: process.env.MARKETO_CLIENT_SECRET || ''
                }
            },
            syncStrategy: 'batch',
            dataSchema: {
                fields: [
                    { name: 'leadId', type: 'string', required: true },
                    { name: 'email', type: 'string', required: true },
                    { name: 'score', type: 'number', required: false },
                    { name: 'engagementLevel', type: 'string', required: false },
                    { name: 'lastEmailOpen', type: 'date', required: false },
                    { name: 'campaignResponses', type: 'array', required: false }
                ]
            }
        });
        this.registerEnhancedSource({
            id: 'pardot-marketing',
            name: 'Pardot Marketing Automation',
            type: 'marketing',
            category: 'behavioral-data',
            priority: 'high',
            updateFrequency: 900000,
            authentication: {
                type: 'oauth2',
                credentials: {
                    clientId: process.env.PARDOT_CLIENT_ID || '',
                    clientSecret: process.env.PARDOT_CLIENT_SECRET || ''
                }
            },
            syncStrategy: 'hybrid',
            dataSchema: {
                fields: [
                    { name: 'prospectId', type: 'string', required: true },
                    { name: 'grade', type: 'string', required: false },
                    { name: 'profile', type: 'string', required: false },
                    { name: 'activities', type: 'array', required: false },
                    { name: 'formSubmissions', type: 'array', required: false }
                ]
            }
        });
        this.registerEnhancedSource({
            id: 'stripe-payments',
            name: 'Stripe Payment Processing',
            type: 'api',
            category: 'revenue-data',
            priority: 'critical',
            updateFrequency: 60000,
            authentication: {
                type: 'api-key',
                credentials: { key: process.env.STRIPE_SECRET_KEY || '' }
            },
            rateLimit: {
                requestsPerMinute: 100,
                burstCapacity: 25
            },
            syncStrategy: 'real-time',
            dataSchema: {
                fields: [
                    { name: 'transactionId', type: 'string', required: true },
                    { name: 'amount', type: 'number', required: true },
                    { name: 'currency', type: 'string', required: true },
                    { name: 'customerId', type: 'string', required: true },
                    { name: 'status', type: 'string', required: true },
                    { name: 'timestamp', type: 'date', required: true }
                ]
            }
        });
        this.registerEnhancedSource({
            id: 'zendesk-support',
            name: 'Zendesk Support',
            type: 'api',
            category: 'customer-data',
            priority: 'medium',
            updateFrequency: 1800000,
            authentication: {
                type: 'api-key',
                credentials: { key: process.env.ZENDESK_API_KEY || '' }
            },
            syncStrategy: 'batch',
            dataSchema: {
                fields: [
                    { name: 'ticketId', type: 'string', required: true },
                    { name: 'customerId', type: 'string', required: true },
                    { name: 'priority', type: 'string', required: true },
                    { name: 'status', type: 'string', required: true },
                    { name: 'sentiment', type: 'number', required: false },
                    { name: 'resolutionTime', type: 'number', required: false }
                ]
            }
        });
    }
    registerEnhancedSource(source) {
        this.enhancedSources.set(source.id, source);
        this.syncStates.set(source.id, {
            status: 'disconnected',
            lastSync: null,
            errorCount: 0,
            dataCount: 0
        });
    }
    async initializeAllSources() {
        await this.horizonScanning.connectSource('bloomberg-api');
        await this.horizonScanning.connectSource('reuters-connect');
        await this.horizonScanning.connectSource('twitter-stream');
        const sourceConnections = Array.from(this.enhancedSources.values()).map(source => this.connectEnhancedSource(source.id));
        await Promise.allSettled(sourceConnections);
        this.startRealtimeProcessing();
        this.emit('integration:initialized');
    }
    async connectEnhancedSource(sourceId) {
        const source = this.enhancedSources.get(sourceId);
        if (!source)
            throw new Error(`Enhanced source ${sourceId} not found`);
        try {
            this.updateSyncState(sourceId, { status: 'connecting' });
            switch (source.type) {
                case 'crm':
                    await this.crmIntegration.connect(source);
                    break;
                case 'marketing':
                    await this.marketingIntegration.connect(source);
                    break;
                case 'api':
                    await this.connectAPISource(source);
                    break;
                case 'database':
                    await this.connectDatabaseSource(source);
                    break;
                default:
                    throw new Error(`Unsupported source type: ${source.type}`);
            }
            this.updateSyncState(sourceId, {
                status: 'connected',
                lastSync: new Date()
            });
            await this.setupSyncStrategy(source);
            this.emit('source:connected', { sourceId, source });
        }
        catch (error) {
            this.updateSyncState(sourceId, {
                status: 'error',
                errorCount: this.syncStates.get(sourceId).errorCount + 1
            });
            this.emit('source:error', { sourceId, error });
            throw error;
        }
    }
    async setupSyncStrategy(source) {
        switch (source.syncStrategy) {
            case 'real-time':
                await this.setupRealtimeSync(source);
                break;
            case 'batch':
                await this.setupBatchSync(source);
                break;
            case 'hybrid':
                await this.setupHybridSync(source);
                break;
        }
    }
    async setupRealtimeSync(source) {
        if (source.type === 'crm') {
            await this.crmIntegration.setupWebhooks(source.id);
        }
        else if (source.type === 'marketing') {
            await this.marketingIntegration.setupWebhooks(source.id);
        }
        const dataFlow = {
            sourceId: source.id,
            type: 'streaming',
            processor: this.realtimeProcessor,
            transformations: source.transformationRules || [],
            destinations: ['unified-data-store', 'analytics-engine']
        };
        this.dataFlows.set(`${source.id}-realtime`, dataFlow);
    }
    async setupBatchSync(source) {
        const syncData = async () => {
            try {
                const data = await this.fetchBatchData(source);
                const transformedData = await this.dataTransformer.transform(data, source.transformationRules || []);
                await this.pipelineEngine.processBatch(transformedData, {
                    sourceId: source.id,
                    timestamp: new Date(),
                    metadata: { batchSize: data.length }
                });
                this.updateSyncState(source.id, {
                    lastSync: new Date(),
                    dataCount: this.syncStates.get(source.id).dataCount + data.length
                });
            }
            catch (error) {
                this.emit('sync:error', { sourceId: source.id, error });
            }
        };
        setInterval(syncData, source.updateFrequency);
        syncData();
    }
    async setupHybridSync(source) {
        await this.setupRealtimeSync(source);
        await this.setupBatchSync(source);
    }
    async fetchBatchData(source) {
        switch (source.type) {
            case 'crm':
                return this.crmIntegration.fetchData(source.id);
            case 'marketing':
                return this.marketingIntegration.fetchData(source.id);
            case 'api':
                return this.fetchAPIData(source);
            default:
                return [];
        }
    }
    async connectAPISource(source) {
        const testEndpoint = this.getAPIEndpoint(source, '/health');
        const headers = this.getAuthHeaders(source);
        const response = await fetch(testEndpoint, { headers });
        if (!response.ok) {
            throw new Error(`API connection failed: ${response.statusText}`);
        }
    }
    async connectDatabaseSource(source) {
        throw new Error('Database sources not yet implemented');
    }
    async fetchAPIData(source) {
        const endpoint = this.getAPIEndpoint(source, '/data');
        const headers = this.getAuthHeaders(source);
        const response = await fetch(endpoint, { headers });
        if (!response.ok) {
            throw new Error(`API fetch failed: ${response.statusText}`);
        }
        return response.json();
    }
    getAPIEndpoint(source, path) {
        const baseUrls = {
            'stripe-payments': 'https://api.stripe.com/v1',
            'zendesk-support': `https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2`
        };
        return baseUrls[source.id] + path;
    }
    getAuthHeaders(source) {
        if (!source.authentication)
            return {};
        const { type, credentials } = source.authentication;
        switch (type) {
            case 'api-key':
                if (source.id === 'stripe-payments') {
                    return { 'Authorization': `Bearer ${credentials.key}` };
                }
                return { 'X-API-Key': credentials.key };
            case 'bearer':
                return { 'Authorization': `Bearer ${credentials.token}` };
            case 'oauth2':
                return { 'Authorization': `Bearer ${credentials.accessToken}` };
            case 'basic':
                const encoded = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
                return { 'Authorization': `Basic ${encoded}` };
            default:
                return {};
        }
    }
    startRealtimeProcessing() {
        this.horizonScanning.on('data:received', (data) => {
            this.realtimeProcessor.process(data);
        });
        this.crmIntegration.on('data:received', (data) => {
            this.realtimeProcessor.process(data);
        });
        this.marketingIntegration.on('data:received', (data) => {
            this.realtimeProcessor.process(data);
        });
        this.realtimeProcessor.on('data:processed', (processedData) => {
            this.emit('data:unified', processedData);
        });
    }
    setupEventHandlers() {
        this.crmIntegration.on('data:received', (data) => {
            this.emit('crm:data', data);
        });
        this.crmIntegration.on('sync:complete', (result) => {
            this.emit('crm:sync:complete', result);
        });
        this.marketingIntegration.on('data:received', (data) => {
            this.emit('marketing:data', data);
        });
        this.marketingIntegration.on('campaign:triggered', (event) => {
            this.emit('marketing:campaign:triggered', event);
        });
        this.pipelineEngine.on('batch:processed', (result) => {
            this.emit('pipeline:batch:processed', result);
        });
        this.pipelineEngine.on('error', (error) => {
            this.emit('pipeline:error', error);
        });
    }
    updateSyncState(sourceId, updates) {
        const currentState = this.syncStates.get(sourceId);
        this.syncStates.set(sourceId, { ...currentState, ...updates });
    }
    async getSyncStatus() {
        return new Map(this.syncStates);
    }
    async getDataSourceMetrics(sourceId) {
        const source = this.enhancedSources.get(sourceId);
        const syncState = this.syncStates.get(sourceId);
        if (!source || !syncState) {
            throw new Error(`Source ${sourceId} not found`);
        }
        return {
            sourceId,
            sourceName: source.name,
            status: syncState.status,
            lastSync: syncState.lastSync,
            dataCount: syncState.dataCount,
            errorCount: syncState.errorCount,
            averageSyncTime: await this.calculateAverageSyncTime(sourceId),
            dataQualityScore: await this.calculateDataQualityScore(sourceId)
        };
    }
    async unifyCustomerData(customerId) {
        const crmData = await this.crmIntegration.getCustomerData(customerId);
        const marketingData = await this.marketingIntegration.getCustomerData(customerId);
        const supportData = await this.getSupportData(customerId);
        const transactionData = await this.getTransactionData(customerId);
        return this.dataTransformer.unifyCustomerProfile({
            customerId,
            crmData,
            marketingData,
            supportData,
            transactionData
        });
    }
    async calculateAverageSyncTime(sourceId) {
        return 0;
    }
    async calculateDataQualityScore(sourceId) {
        return 0.85;
    }
    async getSupportData(customerId) {
        return [];
    }
    async getTransactionData(customerId) {
        return [];
    }
}
exports.DataIntegrationEngine = DataIntegrationEngine;
exports.default = DataIntegrationEngine;
//# sourceMappingURL=data-integration-engine.js.map