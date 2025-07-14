import { EventEmitter } from 'events';
import { QueenDecision } from '../queen/QueenAgent';
import { SwarmMemory } from '../memory/SwarmMemory';
export interface NeuralPattern {
    id: string;
    type: 'decision' | 'performance' | 'failure' | 'success';
    pattern: PatternSignature;
    confidence: number;
    occurrences: number;
    lastSeen: Date;
    outcomes: PatternOutcome[];
}
export interface PatternSignature {
    context: Record<string, any>;
    features: FeatureVector;
    actions: string[];
    conditions: string[];
}
export interface FeatureVector {
    dimensions: number;
    values: number[];
    labels: string[];
}
export interface PatternOutcome {
    timestamp: Date;
    success: boolean;
    metrics: Record<string, number>;
    feedback: string;
}
export interface LearningModel {
    id: string;
    type: 'decision' | 'optimization' | 'prediction';
    accuracy: number;
    trainingData: number;
    lastUpdated: Date;
    parameters: ModelParameters;
}
export interface ModelParameters {
    learningRate: number;
    epochs: number;
    hiddenLayers: number[];
    activationFunction: 'relu' | 'sigmoid' | 'tanh';
    optimizer: 'sgd' | 'adam' | 'rmsprop';
}
export interface PredictionResult {
    prediction: any;
    confidence: number;
    alternatives: Array<{
        value: any;
        probability: number;
    }>;
    reasoning: string[];
}
export interface LearningMetrics {
    totalPatterns: number;
    accuracyRate: number;
    learningProgress: number;
    predictiveCapability: number;
    adaptationSpeed: number;
}
export declare class NeuralLearningSystem extends EventEmitter {
    private patterns;
    private models;
    private memory;
    private metrics;
    private featureExtractor;
    private patternMatcher;
    constructor(memory: SwarmMemory);
    initialize(): Promise<void>;
    learnFromDecision(decision: QueenDecision, outcome: boolean, metrics: Record<string, number>): Promise<void>;
    predict(type: string, context: any, options?: string[]): Promise<PredictionResult>;
    trainModels(): Promise<void>;
    getRecommendations(type: string, context: any): Promise<Array<{
        pattern: string;
        confidence: number;
        reasoning: string;
    }>>;
    analyzeLearningProgress(): Promise<any>;
    getNeuralInsights(): Promise<Array<{
        type: string;
        insight: string;
        confidence: number;
        actionable: boolean;
    }>>;
    private initializeModels;
    private createOrUpdatePattern;
    private generatePrediction;
    private simulateNeuralPrediction;
    private startContinuousLearning;
    private loadPatterns;
    private trainModel;
    private updateLearningMetrics;
    private generatePatternId;
    private extractConditions;
    private getRecencyWeight;
    private calculateOptionProbability;
    private generateReasoning;
    private describePattern;
    private explainPattern;
    private groupByType;
    private countPatternsByType;
    private countHighConfidencePatterns;
    private calculateAverageAccuracy;
    private getLastTrainingTime;
    private calculateAccuracyTrend;
    private calculateAdaptationRate;
    private calculateLearningProgress;
    private calculatePredictiveCapability;
    private calculateAdaptationSpeed;
    private analyzeDecisionTrends;
    private pruneOldPatterns;
}
//# sourceMappingURL=NeuralLearningSystem.d.ts.map