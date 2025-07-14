// Human-in-the-Loop Orchestrator - Central coordination system
import { EventEmitter } from 'events';
import { HumanInTheLoopManager, HumanReviewRequest } from '../interfaces/hitl-manager';
import { SwarmMemory } from '../../../swarm/memory/SwarmMemory';
import { SwarmCoordinator } from '../../../swarm/coordinator/SwarmCoordinator';

export interface HITLDecision {
  id: string;
  type: 'strategic' | 'approval' | 'validation' | 'override' | 'escalation';
  title: string;
  description: string;
  context: {
    swarmId: string;
    agentId: string;
    confidence: number;
    recommendations: AgentRecommendation[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    financialImpact?: number;
    timeframe: string;
    stakeholders: string[];
  };
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    priority: 'low' | 'medium' | 'high' | 'critical';
    tags: string[];
    clientId?: string;
    projectId?: string;
  };
  humanReviewRequired: boolean;
  autoExecutionAllowed: boolean;
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'executed' | 'cancelled';
}

export interface AgentRecommendation {
  agentId: string;
  agentType: string;
  recommendation: string;
  confidence: number;
  reasoning: string;
  suggestedActions: string[];
  estimatedImpact: {
    revenue?: number;
    risk?: number;
    timeToImplement?: number;
  };
}

export interface HITLConfiguration {
  autoApprovalThreshold: number;
  escalationThreshold: number;
  reviewTimeoutMinutes: number;
  criticalDecisionRequiresApproval: boolean;
  financialImpactThreshold: number;
  enableLearningFromDecisions: boolean;
}

export class HITLOrchestrator extends EventEmitter {
  private decisions: Map<string, HITLDecision> = new Map();
  private hitlManager: HumanInTheLoopManager;
  private swarmMemory: SwarmMemory;
  private swarmCoordinator: SwarmCoordinator;
  private config: HITLConfiguration;
  private learningPatterns: Map<string, any> = new Map();

  constructor(
    hitlManager: HumanInTheLoopManager,
    swarmMemory: SwarmMemory,
    swarmCoordinator: SwarmCoordinator,
    config: HITLConfiguration
  ) {
    super();
    this.hitlManager = hitlManager;
    this.swarmMemory = swarmMemory;
    this.swarmCoordinator = swarmCoordinator;
    this.config = config;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Listen for swarm decisions requiring HITL intervention
    this.swarmCoordinator.on('decision:requiresHuman', this.handleSwarmDecision.bind(this));
    
    // Listen for HITL manager responses
    this.hitlManager.on('review:completed', this.handleHumanResponse.bind(this));
    
    // Setup automatic timeout handling
    setInterval(() => this.handleTimeouts(), 60000); // Check every minute
  }

