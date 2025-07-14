// Swarm Integration - Integration layer between HITL system and swarm architecture
import { EventEmitter } from 'events';
import { HITLOrchestrator, HITLDecision } from '../core/HITLOrchestrator';
import { TaskDelegationManager, DelegatedTask } from '../delegation/TaskDelegationManager';
import { ReviewWorkflowEngine } from '../review/ReviewWorkflowEngine';
import { ProgressTracker } from '../tracking/ProgressTracker';
import { SwarmCoordinator } from '../../../swarm/coordinator/SwarmCoordinator';
import { SwarmMemory } from '../../../swarm/memory/SwarmMemory';
import { BaseAgent } from '../../../swarm/agents/BaseAgent';

export interface HITLSwarmConfig {
  enableAutomaticDecisionRouting: boolean;
  confidenceThresholds: {
    autoApprove: number;
    requireHuman: number;
    escalate: number;
  };
  swarmOverrides: {
    allowEmergencyOverride: boolean;
    emergencyOverrideRoles: string[];
    maxOverrideWindow: number; // minutes
  };
  learningConfig: {
    enableLearningFromDecisions: boolean;
    retrainThreshold: number; // number of decisions
    adaptThresholds: boolean;
  };
  integrationPoints: {
    agentHooks: boolean;
    memoryIntegration: boolean;
    realTimeMonitoring: boolean;
    coordinatorIntegration: boolean;
  };
}

export interface SwarmDecisionRequest {
  swarmId: string;
  agentId: string;
  agentType: string;
  decisionType: string;
  context: SwarmDecisionContext;
  recommendations: SwarmRecommendation[];
  confidence: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  stakeholders: string[];
  metadata: any;
}

export interface SwarmDecisionContext {
  operationId: string;
  taskDescription: string;
  businessImpact: {
    financial?: number;
    operational?: string;
    strategic?: string;
    reputational?: string;
  };
  riskAssessment: {
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    mitigation: string[];
  };
  timeConstraints: {
    deadline?: Date;
    preferredCompletion?: Date;
    maxDelay?: number; // minutes
  };
  dependencies: string[];
  alternatives: SwarmAlternative[];
}

export interface SwarmRecommendation {
  agentId: string;
  agentType: string;
  recommendation: string;
  confidence: number;
  reasoning: string[];
  implementation: {
    steps: string[];
    resources: string[];
    timeEstimate: number; // minutes
    dependencies: string[];
  };
  riskAssessment: {
    level: string;
    factors: string[];
  };
  successCriteria: string[];
  rollbackPlan?: string[];
}

export interface SwarmAlternative {
  id: string;
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  estimatedImpact: {
    positive: string[];
    negative: string[];
    neutral: string[];
  };
  resourceRequirements: string[];
  confidence: number;
}

export interface HITLResponse {
  decisionId: string;
  action: 'approve' | 'reject' | 'modify' | 'escalate' | 'delegate';
  humanOperator: string;
  timestamp: Date;
  reasoning: string;
  modifications?: any;
  conditions?: string[];
  followUpActions?: string[];
  learningPoints?: string[];
}

export interface AgentBehaviorOverride {
  agentId: string;
  agentType: string;
  overrideType: 'parameter' | 'behavior' | 'constraint' | 'goal';
  parameter: string;
  newValue: any;
  reason: string;
  duration?: number; // minutes, undefined for permanent
  conditions?: string[];
  authorizedBy: string;
  timestamp: Date;
}

export interface SwarmLearningData {
  decisionPattern: string;
  humanDecision: string;
  outcome: string;
  contextFeatures: any;
  confidence: number;
  timeToDecision: number;
  qualityScore: number;
  lessons: string[];
}

export class SwarmIntegration extends EventEmitter {
  private hitlOrchestrator: HITLOrchestrator;
  private taskDelegation: TaskDelegationManager;
  private workflowEngine: ReviewWorkflowEngine;
  private progressTracker: ProgressTracker;
  private swarmCoordinator: SwarmCoordinator;
  private swarmMemory: SwarmMemory;
  private config: HITLSwarmConfig;
  
