/**
 * Base Agent Class
 * Foundation for all specialized worker agents in the swarm
 */

import { EventEmitter } from 'events';
import { AgentInterface, AgentReport, AgentCapability, TaskResult } from '../types';

export interface BaseAgentConfig {
  id: string;
  type: string;
  name: string;
  capabilities: string[];
  votingWeight?: number;
  learningEnabled?: boolean;
}

export interface AgentState {
  status: 'idle' | 'active' | 'busy' | 'error' | 'offline';
  currentTask?: string;
  taskQueue: string[];
  performance: PerformanceMetrics;
  lastActivity: Date;
}

export interface PerformanceMetrics {
  tasksCompleted: number;
  tasksTotal: number;
  successRate: number;
  avgResponseTime: number;
  avgConfidence: number;
  specialtyScores: Map<string, number>;
}

export abstract class BaseAgent extends EventEmitter implements AgentInterface {
  protected config: BaseAgentConfig;
  protected state: AgentState;
  protected capabilities: Map<string, AgentCapability>;
  protected learningHistory: TaskResult[];
  protected queenConnection?: any; // Connection to Queen
  
  constructor(config: BaseAgentConfig) {
    super();
    this.config = config;
    this.state = {
      status: 'idle',
      taskQueue: [],
      performance: {
        tasksCompleted: 0,
        tasksTotal: 0,
        successRate: 0,
        avgResponseTime: 0,
        avgConfidence: 0,
        specialtyScores: new Map()
      },
      lastActivity: new Date()
    };
    
    this.capabilities = new Map();
    this.learningHistory = [];
    
    // Initialize capabilities
    this.initializeCapabilities();
  }

  /**
   * Initialize agent
   */
  async initialize(): Promise<void> {
    // Set up base capabilities
    for (const cap of this.config.capabilities) {
      this.capabilities.set(cap, {
        name: cap,
        proficiency: 0.7, // Default proficiency
        experience: 0
      });
    }
    
    this.state.status = 'active';
    this.emit('agent:initialized', { agentId: this.getId() });
  }

  /**
   * Generate a report on a topic
   */
  async generateReport(topic: string, context: any): Promise<AgentReport> {
    this.state.lastActivity = new Date();
    const startTime = Date.now();
    
    try {
      // Analyze topic relevance to capabilities
      const relevance = this.calculateTopicRelevance(topic, context);
      
      // Generate specialized analysis
      const analysis = await this.performAnalysis(topic, context);
      
      // Calculate confidence based on relevance and expertise
      const confidence = this.calculateConfidence(relevance, analysis);
      
      // Formulate recommendation
      const recommendation = await this.formulateRecommendation(
        topic,
        context,
        analysis
      );
      
      const report: AgentReport = {
        recommendation,
        confidence,
        reasoning: this.generateReasoning(analysis, confidence)
      };
      
      // Update performance metrics
      this.updatePerformanceMetrics(Date.now() - startTime, confidence);
      
      this.emit('agent:report-generated', {
        agentId: this.getId(),
        topic,
        confidence
      });
      
      return report;
    } catch (error) {
      this.handleError(error);
      return {
        recommendation: null,
        confidence: 0,
        reasoning: `Error generating report: ${error}`
      };
    }
  }

  /**
   * Receive response from Queen or other agents
   */
  receiveResponse(response: any): void {
    this.emit('agent:response-received', {
      agentId: this.getId(),
      response
    });
    
    // Handle different response types
    if (response.type === 'task-assignment') {
      this.handleTaskAssignment(response);
    } else if (response.type === 'feedback') {
      this.handleFeedback(response);
    } else if (response.type === 'collaboration-request') {
      this.handleCollaborationRequest(response);
    }
  }

