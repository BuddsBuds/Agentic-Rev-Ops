import * as tf from '@tensorflow/tfjs';
import { EventEmitter } from 'events';
import { NeuralLearningSystem } from '../learning/NeuralLearningSystem';
export interface TensorFlowConfig {
    backend: 'cpu' | 'webgl' | 'tensorflow';
    enableLogging: boolean;
    modelCache: boolean;
    batchSize: number;
    learningRate: number;
}
export interface MLModel {
    id: string;
    name: string;
    type: 'classification' | 'regression' | 'clustering' | 'anomaly-detection';
    architecture: ModelArchitecture;
    performance: ModelPerformance;
    model?: tf.LayersModel;
    isCompiled: boolean;
    lastTrained: Date;
}
export interface ModelArchitecture {
    inputShape: number[];
    layers: LayerConfig[];
    optimizer: tf.Optimizer;
    loss: string;
    metrics: string[];
}
export interface LayerConfig {
    type: 'dense' | 'conv2d' | 'lstm' | 'gru' | 'dropout' | 'batchNorm';
    units?: number;
    activation?: string;
    dropout?: number;
    kernelSize?: number[];
    filters?: number;
    poolSize?: number[];
}
export interface ModelPerformance {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    loss: number;
    validationLoss: number;
    epochs: number;
    trainingTime: number;
}
export interface PredictionMetrics {
    confidence: number;
    uncertainty: number;
    featureImportance: Record<string, number>;
    predictionExplanation: string[];
    alternativePredictions: Array<{
        value: any;
        probability: number;
        reasoning: string;
    }>;
}
export interface TrainingData {
    features: tf.Tensor;
    labels: tf.Tensor;
    metadata: {
        size: number;
        featureNames: string[];
        labelNames: string[];
        normalization: NormalizationParams;
    };
}
export interface NormalizationParams {
    featureMeans: number[];
    featureStds: number[];
    labelMeans?: number[];
    labelStds?: number[];
}
export interface EnsembleModel {
    id: string;
    name: string;
    models: MLModel[];
    votingStrategy: 'majority' | 'weighted' | 'stacking';
    weights?: number[];
    stackingModel?: tf.LayersModel;
    performance: ModelPerformance;
}
export declare class TensorFlowIntegration extends EventEmitter {
    private config;
    private models;
    private ensembles;
    private neuralSystem;
    private isInitialized;
    constructor(config: TensorFlowConfig, neuralSystem: NeuralLearningSystem);
    initialize(): Promise<void>;
    createCustomModel(modelId: string, architecture: ModelArchitecture, trainingData: TrainingData): Promise<MLModel>;
    trainModel(mlModel: MLModel, trainingData: TrainingData, validationData?: TrainingData): Promise<ModelPerformance>;
    predict(modelId: string, features: number[] | tf.Tensor, options?: {
        explainable?: boolean;
        ensemble?: boolean;
        topK?: number;
    }): Promise<PredictionMetrics>;
    createEnsemble(ensembleId: string, modelIds: string[], votingStrategy?: 'majority' | 'weighted' | 'stacking'): Promise<EnsembleModel>;
    detectAnomalies(data: number[][], threshold?: number): Promise<Array<{
        index: number;
        anomalyScore: number;
        explanation: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
    }>>;
    optimizeRevenueForecast(historicalData: Array<{
        date: Date;
        revenue: number;
        factors: Record<string, number>;
    }>, forecastPeriod?: number): Promise<{
        forecast: Array<{
            date: Date;
            predictedRevenue: number;
            confidence: number;
            lowerBound: number;
            upperBound: number;
        }>;
        insights: string[];
        recommendations: string[];
    }>;
    getModelAnalytics(): Promise<{
        overview: {
            totalModels: number;
            totalEnsembles: number;
            avgAccuracy: number;
            totalPredictions: number;
        };
        modelPerformance: Array<{
            id: string;
            name: string;
            type: string;
            accuracy: number;
            lastTrained: Date;
            status: 'excellent' | 'good' | 'needs-improvement' | 'poor';
        }>;
        systemMetrics: {
            memoryUsage: tf.MemoryInfo;
            backend: string;
            trainingTime: number;
        };
        recommendations: string[];
    }>;
    private initializeCoreModels;
    private initializeEnsembleModels;
    private setupAutoRetraining;
    private buildModelFromArchitecture;
    private evaluateModel;
    private createRevenueForecastModel;
    private createLeadScoringModel;
    private createAnomalyDetectionModel;
    private createDecisionOptimizationModel;
    private calculateAccuracy;
    private calculatePrecision;
    private calculateRecall;
    private calculateUncertainty;
    private getFeatureImportance;
    private generateAlternatives;
    private generateExplanation;
    private calculateConfidence;
    private createStackingModel;
    private evaluateEnsemble;
    private explainAnomaly;
    private classifyAnomalySeverity;
    private prepareTimeSeriesFeatures;
    private calculateConfidenceIntervals;
    private generateForecastInsights;
    private generateForecastRecommendations;
    private getModelStatus;
    private generateSystemRecommendations;
    dispose(): void;
}
//# sourceMappingURL=TensorFlowIntegration.d.ts.map