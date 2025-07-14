/**
 * Architectural Directive for Queen and Swarm
 * Defines the modular architecture, evaluation framework, and execution protocols
 */

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
  codeQuality: number;      // 0-10 scale
  testCoverage: number;     // 0-100 percentage
  performance: number;      // Response time in ms
  security: number;         // 0-10 scale
  documentation: number;    // 0-100 percentage
  modularity: number;       // 0-10 scale
  integration: number;      // 0-10 scale
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
    testCoverage: number;      // >= 95
    codeQuality: number;       // >= 9.0
    securityScore: number;     // >= 9.5
    documentation: number;     // >= 90
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

export class ArchitecturalDirective {
  private static instance: ArchitecturalDirective;
  
  public readonly gitTreeStructure: GitTreeStructure;
  public readonly designPrinciples: ModularDesignPrinciples;
  public readonly completionCriteria: CompletionCriteria;
  public readonly githubIntegration: GitHubIntegration;
  
  private constructor() {
    this.gitTreeStructure = this.initializeGitTree();
    this.designPrinciples = this.initializeDesignPrinciples();
    this.completionCriteria = this.initializeCompletionCriteria();
    this.githubIntegration = this.initializeGitHubIntegration();
  }
  
  public static getInstance(): ArchitecturalDirective {
    if (!ArchitecturalDirective.instance) {
      ArchitecturalDirective.instance = new ArchitecturalDirective();
    }
    return ArchitecturalDirective.instance;
  }
  
  private initializeGitTree(): GitTreeStructure {
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
  
  private initializeDesignPrinciples(): ModularDesignPrinciples {
    return {
      singleResponsibility: true,
      interfaceFirst: true,
      dependencyInjection: true,
      configurationDriven: true,
      testDriven: true
    };
  }
  
  private initializeCompletionCriteria(): CompletionCriteria {
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
  
  private initializeGitHubIntegration(): GitHubIntegration {
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
  
  public isModuleComplete(metrics: Partial<EvaluationMetrics>): boolean {
    const criteria = this.completionCriteria.module;
    
    return (
      (metrics.testCoverage || 0) >= criteria.testCoverage &&
      (metrics.codeQuality || 0) >= criteria.codeQuality &&
      (metrics.security || 0) >= criteria.securityScore &&
      (metrics.documentation || 0) >= criteria.documentation
    );
  }
  
  public calculateOverallCompletion(moduleStatuses: ModuleStatus[]): number {
    if (moduleStatuses.length === 0) return 0;
    
    const totalCompletion = moduleStatuses.reduce(
      (sum, module) => sum + module.completion,
      0
    );
    
    return Math.round(totalCompletion / moduleStatuses.length);
  }
  
  public generateProgressReport(
    pass: OptimizationPass,
    moduleStatuses: ModuleStatus[],
    previousMetrics?: EvaluationMetrics
  ): ProgressReport {
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
  
  private calculateQualityScore(metrics: EvaluationMetrics): number {
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
    
    const weightedScore = 
      metrics.codeQuality * weights.codeQuality +
      normalizedTestCoverage * weights.testCoverage +
      metrics.security * weights.security +
      normalizedDocumentation * weights.documentation +
      metrics.modularity * weights.modularity +
      metrics.integration * weights.integration;
    
    return Math.round(weightedScore * 10) / 10;
  }
  
  private getCurrentCommitHash(): string {
    // In real implementation, would use git command
    return `sha_${Date.now().toString(36)}`;
  }
}

// Export singleton instance
export const architecturalDirective = ArchitecturalDirective.getInstance();