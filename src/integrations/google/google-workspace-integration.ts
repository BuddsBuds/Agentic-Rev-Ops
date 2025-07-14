// Google Workspace Integration for Agentic RevOps
import { EventEmitter } from 'events';
import { google, drive_v3, docs_v1, sheets_v4, slides_v1, gmail_v1, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleWorkspaceConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken?: string;
  accessToken?: string;
  scopes: string[];
}

export interface DriveFolder {
  id: string;
  name: string;
  parents?: string[];
  webViewLink?: string;
  permissions?: DrivePermission[];
  createdTime?: string;
  modifiedTime?: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  webViewLink?: string;
  downloadUrl?: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  permissions?: DrivePermission[];
  thumbnailLink?: string;
}

export interface DrivePermission {
  id: string;
  type: 'user' | 'group' | 'domain' | 'anyone';
  role: 'owner' | 'organizer' | 'fileOrganizer' | 'writer' | 'commenter' | 'reader';
  emailAddress?: string;
  domain?: string;
  displayName?: string;
}

export interface GoogleDocument {
  documentId: string;
  title: string;
  body: any;
  revisionId: string;
  suggestionsViewMode?: string;
  documentsLink?: string;
}

export interface GoogleSpreadsheet {
  spreadsheetId: string;
  title: string;
  sheets: GoogleSheet[];
  spreadsheetUrl?: string;
  locale?: string;
  autoRecalc?: string;
  timeZone?: string;
}

export interface GoogleSheet {
  sheetId: number;
  title: string;
  index: number;
  sheetType: string;
  gridProperties?: {
    rowCount: number;
    columnCount: number;
  };
  data?: any[][];
}

export interface GooglePresentation {
  presentationId: string;
  title: string;
  slides: GoogleSlide[];
  masters: any[];
  layouts: any[];
  locale?: string;
  pageSize?: any;
  revisionId?: string;
}

export interface GoogleSlide {
  objectId: string;
  pageElements?: any[];
  slideProperties?: any;
  layoutProperties?: any;
  notesProperties?: any;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  historyId: string;
  internalDate: string;
  payload: any;
  sizeEstimate: number;
  raw?: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: { email: string; responseStatus?: string; displayName?: string }[];
  location?: string;
  conferenceData?: any;
  reminders?: any;
  recurrence?: string[];
  status?: string;
  organizer?: { email: string; displayName?: string };
  creator?: { email: string; displayName?: string };
}

export interface RevOpsClientStructure {
  clientName: string;
  rootFolder: DriveFolder;
  folders: {
    discovery: DriveFolder;
    analysis: DriveFolder;
    strategy: DriveFolder;
    implementation: DriveFolder;
    reports: DriveFolder;
    resources: DriveFolder;
  };
  documents: {
    strategyDoc: GoogleDocument;
    processDoc: GoogleDocument;
    statusReport: GoogleDocument;
  };
  spreadsheets: {
    dashboard: GoogleSpreadsheet;
    financialModel: GoogleSpreadsheet;
    pipeline: GoogleSpreadsheet;
  };
  presentations: {
    qbrDeck: GooglePresentation;
    strategyPresentation: GooglePresentation;
  };
}

export class GoogleWorkspaceIntegration extends EventEmitter {
  private auth: OAuth2Client;
  private drive: drive_v3.Drive;
  private docs: docs_v1.Docs;
  private sheets: sheets_v4.Sheets;
  private slides: slides_v1.Slides;
  private gmail: gmail_v1.Gmail;
  private calendar: calendar_v3.Calendar;
  private config: GoogleWorkspaceConfig;

  constructor(config: GoogleWorkspaceConfig) {
    super();
    this.config = config;

    // Initialize OAuth2 client
    this.auth = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );

    if (config.refreshToken) {
      this.auth.setCredentials({
        refresh_token: config.refreshToken,
        access_token: config.accessToken
      });
    }

    // Initialize Google APIs
    this.drive = google.drive({ version: 'v3', auth: this.auth });
    this.docs = google.docs({ version: 'v1', auth: this.auth });
    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    this.slides = google.slides({ version: 'v1', auth: this.auth });
    this.gmail = google.gmail({ version: 'v1', auth: this.auth });
    this.calendar = google.calendar({ version: 'v3', auth: this.auth });

