import { EventEmitter } from 'events';
export interface SalesforceConfig {
    instanceUrl: string;
    clientId: string;
    clientSecret: string;
    username?: string;
    password?: string;
    securityToken?: string;
    accessToken?: string;
    refreshToken?: string;
    version?: string;
}
export interface SalesforceAuthResponse {
    access_token: string;
    refresh_token?: string;
    instance_url: string;
    id: string;
    token_type: string;
    issued_at: string;
    signature: string;
}
export interface SalesforceAccount {
    Id: string;
    Name: string;
    Type?: string;
    Industry?: string;
    AnnualRevenue?: number;
    NumberOfEmployees?: number;
    BillingStreet?: string;
    BillingCity?: string;
    BillingState?: string;
    BillingPostalCode?: string;
    BillingCountry?: string;
    Phone?: string;
    Website?: string;
    Description?: string;
    OwnerId: string;
    CreatedDate: string;
    LastModifiedDate: string;
    custom_fields?: Record<string, any>;
}
export interface SalesforceContact {
    Id: string;
    AccountId: string;
    FirstName?: string;
    LastName: string;
    Email?: string;
    Phone?: string;
    Title?: string;
    Department?: string;
    MailingStreet?: string;
    MailingCity?: string;
    MailingState?: string;
    MailingPostalCode?: string;
    MailingCountry?: string;
    OwnerId: string;
    CreatedDate: string;
    LastModifiedDate: string;
    custom_fields?: Record<string, any>;
}
export interface SalesforceOpportunity {
    Id: string;
    AccountId: string;
    Name: string;
    StageName: string;
    Amount?: number;
    Probability?: number;
    CloseDate: string;
    Type?: string;
    LeadSource?: string;
    Description?: string;
    NextStep?: string;
    ForecastCategoryName?: string;
    OwnerId: string;
    CreatedDate: string;
    LastModifiedDate: string;
    custom_fields?: Record<string, any>;
}
export interface SalesforceLead {
    Id: string;
    FirstName?: string;
    LastName: string;
    Company: string;
    Title?: string;
    Email?: string;
    Phone?: string;
    Status: string;
    Rating?: string;
    LeadSource?: string;
    Industry?: string;
    AnnualRevenue?: number;
    NumberOfEmployees?: number;
    Street?: string;
    City?: string;
    State?: string;
    PostalCode?: string;
    Country?: string;
    Description?: string;
    OwnerId: string;
    CreatedDate: string;
    LastModifiedDate: string;
    custom_fields?: Record<string, any>;
}
export interface SalesforceCase {
    Id: string;
    AccountId?: string;
    ContactId?: string;
    Subject: string;
    Description?: string;
    Status: string;
    Priority: string;
    Origin: string;
    Type?: string;
    Reason?: string;
    OwnerId: string;
    CreatedDate: string;
    LastModifiedDate: string;
    ClosedDate?: string;
    custom_fields?: Record<string, any>;
}
export interface SalesforceTask {
    Id: string;
    WhoId?: string;
    WhatId?: string;
    Subject: string;
    Description?: string;
    Status: string;
    Priority: string;
    ActivityDate?: string;
    Type?: string;
    OwnerId: string;
    CreatedDate: string;
    LastModifiedDate: string;
    custom_fields?: Record<string, any>;
}
export interface SalesforceUser {
    Id: string;
    Username: string;
    FirstName?: string;
    LastName: string;
    Email: string;
    Title?: string;
    Department?: string;
    Phone?: string;
    IsActive: boolean;
    UserRoleId?: string;
    ProfileId: string;
    CreatedDate: string;
    LastModifiedDate: string;
}
export interface SalesforceQueryResult<T> {
    totalSize: number;
    done: boolean;
    nextRecordsUrl?: string;
    records: T[];
}
export interface SalesforceRevOpsData {
    accounts: SalesforceAccount[];
    contacts: SalesforceContact[];
    opportunities: SalesforceOpportunity[];
    leads: SalesforceLead[];
    cases: SalesforceCase[];
    tasks: SalesforceTask[];
    users: SalesforceUser[];
    metrics: {
        totalRevenue: number;
        pipelineValue: number;
        winRate: number;
        averageDealSize: number;
        salesCycleLength: number;
        leadConversionRate: number;
    };
}
export declare class SalesforceIntegration extends EventEmitter {
    private client;
    private config;
    private accessToken?;
    private instanceUrl?;
    constructor(config: SalesforceConfig);
    private setupResponseInterceptors;
    authenticate(): Promise<SalesforceAuthResponse>;
    refreshAccessToken(): Promise<SalesforceAuthResponse>;
    testConnection(): Promise<boolean>;
    query<T = any>(soql: string): Promise<SalesforceQueryResult<T>>;
    queryAll<T = any>(soql: string): Promise<T[]>;
    getAccounts(limit?: number): Promise<SalesforceAccount[]>;
    getAccount(accountId: string): Promise<SalesforceAccount>;
    createAccount(accountData: Partial<SalesforceAccount>): Promise<{
        id: string;
        success: boolean;
    }>;
    updateAccount(accountId: string, accountData: Partial<SalesforceAccount>): Promise<void>;
    getContacts(accountId?: string, limit?: number): Promise<SalesforceContact[]>;
    createContact(contactData: Partial<SalesforceContact>): Promise<{
        id: string;
        success: boolean;
    }>;
    getOpportunities(accountId?: string, limit?: number): Promise<SalesforceOpportunity[]>;
    createOpportunity(opportunityData: Partial<SalesforceOpportunity>): Promise<{
        id: string;
        success: boolean;
    }>;
    updateOpportunity(opportunityId: string, opportunityData: Partial<SalesforceOpportunity>): Promise<void>;
    getLeads(limit?: number): Promise<SalesforceLead[]>;
    createLead(leadData: Partial<SalesforceLead>): Promise<{
        id: string;
        success: boolean;
    }>;
    convertLead(leadId: string, options: {
        accountId?: string;
        contactId?: string;
        opportunityName?: string;
        convertedStatus: string;
    }): Promise<any>;
    getCases(accountId?: string, limit?: number): Promise<SalesforceCase[]>;
    createCase(caseData: Partial<SalesforceCase>): Promise<{
        id: string;
        success: boolean;
    }>;
    getTasks(whatId?: string, limit?: number): Promise<SalesforceTask[]>;
    createTask(taskData: Partial<SalesforceTask>): Promise<{
        id: string;
        success: boolean;
    }>;
    getUsers(): Promise<SalesforceUser[]>;
    getRevOpsMetrics(): Promise<SalesforceRevOpsData['metrics']>;
    getAccountHealth(accountId: string): Promise<{
        accountId: string;
        openOpportunities: number;
        totalRevenue: number;
        openCases: number;
        lastActivity: string;
        healthScore: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical';
    }>;
    getCompleteRevOpsData(accountId?: string): Promise<SalesforceRevOpsData>;
    createRevOpsReport(accountId?: string): Promise<any>;
    bulkCreateRecords(objectType: string, records: any[]): Promise<any[]>;
    describeObject(objectType: string): Promise<any>;
    getObjectMetadata(objectType: string): Promise<any>;
    executeApex(apexCode: string): Promise<any>;
    exportToCSV(objectType: string, fields: string[], filter?: string): Promise<string>;
}
export default SalesforceIntegration;
//# sourceMappingURL=salesforce-integration.d.ts.map