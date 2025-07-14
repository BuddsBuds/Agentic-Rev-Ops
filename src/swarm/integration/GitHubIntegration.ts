/**
 * GitHub CLI Integration
 * Provides automated GitHub operations for the swarm system
 */

import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

export class GitHubIntegration extends EventEmitter {
  private config: GitHubConfig;
  private metrics: GitHubMetrics;
  
  constructor(config: GitHubConfig) {
    super();
    this.config = config;
    this.metrics = {
      openIssues: 0,
      openPRs: 0,
      workflowRuns: 0,
      lastActivity: new Date()
    };
  }
  
  /**
   * Initialize GitHub integration
   */
  async initialize(): Promise<void> {
    // Verify GitHub CLI is available
    try {
      await execAsync('gh --version');
    } catch (error) {
      throw new Error('GitHub CLI not found. Please install gh: https://cli.github.com');
    }
    
    // Verify authentication
    try {
      await execAsync('gh auth status');
    } catch (error) {
      throw new Error('Not authenticated. Please run: gh auth login');
    }
    
    // Set default repo
    await this.setDefaultRepo();
    
    this.emit('github:initialized');
  }
  
  /**
   * Set default repository
   */
  private async setDefaultRepo(): Promise<void> {
    await execAsync(`gh repo set-default ${this.config.owner}/${this.config.repo}`);
  }
  
  /**
   * Create optimization branch for a pass
   */
  async createOptimizationBranch(passNumber: number): Promise<string> {
    const branchName = `optimize-pass-${passNumber}`;
    
    try {
      // Get current commit SHA
      const { stdout: sha } = await execAsync('git rev-parse HEAD');
      const cleanSha = sha.trim();
      
      // Create branch via API
      await execAsync(
        `gh api repos/${this.config.owner}/${this.config.repo}/git/refs ` +
        `--method POST ` +
        `--field ref="refs/heads/${branchName}" ` +
        `--field sha="${cleanSha}"`
      );
      
      this.emit('github:branch-created', { branchName, sha: cleanSha });
      return branchName;
    } catch (error) {
      if (error.message.includes('already exists')) {
        // Branch exists, switch to it
        await execAsync(`git checkout ${branchName}`);
        return branchName;
      }
      throw error;
    }
  }
  
  /**
   * Create issue
   */
  async createIssue(issue: Issue): Promise<number> {
    const labels = issue.labels.join(',');
    const assignees = issue.assignees ? issue.assignees.join(',') : '';
    
    const command = [
      'gh issue create',
      `--title "${issue.title}"`,
      `--body "${issue.body}"`,
      labels ? `--label "${labels}"` : '',
      assignees ? `--assignee "${assignees}"` : '',
      issue.milestone ? `--milestone "${issue.milestone}"` : ''
    ].filter(Boolean).join(' ');
    
    const { stdout } = await execAsync(command);
    const issueNumber = this.extractIssueNumber(stdout);
    
    this.metrics.openIssues++;
    this.metrics.lastActivity = new Date();
    
    this.emit('github:issue-created', { issueNumber, title: issue.title });
    return issueNumber;
  }
  
  /**
   * Create pull request
   */
  async createPullRequest(pr: PullRequest): Promise<number> {
    const reviewers = pr.reviewers ? pr.reviewers.join(',') : '';
    const labels = pr.labels ? pr.labels.join(',') : '';
    
    const command = [
      'gh pr create',
      `--title "${pr.title}"`,
      `--body "${pr.body}"`,
      `--head "${pr.head}"`,
      `--base "${pr.base}"`,
      pr.draft ? '--draft' : '',
      reviewers ? `--reviewer "${reviewers}"` : '',
      labels ? `--label "${labels}"` : ''
    ].filter(Boolean).join(' ');
    
    const { stdout } = await execAsync(command);
    const prNumber = this.extractPRNumber(stdout);
    
    this.metrics.openPRs++;
    this.metrics.lastActivity = new Date();
    
    this.emit('github:pr-created', { prNumber, title: pr.title });
    return prNumber;
  }
  
