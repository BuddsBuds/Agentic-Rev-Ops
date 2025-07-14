import { BaseIntegration, IntegrationConfig } from './IntegrationFramework';
import { SwarmMemory } from '../../swarm/memory/SwarmMemory';
import { HITLSystem } from '../../workflow/hitl/HITLSystem';
import { EventEmitter } from 'events';
export type IntegrationType = 'asana' | 'google' | 'notion' | 'salesforce' | 'hubspot' | 'slack' | 'github' | 'jira' | 'custom';
export interface IntegrationFactoryConfig {
    swarmMemory: SwarmMemory;
    hitlSystem?: HITLSystem;
    defaultConfigs?: Record<IntegrationType, Partial<IntegrationConfig>>;
    autoInitialize?: boolean;
    enableMetrics?: boolean;
    enableCaching?: boolean;
}
export interface IntegrationTemplate {
    id: string;
    name: string;
    type: IntegrationType;
    description: string;
    requiredScopes?: string[];
    defaultConfig: Partial<IntegrationConfig>;
    setupSteps?: Array<{
        step: number;
        name: string;
        description: string;
        required: boolean;
    }>;
}
export declare class IntegrationFactory extends EventEmitter {
    private manager;
    private swarmMemory;
    private hitlSystem?;
    private config;
    private templates;
    private integrationCache;
    constructor(config: IntegrationFactoryConfig);
    createIntegration(type: IntegrationType, config: IntegrationConfig, options?: {
        templateId?: string;
        autoConnect?: boolean;
        enableSync?: boolean;
        customHandlers?: Record<string, (data: any) => Promise<void>>;
    }): Promise<BaseIntegration>;
    createBulkIntegrations(integrations: Array<{
        type: IntegrationType;
        config: IntegrationConfig;
        options?: any;
    }>): Promise<Map<string, BaseIntegration>>;
    createIntegrationWorkflow(name: string, workflow: {
        integrations: Array<{
            type: IntegrationType;
            config: IntegrationConfig;
            role: 'source' | 'destination' | 'processor';
        }>;
        dataFlow: Array<{
            from: string;
            to: string;
            transformations?: Array<{
                type: string;
                config: any;
            }>;
        }>;
        triggers?: Array<{
            integration: string;
            event: string;
            conditions?: any;
        }>;
    }): Promise<any>;
    getTemplates(): IntegrationTemplate[];
    getTemplate(templateId: string): IntegrationTemplate | undefined;
    createTemplate(template: IntegrationTemplate): void;
    getIntegration(integrationId: string): BaseIntegration | undefined;
    getAllIntegrations(): BaseIntegration[];
    getIntegrationsByType(type: IntegrationType): BaseIntegration[];
    testAllConnections(): Promise<Map<string, boolean>>;
    getMetrics(): any;
    createRevOpsSuite(clientName: string, options?: {
        includeAsana?: boolean;
        includeGoogle?: boolean;
        includeNotion?: boolean;
        includeCRM?: boolean;
        customConfig?: Record<string, any>;
    }): Promise<Map<string, BaseIntegration>>;
    private initializeTemplates;
    private createIntegrationInstance;
    private applyTemplate;
    private setupCustomHandlers;
    private setupDataFlow;
    private setupTriggers;
    private applyTransformation;
    private sendToDestination;
    private checkTriggerConditions;
    private getIntegrationType;
    private getIntegrationCountByType;
    private getHealthStatus;
    private createRevOpsDataFlow;
    private createRevOpsTriggers;
    private setupEventHandlers;
    private updateMetrics;
    cleanup(): Promise<void>;
}
export default IntegrationFactory;
//# sourceMappingURL=IntegrationFactory.d.ts.map