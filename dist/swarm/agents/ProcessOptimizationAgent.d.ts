import { BaseAgent, BaseAgentConfig } from './BaseAgent';
export interface ProcessAnalysis {
    currentState: ProcessState;
    bottlenecks: Bottleneck[];
    inefficiencies: Inefficiency[];
    automationOpportunities: AutomationOpportunity[];
    optimizationPlan: OptimizationPlan;
    expectedImprovements: ImprovementMetrics;
}
export interface ProcessState {
    steps: ProcessStep[];
    totalDuration: number;
    touchpoints: number;
    automationLevel: number;
    errorRate: number;
    reworkRate: number;
}
export interface ProcessStep {
    id: string;
    name: string;
    type: 'manual' | 'automated' | 'hybrid';
    duration: number;
    cost: number;
    errorProne: boolean;
    dependencies: string[];
}
export interface Bottleneck {
    stepId: string;
    type: 'capacity' | 'dependency' | 'approval' | 'data' | 'skill';
    impact: number;
    frequency: number;
    description: string;
    solutions: string[];
}
export interface Inefficiency {
    area: string;
    type: 'duplication' | 'delay' | 'rework' | 'overprocessing' | 'waiting';
    costImpact: number;
    timeImpact: number;
    rootCause: string;
}
export interface AutomationOpportunity {
    processArea: string;
    type: 'full' | 'partial' | 'assisted';
    complexity: 'low' | 'medium' | 'high';
    roi: number;
    implementation: ImplementationDetails;
    benefits: string[];
    risks: string[];
}
export interface ImplementationDetails {
    tools: string[];
    duration: number;
    cost: number;
    requirements: string[];
    phases: ImplementationPhase[];
}
export interface ImplementationPhase {
    name: string;
    duration: number;
    deliverables: string[];
    dependencies: string[];
}
export interface OptimizationPlan {
    quickWins: OptimizationAction[];
    shortTerm: OptimizationAction[];
    longTerm: OptimizationAction[];
    roadmap: Roadmap;
}
export interface OptimizationAction {
    id: string;
    title: string;
    description: string;
    impact: 'low' | 'medium' | 'high';
    effort: 'low' | 'medium' | 'high';
    category: string;
    timeline: string;
    dependencies: string[];
}
export interface Roadmap {
    phases: RoadmapPhase[];
    milestones: Milestone[];
    criticalPath: string[];
}
export interface RoadmapPhase {
    id: string;
    name: string;
    startWeek: number;
    duration: number;
    actions: string[];
}
export interface Milestone {
    name: string;
    week: number;
    criteria: string[];
    value: string;
}
export interface ImprovementMetrics {
    efficiencyGain: number;
    costReduction: number;
    timeReduction: number;
    qualityImprovement: number;
    customerSatisfaction: number;
}
export declare class ProcessOptimizationAgent extends BaseAgent {
    private optimizationPatterns;
    private benchmarks;
    constructor(config: Omit<BaseAgentConfig, 'type'>);
    protected initializeCapabilities(): void;
    protected performAnalysis(topic: string, context: any): Promise<ProcessAnalysis>;
    protected formulateRecommendation(topic: string, context: any, analysis: ProcessAnalysis): Promise<any>;
    protected executeTask(task: any): Promise<any>;
    private analyzeCurrentState;
    private identifyBottlenecks;
    private findInefficiencies;
    private identifyAutomationOpportunities;
    private createOptimizationPlan;
    private executeProcessMapping;
    private executeBottleneckAnalysis;
    private initializeBenchmarks;
    private extractProcessSteps;
    private calculateTotalDuration;
    private countTouchpoints;
    private calculateAutomationLevel;
    private calculateErrorRate;
    private calculateReworkRate;
    private isCapacityBottleneck;
    private calculateBottleneckImpact;
    private findDuplicateSteps;
    private normalizeStepName;
    private findProcessDelays;
    private assessAutomationPotential;
    private calculateAutomationROI;
    private recommendTools;
    private estimateImplementationTime;
    private estimateImplementationCost;
    private defineRequirements;
    private createImplementationPhases;
    private identifyAutomationRisks;
    private findEndToEndAutomation;
    private findManualProcessChains;
    private createE2EImplementationPhases;
    private calculateExpectedImprovements;
    private generateOptimizationActions;
    private createRoadmap;
    private identifyCriticalPath;
    private prioritizeActions;
    private createImplementationStrategy;
    private getImmediateActions;
    private calculateROI;
    private assessRisks;
    private createChangeManagementPlan;
    private defineSuccessMetrics;
    private executeAutomationAssessment;
    private executeWorkflowRedesign;
    private executeImplementationPlanning;
    private executeChangeManagement;
    private executeGenericOptimization;
    private mapProcessSteps;
    private mapProcessFlows;
    private identifyActors;
    private identifySystems;
    private mapDataFlows;
    private identifyDecisionPoints;
    private assessProcessComplexity;
    private assessProcessMaturity;
    private assessCompliance;
    private identifyProcessRisks;
    private generateProcessVisualization;
    private generateMappingRecommendations;
    private performBottleneckAnalysis;
    private assessBottleneckImpact;
    private generateBottleneckSolutions;
    private prioritizeBottleneckResolution;
    private createBottleneckResolutionPlan;
}
//# sourceMappingURL=ProcessOptimizationAgent.d.ts.map