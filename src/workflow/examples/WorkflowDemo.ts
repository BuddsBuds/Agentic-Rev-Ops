// Workflow System Demo - Comprehensive example of all workflow features
import { WorkflowSystem } from '../WorkflowSystem';
import { SwarmMemory } from '../../swarm/memory/SwarmMemory';
import { SwarmCoordinator } from '../../swarm/coordinator/SwarmCoordinator';
import { CommunicationProtocol } from '../../swarm/communication/CommunicationProtocol';

async function runWorkflowDemo() {
  console.log('🚀 Starting Agentic RevOps Workflow System Demo\n');

  // Initialize swarm components for HITL integration
  const swarmMemory = new SwarmMemory();
  const communicationProtocol = new CommunicationProtocol();
  const swarmCoordinator = new SwarmCoordinator(swarmMemory, communicationProtocol);

  // Create workflow system with full configuration
  const workflowSystem = new WorkflowSystem(
    {
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
        executionTimeout: 300000, // 5 minutes
        retryPolicy: 'default',
        caching: true
      }
    },
    swarmMemory,
    swarmCoordinator
  );

  // Set up event listeners
  setupEventListeners(workflowSystem);

  try {
    // Initialize the system
    console.log('📦 Initializing workflow system...');
    await workflowSystem.initialize();
    console.log('✅ Workflow system initialized\n');

    // Demo 1: Basic Workflow Execution
    await demoBasicWorkflow(workflowSystem);

    // Demo 2: Scheduled Workflow
    await demoScheduledWorkflow(workflowSystem);

    // Demo 3: Process Management
    await demoProcessManagement(workflowSystem);

    // Demo 4: Error Handling and Recovery
    await demoErrorHandling(workflowSystem);

    // Demo 5: Performance Optimization
    await demoPerformanceOptimization(workflowSystem);

    // Demo 6: HITL Integration
    await demoHITLIntegration(workflowSystem);

    // Show system status
    const status = workflowSystem.getSystemStatus();
    console.log('\n📊 System Status:');
    console.log(`  Status: ${status.status}`);
    console.log(`  Health: ${status.health.status} (score: ${status.health.score})`);
    console.log(`  Uptime: ${Math.round(status.uptime / 1000)}s`);
    console.log(`  Metrics:`, status.metrics);

  } catch (error) {
    console.error('❌ Demo error:', error);
  } finally {
    // Shutdown the system
    console.log('\n🛑 Shutting down workflow system...');
    await workflowSystem.shutdown();
    console.log('✅ Workflow system shut down');
  }
}

// Demo 1: Basic Workflow Execution
async function demoBasicWorkflow(workflowSystem: WorkflowSystem) {
  console.log('\n📋 Demo 1: Basic Workflow Execution');
  console.log('=====================================');

  // Create a simple workflow
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

  // Execute the workflow
  console.log('🔄 Executing workflow...');
  const result = await workflowSystem.executeWorkflow(workflowId, {
    leadId: 'LEAD-123',
    email: 'prospect@example.com'
  });

  console.log('✅ Workflow completed:', result);
}

// Demo 2: Scheduled Workflow
async function demoScheduledWorkflow(workflowSystem: WorkflowSystem) {
  console.log('\n📅 Demo 2: Scheduled Workflow');
  console.log('================================');

  // Create a daily report workflow
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

  // Schedule for daily execution
  const scheduleId = await workflowSystem.scheduleWorkflow(
    workflowId,
    { type: 'cron', value: '0 9 * * *', timezone: 'America/New_York' }, // 9 AM daily
    { reportType: 'revenue', recipients: ['sales@company.com', 'finance@company.com'] }
  );

  console.log(`✅ Scheduled workflow ${workflowId} with schedule ID: ${scheduleId}`);
}

// Demo 3: Process Management
async function demoProcessManagement(workflowSystem: WorkflowSystem) {
  console.log('\n🔄 Demo 3: Process Management');
  console.log('================================');

  // Create a complex sales process
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
        sla: { duration: 120, warningThreshold: 80 } // 2 hours
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
            timeout: 86400000 // 24 hours
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

  // Execute the process
  console.log('🔄 Executing process...');
  const executionId = await workflowSystem.executeProcess(processId, {
    leadId: 'ENT-LEAD-456',
    company: 'Acme Corp',
    dealSize: 250000
  });

  console.log(`✅ Process execution started: ${executionId}`);
}

// Demo 4: Error Handling and Recovery
async function demoErrorHandling(workflowSystem: WorkflowSystem) {
  console.log('\n⚠️  Demo 4: Error Handling and Recovery');
  console.log('========================================');

  // Create a workflow with potential errors
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
            // Simulate network error
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
            // Simulate validation error
            if (Math.random() > 0.7) {
              throw new Error('Invalid data format');
            }
            return { valid: true };
          }
        },
        onError: 'continue' // Continue workflow even if validation fails
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

  // Execute with error handling
  try {
    console.log('🔄 Executing workflow with potential errors...');
    const result = await workflowSystem.executeWorkflow(workflowId);
    console.log('✅ Workflow completed with recovery:', result);
  } catch (error) {
    console.log('❌ Workflow failed after recovery attempts:', error);
  }
}

// Demo 5: Performance Optimization
async function demoPerformanceOptimization(workflowSystem: WorkflowSystem) {
  console.log('\n⚡ Demo 5: Performance Optimization');
  console.log('=====================================');

  // Create a workflow with parallel execution
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

  // Execute and measure performance
  const startTime = Date.now();
  await workflowSystem.executeWorkflow(workflowId);
  const executionTime = Date.now() - startTime;

  console.log(`✅ Parallel workflow completed in ${executionTime}ms`);

  // Get performance metrics
  const metrics = workflowSystem.getPerformanceMonitor().getWorkflowMetrics(workflowId);
  console.log('📊 Performance Metrics:', metrics);

  // Get optimization suggestions
  const suggestions = workflowSystem.getPerformanceMonitor().getOptimizationSuggestions();
  if (suggestions.length > 0) {
    console.log('💡 Optimization Suggestions:');
    suggestions.forEach(s => {
      console.log(`  - ${s.title}: ${s.description}`);
      console.log(`    Impact: ${s.estimatedImprovement}% improvement`);
    });
  }
}

// Demo 6: HITL Integration
async function demoHITLIntegration(workflowSystem: WorkflowSystem) {
  console.log('\n👤 Demo 6: Human-in-the-Loop Integration');
  console.log('==========================================');

  const hitlSystem = workflowSystem.getHITLSystem();
  if (!hitlSystem) {
    console.log('⚠️  HITL system not available');
    return;
  }

  // Create a workflow requiring human approval
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
          action: async (params: any, context: any) => {
            // Simulate HITL decision request
            console.log('  🤔 Requesting human review...');
            
            // In real implementation, this would create a HITL task
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

  // Execute workflow with HITL
  const result = await workflowSystem.executeWorkflow(workflowId, {
    dealId: 'DEAL-789',
    value: 500000,
    customer: 'Enterprise Customer Inc.'
  });

  console.log('✅ HITL workflow completed:', result);
}

// Event Listeners
function setupEventListeners(workflowSystem: WorkflowSystem) {
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

// Run the demo
if (require.main === module) {
  runWorkflowDemo().catch(console.error);
}

export { runWorkflowDemo };