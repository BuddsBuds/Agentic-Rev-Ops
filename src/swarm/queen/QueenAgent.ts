/**
 * Queen Agent - Central Decision Maker
 * Coordinates all swarm activities with consensus-based decision making
 */

import { EventEmitter } from 'events';
import { MajorityEngine } from '../consensus/MajorityEngine';
import { SwarmMemory } from '../memory/SwarmMemory';
import { AgentInterface, SwarmDecision, MajorityResult } from '../types';

export interface QueenConfig {
  swarmId: string;
  majorityThreshold: number;
  decisionTimeout: number;
  memoryRetention: number;
  tieBreakerRole?: boolean; // Queen can break ties
}

export interface AgentReport {
  agentId: string;
  agentType: string;
  status: string;
  recommendation: any;
  confidence: number;
  reasoning: string;
  timestamp: Date;
}

export interface QueenDecision {
  id: string;
  type: 'strategic' | 'tactical' | 'operational' | 'emergency';
  decision: string;
  majority: MajorityResult;
  implementation: ImplementationPlan;
  timestamp: Date;
}

export interface ImplementationPlan {
  steps: ExecutionStep[];
  assignments: AgentAssignment[];
  timeline: Timeline;
  successCriteria: SuccessCriteria[];
}

export interface ExecutionStep {
  id: string;
  action: string;
  dependencies: string[];
  assignedAgents: string[];
  estimatedDuration: number;
}

export interface AgentAssignment {
  agentId: string;
  taskIds: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  deadline?: Date;
}

export interface Timeline {
  start: Date;
  end: Date;
  milestones: Milestone[];
}

export interface Milestone {
  id: string;
  name: string;
  targetDate: Date;
  criteria: string[];
}

export interface SuccessCriteria {
  metric: string;
  target: number;
  operator: '>' | '<' | '=' | '>=' | '<=';
}

export class QueenAgent extends EventEmitter implements AgentInterface {
  private config: QueenConfig;
  private majorityEngine: MajorityEngine;
  private memory: SwarmMemory;
  private activeAgents: Map<string, AgentInterface>;
  private decisionHistory: QueenDecision[];
  private currentDecisions: Map<string, QueenDecision>;
  
  constructor(config: QueenConfig) {
    super();
    this.config = config;
    this.majorityEngine = new MajorityEngine({
      votingThreshold: config.majorityThreshold,
      votingTimeout: config.decisionTimeout,
      tieBreaker: config.tieBreakerRole ? 'queen' : 'random',
      quorumRequired: 0.5, // 50% quorum required
      weightedVoting: true // Agents can have different voting weights
    });
    this.memory = new SwarmMemory({
      retentionPeriod: config.memoryRetention
    });
    this.activeAgents = new Map();
    this.decisionHistory = [];
    this.currentDecisions = new Map();
    
    this.initializeEventHandlers();
  }

  /**
   * Initialize the Queen agent
   */
  async initialize(): Promise<void> {
    await this.memory.initialize();
    await this.majorityEngine.initialize();
    
    // Load historical decisions and patterns
    const history = await this.memory.getDecisionHistory();
    this.decisionHistory = history;
    
    // Analyze patterns for improved decision making
    await this.analyzeHistoricalPatterns();
    
    // Set up Queen as tie-breaker if configured
    if (this.config.tieBreakerRole) {
      this.majorityEngine.on('majority:tie-break-needed', (data) => {
        this.handleTieBreak(data);
      });
    }
    
    this.emit('queen:initialized', { swarmId: this.config.swarmId });
  }

  /**
   * Register an agent with the Queen
   */
  registerAgent(agent: AgentInterface): void {
    this.activeAgents.set(agent.getId(), agent);
    
    // Set up agent communication channels
    agent.on('report', (report) => this.handleAgentReport(report));
    agent.on('alert', (alert) => this.handleAgentAlert(alert));
    agent.on('request', (request) => this.handleAgentRequest(request));
    
    this.emit('queen:agent-registered', { agentId: agent.getId() });
  }

