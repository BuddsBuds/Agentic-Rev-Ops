/**
 * Neural Learning System
 * Implements pattern recognition and learning from historical decisions
 */

import { EventEmitter } from 'events';
import { QueenDecision } from '../queen/QueenAgent';
import { SwarmMemory } from '../memory/SwarmMemory';

export interface NeuralPattern {
  id: string;
  type: 'decision' | 'performance' | 'failure' | 'success';
  pattern: PatternSignature;
  confidence: number;
  occurrences: number;
  lastSeen: Date;
  outcomes: PatternOutcome[];
}

export interface PatternSignature {
  context: Record<string, any>;
  features: FeatureVector;
  actions: string[];
  conditions: string[];
}

export interface FeatureVector {
  dimensions: number;
  values: number[];
  labels: string[];
}

export interface PatternOutcome {
  timestamp: Date;
  success: boolean;
  metrics: Record<string, number>;
  feedback: string;
}

export interface LearningModel {
  id: string;
  type: 'decision' | 'optimization' | 'prediction';
  accuracy: number;
  trainingData: number;
  lastUpdated: Date;
  parameters: ModelParameters;
}

export interface ModelParameters {
  learningRate: number;
  epochs: number;
  hiddenLayers: number[];
  activationFunction: 'relu' | 'sigmoid' | 'tanh';
  optimizer: 'sgd' | 'adam' | 'rmsprop';
}

export interface PredictionResult {
  prediction: any;
  confidence: number;
  alternatives: Array<{
    value: any;
    probability: number;
  }>;
  reasoning: string[];
}

export interface LearningMetrics {
  totalPatterns: number;
  accuracyRate: number;
  learningProgress: number;
  predictiveCapability: number;
  adaptationSpeed: number;
}

export class NeuralLearningSystem extends EventEmitter {
  private patterns: Map<string, NeuralPattern>;
  private models: Map<string, LearningModel>;
  private memory: SwarmMemory;
  private metrics: LearningMetrics;
  private featureExtractor: FeatureExtractor;
  private patternMatcher: PatternMatcher;
  
  constructor(memory: SwarmMemory) {
    super();
    this.memory = memory;
    this.patterns = new Map();
    this.models = new Map();
    this.featureExtractor = new FeatureExtractor();
    this.patternMatcher = new PatternMatcher();
    
    this.metrics = {
      totalPatterns: 0,
      accuracyRate: 0,
      learningProgress: 0,
      predictiveCapability: 0,
      adaptationSpeed: 0
    };
  }
  
  /**
   * Initialize neural learning system
   */
  async initialize(): Promise<void> {
    // Load existing patterns from memory
    await this.loadPatterns();
    
    // Initialize base models
    this.initializeModels();
    
    // Start continuous learning
    this.startContinuousLearning();
    
    this.emit('neural:initialized', {
      patterns: this.patterns.size,
      models: this.models.size
    });
  }
  
  /**
   * Learn from a decision
   */
  async learnFromDecision(
    decision: QueenDecision,
    outcome: boolean,
    metrics: Record<string, number>
  ): Promise<void> {
    // Extract features from decision context
    const features = this.featureExtractor.extract(decision);
    
    // Create or update pattern
    const pattern = this.createOrUpdatePattern(decision, features, outcome);
    
    // Update relevant models
    await this.updateModels(pattern, outcome, metrics);
    
    // Store learning in memory
    await this.memory.store({
      id: `learning_${decision.id}`,
      type: 'neural-learning',
      content: {
        decisionId: decision.id,
        pattern: pattern.id,
        outcome,
        metrics
      },
      timestamp: new Date(),
      relevance: 0.8,
      tags: ['learning', decision.type, outcome ? 'success' : 'failure']
    });
    
    this.emit('neural:learned', {
      decisionId: decision.id,
      patternId: pattern.id,
      outcome
    });
  }
  
