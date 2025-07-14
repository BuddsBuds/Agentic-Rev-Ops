"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwarmDemo = void 0;
const QueenAgent_1 = require("../queen/QueenAgent");
const CRMAgent_1 = require("../agents/CRMAgent");
const MarketingAgent_1 = require("../agents/MarketingAgent");
const AnalyticsAgent_1 = require("../agents/AnalyticsAgent");
const events_1 = require("events");
class SwarmDemo extends events_1.EventEmitter {
    queen;
    crmAgent;
    marketingAgent;
    analyticsAgent;
    swarmId;
    constructor() {
        super();
        this.swarmId = `swarm_demo_${Date.now()}`;
    }
    async initialize() {
        console.log('🐝 Initializing Revenue Operations Swarm...\n');
        this.queen = new QueenAgent_1.QueenAgent({
            swarmId: this.swarmId,
            majorityThreshold: 0.5,
            decisionTimeout: 30000,
            memoryRetention: 7 * 24 * 60 * 60 * 1000,
            tieBreakerRole: true
        });
        await this.queen.initialize();
        console.log('👑 Queen Agent initialized');
        this.crmAgent = new CRMAgent_1.CRMAgent({
            id: `crm_agent_${this.swarmId}`,
            name: 'CRM Specialist',
            capabilities: [],
            votingWeight: 1.2,
            learningEnabled: true
        });
        this.marketingAgent = new MarketingAgent_1.MarketingAgent({
            id: `marketing_agent_${this.swarmId}`,
            name: 'Marketing Automation Expert',
            capabilities: [],
            votingWeight: 1.1,
            learningEnabled: true
        });
        this.analyticsAgent = new AnalyticsAgent_1.AnalyticsAgent({
            id: `analytics_agent_${this.swarmId}`,
            name: 'Data Analytics Master',
            capabilities: [],
            votingWeight: 1.3,
            learningEnabled: true
        });
        await Promise.all([
            this.crmAgent.initialize(),
            this.marketingAgent.initialize(),
            this.analyticsAgent.initialize()
        ]);
        console.log('🤖 Worker agents initialized:');
        console.log('  - CRM Specialist');
        console.log('  - Marketing Automation Expert');
        console.log('  - Data Analytics Master\n');
        this.queen.registerAgent(this.crmAgent);
        this.queen.registerAgent(this.marketingAgent);
        this.queen.registerAgent(this.analyticsAgent);
        this.setupEventListeners();
        console.log('✅ Swarm fully initialized and ready!\n');
    }
    async runDemo() {
        console.log('🚀 Starting RevOps Swarm Demo\n');
        console.log('='.repeat(60) + '\n');
        const scenarios = [
            {
                name: 'Pipeline Optimization',
                description: 'Analyze and optimize the sales pipeline for better conversion',
                topic: 'Sales pipeline showing declining conversion rates',
                context: {
                    stageConversion: {
                        lead: 0.5,
                        qualification: 0.25,
                        proposal: 0.4,
                        negotiation: 0.6,
                        closed: 0.3
                    },
                    avgStageTime: {
                        lead: 5,
                        qualification: 10,
                        proposal: 15,
                        negotiation: 35,
                        closed: 5
                    },
                    stuckDeals: 45,
                    totalDeals: 150,
                    avgDealSize: 25000
                },
                expectedOutcome: 'Identify bottlenecks and recommend automation'
            },
            {
                name: 'Lead Quality Crisis',
                description: 'Address declining lead quality and poor conversion',
                topic: 'Lead quality deteriorating with low MQL conversion',
                context: {
                    leads: [
                        { email: 'lead1@example.com', company: 'TechCorp', score: 45 },
                        { email: 'lead2@example.com', score: 30 },
                        { email: 'lead3@example.com', company: 'StartupInc', phone: '555-0123', score: 60 }
                    ],
                    leadToOppRate: 0.08,
                    avgLeadScore: 42,
                    marketingSpend: 50000,
                    leadCost: 150
                },
                expectedOutcome: 'Implement lead scoring and nurturing strategy'
            },
            {
                name: 'Revenue Forecasting',
                description: 'Predict revenue and identify growth opportunities',
                topic: 'Q4 revenue forecast and risk assessment needed',
                context: {
                    revenueData: {
                        mrr: 1200000,
                        previousMRR: 1100000,
                        churnedMRR: 60000,
                        totalMRR: 1200000,
                        newCustomers: 25,
                        salesCost: 150000,
                        marketingCost: 100000
                    },
                    accounts: [
                        { name: 'Enterprise A', mrr: 50000, usageTrend: 'declining', daysToRenewal: 45 },
                        { name: 'Enterprise B', mrr: 30000, usageTrend: 'stable', daysToRenewal: 120 },
                        { name: 'Mid-Market C', mrr: 15000, usageTrend: 'growing', daysToRenewal: 200 }
                    ],
                    timeSeriesData: this.generateTimeSeriesData()
                },
                expectedOutcome: 'Forecast revenue and identify at-risk accounts'
            },
            {
                name: 'Emergency Response',
                description: 'Handle critical situation with major account at risk',
                topic: 'Major enterprise account showing churn signals',
                context: {
                    account: 'Enterprise Alpha',
                    mrr: 100000,
                    signals: ['Usage down 40%', 'No executive engagement', 'Support tickets spike', 'Competitor evaluation'],
                    severity: 'critical',
                    daysToRenewal: 60
                },
                expectedOutcome: 'Immediate intervention plan to save account'
            }
        ];
        for (const scenario of scenarios) {
            await this.runScenario(scenario);
            console.log('\n' + '='.repeat(60) + '\n');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        await this.showSwarmHealth();
    }
    async runScenario(scenario) {
        console.log(`📋 SCENARIO: ${scenario.name}`);
        console.log(`📝 ${scenario.description}`);
        console.log(`🎯 Expected: ${scenario.expectedOutcome}\n`);
        console.log('🔄 Queen is gathering input from agents...\n');
        let decision;
        if (scenario.name === 'Emergency Response') {
            decision = await this.queen.handleEmergency(scenario.topic, 'critical', scenario.context);
        }
        else {
            decision = await this.queen.makeStrategicDecision(scenario.topic, scenario.context);
        }
        console.log('\n📊 SWARM DECISION:');
        console.log('-'.repeat(40));
        console.log(`Decision: ${decision.decision}`);
        console.log(`\nVoting Results:`);
        console.log(`  - Participation: ${(decision.majority.participation.participationRate * 100).toFixed(1)}%`);
        console.log(`  - Winner: ${decision.majority.winner.value}`);
        console.log(`  - Legitimacy: ${decision.majority.legitimacy}`);
        console.log(`\nImplementation Plan:`);
        console.log(`  - Steps: ${decision.implementation.steps.length}`);
        console.log(`  - Timeline: ${decision.implementation.timeline.start.toLocaleDateString()} - ${decision.implementation.timeline.end.toLocaleDateString()}`);
        console.log(`  - Assigned Agents: ${decision.implementation.assignments.length}`);
        console.log(`\nKey Actions:`);
        decision.implementation.steps.slice(0, 3).forEach((step, index) => {
            console.log(`  ${index + 1}. ${step.action}`);
        });
    }
    async showSwarmHealth() {
        console.log('🏥 SWARM HEALTH REPORT');
        console.log('='.repeat(40));
        const health = await this.queen.monitorSwarmHealth();
        console.log(`Overall Health: ${health.overallHealth.toUpperCase()}`);
        console.log(`Active Decisions: ${health.activeDecisions}`);
        console.log(`\nAgent Status:`);
        health.agentHealth.forEach(agent => {
            console.log(`  - ${agent.type}: ${agent.status} (${agent.health})`);
        });
        console.log(`\nVoting Metrics:`);
        console.log(`  - Total Votings: ${health.votingMetrics.totalVotings}`);
        console.log(`  - Success Rate: ${(health.votingMetrics.successRate * 100).toFixed(1)}%`);
        console.log(`  - Avg Participation: ${(health.votingMetrics.avgParticipation * 100).toFixed(1)}%`);
        if (health.recommendations.length > 0) {
            console.log(`\nRecommendations:`);
            health.recommendations.forEach(rec => {
                console.log(`  - ${rec}`);
            });
        }
    }
    setupEventListeners() {
        this.queen.on('queen:voting-started', (data) => {
            console.log(`🗳️  Voting started: ${data.topic.question}`);
        });
        this.queen.on('queen:voting-completed', (result) => {
            console.log(`✅ Voting completed: ${result.winner.description}`);
        });
        this.queen.on('queen:decision-made', (decision) => {
            this.emit('demo:decision', decision);
        });
        this.queen.on('queen:emergency-handled', (decision) => {
            console.log(`🚨 EMERGENCY HANDLED: ${decision.decision}`);
        });
        const agents = [this.crmAgent, this.marketingAgent, this.analyticsAgent];
        agents.forEach(agent => {
            agent.on('agent:report-generated', (data) => {
                console.log(`  📊 ${agent.getType()} generated report (confidence: ${(data.confidence * 100).toFixed(0)}%)`);
            });
            agent.on('agent:error', (error) => {
                console.error(`  ❌ ${agent.getType()} error: ${error.error}`);
            });
        });
    }
    generateTimeSeriesData() {
        const data = [];
        const baseValue = 100000;
        for (let i = 30; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const variation = Math.sin(i / 5) * 10000 + Math.random() * 5000;
            const trend = i * 1000;
            data.push({
                timestamp: date.toISOString(),
                value: baseValue + variation + trend
            });
        }
        return data;
    }
    async shutdown() {
        console.log('\n🛑 Shutting down swarm...');
        console.log('✅ Swarm shutdown complete');
    }
}
exports.SwarmDemo = SwarmDemo;
if (require.main === module) {
    const demo = new SwarmDemo();
    (async () => {
        try {
            await demo.initialize();
            await demo.runDemo();
            await demo.shutdown();
        }
        catch (error) {
            console.error('Demo error:', error);
            process.exit(1);
        }
    })();
}
//# sourceMappingURL=SwarmDemo.js.map