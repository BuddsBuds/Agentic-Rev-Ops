export declare class SwarmVisualizer {
    private activeAgents;
    private decisions;
    private maxDecisions;
    constructor();
    registerAgent(agentId: string, type: string, name: string): void;
    updateAgentStatus(agentId: string, status: string, confidence?: number): void;
    recordDecision(decision: any): void;
    displaySwarmState(): void;
    private generateHeader;
    private generateAgentStatus;
    private generateDecisionHistory;
    private generateActivityGraph;
    private getAgentIcon;
    private getStatusIcon;
    private generateConfidenceBar;
    private generateParticipationBar;
    private getTimeAgo;
    private truncate;
    private generateActivityData;
    getStatusSummary(): SwarmStatus;
    private calculateHealthStatus;
}
interface SwarmStatus {
    totalAgents: number;
    activeAgents: number;
    recentDecisions: number;
    avgConfidence: number;
    healthStatus: string;
}
export {};
//# sourceMappingURL=SwarmVisualizer.d.ts.map