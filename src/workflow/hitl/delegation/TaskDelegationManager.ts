// Task Delegation Manager - Handles delegation of tasks to human operators
import { EventEmitter } from 'events';
import { HITLDecision } from '../core/HITLOrchestrator';
import { SwarmMemory } from '../../../swarm/memory/SwarmMemory';

export interface DelegatedTask {
  id: string;
  title: string;
  description: string;
  type: 'analysis' | 'validation' | 'decision' | 'execution' | 'review' | 'research';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  
  // Task details
  estimatedDuration: number; // minutes
  deadline?: Date;
  requiredSkills: string[];
  requiredRole: string;
  complexity: 'simple' | 'moderate' | 'complex' | 'expert';
  
  // Delegation context
  originatingDecision?: string; // HITLDecision ID
  delegatedBy: string; // Agent or system ID
  assignedTo?: string; // Human operator ID
  delegatedAt: Date;
  assignedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  
  // Task data
  inputs: any;
  expectedOutputs: TaskOutput[];
  context: TaskContext;
  instructions: TaskInstruction[];
  resources: TaskResource[];
  
  // Progress tracking
  progress: number; // 0-100
  milestones: TaskMilestone[];
  timeSpent: number; // minutes
  
  // Quality control
  qualityChecks: QualityCheck[];
  reviewRequired: boolean;
  reviewedBy?: string;
  
  // Results
  outputs?: any;
  feedback?: string;
  lessons?: string[];
  
  metadata: {
    clientId?: string;
    projectId?: string;
    tags: string[];
    urgencyReason?: string;
    escalationPath: string[];
  };
}

export interface TaskOutput {
  id: string;
  name: string;
  type: 'document' | 'decision' | 'analysis' | 'recommendation' | 'data' | 'approval';
  format: string;
  required: boolean;
  description: string;
  validationCriteria: string[];
}

export interface TaskContext {
  background: string;
  goals: string[];
  constraints: string[];
  stakeholders: string[];
  relatedTasks: string[];
  dependencies: string[];
  risks: string[];
  successCriteria: string[];
}

export interface TaskInstruction {
  step: number;
  action: string;
  details: string;
  tools?: string[];
  checkpoints?: string[];
  alternatives?: string[];
}

export interface TaskResource {
  id: string;
  name: string;
  type: 'document' | 'tool' | 'contact' | 'system' | 'data';
  location: string;
  description: string;
  accessInstructions?: string;
}

export interface TaskMilestone {
  id: string;
  name: string;
  description: string;
  targetDate: Date;
  completed: boolean;
  completedAt?: Date;
  deliverables: string[];
}

export interface QualityCheck {
  id: string;
  name: string;
  criteria: string;
  type: 'automatic' | 'manual';
  passed?: boolean;
  notes?: string;
  checkedAt?: Date;
}

export interface HumanOperator {
  id: string;
  name: string;
  email: string;
  role: string;
  skills: string[];
  expertise: string[];
  availability: OperatorAvailability;
  workload: number; // 0-100%
  performance: OperatorPerformance;
  preferences: OperatorPreferences;
  status: 'available' | 'busy' | 'offline' | 'vacation';
}

export interface OperatorAvailability {
  timezone: string;
  workingHours: {
    start: string; // HH:MM
    end: string;   // HH:MM
  };
  workingDays: number[]; // 0-6 (Sunday-Saturday)
  vacationDates: Date[];
  currentCapacity: number; // remaining hours this week
}

export interface OperatorPerformance {
  completionRate: number; // 0-1
  averageQuality: number; // 0-5
  averageTime: number; // ratio to estimated time
  tasksCompleted: number;
  expertiseAreas: string[];
  strengthsWeaknesses: {
    strengths: string[];
    improvementAreas: string[];
  };
}

export interface OperatorPreferences {
  preferredTaskTypes: string[];
  preferredComplexity: string[];
  communicationStyle: 'brief' | 'detailed' | 'visual';
  notificationChannels: string[];
  workingStyle: 'collaborative' | 'independent' | 'guided';
}

export interface DelegationStrategy {
  id: string;
  name: string;
  description: string;
  rules: DelegationRule[];
  priority: number;
  active: boolean;
}

export interface DelegationRule {
  condition: string; // e.g., "task.complexity === 'expert'"
  action: 'assign_to_role' | 'assign_to_person' | 'require_approval' | 'split_task' | 'escalate';
  parameters: any;
  weight: number;
}

