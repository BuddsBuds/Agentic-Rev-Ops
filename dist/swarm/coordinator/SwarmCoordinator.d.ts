import { EventEmitter } from 'events';
import { QueenAgent } from '../queen/QueenAgent';
export interface SwarmConfig {
    id: string;
    name: string;
    purpose: string;
    queen: QueenAgent;
    agents: Map<string, any>;
    status: SwarmStatus;
    metrics: SwarmMetrics;
}
export interface SwarmStatus {
    state: 'initializing' | 'active' | 'busy' | 'paused' | 'error';
    health: 'healthy' | 'degraded' | 'critical';
    lastActivity: Date;
    currentTasks: number;
}
export interface SwarmMetrics {
    decisionsPerHour: number;
    avgResponseTime: number;
    successRate: number;
    resourceUtilization: number;
    agentEfficiency: Map<string, number>;
}
export interface InterSwarmMessage {
    id: string;
    from: string;
    to: string;
    type: 'request' | 'response' | 'broadcast' | 'coordination';
    priority: 'low' | 'medium' | 'high' | 'critical';
    content: any;
    timestamp: Date;
}
export interface ResourceAllocation {
    swarmId: string;
    resources: {
        agents: number;
        memory: number;
        priority: number;
    };
    constraints: ResourceConstraints;
}
export interface ResourceConstraints {
    maxAgents: number;
    maxMemory: number;
    maxConcurrentTasks: number;
    reservedForEmergency: number;
}
export interface CoordinationStrategy {
    type: 'hierarchical' | 'peer-to-peer' | 'hybrid';
    loadBalancing: 'round-robin' | 'least-loaded' | 'capability-based';
    failover: 'automatic' | 'manual' | 'none';
    communication: 'synchronous' | 'asynchronous' | 'mixed';
}
export declare class SwarmCoordinator extends EventEmitter {
    private swarms;
    private globalMemory;
    private messageQueue;
    private resourcePool;
    private strategy;
    private performanceMonitor;
    constructor();
    initialize(): Promise<void>;
    registerSwarm(id: string, name: string, purpose: string, queen: QueenAgent): Promise<void>;
    routeTask(task: any): Promise<string>;
    coordinateSwarms(coordination: {
        type: 'collaboration' | 'delegation' | 'consultation';
        initiator: string;
        participants: string[];
        topic: string;
        context: any;
    }): Promise<any>;
    handleGlobalEmergency(emergency: {
        type: string;
        severity: 'high' | 'critical';
        affectedAreas: string[];
        context: any;
    }): Promise<void>;
    getNetworkStatus(): NetworkStatus;
    optimizeNetwork(): Promise<OptimizationResult>;
    private setupSwarmHandlers;
    private startMessageProcessor;
    private processMessageQueue;
    private processMessage;
    private startHealthMonitor;
    private checkSwarmHealth;
    private startLoadBalancer;
    private balanceLoad;
    private facilitateCollaboration;
    private analyzeTask;
    private findCapableSwarms;
    private selectSwarm;
    private scoreSwarmForTask;
    private sendToSwarm;
    private calculateAverageHealth;
    private handleSwarmDecision;
    private updateSwarmHealth;
    private handleDegradedSwarm;
    private redistributeTasks;
    private checkSwarmRecovery;
    private identifyBottlenecks;
    private generateOptimizationRecommendations;
    private applyOptimization;
    private scaleOverloadedSwarms;
    private optimizeMessaging;
    private generateCoordinationId;
    private generateMessageId;
    private assessTaskComplexity;
    private extractTaskRequirements;
    private estimateTaskDuration;
    private isSwarmCapable;
    private handleSwarmEmergency;
    private handleSwarmRequest;
    private handleSwarmResponse;
    private handleBroadcast;
    private handleCoordinationMessage;
    private pauseNonCriticalOperations;
    private reallocateForEmergency;
    private selectEmergencyResponseSwarms;
    private synthesizeEmergencyResponses;
    private calculateSwarmLoads;
    private detectLoadImbalance;
    private rebalanceSwarms;
    private collectSwarmDecisions;
    private synthesizeCollaborativeDecision;
    private broadcastToSwarms;
    private allocateResources;
    private handleSwarmError;
    private facilitateDelegation;
    private facilitateConsultation;
}
export interface NetworkStatus {
    totalSwarms: number;
    activeSwarms: number;
    totalAgents: number;
    networkHealth: string;
    messageQueueSize: number;
    resourceUtilization: number;
    coordinationStrategy: CoordinationStrategy;
}
export interface OptimizationResult {
    currentPerformance: any;
    bottlenecks: any[];
    recommendations: any[];
    appliedOptimizations: string[];
}
//# sourceMappingURL=SwarmCoordinator.d.ts.map