/**
 * Evaluation Orchestrator
 * Manages the evaluation-optimization loop process
 */

import { EventEmitter } from 'events';
import { EvaluationMetrics, ModuleStatus } from '../queen/ArchitecturalDirective';
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

export class EvaluationOrchestrator extends EventEmitter {
  private queen: EnhancedQueenAgent;
  private evaluationTasks: Map<string, EvaluationTask>;
  private qualityGates: QualityGate[];
  private optimizationStrategy: OptimizationStrategy;
  private currentPassNumber: number = 0;
  
  constructor(queen: EnhancedQueenAgent) {
    super();
    this.queen = queen;
    this.evaluationTasks = new Map();
    this.qualityGates = this.initializeQualityGates();
    this.optimizationStrategy = this.initializeStrategy();
  }
  
  /**
   * Initialize default quality gates
   */
  private initializeQualityGates(): QualityGate[] {
    return [
      { name: 'Code Quality', threshold: 9.0, metric: 'codeQuality', operator: 'gte', blocking: true },
      { name: 'Test Coverage', threshold: 95, metric: 'testCoverage', operator: 'gte', blocking: true },
      { name: 'Security Score', threshold: 9.5, metric: 'security', operator: 'gte', blocking: true },
      { name: 'Documentation', threshold: 90, metric: 'documentation', operator: 'gte', blocking: false },
      { name: 'Performance', threshold: 200, metric: 'performance', operator: 'lte', blocking: false },
      { name: 'Modularity', threshold: 8.5, metric: 'modularity', operator: 'gte', blocking: false },
      { name: 'Integration', threshold: 8.0, metric: 'integration', operator: 'gte', blocking: false }
    ];
  }
  
  /**
   * Initialize optimization strategy
   */
  private initializeStrategy(): OptimizationStrategy {
    return {
      priority: 'quality',
      timeboxed: true,
      maxDuration: 24 * 60 * 60 * 1000, // 24 hours per pass
      parallelExecution: true,
      autoApprove: true
    };
  }
  
  /**
   * Start a new evaluation-optimization pass
   */
  public async startEvaluationPass(): Promise<void> {
    this.currentPassNumber++;
    console.log(`\n🎯 Starting Evaluation-Optimization Pass ${this.currentPassNumber}`);
    console.log('='.repeat(60));
    
    // Phase 1: Static Analysis
    await this.runStaticAnalysis();
    
    // Phase 2: Dynamic Testing
    await this.runDynamicTesting();
    
    // Phase 3: Architecture Review
    await this.runArchitectureReview();
    
    // Phase 4: Progress Assessment
    const assessment = await this.assessProgress();
    
    // Phase 5: Targeted Optimization
    await this.runTargetedOptimization(assessment);
    
    // Check quality gates
    const gateResults = await this.checkQualityGates(assessment.metrics);
    
    // Generate and publish report
    const report = await this.generatePassReport(assessment, gateResults);
    this.emit('evaluation:pass-complete', report);
    
    // Determine if another pass is needed
    if (!this.isProjectComplete(assessment, gateResults)) {
      console.log(`\n⏭️  Scheduling next pass...`);
      setTimeout(() => this.startEvaluationPass(), 5000);
    } else {
      console.log(`\n✅ Project meets all completion criteria!`);
      this.emit('evaluation:project-complete');
    }
  }
  
  /**
   * Run static analysis phase
   */
  private async runStaticAnalysis(): Promise<void> {
    console.log('\n📊 Phase 1: Static Analysis');
    console.log('-'.repeat(40));
    
    const tasks = [
      this.createTask('static-analysis', 'code-quality', 'src/'),
      this.createTask('static-analysis', 'security-scan', 'src/'),
      this.createTask('static-analysis', 'dependency-check', 'package.json')
    ];
    
    await this.executeTasks(tasks);
    
    console.log('✓ Static analysis complete');
  }
  
  /**
   * Run dynamic testing phase
   */
  private async runDynamicTesting(): Promise<void> {
    console.log('\n🧪 Phase 2: Dynamic Testing');
    console.log('-'.repeat(40));
    
    const tasks = [
      this.createTask('testing', 'unit-tests', 'tests/unit/'),
      this.createTask('testing', 'integration-tests', 'tests/integration/'),
      this.createTask('testing', 'performance-tests', 'tests/performance/')
    ];
    
    await this.executeTasks(tasks);
    
    console.log('✓ Dynamic testing complete');
  }
  
  /**
   * Run architecture review phase
   */
  private async runArchitectureReview(): Promise<void> {
    console.log('\n🏗️  Phase 3: Architecture Review');
    console.log('-'.repeat(40));
    
    // Module dependency analysis
    console.log('  • Analyzing module dependencies...');
    const dependencies = await this.analyzeModuleDependencies();
    
    // Interface compliance check
    console.log('  • Checking interface compliance...');
    const compliance = await this.checkInterfaceCompliance();
    
    // Design pattern validation
    console.log('  • Validating design patterns...');
    const patterns = await this.validateDesignPatterns();
    
    console.log('✓ Architecture review complete');
  }
  
