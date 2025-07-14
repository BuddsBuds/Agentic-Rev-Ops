import { EventEmitter } from 'events';
export interface ForecastModel {
    id: string;
    type: 'ARIMA' | 'LSTM' | 'LINEAR' | 'PROPHET' | 'ENSEMBLE';
    accuracy: number;
    confidence: number;
    lastTrained: Date;
    parameters: any;
    metadata: ModelMetadata;
}
export interface ModelMetadata {
    trainingPeriod: number;
    features: string[];
    hyperparameters: any;
    validationScore: number;
    crossValidationScores: number[];
}
export interface ForecastResult {
    metric: string;
    predictions: ForecastPoint[];
    confidence: ConfidenceInterval[];
    model: ForecastModel;
    factors: InfluencingFactor[];
    scenarios: ScenarioAnalysis[];
    recommendations: ForecastRecommendation[];
}
export interface ForecastPoint {
    period: Date;
    value: number;
    trend: number;
    seasonal: number;
    residual: number;
}
export interface ConfidenceInterval {
    period: Date;
    lower: number;
    upper: number;
    probability: number;
}
export interface InfluencingFactor {
    name: string;
    impact: number;
    confidence: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    description: string;
}
export interface ScenarioAnalysis {
    name: string;
    probability: number;
    outcome: number;
    factors: Record<string, number>;
    description: string;
}
export interface ForecastRecommendation {
    type: 'optimization' | 'risk-mitigation' | 'opportunity';
    priority: 'high' | 'medium' | 'low';
    action: string;
    expectedImpact: number;
    timeframe: string;
    requirements: string[];
}
export interface RevenueMetrics {
    mrr: number;
    arr: number;
    growth: number;
    churn: number;
    expansion: number;
    newBusiness: number;
    ltv: number;
    cac: number;
    paybackPeriod: number;
}
export declare class RevenueForecaster extends EventEmitter {
    private models;
    private mlModels;
    private isInitialized;
    constructor();
    private initializeModels;
    forecastRevenue(historicalData: any[], horizon?: number, metrics?: string[]): Promise<Map<string, ForecastResult>>;
    private forecastMetric;
    private prepareTimeSeriesData;
    private selectBestModel;
    private evaluateModel;
    private generatePredictions;
    private linearForecast;
    private lstmForecast;
    private arimaForecast;
    private ensembleForecast;
    private calculateConfidenceIntervals;
    private analyzeInfluencingFactors;
    private generateScenarios;
    private generateRecommendations;
    private detectSeasonality;
    private detectTrend;
    private _detrend;
    private prepareSequences;
    private calculateAccuracy;
    private predictWithModel;
    private initializeLinearModel;
    private initializeLSTMModel;
    private initializeEnsembleModel;
    trainModel(modelId: string, trainingData: any[]): Promise<void>;
    private trainLSTMModel;
    private trainLinearModel;
    generateOptimizationSuggestions(forecasts: Map<string, ForecastResult>): any[];
}
export default RevenueForecaster;
//# sourceMappingURL=RevenueForecasting.d.ts.map