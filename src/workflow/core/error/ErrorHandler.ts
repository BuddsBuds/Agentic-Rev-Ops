// Error Handling and Retry Mechanisms for Workflow Engine
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

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

export enum ErrorType {
  VALIDATION = 'validation',
  EXECUTION = 'execution',
  TIMEOUT = 'timeout',
  INTEGRATION = 'integration',
  PERMISSION = 'permission',
  RESOURCE = 'resource',
  NETWORK = 'network',
  BUSINESS = 'business',
  SYSTEM = 'system',
  UNKNOWN = 'unknown'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
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

export enum RetryStrategy {
  FIXED = 'fixed',
  LINEAR = 'linear',
  EXPONENTIAL = 'exponential',
  FIBONACCI = 'fibonacci',
  CUSTOM = 'custom'
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
  mttr: number; // Mean Time To Recovery
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

export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

export class ErrorHandler extends EventEmitter {
  private errors: Map<string, WorkflowError> = new Map();
  private retryPolicies: Map<string, RetryPolicy> = new Map();
  private recoveryPlans: Map<string, ErrorRecoveryPlan> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private metrics: ErrorMetrics;
  
  constructor() {
    super();
    this.metrics = this.initializeMetrics();
    this.setupDefaultPolicies();
  }

  private initializeMetrics(): ErrorMetrics {
    return {
      totalErrors: 0,
      errorsByType: {} as Record<ErrorType, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      retrySuccessRate: 0,
      averageRetryCount: 0,
      recoverySuccessRate: 0,
      mttr: 0
    };
  }

  private setupDefaultPolicies(): void {
    // Default retry policy
    this.retryPolicies.set('default', {
      maxRetries: 3,
      strategy: RetryStrategy.EXPONENTIAL,
      baseDelay: 1000,
      maxDelay: 30000,
      jitter: true,
      retryableErrors: [
        ErrorType.NETWORK,
        ErrorType.TIMEOUT,
        ErrorType.RESOURCE
      ]
    });

    // Aggressive retry policy for critical operations
    this.retryPolicies.set('aggressive', {
      maxRetries: 5,
      strategy: RetryStrategy.EXPONENTIAL,
      baseDelay: 500,
      maxDelay: 60000,
      jitter: true,
      retryableErrors: [
        ErrorType.NETWORK,
        ErrorType.TIMEOUT,
        ErrorType.RESOURCE,
        ErrorType.INTEGRATION
      ]
    });

    // No retry policy
    this.retryPolicies.set('no-retry', {
      maxRetries: 0,
      strategy: RetryStrategy.FIXED,
      baseDelay: 0,
      maxDelay: 0,
      jitter: false
    });
  }

  // Error Creation and Management

  public createError(
    type: ErrorType,
    message: string,
    options: {
      severity?: ErrorSeverity;
      details?: any;
      stack?: string;
      workflowId?: string;
      stepId?: string;
      retryable?: boolean;
      context?: ErrorContext;
    } = {}
  ): WorkflowError {
    const error: WorkflowError = {
      id: uuidv4(),
      type,
      severity: options.severity || this.determineSeverity(type),
      message,
      details: options.details,
      stack: options.stack || new Error().stack,
      timestamp: new Date(),
      workflowId: options.workflowId,
      stepId: options.stepId,
      retryable: options.retryable ?? this.isRetryableError(type),
      retryCount: 0,
      context: options.context
    };

    this.errors.set(error.id, error);
    this.updateMetrics(error);
    this.emit('error:created', error);

    return error;
  }

  private determineSeverity(type: ErrorType): ErrorSeverity {
    switch (type) {
      case ErrorType.SYSTEM:
      case ErrorType.PERMISSION:
        return ErrorSeverity.CRITICAL;
      case ErrorType.EXECUTION:
      case ErrorType.INTEGRATION:
        return ErrorSeverity.HIGH;
      case ErrorType.TIMEOUT:
      case ErrorType.NETWORK:
        return ErrorSeverity.MEDIUM;
      default:
        return ErrorSeverity.LOW;
    }
  }

  private isRetryableError(type: ErrorType): boolean {
    const retryableTypes = [
      ErrorType.NETWORK,
      ErrorType.TIMEOUT,
      ErrorType.RESOURCE,
      ErrorType.INTEGRATION
    ];
    return retryableTypes.includes(type);
  }

  // Retry Mechanism

