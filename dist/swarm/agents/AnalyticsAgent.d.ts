import { BaseAgent, BaseAgentConfig } from './BaseAgent';
export interface AnalyticsReport {
    metrics: MetricsAnalysis;
    trends: TrendAnalysis;
    anomalies: AnomalyDetection[];
    predictions: PredictiveInsights;
    recommendations: AnalyticsRecommendation[];
}
export interface MetricsAnalysis {
    revenue: RevenueMetrics;
    conversion: ConversionMetrics;
    efficiency: EfficiencyMetrics;
    customer: CustomerMetrics;
}
export interface RevenueMetrics {
    mrr: number;
    arr: number;
    growth: number;
    churn: number;
    ltv: number;
    cac: number;
    payback: number;
}
export interface ConversionMetrics {
    overall: number;
    byStage: Record<string, number>;
    velocity: number;
    winRate: number;
}
export interface EfficiencyMetrics {
    salesProductivity: number;
    marketingROI: number;
    operationalEfficiency: number;
    costPerAcquisition: number;
}
export interface CustomerMetrics {
    satisfaction: number;
    retention: number;
    expansion: number;
    health: number;
}
export interface TrendAnalysis {
    period: string;
    direction: 'up' | 'down' | 'stable';
    magnitude: number;
    significance: number;
    forecast: any[];
}
export interface AnomalyDetection {
    metric: string;
    timestamp: Date;
    expected: number;
    actual: number;
    deviation: number;
    severity: 'low' | 'medium' | 'high';
    possibleCauses: string[];
}
export interface PredictiveInsights {
    revenueForecast: ForecastData;
    churnPrediction: ChurnData;
    growthOpportunities: OpportunityData[];
    riskFactors: RiskData[];
}
export interface ForecastData {
    period: string;
    predicted: number;
    confidence: number;
    range: {
        min: number;
        max: number;
    };
}
export interface ChurnData {
    atRiskAccounts: number;
    predictedChurn: number;
    preventableChurn: number;
    interventions: string[];
}
export interface OpportunityData {
    type: string;
    potential: number;
    probability: number;
    requirements: string[];
}
export interface RiskData {
    area: string;
    likelihood: number;
    impact: number;
    mitigation: string;
}
export interface AnalyticsRecommendation {
    category: string;
    insight: string;
    action: string;
    expectedImpact: string;
    dataSupport: any;
}
export declare class AnalyticsAgent extends BaseAgent {
    private analyticsCapabilities;
    constructor(config: Omit<BaseAgentConfig, 'type'>);
    protected initializeCapabilities(): void;
    protected performAnalysis(topic: string, context: any): Promise<AnalyticsReport>;
    protected formulateRecommendation(topic: string, context: any, analysis: AnalyticsReport): Promise<any>;
    protected executeTask(task: any): Promise<any>;
    private analyzeMetrics;
    private analyzeRevenueMetrics;
    private analyzeConversionMetrics;
    private analyzeTrends;
    private detectAnomalies;
    private generatePredictions;
    private executeMetricAnalysis;
    private executeForecast;
    private generateAnalyticsRecommendations;
    private calculateMRR;
    private calculateARR;
    private calculateGrowthRate;
    private calculateChurnRate;
    private calculateLTV;
    private calculateCAC;
    private calculatePaybackPeriod;
    private calculateOverallConversion;
    private calculateStageConversions;
    private calculateVelocity;
    private calculateWinRate;
    private detectTrend;
    private generateForecast;
    private scanForAnomalies;
    private identifyAnomalyCauses;
    private forecastRevenue;
    private predictChurn;
    private calculateChurnRisk;
    private identifyGrowthOpportunities;
    private assessRiskFactors;
    private extractKeyInsights;
    private prioritizeActions;
    private calculateRecommendationPriority;
    private createMonitoringPlan;
    private recommendDashboards;
    private defineAlertThresholds;
    private severityToNumber;
    private analyzeEfficiencyMetrics;
    private analyzeCustomerMetrics;
    private calculateSignificance;
    private predictNextValue;
    private analyzeMetric;
    private getMetricRecommendation;
    private summarizeMetrics;
    private compareMetrics;
    private selectForecastModel;
    private applyForecastModel;
    private calculateConfidenceIntervals;
    private identifyInfluencingFactors;
    private generateForecastRecommendations;
    private executeCohortAnalysis;
    private executeAttribution;
    private executeReportGeneration;
    private executeGenericAnalytics;
    private executeAnomalyScan;
}
//# sourceMappingURL=AnalyticsAgent.d.ts.map