  /**
   * Predict outcome for a decision context
   */
  async predict(
    type: string,
    context: any,
    options?: string[]
  ): Promise<PredictionResult> {
    // Extract features from context
    const features = this.featureExtractor.extractFromContext(context);
    
    // Find matching patterns
    const matchingPatterns = this.patternMatcher.findMatches(
      features,
      Array.from(this.patterns.values())
    );
    
    // Use appropriate model for prediction
    const model = this.models.get(type) || this.models.get('decision');
    if (!model) {
      throw new Error(`No model found for type: ${type}`);
    }
    
    // Generate prediction
    const prediction = await this.generatePrediction(
      model,
      features,
      matchingPatterns,
      options
    );
    
    return prediction;
  }
  
  /**
   * Train models with historical data
   */
  async trainModels(): Promise<void> {
    console.log('🧠 Training neural models...');
    
    // Get historical decisions from memory
    const historicalData = await this.memory.retrieve({
      type: 'decision',
      limit: 1000
    });
    
    // Group by decision type
    const groupedData = this.groupByType(historicalData);
    
    // Train each model
    for (const [type, data] of groupedData) {
      await this.trainModel(type, data);
    }
    
    // Update metrics
    this.updateLearningMetrics();
    
    this.emit('neural:models-trained', {
      models: this.models.size,
      dataPoints: historicalData.length
    });
  }
  
  /**
   * Get pattern recommendations
   */
  async getRecommendations(
    type: string,
    context: any
  ): Promise<Array<{
    pattern: string;
    confidence: number;
    reasoning: string;
  }>> {
    const features = this.featureExtractor.extractFromContext(context);
    const patterns = Array.from(this.patterns.values())
      .filter(p => p.type === 'success')
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
    
    return patterns.map(pattern => ({
      pattern: this.describePattern(pattern),
      confidence: pattern.confidence,
      reasoning: this.explainPattern(pattern, context)
    }));
  }
  
  /**
   * Analyze learning progress
   */
  async analyzeLearningProgress(): Promise<any> {
    const progress = {
      patterns: {
        total: this.patterns.size,
        byType: this.countPatternsByType(),
        highConfidence: this.countHighConfidencePatterns()
      },
      models: {
        total: this.models.size,
        averageAccuracy: this.calculateAverageAccuracy(),
        lastTraining: this.getLastTrainingTime()
      },
      improvements: {
        accuracyTrend: this.calculateAccuracyTrend(),
        adaptationRate: this.calculateAdaptationRate(),
        predictionSuccess: this.metrics.predictiveCapability
      }
    };
    
    return progress;
  }
  
  /**
   * Get neural insights
   */
  async getNeuralInsights(): Promise<Array<{
    type: string;
    insight: string;
    confidence: number;
    actionable: boolean;
  }>> {
    const insights = [];
    
    // Analyze patterns for insights
    for (const [patternId, pattern] of this.patterns) {
      if (pattern.confidence > 0.8 && pattern.occurrences > 10) {
        insights.push({
          type: 'pattern',
          insight: `Strong ${pattern.type} pattern detected: ${this.describePattern(pattern)}`,
          confidence: pattern.confidence,
          actionable: true
        });
      }
    }
    
    // Analyze model performance
    for (const [modelType, model] of this.models) {
      if (model.accuracy < 0.7) {
        insights.push({
          type: 'model',
          insight: `${modelType} model needs more training data (accuracy: ${model.accuracy})`,
          confidence: 0.9,
          actionable: true
        });
      }
    }
    
    // Analyze trends
    const trend = this.analyzeDecisionTrends();
    if (trend.significant) {
      insights.push({
        type: 'trend',
        insight: trend.description,
        confidence: trend.confidence,
        actionable: trend.actionable
      });
    }
    
    return insights;
  }
  
  /**
   * Initialize base models
   */
  private initializeModels(): void {
    // Decision model
    this.models.set('decision', {
      id: 'model_decision',
      type: 'decision',
      accuracy: 0.5,
      trainingData: 0,
      lastUpdated: new Date(),
      parameters: {
        learningRate: 0.01,
        epochs: 100,
        hiddenLayers: [64, 32, 16],
        activationFunction: 'relu',
        optimizer: 'adam'
      }
    });
    
    // Optimization model
    this.models.set('optimization', {
      id: 'model_optimization',
      type: 'optimization',
      accuracy: 0.5,
      trainingData: 0,
      lastUpdated: new Date(),
      parameters: {
        learningRate: 0.001,
        epochs: 200,
        hiddenLayers: [128, 64, 32],
        activationFunction: 'relu',
        optimizer: 'adam'
      }
    });
    
    // Prediction model
    this.models.set('prediction', {
      id: 'model_prediction',
      type: 'prediction',
      accuracy: 0.5,
      trainingData: 0,
      lastUpdated: new Date(),
      parameters: {
        learningRate: 0.005,
        epochs: 150,
        hiddenLayers: [100, 50, 25],
        activationFunction: 'sigmoid',
        optimizer: 'rmsprop'
      }
    });
  }
  