    this.setupTokenRefresh();
  }

  private setupTokenRefresh(): void {
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

  // Authentication
  getAuthUrl(): string {
    return this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: this.config.scopes,
      prompt: 'consent'
    });
  }

  async exchangeCodeForTokens(code: string): Promise<any> {
    const { tokens } = await this.auth.getToken(code);
    this.auth.setCredentials(tokens);
    this.config.refreshToken = tokens.refresh_token;
    this.config.accessToken = tokens.access_token;
    return tokens;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.drive.about.get({ fields: 'user' });
      return true;
    } catch (error) {
      this.emit('connection-error', error);
      return false;
    }
  }

  // Google Drive Operations
  async createFolder(name: string, parentId?: string): Promise<DriveFolder> {
    const fileMetadata: any = {
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

    const folder = response.data as DriveFolder;
    this.emit('folder-created', folder);
    return folder;
  }

  async uploadFile(
    name: string,
    content: Buffer | string,
    mimeType: string,
    parentId?: string
  ): Promise<DriveFile> {
    const fileMetadata: any = { name };
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

    const file = response.data as DriveFile;
    this.emit('file-uploaded', file);
    return file;
  }

  async getFile(fileId: string): Promise<DriveFile> {
    const response = await this.drive.files.get({
      fileId,
      fields: 'id,name,mimeType,parents,webViewLink,size,createdTime,modifiedTime,thumbnailLink'
    });
    return response.data as DriveFile;
  }

  async listFiles(parentId?: string, mimeType?: string): Promise<DriveFile[]> {
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
    } else {
      query += ' and trashed=false';
    }

    const response = await this.drive.files.list({
      q: query,
      fields: 'files(id,name,mimeType,parents,webViewLink,size,createdTime,modifiedTime)',
      orderBy: 'name'
    });

    return response.data.files as DriveFile[];
  }

  async shareFile(
    fileId: string,
    emailAddress: string,
    role: 'reader' | 'writer' | 'commenter' = 'reader'
  ): Promise<DrivePermission> {
    const response = await this.drive.permissions.create({
      fileId,
      requestBody: {
        type: 'user',
        role,
        emailAddress
      },
      fields: 'id,type,role,emailAddress,displayName'
    });

    const permission = response.data as DrivePermission;
    this.emit('file-shared', { fileId, permission });
    return permission;
  }

  async createFolderStructure(clientName: string): Promise<RevOpsClientStructure['folders'] & { rootFolder: DriveFolder }> {
    // Create root client folder
    const rootFolder = await this.createFolder(`${clientName} - RevOps`);

    // Create subfolder structure
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

  // Google Docs Operations
  async createDocument(title: string, parentFolderId?: string): Promise<GoogleDocument> {
    const response = await this.docs.documents.create({
      requestBody: { title }
    });

    const document = response.data as GoogleDocument;

    // Move to folder if specified
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

  async updateDocument(documentId: string, requests: any[]): Promise<GoogleDocument> {
    const response = await this.docs.documents.batchUpdate({
      documentId,
      requestBody: { requests }
    });

    const updatedDoc = await this.getDocument(documentId);
    this.emit('document-updated', updatedDoc);
    return updatedDoc;
  }

  async getDocument(documentId: string): Promise<GoogleDocument> {
    const response = await this.docs.documents.get({ documentId });
    return response.data as GoogleDocument;
  }

  async insertTextInDocument(documentId: string, text: string, index: number = 1): Promise<void> {
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

  // Google Sheets Operations
  async createSpreadsheet(title: string, parentFolderId?: string): Promise<GoogleSpreadsheet> {
    const response = await this.sheets.spreadsheets.create({
      requestBody: {
        properties: { title }
      }
    });

    const spreadsheet = response.data as GoogleSpreadsheet;

    // Move to folder if specified
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

  async getSpreadsheet(spreadsheetId: string): Promise<GoogleSpreadsheet> {
    const response = await this.sheets.spreadsheets.get({ spreadsheetId });
    return response.data as GoogleSpreadsheet;
  }

  async updateSpreadsheetValues(
    spreadsheetId: string,
    range: string,
    values: any[][],
    valueInputOption: 'RAW' | 'USER_ENTERED' = 'USER_ENTERED'
  ): Promise<void> {
    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption,
      requestBody: { values }
    });

    this.emit('spreadsheet-values-updated', { spreadsheetId, range, values });
  }

  async getSpreadsheetValues(spreadsheetId: string, range: string): Promise<any[][]> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range
    });
    return response.data.values || [];
  }

  async addSheet(spreadsheetId: string, title: string): Promise<GoogleSheet> {
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

    const sheet = response.data.replies?.[0]?.addSheet?.properties as GoogleSheet;
    this.emit('sheet-added', { spreadsheetId, sheet });
    return sheet;
  }

  // Google Slides Operations
  async createPresentation(title: string, parentFolderId?: string): Promise<GooglePresentation> {
    const response = await this.slides.presentations.create({
      requestBody: { title }
    });

    const presentation = response.data as GooglePresentation;

    // Move to folder if specified
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

  async getPresentation(presentationId: string): Promise<GooglePresentation> {
    const response = await this.slides.presentations.get({ presentationId });
    return response.data as GooglePresentation;
  }

  async addSlide(presentationId: string, slideId?: string): Promise<GoogleSlide> {
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
    return createdSlide as GoogleSlide;
  }

  // Gmail Operations
  async sendEmail(to: string[], subject: string, body: string, attachments?: DriveFile[]): Promise<GmailMessage> {
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

    const message = response.data as GmailMessage;
    this.emit('email-sent', { to, subject, message });
    return message;
  }

  async getEmails(query: string = '', maxResults: number = 10): Promise<GmailMessage[]> {
    const response = await this.gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults
    });

    const messageIds = response.data.messages || [];
    const messages: GmailMessage[] = [];

    for (const messageId of messageIds) {
      if (messageId.id) {
        const messageResponse = await this.gmail.users.messages.get({
          userId: 'me',
          id: messageId.id
        });
        messages.push(messageResponse.data as GmailMessage);
      }
    }

    return messages;
  }

  // Calendar Operations
  async createEvent(event: Partial<CalendarEvent>, calendarId: string = 'primary'): Promise<CalendarEvent> {
    const response = await this.calendar.events.insert({
      calendarId,
      requestBody: event as calendar_v3.Schema$Event
    });

    const createdEvent = response.data as CalendarEvent;
    this.emit('event-created', createdEvent);
    return createdEvent;
  }

  async getEvents(
    calendarId: string = 'primary',
    timeMin?: string,
    timeMax?: string,
    maxResults: number = 250
  ): Promise<CalendarEvent[]> {
    const response = await this.calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      maxResults,
      singleEvents: true,
      orderBy: 'startTime'
    });

    return response.data.items as CalendarEvent[];
  }

  // RevOps Specific Operations
  async setupRevOpsClientStructure(clientName: string): Promise<RevOpsClientStructure> {
    // Create folder structure
    const folderStructure = await this.createFolderStructure(clientName);

    // Create strategy document
    const strategyDoc = await this.createDocument(
      `${clientName} - Revenue Operations Strategy`,
      folderStructure.strategy.id
    );

    // Create process documentation
    const processDoc = await this.createDocument(
      `${clientName} - Process Documentation`,
      folderStructure.implementation.id
    );

    // Create status report
    const statusReport = await this.createDocument(
      `${clientName} - Weekly Status Report`,
      folderStructure.reports.id
    );

    // Create dashboard spreadsheet
    const dashboard = await this.createSpreadsheet(
      `${clientName} - RevOps Dashboard`,
      folderStructure.reports.id
    );

    // Create financial model
    const financialModel = await this.createSpreadsheet(
      `${clientName} - Financial Model`,
      folderStructure.analysis.id
    );

    // Create pipeline tracking
    const pipeline = await this.createSpreadsheet(
      `${clientName} - Pipeline Tracking`,
      folderStructure.analysis.id
    );

    // Create QBR presentation
    const qbrDeck = await this.createPresentation(
      `${clientName} - Quarterly Business Review`,
      folderStructure.reports.id
    );

    // Create strategy presentation
    const strategyPresentation = await this.createPresentation(
      `${clientName} - Revenue Strategy Presentation`,
      folderStructure.strategy.id
    );

    const clientStructure: RevOpsClientStructure = {
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

    // Setup dashboard with initial data
    await this.setupRevOpsDashboard(dashboard.spreadsheetId!, clientName);

    // Populate strategy document template
    await this.populateStrategyDocument(strategyDoc.documentId!, clientName);

    this.emit('revops-client-structure-created', clientStructure);
    return clientStructure;
  }

  private async setupRevOpsDashboard(spreadsheetId: string, clientName: string): Promise<void> {
    // Add sheets for different metrics
    await this.addSheet(spreadsheetId, 'Pipeline Metrics');
    await this.addSheet(spreadsheetId, 'Revenue Tracking');
    await this.addSheet(spreadsheetId, 'Process KPIs');
    await this.addSheet(spreadsheetId, 'Client Health');

    // Populate header data
    const headers = [
      ['Metric', 'Current Value', 'Target', 'Status', 'Last Updated'],
      ['Pipeline Value', '$0', '$0', 'In Progress', new Date().toDateString()],
      ['Conversion Rate', '0%', '0%', 'Monitoring', new Date().toDateString()],
      ['Revenue Growth', '0%', '0%', 'Planning', new Date().toDateString()],
      ['Process Efficiency', '0%', '0%', 'Baseline', new Date().toDateString()]
    ];

    await this.updateSpreadsheetValues(spreadsheetId, 'Sheet1!A1:E5', headers);
  }

  private async populateStrategyDocument(documentId: string, clientName: string): Promise<void> {
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

  // Utility Methods
  async exportClientData(clientStructure: RevOpsClientStructure): Promise<any> {
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

  async shareClientWorkspace(clientStructure: RevOpsClientStructure, clientEmails: string[]): Promise<void> {
    // Share root folder and all subfolders
    const foldersToShare = [
      clientStructure.rootFolder,
      ...Object.values(clientStructure.folders)
    ];

    for (const folder of foldersToShare) {
      for (const email of clientEmails) {
        await this.shareFile(folder.id, email, 'reader');
      }
    }

    // Share key documents
    const documentsToShare = [
      clientStructure.documents.strategyDoc.documentId,
      clientStructure.documents.statusReport.documentId,
      clientStructure.spreadsheets.dashboard.spreadsheetId,
      clientStructure.presentations.qbrDeck.presentationId
    ];

    for (const docId of documentsToShare) {
      for (const email of clientEmails) {
        await this.shareFile(docId!, email, 'commenter');
      }
    }

    this.emit('client-workspace-shared', { clientStructure, clientEmails });
  }
}

export default GoogleWorkspaceIntegration;