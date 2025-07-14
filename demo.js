/**
 * Agentic RevOps Demo
 * Simple JavaScript demo of the Queen-based swarm system
 */

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║         AGENTIC REVENUE OPERATIONS SYSTEM                     ║
║         Queen-Based Swarm with Majority Rules                 ║
╚═══════════════════════════════════════════════════════════════╝
`);

// Mock Queen Agent
class QueenAgent {
  constructor(config) {
    this.config = config;
    this.agents = new Map();
    this.decisions = [];
  }

  registerAgent(agent) {
    this.agents.set(agent.id, agent);
    console.log(`✅ Registered ${agent.type} agent: ${agent.name}`);
  }

  async makeDecision(topic, context) {
    console.log(`\n🗳️  Starting majority vote on: ${topic}`);
    
    // Gather votes from agents
    const votes = [];
    for (const [id, agent] of this.agents) {
      const vote = await agent.vote(topic, context);
      votes.push(vote);
      console.log(`  📊 ${agent.name} voted: ${vote.choice} (confidence: ${(vote.confidence * 100).toFixed(0)}%)`);
    }

    // Count votes
    const voteCounts = {};
    votes.forEach(vote => {
      voteCounts[vote.choice] = (voteCounts[vote.choice] || 0) + vote.confidence;
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

    const decision = {
      topic,
      winner,
      participation: votes.length / this.agents.size,
      confidence: maxVotes / votes.length,
      timestamp: new Date()
    };

    this.decisions.push(decision);
    console.log(`\n✅ Decision made: ${winner}`);
    console.log(`   Participation: ${(decision.participation * 100).toFixed(0)}%`);
    console.log(`   Confidence: ${(decision.confidence * 100).toFixed(0)}%`);

    return decision;
  }
}

// Mock Worker Agent
class WorkerAgent {
  constructor(id, type, name, specialties) {
    this.id = id;
    this.type = type;
    this.name = name;
    this.specialties = specialties;
  }

  async vote(topic, context) {
    // Simulate agent analysis
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));

    // Make decision based on specialties
    let choice;
    let confidence = 0.5 + Math.random() * 0.5;

    if (topic.includes('pipeline') && this.specialties.includes('sales')) {
      choice = 'optimize-pipeline-automation';
      confidence *= 1.2;
    } else if (topic.includes('lead') && this.specialties.includes('marketing')) {
      choice = 'implement-lead-scoring';
      confidence *= 1.2;
    } else if (topic.includes('revenue') && this.specialties.includes('analytics')) {
      choice = 'forecast-with-ml-model';
      confidence *= 1.3;
    } else {
      choice = 'standard-optimization';
    }

    return {
      agentId: this.id,
      choice,
      confidence: Math.min(confidence, 1.0),
      reasoning: `Based on ${this.type} analysis`
    };
  }
}

// Demo Scenarios
async function runDemo() {
  console.log('\n🚀 Initializing RevOps Swarm...\n');

  // Create Queen
  const queen = new QueenAgent({
    swarmId: 'demo-swarm',
    majorityThreshold: 0.5
  });

  // Create specialized agents
  const agents = [
    new WorkerAgent('crm-1', 'CRM Specialist', 'Sales Pipeline Expert', ['sales', 'crm']),
    new WorkerAgent('marketing-1', 'Marketing Expert', 'Lead Generation Guru', ['marketing', 'leads']),
    new WorkerAgent('analytics-1', 'Analytics Master', 'Data Science Wizard', ['analytics', 'forecasting']),
    new WorkerAgent('process-1', 'Process Optimizer', 'Efficiency Expert', ['optimization', 'automation'])
  ];

  // Register agents
  agents.forEach(agent => queen.registerAgent(agent));

  console.log('\n' + '='.repeat(60) + '\n');

  // Scenario 1: Pipeline Optimization
  console.log('📋 SCENARIO 1: Pipeline Optimization');
  console.log('The sales pipeline is showing declining conversion rates.');
  
  await queen.makeDecision(
    'Optimize sales pipeline for better conversion',
    {
      conversionRate: 0.15,
      avgDealSize: 25000,
      stuckDeals: 45
    }
  );

  console.log('\n' + '='.repeat(60) + '\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Scenario 2: Lead Quality Crisis
  console.log('📋 SCENARIO 2: Lead Quality Crisis');
  console.log('Marketing qualified leads are not converting well.');
  
  await queen.makeDecision(
    'Improve lead quality and conversion rates',
    {
      mqls: 500,
      sqlConversion: 0.08,
      avgLeadScore: 42
    }
  );

  console.log('\n' + '='.repeat(60) + '\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Scenario 3: Revenue Forecasting
  console.log('📋 SCENARIO 3: Revenue Forecasting');
  console.log('Q4 revenue forecast needed for board meeting.');
  
  await queen.makeDecision(
    'Generate accurate revenue forecast for Q4',
    {
      currentMRR: 1200000,
      growthRate: 0.08,
      churnRate: 0.05
    }
  );

  console.log('\n' + '='.repeat(60) + '\n');

  // Show summary
  console.log('📊 SWARM PERFORMANCE SUMMARY');
  console.log('='.repeat(40));
  console.log(`Total Decisions: ${queen.decisions.length}`);
  console.log(`Active Agents: ${queen.agents.size}`);
  console.log(`Average Confidence: ${(queen.decisions.reduce((sum, d) => sum + d.confidence, 0) / queen.decisions.length * 100).toFixed(0)}%`);
  console.log('\n✅ Demo completed successfully!\n');
}

// Run the demo
runDemo().catch(console.error);