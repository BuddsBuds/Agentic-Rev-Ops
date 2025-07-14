import { EventEmitter } from 'events';
export interface MajorityConfig {
    votingThreshold?: number;
    quorumRequired?: number;
    tieBreaker?: 'queen' | 'random' | 'status-quo' | 'defer';
    votingTimeout?: number;
    weightedVoting?: boolean;
}
export interface Vote {
    agentId: string;
    choice: string | number | boolean;
    weight?: number;
    confidence?: number;
    reasoning?: string;
    timestamp: Date;
}
export interface VotingTopic {
    id: string;
    type: 'decision' | 'action' | 'priority' | 'resource-allocation';
    question: string;
    options: VotingOption[];
    context: Record<string, any>;
    deadline?: Date;
}
export interface VotingOption {
    id: string;
    value: any;
    description: string;
    proposedBy?: string;
}
export interface MajorityResult {
    topicId: string;
    winner: VotingOption;
    votingStats: VotingStats;
    participation: ParticipationStats;
    legitimacy: 'valid' | 'no-quorum' | 'tied' | 'timeout';
    tieBreakUsed?: boolean;
    timestamp: Date;
}
export interface VotingStats {
    totalVotes: number;
    votesPerOption: Map<string, number>;
    percentagePerOption: Map<string, number>;
    weightedScores?: Map<string, number>;
    majorityThreshold: number;
    majorityAchieved: boolean;
}
export interface ParticipationStats {
    eligibleVoters: number;
    actualVoters: number;
    participationRate: number;
    quorumMet: boolean;
    abstentions: number;
}
export declare class MajorityEngine extends EventEmitter {
    private config;
    private activeVotings;
    private votingHistory;
    private agentWeights;
    constructor(config?: MajorityConfig);
    initialize(): Promise<void>;
    setAgentWeight(agentId: string, weight: number): void;
    startVoting(topic: VotingTopic, eligibleVoters: string[]): Promise<string>;
    castVote(votingId: string, vote: Vote): Promise<void>;
    closeVoting(votingId: string): Promise<MajorityResult>;
    getVotingStatus(votingId: string): VotingStatus | undefined;
    private calculateResults;
    private breakTie;
    getVotingHistory(limit?: number): MajorityResult[];
    getMetrics(): MajorityMetrics;
    private generateVotingId;
}
interface VotingStatus {
    id: string;
    status: string;
    votesReceived: number;
    totalEligible: number;
    percentageVoted: number;
    timeElapsed: number;
}
interface MajorityMetrics {
    totalVotings: number;
    validVotings: number;
    tiedVotings: number;
    noQuorumVotings: number;
    avgParticipation: number;
    successRate: number;
}
export {};
//# sourceMappingURL=MajorityEngine.d.ts.map