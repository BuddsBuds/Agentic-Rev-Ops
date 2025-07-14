"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HITLOrchestrator = void 0;
const events_1 = require("events");
class HITLOrchestrator extends events_1.EventEmitter {
    decisions = new Map();
    hitlManager;
    swarmMemory;
    swarmCoordinator;
    config;
    learningPatterns = new Map();
    constructor(hitlManager, swarmMemory, swarmCoordinator, config) {
        super();
        this.hitlManager = hitlManager;
        this.swarmMemory = swarmMemory;
        this.swarmCoordinator = swarmCoordinator;
        this.config = config;
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        this.swarmCoordinator.on('decision:requiresHuman', this.handleSwarmDecision.bind(this));
        this.hitlManager.on('review:completed', this.handleHumanResponse.bind(this));
        setInterval(() => this.handleTimeouts(), 60000);
    }
    async handleSwarmDecision(decisionData) {
        const decision = {
            id: `HITL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: decisionData.type || 'approval',
            title: decisionData.title,
            description: decisionData.description,
            context: {
                swarmId: decisionData.swarmId,
                agentId: decisionData.agentId,
                confidence: decisionData.confidence,
                recommendations: decisionData.recommendations || [],
                riskLevel: this.assessRiskLevel(decisionData),
                financialImpact: decisionData.financialImpact,
                timeframe: decisionData.timeframe || '24h',
                stakeholders: decisionData.stakeholders || []
            },
            metadata: {
                createdAt: new Date(),
                updatedAt: new Date(),
                priority: this.calculatePriority(decisionData),
                tags: decisionData.tags || [],
                clientId: decisionData.clientId,
                projectId: decisionData.projectId
            },
            humanReviewRequired: this.requiresHumanReview(decisionData),
            autoExecutionAllowed: this.allowsAutoExecution(decisionData),
            status: 'pending'
        };
        this.decisions.set(decision.id, decision);
        await this.swarmMemory.store(`hitl:decision:${decision.id}`, decision);
        if (decision.humanReviewRequired) {
            await this.requestHumanReview(decision);
        }
        else if (decision.autoExecutionAllowed) {
            await this.executeAutomatically(decision);
        }
        else {
            await this.escalateDecision(decision);
        }
        this.emit('decision:created', decision);
        return decision;
    }
    async requestHumanReview(decision) {
        const reviewRequest = {
            id: `review-${decision.id}`,
            type: 'approval',
            context: {
                decision,
                swarmRecommendations: decision.context.recommendations,
                riskAssessment: {
                    level: decision.context.riskLevel,
                    factors: this.analyzeRiskFactors(decision),
                    mitigation: this.suggestMitigation(decision)
                },
                executionPlan: this.generateExecutionPlan(decision),
                alternatives: this.generateAlternatives(decision)
            },
            status: 'pending',
            requestedAt: new Date()
        };
        decision.status = 'in_review';
        await this.hitlManager.requestReview(reviewRequest.type, reviewRequest.context, this.generateReviewOptions(decision));
        this.emit('review:requested', { decision, reviewRequest });
    }
    async handleHumanResponse(reviewResponse) {
        const decisionId = reviewResponse.context.decision?.id;
        if (!decisionId)
            return;
        const decision = this.decisions.get(decisionId);
        if (!decision)
            return;
        decision.metadata.updatedAt = new Date();
        switch (reviewResponse.response?.action) {
            case 'approve':
                decision.status = 'approved';
                await this.executeDecision(decision, reviewResponse.response);
                break;
            case 'reject':
                decision.status = 'rejected';
                await this.rejectDecision(decision, reviewResponse.response);
                break;
            case 'modify':
                await this.modifyDecision(decision, reviewResponse.response);
                break;
            case 'escalate':
                await this.escalateDecision(decision);
                break;
            default:
                decision.status = 'cancelled';
        }
        if (this.config.enableLearningFromDecisions) {
            await this.learnFromDecision(decision, reviewResponse);
        }
        this.emit('decision:resolved', decision);
    }
    async executeDecision(decision, humanResponse) {
        try {
            decision.status = 'executed';
            const executionResult = await this.swarmCoordinator.executeDecision({
                decisionId: decision.id,
                approvedBy: humanResponse.approvedBy || 'human',
                executionParameters: humanResponse.parameters || {},
                humanOverrides: humanResponse.overrides || {}
            });
            await this.swarmMemory.store(`hitl:execution:${decision.id}`, {
                decision,
                executionResult,
                humanInput: humanResponse,
                executedAt: new Date()
            });
            this.emit('decision:executed', { decision, executionResult });
        }
        catch (error) {
            decision.status = 'rejected';
            this.emit('decision:failed', { decision, error });
        }
    }
    async executeAutomatically(decision) {
        try {
            decision.status = 'executed';
            const executionResult = await this.swarmCoordinator.executeDecision({
                decisionId: decision.id,
                autoExecuted: true,
                confidence: decision.context.confidence
            });
            await this.swarmMemory.store(`hitl:autoexec:${decision.id}`, {
                decision,
                executionResult,
                autoExecutedAt: new Date()
            });
            this.emit('decision:autoExecuted', { decision, executionResult });
        }
        catch (error) {
            await this.requestHumanReview(decision);
        }
    }
    async learnFromDecision(decision, humanResponse) {
        const learningData = {
            decisionType: decision.type,
            swarmConfidence: decision.context.confidence,
            humanDecision: humanResponse.response?.action,
            riskLevel: decision.context.riskLevel,
            financialImpact: decision.context.financialImpact,
            factors: this.extractDecisionFactors(decision),
            outcome: humanResponse.response
        };
        const patternKey = `${decision.type}_${decision.context.riskLevel}`;
        const existingPattern = this.learningPatterns.get(patternKey) || { decisions: [], accuracy: 0 };
        existingPattern.decisions.push(learningData);
        existingPattern.accuracy = this.calculatePatternAccuracy(existingPattern.decisions);
        this.learningPatterns.set(patternKey, existingPattern);
        await this.swarmMemory.store(`hitl:learning:${patternKey}`, existingPattern);
        if (existingPattern.decisions.length >= 10) {
            this.adjustAutomationThresholds(patternKey, existingPattern);
        }
    }
    assessRiskLevel(decisionData) {
        let riskScore = 0;
        if (decisionData.financialImpact > 100000)
            riskScore += 3;
        else if (decisionData.financialImpact > 10000)
            riskScore += 2;
        else if (decisionData.financialImpact > 1000)
            riskScore += 1;
        if (decisionData.confidence < 0.5)
            riskScore += 3;
        else if (decisionData.confidence < 0.7)
            riskScore += 2;
        else if (decisionData.confidence < 0.9)
            riskScore += 1;
        if (decisionData.clientFacing)
            riskScore += 2;
        if (decisionData.strategicImpact)
            riskScore += 2;
        if (riskScore >= 6)
            return 'critical';
        if (riskScore >= 4)
            return 'high';
        if (riskScore >= 2)
            return 'medium';
        return 'low';
    }
    calculatePriority(decisionData) {
        const urgencyFactors = {
            timeframe: decisionData.timeframe === 'immediate' ? 3 :
                decisionData.timeframe === '1h' ? 2 :
                    decisionData.timeframe === '24h' ? 1 : 0,
            clientImpact: decisionData.clientFacing ? 2 : 0,
            financialImpact: decisionData.financialImpact > 50000 ? 2 :
                decisionData.financialImpact > 10000 ? 1 : 0,
            confidence: decisionData.confidence < 0.5 ? 2 : 0
        };
        const totalScore = Object.values(urgencyFactors).reduce((sum, score) => sum + score, 0);
        if (totalScore >= 6)
            return 'critical';
        if (totalScore >= 4)
            return 'high';
        if (totalScore >= 2)
            return 'medium';
        return 'low';
    }
    requiresHumanReview(decisionData) {
        return (decisionData.confidence < this.config.autoApprovalThreshold ||
            decisionData.financialImpact > this.config.financialImpactThreshold ||
            decisionData.riskLevel === 'critical' ||
            decisionData.strategicDecision ||
            decisionData.clientFacing);
    }
    allowsAutoExecution(decisionData) {
        return (decisionData.confidence >= this.config.autoApprovalThreshold &&
            decisionData.financialImpact <= this.config.financialImpactThreshold &&
            !decisionData.strategicDecision &&
            !decisionData.clientFacing);
    }
    handleTimeouts() {
        const now = new Date();
        const timeoutMinutes = this.config.reviewTimeoutMinutes;
        for (const decision of this.decisions.values()) {
            if (decision.status === 'in_review') {
                const timeElapsed = (now.getTime() - decision.metadata.createdAt.getTime()) / (1000 * 60);
                if (timeElapsed > timeoutMinutes) {
                    this.handleReviewTimeout(decision);
                }
            }
        }
    }
    async handleReviewTimeout(decision) {
        if (decision.context.riskLevel === 'low' && decision.autoExecutionAllowed) {
            await this.executeAutomatically(decision);
        }
        else {
            await this.escalateDecision(decision);
        }
    }
    async escalateDecision(decision) {
        decision.metadata.priority = 'critical';
        decision.metadata.tags.push('escalated');
        this.emit('decision:escalated', decision);
        await this.requestHumanReview(decision);
    }
    analyzeRiskFactors(decision) {
        const factors = [];
        if (decision.context.confidence < 0.7)
            factors.push('Low AI confidence');
        if (decision.context.financialImpact && decision.context.financialImpact > 10000)
            factors.push('High financial impact');
        if (decision.context.riskLevel === 'high' || decision.context.riskLevel === 'critical')
            factors.push('High risk level');
        if (decision.metadata.clientId)
            factors.push('Client-facing decision');
        return factors;
    }
    suggestMitigation(decision) {
        const mitigations = [];
        if (decision.context.confidence < 0.7)
            mitigations.push('Gather additional data before execution');
        if (decision.context.financialImpact && decision.context.financialImpact > 10000)
            mitigations.push('Implement staged rollout');
        if (decision.metadata.clientId)
            mitigations.push('Coordinate with client success team');
        return mitigations;
    }
    generateExecutionPlan(decision) {
        return {
            steps: decision.context.recommendations.map((rec, index) => ({
                step: index + 1,
                action: rec.recommendation,
                agent: rec.agentId,
                estimatedTime: rec.estimatedImpact?.timeToImplement || 60
            })),
            rollbackPlan: 'Automated rollback available',
            monitoring: 'Real-time execution monitoring enabled'
        };
    }
    generateAlternatives(decision) {
        return [
            {
                name: 'Conservative Approach',
                description: 'Lower risk, lower impact alternative',
                confidence: Math.min(decision.context.confidence + 0.2, 1.0)
            },
            {
                name: 'Staged Implementation',
                description: 'Implement in phases with checkpoints',
                confidence: Math.min(decision.context.confidence + 0.1, 1.0)
            }
        ];
    }
    generateReviewOptions(decision) {
        return ['Approve', 'Reject', 'Modify', 'Request More Info', 'Escalate'];
    }
    extractDecisionFactors(decision) {
        return {
            confidence: decision.context.confidence,
            riskLevel: decision.context.riskLevel,
            financialImpact: decision.context.financialImpact,
            agentCount: decision.context.recommendations.length,
            timeframe: decision.context.timeframe,
            priority: decision.metadata.priority
        };
    }
    calculatePatternAccuracy(decisions) {
        const correct = decisions.filter(d => (d.swarmConfidence > 0.8 && d.humanDecision === 'approve') ||
            (d.swarmConfidence < 0.5 && d.humanDecision === 'reject')).length;
        return decisions.length > 0 ? correct / decisions.length : 0;
    }
    adjustAutomationThresholds(patternKey, pattern) {
        if (pattern.accuracy > 0.9) {
            this.emit('threshold:adjust', {
                pattern: patternKey,
                recommendation: 'increase_automation',
                accuracy: pattern.accuracy
            });
        }
        else if (pattern.accuracy < 0.6) {
            this.emit('threshold:adjust', {
                pattern: patternKey,
                recommendation: 'decrease_automation',
                accuracy: pattern.accuracy
            });
        }
    }
    getPendingDecisions() {
        return Array.from(this.decisions.values())
            .filter(d => d.status === 'pending' || d.status === 'in_review')
            .sort((a, b) => {
            const priorityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
            return priorityOrder[b.metadata.priority] - priorityOrder[a.metadata.priority];
        });
    }
    getDecision(id) {
        return this.decisions.get(id);
    }
    getDecisionsByStatus(status) {
        return Array.from(this.decisions.values()).filter(d => d.status === status);
    }
    getDecisionHistory(limit) {
        const history = Array.from(this.decisions.values())
            .filter(d => d.status === 'executed' || d.status === 'rejected')
            .sort((a, b) => b.metadata.updatedAt.getTime() - a.metadata.updatedAt.getTime());
        return limit ? history.slice(0, limit) : history;
    }
    async modifyDecision(decision, humanResponse) {
        if (humanResponse.modifications) {
            Object.assign(decision.context, humanResponse.modifications.context || {});
            Object.assign(decision.metadata, humanResponse.modifications.metadata || {});
        }
        decision.metadata.updatedAt = new Date();
        decision.metadata.tags.push('modified');
        if (this.allowsAutoExecution(decision.context)) {
            await this.executeAutomatically(decision);
        }
        else {
            await this.requestHumanReview(decision);
        }
    }
    async rejectDecision(decision, humanResponse) {
        await this.swarmMemory.store(`hitl:rejection:${decision.id}`, {
            decision,
            rejectionReason: humanResponse.reason,
            rejectedBy: humanResponse.rejectedBy || 'human',
            rejectedAt: new Date()
        });
        this.swarmCoordinator.emit('decision:rejected', {
            decisionId: decision.id,
            reason: humanResponse.reason
        });
        this.emit('decision:rejected', { decision, reason: humanResponse.reason });
    }
}
exports.HITLOrchestrator = HITLOrchestrator;
//# sourceMappingURL=HITLOrchestrator.js.map