  /**
   * Process a strategic decision using majority voting
   */
  async makeStrategicDecision(
    topic: string,
    context: Record<string, any>,
    urgency: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<QueenDecision> {
    const decisionId = this.generateDecisionId();
    
    // Gather input from all relevant agents
    const agentReports = await this.gatherAgentReports(topic, context);
    
    // Create voting options from agent recommendations
    const votingOptions = this.createVotingOptions(agentReports);
    
    // Start majority voting
    const votingTopic = {
      id: decisionId,
      type: 'decision' as const,
      question: topic,
      options: votingOptions,
      context
    };
    
    const eligibleVoters = Array.from(this.activeAgents.keys());
    const votingId = await this.majorityEngine.startVoting(votingTopic, eligibleVoters);
    
    // Collect votes from agents
    await this.collectAgentVotes(votingId, agentReports);
    
    // Get majority result
    const majority = await this.majorityEngine.closeVoting(votingId);
    
    // Formulate decision based on majority
    const decision = await this.formulateDecision(
      decisionId,
      'strategic',
      majority,
      agentReports
    );
    
    // Create implementation plan
    const implementation = await this.createImplementationPlan(
      decision,
      agentReports
    );
    
    const queenDecision: QueenDecision = {
      id: decisionId,
      type: 'strategic',
      decision: decision.content,
      majority,
      implementation,
      timestamp: new Date()
    };
    
    // Store decision
    this.currentDecisions.set(decisionId, queenDecision);
    await this.memory.storeDecision(queenDecision);
    
    // Distribute implementation plan
    await this.distributeImplementation(implementation);
    
    this.emit('queen:decision-made', queenDecision);
    return queenDecision;
  }

  /**
   * Handle emergency situations requiring immediate action
   */
  async handleEmergency(
    situation: string,
    severity: 'high' | 'critical',
    context: Record<string, any>
  ): Promise<QueenDecision> {
    const decisionId = this.generateDecisionId();
    
    // Quick voting with available agents
    const availableAgents = this.getAvailableAgents();
    const quickReports = await this.gatherQuickReports(
      availableAgents,
      situation,
      context
    );
    
    // Create emergency voting with short timeout
    const votingOptions = [
      { id: 'immediate-action', value: 'immediate', description: 'Take immediate action' },
      { id: 'escalate', value: 'escalate', description: 'Escalate to human operators' },
      { id: 'contain', value: 'contain', description: 'Contain and monitor' }
    ];
    
    const votingTopic = {
      id: decisionId,
      type: 'action' as const,
      question: `Emergency: ${situation}`,
      options: votingOptions,
      context: { severity, ...context }
    };
    
    // Quick voting with 5 second timeout
    const tempEngine = new MajorityEngine({ votingTimeout: 5000 });
    await tempEngine.initialize();
    
    const votingId = await tempEngine.startVoting(
      votingTopic, 
      availableAgents.map(a => a.getId())
    );
    
    // Cast Queen's vote immediately if tie-breaker
    if (this.config.tieBreakerRole) {
      await tempEngine.castVote(votingId, {
        agentId: this.getId(),
        choice: 'immediate-action',
        weight: 1.5, // Queen has higher weight in emergencies
        confidence: 0.9,
        reasoning: 'Emergency requires immediate action',
        timestamp: new Date()
      });
    }
    
    // Wait for quick votes
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    // Get majority result
    const majority = await tempEngine.closeVoting(votingId);
    
    const decision = {
      content: this.formulateEmergencyResponse(situation, majority),
      rationale: 'Emergency response based on rapid majority vote'
    };
    
    // Simplified implementation for speed
    const implementation = this.createEmergencyPlan(decision, availableAgents);
    
    const queenDecision: QueenDecision = {
      id: decisionId,
      type: 'emergency',
      decision: decision.content,
      majority,
      implementation,
      timestamp: new Date()
    };
    
    // Execute immediately
    await this.executeEmergencyPlan(implementation);
    
    this.emit('queen:emergency-handled', queenDecision);
    return queenDecision;
  }

  /**
   * Monitor swarm performance and health
   */
  async monitorSwarmHealth(): Promise<SwarmHealthReport> {
    const agentStatuses = await this.collectAgentStatuses();
    const memoryHealth = await this.memory.getHealthStatus();
    const votingMetrics = this.majorityEngine.getMetrics();
    
    const health: SwarmHealthReport = {
      timestamp: new Date(),
      overallHealth: this.calculateOverallHealth(agentStatuses, memoryHealth),
      agentHealth: agentStatuses,
      memoryHealth,
      votingMetrics,
      activeDecisions: this.currentDecisions.size,
      recommendations: this.generateHealthRecommendations(agentStatuses, memoryHealth)
    };
    
    this.emit('queen:health-report', health);
    return health;
  }

  /**
   * Coordinate agent collaboration for complex tasks
   */
  async coordinateCollaboration(
    taskId: string,
    requiredCapabilities: string[],
    complexity: 'low' | 'medium' | 'high'
  ): Promise<CollaborationPlan> {
    // Select optimal agents for the task
    const selectedAgents = this.selectAgentsForTask(
      requiredCapabilities,
      complexity
    );
    
    // Define collaboration structure
    const structure = this.defineCollaborationStructure(
      selectedAgents,
      complexity
    );
    
    // Create coordination plan
    const plan: CollaborationPlan = {
      taskId,
      structure,
      agents: selectedAgents,
      communicationProtocol: this.defineCommunicationProtocol(complexity),
      checkpoints: this.defineCheckpoints(complexity),
      conflictResolution: 'queen-mediated'
    };
    
    // Initialize collaboration
    await this.initializeCollaboration(plan);
    
    this.emit('queen:collaboration-started', plan);
    return plan;
  }

  /**
   * Learn from past decisions to improve future ones
   */
  private async analyzeHistoricalPatterns(): Promise<void> {
    const patterns = await this.memory.analyzeDecisionPatterns(
      this.decisionHistory
    );
    
    // Update agent weights based on historical performance
    for (const pattern of patterns) {
      if (pattern.agentId && pattern.successRate > 0) {
        this.majorityEngine.setAgentWeight(
          pattern.agentId,
          Math.min(pattern.successRate, 1.0)
        );
      }
    }
    
    // Identify successful strategies
    const successfulStrategies = patterns.filter(p => p.successRate > 0.8);
    
    this.emit('queen:patterns-learned', {
      totalPatterns: patterns.length,
      successfulPatterns: successfulStrategies.length
    });
  }

  /**
   * Create voting options from agent reports
   */
  private createVotingOptions(reports: AgentReport[]): any[] {
    const optionsMap = new Map<string, number>();
    
    // Aggregate similar recommendations
    for (const report of reports) {
      const key = JSON.stringify(report.recommendation);
      optionsMap.set(key, (optionsMap.get(key) || 0) + 1);
    }
    
    // Convert to voting options
    const options = Array.from(optionsMap.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by frequency
      .slice(0, 5) // Limit to top 5 options
      .map((entry, index) => ({
        id: `option-${index}`,
        value: JSON.parse(entry[0]),
        description: `Recommended by ${entry[1]} agents`,
        proposedBy: reports.find(r => 
          JSON.stringify(r.recommendation) === entry[0]
        )?.agentId
      }));
    
    return options;
  }

  /**
   * Collect votes from agents based on their reports
   */
  private async collectAgentVotes(
    votingId: string,
    reports: AgentReport[]
  ): Promise<void> {
    const votePromises = reports.map(report => {
      // Find the option that matches the agent's recommendation
      const votingStatus = this.majorityEngine.getVotingStatus(votingId);
      if (!votingStatus) return;
      
      const matchingOption = this.createVotingOptions(reports)
        .find(opt => JSON.stringify(opt.value) === JSON.stringify(report.recommendation));
      
      if (matchingOption) {
        return this.majorityEngine.castVote(votingId, {
          agentId: report.agentId,
          choice: matchingOption.id,
          confidence: report.confidence,
          reasoning: report.reasoning,
          timestamp: new Date()
        });
      }
    });
    
    await Promise.allSettled(votePromises);
  }

  /**
   * Handle tie-breaking when Queen has this role
   */
  private handleTieBreak(data: any): void {
    // Queen makes the final decision in case of ties
    this.emit('queen:tie-break', {
      votingId: data.votingId,
      options: data.tiedOptions,
      decision: data.tiedOptions[0] // For now, choose first option
    });
  }

  /**
   * Gather reports from agents on a specific topic
   */
  private async gatherAgentReports(
    topic: string,
    context: Record<string, any>
  ): Promise<AgentReport[]> {
    const reports: AgentReport[] = [];
    const reportPromises = [];
    
    for (const [agentId, agent] of this.activeAgents) {
      reportPromises.push(
        agent.generateReport(topic, context)
          .then(report => ({
            agentId,
            agentType: agent.getType(),
            status: agent.getStatus(),
            recommendation: report.recommendation,
            confidence: report.confidence,
            reasoning: report.reasoning,
            timestamp: new Date()
          }))
      );
    }
    
    const results = await Promise.allSettled(reportPromises);
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        reports.push(result.value);
      }
    }
    
    return reports;
  }

