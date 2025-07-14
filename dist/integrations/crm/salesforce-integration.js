"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesforceIntegration = void 0;
const events_1 = require("events");
const axios_1 = __importDefault(require("axios"));
class SalesforceIntegration extends events_1.EventEmitter {
    client;
    config;
    accessToken;
    instanceUrl;
    constructor(config) {
        super();
        this.config = {
            version: 'v59.0',
            ...config
        };
        this.instanceUrl = this.config.instanceUrl;
        this.accessToken = this.config.accessToken;
        this.client = axios_1.default.create({
            timeout: 30000
        });
        this.setupResponseInterceptors();
    }
    setupResponseInterceptors() {
        this.client.interceptors.request.use((config) => {
            if (this.accessToken && this.instanceUrl) {
                config.baseURL = `${this.instanceUrl}/services/data/${this.config.version}`;
                config.headers = {
                    ...config.headers,
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                };
            }
            return config;
        });
        this.client.interceptors.response.use((response) => response, async (error) => {
            if (error.response?.status === 401 && this.config.refreshToken) {
                try {
                    await this.refreshAccessToken();
                    return this.client.request(error.config);
                }
                catch (refreshError) {
                    this.emit('auth-error', refreshError);
                    return Promise.reject(refreshError);
                }
            }
            return Promise.reject(error);
        });
    }
    async authenticate() {
        const authUrl = `${this.config.instanceUrl}/services/oauth2/token`;
        const params = new URLSearchParams({
            grant_type: 'password',
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            username: this.config.username,
            password: `${this.config.password}${this.config.securityToken || ''}`
        });
        const response = await axios_1.default.post(authUrl, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const authData = response.data;
        this.accessToken = authData.access_token;
        this.instanceUrl = authData.instance_url;
        this.config.accessToken = authData.access_token;
        this.config.refreshToken = authData.refresh_token;
        this.emit('authenticated', authData);
        return authData;
    }
    async refreshAccessToken() {
        if (!this.config.refreshToken) {
            throw new Error('No refresh token available');
        }
        const authUrl = `${this.config.instanceUrl}/services/oauth2/token`;
        const params = new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            refresh_token: this.config.refreshToken
        });
        const response = await axios_1.default.post(authUrl, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const authData = response.data;
        this.accessToken = authData.access_token;
        this.instanceUrl = authData.instance_url;
        this.config.accessToken = authData.access_token;
        this.emit('token-refreshed', authData);
        return authData;
    }
    async testConnection() {
        try {
            if (!this.accessToken) {
                await this.authenticate();
            }
            const response = await this.client.get('/sobjects');
            return response.status === 200;
        }
        catch (error) {
            this.emit('connection-error', error);
            return false;
        }
    }
    async query(soql) {
        const response = await this.client.get('/query', {
            params: { q: soql }
        });
        return response.data;
    }
    async queryAll(soql) {
        let allRecords = [];
        let result = await this.query(soql);
        allRecords = allRecords.concat(result.records);
        while (!result.done && result.nextRecordsUrl) {
            const response = await this.client.get(result.nextRecordsUrl.replace(/.*\/services\/data\/v[0-9.]+/, ''));
            result = response.data;
            allRecords = allRecords.concat(result.records);
        }
        return allRecords;
    }
    async getAccounts(limit = 200) {
        const soql = `
      SELECT Id, Name, Type, Industry, AnnualRevenue, NumberOfEmployees, 
             BillingStreet, BillingCity, BillingState, BillingPostalCode, BillingCountry,
             Phone, Website, Description, OwnerId, CreatedDate, LastModifiedDate
      FROM Account 
      WHERE IsDeleted = false 
      ORDER BY LastModifiedDate DESC 
      LIMIT ${limit}
    `;
        const result = await this.query(soql);
        return result.records;
    }
    async getAccount(accountId) {
        const soql = `
      SELECT Id, Name, Type, Industry, AnnualRevenue, NumberOfEmployees, 
             BillingStreet, BillingCity, BillingState, BillingPostalCode, BillingCountry,
             Phone, Website, Description, OwnerId, CreatedDate, LastModifiedDate
      FROM Account 
      WHERE Id = '${accountId}'
    `;
        const result = await this.query(soql);
        if (result.records.length === 0) {
            throw new Error(`Account ${accountId} not found`);
        }
        return result.records[0];
    }
    async createAccount(accountData) {
        const response = await this.client.post('/sobjects/Account', accountData);
        const result = response.data;
        this.emit('account-created', { id: result.id, data: accountData });
        return result;
    }
    async updateAccount(accountId, accountData) {
        await this.client.patch(`/sobjects/Account/${accountId}`, accountData);
        this.emit('account-updated', { id: accountId, data: accountData });
    }
    async getContacts(accountId, limit = 200) {
        let soql = `
      SELECT Id, AccountId, FirstName, LastName, Email, Phone, Title, Department,
             MailingStreet, MailingCity, MailingState, MailingPostalCode, MailingCountry,
             OwnerId, CreatedDate, LastModifiedDate
      FROM Contact 
      WHERE IsDeleted = false
    `;
        if (accountId) {
            soql += ` AND AccountId = '${accountId}'`;
        }
        soql += ` ORDER BY LastModifiedDate DESC LIMIT ${limit}`;
        const result = await this.query(soql);
        return result.records;
    }
    async createContact(contactData) {
        const response = await this.client.post('/sobjects/Contact', contactData);
        const result = response.data;
        this.emit('contact-created', { id: result.id, data: contactData });
        return result;
    }
    async getOpportunities(accountId, limit = 200) {
        let soql = `
      SELECT Id, AccountId, Name, StageName, Amount, Probability, CloseDate,
             Type, LeadSource, Description, NextStep, ForecastCategoryName,
             OwnerId, CreatedDate, LastModifiedDate
      FROM Opportunity 
      WHERE IsDeleted = false
    `;
        if (accountId) {
            soql += ` AND AccountId = '${accountId}'`;
        }
        soql += ` ORDER BY CloseDate DESC LIMIT ${limit}`;
        const result = await this.query(soql);
        return result.records;
    }
    async createOpportunity(opportunityData) {
        const response = await this.client.post('/sobjects/Opportunity', opportunityData);
        const result = response.data;
        this.emit('opportunity-created', { id: result.id, data: opportunityData });
        return result;
    }
    async updateOpportunity(opportunityId, opportunityData) {
        await this.client.patch(`/sobjects/Opportunity/${opportunityId}`, opportunityData);
        this.emit('opportunity-updated', { id: opportunityId, data: opportunityData });
    }
    async getLeads(limit = 200) {
        const soql = `
      SELECT Id, FirstName, LastName, Company, Title, Email, Phone, Status, Rating,
             LeadSource, Industry, AnnualRevenue, NumberOfEmployees,
             Street, City, State, PostalCode, Country, Description,
             OwnerId, CreatedDate, LastModifiedDate
      FROM Lead 
      WHERE IsDeleted = false 
      ORDER BY LastModifiedDate DESC 
      LIMIT ${limit}
    `;
        const result = await this.query(soql);
        return result.records;
    }
    async createLead(leadData) {
        const response = await this.client.post('/sobjects/Lead', leadData);
        const result = response.data;
        this.emit('lead-created', { id: result.id, data: leadData });
        return result;
    }
    async convertLead(leadId, options) {
        const response = await this.client.post('/sobjects/LeadConvert', {
            leadId,
            ...options
        });
        const result = response.data;
        this.emit('lead-converted', { leadId, result });
        return result;
    }
    async getCases(accountId, limit = 200) {
        let soql = `
      SELECT Id, AccountId, ContactId, Subject, Description, Status, Priority,
             Origin, Type, Reason, OwnerId, CreatedDate, LastModifiedDate, ClosedDate
      FROM Case 
      WHERE IsDeleted = false
    `;
        if (accountId) {
            soql += ` AND AccountId = '${accountId}'`;
        }
        soql += ` ORDER BY LastModifiedDate DESC LIMIT ${limit}`;
        const result = await this.query(soql);
        return result.records;
    }
    async createCase(caseData) {
        const response = await this.client.post('/sobjects/Case', caseData);
        const result = response.data;
        this.emit('case-created', { id: result.id, data: caseData });
        return result;
    }
    async getTasks(whatId, limit = 200) {
        let soql = `
      SELECT Id, WhoId, WhatId, Subject, Description, Status, Priority,
             ActivityDate, Type, OwnerId, CreatedDate, LastModifiedDate
      FROM Task 
      WHERE IsDeleted = false
    `;
        if (whatId) {
            soql += ` AND WhatId = '${whatId}'`;
        }
        soql += ` ORDER BY LastModifiedDate DESC LIMIT ${limit}`;
        const result = await this.query(soql);
        return result.records;
    }
    async createTask(taskData) {
        const response = await this.client.post('/sobjects/Task', taskData);
        const result = response.data;
        this.emit('task-created', { id: result.id, data: taskData });
        return result;
    }
    async getUsers() {
        const soql = `
      SELECT Id, Username, FirstName, LastName, Email, Title, Department,
             Phone, IsActive, UserRoleId, ProfileId, CreatedDate, LastModifiedDate
      FROM User 
      WHERE IsActive = true 
      ORDER BY LastName
    `;
        const result = await this.query(soql);
        return result.records;
    }
    async getRevOpsMetrics() {
        const revenueQuery = `
      SELECT SUM(Amount) totalRevenue 
      FROM Opportunity 
      WHERE StageName = 'Closed Won' 
      AND CloseDate = THIS_YEAR
    `;
        const pipelineQuery = `
      SELECT SUM(Amount) pipelineValue 
      FROM Opportunity 
      WHERE IsClosed = false
    `;
        const winRateQuery = `
      SELECT COUNT(Id) totalOpps, 
             COUNT(CASE WHEN StageName = 'Closed Won' THEN 1 END) wonOpps
      FROM Opportunity 
      WHERE CloseDate = THIS_YEAR
    `;
        const avgDealQuery = `
      SELECT AVG(Amount) avgDealSize 
      FROM Opportunity 
      WHERE StageName = 'Closed Won' 
      AND CloseDate = THIS_YEAR
    `;
        const leadConversionQuery = `
      SELECT COUNT(Id) totalLeads,
             COUNT(CASE WHEN IsConverted = true THEN 1 END) convertedLeads
      FROM Lead 
      WHERE CreatedDate = THIS_YEAR
    `;
        const [revenueResult, pipelineResult, winRateResult, avgDealResult, leadConversionResult] = await Promise.all([
            this.query(revenueQuery),
            this.query(pipelineQuery),
            this.query(winRateQuery),
            this.query(avgDealQuery),
            this.query(leadConversionQuery)
        ]);
        const totalRevenue = revenueResult.records[0]?.totalRevenue || 0;
        const pipelineValue = pipelineResult.records[0]?.pipelineValue || 0;
        const winRateData = winRateResult.records[0];
        const winRate = winRateData?.totalOpps ? (winRateData.wonOpps / winRateData.totalOpps) * 100 : 0;
        const averageDealSize = avgDealResult.records[0]?.avgDealSize || 0;
        const leadData = leadConversionResult.records[0];
        const leadConversionRate = leadData?.totalLeads ? (leadData.convertedLeads / leadData.totalLeads) * 100 : 0;
        const salesCycleQuery = `
      SELECT AVG(DATEDIFF(CreatedDate, CloseDate)) avgCycle
      FROM Opportunity 
      WHERE StageName = 'Closed Won' 
      AND CloseDate = THIS_YEAR
    `;
        const salesCycleResult = await this.query(salesCycleQuery);
        const salesCycleLength = Math.abs(salesCycleResult.records[0]?.avgCycle || 0);
        return {
            totalRevenue,
            pipelineValue,
            winRate,
            averageDealSize,
            salesCycleLength,
            leadConversionRate
        };
    }
    async getAccountHealth(accountId) {
        const [opportunities, cases, tasks] = await Promise.all([
            this.getOpportunities(accountId),
            this.getCases(accountId),
            this.getTasks(accountId)
        ]);
        const openOpportunities = opportunities.filter(opp => !opp.StageName?.includes('Closed')).length;
        const totalRevenue = opportunities
            .filter(opp => opp.StageName === 'Closed Won')
            .reduce((sum, opp) => sum + (opp.Amount || 0), 0);
        const openCases = cases.filter(c => c.Status !== 'Closed').length;
        const lastActivity = tasks.length > 0
            ? tasks.sort((a, b) => new Date(b.CreatedDate).getTime() - new Date(a.CreatedDate).getTime())[0].CreatedDate
            : new Date().toISOString();
        let healthScore = 'Good';
        if (openCases > 5)
            healthScore = 'Critical';
        else if (openCases > 2)
            healthScore = 'Poor';
        else if (openOpportunities === 0 && totalRevenue === 0)
            healthScore = 'Fair';
        else if (openOpportunities > 2 && totalRevenue > 100000)
            healthScore = 'Excellent';
        return {
            accountId,
            openOpportunities,
            totalRevenue,
            openCases,
            lastActivity,
            healthScore
        };
    }
    async getCompleteRevOpsData(accountId) {
        const [accounts, opportunities, leads, cases, tasks, users, metrics] = await Promise.all([
            accountId ? [await this.getAccount(accountId)] : this.getAccounts(),
            this.getOpportunities(accountId),
            accountId ? [] : this.getLeads(),
            this.getCases(accountId),
            this.getTasks(accountId),
            this.getUsers(),
            this.getRevOpsMetrics()
        ]);
        const contacts = await this.getContacts(accountId);
        const revOpsData = {
            accounts,
            contacts,
            opportunities,
            leads,
            cases,
            tasks,
            users,
            metrics
        };
        this.emit('revops-data-compiled', { accountId, data: revOpsData });
        return revOpsData;
    }
    async createRevOpsReport(accountId) {
        const data = await this.getCompleteRevOpsData(accountId);
        const report = {
            generatedAt: new Date().toISOString(),
            accountId,
            summary: {
                totalAccounts: data.accounts.length,
                totalContacts: data.contacts.length,
                totalOpportunities: data.opportunities.length,
                totalLeads: data.leads.length,
                openCases: data.cases.filter(c => c.Status !== 'Closed').length,
                pendingTasks: data.tasks.filter(t => t.Status !== 'Completed').length
            },
            metrics: data.metrics,
            data
        };
        this.emit('revops-report-generated', report);
        return report;
    }
    async bulkCreateRecords(objectType, records) {
        const results = [];
        const chunkSize = 200;
        for (let i = 0; i < records.length; i += chunkSize) {
            const chunk = records.slice(i, i + chunkSize);
            const promises = chunk.map(record => this.client.post(`/sobjects/${objectType}`, record)
                .then(response => ({ success: true, id: response.data.id, record }))
                .catch(error => ({ success: false, error: error.message, record })));
            const chunkResults = await Promise.all(promises);
            results.push(...chunkResults);
        }
        this.emit('bulk-create-completed', { objectType, totalRecords: records.length, results });
        return results;
    }
    async describeObject(objectType) {
        const response = await this.client.get(`/sobjects/${objectType}/describe`);
        return response.data;
    }
    async getObjectMetadata(objectType) {
        const response = await this.client.get(`/sobjects/${objectType}`);
        return response.data;
    }
    async executeApex(apexCode) {
        const response = await this.client.get('/tooling/executeAnonymous', {
            params: { anonymousBody: apexCode }
        });
        return response.data;
    }
    async exportToCSV(objectType, fields, filter) {
        const soql = `SELECT ${fields.join(', ')} FROM ${objectType}${filter ? ` WHERE ${filter}` : ''}`;
        const records = await this.queryAll(soql);
        const headers = fields.join(',');
        const rows = records.map(record => fields.map(field => {
            const value = record[field];
            return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
        }).join(','));
        return [headers, ...rows].join('\n');
    }
}
exports.SalesforceIntegration = SalesforceIntegration;
exports.default = SalesforceIntegration;
//# sourceMappingURL=salesforce-integration.js.map