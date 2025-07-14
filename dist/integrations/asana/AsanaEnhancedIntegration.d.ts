import { BaseIntegration, IntegrationConfig } from '../core/IntegrationFramework';
import { AsanaIntegration } from './asana-integration';
import { SwarmMemory } from '../../swarm/memory/SwarmMemory';
import { HITLSystem } from '../../workflow/hitl/HITLSystem';
export interface AsanaEnhancedConfig extends IntegrationConfig {
    workspace?: string;
    defaultProjectTemplateId?: string;
    customFieldMappings?: Record<string, string>;
    syncInterval?: number;
    enableWebhooks?: boolean;
    webhookSecret?: string;
}
export declare class AsanaEnhancedIntegration extends BaseIntegration {
    private asanaClient;
    private swarmMemory?;
    private hitlSystem?;
    private syncInterval?;
    private webhookHandlers;
    constructor(config: AsanaEnhancedConfig, swarmMemory?: SwarmMemory, hitlSystem?: HITLSystem);
    private setupAsanaEventHandlers;
    private registerWebhookHandlers;
    initialize(): Promise<void>;
    testConnection(): Promise<boolean>;
    cleanup(): Promise<void>;
    createRevOpsProject(clientName: string, options?: {
        templateId?: string;
        teamGid?: string;
        customFields?: Record<string, any>;
        initialTasks?: Array<{
            name: string;
            notes?: string;
            assignee?: string;
        }>;
    }): Promise<any>;
    syncProjectWithNotion(asanaProjectGid: string, notionDatabaseId: string): Promise<void>;
    createTaskWithApproval(taskData: any, approvalConfig: {
        requiresApproval: boolean;
        approvers?: string[];
        approvalThreshold?: number;
        escalationTime?: number;
    }): Promise<any>;
    bulkUpdateTasks(updates: Array<{
        taskGid: string;
        updates: any;
    }>): Promise<Array<{
        taskGid: string;
        success: boolean;
        error?: any;
    }>>;
    handleWebhook(event: any, signature?: string): Promise<void>;
    private verifyWebhookSignature;
    private handleTaskStatusChange;
    private handleTaskAssignment;
    private handleProjectStatusUpdate;
    private handleCustomFieldChange;
    private syncToSwarmMemory;
    private checkHITLRequirements;
    private createProjectWorkflow;
    private applyCustomFields;
    private handleCustomFieldAction;
    private startSync;
    private performSync;
    private setupWebhooks;
    private cleanupWebhooks;
    getAsanaClient(): AsanaIntegration;
    getProjectAnalytics(projectGid: string): Promise<any>;
    private groupTasksByAssignee;
    private groupTasksByStatus;
    private calculateAverageCompletionTime;
}
export default AsanaEnhancedIntegration;
//# sourceMappingURL=AsanaEnhancedIntegration.d.ts.map