  private pendingDecisions: Map<string, SwarmDecisionRequest> = new Map();
  private agentOverrides: Map<string, AgentBehaviorOverride[]> = new Map();
  private learningData: SwarmLearningData[] = [];
  private emergencyOverrides: Map<string, Date> = new Map();
  
  constructor(
    hitlOrchestrator: HITLOrchestrator,
    taskDelegation: TaskDelegationManager,
    workflowEngine: ReviewWorkflowEngine,
    progressTracker: ProgressTracker,
    swarmCoordinator: SwarmCoordinator,
    swarmMemory: SwarmMemory,
    config: Partial<HITLSwarmConfig> = {}
  ) {
    super();
    
    this.hitlOrchestrator = hitlOrchestrator;
    this.taskDelegation = taskDelegation;
    this.workflowEngine = workflowEngine;
    this.progressTracker = progressTracker;
    this.swarmCoordinator = swarmCoordinator;
    this.swarmMemory = swarmMemory;
    this.config = this.buildConfig(config);
    
    this.setupIntegrationHooks();
    this.setupEventHandlers();
  }

  private buildConfig(config: Partial<HITLSwarmConfig>): HITLSwarmConfig {
    return {
      enableAutomaticDecisionRouting: true,
      confidenceThresholds: {
        autoApprove: 0.9,
        requireHuman: 0.7,
        escalate: 0.5
      },
      swarmOverrides: {
        allowEmergencyOverride: true,
        emergencyOverrideRoles: ['senior-manager', 'director', 'executive'],
        maxOverrideWindow: 60 // 1 hour
      },
      learningConfig: {
        enableLearningFromDecisions: true,
        retrainThreshold: 50,
        adaptThresholds: true
      },
      integrationPoints: {
        agentHooks: true,
        memoryIntegration: true,
        realTimeMonitoring: true,
        coordinatorIntegration: true
      },
      ...config
    };
  }

  private setupIntegrationHooks(): void {
    if (this.config.integrationPoints.coordinatorIntegration) {
      // Hook into swarm coordinator decision points
      this.swarmCoordinator.on('decision:required', this.handleSwarmDecisionRequest.bind(this));
      this.swarmCoordinator.on('agent:blocked', this.handleAgentBlocked.bind(this));
      this.swarmCoordinator.on('operation:failed', this.handleOperationFailed.bind(this));
    }

    if (this.config.integrationPoints.memoryIntegration) {
      // Setup memory synchronization
      this.setupMemorySync();
    }

    if (this.config.integrationPoints.realTimeMonitoring) {
      // Setup real-time monitoring integration
      this.setupMonitoringIntegration();
    }
  }

  private setupEventHandlers(): void {
    // HITL Orchestrator events
    this.hitlOrchestrator.on('decision:created', this.handleHITLDecisionCreated.bind(this));
    this.hitlOrchestrator.on('decision:resolved', this.handleHITLDecisionResolved.bind(this));
    this.hitlOrchestrator.on('decision:executed', this.handleHITLDecisionExecuted.bind(this));

    // Task Delegation events
    this.taskDelegation.on('task:completed', this.handleTaskCompleted.bind(this));
    this.taskDelegation.on('task:failed', this.handleTaskFailed.bind(this));

    // Workflow Engine events
    this.workflowEngine.on('workflow:completed', this.handleWorkflowCompleted.bind(this));
    this.workflowEngine.on('stage:timeout', this.handleStageTimeout.bind(this));

    // Progress Tracker events
    this.progressTracker.on('alert:created', this.handleProgressAlert.bind(this));
    this.progressTracker.on('escalation:triggered', this.handleProgressEscalation.bind(this));
  }

