"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleWorkspaceIntegration = void 0;
const events_1 = require("events");
const googleapis_1 = require("googleapis");
class GoogleWorkspaceIntegration extends events_1.EventEmitter {
    auth;
    drive;
    docs;
    sheets;
    slides;
    gmail;
    calendar;
    config;
    constructor(config) {
        super();
        this.config = config;
        this.auth = new googleapis_1.google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
        if (config.refreshToken) {
            this.auth.setCredentials({
                refresh_token: config.refreshToken,
                access_token: config.accessToken
            });
        }
        this.drive = googleapis_1.google.drive({ version: 'v3', auth: this.auth });
        this.docs = googleapis_1.google.docs({ version: 'v1', auth: this.auth });
        this.sheets = googleapis_1.google.sheets({ version: 'v4', auth: this.auth });
        this.slides = googleapis_1.google.slides({ version: 'v1', auth: this.auth });
        this.gmail = googleapis_1.google.gmail({ version: 'v1', auth: this.auth });
        this.calendar = googleapis_1.google.calendar({ version: 'v3', auth: this.auth });
        this.setupTokenRefresh();
    }
    setupTokenRefresh() {
        this.auth.on('tokens', (tokens) => {
            if (tokens.refresh_token) {
                this.config.refreshToken = tokens.refresh_token;
            }
            if (tokens.access_token) {
                this.config.accessToken = tokens.access_token;
            }
            this.emit('tokens-updated', tokens);
        });
    }
    getAuthUrl() {
        return this.auth.generateAuthUrl({
            access_type: 'offline',
            scope: this.config.scopes,
            prompt: 'consent'
        });
    }
    async exchangeCodeForTokens(code) {
        const { tokens } = await this.auth.getToken(code);
        this.auth.setCredentials(tokens);
        this.config.refreshToken = tokens.refresh_token;
        this.config.accessToken = tokens.access_token;
        return tokens;
    }
    async testConnection() {
        try {
            await this.drive.about.get({ fields: 'user' });
            return true;
        }
        catch (error) {
            this.emit('connection-error', error);
            return false;
        }
    }
    async createFolder(name, parentId) {
        const fileMetadata = {
            name,
            mimeType: 'application/vnd.google-apps.folder'
        };
        if (parentId) {
            fileMetadata.parents = [parentId];
        }
        const response = await this.drive.files.create({
            requestBody: fileMetadata,
            fields: 'id,name,parents,webViewLink,createdTime'
        });
        const folder = response.data;
        this.emit('folder-created', folder);
        return folder;
    }
    async uploadFile(name, content, mimeType, parentId) {
        const fileMetadata = { name };
        if (parentId) {
            fileMetadata.parents = [parentId];
        }
        const media = {
            mimeType,
            body: content
        };
        const response = await this.drive.files.create({
            requestBody: fileMetadata,
            media,
            fields: 'id,name,mimeType,parents,webViewLink,size,createdTime'
        });
        const file = response.data;
        this.emit('file-uploaded', file);
        return file;
    }
    async getFile(fileId) {
        const response = await this.drive.files.get({
            fileId,
            fields: 'id,name,mimeType,parents,webViewLink,size,createdTime,modifiedTime,thumbnailLink'
        });
        return response.data;
    }
    async listFiles(parentId, mimeType) {
        let query = '';
        if (parentId) {
            query += `'${parentId}' in parents`;
        }
        if (mimeType) {
            query += query ? ' and ' : '';
            query += `mimeType='${mimeType}'`;
        }
        if (!query) {
            query = 'trashed=false';
        }
        else {
            query += ' and trashed=false';
        }
        const response = await this.drive.files.list({
            q: query,
            fields: 'files(id,name,mimeType,parents,webViewLink,size,createdTime,modifiedTime)',
            orderBy: 'name'
        });
        return response.data.files;
    }
    async shareFile(fileId, emailAddress, role = 'reader') {
        const response = await this.drive.permissions.create({
            fileId,
            requestBody: {
                type: 'user',
                role,
                emailAddress
            },
            fields: 'id,type,role,emailAddress,displayName'
        });
        const permission = response.data;
        this.emit('file-shared', { fileId, permission });
        return permission;
    }
    async createFolderStructure(clientName) {
        const rootFolder = await this.createFolder(`${clientName} - RevOps`);
        const folders = {
            discovery: await this.createFolder('01_Discovery', rootFolder.id),
            analysis: await this.createFolder('02_Analysis', rootFolder.id),
            strategy: await this.createFolder('03_Strategy', rootFolder.id),
            implementation: await this.createFolder('04_Implementation', rootFolder.id),
            reports: await this.createFolder('05_Reports', rootFolder.id),
            resources: await this.createFolder('06_Resources', rootFolder.id)
        };
        this.emit('folder-structure-created', { clientName, rootFolder, folders });
        return { rootFolder, ...folders };
    }
    async createDocument(title, parentFolderId) {
        const response = await this.docs.documents.create({
            requestBody: { title }
        });
        const document = response.data;
        if (parentFolderId && document.documentId) {
            await this.drive.files.update({
                fileId: document.documentId,
                addParents: parentFolderId,
                fields: 'id,parents'
            });
        }
        this.emit('document-created', document);
        return document;
    }
    async updateDocument(documentId, requests) {
        const response = await this.docs.documents.batchUpdate({
            documentId,
            requestBody: { requests }
        });
        const updatedDoc = await this.getDocument(documentId);
        this.emit('document-updated', updatedDoc);
        return updatedDoc;
    }
    async getDocument(documentId) {
        const response = await this.docs.documents.get({ documentId });
        return response.data;
    }
    async insertTextInDocument(documentId, text, index = 1) {
        await this.docs.documents.batchUpdate({
            documentId,
            requestBody: {
                requests: [
                    {
                        insertText: {
                            location: { index },
                            text
                        }
                    }
                ]
            }
        });
    }
    async createSpreadsheet(title, parentFolderId) {
        const response = await this.sheets.spreadsheets.create({
            requestBody: {
                properties: { title }
            }
        });
        const spreadsheet = response.data;
        if (parentFolderId && spreadsheet.spreadsheetId) {
            await this.drive.files.update({
                fileId: spreadsheet.spreadsheetId,
                addParents: parentFolderId,
                fields: 'id,parents'
            });
        }
        this.emit('spreadsheet-created', spreadsheet);
        return spreadsheet;
    }
    async getSpreadsheet(spreadsheetId) {
        const response = await this.sheets.spreadsheets.get({ spreadsheetId });
        return response.data;
    }
    async updateSpreadsheetValues(spreadsheetId, range, values, valueInputOption = 'USER_ENTERED') {
        await this.sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption,
            requestBody: { values }
        });
        this.emit('spreadsheet-values-updated', { spreadsheetId, range, values });
    }
    async getSpreadsheetValues(spreadsheetId, range) {
        const response = await this.sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        return response.data.values || [];
    }
    async addSheet(spreadsheetId, title) {
        const response = await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [
                    {
                        addSheet: {
                            properties: { title }
                        }
                    }
                ]
            }
        });
        const sheet = response.data.replies?.[0]?.addSheet?.properties;
        this.emit('sheet-added', { spreadsheetId, sheet });
        return sheet;
    }
    async createPresentation(title, parentFolderId) {
        const response = await this.slides.presentations.create({
            requestBody: { title }
        });
        const presentation = response.data;
        if (parentFolderId && presentation.presentationId) {
            await this.drive.files.update({
                fileId: presentation.presentationId,
                addParents: parentFolderId,
                fields: 'id,parents'
            });
        }
        this.emit('presentation-created', presentation);
        return presentation;
    }
    async getPresentation(presentationId) {
        const response = await this.slides.presentations.get({ presentationId });
        return response.data;
    }
    async addSlide(presentationId, slideId) {
        const response = await this.slides.presentations.batchUpdate({
            presentationId,
            requestBody: {
                requests: [
                    {
                        createSlide: {
                            objectId: slideId,
                            insertionIndex: 1
                        }
                    }
                ]
            }
        });
        const slide = response.data.replies?.[0]?.createSlide?.objectId;
        const presentation = await this.getPresentation(presentationId);
        const createdSlide = presentation.slides.find(s => s.objectId === slide);
        this.emit('slide-added', { presentationId, slide: createdSlide });
        return createdSlide;
    }
    async sendEmail(to, subject, body, attachments) {
        const emailLines = [
            `To: ${to.join(', ')}`,
            `Subject: ${subject}`,
            'Content-Type: text/html; charset=utf-8',
            '',
            body
        ];
        const email = emailLines.join('\n');
        const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
        const response = await this.gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedEmail
            }
        });
        const message = response.data;
        this.emit('email-sent', { to, subject, message });
        return message;
    }
    async getEmails(query = '', maxResults = 10) {
        const response = await this.gmail.users.messages.list({
            userId: 'me',
            q: query,
            maxResults
        });
        const messageIds = response.data.messages || [];
        const messages = [];
        for (const messageId of messageIds) {
            if (messageId.id) {
                const messageResponse = await this.gmail.users.messages.get({
                    userId: 'me',
                    id: messageId.id
                });
                messages.push(messageResponse.data);
            }
        }
        return messages;
    }
    async createEvent(event, calendarId = 'primary') {
        const response = await this.calendar.events.insert({
            calendarId,
            requestBody: event
        });
        const createdEvent = response.data;
        this.emit('event-created', createdEvent);
        return createdEvent;
    }
    async getEvents(calendarId = 'primary', timeMin, timeMax, maxResults = 250) {
        const response = await this.calendar.events.list({
            calendarId,
            timeMin,
            timeMax,
            maxResults,
            singleEvents: true,
            orderBy: 'startTime'
        });
        return response.data.items;
    }
    async setupRevOpsClientStructure(clientName) {
        const folderStructure = await this.createFolderStructure(clientName);
        const strategyDoc = await this.createDocument(`${clientName} - Revenue Operations Strategy`, folderStructure.strategy.id);
        const processDoc = await this.createDocument(`${clientName} - Process Documentation`, folderStructure.implementation.id);
        const statusReport = await this.createDocument(`${clientName} - Weekly Status Report`, folderStructure.reports.id);
        const dashboard = await this.createSpreadsheet(`${clientName} - RevOps Dashboard`, folderStructure.reports.id);
        const financialModel = await this.createSpreadsheet(`${clientName} - Financial Model`, folderStructure.analysis.id);
        const pipeline = await this.createSpreadsheet(`${clientName} - Pipeline Tracking`, folderStructure.analysis.id);
        const qbrDeck = await this.createPresentation(`${clientName} - Quarterly Business Review`, folderStructure.reports.id);
        const strategyPresentation = await this.createPresentation(`${clientName} - Revenue Strategy Presentation`, folderStructure.strategy.id);
        const clientStructure = {
            clientName,
            rootFolder: folderStructure.rootFolder,
            folders: {
                discovery: folderStructure.discovery,
                analysis: folderStructure.analysis,
                strategy: folderStructure.strategy,
                implementation: folderStructure.implementation,
                reports: folderStructure.reports,
                resources: folderStructure.resources
            },
            documents: {
                strategyDoc,
                processDoc,
                statusReport
            },
            spreadsheets: {
                dashboard,
                financialModel,
                pipeline
            },
            presentations: {
                qbrDeck,
                strategyPresentation
            }
        };
        await this.setupRevOpsDashboard(dashboard.spreadsheetId, clientName);
        await this.populateStrategyDocument(strategyDoc.documentId, clientName);
        this.emit('revops-client-structure-created', clientStructure);
        return clientStructure;
    }
    async setupRevOpsDashboard(spreadsheetId, clientName) {
        await this.addSheet(spreadsheetId, 'Pipeline Metrics');
        await this.addSheet(spreadsheetId, 'Revenue Tracking');
        await this.addSheet(spreadsheetId, 'Process KPIs');
        await this.addSheet(spreadsheetId, 'Client Health');
        const headers = [
            ['Metric', 'Current Value', 'Target', 'Status', 'Last Updated'],
            ['Pipeline Value', '$0', '$0', 'In Progress', new Date().toDateString()],
            ['Conversion Rate', '0%', '0%', 'Monitoring', new Date().toDateString()],
            ['Revenue Growth', '0%', '0%', 'Planning', new Date().toDateString()],
            ['Process Efficiency', '0%', '0%', 'Baseline', new Date().toDateString()]
        ];
        await this.updateSpreadsheetValues(spreadsheetId, 'Sheet1!A1:E5', headers);
    }
    async populateStrategyDocument(documentId, clientName) {
        const content = `
# ${clientName} Revenue Operations Strategy

## Executive Summary
[Summary of the revenue operations strategy for ${clientName}]

## Current State Analysis
- Business Overview
- Revenue Process Assessment
- Technology Stack Review
- Key Challenges Identified

## Strategic Objectives
1. Revenue Growth Optimization
2. Process Standardization
3. Technology Integration
4. Performance Monitoring

## Implementation Roadmap
### Phase 1: Foundation (Weeks 1-4)
- Discovery and assessment
- Process mapping
- Technology audit

### Phase 2: Strategy Development (Weeks 5-8)
- Strategy formulation
- Roadmap creation
- Success metrics definition

### Phase 3: Implementation (Weeks 9-16)
- Process implementation
- Technology integration
- Team training

### Phase 4: Optimization (Weeks 17-20)
- Performance monitoring
- Continuous improvement
- Scale preparation

## Success Metrics
- Revenue Growth Rate
- Process Efficiency
- Technology Adoption
- Customer Satisfaction

## Next Steps
[Action items and immediate next steps]

---
Document created: ${new Date().toDateString()}
Last updated: ${new Date().toDateString()}
    `;
        await this.insertTextInDocument(documentId, content, 1);
    }
    async exportClientData(clientStructure) {
        return {
            clientName: clientStructure.clientName,
            folderStructure: clientStructure.folders,
            documents: {
                strategy: await this.getDocument(clientStructure.documents.strategyDoc.documentId),
                process: await this.getDocument(clientStructure.documents.processDoc.documentId),
                status: await this.getDocument(clientStructure.documents.statusReport.documentId)
            },
            spreadsheets: {
                dashboard: await this.getSpreadsheet(clientStructure.spreadsheets.dashboard.spreadsheetId),
                financial: await this.getSpreadsheet(clientStructure.spreadsheets.financialModel.spreadsheetId),
                pipeline: await this.getSpreadsheet(clientStructure.spreadsheets.pipeline.spreadsheetId)
            },
            exportDate: new Date().toISOString()
        };
    }
    async shareClientWorkspace(clientStructure, clientEmails) {
        const foldersToShare = [
            clientStructure.rootFolder,
            ...Object.values(clientStructure.folders)
        ];
        for (const folder of foldersToShare) {
            for (const email of clientEmails) {
                await this.shareFile(folder.id, email, 'reader');
            }
        }
        const documentsToShare = [
            clientStructure.documents.strategyDoc.documentId,
            clientStructure.documents.statusReport.documentId,
            clientStructure.spreadsheets.dashboard.spreadsheetId,
            clientStructure.presentations.qbrDeck.presentationId
        ];
        for (const docId of documentsToShare) {
            for (const email of clientEmails) {
                await this.shareFile(docId, email, 'commenter');
            }
        }
        this.emit('client-workspace-shared', { clientStructure, clientEmails });
    }
}
exports.GoogleWorkspaceIntegration = GoogleWorkspaceIntegration;
exports.default = GoogleWorkspaceIntegration;
//# sourceMappingURL=google-workspace-integration.js.map