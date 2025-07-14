"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.architecturalDirective = exports.ArchitecturalDirective = void 0;
class ArchitecturalDirective {
    static instance;
    gitTreeStructure;
    designPrinciples;
    completionCriteria;
    githubIntegration;
    constructor() {
        this.gitTreeStructure = this.initializeGitTree();
        this.designPrinciples = this.initializeDesignPrinciples();
        this.completionCriteria = this.initializeCompletionCriteria();
        this.githubIntegration = this.initializeGitHubIntegration();
    }
    static getInstance() {
        if (!ArchitecturalDirective.instance) {
            ArchitecturalDirective.instance = new ArchitecturalDirective();
        }
        return ArchitecturalDirective.instance;
    }
    initializeGitTree() {
        return {
            projectRoot: {
                '.github': {
                    workflows: ['eval-optimize.yml', 'quality-gate.yml', 'deploy-staging.yml'],
                    issueTemplates: ['optimization.md', 'bug_report.md', 'feature_request.md']
                },
                docs: {
                    architecture: ['overview.md', 'modules.md', 'integration.md'],
                    api: ['rest-api.md', 'graphql.md', 'websocket.md'],
                    deployment: ['docker.md', 'kubernetes.md', 'aws.md']
                },
                src: {
                    core: {
                        config: ['app.config.ts', 'env.config.ts', 'modules.config.ts'],
                        interfaces: ['IModule.ts', 'IService.ts', 'IAgent.ts'],
                        baseClasses: ['BaseModule.ts', 'BaseService.ts', 'BaseAgent.ts']
                    },
                    modules: {
                        integration: ['crm/', 'marketing/', 'analytics/'],
                        aiEngine: ['ml/', 'nlp/', 'decision/'],
                        communication: ['messaging/', 'events/', 'protocols/'],
                        dataLayer: ['repositories/', 'models/', 'migrations/'],
                        security: ['auth/', 'encryption/', 'audit/']
                    },
                    services: {
                        mcpServers: ['primary/', 'secondary/', 'specialized/'],
                        swarmAgents: ['queen/', 'workers/', 'coordinators/'],
                        orchestration: ['scheduler/', 'loadBalancer/', 'monitor/']
                    },
                    interfaces: {
                        api: ['rest/', 'graphql/', 'grpc/'],
                        cli: ['commands/', 'prompts/', 'outputs/'],
                        ui: ['components/', 'views/', 'state/']
                    }
                },
                tests: {
                    unit: ['modules/', 'services/', 'utils/'],
                    integration: ['api/', 'workflow/', 'system/'],
                    e2e: ['scenarios/', 'performance/', 'security/']
                },
                infrastructure: {
                    docker: ['Dockerfile', 'docker-compose.yml', '.dockerignore'],
                    k8s: ['deployments/', 'services/', 'configmaps/'],
                    terraform: ['modules/', 'environments/', 'variables/']
                },
                scripts: {
                    setup: ['install.sh', 'configure.sh', 'seed.sh'],
                    deployment: ['deploy.sh', 'rollback.sh', 'health-check.sh'],
                    maintenance: ['backup.sh', 'cleanup.sh', 'update.sh']
                }
            }
        };
    }
    initializeDesignPrinciples() {
        return {
            singleResponsibility: true,
            interfaceFirst: true,
            dependencyInjection: true,
            configurationDriven: true,
            testDriven: true
        };
    }
    initializeCompletionCriteria() {
        return {
            module: {
                testCoverage: 95,
                codeQuality: 9.0,
                securityScore: 9.5,
                documentation: 90,
                performanceSLA: true,
                integrationTestsPass: true,
                hasMonitoring: true,
                deploymentReady: true
            },
            project: {
                allModulesComplete: true,
                e2eTestsPass: true,
                performanceBenchmarksMet: true,
                securityAuditClean: true,
                documentationComplete: true,
                deploymentPipelineValidated: true
            }
        };
    }
    initializeGitHubIntegration() {
        return {
            workflowTriggers: {
                evaluationPass: 'eval-optimize.yml',
                qualityGate: 'quality-gate.yml',
                deployment: 'deploy-staging.yml'
            },
            automatedActions: {
                createOptimizationBranch: true,
                createIssuesForImprovements: true,
                createPRsForOptimizations: true,
                trackProgress: true,
                prepareReleases: true
            }
        };
    }
    isModuleComplete(metrics) {
        const criteria = this.completionCriteria.module;
        return ((metrics.testCoverage || 0) >= criteria.testCoverage &&
            (metrics.codeQuality || 0) >= criteria.codeQuality &&
            (metrics.security || 0) >= criteria.securityScore &&
            (metrics.documentation || 0) >= criteria.documentation);
    }
    calculateOverallCompletion(moduleStatuses) {
        if (moduleStatuses.length === 0)
            return 0;
        const totalCompletion = moduleStatuses.reduce((sum, module) => sum + module.completion, 0);
        return Math.round(totalCompletion / moduleStatuses.length);
    }
    generateProgressReport(pass, moduleStatuses, previousMetrics) {
        const overallCompletion = this.calculateOverallCompletion(moduleStatuses);
        const qualityScore = this.calculateQualityScore(pass.metrics);
        const criticalIssues = pass.blockers.filter(b => b.severity === 'critical').length;
        return {
            passNumber: pass.passNumber,
            timestamp: new Date(),
            commitHash: this.getCurrentCommitHash(),
            executiveSummary: {
                overallCompletion,
                qualityScore,
                criticalIssues,
                nextPassFocus: pass.nextPassObjectives[0] || 'Final optimization'
            },
            detailedMetrics: pass.metrics,
            previousMetrics,
            moduleStatus: moduleStatuses,
            optimizationActions: pass.improvements
                .filter(i => i.completed)
                .map(i => i.description),
            nextPassObjectives: pass.nextPassObjectives,
            blockers: pass.blockers
        };
    }
    calculateQualityScore(metrics) {
        const weights = {
            codeQuality: 0.25,
            testCoverage: 0.20,
            security: 0.20,
            documentation: 0.15,
            modularity: 0.10,
            integration: 0.10
        };
        const normalizedTestCoverage = metrics.testCoverage / 10;
        const normalizedDocumentation = metrics.documentation / 10;
        const weightedScore = metrics.codeQuality * weights.codeQuality +
            normalizedTestCoverage * weights.testCoverage +
            metrics.security * weights.security +
            normalizedDocumentation * weights.documentation +
            metrics.modularity * weights.modularity +
            metrics.integration * weights.integration;
        return Math.round(weightedScore * 10) / 10;
    }
    getCurrentCommitHash() {
        return `sha_${Date.now().toString(36)}`;
    }
}
exports.ArchitecturalDirective = ArchitecturalDirective;
exports.architecturalDirective = ArchitecturalDirective.getInstance();
//# sourceMappingURL=ArchitecturalDirective.js.map