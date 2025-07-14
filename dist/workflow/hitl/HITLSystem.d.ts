import { EventEmitter } from 'events';
import { HITLConfiguration } from './core/HITLOrchestrator';
import { TrackingConfiguration } from './tracking/ProgressTracker';
import { HITLSwarmConfig } from './integration/SwarmIntegration';
import { SwarmMemory } from '../../swarm/memory/SwarmMemory';
import { SwarmCoordinator } from '../../swarm/coordinator/SwarmCoordinator';
export interface HITLSystemConfig {
    orchestrator: Partial<HITLConfiguration>;
    tracking: Partial<TrackingConfiguration>;
    swarmIntegration: Partial<HITLSwarmConfig>;
    enableComponents: {
        orchestrator: boolean;
        delegation: boolean;
        workflows: boolean;
        tracking: boolean;
        swarmIntegration: boolean;
    };
    systemSettings: {
        name: string;
        version: string;
        environment: 'development' | 'staging' | 'production';
        logLevel: 'debug' | 'info' | 'warn' | 'error';
        enableTelemetry: boolean;
        backupEnabled: boolean;
        maintenanceMode: boolean;
    };
}
export interface HITLSystemStatus {
    status: 'initializing' | 'running' | 'degraded' | 'maintenance' | 'shutdown';
    uptime: number;
    components: {
        orchestrator: ComponentStatus;
        delegation: ComponentStatus;
        workflows: ComponentStatus;
        tracking: ComponentStatus;
        swarmIntegration: ComponentStatus;
    };
    metrics: HITLSystemMetrics;
    alerts: SystemAlert[];
    lastHealthCheck: Date;
}
export interface ComponentStatus {
    name: string;
    status: 'online' | 'offline' | 'degraded' | 'error';
    uptime: number;
    lastError?: Error;
    metrics: any;
}
export interface HITLSystemMetrics {
    totalDecisions: number;
    totalTasks: number;
    totalWorkflows: number;
    averageResolutionTime: number;
    successRate: number;
    currentLoad: number;
    performanceScore: number;
    resourceUtilization: {
        cpu: number;
        memory: number;
        operators: number;
    };
}
export interface SystemAlert {
    id: string;
    level: 'info' | 'warning' | 'error' | 'critical';
    component: string;
    message: string;
    timestamp: Date;
    acknowledged: boolean;
    metadata: any;
}
export declare class HITLSystem extends EventEmitter {
    private config;
    private swarmMemory;
    private swarmCoordinator;
    private hitlManager;
    private orchestrator?;
    private delegationManager?;
    private workflowEngine?;
    private progressTracker?;
    private swarmIntegration?;
    private status;
    private startTime;
    private healthCheckInterval?;
    private metrics;
    private alerts;
    constructor(swarmMemory: SwarmMemory, swarmCoordinator: SwarmCoordinator, config?: Partial<HITLSystemConfig>);
    private buildConfig;
    private initializeMetrics;
    initialize(): Promise<void>;
    private initializeOrchestrator;
    private initializeDelegationManager;
    private initializeWorkflowEngine;
    private initializeProgressTracker;
    private initializeSwarmIntegration;
    private startHealthMonitoring;
    private performHealthCheck;
    getSystemStatus(): HITLSystemStatus;
    private getComponentStatus;
    processSwarmDecision(request: any): Promise<any>;
    createHumanTask(taskData: any): Promise<any>;
    getSystemAnalytics(): any;
    updateConfiguration(newConfig: Partial<HITLSystemConfig>): Promise<void>;
    enableMaintenanceMode(reason: string): Promise<void>;
    disableMaintenanceMode(): Promise<void>;
    shutdown(): Promise<void>;
    private setupEventHandlers;
    private handleProgressAlert;
    private createAlert;
    private log;
    private shouldLog;
    private updateSuccessMetrics;
    private updateTaskMetrics;
    private updateWorkflowMetrics;
    private updateAutoApprovalMetrics;
    private updatePerformanceMetrics;
    private updatePerformanceScore;
    private applyConfigurationChanges;
    acknowledgeAlert(alertId: string, acknowledgedBy: string): void;
    getAlertsByLevel(level: SystemAlert['level']): SystemAlert[];
    clearAcknowledgedAlerts(): void;
    exportSystemState(): Promise<any>;
    getComponent(name: string): any;
    isHealthy(): boolean;
    getSystemInfo(): any;
}
//# sourceMappingURL=HITLSystem.d.ts.map