/**
 * Majority Engine - Majority Rules Decision Making
 * Implements various majority voting mechanisms for swarm decisions
 */

import { EventEmitter } from 'events';

export interface MajorityConfig {
  votingThreshold?: number; // Default 0.5 (simple majority), can be set to 0.6, 0.67, etc.
  quorumRequired?: number; // Minimum percentage of agents that must vote (default 0.5)
  tieBreaker?: 'queen' | 'random' | 'status-quo' | 'defer'; // How to handle ties
  votingTimeout?: number; // Milliseconds to wait for votes
  weightedVoting?: boolean; // Whether to use weighted votes based on agent expertise
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

export class MajorityEngine extends EventEmitter {
  private config: MajorityConfig;
  private activeVotings: Map<string, ActiveVoting>;
  private votingHistory: MajorityResult[];
  private agentWeights: Map<string, number>;
  
  constructor(config: MajorityConfig = {}) {
    super();
    this.config = {
      votingThreshold: config.votingThreshold || 0.5,
      quorumRequired: config.quorumRequired || 0.5,
      tieBreaker: config.tieBreaker || 'queen',
      votingTimeout: config.votingTimeout || 30000, // 30 seconds default
      weightedVoting: config.weightedVoting || false
    };
    
    this.activeVotings = new Map();
    this.votingHistory = [];
    this.agentWeights = new Map();
  }

  /**
   * Initialize the majority engine
   */
  async initialize(): Promise<void> {
    // Load historical voting data if available
    this.emit('majority:initialized');
  }

  /**
   * Set agent voting weight (for weighted voting)
   */
  setAgentWeight(agentId: string, weight: number): void {
    if (weight < 0 || weight > 1) {
      throw new Error('Weight must be between 0 and 1');
    }
    this.agentWeights.set(agentId, weight);
  }

  /**
   * Start a new voting session
   */
  async startVoting(
    topic: VotingTopic,
    eligibleVoters: string[]
  ): Promise<string> {
    const votingId = this.generateVotingId();
    
    const activeVoting: ActiveVoting = {
      id: votingId,
      topic,
      eligibleVoters: new Set(eligibleVoters),
      votes: new Map(),
      startTime: new Date(),
      status: 'open'
    };
    
    this.activeVotings.set(votingId, activeVoting);
    
    // Set timeout for voting
    setTimeout(() => {
      if (this.activeVotings.has(votingId)) {
        this.closeVoting(votingId);
      }
    }, this.config.votingTimeout);
    
    this.emit('majority:voting-started', {
      votingId,
      topic,
      eligibleVoters: eligibleVoters.length,
      timeout: this.config.votingTimeout
    });
    
    return votingId;
  }

  /**
   * Cast a vote
   */
  async castVote(votingId: string, vote: Vote): Promise<void> {
    const activeVoting = this.activeVotings.get(votingId);
    
    if (!activeVoting) {
      throw new Error(`Voting session not found: ${votingId}`);
    }
    
    if (activeVoting.status !== 'open') {
      throw new Error(`Voting session is ${activeVoting.status}`);
    }
    
    if (!activeVoting.eligibleVoters.has(vote.agentId)) {
      throw new Error(`Agent ${vote.agentId} is not eligible to vote`);
    }
    
    if (activeVoting.votes.has(vote.agentId)) {
      throw new Error(`Agent ${vote.agentId} has already voted`);
    }
    
    // Validate vote choice
    const validOption = activeVoting.topic.options.find(
      opt => opt.id === vote.choice || opt.value === vote.choice
    );
    
    if (!validOption) {
      throw new Error(`Invalid voting option: ${vote.choice}`);
    }
    
    // Record vote
    activeVoting.votes.set(vote.agentId, vote);
    
    this.emit('majority:vote-cast', {
      votingId,
      agentId: vote.agentId,
      choice: vote.choice,
      votesReceived: activeVoting.votes.size,
      totalEligible: activeVoting.eligibleVoters.size
    });
    
    // Check if all votes are in
    if (activeVoting.votes.size === activeVoting.eligibleVoters.size) {
      await this.closeVoting(votingId);
    }
  }

