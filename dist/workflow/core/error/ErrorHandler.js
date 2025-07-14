"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = exports.ErrorHandler = exports.CircuitBreakerState = exports.RetryStrategy = exports.ErrorSeverity = exports.ErrorType = void 0;
const events_1 = require("events");
const uuid_1 = require("uuid");
var ErrorType;
(function (ErrorType) {
    ErrorType["VALIDATION"] = "validation";
    ErrorType["EXECUTION"] = "execution";
    ErrorType["TIMEOUT"] = "timeout";
    ErrorType["INTEGRATION"] = "integration";
    ErrorType["PERMISSION"] = "permission";
    ErrorType["RESOURCE"] = "resource";
    ErrorType["NETWORK"] = "network";
    ErrorType["BUSINESS"] = "business";
    ErrorType["SYSTEM"] = "system";
    ErrorType["UNKNOWN"] = "unknown";
})(ErrorType || (exports.ErrorType = ErrorType = {}));
var ErrorSeverity;
(function (ErrorSeverity) {
    ErrorSeverity["LOW"] = "low";
    ErrorSeverity["MEDIUM"] = "medium";
    ErrorSeverity["HIGH"] = "high";
    ErrorSeverity["CRITICAL"] = "critical";
})(ErrorSeverity || (exports.ErrorSeverity = ErrorSeverity = {}));
var RetryStrategy;
(function (RetryStrategy) {
    RetryStrategy["FIXED"] = "fixed";
    RetryStrategy["LINEAR"] = "linear";
    RetryStrategy["EXPONENTIAL"] = "exponential";
    RetryStrategy["FIBONACCI"] = "fibonacci";
    RetryStrategy["CUSTOM"] = "custom";
})(RetryStrategy || (exports.RetryStrategy = RetryStrategy = {}));
var CircuitBreakerState;
(function (CircuitBreakerState) {
    CircuitBreakerState["CLOSED"] = "closed";
    CircuitBreakerState["OPEN"] = "open";
    CircuitBreakerState["HALF_OPEN"] = "half_open";
})(CircuitBreakerState || (exports.CircuitBreakerState = CircuitBreakerState = {}));
class ErrorHandler extends events_1.EventEmitter {
    errors = new Map();
    retryPolicies = new Map();
    recoveryPlans = new Map();
    circuitBreakers = new Map();
    metrics;
    constructor() {
        super();
        this.metrics = this.initializeMetrics();
        this.setupDefaultPolicies();
    }
    initializeMetrics() {
        return {
            totalErrors: 0,
            errorsByType: {},
            errorsBySeverity: {},
            retrySuccessRate: 0,
            averageRetryCount: 0,
            recoverySuccessRate: 0,
            mttr: 0
        };
    }
    setupDefaultPolicies() {
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
        this.retryPolicies.set('no-retry', {
            maxRetries: 0,
            strategy: RetryStrategy.FIXED,
            baseDelay: 0,
            maxDelay: 0,
            jitter: false
        });
    }
    createError(type, message, options = {}) {
        const error = {
            id: (0, uuid_1.v4)(),
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
    determineSeverity(type) {
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
    isRetryableError(type) {
        const retryableTypes = [
            ErrorType.NETWORK,
            ErrorType.TIMEOUT,
            ErrorType.RESOURCE,
            ErrorType.INTEGRATION
        ];
        return retryableTypes.includes(type);
    }
    async retry(operation, policyName = 'default', context) {
        const policy = this.retryPolicies.get(policyName);
        if (!policy) {
            throw new Error(`Retry policy ${policyName} not found`);
        }
        let lastError = null;
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
            }
            catch (error) {
                attempt++;
                lastError = this.createError(this.determineErrorType(error), error instanceof Error ? error.message : String(error), {
                    details: error,
                    stack: error instanceof Error ? error.stack : undefined,
                    workflowId: context?.workflowId,
                    stepId: context?.stepId,
                    context: context?.errorContext
                });
                lastError.retryCount = attempt;
                lastError.maxRetries = policy.maxRetries;
                if (!this.shouldRetry(lastError, policy, attempt)) {
                    break;
                }
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
    shouldRetry(error, policy, attempt) {
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
    calculateDelay(policy, attempt) {
        let delay;
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
        delay = Math.min(delay, policy.maxDelay);
        if (policy.jitter) {
            const jitter = Math.random() * 0.3 * delay;
            delay = delay + jitter * (Math.random() > 0.5 ? 1 : -1);
        }
        return Math.round(delay);
    }
    fibonacci(n) {
        if (n <= 1)
            return n;
        return this.fibonacci(n - 1) + this.fibonacci(n - 2);
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async recover(error, strategy) {
        const recoveryStartTime = Date.now();
        try {
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
            if (strategy) {
                return await this.executeStrategy(strategy, error);
            }
            throw new Error('No recovery plan or strategy available');
        }
        catch (recoveryError) {
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
    findRecoveryPlan(error) {
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
    matchesConditions(plan, error) {
        if (!plan.conditions || plan.conditions.length === 0) {
            return true;
        }
        for (const condition of plan.conditions) {
            try {
                const func = new Function('error', `return ${condition}`);
                if (!func(error)) {
                    return false;
                }
            }
            catch {
                return false;
            }
        }
        return true;
    }
    async executeRecoveryPlan(plan, error) {
        const results = [];
        for (const action of plan.actions) {
            try {
                const result = await this.executeRecoveryAction(action, error);
                results.push(result);
                if (action.type === 'skip' || action.type === 'fallback') {
                    break;
                }
            }
            catch (actionError) {
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
    async executeRecoveryAction(action, error) {
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
    async retryWithConfig(error, config) {
        return { retried: true, config };
    }
    async compensate(error, config) {
        const compensationActions = config.actions || [];
        compensationActions.sort((a, b) => a.order - b.order);
        const results = [];
        for (const action of compensationActions) {
            const result = await this.executeCompensationAction(action, error);
            results.push(result);
        }
        return { compensated: true, results };
    }
    async executeCompensationAction(action, error) {
        this.emit('compensation:execute', { action, error });
        switch (action.type) {
            case 'rollback':
                return { rolled_back: action.target };
            case 'cleanup':
                return { cleaned_up: action.target };
            case 'notify':
                return { notified: action.config.recipients };
            case 'custom':
                return { custom: action.config };
            default:
                throw new Error(`Unknown compensation action type: ${action.type}`);
        }
    }
    async escalate(error, config) {
        this.emit('error:escalated', {
            error,
            level: config.level,
            assignee: config.assignee
        });
        return { escalated: true, to: config.assignee };
    }
    async fallback(error, config) {
        if (config.value) {
            return config.value;
        }
        if (config.function) {
            return { fallback: config.function };
        }
        return { fallback: true };
    }
    async transform(error, config) {
        if (config.transformer) {
            return { transformed: true, result: config.transformer(error) };
        }
        return { transformed: true };
    }
    async executeStrategy(strategy, error) {
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
    getCircuitBreaker(name, config) {
        if (!this.circuitBreakers.has(name)) {
            const breaker = new CircuitBreaker(name, config || {
                threshold: 5,
                timeout: 60000,
                resetTimeout: 30000,
                halfOpenRequests: 3
            });
            this.circuitBreakers.set(name, breaker);
            this.setupCircuitBreakerListeners(breaker);
        }
        return this.circuitBreakers.get(name);
    }
    setupCircuitBreakerListeners(breaker) {
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
    analyzeError(error) {
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
    findSimilarErrors(error) {
        return Array.from(this.errors.values()).filter(e => e.type === error.type &&
            e.workflowId === error.workflowId &&
            e.id !== error.id);
    }
    detectErrorPattern(error, similarErrors) {
        if (similarErrors.length < 3) {
            return null;
        }
        const recentErrors = similarErrors.filter(e => e.timestamp.getTime() > Date.now() - 3600000);
        if (recentErrors.length >= 5) {
            return {
                type: 'frequency',
                description: 'High frequency of similar errors',
                severity: ErrorSeverity.HIGH,
                count: recentErrors.length,
                timeWindow: '1 hour'
            };
        }
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
    generateRecommendation(error, pattern) {
        const recommendations = [];
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
    updateMetrics(error) {
        this.metrics.totalErrors++;
        this.metrics.errorsByType[error.type] =
            (this.metrics.errorsByType[error.type] || 0) + 1;
        this.metrics.errorsBySeverity[error.severity] =
            (this.metrics.errorsBySeverity[error.severity] || 0) + 1;
    }
    updateRecoveryMetrics(success, duration) {
        const totalRecoveries = this.metrics.totalErrors;
        const successfulRecoveries = Math.round(this.metrics.recoverySuccessRate * totalRecoveries) + (success ? 1 : 0);
        this.metrics.recoverySuccessRate = successfulRecoveries / totalRecoveries;
        const totalTime = this.metrics.mttr * totalRecoveries + duration;
        this.metrics.mttr = totalTime / (totalRecoveries + 1);
    }
    getMetrics() {
        return { ...this.metrics };
    }
    getErrorMetrics(type) {
        const typeErrors = Array.from(this.errors.values())
            .filter(e => e.type === type);
        return {
            count: typeErrors.length,
            retryable: typeErrors.filter(e => e.retryable).length,
            averageRetries: typeErrors.reduce((sum, e) => sum + (e.retryCount || 0), 0) / typeErrors.length,
            severityDistribution: this.getSeverityDistribution(typeErrors)
        };
    }
    getSeverityDistribution(errors) {
        const distribution = {
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
    determineErrorType(error) {
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
    registerRetryPolicy(name, policy) {
        this.retryPolicies.set(name, policy);
        this.emit('policy:registered', { name, policy });
    }
    registerRecoveryPlan(plan) {
        this.recoveryPlans.set(plan.id, plan);
        this.emit('recovery-plan:registered', plan);
    }
    clearOldErrors(olderThan) {
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
exports.ErrorHandler = ErrorHandler;
class CircuitBreaker extends events_1.EventEmitter {
    name;
    config;
    state = CircuitBreakerState.CLOSED;
    failures = 0;
    lastFailureTime;
    halfOpenRequests = 0;
    successfulRequests = 0;
    timeout;
    constructor(name, config) {
        super();
        this.name = name;
        this.config = config;
    }
    async execute(operation) {
        if (this.state === CircuitBreakerState.OPEN) {
            if (this.shouldAttemptReset()) {
                this.state = CircuitBreakerState.HALF_OPEN;
                this.halfOpenRequests = 0;
                this.emit('half-open');
                if (this.config.onHalfOpen) {
                    this.config.onHalfOpen();
                }
            }
            else {
                throw new Error(`Circuit breaker ${this.name} is OPEN`);
            }
        }
        try {
            const result = await operation();
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onFailure();
            throw error;
        }
    }
    shouldAttemptReset() {
        if (!this.lastFailureTime) {
            return true;
        }
        const elapsed = Date.now() - this.lastFailureTime.getTime();
        return elapsed >= this.config.resetTimeout;
    }
    onSuccess() {
        if (this.state === CircuitBreakerState.HALF_OPEN) {
            this.successfulRequests++;
            if (this.successfulRequests >= this.config.halfOpenRequests) {
                this.close();
            }
        }
        else {
            this.failures = 0;
        }
    }
    onFailure() {
        this.failures++;
        this.lastFailureTime = new Date();
        if (this.state === CircuitBreakerState.HALF_OPEN) {
            this.open();
        }
        else if (this.failures >= this.config.threshold) {
            this.open();
        }
    }
    open() {
        this.state = CircuitBreakerState.OPEN;
        this.emit('open');
        if (this.config.onOpen) {
            this.config.onOpen();
        }
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
    close() {
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
    getState() {
        return this.state;
    }
    getStats() {
        return {
            state: this.state,
            failures: this.failures,
            lastFailureTime: this.lastFailureTime,
            successfulRequests: this.successfulRequests
        };
    }
    reset() {
        this.close();
    }
}
exports.CircuitBreaker = CircuitBreaker;
//# sourceMappingURL=ErrorHandler.js.map