import * as v8 from 'v8';
import * as os from 'os';

/**
 * Memory monitoring utility for performance tests
 */
export class MemoryMonitor {
  private trackers: Map<string, MemoryTracker> = new Map();
  private intervalId: NodeJS.Timeout | null = null;
  private samplingInterval: number = 100; // ms

  /**
   * Get current memory usage
   */
  getCurrentUsage(): number {
    const usage = process.memoryUsage();
    return usage.heapUsed + usage.external;
  }

  /**
   * Get detailed memory info
   */
  getDetailedInfo(): MemoryInfo {
    const usage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();
    const heapSpaces = v8.getHeapSpaceStatistics();

    return {
      process: {
        rss: usage.rss,
        heapTotal: usage.heapTotal,
        heapUsed: usage.heapUsed,
        external: usage.external,
        arrayBuffers: usage.arrayBuffers,
      },
      heap: {
        totalHeapSize: heapStats.total_heap_size,
        totalHeapSizeExecutable: heapStats.total_heap_size_executable,
        totalPhysicalSize: heapStats.total_physical_size,
        totalAvailableSize: heapStats.total_available_size,
        usedHeapSize: heapStats.used_heap_size,
        heapSizeLimit: heapStats.heap_size_limit,
        mallocedMemory: heapStats.malloced_memory,
        peakMallocedMemory: heapStats.peak_malloced_memory,
        doesZapGarbage: heapStats.does_zap_garbage,
      },
      spaces: heapSpaces.map(space => ({
        spaceName: space.space_name,
        spaceSize: space.space_size,
        spaceUsedSize: space.space_used_size,
        spaceAvailableSize: space.space_available_size,
        physicalSpaceSize: space.physical_space_size,
      })),
      system: {
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        usedMemory: os.totalmem() - os.freemem(),
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Start tracking memory for a label
   */
  startTracking(label: string): void {
    const tracker: MemoryTracker = {
      label,
      startTime: Date.now(),
      startMemory: this.getCurrentUsage(),
      samples: [],
      peak: 0,
      isActive: true,
    };

    this.trackers.set(label, tracker);

    // Start sampling if not already running
    if (!this.intervalId) {
      this.startSampling();
    }
  }

  /**
   * Stop tracking memory for a label
   */
  stopTracking(label: string): MemoryMetrics {
    const tracker = this.trackers.get(label);
    if (!tracker) {
      throw new Error(`No tracker found for label: ${label}`);
    }

    tracker.isActive = false;
    tracker.endTime = Date.now();
    tracker.endMemory = this.getCurrentUsage();

    // Calculate metrics
    const metrics = this.calculateMetrics(tracker);

    // Stop sampling if no active trackers
    if (this.getActiveTrackerCount() === 0 && this.intervalId) {
      this.stopSampling();
    }

    return metrics;
  }

  /**
   * Track memory for async operation
   */
  async trackAsync<T>(
    label: string,
    operation: () => Promise<T>
  ): Promise<{ result: T; metrics: MemoryMetrics }> {
    this.startTracking(label);
    try {
      const result = await operation();
      const metrics = this.stopTracking(label);
      return { result, metrics };
    } catch (error) {
      this.stopTracking(label);
      throw error;
    }
  }

  /**
   * Track memory for sync operation
   */
  trackSync<T>(
    label: string,
    operation: () => T
  ): { result: T; metrics: MemoryMetrics } {
    this.startTracking(label);
    try {
      const result = operation();
      const metrics = this.stopTracking(label);
      return { result, metrics };
    } catch (error) {
      this.stopTracking(label);
      throw error;
    }
  }

  /**
   * Start memory sampling
   */
  private startSampling(): void {
    this.intervalId = setInterval(() => {
      const currentMemory = this.getCurrentUsage();
      const timestamp = Date.now();

      for (const [, tracker] of this.trackers) {
        if (tracker.isActive) {
          tracker.samples.push({ memory: currentMemory, timestamp });
          tracker.peak = Math.max(tracker.peak, currentMemory);
        }
      }
    }, this.samplingInterval);
  }

  /**
   * Stop memory sampling
   */
  private stopSampling(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Get active tracker count
   */
  private getActiveTrackerCount(): number {
    let count = 0;
    for (const [, tracker] of this.trackers) {
      if (tracker.isActive) count++;
    }
    return count;
  }

  /**
   * Calculate metrics for a tracker
   */
  private calculateMetrics(tracker: MemoryTracker): MemoryMetrics {
    const duration = (tracker.endTime || Date.now()) - tracker.startTime;
    const memoryDelta = (tracker.endMemory || this.getCurrentUsage()) - tracker.startMemory;
    
    // Calculate average from samples
    let average = tracker.startMemory;
    if (tracker.samples.length > 0) {
      const sum = tracker.samples.reduce((acc, sample) => acc + sample.memory, 0);
      average = sum / tracker.samples.length;
    }

    // Find min memory
    let min = tracker.startMemory;
    for (const sample of tracker.samples) {
      min = Math.min(min, sample.memory);
    }

    return {
      label: tracker.label,
      duration,
      startMemory: tracker.startMemory,
      endMemory: tracker.endMemory || this.getCurrentUsage(),
      peak: tracker.peak || tracker.startMemory,
      average,
      min,
      delta: memoryDelta,
      samples: tracker.samples.length,
    };
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Record<string, MemoryMetrics> {
    const metrics: Record<string, MemoryMetrics> = {};

    for (const [label, tracker] of this.trackers) {
      metrics[label] = this.calculateMetrics(tracker);
    }

    return metrics;
  }

  /**
   * Force garbage collection (if available)
   */
  forceGC(): boolean {
    if (global.gc) {
      global.gc();
      return true;
    }
    return false;
  }

  /**
   * Monitor memory leaks
   */
  async checkForLeaks(
    operation: () => Promise<void>,
    iterations: number = 10,
    threshold: number = 10 * 1024 * 1024 // 10MB
  ): Promise<LeakCheckResult> {
    const measurements: number[] = [];

    // Warm up
    await operation();
    this.forceGC();

    // Take baseline
    const baseline = this.getCurrentUsage();

    // Run iterations
    for (let i = 0; i < iterations; i++) {
      await operation();
      this.forceGC();
      
      // Allow time for GC
      await new Promise(resolve => setTimeout(resolve, 100));
      
      measurements.push(this.getCurrentUsage());
    }

    // Analyze trend
    const trend = this.analyzeTrend(measurements);
    const totalGrowth = measurements[measurements.length - 1] - baseline;
    const averageGrowth = totalGrowth / iterations;

    return {
      hasLeak: totalGrowth > threshold,
      baseline,
      finalMemory: measurements[measurements.length - 1],
      totalGrowth,
      averageGrowthPerIteration: averageGrowth,
      measurements,
      trend,
    };
  }

  /**
   * Analyze memory trend
   */
  private analyzeTrend(measurements: number[]): MemoryTrend {
    if (measurements.length < 2) {
      return { slope: 0, intercept: 0, r2: 0 };
    }

    // Simple linear regression
    const n = measurements.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = measurements;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
    const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
    const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const yMean = sumY / n;
    const ssTotal = y.reduce((acc, yi) => acc + Math.pow(yi - yMean, 2), 0);
    const ssResidual = y.reduce((acc, yi, i) => {
      const predicted = slope * i + intercept;
      return acc + Math.pow(yi - predicted, 2);
    }, 0);
    const r2 = 1 - (ssResidual / ssTotal);

    return { slope, intercept, r2 };
  }

  /**
   * Generate memory report
   */
  generateReport(): MemoryReport {
    const info = this.getDetailedInfo();
    const metrics = this.getAllMetrics();

    return {
      timestamp: new Date().toISOString(),
      info,
      metrics,
      summary: {
        totalTrackers: this.trackers.size,
        activeTrackers: this.getActiveTrackerCount(),
        totalSamples: Object.values(metrics).reduce((sum, m) => sum + m.samples, 0),
      },
    };
  }

  /**
   * Clear all trackers
   */
  clear(): void {
    this.stopSampling();
    this.trackers.clear();
  }

  /**
   * Set sampling interval
   */
  setSamplingInterval(ms: number): void {
    this.samplingInterval = ms;
    
    // Restart sampling if active
    if (this.intervalId) {
      this.stopSampling();
      this.startSampling();
    }
  }
}

// Type definitions
interface MemoryTracker {
  label: string;
  startTime: number;
  startMemory: number;
  endTime?: number;
  endMemory?: number;
  samples: Array<{ memory: number; timestamp: number }>;
  peak: number;
  isActive: boolean;
}

interface MemoryMetrics {
  label: string;
  duration: number;
  startMemory: number;
  endMemory: number;
  peak: number;
  average: number;
  min: number;
  delta: number;
  samples: number;
}

interface MemoryInfo {
  process: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  heap: {
    totalHeapSize: number;
    totalHeapSizeExecutable: number;
    totalPhysicalSize: number;
    totalAvailableSize: number;
    usedHeapSize: number;
    heapSizeLimit: number;
    mallocedMemory: number;
    peakMallocedMemory: number;
    doesZapGarbage: number;
  };
  spaces: Array<{
    spaceName: string;
    spaceSize: number;
    spaceUsedSize: number;
    spaceAvailableSize: number;
    physicalSpaceSize: number;
  }>;
  system: {
    totalMemory: number;
    freeMemory: number;
    usedMemory: number;
  };
  timestamp: number;
}

interface LeakCheckResult {
  hasLeak: boolean;
  baseline: number;
  finalMemory: number;
  totalGrowth: number;
  averageGrowthPerIteration: number;
  measurements: number[];
  trend: MemoryTrend;
}

interface MemoryTrend {
  slope: number;
  intercept: number;
  r2: number;
}

interface MemoryReport {
  timestamp: string;
  info: MemoryInfo;
  metrics: Record<string, MemoryMetrics>;
  summary: {
    totalTrackers: number;
    activeTrackers: number;
    totalSamples: number;
  };
}