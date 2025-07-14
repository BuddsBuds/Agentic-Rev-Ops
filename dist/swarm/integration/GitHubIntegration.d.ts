import { EventEmitter } from 'events';
export interface GitHubConfig {
    owner: string;
    repo: string;
    defaultBranch: string;
    autoCreateIssues: boolean;
    autoCreatePRs: boolean;
    enableWorkflows: boolean;
}
export interface Issue {
    title: string;
    body: string;
    labels: string[];
    assignees?: string[];
    milestone?: string;
}
export interface PullRequest {
    title: string;
    body: string;
    head: string;
    base: string;
    draft?: boolean;
    reviewers?: string[];
    labels?: string[];
}
export interface WorkflowRun {
    workflow: string;
    ref: string;
    inputs?: Record<string, any>;
}
export interface GitHubMetrics {
    openIssues: number;
    openPRs: number;
    workflowRuns: number;
    lastActivity: Date;
}
export declare class GitHubIntegration extends EventEmitter {
    private config;
    private metrics;
    constructor(config: GitHubConfig);
    initialize(): Promise<void>;
    private setDefaultRepo;
    createOptimizationBranch(passNumber: number): Promise<string>;
    createIssue(issue: Issue): Promise<number>;
    createPullRequest(pr: PullRequest): Promise<number>;
    runWorkflow(run: WorkflowRun): Promise<void>;
    createOptimizationIssues(improvements: Array<{
        module: string;
        type: string;
        description: string;
        impact: string;
    }>, passNumber: number): Promise<number[]>;
    createOptimizationPR(passNumber: number, report: any): Promise<number | null>;
    checkWorkflowStatus(workflow: string): Promise<string>;
    getOptimizationIssues(passNumber?: number): Promise<any[]>;
    updateIssueStatus(issueNumber: number, status: 'open' | 'closed'): Promise<void>;
    getRepoStats(): Promise<any>;
    createRelease(version: string, passNumber: number, notes: string): Promise<void>;
    getMetrics(): GitHubMetrics;
    private formatIssueBody;
    private formatPRBody;
    private calculateChange;
    private extractIssueNumber;
    private extractPRNumber;
}
export declare class QualityGateAutomation {
    private github;
    constructor(github: GitHubIntegration);
    runQualityGates(): Promise<boolean>;
    enforceQualityGates(prNumber: number): Promise<void>;
}
//# sourceMappingURL=GitHubIntegration.d.ts.map