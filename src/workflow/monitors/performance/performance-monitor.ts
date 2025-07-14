// Performance Monitor Module
import { EventEmitter } from 'events';

export interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface PerformanceMonitor {
  startMonitoring(): void;
  stopMonitoring(): void;
  recordMetric(metric: PerformanceMetric): void;
  getMetrics(filter?: any): PerformanceMetric[];
  clearMetrics(): void;
  start(): void;
  stop(): void;
  getWorkflowMetrics(workflowId?: string): PerformanceMetric[];
  on(event: string, listener: (...args: any[]) => void): this;
}

export class WorkflowPerformanceMonitor extends EventEmitter implements PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;

  startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    
    // Monitor system metrics every 5 seconds
    this.monitoringInterval = setInterval(() => {
      this.captureSystemMetrics();
    }, 5000);

    this.emit('monitoring:started');
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.emit('monitoring:stopped');
  }

  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    this.emit('metric:recorded', metric);

    // Keep only last 1000 metrics to prevent memory issues
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  getMetrics(filter?: any): PerformanceMetric[] {
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

  clearMetrics(): void {
    this.metrics = [];
    this.emit('metrics:cleared');
  }

  // Helper methods
  private captureSystemMetrics(): void {
    // CPU usage
    this.recordMetric({
      id: Date.now().toString(),
      name: 'cpu_usage',
      value: process.cpuUsage().user / 1000000, // Convert to seconds
      unit: 'seconds',
      timestamp: new Date()
    });

    // Memory usage
    const memUsage = process.memoryUsage();
    this.recordMetric({
      id: Date.now().toString() + '_mem',
      name: 'memory_usage',
      value: memUsage.heapUsed / 1024 / 1024, // Convert to MB
      unit: 'MB',
      timestamp: new Date()
    });
  }

  // Analysis methods
  getAverageMetric(name: string, timeWindow?: number): number | null {
    const cutoff = timeWindow ? new Date(Date.now() - timeWindow) : null;
    const relevantMetrics = this.metrics.filter(m => {
      if (m.name !== name) return false;
      if (cutoff && m.timestamp < cutoff) return false;
      return true;
    });

    if (relevantMetrics.length === 0) return null;
    
    const sum = relevantMetrics.reduce((acc, m) => acc + m.value, 0);
    return sum / relevantMetrics.length;
  }

  getMetricTrend(name: string, points: number = 10): Array<{ timestamp: Date; value: number }> {
    const relevantMetrics = this.metrics
      .filter(m => m.name === name)
      .slice(-points)
      .map(m => ({ timestamp: m.timestamp, value: m.value }));
    
    return relevantMetrics;
  }

  start(): void {
    this.startMonitoring();
  }

  stop(): void {
    this.stopMonitoring();
  }

  getWorkflowMetrics(workflowId?: string): PerformanceMetric[] {
    if (!workflowId) {
      return this.getMetrics();
    }
    
    return this.getMetrics({
      tags: { workflowId }
    });
  }
}