export interface GitTreeStructure {
    projectRoot: {
        '.github': {
            workflows: string[];
            issueTemplates: string[];
        };
        docs: {
            architecture: string[];
            api: string[];
            deployment: string[];
        };
        src: {
            core: {
                config: string[];
                interfaces: string[];
                baseClasses: string[];
            };
            modules: {
                integration: string[];
                aiEngine: string[];
                communication: string[];
                dataLayer: string[];
                security: string[];
            };
            services: {
                mcpServers: string[];
                swarmAgents: string[];
                orchestration: string[];
            };
            interfaces: {
                api: string[];
                cli: string[];
                ui: string[];
            };
        };
        tests: {
            unit: string[];
            integration: string[];
            e2e: string[];
        };
        infrastructure: {
            docker: string[];
            k8s: string[];
            terraform: string[];
        };
        scripts: {
            setup: string[];
            deployment: string[];
            maintenance: string[];
        };
    };
}
export interface ModularDesignPrinciples {
    singleResponsibility: boolean;
    interfaceFirst: boolean;
    dependencyInjection: boolean;
    configurationDriven: boolean;
    testDriven: boolean;
}
export interface EvaluationMetrics {
    codeQuality: number;
    testCoverage: number;
    performance: number;
    security: number;
    documentation: number;
    modularity: number;
    integration: number;
}
export interface OptimizationPass {
    passNumber: number;
    startTime: Date;
    endTime?: Date;
    metrics: EvaluationMetrics;
    improvements: Improvement[];
    blockers: Blocker[];
    nextPassObjectives: string[];
}
export interface Improvement {
    module: string;
    type: 'refactor' | 'performance' | 'security' | 'documentation' | 'test';
    description: string;
    impact: 'low' | 'medium' | 'high';
    completed: boolean;
}
export interface Blocker {
    id: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    assignedTo?: string;
    resolution?: string;
}
export interface ProgressReport {
    passNumber: number;
    timestamp: Date;
    commitHash: string;
    executiveSummary: {
        overallCompletion: number;
        qualityScore: number;
        criticalIssues: number;
        nextPassFocus: string;
    };
    detailedMetrics: EvaluationMetrics;
    previousMetrics?: EvaluationMetrics;
    moduleStatus: ModuleStatus[];
    optimizationActions: string[];
    nextPassObjectives: string[];
    blockers: Blocker[];
}
export interface ModuleStatus {
    name: string;
    path: string;
    completion: number;
    status: 'green' | 'yellow' | 'red';
    metrics: Partial<EvaluationMetrics>;
    issues: string[];
}
export interface GitHubIntegration {
    workflowTriggers: {
        evaluationPass: string;
        qualityGate: string;
        deployment: string;
    };
    automatedActions: {
        createOptimizationBranch: boolean;
        createIssuesForImprovements: boolean;
        createPRsForOptimizations: boolean;
        trackProgress: boolean;
        prepareReleases: boolean;
    };
}
export interface CompletionCriteria {
    module: {
        testCoverage: number;
        codeQuality: number;
        securityScore: number;
        documentation: number;
        performanceSLA: boolean;
        integrationTestsPass: boolean;
        hasMonitoring: boolean;
        deploymentReady: boolean;
    };
    project: {
        allModulesComplete: boolean;
        e2eTestsPass: boolean;
        performanceBenchmarksMet: boolean;
        securityAuditClean: boolean;
        documentationComplete: boolean;
        deploymentPipelineValidated: boolean;
    };
}
export declare class ArchitecturalDirective {
    private static instance;
    readonly gitTreeStructure: GitTreeStructure;
    readonly designPrinciples: ModularDesignPrinciples;
    readonly completionCriteria: CompletionCriteria;
    readonly githubIntegration: GitHubIntegration;
    private constructor();
    static getInstance(): ArchitecturalDirective;
    private initializeGitTree;
    private initializeDesignPrinciples;
    private initializeCompletionCriteria;
    private initializeGitHubIntegration;
    isModuleComplete(metrics: Partial<EvaluationMetrics>): boolean;
    calculateOverallCompletion(moduleStatuses: ModuleStatus[]): number;
    generateProgressReport(pass: OptimizationPass, moduleStatuses: ModuleStatus[], previousMetrics?: EvaluationMetrics): ProgressReport;
    private calculateQualityScore;
    private getCurrentCommitHash;
}
export declare const architecturalDirective: ArchitecturalDirective;
//# sourceMappingURL=ArchitecturalDirective.d.ts.map