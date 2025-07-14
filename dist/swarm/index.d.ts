export { QueenAgent } from './queen/QueenAgent';
export { MajorityEngine } from './consensus/MajorityEngine';
export { SwarmMemory } from './memory/SwarmMemory';
export { BaseAgent } from './agents/BaseAgent';
export { CRMAgent } from './agents/CRMAgent';
export { MarketingAgent } from './agents/MarketingAgent';
export { AnalyticsAgent } from './agents/AnalyticsAgent';
export { SwarmDemo } from './demo/SwarmDemo';
export { SwarmVisualizer } from './visualization/SwarmVisualizer';
export * from './types';
export declare class RevOpsSwarm {
    private static instance;
    private constructor();
    static getInstance(): RevOpsSwarm;
    createSwarm(config: {
        swarmId?: string;
        votingThreshold?: number;
        maxAgents?: number;
        enableVisualization?: boolean;
    }): Promise<SwarmInstance>;
    createRevOpsSwarm(options?: {
        enableCRM?: boolean;
        enableMarketing?: boolean;
        enableAnalytics?: boolean;
        enableVisualization?: boolean;
    }): Promise<SwarmInstance>;
}
interface SwarmInstance {
    swarmId: string;
    queen: QueenAgent;
    agents: Map<string, any>;
    visualizer?: any;
    addAgent(agent: any): Promise<void>;
    makeDecision(topic: string, context: any): Promise<any>;
    handleEmergency(situation: string, severity: 'high' | 'critical', context: any): Promise<any>;
    getHealth(): Promise<any>;
    visualize(): void;
}
export declare const revOpsSwarm: RevOpsSwarm;
//# sourceMappingURL=index.d.ts.map