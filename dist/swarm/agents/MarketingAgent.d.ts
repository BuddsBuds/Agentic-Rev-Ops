import { BaseAgent, BaseAgentConfig } from './BaseAgent';
export interface MarketingAnalysis {
    campaignPerformance: CampaignMetrics;
    leadNurturing: NurturingMetrics;
    contentEffectiveness: ContentMetrics;
    channelPerformance: ChannelMetrics;
    recommendations: MarketingRecommendation[];
}
export interface CampaignMetrics {
    openRate: number;
    clickRate: number;
    conversionRate: number;
    roi: number;
    engagementScore: number;
}
export interface NurturingMetrics {
    leadProgression: number;
    touchpointEffectiveness: number;
    nurturingVelocity: number;
    dropoffRate: number;
}
export interface ContentMetrics {
    topPerformingContent: any[];
    contentGaps: string[];
    personalizationScore: number;
    relevanceScore: number;
}
export interface ChannelMetrics {
    email: ChannelData;
    social: ChannelData;
    web: ChannelData;
    paid: ChannelData;
}
export interface ChannelData {
    reach: number;
    engagement: number;
    conversion: number;
    cost: number;
    efficiency: number;
}
export interface MarketingRecommendation {
    area: string;
    action: string;
    impact: 'low' | 'medium' | 'high';
    effort: 'low' | 'medium' | 'high';
    priority: number;
}
export declare class MarketingAgent extends BaseAgent {
    private marketingMetrics;
    constructor(config: Omit<BaseAgentConfig, 'type'>);
    protected initializeCapabilities(): void;
    protected performAnalysis(topic: string, context: any): Promise<MarketingAnalysis>;
    protected formulateRecommendation(topic: string, context: any, analysis: MarketingAnalysis): Promise<any>;
    protected executeTask(task: any): Promise<any>;
    private analyzeCampaignPerformance;
    private analyzeLeadNurturing;
    private analyzeContent;
    private analyzeChannels;
    private executeCampaignOptimization;
    private executeNurturingSetup;
    private generateMarketingRecommendations;
    private calculateAvgMetric;
    private calculateROI;
    private calculateEngagementScore;
    private calculateLeadProgression;
    private analyzeTouchpoints;
    private calculateNurturingVelocity;
    private calculateDropoffRate;
    private identifyTopContent;
    private identifyContentGaps;
    private calculatePersonalizationScore;
    private calculateRelevanceScore;
    private analyzeChannel;
    private calculateChannelEfficiency;
    private identifyUnderperformingChannels;
    private projectOutcomes;
    private createMarketingPlan;
    private defineKPIs;
    private analyzeSingleCampaign;
    private optimizeSubjectLine;
    private optimizeSendTime;
    private optimizeSegmentation;
    private optimizeContent;
    private optimizeCTA;
    private createTestVariations;
    private estimateImprovement;
    private defineNurturingTriggers;
    private createNurturingStages;
    private mapContentToStages;
    private createProgressionRules;
    private defineExitCriteria;
    private createEmailSequence;
    private createScoringRules;
    private createAlertRules;
    private setupReporting;
    private identifyRequiredAssets;
    private generateEmailTemplates;
    private defineEmailTiming;
    private executeContentPersonalization;
    private executeAttributionAnalysis;
    private executeABTest;
    private executeGenericMarketingTask;
}
//# sourceMappingURL=MarketingAgent.d.ts.map