  /**
   * Formulate decision based on majority vote
   */
  private async formulateDecision(
    decisionId: string,
    type: string,
    majority: MajorityResult,
    reports: AgentReport[]
  ): Promise<{ content: string; rationale: string }> {
    // Analyze majority result and reports
    const winningOption = majority.winner;
    const votingStats = majority.votingStats;
    
    // Consider historical success patterns
    const similarDecisions = await this.memory.findSimilarDecisions(
      type,
      winningOption.value
    );
    
    // Formulate decision based on majority vote
    const decision = {
      content: this.synthesizeDecision(winningOption, votingStats, similarDecisions),
      rationale: this.generateRationale(majority, reports, similarDecisions)
    };
    
    return decision;
  }

  /**
   * Create implementation plan for a decision
   */
  private async createImplementationPlan(
    decision: { content: string; rationale: string },
    reports: AgentReport[]
  ): Promise<ImplementationPlan> {
    // Break down decision into actionable steps
    const steps = this.decomposeDecision(decision.content);
    
    // Assign agents based on capabilities and recommendations
    const assignments = this.createAgentAssignments(steps, reports);
    
    // Create timeline
    const timeline = this.createTimeline(steps, assignments);
    
    // Define success criteria
    const successCriteria = this.defineSuccessCriteria(decision.content);
    
    return {
      steps,
      assignments,
      timeline,
      successCriteria
    };
  }

