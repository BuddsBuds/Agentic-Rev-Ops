import { performance, PerformanceObserver } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Performance profiling utility for tests
 */
export class PerformanceProfiler {
  private marks: Map<string, number> = new Map();
  private measures: Map<string, PerformanceMeasure[]> = new Map();
  private observer: PerformanceObserver | null = null;
  private gcStats: GCStats[] = [];

  constructor() {
    this.setupObserver();
  }

  private setupObserver(): void {
    // Monitor garbage collection if available
    if (performance.nodeTiming) {
      this.observer = new PerformanceObserver((items) => {
        items.getEntries().forEach((entry) => {
          if (entry.entryType === 'gc') {
            this.gcStats.push({
              timestamp: Date.now(),
              duration: entry.duration,
              type: (entry as any).kind,
            });
          }
        });
      });

      try {
        this.observer.observe({ entryTypes: ['gc'] });
      } catch (error) {
        // GC monitoring not available
      }
    }
  }

  /**
   * Start timing an operation
   */
  start(label: string): void {
    this.marks.set(label, performance.now());
    performance.mark(`${label}-start`);
  }

  /**
   * Stop timing an operation
   */
  stop(label: string): PerformanceMetrics {
    const startTime = this.marks.get(label);
    if (!startTime) {
      throw new Error(`No start mark found for label: ${label}`);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    performance.mark(`${label}-end`);
    performance.measure(label, `${label}-start`, `${label}-end`);

    // Store measure
    if (!this.measures.has(label)) {
      this.measures.set(label, []);
    }

    const measure: PerformanceMeasure = {
      label,
      startTime,
      endTime,
      duration,
      timestamp: Date.now(),
    };

    this.measures.get(label)!.push(measure);
    this.marks.delete(label);

    return {
      label,
      duration,
      startTime,
      endTime,
    };
  }

  /**
   * Measure async operation
   */
  async measureAsync<T>(
    label: string,
    operation: () => Promise<T>
  ): Promise<{ result: T; metrics: PerformanceMetrics }> {
    this.start(label);
    try {
      const result = await operation();
      const metrics = this.stop(label);
      return { result, metrics };
    } catch (error) {
      this.stop(label); // Still record failed operations
      throw error;
    }
  }

  /**
   * Measure sync operation
   */
  measureSync<T>(
    label: string,
    operation: () => T
  ): { result: T; metrics: PerformanceMetrics } {
    this.start(label);
    try {
      const result = operation();
      const metrics = this.stop(label);
      return { result, metrics };
    } catch (error) {
      this.stop(label); // Still record failed operations
      throw error;
    }
  }

  /**
   * Get statistics for a label
   */
  getStats(label: string): PerformanceStats | null {
    const measures = this.measures.get(label);
    if (!measures || measures.length === 0) {
      return null;
    }

    const durations = measures.map(m => m.duration);
    const sorted = [...durations].sort((a, b) => a - b);

    return {
      label,
      count: durations.length,
      total: durations.reduce((a, b) => a + b, 0),
      average: durations.reduce((a, b) => a + b, 0) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      stdDev: this.calculateStdDev(durations),
    };
  }

  /**
   * Get all statistics
   */
  getAllStats(): Record<string, PerformanceStats> {
    const stats: Record<string, PerformanceStats> = {};

    for (const [label] of this.measures) {
      const stat = this.getStats(label);
      if (stat) {
        stats[label] = stat;
      }
    }

    return stats;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[]): number {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
  }

  /**
   * Generate performance report
   */
  generateReport(outputPath?: string): PerformanceReport {
    const report: PerformanceReport = {
      timestamp: new Date().toISOString(),
      duration: this.getTotalDuration(),
      operations: this.getAllStats(),
      gcStats: this.getGCStats(),
      summary: this.generateSummary(),
    };

    if (outputPath) {
      fs.writeFileSync(
        outputPath,
        JSON.stringify(report, null, 2),
        'utf-8'
      );
    }

    return report;
  }

  /**
   * Get total duration
   */
  private getTotalDuration(): number {
    let minStart = Infinity;
    let maxEnd = -Infinity;

    for (const measures of this.measures.values()) {
      for (const measure of measures) {
        minStart = Math.min(minStart, measure.startTime);
        maxEnd = Math.max(maxEnd, measure.endTime);
      }
    }

    return maxEnd - minStart;
  }

  /**
   * Get GC statistics
   */
  private getGCStats(): GCSummary {
    if (this.gcStats.length === 0) {
      return {
        count: 0,
        totalDuration: 0,
        averageDuration: 0,
        maxDuration: 0,
      };
    }

    const durations = this.gcStats.map(gc => gc.duration);

    return {
      count: this.gcStats.length,
      totalDuration: durations.reduce((a, b) => a + b, 0),
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      maxDuration: Math.max(...durations),
    };
  }

  /**
   * Generate summary
   */
  private generateSummary(): PerformanceSummary {
    const stats = this.getAllStats();
    const operations = Object.values(stats);

    if (operations.length === 0) {
      return {
        totalOperations: 0,
        totalDuration: 0,
        averageOperationTime: 0,
        slowestOperation: null,
        fastestOperation: null,
      };
    }

    const totalOps = operations.reduce((sum, op) => sum + op.count, 0);
    const totalDuration = operations.reduce((sum, op) => sum + op.total, 0);

    const slowest = operations.reduce((prev, curr) => 
      prev.max > curr.max ? prev : curr
    );

    const fastest = operations.reduce((prev, curr) => 
      prev.min < curr.min ? prev : curr
    );

    return {
      totalOperations: totalOps,
      totalDuration,
      averageOperationTime: totalDuration / totalOps,
      slowestOperation: {
        label: slowest.label,
        duration: slowest.max,
      },
      fastestOperation: {
        label: fastest.label,
        duration: fastest.min,
      },
    };
  }

  /**
   * Compare two performance runs
   */
  static compareReports(
    baseline: PerformanceReport,
    current: PerformanceReport
  ): PerformanceComparison {
    const comparison: PerformanceComparison = {
      timestamp: new Date().toISOString(),
      baseline: baseline.timestamp,
      current: current.timestamp,
      operations: {},
      summary: {
        totalOperationsChange: 
          ((current.summary.totalOperations - baseline.summary.totalOperations) / 
           baseline.summary.totalOperations) * 100,
        totalDurationChange:
          ((current.summary.totalDuration - baseline.summary.totalDuration) / 
           baseline.summary.totalDuration) * 100,
        averageOperationTimeChange:
          ((current.summary.averageOperationTime - baseline.summary.averageOperationTime) / 
           baseline.summary.averageOperationTime) * 100,
      },
    };

    // Compare operations
    for (const [label, currentOp] of Object.entries(current.operations)) {
      const baselineOp = baseline.operations[label];
      if (baselineOp) {
        comparison.operations[label] = {
          averageChange: ((currentOp.average - baselineOp.average) / baselineOp.average) * 100,
          minChange: ((currentOp.min - baselineOp.min) / baselineOp.min) * 100,
          maxChange: ((currentOp.max - baselineOp.max) / baselineOp.max) * 100,
          p95Change: ((currentOp.p95 - baselineOp.p95) / baselineOp.p95) * 100,
          p99Change: ((currentOp.p99 - baselineOp.p99) / baselineOp.p99) * 100,
        };
      }
    }

    return comparison;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.marks.clear();
    this.measures.clear();
    this.gcStats = [];
    performance.clearMarks();
    performance.clearMeasures();
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.clear();
  }
}

// Type definitions
interface PerformanceMeasure {
  label: string;
  startTime: number;
  endTime: number;
  duration: number;
  timestamp: number;
}

interface PerformanceMetrics {
  label: string;
  duration: number;
  startTime: number;
  endTime: number;
}

interface PerformanceStats {
  label: string;
  count: number;
  total: number;
  average: number;
  min: number;
  max: number;
  median: number;
  p95: number;
  p99: number;
  stdDev: number;
}

interface GCStats {
  timestamp: number;
  duration: number;
  type: number;
}

interface GCSummary {
  count: number;
  totalDuration: number;
  averageDuration: number;
  maxDuration: number;
}

interface PerformanceSummary {
  totalOperations: number;
  totalDuration: number;
  averageOperationTime: number;
  slowestOperation: { label: string; duration: number } | null;
  fastestOperation: { label: string; duration: number } | null;
}

interface PerformanceReport {
  timestamp: string;
  duration: number;
  operations: Record<string, PerformanceStats>;
  gcStats: GCSummary;
  summary: PerformanceSummary;
}

interface PerformanceComparison {
  timestamp: string;
  baseline: string;
  current: string;
  operations: Record<string, {
    averageChange: number;
    minChange: number;
    maxChange: number;
    p95Change: number;
    p99Change: number;
  }>;
  summary: {
    totalOperationsChange: number;
    totalDurationChange: number;
    averageOperationTimeChange: number;
  };
}