  public async retry<T>(
    operation: () => Promise<T>,
    policyName: string = 'default',
    context?: {
      workflowId?: string;
      stepId?: string;
      errorContext?: ErrorContext;
    }
  ): Promise<T> {
    const policy = this.retryPolicies.get(policyName);
    if (!policy) {
      throw new Error(`Retry policy ${policyName} not found`);
    }

    let lastError: WorkflowError | null = null;
    let attempt = 0;

    while (attempt <= policy.maxRetries) {
      try {
        const result = await operation();
        
        if (attempt > 0) {
          this.emit('retry:success', {
            attempt,
            policy: policyName,
            context
          });
        }
        
        return result;
      } catch (error) {
        attempt++;
        
        lastError = this.createError(
          this.determineErrorType(error),
          error instanceof Error ? error.message : String(error),
          {
            details: error,
            stack: error instanceof Error ? error.stack : undefined,
            workflowId: context?.workflowId,
            stepId: context?.stepId,
            context: context?.errorContext
          }
        );

        lastError.retryCount = attempt;
        lastError.maxRetries = policy.maxRetries;

        // Check if error is retryable
        if (!this.shouldRetry(lastError, policy, attempt)) {
          break;
        }

        // Calculate delay
        const delay = this.calculateDelay(policy, attempt);
        
        this.emit('retry:attempt', {
          error: lastError,
          attempt,
          delay,
          policy: policyName,
          context
        });

        await this.sleep(delay);
      }
    }

    // All retries exhausted
    if (lastError) {
      lastError.retryable = false;
      this.emit('retry:exhausted', {
        error: lastError,
        attempts: attempt,
        policy: policyName,
        context
      });
      throw lastError;
    }

    throw new Error('Unexpected retry state');
  }

  private shouldRetry(error: WorkflowError, policy: RetryPolicy, attempt: number): boolean {
    if (attempt > policy.maxRetries) {
      return false;
    }

    if (policy.retryableErrors && !policy.retryableErrors.includes(error.type)) {
      return false;
    }

    if (policy.retryCondition) {
      return policy.retryCondition(error, attempt);
    }

    return error.retryable;
  }

  private calculateDelay(policy: RetryPolicy, attempt: number): number {
    let delay: number;

    switch (policy.strategy) {
      case RetryStrategy.FIXED:
        delay = policy.baseDelay;
        break;
      
      case RetryStrategy.LINEAR:
        delay = policy.baseDelay * attempt;
        break;
      
      case RetryStrategy.EXPONENTIAL:
        delay = policy.baseDelay * Math.pow(2, attempt - 1);
        break;
      
      case RetryStrategy.FIBONACCI:
        delay = policy.baseDelay * this.fibonacci(attempt);
        break;
      
      default:
        delay = policy.baseDelay;
    }

    // Apply max delay cap
    delay = Math.min(delay, policy.maxDelay);

    // Apply jitter if enabled
    if (policy.jitter) {
      const jitter = Math.random() * 0.3 * delay; // 30% jitter
      delay = delay + jitter * (Math.random() > 0.5 ? 1 : -1);
    }

    return Math.round(delay);
  }