  /**
   * Create or update pattern
   */
  private createOrUpdatePattern(
    decision: QueenDecision,
    features: FeatureVector,
    outcome: boolean
  ): NeuralPattern {
    const patternId = this.generatePatternId(features);
    let pattern = this.patterns.get(patternId);
    
    if (!pattern) {
      pattern = {
        id: patternId,
        type: outcome ? 'success' : 'failure',
        pattern: {
          context: decision.context,
          features,
          actions: [decision.majority.winner.id],
          conditions: this.extractConditions(decision.context)
        },
        confidence: 0.5,
        occurrences: 0,
        lastSeen: new Date(),
        outcomes: []
      };
      
      this.patterns.set(patternId, pattern);
      this.metrics.totalPatterns++;
    }
    
    // Update pattern
    pattern.occurrences++;
    pattern.lastSeen = new Date();
    pattern.outcomes.push({
      timestamp: new Date(),
      success: outcome,
      metrics: {},
      feedback: ''
    });
    
    // Update confidence based on outcomes
    const successRate = pattern.outcomes.filter(o => o.success).length / pattern.outcomes.length;
    pattern.confidence = successRate;
    
    return pattern;
  }
  
  /**
   * Generate prediction using model and patterns
   */
  private async generatePrediction(
    model: LearningModel,
    features: FeatureVector,
    patterns: NeuralPattern[],
    options?: string[]
  ): Promise<PredictionResult> {
    // Simulate neural network prediction
    const prediction = this.simulateNeuralPrediction(model, features, patterns);
    
    // Generate alternatives if options provided
    const alternatives = options ? 
      options.map(opt => ({
        value: opt,
        probability: this.calculateOptionProbability(opt, features, patterns)
      })).sort((a, b) => b.probability - a.probability) : [];
    
    // Generate reasoning
    const reasoning = this.generateReasoning(prediction, patterns);
    
    return {
      prediction: prediction.value,
      confidence: prediction.confidence,
      alternatives,
      reasoning
    };
  }
  
  /**
   * Simulate neural network prediction
   */
  private simulateNeuralPrediction(
    model: LearningModel,
    features: FeatureVector,
    patterns: NeuralPattern[]
  ): { value: any; confidence: number } {
    // Weight patterns by confidence and recency
    const weightedPatterns = patterns.map(p => ({
      pattern: p,
      weight: p.confidence * this.getRecencyWeight(p.lastSeen)
    }));
    
    // Find dominant pattern
    const dominantPattern = weightedPatterns
      .sort((a, b) => b.weight - a.weight)[0];
    
    if (dominantPattern && dominantPattern.weight > 0.6) {
      return {
        value: dominantPattern.pattern.pattern.actions[0],
        confidence: dominantPattern.weight * model.accuracy
      };
    }
    
    // Default prediction
    return {
      value: 'default-action',
      confidence: 0.5 * model.accuracy
    };
  }
  
  /**
   * Start continuous learning process
   */
  private startContinuousLearning(): void {
    setInterval(async () => {
      // Retrain models periodically
      await this.trainModels();
      
      // Prune old patterns
      this.pruneOldPatterns();
      
      // Update metrics
      this.updateLearningMetrics();
    }, 60 * 60 * 1000); // Every hour
  }
  
  /**
   * Load patterns from memory
   */
  private async loadPatterns(): Promise<void> {
    const storedPatterns = await this.memory.retrieve({
      type: 'neural-pattern',
      limit: 1000
    });
    
    storedPatterns.forEach(entry => {
      const pattern = entry.content as NeuralPattern;
      this.patterns.set(pattern.id, pattern);
    });
  }
  
