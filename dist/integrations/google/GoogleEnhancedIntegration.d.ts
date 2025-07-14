import { BaseIntegration, IntegrationConfig } from '../core/IntegrationFramework';
import { GoogleWorkspaceIntegration } from './google-workspace-integration';
import { SwarmMemory } from '../../swarm/memory/SwarmMemory';
import { HITLSystem } from '../../workflow/hitl/HITLSystem';
export interface GoogleEnhancedConfig extends IntegrationConfig {
    scopes: string[];
    enableRealTimeCollaboration?: boolean;
    syncInterval?: number;
    templateFolderId?: string;
    sharedDriveId?: string;
    defaultPermissions?: Array<{
        email: string;
        role: 'reader' | 'writer' | 'commenter';
    }>;
    autoBackup?: {
        enabled: boolean;
        interval: number;
        retentionDays: number;
    };
}
export interface CollaborationSession {
    id: string;
    documentId: string;
    participants: string[];
    startTime: Date;
    lastActivity: Date;
    changes: number;
    status: 'active' | 'idle' | 'completed';
}
export declare class GoogleEnhancedIntegration extends BaseIntegration {
    private googleClient;
    private swarmMemory?;
    private hitlSystem?;
    private syncInterval?;
    private backupInterval?;
    private collaborationSessions;
    private changeListeners;
    constructor(config: GoogleEnhancedConfig, swarmMemory?: SwarmMemory, hitlSystem?: HITLSystem);
    private setupGoogleEventHandlers;
    initialize(): Promise<void>;
    testConnection(): Promise<boolean>;
    cleanup(): Promise<void>;
    createRevOpsWorkspace(clientName: string, options?: {
        templateFolderId?: string;
        includeTemplates?: boolean;
        shareWithEmails?: string[];
        setupCalendar?: boolean;
        createDashboard?: boolean;
    }): Promise<any>;
    createCollaborativeDocument(title: string, content: string, options?: {
        folderId?: string;
        collaborators?: string[];
        permissions?: Array<{
            email: string;
            role: 'reader' | 'writer' | 'commenter';
        }>;
        trackChanges?: boolean;
        requireApproval?: boolean;
    }): Promise<any>;
    createDataDashboard(name: string, dataSource: {
        type: 'asana' | 'notion' | 'crm' | 'custom';
        connectionId?: string;
        query?: any;
    }, options?: {
        folderId?: string;
        refreshInterval?: number;
        charts?: Array<{
            type: 'line' | 'bar' | 'pie' | 'scatter';
            dataRange: string;
            title: string;
        }>;
    }): Promise<any>;
    syncWithExternalSystem(folderId: string, externalSystem: {
        type: 'asana' | 'notion' | 'github' | 'jira';
        connectionId: string;
        syncConfig: {
            direction: 'one-way' | 'two-way';
            frequency: number;
            mappings: Record<string, string>;
        };
    }): Promise<void>;
    generateReport(templateId: string, data: any, options?: {
        format: 'pdf' | 'docx' | 'slides';
        destinationFolderId?: string;
        emailTo?: string[];
    }): Promise<any>;
    private setupRealTimeCollaboration;
    private startCollaborationSession;
    private monitorDocumentChanges;
    private enableChangeTracking;
    private createDocumentApprovalWorkflow;
    private createDocumentReviewWorkflow;
    private setupDataConnection;
    private scheduleDataRefresh;
    private refreshDashboardData;
    private createCharts;
    private createAnalyticsDashboard;
    private startAutoBackup;
    private performBackup;
    private getLastBackupTime;
    private cleanOldBackups;
    private checkSharingCompliance;
    private syncToSwarmMemory;
    private updateAuthTokens;
    private setupDocumentTracking;
    private setupSpreadsheetTracking;
    private copyTemplates;
    private shareWorkspace;
    private setupClientCalendar;
    private applyDefaultPermissions;
    private cloneTemplate;
    private populateTemplate;
    private emailReport;
    private startSync;
    private performSync;
    getGoogleClient(): GoogleWorkspaceIntegration;
    getWorkspaceAnalytics(folderId: string): Promise<any>;
    private groupFilesByType;
    private getFileType;
    private getLastModifiedDate;
    private getUniqueCollaborators;
    getCollaborationSessions(): CollaborationSession[];
    endCollaborationSession(sessionId: string): void;
}
export default GoogleEnhancedIntegration;
//# sourceMappingURL=GoogleEnhancedIntegration.d.ts.map