  /**
   * Process a task
   */
  async processTask(taskId: string, task: any): Promise<TaskResult> {
    this.state.status = 'busy';
    this.state.currentTask = taskId;
    const startTime = Date.now();
    
    try {
      // Execute task based on type and agent specialization
      const output = await this.executeTask(task);
      
      const result: TaskResult = {
        taskId,
        agentId: this.getId(),
        status: 'success',
        output,
        metrics: {
          duration: Date.now() - startTime,
          tokensUsed: 0, // Would track actual usage
          accuracy: this.evaluateAccuracy(output, task),
          efficiency: this.evaluateEfficiency(Date.now() - startTime, task)
        }
      };
      
      // Learn from the task if enabled
      if (this.config.learningEnabled) {
        await this.learnFromTask(result);
      }
      
      this.state.status = 'active';
      this.state.currentTask = undefined;
      
      return result;
    } catch (error) {
      this.state.status = 'error';
      return {
        taskId,
        agentId: this.getId(),
        status: 'failure',
        output: { error: error instanceof Error ? error.message : String(error) },
        metrics: {
          duration: Date.now() - startTime,
          tokensUsed: 0
        }
      };
    }
  }

  /**
   * Abstract methods to be implemented by specialized agents
   */
  protected abstract performAnalysis(topic: string, context: any): Promise<any>;
  protected abstract formulateRecommendation(
    topic: string,
    context: any,
    analysis: any
  ): Promise<any>;
  protected abstract executeTask(task: any): Promise<any>;
  protected abstract initializeCapabilities(): void;

  /**
   * Calculate topic relevance to agent capabilities
   */
  protected calculateTopicRelevance(topic: string, context: any): number {
    let relevance = 0;
    let capCount = 0;
    
    // Check how many capabilities are relevant to the topic
    for (const [capName, capability] of this.capabilities) {
      if (this.isCapabilityRelevant(capName, topic, context)) {
        relevance += capability.proficiency;
        capCount++;
      }
    }
    
    return capCount > 0 ? relevance / capCount : 0;
  }

  /**
   * Calculate confidence in the analysis
   */
  protected calculateConfidence(relevance: number, analysis: any): number {
    // Base confidence on relevance and analysis quality
    const baseConfidence = relevance * 0.7;
    
    // Adjust based on experience
    const experienceBonus = Math.min(
      this.state.performance.tasksCompleted / 100,
      0.2
    );
    
    // Adjust based on historical success rate
    const successBonus = this.state.performance.successRate * 0.1;
    
    return Math.min(baseConfidence + experienceBonus + successBonus, 1.0);
  }

  /**
   * Generate reasoning for the report
   */
  protected generateReasoning(analysis: any, confidence: number): string {
    const confidenceLevel = confidence > 0.8 ? 'high' : 
                           confidence > 0.5 ? 'moderate' : 'low';
    
    return `Analysis conducted with ${confidenceLevel} confidence ` +
           `based on ${this.capabilities.size} relevant capabilities. ` +
           `${JSON.stringify(analysis)}`;
  }

  /**
   * Check if capability is relevant to topic
   */
  protected isCapabilityRelevant(
    capability: string,
    topic: string,
    context: any
  ): boolean {
    // Simple keyword matching - could be enhanced with NLP
    const capKeywords = capability.toLowerCase().split('-');
    const topicLower = topic.toLowerCase();
    const contextStr = JSON.stringify(context).toLowerCase();
    
    return capKeywords.some(keyword => 
      topicLower.includes(keyword) || contextStr.includes(keyword)
    );
  }

  /**
   * Update performance metrics
   */
  protected updatePerformanceMetrics(responseTime: number, confidence: number): void {
    const metrics = this.state.performance;
    
    metrics.tasksTotal++;
    metrics.avgResponseTime = 
      (metrics.avgResponseTime * (metrics.tasksTotal - 1) + responseTime) / 
      metrics.tasksTotal;
    
    metrics.avgConfidence = 
      (metrics.avgConfidence * (metrics.tasksTotal - 1) + confidence) / 
      metrics.tasksTotal;
  }

  /**
   * Handle task assignment from Queen
   */
  protected handleTaskAssignment(response: any): void {
    const { taskIds, priority, deadline } = response;
    
    // Add tasks to queue based on priority
    if (priority === 'critical') {
      this.state.taskQueue.unshift(...taskIds);
    } else {
      this.state.taskQueue.push(...taskIds);
    }
    
    this.emit('agent:tasks-assigned', {
      agentId: this.getId(),
      taskCount: taskIds.length,
      priority
    });
    
    // Start processing if idle
    if (this.state.status === 'idle' || this.state.status === 'active') {
      this.processNextTask();
    }
  }