  /**
   * Handle agent reports
   */
  private handleAgentReport(report: any): void {
    // Process and store report
    this.memory.storeAgentReport(report);
    
    // Check if report affects any current decisions
    for (const [decisionId, decision] of this.currentDecisions) {
      if (this.reportAffectsDecision(report, decision)) {
        this.updateDecisionStatus(decisionId, report);
      }
    }
  }

  /**
   * Handle agent alerts
   */
  private handleAgentAlert(alert: any): void {
    this.emit('queen:agent-alert', alert);
    
    // Determine if emergency response needed
    if (alert.severity === 'critical') {
      this.handleEmergency(
        alert.situation,
        alert.severity,
        alert.context
      );
    }
  }

  /**
   * Handle agent requests
   */
  private async handleAgentRequest(request: any): Promise<void> {
    const response = await this.processAgentRequest(request);
    
    // Send response back to agent
    const agent = this.activeAgents.get(request.agentId);
    if (agent) {
      agent.receiveResponse(response);
    }
  }

  /**
   * Initialize event handlers
   */
  private initializeEventHandlers(): void {
    this.majorityEngine.on('majority:voting-started', (data) => {
      this.emit('queen:voting-started', data);
    });
    
    this.majorityEngine.on('majority:vote-cast', (data) => {
      this.emit('queen:vote-cast', data);
    });
    
    this.majorityEngine.on('majority:voting-closed', (result) => {
      this.emit('queen:voting-completed', result);
    });
    
    this.majorityEngine.on('majority:decision-deferred', (data) => {
      this.emit('queen:decision-deferred', data);
    });
    
    this.memory.on('memory:pattern-detected', (pattern) => {
      this.emit('queen:pattern-detected', pattern);
    });
  }

