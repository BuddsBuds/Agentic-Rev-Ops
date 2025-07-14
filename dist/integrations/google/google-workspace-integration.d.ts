import { EventEmitter } from 'events';
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
    start: {
        dateTime?: string;
        date?: string;
        timeZone?: string;
    };
    end: {
        dateTime?: string;
        date?: string;
        timeZone?: string;
    };
    attendees?: {
        email: string;
        responseStatus?: string;
        displayName?: string;
    }[];
    location?: string;
    conferenceData?: any;
    reminders?: any;
    recurrence?: string[];
    status?: string;
    organizer?: {
        email: string;
        displayName?: string;
    };
    creator?: {
        email: string;
        displayName?: string;
    };
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
export declare class GoogleWorkspaceIntegration extends EventEmitter {
    private auth;
    private drive;
    private docs;
    private sheets;
    private slides;
    private gmail;
    private calendar;
    private config;
    constructor(config: GoogleWorkspaceConfig);
    private setupTokenRefresh;
    getAuthUrl(): string;
    exchangeCodeForTokens(code: string): Promise<any>;
    testConnection(): Promise<boolean>;
    createFolder(name: string, parentId?: string): Promise<DriveFolder>;
    uploadFile(name: string, content: Buffer | string, mimeType: string, parentId?: string): Promise<DriveFile>;
    getFile(fileId: string): Promise<DriveFile>;
    listFiles(parentId?: string, mimeType?: string): Promise<DriveFile[]>;
    shareFile(fileId: string, emailAddress: string, role?: 'reader' | 'writer' | 'commenter'): Promise<DrivePermission>;
    createFolderStructure(clientName: string): Promise<RevOpsClientStructure['folders'] & {
        rootFolder: DriveFolder;
    }>;
    createDocument(title: string, parentFolderId?: string): Promise<GoogleDocument>;
    updateDocument(documentId: string, requests: any[]): Promise<GoogleDocument>;
    getDocument(documentId: string): Promise<GoogleDocument>;
    insertTextInDocument(documentId: string, text: string, index?: number): Promise<void>;
    createSpreadsheet(title: string, parentFolderId?: string): Promise<GoogleSpreadsheet>;
    getSpreadsheet(spreadsheetId: string): Promise<GoogleSpreadsheet>;
    updateSpreadsheetValues(spreadsheetId: string, range: string, values: any[][], valueInputOption?: 'RAW' | 'USER_ENTERED'): Promise<void>;
    getSpreadsheetValues(spreadsheetId: string, range: string): Promise<any[][]>;
    addSheet(spreadsheetId: string, title: string): Promise<GoogleSheet>;
    createPresentation(title: string, parentFolderId?: string): Promise<GooglePresentation>;
    getPresentation(presentationId: string): Promise<GooglePresentation>;
    addSlide(presentationId: string, slideId?: string): Promise<GoogleSlide>;
    sendEmail(to: string[], subject: string, body: string, attachments?: DriveFile[]): Promise<GmailMessage>;
    getEmails(query?: string, maxResults?: number): Promise<GmailMessage[]>;
    createEvent(event: Partial<CalendarEvent>, calendarId?: string): Promise<CalendarEvent>;
    getEvents(calendarId?: string, timeMin?: string, timeMax?: string, maxResults?: number): Promise<CalendarEvent[]>;
    setupRevOpsClientStructure(clientName: string): Promise<RevOpsClientStructure>;
    private setupRevOpsDashboard;
    private populateStrategyDocument;
    exportClientData(clientStructure: RevOpsClientStructure): Promise<any>;
    shareClientWorkspace(clientStructure: RevOpsClientStructure, clientEmails: string[]): Promise<void>;
}
export default GoogleWorkspaceIntegration;
//# sourceMappingURL=google-workspace-integration.d.ts.map