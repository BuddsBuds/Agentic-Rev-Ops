import { EventEmitter } from 'events';
import { HITLOrchestrator } from '../core/HITLOrchestrator';
import { TaskDelegationManager } from '../delegation/TaskDelegationManager';
import { ReviewWorkflowEngine } from '../review/ReviewWorkflowEngine';
import { ProgressTracker } from '../tracking/ProgressTracker';
import { SwarmCoordinator } from '../../../swarm/coordinator/SwarmCoordinator';
import { SwarmMemory } from '../../../swarm/memory/SwarmMemory';
export interface HITLSwarmConfig {
    enableAutomaticDecisionRouting: boolean;
    confidenceThresholds: {
        autoApprove: number;
        requireHuman: number;
        escalate: number;
    };
    swarmOverrides: {
        allowEmergencyOverride: boolean;
        emergencyOverrideRoles: string[];
        maxOverrideWindow: number;
    };
    learningConfig: {
        enableLearningFromDecisions: boolean;
        retrainThreshold: number;
        adaptThresholds: boolean;
    };
    integrationPoints: {
        agentHooks: boolean;
        memoryIntegration: boolean;
        realTimeMonitoring: boolean;
        coordinatorIntegration: boolean;
    };
}
export interface SwarmDecisionRequest {
    swarmId: string;
    agentId: string;
    agentType: string;
    decisionType: string;
    context: SwarmDecisionContext;
    recommendations: SwarmRecommendation[];
    confidence: number;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    stakeholders: string[];
    metadata: any;
}
export interface SwarmDecisionContext {
    operationId: string;
    taskDescription: string;
    businessImpact: {
        financial?: number;
        operational?: string;
        strategic?: string;
        reputational?: string;
    };
    riskAssessment: {
        level: 'low' | 'medium' | 'high' | 'critical';
        factors: string[];
        mitigation: string[];
    };
    timeConstraints: {
        deadline?: Date;
        preferredCompletion?: Date;
        maxDelay?: number;
    };
    dependencies: string[];
    alternatives: SwarmAlternative[];
}
export interface SwarmRecommendation {
    agentId: string;
    agentType: string;
    recommendation: string;
    confidence: number;
    reasoning: string[];
    implementation: {
        steps: string[];
        resources: string[];
        timeEstimate: number;
        dependencies: string[];
    };
    riskAssessment: {
        level: string;
        factors: string[];
    };
    successCriteria: string[];
    rollbackPlan?: string[];
}
export interface SwarmAlternative {
    id: string;
    name: string;
    description: string;
    pros: string[];
    cons: string[];
    estimatedImpact: {
        positive: string[];
        negative: string[];
        neutral: string[];
    };
    resourceRequirements: string[];
    confidence: number;
}
export interface HITLResponse {
    decisionId: string;
    action: 'approve' | 'reject' | 'modify' | 'escalate' | 'delegate';
    humanOperator: string;
    timestamp: Date;
    reasoning: string;
    modifications?: any;
    conditions?: string[];
    followUpActions?: string[];
    learningPoints?: string[];
}
export interface AgentBehaviorOverride {
    agentId: string;
    agentType: string;
    overrideType: 'parameter' | 'behavior' | 'constraint' | 'goal';
    parameter: string;
    newValue: any;
    reason: string;
    duration?: number;
    conditions?: string[];
    authorizedBy: string;
    timestamp: Date;
}
export interface SwarmLearningData {
    decisionPattern: string;
    humanDecision: string;
    outcome: string;
    contextFeatures: any;
    confidence: number;
    timeToDecision: number;
    qualityScore: number;
    lessons: string[];
}
export declare class SwarmIntegration extends EventEmitter {
    private hitlOrchestrator;
    private taskDelegation;
    private workflowEngine;
    private progressTracker;
    private swarmCoordinator;
    private swarmMemory;
    private config;
    private pendingDecisions;
    private agentOverrides;
    private learningData;
    private emergencyOverrides;
    constructor(hitlOrchestrator: HITLOrchestrator, taskDelegation: TaskDelegationManager, workflowEngine: ReviewWorkflowEngine, progressTracker: ProgressTracker, swarmCoordinator: SwarmCoordinator, swarmMemory: SwarmMemory, config?: Partial<HITLSwarmConfig>);
    private buildConfig;
    private setupIntegrationHooks;
    private setupEventHandlers;
    private handleSwarmDecisionRequest;
    private routeDecisionBasedOnConfidence;
    private autoApproveDecision;
    private createHITLDecisionFromSwarm;
    private escalateDecisionToExpert;
    private requireImmediateHumanIntervention;
    private handleHITLDecisionCreated;
    private handleHITLDecisionResolved;
    private executeSwarmRecommendation;
    private rejectSwarmRecommendation;
    applyAgentOverride(override: AgentBehaviorOverride): Promise<void>;
    emergencyOverride(agentId: string, action: string, authorizedBy: string, reason: string): Promise<void>;
    private handleTaskCompleted;
    private setupMemorySync;
    private setupMonitoringIntegration;
    private recordLearningData;
    private triggerSwarmRetraining;
    private mapSwarmDecisionType;
    private mapUrgencyToPriority;
    private generateDecisionDescription;
    private convertSwarmRecommendations;
    private calculateTimeframe;
    private estimateResolutionTime;
    private selectBestRecommendation;
    private notifySwarmAgent;
    private considerAlternatives;
    private selectBestAlternative;
    private isAuthorizedForOverride;
    private removeAgentOverride;
    private extractDecisionPattern;
    private extractContextFeatures;
    private calculateDecisionTime;
    private assessDecisionQuality;
    private analyzeLearningPatterns;
    private generateRetrainingRecommendations;
    private adaptConfidenceThresholds;
    getIntegrationStatus(): any;
    cleanup(): void;
}
//# sourceMappingURL=SwarmIntegration.d.ts.map