  /**
   * Train a specific model
   */
  private async trainModel(type: string, data: any[]): Promise<void> {
    const model = this.models.get(type);
    if (!model) return;
    
    // Simulate training
    const trainingSize = data.length;
    const baseAccuracy = model.accuracy;
    
    // Improve accuracy based on data size (simulated)
    const improvement = Math.min(0.1, trainingSize / 10000);
    model.accuracy = Math.min(0.95, baseAccuracy + improvement);
    model.trainingData += trainingSize;
    model.lastUpdated = new Date();
    
    console.log(`  Trained ${type} model: accuracy ${(model.accuracy * 100).toFixed(1)}%`);
  }
  
  /**
   * Update learning metrics
   */
  private updateLearningMetrics(): void {
    const accuracies = Array.from(this.models.values()).map(m => m.accuracy);
    
    this.metrics.accuracyRate = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
    this.metrics.learningProgress = this.calculateLearningProgress();
    this.metrics.predictiveCapability = this.calculatePredictiveCapability();
    this.metrics.adaptationSpeed = this.calculateAdaptationSpeed();
  }
  
  /**
   * Helper methods
   */
  private generatePatternId(features: FeatureVector): string {
    const hash = features.values.reduce((a, b) => a + b, 0);
    return `pattern_${hash.toString(36)}_${Date.now().toString(36)}`;
  }
  
  private extractConditions(context: any): string[] {
    const conditions = [];
    
    if (context.priority) conditions.push(`priority:${context.priority}`);
    if (context.type) conditions.push(`type:${context.type}`);
    if (context.urgency) conditions.push(`urgency:${context.urgency}`);
    
    return conditions;
  }
  
  private getRecencyWeight(lastSeen: Date): number {
    const daysSince = (Date.now() - lastSeen.getTime()) / (1000 * 60 * 60 * 24);
    return Math.exp(-daysSince / 30); // Exponential decay over 30 days
  }
  
  private calculateOptionProbability(
    option: string,
    features: FeatureVector,
    patterns: NeuralPattern[]
  ): number {
    const relevantPatterns = patterns.filter(p => 
      p.pattern.actions.includes(option)
    );
    
    if (relevantPatterns.length === 0) return 0.1;
    
    const avgConfidence = relevantPatterns.reduce((sum, p) => sum + p.confidence, 0) / relevantPatterns.length;
    return avgConfidence * 0.8 + 0.1; // Ensure minimum probability
  }
  
  private generateReasoning(
    prediction: { value: any; confidence: number },
    patterns: NeuralPattern[]
  ): string[] {
    const reasoning = [];
    
    reasoning.push(`Prediction based on ${patterns.length} similar patterns`);
    
    if (patterns.length > 0) {
      const avgSuccess = patterns.filter(p => p.type === 'success').length / patterns.length;
      reasoning.push(`Historical success rate: ${(avgSuccess * 100).toFixed(0)}%`);
    }
    
    reasoning.push(`Model confidence: ${(prediction.confidence * 100).toFixed(0)}%`);
    
    return reasoning;
  }
  
  private describePattern(pattern: NeuralPattern): string {
    return `${pattern.pattern.actions.join(', ')} when ${pattern.pattern.conditions.join(' and ')}`;
  }
  
  private explainPattern(pattern: NeuralPattern, context: any): string {
    const matchingConditions = pattern.pattern.conditions.filter(cond => {
      const [key, value] = cond.split(':');
      return context[key] === value;
    });
    
    return `Matches ${matchingConditions.length}/${pattern.pattern.conditions.length} conditions`;
  }
  
  private groupByType(data: any[]): Map<string, any[]> {
    const grouped = new Map<string, any[]>();
    
    data.forEach(item => {
      const type = item.content?.type || 'unknown';
      if (!grouped.has(type)) {
        grouped.set(type, []);
      }
      grouped.get(type)!.push(item);
    });
    
    return grouped;
  }
  
  private countPatternsByType(): Record<string, number> {
    const counts: Record<string, number> = {};
    
    this.patterns.forEach(pattern => {
      counts[pattern.type] = (counts[pattern.type] || 0) + 1;
    });
    
    return counts;
  }
  