  /**
   * Run workflow
   */
  async runWorkflow(run: WorkflowRun): Promise<void> {
    let command = `gh workflow run ${run.workflow} --ref ${run.ref}`;
    
    if (run.inputs) {
      Object.entries(run.inputs).forEach(([key, value]) => {
        command += ` --field ${key}="${value}"`;
      });
    }
    
    await execAsync(command);
    
    this.metrics.workflowRuns++;
    this.metrics.lastActivity = new Date();
    
    this.emit('github:workflow-started', { workflow: run.workflow });
  }
  
  /**
   * Create issues for optimization improvements
   */
  async createOptimizationIssues(
    improvements: Array<{
      module: string;
      type: string;
      description: string;
      impact: string;
    }>,
    passNumber: number
  ): Promise<number[]> {
    const issueNumbers: number[] = [];
    
    for (const improvement of improvements) {
      const issue: Issue = {
        title: `Optimization: ${improvement.module} - ${improvement.type}`,
        body: this.formatIssueBody(improvement, passNumber),
        labels: ['optimization', `pass-${passNumber}`, improvement.impact, improvement.type]
      };
      
      if (this.config.autoCreateIssues) {
        const issueNumber = await this.createIssue(issue);
        issueNumbers.push(issueNumber);
      }
    }
    
    return issueNumbers;
  }
  
  /**
   * Create PR for optimization pass
   */
  async createOptimizationPR(
    passNumber: number,
    report: any
  ): Promise<number | null> {
    if (!this.config.autoCreatePRs) return null;
    
    const pr: PullRequest = {
      title: `Pass ${passNumber} Optimizations`,
      body: this.formatPRBody(passNumber, report),
      head: `optimize-pass-${passNumber}`,
      base: this.config.defaultBranch,
      labels: ['optimization', `pass-${passNumber}`],
      reviewers: ['@team-leads']
    };
    
    try {
      const prNumber = await this.createPullRequest(pr);
      return prNumber;
    } catch (error) {
      console.error('Failed to create PR:', error);
      return null;
    }
  }
  
  /**
   * Check workflow status
   */
  async checkWorkflowStatus(workflow: string): Promise<string> {
    const { stdout } = await execAsync(
      `gh workflow view ${workflow} --json state -q .state`
    );
    
    return stdout.trim();
  }
  
  /**
   * Get issue list for tracking
   */
  async getOptimizationIssues(passNumber?: number): Promise<any[]> {
    const labels = passNumber ? `optimization,pass-${passNumber}` : 'optimization';
    
    const { stdout } = await execAsync(
      `gh issue list --label "${labels}" --state open ` +
      `--json number,title,assignees,labels,state`
    );
    
    return JSON.parse(stdout);
  }
  
  /**
   * Update issue status
   */
  async updateIssueStatus(issueNumber: number, status: 'open' | 'closed'): Promise<void> {
    if (status === 'closed') {
      await execAsync(`gh issue close ${issueNumber}`);
      this.metrics.openIssues--;
    } else {
      await execAsync(`gh issue reopen ${issueNumber}`);
      this.metrics.openIssues++;
    }
    
    this.emit('github:issue-updated', { issueNumber, status });
  }
  
  /**
   * Get repository statistics
   */
  async getRepoStats(): Promise<any> {
    const { stdout } = await execAsync(
      `gh api repos/${this.config.owner}/${this.config.repo} ` +
      `--jq '{stars: .stargazers_count, forks: .forks_count, issues: .open_issues_count}'`
    );
    
    return JSON.parse(stdout);
  }
  
  /**
   * Create release
   */
  async createRelease(
    version: string,
    passNumber: number,
    notes: string
  ): Promise<void> {
    await execAsync(
      `gh release create v${version} ` +
      `--title "Pass ${passNumber} Complete - v${version}" ` +
      `--notes "${notes}"`
    );
    
    this.emit('github:release-created', { version, passNumber });
  }
  
