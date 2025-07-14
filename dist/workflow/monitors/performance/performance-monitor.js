"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowPerformanceMonitor = void 0;
const events_1 = require("events");
class WorkflowPerformanceMonitor extends events_1.EventEmitter {
    metrics = [];
    isMonitoring = false;
    monitoringInterval;
    startMonitoring() {
        if (this.isMonitoring) {
            return;
        }
        this.isMonitoring = true;
        this.monitoringInterval = setInterval(() => {
            this.captureSystemMetrics();
        }, 5000);
        this.emit('monitoring:started');
    }
    stopMonitoring() {
        this.isMonitoring = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
        }
        this.emit('monitoring:stopped');
    }
    recordMetric(metric) {
        this.metrics.push(metric);
        this.emit('metric:recorded', metric);
        if (this.metrics.length > 1000) {
            this.metrics = this.metrics.slice(-1000);
        }
    }
    getMetrics(filter) {
        if (!filter) {
            return [...this.metrics];
        }
        return this.metrics.filter(metric => {
            if (filter.name && metric.name !== filter.name) {
                return false;
            }
            if (filter.startTime && metric.timestamp < filter.startTime) {
                return false;
            }
            if (filter.endTime && metric.timestamp > filter.endTime) {
                return false;
            }
            if (filter.tags) {
                for (const [key, value] of Object.entries(filter.tags)) {
                    if (metric.tags?.[key] !== value) {
                        return false;
                    }
                }
            }
            return true;
        });
    }
    clearMetrics() {
        this.metrics = [];
        this.emit('metrics:cleared');
    }
    captureSystemMetrics() {
        this.recordMetric({
            id: Date.now().toString(),
            name: 'cpu_usage',
            value: process.cpuUsage().user / 1000000,
            unit: 'seconds',
            timestamp: new Date()
        });
        const memUsage = process.memoryUsage();
        this.recordMetric({
            id: Date.now().toString() + '_mem',
            name: 'memory_usage',
            value: memUsage.heapUsed / 1024 / 1024,
            unit: 'MB',
            timestamp: new Date()
        });
    }
    getAverageMetric(name, timeWindow) {
        const cutoff = timeWindow ? new Date(Date.now() - timeWindow) : null;
        const relevantMetrics = this.metrics.filter(m => {
            if (m.name !== name)
                return false;
            if (cutoff && m.timestamp < cutoff)
                return false;
            return true;
        });
        if (relevantMetrics.length === 0)
            return null;
        const sum = relevantMetrics.reduce((acc, m) => acc + m.value, 0);
        return sum / relevantMetrics.length;
    }
    getMetricTrend(name, points = 10) {
        const relevantMetrics = this.metrics
            .filter(m => m.name === name)
            .slice(-points)
            .map(m => ({ timestamp: m.timestamp, value: m.value }));
        return relevantMetrics;
    }
    start() {
        this.startMonitoring();
    }
    stop() {
        this.stopMonitoring();
    }
    getWorkflowMetrics(workflowId) {
        if (!workflowId) {
            return this.getMetrics();
        }
        return this.getMetrics({
            tags: { workflowId }
        });
    }
}
exports.WorkflowPerformanceMonitor = WorkflowPerformanceMonitor;
//# sourceMappingURL=performance-monitor.js.map