  /**
   * Handle swarm decision request
   */
  private async handleSwarmDecisionRequest(request: SwarmDecisionRequest): Promise<void> {
    try {
      this.pendingDecisions.set(request.agentId, request);

      // Route decision based on confidence and configuration
      if (this.config.enableAutomaticDecisionRouting) {
        await this.routeDecisionBasedOnConfidence(request);
      } else {
        // Always route to human
        await this.createHITLDecisionFromSwarm(request);
      }

      this.emit('swarm:decisionRequested', request);
    } catch (error) {
      this.emit('integration:error', { type: 'decision_routing', error, request });
    }
  }

  /**
   * Route decision based on confidence thresholds
   */
  private async routeDecisionBasedOnConfidence(request: SwarmDecisionRequest): Promise<void> {
    const { confidence } = request;
    const thresholds = this.config.confidenceThresholds;

    if (confidence >= thresholds.autoApprove && request.urgency !== 'critical') {
      // Auto-approve high-confidence decisions
      await this.autoApproveDecision(request);
    } else if (confidence >= thresholds.requireHuman) {
      // Route to human review
      await this.createHITLDecisionFromSwarm(request);
    } else if (confidence >= thresholds.escalate) {
      // Escalate for expert review
      await this.escalateDecisionToExpert(request);
    } else {
      // Low confidence - require immediate human intervention
      await this.requireImmediateHumanIntervention(request);
    }
  }

  /**
   * Auto-approve high-confidence decisions
   */
  private async autoApproveDecision(request: SwarmDecisionRequest): Promise<void> {
    const approval: HITLResponse = {
      decisionId: `auto-${request.agentId}-${Date.now()}`,
      action: 'approve',
      humanOperator: 'system-auto-approval',
      timestamp: new Date(),
      reasoning: `Auto-approved based on high confidence (${request.confidence.toFixed(2)})`
    };

    // Execute the swarm recommendation
    await this.executeSwarmRecommendation(request, approval);

    // Store learning data
    if (this.config.learningConfig.enableLearningFromDecisions) {
      this.recordLearningData(request, approval, 'auto-approved');
    }

    this.emit('decision:autoApproved', { request, approval });
  }

  /**
   * Create HITL decision from swarm request
   */
  private async createHITLDecisionFromSwarm(request: SwarmDecisionRequest): Promise<HITLDecision> {
    const hitlDecision: Omit<HITLDecision, 'id'> = {
      type: this.mapSwarmDecisionType(request.decisionType),
      title: `Swarm Decision: ${request.context.taskDescription}`,
      description: this.generateDecisionDescription(request),
      context: {
        swarmId: request.swarmId,
        agentId: request.agentId,
        confidence: request.confidence,
        recommendations: this.convertSwarmRecommendations(request.recommendations),
        riskLevel: request.context.riskAssessment.level,
        financialImpact: request.context.businessImpact.financial,
        timeframe: this.calculateTimeframe(request.context.timeConstraints),
        stakeholders: request.stakeholders
      },
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        priority: this.mapUrgencyToPriority(request.urgency),
        tags: ['swarm-generated', request.agentType, request.decisionType],
        clientId: request.metadata?.clientId,
        projectId: request.metadata?.projectId
      },
      humanReviewRequired: true,
      autoExecutionAllowed: false,
      status: 'pending'
    };

    const decision = await this.hitlOrchestrator.handleSwarmDecision({
      ...hitlDecision,
      swarmRequest: request
    });

    // Store association between swarm request and HITL decision
    await this.swarmMemory.store(`swarm:decision:${request.agentId}`, {
      swarmRequest: request,
      hitlDecisionId: decision.id,
      createdAt: new Date()
    });

