import { EventEmitter } from 'events';
export interface NotionConfig {
    apiKey: string;
    version?: string;
    baseUrl?: string;
}
export interface NotionPage {
    id: string;
    object: 'page';
    created_time: string;
    created_by: NotionUser;
    last_edited_time: string;
    last_edited_by: NotionUser;
    archived: boolean;
    icon?: NotionIcon;
    cover?: NotionCover;
    properties: Record<string, NotionProperty>;
    parent: NotionParent;
    url: string;
    public_url?: string;
}
export interface NotionDatabase {
    id: string;
    object: 'database';
    created_time: string;
    created_by: NotionUser;
    last_edited_time: string;
    last_edited_by: NotionUser;
    title: NotionRichText[];
    description: NotionRichText[];
    icon?: NotionIcon;
    cover?: NotionCover;
    properties: Record<string, NotionPropertyDefinition>;
    parent: NotionParent;
    url: string;
    archived: boolean;
    is_inline: boolean;
    public_url?: string;
}
export interface NotionUser {
    id: string;
    object: 'user';
    type: 'person' | 'bot';
    name?: string;
    avatar_url?: string;
    person?: {
        email: string;
    };
    bot?: {
        owner: any;
        workspace_name?: string;
    };
}
export interface NotionIcon {
    type: 'emoji' | 'external' | 'file';
    emoji?: string;
    external?: {
        url: string;
    };
    file?: {
        url: string;
        expiry_time: string;
    };
}
export interface NotionCover {
    type: 'external' | 'file';
    external?: {
        url: string;
    };
    file?: {
        url: string;
        expiry_time: string;
    };
}
export interface NotionParent {
    type: 'database_id' | 'page_id' | 'workspace';
    database_id?: string;
    page_id?: string;
    workspace?: boolean;
}
export interface NotionRichText {
    type: 'text' | 'mention' | 'equation';
    text?: {
        content: string;
        link?: {
            url: string;
        };
    };
    mention?: any;
    equation?: {
        expression: string;
    };
    annotations: {
        bold: boolean;
        italic: boolean;
        strikethrough: boolean;
        underline: boolean;
        code: boolean;
        color: string;
    };
    plain_text: string;
    href?: string;
}
export interface NotionProperty {
    id: string;
    type: string;
    [key: string]: any;
}
export interface NotionPropertyDefinition {
    id: string;
    name: string;
    type: 'title' | 'rich_text' | 'number' | 'select' | 'multi_select' | 'date' | 'people' | 'files' | 'checkbox' | 'url' | 'email' | 'phone_number' | 'formula' | 'relation' | 'rollup' | 'created_time' | 'created_by' | 'last_edited_time' | 'last_edited_by';
    [key: string]: any;
}
export interface NotionBlock {
    id: string;
    object: 'block';
    type: string;
    created_time: string;
    created_by: NotionUser;
    last_edited_time: string;
    last_edited_by: NotionUser;
    archived: boolean;
    has_children: boolean;
    parent: NotionParent;
    [key: string]: any;
}
export interface NotionRevOpsStructure {
    clientName: string;
    databases: {
        clients: NotionDatabase;
        projects: NotionDatabase;
        tasks: NotionDatabase;
        meetings: NotionDatabase;
        documents: NotionDatabase;
        metrics: NotionDatabase;
    };
    pages: {
        commandCenter: NotionPage;
        knowledgeBase: NotionPage;
        analytics: NotionPage;
        clientOverview: NotionPage;
    };
}
export interface NotionFilter {
    property: string;
    [key: string]: any;
}
export interface NotionSort {
    property: string;
    direction: 'ascending' | 'descending';
}
export declare class NotionIntegration extends EventEmitter {
    private client;
    private config;
    constructor(config: NotionConfig);
    private setupResponseInterceptors;
    testConnection(): Promise<boolean>;
    getCurrentUser(): Promise<NotionUser>;
    listUsers(): Promise<NotionUser[]>;
    createDatabase(parentPageId: string, title: string, properties: Record<string, NotionPropertyDefinition>): Promise<NotionDatabase>;
    getDatabase(databaseId: string): Promise<NotionDatabase>;
    updateDatabase(databaseId: string, updates: {
        title?: NotionRichText[];
        description?: NotionRichText[];
        properties?: Record<string, NotionPropertyDefinition>;
    }): Promise<NotionDatabase>;
    queryDatabase(databaseId: string, filter?: any, sorts?: NotionSort[], startCursor?: string, pageSize?: number): Promise<{
        results: NotionPage[];
        next_cursor?: string;
        has_more: boolean;
    }>;
    createPage(parent: NotionParent, properties: Record<string, any>, children?: NotionBlock[], icon?: NotionIcon, cover?: NotionCover): Promise<NotionPage>;
    getPage(pageId: string): Promise<NotionPage>;
    updatePage(pageId: string, updates: {
        properties?: Record<string, any>;
        icon?: NotionIcon;
        cover?: NotionCover;
        archived?: boolean;
    }): Promise<NotionPage>;
    deletePage(pageId: string): Promise<NotionPage>;
    getBlockChildren(blockId: string, startCursor?: string, pageSize?: number): Promise<{
        results: NotionBlock[];
        next_cursor?: string;
        has_more: boolean;
    }>;
    appendBlockChildren(blockId: string, children: NotionBlock[]): Promise<{
        results: NotionBlock[];
    }>;
    updateBlock(blockId: string, updates: any): Promise<NotionBlock>;
    deleteBlock(blockId: string): Promise<NotionBlock>;
    setupRevOpsWorkspace(clientName: string): Promise<NotionRevOpsStructure>;
    private createRevOpsDatabases;
    private setupCommandCenterContent;
    private setupKnowledgeBaseContent;
    private setupAnalyticsDashboard;
    private setupClientOverview;
    createClientRecord(databaseId: string, clientData: {
        name: string;
        industry?: string;
        status?: string;
        contractValue?: number;
        startDate?: string;
        endDate?: string;
        accountManager?: string;
        healthScore?: string;
        notes?: string;
    }): Promise<NotionPage>;
    syncWithAsana(asanaProjectData: any, projectsDatabaseId: string): Promise<NotionPage>;
    syncWithGoogleDrive(driveFileData: any, documentsDatabaseId: string): Promise<NotionPage>;
    generateClientReport(clientName: string, structure: NotionRevOpsStructure): Promise<any>;
    exportWorkspace(structure: NotionRevOpsStructure): Promise<any>;
}
export default NotionIntegration;
//# sourceMappingURL=notion-integration.d.ts.map