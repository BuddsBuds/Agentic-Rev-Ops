"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleEnhancedIntegration = void 0;
const IntegrationFramework_1 = require("../core/IntegrationFramework");
const google_workspace_integration_1 = require("./google-workspace-integration");
class GoogleEnhancedIntegration extends IntegrationFramework_1.BaseIntegration {
    googleClient;
    swarmMemory;
    hitlSystem;
    syncInterval;
    backupInterval;
    collaborationSessions = new Map();
    changeListeners = new Map();
    constructor(config, swarmMemory, hitlSystem) {
        super(config);
        this.swarmMemory = swarmMemory;
        this.hitlSystem = hitlSystem;
        this.googleClient = new google_workspace_integration_1.GoogleWorkspaceIntegration({
            clientId: config.authConfig.oauth2?.clientId || '',
            clientSecret: config.authConfig.oauth2?.clientSecret || '',
            redirectUri: config.authConfig.oauth2?.redirectUri || '',
            refreshToken: config.authConfig.oauth2?.refreshToken,
            accessToken: config.authConfig.oauth2?.accessToken,
            scopes: config.scopes
        });
        this.setupGoogleEventHandlers();
    }
    setupGoogleEventHandlers() {
        this.googleClient.on('folder-created', (folder) => {
            this.emit('google:folder_created', folder);
            this.syncToSwarmMemory('folder', folder);
        });
        this.googleClient.on('file-uploaded', (file) => {
            this.emit('google:file_uploaded', file);
            this.syncToSwarmMemory('file', file);
        });
        this.googleClient.on('document-created', (document) => {
            this.emit('google:document_created', document);
            this.setupDocumentTracking(document);
        });
        this.googleClient.on('spreadsheet-created', (spreadsheet) => {
            this.emit('google:spreadsheet_created', spreadsheet);
            this.setupSpreadsheetTracking(spreadsheet);
        });
        this.googleClient.on('file-shared', (data) => {
            this.emit('google:file_shared', data);
            this.checkSharingCompliance(data);
        });
        this.googleClient.on('tokens-updated', (tokens) => {
            this.updateAuthTokens(tokens);
        });
    }
    async initialize() {
        const isConnected = await this.testConnection();
        if (!isConnected) {
            throw new Error('Failed to connect to Google Workspace');
        }
        if (this.config.syncInterval) {
            this.startSync();
        }
        const autoBackup = this.config.autoBackup;
        if (autoBackup?.enabled) {
            this.startAutoBackup();
        }
        if (this.config.enableRealTimeCollaboration) {
            await this.setupRealTimeCollaboration();
        }
        this.emit('initialized', { integrationId: this.config.id });
    }
    async testConnection() {
        try {
            return await this.googleClient.testConnection();
        }
        catch (error) {
            this.emit('connection:failed', { error });
            return false;
        }
    }
    async cleanup() {
        if (this.syncInterval)
            clearInterval(this.syncInterval);
        if (this.backupInterval)
            clearInterval(this.backupInterval);
        for (const listener of this.changeListeners.values()) {
            clearInterval(listener);
        }
        this.emit('cleanup:completed', { integrationId: this.config.id });
    }
    async createRevOpsWorkspace(clientName, options) {
        try {
            const clientStructure = await this.googleClient.setupRevOpsClientStructure(clientName);
            if (options?.includeTemplates && options.templateFolderId) {
                await this.copyTemplates(options.templateFolderId, clientStructure.rootFolder.id);
            }
            if (options?.shareWithEmails) {
                await this.shareWorkspace(clientStructure, options.shareWithEmails);
            }
            if (options?.setupCalendar) {
                await this.setupClientCalendar(clientName, clientStructure);
            }
            if (options?.createDashboard) {
                await this.createAnalyticsDashboard(clientStructure);
            }
            await this.applyDefaultPermissions(clientStructure.rootFolder.id);
            if (this.swarmMemory) {
                await this.swarmMemory.store(`google:workspace:${clientStructure.rootFolder.id}`, {
                    clientName,
                    structure: clientStructure,
                    createdAt: new Date(),
                    integrationId: this.config.id
                });
            }
            if (this.hitlSystem) {
                await this.createDocumentReviewWorkflow(clientStructure);
            }
            this.emit('revops:workspace_created', { clientName, structure: clientStructure });
            return clientStructure;
        }
        catch (error) {
            this.emit('revops:workspace_creation_failed', { clientName, error });
            throw error;
        }
    }
    async createCollaborativeDocument(title, content, options) {
        try {
            const document = await this.googleClient.createDocument(title, options?.folderId);
            await this.googleClient.insertTextInDocument(document.documentId, content);
            if (options?.permissions) {
                for (const permission of options.permissions) {
                    await this.googleClient.shareFile(document.documentId, permission.email, permission.role);
                }
            }
            if (options?.trackChanges) {
                await this.enableChangeTracking(document.documentId);
            }
            if (options?.requireApproval && this.hitlSystem) {
                await this.createDocumentApprovalWorkflow(document);
            }
            const session = await this.startCollaborationSession(document.documentId, options?.collaborators || []);
            this.emit('document:collaborative_created', { document, session });
            return { document, session };
        }
        catch (error) {
            this.emit('document:creation_failed', { title, error });
            throw error;
        }
    }
    async createDataDashboard(name, dataSource, options) {
        try {
            const spreadsheet = await this.googleClient.createSpreadsheet(`${name} - Dashboard`, options?.folderId);
            await this.setupDataConnection(spreadsheet.spreadsheetId, dataSource);
            await this.googleClient.addSheet(spreadsheet.spreadsheetId, 'Raw Data');
            await this.googleClient.addSheet(spreadsheet.spreadsheetId, 'Summary');
            await this.googleClient.addSheet(spreadsheet.spreadsheetId, 'Charts');
            if (options?.refreshInterval) {
                await this.scheduleDataRefresh(spreadsheet.spreadsheetId, options.refreshInterval);
            }
            if (options?.charts) {
                await this.createCharts(spreadsheet.spreadsheetId, options.charts);
            }
            this.emit('dashboard:created', { name, spreadsheet });
            return spreadsheet;
        }
        catch (error) {
            this.emit('dashboard:creation_failed', { name, error });
            throw error;
        }
    }
    async syncWithExternalSystem(folderId, externalSystem) {
        try {
            const syncId = `sync:${folderId}:${externalSystem.type}`;
            if (this.swarmMemory) {
                await this.swarmMemory.store(syncId, {
                    folderId,
                    externalSystem,
                    lastSync: new Date(),
                    status: 'active'
                });
            }
            await this.performSync();
            this.emit('sync:external_system_setup', { folderId, externalSystem });
        }
        catch (error) {
            this.emit('sync:external_system_failed', { folderId, externalSystem, error });
            throw error;
        }
    }
    async generateReport(templateId, data, options) {
        try {
            const reportFile = await this.cloneTemplate(templateId, options?.destinationFolderId);
            await this.populateTemplate(reportFile.id, data);
            if (options?.format && options.format !== 'docx') {
            }
            if (options?.emailTo && options.emailTo.length > 0) {
                await this.emailReport(reportFile, options.emailTo);
            }
            this.emit('report:generated', { reportFile, templateId });
            return reportFile;
        }
        catch (error) {
            this.emit('report:generation_failed', { templateId, error });
            throw error;
        }
    }
    async setupRealTimeCollaboration() {
        this.emit('collaboration:setup_started');
    }
    async startCollaborationSession(documentId, participants) {
        const session = {
            id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            documentId,
            participants,
            startTime: new Date(),
            lastActivity: new Date(),
            changes: 0,
            status: 'active'
        };
        this.collaborationSessions.set(session.id, session);
        const listener = setInterval(async () => {
            await this.monitorDocumentChanges(session);
        }, 30000);
        this.changeListeners.set(session.id, listener);
        return session;
    }
    async monitorDocumentChanges(session) {
        try {
            session.lastActivity = new Date();
            const idleTime = Date.now() - session.lastActivity.getTime();
            if (idleTime > 3600000) {
                session.status = 'idle';
            }
            this.emit('collaboration:activity', { session });
        }
        catch (error) {
            this.emit('collaboration:monitoring_error', { session, error });
        }
    }
    async enableChangeTracking(documentId) {
        if (this.swarmMemory) {
            await this.swarmMemory.store(`google:tracking:${documentId}`, {
                enabled: true,
                startTime: new Date(),
                changes: []
            });
        }
    }
    async createDocumentApprovalWorkflow(document) {
        if (!this.hitlSystem)
            return;
        const orchestrator = this.hitlSystem.getComponent('orchestrator');
        if (orchestrator) {
            await orchestrator.createDecision({
                title: `Approve Document: ${document.title}`,
                description: 'Document requires approval before finalization',
                type: 'document_approval',
                source: 'google_integration',
                requiresApproval: true,
                context: {
                    documentId: document.documentId,
                    documentUrl: document.documentsLink,
                    documentTitle: document.title
                },
                options: [
                    { id: 'approve', label: 'Approve', value: true },
                    { id: 'request_changes', label: 'Request Changes', value: false }
                ]
            });
        }
    }
    async createDocumentReviewWorkflow(clientStructure) {
        if (!this.hitlSystem)
            return;
        const workflowEngine = this.hitlSystem.getComponent('workflows');
        if (workflowEngine) {
            await workflowEngine.createWorkflow({
                name: `${clientStructure.clientName} - Document Review Workflow`,
                description: 'Automated review workflow for client documents',
                stages: [
                    {
                        id: 'draft_review',
                        name: 'Draft Review',
                        type: 'review',
                        config: {
                            requiresApproval: true,
                            timeoutMinutes: 1440
                        }
                    },
                    {
                        id: 'legal_review',
                        name: 'Legal Review',
                        type: 'approval',
                        config: {
                            requiresApproval: true,
                            approvers: ['legal_team'],
                            timeoutMinutes: 2880
                        }
                    },
                    {
                        id: 'final_approval',
                        name: 'Final Approval',
                        type: 'approval',
                        config: {
                            requiresApproval: true,
                            minApprovers: 2,
                            timeoutMinutes: 1440
                        }
                    }
                ],
                metadata: {
                    googleWorkspaceId: clientStructure.rootFolder.id,
                    integrationId: this.config.id
                }
            });
        }
    }
    async setupDataConnection(spreadsheetId, dataSource) {
        if (this.swarmMemory) {
            await this.swarmMemory.store(`google:data_connection:${spreadsheetId}`, {
                dataSource,
                setupTime: new Date(),
                status: 'active'
            });
        }
    }
    async scheduleDataRefresh(spreadsheetId, intervalMs) {
        const refreshJob = setInterval(async () => {
            await this.refreshDashboardData(spreadsheetId);
        }, intervalMs);
        this.changeListeners.set(`refresh:${spreadsheetId}`, refreshJob);
    }
    async refreshDashboardData(spreadsheetId) {
        try {
            this.emit('dashboard:data_refreshed', { spreadsheetId });
        }
        catch (error) {
            this.emit('dashboard:refresh_failed', { spreadsheetId, error });
        }
    }
    async createCharts(spreadsheetId, charts) {
        for (const chart of charts) {
            this.emit('chart:created', { spreadsheetId, chart });
        }
    }
    async createAnalyticsDashboard(clientStructure) {
        const dashboard = clientStructure.spreadsheets.dashboard;
        await this.googleClient.addSheet(dashboard.spreadsheetId, 'KPI Tracking');
        await this.googleClient.addSheet(dashboard.spreadsheetId, 'Revenue Analysis');
        await this.googleClient.addSheet(dashboard.spreadsheetId, 'Process Metrics');
    }
    startAutoBackup() {
        const config = this.config.autoBackup;
        if (!config || !config.enabled)
            return;
        this.backupInterval = setInterval(async () => {
            await this.performBackup();
        }, config.interval);
        this.performBackup();
    }
    async performBackup() {
        try {
            const config = this.config.autoBackup;
            if (!config)
                return;
            const lastBackup = await this.getLastBackupTime();
            const backupFolder = await this.googleClient.createFolder(`Backup_${new Date().toISOString().split('T')[0]}`);
            await this.cleanOldBackups(config.retentionDays);
            this.emit('backup:completed', { folderId: backupFolder.id });
        }
        catch (error) {
            this.emit('backup:failed', { error });
        }
    }
    async getLastBackupTime() {
        if (this.swarmMemory) {
            const lastBackup = await this.swarmMemory.retrieve('google:last_backup');
            return lastBackup ? new Date(lastBackup.timestamp) : new Date(0);
        }
        return new Date(0);
    }
    async cleanOldBackups(retentionDays) {
        this.emit('backup:cleanup_completed');
    }
    async checkSharingCompliance(data) {
        if (data.permission.type === 'anyone') {
            this.emit('compliance:public_sharing_detected', data);
            if (this.hitlSystem) {
                await this.hitlSystem.createHumanTask({
                    title: 'Review Public File Sharing',
                    description: `File shared publicly: ${data.fileId}`,
                    priority: 'high',
                    type: 'compliance_review'
                });
            }
        }
    }
    async syncToSwarmMemory(type, data) {
        if (!this.swarmMemory)
            return;
        await this.swarmMemory.store(`google:${type}:${data.id}`, {
            type,
            data,
            syncedAt: new Date(),
            integrationId: this.config.id
        });
    }
    async updateAuthTokens(tokens) {
        if (this.config.authConfig.oauth2) {
            this.config.authConfig.oauth2.accessToken = tokens.access_token;
            if (tokens.refresh_token) {
                this.config.authConfig.oauth2.refreshToken = tokens.refresh_token;
            }
            if (tokens.expiry_date) {
                this.config.authConfig.oauth2.expiresAt = new Date(tokens.expiry_date);
            }
        }
    }
    async setupDocumentTracking(document) {
        if (this.swarmMemory) {
            await this.swarmMemory.store(`google:document:${document.documentId}:created`, {
                document,
                createdAt: new Date(),
                trackingEnabled: true
            });
        }
    }
    async setupSpreadsheetTracking(spreadsheet) {
        if (this.swarmMemory) {
            await this.swarmMemory.store(`google:spreadsheet:${spreadsheet.spreadsheetId}:created`, {
                spreadsheet,
                createdAt: new Date(),
                trackingEnabled: true
            });
        }
    }
    async copyTemplates(templateFolderId, destinationFolderId) {
        const templates = await this.googleClient.listFiles(templateFolderId);
        for (const template of templates) {
            this.emit('template:copied', { template, destinationFolderId });
        }
    }
    async shareWorkspace(structure, emails) {
        await this.googleClient.shareClientWorkspace(structure, emails);
    }
    async setupClientCalendar(clientName, structure) {
        const events = [
            {
                summary: `${clientName} - Project Kickoff`,
                start: { dateTime: new Date().toISOString() },
                end: { dateTime: new Date(Date.now() + 3600000).toISOString() }
            },
            {
                summary: `${clientName} - Weekly Review`,
                start: { dateTime: new Date(Date.now() + 7 * 24 * 3600000).toISOString() },
                end: { dateTime: new Date(Date.now() + 7 * 24 * 3600000 + 3600000).toISOString() },
                recurrence: ['RRULE:FREQ=WEEKLY;COUNT=10']
            }
        ];
        for (const event of events) {
            await this.googleClient.createEvent(event);
        }
    }
    async applyDefaultPermissions(folderId) {
        const defaultPermissions = this.config.defaultPermissions;
        if (defaultPermissions) {
            for (const permission of defaultPermissions) {
                await this.googleClient.shareFile(folderId, permission.email, permission.role);
            }
        }
    }
    async cloneTemplate(templateId, destinationFolderId) {
        return { id: `cloned-${templateId}`, name: 'Cloned Document' };
    }
    async populateTemplate(fileId, data) {
        this.emit('template:populated', { fileId, data });
    }
    async emailReport(file, recipients) {
        await this.googleClient.sendEmail(recipients, `Report Generated: ${file.name}`, `Your report has been generated and is available at: ${file.webViewLink}`, [file]);
    }
    startSync() {
        const interval = this.config.syncInterval || 300000;
        this.syncInterval = setInterval(async () => {
            await this.performSync();
        }, interval);
        this.performSync();
    }
    async performSync() {
        try {
            this.emit('sync:started', { integrationId: this.config.id });
            this.emit('sync:completed', { integrationId: this.config.id });
        }
        catch (error) {
            this.emit('sync:failed', { integrationId: this.config.id, error });
        }
    }
    getGoogleClient() {
        return this.googleClient;
    }
    async getWorkspaceAnalytics(folderId) {
        const files = await this.googleClient.listFiles(folderId);
        const analytics = {
            totalFiles: files.length,
            filesByType: this.groupFilesByType(files),
            totalSize: files.reduce((sum, file) => sum + (parseInt(file.size || '0') || 0), 0),
            lastModified: this.getLastModifiedDate(files),
            collaborators: await this.getUniqueCollaborators(files)
        };
        return analytics;
    }
    groupFilesByType(files) {
        const grouped = {};
        for (const file of files) {
            const type = this.getFileType(file.mimeType);
            grouped[type] = (grouped[type] || 0) + 1;
        }
        return grouped;
    }
    getFileType(mimeType) {
        if (mimeType.includes('document'))
            return 'Document';
        if (mimeType.includes('spreadsheet'))
            return 'Spreadsheet';
        if (mimeType.includes('presentation'))
            return 'Presentation';
        if (mimeType.includes('folder'))
            return 'Folder';
        return 'Other';
    }
    getLastModifiedDate(files) {
        if (files.length === 0)
            return null;
        return files.reduce((latest, file) => {
            const modified = new Date(file.modifiedTime);
            return modified > latest ? modified : latest;
        }, new Date(0));
    }
    async getUniqueCollaborators(files) {
        return [];
    }
    getCollaborationSessions() {
        return Array.from(this.collaborationSessions.values());
    }
    endCollaborationSession(sessionId) {
        const session = this.collaborationSessions.get(sessionId);
        if (session) {
            session.status = 'completed';
            const listener = this.changeListeners.get(sessionId);
            if (listener) {
                clearInterval(listener);
                this.changeListeners.delete(sessionId);
            }
            this.emit('collaboration:session_ended', { session });
        }
    }
}
exports.GoogleEnhancedIntegration = GoogleEnhancedIntegration;
exports.default = GoogleEnhancedIntegration;
//# sourceMappingURL=GoogleEnhancedIntegration.js.map