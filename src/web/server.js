#!/usr/bin/env node
/**
 * Admin Dashboard Web Server
 * Serves the administrative interface for Agentic RevOps
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');

class AdminServer {
    constructor(port = 3000) {
        this.port = port;
        this.app = express();
        this.server = http.createServer(this.app);
        this.wss = new WebSocket.Server({ server: this.server });
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        this.setupMockData();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname)));
        
        // Logging middleware
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        // Serve the main admin dashboard
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'index.html'));
        });

        // API Routes
        this.app.get('/api/status', this.getSystemStatus.bind(this));
        this.app.get('/api/integrations', this.getIntegrations.bind(this));
        this.app.post('/api/integrations/:id/test', this.testIntegration.bind(this));
        this.app.get('/api/settings', this.getSettings.bind(this));
        this.app.post('/api/settings', this.saveSettings.bind(this));
        this.app.get('/api/database/status', this.getDatabaseStatus.bind(this));
        this.app.post('/api/database/test', this.testDatabase.bind(this));
        this.app.get('/api/swarm/status', this.getSwarmStatus.bind(this));
        this.app.get('/api/decisions/recent', this.getRecentDecisions.bind(this));
        this.app.get('/api/logs', this.getSystemLogs.bind(this));
        this.app.post('/api/workflows/:id/execute', this.executeWorkflow.bind(this));
        
        // Client Management Routes
        this.app.get('/api/clients', this.getClients.bind(this));
        this.app.get('/api/clients/:id', this.getClient.bind(this));
        this.app.post('/api/clients/onboard', this.onboardClient.bind(this));
        this.app.put('/api/clients/:id', this.updateClient.bind(this));
        this.app.post('/api/clients/:id/chat', this.clientChat.bind(this));
        this.app.get('/api/clients/:id/content', this.getClientContent.bind(this));
        this.app.post('/api/clients/:id/content', this.createClientContent.bind(this));
        this.app.get('/api/clients/:id/analytics', this.getClientAnalytics.bind(this));
        this.app.get('/api/clients/:id/social', this.getClientSocial.bind(this));
        
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        });

        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({ error: 'Not found' });
        });

        // Error handler
        this.app.use((err, req, res, next) => {
            console.error('Server error:', err);
            res.status(500).json({ error: 'Internal server error' });
        });
    }

    setupWebSocket() {
        this.wss.on('connection', (ws) => {
            console.log('WebSocket client connected');
            
            // Send initial status
            ws.send(JSON.stringify({
                type: 'status',
                data: this.mockData.systemStatus
            }));

            // Send periodic updates
            const interval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'update',
                        data: {
                            timestamp: new Date().toISOString(),
                            activeAgents: Math.floor(Math.random() * 2) + 3,
                            systemHealth: 95 + Math.floor(Math.random() * 5)
                        }
                    }));
                }
            }, 5000);

            ws.on('close', () => {
                console.log('WebSocket client disconnected');
                clearInterval(interval);
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                clearInterval(interval);
            });
        });
    }

    setupMockData() {
        this.mockData = {
            systemStatus: {
                activeAgents: 4,
                connectedIntegrations: 8,
                activeWorkflows: 12,
                systemHealth: 98,
                uptime: '15 days, 3 hours',
                lastRestart: '2024-12-29T08:00:00Z'
            },
            
            integrations: [
                {
                    id: 'asana',
                    name: 'Asana',
                    description: 'Project management and task tracking',
                    status: 'connected',
                    lastSync: new Date().toISOString(),
                    config: {
                        workspace: 'RevOps Team',
                        webhook_url: 'https://api.asana.com/webhooks'
                    }
                },
                {
                    id: 'google',
                    name: 'Google Workspace',
                    description: 'Document collaboration and productivity',
                    status: 'connected',
                    lastSync: new Date().toISOString(),
                    config: {
                        domain: 'company.com',
                        service_account: 'revops@company.iam.gserviceaccount.com'
                    }
                },
                {
                    id: 'notion',
                    name: 'Notion',
                    description: 'Knowledge base and documentation',
                    status: 'connected',
                    lastSync: new Date().toISOString(),
                    config: {
                        workspace: 'RevOps Command Center',
                        database_id: 'abc123def456'
                    }
                },
                {
                    id: 'salesforce',
                    name: 'Salesforce',
                    description: 'Customer relationship management',
                    status: 'disconnected',
                    lastSync: null,
                    config: {
                        instance_url: 'https://company.salesforce.com',
                        api_version: 'v59.0'
                    }
                }
            ],

            settings: {
                swarm: {
                    votingThreshold: 70,
                    decisionTimeout: 300,
                    queenAuthority: 'medium',
                    maxAgents: 10
                },
                hitl: {
                    confidenceThreshold: 75,
                    autoApproveLowRisk: true,
                    notificationChannels: ['email', 'slack']
                },
                workflow: {
                    maxConcurrentWorkflows: 50,
                    defaultTimeout: 3600,
                    retryAttempts: 3
                }
            },

            recentDecisions: [
                {
                    id: 'dec_001',
                    title: 'Pipeline Optimization Strategy',
                    description: 'AI-driven optimization of Q4 sales pipeline',
                    status: 'approved',
                    confidence: 85,
                    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
                    agents: ['CRM-Agent', 'Analytics-Agent', 'Marketing-Agent']
                },
                {
                    id: 'dec_002',
                    title: 'Lead Scoring Model Update',
                    description: 'Machine learning model refinement for lead qualification',
                    status: 'pending',
                    confidence: 68,
                    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
                    agents: ['Analytics-Agent', 'CRM-Agent']
                },
                {
                    id: 'dec_003',
                    title: 'Client Retention Campaign',
                    description: 'Automated retention strategy for at-risk accounts',
                    status: 'approved',
                    confidence: 92,
                    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
                    agents: ['Marketing-Agent', 'CRM-Agent', 'Analytics-Agent']
                }
            ],

            systemLogs: [
                {
                    id: 'log_001',
                    level: 'info',
                    message: 'Swarm decision completed successfully',
                    timestamp: new Date().toISOString(),
                    component: 'Queen-Agent'
                },
                {
                    id: 'log_002',
                    level: 'warning',
                    message: 'Salesforce integration connection timeout',
                    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
                    component: 'Integration-Manager'
                },
                {
                    id: 'log_003',
                    level: 'info',
                    message: 'Workflow execution started',
                    timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
                    component: 'Workflow-Engine'
                }
            ]
        };
    }

    // API Route Handlers
    async getSystemStatus(req, res) {
        try {
            res.json({
                success: true,
                data: this.mockData.systemStatus
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getIntegrations(req, res) {
        try {
            res.json({
                success: true,
                data: this.mockData.integrations
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async testIntegration(req, res) {
        try {
            const { id } = req.params;
            const integration = this.mockData.integrations.find(i => i.id === id);
            
            if (!integration) {
                return res.status(404).json({ success: false, error: 'Integration not found' });
            }

            // Simulate connection test
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            integration.status = Math.random() > 0.1 ? 'connected' : 'error';
            integration.lastSync = new Date().toISOString();

            res.json({
                success: true,
                data: {
                    status: integration.status,
                    message: integration.status === 'connected' 
                        ? 'Connection successful' 
                        : 'Connection failed'
                }
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getSettings(req, res) {
        try {
            res.json({
                success: true,
                data: this.mockData.settings
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async saveSettings(req, res) {
        try {
            const { category, settings } = req.body;
            
            if (category && this.mockData.settings[category]) {
                this.mockData.settings[category] = { ...this.mockData.settings[category], ...settings };
            } else {
                this.mockData.settings = { ...this.mockData.settings, ...req.body };
            }

            res.json({
                success: true,
                message: 'Settings saved successfully'
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getDatabaseStatus(req, res) {
        try {
            res.json({
                success: true,
                data: {
                    status: 'connected',
                    host: 'localhost',
                    port: 5432,
                    database: 'agentic_revops',
                    ssl: true,
                    pool: {
                        total: 10,
                        idle: 8,
                        waiting: 0
                    },
                    lastQuery: new Date().toISOString()
                }
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async testDatabase(req, res) {
        try {
            // Simulate database connection test
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            res.json({
                success: true,
                data: {
                    status: 'connected',
                    responseTime: Math.floor(Math.random() * 50) + 10,
                    message: 'Database connection successful'
                }
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getSwarmStatus(req, res) {
        try {
            res.json({
                success: true,
                data: {
                    status: 'active',
                    agents: [
                        { id: 'queen', name: 'Queen Agent', status: 'active', decisions: 156 },
                        { id: 'crm', name: 'CRM Specialist', status: 'active', decisions: 89 },
                        { id: 'marketing', name: 'Marketing Expert', status: 'active', decisions: 67 },
                        { id: 'analytics', name: 'Analytics Master', status: 'active', decisions: 134 }
                    ],
                    activeDecisions: 3,
                    averageConfidence: 82,
                    lastActivity: new Date().toISOString()
                }
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getRecentDecisions(req, res) {
        try {
            res.json({
                success: true,
                data: this.mockData.recentDecisions
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getSystemLogs(req, res) {
        try {
            const { level, component, limit = 50 } = req.query;
            let logs = [...this.mockData.systemLogs];

            if (level) {
                logs = logs.filter(log => log.level === level);
            }
            if (component) {
                logs = logs.filter(log => log.component === component);
            }

            logs = logs.slice(0, parseInt(limit));

            res.json({
                success: true,
                data: logs
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async executeWorkflow(req, res) {
        try {
            const { id } = req.params;
            const { parameters } = req.body;

            // Simulate workflow execution
            await new Promise(resolve => setTimeout(resolve, 2000));

            res.json({
                success: true,
                data: {
                    workflowId: id,
                    executionId: `exec_${Date.now()}`,
                    status: 'started',
                    parameters,
                    estimatedDuration: 300
                }
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Client Management API Handlers
    async getClients(req, res) {
        try {
            // Mock clients data
            const clients = [
                {
                    id: '1',
                    name: 'Acme Corporation',
                    domain: 'https://acme.com',
                    status: 'active',
                    onboarding_completed: true,
                    onboarding_progress: 100,
                    created_at: '2024-01-15T10:00:00Z',
                    metrics: {
                        revenue: 2500000,
                        growth: 15,
                        campaigns: 5,
                        social_followers: 25000
                    },
                    integrations: ['salesforce', 'google', 'mailchimp'],
                    primary_contact: 'John Smith'
                },
                {
                    id: '2',
                    name: 'TechStart Inc.',
                    domain: 'https://techstart.io',
                    status: 'active',
                    onboarding_completed: true,
                    onboarding_progress: 100,
                    created_at: '2024-01-20T14:30:00Z',
                    metrics: {
                        revenue: 850000,
                        growth: 45,
                        campaigns: 3,
                        social_followers: 12000
                    },
                    integrations: ['hubspot', 'notion', 'slack'],
                    primary_contact: 'Sarah Johnson'
                }
            ];
            
            res.json(clients);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getClient(req, res) {
        try {
            const { id } = req.params;
            // Mock client data
            const client = {
                id,
                name: 'Acme Corporation',
                domain: 'https://acme.com',
                status: 'active',
                onboarding_completed: true,
                stakeholders: [
                    { name: 'John Smith', role: 'CEO', email: 'john@acme.com', is_primary: true }
                ],
                integrations: ['salesforce', 'google', 'mailchimp'],
                analyses: ['market', 'seo', 'competitive']
            };
            
            res.json({ success: true, data: client });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async onboardClient(req, res) {
        try {
            const { client, stakeholders, socialLinks, integrations, documents, analyses } = req.body;
            
            // Simulate client creation
            const clientId = `client_${Date.now()}`;
            
            // In production, this would create database records
            console.log('Onboarding client:', client.name);
            console.log('Stakeholders:', stakeholders.length);
            console.log('Integrations:', integrations.length);
            console.log('Analyses to run:', analyses);
            
            res.json({
                success: true,
                clientId,
                message: 'Client onboarding initiated successfully'
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async updateClient(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;
            
            console.log('Updating client:', id, updates);
            
            res.json({
                success: true,
                message: 'Client updated successfully'
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async clientChat(req, res) {
        try {
            const { id } = req.params;
            const { message } = req.body;
            
            // Simulate AI response
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const responses = {
                'marketing': {
                    message: "I'll create a comprehensive marketing plan for you. Based on your metrics, I recommend focusing on content marketing and paid social campaigns.",
                    agents: ['Coordinator Agent', 'Marketing Agent', 'CRM Agent']
                },
                default: {
                    message: "I understand your request. Let me coordinate with the specialized agents to provide you with insights and recommendations.",
                    agents: ['Coordinator Agent']
                }
            };
            
            const response = message.toLowerCase().includes('marketing') ? responses.marketing : responses.default;
            
            res.json({
                success: true,
                data: {
                    user_message: message,
                    swarm_response: response.message,
                    agents_involved: response.agents,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getClientContent(req, res) {
        try {
            const { id } = req.params;
            const { type } = req.query;
            
            const content = [
                {
                    id: 'content_1',
                    type: 'marketing_plan',
                    title: 'Q1 Marketing Plan',
                    status: 'approved',
                    created_at: '2024-01-10T10:00:00Z',
                    updated_at: '2024-01-12T14:30:00Z'
                },
                {
                    id: 'content_2',
                    type: 'campaign',
                    title: 'Spring Product Launch',
                    status: 'draft',
                    created_at: '2024-01-08T09:00:00Z',
                    updated_at: '2024-01-11T16:00:00Z'
                }
            ];
            
            res.json({ success: true, data: type ? content.filter(c => c.type === type) : content });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async createClientContent(req, res) {
        try {
            const { id } = req.params;
            const { type, title, content } = req.body;
            
            const contentId = `content_${Date.now()}`;
            
            res.json({
                success: true,
                data: {
                    id: contentId,
                    client_id: id,
                    type,
                    title,
                    status: 'draft',
                    created_at: new Date().toISOString()
                }
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getClientAnalytics(req, res) {
        try {
            const { id } = req.params;
            
            const analytics = {
                traffic: {
                    visitors: [12000, 14000, 13500, 15000],
                    pageviews: [45000, 52000, 49000, 56000],
                    bounce_rate: [42, 40, 41, 39]
                },
                conversions: {
                    funnel: [
                        { stage: 'Visitors', count: 15000 },
                        { stage: 'Leads', count: 3000 },
                        { stage: 'MQLs', count: 900 },
                        { stage: 'SQLs', count: 450 },
                        { stage: 'Customers', count: 110 }
                    ]
                },
                revenue: {
                    monthly: [180000, 195000, 210000, 225000, 240000, 250000],
                    by_source: {
                        direct: 45,
                        organic: 30,
                        paid: 20,
                        referral: 5
                    }
                }
            };
            
            res.json({ success: true, data: analytics });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getClientSocial(req, res) {
        try {
            const { id } = req.params;
            
            const socialData = {
                posts: [
                    {
                        id: 'post_1',
                        platforms: ['twitter', 'linkedin', 'facebook'],
                        content: 'Excited to announce our new AI-powered customer insights dashboard!',
                        scheduled_for: new Date(Date.now() + 86400000).toISOString(),
                        estimated_reach: 5200,
                        predicted_engagement: 3.4
                    }
                ],
                analytics: {
                    total_followers: 25400,
                    follower_growth: 12,
                    engagement_rate: 4.8,
                    posts_this_week: 12,
                    pending_approval: 3
                }
            };
            
            res.json({ success: true, data: socialData });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    start() {
        this.server.listen(this.port, () => {
            console.log(`🚀 Agentic RevOps Admin Dashboard running on http://localhost:${this.port}`);
            console.log(`📊 Real-time updates available via WebSocket`);
            console.log(`🔧 API endpoints available at http://localhost:${this.port}/api`);
        });
    }

    stop() {
        this.server.close(() => {
            console.log('Admin server stopped');
        });
    }
}

// Start server if run directly
if (require.main === module) {
    const port = process.env.PORT || 3000;
    const server = new AdminServer(port);
    server.start();

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\nShutting down admin server...');
        server.stop();
        process.exit(0);
    });
}

module.exports = AdminServer;