import { BaseAgent, BaseAgentConfig } from './BaseAgent';
export interface CRMAnalysis {
    leadQuality: number;
    pipelineHealth: number;
    conversionRates: Record<string, number>;
    bottlenecks: string[];
    opportunities: string[];
    recommendations: string[];
}
export declare class CRMAgent extends BaseAgent {
    private crmMetrics;
    constructor(config: Omit<BaseAgentConfig, 'type'>);
    protected initializeCapabilities(): void;
    protected performAnalysis(topic: string, context: any): Promise<CRMAnalysis>;
    protected formulateRecommendation(topic: string, context: any, analysis: CRMAnalysis): Promise<any>;
    protected executeTask(task: any): Promise<any>;
    private analyzeLeadQuality;
    private analyzePipelineHealth;
    private identifyBottlenecks;
    private analyzeConversionRates;
    private executeLeadScoring;
    private executePipelineAnalysis;
    private calculateLeadScore;
    private getLeadGrade;
    private determineAction;
    private calculatePriority;
    private createImplementationPlan;
    private estimateImpact;
    private assessDataCompleteness;
    private assessEngagementLevel;
    private assessProductMarketFit;
    private assessTimingRelevance;
    private generateLeadRecommendations;
    private generatePipelineRecommendations;
    private generateConversionRecommendations;
    private identifyResources;
    private executeSegmentation;
    private executeForecast;
    private executeDataCleanup;
    private executeGenericCRMTask;
    private calculatePipelineVelocity;
    private assessStageBalance;
    private analyzeOpportunityAging;
    private calculatePipelineCoverage;
    private identifyOpportunities;
    private generateForecast;
    private getLeadRecommendations;
}
//# sourceMappingURL=CRMAgent.d.ts.map