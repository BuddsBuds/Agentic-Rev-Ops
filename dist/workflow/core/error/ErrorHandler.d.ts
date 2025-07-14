import { EventEmitter } from 'events';
export interface WorkflowError {
    id: string;
    type: ErrorType;
    severity: ErrorSeverity;
    message: string;
    details?: any;
    stack?: string;
    timestamp: Date;
    workflowId?: string;
    stepId?: string;
    retryable: boolean;
    retryCount?: number;
    maxRetries?: number;
    context?: ErrorContext;
}
export declare enum ErrorType {
    VALIDATION = "validation",
    EXECUTION = "execution",
    TIMEOUT = "timeout",
    INTEGRATION = "integration",
    PERMISSION = "permission",
    RESOURCE = "resource",
    NETWORK = "network",
    BUSINESS = "business",
    SYSTEM = "system",
    UNKNOWN = "unknown"
}
export declare enum ErrorSeverity {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    CRITICAL = "critical"
}
export interface ErrorContext {
    user?: string;
    organization?: string;
    environment?: string;
    apiVersion?: string;
    requestId?: string;
    sessionId?: string;
    metadata?: Record<string, any>;
}
export interface RetryPolicy {
    maxRetries: number;
    strategy: RetryStrategy;
    baseDelay: number;
    maxDelay: number;
    jitter: boolean;
    retryableErrors?: ErrorType[];
    retryCondition?: (error: WorkflowError, attempt: number) => boolean;
}
export declare enum RetryStrategy {
    FIXED = "fixed",
    LINEAR = "linear",
    EXPONENTIAL = "exponential",
    FIBONACCI = "fibonacci",
    CUSTOM = "custom"
}
export interface ErrorHandlingStrategy {
    type: 'stop' | 'continue' | 'compensate' | 'escalate' | 'fallback';
    config?: any;
}
export interface CompensationAction {
    id: string;
    type: 'rollback' | 'cleanup' | 'notify' | 'custom';
    target: string;
    config: any;
    order: number;
}
export interface ErrorRecoveryPlan {
    id: string;
    errorTypes: ErrorType[];
    conditions?: string[];
    actions: RecoveryAction[];
    priority: number;
    enabled: boolean;
}
export interface RecoveryAction {
    type: 'retry' | 'skip' | 'compensate' | 'escalate' | 'fallback' | 'transform';
    config: any;
    timeout?: number;
}
export interface ErrorMetrics {
    totalErrors: number;
    errorsByType: Record<ErrorType, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    retrySuccessRate: number;
    averageRetryCount: number;
    recoverySuccessRate: number;
    mttr: number;
}
export interface CircuitBreakerConfig {
    threshold: number;
    timeout: number;
    resetTimeout: number;
    halfOpenRequests: number;
    onOpen?: () => void;
    onClose?: () => void;
    onHalfOpen?: () => void;
}
export declare enum CircuitBreakerState {
    CLOSED = "closed",
    OPEN = "open",
    HALF_OPEN = "half_open"
}
export declare class ErrorHandler extends EventEmitter {
    private errors;
    private retryPolicies;
    private recoveryPlans;
    private circuitBreakers;
    private metrics;
    constructor();
    private initializeMetrics;
    private setupDefaultPolicies;
    createError(type: ErrorType, message: string, options?: {
        severity?: ErrorSeverity;
        details?: any;
        stack?: string;
        workflowId?: string;
        stepId?: string;
        retryable?: boolean;
        context?: ErrorContext;
    }): WorkflowError;
    private determineSeverity;
    private isRetryableError;
    retry<T>(operation: () => Promise<T>, policyName?: string, context?: {
        workflowId?: string;
        stepId?: string;
        errorContext?: ErrorContext;
    }): Promise<T>;
    private shouldRetry;
    private calculateDelay;
    private fibonacci;
    private sleep;
    recover(error: WorkflowError, strategy?: ErrorHandlingStrategy): Promise<any>;
    private findRecoveryPlan;
    private matchesConditions;
    private executeRecoveryPlan;
    private executeRecoveryAction;
    private retryWithConfig;
    private compensate;
    private executeCompensationAction;
    private escalate;
    private fallback;
    private transform;
    private executeStrategy;
    getCircuitBreaker(name: string, config?: CircuitBreakerConfig): CircuitBreaker;
    private setupCircuitBreakerListeners;
    analyzeError(error: WorkflowError): ErrorAnalysis;
    private findSimilarErrors;
    private detectErrorPattern;
    private generateRecommendation;
    private updateMetrics;
    private updateRecoveryMetrics;
    getMetrics(): ErrorMetrics;
    getErrorMetrics(type: ErrorType): any;
    private getSeverityDistribution;
    private determineErrorType;
    registerRetryPolicy(name: string, policy: RetryPolicy): void;
    registerRecoveryPlan(plan: ErrorRecoveryPlan): void;
    clearOldErrors(olderThan: Date): number;
}
export declare class CircuitBreaker extends EventEmitter {
    name: string;
    private config;
    private state;
    private failures;
    private lastFailureTime?;
    private halfOpenRequests;
    private successfulRequests;
    private timeout?;
    constructor(name: string, config: CircuitBreakerConfig);
    execute<T>(operation: () => Promise<T>): Promise<T>;
    private shouldAttemptReset;
    private onSuccess;
    private onFailure;
    private open;
    private close;
    getState(): CircuitBreakerState;
    getStats(): any;
    reset(): void;
}
export interface ErrorAnalysis {
    error: WorkflowError;
    similarErrors: number;
    pattern: ErrorPattern | null;
    recommendation: string;
    metrics: any;
}
export interface ErrorPattern {
    type: 'frequency' | 'step' | 'time' | 'user';
    description: string;
    severity: ErrorSeverity;
    count: number;
    [key: string]: any;
}
//# sourceMappingURL=ErrorHandler.d.ts.map