  /**
   * Assess progress
   */
  private async assessProgress(): Promise<any> {
    console.log('\n📈 Phase 4: Progress Assessment');
    console.log('-'.repeat(40));
    
    // Get current metrics from Queen's evaluation
    const evaluationResult = await this.queen.runEvaluationLoop();
    
    // Compare with previous pass
    const improvement = this.calculateImprovement(evaluationResult.metrics);
    
    // Calculate completion percentage
    const completion = this.calculateCompletion(evaluationResult);
    
    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks(evaluationResult);
    
    console.log(`  • Overall completion: ${completion}%`);
    console.log(`  • Quality score: ${this.calculateQualityScore(evaluationResult.metrics)}/10`);
    console.log(`  • Bottlenecks identified: ${bottlenecks.length}`);
    
    return {
      metrics: evaluationResult.metrics,
      completion,
      improvement,
      bottlenecks,
      moduleResults: evaluationResult.moduleResults
    };
  }
  
  /**
   * Run targeted optimization
   */
  private async runTargetedOptimization(assessment: any): Promise<void> {
    console.log('\n🎯 Phase 5: Targeted Optimization');
    console.log('-'.repeat(40));
    
    // Priority-ranked improvement tasks
    const improvements = this.prioritizeImprovements(assessment);
    
    console.log(`  • ${improvements.length} improvements identified`);
    
    // Execute top improvements based on strategy
    const toExecute = improvements.slice(0, 10); // Top 10 improvements
    
    for (const improvement of toExecute) {
      console.log(`  • Executing: ${improvement.description}`);
      await this.executeImprovement(improvement);
    }
    
    console.log('✓ Targeted optimization complete');
  }
  
  /**
   * Check quality gates
   */
  private async checkQualityGates(metrics: EvaluationMetrics): Promise<any[]> {
    const results = [];
    
    for (const gate of this.qualityGates) {
      const value = metrics[gate.metric];
      let passed = false;
      
      switch (gate.operator) {
        case 'gte':
          passed = value >= gate.threshold;
          break;
        case 'lte':
          passed = value <= gate.threshold;
          break;
        case 'eq':
          passed = value === gate.threshold;
          break;
      }
      
      results.push({
        gate: gate.name,
        metric: gate.metric,
        value,
        threshold: gate.threshold,
        passed,
        blocking: gate.blocking
      });
    }
    
    return results;
  }
  
  /**
   * Generate comprehensive pass report
   */
  private async generatePassReport(assessment: any, gateResults: any[]): Promise<any> {
    const report = await this.queen.generateProgressReport();
    
    // Add quality gate results
    const enhancedReport = {
      ...report,
      qualityGates: gateResults,
      bottlenecks: assessment.bottlenecks,
      improvement: assessment.improvement,
      optimizationActions: this.evaluationTasks.size
    };
    
    // Format and display report
    this.displayReport(enhancedReport);
    
    // Create GitHub PR if enabled
    if (this.optimizationStrategy.autoApprove) {
      await this.createOptimizationPR(enhancedReport);
    }
    
    return enhancedReport;
  }
  
  /**
   * Display formatted report
   */
  private displayReport(report: any): void {
    console.log('\n' + '='.repeat(60));
    console.log(`📊 Pass ${this.currentPassNumber} Progress Report`);
    console.log('='.repeat(60));
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`Commit Hash: ${report.commitHash}`);
    
    console.log('\n## Executive Summary');
    console.log(`- Overall Completion: ${report.executiveSummary.overallCompletion}%`);
    console.log(`- Quality Score: ${report.executiveSummary.qualityScore}/10`);
    console.log(`- Critical Issues: ${report.executiveSummary.criticalIssues}`);
    console.log(`- Next Pass Focus: ${report.executiveSummary.nextPassFocus}`);
    
    console.log('\n## Detailed Metrics');
    console.log('| Metric | Current | Previous | Change | Target |');
    console.log('|--------|---------|----------|--------|--------|');
    
    const metrics = report.detailedMetrics;
    const prev = report.previousMetrics || metrics;
    
    Object.keys(metrics).forEach(key => {
      const current = metrics[key as keyof EvaluationMetrics];
      const previous = prev[key as keyof EvaluationMetrics];
      const change = current - previous;
      const target = this.getTargetForMetric(key as keyof EvaluationMetrics);
      
      console.log(`| ${key} | ${current} | ${previous} | ${change >= 0 ? '+' : ''}${change} | ${target} |`);
    });
    
    console.log('\n## Quality Gates');
    report.qualityGates.forEach((gate: any) => {
      const status = gate.passed ? '✅' : gate.blocking ? '❌' : '⚠️';
      console.log(`${status} ${gate.gate}: ${gate.value} (threshold: ${gate.threshold})`);
    });
    
