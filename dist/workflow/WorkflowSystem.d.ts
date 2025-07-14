import { EventEmitter } from 'events';
import { WorkflowEngine } from './core/engine/workflow-engine';
import { WorkflowScheduler } from './core/scheduler/workflow-scheduler';
import { WorkflowOrchestrator } from './core/orchestrator/workflow-orchestrator';
import { ProcessManager } from './core/process/ProcessDefinition';
import { ErrorHandler } from './core/error/ErrorHandler';
import { WorkflowPerformanceMonitor } from './monitors/performance/performance-monitor';
import { HITLSystem } from './hitl/HITLSystem';
import { SwarmMemory } from '../swarm/memory/SwarmMemory';
import { SwarmCoordinator } from '../swarm/coordinator/SwarmCoordinator';
export interface WorkflowSystemConfig {
    name: string;
    version: string;
    environment: 'development' | 'staging' | 'production';
    features: {
        scheduling: boolean;
        processManagement: boolean;
        errorHandling: boolean;
        performanceMonitoring: boolean;
        hitlIntegration: boolean;
        swarmIntegration: boolean;
    };
    performance: {
        maxConcurrentWorkflows: number;
        executionTimeout: number;
        retryPolicy: string;
        caching: boolean;
    };
    persistence: {
        enabled: boolean;
        type: 'memory' | 'database' | 'file';
        config?: any;
    };
}
export interface WorkflowSystemStatus {
    status: 'initializing' | 'running' | 'degraded' | 'maintenance' | 'shutdown';
    uptime: number;
    components: {
        engine: ComponentStatus;
        scheduler: ComponentStatus;
        orchestrator: ComponentStatus;
        processManager: ComponentStatus;
        errorHandler: ComponentStatus;
        performanceMonitor: ComponentStatus;
        hitlSystem?: ComponentStatus;
    };
    metrics: SystemMetrics;
    health: SystemHealth;
}
export interface ComponentStatus {
    name: string;
    status: 'online' | 'offline' | 'degraded' | 'error';
    initialized: boolean;
    lastActivity?: Date;
    error?: Error;
}
export interface SystemMetrics {
    totalWorkflows: number;
    activeWorkflows: number;
    completedWorkflows: number;
    failedWorkflows: number;
    averageExecutionTime: number;
    successRate: number;
    errorRate: number;
    throughput: number;
}
export interface SystemHealth {
    status: 'healthy' | 'warning' | 'critical';
    score: number;
    issues: string[];
    recommendations: string[];
}
export declare class WorkflowSystem extends EventEmitter {
    private config;
    private status;
    private startTime;
    private engine;
    private scheduler;
    private orchestrator;
    private processManager;
    private errorHandler;
    private performanceOptimizer;
    private performanceMonitor;
    private hitlSystem?;
    private swarmMemory?;
    private swarmCoordinator?;
    private isInitialized;
    private healthCheckInterval?;
    private metricsInterval?;
    constructor(config?: Partial<WorkflowSystemConfig>, swarmMemory?: SwarmMemory, swarmCoordinator?: SwarmCoordinator);
    private buildConfig;
    initialize(): Promise<void>;
    private initializeEngine;
    private initializeScheduler;
    private initializeOrchestrator;
    private initializeProcessManager;
    private initializeErrorHandler;
    private initializePerformanceMonitoring;
    private initializeHITL;
    createWorkflow(config: any): Promise<string>;
    executeWorkflow(workflowId: string, context?: any, options?: {
        priority?: number;
        scheduled?: boolean;
    }): Promise<any>;
    scheduleWorkflow(workflowId: string, schedule: string | Date | any, context?: any): Promise<string>;
    createProcess(definition: any): Promise<string>;
    executeProcess(processId: string, context?: any, options?: any): Promise<string>;
    private startSystemMonitoring;
    private performHealthCheck;
    private collectMetrics;
    private calculateSystemHealth;
    private calculateSystemMetrics;
    private handleWorkflowStart;
    private handleWorkflowComplete;
    private handleWorkflowError;
    private handleStepError;
    private ensureInitialized;
    private getComponentStatuses;
    private getActiveWorkflowCount;
    private recordSuccess;
    private recordFailure;
    private setupEventHandlers;
    getSystemStatus(): WorkflowSystemStatus;
    shutdown(): Promise<void>;
    getConfiguration(): WorkflowSystemConfig;
    updateConfiguration(updates: Partial<WorkflowSystemConfig>): void;
    getEngine(): WorkflowEngine;
    getScheduler(): WorkflowScheduler;
    getOrchestrator(): WorkflowOrchestrator;
    getProcessManager(): ProcessManager;
    getErrorHandler(): ErrorHandler;
    getPerformanceMonitor(): WorkflowPerformanceMonitor;
    getHITLSystem(): HITLSystem | undefined;
}
//# sourceMappingURL=WorkflowSystem.d.ts.map