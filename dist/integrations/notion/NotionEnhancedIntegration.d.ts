import { BaseIntegration, IntegrationConfig } from '../core/IntegrationFramework';
import { NotionIntegration } from './notion-integration';
import { SwarmMemory } from '../../swarm/memory/SwarmMemory';
import { HITLSystem } from '../../workflow/hitl/HITLSystem';
export interface NotionEnhancedConfig extends IntegrationConfig {
    version?: string;
    syncInterval?: number;
    enableBidirectionalSync?: boolean;
    defaultDatabaseTemplates?: Record<string, any>;
    automationRules?: NotionAutomationRule[];
    aiEnhancements?: {
        enabled: boolean;
        autoSummarize?: boolean;
        autoTag?: boolean;
        sentimentAnalysis?: boolean;
    };
}
export interface NotionAutomationRule {
    id: string;
    name: string;
    trigger: {
        type: 'property_changed' | 'page_created' | 'status_changed' | 'date_reached';
        property?: string;
        value?: any;
    };
    actions: Array<{
        type: 'update_property' | 'create_page' | 'send_notification' | 'trigger_workflow';
        config: any;
    }>;
    enabled: boolean;
}
export interface NotionSyncMapping {
    notionDatabaseId: string;
    externalSystemId: string;
    externalSystemType: 'asana' | 'google' | 'crm';
    fieldMappings: Record<string, string>;
    lastSync?: Date;
    syncDirection: 'notion-to-external' | 'external-to-notion' | 'bidirectional';
}
export declare class NotionEnhancedIntegration extends BaseIntegration {
    private notionClient;
    private swarmMemory?;
    private hitlSystem?;
    private syncInterval?;
    private syncMappings;
    private automationRules;
    private pageWatchers;
    constructor(config: NotionEnhancedConfig, swarmMemory?: SwarmMemory, hitlSystem?: HITLSystem);
    private setupNotionEventHandlers;
    private loadAutomationRules;
    initialize(): Promise<void>;
    testConnection(): Promise<boolean>;
    cleanup(): Promise<void>;
    createRevOpsKnowledgeBase(clientName: string, options?: {
        templateStructure?: 'basic' | 'advanced' | 'enterprise';
        includeAIFeatures?: boolean;
        setupAutomations?: boolean;
        integrations?: Array<{
            type: 'asana' | 'google' | 'crm';
            config: any;
        }>;
    }): Promise<any>;
    createLinkedDatabase(name: string, parentPageId: string, schema: {
        properties: Record<string, any>;
        views?: Array<{
            name: string;
            type: 'table' | 'board' | 'timeline' | 'calendar' | 'list' | 'gallery';
            filter?: any;
            sort?: any;
        }>;
        relations?: Array<{
            targetDatabaseId: string;
            propertyName: string;
            type: 'one-to-many' | 'many-to-many';
        }>;
    }, options?: {
        syncWithExternal?: {
            system: 'asana' | 'google' | 'crm';
            mapping: Record<string, string>;
        };
        enableAutomation?: boolean;
        aiProcessing?: boolean;
    }): Promise<any>;
    createSmartPage(databaseId: string, properties: Record<string, any>, options?: {
        autoGenerateContent?: boolean;
        templateId?: string;
        aiSuggestions?: boolean;
        linkedPages?: string[];
        workflows?: Array<{
            type: string;
            config: any;
        }>;
    }): Promise<any>;
    syncBidirectional(notionDatabaseId: string, externalSystem: {
        type: 'asana' | 'google' | 'crm';
        connectionId: string;
        resourceId: string;
        fieldMappings: Record<string, string>;
        conflictResolution: 'notion-wins' | 'external-wins' | 'newest-wins' | 'manual';
    }): Promise<void>;
    createAutomationRule(rule: NotionAutomationRule): Promise<void>;
    private setupAIEnhancements;
    private setupAIFeatures;
    private generatePageContent;
    private generateAIContent;
    private createContentBlocks;
    private getAISuggestions;
    private applyAISuggestions;
    private checkAutomationRules;
    private checkPropertyChanges;
    private matchesTriggerValue;
    private executeAutomationRule;
    private executeAutomationAction;
    private updatePageProperty;
    private createPageFromAutomation;
    private sendNotification;
    private triggerWorkflow;
    private validateAutomationRule;
    private activateAutomationRule;
    private setupDateTrigger;
    private checkDateTriggers;
    private loadSyncMappings;
    private performBidirectionalSync;
    private getNotionData;
    private getExternalData;
    private compareData;
    private applyChanges;
    private createConflictResolutionTasks;
    private setupRealtimeSync;
    private applyTemplateEnhancements;
    private applyBasicTemplate;
    private applyAdvancedTemplate;
    private applyEnterpriseTemplate;
    private setupDefaultAutomations;
    private setupIntegration;
    private setupAsanaIntegration;
    private setupGoogleIntegration;
    private setupCRMIntegration;
    private createKnowledgeBaseWorkflows;
    private setupDatabaseRelations;
    private setupDatabaseViews;
    private setupExternalSync;
    private enableDatabaseAutomations;
    private enableAIProcessing;
    private applyPageTemplate;
    private linkPages;
    private setupPageWorkflows;
    private syncToSwarmMemory;
    private startSync;
    private performSync;
    getNotionClient(): NotionIntegration;
    getWorkspaceAnalytics(workspaceId: string): Promise<any>;
    getAutomationRules(): NotionAutomationRule[];
    disableAutomationRule(ruleId: string): Promise<void>;
    getSyncMappings(): NotionSyncMapping[];
    removeSyncMapping(mappingKey: string): Promise<void>;
}
export default NotionEnhancedIntegration;
//# sourceMappingURL=NotionEnhancedIntegration.d.ts.map