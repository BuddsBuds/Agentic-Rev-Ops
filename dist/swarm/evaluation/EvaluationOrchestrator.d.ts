import { EventEmitter } from 'events';
import { EvaluationMetrics } from '../queen/ArchitecturalDirective';
import { EnhancedQueenAgent } from '../queen/EnhancedQueenAgent';
export interface EvaluationTask {
    id: string;
    type: 'static-analysis' | 'testing' | 'performance' | 'security' | 'documentation';
    target: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    result?: any;
    error?: string;
}
export interface QualityGate {
    name: string;
    threshold: number;
    metric: keyof EvaluationMetrics;
    operator: 'gte' | 'lte' | 'eq';
    blocking: boolean;
}
export interface OptimizationStrategy {
    priority: 'quality' | 'performance' | 'security' | 'coverage';
    timeboxed: boolean;
    maxDuration?: number;
    parallelExecution: boolean;
    autoApprove: boolean;
}
export declare class EvaluationOrchestrator extends EventEmitter {
    private queen;
    private evaluationTasks;
    private qualityGates;
    private optimizationStrategy;
    private currentPassNumber;
    constructor(queen: EnhancedQueenAgent);
    private initializeQualityGates;
    private initializeStrategy;
    startEvaluationPass(): Promise<void>;
    private runStaticAnalysis;
    private runDynamicTesting;
    private runArchitectureReview;
    private assessProgress;
    private runTargetedOptimization;
    private checkQualityGates;
    private generatePassReport;
    private displayReport;
    private createTask;
    private executeTasks;
    private executeTask;
    private analyzeModuleDependencies;
    private checkInterfaceCompliance;
    private validateDesignPatterns;
    private calculateImprovement;
    private calculateCompletion;
    private calculateQualityScore;
    private identifyBottlenecks;
    private prioritizeImprovements;
    private executeImprovement;
    private createOptimizationPR;
    private isProjectComplete;
    private getTargetForMetric;
}
//# sourceMappingURL=EvaluationOrchestrator.d.ts.map