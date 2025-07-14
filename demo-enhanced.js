/**
 * Enhanced Agentic RevOps Demo
 * Demonstrates the complete swarm system with new features
 */

const { EventEmitter } = require('events');

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║         AGENTIC REVENUE OPERATIONS SYSTEM                     ║
║         Enhanced Swarm with Advanced Features                 ║
╚═══════════════════════════════════════════════════════════════╝
`);

// Mock Communication Protocol
class CommunicationProtocol extends EventEmitter {
  constructor() {
    super();
    this.messageLog = [];
  }

  async sendMessage(from, to, type, content) {
    const message = {
      id: `msg_${Date.now()}`,
      from,
      to,
      type,
      content,
      timestamp: new Date()
    };
    
    this.messageLog.push(message);
    console.log(`  📨 ${from} → ${to}: ${type}`);
    
    this.emit('message', message);
    return message;
  }
}

// Mock Swarm Memory
class SwarmMemory {
  constructor() {
    this.memory = new Map();
    this.decisions = [];
  }

  async store(entry) {
    this.memory.set(entry.id, entry);
  }

  async retrieve(query) {
    const results = [];
    for (const [id, entry] of this.memory) {
      if (query.type && entry.type === query.type) {
        results.push(entry);
      }
    }
    return results;
  }

  async storeDecision(decision) {
    this.decisions.push(decision);
    await this.store({
      id: `dec_${decision.id}`,
      type: 'decision',
      content: decision,
      timestamp: new Date()
    });
  }

  async analyzePatterns() {
    const patterns = {};
    
    // Analyze decision patterns
    for (const decision of this.decisions) {
      const key = `${decision.type}_${decision.winner}`;
      patterns[key] = (patterns[key] || 0) + 1;
    }
    
    return patterns;
  }
}

// Enhanced Queen Agent
class QueenAgent extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.agents = new Map();
    this.decisions = [];
    this.memory = new SwarmMemory();
    this.protocol = new CommunicationProtocol();
    this.emergencyMode = false;
  }

  registerAgent(agent) {
    this.agents.set(agent.id, agent);
    agent.setQueen(this);
    agent.setProtocol(this.protocol);
    console.log(`✅ Registered ${agent.type} agent: ${agent.name}`);
  }

  async makeDecision(topic, context, options = {}) {
    console.log(`\n🗳️  Starting ${options.emergency ? 'EMERGENCY' : 'majority'} vote on: ${topic}`);
    
    // Broadcast vote request
    await this.protocol.sendMessage('Queen', 'all-agents', 'vote_request', { topic, context });
    
    // Gather votes
    const votes = [];
    for (const [id, agent] of this.agents) {
      const vote = await agent.vote(topic, context);
      votes.push(vote);
      console.log(`  📊 ${agent.name} voted: ${vote.choice} (confidence: ${(vote.confidence * 100).toFixed(0)}%)`);
    }

    // Count votes with weights
    const voteCounts = {};
    votes.forEach(vote => {
      const weight = vote.confidence * (this.agents.get(vote.agentId)?.votingWeight || 1);
      voteCounts[vote.choice] = (voteCounts[vote.choice] || 0) + weight;
    });

    // Find winner
    let winner = null;
    let maxVotes = 0;
    for (const [choice, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count;
        winner = choice;
      }
    }

    // Check for ties
    const tied = Object.entries(voteCounts).filter(([_, count]) => count === maxVotes);
    if (tied.length > 1) {
      console.log(`  ⚖️  TIE DETECTED! Queen breaking tie...`);
      winner = tied[0][0]; // Queen decides
    }

    const decision = {
      id: Date.now().toString(),
      topic,
      type: options.emergency ? 'emergency' : 'strategic',
      winner,
      participation: votes.length / this.agents.size,
      confidence: maxVotes / votes.length,
      timestamp: new Date()
    };

    this.decisions.push(decision);
    await this.memory.storeDecision(decision);
    
    console.log(`\n✅ Decision made: ${winner}`);
    console.log(`   Participation: ${(decision.participation * 100).toFixed(0)}%`);
    console.log(`   Confidence: ${(decision.confidence * 100).toFixed(0)}%`);

    // Broadcast decision
    await this.protocol.sendMessage('Queen', 'all-agents', 'decision_made', decision);

    return decision;
  }

  async handleEmergency(situation, context) {
    console.log(`\n🚨 EMERGENCY DECLARED: ${situation}`);
    this.emergencyMode = true;
    
    // Quick decision with 5 second timeout
    const decision = await this.makeDecision(situation, context, { emergency: true });
    
    // Emergency actions
    console.log(`\n🚑 EMERGENCY ACTIONS:`);
    console.log(`   - All agents mobilized`);
    console.log(`   - Priority resources allocated`);
    console.log(`   - Monitoring enhanced`);
    
    this.emergencyMode = false;
    return decision;
  }

  async analyzeSwarmPerformance() {
    const patterns = await this.memory.analyzePatterns();
    console.log(`\n📊 PERFORMANCE ANALYSIS:`);
    console.log(`   Total Decisions: ${this.decisions.length}`);
    console.log(`   Decision Patterns:`, patterns);
    
    return {
      totalDecisions: this.decisions.length,
      patterns,
      avgConfidence: this.decisions.reduce((sum, d) => sum + d.confidence, 0) / this.decisions.length
    };
  }
}

// Enhanced Worker Agent
class WorkerAgent extends EventEmitter {
  constructor(id, type, name, specialties, votingWeight = 1) {
    super();
    this.id = id;
    this.type = type;
    this.name = name;
    this.specialties = specialties;
    this.votingWeight = votingWeight;
    this.queen = null;
    this.protocol = null;
    this.taskQueue = [];
    this.learningHistory = [];
  }

  setQueen(queen) {
    this.queen = queen;
  }

  setProtocol(protocol) {
    this.protocol = protocol;
  }

  async vote(topic, context) {
    // Use communication protocol
    if (this.protocol) {
      await this.protocol.sendMessage(this.id, 'Queen', 'vote_cast', { topic });
    }
    
    // Simulate agent analysis with learning
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));

    // Make decision based on specialties and learning
    let choice;
    let confidence = 0.5 + Math.random() * 0.5;

    // Apply learned patterns
    const relevantHistory = this.learningHistory.filter(h => 
      h.topic.includes(topic.split(' ')[0])
    );
    
    if (relevantHistory.length > 0) {
      // Use past successful decisions
      const successfulChoices = relevantHistory
        .filter(h => h.success)
        .map(h => h.choice);
      
      if (successfulChoices.length > 0) {
        choice = successfulChoices[successfulChoices.length - 1];
        confidence *= 1.2; // Higher confidence from learning
      }
    }

    // Default decision logic
    if (!choice) {
      if (topic.includes('pipeline') && this.specialties.includes('sales')) {
        choice = 'optimize-pipeline-automation';
        confidence *= this.votingWeight;
      } else if (topic.includes('lead') && this.specialties.includes('marketing')) {
        choice = 'implement-lead-scoring';
        confidence *= this.votingWeight;
      } else if (topic.includes('revenue') && this.specialties.includes('analytics')) {
        choice = 'forecast-with-ml-model';
        confidence *= this.votingWeight;
      } else if (topic.includes('process') && this.specialties.includes('optimization')) {
        choice = 'automate-workflow';
        confidence *= this.votingWeight;
      } else {
        choice = 'standard-optimization';
      }
    }

    // Store learning
    this.learningHistory.push({
      topic,
      choice,
      confidence: Math.min(confidence, 1.0),
      timestamp: new Date(),
      success: Math.random() > 0.3 // Simulated success
    });

    return {
      agentId: this.id,
      choice,
      confidence: Math.min(confidence, 1.0),
      reasoning: `Based on ${this.type} analysis with ${this.learningHistory.length} past experiences`
    };
  }

  async processTask(task) {
    console.log(`  🔧 ${this.name} processing: ${task.name}`);
    
    // Simulate task processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Report completion
    if (this.protocol) {
      await this.protocol.sendMessage(this.id, 'Queen', 'task_complete', {
        taskId: task.id,
        result: 'success'
      });
    }
    
    return { success: true, result: `${task.name} completed` };
  }
}

// Process Optimization Agent
class ProcessOptimizationAgent extends WorkerAgent {
  constructor(id, name) {
    super(id, 'Process Optimizer', name, ['optimization', 'automation', 'efficiency'], 1.1);
    this.optimizationPatterns = new Map();
  }

  async analyzeProcess(process) {
    console.log(`\n🔍 ${this.name} analyzing process...`);
    
    const analysis = {
      bottlenecks: this.identifyBottlenecks(process),
      automationOpportunities: this.findAutomationOpportunities(process),
      expectedImprovements: {
        timeReduction: '40%',
        costReduction: '30%',
        errorReduction: '60%'
      }
    };
    
    console.log(`   Bottlenecks found: ${analysis.bottlenecks.length}`);
    console.log(`   Automation opportunities: ${analysis.automationOpportunities.length}`);
    
    return analysis;
  }

  identifyBottlenecks(process) {
    return [
      { step: 'Approval', impact: 'high', solution: 'Automated approval rules' },
      { step: 'Data Entry', impact: 'medium', solution: 'RPA implementation' }
    ];
  }

  findAutomationOpportunities(process) {
    return [
      { area: 'Lead Qualification', roi: 3.5, complexity: 'low' },
      { area: 'Report Generation', roi: 2.8, complexity: 'medium' }
    ];
  }
}

// Swarm Coordinator
class SwarmCoordinator {
  constructor() {
    this.swarms = new Map();
    this.globalProtocol = new CommunicationProtocol();
  }

  registerSwarm(id, name, queen) {
    this.swarms.set(id, { id, name, queen, status: 'active' });
    console.log(`\n🌐 Registered swarm: ${name}`);
  }

  async coordinateSwarms(task) {
    console.log(`\n🎯 Coordinating ${this.swarms.size} swarms for: ${task}`);
    
    // Find best swarm for task
    const selectedSwarm = Array.from(this.swarms.values())[0]; // Simple selection
    
    console.log(`   Selected swarm: ${selectedSwarm.name}`);
    
    // Route task
    const result = await selectedSwarm.queen.makeDecision(task, {});
    
    return result;
  }

  getNetworkStatus() {
    return {
      totalSwarms: this.swarms.size,
      activeSwarms: Array.from(this.swarms.values()).filter(s => s.status === 'active').length
    };
  }
}

// Demo Execution
async function runEnhancedDemo() {
  console.log('\n🚀 Initializing Enhanced RevOps Swarm System...\n');

  // Create coordinator
  const coordinator = new SwarmCoordinator();

  // Create primary swarm
  const queen = new QueenAgent({
    swarmId: 'primary-swarm',
    majorityThreshold: 0.5
  });

  // Create specialized agents with different weights
  const agents = [
    new WorkerAgent('crm-1', 'CRM Specialist', 'Sales Pipeline Expert', ['sales', 'crm'], 1.2),
    new WorkerAgent('marketing-1', 'Marketing Expert', 'Lead Generation Guru', ['marketing', 'leads'], 1.1),
    new WorkerAgent('analytics-1', 'Analytics Master', 'Data Science Wizard', ['analytics', 'forecasting'], 1.3),
    new ProcessOptimizationAgent('process-1', 'Efficiency Expert')
  ];

  // Register agents
  agents.forEach(agent => queen.registerAgent(agent));
  
  // Register swarm with coordinator
  coordinator.registerSwarm('primary', 'Primary RevOps Swarm', queen);

  console.log('\n' + '='.repeat(60) + '\n');

  // Scenario 1: Process Optimization
  console.log('📋 SCENARIO 1: Process Optimization with New Agent');
  console.log('The order-to-cash process needs optimization.');
  
  const processAgent = agents.find(a => a.type === 'Process Optimizer');
  const processAnalysis = await processAgent.analyzeProcess({
    name: 'Order-to-Cash',
    steps: 15,
    manualSteps: 12
  });
  
  await queen.makeDecision(
    'Optimize order-to-cash process',
    { analysis: processAnalysis }
  );

  console.log('\n' + '='.repeat(60) + '\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Scenario 2: Inter-Agent Communication
  console.log('📋 SCENARIO 2: Inter-Agent Communication');
  console.log('Agents collaborating on complex decision.');
  
  console.log('\n📡 Communication Log:');
  await queen.makeDecision(
    'Implement integrated RevOps platform',
    {
      requirements: ['CRM integration', 'Marketing automation', 'Analytics', 'Process optimization'],
      budget: 500000
    }
  );

  console.log('\n' + '='.repeat(60) + '\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Scenario 3: Emergency Response
  console.log('📋 SCENARIO 3: Emergency Response');
  console.log('Major client threatening to churn!');
  
  await queen.handleEmergency(
    'Client ABC Corp showing severe churn signals',
    {
      accountValue: 500000,
      churnProbability: 0.85,
      lastContact: '5 days ago'
    }
  );

  console.log('\n' + '='.repeat(60) + '\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Scenario 4: Multi-Swarm Coordination
  console.log('📋 SCENARIO 4: Multi-Swarm Coordination');
  console.log('Creating specialized swarm for expansion.');
  
  // Create second swarm
  const expansionQueen = new QueenAgent({
    swarmId: 'expansion-swarm',
    majorityThreshold: 0.6
  });
  
  const expansionAgents = [
    new WorkerAgent('exp-1', 'Market Analyst', 'Market Research Expert', ['market', 'analysis'], 1.2),
    new WorkerAgent('exp-2', 'Growth Strategist', 'Expansion Specialist', ['growth', 'strategy'], 1.3)
  ];
  
  expansionAgents.forEach(agent => expansionQueen.registerAgent(agent));
  coordinator.registerSwarm('expansion', 'Market Expansion Swarm', expansionQueen);
  
  // Coordinate swarms
  await coordinator.coordinateSwarms('Plan market expansion into APAC region');

  console.log('\n' + '='.repeat(60) + '\n');

  // Performance Analysis
  console.log('📊 SWARM PERFORMANCE ANALYSIS');
  console.log('='.repeat(40));
  
  const performance = await queen.analyzeSwarmPerformance();
  console.log(`\nPrimary Swarm:`);
  console.log(`  Average Decision Confidence: ${(performance.avgConfidence * 100).toFixed(0)}%`);
  console.log(`  Learning Progress: ${agents[0].learningHistory.length} experiences recorded`);
  
  const networkStatus = coordinator.getNetworkStatus();
  console.log(`\nNetwork Status:`);
  console.log(`  Total Swarms: ${networkStatus.totalSwarms}`);
  console.log(`  Active Swarms: ${networkStatus.activeSwarms}`);
  console.log(`  Total Messages: ${queen.protocol.messageLog.length}`);
  
  console.log('\n✅ Enhanced demo completed successfully!\n');
}

// Run the enhanced demo
runEnhancedDemo().catch(console.error);