import { EventEmitter } from 'events';
import { WorkflowEngine } from '../engine/workflow-engine';
export interface ScheduledWorkflow {
    id: string;
    workflowId: string;
    schedule: string | Date | ScheduleConfig;
    status: 'scheduled' | 'running' | 'completed' | 'failed';
    lastRun?: Date;
    nextRun?: Date;
}
export interface ScheduleConfig {
    type: 'cron' | 'interval' | 'once';
    value: string | number;
    timezone?: string;
}
export interface WorkflowScheduler {
    scheduleWorkflow(workflowId: string, schedule: string | Date | ScheduleConfig, context?: any): ScheduledWorkflow;
    cancelSchedule(scheduleId: string): void;
    pauseSchedule(scheduleId: string): void;
    resumeSchedule(scheduleId: string): void;
    getScheduledWorkflows(): ScheduledWorkflow[];
    getScheduleById(scheduleId: string): ScheduledWorkflow | undefined;
    updateSchedule(scheduleId: string, schedule: string | Date | ScheduleConfig): void;
    registerScheduledWorkflow(workflowId: string, schedule: any): ScheduledWorkflow;
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    getScheduleHistory(scheduleId: string): ScheduleExecutionHistory[];
}
export interface ScheduleExecutionHistory {
    scheduleId: string;
    workflowId: string;
    executionId: string;
    startTime: Date;
    endTime?: Date;
    status: 'success' | 'failed' | 'cancelled';
    error?: Error;
}
export declare class WorkflowSchedulerEngine extends EventEmitter implements WorkflowScheduler {
    private scheduledWorkflows;
    private timers;
    private cronJobs;
    private executionHistory;
    private workflowEngine?;
    private isInitialized;
    constructor(workflowEngine?: WorkflowEngine);
    setWorkflowEngine(engine: WorkflowEngine): void;
    scheduleWorkflow(workflowId: string, schedule: string | Date | ScheduleConfig, context?: any): ScheduledWorkflow;
    cancelSchedule(scheduleId: string): void;
    pauseSchedule(scheduleId: string): void;
    resumeSchedule(scheduleId: string): void;
    getScheduledWorkflows(): ScheduledWorkflow[];
    getScheduleById(scheduleId: string): ScheduledWorkflow | undefined;
    updateSchedule(scheduleId: string, schedule: string | Date | ScheduleConfig): void;
    private setupSchedule;
    private scheduleOnce;
    private scheduleByConfig;
    private scheduleInterval;
    private scheduleCron;
    private getNextCronRun;
    private runScheduledWorkflow;
    private updateNextRun;
    registerScheduledWorkflow(workflowId: string, schedule: any): ScheduledWorkflow;
    getScheduleHistory(scheduleId: string): ScheduleExecutionHistory[];
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
}
export interface ScheduledWorkflow {
    id: string;
    workflowId: string;
    schedule: string | Date | ScheduleConfig;
    status: 'scheduled' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';
    lastRun?: Date;
    nextRun?: Date;
    context?: any;
}
//# sourceMappingURL=workflow-scheduler.d.ts.map