  /**
   * Close voting and calculate results
   */
  async closeVoting(votingId: string): Promise<MajorityResult> {
    const activeVoting = this.activeVotings.get(votingId);
    
    if (!activeVoting) {
      console.warn(`Voting session not found: ${votingId}, creating fallback result`);
      return {
        topicId: votingId,
        winner: { id: 'proceed', value: 'proceed', description: 'Proceed with fallback decision' },
        votingStats: {
          totalVotes: 0,
          totalWeight: 0,
          averageConfidence: 0.5,
          maxConfidence: 0.5,
          minConfidence: 0.5
        },
        participation: {
          eligible: 0,
          voted: 0,
          abstained: 0,
          rate: 0
        },
        legitimacy: 'no-quorum' as const,
        tieBreakUsed: false,
        timestamp: new Date()
      };
    }
    
    if (activeVoting.status === 'closed') {
      throw new Error('Voting session already closed');
    }
    
    activeVoting.status = 'closed';
    
    // Calculate results
    const result = this.calculateResults(activeVoting);
    
    // Store in history
    this.votingHistory.push(result);
    
    // Clean up
    this.activeVotings.delete(votingId);
    
    this.emit('majority:voting-closed', result);
    
    return result;
  }

  /**
   * Get current voting status
   */
  getVotingStatus(votingId: string): VotingStatus | undefined {
    const activeVoting = this.activeVotings.get(votingId);
    
    if (!activeVoting) {
      return undefined;
    }
    
    return {
      id: votingId,
      status: activeVoting.status,
      votesReceived: activeVoting.votes.size,
      totalEligible: activeVoting.eligibleVoters.size,
      percentageVoted: (activeVoting.votes.size / activeVoting.eligibleVoters.size) * 100,
      timeElapsed: Date.now() - activeVoting.startTime.getTime()
    };
  }

  /**
   * Calculate voting results
   */
  private calculateResults(voting: ActiveVoting): MajorityResult {
    const votes = Array.from(voting.votes.values());
    const eligibleCount = voting.eligibleVoters.size;
    const actualCount = votes.length;
    
    // Calculate participation
    const participation: ParticipationStats = {
      eligibleVoters: eligibleCount,
      actualVoters: actualCount,
      participationRate: actualCount / eligibleCount,
      quorumMet: (actualCount / eligibleCount) >= this.config.quorumRequired!,
      abstentions: eligibleCount - actualCount
    };
    
    // Count votes per option
    const voteCounts = new Map<string, number>();
    const weightedCounts = new Map<string, number>();
    
    for (const option of voting.topic.options) {
      voteCounts.set(option.id, 0);
      weightedCounts.set(option.id, 0);
    }
    
    // Tally votes
    for (const vote of votes) {
      const optionId = typeof vote.choice === 'string' ? vote.choice : 
        voting.topic.options.find(opt => opt.value === vote.choice)?.id;
      
      if (optionId && voteCounts.has(optionId)) {
        voteCounts.set(optionId, voteCounts.get(optionId)! + 1);
        
        if (this.config.weightedVoting) {
          const weight = vote.weight || this.agentWeights.get(vote.agentId) || 1;
          weightedCounts.set(
            optionId, 
            weightedCounts.get(optionId)! + weight
          );
        }
      }
    }
    
    // Calculate percentages
    const percentages = new Map<string, number>();
    const totalVotes = this.config.weightedVoting ? 
      Array.from(weightedCounts.values()).reduce((a, b) => a + b, 0) :
      actualCount;
    
    for (const [optionId, count] of voteCounts) {
      const actualCount = this.config.weightedVoting ? 
        weightedCounts.get(optionId)! : count;
      percentages.set(optionId, totalVotes > 0 ? actualCount / totalVotes : 0);
    }
    
    // Determine winner
    let winnerId: string | null = null;
    let highestPercentage = 0;
    let tieDetected = false;
    
    for (const [optionId, percentage] of percentages) {
      if (percentage > highestPercentage) {
        highestPercentage = percentage;
        winnerId = optionId;
        tieDetected = false;
      } else if (percentage === highestPercentage && percentage > 0) {
        tieDetected = true;
      }
    }
    
    // Check if majority achieved
    const majorityAchieved = highestPercentage > this.config.votingThreshold!;
    
    // Handle ties if necessary
    let tieBreakUsed = false;
    if (tieDetected && winnerId) {
      const tiedOptions = Array.from(percentages.entries())
        .filter(([_, pct]) => pct === highestPercentage)
        .map(([id, _]) => id);
      
      winnerId = this.breakTie(tiedOptions, voting);
      tieBreakUsed = true;
    }
    
    // Determine legitimacy
    let legitimacy: 'valid' | 'no-quorum' | 'tied' | 'timeout';
    if (!participation.quorumMet) {
      legitimacy = 'no-quorum';
    } else if (tieDetected && !winnerId) {
      legitimacy = 'tied';
    } else if (voting.status === 'timeout') {
      legitimacy = 'timeout';
    } else {
      legitimacy = 'valid';
    }
    
    const winner = voting.topic.options.find(opt => opt.id === winnerId)!;
    
    const votingStats: VotingStats = {
      totalVotes: actualCount,
      votesPerOption: voteCounts,
      percentagePerOption: percentages,
      weightedScores: this.config.weightedVoting ? weightedCounts : undefined,
      majorityThreshold: this.config.votingThreshold!,
      majorityAchieved
    };
    
    return {
      topicId: voting.topic.id,
      winner,
      votingStats,
      participation,
      legitimacy,
      tieBreakUsed,
      timestamp: new Date()
    };
  }

