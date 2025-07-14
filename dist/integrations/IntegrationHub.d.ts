import { EventEmitter } from 'events';
import { IntegrationType } from './core/IntegrationFactory';
import { BaseIntegration, IntegrationConfig } from './core/IntegrationFramework';
import { SwarmMemory } from '../swarm/memory/SwarmMemory';
import { HITLSystem } from '../workflow/hitl/HITLSystem';
import { SwarmCoordinator } from '../swarm/coordinator/SwarmCoordinator';
export interface IntegrationHubConfig {
    enableAutoDiscovery?: boolean;
    enableHealthMonitoring?: boolean;
    healthCheckInterval?: number;
    enableWebhooks?: boolean;
    webhookPort?: number;
    enableMetrics?: boolean;
    metricsInterval?: number;
    maxIntegrations?: number;
    defaultTimeout?: number;
}
export interface IntegrationHubStatus {
    status: 'running' | 'degraded' | 'maintenance' | 'stopped';
    totalIntegrations: number;
    activeIntegrations: number;
    healthyIntegrations: number;
    metrics: {
        totalRequests: number;
        successRate: number;
        averageResponseTime: number;
        lastHealthCheck: Date;
    };
    integrations: Array<{
        id: string;
        type: IntegrationType;
        status: 'connected' | 'disconnected' | 'error';
        health: boolean;
    }>;
}
export interface IntegrationWebhook {
    id: string;
    integrationId: string;
    endpoint: string;
    events: string[];
    secret?: string;
    active: boolean;
    lastTriggered?: Date;
}
export declare class IntegrationHub extends EventEmitter {
    private factory;
    private swarmMemory;
    private hitlSystem?;
    private swarmCoordinator?;
    private config;
    private healthCheckInterval?;
    private metricsInterval?;
    private webhooks;
    private status;
    private metrics;
    constructor(swarmMemory: SwarmMemory, hitlSystem?: HITLSystem, swarmCoordinator?: SwarmCoordinator, config?: IntegrationHubConfig);
    initialize(): Promise<void>;
    addIntegration(type: IntegrationType, config: IntegrationConfig, options?: any): Promise<BaseIntegration>;
    removeIntegration(integrationId: string): Promise<void>;
    createClientSuite(clientName: string, options?: {
        integrations?: {
            asana?: boolean;
            google?: boolean;
            notion?: boolean;
            crm?: boolean;
        };
        credentials?: {
            asanaApiKey?: string;
            googleClientId?: string;
            googleClientSecret?: string;
            googleRedirectUri?: string;
            notionApiKey?: string;
            crmApiKey?: string;
        };
        autoSetup?: boolean;
    }): Promise<Map<string, BaseIntegration>>;
    getIntegration(integrationId: string): BaseIntegration | undefined;
    getAllIntegrations(): BaseIntegration[];
    getIntegrationsByType(type: IntegrationType): BaseIntegration[];
    testAllConnections(): Promise<Map<string, boolean>>;
    getStatus(): IntegrationHubStatus;
    createWebhook(integrationId: string, config: {
        endpoint: string;
        events: string[];
        secret?: string;
    }): Promise<IntegrationWebhook>;
    handleWebhook(integrationId: string, event: string, data: any, signature?: string): Promise<void>;
    syncIntegrations(sourceId: string, targetId: string, options?: {
        dataType?: string;
        filter?: any;
        transform?: (data: any) => any;
        bidirectional?: boolean;
    }): Promise<void>;
    enableMaintenanceMode(reason: string): Promise<void>;
    disableMaintenanceMode(): Promise<void>;
    shutdown(): Promise<void>;
    private setupEventHandlers;
    private setupIntegrationHandlers;
    private loadExistingIntegrations;
    private startHealthMonitoring;
    private performHealthCheck;
    private startMetricsCollection;
    private collectMetrics;
    private updateMetrics;
    private setupWebhookServer;
    private autoDiscoverIntegrations;
    private createIntegrationWebhooks;
    private removeIntegrationWebhooks;
    private processWebhook;
    private notifySwarmOfIntegration;
    private setupClientWorkspace;
    private createUnifiedDashboard;
    private getIntegrationType;
    getWebhook(webhookId: string): IntegrationWebhook | undefined;
    getAllWebhooks(): IntegrationWebhook[];
    disableWebhook(webhookId: string): Promise<void>;
    enableWebhook(webhookId: string): Promise<void>;
}
export default IntegrationHub;
//# sourceMappingURL=IntegrationHub.d.ts.map