  private fibonacci(n: number): number {
    if (n <= 1) return n;
    return this.fibonacci(n - 1) + this.fibonacci(n - 2);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Error Recovery

  public async recover(
    error: WorkflowError,
    strategy?: ErrorHandlingStrategy
  ): Promise<any> {
    const recoveryStartTime = Date.now();
    
    try {
      // Find matching recovery plan
      const plan = this.findRecoveryPlan(error);
      
      if (plan) {
        const result = await this.executeRecoveryPlan(plan, error);
        
        const recoveryTime = Date.now() - recoveryStartTime;
        this.updateRecoveryMetrics(true, recoveryTime);
        
        this.emit('recovery:success', {
          error,
          plan,
          result,
          duration: recoveryTime
        });
        
        return result;
      }
      
      // Use provided strategy or default
      if (strategy) {
        return await this.executeStrategy(strategy, error);
      }
      
      throw new Error('No recovery plan or strategy available');
      
    } catch (recoveryError) {
      const recoveryTime = Date.now() - recoveryStartTime;
      this.updateRecoveryMetrics(false, recoveryTime);
      
      this.emit('recovery:failed', {
        originalError: error,
        recoveryError,
        duration: recoveryTime
      });
      
      throw recoveryError;
    }
  }

  private findRecoveryPlan(error: WorkflowError): ErrorRecoveryPlan | undefined {
    const plans = Array.from(this.recoveryPlans.values())
      .filter(plan => plan.enabled && plan.errorTypes.includes(error.type))
      .sort((a, b) => b.priority - a.priority);

    for (const plan of plans) {
      if (this.matchesConditions(plan, error)) {
        return plan;
      }
    }

    return undefined;
  }

  private matchesConditions(plan: ErrorRecoveryPlan, error: WorkflowError): boolean {
    if (!plan.conditions || plan.conditions.length === 0) {
      return true;
    }

    // Evaluate conditions
    for (const condition of plan.conditions) {
      try {
        const func = new Function('error', `return ${condition}`);
        if (!func(error)) {
          return false;
        }
      } catch {
        return false;
      }
    }

    return true;
  }

  private async executeRecoveryPlan(
    plan: ErrorRecoveryPlan,
    error: WorkflowError
  ): Promise<any> {
    const results: any[] = [];

    for (const action of plan.actions) {
      try {
        const result = await this.executeRecoveryAction(action, error);
        results.push(result);
        
        // Some actions might terminate the recovery process
        if (action.type === 'skip' || action.type === 'fallback') {
          break;
        }
      } catch (actionError) {
        this.emit('recovery:action-failed', {
          plan,
          action,
          error: actionError
        });
        throw actionError;
      }
    }

    return results;
  }

  private async executeRecoveryAction(
    action: RecoveryAction,
    error: WorkflowError
  ): Promise<any> {
    switch (action.type) {
      case 'retry':
        return await this.retryWithConfig(error, action.config);
      
      case 'skip':
        return { skipped: true, reason: error.message };
      
      case 'compensate':
        return await this.compensate(error, action.config);
      
      case 'escalate':
        return await this.escalate(error, action.config);
      
      case 'fallback':
        return await this.fallback(error, action.config);
      
      case 'transform':
        return await this.transform(error, action.config);
      
      default:
        throw new Error(`Unknown recovery action type: ${action.type}`);
    }
  }

  private async retryWithConfig(error: WorkflowError, config: any): Promise<any> {
    // Implement retry with specific configuration
    return { retried: true, config };
  }

  private async compensate(error: WorkflowError, config: any): Promise<any> {
    const compensationActions: CompensationAction[] = config.actions || [];
    
    // Sort by order
    compensationActions.sort((a, b) => a.order - b.order);
    
    const results: any[] = [];
    
    for (const action of compensationActions) {
      const result = await this.executeCompensationAction(action, error);
      results.push(result);
    }
    
    return { compensated: true, results };
  }

  private async executeCompensationAction(
    action: CompensationAction,
    error: WorkflowError
  ): Promise<any> {
    this.emit('compensation:execute', { action, error });
    
    switch (action.type) {
      case 'rollback':
        return { rolled_back: action.target };
      
      case 'cleanup':
        return { cleaned_up: action.target };
      
      case 'notify':
        return { notified: action.config.recipients };
      
      case 'custom':
        // Execute custom compensation logic
        return { custom: action.config };
      
      default:
        throw new Error(`Unknown compensation action type: ${action.type}`);
    }
  }

  private async escalate(error: WorkflowError, config: any): Promise<any> {
    this.emit('error:escalated', {
      error,
      level: config.level,
      assignee: config.assignee
    });
    
    return { escalated: true, to: config.assignee };
  }

  private async fallback(error: WorkflowError, config: any): Promise<any> {
    if (config.value) {
      return config.value;
    }
    
    if (config.function) {
      // Execute fallback function
      return { fallback: config.function };
    }
    
    return { fallback: true };
  }

  private async transform(error: WorkflowError, config: any): Promise<any> {
    if (config.transformer) {
      // Apply transformation
      return { transformed: true, result: config.transformer(error) };
    }
    
    return { transformed: true };
  }

  private async executeStrategy(
    strategy: ErrorHandlingStrategy,
    error: WorkflowError
  ): Promise<any> {
    switch (strategy.type) {
      case 'stop':
        throw error;
      
      case 'continue':
        this.emit('error:ignored', error);
        return { continued: true, error };
      
      case 'compensate':
        return await this.compensate(error, strategy.config);
      
      case 'escalate':
        return await this.escalate(error, strategy.config);
      
      case 'fallback':
        return await this.fallback(error, strategy.config);
      
      default:
        throw new Error(`Unknown strategy type: ${strategy.type}`);
    }
  }

  // Circuit Breaker Pattern

  public getCircuitBreaker(
    name: string,
    config?: CircuitBreakerConfig
  ): CircuitBreaker {
    if (!this.circuitBreakers.has(name)) {
      const breaker = new CircuitBreaker(
        name,
        config || {
          threshold: 5,
          timeout: 60000,
          resetTimeout: 30000,
          halfOpenRequests: 3
        }
      );
      
      this.circuitBreakers.set(name, breaker);
      this.setupCircuitBreakerListeners(breaker);
    }
    
    return this.circuitBreakers.get(name)!;
  }

  private setupCircuitBreakerListeners(breaker: CircuitBreaker): void {
    breaker.on('open', () => {
      this.emit('circuit-breaker:open', { name: breaker.name });
    });
    
    breaker.on('close', () => {
      this.emit('circuit-breaker:close', { name: breaker.name });
    });
    
    breaker.on('half-open', () => {
      this.emit('circuit-breaker:half-open', { name: breaker.name });
    });
  }

  // Error Analysis

  public analyzeError(error: WorkflowError): ErrorAnalysis {
    const similarErrors = this.findSimilarErrors(error);
    const pattern = this.detectErrorPattern(error, similarErrors);
    const recommendation = this.generateRecommendation(error, pattern);
    
    return {
      error,
      similarErrors: similarErrors.length,
      pattern,
      recommendation,
      metrics: this.getErrorMetrics(error.type)
    };
  }

  private findSimilarErrors(error: WorkflowError): WorkflowError[] {
    return Array.from(this.errors.values()).filter(e => 
      e.type === error.type &&
      e.workflowId === error.workflowId &&
      e.id !== error.id
    );
  }

  private detectErrorPattern(
    error: WorkflowError,
    similarErrors: WorkflowError[]
  ): ErrorPattern | null {
    if (similarErrors.length < 3) {
      return null;
    }

    // Time-based pattern detection
    const recentErrors = similarErrors.filter(e => 
      e.timestamp.getTime() > Date.now() - 3600000 // Last hour
    );

    if (recentErrors.length >= 5) {
      return {
        type: 'frequency',
        description: 'High frequency of similar errors',
        severity: ErrorSeverity.HIGH,
        count: recentErrors.length,
        timeWindow: '1 hour'
      };
    }

    // Step-based pattern detection
    const stepErrors = similarErrors.filter(e => e.stepId === error.stepId);
    if (stepErrors.length >= 3) {
      return {
        type: 'step',
        description: 'Repeated errors in the same step',
        severity: ErrorSeverity.MEDIUM,
        count: stepErrors.length,
        stepId: error.stepId
      };
    }

    return null;
  }

  private generateRecommendation(
    error: WorkflowError,
    pattern: ErrorPattern | null
  ): string {
    const recommendations: string[] = [];

    // Type-specific recommendations
    switch (error.type) {
      case ErrorType.TIMEOUT:
        recommendations.push('Consider increasing timeout values');
        recommendations.push('Check for performance bottlenecks');
        break;
      
      case ErrorType.NETWORK:
        recommendations.push('Implement retry with exponential backoff');
        recommendations.push('Check network connectivity and firewall rules');
        break;
      
      case ErrorType.RESOURCE:
        recommendations.push('Monitor resource usage and limits');
        recommendations.push('Implement resource pooling or caching');
        break;
      
      case ErrorType.INTEGRATION:
        recommendations.push('Verify API credentials and permissions');
        recommendations.push('Check integration endpoint availability');
        break;
    }

    // Pattern-specific recommendations
    if (pattern) {
      switch (pattern.type) {
        case 'frequency':
          recommendations.push('Enable circuit breaker for this operation');
          recommendations.push('Investigate root cause of frequent failures');
          break;
        
        case 'step':
          recommendations.push('Review and optimize the failing step');
          recommendations.push('Add additional error handling for this step');
          break;
      }
    }

    return recommendations.join('; ');
  }

  // Metrics and Monitoring

  private updateMetrics(error: WorkflowError): void {
    this.metrics.totalErrors++;
    
    // Update by type
    this.metrics.errorsByType[error.type] = 
      (this.metrics.errorsByType[error.type] || 0) + 1;
    
    // Update by severity
    this.metrics.errorsBySeverity[error.severity] = 
      (this.metrics.errorsBySeverity[error.severity] || 0) + 1;
  }

  private updateRecoveryMetrics(success: boolean, duration: number): void {
    // Update recovery success rate
    const totalRecoveries = this.metrics.totalErrors;
    const successfulRecoveries = Math.round(
      this.metrics.recoverySuccessRate * totalRecoveries
    ) + (success ? 1 : 0);
    
    this.metrics.recoverySuccessRate = successfulRecoveries / totalRecoveries;
    
    // Update MTTR
    const totalTime = this.metrics.mttr * totalRecoveries + duration;
    this.metrics.mttr = totalTime / (totalRecoveries + 1);
  }

  public getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  public getErrorMetrics(type: ErrorType): any {
    const typeErrors = Array.from(this.errors.values())
      .filter(e => e.type === type);
    
    return {
      count: typeErrors.length,
      retryable: typeErrors.filter(e => e.retryable).length,
      averageRetries: typeErrors.reduce((sum, e) => 
        sum + (e.retryCount || 0), 0) / typeErrors.length,
      severityDistribution: this.getSeverityDistribution(typeErrors)
    };
  }

  private getSeverityDistribution(errors: WorkflowError[]): Record<ErrorSeverity, number> {
    const distribution: Record<ErrorSeverity, number> = {
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.CRITICAL]: 0
    };
    
    for (const error of errors) {
      distribution[error.severity]++;
    }
    
    return distribution;
  }

