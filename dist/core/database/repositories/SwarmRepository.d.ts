import { BaseRepository } from './BaseRepository';
import { DatabaseConnectionManager } from '../connection';
import { SwarmConfiguration, SwarmConfigurationData } from '../entities/SwarmConfiguration';
export interface SwarmMetrics {
    swarmId: string;
    swarmName: string;
    topology: string;
    agentCount: number;
    activeAgents: number;
    totalDecisions: number;
    successfulDecisions: number;
    avgConfidence: number;
    avgResponseTime: number;
    healthScore: number;
}
export interface DecisionAnalytics {
    decisionId: string;
    decisionType: string;
    confidence: number;
    participationRate: number;
    executionTime: number;
    outcome: 'success' | 'failure' | 'pending';
    agentVotes: number;
    humanApprovalRequired: boolean;
}
export declare class SwarmRepository extends BaseRepository<SwarmConfigurationData> {
    constructor(db: DatabaseConnectionManager);
    findByOrganization(organizationId: string, activeOnly?: boolean): Promise<SwarmConfiguration[]>;
    findByTopology(topology: string): Promise<SwarmConfiguration[]>;
    getSwarmMetrics(swarmId?: string): Promise<SwarmMetrics[]>;
    getDecisionAnalytics(swarmId: string, startDate?: Date, endDate?: Date, limit?: number): Promise<DecisionAnalytics[]>;
    getAgentPerformance(swarmId?: string): Promise<any[]>;
    getMemoryAnalytics(swarmId: string): Promise<any>;
    getNeuralPatterns(swarmId: string): Promise<any[]>;
    createDecisionWithContext(swarmId: string, decisionData: {
        decision_type: string;
        context: any;
        requires_human_approval?: boolean;
        priority?: 'low' | 'medium' | 'high' | 'critical';
    }): Promise<string>;
    getCollaborationMetrics(swarmId: string): Promise<any>;
    optimizeSwarm(swarmId: string): Promise<{
        recommendations: string[];
        metrics: any;
        changes: any;
    }>;
    archiveOldData(swarmId: string, olderThanDays?: number): Promise<{
        decisionsArchived: number;
        memoriesArchived: number;
    }>;
    getHealthReport(swarmId: string): Promise<any>;
    private generateHealthRecommendations;
}
export default SwarmRepository;
//# sourceMappingURL=SwarmRepository.d.ts.map