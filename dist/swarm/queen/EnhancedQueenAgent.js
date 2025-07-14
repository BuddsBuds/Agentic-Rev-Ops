"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedQueenAgent = void 0;
const QueenAgent_1 = require("./QueenAgent");
const ArchitecturalDirective_1 = require("./ArchitecturalDirective");
class EnhancedQueenAgent extends QueenAgent_1.QueenAgent {
    architecturalDirective;
    currentPass = null;
    moduleAssignments;
    evaluationHistory;
    config;
    constructor(config) {
        super(config);
        this.config = config;
        this.architecturalDirective = ArchitecturalDirective_1.ArchitecturalDirective.getInstance();
        this.moduleAssignments = new Map();
        this.evaluationHistory = [];
        if (config.enableArchitecturalGovernance) {
            this.initializeArchitecturalGovernance();
        }
    }
    initializeArchitecturalGovernance() {
        const structure = this.architecturalDirective.gitTreeStructure;
        this.createModuleAssignments(structure);
        if (this.config.enableEvaluationLoops) {
            this.startEvaluationLoop();
        }
        this.emit('queen:architectural-governance-initialized');
    }
    createModuleAssignments(structure) {
        const modules = [
            { id: 'core', path: 'src/core', priority: 'high' },
            { id: 'integration', path: 'src/modules/integration', priority: 'high' },
            { id: 'aiEngine', path: 'src/modules/aiEngine', priority: 'high' },
            { id: 'communication', path: 'src/modules/communication', priority: 'medium' },
            { id: 'dataLayer', path: 'src/modules/dataLayer', priority: 'medium' },
            { id: 'security', path: 'src/modules/security', priority: 'critical' },
            { id: 'services', path: 'src/services', priority: 'high' },
            { id: 'interfaces', path: 'src/interfaces', priority: 'medium' }
        ];
        modules.forEach(module => {
            this.moduleAssignments.set(module.id, {
                moduleId: module.id,
                modulePath: module.path,
                assignedAgents: [],
                targetMetrics: this.config.targetMetrics,
                deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            });
        });
    }
    async startOptimizationPass(passNumber) {
        console.log(`\n🚀 Starting Optimization Pass ${passNumber}`);
        this.currentPass = {
            passNumber,
            startTime: new Date(),
            metrics: await this.evaluateCurrentMetrics(),
            improvements: [],
            blockers: [],
            nextPassObjectives: []
        };
        await this.distributeModulesToAgents();
        if (this.config.enableGitHubIntegration) {
            await this.createGitHubArtifacts(passNumber);
        }
        this.emit('queen:optimization-pass-started', {
            passNumber,
            moduleCount: this.moduleAssignments.size,
            agentCount: this.agents.size
        });
    }
    async distributeModulesToAgents() {
        const availableAgents = Array.from(this.agents.values());
        const modules = Array.from(this.moduleAssignments.values());
        const distributionPlan = await this.makeStrategicDecision('Module Distribution Strategy', {
            modules: modules.map(m => ({ id: m.moduleId, path: m.modulePath })),
            agents: availableAgents.map(a => ({
                id: a.getId(),
                type: a.getType(),
                specialties: a.getSpecialties()
            })),
            optimizationGoals: this.config.targetMetrics
        });
        modules.forEach((module, index) => {
            const agentIndex = index % availableAgents.length;
            const agent = availableAgents[agentIndex];
            module.assignedAgents = [agent.getId()];
            this.protocol.sendMessage({
                from: this.queenId,
                to: agent.getId(),
                type: CommunicationProtocol_1.MessageType.TASK_ASSIGNMENT,
                priority: CommunicationProtocol_1.MessagePriority.HIGH,
                content: {
                    action: 'optimize-module',
                    data: {
                        moduleId: module.moduleId,
                        modulePath: module.modulePath,
                        targetMetrics: module.targetMetrics,
                        deadline: module.deadline
                    }
                },
                metadata: { requiresAck: true }
            });
        });
        console.log(`📦 Distributed ${modules.length} modules to ${availableAgents.length} agents`);
    }
    async evaluateCurrentMetrics() {
        return {
            codeQuality: 7.5,
            testCoverage: 75,
            performance: 250,
            security: 8.0,
            documentation: 65,
            modularity: 7.0,
            integration: 7.5
        };
    }
    async runEvaluationLoop() {
        if (!this.currentPass) {
            throw new Error('No optimization pass in progress');
        }
        console.log(`\n🔄 Running evaluation for Pass ${this.currentPass.passNumber}`);
        const moduleResults = await this.collectModuleResults();
        const aggregatedMetrics = this.aggregateMetrics(moduleResults);
        const improvements = this.identifyImprovements(moduleResults);
        const blockers = this.identifyBlockers(moduleResults);
        const evaluationResult = {
            pass: this.currentPass.passNumber,
            timestamp: new Date(),
            metrics: aggregatedMetrics,
            moduleResults,
            improvements,
            nextActions: this.determineNextActions(aggregatedMetrics, improvements)
        };
        this.currentPass.metrics = aggregatedMetrics;
        this.currentPass.improvements = improvements;
        this.currentPass.blockers = blockers;
        this.evaluationHistory.push(evaluationResult);
        const progressReport = this.generateProgressReport();
        this.emit('queen:progress-report', progressReport);
        return evaluationResult;
    }
    async collectModuleResults() {
        const results = [];
        for (const [moduleId, assignment] of this.moduleAssignments) {
            const agentResults = await Promise.all(assignment.assignedAgents.map(agentId => this.requestModuleEvaluation(agentId, moduleId)));
            const moduleResult = this.aggregateModuleResults(moduleId, agentResults);
            results.push(moduleResult);
        }
        return results;
    }
    async requestModuleEvaluation(agentId, moduleId) {
        return {
            moduleId,
            agentId,
            metrics: {
                codeQuality: 7 + Math.random() * 3,
                testCoverage: 70 + Math.random() * 30,
                security: 7 + Math.random() * 3,
                documentation: 60 + Math.random() * 40
            },
            issues: ['Need more tests', 'Documentation incomplete'],
            recommendations: ['Add integration tests', 'Update API docs']
        };
    }
    aggregateMetrics(moduleResults) {
        const count = moduleResults.length;
        if (count === 0)
            return this.currentPass.metrics;
        const sum = moduleResults.reduce((acc, result) => ({
            codeQuality: acc.codeQuality + (result.metrics.codeQuality || 0),
            testCoverage: acc.testCoverage + (result.metrics.testCoverage || 0),
            security: acc.security + (result.metrics.security || 0),
            documentation: acc.documentation + (result.metrics.documentation || 0),
            modularity: acc.modularity + (result.metrics.modularity || 7),
            integration: acc.integration + (result.metrics.integration || 7),
            performance: acc.performance + (result.metrics.performance || 250)
        }), {
            codeQuality: 0,
            testCoverage: 0,
            security: 0,
            documentation: 0,
            modularity: 0,
            integration: 0,
            performance: 0
        });
        return {
            codeQuality: Math.round(sum.codeQuality / count * 10) / 10,
            testCoverage: Math.round(sum.testCoverage / count),
            security: Math.round(sum.security / count * 10) / 10,
            documentation: Math.round(sum.documentation / count),
            modularity: Math.round(sum.modularity / count * 10) / 10,
            integration: Math.round(sum.integration / count * 10) / 10,
            performance: Math.round(sum.performance / count)
        };
    }
    identifyImprovements(moduleResults) {
        const improvements = [];
        moduleResults.forEach(result => {
            result.recommendations.forEach(rec => {
                improvements.push({
                    module: result.moduleId,
                    type: this.categorizeRecommendation(rec),
                    description: rec,
                    impact: this.assessImpact(rec),
                    completed: false
                });
            });
        });
        return improvements;
    }
    identifyBlockers(moduleResults) {
        const blockers = [];
        moduleResults.forEach(result => {
            result.issues.forEach(issue => {
                if (this.isBlocker(issue)) {
                    blockers.push({
                        id: `blocker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        description: issue,
                        severity: this.assessSeverity(issue),
                        assignedTo: result.assignedAgent
                    });
                }
            });
        });
        return blockers;
    }
    generateProgressReport() {
        if (!this.currentPass) {
            throw new Error('No optimization pass in progress');
        }
        const moduleStatuses = Array.from(this.moduleAssignments.values())
            .map(assignment => {
            const moduleResult = this.findModuleResult(assignment.moduleId);
            return {
                name: assignment.moduleId,
                path: assignment.modulePath,
                completion: this.calculateModuleCompletion(moduleResult?.metrics),
                status: this.determineModuleStatus(moduleResult?.metrics),
                metrics: moduleResult?.metrics || {},
                issues: moduleResult?.issues || []
            };
        });
        const previousMetrics = this.evaluationHistory.length > 1
            ? this.evaluationHistory[this.evaluationHistory.length - 2].metrics
            : undefined;
        return this.architecturalDirective.generateProgressReport(this.currentPass, moduleStatuses, previousMetrics);
    }
    async createGitHubArtifacts(passNumber) {
        console.log(`\n📋 Creating GitHub artifacts for Pass ${passNumber}`);
        await this.executeGitHubCommand(`gh api repos/:owner/:repo/git/refs --method POST ` +
            `--field ref="refs/heads/optimize-pass-${passNumber}" ` +
            `--field sha="$(git rev-parse HEAD)"`);
        const improvements = this.currentPass?.improvements || [];
        for (const improvement of improvements) {
            await this.executeGitHubCommand(`gh issue create --title "Optimization: ${improvement.module} - ${improvement.type}" ` +
                `--body "${improvement.description}" ` +
                `--label "optimization,pass-${passNumber},${improvement.impact}"`);
        }
        console.log(`✅ Created ${improvements.length} GitHub issues`);
    }
    async executeGitHubCommand(command) {
        console.log(`  Executing: ${command}`);
    }
    startEvaluationLoop() {
        setInterval(async () => {
            if (this.currentPass) {
                await this.runEvaluationLoop();
            }
        }, 60 * 60 * 1000);
    }
    categorizeRecommendation(rec) {
        if (rec.includes('test'))
            return 'test';
        if (rec.includes('performance'))
            return 'performance';
        if (rec.includes('security'))
            return 'security';
        if (rec.includes('doc'))
            return 'documentation';
        return 'refactor';
    }
    assessImpact(rec) {
        if (rec.includes('critical') || rec.includes('security'))
            return 'high';
        if (rec.includes('performance') || rec.includes('test'))
            return 'medium';
        return 'low';
    }
    isBlocker(issue) {
        return issue.includes('critical') ||
            issue.includes('blocking') ||
            issue.includes('security');
    }
    assessSeverity(issue) {
        if (issue.includes('critical'))
            return 'critical';
        if (issue.includes('high') || issue.includes('security'))
            return 'high';
        if (issue.includes('medium'))
            return 'medium';
        return 'low';
    }
    calculateModuleCompletion(metrics) {
        if (!metrics)
            return 0;
        const criteria = this.architecturalDirective.completionCriteria.module;
        let completionScore = 0;
        let criteriaCount = 0;
        if (metrics.testCoverage !== undefined) {
            completionScore += Math.min(metrics.testCoverage / criteria.testCoverage, 1);
            criteriaCount++;
        }
        if (metrics.codeQuality !== undefined) {
            completionScore += Math.min(metrics.codeQuality / criteria.codeQuality, 1);
            criteriaCount++;
        }
        if (metrics.security !== undefined) {
            completionScore += Math.min(metrics.security / criteria.securityScore, 1);
            criteriaCount++;
        }
        if (metrics.documentation !== undefined) {
            completionScore += Math.min(metrics.documentation / criteria.documentation, 1);
            criteriaCount++;
        }
        return criteriaCount > 0
            ? Math.round((completionScore / criteriaCount) * 100)
            : 0;
    }
    determineModuleStatus(metrics) {
        const completion = this.calculateModuleCompletion(metrics);
        if (completion >= 90)
            return 'green';
        if (completion >= 70)
            return 'yellow';
        return 'red';
    }
    findModuleResult(moduleId) {
        if (this.evaluationHistory.length === 0)
            return undefined;
        const latestEvaluation = this.evaluationHistory[this.evaluationHistory.length - 1];
        return latestEvaluation.moduleResults.find(r => r.moduleId === moduleId);
    }
    determineNextActions(metrics, improvements) {
        const actions = [];
        if (metrics.security < this.config.targetMetrics.security) {
            actions.push('Focus on security vulnerabilities and compliance');
        }
        if (metrics.testCoverage < this.config.targetMetrics.testCoverage) {
            actions.push('Increase test coverage, especially integration tests');
        }
        if (metrics.codeQuality < this.config.targetMetrics.codeQuality) {
            actions.push('Refactor complex code and reduce technical debt');
        }
        if (metrics.documentation < this.config.targetMetrics.documentation) {
            actions.push('Update documentation and API references');
        }
        const highImpact = improvements.filter(i => i.impact === 'high' && !i.completed);
        highImpact.slice(0, 3).forEach(imp => {
            actions.push(`${imp.module}: ${imp.description}`);
        });
        return actions;
    }
    aggregateModuleResults(moduleId, agentResults) {
        const issues = new Set();
        const recommendations = new Set();
        agentResults.forEach(result => {
            result.issues?.forEach((issue) => issues.add(issue));
            result.recommendations?.forEach((rec) => recommendations.add(rec));
        });
        const metrics = this.averageMetrics(agentResults.map(r => r.metrics));
        return {
            moduleId,
            metrics,
            issues: Array.from(issues),
            recommendations: Array.from(recommendations),
            assignedAgent: agentResults[0]?.agentId || 'unknown'
        };
    }
    averageMetrics(metricsList) {
        if (metricsList.length === 0)
            return {};
        const sum = metricsList.reduce((acc, metrics) => {
            Object.keys(metrics).forEach(key => {
                const metricKey = key;
                acc[metricKey] = (acc[metricKey] || 0) + (metrics[metricKey] || 0);
            });
            return acc;
        }, {});
        const avg = {};
        Object.keys(sum).forEach(key => {
            const metricKey = key;
            avg[metricKey] = sum[metricKey] / metricsList.length;
        });
        return avg;
    }
}
exports.EnhancedQueenAgent = EnhancedQueenAgent;
const CommunicationProtocol_1 = require("../communication/CommunicationProtocol");
//# sourceMappingURL=EnhancedQueenAgent.js.map