  /**
   * Handle feedback from Queen or task results
   */
  protected handleFeedback(response: any): void {
    const { taskId, success, feedback } = response;
    
    // Update success rate
    if (success !== undefined) {
      const metrics = this.state.performance;
      metrics.tasksCompleted++;
      if (success) {
        metrics.successRate = 
          (metrics.successRate * (metrics.tasksCompleted - 1) + 1) / 
          metrics.tasksCompleted;
      } else {
        metrics.successRate = 
          (metrics.successRate * (metrics.tasksCompleted - 1)) / 
          metrics.tasksCompleted;
      }
    }
    
    // Learn from feedback if enabled
    if (this.config.learningEnabled && feedback) {
      this.learnFromFeedback(feedback);
    }
  }

  /**
   * Handle collaboration request from other agents
   */
  protected handleCollaborationRequest(response: any): void {
    const { requestingAgent, task, urgency } = response;
    
    this.emit('agent:collaboration-requested', {
      agentId: this.getId(),
      requestingAgent,
      task
    });
    
    // Accept or decline based on current workload
    const canCollaborate = this.state.status !== 'busy' && 
                          this.state.taskQueue.length < 5;
    
    this.emit('agent:collaboration-response', {
      agentId: this.getId(),
      requestingAgent,
      accepted: canCollaborate
    });
  }

  /**
   * Process next task in queue
   */
  protected async processNextTask(): Promise<void> {
    if (this.state.taskQueue.length === 0) {
      this.state.status = 'idle';
      return;
    }
    
    const taskId = this.state.taskQueue.shift()!;
    
    // Fetch task details and process
    // This would integrate with the task management system
    this.emit('agent:processing-task', {
      agentId: this.getId(),
      taskId
    });
  }

  /**
   * Learn from completed task
   */
  protected async learnFromTask(result: TaskResult): Promise<void> {
    this.learningHistory.push(result);
    
    // Update capability proficiency based on success
    if (result.status === 'success' && result.metrics.accuracy) {
      // Identify which capabilities were used
      // Update their proficiency scores
      this.emit('agent:learning', {
        agentId: this.getId(),
        taskId: result.taskId,
        improvement: result.metrics.accuracy
      });
    }
  }

  /**
   * Learn from external feedback
   */
  protected learnFromFeedback(feedback: any): void {
    // Process feedback to improve future performance
    this.emit('agent:feedback-processed', {
      agentId: this.getId(),
      feedbackType: feedback.type
    });
  }

  /**
   * Evaluate task output accuracy
   */
  protected evaluateAccuracy(output: any, task: any): number {
    // Base implementation - specialized agents would override
    return 0.8;
  }

  /**
   * Evaluate task efficiency
   */
  protected evaluateEfficiency(duration: number, task: any): number {
    // Base implementation - specialized agents would override
    const expectedDuration = task.estimatedDuration || 60000; // 1 minute default
    return Math.min(expectedDuration / duration, 1.0);
  }

  /**
   * Handle errors
   */
  protected handleError(error: any): void {
    this.state.status = 'error';
    this.emit('agent:error', {
      agentId: this.getId(),
      error: error.message || error,
      timestamp: new Date()
    });
  }

  /**
   * Get agent ID
   */
  getId(): string {
    return this.config.id;
  }

  /**
   * Get agent type
   */
  getType(): string {
    return this.config.type;
  }

  /**
   * Get agent status
   */
  getStatus(): string {
    return this.state.status;
  }

  /**
   * Get performance metrics
   */
  getPerformance(): PerformanceMetrics {
    return { ...this.state.performance };
  }

  /**
   * Get capabilities
   */
  getCapabilities(): string[] {
    return Array.from(this.capabilities.keys());
  }

  /**
   * Set Queen connection
   */
  setQueenConnection(queen: any): void {
    this.queenConnection = queen;
  }
}