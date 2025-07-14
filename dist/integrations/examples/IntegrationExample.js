"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupIntegrations = setupIntegrations;
exports.exampleBasicIntegration = exampleBasicIntegration;
exports.exampleClientSuite = exampleClientSuite;
exports.exampleEnhancedAsanaOperations = exampleEnhancedAsanaOperations;
exports.exampleGoogleWorkspaceOperations = exampleGoogleWorkspaceOperations;
exports.exampleNotionKnowledgeBase = exampleNotionKnowledgeBase;
exports.exampleCrossPlatformSync = exampleCrossPlatformSync;
exports.exampleIntegrationWorkflow = exampleIntegrationWorkflow;
exports.exampleMonitoringAndMetrics = exampleMonitoringAndMetrics;
const IntegrationHub_1 = require("../IntegrationHub");
const SwarmMemory_1 = require("../../swarm/memory/SwarmMemory");
const HITLSystem_1 = require("../../workflow/hitl/HITLSystem");
const SwarmCoordinator_1 = require("../../swarm/coordinator/SwarmCoordinator");
const connection_1 = require("../../core/database/connection");
async function setupIntegrations() {
    const dbManager = new connection_1.DatabaseConnectionManager({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'revops',
        user: process.env.DB_USER || 'revops_user',
        password: process.env.DB_PASSWORD || 'secure_password',
        ssl: process.env.DB_SSL === 'true'
    });
    await dbManager.initialize();
    const swarmMemory = new SwarmMemory_1.SwarmMemory('integration-example');
    const swarmCoordinator = new SwarmCoordinator_1.SwarmCoordinator(swarmMemory);
    const hitlSystem = new HITLSystem_1.HITLSystem(swarmMemory, swarmCoordinator);
    await hitlSystem.initialize();
    const integrationHub = new IntegrationHub_1.IntegrationHub(swarmMemory, hitlSystem, swarmCoordinator, {
        enableAutoDiscovery: true,
        enableHealthMonitoring: true,
        enableWebhooks: true,
        enableMetrics: true
    });
    console.log('🚀 Initializing Integration Hub...');
    await integrationHub.initialize();
    return { integrationHub, swarmMemory, hitlSystem, dbManager };
}
async function exampleBasicIntegration(integrationHub) {
    console.log('\n📌 Example 1: Basic Integration Setup');
    const asanaIntegration = await integrationHub.addIntegration('asana', {
        id: 'asana-example',
        name: 'Example Asana Integration',
        type: 'api_key',
        baseUrl: 'https://app.asana.com/api/1.0',
        authConfig: {
            type: 'api_key',
            apiKey: {
                key: process.env.ASANA_API_KEY || 'your-api-key',
                placement: 'header',
                headerName: 'Authorization'
            }
        },
        rateLimiting: {
            maxRequests: 1500,
            windowMs: 60000,
            strategy: 'sliding',
            respectRetryAfter: true
        },
        cacheConfig: {
            enabled: true,
            ttlMs: 300000,
            maxSize: 100,
            strategy: 'lru'
        }
    });
    const isConnected = await asanaIntegration.testConnection();
    console.log(`✅ Asana connection status: ${isConnected ? 'Connected' : 'Failed'}`);
    const metrics = asanaIntegration.getMetrics();
    console.log('📊 Integration metrics:', metrics);
    return asanaIntegration;
}
async function exampleClientSuite(integrationHub) {
    console.log('\n📌 Example 2: Complete Client Suite');
    const clientSuite = await integrationHub.createClientSuite('Acme Corporation', {
        integrations: {
            asana: true,
            google: true,
            notion: true
        },
        credentials: {
            asanaApiKey: process.env.ASANA_API_KEY,
            googleClientId: process.env.GOOGLE_CLIENT_ID,
            googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
            googleRedirectUri: 'http://localhost:3000/auth/google/callback',
            notionApiKey: process.env.NOTION_API_KEY
        },
        autoSetup: true
    });
    console.log(`✅ Created suite with ${clientSuite.size} integrations`);
    for (const [type, integration] of clientSuite) {
        console.log(`  - ${type}: ${integration['config'].name}`);
    }
    return clientSuite;
}
async function exampleEnhancedAsanaOperations(integrationHub) {
    console.log('\n📌 Example 3: Enhanced Asana Operations');
    let asanaIntegration = integrationHub.getIntegration('asana-example');
    if (!asanaIntegration) {
        asanaIntegration = await exampleBasicIntegration(integrationHub);
    }
    const asanaEnhanced = asanaIntegration;
    const revOpsProject = await asanaEnhanced.createRevOpsProject('TechStartup Inc', {
        templateId: process.env.ASANA_TEMPLATE_ID,
        customFields: {
            'Revenue Impact': 'High',
            'Implementation Phase': 'Planning',
            'Client Priority': 'Strategic'
        },
        initialTasks: [
            {
                name: 'Initial Discovery Call',
                notes: 'Schedule discovery call with stakeholders',
                assignee: process.env.ASANA_USER_GID
            },
            {
                name: 'Technology Stack Assessment',
                notes: 'Audit current technology stack and integrations'
            },
            {
                name: 'Process Mapping',
                notes: 'Map current revenue processes'
            }
        ]
    });
    console.log('✅ Created RevOps project:', revOpsProject.projects[0].name);
    const approvalTask = await asanaEnhanced.createTaskWithApproval({
        name: 'Budget Approval - Q1 Technology Investment',
        notes: 'Requires executive approval for Q1 technology budget',
        projects: [revOpsProject.projects[0].gid],
        custom_fields: {
            'Revenue Impact': 'High Impact',
            'Budget': 50000
        }
    }, {
        requiresApproval: true,
        approvers: ['executive_team'],
        approvalThreshold: 0.8,
        escalationTime: 48 * 60 * 60 * 1000
    });
    console.log('✅ Created task with approval workflow:', approvalTask.name);
    const updateResults = await asanaEnhanced.bulkUpdateTasks([
        {
            taskGid: approvalTask.gid,
            updates: {
                due_on: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            }
        }
    ]);
    console.log('✅ Bulk update results:', updateResults);
    const analytics = await asanaEnhanced.getProjectAnalytics(revOpsProject.projects[0].gid);
    console.log('📊 Project analytics:', analytics);
    return revOpsProject;
}
async function exampleGoogleWorkspaceOperations(integrationHub) {
    console.log('\n📌 Example 4: Google Workspace Operations');
    const googleIntegration = await integrationHub.addIntegration('google', {
        id: 'google-example',
        name: 'Example Google Workspace',
        type: 'oauth2',
        baseUrl: 'https://www.googleapis.com',
        authConfig: {
            type: 'oauth2',
            oauth2: {
                clientId: process.env.GOOGLE_CLIENT_ID || 'your-client-id',
                clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'your-client-secret',
                authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
                tokenUrl: 'https://oauth2.googleapis.com/token',
                scopes: [
                    'https://www.googleapis.com/auth/drive',
                    'https://www.googleapis.com/auth/documents',
                    'https://www.googleapis.com/auth/spreadsheets'
                ],
                redirectUri: 'http://localhost:3000/auth/google/callback',
                grantType: 'authorization_code',
                accessToken: process.env.GOOGLE_ACCESS_TOKEN,
                refreshToken: process.env.GOOGLE_REFRESH_TOKEN
            }
        }
    });
    const googleEnhanced = googleIntegration;
    const workspace = await googleEnhanced.createRevOpsWorkspace('InnovateTech Solutions', {
        includeTemplates: true,
        shareWithEmails: ['team@example.com'],
        setupCalendar: true,
        createDashboard: true
    });
    console.log('✅ Created Google Workspace:', workspace.rootFolder.name);
    const document = await googleEnhanced.createCollaborativeDocument('Q1 Revenue Strategy', 'This document outlines our Q1 revenue strategy and key initiatives.', {
        folderId: workspace.folders.strategy.id,
        permissions: [
            { email: 'ceo@example.com', role: 'writer' },
            { email: 'cfo@example.com', role: 'writer' },
            { email: 'team@example.com', role: 'commenter' }
        ],
        trackChanges: true,
        requireApproval: true
    });
    console.log('✅ Created collaborative document:', document.document.title);
    const dashboard = await googleEnhanced.createDataDashboard('Revenue Analytics', {
        type: 'asana',
        connectionId: 'asana-example',
        query: { projectGid: 'project-123' }
    }, {
        folderId: workspace.folders.reports.id,
        refreshInterval: 3600000,
        charts: [
            { type: 'line', dataRange: 'A1:B100', title: 'Revenue Trend' },
            { type: 'bar', dataRange: 'C1:D50', title: 'Pipeline by Stage' }
        ]
    });
    console.log('✅ Created data dashboard:', dashboard.title);
    return workspace;
}
async function exampleNotionKnowledgeBase(integrationHub) {
    console.log('\n📌 Example 5: Notion Knowledge Base');
    const notionIntegration = await integrationHub.addIntegration('notion', {
        id: 'notion-example',
        name: 'Example Notion Workspace',
        type: 'api_key',
        baseUrl: 'https://api.notion.com/v1',
        authConfig: {
            type: 'api_key',
            apiKey: {
                key: process.env.NOTION_API_KEY || 'your-api-key',
                placement: 'header',
                headerName: 'Authorization'
            }
        }
    }, {
        enableBidirectionalSync: true,
        syncInterval: 300000,
        aiEnhancements: {
            enabled: true,
            autoSummarize: true,
            autoTag: true,
            sentimentAnalysis: true
        }
    });
    const notionEnhanced = notionIntegration;
    const knowledgeBase = await notionEnhanced.createRevOpsKnowledgeBase('GlobalTech Enterprise', {
        templateStructure: 'enterprise',
        includeAIFeatures: true,
        setupAutomations: true,
        integrations: [
            { type: 'asana', config: { projectGid: 'project-123' } },
            { type: 'google', config: { folderId: 'folder-456' } }
        ]
    });
    console.log('✅ Created Notion knowledge base:', knowledgeBase.clientName);
    const smartPage = await notionEnhanced.createSmartPage(knowledgeBase.databases.projects.id, {
        'Project Name': { title: [{ type: 'text', text: { content: 'AI-Powered Revenue Optimization' } }] },
        'Phase': { select: { name: 'Implementation' } },
        'Priority': { select: { name: 'Critical' } }
    }, {
        autoGenerateContent: true,
        aiSuggestions: true,
        workflows: [
            { type: 'approval', config: { approvers: ['team-lead'] } }
        ]
    });
    console.log('✅ Created smart page with AI features');
    await notionEnhanced.createAutomationRule({
        id: 'critical-escalation',
        name: 'Critical Task Escalation',
        trigger: {
            type: 'property_changed',
            property: 'Priority',
            value: { select: { name: 'Critical' } }
        },
        actions: [
            {
                type: 'send_notification',
                config: {
                    channel: 'email',
                    recipients: ['management@example.com'],
                    template: 'critical_task_alert'
                }
            },
            {
                type: 'trigger_workflow',
                config: {
                    workflowId: 'executive-review'
                }
            }
        ],
        enabled: true
    });
    console.log('✅ Created automation rule for critical tasks');
    return knowledgeBase;
}
async function exampleCrossPlatformSync(integrationHub) {
    console.log('\n📌 Example 6: Cross-Platform Synchronization');
    await integrationHub.syncIntegrations('asana-example', 'notion-example', {
        dataType: 'tasks',
        bidirectional: true,
        transform: (data) => {
            if (data.gid) {
                return {
                    'Task': { title: [{ type: 'text', text: { content: data.name } }] },
                    'Description': { rich_text: [{ type: 'text', text: { content: data.notes || '' } }] },
                    'Status': { select: { name: data.completed ? 'Completed' : 'In Progress' } },
                    'Due Date': data.due_on ? { date: { start: data.due_on } } : undefined
                };
            }
            return {
                name: data.properties.Task.title[0].text.content,
                notes: data.properties.Description?.rich_text[0]?.text.content || '',
                completed: data.properties.Status?.select?.name === 'Completed',
                due_on: data.properties['Due Date']?.date?.start
            };
        }
    });
    console.log('✅ Setup bidirectional sync between Asana and Notion');
    const webhook = await integrationHub.createWebhook('asana-example', {
        endpoint: 'https://your-app.com/webhooks/asana',
        events: ['task.created', 'task.updated', 'task.completed'],
        secret: 'webhook-secret-key'
    });
    console.log('✅ Created webhook for real-time updates:', webhook.id);
}
async function exampleIntegrationWorkflow(integrationHub) {
    console.log('\n📌 Example 7: Complex Integration Workflow');
    const workflow = await integrationHub['factory'].createIntegrationWorkflow('Revenue Operations Workflow', {
        integrations: [
            {
                type: 'asana',
                config: {
                    id: 'workflow-asana',
                    name: 'Workflow Asana',
                    type: 'api_key',
                    baseUrl: 'https://app.asana.com/api/1.0',
                    authConfig: { type: 'api_key', apiKey: { key: 'key', placement: 'header' } }
                },
                role: 'source'
            },
            {
                type: 'google',
                config: {
                    id: 'workflow-google',
                    name: 'Workflow Google',
                    type: 'oauth2',
                    baseUrl: 'https://www.googleapis.com',
                    authConfig: { type: 'oauth2', oauth2: { clientId: 'id', clientSecret: 'secret', authorizationUrl: '', tokenUrl: '', scopes: [], redirectUri: '', grantType: 'authorization_code' } }
                },
                role: 'processor'
            },
            {
                type: 'notion',
                config: {
                    id: 'workflow-notion',
                    name: 'Workflow Notion',
                    type: 'api_key',
                    baseUrl: 'https://api.notion.com/v1',
                    authConfig: { type: 'api_key', apiKey: { key: 'key', placement: 'header' } }
                },
                role: 'destination'
            }
        ],
        dataFlow: [
            {
                from: 'workflow-asana',
                to: 'workflow-google',
                transformations: [
                    { type: 'filter', config: { status: 'active' } },
                    { type: 'enrich', config: { addTimestamp: true } }
                ]
            },
            {
                from: 'workflow-google',
                to: 'workflow-notion',
                transformations: [
                    { type: 'format', config: { outputFormat: 'notion' } }
                ]
            }
        ],
        triggers: [
            {
                integration: 'workflow-asana',
                event: 'task:created',
                conditions: { projectId: 'revops-project' }
            }
        ]
    });
    console.log('✅ Created integration workflow:', workflow.name);
}
async function exampleMonitoringAndMetrics(integrationHub) {
    console.log('\n📌 Example 8: Monitoring and Metrics');
    const status = integrationHub.getStatus();
    console.log('📊 Hub Status:', {
        status: status.status,
        totalIntegrations: status.totalIntegrations,
        activeIntegrations: status.activeIntegrations,
        healthyIntegrations: status.healthyIntegrations,
        successRate: `${(status.metrics.successRate * 100).toFixed(2)}%`,
        avgResponseTime: `${status.metrics.averageResponseTime.toFixed(2)}ms`
    });
    const connectionResults = await integrationHub.testAllConnections();
    console.log('\n🔌 Connection Test Results:');
    for (const [integrationId, isConnected] of connectionResults) {
        console.log(`  - ${integrationId}: ${isConnected ? '✅ Connected' : '❌ Disconnected'}`);
    }
    const integrations = integrationHub.getAllIntegrations();
    console.log('\n📈 Integration Metrics:');
    for (const integration of integrations) {
        const metrics = integration.getMetrics();
        console.log(`  ${integration['config'].name}:`, {
            requests: metrics.totalRequests,
            success: metrics.successfulRequests,
            failed: metrics.failedRequests,
            avgTime: `${metrics.averageResponseTime.toFixed(2)}ms`,
            cacheHitRate: metrics.totalRequests > 0
                ? `${((metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 100).toFixed(2)}%`
                : '0%'
        });
    }
}
async function main() {
    console.log('🎯 Agentic RevOps Integration Examples\n');
    try {
        const { integrationHub, swarmMemory, hitlSystem, dbManager } = await setupIntegrations();
        await exampleBasicIntegration(integrationHub);
        await exampleClientSuite(integrationHub);
        await exampleEnhancedAsanaOperations(integrationHub);
        await exampleGoogleWorkspaceOperations(integrationHub);
        await exampleNotionKnowledgeBase(integrationHub);
        await exampleCrossPlatformSync(integrationHub);
        await exampleIntegrationWorkflow(integrationHub);
        await exampleMonitoringAndMetrics(integrationHub);
        console.log('\n✅ All examples completed successfully!');
        console.log('\n🧹 Cleaning up...');
        await integrationHub.shutdown();
        await hitlSystem.shutdown();
        await dbManager.close();
    }
    catch (error) {
        console.error('❌ Error running examples:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    main().catch(console.error);
}
//# sourceMappingURL=IntegrationExample.js.map