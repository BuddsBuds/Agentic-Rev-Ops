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
export declare class WorkflowPerformanceMonitor extends EventEmitter implements PerformanceMonitor {
    private metrics;
    private isMonitoring;
    private monitoringInterval?;
    startMonitoring(): void;
    stopMonitoring(): void;
    recordMetric(metric: PerformanceMetric): void;
    getMetrics(filter?: any): PerformanceMetric[];
    clearMetrics(): void;
    private captureSystemMetrics;
    getAverageMetric(name: string, timeWindow?: number): number | null;
    getMetricTrend(name: string, points?: number): Array<{
        timestamp: Date;
        value: number;
    }>;
    start(): void;
    stop(): void;
    getWorkflowMetrics(workflowId?: string): PerformanceMetric[];
}
//# sourceMappingURL=performance-monitor.d.ts.map