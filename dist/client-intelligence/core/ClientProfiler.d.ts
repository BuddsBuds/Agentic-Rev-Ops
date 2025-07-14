import { EventEmitter } from 'events';
export interface ClientProfile {
    id: string;
    companyName: string;
    lastUpdated: Date;
    profile: {
        business: BusinessProfile;
        organizational: OrganizationalDNA;
        financial: FinancialProfile;
        technology: TechnologyProfile;
        competitive: CompetitiveProfile;
        stakeholder: StakeholderProfile;
    };
    health: ClientHealthScore;
    insights: ClientInsights;
    riskFactors: RiskFactor[];
    opportunities: Opportunity[];
}
export interface BusinessProfile {
    structure: string;
    model: string;
    revenueModel: string;
    industry: {
        primary: string;
        secondary: string[];
        naicsCode: string;
        ecosystem: string;
    };
    size: {
        employees: number;
        revenue: number;
        locations: string[];
    };
    stage: 'startup' | 'growth' | 'mature' | 'transformation';
    marketPosition: 'leader' | 'challenger' | 'follower' | 'niche';
}
export interface OrganizationalDNA {
    culture: {
        decisionSpeed: 'fast' | 'moderate' | 'deliberate';
        innovationAppetite: 'pioneer' | 'fast-follower' | 'conservative';
        riskTolerance: 'high' | 'medium' | 'low';
        collaborationStyle: 'centralized' | 'distributed' | 'hybrid';
    };
    communication: {
        preferredChannels: string[];
        frequency: 'daily' | 'weekly' | 'as-needed';
        formality: 'formal' | 'casual' | 'mixed';
        responseTime: 'immediate' | 'same-day' | 'flexible';
    };
    successMetrics: {
        primaryKPIs: string[];
        reportingCadence: 'real-time' | 'daily' | 'weekly' | 'monthly';
        philosophy: 'output' | 'outcome' | 'impact';
    };
}
export interface FinancialProfile {
    metrics: {
        revenueGrowth: number[];
        profitabilityTrends: number[];
        cashFlowPatterns: number[];
        investmentHistory: InvestmentRecord[];
    };
    health: {
        liquidity: number;
        profitability: number;
        growth: number;
        efficiency: number;
    };
    constraints: {
        budgetAvailability: number;
        roiRequirements: number;
        paybackExpectations: number;
        riskAppetite: number;
    };
}
export interface TechnologyProfile {
    stack: {
        core: TechnologyAsset[];
        integration: string[];
        maturity: 'legacy' | 'mixed' | 'modern' | 'cutting-edge';
    };
    data: {
        sources: string[];
        quality: number;
        integration: 'real-time' | 'batch' | 'mixed';
        governance: string[];
    };
    debt: {
        legacy: TechnicalDebt[];
        gaps: string[];
        vulnerabilities: SecurityVulnerability[];
        constraints: string[];
    };
    readiness: {
        cloud: number;
        api: number;
        automation: number;
        ai: number;
    };
}
export interface CompetitiveProfile {
    direct: {
        competitors: Competitor[];
        marketShare: number;
        advantages: string[];
        vulnerabilities: string[];
    };
    indirect: {
        substitutes: string[];
        newEntrants: string[];
        threats: ThreatAssessment[];
    };
    positioning: {
        differentiation: string[];
        defensibility: number;
        loyaltyFactors: string[];
        innovationPipeline: string[];
    };
}
export interface StakeholderProfile {
    decisionMakers: {
        executives: Executive[];
        board: BoardMember[];
        influencers: Influencer[];
    };
    network: {
        customers: KeyCustomer[];
        partners: StrategicPartner[];
        investors: Investor[];
        advisors: Advisor[];
    };
    dynamics: {
        powerStructure: string;
        conflictAreas: string[];
        coalitions: string[];
        changeAgents: string[];
    };
}
export interface ClientHealthScore {
    overall: number;
    dimensions: {
        financial: number;
        operational: number;
        strategic: number;
        technological: number;
        market: number;
        relationship: number;
    };
    trend: 'improving' | 'stable' | 'declining';
    alerts: HealthAlert[];
}
export interface ClientInsights {
    strengths: Insight[];
    weaknesses: Insight[];
    opportunities: Insight[];
    threats: Insight[];
    recommendations: Recommendation[];
    predictions: Prediction[];
}
interface InvestmentRecord {
    date: Date;
    amount: number;
    type: string;
    source: string;
    use: string;
}
interface TechnologyAsset {
    name: string;
    vendor: string;
    version: string;
    role: string;
    criticality: 'critical' | 'important' | 'nice-to-have';
}
interface TechnicalDebt {
    system: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    impact: string;
    effort: number;
}
interface SecurityVulnerability {
    system: string;
    type: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    exposure: string;
}
interface Competitor {
    name: string;
    marketShare: number;
    strengths: string[];
    weaknesses: string[];
    strategy: string;
}
interface ThreatAssessment {
    source: string;
    type: string;
    probability: number;
    impact: number;
    timeline: string;
}
interface Executive {
    name: string;
    role: string;
    tenure: number;
    background: string;
    priorities: string[];
    influence: number;
}
interface BoardMember {
    name: string;
    background: string;
    expertise: string[];
    tenure: number;
    independence: boolean;
}
interface Influencer {
    name: string;
    role: string;
    department: string;
    influence: number;
    priorities: string[];
}
interface KeyCustomer {
    name: string;
    revenue: number;
    relationship: string;
    risk: number;
}
interface StrategicPartner {
    name: string;
    type: string;
    value: number;
    dependency: number;
}
interface Investor {
    name: string;
    type: string;
    ownership: number;
    involvement: string;
}
interface Advisor {
    name: string;
    expertise: string;
    influence: number;
    tenure: number;
}
interface HealthAlert {
    level: 'critical' | 'warning' | 'info';
    category: string;
    message: string;
    action: string;
}
interface Insight {
    category: string;
    description: string;
    evidence: string[];
    confidence: number;
    impact: number;
}
interface Recommendation {
    id: string;
    title: string;
    description: string;
    rationale: string;
    impact: {
        financial: number;
        strategic: number;
        operational: number;
    };
    effort: {
        time: number;
        resources: string[];
        complexity: 'low' | 'medium' | 'high';
    };
    risk: {
        level: 'low' | 'medium' | 'high';
        factors: string[];
        mitigation: string[];
    };
    priority: 'critical' | 'high' | 'medium' | 'low';
    timeline: string;
    dependencies: string[];
}
interface Prediction {
    category: string;
    outcome: string;
    probability: number;
    timeline: string;
    confidence: number;
    indicators: string[];
}
interface RiskFactor {
    type: string;
    description: string;
    probability: number;
    impact: number;
    timeline: string;
    mitigation: string[];
}
interface Opportunity {
    type: string;
    description: string;
    value: number;
    probability: number;
    timeline: string;
    requirements: string[];
}
export declare class ClientProfiler extends EventEmitter {
    private profiles;
    private dataCollectors;
    private analyzers;
    private scoringEngine;
    constructor();
    private initializeCollectors;
    private initializeAnalyzers;
    createProfile(clientId: string, initialData: any): Promise<ClientProfile>;
    updateProfile(clientId: string): Promise<ClientProfile>;
    getProfile(clientId: string): Promise<ClientProfile | null>;
    getAllProfiles(): Promise<ClientProfile[]>;
    searchProfiles(criteria: SearchCriteria): Promise<ClientProfile[]>;
    getHealthTrends(clientId: string, timeframe: string): Promise<HealthTrend[]>;
    generateRecommendations(clientId: string): Promise<Recommendation[]>;
    private collectAllData;
    private runAllAnalyses;
    private buildProfile;
    private generateInsights;
    private collectIncrementalData;
    private updateAnalyses;
    private rebuildProfile;
    private updateInsights;
    private matchesCriteria;
    private getHistoricalHealthData;
    private analyzeTrends;
    private generateBusinessRecommendations;
    private generateTechnologyRecommendations;
    private generateFinancialRecommendations;
    private generateCompetitiveRecommendations;
    private generateRiskRecommendations;
    private prioritizeRecommendations;
    private calculateRecommendationScore;
}
interface SearchCriteria {
    industry?: string;
    size?: string;
    healthScore?: {
        min: number;
        max: number;
    };
    location?: string;
}
interface HealthTrend {
    date: Date;
    score: number;
    change: number;
}
export {};
//# sourceMappingURL=ClientProfiler.d.ts.map