  /**
   * Utility methods
   */
  private generateDecisionId(): string {
    return `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getAvailableAgents(): AgentInterface[] {
    return Array.from(this.activeAgents.values())
      .filter(agent => agent.getStatus() === 'active');
  }

  private calculateOverallHealth(
    agentStatuses: any[],
    memoryHealth: any
  ): 'healthy' | 'degraded' | 'critical' {
    const healthyAgents = agentStatuses.filter(s => s.health === 'healthy').length;
    const healthPercentage = healthyAgents / agentStatuses.length;
    
    if (healthPercentage > 0.8 && memoryHealth.status === 'healthy') {
      return 'healthy';
    } else if (healthPercentage > 0.5) {
      return 'degraded';
    } else {
      return 'critical';
    }
  }

  /**
   * Synthesize decision from winning option
   */
  private synthesizeDecision(
    winningOption: any,
    votingStats: any,
    similarDecisions: any[]
  ): string {
    const percentage = votingStats?.percentagePerOption?.get(winningOption.id) || 0;
    const confidence = percentage > 0.75 ? 'strong' : percentage > 0.5 ? 'moderate' : 'weak';
    
    return `Based on ${confidence} majority (${(percentage * 100).toFixed(1)}%), ` +
           `the swarm decides to: ${JSON.stringify(winningOption.value)}. ` +
           `This aligns with ${similarDecisions.length} similar past decisions.`;
  }

  /**
   * Generate rationale for the decision
   */
  private generateRationale(
    majority: MajorityResult,
    reports: AgentReport[],
    similarDecisions: any[]
  ): string {
    const participation = majority.participation;
    const stats = majority.votingStats;
    
    return `Decision reached through majority vote. ` +
           `${participation.actualVoters}/${participation.eligibleVoters} agents participated ` +
           `(${(participation.participationRate * 100).toFixed(1)}% turnout). ` +
           `The winning option received ${stats.totalVotes} votes. ` +
           `Historical analysis shows ${similarDecisions.filter(d => d.successful).length} ` +
           `successful similar decisions.`;
  }

  /**
   * Formulate emergency response based on majority
   */
  private formulateEmergencyResponse(situation: string, majority: MajorityResult): string {
    const action = majority.winner.value;
    
    switch (action) {
      case 'immediate':
        return `EMERGENCY ACTION: Immediate intervention initiated for ${situation}. ` +
               `All available agents mobilized.`;
      case 'escalate':
        return `EMERGENCY ESCALATION: Human operators notified. ` +
               `Situation: ${situation}. Awaiting human intervention.`;
      case 'contain':
        return `EMERGENCY CONTAINMENT: Monitoring and containing ${situation}. ` +
               `Automated safeguards activated.`;
      default:
        return `EMERGENCY RESPONSE: Default action taken for ${situation}.`;
    }
  }

  // Additional missing helper methods
  private async gatherQuickReports(
    agents: AgentInterface[],
    situation: string,
    context: Record<string, any>
  ): Promise<AgentReport[]> {
    const reports: AgentReport[] = [];
    const timeout = 3000; // 3 second timeout for emergency
    
    const reportPromises = agents.map(agent => 
      Promise.race([
        agent.generateReport(situation, context),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeout)
        )
      ]).then(report => ({
        agentId: agent.getId(),
        agentType: agent.getType(),
        status: agent.getStatus(),
        recommendation: (report as any).recommendation,
        confidence: (report as any).confidence,
        reasoning: (report as any).reasoning,
        timestamp: new Date()
      })).catch(() => null)
    );
    
    const results = await Promise.all(reportPromises);
    return results.filter(r => r !== null) as AgentReport[];
  }

  private createEmergencyPlan(decision: any, agents: AgentInterface[]): ImplementationPlan {
    return {
      steps: [{
        id: 'emergency-1',
        action: decision.content,
        dependencies: [],
        assignedAgents: agents.map(a => a.getId()),
        estimatedDuration: 300000 // 5 minutes
      }],
      assignments: agents.map(a => ({
        agentId: a.getId(),
        taskIds: ['emergency-1'],
        priority: 'critical' as const,
        deadline: new Date(Date.now() + 300000)
      })),
      timeline: {
        start: new Date(),
        end: new Date(Date.now() + 300000),
        milestones: []
      },
      successCriteria: [{
        metric: 'situation-resolved',
        target: 1,
        operator: '='
      }]
    };
  }

  private async executeEmergencyPlan(plan: ImplementationPlan): Promise<void> {
    this.emit('queen:emergency-execution', { plan });
    // Implementation would trigger immediate agent actions
  }

  private async distributeImplementation(plan: ImplementationPlan): Promise<void> {
    for (const assignment of plan.assignments) {
      const agent = this.activeAgents.get(assignment.agentId);
      if (agent) {
        this.emit('queen:task-assigned', {
          agentId: assignment.agentId,
          tasks: assignment.taskIds,
          priority: assignment.priority
        });
      }
    }
  }

  private decomposeDecision(decisionContent: string): ExecutionStep[] {
    // Simple decomposition - in real implementation would be more sophisticated
    return [{
      id: 'step-1',
      action: decisionContent,
      dependencies: [],
      assignedAgents: [],
      estimatedDuration: 3600000 // 1 hour
    }];
  }

  private createAgentAssignments(
    steps: ExecutionStep[],
    reports: AgentReport[]
  ): AgentAssignment[] {
    // Assign based on agent confidence and type
    const assignments: AgentAssignment[] = [];
    const sortedReports = reports.sort((a, b) => b.confidence - a.confidence);
    
    for (let i = 0; i < steps.length; i++) {
      const agent = sortedReports[i % sortedReports.length];
      assignments.push({
        agentId: agent.agentId,
        taskIds: [steps[i].id],
        priority: 'high',
        deadline: new Date(Date.now() + steps[i].estimatedDuration)
      });
    }
    
    return assignments;
  }

  private createTimeline(steps: ExecutionStep[], assignments: AgentAssignment[]): Timeline {
    const duration = steps.reduce((sum, step) => sum + step.estimatedDuration, 0);
    
    return {
      start: new Date(),
      end: new Date(Date.now() + duration),
      milestones: steps.map((step, index) => ({
        id: `milestone-${index}`,
        name: `Complete ${step.action}`,
        targetDate: new Date(Date.now() + step.estimatedDuration),
        criteria: [`Step ${step.id} completed`]
      }))
    };
  }

  private defineSuccessCriteria(decisionContent: string): SuccessCriteria[] {
    return [{
      metric: 'decision-implemented',
      target: 1,
      operator: '='
    }, {
      metric: 'error-rate',
      target: 0.1,
      operator: '<'
    }];
  }

  private async collectAgentStatuses(): Promise<any[]> {
    return Array.from(this.activeAgents.values()).map(agent => ({
      agentId: agent.getId(),
      type: agent.getType(),
      status: agent.getStatus(),
      health: 'healthy' // Would check actual health metrics
    }));
  }

  private generateHealthRecommendations(agentStatuses: any[], memoryHealth: any): string[] {
    const recommendations: string[] = [];
    
    const unhealthyAgents = agentStatuses.filter(s => s.health !== 'healthy');
    if (unhealthyAgents.length > 0) {
      recommendations.push(`${unhealthyAgents.length} agents need attention`);
    }
    
    if (memoryHealth.usage > 0.8) {
      recommendations.push('Memory usage high - consider cleanup');
    }
    
    return recommendations;
  }

  private selectAgentsForTask(capabilities: string[], complexity: string): AgentInterface[] {
    // Select agents based on required capabilities
    const selected: AgentInterface[] = [];
    
    for (const [_, agent] of this.activeAgents) {
      // Would check agent capabilities in real implementation
      selected.push(agent);
      if (selected.length >= (complexity === 'high' ? 5 : 3)) break;
    }
    
    return selected;
  }

  private defineCollaborationStructure(agents: AgentInterface[], complexity: string): any {
    return {
      type: complexity === 'high' ? 'hierarchical' : 'peer-to-peer',
      roles: agents.map(a => ({
        agentId: a.getId(),
        role: a.getType()
      }))
    };
  }

  private defineCommunicationProtocol(complexity: string): any {
    return {
      frequency: complexity === 'high' ? 'continuous' : 'periodic',
      channels: ['direct', 'broadcast'],
      format: 'structured'
    };
  }

  private defineCheckpoints(complexity: string): any[] {
    const count = complexity === 'high' ? 5 : 3;
    return Array.from({ length: count }, (_, i) => ({
      id: `checkpoint-${i}`,
      progress: ((i + 1) / count) * 100,
      criteria: [`Milestone ${i + 1} completed`]
    }));
  }

  private async initializeCollaboration(plan: CollaborationPlan): Promise<void> {
    this.emit('queen:collaboration-initialized', plan);
  }

  private reportAffectsDecision(report: any, decision: QueenDecision): boolean {
    // Check if report is relevant to decision
    return report.context?.decisionId === decision.id;
  }

  private updateDecisionStatus(decisionId: string, report: any): void {
    const decision = this.currentDecisions.get(decisionId);
    if (decision) {
      this.emit('queen:decision-updated', {
        decisionId,
        update: report
      });
    }
  }

  private async processAgentRequest(request: any): Promise<any> {
    return {
      approved: true,
      response: 'Request processed by Queen',
      timestamp: new Date()
    };
  }
  
  // Interface implementation methods
  getId(): string {
    return `queen_${this.config.swarmId}`;
  }
  
  getType(): string {
    return 'queen';
  }
  
  getStatus(): string {
    return 'active';
  }
  
  async generateReport(topic: string, context: any): Promise<any> {
    return {
      recommendation: 'Queen oversight report',
      confidence: 1.0,
      reasoning: 'Central coordination analysis'
    };
  }
  
  receiveResponse(response: any): void {
    // Process responses to Queen's requests
  }
}

// Type definitions
export interface SwarmHealthReport {
  timestamp: Date;
  overallHealth: 'healthy' | 'degraded' | 'critical';
  agentHealth: any[];
  memoryHealth: any;
  votingMetrics: any;
  activeDecisions: number;
  recommendations: string[];
}

export interface CollaborationPlan {
  taskId: string;
  structure: any;
  agents: AgentInterface[];
  communicationProtocol: any;
  checkpoints: any[];
  conflictResolution: string;
}