"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueenAgent = void 0;
const events_1 = require("events");
const MajorityEngine_1 = require("../consensus/MajorityEngine");
const SwarmMemory_1 = require("../memory/SwarmMemory");
class QueenAgent extends events_1.EventEmitter {
    config;
    majorityEngine;
    memory;
    activeAgents;
    decisionHistory;
    currentDecisions;
    constructor(config) {
        super();
        this.config = config;
        this.majorityEngine = new MajorityEngine_1.MajorityEngine({
            votingThreshold: config.majorityThreshold,
            votingTimeout: config.decisionTimeout,
            tieBreaker: config.tieBreakerRole ? 'queen' : 'random',
            quorumRequired: 0.5,
            weightedVoting: true
        });
        this.memory = new SwarmMemory_1.SwarmMemory({
            retentionPeriod: config.memoryRetention
        });
        this.activeAgents = new Map();
        this.decisionHistory = [];
        this.currentDecisions = new Map();
        this.initializeEventHandlers();
    }
    async initialize() {
        await this.memory.initialize();
        await this.majorityEngine.initialize();
        const history = await this.memory.getDecisionHistory();
        this.decisionHistory = history;
        await this.analyzeHistoricalPatterns();
        if (this.config.tieBreakerRole) {
            this.majorityEngine.on('majority:tie-break-needed', (data) => {
                this.handleTieBreak(data);
            });
        }
        this.emit('queen:initialized', { swarmId: this.config.swarmId });
    }
    registerAgent(agent) {
        this.activeAgents.set(agent.getId(), agent);
        agent.on('report', (report) => this.handleAgentReport(report));
        agent.on('alert', (alert) => this.handleAgentAlert(alert));
        agent.on('request', (request) => this.handleAgentRequest(request));
        this.emit('queen:agent-registered', { agentId: agent.getId() });
    }
    async makeStrategicDecision(topic, context, urgency = 'medium') {
        const decisionId = this.generateDecisionId();
        const agentReports = await this.gatherAgentReports(topic, context);
        const votingOptions = this.createVotingOptions(agentReports);
        const votingTopic = {
            id: decisionId,
            type: 'decision',
            question: topic,
            options: votingOptions,
            context
        };
        const eligibleVoters = Array.from(this.activeAgents.keys());
        const votingId = await this.majorityEngine.startVoting(votingTopic, eligibleVoters);
        await this.collectAgentVotes(votingId, agentReports);
        const majority = await this.majorityEngine.closeVoting(votingId);
        const decision = await this.formulateDecision(decisionId, 'strategic', majority, agentReports);
        const implementation = await this.createImplementationPlan(decision, agentReports);
        const queenDecision = {
            id: decisionId,
            type: 'strategic',
            decision: decision.content,
            majority,
            implementation,
            timestamp: new Date()
        };
        this.currentDecisions.set(decisionId, queenDecision);
        await this.memory.storeDecision(queenDecision);
        await this.distributeImplementation(implementation);
        this.emit('queen:decision-made', queenDecision);
        return queenDecision;
    }
    async handleEmergency(situation, severity, context) {
        const decisionId = this.generateDecisionId();
        const availableAgents = this.getAvailableAgents();
        const quickReports = await this.gatherQuickReports(availableAgents, situation, context);
        const votingOptions = [
            { id: 'immediate-action', value: 'immediate', description: 'Take immediate action' },
            { id: 'escalate', value: 'escalate', description: 'Escalate to human operators' },
            { id: 'contain', value: 'contain', description: 'Contain and monitor' }
        ];
        const votingTopic = {
            id: decisionId,
            type: 'action',
            question: `Emergency: ${situation}`,
            options: votingOptions,
            context: { severity, ...context }
        };
        const tempEngine = new MajorityEngine_1.MajorityEngine({ votingTimeout: 5000 });
        await tempEngine.initialize();
        const votingId = await tempEngine.startVoting(votingTopic, availableAgents.map(a => a.getId()));
        if (this.config.tieBreakerRole) {
            await tempEngine.castVote(votingId, {
                agentId: this.getId(),
                choice: 'immediate-action',
                weight: 1.5,
                confidence: 0.9,
                reasoning: 'Emergency requires immediate action',
                timestamp: new Date()
            });
        }
        await new Promise(resolve => setTimeout(resolve, 4000));
        const majority = await tempEngine.closeVoting(votingId);
        const decision = {
            content: this.formulateEmergencyResponse(situation, majority),
            rationale: 'Emergency response based on rapid majority vote'
        };
        const implementation = this.createEmergencyPlan(decision, availableAgents);
        const queenDecision = {
            id: decisionId,
            type: 'emergency',
            decision: decision.content,
            majority,
            implementation,
            timestamp: new Date()
        };
        await this.executeEmergencyPlan(implementation);
        this.emit('queen:emergency-handled', queenDecision);
        return queenDecision;
    }
    async monitorSwarmHealth() {
        const agentStatuses = await this.collectAgentStatuses();
        const memoryHealth = await this.memory.getHealthStatus();
        const votingMetrics = this.majorityEngine.getMetrics();
        const health = {
            timestamp: new Date(),
            overallHealth: this.calculateOverallHealth(agentStatuses, memoryHealth),
            agentHealth: agentStatuses,
            memoryHealth,
            votingMetrics,
            activeDecisions: this.currentDecisions.size,
            recommendations: this.generateHealthRecommendations(agentStatuses, memoryHealth)
        };
        this.emit('queen:health-report', health);
        return health;
    }
    async coordinateCollaboration(taskId, requiredCapabilities, complexity) {
        const selectedAgents = this.selectAgentsForTask(requiredCapabilities, complexity);
        const structure = this.defineCollaborationStructure(selectedAgents, complexity);
        const plan = {
            taskId,
            structure,
            agents: selectedAgents,
            communicationProtocol: this.defineCommunicationProtocol(complexity),
            checkpoints: this.defineCheckpoints(complexity),
            conflictResolution: 'queen-mediated'
        };
        await this.initializeCollaboration(plan);
        this.emit('queen:collaboration-started', plan);
        return plan;
    }
    async analyzeHistoricalPatterns() {
        const patterns = await this.memory.analyzeDecisionPatterns(this.decisionHistory);
        for (const pattern of patterns) {
            if (pattern.agentId && pattern.successRate > 0) {
                this.majorityEngine.setAgentWeight(pattern.agentId, Math.min(pattern.successRate, 1.0));
            }
        }
        const successfulStrategies = patterns.filter(p => p.successRate > 0.8);
        this.emit('queen:patterns-learned', {
            totalPatterns: patterns.length,
            successfulPatterns: successfulStrategies.length
        });
    }
    createVotingOptions(reports) {
        const optionsMap = new Map();
        for (const report of reports) {
            const key = JSON.stringify(report.recommendation);
            optionsMap.set(key, (optionsMap.get(key) || 0) + 1);
        }
        const options = Array.from(optionsMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map((entry, index) => ({
            id: `option-${index}`,
            value: JSON.parse(entry[0]),
            description: `Recommended by ${entry[1]} agents`,
            proposedBy: reports.find(r => JSON.stringify(r.recommendation) === entry[0])?.agentId
        }));
        return options;
    }
    async collectAgentVotes(votingId, reports) {
        const votePromises = reports.map(report => {
            const votingStatus = this.majorityEngine.getVotingStatus(votingId);
            if (!votingStatus)
                return;
            const matchingOption = this.createVotingOptions(reports)
                .find(opt => JSON.stringify(opt.value) === JSON.stringify(report.recommendation));
            if (matchingOption) {
                return this.majorityEngine.castVote(votingId, {
                    agentId: report.agentId,
                    choice: matchingOption.id,
                    confidence: report.confidence,
                    reasoning: report.reasoning,
                    timestamp: new Date()
                });
            }
        });
        await Promise.allSettled(votePromises);
    }
    handleTieBreak(data) {
        this.emit('queen:tie-break', {
            votingId: data.votingId,
            options: data.tiedOptions,
            decision: data.tiedOptions[0]
        });
    }
    async gatherAgentReports(topic, context) {
        const reports = [];
        const reportPromises = [];
        for (const [agentId, agent] of this.activeAgents) {
            reportPromises.push(agent.generateReport(topic, context)
                .then(report => ({
                agentId,
                agentType: agent.getType(),
                status: agent.getStatus(),
                recommendation: report.recommendation,
                confidence: report.confidence,
                reasoning: report.reasoning,
                timestamp: new Date()
            })));
        }
        const results = await Promise.allSettled(reportPromises);
        for (const result of results) {
            if (result.status === 'fulfilled') {
                reports.push(result.value);
            }
        }
        return reports;
    }
    async formulateDecision(decisionId, type, majority, reports) {
        const winningOption = majority.winner;
        const votingStats = majority.votingStats;
        const similarDecisions = await this.memory.findSimilarDecisions(type, winningOption.value);
        const decision = {
            content: this.synthesizeDecision(winningOption, votingStats, similarDecisions),
            rationale: this.generateRationale(majority, reports, similarDecisions)
        };
        return decision;
    }
    async createImplementationPlan(decision, reports) {
        const steps = this.decomposeDecision(decision.content);
        const assignments = this.createAgentAssignments(steps, reports);
        const timeline = this.createTimeline(steps, assignments);
        const successCriteria = this.defineSuccessCriteria(decision.content);
        return {
            steps,
            assignments,
            timeline,
            successCriteria
        };
    }
    handleAgentReport(report) {
        this.memory.storeAgentReport(report);
        for (const [decisionId, decision] of this.currentDecisions) {
            if (this.reportAffectsDecision(report, decision)) {
                this.updateDecisionStatus(decisionId, report);
            }
        }
    }
    handleAgentAlert(alert) {
        this.emit('queen:agent-alert', alert);
        if (alert.severity === 'critical') {
            this.handleEmergency(alert.situation, alert.severity, alert.context);
        }
    }
    async handleAgentRequest(request) {
        const response = await this.processAgentRequest(request);
        const agent = this.activeAgents.get(request.agentId);
        if (agent) {
            agent.receiveResponse(response);
        }
    }
    initializeEventHandlers() {
        this.majorityEngine.on('majority:voting-started', (data) => {
            this.emit('queen:voting-started', data);
        });
        this.majorityEngine.on('majority:vote-cast', (data) => {
            this.emit('queen:vote-cast', data);
        });
        this.majorityEngine.on('majority:voting-closed', (result) => {
            this.emit('queen:voting-completed', result);
        });
        this.majorityEngine.on('majority:decision-deferred', (data) => {
            this.emit('queen:decision-deferred', data);
        });
        this.memory.on('memory:pattern-detected', (pattern) => {
            this.emit('queen:pattern-detected', pattern);
        });
    }
    generateDecisionId() {
        return `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    getAvailableAgents() {
        return Array.from(this.activeAgents.values())
            .filter(agent => agent.getStatus() === 'active');
    }
    calculateOverallHealth(agentStatuses, memoryHealth) {
        const healthyAgents = agentStatuses.filter(s => s.health === 'healthy').length;
        const healthPercentage = healthyAgents / agentStatuses.length;
        if (healthPercentage > 0.8 && memoryHealth.status === 'healthy') {
            return 'healthy';
        }
        else if (healthPercentage > 0.5) {
            return 'degraded';
        }
        else {
            return 'critical';
        }
    }
    synthesizeDecision(winningOption, votingStats, similarDecisions) {
        const percentage = votingStats.percentagePerOption.get(winningOption.id) || 0;
        const confidence = percentage > 0.75 ? 'strong' : percentage > 0.5 ? 'moderate' : 'weak';
        return `Based on ${confidence} majority (${(percentage * 100).toFixed(1)}%), ` +
            `the swarm decides to: ${JSON.stringify(winningOption.value)}. ` +
            `This aligns with ${similarDecisions.length} similar past decisions.`;
    }
    generateRationale(majority, reports, similarDecisions) {
        const participation = majority.participation;
        const stats = majority.votingStats;
        return `Decision reached through majority vote. ` +
            `${participation.actualVoters}/${participation.eligibleVoters} agents participated ` +
            `(${(participation.participationRate * 100).toFixed(1)}% turnout). ` +
            `The winning option received ${stats.totalVotes} votes. ` +
            `Historical analysis shows ${similarDecisions.filter(d => d.successful).length} ` +
            `successful similar decisions.`;
    }
    formulateEmergencyResponse(situation, majority) {
        const action = majority.winner.value;
        switch (action) {
            case 'immediate':
                return `EMERGENCY ACTION: Immediate intervention initiated for ${situation}. ` +
                    `All available agents mobilized.`;
            case 'escalate':
                return `EMERGENCY ESCALATION: Human operators notified. ` +
                    `Situation: ${situation}. Awaiting human intervention.`;
            case 'contain':
                return `EMERGENCY CONTAINMENT: Monitoring and containing ${situation}. ` +
                    `Automated safeguards activated.`;
            default:
                return `EMERGENCY RESPONSE: Default action taken for ${situation}.`;
        }
    }
    async gatherQuickReports(agents, situation, context) {
        const reports = [];
        const timeout = 3000;
        const reportPromises = agents.map(agent => Promise.race([
            agent.generateReport(situation, context),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
        ]).then(report => ({
            agentId: agent.getId(),
            agentType: agent.getType(),
            status: agent.getStatus(),
            recommendation: report.recommendation,
            confidence: report.confidence,
            reasoning: report.reasoning,
            timestamp: new Date()
        })).catch(() => null));
        const results = await Promise.all(reportPromises);
        return results.filter(r => r !== null);
    }
    createEmergencyPlan(decision, agents) {
        return {
            steps: [{
                    id: 'emergency-1',
                    action: decision.content,
                    dependencies: [],
                    assignedAgents: agents.map(a => a.getId()),
                    estimatedDuration: 300000
                }],
            assignments: agents.map(a => ({
                agentId: a.getId(),
                taskIds: ['emergency-1'],
                priority: 'critical',
                deadline: new Date(Date.now() + 300000)
            })),
            timeline: {
                start: new Date(),
                end: new Date(Date.now() + 300000),
                milestones: []
            },
            successCriteria: [{
                    metric: 'situation-resolved',
                    target: 1,
                    operator: '='
                }]
        };
    }
    async executeEmergencyPlan(plan) {
        this.emit('queen:emergency-execution', { plan });
    }
    async distributeImplementation(plan) {
        for (const assignment of plan.assignments) {
            const agent = this.activeAgents.get(assignment.agentId);
            if (agent) {
                this.emit('queen:task-assigned', {
                    agentId: assignment.agentId,
                    tasks: assignment.taskIds,
                    priority: assignment.priority
                });
            }
        }
    }
    decomposeDecision(decisionContent) {
        return [{
                id: 'step-1',
                action: decisionContent,
                dependencies: [],
                assignedAgents: [],
                estimatedDuration: 3600000
            }];
    }
    createAgentAssignments(steps, reports) {
        const assignments = [];
        const sortedReports = reports.sort((a, b) => b.confidence - a.confidence);
        for (let i = 0; i < steps.length; i++) {
            const agent = sortedReports[i % sortedReports.length];
            assignments.push({
                agentId: agent.agentId,
                taskIds: [steps[i].id],
                priority: 'high',
                deadline: new Date(Date.now() + steps[i].estimatedDuration)
            });
        }
        return assignments;
    }
    createTimeline(steps, assignments) {
        const duration = steps.reduce((sum, step) => sum + step.estimatedDuration, 0);
        return {
            start: new Date(),
            end: new Date(Date.now() + duration),
            milestones: steps.map((step, index) => ({
                id: `milestone-${index}`,
                name: `Complete ${step.action}`,
                targetDate: new Date(Date.now() + step.estimatedDuration),
                criteria: [`Step ${step.id} completed`]
            }))
        };
    }
    defineSuccessCriteria(decisionContent) {
        return [{
                metric: 'decision-implemented',
                target: 1,
                operator: '='
            }, {
                metric: 'error-rate',
                target: 0.1,
                operator: '<'
            }];
    }
    async collectAgentStatuses() {
        return Array.from(this.activeAgents.values()).map(agent => ({
            agentId: agent.getId(),
            type: agent.getType(),
            status: agent.getStatus(),
            health: 'healthy'
        }));
    }
    generateHealthRecommendations(agentStatuses, memoryHealth) {
        const recommendations = [];
        const unhealthyAgents = agentStatuses.filter(s => s.health !== 'healthy');
        if (unhealthyAgents.length > 0) {
            recommendations.push(`${unhealthyAgents.length} agents need attention`);
        }
        if (memoryHealth.usage > 0.8) {
            recommendations.push('Memory usage high - consider cleanup');
        }
        return recommendations;
    }
    selectAgentsForTask(capabilities, complexity) {
        const selected = [];
        for (const [_, agent] of this.activeAgents) {
            selected.push(agent);
            if (selected.length >= (complexity === 'high' ? 5 : 3))
                break;
        }
        return selected;
    }
    defineCollaborationStructure(agents, complexity) {
        return {
            type: complexity === 'high' ? 'hierarchical' : 'peer-to-peer',
            roles: agents.map(a => ({
                agentId: a.getId(),
                role: a.getType()
            }))
        };
    }
    defineCommunicationProtocol(complexity) {
        return {
            frequency: complexity === 'high' ? 'continuous' : 'periodic',
            channels: ['direct', 'broadcast'],
            format: 'structured'
        };
    }
    defineCheckpoints(complexity) {
        const count = complexity === 'high' ? 5 : 3;
        return Array.from({ length: count }, (_, i) => ({
            id: `checkpoint-${i}`,
            progress: ((i + 1) / count) * 100,
            criteria: [`Milestone ${i + 1} completed`]
        }));
    }
    async initializeCollaboration(plan) {
        this.emit('queen:collaboration-initialized', plan);
    }
    reportAffectsDecision(report, decision) {
        return report.context?.decisionId === decision.id;
    }
    updateDecisionStatus(decisionId, report) {
        const decision = this.currentDecisions.get(decisionId);
        if (decision) {
            this.emit('queen:decision-updated', {
                decisionId,
                update: report
            });
        }
    }
    async processAgentRequest(request) {
        return {
            approved: true,
            response: 'Request processed by Queen',
            timestamp: new Date()
        };
    }
    getId() {
        return `queen_${this.config.swarmId}`;
    }
    getType() {
        return 'queen';
    }
    getStatus() {
        return 'active';
    }
    async generateReport(topic, context) {
        return {
            recommendation: 'Queen oversight report',
            confidence: 1.0,
            reasoning: 'Central coordination analysis'
        };
    }
    receiveResponse(response) {
    }
}
exports.QueenAgent = QueenAgent;
//# sourceMappingURL=QueenAgent.js.map