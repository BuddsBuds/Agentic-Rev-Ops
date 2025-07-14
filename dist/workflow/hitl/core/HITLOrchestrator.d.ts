import { EventEmitter } from 'events';
import { HumanInTheLoopManager } from '../interfaces/hitl-manager';
import { SwarmMemory } from '../../../swarm/memory/SwarmMemory';
import { SwarmCoordinator } from '../../../swarm/coordinator/SwarmCoordinator';
export interface HITLDecision {
    id: string;
    type: 'strategic' | 'approval' | 'validation' | 'override' | 'escalation';
    title: string;
    description: string;
    context: {
        swarmId: string;
        agentId: string;
        confidence: number;
        recommendations: AgentRecommendation[];
        riskLevel: 'low' | 'medium' | 'high' | 'critical';
        financialImpact?: number;
        timeframe: string;
        stakeholders: string[];
    };
    metadata: {
        createdAt: Date;
        updatedAt: Date;
        priority: 'low' | 'medium' | 'high' | 'critical';
        tags: string[];
        clientId?: string;
        projectId?: string;
    };
    humanReviewRequired: boolean;
    autoExecutionAllowed: boolean;
    status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'executed' | 'cancelled';
}
export interface AgentRecommendation {
    agentId: string;
    agentType: string;
    recommendation: string;
    confidence: number;
    reasoning: string;
    suggestedActions: string[];
    estimatedImpact: {
        revenue?: number;
        risk?: number;
        timeToImplement?: number;
    };
}
export interface HITLConfiguration {
    autoApprovalThreshold: number;
    escalationThreshold: number;
    reviewTimeoutMinutes: number;
    criticalDecisionRequiresApproval: boolean;
    financialImpactThreshold: number;
    enableLearningFromDecisions: boolean;
}
export declare class HITLOrchestrator extends EventEmitter {
    private decisions;
    private hitlManager;
    private swarmMemory;
    private swarmCoordinator;
    private config;
    private learningPatterns;
    constructor(hitlManager: HumanInTheLoopManager, swarmMemory: SwarmMemory, swarmCoordinator: SwarmCoordinator, config: HITLConfiguration);
    private setupEventHandlers;
    handleSwarmDecision(decisionData: any): Promise<HITLDecision>;
    private requestHumanReview;
    private handleHumanResponse;
    private executeDecision;
    private executeAutomatically;
    private learnFromDecision;
    private assessRiskLevel;
    private calculatePriority;
    private requiresHumanReview;
    private allowsAutoExecution;
    private handleTimeouts;
    private handleReviewTimeout;
    private escalateDecision;
    private analyzeRiskFactors;
    private suggestMitigation;
    private generateExecutionPlan;
    private generateAlternatives;
    private generateReviewOptions;
    private extractDecisionFactors;
    private calculatePatternAccuracy;
    private adjustAutomationThresholds;
    getPendingDecisions(): HITLDecision[];
    getDecision(id: string): HITLDecision | undefined;
    getDecisionsByStatus(status: HITLDecision['status']): HITLDecision[];
    getDecisionHistory(limit?: number): HITLDecision[];
    private modifyDecision;
    private rejectDecision;
}
//# sourceMappingURL=HITLOrchestrator.d.ts.map