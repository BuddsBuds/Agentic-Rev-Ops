"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwarmIntegration = void 0;
const events_1 = require("events");
class SwarmIntegration extends events_1.EventEmitter {
    hitlOrchestrator;
    taskDelegation;
    workflowEngine;
    progressTracker;
    swarmCoordinator;
    swarmMemory;
    config;
    pendingDecisions = new Map();
    agentOverrides = new Map();
    learningData = [];
    emergencyOverrides = new Map();
    constructor(hitlOrchestrator, taskDelegation, workflowEngine, progressTracker, swarmCoordinator, swarmMemory, config = {}) {
        super();
        this.hitlOrchestrator = hitlOrchestrator;
        this.taskDelegation = taskDelegation;
        this.workflowEngine = workflowEngine;
        this.progressTracker = progressTracker;
        this.swarmCoordinator = swarmCoordinator;
        this.swarmMemory = swarmMemory;
        this.config = this.buildConfig(config);
        this.setupIntegrationHooks();
        this.setupEventHandlers();
    }
    buildConfig(config) {
        return {
            enableAutomaticDecisionRouting: true,
            confidenceThresholds: {
                autoApprove: 0.9,
                requireHuman: 0.7,
                escalate: 0.5
            },
            swarmOverrides: {
                allowEmergencyOverride: true,
                emergencyOverrideRoles: ['senior-manager', 'director', 'executive'],
                maxOverrideWindow: 60
            },
            learningConfig: {
                enableLearningFromDecisions: true,
                retrainThreshold: 50,
                adaptThresholds: true
            },
            integrationPoints: {
                agentHooks: true,
                memoryIntegration: true,
                realTimeMonitoring: true,
                coordinatorIntegration: true
            },
            ...config
        };
    }
    setupIntegrationHooks() {
        if (this.config.integrationPoints.coordinatorIntegration) {
            this.swarmCoordinator.on('decision:required', this.handleSwarmDecisionRequest.bind(this));
            this.swarmCoordinator.on('agent:blocked', this.handleAgentBlocked.bind(this));
            this.swarmCoordinator.on('operation:failed', this.handleOperationFailed.bind(this));
        }
        if (this.config.integrationPoints.memoryIntegration) {
            this.setupMemorySync();
        }
        if (this.config.integrationPoints.realTimeMonitoring) {
            this.setupMonitoringIntegration();
        }
    }
    setupEventHandlers() {
        this.hitlOrchestrator.on('decision:created', this.handleHITLDecisionCreated.bind(this));
        this.hitlOrchestrator.on('decision:resolved', this.handleHITLDecisionResolved.bind(this));
        this.hitlOrchestrator.on('decision:executed', this.handleHITLDecisionExecuted.bind(this));
        this.taskDelegation.on('task:completed', this.handleTaskCompleted.bind(this));
        this.taskDelegation.on('task:failed', this.handleTaskFailed.bind(this));
        this.workflowEngine.on('workflow:completed', this.handleWorkflowCompleted.bind(this));
        this.workflowEngine.on('stage:timeout', this.handleStageTimeout.bind(this));
        this.progressTracker.on('alert:created', this.handleProgressAlert.bind(this));
        this.progressTracker.on('escalation:triggered', this.handleProgressEscalation.bind(this));
    }
    async handleSwarmDecisionRequest(request) {
        try {
            this.pendingDecisions.set(request.agentId, request);
            if (this.config.enableAutomaticDecisionRouting) {
                await this.routeDecisionBasedOnConfidence(request);
            }
            else {
                await this.createHITLDecisionFromSwarm(request);
            }
            this.emit('swarm:decisionRequested', request);
        }
        catch (error) {
            this.emit('integration:error', { type: 'decision_routing', error, request });
        }
    }
    async routeDecisionBasedOnConfidence(request) {
        const { confidence } = request;
        const thresholds = this.config.confidenceThresholds;
        if (confidence >= thresholds.autoApprove && request.urgency !== 'critical') {
            await this.autoApproveDecision(request);
        }
        else if (confidence >= thresholds.requireHuman) {
            await this.createHITLDecisionFromSwarm(request);
        }
        else if (confidence >= thresholds.escalate) {
            await this.escalateDecisionToExpert(request);
        }
        else {
            await this.requireImmediateHumanIntervention(request);
        }
    }
    async autoApproveDecision(request) {
        const approval = {
            decisionId: `auto-${request.agentId}-${Date.now()}`,
            action: 'approve',
            humanOperator: 'system-auto-approval',
            timestamp: new Date(),
            reasoning: `Auto-approved based on high confidence (${request.confidence.toFixed(2)})`
        };
        await this.executeSwarmRecommendation(request, approval);
        if (this.config.learningConfig.enableLearningFromDecisions) {
            this.recordLearningData(request, approval, 'auto-approved');
        }
        this.emit('decision:autoApproved', { request, approval });
    }
    async createHITLDecisionFromSwarm(request) {
        const hitlDecision = {
            type: this.mapSwarmDecisionType(request.decisionType),
            title: `Swarm Decision: ${request.context.taskDescription}`,
            description: this.generateDecisionDescription(request),
            context: {
                swarmId: request.swarmId,
                agentId: request.agentId,
                confidence: request.confidence,
                recommendations: this.convertSwarmRecommendations(request.recommendations),
                riskLevel: request.context.riskAssessment.level,
                financialImpact: request.context.businessImpact.financial,
                timeframe: this.calculateTimeframe(request.context.timeConstraints),
                stakeholders: request.stakeholders
            },
            metadata: {
                createdAt: new Date(),
                updatedAt: new Date(),
                priority: this.mapUrgencyToPriority(request.urgency),
                tags: ['swarm-generated', request.agentType, request.decisionType],
                clientId: request.metadata?.clientId,
                projectId: request.metadata?.projectId
            },
            humanReviewRequired: true,
            autoExecutionAllowed: false,
            status: 'pending'
        };
        const decision = await this.hitlOrchestrator.handleSwarmDecision({
            ...hitlDecision,
            swarmRequest: request
        });
        await this.swarmMemory.store(`swarm:decision:${request.agentId}`, {
            swarmRequest: request,
            hitlDecisionId: decision.id,
            createdAt: new Date()
        });
        return decision;
    }
    async escalateDecisionToExpert(request) {
        const decision = await this.createHITLDecisionFromSwarm(request);
        const expertTask = await this.taskDelegation.delegateFromDecision(decision, 'analysis', {
            title: `Expert Analysis: ${request.context.taskDescription}`,
            description: `Low confidence swarm decision requires expert analysis`,
            requiredRole: 'senior-specialist',
            priority: 'high',
            complexity: 'expert',
            estimatedDuration: 90
        });
        this.emit('decision:escalatedToExpert', { request, decision, expertTask });
    }
    async requireImmediateHumanIntervention(request) {
        const decision = await this.createHITLDecisionFromSwarm(request);
        decision.metadata.priority = 'critical';
        decision.metadata.tags.push('immediate-intervention');
        this.progressTracker.emit('alert:created', {
            id: `alert-immediate-${Date.now()}`,
            type: 'critical',
            title: 'Immediate Human Intervention Required',
            description: `Swarm decision with very low confidence (${request.confidence.toFixed(2)}) requires immediate human review`,
            source: 'swarm-integration',
            timestamp: new Date(),
            acknowledged: false,
            metadata: { swarmRequest: request, decisionId: decision.id }
        });
        this.emit('decision:immediateInterventionRequired', { request, decision });
    }
    async handleHITLDecisionCreated(decision) {
        await this.progressTracker.trackDecision(decision);
        if (decision.context.swarmId && decision.context.agentId) {
            await this.notifySwarmAgent(decision.context.agentId, {
                type: 'decision_under_review',
                decisionId: decision.id,
                estimatedResolution: this.estimateResolutionTime(decision)
            });
        }
        this.emit('hitl:decisionCreated', decision);
    }
    async handleHITLDecisionResolved(decision) {
        const swarmRequest = this.pendingDecisions.get(decision.context.agentId);
        if (swarmRequest) {
            const response = {
                decisionId: decision.id,
                action: decision.status === 'approved' ? 'approve' : 'reject',
                humanOperator: 'human-reviewer',
                timestamp: new Date(),
                reasoning: 'Human review completed',
            };
            if (decision.status === 'approved') {
                await this.executeSwarmRecommendation(swarmRequest, response);
            }
            else {
                await this.rejectSwarmRecommendation(swarmRequest, response);
            }
            if (this.config.learningConfig.enableLearningFromDecisions) {
                this.recordLearningData(swarmRequest, response, decision.status);
            }
            this.pendingDecisions.delete(decision.context.agentId);
        }
        this.emit('hitl:decisionResolved', decision);
    }
    async executeSwarmRecommendation(request, response) {
        try {
            const bestRecommendation = this.selectBestRecommendation(request.recommendations);
            const executionResult = await this.swarmCoordinator.executeRecommendation({
                agentId: request.agentId,
                recommendation: bestRecommendation,
                humanApproval: response,
                context: request.context
            });
            await this.swarmMemory.store(`execution:${request.agentId}`, {
                request,
                response,
                recommendation: bestRecommendation,
                result: executionResult,
                executedAt: new Date()
            });
            await this.notifySwarmAgent(request.agentId, {
                type: 'execution_approved',
                decisionId: response.decisionId,
                result: executionResult
            });
            this.emit('swarm:recommendationExecuted', { request, response, executionResult });
        }
        catch (error) {
            this.emit('integration:error', { type: 'execution_failed', error, request, response });
        }
    }
    async rejectSwarmRecommendation(request, response) {
        await this.notifySwarmAgent(request.agentId, {
            type: 'execution_rejected',
            decisionId: response.decisionId,
            reason: response.reasoning,
            alternatives: request.context.alternatives
        });
        if (request.context.alternatives.length > 0) {
            await this.considerAlternatives(request, response);
        }
        this.emit('swarm:recommendationRejected', { request, response });
    }
    async applyAgentOverride(override) {
        if (!this.isAuthorizedForOverride(override.authorizedBy, override.overrideType)) {
            throw new Error(`User ${override.authorizedBy} not authorized for ${override.overrideType} overrides`);
        }
        const agentOverrides = this.agentOverrides.get(override.agentId) || [];
        agentOverrides.push(override);
        this.agentOverrides.set(override.agentId, agentOverrides);
        await this.swarmCoordinator.applyAgentOverride(override);
        await this.swarmMemory.store(`override:${override.agentId}:${Date.now()}`, override);
        if (override.duration) {
            setTimeout(() => {
                this.removeAgentOverride(override.agentId, override);
            }, override.duration * 60 * 1000);
        }
        this.emit('agent:overrideApplied', override);
    }
    async emergencyOverride(agentId, action, authorizedBy, reason) {
        if (!this.config.swarmOverrides.allowEmergencyOverride) {
            throw new Error('Emergency overrides are disabled');
        }
        if (!this.config.swarmOverrides.emergencyOverrideRoles.includes(authorizedBy)) {
            throw new Error(`User ${authorizedBy} not authorized for emergency overrides`);
        }
        const lastOverride = this.emergencyOverrides.get(agentId);
        if (lastOverride) {
            const timeSinceLastOverride = (Date.now() - lastOverride.getTime()) / (1000 * 60);
            if (timeSinceLastOverride < this.config.swarmOverrides.maxOverrideWindow) {
                throw new Error(`Emergency override window not expired for agent ${agentId}`);
            }
        }
        await this.swarmCoordinator.emergencyOverride({
            agentId,
            action,
            authorizedBy,
            reason,
            timestamp: new Date()
        });
        this.emergencyOverrides.set(agentId, new Date());
        this.progressTracker.emit('alert:created', {
            id: `emergency-override-${Date.now()}`,
            type: 'critical',
            title: 'Emergency Override Executed',
            description: `Emergency override applied to agent ${agentId}: ${action}`,
            source: 'swarm-integration',
            timestamp: new Date(),
            acknowledged: false,
            metadata: { agentId, action, authorizedBy, reason }
        });
        this.emit('agent:emergencyOverride', { agentId, action, authorizedBy, reason });
    }
    async handleTaskCompleted(data) {
        const { task } = data;
        if (task.originatingDecision) {
            const decision = this.hitlOrchestrator.getDecision(task.originatingDecision);
            if (decision && decision.context.swarmId) {
                await this.notifySwarmAgent(decision.context.agentId, {
                    type: 'task_completed',
                    taskId: task.id,
                    outputs: task.outputs,
                    recommendations: task.lessons
                });
            }
        }
    }
    setupMemorySync() {
        this.hitlOrchestrator.on('decision:created', async (decision) => {
            await this.swarmMemory.store(`hitl:decision:${decision.id}`, {
                decision,
                timestamp: new Date(),
                source: 'hitl-orchestrator'
            });
        });
        setInterval(async () => {
            if (this.learningData.length > 0) {
                await this.swarmMemory.store('hitl:learning:batch', {
                    data: this.learningData,
                    timestamp: new Date()
                });
                if (this.learningData.length >= this.config.learningConfig.retrainThreshold) {
                    await this.triggerSwarmRetraining();
                    this.learningData = [];
                }
            }
        }, 5 * 60 * 1000);
    }
    setupMonitoringIntegration() {
        this.progressTracker.on('alert:created', async (alert) => {
            if (alert.type === 'critical' || alert.type === 'error') {
                await this.swarmCoordinator.handleCriticalAlert(alert);
            }
        });
        this.swarmCoordinator.on('health:degraded', async (healthData) => {
            this.progressTracker.emit('alert:created', {
                id: `swarm-health-${Date.now()}`,
                type: 'warning',
                title: 'Swarm Health Degraded',
                description: `Swarm performance metrics indicate degraded health`,
                source: 'swarm-coordinator',
                timestamp: new Date(),
                acknowledged: false,
                metadata: healthData
            });
        });
    }
    recordLearningData(request, response, outcome) {
        const learningEntry = {
            decisionPattern: this.extractDecisionPattern(request),
            humanDecision: response.action,
            outcome,
            contextFeatures: this.extractContextFeatures(request),
            confidence: request.confidence,
            timeToDecision: this.calculateDecisionTime(request, response),
            qualityScore: this.assessDecisionQuality(request, response),
            lessons: response.learningPoints || []
        };
        this.learningData.push(learningEntry);
        this.emit('learning:dataRecorded', learningEntry);
    }
    async triggerSwarmRetraining() {
        const retrainingData = {
            learningData: this.learningData,
            patterns: this.analyzeLearningPatterns(),
            recommendations: this.generateRetrainingRecommendations()
        };
        await this.swarmCoordinator.initiateRetraining(retrainingData);
        if (this.config.learningConfig.adaptThresholds) {
            this.adaptConfidenceThresholds();
        }
        this.emit('swarm:retrainingTriggered', retrainingData);
    }
    mapSwarmDecisionType(swarmType) {
        const typeMap = {
            'strategic_decision': 'strategic',
            'approval_request': 'approval',
            'validation_needed': 'validation',
            'override_request': 'override',
            'escalation_required': 'escalation'
        };
        return typeMap[swarmType] || 'approval';
    }
    mapUrgencyToPriority(urgency) {
        const priorityMap = {
            'low': 'low',
            'medium': 'medium',
            'high': 'high',
            'critical': 'critical'
        };
        return priorityMap[urgency];
    }
    generateDecisionDescription(request) {
        return `
    Agent ${request.agentType} (${request.agentId}) requests ${request.decisionType} for: ${request.context.taskDescription}
    
    Context:
    - Confidence: ${(request.confidence * 100).toFixed(1)}%
    - Risk Level: ${request.context.riskAssessment.level}
    - Business Impact: ${JSON.stringify(request.context.businessImpact)}
    - Urgency: ${request.urgency}
    
    Recommendations: ${request.recommendations.length} provided by swarm agents
    `.trim();
    }
    convertSwarmRecommendations(swarmRecs) {
        return swarmRecs.map(rec => ({
            agentId: rec.agentId,
            agentType: rec.agentType,
            recommendation: rec.recommendation,
            confidence: rec.confidence,
            reasoning: rec.reasoning.join('; '),
            suggestedActions: rec.implementation.steps,
            estimatedImpact: {
                timeToImplement: rec.implementation.timeEstimate,
                risk: rec.riskAssessment.level
            }
        }));
    }
    calculateTimeframe(timeConstraints) {
        if (timeConstraints.deadline) {
            const hoursUntilDeadline = (timeConstraints.deadline.getTime() - Date.now()) / (1000 * 60 * 60);
            if (hoursUntilDeadline < 1)
                return 'immediate';
            if (hoursUntilDeadline < 4)
                return '4h';
            if (hoursUntilDeadline < 24)
                return '24h';
            return `${Math.ceil(hoursUntilDeadline / 24)}d`;
        }
        return timeConstraints.maxDelay ? `${timeConstraints.maxDelay}m` : '24h';
    }
    estimateResolutionTime(decision) {
        const baseTime = {
            'strategic': 180,
            'approval': 60,
            'validation': 45,
            'override': 30,
            'escalation': 120
        };
        return baseTime[decision.type] || 60;
    }
    selectBestRecommendation(recommendations) {
        return recommendations.reduce((best, current) => current.confidence > best.confidence ? current : best);
    }
    async notifySwarmAgent(agentId, notification) {
        await this.swarmCoordinator.notifyAgent(agentId, notification);
    }
    async considerAlternatives(request, response) {
        if (request.context.alternatives.length > 0) {
            const bestAlternative = this.selectBestAlternative(request.context.alternatives);
            const alternativeRequest = {
                ...request,
                context: {
                    ...request.context,
                    taskDescription: `Alternative: ${bestAlternative.description}`,
                    businessImpact: {
                        ...request.context.businessImpact,
                        strategic: `Alternative approach: ${bestAlternative.name}`
                    }
                },
                recommendations: [],
                metadata: {
                    ...request.metadata,
                    originalDecision: response.decisionId,
                    alternativeId: bestAlternative.id
                }
            };
            await this.handleSwarmDecisionRequest(alternativeRequest);
        }
    }
    selectBestAlternative(alternatives) {
        return alternatives.reduce((best, current) => current.confidence > best.confidence ? current : best);
    }
    isAuthorizedForOverride(user, overrideType) {
        const authorizations = {
            'parameter': ['manager', 'senior-manager'],
            'behavior': ['senior-manager', 'director'],
            'constraint': ['director', 'executive'],
            'goal': ['executive', 'board']
        };
        return authorizations[overrideType]?.includes(user) || false;
    }
    removeAgentOverride(agentId, override) {
        const overrides = this.agentOverrides.get(agentId) || [];
        const index = overrides.findIndex(o => o.timestamp === override.timestamp);
        if (index !== -1) {
            overrides.splice(index, 1);
            this.agentOverrides.set(agentId, overrides);
            this.emit('agent:overrideRemoved', { agentId, override });
        }
    }
    extractDecisionPattern(request) {
        return `${request.agentType}_${request.decisionType}_${request.context.riskAssessment.level}`;
    }
    extractContextFeatures(request) {
        return {
            agentType: request.agentType,
            decisionType: request.decisionType,
            urgency: request.urgency,
            riskLevel: request.context.riskAssessment.level,
            hasFinancialImpact: !!request.context.businessImpact.financial,
            recommendationCount: request.recommendations.length,
            hasDeadline: !!request.context.timeConstraints.deadline,
            stakeholderCount: request.stakeholders.length
        };
    }
    calculateDecisionTime(request, response) {
        return 30;
    }
    assessDecisionQuality(request, response) {
        let quality = 3;
        if (request.confidence > 0.8 && response.action === 'approve')
            quality += 1;
        if (request.context.riskAssessment.level === 'low' && response.action === 'approve')
            quality += 0.5;
        if (response.reasoning && response.reasoning.length > 50)
            quality += 0.5;
        return Math.min(5, quality);
    }
    analyzeLearningPatterns() {
        const patterns = {};
        this.learningData.forEach(entry => {
            const pattern = entry.decisionPattern;
            if (!patterns[pattern]) {
                patterns[pattern] = { count: 0, approvals: 0, rejections: 0, avgQuality: 0 };
            }
            patterns[pattern].count++;
            if (entry.humanDecision === 'approve')
                patterns[pattern].approvals++;
            if (entry.humanDecision === 'reject')
                patterns[pattern].rejections++;
            patterns[pattern].avgQuality += entry.qualityScore;
        });
        Object.values(patterns).forEach((pattern) => {
            pattern.avgQuality /= pattern.count;
            pattern.approvalRate = pattern.approvals / pattern.count;
        });
        return patterns;
    }
    generateRetrainingRecommendations() {
        const recommendations = [];
        const patterns = this.analyzeLearningPatterns();
        Object.entries(patterns).forEach(([pattern, data]) => {
            if (data.approvalRate > 0.9 && data.avgQuality > 4) {
                recommendations.push(`Increase auto-approval threshold for pattern: ${pattern}`);
            }
            else if (data.approvalRate < 0.3) {
                recommendations.push(`Review recommendation quality for pattern: ${pattern}`);
            }
        });
        return recommendations;
    }
    adaptConfidenceThresholds() {
        const patterns = this.analyzeLearningPatterns();
        let adjustments = 0;
        Object.entries(patterns).forEach(([pattern, data]) => {
            if (data.count >= 10) {
                if (data.approvalRate > 0.95 && data.avgQuality > 4.5) {
                    this.config.confidenceThresholds.autoApprove *= 0.98;
                    adjustments++;
                }
                else if (data.approvalRate < 0.5) {
                    this.config.confidenceThresholds.requireHuman *= 1.02;
                    adjustments++;
                }
            }
        });
        if (adjustments > 0) {
            this.emit('thresholds:adapted', {
                adjustments,
                newThresholds: this.config.confidenceThresholds
            });
        }
    }
    getIntegrationStatus() {
        return {
            config: this.config,
            pendingDecisions: this.pendingDecisions.size,
            activeOverrides: Array.from(this.agentOverrides.values()).flat().length,
            learningDataCount: this.learningData.length,
            emergencyOverrides: this.emergencyOverrides.size,
            recentActivity: {
                decisionsRouted: this.learningData.filter(l => (Date.now() - new Date().getTime()) < 24 * 60 * 60 * 1000).length,
                autoApprovals: this.learningData.filter(l => l.outcome === 'auto-approved').length,
                humanInterventions: this.learningData.filter(l => l.humanDecision !== 'auto').length
            }
        };
    }
    cleanup() {
        this.removeAllListeners();
        this.pendingDecisions.clear();
        this.agentOverrides.clear();
        this.learningData = [];
        this.emergencyOverrides.clear();
    }
}
exports.SwarmIntegration = SwarmIntegration;
//# sourceMappingURL=SwarmIntegration.js.map