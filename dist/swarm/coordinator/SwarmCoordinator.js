"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwarmCoordinator = void 0;
const events_1 = require("events");
const SwarmMemory_1 = require("../memory/SwarmMemory");
class SwarmCoordinator extends events_1.EventEmitter {
    swarms;
    globalMemory;
    messageQueue;
    resourcePool;
    strategy;
    performanceMonitor;
    constructor() {
        super();
        this.swarms = new Map();
        this.messageQueue = [];
        this.resourcePool = new ResourcePool();
        this.strategy = {
            type: 'hierarchical',
            loadBalancing: 'capability-based',
            failover: 'automatic',
            communication: 'mixed'
        };
        this.performanceMonitor = new PerformanceMonitor();
        this.globalMemory = new SwarmMemory_1.SwarmMemory({
            retentionPeriod: 30 * 24 * 60 * 60 * 1000,
            maxEntries: 100000,
            compressionEnabled: true,
            patternDetectionEnabled: true
        });
    }
    async initialize() {
        await this.globalMemory.initialize();
        this.startMessageProcessor();
        this.startHealthMonitor();
        this.startLoadBalancer();
        this.emit('coordinator:initialized');
    }
    async registerSwarm(id, name, purpose, queen) {
        if (this.swarms.has(id)) {
            throw new Error(`Swarm ${id} already registered`);
        }
        const swarmConfig = {
            id,
            name,
            purpose,
            queen,
            agents: new Map(),
            status: {
                state: 'initializing',
                health: 'healthy',
                lastActivity: new Date(),
                currentTasks: 0
            },
            metrics: {
                decisionsPerHour: 0,
                avgResponseTime: 0,
                successRate: 0,
                resourceUtilization: 0,
                agentEfficiency: new Map()
            }
        };
        this.swarms.set(id, swarmConfig);
        this.setupSwarmHandlers(swarmConfig);
        await this.allocateResources(id);
        swarmConfig.status.state = 'active';
        this.emit('coordinator:swarm-registered', { swarmId: id, name, purpose });
    }
    async routeTask(task) {
        const taskAnalysis = this.analyzeTask(task);
        const candidateSwarms = this.findCapableSwarms(taskAnalysis);
        if (candidateSwarms.length === 0) {
            throw new Error('No capable swarm found for task');
        }
        const selectedSwarm = this.selectSwarm(candidateSwarms, taskAnalysis);
        await this.sendToSwarm(selectedSwarm.id, {
            type: 'task',
            task,
            priority: taskAnalysis.priority
        });
        this.emit('coordinator:task-routed', {
            taskId: task.id,
            swarmId: selectedSwarm.id,
            reason: taskAnalysis.requirements
        });
        return selectedSwarm.id;
    }
    async coordinateSwarms(coordination) {
        const coordinationId = this.generateCoordinationId();
        switch (coordination.type) {
            case 'collaboration':
                return await this.facilitateCollaboration(coordinationId, coordination);
            case 'delegation':
                return await this.facilitateDelegation(coordinationId, coordination);
            case 'consultation':
                return await this.facilitateConsultation(coordinationId, coordination);
            default:
                throw new Error(`Unknown coordination type: ${coordination.type}`);
        }
    }
    async handleGlobalEmergency(emergency) {
        this.emit('coordinator:emergency-declared', emergency);
        await this.pauseNonCriticalOperations();
        await this.reallocateForEmergency(emergency);
        const responseSwarms = this.selectEmergencyResponseSwarms(emergency);
        const responses = await Promise.all(responseSwarms.map(swarm => swarm.queen.handleEmergency(emergency.type, emergency.severity, emergency.context)));
        const coordinatedResponse = this.synthesizeEmergencyResponses(responses);
        this.emit('coordinator:emergency-response', coordinatedResponse);
    }
    getNetworkStatus() {
        const activeSwarms = Array.from(this.swarms.values())
            .filter(s => s.status.state === 'active').length;
        const totalAgents = Array.from(this.swarms.values())
            .reduce((sum, swarm) => sum + swarm.agents.size, 0);
        const avgHealth = this.calculateAverageHealth();
        return {
            totalSwarms: this.swarms.size,
            activeSwarms,
            totalAgents,
            networkHealth: avgHealth,
            messageQueueSize: this.messageQueue.length,
            resourceUtilization: this.resourcePool.getUtilization(),
            coordinationStrategy: this.strategy
        };
    }
    async optimizeNetwork() {
        const currentPerformance = this.performanceMonitor.getCurrentMetrics();
        const bottlenecks = this.identifyBottlenecks();
        const recommendations = this.generateOptimizationRecommendations(currentPerformance, bottlenecks);
        const applied = [];
        for (const rec of recommendations) {
            if (rec.autoApply && rec.risk === 'low') {
                await this.applyOptimization(rec);
                applied.push(rec.id);
            }
        }
        return {
            currentPerformance,
            bottlenecks,
            recommendations,
            appliedOptimizations: applied
        };
    }
    setupSwarmHandlers(swarm) {
        swarm.queen.on('queen:decision-made', (decision) => {
            this.handleSwarmDecision(swarm.id, decision);
        });
        swarm.queen.on('queen:emergency-handled', (emergency) => {
            this.handleSwarmEmergency(swarm.id, emergency);
        });
        swarm.queen.on('queen:health-report', (health) => {
            this.updateSwarmHealth(swarm.id, health);
        });
    }
    startMessageProcessor() {
        setInterval(() => {
            this.processMessageQueue();
        }, 100);
    }
    async processMessageQueue() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            try {
                await this.processMessage(message);
            }
            catch (error) {
                this.emit('coordinator:message-error', { message, error });
            }
        }
    }
    async processMessage(message) {
        const targetSwarm = this.swarms.get(message.to);
        if (!targetSwarm) {
            throw new Error(`Target swarm not found: ${message.to}`);
        }
        switch (message.type) {
            case 'request':
                await this.handleSwarmRequest(targetSwarm, message);
                break;
            case 'response':
                await this.handleSwarmResponse(targetSwarm, message);
                break;
            case 'broadcast':
                await this.handleBroadcast(message);
                break;
            case 'coordination':
                await this.handleCoordinationMessage(message);
                break;
        }
    }
    startHealthMonitor() {
        setInterval(() => {
            this.checkSwarmHealth();
        }, 30000);
    }
    async checkSwarmHealth() {
        for (const [swarmId, swarm] of this.swarms) {
            try {
                const health = await swarm.queen.monitorSwarmHealth();
                this.updateSwarmHealth(swarmId, health);
                if (health.overallHealth === 'degraded' || health.overallHealth === 'critical') {
                    await this.handleDegradedSwarm(swarmId, health);
                }
            }
            catch (error) {
                this.handleSwarmError(swarmId, error);
            }
        }
    }
    startLoadBalancer() {
        setInterval(() => {
            this.balanceLoad();
        }, 60000);
    }
    async balanceLoad() {
        const loads = this.calculateSwarmLoads();
        const imbalance = this.detectLoadImbalance(loads);
        if (imbalance.severity > 0.3) {
            await this.rebalanceSwarms(imbalance);
        }
    }
    async facilitateCollaboration(coordinationId, coordination) {
        const context = {
            id: coordinationId,
            topic: coordination.topic,
            participants: coordination.participants,
            sharedMemory: new Map()
        };
        const notifications = coordination.participants.map(swarmId => this.sendToSwarm(swarmId, {
            type: 'collaboration-invite',
            coordinationId,
            context
        }));
        await Promise.all(notifications);
        const decisions = await this.collectSwarmDecisions(coordination.participants, coordination.topic, coordination.context);
        const result = this.synthesizeCollaborativeDecision(decisions);
        await this.broadcastToSwarms(coordination.participants, {
            type: 'collaboration-result',
            coordinationId,
            result
        });
        return result;
    }
    analyzeTask(task) {
        return {
            type: task.type || 'general',
            complexity: this.assessTaskComplexity(task),
            requirements: this.extractTaskRequirements(task),
            priority: task.priority || 'medium',
            estimatedDuration: this.estimateTaskDuration(task)
        };
    }
    findCapableSwarms(taskAnalysis) {
        const capable = [];
        for (const swarm of this.swarms.values()) {
            if (this.isSwarmCapable(swarm, taskAnalysis)) {
                capable.push(swarm);
            }
        }
        return capable;
    }
    selectSwarm(candidates, taskAnalysis) {
        const scored = candidates.map(swarm => ({
            swarm,
            score: this.scoreSwarmForTask(swarm, taskAnalysis)
        }));
        scored.sort((a, b) => b.score - a.score);
        return scored[0].swarm;
    }
    scoreSwarmForTask(swarm, taskAnalysis) {
        let score = 0;
        score += (1 - swarm.status.currentTasks / 10) * 0.3;
        score += swarm.status.health === 'healthy' ? 0.3 : 0.1;
        score += swarm.metrics.successRate * 0.2;
        if (swarm.purpose.includes(taskAnalysis.type)) {
            score += 0.2;
        }
        return score;
    }
    async sendToSwarm(swarmId, content) {
        const message = {
            id: this.generateMessageId(),
            from: 'coordinator',
            to: swarmId,
            type: 'request',
            priority: content.priority || 'medium',
            content,
            timestamp: new Date()
        };
        this.messageQueue.push(message);
    }
    calculateAverageHealth() {
        const healthScores = Array.from(this.swarms.values()).map(swarm => {
            switch (swarm.status.health) {
                case 'healthy': return 1;
                case 'degraded': return 0.5;
                case 'critical': return 0;
                default: return 0.5;
            }
        });
        const avg = healthScores.reduce((sum, score) => sum + score, 0) / healthScores.length;
        if (avg > 0.8)
            return 'healthy';
        if (avg > 0.5)
            return 'degraded';
        return 'critical';
    }
    handleSwarmDecision(swarmId, decision) {
        this.globalMemory.store({
            id: `decision_${swarmId}_${decision.id}`,
            type: 'decision',
            content: decision,
            timestamp: new Date(),
            relevance: 0.8,
            tags: [swarmId, decision.type, 'decision']
        });
        const swarm = this.swarms.get(swarmId);
        if (swarm) {
            swarm.metrics.decisionsPerHour++;
            swarm.status.lastActivity = new Date();
        }
    }
    updateSwarmHealth(swarmId, health) {
        const swarm = this.swarms.get(swarmId);
        if (swarm) {
            swarm.status.health = health.overallHealth;
            health.agentHealth.forEach((agent) => {
                swarm.metrics.agentEfficiency.set(agent.agentId, agent.efficiency || 0.5);
            });
        }
    }
    async handleDegradedSwarm(swarmId, health) {
        this.emit('coordinator:swarm-degraded', { swarmId, health });
        const swarm = this.swarms.get(swarmId);
        if (swarm && this.strategy.failover === 'automatic') {
            swarm.status.state = 'busy';
            await this.redistributeTasks(swarmId);
            setTimeout(() => {
                this.checkSwarmRecovery(swarmId);
            }, 300000);
        }
    }
    async redistributeTasks(fromSwarmId) {
        this.emit('coordinator:redistributing-tasks', { fromSwarmId });
    }
    async checkSwarmRecovery(swarmId) {
        const swarm = this.swarms.get(swarmId);
        if (swarm) {
            const health = await swarm.queen.monitorSwarmHealth();
            if (health.overallHealth === 'healthy') {
                swarm.status.state = 'active';
                this.emit('coordinator:swarm-recovered', { swarmId });
            }
        }
    }
    identifyBottlenecks() {
        const bottlenecks = [];
        if (this.messageQueue.length > 100) {
            bottlenecks.push({
                type: 'message-queue',
                severity: 'high',
                details: `Queue size: ${this.messageQueue.length}`
            });
        }
        for (const [swarmId, swarm] of this.swarms) {
            if (swarm.metrics.resourceUtilization > 0.8) {
                bottlenecks.push({
                    type: 'swarm-overload',
                    severity: 'medium',
                    swarmId,
                    utilization: swarm.metrics.resourceUtilization
                });
            }
        }
        return bottlenecks;
    }
    generateOptimizationRecommendations(performance, bottlenecks) {
        const recommendations = [];
        if (bottlenecks.some(b => b.type === 'swarm-overload')) {
            recommendations.push({
                id: 'scale-swarms',
                type: 'scaling',
                action: 'Add more agents to overloaded swarms',
                impact: 'high',
                risk: 'low',
                autoApply: true
            });
        }
        if (bottlenecks.some(b => b.type === 'message-queue')) {
            recommendations.push({
                id: 'optimize-messaging',
                type: 'communication',
                action: 'Batch messages and prioritize critical',
                impact: 'medium',
                risk: 'low',
                autoApply: true
            });
        }
        return recommendations;
    }
    async applyOptimization(recommendation) {
        switch (recommendation.id) {
            case 'scale-swarms':
                await this.scaleOverloadedSwarms();
                break;
            case 'optimize-messaging':
                await this.optimizeMessaging();
                break;
        }
    }
    async scaleOverloadedSwarms() {
        for (const [swarmId, swarm] of this.swarms) {
            if (swarm.metrics.resourceUtilization > 0.8) {
                this.emit('coordinator:scaling-swarm', { swarmId });
            }
        }
    }
    async optimizeMessaging() {
        this.messageQueue.sort((a, b) => {
            const priorityMap = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
            return priorityMap[b.priority] - priorityMap[a.priority];
        });
    }
    generateCoordinationId() {
        return `coord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    assessTaskComplexity(task) {
        if (task.steps && task.steps.length > 10)
            return 'high';
        if (task.dependencies && task.dependencies.length > 3)
            return 'high';
        if (task.priority === 'critical')
            return 'high';
        return 'medium';
    }
    extractTaskRequirements(task) {
        const requirements = [];
        if (task.type)
            requirements.push(task.type);
        if (task.capabilities)
            requirements.push(...task.capabilities);
        return requirements;
    }
    estimateTaskDuration(task) {
        const complexity = this.assessTaskComplexity(task);
        const baseTime = { 'low': 10, 'medium': 30, 'high': 60 };
        return baseTime[complexity];
    }
    isSwarmCapable(swarm, taskAnalysis) {
        if (swarm.status.state !== 'active')
            return false;
        if (swarm.status.health === 'critical')
            return false;
        if (taskAnalysis.type && swarm.purpose.toLowerCase().includes(taskAnalysis.type)) {
            return true;
        }
        if (swarm.purpose.includes('general'))
            return true;
        return false;
    }
    handleSwarmEmergency(swarmId, emergency) {
        this.emit('coordinator:swarm-emergency', { swarmId, emergency });
    }
    handleSwarmRequest(swarm, message) {
        return Promise.resolve();
    }
    handleSwarmResponse(swarm, message) {
        return Promise.resolve();
    }
    handleBroadcast(message) {
        const broadcasts = Array.from(this.swarms.keys())
            .filter(id => id !== message.from)
            .map(id => this.sendToSwarm(id, message.content));
        return Promise.all(broadcasts).then(() => { });
    }
    handleCoordinationMessage(message) {
        return Promise.resolve();
    }
    pauseNonCriticalOperations() {
        return Promise.resolve();
    }
    reallocateForEmergency(emergency) {
        return Promise.resolve();
    }
    selectEmergencyResponseSwarms(emergency) {
        return Array.from(this.swarms.values())
            .filter(swarm => swarm.status.health === 'healthy')
            .slice(0, 3);
    }
    synthesizeEmergencyResponses(responses) {
        return {
            actions: responses.flatMap(r => r.actions || []),
            priority: 'critical',
            coordinatedResponse: true
        };
    }
    calculateSwarmLoads() {
        const loads = new Map();
        for (const [id, swarm] of this.swarms) {
            loads.set(id, swarm.status.currentTasks / 10);
        }
        return loads;
    }
    detectLoadImbalance(loads) {
        const values = Array.from(loads.values());
        const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
        return {
            severity: Math.sqrt(variance),
            overloaded: Array.from(loads.entries()).filter(([_, load]) => load > avg * 1.5),
            underutilized: Array.from(loads.entries()).filter(([_, load]) => load < avg * 0.5)
        };
    }
    async rebalanceSwarms(imbalance) {
        this.emit('coordinator:rebalancing', imbalance);
    }
    async collectSwarmDecisions(participants, topic, context) {
        const decisions = await Promise.all(participants.map(swarmId => {
            const swarm = this.swarms.get(swarmId);
            if (swarm) {
                return swarm.queen.makeStrategicDecision(topic, context);
            }
            return null;
        }));
        return decisions.filter(d => d !== null);
    }
    synthesizeCollaborativeDecision(decisions) {
        return {
            synthesized: true,
            decisions: decisions.map(d => ({
                swarmId: d.swarmId,
                decision: d.decision,
                confidence: d.confidence
            })),
            finalDecision: 'Collaborative decision based on multiple swarm inputs'
        };
    }
    broadcastToSwarms(swarmIds, content) {
        const broadcasts = swarmIds.map(id => this.sendToSwarm(id, content));
        return Promise.all(broadcasts).then(() => { });
    }
    allocateResources(swarmId) {
        return Promise.resolve();
    }
    handleSwarmError(swarmId, error) {
        const swarm = this.swarms.get(swarmId);
        if (swarm) {
            swarm.status.state = 'error';
            swarm.status.health = 'critical';
        }
        this.emit('coordinator:swarm-error', { swarmId, error });
    }
    facilitateDelegation(coordinationId, coordination) {
        return Promise.resolve({ delegated: true });
    }
    facilitateConsultation(coordinationId, coordination) {
        return Promise.resolve({ consulted: true });
    }
}
exports.SwarmCoordinator = SwarmCoordinator;
class ResourcePool {
    totalAgents = 100;
    allocatedAgents = 0;
    getUtilization() {
        return this.allocatedAgents / this.totalAgents;
    }
    allocate(amount) {
        if (this.allocatedAgents + amount <= this.totalAgents) {
            this.allocatedAgents += amount;
            return true;
        }
        return false;
    }
    release(amount) {
        this.allocatedAgents = Math.max(0, this.allocatedAgents - amount);
    }
}
class PerformanceMonitor {
    metrics = new Map();
    getCurrentMetrics() {
        return {
            timestamp: new Date(),
            metrics: Object.fromEntries(this.metrics)
        };
    }
    recordMetric(name, value) {
        this.metrics.set(name, value);
    }
}
//# sourceMappingURL=SwarmCoordinator.js.map