export class TaskDelegationManager extends EventEmitter {
  private tasks: Map<string, DelegatedTask> = new Map();
  private operators: Map<string, HumanOperator> = new Map();
  private strategies: Map<string, DelegationStrategy> = new Map();
  private swarmMemory: SwarmMemory;
  private assignmentQueue: string[] = [];
  private processingInterval?: NodeJS.Timeout;

  constructor(swarmMemory: SwarmMemory) {
    super();
    this.swarmMemory = swarmMemory;
    this.setupDefaultStrategies();
    this.startProcessing();
  }

  private setupDefaultStrategies(): void {
    // Expert-level task strategy
    this.addStrategy({
      id: 'expert-tasks',
      name: 'Expert Task Assignment',
      description: 'Assign complex tasks to senior experts',
      rules: [
        {
          condition: "task.complexity === 'expert'",
          action: 'assign_to_role',
          parameters: { role: 'senior-specialist', requireApproval: true },
          weight: 10
        },
        {
          condition: "task.priority === 'critical'",
          action: 'assign_to_person',
          parameters: { selectBest: true, notifyManager: true },
          weight: 9
        }
      ],
      priority: 1,
      active: true
    });

    // Load balancing strategy
    this.addStrategy({
      id: 'load-balancing',
      name: 'Workload Distribution',
      description: 'Distribute tasks based on current workload',
      rules: [
        {
          condition: "operator.workload < 0.7",
          action: 'assign_to_person',
          parameters: { considerWorkload: true },
          weight: 5
        },
        {
          condition: "task.estimatedDuration > 120 && operator.workload > 0.8",
          action: 'split_task',
          parameters: { maxSubtasks: 3 },
          weight: 7
        }
      ],
      priority: 2,
      active: true
    });

    // Skill matching strategy
    this.addStrategy({
      id: 'skill-matching',
      name: 'Skill-Based Assignment',
      description: 'Match tasks to operators based on skills',
      rules: [
        {
          condition: "intersection(task.requiredSkills, operator.skills).length >= task.requiredSkills.length * 0.8",
          action: 'assign_to_person',
          parameters: { skillMatch: true },
          weight: 8
        }
      ],
      priority: 3,
      active: true
    });
  }

  /**
   * Delegate a task from an HITL decision
   */
  public async delegateFromDecision(
    decision: HITLDecision,
    taskType: DelegatedTask['type'],
    customInstructions?: Partial<DelegatedTask>
  ): Promise<DelegatedTask> {
    const task: DelegatedTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: customInstructions?.title || `Review: ${decision.title}`,
      description: customInstructions?.description || decision.description,
      type: taskType,
      priority: this.mapPriorityFromDecision(decision),
      status: 'pending',
      
      estimatedDuration: this.estimateTaskDuration(taskType, decision),
      deadline: this.calculateDeadline(decision),
      requiredSkills: this.determineRequiredSkills(taskType, decision),
      requiredRole: this.determineRequiredRole(taskType, decision),
      complexity: this.assessComplexity(decision),
      
      originatingDecision: decision.id,
      delegatedBy: 'hitl-orchestrator',
      delegatedAt: new Date(),
      
      inputs: {
        decision,
        swarmRecommendations: decision.context.recommendations,
        context: decision.context,
        metadata: decision.metadata
      },
      expectedOutputs: this.generateExpectedOutputs(taskType, decision),
      context: this.buildTaskContext(decision),
      instructions: this.generateInstructions(taskType, decision),
      resources: this.gatherResources(decision),
      
      progress: 0,
      milestones: this.generateMilestones(taskType, decision),
      timeSpent: 0,
      
      qualityChecks: this.generateQualityChecks(taskType),
      reviewRequired: this.shouldRequireReview(taskType, decision),
      
      metadata: {
        clientId: decision.metadata.clientId,
        projectId: decision.metadata.projectId,
        tags: [...decision.metadata.tags, 'delegated', taskType],
        urgencyReason: this.determineUrgencyReason(decision),
        escalationPath: this.buildEscalationPath(decision)
      },
      
      ...customInstructions
    };

    this.tasks.set(task.id, task);
    this.assignmentQueue.push(task.id);

    // Store in swarm memory
    await this.swarmMemory.store(`delegation:task:${task.id}`, task);