  // Utility Methods

  private determineErrorType(error: any): ErrorType {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return ErrorType.NETWORK;
    }
    
    if (error.name === 'TimeoutError') {
      return ErrorType.TIMEOUT;
    }
    
    if (error.statusCode === 403 || error.statusCode === 401) {
      return ErrorType.PERMISSION;
    }
    
    if (error.statusCode >= 500) {
      return ErrorType.INTEGRATION;
    }
    
    return ErrorType.UNKNOWN;
  }

  // Policy Management

  public registerRetryPolicy(name: string, policy: RetryPolicy): void {
    this.retryPolicies.set(name, policy);
    this.emit('policy:registered', { name, policy });
  }

  public registerRecoveryPlan(plan: ErrorRecoveryPlan): void {
    this.recoveryPlans.set(plan.id, plan);
    this.emit('recovery-plan:registered', plan);
  }

  // Cleanup

  public clearOldErrors(olderThan: Date): number {
    const cutoff = olderThan.getTime();
    let cleared = 0;
    
    for (const [id, error] of this.errors.entries()) {
      if (error.timestamp.getTime() < cutoff) {
        this.errors.delete(id);
        cleared++;
      }
    }
    
    return cleared;
  }
}

// Circuit Breaker Implementation

export class CircuitBreaker extends EventEmitter {
  public name: string;
  private config: CircuitBreakerConfig;
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failures: number = 0;
  private lastFailureTime?: Date;
  private halfOpenRequests: number = 0;
  private successfulRequests: number = 0;
  private timeout?: NodeJS.Timeout;

