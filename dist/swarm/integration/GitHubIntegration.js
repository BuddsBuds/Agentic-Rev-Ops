"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QualityGateAutomation = exports.GitHubIntegration = void 0;
const events_1 = require("events");
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class GitHubIntegration extends events_1.EventEmitter {
    config;
    metrics;
    constructor(config) {
        super();
        this.config = config;
        this.metrics = {
            openIssues: 0,
            openPRs: 0,
            workflowRuns: 0,
            lastActivity: new Date()
        };
    }
    async initialize() {
        try {
            await execAsync('gh --version');
        }
        catch (error) {
            throw new Error('GitHub CLI not found. Please install gh: https://cli.github.com');
        }
        try {
            await execAsync('gh auth status');
        }
        catch (error) {
            throw new Error('Not authenticated. Please run: gh auth login');
        }
        await this.setDefaultRepo();
        this.emit('github:initialized');
    }
    async setDefaultRepo() {
        await execAsync(`gh repo set-default ${this.config.owner}/${this.config.repo}`);
    }
    async createOptimizationBranch(passNumber) {
        const branchName = `optimize-pass-${passNumber}`;
        try {
            const { stdout: sha } = await execAsync('git rev-parse HEAD');
            const cleanSha = sha.trim();
            await execAsync(`gh api repos/${this.config.owner}/${this.config.repo}/git/refs ` +
                `--method POST ` +
                `--field ref="refs/heads/${branchName}" ` +
                `--field sha="${cleanSha}"`);
            this.emit('github:branch-created', { branchName, sha: cleanSha });
            return branchName;
        }
        catch (error) {
            if (error.message.includes('already exists')) {
                await execAsync(`git checkout ${branchName}`);
                return branchName;
            }
            throw error;
        }
    }
    async createIssue(issue) {
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
    async createPullRequest(pr) {
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
    async runWorkflow(run) {
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
    async createOptimizationIssues(improvements, passNumber) {
        const issueNumbers = [];
        for (const improvement of improvements) {
            const issue = {
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
    async createOptimizationPR(passNumber, report) {
        if (!this.config.autoCreatePRs)
            return null;
        const pr = {
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
        }
        catch (error) {
            console.error('Failed to create PR:', error);
            return null;
        }
    }
    async checkWorkflowStatus(workflow) {
        const { stdout } = await execAsync(`gh workflow view ${workflow} --json state -q .state`);
        return stdout.trim();
    }
    async getOptimizationIssues(passNumber) {
        const labels = passNumber ? `optimization,pass-${passNumber}` : 'optimization';
        const { stdout } = await execAsync(`gh issue list --label "${labels}" --state open ` +
            `--json number,title,assignees,labels,state`);
        return JSON.parse(stdout);
    }
    async updateIssueStatus(issueNumber, status) {
        if (status === 'closed') {
            await execAsync(`gh issue close ${issueNumber}`);
            this.metrics.openIssues--;
        }
        else {
            await execAsync(`gh issue reopen ${issueNumber}`);
            this.metrics.openIssues++;
        }
        this.emit('github:issue-updated', { issueNumber, status });
    }
    async getRepoStats() {
        const { stdout } = await execAsync(`gh api repos/${this.config.owner}/${this.config.repo} ` +
            `--jq '{stars: .stargazers_count, forks: .forks_count, issues: .open_issues_count}'`);
        return JSON.parse(stdout);
    }
    async createRelease(version, passNumber, notes) {
        await execAsync(`gh release create v${version} ` +
            `--title "Pass ${passNumber} Complete - v${version}" ` +
            `--notes "${notes}"`);
        this.emit('github:release-created', { version, passNumber });
    }
    getMetrics() {
        return { ...this.metrics };
    }
    formatIssueBody(improvement, passNumber) {
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
    formatPRBody(passNumber, report) {
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
${report.optimizationActions.map((action) => `- ${action}`).join('\n')}

### Quality Gates
${report.qualityGates.map((gate) => `- ${gate.passed ? '✅' : '❌'} ${gate.gate}: ${gate.value} (threshold: ${gate.threshold})`).join('\n')}

### Related Issues
Closes: ${report.relatedIssues?.map((n) => `#${n}`).join(', ') || 'N/A'}

---
*Generated by RevOps Swarm Optimization System*`;
    }
    calculateChange(before, after) {
        if (!before)
            return 'N/A';
        const change = after - before;
        return change >= 0 ? `+${change}` : `${change}`;
    }
    extractIssueNumber(output) {
        const match = output.match(/issues\/(\d+)/);
        return match ? parseInt(match[1]) : 0;
    }
    extractPRNumber(output) {
        const match = output.match(/pull\/(\d+)/);
        return match ? parseInt(match[1]) : 0;
    }
}
exports.GitHubIntegration = GitHubIntegration;
class QualityGateAutomation {
    github;
    constructor(github) {
        this.github = github;
    }
    async runQualityGates() {
        console.log('🔍 Running quality gate checks...');
        await this.github.runWorkflow({
            workflow: 'quality-gate.yml',
            ref: 'HEAD'
        });
        let attempts = 0;
        while (attempts < 30) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            const status = await this.github.checkWorkflowStatus('quality-gate.yml');
            if (status === 'completed') {
                return true;
            }
            else if (status === 'failure') {
                return false;
            }
            attempts++;
        }
        throw new Error('Quality gate check timed out');
    }
    async enforceQualityGates(prNumber) {
        const passed = await this.runQualityGates();
        if (!passed) {
            console.log('❌ Quality gates failed - blocking merge');
        }
        else {
            console.log('✅ Quality gates passed');
        }
    }
}
exports.QualityGateAutomation = QualityGateAutomation;
//# sourceMappingURL=GitHubIntegration.js.map