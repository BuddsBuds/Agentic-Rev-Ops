import { EventEmitter } from 'events';
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
    estimatedImprovement: number;
    targetMetric: string;
    relatedWorkflows?: string[];
    relatedSteps?: string[];
}
export declare enum OptimizationType {
    PARALLEL_EXECUTION = "parallel_execution",
    CACHING = "caching",
    BATCH_PROCESSING = "batch_processing",
    RESOURCE_POOLING = "resource_pooling",
    TIMEOUT_ADJUSTMENT = "timeout_adjustment",
    RETRY_OPTIMIZATION = "retry_optimization",
    STEP_ELIMINATION = "step_elimination",
    STEP_REORDERING = "step_reordering",
    LOAD_BALANCING = "load_balancing",
    CIRCUIT_BREAKER = "circuit_breaker"
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
    impactScore: number;
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
export declare enum AlertType {
    SLOW_EXECUTION = "slow_execution",
    HIGH_ERROR_RATE = "high_error_rate",
    RESOURCE_EXHAUSTION = "resource_exhaustion",
    QUEUE_BACKUP = "queue_backup",
    SLA_BREACH = "sla_breach",
    DEGRADED_PERFORMANCE = "degraded_performance"
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
export declare class PerformanceOptimizer extends EventEmitter {
    private metrics;
    private workflowMetrics;
    private alerts;
    private optimizations;
    private metricsRetentionDays;
    private samplingInterval;
    private analysisInterval;
    private isMonitoring;
    private monitoringInterval?;
    private analysisTimeout?;
    constructor();
    private thresholds;
    private setupDefaultThresholds;
    startMonitoring(): void;
    stopMonitoring(): void;
    private collectMetrics;
    recordWorkflowExecution(workflowId: string, workflowName: string, executionTime: number, success: boolean, stepExecutions?: Map<string, StepExecutionData>): void;
    private updateStepMetrics;
    private analyzePerformance;
    private identifyBottlenecks;
    private calculateImpactScore;
    private generateOptimizationSuggestions;
    private identifySequentialSteps;
    private applyAutoOptimizations;
    private applyOptimization;
    private adjustTimeouts;
    private optimizeRetries;
    private checkThresholds;
    private createAlert;
    private checkAlertResolution;
    getTrends(metric: string, timeRange: PerformanceTrend['timeRange']): PerformanceTrend;
    private getDataPointsForTimeRange;
    private getCutoffTime;
    private calculateTrend;
    private calculateChangePercentage;
    private forecastNextPeriod;
    private isAnomaly;
    private calculateThroughput;
    private calculateLatency;
    private calculateErrorRate;
    private calculateSuccessRate;
    private getCurrentConcurrency;
    private getQueueDepth;
    private cleanupOldMetrics;
    private detectPerformanceIssues;
    getWorkflowMetrics(workflowId: string): WorkflowMetrics | undefined;
    getAllWorkflowMetrics(): WorkflowMetrics[];
    getAlerts(filter?: {
        severity?: PerformanceAlert['severity'];
        resolved?: boolean;
        type?: AlertType;
    }): PerformanceAlert[];
    getOptimizationSuggestions(): OptimizationSuggestion[];
    acknowledgeAlert(alertId: string): void;
    setThreshold(metric: string, level: 'warning' | 'critical', value: number): void;
}
export interface StepExecutionData {
    name: string;
    executionTime: number;
    success: boolean;
    retried?: boolean;
    timedOut?: boolean;
    error?: Error;
}
//# sourceMappingURL=PerformanceOptimizer.d.ts.map