  constructor(name: string, config: CircuitBreakerConfig) {
    super();
    this.name = name;
    this.config = config;
  }

  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.halfOpenRequests = 0;
        this.emit('half-open');
        if (this.config.onHalfOpen) {
          this.config.onHalfOpen();
        }
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) {
      return true;
    }
    
    const elapsed = Date.now() - this.lastFailureTime.getTime();
    return elapsed >= this.config.resetTimeout;
  }

  private onSuccess(): void {
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successfulRequests++;
      
      if (this.successfulRequests >= this.config.halfOpenRequests) {
        this.close();
      }
    } else {
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.open();
    } else if (this.failures >= this.config.threshold) {
      this.open();
    }
  }

  private open(): void {
    this.state = CircuitBreakerState.OPEN;
    this.emit('open');
    
    if (this.config.onOpen) {
      this.config.onOpen();
    }

    // Set timeout for automatic reset attempt
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    
    this.timeout = setTimeout(() => {
      this.state = CircuitBreakerState.HALF_OPEN;
      this.halfOpenRequests = 0;
      this.successfulRequests = 0;
      this.emit('half-open');
      
      if (this.config.onHalfOpen) {
        this.config.onHalfOpen();
      }
    }, this.config.resetTimeout);
  }

  private close(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failures = 0;
    this.successfulRequests = 0;
    this.emit('close');
    
    if (this.config.onClose) {
      this.config.onClose();
    }
    
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }
  }

  public getState(): CircuitBreakerState {
    return this.state;
  }

  public getStats(): any {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      successfulRequests: this.successfulRequests
    };
  }

  public reset(): void {
    this.close();
  }
}

// Types

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