  /**
   * Process a decision from the swarm system
   */
  async handleSwarmDecision(decisionData: any): Promise<HITLDecision> {
    const decision: HITLDecision = {
      id: `HITL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: decisionData.type || 'approval',
      title: decisionData.title,
      description: decisionData.description,
      context: {
        swarmId: decisionData.swarmId,
        agentId: decisionData.agentId,
        confidence: decisionData.confidence,
        recommendations: decisionData.recommendations || [],
        riskLevel: this.assessRiskLevel(decisionData),
        financialImpact: decisionData.financialImpact,
        timeframe: decisionData.timeframe || '24h',
        stakeholders: decisionData.stakeholders || []
      },
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        priority: this.calculatePriority(decisionData),
        tags: decisionData.tags || [],
        clientId: decisionData.clientId,
        projectId: decisionData.projectId
      },
      humanReviewRequired: this.requiresHumanReview(decisionData),
      autoExecutionAllowed: this.allowsAutoExecution(decisionData),
      status: 'pending'
    };

    this.decisions.set(decision.id, decision);

    // Store in swarm memory for coordination
    await this.swarmMemory.store(`hitl:decision:${decision.id}`, decision);

    // Determine execution path
    if (decision.humanReviewRequired) {
      await this.requestHumanReview(decision);
    } else if (decision.autoExecutionAllowed) {
      await this.executeAutomatically(decision);
    } else {
      await this.escalateDecision(decision);
    }

    this.emit('decision:created', decision);
    return decision;
  }

  /**
   * Request human review for a decision
   */
  private async requestHumanReview(decision: HITLDecision): Promise<void> {
    const reviewRequest: HumanReviewRequest = {
      id: `review-${decision.id}`,
      type: 'approval',
      context: {
        decision,
        swarmRecommendations: decision.context.recommendations,
        riskAssessment: {
          level: decision.context.riskLevel,
          factors: this.analyzeRiskFactors(decision),
          mitigation: this.suggestMitigation(decision)
        },
        executionPlan: this.generateExecutionPlan(decision),
        alternatives: this.generateAlternatives(decision)
      },
      status: 'pending',
      requestedAt: new Date()
    };

    decision.status = 'in_review';
    await this.hitlManager.requestReview(
      reviewRequest.type,
      reviewRequest.context,
      this.generateReviewOptions(decision)
    );

    this.emit('review:requested', { decision, reviewRequest });
  }

  /**
   * Handle human response to a review
   */
  private async handleHumanResponse(reviewResponse: HumanReviewRequest): Promise<void> {
    const decisionId = reviewResponse.context.decision?.id;
    if (!decisionId) return;

    const decision = this.decisions.get(decisionId);
    if (!decision) return;

    decision.metadata.updatedAt = new Date();

    switch (reviewResponse.response?.action) {
      case 'approve':
        decision.status = 'approved';
        await this.executeDecision(decision, reviewResponse.response);
        break;
      
      case 'reject':
        decision.status = 'rejected';
        await this.rejectDecision(decision, reviewResponse.response);
        break;
      
      case 'modify':
        await this.modifyDecision(decision, reviewResponse.response);
        break;
      
      case 'escalate':
        await this.escalateDecision(decision);
        break;
      
      default:
        decision.status = 'cancelled';
    }

    // Learn from human decisions
    if (this.config.enableLearningFromDecisions) {
      await this.learnFromDecision(decision, reviewResponse);
    }

    this.emit('decision:resolved', decision);
  }

  /**
   * Execute an approved decision
   */
  private async executeDecision(decision: HITLDecision, humanResponse: any): Promise<void> {
    try {
      decision.status = 'executed';
      
      // Execute through swarm coordinator
      const executionResult = await this.swarmCoordinator.executeDecision({
        decisionId: decision.id,
        approvedBy: humanResponse.approvedBy || 'human',
        executionParameters: humanResponse.parameters || {},
        humanOverrides: humanResponse.overrides || {}
      });

      // Store execution results
      await this.swarmMemory.store(`hitl:execution:${decision.id}`, {
        decision,
        executionResult,
        humanInput: humanResponse,
        executedAt: new Date()
      });

      this.emit('decision:executed', { decision, executionResult });
    } catch (error) {
      decision.status = 'rejected';
      this.emit('decision:failed', { decision, error });
    }
  }

  /**
   * Execute decision automatically (high confidence, low risk)
   */
  private async executeAutomatically(decision: HITLDecision): Promise<void> {
    try {
      decision.status = 'executed';
      
      const executionResult = await this.swarmCoordinator.executeDecision({
        decisionId: decision.id,
        autoExecuted: true,
        confidence: decision.context.confidence
      });

      await this.swarmMemory.store(`hitl:autoexec:${decision.id}`, {
        decision,
        executionResult,
        autoExecutedAt: new Date()
      });

      this.emit('decision:autoExecuted', { decision, executionResult });
    } catch (error) {
      // Auto-execution failed, escalate to human
      await this.requestHumanReview(decision);
    }
  }

  /**
   * Learn from human decisions to improve future automation
   */
  private async learnFromDecision(decision: HITLDecision, humanResponse: HumanReviewRequest): Promise<void> {
    const learningData = {
      decisionType: decision.type,
      swarmConfidence: decision.context.confidence,
      humanDecision: humanResponse.response?.action,
      riskLevel: decision.context.riskLevel,
      financialImpact: decision.context.financialImpact,
      factors: this.extractDecisionFactors(decision),
      outcome: humanResponse.response
    };

    const patternKey = `${decision.type}_${decision.context.riskLevel}`;
    const existingPattern = this.learningPatterns.get(patternKey) || { decisions: [], accuracy: 0 };
    
    existingPattern.decisions.push(learningData);
    existingPattern.accuracy = this.calculatePatternAccuracy(existingPattern.decisions);
    
    this.learningPatterns.set(patternKey, existingPattern);

    // Store learning data in swarm memory
    await this.swarmMemory.store(`hitl:learning:${patternKey}`, existingPattern);

    // Adjust thresholds based on learning
    if (existingPattern.decisions.length >= 10) {
      this.adjustAutomationThresholds(patternKey, existingPattern);
    }
  }

  /**
   * Risk assessment logic
   */
  private assessRiskLevel(decisionData: any): 'low' | 'medium' | 'high' | 'critical' {
    let riskScore = 0;
    
    // Financial impact
    if (decisionData.financialImpact > 100000) riskScore += 3;
    else if (decisionData.financialImpact > 10000) riskScore += 2;
    else if (decisionData.financialImpact > 1000) riskScore += 1;
    
    // Confidence level
    if (decisionData.confidence < 0.5) riskScore += 3;
    else if (decisionData.confidence < 0.7) riskScore += 2;
    else if (decisionData.confidence < 0.9) riskScore += 1;
    
    // Client impact
    if (decisionData.clientFacing) riskScore += 2;
    if (decisionData.strategicImpact) riskScore += 2;
    
    if (riskScore >= 6) return 'critical';
    if (riskScore >= 4) return 'high';
    if (riskScore >= 2) return 'medium';
    return 'low';
  }

  /**
   * Priority calculation
   */
  private calculatePriority(decisionData: any): 'low' | 'medium' | 'high' | 'critical' {
    const urgencyFactors = {
      timeframe: decisionData.timeframe === 'immediate' ? 3 : 
                 decisionData.timeframe === '1h' ? 2 : 
                 decisionData.timeframe === '24h' ? 1 : 0,
      clientImpact: decisionData.clientFacing ? 2 : 0,
      financialImpact: decisionData.financialImpact > 50000 ? 2 : 
                      decisionData.financialImpact > 10000 ? 1 : 0,
      confidence: decisionData.confidence < 0.5 ? 2 : 0
    };

    const totalScore = Object.values(urgencyFactors).reduce((sum, score) => sum + score, 0);
    
    if (totalScore >= 6) return 'critical';
    if (totalScore >= 4) return 'high';
    if (totalScore >= 2) return 'medium';
    return 'low';
  }

  /**
   * Determine if human review is required
   */
  private requiresHumanReview(decisionData: any): boolean {
    return (
      decisionData.confidence < this.config.autoApprovalThreshold ||
      decisionData.financialImpact > this.config.financialImpactThreshold ||
      decisionData.riskLevel === 'critical' ||
      decisionData.strategicDecision ||
      decisionData.clientFacing
    );
  }

  /**
   * Determine if auto-execution is allowed
   */
  private allowsAutoExecution(decisionData: any): boolean {
    return (
      decisionData.confidence >= this.config.autoApprovalThreshold &&
      decisionData.financialImpact <= this.config.financialImpactThreshold &&
      !decisionData.strategicDecision &&
      !decisionData.clientFacing
    );
  }

  /**
   * Handle review timeouts
   */
  private handleTimeouts(): void {
    const now = new Date();
    const timeoutMinutes = this.config.reviewTimeoutMinutes;

    for (const decision of this.decisions.values()) {
      if (decision.status === 'in_review') {
        const timeElapsed = (now.getTime() - decision.metadata.createdAt.getTime()) / (1000 * 60);
        
        if (timeElapsed > timeoutMinutes) {
          this.handleReviewTimeout(decision);
        }
      }
    }
  }

  /**
   * Handle review timeout
   */
  private async handleReviewTimeout(decision: HITLDecision): Promise<void> {
    if (decision.context.riskLevel === 'low' && decision.autoExecutionAllowed) {
      // Auto-execute low-risk decisions on timeout
      await this.executeAutomatically(decision);
    } else {
      // Escalate high-risk decisions
      await this.escalateDecision(decision);
    }
  }

  /**
   * Escalate decision to higher authority
   */
  private async escalateDecision(decision: HITLDecision): Promise<void> {
    decision.metadata.priority = 'critical';
    decision.metadata.tags.push('escalated');
    
    this.emit('decision:escalated', decision);
    
    // Request review with escalation flag
    await this.requestHumanReview(decision);
  }

  // Utility methods for decision processing
  private analyzeRiskFactors(decision: HITLDecision): string[] {
    const factors = [];
    
    if (decision.context.confidence < 0.7) factors.push('Low AI confidence');
    if (decision.context.financialImpact && decision.context.financialImpact > 10000) factors.push('High financial impact');
    if (decision.context.riskLevel === 'high' || decision.context.riskLevel === 'critical') factors.push('High risk level');
    if (decision.metadata.clientId) factors.push('Client-facing decision');
    
    return factors;
  }

  private suggestMitigation(decision: HITLDecision): string[] {
    const mitigations = [];
    
    if (decision.context.confidence < 0.7) mitigations.push('Gather additional data before execution');
    if (decision.context.financialImpact && decision.context.financialImpact > 10000) mitigations.push('Implement staged rollout');
    if (decision.metadata.clientId) mitigations.push('Coordinate with client success team');
    
    return mitigations;
  }

  private generateExecutionPlan(decision: HITLDecision): any {
    return {
      steps: decision.context.recommendations.map((rec, index) => ({
        step: index + 1,
        action: rec.recommendation,
        agent: rec.agentId,
        estimatedTime: rec.estimatedImpact?.timeToImplement || 60
      })),
      rollbackPlan: 'Automated rollback available',
      monitoring: 'Real-time execution monitoring enabled'
    };
  }

  private generateAlternatives(decision: HITLDecision): any[] {
    return [
      {
        name: 'Conservative Approach',
        description: 'Lower risk, lower impact alternative',
        confidence: Math.min(decision.context.confidence + 0.2, 1.0)
      },
      {
        name: 'Staged Implementation',
        description: 'Implement in phases with checkpoints',
        confidence: Math.min(decision.context.confidence + 0.1, 1.0)
      }
    ];
  }

  private generateReviewOptions(decision: HITLDecision): string[] {
    return ['Approve', 'Reject', 'Modify', 'Request More Info', 'Escalate'];
  }

  private extractDecisionFactors(decision: HITLDecision): any {
    return {
      confidence: decision.context.confidence,
      riskLevel: decision.context.riskLevel,
      financialImpact: decision.context.financialImpact,
      agentCount: decision.context.recommendations.length,
      timeframe: decision.context.timeframe,
      priority: decision.metadata.priority
    };
  }

  private calculatePatternAccuracy(decisions: any[]): number {
    const correct = decisions.filter(d => 
      (d.swarmConfidence > 0.8 && d.humanDecision === 'approve') ||
      (d.swarmConfidence < 0.5 && d.humanDecision === 'reject')
    ).length;
    
    return decisions.length > 0 ? correct / decisions.length : 0;
  }

  private adjustAutomationThresholds(patternKey: string, pattern: any): void {
    if (pattern.accuracy > 0.9) {
      // Increase automation for this pattern
      this.emit('threshold:adjust', {
        pattern: patternKey,
        recommendation: 'increase_automation',
        accuracy: pattern.accuracy
      });
    } else if (pattern.accuracy < 0.6) {
      // Decrease automation for this pattern
      this.emit('threshold:adjust', {
        pattern: patternKey,
        recommendation: 'decrease_automation',
        accuracy: pattern.accuracy
      });
    }
  }

  /**
   * Get all pending decisions
   */
  public getPendingDecisions(): HITLDecision[] {
    return Array.from(this.decisions.values())
      .filter(d => d.status === 'pending' || d.status === 'in_review')
      .sort((a, b) => {
        const priorityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
        return priorityOrder[b.metadata.priority] - priorityOrder[a.metadata.priority];
      });
  }

  /**
   * Get decision by ID
   */
  public getDecision(id: string): HITLDecision | undefined {
    return this.decisions.get(id);
  }

  /**
   * Get decisions by status
   */
  public getDecisionsByStatus(status: HITLDecision['status']): HITLDecision[] {
    return Array.from(this.decisions.values()).filter(d => d.status === status);
  }

  /**
   * Get decision history for analytics
   */
  public getDecisionHistory(limit?: number): HITLDecision[] {
    const history = Array.from(this.decisions.values())
      .filter(d => d.status === 'executed' || d.status === 'rejected')
      .sort((a, b) => b.metadata.updatedAt.getTime() - a.metadata.updatedAt.getTime());
    
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Modify decision based on human input
   */
  private async modifyDecision(decision: HITLDecision, humanResponse: any): Promise<void> {
    // Apply human modifications
    if (humanResponse.modifications) {
      Object.assign(decision.context, humanResponse.modifications.context || {});
      Object.assign(decision.metadata, humanResponse.modifications.metadata || {});
    }

    decision.metadata.updatedAt = new Date();
    decision.metadata.tags.push('modified');

    // Re-evaluate the modified decision
    if (this.allowsAutoExecution(decision.context)) {
      await this.executeAutomatically(decision);
    } else {
      await this.requestHumanReview(decision);
    }
  }

  private async rejectDecision(decision: HITLDecision, humanResponse: any): Promise<void> {
    // Store rejection reasoning
    await this.swarmMemory.store(`hitl:rejection:${decision.id}`, {
      decision,
      rejectionReason: humanResponse.reason,
      rejectedBy: humanResponse.rejectedBy || 'human',
      rejectedAt: new Date()
    });

    // Notify swarm of rejection for learning
    this.swarmCoordinator.emit('decision:rejected', {
      decisionId: decision.id,
      reason: humanResponse.reason
    });

    this.emit('decision:rejected', { decision, reason: humanResponse.reason });
  }
}