    this.emit('task:created', task);
    return task;
  }

  /**
   * Create a custom delegated task
   */
  public async createTask(taskData: Partial<DelegatedTask> & { 
    title: string; 
    description: string; 
    type: DelegatedTask['type'];
  }): Promise<DelegatedTask> {
    const task: DelegatedTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      priority: 'medium',
      status: 'pending',
      estimatedDuration: 60,
      requiredSkills: [],
      requiredRole: 'analyst',
      complexity: 'moderate',
      delegatedBy: 'system',
      delegatedAt: new Date(),
      inputs: {},
      expectedOutputs: [],
      context: {
        background: '',
        goals: [],
        constraints: [],
        stakeholders: [],
        relatedTasks: [],
        dependencies: [],
        risks: [],
        successCriteria: []
      },
      instructions: [],
      resources: [],
      progress: 0,
      milestones: [],
      timeSpent: 0,
      qualityChecks: [],
      reviewRequired: false,
      metadata: {
        tags: [],
        escalationPath: []
      },
      ...taskData
    };

    this.tasks.set(task.id, task);
    this.assignmentQueue.push(task.id);

    await this.swarmMemory.store(`delegation:task:${task.id}`, task);
    this.emit('task:created', task);
    return task;
  }

  /**
   * Register a human operator
   */
  public registerOperator(operator: HumanOperator): void {
    this.operators.set(operator.id, operator);
    this.emit('operator:registered', operator);
  }

  /**
   * Update operator status
   */
  public updateOperatorStatus(operatorId: string, status: HumanOperator['status']): void {
    const operator = this.operators.get(operatorId);
    if (operator) {
      operator.status = status;
      this.emit('operator:statusChanged', { operator, status });
    }
  }

  /**
   * Start processing assignment queue
   */
  private startProcessing(): void {
    this.processingInterval = setInterval(() => {
      this.processAssignmentQueue();
    }, 5000); // Check every 5 seconds
  }

  /**
   * Process tasks in assignment queue
   */
  private async processAssignmentQueue(): Promise<void> {
    while (this.assignmentQueue.length > 0) {
      const taskId = this.assignmentQueue.shift();
      if (!taskId) continue;

      const task = this.tasks.get(taskId);
      if (!task || task.status !== 'pending') continue;

      try {
        await this.assignTask(task);
      } catch (error) {
        this.emit('assignment:failed', { task, error });
        // Retry later
        this.assignmentQueue.push(taskId);
        break;
      }
    }
  }

  /**
   * Assign a task to an operator
   */
  private async assignTask(task: DelegatedTask): Promise<void> {
    const bestOperator = this.findBestOperator(task);
    
    if (!bestOperator) {
      // No suitable operator found, escalate
      await this.escalateTaskAssignment(task);
      return;
    }

    // Assign task
    task.assignedTo = bestOperator.id;
    task.assignedAt = new Date();
    task.status = 'assigned';

    // Update operator workload
    bestOperator.workload += this.calculateWorkloadImpact(task);

    // Store updates
    await this.swarmMemory.store(`delegation:task:${task.id}`, task);
    await this.swarmMemory.store(`delegation:operator:${bestOperator.id}`, bestOperator);

    this.emit('task:assigned', { task, operator: bestOperator });
  }

  /**
   * Find the best operator for a task
   */
  private findBestOperator(task: DelegatedTask): HumanOperator | null {
    const availableOperators = Array.from(this.operators.values()).filter(op => 
      op.status === 'available' && 
      this.isOperatorEligible(op, task)
    );

    if (availableOperators.length === 0) return null;

    // Score operators based on multiple criteria
    const scoredOperators = availableOperators.map(operator => ({
      operator,
      score: this.scoreOperatorForTask(operator, task)
    }));

    // Sort by score (highest first)
    scoredOperators.sort((a, b) => b.score - a.score);

    return scoredOperators[0].operator;
  }

  /**
   * Check if operator is eligible for a task
   */
  private isOperatorEligible(operator: HumanOperator, task: DelegatedTask): boolean {
    // Check role requirement
    if (task.requiredRole && operator.role !== task.requiredRole) {
      return false;
    }

    // Check workload capacity
    if (operator.workload >= 1.0) {
      return false;
    }

    // Check required skills
    const hasRequiredSkills = task.requiredSkills.every(skill =>
      operator.skills.includes(skill) || operator.expertise.includes(skill)
    );

    if (!hasRequiredSkills) {
      return false;
    }

    // Check availability during task timeframe
    if (!this.isOperatorAvailableForTask(operator, task)) {
      return false;
    }

    return true;
  }

  /**
   * Score an operator for a task (0-100)
   */
  private scoreOperatorForTask(operator: HumanOperator, task: DelegatedTask): number {
    let score = 0;

    // Skill match score (30%)
    const skillMatchRatio = task.requiredSkills.filter(skill =>
      operator.skills.includes(skill) || operator.expertise.includes(skill)
    ).length / Math.max(task.requiredSkills.length, 1);
    score += skillMatchRatio * 30;

    // Performance score (25%)
    score += operator.performance.completionRate * 25;

    // Workload score (20%) - prefer less loaded operators
    score += (1 - operator.workload) * 20;

    // Quality score (15%)
    score += (operator.performance.averageQuality / 5) * 15;

    // Time efficiency score (10%)
    const timeEfficiency = Math.min(1 / operator.performance.averageTime, 1);
    score += timeEfficiency * 10;

    return score;
  }

  /**
   * Check if operator is available for task timeframe
   */
  private isOperatorAvailableForTask(operator: HumanOperator, task: DelegatedTask): boolean {
    const now = new Date();
    const taskEnd = new Date(now.getTime() + task.estimatedDuration * 60000);

    // Check vacation dates
    const isOnVacation = operator.availability.vacationDates.some(vacation =>
      vacation >= now && vacation <= taskEnd
    );

    if (isOnVacation) return false;

    // Check working hours (simplified - assumes task will be done today)
    const currentHour = now.getHours();
    const startHour = parseInt(operator.availability.workingHours.start.split(':')[0]);
    const endHour = parseInt(operator.availability.workingHours.end.split(':')[0]);

    if (currentHour < startHour || currentHour >= endHour) {
      // Check if task can wait until working hours
      if (task.priority === 'critical') return false;
    }

    // Check working days
    const currentDay = now.getDay();
    if (!operator.availability.workingDays.includes(currentDay)) {
      if (task.priority === 'critical') return false;
    }

    return true;
  }

  /**
   * Start task execution
   */
  public async startTask(taskId: string, operatorId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    if (task.assignedTo !== operatorId) {
      throw new Error(`Task ${taskId} is not assigned to operator ${operatorId}`);
    }

    task.status = 'in_progress';
    task.startedAt = new Date();

    await this.swarmMemory.store(`delegation:task:${task.id}`, task);
    this.emit('task:started', { task, operatorId });
  }

  /**
   * Update task progress
   */
  public async updateTaskProgress(
    taskId: string, 
    progress: number, 
    notes?: string
  ): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    task.progress = Math.max(0, Math.min(100, progress));
    
    if (notes) {
      if (!task.feedback) task.feedback = '';
      task.feedback += `\n[${new Date().toISOString()}] ${notes}`;
    }

    // Check milestone completion
    this.checkMilestoneCompletion(task);

    await this.swarmMemory.store(`delegation:task:${task.id}`, task);
    this.emit('task:progressUpdated', { task, progress, notes });
  }

  /**
   * Complete a task
   */
  public async completeTask(
    taskId: string, 
    outputs: any, 
    feedback?: string,
    lessons?: string[]
  ): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    task.status = 'completed';
    task.completedAt = new Date();
    task.progress = 100;
    task.outputs = outputs;
    
    if (feedback) task.feedback = feedback;
    if (lessons) task.lessons = lessons;

    // Calculate time spent
    if (task.startedAt) {
      task.timeSpent = Math.round(
        (task.completedAt.getTime() - task.startedAt.getTime()) / 60000
      );
    }

    // Update operator workload
    if (task.assignedTo) {
      const operator = this.operators.get(task.assignedTo);
      if (operator) {
        operator.workload -= this.calculateWorkloadImpact(task);
        operator.workload = Math.max(0, operator.workload);
        
        // Update performance metrics
        this.updateOperatorPerformance(operator, task);
      }
    }

    // Run quality checks
    await this.runQualityChecks(task);

    await this.swarmMemory.store(`delegation:task:${task.id}`, task);
    this.emit('task:completed', { task });

    // If this was for an HITL decision, signal completion
    if (task.originatingDecision) {
      this.emit('decision:taskCompleted', {
        decisionId: task.originatingDecision,
        task,
        outputs
      });
    }
  }

  /**
   * Escalate task assignment
   */
  private async escalateTaskAssignment(task: DelegatedTask): Promise<void> {
    task.metadata.tags.push('assignment-escalated');
    
    // Try to find operators from escalation path
    for (const role of task.metadata.escalationPath) {
      const escalationOperators = Array.from(this.operators.values()).filter(op =>
        op.role === role && op.status === 'available'
      );

      if (escalationOperators.length > 0) {
        task.requiredRole = role;
        task.priority = this.increasePriority(task.priority);
        this.assignmentQueue.unshift(task.id); // Priority queue
        this.emit('task:escalated', { task, escalatedTo: role });
        return;
      }
    }

    // No operators available, mark as failed
    task.status = 'failed';
    await this.swarmMemory.store(`delegation:task:${task.id}`, task);
    this.emit('task:assignmentFailed', { task });
  }

  // Utility methods
  private mapPriorityFromDecision(decision: HITLDecision): DelegatedTask['priority'] {
    return decision.metadata.priority;
  }

  private estimateTaskDuration(type: DelegatedTask['type'], decision: HITLDecision): number {
    const baseDurations = {
      analysis: 120,
      validation: 60,
      decision: 30,
      execution: 180,
      review: 45,
      research: 240
    };

    let duration = baseDurations[type];

    // Adjust based on complexity
    const complexity = this.assessComplexity(decision);
    const complexityMultipliers = {
      simple: 0.7,
      moderate: 1.0,
      complex: 1.5,
      expert: 2.0
    };

    duration *= complexityMultipliers[complexity];

    // Adjust based on priority
    if (decision.metadata.priority === 'critical') duration *= 0.8; // Rush job
    if (decision.metadata.priority === 'low') duration *= 1.2; // More thorough

    return Math.round(duration);
  }

  private calculateDeadline(decision: HITLDecision): Date | undefined {
    if (decision.metadata.priority === 'critical') {
      return new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours
    }
    if (decision.metadata.priority === 'high') {
      return new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    }
    if (decision.metadata.priority === 'medium') {
      return new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days
    }
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 1 week
  }

  private determineRequiredSkills(type: DelegatedTask['type'], decision: HITLDecision): string[] {
    const baseSkills = {
      analysis: ['data-analysis', 'critical-thinking'],
      validation: ['attention-to-detail', 'domain-knowledge'],
      decision: ['strategic-thinking', 'risk-assessment'],
      execution: ['project-management', 'implementation'],
      review: ['quality-assurance', 'communication'],
      research: ['research-methods', 'information-synthesis']
    };

    const skills = [...baseSkills[type]];

    // Add domain-specific skills based on decision context
    if (decision.metadata.clientId) skills.push('client-management');
    if (decision.context.financialImpact && decision.context.financialImpact > 10000) {
      skills.push('financial-analysis');
    }
    if (decision.context.riskLevel === 'high' || decision.context.riskLevel === 'critical') {
      skills.push('risk-management');
    }

    return skills;
  }

  private determineRequiredRole(type: DelegatedTask['type'], decision: HITLDecision): string {
    if (decision.context.riskLevel === 'critical') return 'senior-manager';
    if (decision.context.financialImpact && decision.context.financialImpact > 50000) return 'manager';
    
    const roleMap = {
      analysis: 'analyst',
      validation: 'specialist',
      decision: 'manager',
      execution: 'coordinator',
      review: 'reviewer',
      research: 'researcher'
    };

    return roleMap[type];
  }

  private assessComplexity(decision: HITLDecision): DelegatedTask['complexity'] {
    let complexityScore = 0;

    // Factor in various aspects
    if (decision.context.recommendations.length > 5) complexityScore += 1;
    if (decision.context.financialImpact && decision.context.financialImpact > 100000) complexityScore += 2;
    if (decision.context.riskLevel === 'high') complexityScore += 1;
    if (decision.context.riskLevel === 'critical') complexityScore += 2;
    if (decision.context.stakeholders.length > 3) complexityScore += 1;
    if (decision.type === 'strategic') complexityScore += 2;

    if (complexityScore >= 6) return 'expert';
    if (complexityScore >= 4) return 'complex';
    if (complexityScore >= 2) return 'moderate';
    return 'simple';
  }

  private generateExpectedOutputs(type: DelegatedTask['type'], decision: HITLDecision): TaskOutput[] {
    const outputs: TaskOutput[] = [];

    switch (type) {
      case 'analysis':
        outputs.push({
          id: 'analysis-report',
          name: 'Analysis Report',
          type: 'analysis',
          format: 'document',
          required: true,
          description: 'Detailed analysis with findings and recommendations',
          validationCriteria: ['Clear methodology', 'Evidence-based conclusions', 'Actionable recommendations']
        });
        break;

      case 'decision':
        outputs.push({
          id: 'decision-outcome',
          name: 'Decision Outcome',
          type: 'decision',
          format: 'structured',
          required: true,
          description: 'Final decision with rationale and implementation plan',
          validationCriteria: ['Clear decision statement', 'Justified rationale', 'Implementation roadmap']
        });
        break;

      case 'validation':
        outputs.push({
          id: 'validation-result',
          name: 'Validation Result',
          type: 'approval',
          format: 'structured',
          required: true,
          description: 'Validation outcome with approval/rejection and reasoning',
          validationCriteria: ['Clear outcome', 'Detailed reasoning', 'Quality assessment']
        });
        break;
    }

    return outputs;
  }

  private buildTaskContext(decision: HITLDecision): TaskContext {
    return {
      background: `HITL decision requiring human intervention: ${decision.description}`,
      goals: [
        'Review AI recommendations',
        'Provide human judgment',
        'Ensure quality and accuracy',
        'Make final decision'
      ],
      constraints: [
        `Priority: ${decision.metadata.priority}`,
        `Risk level: ${decision.context.riskLevel}`,
        decision.context.financialImpact ? `Financial impact: $${decision.context.financialImpact}` : '',
        `Timeline: ${decision.context.timeframe}`
      ].filter(Boolean),
      stakeholders: decision.context.stakeholders,
      relatedTasks: [],
      dependencies: [],
      risks: [
        'Incorrect decision could impact business',
        'Delay could affect timelines',
        'Quality issues could damage reputation'
      ],
      successCriteria: [
        'Decision made within timeframe',
        'Quality meets standards',
        'Stakeholders informed',
        'Implementation plan provided'
      ]
    };
  }

  private generateInstructions(type: DelegatedTask['type'], decision: HITLDecision): TaskInstruction[] {
    const instructions: TaskInstruction[] = [];

    instructions.push({
      step: 1,
      action: 'Review Context',
      details: 'Review the HITL decision context, AI recommendations, and background information',
      tools: ['dashboard', 'documents'],
      checkpoints: ['Context understood', 'AI recommendations reviewed']
    });

    instructions.push({
      step: 2,
      action: 'Analyze Information',
      details: 'Analyze the provided information, validate AI assumptions, and identify gaps',
      tools: ['analysis-tools', 'data-sources'],
      checkpoints: ['Analysis complete', 'Gaps identified', 'Assumptions validated']
    });

    instructions.push({
      step: 3,
      action: 'Make Decision',
      details: 'Make the final decision based on analysis and human judgment',
      checkpoints: ['Decision made', 'Rationale documented', 'Implementation plan created']
    });

    return instructions;
  }

  private gatherResources(decision: HITLDecision): TaskResource[] {
    const resources: TaskResource[] = [];

    resources.push({
      id: 'decision-context',
      name: 'Decision Context',
      type: 'data',
      location: 'dashboard',
      description: 'Complete context of the HITL decision including AI recommendations'
    });

    if (decision.metadata.clientId) {
      resources.push({
        id: 'client-profile',
        name: 'Client Profile',
        type: 'document',
        location: 'crm-system',
        description: 'Client information and history'
      });
    }

    return resources;
  }

  private generateMilestones(type: DelegatedTask['type'], decision: HITLDecision): TaskMilestone[] {
    const now = new Date();
    const milestones: TaskMilestone[] = [];

    milestones.push({
      id: 'initial-review',
      name: 'Initial Review Complete',
      description: 'Context and AI recommendations reviewed',
      targetDate: new Date(now.getTime() + 30 * 60 * 1000), // 30 minutes
      completed: false,
      deliverables: ['Review notes', 'Initial assessment']
    });

    if (type === 'analysis') {
      milestones.push({
        id: 'analysis-complete',
        name: 'Analysis Complete',
        description: 'Detailed analysis finished',
        targetDate: new Date(now.getTime() + 90 * 60 * 1000), // 90 minutes
        completed: false,
        deliverables: ['Analysis report', 'Findings summary']
      });
    }

    milestones.push({
      id: 'decision-made',
      name: 'Decision Made',
      description: 'Final decision reached and documented',
      targetDate: new Date(now.getTime() + 120 * 60 * 1000), // 2 hours
      completed: false,
      deliverables: ['Decision document', 'Implementation plan']
    });

    return milestones;
  }

  private generateQualityChecks(type: DelegatedTask['type']): QualityCheck[] {
    const checks: QualityCheck[] = [];

    checks.push({
      id: 'completeness',
      name: 'Completeness Check',
      criteria: 'All required outputs provided and complete',
      type: 'manual'
    });

    checks.push({
      id: 'accuracy',
      name: 'Accuracy Check',
      criteria: 'Information is accurate and verified',
      type: 'manual'
    });

    if (type === 'analysis' || type === 'research') {
      checks.push({
        id: 'methodology',
        name: 'Methodology Check',
        criteria: 'Analysis methodology is sound and appropriate',
        type: 'manual'
      });
    }

    return checks;
  }

  private shouldRequireReview(type: DelegatedTask['type'], decision: HITLDecision): boolean {
    return (
      decision.context.riskLevel === 'critical' ||
      (decision.context.financialImpact && decision.context.financialImpact > 50000) ||
      decision.metadata.priority === 'critical' ||
      type === 'decision'
    );
  }

  private determineUrgencyReason(decision: HITLDecision): string {
    if (decision.metadata.priority === 'critical') {
      return 'Critical business decision requiring immediate attention';
    }
    if (decision.context.riskLevel === 'high' || decision.context.riskLevel === 'critical') {
      return `High risk level (${decision.context.riskLevel}) requires careful review`;
    }
    if (decision.context.financialImpact && decision.context.financialImpact > 100000) {
      return `High financial impact ($${decision.context.financialImpact}) requires validation`;
    }
    return 'Standard review process';
  }

  private buildEscalationPath(decision: HITLDecision): string[] {
    const basePath = ['specialist', 'manager', 'senior-manager'];
    
    if (decision.context.riskLevel === 'critical') {
      basePath.push('director', 'executive');
    }
    
    if (decision.context.financialImpact && decision.context.financialImpact > 100000) {
      basePath.push('executive', 'board');
    }

    return Array.from(new Set(basePath)); // Remove duplicates
  }

  private calculateWorkloadImpact(task: DelegatedTask): number {
    // Convert estimated duration to workload percentage
    // Assuming 40 hours per week capacity
    const weeklyHours = 40 * 60; // 40 hours in minutes
    return task.estimatedDuration / weeklyHours;
  }

  private updateOperatorPerformance(operator: HumanOperator, task: DelegatedTask): void {
    // Update completion rate
    operator.performance.tasksCompleted += 1;

    // Update average time ratio
    const estimatedVsActual = task.timeSpent / task.estimatedDuration;
    operator.performance.averageTime = 
      (operator.performance.averageTime + estimatedVsActual) / 2;

    // Quality score would be updated based on quality checks and feedback
    // This is simplified - in practice would involve more complex scoring
  }

  private checkMilestoneCompletion(task: DelegatedTask): void {
    task.milestones.forEach(milestone => {
      if (!milestone.completed && task.progress >= this.getMilestoneThreshold(milestone)) {
        milestone.completed = true;
        milestone.completedAt = new Date();
        this.emit('milestone:completed', { task, milestone });
      }
    });
  }

  private getMilestoneThreshold(milestone: TaskMilestone): number {
    // Map milestone names to progress thresholds
    const thresholds: { [key: string]: number } = {
      'initial-review': 25,
      'analysis-complete': 75,
      'decision-made': 100
    };
    
    return thresholds[milestone.id] || 50;
  }

  private async runQualityChecks(task: DelegatedTask): Promise<void> {
    for (const check of task.qualityChecks) {
      if (check.type === 'automatic') {
        // Run automatic quality checks
        check.passed = await this.runAutomaticQualityCheck(task, check);
        check.checkedAt = new Date();
      }
    }
  }

  private async runAutomaticQualityCheck(task: DelegatedTask, check: QualityCheck): Promise<boolean> {
    // Implement automatic quality checks based on criteria
    // This is a simplified implementation
    switch (check.id) {
      case 'completeness':
        return task.outputs && Object.keys(task.outputs).length > 0;
      default:
        return true; // Default to passing
    }
  }

  private increasePriority(priority: DelegatedTask['priority']): DelegatedTask['priority'] {
    const priorityOrder: DelegatedTask['priority'][] = ['low', 'medium', 'high', 'critical'];
    const currentIndex = priorityOrder.indexOf(priority);
    return priorityOrder[Math.min(currentIndex + 1, priorityOrder.length - 1)];
  }

  private addStrategy(strategy: DelegationStrategy): void {
    this.strategies.set(strategy.id, strategy);
  }

  /**
   * Get task by ID
   */
  public getTask(id: string): DelegatedTask | undefined {
    return this.tasks.get(id);
  }

  /**
   * Get tasks by status
   */
  public getTasksByStatus(status: DelegatedTask['status']): DelegatedTask[] {
    return Array.from(this.tasks.values()).filter(task => task.status === status);
  }

  /**
   * Get tasks assigned to operator
   */
  public getTasksForOperator(operatorId: string): DelegatedTask[] {
    return Array.from(this.tasks.values()).filter(task => task.assignedTo === operatorId);
  }

  /**
   * Get operator by ID
   */
  public getOperator(id: string): HumanOperator | undefined {
    return this.operators.get(id);
  }

  /**
   * Get all operators
   */
  public getOperators(): HumanOperator[] {
    return Array.from(this.operators.values());
  }

  /**
   * Cancel a task
   */
  public async cancelTask(taskId: string, reason: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    task.status = 'cancelled';
    task.feedback = `Cancelled: ${reason}`;

    // Update operator workload if assigned
    if (task.assignedTo) {
      const operator = this.operators.get(task.assignedTo);
      if (operator) {
        operator.workload -= this.calculateWorkloadImpact(task);
        operator.workload = Math.max(0, operator.workload);
      }
    }

    await this.swarmMemory.store(`delegation:task:${task.id}`, task);
    this.emit('task:cancelled', { task, reason });
  }

  /**
   * Get delegation analytics
   */
  public getDelegationAnalytics(): any {
    const tasks = Array.from(this.tasks.values());
    const operators = Array.from(this.operators.values());

    return {
      totalTasks: tasks.length,
      tasksByStatus: {
        pending: tasks.filter(t => t.status === 'pending').length,
        assigned: tasks.filter(t => t.status === 'assigned').length,
        in_progress: tasks.filter(t => t.status === 'in_progress').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        failed: tasks.filter(t => t.status === 'failed').length,
        cancelled: tasks.filter(t => t.status === 'cancelled').length
      },
      operatorUtilization: operators.map(op => ({
        id: op.id,
        name: op.name,
        workload: op.workload,
        activeTasks: tasks.filter(t => t.assignedTo === op.id && t.status === 'in_progress').length
      })),
      averageCompletionTime: this.calculateAverageCompletionTime(tasks),
      qualityMetrics: this.calculateQualityMetrics(tasks)
    };
  }

  private calculateAverageCompletionTime(tasks: DelegatedTask[]): number {
    const completedTasks = tasks.filter(t => t.status === 'completed' && t.timeSpent > 0);
    if (completedTasks.length === 0) return 0;
    
    const totalTime = completedTasks.reduce((sum, task) => sum + task.timeSpent, 0);
    return totalTime / completedTasks.length;
  }

  private calculateQualityMetrics(tasks: DelegatedTask[]): any {
    const completedTasks = tasks.filter(t => t.status === 'completed');
    if (completedTasks.length === 0) return { averageQuality: 0, passRate: 0 };

    const tasksWithQualityChecks = completedTasks.filter(t => t.qualityChecks.length > 0);
    const passedTasks = tasksWithQualityChecks.filter(t => 
      t.qualityChecks.every(check => check.passed !== false)
    );

    return {
      averageQuality: tasksWithQualityChecks.length > 0 ? 
        (passedTasks.length / tasksWithQualityChecks.length) * 5 : 0,
      passRate: tasksWithQualityChecks.length > 0 ?
        passedTasks.length / tasksWithQualityChecks.length : 0
    };
  }

  /**
   * Cleanup - stop processing and clear intervals
   */
  public cleanup(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    // Clear any remaining timers
    for (const timer of this.activeTimers.values()) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();
  }
}