  /**
   * Break a tie based on configured strategy
   */
  private breakTie(tiedOptions: string[], voting: ActiveVoting): string {
    switch (this.config.tieBreaker) {
      case 'queen':
        // Queen makes the final decision
        this.emit('majority:tie-break-needed', {
          votingId: voting.id,
          tiedOptions,
          strategy: 'queen'
        });
        // For now, return first option (Queen would override)
        return tiedOptions[0];
        
      case 'random':
        // Random selection
        const randomIndex = Math.floor(Math.random() * tiedOptions.length);
        return tiedOptions[randomIndex];
        
      case 'status-quo':
        // Prefer the current state or first option
        return tiedOptions[0];
        
      case 'defer':
        // Defer decision for re-vote
        this.emit('majority:decision-deferred', {
          votingId: voting.id,
          reason: 'tie'
        });
        return tiedOptions[0];
        
      default:
        return tiedOptions[0];
    }
  }

  /**
   * Get voting history
   */
  getVotingHistory(limit?: number): MajorityResult[] {
    if (limit) {
      return this.votingHistory.slice(-limit);
    }
    return [...this.votingHistory];
  }

  /**
   * Get metrics
   */
  getMetrics(): MajorityMetrics {
    const totalVotings = this.votingHistory.length;
    const validVotings = this.votingHistory.filter(r => r.legitimacy === 'valid').length;
    const tiedVotings = this.votingHistory.filter(r => r.tieBreakUsed).length;
    const noQuorumVotings = this.votingHistory.filter(r => r.legitimacy === 'no-quorum').length;
    
    const avgParticipation = this.votingHistory.length > 0 ?
      this.votingHistory.reduce((sum, r) => sum + r.participation.participationRate, 0) / totalVotings :
      0;
    
    return {
      totalVotings,
      validVotings,
      tiedVotings,
      noQuorumVotings,
      avgParticipation,
      successRate: totalVotings > 0 ? validVotings / totalVotings : 0
    };
  }

  /**
   * Generate unique voting ID
   */
  private generateVotingId(): string {
    return `vote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Type definitions
interface ActiveVoting {
  id: string;
  topic: VotingTopic;
  eligibleVoters: Set<string>;
  votes: Map<string, Vote>;
  startTime: Date;
  status: 'open' | 'closed' | 'timeout';
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