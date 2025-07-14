"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runWorkflowDemo = runWorkflowDemo;
const WorkflowSystem_1 = require("../WorkflowSystem");
const SwarmMemory_1 = require("../../swarm/memory/SwarmMemory");
const SwarmCoordinator_1 = require("../../swarm/coordinator/SwarmCoordinator");
const CommunicationProtocol_1 = require("../../swarm/communication/CommunicationProtocol");
async function runWorkflowDemo() {
    console.log('🚀 Starting Agentic RevOps Workflow System Demo\n');
    const swarmMemory = new SwarmMemory_1.SwarmMemory();
    const communicationProtocol = new CommunicationProtocol_1.CommunicationProtocol();
    const swarmCoordinator = new SwarmCoordinator_1.SwarmCoordinator(swarmMemory, communicationProtocol);
    const workflowSystem = new WorkflowSystem_1.WorkflowSystem({
        name: 'RevOps Workflow System',
        version: '1.0.0',
        environment: 'development',
        features: {
            scheduling: true,
            processManagement: true,
            errorHandling: true,
            performanceMonitoring: true,
            hitlIntegration: true,
            swarmIntegration: true
        },
        performance: {
            maxConcurrentWorkflows: 50,
            executionTimeout: 300000,
            retryPolicy: 'default',
            caching: true
        }
    }, swarmMemory, swarmCoordinator);
    setupEventListeners(workflowSystem);
    try {
        console.log('📦 Initializing workflow system...');
        await workflowSystem.initialize();
        console.log('✅ Workflow system initialized\n');
        await demoBasicWorkflow(workflowSystem);
        await demoScheduledWorkflow(workflowSystem);
        await demoProcessManagement(workflowSystem);
        await demoErrorHandling(workflowSystem);
        await demoPerformanceOptimization(workflowSystem);
        await demoHITLIntegration(workflowSystem);
        const status = workflowSystem.getSystemStatus();
        console.log('\n📊 System Status:');
        console.log(`  Status: ${status.status}`);
        console.log(`  Health: ${status.health.status} (score: ${status.health.score})`);
        console.log(`  Uptime: ${Math.round(status.uptime / 1000)}s`);
        console.log(`  Metrics:`, status.metrics);
    }
    catch (error) {
        console.error('❌ Demo error:', error);
    }
    finally {
        console.log('\n🛑 Shutting down workflow system...');
        await workflowSystem.shutdown();
        console.log('✅ Workflow system shut down');
    }
}
async function demoBasicWorkflow(workflowSystem) {
    console.log('\n📋 Demo 1: Basic Workflow Execution');
    console.log('=====================================');
    const workflowId = await workflowSystem.createWorkflow({
        name: 'Lead Qualification Workflow',
        description: 'Qualify and score incoming leads',
        steps: [
            {
                id: 'fetch-lead',
                name: 'Fetch Lead Data',
                type: 'action',
                config: {
                    action: 'log',
                    params: { message: 'Fetching lead data from CRM...' }
                }
            },
            {
                id: 'enrich-data',
                name: 'Enrich Lead Data',
                type: 'action',
                config: {
                    action: 'log',
                    params: { message: 'Enriching lead with external data sources...' }
                },
                dependencies: ['fetch-lead']
            },
            {
                id: 'score-lead',
                name: 'Calculate Lead Score',
                type: 'action',
                config: {
                    action: 'log',
                    params: { message: 'Calculating lead score based on criteria...' }
                },
                dependencies: ['enrich-data']
            },
            {
                id: 'route-lead',
                name: 'Route to Sales Team',
                type: 'condition',
                config: {
                    expression: 'context.leadScore > 70',
                    truePath: 'assign-to-sales',
                    falsePath: 'nurture-campaign'
                },
                dependencies: ['score-lead']
            }
        ],
        variables: {
            leadScore: 85,
            source: 'website'
        }
    });
    console.log(`✅ Created workflow: ${workflowId}`);
    console.log('🔄 Executing workflow...');
    const result = await workflowSystem.executeWorkflow(workflowId, {
        leadId: 'LEAD-123',
        email: 'prospect@example.com'
    });
    console.log('✅ Workflow completed:', result);
}
async function demoScheduledWorkflow(workflowSystem) {
    console.log('\n📅 Demo 2: Scheduled Workflow');
    console.log('================================');
    const workflowId = await workflowSystem.createWorkflow({
        name: 'Daily Revenue Report',
        description: 'Generate and send daily revenue reports',
        steps: [
            {
                id: 'collect-data',
                name: 'Collect Revenue Data',
                type: 'action',
                config: {
                    action: 'log',
                    params: { message: 'Collecting revenue data from all sources...' }
                }
            },
            {
                id: 'generate-report',
                name: 'Generate Report',
                type: 'action',
                config: {
                    action: 'log',
                    params: { message: 'Generating revenue report...' }
                }
            },
            {
                id: 'send-report',
                name: 'Send Report',
                type: 'action',
                config: {
                    action: 'log',
                    params: { message: 'Sending report to stakeholders...' }
                }
            }
        ]
    });
    const scheduleId = await workflowSystem.scheduleWorkflow(workflowId, { type: 'cron', value: '0 9 * * *', timezone: 'America/New_York' }, { reportType: 'revenue', recipients: ['sales@company.com', 'finance@company.com'] });
    console.log(`✅ Scheduled workflow ${workflowId} with schedule ID: ${scheduleId}`);
}
async function demoProcessManagement(workflowSystem) {
    console.log('\n🔄 Demo 3: Process Management');
    console.log('================================');
    const processId = await workflowSystem.createProcess({
        name: 'Enterprise Sales Process',
        description: 'End-to-end enterprise sales workflow',
        category: 'sales',
        owner: 'sales-ops@company.com',
        status: 'active',
        triggers: [
            {
                id: 'new-lead-trigger',
                name: 'New Enterprise Lead',
                type: 'event',
                config: {
                    event: {
                        source: 'crm',
                        type: 'lead.created',
                        filters: { leadType: 'enterprise' }
                    }
                },
                enabled: true
            }
        ],
        steps: [
            {
                id: 'qualification',
                name: 'Lead Qualification',
                type: 'task',
                assignee: { type: 'role', value: 'sdr' },
                config: {
                    task: {
                        instructions: 'Qualify the lead based on BANT criteria',
                        requiredFields: ['budget', 'authority', 'need', 'timeline'],
                        priority: 'high'
                    }
                },
                sla: { duration: 120, warningThreshold: 80 }
            },
            {
                id: 'demo-scheduling',
                name: 'Schedule Demo',
                type: 'automation',
                config: {
                    automation: {
                        function: 'scheduleDemo',
                        parameters: { duration: 45, type: 'product-demo' }
                    }
                }
            },
            {
                id: 'proposal',
                name: 'Create Proposal',
                type: 'task',
                assignee: { type: 'role', value: 'account-executive' },
                config: {
                    task: {
                        instructions: 'Create customized proposal based on discovery',
                        priority: 'high'
                    }
                }
            },
            {
                id: 'approval',
                name: 'Deal Approval',
                type: 'approval',
                config: {
                    approval: {
                        approvers: [
                            { type: 'role', value: 'sales-manager' },
                            { type: 'role', value: 'finance' }
                        ],
                        threshold: 2,
                        timeout: 86400000
                    }
                }
            }
        ],
        kpis: [
            {
                id: 'conversion-rate',
                name: 'Lead to Opportunity Conversion',
                description: 'Percentage of leads converted to opportunities',
                formula: '(variables.opportunities / variables.leads) * 100',
                unit: '%',
                target: 25,
                thresholds: [
                    { level: 'excellent', min: 30, max: 100, color: 'green' },
                    { level: 'good', min: 20, max: 30, color: 'blue' },
                    { level: 'warning', min: 15, max: 20, color: 'yellow' },
                    { level: 'critical', min: 0, max: 15, color: 'red' }
                ],
                frequency: 'daily'
            }
        ]
    });
    console.log(`✅ Created process: ${processId}`);
    console.log('🔄 Executing process...');
    const executionId = await workflowSystem.executeProcess(processId, {
        leadId: 'ENT-LEAD-456',
        company: 'Acme Corp',
        dealSize: 250000
    });
    console.log(`✅ Process execution started: ${executionId}`);
}
async function demoErrorHandling(workflowSystem) {
    console.log('\n⚠️  Demo 4: Error Handling and Recovery');
    console.log('========================================');
    const workflowId = await workflowSystem.createWorkflow({
        name: 'Integration Sync Workflow',
        description: 'Sync data between systems with error handling',
        steps: [
            {
                id: 'fetch-data',
                name: 'Fetch External Data',
                type: 'action',
                config: {
                    action: async () => {
                        if (Math.random() > 0.5) {
                            throw new Error('Network timeout');
                        }
                        return { data: 'fetched' };
                    }
                },
                maxRetries: 3,
                onError: 'retry'
            },
            {
                id: 'validate-data',
                name: 'Validate Data',
                type: 'action',
                config: {
                    action: async () => {
                        if (Math.random() > 0.7) {
                            throw new Error('Invalid data format');
                        }
                        return { valid: true };
                    }
                },
                onError: 'continue'
            },
            {
                id: 'sync-data',
                name: 'Sync to Database',
                type: 'action',
                config: {
                    action: 'log',
                    params: { message: 'Syncing validated data...' }
                }
            }
        ],
        config: {
            errorHandling: 'compensate',
            retryPolicy: {
                maxRetries: 3,
                backoffStrategy: 'exponential',
                baseDelay: 1000,
                maxDelay: 10000
            }
        }
    });
    console.log(`✅ Created error-prone workflow: ${workflowId}`);
    try {
        console.log('🔄 Executing workflow with potential errors...');
        const result = await workflowSystem.executeWorkflow(workflowId);
        console.log('✅ Workflow completed with recovery:', result);
    }
    catch (error) {
        console.log('❌ Workflow failed after recovery attempts:', error);
    }
}
async function demoPerformanceOptimization(workflowSystem) {
    console.log('\n⚡ Demo 5: Performance Optimization');
    console.log('=====================================');
    const workflowId = await workflowSystem.createWorkflow({
        name: 'Parallel Data Processing',
        description: 'Process multiple data sources in parallel',
        steps: [
            {
                id: 'parallel-fetch',
                name: 'Fetch Data from Multiple Sources',
                type: 'parallel',
                config: {
                    steps: [
                        {
                            id: 'fetch-crm',
                            name: 'Fetch CRM Data',
                            type: 'action',
                            config: { action: 'log', params: { message: 'Fetching from CRM...' } }
                        },
                        {
                            id: 'fetch-marketing',
                            name: 'Fetch Marketing Data',
                            type: 'action',
                            config: { action: 'log', params: { message: 'Fetching from Marketing...' } }
                        },
                        {
                            id: 'fetch-support',
                            name: 'Fetch Support Data',
                            type: 'action',
                            config: { action: 'log', params: { message: 'Fetching from Support...' } }
                        }
                    ],
                    maxConcurrency: 3
                }
            },
            {
                id: 'aggregate',
                name: 'Aggregate Results',
                type: 'action',
                config: {
                    action: 'log',
                    params: { message: 'Aggregating data from all sources...' }
                }
            }
        ],
        config: {
            parallel: true,
            maxConcurrency: 5
        }
    });
    console.log(`✅ Created parallel workflow: ${workflowId}`);
    const startTime = Date.now();
    await workflowSystem.executeWorkflow(workflowId);
    const executionTime = Date.now() - startTime;
    console.log(`✅ Parallel workflow completed in ${executionTime}ms`);
    const metrics = workflowSystem.getPerformanceMonitor().getWorkflowMetrics(workflowId);
    console.log('📊 Performance Metrics:', metrics);
    const suggestions = workflowSystem.getPerformanceMonitor().getOptimizationSuggestions();
    if (suggestions.length > 0) {
        console.log('💡 Optimization Suggestions:');
        suggestions.forEach(s => {
            console.log(`  - ${s.title}: ${s.description}`);
            console.log(`    Impact: ${s.estimatedImprovement}% improvement`);
        });
    }
}
async function demoHITLIntegration(workflowSystem) {
    console.log('\n👤 Demo 6: Human-in-the-Loop Integration');
    console.log('==========================================');
    const hitlSystem = workflowSystem.getHITLSystem();
    if (!hitlSystem) {
        console.log('⚠️  HITL system not available');
        return;
    }
    const workflowId = await workflowSystem.createWorkflow({
        name: 'High-Value Deal Approval',
        description: 'Process requiring human approval for high-value deals',
        steps: [
            {
                id: 'analyze-deal',
                name: 'Analyze Deal Terms',
                type: 'action',
                config: {
                    action: 'log',
                    params: { message: 'Analyzing deal terms and risk factors...' }
                }
            },
            {
                id: 'human-review',
                name: 'Human Review Required',
                type: 'action',
                config: {
                    action: async (params, context) => {
                        console.log('  🤔 Requesting human review...');
                        const decision = {
                            type: 'approval',
                            approved: true,
                            comments: 'Deal approved with conditions',
                            conditions: ['Payment terms: Net 30', 'Minimum contract: 12 months']
                        };
                        console.log('  ✅ Human decision received:', decision);
                        return decision;
                    }
                }
            },
            {
                id: 'process-approval',
                name: 'Process Approval',
                type: 'action',
                config: {
                    action: 'log',
                    params: { message: 'Processing approved deal...' }
                }
            }
        ]
    });
    console.log(`✅ Created HITL workflow: ${workflowId}`);
    const result = await workflowSystem.executeWorkflow(workflowId, {
        dealId: 'DEAL-789',
        value: 500000,
        customer: 'Enterprise Customer Inc.'
    });
    console.log('✅ HITL workflow completed:', result);
}
function setupEventListeners(workflowSystem) {
    workflowSystem.on('workflow:started', (data) => {
        console.log(`  ▶️  Workflow started: ${data.workflowId}`);
    });
    workflowSystem.on('workflow:completed', (data) => {
        console.log(`  ✅ Workflow completed: ${data.workflowId}`);
    });
    workflowSystem.on('workflow:failed', (data) => {
        console.log(`  ❌ Workflow failed: ${data.workflowId}`);
    });
    workflowSystem.on('step:failed', (data) => {
        console.log(`  ⚠️  Step failed: ${data.step?.name || data.step?.id}`);
    });
    workflowSystem.on('performance:alert', (alert) => {
        console.log(`  🚨 Performance Alert: ${alert.message}`);
    });
    workflowSystem.on('health:warning', (health) => {
        console.log(`  ⚠️  Health Warning: ${health.issues.join(', ')}`);
    });
    workflowSystem.on('error:recovered', (data) => {
        console.log(`  🔧 Error recovered: ${data.error.message}`);
    });
}
if (require.main === module) {
    runWorkflowDemo().catch(console.error);
}
//# sourceMappingURL=WorkflowDemo.js.map