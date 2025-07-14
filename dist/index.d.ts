import { QueenAgent } from './swarm/queen/QueenAgent';
import { SwarmCoordinator } from './swarm/coordination/SwarmCoordinator';
import { CRMAgent } from './agents/specialized/CRMAgent';
import { MarketingAgent } from './agents/specialized/MarketingAgent';
import { AnalyticsAgent } from './agents/specialized/AnalyticsAgent';
import { SwarmMemory } from './swarm/memory/SwarmMemory';
import { MajorityEngine } from './swarm/consensus/MajorityEngine';
import { CommunicationProtocol } from './swarm/communication/CommunicationProtocol';
import { SwarmVisualizer } from './swarm/visualization/SwarmVisualizer';
import { HITLSystem } from './workflow/hitl/HITLSystem';
import { WorkflowSystem } from './workflow/WorkflowSystem';
import { DatabaseService } from './core/database/DatabaseService';
export interface AgenticRevOpsConfig {
    swarm?: {
        queenConfig?: any;
        majorityConfig?: any;
        memoryConfig?: any;
    };
    database?: {
        host?: string;
        port?: number;
        database?: string;
        username?: string;
        password?: string;
    };
    hitl?: {
        enabled?: boolean;
        operators?: any[];
    };
    workflow?: {
        enabled?: boolean;
        features?: any;
    };
}
export declare class AgenticRevOpsSystem {
    private queen;
    private coordinator;
    private memory;
    private majority;
    private protocol;
    private visualizer;
    private hitl?;
    private workflow?;
    private database?;
    constructor(config?: AgenticRevOpsConfig);
    initialize(): Promise<void>;
    processRequest(request: {
        type: 'pipeline-optimization' | 'lead-qualification' | 'revenue-forecasting' | 'campaign-analysis';
        description: string;
        context?: any;
    }): Promise<any>;
    getSystemStatus(): any;
    shutdown(): Promise<void>;
}
export default AgenticRevOpsSystem;
export { QueenAgent, SwarmCoordinator, CRMAgent, MarketingAgent, AnalyticsAgent, SwarmMemory, MajorityEngine, CommunicationProtocol, SwarmVisualizer, HITLSystem, WorkflowSystem, DatabaseService };
//# sourceMappingURL=index.d.ts.map