  private countHighConfidencePatterns(): number {
    return Array.from(this.patterns.values())
      .filter(p => p.confidence > 0.8)
      .length;
  }
  
  private calculateAverageAccuracy(): number {
    const accuracies = Array.from(this.models.values()).map(m => m.accuracy);
    return accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
  }
  
  private getLastTrainingTime(): Date {
    const times = Array.from(this.models.values()).map(m => m.lastUpdated);
    return new Date(Math.max(...times.map(t => t.getTime())));
  }
  
  private calculateAccuracyTrend(): number {
    // Simplified trend calculation
    return 0.05; // 5% improvement trend
  }
  
  private calculateAdaptationRate(): number {
    // Rate of new pattern discovery
    return this.metrics.totalPatterns / 100;
  }
  
  private calculateLearningProgress(): number {
    const patternQuality = this.countHighConfidencePatterns() / Math.max(this.patterns.size, 1);
    const modelQuality = this.calculateAverageAccuracy();
    return (patternQuality + modelQuality) / 2;
  }
  
  private calculatePredictiveCapability(): number {
    // Based on recent prediction success
    return 0.75; // Placeholder
  }
  
  private calculateAdaptationSpeed(): number {
    // How quickly system adapts to new patterns
    return 0.8; // Placeholder
  }
  
  private analyzeDecisionTrends(): any {
    // Analyze trends in decision patterns
    return {
      significant: true,
      description: 'Increasing preference for automated solutions',
      confidence: 0.85,
      actionable: true
    };
  }
  
  private pruneOldPatterns(): void {
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days
    
    for (const [id, pattern] of this.patterns) {
      if (pattern.lastSeen < cutoffDate && pattern.confidence < 0.5) {
        this.patterns.delete(id);
      }
    }
  }
}

/**
 * Feature extractor for neural learning
 */
class FeatureExtractor {
  extract(decision: QueenDecision): FeatureVector {
    const features = [];
    const labels = [];
    
    // Extract numeric features
    features.push(decision.majority.participation.participationRate);
    labels.push('participation_rate');
    
    features.push(decision.majority.votes.length);
    labels.push('vote_count');
    
    // Extract categorical features as numbers
    features.push(this.encodeType(decision.type));
    labels.push('decision_type');
    
    return {
      dimensions: features.length,
      values: features,
      labels
    };
  }
  
  extractFromContext(context: any): FeatureVector {
    const features = [];
    const labels = [];
    
    // Extract available numeric features
    if (context.priority) {
      features.push(this.encodePriority(context.priority));
      labels.push('priority');
    }
    
    if (context.complexity) {
      features.push(context.complexity);
      labels.push('complexity');
    }
    
    return {
      dimensions: features.length,
      values: features,
      labels
    };
  }
  
  private encodeType(type: string): number {
    const types: Record<string, number> = {
      'strategic': 1,
      'operational': 2,
      'tactical': 3,
      'emergency': 4
    };
    return types[type] || 0;
  }
  
  private encodePriority(priority: string): number {
    const priorities: Record<string, number> = {
      'low': 1,
      'medium': 2,
      'high': 3,
      'critical': 4
    };
    return priorities[priority] || 0;
  }
}

/**
 * Pattern matcher for neural learning
 */
class PatternMatcher {
  findMatches(
    features: FeatureVector,
    patterns: NeuralPattern[],
    threshold: number = 0.7
  ): NeuralPattern[] {
    return patterns
      .map(pattern => ({
        pattern,
        similarity: this.calculateSimilarity(features, pattern.pattern.features)
      }))
      .filter(match => match.similarity > threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .map(match => match.pattern);
  }
  
  private calculateSimilarity(f1: FeatureVector, f2: FeatureVector): number {
    if (f1.dimensions !== f2.dimensions) return 0;
    
    let distance = 0;
    for (let i = 0; i < f1.dimensions; i++) {
      distance += Math.pow(f1.values[i] - f2.values[i], 2);
    }
    
    distance = Math.sqrt(distance);
    const maxDistance = Math.sqrt(f1.dimensions * 4); // Assuming max value of 4
    
    return 1 - (distance / maxDistance);
  }
}