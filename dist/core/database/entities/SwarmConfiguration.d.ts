import { BaseEntity, BaseEntityData } from './base';
import { DatabaseConnectionManager } from '../connection';
export interface SwarmConfigurationData extends BaseEntityData {
    organization_id: string;
    name: string;
    topology: 'hierarchical' | 'mesh' | 'ring' | 'star';
    max_agents: number;
    strategy: 'consensus' | 'majority' | 'weighted' | 'adaptive';
    voting_threshold: number;
    auto_execution_threshold: number;
    configuration: {
        coordination_rules?: Record<string, any>;
        communication_protocols?: string[];
        learning_settings?: {
            pattern_detection: boolean;
            adaptive_thresholds: boolean;
            memory_retention_days: number;
        };
        security_settings?: {
            require_human_approval: boolean;
            approval_roles: string[];
            sensitive_actions: string[];
        };
        performance_settings?: {
            timeout_ms: number;
            retry_attempts: number;
            parallel_execution: boolean;
        };
    };
    is_active: boolean;
    metrics?: {
        total_decisions: number;
        successful_decisions: number;
        avg_response_time: number;
        agent_satisfaction: number;
    };
}
export interface AgentAssignment {
    agent_id: string;
    agent_type: string;
    capabilities: string[];
    weight: number;
    status: string;
    performance_score: number;
}
export declare class SwarmConfiguration extends BaseEntity<SwarmConfigurationData> {
    constructor(db: DatabaseConnectionManager, data?: Partial<SwarmConfigurationData>);
    protected createInstance(data: SwarmConfigurationData): this;
    protected validate(): void;
    protected beforeSave(): Promise<void>;
    getAgents(): Promise<AgentAssignment[]>;
    addAgent(agentConfig: {
        name: string;
        type: string;
        capabilities: string[];
        weight?: number;
    }): Promise<string>;
    removeAgent(agentId: string): Promise<void>;
    getDecisions(limit?: number): Promise<any[]>;
    createDecision(decisionData: {
        decision_type: string;
        context: any;
        requires_human_approval?: boolean;
    }): Promise<string>;
    getMemoryEntries(query_params?: {
        entry_type?: string;
        limit?: number;
        relevance_threshold?: number;
    }): Promise<any[]>;
    storeMemory(memoryData: {
        entry_type: string;
        content: any;
        relevance?: number;
        tags?: string[];
        expires_at?: Date;
    }): Promise<string>;
    getPerformanceMetrics(): Promise<any>;
    updateConfiguration(updates: Partial<SwarmConfigurationData['configuration']>): Promise<void>;
    activate(): Promise<void>;
    deactivate(): Promise<void>;
    clone(newName: string): Promise<SwarmConfiguration>;
    getTopologyData(): Promise<any>;
    optimize(): Promise<{
        suggestions: string[];
        changes: any;
    }>;
    private getDefaultConfiguration;
    private calculateSwarmHealth;
    private generateTopologyEdges;
    static findByOrganization(db: DatabaseConnectionManager, organizationId: string, activeOnly?: boolean): Promise<SwarmConfiguration[]>;
}
export default SwarmConfiguration;
//# sourceMappingURL=SwarmConfiguration.d.ts.map