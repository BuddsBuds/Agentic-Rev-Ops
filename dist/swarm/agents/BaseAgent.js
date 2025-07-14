"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAgent = void 0;
const events_1 = require("events");
class BaseAgent extends events_1.EventEmitter {
    config;
    state;
    capabilities;
    learningHistory;
    queenConnection;
    constructor(config) {
        super();
        this.config = config;
        this.state = {
            status: 'idle',
            taskQueue: [],
            performance: {
                tasksCompleted: 0,
                tasksTotal: 0,
                successRate: 0,
                avgResponseTime: 0,
                avgConfidence: 0,
                specialtyScores: new Map()
            },
            lastActivity: new Date()
        };
        this.capabilities = new Map();
        this.learningHistory = [];
        this.initializeCapabilities();
    }
    async initialize() {
        for (const cap of this.config.capabilities) {
            this.capabilities.set(cap, {
                name: cap,
                proficiency: 0.7,
                experience: 0
            });
        }
        this.state.status = 'active';
        this.emit('agent:initialized', { agentId: this.getId() });
    }
    async generateReport(topic, context) {
        this.state.lastActivity = new Date();
        const startTime = Date.now();
        try {
            const relevance = this.calculateTopicRelevance(topic, context);
            const analysis = await this.performAnalysis(topic, context);
            const confidence = this.calculateConfidence(relevance, analysis);
            const recommendation = await this.formulateRecommendation(topic, context, analysis);
            const report = {
                recommendation,
                confidence,
                reasoning: this.generateReasoning(analysis, confidence)
            };
            this.updatePerformanceMetrics(Date.now() - startTime, confidence);
            this.emit('agent:report-generated', {
                agentId: this.getId(),
                topic,
                confidence
            });
            return report;
        }
        catch (error) {
            this.handleError(error);
            return {
                recommendation: null,
                confidence: 0,
                reasoning: `Error generating report: ${error}`
            };
        }
    }
    receiveResponse(response) {
        this.emit('agent:response-received', {
            agentId: this.getId(),
            response
        });
        if (response.type === 'task-assignment') {
            this.handleTaskAssignment(response);
        }
        else if (response.type === 'feedback') {
            this.handleFeedback(response);
        }
        else if (response.type === 'collaboration-request') {
            this.handleCollaborationRequest(response);
        }
    }
    async processTask(taskId, task) {
        this.state.status = 'busy';
        this.state.currentTask = taskId;
        const startTime = Date.now();
        try {
            const output = await this.executeTask(task);
            const result = {
                taskId,
                agentId: this.getId(),
                status: 'success',
                output,
                metrics: {
                    duration: Date.now() - startTime,
                    tokensUsed: 0,
                    accuracy: this.evaluateAccuracy(output, task),
                    efficiency: this.evaluateEfficiency(Date.now() - startTime, task)
                }
            };
            if (this.config.learningEnabled) {
                await this.learnFromTask(result);
            }
            this.state.status = 'active';
            this.state.currentTask = undefined;
            return result;
        }
        catch (error) {
            this.state.status = 'error';
            return {
                taskId,
                agentId: this.getId(),
                status: 'failure',
                output: { error: error instanceof Error ? error.message : String(error) },
                metrics: {
                    duration: Date.now() - startTime,
                    tokensUsed: 0
                }
            };
        }
    }
    calculateTopicRelevance(topic, context) {
        let relevance = 0;
        let capCount = 0;
        for (const [capName, capability] of this.capabilities) {
            if (this.isCapabilityRelevant(capName, topic, context)) {
                relevance += capability.proficiency;
                capCount++;
            }
        }
        return capCount > 0 ? relevance / capCount : 0;
    }
    calculateConfidence(relevance, analysis) {
        const baseConfidence = relevance * 0.7;
        const experienceBonus = Math.min(this.state.performance.tasksCompleted / 100, 0.2);
        const successBonus = this.state.performance.successRate * 0.1;
        return Math.min(baseConfidence + experienceBonus + successBonus, 1.0);
    }
    generateReasoning(analysis, confidence) {
        const confidenceLevel = confidence > 0.8 ? 'high' :
            confidence > 0.5 ? 'moderate' : 'low';
        return `Analysis conducted with ${confidenceLevel} confidence ` +
            `based on ${this.capabilities.size} relevant capabilities. ` +
            `${JSON.stringify(analysis)}`;
    }
    isCapabilityRelevant(capability, topic, context) {
        const capKeywords = capability.toLowerCase().split('-');
        const topicLower = topic.toLowerCase();
        const contextStr = JSON.stringify(context).toLowerCase();
        return capKeywords.some(keyword => topicLower.includes(keyword) || contextStr.includes(keyword));
    }
    updatePerformanceMetrics(responseTime, confidence) {
        const metrics = this.state.performance;
        metrics.tasksTotal++;
        metrics.avgResponseTime =
            (metrics.avgResponseTime * (metrics.tasksTotal - 1) + responseTime) /
                metrics.tasksTotal;
        metrics.avgConfidence =
            (metrics.avgConfidence * (metrics.tasksTotal - 1) + confidence) /
                metrics.tasksTotal;
    }
    handleTaskAssignment(response) {
        const { taskIds, priority, deadline } = response;
        if (priority === 'critical') {
            this.state.taskQueue.unshift(...taskIds);
        }
        else {
            this.state.taskQueue.push(...taskIds);
        }
        this.emit('agent:tasks-assigned', {
            agentId: this.getId(),
            taskCount: taskIds.length,
            priority
        });
        if (this.state.status === 'idle' || this.state.status === 'active') {
            this.processNextTask();
        }
    }
    handleFeedback(response) {
        const { taskId, success, feedback } = response;
        if (success !== undefined) {
            const metrics = this.state.performance;
            metrics.tasksCompleted++;
            if (success) {
                metrics.successRate =
                    (metrics.successRate * (metrics.tasksCompleted - 1) + 1) /
                        metrics.tasksCompleted;
            }
            else {
                metrics.successRate =
                    (metrics.successRate * (metrics.tasksCompleted - 1)) /
                        metrics.tasksCompleted;
            }
        }
        if (this.config.learningEnabled && feedback) {
            this.learnFromFeedback(feedback);
        }
    }
    handleCollaborationRequest(response) {
        const { requestingAgent, task, urgency } = response;
        this.emit('agent:collaboration-requested', {
            agentId: this.getId(),
            requestingAgent,
            task
        });
        const canCollaborate = this.state.status !== 'busy' &&
            this.state.taskQueue.length < 5;
        this.emit('agent:collaboration-response', {
            agentId: this.getId(),
            requestingAgent,
            accepted: canCollaborate
        });
    }
    async processNextTask() {
        if (this.state.taskQueue.length === 0) {
            this.state.status = 'idle';
            return;
        }
        const taskId = this.state.taskQueue.shift();
        this.emit('agent:processing-task', {
            agentId: this.getId(),
            taskId
        });
    }
    async learnFromTask(result) {
        this.learningHistory.push(result);
        if (result.status === 'success' && result.metrics.accuracy) {
            this.emit('agent:learning', {
                agentId: this.getId(),
                taskId: result.taskId,
                improvement: result.metrics.accuracy
            });
        }
    }
    learnFromFeedback(feedback) {
        this.emit('agent:feedback-processed', {
            agentId: this.getId(),
            feedbackType: feedback.type
        });
    }
    evaluateAccuracy(output, task) {
        return 0.8;
    }
    evaluateEfficiency(duration, task) {
        const expectedDuration = task.estimatedDuration || 60000;
        return Math.min(expectedDuration / duration, 1.0);
    }
    handleError(error) {
        this.state.status = 'error';
        this.emit('agent:error', {
            agentId: this.getId(),
            error: error.message || error,
            timestamp: new Date()
        });
    }
    getId() {
        return this.config.id;
    }
    getType() {
        return this.config.type;
    }
    getStatus() {
        return this.state.status;
    }
    getPerformance() {
        return { ...this.state.performance };
    }
    getCapabilities() {
        return Array.from(this.capabilities.keys());
    }
    setQueenConnection(queen) {
        this.queenConnection = queen;
    }
}
exports.BaseAgent = BaseAgent;
//# sourceMappingURL=BaseAgent.js.map