  /**
   * Get metrics
   */
  getMetrics(): GitHubMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Format issue body
   */
  private formatIssueBody(improvement: any, passNumber: number): string {
    return `## Optimization Task

**Module**: ${improvement.module}
**Type**: ${improvement.type}
**Impact**: ${improvement.impact}
**Pass**: ${passNumber}

### Description
${improvement.description}

### Acceptance Criteria
- [ ] Implementation complete
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Code review passed

### Notes
Generated by RevOps Swarm Optimization Pass ${passNumber}`;
  }
  
  /**
   * Format PR body
   */
  private formatPRBody(passNumber: number, report: any): string {
    return `## Pass ${passNumber} Optimization Results

### Summary
- **Overall Completion**: ${report.executiveSummary.overallCompletion}%
- **Quality Score**: ${report.executiveSummary.qualityScore}/10
- **Critical Issues**: ${report.executiveSummary.criticalIssues}

### Metrics Improvement
| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Code Quality | ${report.previousMetrics?.codeQuality || 'N/A'} | ${report.detailedMetrics.codeQuality} | ${this.calculateChange(report.previousMetrics?.codeQuality, report.detailedMetrics.codeQuality)} |
| Test Coverage | ${report.previousMetrics?.testCoverage || 'N/A'} | ${report.detailedMetrics.testCoverage} | ${this.calculateChange(report.previousMetrics?.testCoverage, report.detailedMetrics.testCoverage)} |
| Security | ${report.previousMetrics?.security || 'N/A'} | ${report.detailedMetrics.security} | ${this.calculateChange(report.previousMetrics?.security, report.detailedMetrics.security)} |

### Completed Optimizations
${report.optimizationActions.map((action: string) => `- ${action}`).join('\n')}

### Quality Gates
${report.qualityGates.map((gate: any) => 
  `- ${gate.passed ? '✅' : '❌'} ${gate.gate}: ${gate.value} (threshold: ${gate.threshold})`
).join('\n')}

### Related Issues
Closes: ${report.relatedIssues?.map((n: number) => `#${n}`).join(', ') || 'N/A'}

---
*Generated by RevOps Swarm Optimization System*`;
  }
  
  /**
   * Calculate metric change
   */
  private calculateChange(before: number | undefined, after: number): string {
    if (!before) return 'N/A';
    const change = after - before;
    return change >= 0 ? `+${change}` : `${change}`;
  }
  
  /**
   * Extract issue number from output
   */
  private extractIssueNumber(output: string): number {
    const match = output.match(/issues\/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }
  
  /**
   * Extract PR number from output
   */
  private extractPRNumber(output: string): number {
    const match = output.match(/pull\/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }
}

/**
 * Quality gate automation for GitHub
 */
export class QualityGateAutomation {
  private github: GitHubIntegration;
  
  constructor(github: GitHubIntegration) {
    this.github = github;
  }
  
  /**
   * Run quality gate checks
   */
  async runQualityGates(): Promise<boolean> {
    console.log('🔍 Running quality gate checks...');
    
    // Run quality workflow
    await this.github.runWorkflow({
      workflow: 'quality-gate.yml',
      ref: 'HEAD'
    });
    
    // Wait for workflow to complete
    let attempts = 0;
    while (attempts < 30) { // 5 minutes max
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
      
      const status = await this.github.checkWorkflowStatus('quality-gate.yml');
      if (status === 'completed') {
        return true;
      } else if (status === 'failure') {
        return false;
      }
      
      attempts++;
    }
    
    throw new Error('Quality gate check timed out');
  }
  
  /**
   * Block merge if quality gates fail
   */
  async enforceQualityGates(prNumber: number): Promise<void> {
    const passed = await this.runQualityGates();
    
    if (!passed) {
      console.log('❌ Quality gates failed - blocking merge');
      // In real implementation, would use branch protection rules
    } else {
      console.log('✅ Quality gates passed');
    }
  }
}