    return decision;
  }

  /**
   * Escalate decision to expert review
   */
  private async escalateDecisionToExpert(request: SwarmDecisionRequest): Promise<void> {
    const decision = await this.createHITLDecisionFromSwarm(request);
    
    // Create expert task delegation
    const expertTask = await this.taskDelegation.delegateFromDecision(
      decision,
      'analysis',
      {
        title: `Expert Analysis: ${request.context.taskDescription}`,
        description: `Low confidence swarm decision requires expert analysis`,
        requiredRole: 'senior-specialist',
        priority: 'high',
        complexity: 'expert',
        estimatedDuration: 90 // 1.5 hours for expert analysis
      }
    );

    this.emit('decision:escalatedToExpert', { request, decision, expertTask });
  }

  /**
   * Require immediate human intervention
   */
  private async requireImmediateHumanIntervention(request: SwarmDecisionRequest): Promise<void> {
    const decision = await this.createHITLDecisionFromSwarm(request);
    decision.metadata.priority = 'critical';
    decision.metadata.tags.push('immediate-intervention');

    // Create immediate alert
    this.progressTracker.emit('alert:created', {
      id: `alert-immediate-${Date.now()}`,
      type: 'critical',
      title: 'Immediate Human Intervention Required',
      description: `Swarm decision with very low confidence (${request.confidence.toFixed(2)}) requires immediate human review`,
      source: 'swarm-integration',
      timestamp: new Date(),
      acknowledged: false,
      metadata: { swarmRequest: request, decisionId: decision.id }
    });

    this.emit('decision:immediateInterventionRequired', { request, decision });
  }

  /**
   * Handle HITL decision created
   */
  private async handleHITLDecisionCreated(decision: HITLDecision): Promise<void> {
    // Start tracking the decision
    await this.progressTracker.trackDecision(decision);

    // Notify relevant swarm agents
    if (decision.context.swarmId && decision.context.agentId) {
      await this.notifySwarmAgent(decision.context.agentId, {
        type: 'decision_under_review',
        decisionId: decision.id,
        estimatedResolution: this.estimateResolutionTime(decision)
      });
    }

    this.emit('hitl:decisionCreated', decision);
  }

  /**
   * Handle HITL decision resolved
   */
  private async handleHITLDecisionResolved(decision: HITLDecision): Promise<void> {
    const swarmRequest = this.pendingDecisions.get(decision.context.agentId);
    
    if (swarmRequest) {
      const response: HITLResponse = {
        decisionId: decision.id,
        action: decision.status === 'approved' ? 'approve' : 'reject',
        humanOperator: 'human-reviewer', // Would come from actual decision data
        timestamp: new Date(),
        reasoning: 'Human review completed',
        // Additional data would come from the actual decision resolution
      };

      if (decision.status === 'approved') {
        await this.executeSwarmRecommendation(swarmRequest, response);
      } else {
        await this.rejectSwarmRecommendation(swarmRequest, response);
      }

      // Record learning data
      if (this.config.learningConfig.enableLearningFromDecisions) {
        this.recordLearningData(swarmRequest, response, decision.status);
      }

      this.pendingDecisions.delete(decision.context.agentId);
    }

    this.emit('hitl:decisionResolved', decision);
  }

  /**
   * Execute swarm recommendation
   */
  private async executeSwarmRecommendation(
    request: SwarmDecisionRequest, 
    response: HITLResponse
  ): Promise<void> {
    try {
      // Find the best recommendation to execute
      const bestRecommendation = this.selectBestRecommendation(request.recommendations);
      
      // Execute through swarm coordinator
      const executionResult = await this.swarmCoordinator.executeRecommendation({
        agentId: request.agentId,
        recommendation: bestRecommendation,
        humanApproval: response,
        context: request.context
      });

      // Store execution results
      await this.swarmMemory.store(`execution:${request.agentId}`, {
        request,
        response,
        recommendation: bestRecommendation,
        result: executionResult,
        executedAt: new Date()
      });

      // Notify agent of successful execution
      await this.notifySwarmAgent(request.agentId, {
        type: 'execution_approved',
        decisionId: response.decisionId,
        result: executionResult
      });

      this.emit('swarm:recommendationExecuted', { request, response, executionResult });
    } catch (error) {
      this.emit('integration:error', { type: 'execution_failed', error, request, response });
    }
  }

  /**
   * Reject swarm recommendation
   */
  private async rejectSwarmRecommendation(
    request: SwarmDecisionRequest, 
    response: HITLResponse
  ): Promise<void> {
    // Notify agent of rejection
    await this.notifySwarmAgent(request.agentId, {
      type: 'execution_rejected',
      decisionId: response.decisionId,
      reason: response.reasoning,
      alternatives: request.context.alternatives
    });

    // If there are alternatives, consider them
    if (request.context.alternatives.length > 0) {
      await this.considerAlternatives(request, response);
    }

    this.emit('swarm:recommendationRejected', { request, response });
  }

  /**
   * Apply agent behavior override
   */
  public async applyAgentOverride(override: AgentBehaviorOverride): Promise<void> {
    // Validate authorization
    if (!this.isAuthorizedForOverride(override.authorizedBy, override.overrideType)) {
      throw new Error(`User ${override.authorizedBy} not authorized for ${override.overrideType} overrides`);
    }

    // Store override
    const agentOverrides = this.agentOverrides.get(override.agentId) || [];
    agentOverrides.push(override);
    this.agentOverrides.set(override.agentId, agentOverrides);

    // Apply override to agent
    await this.swarmCoordinator.applyAgentOverride(override);

    // Store in memory
    await this.swarmMemory.store(`override:${override.agentId}:${Date.now()}`, override);

    // Set expiration if duration specified
    if (override.duration) {
      setTimeout(() => {
        this.removeAgentOverride(override.agentId, override);
      }, override.duration * 60 * 1000);
    }

    this.emit('agent:overrideApplied', override);
  }

  /**
   * Emergency override for critical situations
   */
  public async emergencyOverride(
    agentId: string, 
    action: string, 
    authorizedBy: string, 
    reason: string
  ): Promise<void> {
    if (!this.config.swarmOverrides.allowEmergencyOverride) {
      throw new Error('Emergency overrides are disabled');
    }

    if (!this.config.swarmOverrides.emergencyOverrideRoles.includes(authorizedBy)) {
      throw new Error(`User ${authorizedBy} not authorized for emergency overrides`);
    }

    // Check if within override window
    const lastOverride = this.emergencyOverrides.get(agentId);
    if (lastOverride) {
      const timeSinceLastOverride = (Date.now() - lastOverride.getTime()) / (1000 * 60);
      if (timeSinceLastOverride < this.config.swarmOverrides.maxOverrideWindow) {
        throw new Error(`Emergency override window not expired for agent ${agentId}`);
      }
    }

    // Execute emergency action
    await this.swarmCoordinator.emergencyOverride({
      agentId,
      action,
      authorizedBy,
      reason,
      timestamp: new Date()
    });

    this.emergencyOverrides.set(agentId, new Date());

    // Create alert
    this.progressTracker.emit('alert:created', {
      id: `emergency-override-${Date.now()}`,
      type: 'critical',
      title: 'Emergency Override Executed',
      description: `Emergency override applied to agent ${agentId}: ${action}`,
      source: 'swarm-integration',
      timestamp: new Date(),
      acknowledged: false,
      metadata: { agentId, action, authorizedBy, reason }
    });

    this.emit('agent:emergencyOverride', { agentId, action, authorizedBy, reason });
  }

  /**
   * Handle task completion from delegation
   */
  private async handleTaskCompleted(data: { task: DelegatedTask }): Promise<void> {
    const { task } = data;

    // If this task was for an HITL decision, update the decision
    if (task.originatingDecision) {
      const decision = this.hitlOrchestrator.getDecision(task.originatingDecision);
      if (decision && decision.context.swarmId) {
        // Notify swarm of task completion
        await this.notifySwarmAgent(decision.context.agentId, {
          type: 'task_completed',
          taskId: task.id,
          outputs: task.outputs,
          recommendations: task.lessons
        });
      }
    }
  }

  /**
   * Setup memory synchronization
   */
  private setupMemorySync(): void {
    // Sync HITL decisions to swarm memory
    this.hitlOrchestrator.on('decision:created', async (decision: HITLDecision) => {
      await this.swarmMemory.store(`hitl:decision:${decision.id}`, {
        decision,
        timestamp: new Date(),
        source: 'hitl-orchestrator'
      });
    });

    // Sync learning data
    setInterval(async () => {
      if (this.learningData.length > 0) {
        await this.swarmMemory.store('hitl:learning:batch', {
          data: this.learningData,
          timestamp: new Date()
        });
        
        // Check if we should retrain
        if (this.learningData.length >= this.config.learningConfig.retrainThreshold) {
          await this.triggerSwarmRetraining();
          this.learningData = []; // Clear after retraining
        }
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Setup monitoring integration
   */
  private setupMonitoringIntegration(): void {
    // Forward progress alerts to swarm coordination
    this.progressTracker.on('alert:created', async (alert) => {
      if (alert.type === 'critical' || alert.type === 'error') {
        await this.swarmCoordinator.handleCriticalAlert(alert);
      }
    });

    // Monitor swarm health and notify HITL system
    this.swarmCoordinator.on('health:degraded', async (healthData) => {
      this.progressTracker.emit('alert:created', {
        id: `swarm-health-${Date.now()}`,
        type: 'warning',
        title: 'Swarm Health Degraded',
        description: `Swarm performance metrics indicate degraded health`,
        source: 'swarm-coordinator',
        timestamp: new Date(),
        acknowledged: false,
        metadata: healthData
      });
    });
  }

  /**
   * Record learning data for future training
   */
  private recordLearningData(
    request: SwarmDecisionRequest, 
    response: HITLResponse, 
    outcome: string
  ): void {
    const learningEntry: SwarmLearningData = {
      decisionPattern: this.extractDecisionPattern(request),
      humanDecision: response.action,
      outcome,
      contextFeatures: this.extractContextFeatures(request),
      confidence: request.confidence,
      timeToDecision: this.calculateDecisionTime(request, response),
      qualityScore: this.assessDecisionQuality(request, response),
      lessons: response.learningPoints || []
    };

    this.learningData.push(learningEntry);
    this.emit('learning:dataRecorded', learningEntry);
  }

  /**
   * Trigger swarm retraining based on learning data
   */
  private async triggerSwarmRetraining(): Promise<void> {
    const retrainingData = {
      learningData: this.learningData,
      patterns: this.analyzeLearningPatterns(),
      recommendations: this.generateRetrainingRecommendations()
    };

    await this.swarmCoordinator.initiateRetraining(retrainingData);
    
    // Adapt thresholds if enabled
    if (this.config.learningConfig.adaptThresholds) {
      this.adaptConfidenceThresholds();
    }

    this.emit('swarm:retrainingTriggered', retrainingData);
  }

  // Utility methods for integration

  private mapSwarmDecisionType(swarmType: string): HITLDecision['type'] {
    const typeMap: { [key: string]: HITLDecision['type'] } = {
      'strategic_decision': 'strategic',
      'approval_request': 'approval',
      'validation_needed': 'validation',
      'override_request': 'override',
      'escalation_required': 'escalation'
    };
    
    return typeMap[swarmType] || 'approval';
  }

  private mapUrgencyToPriority(urgency: SwarmDecisionRequest['urgency']): HITLDecision['metadata']['priority'] {
    const priorityMap = {
      'low': 'low' as const,
      'medium': 'medium' as const,
      'high': 'high' as const,
      'critical': 'critical' as const
    };
    
    return priorityMap[urgency];
  }

  private generateDecisionDescription(request: SwarmDecisionRequest): string {
    return `
    Agent ${request.agentType} (${request.agentId}) requests ${request.decisionType} for: ${request.context.taskDescription}
    
    Context:
    - Confidence: ${(request.confidence * 100).toFixed(1)}%
    - Risk Level: ${request.context.riskAssessment.level}
    - Business Impact: ${JSON.stringify(request.context.businessImpact)}
    - Urgency: ${request.urgency}
    
    Recommendations: ${request.recommendations.length} provided by swarm agents
    `.trim();
  }

  private convertSwarmRecommendations(swarmRecs: SwarmRecommendation[]): any[] {
    return swarmRecs.map(rec => ({
      agentId: rec.agentId,
      agentType: rec.agentType,
      recommendation: rec.recommendation,
      confidence: rec.confidence,
      reasoning: rec.reasoning.join('; '),
      suggestedActions: rec.implementation.steps,
      estimatedImpact: {
        timeToImplement: rec.implementation.timeEstimate,
        risk: rec.riskAssessment.level
      }
    }));
  }

  private calculateTimeframe(timeConstraints: SwarmDecisionContext['timeConstraints']): string {
    if (timeConstraints.deadline) {
      const hoursUntilDeadline = (timeConstraints.deadline.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilDeadline < 1) return 'immediate';
      if (hoursUntilDeadline < 4) return '4h';
      if (hoursUntilDeadline < 24) return '24h';
      return `${Math.ceil(hoursUntilDeadline / 24)}d`;
    }
    
    return timeConstraints.maxDelay ? `${timeConstraints.maxDelay}m` : '24h';
  }

  private estimateResolutionTime(decision: HITLDecision): number {
    // Estimate resolution time based on decision characteristics
    const baseTime = {
      'strategic': 180,
      'approval': 60,
      'validation': 45,
      'override': 30,
      'escalation': 120
    };
    
    return baseTime[decision.type] || 60;
  }

  private selectBestRecommendation(recommendations: SwarmRecommendation[]): SwarmRecommendation {
    // Select recommendation with highest confidence
    return recommendations.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );
  }

  private async notifySwarmAgent(agentId: string, notification: any): Promise<void> {
    await this.swarmCoordinator.notifyAgent(agentId, notification);
  }

  private async considerAlternatives(
    request: SwarmDecisionRequest, 
    response: HITLResponse
  ): Promise<void> {
    // Create a new decision for the best alternative
    if (request.context.alternatives.length > 0) {
      const bestAlternative = this.selectBestAlternative(request.context.alternatives);
      
      // Create new swarm request for the alternative
      const alternativeRequest: SwarmDecisionRequest = {
        ...request,
        context: {
          ...request.context,
          taskDescription: `Alternative: ${bestAlternative.description}`,
          businessImpact: {
            ...request.context.businessImpact,
            strategic: `Alternative approach: ${bestAlternative.name}`
          }
        },
        recommendations: [], // Would need to generate new recommendations
        metadata: {
          ...request.metadata,
          originalDecision: response.decisionId,
          alternativeId: bestAlternative.id
        }
      };

      await this.handleSwarmDecisionRequest(alternativeRequest);
    }
  }

  private selectBestAlternative(alternatives: SwarmAlternative[]): SwarmAlternative {
    return alternatives.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );
  }

  private isAuthorizedForOverride(user: string, overrideType: string): boolean {
    // Simplified authorization check
    const authorizations = {
      'parameter': ['manager', 'senior-manager'],
      'behavior': ['senior-manager', 'director'],
      'constraint': ['director', 'executive'],
      'goal': ['executive', 'board']
    };
    
    return authorizations[overrideType]?.includes(user) || false;
  }

  private removeAgentOverride(agentId: string, override: AgentBehaviorOverride): void {
    const overrides = this.agentOverrides.get(agentId) || [];
    const index = overrides.findIndex(o => o.timestamp === override.timestamp);
    if (index !== -1) {
      overrides.splice(index, 1);
      this.agentOverrides.set(agentId, overrides);
      this.emit('agent:overrideRemoved', { agentId, override });
    }
  }

  private extractDecisionPattern(request: SwarmDecisionRequest): string {
    return `${request.agentType}_${request.decisionType}_${request.context.riskAssessment.level}`;
  }

  private extractContextFeatures(request: SwarmDecisionRequest): any {
    return {
      agentType: request.agentType,
      decisionType: request.decisionType,
      urgency: request.urgency,
      riskLevel: request.context.riskAssessment.level,
      hasFinancialImpact: !!request.context.businessImpact.financial,
      recommendationCount: request.recommendations.length,
      hasDeadline: !!request.context.timeConstraints.deadline,
      stakeholderCount: request.stakeholders.length
    };
  }

  private calculateDecisionTime(request: SwarmDecisionRequest, response: HITLResponse): number {
    // This would calculate actual time from request to response
    return 30; // Simplified - 30 minutes
  }

  private assessDecisionQuality(request: SwarmDecisionRequest, response: HITLResponse): number {
    // Quality assessment based on decision consistency and outcome
    let quality = 3; // Baseline
    
    if (request.confidence > 0.8 && response.action === 'approve') quality += 1;
    if (request.context.riskAssessment.level === 'low' && response.action === 'approve') quality += 0.5;
    if (response.reasoning && response.reasoning.length > 50) quality += 0.5; // Detailed reasoning
    
    return Math.min(5, quality);
  }

  private analyzeLearningPatterns(): any {
    // Analyze patterns in learning data
    const patterns = {};
    
    this.learningData.forEach(entry => {
      const pattern = entry.decisionPattern;
      if (!patterns[pattern]) {
        patterns[pattern] = { count: 0, approvals: 0, rejections: 0, avgQuality: 0 };
      }
      
      patterns[pattern].count++;
      if (entry.humanDecision === 'approve') patterns[pattern].approvals++;
      if (entry.humanDecision === 'reject') patterns[pattern].rejections++;
      patterns[pattern].avgQuality += entry.qualityScore;
    });
    
    // Calculate averages
    Object.values(patterns).forEach((pattern: any) => {
      pattern.avgQuality /= pattern.count;
      pattern.approvalRate = pattern.approvals / pattern.count;
    });
    
    return patterns;
  }

  private generateRetrainingRecommendations(): string[] {
    const recommendations = [];
    const patterns = this.analyzeLearningPatterns();
    
    Object.entries(patterns).forEach(([pattern, data]: [string, any]) => {
      if (data.approvalRate > 0.9 && data.avgQuality > 4) {
        recommendations.push(`Increase auto-approval threshold for pattern: ${pattern}`);
      } else if (data.approvalRate < 0.3) {
        recommendations.push(`Review recommendation quality for pattern: ${pattern}`);
      }
    });
    
    return recommendations;
  }

  private adaptConfidenceThresholds(): void {
    const patterns = this.analyzeLearningPatterns();
    let adjustments = 0;
    
    Object.entries(patterns).forEach(([pattern, data]: [string, any]) => {
      if (data.count >= 10) { // Sufficient data
        if (data.approvalRate > 0.95 && data.avgQuality > 4.5) {
          // Lower threshold slightly for this pattern type
          this.config.confidenceThresholds.autoApprove *= 0.98;
          adjustments++;
        } else if (data.approvalRate < 0.5) {
          // Raise threshold for this pattern type
          this.config.confidenceThresholds.requireHuman *= 1.02;
          adjustments++;
        }
      }
    });
    
    if (adjustments > 0) {
      this.emit('thresholds:adapted', { 
        adjustments, 
        newThresholds: this.config.confidenceThresholds 
      });
    }
  }

  /**
   * Get integration status and metrics
   */
  public getIntegrationStatus(): any {
    return {
      config: this.config,
      pendingDecisions: this.pendingDecisions.size,
      activeOverrides: Array.from(this.agentOverrides.values()).flat().length,
      learningDataCount: this.learningData.length,
      emergencyOverrides: this.emergencyOverrides.size,
      recentActivity: {
        decisionsRouted: this.learningData.filter(l => 
          (Date.now() - new Date().getTime()) < 24 * 60 * 60 * 1000
        ).length,
        autoApprovals: this.learningData.filter(l => 
          l.outcome === 'auto-approved'
        ).length,
        humanInterventions: this.learningData.filter(l => 
          l.humanDecision !== 'auto'
        ).length
      }
    };
  }

  /**
   * Cleanup integration
   */
  public cleanup(): void {
    this.removeAllListeners();
    this.pendingDecisions.clear();
    this.agentOverrides.clear();
    this.learningData = [];
    this.emergencyOverrides.clear();
  }
}