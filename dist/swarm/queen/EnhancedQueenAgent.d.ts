import { QueenAgent } from './QueenAgent';
import { EvaluationMetrics, ProgressReport, Improvement } from './ArchitecturalDirective';
export interface EnhancedQueenConfig {
    swarmId: string;
    majorityThreshold: number;
    enableArchitecturalGovernance: boolean;
    enableEvaluationLoops: boolean;
    enableGitHubIntegration: boolean;
    targetMetrics: EvaluationMetrics;
}
export interface ModuleAssignment {
    moduleId: string;
    modulePath: string;
    assignedAgents: string[];
    targetMetrics: Partial<EvaluationMetrics>;
    deadline: Date;
}
export interface EvaluationResult {
    pass: number;
    timestamp: Date;
    metrics: EvaluationMetrics;
    moduleResults: ModuleEvaluationResult[];
    improvements: Improvement[];
    nextActions: string[];
}
export interface ModuleEvaluationResult {
    moduleId: string;
    metrics: Partial<EvaluationMetrics>;
    issues: string[];
    recommendations: string[];
    assignedAgent: string;
}
export declare class EnhancedQueenAgent extends QueenAgent {
    private architecturalDirective;
    private currentPass;
    private moduleAssignments;
    private evaluationHistory;
    private config;
    constructor(config: EnhancedQueenConfig);
    private initializeArchitecturalGovernance;
    private createModuleAssignments;
    startOptimizationPass(passNumber: number): Promise<void>;
    private distributeModulesToAgents;
    private evaluateCurrentMetrics;
    runEvaluationLoop(): Promise<EvaluationResult>;
    private collectModuleResults;
    private requestModuleEvaluation;
    private aggregateMetrics;
    private identifyImprovements;
    private identifyBlockers;
    generateProgressReport(): ProgressReport;
    private createGitHubArtifacts;
    private executeGitHubCommand;
    private startEvaluationLoop;
    private categorizeRecommendation;
    private assessImpact;
    private isBlocker;
    private assessSeverity;
    private calculateModuleCompletion;
    private determineModuleStatus;
    private findModuleResult;
    private determineNextActions;
    private aggregateModuleResults;
    private averageMetrics;
}
//# sourceMappingURL=EnhancedQueenAgent.d.ts.map