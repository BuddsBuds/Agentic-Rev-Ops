"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MajorityEngine = void 0;
const events_1 = require("events");
class MajorityEngine extends events_1.EventEmitter {
    config;
    activeVotings;
    votingHistory;
    agentWeights;
    constructor(config = {}) {
        super();
        this.config = {
            votingThreshold: config.votingThreshold || 0.5,
            quorumRequired: config.quorumRequired || 0.5,
            tieBreaker: config.tieBreaker || 'queen',
            votingTimeout: config.votingTimeout || 30000,
            weightedVoting: config.weightedVoting || false
        };
        this.activeVotings = new Map();
        this.votingHistory = [];
        this.agentWeights = new Map();
    }
    async initialize() {
        this.emit('majority:initialized');
    }
    setAgentWeight(agentId, weight) {
        if (weight < 0 || weight > 1) {
            throw new Error('Weight must be between 0 and 1');
        }
        this.agentWeights.set(agentId, weight);
    }
    async startVoting(topic, eligibleVoters) {
        const votingId = this.generateVotingId();
        const activeVoting = {
            id: votingId,
            topic,
            eligibleVoters: new Set(eligibleVoters),
            votes: new Map(),
            startTime: new Date(),
            status: 'open'
        };
        this.activeVotings.set(votingId, activeVoting);
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
    async castVote(votingId, vote) {
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
        const validOption = activeVoting.topic.options.find(opt => opt.id === vote.choice || opt.value === vote.choice);
        if (!validOption) {
            throw new Error(`Invalid voting option: ${vote.choice}`);
        }
        activeVoting.votes.set(vote.agentId, vote);
        this.emit('majority:vote-cast', {
            votingId,
            agentId: vote.agentId,
            choice: vote.choice,
            votesReceived: activeVoting.votes.size,
            totalEligible: activeVoting.eligibleVoters.size
        });
        if (activeVoting.votes.size === activeVoting.eligibleVoters.size) {
            await this.closeVoting(votingId);
        }
    }
    async closeVoting(votingId) {
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
                legitimacy: 'no-quorum',
                tieBreakUsed: false,
                timestamp: new Date()
            };
        }
        if (activeVoting.status === 'closed') {
            throw new Error('Voting session already closed');
        }
        activeVoting.status = 'closed';
        const result = this.calculateResults(activeVoting);
        this.votingHistory.push(result);
        this.activeVotings.delete(votingId);
        this.emit('majority:voting-closed', result);
        return result;
    }
    getVotingStatus(votingId) {
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
    calculateResults(voting) {
        const votes = Array.from(voting.votes.values());
        const eligibleCount = voting.eligibleVoters.size;
        const actualCount = votes.length;
        const participation = {
            eligibleVoters: eligibleCount,
            actualVoters: actualCount,
            participationRate: actualCount / eligibleCount,
            quorumMet: (actualCount / eligibleCount) >= this.config.quorumRequired,
            abstentions: eligibleCount - actualCount
        };
        const voteCounts = new Map();
        const weightedCounts = new Map();
        for (const option of voting.topic.options) {
            voteCounts.set(option.id, 0);
            weightedCounts.set(option.id, 0);
        }
        for (const vote of votes) {
            const optionId = typeof vote.choice === 'string' ? vote.choice :
                voting.topic.options.find(opt => opt.value === vote.choice)?.id;
            if (optionId && voteCounts.has(optionId)) {
                voteCounts.set(optionId, voteCounts.get(optionId) + 1);
                if (this.config.weightedVoting) {
                    const weight = vote.weight || this.agentWeights.get(vote.agentId) || 1;
                    weightedCounts.set(optionId, weightedCounts.get(optionId) + weight);
                }
            }
        }
        const percentages = new Map();
        const totalVotes = this.config.weightedVoting ?
            Array.from(weightedCounts.values()).reduce((a, b) => a + b, 0) :
            actualCount;
        for (const [optionId, count] of voteCounts) {
            const actualCount = this.config.weightedVoting ?
                weightedCounts.get(optionId) : count;
            percentages.set(optionId, totalVotes > 0 ? actualCount / totalVotes : 0);
        }
        let winnerId = null;
        let highestPercentage = 0;
        let tieDetected = false;
        for (const [optionId, percentage] of percentages) {
            if (percentage > highestPercentage) {
                highestPercentage = percentage;
                winnerId = optionId;
                tieDetected = false;
            }
            else if (percentage === highestPercentage && percentage > 0) {
                tieDetected = true;
            }
        }
        const majorityAchieved = highestPercentage > this.config.votingThreshold;
        let tieBreakUsed = false;
        if (tieDetected && winnerId) {
            const tiedOptions = Array.from(percentages.entries())
                .filter(([_, pct]) => pct === highestPercentage)
                .map(([id, _]) => id);
            winnerId = this.breakTie(tiedOptions, voting);
            tieBreakUsed = true;
        }
        let legitimacy;
        if (!participation.quorumMet) {
            legitimacy = 'no-quorum';
        }
        else if (tieDetected && !winnerId) {
            legitimacy = 'tied';
        }
        else if (voting.status === 'timeout') {
            legitimacy = 'timeout';
        }
        else {
            legitimacy = 'valid';
        }
        const winner = voting.topic.options.find(opt => opt.id === winnerId);
        const votingStats = {
            totalVotes: actualCount,
            votesPerOption: voteCounts,
            percentagePerOption: percentages,
            weightedScores: this.config.weightedVoting ? weightedCounts : undefined,
            majorityThreshold: this.config.votingThreshold,
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
    breakTie(tiedOptions, voting) {
        switch (this.config.tieBreaker) {
            case 'queen':
                this.emit('majority:tie-break-needed', {
                    votingId: voting.id,
                    tiedOptions,
                    strategy: 'queen'
                });
                return tiedOptions[0];
            case 'random':
                const randomIndex = Math.floor(Math.random() * tiedOptions.length);
                return tiedOptions[randomIndex];
            case 'status-quo':
                return tiedOptions[0];
            case 'defer':
                this.emit('majority:decision-deferred', {
                    votingId: voting.id,
                    reason: 'tie'
                });
                return tiedOptions[0];
            default:
                return tiedOptions[0];
        }
    }
    getVotingHistory(limit) {
        if (limit) {
            return this.votingHistory.slice(-limit);
        }
        return [...this.votingHistory];
    }
    getMetrics() {
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
    generateVotingId() {
        return `vote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.MajorityEngine = MajorityEngine;
//# sourceMappingURL=MajorityEngine.js.map