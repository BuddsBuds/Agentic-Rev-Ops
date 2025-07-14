import { EventEmitter } from 'events';
import { AgentInterface, MajorityResult } from '../types';
export interface QueenConfig {
    swarmId: string;
    majorityThreshold: number;
    decisionTimeout: number;
    memoryRetention: number;
    tieBreakerRole?: boolean;
}
export interface AgentReport {
    agentId: string;
    agentType: string;
    status: string;
    recommendation: any;
    confidence: number;
    reasoning: string;
    timestamp: Date;
}
export interface QueenDecision {
    id: string;
    type: 'strategic' | 'tactical' | 'operational' | 'emergency';
    decision: string;
    majority: MajorityResult;
    implementation: ImplementationPlan;
    timestamp: Date;
}
export interface ImplementationPlan {
    steps: ExecutionStep[];
    assignments: AgentAssignment[];
    timeline: Timeline;
    successCriteria: SuccessCriteria[];
}
export interface ExecutionStep {
    id: string;
    action: string;
    dependencies: string[];
    assignedAgents: string[];
    estimatedDuration: number;
}
export interface AgentAssignment {
    agentId: string;
    taskIds: string[];
    priority: 'low' | 'medium' | 'high' | 'critical';
    deadline?: Date;
}
export interface Timeline {
    start: Date;
    end: Date;
    milestones: Milestone[];
}
export interface Milestone {
    id: string;
    name: string;
    targetDate: Date;
    criteria: string[];
}
export interface SuccessCriteria {
    metric: string;
    target: number;
    operator: '>' | '<' | '=' | '>=' | '<=';
}
export declare class QueenAgent extends EventEmitter implements AgentInterface {
    private config;
    private majorityEngine;
    private memory;
    private activeAgents;
    private decisionHistory;
    private currentDecisions;
    constructor(config: QueenConfig);
    initialize(): Promise<void>;
    registerAgent(agent: AgentInterface): void;
    makeStrategicDecision(topic: string, context: Record<string, any>, urgency?: 'low' | 'medium' | 'high' | 'critical'): Promise<QueenDecision>;
    handleEmergency(situation: string, severity: 'high' | 'critical', context: Record<string, any>): Promise<QueenDecision>;
    monitorSwarmHealth(): Promise<SwarmHealthReport>;
    coordinateCollaboration(taskId: string, requiredCapabilities: string[], complexity: 'low' | 'medium' | 'high'): Promise<CollaborationPlan>;
    private analyzeHistoricalPatterns;
    private createVotingOptions;
    private collectAgentVotes;
    private handleTieBreak;
    private gatherAgentReports;
    private formulateDecision;
    private createImplementationPlan;
    private handleAgentReport;
    private handleAgentAlert;
    private handleAgentRequest;
    private initializeEventHandlers;
    private generateDecisionId;
    private getAvailableAgents;
    private calculateOverallHealth;
    private synthesizeDecision;
    private generateRationale;
    private formulateEmergencyResponse;
    private gatherQuickReports;
    private createEmergencyPlan;
    private executeEmergencyPlan;
    private distributeImplementation;
    private decomposeDecision;
    private createAgentAssignments;
    private createTimeline;
    private defineSuccessCriteria;
    private collectAgentStatuses;
    private generateHealthRecommendations;
    private selectAgentsForTask;
    private defineCollaborationStructure;
    private defineCommunicationProtocol;
    private defineCheckpoints;
    private initializeCollaboration;
    private reportAffectsDecision;
    private updateDecisionStatus;
    private processAgentRequest;
    getId(): string;
    getType(): string;
    getStatus(): string;
    generateReport(topic: string, context: any): Promise<any>;
    receiveResponse(response: any): void;
}
export interface SwarmHealthReport {
    timestamp: Date;
    overallHealth: 'healthy' | 'degraded' | 'critical';
    agentHealth: any[];
    memoryHealth: any;
    votingMetrics: any;
    activeDecisions: number;
    recommendations: string[];
}
export interface CollaborationPlan {
    taskId: string;
    structure: any;
    agents: AgentInterface[];
    communicationProtocol: any;
    checkpoints: any[];
    conflictResolution: string;
}
//# sourceMappingURL=QueenAgent.d.ts.map