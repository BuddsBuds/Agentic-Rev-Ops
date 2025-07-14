// Performance Monitoring and Optimization for Workflow Engine
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface PerformanceMetrics {
  executionTime: number;
  cpuUsage: number;
  memoryUsage: number;
  throughput: number;
  latency: number;
  errorRate: number;
  successRate: number;
  concurrency: number;
  queueDepth: number;
  timestamp: Date;
}

export interface WorkflowMetrics {
  workflowId: string;
  name: string;
  executions: number;
  averageExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  p95ExecutionTime: number;
  p99ExecutionTime: number;
  successRate: number;
  errorRate: number;
  throughput: number;
  stepMetrics: Map<string, StepMetrics>;
  lastUpdated: Date;
}

export interface StepMetrics {
  stepId: string;
  name: string;
  executions: number;
  averageExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  successRate: number;
  errorRate: number;
  retryRate: number;
  timeoutRate: number;
  resourceUsage: ResourceMetrics;
}

export interface ResourceMetrics {
  avgCpuUsage: number;
  maxCpuUsage: number;
  avgMemoryUsage: number;
  maxMemoryUsage: number;
  ioOperations: number;
  networkCalls: number;
}

export interface OptimizationSuggestion {
  id: string;
  type: OptimizationType;
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  impact: string;
  recommendations: string[];
  estimatedImprovement: number; // percentage
  targetMetric: string;
  relatedWorkflows?: string[];
  relatedSteps?: string[];
}

export enum OptimizationType {
  PARALLEL_EXECUTION = 'parallel_execution',
  CACHING = 'caching',
  BATCH_PROCESSING = 'batch_processing',
  RESOURCE_POOLING = 'resource_pooling',
  TIMEOUT_ADJUSTMENT = 'timeout_adjustment',
  RETRY_OPTIMIZATION = 'retry_optimization',
  STEP_ELIMINATION = 'step_elimination',
  STEP_REORDERING = 'step_reordering',
  LOAD_BALANCING = 'load_balancing',
  CIRCUIT_BREAKER = 'circuit_breaker'
}

export interface BottleneckAnalysis {
  id: string;
  timestamp: Date;
  bottlenecks: Bottleneck[];
  overallImpact: number;
  recommendations: OptimizationSuggestion[];
}

export interface Bottleneck {
  type: 'step' | 'resource' | 'dependency' | 'external';
  identifier: string;
  description: string;
  impactScore: number; // 0-100
  frequency: number;
  averageDelay: number;
  affectedWorkflows: string[];
}

export interface PerformanceAlert {
  id: string;
  type: AlertType;
  severity: 'info' | 'warning' | 'error' | 'critical';
  metric: string;
  threshold: number;
  actualValue: number;
  message: string;
  timestamp: Date;
  workflowId?: string;
  stepId?: string;
  resolved: boolean;
}

export enum AlertType {
  SLOW_EXECUTION = 'slow_execution',
  HIGH_ERROR_RATE = 'high_error_rate',
  RESOURCE_EXHAUSTION = 'resource_exhaustion',
  QUEUE_BACKUP = 'queue_backup',
  SLA_BREACH = 'sla_breach',
  DEGRADED_PERFORMANCE = 'degraded_performance'
}

export interface PerformanceTrend {
  metric: string;
  timeRange: 'hour' | 'day' | 'week' | 'month';
  dataPoints: TrendDataPoint[];
  trend: 'improving' | 'stable' | 'degrading';
  changePercentage: number;
  forecast?: TrendForecast;
}

export interface TrendDataPoint {
  timestamp: Date;
  value: number;
  anomaly?: boolean;
}

export interface TrendForecast {
  nextPeriod: number;
  confidence: number;
  upperBound: number;
  lowerBound: number;
}

export interface CacheStrategy {
  type: 'memory' | 'redis' | 'disk';
  ttl: number;
  maxSize: number;
  evictionPolicy: 'lru' | 'lfu' | 'fifo';
  keyPattern: string;
}

export interface LoadBalancingStrategy {
  type: 'round-robin' | 'least-connections' | 'weighted' | 'adaptive';
  healthCheckInterval: number;
  failoverTimeout: number;
  maxRetries: number;
}

