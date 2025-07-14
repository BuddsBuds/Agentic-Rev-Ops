"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceOptimizer = exports.AlertType = exports.OptimizationType = void 0;
const events_1 = require("events");
const uuid_1 = require("uuid");
var OptimizationType;
(function (OptimizationType) {
    OptimizationType["PARALLEL_EXECUTION"] = "parallel_execution";
    OptimizationType["CACHING"] = "caching";
    OptimizationType["BATCH_PROCESSING"] = "batch_processing";
    OptimizationType["RESOURCE_POOLING"] = "resource_pooling";
    OptimizationType["TIMEOUT_ADJUSTMENT"] = "timeout_adjustment";
    OptimizationType["RETRY_OPTIMIZATION"] = "retry_optimization";
    OptimizationType["STEP_ELIMINATION"] = "step_elimination";
    OptimizationType["STEP_REORDERING"] = "step_reordering";
    OptimizationType["LOAD_BALANCING"] = "load_balancing";
    OptimizationType["CIRCUIT_BREAKER"] = "circuit_breaker";
})(OptimizationType || (exports.OptimizationType = OptimizationType = {}));
var AlertType;
(function (AlertType) {
    AlertType["SLOW_EXECUTION"] = "slow_execution";
    AlertType["HIGH_ERROR_RATE"] = "high_error_rate";
    AlertType["RESOURCE_EXHAUSTION"] = "resource_exhaustion";
    AlertType["QUEUE_BACKUP"] = "queue_backup";
    AlertType["SLA_BREACH"] = "sla_breach";
    AlertType["DEGRADED_PERFORMANCE"] = "degraded_performance";
})(AlertType || (exports.AlertType = AlertType = {}));
class PerformanceOptimizer extends events_1.EventEmitter {
    metrics = new Map();
    workflowMetrics = new Map();
    alerts = new Map();
    optimizations = new Map();
    metricsRetentionDays = 7;
    samplingInterval = 1000;
    analysisInterval = 60000;
    isMonitoring = false;
    monitoringInterval;
    analysisTimeout;
    constructor() {
        super();
        this.setupDefaultThresholds();
    }
    thresholds = {
        executionTime: {
            warning: 5000,
            critical: 30000
        },
        errorRate: {
            warning: 0.05,
            critical: 0.1
        },
        cpuUsage: {
            warning: 0.7,
            critical: 0.9
        },
        memoryUsage: {
            warning: 0.8,
            critical: 0.95
        },
        queueDepth: {
            warning: 100,
            critical: 500
        }
    };
    setupDefaultThresholds() {
    }
    startMonitoring() {
        if (this.isMonitoring)
            return;
        this.isMonitoring = true;
        this.monitoringInterval = setInterval(() => {
            this.collectMetrics();
        }, this.samplingInterval);
        this.analysisTimeout = setInterval(() => {
            this.analyzePerformance();
        }, this.analysisInterval);
        this.emit('monitoring:started');
    }
    stopMonitoring() {
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
    collectMetrics() {
        const metrics = {
            executionTime: 0,
            cpuUsage: process.cpuUsage().user / 1000000,
            memoryUsage: process.memoryUsage().heapUsed,
            throughput: this.calculateThroughput(),
            latency: this.calculateLatency(),
            errorRate: this.calculateErrorRate(),
            successRate: this.calculateSuccessRate(),
            concurrency: this.getCurrentConcurrency(),
            queueDepth: this.getQueueDepth(),
            timestamp: new Date()
        };
        const key = 'system';
        if (!this.metrics.has(key)) {
            this.metrics.set(key, []);
        }
        this.metrics.get(key).push(metrics);
        this.checkThresholds(metrics);
        this.cleanupOldMetrics();
    }
    recordWorkflowExecution(workflowId, workflowName, executionTime, success, stepExecutions) {
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
        metrics.executions++;
        metrics.averageExecutionTime =
            ((metrics.averageExecutionTime * (metrics.executions - 1)) + executionTime) /
                metrics.executions;
        metrics.minExecutionTime = Math.min(metrics.minExecutionTime, executionTime);
        metrics.maxExecutionTime = Math.max(metrics.maxExecutionTime, executionTime);
        const successCount = Math.round(metrics.successRate * (metrics.executions - 1));
        metrics.successRate = (successCount + (success ? 1 : 0)) / metrics.executions;
        metrics.errorRate = 1 - metrics.successRate;
        if (stepExecutions) {
            for (const [stepId, stepData] of stepExecutions.entries()) {
                this.updateStepMetrics(metrics, stepId, stepData);
            }
        }
        metrics.lastUpdated = new Date();
        this.detectPerformanceIssues(metrics);
    }
    updateStepMetrics(workflowMetrics, stepId, stepData) {
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
    analyzePerformance() {
        const analysis = {
            id: (0, uuid_1.v4)(),
            timestamp: new Date(),
            bottlenecks: [],
            overallImpact: 0,
            recommendations: []
        };
        for (const [workflowId, metrics] of this.workflowMetrics.entries()) {
            const bottlenecks = this.identifyBottlenecks(workflowId, metrics);
            analysis.bottlenecks.push(...bottlenecks);
        }
        analysis.bottlenecks.sort((a, b) => b.impactScore - a.impactScore);
        analysis.overallImpact = analysis.bottlenecks.reduce((sum, b) => sum + b.impactScore, 0) / analysis.bottlenecks.length || 0;
        analysis.recommendations = this.generateOptimizationSuggestions(analysis.bottlenecks);
        if (analysis.bottlenecks.length > 0) {
            this.emit('analysis:complete', analysis);
        }
        this.applyAutoOptimizations(analysis);
    }
    identifyBottlenecks(workflowId, metrics) {
        const bottlenecks = [];
        for (const [stepId, stepMetrics] of metrics.stepMetrics.entries()) {
            if (stepMetrics.averageExecutionTime > this.thresholds.executionTime.warning) {
                bottlenecks.push({
                    type: 'step',
                    identifier: stepId,
                    description: `Step ${stepMetrics.name} is slow`,
                    impactScore: this.calculateImpactScore(stepMetrics.averageExecutionTime, stepMetrics.executions, metrics.executions),
                    frequency: stepMetrics.executions,
                    averageDelay: stepMetrics.averageExecutionTime,
                    affectedWorkflows: [workflowId]
                });
            }
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
            if (stepMetrics.retryRate > 0.2) {
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
        const systemMetrics = this.metrics.get('system') || [];
        const recentMetrics = systemMetrics.slice(-10);
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
    calculateImpactScore(executionTime, stepExecutions, totalExecutions) {
        const timeImpact = Math.min(executionTime / this.thresholds.executionTime.critical, 1);
        const frequencyImpact = stepExecutions / totalExecutions;
        return (timeImpact * 0.7 + frequencyImpact * 0.3) * 100;
    }
    generateOptimizationSuggestions(bottlenecks) {
        const suggestions = [];
        const stepBottlenecks = bottlenecks.filter(b => b.type === 'step');
        const resourceBottlenecks = bottlenecks.filter(b => b.type === 'resource');
        if (stepBottlenecks.length > 1) {
            const sequentialSteps = this.identifySequentialSteps(stepBottlenecks);
            if (sequentialSteps.length > 2) {
                suggestions.push({
                    id: (0, uuid_1.v4)(),
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
        const repeatableSteps = stepBottlenecks.filter(b => b.frequency > 10);
        if (repeatableSteps.length > 0) {
            suggestions.push({
                id: (0, uuid_1.v4)(),
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
        const cpuBottleneck = resourceBottlenecks.find(b => b.identifier === 'cpu');
        if (cpuBottleneck) {
            suggestions.push({
                id: (0, uuid_1.v4)(),
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
        const errorProneSteps = stepBottlenecks.filter(b => b.description.includes('error rate'));
        if (errorProneSteps.length > 0) {
            suggestions.push({
                id: (0, uuid_1.v4)(),
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
    identifySequentialSteps(bottlenecks) {
        return bottlenecks
            .filter(b => b.averageDelay > 1000)
            .map(b => b.identifier);
    }
    applyAutoOptimizations(analysis) {
        for (const suggestion of analysis.recommendations) {
            if (suggestion.severity === 'high' && suggestion.estimatedImprovement > 30) {
                this.applyOptimization(suggestion);
            }
        }
    }
    applyOptimization(suggestion) {
        switch (suggestion.type) {
            case OptimizationType.TIMEOUT_ADJUSTMENT:
                this.adjustTimeouts(suggestion);
                break;
            case OptimizationType.RETRY_OPTIMIZATION:
                this.optimizeRetries(suggestion);
                break;
            default:
                this.emit('optimization:suggested', suggestion);
        }
    }
    adjustTimeouts(suggestion) {
        this.emit('optimization:applied', {
            type: 'timeout_adjustment',
            suggestion
        });
    }
    optimizeRetries(suggestion) {
        this.emit('optimization:applied', {
            type: 'retry_optimization',
            suggestion
        });
    }
    checkThresholds(metrics) {
        if (metrics.executionTime > this.thresholds.executionTime.critical) {
            this.createAlert(AlertType.SLOW_EXECUTION, 'critical', 'executionTime', this.thresholds.executionTime.critical, metrics.executionTime, 'Critical: Execution time exceeds threshold');
        }
        else if (metrics.executionTime > this.thresholds.executionTime.warning) {
            this.createAlert(AlertType.SLOW_EXECUTION, 'warning', 'executionTime', this.thresholds.executionTime.warning, metrics.executionTime, 'Warning: Execution time is high');
        }
        if (metrics.errorRate > this.thresholds.errorRate.critical) {
            this.createAlert(AlertType.HIGH_ERROR_RATE, 'critical', 'errorRate', this.thresholds.errorRate.critical, metrics.errorRate, 'Critical: Error rate exceeds threshold');
        }
        if (metrics.cpuUsage > this.thresholds.cpuUsage.critical) {
            this.createAlert(AlertType.RESOURCE_EXHAUSTION, 'critical', 'cpuUsage', this.thresholds.cpuUsage.critical, metrics.cpuUsage, 'Critical: CPU usage is too high');
        }
        if (metrics.queueDepth > this.thresholds.queueDepth.critical) {
            this.createAlert(AlertType.QUEUE_BACKUP, 'critical', 'queueDepth', this.thresholds.queueDepth.critical, metrics.queueDepth, 'Critical: Queue is backing up');
        }
    }
    createAlert(type, severity, metric, threshold, actualValue, message, workflowId, stepId) {
        const alert = {
            id: (0, uuid_1.v4)(),
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
        setTimeout(() => {
            this.checkAlertResolution(alert);
        }, 60000);
    }
    checkAlertResolution(alert) {
        const currentMetrics = this.metrics.get('system')?.slice(-1)[0];
        if (!currentMetrics)
            return;
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
    getTrends(metric, timeRange) {
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
    getDataPointsForTimeRange(metric, timeRange) {
        const systemMetrics = this.metrics.get('system') || [];
        const cutoffTime = this.getCutoffTime(timeRange);
        return systemMetrics
            .filter(m => m.timestamp > cutoffTime)
            .map(m => ({
            timestamp: m.timestamp,
            value: m[metric],
            anomaly: this.isAnomaly(m[metric], metric)
        }));
    }
    getCutoffTime(timeRange) {
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
    calculateTrend(dataPoints) {
        if (dataPoints.length < 2)
            return 'stable';
        const n = dataPoints.length;
        const x = dataPoints.map((_, i) => i);
        const y = dataPoints.map(d => d.value);
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
        const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        if (Math.abs(slope) < 0.01)
            return 'stable';
        return slope > 0 ? 'degrading' : 'improving';
    }
    calculateChangePercentage(dataPoints) {
        if (dataPoints.length < 2)
            return 0;
        const first = dataPoints[0].value;
        const last = dataPoints[dataPoints.length - 1].value;
        return ((last - first) / first) * 100;
    }
    forecastNextPeriod(dataPoints) {
        if (dataPoints.length < 10)
            return undefined;
        const recentPoints = dataPoints.slice(-5);
        const average = recentPoints.reduce((sum, p) => sum + p.value, 0) / recentPoints.length;
        const variance = recentPoints.reduce((sum, p) => sum + Math.pow(p.value - average, 2), 0) / recentPoints.length;
        const stdDev = Math.sqrt(variance);
        return {
            nextPeriod: average,
            confidence: 0.8,
            upperBound: average + 1.96 * stdDev,
            lowerBound: Math.max(0, average - 1.96 * stdDev)
        };
    }
    isAnomaly(value, metric) {
        const threshold = this.thresholds[metric];
        if (!threshold)
            return false;
        return value > threshold.warning;
    }
    calculateThroughput() {
        const recentExecutions = Array.from(this.workflowMetrics.values())
            .reduce((sum, m) => sum + m.executions, 0);
        return recentExecutions / (this.analysisInterval / 1000);
    }
    calculateLatency() {
        const recentExecutions = Array.from(this.workflowMetrics.values());
        if (recentExecutions.length === 0)
            return 0;
        const totalLatency = recentExecutions.reduce((sum, m) => sum + m.averageExecutionTime, 0);
        return totalLatency / recentExecutions.length;
    }
    calculateErrorRate() {
        const recentExecutions = Array.from(this.workflowMetrics.values());
        if (recentExecutions.length === 0)
            return 0;
        const totalErrors = recentExecutions.reduce((sum, m) => sum + (m.errorRate * m.executions), 0);
        const totalExecutions = recentExecutions.reduce((sum, m) => sum + m.executions, 0);
        return totalExecutions > 0 ? totalErrors / totalExecutions : 0;
    }
    calculateSuccessRate() {
        return 1 - this.calculateErrorRate();
    }
    getCurrentConcurrency() {
        return 0;
    }
    getQueueDepth() {
        return 0;
    }
    cleanupOldMetrics() {
        const cutoffTime = new Date(Date.now() - this.metricsRetentionDays * 86400000);
        for (const [key, metrics] of this.metrics.entries()) {
            const filtered = metrics.filter(m => m.timestamp > cutoffTime);
            if (filtered.length < metrics.length) {
                this.metrics.set(key, filtered);
            }
        }
    }
    detectPerformanceIssues(metrics) {
        if (metrics.averageExecutionTime > this.thresholds.executionTime.warning) {
            this.createAlert(AlertType.SLOW_EXECUTION, 'warning', 'averageExecutionTime', this.thresholds.executionTime.warning, metrics.averageExecutionTime, `Workflow ${metrics.name} is running slowly`, metrics.workflowId);
        }
        if (metrics.errorRate > this.thresholds.errorRate.warning) {
            this.createAlert(AlertType.HIGH_ERROR_RATE, 'warning', 'errorRate', this.thresholds.errorRate.warning, metrics.errorRate, `Workflow ${metrics.name} has high error rate`, metrics.workflowId);
        }
    }
    getWorkflowMetrics(workflowId) {
        return this.workflowMetrics.get(workflowId);
    }
    getAllWorkflowMetrics() {
        return Array.from(this.workflowMetrics.values());
    }
    getAlerts(filter) {
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
    getOptimizationSuggestions() {
        return Array.from(this.optimizations.values());
    }
    acknowledgeAlert(alertId) {
        const alert = this.alerts.get(alertId);
        if (alert) {
            alert.resolved = true;
            this.emit('alert:acknowledged', alert);
        }
    }
    setThreshold(metric, level, value) {
        if (this.thresholds[metric]) {
            this.thresholds[metric][level] = value;
            this.emit('threshold:updated', { metric, level, value });
        }
    }
}
exports.PerformanceOptimizer = PerformanceOptimizer;
//# sourceMappingURL=PerformanceOptimizer.js.map