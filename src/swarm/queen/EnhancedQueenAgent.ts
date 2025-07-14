/**
 * Enhanced Queen Agent with Architectural Directives
 * Implements modular architecture, evaluation loops, and progress reporting
 */

import { EventEmitter } from 'events';
import { QueenAgent, QueenDecision } from './QueenAgent';
import { 
  ArchitecturalDirective, 
  OptimizationPass, 
  ModuleStatus, 
  EvaluationMetrics,
  ProgressReport,
  Improvement,
  Blocker
} from './ArchitecturalDirective';
import { SwarmMemory } from '../memory/SwarmMemory';
import { CommunicationProtocol } from '../communication/CommunicationProtocol';

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

export class EnhancedQueenAgent extends QueenAgent {
  private architecturalDirective: ArchitecturalDirective;
  private currentPass: OptimizationPass | null = null;
  private moduleAssignments: Map<string, ModuleAssignment>;
  private evaluationHistory: EvaluationResult[];
  private config: EnhancedQueenConfig;
  
  constructor(config: EnhancedQueenConfig) {
    super(config);
    this.config = config;
    this.architecturalDirective = ArchitecturalDirective.getInstance();
    this.moduleAssignments = new Map();
    this.evaluationHistory = [];
    
    if (config.enableArchitecturalGovernance) {
      this.initializeArchitecturalGovernance();
    }
  }
  
  /**
   * Initialize architectural governance
   */
  private initializeArchitecturalGovernance(): void {
    // Set up module structure based on git tree
    const structure = this.architecturalDirective.gitTreeStructure;
    
    // Create module assignments for each major component
    this.createModuleAssignments(structure);
    
    // Set up evaluation loop if enabled
    if (this.config.enableEvaluationLoops) {
      this.startEvaluationLoop();
    }
    
    this.emit('queen:architectural-governance-initialized');
  }
  
