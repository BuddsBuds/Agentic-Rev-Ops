import { EventEmitter } from 'events';
export interface Signal {
    id: string;
    type: SignalType;
    strength: number;
    confidence: number;
    sources: SignalSource[];
    firstDetected: Date;
    lastUpdated: Date;
    metadata: SignalMetadata;
    trajectory: SignalTrajectory;
    context: SignalContext;
}
export declare enum SignalType {
    EMERGING_TECHNOLOGY = "emerging_technology",
    MARKET_SHIFT = "market_shift",
    REGULATORY_CHANGE = "regulatory_change",
    CONSUMER_BEHAVIOR = "consumer_behavior",
    COMPETITIVE_MOVE = "competitive_move",
    ECONOMIC_INDICATOR = "economic_indicator",
    SOCIAL_TREND = "social_trend",
    SUPPLY_CHAIN = "supply_chain",
    GEOPOLITICAL = "geopolitical"
}
export declare enum SignalTrajectory {
    EMERGING = "emerging",
    ACCELERATING = "accelerating",
    PLATEAUING = "plateauing",
    DECLINING = "declining",
    CYCLICAL = "cyclical"
}
interface SignalSource {
    id: string;
    type: string;
    credibility: number;
    timestamp: Date;
    rawData: any;
}
interface SignalMetadata {
    keywords: string[];
    entities: Entity[];
    sentiment: number;
    volume: number;
    velocity: number;
    geography: string[];
    industries: string[];
}
interface SignalContext {
    relatedSignals: string[];
    historicalPatterns: Pattern[];
    industryRelevance: Map<string, number>;
    potentialImpact: ImpactAssessment;
}
interface Entity {
    type: 'company' | 'person' | 'technology' | 'product' | 'location';
    name: string;
    relevance: number;
}
interface Pattern {
    type: string;
    similarity: number;
    historicalOutcome?: string;
}
interface ImpactAssessment {
    scope: 'global' | 'regional' | 'industry' | 'company';
    magnitude: 'transformative' | 'significant' | 'moderate' | 'minor';
    timeframe: 'immediate' | 'short-term' | 'medium-term' | 'long-term';
    probability: number;
}
export declare class SignalDetectionEngine extends EventEmitter {
    private detectors;
    private signalDatabase;
    private correlationEngine;
    private mlModels;
    constructor();
    private initializeDetectors;
    detectSignals(dataStream: DataPoint[]): Promise<Signal[]>;
    private deduplicateSignals;
    private generateSignalKey;
    analyzeSignalStrength(signal: Signal): Promise<number>;
    private calculateSourceCredibility;
    private calculateVolumeVelocity;
    private crossValidateSignal;
    private checkHistoricalAccuracy;
    private getExpertValidation;
}
interface DataPoint {
    timestamp: string;
    source: string;
    value?: number;
    volume?: number;
    sentiment?: number;
    velocity?: number;
    keywords?: string[];
    entities?: Entity[];
    geography?: string[];
    industries?: string[];
    sources?: string[];
}
export default SignalDetectionEngine;
//# sourceMappingURL=signal-detection.d.ts.map