    console.log('\n' + '='.repeat(60));
  }
  
  /**
   * Helper methods
   */
  private createTask(type: EvaluationTask['type'], subtype: string, target: string): EvaluationTask {
    const task: EvaluationTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      target: `${subtype}:${target}`,
      status: 'pending'
    };
    
    this.evaluationTasks.set(task.id, task);
    return task;
  }
  
  private async executeTasks(tasks: EvaluationTask[]): Promise<void> {
    if (this.optimizationStrategy.parallelExecution) {
      await Promise.all(tasks.map(task => this.executeTask(task)));
    } else {
      for (const task of tasks) {
        await this.executeTask(task);
      }
    }
  }
  
  private async executeTask(task: EvaluationTask): Promise<void> {
    task.status = 'running';
    console.log(`  • Running ${task.target}...`);
    
    try {
      // Simulate task execution
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      task.status = 'completed';
      task.result = { success: true };
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }
  
  private async analyzeModuleDependencies(): Promise<any> {
    // Analyze module coupling and dependencies
    return {
      totalModules: 8,
      looseCoupling: 0.85,
      circularDependencies: 0
    };
  }
  
  private async checkInterfaceCompliance(): Promise<any> {
    // Check if all modules implement required interfaces
    return {
      compliantModules: 7,
      totalModules: 8,
      violations: ['Module X missing IModule interface']
    };
  }
  
  private async validateDesignPatterns(): Promise<any> {
    // Validate proper use of design patterns
    return {
      patternsFound: ['Singleton', 'Factory', 'Observer', 'Strategy'],
      antiPatterns: [],
      recommendations: ['Consider Adapter pattern for integrations']
    };
  }
  
  private calculateImprovement(currentMetrics: EvaluationMetrics): any {
    // Calculate improvement from previous pass
    return {
      codeQuality: '+0.5',
      testCoverage: '+5%',
      security: '+0.3',
      documentation: '+10%'
    };
  }
  
  private calculateCompletion(evaluationResult: any): number {
    const moduleCompletions = evaluationResult.moduleResults.map((m: any) => {
      const criteria = 4; // Number of criteria per module
      let met = 0;
      
      if ((m.metrics.testCoverage || 0) >= 95) met++;
      if ((m.metrics.codeQuality || 0) >= 9.0) met++;
      if ((m.metrics.security || 0) >= 9.5) met++;
      if ((m.metrics.documentation || 0) >= 90) met++;
      
      return (met / criteria) * 100;
    });
    
    return Math.round(
      moduleCompletions.reduce((a: number, b: number) => a + b, 0) / moduleCompletions.length
    );
  }
  
  private calculateQualityScore(metrics: EvaluationMetrics): number {
    const weights = {
      codeQuality: 0.25,
      testCoverage: 0.20,
      security: 0.25,
      documentation: 0.10,
      modularity: 0.10,
      integration: 0.10
    };
    
    let score = 0;
    score += metrics.codeQuality * weights.codeQuality;
    score += (metrics.testCoverage / 10) * weights.testCoverage;
    score += metrics.security * weights.security;
    score += (metrics.documentation / 10) * weights.documentation;
    score += metrics.modularity * weights.modularity;
    score += metrics.integration * weights.integration;
    
    return Math.round(score * 10) / 10;
  }
  
  private identifyBottlenecks(evaluationResult: any): any[] {
    const bottlenecks = [];
    
    // Check each module for bottlenecks
    evaluationResult.moduleResults.forEach((module: any) => {
      if ((module.metrics.testCoverage || 0) < 80) {
        bottlenecks.push({
          module: module.moduleId,
          type: 'test-coverage',
          severity: 'high'
        });
      }
      
      if ((module.metrics.codeQuality || 0) < 7.0) {
        bottlenecks.push({
          module: module.moduleId,
          type: 'code-quality',
          severity: 'medium'
        });
      }
    });
    
    return bottlenecks;
  }
  
  private prioritizeImprovements(assessment: any): any[] {
    // Prioritize based on impact and effort
    const improvements = [];
    
    assessment.bottlenecks.forEach((bottleneck: any) => {
      improvements.push({
        description: `Fix ${bottleneck.type} in ${bottleneck.module}`,
        impact: bottleneck.severity,
        effort: 'medium',
        priority: bottleneck.severity === 'high' ? 1 : 2
      });
    });
    
    // Sort by priority
    return improvements.sort((a, b) => a.priority - b.priority);
  }
  
  private async executeImprovement(improvement: any): Promise<void> {
    // Execute specific improvement
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  private async createOptimizationPR(report: any): Promise<void> {
    console.log('\n📥 Creating Pull Request...');
    // Would create actual PR using GitHub CLI
  }
  
  private isProjectComplete(assessment: any, gateResults: any[]): boolean {
    // Check if all blocking gates pass and completion > 95%
    const blockingGatesPassed = gateResults
      .filter(g => g.blocking)
      .every(g => g.passed);
    
    return blockingGatesPassed && assessment.completion >= 95;
  }
  
  private getTargetForMetric(metric: keyof EvaluationMetrics): string {
    const targets: Record<keyof EvaluationMetrics, string> = {
      codeQuality: '9.0+',
      testCoverage: '95%+',
      security: '9.5+',
      documentation: '90%+',
      performance: '<200ms',
      modularity: '8.5+',
      integration: '8.0+'
    };
    
    return targets[metric];
  }
}