  /**
   * Create module assignments based on structure
   */
  private createModuleAssignments(structure: any): void {
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
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      });
    });
  }
  
  /**
   * Start a new optimization pass
   */
  public async startOptimizationPass(passNumber: number): Promise<void> {
    console.log(`\n🚀 Starting Optimization Pass ${passNumber}`);
    
    this.currentPass = {
      passNumber,
      startTime: new Date(),
      metrics: await this.evaluateCurrentMetrics(),
      improvements: [],
      blockers: [],
      nextPassObjectives: []
    };
    
    // Distribute modules to agents
    await this.distributeModulesToAgents();
    
    // If GitHub integration is enabled, create branch and issues
    if (this.config.enableGitHubIntegration) {
      await this.createGitHubArtifacts(passNumber);
    }
    
    this.emit('queen:optimization-pass-started', {
      passNumber,
      moduleCount: this.moduleAssignments.size,
      agentCount: this.agents.size
    });
  }
  
  /**
   * Distribute modules to agents based on their capabilities
   */
  private async distributeModulesToAgents(): Promise<void> {
    const availableAgents = Array.from(this.agents.values());
    const modules = Array.from(this.moduleAssignments.values());
    
    // Strategic decision on module distribution
    const distributionPlan = await this.makeStrategicDecision(
      'Module Distribution Strategy',
      {
        modules: modules.map(m => ({ id: m.moduleId, path: m.modulePath })),
        agents: availableAgents.map(a => ({ 
          id: a.getId(), 
          type: a.getType(),
          specialties: a.getSpecialties()
        })),
        optimizationGoals: this.config.targetMetrics
      }
    );
    
    // Assign modules based on decision
    modules.forEach((module, index) => {
      const agentIndex = index % availableAgents.length;
      const agent = availableAgents[agentIndex];
      
      module.assignedAgents = [agent.getId()];
      
      // Notify agent of assignment
      this.protocol.sendMessage({
        from: this.queenId,
        to: agent.getId(),
        type: MessageType.TASK_ASSIGNMENT,
        priority: MessagePriority.HIGH,
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
  
  /**
   * Evaluate current system metrics
   */
  private async evaluateCurrentMetrics(): Promise<EvaluationMetrics> {
    // In real implementation, would run actual analysis tools
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
  
  /**
   * Run evaluation loop
   */
  public async runEvaluationLoop(): Promise<EvaluationResult> {
    if (!this.currentPass) {
      throw new Error('No optimization pass in progress');
    }
    
    console.log(`\n🔄 Running evaluation for Pass ${this.currentPass.passNumber}`);
    
    // Collect results from all agents
    const moduleResults = await this.collectModuleResults();
    
    // Aggregate metrics
    const aggregatedMetrics = this.aggregateMetrics(moduleResults);
    
    // Identify improvements and blockers
    const improvements = this.identifyImprovements(moduleResults);
    const blockers = this.identifyBlockers(moduleResults);
    
    // Create evaluation result
    const evaluationResult: EvaluationResult = {
      pass: this.currentPass.passNumber,
      timestamp: new Date(),
      metrics: aggregatedMetrics,
      moduleResults,
      improvements,
      nextActions: this.determineNextActions(aggregatedMetrics, improvements)
    };
    
    // Update current pass
    this.currentPass.metrics = aggregatedMetrics;
    this.currentPass.improvements = improvements;
    this.currentPass.blockers = blockers;
    
    // Store in history
    this.evaluationHistory.push(evaluationResult);
    
    // Generate and emit progress report
    const progressReport = this.generateProgressReport();
    this.emit('queen:progress-report', progressReport);
    
    return evaluationResult;
  }
  
  /**
   * Collect evaluation results from all modules
   */
  private async collectModuleResults(): Promise<ModuleEvaluationResult[]> {
    const results: ModuleEvaluationResult[] = [];
    
    for (const [moduleId, assignment] of this.moduleAssignments) {
      // Request evaluation from assigned agents
      const agentResults = await Promise.all(
        assignment.assignedAgents.map(agentId => 
          this.requestModuleEvaluation(agentId, moduleId)
        )
      );
      
      // Aggregate agent results for this module
      const moduleResult = this.aggregateModuleResults(moduleId, agentResults);
      results.push(moduleResult);
    }
    
    return results;
  }
  
  /**
   * Request module evaluation from an agent
   */
  private async requestModuleEvaluation(
    agentId: string, 
    moduleId: string
  ): Promise<any> {
    // In real implementation, would send actual evaluation request
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
  
  /**
   * Aggregate metrics from module results
   */
  private aggregateMetrics(moduleResults: ModuleEvaluationResult[]): EvaluationMetrics {
    const count = moduleResults.length;
    if (count === 0) return this.currentPass!.metrics;
    
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
  
  /**
   * Identify improvements from module results
   */
  private identifyImprovements(moduleResults: ModuleEvaluationResult[]): Improvement[] {
    const improvements: Improvement[] = [];
    
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
  
  /**
   * Identify blockers from module results
   */
  private identifyBlockers(moduleResults: ModuleEvaluationResult[]): Blocker[] {
    const blockers: Blocker[] = [];
    
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
  
  /**
   * Generate comprehensive progress report
   */
  public generateProgressReport(): ProgressReport {
    if (!this.currentPass) {
      throw new Error('No optimization pass in progress');
    }
    
    const moduleStatuses: ModuleStatus[] = Array.from(this.moduleAssignments.values())
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
    
    return this.architecturalDirective.generateProgressReport(
      this.currentPass,
      moduleStatuses,
      previousMetrics
    );
  }
  
  /**
   * Create GitHub artifacts for the optimization pass
   */
  private async createGitHubArtifacts(passNumber: number): Promise<void> {
    console.log(`\n📋 Creating GitHub artifacts for Pass ${passNumber}`);
    
    // Create optimization branch
    await this.executeGitHubCommand(
      `gh api repos/:owner/:repo/git/refs --method POST ` +
      `--field ref="refs/heads/optimize-pass-${passNumber}" ` +
      `--field sha="$(git rev-parse HEAD)"`
    );
    
    // Create issues for improvements
    const improvements = this.currentPass?.improvements || [];
    for (const improvement of improvements) {
      await this.executeGitHubCommand(
        `gh issue create --title "Optimization: ${improvement.module} - ${improvement.type}" ` +
        `--body "${improvement.description}" ` +
        `--label "optimization,pass-${passNumber},${improvement.impact}"`
      );
    }
    
    console.log(`✅ Created ${improvements.length} GitHub issues`);
  }
  
  /**
   * Execute GitHub CLI command
   */
  private async executeGitHubCommand(command: string): Promise<void> {
    // In real implementation, would execute actual command
    console.log(`  Executing: ${command}`);
  }
  
  /**
   * Start continuous evaluation loop
   */
  private startEvaluationLoop(): void {
    setInterval(async () => {
      if (this.currentPass) {
        await this.runEvaluationLoop();
      }
    }, 60 * 60 * 1000); // Run every hour
  }
  
  /**
   * Helper methods
   */
  private categorizeRecommendation(rec: string): Improvement['type'] {
    if (rec.includes('test')) return 'test';
    if (rec.includes('performance')) return 'performance';
    if (rec.includes('security')) return 'security';
    if (rec.includes('doc')) return 'documentation';
    return 'refactor';
  }
  
  private assessImpact(rec: string): 'low' | 'medium' | 'high' {
    if (rec.includes('critical') || rec.includes('security')) return 'high';
    if (rec.includes('performance') || rec.includes('test')) return 'medium';
    return 'low';
  }
  
  private isBlocker(issue: string): boolean {
    return issue.includes('critical') || 
           issue.includes('blocking') || 
           issue.includes('security');
  }
  
  private assessSeverity(issue: string): Blocker['severity'] {
    if (issue.includes('critical')) return 'critical';
    if (issue.includes('high') || issue.includes('security')) return 'high';
    if (issue.includes('medium')) return 'medium';
    return 'low';
  }
  
  private calculateModuleCompletion(metrics?: Partial<EvaluationMetrics>): number {
    if (!metrics) return 0;
    
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
  
  private determineModuleStatus(metrics?: Partial<EvaluationMetrics>): 'green' | 'yellow' | 'red' {
    const completion = this.calculateModuleCompletion(metrics);
    if (completion >= 90) return 'green';
    if (completion >= 70) return 'yellow';
    return 'red';
  }
  
  private findModuleResult(moduleId: string): ModuleEvaluationResult | undefined {
    if (this.evaluationHistory.length === 0) return undefined;
    
    const latestEvaluation = this.evaluationHistory[this.evaluationHistory.length - 1];
    return latestEvaluation.moduleResults.find(r => r.moduleId === moduleId);
  }
  
  private determineNextActions(
    metrics: EvaluationMetrics, 
    improvements: Improvement[]
  ): string[] {
    const actions: string[] = [];
    
    // Priority based on metrics
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
    
    // Add high-impact improvements
    const highImpact = improvements.filter(i => i.impact === 'high' && !i.completed);
    highImpact.slice(0, 3).forEach(imp => {
      actions.push(`${imp.module}: ${imp.description}`);
    });
    
    return actions;
  }
  
  private aggregateModuleResults(moduleId: string, agentResults: any[]): ModuleEvaluationResult {
    // Aggregate multiple agent evaluations for a single module
    const issues = new Set<string>();
    const recommendations = new Set<string>();
    
    agentResults.forEach(result => {
      result.issues?.forEach((issue: string) => issues.add(issue));
      result.recommendations?.forEach((rec: string) => recommendations.add(rec));
    });
    
    // Average the metrics
    const metrics = this.averageMetrics(agentResults.map(r => r.metrics));
    
    return {
      moduleId,
      metrics,
      issues: Array.from(issues),
      recommendations: Array.from(recommendations),
      assignedAgent: agentResults[0]?.agentId || 'unknown'
    };
  }
  
  private averageMetrics(metricsList: Partial<EvaluationMetrics>[]): Partial<EvaluationMetrics> {
    if (metricsList.length === 0) return {};
    
    const sum = metricsList.reduce((acc, metrics) => {
      Object.keys(metrics).forEach(key => {
        const metricKey = key as keyof EvaluationMetrics;
        acc[metricKey] = (acc[metricKey] || 0) + (metrics[metricKey] || 0);
      });
      return acc;
    }, {} as Partial<EvaluationMetrics>);
    
    const avg: Partial<EvaluationMetrics> = {};
    Object.keys(sum).forEach(key => {
      const metricKey = key as keyof EvaluationMetrics;
      avg[metricKey] = sum[metricKey]! / metricsList.length;
    });
    
    return avg;
  }
}

// Import required types from CommunicationProtocol
import { MessageType, MessagePriority } from '../communication/CommunicationProtocol';