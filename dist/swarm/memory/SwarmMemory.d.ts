import { EventEmitter } from 'events';
import { QueenDecision } from '../queen/QueenAgent';
import { MemoryEntry, Pattern } from '../types';
export interface SwarmMemoryConfig {
    retentionPeriod: number;
    maxEntries?: number;
    compressionEnabled?: boolean;
    patternDetectionEnabled?: boolean;
}
export interface MemoryQuery {
    type?: string;
    tags?: string[];
    startDate?: Date;
    endDate?: Date;
    relevanceThreshold?: number;
    limit?: number;
}
export interface MemoryHealth {
    status: 'healthy' | 'degraded' | 'critical';
    usage: number;
    entryCount: number;
    oldestEntry?: Date;
    newestEntry?: Date;
    compressionRatio?: number;
}
export interface DecisionPattern {
    pattern: string;
    frequency: number;
    avgSuccessRate: number;
    contexts: Record<string, any>[];
    recommendations: string[];
}
export declare class SwarmMemory extends EventEmitter {
    private config;
    private memory;
    private decisionHistory;
    private patterns;
    private indices;
    constructor(config: SwarmMemoryConfig);
    initialize(): Promise<void>;
    storeDecision(decision: QueenDecision): Promise<void>;
    storeAgentReport(report: any): Promise<void>;
    store(entry: MemoryEntry): Promise<void>;
    retrieve(query: MemoryQuery): Promise<MemoryEntry[]>;
    getDecisionHistory(): Promise<QueenDecision[]>;
    findSimilarDecisions(type: string, context: any): Promise<any[]>;
    analyzeDecisionPatterns(decisions: QueenDecision[]): Promise<Pattern[]>;
    getHealthStatus(): Promise<MemoryHealth>;
    private updateIndices;
    private detectPatterns;
    private evictOldestEntries;
    private removeFromIndices;
    private compressMemory;
    private calculateSimilarity;
    private wasDecisionSuccessful;
    private calculateHealthStatus;
    private getCompressionRatio;
    private loadPersistedMemory;
    private startCleanupInterval;
}
//# sourceMappingURL=SwarmMemory.d.ts.map