export class PerformanceOptimizer extends EventEmitter {
  private metrics: Map<string, PerformanceMetrics[]> = new Map();
  private workflowMetrics: Map<string, WorkflowMetrics> = new Map();
  private alerts: Map<string, PerformanceAlert> = new Map();
  private optimizations: Map<string, OptimizationSuggestion> = new Map();
  private metricsRetentionDays: number = 7;
  private samplingInterval: number = 1000; // 1 second
  private analysisInterval: number = 60000; // 1 minute
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;
  private analysisTimeout?: NodeJS.Timeout;

  constructor() {
    super();
    this.setupDefaultThresholds();
  }

  private thresholds = {
    executionTime: {
      warning: 5000, // 5 seconds
      critical: 30000 // 30 seconds
    },
    errorRate: {
      warning: 0.05, // 5%
      critical: 0.1 // 10%
    },
    cpuUsage: {
      warning: 0.7, // 70%
      critical: 0.9 // 90%
    },
    memoryUsage: {
      warning: 0.8, // 80%
      critical: 0.95 // 95%
    },
    queueDepth: {
      warning: 100,
      critical: 500
    }
  };

  private setupDefaultThresholds(): void {
    // Thresholds are defined above
  }

  // Monitoring Methods

  public startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    
    // Start metrics collection
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, this.samplingInterval);

    // Start analysis
    this.analysisTimeout = setInterval(() => {
      this.analyzePerformance();
    }, this.analysisInterval);

    this.emit('monitoring:started');
  }

  public stopMonitoring(): void {
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    if (this.analysisTimeout) {
      clearInterval(this.analysisTimeout);
      this.analysisTimeout = undefined;
    }

    this.emit('monitoring:stopped');
  }

  private collectMetrics(): void {
    const metrics: PerformanceMetrics = {
      executionTime: 0, // Would be collected from actual executions
      cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
      memoryUsage: process.memoryUsage().heapUsed,
      throughput: this.calculateThroughput(),
      latency: this.calculateLatency(),
      errorRate: this.calculateErrorRate(),
      successRate: this.calculateSuccessRate(),
      concurrency: this.getCurrentConcurrency(),
      queueDepth: this.getQueueDepth(),
      timestamp: new Date()
    };

    // Store metrics
    const key = 'system';
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    this.metrics.get(key)!.push(metrics);

    // Check thresholds
    this.checkThresholds(metrics);

    // Cleanup old metrics
    this.cleanupOldMetrics();
  }

  // Recording Methods

  public recordWorkflowExecution(
    workflowId: string,
    workflowName: string,
    executionTime: number,
    success: boolean,
    stepExecutions?: Map<string, StepExecutionData>
  ): void {
    // Update workflow metrics
    let metrics = this.workflowMetrics.get(workflowId);
    if (!metrics) {
      metrics = {
        workflowId,
        name: workflowName,
        executions: 0,
        averageExecutionTime: 0,
        minExecutionTime: Infinity,
        maxExecutionTime: 0,
        p95ExecutionTime: 0,
        p99ExecutionTime: 0,
        successRate: 0,
        errorRate: 0,
        throughput: 0,
        stepMetrics: new Map(),
        lastUpdated: new Date()
      };
      this.workflowMetrics.set(workflowId, metrics);
    }

    // Update execution statistics
    metrics.executions++;
    metrics.averageExecutionTime = 
      ((metrics.averageExecutionTime * (metrics.executions - 1)) + executionTime) / 
      metrics.executions;
    metrics.minExecutionTime = Math.min(metrics.minExecutionTime, executionTime);
    metrics.maxExecutionTime = Math.max(metrics.maxExecutionTime, executionTime);
    
    // Update success/error rates
    const successCount = Math.round(metrics.successRate * (metrics.executions - 1));
    metrics.successRate = (successCount + (success ? 1 : 0)) / metrics.executions;
    metrics.errorRate = 1 - metrics.successRate;

    // Update step metrics if provided
    if (stepExecutions) {
      for (const [stepId, stepData] of stepExecutions.entries()) {
        this.updateStepMetrics(metrics, stepId, stepData);
      }
    }

    metrics.lastUpdated = new Date();

    // Check for performance issues
    this.detectPerformanceIssues(metrics);
  }

  private updateStepMetrics(
    workflowMetrics: WorkflowMetrics,
    stepId: string,
    stepData: StepExecutionData
  ): void {
    let stepMetrics = workflowMetrics.stepMetrics.get(stepId);
    if (!stepMetrics) {
      stepMetrics = {
        stepId,
        name: stepData.name,
        executions: 0,
        averageExecutionTime: 0,
        minExecutionTime: Infinity,
        maxExecutionTime: 0,
        successRate: 0,
        errorRate: 0,
        retryRate: 0,
        timeoutRate: 0,
        resourceUsage: {
          avgCpuUsage: 0,
          maxCpuUsage: 0,
          avgMemoryUsage: 0,
          maxMemoryUsage: 0,
          ioOperations: 0,
          networkCalls: 0
        }
      };
      workflowMetrics.stepMetrics.set(stepId, stepMetrics);
    }

    stepMetrics.executions++;
    stepMetrics.averageExecutionTime = 
      ((stepMetrics.averageExecutionTime * (stepMetrics.executions - 1)) + 
       stepData.executionTime) / stepMetrics.executions;
    stepMetrics.minExecutionTime = Math.min(stepMetrics.minExecutionTime, stepData.executionTime);
    stepMetrics.maxExecutionTime = Math.max(stepMetrics.maxExecutionTime, stepData.executionTime);

    // Update rates
    const successCount = Math.round(stepMetrics.successRate * (stepMetrics.executions - 1));
    stepMetrics.successRate = (successCount + (stepData.success ? 1 : 0)) / stepMetrics.executions;
    stepMetrics.errorRate = 1 - stepMetrics.successRate;

    if (stepData.retried) {
      const retryCount = Math.round(stepMetrics.retryRate * (stepMetrics.executions - 1));
      stepMetrics.retryRate = (retryCount + 1) / stepMetrics.executions;
    }

    if (stepData.timedOut) {
      const timeoutCount = Math.round(stepMetrics.timeoutRate * (stepMetrics.executions - 1));
      stepMetrics.timeoutRate = (timeoutCount + 1) / stepMetrics.executions;
    }
  }

  // Analysis Methods

  private analyzePerformance(): void {
    const analysis: BottleneckAnalysis = {
      id: uuidv4(),
      timestamp: new Date(),
      bottlenecks: [],
      overallImpact: 0,
      recommendations: []
    };

    // Analyze workflow performance
    for (const [workflowId, metrics] of this.workflowMetrics.entries()) {
      const bottlenecks = this.identifyBottlenecks(workflowId, metrics);
      analysis.bottlenecks.push(...bottlenecks);
    }

    // Sort bottlenecks by impact
    analysis.bottlenecks.sort((a, b) => b.impactScore - a.impactScore);

    // Calculate overall impact
    analysis.overallImpact = analysis.bottlenecks.reduce(
      (sum, b) => sum + b.impactScore, 0
    ) / analysis.bottlenecks.length || 0;

    // Generate optimization suggestions
    analysis.recommendations = this.generateOptimizationSuggestions(analysis.bottlenecks);

    // Store and emit analysis
    if (analysis.bottlenecks.length > 0) {
      this.emit('analysis:complete', analysis);
    }

    // Auto-optimize if enabled
    this.applyAutoOptimizations(analysis);
  }

  private identifyBottlenecks(
    workflowId: string,
    metrics: WorkflowMetrics
  ): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    // Check for slow steps
    for (const [stepId, stepMetrics] of metrics.stepMetrics.entries()) {
      if (stepMetrics.averageExecutionTime > this.thresholds.executionTime.warning) {
        bottlenecks.push({
          type: 'step',
          identifier: stepId,
          description: `Step ${stepMetrics.name} is slow`,
          impactScore: this.calculateImpactScore(
            stepMetrics.averageExecutionTime,
            stepMetrics.executions,
            metrics.executions
          ),
          frequency: stepMetrics.executions,
          averageDelay: stepMetrics.averageExecutionTime,
          affectedWorkflows: [workflowId]
        });
      }

      // Check for high error rates
      if (stepMetrics.errorRate > this.thresholds.errorRate.warning) {
        bottlenecks.push({
          type: 'step',
          identifier: stepId,
          description: `Step ${stepMetrics.name} has high error rate`,
          impactScore: stepMetrics.errorRate * 100,
          frequency: stepMetrics.executions * stepMetrics.errorRate,
          averageDelay: 0,
          affectedWorkflows: [workflowId]
        });
      }

      // Check for high retry rates
      if (stepMetrics.retryRate > 0.2) { // 20% retry rate
        bottlenecks.push({
          type: 'step',
          identifier: stepId,
          description: `Step ${stepMetrics.name} requires frequent retries`,
          impactScore: stepMetrics.retryRate * 50,
          frequency: stepMetrics.executions * stepMetrics.retryRate,
          averageDelay: stepMetrics.averageExecutionTime * stepMetrics.retryRate,
          affectedWorkflows: [workflowId]
        });
      }
    }

    // Check for resource bottlenecks
    const systemMetrics = this.metrics.get('system') || [];
    const recentMetrics = systemMetrics.slice(-10); // Last 10 samples

    for (const metric of recentMetrics) {
      if (metric.cpuUsage > this.thresholds.cpuUsage.warning) {
        bottlenecks.push({
          type: 'resource',
          identifier: 'cpu',
          description: 'High CPU usage detected',
          impactScore: metric.cpuUsage * 100,
          frequency: 1,
          averageDelay: 0,
          affectedWorkflows: [workflowId]
        });
      }

      if (metric.memoryUsage > this.thresholds.memoryUsage.warning * process.memoryUsage().heapTotal) {
        bottlenecks.push({
          type: 'resource',
          identifier: 'memory',
          description: 'High memory usage detected',
          impactScore: (metric.memoryUsage / process.memoryUsage().heapTotal) * 100,
          frequency: 1,
          averageDelay: 0,
          affectedWorkflows: [workflowId]
        });
      }
    }

    return bottlenecks;
  }

  private calculateImpactScore(
    executionTime: number,
    stepExecutions: number,
    totalExecutions: number
  ): number {
    const timeImpact = Math.min(executionTime / this.thresholds.executionTime.critical, 1);
    const frequencyImpact = stepExecutions / totalExecutions;
    return (timeImpact * 0.7 + frequencyImpact * 0.3) * 100;
  }

  private generateOptimizationSuggestions(bottlenecks: Bottleneck[]): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Group bottlenecks by type
    const stepBottlenecks = bottlenecks.filter(b => b.type === 'step');
    const resourceBottlenecks = bottlenecks.filter(b => b.type === 'resource');

    // Analyze step bottlenecks
    if (stepBottlenecks.length > 1) {
      // Check for parallelization opportunities
      const sequentialSteps = this.identifySequentialSteps(stepBottlenecks);
      if (sequentialSteps.length > 2) {
        suggestions.push({
          id: uuidv4(),
          type: OptimizationType.PARALLEL_EXECUTION,
          severity: 'high',
          title: 'Parallelize Independent Steps',
          description: `${sequentialSteps.length} steps can be executed in parallel`,
          impact: 'Reduce workflow execution time by up to 60%',
          recommendations: [
            'Identify independent steps that don\'t share dependencies',
            'Use parallel step execution configuration',
            'Monitor resource usage during parallel execution'
          ],
          estimatedImprovement: 60,
          targetMetric: 'executionTime',
          relatedSteps: sequentialSteps.map(b => b.identifier)
        });
      }
    }

    // Check for caching opportunities
    const repeatableSteps = stepBottlenecks.filter(b => b.frequency > 10);
    if (repeatableSteps.length > 0) {
      suggestions.push({
        id: uuidv4(),
        type: OptimizationType.CACHING,
        severity: 'medium',
        title: 'Implement Result Caching',
        description: 'Cache results for frequently executed steps',
        impact: 'Reduce redundant computations and API calls',
        recommendations: [
          'Identify deterministic steps with stable inputs',
          'Implement TTL-based caching strategy',
          'Monitor cache hit rates'
        ],
        estimatedImprovement: 40,
        targetMetric: 'executionTime',
        relatedSteps: repeatableSteps.map(b => b.identifier)
      });
    }

    // Resource optimization suggestions
    const cpuBottleneck = resourceBottlenecks.find(b => b.identifier === 'cpu');
    if (cpuBottleneck) {
      suggestions.push({
        id: uuidv4(),
        type: OptimizationType.LOAD_BALANCING,
        severity: 'high',
        title: 'Implement Load Balancing',
        description: 'Distribute workload across multiple workers',
        impact: 'Reduce CPU bottlenecks and improve throughput',
        recommendations: [
          'Deploy multiple worker instances',
          'Implement work queue with fair distribution',
          'Use CPU-aware scheduling'
        ],
        estimatedImprovement: 50,
        targetMetric: 'cpuUsage'
      });
    }

    // High error rate optimization
    const errorProneSteps = stepBottlenecks.filter(b => 
      b.description.includes('error rate')
    );
    if (errorProneSteps.length > 0) {
      suggestions.push({
        id: uuidv4(),
        type: OptimizationType.CIRCUIT_BREAKER,
        severity: 'high',
        title: 'Implement Circuit Breakers',
        description: 'Prevent cascading failures from error-prone steps',
        impact: 'Improve system stability and reduce error propagation',
        recommendations: [
          'Add circuit breakers to failing integrations',
          'Implement fallback mechanisms',
          'Set appropriate failure thresholds'
        ],
        estimatedImprovement: 30,
        targetMetric: 'errorRate',
        relatedSteps: errorProneSteps.map(b => b.identifier)
      });
    }

    return suggestions;
  }

  private identifySequentialSteps(bottlenecks: Bottleneck[]): string[] {
    // Simplified implementation - would need workflow structure analysis
    return bottlenecks
      .filter(b => b.averageDelay > 1000)
      .map(b => b.identifier);
  }

  // Auto-optimization Methods

  private applyAutoOptimizations(analysis: BottleneckAnalysis): void {
    for (const suggestion of analysis.recommendations) {
      if (suggestion.severity === 'high' && suggestion.estimatedImprovement > 30) {
        this.applyOptimization(suggestion);
      }
    }
  }

  private applyOptimization(suggestion: OptimizationSuggestion): void {
    switch (suggestion.type) {
      case OptimizationType.TIMEOUT_ADJUSTMENT:
        this.adjustTimeouts(suggestion);
        break;
      
      case OptimizationType.RETRY_OPTIMIZATION:
        this.optimizeRetries(suggestion);
        break;
      
      default:
        // Other optimizations require manual intervention
        this.emit('optimization:suggested', suggestion);
    }
  }

  private adjustTimeouts(suggestion: OptimizationSuggestion): void {
    // Auto-adjust timeouts based on p95 execution times
    this.emit('optimization:applied', {
      type: 'timeout_adjustment',
      suggestion
    });
  }

  private optimizeRetries(suggestion: OptimizationSuggestion): void {
    // Optimize retry policies based on error patterns
    this.emit('optimization:applied', {
      type: 'retry_optimization',
      suggestion
    });
  }

  // Alert Management

  private checkThresholds(metrics: PerformanceMetrics): void {
    // Check execution time
    if (metrics.executionTime > this.thresholds.executionTime.critical) {
      this.createAlert(
        AlertType.SLOW_EXECUTION,
        'critical',
        'executionTime',
        this.thresholds.executionTime.critical,
        metrics.executionTime,
        'Critical: Execution time exceeds threshold'
      );
    } else if (metrics.executionTime > this.thresholds.executionTime.warning) {
      this.createAlert(
        AlertType.SLOW_EXECUTION,
        'warning',
        'executionTime',
        this.thresholds.executionTime.warning,
        metrics.executionTime,
        'Warning: Execution time is high'
      );
    }

    // Check error rate
    if (metrics.errorRate > this.thresholds.errorRate.critical) {
      this.createAlert(
        AlertType.HIGH_ERROR_RATE,
        'critical',
        'errorRate',
        this.thresholds.errorRate.critical,
        metrics.errorRate,
        'Critical: Error rate exceeds threshold'
      );
    }

    // Check resource usage
    if (metrics.cpuUsage > this.thresholds.cpuUsage.critical) {
      this.createAlert(
        AlertType.RESOURCE_EXHAUSTION,
        'critical',
        'cpuUsage',
        this.thresholds.cpuUsage.critical,
        metrics.cpuUsage,
        'Critical: CPU usage is too high'
      );
    }

    // Check queue depth
    if (metrics.queueDepth > this.thresholds.queueDepth.critical) {
      this.createAlert(
        AlertType.QUEUE_BACKUP,
        'critical',
        'queueDepth',
        this.thresholds.queueDepth.critical,
        metrics.queueDepth,
        'Critical: Queue is backing up'
      );
    }
  }

  private createAlert(
    type: AlertType,
    severity: PerformanceAlert['severity'],
    metric: string,
    threshold: number,
    actualValue: number,
    message: string,
    workflowId?: string,
    stepId?: string
  ): void {
    const alert: PerformanceAlert = {
      id: uuidv4(),
      type,
      severity,
      metric,
      threshold,
      actualValue,
      message,
      timestamp: new Date(),
      workflowId,
      stepId,
      resolved: false
    };

    this.alerts.set(alert.id, alert);
    this.emit('alert:created', alert);

    // Auto-resolve alerts after conditions improve
    setTimeout(() => {
      this.checkAlertResolution(alert);
    }, 60000); // Check after 1 minute
  }

  private checkAlertResolution(alert: PerformanceAlert): void {
    // Check if condition has improved
    const currentMetrics = this.metrics.get('system')?.slice(-1)[0];
    if (!currentMetrics) return;

    let resolved = false;
    switch (alert.metric) {
      case 'executionTime':
        resolved = currentMetrics.executionTime < alert.threshold;
        break;
      case 'errorRate':
        resolved = currentMetrics.errorRate < alert.threshold;
        break;
      case 'cpuUsage':
        resolved = currentMetrics.cpuUsage < alert.threshold;
        break;
      case 'queueDepth':
        resolved = currentMetrics.queueDepth < alert.threshold;
        break;
    }

    if (resolved) {
      alert.resolved = true;
      this.emit('alert:resolved', alert);
    }
  }

  // Trend Analysis

  public getTrends(
    metric: string,
    timeRange: PerformanceTrend['timeRange']
  ): PerformanceTrend {
    const dataPoints = this.getDataPointsForTimeRange(metric, timeRange);
    const trend = this.calculateTrend(dataPoints);
    const changePercentage = this.calculateChangePercentage(dataPoints);
    const forecast = this.forecastNextPeriod(dataPoints);

    return {
      metric,
      timeRange,
      dataPoints,
      trend,
      changePercentage,
      forecast
    };
  }

  private getDataPointsForTimeRange(
    metric: string,
    timeRange: PerformanceTrend['timeRange']
  ): TrendDataPoint[] {
    const systemMetrics = this.metrics.get('system') || [];
    const cutoffTime = this.getCutoffTime(timeRange);
    
    return systemMetrics
      .filter(m => m.timestamp > cutoffTime)
      .map(m => ({
        timestamp: m.timestamp,
        value: m[metric as keyof PerformanceMetrics] as number,
        anomaly: this.isAnomaly(m[metric as keyof PerformanceMetrics] as number, metric)
      }));
  }

  private getCutoffTime(timeRange: PerformanceTrend['timeRange']): Date {
    const now = new Date();
    switch (timeRange) {
      case 'hour':
        return new Date(now.getTime() - 3600000);
      case 'day':
        return new Date(now.getTime() - 86400000);
      case 'week':
        return new Date(now.getTime() - 604800000);
      case 'month':
        return new Date(now.getTime() - 2592000000);
    }
  }

  private calculateTrend(dataPoints: TrendDataPoint[]): 'improving' | 'stable' | 'degrading' {
    if (dataPoints.length < 2) return 'stable';

    // Simple linear regression
    const n = dataPoints.length;
    const x = dataPoints.map((_, i) => i);
    const y = dataPoints.map(d => d.value);
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
    const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    if (Math.abs(slope) < 0.01) return 'stable';
    return slope > 0 ? 'degrading' : 'improving';
  }

  private calculateChangePercentage(dataPoints: TrendDataPoint[]): number {
    if (dataPoints.length < 2) return 0;
    
    const first = dataPoints[0].value;
    const last = dataPoints[dataPoints.length - 1].value;
    
    return ((last - first) / first) * 100;
  }

  private forecastNextPeriod(dataPoints: TrendDataPoint[]): TrendForecast | undefined {
    if (dataPoints.length < 10) return undefined;

    // Simple moving average forecast
    const recentPoints = dataPoints.slice(-5);
    const average = recentPoints.reduce((sum, p) => sum + p.value, 0) / recentPoints.length;
    
    // Calculate standard deviation for confidence bounds
    const variance = recentPoints.reduce((sum, p) => 
      sum + Math.pow(p.value - average, 2), 0
    ) / recentPoints.length;
    const stdDev = Math.sqrt(variance);
    
    return {
      nextPeriod: average,
      confidence: 0.8, // 80% confidence
      upperBound: average + 1.96 * stdDev,
      lowerBound: Math.max(0, average - 1.96 * stdDev)
    };
  }

  private isAnomaly(value: number, metric: string): boolean {
    const threshold = this.thresholds[metric as keyof typeof this.thresholds];
    if (!threshold) return false;
    
    return value > threshold.warning;
  }

  // Utility Methods

  private calculateThroughput(): number {
    const recentExecutions = Array.from(this.workflowMetrics.values())
      .reduce((sum, m) => sum + m.executions, 0);
    return recentExecutions / (this.analysisInterval / 1000); // per second
  }

  private calculateLatency(): number {
    const recentExecutions = Array.from(this.workflowMetrics.values());
    if (recentExecutions.length === 0) return 0;
    
    const totalLatency = recentExecutions.reduce(
      (sum, m) => sum + m.averageExecutionTime, 0
    );
    return totalLatency / recentExecutions.length;
  }

  private calculateErrorRate(): number {
    const recentExecutions = Array.from(this.workflowMetrics.values());
    if (recentExecutions.length === 0) return 0;
    
    const totalErrors = recentExecutions.reduce(
      (sum, m) => sum + (m.errorRate * m.executions), 0
    );
    const totalExecutions = recentExecutions.reduce(
      (sum, m) => sum + m.executions, 0
    );
    
    return totalExecutions > 0 ? totalErrors / totalExecutions : 0;
  }

  private calculateSuccessRate(): number {
    return 1 - this.calculateErrorRate();
  }

  private getCurrentConcurrency(): number {
    // Would be tracked from actual workflow engine
    return 0;
  }

  private getQueueDepth(): number {
    // Would be tracked from actual workflow engine
    return 0;
  }

  private cleanupOldMetrics(): void {
    const cutoffTime = new Date(Date.now() - this.metricsRetentionDays * 86400000);
    
    for (const [key, metrics] of this.metrics.entries()) {
      const filtered = metrics.filter(m => m.timestamp > cutoffTime);
      if (filtered.length < metrics.length) {
        this.metrics.set(key, filtered);
      }
    }
  }

  private detectPerformanceIssues(metrics: WorkflowMetrics): void {
    // Detect slow workflows
    if (metrics.averageExecutionTime > this.thresholds.executionTime.warning) {
      this.createAlert(
        AlertType.SLOW_EXECUTION,
        'warning',
        'averageExecutionTime',
        this.thresholds.executionTime.warning,
        metrics.averageExecutionTime,
        `Workflow ${metrics.name} is running slowly`,
        metrics.workflowId
      );
    }

    // Detect high error rates
    if (metrics.errorRate > this.thresholds.errorRate.warning) {
      this.createAlert(
        AlertType.HIGH_ERROR_RATE,
        'warning',
        'errorRate',
        this.thresholds.errorRate.warning,
        metrics.errorRate,
        `Workflow ${metrics.name} has high error rate`,
        metrics.workflowId
      );
    }
  }

  // Public API

  public getWorkflowMetrics(workflowId: string): WorkflowMetrics | undefined {
    return this.workflowMetrics.get(workflowId);
  }

  public getAllWorkflowMetrics(): WorkflowMetrics[] {
    return Array.from(this.workflowMetrics.values());
  }

  public getAlerts(filter?: {
    severity?: PerformanceAlert['severity'];
    resolved?: boolean;
    type?: AlertType;
  }): PerformanceAlert[] {
    let alerts = Array.from(this.alerts.values());
    
    if (filter) {
      if (filter.severity) {
        alerts = alerts.filter(a => a.severity === filter.severity);
      }
      if (filter.resolved !== undefined) {
        alerts = alerts.filter(a => a.resolved === filter.resolved);
      }
      if (filter.type) {
        alerts = alerts.filter(a => a.type === filter.type);
      }
    }
    
    return alerts;
  }

  public getOptimizationSuggestions(): OptimizationSuggestion[] {
    return Array.from(this.optimizations.values());
  }

  public acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      this.emit('alert:acknowledged', alert);
    }
  }

  public setThreshold(
    metric: string,
    level: 'warning' | 'critical',
    value: number
  ): void {
    if (this.thresholds[metric as keyof typeof this.thresholds]) {
      this.thresholds[metric as keyof typeof this.thresholds][level] = value;
      this.emit('threshold:updated', { metric, level, value });
    }
  }
}

// Types

export interface StepExecutionData {
  name: string;
  executionTime: number;
  success: boolean;
  retried?: boolean;
  timedOut?: boolean;
  error?: Error;
}