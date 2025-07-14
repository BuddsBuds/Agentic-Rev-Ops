import { EventEmitter } from 'events';
export interface AsanaConfig {
    accessToken: string;
    baseUrl?: string;
    workspace?: string;
}
export interface AsanaProject {
    gid: string;
    name: string;
    notes?: string;
    color?: string;
    team?: string;
    owner?: string;
    current_status?: string;
    due_date?: string;
    custom_fields?: AsanaCustomField[];
    members?: AsanaUser[];
}
export interface AsanaTask {
    gid: string;
    name: string;
    notes?: string;
    projects: string[];
    assignee?: string;
    due_on?: string;
    due_at?: string;
    completed: boolean;
    dependencies?: string[];
    parent?: string;
    subtasks?: string[];
    tags?: string[];
    custom_fields?: AsanaCustomField[];
    attachments?: AsanaAttachment[];
}
export interface AsanaUser {
    gid: string;
    name: string;
    email: string;
    resource_type: 'user';
    workspaces?: AsanaWorkspace[];
}
export interface AsanaWorkspace {
    gid: string;
    name: string;
    resource_type: 'workspace';
    is_organization: boolean;
}
export interface AsanaCustomField {
    gid: string;
    name: string;
    type: 'text' | 'number' | 'enum' | 'multi_enum' | 'date' | 'people';
    description?: string;
    enum_options?: AsanaEnumOption[];
    enum_value?: AsanaEnumOption;
    multi_enum_values?: AsanaEnumOption[];
    text_value?: string;
    number_value?: number;
    date_value?: string;
    people_value?: AsanaUser[];
}
export interface AsanaEnumOption {
    gid: string;
    name: string;
    color?: string;
    enabled?: boolean;
}
export interface AsanaAttachment {
    gid: string;
    name: string;
    resource_type: 'attachment';
    created_at: string;
    download_url?: string;
    host: 'asana' | 'external' | 'dropbox' | 'google_drive' | 'box' | 'onedrive';
    parent: AsanaTask;
    permanent_url?: string;
    size?: number;
    url_host?: string;
    view_url?: string;
}
export interface AsanaProjectTemplate {
    gid: string;
    name: string;
    description?: string;
    color?: string;
    public?: boolean;
    team?: string;
    requested_dates?: AsanaDateVariable[];
    requested_roles?: AsanaRequestedRole[];
}
export interface AsanaDateVariable {
    gid: string;
    name: string;
    description?: string;
}
export interface AsanaRequestedRole {
    role: string;
    user?: AsanaUser;
}
export interface AsanaWebhook {
    gid: string;
    resource: AsanaResource;
    target: string;
    active: boolean;
    filters?: AsanaWebhookFilter[];
}
export interface AsanaResource {
    gid: string;
    resource_type: 'task' | 'project' | 'team' | 'workspace';
    name?: string;
}
export interface AsanaWebhookFilter {
    resource_type: string;
    resource_subtype?: string;
    action?: 'added' | 'removed' | 'changed' | 'deleted';
    fields?: string[];
}
export interface AsanaPortfolio {
    gid: string;
    name: string;
    color?: string;
    members?: AsanaUser[];
    projects?: AsanaProject[];
    created_at: string;
    created_by: AsanaUser;
    custom_field_settings?: AsanaCustomFieldSetting[];
    owner?: AsanaUser;
    public?: boolean;
    workspace: AsanaWorkspace;
}
export interface AsanaCustomFieldSetting {
    gid: string;
    custom_field: AsanaCustomField;
    is_important?: boolean;
    parent: AsanaProject | AsanaPortfolio;
    project?: AsanaProject;
}
export interface AsanaRevOpsData {
    projects: AsanaProject[];
    tasks: AsanaTask[];
    portfolios: AsanaPortfolio[];
    team_members: AsanaUser[];
    custom_fields: AsanaCustomField[];
    webhooks: AsanaWebhook[];
}
export declare class AsanaIntegration extends EventEmitter {
    private client;
    private config;
    private rateLimitRemaining;
    private rateLimitResetTime;
    constructor(config: AsanaConfig);
    private setupResponseInterceptors;
    testConnection(): Promise<boolean>;
    getCurrentUser(): Promise<AsanaUser>;
    getWorkspaces(): Promise<AsanaWorkspace[]>;
    createProject(projectData: Partial<AsanaProject>): Promise<AsanaProject>;
    createProjectFromTemplate(templateGid: string, projectData: {
        name: string;
        team?: string;
        public?: boolean;
        requested_dates?: {
            [key: string]: string;
        };
        requested_roles?: {
            [key: string]: string;
        };
    }): Promise<AsanaProject>;
    getProject(projectGid: string): Promise<AsanaProject>;
    updateProject(projectGid: string, updates: Partial<AsanaProject>): Promise<AsanaProject>;
    deleteProject(projectGid: string): Promise<void>;
    getProjectTasks(projectGid: string): Promise<AsanaTask[]>;
    createTask(taskData: Partial<AsanaTask>): Promise<AsanaTask>;
    getTask(taskGid: string): Promise<AsanaTask>;
    updateTask(taskGid: string, updates: Partial<AsanaTask>): Promise<AsanaTask>;
    completeTask(taskGid: string): Promise<AsanaTask>;
    deleteTask(taskGid: string): Promise<void>;
    addTaskDependency(taskGid: string, dependencyGid: string): Promise<void>;
    addTaskComment(taskGid: string, text: string): Promise<any>;
    createPortfolio(portfolioData: {
        name: string;
        color?: string;
        members?: string[];
        public?: boolean;
    }): Promise<AsanaPortfolio>;
    getPortfolio(portfolioGid: string): Promise<AsanaPortfolio>;
    addProjectToPortfolio(portfolioGid: string, projectGid: string): Promise<void>;
    createCustomField(customFieldData: {
        name: string;
        type: 'text' | 'number' | 'enum' | 'multi_enum' | 'date' | 'people';
        description?: string;
        enum_options?: {
            name: string;
            color?: string;
        }[];
    }): Promise<AsanaCustomField>;
    getCustomFields(): Promise<AsanaCustomField[]>;
    setCustomFieldValue(taskGid: string, customFieldGid: string, value: any): Promise<void>;
    createWebhook(webhookData: {
        resource: string;
        target: string;
        filters?: AsanaWebhookFilter[];
    }): Promise<AsanaWebhook>;
    getWebhooks(): Promise<AsanaWebhook[]>;
    deleteWebhook(webhookGid: string): Promise<void>;
    setupRevOpsProject(clientName: string, templateGid?: string): Promise<AsanaRevOpsData>;
    private createRevOpsTasks;
    private setupRevOpsCustomFields;
    private setupRevOpsWebhooks;
    private getProjectMembers;
    searchTasks(query: string, projectGid?: string): Promise<AsanaTask[]>;
    exportProjectData(projectGid: string): Promise<any>;
    getRateLimitStatus(): {
        remaining: number;
        resetTime: Date;
    };
    waitForRateLimit(): Promise<void>;
}
export default AsanaIntegration;
//# sourceMappingURL=asana-integration.d.ts.map